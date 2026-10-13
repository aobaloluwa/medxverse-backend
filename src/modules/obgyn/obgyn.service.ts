import { Types } from 'mongoose';
import { ObgynRecordModel } from './obgyn.model.js';
import { PatientModel } from '../patient/patient.model.js';
import type { CreateObgynRecordInput, ObgynListQuery } from './obgyn.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const toObjectId = (value: string, label: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) throw new Error(`A valid ${label} ID is required.`);
  return new Types.ObjectId(value);
};

export class ObgynService {
  private async populate(query: any) {
    // Patient is a registered model in the current backend. Staff/account IDs are
    // intentionally left unpopulated because the app supports both account and staff JWTs.
    return query.populate('patientId', 'firstName lastName mrn dateOfBirth gender phone');
  }

  async create(hospitalId: string, userId: string, input: CreateObgynRecordInput) {
    const hospitalObjectId = toObjectId(hospitalId, 'hospital');
    const userObjectId = toObjectId(userId, 'user');
    const patientObjectId = toObjectId(input.patientId, 'patient');
    const patient = await PatientModel.findOne({ _id: patientObjectId, hospitalId: hospitalObjectId, active: true }).select('_id').lean();
    if (!patient) throw new Error('Patient was not found in this hospital.');
    if (input.recordType !== 'PREGNANCY' && input.recordType !== 'GYNECOLOGY') throw new Error('Invalid O&G record type.');

    const lmp = input.lastMenstrualPeriod ? new Date(input.lastMenstrualPeriod) : undefined;
    const ultrasoundDate = input.ultrasoundDatingDate ? new Date(input.ultrasoundDatingDate) : undefined;
    let edd = input.estimatedDeliveryDate ? new Date(input.estimatedDeliveryDate) : undefined;
    if (!edd && lmp && !Number.isNaN(lmp.getTime())) edd = addDays(lmp, 280);
    if (!edd && ultrasoundDate && Number.isFinite(input.ultrasoundGestationalAgeWeeks)) {
      edd = addDays(ultrasoundDate, 280 - Number(input.ultrasoundGestationalAgeWeeks) * 7);
    }

    const created = await ObgynRecordModel.create({
      hospitalId: hospitalObjectId, patientId: patientObjectId, createdBy: userObjectId, recordType: input.recordType,
      gravida: input.gravida, para: input.para, abortions: input.abortions, livingChildren: input.livingChildren,
      lastMenstrualPeriod: lmp, ultrasoundDatingDate: ultrasoundDate,
      ultrasoundGestationalAgeWeeks: input.ultrasoundGestationalAgeWeeks, estimatedDeliveryDate: edd,
      pregnancyStatus: input.recordType === 'PREGNANCY' ? 'ACTIVE' : undefined,
      riskFlags: Array.isArray(input.riskFlags) ? input.riskFlags.filter((x) => typeof x === 'string').slice(0, 30) : [],
      consentToShare: Boolean(input.consentToShare), consentUpdatedAt: input.consentToShare ? new Date() : undefined,
      menstrualHistory: input.menstrualHistory ? { ...input.menstrualHistory, lastPeriodDate: input.menstrualHistory.lastPeriodDate ? new Date(input.menstrualHistory.lastPeriodDate) : undefined } : undefined,
      auditTrail: [{ action: 'RECORD_CREATED', actorId: userObjectId, occurredAt: new Date() }],
    });
    return this.populate(ObgynRecordModel.findById(created._id));
  }

  async list(hospitalId: string, query: ObgynListQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, any> = { hospitalId, isActive: true };
    if (query.recordType) filter.recordType = query.recordType;
    if (query.pregnancyStatus) filter.pregnancyStatus = query.pregnancyStatus;
    if (query.highRisk) {
      filter.$and = [
        { $or: [{ riskFlags: { $exists: true, $ne: [] } }, { dangerSigns: { $exists: true, $ne: [] } }] },
      ];
    }
    if (query.search?.trim()) {
      const term = query.search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patients = await PatientModel.find({ hospitalId, active: true, $or: [
        { firstName: { $regex: term, $options: 'i' } }, { lastName: { $regex: term, $options: 'i' } }, { mrn: { $regex: term, $options: 'i' } }, { phone: { $regex: term, $options: 'i' } },
      ] }).select('_id').limit(200).lean();
      filter.patientId = { $in: patients.map((p: any) => p._id) };
    }
    const [records, total] = await Promise.all([
      this.populate(ObgynRecordModel.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit)),
      ObgynRecordModel.countDocuments(filter),
    ]);
    return { records, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(hospitalId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.populate(ObgynRecordModel.findOne({ _id: id, hospitalId, isActive: true }));
  }

  async addEntry(hospitalId: string, id: string, field: 'ancVisits' | 'pncVisits' | 'gynecologyVisits' | 'familyPlanningRecords' | 'referrals', body: Record<string, any>, userId: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const actorId = toObjectId(userId, 'user');
    // The payload is assembled dynamically for several visit-entry schemas.
    // Keep it indexable so TypeScript accepts the fields added below.
    const payload: Record<string, any> = { ...body, recordedBy: actorId };
    if (field === 'ancVisits' || field === 'pncVisits') {
      payload.visitDate = body.visitDate ? new Date(body.visitDate) : new Date();
      payload.dangerSigns = Array.isArray(body.dangerSigns) ? body.dangerSigns.filter((x: unknown) => typeof x === 'string').slice(0, 30) : [];
    }
    if (field === 'gynecologyVisits') payload.visitDate = body.visitDate ? new Date(body.visitDate) : new Date();
    if (field === 'familyPlanningRecords') {
      payload.dateProvided = body.dateProvided ? new Date(body.dateProvided) : new Date();
      if (body.followUpDate) payload.followUpDate = new Date(body.followUpDate);
    }
    if (field === 'referrals') payload.createdAt = new Date();
    const auditAction: Record<string, string> = { ancVisits: 'ANC_VISIT_ADDED', pncVisits: 'PNC_VISIT_ADDED', gynecologyVisits: 'GYNECOLOGY_VISIT_ADDED', familyPlanningRecords: 'FAMILY_PLANNING_RECORDED', referrals: 'REFERRAL_CREATED' };
    const update: Record<string, any> = { $push: { [field]: payload, auditTrail: { action: auditAction[field], actorId, occurredAt: new Date() } } };
    if ((field === 'ancVisits' || field === 'pncVisits') && payload.dangerSigns.length) update.$addToSet = { dangerSigns: { $each: payload.dangerSigns } };
    if (field === 'ancVisits') {
      const bp = String(payload.bloodPressure || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
      if (bp && (Number(bp[1]) >= 140 || Number(bp[2]) >= 90)) { payload.dangerSigns.push('High blood pressure reading — prompt clinical review'); update.$addToSet = { ...(update.$addToSet || {}), dangerSigns: { $each: payload.dangerSigns } }; }
      if (payload.fetalMovement === 'REDUCED') { payload.dangerSigns.push('Reduced fetal movement'); update.$addToSet = { ...(update.$addToSet || {}), dangerSigns: { $each: payload.dangerSigns } }; }
      if (Number(payload.hemoglobinGdl) > 0 && Number(payload.hemoglobinGdl) < 11) update.$addToSet = { ...(update.$addToSet || {}), riskFlags: 'Low haemoglobin reading — clinical review' };
    }
    return this.populate(ObgynRecordModel.findOneAndUpdate({ _id: id, hospitalId, isActive: true }, update, { new: true, runValidators: true }));
  }

  async recordDelivery(hospitalId: string, id: string, body: Record<string, any>, userId: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const actorId = toObjectId(userId, 'user');
    const delivery = { ...body, deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : new Date(), recordedBy: actorId };
    const update: Record<string, any> = { $set: { delivery, pregnancyStatus: 'DELIVERED' }, $push: { auditTrail: { action: 'DELIVERY_RECORDED', actorId, occurredAt: new Date() } } };
    const deliveryFlags = [...(Array.isArray(body.dangerSigns) ? body.dangerSigns : []), ...(body.postpartumHemorrhage ? ['Postpartum haemorrhage recorded — prompt clinical review'] : [])];
    if (deliveryFlags.length) update.$addToSet = { dangerSigns: { $each: deliveryFlags } };
    return this.populate(ObgynRecordModel.findOneAndUpdate({ _id: id, hospitalId, isActive: true, recordType: 'PREGNANCY' }, update, { new: true, runValidators: true }));
  }

  async updateConsent(hospitalId: string, id: string, consentToShare: boolean, userId: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.populate(ObgynRecordModel.findOneAndUpdate({ _id: id, hospitalId, isActive: true }, { $set: { consentToShare, consentUpdatedAt: new Date() }, $push: { auditTrail: { action: consentToShare ? 'SHARING_CONSENT_GRANTED' : 'SHARING_CONSENT_REVOKED', actorId: toObjectId(userId, 'user'), occurredAt: new Date() } } }, { new: true }));
  }

  async updateRiskFlags(hospitalId: string, id: string, riskFlags: string[], userId: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const clean = Array.isArray(riskFlags) ? [...new Set(riskFlags.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean))].slice(0, 30) : [];
    return this.populate(ObgynRecordModel.findOneAndUpdate({ _id: id, hospitalId, isActive: true }, { $set: { riskFlags: clean }, $push: { auditTrail: { action: 'RISK_FLAGS_UPDATED', actorId: toObjectId(userId, 'user'), occurredAt: new Date() } } }, { new: true }));
  }

  async summary(hospitalId: string) {
    const [totalPatients, activePregnancies, highRisk, deliveries, gynaeRecords, referrals] = await Promise.all([
      ObgynRecordModel.countDocuments({ hospitalId, isActive: true }),
      ObgynRecordModel.countDocuments({ hospitalId, isActive: true, recordType: 'PREGNANCY', pregnancyStatus: 'ACTIVE' }),
      ObgynRecordModel.countDocuments({ hospitalId, isActive: true, $or: [{ riskFlags: { $exists: true, $ne: [] } }, { dangerSigns: { $exists: true, $ne: [] } }] }),
      ObgynRecordModel.countDocuments({ hospitalId, isActive: true, pregnancyStatus: 'DELIVERED' }),
      ObgynRecordModel.countDocuments({ hospitalId, isActive: true, recordType: 'GYNECOLOGY' }),
      ObgynRecordModel.countDocuments({ hospitalId, isActive: true, 'referrals.status': { $in: ['PENDING', 'SENT'] } }),
    ]);
    const anc = await ObgynRecordModel.aggregate([
      { $match: { hospitalId: new Types.ObjectId(hospitalId), isActive: true, recordType: 'PREGNANCY' } },
      { $project: { visits: { $size: { $ifNull: ['$ancVisits', []] } } } },
      { $group: { _id: null, contacts: { $sum: '$visits' }, completed8: { $sum: { $cond: [{ $gte: ['$visits', 8] }, 1, 0] } } } },
    ]);
    return { totalPatients, activePregnancies, highRisk, deliveries, gynaeRecords, openReferrals: referrals, ancContactsRecorded: anc[0]?.contacts || 0, pregnanciesWith8Contacts: anc[0]?.completed8 || 0 };
  }

  async reports(hospitalId: string) {
    const records = await ObgynRecordModel.find({ hospitalId, isActive: true }).select('recordType pregnancyStatus ancVisits pncVisits delivery familyPlanningRecords referrals riskFlags dangerSigns').lean();
    const pregnancy = records.filter((r: any) => r.recordType === 'PREGNANCY');
    const pncCompleted = pregnancy.filter((r: any) => (r.pncVisits || []).length > 0).length;
    const fpRecords = records.reduce((n: number, r: any) => n + (r.familyPlanningRecords || []).length, 0);
    const referrals = records.reduce((n: number, r: any) => n + (r.referrals || []).length, 0);
    const highRisk = records.filter((r: any) => (r.riskFlags || []).length || (r.dangerSigns || []).length).length;
    return { totalRecords: records.length, pregnancyRecords: pregnancy.length, activePregnancies: pregnancy.filter((r: any) => r.pregnancyStatus === 'ACTIVE').length, delivered: pregnancy.filter((r: any) => r.pregnancyStatus === 'DELIVERED').length, anc8ContactCompletion: pregnancy.length ? Math.round(100 * pregnancy.filter((r: any) => (r.ancVisits || []).length >= 8).length / pregnancy.length) : 0, pncCompletion: pregnancy.length ? Math.round(100 * pncCompleted / pregnancy.length) : 0, highRiskRecords: highRisk, familyPlanningEntries: fpRecords, referralsIssued: referrals };
  }
}

export const obgynService = new ObgynService();

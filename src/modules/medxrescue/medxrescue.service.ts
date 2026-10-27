import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { StaffUser } from '../staff-auth/staff-user.model.js';
import { publishMedxRescueEvent } from './medxrescue.events.js';
import {
  RescueAuditModel, RescueDispatchOfferModel, RescueIncidentModel, RescueProviderModel, RescueVehicleModel, RescueFacilityModel, RescueFacilityAcceptanceModel, RescueClinicalHandoverModel, RescueProviderMemberModel,
} from './medxrescue.model.js';
import {
  IncidentStatus, IncidentPriority, ProviderVerificationStatus, ProviderOperationalStatus,
  RescueVehicleClass, DispatchOfferStatus, FacilityAcceptanceStatus,
} from './medxrescue.types.js';

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');
const makeReference = (): string => `MRX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

function geoPoint(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude); const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw Object.assign(new Error('A valid latitude and longitude are required.'), { statusCode: 400 });
  }
  return { type: 'Point' as const, coordinates: [lng, lat] as [number, number] };
}
function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw Object.assign(new Error(`${label} is required and must be at most ${max} characters.`), { statusCode: 400 });
  }
  return value.trim();
}
async function audit(input: { incidentId?: Types.ObjectId; actorType: string; actorId?: string; action: string; reason?: string; metadata?: Record<string, unknown> }) {
  await RescueAuditModel.create({ ...input, actorId: input.actorId && Types.ObjectId.isValid(input.actorId) ? new Types.ObjectId(input.actorId) : undefined });
}

export class MedxRescueService {
  async createGuestIncident(input: Record<string, unknown>, idempotencyKey: string) {
    if (!idempotencyKey || idempotencyKey.length > 160) throw Object.assign(new Error('A valid Idempotency-Key request header is required.'), { statusCode: 400 });

    const callerPhone = requireText(input.callerPhone, 'Caller phone', 40);
    const chiefComplaint = requireText(input.chiefComplaint, 'Emergency description', 500);
    const callerIsPatient = input.callerIsPatient !== false;
    const hasCoordinates = input.latitude !== undefined && input.latitude !== null && input.latitude !== '' && input.longitude !== undefined && input.longitude !== null && input.longitude !== '';
    const landmark = typeof input.landmark === 'string' ? input.landmark.trim().slice(0, 500) : undefined;
    const locationDescription = typeof input.locationDescription === 'string' ? input.locationDescription.trim().slice(0, 500) : undefined;
    if (!hasCoordinates && !landmark && !locationDescription) throw Object.assign(new Error('Provide GPS coordinates, a landmark, or a location description so dispatch can locate the emergency.'), { statusCode: 400 });
    const location = hasCoordinates ? geoPoint(input.latitude, input.longitude) : undefined;
    const callerName = typeof input.callerName === 'string' ? input.callerName.trim().slice(0, 120) : undefined;
    const patientName = callerIsPatient ? undefined : (typeof input.patientName === 'string' ? input.patientName.trim().slice(0, 120) : undefined);
    const patientAge = input.patientAge === undefined || input.patientAge === '' ? undefined : Number(input.patientAge);
    if (patientAge !== undefined && (!Number.isFinite(patientAge) || patientAge < 0 || patientAge > 120)) {
      throw Object.assign(new Error('Patient age must be a number between 0 and 120.'), { statusCode: 400 });
    }
    const additionalDetails = typeof input.additionalDetails === 'string' ? input.additionalDetails.trim().slice(0, 2000) : undefined;
    const triageAnswers = Array.isArray(input.triageAnswers) ? input.triageAnswers.slice(0, 30).map((item: any) => ({ questionId: String(item?.questionId || '').trim().slice(0, 80), answer: String(item?.answer || '').trim().slice(0, 300) })).filter((item: any) => item.questionId && item.answer) : [];
    // Caller-provided urgency is never trusted as a clinical decision. These conservative keyword flags are only a review aid and must be approved by the pilot's clinical-safety lead before live use.
    const affirmative = (value: string) => ['YES', 'TRUE', '1', 'SEVERE', 'CANNOT', 'UNCONSCIOUS', 'NOT BREATHING'].includes(value.trim().toUpperCase());
    const immediateQuestionIds = new Set(['unconscious', 'not_breathing', 'severe_breathing_difficulty', 'severe_bleeding', 'stroke_signs', 'seizure', 'unresponsive']);
    const hasImmediateRedFlag = triageAnswers.some((item: any) => immediateQuestionIds.has(item.questionId.toLowerCase().replace(/[^a-z0-9_]/g, '_')) && affirmative(item.answer));
    const triageSuggestedUrgency = hasImmediateRedFlag ? 'IMMEDIATE' : 'UNKNOWN';
    // Final urgency remains UNKNOWN until a dispatcher/qualified reviewer records it.
    const triageUrgency = 'UNKNOWN';
    const intakeChannel = ['GUEST_WEB', 'APP_SOS', 'ASSISTED', 'OTHER'].includes(String(input.intakeChannel)) ? String(input.intakeChannel) : 'GUEST_WEB';
    const locationAccuracyMeters = input.locationAccuracyMeters === undefined ? undefined : Number(input.locationAccuracyMeters);
    if (locationAccuracyMeters !== undefined && (!Number.isFinite(locationAccuracyMeters) || locationAccuracyMeters < 0 || locationAccuracyMeters > 100000)) {
      throw Object.assign(new Error('Location accuracy must be a valid number between 0 and 100000 metres.'), { statusCode: 400 });
    }
    const fingerprint = sha256(JSON.stringify({
      callerPhone, chiefComplaint, callerIsPatient, callerName, patientName, patientAge,
      additionalDetails, triageAnswers, triageUrgency, triageSuggestedUrgency, location, landmark, locationDescription, intakeChannel, locationAccuracyMeters,
    }));
    const token = crypto.createHmac('sha256', env.JWT_SECRET).update(`guest:${idempotencyKey}`).digest('base64url');
    const existing = await RescueIncidentModel.findOne({ idempotencyKey }).select('+guestTokenHash +idempotencyFingerprint').exec();
    if (existing) {
      if (!existing.idempotencyFingerprint || !safeEqual(existing.idempotencyFingerprint, fingerprint)) {
        throw Object.assign(new Error('Idempotency key has already been used for a different emergency request.'), { statusCode: 409 });
      }
      if (!safeEqual(existing.guestTokenHash, sha256(token))) throw Object.assign(new Error('Emergency access token could not be verified.'), { statusCode: 409 });
      return { incident: this.publicIncident(existing), accessToken: token, reused: true };
    }

    let incident: any;
    try {
      incident = await RescueIncidentModel.create({
        publicReference: makeReference(), status: IncidentStatus.REQUEST_RECEIVED,
        priority: IncidentPriority.UNTRIAGED,
        intakeChannel,
        callerName,
        callerPhone, callerIsPatient, patientName, patientAge,
        chiefComplaint, additionalDetails, triageAnswers, triageUrgency, triageSuggestedUrgency,
        location, landmark, locationDescription, locationAccuracyMeters,
        guestTokenHash: sha256(token), guestTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        idempotencyKey, idempotencyFingerprint: fingerprint,
        events: [{ status: IncidentStatus.REQUEST_RECEIVED, at: new Date(), actorType: 'GUEST', note: 'Emergency request received; dispatcher review is required.' }],
      });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        const raced = await RescueIncidentModel.findOne({ idempotencyKey }).select('+guestTokenHash +idempotencyFingerprint').exec();
        if (raced && raced.idempotencyFingerprint && safeEqual(raced.idempotencyFingerprint, fingerprint) && safeEqual(raced.guestTokenHash, sha256(token))) {
          return { incident: this.publicIncident(raced), accessToken: token, reused: true };
        }
        if (raced) throw Object.assign(new Error('Idempotency key has already been used for a different emergency request.'), { statusCode: 409 });
      }
      throw error;
    }
    await audit({ incidentId: incident._id, actorType: 'GUEST', action: 'INCIDENT_CREATED', metadata: { intakeChannel: incident.intakeChannel } });
    publishMedxRescueEvent({ type: 'incident.created', incidentId: String(incident._id), incidentReference: incident.publicReference, status: incident.status, triageSuggestedUrgency: incident.triageSuggestedUrgency });
    if (incident.triageSuggestedUrgency === 'IMMEDIATE') {
      await audit({ incidentId: incident._id, actorType: 'SYSTEM', action: 'TRIAGE_RED_FLAG_REQUIRES_REVIEW', metadata: { suggestedUrgency: incident.triageSuggestedUrgency } });
      publishMedxRescueEvent({ type: 'incident.escalation.required', incidentId: String(incident._id), incidentReference: incident.publicReference, status: incident.status, reason: 'A configured triage red-flag answer requires immediate dispatcher review.' });
    }
    return { incident: this.publicIncident(incident), accessToken: token, reused: false };
  }

  private publicIncident(incident: any) {
    const publicStatusMessage: Record<IncidentStatus, string> = {
      [IncidentStatus.REQUEST_RECEIVED]: 'Your request has been received. A human dispatcher must review it.',
      [IncidentStatus.DISPATCH_REVIEW]: 'A dispatcher is reviewing your request.',
      [IncidentStatus.OFFERED_TO_CREW]: 'Eligible providers have been offered the request. Crew acceptance is pending.',
      [IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION]: 'A crew has accepted; the dispatcher is validating and confirming the assignment.',
      [IncidentStatus.CREW_CONFIRMED]: 'A dispatcher has confirmed the verified crew and vehicle.',
      [IncidentStatus.EN_ROUTE]: 'The confirmed crew is en route.',
      [IncidentStatus.ON_SCENE]: 'The crew has arrived at the reported location.',
      [IncidentStatus.TRANSPORTING]: 'The patient is being transported.',
      [IncidentStatus.HANDED_OVER]: 'The receiving facility has recorded the handover.',
      [IncidentStatus.CANCELLED]: 'The request was cancelled.',
      [IncidentStatus.NO_RESOURCE_AVAILABLE]: 'No suitable resource is currently confirmed. Contact the dispatcher or local emergency services for further help.',
    };
    return {
      id: String(incident._id), reference: incident.publicReference, status: incident.status,
      chiefComplaint: incident.chiefComplaint, location: incident.location, landmark: incident.landmark, locationDescription: incident.locationDescription,
      createdAt: incident.createdAt, updatedAt: incident.updatedAt,
      // No assignment is implied until a verified crew explicitly accepts an offer.
      crewConfirmed: [IncidentStatus.CREW_CONFIRMED, IncidentStatus.EN_ROUTE, IncidentStatus.ON_SCENE, IncidentStatus.TRANSPORTING, IncidentStatus.HANDED_OVER].includes(incident.status),
      events: (incident.events || []).map((event: any) => ({
        status: event.status,
        at: event.at,
        note: publicStatusMessage[event.status as IncidentStatus] || 'Emergency request status updated.',
      })),
    };
  }

  async cancelGuestIncident(reference: string, token: string, reason?: string) {
    const incident = await RescueIncidentModel.findOne({
      publicReference: reference,
      guestTokenExpiresAt: { $gt: new Date() },
    }).select('+guestTokenHash').exec();
    if (!incident || !safeEqual(incident.guestTokenHash, sha256(token))) {
      throw Object.assign(new Error('Emergency request not found or access link expired.'), { statusCode: 404 });
    }
    if (![IncidentStatus.REQUEST_RECEIVED, IncidentStatus.DISPATCH_REVIEW, IncidentStatus.OFFERED_TO_CREW, IncidentStatus.NO_RESOURCE_AVAILABLE].includes(incident.status)) {
      throw Object.assign(new Error('A crew-confirmed or active response cannot be cancelled through guest self-service. Contact the dispatcher immediately.'), { statusCode: 409 });
    }
    const previousStatus = incident.status;
    const cancelled = await RescueIncidentModel.findOneAndUpdate(
      { _id: incident._id, status: previousStatus },
      { $set: { status: IncidentStatus.CANCELLED, cancelledAt: new Date() }, $push: { events: {
        status: IncidentStatus.CANCELLED, at: new Date(), actorType: 'GUEST',
        note: reason?.slice(0, 500) || 'Caller requested cancellation before crew confirmation.',
      } } },
      { new: true },
    ).exec();
    if (!cancelled) throw Object.assign(new Error('Incident changed while cancellation was being processed. Contact the dispatcher.'), { statusCode: 409 });
    await RescueDispatchOfferModel.updateMany({ incidentId: incident._id, status: DispatchOfferStatus.PENDING }, { $set: { status: DispatchOfferStatus.WITHDRAWN, respondedAt: new Date(), responseNote: 'Guest cancelled incident before crew confirmation.' } }).exec();
    await audit({ incidentId: incident._id, actorType: 'GUEST', action: 'GUEST_CANCELLED_INCIDENT', reason, metadata: { previousStatus } });
    publishMedxRescueEvent({ type: 'incident.changed', incidentId: String(cancelled._id), incidentReference: cancelled.publicReference, status: cancelled.status });
    return this.publicIncident(cancelled);
  }

  async getIncidentById(id: string, hospitalAccountId?: string) {
    if (!Types.ObjectId.isValid(id)) throw Object.assign(new Error('Invalid incident ID.'), { statusCode: 400 });
    const filter: Record<string, unknown> = { _id: id };
    if (hospitalAccountId !== undefined) {
      if (!Types.ObjectId.isValid(hospitalAccountId)) throw Object.assign(new Error('Hospital account context is missing.'), { statusCode: 403 });
      const facilities = await RescueFacilityModel.find({ ownerAccountId: new Types.ObjectId(hospitalAccountId) }).select('_id').lean().exec();
      filter.destinationFacilityId = { $in: facilities.map((facility) => facility._id) };
    }
    const incident = await RescueIncidentModel.findOne(filter).select('-guestTokenHash -idempotencyKey -idempotencyFingerprint').populate('providerId', 'displayName verificationStatus').populate('vehicleId', 'registrationNumber makeModel vehicleClass location locationUpdatedAt locationAccuracyMeters status').populate('destinationFacilityId', 'name facilityType address capabilities emergencyContactPhone location active').exec();
    if (!incident) throw Object.assign(new Error('Emergency incident not found or you do not have access to it.'), { statusCode: 404 });
    return incident;
  }

  async getGuestIncident(reference: string, token: string) {
    const incident = await RescueIncidentModel.findOne({ publicReference: reference, guestTokenExpiresAt: { $gt: new Date() } }).select('+guestTokenHash').exec();
    if (!incident || !safeEqual(incident.guestTokenHash, sha256(token))) throw Object.assign(new Error('Emergency request not found or access link expired.'), { statusCode: 404 });
    const result = this.publicIncident(incident) as Record<string, any>;
    // Guest tracking is incident-scoped and is exposed only after dispatcher-confirmed assignment.
    if ([IncidentStatus.CREW_CONFIRMED, IncidentStatus.EN_ROUTE, IncidentStatus.ON_SCENE, IncidentStatus.TRANSPORTING].includes(incident.status) && result.crewConfirmed && incident.vehicleId) {
      const vehicle = await RescueVehicleModel.findOne({ _id: incident.vehicleId, activeIncidentId: incident._id }).select('location locationUpdatedAt locationAccuracyMeters status').lean().exec() as any;
      if (vehicle?.location?.coordinates?.length === 2 && vehicle.locationUpdatedAt) {
        const updatedAt = new Date(vehicle.locationUpdatedAt);
        const ageMs = Math.max(0, Date.now() - updatedAt.getTime());
        result.tracking = {
          latitude: vehicle.location.coordinates[1],
          longitude: vehicle.location.coordinates[0],
          locationUpdatedAt: updatedAt,
          locationAccuracyMeters: vehicle.locationAccuracyMeters,
          freshness: ageMs <= 15_000 ? 'LIVE' : ageMs <= 60_000 ? 'DELAYED' : 'STALE',
          isStale: ageMs > 60_000,
        };
      } else {
        result.tracking = { freshness: 'UNAVAILABLE', isStale: true };
      }
    }
    return result;
  }

  async listIncidents(query: Record<string, unknown>, hospitalAccountId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const filter: Record<string, unknown> = {};
    if (query.status && Object.values(IncidentStatus).includes(query.status as IncidentStatus)) filter.status = query.status;
    if (hospitalAccountId !== undefined) {
      if (!Types.ObjectId.isValid(hospitalAccountId)) throw Object.assign(new Error('Hospital account context is missing.'), { statusCode: 403 });
      const facilities = await RescueFacilityModel.find({ ownerAccountId: new Types.ObjectId(hospitalAccountId) }).select('_id').lean().exec();
      const facilityIds = facilities.map((facility) => facility._id);
      // Include unassigned incoming emergency SOS requests AND requests assigned to this hospital
      filter.$or = [
        { destinationFacilityId: { $in: facilityIds } },
        { destinationFacilityId: { $exists: false } },
        { destinationFacilityId: null },
      ];
    }
    const [incidents, total] = await Promise.all([
      RescueIncidentModel.aggregate([
        { $match: filter },
        { $addFields: { priorityRank: { $switch: { branches: [
          { case: { $eq: ['$priority', IncidentPriority.CRITICAL] }, then: 4 },
          { case: { $eq: ['$priority', IncidentPriority.URGENT] }, then: 3 },
          { case: { $eq: ['$priority', IncidentPriority.UNTRIAGED] }, then: 2 },
          { case: { $eq: ['$priority', IncidentPriority.ROUTINE] }, then: 1 },
        ], default: 0 } } } },
        { $sort: { priorityRank: -1, createdAt: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { guestTokenHash: 0, idempotencyKey: 0, idempotencyFingerprint: 0, priorityRank: 0 } },
      ]).exec(),
      RescueIncidentModel.countDocuments(filter),
    ]);
    return { incidents, total, page, limit };
  }

  async expirePendingOffers() {
    const now = new Date();
    const expired = await RescueDispatchOfferModel.find({ status: DispatchOfferStatus.PENDING, expiresAt: { $lte: now } }).select('_id incidentId providerId vehicleId').limit(200).lean().exec();
    let processed = 0;
    for (const item of expired) {
      const offer = await RescueDispatchOfferModel.findOneAndUpdate(
        { _id: item._id, status: DispatchOfferStatus.PENDING, expiresAt: { $lte: now } },
        { $set: { status: DispatchOfferStatus.EXPIRED, respondedAt: now, responseNote: 'Offer expired without crew response.' } },
        { new: true },
      ).exec();
      if (!offer) continue;
      const liveOffers = await RescueDispatchOfferModel.countDocuments({ incidentId: item.incidentId, status: DispatchOfferStatus.PENDING, expiresAt: { $gt: now } }).exec();
      const incident = liveOffers === 0 ? await RescueIncidentModel.findOneAndUpdate(
        { _id: item.incidentId, status: IncidentStatus.OFFERED_TO_CREW, acceptedOfferId: { $exists: false } },
        { $set: { status: IncidentStatus.DISPATCH_REVIEW }, $push: { events: { status: IncidentStatus.DISPATCH_REVIEW, at: now, actorType: 'SYSTEM', note: 'All dispatch offers expired without crew response; dispatcher review required.' } } },
        { new: true },
      ).exec() : await RescueIncidentModel.findById(item.incidentId).exec();
      await audit({ incidentId: item.incidentId, actorType: 'SYSTEM', action: 'DISPATCH_OFFER_EXPIRED', metadata: { offerId: String(item._id), incidentReturnedToReview: Boolean(incident) } });
      publishMedxRescueEvent({ type: 'dispatch.offer.responded', incidentId: String(item.incidentId), incidentReference: incident?.publicReference, status: incident?.status || IncidentStatus.OFFERED_TO_CREW, offerId: String(item._id), providerId: String(item.providerId), vehicleId: String(item.vehicleId) });
      processed += 1;
    }
    return processed;
  }

  async recordEmergencyEscalation(id: string, actorId: string, channel: string, reason?: string) {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(actorId)) throw Object.assign(new Error('Valid incident and dispatcher IDs are required.'), { statusCode: 400 });
    const allowedChannels = ['112', 'PHONE_DISPATCH', 'MANUAL_PROVIDER_CONTACT', 'OTHER'];
    if (!allowedChannels.includes(channel)) throw Object.assign(new Error('Choose a supported escalation channel.'), { statusCode: 400 });
    const incident = await RescueIncidentModel.findById(id).select('publicReference status priority triageSuggestedUrgency').exec();
    if (!incident) throw Object.assign(new Error('Emergency incident not found.'), { statusCode: 404 });
    if ([IncidentStatus.CANCELLED, IncidentStatus.HANDED_OVER].includes(incident.status)) throw Object.assign(new Error('A closed incident cannot be escalated.'), { statusCode: 409 });
    await audit({ incidentId: incident._id, actorType: 'STAFF', actorId, action: 'EMERGENCY_FALLBACK_ESCALATION_RECORDED', reason, metadata: { channel, incidentStatus: incident.status, priority: incident.priority, triageSuggestedUrgency: incident.triageSuggestedUrgency, recordedAt: new Date().toISOString() } });
    publishMedxRescueEvent({ type: 'incident.escalation.recorded', incidentId: String(incident._id), incidentReference: incident.publicReference, status: incident.status, channel, reason: reason?.slice(0, 500) });
    return { incidentId: String(incident._id), reference: incident.publicReference, status: incident.status, channel, recordedAt: new Date() };
  }

  async updateIncidentPriority(id: string, priority: IncidentPriority, actorId: string, reason?: string) {
    if (!Types.ObjectId.isValid(id)) throw Object.assign(new Error('Invalid incident ID.'), { statusCode: 400 });
    if (![IncidentPriority.ROUTINE, IncidentPriority.URGENT, IncidentPriority.CRITICAL].includes(priority)) throw Object.assign(new Error('A dispatcher must choose ROUTINE, URGENT, or CRITICAL priority.'), { statusCode: 400 });
    const current = await RescueIncidentModel.findById(id).exec();
    if (!current) throw Object.assign(new Error('Emergency incident not found.'), { statusCode: 404 });
    if ([IncidentStatus.CANCELLED, IncidentStatus.HANDED_OVER].includes(current.status)) throw Object.assign(new Error('Priority cannot be changed for a closed incident.'), { statusCode: 409 });
    const incident = await RescueIncidentModel.findOneAndUpdate(
      { _id: id, priority: current.priority },
      { $set: { priority, triageReviewedBy: new Types.ObjectId(actorId), triageReviewedAt: new Date(), triageUrgency: priority === IncidentPriority.CRITICAL ? 'IMMEDIATE' : priority === IncidentPriority.URGENT ? 'URGENT' : 'ROUTINE' }, $push: { events: { status: current.status, at: new Date(), actorType: 'STAFF', actorId: new Types.ObjectId(actorId), note: `Priority set to ${priority}${reason ? `: ${reason.slice(0, 350)}` : ''}` } } },
      { new: true },
    ).exec();
    if (!incident) throw Object.assign(new Error('Incident changed concurrently. Refresh and try again.'), { statusCode: 409 });
    await audit({ incidentId: incident._id, actorType: 'STAFF', actorId, action: 'INCIDENT_PRIORITY_CHANGED', reason, metadata: { priority } });
    publishMedxRescueEvent({ type: 'incident.changed', incidentId: String(incident._id), incidentReference: incident.publicReference, status: incident.status, providerId: incident.providerId ? String(incident.providerId) : undefined, vehicleId: incident.vehicleId ? String(incident.vehicleId) : undefined });
    return incident;
  }

  async updateIncidentStatus(id: string, status: IncidentStatus, actorId: string, reason?: string) {
    // These states are only entered by the explicit offer/accept workflow.
    if (status === IncidentStatus.HANDED_OVER) throw Object.assign(new Error('Use the clinical handover workflow to record hospital acceptance and handover.'), { statusCode: 409 });
    if ([IncidentStatus.OFFERED_TO_CREW, IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION, IncidentStatus.CREW_CONFIRMED].includes(status)) {
      throw Object.assign(new Error('Use the dispatch-offer workflow for offer and crew-confirmation states.'), { statusCode: 409 });
    }
    if (!Types.ObjectId.isValid(id)) throw Object.assign(new Error('Invalid incident ID.'), { statusCode: 400 });
    const allowed: Record<string, IncidentStatus[]> = {
      [IncidentStatus.REQUEST_RECEIVED]: [IncidentStatus.DISPATCH_REVIEW, IncidentStatus.CANCELLED],
      [IncidentStatus.DISPATCH_REVIEW]: [IncidentStatus.OFFERED_TO_CREW, IncidentStatus.NO_RESOURCE_AVAILABLE, IncidentStatus.CANCELLED],
      [IncidentStatus.OFFERED_TO_CREW]: [IncidentStatus.DISPATCH_REVIEW, IncidentStatus.CANCELLED],
      [IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION]: [IncidentStatus.CANCELLED],
      [IncidentStatus.CREW_CONFIRMED]: [IncidentStatus.EN_ROUTE, IncidentStatus.CANCELLED],
      [IncidentStatus.EN_ROUTE]: [IncidentStatus.ON_SCENE, IncidentStatus.CANCELLED],
      [IncidentStatus.ON_SCENE]: [IncidentStatus.TRANSPORTING, IncidentStatus.CANCELLED],
      [IncidentStatus.TRANSPORTING]: [IncidentStatus.HANDED_OVER],
      [IncidentStatus.NO_RESOURCE_AVAILABLE]: [IncidentStatus.DISPATCH_REVIEW, IncidentStatus.CANCELLED],
    };
    const current = await RescueIncidentModel.findById(id).exec();
    if (!current) throw Object.assign(new Error('Emergency incident not found.'), { statusCode: 404 });
    if (!allowed[current.status]?.includes(status)) throw Object.assign(new Error(`Invalid status transition: ${current.status} → ${status}.`), { statusCode: 409 });
    const updated = await RescueIncidentModel.findOneAndUpdate({ _id: id, status: current.status }, { $set: { status, ...(status === IncidentStatus.CANCELLED ? { cancelledAt: new Date() } : {}) }, $push: { events: { status, at: new Date(), actorType: 'STAFF', actorId: new Types.ObjectId(actorId), note: reason?.slice(0, 500) } } }, { new: true }).exec();
    if (!updated) throw Object.assign(new Error('Incident changed concurrently. Refresh and try again.'), { statusCode: 409 });
    if (status === IncidentStatus.CANCELLED) {
      await RescueDispatchOfferModel.updateMany({ incidentId: updated._id, status: DispatchOfferStatus.PENDING }, { $set: { status: DispatchOfferStatus.WITHDRAWN, respondedAt: new Date(), responseNote: 'Incident cancelled by dispatcher.' } }).exec();
      if (updated.vehicleId) {
        await RescueVehicleModel.updateOne(
          { _id: updated.vehicleId, activeIncidentId: updated._id },
          { $set: { status: ProviderOperationalStatus.OFFLINE }, $unset: { activeIncidentId: 1 } },
        ).exec();
      }
    }
    await audit({ incidentId: updated._id, actorType: 'STAFF', actorId, action: 'INCIDENT_STATUS_CHANGED', reason, metadata: { from: current.status, to: status } });
    publishMedxRescueEvent({ type: 'incident.changed', incidentId: String(updated._id), incidentReference: updated.publicReference, status: updated.status, providerId: updated.providerId ? String(updated.providerId) : undefined, vehicleId: updated.vehicleId ? String(updated.vehicleId) : undefined });
    return updated;
  }

  async linkProviderMember(providerId: string, userId: string, memberRole: string, linkedBy: string) {
    if (![providerId, userId, linkedBy].every(Types.ObjectId.isValid)) throw Object.assign(new Error('Valid provider, user, and linking administrator IDs are required.'), { statusCode: 400 });
    if (!['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC'].includes(memberRole)) throw Object.assign(new Error('Invalid provider member role.'), { statusCode: 400 });
    const provider = await RescueProviderModel.findOne({ _id: providerId, verificationStatus: ProviderVerificationStatus.VERIFIED }).exec();
    if (!provider) throw Object.assign(new Error('Provider must be verified before members can be linked.'), { statusCode: 409 });
    const staffUser = await StaffUser.findOne({ _id: userId, isActive: true }).select('_id role').exec();
    if (!staffUser) throw Object.assign(new Error('The linked user must be an active MedXVerse staff account.'), { statusCode: 404 });
    const member = await RescueProviderMemberModel.findOneAndUpdate(
      { providerId: new Types.ObjectId(providerId), userId: new Types.ObjectId(userId) },
      { $set: { memberRole, active: true, linkedBy: new Types.ObjectId(linkedBy) } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
    await audit({ actorType: 'STAFF', actorId: linkedBy, action: 'RESCUE_PROVIDER_MEMBER_LINKED', metadata: { providerId, userId, memberRole } });
    return member;
  }

  async resolveProviderIdForUser(userId: string, allowedMemberRoles?: string[]): Promise<string | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId), active: true };
    if (allowedMemberRoles?.length) filter.memberRole = { $in: allowedMemberRoles };
    const member = await RescueProviderMemberModel.findOne(filter).sort({ createdAt: -1 }).lean<{ providerId: Types.ObjectId }>().exec();
    return member ? String(member.providerId) : null;
  }

  async submitProvider(input: Record<string, unknown>) {
    const operatingAreas = Array.isArray(input.operatingAreas) ? input.operatingAreas.map(v => String(v).trim()).filter(Boolean).slice(0, 50) : [];
    if (!operatingAreas.length) throw Object.assign(new Error('Provide at least one operating area.'), { statusCode: 400 });
    const provider = await RescueProviderModel.create({ legalName: requireText(input.legalName, 'Legal name', 200), displayName: requireText(input.displayName, 'Display name', 120), registrationNumber: typeof input.registrationNumber === 'string' ? input.registrationNumber.trim().slice(0, 100) : undefined, contactName: requireText(input.contactName, 'Contact name', 120), contactPhone: requireText(input.contactPhone, 'Contact phone', 40), contactEmail: typeof input.contactEmail === 'string' ? input.contactEmail.trim().toLowerCase().slice(0, 200) : undefined, operatingAreas, verificationStatus: ProviderVerificationStatus.PENDING, operationalStatus: ProviderOperationalStatus.OFFLINE });
    await audit({ actorType: 'PROVIDER_APPLICANT', action: 'PROVIDER_APPLICATION_SUBMITTED', metadata: { providerId: String(provider._id) } });
    publishMedxRescueEvent({ type: 'provider.changed', providerId: String(provider._id) });
    return provider;
  }

  async reviewProvider(providerId: string, status: ProviderVerificationStatus, reviewerId: string, notes?: string) {
    if (!Types.ObjectId.isValid(providerId)) throw Object.assign(new Error('Invalid provider ID.'), { statusCode: 400 });
    if (![ProviderVerificationStatus.UNDER_REVIEW, ProviderVerificationStatus.VERIFIED, ProviderVerificationStatus.REJECTED, ProviderVerificationStatus.SUSPENDED].includes(status)) throw Object.assign(new Error('Invalid verification status.'), { statusCode: 400 });
    const provider = await RescueProviderModel.findByIdAndUpdate(providerId, { $set: { verificationStatus: status, reviewedBy: new Types.ObjectId(reviewerId), reviewedAt: new Date(), reviewNotes: notes?.slice(0, 1000), ...(status !== ProviderVerificationStatus.VERIFIED ? { operationalStatus: ProviderOperationalStatus.OFFLINE } : {}) } }, { new: true }).exec();
    if (!provider) throw Object.assign(new Error('Provider not found.'), { statusCode: 404 });
    await audit({ actorType: 'STAFF', actorId: reviewerId, action: 'PROVIDER_VERIFICATION_REVIEWED', reason: notes, metadata: { providerId, status } });
    publishMedxRescueEvent({ type: 'provider.changed', providerId });
    return provider;
  }

  async setProviderOperationalStatus(providerId: string, status: ProviderOperationalStatus, actorId: string) {
    if (!Types.ObjectId.isValid(providerId)) throw Object.assign(new Error('Invalid provider ID.'), { statusCode: 400 });
    if (!Object.values(ProviderOperationalStatus).includes(status)) throw Object.assign(new Error('Invalid provider operational status.'), { statusCode: 400 });
    if (status === ProviderOperationalStatus.AVAILABLE) {
      const provider = await RescueProviderModel.findOne({ _id: providerId, verificationStatus: ProviderVerificationStatus.VERIFIED }).exec();
      if (!provider) throw Object.assign(new Error('Only verified providers can become available.'), { statusCode: 409 });
    }
    const provider = await RescueProviderModel.findOneAndUpdate({ _id: providerId, ...(status === ProviderOperationalStatus.AVAILABLE ? { verificationStatus: ProviderVerificationStatus.VERIFIED } : {}) }, { $set: { operationalStatus: status } }, { new: true }).exec();
    if (!provider) throw Object.assign(new Error('Provider not found.'), { statusCode: 404 });
    if (status !== ProviderOperationalStatus.AVAILABLE) {
      await RescueVehicleModel.updateMany({ providerId, status: ProviderOperationalStatus.AVAILABLE }, { $set: { status: ProviderOperationalStatus.OFFLINE } }).exec();
    }
    await audit({ actorType: 'STAFF', actorId, action: 'RESCUE_PROVIDER_OPERATIONAL_STATUS_CHANGED', metadata: { providerId, status } });
    publishMedxRescueEvent({ type: 'provider.changed', providerId });
    return provider;
  }

  async setVehicleOperationalStatus(providerId: string, vehicleId: string, status: ProviderOperationalStatus, actorId: string) {
    if (!Types.ObjectId.isValid(providerId) || !Types.ObjectId.isValid(vehicleId)) throw Object.assign(new Error('Invalid provider or vehicle ID.'), { statusCode: 400 });
    if (![ProviderOperationalStatus.OFFLINE, ProviderOperationalStatus.AVAILABLE, ProviderOperationalStatus.BUSY].includes(status)) throw Object.assign(new Error('Invalid vehicle operational status.'), { statusCode: 400 });
    const provider = await RescueProviderModel.findOne({ _id: providerId, verificationStatus: ProviderVerificationStatus.VERIFIED, operationalStatus: ProviderOperationalStatus.AVAILABLE }).exec();
    if (!provider && status === ProviderOperationalStatus.AVAILABLE) throw Object.assign(new Error('Only verified, operationally available providers can list a vehicle as available.'), { statusCode: 409 });
    const vehicle = await RescueVehicleModel.findOne({ _id: vehicleId, providerId, activeIncidentId: { $exists: false } }).exec();
    if (!vehicle) throw Object.assign(new Error('Vehicle not found or currently assigned to an incident.'), { statusCode: 404 });
    if (status === ProviderOperationalStatus.AVAILABLE && (!vehicle.location || !vehicle.locationUpdatedAt || Date.now() - new Date(vehicle.locationUpdatedAt).getTime() > 5 * 60_000)) {
      throw Object.assign(new Error('A fresh vehicle GPS location is required before making it available.'), { statusCode: 409 });
    }
    const updated = await RescueVehicleModel.findOneAndUpdate({ _id: vehicleId, providerId, activeIncidentId: { $exists: false } }, { $set: { status } }, { new: true }).exec();
    await audit({ actorType: 'STAFF', actorId, action: 'RESCUE_VEHICLE_STATUS_CHANGED', metadata: { providerId, vehicleId, status } });
    publishMedxRescueEvent({ type: 'vehicle.location', providerId, vehicleId });
    return updated;
  }

  async addVehicle(providerId: string, input: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(providerId)) throw Object.assign(new Error('Invalid provider ID.'), { statusCode: 400 });
    const provider = await RescueProviderModel.findOne({ _id: providerId, verificationStatus: ProviderVerificationStatus.VERIFIED }).exec();
    if (!provider) throw Object.assign(new Error('Only verified providers can register operational vehicles.'), { statusCode: 403 });
    if (!Object.values(RescueVehicleClass).includes(input.vehicleClass as RescueVehicleClass)) throw Object.assign(new Error('Valid vehicle class is required.'), { statusCode: 400 });
    return RescueVehicleModel.create({ providerId: provider._id, registrationNumber: requireText(input.registrationNumber, 'Registration number', 40), makeModel: requireText(input.makeModel, 'Vehicle make/model', 120), vehicleClass: input.vehicleClass, equipment: Array.isArray(input.equipment) ? input.equipment.map(String).slice(0, 100) : [], crewQualifications: Array.isArray(input.crewQualifications) ? input.crewQualifications.map(String).slice(0, 100) : [], status: ProviderOperationalStatus.OFFLINE });
  }

  async updateVehicleLocation(vehicleId: string, providerId: string, input: Record<string, unknown>) {
    if (!Types.ObjectId.isValid(vehicleId) || !Types.ObjectId.isValid(providerId)) throw Object.assign(new Error('Invalid vehicle or provider ID.'), { statusCode: 400 });
    const provider = await RescueProviderModel.findOne({ _id: providerId, verificationStatus: ProviderVerificationStatus.VERIFIED, operationalStatus: { $in: [ProviderOperationalStatus.AVAILABLE, ProviderOperationalStatus.BUSY] } }).select('_id').lean().exec();
    if (!provider) throw Object.assign(new Error('Only a verified, operational provider can submit vehicle GPS.'), { statusCode: 403 });
    const location = geoPoint(input.latitude, input.longitude);
    let accuracy: number | undefined;
    if (input.accuracyMeters !== undefined) {
      accuracy = Number(input.accuracyMeters);
      if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000) throw Object.assign(new Error('GPS accuracy must be between 0 and 100000 metres.'), { statusCode: 400 });
    }
    const updated = await RescueVehicleModel.findOneAndUpdate({ _id: vehicleId, providerId, status: { $in: [ProviderOperationalStatus.AVAILABLE, 'DISPATCHED'] } }, { $set: { location, locationUpdatedAt: new Date(), ...(accuracy === undefined ? {} : { locationAccuracyMeters: accuracy }) } }, { new: true }).exec();
    if (!updated) throw Object.assign(new Error('Vehicle is not found, not assigned to this provider, or not in an active operational state.'), { statusCode: 404 });
    publishMedxRescueEvent({ type: 'vehicle.location', providerId: String(providerId), vehicleId: String(updated._id) });
    return updated;
  }

  async createDispatchOffer(incidentId: string, vehicleIdsInput: string | string[], dispatcherId: string, expiresInSeconds = 90) {
    const vehicleIds = [...new Set((Array.isArray(vehicleIdsInput) ? vehicleIdsInput : [vehicleIdsInput]).map(String))];
    if (!Types.ObjectId.isValid(incidentId) || !Types.ObjectId.isValid(dispatcherId) || vehicleIds.length < 1 || vehicleIds.length > 20 || vehicleIds.some((id) => !Types.ObjectId.isValid(id))) {
      throw Object.assign(new Error('Valid incident, dispatcher, and between one and twenty vehicle IDs are required.'), { statusCode: 400 });
    }
    const session = await mongoose.startSession();
    const createdOffers: any[] = [];
    let incidentReference = '';
    try {
      await session.withTransaction(async () => {
        createdOffers.length = 0;
        const incident = await RescueIncidentModel.findById(incidentId).session(session).exec();
        if (!incident) throw Object.assign(new Error('Incident not found.'), { statusCode: 404 });
        if (![IncidentStatus.REQUEST_RECEIVED, IncidentStatus.DISPATCH_REVIEW, IncidentStatus.NO_RESOURCE_AVAILABLE, IncidentStatus.OFFERED_TO_CREW].includes(incident.status) || incident.acceptedOfferId) {
          throw Object.assign(new Error('This incident is not available for new dispatch offers.'), { statusCode: 409 });
        }

        await RescueDispatchOfferModel.updateMany(
          { incidentId, status: DispatchOfferStatus.PENDING, expiresAt: { $lte: new Date() } },
          { $set: { status: DispatchOfferStatus.EXPIRED, respondedAt: new Date(), responseNote: 'Offer expired before this dispatch wave.' } },
          { session },
        ).exec();

        for (const vehicleId of vehicleIds) {
          const vehicle = await RescueVehicleModel.findById(vehicleId).session(session).exec();
          if (!vehicle) throw Object.assign(new Error(`Vehicle ${vehicleId} was not found.`), { statusCode: 404 });
          const provider = await RescueProviderModel.findOne({
            _id: vehicle.providerId,
            verificationStatus: ProviderVerificationStatus.VERIFIED,
            operationalStatus: ProviderOperationalStatus.AVAILABLE,
          }).session(session).exec();
          if (!provider || vehicle.status !== ProviderOperationalStatus.AVAILABLE || vehicle.activeIncidentId) {
            throw Object.assign(new Error(`Vehicle ${vehicle.registrationNumber} or its provider is not verified and available.`), { statusCode: 409 });
          }
          if (!vehicle.location || !vehicle.locationUpdatedAt || Date.now() - new Date(vehicle.locationUpdatedAt).getTime() > 5 * 60_000) {
            throw Object.assign(new Error(`Vehicle ${vehicle.registrationNumber} has missing or stale GPS. Update its location within the last five minutes before dispatch.`), { statusCode: 409 });
          }
          const duplicateVehicleOffer = await RescueDispatchOfferModel.findOne({ incidentId, vehicleId, status: DispatchOfferStatus.PENDING, expiresAt: { $gt: new Date() } }).session(session).exec();
          if (duplicateVehicleOffer) throw Object.assign(new Error(`Vehicle ${vehicle.registrationNumber} already has an active offer for this incident.`), { statusCode: 409 });
          const created = await RescueDispatchOfferModel.create([{
            incidentId: incident._id, providerId: provider._id, vehicleId: vehicle._id,
            offeredBy: new Types.ObjectId(dispatcherId), status: DispatchOfferStatus.PENDING,
            expiresAt: new Date(Date.now() + Math.min(300, Math.max(30, expiresInSeconds)) * 1000),
          }], { session });
          createdOffers.push(created[0]);
        }

        const changed = await RescueIncidentModel.findOneAndUpdate(
          { _id: incidentId, status: incident.status, acceptedOfferId: { $exists: false } },
          { $set: { status: IncidentStatus.OFFERED_TO_CREW }, $push: { events: {
            status: IncidentStatus.OFFERED_TO_CREW, at: new Date(), actorType: 'STAFF',
            actorId: new Types.ObjectId(dispatcherId), note: `Dispatcher-approved parallel offer wave sent to ${vehicleIds.length} eligible vehicle(s); acceptance and dispatcher confirmation are still pending.`,
          } } },
          { new: true, session },
        ).exec();
        if (!changed) throw Object.assign(new Error('Incident changed concurrently. Refresh and try again.'), { statusCode: 409 });
        incidentReference = incident.publicReference;
      });
    } finally { await session.endSession(); }

    for (const offer of createdOffers) {
      await audit({ incidentId: new Types.ObjectId(incidentId), actorType: 'STAFF', actorId: dispatcherId, action: 'DISPATCH_OFFER_CREATED', metadata: { offerId: String(offer._id), vehicleId: String(offer.vehicleId), parallelWaveSize: createdOffers.length } });
      publishMedxRescueEvent({ type: 'dispatch.offer.created', incidentId, incidentReference, status: IncidentStatus.OFFERED_TO_CREW, offerId: String(offer._id), providerId: String(offer.providerId), vehicleId: String(offer.vehicleId) });
    }
    return Array.isArray(vehicleIdsInput) ? createdOffers : createdOffers[0];
  }

  async respondToOffer(offerId: string, providerId: string, vehicleId: string, accept: boolean, actorId: string, note?: string) {
    const session = await mongoose.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => {
        const offer = await RescueDispatchOfferModel.findOne({ _id: offerId, providerId, vehicleId, status: DispatchOfferStatus.PENDING, expiresAt: { $gt: new Date() } }).session(session).exec();
        if (!offer) throw Object.assign(new Error('Offer is unavailable, expired, or does not belong to this provider/vehicle.'), { statusCode: 409 });
        if (!accept) {
          offer.status = DispatchOfferStatus.DECLINED; offer.respondedAt = new Date(); offer.responseNote = note?.slice(0, 500); await offer.save({ session });
          const remaining = await RescueDispatchOfferModel.countDocuments({ incidentId: offer.incidentId, status: DispatchOfferStatus.PENDING, expiresAt: { $gt: new Date() } }).session(session).exec();
          let resultingStatus = IncidentStatus.OFFERED_TO_CREW;
          if (remaining === 0) {
            resultingStatus = IncidentStatus.DISPATCH_REVIEW;
            await RescueIncidentModel.updateOne({ _id: offer.incidentId, status: IncidentStatus.OFFERED_TO_CREW }, { $set: { status: IncidentStatus.DISPATCH_REVIEW }, $push: { events: { status: IncidentStatus.DISPATCH_REVIEW, at: new Date(), actorType: 'CREW', actorId: new Types.ObjectId(actorId), note: 'Crew declined and no other live offers remain; dispatcher review required.' } } }, { session }).exec();
          }
          result = { offer, incidentId: offer.incidentId, status: resultingStatus }; return;
        }
        const provider = await RescueProviderModel.findOne({ _id: providerId, verificationStatus: ProviderVerificationStatus.VERIFIED, operationalStatus: ProviderOperationalStatus.AVAILABLE }).session(session).exec();
        if (!provider) throw Object.assign(new Error('Provider is no longer verified and available.'), { statusCode: 409 });
        const incident = await RescueIncidentModel.findOne({ _id: offer.incidentId, status: IncidentStatus.OFFERED_TO_CREW, acceptedOfferId: { $exists: false } }).session(session).exec();
        if (!incident) throw Object.assign(new Error('Incident was already assigned or is no longer available.'), { statusCode: 409 });
        const vehicle = await RescueVehicleModel.findOneAndUpdate({ _id: vehicleId, providerId, status: ProviderOperationalStatus.AVAILABLE, activeIncidentId: { $exists: false }, locationUpdatedAt: { $gte: new Date(Date.now() - 5 * 60_000) } }, { $set: { status: 'DISPATCHED', activeIncidentId: incident._id } }, { new: true, session }).exec();
        if (!vehicle) throw Object.assign(new Error('Vehicle was taken or is no longer available.'), { statusCode: 409 });
        offer.status = DispatchOfferStatus.ACCEPTED; offer.respondedAt = new Date(); offer.responseNote = note?.slice(0, 500); await offer.save({ session });
        await RescueDispatchOfferModel.updateMany({ incidentId: incident._id, _id: { $ne: offer._id }, status: DispatchOfferStatus.PENDING }, { $set: { status: DispatchOfferStatus.WITHDRAWN, respondedAt: new Date(), responseNote: 'Another crew accepted first; dispatcher confirmation is pending.' } }, { session }).exec();
        incident.status = IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION; incident.providerId = new Types.ObjectId(providerId); incident.vehicleId = new Types.ObjectId(vehicleId); incident.acceptedOfferId = offer._id;
        incident.events.push({ status: IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION, at: new Date(), actorType: 'CREW', actorId: new Types.ObjectId(actorId), note: 'Crew accepted; awaiting dispatcher validation and confirmation.' } as any);
        await incident.save({ session }); result = { offer, incident: this.publicIncident(incident) };
      });
      await audit({ actorType: 'CREW', actorId, action: accept ? 'DISPATCH_OFFER_ACCEPTED' : 'DISPATCH_OFFER_DECLINED', metadata: { offerId, providerId, vehicleId } });
      publishMedxRescueEvent({ type: 'dispatch.offer.responded', incidentId: result?.incident?.id ? String(result.incident.id) : (result?.incidentId ? String(result.incidentId) : undefined), status: accept ? IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION : (result?.status || IncidentStatus.DISPATCH_REVIEW), offerId, providerId, vehicleId });
      return result;
    } finally { await session.endSession(); }
  }

  async confirmAcceptedAssignment(incidentId: string, dispatcherId: string, approve: boolean, reason?: string) {
    if (!Types.ObjectId.isValid(incidentId) || !Types.ObjectId.isValid(dispatcherId)) throw Object.assign(new Error('Valid incident and dispatcher IDs are required.'), { statusCode: 400 });
    const session = await mongoose.startSession();
    let updated: any;
    let incidentReference = '';
    let acceptedOfferId = '';
    try {
      await session.withTransaction(async () => {
        const incident = await RescueIncidentModel.findOne({ _id: incidentId, status: IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION, acceptedOfferId: { $exists: true }, providerId: { $exists: true }, vehicleId: { $exists: true } }).session(session).exec();
        if (!incident) throw Object.assign(new Error('No crew acceptance is awaiting dispatcher confirmation for this incident.'), { statusCode: 409 });
        const offer = await RescueDispatchOfferModel.findOne({ _id: incident.acceptedOfferId, incidentId, status: DispatchOfferStatus.ACCEPTED }).session(session).exec();
        if (!offer) throw Object.assign(new Error('Accepted dispatch offer could not be verified.'), { statusCode: 409 });
        acceptedOfferId = String(offer._id); incidentReference = incident.publicReference;
        if (approve) {
          incident.status = IncidentStatus.CREW_CONFIRMED;
          incident.events.push({ status: IncidentStatus.CREW_CONFIRMED, at: new Date(), actorType: 'STAFF', actorId: new Types.ObjectId(dispatcherId), note: `Dispatcher confirmed accepted crew and vehicle${reason ? `: ${reason.slice(0, 350)}` : '.'}` } as any);
          updated = await incident.save({ session });
          await RescueDispatchOfferModel.updateMany({ incidentId, status: DispatchOfferStatus.PENDING }, { $set: { status: DispatchOfferStatus.WITHDRAWN, respondedAt: new Date(), responseNote: 'Another crew was confirmed by the dispatcher.' } }, { session }).exec();
        } else {
          await RescueVehicleModel.updateOne({ _id: incident.vehicleId, activeIncidentId: incident._id }, { $set: { status: ProviderOperationalStatus.AVAILABLE }, $unset: { activeIncidentId: 1 } }, { session }).exec();
          offer.status = DispatchOfferStatus.WITHDRAWN; offer.respondedAt = new Date(); offer.responseNote = reason?.slice(0, 500) || 'Dispatcher did not confirm this assignment.'; await offer.save({ session });
          incident.providerId = undefined; incident.vehicleId = undefined; incident.acceptedOfferId = undefined;
          const remaining = await RescueDispatchOfferModel.countDocuments({ incidentId, status: DispatchOfferStatus.PENDING, expiresAt: { $gt: new Date() } }).session(session).exec();
          incident.status = remaining > 0 ? IncidentStatus.OFFERED_TO_CREW : IncidentStatus.DISPATCH_REVIEW;
          incident.events.push({ status: incident.status, at: new Date(), actorType: 'STAFF', actorId: new Types.ObjectId(dispatcherId), note: `Dispatcher did not confirm the accepting crew${reason ? `: ${reason.slice(0, 350)}` : ''}. ${remaining > 0 ? 'Other provider offers remain active.' : 'Dispatcher review is required.'}` } as any);
          updated = await incident.save({ session });
        }
      });
    } finally { await session.endSession(); }
    await audit({ incidentId: new Types.ObjectId(incidentId), actorType: 'STAFF', actorId: dispatcherId, action: approve ? 'DISPATCH_ASSIGNMENT_CONFIRMED' : 'DISPATCH_ASSIGNMENT_REJECTED', reason, metadata: { acceptedOfferId } });
    publishMedxRescueEvent({ type: 'incident.changed', incidentId, incidentReference, status: updated.status, providerId: updated.providerId ? String(updated.providerId) : undefined, vehicleId: updated.vehicleId ? String(updated.vehicleId) : undefined });
    return updated;
  }

  async createFacility(input: Record<string, unknown>, ownerAccountId: string, activeByDefault = false) {
    if (!Types.ObjectId.isValid(ownerAccountId)) throw Object.assign(new Error('A valid hospital account is required.'), { statusCode: 400 });
    const facility = await RescueFacilityModel.create({
      name: requireText(input.name, 'Facility name', 200),
      ownerAccountId: new Types.ObjectId(ownerAccountId),
      facilityType: requireText(input.facilityType, 'Facility type', 80),
      address: requireText(input.address, 'Facility address', 500),
      location: geoPoint(input.latitude, input.longitude),
      capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String).map(v => v.trim()).filter(Boolean).slice(0, 100) : [],
      operatingHours: typeof input.operatingHours === 'string' ? input.operatingHours.trim().slice(0, 200) : undefined,
      emergencyContactPhone: requireText(input.emergencyContactPhone, 'Emergency contact phone', 40),
      active: activeByDefault,
    });
    await audit({ actorType: 'STAFF', actorId: ownerAccountId, action: 'RESCUE_FACILITY_CREATED', metadata: { facilityId: String(facility._id) } });
    publishMedxRescueEvent({ type: 'facility.changed', facilityId: String(facility._id), accountId: String(facility.ownerAccountId) });
    return facility;
  }

  async listFacilities(query: Record<string, unknown> = {}) {
    const filter: Record<string, unknown> = {};
    if (query.activeOnly !== 'false') filter.active = true;
    if (typeof query.capability === 'string' && query.capability.trim()) filter.capabilities = query.capability.trim();
    return RescueFacilityModel.find(filter).select('-ownerAccountId').sort({ name: 1 }).limit(200).lean().exec();
  }

  async setFacilityActive(facilityId: string, active: boolean, actorId: string) {
    if (!Types.ObjectId.isValid(facilityId)) throw Object.assign(new Error('Invalid facility ID.'), { statusCode: 400 });
    const facility = await RescueFacilityModel.findByIdAndUpdate(facilityId, { $set: { active } }, { new: true }).exec();
    if (!facility) throw Object.assign(new Error('Facility not found.'), { statusCode: 404 });
    await audit({ actorType: 'STAFF', actorId, action: 'RESCUE_FACILITY_STATUS_CHANGED', metadata: { facilityId, active } });
    publishMedxRescueEvent({ type: 'facility.changed', facilityId, accountId: String(facility.ownerAccountId) });
    return facility;
  }

  async requestFacilityAcceptance(incidentId: string, facilityId: string, dispatcherId: string) {
    if (!Types.ObjectId.isValid(incidentId) || !Types.ObjectId.isValid(facilityId)) throw Object.assign(new Error('Invalid incident or facility ID.'), { statusCode: 400 });
    const [incident, facility] = await Promise.all([
      RescueIncidentModel.findById(incidentId).exec(),
      RescueFacilityModel.findOne({ _id: facilityId, active: true }).exec(),
    ]);
    if (!incident) throw Object.assign(new Error('Incident not found.'), { statusCode: 404 });
    if (!facility) throw Object.assign(new Error('Facility is not active or was not found.'), { statusCode: 404 });
    if ([IncidentStatus.CANCELLED, IncidentStatus.HANDED_OVER].includes(incident.status)) throw Object.assign(new Error('A closed incident cannot be sent to a facility.'), { statusCode: 409 });
    const acceptance = await RescueFacilityAcceptanceModel.create({
      incidentId: incident._id, facilityId: facility._id, status: FacilityAcceptanceStatus.PENDING,
      requestedBy: new Types.ObjectId(dispatcherId), requestedAt: new Date(),
    });
    incident.destinationFacilityId = facility._id as any;
    await incident.save();
    await audit({ incidentId: incident._id, actorType: 'STAFF', actorId: dispatcherId, action: 'FACILITY_ACCEPTANCE_REQUESTED', metadata: { facilityId, acceptanceId: String(acceptance._id) } });
    publishMedxRescueEvent({ type: 'incident.changed', incidentId: String(incident._id), incidentReference: incident.publicReference, status: incident.status, facilityId, acceptanceId: String(acceptance._id), accountId: String(facility.ownerAccountId) });
    return acceptance;
  }

  async listFacilityAcceptances(facilityId: string, accountId: string, platformAdmin = false) {
    if (!Types.ObjectId.isValid(facilityId) || (!platformAdmin && !Types.ObjectId.isValid(accountId))) throw Object.assign(new Error('Invalid facility or account ID.'), { statusCode: 400 });
    const facility = await RescueFacilityModel.findById(facilityId).exec();
    if (!facility) throw Object.assign(new Error('Facility not found.'), { statusCode: 404 });
    if (!platformAdmin && String(facility.ownerAccountId) !== accountId) throw Object.assign(new Error('Only the registered facility account can view its acceptance requests.'), { statusCode: 403 });
    return RescueFacilityAcceptanceModel.find({ facilityId, status: FacilityAcceptanceStatus.PENDING })
      .populate({ path: 'incidentId', select: 'publicReference status priority chiefComplaint location landmark createdAt destinationFacilityId' })
      .sort({ requestedAt: 1 }).limit(100).lean().exec();
  }

  async respondToFacilityAcceptance(acceptanceId: string, facilityId: string, accountId: string, accept: boolean, actorId: string, note?: string, platformAdmin = false) {
    if (!Types.ObjectId.isValid(acceptanceId) || !Types.ObjectId.isValid(facilityId) || (!platformAdmin && !Types.ObjectId.isValid(accountId))) throw Object.assign(new Error('Invalid acceptance, facility, or account ID.'), { statusCode: 400 });
    const facility = await RescueFacilityModel.findById(facilityId).exec();
    if (!facility) throw Object.assign(new Error('Facility not found.'), { statusCode: 404 });
    if (!platformAdmin && String(facility.ownerAccountId) !== accountId) throw Object.assign(new Error('Only the registered facility account can respond to this acceptance request.'), { statusCode: 403 });
    const acceptance = await RescueFacilityAcceptanceModel.findOneAndUpdate(
      { _id: acceptanceId, facilityId, status: FacilityAcceptanceStatus.PENDING },
      { $set: { status: accept ? FacilityAcceptanceStatus.ACCEPTED : FacilityAcceptanceStatus.DECLINED, respondedBy: new Types.ObjectId(actorId), respondedAt: new Date(), responseNote: note?.slice(0, 1000) } },
      { new: true },
    ).exec();
    if (!acceptance) throw Object.assign(new Error('Acceptance request is no longer pending.'), { statusCode: 409 });
    await audit({ incidentId: acceptance.incidentId, actorType: 'STAFF', actorId, action: accept ? 'FACILITY_ACCEPTED_INCIDENT' : 'FACILITY_DECLINED_INCIDENT', reason: note, metadata: { facilityId, acceptanceId } });
    publishMedxRescueEvent({ type: 'facility.changed', incidentId: String(acceptance.incidentId), facilityId, accountId: String(facility.ownerAccountId) });
    return acceptance;
  }

  async createClinicalHandover(incidentId: string, facilityId: string, actorId: string, input: Record<string, unknown>, accountId: string, platformAdmin = false) {
    if (!Types.ObjectId.isValid(incidentId) || !Types.ObjectId.isValid(facilityId) || !Types.ObjectId.isValid(actorId) || (!platformAdmin && !Types.ObjectId.isValid(accountId))) throw Object.assign(new Error('Invalid incident, facility, or actor ID.'), { statusCode: 400 });
    const facility = await RescueFacilityModel.findById(facilityId).exec();
    if (!facility) throw Object.assign(new Error('Facility not found.'), { statusCode: 404 });
    if (!platformAdmin && String(facility.ownerAccountId) !== accountId) throw Object.assign(new Error('Only the registered receiving facility can record this handover.'), { statusCode: 403 });
    const incident = await RescueIncidentModel.findOne({ _id: incidentId, destinationFacilityId: facilityId }).exec();
    if (!incident) throw Object.assign(new Error('Incident is not assigned to this receiving facility.'), { statusCode: 409 });
    if (![IncidentStatus.ON_SCENE, IncidentStatus.TRANSPORTING].includes(incident.status)) throw Object.assign(new Error('Handover can only be recorded when the crew is on scene or transporting.'), { statusCode: 409 });
    const accepted = await RescueFacilityAcceptanceModel.findOne({ incidentId, facilityId, status: FacilityAcceptanceStatus.ACCEPTED }).sort({ respondedAt: -1 }).exec();
    if (!accepted) throw Object.assign(new Error('The receiving facility must explicitly accept the incident before handover.'), { statusCode: 409 });
    const summary = requireText(input.summary, 'Handover summary', 4000);
    const session = await mongoose.startSession();
    let handover: any;
    try {
      await session.withTransaction(async () => {
        const current = await RescueIncidentModel.findOne({ _id: incidentId, destinationFacilityId: facilityId, status: { $in: [IncidentStatus.ON_SCENE, IncidentStatus.TRANSPORTING] }, handedOverAt: { $exists: false } }).session(session).exec();
        if (!current) throw Object.assign(new Error('Incident is already handed over or its status changed.'), { statusCode: 409 });
        const created = await RescueClinicalHandoverModel.create([{
          incidentId: current._id, facilityId: facility._id, acceptedBy: accepted.respondedBy || new Types.ObjectId(actorId),
          handedOverBy: new Types.ObjectId(actorId), handedOverAt: new Date(), summary,
          clinicalNotes: typeof input.clinicalNotes === 'string' ? input.clinicalNotes.trim().slice(0, 10000) : undefined,
          vitalSigns: input.vitalSigns && typeof input.vitalSigns === 'object' ? input.vitalSigns : undefined,
        }], { session });
        current.status = IncidentStatus.HANDED_OVER;
        current.handedOverAt = new Date();
        current.events.push({ status: IncidentStatus.HANDED_OVER, at: new Date(), actorType: 'STAFF', actorId: new Types.ObjectId(actorId), note: 'Receiving facility acceptance and clinical handover recorded.' } as any);
        await current.save({ session });
        handover = created[0];
      });
    } finally { await session.endSession(); }
    if (incident.vehicleId) {
      // Handover ends this incident's tracking relationship. Keep the vehicle offline until its crew/provider explicitly marks it available again.
      await RescueVehicleModel.updateOne({ _id: incident.vehicleId, activeIncidentId: incident._id }, { $set: { status: ProviderOperationalStatus.OFFLINE }, $unset: { activeIncidentId: 1 } }).exec();
    }
    await audit({ incidentId: new Types.ObjectId(incidentId), actorType: 'STAFF', actorId, action: 'CLINICAL_HANDOVER_RECORDED', metadata: { facilityId, handoverId: String(handover._id) } });
    publishMedxRescueEvent({ type: 'handover.created', incidentId, facilityId, accountId: String(facility.ownerAccountId), status: IncidentStatus.HANDED_OVER });
    return handover;
  }

  async listDispatchEligibleVehicles(incidentId?: string) {
    let incident: any;
    if (incidentId) {
      if (!Types.ObjectId.isValid(incidentId)) throw Object.assign(new Error('Invalid incident ID.'), { statusCode: 400 });
      incident = await RescueIncidentModel.findById(incidentId).select('status acceptedOfferId location landmark locationDescription triageAnswers triageSuggestedUrgency priority').lean().exec();
      if (!incident) throw Object.assign(new Error('Emergency incident not found.'), { statusCode: 404 });
      if (![IncidentStatus.REQUEST_RECEIVED, IncidentStatus.DISPATCH_REVIEW, IncidentStatus.NO_RESOURCE_AVAILABLE, IncidentStatus.OFFERED_TO_CREW].includes(incident.status) || incident.acceptedOfferId) {
        throw Object.assign(new Error('This incident is not accepting new provider offers.'), { statusCode: 409 });
      }
    }
    const providers = await RescueProviderModel.find({ verificationStatus: ProviderVerificationStatus.VERIFIED, operationalStatus: ProviderOperationalStatus.AVAILABLE }).select('_id displayName operatingAreas verificationStatus operationalStatus').lean().exec();
    if (!providers.length) return [];
    const freshAfter = new Date(Date.now() - 5 * 60_000);
    const vehicles = await RescueVehicleModel.find({ providerId: { $in: providers.map((provider: any) => provider._id) }, status: ProviderOperationalStatus.AVAILABLE, activeIncidentId: { $exists: false }, location: { $exists: true }, locationUpdatedAt: { $gte: freshAfter } }).select('providerId registrationNumber makeModel vehicleClass equipment crewQualifications location locationUpdatedAt locationAccuracyMeters status').lean().exec();
    const providerById = new Map(providers.map((provider: any) => [String(provider._id), provider]));
    const incidentCoords = incident?.location?.coordinates;
    const distanceKm = (a: [number, number], b: [number, number]) => {
      const radians = (v: number) => v * Math.PI / 180;
      const [lon1, lat1] = a; const [lon2, lat2] = b;
      const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    };
    return vehicles.map((vehicle: any) => {
      const provider: any = providerById.get(String(vehicle.providerId));
      const km = incidentCoords && vehicle.location?.coordinates?.length === 2 ? distanceKm(incidentCoords as [number, number], vehicle.location.coordinates as [number, number]) : undefined;
      return { ...vehicle, provider: provider ? { id: String(provider._id), displayName: provider.displayName, operatingAreas: provider.operatingAreas } : undefined, distanceKm: km === undefined ? undefined : Math.round(km * 10) / 10, gpsFreshness: 'FRESH', requiresDispatcherSuitabilityReview: true };
    }).sort((a: any, b: any) => {
      if (typeof a.distanceKm === 'number' && typeof b.distanceKm === 'number') return a.distanceKm - b.distanceKm;
      return new Date(b.locationUpdatedAt).getTime() - new Date(a.locationUpdatedAt).getTime();
    });
  }

  async listProviderVehicles(providerId: string) { return RescueVehicleModel.find({ providerId }).sort({ createdAt: -1 }).lean().exec(); }
  async listProviders() { return RescueProviderModel.find({}).sort({ createdAt: -1 }).limit(500).lean().exec(); }
  async listProvidersForReview() { return RescueProviderModel.find({ verificationStatus: { $in: [ProviderVerificationStatus.PENDING, ProviderVerificationStatus.UNDER_REVIEW] } }).sort({ createdAt: 1 }).lean().exec(); }
  async listOffers(providerId: string) { return RescueDispatchOfferModel.find({ providerId, status: DispatchOfferStatus.PENDING, expiresAt: { $gt: new Date() } }).populate('incidentId').populate('vehicleId').sort({ offeredAt: 1 }).lean().exec(); }
  async updateIncidentLocation(reference: string, token: string, input: Record<string, unknown>) {
    const incident = await RescueIncidentModel.findOne({ publicReference: reference, guestTokenExpiresAt: { $gt: new Date() } }).select('+guestTokenHash').exec();
    if (!incident || !safeEqual(incident.guestTokenHash, sha256(token))) throw Object.assign(new Error('Emergency request not found or access link expired.'), { statusCode: 404 });
    if ([IncidentStatus.HANDED_OVER, IncidentStatus.CANCELLED].includes(incident.status)) throw Object.assign(new Error('Location cannot be updated for a closed incident.'), { statusCode: 409 });
    const hasCoordinates = input.latitude !== undefined && input.latitude !== null && input.latitude !== '' && input.longitude !== undefined && input.longitude !== null && input.longitude !== '';
    const landmark = typeof input.landmark === 'string' ? input.landmark.trim().slice(0, 500) : '';
    const locationDescription = typeof input.locationDescription === 'string' ? input.locationDescription.trim().slice(0, 500) : '';
    if (!hasCoordinates && !landmark && !locationDescription) throw Object.assign(new Error('Provide coordinates, a landmark, or a location description.'), { statusCode: 400 });
    if (hasCoordinates) incident.location = geoPoint(input.latitude, input.longitude) as any;
    if (typeof input.landmark === 'string') incident.landmark = landmark;
    if (typeof input.locationDescription === 'string') incident.locationDescription = locationDescription;
    if (input.accuracyMeters !== undefined) {
      const accuracy = Number(input.accuracyMeters);
      if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000) throw Object.assign(new Error('Location accuracy must be between 0 and 100000 metres.'), { statusCode: 400 });
      incident.locationAccuracyMeters = accuracy;
    }
    await incident.save(); await audit({ incidentId: incident._id, actorType: 'GUEST', action: 'GUEST_LOCATION_UPDATED' });
    publishMedxRescueEvent({ type: 'incident.changed', incidentId: String(incident._id), incidentReference: incident.publicReference, status: incident.status, providerId: incident.providerId ? String(incident.providerId) : undefined, vehicleId: incident.vehicleId ? String(incident.vehicleId) : undefined });
    return this.publicIncident(incident);
  }

  async listLiveFleet(query: Record<string, unknown> = {}) {
    const vehicles = await RescueVehicleModel.find({ location: { $exists: true } })
      .populate('providerId', 'displayName legalName operatingAreas verificationStatus operationalStatus')
      .populate('activeIncidentId', 'publicReference status priority chiefComplaint location landmark')
      .sort({ locationUpdatedAt: -1 })
      .limit(300)
      .lean()
      .exec();

    const activeIncidents = await RescueIncidentModel.find({
      status: { $in: [
        IncidentStatus.REQUEST_RECEIVED, IncidentStatus.DISPATCH_REVIEW, IncidentStatus.OFFERED_TO_CREW,
        IncidentStatus.CREW_ACCEPTED_PENDING_CONFIRMATION, IncidentStatus.CREW_CONFIRMED,
        IncidentStatus.EN_ROUTE, IncidentStatus.ON_SCENE, IncidentStatus.TRANSPORTING,
      ] },
      location: { $exists: true },
    }).select('publicReference status priority chiefComplaint location landmark locationDescription callerPhone createdAt vehicleId providerId')
      .populate('vehicleId', 'registrationNumber makeModel vehicleClass location')
      .lean()
      .exec();

    const facilities = await RescueFacilityModel.find({ active: true })
      .select('name facilityType address location capabilities emergencyContactPhone')
      .lean()
      .exec();

    return {
      vehicles: vehicles.map((v: any) => {
        const updatedAt = v.locationUpdatedAt ? new Date(v.locationUpdatedAt) : null;
        const ageMs = updatedAt ? Math.max(0, Date.now() - updatedAt.getTime()) : Infinity;
        return {
          id: String(v._id),
          registrationNumber: v.registrationNumber,
          makeModel: v.makeModel,
          vehicleClass: v.vehicleClass,
          status: v.status,
          location: v.location,
          locationUpdatedAt: v.locationUpdatedAt,
          locationAccuracyMeters: v.locationAccuracyMeters,
          freshness: ageMs <= 30_000 ? 'LIVE' : ageMs <= 180_000 ? 'DELAYED' : 'STALE',
          provider: v.providerId ? { id: String(v.providerId._id), displayName: v.providerId.displayName, legalName: v.providerId.legalName } : undefined,
          activeIncident: v.activeIncidentId ? { id: String(v.activeIncidentId._id), reference: v.activeIncidentId.publicReference, status: v.activeIncidentId.status, priority: v.activeIncidentId.priority, chiefComplaint: v.activeIncidentId.chiefComplaint, location: v.activeIncidentId.location } : undefined,
        };
      }),
      incidents: activeIncidents.map((inc: any) => ({
        id: String(inc._id),
        reference: inc.publicReference,
        status: inc.status,
        priority: inc.priority,
        chiefComplaint: inc.chiefComplaint,
        landmark: inc.landmark || inc.locationDescription,
        location: inc.location,
        createdAt: inc.createdAt,
        vehicle: inc.vehicleId ? { id: String(inc.vehicleId._id), registrationNumber: inc.vehicleId.registrationNumber, makeModel: inc.vehicleId.makeModel, location: inc.vehicleId.location } : undefined,
      })),
      facilities: facilities.map((f: any) => ({
        id: String(f._id),
        name: f.name,
        facilityType: f.facilityType,
        address: f.address,
        location: f.location,
        capabilities: f.capabilities,
        phone: f.emergencyContactPhone,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async seedDemoFleet() {
    let provider = await RescueProviderModel.findOne({ displayName: 'MedXRescue Core Fleet' }).exec();
    if (!provider) {
      provider = await RescueProviderModel.create({
        legalName: 'MedXRescue Emergency Services Ltd',
        displayName: 'MedXRescue Core Fleet',
        registrationNumber: 'RC-998241',
        contactName: 'Nexus Dispatch Command',
        contactPhone: '+2348009990000',
        contactEmail: 'dispatch@medxrescue.ng',
        operatingAreas: ['Lagos Island', 'Ikeja', 'Lekki', 'Surulere', 'Abuja Central', 'Port Harcourt'],
        verificationStatus: ProviderVerificationStatus.VERIFIED,
        operationalStatus: ProviderOperationalStatus.AVAILABLE,
      });
    } else {
      provider.verificationStatus = ProviderVerificationStatus.VERIFIED;
      provider.operationalStatus = ProviderOperationalStatus.AVAILABLE;
      await provider.save();
    }

    const demoVehicles = [
      { reg: 'AMB-001-LX', make: 'Mercedes Sprinter ALS', cls: RescueVehicleClass.ADVANCED_LIFE_SUPPORT, status: ProviderOperationalStatus.AVAILABLE, lat: 6.5244, lng: 3.3792 }, // Ikeja/Lagos
      { reg: 'AMB-002-LX', make: 'Toyota HiAce BLS', cls: RescueVehicleClass.BASIC_LIFE_SUPPORT, status: ProviderOperationalStatus.AVAILABLE, lat: 6.4549, lng: 3.4246 }, // Victoria Island
      { reg: 'AMB-003-LX', make: 'Ford Transit ICU', cls: RescueVehicleClass.ICU_AMBULANCE, status: ProviderOperationalStatus.AVAILABLE, lat: 6.4350, lng: 3.4750 }, // Lekki Phase 1
      { reg: 'AMB-004-ABJ', make: 'Mercedes Sprinter ALS', cls: RescueVehicleClass.ADVANCED_LIFE_SUPPORT, status: ProviderOperationalStatus.AVAILABLE, lat: 9.0765, lng: 7.3986 }, // Abuja Central
      { reg: 'AMB-005-PHC', make: 'Nissan NV350 Transport', cls: RescueVehicleClass.PATIENT_TRANSPORT, status: ProviderOperationalStatus.AVAILABLE, lat: 4.8156, lng: 7.0498 }, // Port Harcourt
      { reg: 'AMB-006-LX', make: 'Peugeot Boxer Neonatal', cls: RescueVehicleClass.NEONATAL, status: ProviderOperationalStatus.AVAILABLE, lat: 6.5000, lng: 3.3500 }, // Yaba/Surulere
    ];

    const results = [];
    for (const v of demoVehicles) {
      const existing = await RescueVehicleModel.findOne({ registrationNumber: v.reg }).exec();
      if (existing) {
        existing.status = v.status;
        existing.location = { type: 'Point', coordinates: [v.lng, v.lat] };
        existing.locationUpdatedAt = new Date();
        existing.locationAccuracyMeters = 5;
        await existing.save();
        results.push(existing);
      } else {
        const created = await RescueVehicleModel.create({
          providerId: provider._id,
          registrationNumber: v.reg,
          makeModel: v.make,
          vehicleClass: v.cls,
          equipment: ['Defibrillator', 'Ventilator', 'ECG Monitor', 'Oxygen Cylinder', 'Trauma Kit'],
          crewQualifications: ['Paramedic', 'Emergency Medical Technician', 'Advanced Trauma Driver'],
          status: v.status,
          location: { type: 'Point', coordinates: [v.lng, v.lat] },
          locationUpdatedAt: new Date(),
          locationAccuracyMeters: 5,
        });
        results.push(created);
      }
    }

    // Seed Sample Patient Emergency Incidents into the Dispatch Console Queue
    const demoIncidents = [
      {
        publicReference: 'MRX-SOS-9921',
        chiefComplaint: 'Acute Chest Pain & Severe Difficulty Breathing',
        landmark: 'Ikeja City Mall, Alausa, Ikeja',
        callerName: 'Obaloluwa Ajayi',
        callerPhone: '+2348012345678',
        priority: IncidentPriority.CRITICAL,
        triageUrgency: 'IMMEDIATE',
        triageSuggestedUrgency: 'IMMEDIATE',
        intakeChannel: 'APP_SOS',
        location: { type: 'Point', coordinates: [3.3515, 6.6018] },
        status: IncidentStatus.DISPATCH_REVIEW,
      },
      {
        publicReference: 'MRX-SOS-3312',
        chiefComplaint: 'Road Traffic Collision & Uncontrolled Bleeding',
        landmark: 'Ahmadu Bello Way, Victoria Island',
        callerName: 'Emmanuel Obaloluwa',
        callerPhone: '+2348023456789',
        priority: IncidentPriority.CRITICAL,
        triageUrgency: 'IMMEDIATE',
        triageSuggestedUrgency: 'IMMEDIATE',
        intakeChannel: 'APP_SOS',
        location: { type: 'Point', coordinates: [3.4246, 6.4549] },
        status: IncidentStatus.REQUEST_RECEIVED,
      },
      {
        publicReference: 'MRX-SOS-4418',
        chiefComplaint: 'High Fever, Convulsions & Respiratory Distress',
        landmark: 'Lekki Phase 1 Gate, Lekki',
        callerName: 'Grace Adenike',
        callerPhone: '+2348034567890',
        priority: IncidentPriority.URGENT,
        triageUrgency: 'URGENT',
        triageSuggestedUrgency: 'URGENT',
        intakeChannel: 'APP_SOS',
        location: { type: 'Point', coordinates: [3.4750, 6.4350] },
        status: IncidentStatus.DISPATCH_REVIEW,
      },
    ];

    for (const inc of demoIncidents) {
      const existing = await RescueIncidentModel.findOne({ publicReference: inc.publicReference }).exec();
      if (!existing) {
        await RescueIncidentModel.create({
          ...inc,
          callerIsPatient: true,
          guestTokenHash: sha256('demo-token-' + inc.publicReference),
          guestTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          idempotencyKey: 'demo-idempotency-' + inc.publicReference,
          idempotencyFingerprint: sha256('demo-fingerprint-' + inc.publicReference),
          events: [{ status: inc.status, at: new Date(), actorType: 'GUEST', note: 'Emergency request received via Patient SOS App.' }],
        });
      }
    }

    publishMedxRescueEvent({ type: 'vehicle.location', providerId: String(provider._id) });
    return { provider, vehicles: results, seededIncidentsCount: demoIncidents.length };
  }
}
export const medxRescueService = new MedxRescueService();


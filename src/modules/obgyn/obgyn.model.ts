import { Schema, model } from 'mongoose';
import type { IObgynRecord } from './obgyn.types.js';

const AncVisitSchema = new Schema(
  {
    visitDate: { type: Date, default: Date.now, required: true },
    gestationalAgeWeeks: { type: Number, min: 0, max: 45 },
    gestationalAgeDays: { type: Number, min: 0, max: 6 },
    bloodPressure: { type: String, trim: true },
    weightKg: { type: Number, min: 0 },
    fundalHeightCm: { type: Number, min: 0 },
    fetalHeartRateBpm: { type: Number, min: 0 },
    fetalMovement: {
      type: String,
      enum: ['NORMAL', 'REDUCED', 'NOT_APPLICABLE', 'UNKNOWN'],
    },
    urineProtein: { type: String, trim: true },
    urineGlucose: { type: String, trim: true },
    hemoglobinGdl: { type: Number, min: 0 },
    dangerSigns: { type: [String], default: [] },
    assessment: { type: String, trim: true },
    plan: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: true },
);

const PncVisitSchema = new Schema(
  {
    visitDate: { type: Date, default: Date.now, required: true },
    postpartumDay: { type: Number, min: 0 },
    maternalCondition: { type: String, trim: true },
    newbornCondition: { type: String, trim: true },
    bloodPressure: { type: String, trim: true },
    temperatureCelsius: { type: Number },
    bleedingStatus: { type: String, trim: true },
    feedingStatus: { type: String, trim: true },
    dangerSigns: { type: [String], default: [] },
    notes: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: true },
);

const DeliverySchema = new Schema(
  {
    deliveryDate: { type: Date, default: Date.now, required: true },
    mode: {
      type: String,
      enum: [
        'SPONTANEOUS_VAGINAL',
        'ASSISTED_VAGINAL',
        'CESAREAN_SECTION',
        'OTHER',
      ],
      required: true,
    },
    outcome: {
      type: String,
      enum: ['LIVE_BIRTH', 'STILLBIRTH', 'NEONATAL_DEATH', 'OTHER'],
      required: true,
    },
    birthWeightKg: { type: Number, min: 0 },
    apgar1Minute: { type: Number, min: 0, max: 10 },
    apgar5Minutes: { type: Number, min: 0, max: 10 },
    newbornSex: {
      type: String,
      enum: ['MALE', 'FEMALE', 'INTERSEX', 'UNKNOWN'],
    },
    postpartumHemorrhage: { type: Boolean, default: false },
    complications: { type: [String], default: [] },
    newbornPatientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
    },
    notes: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: false },
);

const GynecologyVisitSchema = new Schema(
  {
    visitDate: { type: Date, default: Date.now, required: true },
    reason: { type: String, required: true, trim: true },
    history: { type: String, trim: true },
    examination: { type: String, trim: true },
    assessment: { type: String, trim: true },
    plan: { type: String, trim: true },
    screeningType: { type: String, trim: true },
    screeningResult: { type: String, trim: true },
    stiScreening: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: true },
);

const FamilyPlanningSchema = new Schema(
  {
    dateProvided: { type: Date, default: Date.now, required: true },
    counselling: { type: String, trim: true },
    method: { type: String, trim: true },
    action: {
      type: String,
      enum: [
        'STARTED',
        'CONTINUED',
        'SWITCHED',
        'DISCONTINUED',
        'COUNSELLED',
      ],
      required: true,
    },
    discontinuationReason: { type: String, trim: true },
    followUpDate: Date,
    notes: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: true },
);

const ReferralSchema = new Schema(
  {
    createdAt: { type: Date, default: Date.now, required: true },
    destinationFacility: { type: String, required: true, trim: true },
    urgency: {
      type: String,
      enum: ['ROUTINE', 'URGENT', 'EMERGENCY'],
      default: 'ROUTINE',
    },
    reason: { type: String, required: true, trim: true },
    clinicalSummary: { type: String, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'ACCEPTED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
    },
    outcome: { type: String, trim: true },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { _id: true },
);

const AuditTrailSchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    occurredAt: { type: Date, default: Date.now, required: true },
    details: { type: String, trim: true },
  },
  { _id: true },
);

const ObgynRecordSchema = new Schema<IObgynRecord>(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    recordType: {
      type: String,
      enum: ['PREGNANCY', 'GYNECOLOGY'],
      required: true,
      index: true,
    },
    gravida: { type: Number, min: 0 },
    para: { type: Number, min: 0 },
    abortions: { type: Number, min: 0 },
    livingChildren: { type: Number, min: 0 },
    lastMenstrualPeriod: Date,
    ultrasoundDatingDate: Date,
    ultrasoundGestationalAgeWeeks: { type: Number, min: 0, max: 45 },
    estimatedDeliveryDate: Date,
    pregnancyStatus: {
      type: String,
      enum: ['ACTIVE', 'DELIVERED', 'TERMINATED', 'COMPLETED'],
      default: function (this: IObgynRecord) {
        return this.recordType === 'PREGNANCY' ? 'ACTIVE' : undefined;
      },
      index: true,
    },
    riskFlags: { type: [String], default: [] },
    dangerSigns: { type: [String], default: [] },
    consentToShare: { type: Boolean, default: false },
    consentUpdatedAt: Date,

    delivery: {
      type: DeliverySchema,
      default: undefined,
    },
    ancVisits: {
      type: [AncVisitSchema],
      default: [],
    },

    pncVisits: {
      type: [PncVisitSchema],
      default: [],
    },

    gynecologyVisits: {
      type: [GynecologyVisitSchema],
      default: [],
    },

    familyPlanningRecords: {
      type: [FamilyPlanningSchema],
      default: [],
    },

    referrals: {
      type: [ReferralSchema],
      default: [],
    },

    auditTrail: {
      type: [AuditTrailSchema],
      default: [],
    },

    menstrualHistory: {
      cycleLengthDays: Number,
      periodDurationDays: Number,
      lastPeriodDate: Date,
      symptoms: { type: [String], default: [] },
      abnormalBleeding: { type: Boolean, default: false },
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  } as any,
  {
    timestamps: true,
    minimize: false,
  },
);

ObgynRecordSchema.index({
  hospitalId: 1,
  patientId: 1,
  isActive: 1,
});

ObgynRecordSchema.index({
  hospitalId: 1,
  recordType: 1,
  pregnancyStatus: 1,
  createdAt: -1,
});

export const ObgynRecordModel = model<IObgynRecord>(
  'ObgynRecord',
  ObgynRecordSchema,
);
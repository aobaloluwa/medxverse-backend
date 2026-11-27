import { Schema, model } from 'mongoose';
import {
  IMchRecordDocument,
  MchCareType,
  PregnancyStatus,
  DeliveryType,
  DeliveryOutcome,
  FamilyPlanningMethod,
} from './mch.types.js';

const AncVisitSchema = new Schema(
  {
    visitDate: { type: Date, default: Date.now, required: true },
    gestationalAgeWeeks: { type: Number, required: true },
    weightKg: { type: Number },
    bloodPressure: { type: String, trim: true },
    fundalHeightCm: { type: Number },
    fetalHeartRateBpm: { type: Number },
    fetalPosition: { type: String, trim: true },
    urineProtein: { type: String, trim: true },
    urineSugar: { type: String, trim: true },
    hemoglobinGdl: { type: Number },
    notes: { type: String, trim: true },
    attendingStaffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const PncVisitSchema = new Schema(
  {
    visitDate: { type: Date, default: Date.now, required: true },
    daysPostpartum: { type: Number, required: true },
    motherCondition: { type: String, trim: true },
    infantCondition: { type: String, trim: true },
    bloodPressure: { type: String, trim: true },
    temperatureCelsius: { type: Number },
    lochiaDescription: { type: String, trim: true },
    breastfeedingStatus: { type: String, trim: true },
    notes: { type: String, trim: true },
    attendingStaffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const ImmunizationSchema = new Schema(
  {
    vaccineName: { type: String, required: true, trim: true },
    doseNumber: { type: Number, required: true, min: 1 },
    administeredAt: { type: Date, default: Date.now, required: true },
    administeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batchNumber: { type: String, trim: true },
    nextDueDate: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: true }
);

const DeliveryRecordSchema = new Schema(
  {
    deliveryDate: { type: Date, default: Date.now, required: true },
    deliveryType: {
      type: String,
      enum: Object.values(DeliveryType),
      required: true,
    },
    outcome: {
      type: String,
      enum: Object.values(DeliveryOutcome),
      required: true,
    },
    birthWeightKg: { type: Number },
    apgarScore1Min: { type: Number, min: 0, max: 10 },
    apgarScore5Min: { type: Number, min: 0, max: 10 },
    infantGender: { type: String, enum: ['MALE', 'FEMALE', 'AMBIGUOUS'] },
    complications: { type: String, trim: true },
    deliveredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const FamilyPlanningSchema = new Schema(
  {
    method: { type: String, enum: Object.values(FamilyPlanningMethod), required: true },
    initiatedAt: { type: Date, default: Date.now, required: true },
    nextDueDate: { type: Date },
    sideEffects: { type: String, trim: true },
    status: { type: String, enum: ['ACTIVE', 'DISCONTINUED', 'COMPLETED'], default: 'ACTIVE' },
    notes: { type: String, trim: true },
    administeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const PartographLogSchema = new Schema(
  {
    recordedAt: { type: Date, default: Date.now, required: true },
    cervicalDilationCm: { type: Number, required: true },
    contractionFrequency: { type: String, required: true, trim: true },
    fetalHeartRateBpm: { type: Number, required: true },
    amnioticFluid: { type: String, trim: true },
    maternalBp: { type: String, trim: true },
    notes: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const ChildGrowthSchema = new Schema(
  {
    recordedAt: { type: Date, default: Date.now, required: true },
    weightKg: { type: Number, required: true },
    heightCm: { type: Number },
    headCircumferenceCm: { type: Number },
    muacCm: { type: Number },
    milestonesNotes: { type: String, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true }
);

const MchRecordSchema = new Schema<IMchRecordDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    careType: {
      type: String,
      enum: Object.values(MchCareType),
      required: true,
      index: true,
    },
    gravida: { type: Number, min: 0 },
    para: { type: Number, min: 0 },
    estimatedDeliveryDate: { type: Date },
    lastMenstrualPeriod: { type: Date },
    pregnancyStatus: {
      type: String,
      enum: Object.values(PregnancyStatus),
      default: PregnancyStatus.ACTIVE,
      index: true,
    },
    ancVisits: [AncVisitSchema],
    pncVisits: [PncVisitSchema],
    immunizations: [ImmunizationSchema],
    familyPlanningRecords: [FamilyPlanningSchema],
    partographLogs: [PartographLogSchema],
    growthLogs: [ChildGrowthSchema],
    deliveryRecord: { type: DeliveryRecordSchema },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

MchRecordSchema.index({ hospitalId: 1, patientId: 1, isActive: 1 });

export const MchRecordModel = model<IMchRecordDocument>('MchRecord', MchRecordSchema);

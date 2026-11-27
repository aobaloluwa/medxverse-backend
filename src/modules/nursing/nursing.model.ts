import { Schema, model } from 'mongoose';
import {
  IMarLogDocument,
  INursingNoteDocument,
  IFluidBalanceLogDocument,
  MarStatus,
  ShiftType,
} from './nursing.types.js';

const MarLogSchema = new Schema<IMarLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    medicationName: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    route: { type: String, default: 'Oral', trim: true },
    scheduledTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(MarStatus),
      default: MarStatus.SCHEDULED,
      required: true,
      index: true,
    },
    administeredAt: { type: Date },
    administeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reasonHeldOrRefused: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

MarLogSchema.index({ hospitalId: 1, patientId: 1, scheduledTime: -1 });

const SbarSchema = new Schema(
  {
    situation: { type: String, required: true, trim: true },
    background: { type: String, required: true, trim: true },
    assessment: { type: String, required: true, trim: true },
    recommendation: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const NursingNoteSchema = new Schema<INursingNoteDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    nurseId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    noteType: {
      type: String,
      enum: ['PROGRESS_NOTE', 'SHIFT_HANDOVER', 'VITAL_CHECK', 'CARE_PLAN'],
      default: 'PROGRESS_NOTE',
      required: true,
      index: true,
    },
    shiftType: { type: String, enum: Object.values(ShiftType) },
    sbar: { type: SbarSchema },
    content: { type: String, trim: true },
    fallRiskScore: { type: Number, default: 0 },
    isHighRisk: { type: Boolean, default: false },
    isolationPrecautions: { type: Boolean, default: false },
    isNpo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NursingNoteSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });

const FluidBalanceLogSchema = new Schema<IFluidBalanceLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    oralIntakeMl: { type: Number, default: 0 },
    ivIntakeMl: { type: Number, default: 0 },
    tubeFeedMl: { type: Number, default: 0 },
    urineOutputMl: { type: Number, default: 0 },
    drainOutputMl: { type: Number, default: 0 },
    vomitOutputMl: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now, required: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

FluidBalanceLogSchema.index({ hospitalId: 1, patientId: 1, recordedAt: -1 });

export const MarLogModel = model<IMarLogDocument>('MarLog', MarLogSchema);
export const NursingNoteModel = model<INursingNoteDocument>('NursingNote', NursingNoteSchema);
export const FluidBalanceLogModel = model<IFluidBalanceLogDocument>('FluidBalanceLog', FluidBalanceLogSchema);

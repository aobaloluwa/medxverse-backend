import { Schema, model } from 'mongoose';
import {
  IReferralDocument,
  ReferralType,
  ReferralUrgency,
  ReferralStatus,
} from './referrals.types.js';

const ReferralSchema = new Schema<IReferralDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(ReferralType),
      required: true,
      index: true,
    },
    referringFacility: { type: String, required: true, trim: true },
    receivingFacility: { type: String, required: true, trim: true },
    referringDoctorName: { type: String, trim: true },
    receivingDoctorName: { type: String, trim: true },
    specialtyRequired: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    urgency: {
      type: String,
      enum: Object.values(ReferralUrgency),
      default: ReferralUrgency.ROUTINE,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ReferralStatus),
      default: ReferralStatus.PENDING,
      required: true,
      index: true,
    },
    notes: { type: String, trim: true },
    transportRequired: { type: Boolean, default: false },
    referredAt: { type: Date, default: Date.now, required: true },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ReferralSchema.index({ hospitalId: 1, type: 1, status: 1 });

export const ReferralModel = model<IReferralDocument>('Referral', ReferralSchema);

import { Schema, model } from 'mongoose';
import { IVisitorPassDocument, VisitorPassStatus } from './visitor.types.js';

const VisitorPassSchema = new Schema<IVisitorPassDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    visitorName: { type: String, required: true, trim: true },
    visitorPhone: { type: String, required: true, trim: true },
    visitorIdNumber: { type: String, trim: true },
    relationship: { type: String, required: true, trim: true },
    wardId: { type: String, required: true, trim: true },
    bedNumber: { type: String, required: true, trim: true },
    passCode: { type: String, required: true, unique: true, index: true },
    validFrom: { type: Date, default: Date.now, required: true },
    validUntil: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(VisitorPassStatus),
      default: VisitorPassStatus.ACTIVE,
      required: true,
      index: true,
    },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

VisitorPassSchema.index({ hospitalId: 1, patientId: 1, status: 1 });

export const VisitorPassModel = model<IVisitorPassDocument>('VisitorPass', VisitorPassSchema);

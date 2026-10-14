import mongoose, { Schema, Model, Types, Document } from 'mongoose';

export interface IPatientPortalAccount extends Document {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  email: string;
  password: string;
  active: boolean;
  lastLoginAt?: Date;
  preferences?: {
    appointmentUpdates: boolean;
    careTeamMessages: boolean;
    billingUpdates: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PatientPortalAccountSchema = new Schema<IPatientPortalAccount>({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  active: { type: Boolean, default: true, index: true },
  lastLoginAt: Date,
  preferences: {
    appointmentUpdates: { type: Boolean, default: true },
    careTeamMessages: { type: Boolean, default: true },
    billingUpdates: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
  },
}, { timestamps: true });

PatientPortalAccountSchema.index({ hospitalId: 1, email: 1 }, { unique: true });
PatientPortalAccountSchema.index({ hospitalId: 1, patientId: 1 }, { unique: true });

export const PatientPortalAccountModel: Model<IPatientPortalAccount> =
  (mongoose.models.PatientPortalAccount as Model<IPatientPortalAccount>) ||
  mongoose.model<IPatientPortalAccount>('PatientPortalAccount', PatientPortalAccountSchema);


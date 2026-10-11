import mongoose, { Schema, model } from 'mongoose';
import {
  ITelemedicineSessionDocument,
  ITelemedicineMessageDocument,
  ConsultationType,
  ConsultationStatus,
  TelemedicineMessageType,
} from './telemedicine.types.js';

const TelemedicineSessionSchema = new Schema<ITelemedicineSessionDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    consultationType: {
      type: String,
      enum: Object.values(ConsultationType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ConsultationStatus),
      default: ConsultationStatus.WAITING_ROOM,
      index: true,
    },
    scheduledStartTime: { type: Date, required: true, index: true },
    joinedWaitingRoomAt: { type: Date },
    actualStartTime: { type: Date },
    endTime: { type: Date },
    durationMinutes: { type: Number },
    meetingRoomId: { type: String, required: true, unique: true },
    meetingUrl: { type: String },
    chiefComplaint: { type: String, trim: true },
    clinicalNotes: { type: String, trim: true },
    recordingUrl: { type: String },
    followUpOfSessionId: { type: Schema.Types.ObjectId, ref: 'TelemedicineSession', index: true },
  },
  { timestamps: true }
);

TelemedicineSessionSchema.index({ hospitalId: 1, scheduledStartTime: 1, status: 1 });

export const TelemedicineSessionModel = model<ITelemedicineSessionDocument>(
  'TelemedicineSession',
  TelemedicineSessionSchema
);

const TelemedicineMessageSchema = new Schema<ITelemedicineMessageDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'TelemedicineSession',
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderModel: { type: String, enum: ['User', 'Patient'], required: true },
    messageText: { type: String, required: true, trim: true },
    attachmentUrl: { type: String },
    attachmentName: { type: String, trim: true },
    attachmentMimeType: { type: String, trim: true },
    attachmentSize: { type: Number, min: 0 },
    prescriptionId: { type: Schema.Types.ObjectId, ref: 'TelemedicinePrescription', index: true },
    messageType: { type: String, enum: Object.values(TelemedicineMessageType), default: TelemedicineMessageType.TEXT, index: true },
    callSummary: {
      callId: { type: String, trim: true, maxlength: 100 },
      callType: { type: String, enum: ['VIDEO', 'VOICE'] },
      durationSeconds: { type: Number, min: 0, max: 86400 },
      participantCount: { type: Number, min: 1, max: 20 },
    },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

TelemedicineMessageSchema.index(
  { sessionId: 1, 'callSummary.callId': 1 },
  { unique: true, partialFilterExpression: { 'callSummary.callId': { $type: 'string' } }, name: 'unique_call_summary_per_session' }
);

export const TelemedicineMessageModel =
  (mongoose.models.TelemedicineMessage as mongoose.Model<ITelemedicineMessageDocument>) ||
  mongoose.model<ITelemedicineMessageDocument>('TelemedicineMessage', TelemedicineMessageSchema);

const PrescriptionMedicationSchema = new Schema({
  genericName: { type: String, required: true, trim: true, maxlength: 200 },
  strengthForm: { type: String, required: true, trim: true, maxlength: 200 },
  dosageFrequency: { type: String, required: true, trim: true, maxlength: 500 },
  duration: { type: String, required: true, trim: true, maxlength: 100 },
  quantity: { type: String, required: true, trim: true, maxlength: 100 },
  route: { type: String, required: true, trim: true, maxlength: 100 },
}, { _id: false });

const TelemedicinePrescriptionSchema = new Schema({
  hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'TelemedicineSession', required: true, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  facilityName: { type: String, required: true, trim: true },
  prescriberName: { type: String, required: true, trim: true },
  professionalRegistrationNumber: { type: String, required: false, trim: true },
  telemedicinePlatform: { type: String, default: 'MedXVerse', trim: true },
  dateIssued: { type: Date, default: Date.now, required: true },
  patientSnapshot: {
    fullName: String,
    dateOfBirth: Date,
    patientIdNumber: String,
    contactNumber: String,
    residentialAddress: String,
    knownDrugAllergies: [String],
  },
  diagnosis: { type: String, required: true, trim: true, maxlength: 3000 },
  clinicalNotes: { type: String, trim: true, maxlength: 5000 },
  medications: { type: [PrescriptionMedicationSchema], required: true, validate: [(value: unknown[]) => value.length > 0 && value.length <= 6, 'A prescription must contain 1 to 6 medications.'] },
  patientInstructions: { type: String, trim: true, maxlength: 3000 },
  pharmacistInstructions: { type: String, trim: true, maxlength: 3000 },
  genericSubstitutionPermitted: { type: Boolean, default: false },
  refillAuthorized: { type: Boolean, default: false },
  numberOfRefills: { type: Number, min: 0, max: 12, default: 0 },
  controlledSubstance: { type: Boolean, default: false },
  prescriberAuthorizationId: { type: String, required: false, trim: true },
  digitalSignature: { type: String, required: true, trim: true, maxlength: 300 },
  signatureMethod: { type: String, enum: ['TYPED_NAME_ACKNOWLEDGMENT'], default: 'TYPED_NAME_ACKNOWLEDGMENT' },
  signedAt: { type: Date, required: true },
  verificationId: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['ISSUED', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED'], default: 'ISSUED', index: true },
  pharmacyDispensing: {
    dispensedBy: String,
    pharmacyName: String,
    dateDispensed: Date,
    notes: String,
  },
}, { timestamps: true, minimize: false });

TelemedicinePrescriptionSchema.index({ hospitalId: 1, patientId: 1, dateIssued: -1 });
TelemedicinePrescriptionSchema.index({ hospitalId: 1, sessionId: 1, dateIssued: -1 });

export const TelemedicinePrescriptionModel =
  (mongoose.models.TelemedicinePrescription as mongoose.Model<any>) ||
  mongoose.model('TelemedicinePrescription', TelemedicinePrescriptionSchema);

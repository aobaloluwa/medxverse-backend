import { Schema, model } from 'mongoose';
import {
  IIncidentReportDocument,
  IConsentFormDocument,
  IBirthDeathRecordDocument,
  IDiseaseSurveillanceLogDocument,
  INdpaAuditLogDocument,
  IncidentSeverity,
  ReportableDisease,
} from './quality-compliance.types.js';

const IncidentReportSchema = new Schema<IIncidentReportDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    incidentType: {
      type: String,
      enum: ['MEDICATION_ERROR', 'PATIENT_FALL', 'EQUIPMENT_FAILURE', 'NEEDLE_STICK', 'NEAR_MISS', 'OTHER'],
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(IncidentSeverity),
      default: IncidentSeverity.MODERATE,
      required: true,
    },
    description: { type: String, required: true, trim: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    departmentName: { type: String, required: true, trim: true },
    investigationStatus: {
      type: String,
      enum: ['LOGGED', 'UNDER_INVESTIGATION', 'ACTION_TAKEN', 'CLOSED'],
      default: 'LOGGED',
      required: true,
      index: true,
    },
    actionTaken: { type: String, trim: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    incidentDate: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const ConsentFormSchema = new Schema<IConsentFormDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    procedureName: { type: String, required: true, trim: true },
    risksAcknowledged: [{ type: String, trim: true }],
    patientSignatureName: { type: String, required: true, trim: true },
    doctorSignatureId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['DRAFT', 'SIGNED', 'REVOKED'], default: 'SIGNED', required: true },
    signedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const BirthDeathRecordSchema = new Schema<IBirthDeathRecordDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    type: { type: String, enum: ['BIRTH', 'DEATH'], required: true, index: true },
    certificateNumber: { type: String, required: true, unique: true, index: true },
    subjectName: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    eventDate: { type: Date, required: true },
    primaryCauseOrDetails: { type: String, required: true, trim: true },
    icdCode: { type: String, trim: true },
    attendingPhysicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mohNotified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const DiseaseSurveillanceLogSchema = new Schema<IDiseaseSurveillanceLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    disease: {
      type: String,
      enum: Object.values(ReportableDisease),
      required: true,
      index: true,
    },
    caseDefinition: {
      type: String,
      enum: ['SUSPECTED', 'PROBABLE', 'CONFIRMED'],
      default: 'SUSPECTED',
      required: true,
    },
    labConfirmationDetails: { type: String, trim: true },
    mohNotified: { type: Boolean, default: true },
    ncdcNotifiedAt: { type: Date, default: Date.now },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    onsetStartDate: { type: Date, required: true },
  },
  { timestamps: true }
);

const NdpaAuditLogSchema = new Schema<INdpaAuditLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      enum: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'],
      required: true,
    },
    resourceType: { type: String, required: true, trim: true },
    resourceId: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    reason: { type: String, trim: true },
    performedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

export const IncidentReportModel = model<IIncidentReportDocument>('IncidentReport', IncidentReportSchema);
export const ConsentFormModel = model<IConsentFormDocument>('ConsentForm', ConsentFormSchema);
export const BirthDeathRecordModel = model<IBirthDeathRecordDocument>('BirthDeathRecord', BirthDeathRecordSchema);
export const DiseaseSurveillanceLogModel = model<IDiseaseSurveillanceLogDocument>('DiseaseSurveillanceLog', DiseaseSurveillanceLogSchema);
export const NdpaAuditLogModel = model<INdpaAuditLogDocument>('NdpaAuditLog', NdpaAuditLogSchema);

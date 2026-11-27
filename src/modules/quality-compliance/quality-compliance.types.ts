import { Document, Types } from 'mongoose';

export enum IncidentSeverity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
  CRITICAL = 'CRITICAL',
}

export enum ReportableDisease {
  LASSA_FEVER = 'LASSA_FEVER',
  CHOLERA = 'CHOLERA',
  MPOX = 'MPOX',
  MEASLES = 'MEASLES',
  YELLOW_FEVER = 'YELLOW_FEVER',
  COVID19 = 'COVID19',
  TUBERCULOSIS = 'TUBERCULOSIS',
  OTHER = 'OTHER',
}

export interface IIncidentReport {
  hospitalId: Types.ObjectId;
  incidentType: 'MEDICATION_ERROR' | 'PATIENT_FALL' | 'EQUIPMENT_FAILURE' | 'NEEDLE_STICK' | 'NEAR_MISS' | 'OTHER';
  severity: IncidentSeverity;
  description: string;
  patientId?: Types.ObjectId;
  departmentName: string;
  investigationStatus: 'LOGGED' | 'UNDER_INVESTIGATION' | 'ACTION_TAKEN' | 'CLOSED';
  actionTaken?: string;
  reportedBy: Types.ObjectId;
  incidentDate: Date;
}

export interface IIncidentReportDocument extends IIncidentReport, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IConsentForm {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  procedureName: string;
  risksAcknowledged: string[];
  patientSignatureName: string;
  doctorSignatureId: Types.ObjectId;
  status: 'DRAFT' | 'SIGNED' | 'REVOKED';
  signedAt: Date;
}

export interface IConsentFormDocument extends IConsentForm, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IBirthDeathRecord {
  hospitalId: Types.ObjectId;
  patientId?: Types.ObjectId;
  type: 'BIRTH' | 'DEATH';
  certificateNumber: string;
  subjectName: string;
  gender: string;
  eventDate: Date;
  primaryCauseOrDetails: string;
  icdCode?: string;
  attendingPhysicianId: Types.ObjectId;
  mohNotified: boolean;
}

export interface IBirthDeathRecordDocument extends IBirthDeathRecord, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiseaseSurveillanceLog {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  disease: ReportableDisease;
  caseDefinition: 'SUSPECTED' | 'PROBABLE' | 'CONFIRMED';
  labConfirmationDetails?: string;
  mohNotified: boolean;
  ncdcNotifiedAt?: Date;
  reportedBy: Types.ObjectId;
  onsetStartDate: Date;
}

export interface IDiseaseSurveillanceLogDocument extends IDiseaseSurveillanceLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface INdpaAuditLog {
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT';
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  reason?: string;
  performedAt: Date;
}

export interface INdpaAuditLogDocument extends INdpaAuditLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIncidentInput {
  hospitalId: string;
  incidentType: 'MEDICATION_ERROR' | 'PATIENT_FALL' | 'EQUIPMENT_FAILURE' | 'NEEDLE_STICK' | 'NEAR_MISS' | 'OTHER';
  severity?: IncidentSeverity;
  description: string;
  patientId?: string;
  departmentName: string;
  reportedBy: string;
}

export interface CreateConsentInput {
  hospitalId: string;
  patientId: string;
  procedureName: string;
  risksAcknowledged?: string[];
  patientSignatureName: string;
  doctorSignatureId: string;
}

export interface CreateBirthDeathInput {
  hospitalId: string;
  patientId?: string;
  type: 'BIRTH' | 'DEATH';
  subjectName: string;
  gender: string;
  eventDate: Date;
  primaryCauseOrDetails: string;
  icdCode?: string;
  attendingPhysicianId: string;
}

export interface CreateSurveillanceInput {
  hospitalId: string;
  patientId: string;
  disease: ReportableDisease;
  caseDefinition?: 'SUSPECTED' | 'PROBABLE' | 'CONFIRMED';
  labConfirmationDetails?: string;
  onsetStartDate: Date;
  reportedBy: string;
}

export interface CreateNdpaAuditInput {
  hospitalId: string;
  userId: string;
  action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT';
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  reason?: string;
}

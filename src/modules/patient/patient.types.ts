import { Document, Types } from 'mongoose';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum AllergySeverity {
  MILD = 'MILD',
  MODERATE = 'MODERATE',
  SEVERE = 'SEVERE',
}

export enum MedicalHistoryStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  CHRONIC = 'CHRONIC',
}

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Genotype = 'AA' | 'AS' | 'SS' | 'AC';

export type FhirResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Observation'
  | 'Condition'
  | 'MedicationStatement'
  | 'ServiceRequest'
  | 'DocumentReference'
  | 'Procedure'
  | 'Claim';

export type ConsentResourceType = FhirResourceType | 'ALL';

export interface IVitals {
  temperature?: number;
  systolicBp?: number;
  diastolicBp?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
  encounterId?: Types.ObjectId;
}

export interface IAllergy {
  allergen: string;
  reaction: string;
  severity: AllergySeverity;
}

export interface IMedicalHistory {
  condition: string;
  diagnosedDate?: Date;
  status: MedicalHistoryStatus;
  notes?: string;
}

export interface IPatient {
  hospitalId: Types.ObjectId;
  /** Canonical MPI identifier; stable for the life of the patient record. */
  universalPatientId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  maritalStatus?: string;
  occupation?: string;
  nextOfKin?: string;
  informant?: string;
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  policyNumber?: string;
  hmoId?: Types.ObjectId;
  vitalsHistory: IVitals[];
  allergies: IAllergy[];
  medicalHistory: IMedicalHistory[];
  active: boolean;
  mergedInto?: Types.ObjectId;
  isFlagged: boolean;
  flagReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPatientDocument extends IPatient, Document {
  _id: Types.ObjectId;
}

export interface CreatePatientDTO {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  maritalStatus: string;
  occupation: string;
  nextOfKin: string;
  informant: string;
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  policyNumber?: string;
  hmoId?: string;
}

export interface UpdatePatientDTO {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  email?: string;
  address?: string;
  maritalStatus?: string;
  occupation?: string;
  nextOfKin?: string;
  informant?: string;
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  policyNumber?: string;
  hmoId?: string;
  isFlagged?: boolean;
  flagReason?: string;
  reason?: string;
}

export interface AddVitalsDTO {
  temperature?: number;
  systolicBp?: number;
  diastolicBp?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  encounterId?: string;
}

export interface GetPatientsQueryDTO {
  search?: string;
  page?: string;
  limit?: string;
}

export interface DuplicateCandidate {
  patient: IPatientDocument;
  score: number;
  reasons: string[];
}

export interface FhirMeta {
  versionId: string;
  lastUpdated: Date;
  profile?: string[];
  security?: Array<{ system: string; code: string; display?: string }>;
}

export interface EHRResourceEnvelope {
  resourceType: FhirResourceType;
  id?: string;
  patientId: string;
  encounterId?: string;
  status?: string;
  sensitive?: boolean;
  sensitivityCode?: string;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  resource: Record<string, unknown>;
}

export interface IEhrEvent {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  resourceType: FhirResourceType;
  resourceId: string;
  version: number;
  action: 'CREATE' | 'UPDATE' | 'MERGE' | 'DELETE' | 'AMEND';
  occurredAt: Date;
  recordedBy: Types.ObjectId;
  department?: string;
  encounterId?: Types.ObjectId;
  reason?: string;
  previousVersion?: number;
  resource: Record<string, unknown>;
  sensitive: boolean;
  sensitivityCode?: string;
  changedFields?: string[];
  sourceKey?: string;
  sourceSystem?: string;
  sourceModel?: string;
  sourceRecordId?: string;
  recordedAt?: Date;
}

export interface IEhrEventDocument extends IEhrEvent, Document {
  _id: Types.ObjectId;
}

export interface CreateEncounterDTO {
  patientId: string;
  encounterType: string;
  status?: string;
  class?: string;
  department?: string;
  practitionerId?: string;
  start?: string;
  end?: string;
  reason?: string;
  diagnosis?: string;
  metadata?: Record<string, unknown>;
  sensitive?: boolean;
}

export interface CreateEHRResourceDTO {
  resourceType: FhirResourceType;
  patientId: string;
  id?: string;
  encounterId?: string;
  status?: string;
  department?: string;
  sensitive?: boolean;
  sensitivityCode?: string;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  resource: Record<string, unknown>;
  reason?: string;
}

export interface CreateConsentDTO {
  patientId: string;
  status: 'ACTIVE' | 'REVOKED' | 'PENDING';
  resourceTypes: ConsentResourceType[];
  sensitivityCode?: string;
  grantedToRoles?: string[];
  grantedToUsers?: string[];
  validFrom?: string;
  validUntil?: string;
  purpose?: string;
  notes?: string;
}

export interface IConsentRecord {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  status: 'ACTIVE' | 'REVOKED' | 'PENDING';
  resourceTypes: ConsentResourceType[];
  sensitivityCode?: string;
  grantedToRoles: string[];
  grantedToUsers: Types.ObjectId[];
  validFrom?: Date;
  validUntil?: Date;
  purpose?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConsentRecordDocument extends IConsentRecord, Document {
  _id: Types.ObjectId;
}

export interface IClinicalSummaryItem {
  id?: string;
  resourceType: FhirResourceType | string;
  sourceModel?: string;
  moduleKey?: string;
  date?: Date | string;
  title: string;
  status?: string;
  summary?: string;
  sensitive?: boolean;
  details?: Record<string, unknown>;
}

export interface PatientClinicalSummary {
  encounters: IClinicalSummaryItem[];
  observations: IClinicalSummaryItem[];
  conditions: IClinicalSummaryItem[];
  medications: IClinicalSummaryItem[];
  documents: IClinicalSummaryItem[];
  procedures: IClinicalSummaryItem[];
  claims: IClinicalSummaryItem[];
  legacy: {
    surgery: IClinicalSummaryItem[];
    radiology: IClinicalSummaryItem[];
    laboratory: IClinicalSummaryItem[];
    pharmacy: IClinicalSummaryItem[];
    outpatient: IClinicalSummaryItem[];
    billing: {
      totalCharges: number;
      totalPaid: number;
      balance: number;
      items: IClinicalSummaryItem[];
    };
  };
}

export interface PatientWithClinicalSummary extends IPatientDocument {
  clinicalSummary: PatientClinicalSummary;
}

export interface PatientEhrChart {
  patient: IPatientDocument;
  resources: Record<FhirResourceType, Record<string, unknown>[]>;
  timeline: Record<string, unknown>[];
  resourceCount: number;
}


export interface PatientRegistrySection {
  key: string;
  label: string;
  count: number;
  items: IClinicalSummaryItem[];
}

export interface PatientRegistryOverview {
  totalClinicalRecords: number;
  activeMedications: IClinicalSummaryItem[];
  activeAdmissions: IClinicalSummaryItem[];
  activeIcuAdmissions: IClinicalSummaryItem[];
  recentDiagnoses: IClinicalSummaryItem[];
  recentProcedures: IClinicalSummaryItem[];
  recentLaboratory: IClinicalSummaryItem[];
  recentRadiology: IClinicalSummaryItem[];
  upcomingAppointments: IClinicalSummaryItem[];
  latestVitals?: Record<string, unknown>;
}

export interface PatientRegistry {
  patient: IPatientDocument;
  overview: PatientRegistryOverview;
  sections: PatientRegistrySection[];
  ehr: PatientEhrChart;
  timeline: IClinicalSummaryItem[];
}

import { Document, Types } from 'mongoose';

export enum ClinicalSpecialty {
  INTERNAL_MEDICINE = 'INTERNAL_MEDICINE',
  PEDIATRICS = 'PEDIATRICS',
  NICU = 'NICU',
  CARDIOLOGY = 'CARDIOLOGY',
  NEUROLOGY = 'NEUROLOGY',
  ORTHOPEDICS = 'ORTHOPEDICS',
  ONCOLOGY = 'ONCOLOGY',
  NEPHROLOGY_DIALYSIS = 'NEPHROLOGY_DIALYSIS',
  UROLOGY = 'UROLOGY',
  GASTROENTEROLOGY_ENDOSCOPY = 'GASTROENTEROLOGY_ENDOSCOPY',
  PULMONOLOGY = 'PULMONOLOGY',
  ENDOCRINOLOGY_DIABETES = 'ENDOCRINOLOGY_DIABETES',
  ENT = 'ENT',
  OPHTHALMOLOGY = 'OPHTHALMOLOGY',
  DERMATOLOGY = 'DERMATOLOGY',
  DENTAL = 'DENTAL',
  PSYCHIATRY = 'PSYCHIATRY',
  ANESTHESIOLOGY = 'ANESTHESIOLOGY',
  PHYSIOTHERAPY = 'PHYSIOTHERAPY',
}

export enum SpecialtyEncounterStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface IDiagnosisItem {
  code?: string;
  description: string;
  type?: 'PRIMARY' | 'SECONDARY' | 'DIFFERENTIAL';
}

export interface IPrescriptionItem {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface IProcedurePerformed {
  procedureName: string;
  code?: string;
  performedAt: Date;
  notes?: string;
}

export interface ISpecialtyEncounter {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  specialty: ClinicalSpecialty;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  physicalExamination?: string;
  specialtyData?: Record<string, any>;
  diagnoses: IDiagnosisItem[];
  prescriptions: IPrescriptionItem[];
  proceduresPerformed: IProcedurePerformed[];
  treatmentPlan?: string;
  followUpDate?: Date;
  status: SpecialtyEncounterStatus;
  encounterDate: Date;
  completedAt?: Date;
}

export interface ISpecialtyEncounterDocument extends ISpecialtyEncounter, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSpecialtyEncounterInput {
  hospitalId: string;
  patientId: string;
  doctorId: string;
  specialty: ClinicalSpecialty;
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  physicalExamination?: string;
  specialtyData?: Record<string, any>;
  diagnoses?: IDiagnosisItem[];
  prescriptions?: IPrescriptionItem[];
  proceduresPerformed?: IProcedurePerformed[];
  treatmentPlan?: string;
  followUpDate?: Date;
}

export interface GetSpecialtyEncountersQuery {
  page?: number;
  limit?: number;
  specialty?: ClinicalSpecialty;
  patientId?: string;
  doctorId?: string;
  status?: SpecialtyEncounterStatus;
}

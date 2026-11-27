import { Document, Types } from 'mongoose';

export enum PathologyStatus {
  SPECIMEN_RECEIVED = 'SPECIMEN_RECEIVED',
  GROSSING = 'GROSSING',
  SECTIONING = 'SECTIONING',
  STAINING = 'STAINING',
  MICROSCOPY = 'MICROSCOPY',
  REPORTED = 'REPORTED',
  CANCELLED = 'CANCELLED',
}

export enum CardiacType {
  ECG = 'ECG',
  ECHOCARDIOGRAM = 'ECHOCARDIOGRAM',
  HOLTER_MONITOR = 'HOLTER_MONITOR',
  STRESS_TEST = 'STRESS_TEST',
}

export enum CssdStatus {
  WASHING = 'WASHING',
  PACKAGING = 'PACKAGING',
  AUTOCLAVING = 'AUTOCLAVING',
  STERILE = 'STERILE',
  EXPIRED = 'EXPIRED',
}

export enum MortuaryStatus {
  ADMITTED = 'ADMITTED',
  AUTOPSY_PENDING = 'AUTOPSY_PENDING',
  RELEASE_READY = 'RELEASE_READY',
  RELEASED = 'RELEASED',
}

export interface IPathologyReport {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  specimenType: string;
  organOrSite: string;
  clinicalDiagnosis?: string;
  status: PathologyStatus;
  grossDescription?: string;
  microscopicDescription?: string;
  pathologistImpression?: string;
  pathologistId?: Types.ObjectId;
  receivedAt: Date;
  reportedAt?: Date;
}

export interface IPathologyReportDocument extends IPathologyReport, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ICardiacDiagnosticReport {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  cardiologistId?: Types.ObjectId;
  type: CardiacType;
  ejectionFractionPercent?: number;
  rhythm?: string;
  valvularStatus?: string;
  wallMotionSummary?: string;
  impression: string;
  recordedAt: Date;
}

export interface ICardiacDiagnosticReportDocument extends ICardiacDiagnosticReport, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ICssdBatchLog {
  hospitalId: Types.ObjectId;
  batchCode: string;
  autoclaveMachineId: string;
  trayDescription: string;
  cycleTemperatureCelsius: number;
  cyclePressureBar: number;
  indicatorTapePassed: boolean;
  sterilizedAt: Date;
  expiresAt: Date;
  status: CssdStatus;
  operatorId: Types.ObjectId;
}

export interface ICssdBatchLogDocument extends ICssdBatchLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IInfectionControlLog {
  hospitalId: Types.ObjectId;
  patientId?: Types.ObjectId;
  wardId?: string;
  pathogenIsolated?: string;
  infectionSite?: string;
  surveillanceType: 'NOSOCOMIAL' | 'OUTBREAK_MONITORING' | 'AUDIT';
  isolationPrecautionsRequired: boolean;
  notes: string;
  auditedBy: Types.ObjectId;
  auditedAt: Date;
}

export interface IInfectionControlLogDocument extends IInfectionControlLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IMortuaryRecord {
  hospitalId: Types.ObjectId;
  patientId?: Types.ObjectId;
  deceasedName: string;
  gender: string;
  dateOfDeath: Date;
  causeOfDeath: Date | string;
  bodyTagCode: string;
  chamberBayNumber: string;
  status: MortuaryStatus;
  nextOfKinName: string;
  nextOfKinPhone: string;
  releasedAt?: Date;
  releasedTo?: string;
  receivedBy: Types.ObjectId;
}

export interface IMortuaryRecordDocument extends IMortuaryRecord, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePathologyInput {
  hospitalId: string;
  patientId: string;
  specimenType: string;
  organOrSite: string;
  clinicalDiagnosis?: string;
  grossDescription?: string;
  microscopicDescription?: string;
  pathologistImpression?: string;
  pathologistId?: string;
}

export interface CreateCardiacReportInput {
  hospitalId: string;
  patientId: string;
  cardiologistId?: string;
  type: CardiacType;
  ejectionFractionPercent?: number;
  rhythm?: string;
  valvularStatus?: string;
  wallMotionSummary?: string;
  impression: string;
}

export interface CreateCssdBatchInput {
  hospitalId: string;
  batchCode: string;
  autoclaveMachineId: string;
  trayDescription: string;
  cycleTemperatureCelsius?: number;
  cyclePressureBar?: number;
  indicatorTapePassed?: boolean;
  validDays?: number;
  operatorId: string;
}

export interface CreateIpcLogInput {
  hospitalId: string;
  patientId?: string;
  wardId?: string;
  pathogenIsolated?: string;
  infectionSite?: string;
  surveillanceType?: 'NOSOCOMIAL' | 'OUTBREAK_MONITORING' | 'AUDIT';
  isolationPrecautionsRequired?: boolean;
  notes: string;
  auditedBy: string;
}

export interface CreateMortuaryRecordInput {
  hospitalId: string;
  patientId?: string;
  deceasedName: string;
  gender: string;
  dateOfDeath: Date;
  causeOfDeath: string;
  chamberBayNumber: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  receivedBy: string;
}

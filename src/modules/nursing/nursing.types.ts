import { Document, Types } from 'mongoose';

export enum MarStatus {
  GIVEN = 'GIVEN',
  HELD = 'HELD',
  REFUSED = 'REFUSED',
  MISSED = 'MISSED',
  SCHEDULED = 'SCHEDULED',
}

export enum ShiftType {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
}

export interface IMarLog {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  medicationName: string;
  dosage: string;
  route: string;
  scheduledTime: Date;
  status: MarStatus;
  administeredAt?: Date;
  administeredBy?: Types.ObjectId;
  reasonHeldOrRefused?: string;
  notes?: string;
}

export interface IMarLogDocument extends IMarLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ISbarHandover {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface INursingNote {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  nurseId: Types.ObjectId;
  noteType: 'PROGRESS_NOTE' | 'SHIFT_HANDOVER' | 'VITAL_CHECK' | 'CARE_PLAN';
  shiftType?: ShiftType;
  sbar?: ISbarHandover;
  content?: string;
  fallRiskScore?: number;
  isHighRisk?: boolean;
  isolationPrecautions?: boolean;
  isNpo?: boolean;
  createdAt: Date;
}

export interface INursingNoteDocument extends INursingNote, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IFluidBalanceLog {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  recordedBy: Types.ObjectId;
  oralIntakeMl?: number;
  ivIntakeMl?: number;
  tubeFeedMl?: number;
  urineOutputMl?: number;
  drainOutputMl?: number;
  vomitOutputMl?: number;
  recordedAt: Date;
  notes?: string;
}

export interface IFluidBalanceLogDocument extends IFluidBalanceLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMarLogInput {
  hospitalId: string;
  patientId: string;
  medicationName: string;
  dosage: string;
  route?: string;
  scheduledTime: Date;
  status?: MarStatus;
  reasonHeldOrRefused?: string;
  notes?: string;
  administeredBy?: string;
}

export interface CreateNursingNoteInput {
  hospitalId: string;
  patientId: string;
  nurseId: string;
  noteType: 'PROGRESS_NOTE' | 'SHIFT_HANDOVER' | 'VITAL_CHECK' | 'CARE_PLAN';
  shiftType?: ShiftType;
  sbar?: ISbarHandover;
  content?: string;
  fallRiskScore?: number;
  isHighRisk?: boolean;
  isolationPrecautions?: boolean;
  isNpo?: boolean;
}

export interface CreateFluidBalanceInput {
  hospitalId: string;
  patientId: string;
  recordedBy: string;
  oralIntakeMl?: number;
  ivIntakeMl?: number;
  tubeFeedMl?: number;
  urineOutputMl?: number;
  drainOutputMl?: number;
  vomitOutputMl?: number;
  notes?: string;
}

export interface GetNursingQuery {
  page?: number;
  limit?: number;
  patientId?: string;
  shiftType?: ShiftType;
  status?: MarStatus;
}

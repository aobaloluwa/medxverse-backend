import { Document, Types } from 'mongoose';

export enum ReferralType {
  INWARD = 'INWARD',
  OUTWARD = 'OUTWARD',
}

export enum ReferralUrgency {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  EMERGENCY = 'EMERGENCY',
}

export enum ReferralStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  TRANSFERRED = 'TRANSFERRED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface IReferral {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  type: ReferralType;
  referringFacility: string;
  receivingFacility: string;
  referringDoctorName?: string;
  receivingDoctorName?: string;
  specialtyRequired: string;
  reason: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  notes?: string;
  transportRequired?: boolean;
  referredAt: Date;
  completedAt?: Date;
  createdBy?: Types.ObjectId;
}

export interface IReferralDocument extends IReferral, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReferralInput {
  hospitalId: string;
  patientId: string;
  type: ReferralType;
  referringFacility: string;
  receivingFacility: string;
  referringDoctorName?: string;
  receivingDoctorName?: string;
  specialtyRequired: string;
  reason: string;
  urgency?: ReferralUrgency;
  notes?: string;
  transportRequired?: boolean;
  createdBy?: string;
}

export interface UpdateReferralStatusInput {
  status: ReferralStatus;
  notes?: string;
}

export interface GetReferralsQuery {
  page?: number;
  limit?: number;
  type?: ReferralType;
  status?: ReferralStatus;
  patientId?: string;
  urgency?: ReferralUrgency;
}

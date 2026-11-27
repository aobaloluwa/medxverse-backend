import { Document, Types } from 'mongoose';

export enum VisitorPassStatus {
  ACTIVE = 'ACTIVE',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface IVisitorPass {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  visitorName: string;
  visitorPhone: string;
  visitorIdNumber?: string;
  relationship: string;
  wardId: string;
  bedNumber: string;
  passCode: string;
  validFrom: Date;
  validUntil: Date;
  status: VisitorPassStatus;
  checkInTime?: Date;
  checkOutTime?: Date;
  issuedBy?: Types.ObjectId;
  notes?: string;
}

export interface IVisitorPassDocument extends IVisitorPass, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVisitorPassInput {
  hospitalId: string;
  patientId: string;
  visitorName: string;
  visitorPhone: string;
  visitorIdNumber?: string;
  relationship: string;
  wardId: string;
  bedNumber: string;
  validHours?: number;
  notes?: string;
  issuedBy?: string;
}

export interface GetVisitorPassesQuery {
  page?: number;
  limit?: number;
  status?: VisitorPassStatus;
  patientId?: string;
  wardId?: string;
  passCode?: string;
}

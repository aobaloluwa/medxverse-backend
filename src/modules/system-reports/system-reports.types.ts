import { Document, Types } from 'mongoose';

export enum IntegrationType {
  FHIR = 'FHIR',
  PACS_DICOM = 'PACS_DICOM',
  HL7_ANALYZER = 'HL7_ANALYZER',
  SMS_GATEWAY = 'SMS_GATEWAY',
  EMAIL_SMTP = 'EMAIL_SMTP',
}

export enum SupportPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface IHospitalBranch {
  hospitalId: Types.ObjectId;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isMainCampus: boolean;
  isActive: boolean;
}

export interface IHospitalBranchDocument extends IHospitalBranch, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IRbacRole {
  hospitalId: Types.ObjectId;
  roleKey: string;
  roleName: string;
  allowedModules: string[];
  permissions: Record<string, boolean>;
  isSystemDefault: boolean;
}

export interface IRbacRoleDocument extends IRbacRole, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IIntegrationGateway {
  hospitalId: Types.ObjectId;
  type: IntegrationType;
  endpointUrl: string;
  apiKeyOrToken?: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSyncAt?: Date;
}

export interface IIntegrationGatewayDocument extends IIntegrationGateway, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IBackupLog {
  hospitalId: Types.ObjectId;
  backupName: string;
  sizeMb: number;
  type: 'AUTO' | 'MANUAL';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  completedAt: Date;
}

export interface IBackupLogDocument extends IBackupLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupportTicket {
  hospitalId: Types.ObjectId;
  ticketCode: string;
  subject: string;
  category: string;
  priority: SupportPriority;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  description: string;
  requestedBy: Types.ObjectId;
  resolvedAt?: Date;
}

export interface ISupportTicketDocument extends ISupportTicket, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchInput {
  hospitalId: string;
  branchCode: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  isMainCampus?: boolean;
}

export interface CreateRbacRoleInput {
  hospitalId: string;
  roleKey: string;
  roleName: string;
  allowedModules: string[];
  permissions?: Record<string, boolean>;
}

export interface CreateSupportTicketInput {
  hospitalId: string;
  subject: string;
  category: string;
  priority?: SupportPriority;
  description: string;
  requestedBy: string;
}

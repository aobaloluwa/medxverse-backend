import { Schema, model } from 'mongoose';
import {
  IHospitalBranchDocument,
  IRbacRoleDocument,
  IIntegrationGatewayDocument,
  IBackupLogDocument,
  ISupportTicketDocument,
  IntegrationType,
  SupportPriority,
} from './system-reports.types.js';

const HospitalBranchSchema = new Schema<IHospitalBranchDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    branchCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    isMainCampus: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

HospitalBranchSchema.index({ hospitalId: 1, branchCode: 1 }, { unique: true });

const RbacRoleSchema = new Schema<IRbacRoleDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    roleKey: { type: String, required: true, uppercase: true, trim: true, index: true },
    roleName: { type: String, required: true, trim: true },
    allowedModules: [{ type: String, trim: true }],
    permissions: { type: Schema.Types.Mixed, default: {} },
    isSystemDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RbacRoleSchema.index({ hospitalId: 1, roleKey: 1 }, { unique: true });

const IntegrationGatewaySchema = new Schema<IIntegrationGatewayDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    type: { type: String, enum: Object.values(IntegrationType), required: true },
    endpointUrl: { type: String, required: true, trim: true },
    apiKeyOrToken: { type: String, trim: true },
    status: { type: String, enum: ['CONNECTED', 'DISCONNECTED', 'ERROR'], default: 'CONNECTED', required: true },
    lastSyncAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const BackupLogSchema = new Schema<IBackupLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    backupName: { type: String, required: true, trim: true },
    sizeMb: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['AUTO', 'MANUAL'], default: 'AUTO', required: true },
    status: { type: String, enum: ['COMPLETED', 'IN_PROGRESS', 'FAILED'], default: 'COMPLETED', required: true },
    completedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const SupportTicketSchema = new Schema<ISupportTicketDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    ticketCode: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    priority: { type: String, enum: Object.values(SupportPriority), default: SupportPriority.MEDIUM, required: true },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'OPEN', required: true, index: true },
    description: { type: String, required: true, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export const HospitalBranchModel = model<IHospitalBranchDocument>('HospitalBranch', HospitalBranchSchema);
export const RbacRoleModel = model<IRbacRoleDocument>('RbacRole', RbacRoleSchema);
export const IntegrationGatewayModel = model<IIntegrationGatewayDocument>('IntegrationGateway', IntegrationGatewaySchema);
export const BackupLogModel = model<IBackupLogDocument>('BackupLog', BackupLogSchema);
export const SupportTicketModel = model<ISupportTicketDocument>('SupportTicket', SupportTicketSchema);

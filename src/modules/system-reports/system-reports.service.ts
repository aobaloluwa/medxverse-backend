import { Types } from 'mongoose';
import {
  HospitalBranchModel,
  RbacRoleModel,
  IntegrationGatewayModel,
  BackupLogModel,
  SupportTicketModel,
} from './system-reports.model.js';
import {
  CreateBranchInput,
  CreateRbacRoleInput,
  CreateSupportTicketInput,
  IHospitalBranchDocument,
  IRbacRoleDocument,
  IIntegrationGatewayDocument,
  IBackupLogDocument,
  ISupportTicketDocument,
  SupportPriority,
} from './system-reports.types.js';

export class SystemReportsService {
  // --- Branches ---
  public async createBranch(input: CreateBranchInput): Promise<IHospitalBranchDocument> {
    return HospitalBranchModel.create({
      ...input,
      isActive: true,
    });
  }

  public async getBranches(hospitalId: string): Promise<IHospitalBranchDocument[]> {
    return HospitalBranchModel.find({ hospitalId, isActive: true }).sort({ isMainCampus: -1, name: 1 }).exec();
  }

  // --- RBAC Roles ---
  public async createRbacRole(input: CreateRbacRoleInput): Promise<IRbacRoleDocument> {
    return RbacRoleModel.create({
      ...input,
      isSystemDefault: false,
    });
  }

  public async getRbacRoles(hospitalId: string): Promise<IRbacRoleDocument[]> {
    return RbacRoleModel.find({ hospitalId }).sort({ roleName: 1 }).exec();
  }

  // --- Integrations ---
  public async getIntegrations(hospitalId: string): Promise<IIntegrationGatewayDocument[]> {
    return IntegrationGatewayModel.find({ hospitalId }).sort({ createdAt: -1 }).exec();
  }

  // --- Backups ---
  public async triggerManualBackup(hospitalId: string): Promise<IBackupLogDocument> {
    const backupName = `medxverse_backup_${new Date().toISOString().slice(0, 10)}_${Date.now()}.dump`;
    return BackupLogModel.create({
      hospitalId,
      backupName,
      sizeMb: 128.5,
      type: 'MANUAL',
      status: 'COMPLETED',
      completedAt: new Date(),
    });
  }

  public async getBackupLogs(hospitalId: string): Promise<IBackupLogDocument[]> {
    return BackupLogModel.find({ hospitalId }).sort({ completedAt: -1 }).limit(30).exec();
  }

  // --- Support Tickets ---
  private generateTicketCode(): string {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TCK-${rand}`;
  }

  public async createSupportTicket(input: CreateSupportTicketInput): Promise<ISupportTicketDocument> {
    const ticketCode = this.generateTicketCode();
    return SupportTicketModel.create({
      ...input,
      ticketCode,
      requestedBy: new Types.ObjectId(input.requestedBy),
      priority: input.priority || SupportPriority.MEDIUM,
      status: 'OPEN',
    });
  }

  public async getSupportTickets(hospitalId: string): Promise<ISupportTicketDocument[]> {
    return SupportTicketModel.find({ hospitalId })
      .populate('requestedBy', 'firstName lastName role email')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // --- System Stats Summary ---
  public async getSystemStats(hospitalId: string): Promise<{
    activeBranchesCount: number;
    rbacRolesCount: number;
    connectedIntegrationsCount: number;
    openTicketsCount: number;
  }> {
    const [activeBranchesCount, rbacRolesCount, connectedIntegrationsCount, openTicketsCount] = await Promise.all([
      HospitalBranchModel.countDocuments({ hospitalId, isActive: true }),
      RbacRoleModel.countDocuments({ hospitalId }),
      IntegrationGatewayModel.countDocuments({ hospitalId, status: 'CONNECTED' }),
      SupportTicketModel.countDocuments({ hospitalId, status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
    ]);

    return {
      activeBranchesCount,
      rbacRolesCount,
      connectedIntegrationsCount,
      openTicketsCount,
    };
  }
}

export const systemReportsService = new SystemReportsService();

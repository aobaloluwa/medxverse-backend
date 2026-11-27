import { Request, Response, NextFunction } from 'express';
import { systemReportsService } from './system-reports.service.js';

export class SystemReportsController {
  // Branches
  public async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }
      const branch = await systemReportsService.createBranch({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'Hospital branch registered.', data: branch });
    } catch (error: any) {
      next(error);
    }
  }

  public async getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const branches = await systemReportsService.getBranches(hospitalId);
      res.status(200).json({ success: true, data: branches });
    } catch (error: any) {
      next(error);
    }
  }

  // RBAC
  public async createRbacRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const role = await systemReportsService.createRbacRole({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'RBAC role created.', data: role });
    } catch (error: any) {
      next(error);
    }
  }

  public async getRbacRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const roles = await systemReportsService.getRbacRoles(hospitalId);
      res.status(200).json({ success: true, data: roles });
    } catch (error: any) {
      next(error);
    }
  }

  // Integrations
  public async getIntegrations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const gateways = await systemReportsService.getIntegrations(hospitalId);
      res.status(200).json({ success: true, data: gateways });
    } catch (error: any) {
      next(error);
    }
  }

  // Backups
  public async triggerBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const backup = await systemReportsService.triggerManualBackup(hospitalId);
      res.status(201).json({ success: true, message: 'Manual database backup generated.', data: backup });
    } catch (error: any) {
      next(error);
    }
  }

  public async getBackups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const logs = await systemReportsService.getBackupLogs(hospitalId);
      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      next(error);
    }
  }

  // Support Tickets
  public async createTicket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const requestedBy = (req as any).user?.userId || req.body.requestedBy || '650000000000000000000001';
      const ticket = await systemReportsService.createSupportTicket({ ...req.body, hospitalId, requestedBy });
      res.status(201).json({ success: true, message: 'Support ticket submitted.', data: ticket });
    } catch (error: any) {
      next(error);
    }
  }

  public async getTickets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const tickets = await systemReportsService.getSupportTickets(hospitalId);
      res.status(200).json({ success: true, data: tickets });
    } catch (error: any) {
      next(error);
    }
  }

  // Stats
  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }
      const stats = await systemReportsService.getSystemStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const systemReportsController = new SystemReportsController();

import { Request, Response, NextFunction } from 'express';
import { diagnosticsSupportService } from './diagnostics-support.service.js';

export class DiagnosticsSupportController {
  // Pathology
  public async createPathology(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const report = await diagnosticsSupportService.createPathology({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'Pathology specimen logged.', data: report });
    } catch (error: any) {
      next(error);
    }
  }

  public async getPathology(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const reports = await diagnosticsSupportService.getPathologyReports(hospitalId);
      res.status(200).json({ success: true, data: reports });
    } catch (error: any) {
      next(error);
    }
  }

  // Cardiac
  public async createCardiac(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const report = await diagnosticsSupportService.createCardiacReport({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'Cardiac diagnostic report saved.', data: report });
    } catch (error: any) {
      next(error);
    }
  }

  public async getCardiac(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const reports = await diagnosticsSupportService.getCardiacReports(hospitalId);
      res.status(200).json({ success: true, data: reports });
    } catch (error: any) {
      next(error);
    }
  }

  // CSSD
  public async createCssd(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const operatorId = (req as any).user?.userId || req.body.operatorId || '650000000000000000000001';
      const batch = await diagnosticsSupportService.createCssdBatch({ ...req.body, hospitalId, operatorId });
      res.status(201).json({ success: true, message: 'CSSD Sterilization batch logged.', data: batch });
    } catch (error: any) {
      next(error);
    }
  }

  public async getCssd(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const batches = await diagnosticsSupportService.getCssdBatches(hospitalId);
      res.status(200).json({ success: true, data: batches });
    } catch (error: any) {
      next(error);
    }
  }

  // IPC
  public async createIpc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const auditedBy = (req as any).user?.userId || req.body.auditedBy || '650000000000000000000001';
      const log = await diagnosticsSupportService.createIpcLog({ ...req.body, hospitalId, auditedBy });
      res.status(201).json({ success: true, message: 'IPC Surveillance entry logged.', data: log });
    } catch (error: any) {
      next(error);
    }
  }

  public async getIpc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const logs = await diagnosticsSupportService.getIpcLogs(hospitalId);
      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      next(error);
    }
  }

  // Mortuary
  public async createMortuary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const receivedBy = (req as any).user?.userId || req.body.receivedBy || '650000000000000000000001';
      const record = await diagnosticsSupportService.createMortuaryRecord({ ...req.body, hospitalId, receivedBy });
      res.status(201).json({ success: true, message: 'Mortuary record created.', data: record });
    } catch (error: any) {
      next(error);
    }
  }

  public async getMortuary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const records = await diagnosticsSupportService.getMortuaryRecords(hospitalId);
      res.status(200).json({ success: true, data: records });
    } catch (error: any) {
      next(error);
    }
  }

  public async releaseMortuaryBody(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const { releasedTo } = req.body;
      const updated = await diagnosticsSupportService.releaseMortuaryBody(req.params.id, hospitalId, releasedTo || 'Next-of-Kin');
      res.status(200).json({ success: true, message: 'Mortuary body release cleared.', data: updated });
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

      const stats = await diagnosticsSupportService.getDiagnosticsStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const diagnosticsSupportController = new DiagnosticsSupportController();

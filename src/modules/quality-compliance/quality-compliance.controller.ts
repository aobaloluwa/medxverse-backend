import { Request, Response, NextFunction } from 'express';
import { qualityComplianceService } from './quality-compliance.service.js';

export class QualityComplianceController {
  // Incidents
  public async createIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const reportedBy = (req as any).user?.userId || req.body.reportedBy || '650000000000000000000001';
      const incident = await qualityComplianceService.createIncident({ ...req.body, hospitalId, reportedBy });
      res.status(201).json({ success: true, message: 'Adverse incident logged.', data: incident });
    } catch (error: any) {
      next(error);
    }
  }

  public async getIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const incidents = await qualityComplianceService.getIncidents(hospitalId);
      res.status(200).json({ success: true, data: incidents });
    } catch (error: any) {
      next(error);
    }
  }

  // Consents
  public async createConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const doctorSignatureId = (req as any).user?.userId || req.body.doctorSignatureId || '650000000000000000000001';
      const consent = await qualityComplianceService.createConsentForm({ ...req.body, hospitalId, doctorSignatureId });
      res.status(201).json({ success: true, message: 'Consent form signed.', data: consent });
    } catch (error: any) {
      next(error);
    }
  }

  public async getConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const consents = await qualityComplianceService.getConsentForms(hospitalId);
      res.status(200).json({ success: true, data: consents });
    } catch (error: any) {
      next(error);
    }
  }

  // Birth & Death
  public async createBirthDeath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const attendingPhysicianId = (req as any).user?.userId || req.body.attendingPhysicianId || '650000000000000000000001';
      const record = await qualityComplianceService.createBirthDeathRecord({ ...req.body, hospitalId, attendingPhysicianId });
      res.status(201).json({ success: true, message: 'Birth/Death certificate issued.', data: record });
    } catch (error: any) {
      next(error);
    }
  }

  public async getBirthDeath(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const records = await qualityComplianceService.getBirthDeathRecords(hospitalId);
      res.status(200).json({ success: true, data: records });
    } catch (error: any) {
      next(error);
    }
  }

  // Disease Surveillance
  public async createSurveillance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const reportedBy = (req as any).user?.userId || req.body.reportedBy || '650000000000000000000001';
      const log = await qualityComplianceService.createSurveillanceLog({ ...req.body, hospitalId, reportedBy });
      res.status(201).json({ success: true, message: 'Disease surveillance report logged & NCDC notified.', data: log });
    } catch (error: any) {
      next(error);
    }
  }

  public async getSurveillance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const logs = await qualityComplianceService.getSurveillanceLogs(hospitalId);
      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      next(error);
    }
  }

  // NDPA Audit Logs
  public async getNdpaAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const logs = await qualityComplianceService.getNdpaAuditLogs(hospitalId);
      res.status(200).json({ success: true, data: logs });
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
      const stats = await qualityComplianceService.getQualityStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const qualityComplianceController = new QualityComplianceController();

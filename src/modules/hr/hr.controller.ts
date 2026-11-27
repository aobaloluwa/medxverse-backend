import { Request, Response, NextFunction } from 'express';
import { hrService } from './hr.service.js';
import { RecruitmentStage, LeaveStatus } from './hr.types.js';

export class HrController {
  // Recruitment
  public async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }
      const app = await hrService.createJobApplication({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'Job application created.', data: app });
    } catch (error: any) {
      next(error);
    }
  }

  public async getApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const apps = await hrService.getJobApplications(hospitalId);
      res.status(200).json({ success: true, data: apps });
    } catch (error: any) {
      next(error);
    }
  }

  public async updateApplicationStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const { stage } = req.body;
      const updated = await hrService.updateApplicationStage(req.params.id, hospitalId, stage as RecruitmentStage);
      res.status(200).json({ success: true, message: 'Application stage updated.', data: updated });
    } catch (error: any) {
      next(error);
    }
  }

  // Leave
  public async createLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const leave = await hrService.createLeaveRequest({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'Leave request submitted.', data: leave });
    } catch (error: any) {
      next(error);
    }
  }

  public async getLeave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const requests = await hrService.getLeaveRequests(hospitalId);
      res.status(200).json({ success: true, data: requests });
    } catch (error: any) {
      next(error);
    }
  }

  public async updateLeaveStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const approvedBy = (req as any).user?.userId || req.body.approvedBy || '650000000000000000000001';
      const { status, rejectionReason } = req.body;
      const updated = await hrService.updateLeaveStatus(req.params.id, hospitalId, status as LeaveStatus, approvedBy, rejectionReason);
      res.status(200).json({ success: true, message: 'Leave status updated.', data: updated });
    } catch (error: any) {
      next(error);
    }
  }

  // Licenses
  public async createLicense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const license = await hrService.createLicenseCredential({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'License credential recorded.', data: license });
    } catch (error: any) {
      next(error);
    }
  }

  public async getLicenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const licenses = await hrService.getLicenseCredentials(hospitalId);
      res.status(200).json({ success: true, data: licenses });
    } catch (error: any) {
      next(error);
    }
  }

  // CME
  public async createCme(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const cme = await hrService.createCmeCourse({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'MedxLearn CME course logged.', data: cme });
    } catch (error: any) {
      next(error);
    }
  }

  public async getCme(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const courses = await hrService.getCmeCourses(hospitalId);
      res.status(200).json({ success: true, data: courses });
    } catch (error: any) {
      next(error);
    }
  }

  // Appraisals
  public async createAppraisal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const reviewerId = (req as any).user?.userId || req.body.reviewerId || '650000000000000000000001';
      const appraisal = await hrService.createAppraisal({ ...req.body, hospitalId, reviewerId });
      res.status(201).json({ success: true, message: 'Performance appraisal saved.', data: appraisal });
    } catch (error: any) {
      next(error);
    }
  }

  public async getAppraisals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const appraisals = await hrService.getAppraisals(hospitalId);
      res.status(200).json({ success: true, data: appraisals });
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
      const stats = await hrService.getHrStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const hrController = new HrController();

import { Request, Response, NextFunction } from 'express';
import { visitorService } from './visitor.service.js';
import { VisitorPassStatus } from './visitor.types.js';

export class VisitorController {
  public async issuePass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const pass = await visitorService.issuePass({
        ...req.body,
        hospitalId,
        issuedBy: (req as any).user?.userId,
      });

      res.status(201).json({
        success: true,
        message: 'Visitor pass issued successfully.',
        data: pass,
      });
    } catch (error: any) {
      next(error);
    }
  }

  public async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const query = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        status: req.query.status as VisitorPassStatus,
        patientId: req.query.patientId as string,
        wardId: req.query.wardId as string,
        passCode: req.query.passCode as string,
      };

      const result = await visitorService.getPasses(hospitalId, query);
      res.status(200).json({
        success: true,
        data: result.passes,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error: any) {
      next(error);
    }
  }

  public async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const pass = await visitorService.checkInVisitor(req.params.id, hospitalId);

      res.status(200).json({
        success: true,
        message: 'Visitor checked in successfully.',
        data: pass,
      });
    } catch (error: any) {
      next(error);
    }
  }

  public async checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const pass = await visitorService.checkOutVisitor(req.params.id, hospitalId);

      res.status(200).json({
        success: true,
        message: 'Visitor checked out successfully.',
        data: pass,
      });
    } catch (error: any) {
      next(error);
    }
  }

  public async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const pass = await visitorService.revokePass(req.params.id, hospitalId);

      res.status(200).json({
        success: true,
        message: 'Visitor pass revoked successfully.',
        data: pass,
      });
    } catch (error: any) {
      next(error);
    }
  }
}

export const visitorController = new VisitorController();

import { Request, Response, NextFunction } from 'express';
import { referralsService } from './referrals.service.js';
import { ReferralType, ReferralStatus, ReferralUrgency } from './referrals.types.js';

export class ReferralsController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const referral = await referralsService.createReferral({
        ...req.body,
        hospitalId,
        createdBy: (req as any).user?.userId,
      });

      res.status(201).json({
        success: true,
        message: 'Referral created successfully.',
        data: referral,
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
        type: req.query.type as ReferralType,
        status: req.query.status as ReferralStatus,
        urgency: req.query.urgency as ReferralUrgency,
        patientId: req.query.patientId as string,
      };

      const result = await referralsService.getReferrals(hospitalId, query);
      res.status(200).json({
        success: true,
        data: result.referrals,
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

  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const referral = await referralsService.getReferralById(req.params.id, hospitalId);

      if (!referral) {
        res.status(404).json({ success: false, message: 'Referral not found.' });
        return;
      }

      res.status(200).json({ success: true, data: referral });
    } catch (error: any) {
      next(error);
    }
  }

  public async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const { status, notes } = req.body;

      if (!status) {
        res.status(400).json({ success: false, message: 'Status is required.' });
        return;
      }

      const updated = await referralsService.updateReferralStatus(
        req.params.id,
        hospitalId,
        { status, notes }
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'Referral not found.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Referral status updated successfully.',
        data: updated,
      });
    } catch (error: any) {
      next(error);
    }
  }

  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const stats = await referralsService.getReferralStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const referralsController = new ReferralsController();

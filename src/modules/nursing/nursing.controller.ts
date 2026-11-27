import { Request, Response, NextFunction } from 'express';
import { nursingService } from './nursing.service.js';
import { MarStatus, ShiftType } from './nursing.types.js';

export class NursingController {
  // MAR
  public async createMarLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const log = await nursingService.createMarLog({
        ...req.body,
        hospitalId,
        administeredBy: (req as any).user?.userId,
      });

      res.status(201).json({ success: true, message: 'MAR log created successfully.', data: log });
    } catch (error: any) {
      next(error);
    }
  }

  public async getMarLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const result = await nursingService.getMarLogs(hospitalId, {
        patientId: req.query.patientId as string,
        status: req.query.status as MarStatus,
      });

      res.status(200).json({ success: true, data: result.logs, total: result.total });
    } catch (error: any) {
      next(error);
    }
  }

  public async updateMarStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const administeredBy = (req as any).user?.userId || req.body.administeredBy || '650000000000000000000001';
      const { status, reasonHeldOrRefused } = req.body;

      if (!status) {
        res.status(400).json({ success: false, message: 'Status is required.' });
        return;
      }

      const updated = await nursingService.updateMarStatus(
        req.params.id,
        hospitalId,
        status as MarStatus,
        administeredBy,
        reasonHeldOrRefused
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'MAR entry not found.' });
        return;
      }

      res.status(200).json({ success: true, message: 'MAR status updated successfully.', data: updated });
    } catch (error: any) {
      next(error);
    }
  }

  // Nursing Notes & Handover
  public async createNursingNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const nurseId = (req as any).user?.userId || req.body.nurseId || '650000000000000000000001';

      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const note = await nursingService.createNursingNote({
        ...req.body,
        hospitalId,
        nurseId,
      });

      res.status(201).json({ success: true, message: 'Nursing note created.', data: note });
    } catch (error: any) {
      next(error);
    }
  }

  public async getNursingNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const result = await nursingService.getNursingNotes(hospitalId, {
        patientId: req.query.patientId as string,
        shiftType: req.query.shiftType as ShiftType,
      });

      res.status(200).json({ success: true, data: result.notes, total: result.total });
    } catch (error: any) {
      next(error);
    }
  }

  // Fluid Balance
  public async createFluidBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const recordedBy = (req as any).user?.userId || req.body.recordedBy || '650000000000000000000001';

      const entry = await nursingService.createFluidBalance({
        ...req.body,
        hospitalId,
        recordedBy,
      });

      res.status(201).json({ success: true, message: 'Fluid balance recorded.', data: entry });
    } catch (error: any) {
      next(error);
    }
  }

  public async getFluidBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const patientId = req.params.patientId || (req.query.patientId as string);

      if (!hospitalId || !patientId) {
        res.status(400).json({ success: false, message: 'Hospital ID and Patient ID are required.' });
        return;
      }

      const result = await nursingService.getFluidBalanceLogs(hospitalId, patientId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      next(error);
    }
  }

  // Station Summary
  public async getStationSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const summary = await nursingService.getStationSummary(hospitalId);
      res.status(200).json({ success: true, data: summary });
    } catch (error: any) {
      next(error);
    }
  }
}

export const nursingController = new NursingController();

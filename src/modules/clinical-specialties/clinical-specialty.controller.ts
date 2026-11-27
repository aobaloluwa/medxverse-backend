import { Request, Response, NextFunction } from 'express';
import { clinicalSpecialtyService } from './clinical-specialty.service.js';
import { ClinicalSpecialty, SpecialtyEncounterStatus } from './clinical-specialty.types.js';

export class ClinicalSpecialtyController {
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const doctorId = (req as any).user?.userId || req.body.doctorId;

      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      if (!req.body.patientId || !req.body.specialty || !req.body.chiefComplaint) {
        res.status(400).json({
          success: false,
          message: 'patientId, specialty, and chiefComplaint are required.',
        });
        return;
      }

      const encounter = await clinicalSpecialtyService.createEncounter({
        ...req.body,
        hospitalId,
        doctorId: doctorId || '650000000000000000000001',
      });

      res.status(201).json({
        success: true,
        message: 'Specialty encounter recorded successfully.',
        data: encounter,
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
        specialty: req.query.specialty as ClinicalSpecialty,
        patientId: req.query.patientId as string,
        doctorId: req.query.doctorId as string,
        status: req.query.status as SpecialtyEncounterStatus,
      };

      const result = await clinicalSpecialtyService.getEncounters(hospitalId, query);
      res.status(200).json({
        success: true,
        data: result.encounters,
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
      const encounter = await clinicalSpecialtyService.getEncounterById(
        req.params.id,
        hospitalId
      );

      if (!encounter) {
        res.status(404).json({ success: false, message: 'Specialty encounter record not found.' });
        return;
      }

      res.status(200).json({ success: true, data: encounter });
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

      const stats = await clinicalSpecialtyService.getSpecialtyStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const clinicalSpecialtyController = new ClinicalSpecialtyController();

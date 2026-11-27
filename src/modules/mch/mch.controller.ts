import { Request, Response, NextFunction } from 'express';
import { mchService } from './mch.service.js';
import { MchCareType, PregnancyStatus, DeliveryType, DeliveryOutcome, FamilyPlanningMethod } from './mch.types.js';

export interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    hospitalId: string;
    [key: string]: unknown;
  };
}

export class MchController {
  public async createRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;

      const { patientId, careType, gravida, para, estimatedDeliveryDate, lastMenstrualPeriod } = req.body;

      const record = await mchService.createRecord({
        hospitalId,
        patientId,
        careType: careType as MchCareType,
        gravida,
        para,
        estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : undefined,
        lastMenstrualPeriod: lastMenstrualPeriod ? new Date(lastMenstrualPeriod) : undefined,
      });

      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  public async getRecords(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || (req.query.hospitalId as string);

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const careType = req.query.careType as MchCareType | undefined;
      const patientId = req.query.patientId as string | undefined;
      const pregnancyStatus = req.query.pregnancyStatus as PregnancyStatus | undefined;

      const result = await mchService.getRecords(hospitalId, {
        page,
        limit,
        careType,
        patientId,
        pregnancyStatus,
      });

      res.status(200).json({ success: true, data: result.records, pagination: result });
    } catch (error) {
      next(error);
    }
  }

  public async getRecordById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || (req.query.hospitalId as string);
      const id = req.params.id as string;

      const record = await mchService.getRecordById(id, hospitalId);

      if (!record) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  public async addAncVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;
      const attendingStaffId = authReq.user?._id || req.body.attendingStaffId || '650000000000000000000001';
      const id = req.params.id as string;

      const {
        gestationalAgeWeeks,
        weightKg,
        bloodPressure,
        fundalHeightCm,
        fetalHeartRateBpm,
        fetalPosition,
        urineProtein,
        urineSugar,
        hemoglobinGdl,
        notes,
      } = req.body;

      const updated = await mchService.addAncVisit(id, hospitalId, {
        gestationalAgeWeeks,
        weightKg,
        bloodPressure,
        fundalHeightCm,
        fetalHeartRateBpm,
        fetalPosition,
        urineProtein,
        urineSugar,
        hemoglobinGdl,
        notes,
        attendingStaffId,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  public async recordDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;
      const deliveredBy = authReq.user?._id || req.body.deliveredBy || '650000000000000000000001';
      const id = req.params.id as string;

      const {
        deliveryDate,
        deliveryType,
        outcome,
        birthWeightKg,
        apgarScore1Min,
        apgarScore5Min,
        infantGender,
        complications,
        notes,
      } = req.body;

      const updated = await mchService.recordDelivery(id, hospitalId, {
        deliveryDate,
        deliveryType: deliveryType as DeliveryType,
        outcome: outcome as DeliveryOutcome,
        birthWeightKg,
        apgarScore1Min,
        apgarScore5Min,
        infantGender,
        complications,
        deliveredBy,
        notes,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  public async addImmunization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;
      const administeredBy = authReq.user?._id || req.body.administeredBy || '650000000000000000000001';
      const id = req.params.id as string;

      const { vaccineName, doseNumber, batchNumber, nextDueDate, notes } = req.body;

      const updated = await mchService.addImmunization(id, hospitalId, {
        vaccineName,
        doseNumber,
        administeredBy,
        batchNumber,
        nextDueDate,
        notes,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  public async addFamilyPlanning(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;
      const administeredBy = authReq.user?._id || req.body.administeredBy || '650000000000000000000001';
      const id = req.params.id as string;

      const { method, nextDueDate, sideEffects, notes } = req.body;

      const updated = await mchService.addFamilyPlanning(id, hospitalId, {
        method: method as FamilyPlanningMethod,
        nextDueDate,
        sideEffects,
        notes,
        administeredBy,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  public async addPartograph(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;
      const recordedBy = authReq.user?._id || req.body.recordedBy || '650000000000000000000001';
      const id = req.params.id as string;

      const { cervicalDilationCm, contractionFrequency, fetalHeartRateBpm, amnioticFluid, maternalBp, notes } = req.body;

      const updated = await mchService.addPartograph(id, hospitalId, {
        cervicalDilationCm,
        contractionFrequency,
        fetalHeartRateBpm,
        amnioticFluid,
        maternalBp,
        notes,
        recordedBy,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  public async addChildGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || req.body.hospitalId;
      const recordedBy = authReq.user?._id || req.body.recordedBy || '650000000000000000000001';
      const id = req.params.id as string;

      const { weightKg, heightCm, headCircumferenceCm, muacCm, milestonesNotes } = req.body;

      const updated = await mchService.addChildGrowth(id, hospitalId, {
        weightKg,
        heightCm,
        headCircumferenceCm,
        muacCm,
        milestonesNotes,
        recordedBy,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'MCH record not found' });
        return;
      }

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const hospitalId = authReq.user?.hospitalId || (req.query.hospitalId as string);

      if (!hospitalId) {
        res.status(400).json({ success: false, message: 'Hospital ID is required.' });
        return;
      }

      const stats = await mchService.getMchStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const mchController = new MchController();

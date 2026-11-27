import { Request, Response, NextFunction } from 'express';
import { supplyChainService } from './supply-chain.service.js';
import { WorkOrderStatus, FleetStatus } from './supply-chain.types.js';

export class SupplyChainController {
  // Biomedical
  public async createBiomedical(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const technicianId = (req as any).user?.userId || req.body.technicianId || '650000000000000000000001';
      const log = await supplyChainService.createBiomedicalLog({ ...req.body, hospitalId, technicianId });
      res.status(201).json({ success: true, message: 'Biomedical calibration log created.', data: log });
    } catch (error: any) {
      next(error);
    }
  }

  public async getBiomedical(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const logs = await supplyChainService.getBiomedicalLogs(hospitalId);
      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      next(error);
    }
  }

  // Work Orders
  public async createWorkOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const requestedBy = (req as any).user?.userId || req.body.requestedBy || '650000000000000000000001';
      const order = await supplyChainService.createWorkOrder({ ...req.body, hospitalId, requestedBy });
      res.status(201).json({ success: true, message: 'Work order created.', data: order });
    } catch (error: any) {
      next(error);
    }
  }

  public async getWorkOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const orders = await supplyChainService.getWorkOrders(hospitalId);
      res.status(200).json({ success: true, data: orders });
    } catch (error: any) {
      next(error);
    }
  }

  public async updateWorkOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const { status } = req.body;
      const updated = await supplyChainService.updateWorkOrderStatus(req.params.id, hospitalId, status as WorkOrderStatus);
      res.status(200).json({ success: true, message: 'Work order status updated.', data: updated });
    } catch (error: any) {
      next(error);
    }
  }

  // Laundry
  public async createLaundry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const handledBy = (req as any).user?.userId || req.body.handledBy || '650000000000000000000001';
      const log = await supplyChainService.createLaundryLog({ ...req.body, hospitalId, handledBy });
      res.status(201).json({ success: true, message: 'Laundry wash batch recorded.', data: log });
    } catch (error: any) {
      next(error);
    }
  }

  public async getLaundry(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const logs = await supplyChainService.getLaundryLogs(hospitalId);
      res.status(200).json({ success: true, data: logs });
    } catch (error: any) {
      next(error);
    }
  }

  // Waste
  public async createWaste(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const loggedBy = (req as any).user?.userId || req.body.loggedBy || '650000000000000000000001';
      const manifest = await supplyChainService.createWasteManifest({ ...req.body, hospitalId, loggedBy });
      res.status(201).json({ success: true, message: 'Biohazard waste manifest logged.', data: manifest });
    } catch (error: any) {
      next(error);
    }
  }

  public async getWaste(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const manifests = await supplyChainService.getWasteManifests(hospitalId);
      res.status(200).json({ success: true, data: manifests });
    } catch (error: any) {
      next(error);
    }
  }

  // Fleet
  public async createFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const vehicle = await supplyChainService.createFleetVehicle({ ...req.body, hospitalId });
      res.status(201).json({ success: true, message: 'Fleet vehicle registered.', data: vehicle });
    } catch (error: any) {
      next(error);
    }
  }

  public async getFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || (req.query.hospitalId as string);
      const vehicles = await supplyChainService.getFleetVehicles(hospitalId);
      res.status(200).json({ success: true, data: vehicles });
    } catch (error: any) {
      next(error);
    }
  }

  public async updateFleet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hospitalId = (req as any).user?.hospitalId || req.body.hospitalId;
      const { status, driverName } = req.body;
      const updated = await supplyChainService.updateFleetStatus(req.params.id, hospitalId, status as FleetStatus, driverName);
      res.status(200).json({ success: true, message: 'Fleet vehicle status updated.', data: updated });
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

      const stats = await supplyChainService.getSupplyChainStats(hospitalId);
      res.status(200).json({ success: true, data: stats });
    } catch (error: any) {
      next(error);
    }
  }
}

export const supplyChainController = new SupplyChainController();

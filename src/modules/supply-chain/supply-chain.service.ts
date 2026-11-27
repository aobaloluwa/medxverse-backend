import { Types } from 'mongoose';
import {
  BiomedicalLogModel,
  MaintenanceWorkOrderModel,
  LaundryLogModel,
  WasteManifestModel,
  FleetVehicleModel,
} from './supply-chain.model.js';
import {
  CreateBiomedicalLogInput,
  CreateWorkOrderInput,
  CreateLaundryLogInput,
  CreateWasteManifestInput,
  CreateFleetVehicleInput,
  IBiomedicalLogDocument,
  IMaintenanceWorkOrderDocument,
  ILaundryLogDocument,
  IWasteManifestDocument,
  IFleetVehicleDocument,
  WorkOrderStatus,
  FleetStatus,
} from './supply-chain.types.js';

export class SupplyChainService {
  // --- Biomedical ---
  public async createBiomedicalLog(input: CreateBiomedicalLogInput): Promise<IBiomedicalLogDocument> {
    const validMonths = input.validMonths || 6;
    const calibrationDate = new Date();
    const nextCalibrationDue = new Date(calibrationDate.getTime() + validMonths * 30 * 24 * 60 * 60 * 1000);

    return BiomedicalLogModel.create({
      ...input,
      technicianId: new Types.ObjectId(input.technicianId),
      calibrationDate,
      nextCalibrationDue,
    });
  }

  public async getBiomedicalLogs(hospitalId: string): Promise<IBiomedicalLogDocument[]> {
    return BiomedicalLogModel.find({ hospitalId })
      .populate('technicianId', 'firstName lastName role')
      .sort({ nextCalibrationDue: 1 })
      .limit(50)
      .exec();
  }

  // --- Work Orders ---
  public async createWorkOrder(input: CreateWorkOrderInput): Promise<IMaintenanceWorkOrderDocument> {
    return MaintenanceWorkOrderModel.create({
      ...input,
      requestedBy: new Types.ObjectId(input.requestedBy),
      status: WorkOrderStatus.OPEN,
    });
  }

  public async getWorkOrders(hospitalId: string): Promise<IMaintenanceWorkOrderDocument[]> {
    return MaintenanceWorkOrderModel.find({ hospitalId })
      .populate('requestedBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  public async updateWorkOrderStatus(
    id: string,
    hospitalId: string,
    status: WorkOrderStatus
  ): Promise<IMaintenanceWorkOrderDocument | null> {
    const update: Record<string, unknown> = { status };
    if (status === WorkOrderStatus.COMPLETED) {
      update.completedAt = new Date();
    }
    return MaintenanceWorkOrderModel.findOneAndUpdate({ _id: id, hospitalId }, { $set: update }, { new: true }).exec();
  }

  // --- Laundry ---
  public async createLaundryLog(input: CreateLaundryLogInput): Promise<ILaundryLogDocument> {
    return LaundryLogModel.create({
      ...input,
      handledBy: new Types.ObjectId(input.handledBy),
    });
  }

  public async getLaundryLogs(hospitalId: string): Promise<ILaundryLogDocument[]> {
    return LaundryLogModel.find({ hospitalId })
      .populate('handledBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Waste Manifest ---
  public async createWasteManifest(input: CreateWasteManifestInput): Promise<IWasteManifestDocument> {
    return WasteManifestModel.create({
      ...input,
      loggedBy: new Types.ObjectId(input.loggedBy),
      disposedAt: new Date(),
    });
  }

  public async getWasteManifests(hospitalId: string): Promise<IWasteManifestDocument[]> {
    return WasteManifestModel.find({ hospitalId })
      .populate('loggedBy', 'firstName lastName role')
      .sort({ disposedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Fleet ---
  public async createFleetVehicle(input: CreateFleetVehicleInput): Promise<IFleetVehicleDocument> {
    return FleetVehicleModel.create({
      ...input,
      status: FleetStatus.AVAILABLE,
    });
  }

  public async getFleetVehicles(hospitalId: string): Promise<IFleetVehicleDocument[]> {
    return FleetVehicleModel.find({ hospitalId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  public async updateFleetStatus(
    id: string,
    hospitalId: string,
    status: FleetStatus,
    driverName?: string
  ): Promise<IFleetVehicleDocument | null> {
    const update: Record<string, unknown> = { status };
    if (driverName !== undefined) update.driverName = driverName;
    return FleetVehicleModel.findOneAndUpdate({ _id: id, hospitalId }, { $set: update }, { new: true }).exec();
  }

  // --- Summary Stats ---
  public async getSupplyChainStats(hospitalId: string): Promise<{
    openWorkOrdersCount: number;
    dueCalibrationsCount: number;
    activeFleetCount: number;
    totalWasteWeightKg: number;
  }> {
    const [openWorkOrdersCount, dueCalibrationsCount, activeFleetCount, wasteAgg] = await Promise.all([
      MaintenanceWorkOrderModel.countDocuments({ hospitalId, status: { $ne: WorkOrderStatus.COMPLETED } }),
      BiomedicalLogModel.countDocuments({ hospitalId, nextCalibrationDue: { $gte: new Date() } }),
      FleetVehicleModel.countDocuments({ hospitalId, status: FleetStatus.AVAILABLE }),
      WasteManifestModel.aggregate([
        { $match: { hospitalId: new Types.ObjectId(hospitalId) } },
        { $group: { _id: null, totalWeight: { $sum: '$weightKg' } } },
      ]),
    ]);

    return {
      openWorkOrdersCount,
      dueCalibrationsCount,
      activeFleetCount,
      totalWasteWeightKg: wasteAgg[0]?.totalWeight || 0,
    };
  }
}

export const supplyChainService = new SupplyChainService();

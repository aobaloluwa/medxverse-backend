import { Schema, model } from 'mongoose';
import {
  IBiomedicalLogDocument,
  IMaintenanceWorkOrderDocument,
  ILaundryLogDocument,
  IWasteManifestDocument,
  IFleetVehicleDocument,
  WorkOrderPriority,
  WorkOrderStatus,
  LaundryStatus,
  WasteCategory,
  FleetStatus,
} from './supply-chain.types.js';

const BiomedicalLogSchema = new Schema<IBiomedicalLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment' },
    equipmentName: { type: String, required: true, trim: true },
    assetTag: { type: String, required: true, trim: true, uppercase: true },
    calibrationDate: { type: Date, default: Date.now, required: true },
    nextCalibrationDue: { type: Date, required: true, index: true },
    safetyTestPassed: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const MaintenanceWorkOrderSchema = new Schema<IMaintenanceWorkOrderDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    assetTag: { type: String, required: true, trim: true, uppercase: true },
    equipmentName: { type: String, required: true, trim: true },
    departmentName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: Object.values(WorkOrderPriority),
      default: WorkOrderPriority.MEDIUM,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WorkOrderStatus),
      default: WorkOrderStatus.OPEN,
      required: true,
      index: true,
    },
    assignedTechnicianName: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

const LaundryLogSchema = new Schema<ILaundryLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    wardId: { type: String, required: true, trim: true },
    linenCategory: { type: String, required: true, trim: true },
    piecesCount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(LaundryStatus),
      default: LaundryStatus.COLLECTED,
      required: true,
    },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const WasteManifestSchema = new Schema<IWasteManifestDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    category: {
      type: String,
      enum: Object.values(WasteCategory),
      default: WasteCategory.INFECTIOUS,
      required: true,
    },
    weightKg: { type: Number, required: true, min: 0.1 },
    disposalMethod: { type: String, required: true, trim: true },
    contractorName: { type: String, trim: true },
    loggedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    disposedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const FleetVehicleSchema = new Schema<IFleetVehicleDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    plateNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    vehicleType: {
      type: String,
      enum: ['AMBULANCE', 'VAN', 'UTILITY', 'PATIENT_TRANSPORT'],
      default: 'AMBULANCE',
      required: true,
    },
    modelName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(FleetStatus),
      default: FleetStatus.AVAILABLE,
      required: true,
      index: true,
    },
    driverName: { type: String, trim: true },
    fuelLevelPercent: { type: Number, default: 100, min: 0, max: 100 },
    lastServiceDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const BiomedicalLogModel = model<IBiomedicalLogDocument>('BiomedicalLog', BiomedicalLogSchema);
export const MaintenanceWorkOrderModel = model<IMaintenanceWorkOrderDocument>('MaintenanceWorkOrder', MaintenanceWorkOrderSchema);
export const LaundryLogModel = model<ILaundryLogDocument>('LaundryLog', LaundryLogSchema);
export const WasteManifestModel = model<IWasteManifestDocument>('WasteManifest', WasteManifestSchema);
export const FleetVehicleModel = model<IFleetVehicleDocument>('FleetVehicle', FleetVehicleSchema);

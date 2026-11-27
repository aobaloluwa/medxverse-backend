import { Document, Types } from 'mongoose';

export enum WorkOrderPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum WorkOrderStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum LaundryStatus {
  COLLECTED = 'COLLECTED',
  WASHING = 'WASHING',
  IRONED = 'IRONED',
  DELIVERED = 'DELIVERED',
}

export enum WasteCategory {
  INFECTIOUS = 'INFECTIOUS',
  SHARPS = 'SHARPS',
  CHEMICAL = 'CHEMICAL',
  PHARMACEUTICAL = 'PHARMACEUTICAL',
  GENERAL = 'GENERAL',
}

export enum FleetStatus {
  AVAILABLE = 'AVAILABLE',
  ON_MISSION = 'ON_MISSION',
  SERVICE = 'SERVICE',
  RETIRED = 'RETIRED',
}

export interface IBiomedicalLog {
  hospitalId: Types.ObjectId;
  equipmentId?: Types.ObjectId;
  equipmentName: string;
  assetTag: string;
  calibrationDate: Date;
  nextCalibrationDue: Date;
  safetyTestPassed: boolean;
  notes?: string;
  technicianId: Types.ObjectId;
}

export interface IBiomedicalLogDocument extends IBiomedicalLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IMaintenanceWorkOrder {
  hospitalId: Types.ObjectId;
  assetTag: string;
  equipmentName: string;
  departmentName: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignedTechnicianName?: string;
  requestedBy: Types.ObjectId;
  completedAt?: Date;
}

export interface IMaintenanceWorkOrderDocument extends IMaintenanceWorkOrder, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILaundryLog {
  hospitalId: Types.ObjectId;
  wardId: string;
  linenCategory: string;
  piecesCount: number;
  status: LaundryStatus;
  handledBy: Types.ObjectId;
}

export interface ILaundryLogDocument extends ILaundryLog, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IWasteManifest {
  hospitalId: Types.ObjectId;
  category: WasteCategory;
  weightKg: number;
  disposalMethod: string;
  contractorName?: string;
  loggedBy: Types.ObjectId;
  disposedAt: Date;
}

export interface IWasteManifestDocument extends IWasteManifest, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IFleetVehicle {
  hospitalId: Types.ObjectId;
  plateNumber: string;
  vehicleType: 'AMBULANCE' | 'VAN' | 'UTILITY' | 'PATIENT_TRANSPORT';
  modelName: string;
  status: FleetStatus;
  driverName?: string;
  fuelLevelPercent?: number;
  lastServiceDate?: Date;
  notes?: string;
}

export interface IFleetVehicleDocument extends IFleetVehicle, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBiomedicalLogInput {
  hospitalId: string;
  equipmentId?: string;
  equipmentName: string;
  assetTag: string;
  calibrationDate: Date;
  validMonths?: number;
  safetyTestPassed?: boolean;
  notes?: string;
  technicianId: string;
}

export interface CreateWorkOrderInput {
  hospitalId: string;
  assetTag: string;
  equipmentName: string;
  departmentName: string;
  description: string;
  priority?: WorkOrderPriority;
  assignedTechnicianName?: string;
  requestedBy: string;
}

export interface CreateLaundryLogInput {
  hospitalId: string;
  wardId: string;
  linenCategory: string;
  piecesCount: number;
  handledBy: string;
}

export interface CreateWasteManifestInput {
  hospitalId: string;
  category: WasteCategory;
  weightKg: number;
  disposalMethod: string;
  contractorName?: string;
  loggedBy: string;
}

export interface CreateFleetVehicleInput {
  hospitalId: string;
  plateNumber: string;
  vehicleType: 'AMBULANCE' | 'VAN' | 'UTILITY' | 'PATIENT_TRANSPORT';
  modelName: string;
  driverName?: string;
  fuelLevelPercent?: number;
  notes?: string;
}

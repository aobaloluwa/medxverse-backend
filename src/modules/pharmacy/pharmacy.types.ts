import { Document, Types } from 'mongoose';

export enum DrugCategory {
  ANTIBIOTICS = 'ANTIBIOTICS',
  ANALGESICS = 'ANALGESICS',
  ANTIHYPERTENSIVES = 'ANTIHYPERTENSIVES',
  ANTIDIABETICS = 'ANTIDIABETICS',
  VITAMINS = 'VITAMINS',
  ICU_CRITICAL = 'ICU_CRITICAL',
  CONTROLLED = 'CONTROLLED',
  OTHER = 'OTHER',
}

export enum UnitOfMeasure {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  VIAL = 'VIAL',
  AMPOULE = 'AMPOULE',
  BOTTLE = 'BOTTLE',
  PACK = 'PACK',
  PIECE = 'PIECE',
  ML = 'ML',
  MG = 'MG',
  BOX = 'BOX',
}

export enum PrescriptionStatus {
  RECEIVED = 'RECEIVED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SCREENING_REQUIRED = 'SCREENING_REQUIRED',
  APPROVED = 'APPROVED',
  PARTIALLY_DISPENSED = 'PARTIALLY_DISPENSED',
  DISPENSED = 'DISPENSED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum DispenseStatus {
  PENDING = 'PENDING',
  DISPENSED = 'DISPENSED',
  PARTIALLY_DISPENSED = 'PARTIALLY_DISPENSED',
  CANCELLED = 'CANCELLED',
}

export enum PrescriptionSource {
  CPOE = 'CPOE',
  EMAR = 'EMAR',
  EHR = 'EHR',
  CLINICIAN_ORDER = 'CLINICIAN_ORDER',
  TELEMEDICINE = 'TELEMEDICINE',
  PHARMACY = 'PHARMACY',
}

export enum ScreeningStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  WARNING = 'WARNING',
  BLOCKED = 'BLOCKED',
}

export enum FormularyStatus {
  APPROVED = 'APPROVED',
  RESTRICTED = 'RESTRICTED',
  NON_FORMULARY = 'NON_FORMULARY',
  INACTIVE = 'INACTIVE',
}

export enum InventoryTransactionType {
  RECEIPT = 'RECEIPT',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  DISPENSE = 'DISPENSE',
  RETURN = 'RETURN',
  WASTE = 'WASTE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
}

export enum ControlledSubstanceAction {
  DISPENSE = 'DISPENSE',
  RETURN = 'RETURN',
  WASTE = 'WASTE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PharmacyBillingStatus {
  NOT_ATTEMPTED = 'NOT_ATTEMPTED',
  CAPTURED = 'CAPTURED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

export interface IInventoryItem {
  hospitalId: Types.ObjectId;
  name: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  category: DrugCategory;
  batchNumber: string;
  barcode?: string;
  gtin?: string;
  manufacturer?: string;
  unitPrice: number;
  billingCode?: string;
  pricingCatalogueItemId?: Types.ObjectId;
  quantityInStock: number;
  reorderLevel: number;
  unitOfMeasure: UnitOfMeasure;
  expiryDate: Date;
  storageLocation?: string;
  controlledSubstance: boolean;
  scheduleClass?: string;
  isLowStock: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface IInventoryItemDocument extends IInventoryItem, Document { _id: Types.ObjectId; }

export interface CreateInventoryItemDTO {
  name: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  category: DrugCategory;
  batchNumber: string;
  barcode?: string;
  gtin?: string;
  manufacturer?: string;
  unitPrice: number;
  billingCode?: string;
  pricingCatalogueItemId?: string;
  quantityInStock: number;
  reorderLevel?: number;
  unitOfMeasure: UnitOfMeasure;
  expiryDate: string;
  storageLocation?: string;
  controlledSubstance?: boolean;
  scheduleClass?: string;
}

export interface UpdateStockDTO {
  quantityChange: number;
  reason: string;
  transactionType?: InventoryTransactionType;
}

export interface IInventoryTransaction {
  hospitalId: Types.ObjectId;
  inventoryItemId: Types.ObjectId;
  type: InventoryTransactionType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  referenceType?: string;
  referenceId?: Types.ObjectId;
  performedBy: Types.ObjectId;
  reason: string;
  createdAt: Date;
}
export interface IInventoryTransactionDocument extends IInventoryTransaction, Document { _id: Types.ObjectId; }

export interface IPrescriptionMedication {
  inventoryItemId?: Types.ObjectId;
  medicationName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity: number;
  unitOfMeasure?: UnitOfMeasure;
  instructions?: string;
  barcode?: string;
  substitutionAllowed?: boolean;
}

export interface IPrescription {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  prescriberId?: Types.ObjectId;
  prescriberName?: string;
  prescriptionNumber: string;
  source: PrescriptionSource;
  sourceRecordId?: Types.ObjectId;
  sourceSystem?: string;
  department?: string;
  encounterId?: Types.ObjectId;
  status: PrescriptionStatus;
  medications: IPrescriptionMedication[];
  screeningStatus: ScreeningStatus;
  screeningSummary?: string;
  requestedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  cancelledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface IPrescriptionDocument extends IPrescription, Document { _id: Types.ObjectId; }

export interface CreatePrescriptionDTO {
  patientId: string;
  prescriberId?: string;
  prescriberName?: string;
  source: PrescriptionSource;
  sourceRecordId?: string;
  sourceSystem?: string;
  department?: string;
  encounterId?: string;
  medications: Array<Omit<IPrescriptionMedication, 'inventoryItemId'> & { inventoryItemId?: string }>;
  notes?: string;
}

export interface ScreeningIssue {
  code: string;
  severity: 'INFO' | 'WARNING' | 'BLOCK';
  message: string;
  medicationIndex?: number;
}

export interface ScreeningResult {
  status: ScreeningStatus;
  issues: ScreeningIssue[];
  checkedAt: Date;
}

export interface IFormularyEntry {
  hospitalId: Types.ObjectId;
  department?: string;
  medicationName: string;
  genericName?: string;
  inventoryItemId?: Types.ObjectId;
  status: FormularyStatus;
  substitutionAllowed: boolean;
  substituteInventoryItemIds: Types.ObjectId[];
  restrictions?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface IFormularyEntryDocument extends IFormularyEntry, Document { _id: Types.ObjectId; }

export interface CreateFormularyEntryDTO {
  department?: string;
  medicationName: string;
  genericName?: string;
  inventoryItemId?: string;
  status?: FormularyStatus;
  substitutionAllowed?: boolean;
  substituteInventoryItemIds?: string[];
  restrictions?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface IDispenseItem {
  prescriptionMedicationIndex: number;
  inventoryItemId: Types.ObjectId;
  quantity: number;
  barcodeScanned: string;
  barcodeVerified: boolean;
  unitPrice: number;
  totalPrice: number;
  billingCode?: string;
  pricingCatalogueItemId?: Types.ObjectId;
  pricingCataloguePlanName?: string;
  pricingCataloguePrice?: number;
  pricingCatalogueCurrency?: string;
  pricingCatalogueVersion?: number;
  billingChargeId?: Types.ObjectId;
  billingUnitPrice?: number;
  billingCurrency?: string;
  billingCatalogueVersion?: number;
  billingError?: string;
}

export interface IDispenseRecord {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  prescriptionId: Types.ObjectId;
  encounterId?: Types.ObjectId;
  consultationId?: Types.ObjectId;
  dispensedBy: Types.ObjectId;
  secondVerifierId?: Types.ObjectId;
  items: IDispenseItem[];
  totalAmount: number;
  status: DispenseStatus;
  screeningStatus: ScreeningStatus;
  emarReferenceId?: Types.ObjectId;
  notes?: string;
  billingStatus: PharmacyBillingStatus;
  billingChargeId?: Types.ObjectId;
  billingChargeIds: Types.ObjectId[];
  billingErrors: string[];
  billingCapturedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
export interface IDispenseRecordDocument extends IDispenseRecord, Document { _id: Types.ObjectId; }

export interface CreateDispenseRecordDTO {
  prescriptionId: string;
  items: Array<{
    prescriptionMedicationIndex: number;
    inventoryItemId: string;
    quantity: number;
    barcodeScanned: string;
  }>;
  secondVerifierId?: string;
  emarReferenceId?: string;
  notes?: string;
}

export interface IControlledSubstanceLog {
  hospitalId: Types.ObjectId;
  action: ControlledSubstanceAction;
  prescriptionId?: Types.ObjectId;
  dispenseRecordId?: Types.ObjectId;
  inventoryItemId: Types.ObjectId;
  patientId?: Types.ObjectId;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  performedBy: Types.ObjectId;
  secondVerifierId?: Types.ObjectId;
  reason: string;
  immutableHash: string;
  createdAt: Date;
}
export interface IControlledSubstanceLogDocument extends IControlledSubstanceLog, Document { _id: Types.ObjectId; }

export interface INoShowRiskPlaceholder { _id?: Types.ObjectId; }

export interface GetInventoryQueryDTO {
  search?: string;
  category?: DrugCategory;
  isLowStock?: string;
  controlledSubstance?: string;
  page?: string;
  limit?: string;
}
export interface GetDispenseQueryDTO {
  patientId?: string;
  prescriptionId?: string;
  status?: DispenseStatus;
  billingStatus?: PharmacyBillingStatus;
  page?: string;
  limit?: string;
}
export interface GetPrescriptionQueryDTO {
  patientId?: string;
  status?: PrescriptionStatus;
  page?: string;
  limit?: string;
}
export interface GetFormularyQueryDTO {
  department?: string;
  status?: FormularyStatus;
  search?: string;
  page?: string;
  limit?: string;
}
export interface CreateStockTransactionDTO {
  inventoryItemId: string;
  quantity: number;
  type: InventoryTransactionType;
  reason: string;
}

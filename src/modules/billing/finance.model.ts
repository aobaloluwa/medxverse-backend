import { Schema, model, Document, Types } from 'mongoose';

export enum ExpenseCategory {
  MEDICAL_SUPPLIES = 'MEDICAL_SUPPLIES',
  UTILITIES = 'UTILITIES',
  MAINTENANCE = 'MAINTENANCE',
  OXYGEN_REFILLS = 'OXYGEN_REFILLS',
  EQUIPMENT = 'EQUIPMENT',
  PHARMACY_STOCK = 'PHARMACY_STOCK',
  LAB_REAGENTS = 'LAB_REAGENTS',
  CATERING_FOOD = 'CATERING_FOOD',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  OTHER = 'OTHER',
}

export enum ExpenseStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}

export interface IExpenseVoucher {
  hospitalId: Types.ObjectId;
  voucherNumber: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: string;
  vendorName: string;
  status: ExpenseStatus;
  notes?: string;
  approvedBy?: Types.ObjectId;
  requestedBy: Types.ObjectId;
  expenseDate: Date;
}

export interface IExpenseVoucherDocument extends IExpenseVoucher, Document {
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseVoucherSchema = new Schema<IExpenseVoucherDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    voucherNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: Object.values(ExpenseCategory),
      default: ExpenseCategory.OTHER,
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: 'BANK_TRANSFER', trim: true },
    vendorName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ExpenseStatus),
      default: ExpenseStatus.PENDING,
      required: true,
      index: true,
    },
    notes: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expenseDate: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

ExpenseVoucherSchema.index({ hospitalId: 1, status: 1, expenseDate: -1 });

export interface IPayrollRecord {
  hospitalId: Types.ObjectId;
  monthYear: string; // e.g. "2025-03"
  staffId: Types.ObjectId;
  staffName: string;
  designation: string;
  baseSalary: number;
  hazardAllowance?: number;
  callDutyAllowance?: number;
  transportAllowance?: number;
  taxDeductions?: number;
  pensionDeductions?: number;
  netSalary: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paidAt?: Date;
  approvedBy?: Types.ObjectId;
}

export interface IPayrollRecordDocument extends IPayrollRecord, Document {
  createdAt: Date;
  updatedAt: Date;
}

const PayrollRecordSchema = new Schema<IPayrollRecordDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    monthYear: { type: String, required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    staffName: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    baseSalary: { type: Number, required: true, min: 0 },
    hazardAllowance: { type: Number, default: 0 },
    callDutyAllowance: { type: Number, default: 0 },
    transportAllowance: { type: Number, default: 0 },
    taxDeductions: { type: Number, default: 0 },
    pensionDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'PAID'], default: 'DRAFT', required: true },
    paidAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PayrollRecordSchema.index({ hospitalId: 1, monthYear: 1 });

export interface IDepositWaiver {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  type: 'DEPOSIT' | 'DISCOUNT' | 'WAIVER';
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: Types.ObjectId;
  requestedBy: Types.ObjectId;
}

export interface IDepositWaiverDocument extends IDepositWaiver, Document {
  createdAt: Date;
  updatedAt: Date;
}

const DepositWaiverSchema = new Schema<IDepositWaiverDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    type: { type: String, enum: ['DEPOSIT', 'DISCOUNT', 'WAIVER'], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

DepositWaiverSchema.index({ hospitalId: 1, patientId: 1 });

export const ExpenseVoucherModel = model<IExpenseVoucherDocument>('ExpenseVoucher', ExpenseVoucherSchema);
export const PayrollRecordModel = model<IPayrollRecordDocument>('PayrollRecord', PayrollRecordSchema);
export const DepositWaiverModel = model<IDepositWaiverDocument>('DepositWaiver', DepositWaiverSchema);

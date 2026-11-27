import { Types } from 'mongoose';
import {
  ExpenseVoucherModel,
  PayrollRecordModel,
  DepositWaiverModel,
  ExpenseCategory,
  ExpenseStatus,
  IExpenseVoucherDocument,
  IPayrollRecordDocument,
  IDepositWaiverDocument,
} from './finance.model.js';
import { ChargeModel, PaymentModel } from './billing.model.js';

export class FinanceService {
  private generateVoucherNumber(): string {
    const chars = '0123456789';
    let code = 'EXP-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // --- Expenses ---
  public async createExpense(data: {
    hospitalId: string;
    title: string;
    category: ExpenseCategory;
    amount: number;
    paymentMethod?: string;
    vendorName: string;
    notes?: string;
    requestedBy: string;
  }): Promise<IExpenseVoucherDocument> {
    const voucherNumber = this.generateVoucherNumber();
    return ExpenseVoucherModel.create({
      ...data,
      voucherNumber,
      status: ExpenseStatus.APPROVED,
      expenseDate: new Date(),
    });
  }

  public async getExpenses(hospitalId: string): Promise<IExpenseVoucherDocument[]> {
    return ExpenseVoucherModel.find({ hospitalId })
      .populate('requestedBy', 'firstName lastName role')
      .sort({ expenseDate: -1 })
      .limit(50)
      .exec();
  }

  // --- Payroll ---
  public async createPayroll(data: {
    hospitalId: string;
    monthYear: string;
    staffId: string;
    staffName: string;
    designation: string;
    baseSalary: number;
    hazardAllowance?: number;
    callDutyAllowance?: number;
    transportAllowance?: number;
    taxDeductions?: number;
    pensionDeductions?: number;
  }): Promise<IPayrollRecordDocument> {
    const gross = data.baseSalary + (data.hazardAllowance || 0) + (data.callDutyAllowance || 0) + (data.transportAllowance || 0);
    const deductions = (data.taxDeductions || 0) + (data.pensionDeductions || 0);
    const netSalary = Math.max(0, gross - deductions);

    return PayrollRecordModel.create({
      ...data,
      netSalary,
      status: 'APPROVED',
      paidAt: new Date(),
    });
  }

  public async getPayroll(hospitalId: string, monthYear?: string): Promise<IPayrollRecordDocument[]> {
    const filter: Record<string, unknown> = { hospitalId };
    if (monthYear) filter.monthYear = monthYear;

    return PayrollRecordModel.find(filter)
      .populate('staffId', 'firstName lastName role department')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Deposits / Waivers ---
  public async createWaiverOrDeposit(data: {
    hospitalId: string;
    patientId: string;
    type: 'DEPOSIT' | 'DISCOUNT' | 'WAIVER';
    amount: number;
    reason: string;
    requestedBy: string;
  }): Promise<IDepositWaiverDocument> {
    return DepositWaiverModel.create({
      ...data,
      status: 'APPROVED',
    });
  }

  public async getWaivers(hospitalId: string): Promise<IDepositWaiverDocument[]> {
    return DepositWaiverModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // --- General Ledger & Finance Summary ---
  public async getFinanceSummary(hospitalId: string): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    totalPayrollPaid: number;
    netProfit: number;
    departmentRevenue: Record<string, number>;
  }> {
    const [payments, expenses, payrolls, departmentCharges] = await Promise.all([
      PaymentModel.aggregate([
        { $match: { hospitalId: new Types.ObjectId(hospitalId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      ExpenseVoucherModel.aggregate([
        { $match: { hospitalId: new Types.ObjectId(hospitalId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PayrollRecordModel.aggregate([
        { $match: { hospitalId: new Types.ObjectId(hospitalId) } },
        { $group: { _id: null, total: { $sum: '$netSalary' } } },
      ]),
      ChargeModel.aggregate([
        { $match: { hospitalId: new Types.ObjectId(hospitalId) } },
        { $group: { _id: '$category', total: { $sum: '$netAmount' } } },
      ]),
    ]);

    const totalRevenue = payments[0]?.total || 0;
    const totalExpenses = expenses[0]?.total || 0;
    const totalPayrollPaid = payrolls[0]?.total || 0;
    const netProfit = totalRevenue - (totalExpenses + totalPayrollPaid);

    const departmentRevenue: Record<string, number> = {};
    departmentCharges.forEach((item: any) => {
      if (item._id) {
        departmentRevenue[item._id] = item.total;
      }
    });

    return {
      totalRevenue,
      totalExpenses,
      totalPayrollPaid,
      netProfit,
      departmentRevenue,
    };
  }
}

export const financeService = new FinanceService();

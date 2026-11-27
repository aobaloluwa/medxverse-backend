import { Request, Response } from 'express';

import * as BillingService from './billing.service.js';
import { financeService } from './finance.service.js';

const userId = (req: Request) => {
  const user = (req as any).user;

  return user?._id || user?.id || user?.staffId;
};

const hospitalId = (req: Request) => {
  const user = (req as any).user;

  const id =
    user?.hospitalId ||
    user?.hospital?._id ||
    req.body?.hospitalId ||
    req.query?.hospitalId;

  if (!id) {
    throw new Error('Hospital ID is required.');
  }

  return String(id);
};

const fail = (res: Response, error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  const lower = message.toLowerCase();

  const status =
    lower.includes('not found')
      ? 404
      : lower.includes('already') ||
          lower.includes('duplicate') ||
          lower.includes('e11000')
        ? 409
        : 400;

  return res.status(status).json({
    success: false,
    message,
  });
};

/* =========================================================
   ACCOUNTS
========================================================= */

export const createBillingAccount = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(201).json({
      success: true,
      message: 'Billing account created successfully.',
      data: await BillingService.createBillingAccount(
        {
          ...req.body,
          hospitalId: req.body?.hospitalId || hospitalId(req),
        },
        userId(req)
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getBillingAccount = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getBillingAccount(req.params.id),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getPatientBillingAccount = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getPatientBillingAccount(
        hospitalId(req),
        req.params.patientId
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getPatientBilling = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getPatientBilling(
        hospitalId(req),
        req.params.patientId
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

/* =========================================================
   PRICING CATALOGUE
========================================================= */

export const createPricingCatalogueItem = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(201).json({
      success: true,
      message: 'Pricing catalogue item created successfully.',
      data: await BillingService.createPricingCatalogueItem(
        {
          ...req.body,
          hospitalId: req.body?.hospitalId || hospitalId(req),
        },
        userId(req)
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getAvailablePricingCatalogues = async (
  req: Request,
  res: Response
) => {
  try {
    const rawDepartmentName =
      req.query.departmentName ?? req.query.department;
    const departmentName =
      typeof rawDepartmentName === 'string'
        ? rawDepartmentName.trim()
        : undefined;

    const departmentId =
      typeof req.query.departmentId === 'string'
        ? req.query.departmentId.trim()
        : undefined;

    if (!departmentName && !departmentId) {
      throw new Error('departmentName or departmentId is required.');
    }

    return res.json({
      success: true,
      data: await BillingService.getPricingCatalogue(
        hospitalId(req),
        {
          ...(req.query as Record<string, unknown>),
          departmentName: departmentName || undefined,
          departmentId: departmentId || undefined,
          activeOnly: true,
        }
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getPricingCatalogue = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getPricingCatalogue(
        hospitalId(req),
        req.query as any
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const updatePricingCatalogueItem = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      message: 'Pricing catalogue item updated successfully.',
      data: await BillingService.updatePricingCatalogueItem(
        req.params.id,
        req.body,
        userId(req)
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const resolvePrice = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.resolvePrice({
        ...req.body,
        hospitalId: req.body?.hospitalId || hospitalId(req),
      }),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getPricingCatalogueHistory = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getPricingCatalogueHistory(
        req.params.id
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

/* =========================================================
   CHARGES
========================================================= */

export const createCharge = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(201).json({
      success: true,
      message: 'Charge posted successfully.',
      data: await BillingService.createCharge({
        ...req.body,
        hospitalId: req.body?.hospitalId || hospitalId(req),
        chargedBy: req.body?.chargedBy || userId(req),
      }),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getCharges = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getCharges(
        hospitalId(req),
        req.query as any
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

/* =========================================================
   PAYMENTS
========================================================= */

export const createPayment = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      data: await BillingService.createPayment({
        ...req.body,
        hospitalId: req.body?.hospitalId || hospitalId(req),
        receivedBy: req.body?.receivedBy || userId(req),
      }),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getPayments = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getPayments(
        hospitalId(req),
        req.query as any
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const reconcilePayment = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      message: 'Payment reconciliation updated successfully.',
      data: await BillingService.reconcilePayment(
        req.params.id,
        {
          ...req.body,
          reconciledBy:
            req.body?.reconciledBy || userId(req),
        }
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

/* =========================================================
   REFUNDS
========================================================= */

export const getRefunds = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getRefunds(
        hospitalId(req),
        req.query as any
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const createRefund = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(201).json({
      success: true,
      message: 'Refund request created successfully.',
      data: await BillingService.createRefund({
        ...req.body,
        hospitalId: req.body?.hospitalId || hospitalId(req),
        requestedBy:
          req.body?.requestedBy || userId(req),
      }),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const decideRefund = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      message: req.body?.approved
        ? 'Refund approved.'
        : 'Refund rejected.',
      data: await BillingService.decideRefund(
        req.params.id,
        Boolean(req.body?.approved),
        userId(req),
        req.body?.rejectionReason
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const completeRefund = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      message: 'Refund completed successfully.',
      data: await BillingService.completeRefund(
        req.params.id
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

/* =========================================================
   PAYMENT PLANS
========================================================= */

export const getPaymentPlans = async (
  req: Request,
  res: Response
) => {
  try {
    return res.json({
      success: true,
      data: await BillingService.getPaymentPlans(
        hospitalId(req),
        req.query as any
      ),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const createPaymentPlan = async (
  req: Request,
  res: Response
) => {
  try {
    return res.status(201).json({
      success: true,
      message: 'Payment plan created successfully.',
      data: await BillingService.createPaymentPlan({
        ...req.body,
        hospitalId: req.body?.hospitalId || hospitalId(req),
        createdBy: req.body?.createdBy || userId(req),
      }),
    });
  } catch (error) {
    return fail(res, error);
  }
};

/* =========================================================
   FINANCE, EXPENSES & PAYROLL
========================================================= */

export const createExpense = async (req: Request, res: Response) => {
  try {
    const data = await financeService.createExpense({
      ...req.body,
      hospitalId: hospitalId(req),
      requestedBy: userId(req),
    });
    return res.status(201).json({ success: true, message: 'Expense voucher logged.', data });
  } catch (error) {
    return fail(res, error);
  }
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const data = await financeService.getExpenses(hospitalId(req));
    return res.json({ success: true, data });
  } catch (error) {
    return fail(res, error);
  }
};

export const createPayroll = async (req: Request, res: Response) => {
  try {
    const data = await financeService.createPayroll({
      ...req.body,
      hospitalId: hospitalId(req),
    });
    return res.status(201).json({ success: true, message: 'Payroll record created.', data });
  } catch (error) {
    return fail(res, error);
  }
};

export const getPayroll = async (req: Request, res: Response) => {
  try {
    const data = await financeService.getPayroll(hospitalId(req), req.query.monthYear as string);
    return res.json({ success: true, data });
  } catch (error) {
    return fail(res, error);
  }
};

export const createWaiver = async (req: Request, res: Response) => {
  try {
    const data = await financeService.createWaiverOrDeposit({
      ...req.body,
      hospitalId: hospitalId(req),
      requestedBy: userId(req),
    });
    return res.status(201).json({ success: true, message: 'Deposit/Waiver created.', data });
  } catch (error) {
    return fail(res, error);
  }
};

export const getWaivers = async (req: Request, res: Response) => {
  try {
    const data = await financeService.getWaivers(hospitalId(req));
    return res.json({ success: true, data });
  } catch (error) {
    return fail(res, error);
  }
};

export const getFinanceSummary = async (req: Request, res: Response) => {
  try {
    const data = await financeService.getFinanceSummary(hospitalId(req));
    return res.json({ success: true, data });
  } catch (error) {
    return fail(res, error);
  }
};
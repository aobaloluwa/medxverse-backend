import { Router } from 'express';

import * as controller from './billing.controller.js';
import { protect } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(protect);

/* =========================================================
   BILLING ACCOUNTS
========================================================= */

router.post(
  '/accounts',
  controller.createBillingAccount
);

router.get(
  '/accounts/:id',
  controller.getBillingAccount
);

router.get(
  '/patients/:patientId/account',
  controller.getPatientBillingAccount
);

router.get(
  '/patients/:patientId',
  controller.getPatientBilling
);

/* =========================================================
   PRICING CATALOGUE
========================================================= */

router.post(
  '/catalogue',
  controller.createPricingCatalogueItem
);

router.get(
  '/catalogue',
  controller.getPricingCatalogue
);

router.get(
  '/catalogue/available',
  controller.getAvailablePricingCatalogues
);

router.post(
  '/catalogue/resolve-price',
  controller.resolvePrice
);

router.get(
  '/catalogue/:id/history',
  controller.getPricingCatalogueHistory
);

router.patch(
  '/catalogue/:id',
  controller.updatePricingCatalogueItem
);

/* =========================================================
   CHARGES
========================================================= */

router.post(
  '/charges',
  controller.createCharge
);

router.get(
  '/charges',
  controller.getCharges
);

/* =========================================================
   PAYMENTS / RECEIPTS
========================================================= */

router.post(
  '/payments',
  controller.createPayment
);

router.get(
  '/payments',
  controller.getPayments
);

router.patch(
  '/payments/:id/reconcile',
  controller.reconcilePayment
);

/* =========================================================
   REFUNDS
========================================================= */

router.get(
  '/refunds',
  controller.getRefunds
);

router.post(
  '/refunds',
  controller.createRefund
);

router.patch(
  '/refunds/:id/decision',
  controller.decideRefund
);

router.post(
  '/refunds/:id/complete',
  controller.completeRefund
);

/* =========================================================
   PAYMENT PLANS
========================================================= */

router.get(
  '/payment-plans',
  controller.getPaymentPlans
);

router.post(
  '/payment-plans',
  controller.createPaymentPlan
);

/* =========================================================
   FINANCE, EXPENSES & PAYROLL
========================================================= */

router.get('/expenses', controller.getExpenses);
router.post('/expenses', controller.createExpense);

router.get('/payroll', controller.getPayroll);
router.post('/payroll', controller.createPayroll);

router.get('/waivers', controller.getWaivers);
router.post('/waivers', controller.createWaiver);

router.get('/finance-summary', controller.getFinanceSummary);

export default router;
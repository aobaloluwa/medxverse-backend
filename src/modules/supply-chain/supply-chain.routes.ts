import { Router } from 'express';
import { supplyChainController } from './supply-chain.controller.js';

const router = Router();

router.get('/stats', (req, res, next) => supplyChainController.getStats(req, res, next));

router.post('/biomedical', (req, res, next) => supplyChainController.createBiomedical(req, res, next));
router.get('/biomedical', (req, res, next) => supplyChainController.getBiomedical(req, res, next));

router.post('/work-orders', (req, res, next) => supplyChainController.createWorkOrder(req, res, next));
router.get('/work-orders', (req, res, next) => supplyChainController.getWorkOrders(req, res, next));
router.patch('/work-orders/:id/status', (req, res, next) => supplyChainController.updateWorkOrder(req, res, next));

router.post('/laundry', (req, res, next) => supplyChainController.createLaundry(req, res, next));
router.get('/laundry', (req, res, next) => supplyChainController.getLaundry(req, res, next));

router.post('/waste', (req, res, next) => supplyChainController.createWaste(req, res, next));
router.get('/waste', (req, res, next) => supplyChainController.getWaste(req, res, next));

router.post('/fleet', (req, res, next) => supplyChainController.createFleet(req, res, next));
router.get('/fleet', (req, res, next) => supplyChainController.getFleet(req, res, next));
router.patch('/fleet/:id/status', (req, res, next) => supplyChainController.updateFleet(req, res, next));

export default router;

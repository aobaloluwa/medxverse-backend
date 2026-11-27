import { Router } from 'express';
import { diagnosticsSupportController } from './diagnostics-support.controller.js';

const router = Router();

router.get('/stats', (req, res, next) => diagnosticsSupportController.getStats(req, res, next));

router.post('/pathology', (req, res, next) => diagnosticsSupportController.createPathology(req, res, next));
router.get('/pathology', (req, res, next) => diagnosticsSupportController.getPathology(req, res, next));

router.post('/cardiac', (req, res, next) => diagnosticsSupportController.createCardiac(req, res, next));
router.get('/cardiac', (req, res, next) => diagnosticsSupportController.getCardiac(req, res, next));

router.post('/cssd', (req, res, next) => diagnosticsSupportController.createCssd(req, res, next));
router.get('/cssd', (req, res, next) => diagnosticsSupportController.getCssd(req, res, next));

router.post('/ipc', (req, res, next) => diagnosticsSupportController.createIpc(req, res, next));
router.get('/ipc', (req, res, next) => diagnosticsSupportController.getIpc(req, res, next));

router.post('/mortuary', (req, res, next) => diagnosticsSupportController.createMortuary(req, res, next));
router.get('/mortuary', (req, res, next) => diagnosticsSupportController.getMortuary(req, res, next));
router.patch('/mortuary/:id/release', (req, res, next) => diagnosticsSupportController.releaseMortuaryBody(req, res, next));

export default router;

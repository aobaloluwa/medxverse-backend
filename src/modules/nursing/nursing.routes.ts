import { Router } from 'express';
import { nursingController } from './nursing.controller.js';

const router = Router();

router.get('/station-summary', (req, res, next) => nursingController.getStationSummary(req, res, next));
router.post('/mar', (req, res, next) => nursingController.createMarLog(req, res, next));
router.get('/mar', (req, res, next) => nursingController.getMarLogs(req, res, next));
router.patch('/mar/:id/status', (req, res, next) => nursingController.updateMarStatus(req, res, next));

router.post('/notes', (req, res, next) => nursingController.createNursingNote(req, res, next));
router.get('/notes', (req, res, next) => nursingController.getNursingNotes(req, res, next));

router.post('/fluid-balance', (req, res, next) => nursingController.createFluidBalance(req, res, next));
router.get('/fluid-balance/:patientId', (req, res, next) => nursingController.getFluidBalance(req, res, next));

export default router;

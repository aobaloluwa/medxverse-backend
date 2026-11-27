import { Router } from 'express';
import { mchController } from './mch.controller.js';

const router = Router();

router.get('/stats', (req, res, next) => mchController.getStats(req, res, next));
router.post('/', (req, res, next) => mchController.createRecord(req, res, next));
router.get('/', (req, res, next) => mchController.getRecords(req, res, next));
router.get('/:id', (req, res, next) => mchController.getRecordById(req, res, next));
router.post('/:id/anc-visits', (req, res, next) => mchController.addAncVisit(req, res, next));
router.post('/:id/delivery', (req, res, next) => mchController.recordDelivery(req, res, next));
router.post('/:id/immunizations', (req, res, next) => mchController.addImmunization(req, res, next));
router.post('/:id/family-planning', (req, res, next) => mchController.addFamilyPlanning(req, res, next));
router.post('/:id/partograph', (req, res, next) => mchController.addPartograph(req, res, next));
router.post('/:id/growth', (req, res, next) => mchController.addChildGrowth(req, res, next));

export default router;

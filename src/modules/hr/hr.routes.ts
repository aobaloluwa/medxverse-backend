import { Router } from 'express';
import { hrController } from './hr.controller.js';

const router = Router();

router.get('/stats', (req, res, next) => hrController.getStats(req, res, next));

router.post('/applications', (req, res, next) => hrController.createApplication(req, res, next));
router.get('/applications', (req, res, next) => hrController.getApplications(req, res, next));
router.patch('/applications/:id/stage', (req, res, next) => hrController.updateApplicationStage(req, res, next));

router.post('/leave', (req, res, next) => hrController.createLeave(req, res, next));
router.get('/leave', (req, res, next) => hrController.getLeave(req, res, next));
router.patch('/leave/:id/status', (req, res, next) => hrController.updateLeaveStatus(req, res, next));

router.post('/licenses', (req, res, next) => hrController.createLicense(req, res, next));
router.get('/licenses', (req, res, next) => hrController.getLicenses(req, res, next));

router.post('/cme', (req, res, next) => hrController.createCme(req, res, next));
router.get('/cme', (req, res, next) => hrController.getCme(req, res, next));

router.post('/appraisals', (req, res, next) => hrController.createAppraisal(req, res, next));
router.get('/appraisals', (req, res, next) => hrController.getAppraisals(req, res, next));

export default router;

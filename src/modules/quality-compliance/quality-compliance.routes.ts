import { Router } from 'express';
import { qualityComplianceController } from './quality-compliance.controller.js';

const router = Router();

router.get('/stats', (req, res, next) => qualityComplianceController.getStats(req, res, next));

router.post('/incidents', (req, res, next) => qualityComplianceController.createIncident(req, res, next));
router.get('/incidents', (req, res, next) => qualityComplianceController.getIncidents(req, res, next));

router.post('/consents', (req, res, next) => qualityComplianceController.createConsent(req, res, next));
router.get('/consents', (req, res, next) => qualityComplianceController.getConsents(req, res, next));

router.post('/birth-death', (req, res, next) => qualityComplianceController.createBirthDeath(req, res, next));
router.get('/birth-death', (req, res, next) => qualityComplianceController.getBirthDeath(req, res, next));

router.post('/surveillance', (req, res, next) => qualityComplianceController.createSurveillance(req, res, next));
router.get('/surveillance', (req, res, next) => qualityComplianceController.getSurveillance(req, res, next));

router.get('/ndpa-audit', (req, res, next) => qualityComplianceController.getNdpaAuditLogs(req, res, next));

export default router;

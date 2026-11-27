import { Router } from 'express';
import { systemReportsController } from './system-reports.controller.js';

const router = Router();

router.get('/stats', (req, res, next) => systemReportsController.getStats(req, res, next));

router.post('/branches', (req, res, next) => systemReportsController.createBranch(req, res, next));
router.get('/branches', (req, res, next) => systemReportsController.getBranches(req, res, next));

router.post('/rbac', (req, res, next) => systemReportsController.createRbacRole(req, res, next));
router.get('/rbac', (req, res, next) => systemReportsController.getRbacRoles(req, res, next));

router.get('/integrations', (req, res, next) => systemReportsController.getIntegrations(req, res, next));

router.post('/backups', (req, res, next) => systemReportsController.triggerBackup(req, res, next));
router.get('/backups', (req, res, next) => systemReportsController.getBackups(req, res, next));

router.post('/tickets', (req, res, next) => systemReportsController.createTicket(req, res, next));
router.get('/tickets', (req, res, next) => systemReportsController.getTickets(req, res, next));

export default router;

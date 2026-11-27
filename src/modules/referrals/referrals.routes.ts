import { Router } from 'express';
import { referralsController } from './referrals.controller.js';

const router = Router();

router.post('/', (req, res, next) => referralsController.create(req, res, next));
router.get('/', (req, res, next) => referralsController.getAll(req, res, next));
router.get('/stats', (req, res, next) => referralsController.getStats(req, res, next));
router.get('/:id', (req, res, next) => referralsController.getById(req, res, next));
router.patch('/:id/status', (req, res, next) => referralsController.updateStatus(req, res, next));

export default router;

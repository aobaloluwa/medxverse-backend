import { Router } from 'express';
import { visitorController } from './visitor.controller.js';

const router = Router();

router.post('/', (req, res, next) => visitorController.issuePass(req, res, next));
router.get('/', (req, res, next) => visitorController.getAll(req, res, next));
router.patch('/:id/check-in', (req, res, next) => visitorController.checkIn(req, res, next));
router.patch('/:id/check-out', (req, res, next) => visitorController.checkOut(req, res, next));
router.patch('/:id/revoke', (req, res, next) => visitorController.revoke(req, res, next));

export default router;

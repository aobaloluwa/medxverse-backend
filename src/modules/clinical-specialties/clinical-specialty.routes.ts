import { Router } from 'express';
import { clinicalSpecialtyController } from './clinical-specialty.controller.js';

const router = Router();

router.post('/', (req, res, next) => clinicalSpecialtyController.create(req, res, next));
router.get('/', (req, res, next) => clinicalSpecialtyController.getAll(req, res, next));
router.get('/stats', (req, res, next) => clinicalSpecialtyController.getStats(req, res, next));
router.get('/:id', (req, res, next) => clinicalSpecialtyController.getById(req, res, next));

export default router;

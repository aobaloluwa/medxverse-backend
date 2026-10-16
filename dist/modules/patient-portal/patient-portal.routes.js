import { Router } from 'express';
import { PatientPortalController } from './patient-portal.controller.js';
import { authLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
const router = Router();
// Public hospital directory used by the patient portal login/register screens.
router.get('/hospitals', (req, res) => PatientPortalController.hospitals(req, res));
router.post('/register', authLimiter, (req, res) => PatientPortalController.register(req, res));
router.post('/login', authLimiter, (req, res) => PatientPortalController.login(req, res));
router.post('/link', authLimiter, (req, res) => PatientPortalController.link(req, res));
router.get('/connection', authenticate, (req, res) => PatientPortalController.connection(req, res));
router.get('/profile', authenticate, (req, res) => PatientPortalController.profile(req, res));
router.patch('/profile', authenticate, (req, res) => PatientPortalController.updateProfile(req, res));
router.get('/settings', authenticate, (req, res) => PatientPortalController.settings(req, res));
router.patch('/settings', authenticate, (req, res) => PatientPortalController.updateSettings(req, res));
router.post('/change-password', authenticate, (req, res) => PatientPortalController.changePassword(req, res));
export default router;

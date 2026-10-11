import { Router } from 'express';
import { telemedicineController } from './telemedicine.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import multer from 'multer';

const router = Router();
const chatAttachmentUpload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 10 * 1024 * 1024 } });

// Minimal public QR/ID verification endpoint. It exposes only prescription validity metadata.
router.get('/prescriptions/verify/:verificationId', (req, res, next) =>
  telemedicineController.verifyPrescription(req, res, next)
);

router.use(authenticate);

// Telemedicine directory for the authenticated hospital
router.get('/directory', (req, res, next) =>
  telemedicineController.getDirectory(req, res, next)
);

// Telemedicine Consultation Sessions
router.post('/sessions', (req, res, next) =>
  telemedicineController.createSession(req, res, next)
);
router.get('/sessions', (req, res, next) =>
  telemedicineController.getSessions(req, res, next)
);
router.get('/sessions/:id', (req, res, next) =>
  telemedicineController.getSessionById(req, res, next)
);
router.get('/sessions/:id/meeting-token', (req, res, next) =>
  telemedicineController.getMeetingToken(req, res, next)
);
router.patch('/sessions/:id/status', (req, res, next) =>
  telemedicineController.updateSessionStatus(req, res, next)
);
router.post('/sessions/:id/call-summary', (req, res, next) =>
  telemedicineController.recordCallSummary(req, res, next)
);

// Real-time Chat & In-Consultation Messaging
router.post('/sessions/:id/prescriptions', (req, res, next) =>
  telemedicineController.issuePrescription(req, res, next)
);
router.get('/sessions/:id/prescriptions', (req, res, next) =>
  telemedicineController.getSessionPrescriptions(req, res, next)
);
router.patch('/prescriptions/:id/dispense', (req, res, next) =>
  telemedicineController.dispensePrescription(req, res, next)
);

router.post('/messages/session/:sessionId/attachments', chatAttachmentUpload.single('file'), (req, res, next) =>
  telemedicineController.uploadMessageAttachment(req, res, next)
);
router.post('/messages', (req, res, next) =>
  telemedicineController.sendMessage(req, res, next)
);
router.get('/messages/session/:sessionId', (req, res, next) =>
  telemedicineController.getSessionMessages(req, res, next)
);

export default router;
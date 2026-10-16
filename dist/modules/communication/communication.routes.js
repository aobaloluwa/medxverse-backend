import { Router } from 'express';
import { protect } from '../../middlewares/auth.middleware.js';
import { requireAcceptedStaffInvitation } from '../staff-auth/staff-invitation.guard.js';
import { CommunicationController } from './communication.controller.js';
import multer from 'multer';
const router = Router();
const chatUpload = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: 10 * 1024 * 1024 },
});
router.use(protect, requireAcceptedStaffInvitation);
router.get('/inbox', CommunicationController.inbox);
router.patch('/presence', CommunicationController.setPresence);
router.get('/my-patients', CommunicationController.myPatients);
router.get('/messages/search', CommunicationController.searchMessages);
router.get('/staff/search', CommunicationController.searchStaff);
router.post('/conversations/direct', CommunicationController.createDirect);
router.post('/conversations/group', CommunicationController.createGroup);
router.post('/conversations/patient', CommunicationController.createPatientCare);
router.post('/conversations/department', CommunicationController.createDepartmentConversation);
router.post('/conversations/:id/join', CommunicationController.joinDepartment);
router.get('/conversations/:id', CommunicationController.getConversation);
router.get('/conversations/:id/messages', CommunicationController.messages);
router.post('/conversations/:id/attachments', chatUpload.single('file'), CommunicationController.uploadAttachment);
router.post('/conversations/:id/messages', CommunicationController.sendMessage);
router.post('/conversations/:id/read', CommunicationController.markRead);
router.get('/departments', CommunicationController.listDepartments);
router.post('/departments', CommunicationController.createDepartment);
router.get('/tickets', CommunicationController.listTickets);
router.post('/tickets', CommunicationController.createTicket);
router.patch('/tickets/:id', CommunicationController.updateTicket);
export default router;

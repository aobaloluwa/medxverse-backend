import { notificationService } from './notifications.service.js';
export class NotificationController {
    /**
     * GET /api/v1/notifications
     */
    async getMyNotifications(req, res, next) {
        try {
            const authReq = req;
            const userId = authReq.user._id;
            const hospitalId = authReq.user.hospitalId;
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
            const status = req.query.status;
            const type = req.query.type;
            const result = await notificationService.getUserNotifications(userId, hospitalId, { page, limit, status, type });
            res.status(200).json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/v1/notifications/unread-count
     */
    async getUnreadCount(req, res, next) {
        try {
            const authReq = req;
            const userId = authReq.user._id;
            const hospitalId = authReq.user.hospitalId;
            const count = await notificationService.getUnreadCount(userId, hospitalId);
            res.status(200).json({
                success: true,
                data: { unreadCount: count },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/v1/notifications
     */
    async createNotification(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType === 'PATIENT') {
                res.status(403).json({ success: false, message: 'Patients cannot create notifications for other users.' });
                return;
            }
            const hospitalId = authReq.user.hospitalId;
            const senderId = authReq.user._id;
            const { recipientId, type, priority, channel, title, message, data, expiresAt } = req.body;
            const notification = await notificationService.createNotification({
                hospitalId,
                recipientId,
                senderId,
                type: type,
                priority: priority,
                channel: channel,
                title,
                message,
                data,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            });
            res.status(201).json({
                success: true,
                data: notification,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/v1/notifications/:id/read
     */
    async markAsRead(req, res, next) {
        try {
            const authReq = req;
            const userId = authReq.user._id;
            const hospitalId = authReq.user.hospitalId;
            const id = req.params.id;
            const updated = await notificationService.markAsRead(id, userId, hospitalId);
            if (!updated) {
                res.status(404).json({
                    success: false,
                    message: 'Notification not found or access denied.',
                });
                return;
            }
            res.status(200).json({
                success: true,
                data: updated,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/v1/notifications/read-all
     */
    async markAllAsRead(req, res, next) {
        try {
            const authReq = req;
            const userId = authReq.user._id;
            const hospitalId = authReq.user.hospitalId;
            const modifiedCount = await notificationService.markAllAsRead(userId, hospitalId);
            res.status(200).json({
                success: true,
                message: `Marked ${modifiedCount} notifications as read.`,
                data: { modifiedCount },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/v1/notifications/:id
     */
    async deleteNotification(req, res, next) {
        try {
            const authReq = req;
            const userId = authReq.user._id;
            const hospitalId = authReq.user.hospitalId;
            const id = req.params.id;
            const deleted = await notificationService.deleteNotification(id, userId, hospitalId);
            if (!deleted) {
                res.status(404).json({
                    success: false,
                    message: 'Notification not found or access denied.',
                });
                return;
            }
            res.status(200).json({
                success: true,
                message: 'Notification deleted successfully.',
            });
        }
        catch (error) {
            next(error);
        }
    }
}
export const notificationController = new NotificationController();

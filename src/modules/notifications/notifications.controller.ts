import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notifications.service.js';
import {
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationStatus,
} from './notifications.types.js';

export interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    hospitalId: string;
    [key: string]: unknown;
  };
}

export class NotificationController {
  /**
   * GET /api/v1/notifications
   */
  public async getMyNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user._id;
      const hospitalId = authReq.user.hospitalId;

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const status = req.query.status as NotificationStatus | undefined;
      const type = req.query.type as NotificationType | undefined;

      const result = await notificationService.getUserNotifications(
        userId,
        hospitalId,
        { page, limit, status, type }
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   */
  public async getUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user._id;
      const hospitalId = authReq.user.hospitalId;

      const count = await notificationService.getUnreadCount(userId, hospitalId);

      res.status(200).json({
        success: true,
        data: { unreadCount: count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications
   */
  public async createNotification(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user.userType === 'PATIENT') {
        res.status(403).json({ success: false, message: 'Patients cannot create notifications for other users.' });
        return;
      }
      const hospitalId = authReq.user.hospitalId;
      const senderId = authReq.user._id;

      const { recipientId, type, priority, channel, title, message, data, expiresAt } =
        req.body;

      const notification = await notificationService.createNotification({
        hospitalId,
        recipientId,
        senderId,
        type: type as NotificationType,
        priority: priority as NotificationPriority,
        channel: channel as NotificationChannel,
        title,
        message,
        data,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      res.status(201).json({
        success: true,
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  public async markAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user._id;
      const hospitalId = authReq.user.hospitalId;
      const id = req.params.id as string;

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
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   */
  public async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user._id;
      const hospitalId = authReq.user.hospitalId;

      const modifiedCount = await notificationService.markAllAsRead(userId, hospitalId);

      res.status(200).json({
        success: true,
        message: `Marked ${modifiedCount} notifications as read.`,
        data: { modifiedCount },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/notifications/:id
   */
  public async deleteNotification(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user._id;
      const hospitalId = authReq.user.hospitalId;
      const id = req.params.id as string;

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
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
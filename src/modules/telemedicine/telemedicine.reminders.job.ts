import { TelemedicineSessionModel } from './telemedicine.model.js';
import { PatientModel } from '../patient/patient.model.js';
import { notificationService } from '../notifications/notifications.service.js';
import { NotificationType, NotificationPriority, NotificationChannel } from '../notifications/notifications.types.js';
import { sendEmail } from '../../utils/email.js';

/**
 * Dispatches appointment reminders in short time windows. A conditional atomic update
 * claims each reminder before delivery, so multiple Render instances do not normally
 * send duplicates. Call on a 5-minute cadence after MongoDB connects.
 */
export async function processTelemedicineReminders(): Promise<void> {
  const now = new Date();
  const reminderWindows = [
    { hours: 24, field: 'reminder24hSentAt' as const, lowerMs: 24 * 60 * 60_000 - 5 * 60_000, upperMs: 24 * 60 * 60_000 + 5 * 60_000 },
    { hours: 1, field: 'reminder1hSentAt' as const, lowerMs: 60 * 60_000 - 5 * 60_000, upperMs: 60 * 60_000 + 5 * 60_000 },
  ];

  for (const window of reminderWindows) {
    const start = new Date(now.getTime() + window.lowerMs);
    const end = new Date(now.getTime() + window.upperMs);
    const query: Record<string, any> = {
      status: 'WAITING_ROOM',
      scheduledStartTime: { $gte: start, $lt: end },
      [window.field]: { $exists: false },
      $or: [
        { paymentStatus: { $in: ['PAID', 'NOT_REQUIRED'] } },
        { paymentStatus: { $exists: false } },
      ],
    };
    const candidates = await TelemedicineSessionModel.find(query)
      .select('_id hospitalId patientId consultationType scheduledStartTime')
      .limit(200).lean().exec();

    for (const candidate of (Array.isArray(candidates) ? candidates : candidates ? [candidates] : []) as any[]) {
      const claimed = await TelemedicineSessionModel.findOneAndUpdate(
        { _id: candidate._id, status: 'WAITING_ROOM', [window.field]: { $exists: false } },
        { $set: { [window.field]: now } },
        { new: true },
      ).lean().exec();
      if (!claimed) continue;

      const hospitalId = String(candidate.hospitalId);
      const patientId = String(candidate.patientId);
      const sessionId = String(candidate._id);
      const scheduled = new Date(candidate.scheduledStartTime).toLocaleString();
      const title = `Virtual consultation reminder (${window.hours} hour${window.hours === 1 ? '' : 's'})`;
      const message = `Your ${String(candidate.consultationType || 'virtual').toLowerCase()} consultation is scheduled for ${scheduled}. Open your MedXVerse patient portal to join when it is time.`;

      try {
        await notificationService.createNotification({
          hospitalId, recipientId: patientId, type: NotificationType.APPOINTMENT,
          priority: window.hours === 1 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
          channel: NotificationChannel.IN_APP, title, message,
          data: { sessionId, scheduledStartTime: candidate.scheduledStartTime, reminderHours: window.hours },
        });
      } catch (error) { console.warn('[Telemedicine] Could not create reminder notification:', error); }

      try {
        const patientResult = await PatientModel.findOne({ _id: patientId, hospitalId, active: true }).select('email firstName lastName').lean().exec();
        const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult) as any;
        if (patient?.email) {
          const name = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
          const safeName = name.replace(/[&<>"']/g, '');
          await sendEmail({
            to: String(patient.email), subject: title,
            text: `Hello ${name}, ${message}`,
            html: `<p>Hello ${safeName},</p><p>${message}</p>`,
          });
        }
      } catch (error) { console.warn('[Telemedicine] Could not send reminder email:', error); }
    }
  }
}

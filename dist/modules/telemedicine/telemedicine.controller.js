import { createHmac, timingSafeEqual } from 'crypto';
import { telemedicineService } from './telemedicine.service.js';
import { StaffUser } from '../staff-auth/staff-user.model.js';
import { Staff } from '../staff/staff.model.js';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { ConsultationType, ConsultationStatus } from './telemedicine.types.js';
import cloudinary from '../../config/cloudinary.js';
import { TelemedicineMessageModel, TelemedicineSessionModel } from './telemedicine.model.js';
import { PatientModel } from '../patient/patient.model.js';
import { AppointmentModel, ProviderScheduleModel } from '../appointment/appointment.model.js';
import { LabService } from '../lab/lab.service.js';
import { LabOrderModel } from '../lab/lab.model.js';
import { notificationService } from '../notifications/notifications.service.js';
import { NotificationType, NotificationPriority, NotificationChannel } from '../notifications/notifications.types.js';
import { sendEmail } from '../../utils/email.js';
/**
 * Staff login IDs and Staff directory IDs are different records in MedXVerse.
 * Telemedicine sessions store the Staff._id in doctorId, while staff JWTs carry
 * StaffUser._id. Resolve the linked Staff record before checking consultation
 * assignment or querying sessions.
 */
async function resolveStaffRecordId(authReq) {
    if (authReq.user.userType !== 'STAFF')
        return undefined;
    const hospitalId = String(authReq.user.hospitalId || '');
    const loginId = String(authReq.user._id || '');
    if (!hospitalId || !loginId)
        return undefined;
    const staffUser = await StaffUser.findOne({ _id: loginId, hospitalId }).select('staffId').lean();
    if (staffUser?.staffId)
        return String(staffUser.staffId);
    // Backward compatibility for deployments where a legacy token contains Staff._id.
    const legacyStaff = await Staff.findOne({ _id: loginId, hospitalId }).select('_id').lean();
    return legacyStaff ? String(legacyStaff._id) : undefined;
}
function appointmentTimeToUtc(dateValue, timeValue, timezone) {
    const datePart = new Date(dateValue).toISOString().slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = String(timeValue || '00:00').split(':').map(Number);
    const desiredWallTime = Date.UTC(year, month - 1, day, hour || 0, minute || 0, 0);
    let guess = desiredWallTime;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone || 'Africa/Lagos',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(new Date(guess));
        const value = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
        const representedWallTime = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), 0);
        const adjustment = desiredWallTime - representedWallTime;
        guess += adjustment;
        if (adjustment === 0)
            break;
    }
    return new Date(guess);
}
export class TelemedicineController {
    async createSessionFromAppointment(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the assigned staff member can start a telemedicine session from a hospital appointment.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            const staffRecordId = await resolveStaffRecordId(authReq);
            if (!staffRecordId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const appointmentId = String(req.params.appointmentId || '');
            if (!Types.ObjectId.isValid(appointmentId)) {
                res.status(400).json({ success: false, message: 'A valid appointment ID is required.' });
                return;
            }
            const appointment = await AppointmentModel.findOne({
                _id: appointmentId,
                hospitalId,
                doctorId: staffRecordId,
            }).lean().exec();
            if (!appointment) {
                res.status(404).json({ success: false, message: 'Appointment not found or it is not assigned to you.' });
                return;
            }
            if (['CANCELLED', 'NO_SHOW'].includes(String(appointment.status))) {
                res.status(409).json({ success: false, message: 'A cancelled or missed appointment cannot be opened as a consultation.' });
                return;
            }
            const existing = await TelemedicineSessionModel.findOne({ hospitalId, appointmentId }).exec();
            if (existing) {
                res.status(200).json({ success: true, data: existing });
                return;
            }
            const schedule = await ProviderScheduleModel.findOne({ hospitalId, providerId: staffRecordId, active: true })
                .select('timezone').lean().exec();
            let scheduledStartTime = appointmentTimeToUtc(appointment.appointmentDate, appointment.startTime, schedule?.timezone || 'Africa/Lagos');
            // Staff may open the consultation late; the appointment remains the source of truth,
            // but the session service requires a non-past scheduled time.
            if (scheduledStartTime.getTime() < Date.now() - 60_000)
                scheduledStartTime = new Date(Date.now() + 60_000);
            const session = await telemedicineService.createSession({
                hospitalId,
                patientId: String(appointment.patientId),
                doctorId: staffRecordId,
                consultationType: ConsultationType.VIDEO,
                scheduledStartTime,
                chiefComplaint: String(appointment.reason || appointment.notes || 'Hospital appointment'),
                appointmentId,
                paymentRequired: false,
                skipAvailabilityValidation: true,
            });
            res.status(201).json({ success: true, data: session });
        }
        catch (error) {
            next(error);
        }
    }
    async createSession(req, res, next) {
        try {
            const authReq = req;
            const hospitalId = authReq.user.hospitalId;
            const { patientId: requestedPatientId, doctorId, consultationType, scheduledStartTime, chiefComplaint, followUpOfSessionId } = req.body;
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : requestedPatientId;
            const session = await telemedicineService.createSession({
                hospitalId,
                patientId,
                doctorId,
                consultationType: consultationType,
                scheduledStartTime,
                chiefComplaint,
                followUpOfSessionId,
                paymentRequired: authReq.user.userType === 'PATIENT',
            });
            // Notification delivery must never undo a successful appointment reservation.
            try {
                await notificationService.createNotification({
                    hospitalId: String(hospitalId), recipientId: String(patientId), type: NotificationType.APPOINTMENT,
                    priority: NotificationPriority.MEDIUM, channel: NotificationChannel.IN_APP,
                    title: 'Virtual consultation booked',
                    message: session.paymentStatus === 'PENDING' ? 'Your consultation is reserved. Complete payment to unlock chat and calls.' : 'Your virtual consultation has been booked.',
                    data: { sessionId: String(session._id), scheduledStartTime: session.scheduledStartTime, consultationType: session.consultationType, paymentStatus: session.paymentStatus },
                });
            }
            catch { /* notification is best-effort; booking remains authoritative */ }
            try {
                const patientResult = await PatientModel.findOne({ _id: patientId, hospitalId, active: true }).select('email firstName lastName').lean().exec();
                const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
                if (patient?.email) {
                    const name = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
                    await sendEmail({
                        to: String(patient.email), subject: 'MedXVerse virtual consultation confirmation',
                        text: `Hello ${name}, your ${session.consultationType.toLowerCase()} consultation is scheduled for ${new Date(session.scheduledStartTime).toLocaleString()}. ${session.paymentStatus === 'PENDING' ? 'Please complete payment in your patient portal before joining.' : 'Open your patient portal to view the consultation.'}`,
                        html: `<p>Hello ${name.replace(/[&<>"']/g, '')},</p><p>Your ${session.consultationType.toLowerCase()} consultation is scheduled for <strong>${new Date(session.scheduledStartTime).toLocaleString()}</strong>.</p><p>${session.paymentStatus === 'PENDING' ? 'Please complete payment in your patient portal before joining.' : 'Open your patient portal to view the consultation.'}</p>`,
                    });
                }
            }
            catch (emailError) {
                console.warn('[Telemedicine] Booking confirmation email was not sent:', emailError);
            }
            res.status(201).json({ success: true, data: session });
        }
        catch (error) {
            next(error);
        }
    }
    async getDirectory(req, res, next) {
        try {
            const authReq = req;
            const isPatient = authReq.user.userType === 'PATIENT';
            const isStaff = authReq.user.userType === 'STAFF';
            const result = await telemedicineService.getDirectory(authReq.user.hospitalId, !isPatient && !isStaff);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getSessions(req, res, next) {
        try {
            const authReq = req;
            const hospitalId = authReq.user.hospitalId;
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : req.query.patientId;
            const staffRecordId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !staffRecordId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile. Ask your hospital administrator to link it.' });
                return;
            }
            // Never trust a staff client's doctorId query parameter; scope to its linked Staff record.
            const doctorId = authReq.user.userType === 'STAFF' ? staffRecordId : req.query.doctorId;
            const status = req.query.status;
            const consultationType = req.query.consultationType;
            const result = await telemedicineService.getSessions(hospitalId, {
                page,
                limit,
                patientId,
                doctorId,
                status,
                consultationType,
            });
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getSessionById(req, res, next) {
        try {
            const authReq = req;
            const hospitalId = authReq.user.hospitalId;
            const id = req.params.id;
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(id, hospitalId, patientId, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found' });
                return;
            }
            res.status(200).json({ success: true, data: session });
        }
        catch (error) {
            next(error);
        }
    }
    /** Paystack server webhook: signed provider events can activate payment even if the patient closes the checkout tab. */
    async paystackWebhook(req, res, next) {
        try {
            const secret = process.env.PAYSTACK_SECRET_KEY;
            const signature = String(req.headers['x-paystack-signature'] || '');
            const rawBody = req.rawBody;
            if (!secret || !signature || !rawBody?.length) {
                res.status(401).json({ success: false, message: 'Invalid payment webhook signature.' });
                return;
            }
            const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
            const expectedBuffer = Buffer.from(expected, 'hex');
            const signatureBuffer = Buffer.from(signature, 'hex');
            if (expectedBuffer.length !== signatureBuffer.length || !timingSafeEqual(expectedBuffer, signatureBuffer)) {
                res.status(401).json({ success: false, message: 'Invalid payment webhook signature.' });
                return;
            }
            const event = String(req.body?.event || '');
            if (event !== 'charge.success') {
                res.status(200).json({ success: true, received: true });
                return;
            }
            const transaction = req.body?.data || {};
            const metadata = transaction.metadata || {};
            const sessionId = String(metadata.sessionId || '');
            const hospitalId = String(metadata.hospitalId || '');
            const patientId = String(metadata.patientId || '');
            const reference = String(transaction.reference || '');
            if (!Types.ObjectId.isValid(sessionId) || !Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(patientId) || !reference) {
                res.status(200).json({ success: true, received: true, ignored: true });
                return;
            }
            const session = await TelemedicineSessionModel.findOne({ _id: sessionId, hospitalId, patientId, paymentStatus: 'PENDING', paymentReference: reference }).exec();
            if (!session) {
                res.status(200).json({ success: true, received: true, alreadyProcessed: true });
                return;
            }
            const expectedAmount = Math.round(Number(session.consultationFee || 0) * 100);
            const expectedCurrency = String(session.paymentCurrency || 'NGN').toUpperCase();
            if (transaction.status !== 'success' || Number(transaction.amount) !== expectedAmount || String(transaction.currency || '').toUpperCase() !== expectedCurrency) {
                res.status(200).json({ success: true, received: true, ignored: true });
                return;
            }
            session.paymentStatus = 'PAID';
            session.paymentPaidAt = new Date();
            session.paymentProvider = 'PAYSTACK';
            await session.save();
            try {
                await notificationService.createNotification({
                    hospitalId, recipientId: patientId, type: NotificationType.BILLING, priority: NotificationPriority.MEDIUM, channel: NotificationChannel.IN_APP,
                    title: 'Consultation payment received', message: `Payment of ${expectedCurrency} ${(Number(transaction.amount) / 100).toLocaleString()} was verified for your virtual consultation.`,
                    data: { sessionId, paymentReference: reference, amount: Number(transaction.amount) / 100, currency: expectedCurrency },
                });
            }
            catch { /* payment state is authoritative even if notifications are unavailable */ }
            try {
                const patientResult = await PatientModel.findOne({ _id: patientId, hospitalId, active: true }).select('email firstName lastName').lean().exec();
                const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
                if (patient?.email) {
                    const amount = Number(transaction.amount) / 100;
                    const name = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
                    await sendEmail({ to: String(patient.email), subject: 'MedXVerse consultation payment receipt', text: `Hello ${name}, your payment of ${expectedCurrency} ${amount.toLocaleString()} was verified. Reference: ${reference}.`, html: `<p>Hello ${name.replace(/[&<>"']/g, '')},</p><p>Your consultation payment of <strong>${expectedCurrency} ${amount.toLocaleString()}</strong> has been verified.</p><p>Payment reference: <strong>${reference}</strong></p>` });
                }
            }
            catch (emailError) {
                console.warn('[Telemedicine] Webhook receipt email was not sent:', emailError);
            }
            res.status(200).json({ success: true, received: true, paymentStatus: 'PAID' });
        }
        catch (error) {
            next(error);
        }
    }
    /** Start a Paystack checkout for the authenticated patient’s own consultation. */
    async initializePayment(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'PATIENT') {
                res.status(403).json({ success: false, message: 'Only the patient who booked this consultation can initiate its payment.' });
                return;
            }
            const sessionId = String(req.params.id || '');
            const session = await telemedicineService.getSessionById(sessionId, String(authReq.user.hospitalId || ''), String(authReq.user._id || ''));
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation not found for this patient.' });
                return;
            }
            if (session.paymentStatus === 'PAID') {
                res.status(200).json({ success: true, data: { paid: true, paymentStatus: 'PAID' } });
                return;
            }
            if (session.paymentStatus !== 'PENDING') {
                res.status(409).json({ success: false, message: 'This consultation does not require an outstanding payment.' });
                return;
            }
            const secret = process.env.PAYSTACK_SECRET_KEY;
            if (!secret) {
                res.status(503).json({ success: false, message: 'Online payments are not configured yet. The hospital administrator must set PAYSTACK_SECRET_KEY on the backend.' });
                return;
            }
            const patientResult = await PatientModel.findOne({ _id: authReq.user._id, hospitalId: authReq.user.hospitalId, active: true }).select('email firstName lastName').lean().exec();
            const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
            const email = String(patient?.email || authReq.user.email || '').trim().toLowerCase();
            if (!email) {
                res.status(400).json({ success: false, message: 'A valid email address is required to make an online payment. Update the patient record with the hospital.' });
                return;
            }
            const frontendBase = (process.env.PATIENT_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
            const callbackUrl = `${frontendBase}/portal/telemedicine?payment=return&sessionId=${encodeURIComponent(sessionId)}`;
            const paymentResponse = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    amount: Math.round(Number(session.consultationFee || 0) * 100),
                    currency: String(session.paymentCurrency || 'NGN'),
                    callback_url: callbackUrl,
                    metadata: { sessionId, hospitalId: String(authReq.user.hospitalId), patientId: String(authReq.user._id), consultationType: session.consultationType },
                }),
            });
            const paymentPayload = await paymentResponse.json().catch(() => null);
            if (!paymentResponse.ok || paymentPayload?.status !== true || !paymentPayload?.data?.authorization_url || !paymentPayload?.data?.reference) {
                res.status(502).json({ success: false, message: paymentPayload?.message || 'Paystack could not initialize the payment. Please try again.' });
                return;
            }
            session.paymentReference = String(paymentPayload.data.reference);
            session.paymentProvider = 'PAYSTACK';
            await session.save();
            res.status(200).json({ success: true, data: { authorizationUrl: paymentPayload.data.authorization_url, reference: paymentPayload.data.reference, amount: session.consultationFee, currency: session.paymentCurrency || 'NGN' } });
        }
        catch (error) {
            next(error);
        }
    }
    /** Verify the payment directly with Paystack before unlocking any paid consultation. */
    async verifyPayment(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'PATIENT') {
                res.status(403).json({ success: false, message: 'Only the patient who booked this consultation can verify its payment.' });
                return;
            }
            const sessionId = String(req.params.id || '');
            const reference = String(req.body?.reference || req.query?.reference || '').trim();
            if (!reference) {
                res.status(400).json({ success: false, message: 'Paystack payment reference is required.' });
                return;
            }
            const session = await telemedicineService.getSessionById(sessionId, String(authReq.user.hospitalId || ''), String(authReq.user._id || ''));
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation not found for this patient.' });
                return;
            }
            if (session.paymentStatus === 'PAID') {
                res.status(200).json({ success: true, data: { paymentStatus: 'PAID', paid: true, sessionId } });
                return;
            }
            if (session.paymentStatus !== 'PENDING' || String(session.paymentReference || '') !== reference) {
                res.status(409).json({ success: false, message: 'This payment reference does not match the pending consultation payment.' });
                return;
            }
            const secret = process.env.PAYSTACK_SECRET_KEY;
            if (!secret) {
                res.status(503).json({ success: false, message: 'Online payments are not configured on this hospital service.' });
                return;
            }
            const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
                headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
            });
            const verifyPayload = await verifyResponse.json().catch(() => null);
            const transaction = verifyPayload?.data;
            const expectedAmount = Math.round(Number(session.consultationFee || 0) * 100);
            const expectedCurrency = String(session.paymentCurrency || 'NGN').toUpperCase();
            const metadata = transaction?.metadata || {};
            const metadataMatches = String(metadata.sessionId || '') === sessionId
                && String(metadata.patientId || '') === String(authReq.user._id)
                && String(metadata.hospitalId || '') === String(authReq.user.hospitalId);
            if (!verifyResponse.ok || verifyPayload?.status !== true || transaction?.status !== 'success'
                || transaction?.reference !== reference || Number(transaction?.amount) !== expectedAmount
                || String(transaction?.currency || '').toUpperCase() !== expectedCurrency || !metadataMatches) {
                res.status(402).json({ success: false, message: 'Payment has not been confirmed. If your account was charged, wait a moment and retry verification.' });
                return;
            }
            session.paymentStatus = 'PAID';
            session.paymentPaidAt = new Date();
            session.paymentProvider = 'PAYSTACK';
            await session.save();
            try {
                await notificationService.createNotification({
                    hospitalId: String(authReq.user.hospitalId), recipientId: String(authReq.user._id), type: NotificationType.BILLING,
                    priority: NotificationPriority.MEDIUM, channel: NotificationChannel.IN_APP,
                    title: 'Consultation payment received',
                    message: `Payment of ${expectedCurrency} ${(Number(transaction.amount) / 100).toLocaleString()} was verified for your virtual consultation.`,
                    data: { sessionId, paymentReference: reference, amount: Number(transaction.amount) / 100, currency: expectedCurrency },
                });
            }
            catch { /* receipt notification is best-effort; payment verification remains authoritative */ }
            try {
                const patientResult = await PatientModel.findOne({ _id: authReq.user._id, hospitalId: authReq.user.hospitalId, active: true }).select('email firstName lastName').lean().exec();
                const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
                if (patient?.email) {
                    const name = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
                    const amount = Number(transaction.amount) / 100;
                    await sendEmail({
                        to: String(patient.email), subject: 'MedXVerse consultation payment receipt',
                        text: `Hello ${name}, your payment of ${expectedCurrency} ${amount.toLocaleString()} was verified for consultation ${sessionId}. Reference: ${reference}.`,
                        html: `<p>Hello ${name.replace(/[&<>"']/g, '')},</p><p>Your consultation payment of <strong>${expectedCurrency} ${amount.toLocaleString()}</strong> has been verified.</p><p>Payment reference: <strong>${reference}</strong></p><p>Consultation: ${sessionId}</p>`,
                    });
                }
            }
            catch (emailError) {
                console.warn('[Telemedicine] Payment receipt email was not sent:', emailError);
            }
            res.status(200).json({ success: true, data: { paymentStatus: 'PAID', paid: true, sessionId, reference, amount: Number(transaction.amount) / 100, currency: expectedCurrency } });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Creates a short-lived JaaS JWT for an authenticated participant.
     * The JaaS private key is used only on the backend and is never returned.
     */
    async getMeetingToken(req, res, next) {
        try {
            const authReq = req;
            const configuredAppId = env.JAAS_APP_ID?.trim();
            const configuredApiKeyId = env.JAAS_API_KEY_ID?.trim();
            const privateKey = env.JAAS_PRIVATE_KEY;
            if (!configuredAppId || !configuredApiKeyId || !privateKey) {
                res.status(503).json({
                    success: false,
                    message: 'JaaS is not configured. Set JAAS_APP_ID, JAAS_API_KEY_ID, and JAAS_PRIVATE_KEY on the backend.',
                });
                return;
            }
            // JaaS displays API key IDs as "APP_ID/KEY_SUFFIX". Accept either that
            // complete key ID or just the suffix in JAAS_API_KEY_ID, and always use
            // the bare AppID for the JWT "sub" claim and room namespace.
            const appId = configuredAppId.split('/')[0];
            const kid = configuredApiKeyId.includes('/')
                ? configuredApiKeyId
                : `${appId}/${configuredApiKeyId}`;
            if (!appId.startsWith('vpaas-magic-cookie-') || !kid.startsWith(`${appId}/`)) {
                res.status(503).json({
                    success: false,
                    message: 'JaaS configuration is invalid. JAAS_APP_ID must be the AppID starting with vpaas-magic-cookie-, and JAAS_API_KEY_ID must be the key suffix or the full AppID/key-suffix value shown in the JaaS console.',
                });
                return;
            }
            const sessionId = String(req.params.id || '');
            const isPatient = authReq.user.userType === 'PATIENT';
            const staffRecordId = await resolveStaffRecordId(authReq);
            if (!isPatient && authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the assigned patient or doctor can join this consultation.' });
                return;
            }
            if (authReq.user.userType === 'STAFF' && !staffRecordId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(sessionId, String(authReq.user.hospitalId || ''), isPatient ? String(authReq.user._id) : undefined, isPatient ? undefined : staffRecordId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found or you are not assigned to it.' });
                return;
            }
            if (!session.doctorAcceptedAt) {
                res.status(403).json({ success: false, message: 'The assigned doctor must accept this consultation order before the call can be joined.' });
                return;
            }
            if (new Date(session.scheduledStartTime).getTime() > Date.now()) {
                res.status(403).json({ success: false, message: `This consultation call is available at ${new Date(session.scheduledStartTime).toLocaleString()}.` });
                return;
            }
            if (session.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(session.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Complete and verify consultation payment before joining the call.' });
                return;
            }
            if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(session.status)) {
                res.status(409).json({ success: false, message: 'This consultation has ended and its meeting is no longer available.' });
                return;
            }
            const user = authReq.user;
            const firstName = typeof user.firstName === 'string' ? user.firstName : '';
            const lastName = typeof user.lastName === 'string' ? user.lastName : '';
            const suppliedName = typeof user.name === 'string' ? user.name : '';
            const displayName = (suppliedName || `${firstName} ${lastName}`.trim() ||
                (isPatient ? 'MedXVerse Patient' : 'MedXVerse Doctor')).slice(0, 100);
            const email = typeof user.email === 'string' ? user.email : undefined;
            const now = Math.floor(Date.now() / 1000);
            const expiresIn = env.JAAS_TOKEN_TTL_SECONDS;
            const roomName = `${appId}/${session.meetingRoomId}`;
            const tokenPayload = {
                aud: 'jitsi',
                iss: 'chat',
                sub: appId,
                room: session.meetingRoomId,
                nbf: now - 10,
                exp: now + expiresIn,
                context: {
                    user: {
                        id: String(user._id),
                        name: displayName,
                        ...(email ? { email } : {}),
                        moderator: !isPatient,
                    },
                    features: {
                        livestreaming: false,
                        recording: false,
                        transcription: false,
                        'outbound-call': false,
                    },
                },
            };
            // Explicitly type the options so TypeScript selects jsonwebtoken's
            // options overload rather than treating this object as a callback.
            const signingOptions = {
                algorithm: 'RS256',
                header: {
                    alg: 'RS256',
                    kid,
                    typ: 'JWT',
                },
            };
            const token = jwt.sign(tokenPayload, privateKey, signingOptions);
            res.status(200).json({
                success: true,
                data: {
                    domain: '8x8.vc',
                    appId,
                    roomName,
                    jwt: token,
                    meetingUrl: `https://8x8.vc/${roomName}`,
                    expiresAt: new Date((now + expiresIn) * 1000).toISOString(),
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Mark a call as ringing/in progress when either assigned participant opens
     * the meeting. This is separate from the clinical status endpoint so patients
     * can initiate a call without gaining permission to edit clinical notes or
     * complete/cancel the encounter.
     */
    async markCallStarted(req, res, next) {
        try {
            const authReq = req;
            const userType = authReq.user.userType;
            if (userType !== 'PATIENT' && userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the assigned patient or staff member can start this call.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            const id = String(req.params.id || '');
            const patientId = userType === 'PATIENT' ? String(authReq.user._id) : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const current = await telemedicineService.getSessionById(id, hospitalId, patientId, doctorId);
            if (!current) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found or you are not assigned to it.' });
                return;
            }
            if (current.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(current.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Complete and verify consultation payment before starting the call.' });
                return;
            }
            if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(current.status)) {
                res.status(409).json({ success: false, message: 'This consultation has ended and its call cannot be started.' });
                return;
            }
            if (current.status !== ConsultationStatus.IN_PROGRESS && new Date(current.scheduledStartTime).getTime() > Date.now()) {
                res.status(409).json({ success: false, message: 'This call is not available until its scheduled start time.' });
                return;
            }
            // Starting a call is a separate lifecycle from the clinical consultation.
            // Move a waiting-room consultation to IN_PROGRESS when appropriate, but
            // still record a new call attempt if the clinical session is already active.
            if (current.status === ConsultationStatus.WAITING_ROOM) {
                try {
                    await telemedicineService.updateSessionStatus(id, hospitalId, { status: ConsultationStatus.IN_PROGRESS }, patientId, doctorId);
                }
                catch (updateError) {
                    const latest = await telemedicineService.getSessionById(id, hospitalId, patientId, doctorId);
                    if (latest?.status !== ConsultationStatus.IN_PROGRESS)
                        throw updateError;
                }
            }
            const requestedCallId = String(req.body?.callId || '').trim();
            if (!requestedCallId || requestedCallId.length > 160) {
                res.status(400).json({ success: false, message: 'A valid call ID is required.' });
                return;
            }
            const sessionScope = {
                _id: id,
                hospitalId,
                ...(patientId ? { patientId } : {}),
                ...(doctorId ? { doctorId } : {}),
            };
            // Atomically claim a new call attempt. If patient and staff open the call
            // at nearly the same time, only one call ID is created; the second request
            // reuses it instead of inserting a second CALL_STARTED chat item.
            const callStartedAt = new Date();
            let updated = await TelemedicineSessionModel.findOneAndUpdate({
                ...sessionScope,
                $or: [
                    { activeCallId: { $exists: false } },
                    { activeCallId: '' },
                    { callEndedAt: { $exists: true } },
                ],
            }, {
                $set: {
                    callStartedAt,
                    activeCallId: requestedCallId,
                    callInitiatorType: userType,
                },
                $unset: { callEndedAt: 1, callAcceptedAt: 1 },
            }, { new: true }).exec();
            if (!updated) {
                updated = await TelemedicineSessionModel.findOne(sessionScope).exec();
            }
            if (!updated) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found.' });
                return;
            }
            const activeCallIsValid = Boolean(updated.activeCallId && updated.callStartedAt &&
                (!updated.callEndedAt || updated.callEndedAt.getTime() < updated.callStartedAt.getTime()));
            if (!activeCallIsValid) {
                res.status(409).json({ success: false, message: 'This call has already ended. Start a new call attempt.' });
                return;
            }
            const callId = String(updated.activeCallId);
            const activeCallStartedAt = updated.callStartedAt || callStartedAt;
            const callType = updated.consultationType === ConsultationType.VOICE ? 'VOICE' : 'VIDEO';
            await TelemedicineMessageModel.findOneAndUpdate({ hospitalId, sessionId: id, 'callSummary.callId': callId }, { $setOnInsert: {
                    hospitalId,
                    sessionId: id,
                    senderId: new Types.ObjectId(userType === 'STAFF' ? (doctorId || authReq.user._id) : authReq.user._id),
                    senderModel: userType === 'PATIENT' ? 'Patient' : 'User',
                    messageText: 'Calling…',
                    messageType: 'CALL_STARTED',
                    callSummary: { callId, callType, durationSeconds: 0, participantCount: 1 },
                    sentAt: activeCallStartedAt,
                } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * The callee explicitly answers the ringing call. This lets both portals and
     * the chat timeline distinguish a ringing attempt from an accepted call.
     */
    async acceptCall(req, res, next) {
        try {
            const authReq = req;
            const userType = authReq.user.userType;
            if (userType !== 'PATIENT' && userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the assigned patient or staff member can answer this call.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            const sessionId = String(req.params.id || '');
            const patientId = userType === 'PATIENT' ? String(authReq.user._id) : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(sessionId, hospitalId, patientId, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found or you are not assigned to it.' });
                return;
            }
            const callId = String(req.body?.callId || session.activeCallId || '').trim();
            if (!callId || callId.length > 160 || callId !== String(session.activeCallId || '')) {
                res.status(409).json({ success: false, message: 'This incoming call is no longer active.' });
                return;
            }
            if (session.callInitiatorType === userType) {
                res.status(403).json({ success: false, message: 'The caller cannot answer their own call.' });
                return;
            }
            if (!session.callStartedAt || (session.callEndedAt && session.callEndedAt.getTime() >= session.callStartedAt.getTime())) {
                res.status(409).json({ success: false, message: 'This call has already ended.' });
                return;
            }
            const scope = {
                _id: sessionId,
                hospitalId,
                activeCallId: callId,
                ...(patientId ? { patientId } : {}),
                ...(doctorId ? { doctorId } : {}),
                $or: [{ callEndedAt: { $exists: false } }, { callEndedAt: { $lt: session.callStartedAt } }],
            };
            const acceptedAt = new Date();
            const updated = await TelemedicineSessionModel.findOneAndUpdate(scope, { $set: { callAcceptedAt: acceptedAt } }, { new: true }).exec();
            if (!updated) {
                res.status(409).json({ success: false, message: 'This call has already ended.' });
                return;
            }
            await TelemedicineMessageModel.updateOne({ hospitalId, sessionId, messageType: 'CALL_STARTED', 'callSummary.callId': callId }, { $set: { messageText: 'In call', 'callSummary.participantCount': 2 } }).exec();
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    /** Save the final summary for a call without completing the clinical consultation. */
    async recordCallSummary(req, res, next) {
        try {
            const authReq = req;
            const userType = authReq.user.userType;
            if (userType !== 'PATIENT' && userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the assigned patient or staff member can end this call.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            const sessionId = String(req.params.id || '');
            const patientId = userType === 'PATIENT' ? String(authReq.user._id) : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(sessionId, hospitalId, patientId, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found or you are not assigned to it.' });
                return;
            }
            const callId = String(req.body?.callId || '').trim();
            const durationSeconds = Math.max(0, Math.floor(Number(req.body?.durationSeconds) || 0));
            const participantCount = Math.max(0, Math.floor(Number(req.body?.participantCount) || 0));
            // A call is missed only when the caller explicitly reports a missed
            // outcome AND nobody joined (participantCount === 0). One participant or
            // a positive duration is evidence that the call actually connected.
            // A call is missed if the recipient never joins. The local caller alone is not a connected call.
            const missedCall = req.body?.missedCall === true && participantCount < 2;
            if (!callId || callId.length > 160) {
                res.status(400).json({ success: false, message: 'A valid call ID is required.' });
                return;
            }
            const callType = session.consultationType === ConsultationType.VOICE ? 'VOICE' : 'VIDEO';
            const existingSummary = await TelemedicineMessageModel.findOne({
                hospitalId,
                sessionId,
                'callSummary.callId': callId,
            }).exec();
            const existingCallSummary = existingSummary?.callSummary;
            const existingHasJoinEvidence = Boolean(existingSummary?.messageType === 'CALL_SUMMARY' && existingCallSummary &&
                !existingCallSummary.missedCall &&
                (Number(existingCallSummary.durationSeconds || 0) > 0 || Number(existingCallSummary.participantCount || 0) >= 2));
            const incomingHasJoinEvidence = !missedCall && participantCount >= 2;
            // Both participants may submit a summary as they leave. Do not let a late
            // stale `missedCall` from one browser overwrite a successful call summary
            // recorded by the other browser. A later summary can improve the evidence,
            // but cannot downgrade a connected call to a missed call.
            let summary = existingSummary;
            if (existingSummary?.messageType === 'CALL_SUMMARY' &&
                ((existingHasJoinEvidence && missedCall) ||
                    (existingCallSummary?.missedCall === true && !incomingHasJoinEvidence))) {
                summary = existingSummary;
            }
            else {
                summary = await TelemedicineMessageModel.findOneAndUpdate({ hospitalId, sessionId, 'callSummary.callId': callId }, { $set: {
                        messageText: missedCall
                            ? (callType === 'VOICE' ? 'Missed voice call' : 'Missed video call')
                            : (callType === 'VOICE' ? 'Voice call ended' : 'Video call ended'),
                        messageType: 'CALL_SUMMARY',
                        callSummary: { callId, callType, durationSeconds, participantCount, missedCall },
                        sentAt: new Date(),
                    }, $setOnInsert: {
                        hospitalId,
                        sessionId,
                        senderId: new Types.ObjectId(userType === 'STAFF' ? (doctorId || authReq.user._id) : authReq.user._id),
                        senderModel: userType === 'PATIENT' ? 'Patient' : 'User',
                    } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
            }
            // A late summary from an older call must not end a newer call.
            await TelemedicineSessionModel.updateOne({ _id: sessionId, hospitalId, activeCallId: callId, ...(patientId ? { patientId } : {}), ...(doctorId ? { doctorId } : {}) }, { $set: { callEndedAt: new Date() } }).exec();
            res.status(200).json({ success: true, data: summary });
        }
        catch (error) {
            next(error);
        }
    }
    /** Doctor accepts a patient's consultation booking without prematurely starting the clinical session. */
    async acceptSessionOrder(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'STAFF' || String(authReq.user.role || '').toUpperCase() !== 'DOCTOR') {
                res.status(403).json({ success: false, message: 'Only the assigned doctor can accept a consultation order.' });
                return;
            }
            const doctorId = await resolveStaffRecordId(authReq);
            if (!doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            const sessionId = String(req.params.id || '');
            const session = await telemedicineService.getSessionById(sessionId, hospitalId, undefined, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation order not found or not assigned to you.' });
                return;
            }
            if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(session.status)) {
                res.status(409).json({ success: false, message: 'This consultation order is no longer active.' });
                return;
            }
            const acceptedAt = session.doctorAcceptedAt || new Date();
            const updated = await TelemedicineSessionModel.findOneAndUpdate({ _id: sessionId, hospitalId, doctorId }, { $set: { doctorAcceptedAt: acceptedAt } }, { new: true }).lean().exec();
            if (!updated) {
                res.status(404).json({ success: false, message: 'Consultation order could not be found.' });
                return;
            }
            res.status(200).json({ success: true, message: 'Consultation order accepted.', data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    async updateSessionStatus(req, res, next) {
        try {
            const authReq = req;
            const hospitalId = authReq.user.hospitalId;
            const id = req.params.id;
            const { status, clinicalNotes, recordingUrl } = req.body;
            if (authReq.user.userType === 'PATIENT' && status !== ConsultationStatus.CANCELLED) {
                res.status(403).json({ success: false, message: 'Patients may cancel a consultation but cannot change its clinical status.' });
                return;
            }
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            if (status === ConsultationStatus.IN_PROGRESS) {
                const current = await telemedicineService.getSessionById(String(id), String(hospitalId || ''), patientId, doctorId);
                if (current && current.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(current.paymentStatus))) {
                    res.status(402).json({ success: false, message: 'Consultation payment must be verified before the clinical session can start.' });
                    return;
                }
            }
            const updated = await telemedicineService.updateSessionStatus(id, hospitalId, {
                status: status,
                clinicalNotes: patientId ? undefined : clinicalNotes,
                recordingUrl: patientId ? undefined : recordingUrl,
            }, patientId, doctorId);
            if (!updated) {
                res.status(404).json({ success: false, message: 'Telemedicine session not found' });
                return;
            }
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            next(error);
        }
    }
    async sendMessage(req, res, next) {
        try {
            const authReq = req;
            const hospitalId = authReq.user.hospitalId;
            if (authReq.user.userType !== 'PATIENT' && authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the patient or assigned staff member can send consultation messages.' });
                return;
            }
            const { sessionId, messageText, attachmentUrl, attachmentName, attachmentMimeType, attachmentSize } = req.body;
            const senderModel = authReq.user.userType === 'PATIENT' ? 'Patient' : 'User';
            const staffRecordId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !staffRecordId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile. Ask your hospital administrator to link it.' });
                return;
            }
            // Sessions assign doctorId to Staff._id, not StaffUser._id.
            const senderId = authReq.user.userType === 'STAFF' ? staffRecordId : authReq.user._id;
            {
                const session = await telemedicineService.getSessionById(String(sessionId || ''), String(hospitalId || ''), authReq.user.userType === 'PATIENT' ? String(authReq.user._id || '') : undefined, authReq.user.userType === 'STAFF' ? staffRecordId : undefined);
                if (!session) {
                    res.status(404).json({ success: false, message: 'Consultation not found or you are not assigned to it.' });
                    return;
                }
                if (!session.doctorAcceptedAt) {
                    res.status(403).json({ success: false, message: 'The assigned doctor must accept this consultation order before messaging is enabled.' });
                    return;
                }
                if (session.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(session.paymentStatus))) {
                    res.status(402).json({ success: false, message: 'Complete and verify consultation payment before messaging the care team.' });
                    return;
                }
            }
            const message = await telemedicineService.sendMessage({
                hospitalId,
                sessionId,
                senderId,
                senderModel: senderModel || 'User',
                senderRole: String(authReq.user.userType || 'ACCOUNT'),
                messageText,
                attachmentUrl,
                attachmentName,
                attachmentMimeType,
                attachmentSize: attachmentSize === undefined ? undefined : Number(attachmentSize),
            });
            res.status(201).json({ success: true, data: message });
        }
        catch (error) {
            next(error);
        }
    }
    async uploadMessageAttachment(req, res, next) {
        try {
            const authReq = req;
            const file = req.file;
            if (!file?.buffer?.length) {
                res.status(400).json({ success: false, message: 'Choose an image or document to upload.' });
                return;
            }
            const allowedTypes = new Set([
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'application/pdf', 'text/plain', 'text/csv',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/rtf',
            ]);
            if (!allowedTypes.has(String(file.mimetype || '').toLowerCase())) {
                res.status(415).json({ success: false, message: 'Only images and common document formats are allowed.' });
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                res.status(413).json({ success: false, message: 'Attachments must be 10 MB or smaller.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            const sessionId = String(req.params.sessionId || '');
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            if (authReq.user.userType !== 'PATIENT' && authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the patient or assigned staff member can upload consultation attachments.' });
                return;
            }
            const attachmentSession = await telemedicineService.getSessionById(sessionId, hospitalId, patientId, doctorId);
            if (!attachmentSession) {
                res.status(404).json({ success: false, message: 'Consultation not found or you are not assigned to it.' });
                return;
            }
            if (!attachmentSession.doctorAcceptedAt) {
                res.status(403).json({ success: false, message: 'The assigned doctor must accept this consultation order before sharing consultation attachments.' });
                return;
            }
            if (attachmentSession.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(attachmentSession.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Complete and verify consultation payment before sharing consultation attachments.' });
                return;
            }
            await telemedicineService.getSessionMessages(sessionId, hospitalId, patientId, doctorId);
            if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                res.status(503).json({ success: false, message: 'File storage is not configured.' });
                return;
            }
            const isImage = file.mimetype.toLowerCase().startsWith('image/');
            const uploaded = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream({
                    folder: `medxverse/telemedicine/${hospitalId}/${sessionId}`,
                    resource_type: isImage ? 'image' : 'raw',
                    use_filename: false,
                    unique_filename: true,
                    overwrite: false,
                    tags: ['medxverse', 'telemedicine-attachment'],
                }, (error, result) => {
                    if (error || !result)
                        reject(error || new Error('Cloudinary upload failed.'));
                    else
                        resolve(result);
                });
                stream.end(file.buffer);
            });
            res.status(201).json({
                success: true,
                data: {
                    url: uploaded.secure_url,
                    name: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    publicId: uploaded.public_id,
                    resourceType: uploaded.resource_type,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /** Hospital-level payment overview for authorized administrators. */
    async getPaymentSummary(req, res, next) {
        try {
            const authReq = req;
            const role = String(authReq.user.role || '').toUpperCase();
            if (!['HOSPITAL_ADMIN', 'ADMIN', 'SYSTEM_ADMIN'].includes(role) || authReq.user.userType === 'PATIENT') {
                res.status(403).json({ success: false, message: 'Only authorized hospital administrators can view consultation payment summaries.' });
                return;
            }
            const hospitalId = String(authReq.user.hospitalId || '');
            if (!Types.ObjectId.isValid(hospitalId)) {
                res.status(400).json({ success: false, message: 'A valid hospital context is required.' });
                return;
            }
            const grouped = await TelemedicineSessionModel.aggregate([
                { $match: { hospitalId: new Types.ObjectId(hospitalId), paymentStatus: { $in: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] } } },
                { $group: { _id: '$paymentStatus', count: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ['$consultationFee', 0] } } } },
            ]);
            const recent = await TelemedicineSessionModel.find({ hospitalId, paymentStatus: { $in: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] } })
                .select('_id patientId doctorId consultationType scheduledStartTime paymentStatus consultationFee paymentCurrency paymentReference paymentPaidAt createdAt')
                .populate('patientId', 'firstName lastName mrn')
                .populate('doctorId', 'firstName lastName')
                .sort({ updatedAt: -1 }).limit(50).lean().exec();
            const summary = { pending: { count: 0, totalAmount: 0 }, paid: { count: 0, totalAmount: 0 }, failed: { count: 0, totalAmount: 0 }, refunded: { count: 0, totalAmount: 0 } };
            for (const row of grouped) {
                const key = String(row._id || '').toLowerCase();
                if (summary[key])
                    summary[key] = { count: Number(row.count || 0), totalAmount: Number(row.totalAmount || 0) };
            }
            res.status(200).json({ success: true, data: { currency: 'NGN', summary, recent } });
        }
        catch (error) {
            next(error);
        }
    }
    /** Create a laboratory requisition linked to this consultation and the existing HMS lab workflow. */
    async createLabRequest(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'STAFF' || String(authReq.user.role || '').toUpperCase() !== 'DOCTOR') {
                res.status(403).json({ success: false, message: 'Only the assigned doctor can request investigations.' });
                return;
            }
            const doctorId = await resolveStaffRecordId(authReq);
            if (!doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const sessionId = String(req.params.id || '');
            const session = await telemedicineService.getSessionById(sessionId, String(authReq.user.hospitalId || ''), undefined, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation not found or you are not the assigned doctor.' });
                return;
            }
            if (session.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(session.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Consultation payment must be verified before requesting investigations.' });
                return;
            }
            const body = req.body || {};
            const dto = {
                patientId: String(session.patientId?._id || session.patientId),
                doctorId,
                consultationId: sessionId,
                testName: String(body.testName || '').trim(),
                testCategory: body.testCategory,
                sampleType: String(body.sampleType || '').trim(),
                priority: body.priority,
                isStat: body.isStat === true,
                notes: String(body.notes || '').trim() || undefined,
            };
            const order = await LabService.createOrder(String(authReq.user.hospitalId || ''), doctorId, dto);
            res.status(201).json({ success: true, message: 'Investigation request sent to the hospital laboratory.', data: order });
        }
        catch (error) {
            next(error);
        }
    }
    /** Return only requisitions linked to a consultation the caller is authorized to access. */
    async getLabRequests(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'PATIENT' && authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the patient or assigned care team can view investigation requests.' });
                return;
            }
            const patientId = authReq.user.userType === 'PATIENT' ? String(authReq.user._id) : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(String(req.params.id || ''), String(authReq.user.hospitalId || ''), patientId, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation not found or you are not assigned to it.' });
                return;
            }
            if (session.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(session.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Complete and verify consultation payment before accessing consultation investigations.' });
                return;
            }
            const orders = await LabOrderModel.find({ hospitalId: authReq.user.hospitalId, consultationId: session._id })
                .select('_id testName testCategory panelName priority sampleType status createdAt updatedAt notes')
                .sort({ createdAt: -1 }).lean().exec();
            res.status(200).json({ success: true, data: orders });
        }
        catch (error) {
            next(error);
        }
    }
    async issuePrescription(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'STAFF' || String(authReq.user.role || '').toUpperCase() !== 'DOCTOR') {
                res.status(403).json({ success: false, message: 'Only an authenticated doctor can issue a prescription.' });
                return;
            }
            const doctorId = await resolveStaffRecordId(authReq);
            if (!doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const consultation = await telemedicineService.getSessionById(String(req.params.id || ''), String(authReq.user.hospitalId || ''), undefined, doctorId);
            if (!consultation) {
                res.status(404).json({ success: false, message: 'Consultation not found or you are not the assigned doctor.' });
                return;
            }
            if (consultation.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(consultation.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Consultation payment must be verified before issuing a prescription.' });
                return;
            }
            const data = await telemedicineService.issuePrescription({
                ...req.body,
                hospitalId: String(authReq.user.hospitalId || ''),
                sessionId: String(req.params.id || ''),
                doctorId,
            });
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    async verifyPrescription(req, res, next) {
        try {
            const data = await telemedicineService.verifyPrescription(String(req.params.verificationId || ''));
            res.status(data.valid ? 200 : 404).json({ success: data.valid, data });
        }
        catch (error) {
            next(error);
        }
    }
    async dispensePrescription(req, res, next) {
        try {
            const authReq = req;
            const role = String(authReq.user.role || '').toUpperCase();
            if (authReq.user.userType !== 'STAFF' || !['PHARMACIST', 'HOSPITAL_ADMIN'].includes(role)) {
                res.status(403).json({ success: false, message: 'Only authorized pharmacy staff can record dispensing.' });
                return;
            }
            const data = await telemedicineService.dispensePrescription({
                prescriptionId: String(req.params.id || ''),
                hospitalId: String(authReq.user.hospitalId || ''),
                pharmacistName: String(req.body.pharmacistName || authReq.user.name || ''),
                pharmacyName: String(req.body.pharmacyName || ''),
                notes: req.body.notes,
            });
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    async getSessionPrescriptions(req, res, next) {
        try {
            const authReq = req;
            if (authReq.user.userType !== 'PATIENT' && authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the patient or assigned staff member can view consultation prescriptions.' });
                return;
            }
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(String(req.params.id || ''), String(authReq.user.hospitalId || ''), patientId, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation not found or you are not assigned to it.' });
                return;
            }
            if (session.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(session.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Complete and verify consultation payment before accessing prescriptions.' });
                return;
            }
            const data = await telemedicineService.getSessionPrescriptions(String(req.params.id || ''), String(authReq.user.hospitalId || ''), patientId, doctorId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    async getSessionMessages(req, res, next) {
        try {
            const authReq = req;
            const hospitalId = authReq.user.hospitalId;
            const sessionId = req.params.sessionId;
            if (authReq.user.userType !== 'PATIENT' && authReq.user.userType !== 'STAFF') {
                res.status(403).json({ success: false, message: 'Only the patient or assigned doctor can view consultation messages.' });
                return;
            }
            const patientId = authReq.user.userType === 'PATIENT' ? authReq.user._id : undefined;
            const doctorId = await resolveStaffRecordId(authReq);
            if (authReq.user.userType === 'STAFF' && !doctorId) {
                res.status(403).json({ success: false, message: 'Your staff login is not linked to a staff profile.' });
                return;
            }
            const session = await telemedicineService.getSessionById(String(sessionId || ''), String(hospitalId || ''), patientId, doctorId);
            if (!session) {
                res.status(404).json({ success: false, message: 'Consultation not found or you are not assigned to it.' });
                return;
            }
            if (session.paymentStatus && !['PAID', 'NOT_REQUIRED'].includes(String(session.paymentStatus))) {
                res.status(402).json({ success: false, message: 'Complete and verify consultation payment before opening consultation chat.' });
                return;
            }
            const messages = await telemedicineService.getSessionMessages(sessionId, hospitalId, patientId, doctorId);
            res.status(200).json({ success: true, data: messages });
        }
        catch (error) {
            next(error);
        }
    }
}
export const telemedicineController = new TelemedicineController();

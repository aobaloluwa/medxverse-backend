import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { PatientModel } from '../patient/patient.model.js';
import { Staff } from '../staff/staff.model.js';
import { ProviderScheduleModel } from '../appointment/appointment.model.js';
import { TelemedicineSessionModel, TelemedicineMessageModel, TelemedicinePrescriptionModel } from './telemedicine.model.js';
import { Account } from '../auth/auth.model.js';
import {
  CreateTelemedicineSessionInput,
  UpdateSessionStatusInput,
  SendMessageInput,
  GetSessionsQuery,
  ITelemedicineSessionDocument,
  ITelemedicineMessageDocument,
  ConsultationStatus,
  ConsultationType,
  TelemedicineMessageType,
} from './telemedicine.types.js';
import { publishEhrResource } from '../patient/ehr.publisher.js';

export class TelemedicineService {
  public async createSession(
    input: CreateTelemedicineSessionInput
  ): Promise<ITelemedicineSessionDocument> {
    if (!Types.ObjectId.isValid(input.hospitalId) || !Types.ObjectId.isValid(input.patientId) || !Types.ObjectId.isValid(input.doctorId)) {
      throw new Error('A valid hospital, patient, and doctor ID are required.');
    }
    const scheduledStartTime = new Date(input.scheduledStartTime);
    if (Number.isNaN(scheduledStartTime.getTime()) || scheduledStartTime.getTime() < Date.now() - 60_000) {
      throw new Error('Choose a valid consultation date and time in the future.');
    }
    if (!Object.values(ConsultationType).includes(input.consultationType)) throw new Error('Choose a valid consultation type.');
    const [patient, doctor] = await Promise.all([
      PatientModel.findOne({ _id: input.patientId, hospitalId: input.hospitalId, active: true }).select('_id').lean(),
      Staff.findOne({ _id: input.doctorId, hospitalId: input.hospitalId }).select('_id').lean(),
    ]);
    if (!patient) throw new Error('The selected patient was not found in this hospital.');
    if (!doctor) throw new Error('The selected doctor was not found in this hospital.');
    if (input.followUpOfSessionId) {
      if (!Types.ObjectId.isValid(input.followUpOfSessionId)) throw new Error('Invalid follow-up consultation reference.');
      const previous = await TelemedicineSessionModel.findOne({ _id: input.followUpOfSessionId, hospitalId: input.hospitalId, patientId: input.patientId }).select('_id').lean();
      if (!previous) throw new Error('The follow-up must be linked to an earlier consultation for this patient.');
    }
    // Some project model typings infer findOne().lean() as a document-or-array union.
    // Normalize the result and explicitly describe the schedule fields used here so
    // TypeScript can safely access availability, timezone, and blockedTimes.
    const rosterResult = await ProviderScheduleModel.findOne({
      hospitalId: input.hospitalId,
      providerId: input.doctorId,
      active: true,
    }).lean().exec();

    type ProviderRoster = {
      availability?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
      }>;
      timezone?: string;
      blockedTimes?: Array<{
        startAt: Date | string;
        endAt: Date | string;
      }>;
    };

    const roster = (Array.isArray(rosterResult) ? rosterResult[0] : rosterResult) as ProviderRoster | null | undefined;

    if (roster && Array.isArray(roster.availability) && roster.availability.length > 0) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: roster.timezone || 'Africa/Lagos',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(scheduledStartTime);
      const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
      const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[part('weekday')];
      const time = `${part('hour')}:${part('minute')}`;
      const hasAvailability = roster.availability.some(
        (slot) => slot.dayOfWeek === weekday && time >= slot.startTime && time < slot.endTime,
      );
      if (!hasAvailability) {
        throw new Error('The selected time is outside this doctor’s configured duty roster. Choose an available time.');
      }
      const blocked = (roster.blockedTimes || []).some(
        (slot) => scheduledStartTime >= new Date(slot.startAt) && scheduledStartTime < new Date(slot.endAt),
      );
      if (blocked) throw new Error('The doctor is unavailable at this time. Choose another slot.');
    }
    const conflictingSession = await TelemedicineSessionModel.findOne({
      hospitalId: input.hospitalId,
      doctorId: input.doctorId,
      scheduledStartTime: { $gte: new Date(scheduledStartTime.getTime() - 29 * 60_000), $lt: new Date(scheduledStartTime.getTime() + 30 * 60_000) },
      status: { $nin: [ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW] },
    }).select('_id').lean();
    if (conflictingSession) throw new Error('This doctor already has a consultation scheduled around that time. Choose another time.');
    const meetingRoomId = `medxverse-${input.hospitalId}-${Date.now()}-${Math.random().toString(36).substring(2, 12)}`;
    const meetingBaseUrl = (process.env.TELEMEDICINE_MEETING_BASE_URL || 'https://meet.jit.si').replace(/\/+$/, '');
    const meetingUrl = `${meetingBaseUrl}/${meetingRoomId}${input.consultationType === ConsultationType.VOICE ? '#config.startWithVideoMuted=true' : ''}`;

    const session = await TelemedicineSessionModel.create({
      ...input,
      hospitalId: new Types.ObjectId(input.hospitalId),
      patientId: new Types.ObjectId(input.patientId),
      doctorId: new Types.ObjectId(input.doctorId),
      scheduledStartTime,
      meetingRoomId,
      meetingUrl,
      status: ConsultationStatus.WAITING_ROOM,
      joinedWaitingRoomAt: new Date(),
    });

    await publishEhrResource({
      hospitalId: input.hospitalId,
      patientId: input.patientId,
      actorId: input.doctorId,
      role: 'TELEMEDICINE',
      resourceType: 'Encounter',
      resourceId: session._id.toString(),
      status: session.status,
      department: 'Telemedicine',
      resource: {
        resourceType: 'Encounter',
        id: session._id.toString(),
        status: session.status,
        class: 'VR',
        type: { coding: [{ system: 'LOCAL', code: input.consultationType, display: 'Telemedicine consultation' }] },
        reason: input.chiefComplaint,
        period: { start: session.scheduledStartTime },
        sourceTelemedicineSessionId: session._id.toString(),
      },
      reason: 'Telemedicine encounter published to Unified EHR.',
    });

    return session;
  }

  public async getDirectory(hospitalId: string, includePatients = true): Promise<{ patients: unknown[]; doctors: unknown[] }> {
    if (!Types.ObjectId.isValid(hospitalId)) throw new Error('A valid hospital account is required.');
    const [patients, doctors] = await Promise.all([
      includePatients ? PatientModel.find({ hospitalId, active: true })
        .select('_id firstName lastName mrn phone email')
        .sort({ lastName: 1, firstName: 1 })
        .limit(250)
        .lean()
        .exec() : Promise.resolve([]),
      Staff.find({ hospitalId, $or: [{ role: { $regex: 'doctor|physician|specialist|consultant', $options: 'i' } }, { specialization: { $exists: true, $ne: '' } }] })
        .select('_id firstName lastName staffId role department specialization status')
        .sort({ lastName: 1, firstName: 1 })
        .limit(250)
        .lean()
        .exec(),
    ]);
    return { patients, doctors };
  }

  public async getSessions(
    hospitalId: string,
    query: GetSessionsQuery
  ): Promise<{ sessions: ITelemedicineSessionDocument[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { hospitalId };

    if (query.patientId) filter.patientId = query.patientId;
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.status) filter.status = query.status;
    if (query.consultationType) filter.consultationType = query.consultationType;

    const [sessions, total] = await Promise.all([
      TelemedicineSessionModel.find(filter)
        .populate('patientId', 'firstName lastName mrn phone')
        .populate('doctorId', 'firstName lastName role specialization')
        .sort({ scheduledStartTime: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      TelemedicineSessionModel.countDocuments(filter),
    ]);

    return {
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async getSessionById(
    sessionId: string,
    hospitalId: string,
    patientId?: string,
    doctorId?: string
  ): Promise<ITelemedicineSessionDocument | null> {
    return TelemedicineSessionModel.findOne({ _id: sessionId, hospitalId, ...(patientId ? { patientId } : {}), ...(doctorId ? { doctorId } : {}) })
      .populate('patientId', 'firstName lastName mrn dateOfBirth gender phone')
      .populate('doctorId', 'firstName lastName role specialization')
      .exec();
  }

  public async updateSessionStatus(
    sessionId: string,
    hospitalId: string,
    input: UpdateSessionStatusInput,
    patientId?: string,
    doctorId?: string
  ): Promise<ITelemedicineSessionDocument | null> {
    const scope = { _id: sessionId, hospitalId, ...(patientId ? { patientId } : {}), ...(doctorId ? { doctorId } : {}) };
    const current = await TelemedicineSessionModel.findOne(scope).exec();
    if (!current) return null;
    if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(current.status) && input.status !== current.status) {
      throw new Error('This consultation has already ended and cannot change status.');
    }
    if (input.status === ConsultationStatus.IN_PROGRESS && current.status !== ConsultationStatus.WAITING_ROOM) {
      throw new Error('Only consultations in the waiting room can be started.');
    }
    if (input.status === ConsultationStatus.COMPLETED && current.status !== ConsultationStatus.IN_PROGRESS) {
      throw new Error('Only an in-progress consultation can be completed.');
    }
    if (input.status === ConsultationStatus.CANCELLED && current.status !== ConsultationStatus.WAITING_ROOM) {
      throw new Error('Only consultations that have not started can be cancelled.');
    }
    const updateData: Record<string, unknown> = { status: input.status };

    if (input.status === ConsultationStatus.IN_PROGRESS) {
      updateData.actualStartTime = new Date();
    } else if (input.status === ConsultationStatus.COMPLETED) {
      const endTime = new Date();
      updateData.endTime = endTime;

      if (current.actualStartTime) {
        const durationMs = endTime.getTime() - current.actualStartTime.getTime();
        updateData.durationMinutes = Math.round(durationMs / 60000);
      }
    }

    if (input.clinicalNotes) updateData.clinicalNotes = input.clinicalNotes;
    if (input.recordingUrl) updateData.recordingUrl = input.recordingUrl;

    const updated = await TelemedicineSessionModel.findOneAndUpdate(
      { _id: sessionId, hospitalId, ...(patientId ? { patientId } : {}), ...(doctorId ? { doctorId } : {}) },
      { $set: updateData },
      { new: true }
    ).exec();

    if (updated) {
      await publishEhrResource({
        hospitalId,
        patientId: updated.patientId.toString(),
        actorId: updated.doctorId.toString(),
        role: 'TELEMEDICINE',
        resourceType: 'Encounter',
        resourceId: updated._id.toString(),
        status: updated.status,
        department: 'Telemedicine',
        resource: {
          resourceType: 'Encounter',
          id: updated._id.toString(),
          status: updated.status,
          class: 'VR',
          period: { start: updated.actualStartTime || updated.scheduledStartTime, end: updated.endTime },
          reason: updated.chiefComplaint,
          clinicalNotes: updated.clinicalNotes,
          durationMinutes: updated.durationMinutes,
          recordingUrl: updated.recordingUrl,
          sourceTelemedicineSessionId: updated._id.toString(),
        },
        reason: 'Updated telemedicine encounter published to Unified EHR.',
      });
    }

    return updated;
  }

  public async assertMessagingAllowed(sessionId: string, hospitalId: string, patientId?: string, doctorId?: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) throw new Error('Invalid consultation session.');
    const session = await TelemedicineSessionModel.findOne({
      _id: sessionId,
      hospitalId,
      ...(patientId ? { patientId } : {}),
      ...(doctorId ? { doctorId } : {}),
    }).select('consultationType status').lean();
    if (!session) throw new Error('Consultation session not found.');
    if (session.consultationType !== ConsultationType.CHAT) {
      throw new ApiError(409, `This consultation is ${session.consultationType.toLowerCase()}-only. Messaging and attachments are disabled for this session.`);
    }
    if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(session.status)) {
      throw new ApiError(409, 'This consultation has ended. Messages and attachments are no longer allowed. Book a follow-up consultation to continue.');
    }
  }

  public async sendMessage(input: SendMessageInput): Promise<ITelemedicineMessageDocument> {
    if (!Types.ObjectId.isValid(input.sessionId) || !Types.ObjectId.isValid(input.senderId)) throw new Error('A valid session and sender are required.');
    const session = await TelemedicineSessionModel.findOne({ _id: input.sessionId, hospitalId: input.hospitalId }).select('patientId doctorId consultationType status').lean();
    if (!session) throw new Error('Consultation session not found.');
    if (session.consultationType !== ConsultationType.CHAT) throw new ApiError(409, `This consultation is ${session.consultationType.toLowerCase()}-only. Messaging and attachments are disabled for this session.`);
    if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(session.status)) throw new ApiError(409, 'This consultation has ended. Messages and attachments are no longer allowed. Book a follow-up consultation to continue.');
    if (input.senderModel === 'Patient' && session.patientId.toString() !== input.senderId) throw new Error('You are not the patient assigned to this consultation.');
    if (input.senderModel === 'User' && input.senderRole === 'STAFF' && session.doctorId.toString() !== input.senderId) throw new Error('Only the assigned doctor can message this patient through this consultation.');
    if (!input.messageText?.trim() && !input.attachmentUrl) throw new Error('Message text or an attachment is required.');
    if (input.attachmentUrl) {
      if (!input.attachmentUrl.startsWith('https://res.cloudinary.com/')) {
        throw new Error('Attachments must be uploaded through MedXVerse file storage first.');
      }
      const allowedAttachmentTypes = new Set([
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf', 'text/plain', 'text/csv', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/rtf',
      ]);
      if (!input.attachmentName || !allowedAttachmentTypes.has(String(input.attachmentMimeType || '').toLowerCase())) {
        throw new Error('The attachment filename or file type is invalid.');
      }
      if (Number(input.attachmentSize || 0) > 10 * 1024 * 1024) throw new Error('Attachments must be 10 MB or smaller.');
    }
    return TelemedicineMessageModel.create({
      ...input,
      messageText: input.messageText?.trim() || (input.attachmentName ? `Attachment: ${input.attachmentName}` : 'Attachment'),
      hospitalId: new Types.ObjectId(input.hospitalId),
      sessionId: new Types.ObjectId(input.sessionId),
      senderId: new Types.ObjectId(input.senderId),
    });
  }

  public async recordCallSummary(input: {
    sessionId: string;
    hospitalId: string;
    senderId: string;
    senderModel: 'User' | 'Patient';
    senderRole?: string;
    callId: string;
    durationSeconds: number;
    participantCount: number;
  }): Promise<ITelemedicineMessageDocument> {
    if (![input.sessionId, input.hospitalId, input.senderId].every(Types.ObjectId.isValid)) {
      throw new Error('A valid consultation session and participant are required.');
    }
    const callId = String(input.callId || '').trim();
    if (!callId || callId.length > 100) throw new Error('A valid call reference is required.');

    const durationSeconds = Math.max(0, Math.min(86400, Math.floor(Number(input.durationSeconds) || 0)));
    const participantCount = Math.max(1, Math.min(20, Math.floor(Number(input.participantCount) || 1)));

    const session = await TelemedicineSessionModel.findOne({
      _id: input.sessionId,
      hospitalId: input.hospitalId,
    }).select('patientId doctorId consultationType status').lean();
    if (!session) throw new Error('Consultation session not found.');
    if (session.consultationType === ConsultationType.CHAT) throw new ApiError(409, 'This is a messages-only consultation. Voice and video calls are disabled.');
    if ([ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW].includes(session.status)) throw new ApiError(409, 'This consultation has ended. New calls are not allowed. Book a follow-up consultation to continue.');

    if (input.senderModel === 'Patient' && session.patientId.toString() !== input.senderId) {
      throw new Error('You are not the patient assigned to this consultation.');
    }
    if (input.senderModel === 'User' && input.senderRole === 'STAFF' && session.doctorId.toString() !== input.senderId) {
      throw new Error('Only the assigned doctor can record a call summary for this consultation.');
    }
    if (input.senderModel !== 'Patient' && input.senderRole !== 'STAFF') {
      throw new Error('Only the assigned patient or staff member can record a call summary.');
    }
    if (session.consultationType !== ConsultationType.VIDEO && session.consultationType !== ConsultationType.VOICE) {
      throw new Error('Call summaries are available only for voice and video consultations.');
    }

    const existing = await TelemedicineMessageModel.findOne({
      sessionId: input.sessionId,
      hospitalId: input.hospitalId,
      'callSummary.callId': callId,
    }).exec();
    if (existing) return existing;

    const callType = session.consultationType;
    const durationLabel = durationSeconds < 60
      ? `${durationSeconds} ${durationSeconds === 1 ? 'second' : 'seconds'}`
      : `${Math.floor(durationSeconds / 60)} ${Math.floor(durationSeconds / 60) === 1 ? 'minute' : 'minutes'}${durationSeconds % 60 ? ` ${durationSeconds % 60} sec` : ''}`;
    const participantLabel = `${participantCount} ${participantCount === 1 ? 'participant' : 'participants'} joined`;
    const messageText = `${callType === ConsultationType.VIDEO ? 'Video' : 'Voice'} call · ${durationLabel} · ${participantLabel}`;

    try {
      return await TelemedicineMessageModel.create({
        hospitalId: new Types.ObjectId(input.hospitalId),
        sessionId: new Types.ObjectId(input.sessionId),
        senderId: new Types.ObjectId(input.senderId),
        senderModel: input.senderModel,
        messageText,
        messageType: TelemedicineMessageType.CALL_SUMMARY,
        callSummary: { callId, callType, durationSeconds, participantCount },
        sentAt: new Date(),
      });
    } catch (error) {
      // If two participants submit the same call summary simultaneously, return
      // the already-saved record instead of surfacing a duplicate-key error.
      const duplicate = await TelemedicineMessageModel.findOne({
        sessionId: input.sessionId,
        hospitalId: input.hospitalId,
        'callSummary.callId': callId,
      }).exec();
      if (duplicate) return duplicate;
      throw error;
    }
  }

  public async getSessionMessages(
    sessionId: string,
    hospitalId: string,
    patientId?: string,
    doctorId?: string
  ): Promise<ITelemedicineMessageDocument[]> {
    if (!Types.ObjectId.isValid(sessionId)) throw new Error('Invalid consultation session.');
    const session = await TelemedicineSessionModel.findOne({ _id: sessionId, hospitalId, ...(patientId ? { patientId } : {}), ...(doctorId ? { doctorId } : {}) }).select('_id').lean();
    if (!session) throw new Error('Consultation session not found.');
    return TelemedicineMessageModel.find({ sessionId, hospitalId })
      .sort({ sentAt: 1 })
      .exec();
  }

  public async issuePrescription(input: {
    hospitalId: string;
    sessionId: string;
    doctorId: string;
    telemedicinePlatform?: string;
    diagnosis: string;
    clinicalNotes?: string;
    medications: Array<{
      genericName: string; strengthForm: string; dosageFrequency: string;
      duration: string; quantity: string; route: string;
    }>;
    patientInstructions?: string;
    pharmacistInstructions?: string;
    genericSubstitutionPermitted?: boolean;
    refillAuthorized?: boolean;
    numberOfRefills?: number;
    controlledSubstance?: boolean;
    digitalSignature: string;
  }) {
    if (![input.hospitalId, input.sessionId, input.doctorId].every(Types.ObjectId.isValid)) {
      throw new Error('A valid hospital, consultation and prescriber are required.');
    }
    if (!input.diagnosis?.trim()) throw new Error('Diagnosis is required.');
    if (!input.digitalSignature?.trim()) throw new Error('The prescriber must provide an electronic signature acknowledgment.');
    if (!Array.isArray(input.medications) || input.medications.length < 1 || input.medications.length > 6) {
      throw new Error('Add between 1 and 6 medications.');
    }
    for (const [index, medication] of input.medications.entries()) {
      if (!medication.genericName?.trim() || !medication.strengthForm?.trim() ||
          !medication.dosageFrequency?.trim() || !medication.duration?.trim() ||
          !medication.quantity?.trim() || !medication.route?.trim()) {
        throw new Error(`Complete all required fields for medication ${index + 1}.`);
      }
    }
    const session = await TelemedicineSessionModel.findOne({
      _id: input.sessionId, hospitalId: input.hospitalId, doctorId: input.doctorId,
    }).lean();
    if (!session) throw new Error('Only the doctor assigned to this consultation can issue its prescription.');

    const [patient, doctor, hospital] = await Promise.all([
      PatientModel.findOne({ _id: session.patientId, hospitalId: input.hospitalId, active: true })
        .select('_id firstName lastName dateOfBirth universalPatientId mrn phone address allergies email').lean(),
      Staff.findOne({ _id: input.doctorId, hospitalId: input.hospitalId })
        .select('_id firstName lastName professionalRegistrations').lean(),
      Account.findById(input.hospitalId).select('_id name').lean(),
    ]);
    if (!patient || !doctor) throw new Error('The patient or prescriber record could not be verified.');

    // Identity is derived only from the assigned session and trusted database
    // records. Never accept doctor, patient, facility, or registration details
    // supplied by the browser as authoritative prescription metadata.
    const registrations: any[] = Array.isArray((doctor as any).professionalRegistrations)
      ? (doctor as any).professionalRegistrations : [];
    const now = new Date();
    const verifiedRegistration = registrations.find((item) =>
      item?.registrationNumber?.trim() &&
      String(item?.status || '').toUpperCase() === 'VERIFIED' &&
      (!item?.expiryDate || new Date(item.expiryDate).getTime() > now.getTime())
    );
    // Professional registration is optional in this workflow. When a verified,
    // unexpired credential exists, include it in the prescription metadata;
    // otherwise leave the registration fields blank and do not block issuance.
    const registrationNumber = verifiedRegistration?.registrationNumber?.trim() || undefined;

    const prescriberName =
      `${(doctor as any).firstName || ''} ${(doctor as any).lastName || ''}`.trim();
    if (!prescriberName) {
      throw new Error('The assigned doctor profile must include the doctor’s full name before a prescription can be issued.');
    }
    const issuedAt = new Date();
    const verificationId = `MHMS-${new Types.ObjectId().toString().toUpperCase()}`;
    const prescription = await TelemedicinePrescriptionModel.create({
      hospitalId: new Types.ObjectId(input.hospitalId),
      sessionId: session._id,
      patientId: session.patientId,
      doctorId: session.doctorId,
      facilityName: (hospital as any)?.name || 'MHMS Registered Facility',
      prescriberName,
      professionalRegistrationNumber: registrationNumber,
      telemedicinePlatform: input.telemedicinePlatform?.trim() || 'MedXVerse',
      dateIssued: issuedAt,
      patientSnapshot: {
        fullName: `${(patient as any).firstName} ${(patient as any).lastName}`.trim(),
        dateOfBirth: (patient as any).dateOfBirth,
        patientIdNumber: (patient as any).universalPatientId || (patient as any).mrn,
        contactNumber: (patient as any).phone,
        residentialAddress: (patient as any).address,
        knownDrugAllergies: ((patient as any).allergies || []).map((item: any) => item.allergen).filter(Boolean),
      },
      diagnosis: input.diagnosis.trim(),
      clinicalNotes: input.clinicalNotes?.trim(),
      medications: input.medications,
      patientInstructions: input.patientInstructions?.trim(),
      pharmacistInstructions: input.pharmacistInstructions?.trim(),
      genericSubstitutionPermitted: Boolean(input.genericSubstitutionPermitted),
      refillAuthorized: Boolean(input.refillAuthorized),
      numberOfRefills: input.refillAuthorized ? Math.max(0, Math.min(12, Number(input.numberOfRefills) || 0)) : 0,
      controlledSubstance: Boolean(input.controlledSubstance),
      prescriberAuthorizationId: registrationNumber,
      digitalSignature: input.digitalSignature.trim(),
      signatureMethod: 'TYPED_NAME_ACKNOWLEDGMENT',
      signedAt: issuedAt,
      verificationId,
      status: 'ISSUED',
    });

    // Publish a structured medication resource into the existing HMS unified EHR.
    await publishEhrResource({
      hospitalId: input.hospitalId,
      patientId: String(session.patientId),
      actorId: input.doctorId,
      role: 'DOCTOR',
      resourceType: 'MedicationStatement',
      resourceId: String(prescription._id),
      status: 'ISSUED',
      department: 'Telemedicine',
      code: { system: 'MHMS-TM-RX-01', code: 'TELEMEDICINE_PRESCRIPTION', display: 'Telemedicine prescription' },
      resource: {
        resourceType: 'MedicationStatement',
        id: String(prescription._id),
        status: 'active',
        effectiveDateTime: issuedAt,
        medication: input.medications.map((medication) => ({
          genericName: medication.genericName,
          strengthForm: medication.strengthForm,
          dosageFrequency: medication.dosageFrequency,
          duration: medication.duration,
          quantity: medication.quantity,
          route: medication.route,
        })),
        reasonCode: input.diagnosis,
        note: input.clinicalNotes,
        sourceTelemedicineSessionId: String(session._id),
        prescriptionId: String(prescription._id),
        verificationId,
      },
      reason: 'Telemedicine prescription issued and recorded in the patient EHR.',
    });

    await TelemedicineMessageModel.create({
      hospitalId: new Types.ObjectId(input.hospitalId),
      sessionId: session._id,
      senderId: session.doctorId,
      senderModel: 'User',
      messageText: `Prescription issued (${verificationId}).`,
      prescriptionId: prescription._id,
      sentAt: issuedAt,
    });

    return prescription;
  }



  
  public async verifyPrescription(verificationId: string) {
    const value = String(verificationId || '').trim();

    if (!value || value.length > 100) {
      throw new Error('A valid prescription verification ID is required.');
    }

    const prescriptionResult = await TelemedicinePrescriptionModel.findOne({
      verificationId: value,
    })
      .select(
        'verificationId status facilityName prescriberName professionalRegistrationNumber dateIssued'
      )
      .lean()
      .exec();

    // Normalize the result because the model typings may infer
    // a document-or-array union.
    type PrescriptionVerificationRecord = {
      verificationId: string;
      status: string;
      facilityName?: string;
      prescriberName?: string;
      professionalRegistrationNumber?: string;
      dateIssued?: Date;
    };

    const prescription = (
      Array.isArray(prescriptionResult)
        ? prescriptionResult[0]
        : prescriptionResult
    ) as PrescriptionVerificationRecord | null | undefined;

    if (!prescription) {
      return {
        valid: false,
        status: 'NOT_FOUND',
        message: 'Prescription verification ID was not found.',
      };
    }

    const valid = prescription.status !== 'CANCELLED';

    return {
      valid,
      status: prescription.status,
      verificationId: prescription.verificationId,
      facilityName: prescription.facilityName,
      prescriberName: prescription.prescriberName,
      professionalRegistrationNumber:
        prescription.professionalRegistrationNumber,
      dateIssued: prescription.dateIssued,
      message: valid
        ? 'Prescription record verified.'
        : 'This prescription has been cancelled.',
    };
  }


  public async dispensePrescription(input: {
    prescriptionId: string;
    hospitalId: string;
    pharmacistName: string;
    pharmacyName: string;
    notes?: string;
  }) {
    if (!Types.ObjectId.isValid(input.prescriptionId) || !Types.ObjectId.isValid(input.hospitalId)) {
      throw new Error('A valid prescription is required.');
    }
    if (!input.pharmacistName?.trim() || !input.pharmacyName?.trim()) {
      throw new Error('Pharmacist name and pharmacy/facility name are required.');
    }
    const prescription = await TelemedicinePrescriptionModel.findOne({
      _id: input.prescriptionId, hospitalId: input.hospitalId,
    });
    if (!prescription) throw new Error('Prescription not found.');
    if (prescription.status === 'CANCELLED') throw new Error('A cancelled prescription cannot be dispensed.');
    if (prescription.status === 'DISPENSED') throw new Error('This prescription has already been marked as dispensed.');
    prescription.status = 'DISPENSED';
    prescription.pharmacyDispensing = {
      dispensedBy: input.pharmacistName.trim(),
      pharmacyName: input.pharmacyName.trim(),
      dateDispensed: new Date(),
      notes: input.notes?.trim(),
    };
    await prescription.save();
    await publishEhrResource({
      hospitalId: input.hospitalId,
      patientId: String(prescription.patientId),
      actorId: String(prescription.doctorId),
      role: 'PHARMACIST',
      resourceType: 'MedicationStatement',
      resourceId: String(prescription._id),
      status: 'DISPENSED',
      department: 'Pharmacy',
      code: { system: 'MHMS-TM-RX-01', code: 'TELEMEDICINE_PRESCRIPTION', display: 'Telemedicine prescription' },
      resource: {
        resourceType: 'MedicationStatement',
        id: String(prescription._id),
        status: 'completed',
        prescriptionId: String(prescription._id),
        verificationId: prescription.verificationId,
        pharmacyDispensing: prescription.pharmacyDispensing,
        medication: prescription.medications,
      },
      reason: 'Pharmacy dispensing details recorded against the patient EHR prescription.',
    });
    return prescription;
  }

  public async getSessionPrescriptions(sessionId: string, hospitalId: string, patientId?: string, doctorId?: string) {
    if (!Types.ObjectId.isValid(sessionId)) throw new Error('Invalid consultation session.');
    const session = await TelemedicineSessionModel.findOne({
      _id: sessionId, hospitalId, ...(patientId ? { patientId } : {}), ...(doctorId ? { doctorId } : {}),
    }).select('_id').lean();
    if (!session) throw new Error('Consultation session not found.');
    return TelemedicinePrescriptionModel.find({ sessionId, hospitalId }).sort({ dateIssued: -1 }).lean().exec();
  }

}

export const telemedicineService = new TelemedicineService();
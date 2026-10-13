import { Document, Types } from 'mongoose';

export enum ConsultationType {
  VIDEO = 'VIDEO',
  VOICE = 'VOICE',
  CHAT = 'CHAT',
}

export enum ConsultationStatus {
  WAITING_ROOM = 'WAITING_ROOM',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export interface ITelemedicineSession {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  consultationType: ConsultationType;
  status: ConsultationStatus;
  scheduledStartTime: Date;
  joinedWaitingRoomAt?: Date;
  actualStartTime?: Date;
  callStartedAt?: Date;
  callEndedAt?: Date;
  activeCallId?: string;
  endTime?: Date;
  durationMinutes?: number;
  meetingRoomId: string;
  meetingUrl?: string;
  chiefComplaint?: string;
  clinicalNotes?: string;
  recordingUrl?: string;
  followUpOfSessionId?: Types.ObjectId;
}

export interface ITelemedicineSessionDocument extends ITelemedicineSession, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ITelemedicineMessage {
  hospitalId: Types.ObjectId;
  sessionId: Types.ObjectId;
  senderId: Types.ObjectId;
  senderModel: 'User' | 'Patient';
  messageText: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  prescriptionId?: Types.ObjectId;
  sentAt: Date;
  messageType?: 'TEXT' | 'CALL_STARTED' | 'CALL_SUMMARY';
  callSummary?: { callId: string; callType: 'VIDEO' | 'VOICE'; durationSeconds: number; participantCount: number; missedCall?: boolean };
}

export interface ITelemedicineMessageDocument extends ITelemedicineMessage, Document {}

export interface CreateTelemedicineSessionInput {
  hospitalId: string;
  patientId: string;
  doctorId: string;
  consultationType: ConsultationType;
  scheduledStartTime: Date;
  chiefComplaint?: string;
  followUpOfSessionId?: string;
}

export interface UpdateSessionStatusInput {
  status: ConsultationStatus;
  clinicalNotes?: string;
  recordingUrl?: string;
}

export interface SendMessageInput {
  hospitalId: string;
  sessionId: string;
  senderId: string;
  senderModel: 'User' | 'Patient';
  messageText: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  senderRole?: string;
}

export interface GetSessionsQuery {
  page?: number;
  limit?: number;
  patientId?: string;
  doctorId?: string;
  status?: ConsultationStatus;
  consultationType?: ConsultationType;
}
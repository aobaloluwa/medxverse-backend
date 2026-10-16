import { Document, Types } from 'mongoose';

export enum IncidentStatus {
  REQUEST_RECEIVED = 'REQUEST_RECEIVED',
  DISPATCH_REVIEW = 'DISPATCH_REVIEW',
  OFFERED_TO_CREW = 'OFFERED_TO_CREW',
  CREW_CONFIRMED = 'CREW_CONFIRMED',
  EN_ROUTE = 'EN_ROUTE',
  ON_SCENE = 'ON_SCENE',
  TRANSPORTING = 'TRANSPORTING',
  HANDED_OVER = 'HANDED_OVER',
  CANCELLED = 'CANCELLED',
  NO_RESOURCE_AVAILABLE = 'NO_RESOURCE_AVAILABLE',
}

export enum IncidentPriority { UNTRIAGED = 'UNTRIAGED', ROUTINE = 'ROUTINE', URGENT = 'URGENT', CRITICAL = 'CRITICAL' }
export enum ProviderVerificationStatus { PENDING = 'PENDING', UNDER_REVIEW = 'UNDER_REVIEW', VERIFIED = 'VERIFIED', REJECTED = 'REJECTED', SUSPENDED = 'SUSPENDED' }
export enum ProviderOperationalStatus { OFFLINE = 'OFFLINE', AVAILABLE = 'AVAILABLE', BUSY = 'BUSY' }
export enum RescueVehicleClass { BASIC_LIFE_SUPPORT = 'BASIC_LIFE_SUPPORT', ADVANCED_LIFE_SUPPORT = 'ADVANCED_LIFE_SUPPORT', PATIENT_TRANSPORT = 'PATIENT_TRANSPORT', ICU_AMBULANCE = 'ICU_AMBULANCE', NEONATAL = 'NEONATAL' }
export enum DispatchOfferStatus { PENDING = 'PENDING', ACCEPTED = 'ACCEPTED', DECLINED = 'DECLINED', EXPIRED = 'EXPIRED', WITHDRAWN = 'WITHDRAWN' }

export interface IGeoPoint { type: 'Point'; coordinates: [number, number] }
export interface IIncidentEvent { status: IncidentStatus; at: Date; actorType: 'GUEST' | 'STAFF' | 'SYSTEM' | 'CREW'; actorId?: Types.ObjectId; note?: string }
export interface IEmergencyIncident extends Document {
  publicReference: string; status: IncidentStatus; priority: IncidentPriority; intakeChannel: string;
  callerName?: string; callerPhone: string; callerIsPatient: boolean; patientName?: string; patientAge?: number;
  chiefComplaint: string; additionalDetails?: string; location: IGeoPoint; landmark?: string; locationAccuracyMeters?: number;
  destinationFacilityId?: Types.ObjectId; providerId?: Types.ObjectId; vehicleId?: Types.ObjectId; acceptedOfferId?: Types.ObjectId;
  guestTokenHash: string; guestTokenExpiresAt: Date; idempotencyKey: string; idempotencyFingerprint: string; events: IIncidentEvent[];
  createdAt: Date; updatedAt: Date; cancelledAt?: Date; handedOverAt?: Date;
}
export interface IRescueProvider extends Document {
  legalName: string; displayName: string; registrationNumber?: string; contactName: string; contactPhone: string; contactEmail?: string;
  operatingAreas: string[]; verificationStatus: ProviderVerificationStatus; operationalStatus: ProviderOperationalStatus;
  submittedDocuments: { kind: string; reference: string; uploadedAt: Date }[]; reviewedBy?: Types.ObjectId; reviewedAt?: Date; reviewNotes?: string;
  createdAt: Date; updatedAt: Date;
}
export interface IRescueVehicle extends Document {
  providerId: Types.ObjectId; registrationNumber: string; makeModel: string; vehicleClass: RescueVehicleClass;
  equipment: string[]; crewQualifications: string[]; status: ProviderOperationalStatus | 'DISPATCHED' | 'MAINTENANCE';
  location?: IGeoPoint; locationUpdatedAt?: Date; locationAccuracyMeters?: number; activeIncidentId?: Types.ObjectId;
  createdAt: Date; updatedAt: Date;
}
export interface IDispatchOffer extends Document {
  incidentId: Types.ObjectId; providerId: Types.ObjectId; vehicleId: Types.ObjectId; status: DispatchOfferStatus;
  offeredBy: Types.ObjectId; offeredAt: Date; expiresAt: Date; respondedAt?: Date; responseNote?: string;
}
export interface IRescueAudit extends Document {
  incidentId?: Types.ObjectId; actorType: string; actorId?: Types.ObjectId; action: string; reason?: string;
  metadata?: Record<string, unknown>; createdAt: Date;
}


export enum FacilityAcceptanceStatus { PENDING = 'PENDING', ACCEPTED = 'ACCEPTED', DECLINED = 'DECLINED', EXPIRED = 'EXPIRED' }

export interface IRescueFacility extends Document {
  name: string;
  ownerAccountId: Types.ObjectId;
  facilityType: string;
  address: string;
  location: IGeoPoint;
  capabilities: string[];
  operatingHours?: string;
  emergencyContactPhone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFacilityAcceptance extends Document {
  incidentId: Types.ObjectId;
  facilityId: Types.ObjectId;
  status: FacilityAcceptanceStatus;
  requestedBy: Types.ObjectId;
  requestedAt: Date;
  respondedBy?: Types.ObjectId;
  respondedAt?: Date;
  responseNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IClinicalHandover extends Document {
  incidentId: Types.ObjectId;
  facilityId: Types.ObjectId;
  acceptedBy: Types.ObjectId;
  handedOverBy: Types.ObjectId;
  handedOverAt: Date;
  summary: string;
  clinicalNotes?: string;
  vitalSigns?: Record<string, unknown>;
  createdAt: Date;
}


export interface IRescueProviderMember extends Document {
  providerId: Types.ObjectId;
  userId: Types.ObjectId;
  memberRole: 'PROVIDER_ADMIN' | 'CREW' | 'DRIVER' | 'PARAMEDIC';
  active: boolean;
  linkedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

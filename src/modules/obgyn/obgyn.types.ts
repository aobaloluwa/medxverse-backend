import { Types } from 'mongoose';

export type ObgynRecordType = 'PREGNANCY' | 'GYNECOLOGY';
export type ObgynPregnancyStatus = 'ACTIVE' | 'DELIVERED' | 'TERMINATED' | 'COMPLETED';
export type ObgynDeliveryMode = 'SPONTANEOUS_VAGINAL' | 'ASSISTED_VAGINAL' | 'CESAREAN_SECTION' | 'OTHER';
export type ObgynDeliveryOutcome = 'LIVE_BIRTH' | 'STILLBIRTH' | 'NEONATAL_DEATH' | 'OTHER';

export interface IObgynRecord {
  hospitalId: Types.ObjectId; patientId: Types.ObjectId; recordType: ObgynRecordType;
  gravida?: number; para?: number; abortions?: number; livingChildren?: number;
  lastMenstrualPeriod?: Date; ultrasoundDatingDate?: Date; ultrasoundGestationalAgeWeeks?: number; estimatedDeliveryDate?: Date;
  pregnancyStatus?: ObgynPregnancyStatus; riskFlags: string[]; dangerSigns: string[]; consentToShare: boolean; consentUpdatedAt?: Date;
  ancVisits: any[]; pncVisits: any[]; delivery?: any; gynecologyVisits: any[]; familyPlanningRecords: any[]; referrals: any[]; auditTrail: any[];
  menstrualHistory?: { cycleLengthDays?: number; periodDurationDays?: number; lastPeriodDate?: Date; symptoms?: string[]; abnormalBleeding?: boolean };
  createdBy: Types.ObjectId; isActive: boolean; createdAt: Date; updatedAt: Date;
}
export interface CreateObgynRecordInput {
  patientId: string; recordType: ObgynRecordType; gravida?: number; para?: number; abortions?: number; livingChildren?: number;
  lastMenstrualPeriod?: string; ultrasoundDatingDate?: string; ultrasoundGestationalAgeWeeks?: number; estimatedDeliveryDate?: string;
  riskFlags?: string[]; consentToShare?: boolean;
  menstrualHistory?: { cycleLengthDays?: number; periodDurationDays?: number; lastPeriodDate?: string; symptoms?: string[]; abnormalBleeding?: boolean };
}
export interface ObgynListQuery { page?: number; limit?: number; recordType?: ObgynRecordType; pregnancyStatus?: ObgynPregnancyStatus; search?: string; highRisk?: boolean }

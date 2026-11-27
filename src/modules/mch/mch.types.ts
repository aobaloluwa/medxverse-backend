import { Document, Types } from 'mongoose';

export enum MchCareType {
  ANTENATAL = 'ANTENATAL',
  POSTNATAL = 'POSTNATAL',
  CHILD_HEALTH = 'CHILD_HEALTH',
  FAMILY_PLANNING = 'FAMILY_PLANNING',
}

export enum PregnancyStatus {
  ACTIVE = 'ACTIVE',
  DELIVERED = 'DELIVERED',
  TERMINATED = 'TERMINATED',
}

export enum DeliveryType {
  SPONTANEOUS_VAGINAL = 'SPONTANEOUS_VAGINAL',
  ASSISTED_VAGINAL = 'ASSISTED_VAGINAL',
  CESAREAN_SECTION = 'CESAREAN_SECTION',
  FORCEPS = 'FORCEPS',
  VACUUM = 'VACUUM',
}

export enum DeliveryOutcome {
  LIVE_BIRTH = 'LIVE_BIRTH',
  STILL_BIRTH = 'STILL_BIRTH',
  NEONATAL_DEATH = 'NEONATAL_DEATH',
}

export enum FamilyPlanningMethod {
  ORAL_PILLS = 'ORAL_PILLS',
  INJECTABLE_DEPO = 'INJECTABLE_DEPO',
  IUD_COPPER = 'IUD_COPPER',
  IUD_HORMONAL = 'IUD_HORMONAL',
  IMPLANT_NORPLANT = 'IMPLANT_NORPLANT',
  CONDOMS = 'CONDOMS',
  TUBAL_LIGATION = 'TUBAL_LIGATION',
  VASECTOMY = 'VASECTOMY',
  OTHER = 'OTHER',
}

export interface IAncVisit {
  visitDate: Date;
  gestationalAgeWeeks: number;
  weightKg?: number;
  bloodPressure?: string;
  fundalHeightCm?: number;
  fetalHeartRateBpm?: number;
  fetalPosition?: string;
  urineProtein?: string;
  urineSugar?: string;
  hemoglobinGdl?: number;
  notes?: string;
  attendingStaffId: Types.ObjectId;
}

export interface IPncVisit {
  visitDate: Date;
  daysPostpartum: number;
  motherCondition?: string;
  infantCondition?: string;
  bloodPressure?: string;
  temperatureCelsius?: number;
  lochiaDescription?: string;
  breastfeedingStatus?: string;
  notes?: string;
  attendingStaffId: Types.ObjectId;
}

export interface IImmunizationRecord {
  vaccineName: string;
  doseNumber: number;
  administeredAt: Date;
  administeredBy: Types.ObjectId;
  batchNumber?: string;
  nextDueDate?: Date;
  notes?: string;
}

export interface IDeliveryRecord {
  deliveryDate: Date;
  deliveryType: DeliveryType;
  outcome: DeliveryOutcome;
  birthWeightKg?: number;
  apgarScore1Min?: number;
  apgarScore5Min?: number;
  infantGender?: 'MALE' | 'FEMALE' | 'AMBIGUOUS';
  complications?: string;
  deliveredBy: Types.ObjectId;
  notes?: string;
}

export interface IFamilyPlanningRecord {
  method: FamilyPlanningMethod;
  initiatedAt: Date;
  nextDueDate?: Date;
  sideEffects?: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
  notes?: string;
  administeredBy: Types.ObjectId;
}

export interface IPartographLog {
  recordedAt: Date;
  cervicalDilationCm: number;
  contractionFrequency: string;
  fetalHeartRateBpm: number;
  amnioticFluid?: string;
  maternalBp?: string;
  notes?: string;
  recordedBy: Types.ObjectId;
}

export interface IChildGrowthLog {
  recordedAt: Date;
  weightKg: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  muacCm?: number;
  milestonesNotes?: string;
  recordedBy: Types.ObjectId;
}

export interface IMchRecord {
  hospitalId: Types.ObjectId;
  patientId: Types.ObjectId;
  careType: MchCareType;
  gravida?: number;
  para?: number;
  estimatedDeliveryDate?: Date;
  lastMenstrualPeriod?: Date;
  pregnancyStatus?: PregnancyStatus;
  ancVisits?: IAncVisit[];
  pncVisits?: IPncVisit[];
  immunizations?: IImmunizationRecord[];
  familyPlanningRecords?: IFamilyPlanningRecord[];
  partographLogs?: IPartographLog[];
  growthLogs?: IChildGrowthLog[];
  deliveryRecord?: IDeliveryRecord;
  isActive: boolean;
}

export interface IMchRecordDocument extends IMchRecord, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMchRecordInput {
  hospitalId: string;
  patientId: string;
  careType: MchCareType;
  gravida?: number;
  para?: number;
  estimatedDeliveryDate?: Date;
  lastMenstrualPeriod?: Date;
}

export interface AddAncVisitInput {
  gestationalAgeWeeks: number;
  weightKg?: number;
  bloodPressure?: string;
  fundalHeightCm?: number;
  fetalHeartRateBpm?: number;
  fetalPosition?: string;
  urineProtein?: string;
  urineSugar?: string;
  hemoglobinGdl?: number;
  notes?: string;
  attendingStaffId: string;
}

export interface RecordDeliveryInput {
  deliveryDate: Date;
  deliveryType: DeliveryType;
  outcome: DeliveryOutcome;
  birthWeightKg?: number;
  apgarScore1Min?: number;
  apgarScore5Min?: number;
  infantGender?: 'MALE' | 'FEMALE' | 'AMBIGUOUS';
  complications?: string;
  deliveredBy: string;
  notes?: string;
}

export interface AddImmunizationInput {
  vaccineName: string;
  doseNumber: number;
  administeredBy: string;
  batchNumber?: string;
  nextDueDate?: Date;
  notes?: string;
}

export interface AddFamilyPlanningInput {
  method: FamilyPlanningMethod;
  nextDueDate?: Date;
  sideEffects?: string;
  notes?: string;
  administeredBy: string;
}

export interface AddPartographInput {
  cervicalDilationCm: number;
  contractionFrequency: string;
  fetalHeartRateBpm: number;
  amnioticFluid?: string;
  maternalBp?: string;
  notes?: string;
  recordedBy: string;
}

export interface AddChildGrowthInput {
  weightKg: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  muacCm?: number;
  milestonesNotes?: string;
  recordedBy: string;
}

export interface GetMchRecordsQuery {
  page?: number;
  limit?: number;
  careType?: MchCareType;
  patientId?: string;
  pregnancyStatus?: PregnancyStatus;
}

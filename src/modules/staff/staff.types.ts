import { Document, Types } from 'mongoose';

/**
 * Staff roles
 */
export enum StaffRole {
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  PHARMACIST = 'PHARMACIST',
  LAB_TECH = 'LAB_TECH',
  RADIOLOGY_TECH = 'RADIOLOGY_TECH',
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST',
  DENTIST = 'DENTIST',
  MIDWIFE = 'MIDWIFE',
  DIETITIAN = 'DIETITIAN',
  PSYCHOLOGIST = 'PSYCHOLOGIST',
  HEALTHCARE_ASSISTANT = 'HEALTHCARE_ASSISTANT',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  RECEPTIONIST = 'RECEPTIONIST',
  ACCOUNTANT = 'ACCOUNTANT',
  OTHER = 'OTHER',
}

/**
 * Staff categories
 */
export enum StaffCategory {
  CLINICAL = 'CLINICAL',
  ALLIED_HEALTH = 'ALLIED_HEALTH',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  SUPPORT = 'SUPPORT',
}

/**
 * Staff classification
 */
export enum StaffClassification {
  CONSULTANT = 'CONSULTANT',
  SPECIALIST = 'SPECIALIST',
  RESIDENT = 'RESIDENT',
  INTERN = 'INTERN',
  SENIOR = 'SENIOR',
  JUNIOR = 'JUNIOR',
  GENERAL = 'GENERAL',
}

/**
 * Employment type
 *
 * IMPORTANT:
 * These values must match the Mongoose enum exactly.
 */
export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  LOCUM = 'LOCUM',
  TEMPORARY = 'TEMPORARY',
  INTERN = 'INTERN',
  VOLUNTEER = 'VOLUNTEER',
}

/**
 * Staff status
 */
export enum StaffStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

/**
 * Credential status
 */
export enum CredentialStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

/**
 * Clinical privilege status
 */
export enum PrivilegeStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
}

/**
 * Training status
 */
export enum TrainingStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

/**
 * Leave status
 */
export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Attendance status
 */
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
}

/**
 * Availability status
 */
export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  ON_CALL = 'ON_CALL',
  ON_LEAVE = 'ON_LEAVE',
}

/**
 * Staff contact
 */
export interface IStaffContact {
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Emergency contact
 */
export interface IEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
}

/**
 * Professional registration
 *
 * IMPORTANT:
 * Backend uses `regulatoryBody`.
 * Do NOT use `registrationBody`.
 */
export interface IProfessionalRegistration {
  regulatoryBody: string;
  registrationNumber: string;
  registrationType?: string;
  issueDate?: Date;
  expiryDate?: Date;
  status: CredentialStatus;
  verificationDate?: Date;
  verifiedBy?: Types.ObjectId;
  documentUrl?: string;
  notes?: string;
}

/**
 * Qualification
 */
export interface IQualification {
  qualification: string;
  institution: string;
  fieldOfStudy?: string;
  startDate?: Date;
  completionDate?: Date;
  certificateNumber?: string;
  documentUrl?: string;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
}

/**
 * Certification
 */
export interface ICertification {
  name: string;
  issuingOrganization: string;
  certificateNumber?: string;
  issueDate?: Date;
  expiryDate?: Date;
  status: CredentialStatus;
  documentUrl?: string;
}

/**
 * Specialty
 */
export interface ISpecialty {
  specialty: string;
  subSpecialty?: string;
  isPrimary: boolean;
  yearsOfExperience?: number;
}

/**
 * Professional experience
 */
export interface IProfessionalExperience {
  organization: string;
  position: string;
  department?: string;
  startDate: Date;
  endDate?: Date;
  responsibilities?: string;
  reasonForLeaving?: string;
}

/**
 * Clinical privilege
 */
export interface IClinicalPrivilege {
  privilege: string;
  department?: string;
  grantedDate?: Date;
  expiryDate?: Date;
  status: PrivilegeStatus;
  grantedBy?: Types.ObjectId;
  notes?: string;
}

/**
 * Employment
 *
 * These names match StaffSchema.employment exactly.
 */
export interface IEmployment {
  employeeNumber?: string;

  employmentType: EmploymentType;

  classification: StaffClassification;

  jobTitle?: string;

  departmentId?: Types.ObjectId;

  unitId?: Types.ObjectId;

  startDate?: Date;

  endDate?: Date;

  contractStartDate?: Date;

  contractEndDate?: Date;

  salary?: number;

  currency?: string;

  supervisorId?: Types.ObjectId;

  contractDocumentUrl?: string;
}

/**
 * Training record
 */
export interface ITrainingRecord {
  name: string;
  provider?: string;
  category?: string;
  completionDate?: Date;
  expiryDate?: Date;
  status: TrainingStatus;
  certificateUrl?: string;
  mandatory: boolean;
  cpdPoints?: number;
}

/**
 * Performance record
 */
export interface IPerformanceRecord {
  reviewDate: Date;
  reviewerId?: Types.ObjectId;
  score?: number;
  rating?: string;
  comments?: string;
  goals?: string[];
}

/**
 * Availability
 */
export interface IAvailability {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  status: AvailabilityStatus;
}

/**
 * On-call assignment
 */
export interface IOnCallAssignment {
  date: Date;
  startTime?: string;
  endTime?: string;
  departmentId?: Types.ObjectId;
  unitId?: Types.ObjectId;
  notes?: string;
}

/**
 * Leave record
 */
export interface ILeaveRecord {
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
}

/**
 * Attendance record
 */
export interface IAttendanceRecord {
  date: Date;
  clockIn?: Date;
  clockOut?: Date;
  status: AttendanceStatus;
  overtimeHours?: number;
  notes?: string;
}

/**
 * Incident record
 */
export interface IIncidentRecord {
  incidentType: string;
  date: Date;
  description: string;
  severity?: string;
  status?: string;
  reportedBy?: Types.ObjectId;
  resolution?: string;
}

/**
 * Staff communication
 */
export interface IStaffCommunication {
  subject: string;
  message: string;
  sentAt: Date;
  sentBy?: Types.ObjectId;
  readAt?: Date;
}

/**
 * Complete staff document
 */
export interface IStaff {
  hospitalId: Types.ObjectId;
  userAccountId?: Types.ObjectId;

  /**
   * Internal hospital-wide staff identifier.
   * Example: ST-000001
   */
  staffId: string;

  firstName: string;
  middleName?: string;
  lastName: string;

  title?: string;
  profilePhotoUrl?: string;
  dateOfBirth?: Date;
  gender?: string;

  role: StaffRole;
  category: StaffCategory;
  classification: StaffClassification;

  professionalTitle?: string;
  /** Virtual consultation fee in NGN. */
  consultationFee?: number;
  jobTitle?: string;

  specialties: ISpecialty[];

  contact: IStaffContact;

  emergencyContact?: IEmergencyContact;

  professionalRegistrations: IProfessionalRegistration[];

  qualifications: IQualification[];

  certifications: ICertification[];

  professionalExperience: IProfessionalExperience[];

  clinicalPrivileges: IClinicalPrivilege[];

  /**
   * Employment is required by the backend model.
   */
  employment: IEmployment;

  trainingRecords: ITrainingRecord[];

  performanceRecords: IPerformanceRecord[];

  availability: IAvailability[];

  onCallAssignments: IOnCallAssignment[];

  leaveRecords: ILeaveRecord[];

  attendanceRecords: IAttendanceRecord[];

  incidents: IIncidentRecord[];

  communications: IStaffCommunication[];

  clinicalActivityCount: number;

  activePatientCaseload: number;

  status: StaffStatus;

  isActive: boolean;

  createdAt: Date;

  updatedAt: Date;
}

/**
 * Mongoose staff document
 */
export interface IStaffDocument extends IStaff, Document {
  _id: Types.ObjectId;
}

/**
 * Create staff DTO
 *
 * IMPORTANT:
 * `employment` is optional at the request-contract level so the
 * service can safely normalize/validate it before creating the
 * MongoDB document.
 */
export interface CreateStaffDTO {
  firstName: string;

  middleName?: string;

  lastName: string;

  title?: string;

  profilePhotoUrl?: string;

  dateOfBirth?: Date;

  gender?: string;

  role: StaffRole;

  category?: StaffCategory;

  classification?: StaffClassification;

  professionalTitle?: string;

  /** Virtual consultation fee in NGN, configured by the hospital. */
  consultationFee?: number;

  jobTitle?: string;

  specialties?: ISpecialty[];

  contact?: IStaffContact;

  emergencyContact?: IEmergencyContact;

  professionalRegistrations?: IProfessionalRegistration[];

  qualifications?: IQualification[];

  certifications?: ICertification[];

  professionalExperience?: IProfessionalExperience[];

  clinicalPrivileges?: IClinicalPrivilege[];

  employment?: IEmployment;

  trainingRecords?: ITrainingRecord[];

  performanceRecords?: IPerformanceRecord[];

  availability?: IAvailability[];

  onCallAssignments?: IOnCallAssignment[];

  leaveRecords?: ILeaveRecord[];

  attendanceRecords?: IAttendanceRecord[];

  incidents?: IIncidentRecord[];

  communications?: IStaffCommunication[];
}

/**
 * Update staff DTO
 */
export type UpdateStaffDTO = Partial<
  Omit<
    IStaff,
    | 'hospitalId'
    | 'userAccountId'
    | 'staffId'
    | 'createdAt'
    | 'updatedAt'
    | 'clinicalActivityCount'
    | 'activePatientCaseload'
  >
>;

/**
 * Staff list filters
 */
export interface StaffListFilters {
  role?: StaffRole;

  category?: StaffCategory;

  classification?: StaffClassification;

  departmentId?: string;

  unitId?: string;

  status?: StaffStatus;

  isActive?: boolean;

  search?: string;
}
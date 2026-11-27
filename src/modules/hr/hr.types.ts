import { Document, Types } from 'mongoose';

export enum RecruitmentStage {
  APPLIED = 'APPLIED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  OFFER_EXTENDED = 'OFFER_EXTENDED',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
}

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  STUDY_CME = 'STUDY_CME',
  COMPASSIONATE = 'COMPASSIONATE',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum IssuingCouncil {
  MDCN = 'MDCN', // Medical and Dental Council of Nigeria
  NMCN = 'NMCN', // Nursing and Midwifery Council of Nigeria
  PCN = 'PCN',   // Pharmacy Council of Nigeria
  MLSCN = 'MLSCN', // Medical Laboratory Science Council
  RRBN = 'RRBN',  // Radiographers Registration Board
  OTHER = 'OTHER',
}

export interface IJobApplication {
  hospitalId: Types.ObjectId;
  applicantName: string;
  email: string;
  phone: string;
  positionApplied: string;
  departmentName: string;
  stage: RecruitmentStage;
  resumeUrl?: string;
  interviewNotes?: string;
  appliedDate: Date;
}

export interface IJobApplicationDocument extends IJobApplication, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveRequest {
  hospitalId: Types.ObjectId;
  staffId: Types.ObjectId;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: LeaveStatus;
  approvedBy?: Types.ObjectId;
  rejectionReason?: string;
}

export interface ILeaveRequestDocument extends ILeaveRequest, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ILicenseCredential {
  hospitalId: Types.ObjectId;
  staffId: Types.ObjectId;
  issuingCouncil: IssuingCouncil;
  licenseNumber: string;
  issueDate: Date;
  expiryDate: Date;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'EXPIRED';
  notes?: string;
}

export interface ILicenseCredentialDocument extends ILicenseCredential, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface ICmeCourse {
  hospitalId: Types.ObjectId;
  staffId: Types.ObjectId;
  courseTitle: string;
  providerName: string; // e.g., "MedxLearn Platform"
  cmeUnitsEarned: number;
  completedAt: Date;
  certificateUrl?: string;
}

export interface ICmeCourseDocument extends ICmeCourse, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IPerformanceAppraisal {
  hospitalId: Types.ObjectId;
  staffId: Types.ObjectId;
  evaluationPeriod: string; // e.g. "2025-Q1" or "2024-ANNUAL"
  clinicalCompetenceRating: number; // 1 to 5
  punctualityRating: number; // 1 to 5
  patientSatisfactionRating: number; // 1 to 5
  teamworkRating: number; // 1 to 5
  overallRating: number; // Average
  reviewerComments: string;
  reviewerId: Types.ObjectId;
  evaluatedAt: Date;
}

export interface IPerformanceAppraisalDocument extends IPerformanceAppraisal, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobApplicationInput {
  hospitalId: string;
  applicantName: string;
  email: string;
  phone: string;
  positionApplied: string;
  departmentName: string;
  resumeUrl?: string;
}

export interface CreateLeaveRequestInput {
  hospitalId: string;
  staffId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
}

export interface CreateLicenseCredentialInput {
  hospitalId: string;
  staffId: string;
  issuingCouncil: IssuingCouncil;
  licenseNumber: string;
  issueDate: Date;
  expiryDate: Date;
  notes?: string;
}

export interface CreateCmeCourseInput {
  hospitalId: string;
  staffId: string;
  courseTitle: string;
  providerName?: string;
  cmeUnitsEarned: number;
  certificateUrl?: string;
}

export interface CreateAppraisalInput {
  hospitalId: string;
  staffId: string;
  evaluationPeriod: string;
  clinicalCompetenceRating: number;
  punctualityRating: number;
  patientSatisfactionRating: number;
  teamworkRating: number;
  reviewerComments: string;
  reviewerId: string;
}

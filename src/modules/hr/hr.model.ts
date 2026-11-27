import { Schema, model } from 'mongoose';
import {
  IJobApplicationDocument,
  ILeaveRequestDocument,
  ILicenseCredentialDocument,
  ICmeCourseDocument,
  IPerformanceAppraisalDocument,
  RecruitmentStage,
  LeaveType,
  LeaveStatus,
  IssuingCouncil,
} from './hr.types.js';

const JobApplicationSchema = new Schema<IJobApplicationDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    applicantName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    positionApplied: { type: String, required: true, trim: true },
    departmentName: { type: String, required: true, trim: true },
    stage: {
      type: String,
      enum: Object.values(RecruitmentStage),
      default: RecruitmentStage.APPLIED,
      required: true,
      index: true,
    },
    resumeUrl: { type: String, trim: true },
    interviewNotes: { type: String, trim: true },
    appliedDate: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const LeaveRequestSchema = new Schema<ILeaveRequestDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    leaveType: {
      type: String,
      enum: Object.values(LeaveType),
      default: LeaveType.ANNUAL,
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(LeaveStatus),
      default: LeaveStatus.PENDING,
      required: true,
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

const LicenseCredentialSchema = new Schema<ILicenseCredentialDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    issuingCouncil: {
      type: String,
      enum: Object.values(IssuingCouncil),
      required: true,
    },
    licenseNumber: { type: String, required: true, trim: true, uppercase: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true, index: true },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'EXPIRED'],
      default: 'VERIFIED',
      required: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const CmeCourseSchema = new Schema<ICmeCourseDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    courseTitle: { type: String, required: true, trim: true },
    providerName: { type: String, default: 'MedxLearn Platform', trim: true },
    cmeUnitsEarned: { type: Number, required: true, min: 1 },
    completedAt: { type: Date, default: Date.now, required: true },
    certificateUrl: { type: String, trim: true },
  },
  { timestamps: true }
);

const PerformanceAppraisalSchema = new Schema<IPerformanceAppraisalDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
    evaluationPeriod: { type: String, required: true, trim: true },
    clinicalCompetenceRating: { type: Number, required: true, min: 1, max: 5 },
    punctualityRating: { type: Number, required: true, min: 1, max: 5 },
    patientSatisfactionRating: { type: Number, required: true, min: 1, max: 5 },
    teamworkRating: { type: Number, required: true, min: 1, max: 5 },
    overallRating: { type: Number, required: true },
    reviewerComments: { type: String, required: true, trim: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    evaluatedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

export const JobApplicationModel = model<IJobApplicationDocument>('JobApplication', JobApplicationSchema);
export const LeaveRequestModel = model<ILeaveRequestDocument>('LeaveRequest', LeaveRequestSchema);
export const LicenseCredentialModel = model<ILicenseCredentialDocument>('LicenseCredential', LicenseCredentialSchema);
export const CmeCourseModel = model<ICmeCourseDocument>('CmeCourse', CmeCourseSchema);
export const PerformanceAppraisalModel = model<IPerformanceAppraisalDocument>('PerformanceAppraisal', PerformanceAppraisalSchema);

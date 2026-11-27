import { Types } from 'mongoose';
import {
  JobApplicationModel,
  LeaveRequestModel,
  LicenseCredentialModel,
  CmeCourseModel,
  PerformanceAppraisalModel,
} from './hr.model.js';
import {
  CreateJobApplicationInput,
  CreateLeaveRequestInput,
  CreateLicenseCredentialInput,
  CreateCmeCourseInput,
  CreateAppraisalInput,
  IJobApplicationDocument,
  ILeaveRequestDocument,
  ILicenseCredentialDocument,
  ICmeCourseDocument,
  IPerformanceAppraisalDocument,
  RecruitmentStage,
  LeaveStatus,
} from './hr.types.js';

export class HrService {
  // --- Recruitment & Onboarding ---
  public async createJobApplication(input: CreateJobApplicationInput): Promise<IJobApplicationDocument> {
    return JobApplicationModel.create({
      ...input,
      stage: RecruitmentStage.APPLIED,
      appliedDate: new Date(),
    });
  }

  public async getJobApplications(hospitalId: string): Promise<IJobApplicationDocument[]> {
    return JobApplicationModel.find({ hospitalId }).sort({ createdAt: -1 }).limit(50).exec();
  }

  public async updateApplicationStage(
    id: string,
    hospitalId: string,
    stage: RecruitmentStage
  ): Promise<IJobApplicationDocument | null> {
    return JobApplicationModel.findOneAndUpdate({ _id: id, hospitalId }, { $set: { stage } }, { new: true }).exec();
  }

  // --- Leave & Attendance ---
  public async createLeaveRequest(input: CreateLeaveRequestInput): Promise<ILeaveRequestDocument> {
    return LeaveRequestModel.create({
      ...input,
      staffId: new Types.ObjectId(input.staffId),
      status: LeaveStatus.PENDING,
    });
  }

  public async getLeaveRequests(hospitalId: string): Promise<ILeaveRequestDocument[]> {
    return LeaveRequestModel.find({ hospitalId })
      .populate('staffId', 'firstName lastName role department')
      .populate('approvedBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  public async updateLeaveStatus(
    id: string,
    hospitalId: string,
    status: LeaveStatus,
    approvedBy: string,
    rejectionReason?: string
  ): Promise<ILeaveRequestDocument | null> {
    const update: Record<string, unknown> = {
      status,
      approvedBy: new Types.ObjectId(approvedBy),
    };
    if (rejectionReason) update.rejectionReason = rejectionReason;

    return LeaveRequestModel.findOneAndUpdate({ _id: id, hospitalId }, { $set: update }, { new: true }).exec();
  }

  // --- License Credentials ---
  public async createLicenseCredential(input: CreateLicenseCredentialInput): Promise<ILicenseCredentialDocument> {
    const verificationStatus = new Date() > new Date(input.expiryDate) ? 'EXPIRED' : 'VERIFIED';
    return LicenseCredentialModel.create({
      ...input,
      staffId: new Types.ObjectId(input.staffId),
      verificationStatus,
    });
  }

  public async getLicenseCredentials(hospitalId: string): Promise<ILicenseCredentialDocument[]> {
    return LicenseCredentialModel.find({ hospitalId })
      .populate('staffId', 'firstName lastName role department email')
      .sort({ expiryDate: 1 })
      .limit(50)
      .exec();
  }

  // --- Training & CME (MedxLearn) ---
  public async createCmeCourse(input: CreateCmeCourseInput): Promise<ICmeCourseDocument> {
    return CmeCourseModel.create({
      ...input,
      staffId: new Types.ObjectId(input.staffId),
      completedAt: new Date(),
    });
  }

  public async getCmeCourses(hospitalId: string): Promise<ICmeCourseDocument[]> {
    return CmeCourseModel.find({ hospitalId })
      .populate('staffId', 'firstName lastName role department')
      .sort({ completedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Performance Appraisal ---
  public async createAppraisal(input: CreateAppraisalInput): Promise<IPerformanceAppraisalDocument> {
    const overallRating =
      (input.clinicalCompetenceRating + input.punctualityRating + input.patientSatisfactionRating + input.teamworkRating) / 4;

    return PerformanceAppraisalModel.create({
      ...input,
      staffId: new Types.ObjectId(input.staffId),
      reviewerId: new Types.ObjectId(input.reviewerId),
      overallRating,
      evaluatedAt: new Date(),
    });
  }

  public async getAppraisals(hospitalId: string): Promise<IPerformanceAppraisalDocument[]> {
    return PerformanceAppraisalModel.find({ hospitalId })
      .populate('staffId', 'firstName lastName role department')
      .populate('reviewerId', 'firstName lastName role')
      .sort({ evaluatedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Summary Stats ---
  public async getHrStats(hospitalId: string): Promise<{
    activeCandidatesCount: number;
    pendingLeaveCount: number;
    expiringLicensesCount: number;
    totalCmeUnitsEarned: number;
  }> {
    const [activeCandidatesCount, pendingLeaveCount, expiringLicensesCount, cmeAgg] = await Promise.all([
      JobApplicationModel.countDocuments({ hospitalId, stage: { $ne: RecruitmentStage.REJECTED } }),
      LeaveRequestModel.countDocuments({ hospitalId, status: LeaveStatus.PENDING }),
      LicenseCredentialModel.countDocuments({
        hospitalId,
        expiryDate: { $lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }, // expiring in 60 days
      }),
      CmeCourseModel.aggregate([
        { $match: { hospitalId: new Types.ObjectId(hospitalId) } },
        { $group: { _id: null, totalUnits: { $sum: '$cmeUnitsEarned' } } },
      ]),
    ]);

    return {
      activeCandidatesCount,
      pendingLeaveCount,
      expiringLicensesCount,
      totalCmeUnitsEarned: cmeAgg[0]?.totalUnits || 0,
    };
  }
}

export const hrService = new HrService();

import { ReferralModel } from './referrals.model.js';
import {
  CreateReferralInput,
  GetReferralsQuery,
  IReferralDocument,
  ReferralStatus,
  UpdateReferralStatusInput,
} from './referrals.types.js';

export class ReferralsService {
  public async createReferral(input: CreateReferralInput): Promise<IReferralDocument> {
    const referral = await ReferralModel.create({
      ...input,
      referredAt: new Date(),
      status: ReferralStatus.PENDING,
    });
    return referral;
  }

  public async getReferrals(
    hospitalId: string,
    query: GetReferralsQuery
  ): Promise<{ referrals: IReferralDocument[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { hospitalId };

    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.urgency) filter.urgency = query.urgency;
    if (query.patientId) filter.patientId = query.patientId;

    const [referrals, total] = await Promise.all([
      ReferralModel.find(filter)
        .populate('patientId', 'firstName lastName mrn gender dateOfBirth phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ReferralModel.countDocuments(filter),
    ]);

    return {
      referrals,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async getReferralById(
    referralId: string,
    hospitalId: string
  ): Promise<IReferralDocument | null> {
    return ReferralModel.findOne({ _id: referralId, hospitalId })
      .populate('patientId', 'firstName lastName mrn gender dateOfBirth phone')
      .exec();
  }

  public async updateReferralStatus(
    referralId: string,
    hospitalId: string,
    input: UpdateReferralStatusInput
  ): Promise<IReferralDocument | null> {
    const updatePayload: Record<string, unknown> = {
      status: input.status,
    };

    if (input.notes) {
      updatePayload.notes = input.notes;
    }

    if ([ReferralStatus.COMPLETED, ReferralStatus.TRANSFERRED].includes(input.status)) {
      updatePayload.completedAt = new Date();
    }

    return ReferralModel.findOneAndUpdate(
      { _id: referralId, hospitalId },
      { $set: updatePayload },
      { new: true }
    ).exec();
  }

  public async getReferralStats(hospitalId: string): Promise<{
    inwardCount: number;
    outwardCount: number;
    pendingCount: number;
    completedCount: number;
  }> {
    const [inwardCount, outwardCount, pendingCount, completedCount] = await Promise.all([
      ReferralModel.countDocuments({ hospitalId, type: 'INWARD' }),
      ReferralModel.countDocuments({ hospitalId, type: 'OUTWARD' }),
      ReferralModel.countDocuments({ hospitalId, status: ReferralStatus.PENDING }),
      ReferralModel.countDocuments({ hospitalId, status: ReferralStatus.COMPLETED }),
    ]);

    return { inwardCount, outwardCount, pendingCount, completedCount };
  }
}

export const referralsService = new ReferralsService();

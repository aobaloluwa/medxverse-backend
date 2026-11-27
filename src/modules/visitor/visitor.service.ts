import { VisitorPassModel } from './visitor.model.js';
import {
  CreateVisitorPassInput,
  GetVisitorPassesQuery,
  IVisitorPassDocument,
  VisitorPassStatus,
} from './visitor.types.js';

export class VisitorService {
  private generatePassCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'VP-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async issuePass(input: CreateVisitorPassInput): Promise<IVisitorPassDocument> {
    const activeCheckedIn = await VisitorPassModel.countDocuments({
      hospitalId: input.hospitalId,
      patientId: input.patientId,
      status: VisitorPassStatus.CHECKED_IN,
    });

    if (activeCheckedIn >= 2) {
      throw new Error('Maximum concurrent visitors (2) already checked in for this patient.');
    }

    const validFrom = new Date();
    const validHours = input.validHours || 8;
    const validUntil = new Date(validFrom.getTime() + validHours * 60 * 60 * 1000);

    const passCode = this.generatePassCode();

    const pass = await VisitorPassModel.create({
      ...input,
      passCode,
      validFrom,
      validUntil,
      status: VisitorPassStatus.ACTIVE,
    });

    return pass;
  }

  public async getPasses(
    hospitalId: string,
    query: GetVisitorPassesQuery
  ): Promise<{ passes: IVisitorPassDocument[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { hospitalId };

    if (query.status) filter.status = query.status;
    if (query.patientId) filter.patientId = query.patientId;
    if (query.wardId) filter.wardId = query.wardId;
    if (query.passCode) filter.passCode = query.passCode;

    const [passes, total] = await Promise.all([
      VisitorPassModel.find(filter)
        .populate('patientId', 'firstName lastName mrn gender')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      VisitorPassModel.countDocuments(filter),
    ]);

    return {
      passes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async checkInVisitor(
    passId: string,
    hospitalId: string
  ): Promise<IVisitorPassDocument | null> {
    const pass = await VisitorPassModel.findOne({ _id: passId, hospitalId });
    if (!pass) throw new Error('Visitor pass not found.');

    if (pass.status === VisitorPassStatus.CHECKED_IN) {
      throw new Error('Visitor is already checked in.');
    }

    if (new Date() > pass.validUntil) {
      pass.status = VisitorPassStatus.EXPIRED;
      await pass.save();
      throw new Error('Visitor pass has expired.');
    }

    pass.status = VisitorPassStatus.CHECKED_IN;
    pass.checkInTime = new Date();
    await pass.save();

    return pass;
  }

  public async checkOutVisitor(
    passId: string,
    hospitalId: string
  ): Promise<IVisitorPassDocument | null> {
    const pass = await VisitorPassModel.findOne({ _id: passId, hospitalId });
    if (!pass) throw new Error('Visitor pass not found.');

    pass.status = VisitorPassStatus.CHECKED_OUT;
    pass.checkOutTime = new Date();
    await pass.save();

    return pass;
  }

  public async revokePass(
    passId: string,
    hospitalId: string
  ): Promise<IVisitorPassDocument | null> {
    return VisitorPassModel.findOneAndUpdate(
      { _id: passId, hospitalId },
      { $set: { status: VisitorPassStatus.REVOKED } },
      { new: true }
    ).exec();
  }
}

export const visitorService = new VisitorService();

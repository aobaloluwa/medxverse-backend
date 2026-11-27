import { Types } from 'mongoose';
import { MarLogModel, NursingNoteModel, FluidBalanceLogModel } from './nursing.model.js';
import {
  CreateMarLogInput,
  CreateNursingNoteInput,
  CreateFluidBalanceInput,
  GetNursingQuery,
  IMarLogDocument,
  INursingNoteDocument,
  IFluidBalanceLogDocument,
  MarStatus,
} from './nursing.types.js';

export class NursingService {
  // --- MAR Logs ---
  public async createMarLog(input: CreateMarLogInput): Promise<IMarLogDocument> {
    return MarLogModel.create({
      ...input,
      status: input.status || MarStatus.SCHEDULED,
    });
  }

  public async getMarLogs(
    hospitalId: string,
    query: GetNursingQuery
  ): Promise<{ logs: IMarLogDocument[]; total: number }> {
    const filter: Record<string, unknown> = { hospitalId };
    if (query.patientId) filter.patientId = query.patientId;
    if (query.status) filter.status = query.status;

    const [logs, total] = await Promise.all([
      MarLogModel.find(filter)
        .populate('patientId', 'firstName lastName mrn wardId bedNumber')
        .populate('administeredBy', 'firstName lastName role')
        .sort({ scheduledTime: -1 })
        .limit(50)
        .exec(),
      MarLogModel.countDocuments(filter),
    ]);

    return { logs, total };
  }

  public async updateMarStatus(
    logId: string,
    hospitalId: string,
    status: MarStatus,
    administeredBy: string,
    reasonHeldOrRefused?: string
  ): Promise<IMarLogDocument | null> {
    const updatePayload: Record<string, unknown> = {
      status,
      administeredBy: new Types.ObjectId(administeredBy),
      administeredAt: new Date(),
    };

    if (reasonHeldOrRefused) {
      updatePayload.reasonHeldOrRefused = reasonHeldOrRefused;
    }

    return MarLogModel.findOneAndUpdate(
      { _id: logId, hospitalId },
      { $set: updatePayload },
      { new: true }
    ).exec();
  }

  // --- Nursing Notes & SBAR Shift Handover ---
  public async createNursingNote(input: CreateNursingNoteInput): Promise<INursingNoteDocument> {
    return NursingNoteModel.create({
      ...input,
      nurseId: new Types.ObjectId(input.nurseId),
    });
  }

  public async getNursingNotes(
    hospitalId: string,
    query: GetNursingQuery
  ): Promise<{ notes: INursingNoteDocument[]; total: number }> {
    const filter: Record<string, unknown> = { hospitalId };
    if (query.patientId) filter.patientId = query.patientId;

    const [notes, total] = await Promise.all([
      NursingNoteModel.find(filter)
        .populate('patientId', 'firstName lastName mrn wardId bedNumber')
        .populate('nurseId', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .limit(50)
        .exec(),
      NursingNoteModel.countDocuments(filter),
    ]);

    return { notes, total };
  }

  // --- Fluid Balance ---
  public async createFluidBalance(input: CreateFluidBalanceInput): Promise<IFluidBalanceLogDocument> {
    return FluidBalanceLogModel.create({
      ...input,
      recordedBy: new Types.ObjectId(input.recordedBy),
      recordedAt: new Date(),
    });
  }

  public async getFluidBalanceLogs(
    hospitalId: string,
    patientId: string
  ): Promise<{ logs: IFluidBalanceLogDocument[]; totalIntakeMl: number; totalOutputMl: number; netBalanceMl: number }> {
    const logs = await FluidBalanceLogModel.find({ hospitalId, patientId })
      .populate('recordedBy', 'firstName lastName role')
      .sort({ recordedAt: -1 })
      .limit(30)
      .exec();

    let totalIntakeMl = 0;
    let totalOutputMl = 0;

    logs.forEach((log) => {
      totalIntakeMl += (log.oralIntakeMl || 0) + (log.ivIntakeMl || 0) + (log.tubeFeedMl || 0);
      totalOutputMl += (log.urineOutputMl || 0) + (log.drainOutputMl || 0) + (log.vomitOutputMl || 0);
    });

    return {
      logs,
      totalIntakeMl,
      totalOutputMl,
      netBalanceMl: totalIntakeMl - totalOutputMl,
    };
  }

  // --- Station Summary ---
  public async getStationSummary(hospitalId: string): Promise<{
    scheduledMarCount: number;
    administeredMarCount: number;
    highRiskPatientCount: number;
    handoverNotesCount: number;
  }> {
    const [scheduledMarCount, administeredMarCount, highRiskPatientCount, handoverNotesCount] = await Promise.all([
      MarLogModel.countDocuments({ hospitalId, status: MarStatus.SCHEDULED }),
      MarLogModel.countDocuments({ hospitalId, status: MarStatus.GIVEN }),
      NursingNoteModel.countDocuments({ hospitalId, isHighRisk: true }),
      NursingNoteModel.countDocuments({ hospitalId, noteType: 'SHIFT_HANDOVER' }),
    ]);

    return {
      scheduledMarCount,
      administeredMarCount,
      highRiskPatientCount,
      handoverNotesCount,
    };
  }
}

export const nursingService = new NursingService();

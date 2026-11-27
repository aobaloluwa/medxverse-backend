import { Types } from 'mongoose';
import {
  PathologyReportModel,
  CardiacDiagnosticReportModel,
  CssdBatchLogModel,
  InfectionControlLogModel,
  MortuaryRecordModel,
} from './diagnostics-support.model.js';
import {
  CreatePathologyInput,
  CreateCardiacReportInput,
  CreateCssdBatchInput,
  CreateIpcLogInput,
  CreateMortuaryRecordInput,
  IPathologyReportDocument,
  ICardiacDiagnosticReportDocument,
  ICssdBatchLogDocument,
  IInfectionControlLogDocument,
  IMortuaryRecordDocument,
  PathologyStatus,
  MortuaryStatus,
} from './diagnostics-support.types.js';

export class DiagnosticsSupportService {
  // --- Pathology ---
  public async createPathology(input: CreatePathologyInput): Promise<IPathologyReportDocument> {
    return PathologyReportModel.create({
      ...input,
      receivedAt: new Date(),
      status: PathologyStatus.SPECIMEN_RECEIVED,
    });
  }

  public async getPathologyReports(hospitalId: string): Promise<IPathologyReportDocument[]> {
    return PathologyReportModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn dateOfBirth gender')
      .populate('pathologistId', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Cardiac ---
  public async createCardiacReport(input: CreateCardiacReportInput): Promise<ICardiacDiagnosticReportDocument> {
    return CardiacDiagnosticReportModel.create({
      ...input,
      recordedAt: new Date(),
    });
  }

  public async getCardiacReports(hospitalId: string): Promise<ICardiacDiagnosticReportDocument[]> {
    return CardiacDiagnosticReportModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn dateOfBirth gender')
      .populate('cardiologistId', 'firstName lastName role')
      .sort({ recordedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- CSSD ---
  public async createCssdBatch(input: CreateCssdBatchInput): Promise<ICssdBatchLogDocument> {
    const validDays = input.validDays || 30;
    const sterilizedAt = new Date();
    const expiresAt = new Date(sterilizedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

    return CssdBatchLogModel.create({
      ...input,
      operatorId: new Types.ObjectId(input.operatorId),
      sterilizedAt,
      expiresAt,
    });
  }

  public async getCssdBatches(hospitalId: string): Promise<ICssdBatchLogDocument[]> {
    return CssdBatchLogModel.find({ hospitalId })
      .populate('operatorId', 'firstName lastName role')
      .sort({ sterilizedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- IPC ---
  public async createIpcLog(input: CreateIpcLogInput): Promise<IInfectionControlLogDocument> {
    return InfectionControlLogModel.create({
      ...input,
      auditedBy: new Types.ObjectId(input.auditedBy),
      auditedAt: new Date(),
    });
  }

  public async getIpcLogs(hospitalId: string): Promise<IInfectionControlLogDocument[]> {
    return InfectionControlLogModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn wardId bedNumber')
      .populate('auditedBy', 'firstName lastName role')
      .sort({ auditedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Mortuary ---
  private generateBodyTagCode(): string {
    const chars = '0123456789';
    let code = 'MOR-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async createMortuaryRecord(input: CreateMortuaryRecordInput): Promise<IMortuaryRecordDocument> {
    const bodyTagCode = this.generateBodyTagCode();
    return MortuaryRecordModel.create({
      ...input,
      bodyTagCode,
      status: MortuaryStatus.ADMITTED,
      receivedBy: new Types.ObjectId(input.receivedBy),
    });
  }

  public async getMortuaryRecords(hospitalId: string): Promise<IMortuaryRecordDocument[]> {
    return MortuaryRecordModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn')
      .populate('receivedBy', 'firstName lastName role')
      .sort({ dateOfDeath: -1 })
      .limit(50)
      .exec();
  }

  public async releaseMortuaryBody(
    recordId: string,
    hospitalId: string,
    releasedTo: string
  ): Promise<IMortuaryRecordDocument | null> {
    return MortuaryRecordModel.findOneAndUpdate(
      { _id: recordId, hospitalId },
      {
        $set: {
          status: MortuaryStatus.RELEASED,
          releasedAt: new Date(),
          releasedTo,
        },
      },
      { new: true }
    ).exec();
  }

  // --- Stats Aggregator ---
  public async getDiagnosticsStats(hospitalId: string): Promise<{
    pathologyPendingCount: number;
    cardiacReportsCount: number;
    cssdActiveBatchesCount: number;
    mortuaryOccupiedCount: number;
  }> {
    const [pathologyPendingCount, cardiacReportsCount, cssdActiveBatchesCount, mortuaryOccupiedCount] = await Promise.all([
      PathologyReportModel.countDocuments({ hospitalId, status: { $ne: PathologyStatus.REPORTED } }),
      CardiacDiagnosticReportModel.countDocuments({ hospitalId }),
      CssdBatchLogModel.countDocuments({ hospitalId, expiresAt: { $gte: new Date() } }),
      MortuaryRecordModel.countDocuments({ hospitalId, status: { $ne: MortuaryStatus.RELEASED } }),
    ]);

    return {
      pathologyPendingCount,
      cardiacReportsCount,
      cssdActiveBatchesCount,
      mortuaryOccupiedCount,
    };
  }
}

export const diagnosticsSupportService = new DiagnosticsSupportService();

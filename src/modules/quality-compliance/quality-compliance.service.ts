import { Types } from 'mongoose';
import {
  IncidentReportModel,
  ConsentFormModel,
  BirthDeathRecordModel,
  DiseaseSurveillanceLogModel,
  NdpaAuditLogModel,
} from './quality-compliance.model.js';
import {
  CreateIncidentInput,
  CreateConsentInput,
  CreateBirthDeathInput,
  CreateSurveillanceInput,
  CreateNdpaAuditInput,
  IIncidentReportDocument,
  IConsentFormDocument,
  IBirthDeathRecordDocument,
  IDiseaseSurveillanceLogDocument,
  INdpaAuditLogDocument,
  IncidentSeverity,
} from './quality-compliance.types.js';

export class QualityComplianceService {
  // --- Incident Reporting ---
  public async createIncident(input: CreateIncidentInput): Promise<IIncidentReportDocument> {
    return IncidentReportModel.create({
      ...input,
      patientId: input.patientId ? new Types.ObjectId(input.patientId) : undefined,
      reportedBy: new Types.ObjectId(input.reportedBy),
      severity: input.severity || IncidentSeverity.MODERATE,
      incidentDate: new Date(),
    });
  }

  public async getIncidents(hospitalId: string): Promise<IIncidentReportDocument[]> {
    return IncidentReportModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn')
      .populate('reportedBy', 'firstName lastName role')
      .sort({ incidentDate: -1 })
      .limit(50)
      .exec();
  }

  // --- Consent Forms ---
  public async createConsentForm(input: CreateConsentInput): Promise<IConsentFormDocument> {
    return ConsentFormModel.create({
      ...input,
      patientId: new Types.ObjectId(input.patientId),
      doctorSignatureId: new Types.ObjectId(input.doctorSignatureId),
      status: 'SIGNED',
      signedAt: new Date(),
    });
  }

  public async getConsentForms(hospitalId: string): Promise<IConsentFormDocument[]> {
    return ConsentFormModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn')
      .populate('doctorSignatureId', 'firstName lastName role')
      .sort({ signedAt: -1 })
      .limit(50)
      .exec();
  }

  // --- Birth & Death Registry ---
  private generateCertificateNumber(type: 'BIRTH' | 'DEATH'): string {
    const prefix = type === 'BIRTH' ? 'BRT-' : 'DTH-';
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${rand}`;
  }

  public async createBirthDeathRecord(input: CreateBirthDeathInput): Promise<IBirthDeathRecordDocument> {
    const certificateNumber = this.generateCertificateNumber(input.type);
    return BirthDeathRecordModel.create({
      ...input,
      certificateNumber,
      patientId: input.patientId ? new Types.ObjectId(input.patientId) : undefined,
      attendingPhysicianId: new Types.ObjectId(input.attendingPhysicianId),
      mohNotified: true,
    });
  }

  public async getBirthDeathRecords(hospitalId: string): Promise<IBirthDeathRecordDocument[]> {
    return BirthDeathRecordModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn')
      .populate('attendingPhysicianId', 'firstName lastName role')
      .sort({ eventDate: -1 })
      .limit(50)
      .exec();
  }

  // --- Disease Surveillance ---
  public async createSurveillanceLog(input: CreateSurveillanceInput): Promise<IDiseaseSurveillanceLogDocument> {
    return DiseaseSurveillanceLogModel.create({
      ...input,
      patientId: new Types.ObjectId(input.patientId),
      reportedBy: new Types.ObjectId(input.reportedBy),
      mohNotified: true,
      ncdcNotifiedAt: new Date(),
    });
  }

  public async getSurveillanceLogs(hospitalId: string): Promise<IDiseaseSurveillanceLogDocument[]> {
    return DiseaseSurveillanceLogModel.find({ hospitalId })
      .populate('patientId', 'firstName lastName mrn dateOfBirth phone address')
      .populate('reportedBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  // --- NDPA Audit Trail ---
  public async logNdpaAudit(input: CreateNdpaAuditInput): Promise<INdpaAuditLogDocument> {
    return NdpaAuditLogModel.create({
      ...input,
      userId: new Types.ObjectId(input.userId),
      performedAt: new Date(),
    });
  }

  public async getNdpaAuditLogs(hospitalId: string): Promise<INdpaAuditLogDocument[]> {
    return NdpaAuditLogModel.find({ hospitalId })
      .populate('userId', 'firstName lastName role email')
      .sort({ performedAt: -1 })
      .limit(100)
      .exec();
  }

  // --- Stats Summary ---
  public async getQualityStats(hospitalId: string): Promise<{
    openIncidentsCount: number;
    signedConsentsCount: number;
    registeredBirthsCount: number;
    registeredDeathsCount: number;
    activeSurveillanceCases: number;
  }> {
    const [openIncidentsCount, signedConsentsCount, registeredBirthsCount, registeredDeathsCount, activeSurveillanceCases] =
      await Promise.all([
        IncidentReportModel.countDocuments({ hospitalId, investigationStatus: { $ne: 'CLOSED' } }),
        ConsentFormModel.countDocuments({ hospitalId, status: 'SIGNED' }),
        BirthDeathRecordModel.countDocuments({ hospitalId, type: 'BIRTH' }),
        BirthDeathRecordModel.countDocuments({ hospitalId, type: 'DEATH' }),
        DiseaseSurveillanceLogModel.countDocuments({ hospitalId }),
      ]);

    return {
      openIncidentsCount,
      signedConsentsCount,
      registeredBirthsCount,
      registeredDeathsCount,
      activeSurveillanceCases,
    };
  }
}

export const qualityComplianceService = new QualityComplianceService();

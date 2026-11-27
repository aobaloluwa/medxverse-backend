import { Schema, model } from 'mongoose';
import {
  IPathologyReportDocument,
  ICardiacDiagnosticReportDocument,
  ICssdBatchLogDocument,
  IInfectionControlLogDocument,
  IMortuaryRecordDocument,
  PathologyStatus,
  CardiacType,
  CssdStatus,
  MortuaryStatus,
} from './diagnostics-support.types.js';

const PathologyReportSchema = new Schema<IPathologyReportDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    specimenType: { type: String, required: true, trim: true },
    organOrSite: { type: String, required: true, trim: true },
    clinicalDiagnosis: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(PathologyStatus),
      default: PathologyStatus.SPECIMEN_RECEIVED,
      required: true,
      index: true,
    },
    grossDescription: { type: String, trim: true },
    microscopicDescription: { type: String, trim: true },
    pathologistImpression: { type: String, trim: true },
    pathologistId: { type: Schema.Types.ObjectId, ref: 'User' },
    receivedAt: { type: Date, default: Date.now, required: true },
    reportedAt: { type: Date },
  },
  { timestamps: true }
);

const CardiacDiagnosticReportSchema = new Schema<ICardiacDiagnosticReportDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    cardiologistId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: Object.values(CardiacType), required: true, index: true },
    ejectionFractionPercent: { type: Number },
    rhythm: { type: String, trim: true },
    valvularStatus: { type: String, trim: true },
    wallMotionSummary: { type: String, trim: true },
    impression: { type: String, required: true, trim: true },
    recordedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const CssdBatchLogSchema = new Schema<ICssdBatchLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    batchCode: { type: String, required: true, trim: true, index: true },
    autoclaveMachineId: { type: String, required: true, trim: true },
    trayDescription: { type: String, required: true, trim: true },
    cycleTemperatureCelsius: { type: Number, default: 134 },
    cyclePressureBar: { type: Number, default: 2.1 },
    indicatorTapePassed: { type: Boolean, default: true },
    sterilizedAt: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(CssdStatus),
      default: CssdStatus.STERILE,
      required: true,
      index: true,
    },
    operatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const InfectionControlLogSchema = new Schema<IInfectionControlLogDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    wardId: { type: String, trim: true },
    pathogenIsolated: { type: String, trim: true },
    infectionSite: { type: String, trim: true },
    surveillanceType: {
      type: String,
      enum: ['NOSOCOMIAL', 'OUTBREAK_MONITORING', 'AUDIT'],
      default: 'NOSOCOMIAL',
    },
    isolationPrecautionsRequired: { type: Boolean, default: false },
    notes: { type: String, required: true, trim: true },
    auditedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    auditedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true }
);

const MortuaryRecordSchema = new Schema<IMortuaryRecordDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    deceasedName: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    dateOfDeath: { type: Date, default: Date.now, required: true },
    causeOfDeath: { type: String, required: true, trim: true },
    bodyTagCode: { type: String, required: true, unique: true, index: true },
    chamberBayNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(MortuaryStatus),
      default: MortuaryStatus.ADMITTED,
      required: true,
      index: true,
    },
    nextOfKinName: { type: String, required: true, trim: true },
    nextOfKinPhone: { type: String, required: true, trim: true },
    releasedAt: { type: Date },
    releasedTo: { type: String, trim: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const PathologyReportModel = model<IPathologyReportDocument>('PathologyReport', PathologyReportSchema);
export const CardiacDiagnosticReportModel = model<ICardiacDiagnosticReportDocument>('CardiacDiagnosticReport', CardiacDiagnosticReportSchema);
export const CssdBatchLogModel = model<ICssdBatchLogDocument>('CssdBatchLog', CssdBatchLogSchema);
export const InfectionControlLogModel = model<IInfectionControlLogDocument>('InfectionControlLog', InfectionControlLogSchema);
export const MortuaryRecordModel = model<IMortuaryRecordDocument>('MortuaryRecord', MortuaryRecordSchema);

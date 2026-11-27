import { Schema, model } from 'mongoose';
import {
  ISpecialtyEncounterDocument,
  ClinicalSpecialty,
  SpecialtyEncounterStatus,
} from './clinical-specialty.types.js';

const DiagnosisItemSchema = new Schema(
  {
    code: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, enum: ['PRIMARY', 'SECONDARY', 'DIFFERENTIAL'], default: 'PRIMARY' },
  },
  { _id: false }
);

const PrescriptionItemSchema = new Schema(
  {
    medicationName: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    instructions: { type: String, trim: true },
  },
  { _id: false }
);

const ProcedurePerformedSchema = new Schema(
  {
    procedureName: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    performedAt: { type: Date, default: Date.now, required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const SpecialtyEncounterSchema = new Schema<ISpecialtyEncounterDocument>(
  {
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    specialty: {
      type: String,
      enum: Object.values(ClinicalSpecialty),
      required: true,
      index: true,
    },
    chiefComplaint: { type: String, required: true, trim: true },
    historyOfPresentIllness: { type: String, trim: true },
    physicalExamination: { type: String, trim: true },
    specialtyData: { type: Schema.Types.Mixed, default: {} },
    diagnoses: [DiagnosisItemSchema],
    prescriptions: [PrescriptionItemSchema],
    proceduresPerformed: [ProcedurePerformedSchema],
    treatmentPlan: { type: String, trim: true },
    followUpDate: { type: Date },
    status: {
      type: String,
      enum: Object.values(SpecialtyEncounterStatus),
      default: SpecialtyEncounterStatus.COMPLETED,
      required: true,
      index: true,
    },
    encounterDate: { type: Date, default: Date.now, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SpecialtyEncounterSchema.index({ hospitalId: 1, specialty: 1, encounterDate: -1 });

export const SpecialtyEncounterModel = model<ISpecialtyEncounterDocument>(
  'SpecialtyEncounter',
  SpecialtyEncounterSchema
);

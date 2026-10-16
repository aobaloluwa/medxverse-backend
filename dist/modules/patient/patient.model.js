import mongoose, { Schema, model } from 'mongoose';
import { Gender, AllergySeverity, MedicalHistoryStatus, } from './patient.types.js';
const VitalsSchema = new Schema({
    temperature: Number,
    systolicBp: Number,
    diastolicBp: Number,
    pulseRate: Number,
    respiratoryRate: Number,
    spo2: Number,
    weight: Number,
    height: Number,
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recordedAt: { type: Date, default: Date.now },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
}, { _id: true });
const PatientSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    universalPatientId: { type: String, required: true, unique: true, index: true, trim: true },
    mrn: { type: String, required: true, index: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true, index: true },
    gender: { type: String, enum: Object.values(Gender), required: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    maritalStatus: { type: String, trim: true },
    occupation: { type: String, trim: true },
    nextOfKin: { type: String, trim: true },
    informant: { type: String, trim: true },
    bloodGroup: { type: String },
    genotype: { type: String },
    policyNumber: { type: String, trim: true },
    hmoId: { type: Schema.Types.ObjectId, ref: 'HmoProvider' },
    vitalsHistory: { type: [VitalsSchema], default: [] },
    allergies: {
        type: [{
                allergen: { type: String, required: true, trim: true },
                reaction: { type: String, required: true, trim: true },
                severity: { type: String, enum: Object.values(AllergySeverity), default: AllergySeverity.MODERATE },
            }],
        default: [],
    },
    medicalHistory: {
        type: [{
                condition: { type: String, required: true, trim: true },
                diagnosedDate: Date,
                status: { type: String, enum: Object.values(MedicalHistoryStatus), default: MedicalHistoryStatus.ACTIVE },
                notes: String,
            }],
        default: [],
    },
    active: { type: Boolean, default: true, index: true },
    mergedInto: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    isFlagged: { type: Boolean, default: false },
    flagReason: String,
}, { timestamps: true });
PatientSchema.index({ hospitalId: 1, createdAt: -1 });
PatientSchema.index({ hospitalId: 1, lastName: 1, firstName: 1 });
PatientSchema.index({ hospitalId: 1, phone: 1 });
PatientSchema.index({ hospitalId: 1, email: 1 });
const ResourceBaseSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    resourceId: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    status: String,
    code: {
        system: String,
        code: String,
        display: String,
    },
    sensitive: { type: Boolean, default: false, index: true },
    sensitivityCode: { type: String, trim: true, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department: String,
}, { timestamps: true, minimize: false });
ResourceBaseSchema.index({ hospitalId: 1, patientId: 1, createdAt: -1 });
ResourceBaseSchema.index({ hospitalId: 1, patientId: 1, resourceType: 1, resourceId: 1, version: -1 });
const EncounterSchema = ResourceBaseSchema.clone();
const ObservationSchema = ResourceBaseSchema.clone();
const ConditionSchema = ResourceBaseSchema.clone();
const MedicationStatementSchema = ResourceBaseSchema.clone();
const ServiceRequestSchema = ResourceBaseSchema.clone();
const DocumentReferenceSchema = ResourceBaseSchema.clone();
const ProcedureSchema = ResourceBaseSchema.clone();
const ClaimSchema = ResourceBaseSchema.clone();
const EHRResourceOptions = {
    timestamps: true,
    minimize: false,
};
function attachResourceType(schema, resourceType) {
    schema.add({ resourceType: { type: String, enum: [resourceType], default: resourceType, immutable: true } });
}
attachResourceType(EncounterSchema, 'Encounter');
attachResourceType(ObservationSchema, 'Observation');
attachResourceType(ConditionSchema, 'Condition');
attachResourceType(MedicationStatementSchema, 'MedicationStatement');
attachResourceType(ServiceRequestSchema, 'ServiceRequest');
attachResourceType(DocumentReferenceSchema, 'DocumentReference');
attachResourceType(ProcedureSchema, 'Procedure');
attachResourceType(ClaimSchema, 'Claim');
const EhrEventSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    resourceType: {
        type: String,
        enum: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationStatement', 'ServiceRequest', 'DocumentReference', 'Procedure', 'Claim'],
        required: true,
        index: true,
    },
    resourceId: { type: String, required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    action: { type: String, enum: ['CREATE', 'UPDATE', 'MERGE', 'DELETE', 'AMEND'], required: true },
    occurredAt: { type: Date, default: Date.now, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department: String,
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    reason: String,
    previousVersion: Number,
    resource: { type: Schema.Types.Mixed, required: true, minimize: false },
    sensitive: { type: Boolean, default: false, index: true },
    sensitivityCode: String,
    changedFields: { type: [String], default: [] },
    sourceKey: { type: String, sparse: true, unique: true, index: true },
    sourceSystem: { type: String, index: true },
    sourceModel: { type: String, index: true },
    sourceRecordId: { type: String, index: true },
}, { timestamps: true, minimize: false });
EhrEventSchema.index({ patientId: 1, resourceType: 1, resourceId: 1, version: 1 }, { unique: true });
EhrEventSchema.index({ hospitalId: 1, patientId: 1, occurredAt: -1 });
const EhrAuditLogSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, enum: ['READ', 'WRITE', 'MERGE', 'CONSENT'], required: true, index: true },
    resourceType: { type: String, index: true },
    resourceId: String,
    fields: { type: [String], default: [] },
    allowed: { type: Boolean, required: true },
    reason: String,
    occurredAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
EhrAuditLogSchema.index({ hospitalId: 1, patientId: 1, occurredAt: -1 });
const ConsentRecordSchema = new Schema({
    hospitalId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED', 'PENDING'], required: true, index: true },
    resourceTypes: {
        type: [String],
        enum: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationStatement', 'ServiceRequest', 'DocumentReference', 'Procedure', 'Claim', 'ALL'],
        required: true,
    },
    sensitivityCode: String,
    grantedToRoles: { type: [String], default: [] },
    grantedToUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    validFrom: Date,
    validUntil: Date,
    purpose: String,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
ConsentRecordSchema.index({ hospitalId: 1, patientId: 1, status: 1 });
const PatientEhrViewSchema = new Schema({
    patient: { type: Schema.Types.Mixed, required: true },
    resources: { type: Schema.Types.Mixed, required: true, default: {} },
    timeline: { type: [Schema.Types.Mixed], default: [] },
    resourceCount: { type: Number, default: 0 },
}, { timestamps: true, minimize: false });
PatientEhrViewSchema.index({ 'patient.hospitalId': 1 });
PatientEhrViewSchema.index({ 'patient._id': 1 }, { unique: true });
export const PatientModel = mongoose.models.Patient ||
    model('Patient', PatientSchema);
export const EncounterModel = mongoose.models.Encounter || model('Encounter', EncounterSchema);
export const ObservationModel = mongoose.models.Observation || model('Observation', ObservationSchema);
export const ConditionModel = mongoose.models.Condition || model('Condition', ConditionSchema);
export const MedicationStatementModel = mongoose.models.MedicationStatement || model('MedicationStatement', MedicationStatementSchema);
export const ServiceRequestModel = mongoose.models.ServiceRequest || model('ServiceRequest', ServiceRequestSchema);
export const DocumentReferenceModel = mongoose.models.DocumentReference || model('DocumentReference', DocumentReferenceSchema);
export const ProcedureModel = mongoose.models.Procedure || model('Procedure', ProcedureSchema);
export const ClaimModel = mongoose.models.Claim || model('Claim', ClaimSchema);
export const EhrEventModel = mongoose.models.EhrEvent || model('EhrEvent', EhrEventSchema);
export const EhrAuditLogModel = mongoose.models.EhrAuditLog || model('EhrAuditLog', EhrAuditLogSchema);
export const ConsentRecordModel = mongoose.models.ConsentRecord || model('ConsentRecord', ConsentRecordSchema);
export const PatientEhrViewModel = mongoose.models.PatientEhrView || model('PatientEhrView', PatientEhrViewSchema);

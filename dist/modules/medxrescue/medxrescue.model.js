import mongoose, { Schema, model } from 'mongoose';
import { IncidentStatus, IncidentPriority, ProviderVerificationStatus, ProviderOperationalStatus, RescueVehicleClass, DispatchOfferStatus, FacilityAcceptanceStatus, } from './medxrescue.types.js';
const GeoPointSchema = new Schema({ type: { type: String, enum: ['Point'], required: true, default: 'Point' }, coordinates: { type: [Number], required: true, validate: { validator: (v) => v.length === 2 && v.every(Number.isFinite), message: 'Coordinates must be [longitude, latitude].' } } }, { _id: false });
const IncidentEventSchema = new Schema({ status: { type: String, enum: Object.values(IncidentStatus), required: true }, at: { type: Date, required: true, default: Date.now }, actorType: { type: String, enum: ['GUEST', 'STAFF', 'SYSTEM', 'CREW'], required: true }, actorId: Schema.Types.ObjectId, note: { type: String, maxlength: 500 } }, { _id: false });
const IncidentSchema = new Schema({
    publicReference: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: Object.values(IncidentStatus), default: IncidentStatus.REQUEST_RECEIVED, index: true },
    priority: { type: String, enum: Object.values(IncidentPriority), default: IncidentPriority.UNTRIAGED, index: true },
    intakeChannel: { type: String, required: true, enum: ['GUEST_WEB', 'APP_SOS', 'CALL_CENTRE', 'ASSISTED', 'HOSPITAL_TRANSFER', 'OTHER'] },
    callerName: { type: String, trim: true, maxlength: 120 }, callerPhone: { type: String, required: true, trim: true, maxlength: 40 },
    callerIsPatient: { type: Boolean, default: true }, patientName: { type: String, trim: true, maxlength: 120 }, patientAge: { type: Number, min: 0, max: 120 },
    chiefComplaint: { type: String, required: true, trim: true, maxlength: 500 }, additionalDetails: { type: String, trim: true, maxlength: 2000 },
    triageAnswers: { type: [{ questionId: { type: String, required: true, trim: true, maxlength: 80 }, answer: { type: String, required: true, trim: true, maxlength: 300 } }], default: [] },
    triageUrgency: { type: String, enum: ['IMMEDIATE', 'URGENT', 'ROUTINE', 'UNKNOWN'], default: 'UNKNOWN', index: true },
    triageSuggestedUrgency: { type: String, enum: ['IMMEDIATE', 'URGENT', 'ROUTINE', 'UNKNOWN'], default: 'UNKNOWN', index: true },
    triageReviewedBy: Schema.Types.ObjectId, triageReviewedAt: Date,
    location: { type: GeoPointSchema }, landmark: { type: String, trim: true, maxlength: 500 }, locationDescription: { type: String, trim: true, maxlength: 500 }, locationAccuracyMeters: { type: Number, min: 0, max: 100000 },
    destinationFacilityId: { type: Schema.Types.ObjectId, ref: 'RescueFacility' }, providerId: { type: Schema.Types.ObjectId, ref: 'RescueProvider' },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'RescueVehicle' }, acceptedOfferId: { type: Schema.Types.ObjectId, ref: 'RescueDispatchOffer' },
    guestTokenHash: { type: String, required: true, select: false }, guestTokenExpiresAt: { type: Date, required: true },
    idempotencyKey: { type: String, required: true }, idempotencyFingerprint: { type: String, required: true, select: false }, events: { type: [IncidentEventSchema], default: [] }, cancelledAt: Date, handedOverAt: Date,
}, { timestamps: true });
IncidentSchema.index({ location: '2dsphere' });
IncidentSchema.index({ idempotencyKey: 1 }, { unique: true });
IncidentSchema.index({ status: 1, priority: 1, createdAt: 1 });
const ProviderSchema = new Schema({
    legalName: { type: String, required: true, trim: true, maxlength: 200 }, displayName: { type: String, required: true, trim: true, maxlength: 120 },
    registrationNumber: { type: String, trim: true, maxlength: 100 }, contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 40 }, contactEmail: { type: String, trim: true, lowercase: true, maxlength: 200 },
    operatingAreas: { type: [String], required: true, validate: { validator: (v) => v.length > 0 && v.length <= 50, message: 'At least one operating area is required.' } },
    verificationStatus: { type: String, enum: Object.values(ProviderVerificationStatus), default: ProviderVerificationStatus.PENDING, index: true },
    operationalStatus: { type: String, enum: Object.values(ProviderOperationalStatus), default: ProviderOperationalStatus.OFFLINE, index: true },
    submittedDocuments: [{ kind: { type: String, required: true }, reference: { type: String, required: true }, uploadedAt: { type: Date, default: Date.now } }],
    reviewedBy: Schema.Types.ObjectId, reviewedAt: Date, reviewNotes: { type: String, maxlength: 1000 },
}, { timestamps: true });
ProviderSchema.index({ legalName: 1, contactPhone: 1 }, { unique: true });
const VehicleSchema = new Schema({
    providerId: { type: Schema.Types.ObjectId, ref: 'RescueProvider', required: true, index: true },
    registrationNumber: { type: String, required: true, trim: true, uppercase: true }, makeModel: { type: String, required: true, trim: true, maxlength: 120 },
    vehicleClass: { type: String, enum: Object.values(RescueVehicleClass), required: true, index: true }, equipment: [{ type: String, trim: true }],
    crewQualifications: [{ type: String, trim: true }], status: { type: String, enum: [...Object.values(ProviderOperationalStatus), 'DISPATCHED', 'MAINTENANCE'], default: ProviderOperationalStatus.OFFLINE, index: true },
    location: GeoPointSchema, locationUpdatedAt: Date, locationAccuracyMeters: { type: Number, min: 0, max: 100000 }, activeIncidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident' },
}, { timestamps: true });
VehicleSchema.index({ providerId: 1, registrationNumber: 1 }, { unique: true });
VehicleSchema.index({ location: '2dsphere' });
const OfferSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, index: true }, providerId: { type: Schema.Types.ObjectId, ref: 'RescueProvider', required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'RescueVehicle', required: true }, status: { type: String, enum: Object.values(DispatchOfferStatus), default: DispatchOfferStatus.PENDING, index: true },
    offeredBy: { type: Schema.Types.ObjectId, required: true }, offeredAt: { type: Date, default: Date.now }, expiresAt: { type: Date, required: true, index: true }, respondedAt: Date, responseNote: { type: String, maxlength: 500 },
}, { timestamps: true });
OfferSchema.index({ incidentId: 1, status: 1 });
// Parallel offers are intentional: a dispatcher-approved first wave may notify several eligible providers.
// Assignment uniqueness is enforced transactionally on the incident and vehicle, not by limiting pending offers.
OfferSchema.index({ vehicleId: 1, status: 1 });
const AuditSchema = new Schema({ incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', index: true }, actorType: { type: String, required: true }, actorId: Schema.Types.ObjectId, action: { type: String, required: true, index: true }, reason: { type: String, maxlength: 1000 }, metadata: { type: Schema.Types.Mixed } }, { timestamps: { createdAt: true, updatedAt: false } });
export const RescueIncidentModel = mongoose.models.RescueIncident || model('RescueIncident', IncidentSchema);
export const RescueProviderModel = mongoose.models.RescueProvider || model('RescueProvider', ProviderSchema);
export const RescueVehicleModel = mongoose.models.RescueVehicle || model('RescueVehicle', VehicleSchema);
export const RescueDispatchOfferModel = mongoose.models.RescueDispatchOffer || model('RescueDispatchOffer', OfferSchema);
export const RescueAuditModel = mongoose.models.RescueAudit || model('RescueAudit', AuditSchema);
const FacilitySchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 200 },
    ownerAccountId: { type: Schema.Types.ObjectId, required: true, index: true },
    facilityType: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, required: true, trim: true, maxlength: 500 },
    location: { type: GeoPointSchema, required: true },
    capabilities: { type: [String], default: [], validate: { validator: (v) => v.length <= 100 } },
    operatingHours: { type: String, trim: true, maxlength: 200 },
    emergencyContactPhone: { type: String, required: true, trim: true, maxlength: 40 },
    active: { type: Boolean, default: false, index: true },
}, { timestamps: true });
FacilitySchema.index({ location: '2dsphere' });
FacilitySchema.index({ ownerAccountId: 1, name: 1 }, { unique: true });
const FacilityAcceptanceSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'RescueFacility', required: true, index: true },
    status: { type: String, enum: Object.values(FacilityAcceptanceStatus), default: FacilityAcceptanceStatus.PENDING, index: true },
    requestedBy: { type: Schema.Types.ObjectId, required: true },
    requestedAt: { type: Date, default: Date.now },
    respondedBy: Schema.Types.ObjectId,
    respondedAt: Date,
    responseNote: { type: String, maxlength: 1000 },
}, { timestamps: true });
FacilityAcceptanceSchema.index({ incidentId: 1, facilityId: 1, status: 1 });
const ClinicalHandoverSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, unique: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'RescueFacility', required: true },
    acceptedBy: { type: Schema.Types.ObjectId, required: true },
    handedOverBy: { type: Schema.Types.ObjectId, required: true },
    handedOverAt: { type: Date, required: true, default: Date.now },
    summary: { type: String, required: true, trim: true, maxlength: 4000 },
    clinicalNotes: { type: String, trim: true, maxlength: 10000 },
    vitalSigns: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
export const RescueFacilityModel = mongoose.models.RescueFacility || model('RescueFacility', FacilitySchema);
export const RescueFacilityAcceptanceModel = mongoose.models.RescueFacilityAcceptance || model('RescueFacilityAcceptance', FacilityAcceptanceSchema);
export const RescueClinicalHandoverModel = mongoose.models.RescueClinicalHandover || model('RescueClinicalHandover', ClinicalHandoverSchema);
const ProviderMemberSchema = new Schema({
    providerId: { type: Schema.Types.ObjectId, ref: 'RescueProvider', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    memberRole: { type: String, enum: ['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC'], required: true },
    active: { type: Boolean, default: true, index: true },
    linkedBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });
ProviderMemberSchema.index({ providerId: 1, userId: 1 }, { unique: true });
ProviderMemberSchema.index({ userId: 1, active: 1 });
export const RescueProviderMemberModel = mongoose.models.RescueProviderMember || model('RescueProviderMember', ProviderMemberSchema);
const PreShiftChecklistSchema = new Schema({
    vehicleId: { type: Schema.Types.ObjectId, ref: 'RescueVehicle', required: true, index: true },
    providerId: { type: Schema.Types.ObjectId, ref: 'RescueProvider', required: true, index: true },
    performedBy: { type: Schema.Types.ObjectId, required: true },
    checkedAt: { type: Date, default: Date.now },
    fuelLevelPercent: { type: Number, required: true, min: 0, max: 100 },
    oxygenPressurePsi: { type: Number, required: true, min: 0 },
    aedFunctional: { type: Boolean, required: true },
    monitorFunctional: { type: Boolean, required: true },
    airwayKitComplete: { type: Boolean, required: true },
    ppeStocked: { type: Boolean, required: true },
    stretcherFunctional: { type: Boolean, required: true },
    essentialMedsStocked: { type: Boolean, required: true },
    passed: { type: Boolean, required: true },
    notes: { type: String, maxlength: 1000 },
}, { timestamps: true });
const ClinicalObservationSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, index: true },
    recordedBy: { type: Schema.Types.ObjectId, required: true },
    recordedAt: { type: Date, default: Date.now },
    heartRateBpm: { type: Number, min: 0, max: 300 },
    systolicBpMmHg: { type: Number, min: 0, max: 300 },
    diastolicBpMmHg: { type: Number, min: 0, max: 200 },
    spO2Percent: { type: Number, min: 0, max: 100 },
    respiratoryRateBpm: { type: Number, min: 0, max: 100 },
    temperatureCelsius: { type: Number, min: 20, max: 45 },
    gcsScore: { type: Number, min: 3, max: 15 },
    avpuScale: { type: String, enum: ['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'] },
    ecgLeadResult: { type: String, maxlength: 500 },
    deviceProvenance: { type: String, maxlength: 200 },
    notes: { type: String, maxlength: 1000 },
}, { timestamps: true });
const EPCRSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, unique: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'RescueVehicle', required: true },
    clinicianId: { type: Schema.Types.ObjectId, required: true },
    chiefComplaint: { type: String, required: true, maxlength: 500 },
    historyOfPresentIllness: { type: String, maxlength: 3000 },
    abcdeAssessment: {
        airway: { type: String, maxlength: 500 },
        breathing: { type: String, maxlength: 500 },
        circulation: { type: String, maxlength: 500 },
        disability: { type: String, maxlength: 500 },
        exposure: { type: String, maxlength: 500 },
    },
    sampleHistory: {
        signsSymptoms: { type: String, maxlength: 1000 },
        allergies: { type: String, maxlength: 1000 },
        medications: { type: String, maxlength: 1000 },
        pastHistory: { type: String, maxlength: 1000 },
        lastOralIntake: { type: String, maxlength: 500 },
        eventsPreceding: { type: String, maxlength: 1000 },
    },
    interventions: [{
            time: { type: Date, default: Date.now },
            intervention: { type: String, required: true, maxlength: 300 },
            doseOrRoute: { type: String, maxlength: 200 },
            administeredBy: { type: String, maxlength: 150 },
            patientResponse: { type: String, maxlength: 500 },
        }],
    triageTag: { type: String, enum: ['RED', 'YELLOW', 'GREEN', 'BLACK'] },
    receivingFacilityId: { type: Schema.Types.ObjectId, ref: 'RescueFacility' },
    receivingClinicianName: { type: String, maxlength: 150 },
    clinicianSignature: { type: String, maxlength: 500 },
    completedAt: Date,
    isSigned: { type: Boolean, default: false },
}, { timestamps: true });
const HospitalTeamActivationSchema = new Schema({
    incidentId: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'RescueFacility', required: true, index: true },
    activatedBy: { type: Schema.Types.ObjectId, required: true },
    teamType: { type: String, enum: ['RESUSCITATION', 'CARDIAC', 'STROKE', 'TRAUMA', 'OBSTETRIC', 'PEDIATRIC', 'THEATRE', 'ICU'], required: true },
    notes: { type: String, maxlength: 1000 },
    activatedAt: { type: Date, default: Date.now },
    acknowledgedAt: Date,
    acknowledgedBy: Schema.Types.ObjectId,
}, { timestamps: true });
export const RescuePreShiftChecklistModel = mongoose.models.RescuePreShiftChecklist || model('RescuePreShiftChecklist', PreShiftChecklistSchema);
export const RescueClinicalObservationModel = mongoose.models.RescueClinicalObservation || model('RescueClinicalObservation', ClinicalObservationSchema);
export const RescueEPCRModel = mongoose.models.RescueEPCR || model('RescueEPCR', EPCRSchema);
export const RescueHospitalTeamActivationModel = mongoose.models.RescueHospitalTeamActivation || model('RescueHospitalTeamActivation', HospitalTeamActivationSchema);

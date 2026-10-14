import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import {
  PatientModel,
  EncounterModel,
  ObservationModel,
  ConditionModel,
  MedicationStatementModel,
  ServiceRequestModel,
  DocumentReferenceModel,
  ProcedureModel,
  ClaimModel,
  EhrEventModel,
  ConsentRecordModel,
  EhrAuditLogModel,
  PatientEhrViewModel,
} from './patient.model.js';
// Register HMS model definitions before the patient registry queries them.
// These are side-effect imports only; the patient module remains the owner of the
// cross-module registry API. The registry itself is schema-driven and discovers
// every registered model that carries a patientId field.
import '../admissions/admissions.model.js';
import '../ambulance/ambulance.model.js';
import '../appointment/appointment.model.js';
import '../bed-ward/bed-ward.model.js';
import '../billing/billing.model.js';
import '../blood-bank/blood-bank.model.js';
import '../consultation/consultation.model.js';
import '../dental/dental.model.js';
import '../dietary/dietary.model.js';
import '../emergency/emergency.model.js';
import '../eye-clinic/eye-clinic.model.js';
import '../icu/icu.model.js';
import '../lab/lab.model.js';
import '../mch/mch.model.js';
import '../mental-health/mental-health.model.js';
import '../ot/ot.model.js';
import '../outpatient/outpatient.model.js';
import '../pharmacy/pharmacy.model.js';
import '../radiology/radiology.model.js';
import '../surgery/surgery.model.js';
import '../telemedicine/telemedicine.model.js';

import '../administration/administration.model.js';
import '../admissions/admissions.model.js';
import '../ambulance/ambulance.model.js';
import '../analytics/analytics.model.js';
import '../appointment/appointment.model.js';
import '../auth/auth.model.js';
import '../bed-ward/bed-ward.model.js';
import '../benefits/benefits.model.js';
import '../billing/billing.model.js';
import '../blood-bank/blood-bank.model.js';
import '../claims/claims.model.js';
import '../consultation/consultation.model.js';
import '../dental/dental.model.js';
import '../dietary/dietary.model.js';
import '../eligibility/eligibility.model.js';
import '../emergency/emergency.model.js';
import '../enrollees/enrollees.card.model.js';
import '../enrollees/enrollees.lifecycle.model.js';
import '../enrollees/enrollees.model.js';
import '../eye-clinic/eye-clinic.model.js';
import '../health-plans/health-plans.model.js';
import '../hmo/hmo.model.js';
import '../hmo-billing/hmo-billing.model.js';
import '../hmo-portals/hmo-portals.model.js';
import '../hmo-utilization/hmo-utilization.model.js';
import '../hms-dashboard/hms-dashboard.model.js';
import '../hms-notifications/notifications.model.js';
import '../hms-reports/reports.model.js';
import '../icu/icu.model.js';
import '../inventory/inventory.model.js';
import '../lab/lab.extended.model.js';
import '../lab/lab.model.js';
import '../lexi-ai/lexi.model.js';
import '../mch/mch.model.js';
import '../members/members.model.js';
import '../mental-health/mental-health.model.js';
import '../notifications/notifications.model.js';
import '../ot/ot.model.js';
import '../outpatient/outpatient.model.js';
import '../pharmacy/pharmacy.model.js';
import '../pre-authorizations/pre-authorizations.model.js';
import '../provider/provider.model.js';
import '../radiology/radiology.model.js';
import '../reports/reports.model.js';
import '../rostering/rostering.model.js';
import '../settings/settings.model.js';
import '../staff/staff.model.js';
import '../surgery/surgery.model.js';
import '../tariffs/tariffs.model.js';
import '../telemedicine/telemedicine.model.js';
import { Staff } from '../staff/staff.model.js';
import { HMOProviderModel } from '../provider/provider.model.js';
import { Account } from '../auth/auth.model.js';
import {
  CreatePatientDTO,
  UpdatePatientDTO,
  AddVitalsDTO,
  GetPatientsQueryDTO,
  CreateEncounterDTO,
  CreateEHRResourceDTO,
  CreateConsentDTO,
  IPatientDocument,
  DuplicateCandidate,
  PatientClinicalSummary,
  PatientEhrChart,
  FhirResourceType,
  IClinicalSummaryItem,
  PatientRegistry,
  PatientRegistrySection,
  PatientRegistryOverview,
} from './patient.types.js';

type AnyRecord = Record<string, any>;
type Actor = { userId: string; role?: string };

const RESOURCE_MODELS: Record<Exclude<FhirResourceType, 'Patient'>, any> = {
  Encounter: EncounterModel,
  Observation: ObservationModel,
  Condition: ConditionModel,
  MedicationStatement: MedicationStatementModel,
  ServiceRequest: ServiceRequestModel,
  DocumentReference: DocumentReferenceModel,
  Procedure: ProcedureModel,
  Claim: ClaimModel,
};

const RESTRICTED_CODES = new Set(['MENTAL_HEALTH', 'HIV', 'HIV_STATUS', 'PSYCHIATRIC']);

type RegistrySource = {
  key: string;
  label: string;
  modelNames: string[];
  limit?: number;
};

const PATIENT_REGISTRY_SOURCES: RegistrySource[] = [
  { key: 'admissions', label: 'Admissions', modelNames: ['InpatientAdmission'] },
  { key: 'ambulance', label: 'Ambulance', modelNames: ['TripRequest'] },
  // The patient registry should show booked appointments only. Queue tickets,
  // reminders, and risk scores are operational children of an appointment and
  // must not appear as duplicate appointments in the patient view.
  { key: 'appointments', label: 'Appointments', modelNames: ['Appointment'] },
  { key: 'bedWard', label: 'Bed & Ward', modelNames: ['BedAssignment', 'BedStatusEvent', 'TransferRequest'] },
  // BillingAccount is the parent container for the patient's charges and
  // payments, not a billable event. Returning it alongside its children makes
  // one billing action appear twice in the patient registry.
  { key: 'billing', label: 'Billing', modelNames: ['BillingCharge', 'BillingPayment', 'BillingRefund', 'PaymentPlan'], limit: 100 },
  { key: 'bloodBank', label: 'Blood Bank', modelNames: ['TransfusionRequest'] },
  { key: 'consultations', label: 'Consultations', modelNames: ['Consultation'] },
  { key: 'dental', label: 'Dental', modelNames: ['DentalChart', 'DentalProcedure'] },
  { key: 'dietary', label: 'Dietary', modelNames: ['DietaryOrder', 'MealDelivery'] },
  { key: 'emergency', label: 'Emergency', modelNames: ['EDVisit', 'TriageAssessment', 'BayAssignment', 'EDOrder', 'DispositionRecord'] },
  { key: 'eyeClinic', label: 'Eye Clinic', modelNames: ['EyeExam', 'OpticalPrescription'] },
  { key: 'icu', label: 'ICU', modelNames: ['ICUAdmission', 'DeviceReading', 'FlowsheetEntry', 'ICUScore', 'FamilyCommunicationLog'] },
  { key: 'laboratory', label: 'Laboratory', modelNames: ['LabOrder'] },
  { key: 'mch', label: 'Maternal & Child Health', modelNames: ['MchRecord'] },
  { key: 'mentalHealth', label: 'Mental Health', modelNames: ['MentalHealthAssessment', 'PsychotherapySession'] },
  // Both OT (SurgicalCase) and Surgery (SurgeryCase) represent the same
  // clinical event from different modules. Merging them under one key prevents
  // a single surgery appearing as two separate cards in the patient registry.
  { key: 'surgery', label: 'Surgery & OT', modelNames: ['SurgeryCase', 'SurgicalCase'] },
  { key: 'outpatient', label: 'Outpatient', modelNames: ['Outpatient'] },
  // DispenseRecord is an operational child of Prescription. The Prescription
  // already carries the DISPENSED status once dispensed, so including
  // DispenseRecord creates a duplicate pharmacy card for the same event.
  { key: 'pharmacy', label: 'Pharmacy', modelNames: ['Prescription', 'ControlledSubstanceLog'] },
  { key: 'radiology', label: 'Radiology', modelNames: ['RadiologyOrder'] },
  { key: 'telemedicine', label: 'Telemedicine', modelNames: ['TelemedicineSession', 'TelemedicineMessage'] },
];

const REGISTRY_DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'date',
  'serviceDate',
  'appointmentDate',
  'scheduledAt',
  'admittedAt',
  'dischargedAt',
  'arrivalAt',
  'assessedAt',
  'performedAt',
  'procedureDate',
  'studyDate',
  'examinationStartedAt',
  'completedAt',
  'resultedAt',
  'dispensedAt',
  'prescribedAt',
  'sessionDate',
  'deliveryDate',
  'chargeDate',
  'paymentDate',
];


/** Schema-driven registry helpers: every registered model with patientId is
 * included automatically, so adding a new HMS module does not require another
 * patient-registry patch. */
const REGISTRY_EXCLUDED_MODELS = new Set([
  'Patient',
  'PatientEhrView',
  'QueueTicket',
  'ReminderLog',
  'NoShowRiskScore',
  'BillingAccount',
  // DispenseRecord is an operational child of Prescription; excluded to prevent
  // duplicate pharmacy cards (one prescription + one dispense) for the same event.
  'DispenseRecord',
  // SurgicalCase is included under the merged 'surgery' key alongside SurgeryCase.
  // Listing it here prevents the auto-discover loop from adding it a second time.
  // (It is already handled explicitly in PATIENT_REGISTRY_SOURCES.)
]);

function registryHumanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function registryRefPaths(model: any): string[] {
  const paths = new Set<string>();
  try {
    model.schema.eachPath((path: string, schemaType: any) => {
      const options = schemaType?.options || {};
      const ref = options.ref || schemaType?.caster?.options?.ref;
      const refPath = options.refPath || schemaType?.caster?.options?.refPath;
      // Do not populate the patient/hospital themselves or Account records.
      // Account documents can contain authentication/security fields; the
      // registry only needs linked clinical staff/providers and catalogue data.
      if (path === 'patientId' || path === 'hospitalId') return;
      if (ref === 'Patient' || ref === 'Account') return;
      if (ref || refPath) paths.add(path);
    });
  } catch {
    // Population is optional; source records must still be returned.
  }
  return Array.from(paths);
}

const REGISTRY_STAFF_FIELDS = /doctor|physician|surgeon|nurse|clinician|provider|staff|assignedTo|performedBy|createdBy|approvedBy|orderingDoctor/i;

function registryPersonName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const person = value as AnyRecord;
  const fullName = [person.firstName, person.middleName, person.otherNames, person.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || person.name || person.fullName || person.displayName || person.username ||
    person.accountName || person.organizationName || person.facilityName || person.departmentName ||
    person.wardName || person.roomName || person.billingId || person.code || person.label ||
    registryPersonName(person.profile) || registryPersonName(person.user);
}

function registryReferenceId(value: unknown): string | undefined {
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) return value;
  if (!value || typeof value !== 'object') return undefined;
  const reference = (value as AnyRecord)._id || (value as AnyRecord).id || (value as AnyRecord).$oid;
  return typeof reference === 'string' && Types.ObjectId.isValid(reference) ? reference : undefined;
}

async function resolveRegistryPersonName(
  value: unknown,
  hospitalId: Types.ObjectId,
  cache: Map<string, string>
): Promise<string | undefined> {
  const directName = registryPersonName(value);
  if (directName) return directName;

  const id = registryReferenceId(value);
  if (!id) return undefined;
  if (cache.has(id)) {
    const cached = cache.get(id);
    return cached || undefined;
  }

  // Try Staff first (most clinical staff), then Account (some modules store
  // the Account _id instead of the Staff _id — e.g. radiology orderingDoctorId),
  // then HMO providers as a last resort.
  const [staff, account, provider] = await Promise.all([
    Staff.findOne({ _id: new Types.ObjectId(id), hospitalId })
      .select('firstName middleName otherNames lastName name')
      .lean()
      .exec(),
    Account.findById(new Types.ObjectId(id))
      .select('name firstName lastName email')
      .lean()
      .exec(),
    HMOProviderModel.findById(new Types.ObjectId(id)).select('name').lean().exec(),
  ]);

  const name = registryPersonName(staff) || registryPersonName(account) || registryPersonName(provider);
  // Cache both positive and negative results to prevent re-querying this ID
  cache.set(id, name || '');
  return name;
}

const REGISTRY_LINK_FIELDS = /^(?:hospital|patient|billingAccount|account|department|ward|bed|room|doctor|physician|surgeon|nurse|clinician|provider|staff|assignedTo|performedBy|createdBy|approvedBy|receivedBy|requestedBy|reconciledBy|user|member|enrollee)(?:Id|By)?$/i;

function isRegistryLinkField(fieldKey: string): boolean {
  return fieldKey !== '_id' && (REGISTRY_LINK_FIELDS.test(fieldKey) || /(?:Id|By)$/i.test(fieldKey));
}

async function resolveRegistryLinkedName(
  value: unknown,
  fieldKey: string,
  hospitalId: Types.ObjectId,
  cache: Map<string, string>
): Promise<string | undefined> {
  const directName = registryPersonName(value);
  if (directName) return directName;

  const id = registryReferenceId(value);
  if (!id) return undefined;
  if (cache.has(id)) {
    const cached = cache.get(id);
    return cached || undefined;
  }

  const normalizedField = fieldKey.toLowerCase();
  const objectId = new Types.ObjectId(id);
  let resolvedName: string | undefined;

  if (normalizedField === 'hospitalid' || normalizedField === 'accountid') {
    const account = await Account.findById(objectId).select('name').lean().exec();
    resolvedName = registryPersonName(account);
  } else if (normalizedField === 'patientid') {
    const patient = await PatientModel.findById(objectId)
      .select('firstName otherNames middleName lastName')
      .lean()
      .exec();
    resolvedName = registryPersonName(patient);
  } else if (normalizedField === 'billingaccountid') {
    const billingAccount = mongoose.models.BillingAccount
      ? await mongoose.models.BillingAccount.findById(objectId)
        .select('billingId accountName')
        .lean()
        .exec()
      : undefined;
    resolvedName = registryPersonName(billingAccount);
  } else if (REGISTRY_STAFF_FIELDS.test(fieldKey)) {
    resolvedName = await resolveRegistryPersonName(value, hospitalId, cache);
  } else if (/department/i.test(fieldKey) && mongoose.models.Department) {
    const dept = await mongoose.models.Department.findById(objectId).select('name code').lean().exec();
    resolvedName = registryPersonName(dept);
  } else if (/ward/i.test(fieldKey) && mongoose.models.Ward) {
    const ward = await mongoose.models.Ward.findById(objectId).select('name code').lean().exec();
    resolvedName = registryPersonName(ward);
  } else if (/bed/i.test(fieldKey) && mongoose.models.Bed) {
    const bed = await mongoose.models.Bed.findById(objectId).select('bedNumber name').lean().exec();
    resolvedName = registryPersonName(bed);
  } else if (/room/i.test(fieldKey) && mongoose.models.Room) {
    const room = await mongoose.models.Room.findById(objectId).select('name roomNumber').lean().exec();
    resolvedName = registryPersonName(room);
  }

  // Always cache (even empty string) to avoid querying again for the same ID
  cache.set(id, resolvedName || '');
  return resolvedName;
}

async function sanitizeRegistryStaff(
  value: unknown,
  hospitalId: Types.ObjectId,
  cache: Map<string, string>,
  seen = new WeakSet<object>()
): Promise<unknown> {
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return Promise.all(value.map((item) => sanitizeRegistryStaff(item, hospitalId, cache, seen)));
  }
  if (!value || typeof value !== 'object') return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  const source = value as AnyRecord;
  const result: AnyRecord = {};
  for (const [key, nestedValue] of Object.entries(source)) {
    if (REGISTRY_STAFF_FIELDS.test(key) || isRegistryLinkField(key)) {
      result[key] = await resolveRegistryLinkedName(nestedValue, key, hospitalId, cache) ||
        (typeof nestedValue === 'string' && !Types.ObjectId.isValid(nestedValue) ? nestedValue : 'Linked record');
      continue;
    }
    result[key] = await sanitizeRegistryStaff(nestedValue, hospitalId, cache, seen);
  }
  return result;
}

async function sanitizeRegistryDetails(
  row: AnyRecord,
  modelName: string,
  hospitalId: Types.ObjectId,
  cache: Map<string, string>
): Promise<AnyRecord> {
  const sanitized = await sanitizeRegistryStaff(row, hospitalId, cache) as AnyRecord;
  if (modelName === 'Appointment') delete sanitized.occupiedSlotKeys;

  return {
    ...sanitized,
    _registryModel: modelName,
  };
}

async function registryPopulate(model: any, query: any): Promise<any[]> {
  let cursor = query;

  for (const path of registryRefPaths(model)) {
    try {
      const schemaType = model.schema.path(path);
      const ref = schemaType?.options?.ref || schemaType?.caster?.options?.ref;

      // A few HMO/claims schemas use the historical ref name "Provider",
      // while the current provider module registers the model as HMOProvider.
      // Populate those references explicitly so the registry returns the
      // provider's readable name instead of a Mongo ObjectId.
      if (ref === 'Provider' && !mongoose.models.Provider && mongoose.models.HMOProvider) {
        cursor = cursor.populate({ path, model: 'HMOProvider' });
      } else if (ref && !mongoose.models[ref]) {
        // Some legacy schemas refer to renamed or optional models (for
        // example Charge -> BillingCharge). Do not let one unavailable
        // population target hide the complete patient record.
        continue;
      } else {
        cursor = cursor.populate(path);
      }
    } catch {
      // Population is best-effort. The source record must still be returned.
    }
  }

  return cursor.lean().exec();
}


export class PatientService {
  private static generateMRN(): string {
    return `MRN-${crypto.randomInt(100000, 1000000)}`;
  }

  private static generateUniversalPatientId(): string {
    return `MPI-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private static assertObjectId(value: string, fieldName: string): void {
    if (!Types.ObjectId.isValid(value)) {
      const error = new Error(`Invalid ${fieldName}.`) as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
  }

  private static bad(message: string, statusCode = 400): never {
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = statusCode;
    throw error;
  }

  private static normalizePhone(value?: string): string {
    return String(value || '').replace(/\s+/g, '').toLowerCase();
  }

  private static normalizeName(value?: string): string {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private static isSensitive(code?: string, sensitive?: boolean): boolean {
    return Boolean(sensitive || (code && RESTRICTED_CODES.has(code.toUpperCase())));
  }

  private static resourceModel(resourceType: Exclude<FhirResourceType, 'Patient'>): any {
    const model = RESOURCE_MODELS[resourceType];
    if (!model) this.bad(`Unsupported EHR resource type: ${resourceType}`);
    return model;
  }

  private static async appendEvent(
    data: {
      hospitalId: string;
      patientId: string;
      resourceType: FhirResourceType;
      resourceId: string;
      action: 'CREATE' | 'UPDATE' | 'MERGE' | 'DELETE' | 'AMEND';
      recordedBy: string;
      department?: string;
      encounterId?: string;
      reason?: string;
      sensitive?: boolean;
      sensitivityCode?: string;
      changedFields?: string[];
      sourceKey?: string;
      sourceSystem?: string;
      sourceModel?: string;
      sourceRecordId?: string;
      occurredAt?: Date;
      resource: AnyRecord;
    },
    session?: mongoose.ClientSession
  ) {
    const last = await EhrEventModel.findOne({
      patientId: new Types.ObjectId(data.patientId),
      resourceType: data.resourceType,
      resourceId: data.resourceId,
    }).sort({ version: -1 }).session(session || null);

    const version = (last?.version || 0) + 1;

    return EhrEventModel.create(
      [{
        hospitalId: new Types.ObjectId(data.hospitalId),
        patientId: new Types.ObjectId(data.patientId),
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        version,
        previousVersion: last?.version,
        action: data.action,
        recordedBy: new Types.ObjectId(data.recordedBy),
        department: data.department,
        encounterId: data.encounterId ? new Types.ObjectId(data.encounterId) : undefined,
        reason: data.reason,
        sensitive: Boolean(data.sensitive),
        sensitivityCode: data.sensitivityCode,
        changedFields: data.changedFields || [],
        sourceKey: data.sourceKey,
        sourceSystem: data.sourceSystem,
        sourceModel: data.sourceModel,
        sourceRecordId: data.sourceRecordId,
        resource: data.resource,
        occurredAt: data.occurredAt || new Date(),
      }],
      { session }
    ).then((rows) => rows[0]);
  }

  private static toFhirResource(
    resourceType: FhirResourceType,
    id: string,
    version: number,
    resource: AnyRecord,
    lastUpdated: Date,
    sensitive = false,
    sensitivityCode?: string
  ): AnyRecord {
    const normalized = { ...resource };
    delete normalized.resourceType;
    delete normalized.id;
    delete normalized.meta;

    return {
      resourceType,
      id,
      meta: {
        versionId: String(version),
        lastUpdated,
        security: sensitive
          ? [{ system: 'urn:medxverse:security', code: sensitivityCode || 'RESTRICTED' }]
          : [],
      },
      ...normalized,
    };
  }

  private static async canViewSensitive(
    hospitalId: string,
    patientId: string,
    resourceType: FhirResourceType,
    sensitivityCode: string | undefined,
    actor: Actor
  ): Promise<boolean> {
    const now = new Date();
    const query: AnyRecord = {
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
      status: 'ACTIVE',
      resourceTypes: { $in: ['ALL', resourceType] },
      $or: [
        { grantedToUsers: new Types.ObjectId(actor.userId) },
        { grantedToRoles: actor.role || '__NONE__' },
      ],
      $and: [
        {
          $or: [
            { sensitivityCode: { $exists: false } },
            { sensitivityCode: null },
            { sensitivityCode: sensitivityCode || '__NONE__' },
          ],
        },
        {
          $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }],
        },
        {
          $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: now } }],
        },
      ],
    };

    return Boolean(await ConsentRecordModel.exists(query));
  }

  private static async audit(
    hospitalId: string,
    patientId: string,
    actor: Actor,
    action: 'READ' | 'WRITE' | 'MERGE' | 'CONSENT',
    fields: string[],
    allowed: boolean,
    reason?: string,
    resourceType?: FhirResourceType,
    resourceId?: string
  ) {
    if (!Types.ObjectId.isValid(actor.userId)) return;
    await EhrAuditLogModel.create({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
      actorId: new Types.ObjectId(actor.userId),
      action,
      fields,
      allowed,
      reason,
      resourceType,
      resourceId,
      occurredAt: new Date(),
    });
  }

  private static async assertPatient(
    hospitalId: string,
    patientId: string
  ): Promise<IPatientDocument> {
    this.assertObjectId(hospitalId, 'hospital ID');
    this.assertObjectId(patientId, 'patient ID');

    const patient = await PatientModel.findOne({
      _id: new Types.ObjectId(patientId),
      hospitalId: new Types.ObjectId(hospitalId),
    }).exec();

    if (!patient) this.bad('Patient record not found.', 404);
    if (!patient.active && patient.mergedInto) {
      this.bad(`Patient record has been merged into ${patient.mergedInto.toString()}.`, 409);
    }
    return patient;
  }

  static async registerPatient(
    hospitalId: string,
    dto: CreatePatientDTO,
    actor?: Actor
  ): Promise<IPatientDocument> {
    this.assertObjectId(hospitalId, 'hospital ID');

    if (!dto.firstName?.trim() || !dto.lastName?.trim()) this.bad('First name and last name are required.');
    const dob = new Date(dto.dateOfBirth);
    if (Number.isNaN(dob.getTime())) this.bad('Invalid date of birth provided.');
    if (!Types.ObjectId.isValid(hospitalId)) this.bad('Invalid hospital ID.');

    const duplicateCandidates = await this.findDuplicatePatients(hospitalId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      phone: dto.phone,
      email: dto.email,
    });

    if (duplicateCandidates.length) {
      this.bad(
        `Potential duplicate patient detected. Use the duplicate-check/merge workflow before creating another canonical record. Candidate IDs: ${duplicateCandidates.map((x) => x.patient._id.toString()).join(', ')}`,
        409
      );
    }

    let mrn = this.generateMRN();
    while (await PatientModel.exists({ mrn })) mrn = this.generateMRN();

    let universalPatientId = this.generateUniversalPatientId();
    while (await PatientModel.exists({ universalPatientId })) {
      universalPatientId = this.generateUniversalPatientId();
    }

    const patient = await PatientModel.create({
      hospitalId: new Types.ObjectId(hospitalId),
      universalPatientId,
      mrn,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      dateOfBirth: dob,
      gender: dto.gender,
      phone: dto.phone.trim(),
      email: dto.email?.trim().toLowerCase(),
      address: dto.address,
      maritalStatus: dto.maritalStatus,
      occupation: dto.occupation,
      nextOfKin: dto.nextOfKin,
      informant: dto.informant,
      bloodGroup: dto.bloodGroup,
      genotype: dto.genotype,
      policyNumber: dto.policyNumber,
      hmoId: dto.hmoId ? new Types.ObjectId(dto.hmoId) : undefined,
      active: true,
    });

    if (actor) {
      await this.appendEvent({
        hospitalId,
        patientId: patient._id.toString(),
        resourceType: 'Patient',
        resourceId: patient._id.toString(),
        action: 'CREATE',
        recordedBy: actor.userId,
        resource: this.patientToFhir(patient),
      });
      await this.refreshEhrView(hospitalId, patient._id.toString());
    }

    return patient;
  }

  static async updatePatient(
    hospitalId: string,
    patientId: string,
    actor: Actor,
    dto: UpdatePatientDTO
  ): Promise<IPatientDocument> {
    const patient = await this.assertPatient(hospitalId, patientId);

    const fields = [
      'firstName', 'lastName', 'gender', 'phone', 'email', 'address',
      'maritalStatus', 'occupation', 'nextOfKin', 'informant',
      'bloodGroup', 'genotype', 'policyNumber', 'isFlagged', 'flagReason',
    ] as const;

    for (const field of fields) {
      if (dto[field] !== undefined) (patient as any)[field] = dto[field];
    }

    if (dto.dateOfBirth !== undefined) {
      const date = new Date(dto.dateOfBirth);
      if (Number.isNaN(date.getTime())) this.bad('Invalid date of birth provided.');
      patient.dateOfBirth = date;
    }

    if (dto.hmoId !== undefined) {
      if (!Types.ObjectId.isValid(dto.hmoId)) this.bad('Invalid HMO provider ID.');
      patient.hmoId = new Types.ObjectId(dto.hmoId);
    }

    await patient.save();

    await this.appendEvent({
      hospitalId,
      patientId,
      resourceType: 'Patient',
      resourceId: patientId,
      action: 'UPDATE',
      recordedBy: actor.userId,
      reason: dto.reason,
      changedFields: Object.keys(dto).filter((key) => key !== 'reason'),
      resource: this.patientToFhir(patient),
    });
    await this.audit(hospitalId, patientId, actor, 'WRITE', Object.keys(dto).filter((key) => key !== 'reason'), true, dto.reason, 'Patient', patientId);

    await this.refreshEhrView(hospitalId, patientId);
    return patient;
  }

  static async getPatients(hospitalId: string, query: GetPatientsQueryDTO) {
    this.assertObjectId(hospitalId, 'hospital ID');

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const filter: AnyRecord = {
      hospitalId: new Types.ObjectId(hospitalId),
      active: true,
    };

    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { mrn: { $regex: escaped, $options: 'i' } },
        { universalPatientId: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [patients, total] = await Promise.all([
      PatientModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // Only fetch the fields the patient list view needs. Crucially this
        // avoids loading the unbounded vitalsHistory embedded array and any
        // other large sub-documents for every patient in the result set.
        .select(
          '_id firstName otherNames lastName mrn universalPatientId gender ' +
          'dateOfBirth phone email bloodGroup genotype allergies ' +
          'isFlagged flagReason active createdAt ' +
          'vitalsHistory._id vitalsHistory.recordedAt vitalsHistory.systolicBp ' +
          'vitalsHistory.diastolicBp vitalsHistory.temperature vitalsHistory.pulseRate'
        )
        // lean() returns plain JavaScript objects instead of full Mongoose
        // Document instances — significantly faster for read-only list views.
        .lean()
        .exec(),
      PatientModel.countDocuments(filter).exec(),
    ]);

    return { patients, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async getPatientById(hospitalId: string, patientId: string): Promise<IPatientDocument> {
    return this.assertPatient(hospitalId, patientId);
  }

  static async addVitals(
    hospitalId: string,
    patientId: string,
    userId: string,
    dto: AddVitalsDTO
  ): Promise<IPatientDocument> {
    this.assertObjectId(userId, 'user ID');
    const patient = await this.assertPatient(hospitalId, patientId);

    const vitals = {
      ...dto,
      recordedBy: new Types.ObjectId(userId),
      recordedAt: new Date(),
      encounterId: dto.encounterId && Types.ObjectId.isValid(dto.encounterId)
        ? new Types.ObjectId(dto.encounterId)
        : undefined,
    };

    // Keep the legacy history for compatibility, while the EHR Observation is authoritative.
    patient.vitalsHistory.push(vitals);
    await patient.save();

    await this.appendEvent({
      hospitalId,
      patientId,
      resourceType: 'Observation',
      resourceId: new Types.ObjectId().toString(),
      action: 'CREATE',
      recordedBy: userId,
      encounterId: dto.encounterId,
      reason: 'Vital signs recorded',
      changedFields: Object.keys(dto),
      resource: {
        status: 'final',
        category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs' }] }],
        code: { coding: [{ system: 'http://loinc.org', code: 'vital-sign-panel', display: 'Vital signs panel' }] },
        subject: { reference: `Patient/${patientId}` },
        encounter: dto.encounterId ? { reference: `Encounter/${dto.encounterId}` } : undefined,
        effectiveDateTime: new Date().toISOString(),
        value: dto,
      },
    });

    await this.refreshEhrView(hospitalId, patientId);
    return patient;
  }

  static async createEncounter(
    hospitalId: string,
    actor: Actor,
    dto: CreateEncounterDTO
  ): Promise<Record<string, unknown>> {
    await this.assertPatient(hospitalId, dto.patientId);

    if (dto.practitionerId) this.assertObjectId(dto.practitionerId, 'practitioner ID');

    const resourceId = new Types.ObjectId().toString();
    const sensitive = this.isSensitive(undefined, dto.sensitive);
    const data: AnyRecord = {
      resourceType: 'Encounter',
      id: resourceId,
      status: dto.status || 'in-progress',
      class: { code: dto.class || 'AMB', display: dto.class || 'Ambulatory' },
      type: [{ text: dto.encounterType }],
      subject: { reference: `Patient/${dto.patientId}` },
      participant: dto.practitionerId
        ? [{ individual: { reference: `Practitioner/${dto.practitionerId}` } }]
        : [],
      period: {
        start: dto.start || new Date().toISOString(),
        ...(dto.end ? { end: dto.end } : {}),
      },
      reasonCode: dto.reason ? [{ text: dto.reason }] : [],
      diagnosis: dto.diagnosis ? [{ condition: { display: dto.diagnosis } }] : [],
      extension: [
        { url: 'urn:medxverse:department', valueString: dto.department || 'GENERAL' },
        ...(dto.metadata ? [{ url: 'urn:medxverse:metadata', valueJson: dto.metadata }] : []),
      ],
    };

    const model = EncounterModel;
    await model.create({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(dto.patientId),
      resourceId,
      version: 1,
      status: dto.status || 'in-progress',
      data,
      recordedBy: new Types.ObjectId(actor.userId),
      department: dto.department,
      sensitive,
    });

    await this.appendEvent({
      hospitalId,
      patientId: dto.patientId,
      resourceType: 'Encounter',
      resourceId,
      action: 'CREATE',
      recordedBy: actor.userId,
      department: dto.department,
      sensitive,
      changedFields: Object.keys(data),
      resource: data,
    });
    await this.audit(hospitalId, dto.patientId, actor, 'WRITE', Object.keys(data), true, 'Encounter created', 'Encounter', resourceId);

    await this.refreshEhrView(hospitalId, dto.patientId);
    return data;
  }

  static async createEHRResource(
    hospitalId: string,
    actor: Actor,
    dto: CreateEHRResourceDTO & {
      occurredAt?: string | Date;
      sourceKey?: string;
      sourceSystem?: string;
      sourceModel?: string;
      sourceRecordId?: string;
      recordedBy?: string;
      refreshView?: boolean;
    }
  ): Promise<Record<string, unknown>> {
    if (dto.resourceType === 'Patient') this.bad('Patient resources must be changed through the Patient endpoint.');

    const patientId = dto.patientId;
    await this.assertPatient(hospitalId, patientId);

    if (dto.encounterId) await this.assertEncounterBelongsToPatient(hospitalId, dto.encounterId, patientId);

    const resourceId = dto.id || new Types.ObjectId().toString();
    const sensitive = this.isSensitive(dto.sensitivityCode, dto.sensitive);
    const now = new Date();
    const resource = this.toFhirResource(
      dto.resourceType,
      resourceId,
      1,
      dto.resource,
      now,
      sensitive,
      dto.sensitivityCode
    );

    const model = this.resourceModel(dto.resourceType);
    await model.create({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
      encounterId: dto.encounterId ? new Types.ObjectId(dto.encounterId) : undefined,
      resourceId,
      version: 1,
      status: dto.status || resource.status,
      code: dto.code || resource.code?.coding?.[0],
      sensitive,
      sensitivityCode: dto.sensitivityCode,
      data: resource,
      recordedBy: new Types.ObjectId(dto.recordedBy || actor.userId),
      department: dto.department,
    });

    await this.appendEvent({
      hospitalId,
      patientId,
      resourceType: dto.resourceType,
      resourceId,
      action: 'CREATE',
      recordedBy: actor.userId,
      department: dto.department,
      encounterId: dto.encounterId,
      reason: dto.reason,
      sensitive,
      sensitivityCode: dto.sensitivityCode,
      changedFields: Object.keys(dto.resource),
      sourceKey: dto.sourceKey,
      sourceSystem: dto.sourceSystem,
      sourceModel: dto.sourceModel,
      sourceRecordId: dto.sourceRecordId,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      resource,
    });
    await this.audit(hospitalId, patientId, actor, 'WRITE', Object.keys(dto.resource), true, dto.reason, dto.resourceType, resourceId);

    await this.refreshEhrView(hospitalId, patientId);
    return resource;
  }

  static async importHistoricalEHRResource(
    hospitalId: string,
    dto: CreateEHRResourceDTO & {
      occurredAt: string | Date;
      sourceKey: string;
      sourceSystem?: string;
      sourceModel?: string;
      sourceRecordId?: string;
      recordedBy?: string;
      refreshView?: boolean;
    }
  ): Promise<{ status: 'IMPORTED' | 'SKIPPED'; resourceId: string }> {
    if (dto.resourceType === 'Patient') this.bad('Patient resources must be migrated through the MPI migration.');
    this.assertObjectId(hospitalId, 'hospital ID');
    this.assertObjectId(dto.patientId, 'patient ID');

    const existing = await EhrEventModel.findOne({ sourceKey: dto.sourceKey }).lean().exec();
    if (existing) return { status: 'SKIPPED', resourceId: String((existing as any).resourceId) };

    await this.assertPatient(hospitalId, dto.patientId);
    if (dto.encounterId && Types.ObjectId.isValid(dto.encounterId)) {
      // Historical resources may refer to legacy encounter IDs that have not yet been
      // backfilled. We intentionally do not fail the whole migration for that case.
    }

    const resourceId = dto.id || `legacy-${dto.sourceModel || 'Resource'}-${dto.sourceRecordId || new Types.ObjectId().toString()}`;
    const occurredAt = new Date(dto.occurredAt);
    const safeOccurredAt = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
    const recordedBy = dto.recordedBy && Types.ObjectId.isValid(dto.recordedBy)
      ? dto.recordedBy
      : '000000000000000000000001';
    const sensitive = this.isSensitive(dto.sensitivityCode, dto.sensitive);
    const resource = this.toFhirResource(dto.resourceType, resourceId, 1, dto.resource, safeOccurredAt, sensitive, dto.sensitivityCode);
    const model = this.resourceModel(dto.resourceType);

    const duplicateResource = await model.findOne({ hospitalId: new Types.ObjectId(hospitalId), resourceId }).lean().exec();
    if (duplicateResource) {
      await EhrEventModel.create({
        hospitalId: new Types.ObjectId(hospitalId),
        patientId: new Types.ObjectId(dto.patientId),
        resourceType: dto.resourceType,
        resourceId,
        version: 1,
        action: 'CREATE',
        occurredAt: safeOccurredAt,
        recordedBy: new Types.ObjectId(recordedBy),
        department: dto.department,
        encounterId: dto.encounterId && Types.ObjectId.isValid(dto.encounterId) ? new Types.ObjectId(dto.encounterId) : undefined,
        reason: dto.reason || 'Historical EHR backfill',
        sensitive,
        sensitivityCode: dto.sensitivityCode,
        changedFields: Object.keys(dto.resource),
        sourceKey: dto.sourceKey,
        sourceSystem: dto.sourceSystem || 'LEGACY_MIGRATION',
        sourceModel: dto.sourceModel,
        sourceRecordId: dto.sourceRecordId,
        resource,
      });
      if (dto.refreshView !== false) await this.refreshEhrView(hospitalId, dto.patientId);
      return { status: 'IMPORTED', resourceId };
    }

    await model.create({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(dto.patientId),
      encounterId: dto.encounterId && Types.ObjectId.isValid(dto.encounterId) ? new Types.ObjectId(dto.encounterId) : undefined,
      resourceId,
      version: 1,
      status: dto.status || resource.status,
      code: dto.code || resource.code?.coding?.[0],
      sensitive,
      sensitivityCode: dto.sensitivityCode,
      data: resource,
      recordedBy: new Types.ObjectId(recordedBy),
      department: dto.department,
    });

    await this.appendEvent({
      hospitalId,
      patientId: dto.patientId,
      resourceType: dto.resourceType,
      resourceId,
      action: 'CREATE',
      recordedBy,
      department: dto.department,
      encounterId: dto.encounterId && Types.ObjectId.isValid(dto.encounterId) ? dto.encounterId : undefined,
      reason: dto.reason || 'Historical EHR backfill',
      sensitive,
      sensitivityCode: dto.sensitivityCode,
      changedFields: Object.keys(dto.resource),
      sourceKey: dto.sourceKey,
      sourceSystem: dto.sourceSystem || 'LEGACY_MIGRATION',
      sourceModel: dto.sourceModel,
      sourceRecordId: dto.sourceRecordId,
      occurredAt: safeOccurredAt,
      resource,
    });

    if (dto.refreshView !== false) await this.refreshEhrView(hospitalId, dto.patientId);
    return { status: 'IMPORTED', resourceId };
  }

  static async updateEHRResource(
    hospitalId: string,
    actor: Actor,
    resourceType: Exclude<FhirResourceType, 'Patient'>,
    resourceId: string,
    dto: { resource: Record<string, unknown>; reason?: string; sensitive?: boolean; sensitivityCode?: string }
  ) {
    const model = this.resourceModel(resourceType);
    const current = await model.findOne({
      hospitalId: new Types.ObjectId(hospitalId),
      resourceId,
    }).sort({ version: -1 }).exec();

    if (!current) this.bad('EHR resource not found.', 404);

    const nextVersion = current.version + 1;
    const sensitive = this.isSensitive(dto.sensitivityCode || current.sensitivityCode, dto.sensitive ?? current.sensitive);
    const resource = this.toFhirResource(resourceType, resourceId, nextVersion, dto.resource, new Date(), sensitive, dto.sensitivityCode || current.sensitivityCode);

    await model.create({
      hospitalId: current.hospitalId,
      patientId: current.patientId,
      encounterId: current.encounterId,
      resourceId,
      version: nextVersion,
      status: resource.status,
      code: resource.code?.coding?.[0],
      sensitive,
      sensitivityCode: dto.sensitivityCode || current.sensitivityCode,
      data: resource,
      recordedBy: new Types.ObjectId(actor.userId),
      department: current.department,
    });

    await this.appendEvent({
      hospitalId,
      patientId: current.patientId.toString(),
      resourceType,
      resourceId,
      action: 'UPDATE',
      recordedBy: actor.userId,
      department: current.department,
      encounterId: current.encounterId?.toString(),
      reason: dto.reason,
      sensitive,
      sensitivityCode: dto.sensitivityCode || current.sensitivityCode,
      changedFields: Object.keys(dto.resource),
      resource,
    });
    await this.audit(hospitalId, current.patientId.toString(), actor, 'WRITE', Object.keys(dto.resource), true, dto.reason, resourceType, resourceId);

    await this.refreshEhrView(hospitalId, current.patientId.toString());
    return resource;
  }

  static async getEHRChart(
    hospitalId: string,
    patientId: string,
    actor: Actor,
    options?: { includeSensitive?: boolean }
  ): Promise<PatientEhrChart> {
    const patient = await this.assertPatient(hospitalId, patientId);
    const events = await EhrEventModel.find({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
    }).sort({ occurredAt: 1, version: 1 }).lean().exec();

    const latest = new Map<string, AnyRecord>();
    for (const event of events) {
      if (event.resourceType === 'Patient') continue;
      const key = `${event.resourceType}:${event.resourceId}`;
      if (event.action === 'DELETE') latest.delete(key);
      else latest.set(key, event.resource as AnyRecord);
    }

    const resources: Record<FhirResourceType, AnyRecord[]> = {
      Patient: [this.patientToFhir(patient)],
      Encounter: [],
      Observation: [],
      Condition: [],
      MedicationStatement: [],
      ServiceRequest: [],
      DocumentReference: [],
      Procedure: [],
      Claim: [],
    };

    const timeline: AnyRecord[] = [];

    for (const event of events) {
      if (event.resourceType === 'Patient') continue;
      const allowed = !event.sensitive || (options?.includeSensitive !== false &&
        await this.canViewSensitive(hospitalId, patientId, event.resourceType, event.sensitivityCode, actor));
      if (!allowed) continue;

      const resource = event.resource as AnyRecord;
      timeline.push({
        eventId: String(event._id),
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        version: event.version,
        action: event.action,
        occurredAt: event.occurredAt,
        recordedBy: String(event.recordedBy),
        department: event.department,
        resource,
      });
    }

    for (const [key, resource] of latest.entries()) {
      const [resourceType] = key.split(':') as [FhirResourceType, string];
      const event = events.find(
        (item) => item.resourceType === resourceType && item.resourceId === key.split(':')[1] && item.version === Number(resource.meta?.versionId)
      );
      if (resourceType && resources[resourceType]) {
        const allowed = !event?.sensitive || await this.canViewSensitive(hospitalId, patientId, resourceType, event?.sensitivityCode, actor);
        if (allowed) resources[resourceType].push(resource);
      }
    }

    await this.audit(
      hospitalId,
      patientId,
      actor,
      'READ',
      ['*'],
      true,
      options?.includeSensitive === false ? 'Clinical chart requested without sensitive segments.' : 'Clinical chart requested.',
    );

    return {
      patient,
      resources,
      timeline: timeline.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
      resourceCount: Object.values(resources).reduce((sum, list) => sum + list.length, 0) - 1,
    };
  }

  static async getResourceVersions(
    hospitalId: string,
    patientId: string,
    resourceType: FhirResourceType,
    resourceId: string,
    actor: Actor
  ) {
    await this.assertPatient(hospitalId, patientId);
    const events = await EhrEventModel.find({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
      resourceType,
      resourceId,
    }).sort({ version: 1 }).lean().exec();

    if (!events.length) this.bad('EHR resource history not found.', 404);
    const allowed = !events.some((e) => e.sensitive) ||
      await this.canViewSensitive(hospitalId, patientId, resourceType, events.find((e) => e.sensitive)?.sensitivityCode, actor);
    if (!allowed) {
      await this.audit(hospitalId, patientId, actor, 'READ', ['*'], false, 'Additional consent required.', resourceType, resourceId);
      this.bad('Additional consent is required to view this clinical segment.', 403);
    }
    await this.audit(hospitalId, patientId, actor, 'READ', ['*'], true, 'Resource version history requested.', resourceType, resourceId);
    return events;
  }

  static async createConsent(hospitalId: string, actor: Actor, dto: CreateConsentDTO) {
    await this.assertPatient(hospitalId, dto.patientId);
    const grantedToUsers = (dto.grantedToUsers || []).map((id) => {
      this.assertObjectId(id, 'granted user ID');
      return new Types.ObjectId(id);
    });

    const consent = await ConsentRecordModel.create({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(dto.patientId),
      status: dto.status,
      resourceTypes: dto.resourceTypes,
      sensitivityCode: dto.sensitivityCode,
      grantedToRoles: dto.grantedToRoles || [],
      grantedToUsers,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      purpose: dto.purpose,
      notes: dto.notes,
      createdBy: new Types.ObjectId(actor.userId),
    });
    await this.audit(hospitalId, dto.patientId, actor, 'CONSENT', ['consent'], true, 'Consent record created.');
    return consent;
  }

  static async revokeConsent(hospitalId: string, consentId: string, actor: Actor) {
    this.assertObjectId(consentId, 'consent ID');
    const consent = await ConsentRecordModel.findOne({
      _id: new Types.ObjectId(consentId),
      hospitalId: new Types.ObjectId(hospitalId),
    }).exec();
    if (!consent) this.bad('Consent record not found.', 404);
    consent.status = 'REVOKED';
    await consent.save();

    await this.appendEvent({
      hospitalId,
      patientId: consent.patientId.toString(),
      resourceType: 'Patient',
      resourceId: consent.patientId.toString(),
      action: 'AMEND',
      recordedBy: actor.userId,
      reason: `Consent ${consentId} revoked`,
      resource: this.patientToFhir(await this.assertPatient(hospitalId, consent.patientId.toString())),
    });

    await this.audit(hospitalId, consent.patientId.toString(), actor, 'CONSENT', ['status'], true, `Consent ${consentId} revoked.`);
    return consent;
  }

  static async findDuplicatePatients(
    hospitalId: string,
    input: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      phone?: string;
      email?: string;
      patientId?: string;
    }
  ): Promise<DuplicateCandidate[]> {
    this.assertObjectId(hospitalId, 'hospital ID');

    const clauses: AnyRecord[] = [];
    const firstName = this.normalizeName(input.firstName);
    const lastName = this.normalizeName(input.lastName);
    const phone = this.normalizePhone(input.phone);
    const email = String(input.email || '').trim().toLowerCase();
    const dob = input.dateOfBirth ? new Date(input.dateOfBirth) : undefined;

    if (phone) clauses.push({ phone });
    if (email) clauses.push({ email });
    if (firstName && lastName && dob && !Number.isNaN(dob.getTime())) {
      clauses.push({
        firstName: new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        lastName: new RegExp(`^${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        dateOfBirth: dob,
      });
    }

    if (!clauses.length) return [];

    const filter: AnyRecord = {
      hospitalId: new Types.ObjectId(hospitalId),
      active: true,
      $or: clauses,
    };
    if (input.patientId && Types.ObjectId.isValid(input.patientId)) {
      filter._id = { $ne: new Types.ObjectId(input.patientId) };
    }

    const patients = await PatientModel.find(filter).limit(20).exec();

    return patients.map((patient) => {
      let score = 0;
      const reasons: string[] = [];
      if (phone && this.normalizePhone(patient.phone) === phone) { score += 50; reasons.push('phone'); }
      if (email && String(patient.email || '').toLowerCase() === email) { score += 40; reasons.push('email'); }
      if (firstName && this.normalizeName(patient.firstName) === firstName) { score += 15; reasons.push('firstName'); }
      if (lastName && this.normalizeName(patient.lastName) === lastName) { score += 15; reasons.push('lastName'); }
      if (dob && patient.dateOfBirth.getTime() === dob.getTime()) { score += 25; reasons.push('dateOfBirth'); }
      return { patient, score: Math.min(100, score), reasons };
    }).sort((a, b) => b.score - a.score);
  }

  static async mergePatients(
    hospitalId: string,
    actor: Actor,
    sourcePatientId: string,
    targetPatientId: string,
    reason: string
  ) {
    this.assertObjectId(sourcePatientId, 'source patient ID');
    this.assertObjectId(targetPatientId, 'target patient ID');
    if (sourcePatientId === targetPatientId) this.bad('A patient cannot be merged into itself.');

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const source = await PatientModel.findOne({
        _id: new Types.ObjectId(sourcePatientId),
        hospitalId: new Types.ObjectId(hospitalId),
        active: true,
      }).session(session).exec();
      const target = await PatientModel.findOne({
        _id: new Types.ObjectId(targetPatientId),
        hospitalId: new Types.ObjectId(hospitalId),
        active: true,
      }).session(session).exec();

      if (!source || !target) this.bad('Both source and target patient records must exist and be active.', 404);

      // Move patient references in all currently registered collections that expose patientId.
      for (const [name, model] of Object.entries(mongoose.models)) {
        if (['Patient', 'EhrEvent', 'ConsentRecord', 'PatientEhrView'].includes(name)) continue;
        if (!model.schema.path('patientId')) continue;
        await model.updateMany(
          {
            hospitalId: new Types.ObjectId(hospitalId),
            patientId: new Types.ObjectId(sourcePatientId),
          },
          { $set: { patientId: new Types.ObjectId(targetPatientId) } },
          { session }
        );
      }

      await EhrEventModel.updateMany(
        {
          hospitalId: new Types.ObjectId(hospitalId),
          patientId: new Types.ObjectId(sourcePatientId),
        },
        { $set: { patientId: new Types.ObjectId(targetPatientId) } },
        { session }
      );

      source.active = false;
      source.mergedInto = target._id;
      await source.save({ session });

      await this.appendEvent({
        hospitalId,
        patientId: targetPatientId,
        resourceType: 'Patient',
        resourceId: targetPatientId,
        action: 'MERGE',
        recordedBy: actor.userId,
        reason,
        resource: {
          ...this.patientToFhir(target),
          extension: [{ url: 'urn:medxverse:merged-patient', valueReference: { reference: `Patient/${sourcePatientId}` } }],
        },
      }, session);

      await session.commitTransaction();
      await this.refreshEhrView(hospitalId, targetPatientId);
      return { sourcePatientId, targetPatientId, status: 'MERGED' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Builds the cross-module patient registry used by the patient workspace.
   *
   * The patient record is the canonical identity; clinical modules remain the
   * source of truth for their own data. This method only reads those records
   * and presents them as one patient-centric view.
   */
  static async getPatientRegistry(
    hospitalId: string,
    patientId: string,
    actor: Actor
  ): Promise<PatientRegistry> {
    const patient = await this.assertPatient(hospitalId, patientId);
    const patientObjectId = new Types.ObjectId(patientId);
    const hospitalObjectId = new Types.ObjectId(hospitalId);
    const registryNameCache = new Map<string, string>();
    const ehr = await this.getEHRChart(hospitalId, patientId, actor);
    const sanitizedEhr = await sanitizeRegistryStaff(ehr, hospitalObjectId, registryNameCache) as PatientEhrChart;
    const sections: PatientRegistrySection[] = [];
    const allItems: IClinicalSummaryItem[] = [];

    const toDate = (row: AnyRecord): Date | string | undefined => {
      for (const field of REGISTRY_DATE_FIELDS) {
        if (row[field]) return row[field];
      }
      return undefined;
    };

    const firstValue = (row: AnyRecord, keys: string[]): unknown => {
      for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    };

    const buildTitle = (label: string, modelName: string, row: AnyRecord): string => {
      const title = firstValue(row, [
        'procedureName', 'testName', 'serviceName', 'medicationName', 'drugName',
        'chiefComplaint', 'admissionReason', 'primaryDiagnosis', 'diagnosis',
        'reasonForVisit', 'visitReason', 'title', 'subject', 'description', 'name',
        'visitNumber', 'appointmentNumber', 'prescriptionNumber', 'orderNumber',
        'caseNumber', 'sessionId', 'billingId', 'invoiceNumber', 'claimNumber', 'code',
      ]);
      if (title) return String(title);
      if (row.procedure?.name) return String(row.procedure.name);
      if (Array.isArray(row.medications) && row.medications.length) {
        const names = row.medications
          .map((item: AnyRecord) => item.medicationName || item.drugName || item.name)
          .filter(Boolean);
        if (names.length) return names.join(', ');
      }
      return registryHumanize(modelName) || label;
    };

    const buildSummary = (row: AnyRecord): string | undefined => {
      const summary = firstValue(row, [
        'impression', 'findings', 'resultSummary', 'result', 'clinicalNotes',
        'consultationNotes', 'nursingNotes', 'dischargeSummary', 'notes', 'reason',
        'assessment', 'treatmentPlan', 'instructions', 'chiefComplaint', 'postOpNotes',
        'preOpNotes', 'operativeDiagnosis', 'postOperativeDiagnosis', 'surgicalFindings',
        'techniqueNotes', 'surgeonNotes', 'complications', 'indication',
      ]);
      if (summary !== undefined) return typeof summary === 'string' ? summary : JSON.stringify(summary);
      if (Array.isArray(row.medications)) {
        const lines = row.medications.map((item: AnyRecord) => {
          const name = item.medicationName || item.drugName || item.name;
          if (!name) return undefined;
          return [name, item.dosage || item.dose, item.route, item.frequency, item.duration]
            .filter(Boolean).join(' • ');
        }).filter(Boolean);
        if (lines.length) return lines.join(' | ');
      }
      return undefined;
    };

    const knownModelNames = new Set(PATIENT_REGISTRY_SOURCES.flatMap((source) => source.modelNames));
    const descriptors: Array<{ key: string; label: string; modelName: string }> = [];

    for (const source of PATIENT_REGISTRY_SOURCES) {
      for (const modelName of source.modelNames) {
        descriptors.push({ key: source.key, label: source.label, modelName });
      }
    }

    // Discover every additional patient-aware model already registered by the
    // application. This catches billing variants, HMO records, reporting
    // records, future modules and any model omitted from the static catalogue.
    for (const [modelName, model] of Object.entries(mongoose.models)) {
      if (REGISTRY_EXCLUDED_MODELS.has(modelName)) continue;
      if (!model?.schema?.path('patientId')) continue;
      if (knownModelNames.has(modelName)) continue;
      descriptors.push({ key: `module:${modelName}`, label: registryHumanize(modelName), modelName });
    }

    const results = await Promise.all(descriptors.map(async (descriptor) => {
      const model = mongoose.models[descriptor.modelName];
      if (!model?.schema?.path('patientId')) return { descriptor, items: [] as IClinicalSummaryItem[] };

      try {
        const filter: AnyRecord = { patientId: patientObjectId };
        if (model.schema.path('hospitalId')) filter.hospitalId = hospitalObjectId;

        const rows: AnyRecord[] = await registryPopulate(
          model,
          model.find(filter).sort({ createdAt: -1, updatedAt: -1 }).limit(100)
        );

        const items: IClinicalSummaryItem[] = await Promise.all(rows.map(async (row) => ({
          id: row._id ? String(row._id) : undefined,
          resourceType: descriptor.key,
          sourceModel: descriptor.modelName,
          moduleKey: descriptor.key,
          date: toDate(row),
          title: buildTitle(descriptor.label, descriptor.modelName, row),
          status: row.status || row.resultStatus || row.queueStatus || row.orderStatus || row.paymentStatus || row.claimStatus,
          summary: buildSummary(row),
          // Keep staff/provider references readable without exposing the
          // populated provider document in the patient registry response.
          details: await sanitizeRegistryDetails(row, descriptor.modelName, hospitalObjectId, registryNameCache),
        })));

        return { descriptor, items };
      } catch {
        return { descriptor, items: [] as IClinicalSummaryItem[] };
      }
    }));

    const grouped = new Map<string, PatientRegistrySection>();
    for (const { descriptor, items } of results) {
      if (!grouped.has(descriptor.key)) {
        grouped.set(descriptor.key, { key: descriptor.key, label: descriptor.label, count: 0, items: [] });
      }
      const section = grouped.get(descriptor.key)!;
      section.items.push(...items);
      section.count = section.items.length;
    }

    for (const section of grouped.values()) {
      section.items.sort((a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime());
      sections.push(section);
      allItems.push(...section.items);
    }

    const ehrItems: IClinicalSummaryItem[] = sanitizedEhr.timeline.map((event) => ({
      id: String(event.resourceId || event.eventId || ''),
      resourceType: String(event.resourceType || 'EHR'),
      date: event.occurredAt as Date | string | undefined,
      title: String(
        (event.resource as AnyRecord)?.code?.coding?.[0]?.display ||
        (event.resource as AnyRecord)?.description || event.resourceType || 'Clinical event'
      ),
      status: (event.resource as AnyRecord)?.status as string | undefined,
      summary: (event.resource as AnyRecord)?.note?.[0]?.text as string | undefined,
      details: event.resource as Record<string, unknown>,
    }));

    const timeline = [...allItems, ...ehrItems].sort(
      (a, b) => new Date(String(b.date || 0)).getTime() - new Date(String(a.date || 0)).getTime()
    );

    const findSection = (key: string) => sections.find((section) => section.key === key)?.items || [];
    const activeAdmissions = findSection('admissions').filter((item) =>
      ['ADMITTED', 'ACTIVE', 'IN_PROGRESS'].includes(String(item.status || '').toUpperCase())
    );
    const activeIcuAdmissions = findSection('icu').filter((item) =>
      String(item.title).toLowerCase().includes('icu') ||
      ['ADMITTED', 'ACTIVE', 'IN_PROGRESS'].includes(String(item.status || '').toUpperCase())
    );
    const recentDiagnoses = [
      ...sanitizedEhr.resources.Condition.map((resource) => this.resourceSummary('Condition', resource)),
      ...findSection('outpatient'), ...findSection('consultations'),
    ].filter((item) => /diagnos|condition|assessment/i.test(`${item.title} ${item.summary || ''}`)).slice(0, 50);
    const recentProcedures = [
      ...sanitizedEhr.resources.Procedure.map((resource) => this.resourceSummary('Procedure', resource)),
      ...findSection('surgery'), ...findSection('ot'), ...findSection('dental'),
    ].slice(0, 50);
    const recentLaboratory = [
      ...sanitizedEhr.resources.ServiceRequest.map((resource) => this.resourceSummary('ServiceRequest', resource)),
      ...sanitizedEhr.resources.Observation.map((resource) => this.resourceSummary('Observation', resource)),
      ...findSection('laboratory'),
    ].slice(0, 50);
    const recentRadiology = findSection('radiology').slice(0, 50);
    const upcomingAppointments = findSection('appointments').filter((item) => {
      const date = item.date ? new Date(String(item.date)).getTime() : 0;
      return date >= Date.now();
    }).slice(0, 50);
    const medicationItems = [
      ...sanitizedEhr.resources.MedicationStatement.map((resource) => this.resourceSummary('MedicationStatement', resource)),
      ...findSection('pharmacy'),
    ].filter((item) => {
      const status = String(item.status || '').toUpperCase();
      return !status || !['CANCELLED', 'DISCONTINUED', 'COMPLETED', 'STOPPED', 'REVOKED'].includes(status);
    }).slice(0, 100);

    const latestVitals = [...(patient.vitalsHistory || [])]
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0];

    const overview: PatientRegistryOverview = {
      totalClinicalRecords: timeline.length,
      activeMedications: medicationItems,
      activeAdmissions,
      activeIcuAdmissions,
      recentDiagnoses,
      recentProcedures,
      recentLaboratory,
      recentRadiology,
      upcomingAppointments,
      latestVitals: latestVitals ? {
        ...latestVitals,
        recordedBy: String(latestVitals.recordedBy),
        encounterId: latestVitals.encounterId ? String(latestVitals.encounterId) : undefined,
      } : undefined,
    };

    await this.audit(
      hospitalId,
      patientId,
      actor,
      'READ',
      ['PATIENT_REGISTRY'],
      true,
      'Comprehensive cross-module patient registry requested.'
    );

    return { patient, overview, sections, ehr: sanitizedEhr, timeline };
  }

  static async getClinicalSummary(
    hospitalId: string,
    patientId: string,
    actor: Actor
  ): Promise<PatientClinicalSummary> {
    const chart = await this.getEHRChart(hospitalId, patientId, actor);
    const legacy = await this.getLegacyClinicalSummary(hospitalId, patientId, actor);

    return {
      encounters: chart.resources.Encounter.map((r) => this.resourceSummary('Encounter', r)),
      observations: chart.resources.Observation.map((r) => this.resourceSummary('Observation', r)),
      conditions: chart.resources.Condition.map((r) => this.resourceSummary('Condition', r)),
      medications: chart.resources.MedicationStatement.map((r) => this.resourceSummary('MedicationStatement', r)),
      documents: chart.resources.DocumentReference.map((r) => this.resourceSummary('DocumentReference', r)),
      procedures: chart.resources.Procedure.map((r) => this.resourceSummary('Procedure', r)),
      claims: chart.resources.Claim.map((r) => this.resourceSummary('Claim', r)),
      legacy,
    };
  }

  private static patientToFhir(patient: IPatientDocument): AnyRecord {
    return {
      resourceType: 'Patient',
      id: patient._id.toString(),
      identifier: [
        { system: 'urn:medxverse:mpi', value: patient.universalPatientId },
        { system: 'urn:medxverse:mrn', value: patient.mrn },
      ],
      active: patient.active,
      name: [{ family: patient.lastName, given: [patient.firstName] }],
      birthDate: patient.dateOfBirth.toISOString().slice(0, 10),
      gender: patient.gender.toLowerCase(),
      telecom: [
        { system: 'phone', value: patient.phone },
        ...(patient.email ? [{ system: 'email', value: patient.email }] : []),
      ],
      address: patient.address ? [{ text: patient.address }] : [],
      extension: [
        ...(patient.bloodGroup ? [{ url: 'urn:medxverse:blood-group', valueString: patient.bloodGroup }] : []),
        ...(patient.genotype ? [{ url: 'urn:medxverse:genotype', valueString: patient.genotype }] : []),
        ...(patient.mergedInto ? [{ url: 'urn:medxverse:merged-into', valueReference: { reference: `Patient/${patient.mergedInto}` } }] : []),
      ],
      meta: { versionId: 'latest', lastUpdated: patient.updatedAt },
    };
  }

  private static resourceSummary(resourceType: string, resource: AnyRecord): IClinicalSummaryItem {
    const title =
      resource.code?.coding?.[0]?.display ||
      resource.type?.[0]?.text ||
      resource.medicationCodeableConcept?.text ||
      resource.description ||
      resource.content?.[0]?.attachment?.title ||
      resourceType;

    const date =
      resource.effectiveDateTime ||
      resource.period?.start ||
      resource.authoredOn ||
      resource.date ||
      resource.meta?.lastUpdated;

    return {
      id: resource.id,
      resourceType,
      date,
      title: String(title),
      status: resource.status,
      summary: resource.note?.[0]?.text || resource.text?.div || resource.description,
      details: resource,
    };
  }

  static async rebuildEHRView(hospitalId: string, patientId: string): Promise<void> {
    await this.refreshEhrView(hospitalId, patientId);
  }

  private static async refreshEhrView(hospitalId: string, patientId: string) {
    const events = await EhrEventModel.find({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
    }).sort({ occurredAt: 1, version: 1 }).lean().exec();

    const latest = new Map<string, AnyRecord>();
    const timeline: AnyRecord[] = [];

    for (const event of events) {
      const key = `${event.resourceType}:${event.resourceId}`;
      if (event.action === 'DELETE') latest.delete(key);
      else if (event.resourceType !== 'Patient') latest.set(key, event.resource as AnyRecord);

      if (event.resourceType !== 'Patient') {
        timeline.push({
          eventId: String(event._id),
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          version: event.version,
          action: event.action,
          occurredAt: event.occurredAt,
          department: event.department,
          sensitive: event.sensitive,
          sensitivityCode: event.sensitivityCode,
          resource: event.resource,
        });
      }
    }

    const patient = await PatientModel.findById(patientId).lean().exec();
    if (!patient) return;

    const resources: AnyRecord = {
      Patient: [this.patientToFhir(patient as unknown as IPatientDocument)],
      Encounter: [],
      Observation: [],
      Condition: [],
      MedicationStatement: [],
      ServiceRequest: [],
      DocumentReference: [],
      Procedure: [],
      Claim: [],
    };

    for (const resource of latest.values()) {
      if (resources[resource.resourceType]) resources[resource.resourceType].push(resource);
    }

    await PatientEhrViewModel.findOneAndUpdate(
      { 'patient._id': new Types.ObjectId(patientId) },
      {
        $set: {
          patient,
          resources,
          timeline,
          resourceCount: latest.size,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
  }

  private static async assertEncounterBelongsToPatient(
    hospitalId: string,
    encounterId: string,
    patientId: string
  ) {
    this.assertObjectId(encounterId, 'encounter ID');
    const encounter = await EncounterModel.findOne({
      hospitalId: new Types.ObjectId(hospitalId),
      patientId: new Types.ObjectId(patientId),
      resourceId: encounterId,
    }).exec();
    if (!encounter) this.bad('Encounter does not belong to this patient.', 400);
  }

  private static async getLegacyClinicalSummary(
    hospitalId: string,
    patientId: string,
    actor: Actor
  ) {
    const [surgery, radiology, laboratory, pharmacy, outpatient, billing] = await Promise.all([
      this.getDepartmentSummary('surgery', hospitalId, patientId, actor),
      this.getDepartmentSummary('radiology', hospitalId, patientId, actor),
      this.getDepartmentSummary('laboratory', hospitalId, patientId, actor),
      this.getDepartmentSummary('pharmacy', hospitalId, patientId, actor),
      this.getDepartmentSummary('outpatient', hospitalId, patientId, actor),
      this.getBillingSummary(hospitalId, patientId),
    ]);

    return { surgery, radiology, laboratory, pharmacy, outpatient, billing };
  }

  private static async getDepartmentSummary(
    department: 'surgery' | 'radiology' | 'laboratory' | 'pharmacy' | 'outpatient',
    hospitalId: string,
    patientId: string,
    actor: Actor
  ): Promise<IClinicalSummaryItem[]> {
    const modelNames: Record<string, string[]> = {
      surgery: ['Surgery', 'SurgeryRecord', 'SurgicalProcedure'],
      radiology: ['RadiologyOrder', 'Radiology'],
      laboratory: ['LabOrder', 'LabTest', 'LaboratoryTest', 'Laboratory'],
      pharmacy: ['DispenseRecord', 'PharmacyDispense', 'PharmacyPrescription', 'Prescription', 'Dispense'],
      outpatient: ['Outpatient', 'OutpatientEncounter', 'Consultation'],
    };

    const model = modelNames[department].map((name) => mongoose.models[name]).find(Boolean);
    if (!model) return [];

    try {
      const rows: AnyRecord[] = await model.find({
        hospitalId: new Types.ObjectId(hospitalId),
        patientId: new Types.ObjectId(patientId),
      }).sort({ createdAt: -1 }).limit(50).lean().exec();

      return rows.map((row) => ({
        id: row._id ? String(row._id) : undefined,
        resourceType: department,
        date: row.createdAt || row.updatedAt || row.reportedAt || row.completedAt || row.date,
        title: String(
          row.testName || row.procedureName || row.medicationName || row.drugName ||
          row.reasonForVisit || row.visitReason || row.serviceName || department
        ),
        status: row.status || row.resultStatus,
        summary: row.impression || row.findings || row.resultSummary || row.result ||
          row.consultationNotes || row.clinicalNotes || row.notes || row.assessment || row.plan,
        details: row,
      }));
    } catch {
      return [];
    }
  }

  private static async getBillingSummary(hospitalId: string, patientId: string) {
    const model = ['BillingCharge', 'Charge', 'Billing'].map((name) => mongoose.models[name]).find(Boolean);
    if (!model) return { totalCharges: 0, totalPaid: 0, balance: 0, items: [] as IClinicalSummaryItem[] };

    try {
      const rows: AnyRecord[] = await model.find({
        hospitalId: new Types.ObjectId(hospitalId),
        patientId: new Types.ObjectId(patientId),
      }).sort({ createdAt: -1 }).limit(100).lean().exec();

      const amount = (row: AnyRecord) => Number(row.totalAmount ?? row.amount ?? row.chargeAmount ?? row.price ?? row.total ?? 0) || 0;
      const paid = (row: AnyRecord) => Number(row.amountPaid ?? row.paidAmount ?? row.paid ?? row.paymentAmount ?? 0) || 0;
      const totalCharges = rows.reduce((sum, row) => sum + amount(row), 0);
      const totalPaid = rows.reduce((sum, row) => sum + paid(row), 0);

      return {
        totalCharges,
        totalPaid,
        balance: Math.max(0, totalCharges - totalPaid),
        items: rows.map((row) => ({
          id: row._id ? String(row._id) : undefined,
          resourceType: 'billing',
          date: row.chargeDate || row.createdAt,
          title: String(row.description || row.serviceName || row.serviceCode || 'Patient charge'),
          status: row.status,
          summary: `Charged: ${amount(row)}; Paid: ${paid(row)}; Balance: ${Math.max(0, amount(row) - paid(row))}`,
          details: row,
        })),
      };
    } catch {
      return { totalCharges: 0, totalPaid: 0, balance: 0, items: [] as IClinicalSummaryItem[] };
    }
  }
}

import mongoose, { Schema } from 'mongoose';

import {
  IStaffDocument,
  StaffRole,
  StaffCategory,
  StaffClassification,
  EmploymentType,
  StaffStatus,
  CredentialStatus,
  PrivilegeStatus,
  TrainingStatus,
  LeaveStatus,
  AttendanceStatus,
  AvailabilityStatus,
} from './staff.types.js';

const ProfessionalRegistrationSchema = new Schema(
  {
    regulatoryBody: {
      type: String,
      required: true,
      trim: true,
    },

    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },

    registrationType: {
      type: String,
      trim: true,
    },

    issueDate: Date,

    expiryDate: {
      type: Date,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(CredentialStatus),
      default: CredentialStatus.PENDING,
    },

    verificationDate: Date,

    verifiedBy: {
      type: Schema.Types.ObjectId,
    },

    documentUrl: String,

    notes: String,
  },
  { _id: true }
);

const QualificationSchema = new Schema(
  {
    qualification: {
      type: String,
      required: true,
      trim: true,
    },

    institution: {
      type: String,
      required: true,
      trim: true,
    },

    fieldOfStudy: String,

    startDate: Date,

    completionDate: Date,

    certificateNumber: String,

    documentUrl: String,

    verified: {
      type: Boolean,
      default: false,
    },

    verifiedAt: Date,

    verifiedBy: {
      type: Schema.Types.ObjectId,
    },
  },
  { _id: true }
);

const CertificationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    issuingOrganization: {
      type: String,
      required: true,
      trim: true,
    },

    certificateNumber: String,

    issueDate: Date,

    expiryDate: {
      type: Date,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(CredentialStatus),
      default: CredentialStatus.PENDING,
    },

    documentUrl: String,
  },
  { _id: true }
);

const SpecialtySchema = new Schema(
  {
    specialty: {
      type: String,
      required: true,
      trim: true,
    },

    subSpecialty: {
      type: String,
      trim: true,
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },

    yearsOfExperience: Number,
  },
  { _id: true }
);

const ExperienceSchema = new Schema(
  {
    organization: {
      type: String,
      required: true,
      trim: true,
    },

    position: {
      type: String,
      required: true,
      trim: true,
    },

    department: String,

    startDate: {
      type: Date,
      required: true,
    },

    endDate: Date,

    responsibilities: String,

    reasonForLeaving: String,
  },
  { _id: true }
);

const ClinicalPrivilegeSchema = new Schema(
  {
    privilege: {
      type: String,
      required: true,
      trim: true,
    },

    department: String,

    grantedDate: Date,

    expiryDate: {
      type: Date,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(PrivilegeStatus),
      default: PrivilegeStatus.PENDING_RENEWAL,
    },

    grantedBy: {
      type: Schema.Types.ObjectId,
    },

    notes: String,
  },
  { _id: true }
);

const TrainingRecordSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    provider: String,

    category: String,

    completionDate: Date,

    expiryDate: Date,

    status: {
      type: String,
      enum: Object.values(TrainingStatus),
      default: TrainingStatus.PENDING,
    },

    certificateUrl: String,

    mandatory: {
      type: Boolean,
      default: false,
    },

    cpdPoints: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const PerformanceRecordSchema = new Schema(
  {
    reviewDate: {
      type: Date,
      required: true,
    },

    reviewerId: {
      type: Schema.Types.ObjectId,
    },

    score: Number,

    rating: String,

    comments: String,

    goals: [String],
  },
  { _id: true }
);

const AvailabilitySchema = new Schema(
  {
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true,
    },

    startTime: String,

    endTime: String,

    status: {
      type: String,
      enum: Object.values(AvailabilityStatus),
      default: AvailabilityStatus.AVAILABLE,
    },
  },
  { _id: true }
);

const OnCallSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    startTime: String,

    endTime: String,

    departmentId: {
      type: Schema.Types.ObjectId,
    },

    unitId: {
      type: Schema.Types.ObjectId,
    },

    notes: String,
  },
  { _id: true }
);

const LeaveSchema = new Schema(
  {
    leaveType: {
      type: String,
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    reason: String,

    status: {
      type: String,
      enum: Object.values(LeaveStatus),
      default: LeaveStatus.PENDING,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
    },

    approvedAt: Date,
  },
  { _id: true }
);

const AttendanceSchema = new Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    clockIn: Date,

    clockOut: Date,

    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      default: AttendanceStatus.PRESENT,
    },

    overtimeHours: {
      type: Number,
      default: 0,
    },

    notes: String,
  },
  { _id: true }
);

const IncidentSchema = new Schema(
  {
    incidentType: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    severity: String,

    status: String,

    reportedBy: {
      type: Schema.Types.ObjectId,
    },

    resolution: String,
  },
  { _id: true }
);

const CommunicationSchema = new Schema(
  {
    subject: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    sentAt: {
      type: Date,
      default: Date.now,
    },

    sentBy: {
      type: Schema.Types.ObjectId,
    },

    readAt: Date,
  },
  { _id: true }
);

const StaffSchema = new Schema<IStaffDocument>(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Hospital ID is required'],
      index: true,
    },

    userAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'StaffUser',
      unique: true,
      sparse: true,
      index: true,
    },

    staffId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },

    middleName: {
      type: String,
      trim: true,
    },

    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },

    title: {
      type: String,
      trim: true,
    },

    profilePhotoUrl: String,

    dateOfBirth: Date,

    gender: String,

    role: {
      type: String,
      enum: Object.values(StaffRole),
      required: [true, 'Staff role is required'],
      index: true,
    },

    category: {
      type: String,
      enum: Object.values(StaffCategory),
      default: StaffCategory.CLINICAL,
      index: true,
    },

    classification: {
      type: String,
      enum: Object.values(StaffClassification),
      default: StaffClassification.GENERAL,
      index: true,
    },

    professionalTitle: String,

    // Fee charged in NGN for patient-initiated virtual consultations.
    consultationFee: { type: Number, min: 0 },

    jobTitle: String,

    specialties: {
      type: [SpecialtySchema],
      default: [],
    },

    contact: {
      phone: String,
      alternatePhone: String,
      email: {
        type: String,
        lowercase: true,
        trim: true,
      },
      address: String,
      city: String,
      state: String,
      country: String,
    },

    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      alternatePhone: String,
      email: String,
      address: String,
    },

    professionalRegistrations: {
      type: [ProfessionalRegistrationSchema],
      default: [],
    },

    qualifications: {
      type: [QualificationSchema],
      default: [],
    },

    certifications: {
      type: [CertificationSchema],
      default: [],
    },

    professionalExperience: {
      type: [ExperienceSchema],
      default: [],
    },

    clinicalPrivileges: {
      type: [ClinicalPrivilegeSchema],
      default: [],
    },

    employment: {
      employeeNumber: String,

      employmentType: {
        type: String,
        enum: Object.values(EmploymentType),
        required: true,
      },

      classification: {
        type: String,
        enum: Object.values(StaffClassification),
        required: true,
      },

      jobTitle: String,

      departmentId: {
        type: Schema.Types.ObjectId,
      },

      unitId: {
        type: Schema.Types.ObjectId,
      },

      startDate: Date,

      endDate: Date,

      contractStartDate: Date,

      contractEndDate: Date,

      salary: Number,

      currency: String,

      supervisorId: {
        type: Schema.Types.ObjectId,
      },

      contractDocumentUrl: String,
    },

    trainingRecords: {
      type: [TrainingRecordSchema],
      default: [],
    },

    performanceRecords: {
      type: [PerformanceRecordSchema],
      default: [],
    },

    availability: {
      type: [AvailabilitySchema],
      default: [],
    },

    onCallAssignments: {
      type: [OnCallSchema],
      default: [],
    },

    leaveRecords: {
      type: [LeaveSchema],
      default: [],
    },

    attendanceRecords: {
      type: [AttendanceSchema],
      default: [],
    },

    incidents: {
      type: [IncidentSchema],
      default: [],
    },

    communications: {
      type: [CommunicationSchema],
      default: [],
    },

    clinicalActivityCount: {
      type: Number,
      default: 0,
    },

    activePatientCaseload: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: Object.values(StaffStatus),
      default: StaffStatus.ACTIVE,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Universal staff ID must be unique within a hospital.
 */
StaffSchema.index(
  { hospitalId: 1, staffId: 1 },
  { unique: true }
);

/**
 * Useful hospital staff queries.
 */
StaffSchema.index({
  hospitalId: 1,
  role: 1,
  status: 1,
});

StaffSchema.index({
  hospitalId: 1,
  'employment.departmentId': 1,
});

StaffSchema.index({
  hospitalId: 1,
  'employment.unitId': 1,
});

StaffSchema.index({
  hospitalId: 1,
  'contact.email': 1,
}, { sparse: true });

export const Staff =
  (mongoose.models.Staff as mongoose.Model<IStaffDocument> | undefined) ||
  mongoose.model<IStaffDocument>('Staff', StaffSchema);
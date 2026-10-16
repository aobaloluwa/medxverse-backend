import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Account } from '../auth/auth.model.js';
import { PatientModel } from '../patient/patient.model.js';
import { PatientPortalAccountModel } from './patient-portal.model.js';
function validPassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}
function tokenFor(account, patient) {
    const secret = process.env.JWT_SECRET || 'fallback_secret_key';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '7d');
    return jwt.sign({
        accountId: account._id.toString(),
        _id: patient._id.toString(),
        id: patient._id.toString(),
        patientId: patient._id.toString(),
        hospitalId: patient.hospitalId.toString(),
        accountType: 'HOSPITAL',
        userType: 'PATIENT',
        name: `${patient.firstName} ${patient.lastName}`.trim(),
        email: patient.email,
    }, secret, { expiresIn });
}
export class PatientPortalService {
    /**
     * Public, read-only directory for patient portal screens.
     * Only exposes fields safe to show before authentication.
     */
    static async listHospitals() {
        const hospitalResults = await Account.find({
            accountType: 'HOSPITAL',
            isActive: true,
        })
            .select('_id name code logoUrl address')
            .sort({ name: 1 })
            .lean()
            .exec();
        const hospitals = (Array.isArray(hospitalResults) ? hospitalResults : [hospitalResults]);
        return hospitals.map((hospital) => ({
            id: hospital._id.toString(),
            name: hospital.name || 'Hospital',
            // Code is returned only to support legacy portal screens. Login does not require it.
            code: hospital.code || '',
            logoUrl: hospital.logoUrl || '',
            address: hospital.address || '',
        }));
    }
    static async register(input) {
        const hospitalCode = String(input.hospitalCode || '').trim().toUpperCase();
        const mrn = String(input.mrn || '').trim();
        const email = String(input.email || '').trim().toLowerCase();
        const phone = String(input.phone || '').trim();
        const dob = new Date(input.dateOfBirth);
        const password = String(input.password || '');
        if (!hospitalCode || !mrn || !email || !phone || !input.dateOfBirth) {
            throw new Error('Hospital code, medical record number, date of birth, email and phone are required.');
        }
        if (Number.isNaN(dob.getTime()))
            throw new Error('Enter a valid date of birth.');
        if (!validPassword(password)) {
            throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number and special character.');
        }
        if (input.confirmPassword !== undefined && input.confirmPassword !== password) {
            throw new Error('Passwords do not match.');
        }
        const hospitalResult = await Account.findOne({
            code: hospitalCode,
            accountType: 'HOSPITAL',
            isActive: true,
        })
            .select('_id code')
            .lean()
            .exec();
        // Some project model typings incorrectly infer lean findOne() as a document-or-array union.
        // Normalize the result before accessing document fields.
        const hospital = (Array.isArray(hospitalResult) ? hospitalResult[0] : hospitalResult);
        if (!hospital)
            throw new Error('Hospital code was not found or the hospital is inactive.');
        const dayStart = new Date(dob);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const patientResult = await PatientModel.findOne({
            hospitalId: hospital._id,
            mrn,
            email,
            phone,
            dateOfBirth: { $gte: dayStart, $lt: dayEnd },
            active: true,
        })
            .select('_id firstName lastName email hospitalId mrn')
            .lean()
            .exec();
        const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
        if (!patient) {
            throw new Error('We could not match those details to an active patient record. Check them with your hospital before trying again.');
        }
        const existing = await PatientPortalAccountModel.findOne({
            hospitalId: hospital._id,
            $or: [{ patientId: patient._id }, { email }],
        })
            .select('_id')
            .lean()
            .exec();
        if (existing)
            throw new Error('A patient portal account already exists for this record or email. Please sign in.');
        const passwordHash = await bcrypt.hash(password, 12);
        const portalAccount = await PatientPortalAccountModel.create({
            hospitalId: hospital._id,
            patientId: patient._id,
            email,
            password: passwordHash,
            active: true,
        });
        const patientWithHospital = {
            ...patient,
            hospitalId: hospital._id,
        };
        return {
            token: tokenFor(portalAccount, patientWithHospital),
            patient: {
                id: patient._id.toString(),
                hospitalId: hospital._id.toString(),
                name: `${patient.firstName} ${patient.lastName}`.trim(),
                email,
                mrn: patient.mrn,
            },
        };
    }
    static async login(input) {
        const hospitalCode = String(input.hospitalCode || '').trim().toUpperCase();
        const requestedHospitalId = String(input.hospitalId || '').trim();
        const email = String(input.email || '').trim().toLowerCase();
        const patientIdInput = String(input.patientId || input.mrn || '').trim();
        const password = String(input.password || '');
        // Hospital code is optional. The patient portal can resolve the hospital
        // from the authenticated portal account, or use hospitalId when the app
        // already knows the selected hospital from its dashboard context.
        if ((!email && !patientIdInput) || !password) {
            throw new Error('Enter your Patient ID or email address and password.');
        }
        let hospitalId;
        if (hospitalCode) {
            const hospitalResult = await Account.findOne({
                code: hospitalCode,
                accountType: 'HOSPITAL',
                isActive: true,
            })
                .select('_id')
                .lean()
                .exec();
            const hospital = (Array.isArray(hospitalResult) ? hospitalResult[0] : hospitalResult);
            if (!hospital)
                throw new Error('Invalid email, password or hospital code.');
            hospitalId = hospital._id;
        }
        else if (requestedHospitalId) {
            if (!Types.ObjectId.isValid(requestedHospitalId)) {
                throw new Error('The selected hospital is invalid. Please reopen the patient portal from your hospital dashboard.');
            }
            hospitalId = new Types.ObjectId(requestedHospitalId);
        }
        let portalAccountQuery = { active: true };
        if (hospitalId)
            portalAccountQuery.hospitalId = hospitalId;
        if (patientIdInput) {
            const patientQuery = { mrn: patientIdInput, active: true };
            if (hospitalId)
                patientQuery.hospitalId = hospitalId;
            const patientMatches = await PatientModel.find(patientQuery).select('_id hospitalId').limit(20).lean().exec();
            const patientIds = (Array.isArray(patientMatches) ? patientMatches : patientMatches ? [patientMatches] : []).map((patient) => patient._id);
            if (!patientIds.length)
                throw new Error('We could not find an active patient record with that Patient ID. Check the ID with your hospital.');
            portalAccountQuery.patientId = { $in: patientIds };
        }
        else {
            portalAccountQuery.email = email;
        }
        const portalAccountResults = await PatientPortalAccountModel.find(portalAccountQuery)
            .select('+password')
            .exec();
        // Compare against candidate accounts so a patient can sign in with only
        // email/password when that credential pair identifies one hospital account.
        const matchingAccounts = [];
        for (const candidate of portalAccountResults) {
            if (await bcrypt.compare(password, candidate.password)) {
                matchingAccounts.push(candidate);
            }
        }
        if (matchingAccounts.length === 0) {
            throw new Error('Invalid email or password.');
        }
        if (matchingAccounts.length > 1) {
            throw new Error('This email and password match more than one hospital account. Please open the patient portal from the correct hospital dashboard.');
        }
        const portalAccount = matchingAccounts[0];
        const hospitalResult = await Account.findOne({
            _id: portalAccount.hospitalId,
            accountType: 'HOSPITAL',
            isActive: true,
        })
            .select('_id')
            .lean()
            .exec();
        const hospital = (Array.isArray(hospitalResult) ? hospitalResult[0] : hospitalResult);
        if (!hospital)
            throw new Error('The hospital linked to this patient account is inactive. Contact your hospital.');
        const patientResult = await PatientModel.findOne({
            _id: portalAccount.patientId,
            hospitalId: hospital._id,
            active: true,
        })
            .select('_id firstName lastName email mrn')
            .lean()
            .exec();
        const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
        if (!patient)
            throw new Error('The linked patient record is inactive. Contact your hospital.');
        portalAccount.lastLoginAt = new Date();
        await portalAccount.save();
        const patientWithHospital = {
            ...patient,
            hospitalId: hospital._id,
        };
        return {
            token: tokenFor(portalAccount, patientWithHospital),
            patient: {
                id: patient._id.toString(),
                hospitalId: hospital._id.toString(),
                name: `${patient.firstName} ${patient.lastName}`.trim(),
                email: patient.email || email || portalAccount.email,
                mrn: patient.mrn,
            },
        };
    }
    static async getSettings(patientId, hospitalId, portalAccountId) {
        if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(portalAccountId)) {
            throw new Error('The authenticated patient account is invalid.');
        }
        const account = await PatientPortalAccountModel.findOne({
            _id: new Types.ObjectId(portalAccountId),
            patientId: new Types.ObjectId(patientId),
            hospitalId: new Types.ObjectId(hospitalId),
            active: true,
        }).select('preferences email createdAt lastLoginAt').lean().exec();
        if (!account)
            throw new Error('The patient portal account could not be found.');
        const saved = account.preferences || {};
        return {
            preferences: {
                appointmentUpdates: saved.appointmentUpdates ?? true,
                careTeamMessages: saved.careTeamMessages ?? true,
                billingUpdates: saved.billingUpdates ?? true,
                emailNotifications: saved.emailNotifications ?? true,
                smsNotifications: saved.smsNotifications ?? false,
            },
            email: account.email || '',
            createdAt: account.createdAt || null,
            lastLoginAt: account.lastLoginAt || null,
        };
    }
    static async updateSettings(patientId, hospitalId, portalAccountId, input) {
        if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(portalAccountId)) {
            throw new Error('The authenticated patient account is invalid.');
        }
        const account = await PatientPortalAccountModel.findOne({
            _id: new Types.ObjectId(portalAccountId),
            patientId: new Types.ObjectId(patientId),
            hospitalId: new Types.ObjectId(hospitalId),
            active: true,
        }).exec();
        if (!account)
            throw new Error('The patient portal account could not be found.');
        const current = account.preferences || {};
        const incoming = input.preferences || {};
        const keys = ['appointmentUpdates', 'careTeamMessages', 'billingUpdates', 'emailNotifications', 'smsNotifications'];
        for (const key of keys) {
            if (incoming[key] !== undefined && typeof incoming[key] !== 'boolean') {
                throw new Error(`The ${key} setting must be true or false.`);
            }
        }
        account.preferences = {
            appointmentUpdates: incoming.appointmentUpdates ?? current.appointmentUpdates ?? true,
            careTeamMessages: incoming.careTeamMessages ?? current.careTeamMessages ?? true,
            billingUpdates: incoming.billingUpdates ?? current.billingUpdates ?? true,
            emailNotifications: incoming.emailNotifications ?? current.emailNotifications ?? true,
            smsNotifications: incoming.smsNotifications ?? current.smsNotifications ?? false,
        };
        await account.save();
        return this.getSettings(patientId, hospitalId, portalAccountId);
    }
    static async getProfile(patientId, hospitalId, portalAccountId = '') {
        if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(hospitalId)) {
            throw new Error('The authenticated patient connection is invalid.');
        }
        const [patient, portalAccount] = await Promise.all([
            PatientModel.findOne({ _id: patientId, hospitalId, active: true })
                .select('firstName lastName email phone address dateOfBirth gender mrn universalPatientId maritalStatus occupation nextOfKin')
                .lean().exec(),
            PatientPortalAccountModel.findOne({
                patientId: new Types.ObjectId(patientId),
                hospitalId: new Types.ObjectId(hospitalId),
                active: true,
                ...(portalAccountId && Types.ObjectId.isValid(portalAccountId) ? { _id: new Types.ObjectId(portalAccountId) } : {}),
            }).select('_id email createdAt lastLoginAt').lean().exec(),
        ]);
        if (!patient || !portalAccount)
            throw new Error('The linked patient profile could not be found.');
        return {
            id: String(patient._id),
            portalAccountId: String(portalAccount._id),
            firstName: patient.firstName || '',
            lastName: patient.lastName || '',
            name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            email: patient.email || portalAccount.email || '',
            phone: patient.phone || '',
            address: patient.address || '',
            dateOfBirth: patient.dateOfBirth || null,
            gender: patient.gender || '',
            mrn: patient.mrn || '',
            universalPatientId: patient.universalPatientId || '',
            maritalStatus: patient.maritalStatus || '',
            occupation: patient.occupation || '',
            nextOfKin: patient.nextOfKin || '',
            createdAt: portalAccount.createdAt || null,
            lastLoginAt: portalAccount.lastLoginAt || null,
        };
    }
    static async updateProfile(patientId, hospitalId, portalAccountId, input) {
        if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(hospitalId)) {
            throw new Error('The authenticated patient connection is invalid.');
        }
        const patient = await PatientModel.findOne({ _id: patientId, hospitalId, active: true }).exec();
        const portalAccount = await PatientPortalAccountModel.findOne({
            patientId: new Types.ObjectId(patientId),
            hospitalId: new Types.ObjectId(hospitalId),
            active: true,
            ...(portalAccountId && Types.ObjectId.isValid(portalAccountId) ? { _id: new Types.ObjectId(portalAccountId) } : {}),
        }).exec();
        if (!patient || !portalAccount)
            throw new Error('The linked patient profile could not be found.');
        if (input.email !== undefined) {
            const email = String(input.email || '').trim().toLowerCase();
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                throw new Error('Enter a valid email address.');
            const duplicate = await PatientPortalAccountModel.findOne({
                hospitalId: new Types.ObjectId(hospitalId),
                email,
                _id: { $ne: portalAccount._id },
            }).select('_id').lean().exec();
            if (duplicate)
                throw new Error('That email is already used by another patient portal account at this hospital.');
            portalAccount.email = email;
            patient.email = email;
        }
        if (input.phone !== undefined) {
            const phone = String(input.phone || '').trim();
            if (!phone)
                throw new Error('Phone number is required.');
            if (phone.length > 40)
                throw new Error('Phone number is too long.');
            patient.phone = phone;
        }
        if (input.address !== undefined) {
            const address = String(input.address || '').trim();
            if (address.length > 300)
                throw new Error('Address must be 300 characters or fewer.');
            patient.address = address;
        }
        await Promise.all([patient.save(), portalAccount.save()]);
        return this.getProfile(patientId, hospitalId, String(portalAccount._id));
    }
    static async changePassword(patientId, hospitalId, portalAccountId, input) {
        if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(hospitalId) || !Types.ObjectId.isValid(portalAccountId)) {
            throw new Error('The authenticated patient account is invalid.');
        }
        const currentPassword = String(input.currentPassword || '');
        const newPassword = String(input.newPassword || '');
        const confirmPassword = String(input.confirmPassword || '');
        if (!currentPassword || !newPassword || !confirmPassword)
            throw new Error('Complete all password fields.');
        if (newPassword !== confirmPassword)
            throw new Error('New password and confirmation do not match.');
        if (currentPassword === newPassword)
            throw new Error('Your new password must be different from your current password.');
        if (!validPassword(newPassword))
            throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number and special character.');
        const portalAccount = await PatientPortalAccountModel.findOne({
            _id: new Types.ObjectId(portalAccountId),
            patientId: new Types.ObjectId(patientId),
            hospitalId: new Types.ObjectId(hospitalId),
            active: true,
        }).select('+password').exec();
        if (!portalAccount)
            throw new Error('The patient portal account could not be found.');
        const matches = await bcrypt.compare(currentPassword, portalAccount.password);
        if (!matches)
            throw new Error('Your current password is incorrect.');
        portalAccount.password = await bcrypt.hash(newPassword, 12);
        await portalAccount.save();
        return { changedAt: new Date().toISOString() };
    }
    /**
     * Restores the hospital connection from the authenticated portal account.
     * The association is stored in MongoDB, not in browser/device state.
     */
    static async getConnection(patientId, hospitalId) {
        if (!Types.ObjectId.isValid(patientId) || !Types.ObjectId.isValid(hospitalId)) {
            throw new Error('The authenticated patient connection is invalid.');
        }
        const portalAccount = await PatientPortalAccountModel.findOne({
            patientId: new Types.ObjectId(patientId),
            hospitalId: new Types.ObjectId(hospitalId),
            active: true,
        }).select('_id patientId hospitalId email lastLoginAt createdAt').lean().exec();
        if (!portalAccount)
            throw new Error('No active hospital connection was found for this patient account.');
        const [hospitalResult, patientResult] = await Promise.all([
            Account.findOne({ _id: hospitalId, accountType: 'HOSPITAL', isActive: true })
                .select('_id name code logoUrl address').lean().exec(),
            PatientModel.findOne({ _id: patientId, hospitalId, active: true })
                .select('_id firstName lastName email mrn universalPatientId').lean().exec(),
        ]);
        const hospital = (Array.isArray(hospitalResult) ? hospitalResult[0] : hospitalResult);
        const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
        if (!hospital || !patient)
            throw new Error('The linked hospital or patient record is no longer active.');
        return {
            connected: true,
            hospital: {
                id: String(hospital._id),
                name: hospital.name || 'Hospital',
                code: hospital.code || '',
                logoUrl: hospital.logoUrl || '',
                address: hospital.address || '',
            },
            patient: {
                id: String(patient._id),
                name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
                email: patient.email || portalAccount.email,
                mrn: patient.mrn || '',
                universalPatientId: patient.universalPatientId || '',
            },
            connectedAt: portalAccount.createdAt,
        };
    }
    static async link(input) {
        const requestedHospitalId = String(input.hospitalId || '').trim();
        const hospitalCode = String(input.hospitalCode || '').trim().toUpperCase();
        const mrn = String(input.mrn || '').trim();
        const email = String(input.email || '').trim().toLowerCase();
        const dob = new Date(input.dateOfBirth);
        const password = String(input.password || '');
        if (!requestedHospitalId && !hospitalCode) {
            throw new Error('Please select a hospital.');
        }
        if (!mrn || !input.dateOfBirth) {
            throw new Error('Medical record number and date of birth are required.');
        }
        if (Number.isNaN(dob.getTime())) {
            throw new Error('Enter a valid date of birth.');
        }
        let hospitalResult = null;
        if (requestedHospitalId && Types.ObjectId.isValid(requestedHospitalId)) {
            hospitalResult = await Account.findOne({
                _id: new Types.ObjectId(requestedHospitalId),
                accountType: 'HOSPITAL',
                isActive: true,
            })
                .select('_id name code')
                .lean()
                .exec();
        }
        if (!hospitalResult && hospitalCode) {
            hospitalResult = await Account.findOne({
                code: hospitalCode,
                accountType: 'HOSPITAL',
                isActive: true,
            })
                .select('_id name code')
                .lean()
                .exec();
        }
        const hospital = (Array.isArray(hospitalResult) ? hospitalResult[0] : hospitalResult);
        if (!hospital) {
            throw new Error('Hospital was not found or the hospital is inactive.');
        }
        const dayStart = new Date(dob);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        const patientResult = await PatientModel.findOne({
            hospitalId: hospital._id,
            mrn,
            dateOfBirth: { $gte: dayStart, $lt: dayEnd },
            active: true,
        })
            .select('_id firstName lastName email hospitalId mrn')
            .lean()
            .exec();
        const patient = (Array.isArray(patientResult) ? patientResult[0] : patientResult);
        if (!patient) {
            throw new Error('We could not match those details to an active patient record at this hospital. Check your MRN and date of birth.');
        }
        let portalAccount = await PatientPortalAccountModel.findOne({
            hospitalId: hospital._id,
            $or: [{ patientId: patient._id }, ...(email ? [{ email }] : [])],
        })
            .select('+password')
            .exec();
        if (!portalAccount) {
            let existingByEmail = email
                ? await PatientPortalAccountModel.findOne({ email }).select('+password').exec()
                : null;
            let passwordHash;
            if (password) {
                if (existingByEmail) {
                    const match = await bcrypt.compare(password, existingByEmail.password);
                    if (!match)
                        throw new Error('Incorrect portal password.');
                    passwordHash = existingByEmail.password;
                }
                else {
                    if (!validPassword(password)) {
                        throw new Error('Password must be at least 8 characters and include uppercase, lowercase, number and special character.');
                    }
                    passwordHash = await bcrypt.hash(password, 12);
                }
            }
            else if (existingByEmail) {
                passwordHash = existingByEmail.password;
            }
            else {
                throw new Error('Please enter your portal account password to confirm.');
            }
            portalAccount = await PatientPortalAccountModel.create({
                hospitalId: hospital._id,
                patientId: patient._id,
                email: email || patient.email || `${patient.mrn}@patient.local`,
                password: passwordHash,
                active: true,
            });
        }
        else {
            if (password) {
                const match = await bcrypt.compare(password, portalAccount.password);
                if (!match)
                    throw new Error('Incorrect portal password.');
            }
            portalAccount.patientId = patient._id;
            portalAccount.lastLoginAt = new Date();
            await portalAccount.save();
        }
        const patientWithHospital = {
            ...patient,
            hospitalId: hospital._id,
        };
        return {
            token: tokenFor(portalAccount, patientWithHospital),
            patient: {
                id: patient._id.toString(),
                hospitalId: hospital._id.toString(),
                name: `${patient.firstName} ${patient.lastName}`.trim(),
                email: patient.email || email,
                mrn: patient.mrn,
            },
            hospital: {
                id: hospital._id.toString(),
                name: hospital.name || 'Hospital',
                code: hospital.code || '',
            },
        };
    }
}

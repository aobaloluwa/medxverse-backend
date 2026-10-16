import { PatientPortalService } from './patient-portal.service.js';
export class PatientPortalController {
    static async hospitals(_req, res) {
        try {
            const hospitals = await PatientPortalService.listHospitals();
            res.status(200).json({
                success: true,
                message: 'Hospitals loaded successfully.',
                data: hospitals,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error?.message || 'Unable to load hospitals.',
            });
        }
    }
    static async register(req, res) {
        try {
            const data = await PatientPortalService.register(req.body || {});
            res.status(201).json({
                success: true,
                message: 'Patient portal account created.',
                data,
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error?.message || 'Patient registration failed.',
            });
        }
    }
    static async login(req, res) {
        try {
            const data = await PatientPortalService.login(req.body || {});
            res.status(200).json({
                success: true,
                message: 'Signed in successfully.',
                data,
            });
        }
        catch (error) {
            res.status(401).json({
                success: false,
                message: error?.message || 'Patient login failed.',
            });
        }
    }
    static async connection(req, res) {
        try {
            const authReq = req;
            if (authReq.user?.userType !== 'PATIENT' || !authReq.user._id || !authReq.user.hospitalId) {
                res.status(403).json({ success: false, message: 'An authenticated patient portal account is required.' });
                return;
            }
            const data = await PatientPortalService.getConnection(authReq.user._id, authReq.user.hospitalId);
            res.status(200).json({ success: true, message: 'Hospital connection restored.', data });
        }
        catch (error) {
            res.status(404).json({ success: false, message: error?.message || 'Unable to restore hospital connection.' });
        }
    }
    static async profile(req, res) {
        try {
            const authReq = req;
            if (authReq.user?.userType !== 'PATIENT' || !authReq.user._id || !authReq.user.hospitalId) {
                res.status(403).json({ success: false, message: 'An authenticated patient portal account is required.' });
                return;
            }
            const data = await PatientPortalService.getProfile(authReq.user._id, authReq.user.hospitalId, authReq.user.accountId || '');
            res.status(200).json({ success: true, message: 'Patient profile loaded.', data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error?.message || 'Unable to load patient profile.' });
        }
    }
    static async updateProfile(req, res) {
        try {
            const authReq = req;
            if (authReq.user?.userType !== 'PATIENT' || !authReq.user._id || !authReq.user.hospitalId) {
                res.status(403).json({ success: false, message: 'An authenticated patient portal account is required.' });
                return;
            }
            const data = await PatientPortalService.updateProfile(authReq.user._id, authReq.user.hospitalId, authReq.user.accountId || '', req.body || {});
            res.status(200).json({ success: true, message: 'Patient profile updated successfully.', data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error?.message || 'Unable to update patient profile.' });
        }
    }
    static async settings(req, res) {
        try {
            const authReq = req;
            if (authReq.user?.userType !== 'PATIENT' || !authReq.user._id || !authReq.user.hospitalId || !authReq.user.accountId) {
                res.status(403).json({ success: false, message: 'An authenticated patient portal account is required.' });
                return;
            }
            const data = await PatientPortalService.getSettings(authReq.user._id, authReq.user.hospitalId, authReq.user.accountId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error?.message || 'Unable to load patient settings.' });
        }
    }
    static async updateSettings(req, res) {
        try {
            const authReq = req;
            if (authReq.user?.userType !== 'PATIENT' || !authReq.user._id || !authReq.user.hospitalId || !authReq.user.accountId) {
                res.status(403).json({ success: false, message: 'An authenticated patient portal account is required.' });
                return;
            }
            const data = await PatientPortalService.updateSettings(authReq.user._id, authReq.user.hospitalId, authReq.user.accountId, req.body || {});
            res.status(200).json({ success: true, message: 'Settings saved successfully.', data });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error?.message || 'Unable to save patient settings.' });
        }
    }
    static async changePassword(req, res) {
        try {
            const authReq = req;
            if (authReq.user?.userType !== 'PATIENT' || !authReq.user._id || !authReq.user.hospitalId || !authReq.user.accountId) {
                res.status(403).json({ success: false, message: 'An authenticated patient portal account is required.' });
                return;
            }
            await PatientPortalService.changePassword(authReq.user._id, authReq.user.hospitalId, authReq.user.accountId, req.body || {});
            res.status(200).json({ success: true, message: 'Password changed successfully.' });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error?.message || 'Unable to change password.' });
        }
    }
    static async link(req, res) {
        try {
            const data = await PatientPortalService.link(req.body || {});
            res.status(200).json({
                success: true,
                message: 'Account connected to hospital successfully.',
                data,
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error?.message || 'Connecting account to hospital failed.',
            });
        }
    }
}

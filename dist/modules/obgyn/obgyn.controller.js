import { obgynService } from './obgyn.service.js';
export class ObgynController {
    static context(req, res) {
        const auth = req;
        const hospitalId = auth.user?.hospitalId || auth.user?.hospital || auth.account?.hospitalId || auth.account?.accountId || auth.account?._id || auth.user?.accountId;
        const userId = auth.user?._id || auth.user?.id || auth.account?._id || auth.account?.accountId;
        if (!hospitalId || !userId) {
            res.status(401).json({ success: false, message: 'Authenticated hospital context is missing.' });
            return null;
        }
        return { hospitalId: String(hospitalId), userId: String(userId) };
    }
    static async summary(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            res.json({ success: true, data: await obgynService.summary(c.hospitalId) });
        }
        catch (e) {
            next(e);
        }
    }
    static async reports(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            res.json({ success: true, data: await obgynService.reports(c.hospitalId) });
        }
        catch (e) {
            next(e);
        }
    }
    static async create(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            const data = await obgynService.create(c.hospitalId, c.userId, req.body);
            res.status(201).json({ success: true, data });
        }
        catch (e) {
            if (e instanceof Error && (e.message.includes('valid patient') || e.message.includes('not found') || e.message.includes('record type'))) {
                res.status(400).json({ success: false, message: e.message });
                return;
            }
            next(e);
        }
    }
    static async list(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            const query = { ...req.query, highRisk: req.query.highRisk === 'true' };
            res.json({ success: true, data: await obgynService.list(c.hospitalId, query) });
        }
        catch (e) {
            next(e);
        }
    }
    static async getById(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            const data = await obgynService.getById(c.hospitalId, String(req.params.id));
            if (!data) {
                res.status(404).json({ success: false, message: 'O&G record not found.' });
                return;
            }
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    }
    static async addAnc(req, res, next) { return ObgynController.add(req, res, next, 'ancVisits'); }
    static async addPnc(req, res, next) { return ObgynController.add(req, res, next, 'pncVisits'); }
    static async addGynecology(req, res, next) { return ObgynController.add(req, res, next, 'gynecologyVisits'); }
    static async addFamilyPlanning(req, res, next) { return ObgynController.add(req, res, next, 'familyPlanningRecords'); }
    static async addReferral(req, res, next) { return ObgynController.add(req, res, next, 'referrals'); }
    static async add(req, res, next, field) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            const data = await obgynService.addEntry(c.hospitalId, String(req.params.id), field, req.body || {}, c.userId);
            if (!data) {
                res.status(404).json({ success: false, message: 'O&G record not found.' });
                return;
            }
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    }
    static async delivery(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            const data = await obgynService.recordDelivery(c.hospitalId, String(req.params.id), req.body || {}, c.userId);
            if (!data) {
                res.status(404).json({ success: false, message: 'Active pregnancy record not found.' });
                return;
            }
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    }
    static async consent(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            if (typeof req.body?.consentToShare !== 'boolean') {
                res.status(400).json({ success: false, message: 'consentToShare must be true or false.' });
                return;
            }
            const data = await obgynService.updateConsent(c.hospitalId, String(req.params.id), req.body.consentToShare, c.userId);
            if (!data) {
                res.status(404).json({ success: false, message: 'O&G record not found.' });
                return;
            }
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    }
    static async riskFlags(req, res, next) {
        try {
            const c = ObgynController.context(req, res);
            if (!c)
                return;
            if (!Array.isArray(req.body?.riskFlags)) {
                res.status(400).json({ success: false, message: 'riskFlags must be an array.' });
                return;
            }
            const data = await obgynService.updateRiskFlags(c.hospitalId, String(req.params.id), req.body.riskFlags, c.userId);
            if (!data) {
                res.status(404).json({ success: false, message: 'O&G record not found.' });
                return;
            }
            res.json({ success: true, data });
        }
        catch (e) {
            next(e);
        }
    }
}

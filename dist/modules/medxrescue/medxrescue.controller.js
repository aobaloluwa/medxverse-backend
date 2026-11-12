import { medxRescueService } from './medxrescue.service.js';
import { RescueProviderModel, RescueVehicleModel } from './medxrescue.model.js';
import { IncidentStatus, IncidentPriority, ProviderVerificationStatus, ProviderOperationalStatus } from './medxrescue.types.js';
import { routingProvider } from './medxrescue.routing.js';
const sendError = (res, error) => {
    const err = error;
    const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
    console.error('[MedxRescue Controller Error]', error);
    res.status(status).json({ success: false, message: err.message || 'MedxRescue request could not be completed.' });
};
const actorId = (req) => {
    const auth = req;
    return String(auth.user?._id || auth.user?.accountId || auth.account?.accountId || '');
};
const accountIdOf = (req) => {
    const auth = req;
    return String(auth.user?.accountId || auth.user?.hospitalId || auth.account?.accountId || '');
};
/**
 * Resolve the actual MedXRescue permission role from the authenticated token.
 *
 * Hospital-account login tokens are intentionally issued with userType=ACCOUNT
 * and accountType=HOSPITAL; they do not carry a staff `role`. Treat that
 * account owner as HOSPITAL_ADMIN for hospital-scoped operational actions.
 * Do NOT apply this mapping to userType=STAFF: doctors/nurses must have an
 * explicit dispatcher/admin role before accessing restricted dispatch tools.
 */
const roleOf = (req) => {
    const auth = req;
    const user = auth.user;
    const account = auth.account;
    const userType = String(user?.userType || account?.userType || '').trim().toUpperCase();
    const accountType = String(user?.accountType || account?.accountType || '').trim().toUpperCase();
    const explicitRole = String(user?.role || account?.role || '').trim().toUpperCase();
    if (explicitRole) {
        if (userType === 'ACCOUNT' && accountType === 'HOSPITAL' && explicitRole === 'HOSPITAL') {
            return 'HOSPITAL_ADMIN';
        }
        return explicitRole;
    }
    if (userType === 'ACCOUNT' && accountType === 'HOSPITAL')
        return 'HOSPITAL_ADMIN';
    if (userType === 'ACCOUNT' && accountType === 'HMO')
        return 'HMO';
    return accountType;
};
const platformAdmin = (req) => ['ADMIN', 'SYSTEM_ADMIN'].includes(roleOf(req));
const requireStaffRole = (req, res, roles) => {
    const actor = actorId(req);
    if (!actor) {
        res.status(401).json({ success: false, message: 'Authentication required for MedxRescue actions.' });
        return false;
    }
    return true;
};
export class MedxRescueController {
    async createGuestIncident(req, res) {
        try {
            const key = String(req.header('Idempotency-Key') || '');
            const patientUserId = actorId(req);
            const result = await medxRescueService.createGuestIncident(req.body || {}, key, patientUserId || undefined);
            res.status(result.reused ? 200 : 201).json({ success: true, data: result.incident, accessToken: result.accessToken, reused: result.reused, message: 'Request received. This does not mean an ambulance has been dispatched. A human dispatcher must review the request and a verified crew must accept before dispatch is confirmed.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getPatientActiveEmergency(req, res) {
        try {
            const patientUserId = actorId(req);
            if (!patientUserId) {
                res.json({ success: true, data: null });
                return;
            }
            const data = await medxRescueService.getPatientActiveEmergency(patientUserId);
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async cancelGuestIncident(req, res) {
        try {
            const data = await medxRescueService.cancelGuestIncident(String(req.params.reference), String(req.header('X-Emergency-Access-Token') || ''), typeof req.body?.reason === 'string' ? req.body.reason : undefined);
            res.json({ success: true, data, message: 'Your cancellation was recorded. If a crew was already confirmed, contact the dispatcher directly.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async matchSmartHospital(req, res) {
        try {
            const incidentId = String(req.params.id);
            const excludeFacilityIds = Array.isArray(req.body?.excludeFacilityIds) ? req.body.excludeFacilityIds : [];
            const data = await medxRescueService.matchSmartHospital(incidentId, excludeFacilityIds);
            res.json({ success: true, data, message: 'Nearest available hospital matched successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async previewSmartHospital(req, res) {
        try {
            const incidentId = String(req.params.id);
            const excludeFacilityIds = typeof req.query.exclude === 'string' ? req.query.exclude.split(',').filter(Boolean) : [];
            const data = await medxRescueService.previewSmartHospital(incidentId, excludeFacilityIds);
            res.json({ success: true, data, message: 'Hospital match preview generated.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setFacilityEmergencyAvailability(req, res) {
        try {
            const facilityId = String(req.params.facilityId);
            const actId = actorId(req);
            const accId = accountIdOf(req);
            const isPlatformAdmin = platformAdmin(req);
            const data = await medxRescueService.setFacilityEmergencyAvailability(facilityId, req.body || {}, actId, accId, isPlatformAdmin);
            res.json({ success: true, data, message: 'Hospital emergency availability updated successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setFacilityLocation(req, res) {
        try {
            const facilityId = String(req.params.facilityId);
            const actId = actorId(req);
            const accId = accountIdOf(req);
            const isPlatformAdmin = platformAdmin(req);
            const lat = Number(req.body?.latitude);
            const lng = Number(req.body?.longitude);
            const address = typeof req.body?.address === 'string' ? req.body.address : undefined;
            const data = await medxRescueService.setFacilityLocation(facilityId, lat, lng, address, actId, accId, isPlatformAdmin);
            res.json({ success: true, data, message: 'Hospital facility GPS location updated successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setMyFacilityEmergencyAvailability(req, res) {
        try {
            const actId = actorId(req);
            const accId = accountIdOf(req);
            const isPlatformAdmin = platformAdmin(req);
            const facility = await medxRescueService.resolveFacility(undefined, accId, actId);
            const data = await medxRescueService.setFacilityEmergencyAvailability(String(facility._id), req.body || {}, actId, accId, isPlatformAdmin);
            res.json({ success: true, data, message: 'Hospital emergency availability updated successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setMyFacilityLocation(req, res) {
        try {
            const actId = actorId(req);
            const accId = accountIdOf(req);
            const isPlatformAdmin = platformAdmin(req);
            const facility = await medxRescueService.resolveFacility(undefined, accId, actId);
            const lat = Number(req.body?.latitude);
            const lng = Number(req.body?.longitude);
            const address = typeof req.body?.address === 'string' ? req.body.address : undefined;
            const data = await medxRescueService.setFacilityLocation(String(facility._id), lat, lng, address, actId, accId, isPlatformAdmin);
            res.json({ success: true, data, message: 'Hospital facility GPS location updated successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getIncidentById(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const role = roleOf(req);
            const accountId = role === 'HOSPITAL_ADMIN' ? accountIdOf(req) : undefined;
            if (role === 'HOSPITAL_ADMIN' && !accountId) {
                res.status(403).json({ success: false, message: 'Hospital account context is missing.' });
                return;
            }
            res.json({ success: true, data: await medxRescueService.getIncidentById(String(req.params.id), accountId) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getGuestIncident(req, res) {
        try {
            const data = await medxRescueService.getGuestIncident(String(req.params.reference), String(req.header('X-Emergency-Access-Token') || ''));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async updateGuestLocation(req, res) {
        try {
            const data = await medxRescueService.updateIncidentLocation(String(req.params.reference), String(req.header('X-Emergency-Access-Token') || ''), req.body || {});
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getRouteEstimate(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        const origin = { latitude: Number(req.query.originLatitude), longitude: Number(req.query.originLongitude) };
        const destination = { latitude: Number(req.query.destinationLatitude), longitude: Number(req.query.destinationLongitude) };
        const valid = (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
        if (!valid(origin) || !valid(destination)) {
            res.status(400).json({ success: false, message: 'Valid origin and destination coordinates are required.' });
            return;
        }
        try {
            const route = await routingProvider.getRoute(origin, destination);
            if (!route) {
                res.status(503).json({ success: false, message: 'Road routing is not configured or no route is available. Do not display a fabricated ETA.' });
                return;
            }
            res.json({ success: true, data: route });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listIncidents(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const role = roleOf(req);
            const accountId = role === 'HOSPITAL_ADMIN' ? accountIdOf(req) : undefined;
            if (role === 'HOSPITAL_ADMIN' && !accountId) {
                res.status(403).json({ success: false, message: 'Hospital account context is missing.' });
                return;
            }
            res.json({ success: true, data: await medxRescueService.listIncidents(req.query, accountId) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async recordEmergencyEscalation(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const channel = String(req.body?.channel || '');
            const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
            const data = await medxRescueService.recordEmergencyEscalation(String(req.params.id), actorId(req), channel, reason);
            res.status(201).json({ success: true, data, message: 'Fallback escalation was recorded. This records the action; it does not itself place a phone call or contact emergency services.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async updateIncidentPriority(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const priority = req.body?.priority;
            if (![IncidentPriority.ROUTINE, IncidentPriority.URGENT, IncidentPriority.CRITICAL].includes(priority)) {
                res.status(400).json({ success: false, message: 'A valid dispatcher-assigned priority is required.' });
                return;
            }
            const incident = await medxRescueService.updateIncidentPriority(String(req.params.id), priority, actorId(req), typeof req.body?.reason === 'string' ? req.body.reason : undefined);
            res.json({ success: true, data: incident });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async updateIncidentStatus(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const status = req.body?.status;
            if (!Object.values(IncidentStatus).includes(status)) {
                res.status(400).json({ success: false, message: 'A valid incident status is required.' });
                return;
            }
            const incident = await medxRescueService.updateIncidentStatus(String(req.params.id), status, actorId(req), typeof req.body?.reason === 'string' ? req.body.reason : undefined);
            res.json({ success: true, data: incident });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async submitProvider(req, res) {
        try {
            const data = await medxRescueService.submitProvider(req.body || {});
            res.status(201).json({ success: true, data, message: 'Application received. Provider is not verified or dispatchable until approved by an authorized reviewer.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listProviders(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.listProviders() });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listProvidersForReview(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.listProvidersForReview() });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async reviewProvider(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN']))
            return;
        try {
            const status = req.body?.status;
            if (!Object.values(ProviderVerificationStatus).includes(status)) {
                res.status(400).json({ success: false, message: 'A valid verification status is required.' });
                return;
            }
            const data = await medxRescueService.reviewProvider(String(req.params.providerId), status, actorId(req), typeof req.body?.notes === 'string' ? req.body.notes : undefined);
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async linkProviderMember(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN']))
            return;
        try {
            const data = await medxRescueService.linkProviderMember(String(req.params.providerId), String(req.body?.userId || ''), String(req.body?.memberRole || ''), actorId(req));
            res.status(201).json({ success: true, data, message: 'Provider member linked. Provider operations are now resolved through this verified membership.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async createFacility(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN']))
            return;
        try {
            const ownerAccountId = ['ADMIN', 'SYSTEM_ADMIN'].includes(roleOf(req)) ? String(req.body?.ownerAccountId || accountIdOf(req)) : accountIdOf(req);
            const data = await medxRescueService.createFacility(req.body || {}, ownerAccountId, false);
            res.status(201).json({ success: true, data, message: 'Facility submitted for verification. It is not dispatch-selectable until activated by an authorized administrator.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listFacilities(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.listFacilities(req.query) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setFacilityActive(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN']))
            return;
        try {
            if (typeof req.body?.active !== 'boolean') {
                res.status(400).json({ success: false, message: 'active must be true or false.' });
                return;
            }
            const data = await medxRescueService.setFacilityActive(String(req.params.facilityId), req.body.active, actorId(req));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async requestFacilityAcceptance(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const data = await medxRescueService.requestFacilityAcceptance(String(req.params.id), String(req.body?.facilityId || ''), actorId(req));
            res.status(201).json({ success: true, data, message: 'Facility acceptance requested. The destination is not confirmed until the receiving facility explicitly accepts.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listFacilityAcceptances(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN']))
            return;
        try {
            const accountId = accountIdOf(req);
            if (!platformAdmin(req) && !accountId) {
                res.status(403).json({ success: false, message: 'Hospital account context is missing.' });
                return;
            }
            const data = await medxRescueService.listFacilityAcceptances(String(req.params.facilityId), accountId, platformAdmin(req));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async respondToFacilityAcceptance(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN']))
            return;
        try {
            if (typeof req.body?.accept !== 'boolean') {
                res.status(400).json({ success: false, message: 'accept must be true or false.' });
                return;
            }
            const data = await medxRescueService.respondToFacilityAcceptance(String(req.params.acceptanceId), String(req.params.facilityId), accountIdOf(req), req.body.accept, actorId(req), typeof req.body?.note === 'string' ? req.body.note : undefined, platformAdmin(req));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async createClinicalHandover(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'CLINICAL_LEAD']))
            return;
        try {
            const data = await medxRescueService.createClinicalHandover(String(req.params.id), String(req.body?.facilityId || ''), actorId(req), req.body || {}, accountIdOf(req), platformAdmin(req));
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setProviderOperationalStatus(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(role) ? String(req.params.providerId) : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            const status = req.body?.status;
            if (!Object.values(ProviderOperationalStatus).includes(status)) {
                res.status(400).json({ success: false, message: 'A valid provider status is required.' });
                return;
            }
            const data = await medxRescueService.setProviderOperationalStatus(providerId, status, actorId(req));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async setVehicleOperationalStatus(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(role) ? String(req.body?.providerId || '') : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            const status = req.body?.status;
            if (!Object.values(ProviderOperationalStatus).includes(status)) {
                res.status(400).json({ success: false, message: 'A valid vehicle status is required.' });
                return;
            }
            const data = await medxRescueService.setVehicleOperationalStatus(providerId, String(req.params.vehicleId), status, actorId(req));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async addVehicle(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(role) ? String(req.params.providerId) : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            const data = await medxRescueService.addVehicle(providerId, req.body || {});
            res.status(201).json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listVehicles(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER'].includes(role) ? String(req.params.providerId) : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            res.json({ success: true, data: await medxRescueService.listProviderVehicles(providerId) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async updateVehicleLocation(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(role) ? String(req.body?.providerId || '') : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            const data = await medxRescueService.updateVehicleLocation(String(req.params.vehicleId), providerId, req.body || {});
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async reviewVehicle(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER']))
            return;
        try {
            const { status, reason } = req.body || {};
            const data = await medxRescueService.reviewVehicle(String(req.params.vehicleId), status, actorId(req), typeof reason === 'string' ? reason : undefined);
            res.json({ success: true, data, message: `Vehicle marked ${status}.` });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async reapplyVehicle(req, res) {
        try {
            const data = await medxRescueService.reapplyVehicle(String(req.params.vehicleId), actorId(req), req.body || {});
            res.json({ success: true, data, message: 'Vehicle application re-submitted for hospital review.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async confirmAcceptedAssignment(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            if (typeof req.body?.approve !== 'boolean') {
                res.status(400).json({ success: false, message: 'approve must be true or false.' });
                return;
            }
            const data = await medxRescueService.confirmAcceptedAssignment(String(req.params.id), actorId(req), req.body.approve, typeof req.body?.reason === 'string' ? req.body.reason : undefined);
            res.json({ success: true, data, message: req.body.approve ? 'Assignment confirmed by dispatcher.' : 'Assignment not confirmed; incident returned to active offers or dispatcher review.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listDispatchEligibleVehicles(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const incidentId = typeof req.query.incidentId === 'string' ? req.query.incidentId : undefined;
            res.json({ success: true, data: await medxRescueService.listDispatchEligibleVehicles(incidentId), message: 'Candidates have verified providers, available vehicles, and fresh GPS. Dispatcher must still review coverage and clinical/operational suitability before sending offers.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async createDispatchOffer(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const vehicleIds = Array.isArray(req.body?.vehicleIds) ? req.body.vehicleIds.map(String) : String(req.body?.vehicleId || '');
            const data = await medxRescueService.createDispatchOffer(String(req.params.id), vehicleIds, actorId(req), Number(req.body?.expiresInSeconds) || 90);
            res.status(201).json({ success: true, data, message: 'Dispatcher-approved offer wave sent. Dispatch remains unconfirmed until a crew accepts and the dispatcher confirms the assignment.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listOffers(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN'].includes(role) ? String(req.query.providerId || '') : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC']) || '');
            res.json({ success: true, data: await medxRescueService.listOffers(providerId || undefined, actorId(req)) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listHospitalOfferHistory(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            const role = roleOf(req);
            const hospitalId = role === 'HOSPITAL_ADMIN' ? accountIdOf(req) : undefined;
            const data = await medxRescueService.listHospitalOfferHistory(hospitalId);
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async respondToOffer(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER']))
            return;
        try {
            const { vehicleId, accept, note } = req.body || {};
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(role) ? String(req.body?.providerId || '') : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            if (typeof accept !== 'boolean') {
                res.status(400).json({ success: false, message: 'accept must be true or false.' });
                return;
            }
            const data = await medxRescueService.respondToOffer(String(req.params.offerId), String(providerId || ''), String(vehicleId || ''), accept, actorId(req), typeof note === 'string' ? note : undefined);
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listLiveFleet(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.listLiveFleet(req.query) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async seedDemoFleet(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.seedDemoFleet(), message: 'Demo operational fleet seeded successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    // --- SRS Feature Extension Handlers ---
    async recordClinicalObservation(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER', 'CLINICAL_LEAD']))
            return;
        try {
            const data = await medxRescueService.recordClinicalObservation(String(req.params.id), actorId(req), req.body || {});
            res.status(201).json({ success: true, data, message: 'Clinical vital observation recorded.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getClinicalObservations(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.getClinicalObservations(String(req.params.id)) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async createOrUpdateEPCR(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'CLINICAL_LEAD']))
            return;
        try {
            const vehicleId = String(req.body?.vehicleId || '');
            const data = await medxRescueService.createOrUpdateEPCR(String(req.params.id), actorId(req), vehicleId, req.body || {});
            res.json({ success: true, data, message: req.body?.isSigned ? 'ePCR finalized and signed.' : 'ePCR draft saved.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getEPCR(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.getEPCR(String(req.params.id)) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async submitPreShiftChecklist(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER']))
            return;
        try {
            const role = roleOf(req);
            const providerId = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(role) ? String(req.body?.providerId || '') : String(await medxRescueService.resolveProviderIdForUser(actorId(req), ['PROVIDER_ADMIN', 'CREW', 'DRIVER', 'PARAMEDIC']) || '');
            if (!providerId) {
                res.status(403).json({ success: false, message: 'Your account is not linked to a rescue provider.' });
                return;
            }
            const data = await medxRescueService.submitPreShiftChecklist(String(req.params.vehicleId), providerId, actorId(req), req.body || {});
            res.status(201).json({ success: true, data, message: data.passed ? 'Pre-shift inspection passed.' : 'Pre-shift inspection failed. Resolve issues before marking vehicle available.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getMatchingCandidates(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.getMatchingCandidates(String(req.params.id)) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async activateHospitalTeam(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD', 'RESCUE_PROVIDER_ADMIN', 'AMBULANCE_CREW', 'PARAMEDIC']))
            return;
        try {
            const data = await medxRescueService.activateHospitalTeam(String(req.params.id), String(req.body?.facilityId || ''), actorId(req), String(req.body?.teamType || ''), typeof req.body?.notes === 'string' ? req.body.notes : undefined);
            res.status(201).json({ success: true, data, message: `Emergency ${req.body?.teamType} team activated.` });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getHospitalTeamActivations(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.getHospitalTeamActivations(String(req.params.id)) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getFHIRBundle(req, res) {
        if (!requireStaffRole(req, res, ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']))
            return;
        try {
            res.json({ success: true, data: await medxRescueService.getFHIRBundle(String(req.params.id)) });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async createFamilyTrackingLink(req, res) {
        try {
            const data = await medxRescueService.createFamilyTrackingLink(String(req.params.reference), String(req.header('X-Emergency-Access-Token') || ''));
            res.json({ success: true, data });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async listHospitals(req, res) {
        try {
            res.json({ success: true, data: await medxRescueService.listHospitals() });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async registerCrew(req, res) {
        try {
            const data = await medxRescueService.registerCrew(req.body || {});
            res.status(201).json({ success: true, data, message: 'Ambulance crew account registered successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async loginCrew(req, res) {
        try {
            const data = await medxRescueService.loginCrew(req.body || {});
            res.json({ success: true, data, message: 'Signed in successfully.' });
        }
        catch (error) {
            sendError(res, error);
        }
    }
    async getCrewProfile(req, res) {
        try {
            const authReq = req;
            const userId = String(authReq.user?._id || authReq.user?.accountId || authReq.account?.accountId || '');
            const providerId = await medxRescueService.resolveProviderIdForUser(userId);
            const provider = providerId ? await RescueProviderModel.findById(providerId).lean().exec() : null;
            const vehicle = providerId ? await RescueVehicleModel.findOne({ providerId }).lean().exec() : null;
            res.json({
                success: true,
                data: {
                    user: authReq.user,
                    provider,
                    vehicle,
                },
            });
        }
        catch (error) {
            sendError(res, error);
        }
    }
}
export const medxRescueController = new MedxRescueController();

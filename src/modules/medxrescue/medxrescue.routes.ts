import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { apiLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { medxRescueController } from './medxrescue.controller.js';

const router = Router();

// Public guest access: no patient account, patient ID, or login is required.
router.post('/incidents', apiLimiter, (req, res) => void medxRescueController.createGuestIncident(req, res));
router.get('/incidents/public/:reference', apiLimiter, (req, res) => void medxRescueController.getGuestIncident(req, res));
router.patch('/incidents/public/:reference/location', apiLimiter, (req, res) => void medxRescueController.updateGuestLocation(req, res));
router.post('/incidents/public/:reference/cancel', apiLimiter, (req, res) => void medxRescueController.cancelGuestIncident(req, res));
// Provider applications are public, but applications are never operationally eligible until verified.
router.post('/providers/apply', apiLimiter, (req, res) => void medxRescueController.submitProvider(req, res));

// All operational/clinical actions require authenticated, role-checked staff.
router.use(authenticate);
router.get('/incidents', (req, res) => void medxRescueController.listIncidents(req, res));
router.get('/incidents/:id', (req, res) => void medxRescueController.getIncidentById(req, res));
router.get('/routing/estimate', (req, res) => void medxRescueController.getRouteEstimate(req, res));
router.patch('/incidents/:id/status', (req, res) => void medxRescueController.updateIncidentStatus(req, res));
router.patch('/incidents/:id/priority', (req, res) => void medxRescueController.updateIncidentPriority(req, res));
router.post('/incidents/:id/escalations', (req, res) => void medxRescueController.recordEmergencyEscalation(req, res));
router.patch('/incidents/:id/assignment-confirmation', (req, res) => void medxRescueController.confirmAcceptedAssignment(req, res));
router.get('/providers', (req, res) => void medxRescueController.listProviders(req, res));
router.get('/providers/review-queue', (req, res) => void medxRescueController.listProvidersForReview(req, res));
router.patch('/providers/:providerId/review', (req, res) => void medxRescueController.reviewProvider(req, res));
router.post('/providers/:providerId/members', (req, res) => void medxRescueController.linkProviderMember(req, res));
router.patch('/providers/:providerId/operational-status', (req, res) => void medxRescueController.setProviderOperationalStatus(req, res));
router.post('/providers/:providerId/vehicles', (req, res) => void medxRescueController.addVehicle(req, res));
router.get('/providers/:providerId/vehicles', (req, res) => void medxRescueController.listVehicles(req, res));
router.patch('/vehicles/:vehicleId/location', (req, res) => void medxRescueController.updateVehicleLocation(req, res));
router.patch('/vehicles/:vehicleId/operational-status', (req, res) => void medxRescueController.setVehicleOperationalStatus(req, res));
router.get('/dispatch/eligible-vehicles', (req, res) => void medxRescueController.listDispatchEligibleVehicles(req, res));
router.post('/incidents/:id/dispatch-offers', (req, res) => void medxRescueController.createDispatchOffer(req, res));
router.post('/incidents/:id/facility-acceptance-requests', (req, res) => void medxRescueController.requestFacilityAcceptance(req, res));
router.post('/incidents/:id/clinical-handover', (req, res) => void medxRescueController.createClinicalHandover(req, res));
router.get('/facilities', (req, res) => void medxRescueController.listFacilities(req, res));
router.post('/facilities', (req, res) => void medxRescueController.createFacility(req, res));
router.patch('/facilities/:facilityId/active', (req, res) => void medxRescueController.setFacilityActive(req, res));
router.get('/facilities/:facilityId/acceptances', (req, res) => void medxRescueController.listFacilityAcceptances(req, res));
router.patch('/facilities/:facilityId/acceptances/:acceptanceId/respond', (req, res) => void medxRescueController.respondToFacilityAcceptance(req, res));
router.get('/dispatch-offers', (req, res) => void medxRescueController.listOffers(req, res));
router.post('/dispatch-offers/:offerId/respond', (req, res) => void medxRescueController.respondToOffer(req, res));

export default router;

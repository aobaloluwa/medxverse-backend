# MedxRescue Nexus — backend foundation

This is a dedicated emergency-response module mounted at `/api/v1/medxrescue`. It complements, rather than replaces, the existing hospital Emergency Department and ambulance-trip modules.

## Implemented foundation

- Guest emergency intake and status access without a patient login or patient ID.
- Idempotent incident creation using the `Idempotency-Key` request header.
- Opaque, server-derived guest access token returned once in the response and required for public status/location updates. Store it securely on the client; do not put it in shareable URLs.
- Incident status transition validation and audit events.
- Rescue-provider application and an authenticated review queue.
- Vehicle registry and timestamped GPS location storage.
- Dispatcher-created offers and transactional crew acceptance. The incident becomes `CREW_CONFIRMED` only after a verified provider's available vehicle is atomically claimed and the offer is explicitly accepted.
- No simulated vehicles are exposed as real resources, no ETA is fabricated, and an offer is not described as a confirmed dispatch.

## Endpoints

### Public / guest

- `POST /api/v1/medxrescue/incidents` — create an incident; send a unique `Idempotency-Key` header.
- `GET /api/v1/medxrescue/incidents/public/:reference` — get a minimal status view; send `X-Emergency-Access-Token`.
- `PATCH /api/v1/medxrescue/incidents/public/:reference/location` — update location/landmark; send `X-Emergency-Access-Token`.
- `POST /api/v1/medxrescue/incidents/public/:reference/cancel` — cancel before crew confirmation; send `X-Emergency-Access-Token`. Crew-confirmed responses require direct dispatcher contact.
- `POST /api/v1/medxrescue/providers/apply` — submit a provider application. It remains non-operational until reviewed and verified.

Incident intake body example:

```json
{
  "callerPhone": "+234...",
  "callerName": "Caller name",
  "callerIsPatient": true,
  "chiefComplaint": "Describe the emergency",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "landmark": "Nearby landmark",
  "intakeChannel": "GUEST_WEB"
}
```

### Authenticated operations

- `GET /incidents` — dispatcher incident list.
- `PATCH /incidents/:id/status` — validated status transition with reason.
- `GET /providers/review-queue` — pending provider applications.
- `PATCH /providers/:providerId/review` — verify/reject/suspend a provider.
- `POST /providers/:providerId/members` — link an active MedXVerse staff user to a verified provider with a provider membership role.
- `PATCH /providers/:providerId/operational-status` and `PATCH /vehicles/:vehicleId/operational-status` — control availability.
- `POST /providers/:providerId/vehicles` and `GET /providers/:providerId/vehicles` — vehicle registry.
- `PATCH /vehicles/:vehicleId/location` — timestamp a vehicle GPS update.
- `POST /incidents/:id/dispatch-offers` — send a time-limited offer to a vehicle.
- `GET /dispatch-offers?providerId=...` — pending offers for a provider.
- `POST /dispatch-offers/:offerId/respond` — accept/decline an offer.
- `GET /routing/estimate?originLatitude=...&originLongitude=...&destinationLatitude=...&destinationLongitude=...` — road-route estimate when a routing provider is configured.
- `GET /facilities`, `POST /facilities`, `PATCH /facilities/:facilityId/active` — facility registry and admin activation.
- `GET /facilities/:facilityId/acceptances` — list pending acceptance requests for the owning facility account.
- `POST /incidents/:id/facility-acceptance-requests`, `PATCH /facilities/:facilityId/acceptances/:acceptanceId/respond` — request and record explicit hospital acceptance.
- `POST /incidents/:id/clinical-handover` — record the accepted receiving facility and clinical handover.

## Real-time events and routing

- Connect authenticated operational clients to `ws(s)://<backend-host>/ws/medxrescue?token=<access-token>`.
- Dispatcher/admin roles receive operational state events; verified provider members receive events scoped to their provider; hospital admins receive facility-scoped events. Event payloads contain identifiers/statuses rather than patient details.
- Routing is selected with `MEDXRESCUE_ROUTING_PROVIDER`: `osrm`, `google`, or `none`. In development, the default is `osrm`; in production, the default is `none` so a public demo server is not silently used for emergency operations.
- For development only, OSRM can use `https://router.project-osrm.org` without a key. Optionally set `MEDXRESCUE_OSRM_BASE_URL` to your own OSRM host. The public demo server is best-effort, rate-limited and not an emergency-service production dependency. For live operations, use a contracted routing provider with suitable service guarantees or self-host routing.
- To use Google later, set `MEDXRESCUE_ROUTING_PROVIDER=google` and `GOOGLE_MAPS_API_KEY` on the backend only. `MEDXRESCUE_ROUTING_PROVIDER=none` disables route estimates. The endpoint returns `503` when routing is disabled or no route is available; it never fabricates an ETA.
- This is a routing API integration, not a hosted map-tile UI. The frontend must use an approved map renderer and show the required attribution for its map and routing data.
- Guest requests start as `UNTRIAGED`. Public callers cannot assign their own clinical priority; a dispatcher must set `ROUTINE`, `URGENT`, or `CRITICAL`.

## Incident lifecycle

`REQUEST_RECEIVED → DISPATCH_REVIEW → OFFERED_TO_CREW → CREW_CONFIRMED → EN_ROUTE → ON_SCENE → TRANSPORTING → HANDED_OVER`

A crew decline returns the incident to dispatcher review. A dispatcher can mark `NO_RESOURCE_AVAILABLE`; the patient-facing copy must present fallback options and must not imply that a vehicle is on the way. Cancellation transitions are constrained by the service state machine.

## Important deployment requirements / known next steps

1. MongoDB must support transactions (for example, a replica set or MongoDB Atlas) for atomic offer acceptance.
2. Provider staff membership records must be created by an authorized administrator and linked to active MedXVerse staff accounts. Configure staff roles consistently with the provider membership role. Complete partner credential and license verification before operational use.
3. Provider document upload/storage, credential expiration checks, verified crew credential records, clinical capability/equipment matching, and jurisdiction/road-condition dispatch filters remain to be implemented. Facility registry, explicit acceptance and transactional handover are included in this foundation but need operational validation.
4. Add a routing-provider abstraction and real road-routing integration before showing an ETA. GPS updates are stored with timestamps; freshness must be enforced in UI/dispatch logic.
5. Connect the new WebSocket events to frontend workspaces and add SMS/voice/WhatsApp delivery only after the required provider/telecom agreements, plus abuse controls (CAPTCHA/phone verification where appropriate), monitoring, and disaster-recovery drills.
6. Confirm local emergency-number routing, legal/privacy requirements, partner coverage, and escalation procedures before public launch. This module does not call emergency services or claim nationwide/24-hour coverage.
7. For development, use `MEDXRESCUE_ROUTING_PROVIDER=osrm` (no Google billing account required). The default OSRM demo service is for low-volume testing only and must not be relied on for production emergency dispatch. In production the default provider is `none` until an approved provider or self-hosted routing engine is configured. Google remains optional via `MEDXRESCUE_ROUTING_PROVIDER=google` and `GOOGLE_MAPS_API_KEY`.
8. Run `npm ci` and `npm run build` in the complete backend project, then integration tests against MongoDB configured as a replica set/Atlas. The current environment could not complete dependency installation, so a full compile has not been verified here.

This is an engineering foundation, not a substitute for clinical governance, a verified live fleet, an approved dispatch centre, or operational launch approval.

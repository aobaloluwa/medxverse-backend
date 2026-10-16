# MedxRescue Nexus — backend integration notes

The package entry point and TypeScript configuration use the repository-root `src/` directory. The existing `/api/v1/medxrescue` route registration was retained and expanded. The existing MHMS emergency and ambulance modules were not replaced.

## Included in this update

- Guest SOS intake with no patient login/Patient ID, token-protected status/location/cancellation, expiry, and request-fingerprint idempotency.
- Public emergency intake is marked `UNTRIAGED`; callers cannot set clinical priority.
- Dispatcher priority assignment and validated incident state transitions.
- Provider applications, admin verification, active MedXVerse staff membership links, provider/vehicle availability, fresh GPS requirements, and offer expiry processing.
- Transactional dispatch offer creation/acceptance; vehicle assignment is only confirmed after a verified, available provider's crew explicitly accepts.
- Authenticated `/ws/medxrescue` event channel with role/provider/facility-scoped minimal events.
- Facility registry with admin activation, explicit receiving-facility acceptance, and transactional clinical handover.
- Provider-independent road-routing interface with Google Maps and OSRM implementations, plus an explicit disabled mode.

## Configuration

No Google billing account is required for development routing. Set `MEDXRESCUE_ROUTING_PROVIDER=osrm` to use OSRM and optionally set `MEDXRESCUE_OSRM_BASE_URL` to your own OSRM host. The default OSRM demo server is for low-volume testing only; it is best-effort and must not be treated as a production emergency-routing service. The provider defaults to `osrm` in development and `none` in production. For Google, set `MEDXRESCUE_ROUTING_PROVIDER=google` and `GOOGLE_MAPS_API_KEY` on the backend only. Never expose provider keys in the frontend. When routing is disabled or no route is returned, the API returns `503` rather than inventing an ETA.

The module uses the existing `JWT_SECRET`, MongoDB connection and staff authentication setup. Dispatch offer acceptance and clinical handover use MongoDB transactions, so MongoDB must run as a replica set (MongoDB Atlas qualifies).

## Build verification

A complete dependency installation could not finish in the current execution environment because the npm registry package download was unavailable/timed out. A syntax-focused TypeScript pass over the changed TypeScript files found no parser errors, but this is **not** a substitute for the full project build. On your development machine, run:

```bash
npm ci
npm run build
```

Fix any dependency-version-specific diagnostics before deploying. Run integration tests against a non-production MongoDB replica set before operational use.

## Not yet production-ready

This is an integrated backend foundation, not an emergency response service ready for public launch. It still needs frontend integration, partner/crew credential and license verification, document upload and expiry checks, qualification/equipment/jurisdiction-based matching, approved map rendering, abuse prevention, delivery integrations, operational drills, clinical governance, privacy review, and verified real-world ambulance coverage.

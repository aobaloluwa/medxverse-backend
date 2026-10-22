const requestTimeout = () => AbortSignal.timeout(8000);
/** Google Maps implementation behind a provider-independent interface. */
export class GoogleMapsRoutingProvider {
    async getRoute(origin, destination) {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
        if (!apiKey)
            return null;
        const params = new URLSearchParams({
            origin: `${origin.latitude},${origin.longitude}`,
            destination: `${destination.latitude},${destination.longitude}`,
            mode: 'driving',
            departure_time: 'now',
            traffic_model: 'best_guess',
            key: apiKey,
        });
        const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`, {
            method: 'GET',
            signal: requestTimeout(),
        });
        if (!response.ok)
            throw Object.assign(new Error('Routing provider is temporarily unavailable.'), { statusCode: 502 });
        const payload = await response.json();
        const route = payload.routes?.[0];
        const leg = route?.legs?.[0];
        if (payload.status !== 'OK' || !leg || !Number.isFinite(leg.distance?.value) || !Number.isFinite(leg.duration?.value))
            return null;
        return {
            provider: 'google-maps',
            distanceMeters: Number(leg.distance.value),
            durationSeconds: Number(leg.duration.value),
            durationInTrafficSeconds: Number.isFinite(leg.duration_in_traffic?.value) ? Number(leg.duration_in_traffic.value) : undefined,
            polyline: route?.overview_polyline?.points,
            calculatedAt: new Date().toISOString(),
        };
    }
}
/**
 * OSRM implementation. No API key or billing account is required.
 * The public OSRM demo endpoint is for development/low-volume testing only; for production,
 * configure a provider with an SLA or operate a dedicated OSRM instance.
 */
export class OsrmRoutingProvider {
    baseUrl;
    constructor(baseUrl = process.env.MEDXRESCUE_OSRM_BASE_URL?.trim() || 'https://router.project-osrm.org') {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }
    async getRoute(origin, destination) {
        const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
        const url = `${this.baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline&steps=false`;
        const response = await fetch(url, { method: 'GET', signal: requestTimeout() });
        if (!response.ok)
            throw Object.assign(new Error('OSRM routing service is temporarily unavailable.'), { statusCode: 502 });
        const payload = await response.json();
        const route = payload.routes?.[0];
        if (payload.code !== 'Ok' || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration))
            return null;
        return {
            provider: 'osrm',
            distanceMeters: Number(route.distance),
            durationSeconds: Number(route.duration),
            polyline: typeof route.geometry === 'string' ? route.geometry : undefined,
            calculatedAt: new Date().toISOString(),
        };
    }
}
class DisabledRoutingProvider {
    async getRoute() { return null; }
}
/**
 * Provider selection:
 * - MEDXRESCUE_ROUTING_PROVIDER=google requires GOOGLE_MAPS_API_KEY and enabled billing.
 * - MEDXRESCUE_ROUTING_PROVIDER=osrm uses MEDXRESCUE_OSRM_BASE_URL or the public demo endpoint.
 * - MEDXRESCUE_ROUTING_PROVIDER=none disables route estimates.
 * Defaults to OSRM in development and disabled in production, avoiding an accidental dependency
 * on a best-effort public demo service for live emergency operations.
 */
const configuredProvider = (process.env.MEDXRESCUE_ROUTING_PROVIDER || (process.env.NODE_ENV === 'production' ? 'none' : 'osrm')).trim().toLowerCase();
export const routingProvider = configuredProvider === 'google'
    ? new GoogleMapsRoutingProvider()
    : configuredProvider === 'osrm'
        ? new OsrmRoutingProvider()
        : new DisabledRoutingProvider();

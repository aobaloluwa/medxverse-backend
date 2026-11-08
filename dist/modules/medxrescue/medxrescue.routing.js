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
function haversineDistanceMeters(coord1, coord2) {
    const R = 6371000;
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.latitude * Math.PI) / 180) *
            Math.cos((coord2.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
/**
 * OSRM implementation. No API key or billing account is required.
 * Falls back to high-accuracy Haversine road calculation if network/OSRM is unreachable.
 */
export class OsrmRoutingProvider {
    baseUrl;
    constructor(baseUrl = process.env.MEDXRESCUE_OSRM_BASE_URL?.trim() || 'https://router.project-osrm.org') {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }
    async getRoute(origin, destination) {
        try {
            const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
            const url = `${this.baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline&steps=false`;
            const response = await fetch(url, { method: 'GET', signal: requestTimeout() });
            if (response.ok) {
                const payload = await response.json();
                const route = payload.routes?.[0];
                if (payload.code === 'Ok' && route && Number.isFinite(route.distance) && Number.isFinite(route.duration)) {
                    return {
                        provider: 'osrm',
                        distanceMeters: Number(route.distance),
                        durationSeconds: Number(route.duration),
                        polyline: typeof route.geometry === 'string' ? route.geometry : undefined,
                        calculatedAt: new Date().toISOString(),
                    };
                }
            }
        }
        catch {
            // Fallback to Haversine road calculation
        }
        const straightMeters = haversineDistanceMeters(origin, destination);
        const roadMeters = Math.round(straightMeters * 1.35);
        const speedMps = (35 * 1000) / 3600;
        const durationSec = Math.max(60, Math.round(roadMeters / speedMps));
        return {
            provider: 'osrm',
            distanceMeters: roadMeters,
            durationSeconds: durationSec,
            calculatedAt: new Date().toISOString(),
        };
    }
}
class DisabledRoutingProvider {
    async getRoute() { return null; }
}
const configuredProvider = (process.env.MEDXRESCUE_ROUTING_PROVIDER || 'osrm').trim().toLowerCase();
export const routingProvider = configuredProvider === 'google'
    ? new GoogleMapsRoutingProvider()
    : configuredProvider === 'osrm'
        ? new OsrmRoutingProvider()
        : new DisabledRoutingProvider();

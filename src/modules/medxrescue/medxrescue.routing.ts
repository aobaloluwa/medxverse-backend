export interface RouteCoordinate { latitude: number; longitude: number; }
export interface RoadRouteEstimate {
  provider: 'google-maps';
  distanceMeters: number;
  durationSeconds: number;
  durationInTrafficSeconds?: number;
  polyline?: string;
  calculatedAt: string;
}

export interface RoutingProvider {
  getRoute(origin: RouteCoordinate, destination: RouteCoordinate): Promise<RoadRouteEstimate | null>;
}

/** Google Maps implementation behind a provider-independent interface.
 * No estimate is returned unless a real routing provider returns a successful route.
 */
export class GoogleMapsRoutingProvider implements RoutingProvider {
  async getRoute(origin: RouteCoordinate, destination: RouteCoordinate): Promise<RoadRouteEstimate | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) return null;
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
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Object.assign(new Error('Routing provider is temporarily unavailable.'), { statusCode: 502 });
    const payload = await response.json() as {
      status?: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        legs?: Array<{ distance?: { value?: number }; duration?: { value?: number }; duration_in_traffic?: { value?: number } }>;
      }>;
    };
    const route = payload.routes?.[0];
    const leg = route?.legs?.[0];
    if (payload.status !== 'OK' || !leg || !Number.isFinite(leg.distance?.value) || !Number.isFinite(leg.duration?.value)) {
      return null;
    }
    return {
      provider: 'google-maps',
      distanceMeters: Number(leg.distance!.value),
      durationSeconds: Number(leg.duration!.value),
      durationInTrafficSeconds: Number.isFinite(leg.duration_in_traffic?.value) ? Number(leg.duration_in_traffic!.value) : undefined,
      polyline: route?.overview_polyline?.points,
      calculatedAt: new Date().toISOString(),
    };
  }
}

export const routingProvider: RoutingProvider = new GoogleMapsRoutingProvider();

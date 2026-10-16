import { EventEmitter } from 'node:events';

export type MedxRescueEventType =
  | 'incident.created'
  | 'incident.changed'
  | 'dispatch.offer.created'
  | 'dispatch.offer.responded'
  | 'provider.changed'
  | 'vehicle.location'
  | 'facility.changed'
  | 'handover.created';

export interface MedxRescueEvent {
  type: MedxRescueEventType;
  occurredAt: string;
  incidentId?: string;
  incidentReference?: string;
  status?: string;
  offerId?: string;
  providerId?: string;
  accountId?: string;
  vehicleId?: string;
  facilityId?: string;
  acceptanceId?: string;
}

export const medxRescueEvents = new EventEmitter();
medxRescueEvents.setMaxListeners(1000);

export function publishMedxRescueEvent(event: Omit<MedxRescueEvent, 'occurredAt'>): void {
  medxRescueEvents.emit('event', { ...event, occurredAt: new Date().toISOString() } satisfies MedxRescueEvent);
}

import { EventEmitter } from 'node:events';
export const medxRescueEvents = new EventEmitter();
medxRescueEvents.setMaxListeners(1000);
export function publishMedxRescueEvent(event) {
    medxRescueEvents.emit('event', { ...event, occurredAt: new Date().toISOString() });
}

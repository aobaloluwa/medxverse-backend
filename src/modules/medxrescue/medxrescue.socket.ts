import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { Types } from 'mongoose';
import { JwtUtils } from '../../utils/jwt.js';
import { medxRescueEvents, type MedxRescueEvent } from './medxrescue.events.js';
import { RescueProviderMemberModel } from './medxrescue.model.js';

interface RescueSocket extends WebSocket {
  userId?: string;
  role?: string;
  providerId?: string;
  accountId?: string;
  isAlive?: boolean;
}

const ALLOWED_ROLES = new Set([
  'ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER',
  'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD', 'RESCUE_PROVIDER_ADMIN',
  'AMBULANCE_CREW', 'PARAMEDIC', 'DRIVER',
]);

function rejectUpgrade(socket: Duplex, code: number, message: string): void {
  if (socket.destroyed) return;
  const reason = code === 401 ? 'Unauthorized' : 'Forbidden';
  const body = `${message}\n`;
  socket.write([
    `HTTP/1.1 ${code} ${reason}`,
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n'));
  socket.destroy();
}

function tokenFromRequest(request: IncomingMessage): string | null {
  try {
    return new URL(request.url || '/', 'http://localhost').searchParams.get('token')?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Authenticated operational event channel. Payloads intentionally contain identifiers and
 * state changes only; clients must fetch protected incident details via REST.
 */
export function attachMedxRescueWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    let url: URL;
    try { url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`); }
    catch { rejectUpgrade(socket, 400, 'Invalid WebSocket request'); return; }

    if (url.pathname !== '/ws/medxrescue') return;

    const token = tokenFromRequest(request);
    if (!token) { rejectUpgrade(socket, 401, 'Missing access token'); return; }

    try {
      const claims = JwtUtils.verifyAccessToken(token) as {
        _id?: string; id?: string; userType?: string; role?: string; accountType?: string; accountId?: string; hospitalId?: string;
      };
      const userId = String(claims._id || claims.id || '');
      const role = String(claims.role || claims.accountType || '');
      if (!userId || !ALLOWED_ROLES.has(role)) {
        rejectUpgrade(socket, 403, 'MedxRescue operational access required');
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        const client = ws as RescueSocket;
        client.userId = userId;
        client.role = role;
        client.accountId = String(claims.accountId || claims.hospitalId || '');
        client.isAlive = true;
        wss.emit('connection', client, request);
      });
    } catch {
      rejectUpgrade(socket, 401, 'Invalid or expired access token');
    }
  });

  wss.on('connection', async (ws: RescueSocket) => {
    const dispatcherRoles = new Set(['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']);
    if (!dispatcherRoles.has(String(ws.role))) {
      const membership = await RescueProviderMemberModel.findOne({ userId: ws.userId, active: true }).select('providerId').lean<{ providerId: Types.ObjectId }>().exec().catch(() => null);
      if (!membership) { ws.close(1008, 'Verified provider membership required'); return; }
      ws.providerId = String(membership.providerId);
    }
    ws.send(JSON.stringify({ type: 'connected', channel: 'medxrescue', serverTime: new Date().toISOString() }));
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', () => undefined);
  });

  const forward = (event: MedxRescueEvent) => {
    const payload = JSON.stringify({ type: 'medxrescue.event', data: event });
    for (const client of wss.clients) {
      const socket = client as RescueSocket;
      if (socket.readyState !== WebSocket.OPEN) continue;
      const dispatcherRoles = new Set(['ADMIN', 'SYSTEM_ADMIN', 'DISPATCHER', 'EMERGENCY_DISPATCHER', 'CLINICAL_LEAD']);
      if (dispatcherRoles.has(String(socket.role))) {
        socket.send(payload);
      } else if (socket.role === 'HOSPITAL_ADMIN' && socket.accountId && event.accountId && socket.accountId === event.accountId) {
        socket.send(payload);
      } else if (socket.providerId && event.providerId && socket.providerId === event.providerId) {
        socket.send(payload);
      }
    }
  };
  medxRescueEvents.on('event', forward);

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const socket = client as RescueSocket;
      if (socket.isAlive === false) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 25_000);
  heartbeat.unref();

  wss.on('close', () => {
    clearInterval(heartbeat);
    medxRescueEvents.off('event', forward);
  });
}

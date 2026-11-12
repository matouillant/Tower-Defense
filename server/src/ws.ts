import { WebSocket, WebSocketServer } from 'ws';
import { ClientMessage, GAME_CONFIG, ServerMessage, isValidCode, normalizeCode } from '@td/shared';
import { Room, RoomManager } from './rooms';

/** Chemin des WebSockets, identique en local et une fois déployé. */
export const WS_PATH = '/api/ws';
/** Assez grand pour qu'un client renvoie une partie entière après un redémarrage du serveur. */
export const WS_MAX_PAYLOAD = 512 * 1024;

/** Branche le jeu sur un serveur WebSocket et lance la boucle de simulation. */
export function attachGame(wss: WebSocketServer): RoomManager {
  const manager = new RoomManager();
  wss.on('connection', (ws: WebSocket) => {
    let room: Room | null = null;
    let client: Exclude<ReturnType<Room['join']>, string> | null = null;
    const socket = { send: (data: string) => ws.readyState === WebSocket.OPEN && ws.send(data) };
    const reply = (msg: ServerMessage) => socket.send(JSON.stringify(msg));
    // Limite simple de débit : 60 messages par seconde par connexion.
    let budget = 60;
    const refill = setInterval(() => (budget = 60), 1000);

    ws.on('message', (raw) => {
      if (--budget < 0) return;
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof msg.m !== 'string') return;

      if (msg.m === 'create' || msg.m === 'join') {
        if (client) return;
        const name = String(msg.name ?? '').trim().slice(0, 20) || 'Joueur';
        let target: Room | string | undefined;
        if (msg.m === 'create') target = manager.create(typeof msg.seed === 'string' ? msg.seed : undefined);
        else {
          const code = normalizeCode(String(msg.code ?? ''));
          target = isValidCode(code) ? manager.rooms.get(code) : undefined;
          if (!target) return reply({ m: 'error', text: 'Aucune partie avec ce code.', code: 'noroom' });
        }
        if (typeof target === 'string') return reply({ m: 'error', text: target });
        const joined = target.join(socket, name, msg.m === 'join' && typeof msg.token === 'string' ? msg.token : undefined);
        if (typeof joined === 'string') return reply({ m: 'error', text: joined });
        room = target;
        client = joined;
        return;
      }
      if (msg.m === 'restore') {
        if (client) return;
        const code = normalizeCode(String(msg.code ?? ''));
        const token = String(msg.token ?? '');
        if (!isValidCode(code) || !/^[0-9a-f]{32}$/.test(token) || !msg.state || !msg.sim || !Number.isFinite(msg.seed)) return reply({ m: 'error', text: 'Reprise impossible.' });
        const name = String(msg.name ?? '').trim().slice(0, 20) || 'Joueur';
        let target = manager.rooms.get(code);
        if (!target) {
          const made = manager.recreate(code, msg.seed);
          if (typeof made === 'string') return reply({ m: 'error', text: made });
          try {
            made.restoreGame(msg.state, msg.sim, !!msg.paused, name);
          } catch {
            manager.rooms.delete(code);
            return reply({ m: 'error', text: 'Reprise impossible.' });
          }
          target = made;
        }
        const joined = target.adopt(socket, name, token, msg.role === 'strategist' || msg.role === 'hero' ? msg.role : null);
        if (typeof joined === 'string') return reply({ m: 'error', text: joined });
        room = target;
        client = joined;
        return;
      }
      if (msg.m === 'ping') return reply({ m: 'pong', t: msg.t });
      if (msg.m === 'leave') {
        if (room && client) room.leave(client);
        room = null;
        client = null;
        return;
      }
      if (room && client) room.handle(client, msg);
    });

    ws.on('close', () => {
      clearInterval(refill);
      // Si le joueur s'est déjà reconnecté avec une autre connexion, on ne touche à rien.
      if (room && client && client.socket === socket) room.disconnect(client, Date.now());
    });
    ws.on('error', () => ws.close());
  });

  const dt = 1 / GAME_CONFIG.tickRate;
  setInterval(() => manager.tick(Date.now(), dt), 1000 / GAME_CONFIG.tickRate);
  return manager;
}

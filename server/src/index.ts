import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, GAME_CONFIG, ServerMessage, isValidCode, normalizeCode } from '@td/shared';
import { Room, RoomManager } from './rooms';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const manager = new RoomManager();

// Le serveur HTTP sert aussi le client compilé : un seul service à déployer.
const http = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
  }
  let file = normalize(join(CLIENT_DIR, decodeURIComponent(url.pathname)));
  // Tout ce qui n'est pas un fichier (ex. /join/ABCDE) renvoie l'application.
  if (!file.startsWith(CLIENT_DIR) || !existsSync(file) || !statSync(file).isFile()) file = join(CLIENT_DIR, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Client non compilé : lance « npm run build » (ou « npm run dev:client » en développement).');
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 16 * 1024 });

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
        if (!target) return reply({ m: 'error', text: 'Aucune partie avec ce code.' });
      }
      if (typeof target === 'string') return reply({ m: 'error', text: target });
      const joined = target.join(socket, name, msg.m === 'join' && typeof msg.token === 'string' ? msg.token : undefined);
      if (typeof joined === 'string') return reply({ m: 'error', text: joined });
      room = target;
      client = joined;
      return;
    }
    if (msg.m === 'ping') return reply({ m: 'pong', t: msg.t });
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

http.listen(PORT, () => console.log(`Serveur prêt sur http://localhost:${PORT}`));

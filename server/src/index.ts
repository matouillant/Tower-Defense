import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { WS_MAX_PAYLOAD, WS_PATH, attachGame } from './ws';

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

const manager = attachGame(new WebSocketServer({ server: http, path: WS_PATH, maxPayload: WS_MAX_PAYLOAD }));

http.listen(PORT, () => console.log(`Serveur prêt sur http://localhost:${PORT}`));

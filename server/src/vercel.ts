import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { WS_MAX_PAYLOAD, attachGame } from './ws';

/**
 * Point d'entrée pour Vercel : une fonction qui garde les WebSockets ouverts.
 * Compilé vers api/ws.js par « npm run build:api ». Le client statique est servi par Vercel.
 */
const server = createServer((_req, res) => {
  // Une requête HTTP simple (sans WebSocket) sert de test de bon fonctionnement.
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
});
const manager = attachGame(new WebSocketServer({ server, maxPayload: WS_MAX_PAYLOAD }));

export default server;

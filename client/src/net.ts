import type { ClientMessage, ServerMessage } from '@td/shared';

const KEY = 'td:session';

export interface Session {
  code: string;
  token: string;
  name: string;
}

/** Le jeton de session permet de retrouver son rôle après une coupure ou un rechargement. */
export function loadSession(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}
export function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : on continue sans reconnexion automatique */
  }
}

export class Net {
  private ws: WebSocket | null = null;
  private retry = 0;
  session: Session | null = null;
  onMessage: (msg: ServerMessage) => void = () => {};
  onStatus: (online: boolean) => void = () => {};
  private lastHeard = 0;

  constructor() {
    // Garde-fou : une connexion « ouverte » qui ne transmet plus rien (serveur coupé sans prévenir) est relancée.
    setInterval(() => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastHeard > 10000) {
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ m: 'ping', t: Date.now() }));
    }, 3000);
  }

  /** Ouvre la connexion et envoie le premier message (création ou arrivée dans une partie). */
  connect(first: ClientMessage) {
    this.ws?.close();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastHeard = Date.now();
      this.onStatus(true);
      ws.send(JSON.stringify(first));
    };
    ws.onmessage = (ev) => {
      this.lastHeard = Date.now();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return; // message illisible : ignoré
      }
      try {
        this.onMessage(msg);
      } catch (err) {
        // Une erreur d'affichage ne doit jamais bloquer la réception des messages suivants.
        console.error(err);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onStatus(false);
      // Reconnexion automatique avec le jeton, pour reprendre son rôle.
      const s = this.session;
      if (s) setTimeout(() => this.connect({ m: 'join', code: s.code, name: s.name, token: s.token }), Math.min(5000, 800 * ++this.retry));
    };
  }

  /** Ferme la connexion pour de bon (retour à l'accueil) : pas de reconnexion automatique. */
  disconnect() {
    const ws = this.ws;
    this.ws = null;
    this.session = null;
    ws?.close();
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

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

  /** Ouvre la connexion et envoie le premier message (création ou arrivée dans une partie). */
  connect(first: ClientMessage) {
    this.ws?.close();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/api/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus(true);
      ws.send(JSON.stringify(first));
    };
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data));
      } catch {
        /* message illisible : ignoré */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.onStatus(false);
      // Reconnexion automatique avec le jeton, pour reprendre son rôle.
      const s = this.session;
      if (s) setTimeout(() => this.connect({ m: 'join', code: s.code, name: s.name, token: s.token }), Math.min(5000, 800 * ++this.retry));
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

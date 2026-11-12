import { randomBytes, randomInt } from 'node:crypto';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  ClientMessage,
  GAME_CONFIG,
  Game,
  GameMap,
  LobbyState,
  Role,
  SPEEDS,
  ServerMessage,
  SlotStatus,
  generateMap,
  hashSeed,
  roleOfCommand,
} from '@td/shared';

/** Une connexion, vue par les salons. Abstraite pour pouvoir tester sans réseau. */
export interface Socket {
  send(data: string): void;
}

interface Client {
  token: string;
  name: string;
  socket: Socket | null;
  role: Role | null;
  disconnectedAt: number;
  /** Absent depuis assez longtemps pour que l'IA prenne le relais. */
  away: boolean;
  /** Vitesse de jeu souhaitée par ce joueur. */
  speed: number;
}

const ROLES: Role[] = ['strategist', 'hero'];
const ROOM_IDLE_MS = 10 * 60 * 1000;
/** Une coupure plus courte que ça passe inaperçue : l'IA ne reprend pas le héros. */
const AWAY_AFTER_MS = 3000;
const MAX_ROOMS = 200;
const MAX_CLIENTS_PER_ROOM = 8;

export class Room {
  readonly clients = new Map<string, Client>();
  readonly map: GameMap;
  game: Game | null = null;
  /** Jeton du joueur qui tient chaque rôle (connecté ou en cours de reconnexion). */
  slots: Record<Role, string | null> = { strategist: null, hero: null };
  private tickCount = 0;
  /** Temps de jeu en attente : la simulation avance toujours par pas fixes, quelle que soit la vitesse. */
  private pending = 0;
  /** Joueur qui a mis la partie en pause (null = elle tourne). */
  pausedBy: string | null = null;
  emptySince = 0;

  constructor(readonly code: string, seed: number) {
    this.map = generateMap(seed);
  }

  get connected(): Client[] {
    // (les joueurs en micro-coupure ne reçoivent rien, mais gardent leur rôle)
    return [...this.clients.values()].filter((c) => c.socket);
  }

  private slotStatus(role: Role): { status: SlotStatus; name: string | null; speed: number | null } {
    const holder = this.slots[role] ? this.clients.get(this.slots[role]!) : undefined;
    if (holder && (holder.socket || !holder.away)) return { status: 'human', name: holder.name, speed: holder.speed };
    if (holder) return { status: 'reconnecting', name: holder.name, speed: null };
    return { status: role === 'hero' ? 'ai' : 'open', name: null, speed: null };
  }

  /** Vitesse appliquée : il faut l'accord de tous les joueurs humains, donc on prend la plus lente. */
  get speed(): number {
    const wanted = ROLES.map((r) => this.slotStatus(r).speed).filter((v): v is number => v !== null);
    return wanted.length ? Math.min(...wanted) : 1;
  }

  lobby(): LobbyState {
    return {
      code: this.code,
      seed: this.map.requestedSeed,
      started: !!this.game,
      speed: this.speed,
      paused: this.pausedBy,
      slots: ROLES.map((role) => ({ role, ...this.slotStatus(role) })),
      spectators: this.connected.filter((c) => !c.role).length,
    };
  }

  send(client: Client, msg: ServerMessage) {
    client.socket?.send(JSON.stringify(msg));
  }

  broadcastLobby() {
    const lobby = this.lobby();
    for (const c of this.connected) this.send(c, { m: 'lobby', lobby, role: c.role });
  }

  /** Le héros est joué par l'IA dès que son slot n'est pas tenu par un humain connecté. */
  private syncHeroController() {
    if (this.game) this.game.state.heroController = this.slotStatus('hero').status === 'human' ? 'human' : 'ai';
  }

  /** Premier rôle libre pour un nouvel arrivant : stratège s'il manque, sinon héros à la place de l'IA. */
  private freeRole(): Role | null {
    return ROLES.find((r) => this.slots[r] === null) ?? null;
  }

  join(socket: Socket, name: string, token?: string): Client | string {
    let client = token ? this.clients.get(token) : undefined;
    if (client) {
      // Reconnexion : on retrouve son rôle s'il lui est encore réservé.
      client.socket = socket;
      client.away = false;
      client.name = name || client.name;
      if (client.role && this.slots[client.role] !== client.token) client.role = null;
    } else {
      if (this.clients.size >= MAX_CLIENTS_PER_ROOM) return 'Cette partie est complète.';
      client = { token: randomBytes(16).toString('hex'), name, socket, role: null, disconnectedAt: 0, away: false, speed: 1 };
      this.clients.set(client.token, client);
    }
    if (!client.role) {
      const role = this.freeRole();
      if (role) this.assign(client, role);
    }
    this.syncHeroController();
    this.send(client, { m: 'joined', token: client.token, role: client.role, lobby: this.lobby() });
    if (this.game) {
      this.send(client, { m: 'started', map: this.map });
      this.send(client, { m: 'state', state: this.game.state, events: [] });
    }
    this.broadcastLobby();
    return client;
  }

  private assign(client: Client, role: Role) {
    if (client.role) this.slots[client.role] = null;
    this.slots[role] = client.token;
    client.role = role;
  }

  handle(client: Client, msg: ClientMessage) {
    switch (msg.m) {
      case 'take': {
        if (!ROLES.includes(msg.role)) return;
        const status = this.slotStatus(msg.role).status;
        if (status === 'human') return this.send(client, { m: 'error', text: 'Ce rôle est déjà tenu par un joueur.' });
        if (status === 'reconnecting') return this.send(client, { m: 'error', text: 'Ce joueur est en cours de reconnexion, réessaie dans un instant.' });
        this.assign(client, msg.role);
        this.syncHeroController();
        if (this.game && msg.role === 'hero') this.game.emit({ t: 'msg', from: 'jeu', text: `${client.name} reprend le héros à la place de l’IA.` });
        this.broadcastLobby();
        return;
      }
      case 'release': {
        if (!client.role) return;
        const role = client.role;
        this.slots[role] = null;
        client.role = null;
        this.syncHeroController();
        if (this.game && role === 'hero') this.game.emit({ t: 'msg', from: 'jeu', text: 'L’IA reprend le héros.' });
        this.broadcastLobby();
        return;
      }
      case 'speed': {
        if (!client.role || !SPEEDS.includes(msg.speed)) return;
        client.speed = msg.speed;
        if (this.game && this.speed < msg.speed)
          this.game.emit({ t: 'msg', from: 'jeu', text: `${client.name} propose la vitesse x${msg.speed}. Elle s’appliquera quand l’autre joueur l’acceptera.` });
        this.broadcastLobby();
        return;
      }
      case 'pause': {
        if (!this.game || !client.role || this.game.state.phase === 'over') return;
        const on = !!msg.on;
        if (on === (this.pausedBy !== null)) return;
        this.pausedBy = on ? client.name : null;
        this.game.emit({ t: 'msg', from: 'jeu', text: on ? `${client.name} a mis la partie en pause.` : `${client.name} relance la partie.` });
        this.broadcastLobby();
        this.sendState(); // pour que le message s'affiche tout de suite, même en pause
        return;
      }
      case 'start': {
        if (this.game) return;
        if (client.role !== 'strategist') return this.send(client, { m: 'error', text: 'Seul le stratège peut lancer la partie.' });
        this.game = new Game(this.map);
        this.syncHeroController();
        for (const c of this.connected) this.send(c, { m: 'started', map: this.map });
        this.broadcastLobby();
        return;
      }
      case 'cmd': {
        if (!this.game) return;
        const cmd = msg.cmd;
        if (!cmd || typeof cmd !== 'object' || typeof cmd.c !== 'string') return;
        if (!client.role || roleOfCommand(cmd) !== client.role) return this.send(client, { m: 'error', text: 'Cette action n’est pas dans ton rôle.' });
        let error: string | null;
        try {
          error = this.game.apply(client.role, cmd);
        } catch {
          error = 'Commande invalide.';
        }
        if (error) this.send(client, { m: 'error', text: error });
        return;
      }
      case 'ping':
        return this.send(client, { m: 'pong', t: msg.t });
    }
  }

  disconnect(client: Client, now: number) {
    client.socket = null;
    client.disconnectedAt = now;
  }

  /** Appelé à chaque tick du serveur. */
  tick(now: number, dt: number) {
    // Fin du délai de reconnexion : le slot est libéré.
    let changed = false;
    for (const c of this.clients.values()) {
      if (c.socket) continue;
      if (!c.away && now - c.disconnectedAt >= AWAY_AFTER_MS) {
        // Absence confirmée : l'IA reprend le héros, le slot reste réservé le temps d'une reconnexion.
        c.away = true;
        changed = true;
        if (this.game && c.role === 'hero') this.game.emit({ t: 'msg', from: 'jeu', text: `${c.name} est déconnecté : l’IA prend le relais.` });
      }
      if (now - c.disconnectedAt < GAME_CONFIG.reconnectGrace * 1000) continue;
      if (c.role) {
        this.slots[c.role] = null;
        c.role = null;
        changed = true;
      }
      if (now - c.disconnectedAt > ROOM_IDLE_MS) this.clients.delete(c.token);
    }
    if (changed) {
      this.syncHeroController();
      this.broadcastLobby();
    }

    const connected = this.connected;
    if (connected.length === 0) {
      if (!this.emptySince) this.emptySince = now;
      return; // plus personne : la partie est en pause
    }
    this.emptySince = 0;
    if (!this.game) return;
    // En pause, la simulation ne bouge plus, mais on continue d'envoyer l'état : on peut construire et améliorer.
    if (!this.pausedBy) {
      this.pending += dt * this.speed * GAME_CONFIG.gameSpeed;
      for (let i = 0; this.pending >= dt - 1e-9 && i < 8; i++) {
        this.game.step(dt);
        this.pending -= dt;
      }
    }
    this.tickCount++;
    const every = Math.max(1, Math.round(GAME_CONFIG.tickRate / GAME_CONFIG.snapshotRate));
    if (this.tickCount % every === 0) this.sendState();
  }

  private sendState() {
    if (!this.game) return;
    const payload = JSON.stringify({ m: 'state', state: this.game.state, events: this.game.drainEvents() } satisfies ServerMessage);
    for (const c of this.connected) c.socket!.send(payload);
  }

  isExpired(now: number) {
    return this.emptySince > 0 && now - this.emptySince > ROOM_IDLE_MS;
  }
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  /** Seed fournie par le joueur (nombre ou texte libre), sinon tirée au hasard. */
  create(seedInput?: string): Room | string {
    if (this.rooms.size >= MAX_ROOMS) return 'Le serveur est plein, réessaie plus tard.';
    const text = (seedInput ?? '').trim().slice(0, 40);
    const seed = text === '' ? randomInt(2 ** 32) : /^\d{1,10}$/.test(text) ? Number(text) >>> 0 : hashSeed(text);
    const room = new Room(this.newCode(), seed);
    this.rooms.set(room.code, room);
    return room;
  }

  tick(now: number, dt: number) {
    for (const room of this.rooms.values()) {
      room.tick(now, dt);
      if (room.isExpired(now)) this.rooms.delete(room.code);
    }
  }
}

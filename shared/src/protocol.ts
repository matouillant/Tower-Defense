import type { GameMap } from './map/types';
import type { Command, GameEvent, GameState, Role } from './sim/types';

/** Alphabet des codes de partie : sans caractères ambigus (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const isValidCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));

export type SlotStatus = 'human' | 'ai' | 'open' | 'reconnecting';

export interface LobbySlot {
  role: Role;
  status: SlotStatus;
  name: string | null;
}

export interface LobbyState {
  code: string;
  seed: number;
  started: boolean;
  slots: LobbySlot[];
  /** Nombre de spectateurs connectés sans rôle. */
  spectators: number;
}

/** Client -> serveur. */
export type ClientMessage =
  | { m: 'create'; name: string; seed?: string }
  | { m: 'join'; code: string; name: string; token?: string }
  /** Prendre un rôle : avant le lancement, ou en cours de partie pour remplacer l'IA. */
  | { m: 'take'; role: Role }
  /** Rendre son rôle (le héros repasse à l'IA). */
  | { m: 'release' }
  | { m: 'start' }
  | { m: 'cmd'; cmd: Command }
  | { m: 'ping'; t: number };

/** Serveur -> client. */
export type ServerMessage =
  | { m: 'joined'; token: string; role: Role | null; lobby: LobbyState }
  | { m: 'lobby'; lobby: LobbyState; role: Role | null }
  | { m: 'started'; map: GameMap }
  | { m: 'state'; state: GameState; events: GameEvent[] }
  | { m: 'error'; text: string }
  | { m: 'pong'; t: number };

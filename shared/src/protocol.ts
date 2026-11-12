import type { GameMap } from './map/types';
import type { Command, GameEvent, GameState, Role } from './sim/types';
import type { SimSave } from './sim/game';

/** Alphabet des codes de partie : sans caractères ambigus (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
/** Vitesses proposées, au-dessus du rythme de base (GAME_CONFIG.gameSpeed). */
export const SPEEDS = [1, 1.5, 2, 3];
export const normalizeCode = (code: string) => code.trim().toUpperCase();
export const isValidCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));

export type SlotStatus = 'human' | 'ai' | 'open' | 'reconnecting';

export interface LobbySlot {
  role: Role;
  status: SlotStatus;
  name: string | null;
  /** Vitesse souhaitée par ce joueur (null si le rôle n'est pas tenu par un humain). */
  speed: number | null;
}

export interface LobbyState {
  code: string;
  seed: number;
  started: boolean;
  /** Vitesse appliquée : la plus lente de celles demandées par les joueurs humains. */
  speed: number;
  /** Nom du joueur qui a mis la partie en pause, ou null si elle tourne. */
  paused: string | null;
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
  /** Relancer une partie dans le même salon (nouvelle carte, ou la même). Le stratège à tout moment, n'importe quel joueur une fois la base tombée. */
  | { m: 'restart'; sameMap?: boolean }
  /** Quitter le salon : le rôle est libéré tout de suite (le héros repasse à l'IA). */
  | { m: 'leave' }
  /** Vitesse souhaitée. Elle ne s'applique que si tous les joueurs humains demandent au moins autant. */
  | { m: 'speed'; speed: number }
  /** Mettre en pause ou reprendre. N'importe quel joueur peut faire l'un ou l'autre. */
  | { m: 'pause'; on: boolean }
  | { m: 'cmd'; cmd: Command }
  | { m: 'ping'; t: number }
  /** Le serveur a perdu la partie (redémarrage) : le client la renvoie telle qu'il l'a reçue en dernier. */
  | { m: 'restore'; code: string; name: string; token: string; role: Role | null; seed: number; paused: boolean; state: GameState; sim: SimSave };

/** Serveur -> client. */
export type ServerMessage =
  | { m: 'joined'; token: string; role: Role | null; lobby: LobbyState }
  | { m: 'lobby'; lobby: LobbyState; role: Role | null }
  | { m: 'started'; map: GameMap }
  | { m: 'state'; state: GameState; events: GameEvent[]; sim?: SimSave }
  | { m: 'error'; text: string; code?: 'noroom' }
  | { m: 'pong'; t: number };

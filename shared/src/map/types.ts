export interface Vec2 {
  x: number;
  y: number;
}

/** ground: sol libre · path: chemin des ennemis · slot: emplacement de tour · rock: obstacle. */
export type Terrain = 'ground' | 'path' | 'slot' | 'rock';

export interface Slot {
  id: number;
  x: number;
  y: number;
  /** Point haut : bonus de portée pour la tour posée dessus. */
  high: boolean;
}

export interface Deposit {
  id: number;
  x: number;
  y: number;
}

export interface ProspectZone {
  id: number;
  x: number;
  y: number;
}

export interface GameMap {
  /** Seed demandée par le joueur (celle qu'on partage pour rejouer la carte). */
  requestedSeed: number;
  /** Seed réellement utilisée (dérivée si la première tentative était invalide). */
  seed: number;
  attempt: number;
  width: number;
  height: number;
  /** Terrain par case, ligne par ligne : index = y * width + x. */
  terrain: Terrain[];
  /** Un ou deux chemins complets, de l'apparition jusqu'à la base, case par case. */
  paths: Vec2[][];
  /** Index des cases de boue (ralentissent les ennemis). */
  mud: number[];
  slots: Slot[];
  deposits: Deposit[];
  prospectZones: ProspectZone[];
  spawns: Vec2[];
  base: Vec2;
}

export const cellIndex = (map: { width: number }, x: number, y: number) => y * map.width + x;
export const inBounds = (map: { width: number; height: number }, x: number, y: number) =>
  x >= 0 && y >= 0 && x < map.width && y < map.height;

import { MAP_CONFIG } from '../config/map';
import { GameMap, Terrain, Vec2 } from './types';

type Grid = { width: number; height: number; terrain: Terrain[] };

/** Cases atteignables à pied par le héros (tout sauf les rochers), en 4 directions. */
export function reachableFrom(grid: Grid, from: Vec2): Set<number> {
  const { width: W, height: H, terrain } = grid;
  const start = from.y * W + from.x;
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % W;
    const y = Math.floor(i / W);
    const neighbours = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (terrain[n] === 'rock' || seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

/** Vérifie qu'une carte est jouable. Renvoie la liste des problèmes (vide = carte valide). */
export function validateMap(map: GameMap, cfg: typeof MAP_CONFIG = MAP_CONFIG): string[] {
  const errors: string[] = [];
  const { width: W, height: H, terrain } = map;
  const at = (c: Vec2) => terrain[c.y * W + c.x];

  if (terrain.length !== W * H) errors.push('terrain de taille incorrecte');
  if (map.paths.length === 0) errors.push('aucun chemin');

  map.paths.forEach((path, p) => {
    const last = path[path.length - 1];
    if (!last || last.x !== map.base.x || last.y !== map.base.y) errors.push(`chemin ${p} : n'arrive pas à la base`);
    if (path.length < cfg.minPathLength) errors.push(`chemin ${p} : trop court (${path.length})`);
    const seen = new Set<number>();
    for (let i = 0; i < path.length; i++) {
      const c = path[i];
      if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) errors.push(`chemin ${p} : case hors carte`);
      else if (at(c) !== 'path') errors.push(`chemin ${p} : case non marquée comme chemin`);
      const key = c.y * W + c.x;
      if (seen.has(key)) errors.push(`chemin ${p} : repasse sur lui-même`);
      seen.add(key);
      if (i > 0) {
        const prev = path[i - 1];
        if (Math.abs(prev.x - c.x) + Math.abs(prev.y - c.y) !== 1) errors.push(`chemin ${p} : discontinu à l'étape ${i}`);
      }
    }
  });

  if (map.slots.length < cfg.minSlots) errors.push(`pas assez d'emplacements (${map.slots.length})`);
  for (const s of map.slots) if (at(s) !== 'slot') errors.push(`emplacement ${s.id} mal placé`);
  if (map.deposits.length < cfg.deposits[0]) errors.push(`pas assez de gisements (${map.deposits.length})`);
  if (map.prospectZones.length < cfg.prospectZones[0]) errors.push('pas de zone de prospection');

  // Le héros doit pouvoir atteindre tout ce qui compte depuis la base.
  const reach = reachableFrom(map, map.base);
  const ok = (c: Vec2) => reach.has(c.y * W + c.x);
  for (const s of map.slots) if (!ok(s)) errors.push(`emplacement ${s.id} inaccessible`);
  for (const d of map.deposits) if (!ok(d) || at(d) !== 'ground') errors.push(`gisement ${d.id} inaccessible`);
  for (const z of map.prospectZones) if (!ok(z) || at(z) !== 'ground') errors.push(`zone de prospection ${z.id} inaccessible`);

  return errors;
}

import { MAP_CONFIG } from '../config/map';
import { Rng, deriveSeed } from '../rng';
import { GameMap, Terrain, Vec2, cellIndex, inBounds } from './types';
import { validateMap, reachableFrom } from './validate';

type Cfg = typeof MAP_CONFIG;

/**
 * Génère une carte valide à partir d'une seed. Déterministe : même seed => même carte.
 * Si la carte tirée est invalide, on dérive une nouvelle seed et on recommence.
 */
export function generateMap(requestedSeed: number, cfg: Cfg = MAP_CONFIG): GameMap {
  const errorsSeen: string[] = [];
  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    const seed = attempt === 0 ? requestedSeed >>> 0 : deriveSeed(requestedSeed, attempt);
    const map = buildMap(seed, cfg);
    map.requestedSeed = requestedSeed >>> 0;
    map.attempt = attempt;
    const errors = validateMap(map, cfg);
    if (errors.length === 0) return map;
    errorsSeen.push(...errors);
  }
  throw new Error(`Impossible de générer une carte valide (seed ${requestedSeed}) : ${errorsSeen.slice(0, 5).join(' ; ')}`);
}

function buildMap(seed: number, cfg: Cfg): GameMap {
  const rng = new Rng(seed);
  const { width: W, height: H } = cfg;
  const terrain: Terrain[] = new Array(W * H).fill('ground');
  const idx = (x: number, y: number) => y * W + x;

  // 1. Chemin principal : marche dirigée de gauche à droite, avec des virages verticaux.
  const main = walkPath(rng, cfg, rng.int(2, H - 3), null, W - 1);
  const paths: Vec2[][] = [main];

  // 2. Second chemin optionnel : part d'un autre point et rejoint le chemin principal.
  if (rng.chance(cfg.secondPathChance)) {
    const mainIndex = new Map<number, number>();
    main.forEach((c, i) => mainIndex.set(idx(c.x, c.y), i));
    const candidates: number[] = [];
    for (let y = 1; y < H - 1; y++) if (Math.abs(y - main[0].y) >= 4) candidates.push(y);
    if (candidates.length > 0) {
      const mergeX = rng.int(Math.floor(W / 3), Math.floor((2 * W) / 3));
      const second = walkPath(rng, cfg, rng.pick(candidates), mainIndex, mergeX);
      const last = second[second.length - 1];
      const joinAt = mainIndex.get(idx(last.x, last.y));
      if (joinAt !== undefined) paths.push([...second, ...main.slice(joinAt + 1)]);
    }
  }
  for (const p of paths) for (const c of p) terrain[idx(c.x, c.y)] = 'path';

  // Distance (de Tchebychev) de chaque case au chemin.
  const dist = distanceToPath(terrain, W, H);

  // 3. Emplacements constructibles : cases collées au chemin.
  const slotCells: Vec2[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dist[idx(x, y)] === 1) slotCells.push({ x, y });
  rng.shuffle(slotCells);
  const slotCount = Math.min(slotCells.length, rng.int(cfg.slots[0], cfg.slots[1]));
  const slots = slotCells.slice(0, slotCount).map((c, id) => {
    terrain[idx(c.x, c.y)] = 'slot';
    return { id, x: c.x, y: c.y, high: rng.chance(cfg.highGroundRatio) };
  });

  // 4. Boue : quelques tronçons du chemin principal.
  const mud = new Set<number>();
  const patches = rng.int(cfg.mudPatches[0], cfg.mudPatches[1]);
  for (let i = 0; i < patches; i++) {
    const len = rng.int(cfg.mudPatchLength[0], cfg.mudPatchLength[1]);
    const start = rng.int(3, Math.max(3, main.length - 4 - len));
    for (let k = start; k < Math.min(main.length - 3, start + len); k++) mud.add(idx(main[k].x, main[k].y));
  }

  // 5. Zones de prospection : au bord du chemin, dans la moitié proche des apparitions.
  const prospectCells = slotCells.slice(slotCount).filter((c) => c.x < W / 2 && c.x > 0);
  const prospectCount = Math.min(prospectCells.length, rng.int(cfg.prospectZones[0], cfg.prospectZones[1]));
  const prospectZones = prospectCells.slice(0, prospectCount).map((c, id) => ({ id, x: c.x, y: c.y }));
  const reserved = new Set<number>(prospectZones.map((z) => idx(z.x, z.y)));

  // 6. Gisements : à l'écart du chemin, espacés entre eux.
  const far: Vec2[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (dist[idx(x, y)] > cfg.depositMinDistFromPath) far.push({ x, y });
  rng.shuffle(far);
  const depositTarget = rng.int(cfg.deposits[0], cfg.deposits[1]);
  const deposits: { id: number; x: number; y: number }[] = [];
  for (const minGap of [5, 3, 1]) {
    for (const c of far) {
      if (deposits.length >= depositTarget) break;
      if (reserved.has(idx(c.x, c.y))) continue;
      if (deposits.every((d) => Math.max(Math.abs(d.x - c.x), Math.abs(d.y - c.y)) >= minGap)) {
        deposits.push({ id: deposits.length, x: c.x, y: c.y });
        reserved.add(idx(c.x, c.y));
      }
    }
  }

  // 7. Rochers : obstacles pour le héros. On refuse un rocher qui isolerait une zone.
  const rockCells: Vec2[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (terrain[i] === 'ground' && dist[i] >= 2 && !reserved.has(i)) rockCells.push({ x, y });
    }
  rng.shuffle(rockCells);
  const rockTarget = rng.int(cfg.rocks[0], cfg.rocks[1]);
  const base = main[main.length - 1];
  let rocks = 0;
  for (const c of rockCells) {
    if (rocks >= rockTarget) break;
    const i = idx(c.x, c.y);
    terrain[i] = 'rock';
    const walkable = terrain.filter((t) => t !== 'rock').length;
    if (reachableFrom({ width: W, height: H, terrain }, base).size === walkable) rocks++;
    else terrain[i] = 'ground';
  }

  return {
    requestedSeed: seed,
    seed,
    attempt: 0,
    width: W,
    height: H,
    terrain,
    paths,
    mud: [...mud].sort((a, b) => a - b),
    slots,
    deposits,
    prospectZones,
    spawns: paths.map((p) => p[0]),
    base,
  };
}

/**
 * Marche dirigée vers la droite depuis (0, startY) jusqu'à la colonne endX.
 * Si `stopOn` est fourni, la marche s'arrête dès qu'elle touche une de ces cases
 * (jonction avec le chemin principal) et vise le chemin principal à la colonne endX.
 */
function walkPath(rng: Rng, cfg: Cfg, startY: number, stopOn: Map<number, number> | null, endX: number): Vec2[] {
  const { width: W, height: H } = cfg;
  const cells: Vec2[] = [{ x: 0, y: startY }];
  let x = 0;
  let y = startY;
  const hit = () => stopOn !== null && stopOn.has(y * W + x);
  const push = () => {
    cells.push({ x, y });
    return hit();
  };

  while (x < endX) {
    let nx = Math.min(endX, x + rng.int(cfg.segmentLength[0], cfg.segmentLength[1]));
    if (endX - nx < 2) nx = endX;
    while (x < nx) {
      x++;
      if (push()) return cells;
    }
    let ny: number;
    if (x >= endX) {
      if (stopOn === null) break;
      // Jonction : on rejoint verticalement la case du chemin principal la plus proche dans cette colonne.
      let best = -1;
      for (let yy = 0; yy < H; yy++)
        if (stopOn.has(yy * W + x) && (best < 0 || Math.abs(yy - y) < Math.abs(best - y))) best = yy;
      if (best < 0) break; // ne devrait pas arriver : le chemin principal traverse chaque colonne
      ny = best;
    } else {
      const options: number[] = [];
      for (let yy = 1; yy < H - 1; yy++) if (Math.abs(yy - y) >= 2) options.push(yy);
      ny = rng.pick(options);
    }
    while (y !== ny) {
      y += ny > y ? 1 : -1;
      if (push()) return cells;
    }
  }
  return cells;
}

/** Distance de Tchebychev de chaque case à la case de chemin la plus proche (BFS à 8 voisins). */
function distanceToPath(terrain: Terrain[], W: number, H: number): number[] {
  const dist = new Array(W * H).fill(Infinity);
  const queue: number[] = [];
  terrain.forEach((t, i) => {
    if (t === 'path') {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const cx = i % W;
    const cy = Math.floor(i / W);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!inBounds({ width: W, height: H }, nx, ny)) continue;
        const n = cellIndex({ width: W }, nx, ny);
        if (dist[n] > dist[i] + 1) {
          dist[n] = dist[i] + 1;
          queue.push(n);
        }
      }
  }
  return dist;
}

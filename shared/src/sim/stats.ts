import { HERO_CONFIG, HERO_NODES, HeroStats } from '../config/game';
import { MAP_CONFIG } from '../config/map';
import { RANGE_UPGRADE, SYNERGIES, SYNERGY_RANGE, TOWERS, TowerStats, UpgradeNode } from '../config/towers';
import type { GameMap } from '../map/types';
import type { TowerState } from './types';

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Angle (radians) d'une orientation de 0 à 7. */
export const facingAngle = (facing: number) => (facing * Math.PI) / 4;

/** Une cible en (ex, ey) est-elle dans la zone de tir d'une tour en (tx, ty) ? Cercle, ligne ou cône. */
export function inShape(
  stats: Pick<TowerStats, 'shape' | 'range' | 'minRange' | 'beamWidth' | 'coneHalf'>,
  facing: number,
  tx: number,
  ty: number,
  ex: number,
  ey: number,
): boolean {
  const dx = ex - tx;
  const dy = ey - ty;
  const d = Math.hypot(dx, dy);
  if (d > stats.range || d < stats.minRange) return false;
  if (stats.shape === 'circle') return true;
  const a = facingAngle(facing);
  const fwd = dx * Math.cos(a) + dy * Math.sin(a);
  if (stats.shape === 'line') return fwd >= 0 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= stats.beamWidth;
  return d < 1e-6 || Math.acos(Math.max(-1, Math.min(1, fwd / d))) <= stats.coneHalf;
}

/** Orientation qui couvre le plus de cases de chemin depuis (x, y) : choisie à la pose, modifiable ensuite. */
export function bestFacing(map: GameMap, stats: TowerStats, x: number, y: number, high: boolean): number {
  if (stats.shape === 'circle') return 0;
  const st = { ...stats, range: stats.range * (high ? 1 + MAP_CONFIG.highGroundRangeBonus : 1) };
  let best = 0;
  let bestN = -1;
  for (let f = 0; f < 8; f++) {
    let n = 0;
    for (const path of map.paths) for (const p of path) if (inShape(st, f, x, y, p.x, p.y)) n++;
    if (n > bestN) {
      bestN = n;
      best = f;
    }
  }
  return best;
}

/** Stats d'une tour : base + nœuds choisis (sans usure, sans synergies). */
export function baseTowerStats(tower: Pick<TowerState, 'type' | 'path'> & { rangeLvl?: number }): TowerStats {
  const def = TOWERS[tower.type];
  let stats = { ...def.base };
  for (const id of tower.path) {
    const node = def.nodes.find((n) => n.id === id);
    if (node) stats = { ...stats, ...node.stats };
  }
  const lvl = tower.rangeLvl ?? 0;
  if (lvl > 0) {
    if (stats.range > 0) stats.range += lvl * RANGE_UPGRADE.bonus;
    else if (stats.auraRadius > 0) stats.auraRadius += lvl * RANGE_UPGRADE.bonus;
  }
  return stats;
}

/** Stats effectives : ajoute le bonus de hauteur et les synergies avec les tours voisines actives. */
export function effectiveTowerStats(tower: TowerState, towers: TowerState[], map: GameMap): TowerStats {
  const stats = baseTowerStats(tower);
  const slot = map.slots[tower.slotId];
  if (slot?.high) stats.range *= 1 + MAP_CONFIG.highGroundRangeBonus;
  for (const syn of SYNERGIES) {
    if (syn.tower !== tower.type) continue;
    const active = towers.some(
      (o) => o.id !== tower.id && o.hp > 0 && o.type === syn.neighbour && dist(o.x, o.y, tower.x, tower.y) <= SYNERGY_RANGE,
    );
    if (!active) continue;
    if (syn.damageMult) stats.damage *= syn.damageMult;
    if (syn.cooldownMult) stats.cooldown *= syn.cooldownMult;
    if (syn.rangeBonus) stats.range += syn.rangeBonus;
  }
  // Auras des relais voisins (cumulables, mais plafonnées pour que la pose de plusieurs relais ne casse pas le jeu).
  let aDamage = 0;
  let aRate = 0;
  let aReach = 0;
  for (const o of towers) {
    if (o.id === tower.id || o.hp <= 0 || o.type !== 'relais') continue;
    const os = baseTowerStats(o);
    if (os.auraRadius <= 0 || dist(o.x, o.y, tower.x, tower.y) > os.auraRadius) continue;
    aDamage += os.auraDamage;
    aRate += os.auraRate;
    aReach += os.auraReach;
  }
  if (aDamage) stats.damage *= 1 + Math.min(AURA_CAP.damage, aDamage);
  if (aRate) stats.cooldown *= 1 - Math.min(AURA_CAP.rate, aRate);
  if (aReach) stats.range += Math.min(AURA_CAP.reach, aReach);
  return stats;
}

/** Plafonds cumulés des auras de relais. */
export const AURA_CAP = { damage: 0.7, rate: 0.4, reach: 1.2 };

/** PV max actuels d'une tour, usure comprise. */
export const towerMaxHp = (tower: TowerState) => baseTowerStats(tower).maxHp * tower.maxHpFactor;

/** Améliorations qu'on peut acheter maintenant : les enfants du dernier nœud choisi. */
export function availableUpgrades(tower: Pick<TowerState, 'type' | 'path'>): UpgradeNode[] {
  const last = tower.path.length ? tower.path[tower.path.length - 1] : null;
  return TOWERS[tower.type].nodes.filter((n) => n.parent === last);
}

export function heroStats(upgrades: string[]): HeroStats {
  let stats: HeroStats = {
    maxHp: HERO_CONFIG.maxHp,
    speed: HERO_CONFIG.speed,
    repairRate: HERO_CONFIG.repairRate,
    repairRange: HERO_CONFIG.repairRange,
    carryCap: HERO_CONFIG.carryCap,
    repairCostMult: 1,
    wearMult: 1,
    harvestMult: 1,
  };
  for (const id of upgrades) {
    const node = HERO_NODES.find((n) => n.id === id);
    if (node) stats = { ...stats, ...node.stats };
  }
  return stats;
}

export function availableHeroUpgrades(upgrades: string[]) {
  const last = upgrades.length ? upgrades[upgrades.length - 1] : null;
  return HERO_NODES.filter((n) => n.parent === last);
}

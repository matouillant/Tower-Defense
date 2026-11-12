import { HERO_CONFIG, HERO_NODES, HeroStats } from '../config/game';
import { MAP_CONFIG } from '../config/map';
import { SYNERGIES, SYNERGY_RANGE, TOWERS, TowerStats, UpgradeNode } from '../config/towers';
import type { GameMap } from '../map/types';
import type { TowerState } from './types';

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Stats d'une tour : base + nœuds choisis (sans usure, sans synergies). */
export function baseTowerStats(tower: Pick<TowerState, 'type' | 'path'>): TowerStats {
  const def = TOWERS[tower.type];
  let stats = { ...def.base };
  for (const id of tower.path) {
    const node = def.nodes.find((n) => n.id === id);
    if (node) stats = { ...stats, ...node.stats };
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

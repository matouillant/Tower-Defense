/** Ennemis, boss et formules de montée en puissance des vagues infinies. */
export type EnemyTypeId = 'grunt' | 'runner' | 'brute' | 'bouclier' | 'colosse' | 'reine';

export interface EnemyDef {
  id: EnemyTypeId;
  name: string;
  hp: number;
  /** Bouclier : absorbe les dégâts avant les PV, sauf tirs perforants. */
  shield: number;
  /** Cases par seconde. */
  speed: number;
  /** Dégâts infligés aux tours (et au héros) à portée. */
  attack: number;
  attackRange: number;
  attackCooldown: number;
  /** Ressources lâchées à la mort. */
  bounty: number;
  /** Coût dans le budget de vague. */
  cost: number;
  /** Première vague où il peut apparaître. */
  fromWave: number;
  /** PV de base perdus s'il atteint la base. */
  leak: number;
  boss?: boolean;
  /** Boss : fait apparaître ce type d'ennemi toutes les `spawnEvery` secondes. */
  spawns?: EnemyTypeId;
  spawnEvery?: number;
}

export const ENEMIES: Record<EnemyTypeId, EnemyDef> = {
  grunt: { id: 'grunt', name: 'Fantassin', hp: 40, shield: 0, speed: 1.1, attack: 4, attackRange: 1.6, attackCooldown: 1.2, bounty: 5, cost: 2, fromWave: 1, leak: 1 },
  runner: { id: 'runner', name: 'Coureur', hp: 22, shield: 0, speed: 2.2, attack: 2, attackRange: 1.3, attackCooldown: 1, bounty: 4, cost: 2, fromWave: 3, leak: 1 },
  brute: { id: 'brute', name: 'Brute', hp: 160, shield: 0, speed: 0.7, attack: 14, attackRange: 1.8, attackCooldown: 1.5, bounty: 14, cost: 6, fromWave: 5, leak: 2 },
  bouclier: { id: 'bouclier', name: 'Porte-bouclier', hp: 60, shield: 80, speed: 0.95, attack: 6, attackRange: 1.6, attackCooldown: 1.2, bounty: 11, cost: 5, fromWave: 8, leak: 1 },
  colosse: { id: 'colosse', name: 'Colosse', hp: 1600, shield: 0, speed: 0.45, attack: 40, attackRange: 2.4, attackCooldown: 2, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true },
  reine: { id: 'reine', name: 'Reine de l’essaim', hp: 1100, shield: 300, speed: 0.6, attack: 15, attackRange: 2, attackCooldown: 1.5, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, spawns: 'runner', spawnEvery: 2.5 },
};

export const BOSS_POOL: EnemyTypeId[] = ['colosse', 'reine'];

export const WAVE_CONFIG = {
  /** Un boss toutes les X vagues. */
  bossEvery: 10,
  /** Budget de la vague n = baseBudget * budgetGrowth^(n-1). */
  baseBudget: 16,
  budgetGrowth: 1.13,
  /** PV des ennemis : hpGrowth^(n-1), puis croissance plus douce après softCapWave (rendements décroissants). */
  hpGrowth: 1.07,
  hpSoftCapWave: 40,
  hpGrowthAfterCap: 1.035,
  /** L'attaque des ennemis monte plus lentement que leurs PV. */
  attackGrowth: 1.03,
  attackMaxMult: 6,
  /** La prime ne suit qu'en partie la difficulté : les ressources deviennent rares, pas infinies. */
  bountyGrowth: 1.04,
  bountyMaxMult: 5,
  /** Garde-fou de performance : au-delà, le budget restant est converti en PV supplémentaires. */
  maxEnemiesPerWave: 60,
  /** Durée visée d'apparition d'une vague, et intervalle minimal entre deux ennemis. */
  spawnWindow: 22,
  minSpawnInterval: 0.25,
  /** Vague de boss : budget d'escorte réduit, PV du boss multipliés à chaque apparition. */
  bossEscortBudget: 0.5,
  bossHpGrowth: 1.9,
};

/** Multiplicateur de PV pour la vague n (n >= 1). */
export function hpMultiplier(wave: number, cfg = WAVE_CONFIG): number {
  const capped = Math.min(wave, cfg.hpSoftCapWave);
  const beyond = Math.max(0, wave - cfg.hpSoftCapWave);
  return Math.pow(cfg.hpGrowth, capped - 1) * Math.pow(cfg.hpGrowthAfterCap, beyond);
}
export const attackMultiplier = (wave: number, cfg = WAVE_CONFIG) =>
  Math.min(cfg.attackMaxMult, Math.pow(cfg.attackGrowth, wave - 1));
export const bountyMultiplier = (wave: number, cfg = WAVE_CONFIG) =>
  Math.min(cfg.bountyMaxMult, Math.pow(cfg.bountyGrowth, wave - 1));
export const waveBudget = (wave: number, cfg = WAVE_CONFIG) =>
  cfg.baseBudget * Math.pow(cfg.budgetGrowth, wave - 1);
export const isBossWave = (wave: number, cfg = WAVE_CONFIG) => wave > 0 && wave % cfg.bossEvery === 0;

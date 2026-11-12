/** Ennemis, boss et formules de montée en puissance des vagues infinies. */
export type EnemyTypeId =
  | 'grunt' | 'runner' | 'essaim' | 'brute' | 'bouclier' | 'artilleur' | 'sapeur' | 'soigneur' | 'blinde' | 'golem'
  | 'colosse' | 'reine' | 'sentinelle';

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
  /** Taille à l'écran, en cases. */
  size: number;
  /** Poids dans le tirage de la composition d'une vague (1 par défaut). */
  weight?: number;
  /** Armure : retire ce nombre de points à chaque coup (au moins 25 % des dégâts passent). Ignorée par les tirs perforants et les brûlures. */
  armor?: number;
  /** S'arrête dès qu'une cible est à portée, au lieu de continuer à avancer (tireurs, boss d'artillerie). */
  halts?: boolean;
  /** Kamikaze : explose au contact d'une cible, avec ce rayon, et ne rapporte rien. */
  blast?: number;
  /** Soigne les ennemis proches : `pct` de leurs PV max toutes les `every` secondes. */
  heals?: { radius: number; pct: number; every: number };
  /** Description courte, affichée dans le bestiaire. */
  desc: string;
  /** PV de base perdus s'il atteint la base. */
  leak: number;
  boss?: boolean;
  /** Boss : fait apparaître ce type d'ennemi toutes les `spawnEvery` secondes. */
  spawns?: EnemyTypeId;
  spawnEvery?: number;
}

export const ENEMIES: Record<EnemyTypeId, EnemyDef> = {
  grunt: { id: 'grunt', name: 'Fantassin', desc: 'Le soldat de base.', hp: 48, shield: 0, speed: 1.15, attack: 5, attackRange: 1.6, attackCooldown: 1.2, bounty: 5, cost: 2, fromWave: 1, leak: 1, size: 0.82, weight: 3 },
  runner: { id: 'runner', name: 'Coureur', desc: 'Rapide et fragile.', hp: 22, shield: 0, speed: 2.2, attack: 3, attackRange: 1.3, attackCooldown: 1, bounty: 4, cost: 2, fromWave: 2, leak: 1, size: 0.86, weight: 2 },
  essaim: { id: 'essaim', name: 'Nuée', desc: 'Minuscule, très nombreux, vite arrivé à la base.', hp: 13, shield: 0, speed: 1.9, attack: 2, attackRange: 1.1, attackCooldown: 0.8, bounty: 2, cost: 1, fromWave: 3, leak: 1, size: 0.5, weight: 4 },
  brute: { id: 'brute', name: 'Brute', desc: 'Lente, résistante, frappe fort.', hp: 160, shield: 0, speed: 0.7, attack: 18, attackRange: 1.8, attackCooldown: 1.5, bounty: 14, cost: 6, fromWave: 4, leak: 2, size: 1.05 },
  artilleur: { id: 'artilleur', name: 'Artilleur', desc: 'Tire de loin sur les tours et s’arrête pour le faire.', hp: 44, shield: 0, speed: 0.9, attack: 12, attackRange: 4.2, attackCooldown: 2.2, bounty: 13, cost: 6, fromWave: 5, leak: 1, size: 0.92, halts: true },
  sapeur: { id: 'sapeur', name: 'Sapeur', desc: 'Court vers une tour et explose en zone.', hp: 34, shield: 0, speed: 1.55, attack: 34, attackRange: 1.3, attackCooldown: 0.5, bounty: 0, cost: 5, fromWave: 6, leak: 1, size: 0.8, blast: 1.2 },
  bouclier: { id: 'bouclier', name: 'Porte-bouclier', desc: 'Un bouclier d’énergie absorbe les dégâts avant ses PV.', hp: 60, shield: 80, speed: 0.95, attack: 6, attackRange: 1.6, attackCooldown: 1.2, bounty: 11, cost: 5, fromWave: 7, leak: 1, size: 0.95 },
  soigneur: { id: 'soigneur', name: 'Soigneur', desc: 'Soigne les ennemis autour de lui : à abattre en priorité.', hp: 72, shield: 0, speed: 0.9, attack: 3, attackRange: 1.4, attackCooldown: 1.5, bounty: 14, cost: 6, fromWave: 8, leak: 1, size: 0.92, heals: { radius: 2.3, pct: 0.1, every: 2 } },
  blinde: { id: 'blinde', name: 'Blindé', desc: 'Armure lourde : les petits calibres rebondissent.', hp: 230, shield: 0, speed: 0.8, attack: 14, attackRange: 1.7, attackCooldown: 1.4, bounty: 16, cost: 9, fromWave: 10, leak: 2, size: 1.12, armor: 8 },
  golem: { id: 'golem', name: 'Golem', desc: 'Un mur de roche qui avance. Énormément de PV.', hp: 420, shield: 0, speed: 0.5, attack: 30, attackRange: 2.0, attackCooldown: 2, bounty: 32, cost: 14, fromWave: 12, leak: 4, size: 1.45 },
  colosse: { id: 'colosse', name: 'Colosse', desc: 'Boss : une masse de métal.', hp: 1600, shield: 0, speed: 0.45, attack: 40, attackRange: 2.4, attackCooldown: 2, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, size: 1.9 },
  reine: { id: 'reine', name: 'Reine de l’essaim', desc: 'Boss : bouclier, et fait naître des coureurs.', hp: 1100, shield: 300, speed: 0.6, attack: 15, attackRange: 2, attackCooldown: 1.5, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, spawns: 'runner', spawnEvery: 2.5, size: 1.8 },
  sentinelle: { id: 'sentinelle', name: 'Sentinelle', desc: 'Boss : armurée, canon à très longue portée, s’arrête pour tirer.', hp: 1300, shield: 0, speed: 0.4, attack: 26, attackRange: 5.2, attackCooldown: 2.4, bounty: 150, cost: 0, fromWave: 0, leak: 10, boss: true, armor: 6, halts: true, size: 1.85 },
};

export const BOSS_POOL: EnemyTypeId[] = ['colosse', 'reine', 'sentinelle'];

export const WAVE_CONFIG = {
  /** Un boss toutes les X vagues. */
  bossEvery: 10,
  /** Budget de la vague n = baseBudget * budgetGrowth^(n-1). */
  baseBudget: 36,
  budgetGrowth: 1.15,
  /** PV des ennemis : hpGrowth^(n-1), puis croissance plus douce après softCapWave (rendements décroissants). */
  hpGrowth: 1.1,
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
  /** Un tireur ne s'arrête que ce temps (en secondes) : ensuite il avance en tirant, pour qu'une vague ne reste jamais bloquée. */
  haltMax: 8,
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
/** Niveaux de difficulté : plus d'ennemis (budget) et plus de PV, avec un écart qui se creuse au fil des vagues. */
export type Difficulty = 'normal' | 'difficile' | 'cauchemar';
export const DIFFICULTIES: Record<Difficulty, { name: string; desc: string; budget: number; hp: number; hpPerWave: number }> = {
  normal: { name: 'Normal', desc: 'Pour découvrir le jeu.', budget: 0.75, hp: 0.85, hpPerWave: 1 },
  difficile: { name: 'Difficile', desc: 'Vagues nombreuses et coriaces : il faut une vraie stratégie.', budget: 1, hp: 1, hpPerWave: 1.01 },
  cauchemar: { name: 'Cauchemar', desc: 'Pour les stratèges aguerris : chaque erreur coûte cher.', budget: 1.3, hp: 1.25, hpPerWave: 1.03 },
};
export const difficultyHp = (d: Difficulty, wave: number) => DIFFICULTIES[d].hp * Math.pow(DIFFICULTIES[d].hpPerWave, Math.max(0, wave - 1));

export const isBossWave = (wave: number, cfg = WAVE_CONFIG) => wave > 0 && wave % cfg.bossEvery === 0;

/** Règles générales, économie, héros, compétences et récompenses. */
export const GAME_CONFIG = {
  tickRate: 20,
  /** Rythme de base : 1 seconde réelle = 1,2 seconde de jeu (avant le choix x1,5 / x2 / x3). */
  gameSpeed: 1.2,
  snapshotRate: 10,
  baseHp: 15,
  startScrap: 160,
  prepDuration: 30,
  interDuration: 20,

  // --- Économie : une seule ressource pour construire, améliorer et réparer ---
  /** Part de la prime versée directement au stock ; le reste tombe au sol et doit être ramassé. */
  directBountyShare: 0.4,
  pickupTtl: 14,
  pickupRadius: 0.8,
  /** Réparer 100 % d'une tour coûte cette part de tout ce qui a été investi dedans. */
  repairCostRatio: 0.8,
  /** Usure : réparer 100 % des PV retire cette part des PV max, définitivement. */
  wearPerFullRepair: 0.06,
  minMaxHpFactor: 0.5,
  /** Pendant une vague, la réparation rapide ne remonte pas au-delà de ce seuil. */
  quickRepairCap: 0.7,
  /** Vente d'urgence par le stratège : part de l'investissement, modulée par l'état de la tour. */
  sellRatio: 0.5,
  /** Recyclage par le héros : meilleur rendement, mais il doit se déplacer. */
  recycleRatio: 0.7,
  recycleTime: 3,
  /** Respécialisation : rembourse cette part des améliorations, et coûte un forfait. */
  respecRefund: 0.6,
  respecCost: 30,
  /** Déplacer une tour : part de l'investissement, puis tour inactive quelques secondes. */
  moveCostRatio: 0.25,
  moveDisable: 5,
  reloadTime: 2,
  /** Coût d'une recharge complète, en part du prix de base de la tour. */
  reloadCostRatio: 0.25,

  // --- Gisements et prospection ---
  depositStock: 60,
  depositRegenPerWave: 25,
  harvestTime: 2,
  harvestAmount: 15,
  prospectTime: 6,
  prospectCooldownWaves: 3,
  prospectSuccessChance: 0.7,
  /** Gain = prospectBase + prospectPerWave * vague. */
  prospectBase: 60,
  prospectPerWave: 8,
  prospectFailDamage: 45,

  // --- Synchronisation / reprise par l'IA ---
  reconnectGrace: 45,
};

export const HERO_CONFIG = {
  maxHp: 100,
  speed: 3.6,
  repairRate: 28,
  repairRange: 1.5,
  carryCap: 60,
  respawnTime: 8,
  /** Coût de la remise en route du héros : reviveBase + revivePerWave × vague, payé sur le stock commun. */
  reviveBase: 30,
  revivePerWave: 5,
  /** Régénération près de la base. */
  baseRegen: 12,
  baseRadius: 1.5,
  /** Blaster de base : faible, mais le héros n'est plus sans défense. */
  damage: 6,
  attackRange: 2.5,
  attackCooldown: 0.9,
};

export interface HeroStats {
  maxHp: number;
  speed: number;
  repairRate: number;
  repairRange: number;
  carryCap: number;
  /** Multiplicateur du coût des réparations faites par le héros. */
  repairCostMult: number;
  /** Multiplicateur de l'usure causée par ses réparations. */
  wearMult: number;
  harvestMult: number;
  /** Blaster du héros : tire tout seul sur l'ennemi le plus proche, même en travaillant. */
  damage: number;
  attackRange: number;
  attackCooldown: number;
  /** Zone d'explosion du tir (0 = cible unique). */
  attackSplash: number;
  /** Régénération permanente (PV/s), où qu'il soit. */
  regen: number;
}

export interface HeroNode {
  id: string;
  name: string;
  desc: string;
  cost: number;
  parent: string | null;
  stats: Partial<HeroStats>;
}

/** Arbre du héros : les branches sœurs sont exclusives, comme pour les tours. */
export const HERO_NODES: HeroNode[] = [
  { id: 'sprinteur', name: 'Sprinteur', desc: 'Vitesse +35 %.', cost: 80, parent: null, stats: { speed: 4.9 } },
  { id: 'bras-long', name: 'Bras long', desc: 'Répare à distance (3,5 cases).', cost: 80, parent: null, stats: { repairRange: 3.5 } },
  { id: 'econome', name: 'Économe', desc: 'Réparations -30 % moins chères, mais plus lentes.', cost: 80, parent: null, stats: { repairCostMult: 0.7, repairRate: 20 } },
  { id: 'porteur', name: 'Porteur', desc: 'Capacité de port doublée.', cost: 120, parent: 'sprinteur', stats: { carryCap: 120 } },
  { id: 'insaisissable', name: 'Insaisissable', desc: 'Encore plus rapide et plus résistant.', cost: 130, parent: 'sprinteur', stats: { speed: 5.8, maxHp: 140 } },
  { id: 'soudeur', name: 'Soudeur', desc: 'Réparation à distance deux fois plus rapide.', cost: 130, parent: 'bras-long', stats: { repairRate: 56 } },
  { id: 'telecommande', name: 'Télécommande', desc: 'Portée de réparation de 6 cases.', cost: 120, parent: 'bras-long', stats: { repairRange: 6 } },
  { id: 'artisan', name: 'Artisan', desc: 'Ses réparations n’usent presque plus les tours.', cost: 130, parent: 'econome', stats: { wearMult: 0.3 } },
  { id: 'ferrailleur', name: 'Ferrailleur', desc: 'Récolte deux fois plus sur les gisements.', cost: 110, parent: 'econome', stats: { harvestMult: 2 } },
  // Niveau 3 de chaque voie.
  { id: 'mule', name: 'Mule blindée', desc: 'Porte 200 et encaisse mieux (180 PV).', cost: 180, parent: 'porteur', stats: { carryCap: 200, maxHp: 180 } },
  { id: 'jetpack', name: 'Réacteurs dorsaux', desc: 'Vitesse 7, 200 PV, se régénère partout.', cost: 200, parent: 'insaisissable', stats: { speed: 7, maxHp: 200, regen: 3 } },
  { id: 'nanobots', name: 'Nanobots', desc: 'Réparation à distance ultra-rapide (90 PV/s).', cost: 200, parent: 'soudeur', stats: { repairRate: 90 } },
  { id: 'drone', name: 'Drone de réparation', desc: 'Répare jusqu’à 9 cases de distance.', cost: 180, parent: 'telecommande', stats: { repairRange: 9 } },
  { id: 'maitre-artisan', name: 'Maître artisan', desc: 'Réparations moitié prix et sans aucune usure.', cost: 190, parent: 'artisan', stats: { wearMult: 0, repairCostMult: 0.5 } },
  { id: 'excavatrice', name: 'Excavatrice', desc: 'Récolte 3,5 fois plus sur les gisements.', cost: 180, parent: 'ferrailleur', stats: { harvestMult: 3.5 } },
  // Voie combat : le blaster de base devient une vraie arme.
  { id: 'tireur', name: 'Tireur', desc: 'Blaster renforcé : dégâts ×3, portée 3,5.', cost: 90, parent: null, stats: { damage: 18, attackRange: 3.5 } },
  { id: 'elite', name: 'Tireur d’élite', desc: 'Gros dégâts à longue portée (45, portée 5).', cost: 140, parent: 'tireur', stats: { damage: 45, attackRange: 5, attackCooldown: 1.1 } },
  { id: 'mitrailleur', name: 'Mitrailleur', desc: 'Tire très vite (4 tirs/s).', cost: 140, parent: 'tireur', stats: { damage: 14, attackCooldown: 0.25 } },
  { id: 'canon-epaule', name: 'Canon d’épaule', desc: 'Obus explosifs (90, zone 1,3).', cost: 220, parent: 'elite', stats: { damage: 90, attackRange: 5, attackSplash: 1.3, attackCooldown: 1.4 } },
  { id: 'gatling', name: 'Gatling', desc: '6 tirs/s et 160 PV.', cost: 220, parent: 'mitrailleur', stats: { damage: 20, attackCooldown: 0.16, maxHp: 160 } },
];

export type AbilityId = 'ralentir' | 'foudre' | 'surcharge';
export const ABILITIES: Record<AbilityId, { name: string; desc: string; cooldown: number; radius: number; duration: number; power: number; powerPerWave: number }> = {
  ralentir: { name: 'Ralentir', desc: 'Ralentit de 50 % une zone pendant 5 s.', cooldown: 25, radius: 2.5, duration: 5, power: 0.5, powerPerWave: 0 },
  foudre: { name: 'Foudre', desc: 'Dégâts de zone immédiats.', cooldown: 20, radius: 1.5, duration: 0, power: 80, powerPerWave: 12 },
  surcharge: { name: 'Surcharge', desc: 'Une tour tire deux fois plus fort pendant 8 s, mais s’abîme.', cooldown: 30, radius: 0, duration: 8, power: 2, powerPerWave: 0 },
};
/** PV perdus par seconde par une tour en surcharge, en part de ses PV max. */
export const OVERCHARGE_SELF_DAMAGE = 0.04;

export type RewardId = 'butin' | 'remise-a-neuf' | 'renfort' | 'tactique';
export const REWARDS: Record<RewardId, { name: string; desc: string }> = {
  butin: { name: 'Butin', desc: 'Un gros apport de ressources.' },
  'remise-a-neuf': { name: 'Remise à neuf', desc: 'Toutes les tours réparées gratuitement, sans usure.' },
  renfort: { name: 'Renfort', desc: 'Efface l’usure de toutes les tours.' },
  tactique: { name: 'Entraînement', desc: 'Le blaster du héros fait +25 % de dégâts, définitivement.' },
};
/** Prime de fin de vague : croît avec la vague (vague 1 : 28, vague 10 : 100, vague 20 : 180). */
export const WAVE_END_BONUS = { base: 20, perWave: 8 };
export const waveEndBonus = (wave: number) => WAVE_END_BONUS.base + WAVE_END_BONUS.perWave * wave;
export const REWARD_SCRAP_BASE = 150;
export const REWARD_SCRAP_PER_WAVE = 10;

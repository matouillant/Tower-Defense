/**
 * Tours et arbres d'amélioration. Données d'équilibrage pures : modifier ici, pas dans le code.
 * Distances en cases, temps en secondes.
 */
export type TowerTypeId = 'canon' | 'givre' | 'baliste';

export interface TowerStats {
  maxHp: number;
  damage: number;
  range: number;
  /** Portée minimale : ne peut pas viser plus près (0 = aucune). */
  minRange: number;
  /** Temps entre deux tirs. */
  cooldown: number;
  /** Rayon des dégâts de zone (0 = cible unique). */
  splash: number;
  /** Ralentissement appliqué : 0.3 = -30 % de vitesse (0 = aucun). */
  slow: number;
  slowDuration: number;
  /** Dégâts par seconde sur la durée (0 = aucun). */
  dot: number;
  dotDuration: number;
  /** Ignore les boucliers ennemis. */
  pierceShield: boolean;
  /** Munitions max (0 = illimitées). Le héros recharge. */
  ammo: number;
  /** Multiplicateur du coût de réparation : les voies puissantes coûtent cher à entretenir. */
  repairCostMult: number;
}

export interface UpgradeNode {
  id: string;
  name: string;
  desc: string;
  cost: number;
  /** Nœud parent (null = niveau 2, directement sous la tour de base). Les nœuds frères sont exclusifs. */
  parent: string | null;
  /** Valeurs qui remplacent celles du niveau précédent. */
  stats: Partial<TowerStats>;
}

export interface TowerDef {
  id: TowerTypeId;
  name: string;
  desc: string;
  cost: number;
  base: TowerStats;
  nodes: UpgradeNode[];
}

const base = (s: Partial<TowerStats>): TowerStats => ({
  maxHp: 100,
  damage: 10,
  range: 3,
  minRange: 0,
  cooldown: 1,
  splash: 0,
  slow: 0,
  slowDuration: 0,
  dot: 0,
  dotDuration: 0,
  pierceShield: false,
  ammo: 0,
  repairCostMult: 1,
  ...s,
});

export const TOWERS: Record<TowerTypeId, TowerDef> = {
  canon: {
    id: 'canon',
    name: 'Canon',
    desc: 'Tour polyvalente.',
    cost: 50,
    base: base({ maxHp: 120, damage: 12, range: 3.2, cooldown: 0.9 }),
    nodes: [
      { id: 'artillerie', name: 'Artillerie', desc: 'Dégâts de zone, cadence lente.', cost: 60, parent: null, stats: { damage: 16, splash: 1.2, cooldown: 1.6 } },
      { id: 'precision', name: 'Précision', desc: 'Gros dégâts sur une cible, longue portée.', cost: 60, parent: null, stats: { damage: 42, range: 5, cooldown: 1.8 } },
      { id: 'rafale', name: 'Rafale', desc: 'Cadence très haute, courte portée.', cost: 60, parent: null, stats: { damage: 7, range: 2.5, cooldown: 0.25 } },
      { id: 'explosive', name: 'Explosive', desc: 'Zone élargie, mais réparation deux fois plus chère.', cost: 120, parent: 'artillerie', stats: { damage: 30, splash: 1.8, repairCostMult: 2 } },
      { id: 'incendiaire', name: 'Incendiaire', desc: 'Brûle sur la durée et ignore les boucliers.', cost: 110, parent: 'artillerie', stats: { dot: 10, dotDuration: 4, pierceShield: true } },
      { id: 'mortier', name: 'Mortier', desc: 'Portée énorme, mais aveugle de près.', cost: 110, parent: 'artillerie', stats: { damage: 34, range: 7, minRange: 2.5, cooldown: 2.2 } },
      { id: 'perforant', name: 'Perforant', desc: 'Ignore les boucliers. Fragile.', cost: 110, parent: 'precision', stats: { damage: 70, pierceShield: true, maxHp: 80 } },
      { id: 'chasseur', name: 'Chasseur', desc: 'Dégâts massifs, très lent, cher à réparer.', cost: 130, parent: 'precision', stats: { damage: 160, cooldown: 3.2, repairCostMult: 1.6 } },
      { id: 'mitrailleuse', name: 'Mitrailleuse', desc: 'Cadence extrême, mais consomme des munitions.', cost: 110, parent: 'rafale', stats: { damage: 9, cooldown: 0.12, ammo: 400 } },
      { id: 'blindee', name: 'Blindée', desc: 'Robuste et économique à réparer, frappe moins fort.', cost: 90, parent: 'rafale', stats: { maxHp: 320, damage: 8, repairCostMult: 0.6 } },
    ],
  },
  givre: {
    id: 'givre',
    name: 'Givre',
    desc: 'Ralentit les ennemis, peu de dégâts.',
    cost: 60,
    base: base({ maxHp: 90, damage: 4, range: 2.8, cooldown: 1.1, slow: 0.3, slowDuration: 1.5 }),
    nodes: [
      { id: 'blizzard', name: 'Blizzard', desc: 'Ralentit toute une zone.', cost: 70, parent: null, stats: { splash: 1.5, slow: 0.35, slowDuration: 2 } },
      { id: 'glace-vive', name: 'Glace vive', desc: 'Ralentissement fort sur une cible, avec des dégâts.', cost: 70, parent: null, stats: { damage: 22, slow: 0.55, slowDuration: 2.5 } },
      { id: 'tempete', name: 'Tempête', desc: 'Zone immense. Très fragile.', cost: 120, parent: 'blizzard', stats: { splash: 2.4, range: 3.4, maxHp: 60 } },
      { id: 'permafrost', name: 'Permafrost', desc: 'Ralentissement plus long, tour robuste.', cost: 100, parent: 'blizzard', stats: { slowDuration: 4, maxHp: 180, repairCostMult: 0.7 } },
      { id: 'eclat', name: 'Éclat', desc: 'Gros dégâts de glace, cher à réparer.', cost: 120, parent: 'glace-vive', stats: { damage: 60, repairCostMult: 1.8 } },
      { id: 'entrave', name: 'Entrave', desc: 'Immobilise presque la cible.', cost: 110, parent: 'glace-vive', stats: { slow: 0.8, slowDuration: 2, cooldown: 1.6 } },
    ],
  },
  baliste: {
    id: 'baliste',
    name: 'Baliste',
    desc: 'Très puissante, mais à munitions limitées : le héros doit la recharger.',
    cost: 80,
    base: base({ maxHp: 100, damage: 55, range: 4.5, cooldown: 1.5, ammo: 24 }),
    nodes: [
      { id: 'lourde', name: 'Lourde', desc: 'Dégâts doublés, moins de munitions.', cost: 80, parent: null, stats: { damage: 120, ammo: 14, cooldown: 2 } },
      { id: 'repetition', name: 'À répétition', desc: 'Tir rapide, grande réserve.', cost: 80, parent: null, stats: { damage: 40, cooldown: 0.7, ammo: 50 } },
      { id: 'siege', name: 'De siège', desc: 'Tueuse de boss. Réparation très chère.', cost: 140, parent: 'lourde', stats: { damage: 320, cooldown: 3, ammo: 10, repairCostMult: 2 } },
      { id: 'eclats', name: 'À éclats', desc: 'Le carreau explose en zone.', cost: 120, parent: 'lourde', stats: { splash: 1.4 } },
      { id: 'autonome', name: 'Autonome', desc: 'Munitions illimitées, dégâts réduits.', cost: 130, parent: 'repetition', stats: { damage: 28, ammo: 0 } },
      { id: 'harpon', name: 'Harpon', desc: 'Ralentit la cible touchée.', cost: 110, parent: 'repetition', stats: { slow: 0.4, slowDuration: 1.5 } },
    ],
  },
};

/** Synergies entre tours voisines (distance <= synergyRange). */
export const SYNERGY_RANGE = 1.5;
export interface Synergy {
  /** La tour qui reçoit le bonus. */
  tower: TowerTypeId;
  /** Le type de voisine qui le déclenche. */
  neighbour: TowerTypeId;
  damageMult?: number;
  cooldownMult?: number;
  rangeBonus?: number;
  desc: string;
}
export const SYNERGIES: Synergy[] = [
  { tower: 'canon', neighbour: 'givre', damageMult: 1.2, desc: 'Canon près d’un Givre : +20 % de dégâts.' },
  { tower: 'canon', neighbour: 'canon', cooldownMult: 0.92, desc: 'Deux Canons voisins : cadence +8 %.' },
  { tower: 'baliste', neighbour: 'canon', rangeBonus: 0.5, desc: 'Baliste près d’un Canon : +0,5 de portée.' },
  { tower: 'givre', neighbour: 'givre', rangeBonus: 0.4, desc: 'Deux Givres voisins : +0,4 de portée.' },
];

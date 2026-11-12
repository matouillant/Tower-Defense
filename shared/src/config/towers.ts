/**
 * Tours et arbres d'amélioration. Données d'équilibrage pures : modifier ici, pas dans le code.
 * Distances en cases, temps en secondes.
 */
export type TowerTypeId = 'canon' | 'givre' | 'baliste' | 'foudre' | 'laser' | 'relais' | 'depot';

/** Amélioration de portée : indépendante de l'arbre, achetable sur toute tour (rayon d'aura pour le relais). */
export const RANGE_UPGRADE = { maxLevel: 3, bonus: 0.5, costRatios: [0.5, 0.8, 1.1] };
export const rangeUpgradeCost = (type: TowerTypeId, level: number) =>
  Math.max(5, Math.round((TOWERS[type].cost * (RANGE_UPGRADE.costRatios[level] ?? 1.1)) / 5) * 5);

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
  /** Foudre : nombre de rebonds sur d'autres ennemis, distance maximale d'un rebond, et part des dégâts conservée à chaque rebond. */
  chain: number;
  chainRange: number;
  chainFalloff: number;
  /** Rayon : chaque tir de suite sur la même cible ajoute `ramp` (en part des dégâts), jusqu'à `rampMax` fois. */
  ramp: number;
  rampMax: number;
  /** Coups critiques : chance (0..1) et multiplicateur de dégâts. */
  critChance: number;
  critMult: number;
  /** Relais : les tours voisines (dans `auraRadius`) gagnent des dégâts (+part), de la cadence (-part du délai), de la portée, et des PV par seconde. */
  auraRadius: number;
  auraDamage: number;
  auraRate: number;
  auraReach: number;
  auraHeal: number;
  /** Ressources produites par seconde, sans rien tirer. */
  income: number;
  /** Forme de la zone de tir : cercle, ligne droite (le tir transperce tout ce qui s'y trouve) ou cône. */
  shape: 'circle' | 'line' | 'cone';
  /** Ligne : demi-largeur du faisceau, en cases. */
  beamWidth: number;
  /** Cône : demi-angle d'ouverture, en radians. */
  coneHalf: number;
  /** Point de dépôt pour le héros (dépôt avancé). */
  dropOff: boolean;
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
  chain: 0,
  chainRange: 0,
  chainFalloff: 0.75,
  ramp: 0,
  rampMax: 0,
  critChance: 0,
  critMult: 1,
  auraRadius: 0,
  auraDamage: 0,
  auraRate: 0,
  auraReach: 0,
  auraHeal: 0,
  income: 0,
  shape: 'circle',
  beamWidth: 0.6,
  coneHalf: 0.8,
  dropOff: false,
  ...s,
});

export const TOWERS: Record<TowerTypeId, TowerDef> = {
  canon: {
    id: 'canon',
    name: 'Canon à plasma',
    desc: 'Tourelle polyvalente.',
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
      // Niveau 4
      { id: 'thermobare', name: 'Thermobare', desc: 'Souffle dévastateur sur une grande zone. Réparation très chère.', cost: 170, parent: 'explosive', stats: { damage: 58, splash: 2.4, cooldown: 2.2, repairCostMult: 2.5 } },
      { id: 'brasier', name: 'Brasier', desc: 'Brûlure intense sur une grande zone, ignore les boucliers.', cost: 150, parent: 'incendiaire', stats: { dot: 24, dotDuration: 5, splash: 1.5 } },
      { id: 'saturation', name: 'Saturation', desc: 'Pilonne une large zone, de très loin.', cost: 150, parent: 'mortier', stats: { damage: 36, splash: 1.7, range: 8, cooldown: 1.7 } },
      { id: 'elite', name: 'Tireur d’élite', desc: 'Tir perforant, 30 % de coups critiques (x3).', cost: 160, parent: 'perforant', stats: { damage: 110, critChance: 0.3, critMult: 3, range: 6 } },
      { id: 'executeur', name: 'Exécuteur', desc: 'Tir énorme, 40 % de coups critiques (x2).', cost: 170, parent: 'chasseur', stats: { damage: 250, cooldown: 3.8, critChance: 0.4, critMult: 2, repairCostMult: 1.8 } },
      { id: 'tempete-plomb', name: 'Tempête de plomb', desc: 'Cadence démentielle, grosse réserve de munitions.', cost: 150, parent: 'mitrailleuse', stats: { damage: 11, cooldown: 0.08, ammo: 700 } },
      { id: 'forteresse', name: 'Forteresse', desc: 'Presque indestructible et très économique à réparer.', cost: 130, parent: 'blindee', stats: { maxHp: 600, damage: 10, range: 3, repairCostMult: 0.45 } },
    ],
  },
  givre: {
    id: 'givre',
    name: 'Émetteur cryo',
    desc: 'Souffle un cône de froid : ralentit les ennemis, peu de dégâts.',
    cost: 60,
    base: base({ maxHp: 90, damage: 4, range: 3.4, cooldown: 1.1, slow: 0.3, slowDuration: 1.5, shape: 'cone', coneHalf: 0.8 }),
    nodes: [
      { id: 'blizzard', name: 'Blizzard', desc: 'Ralentit toute une zone.', cost: 70, parent: null, stats: { splash: 1.5, slow: 0.35, slowDuration: 2 } },
      { id: 'glace-vive', name: 'Glace vive', desc: 'Ralentissement fort sur une cible, avec des dégâts.', cost: 70, parent: null, stats: { damage: 22, slow: 0.55, slowDuration: 2.5 } },
      { id: 'tempete', name: 'Tempête', desc: 'Zone immense. Très fragile.', cost: 120, parent: 'blizzard', stats: { splash: 2.4, range: 3.4, maxHp: 60 } },
      { id: 'permafrost', name: 'Permafrost', desc: 'Ralentissement plus long, tour robuste.', cost: 100, parent: 'blizzard', stats: { slowDuration: 4, maxHp: 180, repairCostMult: 0.7 } },
      { id: 'eclat', name: 'Éclat', desc: 'Gros dégâts de glace, cher à réparer.', cost: 120, parent: 'glace-vive', stats: { damage: 60, repairCostMult: 1.8 } },
      { id: 'entrave', name: 'Entrave', desc: 'Immobilise presque la cible.', cost: 110, parent: 'glace-vive', stats: { slow: 0.8, slowDuration: 2, cooldown: 1.6 } },
      { id: 'gel-toxique', name: 'Gel toxique', desc: 'Givre corrosif : ralentit et brûle sur la durée.', cost: 70, parent: null, stats: { damage: 6, slow: 0.3, slowDuration: 2, dot: 8, dotDuration: 5, splash: 0.9 } },
      { id: 'corrosion', name: 'Corrosion', desc: 'Acide plus fort, ignore boucliers et armures.', cost: 110, parent: 'gel-toxique', stats: { dot: 18, dotDuration: 5, pierceShield: true } },
      { id: 'contagion', name: 'Contagion', desc: 'Zone plus large et plus de portée, effets plus légers.', cost: 110, parent: 'gel-toxique', stats: { splash: 1.8, dot: 10, range: 3.2 } },
      // Niveau 4
      { id: 'age-glaciaire', name: 'Âge glaciaire', desc: 'Zone gigantesque, fort ralentissement.', cost: 160, parent: 'tempete', stats: { splash: 3.2, slow: 0.5, slowDuration: 3, range: 3.6, damage: 8 } },
      { id: 'cryostase', name: 'Cryostase', desc: 'Ralentit énormément et longtemps. Tour robuste.', cost: 140, parent: 'permafrost', stats: { slow: 0.65, slowDuration: 5, maxHp: 240 } },
      { id: 'zero-absolu', name: 'Zéro absolu', desc: 'Dégâts de glace perforants. Réparation très chère.', cost: 170, parent: 'eclat', stats: { damage: 130, slow: 0.6, pierceShield: true, repairCostMult: 2.2 } },
      { id: 'stase', name: 'Stase', desc: 'Quasi-arrêt de toute une zone pendant un instant.', cost: 150, parent: 'entrave', stats: { slow: 0.95, slowDuration: 1.3, cooldown: 2.2, splash: 1.1 } },
      { id: 'necrose', name: 'Nécrose', desc: 'Une brûlure dévorante qui ronge même les blindés.', cost: 150, parent: 'corrosion', stats: { dot: 40, dotDuration: 6 } },
    ],
  },
  baliste: {
    id: 'baliste',
    name: 'Canon à rails',
    desc: 'Tire en ligne droite et transperce tout ce qui s’y trouve ; munitions limitées, le héros doit la recharger.',
    cost: 80,
    base: base({ maxHp: 100, damage: 55, range: 5, cooldown: 1.5, ammo: 24, shape: 'line', beamWidth: 0.6 }),
    nodes: [
      { id: 'lourde', name: 'Lourde', desc: 'Dégâts doublés, moins de munitions.', cost: 80, parent: null, stats: { damage: 120, ammo: 14, cooldown: 2 } },
      { id: 'repetition', name: 'À répétition', desc: 'Tir rapide, grande réserve.', cost: 80, parent: null, stats: { damage: 40, cooldown: 0.7, ammo: 50 } },
      { id: 'siege', name: 'De siège', desc: 'Tueuse de boss. Réparation très chère.', cost: 140, parent: 'lourde', stats: { damage: 320, cooldown: 3, ammo: 10, repairCostMult: 2 } },
      { id: 'eclats', name: 'À éclats', desc: 'Le carreau explose en zone.', cost: 120, parent: 'lourde', stats: { splash: 1.4 } },
      { id: 'autonome', name: 'Autonome', desc: 'Munitions illimitées, dégâts réduits.', cost: 130, parent: 'repetition', stats: { damage: 28, ammo: 0 } },
      { id: 'harpon', name: 'Harpon', desc: 'Ralentit la cible touchée.', cost: 110, parent: 'repetition', stats: { slow: 0.4, slowDuration: 1.5 } },
      { id: 'perforatrice', name: 'Perforatrice', desc: 'Perce boucliers et armures.', cost: 90, parent: null, stats: { damage: 85, pierceShield: true, ammo: 22, cooldown: 2 } },
      { id: 'rail-magnetique', name: 'Rail magnétique', desc: 'Très longue portée, gros dégâts perforants.', cost: 130, parent: 'perforatrice', stats: { damage: 140, range: 6.5, ammo: 14, cooldown: 2.4 } },
      { id: 'desintegrateur', name: 'Désintégrateur', desc: 'Cadence plus élevée, perce toujours.', cost: 120, parent: 'perforatrice', stats: { damage: 70, cooldown: 1.1, ammo: 40 } },
      // Niveau 4
      { id: 'orbital', name: 'Frappe orbitale', desc: 'Un seul tir par recharge, mais il rase un boss.', cost: 200, parent: 'siege', stats: { damage: 700, ammo: 6, cooldown: 5, range: 6, repairCostMult: 2.5 } },
      { id: 'grappe', name: 'Grappe', desc: 'Explosion en zone très large.', cost: 160, parent: 'eclats', stats: { damage: 160, splash: 2.2, ammo: 12 } },
      { id: 'gatling', name: 'Gatling à rails', desc: 'Cadence soutenue, sans munitions.', cost: 160, parent: 'autonome', stats: { damage: 34, cooldown: 0.5 } },
      { id: 'chaine', name: 'Chaîne', desc: 'Entrave fortement la cible touchée.', cost: 140, parent: 'harpon', stats: { damage: 50, slow: 0.75, slowDuration: 2.2 } },
      { id: 'gauss', name: 'Canon de Gauss', desc: 'Portée extrême, dégâts perforants énormes.', cost: 170, parent: 'rail-magnetique', stats: { damage: 380, range: 8, ammo: 8, cooldown: 3.6, repairCostMult: 1.8 } },
      { id: 'fission', name: 'Fission', desc: 'Tirs perforants qui explosent un peu en zone.', cost: 150, parent: 'desintegrateur', stats: { damage: 95, cooldown: 0.9, ammo: 40, splash: 0.8 } },
    ],
  },
  foudre: {
    id: 'foudre',
    name: 'Bobine Tesla',
    desc: 'L’éclair saute d’un ennemi à l’autre.',
    cost: 60,
    base: base({ maxHp: 95, damage: 17, range: 2.9, cooldown: 1, chain: 2, chainRange: 1.6, chainFalloff: 0.75 }),
    nodes: [
      { id: 'arc-long', name: 'Arc long', desc: 'Plus de rebonds, plus loin.', cost: 70, parent: null, stats: { damage: 16, chain: 4, chainRange: 2, range: 3 } },
      { id: 'haute-tension', name: 'Haute tension', desc: 'Un éclair puissant, peu de rebonds.', cost: 70, parent: null, stats: { damage: 42, chain: 1, cooldown: 1.6, range: 3 } },
      { id: 'statique', name: 'Statique', desc: 'Arcs très rapides et faibles, qui ralentissent.', cost: 70, parent: null, stats: { damage: 9, chain: 3, chainRange: 1.8, cooldown: 0.5, slow: 0.25, slowDuration: 0.8 } },
      { id: 'reseau', name: 'Réseau', desc: 'L’éclair traverse presque toute la vague.', cost: 110, parent: 'arc-long', stats: { damage: 14, chain: 7, chainRange: 2.4, cooldown: 1 } },
      { id: 'orage', name: 'Orage', desc: 'Les rebonds étourdissent brièvement.', cost: 110, parent: 'arc-long', stats: { chain: 4, chainRange: 2.4, slow: 0.9, slowDuration: 0.6, cooldown: 1.7 } },
      { id: 'foudroyeur', name: 'Foudroyeur', desc: 'Perce boucliers et armures.', cost: 110, parent: 'haute-tension', stats: { damage: 85, cooldown: 2, pierceShield: true, range: 3.4 } },
      { id: 'surtension', name: 'Surtension', desc: 'Cadence et dégâts élevés, mais la tour souffre.', cost: 110, parent: 'haute-tension', stats: { damage: 60, chain: 2, cooldown: 1.2, maxHp: 70, repairCostMult: 1.6 } },
      { id: 'champ-ionique', name: 'Champ ionique', desc: 'Une nuée de petits arcs ralentisseurs sur une grande zone.', cost: 110, parent: 'statique', stats: { damage: 11, chain: 5, chainRange: 2.3, cooldown: 0.45, slow: 0.35, slowDuration: 1, range: 3.2 } },
      { id: 'condensateur', name: 'Condensateur', desc: 'Charge longtemps, libère un éclair monstrueux.', cost: 110, parent: 'statique', stats: { damage: 120, chain: 3, cooldown: 3.2, chainFalloff: 0.8, slow: 0, slowDuration: 0 } },
      // Niveau 4
      { id: 'tempete-electrique', name: 'Tempête électrique', desc: 'L’éclair frappe jusqu’à 11 ennemis.', cost: 160, parent: 'reseau', stats: { chain: 11, chainRange: 2.8, cooldown: 0.9, chainFalloff: 0.85, maxHp: 80 } },
      { id: 'faraday', name: 'Cage de Faraday', desc: 'Les rebonds figent presque les ennemis sur place.', cost: 150, parent: 'orage', stats: { chain: 6, slow: 0.95, slowDuration: 0.9, cooldown: 1.8 } },
      { id: 'jugement', name: 'Jugement', desc: 'Un éclair colossal, perforant, à grande portée.', cost: 160, parent: 'foudroyeur', stats: { damage: 170, chain: 2, chainFalloff: 0.7, cooldown: 2.4, range: 3.8, repairCostMult: 1.8 } },
    ],
  },
  laser: {
    id: 'laser',
    name: 'Rayon focalisé',
    desc: 'Plus il reste sur la même cible, plus il frappe fort.',
    cost: 80,
    base: base({ maxHp: 100, damage: 4.5, range: 3.6, cooldown: 0.2, ramp: 0.1, rampMax: 10 }),
    nodes: [
      { id: 'faisceau-lourd', name: 'Faisceau lourd', desc: 'Plus de dégâts et une montée en puissance plus haute.', cost: 80, parent: null, stats: { damage: 6, ramp: 0.14, rampMax: 14, range: 4 } },
      { id: 'prisme', name: 'Prisme', desc: 'Touche aussi les ennemis autour de la cible.', cost: 80, parent: null, stats: { damage: 3.5, splash: 1, ramp: 0.1, rampMax: 10 } },
      { id: 'pulsar', name: 'Pulsar', desc: 'Impulsions puissantes et espacées.', cost: 80, parent: null, stats: { damage: 30, cooldown: 1, ramp: 0.25, rampMax: 6, range: 4.4 } },
      { id: 'lance-solaire', name: 'Lance solaire', desc: 'Perce boucliers et armures.', cost: 120, parent: 'faisceau-lourd', stats: { damage: 9, ramp: 0.16, rampMax: 16, pierceShield: true, range: 4.4, repairCostMult: 1.4 } },
      { id: 'decoupeur', name: 'Découpeur', desc: 'Monte en puissance très vite : idéal contre les blindés.', cost: 120, parent: 'faisceau-lourd', stats: { damage: 5, ramp: 0.35, rampMax: 20 } },
      { id: 'spectre', name: 'Spectre', desc: 'Zone plus large autour de la cible.', cost: 120, parent: 'prisme', stats: { damage: 4.5, splash: 1.6, ramp: 0.12, rampMax: 12, range: 3.8 } },
      { id: 'nova', name: 'Nova', desc: 'Pulsations lentes aux dégâts de zone puissants.', cost: 120, parent: 'prisme', stats: { damage: 28, splash: 1.8, cooldown: 1, ramp: 0.15, rampMax: 6 } },
      { id: 'quasar', name: 'Quasar', desc: 'Impulsions dévastatrices et perforantes.', cost: 130, parent: 'pulsar', stats: { damage: 70, cooldown: 1.3, ramp: 0.3, rampMax: 8, pierceShield: true, repairCostMult: 1.6 } },
      // Niveau 4
      { id: 'zenith', name: 'Rayon zénith', desc: 'Une puissance qui n’en finit pas de monter.', cost: 170, parent: 'lance-solaire', stats: { damage: 14, ramp: 0.2, rampMax: 20, range: 5, repairCostMult: 1.8 } },
      { id: 'supernova', name: 'Supernova', desc: 'Zone énorme, montée en puissance de zone.', cost: 160, parent: 'nova', stats: { damage: 38, splash: 2.6, cooldown: 1.1, ramp: 0.2, rampMax: 8, repairCostMult: 1.6 } },
    ],
  },
  relais: {
    id: 'relais',
    name: 'Relais tactique',
    desc: 'Ne tire pas, mais renforce les tours voisines.',
    cost: 60,
    base: base({ maxHp: 110, damage: 0, range: 0, cooldown: 1, auraRadius: 2.2, auraDamage: 0.12 }),
    nodes: [
      { id: 'amplificateur', name: 'Amplificateur', desc: 'Dégâts des voisines +25 %.', cost: 70, parent: null, stats: { auraDamage: 0.25, auraRadius: 2.4 } },
      { id: 'atelier', name: 'Atelier', desc: 'Répare gratuitement les voisines (4 PV/s).', cost: 70, parent: null, stats: { auraDamage: 0.06, auraHeal: 4, auraRadius: 2.4 } },
      { id: 'collecteur', name: 'Collecteur', desc: 'Produit des ressources en continu, mais n’aide plus au tir.', cost: 80, parent: null, stats: { auraDamage: 0, income: 0.4 } },
      { id: 'overclock', name: 'Overclock', desc: 'Dégâts +25 % et cadence +20 %, mais fragile.', cost: 110, parent: 'amplificateur', stats: { auraDamage: 0.25, auraRate: 0.2, maxHp: 80 } },
      { id: 'optique', name: 'Optique', desc: 'Portée des voisines +0,8, dégâts +20 %.', cost: 110, parent: 'amplificateur', stats: { auraDamage: 0.2, auraReach: 0.8, auraRadius: 2.6 } },
      { id: 'nano-forge', name: 'Nano-forge', desc: 'Répare 10 PV/s sur une zone plus large.', cost: 110, parent: 'atelier', stats: { auraHeal: 10, auraRadius: 2.8 } },
      { id: 'atelier-blinde', name: 'Atelier blindé', desc: 'Très robuste, répare 5 PV/s.', cost: 90, parent: 'atelier', stats: { auraHeal: 5, maxHp: 420, repairCostMult: 0.5 } },
      { id: 'raffinerie', name: 'Raffinerie', desc: 'Production plus que doublée, mais fragile.', cost: 120, parent: 'collecteur', stats: { income: 0.9, maxHp: 80 } },
      { id: 'recycleur', name: 'Recycleur', desc: 'Production modérée, et répare un peu les voisines.', cost: 110, parent: 'collecteur', stats: { income: 0.6, auraHeal: 3, auraRadius: 2.4 } },
      // Niveau 4
      { id: 'singularite', name: 'Singularité', desc: 'L’aura ultime : +40 % de dégâts, +30 % de cadence.', cost: 170, parent: 'overclock', stats: { auraDamage: 0.4, auraRate: 0.3, auraRadius: 2.6, repairCostMult: 1.8 } },
      { id: 'regeneration', name: 'Régénération totale', desc: 'Répare 22 PV/s : le héros respire enfin.', cost: 170, parent: 'nano-forge', stats: { auraHeal: 22, auraRadius: 3, auraDamage: 0.1 } },
      { id: 'complexe', name: 'Complexe industriel', desc: 'Production énorme. À protéger à tout prix.', cost: 170, parent: 'raffinerie', stats: { income: 1.7, maxHp: 90, repairCostMult: 1.5 } },
    ],
  },
  depot: {
    id: 'depot',
    name: 'Dépôt avancé',
    desc: 'Le héros y dépose ses ressources sans retourner à la base. Ne tire pas.',
    cost: 70,
    base: base({ maxHp: 90, damage: 0, range: 0, cooldown: 1, dropOff: true }),
    nodes: [],
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
  { tower: 'canon', neighbour: 'givre', damageMult: 1.2, desc: 'Plasma près d’un Cryo : +20 % de dégâts.' },
  { tower: 'canon', neighbour: 'canon', cooldownMult: 0.92, desc: 'Deux Plasmas voisins : cadence +8 %.' },
  { tower: 'baliste', neighbour: 'canon', rangeBonus: 0.5, desc: 'Rails près d’un Plasma : +0,5 de portée.' },
  { tower: 'givre', neighbour: 'givre', rangeBonus: 0.4, desc: 'Deux Cryos voisins : +0,4 de portée.' },
  { tower: 'foudre', neighbour: 'givre', damageMult: 1.2, desc: 'Tesla près d’un Cryo : +20 % de dégâts (les ennemis givrés conduisent mieux).' },
  { tower: 'foudre', neighbour: 'foudre', rangeBonus: 0.3, desc: 'Deux Tesla voisines : +0,3 de portée.' },
  { tower: 'laser', neighbour: 'givre', cooldownMult: 0.9, desc: 'Rayon près d’un Cryo : cadence +10 % (cibles plus faciles à garder).' },
];

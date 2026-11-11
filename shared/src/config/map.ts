/** Paramètres de génération de carte. Tout est ajustable ici, sans toucher au code. */
export const MAP_CONFIG = {
  width: 24,
  height: 16,
  /** Distance horizontale entre deux virages du chemin (min, max). */
  segmentLength: [3, 5] as [number, number],
  /** Probabilité d'avoir un second point d'apparition qui rejoint le chemin principal. */
  secondPathChance: 0.5,
  /** Nombre d'emplacements constructibles (min, max). */
  slots: [26, 34] as [number, number],
  /** Part des emplacements en hauteur (bonus de portée). */
  highGroundRatio: 0.2,
  highGroundRangeBonus: 0.2,
  /** Tronçons de boue sur le chemin (ralentit les ennemis). */
  mudPatches: [1, 3] as [number, number],
  mudPatchLength: [2, 4] as [number, number],
  mudSlowFactor: 0.65,
  /** Gisements de ressources (min, max) et leur contenu. */
  deposits: [3, 5] as [number, number],
  depositMinDistFromPath: 2,
  /** Zones de prospection : proches du chemin, donc dangereuses. */
  prospectZones: [1, 2] as [number, number],
  /** Rochers infranchissables pour le héros (min, max). */
  rocks: [8, 16] as [number, number],
  /** Critères de validation. */
  minPathLength: 30,
  minSlots: 20,
  maxAttempts: 50,
};

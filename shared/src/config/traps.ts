/**
 * Pièges posés sur le chemin. Le stratège les achète, le héros (ou l'IA) va les construire,
 * puis les répare ou les réarme.
 */
export type TrapTypeId = 'barricade' | 'mine' | 'pieux';

export interface TrapDef {
  id: TrapTypeId;
  name: string;
  desc: string;
  cost: number;
  /** Temps de construction sur place par le héros (secondes). */
  buildTime: number;
  /** Barricade : PV ; mine : 1 charge ; pieux : secondes de contact avant usure. */
  hp: number;
  /** Dégâts : par explosion (mine) ou par seconde (pieux), avant la hausse par vague. */
  damage: number;
  radius: number;
  slow: number;
  /** Part du prix payée pour réarmer un piège épuisé. */
  rearmRatio: number;
}

export const TRAPS: Record<TrapTypeId, TrapDef> = {
  barricade: {
    id: 'barricade', name: 'Barricade', desc: 'Bloque les ennemis : ils doivent la détruire pour passer. Le héros la répare.',
    cost: 45, buildTime: 2.5, hp: 260, damage: 0, radius: 0, slow: 0, rearmRatio: 0.5,
  },
  mine: {
    id: 'mine', name: 'Mine', desc: 'Explose au passage du premier ennemi et touche toute la zone. Le héros la réarme.',
    cost: 35, buildTime: 1.5, hp: 1, damage: 140, radius: 1.4, slow: 0, rearmRatio: 0.45,
  },
  pieux: {
    id: 'pieux', name: 'Pieux', desc: 'Blessent et ralentissent tout ce qui passe dessus, jusqu’à usure.',
    cost: 40, buildTime: 2, hp: 30, damage: 16, radius: 0.55, slow: 0.4, rearmRatio: 0.4,
  },
};

export const TRAP_CONFIG = {
  maxTraps: 6,
  /** Pas de piège sur les premières et dernières cases du chemin. */
  edgeCells: 2,
  /** Hausse des dégâts par vague. */
  damagePerWave: 0.12,
  /** Les ennemis s'arrêtent à cette distance (en cases) devant une barricade. */
  blockGap: 0.55,
  sellRatio: 0.5,
};

export const trapDamage = (def: TrapDef, wave: number) => def.damage * (1 + TRAP_CONFIG.damagePerWave * Math.max(0, wave - 1));

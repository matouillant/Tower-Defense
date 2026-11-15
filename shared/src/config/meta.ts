import type { Difficulty } from './enemies';
import { TOWERS, type TowerTypeId } from './towers';
import { TRAPS, type TrapTypeId } from './traps';

/**
 * Progression entre les parties : chaque joueur gagne des éclats et débloque des talents (gardés sur son appareil).
 * Au lancement, les talents « stratège » viennent du stratège, les talents « héros » du joueur qui tient le héros
 * (ou du stratège si l'IA joue le héros).
 */
export type TalentId = 'tresor' | 'ingenieur' | 'prime' | 'remparts' | 'artificier' | 'endurance' | 'porteur' | 'bottes';
export type Perks = Partial<Record<TalentId, number>>;

export interface TalentDef {
  id: TalentId;
  name: string;
  desc: (rank: number) => string;
  side: 'strategist' | 'hero';
  /** Coût en éclats de chaque rang. */
  costs: number[];
}

export const TALENTS: Record<TalentId, TalentDef> = {
  tresor: { id: 'tresor', name: 'Trésor de guerre', side: 'strategist', costs: [4, 8, 14], desc: (r) => `+${25 * r} ressources au départ` },
  ingenieur: { id: 'ingenieur', name: 'Ingénieur', side: 'strategist', costs: [5, 10, 16], desc: (r) => `Tourelles ${4 * r} % moins chères` },
  prime: { id: 'prime', name: 'Primes de guerre', side: 'strategist', costs: [4, 8, 14], desc: (r) => `Prime de fin de vague +${10 * r} %` },
  remparts: { id: 'remparts', name: 'Remparts', side: 'strategist', costs: [5, 10, 16], desc: (r) => `+${2 * r} PV pour la base` },
  artificier: { id: 'artificier', name: 'Artificier', side: 'strategist', costs: [3, 6, 10], desc: (r) => `Pièges ${10 * r} % moins chers` },
  endurance: { id: 'endurance', name: 'Endurance', side: 'hero', costs: [4, 8, 14], desc: (r) => `Héros : +${12 * r} % de PV` },
  porteur: { id: 'porteur', name: 'Grand porteur', side: 'hero', costs: [4, 8, 14], desc: (r) => `Héros : +${15 * r} % de charge` },
  bottes: { id: 'bottes', name: 'Bottes à réaction', side: 'hero', costs: [5, 10, 16], desc: (r) => `Héros : +${6 * r} % de vitesse` },
};

export const rank = (p: Perks | undefined, id: TalentId) => Math.max(0, Math.min(TALENTS[id].costs.length, Math.floor(p?.[id] ?? 0)));

/** Ne garde que les talents valides d'un côté donné (stratège ou héros). */
export function cleanPerks(p: unknown, side: 'strategist' | 'hero'): Perks {
  const out: Perks = {};
  if (!p || typeof p !== 'object') return out;
  for (const id of Object.keys(TALENTS) as TalentId[]) {
    if (TALENTS[id].side !== side) continue;
    const r = rank(p as Perks, id);
    if (r > 0) out[id] = r;
  }
  return out;
}

/** Prix réels avec les talents. */
export const towerPrice = (id: TowerTypeId, p?: Perks) => Math.round(TOWERS[id].cost * (1 - 0.04 * rank(p, 'ingenieur')));
export const trapPrice = (id: TrapTypeId, p?: Perks) => Math.round(TRAPS[id].cost * (1 - 0.1 * rank(p, 'artificier')));

/** Éclats gagnés en fin de partie. */
export const DIFFICULTY_SHARDS: Record<Difficulty, number> = { normal: 0.6, difficile: 1, cauchemar: 1.5 };
export function shardsEarned(wavesHeld: number, bosses: number, difficulty: Difficulty, newStars: number): number {
  return Math.round((wavesHeld + bosses * 3) * DIFFICULTY_SHARDS[difficulty]) + newStars * 5;
}

// ------------------------------------------------------------------ campagne

export type MissionId = 'premier-contact' | 'penurie' | 'sans-filet' | 'artisans' | 'maree' | 'epreuve';

export interface MissionDef {
  id: MissionId;
  name: string;
  brief: string;
  seed: number;
  difficulty: Difficulty;
  /** Vagues à tenir pour gagner. */
  waves: number;
  startScrap?: number;
  baseHp?: number;
  /** Tourelles autorisées (toutes si absent). */
  towers?: TowerTypeId[];
}

export const MISSIONS: MissionDef[] = [
  { id: 'premier-contact', name: '1 · Premier contact', brief: 'Tenir 5 vagues pour prendre ses marques.', seed: 1101, difficulty: 'normal', waves: 5 },
  { id: 'penurie', name: '2 · Pénurie', brief: 'Tenir 7 vagues en partant presque sans rien.', seed: 2207, difficulty: 'difficile', waves: 7, startScrap: 90 },
  { id: 'sans-filet', name: '3 · Sans filet', brief: 'Tenir 8 vagues : la base ne supporte que 5 fuites.', seed: 3313, difficulty: 'difficile', waves: 8, baseHp: 5 },
  { id: 'artisans', name: '4 · Artisans', brief: 'Tenir 8 vagues avec les seules tourelles de base… et des pièges.', seed: 4421, difficulty: 'difficile', waves: 8, towers: ['canon', 'givre', 'baliste', 'depot'] },
  { id: 'maree', name: '5 · La marée', brief: 'Tenir 10 vagues, deux boss compris.', seed: 5531, difficulty: 'difficile', waves: 10 },
  { id: 'epreuve', name: '6 · L’épreuve', brief: 'Tenir 12 vagues en Cauchemar.', seed: 6643, difficulty: 'cauchemar', waves: 12 },
];
export const missionById = (id: string | null | undefined) => MISSIONS.find((m) => m.id === id) ?? null;

/** Étoiles : 1 pour la victoire, 2 si la base garde au moins la moitié de ses PV, 3 si elle est intacte. */
export function missionStars(won: boolean, baseHp: number, baseStart: number): number {
  if (!won) return 0;
  return 1 + (baseHp >= baseStart / 2 ? 1 : 0) + (baseHp >= baseStart ? 1 : 0);
}

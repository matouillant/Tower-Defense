import { GameState, MissionId, MISSIONS, Perks, TALENTS, TalentId, missionStars, rank, shardsEarned } from '@td/shared';

/** Progression du joueur, gardée sur son appareil : éclats, talents, étoiles de campagne. */
export interface Profile {
  shards: number;
  talents: Perks;
  stars: Partial<Record<MissionId, number>>;
  /** Parties déjà récompensées (évite de compter deux fois la même fin de partie). */
  rewarded: string[];
}

const KEY = 'td:profile';

export function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { shards: Number(p.shards) || 0, talents: p.talents ?? {}, stars: p.stars ?? {}, rewarded: Array.isArray(p.rewarded) ? p.rewarded : [] };
  } catch {
    return { shards: 0, talents: {}, stars: {}, rewarded: [] };
  }
}

export let profile = loadProfile();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* stockage indisponible : la progression ne durera que cette session */
  }
}

/** Prix du prochain rang d'un talent (null si au maximum). */
export function nextCost(id: TalentId): number | null {
  return TALENTS[id].costs[rank(profile.talents, id)] ?? null;
}

export function buyTalent(id: TalentId): boolean {
  const cost = nextCost(id);
  if (cost === null || profile.shards < cost) return false;
  profile.shards -= cost;
  profile.talents = { ...profile.talents, [id]: rank(profile.talents, id) + 1 };
  save();
  return true;
}

/** Rend tous les éclats dépensés. */
export function resetTalents() {
  for (const id of Object.keys(TALENTS) as TalentId[]) {
    const r = rank(profile.talents, id);
    for (let i = 0; i < r; i++) profile.shards += TALENTS[id].costs[i];
  }
  profile.talents = {};
  save();
}

/** Mission jouable : la première, puis chacune dès que la précédente a au moins une étoile. */
export function missionUnlocked(id: MissionId): boolean {
  const i = MISSIONS.findIndex((m) => m.id === id);
  return i <= 0 || (profile.stars[MISSIONS[i - 1].id] ?? 0) > 0;
}

/** Fin de partie : éclats gagnés et étoiles (une seule fois par partie). */
const awarded = new Map<string, { shards: number; stars: number; newStars: number }>();
export function award(gameKey: string, s: GameState): { shards: number; stars: number; newStars: number } {
  const done = awarded.get(gameKey);
  if (done) return done;
  const stars = s.mission ? missionStars(s.won, s.baseHp, s.stats.baseHpStart) : 0;
  const before = s.mission ? (profile.stars[s.mission.id] ?? 0) : 0;
  const newStars = Math.max(0, stars - before);
  const shards = shardsEarned(Math.max(0, s.wave - (s.won ? 0 : 1)), s.bossesKilled, s.difficulty ?? 'difficile', newStars);
  if (!profile.rewarded.includes(gameKey)) {
    profile.rewarded = [...profile.rewarded.slice(-30), gameKey];
    profile.shards += shards;
    if (s.mission && stars > before) profile.stars = { ...profile.stars, [s.mission.id]: stars };
    save();
  }
  const res = { shards, stars, newStars };
  awarded.set(gameKey, res);
  return res;
}

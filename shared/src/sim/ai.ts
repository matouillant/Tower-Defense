import { GAME_CONFIG as G, HERO_CONFIG } from '../config/game';
import { TOWERS } from '../config/towers';
import type { Game } from './game';
import { baseTowerStats, dist, heroStats, towerMaxHp } from './stats';
import type { HeroTask, Posture, TowerState } from './types';

/** Réglages de chaque posture. Ajustables sans toucher à la logique. */
export const POSTURES: Record<Posture, { retreatHp: number; avoidEnemies: number; pickupDanger: number; prospect: boolean }> = {
  /** Fuit tôt, ne répare pas sous le feu, ne ramasse que ce qui est sûr. */
  prudente: { retreatHp: 0.6, avoidEnemies: 2.2, pickupDanger: 2.5, prospect: false },
  equilibree: { retreatHp: 0.35, avoidEnemies: 0, pickupDanger: 1.4, prospect: true },
  /** Répare sous le feu et ramasse tout : efficace, mais meurt plus souvent. */
  agressive: { retreatHp: 0.15, avoidEnemies: 0, pickupDanger: 0, prospect: true },
};

/**
 * IA du héros : arbre de décision simple, piloté par les réglages du stratège.
 * Elle renvoie une tâche, exactement comme le ferait un joueur humain, ou null pour ne rien changer.
 *
 * Ordre de priorité :
 *   1. ordre direct du stratège   2. repli si PV bas   3. réparations (priorités, seuil, budget)
 *   4. recharge des munitions     5. dépôt si chargé   6. ramassage
 *   7. hors vague : récolte, prospection               8. retour à la base
 */
export function decideHeroTask(game: Game): HeroTask | null {
  const s = game.state;
  const hero = s.hero;
  if (hero.respawnIn > 0) return null;
  const stats = heroStats(hero.upgrades);
  const posture = POSTURES[s.ai.posture];
  const inWave = s.phase === 'wave';
  const enemyNear = (x: number, y: number, r: number) => r > 0 && s.enemies.some((e) => dist(e.x, e.y, x, y) <= r);
  const steps = (x: number, y: number) => {
    const n = game.stepsTo(x, y);
    return n < 0 ? 999 : n;
  };
  const repairCap = (t: TowerState) => towerMaxHp(t) * (inWave ? G.quickRepairCap : 1);
  const needsRepair = (t: TowerState) => t.hp < repairCap(t) - 0.5;

  // 1. Ordre direct : il passe avant tout, y compris le budget.
  const order = s.ai.order;
  if (order) {
    if (order.kind === 'retreat') {
      game.aiSay('Je me replie à la base.');
      return { kind: 'deliver' };
    }
    if (order.kind === 'repair') {
      const t = s.towers.find((q) => q.id === order.targetId);
      if (t && needsRepair(t) && s.scrap > 0) {
        game.aiSay('Bien reçu, je répare cette tour.');
        return { kind: 'repair', towerId: t.id };
      }
      s.ai.order = null;
    } else if (order.kind === 'harvest') {
      const id = order.targetId!;
      if (hero.carry >= stats.carryCap) return { kind: 'deliver' };
      if (s.deposits[id] > 0) {
        game.aiSay('Bien reçu, je vais récolter.');
        return { kind: 'harvest', depositId: id };
      }
      s.ai.order = null;
    }
  }

  // 2. Repli : PV bas et danger proche. On reste à la base tant qu'on n'est pas soigné.
  const hpFrac = hero.hp / stats.maxHp;
  const atBase = dist(hero.x, hero.y, game.map.base.x, game.map.base.y) <= HERO_CONFIG.baseRadius;
  if (hpFrac < posture.retreatHp && (enemyNear(hero.x, hero.y, 3.5) || (atBase && inWave))) {
    game.aiSay('Je suis blessé, je me replie.');
    return { kind: 'deliver' };
  }

  // 3. Réparations.
  const budgetLeft = s.ai.allowance - s.ai.spent;
  if (s.scrap >= 1) {
    const candidates = s.towers.filter((t) => {
      if (t.aiPriority === 'sacrifice' || !needsRepair(t)) return false;
      const frac = t.hp / towerMaxHp(t);
      // Pendant la vague on ne répare que sous le seuil ; entre deux vagues, remise en état complète.
      if (inWave && frac >= s.ai.repairThreshold) return false;
      if (inWave && t.aiPriority !== 'high' && enemyNear(t.x, t.y, posture.avoidEnemies)) return false;
      return true;
    });
    if (candidates.length > 0) {
      if (budgetLeft < 1) {
        game.aiSay('Budget de réparation épuisé : j’attends ton accord (ordre « Répare »).');
      } else {
        // On garde la tour en cours pour ne pas papillonner, sauf si une tour prioritaire appelle.
        const current = hero.task.kind === 'repair' ? candidates.find((t) => t.id === (hero.task as { towerId: number }).towerId) : undefined;
        const score = (t: TowerState) =>
          (t.aiPriority === 'high' ? -10 : 0) + t.hp / towerMaxHp(t) + steps(t.x, t.y) * 0.03 - (t === current ? 0.25 : 0);
        const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));
        if (best.hp <= 0) game.aiSay('Une tour est tombée, je la relève.');
        else if (s.ai.message.startsWith('Budget')) game.aiSay('');
        return { kind: 'repair', towerId: best.id };
      }
    }
  }

  // 4. Recharge des tours à munitions presque vides.
  const empty = s.towers.find((t) => {
    const max = baseTowerStats(t).ammo;
    return max > 0 && t.hp > 0 && t.aiPriority !== 'sacrifice' && t.ammo <= max * 0.2 && s.scrap >= TOWERS[t.type].cost * G.reloadCostRatio;
  });
  if (empty && !(inWave && enemyNear(empty.x, empty.y, posture.avoidEnemies))) return { kind: 'reload', towerId: empty.id };

  // 5. Dépôt quand il est bien chargé.
  const drop = game.nearestDrop(hero.x, hero.y);
  const depotClose = drop !== game.map.base && dist(hero.x, hero.y, drop.x, drop.y) <= 5;
  if (hero.carry >= stats.carryCap * (depotClose ? 0.3 : 0.7)) return { kind: 'deliver' };

  // 6. Ramassage de ce qui traîne, selon la prise de risque de la posture.
  if (hero.carry < stats.carryCap) {
    let best: { id: number; d: number } | null = null;
    for (const p of s.pickups) {
      if (enemyNear(p.x, p.y, posture.pickupDanger)) continue;
      const d = steps(p.x, p.y);
      // Inutile de courir après un ramassage qui aura disparu à l'arrivée.
      if (d / stats.speed > p.ttl) continue;
      if (!best || d < best.d) best = { id: p.id, d };
    }
    if (best) return { kind: 'collect', pickupId: best.id };
  }

  // 7. Entre deux vagues : récolte, voire prospection, si le temps le permet.
  if (!inWave) {
    const timeLeft = s.phaseTimer;
    const backHome = (x: number, y: number) =>
      (steps(x, y) + Math.abs(x - game.nearestDrop(x, y).x) + Math.abs(y - game.nearestDrop(x, y).y)) / stats.speed;
    if (posture.prospect && hpFrac > 0.6) {
      const zone = game.map.prospectZones.find((z) => s.prospects[z.id] <= s.wave && backHome(z.x, z.y) + G.prospectTime + 2 < timeLeft);
      if (zone || hero.task.kind === 'prospect') return zone ? { kind: 'prospect', zoneId: zone.id } : null;
    }
    if (hero.carry < stats.carryCap) {
      let best: { id: number; d: number } | null = null;
      game.map.deposits.forEach((dep) => {
        if (s.deposits[dep.id] <= 0) return;
        if (backHome(dep.x, dep.y) + G.harvestTime + 1 > timeLeft) return;
        const d = steps(dep.x, dep.y);
        if (!best || d < best.d) best = { id: dep.id, d };
      });
      if (best) return { kind: 'harvest', depositId: (best as { id: number }).id };
    }
  }

  // 8. Rien d'urgent : on rapporte ce qu'on a, puis on attend près de la base.
  if (hero.carry > 0 || hpFrac < 1 || (!atBase && !game.state.towers.some((t) => t.hp > 0 && TOWERS[t.type].base.dropOff))) return { kind: 'deliver' };
  return { kind: 'idle' };
}

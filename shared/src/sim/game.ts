import {
  BOSS_POOL,
  ENEMIES,
  EnemyTypeId,
  WAVE_CONFIG,
  attackMultiplier,
  bountyMultiplier,
  hpMultiplier,
  isBossWave,
  waveBudget,
  DIFFICULTIES,
  Difficulty,
  difficultyHp,
  THREAT,
} from '../config/enemies';
import {
  ABILITIES,
  AbilityId,
  GAME_CONFIG as G,
  HERO_CONFIG,
  HERO_NODES,
  OVERCHARGE_SELF_DAMAGE,
  REWARDS,
  REWARD_SCRAP_BASE,
  waveEndBonus,
  REWARD_SCRAP_PER_WAVE,
  RewardId,
} from '../config/game';
import { MAP_CONFIG } from '../config/map';
import { RANGE_UPGRADE, rangeUpgradeCost, TOWERS } from '../config/towers';
import { TRAP_CONFIG, TRAPS, trapDamage } from '../config/traps';
import { cleanPerks, missionById, MissionId, Perks, rank, towerPrice, trapPrice } from '../config/meta';
import type { GameMap, Vec2 } from '../map/types';
import { Rng } from '../rng';
import { decideHeroTask } from './ai';
import { baseTowerStats, bestFacing, dist, inShape, onBeam, effectiveTowerStats, heroStats, towerMaxHp } from './stats';
import type {
  Command,
  EnemyState,
  GameEvent,
  GameState,
  HeroTask,
  Role,
  TowerState,
  TrapState,
} from './types';

export interface SpawnEntry {
  type: EnemyTypeId;
  pathIdx: number;
  at: number;
  hpMult: number;
}

const AI_PERIOD = 0.4;
const ORDER_TTL = 15;
const ORDER_COOLDOWN = 4;

/** Coût pour rendre `hp` points de vie à une tour. Proportionnel aux dégâts et à l'investissement. */
export function repairCost(tower: TowerState, hp: number, heroCostMult = 1): number {
  const stats = baseTowerStats(tower);
  return (hp / stats.maxHp) * tower.invested * G.repairCostRatio * stats.repairCostMult * heroCostMult;
}

/** Prix de la remise en route du héros après sa chute, selon la vague en cours. */
export const reviveCost = (wave: number) => HERO_CONFIG.reviveBase + HERO_CONFIG.revivePerWave * Math.max(1, wave);

/** Valeur récupérée en vendant (stratège) ou recyclant (héros) une tour. */
export function salvageValue(tower: TowerState, ratio: number): number {
  const frac = Math.max(0, tower.hp) / towerMaxHp(tower);
  return Math.floor(tower.invested * ratio * (0.4 + 0.6 * frac));
}

/**
 * Simulation autoritaire, déterministe, sans dépendance (tourne côté serveur et dans les tests).
 * On avance avec step(dt) et on agit avec apply(role, commande).
 */
/** Ce qui n'est pas dans GameState mais qu'il faut pour reprendre une partie à l'identique. */
export interface SimSave {
  rng: number;
  nextId: number;
  spawnQueue: SpawnEntry[];
  waveClock: number;
  aiClock: number;
}

export interface GameOptions {
  /** Talents du stratège et du héros (progression entre parties). */
  perks?: Perks;
  heroPerks?: Perks;
  /** Mission de campagne : carte, difficulté, objectif et contraintes. */
  mission?: MissionId | null;
}

export class Game {
  readonly state: GameState;
  private events: GameEvent[] = [];
  private rng: Rng;
  private nextId = 1;
  private spawnQueue: SpawnEntry[] = [];
  private waveClock = 0;
  private aiClock = 0;
  private mud: Set<number>;
  /** Champs de distance (BFS) vers une case, pour le déplacement du héros. La carte est fixe : cache permanent. */
  private fields = new Map<number, Int16Array>();

  constructor(readonly map: GameMap, difficulty: Difficulty = 'difficile', opts: GameOptions = {}) {
    const mission = missionById(opts.mission);
    if (mission) difficulty = mission.difficulty;
    const perks = cleanPerks(opts.perks, 'strategist');
    const heroPerks = cleanPerks(opts.heroPerks, 'hero');
    const startBase = (mission?.baseHp ?? G.baseHp) + 2 * rank(perks, 'remparts');
    this.rng = new Rng(map.seed ^ 0x9e3779b9);
    this.mud = new Set(map.mud);
    this.state = {
      tick: 0,
      time: 0,
      phase: 'prep',
      phaseTimer: G.prepDuration,
      wave: 0,
      baseHp: startBase,
      scrap: (mission?.startScrap ?? G.startScrap) + 25 * rank(perks, 'tresor'),
      towers: [],
      enemies: [],
      pickups: [],
      traps: [],
      hero: { x: map.base.x, y: map.base.y, hp: HERO_CONFIG.maxHp, carry: 0, task: { kind: 'idle' }, progress: 0, respawnIn: 0, waitingRevive: false, upgrades: [], atkCd: 0, perks: heroPerks },
      deposits: map.deposits.map(() => G.depositStock),
      prospects: map.prospectZones.map(() => 0),
      ai: { repairBudgetPct: 0.3, repairThreshold: 0.6, posture: 'equilibree', allowance: 0, spent: 0, order: null, orderCooldown: 0, message: '' },
      heroController: 'ai',
      abilities: { ralentir: 0, foudre: 0, surcharge: 0 },
      cooldownMult: 1,
      rewardChoices: null,
      toSpawn: 0,
      bossesKilled: 0,
      won: false,
      perks,
      threat: 1,
      waveReach: 0,
      waveLeaked: 0,
      mission: mission ? { id: mission.id, waves: mission.waves } : null,
      stats: { maxThreat: 1, baseHpStart: startBase, bySource: {}, kills: 0, leaks: 0, harvested: 0, spent: 0, towersBuilt: 0, baseHpByWave: [], best: null },
      difficulty: DIFFICULTIES[difficulty] ? difficulty : 'difficile',
    };
    this.state.hero.hp = heroStats([], heroPerks).maxHp;
    this.state.threat = THREAT.floor[this.state.difficulty];
    this.resetAllowance();
  }

  exportSim(): SimSave {
    return { rng: this.rng.state, nextId: this.nextId, spawnQueue: this.spawnQueue, waveClock: this.waveClock, aiClock: this.aiClock };
  }

  /** Reprend une partie à partir d'un état sauvegardé (par exemple gardé par un client après une coupure du serveur). */
  static restore(map: GameMap, state: GameState, sim: SimSave): Game {
    const g = new Game(map);
    Object.assign(g.state, state);
    g.rng.state = sim.rng;
    g.nextId = Math.max(sim.nextId, 1 + Math.max(0, ...state.towers.map((t) => t.id), ...state.enemies.map((e) => e.id), ...state.pickups.map((p) => p.id)));
    g.spawnQueue = Array.isArray(sim.spawnQueue) ? sim.spawnQueue : [];
    g.waveClock = sim.waveClock || 0;
    g.aiClock = sim.aiClock || 0;
    return g;
  }

  /** Renvoie les événements accumulés depuis le dernier appel, et vide la file. */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  emit(e: GameEvent) {
    if (this.events.length < 400) this.events.push(e);
  }

  aiSay(text: string) {
    if (this.state.ai.message === text) return;
    this.state.ai.message = text;
    if (text) this.emit({ t: 'msg', from: 'ia', text });
  }

  // ------------------------------------------------------------------ boucle

  step(dt: number) {
    const s = this.state;
    if (s.phase === 'over') return;
    s.tick++;
    s.time += dt;
    for (const id of Object.keys(s.abilities) as AbilityId[]) s.abilities[id] = Math.max(0, s.abilities[id] - dt);
    s.ai.orderCooldown = Math.max(0, s.ai.orderCooldown - dt);
    if (s.ai.order && (s.ai.order.ttl -= dt) <= 0) s.ai.order = null;

    if (s.phase === 'wave') {
      this.waveClock += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveClock) this.spawn(this.spawnQueue.shift()!);
      s.toSpawn = this.spawnQueue.length;
    } else {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) this.startWave();
    }

    this.updateEnemies(dt);
    this.updateTraps(dt);
    this.updateTowers(dt);
    this.updateHero(dt);
    for (const p of s.pickups) p.ttl -= dt;
    s.pickups = s.pickups.filter((p) => p.ttl > 0 && p.value > 0);

    if (s.heroController === 'ai') {
      this.aiClock -= dt;
      if (this.aiClock <= 0) {
        this.aiClock = AI_PERIOD;
        const task = decideHeroTask(this);
        if (task) this.setHeroTask(task);
      }
    }

    if (s.baseHp <= 0) {
      s.baseHp = 0;
      s.stats.baseHpByWave.push(0);
      s.phase = 'over';
      this.emit({ t: 'over', wave: s.wave });
    } else if (s.phase === 'wave' && this.spawnQueue.length === 0 && s.enemies.length === 0) {
      this.endWave();
    }
  }

  private resetAllowance() {
    const ai = this.state.ai;
    ai.allowance = Math.floor(this.state.scrap * ai.repairBudgetPct);
    ai.spent = 0;
  }

  // ------------------------------------------------------------------ vagues

  private startWave() {
    const s = this.state;
    if (s.rewardChoices) this.applyReward(s.rewardChoices[0]);
    s.wave++;
    s.phase = 'wave';
    s.waveReach = 0;
    s.waveLeaked = 0;
    s.phaseTimer = 0;
    this.waveClock = 0;
    this.spawnQueue = this.buildWave(s.wave);
    s.toSpawn = this.spawnQueue.length;
    this.resetAllowance();
    this.emit({ t: 'wave', wave: s.wave, boss: isBossWave(s.wave) });
  }

  /** Directeur de menace : ajuste la vague suivante selon la tenue de la défense. */
  private adjustThreat() {
    const s = this.state;
    const d = s.difficulty ?? 'difficile';
    let k = s.threat ?? 1;
    if ((s.waveLeaked ?? 0) > 0) k *= 1 - Math.min(THREAT.downMax, THREAT.downPerLeak * s.waveLeaked);
    else if ((s.waveReach ?? 0) < THREAT.easyReach) k *= THREAT.upEasy[d];
    else if ((s.waveReach ?? 0) < THREAT.okReach) k *= THREAT.upOk[d];
    s.threat = Math.max(THREAT.floor[d], Math.min(THREAT.max, k));
    s.stats.maxThreat = Math.max(s.stats.maxThreat ?? 1, s.threat);
  }

  private endWave() {
    const s = this.state;
    this.adjustThreat();
    if (s.mission && s.wave >= s.mission.waves) {
      // Objectif de mission atteint.
      s.stats.baseHpByWave.push(s.baseHp);
      s.won = true;
      s.phase = 'over';
      this.emit({ t: 'over', wave: s.wave });
      return;
    }
    s.phase = 'inter';
    s.phaseTimer = G.interDuration;
    s.stats.baseHpByWave.push(s.baseHp);
    const bonus = Math.round(waveEndBonus(s.wave) * (1 + 0.1 * rank(s.perks, 'prime')));
    s.scrap += bonus;
    this.emit({ t: 'income', amount: bonus, wave: s.wave });
    s.deposits = s.deposits.map((d) => Math.min(G.depositStock, d + G.depositRegenPerWave));
    if (isBossWave(s.wave)) {
      const ids = this.rng.shuffle(Object.keys(REWARDS) as RewardId[]);
      s.rewardChoices = ids.slice(0, 3);
    }
    this.resetAllowance();
  }

  /** Compose la vague n : budget dépensé en ennemis disponibles, boss toutes les X vagues. */
  private buildWave(wave: number): SpawnEntry[] {
    const cfg = WAVE_CONFIG;
    const boss = isBossWave(wave);
    const threat = this.state.threat ?? 1;
    const total = waveBudget(wave) * (boss ? cfg.bossEscortBudget : 1) * DIFFICULTIES[this.state.difficulty ?? 'difficile'].budget * Math.pow(threat, THREAT.budgetShare);
    const pool = (Object.values(ENEMIES)).filter((e) => !e.boss && e.fromWave <= wave);
    const minCost = Math.min(...pool.map((e) => e.cost));
    const picks: EnemyTypeId[] = [];
    let budget = total;
    while (budget >= minCost && picks.length < cfg.maxEnemiesPerWave) {
      const affordable = pool.filter((e) => e.cost <= budget);
      const def = this.pickWeighted(affordable);
      picks.push(def.id);
      budget -= def.cost;
    }
    // Garde-fou : le budget non dépensé (plafond d'ennemis atteint) devient des PV supplémentaires.
    const spent = total - budget;
    const overflow = spent > 0 ? total / spent : 1;
    const hpMult = hpMultiplier(wave) * overflow * difficultyHp(this.state.difficulty ?? 'difficile', wave) * Math.pow(threat, THREAT.hpShare);
    const interval = Math.max(cfg.minSpawnInterval, cfg.spawnWindow / Math.max(1, picks.length));
    const queue: SpawnEntry[] = picks.map((type, i) => ({
      type,
      pathIdx: this.rng.int(0, this.map.paths.length - 1),
      at: 1 + i * interval,
      hpMult,
    }));
    if (boss) {
      const n = wave / cfg.bossEvery;
      queue.push({
        type: BOSS_POOL[(n - 1) % BOSS_POOL.length],
        pathIdx: this.rng.int(0, this.map.paths.length - 1),
        at: 3,
        hpMult: Math.pow(cfg.bossHpGrowth, n - 1) * DIFFICULTIES[this.state.difficulty ?? 'difficile'].hp * Math.pow(threat, THREAT.hpShare),
      });
      queue.sort((a, b) => a.at - b.at);
    }
    return queue;
  }

  /** Tirage pondéré : les ennemis communs reviennent plus souvent que les spécialistes. */
  private pickWeighted<T extends { weight?: number }>(list: T[]): T {
    let total = 0;
    for (const e of list) total += e.weight ?? 1;
    let r = this.rng.next() * total;
    for (const e of list) {
      r -= e.weight ?? 1;
      if (r <= 0) return e;
    }
    return list[list.length - 1];
  }

  private spawn(entry: SpawnEntry, at?: { d: number }) {
    const s = this.state;
    const def = ENEMIES[entry.type];
    const start = this.map.paths[entry.pathIdx][0];
    const maxHp = Math.round(def.hp * entry.hpMult);
    const e: EnemyState = {
      id: this.nextId++,
      type: entry.type,
      pathIdx: entry.pathIdx,
      d: at?.d ?? 0,
      x: start.x,
      y: start.y,
      hp: maxHp,
      maxHp,
      shield: Math.round(def.shield * entry.hpMult),
      attack: def.attack * attackMultiplier(Math.max(1, s.wave)),
      bounty: Math.round(def.bounty * bountyMultiplier(Math.max(1, s.wave))),
      slowFor: 0,
      slowFactor: 0,
      dotFor: 0,
      dotDps: 0,
      atkCd: def.attackCooldown * this.rng.next(),
      spawnCd: def.spawnEvery ?? def.heals?.every ?? 0,
      halted: 0,
      dotSrc: 0,
    };
    this.placeOnPath(e);
    s.enemies.push(e);
  }

  private placeOnPath(e: EnemyState) {
    const path = this.map.paths[e.pathIdx];
    const i = Math.min(path.length - 2, Math.floor(e.d));
    const f = Math.min(1, e.d - i);
    e.x = path[i].x + (path[i + 1].x - path[i].x) * f;
    e.y = path[i].y + (path[i + 1].y - path[i].y) * f;
  }

  // ------------------------------------------------------------------ ennemis

  private updateEnemies(dt: number) {
    const s = this.state;
    const hero = s.hero;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.type];
      if (e.dotFor > 0) {
        e.dotFor -= dt;
        this.damageEnemy(e, e.dotDps * dt, true, this.state.towers.find((t) => t.id === e.dotSrc) ?? 'competence');
        if (e.hp <= 0) continue;
      }
      // Les tireurs s'arrêtent dès qu'une cible est à portée ; les autres avancent toujours.
      let target = def.halts && e.halted < WAVE_CONFIG.haltMax ? this.findTarget(e, def.attackRange) : undefined;
      let blockedBy: TrapState | null = null;
      if (target) e.halted += dt;
      if (!target) {
        let speed = def.speed;
        if (this.mud.has(Math.round(e.y) * this.map.width + Math.round(e.x))) speed *= MAP_CONFIG.mudSlowFactor;
        if (e.slowFor > 0) {
          e.slowFor -= dt;
          speed *= 1 - e.slowFactor;
        }
        // Barricade debout devant : l'ennemi s'arrête devant et la frappe.
        const wall = this.barricadeAhead(e);
        if (wall && e.d + speed * dt >= wall.d - TRAP_CONFIG.blockGap) {
          e.d = Math.max(e.d, wall.d - TRAP_CONFIG.blockGap);
          blockedBy = wall.trap;
        } else e.d += speed * dt;
        const path = this.map.paths[e.pathIdx];
        if (!def.boss) s.waveReach = Math.max(s.waveReach ?? 0, e.d / (path.length - 1));
        if (e.d >= path.length - 1) {
          s.baseHp -= def.leak;
          s.waveLeaked = (s.waveLeaked ?? 0) + def.leak;
          s.stats.leaks++;
          e.hp = 0;
          e.bounty = 0;
          continue;
        }
        this.placeOnPath(e);
      } else if (e.slowFor > 0) e.slowFor -= dt;

      // Attaque : le héros s'il est à portée, sinon la tour active la plus proche.
      e.atkCd -= dt;
      if (blockedBy && e.atkCd <= 0) {
        e.atkCd = def.attackCooldown;
        if (def.blast) {
          this.explode(e, def.blast);
          blockedBy.hp = Math.max(0, blockedBy.hp - e.attack * 3);
        } else blockedBy.hp = Math.max(0, blockedBy.hp - Math.max(4, e.attack));
        this.emit({ t: 'hit', x: blockedBy.x, y: blockedBy.y, target: 'tower' });
      } else if (e.atkCd <= 0) {
        if (target === undefined) target = this.findTarget(e, def.attackRange);
        if (target) {
          e.atkCd = def.attackCooldown;
          if (def.blast) this.explode(e, def.blast);
          else if ('hero' in target) this.damageHero(e.attack);
          else {
            target.tower.hp = Math.max(0, target.tower.hp - e.attack);
            if (target.tower.hp === 0) this.emit({ t: 'hit', x: target.tower.x, y: target.tower.y, target: 'tower' });
          }
        }
      }
      if (e.hp <= 0) continue;

      if (def.heals && (e.spawnCd -= dt) <= 0) {
        e.spawnCd = def.heals.every;
        // Chaque cible reçoit une part de ses PV, mais jamais plus qu'un quart des PV du soigneur : il ne rend pas un boss increvable.
        let healed = false;
        for (const o of s.enemies) {
          if (o === e || o.hp <= 0 || o.hp >= o.maxHp || dist(o.x, o.y, e.x, e.y) > def.heals.radius) continue;
          o.hp = Math.min(o.maxHp, o.hp + Math.min(o.maxHp * def.heals.pct, e.maxHp * 0.25));
          healed = true;
        }
        if (healed) this.emit({ t: 'heal', x: e.x, y: e.y, radius: def.heals.radius });
      }

      if (def.spawns && (e.spawnCd -= dt) <= 0) {
        e.spawnCd = def.spawnEvery!;
        if (s.enemies.length < WAVE_CONFIG.maxEnemiesPerWave * 1.5)
          this.spawn({ type: def.spawns, pathIdx: e.pathIdx, at: 0, hpMult: hpMultiplier(s.wave) }, { d: e.d });
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  }

  // ------------------------------------------------------------------ pièges

  /** Position (index le long de chaque chemin) des cases piégées, calculée à la demande. */
  private trapIdx = new Map<number, number[]>();
  private trapPathIndex(t: TrapState): number[] {
    let idx = this.trapIdx.get(t.id);
    if (!idx) {
      idx = this.map.paths.map((p) => p.findIndex((q) => q.x === t.x && q.y === t.y));
      this.trapIdx.set(t.id, idx);
    }
    return idx;
  }

  /** Barricade active la plus proche devant l'ennemi sur son chemin. */
  private barricadeAhead(e: EnemyState): { trap: TrapState; d: number } | null {
    let best: { trap: TrapState; d: number } | null = null;
    for (const t of this.state.traps) {
      if (t.type !== 'barricade' || t.built < 1 || t.hp <= 0) continue;
      const d = this.trapPathIndex(t)[e.pathIdx];
      if (d < 0 || d <= e.d - 0.2) continue;
      if (!best || d < best.d) best = { trap: t, d };
    }
    return best;
  }

  /** Une case du chemin où l'on peut poser un piège (ni trop près de l'entrée ou de la base, ni déjà occupée). */
  trapCellOk(x: number, y: number): boolean {
    if (this.map.terrain[y * this.map.width + x] !== 'path') return false;
    if (this.state.traps.some((t) => t.x === x && t.y === y)) return false;
    for (const p of this.map.paths) {
      const i = p.findIndex((q) => q.x === x && q.y === y);
      if (i >= 0 && (i < TRAP_CONFIG.edgeCells || i >= p.length - 1 - TRAP_CONFIG.edgeCells)) return false;
    }
    return true;
  }

  /** Mines et pieux. */
  private updateTraps(dt: number) {
    const s = this.state;
    for (const t of s.traps) {
      if (t.built < 1 || t.hp <= 0) continue;
      const def = TRAPS[t.type];
      if (t.type === 'mine') {
        if (!s.enemies.some((e) => e.hp > 0 && dist(e.x, e.y, t.x, t.y) <= 0.6)) continue;
        const dmg = trapDamage(def, s.wave);
        for (const e of s.enemies) if (e.hp > 0 && dist(e.x, e.y, t.x, t.y) <= def.radius) this.damageEnemy(e, dmg, false, 'piege');
        t.hp = 0;
        this.emit({ t: 'blast', x: t.x, y: t.y, radius: def.radius });
      } else if (t.type === 'pieux') {
        let n = 0;
        for (const e of s.enemies) {
          if (e.hp <= 0 || dist(e.x, e.y, t.x, t.y) > def.radius) continue;
          n++;
          this.damageEnemy(e, trapDamage(def, s.wave) * dt, false, 'piege');
          if (e.slowFor <= 0 || def.slow >= e.slowFactor) {
            e.slowFactor = def.slow;
            e.slowFor = 0.3;
          }
        }
        if (n > 0) t.hp = Math.max(0, t.hp - dt * Math.min(3, n));
      }
    }
  }

  /** Cible d'un ennemi : le héros s'il est à portée, sinon la tour active la plus proche. */
  private findTarget(e: EnemyState, range: number): { hero: true } | { tower: TowerState } | null {
    const hero = this.state.hero;
    if (hero.respawnIn <= 0 && dist(e.x, e.y, hero.x, hero.y) <= range) return { hero: true };
    let best: TowerState | null = null;
    let bestD = range;
    for (const t of this.state.towers) {
      if (t.hp <= 0) continue;
      const d = dist(e.x, e.y, t.x, t.y);
      if (d <= bestD) {
        bestD = d;
        best = t;
      }
    }
    return best ? { tower: best } : null;
  }

  /** Explosion d'un kamikaze : tout ce qui est dans le rayon prend des dégâts, et il disparaît sans rien rapporter. */
  private explode(e: EnemyState, radius: number) {
    const s = this.state;
    for (const t of s.towers) {
      if (t.hp <= 0 || dist(e.x, e.y, t.x, t.y) > radius) continue;
      t.hp = Math.max(0, t.hp - e.attack);
      if (t.hp === 0) this.emit({ t: 'hit', x: t.x, y: t.y, target: 'tower' });
    }
    if (s.hero.respawnIn <= 0 && dist(e.x, e.y, s.hero.x, s.hero.y) <= radius) this.damageHero(e.attack);
    this.emit({ t: 'blast', x: e.x, y: e.y, radius });
    e.hp = 0;
    e.bounty = 0;
  }

  /** Mémorise dégâts et victimes par source, pour le bilan de fin de partie. */
  private credit(src: TowerState | string, damage: number, killed: boolean) {
    const st = this.state.stats;
    const key = typeof src === 'string' ? src : src.type;
    const b = (st.bySource[key] ??= { damage: 0, kills: 0 });
    b.damage += damage;
    if (killed) {
      b.kills++;
      st.kills++;
    }
    if (typeof src !== 'string') {
      src.dealt += damage;
      if (killed) src.kills++;
      if (!st.best || src.dealt > st.best.dealt) st.best = { type: src.type, path: [...src.path], dealt: src.dealt, kills: src.kills };
      else if (st.best.type === src.type && st.best.dealt <= src.dealt) st.best.kills = src.kills;
    }
  }

  private damageEnemy(e: EnemyState, amount: number, pierce: boolean, src: TowerState | string = 'competence') {
    if (e.hp <= 0) return;
    const before = e.hp;
    const armor = ENEMIES[e.type].armor;
    if (armor && !pierce) amount = Math.max(amount * 0.25, amount - armor);
    if (e.shield > 0 && !pierce) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
    }
    e.hp -= amount;
    this.credit(src, Math.min(before, Math.max(0, amount)), e.hp <= 0);
    if (e.hp > 0) return;
    const s = this.state;
    const boss = !!ENEMIES[e.type].boss;
    if (boss) s.bossesKilled++;
    const direct = Math.round(e.bounty * G.directBountyShare);
    s.scrap += direct;
    const dropped = e.bounty - direct;
    if (dropped > 0) s.pickups.push({ id: this.nextId++, x: e.x, y: e.y, value: dropped, ttl: G.pickupTtl });
    this.emit({ t: 'death', x: e.x, y: e.y, boss });
  }

  // ------------------------------------------------------------------ tours

  private updateTowers(dt: number) {
    const s = this.state;
    for (const t of s.towers) {
      if (t.hp <= 0) continue;
      if (t.disabledFor > 0) {
        t.disabledFor -= dt;
        continue;
      }
      const stats = effectiveTowerStats(t, s.towers, this.map);
      // Effets passifs des relais : production de ressources et réparation gratuite des voisines.
      if (stats.income > 0) s.scrap += stats.income * dt;
      if (stats.auraHeal > 0) {
        for (const o of s.towers) {
          if (o === t || o.hp <= 0 || dist(o.x, o.y, t.x, t.y) > stats.auraRadius) continue;
          const max = towerMaxHp(o);
          if (o.hp < max) o.hp = Math.min(max, o.hp + stats.auraHeal * dt);
        }
      }
      if (stats.damage <= 0) continue;
      let power = 1;
      if (t.overchargeFor > 0) {
        t.overchargeFor -= dt;
        power = ABILITIES.surcharge.power;
        t.hp = Math.max(0, t.hp - towerMaxHp(t) * OVERCHARGE_SELF_DAMAGE * dt);
        if (t.hp === 0) continue;
      }
      t.cooldown -= dt;
      if (t.cooldown > 0 || t.ammo === 0) continue;

      let target: EnemyState | null = null;
      let score = -Infinity;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        if (!inShape(stats, t.facing, t.x, t.y, e.x, e.y)) continue;
        const v =
          t.targeting === 'first' ? e.d - this.map.paths[e.pathIdx].length
          : t.targeting === 'strong' ? e.hp + e.shield
          : t.targeting === 'weak' ? -(e.hp + e.shield)
          : ENEMIES[e.type].speed * 1000 + e.d;
        if (v > score) {
          score = v;
          target = e;
        }
      }
      if (!target) {
        t.cooldown = 0;
        continue;
      }
      t.cooldown = stats.cooldown;
      if (t.ammo > 0) t.ammo--;
      const tx = target.x;
      const ty = target.y;
      let damage = stats.damage * power;
      if (stats.ramp > 0) {
        // Rayon : chaque tir de suite sur la même cible frappe un peu plus fort.
        if (t.focusId === target.id) t.focus = Math.min(stats.rampMax, t.focus + 1);
        else {
          t.focusId = target.id;
          t.focus = 0;
        }
        damage *= 1 + stats.ramp * t.focus;
      }
      if (stats.critChance > 0 && this.rng.chance(stats.critChance)) damage *= stats.critMult;
      const strike = (e: EnemyState, amount: number) => {
        if (stats.slow > 0 && (e.slowFor <= 0 || stats.slow >= e.slowFactor)) {
          e.slowFactor = stats.slow;
          e.slowFor = stats.slowDuration;
        }
        if (stats.dot > 0) {
          e.dotDps = Math.max(e.dotFor > 0 ? e.dotDps : 0, stats.dot * power);
          e.dotFor = stats.dotDuration;
          e.dotSrc = t.id;
        }
        this.damageEnemy(e, amount, stats.pierceShield, t);
      };
      const beamAngle = Math.atan2(ty - t.y, tx - t.x);
      if (stats.shape === 'line') t.facing = ((Math.round(beamAngle / (Math.PI / 4)) % 8) + 8) % 8;
      const victims = stats.shape === 'line' ? s.enemies.filter((e) => e.hp > 0 && onBeam(stats.range, stats.beamWidth, beamAngle, t.x, t.y, e.x, e.y)) : stats.splash > 0 ? s.enemies.filter((e) => e.hp > 0 && dist(e.x, e.y, tx, ty) <= stats.splash) : [target];
      for (const e of victims) strike(e, damage);
      // Foudre : l'éclair rebondit de proche en proche sur des ennemis encore intacts, en perdant de la puissance.
      let chain: number[] | undefined;
      if (stats.chain > 0) {
        const struck = new Set(victims.map((v) => v.id));
        let from = target;
        let mult = 1;
        chain = [];
        for (let i = 0; i < stats.chain; i++) {
          let next: EnemyState | null = null;
          let bestD = stats.chainRange;
          for (const e of s.enemies) {
            if (e.hp <= 0 || struck.has(e.id)) continue;
            const d = dist(e.x, e.y, from.x, from.y);
            if (d <= bestD) {
              bestD = d;
              next = e;
            }
          }
          if (!next) break;
          mult *= stats.chainFalloff;
          struck.add(next.id);
          strike(next, damage * mult);
          chain.push(next.x, next.y);
          from = next;
        }
      }
      // Le trait perçant est dessiné jusqu'au bout de sa portée.
      const ex = stats.shape === 'line' ? t.x + Math.cos(beamAngle) * stats.range : tx;
      const ey = stats.shape === 'line' ? t.y + Math.sin(beamAngle) * stats.range : ty;
      this.emit({ t: 'shot', kind: t.type, fx: t.x, fy: t.y, tx: ex, ty: ey, splash: stats.splash, ...(chain?.length ? { chain } : {}) });
    }
  }

  private removeTower(id: number) {
    const s = this.state;
    s.towers = s.towers.filter((t) => t.id !== id);
    const task = s.hero.task;
    if ('towerId' in task && task.towerId === id) this.setHeroTask({ kind: 'idle' });
    if (s.ai.order?.targetId === id && s.ai.order.kind === 'repair') s.ai.order = null;
  }

  // ------------------------------------------------------------------ héros

  setHeroTask(task: HeroTask) {
    const hero = this.state.hero;
    if (JSON.stringify(hero.task) === JSON.stringify(task)) return;
    hero.task = task;
    hero.progress = 0;
  }

  private damageHero(amount: number) {
    const hero = this.state.hero;
    if (hero.respawnIn > 0) return;
    hero.hp -= amount;
    this.emit({ t: 'hit', x: hero.x, y: hero.y, target: 'hero' });
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.respawnIn = HERO_CONFIG.respawnTime;
      hero.carry = 0;
      hero.task = { kind: 'idle' };
      hero.progress = 0;
      this.emit({ t: 'msg', from: 'jeu', text: `Héros à terre ! Remise en route dans ${HERO_CONFIG.respawnTime} s pour ${reviveCost(this.state.wave)} ressources.` });
    }
  }

  /** Champ de distance (en pas à 4 directions) vers une case, en évitant les rochers. */
  private fieldTo(cx: number, cy: number): Int16Array {
    const W = this.map.width;
    const H = this.map.height;
    const goal = cy * W + cx;
    let field = this.fields.get(goal);
    if (field) return field;
    field = new Int16Array(W * H).fill(-1);
    if (this.map.terrain[goal] !== 'rock') {
      field[goal] = 0;
      const queue = [goal];
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        const x = i % W;
        const y = (i - x) / W;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const n of nb) {
          if (n < 0 || field[n] >= 0 || this.map.terrain[n] === 'rock') continue;
          field[n] = field[i] + 1;
          queue.push(n);
        }
      }
    }
    this.fields.set(goal, field);
    return field;
  }

  /** Nombre de pas du héros jusqu'à une case (-1 si inaccessible). Utilisé par l'IA. */
  stepsTo(x: number, y: number): number {
    const hero = this.state.hero;
    return this.fieldTo(Math.round(x), Math.round(y))[Math.round(hero.y) * this.map.width + Math.round(hero.x)];
  }

  isWalkable(x: number, y: number): boolean {
    const cx = Math.round(x);
    const cy = Math.round(y);
    return cx >= 0 && cy >= 0 && cx < this.map.width && cy < this.map.height && this.map.terrain[cy * this.map.width + cx] !== 'rock';
  }

  /** Avance le héros vers (tx, ty). Renvoie true quand il est à moins de `stop` de la cible. */
  private moveHero(tx: number, ty: number, stop: number, dt: number): boolean {
    const hero = this.state.hero;
    if (dist(hero.x, hero.y, tx, ty) <= stop) return true;
    const W = this.map.width;
    const cx = Math.round(hero.x);
    const cy = Math.round(hero.y);
    const field = this.fieldTo(Math.round(tx), Math.round(ty));
    const here = field[cy * W + cx];
    let gx = tx;
    let gy = ty;
    if (here > 0) {
      // Prochaine case : le voisin le plus proche de la cible.
      const options: Vec2[] = [
        { x: cx + 1, y: cy },
        { x: cx - 1, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy - 1 },
      ];
      for (const o of options) {
        if (o.x < 0 || o.y < 0 || o.x >= W || o.y >= this.map.height) continue;
        const v = field[o.y * W + o.x];
        if (v >= 0 && v < here) {
          // On se recentre d'abord sur la case courante pour ne jamais couper à travers un rocher.
          const offAxis = o.x !== cx ? Math.abs(hero.y - cy) : Math.abs(hero.x - cx);
          if (offAxis > 0.05) {
            gx = o.x !== cx ? hero.x : cx;
            gy = o.x !== cx ? cy : hero.y;
          } else {
            gx = o.x;
            gy = o.y;
          }
          break;
        }
      }
    } else if (here < 0) {
      return false; // cible inaccessible
    }
    const d = dist(hero.x, hero.y, gx, gy);
    const stepLen = heroStats(hero.upgrades, hero.perks).speed * dt;
    if (d <= stepLen) {
      hero.x = gx;
      hero.y = gy;
    } else {
      hero.x += ((gx - hero.x) / d) * stepLen;
      hero.y += ((gy - hero.y) / d) * stepLen;
    }
    return dist(hero.x, hero.y, tx, ty) <= stop;
  }

  /** Point de dépôt le plus proche du héros : la base ou un dépôt avancé en état de marche. */
  nearestDrop(x: number, y: number): { x: number; y: number } {
    let best: { x: number; y: number } = this.map.base;
    let bd = dist(x, y, best.x, best.y);
    for (const t of this.state.towers) {
      if (t.hp <= 0 || !TOWERS[t.type].base.dropOff) continue;
      const d = dist(x, y, t.x, t.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  /** Blaster du héros : tir automatique sur l'ennemi le plus proche à portée, et régénération éventuelle. */
  private heroCombat(dt: number) {
    const s = this.state;
    const hero = s.hero;
    if (hero.respawnIn > 0) return;
    const stats = heroStats(hero.upgrades, hero.perks);
    if (stats.regen > 0) hero.hp = Math.min(stats.maxHp, hero.hp + stats.regen * dt);
    hero.atkCd = Math.max(0, (hero.atkCd ?? 0) - dt);
    if (hero.atkCd > 0 || stats.damage <= 0) return;
    let target: EnemyState | null = null;
    let bd = stats.attackRange;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(e.x, e.y, hero.x, hero.y);
      if (d <= bd) {
        bd = d;
        target = e;
      }
    }
    if (!target) return;
    hero.atkCd = stats.attackCooldown;
    const dmg = (stats.damage * (1 + s.wave * 0.04)) / (s.cooldownMult || 1);
    const victims = stats.attackSplash > 0 ? s.enemies.filter((e) => e.hp > 0 && dist(e.x, e.y, target!.x, target!.y) <= stats.attackSplash) : [target];
    for (const e of victims) this.damageEnemy(e, dmg, false, 'hero');
    this.emit({ t: 'shot', kind: 'canon', fx: hero.x, fy: hero.y, tx: target.x, ty: target.y, splash: stats.attackSplash, hero: true });
  }

  private updateHero(dt: number) {
    const s = this.state;
    const hero = s.hero;
    const stats = heroStats(hero.upgrades, hero.perks);
    const base = this.map.base;
    this.heroCombat(dt);
    if (hero.respawnIn > 0) {
      hero.respawnIn -= dt;
      if (hero.respawnIn <= 0) {
        // La remise en route se paie sur le stock commun ; sans les moyens, le héros attend.
        const cost = reviveCost(s.wave);
        if (s.scrap < cost) {
          hero.respawnIn = 1e-3;
          if (!hero.waitingRevive) this.emit({ t: 'msg', from: 'jeu', text: `Il faut ${cost} ressources pour remettre le héros en route.` });
          hero.waitingRevive = true;
          return;
        }
        s.scrap -= cost;
        hero.waitingRevive = false;
        hero.respawnIn = 0;
        hero.hp = stats.maxHp;
        hero.x = base.x;
        hero.y = base.y;
      }
      return;
    }
    // Près de la base : dépôt automatique de ce qu'il porte, et soins.
    if (dist(hero.x, hero.y, base.x, base.y) <= HERO_CONFIG.baseRadius) {
      s.scrap += hero.carry;
      s.stats.harvested += hero.carry;
      hero.carry = 0;
      hero.hp = Math.min(stats.maxHp, hero.hp + HERO_CONFIG.baseRegen * dt);
    } else if (hero.carry > 0 && s.towers.some((t) => t.hp > 0 && TOWERS[t.type].base.dropOff && dist(hero.x, hero.y, t.x, t.y) <= HERO_CONFIG.baseRadius)) {
      // Dépôt avancé : on y décharge sans retourner à la base (les soins restent réservés à la base).
      s.scrap += hero.carry;
      s.stats.harvested += hero.carry;
      hero.carry = 0;
    }
    // Ramassage automatique au passage.
    for (const p of s.pickups) {
      if (hero.carry >= stats.carryCap) break;
      if (dist(hero.x, hero.y, p.x, p.y) > G.pickupRadius) continue;
      const take = Math.min(p.value, stats.carryCap - hero.carry);
      hero.carry += take;
      p.value -= take;
    }

    const task = hero.task;
    const done = () => this.setHeroTask({ kind: 'idle' });
    switch (task.kind) {
      case 'idle':
        break;
      case 'move':
        if (this.moveHero(task.x, task.y, 0.05, dt) || !this.isWalkable(task.x, task.y)) done();
        break;
      case 'deliver': {
        // Chargé : on file au point de dépôt le plus proche (base ou dépôt avancé). Une fois vide et en forme, on s'arrête là.
        // Chargé : point de dépôt le plus proche. Vide : on ne file à la base que pour s'y soigner (sous 60 % des PV si un dépôt existe).
        const hasDepot = this.nearestDrop(hero.x, hero.y) !== base || s.towers.some((t) => t.hp > 0 && TOWERS[t.type].base.dropOff);
        // Soigné à 85 % suffit : le héros ne reste plus planté à la base pour quelques PV.
        if (hero.carry === 0 && (hero.hp >= stats.maxHp * 0.85 || (hasDepot && hero.hp >= stats.maxHp * 0.6 && dist(hero.x, hero.y, base.x, base.y) > HERO_CONFIG.baseRadius))) return done();
        const drop = hero.carry > 0 ? this.nearestDrop(hero.x, hero.y) : base;
        this.moveHero(drop.x, drop.y, 0.5, dt);
        break;
      }
      case 'collect': {
        const p = s.pickups.find((q) => q.id === task.pickupId);
        if (!p || p.value <= 0 || hero.carry >= stats.carryCap) done();
        else this.moveHero(p.x, p.y, 0.1, dt);
        break;
      }
      case 'harvest': {
        const d = this.map.deposits[task.depositId];
        if (!d || s.deposits[task.depositId] <= 0 || hero.carry >= stats.carryCap) return done();
        if (!this.moveHero(d.x, d.y, 0.3, dt)) break;
        hero.progress += dt / G.harvestTime;
        if (hero.progress >= 1) {
          hero.progress = 0;
          const taken = Math.min(G.harvestAmount, s.deposits[task.depositId]);
          s.deposits[task.depositId] -= taken;
          hero.carry = Math.min(stats.carryCap, hero.carry + Math.round(taken * stats.harvestMult));
        }
        break;
      }
      case 'prospect': {
        const z = this.map.prospectZones[task.zoneId];
        if (!z || s.prospects[task.zoneId] > s.wave) return done();
        if (!this.moveHero(z.x, z.y, 0.3, dt)) break;
        hero.progress += dt / G.prospectTime;
        if (hero.progress >= 1) {
          s.prospects[task.zoneId] = s.wave + G.prospectCooldownWaves;
          if (this.rng.chance(G.prospectSuccessChance)) {
            const gain = G.prospectBase + G.prospectPerWave * s.wave;
            s.scrap += gain;
            this.emit({ t: 'msg', from: 'jeu', text: `Prospection réussie : +${gain} ressources.` });
          } else {
            this.emit({ t: 'msg', from: 'jeu', text: 'Prospection ratée : le héros est blessé.' });
            this.damageHero(G.prospectFailDamage);
          }
          if (hero.respawnIn <= 0) done();
        }
        break;
      }
      case 'trap': {
        // Construire, réparer (barricade) ou réarmer un piège.
        const t = s.traps.find((q) => q.id === task.trapId);
        if (!t) return done();
        const def = TRAPS[t.type];
        if (t.built >= 1 && t.hp >= t.maxHp) return done();
        if (!this.moveHero(t.x, t.y, 0.7, dt)) {
          hero.progress = 0;
          break;
        }
        if (t.built < 1) {
          t.built = Math.min(1, t.built + dt / def.buildTime);
          hero.progress = t.built;
          if (t.built >= 1) {
            t.hp = t.maxHp;
            done();
          }
        } else if (t.hp <= 0) {
          hero.progress += dt / def.buildTime;
          if (hero.progress >= 1) {
            const cost = Math.ceil(def.cost * def.rearmRatio);
            if (s.scrap >= cost) {
              s.scrap -= cost;
              s.stats.spent += cost;
              t.hp = t.maxHp;
            } else this.emit({ t: 'msg', from: 'jeu', text: `Pas assez de ressources pour réarmer (${cost}).` });
            done();
          }
        } else {
          t.hp = Math.min(t.maxHp, t.hp + (t.maxHp / (def.buildTime * 2)) * dt);
          hero.progress = t.hp / t.maxHp;
        }
        break;
      }
      case 'repair':
      case 'reload':
      case 'recycle': {
        const t = s.towers.find((q) => q.id === task.towerId);
        if (!t) return done();
        if (!this.moveHero(t.x, t.y, stats.repairRange, dt)) {
          hero.progress = 0;
          break;
        }
        if (task.kind === 'repair') this.repairStep(t, dt);
        else if (task.kind === 'reload') {
          const max = baseTowerStats(t).ammo;
          if (max <= 0 || t.ammo >= max || t.hp <= 0) return done();
          hero.progress += dt / G.reloadTime;
          if (hero.progress >= 1) {
            const cost = Math.ceil(TOWERS[t.type].cost * G.reloadCostRatio * (1 - t.ammo / max));
            if (s.scrap >= cost) {
              s.scrap -= cost;
              t.ammo = max;
            } else this.emit({ t: 'msg', from: 'jeu', text: 'Pas assez de ressources pour recharger.' });
            done();
          }
        } else {
          hero.progress += dt / G.recycleTime;
          if (hero.progress >= 1) {
            s.scrap += salvageValue(t, G.recycleRatio);
            this.removeTower(t.id);
            done();
          }
        }
        break;
      }
    }
  }

  /** Une tranche de réparation : payée au fur et à mesure, avec usure définitive des PV max. */
  private repairStep(t: TowerState, dt: number) {
    const s = this.state;
    const hero = s.hero;
    const stats = heroStats(hero.upgrades, hero.perks);
    const fullMax = baseTowerStats(t).maxHp;
    const max = towerMaxHp(t);
    // Pendant une vague, la réparation est rapide mais partielle.
    const cap = s.phase === 'wave' ? max * G.quickRepairCap : max;
    if (t.hp >= cap - 0.01) return this.setHeroTask({ kind: 'idle' });
    let amount = Math.min(stats.repairRate * dt, cap - t.hp);
    let cost = repairCost(t, amount, stats.repairCostMult);
    const ordered = s.ai.order?.kind === 'repair' && s.ai.order.targetId === t.id;
    if (s.heroController === 'ai' && !ordered && s.ai.spent + cost > s.ai.allowance) {
      this.aiSay('Budget de réparation épuisé : j’attends ton accord (ordre « Répare »).');
      return this.setHeroTask({ kind: 'idle' });
    }
    if (cost > s.scrap) {
      amount *= s.scrap / cost;
      cost = s.scrap;
      if (amount < 0.01) {
        if (s.heroController === 'ai') this.aiSay('Plus de ressources pour réparer.');
        return this.setHeroTask({ kind: 'idle' });
      }
    }
    s.scrap -= cost;
    if (s.heroController === 'ai' && !ordered) s.ai.spent += cost;
    t.maxHpFactor = Math.max(G.minMaxHpFactor, t.maxHpFactor - G.wearPerFullRepair * (amount / fullMax) * stats.wearMult);
    t.hp = Math.min(towerMaxHp(t), t.hp + amount);
    hero.progress = t.hp / towerMaxHp(t);
  }

  // ------------------------------------------------------------------ commandes

  /** Applique une commande. Renvoie null si elle est acceptée, sinon la raison du refus. */
  apply(role: Role, cmd: Command): string | null {
    const s = this.state;
    if (s.phase === 'over') return 'La partie est terminée.';
    const tower = (id: number) => s.towers.find((t) => t.id === id);
    const pay = (cost: number) => {
      if (s.scrap < cost) return false;
      s.scrap -= cost;
      s.stats.spent += cost;
      return true;
    };
    const poor = 'Pas assez de ressources.';

    if (cmd.c === 'task' || cmd.c === 'heroUpgrade') {
      // Quand l'IA pilote le héros, c'est le stratège qui choisit ses améliorations.
      const stratForAi = cmd.c === 'heroUpgrade' && role === 'strategist' && s.heroController === 'ai';
      if (role !== 'hero' && !stratForAi) return 'Commande réservée au héros.';
      if (cmd.c === 'heroUpgrade') {
        const last = s.hero.upgrades.length ? s.hero.upgrades[s.hero.upgrades.length - 1] : null;
        const node = HERO_NODES.find((n) => n.id === cmd.nodeId);
        if (!node || node.parent !== last) return 'Amélioration indisponible.';
        if (!pay(node.cost)) return poor;
        s.hero.upgrades.push(node.id);
        return null;
      }
      if (s.hero.respawnIn > 0) return 'Le héros est à terre.';
      const task = cmd.task;
      switch (task.kind) {
        case 'move':
          if (!this.isWalkable(task.x, task.y)) return 'Destination inaccessible.';
          break;
        case 'repair':
        case 'reload':
        case 'recycle':
          if (!tower(task.towerId)) return 'Tour introuvable.';
          break;
        case 'harvest':
          if (!this.map.deposits[task.depositId]) return 'Gisement introuvable.';
          if (s.deposits[task.depositId] <= 0) return 'Gisement épuisé.';
          break;
        case 'prospect':
          if (!this.map.prospectZones[task.zoneId]) return 'Zone introuvable.';
          if (s.prospects[task.zoneId] > s.wave) return 'Zone déjà prospectée, reviens plus tard.';
          break;
        case 'collect':
          if (!s.pickups.some((p) => p.id === task.pickupId)) return 'Plus rien à ramasser.';
          break;
        case 'trap':
          if (!s.traps.some((t) => t.id === task.trapId)) return 'Piège introuvable.';
          break;
      }
      this.setHeroTask(task);
      return null;
    }

    if (role !== 'strategist') return 'Commande réservée au stratège.';
    switch (cmd.c) {
      case 'build': {
        const slot = this.map.slots[cmd.slotId];
        const def = TOWERS[cmd.type];
        if (!slot || !def) return 'Emplacement ou tour invalide.';
        if (s.towers.some((t) => t.slotId === slot.id)) return 'Emplacement occupé.';
        const allowed = missionById(s.mission?.id)?.towers;
        if (allowed && !allowed.includes(def.id)) return 'Tourelle interdite dans cette mission.';
        const price = towerPrice(def.id, s.perks);
        if (!pay(price)) return poor;
        s.stats.towersBuilt++;
        s.towers.push({
          id: this.nextId++, type: def.id, slotId: slot.id, x: slot.x, y: slot.y, hp: def.base.maxHp, maxHpFactor: 1, path: [], rangeLvl: 0, facing: bestFacing(this.map, def.base, slot.x, slot.y, slot.high),
          invested: price, cooldown: 0, ammo: def.base.ammo || -1, targeting: 'first', aiPriority: 'normal', disabledFor: 0, overchargeFor: 0, focusId: 0, focus: 0, dealt: 0, kills: 0,
        });
        return null;
      }
      case 'upgrade': {
        const t = tower(cmd.towerId);
        if (!t) return 'Tour introuvable.';
        if (cmd.nodeId === 'portee') {
          if (t.rangeLvl >= RANGE_UPGRADE.maxLevel) return 'Portée déjà au maximum.';
          const price = rangeUpgradeCost(t.type, t.rangeLvl);
          if (!pay(price)) return poor;
          t.rangeLvl += 1;
          t.invested += price;
          return null;
        }
        const last = t.path.length ? t.path[t.path.length - 1] : null;
        const node = TOWERS[t.type].nodes.find((n) => n.id === cmd.nodeId);
        if (!node || node.parent !== last) return 'Amélioration indisponible : une autre voie a déjà été choisie.';
        if (!pay(node.cost)) return poor;
        const frac = t.hp / towerMaxHp(t);
        t.path.push(node.id);
        t.invested += node.cost;
        t.hp = towerMaxHp(t) * frac;
        t.ammo = baseTowerStats(t).ammo || -1;
        return null;
      }
      case 'respec': {
        const t = tower(cmd.towerId);
        if (!t || t.path.length === 0) return 'Rien à respécialiser.';
        const spent = t.path.reduce((sum, id) => sum + (TOWERS[t.type].nodes.find((n) => n.id === id)?.cost ?? 0), 0);
        const net = Math.floor(spent * G.respecRefund) - G.respecCost;
        if (s.scrap + net < 0) return poor;
        const frac = t.hp / towerMaxHp(t);
        s.scrap += net;
        t.path = [];
        t.invested -= spent;
        t.hp = towerMaxHp(t) * frac;
        t.ammo = baseTowerStats(t).ammo || -1;
        return null;
      }
      case 'sell': {
        const t = tower(cmd.towerId);
        if (!t) return 'Tour introuvable.';
        s.scrap += salvageValue(t, G.sellRatio);
        this.removeTower(t.id);
        return null;
      }
      case 'moveTower': {
        const t = tower(cmd.towerId);
        const slot = this.map.slots[cmd.slotId];
        if (!t || !slot) return 'Tour ou emplacement invalide.';
        if (s.towers.some((o) => o.slotId === slot.id)) return 'Emplacement occupé.';
        if (!pay(Math.ceil(t.invested * G.moveCostRatio))) return poor;
        t.slotId = slot.id;
        t.x = slot.x;
        t.y = slot.y;
        t.facing = bestFacing(this.map, baseTowerStats(t), slot.x, slot.y, slot.high);
        t.disabledFor = G.moveDisable;
        return null;
      }
      case 'trap': {
        const def = TRAPS[cmd.type];
        if (!def || !Number.isInteger(cmd.x) || !Number.isInteger(cmd.y)) return 'Piège invalide.';
        if (!this.trapCellOk(cmd.x, cmd.y)) return 'Impossible de poser un piège ici.';
        if (s.traps.length >= TRAP_CONFIG.maxTraps) return `Au plus ${TRAP_CONFIG.maxTraps} pièges.`;
        const price = trapPrice(def.id, s.perks);
        if (!pay(price)) return poor;
        s.traps.push({ id: this.nextId++, type: def.id, x: cmd.x, y: cmd.y, built: 0, hp: 0, maxHp: def.hp, invested: price });
        return null;
      }
      case 'removeTrap': {
        const i = s.traps.findIndex((t) => t.id === cmd.trapId);
        if (i < 0) return 'Piège introuvable.';
        const t = s.traps[i];
        s.scrap += Math.floor(t.invested * (t.built >= 1 ? TRAP_CONFIG.sellRatio : 1));
        s.traps.splice(i, 1);
        this.trapIdx.delete(t.id);
        return null;
      }
      case 'rotate': {
        const t = tower(cmd.towerId);
        if (!t) return 'Tour introuvable.';
        if (!Number.isInteger(cmd.facing) || cmd.facing < 0 || cmd.facing > 7) return 'Orientation invalide.';
        t.facing = cmd.facing;
        return null;
      }
      case 'targeting': {
        const t = tower(cmd.towerId);
        if (!t) return 'Tour introuvable.';
        if (!['first', 'strong', 'weak', 'fast'].includes(cmd.mode)) return 'Mode invalide.';
        t.targeting = cmd.mode;
        return null;
      }
      case 'ability':
        // Les compétences du stratège (ralentir, foudre, surcharge) ont été retirées du jeu.
        return 'Les compétences ne sont plus disponibles.';
      case 'aiSettings': {
        const n = cmd.settings ?? {};
        const clamp = (v: unknown, lo: number, hi: number, fallback: number) =>
          typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
        const before = s.ai.repairBudgetPct;
        s.ai.repairBudgetPct = clamp(n.repairBudgetPct, 0, 1, s.ai.repairBudgetPct);
        s.ai.repairThreshold = clamp(n.repairThreshold, 0.1, 1, s.ai.repairThreshold);
        if (n.posture && ['prudente', 'equilibree', 'agressive'].includes(n.posture)) s.ai.posture = n.posture;
        // Changer le budget le recalcule tout de suite, sans effacer ce qui a déjà été dépensé.
        if (s.ai.repairBudgetPct !== before) {
          s.ai.allowance = Math.floor((s.scrap + s.ai.spent) * s.ai.repairBudgetPct);
          s.ai.message = '';
        }
        return null;
      }
      case 'aiPriority': {
        const t = tower(cmd.towerId);
        if (!t) return 'Tour introuvable.';
        if (!['high', 'normal', 'sacrifice'].includes(cmd.priority)) return 'Priorité invalide.';
        t.aiPriority = cmd.priority;
        return null;
      }
      case 'aiOrder': {
        if (s.ai.orderCooldown > 0) return 'Ordre en recharge.';
        if (cmd.kind === 'repair' && (cmd.targetId === undefined || !tower(cmd.targetId))) return 'Tour introuvable.';
        if (cmd.kind === 'harvest' && (cmd.targetId === undefined || !this.map.deposits[cmd.targetId])) return 'Gisement introuvable.';
        if (!['repair', 'retreat', 'harvest'].includes(cmd.kind)) return 'Ordre inconnu.';
        s.ai.order = { kind: cmd.kind, targetId: cmd.targetId, ttl: ORDER_TTL };
        s.ai.orderCooldown = ORDER_COOLDOWN;
        s.ai.message = '';
        this.aiClock = 0;
        return null;
      }
      case 'reward': {
        if (!s.rewardChoices?.includes(cmd.id)) return 'Récompense indisponible.';
        this.applyReward(cmd.id);
        return null;
      }
      case 'ready':
        if (s.phase === 'wave') return 'La vague est en cours.';
        s.phaseTimer = 0;
        return null;
    }
    return 'Commande inconnue.';
  }

  private applyReward(id: RewardId) {
    const s = this.state;
    s.rewardChoices = null;
    if (id === 'butin') s.scrap += REWARD_SCRAP_BASE + REWARD_SCRAP_PER_WAVE * s.wave;
    else if (id === 'remise-a-neuf') for (const t of s.towers) t.hp = towerMaxHp(t);
    else if (id === 'renfort')
      for (const t of s.towers) {
        const frac = t.hp / towerMaxHp(t);
        t.maxHpFactor = 1;
        t.hp = towerMaxHp(t) * frac;
      }
    else if (id === 'tactique') s.cooldownMult *= 0.8; // réutilisé : bonus de dégâts du blaster (dégâts / cooldownMult)
    this.emit({ t: 'msg', from: 'jeu', text: `Récompense : ${REWARDS[id].name}.` });
  }
}

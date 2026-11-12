import { describe, expect, it } from 'vitest';
import {
  Game, generateMap, TOWERS, ENEMIES, BOSS_POOL, GAME_CONFIG, WAVE_CONFIG, availableUpgrades, towerMaxHp, repairCost,
  hpMultiplier, isBossWave, dist, inShape, waveEndBonus, decideHeroTask, TowerTypeId, reviveCost, baseTowerStats, effectiveTowerStats, EnemyTypeId,
} from '../src/index';

const DT = 1 / GAME_CONFIG.tickRate;

/** Petit stratège automatique pour les tests : construit près de la base et améliore quand il peut. */
function botStrategist(game: Game) {
  const s = game.state;
  if (s.rewardChoices) game.apply('strategist', { c: 'reward', id: s.rewardChoices[0] });
  const reserve = s.phase === 'wave' ? 60 : 20;
  const types: TowerTypeId[] = ['canon', 'canon', 'givre', 'baliste'];
  const type = types[s.towers.length % types.length];
  if (s.scrap >= TOWERS[type].cost + reserve) {
    const used = new Set(s.towers.map((t) => t.slotId));
    const mid = game.map.paths[0][Math.floor(game.map.paths[0].length * 0.6)];
    const free = game.map.slots.filter((sl) => !used.has(sl.id)).sort((a, b) => dist(a.x, a.y, mid.x, mid.y) - dist(b.x, b.y, mid.x, mid.y));
    if (free[0] && s.towers.length < 14) return void game.apply('strategist', { c: 'build', slotId: free[0].id, type });
  }
  for (const t of s.towers) {
    const next = availableUpgrades(t)[0];
    if (next && s.scrap >= next.cost + reserve + 80) return void game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: next.id });
  }
}

function run(seed: number, maxSeconds: number, withBot = true) {
  const game = new Game(generateMap(seed));
  const steps = maxSeconds * GAME_CONFIG.tickRate;
  for (let i = 0; i < steps && game.state.phase !== 'over'; i++) {
    if (withBot && i % 10 === 0) botStrategist(game);
    if (game.state.phase !== 'wave' && game.state.phaseTimer > 3) game.apply('strategist', { c: 'ready' });
    game.step(DT);
    game.drainEvents();
  }
  return game;
}

describe('simulation', () => {
  it('est déterministe', () => {
    const a = run(11, 240).state;
    const b = run(11, 240).state;
    expect(a).toEqual(b);
  });

  it('sans défense, la base tombe', () => {
    const game = run(5, 600, false);
    expect(game.state.phase).toBe('over');
    expect(game.state.wave).toBeLessThan(6);
  });

  it('avec un stratège et l’IA du héros, la partie dure et reste saine', () => {
    for (const seed of [1, 2, 3]) {
      const game = run(seed, 1500);
      const s = game.state;
      expect(s.wave).toBeGreaterThanOrEqual(3);
      expect(Number.isFinite(s.scrap)).toBe(true);
      expect(s.scrap).toBeGreaterThanOrEqual(0);
      for (const t of s.towers) {
        expect(Number.isFinite(t.hp)).toBe(true);
        expect(t.hp).toBeLessThanOrEqual(towerMaxHp(t) + 1e-6);
        expect(t.maxHpFactor).toBeGreaterThanOrEqual(GAME_CONFIG.minMaxHpFactor);
      }
      expect(game.isWalkable(s.hero.x, s.hero.y)).toBe(true);
    }
  });

  it('branches d’amélioration exclusives', () => {
    const game = new Game(generateMap(4));
    game.state.scrap = 10000;
    expect(game.apply('strategist', { c: 'build', slotId: 0, type: 'canon' })).toBeNull();
    const t = game.state.towers[0];
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'explosive' })).not.toBeNull();
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'artillerie' })).toBeNull();
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'precision' })).not.toBeNull();
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'mortier' })).toBeNull();
    expect(availableUpgrades(t).map((n) => n.id)).toEqual(['saturation']);
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'brasier' })).not.toBeNull();
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'saturation' })).toBeNull();
    expect(availableUpgrades(t)).toEqual([]);
    expect(game.apply('strategist', { c: 'respec', towerId: t.id })).toBeNull();
    expect(t.path).toEqual([]);
    expect(t.invested).toBe(TOWERS.canon.cost);
  });

  it('réparation : payante, proportionnelle, avec usure ; le budget bloque l’IA', () => {
    const game = new Game(generateMap(4));
    const s = game.state;
    game.apply('strategist', { c: 'build', slotId: 0, type: 'canon' });
    const t = s.towers[0];
    t.hp = 30;
    // Aucun revenu annexe pendant ce test : ni gisement, ni prospection.
    s.deposits = s.deposits.map(() => 0);
    s.prospects = s.prospects.map(() => 99);
    expect(repairCost(t, 90)).toBeCloseTo((90 / 120) * 50 * GAME_CONFIG.repairCostRatio);
    // Budget à zéro : l'IA ne répare pas.
    game.apply('strategist', { c: 'aiSettings', settings: { repairBudgetPct: 0 } });
    for (let i = 0; i < 200; i++) game.step(DT);
    expect(t.hp).toBe(30);
    expect(s.ai.message).toContain('Budget');
    // Un ordre direct passe outre le budget.
    const before = s.scrap;
    expect(game.apply('strategist', { c: 'aiOrder', kind: 'repair', targetId: t.id })).toBeNull();
    for (let i = 0; i < 400 && s.phase === 'prep'; i++) game.step(DT);
    expect(t.hp).toBeGreaterThan(100);
    expect(s.scrap).toBeLessThan(before);
    expect(t.maxHpFactor).toBeLessThan(1);
  });

  it('la remise en route du héros se paie, et il attend tant que le stock ne suffit pas', () => {
    const game = new Game(generateMap(4));
    const s = game.state;
    const cost = reviveCost(1);
    (game as any).damageHero(1000);
    expect(s.hero.respawnIn).toBeGreaterThan(0);
    s.scrap = cost - 1;
    s.deposits = s.deposits.map(() => 0);
    for (let i = 0; i < 12 * GAME_CONFIG.tickRate; i++) game.step(DT);
    expect(s.hero.waitingRevive).toBe(true);
    expect(s.hero.hp).toBe(0);
    s.scrap = cost + 10;
    game.step(DT);
    expect(s.hero.waitingRevive).toBe(false);
    expect(s.hero.hp).toBeGreaterThan(0);
    expect(s.scrap).toBeCloseTo(10);
  });

  it('le héros n’accepte pas les commandes du stratège, et inversement', () => {
    const game = new Game(generateMap(4));
    expect(game.apply('hero', { c: 'build', slotId: 0, type: 'canon' })).not.toBeNull();
    expect(game.apply('strategist', { c: 'task', task: { kind: 'deliver' } })).not.toBeNull();
  });

  it('formules de vagues : croissance bornée, boss toutes les X vagues', () => {
    expect(isBossWave(WAVE_CONFIG.bossEvery)).toBe(true);
    expect(isBossWave(WAVE_CONFIG.bossEvery + 1)).toBe(false);
    expect(hpMultiplier(1)).toBe(1);
    expect(hpMultiplier(200)).toBeLessThan(1e6);
    expect(hpMultiplier(41) / hpMultiplier(40)).toBeCloseTo(WAVE_CONFIG.hpGrowthAfterCap);
  });

  describe('contenu : arbres, ennemis, mécaniques', () => {
    /** Place un ennemi de ce type sur le chemin 0, à `d` cases du départ. */
    const addEnemy = (game: Game, type: EnemyTypeId, d: number, hp?: number) => {
      const path = game.map.paths[0];
      const def = ENEMIES[type];
      const i = Math.min(path.length - 2, Math.floor(d));
      const e = {
        id: 9000 + game.state.enemies.length, type, pathIdx: 0, d, x: path[i].x, y: path[i].y,
        hp: hp ?? def.hp, maxHp: hp ?? def.hp, shield: def.shield, attack: def.attack, bounty: def.bounty,
        slowFor: 0, slowFactor: 0, dotFor: 0, dotDps: 0, atkCd: 0, spawnCd: def.heals?.every ?? def.spawnEvery ?? 0, halted: 0,
      };
      game.state.enemies.push(e);
      return e;
    };
    /** Une tour posée sur l'emplacement le plus proche d'un point, avec un chemin d'améliorations donné. */
    const towerNear = (game: Game, type: TowerTypeId, x: number, y: number, path: string[] = [], skip = new Set<number>()) => {
      const free = game.map.slots.filter((sl) => !skip.has(sl.id)).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
      game.state.scrap = 1e6;
      expect(game.apply('strategist', { c: 'build', slotId: free.id, type })).toBeNull();
      const t = game.state.towers[game.state.towers.length - 1];
      for (const id of path) expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: id })).toBeNull();
      return t;
    };

    it('les arbres sont cohérents : parents existants, identifiants uniques, 4 niveaux, 3 voies au niveau 2', () => {
      for (const def of Object.values(TOWERS).filter((d) => d.id !== "depot")) {
        const ids = new Set(def.nodes.map((n) => n.id));
        expect(ids.size).toBe(def.nodes.length);
        const depth = (id: string | null): number => (id === null ? 0 : 1 + depth(def.nodes.find((n) => n.id === id)!.parent));
        for (const n of def.nodes) {
          if (n.parent !== null) expect(ids.has(n.parent), `${def.id}/${n.id}`).toBe(true);
          expect(depth(n.id)).toBeLessThanOrEqual(3);
          expect(n.cost).toBeGreaterThan(0);
        }
        expect(def.nodes.filter((n) => n.parent === null).length).toBeGreaterThanOrEqual(3);
        expect(Math.max(...def.nodes.map((n) => depth(n.id))), def.id).toBe(3);
      }
    });

    it('au moins 6 tours et 10 ennemis ordinaires, 3 boss en rotation', () => {
      expect(Object.keys(TOWERS).length).toBeGreaterThanOrEqual(6);
      expect(Object.values(ENEMIES).filter((e) => !e.boss).length).toBeGreaterThanOrEqual(10);
      expect(BOSS_POOL.length).toBe(3);
      for (const id of BOSS_POOL) expect(ENEMIES[id].boss).toBe(true);
    });

    it('la composition des vagues varie : tous les ennemis ordinaires finissent par apparaître', () => {
      const seen = new Set<string>();
      for (const seed of [1, 2, 3]) {
        const game = new Game(generateMap(seed));
        game.state.scrap = 1e6;
        game.state.towers = [];
        for (let w = 1; w <= 20; w++) {
          game.state.wave = w - 1;
          game.state.phase = 'prep';
          game.state.phaseTimer = 0.01;
          game.step(DT);
          for (let i = 0; i < 200 && game.state.toSpawn > 0; i++) game.step(DT);
          for (const e of game.state.enemies) seen.add(e.type);
          game.state.enemies = [];
          game.state.baseHp = 99;
        }
      }
      for (const e of Object.values(ENEMIES)) if (!e.boss) expect(seen.has(e.id), e.id).toBe(true);
    });

    it('l’armure absorbe les petits calibres mais pas les tirs perforants', () => {
      const game = new Game(generateMap(2));
      const e = addEnemy(game, 'blinde', 5, 1000);
      const armor = ENEMIES.blinde.armor!;
      (game as unknown as { damageEnemy(e: unknown, a: number, p: boolean): void }).damageEnemy(e, 10, false);
      expect(1000 - e.hp).toBeCloseTo(Math.max(2.5, 10 - armor));
      const before = e.hp;
      (game as unknown as { damageEnemy(e: unknown, a: number, p: boolean): void }).damageEnemy(e, 10, true);
      expect(before - e.hp).toBeCloseTo(10);
    });

    it('un tireur à distance s’arrête pour tirer ; un fantassin continue d’avancer', () => {
      const game = new Game(generateMap(2));
      const mid = game.map.paths[0][Math.floor(game.map.paths[0].length / 2)];
      const tower = towerNear(game, 'canon', mid.x, mid.y);
      const range = ENEMIES.artilleur.attackRange;
      const art = addEnemy(game, 'artilleur', Math.max(0, game.map.paths[0].findIndex((p) => dist(p.x, p.y, tower.x, tower.y) <= range - 0.3)));
      const grunt = addEnemy(game, 'grunt', 0);
      grunt.d = art.d;
      const d0 = art.d;
      game.state.phase = 'wave';
      for (let i = 0; i < 40; i++) game.step(DT);
      expect(art.d).toBe(d0);
      expect(tower.hp).toBeLessThan(towerMaxHp(tower));
      expect(grunt.d).toBeGreaterThan(d0);
    });

    it('un sapeur explose au contact : dégâts de zone aux tours voisines, aucune prime', () => {
      const game = new Game(generateMap(2));
      const mid = game.map.paths[0][Math.floor(game.map.paths[0].length / 2)];
      const t1 = towerNear(game, 'canon', mid.x, mid.y);
      const t2 = towerNear(game, 'canon', t1.x + 1, t1.y, [], new Set([t1.slotId]));
      const near = dist(t1.x, t1.y, t2.x, t2.y) <= 1.2;
      const scrap = game.state.scrap;
      const nearest = game.map.paths[0].reduce((best, p, i) => (dist(p.x, p.y, t1.x, t1.y) < dist(game.map.paths[0][best].x, game.map.paths[0][best].y, t1.x, t1.y) ? i : best), 0);
      const sap = addEnemy(game, 'sapeur', nearest);
      game.state.phase = 'wave';
      for (let i = 0; i < 60 && game.state.enemies.includes(sap); i++) game.step(DT);
      expect(game.state.enemies.some((e) => e === sap)).toBe(false);
      expect(t1.hp).toBeLessThan(towerMaxHp(t1));
      if (near) expect(t2.hp).toBeLessThan(towerMaxHp(t2));
      expect(game.state.scrap - scrap).toBeLessThanOrEqual(waveEndBonus(game.state.wave)); // aucune prime, hors prime de fin de vague
    });

    it('un soigneur remonte les PV des ennemis proches, sans dépasser le maximum', () => {
      const game = new Game(generateMap(2));
      const healer = addEnemy(game, 'soigneur', 5);
      const hurt = addEnemy(game, 'brute', 5.2, 160);
      hurt.hp = 40;
      game.state.phase = 'wave';
      for (let i = 0; i < 20 * 2.2; i++) game.step(DT);
      expect(hurt.hp).toBeGreaterThan(40);
      expect(hurt.hp).toBeLessThanOrEqual(hurt.maxHp);
      expect(healer.hp).toBe(healer.maxHp);
    });

    it('la foudre rebondit sur plusieurs ennemis avec une puissance décroissante', () => {
      const game = new Game(generateMap(2));
      const mid = game.map.paths[0][Math.floor(game.map.paths[0].length / 2)];
      const tower = towerNear(game, 'foudre', mid.x, mid.y, ['arc-long', 'reseau']);
      const stats = baseTowerStats(tower);
      expect(stats.chain).toBe(7);
      const i0 = Math.max(0, game.map.paths[0].findIndex((p) => dist(p.x, p.y, tower.x, tower.y) <= 1.5));
      const foes = [0, 0.6, 1.2, 1.8].map((o) => addEnemy(game, 'brute', i0 + o, 1000));
      game.state.phase = 'wave';
      game.step(DT);
      const dealt = foes.map((e) => 1000 - e.hp).filter((v) => v > 0);
      expect(dealt.length).toBeGreaterThanOrEqual(3);
      const sorted = [...dealt].sort((a, b) => b - a);
      expect(sorted[0]).toBeGreaterThan(sorted[sorted.length - 1]);
      const shot = game.drainEvents().find((e) => e.t === 'shot');
      expect(shot && shot.t === 'shot' && shot.chain?.length).toBeGreaterThanOrEqual(4);
    });

    it('le rayon focalisé monte en puissance sur une même cible et repart de zéro si elle change', () => {
      const game = new Game(generateMap(2));
      const mid = game.map.paths[0][Math.floor(game.map.paths[0].length / 2)];
      const tower = towerNear(game, 'laser', mid.x, mid.y);
      const i0 = Math.max(0, game.map.paths[0].findIndex((p) => dist(p.x, p.y, tower.x, tower.y) <= 1.5));
      const a = addEnemy(game, 'golem', i0, 1e6);
      game.state.phase = 'wave';
      const hits: number[] = [];
      for (let k = 0; k < 8; k++) {
        const before = a.hp;
        for (let i = 0; i < 8 && a.hp === before; i++) game.step(DT);
        hits.push(before - a.hp);
      }
      expect(hits[7]).toBeGreaterThan(hits[0] * 1.4);
      expect(tower.focus).toBeGreaterThan(3);
      a.hp = 0;
      const b = addEnemy(game, 'golem', i0, 1e6);
      for (let i = 0; i < 6; i++) game.step(DT);
      expect(tower.focusId).toBe(b.id);
      expect(tower.focus).toBeLessThan(3);
    });

    it('un relais renforce les voisines, les répare gratuitement et un collecteur produit des ressources', () => {
      const game = new Game(generateMap(2));
      const mid = game.map.paths[0][Math.floor(game.map.paths[0].length / 2)];
      const gun = towerNear(game, 'canon', mid.x, mid.y);
      const alone = effectiveTowerStats(gun, game.state.towers, game.map).damage;
      const relay = towerNear(game, 'relais', gun.x + 1, gun.y, ['atelier'], new Set([gun.slotId]));
      expect(dist(relay.x, relay.y, gun.x, gun.y)).toBeLessThanOrEqual(baseTowerStats(relay).auraRadius);
      expect(effectiveTowerStats(gun, game.state.towers, game.map).damage).toBeGreaterThan(alone);
      gun.hp = 20;
      const scrap = game.state.scrap;
      for (let i = 0; i < 40; i++) game.step(DT);
      expect(gun.hp).toBeGreaterThan(20 + 4 * 1.5);
      expect(game.state.scrap).toBeLessThanOrEqual(scrap + 5); // la réparation de l'atelier ne coûte rien
      // Un collecteur seul : le stock augmente tout seul.
      const game2 = new Game(generateMap(2));
      towerNear(game2, 'relais', mid.x, mid.y, ['collecteur', 'raffinerie']);
      game2.state.scrap = 100;
      for (let i = 0; i < 20 * 10; i++) game2.step(DT);
      expect(game2.state.scrap).toBeGreaterThan(100 + 0.9 * 9);
    });

    it('les auras de relais sont plafonnées', () => {
      const game = new Game(generateMap(2));
      const mid = game.map.paths[0][Math.floor(game.map.paths[0].length / 2)];
      const gun = towerNear(game, 'canon', mid.x, mid.y);
      const alone = effectiveTowerStats(gun, game.state.towers, game.map).damage;
      const used = new Set([gun.slotId]);
      for (let i = 0; i < 6; i++) {
        const r = towerNear(game, 'relais', gun.x, gun.y, ['amplificateur', 'overclock', 'singularite'], used);
        used.add(r.slotId);
      }
      const buffed = effectiveTowerStats(gun, game.state.towers, game.map).damage;
      expect(buffed / alone).toBeLessThanOrEqual(1.7 + 1e-6);
    });
  });
});

describe('amélioration de portée', () => {
  it('ajoute de la portée, plafonnée à 3 niveaux, cumulable avec une voie', () => {
    const map = generateMap(4);
    const game = new Game(map);
    game.state.scrap = 5000;
    expect(game.apply('strategist', { c: 'build', slotId: map.slots[0].id, type: 'canon' })).toBeNull();
    const t = game.state.towers[0];
    const r0 = effectiveTowerStats(t, game.state.towers, map).range;
    for (let i = 0; i < 3; i++) expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'portee' })).toBeNull();
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'portee' })).toBeTruthy();
    expect(effectiveTowerStats(t, game.state.towers, map).range).toBeCloseTo(r0 + 1.5, 5);
    expect(game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'precision' })).toBeNull();
    expect(effectiveTowerStats(t, game.state.towers, map).range).toBeGreaterThan(6);
  });
  it('élargit l’aura d’un relais', () => {
    const map = generateMap(4);
    const game = new Game(map);
    game.state.scrap = 5000;
    game.apply('strategist', { c: 'build', slotId: map.slots[0].id, type: 'relais' });
    const t = game.state.towers[0];
    const a0 = baseTowerStats(t).auraRadius;
    game.apply('strategist', { c: 'upgrade', towerId: t.id, nodeId: 'portee' });
    expect(baseTowerStats(t).auraRadius).toBeCloseTo(a0 + 0.5, 5);
  });
});

describe('zones de tir et dépôt avancé', () => {
  it('la ligne ne touche que ce qui est dans l’axe, le cône que ce qui est devant', () => {
    const st = { shape: 'line' as const, range: 5, minRange: 0, beamWidth: 0.6, coneHalf: 0.8 };
    expect(inShape(st, 0, 10, 10, 13, 10.4)).toBe(true);
    expect(inShape(st, 0, 10, 10, 13, 11.5)).toBe(false);
    expect(inShape(st, 0, 10, 10, 7, 10)).toBe(false);
    expect(inShape(st, 2, 10, 10, 10, 13)).toBe(true);
    const cone = { ...st, shape: 'cone' as const };
    expect(inShape(cone, 0, 10, 10, 12, 10.5)).toBe(true);
    expect(inShape(cone, 0, 10, 10, 10.5, 12)).toBe(false);
  });
  it('une tour en ligne transperce tous les ennemis alignés et peut être réorientée', () => {
    const map = generateMap(4);
    const game = new Game(map);
    game.state.scrap = 5000;
    game.apply('strategist', { c: 'build', slotId: map.slots[0].id, type: 'baliste' });
    const t = game.state.towers[0];
    expect(game.apply('strategist', { c: 'rotate', towerId: t.id, facing: 9 })).toBeTruthy();
    expect(game.apply('strategist', { c: 'rotate', towerId: t.id, facing: 3 })).toBeNull();
    expect(t.facing).toBe(3);
  });
  it('le héros dépose au dépôt avancé sans retourner à la base', () => {
    const map = generateMap(4);
    const game = new Game(map);
    game.state.scrap = 5000;
    const slot = map.slots.slice().sort((a, b) => dist(b.x, b.y, map.base.x, map.base.y) - dist(a.x, a.y, map.base.x, map.base.y))[0];
    expect(game.apply('strategist', { c: 'build', slotId: slot.id, type: 'depot' })).toBeNull();
    const h = game.state.hero;
    h.carry = 40;
    h.x = slot.x + 3;
    h.y = slot.y;
    const before = game.state.scrap;
    game.apply('hero', { c: 'task', task: { kind: 'deliver' } });
    for (let i = 0; i < 400 && h.carry > 0; i++) game.step(DT);
    expect(h.carry).toBe(0);
    expect(game.state.scrap).toBeGreaterThanOrEqual(before + 40 - 1);
    expect(dist(h.x, h.y, map.base.x, map.base.y)).toBeGreaterThan(4);
  });
});

describe('économie de fin de vague et IA', () => {
  it('la prime de fin de vague augmente avec la vague et est versée', () => {
    expect(waveEndBonus(10)).toBeGreaterThan(waveEndBonus(1));
    expect(waveEndBonus(20)).toBeGreaterThan(waveEndBonus(10));
    const game = new Game(generateMap(4));
    game.apply('strategist', { c: 'ready' });
    let got = 0;
    for (let i = 0; i < 20 * 600 && !got; i++) {
      game.step(DT);
      for (const e of game.drainEvents()) if (e.t === 'income') got = e.amount;
    }
    expect(got).toBe(waveEndBonus(1));
  });
  it('l’IA décharge au dépôt quand il est plus proche que la base', () => {
    const map = generateMap(4);
    const game = new Game(map);
    game.state.scrap = 5000;
    const slot = map.slots.slice().sort((a, b) => dist(b.x, b.y, map.base.x, map.base.y) - dist(a.x, a.y, map.base.x, map.base.y))[0];
    game.apply('strategist', { c: 'build', slotId: slot.id, type: 'depot' });
    const h = game.state.hero;
    h.carry = 60;
    h.x = slot.x + 2;
    h.y = slot.y;
    expect(game.nearestDrop(h.x, h.y)).not.toBe(map.base);
    const task = decideHeroTask(game);
    expect(task?.kind).toBe('deliver');
  });
});

describe('reprise après perte du serveur', () => {
  it('une partie restaurée continue exactement comme l’originale', () => {
    const map = generateMap(7);
    const a = new Game(map);
    a.state.scrap = 2000;
    for (let i = 0; i < 4; i++) botStrategist(a);
    a.apply('strategist', { c: 'ready' });
    for (let i = 0; i < 20 * 30; i++) { botStrategist(a); a.step(DT); }
    const b = Game.restore(generateMap(7), JSON.parse(JSON.stringify(a.state)), JSON.parse(JSON.stringify(a.exportSim())));
    for (let i = 0; i < 20 * 30; i++) { a.step(DT); b.step(DT); }
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
  });
});

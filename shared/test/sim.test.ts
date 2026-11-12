import { describe, expect, it } from 'vitest';
import {
  Game, generateMap, TOWERS, GAME_CONFIG, WAVE_CONFIG, availableUpgrades, towerMaxHp, repairCost,
  hpMultiplier, isBossWave, dist, TowerTypeId,
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
});

import { describe, expect, it } from 'vitest';
import { generateMap, validateMap, hashSeed, Rng } from '../src/index';

describe('rng', () => {
  it('est déterministe', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('génération de carte', () => {
  it('produit la même carte pour la même seed', () => {
    expect(generateMap(12345)).toEqual(generateMap(12345));
    expect(generateMap(hashSeed('ma-carte'))).toEqual(generateMap(hashSeed('ma-carte')));
  });

  it('produit des cartes différentes pour des seeds différentes', () => {
    expect(generateMap(1).paths).not.toEqual(generateMap(2).paths);
  });

  it('génère 2000 cartes valides', () => {
    let twoPaths = 0;
    let retried = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const map = generateMap(seed);
      expect(validateMap(map)).toEqual([]);
      if (map.paths.length > 1) twoPaths++;
      if (map.attempt > 0) retried++;
    }
    // Les deux variantes (un ou deux chemins) doivent exister.
    expect(twoPaths).toBeGreaterThan(200);
    expect(twoPaths).toBeLessThan(1800);
  });

  it('détecte une carte cassée', () => {
    const map = generateMap(7);
    map.paths[0].splice(5, 2);
    expect(validateMap(map).length).toBeGreaterThan(0);
  });
});

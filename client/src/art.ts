import baliste_base from './art/baliste_base.svg';
import baliste_head from './art/baliste_head.svg';
import base from './art/base.svg';
import bolt from './art/bolt.svg';
import bouclier from './art/bouclier.svg';
import brute from './art/brute.svg';
import canon_base from './art/canon_base.svg';
import canon_head from './art/canon_head.svg';
import colosse from './art/colosse.svg';
import deposit from './art/deposit.svg';
import dig from './art/dig.svg';
import givre from './art/givre.svg';
import grunt from './art/grunt.svg';
import hero from './art/hero.svg';
import portal from './art/portal.svg';
import reine from './art/reine.svg';
import rock from './art/rock.svg';
import runner from './art/runner.svg';

/** Illustrations originales du jeu (SVG). La taille est celle de la texture générée, en pixels. */
export const ART: Record<string, { url: string; size: number }> = {
  hero: { url: hero, size: 192 },
  canon_base: { url: canon_base, size: 192 },
  canon_head: { url: canon_head, size: 192 },
  givre: { url: givre, size: 192 },
  baliste_base: { url: baliste_base, size: 192 },
  baliste_head: { url: baliste_head, size: 192 },
  grunt: { url: grunt, size: 160 },
  runner: { url: runner, size: 160 },
  brute: { url: brute, size: 192 },
  bouclier: { url: bouclier, size: 176 },
  colosse: { url: colosse, size: 320 },
  reine: { url: reine, size: 320 },
  base: { url: base, size: 320 },
  portal: { url: portal, size: 192 },
  rock: { url: rock, size: 128 },
  deposit: { url: deposit, size: 160 },
  dig: { url: dig, size: 160 },
  bolt: { url: bolt, size: 96 },
};

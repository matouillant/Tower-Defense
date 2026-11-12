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
import artilleur from './art/artilleur.svg';
import blinde from './art/blinde.svg';
import essaim from './art/essaim.svg';
import foudre from './art/foudre.svg';
import golem from './art/golem.svg';
import laser_base from './art/laser_base.svg';
import laser_head from './art/laser_head.svg';
import relais from './art/relais.svg';
import sapeur from './art/sapeur.svg';
import sentinelle from './art/sentinelle.svg';
import soigneur from './art/soigneur.svg';

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
  essaim: { url: essaim, size: 128 },
  artilleur: { url: artilleur, size: 160 },
  sapeur: { url: sapeur, size: 160 },
  soigneur: { url: soigneur, size: 176 },
  blinde: { url: blinde, size: 192 },
  golem: { url: golem, size: 256 },
  sentinelle: { url: sentinelle, size: 320 },
  foudre: { url: foudre, size: 192 },
  laser_base: { url: laser_base, size: 192 },
  laser_head: { url: laser_head, size: 192 },
  relais: { url: relais, size: 192 },
};

/** Tours sans tête pivotante : une seule image, qui pulse doucement. */
export const HEADLESS_TOWERS = new Set(['givre', 'foudre', 'relais']);
/** Image de la tour dans les menus. */
export const towerIcon = (id: string) => ART[HEADLESS_TOWERS.has(id) ? id : `${id}_head`].url;

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
import depot from './art/depot.svg';
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
  hero: { url: hero, size: 256 },
  canon_base: { url: canon_base, size: 256 },
  canon_head: { url: canon_head, size: 256 },
  givre: { url: givre, size: 256 },
  baliste_base: { url: baliste_base, size: 256 },
  baliste_head: { url: baliste_head, size: 256 },
  grunt: { url: grunt, size: 256 },
  runner: { url: runner, size: 256 },
  brute: { url: brute, size: 256 },
  bouclier: { url: bouclier, size: 256 },
  colosse: { url: colosse, size: 512 },
  reine: { url: reine, size: 512 },
  base: { url: base, size: 512 },
  portal: { url: portal, size: 256 },
  rock: { url: rock, size: 128 },
  deposit: { url: deposit, size: 256 },
  dig: { url: dig, size: 256 },
  bolt: { url: bolt, size: 128 },
  essaim: { url: essaim, size: 128 },
  artilleur: { url: artilleur, size: 256 },
  sapeur: { url: sapeur, size: 256 },
  soigneur: { url: soigneur, size: 256 },
  blinde: { url: blinde, size: 256 },
  golem: { url: golem, size: 256 },
  sentinelle: { url: sentinelle, size: 512 },
  foudre: { url: foudre, size: 256 },
  laser_base: { url: laser_base, size: 256 },
  laser_head: { url: laser_head, size: 256 },
  relais: { url: relais, size: 256 },
  depot: { url: depot, size: 256 },
};

/** Tours sans tête pivotante : une seule image, qui pulse doucement. */
export const HEADLESS_TOWERS = new Set(['givre', 'foudre', 'relais', 'depot']);
/** Image de la tour dans les menus. */
export const towerIcon = (id: string) => ART[HEADLESS_TOWERS.has(id) ? id : `${id}_head`].url;

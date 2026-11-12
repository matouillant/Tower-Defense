import Phaser from 'phaser';
import { ABILITIES, AbilityId, ENEMIES, GameEvent, GameMap, GameState, Rng, TowerTypeId, baseTowerStats, effectiveTowerStats, heroStats, towerMaxHp } from '@td/shared';
import { ART, HEADLESS_TOWERS } from './art';

export const TILE = 48;
/** Taille minimale d'une case à l'écran, en pixels CSS, pour rester confortable au doigt. */
const MIN_TILE = 34;
/** Densité d'écran prise en compte (plafonnée pour les performances) : l'image reste nette sur téléphone. */
const DPR = Math.min(2, window.devicePixelRatio || 1);

export type Tap =
  | { kind: 'tower'; id: number }
  | { kind: 'slot'; id: number }
  | { kind: 'deposit'; id: number }
  | { kind: 'prospect'; id: number }
  | { kind: 'ground'; x: number; y: number };

const INK = 0x2a2344;
const SHOT_COLOR: Record<TowerTypeId, number> = { canon: 0xff7a5c, givre: 0x5ad7ff, baliste: 0xffa63d, foudre: 0xc9a2ff, laser: 0xff4d8d, relais: 0x7dffc0 };
/** Hauteur de la tête d'une tourelle au-dessus du centre de sa case, en cases. */
/** Vue de dessus : la tête de la tourelle est centrée sur son socle. */
const HEAD_LIFT = 0;

interface TowerView {
  base: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image | null;
  angle: number;
  aim: number;
  kick: number;
}
interface Fx {
  kind: 'shot' | 'ring' | 'burst' | 'bolt';
  tower?: TowerTypeId;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
  color: number;
  life: number;
  max: number;
  splash?: number;
  seed?: number;
  /** Rebonds de la foudre, à plat [x, y, x, y, …] (en cases). */
  pts?: number[];
}

/** Centre d'une case, en unités du monde. Les coordonnées de la simulation sont en cases. */
const px = (v: number) => (v + 0.5) * TILE;

export class GameScene extends Phaser.Scene {
  private map!: GameMap;
  /** État affiché un peu en retard, entre deux états reçus : le mouvement reste fluide même si le réseau hoquette. */
  private prev: GameState | null = null;
  /** Dernier état reçu (pour interpréter les appuis). */
  private cur: GameState | null = null;
  private buffer: { at: number; state: GameState; events: GameEvent[]; played: boolean }[] = [];
  private gap = 100;
  /** Déplacement de caméra en douceur (sélection d'une tour sur téléphone). */
  private camTarget: { x: number; y: number } | null = null;
  private ready = false;
  private ui: Phaser.GameObjects.Graphics | null = null;
  private fxg: Phaser.GameObjects.Graphics | null = null;
  private fx: Fx[] = [];
  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, Phaser.GameObjects.Image>();
  private pickups = new Map<number, Phaser.GameObjects.Image>();
  private hero: Phaser.GameObjects.Image | null = null;
  private depositViews: Phaser.GameObjects.Image[] = [];
  private digViews: Phaser.GameObjects.Image[] = [];
  private heroFacing = 0;
  onTap: (tap: Tap, x: number, y: number) => void = () => {};
  selectedTower: number | null = null;
  selectedSlot: number | null = null;
  /** Compétence de zone armée : le prochain appui sur la carte la lance. */
  armed: AbilityId | null = null;
  /** La caméra suit le héros (pour le joueur qui le contrôle), sauf juste après un glissement. */
  follow = false;
  private zoom = 1;
  private cx = 0;
  private cy = 0;
  private userZoomed = false;
  private lastDrag = 0;

  constructor() {
    super('game');
  }

  preload() {
    for (const [key, art] of Object.entries(ART)) this.load.svg(key, art.url, { width: art.size, height: art.size });
  }

  /** Efface la sélection et les effets en cours (nouvelle partie, retour à l'accueil). */
  reset() {
    this.selectedTower = null;
    this.selectedSlot = null;
    this.armed = null;
    this.fx = [];
    this.buffer = [];
    this.prev = this.cur = null;
  }

  setMap(map: GameMap) {
    this.map = map;
    this.prev = this.cur = null;
    this.buffer = [];
    if (this.ready) this.drawStatic();
  }

  create() {
    this.ready = true;
    if (this.map) this.drawStatic();
    // Un appui court sélectionne ; glisser déplace la carte ; pincer (ou la molette) zoome.
    let pressed = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let pinch = 0;
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    const gap = () => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p1.isDown && p2.isDown) {
        pinch = gap();
        dragging = true;
        return;
      }
      pressed = true;
      dragging = false;
      startX = p.x;
      startY = p.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!pressed || !p.isDown) return;
      if (p1.isDown && p2.isDown) {
        const d = gap();
        if (pinch > 0 && d > 0) this.zoomBy(d / pinch);
        pinch = d;
        dragging = true;
        return;
      }
      if (!dragging && Math.hypot(p.x - startX, p.y - startY) > 10 * DPR) dragging = true;
      if (dragging && this.canPan()) {
        this.camTarget = null;
        this.cx -= (p.x - p.prevPosition.x) / this.zoom;
        this.cy -= (p.y - p.prevPosition.y) / this.zoom;
        this.lastDrag = performance.now();
        this.applyCamera();
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const tap = pressed && !dragging;
      if (!p1.isDown && !p2.isDown) pinch = 0;
      if (!this.input.activePointer.isDown && !p1.isDown && !p2.isDown) pressed = false;
      if (!tap || !this.map || !this.cur) return;
      pressed = false;
      const x = p.worldX / TILE - 0.5;
      const y = p.worldY / TILE - 0.5;
      this.onTap(this.resolveTap(x, y), x, y);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
    this.scale.on('resize', () => this.layout());
    this.layout(true);
  }

  // ------------------------------------------------------------------ caméra

  private get worldW() {
    return (this.map?.width ?? 1) * TILE;
  }
  private get worldH() {
    return (this.map?.height ?? 1) * TILE;
  }
  private fitZoom() {
    const { width, height } = this.scale.gameSize;
    return Math.min(width / this.worldW, height / this.worldH);
  }
  /** Zoom par défaut : toute la carte si elle reste lisible, sinon des cases assez grandes pour le doigt. */
  private defaultZoom() {
    const fit = this.fitZoom();
    const min = (MIN_TILE * DPR) / TILE;
    if (fit >= min) return fit;
    // Petit écran : on remplit la hauteur ou la largeur, et on fait glisser dans l'autre sens.
    const { width, height } = this.scale.gameSize;
    const cover = Math.max(width / this.worldW, height / this.worldH);
    return Math.min(DPR, Math.max(min, cover));
  }
  /** Vrai quand la carte dépasse de l'écran : on peut alors la faire glisser. */
  canPan() {
    return this.zoom > this.fitZoom() * 1.01;
  }
  /** Vrai quand on est en vue d'ensemble alors qu'un zoom plus confortable existe. */
  zoomedOut() {
    return !this.canPan() && this.defaultZoom() > this.fitZoom() * 1.01;
  }
  private layout(reset = false) {
    if (!this.map || !this.ready) return;
    if (reset) {
      this.userZoomed = false;
      this.cx = this.worldW / 2;
      this.cy = this.worldH / 2;
    }
    if (!this.userZoomed) this.zoom = this.defaultZoom();
    this.zoom = Phaser.Math.Clamp(this.zoom, this.fitZoom(), Math.max(1.8 * DPR, this.fitZoom()));
    this.applyCamera();
  }
  private applyCamera() {
    const cam = this.cameras.main;
    const { width, height } = this.scale.gameSize;
    const hw = width / this.zoom / 2;
    const hh = height / this.zoom / 2;
    this.cx = this.worldW <= hw * 2 ? this.worldW / 2 : Phaser.Math.Clamp(this.cx, hw, this.worldW - hw);
    this.cy = this.worldH <= hh * 2 ? this.worldH / 2 : Phaser.Math.Clamp(this.cy, hh, this.worldH - hh);
    cam.setZoom(this.zoom);
    cam.centerOn(this.cx, this.cy);
  }
  private zoomBy(factor: number) {
    this.zoom *= factor;
    this.userZoomed = true;
    this.lastDrag = performance.now();
    this.layout();
  }
  /** Bascule entre la vue d'ensemble et le zoom de jeu. */
  toggleOverview() {
    const fit = this.fitZoom();
    this.zoom = this.zoom > fit * 1.05 ? fit : Math.max(this.defaultZoom(), fit * 1.8);
    this.userZoomed = true;
    this.layout();
  }
  /**
   * Amène une case dans la partie de l'écran qui n'est pas couverte par un panneau.
   * biasX / biasY : décalage en part de l'écran (ex. biasY = 0.2 place la case dans le haut).
   */
  focusOn(x: number, y: number, biasX = 0, biasY = 0) {
    if (!this.canPan()) return;
    const { width, height } = this.scale.gameSize;
    this.camTarget = { x: px(x) + (width * biasX) / this.zoom, y: px(y) + (height * biasY) / this.zoom };
    this.lastDrag = performance.now();
  }

  private resolveTap(x: number, y: number): Tap {
    const s = this.cur!;
    const near = <T extends { x: number; y: number }>(list: T[], r: number) =>
      list.find((o) => Math.abs(o.x - x) <= r && Math.abs(o.y - y) <= r);
    const tower = near(s.towers, 0.5);
    if (tower) return { kind: 'tower', id: tower.id };
    const slot = near(this.map.slots, 0.5);
    if (slot) return { kind: 'slot', id: slot.id };
    const dep = near(this.map.deposits, 0.5);
    if (dep) return { kind: 'deposit', id: dep.id };
    const zone = near(this.map.prospectZones, 0.5);
    if (zone) return { kind: 'prospect', id: zone.id };
    return { kind: 'ground', x: Math.round(x), y: Math.round(y) };
  }

  // ------------------------------------------------------------------ décor

  /** Place une illustration centrée sur une case (vue de dessus). `size` est en cases. */
  private sprite(key: string, x: number, y: number, size: number) {
    const img = this.add.image(px(x), px(y), key).setOrigin(0.5, 0.5);
    img.setDisplaySize(size * TILE, size * TILE);
    img.setDepth(100);
    return img;
  }

  /** Le décor ne change jamais : on le dessine une seule fois. Planète alien aux couleurs vives. */
  private drawStatic() {
    this.children.removeAll(true);
    this.towers.clear();
    this.enemies.clear();
    this.pickups.clear();
    this.hero = null;
    const m = this.map;
    const W = m.width;
    const g = this.add.graphics();
    const rng = new Rng(m.seed ^ 0x51ed);
    const cells = (fn: (x: number, y: number, i: number) => void) => {
      for (let y = 0; y < m.height; y++) for (let x = 0; x < W; x++) fn(x, y, y * W + x);
    };

    // Sol turquoise en damier doux, bordé d'une bande plus sombre.
    g.fillStyle(0x163d33).fillRoundedRect(-16, -16, W * TILE + 32, m.height * TILE + 32, 28);
    cells((x, y) => g.fillStyle((x + y) % 2 ? 0x2f8f6b : 0x2b8864).fillRect(x * TILE, y * TILE, TILE, TILE));

    // Flore alien sur le sol libre : champignons lumineux et petites pousses.
    const reserved = new Set<number>([...m.deposits, ...m.prospectZones].map((c) => c.y * W + c.x));
    cells((x, y, i) => {
      if (m.terrain[i] !== 'ground' || reserved.has(i) || !rng.chance(0.22)) return;
      const cx = x * TILE + rng.int(12, TILE - 12);
      const cy = y * TILE + rng.int(14, TILE - 10);
      if (rng.chance(0.4)) {
        // Petit cratère : ombre intérieure et rebord éclairé.
        const r = rng.int(5, 9);
        g.fillStyle(0x1f6b50).fillEllipse(cx, cy, r * 2.4, r * 1.9);
        g.fillStyle(0x184f3c).fillEllipse(cx + 1, cy + 1, r * 1.7, r * 1.3);
        g.lineStyle(1.5, 0x5fc79a, 0.7).beginPath().arc(cx, cy, r * 1.1, Math.PI * 1.1, Math.PI * 1.9).strokePath();
      } else if (rng.chance(0.5)) {
        // Touffe de végétation alien lumineuse.
        const glow = rng.pick([0x7ef0ff, 0xb6ff5a, 0xff8fd0, 0xffe066]);
        g.fillStyle(0x1f6b50).fillCircle(cx, cy, 7);
        for (let k = 0; k < 5; k++) g.fillStyle(0x3fae7c).fillCircle(cx + Math.cos(k * 1.26) * 5, cy + Math.sin(k * 1.26) * 5, 3.2);
        g.fillStyle(glow).fillCircle(cx, cy, 2.6);
      } else {
        g.fillStyle(0x1f6b50, 0.8).fillCircle(cx + 2, cy + 2, 4);
        g.fillStyle(0x9aa6bd).fillCircle(cx, cy, 3.6);
        g.fillStyle(0xdfe6f5).fillCircle(cx - 1, cy - 1, 1.5);
      }
    });

    // Route : liseré violet sombre puis dalles claires, avec des coulées de gel collant (ralentit).
    const mud = new Set(m.mud);
    cells((x, y, i) => m.terrain[i] === 'path' && g.fillStyle(0x0d1220).fillRoundedRect(x * TILE - 5, y * TILE - 5, TILE + 10, TILE + 10, 12));
    cells((x, y, i) => m.terrain[i] === 'path' && g.fillStyle(0x4b5878).fillRoundedRect(x * TILE - 1, y * TILE - 1, TILE + 2, TILE + 2, 9));
    cells((x, y, i) => {
      if (m.terrain[i] !== 'path') return;
      if (mud.has(i)) {
        g.fillStyle(0x6a3fc0).fillRoundedRect(x * TILE - 1, y * TILE - 1, TILE + 2, TILE + 2, 9);
        g.fillStyle(0x9a5cff);
        for (let k = 0; k < 3; k++) g.fillEllipse(x * TILE + rng.int(10, 38), y * TILE + rng.int(10, 38), rng.int(8, 14), rng.int(5, 8));
        g.fillStyle(0xf0d6ff, 0.9).fillCircle(x * TILE + rng.int(10, 38), y * TILE + rng.int(10, 38), 2.5);
      } else {
        // Dalle métallique avec reflet et rivets.
        g.fillStyle(0x3b4664).fillRoundedRect(x * TILE + 4, y * TILE + 4, TILE - 8, TILE - 8, 6);
        g.fillStyle(0x566489).fillRoundedRect(x * TILE + 6, y * TILE + 6, TILE - 12, TILE - 14, 5);
        g.fillStyle(0x7584ab, 0.6).fillRoundedRect(x * TILE + 9, y * TILE + 8, TILE - 18, 5, 2.5);
        g.fillStyle(0x1d2438);
        for (const [dx, dy] of [[9, 9], [TILE - 9, 9], [9, TILE - 9], [TILE - 9, TILE - 9]]) g.fillCircle(x * TILE + dx, y * TILE + dy, 1.8);
      }
    });

    // Emplacements de construction : plots métalliques à anneau lumineux (doré sur les points hauts).
    for (const s of m.slots) {
      const cx = px(s.x);
      const cy = px(s.y);
      g.fillStyle(0x0d1220, 0.35).fillCircle(cx + 2, cy + 3, 21);
      g.fillStyle(INK).fillCircle(cx, cy, 20);
      g.fillStyle(0x7c8bb8).fillCircle(cx, cy, 17);
      g.fillStyle(0xaab6d6).fillCircle(cx, cy - 1.5, 14.5);
      g.fillStyle(INK).fillCircle(cx, cy, 8);
      g.fillStyle(s.high ? 0xffd84a : 0x5ad7ff).fillCircle(cx, cy, 5.5);
      if (s.high) g.lineStyle(3, 0xffd84a).strokeCircle(cx, cy, 22);
    }

    cells((x, y, i) => m.terrain[i] === 'rock' && this.sprite('rock', x, y, 0.95));
    this.depositViews = m.deposits.map((d) => this.sprite('deposit', d.x, d.y, 0.98));
    this.digViews = m.prospectZones.map((z) => this.sprite('dig', z.x, z.y, 0.98));
    for (const sp of m.spawns) this.sprite('portal', sp.x, sp.y, 1.35);
    this.sprite('base', m.base.x, m.base.y, 1.9).setDepth(101);

    this.ui = this.add.graphics().setDepth(5000);
    this.fxg = this.add.graphics().setDepth(6000);
    this.layout(true);
  }

  // ------------------------------------------------------------------ états et effets

  pushState(state: GameState, events: GameEvent[]) {
    const now = performance.now();
    const last = this.buffer[this.buffer.length - 1];
    if (last) this.gap = this.gap * 0.85 + Math.min(300, Math.max(30, now - last.at)) * 0.15;
    this.buffer.push({ at: now, state, events, played: false });
    if (this.buffer.length > 30) this.buffer.splice(0, this.buffer.length - 30);
    this.cur = state;
  }

  /** Effets visuels d'un état : joués au moment où cet état s'affiche, pour rester en phase avec les positions. */
  private playEvents(state: GameState, events: GameEvent[]) {
    const ring = (x: number, y: number, r: number, color: number, life: number) =>
      this.fx.push({ kind: 'ring', x1: x, y1: y, x2: 0, y2: 0, r, color, life, max: life });
    for (const e of events) {
      if (e.t === 'shot') {
        // Le projectile est purement visuel : il part de la tête de la tourelle vers la cible.
        // La foudre et le rayon sont des traits continus un peu plus longs ; les autres tirs sont des projectiles rapides.
        const life = e.kind === 'foudre' ? 0.2 : e.kind === 'laser' ? 0.13 : 0.14;
        this.fx.push({ kind: 'shot', tower: e.kind, x1: e.fx, y1: e.fy - HEAD_LIFT, x2: e.tx, y2: e.ty, r: 0, color: SHOT_COLOR[e.kind], life, max: life, splash: e.splash, pts: e.chain, seed: (e.fx * 31 + e.fy * 17 + e.tx * 7 + e.ty * 3) | 0 });
        for (const [id, view] of this.towers) {
          const t = state.towers.find((q) => q.id === id);
          if (t && t.x === e.fx && t.y === e.fy) {
            view.aim = Math.atan2(e.ty - e.fy + HEAD_LIFT, e.tx - e.fx);
            view.kick = 1;
          }
        }
      } else if (e.t === 'death') {
        const life = e.boss ? 0.7 : 0.4;
        this.fx.push({ kind: 'burst', x1: e.x, y1: e.y, x2: 0, y2: 0, r: e.boss ? 2 : 0.7, color: e.boss ? 0xffd84a : 0xffffff, life, max: life, seed: (e.x * 31 + e.y * 17) % 7 });
      } else if (e.t === 'ability') {
        if (e.id === 'foudre') this.fx.push({ kind: 'bolt', x1: e.x, y1: e.y, x2: 0, y2: 0, r: e.radius, color: 0xfff36b, life: 0.45, max: 0.45, seed: e.x * 13 + e.y });
        else ring(e.x, e.y, e.radius, e.id === 'ralentir' ? 0x5ad7ff : 0xffd84a, 0.7);
      } else if (e.t === 'hit') ring(e.x, e.y, 0.55, 0xff5d5d, 0.25);
      else if (e.t === 'heal') ring(e.x, e.y, e.radius, 0x7dffc0, 0.6);
      else if (e.t === 'blast') {
        ring(e.x, e.y, e.radius, 0xff8a3d, 0.4);
        this.fx.push({ kind: 'burst', x1: e.x, y1: e.y, x2: 0, y2: 0, r: e.radius * 1.4, color: 0xff5d3d, life: 0.45, max: 0.45, seed: (e.x * 13 + e.y) % 7 });
      }
    }
    if (this.fx.length > 300) this.fx.splice(0, this.fx.length - 300);
  }

  /** Barre arrondie avec contour épais. */
  private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number) {
    g.fillStyle(INK).fillRoundedRect(x - w / 2 - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 1) g.fillStyle(color).fillRoundedRect(x - w / 2, y, Math.max(h, fw), h, h / 2);
  }

  update(time: number, deltaMs: number) {
    const g = this.ui;
    const f = this.fxg;
    if (!this.buffer.length || !g || !f) return;
    // On affiche le jeu avec un léger retard (1,5 intervalle entre deux états), en interpolant entre les deux
    // états qui encadrent ce moment. Si un état arrive en retard, le mouvement ralentit au lieu de sauter.
    const now = performance.now();
    const renderAt = now - this.gap * 1.5;
    const buf = this.buffer;
    let i = buf.length - 1;
    while (i > 0 && buf[i].at > renderAt) i--;
    const A = buf[i];
    const B = buf[Math.min(i + 1, buf.length - 1)];
    for (const entry of buf) {
      if (entry.played || entry.at > B.at) continue;
      entry.played = true;
      // Après une longue absence (onglet en arrière-plan), on ne rejoue pas les vieux effets.
      if (renderAt - entry.at < 600) this.playEvents(entry.state, entry.events);
    }
    if (i > 0) buf.splice(0, i);
    const s = B.state;
    this.prev = A === B ? null : A.state;
    const a = A === B ? 1 : Math.min(1, Math.max(0, (renderAt - A.at) / (B.at - A.at)));
    const dt = deltaMs / 1000;
    const t = time / 1000;
    g.clear();
    f.clear();
    if (this.camTarget) {
      this.cx += (this.camTarget.x - this.cx) * Math.min(1, dt * 9);
      this.cy += (this.camTarget.y - this.cy) * Math.min(1, dt * 9);
      if (Math.hypot(this.camTarget.x - this.cx, this.camTarget.y - this.cy) < 1) this.camTarget = null;
      this.applyCamera();
    } else if (this.follow && s.hero.respawnIn <= 0 && this.canPan() && performance.now() - this.lastDrag > 2500) {
      this.cx += (px(s.hero.x) - this.cx) * 0.08;
      this.cy += (px(s.hero.y) - this.cy) * 0.08;
      this.applyCamera();
    }
    const lerp = (from: number | undefined, to: number) => (from === undefined ? to : from + (to - from) * a);

    // ---- sélection
    if (this.selectedSlot !== null) {
      const sl = this.map.slots[this.selectedSlot];
      if (sl) {
        const r = 25 + Math.sin(t * 6) * 2;
        g.lineStyle(6, INK).strokeCircle(px(sl.x), px(sl.y), r);
        g.lineStyle(3, 0xffffff).strokeCircle(px(sl.x), px(sl.y), r);
      }
    }
    const sel = s.towers.find((q) => q.id === this.selectedTower);
    if (sel) {
      const st = effectiveTowerStats(sel, s.towers, this.map);
      g.fillStyle(0xffffff, 0.14).fillCircle(px(sel.x), px(sel.y), st.range * TILE);
      g.lineStyle(3, 0xffffff, 0.9).strokeCircle(px(sel.x), px(sel.y), st.range * TILE);
      if (st.minRange > 0) g.lineStyle(2, 0xff5d5d, 0.8).strokeCircle(px(sel.x), px(sel.y), st.minRange * TILE);
      // Relais : zone d'effet de l'aura, et les tours qu'elle touche.
      const aura = baseTowerStats(sel).auraRadius;
      if (aura > 0) {
        g.fillStyle(0x7dffc0, 0.12).fillCircle(px(sel.x), px(sel.y), aura * TILE);
        g.lineStyle(3, 0x7dffc0, 0.9).strokeCircle(px(sel.x), px(sel.y), aura * TILE);
        for (const o of s.towers) {
          if (o.id !== sel.id && Math.hypot(o.x - sel.x, o.y - sel.y) <= aura) g.lineStyle(3, 0x7dffc0, 0.9).strokeCircle(px(o.x), px(o.y), TILE * 0.6);
        }
      }
    }

    // ---- tourelles
    const seenTowers = new Set<number>();
    for (const tw of s.towers) {
      seenTowers.add(tw.id);
      let view = this.towers.get(tw.id);
      if (!view) {
        const headless = HEADLESS_TOWERS.has(tw.type);
        const base = this.sprite(headless ? tw.type : `${tw.type}_base`, tw.x, tw.y, 1);
        const head = headless ? null : this.add.image(0, 0, `${tw.type}_head`).setOrigin(0.5, 0.5);
        view = { base, head, angle: 0, aim: 0, kick: 0 };
        this.towers.set(tw.id, view);
      }
      const x = px(tw.x);
      const y = px(tw.y);
      const tier = 1 + 0.09 * tw.path.length;
      const dead = tw.hp <= 0;
      const alpha = tw.disabledFor > 0 ? 0.55 : 1;
      const pulse = HEADLESS_TOWERS.has(tw.type) && !dead ? 1 + Math.sin(t * (tw.type === 'foudre' ? 7 : 3) + tw.id) * (tw.type === 'foudre' ? 0.04 : 0.03) : 1;
      view.base.setPosition(x, y).setDisplaySize(1.02 * TILE * tier * pulse, 1.02 * TILE * tier * pulse).setAlpha(alpha).setDepth(110);
      if (dead) view.base.setTint(0x66667a);
      else view.base.clearTint();
      if (view.head) {
        // La tête pivote vers la dernière cible, avec un petit recul à chaque tir.
        view.angle = Phaser.Math.Angle.RotateTo(view.angle, view.aim, dt * 14);
        view.kick = Math.max(0, view.kick - dt * 7);
        const back = view.kick * 5;
        view.head
          .setPosition(x - Math.cos(view.angle) * back, y - TILE * HEAD_LIFT * tier - Math.sin(view.angle) * back)
          .setDisplaySize(1.12 * TILE * tier, 1.12 * TILE * tier)
          .setRotation(view.angle)
          .setAlpha(alpha)
          .setDepth(130);
        if (dead) view.head.setTint(0x66667a);
        else view.head.clearTint();
      }
      if (tw.overchargeFor > 0) g.lineStyle(4, 0xfff36b, 0.6 + Math.sin(t * 16) * 0.4).strokeCircle(x, y, TILE * 0.62);
      // Pastilles de niveau.
      for (let k = 0; k < tw.path.length; k++) {
        const sx = x + (k - (tw.path.length - 1) / 2) * 11;
        g.fillStyle(INK).fillCircle(sx, y + TILE * 0.52, 5.5);
        g.fillStyle(0xffd84a).fillCircle(sx, y + TILE * 0.52, 3.6);
      }
      if (tw.aiPriority !== 'normal') {
        g.fillStyle(INK).fillCircle(x + TILE * 0.42, y - TILE * 0.42, 7.5);
        g.fillStyle(tw.aiPriority === 'high' ? 0xffd84a : 0xff5d5d).fillCircle(x + TILE * 0.42, y - TILE * 0.42, 5.5);
      }
      if (tw.id === this.selectedTower) {
        g.lineStyle(6, INK).strokeCircle(x, y, 27);
        g.lineStyle(3, 0xffffff).strokeCircle(x, y, 27);
      }
      // Barre de vie, affichée seulement si utile. Sa largeur diminue avec l'usure définitive.
      const max = towerMaxHp(tw);
      const top = y - TILE * 0.68 * tier;
      if (tw.hp < max - 0.5 || tw.maxHpFactor < 1) {
        const frac = tw.hp / max;
        this.bar(g, x, top, TILE * 0.86 * tw.maxHpFactor, 6, frac, frac > 0.5 ? 0x5fe07a : frac > 0.25 ? 0xffc93c : 0xff5d5d);
      }
      const ammoMax = baseTowerStats(tw).ammo;
      if (ammoMax > 0) this.bar(g, x, top - 9, TILE * 0.6, 4, tw.ammo / ammoMax, tw.ammo === 0 ? 0xff5d5d : 0xfff36b);
      if (dead) {
        g.fillStyle(INK).fillCircle(x, y, 11);
        g.fillStyle(0xff5d5d).fillCircle(x, y, 9);
        g.fillStyle(0xffffff).fillRoundedRect(x - 1.8, y - 6, 3.6, 7, 1.5).fillCircle(x, y + 4.5, 1.9);
      }
    }
    for (const [id, view] of this.towers) {
      if (seenTowers.has(id)) continue;
      view.base.destroy();
      view.head?.destroy();
      this.towers.delete(id);
    }

    // ---- ennemis
    const prevEnemies = new Map(this.prev?.enemies.map((e) => [e.id, e]));
    const seenEnemies = new Set<number>();
    for (const e of s.enemies) {
      seenEnemies.add(e.id);
      const p = prevEnemies.get(e.id);
      const x = px(lerp(p?.x, e.x));
      const y = px(lerp(p?.y, e.y));
      const edef = ENEMIES[e.type];
      const size = edef.size * TILE;
      let img = this.enemies.get(e.id);
      if (!img) {
        img = this.add.image(x, y, e.type).setOrigin(0.5, 0.5);
        if (p) img.setRotation(Math.atan2(e.y - p.y, e.x - p.x));
        this.enemies.set(e.id, img);
      }
      // Vue de dessus : l'ennemi pivote vers sa direction, avec une légère ondulation de marche.
      const boss = !!ENEMIES[e.type].boss;
      const wob = Math.sin(t * (5 + ENEMIES[e.type].speed * 4) + e.id);
      if (p && Math.hypot(e.x - p.x, e.y - p.y) > 0.001) img.setRotation(Phaser.Math.Angle.RotateTo(img.rotation, Math.atan2(e.y - p.y, e.x - p.x), dt * 9));
      img.setPosition(x, y).setDisplaySize(size * (1 + wob * 0.03), size * (1 - wob * 0.04)).setDepth(boss ? 141 : 140);
      if (e.slowFor > 0) img.setTint(0x9fdcff);
      else img.clearTint();
      if (edef.heals) g.fillStyle(0x7dffc0, 0.07).fillCircle(x, y, edef.heals.radius * TILE).lineStyle(2, 0x7dffc0, 0.35).strokeCircle(x, y, edef.heals.radius * TILE);
      if (e.shield > 0) {
        g.fillStyle(0x8be6ff, 0.22).fillCircle(x, y, size * 0.6);
        g.lineStyle(3, 0xd8f6ff, 0.9).strokeCircle(x, y, size * 0.6);
      }
      if (e.dotFor > 0) {
        const fy = y - size * 0.62 - Math.sin(t * 12 + e.id) * 2;
        g.fillStyle(0xff7a1a).fillTriangle(x - 5, fy + 5, x + 5, fy + 5, x, fy - 8);
        g.fillStyle(0xffe066).fillTriangle(x - 2.5, fy + 5, x + 2.5, fy + 5, x, fy - 2);
      }
      if (boss) this.bar(g, x, y - size * 0.66, TILE * 1.6, 8, e.hp / e.maxHp, 0xff5d5d);
      else if (e.hp < e.maxHp) this.bar(g, x, y - size * 0.66, TILE * 0.6, 5, e.hp / e.maxHp, 0xff5d5d);
    }
    for (const [id, img] of this.enemies) {
      if (seenEnemies.has(id)) continue;
      img.destroy();
      this.enemies.delete(id);
    }

    // ---- ressources au sol
    const seenPickups = new Set<number>();
    for (const p of s.pickups) {
      seenPickups.add(p.id);
      let img = this.pickups.get(p.id);
      if (!img) {
        img = this.add.image(px(p.x), px(p.y), 'bolt').setOrigin(0.5, 0.5);
        this.pickups.set(p.id, img);
      }
      const size = TILE * (0.36 + Math.min(0.2, p.value / 120));
      const beat = 1 + Math.sin(t * 6 + p.id) * 0.12;
      img.setPosition(px(p.x), px(p.y)).setDisplaySize(size * 1.5 * beat, size * 1.5 * beat).setRotation(t * 1.5 + p.id).setDepth(120);
      img.setAlpha(p.ttl < 3 ? 0.4 + Math.abs(Math.sin(t * 10)) * 0.6 : 1);
    }
    for (const [id, img] of this.pickups) {
      if (seenPickups.has(id)) continue;
      img.destroy();
      this.pickups.delete(id);
    }
    this.depositViews.forEach((img, i) => (s.deposits[i] <= 0 ? img.setTint(0x777788).setAlpha(0.6) : img.clearTint().setAlpha(1)));
    this.digViews.forEach((img, i) => (s.prospects[i] > s.wave ? img.setTint(0x777788).setAlpha(0.6) : img.clearTint().setAlpha(1)));

    // ---- héros
    const h = s.hero;
    if (!this.hero) this.hero = this.add.image(0, 0, 'hero').setOrigin(0.5, 0.5);
    this.hero.setVisible(h.respawnIn <= 0);
    if (h.respawnIn <= 0) {
      const ph = this.prev && this.prev.hero.respawnIn <= 0 ? this.prev.hero : undefined;
      const x = px(lerp(ph?.x, h.x));
      const y = px(lerp(ph?.y, h.y));
      const moving = !!ph && Math.hypot(h.x - ph.x, h.y - ph.y) > 0.01;
      const working = h.progress > 0 && !moving && h.task.kind !== 'idle';
      if (moving && ph) this.heroFacing = Phaser.Math.Angle.RotateTo(this.heroFacing, Math.atan2(h.y - ph.y, h.x - ph.x), dt * 12);
      const size = TILE * 1.05;
      // Halo au sol : bleu quand l'IA pilote, vert quand c'est un joueur.
      g.lineStyle(3, s.heroController === 'ai' ? 0x5ad7ff : 0x5fe07a, 0.55 + Math.sin(t * 4) * 0.25).strokeCircle(x, y, size * 0.6);
      this.hero
        .setPosition(x, y)
        .setDisplaySize(size, size)
        .setRotation(this.heroFacing + (working ? Math.sin(t * 20) * 0.18 : 0))
        .setDepth(150);
      const stats = heroStats(h.upgrades);
      this.bar(g, x, y - size * 0.74, TILE * 0.8, 6, h.hp / stats.maxHp, 0x5fe07a);
      if (h.carry > 0) this.bar(g, x, y - size * 0.74 + 9, TILE * 0.8, 4, h.carry / stats.carryCap, 0xffd84a);
      if (working) {
        const end = -Math.PI / 2 + Math.PI * 2 * Math.min(1, h.progress);
        g.lineStyle(8, INK).beginPath().arc(x, y, TILE * 0.72, -Math.PI / 2, end).strokePath();
        g.lineStyle(4, 0xfff36b).beginPath().arc(x, y, TILE * 0.72, -Math.PI / 2, end).strokePath();
      }
      if (h.task.kind === 'move') {
        const r = 7 + Math.sin(t * 8) * 2;
        g.lineStyle(6, INK, 0.8).strokeCircle(px(h.task.x), px(h.task.y), r);
        g.lineStyle(3, 0xffffff).strokeCircle(px(h.task.x), px(h.task.y), r);
      }
    }

    if (this.armed) {
      const p = this.input.activePointer;
      g.fillStyle(0xfff36b, 0.18).fillCircle(p.worldX, p.worldY, ABILITIES[this.armed].radius * TILE);
      g.lineStyle(3, 0xfff36b, 0.95).strokeCircle(p.worldX, p.worldY, ABILITIES[this.armed].radius * TILE);
    }

    // ---- effets
    const next: Fx[] = [];
    for (const e of this.fx) {
      e.life -= dt;
      const k = 1 - Math.max(0, e.life) / e.max; // 0 -> 1
      if (e.kind === 'shot' && (e.tower === 'foudre' || e.tower === 'laser')) {
        const fade = 1 - k * 0.7;
        if (e.tower === 'laser') {
          // Rayon : un trait net de la tourelle à la cible, avec un point chaud à l'impact.
          const ax = px(e.x1), ay = px(e.y1), bx = px(e.x2), by = px(e.y2);
          f.lineStyle(9, INK, fade).lineBetween(ax, ay, bx, by);
          f.lineStyle(5, e.color, fade).lineBetween(ax, ay, bx, by);
          f.lineStyle(2, 0xffffff, fade).lineBetween(ax, ay, bx, by);
          f.fillStyle(0xffffff, fade).fillCircle(bx, by, 5);
        } else {
          // Foudre : zigzag de la tour vers la cible puis de rebond en rebond ; il scintille un peu à chaque image.
          const chain = [e.x1, e.y1, e.x2, e.y2, ...(e.pts ?? [])];
          const zig = new Rng(((e.seed ?? 1) + Math.floor(e.life * 40)) | 0);
          const path: number[][] = [[px(chain[0]), px(chain[1])]];
          for (let i = 2; i < chain.length; i += 2) {
            const ax = path[path.length - 1][0], ay = path[path.length - 1][1];
            const bx = px(chain[i]), by = px(chain[i + 1]);
            const len = Math.hypot(bx - ax, by - ay) || 1;
            const nx = -(by - ay) / len, ny = (bx - ax) / len;
            const n = Math.max(2, Math.round(len / 18));
            for (let j = 1; j < n; j++) {
              const off = zig.int(-7, 7);
              path.push([ax + ((bx - ax) * j) / n + nx * off, ay + ((by - ay) * j) / n + ny * off]);
            }
            path.push([bx, by]);
          }
          for (const [w, c] of [[8, INK], [4.5, e.color], [1.8, 0xffffff]] as [number, number][]) {
            f.lineStyle(w, c, fade);
            f.beginPath().moveTo(path[0][0], path[0][1]);
            for (const p of path.slice(1)) f.lineTo(p[0], p[1]);
            f.strokePath();
          }
        }
        if (e.life <= 0) {
          next.push({ kind: 'burst', x1: e.x2, y1: e.y2, x2: 0, y2: 0, r: 0.35, color: e.color, life: 0.22, max: 0.22, seed: 1 });
          for (let i = 0; e.pts && i < e.pts.length; i += 2) next.push({ kind: 'burst', x1: e.pts[i], y1: e.pts[i + 1], x2: 0, y2: 0, r: 0.28, color: e.color, life: 0.2, max: 0.2, seed: i });
          if (e.splash) next.push({ kind: 'ring', x1: e.x2, y1: e.y2, x2: 0, y2: 0, r: e.splash, color: e.color, life: 0.3, max: 0.3 });
        }
      } else if (e.kind === 'shot') {
        const x = px(e.x1 + (e.x2 - e.x1) * k);
        const y = px(e.y1 + (e.y2 - e.y1) * k);
        const ang = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
        // Traits d'énergie : long pour le canon électromagnétique, court pour le plasma, bille pour le cryo.
        const len = e.tower === 'baliste' ? 26 : e.tower === 'canon' ? 12 : 0;
        if (len) {
          f.lineStyle(9, INK).lineBetween(x - Math.cos(ang) * len, y - Math.sin(ang) * len, x, y);
          f.lineStyle(5, e.color).lineBetween(x - Math.cos(ang) * len, y - Math.sin(ang) * len, x, y);
          f.lineStyle(2, 0xffffff).lineBetween(x - Math.cos(ang) * len * 0.6, y - Math.sin(ang) * len * 0.6, x, y);
        } else {
          f.fillStyle(INK).fillCircle(x, y, 7);
          f.fillStyle(e.color).fillCircle(x, y, 5);
          f.fillStyle(0xffffff).fillCircle(x - 1.5, y - 1.5, 1.8);
        }
        if (e.life <= 0) {
          // Impact : éclat, plus une onde si le tir fait des dégâts de zone.
          next.push({ kind: 'burst', x1: e.x2, y1: e.y2, x2: 0, y2: 0, r: 0.35, color: e.color, life: 0.22, max: 0.22, seed: 1 });
          if (e.splash) next.push({ kind: 'ring', x1: e.x2, y1: e.y2, x2: 0, y2: 0, r: e.splash, color: e.color, life: 0.3, max: 0.3 });
        }
      } else if (e.kind === 'ring') {
        const r = e.r * TILE * (0.5 + 0.5 * k);
        f.fillStyle(e.color, 0.3 * (1 - k)).fillCircle(px(e.x1), px(e.y1), r);
        f.lineStyle(4, e.color, 1 - k).strokeCircle(px(e.x1), px(e.y1), r);
      } else if (e.kind === 'burst') {
        const n = e.r > 1 ? 12 : 7;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + (e.seed ?? 0);
          const d = e.r * TILE * k;
          const r = (e.r > 1 ? 7 : 4.5) * (1 - k) + 1;
          f.fillStyle(INK, 1 - k).fillCircle(px(e.x1) + Math.cos(ang) * d, px(e.y1) + Math.sin(ang) * d, r + 1.5);
          f.fillStyle(i % 2 ? e.color : 0xffd84a, 1 - k).fillCircle(px(e.x1) + Math.cos(ang) * d, px(e.y1) + Math.sin(ang) * d, r);
        }
      } else {
        // Foudre : un éclair en zigzag qui tombe du ciel, puis un flash.
        const zig = new Rng((e.seed ?? 1) | 0);
        let x = px(e.x1);
        let y = px(e.y1);
        const pts: number[][] = [[x, y]];
        for (let i = 0; i < 6; i++) {
          x += zig.int(-18, 18);
          y -= 46;
          pts.push([x, y]);
        }
        for (const [w, c] of [[9, INK], [5, e.color]] as [number, number][]) {
          f.lineStyle(w, c, 1 - k);
          f.beginPath().moveTo(pts[0][0], pts[0][1]);
          for (const p of pts.slice(1)) f.lineTo(p[0], p[1]);
          f.strokePath();
        }
        f.fillStyle(0xffffff, 0.5 * (1 - k)).fillCircle(px(e.x1), px(e.y1), e.r * TILE);
        f.lineStyle(4, e.color, 1 - k).strokeCircle(px(e.x1), px(e.y1), e.r * TILE);
      }
      if (e.life > 0) next.push(e);
    }
    this.fx = next;
  }
}

export function createGame(parent: HTMLElement, map: GameMap) {
  const scene = new GameScene();
  scene.setMap(map);
  const rect = parent.getBoundingClientRect();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#163d33',
    // Le canvas est rendu à la densité de l'écran, puis ramené à sa taille d'affichage : image nette sur mobile.
    scale: { mode: Phaser.Scale.NONE, width: Math.max(1, rect.width) * DPR, height: Math.max(1, rect.height) * DPR, zoom: 1 / DPR, expandParent: false },
    scene,
    banner: false,
    input: { activePointers: 3 },
  });
  /** À appeler quand la zone de jeu change de taille (en pixels CSS). */
  let lastW = 0;
  let lastH = 0;
  const resize = (width: number, height: number) => {
    // Tailles entières, et on ignore les variations infimes : redimensionner le canvas l'efface (flash).
    const w = Math.floor(width * DPR);
    const h = Math.floor(height * DPR);
    if (w <= 0 || h <= 0 || (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2)) return;
    lastW = w;
    lastH = h;
    game.scale.resize(w, h);
  };
  return { game, scene, resize };
}

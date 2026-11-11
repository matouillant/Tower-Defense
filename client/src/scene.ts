import Phaser from 'phaser';
import { ABILITIES, AbilityId, ENEMIES, GameEvent, GameMap, GameState, effectiveTowerStats, baseTowerStats, towerMaxHp, heroStats } from '@td/shared';

export const TILE = 48;
/** Taille minimale d'une case à l'écran, en pixels, pour rester confortable au doigt. */
const MIN_TILE = 34;

export type Tap =
  | { kind: 'tower'; id: number }
  | { kind: 'slot'; id: number }
  | { kind: 'deposit'; id: number }
  | { kind: 'prospect'; id: number }
  | { kind: 'ground'; x: number; y: number };

const TOWER_COLOR = { canon: 0x9fb0c8, givre: 0x4cc9f0, baliste: 0xe07a5f } as const;
const ENEMY_STYLE: Record<string, { color: number; r: number }> = {
  grunt: { color: 0xd94a3d, r: 0.2 },
  runner: { color: 0xf79d2a, r: 0.15 },
  brute: { color: 0x8c1c13, r: 0.3 },
  bouclier: { color: 0x9d5cd6, r: 0.22 },
  colosse: { color: 0x3a0d0d, r: 0.46 },
  reine: { color: 0x5a1a7a, r: 0.42 },
};

interface Fx {
  kind: 'line' | 'ring';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
  color: number;
  life: number;
  max: number;
}

/** Centre d'une case, en pixels. Les coordonnées de la simulation sont en cases. */
const px = (v: number) => (v + 0.5) * TILE;

export class GameScene extends Phaser.Scene {
  private map!: GameMap;
  private prev: GameState | null = null;
  private cur: GameState | null = null;
  private curAt = 0;
  private interval = 100;
  private g: Phaser.GameObjects.Graphics | null = null;
  private fx: Fx[] = [];
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

  setMap(map: GameMap) {
    this.map = map;
    this.prev = this.cur = null;
    if (this.g) this.drawStatic();
  }

  create() {
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
      if (!dragging && Math.hypot(p.x - startX, p.y - startY) > 10) dragging = true;
      if (dragging && this.canPan()) {
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
    if (fit * TILE >= MIN_TILE) return fit;
    // Petit écran : on remplit la hauteur ou la largeur, et on fait glisser dans l'autre sens.
    const { width, height } = this.scale.gameSize;
    const cover = Math.max(width / this.worldW, height / this.worldH);
    return Math.min(1, Math.max(MIN_TILE / TILE, cover));
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
    if (!this.map) return;
    if (reset) {
      this.userZoomed = false;
      this.cx = this.worldW / 2;
      this.cy = this.worldH / 2;
    }
    if (!this.userZoomed) this.zoom = this.defaultZoom();
    this.zoom = Phaser.Math.Clamp(this.zoom, this.fitZoom(), Math.max(1.6, this.fitZoom()));
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
    this.cx = px(x) + (width * biasX) / this.zoom;
    this.cy = px(y) + (height * biasY) / this.zoom;
    this.lastDrag = performance.now();
    this.applyCamera();
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

  /** Le décor ne change jamais : on le dessine une seule fois. */
  private drawStatic() {
    this.children.removeAll(true);
    const m = this.map;
    const bg = this.add.graphics();
    bg.fillStyle(0x23301f).fillRect(0, 0, m.width * TILE, m.height * TILE);
    const mud = new Set(m.mud);
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) {
        const i = y * m.width + x;
        const t = m.terrain[i];
        if (t === 'path') bg.fillStyle(mud.has(i) ? 0x5b4a33 : 0x8a7a5c).fillRect(x * TILE, y * TILE, TILE, TILE);
        else if (t === 'rock') bg.fillStyle(0x555b63).fillRoundedRect(x * TILE + 6, y * TILE + 6, TILE - 12, TILE - 12, 10);
      }
    for (const s of m.slots) {
      bg.lineStyle(2, s.high ? 0xf2c14e : 0x6f8f66, 0.9).strokeRoundedRect(s.x * TILE + 5, s.y * TILE + 5, TILE - 10, TILE - 10, 6);
      if (s.high) bg.fillStyle(0xf2c14e, 0.12).fillRoundedRect(s.x * TILE + 5, s.y * TILE + 5, TILE - 10, TILE - 10, 6);
    }
    const label = (x: number, y: number, text: string, color: string) =>
      this.add.text(px(x), px(y), text, { fontFamily: 'system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold', color }).setOrigin(0.5);
    for (const d of m.deposits) {
      bg.fillStyle(0xb5762a).fillCircle(px(d.x), px(d.y), TILE * 0.36);
      label(d.x, d.y, '$', '#fff3c4');
    }
    for (const z of m.prospectZones) {
      bg.lineStyle(3, 0xc77dff).strokeCircle(px(z.x), px(z.y), TILE * 0.34);
      label(z.x, z.y, '?', '#e0b3ff');
    }
    for (const sp of m.spawns) label(sp.x, sp.y, '▶', '#ffb4a8');
    bg.fillStyle(0x3d7ea6).fillRoundedRect(m.base.x * TILE + 3, m.base.y * TILE + 3, TILE - 6, TILE - 6, 8);
    label(m.base.x, m.base.y, '⌂', '#ffffff');
    this.g = this.add.graphics();
    if (this.cameras?.main) this.layout(true);
  }

  pushState(state: GameState, events: GameEvent[]) {
    const now = performance.now();
    if (this.cur) this.interval = Math.min(250, Math.max(50, now - this.curAt));
    this.prev = this.cur;
    this.cur = state;
    this.curAt = now;
    for (const e of events) {
      if (e.t === 'shot') {
        const color = TOWER_COLOR[e.kind];
        this.fx.push({ kind: 'line', x1: e.fx, y1: e.fy, x2: e.tx, y2: e.ty, r: 0, color, life: 0.12, max: 0.12 });
        if (e.splash > 0) this.fx.push({ kind: 'ring', x1: e.tx, y1: e.ty, x2: 0, y2: 0, r: e.splash, color, life: 0.25, max: 0.25 });
      } else if (e.t === 'death') this.fx.push({ kind: 'ring', x1: e.x, y1: e.y, x2: 0, y2: 0, r: e.boss ? 1.2 : 0.4, color: 0xffffff, life: 0.3, max: 0.3 });
      else if (e.t === 'ability') this.fx.push({ kind: 'ring', x1: e.x, y1: e.y, x2: 0, y2: 0, r: e.radius, color: e.id === 'ralentir' ? 0x4cc9f0 : 0xfff275, life: 0.6, max: 0.6 });
      else if (e.t === 'hit') this.fx.push({ kind: 'ring', x1: e.x, y1: e.y, x2: 0, y2: 0, r: 0.5, color: 0xff5544, life: 0.2, max: 0.2 });
    }
    if (this.fx.length > 300) this.fx.splice(0, this.fx.length - 300);
  }

  update(_time: number, deltaMs: number) {
    const s = this.cur;
    if (!s || !this.g) return;
    const g = this.g;
    g.clear();
    if (this.follow && s.hero.respawnIn <= 0 && this.canPan() && performance.now() - this.lastDrag > 2500) {
      this.cx += (px(s.hero.x) - this.cx) * 0.08;
      this.cy += (px(s.hero.y) - this.cy) * 0.08;
      this.applyCamera();
    }
    // Interpolation entre les deux derniers états reçus, pour un mouvement fluide.
    const a = Math.min(1, (performance.now() - this.curAt) / this.interval);
    const lerp = (from: number | undefined, to: number) => (from === undefined ? to : from + (to - from) * a);

    // Sélection : emplacement ou tour, avec sa portée.
    if (this.selectedSlot !== null) {
      const sl = this.map.slots[this.selectedSlot];
      if (sl) g.lineStyle(3, 0xffffff).strokeRoundedRect(sl.x * TILE + 3, sl.y * TILE + 3, TILE - 6, TILE - 6, 6);
    }
    const sel = s.towers.find((t) => t.id === this.selectedTower);
    if (sel) {
      const st = effectiveTowerStats(sel, s.towers, this.map);
      g.lineStyle(2, 0xffffff, 0.5).strokeCircle(px(sel.x), px(sel.y), st.range * TILE);
      if (st.minRange > 0) g.lineStyle(1, 0xff8888, 0.5).strokeCircle(px(sel.x), px(sel.y), st.minRange * TILE);
    }

    for (const t of s.towers) {
      const x = px(t.x);
      const y = px(t.y);
      const dead = t.hp <= 0;
      const size = TILE * (0.5 + 0.06 * t.path.length);
      g.fillStyle(dead ? 0x3a3a3a : TOWER_COLOR[t.type], t.disabledFor > 0 ? 0.5 : 1);
      if (t.type === 'givre') g.fillCircle(x, y, size / 2);
      else if (t.type === 'baliste') g.fillTriangle(x, y - size / 2, x - size / 2, y + size / 2, x + size / 2, y + size / 2);
      else g.fillRoundedRect(x - size / 2, y - size / 2, size, size, 5);
      if (t.overchargeFor > 0) g.lineStyle(3, 0xfff275).strokeCircle(x, y, TILE * 0.45);
      if (t.aiPriority === 'high') g.fillStyle(0xf2c14e).fillCircle(x + TILE * 0.36, y - TILE * 0.36, 5);
      if (t.aiPriority === 'sacrifice') g.fillStyle(0xe5604d).fillCircle(x + TILE * 0.36, y - TILE * 0.36, 5);
      if (t.id === this.selectedTower) g.lineStyle(2, 0xffffff).strokeRoundedRect(x - TILE / 2 + 2, y - TILE / 2 + 2, TILE - 4, TILE - 4, 6);
      // Barre de vie : la partie grisée à droite est l'usure définitive.
      const w = TILE * 0.8;
      const full = baseTowerStats(t).maxHp;
      const bx = x - w / 2;
      const by = y + TILE * 0.36;
      g.fillStyle(0x000000, 0.7).fillRect(bx, by, w, 5);
      g.fillStyle(0x666666).fillRect(bx + w * t.maxHpFactor, by, w * (1 - t.maxHpFactor), 5);
      const frac = t.hp / full;
      g.fillStyle(t.hp / towerMaxHp(t) > 0.5 ? 0x58c98a : 0xe5a13d).fillRect(bx, by, w * frac, 5);
      const ammoMax = baseTowerStats(t).ammo;
      if (ammoMax > 0) g.fillStyle(t.ammo === 0 ? 0xe5604d : 0xfff275).fillRect(bx, by + 6, w * (t.ammo / ammoMax), 3);
    }

    const prevEnemies = new Map(this.prev?.enemies.map((e) => [e.id, e]));
    for (const e of s.enemies) {
      const p = prevEnemies.get(e.id);
      const x = px(lerp(p?.x, e.x));
      const y = px(lerp(p?.y, e.y));
      const style = ENEMY_STYLE[e.type];
      const r = style.r * TILE;
      g.fillStyle(style.color).fillCircle(x, y, r);
      if (ENEMIES[e.type].boss) g.lineStyle(3, 0xff3b30).strokeCircle(x, y, r);
      if (e.shield > 0) g.lineStyle(2, 0xb9e6ff).strokeCircle(x, y, r + 3);
      if (e.slowFor > 0) g.lineStyle(2, 0x4cc9f0, 0.8).strokeCircle(x, y, r + 1);
      if (e.dotFor > 0) g.fillStyle(0xff9f1c).fillCircle(x, y - r - 2, 3);
      if (e.hp < e.maxHp) {
        const w = Math.max(18, r * 2);
        g.fillStyle(0x000000, 0.7).fillRect(x - w / 2, y - r - 8, w, 4);
        g.fillStyle(0xe5604d).fillRect(x - w / 2, y - r - 8, w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }

    for (const p of s.pickups) {
      const x = px(p.x);
      const y = px(p.y);
      g.fillStyle(0xf2c14e, p.ttl < 3 ? 0.5 : 1).fillTriangle(x, y - 7, x - 6, y + 4, x + 6, y + 4);
    }

    // Stock restant des gisements, zones de prospection en attente.
    this.map.deposits.forEach((d) => {
      if (s.deposits[d.id] <= 0) g.fillStyle(0x000000, 0.6).fillCircle(px(d.x), px(d.y), TILE * 0.36);
    });
    this.map.prospectZones.forEach((z) => {
      if (s.prospects[z.id] > s.wave) g.fillStyle(0x000000, 0.6).fillCircle(px(z.x), px(z.y), TILE * 0.36);
    });

    const h = s.hero;
    if (h.respawnIn <= 0) {
      const x = px(lerp(this.prev?.hero.respawnIn ? undefined : this.prev?.hero.x, h.x));
      const y = px(lerp(this.prev?.hero.respawnIn ? undefined : this.prev?.hero.y, h.y));
      const stats = heroStats(h.upgrades);
      g.fillStyle(s.heroController === 'ai' ? 0x7cb7ff : 0x58c98a).fillCircle(x, y, TILE * 0.24);
      g.lineStyle(3, 0xffffff).strokeCircle(x, y, TILE * 0.24);
      const w = TILE * 0.7;
      g.fillStyle(0x000000, 0.7).fillRect(x - w / 2, y - TILE * 0.42, w, 5);
      g.fillStyle(0x58c98a).fillRect(x - w / 2, y - TILE * 0.42, w * (h.hp / stats.maxHp), 5);
      if (h.carry > 0) g.fillStyle(0xf2c14e).fillRect(x - w / 2, y - TILE * 0.42 + 6, w * (h.carry / stats.carryCap), 3);
      if (h.progress > 0 && h.task.kind !== 'idle') g.lineStyle(4, 0xfff275).beginPath().arc(x, y, TILE * 0.34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, h.progress)).strokePath();
      if (h.task.kind === 'move') g.lineStyle(2, 0xffffff, 0.6).strokeCircle(px(h.task.x), px(h.task.y), 6);
    }

    if (this.armed) {
      const p = this.input.activePointer;
      g.lineStyle(2, 0xfff275, 0.9).strokeCircle(p.worldX, p.worldY, ABILITIES[this.armed].radius * TILE);
    }

    const dt = deltaMs / 1000;
    for (const f of this.fx) {
      f.life -= dt;
      const alpha = Math.max(0, f.life / f.max);
      if (f.kind === 'line') g.lineStyle(3, f.color, alpha).lineBetween(px(f.x1), px(f.y1), px(f.x2), px(f.y2));
      else g.lineStyle(3, f.color, alpha).strokeCircle(px(f.x1), px(f.y1), f.r * TILE * (1.2 - 0.2 * alpha));
    }
    this.fx = this.fx.filter((f) => f.life > 0);
  }
}

export function createGame(parent: HTMLElement, map: GameMap): { game: Phaser.Game; scene: GameScene } {
  const scene = new GameScene();
  scene.setMap(map);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#14181f',
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%', expandParent: false },
    scene,
    banner: false,
    input: { activePointers: 3 },
  });
  return { game, scene };
}

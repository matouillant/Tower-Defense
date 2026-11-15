import Phaser from 'phaser';

/** Qualité des effets : « élevée » par défaut, « réduite » pour les appareils modestes (moins de particules, pas d'éclat). */
export type FxQuality = 'high' | 'low';
const KEY = 'td:fx';
export function loadFxQuality(): FxQuality {
  try {
    return localStorage.getItem(KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}
export function saveFxQuality(q: FxQuality) {
  try {
    localStorage.setItem(KEY, q);
  } catch {
    /* stockage indisponible : réglage pour cette session seulement */
  }
}

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/**
 * Effets « de ressenti » : particules (étincelles, débris, fumée, givre), chiffres de dégâts et tremblements d'écran.
 * Tout est en coordonnées du monde ; les émetteurs ne tournent qu'à la demande (explode) pour rester légers.
 */
export class Effects {
  quality: FxQuality = loadFxQuality();
  private sparks!: Emitter;
  private embers!: Emitter;
  private debris!: Emitter;
  private smoke!: Emitter;
  private flakes!: Emitter;
  private glints!: Emitter;
  private dust!: Emitter;
  private numbers: Phaser.GameObjects.Text[] = [];
  private live: { txt: Phaser.GameObjects.Text; vy: number; life: number; max: number }[] = [];
  private lastShake = 0;

  constructor(private scene: Phaser.Scene) {
    this.makeTextures();
    const add = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number) =>
      scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(depth);
    // Étincelles d'impact : rapides, brillantes, en mode additif.
    this.sparks = add('p_spark', { lifespan: { min: 160, max: 340 }, speed: { min: 90, max: 260 }, scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, rotate: { min: 0, max: 360 }, blendMode: 'ADD' }, 6200);
    // Braises d'explosion : plus lentes, retombent un peu.
    this.embers = add('p_dot', { lifespan: { min: 300, max: 650 }, speed: { min: 40, max: 200 }, scale: { start: 0.7, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 120, blendMode: 'ADD' }, 6200);
    // Débris : petits éclats métalliques qui tournoient.
    this.debris = add('p_chip', { lifespan: { min: 380, max: 700 }, speed: { min: 60, max: 210 }, scale: { start: 0.9, end: 0.3 }, alpha: { start: 1, end: 0 }, rotate: { start: 0, end: 540 }, gravityY: 260 }, 6100);
    // Fumée : grosses bouffées sombres qui montent et s'étalent.
    this.smoke = add('p_dot', { lifespan: { min: 500, max: 900 }, speed: { min: 10, max: 50 }, scale: { start: 0.9, end: 2.4 }, alpha: { start: 0.45, end: 0 }, gravityY: -30, tint: 0x2a2344 }, 6000);
    // Givre : flocons qui tournent lentement.
    this.flakes = add('p_flake', { lifespan: { min: 400, max: 800 }, speed: { min: 20, max: 90 }, scale: { start: 0.6, end: 0.1 }, alpha: { start: 1, end: 0 }, rotate: { start: 0, end: 180 }, tint: 0xbff3ff, blendMode: 'ADD' }, 6200);
    // Scintillements (soins, ressources, améliorations).
    this.glints = add('p_star', { lifespan: { min: 400, max: 800 }, speed: { min: 10, max: 60 }, scale: { start: 0.6, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: -60, blendMode: 'ADD' }, 6200);
    // Poussière sous les pas du héros.
    this.dust = add('p_dot', { lifespan: { min: 250, max: 450 }, speed: { min: 5, max: 25 }, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.35, end: 0 }, tint: 0xcfe8dc }, 130);
  }

  private get n() {
    return this.quality === 'high' ? 1 : 0.4;
  }

  private burst(em: Emitter, count: number, x: number, y: number, tint?: number) {
    const k = Math.max(1, Math.round(count * this.n));
    if (tint !== undefined) em.setParticleTint(tint);
    em.explode(k, x, y);
  }

  impact(x: number, y: number, color: number, power = 1) {
    this.burst(this.sparks, 5 * power, x, y, color);
  }
  muzzle(x: number, y: number, color: number) {
    this.burst(this.sparks, 3, x, y, color);
  }
  frost(x: number, y: number) {
    this.burst(this.flakes, 6, x, y);
  }
  explosion(x: number, y: number, radius: number, color = 0xff8a3d) {
    this.burst(this.embers, 10 + radius * 0.25, x, y, color);
    this.burst(this.sparks, 8, x, y, 0xffe066);
    this.burst(this.smoke, 4 + radius * 0.05, x, y);
  }
  death(x: number, y: number, color: number, boss: boolean) {
    this.burst(this.debris, boss ? 26 : 9, x, y, color);
    this.burst(this.sparks, boss ? 22 : 6, x, y, 0xffffff);
    if (boss) {
      this.burst(this.embers, 30, x, y, 0xffd84a);
      this.burst(this.smoke, 10, x, y);
    }
  }
  sparkle(x: number, y: number, color: number, count = 8) {
    this.burst(this.glints, count, x, y, color);
  }
  step(x: number, y: number) {
    if (this.quality === 'high') this.dust.explode(1, x, y);
  }

  /** Tremblement d'écran, sans s'empiler. */
  shake(intensity: number, ms = 220) {
    const now = performance.now();
    if (now - this.lastShake < ms * 0.6) return;
    this.lastShake = now;
    this.scene.cameras.main.shake(ms, intensity * (this.quality === 'high' ? 1 : 0.5));
  }

  /** Chiffre flottant (dégâts infligés, gains). */
  number(x: number, y: number, value: string, color: string, big = false) {
    if (this.live.length > (this.quality === 'high' ? 36 : 14)) return;
    const txt =
      this.numbers.pop() ??
      this.scene.add.text(0, 0, '', { fontFamily: 'Exo 2, system-ui, sans-serif', fontStyle: '800', fontSize: '22px', stroke: '#0d1220', strokeThickness: 5 }).setOrigin(0.5).setDepth(7000);
    txt.setText(value).setColor(color).setPosition(x + (Math.random() - 0.5) * 14, y).setAlpha(1).setVisible(true).setScale(big ? 1.35 : 0.9);
    this.live.push({ txt, vy: -48 - Math.random() * 20, life: 0.75, max: 0.75 });
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const n = this.live[i];
      n.life -= dt;
      n.txt.y += n.vy * dt;
      n.vy *= 0.93;
      n.txt.setAlpha(Math.min(1, n.life / (n.max * 0.5)));
      if (n.life <= 0) {
        n.txt.setVisible(false);
        this.numbers.push(n.txt);
        this.live.splice(i, 1);
      }
    }
  }

  /** Petites textures de particules, dessinées une fois en Canvas 2D. */
  private makeTextures() {
    const tex = this.scene.textures;
    const make = (key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) => {
      if (tex.exists(key)) return;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      draw(cv.getContext('2d')!, size);
      tex.addCanvas(key, cv);
    };
    make('p_dot', 32, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    make('p_spark', 32, (c, s) => {
      const g = c.createLinearGradient(0, s / 2, s, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(s / 2, s / 2, s / 2, s / 9, 0, 0, Math.PI * 2);
      c.fill();
    });
    make('p_chip', 16, (c, s) => {
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#0d1220';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(2, 5);
      c.lineTo(11, 2);
      c.lineTo(14, 11);
      c.lineTo(5, 14);
      c.closePath();
      c.fill();
      c.stroke();
      void s;
    });
    make('p_flake', 24, (c, s) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        c.beginPath();
        c.moveTo(s / 2 - Math.cos(a) * 10, s / 2 - Math.sin(a) * 10);
        c.lineTo(s / 2 + Math.cos(a) * 10, s / 2 + Math.sin(a) * 10);
        c.stroke();
      }
    });
    make('p_star', 24, (c, s) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 3 : 11;
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        c.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    });
  }
}

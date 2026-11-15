/**
 * Son et musique, entièrement synthétisés avec Web Audio (aucun fichier à télécharger).
 * Les bruitages sont limités en cadence pour ne jamais saturer, la musique suit l'intensité de la partie.
 */
export interface AudioSettings {
  sfx: number;
  music: number;
}
const KEY = 'td:audio';

export type Mood = 'off' | 'calm' | 'wave' | 'boss';

type Sfx =
  | 'canon' | 'givre' | 'baliste' | 'foudre' | 'laser'
  | 'death' | 'bossDeath' | 'explosion' | 'baseHit' | 'heroHit'
  | 'wave' | 'bossWave' | 'coins' | 'build' | 'upgrade' | 'sell' | 'error' | 'click'
  | 'thunder' | 'slowField' | 'heal' | 'over' | 'victory' | 'trap';

/** Intervalle minimal entre deux occurrences d'un même son (secondes). */
const MIN_GAP: Partial<Record<Sfx, number>> = {
  canon: 0.07, givre: 0.12, baliste: 0.08, foudre: 0.09, laser: 0.16, death: 0.05, explosion: 0.08, heroHit: 0.25, baseHit: 0.2, coins: 0.15, click: 0.04, heal: 0.4, trap: 0.1,
};

export class GameAudio {
  settings: AudioSettings = { sfx: 0.7, music: 0.35 };
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private last = new Map<Sfx, number>();
  private voices = 0;
  private mood: Mood = 'off';
  private step = 0;
  private nextAt = 0;
  private timer: number | null = null;
  private ducked = false;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
    } catch {
      /* réglages par défaut */
    }
    // Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur.
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      /* stockage indisponible */
    }
    this.applyVolumes();
  }

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.mood !== 'off') this.startMusic();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx * 0.9, now, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.music * (this.ducked ? 0.35 : 1) * 0.55, now, 0.3);
  }

  /** Pause : la musique baisse, sans s'arrêter. */
  duck(on: boolean) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.applyVolumes();
  }

  // ------------------------------------------------------------ briques de synthèse

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(dest: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, dur: number, peak: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, peak, attack, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private hiss(dest: AudioNode, filter: BiquadFilterType, f0: number, f1: number, t: number, dur: number, peak: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, dur);
    src.connect(bq).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ bruitages

  play(name: Sfx, volume = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || this.settings.sfx <= 0) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0;
    if (now - (this.last.get(name) ?? -9) < gap) return;
    if (this.voices > 22) return;
    this.last.set(name, now);
    this.voices++;
    setTimeout(() => this.voices--, 400);
    const out = this.ctx.createGain();
    out.gain.value = volume;
    out.connect(this.sfxBus);
    const t = now + 0.005;
    const v = 0.9 + Math.random() * 0.2; // légère variation pour éviter l'effet « mitraillette »
    switch (name) {
      case 'canon':
        this.tone(out, 'sine', 160 * v, 50, t, 0.14, 0.5);
        this.hiss(out, 'lowpass', 2400, 300, t, 0.1, 0.35);
        break;
      case 'givre':
        this.hiss(out, 'bandpass', 5200 * v, 2600, t, 0.22, 0.25, 3);
        this.tone(out, 'sine', 1800 * v, 2600, t, 0.12, 0.06);
        break;
      case 'baliste':
        this.tone(out, 'sawtooth', 1400 * v, 140, t, 0.18, 0.18);
        this.hiss(out, 'highpass', 3000, 6000, t, 0.12, 0.2);
        this.tone(out, 'sine', 90, 45, t, 0.2, 0.4);
        break;
      case 'foudre':
        for (let i = 0; i < 3; i++) this.hiss(out, 'highpass', 2500 + Math.random() * 3000, 1500, t + i * 0.025, 0.05, 0.3);
        this.tone(out, 'square', 110 * v, 80, t, 0.1, 0.06);
        break;
      case 'laser':
        this.tone(out, 'sine', 880 * v, 1300, t, 0.08, 0.05);
        break;
      case 'death':
        this.tone(out, 'triangle', 520 * v, 120, t, 0.12, 0.18);
        this.hiss(out, 'bandpass', 1800, 600, t, 0.08, 0.12, 2);
        break;
      case 'bossDeath':
        this.tone(out, 'sine', 120, 30, t, 1.2, 0.8);
        this.hiss(out, 'lowpass', 3000, 80, t, 1.2, 0.7);
        [523, 659, 784, 1046].forEach((f, i) => this.tone(out, 'triangle', f, f, t + 0.25 + i * 0.09, 0.3, 0.14));
        break;
      case 'explosion':
        this.tone(out, 'sine', 110 * v, 35, t, 0.35, 0.6);
        this.hiss(out, 'lowpass', 1800, 120, t, 0.4, 0.5);
        break;
      case 'baseHit':
        this.tone(out, 'square', 220, 180, t, 0.18, 0.18);
        this.tone(out, 'square', 165, 140, t + 0.16, 0.22, 0.18);
        this.tone(out, 'sine', 70, 40, t, 0.4, 0.5);
        break;
      case 'heroHit':
        this.tone(out, 'square', 300, 160, t, 0.1, 0.1);
        break;
      case 'wave':
        this.tone(out, 'sawtooth', 220, 220, t, 0.25, 0.14, 0.03);
        this.tone(out, 'sawtooth', 330, 330, t + 0.22, 0.4, 0.14, 0.03);
        break;
      case 'bossWave':
        [110, 104, 98].forEach((f, i) => this.tone(out, 'sawtooth', f, f * 0.98, t + i * 0.35, 0.5, 0.22, 0.04));
        this.tone(out, 'sine', 55, 40, t, 1.4, 0.5);
        break;
      case 'coins':
        [988, 1319, 1568].forEach((f, i) => this.tone(out, 'triangle', f, f, t + i * 0.06, 0.14, 0.12));
        break;
      case 'build':
        this.tone(out, 'square', 140, 90, t, 0.08, 0.14);
        this.hiss(out, 'bandpass', 900, 500, t, 0.1, 0.3, 2);
        this.tone(out, 'triangle', 660, 660, t + 0.08, 0.12, 0.1);
        break;
      case 'upgrade':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(out, 'square', f, f, t + i * 0.055, 0.12, 0.07));
        break;
      case 'sell':
        [784, 587, 440].forEach((f, i) => this.tone(out, 'triangle', f, f, t + i * 0.06, 0.12, 0.1));
        break;
      case 'error':
        this.tone(out, 'square', 150, 140, t, 0.16, 0.1);
        break;
      case 'click':
        this.tone(out, 'triangle', 1200, 900, t, 0.03, 0.06);
        break;
      case 'thunder':
        this.hiss(out, 'lowpass', 6000, 100, t, 0.9, 0.7);
        this.tone(out, 'sine', 80, 30, t, 0.8, 0.5);
        break;
      case 'slowField':
        this.tone(out, 'sine', 1200, 300, t, 0.6, 0.12);
        this.hiss(out, 'bandpass', 4000, 1500, t, 0.5, 0.15, 4);
        break;
      case 'heal':
        [784, 988].forEach((f, i) => this.tone(out, 'sine', f, f, t + i * 0.08, 0.2, 0.05));
        break;
      case 'trap':
        this.tone(out, 'square', 400, 120, t, 0.12, 0.15);
        this.hiss(out, 'highpass', 2000, 800, t, 0.1, 0.2);
        break;
      case 'over':
        [392, 349, 311, 262].forEach((f, i) => this.tone(out, 'triangle', f, f * 0.98, t + i * 0.28, 0.5, 0.18, 0.02));
        break;
      case 'victory':
        [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(out, 'square', f, f, t + i * 0.12, i === 5 ? 0.7 : 0.14, 0.1));
        break;
    }
  }

  // ------------------------------------------------------------ musique

  /** Change l'ambiance : calme (préparation), vague, boss, ou silence. */
  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    if (m === 'off') this.stopMusic();
    else this.startMusic();
  }

  private startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextAt = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  private stopMusic() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Séquenceur : prépare les notes des 0,35 s à venir (double croches). */
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.settings.music <= 0) {
      if (ctx) this.nextAt = Math.max(this.nextAt, ctx.currentTime + 0.05);
      return;
    }
    const bpm = this.mood === 'boss' ? 128 : this.mood === 'wave' ? 112 : 92;
    const sixteenth = 60 / bpm / 4;
    // La mineur : Am – F – C – G, une mesure chacun.
    const prog = [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    while (this.nextAt < ctx.currentTime + 0.35) {
      const t = this.nextAt;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const chord = prog[bar];
      const bus = this.musicBus;
      // Nappe : un accord tenu à chaque mesure.
      if (s === 0) for (const n of chord) this.pad(bus, hz(n), t, sixteenth * 16);
      // Arpège scintillant.
      if (s % 2 === 0) {
        const n = chord[(s / 2) % 3] + 12 + (s >= 8 && this.mood !== 'calm' ? 12 : 0);
        this.tone(bus, 'triangle', hz(n), hz(n), t, sixteenth * 1.6, this.mood === 'calm' ? 0.035 : 0.045);
      }
      if (this.mood !== 'calm') {
        // Basse pulsée et batterie pendant les vagues.
        if (s % 4 === 0 || (this.mood === 'boss' && s % 2 === 0)) this.tone(bus, 'sawtooth', hz(chord[0] - 24), hz(chord[0] - 24), t, sixteenth * 1.8, 0.07, 0.01);
        if (s % 8 === 0) this.tone(bus, 'sine', 140, 40, t, 0.18, 0.5);
        if (s % 8 === 4) this.hiss(bus, 'bandpass', 2200, 1200, t, 0.12, 0.18, 1.2);
        if (s % 2 === 1 || this.mood === 'boss') this.hiss(bus, 'highpass', 8000, 9000, t, 0.03, this.mood === 'boss' ? 0.07 : 0.05);
      }
      this.nextAt += sixteenth;
      this.step++;
    }
  }

  private pad(dest: AudioNode, f: number, t: number, dur: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.mood === 'calm' ? 900 : 1400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.4);
    g.gain.setValueAtTime(0.03, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(dest);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

export const audio = new GameAudio();

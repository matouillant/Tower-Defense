import { GameMap, Rng } from '@td/shared';

/**
 * Décor de la carte, dessiné une seule fois en Canvas 2D (anticrénelé) à haute résolution, puis affiché comme une image.
 * Chaque carte a son biome (prairie alien, désert, toundra, volcan) : sol nuancé, route continue aux bords lumineux,
 * végétation dense en lisière qui se fond dans l'obscurité, lumière rasante et vignette.
 */
export const TERRAIN_PAD = 120;

const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export interface Biome {
  id: 'prairie' | 'desert' | 'toundra' | 'volcan';
  name: string;
  /** Sol : couleur de base, taches claires, taches sombres. */
  ground: number;
  light: number;
  dark: number;
  /** Couleur du vide autour de la carte (fond de l'écran). */
  edge: number;
  /** Route : bordure, surface, lumière des bords. */
  curb: number;
  road: number;
  glow: number;
  /** Lucioles / poussières en suspension. */
  mote: number;
}

export const BIOMES: Biome[] = [
  { id: 'prairie', name: 'Prairie alien', ground: 0x2c8f6b, light: 0x49b884, dark: 0x1c6a55, edge: 0x0a2420, curb: 0x8794b8, road: 0x3d4866, glow: 0x35e0ff, mote: 0xd8ff8a },
  { id: 'desert', name: 'Désert ocre', ground: 0xc98f4e, light: 0xe6b76e, dark: 0x9c6336, edge: 0x2a160c, curb: 0x9a8f8a, road: 0x4a4350, glow: 0xffb347, mote: 0xffe2a8 },
  { id: 'toundra', name: 'Toundra gelée', ground: 0x7fa9c9, light: 0xd4ecf7, dark: 0x4f7ea6, edge: 0x0c1a2e, curb: 0xa9bbd6, road: 0x35456a, glow: 0x7df0ff, mote: 0xffffff },
  { id: 'volcan', name: 'Terres volcaniques', ground: 0x4a3a44, light: 0x6b5560, dark: 0x2b2029, edge: 0x120a0e, curb: 0x7d7480, road: 0x2c2733, glow: 0xff6a3d, mote: 0xffa25e },
];

export const biomeOf = (m: GameMap): Biome => BIOMES[(m.seed >>> 0) % BIOMES.length];

export function bakeTerrain(m: GameMap, tile: number, scale: number): HTMLCanvasElement {
  const pad = TERRAIN_PAD;
  const mw = m.width * tile;
  const mh = m.height * tile;
  const W = mw + pad * 2;
  const H = mh + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * scale);
  cv.height = Math.ceil(H * scale);
  const c = cv.getContext('2d')!;
  c.scale(scale, scale);
  c.translate(pad, pad);
  const b = biomeOf(m);
  const rng = new Rng(m.seed ^ 0x51ed);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= m.width || y >= m.height ? 'out' : m.terrain[y * m.width + x]);
  const circle = (x: number, y: number, r: number) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
  const noShadow = () => {
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = 0;
  };
  // Les ombres floues de Canvas sont en pixels réels : on les met à l'échelle.
  const shadow = (color: string, blur: number, oy = 0) => {
    c.shadowColor = color;
    c.shadowBlur = blur * scale;
    c.shadowOffsetX = 0;
    c.shadowOffsetY = oy * scale;
  };

  // ------------------------------------------------------------ sol
  c.fillStyle = hex(b.ground);
  c.fillRect(-pad, -pad, W, H);
  // Grandes nappes de couleur : le sol n'est jamais uniforme.
  for (let i = 0; i < 170; i++) {
    const x = -pad + rng.next() * W;
    const y = -pad + rng.next() * H;
    const r = 50 + rng.next() * 190;
    const col = rng.chance(0.5) ? b.light : b.dark;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hex(col, 0.1 + rng.next() * 0.16));
    g.addColorStop(1, hex(col, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Grain fin.
  for (let i = 0; i < m.width * m.height * 9; i++) {
    c.fillStyle = rng.chance(0.5) ? hex(b.light, 0.16) : hex(b.dark, 0.2);
    circle(-pad + rng.next() * W, -pad + rng.next() * H, 0.6 + rng.next() * 1.8);
    c.fill();
  }

  // Cases occupées : pas de décor dessus.
  const busy = new Set<number>();
  const mark = (p: { x: number; y: number }) => busy.add(p.y * m.width + p.x);
  [...m.deposits, ...m.prospectZones, ...m.slots, ...m.spawns, m.base].forEach(mark);
  const free = (x: number, y: number) => at(x, y) === 'ground' && !busy.has(y * m.width + x);

  // ------------------------------------------------------------ détails du sol, selon le biome
  const groundDetail = (cx: number, cy: number) => {
    const k = rng.next();
    if (b.id === 'prairie') {
      if (k < 0.5) {
        c.strokeStyle = hex(rng.chance(0.5) ? 0x7be8ac : 0x5fd39a, 0.8);
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.33;
          c.beginPath();
          c.moveTo(cx, cy);
          c.quadraticCurveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 6, cx + Math.cos(a) * 9, cy + Math.sin(a) * 11);
          c.stroke();
        }
      } else if (k < 0.8) {
        const glow = rng.pick([0x7ef0ff, 0xb6ff5a, 0xff8fd0, 0xffe066]);
        shadow(hex(glow, 0.9), 10);
        c.fillStyle = hex(glow);
        circle(cx, cy, 2.6);
        c.fill();
        noShadow();
        c.fillStyle = 'rgba(255,255,255,0.9)';
        circle(cx - 0.8, cy - 0.8, 0.9);
        c.fill();
      } else {
        // Petite fleur à cinq pétales.
        const col = rng.pick([0xffffff, 0xffc2e2, 0xfff0a0]);
        c.fillStyle = hex(col, 0.95);
        for (let i = 0; i < 5; i++) {
          circle(cx + Math.cos((i * Math.PI * 2) / 5) * 3, cy + Math.sin((i * Math.PI * 2) / 5) * 3, 1.9);
          c.fill();
        }
        c.fillStyle = '#ffb347';
        circle(cx, cy, 1.5);
        c.fill();
      }
    } else if (b.id === 'desert') {
      if (k < 0.55) {
        // Ride de dune.
        c.strokeStyle = hex(b.dark, 0.35);
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(cx - 12, cy);
        c.quadraticCurveTo(cx, cy - 5 - rng.next() * 4, cx + 12, cy + 1);
        c.stroke();
        c.strokeStyle = hex(0xfff0c8, 0.3);
        c.beginPath();
        c.moveTo(cx - 11, cy + 2.5);
        c.quadraticCurveTo(cx, cy - 2.5, cx + 11, cy + 3.5);
        c.stroke();
      } else if (k < 0.8) {
        c.fillStyle = hex(0x7a4a2a, 0.55);
        ellipse(cx + 1, cy + 2, 4.5, 2.6);
        c.fill();
        c.fillStyle = hex(0xe9c79a);
        ellipse(cx, cy, 4, 3, 0.4);
        c.fill();
      } else {
        // Touffe sèche.
        c.strokeStyle = hex(0x8a9a4a, 0.9);
        c.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + (i - 1.5) * 0.45;
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
          c.stroke();
        }
      }
    } else if (b.id === 'toundra') {
      if (k < 0.6) {
        // Congère.
        c.fillStyle = hex(0x3d6a94, 0.25);
        ellipse(cx + 1, cy + 3, 13, 5);
        c.fill();
        const g = c.createLinearGradient(cx, cy - 6, cx, cy + 5);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(214,236,247,0.6)');
        c.fillStyle = g;
        ellipse(cx, cy, 12 + rng.next() * 5, 5);
        c.fill();
      } else {
        // Éclat de glace.
        shadow(hex(0x9befff, 0.8), 8);
        c.fillStyle = hex(0xc9f6ff, 0.95);
        c.beginPath();
        c.moveTo(cx, cy - 7);
        c.lineTo(cx + 3.5, cy);
        c.lineTo(cx, cy + 3);
        c.lineTo(cx - 3.5, cy);
        c.closePath();
        c.fill();
        noShadow();
      }
    } else {
      if (k < 0.5) {
        // Fissure de lave.
        shadow(hex(0xff6a3d, 0.9), 9);
        c.strokeStyle = hex(0xffb347, 0.95);
        c.lineWidth = 1.7;
        c.lineCap = 'round';
        c.beginPath();
        let x = cx - 10;
        let y = cy;
        c.moveTo(x, y);
        for (let i = 0; i < 4; i++) {
          x += 4 + rng.next() * 3;
          y += (rng.next() - 0.5) * 8;
          c.lineTo(x, y);
        }
        c.stroke();
        noShadow();
      } else if (k < 0.85) {
        c.fillStyle = 'rgba(0,0,0,0.4)';
        ellipse(cx + 1, cy + 2.5, 5, 3);
        c.fill();
        c.fillStyle = hex(0x6b5f70);
        ellipse(cx, cy, 4.5, 3.4, 0.3);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.18)';
        ellipse(cx - 1, cy - 1, 2, 1.2, 0.3);
        c.fill();
      } else {
        shadow(hex(0xff6a3d, 0.8), 7);
        c.fillStyle = hex(0xff9d5c);
        circle(cx, cy, 1.8);
        c.fill();
        noShadow();
      }
    }
  };
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      if (!free(x, y)) continue;
      const n = rng.chance(0.5) ? 1 : rng.chance(0.4) ? 2 : 0;
      for (let i = 0; i < n; i++) groundDetail(x * tile + rng.int(8, tile - 8), y * tile + rng.int(8, tile - 8));
    }

  // ------------------------------------------------------------ route : un ruban continu aux angles arrondis
  const trace = (path: { x: number; y: number }[]) => {
    c.beginPath();
    path.forEach((p, i) => (i ? c.lineTo((p.x + 0.5) * tile, (p.y + 0.5) * tile) : c.moveTo((p.x + 0.5) * tile, (p.y + 0.5) * tile)));
  };
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const layer = (width: number, style: string | CanvasGradient, pre?: () => void) => {
    for (const p of m.paths) {
      pre?.();
      trace(p);
      c.lineWidth = width;
      c.strokeStyle = style;
      c.stroke();
    }
    noShadow();
  };
  layer(tile + 10, 'rgba(0,0,0,0.5)', () => shadow('rgba(0,0,0,0.6)', 16, 6)); // ombre portée
  layer(tile + 8, '#0d1220'); // contour
  layer(tile + 2, hex(b.curb)); // bordure métallique
  layer(tile - 3, hex(mix(b.curb, 0x000000, 0.45)));
  layer(tile - 7, hex(b.glow), () => shadow(hex(b.glow, 0.9), 10)); // filets lumineux le long des bords
  layer(tile - 12, hex(b.road)); // surface
  layer(tile - 30, hex(mix(b.road, 0xffffff, 0.06))); // bande centrale légèrement plus claire
  // Joints et chevrons de sens, sur les segments droits.
  for (const p of m.paths) {
    for (let i = 1; i < p.length - 1; i++) {
      const dx = p[i + 1].x - p[i].x;
      const dy = p[i + 1].y - p[i].y;
      const straight = p[i].x - p[i - 1].x === dx && p[i].y - p[i - 1].y === dy;
      if (!straight) continue;
      const cx = (p[i].x + 0.5) * tile;
      const cy = (p[i].y + 0.5) * tile;
      const h = tile / 2 - 9;
      // Joint transversal entre deux dalles.
      c.strokeStyle = 'rgba(0,0,0,0.28)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(cx - dx * tile * 0.5 - dy * h, cy - dy * tile * 0.5 + dx * h);
      c.lineTo(cx - dx * tile * 0.5 + dy * h, cy - dy * tile * 0.5 - dx * h);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.07)';
      c.beginPath();
      c.moveTo(cx - dx * (tile * 0.5 - 1.5) - dy * h, cy - dy * (tile * 0.5 - 1.5) + dx * h);
      c.lineTo(cx - dx * (tile * 0.5 - 1.5) + dy * h, cy - dy * (tile * 0.5 - 1.5) - dx * h);
      c.stroke();
      if (i % 2 === 0) {
        // Chevron lumineux discret qui indique le sens de marche.
        c.strokeStyle = hex(b.glow, 0.32);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(cx - dx * 5 - dy * 8, cy - dy * 5 + dx * 8);
        c.lineTo(cx + dx * 4, cy + dy * 4);
        c.lineTo(cx - dx * 5 + dy * 8, cy - dy * 5 - dx * 8);
        c.stroke();
      }
    }
  }
  // Gel ralentisseur sur les cases de boue.
  for (const idx of m.mud) {
    const X = (idx % m.width) * tile;
    const Y = Math.floor(idx / m.width) * tile;
    const cx = X + tile / 2;
    const cy = Y + tile / 2;
    shadow('rgba(190,120,255,0.9)', 12);
    const g = c.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, tile * 0.62);
    g.addColorStop(0, '#c79bff');
    g.addColorStop(0.6, '#8b52e6');
    g.addColorStop(1, '#5a2fb0');
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(X + 6, Y + 6, tile - 12, tile - 12, 12);
    c.fill();
    noShadow();
    for (let k = 0; k < 4; k++) {
      c.fillStyle = 'rgba(225,195,255,0.5)';
      ellipse(X + rng.int(13, tile - 13), Y + rng.int(13, tile - 13), rng.int(3, 6), rng.int(2, 3), rng.next() * 3);
      c.fill();
    }
    c.fillStyle = 'rgba(255,245,255,0.95)';
    circle(X + rng.int(14, tile - 14), Y + rng.int(14, tile - 14), 1.8);
    c.fill();
  }

  // ------------------------------------------------------------ emplacements de construction
  for (const s of m.slots) {
    const cx = (s.x + 0.5) * tile;
    const cy = (s.y + 0.5) * tile;
    const col = s.high ? 0xffd84a : b.glow;
    shadow('rgba(0,0,0,0.55)', 8, 4);
    c.fillStyle = '#0d1220';
    circle(cx, cy, 21);
    c.fill();
    noShadow();
    const g = c.createLinearGradient(cx, cy - 18, cx, cy + 18);
    g.addColorStop(0, '#dfe6f7');
    g.addColorStop(0.5, '#8e9bbf');
    g.addColorStop(1, '#55618a');
    c.fillStyle = g;
    circle(cx, cy, 18);
    c.fill();
    c.fillStyle = '#1a2036';
    circle(cx, cy, 12.5);
    c.fill();
    // Crans du plot.
    c.strokeStyle = 'rgba(13,18,32,0.55)';
    c.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 13.5, cy + Math.sin(a) * 13.5);
      c.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17);
      c.stroke();
    }
    shadow(hex(col, 1), 10);
    c.strokeStyle = hex(col);
    c.lineWidth = 2;
    circle(cx, cy, 9.5);
    c.stroke();
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, 5.5);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(1, hex(col));
    c.fillStyle = core;
    circle(cx, cy, 4.5);
    c.fill();
    noShadow();
    if (s.high) {
      c.strokeStyle = '#0d1220';
      c.lineWidth = 6;
      circle(cx, cy, 24);
      c.stroke();
      c.strokeStyle = '#ffd84a';
      c.lineWidth = 3;
      circle(cx, cy, 24);
      c.stroke();
    }
  }

  // ------------------------------------------------------------ lisière : végétation et roches autour de la carte
  type Prop = { x: number; y: number; r: number; k: number };
  const props: Prop[] = [];
  const inMap = (x: number, y: number) => x > -10 && y > -10 && x < mw + 10 && y < mh + 10;
  for (let i = 0; i < 520; i++) {
    const x = -pad + rng.next() * W;
    const y = -pad + rng.next() * H;
    if (inMap(x, y)) continue;
    // Plus dense et plus grand vers l'extérieur.
    const out = Math.max(-x, x - mw, -y, y - mh, 0) / pad;
    props.push({ x, y, r: 11 + out * 14 + rng.next() * 8, k: rng.next() });
  }
  // Quelques éléments à l'intérieur, sur les bords libres, pour casser le rectangle.
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const border = x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1;
      if (!border || !free(x, y) || !rng.chance(0.45)) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === 'path' || busy.has((y + dy) * m.width + x + dx));
      if (near) continue;
      props.push({ x: (x + 0.5) * tile + rng.int(-8, 8), y: (y + 0.5) * tile + rng.int(-8, 8), r: 9 + rng.next() * 5, k: rng.next() });
    }
  props.sort((p, q) => p.y - q.y);

  const blobTree = (p: Prop, dark: number, mid: number, light: number, trunk = 0x3a2a2a) => {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(p.x + p.r * 0.25, p.y + p.r * 0.75, p.r * 0.95, p.r * 0.45);
    c.fill();
    c.fillStyle = hex(trunk);
    c.fillRect(p.x - 2, p.y, 4, p.r * 0.7);
    c.fillStyle = hex(dark);
    circle(p.x, p.y - p.r * 0.2, p.r);
    c.fill();
    c.fillStyle = hex(mid);
    circle(p.x - p.r * 0.18, p.y - p.r * 0.42, p.r * 0.74);
    c.fill();
    c.fillStyle = hex(light);
    circle(p.x - p.r * 0.32, p.y - p.r * 0.62, p.r * 0.4);
    c.fill();
  };
  const spire = (p: Prop, dark: number, mid: number, light: number, glow?: number) => {
    c.fillStyle = 'rgba(0,0,0,0.38)';
    ellipse(p.x + p.r * 0.3, p.y + p.r * 0.45, p.r, p.r * 0.4);
    c.fill();
    const h = p.r * (1.3 + p.k);
    c.fillStyle = hex(dark);
    c.beginPath();
    c.moveTo(p.x - p.r * 0.8, p.y + p.r * 0.4);
    c.lineTo(p.x - p.r * 0.2, p.y - h);
    c.lineTo(p.x + p.r * 0.35, p.y - h * 0.7);
    c.lineTo(p.x + p.r * 0.85, p.y + p.r * 0.4);
    c.closePath();
    c.fill();
    c.fillStyle = hex(mid);
    c.beginPath();
    c.moveTo(p.x - p.r * 0.8, p.y + p.r * 0.4);
    c.lineTo(p.x - p.r * 0.2, p.y - h);
    c.lineTo(p.x, p.y + p.r * 0.4);
    c.closePath();
    c.fill();
    c.fillStyle = hex(light, 0.8);
    c.beginPath();
    c.moveTo(p.x - p.r * 0.55, p.y - h * 0.2);
    c.lineTo(p.x - p.r * 0.2, p.y - h);
    c.lineTo(p.x - p.r * 0.12, p.y - h * 0.25);
    c.closePath();
    c.fill();
    if (glow !== undefined) {
      shadow(hex(glow, 1), 10);
      c.strokeStyle = hex(glow);
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(p.x + p.r * 0.2, p.y - h * 0.55);
      c.lineTo(p.x + p.r * 0.1, p.y - h * 0.15);
      c.lineTo(p.x + p.r * 0.45, p.y + p.r * 0.3);
      c.stroke();
      noShadow();
    }
  };
  const pine = (p: Prop) => {
    c.fillStyle = 'rgba(20,40,70,0.35)';
    ellipse(p.x + p.r * 0.25, p.y + p.r * 0.55, p.r * 0.9, p.r * 0.38);
    c.fill();
    for (let i = 0; i < 3; i++) {
      const w = p.r * (1 - i * 0.24);
      const y0 = p.y + p.r * 0.45 - i * p.r * 0.62;
      c.fillStyle = hex(mix(0x1f5a6b, 0x2f8a8f, i / 2));
      c.beginPath();
      c.moveTo(p.x - w, y0);
      c.lineTo(p.x, y0 - p.r * 1.05);
      c.lineTo(p.x + w, y0);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.beginPath();
      c.moveTo(p.x - w * 0.5, y0 - p.r * 0.5);
      c.lineTo(p.x, y0 - p.r * 1.05);
      c.lineTo(p.x + w * 0.3, y0 - p.r * 0.72);
      c.lineTo(p.x - w * 0.1, y0 - p.r * 0.55);
      c.closePath();
      c.fill();
    }
  };
  const cactus = (p: Prop) => {
    c.fillStyle = 'rgba(80,40,10,0.35)';
    ellipse(p.x + 4, p.y + p.r * 0.5, p.r * 0.7, p.r * 0.25);
    c.fill();
    c.lineCap = 'round';
    const arm = (w: number, col: number) => {
      c.strokeStyle = hex(col);
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(p.x, p.y + p.r * 0.45);
      c.lineTo(p.x, p.y - p.r);
      c.moveTo(p.x, p.y - p.r * 0.1);
      c.lineTo(p.x - p.r * 0.5, p.y - p.r * 0.1);
      c.lineTo(p.x - p.r * 0.5, p.y - p.r * 0.6);
      c.moveTo(p.x, p.y - p.r * 0.35);
      c.lineTo(p.x + p.r * 0.45, p.y - p.r * 0.35);
      c.lineTo(p.x + p.r * 0.45, p.y - p.r * 0.8);
      c.stroke();
    };
    arm(p.r * 0.5, 0x2c5a3a);
    arm(p.r * 0.32, 0x4f9a5a);
    c.strokeStyle = 'rgba(200,255,200,0.35)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(p.x - 1.5, p.y + p.r * 0.3);
    c.lineTo(p.x - 1.5, p.y - p.r * 0.9);
    c.stroke();
  };
  for (const p of props) {
    if (b.id === 'prairie') {
      if (p.k < 0.72) blobTree(p, 0x145245, p.k < 0.5 ? 0x1f8a66 : 0x1c7f86, p.k < 0.5 ? 0x5fdc9a : 0x6fe3e0);
      else if (p.k < 0.86) blobTree(p, 0x5a2a6b, 0x9a4fc0, 0xe29bff, 0x2a1a3a);
      else spire(p, 0x4a5670, 0x8e9bbf, 0xe6ecf8);
    } else if (b.id === 'desert') {
      if (p.k < 0.6) spire({ ...p, k: p.k * 0.6 }, 0x7a4424, 0xb8703a, 0xf0b878);
      else if (p.k < 0.85) cactus(p);
      else blobTree(p, 0x5a6a2a, 0x8a9a4a, 0xc8d47a, 0x5a3a1a);
    } else if (b.id === 'toundra') {
      if (p.k < 0.62) pine(p);
      else if (p.k < 0.85) spire(p, 0x3d6a94, 0x8cc6e6, 0xffffff, 0xbdf4ff);
      else spire({ ...p, k: 0.1 }, 0x5a6a86, 0x9fb0cc, 0xffffff);
    } else {
      if (p.k < 0.7) spire(p, 0x1a1218, 0x3d3038, 0x6b5560, p.k < 0.4 ? 0xff7a3d : undefined);
      else if (p.k < 0.85) blobTree(p, 0x2b1a1a, 0x5a2a22, 0x8a3a2a, 0x1a1010);
      else {
        // Flaque de lave.
        shadow(hex(0xff5a2a, 1), 16);
        const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
        g.addColorStop(0, '#fff0a0');
        g.addColorStop(0.5, '#ff8a3d');
        g.addColorStop(1, '#c4320f');
        c.fillStyle = g;
        ellipse(p.x, p.y, p.r, p.r * 0.6, p.k * 3);
        c.fill();
        noShadow();
      }
    }
  }

  // ------------------------------------------------------------ lumière et fondu vers l'obscurité
  c.globalCompositeOperation = 'soft-light';
  const sun = c.createRadialGradient(mw * 0.2, mh * 0.1, 0, mw * 0.2, mh * 0.1, Math.max(mw, mh) * 0.9);
  sun.addColorStop(0, 'rgba(255,250,220,0.55)');
  sun.addColorStop(1, 'rgba(255,250,220,0)');
  c.fillStyle = sun;
  c.fillRect(-pad, -pad, W, H);
  c.globalCompositeOperation = 'source-over';
  const vg = c.createRadialGradient(mw / 2, mh / 2, Math.min(mw, mh) * 0.45, mw / 2, mh / 2, Math.max(mw, mh) * 0.78);
  vg.addColorStop(0, hex(b.edge, 0));
  vg.addColorStop(1, hex(b.edge, 0.55));
  c.fillStyle = vg;
  c.fillRect(-pad, -pad, W, H);
  // Bords du décor : fondu complet vers la couleur du vide, pour que la carte n'ait pas de cadre.
  const fade = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, hex(b.edge, 0));
    g.addColorStop(0.75, hex(b.edge, 0.85));
    g.addColorStop(1, hex(b.edge, 1));
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  };
  fade(0, 0, -pad, 0, -pad, -pad, pad, H);
  fade(mw, 0, mw + pad, 0, mw, -pad, pad, H);
  fade(0, 0, 0, -pad, -pad, -pad, W, pad);
  fade(0, mh, 0, mh + pad, -pad, mh, W, pad);
  return cv;
}

import { GameMap, Rng } from '@td/shared';

/**
 * Décor de la carte, dessiné une seule fois en Canvas 2D (anticrénelé) à haute résolution,
 * puis affiché comme une image : net quand on zoome, et bien plus léger à afficher qu'un dessin vectoriel par image.
 */
const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

export function bakeTerrain(m: GameMap, tile: number, scale: number): HTMLCanvasElement {
  const pad = 24;
  const W = m.width * tile + pad * 2;
  const H = m.height * tile + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * scale);
  cv.height = Math.ceil(H * scale);
  const c = cv.getContext('2d')!;
  c.scale(scale, scale);
  c.translate(pad, pad);
  const rng = new Rng(m.seed ^ 0x51ed);
  const at = (x: number, y: number) => m.terrain[y * m.width + x];
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
  };
  const circle = (x: number, y: number, r: number) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
  };

  // ---- Sol : dégradé doux, damier très léger, grain et touffes lumineuses.
  const ground = c.createLinearGradient(0, 0, m.width * tile, m.height * tile);
  ground.addColorStop(0, '#2f9a72');
  ground.addColorStop(0.5, '#2a8a67');
  ground.addColorStop(1, '#23775a');
  c.fillStyle = '#123a30';
  rr(-pad, -pad, W, H, 26);
  c.fill();
  c.fillStyle = ground;
  rr(-6, -6, m.width * tile + 12, m.height * tile + 12, 18);
  c.fill();
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++)
      if ((x + y) % 2) {
        c.fillStyle = 'rgba(255,255,255,0.025)';
        c.fillRect(x * tile, y * tile, tile, tile);
      }
  // Grain : petites taches claires et sombres.
  for (let i = 0; i < m.width * m.height * 6; i++) {
    const x = rng.next() * m.width * tile;
    const y = rng.next() * m.height * tile;
    c.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,30,20,0.08)';
    circle(x, y, 0.8 + rng.next() * 2.2);
    c.fill();
  }
  const reserved = new Set<number>([...m.deposits, ...m.prospectZones].map((p) => p.y * m.width + p.x));
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      if (at(x, y) !== 'ground' || reserved.has(y * m.width + x) || !rng.chance(0.24)) continue;
      const cx = x * tile + rng.int(10, tile - 10);
      const cy = y * tile + rng.int(10, tile - 10);
      const k = rng.next();
      if (k < 0.35) {
        // Herbe alien : quelques brins incurvés.
        c.strokeStyle = 'rgba(120,230,170,0.75)';
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        for (let b = 0; b < 5; b++) {
          const a = -Math.PI / 2 + (b - 2) * 0.32;
          c.beginPath();
          c.moveTo(cx, cy);
          c.quadraticCurveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 6, cx + Math.cos(a) * 8, cy + Math.sin(a) * 10);
          c.stroke();
        }
      } else if (k < 0.65) {
        // Champignon lumineux avec halo.
        const glow = rng.pick([0x7ef0ff, 0xb6ff5a, 0xff8fd0, 0xffe066]);
        const halo = c.createRadialGradient(cx, cy, 0, cx, cy, 11);
        halo.addColorStop(0, hex(glow, 0.45));
        halo.addColorStop(1, hex(glow, 0));
        c.fillStyle = halo;
        circle(cx, cy, 11);
        c.fill();
        c.fillStyle = '#1f6b50';
        circle(cx, cy + 1.5, 5.5);
        c.fill();
        c.fillStyle = hex(glow);
        circle(cx, cy, 3);
        c.fill();
      } else {
        // Petit caillou ombré.
        c.fillStyle = 'rgba(0,20,15,0.35)';
        c.beginPath();
        c.ellipse(cx + 1.5, cy + 2.5, 5, 3.2, 0, 0, Math.PI * 2);
        c.fill();
        const st = c.createLinearGradient(cx - 4, cy - 4, cx + 4, cy + 4);
        st.addColorStop(0, '#e6ecf8');
        st.addColorStop(1, '#7d88a3');
        c.fillStyle = st;
        c.beginPath();
        c.ellipse(cx, cy, 4.5, 3.6, 0.3, 0, Math.PI * 2);
        c.fill();
      }
    }

  // ---- Route : ombre portée, bord sombre, dalles avec biseau ; gel violet sur les cases de boue.
  const mud = new Set(m.mud);
  const pathCells: [number, number][] = [];
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (at(x, y) === 'path') pathCells.push([x, y]);
  c.fillStyle = 'rgba(0,10,8,0.35)';
  for (const [x, y] of pathCells) {
    rr(x * tile - 4, y * tile + 2, tile + 8, tile + 8, 12);
    c.fill();
  }
  c.fillStyle = '#0d1220';
  for (const [x, y] of pathCells) {
    rr(x * tile - 5, y * tile - 5, tile + 10, tile + 10, 12);
    c.fill();
  }
  c.fillStyle = '#46526f';
  for (const [x, y] of pathCells) {
    rr(x * tile - 1, y * tile - 1, tile + 2, tile + 2, 8);
    c.fill();
  }
  for (const [x, y] of pathCells) {
    const X = x * tile;
    const Y = y * tile;
    if (mud.has(y * m.width + x)) {
      const g = c.createRadialGradient(X + tile / 2, Y + tile / 2, 2, X + tile / 2, Y + tile / 2, tile * 0.7);
      g.addColorStop(0, '#a46bff');
      g.addColorStop(1, '#5a33a8');
      c.fillStyle = g;
      rr(X - 1, Y - 1, tile + 2, tile + 2, 8);
      c.fill();
      for (let k = 0; k < 3; k++) {
        c.fillStyle = 'rgba(210,170,255,0.55)';
        c.beginPath();
        c.ellipse(X + rng.int(10, tile - 10), Y + rng.int(10, tile - 10), rng.int(4, 7), rng.int(2, 4), rng.next() * 3, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = 'rgba(255,240,255,0.9)';
      circle(X + rng.int(10, tile - 10), Y + rng.int(10, tile - 10), 2);
      c.fill();
    } else {
      const g = c.createLinearGradient(X, Y, X, Y + tile);
      g.addColorStop(0, '#6a7aa2');
      g.addColorStop(1, '#4a5779');
      c.fillStyle = '#323c58';
      rr(X + 3, Y + 3, tile - 6, tile - 6, 7);
      c.fill();
      c.fillStyle = g;
      rr(X + 5, Y + 4, tile - 10, tile - 11, 6);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)';
      rr(X + 9, Y + 7, tile - 18, 3.5, 2);
      c.fill();
      c.fillStyle = '#232b42';
      for (const [dx, dy] of [[9, 10], [tile - 9, 10], [9, tile - 10], [tile - 9, tile - 10]]) {
        circle(X + dx, Y + dy, 1.7);
        c.fill();
      }
    }
  }

  // ---- Emplacements de construction : plots métalliques à anneau lumineux (doré sur les points hauts).
  for (const s of m.slots) {
    const cx = (s.x + 0.5) * tile;
    const cy = (s.y + 0.5) * tile;
    c.fillStyle = 'rgba(0,10,8,0.4)';
    circle(cx + 2, cy + 3, 21);
    c.fill();
    c.fillStyle = '#2a2344';
    circle(cx, cy, 20);
    c.fill();
    const g = c.createLinearGradient(cx, cy - 17, cx, cy + 17);
    g.addColorStop(0, '#c4cee8');
    g.addColorStop(1, '#6b78a0');
    c.fillStyle = g;
    circle(cx, cy, 17);
    c.fill();
    c.fillStyle = '#2a2344';
    circle(cx, cy, 8.5);
    c.fill();
    const col = s.high ? 0xffd84a : 0x5ad7ff;
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, 8);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.4, hex(col));
    glow.addColorStop(1, hex(col, 0.6));
    c.fillStyle = glow;
    circle(cx, cy, 6);
    c.fill();
    if (s.high) {
      c.strokeStyle = '#ffd84a';
      c.lineWidth = 3;
      circle(cx, cy, 22.5);
      c.stroke();
    }
  }

  // ---- Vignette douce sur les bords.
  const vg = c.createRadialGradient((m.width * tile) / 2, (m.height * tile) / 2, Math.min(m.width, m.height) * tile * 0.35, (m.width * tile) / 2, (m.height * tile) / 2, Math.max(m.width, m.height) * tile * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,15,10,0.35)');
  c.fillStyle = vg;
  c.fillRect(-pad, -pad, W, H);
  return cv;
}

export const TERRAIN_PAD = 24;

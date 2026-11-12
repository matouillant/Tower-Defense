import {
  ABILITIES,
  AbilityId,
  Command,
  ENEMIES,
  GAME_CONFIG as G,
  GameEvent,
  GameMap,
  GameState,
  HERO_NODES,
  LobbyState,
  REWARDS,
  SPEEDS,
  Role,
  ServerMessage,
  TOWERS,
  TowerDef,
  TowerState,
  TowerStats,
  UpgradeNode,
  TowerTypeId,
  availableHeroUpgrades,
  availableUpgrades,
  baseTowerStats,
  effectiveTowerStats,
  heroStats,
  isBossWave,
  normalizeCode,
  repairCost,
  reviveCost,
  salvageValue,
  towerMaxHp,
} from '@td/shared';
import '@fontsource/exo-2/500.css';
import '@fontsource/exo-2/600.css';
import '@fontsource/exo-2/800.css';
import { ART, towerIcon } from './art';
import { Net, loadSession, saveSession } from './net';
import { GameScene, Tap, createGame } from './scene';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ROLE_NAME: Record<Role, string> = { strategist: 'Stratège', hero: 'Héros' };
const PHASE_NAME = { prep: 'Préparation', wave: 'Vague en cours', inter: 'Pause', over: 'Terminé' };

const net = new Net();
let lobby: LobbyState | null = null;
let role: Role | null = null;
let map: GameMap | null = null;
let state: GameState | null = null;
let scene: GameScene | null = null;
let online = true;
/** Ce que montre le panneau contextuel. */
let panel: { kind: 'tower'; id: number } | { kind: 'slot'; id: number } | { kind: 'deposit'; id: number } | { kind: 'heroTree' } | { kind: 'menu' } | null = null;
/** Tour en cours de déplacement : le prochain emplacement libre touché la reçoit. */
let movingTower: number | null = null;
let aiPanelOpen = false;
/** Arbre d'amélioration affiché en grand : le type de tour, et la tour concernée (pour montrer sa voie). */
let treeView: { type: TowerTypeId; towerId?: number } | null = null;
/** Action sensible en attente d'une seconde pression pour être confirmée (quitter, relancer). */
let confirming: { act: string; at: number } | null = null;

/** Mêmes conditions que dans style.css : panneau latéral (téléphone couché) ou en bas (téléphone debout). */
const SIDE_SHEET = matchMedia('(orientation: landscape) and (max-height: 520px)');
const BOTTOM_SHEET = matchMedia('(max-width: 700px)');

let aiShown = '';
let aiShownAt = 0;
const speedLabel = (v: number) => `x${String(v).replace('.', ',')}`;

const cmd = (c: Command) => net.send({ m: 'cmd', cmd: c });

// ---------------------------------------------------------------- plein écran
const anyDoc = document as Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
const anyRoot = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
/** Le plein écran existe sur ordinateur, tablette et Android ; pas sur iPhone (Safari), où l'on installe le jeu sur l'écran d'accueil. */
const canFullscreen = !!(document.fullscreenEnabled || anyDoc.webkitFullscreenEnabled);
const isFullscreen = () => !!(document.fullscreenElement || anyDoc.webkitFullscreenElement);
const isStandalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIPhone = /iPhone|iPod/.test(navigator.userAgent);
async function toggleFullscreen() {
  try {
    if (isFullscreen()) await (document.exitFullscreen?.() ?? anyDoc.webkitExitFullscreen?.());
    else await (anyRoot.requestFullscreen?.({ navigationUI: 'hide' }) ?? anyRoot.webkitRequestFullscreen?.());
  } catch {
    toast('Plein écran indisponible ici.', 'err');
  }
}
const fsLabel = () => (isFullscreen() ? 'Quitter le plein écran' : 'Plein écran');
const onFullscreenChange = () => {
  if (state) renderGame();
  else renderLobby();
};
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

/** Deux pressions à moins de 4 secondes : évite de quitter ou de relancer une partie par mégarde. */
function confirmed(act: string): boolean {
  const now = performance.now();
  if (confirming && confirming.act === act && now - confirming.at < 4000) {
    confirming = null;
    return true;
  }
  confirming = { act, at: now };
  setTimeout(() => {
    if (confirming && confirming.act === act && performance.now() - confirming.at >= 3900) {
      confirming = null;
      if (state) renderGame();
    }
  }, 4000);
  return false;
}
const confirmLabel = (act: string, label: string) => (confirming?.act === act ? 'Confirmer ?' : label);

let lastToast = '';
let lastToastAt = 0;
function toast(text: string, cls = '') {
  // Pas de doublon rapproché, et au plus deux messages à l'écran.
  const now = performance.now();
  if (text === lastToast && now - lastToastAt < 4000) return;
  lastToast = text;
  lastToastAt = now;
  const el = document.createElement('div');
  el.className = `toast ${cls}`;
  el.textContent = text;
  $('toasts').append(el);
  while ($('toasts').children.length > 2) $('toasts').firstElementChild!.remove();
  setTimeout(() => el.remove(), 2800);
}

/** Ne remplace le HTML que s'il a changé : évite de casser un appui en cours. */
const lastHtml = new WeakMap<HTMLElement, string>();
function render(el: HTMLElement, html: string) {
  if (lastHtml.get(el) === html) return;
  lastHtml.set(el, html);
  el.innerHTML = html;
}

// ---------------------------------------------------------------- lobby

function joinUrl(code: string) {
  return `${location.origin}/join/${code}`;
}

async function share(code: string) {
  const url = joinUrl(code);
  try {
    if (navigator.share) await navigator.share({ title: 'Tower Defense coopératif', text: `Rejoins ma partie : code ${code}`, url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Lien copié.');
    }
  } catch {
    toast(`Lien : ${url}`);
  }
}

function renderLobby() {
  const el = $('lobby');
  if (!lobby) {
    const urlCode = /^\/join\/([A-Za-z0-9]{5})/.exec(location.pathname)?.[1] ?? '';
    const saved = loadSession();
    render(
      el,
      `<div class="logo"><img src="${ART.hero.url}" alt="" /><div><h1>Boulon <span>&amp;</span> le Dôme</h1><p>Tower defense coopératif</p></div></div>
      <p class="pitch">Un stratège pose les tourelles, Boulon le mécano les répare. Boulon peut être joué par l'IA, et remplacé à tout moment par un ami.</p>
      <div class="card">
        <label>Ton pseudo<input id="name" maxlength="20" value="${esc(saved?.name ?? '')}" placeholder="Joueur" /></label>
      </div>
      <div class="card">
        <b>Rejoindre une partie</b>
        <div class="row"><input id="code" maxlength="5" placeholder="CODE" value="${esc(urlCode.toUpperCase())}" style="text-transform:uppercase" /><button class="primary" data-act="join">Rejoindre</button></div>
      </div>
      <div class="card">
        <b>Créer une partie</b>
        <input id="seed" maxlength="40" placeholder="Seed de carte (optionnel)" />
        <small>Laisse vide pour une carte aléatoire. La même seed redonne la même carte.</small>
        <button class="primary" data-act="create">Créer</button>
      </div>
      ${online ? '' : '<p class="muted">Connexion au serveur…</p>'}${fsButton()}`,
    );
    return;
  }
  const mine = (r: Role) => role === r;
  const slots = lobby.slots
    .map((s) => {
      const who = s.status === 'human' ? esc(s.name ?? '') : s.status === 'ai' ? 'IA' : s.status === 'reconnecting' ? `${esc(s.name ?? '')} (reconnexion…)` : 'Libre';
      const btn = mine(s.role)
        ? `<button data-act="release">Rendre</button>`
        : s.status === 'human' || s.status === 'reconnecting' ? '' : `<button data-act="take" data-role="${s.role}">Prendre</button>`;
      return `<div class="slot"><span><b>${ROLE_NAME[s.role]}</b> · ${who}${mine(s.role) ? ' (toi)' : ''}</span>${btn}</div>`;
    })
    .join('');
  render(
    el,
    `<div class="logo"><img src="${ART.hero.url}" alt="" /><div><h1>Boulon <span>&amp;</span> le Dôme</h1><p>Salon d'avant-partie</p></div></div>
    <div class="card">
      <div class="code">${lobby.code}</div>
      <button data-act="share">Partager le lien d'invitation</button>
      <small>Seed de la carte : ${lobby.seed}</small>
    </div>
    <div class="card"><b>Joueurs</b>${slots}
      <small>Si personne ne prend le héros, l'IA le joue. Un ami peut la remplacer en cours de partie avec le code.</small>
    </div>
    ${role === 'strategist' ? '<button class="primary" data-act="start">Lancer la partie</button>' : '<p class="muted">En attente du stratège pour lancer la partie.</p>'}
    <button data-act="home">Quitter ce salon</button>${fsButton()}`,
  );
}

/** Bouton plein écran de l'accueil ; sur iPhone, un conseil pour installer le jeu. */
function fsButton(): string {
  if (canFullscreen) return `<button data-act="fullscreen">${fsLabel()}</button>`;
  if (isIPhone && !isStandalone) return `<p class="muted">Pour jouer en plein écran sur iPhone : bouton Partager, puis « Sur l’écran d’accueil ».</p>`;
  return '';
}

$('lobby').addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const name = ($<HTMLInputElement>('name')?.value ?? net.session?.name ?? '').trim() || 'Joueur';
  if (act === 'create') {
    pendingName = name;
    net.connect({ m: 'create', name, seed: $<HTMLInputElement>('seed').value });
  } else if (act === 'join') {
    const code = normalizeCode($<HTMLInputElement>('code').value);
    if (code.length !== 5) return toast('Le code fait 5 caractères.', 'err');
    const saved = loadSession();
    pendingName = name;
    net.connect({ m: 'join', code, name, token: saved?.code === code ? saved.token : undefined });
  } else if (act === 'share' && lobby) share(lobby.code);
  else if (act === 'take') net.send({ m: 'take', role: btn.dataset.role as Role });
  else if (act === 'release') net.send({ m: 'release' });
  else if (act === 'start') net.send({ m: 'start' });
  else if (act === 'fullscreen') toggleFullscreen();
  else if (act === 'home') goHome();
});
let pendingName = 'Joueur';

// ---------------------------------------------------------------- accueil et nouvelle partie

/** Retour à l'écran d'accueil : on quitte le salon (le héros repasse à l'IA) et on repart de zéro. */
function goHome() {
  net.send({ m: 'leave' });
  net.disconnect();
  saveSession(null);
  state = null;
  lobby = null;
  role = null;
  panel = null;
  movingTower = null;
  aiPanelOpen = false;
  treeView = null;
  confirming = null;
  scene?.reset();
  $('game').hidden = true;
  $('modal').hidden = true;
  $('lobby').hidden = false;
  history.replaceState(null, '', '/');
  renderLobby();
}

/** Les types d'ennemis déjà rencontrés (mémorisés sur l'appareil) : le premier de chaque type est présenté à l'écran. */
const SEEN_KEY = 'td:seenEnemies';
const seenEnemies = new Set<string>((() => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
})());
function announceNewEnemies(s: GameState) {
  for (const e of s.enemies) {
    if (seenEnemies.has(e.type)) continue;
    seenEnemies.add(e.type);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seenEnemies]));
    } catch {
      /* stockage indisponible : on annoncera de nouveau la prochaine fois */
    }
    const d = ENEMIES[e.type];
    if (e.type !== 'grunt') toast(`${d.boss ? 'Boss' : 'Nouveau'} : ${d.name}. ${d.desc}`, 'info');
  }
}

// ---------------------------------------------------------------- réseau

net.onStatus = (ok) => {
  online = ok;
  // Une reconnexion rapide (le serveur renouvelle les connexions régulièrement) reste silencieuse.
  if (!ok && state) setTimeout(() => !online && toast('Connexion perdue, reconnexion…', 'err'), 2500);
  if (!state) renderLobby();
};

net.onMessage = (msg: ServerMessage) => {
  switch (msg.m) {
    case 'joined':
      lobby = msg.lobby;
      role = msg.role;
      net.session = { code: lobby.code, token: msg.token, name: pendingName };
      saveSession(net.session);
      history.replaceState(null, '', `/join/${lobby.code}`);
      renderLobby();
      break;
    case 'lobby':
      lobby = msg.lobby;
      if (role !== msg.role) panel = null;
      role = msg.role;
      if (!lobby.started) renderLobby();
      else renderGame();
      break;
    case 'started':
      map = msg.map;
      // Nouvelle partie (première, ou relancée dans le même salon) : on repart d'un affichage vierge.
      state = null;
      panel = null;
      movingTower = null;
      aiPanelOpen = false;
      treeView = null;
      confirming = null;
      scene?.reset();
      $('lobby').hidden = true;
      $('game').hidden = false;
      if (!scene) {
        const created = createGame($('canvas'), map);
        scene = created.scene;
        scene.onTap = onTap;
        // La zone de jeu change de taille quand le bandeau ou la barre se remplissent : on recale le canvas.
        new ResizeObserver(([entry]) => created.resize(entry.contentRect.width, entry.contentRect.height)).observe($('stage'));
      } else scene.setMap(map);
      break;
    case 'state':
      state = msg.state;
      announceNewEnemies(msg.state);
      scene?.pushState(msg.state, msg.events);
      for (const e of msg.events) onEvent(e);
      renderGame();
      break;
    case 'error':
      toast(msg.text, 'err');
      if (!lobby) saveSession(null);
      break;
  }
};

function onEvent(e: GameEvent) {
  // Les messages de l'IA ne s'affichent pas en surimpression : ils vont dans la petite bulle du bas de carte.
  if (e.t === 'msg' && e.from === 'jeu') toast(e.text);
  else if (e.t === 'wave') toast(e.boss ? `Vague ${e.wave} : un boss approche !` : `Vague ${e.wave}`);
}

// ---------------------------------------------------------------- interactions sur la carte

function select(next: typeof panel) {
  panel = next;
  aiPanelOpen = false;
  if (scene) {
    scene.selectedTower = next?.kind === 'tower' ? next.id : null;
    scene.selectedSlot = next?.kind === 'slot' ? next.id : null;
    // Sur petit écran, on décale la carte pour que la cible ne soit pas cachée par le panneau.
    const target = next?.kind === 'tower' ? state?.towers.find((t) => t.id === next.id) : next?.kind === 'slot' ? map?.slots[next.id] : next?.kind === 'deposit' ? map?.deposits[next.id] : null;
    if (target) {
      if (SIDE_SHEET.matches) scene.focusOn(target.x, target.y, 0.22, 0);
      else if (BOTTOM_SHEET.matches) scene.focusOn(target.x, target.y, 0, 0.22);
    }
  }
  renderGame();
}

function onTap(tap: Tap, x: number, y: number) {
  if (!state || !map || state.phase === 'over') return;
  if (role === 'strategist') {
    if (scene?.armed) {
      cmd({ c: 'ability', id: scene.armed, x, y });
      scene.armed = null;
      return renderGame();
    }
    if (movingTower !== null) {
      if (tap.kind === 'slot') cmd({ c: 'moveTower', towerId: movingTower, slotId: tap.id });
      else toast('Déplacement annulé.');
      movingTower = null;
      return select(null);
    }
    if (tap.kind === 'tower' || tap.kind === 'slot') return select(tap);
    if (tap.kind === 'deposit' && state.heroController === 'ai') return select(tap);
    return select(null);
  }
  if (role === 'hero') {
    if (tap.kind === 'tower') return select(tap);
    select(null);
    if (tap.kind === 'deposit') cmd({ c: 'task', task: { kind: 'harvest', depositId: tap.id } });
    else if (tap.kind === 'prospect') cmd({ c: 'task', task: { kind: 'prospect', zoneId: tap.id } });
    else {
      const p = tap.kind === 'slot' ? map.slots[tap.id] : tap;
      cmd({ c: 'task', task: { kind: 'move', x: p.x, y: p.y } });
    }
  }
}

// ---------------------------------------------------------------- affichage du jeu

function renderGame() {
  if (!state || !map || !lobby) return;
  const s = state;
  const hs = heroStats(s.hero.upgrades);
  const revive = reviveCost(s.wave);
  const heroLine = s.hero.waitingRevive
    ? `<span class="warn">à terre · il faut ${revive}</span>`
    : s.hero.respawnIn > 0
      ? `<span class="warn">à terre · ${Math.ceil(s.hero.respawnIn)} s · ${revive}</span>`
      : `<b>${Math.ceil(s.hero.hp)}</b><span class="l"> PV · ${s.hero.carry}/${hs.carryCap}</span>`;
  const pill = (cls: string, icon: string, html: string) => `<span class="pill ${cls}">${icon}${html}</span>`;
  const bolt = `<img src="${ART.bolt.url}" alt="" />`;
  // Vitesse : celle appliquée est en surbrillance ; la mienne, si elle attend l'accord de l'autre, est en pointillés.
  const mySpeed = lobby.slots.find((sl) => sl.role === role)?.speed ?? null;
  const asked = Math.max(...lobby.slots.map((sl) => sl.speed ?? 0));
  const speedBtns = SPEEDS.map((v) => {
    const cls = v === lobby!.speed ? 'on' : v === mySpeed ? 'wait' : v === asked && asked > lobby!.speed ? 'asked' : '';
    return `<button data-act="speed" data-id="${v}" class="${cls}" ${role ? '' : 'disabled'}>${speedLabel(v)}</button>`;
  }).join('');
  // Sur téléphone, un seul bouton qui fait défiler les vitesses : le bandeau tient sur une ligne.
  const pending = mySpeed !== null && mySpeed > lobby.speed ? ` <small>→${speedLabel(mySpeed)} ?</small>` : asked > lobby.speed ? ' <small>?</small>' : '';
  const speedCycle = `<button data-act="speedCycle" class="speed-cycle ${asked > lobby.speed ? 'asked' : ''}" ${role ? '' : 'disabled'}>${speedLabel(lobby.speed)}${pending}</button>`;
  render(
    $('hud'),
    `${pill('wave', '', `<span class="l">Vague </span><span class="s">V</span><b>${s.wave}</b>`)}
     ${pill('heart', '<i>♥</i>', `<b>${s.baseHp}</b>`)}${pill('scrap', bolt, `<b>${Math.floor(s.scrap)}</b>`)}
     ${pill('hero', `<img src="${ART.hero.url}" alt="" />`, `<span class="l">${s.heroController === 'ai' ? 'IA · ' : ''}</span>${heroLine}`)}
     <span class="grow"></span>${canFullscreen ? `<button data-act="fullscreen" class="fs-btn ${isFullscreen() ? 'on' : ''}" title="${fsLabel()} (touche F)">⛶</button>` : ''}${role ? `<button data-act="pause" class="pause-btn ${lobby.paused ? 'on' : ''}" title="Pause (touche P ou Espace)">${lobby.paused ? '▶' : '❚❚'}</button>` : ''}<span class="speed">${speedBtns}</span>${speedCycle}`,
  );
  // Bulle de l'IA, en bas de la carte, sans rien décaler. Visible pour le stratège, qui la pilote.
  const aiText = s.heroController === 'ai' && role === 'strategist' ? s.ai.message : '';
  if (aiText !== aiShown) {
    aiShown = aiText;
    aiShownAt = performance.now();
  }
  const fresh = aiText && performance.now() - aiShownAt < 6000;
  render($('ai-say'), fresh ? `<b>IA</b> ${esc(aiText)}` : '');
  $('ai-say').hidden = !fresh;
  // Sur la carte : le gros bouton de lancement (stratège) ou le compte à rebours (autres joueurs).
  let over = '';
  if (s.phase === 'wave') over = `<span class="tag">${s.enemies.length + s.toSpawn} ennemi${s.enemies.length + s.toSpawn > 1 ? 's' : ''}</span>`;
  else if (s.phase !== 'over') {
    const label = `Vague ${s.wave + 1}${isBossWave(s.wave + 1) ? ' · BOSS' : ''}`;
    over = role === 'strategist'
      ? `<button class="launch" data-act="ready">▶ Lancer la ${label.toLowerCase()} <small>${Math.ceil(s.phaseTimer)} s</small></button>`
      : `<span class="tag">${label} dans ${Math.ceil(s.phaseTimer)} s</span>`;
  }
  if (!online) over += `<span class="tag bad">hors ligne</span>`;
  // Pause : un voile sur la carte, avec le bouton pour reprendre.
  const pauseEl = $('pause');
  pauseEl.hidden = !lobby.paused || s.phase === 'over';
  render(pauseEl, lobby.paused
    ? `<div class="box"><h2>Pause</h2><p>${esc(lobby.paused)} a mis la partie en pause.</p><p class="muted">Vous pouvez construire et améliorer en attendant.</p>${role ? '<button class="primary" data-act="resume">▶ Reprendre</button>' : ''}</div>`
    : '');
  render($('overlay'), over);
  if (scene) scene.follow = role === 'hero';
  renderBar(s);
  renderPanel(s);
  renderAiPanel(s);
  renderModal(s);
}

function renderBar(s: GameState) {
  let html = '';
  if (role === 'strategist') {
    for (const id of Object.keys(ABILITIES) as AbilityId[]) {
      const cd = s.abilities[id];
      const needsTower = id === 'surcharge' && panel?.kind !== 'tower';
      html += `<button data-act="ability" data-id="${id}" class="${scene?.armed === id ? 'on' : ''}" ${cd > 0 || needsTower ? 'disabled' : ''}>${ABILITIES[id].name}${cd > 0 ? ` ${Math.ceil(cd)}s` : ''}</button>`;
    }
    if (s.heroController === 'ai') html += `<button data-act="ai" class="${aiPanelOpen ? 'on' : ''}">Piloter l'IA</button>`;
  } else if (role === 'hero') {
    html += `<button data-act="deliver">Rentrer à la base</button><button data-act="stop">Stop</button><button data-act="heroTree">Améliorations</button>`;
  }
  if (scene?.canPan() || scene?.zoomedOut()) html += `<button data-act="overview">${scene.canPan() ? 'Vue d’ensemble' : 'Zoomer'}</button>`;
  html += `<button data-act="menu" class="${panel?.kind === 'menu' ? 'on' : ''}">Menu</button>`;
  render($('bar'), html);
}

const pct = (v: number) => `${Math.round(v * 100)} %`;
const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

/** Les caractéristiques utiles d'une tour, en une phrase : dégâts, effets spéciaux, aura, production. */
function statBits(st: TowerStats): string[] {
  const bits: string[] = [];
  if (st.damage > 0) bits.push(`dégâts ${fmt(st.damage)}`, `portée ${st.range.toFixed(1)}`, `un tir toutes les ${st.cooldown.toFixed(2)} s`);
  if (st.splash > 0) bits.push(`zone ${st.splash.toFixed(1)}`);
  if (st.chain > 0) bits.push(`${st.chain} rebond${st.chain > 1 ? 's' : ''}`);
  if (st.ramp > 0) bits.push(`monte jusqu’à +${Math.round(st.ramp * st.rampMax * 100)} % sur une même cible`);
  if (st.critChance > 0) bits.push(`${pct(st.critChance)} de critiques (×${fmt(st.critMult)})`);
  if (st.pierceShield) bits.push('perce boucliers et armures');
  if (st.slow > 0) bits.push(`ralentit de ${pct(st.slow)}`);
  if (st.dot > 0) bits.push(`brûlure ${fmt(st.dot)}/s`);
  if (st.auraRadius > 0) {
    const a: string[] = [];
    if (st.auraDamage > 0) a.push(`dégâts +${pct(st.auraDamage)}`);
    if (st.auraRate > 0) a.push(`cadence +${pct(st.auraRate)}`);
    if (st.auraReach > 0) a.push(`portée +${fmt(st.auraReach)}`);
    if (st.auraHeal > 0) a.push(`répare ${fmt(st.auraHeal)} PV/s`);
    if (a.length) bits.push(`voisines (${fmt(st.auraRadius)} cases) : ${a.join(', ')}`);
  }
  if (st.income > 0) bits.push(`produit ${st.income.toFixed(1)} ressource/s`);
  return bits;
}

function towerPanel(s: GameState, t: TowerState): string {
  const def = TOWERS[t.type];
  const st = effectiveTowerStats(t, s.towers, map!);
  const max = towerMaxHp(t);
  const names = t.path.map((id) => def.nodes.find((n) => n.id === id)?.name ?? id);
  const ammoMax = baseTowerStats(t).ammo;
  let html = `<div class="panel-head"><h3>${def.name}${names.length ? ' › ' + names.join(' › ') : ''}</h3><button data-act="close">✕</button></div>
    <div>PV ${Math.ceil(t.hp)}/${Math.ceil(max)}${t.maxHpFactor < 1 ? ` <span class="muted">(usure ${pct(1 - t.maxHpFactor)})</span>` : ''}
    · ${statBits(st).join(' · ')}${ammoMax > 0 ? ` · munitions ${t.ammo}/${ammoMax}` : ''}</div>`;

  if (role === 'hero') {
    const cap = s.phase === 'wave' ? max * G.quickRepairCap : max;
    const missing = Math.max(0, cap - t.hp);
    const cost = Math.ceil(repairCost(t, missing, heroStats(s.hero.upgrades).repairCostMult));
    html += `<div class="grid">
      <button data-act="task" data-kind="repair" ${missing < 1 ? 'disabled' : ''}>Réparer<small>${missing < 1 ? (t.hp >= max - 1 ? 'En bon état' : 'Maximum en pleine vague') : `environ ${cost} ressources`}</small></button>
      ${ammoMax > 0 ? `<button data-act="task" data-kind="reload" ${t.ammo >= ammoMax ? 'disabled' : ''}>Recharger<small>${Math.ceil(def.cost * G.reloadCostRatio * (1 - t.ammo / ammoMax))} ressources</small></button>` : ''}
      <button class="danger" data-act="task" data-kind="recycle">Recycler<small>+${salvageValue(t, G.recycleRatio)} ressources</small></button></div>`;
    return html;
  }

  const ups = availableUpgrades(t);
  html += `<div class="section">Améliorations (une seule voie possible) <button class="mini" data-act="tree" data-id="${t.type}">Voir l’arbre</button></div>`;
  html += ups.length
    ? `<div class="grid">${ups.map((n) => `<button data-act="upgrade" data-id="${n.id}" ${s.scrap < n.cost ? 'disabled' : ''}><b>${n.name}</b> · ${n.cost}<small>${n.desc}</small></button>`).join('')}</div>`
    : `<div class="muted">Arbre terminé.</div>`;
  const modes = [['first', 'Le plus avancé'], ['strong', 'Le plus fort'], ['weak', 'Le plus faible'], ['fast', 'Le plus rapide']];
  // Un relais ne tire pas : le choix de cible n'a pas de sens pour lui.
  if (st.damage > 0) html += `<div class="section">Cible</div><div class="chips">${modes.map(([m, l]) => `<button data-act="targeting" data-id="${m}" class="${t.targeting === m ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (s.heroController === 'ai') {
    const prios = [['high', 'Prioritaire'], ['normal', 'Normale'], ['sacrifice', 'À sacrifier']];
    html += `<div class="section">Consigne pour l'IA</div><div class="chips">${prios.map(([p, l]) => `<button data-act="priority" data-id="${p}" class="${t.aiPriority === p ? 'on' : ''}">${l}</button>`).join('')}
      <button data-act="orderRepair" ${s.ai.orderCooldown > 0 ? 'disabled' : ''}>Ordre : répare-la</button></div>`;
  }
  const spent = t.path.reduce((sum, id) => sum + (def.nodes.find((n) => n.id === id)?.cost ?? 0), 0);
  html += `<div class="section">Actions</div><div class="chips">
    <button class="danger" data-act="sell">Vendre (+${salvageValue(t, G.sellRatio)})</button>
    ${t.path.length ? `<button data-act="respec">Respécialiser (${Math.floor(spent * G.respecRefund) - G.respecCost >= 0 ? '+' : ''}${Math.floor(spent * G.respecRefund) - G.respecCost})</button>` : ''}
    <button data-act="move">Déplacer (-${Math.ceil(t.invested * G.moveCostRatio)})</button></div>`;
  return html;
}

function heroTreePanel(s: GameState): string {
  const owned = s.hero.upgrades.map((id) => HERO_NODES.find((n) => n.id === id)?.name ?? id);
  const ups = availableHeroUpgrades(s.hero.upgrades);
  return `<div class="panel-head"><h3>Améliorations du héros</h3><button data-act="close">✕</button></div>
    <div class="muted">${owned.length ? 'Voie choisie : ' + owned.join(' › ') : 'Une seule voie possible. Payé sur le stock commun.'}</div>
    ${ups.length ? `<div class="grid">${ups.map((n) => `<button data-act="heroUpgrade" data-id="${n.id}" ${s.scrap < n.cost ? 'disabled' : ''}><b>${n.name}</b> · ${n.cost}<small>${n.desc}</small></button>`).join('')}</div>` : '<div class="muted">Arbre terminé.</div>'}`;
}

function menuPanel(s: GameState): string {
  const slots = lobby!.slots
    .map((sl) => {
      const who = sl.status === 'human' ? esc(sl.name ?? '') : sl.status === 'ai' ? 'IA' : sl.status === 'reconnecting' ? 'reconnexion…' : 'libre';
      const btn = role === sl.role
        ? `<button data-act="release">${sl.role === 'hero' ? "Rendre la main à l'IA" : 'Quitter ce rôle'}</button>`
        : sl.status === 'ai' || sl.status === 'open' ? `<button data-act="take" data-id="${sl.role}">${sl.status === 'ai' ? "Remplacer l'IA" : 'Prendre'}</button>` : '';
      return `<div class="field"><span><b>${ROLE_NAME[sl.role]}</b> · ${who}</span>${btn}</div>`;
    })
    .join('');
  // Relancer : le stratège à tout moment, les autres joueurs seulement une fois la base tombée.
  const canRestart = role !== null && (role === 'strategist' || s.phase === 'over');
  return `<div class="panel-head"><h3>Menu · partie ${lobby!.code}</h3><button data-act="close">✕</button></div>
    ${slots}<div class="chips"><button data-act="share">Inviter un joueur</button>${canFullscreen ? `<button data-act="fullscreen">${fsLabel()}</button>` : ''}</div>
    <div class="section">Partie</div>
    <div class="chips">
      ${canRestart ? `<button data-act="restart">${confirmLabel('restart', 'Rejouer · nouvelle carte')}</button><button data-act="restartSame">${confirmLabel('restartSame', 'Rejouer · même carte')}</button>` : ''}
      <button class="danger" data-act="home">${confirmLabel('home', 'Quitter vers l’accueil')}</button>
    </div>
    ${isIPhone && !isStandalone ? '<small>Plein écran sur iPhone : bouton Partager de Safari, puis « Sur l’écran d’accueil ».</small>' : ''}
    <small>Seed de la carte : ${lobby!.seed} · score : vague ${s.wave}</small>`;
}

/** Arbre d'amélioration complet d'un type de tour. Avec une tour précise, on voit sa voie et ce qu'elle peut encore acheter. */
function treeModal(type: TowerTypeId, towerId?: number): string {
  const def: TowerDef = TOWERS[type];
  const tower = towerId !== undefined ? state?.towers.find((t) => t.id === towerId && t.type === type) : undefined;
  const path = tower?.path ?? [];
  const last = path.length ? path[path.length - 1] : null;
  const pathTo = (id: string): string[] => {
    const out: string[] = [];
    for (let n: UpgradeNode | undefined = def.nodes.find((x) => x.id === id); n; n = n.parent ? def.nodes.find((x) => x.id === n!.parent) : undefined) out.unshift(n.id);
    return out;
  };
  const branch = (parent: string | null, depth: number): string => {
    const kids = def.nodes.filter((n) => n.parent === parent);
    if (!kids.length) return '';
    return `<ul>${kids
      .map((n) => {
        const cls = !tower ? '' : path.includes(n.id) ? 'chosen' : n.parent === last ? 'next' : 'locked';
        const bits = statBits(baseTowerStats({ type, path: pathTo(n.id) })).join(' · ');
        return `<li class="${cls}"><div class="n"><span class="lv">N${depth + 1}</span><b>${n.name}</b> <i>${n.cost}</i><small>${n.desc}</small><small class="bits">${bits}</small></div>${branch(n.id, depth + 1)}</li>`;
      })
      .join('')}</ul>`;
  };
  const baseBits = statBits(def.base).join(' · ');
  return `<div class="box tree"><div class="panel-head"><h3>${def.name}</h3><button data-act="treeClose">✕</button></div>
    <p class="muted">${def.desc} Une seule voie par tour : choisir une branche ferme les autres du même niveau.${tower ? ' <b>Vert</b> : ta voie · <b>jaune</b> : prochain achat · <b>grisé</b> : fermé.' : ''}</p>
    <div class="root"><span class="lv">N1</span><b>${def.name}</b> <i>${def.cost}</i><small class="bits">${baseBits}</small></div>
    <div class="tree-scroll">${branch(null, 1)}</div></div>`;
}

function renderPanel(s: GameState) {
  const el = $('panel');
  let html = '';
  if (panel?.kind === 'tower') {
    const t = s.towers.find((q) => q.id === (panel as { id: number }).id);
    if (t) html = towerPanel(s, t);
    else panel = null;
  } else if (panel?.kind === 'slot' && role === 'strategist') {
    if (s.towers.some((t) => t.slotId === (panel as { id: number }).id)) panel = null;
    else {
      const high = map!.slots[panel.id].high;
      html = `<div class="panel-head"><h3>Construire${high ? ' (point haut : +20 % de portée)' : ''}</h3><button data-act="close">✕</button></div><div class="grid">${(Object.keys(TOWERS) as TowerTypeId[])
        .map((id) => `<button class="build" data-act="build" data-id="${id}" ${s.scrap < TOWERS[id].cost ? 'disabled' : ''}><img src="${towerIcon(id)}" alt="" /><span><b>${TOWERS[id].name}</b> · ${TOWERS[id].cost}<small>${TOWERS[id].desc}</small></span></button>`)
        .join('')}</div>
        <div class="section">Arbres d’amélioration</div><div class="chips">${(Object.keys(TOWERS) as TowerTypeId[]).map((id) => `<button class="mini" data-act="tree" data-id="${id}">${TOWERS[id].name}</button>`).join('')}</div>`;
    }
  } else if (panel?.kind === 'deposit') {
    html = `<div class="panel-head"><h3>Gisement (${s.deposits[panel.id]} restant)</h3><button data-act="close">✕</button></div>
      <button data-act="orderHarvest" ${s.ai.orderCooldown > 0 || s.deposits[panel.id] <= 0 ? 'disabled' : ''}>Ordre à l'IA : récolte ici</button>`;
  } else if (panel?.kind === 'heroTree') html = heroTreePanel(s);
  else if (panel?.kind === 'menu') html = menuPanel(s);
  if (movingTower !== null) html = `<div class="panel-head"><h3>Touche un emplacement libre pour y déplacer la tour</h3><button data-act="close">✕</button></div>`;
  el.hidden = html === '' || aiPanelOpen;
  render(el, html);
}

/** Panneau de commandement de l'IA. Construit une seule fois pour ne pas gêner les curseurs. */
function renderAiPanel(s: GameState) {
  const el = $('ai-panel');
  const show = aiPanelOpen && role === 'strategist' && s.heroController === 'ai';
  el.hidden = !show;
  if (!show) return;
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `<div class="panel-head"><h3>Piloter l'IA du héros</h3><button data-act="ai">✕</button></div>
      <div class="field"><span>Budget de réparation</span><b id="ai-budget-v"></b><input id="ai-budget" type="range" min="0" max="100" step="5" /></div>
      <small id="ai-spent"></small>
      <div class="field"><span>Réparer sous</span><b id="ai-thr-v"></b><input id="ai-thr" type="range" min="10" max="100" step="5" /></div>
      <div class="section">Posture</div>
      <div class="chips" id="ai-posture"></div>
      <div class="section">Ordres directs</div>
      <div class="chips"><button data-act="orderRetreat" id="ai-retreat">Recule à la base</button></div>
      <small>Pour « répare » ou « récolte ici », touche une tour ou un gisement.</small>`;
    $<HTMLInputElement>('ai-budget').addEventListener('change', (e) => cmd({ c: 'aiSettings', settings: { repairBudgetPct: Number((e.target as HTMLInputElement).value) / 100 } }));
    $<HTMLInputElement>('ai-thr').addEventListener('change', (e) => cmd({ c: 'aiSettings', settings: { repairThreshold: Number((e.target as HTMLInputElement).value) / 100 } }));
    for (const id of ['ai-budget', 'ai-thr']) $<HTMLInputElement>(id).addEventListener('input', (e) => ($(`${id}-v`).textContent = `${(e.target as HTMLInputElement).value} %`));
  }
  const sync = (id: string, value: number) => {
    const input = $<HTMLInputElement>(id);
    if (document.activeElement === input) return;
    input.value = String(Math.round(value * 100));
    $(`${id}-v`).textContent = pct(value);
  };
  sync('ai-budget', s.ai.repairBudgetPct);
  sync('ai-thr', s.ai.repairThreshold);
  $('ai-spent').textContent = `Dépensé depuis le début de la phase : ${Math.round(s.ai.spent)} / ${s.ai.allowance}. Au-delà, l'IA attend ton ordre.`;
  const postures = [['prudente', 'Prudente'], ['equilibree', 'Équilibrée'], ['agressive', 'Agressive']];
  render($('ai-posture'), postures.map(([p, l]) => `<button data-act="posture" data-id="${p}" class="${s.ai.posture === p ? 'on' : ''}">${l}</button>`).join(''));
  $<HTMLButtonElement>('ai-retreat').disabled = s.ai.orderCooldown > 0;
}

function renderModal(s: GameState) {
  const el = $('modal');
  let html = '';
  if (s.phase === 'over') {
    html = `<div class="box"><h2>La base est tombée</h2><p>Vous avez tenu <b>${Math.max(0, s.wave - 1)}</b> vague${s.wave - 1 > 1 ? 's' : ''} · ${s.bossesKilled} boss vaincu${s.bossesKilled > 1 ? 's' : ''}.</p>
      <p class="muted">Seed de la carte : ${lobby!.seed}</p>
      <div class="stack">${role ? `<button class="primary" data-act="restart">Rejouer · nouvelle carte</button><button data-act="restartSame">Rejouer · même carte</button>` : '<p class="muted">Un joueur du salon peut relancer la partie.</p>'}
      <button data-act="home">Retour à l’accueil</button></div></div>`;
  } else if (s.rewardChoices && role === 'strategist') {
    html = `<div class="box"><h2>Boss vaincu !</h2><p>Choisis une récompense :</p><div class="grid">${s.rewardChoices
      .map((id) => `<button data-act="reward" data-id="${id}"><b>${REWARDS[id].name}</b><small>${REWARDS[id].desc}</small></button>`)
      .join('')}</div></div>`;
  }
  else if (treeView) html = treeModal(treeView.type, treeView.towerId);
  el.hidden = html === '';
  render(el, html);
}

// Un seul gestionnaire pour toutes les actions de l'interface de jeu.
$('game').addEventListener('pointerdown', (ev) => {
  const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
  if (!btn || btn.disabled || !state) return;
  // Le plein écran exige un « vrai » geste : il est traité sur le clic, pas sur l'appui.
  if (btn.dataset.act === 'fullscreen') return;
  ev.preventDefault();
  const id = btn.dataset.id ?? '';
  const towerId = panel?.kind === 'tower' ? panel.id : -1;
  switch (btn.dataset.act) {
    case 'close': movingTower = null; return select(null);
    case 'ready': cmd({ c: 'ready' }); break;
    case 'speed': net.send({ m: 'speed', speed: Number(id) }); break;
    case 'pause': net.send({ m: 'pause', on: !lobby!.paused }); break;
    case 'resume': net.send({ m: 'pause', on: false }); break;
    case 'speedCycle': {
      const mine = lobby!.slots.find((sl) => sl.role === role)?.speed ?? lobby!.speed;
      net.send({ m: 'speed', speed: SPEEDS[(SPEEDS.indexOf(mine) + 1) % SPEEDS.length] });
      break;
    }
    case 'ability':
      if (id === 'surcharge') cmd({ c: 'ability', id, towerId });
      else if (scene) {
        scene.armed = scene.armed === id ? null : (id as AbilityId);
        if (scene.armed) toast('Touche la carte pour viser.');
      }
      break;
    case 'ai': aiPanelOpen = !aiPanelOpen; break;
    case 'overview': scene?.toggleOverview(); break;
    case 'menu': return select(panel?.kind === 'menu' ? null : { kind: 'menu' });
    case 'heroTree': return select(panel?.kind === 'heroTree' ? null : { kind: 'heroTree' });
    case 'deliver': cmd({ c: 'task', task: { kind: 'deliver' } }); break;
    case 'stop': cmd({ c: 'task', task: { kind: 'idle' } }); break;
    case 'build': if (panel?.kind === 'slot') cmd({ c: 'build', slotId: panel.id, type: id as TowerTypeId }); return select(null);
    case 'upgrade': cmd({ c: 'upgrade', towerId, nodeId: id }); break;
    case 'targeting': cmd({ c: 'targeting', towerId, mode: id as TowerState['targeting'] }); break;
    case 'priority': cmd({ c: 'aiPriority', towerId, priority: id as TowerState['aiPriority'] }); break;
    case 'orderRepair': cmd({ c: 'aiOrder', kind: 'repair', targetId: towerId }); break;
    case 'orderRetreat': cmd({ c: 'aiOrder', kind: 'retreat' }); break;
    case 'orderHarvest': if (panel?.kind === 'deposit') cmd({ c: 'aiOrder', kind: 'harvest', targetId: panel.id }); return select(null);
    case 'posture': cmd({ c: 'aiSettings', settings: { posture: id as GameState['ai']['posture'] } }); break;
    case 'sell': cmd({ c: 'sell', towerId }); return select(null);
    case 'respec': cmd({ c: 'respec', towerId }); break;
    case 'move': movingTower = towerId; toast('Touche un emplacement libre.'); break;
    case 'task': cmd({ c: 'task', task: { kind: btn.dataset.kind as 'repair' | 'reload' | 'recycle', towerId } }); return select(null);
    case 'heroUpgrade': cmd({ c: 'heroUpgrade', nodeId: id }); break;
    case 'reward': cmd({ c: 'reward', id: id as keyof typeof REWARDS }); break;
    case 'take': net.send({ m: 'take', role: id as Role }); return select(null);
    case 'release': net.send({ m: 'release' }); return select(null);
    case 'share': share(lobby!.code); break;
    case 'tree': treeView = { type: id as TowerTypeId, towerId: panel?.kind === 'tower' ? panel.id : undefined }; break;
    case 'treeClose': treeView = null; break;
    case 'restart':
    case 'restartSame':
      // En cours de partie, il faut confirmer ; une fois la base tombée, c'est direct.
      if (state.phase !== 'over' && !confirmed(btn.dataset.act)) break;
      net.send({ m: 'restart', sameMap: btn.dataset.act === 'restartSame' });
      return select(null);
    case 'home':
      if (state.phase !== 'over' && !confirmed('home')) break;
      return goHome();
  }
  renderGame();
});

$('game').addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).closest('[data-act="fullscreen"]')) toggleFullscreen();
});

// Clavier (ordinateur) : P ou Espace pour la pause, F pour le plein écran, Échap pour fermer un panneau.
window.addEventListener('keydown', (ev) => {
  if (!state || !lobby?.started || (ev.target as HTMLElement).tagName === 'INPUT') return;
  if (ev.key === 'p' || ev.key === 'P' || ev.key === ' ') {
    ev.preventDefault();
    if (role) net.send({ m: 'pause', on: !lobby.paused });
  } else if (ev.key === 'f' || ev.key === 'F') {
    if (canFullscreen) toggleFullscreen();
  } else if (ev.key === 'Escape') {
    treeView = null;
    movingTower = null;
    if (scene) scene.armed = null;
    select(null);
  }
});

// ---------------------------------------------------------------- démarrage

renderLobby();
// Rechargement de page en cours de partie : on revient dedans avec le même rôle.
const saved = loadSession();
const urlCode = /^\/join\/([A-Za-z0-9]{5})/.exec(location.pathname)?.[1]?.toUpperCase();
if (saved && urlCode === saved.code) {
  pendingName = saved.name;
  net.connect({ m: 'join', code: saved.code, name: saved.name, token: saved.token });
}

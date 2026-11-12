import { describe, expect, it } from 'vitest';
import { GAME_CONFIG, ServerMessage, isValidCode } from '@td/shared';
import { Room, RoomManager } from '../src/rooms';

function fakeSocket() {
  const messages: ServerMessage[] = [];
  return { messages, send: (data: string) => void messages.push(JSON.parse(data)), last: (m: string) => [...messages].reverse().find((x) => x.m === m) as any };
}
const DT = 1 / GAME_CONFIG.tickRate;

describe('salons', () => {
  it('crée une partie avec un code valide et une seed rejouable', () => {
    const manager = new RoomManager();
    const a = manager.create('ma-carte') as Room;
    const b = manager.create('ma-carte') as Room;
    expect(isValidCode(a.code)).toBe(true);
    expect(a.code).not.toBe(b.code);
    expect(a.map).toEqual(b.map);
  });

  it('lobby, lancement, puis un humain remplace l’IA en cours de partie et lui rend la main', () => {
    const room = new RoomManager().create() as Room;
    const s1 = fakeSocket();
    const p1 = room.join(s1, 'Alice') as any;
    expect(p1.role).toBe('strategist');
    expect(room.lobby().slots.map((s) => s.status)).toEqual(['human', 'ai']);

    room.handle(p1, { m: 'start' });
    expect(room.game).not.toBeNull();
    expect(room.game!.state.heroController).toBe('ai');
    for (let i = 0; i < 100; i++) room.tick(1000 + i * 50, DT);
    expect(s1.last('state').state.tick).toBeGreaterThan(0);

    // Bob rejoint en cours de partie : il prend le héros, dans son état exact.
    const heroBefore = JSON.stringify(room.game!.state.hero);
    const s2 = fakeSocket();
    const p2 = room.join(s2, 'Bob') as any;
    expect(p2.role).toBe('hero');
    expect(room.game!.state.heroController).toBe('human');
    expect(JSON.stringify(room.game!.state.hero)).toBe(heroBefore);
    expect(s2.last('started').map.seed).toBe(room.map.seed);

    // Chacun son rôle.
    room.handle(p2, { m: 'cmd', cmd: { c: 'build', slotId: 0, type: 'canon' } });
    expect(s2.last('error')).toBeTruthy();
    room.handle(p1, { m: 'cmd', cmd: { c: 'build', slotId: 0, type: 'canon' } });
    expect(room.game!.state.towers.length).toBe(1);

    room.handle(p2, { m: 'release' });
    expect(room.game!.state.heroController).toBe('ai');
    expect(room.lobby().slots[1].status).toBe('ai');
  });

  it('déconnexion : l’IA reprend, le slot est réservé puis libéré, la reconnexion rend le rôle', () => {
    const room = new RoomManager().create() as Room;
    const p1 = room.join(fakeSocket(), 'Alice') as any;
    const p2 = room.join(fakeSocket(), 'Bob') as any;
    room.handle(p1, { m: 'start' });
    expect(room.game!.state.heroController).toBe('human');

    // Micro-coupure : rien ne change. Au-delà de quelques secondes, l'IA reprend.
    room.disconnect(p2, 10_000);
    room.tick(11_000, DT);
    expect(room.game!.state.heroController).toBe('human');
    room.tick(14_000, DT);
    expect(room.game!.state.heroController).toBe('ai');
    expect(room.lobby().slots[1].status).toBe('reconnecting');

    // Reconnexion dans le délai : Bob retrouve le héros.
    const back = room.join(fakeSocket(), 'Bob', p2.token) as any;
    expect(back.role).toBe('hero');
    expect(room.game!.state.heroController).toBe('human');

    // Déconnexion longue : le slot est libéré.
    room.disconnect(back, 20_000);
    room.tick(20_000 + (GAME_CONFIG.reconnectGrace + 1) * 1000, DT);
    expect(room.lobby().slots[1].status).toBe('ai');
  });

  it('vitesse : appliquée seule face à l’IA, mais il faut l’accord des deux joueurs humains', () => {
    const room = new RoomManager().create() as Room;
    const p1 = room.join(fakeSocket(), 'Alice') as any;
    room.handle(p1, { m: 'start' });
    room.handle(p1, { m: 'speed', speed: 3 });
    expect(room.speed).toBe(3);
    const before = room.game!.state.tick;
    for (let i = 0; i < 10; i++) room.tick(1000 + i * 50, DT);
    // 10 ticks réels, à x3 sur un rythme de base de 1,2 : 36 pas de simulation.
    expect(room.game!.state.tick).toBe(before + Math.round(10 * 3 * GAME_CONFIG.gameSpeed));

    const p2 = room.join(fakeSocket(), 'Bob') as any;
    expect(room.speed).toBe(1);
    room.handle(p2, { m: 'speed', speed: 1.5 });
    expect(room.speed).toBe(1.5);
    room.handle(p2, { m: 'speed', speed: 3 });
    expect(room.speed).toBe(3);
    room.handle(p1, { m: 'speed', speed: 4 as any });
    expect(room.speed).toBe(3);
  });

  it('pause : n’importe quel joueur la met ou l’enlève, la simulation s’arrête mais on peut construire', () => {
    const room = new RoomManager().create() as Room;
    const p1 = room.join(fakeSocket(), 'Alice') as any;
    const p2 = room.join(fakeSocket(), 'Bob') as any;
    room.handle(p1, { m: 'start' });
    room.tick(1000, DT);
    room.handle(p2, { m: 'pause', on: true });
    expect(room.lobby().paused).toBe('Bob');
    const tick = room.game!.state.tick;
    const timer = room.game!.state.phaseTimer;
    for (let i = 0; i < 20; i++) room.tick(2000 + i * 50, DT);
    expect(room.game!.state.tick).toBe(tick);
    expect(room.game!.state.phaseTimer).toBe(timer);
    room.handle(p1, { m: 'cmd', cmd: { c: 'build', slotId: 0, type: 'canon' } });
    expect(room.game!.state.towers.length).toBe(1);
    room.handle(p1, { m: 'pause', on: false });
    expect(room.lobby().paused).toBeNull();
    room.tick(4000, DT);
    expect(room.game!.state.tick).toBeGreaterThan(tick);
  });

  it('la partie se met en pause quand plus personne n’est connecté', () => {
    const room = new RoomManager().create() as Room;
    const p1 = room.join(fakeSocket(), 'Alice') as any;
    room.handle(p1, { m: 'start' });
    room.tick(1000, DT);
    const tick = room.game!.state.tick;
    room.disconnect(p1, 2000);
    room.tick(3000, DT);
    expect(room.game!.state.tick).toBe(tick);
  });

  it('relancer : le stratège à tout moment, un autre joueur seulement une fois la base tombée ; mêmes rôles, nouvelle carte', () => {
    const room = new RoomManager().create() as Room;
    const s1 = fakeSocket();
    const s2 = fakeSocket();
    const p1 = room.join(s1, 'Alice') as any;
    const p2 = room.join(s2, 'Bob') as any;
    room.handle(p1, { m: 'start' });
    room.handle(p1, { m: 'cmd', cmd: { c: 'build', slotId: 0, type: 'canon' } });
    expect(room.game!.state.towers.length).toBe(1);

    // Le héros ne peut pas relancer une partie en cours.
    room.handle(p2, { m: 'restart' });
    expect(s2.last('error')).toBeTruthy();
    expect(room.game!.state.towers.length).toBe(1);

    room.handle(p1, { m: 'restart' });
    expect(room.game!.state.towers.length).toBe(0);
    expect(room.game!.state.wave).toBe(0);
    expect(room.game!.state.heroController).toBe('human');
    expect(room.lobby().slots.map((sl) => sl.role + ':' + sl.status)).toEqual(['strategist:human', 'hero:human']);
    expect(s2.last('started').map.seed).toBe(room.map.seed);

    // Même carte demandée : la seed ne change pas.
    const seed = room.map.seed;
    room.handle(p1, { m: 'restart', sameMap: true });
    expect(room.map.seed).toBe(seed);

    // Base tombée : le héros peut relancer.
    room.game!.state.baseHp = 0;
    room.game!.step(DT);
    expect(room.game!.state.phase).toBe('over');
    room.handle(p2, { m: 'restart' });
    expect(room.game!.state.phase).toBe('prep');
  });

  it('quitter : le rôle est libéré tout de suite et l’IA reprend le héros', () => {
    const room = new RoomManager().create() as Room;
    const p1 = room.join(fakeSocket(), 'Alice') as any;
    const p2 = room.join(fakeSocket(), 'Bob') as any;
    room.handle(p1, { m: 'start' });
    expect(room.game!.state.heroController).toBe('human');
    room.leave(p2);
    expect(room.game!.state.heroController).toBe('ai');
    expect(room.lobby().slots[1].status).toBe('ai');
    expect(room.clients.has(p2.token)).toBe(false);
    room.leave(p1);
    expect(room.lobby().slots[0].status).toBe('open');
  });
});

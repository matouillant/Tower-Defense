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
});

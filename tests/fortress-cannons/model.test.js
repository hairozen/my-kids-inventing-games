import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, fire, placeGuard, score, MAP } from '../../public/games/fortress-cannons/model.js';

const fresh = difficulty => createGame({ difficulty, random: () => 0.5 });
function quiet(game) { game.actors = [game.player]; return game; }
function ticks(game, seconds, input = {}) { for (let t = 0; t < seconds; t += 0.05) step(game, 0.05, input); }
function paint(game, target, count) {
  target.invulnerable = 0;
  for (let i = 0; i < count; i++) {
    game.projectiles.push({ id: `test-${i}`, x: target.x, z: target.z - 1, vx: 0, vz: 32, team: target.team === 'blue' ? 'coral' : 'blue', life: 1 });
    step(game, 0.025);
  }
}
test('keys capture, relocate, and recapture only the three central forts', () => {
  const g = quiet(fresh()), p = g.player, f = g.forts.find(f => !f.home), old = { ...g.keys[0] };
  Object.assign(p, old); step(g, 0.01); assert.equal(p.hasKey, true);
  Object.assign(p, { x: f.gateX, z: f.gateZ }); step(g, 0.01);
  assert.equal(f.owner, 'blue'); assert.equal(p.hasKey, false); assert.equal(g.keys.length, 3);
  assert.ok(g.keys.every(k => k.x !== old.x || k.z !== old.z));
  p.team = 'coral'; p.hasKey = true; step(g, 0.01); assert.equal(f.owner, 'coral');
  p.hasKey = true; Object.assign(p, MAP.homes.blue); step(g, 0.01);
  assert.equal(g.forts.find(f => f.id === 'home-blue').owner, 'blue'); assert.equal(p.hasKey, true);
  assert.deepEqual(score(g), { blue: 0, coral: 1 });
});
test('five paint hits return hero home, preserving round with brief protection', () => {
  const g = quiet(fresh()); Object.assign(g.player, { x: 15, z: -12 });
  paint(g, g.player, 4); assert.equal(g.player.hp, 1); assert.equal(g.player.x, 15);
  paint(g, g.player, 1); assert.equal(g.player.hp, 5); assert.equal(g.player.z, -31); assert.ok(g.player.invulnerable > 0); assert.equal(g.ended, false);
  const hp = g.player.hp; g.projectiles.push({ x: 0, z: -32, vx: 0, vz: 32, team: 'coral', life: 1 }); step(g, 0.025); assert.equal(g.player.hp, hp);
});
test('circles store one placement; guard survives two hits and disappears after three', () => {
  const g = quiet(fresh()); Object.assign(g.player, g.circles[0]); step(g, 0.01);
  assert.equal(g.player.guardCharge, true); assert.ok(g.circles[0].cooldown > 9);
  Object.assign(g.player, { x: 15, z: -12 }); assert.equal(placeGuard(g), true);
  const guard = g.guards[0]; assert.equal(guard.x, 15); assert.equal(placeGuard(g), false);
  g.player.x = 20; paint(g, guard, 2); assert.equal(guard.hp, 1); assert.equal(g.guards.length, 1);
  paint(g, guard, 1); assert.equal(g.guards.length, 0);
  ticks(g, 11); Object.assign(g.player, { x: g.circles[0].x, z: g.circles[0].z }); step(g, 0.01); assert.equal(g.player.guardCharge, true);
});
test('guard cap is six and stationary guards shoot nearby opponents', () => {
  const g = fresh(); g.actors = [g.player, g.actors[3]];
  for (let i = 0; i < 6; i++) { g.player.guardCharge = true; assert.equal(placeGuard(g), true); }
  g.player.guardCharge = true; assert.equal(placeGuard(g), false); assert.equal(g.player.guardCharge, true);
  const guard = g.guards[0]; Object.assign(g.actors[1], { x: guard.x, z: guard.z + 10 });
  const before = { x: guard.x, z: guard.z }; step(g, 0.01);
  assert.ok(g.projectiles.some(b => b.source === guard.id)); assert.equal(guard.x, before.x); assert.equal(guard.z, before.z);
});
test('difficulty changes coral shot frequency and accuracy, not speed or health', () => {
  const easy = createGame({ difficulty: 'easy', random: () => 1 }), hard = createGame({ difficulty: 'hard', random: () => 1 });
  const e = easy.actors[3], h = hard.actors[3]; fire(easy, e); fire(hard, h);
  assert.ok(e.shotCooldown > h.shotCooldown);
  assert.ok(Math.abs(easy.projectiles[0].vx) > Math.abs(hard.projectiles[0].vx));
  assert.equal(e.hp, h.hp); step(easy, 0.05); step(hard, 0.05); assert.equal(e.x, h.x); assert.equal(e.z, h.z);
});
test('180-second round counts capturable forts and freezes at winner or draw', () => {
  const g = quiet(fresh()); assert.equal(g.timeLeft, 180); g.timeLeft = 0.02; step(g, 0.05); assert.equal(g.winner, 'draw');
  const x = g.player.x; step(g, 0.2, { strafe: 1 }); assert.equal(g.player.x, x);
  const h = quiet(fresh()); h.forts.find(f => !f.home).owner = 'blue'; h.timeLeft = 0.01; step(h, 0.05); assert.equal(h.winner, 'blue');
});
test('AI competes for keys and an enemy captures a fort without player assistance', () => {
  const g = fresh(); ticks(g, 35);
  assert.ok(g.events.some(e => e.type === 'capture' && e.team === 'coral') || g.forts.some(f => !f.home && f.owner === 'coral'));
  assert.equal(g.actors.length, 6); assert.ok(g.events.length <= 30);
});
test('movement has normalized diagonals, respects crates and bounds huge elapsed time', () => {
  const straight = quiet(fresh()), diagonal = quiet(fresh());
  const a = { ...straight.player }, b = { ...diagonal.player };
  step(straight, 0.1, { forward: 1 }); step(diagonal, 0.1, { forward: 1, strafe: 1 });
  assert.ok(Math.abs(Math.hypot(straight.player.x - a.x, straight.player.z - a.z) - Math.hypot(diagonal.player.x - b.x, diagonal.player.z - b.z)) < 1e-8);
  Object.assign(straight.player, { x: -10, z: -12, yaw: 0 }); ticks(straight, 2, { forward: 1 }); assert.ok(straight.player.z <= -11.2);
  step(diagonal, 1000); assert.ok(diagonal.timeLeft > 179);
});
test('fast paint cannot tunnel through a crate into an actor behind it', () => {
  const g = quiet(fresh()); Object.assign(g.player, { x: -10, z: -4, invulnerable: 0 });
  g.projectiles.push({ x: -10, z: -13, vx: 0, vz: 1000, team: 'coral', life: 1 }); step(g, 0.025);
  assert.equal(g.player.hp, 5); assert.equal(g.projectiles.length, 0);
});
test('fresh games do not inherit the previous match state', () => {
  const a = fresh(), b = fresh(); a.forts[0].owner = 'coral'; a.events.push({ type: 'old' }); a.player.hp = 1;
  assert.equal(b.forts[0].owner, 'blue'); assert.equal(b.player.hp, 5); assert.deepEqual(b.events, []);
});
test('keys stay distinct through pickups and repeated captures', () => {
  const g = quiet(fresh()), p = g.player, f = g.forts.find(f => !f.home);
  for (let i = 0; i < 20; i++) {
    assert.equal(new Set(g.keys.map(k => k.spot)).size, g.keys.length);
    const taken = g.keys[0]; Object.assign(p, { x: taken.x, z: taken.z }); step(g, 0.01);
    assert.equal(p.hasKey, true); p.team = f.owner === 'blue' ? 'coral' : 'blue';
    Object.assign(p, { x: f.gateX, z: f.gateZ }); step(g, 0.01);
    assert.equal(g.keys.length, 3); assert.ok(g.keys.every(k => k.spot !== taken.spot));
  }
});
test('each fort has four solid tower footprints while its gate stays open', () => {
  assert.equal(MAP.obstacles.filter(o => o.kind === 'tower').length, 20);
  const g = quiet(fresh()); Object.assign(g.player, { x: -24, z: -7, yaw: 0 });
  ticks(g, 0.7, { forward: 1 }); assert.ok(g.player.z < -5.2);
  Object.assign(g.player, { x: -20, z: -7, yaw: 0 }); ticks(g, 0.7, { forward: 1 }); assert.ok(g.player.z > -3.5);
});
test('guard shoots the visible opponent rather than wasting shots at a nearer opponent behind a crate', () => {
  const g = quiet(fresh()); Object.assign(g.player, { x: -10, z: -14, guardCharge: true }); placeGuard(g);
  g.player.x = -30; g.player.z = -30;
  const guard = g.guards[0];
  const hidden = { id: 'hidden', team: 'coral', x: -10, z: -4, hp: 3, guard: true, invulnerable: 0, shotCooldown: 100 };
  const exposed = { id: 'exposed', team: 'coral', x: 5, z: -14, hp: 3, guard: true, invulnerable: 0, shotCooldown: 100 };
  g.guards.push(hidden, exposed); ticks(g, 0.7);
  assert.equal(exposed.hp, 2); assert.equal(hidden.hp, 3); assert.ok(guard.yaw > 1.5 && guard.yaw < 1.6);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRace, stepRace, CHARACTERS, POWERS} from '../../public/games/hogwarts/simulation.js';

const tick = (s, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) stepRace(s, .05, input);
};
function running(power = 'flight', playerId = 'harry', aiEnabled = false) {
  const s = createRace({power, playerId, aiEnabled, trackLength: 1200});
  tick(s, 3.05);
  return s;
}
const player = s => s.racers.find(r => r.id === s.playerId);
function obstacle(s, lane = 0, z = 2) {
  return {id: `test-${lane}`, z, lane, type: s.power, resolved: false,
    racerIds: [], stunnedUntil: 0, gateApproaches: {}};
}

test('each of three characters can use each of five powers on the full length course', () => {
  for (const c of CHARACTERS) for (const power of POWERS) {
    const s = running(power.id, c.id);
    const p = player(s);
    assert.equal(s.trackLength, 1200);
    assert.ok(s.obstacles.length >= 24);
    assert.ok(s.obstacles.every(o => o.type === power.id));
    p.x = 0;
    s.obstacles = [obstacle(s)];
    stepRace(s, .05, {cast: true});
    tick(s, .25);
    assert.ok(s.obstacles[0].racerIds.includes(c.id), `${c.id}/${power.id}`);
    assert.equal(p.slowedUntil, 0, `${c.id}/${power.id}`);
    assert.equal(s.power, power.id);
  }
});

test('computer competitors complete production length races with every shared power', () => {
  for (const power of POWERS) for (const c of CHARACTERS) {
    const s = running(power.id, c.id, true);
    // The player waits without casting; competitors must finish their own real race.
    tick(s, 220);
    assert.equal(s.phase, 'finished', `${c.id}/${power.id}`);
    assert.equal(s.lossReason, 'rival', `${c.id}/${power.id}`);
    const winner = s.racers.find(r => r.id === s.winnerId);
    assert.notEqual(winner.id, c.id);
    assert.equal(winner.bossHp, 0);
    assert.equal(winner.distance, 1208);
    assert.ok(winner.battleStartedAt > 100);
    assert.ok(winner.finishAt - winner.battleStartedAt >= 7);
  }
});

test('stun affects a blocker ahead in the caster lane, not adjacent lanes', () => {
  const s = running('stun');
  player(s).x = 0;
  s.obstacles = [-1, 0, 1].map(lane => obstacle(s, lane, 12));
  stepRace(s, .05, {cast: true});
  assert.equal(s.obstacles[0].stunnedUntil, 0);
  assert.ok(s.obstacles[1].stunnedUntil > s.time);
  assert.equal(s.obstacles[2].stunnedUntil, 0);
});

test('an obstacle slows for two seconds, then normal running resumes', () => {
  const s = running('sand');
  const p = player(s);
  p.x = 0;
  s.obstacles = [obstacle(s)];
  while (!s.obstacles[0].resolved) stepRace(s, .05);
  const hitAt = s.time;
  assert.equal(p.slowedUntil, hitAt + 2);
  let before = p.distance;
  tick(s, 1);
  assert.ok(Math.abs(p.distance - before - 3.5) < .001);
  tick(s, 1.1);
  before = p.distance;
  tick(s, 1);
  assert.ok(Math.abs(p.distance - before - 10) < .001);
  assert.equal(p.battleHp, 3);
});

test('early speed use clears a closing gate; late speed use cannot reopen it', () => {
  for (const early of [true, false]) {
    const s = running('speed');
    player(s).x = 0;
    s.obstacles = [obstacle(s, 0, 20)];
    if (!early) tick(s, 1.45);
    stepRace(s, .05, {cast: true});
    tick(s, early ? 1.3 : .5);
    assert.equal(s.obstacles[0].resolved, true);
    assert.equal(player(s).slowedUntil > s.time, !early);
  }
});

test('a new race discards combat damage, projectiles, obstacle progress and cooldowns', () => {
  const old = running('ice', 'ron');
  player(old).battleHp = 1;
  player(old).bossHp = 0;
  stepRace(old, .05, {cast: true});
  old.projectiles.push({racerId: 'ron', firedAt: old.time});
  old.obstacles[0].racerIds.push('ron');
  const fresh = createRace({playerId: 'hermione', power: 'sand'});
  assert.equal(fresh.phase, 'countdown');
  assert.equal(fresh.time, 0);
  assert.deepEqual(fresh.projectiles, []);
  assert.ok(fresh.obstacles.every(o => !o.resolved && o.racerIds.length === 0));
  assert.ok(fresh.racers.every(r => r.battleHp === 3 && r.bossHp === 3 &&
    r.cooldownUntil === 0 && r.distance === 0 && r.mode === 'running'));
});

test('zero, negative and invalid elapsed times do not advance the race', () => {
  const s = running();
  const before = JSON.stringify(s);
  for (const dt of [0, -1, NaN, Infinity]) stepRace(s, dt);
  assert.equal(JSON.stringify(s), before);
});

test('a third incoming curse takes precedence over the third boss hit in the same frame', () => {
  const s = running();
  s.obstacles = [];
  const p = player(s);
  Object.assign(p, {mode: 'battle', x: 0, battleHp: 1, bossHp: 1,
    bossAttack: {lane: 0, firedAt: s.time - 1, impactAt: s.time + .05}});
  stepRace(s, .05, {cast: true});
  assert.equal(s.lossReason, 'boss');
  assert.equal(p.battleHp, 0);
  assert.equal(p.bossHp, 0);
  assert.equal(s.winnerId, null);
});

test('battle aiming and wand cooldown work for every character with every course power', () => {
  for (const c of CHARACTERS) for (const power of POWERS) {
    const s = running(power.id, c.id);
    const p = player(s);
    s.obstacles = [];
    Object.assign(p, {mode: 'battle', x: 3});
    stepRace(s, .05, {cast: true});
    assert.equal(p.bossHp, 3);
    p.x = 0;
    stepRace(s, .05, {cast: true});
    assert.equal(p.bossHp, 3);
    tick(s, 1.15);
    stepRace(s, .05, {cast: true});
    assert.equal(p.bossHp, 2, `${c.id}/${power.id}`);
  }
});

test('jumping avoids an airborne curse regardless of the course power', () => {
  for (const power of POWERS) {
    const s = running(power.id);
    const p = player(s);
    s.obstacles = [];
    Object.assign(p, {mode: 'battle', x: 0,
      bossAttack: {lane: 0, firedAt: s.time, impactAt: s.time + .35}});
    stepRace(s, .05, {jump: true});
    tick(s, .35);
    assert.ok(p.jump > 1);
    assert.equal(p.battleHp, 3, power.id);
    tick(s, 1);
    assert.equal(p.jump, 0);
  }
});

test('the racer closest to the finish wins even when two cross in the same frame', () => {
  const s = running();
  s.obstacles = [];
  // Ron crosses after .01s; Harry crosses after .04s of a .05s frame.
  Object.assign(s.racers[0], {mode: 'finishing', distance: 1207.6, bossHp: 0});
  Object.assign(s.racers[2], {mode: 'finishing', distance: 1207.9, bossHp: 0});
  const frameStartedAt = s.time;
  stepRace(s, .05);
  assert.equal(s.winnerId, 'ron');
  assert.ok(Math.abs(s.racers[2].finishAt - frameStartedAt - .01) < 1e-9);
  assert.ok(Math.abs(s.racers[0].finishAt - frameStartedAt - .04) < 1e-9);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, fire, score, MAP, TEAMS } from '../../public/games/fortress-cannons/model.js';

const fresh = options => createGame({ bots: false, random: () => 0.5, ...options });
const actorFor = (game, team) => game.actors.find(actor => actor.team === team);

function ticks(game, seconds, input = {}) {
  const count = Math.ceil(seconds / 0.05);
  for (let i = 0; i < count; i++) step(game, seconds / count, input);
}

function shoot(game, shooter, target, count = 1) {
  shooter.yaw = Math.atan2(target.x - shooter.x, target.z - shooter.z);
  for (let i = 0; i < count; i++) {
    assert.ok(fire(game, shooter));
    ticks(game, 1.3);
  }
}

test('a match starts with three teams of three, one tower each, and two green cannons', () => {
  const game = fresh();
  assert.deepEqual(Object.keys(TEAMS), ['green', 'red', 'yellow']);
  assert.deepEqual(score(game), { green: 1, red: 1, yellow: 1 });
  for (const team of Object.keys(TEAMS)) {
    assert.equal(game.actors.filter(actor => actor.team === team).length, 3);
  }
  assert.equal(game.player.team, 'green');
  assert.deepEqual(game.cannons.map(cannon => cannon.owner), ['green', 'green']);
  assert.equal(game.timeLeft, 180);
});

test('the larger arena has room to leave every spawn and approach every objective', () => {
  const game = fresh();
  assert.equal(MAP.halfSize * 2, 120);
  assert.equal(MAP.obstacles.length, 8);
  for (const { x, z, w, d } of MAP.obstacles) {
    assert.ok(Math.abs(x) + w / 2 < MAP.halfSize);
    assert.ok(Math.abs(z) + d / 2 < MAP.halfSize);
  }
  for (const [objectives, radius] of [[game.forts, MAP.radii.tower], [game.cannons, MAP.radii.cannon]]) {
    for (const objective of objectives) {
      assert.ok(Math.abs(objective.x) + radius < MAP.halfSize);
      assert.ok(Math.abs(objective.z) + radius < MAP.halfSize);
      const approach = fresh();
      Object.assign(approach.player, { x: 0, z: 0 });
      if (objective.id === 'fort-green') ticks(approach, 8 / 9, { moveX: 1 });
      const dx = objective.x - approach.player.x;
      const dz = objective.z - approach.player.z;
      const distance = Math.hypot(dx, dz);
      ticks(approach, (distance - 5) / 9, { moveX: dx / distance, moveZ: dz / distance });
      assert.ok(Math.hypot(approach.player.x - objective.x, approach.player.z - objective.z) < 5.1);
    }
  }
  for (const actor of game.actors) {
    const spawnExit = fresh();
    Object.assign(spawnExit.player, { x: actor.x, z: actor.z });
    ticks(spawnExit, 0.5, { moveX: Math.sin(actor.yaw), moveZ: Math.cos(actor.yaw) });
    assert.ok(Math.hypot(spawnExit.player.x - actor.x, spawnExit.player.z - actor.z) > 4);
  }
});

test('direct paint captures towers, including the original green tower, and scores their current ownership', () => {
  const game = fresh();
  const tower = game.forts.find(fort => fort.owner === 'green');
  const red = actorFor(game, 'red');
  for (const actor of game.actors.filter(actor => actor.team === 'green')) actor.x += 5;
  Object.assign(red, { x: tower.x, z: tower.z + 8 });
  shoot(game, red, tower, 3);
  assert.equal(tower.owner, 'green');
  assert.equal(tower.captureTeam, 'red');
  assert.ok(tower.captureProgress > 0 && tower.captureProgress < 1);
  shoot(game, red, tower);
  assert.equal(tower.owner, 'red');
  assert.deepEqual(score(game), { green: 0, red: 2, yellow: 1 });
  assert.equal(tower.captureTeam, null);
  assert.equal(tower.captureProgress, 0);
  assert.ok(game.events.some(event => event.type === 'capture' && event.fortId === tower.id && event.team === 'red'));
});

test('the owner can defend against paint, and a second rival must earn its own capture', () => {
  const game = fresh();
  const tower = game.forts.find(fort => fort.owner === 'green');
  const red = actorFor(game, 'red');
  const yellow = actorFor(game, 'yellow');
  game.actors = [game.player, red, yellow];
  for (const cannon of game.cannons) cannon.ammo = 0;
  Object.assign(game.player, { x: tower.x + 8, z: tower.z });
  Object.assign(red, { x: tower.x, z: tower.z - 8 });
  Object.assign(yellow, { x: tower.x - 8, z: tower.z });

  shoot(game, red, tower, 3);
  assert.equal(tower.owner, 'green');
  assert.equal(tower.captureTeam, 'red');
  assert.equal(tower.captureProgress, 0.75);

  shoot(game, game.player, tower, 3);
  assert.equal(tower.owner, 'green');
  assert.equal(tower.captureTeam, null);
  assert.equal(tower.captureProgress, 0);

  shoot(game, red, tower, 2);
  assert.equal(tower.captureTeam, 'red');
  assert.equal(tower.captureProgress, 0.5);
  shoot(game, yellow, tower, 3);
  assert.equal(tower.owner, 'green');
  assert.equal(tower.captureTeam, 'yellow');
  assert.equal(tower.captureProgress, 0.75);
  assert.deepEqual(score(game), { green: 1, red: 1, yellow: 1 });

  shoot(game, yellow, tower);
  assert.equal(tower.owner, 'yellow');
  assert.equal(tower.captureTeam, null);
  assert.equal(tower.captureProgress, 0);
  assert.deepEqual(score(game), { green: 0, red: 1, yellow: 2 });
  const captures = game.events.filter(event => event.type === 'capture' && event.fortId === tower.id);
  assert.deepEqual(captures.map(event => event.team), ['yellow']);
});

test('paint rises and falls, then a nearby ground splash can capture a tower', () => {
  const game = fresh();
  const tower = game.forts.find(fort => fort.owner === 'red');
  game.actors = [game.player];
  const splashX = tower.x + 2.7;
  Object.assign(game.player, { x: splashX, z: tower.z - 17.1, yaw: 0 });
  assert.ok(fire(game));
  const initialHeight = game.projectiles[0].y;
  ticks(game, 0.2);
  assert.ok(game.projectiles[0].y > initialHeight);
  ticks(game, 0.29);
  assert.ok(game.projectiles[0].y < initialHeight && game.projectiles[0].vy < 0);
  ticks(game, 0.25);
  assert.equal(game.projectiles.length, 0);
  assert.ok(game.splats.some(splat => splat.radius > 2 && Math.hypot(splat.x - tower.x, splat.z - tower.z) < 2.8));
  assert.equal(tower.captureTeam, 'green');
  shoot(game, game.player, { x: game.player.x, z: tower.z }, 3);
  assert.equal(tower.owner, 'green');
  ticks(game, 5);
  assert.equal(game.splats.length, 0);
});

test('the fifth hit immediately returns a player to the nearest owned tower', () => {
  const game = fresh();
  const red = actorFor(game, 'red');
  const near = game.forts.find(fort => fort.owner === 'red');
  near.owner = 'green';
  for (const cannon of game.cannons) cannon.ammo = 0;
  Object.assign(game.player, { x: near.x, z: near.z - 9, invulnerable: 0 });
  Object.assign(red, { x: near.x, z: near.z - 13 });
  shoot(game, red, game.player, 4);
  assert.equal(game.player.hp, 1);
  assert.equal(game.player.z, near.z - 9);

  red.yaw = 0;
  assert.ok(fire(game, red));
  ticks(game, 0.2);
  assert.equal(game.player.hp, 5);
  const spawnedDistance = Math.hypot(game.player.x - near.x, game.player.z - near.z);
  assert.ok(spawnedDistance > MAP.radii.tower + MAP.radii.actor && spawnedDistance < 7);
  assert.ok(game.player.invulnerable > 1.9 && game.player.invulnerable <= 2);
  assert.equal(game.ended, false);

  const x = game.player.x + (game.player.x - near.x);
  const z = game.player.z + (game.player.z - near.z);
  Object.assign(red, { x, z, yaw: Math.atan2(game.player.x - x, game.player.z - z), shotCooldown: 0 });
  assert.ok(fire(game, red));
  ticks(game, 0.2);
  assert.equal(game.player.hp, 5);
  ticks(game, 1.8);
  shoot(game, red, game.player);
  assert.equal(game.player.hp, 4);
});

test('a team with no towers respawns at the center', () => {
  const game = fresh();
  game.forts[0].owner = 'red';
  const red = actorFor(game, 'red');
  Object.assign(game.player, { hp: 1, invulnerable: 0, x: 24, z: 5 });
  Object.assign(red, { x: 24, z: 1 });
  shoot(game, red, game.player);
  assert.deepEqual([game.player.x, game.player.z, game.player.hp], [0, 0, 5]);
  ticks(game, 0.5, { moveZ: -1 });
  assert.ok(game.player.z < -4);
});

test('friendly direct hits and splash do not damage teammates', () => {
  const game = fresh();
  const teammate = game.actors.find(actor => actor !== game.player && actor.team === game.player.team);
  Object.assign(game.player, { x: 8, z: -37 });
  Object.assign(teammate, { x: 8, z: -33, invulnerable: 0 });
  shoot(game, game.player, teammate);
  assert.equal(teammate.hp, 5);
  Object.assign(teammate, { x: 10.1, z: game.player.z + 17.1 });
  shoot(game, game.player, { x: game.player.x, z: teammate.z });
  assert.equal(teammate.hp, 5);
  assert.ok(game.splats.some(splat => splat.radius > 2 && Math.hypot(splat.x - teammate.x, splat.z - teammate.z) < 2.8));
  assert.ok(!game.events.some(event => event.type === 'hit' && event.actorId === teammate.id));
});

test('cannons spend finite paint, stop firing at zero, and resume after allied paint', () => {
  const game = fresh();
  const cannon = game.cannons[0];
  const red = actorFor(game, 'red');
  const green = game.actors.find(actor => actor !== game.player && actor.team === 'green');
  Object.assign(red, { x: cannon.x, z: cannon.z + 5, invulnerable: 0 });
  Object.assign(green, { x: cannon.x + 2, z: cannon.z + 3, invulnerable: 0 });
  ticks(game, 0.3);
  assert.equal(red.hp, 4);
  assert.equal(green.hp, 5);
  assert.equal(cannon.ammo, 90);
  for (let i = 0; i < 11; i++) {
    ticks(game, 1);
    if (red.x !== cannon.x) Object.assign(red, { x: cannon.x, z: cannon.z + 5, invulnerable: 0 });
  }
  assert.equal(cannon.ammo, 0);
  assert.ok(game.events.some(event => event.type === 'respawn' && event.actorId === red.id));
  const hp = red.hp;
  ticks(game, 3);
  assert.equal(cannon.ammo, 0);
  assert.equal(red.hp, hp);

  Object.assign(game.player, { x: cannon.x, z: cannon.z - 5 });
  shoot(game, game.player, cannon);
  assert.ok(cannon.ammo > 0 && cannon.ammo < 25);
  assert.ok(red.hp < hp);
});

test('an opposing team can capture a cannon and fill its tank', () => {
  const game = fresh();
  const cannon = game.cannons[0];
  const red = actorFor(game, 'red');
  Object.assign(red, { x: cannon.x, z: cannon.z + 6 });
  cannon.ammo = 0;
  shoot(game, red, cannon, 4);
  assert.equal(cannon.owner, 'red');
  assert.equal(cannon.ammo, 100);
  assert.ok(game.events.some(event => event.type === 'cannon' && event.cannonId === cannon.id && event.team === 'red'));
});

test('a teammate bot refills a depleted allied cannon without player assistance', () => {
  const game = fresh({ bots: true });
  const cannon = game.cannons[0];
  cannon.ammo = 0;
  ticks(game, 7);
  assert.equal(cannon.owner, 'green');
  assert.ok(cannon.ammo > 0);
  assert.ok(!game.events.some(event => event.type === 'cannon' && event.cannonId === cannon.id));
});

test('movement uses map axes, matches diagonal speed, stops at cover, and bounds large steps', () => {
  const straight = fresh();
  const diagonal = fresh();
  const start = { x: straight.player.x, z: straight.player.z };
  step(straight, 0.1, { moveZ: 1, aimYaw: Math.PI });
  step(diagonal, 0.1, { moveX: 1, moveZ: 1 });
  for (const game of [straight, diagonal]) {
    assert.ok(Math.abs(Math.hypot(game.player.x - start.x, game.player.z - start.z) - 0.9) < 1e-8);
  }
  assert.equal(straight.player.yaw, Math.PI);
  assert.equal(diagonal.player.yaw, Math.PI / 4);
  const cover = MAP.obstacles[0];
  Object.assign(straight.player, { x: cover.x, z: cover.z - 5 });
  ticks(straight, 2, { moveZ: 1 });
  const coverEdge = cover.z - cover.d / 2 - MAP.radii.actor;
  assert.ok(straight.player.z >= coverEdge - 0.225 && straight.player.z <= coverEdge);
  step(diagonal, 1000);
  assert.ok(diagonal.timeLeft > 179);
  Object.assign(diagonal.player, { x: MAP.halfSize - 2, z: MAP.halfSize - 2 });
  ticks(diagonal, 1, { moveX: 1, moveZ: 1 });
  assert.equal(diagonal.player.x, MAP.halfSize - MAP.radii.actor);
  assert.equal(diagonal.player.z, MAP.halfSize - MAP.radii.actor);
});

test('starting next to an owned tower allows leaving spawn but blocks walking through the tower', () => {
  const game = fresh();
  const tower = game.forts.find(fort => fort.owner === game.player.team);
  const spawn = { x: game.player.x, z: game.player.z };
  const distance = Math.hypot(spawn.x - tower.x, spawn.z - tower.z);
  const moveX = (tower.x - spawn.x) / distance;
  const moveZ = (tower.z - spawn.z) / distance;
  ticks(game, 0.8, { moveX, moveZ });
  assert.ok(Math.hypot(game.player.x - tower.x, game.player.z - tower.z) > MAP.radii.tower + MAP.radii.actor);
  assert.ok(Math.hypot(game.player.x - tower.x, game.player.z - tower.z) < distance);
  ticks(game, 1, { moveX: -moveX, moveZ: -moveZ });
  assert.ok(Math.hypot(game.player.x - tower.x, game.player.z - tower.z) > distance + 5);
});

test('cover stops paint before it hits a rival on the far side', () => {
  const game = fresh();
  const cover = MAP.obstacles[2];
  const red = actorFor(game, 'red');
  Object.assign(game.player, { x: cover.x, z: cover.z - 4 });
  Object.assign(red, { x: cover.x, z: cover.z + 4, invulnerable: 0 });
  shoot(game, game.player, red);
  assert.equal(red.hp, 5);
  assert.equal(game.projectiles.length, 0);
  assert.ok(game.splats.some(splat => Math.abs(splat.z - (cover.z - cover.d / 2)) < 1e-8));
});

test('higher difficulty makes rival shots more frequent and accurate', () => {
  const easy = fresh({ random: () => 1 });
  const hard = fresh({ difficulty: 'hard', random: () => 1 });
  for (const game of [easy, hard]) {
    const red = actorFor(game, 'red');
    Object.assign(red, { x: 5, z: -22, yaw: 0 });
    Object.assign(game.player, { x: 5, z: -14, invulnerable: 0 });
    fire(game, red);
    ticks(game, 0.65);
  }
  assert.equal(easy.player.hp, 5);
  assert.equal(hard.player.hp, 4);
  assert.equal(fire(easy, actorFor(easy, 'red')), false);
  assert.equal(fire(hard, actorFor(hard, 'red')), true);
});

test('capturing every tower leaves the clock running and the winner is decided only at zero', () => {
  const game = fresh();
  const tie = fresh();
  for (const fort of game.forts) fort.owner = 'yellow';
  step(game, 0.05);
  assert.equal(game.ended, false);
  assert.equal(game.winner, null);
  game.timeLeft = tie.timeLeft = 0.02;
  step(game, 0.05);
  step(tie, 0.05);
  assert.equal(game.timeLeft, 0);
  assert.equal(game.winner, 'yellow');
  assert.equal(tie.winner, 'draw');
  assert.equal(game.events.filter(event => event.type === 'end').length, 1);
  const position = [game.player.x, game.player.z];
  step(game, 0.25, { moveX: 1, fire: true });
  assert.deepEqual([game.player.x, game.player.z], position);
  assert.equal(fire(game), false);
  assert.equal(game.events.filter(event => event.type === 'end').length, 1);
});

test('a fresh match resets ownership, paint, health, and events', () => {
  const previous = fresh();
  previous.forts[0].owner = 'red';
  previous.cannons[0].ammo = 0;
  previous.player.hp = 1;
  fire(previous);
  const current = fresh();
  assert.deepEqual(score(current), { green: 1, red: 1, yellow: 1 });
  assert.equal(current.cannons[0].ammo, 100);
  assert.equal(current.player.hp, 5);
  assert.equal(current.projectiles.length, 0);
  assert.equal(current.events.length, 0);
});

test('bots capture both types of objective and fight throughout a full round', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const game = createGame({ difficulty, random: () => 0.5 });
    const towerCaptures = new Set();
    const cannonCaptures = new Set();
    let lastId = 0;
    let lastRespawn = 0;
    for (let i = 0; i < 1800; i++) {
      step(game, 0.1);
      for (const event of game.events) {
        if (event.id <= lastId) continue;
        if (event.type === 'capture') towerCaptures.add(event.team);
        if (event.type === 'cannon') cannonCaptures.add(event.team);
        if (event.type === 'respawn') lastRespawn = i;
        lastId = event.id;
      }
      assert.ok(game.events.length <= 30);
      assert.ok(game.splats.length <= 100);
      assert.ok(game.cannons.every(cannon => cannon.ammo >= 0 && cannon.ammo <= 100));
    }
    assert.equal(game.timeLeft, 0);
    assert.equal(game.ended, true);
    assert.equal(game.actors.length, 9);
    assert.equal(towerCaptures.size, 3);
    assert.equal(cannonCaptures.size, 3);
    assert.ok(lastRespawn > 1200);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS, createGame, startGame, stepGame, catchDrop, pauseGame, resumeGame, dropPosition } from '../../public/games/droplets/model.js';

const started = () => startGame(createGame({ seed: 42 }));

test('starts with five visible, varied droplets and reaches ten at fifty seconds', () => {
  const game = started();
  assert.equal(game.drops.length, 5);
  assert.equal(new Set(game.drops.map(d => d.colorIndex)).size, 5);
  assert.ok(game.drops.every(d => dropPosition(d, 0).y < 1));
  for (let second = 10; second <= 50; second += 10) {
    stepGame(game, 10);
    assert.equal(game.drops.length, 5 + second / 10);
  }
});

test('expiry is exactly two seconds and immediately replaces missed droplets', () => {
  const game = started();
  catchDrop(game, game.drops[0].id);
  const fresh = game.drops.at(-1);
  stepGame(game, 1.999);
  assert.ok(game.drops.some(d => d.id === fresh.id));
  stepGame(game, .001);
  assert.ok(!game.drops.some(d => d.id === fresh.id));
  assert.equal(game.drops.length, 5);
  assert.ok(game.missed >= 1);
  assert.equal(game.score, 1);
});

test('catching scores once, stale and background clicks never subtract points', () => {
  const game = started();
  const id = game.drops[0].id;
  assert.equal(catchDrop(game, id).caught, true);
  assert.equal(catchDrop(game, id).caught, false);
  assert.equal(catchDrop(game, -1).caught, false);
  assert.equal(game.score, 1);
  assert.equal(game.drops.length, 5);
});

test('pause freezes active time and rejects catches; resume continues', () => {
  const game = started();
  pauseGame(game);
  const snapshot = structuredClone(game);
  stepGame(game, 20);
  assert.equal(catchDrop(game, game.drops[0].id).caught, false);
  assert.deepEqual(game, snapshot);
  resumeGame(game);
  stepGame(game, .5);
  assert.equal(game.elapsed, .5);
});

test('round ends exactly at sixty seconds, rejects late catches, and resets fresh', () => {
  const game = started();
  catchDrop(game, game.drops[0].id);
  stepGame(game, 59.999);
  const id = game.drops[0].id;
  assert.equal(game.phase, 'playing');
  stepGame(game, .001);
  assert.equal(game.phase, 'finished');
  assert.equal(game.elapsed, 60);
  assert.deepEqual(game.drops, []);
  assert.equal(catchDrop(game, id).caught, false);
  stepGame(game, 100);
  assert.equal(game.elapsed, 60);
  startGame(game);
  assert.deepEqual(game, started());
});

test('seed and event simulation are deterministic across time step sizes', () => {
  const whole = started(), pieces = started();
  stepGame(whole, 35);
  for (let i = 0; i < 140; i++) stepGame(pieces, .25);
  assert.deepEqual(whole, pieces);
});

test('all six colors appear and arcs stay inside reasonable horizontal bounds', () => {
  const game = started(), colors = new Set();
  for (let frame = 0; frame < 500; frame++) {
    for (const drop of game.drops) {
      colors.add(drop.colorIndex);
      assert.ok(drop.x >= .1 && drop.x <= .9);
      for (const age of [0, .5, 1, 1.5, 2]) {
        const position = dropPosition(drop, drop.bornAt + age);
        assert.ok(position.x >= .04 && position.x <= .96);
        assert.ok(position.y >= .27 && position.y <= 1.1);
      }
      assert.equal(dropPosition(drop, drop.bornAt).y, 1.1);
      assert.ok(Math.abs(dropPosition(drop, drop.bornAt + 2).y - 1.1) < 1e-12);
    }
    stepGame(game, .1);
  }
  assert.equal(COLORS.length, 6);
  assert.equal(colors.size, 6);
});

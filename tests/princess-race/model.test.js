import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, startRace, stepRace, TRACK_LENGTH } from '../../public/games/princess-race/model.js';

function run(state, seconds, input = {}, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) stepRace(state, input, 1 / fps);
  return state;
}

test('ready racers wait, then everyone runs forward automatically', () => {
  const race = createRace();
  run(race, 1);
  assert.ok(race.racers.every(racer => racer.distance === 0));
  startRace(race);
  run(race, 1);
  assert.ok(race.racers.every(racer => racer.distance > 9));
});

test('arrows steer physically left/right within track and up jumps then lands', () => {
  const race = startRace(createRace());
  const belle = race.racers[0];
  run(race, 1, { right: true });
  assert.equal(belle.x, 1);
  run(race, 1, { left: true });
  assert.equal(belle.x, -1);
  run(race, 0.2, { jump: true });
  assert.ok(belle.jumpHeight > 0.6);
  run(race, 1, { jump: true });
  assert.equal(belle.jumpHeight, 0);
  run(race, 0.05);
  run(race, 0.2, { jump: true });
  assert.ok(belle.jumpHeight > 0.6);
});

test('holding sprint makes Belle faster and releasing returns to running', () => {
  const walk = startRace(createRace());
  const sprint = startRace(createRace());
  run(walk, 2);
  run(sprint, 2, { sprint: true });
  assert.ok(sprint.racers[0].distance > walk.racers[0].distance + 5);
  run(sprint, 1);
  assert.equal(sprint.racers[0].speed, walk.racers[0].speed);
});

test('a bump slows once, recovers, and a well-timed jump clears the obstacle', () => {
  const bumped = startRace(createRace());
  const jumped = startRace(createRace());
  for (const race of [bumped, jumped]) {
    race.racers[0].x = 0;
    race.racers[0].distance = 45;
  }
  run(bumped, 0.5);
  run(jumped, 0.5, { jump: true });
  assert.equal(bumped.racers[0].bumpCount, 1);
  assert.equal(jumped.racers[0].bumpCount, 0);
  assert.ok(bumped.racers[0].speed < jumped.racers[0].speed);
  run(bumped, 2);
  assert.equal(bumped.racers[0].bumpCount, 1);
  assert.equal(bumped.racers[0].slowRemaining, 0);
  assert.equal(bumped.racers[0].speed, 9.5);
});

test('each racer can win and the first crossing wins even within one frame', () => {
  for (let winner = 0; winner < 3; winner++) {
    const race = startRace(createRace());
    race.racers[winner].distance = TRACK_LENGTH - 0.01;
    run(race, 0.1);
    assert.equal(race.winner.id, race.racers[winner].id);
    assert.equal(race.phase, 'finished');
    const elapsed = race.elapsed;
    run(race, 2, { sprint: true });
    assert.equal(race.elapsed, elapsed);
    assert.equal(race.winner.id, race.racers[winner].id);
  }
  const race = startRace(createRace());
  race.racers[0].distance = TRACK_LENGTH - 0.05;
  race.racers[1].distance = TRACK_LENGTH - 0.001;
  stepRace(race, { sprint: true }, 1 / 60);
  assert.equal(race.winner.id, 'felice');
});

test('beginner race lasts 35–60 seconds: sprint can win, unattended Belle can lose', () => {
  const sprint = startRace(createRace());
  const unattended = startRace(createRace());
  run(sprint, 60, { sprint: true });
  run(unattended, 60);
  assert.equal(sprint.winner.id, 'belle');
  assert.notEqual(unattended.winner.id, 'belle');
  for (const race of [sprint, unattended]) assert.ok(race.elapsed >= 35 && race.elapsed <= 60);
});

test('fresh restart is independent of the old race', () => {
  const oldRace = startRace(createRace());
  run(oldRace, 60, { sprint: true });
  const fresh = createRace();
  assert.equal(fresh.phase, 'ready');
  assert.equal(fresh.winner, null);
  assert.equal(fresh.elapsed, 0);
  assert.ok(fresh.racers.every(racer => racer.distance === 0 && racer.bumpCount === 0));
  fresh.obstacles[0].x = 1;
  assert.equal(oldRace.obstacles[0].x, 0);
});

test('outcome and movement stay stable at 30, 60 and 144 frames per second', () => {
  const races = [30, 60, 144].map(fps => run(startRace(createRace()), 60, { sprint: true }, fps));
  for (const race of races.slice(1)) {
    assert.equal(race.winner.id, races[0].winner.id);
    assert.ok(Math.abs(race.elapsed - races[0].elapsed) < 0.00001);
    race.racers.forEach((racer, index) => {
      assert.ok(Math.abs(racer.distance - races[0].racers[index].distance) < 0.00001);
    });
  }
  const race = startRace(createRace());
  stepRace(race, {}, 100);
  assert.ok(race.racers[0].distance < 3);
  stepRace(race, {}, NaN);
  assert.ok(Number.isFinite(race.elapsed));
});

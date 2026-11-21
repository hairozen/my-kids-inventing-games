export const TRACK_LENGTH = 1200;
export const RACERS = [
  { id: 'belle', name: 'בל', color: '#ffd75b' },
  { id: 'felice', name: 'פליס', color: '#ed8fce' },
  { id: 'torres', name: 'טורס', color: '#8acfff' },
];

const TICK = 1 / 120;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createRace() {
  return {
    phase: 'ready', elapsed: 0, winner: null, accumulator: 0, jumpHeld: false,
    racers: RACERS.map((racer, index) => ({
      ...racer, x: index - 1, distance: 0, jumpHeight: 0,
      jumpVelocity: 0, slowRemaining: 0, speed: 0, sprinting: false, bumpCount: 0,
      passedObstacles: new Set(),
    })),
    obstacles: Array.from({ length: 25 }, (_, index) => ({
      id: `obstacle-${index}`, distance: 48 + index * 45,
      x: [0, -1, 1, 0, 1, -1, 0, -1, 1, 0][index % 10],
    })),
  };
}

export function startRace(state) {
  if (state.phase === 'ready') state.phase = 'racing';
  return state;
}

function tick(state, input, dt) {
  const crossings = [];
  for (const [index, racer] of state.racers.entries()) {
    let steer = 0;
    let jump = false;
    const isBelle = racer.id === 'belle';
    if (isBelle) {
      steer = Number(Boolean(input.right)) - Number(Boolean(input.left));
      jump = Boolean(input.jump) && !state.jumpHeld;
    } else {
      const upcoming = state.obstacles.find(obstacle =>
        obstacle.distance > racer.distance && obstacle.distance - racer.distance < 16);
      // Rivals sometimes misjudge an obstacle, so their race has real bumps too.
      if (upcoming && (Number(upcoming.id.split('-').at(-1)) + index) % 4 !== 0) {
        if (Math.abs(racer.x - upcoming.x) < 0.55) {
          steer = upcoming.x >= 0 ? -1 : 1;
        }
        jump = upcoming.distance - racer.distance < 5 && racer.jumpHeight === 0;
      }
    }
    racer.x = clamp(racer.x + steer * 2.3 * dt, -1, 1);
    if (jump && racer.jumpHeight === 0) racer.jumpVelocity = 6.8;
    racer.jumpHeight = Math.max(0, racer.jumpHeight + racer.jumpVelocity * dt);
    racer.jumpVelocity -= 15 * dt;
    if (racer.jumpHeight === 0) racer.jumpVelocity = 0;
    racer.slowRemaining = Math.max(0, racer.slowRemaining - dt);
    racer.sprinting = isBelle && Boolean(input.sprint);
    const baseSpeed = isBelle ? (racer.sprinting ? 12.4 : 9.5)
      : racer.id === 'torres' ? 10.62 : 10.5;
    racer.speed = baseSpeed * (racer.slowRemaining > 0 ? 0.48 : 1);
    const previous = racer.distance;
    racer.distance += racer.speed * dt;
    for (const obstacle of state.obstacles) {
      if (!racer.passedObstacles.has(obstacle.id) &&
          previous <= obstacle.distance && racer.distance >= obstacle.distance) {
        racer.passedObstacles.add(obstacle.id);
        if (Math.abs(racer.x - obstacle.x) < 0.39 && racer.jumpHeight < 0.6) {
          racer.slowRemaining = 1.25;
          racer.bumpCount += 1;
        }
      }
    }
    if (previous < TRACK_LENGTH && racer.distance >= TRACK_LENGTH) {
      crossings.push({ racer, fraction: (TRACK_LENGTH - previous) / (racer.distance - previous) });
    }
    racer.distance = Math.min(TRACK_LENGTH, racer.distance);
  }
  state.jumpHeld = Boolean(input.jump);
  state.elapsed += dt;
  if (crossings.length) {
    crossings.sort((a, b) => a.fraction - b.fraction);
    state.winner = crossings[0].racer;
    state.phase = 'finished';
  }
}

export function stepRace(state, input = {}, dt = 0) {
  if (state.phase !== 'racing' || !Number.isFinite(dt) || dt <= 0) return state;
  // A paused browser must not teleport racers through the course on return.
  state.accumulator += Math.min(dt, 0.25);
  while (state.accumulator + 1e-10 >= TICK && state.phase === 'racing') {
    tick(state, input, TICK);
    state.accumulator -= TICK;
  }
  return state;
}

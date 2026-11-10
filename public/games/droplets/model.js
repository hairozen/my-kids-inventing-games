export const COLORS = [
  { id: 'blue', name: 'כחול', color: '#4299ed', light: '#b5e3ff', dark: '#2267bd' },
  { id: 'purple', name: 'סגול', color: '#a278e8', light: '#e1cfff', dark: '#6940ad' },
  { id: 'pink', name: 'ורוד', color: '#f279aa', light: '#ffd4e7', dark: '#bd427c' },
  { id: 'orange', name: 'כתום', color: '#ffa45c', light: '#ffe0b5', dark: '#ce742c' },
  { id: 'green', name: 'ירוק', color: '#79cc83', light: '#d3f4c8', dark: '#39944f' },
  { id: 'aqua', name: 'טורקיז', color: '#51c9c9', light: '#c2f6ef', dark: '#228e95' },
];

export function createGame({ seed = 20261106 } = {}) {
  return { phase: 'ready', elapsed: 0, duration: 60, score: 0, missed: 0,
    drops: [], nextId: 0, seed: seed >>> 0, rng: seed >>> 0 };
}

function random(state) {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function spawn(state, bornAt = state.elapsed, initial = false) {
  const id = state.nextId++;
  const previous = state.drops.at(-1);
  let x = initial ? .14 + (id % 5) * .18 + random(state) * .04 : .1 + random(state) * .8;
  if (!initial && previous && Math.abs(x - previous.x) < .15) x = .1 + ((x - .1 + .4) % .8);
  const drop = { id, bornAt, x, drift: (random(state) - .5) * .12,
    height: .45 + random(state) * .37, radius: 1,
    colorIndex: id % COLORS.length, face: Math.floor(random(state) * 4) };
  state.drops.push(drop);
  return drop;
}

export function startGame(state) {
  Object.assign(state, createGame({ seed: state.seed }), { phase: 'playing' });
  for (let i = 0; i < 5; i++) spawn(state, -(.2 + random(state) * 1), true);
  return state;
}

function fill(state) {
  const count = Math.min(10, 5 + Math.floor(state.elapsed / 10));
  while (state.drops.length < count) spawn(state);
}

export function stepGame(state, dt) {
  if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return state;
  const target = Math.min(state.duration, state.elapsed + dt);
  while (state.elapsed < target) {
    const expires = Math.min(...state.drops.map(drop => drop.bornAt + 2));
    const ramp = (Math.floor(state.elapsed / 10) + 1) * 10;
    state.elapsed = Math.min(target, expires, ramp);
    if (state.elapsed >= state.duration) {
      state.elapsed = state.duration;
      state.phase = 'finished';
      state.drops = [];
      return state;
    }
    const live = state.drops.filter(drop => drop.bornAt + 2 > state.elapsed);
    state.missed += state.drops.length - live.length;
    state.drops = live;
    fill(state);
  }
  return state;
}

export function catchDrop(state, id) {
  if (state.phase !== 'playing' || state.elapsed >= state.duration) return { caught: false };
  const index = state.drops.findIndex(drop => drop.id === id && drop.bornAt <= state.elapsed && drop.bornAt + 2 > state.elapsed);
  if (index < 0) return { caught: false };
  const [drop] = state.drops.splice(index, 1);
  state.score++;
  fill(state);
  return { caught: true, drop };
}

export function pauseGame(state) {
  if (state.phase === 'playing') state.phase = 'paused';
  return state;
}

export function resumeGame(state) {
  if (state.phase === 'paused') state.phase = 'playing';
  return state;
}

export function dropPosition(drop, elapsed) {
  const progress = Math.max(0, Math.min(1, (elapsed - drop.bornAt) / 2));
  return { x: drop.x + drop.drift * (progress * 2 - 1),
    y: 1.1 - drop.height * 4 * progress * (1 - progress), progress };
}

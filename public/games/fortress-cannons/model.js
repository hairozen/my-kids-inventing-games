export const MAP = {
  halfSize: 38,
  homes: { blue: { x: 0, z: -31 }, coral: { x: 0, z: 31 } },
  obstacles: [
    { x: -10, z: -8, w: 4, d: 5, kind: 'crate' }, { x: 10, z: 16, w: 4, d: 5, kind: 'crate' },
    ...[[0, -31], [0, 31], [-20, 0], [0, 8], [20, 0]].flatMap(([x, z]) => [-4, 4].flatMap(dx => [-4, 4].map(dz => ({ x: x + dx, z: z + dz, w: 1.2, d: 1.2, kind: 'tower' })))),
  ],
};
const DIFFICULTY = { easy: { interval: 1.8, spread: 0.32 }, medium: { interval: 1.1, spread: 0.16 }, hard: { interval: 0.65, spread: 0.035 } };
const KEY_SPOTS = [{ x: -25, z: -17 }, { x: 25, z: 17 }, { x: -25, z: 17 }, { x: 25, z: -17 }, { x: 0, z: -12 }];
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function event(game, type, data = {}) { game.events.push({ id: game.nextId++, type, ...data }); if (game.events.length > 30) game.events.shift(); }
function key(game, previous = -1) {
  const occupied = new Set([...game.keys.map(k => k.spot), ...game.actors.filter(a => a.hasKey).map(a => a.keySpot)]);
  const choices = KEY_SPOTS.map((_, i) => i).filter(i => i !== previous && !occupied.has(i));
  const index = choices[Math.min(choices.length - 1, Math.floor(game.random() * choices.length))];
  game.keys.push({ id: `key-${game.nextId++}`, ...KEY_SPOTS[index], spot: index });
}
export function createGame({ difficulty = 'easy', random = Math.random } = {}) {
  const game = { difficulty: DIFFICULTY[difficulty] ? difficulty : 'easy', random, actors: [], guards: [], forts: [], keys: [], circles: [{ id: 'circle-left', x: -8, z: -22, cooldown: 0 }, { id: 'circle-right', x: 8, z: 22, cooldown: 0 }], projectiles: [], timeLeft: 180, ended: false, winner: null, events: [], nextId: 1 };
  for (const team of ['blue', 'coral']) {
    game.forts.push({ id: `home-${team}`, name: team === 'blue' ? 'בית כחול' : 'בית אלמוג', ...MAP.homes[team], owner: team, home: true });
    for (let i = 0; i < 3; i++) game.actors.push({ id: team === 'blue' && i === 0 ? 'player' : `${team}-${i}`, team, x: [0, -3, 3][i], z: MAP.homes[team].z, yaw: team === 'blue' ? 0 : Math.PI, hp: 5, maxHp: 5, hasKey: false, guardCharge: false, invulnerable: 2, shotCooldown: 0, keySpot: -1 });
  }
  game.player = game.actors[0];
  for (const [i, x, z] of [[0, -20, 0], [1, 0, 8], [2, 20, 0]]) game.forts.push({ id: `fort-${i}`, name: ['מבצר השקיעה', 'מבצר המרכז', 'מבצר הזריחה'][i], x, z, gateX: x, gateZ: z - 3.5, owner: null, home: false });
  key(game); key(game, 1); key(game, 3);
  return game;
}
function blocked(x, z, radius = 0.7) {
  return Math.abs(x) > MAP.halfSize - radius || Math.abs(z) > MAP.halfSize - radius || MAP.obstacles.some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}
function move(actor, dx, dz) {
  if (!blocked(actor.x + dx, actor.z)) actor.x += dx;
  if (!blocked(actor.x, actor.z + dz)) actor.z += dz;
}
export function fire(game, actor = game.player) {
  if (game.ended || actor.shotCooldown > 0) return false;
  const config = actor.team === 'coral' ? DIFFICULTY[game.difficulty] : { interval: 0.45, spread: 0 };
  const yaw = actor.yaw + (game.random() * 2 - 1) * config.spread;
  game.projectiles.push({ id: `paint-${game.nextId++}`, x: actor.x, z: actor.z, vx: Math.sin(yaw) * 32, vz: Math.cos(yaw) * 32, team: actor.team, source: actor.id, life: 1.5 });
  actor.shotCooldown = actor.guard ? 0.85 : config.interval;
  return true;
}
export function placeGuard(game) {
  const p = game.player;
  if (game.ended || !p.guardCharge || game.guards.filter(g => g.team === p.team).length >= 6) return false;
  game.guards.push({ id: `guard-${game.nextId++}`, x: p.x, z: p.z, yaw: p.yaw, team: p.team, hp: 3, maxHp: 3, guard: true, shotCooldown: 0, invulnerable: 0 });
  p.guardCharge = false; event(game, 'guard'); return true;
}
export function score(game) { return game.forts.filter(f => !f.home).reduce((s, f) => { if (f.owner) s[f.owner]++; return s; }, { blue: 0, coral: 0 }); }
function hit(game, target) {
  if (target.invulnerable > 0) return;
  target.hp--; event(game, 'hit', { actorId: target.id, hp: target.hp });
  if (target.hp > 0) return;
  if (target.guard) { game.guards = game.guards.filter(g => g !== target); return; }
  if (target.hasKey) key(game, target.keySpot);
  Object.assign(target, MAP.homes[target.team], { hp: 5, hasKey: false, guardCharge: false, invulnerable: 2 });
  event(game, 'respawn', { actorId: target.id });
}
function segmentHit(a, b, target, radius) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((target.x - a.x) * dx + (target.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + t * dx - target.x, a.z + t * dz - target.z) <= radius ? t : Infinity;
}
function wallHit(a, b, o) {
  let near = 0, far = 1;
  for (const [axis, size] of [['x', 'w'], ['z', 'd']]) {
    const delta = b[axis] - a[axis], low = o[axis] - o[size] / 2, high = o[axis] + o[size] / 2;
    if (Math.abs(delta) < 1e-10) { if (a[axis] < low || a[axis] > high) return Infinity; }
    else { const first = (low - a[axis]) / delta, second = (high - a[axis]) / delta; near = Math.max(near, Math.min(first, second)); far = Math.min(far, Math.max(first, second)); }
    if (near > far) return Infinity;
  }
  return near;
}
function update(game, dt, input) {
  const p = game.player;
  p.yaw += Number.isFinite(input.yaw) ? input.yaw : 0;
  const forward = Math.max(-1, Math.min(1, input.forward || 0)), strafe = Math.max(-1, Math.min(1, input.strafe || 0));
  const length = Math.max(1, Math.hypot(forward, strafe));
  move(p, (Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * 9 * dt / length, (Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * 9 * dt / length);
  for (const a of [...game.actors, ...game.guards]) {
    a.shotCooldown = Math.max(0, a.shotCooldown - dt); a.invulnerable = Math.max(0, a.invulnerable - dt);
    if (a === p) continue;
    if (!a.guard) {
      const choices = a.hasKey ? game.forts.filter(f => !f.home && f.owner !== a.team).map(f => ({ x: f.gateX, z: f.gateZ })) : game.keys;
      const goal = [...choices].sort((b, c) => distance(a, b) - distance(a, c))[0];
      if (goal) {
        const angle = Math.atan2(goal.x - a.x, goal.z - a.z);
        const beforeX = a.x, beforeZ = a.z;
        move(a, Math.sin(angle) * 6 * dt, Math.cos(angle) * 6 * dt);
        // Skirt an obstructing crate along its closest horizontal edge.
        if (Math.hypot(a.x - beforeX, a.z - beforeZ) < 2 * dt) move(a, Math.cos(angle) * 6 * dt, -Math.sin(angle) * 6 * dt);
        a.yaw = angle;
      }
    }
    const enemy = [...game.actors, ...game.guards].filter(b => b.team !== a.team && distance(a, b) < (a.guard ? 18 : 24) && MAP.obstacles.every(o => wallHit(a, b, o) === Infinity)).sort((b, c) => distance(a, b) - distance(a, c))[0];
    if (enemy) { a.yaw = Math.atan2(enemy.x - a.x, enemy.z - a.z); fire(game, a); }
  }
  if (input.fire) fire(game, p);
  for (const c of game.circles) { c.cooldown = Math.max(0, c.cooldown - dt); if (!p.guardCharge && c.cooldown === 0 && distance(p, c) < 2) { p.guardCharge = true; c.cooldown = 10; event(game, 'charge'); } }
  if (input.placeGuard) placeGuard(game);
  for (const a of game.actors) {
    if (!a.hasKey) {
      const found = game.keys.find(k => distance(a, k) < 1.5);
      if (found) { a.hasKey = true; a.keySpot = found.spot; game.keys = game.keys.filter(k => k !== found); event(game, 'key', { actorId: a.id }); }
    }
    if (a.hasKey) {
      const fort = game.forts.find(f => !f.home && f.owner !== a.team && distance(a, { x: f.gateX, z: f.gateZ }) < 2);
      if (fort) { fort.owner = a.team; a.hasKey = false; key(game, a.keySpot); event(game, 'capture', { fortId: fort.id, team: a.team, actorId: a.id }); }
    }
  }
  game.projectiles = game.projectiles.filter(b => {
    const end = { x: b.x + b.vx * dt, z: b.z + b.vz * dt };
    let first = 1, target = null, wall = false;
    for (const obstacle of MAP.obstacles) { const t = wallHit(b, end, obstacle); if (t <= first) { first = t; wall = true; } }
    if (Math.abs(end.x) > MAP.halfSize || Math.abs(end.z) > MAP.halfSize) wall = true;
    for (const a of [...game.actors, ...game.guards]) if (a.team !== b.team) { const t = segmentHit(b, end, a, 0.85); if (t <= first) { first = t; target = a; wall = false; } }
    if (target) hit(game, target);
    b.x = end.x; b.z = end.z; b.life -= dt;
    return !target && !wall && b.life > 0;
  });
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  if (game.timeLeft === 0) { game.ended = true; const s = score(game); game.winner = s.blue === s.coral ? 'draw' : s.blue > s.coral ? 'blue' : 'coral'; event(game, 'end', { winner: game.winner }); }
}
// input.yaw is the turn since the previous frame, in radians; zero faces +z.
export function step(game, dt, input = {}) {
  if (game.ended || !Number.isFinite(dt) || dt <= 0) return game;
  const bounded = Math.min(dt, 0.25), count = Math.ceil(bounded / 0.025);
  for (let i = 0; i < count && !game.ended; i++) update(game, bounded / count, { ...input, yaw: (input.yaw || 0) / count, placeGuard: i === 0 && input.placeGuard });
  return game;
}

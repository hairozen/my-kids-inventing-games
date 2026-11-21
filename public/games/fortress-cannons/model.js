export const TEAMS = {
  green: { name: 'הירוקים', symbol: '●', color: '#299b76' },
  red: { name: 'האדומים', symbol: '■', color: '#e26452' },
  yellow: { name: 'הצהובים', symbol: '▲', color: '#efc348' },
};

export const MAP = {
  halfSize: 60,
  radii: { tower: 2.6, cannon: 1.4, actor: 0.65 },
  obstacles: [
    { x: -26, z: -16, w: 5, d: 4, kind: 'crate' },
    { x: 26, z: -16, w: 5, d: 4, kind: 'crate' },
    { x: 0, z: 18, w: 6, d: 3, kind: 'crate' },
    { x: -14, z: 28, w: 5, d: 3, kind: 'crate' },
    { x: 14, z: 28, w: 5, d: 3, kind: 'crate' },
    { x: 0, z: -22, w: 6, d: 3, kind: 'crate' },
    { x: -40, z: 4, w: 4, d: 3, kind: 'crate' },
    { x: 40, z: 4, w: 4, d: 3, kind: 'crate' },
  ],
};

const TOWERS = [
  { id: 'fort-green', name: 'מגדל האורן', x: 0, z: -44, owner: 'green' },
  { id: 'fort-red', name: 'מגדל השקיעה', x: -42, z: 32, owner: 'red' },
  { id: 'fort-yellow', name: 'מגדל הזריחה', x: 42, z: 32, owner: 'yellow' },
];
const CANNONS = [
  { id: 'cannon-0', name: 'תותח מערב', x: -19, z: -5, owner: 'green' },
  { id: 'cannon-1', name: 'תותח מזרח', x: 19, z: -5, owner: 'green' },
];
const DIFFICULTY = {
  easy: { interval: 1.2, spread: 0.18 },
  medium: { interval: 0.85, spread: 0.10 },
  hard: { interval: 0.58, spread: 0.035 },
};
const GRAVITY = 18;
const SPLASH_RADIUS = 2.8;
const { tower: TOWER_RADIUS, cannon: CANNON_RADIUS, actor: ACTOR_RADIUS } = MAP.radii;
const TOWER_SPAWN_DISTANCE = 6;
const CENTER = { x: 0, z: 0 };
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angle = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const ready = target => ({ ...target, captureTeam: null, captureProgress: 0 });

function towerSpawn(tower, offset = 0) {
  const sideOffset = tower.id === 'fort-green' ? 0.85 : 0;
  const yaw = angle(tower, CENTER) + sideOffset + offset;
  return {
    x: tower.x + Math.sin(yaw) * TOWER_SPAWN_DISTANCE,
    z: tower.z + Math.cos(yaw) * TOWER_SPAWN_DISTANCE,
  };
}

export function createGame({ difficulty = 'easy', random = Math.random, bots = true } = {}) {
  const forts = TOWERS.map(ready);
  const actors = forts.flatMap(fort => [0, -0.75, 0.75].map((offset, index) => ({
    id: fort.owner === 'green' && index === 0 ? 'player' : `${fort.owner}-${index}`,
    team: fort.owner,
    ...towerSpawn(fort, offset),
    yaw: angle(fort, CENTER),
    hp: 5,
    maxHp: 5,
    invulnerable: 2,
    shotCooldown: 0,
    cannonDuty: index === 1,
  })));
  const cannons = CANNONS.map(cannon => ready({ ...cannon, ammo: 100, yaw: 0, shotCooldown: 0 }));
  return {
    difficulty: Object.hasOwn(DIFFICULTY, difficulty) ? difficulty : 'easy',
    random, bots, actors, player: actors[0], forts, cannons,
    projectiles: [], splats: [], timeLeft: 180, ended: false, winner: null, events: [], nextId: 1,
  };
}

export function score(game) {
  const towers = { green: 0, red: 0, yellow: 0 };
  for (const fort of game.forts) towers[fort.owner]++;
  return towers;
}

function event(game, type, data) {
  game.events.push({ id: game.nextId++, type, ...data });
  if (game.events.length > 30) game.events.shift();
}

// Segment entry into a box or horizontal circle, as a fraction of the segment.
function wallHit(a, b, wall, padding = 0) {
  let near = 0;
  let far = 1;
  for (const [axis, size] of [['x', 'w'], ['z', 'd']]) {
    const reach = wall[size] / 2 + padding;
    const low = wall[axis] - reach;
    const high = wall[axis] + reach;
    const start = a[axis];
    const delta = b[axis] - start;
    if (delta === 0) {
      if (start < low || start > high) return Infinity;
      continue;
    }
    const first = (low - start) / delta;
    const second = (high - start) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return Infinity;
  }
  return near;
}

function circleHit(a, b, target, radius) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const x = a.x - target.x;
  const z = a.z - target.z;
  const length = dx * dx + dz * dz;
  const outside = x * x + z * z - radius * radius;
  if (outside <= 0) return 0;
  const projection = x * dx + z * dz;
  const discriminant = projection * projection - length * outside;
  if (!length || projection >= 0 || discriminant < 0) return Infinity;
  const entry = (-projection - Math.sqrt(discriminant)) / length;
  return entry <= 1 ? entry : Infinity;
}

const clear = (a, b, padding = 0) => MAP.obstacles.every(wall => wallHit(a, b, wall, padding) === Infinity);

function walkClear(game, actor, point, goal = null, padding = ACTOR_RADIUS) {
  return clear(actor, point, padding)
    && game.forts.every(fort => fort === goal || circleHit(actor, point, fort, TOWER_RADIUS + padding) === Infinity)
    && game.cannons.every(cannon => cannon === goal || circleHit(actor, point, cannon, CANNON_RADIUS + padding) === Infinity);
}

function move(game, actor, dx, dz) {
  const edge = MAP.halfSize - ACTOR_RADIUS;
  const x = Math.max(-edge, Math.min(edge, actor.x + dx));
  const z = Math.max(-edge, Math.min(edge, actor.z + dz));
  if (walkClear(game, actor, { x, z: actor.z })) actor.x = x;
  if (walkClear(game, actor, { x: actor.x, z })) actor.z = z;
}

function launch(game, source, team, yaw, speed, height, lift, cannon = false) {
  game.projectiles.push({
    id: game.nextId++, source: source.id, team, cannon,
    x: source.x, y: height, z: source.z,
    vx: Math.sin(yaw) * speed, vy: lift, vz: Math.cos(yaw) * speed,
  });
}

export function fire(game, actor = game.player) {
  if (game.ended || actor.shotCooldown > 0) return false;
  const config = actor.team === 'green' ? { interval: 0.38, spread: 0 } : DIFFICULTY[game.difficulty];
  const yaw = actor.yaw + (game.random() * 2 - 1) * config.spread;
  launch(game, actor, actor.team, yaw, 27, 1.25, 4);
  actor.shotCooldown = config.interval;
  return true;
}

function hitActor(game, actor) {
  if (actor.invulnerable > 0) return;
  actor.hp--;
  event(game, 'hit', { actorId: actor.id, hp: actor.hp });
  if (actor.hp > 0) return;
  const owned = game.forts.filter(fort => fort.owner === actor.team);
  const nearest = owned.sort((a, b) => distance(actor, a) - distance(actor, b))[0];
  const spawn = nearest ? towerSpawn(nearest) : CENTER;
  actor.x = spawn.x;
  actor.z = spawn.z;
  actor.hp = actor.maxHp;
  actor.invulnerable = 2;
  actor.shotCooldown = 0;
  event(game, 'respawn', { actorId: actor.id });
}

function paintStructure(game, target, team, cannon) {
  if (target.owner === team) {
    if (cannon) target.ammo = Math.min(100, target.ammo + 25);
    target.captureProgress = Math.max(0, target.captureProgress - 0.25);
    if (target.captureProgress === 0) target.captureTeam = null;
    return;
  }
  if (target.captureTeam !== team) {
    target.captureTeam = team;
    target.captureProgress = 0;
  }
  target.captureProgress += 0.25;
  if (target.captureProgress < 1) return;

  target.owner = team;
  target.captureTeam = null;
  target.captureProgress = 0;
  if (cannon) {
    target.ammo = 100;
    target.shotCooldown = 0;
    event(game, 'cannon', { cannonId: target.id, team });
  } else {
    event(game, 'capture', { fortId: target.id, team });
  }
}

function splatter(game, point, paint, ground) {
  const radius = ground ? SPLASH_RADIUS : 1;
  const maxLife = ground ? 4 : 1.6;
  game.splats.push({ id: game.nextId++, x: point.x, z: point.z, team: paint.team, life: maxLife, maxLife, radius });
  if (game.splats.length > 100) game.splats.shift();
  if (!ground) return;
  for (const actor of game.actors) {
    if (actor.team !== paint.team && distance(point, actor) <= radius && clear(point, actor)) hitActor(game, actor);
  }
  if (paint.cannon) return;
  for (const fort of game.forts) {
    if (distance(point, fort) <= radius && clear(point, fort)) paintStructure(game, fort, paint.team, false);
  }
  for (const cannon of game.cannons) {
    if (distance(point, cannon) <= radius && clear(point, cannon)) paintStructure(game, cannon, paint.team, true);
  }
}

function fly(game, paint, dt) {
  const end = {
    x: paint.x + paint.vx * dt,
    y: paint.y + paint.vy * dt - GRAVITY * dt * dt / 2,
    z: paint.z + paint.vz * dt,
  };
  const ground = end.y <= 0 ? paint.y / (paint.y - end.y) : Infinity;
  const wall = Math.min(...MAP.obstacles.map(obstacle => wallHit(paint, end, obstacle)));
  let first = Math.min(ground, wall);
  let impact = null;

  const intercept = (target, radius, height, applyPaint) => {
    const entry = circleHit(paint, end, target, radius);
    if (entry >= first) return;
    const y = paint.y + (end.y - paint.y) * entry;
    if (y > height) return;
    first = entry;
    impact = applyPaint;
  };
  for (const actor of game.actors) {
    if (actor.team !== paint.team && actor.invulnerable === 0) {
      intercept(actor, 0.88, 2.15, () => hitActor(game, actor));
    }
  }
  if (!paint.cannon) {
    for (const fort of game.forts) {
      if (fort.owner !== paint.team || fort.captureProgress > 0) {
        intercept(fort, TOWER_RADIUS, 3.2, () => paintStructure(game, fort, paint.team, false));
      }
    }
    for (const cannon of game.cannons) {
      intercept(cannon, CANNON_RADIUS, 2.3, () => paintStructure(game, cannon, paint.team, true));
    }
  }

  if (first <= 1) {
    impact?.();
    const point = { x: paint.x + (end.x - paint.x) * first, z: paint.z + (end.z - paint.z) * first };
    splatter(game, point, paint, !impact && ground < wall);
    return false;
  }

  Object.assign(paint, end);
  paint.vy -= GRAVITY * dt;
  return Math.abs(end.x) <= MAP.halfSize && Math.abs(end.z) <= MAP.halfSize;
}

function opponent(game, source, team, range) {
  return game.actors
    .filter(actor => actor.team !== team && actor.invulnerable === 0 && distance(source, actor) <= range && clear(source, actor))
    .sort((a, b) => distance(source, a) - distance(source, b))[0];
}

function updateCannons(game, dt) {
  for (const cannon of game.cannons) {
    cannon.shotCooldown = Math.max(0, cannon.shotCooldown - dt);
    const enemy = cannon.ammo >= 10 && opponent(game, cannon, cannon.owner, 17);
    if (!enemy) continue;
    cannon.yaw = angle(cannon, enemy);
    if (cannon.shotCooldown > 0) continue;

    const flight = Math.max(0.06, distance(cannon, enemy) / 30);
    const lift = (1 - 1.7) / flight + GRAVITY * flight / 2;
    launch(game, cannon, cannon.owner, cannon.yaw, 30, 1.7, lift, true);
    cannon.ammo -= 10;
    cannon.shotCooldown = 0.92;
  }
}

function routeCorners(x, z, reachX, reachZ) {
  return [-1, 1].flatMap(sideX => [-1, 1].map(sideZ => ({
    x: x + sideX * reachX,
    z: z + sideZ * reachZ,
  })));
}

const movementCorners = [
  ...MAP.obstacles.flatMap(wall => routeCorners(wall.x, wall.z, wall.w / 2 + 1.05, wall.d / 2 + 1.05)),
  ...TOWERS.flatMap(tower => routeCorners(tower.x, tower.z, TOWER_RADIUS + 0.85, TOWER_RADIUS + 0.85)),
  ...CANNONS.flatMap(cannon => routeCorners(cannon.x, cannon.z, CANNON_RADIUS + 0.85, CANNON_RADIUS + 0.85)),
];

// The shortest walking route around blocked paths is a sequence of clear corners.
function waypoint(game, actor, goal) {
  if (walkClear(game, actor, goal, goal)) return goal;
  const remaining = movementCorners.map(point => ({
    point,
    cost: walkClear(game, actor, point, goal) ? distance(actor, point) : Infinity,
    first: point,
  }));
  remaining.push({ point: goal, cost: Infinity, first: goal });

  while (remaining.length > 0) {
    remaining.sort((a, b) => a.cost - b.cost);
    const node = remaining.shift();
    if (node.cost === Infinity) return goal;
    if (node.point === goal) return node.first;
    for (const next of remaining) {
      const cost = node.cost + distance(node.point, next.point);
      if (cost < next.cost && walkClear(game, node.point, next.point, goal)) {
        next.cost = cost;
        next.first = node.first;
      }
    }
  }
  return goal;
}

function chooseGoal(game, actor) {
  const towers = game.forts.filter(fort => fort.owner !== actor.team);
  const cannons = game.cannons.filter(cannon => cannon.owner !== actor.team || cannon.ammo <= 50);
  const choices = actor.cannonDuty && cannons.length ? cannons : towers.length ? towers : cannons;
  return choices.sort((a, b) => distance(actor, a) - distance(actor, b))[0];
}

function updateBot(game, actor, dt) {
  const goal = chooseGoal(game, actor);
  const enemy = opponent(game, actor, actor.team, 13);
  const withinSprayRange = goal && distance(actor, goal) < 10 && walkClear(game, actor, goal, goal, 0);
  const retreatingToRefill = goal?.owner === actor.team;
  const aim = enemy && (!withinSprayRange || (!retreatingToRefill && distance(actor, enemy) < 5))
    ? enemy
    : withinSprayRange ? goal : null;
  const destination = withinSprayRange ? null : goal ?? enemy;

  if (destination && distance(actor, destination) > 3) {
    const next = waypoint(game, actor, destination);
    const yaw = angle(actor, next);
    const length = Math.min(distance(actor, next), 6.8 * dt);
    move(game, actor, Math.sin(yaw) * length, Math.cos(yaw) * length);
    actor.yaw = yaw;
  }
  if (aim) {
    actor.yaw = angle(actor, aim);
    fire(game, actor);
  }
}

function update(game, dt, input) {
  for (const actor of game.actors) {
    actor.shotCooldown = Math.max(0, actor.shotCooldown - dt);
    actor.invulnerable = Math.max(0, actor.invulnerable - dt);
  }
  for (const splat of game.splats) splat.life -= dt;
  game.splats = game.splats.filter(splat => splat.life > 0);

  const player = game.player;
  const moveX = Number.isFinite(input.moveX) ? Math.max(-1, Math.min(1, input.moveX)) : 0;
  const moveZ = Number.isFinite(input.moveZ) ? Math.max(-1, Math.min(1, input.moveZ)) : 0;
  const speed = 9 / Math.max(1, Math.hypot(moveX, moveZ));
  move(game, player, moveX * speed * dt, moveZ * speed * dt);
  if (Number.isFinite(input.aimYaw)) player.yaw = input.aimYaw;
  else if (moveX || moveZ) player.yaw = Math.atan2(moveX, moveZ);
  if (input.fire) fire(game, player);

  if (game.bots) {
    for (const actor of game.actors) if (actor !== player) updateBot(game, actor, dt);
  }
  updateCannons(game, dt);
  game.projectiles = game.projectiles.filter(paint => fly(game, paint, dt));

  game.timeLeft -= dt;
  if (game.timeLeft <= 1e-8) {
    game.timeLeft = 0;
    game.ended = true;
    const totals = score(game);
    const leading = Object.keys(totals).filter(team => totals[team] === Math.max(...Object.values(totals)));
    game.winner = leading.length === 1 ? leading[0] : 'draw';
    event(game, 'end', { winner: game.winner });
  }
}

// Motion is in map coordinates. Aim zero points along positive z.
export function step(game, dt, input = {}) {
  if (game.ended || !Number.isFinite(dt) || dt <= 0) return game;
  const bounded = Math.min(dt, 0.25);
  const count = Math.ceil(bounded / 0.025);
  for (let i = 0; i < count && !game.ended; i++) update(game, Math.min(bounded / count, game.timeLeft), input);
  return game;
}

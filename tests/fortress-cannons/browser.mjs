import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const url = new URL('/games/fortress-cannons/?debug', base).href;
const output = resolve(process.env.SCREENSHOT_DIR || '.playwright-mcp/fortress-cannons');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const teamNames = ['הירוקים', 'האדומים', 'הצהובים'];

const observe = (page, expression, arg) => page.waitForFunction(expression, arg, { timeout: 12000 });
const position = page => page.evaluate(() => {
  const { x, z } = window.__fortressCannons.game.player;
  return { x, z };
});
const time = page => page.evaluate(() => window.__fortressCannons.game.timeLeft);
const pauseFor = (page, ms) => page.evaluate(ms => new Promise(resolve => setTimeout(resolve, ms)), ms);
const soFar = page => page.evaluate(() => Math.max(0, ...window.__fortressCannons.game.projectiles
  .filter(projectile => projectile.source === 'player').map(projectile => projectile.id)));
const newShot = (page, after = 0) => observe(page, after => (
  window.__fortressCannons.game.projectiles.some(projectile => projectile.source === 'player' && projectile.id > after)
), after);
const screenshot = (page, name) => page.screenshot({ path: resolve(output, name) });

async function withPage(viewport, touch, scenario) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const contextLabel = `${viewport.width}×${viewport.height}`;
    page.on('pageerror', error => errors.push(`${contextLabel} pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`${contextLabel} console: ${message.text()}`);
    });
    page.on('request', request => {
      if (!request.url().startsWith('data:') && new URL(request.url()).origin !== new URL(base).origin) {
        errors.push(`${contextLabel} external request: ${request.url()}`);
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await observe(page, () => window.__fortressCannons?.mode === 'welcome');
    await scenario(page, context);
  } finally {
    await context.close();
  }
}

async function layout(page, selectors, checkTouchControls = false) {
  const snapshot = await page.evaluate(({ selectors, checkTouchControls }) => {
    const doc = document.documentElement;
    const rect = document.querySelector('#world').getBoundingClientRect();
    const inside = selectors.map(selector => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return { selector, fit: bounds.x >= -1 && bounds.y >= -1
        && bounds.right <= innerWidth + 1 && bounds.bottom <= innerHeight + 1
        && bounds.width > 0 && bounds.height > 0 };
    });
    const objective = document.querySelector('.objective').getBoundingClientRect();
    const overlaps = checkTouchControls && [...document.querySelectorAll('#touch-controls button')]
      .map(button => button.getBoundingClientRect())
      .some(rect => objective.left < rect.right && objective.right > rect.left
        && objective.top < rect.bottom && objective.bottom > rect.top);
    return {
      lang: doc.lang,
      dir: doc.dir,
      matchesViewport: rect.width === innerWidth && rect.height === innerHeight,
      overflow: doc.scrollWidth > innerWidth || doc.scrollHeight > innerHeight,
      inside,
      overlaps,
      text: document.body.innerText,
    };
  }, { selectors, checkTouchControls });
  assert.equal(snapshot.lang, 'he');
  assert.equal(snapshot.dir, 'rtl');
  assert.equal(snapshot.matchesViewport, true);
  assert.equal(snapshot.overflow, false);
  assert.deepEqual(snapshot.inside.filter(item => !item.fit), []);
  assert.ok(!snapshot.overlaps, 'The objective must clear the touch controls');
  assert.doesNotMatch(snapshot.text, /\b(?:undefined|null|NaN)\b/i);
}

async function initialize(page, touch = false) {
  await page.locator('#start')[touch ? 'tap' : 'click']();
  await observe(page, () => window.__fortressCannons.mode === 'playing');
}

async function quiet(page) {
  await page.evaluate(() => {
    const game = window.__fortressCannons.game;
    game.bots = false;
    game.actors = [game.player];
    game.projectiles = [];
    for (const cannon of game.cannons) cannon.ammo = 0;
    Object.assign(game.player, { x: 0, z: -13, yaw: 0, shotCooldown: 0 });
  });
}

async function cameraAndMap(page) {
  const screen = await page.evaluate(() => {
    const { game, viewBounds } = window.__fortressCannons;
    const canvas = document.querySelector('#minimap');
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const project = ({ x, z }) => [
      Math.round((12 + (x + 60) / 120 * (rect.width - 24)) * canvas.width / rect.width),
      Math.round((rect.height - 12 - (z + 60) / 120 * (rect.height - 24)) * canvas.height / rect.height),
    ];
    const markers = [...game.forts, ...game.cannons, game.player].map(entity => {
      const [x, y] = project(entity);
      const { data } = context.getImageData(x - 1, y - 1, 3, 3);
      return Array.from({ length: 9 }, (_, index) => [...data.slice(index * 4, index * 4 + 3)].join(','));
    });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const frame = [];
    for (let index = 0; index < pixels.length; index += 4) {
      const [red, green, blue] = pixels.slice(index, index + 3);
      if (red >= 60 && green >= 85 && blue - red > 13 && blue - green > 4) frame.push(index);
    }
    const bounds = viewBounds();
    return {
      markers, frame, bounds, cameraSeesPlayer: game.player.x > bounds.minX && game.player.x < bounds.maxX
        && game.player.z > bounds.minZ && game.player.z < bounds.maxZ,
    };
  });
  assert.ok(screen.cameraSeesPlayer);
  assert.ok(screen.bounds.maxX - screen.bounds.minX < 120);
  assert.ok(screen.bounds.maxZ - screen.bounds.minZ < 120);
  assert.ok(screen.frame.length > 0, 'Camera footprint is visible on the minimap');
  return screen;
}

async function verifyRespawn(page, ownsFort) {
  await quiet(page);
  await page.evaluate(ownsFort => {
    const game = window.__fortressCannons.game;
    if (!ownsFort) {
      game.forts[0].owner = 'red';
      game.player.hp = 1;
    }
    game.player.invulnerable = 0;
  }, ownsFort);
  // Feed controlled rival shots through the same collision and health logic as a live round.
  for (let hp = ownsFort ? 4 : 0; hp >= 0; hp--) {
    await page.evaluate(() => {
      const game = window.__fortressCannons.game;
      game.projectiles.push({
        id: game.nextId++, source: 'test-rival', team: 'red', cannon: false,
        x: game.player.x, y: 1.25, z: game.player.z - 1.5, vx: 0, vy: 0, vz: 25,
      });
    });
    await observe(page, hp => window.__fortressCannons.game.events.some(event =>
      event.type === 'hit' && event.actorId === 'player' && event.hp === hp), hp);
  }
  await observe(page, () => window.__fortressCannons.game.events.some(event => event.type === 'respawn'));
  const point = await position(page);
  if (ownsFort) assert.ok(Math.abs(Math.hypot(point.x, point.z + 44) - 6) < 0.01);
  else assert.deepEqual(point, { x: 0, z: 0 });
  await cameraAndMap(page);
  await page.evaluate(() => {
    const game = window.__fortressCannons.game;
    game.events = [];
    game.forts[0].owner = 'green';
  });
}

async function enterCenter(page) {
  await page.keyboard.down('ArrowUp');
  try {
    await observe(page, () => window.__fortressCannons.game.player.z >= -4);
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  await page.keyboard.down('Space');
  try {
    await observe(page, () => window.__fortressCannons.game.timeLeft < 169);
  } finally {
    await page.keyboard.up('Space');
  }
}

async function desktop(page) {
  await layout(page, ['#start', '.intro-panel']);
  await screenshot(page, 'welcome-desktop.png');
  await initialize(page);
  await observe(page, () => window.__fortressCannons.audioState === 'running');

  const mapAtSpawn = await cameraAndMap(page);
  for (const [index, color] of ['41,155,118', '226,100,82', '239,195,72', '41,155,118', '41,155,118', '255,255,255'].entries()) {
    assert.ok(mapAtSpawn.markers[index].includes(color), `Marker ${index + 1} appears in the correct map location`);
  }
  await quiet(page);
  const start = await position(page);
  const mapBeforeMovement = await cameraAndMap(page);
  await page.keyboard.down('ArrowUp');
  try {
    const cursor = { x: 825, y: 420 };
    await page.mouse.move(cursor.x, cursor.y);
    const initialTarget = await page.evaluate(({ x, y }) => window.__fortressCannons.pointAt(x, y), cursor);
    await observe(page, ({ cursor, initialTarget }) => {
      const { game, pointAt } = window.__fortressCannons;
      const target = pointAt(cursor.x, cursor.y);
      const expected = Math.atan2(target.x - game.player.x, target.z - game.player.z);
      return target.z > initialTarget.z + 2 && Math.abs(expected - game.player.yaw) < 0.12;
    }, { cursor, initialTarget });
    await page.mouse.down();
    try {
      await newShot(page);
      const first = await soFar(page);
      await page.keyboard.down('ArrowUp'); // Auto-repeat must preserve the mouse aim.
      await newShot(page, first);
      const next = await page.evaluate(first => window.__fortressCannons.game.projectiles
        .find(shot => shot.source === 'player' && shot.id > first), first);
      assert.ok(next.vx > 5, 'Holding mouse fire through key repeat still aims to the right');
    } finally {
      await page.mouse.up();
    }
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  assert.ok((await position(page)).z > start.z + 1.5);
  const mapAfterMovement = await cameraAndMap(page);
  assert.ok(mapAfterMovement.bounds.minZ > mapBeforeMovement.bounds.minZ + 1.5);
  assert.notDeepEqual(mapAfterMovement.frame, mapBeforeMovement.frame);
  await observe(page, () => window.__fortressCannons.game.projectiles.length === 0);

  await page.locator('#sound').click();
  await observe(page, () => window.__fortressCannons.audioState === 'suspended');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'world');
  await page.keyboard.press('Space');
  await newShot(page);
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');

  await page.locator('#sound').click();
  await observe(page, () => window.__fortressCannons.audioState === 'running');

  await observe(page, () => window.__fortressCannons.game.projectiles.length === 0);
  const aim = await page.evaluate(() => {
    const { pointAt } = window.__fortressCannons;
    for (const [x, y] of [[820, 460], [550, 520], [920, 420], [720, 450]]) {
      if (document.elementFromPoint(x, y)?.id === 'world' && pointAt(x, y)) return { x, y };
    }
    throw new Error('No clickable point on the map');
  });
  await page.mouse.click(aim.x, aim.y);
  await newShot(page);
  const clickedShot = await soFar(page);
  await page.mouse.move(aim.x, aim.y);
  await page.mouse.down();
  try {
    await newShot(page, clickedShot);
    const heldShot = await soFar(page);
    await newShot(page, heldShot);
  } finally {
    await page.mouse.up();
  }

  await page.keyboard.press('Escape');
  await page.locator('#pause-screen').waitFor({ state: 'visible' });
  const paused = [await time(page), await position(page)];
  await pauseFor(page, 250);
  assert.deepEqual([await time(page), await position(page)], paused);
  await screenshot(page, 'pause.png');
  await page.locator('#resume').click();
  await observe(page, previous => window.__fortressCannons.game.timeLeft < previous, paused[0]);
  await verifyRespawn(page, true);
  await verifyRespawn(page, false);

  // Stage targets in range. Ownership and meters must change via real Space input.
  await quiet(page);
  const fortId = await page.evaluate(() => {
    const game = window.__fortressCannons.game;
    const fort = game.forts.find(fort => fort.owner === 'red');
    Object.assign(game.player, { x: fort.x, z: fort.z - 8, yaw: 0 });
    return fort.id;
  });
  await page.keyboard.down('Space');
  try {
    await page.waitForSelector(`#status-${fortId}[data-owner="green"]`);
  } finally {
    await page.keyboard.up('Space');
  }
  assert.equal(await page.locator('#green-score').innerText(), '2');
  assert.equal(await page.locator('#red-score').innerText(), '0');

  const cannonId = await page.evaluate(() => {
    const game = window.__fortressCannons.game;
    const cannon = game.cannons[0];
    cannon.owner = 'red';
    Object.assign(game.player, { x: cannon.x, z: cannon.z - 8, yaw: 0, shotCooldown: 0 });
    return cannon.id;
  });
  await page.waitForSelector(`#status-${cannonId}[data-owner="red"]`);
  await page.keyboard.down('Space');
  try {
    await page.waitForSelector(`#status-${cannonId}[data-owner="green"]`);
  } finally {
    await page.keyboard.up('Space');
  }
  const cannon = page.locator(`#status-${cannonId} small`);
  assert.match(await cannon.innerText(), /100%/);
  await page.evaluate(() => {
    const game = window.__fortressCannons.game;
    game.cannons[0].ammo = 0;
    game.player.shotCooldown = 0;
    game.projectiles = [];
  });
  await observe(page, id => document.querySelector(`#status-${id} small`).textContent.endsWith(' 0%'), cannonId);
  await page.keyboard.press('Space');
  await observe(page, id => document.querySelector(`#status-${id} small`).textContent.includes('25%'), cannonId);

  // Shorten only the remaining time. Let the live loop decide the result.
  await page.evaluate(() => { window.__fortressCannons.game.timeLeft = 0.12; });
  await page.locator('#result-screen').waitFor({ state: 'visible' });
  assert.match(await page.locator('#result-title').innerText(), /הירוקים ניצחו/);
  for (const name of teamNames) assert.match(await page.locator('#result-score').innerText(), new RegExp(name));
  assert.deepEqual(await page.locator('#result-score b').allTextContents(), ['2', '0', '1']);
  await layout(page, ['#result-score', '#again']);
  await screenshot(page, 'results.png');

  await page.locator('#again').click();
  await observe(page, () => window.__fortressCannons.game.timeLeft < 180);
  const reset = await page.evaluate(() => {
    const game = window.__fortressCannons.game;
    return { time: game.timeLeft, forts: game.forts.map(fort => fort.owner), ammo: game.cannons.map(cannon => cannon.ammo), bots: game.bots };
  });
  assert.ok(reset.time > 179);
  assert.deepEqual(reset.forts, ['green', 'red', 'yellow']);
  assert.deepEqual(reset.ammo, [100, 100]);
  assert.equal(reset.bots, true);
  await enterCenter(page);
  await layout(page, ['#fort-status', '#cannon-status', '.health-card', '#pause', '.map-panel']);
  await screenshot(page, 'play-desktop.png');
  console.log('Desktop: follow camera, moving pointer aim, minimap markers and footprint, movement, Space, click and held mouse fire, pause, mute/audio, respawns, capture, refill, results, and fresh round passed');
}

async function center(locator, id) {
  const box = await locator.boundingBox();
  assert.ok(box);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id };
}

async function mobile(page, context) {
  await layout(page, ['#start', '.intro-panel']);
  await screenshot(page, 'welcome-mobile.png');
  await initialize(page, true);
  await quiet(page);
  const spray = page.locator('#spray');
  await spray.tap();
  await newShot(page);
  const firstShot = await soFar(page);
  const client = await context.newCDPSession(page);
  const up = page.locator('[data-move="up"]');
  const touchPoints = [await center(up, 1), await center(spray, 2)];
  const origin = await position(page);
  const touches = (type, touchPoints = []) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
  await touches('touchStart', touchPoints);
  try {
    await observe(page, origin => window.__fortressCannons.game.player.z > origin.z + 1.8, origin);
    await newShot(page, firstShot);
    assert.equal(await page.locator('.touch-controls .active').count(), 2);
  } finally {
    await touches('touchEnd');
  }
  await observe(page, () => document.querySelectorAll('.touch-controls .active').length === 0);
  const released = await position(page);
  await pauseFor(page, 500);
  assert.deepEqual(await position(page), released);

  await touches('touchStart', touchPoints);
  await observe(page, released => window.__fortressCannons.game.player.z > released.z + 1, released);
  await touches('touchCancel');
  await observe(page, () => document.querySelectorAll('.touch-controls .active').length === 0);
  const cancelled = await position(page);
  await pauseFor(page, 850);
  assert.deepEqual(await position(page), cancelled);
  assert.equal(await soFar(page), 0);

  await page.locator('#pause').tap();
  await page.locator('#restart-paused').tap();
  await enterCenter(page);
  await layout(page, ['.match-score', '#fort-status', '#cannon-status', '#spray', '.dpad', '.map-panel'], true);
  await screenshot(page, 'play-mobile.png');
  console.log('Portrait touch: short tap shoots, simultaneous movement and spray work, release and cancellation clear controls');
}

async function landscape(page) {
  await layout(page, ['#start', '.intro-panel']);
  await screenshot(page, 'welcome-landscape.png');
  await initialize(page, true);
  await enterCenter(page);
  await layout(page, ['.match-score', '#cannon-status', '#spray', '.dpad', '.map-panel'], true);
  await screenshot(page, 'play-landscape.png');
  console.log('Landscape touch: welcome action and gameplay controls fit');
}

try {
  await withPage({ width: 1440, height: 900 }, false, desktop);
  await withPage({ width: 390, height: 844 }, true, mobile);
  await withPage({ width: 844, height: 390 }, true, landscape);
  assert.deepEqual(errors, []);
  console.log(`No browser errors. Screenshots saved in ${output}`);
} finally {
  await browser.close();
}

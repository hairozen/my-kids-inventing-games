import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const url = new URL('/games/princess-race/?debug', base).href;
const output = resolve(process.env.SCREENSHOT_DIR || '.playwright-mcp/princess-race');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
const racers = ['בל', 'פליס', 'טורס'];
const control = name => `[data-control="${name}"]`;
const controls = ['left', 'right', 'jump', 'sprint'].map(control);
const observe = (page, expression, argument) => page.waitForFunction(expression, argument, { timeout: 12000 });
const screenshot = (page, name) => page.screenshot({ path: resolve(output, name) });
const visible = (page, selector) => page.locator(selector).waitFor({ state: 'visible' });

async function withPage(viewport, touch, scenario) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const label = `${viewport.width}×${viewport.height}`;
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(`${label} page error: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__princessRace && !document.querySelector('#start').disabled)
      || !document.querySelector('#error').hidden, null, { timeout: 30000 });
    assert.equal(await page.locator('#error').isVisible(), false, errors.join('\n'));
    await scenario(page, context);
  } finally {
    await context.close();
  }
}

async function layout(page, selectors) {
  const snapshot = await page.evaluate(selectors => {
    const doc = document.documentElement;
    const canvas = document.querySelector('#game').getBoundingClientRect();
    const rank = document.querySelector('#rank-number').getBoundingClientRect();
    const total = document.querySelector('.position strong i').getBoundingClientRect();
    const outside = selectors.filter(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return box.width <= 0 || box.height <= 0 || box.left < -1 || box.top < -1
        || box.right > innerWidth + 1 || box.bottom > innerHeight + 1;
    });
    return {
      lang: doc.lang, dir: doc.dir, outside,
      fullscreen: canvas.x === 0 && canvas.y === 0 && canvas.width === innerWidth && canvas.height === innerHeight,
      overflow: doc.scrollWidth > innerWidth || doc.scrollHeight > innerHeight,
      rankOrder: rank.width === 0 || rank.right <= total.left,
      text: document.body.innerText,
    };
  }, selectors);
  assert.equal(snapshot.lang, 'he');
  assert.equal(snapshot.dir, 'rtl');
  assert.equal(snapshot.fullscreen, true);
  assert.equal(snapshot.overflow, false);
  assert.equal(snapshot.rankOrder, true);
  assert.deepEqual(snapshot.outside, []);
  assert.doesNotMatch(snapshot.text, /\b(?:undefined|null|NaN)\b/i);
  assert.doesNotMatch(snapshot.text, /רק\s+לבל|רק\s+לך|בלבד|הספרינט\s+של\s+בל/);
}

async function start(page, touch = false) {
  await page.locator('#start')[touch ? 'tap' : 'click']();
  await visible(page, '.hud');
}

async function assertSprint(page, active) {
  await observe(page, active => {
    const { racers } = window.__princessRace.race;
    return racers[0].sprinting === active && racers[0].speed > 0;
  }, active);
  const state = await page.evaluate(() => window.__princessRace.race.racers
    .map(({ sprinting, speed }) => ({ sprinting, speed })));
  assert.deepEqual(state, [
    { sprinting: active, speed: active ? 12.4 : 9.5 },
    { sprinting: false, speed: 10.5 },
    { sprinting: false, speed: 10.62 },
  ]);
  assert.equal(await page.locator(control('sprint')).getAttribute('aria-pressed'), String(active));
}

async function fresh(page, selector) {
  await page.locator(selector).click();
  await visible(page, '.hud');
  const state = await page.evaluate(() => {
    const { race, controls, paused } = window.__princessRace;
    return {
      racers: race.racers.length, elapsed: race.elapsed, distance: race.racers[0].distance,
      winner: race.winner, active: Object.values(controls).some(Boolean), paused,
    };
  });
  assert.equal(state.racers, 3);
  assert.ok(state.elapsed < 1 && state.distance < 10);
  assert.equal(state.winner, null);
  assert.equal(state.active, false);
  assert.equal(state.paused, false);
  assert.equal(await page.locator('#district').innerText(), 'גני הוורדים');
}

async function desktop(page) {
  await layout(page, ['.intro-card', '#start', '#portraits']);
  assert.equal(await page.locator('.special b').innerText(), 'רווח = ספרינט');
  await screenshot(page, 'welcome-desktop.png');
  await start(page);
  await assertSprint(page, false);
  await page.keyboard.down('ArrowRight');
  await observe(page, () => window.__princessRace.race.racers[0].x > -.6);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await observe(page, () => window.__princessRace.race.racers[0].x === -1);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  await observe(page, () => window.__princessRace.race.racers[0].jumpHeight > .3);
  await page.keyboard.down('Space');
  await assertSprint(page, true);
  await page.keyboard.up('Space');
  await assertSprint(page, false);
  await layout(page, ['.hud', '#pause', ...controls]);
  await screenshot(page, 'race-rose-gardens.png');

  // Stage each approach. The live loop must cross the boundary and update the HUD.
  for (const [boundary, district, image] of [
    [400, 'הטיילת ליד האגם', 'race-lakeside.png'],
    [800, 'שדרת הארמון', 'race-palace-avenue.png'],
  ]) {
    await page.evaluate(boundary => {
      const { race } = window.__princessRace;
      race.elapsed = boundary / 11;
      race.racers.forEach((racer, index) => { racer.distance = boundary - 2 + index * 3; });
    }, boundary);
    await page.keyboard.down('Space');
    try {
      await observe(page, district => document.querySelector('#district').textContent === district, district);
      assert.ok(parseInt(await page.locator('#percent').innerText(), 10) >= Math.floor(boundary / 12));
      await screenshot(page, image);
    } finally {
      await page.keyboard.up('Space');
    }
  }

  await page.keyboard.down('Space');
  await assertSprint(page, true);
  await page.keyboard.press('Escape');
  await visible(page, '#paused');
  assert.equal(await page.locator(control('sprint')).getAttribute('aria-pressed'), 'false');
  assert.match(await page.locator('#boost-state').textContent(), /^רווח/);
  const pausedAt = await page.evaluate(() => window.__princessRace.race.elapsed);
  await layout(page, ['#resume', '#restart']);
  await screenshot(page, 'pause.png');
  assert.equal(await page.evaluate(() => window.__princessRace.race.elapsed), pausedAt);
  await page.locator('#resume').click();
  await observe(page, previous => window.__princessRace.race.elapsed > previous, pausedAt);
  await assertSprint(page, false);
  await page.keyboard.up('Space');
  await page.locator('#pause').click();
  await fresh(page, '#restart');

  for (const [index, name] of racers.entries()) {
    // Fulfil the last metre in the live loop to exercise each reachable result.
    await page.evaluate(index => {
      const { race } = window.__princessRace;
      race.elapsed = 110;
      race.racers.forEach((racer, racerIndex) => {
        racer.distance = racerIndex === index ? 1199 : 1190;
      });
    }, index);
    await visible(page, '#finish');
    assert.equal(await page.locator('#winner-name').innerText(), name + ' ניצחה!');
    assert.match(await page.locator('#finish-time').innerText(), /1:50.*1,200/);
    assert.equal(await page.locator('#winner-art svg').count(), 1);
    assert.ok(await page.locator('#winner-message').innerText());
    await layout(page, ['#winner-name', '#replay']);
    if (index === 0) await screenshot(page, 'winner.png');
    await fresh(page, '#replay');
  }
  console.log('Desktop keyboard movement, jump, Belle-only sprint, both district crossings, pause/resume, all three winners and restarts passed');
}

async function touchPoint(page, name, id) {
  const box = await page.locator(control(name)).boundingBox();
  assert.ok(box);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id };
}

async function portrait(page, context) {
  await layout(page, ['.intro-card', '#start']);
  await screenshot(page, 'welcome-portrait.png');
  await start(page, true);
  await layout(page, ['.hud', '#pause', ...controls]);
  const client = await context.newCDPSession(page);
  const touches = (type, touchPoints = []) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
  const sprint = await touchPoint(page, 'sprint', 1);
  const right = await touchPoint(page, 'right', 2);
  await touches('touchStart', [sprint, right]);
  await assertSprint(page, true);
  await observe(page, () => window.__princessRace.race.racers[0].x > -.7);
  await screenshot(page, 'race-portrait.png');
  await touches('touchEnd');
  await assertSprint(page, false);
  assert.equal(await page.locator(control('right')).getAttribute('aria-pressed'), 'false');
  const releasedAt = await page.evaluate(() => {
    const { race } = window.__princessRace;
    return { x: race.racers[0].x, elapsed: race.elapsed };
  });
  await observe(page, releasedAt => window.__princessRace.race.elapsed > releasedAt.elapsed + .1, releasedAt);
  assert.equal(await page.evaluate(() => window.__princessRace.race.racers[0].x), releasedAt.x);

  await page.keyboard.down('Space');
  await touches('touchStart', [sprint]);
  await touches('touchCancel');
  await assertSprint(page, true);
  await page.keyboard.up('Space');
  await assertSprint(page, false);
  await touches('touchStart', [sprint, right]);
  await assertSprint(page, true);
  await touches('touchCancel');
  await assertSprint(page, false);
  assert.equal(await page.locator(control('right')).getAttribute('aria-pressed'), 'false');

  await page.locator(control('jump')).tap();
  await observe(page, () => window.__princessRace.race.racers[0].jumpHeight > .3);
  console.log('Portrait touch chords, release, cancellation, mixed keyboard/touch ownership, and short-tap jump passed');
}

async function landscape(page) {
  await layout(page, ['#start']);
  await screenshot(page, 'welcome-landscape.png');
  await start(page, true);
  await layout(page, ['.hud', '#pause', ...controls]);
  await screenshot(page, 'race-landscape.png');
  console.log('Landscape welcome and race controls fit');
}

try {
  await withPage({ width: 1440, height: 900 }, false, desktop);
  await withPage({ width: 390, height: 844 }, true, portrait);
  await withPage({ width: 844, height: 390 }, true, landscape);
  assert.deepEqual(errors, []);
  console.log(`No browser errors. Screenshots saved in ${output}`);
} catch (error) {
  if (errors.length) console.error(errors.join('\n'));
  throw error;
} finally {
  await browser.close();
}

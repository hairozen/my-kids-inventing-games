async (page) => {
  // Run via the connected Playwright runner. Open the desired host first.
  const base = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const p = await context.newPage();
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  try {
    await p.goto(base + '/games/droplets/');
    await p.locator('#start').tap();
    await p.waitForFunction(() => window.dropletGame.state.phase === 'playing');
    const target = await p.locator('.drop').evaluateAll(elements => elements.map(e => {
      const r = e.getBoundingClientRect();
      return { id: Number(e.dataset.drop), x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).find(r => r.y > 220 && r.y < 730));
    assert(target, 'No visible droplet to tap');
    await p.touchscreen.tap(target.x, target.y);
    const caught = await p.evaluate(id => ({
      score: window.dropletGame.state.score,
      removed: !window.dropletGame.state.drops.some(d => d.id === id)
    }), target.id);
    assert(caught.score === 1 && caught.removed, 'Touch must pop one droplet and score exactly once');
    await p.locator('#pause').tap();
    const paused = await p.evaluate(() => window.dropletGame.state.elapsed);
    await p.waitForTimeout(250);
    assert(await p.evaluate(t => window.dropletGame.state.elapsed === t, paused), 'Pause must freeze time');
    await p.locator('#resume').tap();
    // Exercise the same pointer handler with mouse input on this hybrid device.
    await p.locator('.drop').first().dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
    assert(await p.evaluate(() => window.dropletGame.state.score === 2), 'Mouse must still score once');
    await p.locator('.drop').first().dispatchEvent('pointerdown', { button: 2, pointerType: 'mouse' });
    assert(await p.evaluate(() => window.dropletGame.state.score === 2), 'Right click must not score');
    await p.locator('.back-link').tap();
    await p.waitForURL(base + '/');
    assert(new URL(p.url()).pathname === '/', 'Home navigation must work on touch');
    return { touchPops: true, noDoubleScore: true, pause: true, mouse: true, rightClickIgnored: true, home: true };
  } finally { await context.close(); }
}

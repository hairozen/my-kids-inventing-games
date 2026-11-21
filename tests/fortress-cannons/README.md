# Fortress Cannons verification

Run the deterministic model tests from the repository root.

```sh
mise exec node@26.12.0 -- node --test tests/fortress-cannons/model.test.js
```

The Chromium smoke test drives the game at 1440 × 900 on desktop, 390 × 844 on touch portrait, and 844 × 390 on touch landscape. It checks keyboard, mouse and touch movement and firing, including a short tap and simultaneous movement and spraying. It also checks pause, mute, reset, results, Hebrew direction, layout and browser errors.

Start the local site first, then run the smoke test in another terminal with Playwright Core and its matching Chromium installed.

```sh
mise exec node@26.12.0 -- npm run dev
```

```sh
mise exec node@26.12.0 -- node tests/fortress-cannons/browser.mjs
```

Set `PLAYWRIGHT_CORE_PATH` to the absolute package path if Playwright Core is installed outside the project. Set `CHROMIUM_PATH` to the matching browser executable if Playwright cannot find it automatically. Set `BASE_URL` to use another server. Screenshots are written to `.playwright-mcp/fortress-cannons/` unless `SCREENSHOT_DIR` points elsewhere.

The script opens the local game's `?debug` view. For capture and refill it stages the player and targets, then fires with the same Space input as a player. For results it moves the timer near zero and lets the game finish normally. The screenshot of desktop play comes from a fresh round with bots enabled. The smoke test covers Chromium touch emulation. Physical phones and other browsers can have different input, layout and audio behavior.

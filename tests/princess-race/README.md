# Princess race verification

## Sprint copy release checks, November 21, 2026

The visible help, start card, accessible labels, live status, button and hub tag now say Space = sprint without emphasizing who has the ability. The underlying Belle sprint behavior is unchanged.

The browser scenario checks that the removed exclusivity wording does not appear on the welcome screen or during play. Desktop, portrait touch and landscape touch checks still exercise movement, sprint, pause, districts, winners and replay without browser errors. `npm test` passes all 55 project tests, including the same nine Princess Race tests. Deployment is verified independently of these local checks.

## Longer 3D race, November 20, 2026

Verified locally with Node.js 26.12.0 through mise, on the working branch `codex/fortress-three-team-design`. This records the local game, not a live deployment.

The user requested a longer course and race, a Space speed boost exclusive to Belle, and better graphics. The developer chose 1,200 metres, 25 spaced obstacles, and three visual districts. These numbers and districts are developer defaults, not new instructions attributed to Ella.

### Automated checks

- `npm run check` passes all authored JavaScript syntax checks.
- `npm test` passes all 54 project tests, including 9 Princess Race tests.
- Holding sprint accelerates only Belle. Releasing it restores her normal running speed; neither rival's speed changes. The same rule holds if the racer array is reordered.
- Deterministic full races with no steering or jumps took 101.33 seconds with sprint held, with Belle winning, and 113.65 seconds without sprint, with Torres winning. The course is 1,200 metres rather than 500, and obstacles continue beyond 1,100 metres.
- Tests retain steering, jump clearance, temporary slowdown, all three possible winners, fresh restart, first crossing within a shared frame, and matching outcomes at 30, 60, and 144 frames per second.

### Browser checks

The [repeatable browser scenario](browser.mjs) runs against `npm run dev` at `http://127.0.0.1:4173/` in Chromium at desktop 1440 × 900, touch portrait 390 × 844, and touch landscape 844 × 390.

- Actual arrow and Space input steer, jump, and boost Belle. The browser reads each rival's normal speed while Belle accelerates and after release.
- The HUD shows elapsed time, distance remaining, rank, and the current garden district. Pausing freezes progress, clears held input, and resets the boost label; resume continues from the same place.
- Real CDP touch input exercises simultaneous sprint and steering, quick jump taps, release, cancellation, and mixed keyboard and touch input.
- Controlled setups place racers near the 400- and 800-metre district boundaries, then actual input moves them across. Other controlled setups place each possible winner near the finish; the ordinary game loop decides the winner and displays the matching portrait, name, race time, fireworks, and replay action.
- Replay and restart restore a fresh 1,200-metre race. The full-screen canvas, Hebrew labels, controls, and cards fit the checked viewports without document overflow, missing-value text, page errors, or console errors.
- The visible browser was also used to start, steer, jump, and hold Space in the integrated 3D game. The representative garden screenshot comes from ordinary play rather than a staged district transition.

### Visual review fixes

- The portrait camera now includes all three nearby racers and both sides of the track.
- The rank number uses left-to-right direction inside its Hebrew card.
- Pausing clears the boost status and hides inactive movement buttons.
- The compact landscape heading retains a space when its line break is hidden, and the welcome card clears the window edge.
- Running leg motion stays beneath the gowns rather than protruding through the fabric.

### Run the browser scenario

Start the local server, then run the test in a second terminal with Playwright Core and its matching Chromium available.

```sh
mise exec node@26.12.0 -- npm run dev
mise exec node@26.12.0 -- node tests/princess-race/browser.mjs
```

Set `PLAYWRIGHT_CORE_PATH` to the installed package's absolute path when it is outside this project. Set `CHROMIUM_PATH` to the matching Chromium executable if needed. `BASE_URL` overrides the local server; `SCREENSHOT_DIR` overrides `.playwright-mcp/princess-race/`.

### Boundaries

The long-race duration is simulation evidence; the browser finish checks use staged distances. Touch checks use Chromium emulation, not physical phones. Safari, Firefox, and physical-device frame rates were not checked. No external graphics or font requests are required: the game uses original geometry and artwork with the already bundled Babylon.js engine. No commit, push, deployment, or live-site verification occurred.

## Previous version, November 13, 2026

Verified locally on 2026-11-13 using Node 26.12.0 and a Chromium browser against `npm run dev` on port 4197.

### Automated model checks

`npm test` passed all 36 tests across the three games, including 8 princess-race tests. These cover automatic running, steering, jump clearance, sprint, temporary slowdown, all three possible winners, fresh restart, and consistent movement at different frame rates. `npm run check` passed for authored JavaScript.

### Browser checks

The following checks exercised the rendered game with Playwright. Its browser clock was advanced to complete races without waiting in real time; the real UI and animation loop remained in use.

- Start, steer right, jump, hold Space: Belle won and the sign read `בל ניצחה!`.
- Replay without sprint: Felice won and the sign read `פליס ניצחה!`.
- Pause and resume: race progress stayed unchanged while paused.
- Winner display: princess portrait, matching name, radial fireworks and replay button appeared. Fireworks disappeared on replay.
- Reduced-motion preference: fireworks remained static across successive frames.
- Desktop 1365×900, mobile-sized 390×844, and landscape 844×390: start/replay and control buttons fit without horizontal overflow. The landscape winner card fit within the game area.
- Chromium touch-event emulation: simultaneous sprint + steering and sprint + jump activated together; releasing touches cleared the controls without scrolling the page.
- Hub: all three thumbnails loaded, game links were distinct, and Lavie’s and Ella’s creator badges remained present.
- Final game load: no browser console errors or warnings.

These checks do not establish physical-phone behavior, Safari compatibility, or deployed-site verification. No deployment was performed.

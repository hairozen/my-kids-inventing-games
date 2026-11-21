# Fortress Cannons verification

## Larger arena release checks, November 21, 2026

The arena is 120 × 120 units with eight real cover obstacles. The camera follows the player from above instead of shrinking the whole map into one view. A canvas minimap shows all three towers, both cannons, the player and the camera footprint. Mouse aiming resolves the current screen point after camera movement.

- `npm run check` passes for authored JavaScript on Node.js 26.12.0.
- `npm test` passes all 55 project tests, including 18 Fortress Cannons tests. Added checks exercise safe exits and approaches to all five objectives on the larger map. Every team still captures towers and cannons and fights late in a full round at each difficulty.
- Chromium checks cover desktop 1440 × 900, portrait touch 390 × 844, and landscape touch 844 × 390. They exercise camera follow, pointer aim while moving, minimap markers and moving footprint, keyboard and touch fire, pause/mute, staged fifth-hit respawns, capture/refill, results and reset. The representative gameplay image comes from ordinary input with bots enabled.
- The short landscape welcome card uses two columns so difficulty choices and Start fit in the first view. Portrait controls and minimap remain separate.
- Holding a movement key must not replace a held mouse aim on operating-system key repeat. The browser scenario includes that regression.
- [Browser run instructions](../tests/fortress-cannons/README.md) explain the optional Playwright paths. Set `BASE_URL` to the configured live Worker to rerun against deployed assets.

These checks cover the source tree before publication. GitHub merge state, Cloudflare deployment output, and the live page are verified separately during release. Physical phones and browsers other than Chromium remain untested.

## Three-team redesign, November 20, 2026

Local feature branch: `codex/fortress-three-team-design`. These results cover the local redesign, not the deployed Worker.

The graphics follow-up adds round masonry towers, garden paths, terrain textures, shoreline details, and soft contact shadows. The user's later correction makes the playable terrain white and gives each character a white body with clothing in its team's color. The controlled character is visually 42% larger than its teammates, with a dark ring and pointed `אני` marker. These are rendering changes; the simulation and hit ranges remain unchanged.

### Automated checks

- Node.js 26.12.0 through mise; dependencies installed with `npm ci`.
- `npm run check` passes for all authored JavaScript.
- `npm test` passes all 54 tests, including 17 Fortress Cannons behavior tests and the other three games' tests.
- Fortress tests exercise three teams of three, initial ownership, paint capture and recapture, defending and contested capture, falling paint and landing splashes, fifth-hit return beside the nearest owned tower, center return without a tower, spawn protection, friendly paint, finite cannon ammo, refill and bot refill, obstacle collisions, difficulty, end-of-round results, fresh state, and a full simulated round at each difficulty.

### Browser interaction

Served with `npm run dev` at `http://127.0.0.1:4173/`. The reproducible [Chromium scenario](../tests/fortress-cannons/browser.mjs) covers desktop 1440 × 900, touch portrait 390 × 844, and touch landscape 844 × 390. [Run instructions](../tests/fortress-cannons/README.md) describe the optional Playwright installation paths.

- The overhead 3D world, Hebrew start screen, team symbols and labels load without page errors or console errors. The canvas fills the viewport and the checked controls fit without document overflow or missing-value text.
- The final white-arena graphics were checked again in all three viewports. The player marker, white body, green clothing, and contrasting shadow remain visible alongside the current tower and cannon ownership.
- Real keyboard input moves the player and sprays paint. Mouse clicks and holds aim and spray. A short touchscreen tap produces one shot; holding sprays repeatedly.
- CDP touch input exercises movement and spraying together. Releasing or cancelling touch stops the held action. A separate review verified that pausing during a held spray, releasing while paused, and resuming produces no extra shots.
- Escape and the pause button stop the countdown and suspend audio. Resume continues the round. Mute suspends audio and restores canvas focus; keyboard play still works after mute. Unmute resumes audio.
- Controlled browser setups place the player in range of a tower or cannon, then use actual Space input to capture them and verify ownership and the HUD. Friendly spray visibly refills an emptied cannon.
- A controlled setup reduces the remaining time near zero, then lets the ordinary game loop finish. The results show all three teams. Starting another round restores one tower per team, two green cannons with full paint, and a fresh timer.
- Gameplay screenshots use a fresh round with computer players enabled. The visible browser was also used to start, move, spray, and pause the game.
- The hub was checked at desktop and portrait widths: all four game links and screenshots load, both children's creator badges remain, and there is no horizontal overflow. The final game screenshot was saved first; the hub screenshot was captured and inspected last.

### Review fixes

- A quick press and release could happen between animation frames and disappear before the game sampled held input. A pending shot now survives until the next playing frame. Touch tap, hold, cancellation, and pause checks verify the fix.
- The objective hint overlapped the green tower sign on desktop and a movement button in portrait. It now sits below them. In short landscape windows the scoreboard moves beside the arena and the duplicate tower cards are hidden, leaving the world's tower signs visible.
- Characters return beside a tower rather than inside its solid geometry. The simulation blocks walking through towers and cannons while keeping the spawn exit clear.

### Boundaries

- Chromium touch emulation does not establish physical phone or tablet behavior. Safari, Firefox, and physical devices were not tested in this pass.
- Audio state was checked; no human listening assessment was performed.
- Balance and long-term play enjoyment remain for Lavie to assess by playing. The three-minute rounds, three characters per team, capture pace, paint capacity, and tie rule are developer defaults authorized by the user.
- No external model or code files were copied. The game uses original geometry and code with the already bundled Babylon.js runtime.
- No commit, push, deployment, or live-site verification was performed for this redesign.

## First playable verification, November 13, 2026

Date: 2026-11-13. Local feature branch: `codex/third-game-glossary`.
This records the working-tree implementation, not a deployed release.

### Automated checks

- `npm run check`: all authored JavaScript syntax checks pass.
- `npm test`: 41 tests pass, including 13 new Fortress Cannons simulation tests and all 28 existing game tests.
- New simulation coverage: capture and recapture, protected homes, consumed keys relocated to distinct spots, five-hit hero return, three-hit guard removal, guard placement/cooldown/cap, enemy difficulty, round end and draw, AI capture, diagonal movement, obstacle collisions, projectile sweeps, guard line of sight, and fresh-round state.

### Actual browser interaction

Served with `npm run dev` at `http://127.0.0.1:4173/` and inspected with Playwright in Chromium.

- Hebrew start screen, first-person 3D scene and difficulty choices render. Desktop and 390-pixel-wide start screens have no horizontal overflow; the start button is visible. The new game's first version is for keyboard and mouse, not touch gameplay.
- Arrow-key movement changes the actual rendered camera position. Space produces visible paint projectiles. Horizontal mouse dragging changes camera yaw.
- Walked into the circle, received a placement charge, pressed Enter, and observed a guard at the placement position. The charge was consumed.
- Walked to a visible golden key, picked it up, and entered the middle fortress gate. The key was consumed, the fortress turned blue, and the scoreboard changed to one blue fortress.
- Escape displays pause and freezes the countdown. Resume continues the same round.
- A browser-only accelerated animation clock exercised the end screen at `0:00`. The winner and score appeared; starting another round reset time to `3:00`, health to `5/5`, scores to zero and guards to none. No timing override is in the shipped code.
- AudioContext enters `running` after starting and `suspended` when muted. Toggling music preserves keyboard controls. This checks audio operation, not a human listening assessment.
- The hub has all three game links, with Lavie credited on Fortress Cannons and Hogwarts and Ella on droplets. Both existing game routes still open.

### Review fixes

- Restore canvas focus after toggling music so keyboard play continues.
- Guards and computer players choose visible targets rather than firing at a nearer target behind cover; a behavioral simulation test covers the case.
- Drag-look uses captured pointer events independently of pointer-lock requests. This was verified after the automated browser denied pointer lock.

### Remaining boundaries

- Native pointer lock was unavailable in the automated browser. Drag-look fallback passed; native locked-mouse behavior still needs a physical-browser check.
- No physical touch-device gameplay check; this version was explicitly scoped to a computer.
- Character customization is intentionally deferred, as Lavie approved.
- No deployment or live-site verification was performed.

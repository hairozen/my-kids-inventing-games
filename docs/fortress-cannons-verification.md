# Fortress Cannons: first playable verification

Date: 2026-11-13. Local feature branch: `codex/third-game-glossary`.
This records the working-tree implementation, not a deployed release.

## Automated checks

- `npm run check`: all authored JavaScript syntax checks pass.
- `npm test`: 41 tests pass, including 13 new Fortress Cannons simulation tests and all 28 existing game tests.
- New simulation coverage: capture and recapture, protected homes, consumed keys relocated to distinct spots, five-hit hero return, three-hit guard removal, guard placement/cooldown/cap, enemy difficulty, round end and draw, AI capture, diagonal movement, obstacle collisions, projectile sweeps, guard line of sight, and fresh-round state.

## Actual browser interaction

Served with `npm run dev` at `http://127.0.0.1:4173/` and inspected with Playwright in Chromium.

- Hebrew start screen, first-person 3D scene and difficulty choices render. Desktop and 390-pixel-wide start screens have no horizontal overflow; the start button is visible. The new game's first version is for keyboard and mouse, not touch gameplay.
- Arrow-key movement changes the actual rendered camera position. Space produces visible paint projectiles. Horizontal mouse dragging changes camera yaw.
- Walked into the circle, received a placement charge, pressed Enter, and observed a guard at the placement position. The charge was consumed.
- Walked to a visible golden key, picked it up, and entered the middle fortress gate. The key was consumed, the fortress turned blue, and the scoreboard changed to one blue fortress.
- Escape displays pause and freezes the countdown. Resume continues the same round.
- A browser-only accelerated animation clock exercised the end screen at `0:00`. The winner and score appeared; starting another round reset time to `3:00`, health to `5/5`, scores to zero and guards to none. No timing override is in the shipped code.
- AudioContext enters `running` after starting and `suspended` when muted. Toggling music preserves keyboard controls. This checks audio operation, not a human listening assessment.
- The hub has all three game links, with Lavie credited on Fortress Cannons and Hogwarts and Ella on droplets. Both existing game routes still open.

## Review fixes

- Restore canvas focus after toggling music so keyboard play continues.
- Guards and computer players choose visible targets rather than firing at a nearer target behind cover; a behavioral simulation test covers the case.
- Drag-look uses captured pointer events independently of pointer-lock requests. This was verified after the automated browser denied pointer lock.

## Remaining boundaries

- Native pointer lock was unavailable in the automated browser. Drag-look fallback passed; native locked-mouse behavior still needs a physical-browser check.
- No physical touch-device gameplay check; this version was explicitly scoped to a computer.
- Character customization is intentionally deferred, as Lavie approved.
- No deployment or live-site verification was performed.

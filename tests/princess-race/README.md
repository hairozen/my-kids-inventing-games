# Princess race verification

Verified locally on 2026-11-13 using Node 26.12.0 and a Chromium browser against `npm run dev` on port 4197.

## Automated model checks

`npm test` passed all 36 tests across the three games, including 8 princess-race tests. These cover automatic running, steering, jump clearance, sprint, temporary slowdown, all three possible winners, fresh restart, and consistent movement at different frame rates. `npm run check` passed for authored JavaScript.

## Browser checks

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

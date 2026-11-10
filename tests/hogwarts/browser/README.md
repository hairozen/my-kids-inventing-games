# Live browser scenarios

The two JavaScript files are async Playwright `(page) => { ... }` functions for a browser automation runner, such as the connected Playwright tool's `browser_run_code_unsafe` with `filename`. They are not Node unit tests and require the local game server at `http://127.0.0.1:4173/games/hogwarts/`.

- `ui-matrix.js` drives selection, draw cancellation, sound, repeated Escape, pause/resume, blur/visibility handlers, pointer controls and eight viewport sizes.
- `power-matrix.js` reads `?power=0` through `?power=4` from the current local page URL. It selects a deterministic power and uses browser request interception to shorten that isolated test course to 120 units. It checks an obstacle with/without protection, combat, physical crossing and replay. It never changes production source or the deployed course length.

The UI test dispatches browser blur/visibility events to verify the registered handlers. The original source project recorded separate full-length race and CDP touch-event tests; those historical checks are not verification of this consolidated site. A real phone and cross-browser testing remain outside the completed coverage.

# Working with the children’s games

- Lavie (לביא) created Hogwarts and Fortress Cannons; Ella (אלה) created jumping droplets and the princess race. Each independently describes their own games by voice to coding agents. Preserve each child’s intent and creator credit. Do not infer one child’s preferences from the other’s games.
- Ask short, clear questions in Hebrew when a child’s request needs clarification. Ask one concrete question at a time, with a simple example. Keep the conversation playful and understandable.
- Preserve Hebrew UI, `lang="he"`, right-to-left layout, accessibility labels, keyboard/pointer/touch controls, and existing features unless the child explicitly changes them.
- Keep child-approved rules distinct from developer-selected defaults. Consult `GLOSSARY.md` for each game’s vocabulary and `docs/third-game-design.md` for Fortress Cannons decisions; do not present implementation defaults as a child’s request.
- Edit authored assets in `public/`. Keep the family hub at `/`, Hogwarts at `/games/hogwarts/`, jumping droplets at `/games/droplets/`, Fortress Cannons at `/games/fortress-cannons/`, and the princess race at `/games/princess-race/`. Use relative, same-origin home/game links; retain both creator badges on the hub.

## Runtime and repository layout

- Use Node.js 26.12.0 from `.nvmrc`, managed with mise. Install with `npm ci`; `npm run dev` serves the site at `http://127.0.0.1:4173/` (override with `PORT`). The games use plain HTML, CSS, and JavaScript, without a game backend or database.
- Hogwarts and Fortress Cannons share the bundled Babylon.js runtime in `public/games/hogwarts/vendor/`. Preserve `BABYLON-LICENSE.md` and third-party attribution when changing or redistributing vendor assets. Public visibility does not establish a project-wide reuse license.
- Deterministic model and simulation tests live under `tests/<game>/`. Browser scenarios in `tests/hogwarts/browser/` and `tests/droplets/touch.browser.js` are separate from `npm test`; consult their instructions before running them. `docs/` contains design decisions and historical verification; `tests/princess-race/README.md` also records historical verification. Date new verification accurately instead of treating old results as current evidence.

## Screenshots and verification

- Keep real browser screenshots in `public/assets/`: `landing-page.png` for the hub, `hogwarts-race.png`, `jumping-droplets.png`, `fortress-cannons.png`, and `princess-race.png` for the games. Capture the running site in a browser; never present generated artwork or mockups as screenshots.
- Refresh the affected game screenshot whenever its visible UI or gameplay presentation changes. Inspect every capture for loaded content, readable Hebrew, correct layout, and a representative playable scene. Refresh again if the capture exposes a problem that requires a UI fix.
- Keep README screenshot links for the landing page and all four games current. Each hub card must use its corresponding game screenshot. After refreshing game screenshots or changing the cards or hub UI, capture and inspect `landing-page.png` last so it shows the final cards.
- Run `npm run check` and `npm test` after relevant changes. For visual or interaction changes, also inspect the affected game in a browser. Distinguish simulation tests, browser checks, and deployed verification.

## Privacy, publishing, and Git

- Never commit secrets, `.env*`, `.dev.vars*`, `.openai/`, `.local/`, or `.wrangler/` state. Do not publish or change another host while working on this site. Keep hosting credentials outside the repository.
- Preserve the children’s existing creator credits without adding personal details or changing repository visibility or access controls without authorization.
- The current host is `https://my-kids-inventing-games.hai-rozen.workers.dev/`, configured in `wrangler.jsonc` and serving `public/`. `npm run preview` uses Wrangler locally; `npm run deploy` runs checks and tests before deploying. GitHub pushes do not automatically deploy. For authorized deployment, target this configured Worker only and verify the live result separately. Use Wrangler OAuth login rather than committing or introducing API tokens.
- Read files before editing; work on a feature branch, never commit directly to main or staging. Keep changes focused on the child’s request.

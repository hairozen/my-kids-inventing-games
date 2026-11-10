# Working with the children’s games

- Lavie (לביא) is the creator of Hogwarts; Ella (אלה) is the creator of droplets. Each independently describes their own game by voice to coding agents. Preserve the child’s intent and creator credit. Do not infer one child’s preferences from the other’s game.
- Ask short, clear questions in Hebrew when a child’s request needs clarification. Ask one concrete question at a time, with a simple example. Keep the conversation playful and understandable.
- Preserve Hebrew UI, `lang="he"`, right-to-left layout, accessibility labels, keyboard/pointer/touch controls, and existing features unless the child explicitly changes them.
- Edit authored assets in `public/`. Keep the family hub at `/`, Hogwarts at `/games/hogwarts/`, and droplets at `/games/droplets/`. Use relative, same-origin home/game links; retain both creator badges on the hub.
- Run `npm run check` and `npm test` after relevant changes. For visual or interaction changes, also inspect the affected game in a browser. Distinguish simulation tests, browser checks, and deployed verification.
- Never commit secrets, `.env*`, `.dev.vars*`, `.openai/`, `.local/`, or `.wrangler/` state. Do not publish or change another host while working on this site. Keep hosting credentials outside the repository.
- Read files before editing; work on a feature branch, never commit directly to main or staging. Keep changes focused on the child’s request.

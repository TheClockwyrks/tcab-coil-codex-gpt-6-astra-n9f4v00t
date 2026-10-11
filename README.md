# Coil

A neon grid serpent about appetite, momentum, and finding the next clean turn.
Eat amber pellets, grow your mint-green coil, and chain quick pickups to reach a
five-times score multiplier. Walls and your own body end the run. Clear all 448
interior cells to win.

Requires Node.js 22.12+ and npm. Install with `npm ci`, then run `npm run dev`
and open the address Vite prints. For production, run `npm run build`. Serve the
resulting `dist/` directory on any static host, including beneath a URL sub-path.
`npm run preview` serves the production build locally.

- **Arrow keys / WASD:** steer; up and down select menu items.
- **Enter / Space:** confirm the selected item.
- **P / Escape:** pause; either resumes a paused round. Escape returns from menus.
- **M:** toggle sound on any screen.
- **Mouse / touch:** select and activate menu items. Touch also reveals the
  engine's directional pad and action buttons.
- **Backtick:** toggle the diagnostic overlay.

The snake moves eight cells per second. Two turns can be queued; only right-angle
turns take effect. Each pellet refreshes a 3.5-second combo window. The session's
best score carries between rounds; nothing is stored between visits.

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` check the
source and simulation. Tests cover fixed-step timing, turn queues, collisions,
growth, combo expiry, the full-board win, menus, pointer input, debug poses, and
render purity. `src/game.ts` exports the game and its state/debug types; the
engine owns input, audio, drawing capture, and frame scheduling.

All art and sound are original, committed assets. `tools/produce-assets.py`
records the one-time authoring recipe using `draw`, `draw-sheet`, `sfx-synth`, and
`music`. Those tools are **not required to install, build, or play**. Vite copies
`public/assets` (a link to the committed `assets/` directory) into the standalone
bundle. Pixel sprites have four bite frames and connected straight, corner, and
tail pieces. Audio includes three event cues and an eight-second sequenced loop.

The `showcase/` directory contains the player description, screenshots, and a
six-second engine-recorded combo run. With the dev server running,
`node tools/capture.mjs` reproduces those captures using project-local Playwright.

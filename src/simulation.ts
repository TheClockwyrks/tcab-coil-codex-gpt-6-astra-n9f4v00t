import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { copy, items, menuRect, spawn, same, interior } from "./model";
import type { CoilState, State } from "./model";
const vector: Record<C.Direction, C.Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};
function go(s: CoilState, screen: C.Screen) {
  s.screen = screen;
  s.menuIndex = screen === "title" ? s.titleIndex : 0;
  s.contacts = {};
}
function begin(s: CoilState, api: UpdateApi) {
  s.snake = C.START_CELLS.map((p) => ({ ...p }));
  s.dir = C.START_DIR;
  s.turns = [];
  s.obstacles = [...C.OBSTACLE_CELLS];
  s.pellet = null;
  s.score = 0;
  s.combo = 1;
  s.comboWindow = 0;
  s.accumulator = 0;
  s.biteAt = -100;
  s.burst = null;
  go(s, "playing");
  spawn(s);
  api.audio.loop(C.CUES.music);
}
function confirm(s: CoilState, api: UpdateApi) {
  const i = s.menuIndex;
  switch (s.screen) {
    case "title":
      s.titleIndex = i;
      if (i === 0) begin(s, api);
      else go(s, "howto");
      break;
    case "howto":
      go(s, "title");
      break;
    case "paused":
      if (i === 0) go(s, "playing");
      else if (i === 1) begin(s, api);
      else go(s, "title");
      break;
    case "gameover":
    case "cleared":
      if (i === 0) begin(s, api);
      else go(s, "title");
      break;
  }
}
function tick(s: CoilState, api: UpdateApi) {
  // A fatal tick still counts, but returns before growth and window decay.
  s.ticks++;
  const turn = s.steering ? s.turns.shift() : undefined;
  if (turn && (vector[turn].col === 0) !== (vector[s.dir].col === 0))
    s.dir = turn;
  if (s.travel) {
    const h = s.snake[0],
      v = vector[s.dir],
      head = { col: h.col + v.col, row: h.row + v.row };
    const eat = s.pellet !== null && same(s.pellet, head);
    if (
      !interior(head) ||
      s.obstacles.some((p) => same(p, head)) ||
      // The tail is safe only when it will vacate this tick.
      s.snake.slice(0, eat ? undefined : -1).some((p) => same(p, head))
    ) {
      go(s, "gameover");
      api.audio.play(C.CUES.death);
      return;
    }
    s.snake.unshift(head);
    if (!eat) s.snake.pop();
    if (eat) {
      const old = s.combo;
      s.combo = s.comboWindow > 0 ? Math.min(C.COMBO_MAX, s.combo + 1) : 1;
      s.score += C.PELLET_POINTS * s.combo;
      s.best = Math.max(s.best, s.score);
      s.comboWindow = C.COMBO_WINDOW;
      s.biteAt = s.simTime - s.accumulator;
      s.burst = { ...head };
      api.audio.play(C.CUES.eat);
      if (s.combo > old) api.audio.play(C.CUES.comboUp);
      if (s.pelletRespawn) spawn(s);
      else s.pellet = null;
    }
  }
  s.comboWindow = Math.max(0, s.comboWindow - C.TICK_SECONDS);
  if (s.comboWindow === 0) s.combo = 1;
}
export function update(state: State, api: UpdateApi, dt: number): CoilState {
  const s = copy(state);
  s.best = Math.max(s.best, s.score);
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  if (edges.mute) api.audio.setMuted(!api.audio.muted());
  s.muted = api.audio.muted();
  if (s.screen === "playing") {
    if (edges.back || edges.pause) go(s, "paused");
    else if (s.steering)
      for (const d of C.DIRECTIONS)
        if (edges[d] && s.turns.length < C.TURN_QUEUE_MAX) s.turns.push(d);
  } else {
    const count = items(s.screen).length;
    if (edges.up) s.menuIndex = (s.menuIndex + count - 1) % count;
    if (edges.down) s.menuIndex = (s.menuIndex + 1) % count;
    if (edges.back || (edges.pause && s.screen === "paused")) {
      if (s.screen === "paused") go(s, "playing");
      else if (s.screen !== "title") go(s, "title");
    } else if (edges.confirm) confirm(s, api);
  }
  for (const sample of samples) {
    if (s.screen === "playing") break;
    const i = items(s.screen).findIndex((_, idx) => {
      const r = menuRect(s, idx)!;
      return (
        sample.x >= r.x &&
        sample.x < r.x + r.w &&
        sample.y >= r.y &&
        sample.y < r.y + r.h
      );
    });
    if (i >= 0) s.menuIndex = i;
    if (sample.type === "down")
      s.contacts[sample.id] = { screen: s.screen, index: i };
    if (sample.type === "up") {
      const pressed = s.contacts[sample.id];
      delete s.contacts[sample.id];
      if (i >= 0 && pressed?.index === i && pressed.screen === s.screen)
        confirm(s, api);
    }
  }
  if (s.screen === "playing") {
    s.simTime += dt;
    s.accumulator += dt;
    while (s.accumulator + 1e-10 >= C.TICK_SECONDS && s.screen === "playing") {
      s.accumulator = Math.max(0, s.accumulator - C.TICK_SECONDS);
      tick(s, api);
    }
    if (s.screen !== "playing") s.accumulator = 0;
  }
  s.best = Math.max(s.best, s.score);
  if (s.screen !== "playing" && s.screen !== "paused")
    api.audio.stop(C.CUES.music);
  return s;
}

import * as C from "./constants";
import {
  copy,
  opening,
  items,
  menuRect,
  interior,
  same,
  drawPelletCell,
} from "./model";
import type { State, CoilState, Snapshot } from "./model";
function requireValue(ok: boolean): void {
  if (!ok) throw new RangeError("Invalid Coil debug pose");
}
function integer(n: number, max = Infinity, min = 0) {
  requireValue(Number.isInteger(n) && n >= min && n <= max);
}
function patch(s: State, p: Partial<CoilState>): CoilState {
  return { ...copy(s), ...p };
}
function flag(
  s: State,
  key: "steering" | "travel" | "pelletRespawn",
  enabled: boolean,
): CoilState {
  requireValue(typeof enabled === "boolean");
  return patch(s, {
    [key]: enabled,
    ...(key === "steering" && !enabled ? { turns: [] } : {}),
  });
}
export const debug = {
  version: C.COIL_DEBUG_VERSION,
  reset: (s: State) => opening(copy(s).sprites, s.muted),
  reconcile: copy,
  snapshot(s: State): Snapshot {
    const {
      version,
      screen,
      menuIndex,
      titleIndex,
      mode,
      score,
      best,
      combo,
      comboWindow,
      muted,
      ticks,
      simTime,
      dir,
      turns,
      snake,
      pellet,
      obstacles,
      steering,
      travel,
      pelletRespawn,
      nextPellet,
    } = copy(s);
    return {
      version,
      screen,
      menuIndex,
      titleIndex,
      mode,
      score,
      best,
      combo,
      comboWindow,
      muted,
      ticks,
      simTime,
      dir,
      turns,
      snake,
      pellet: pellet ? { ...pellet } : null,
      obstacles,
      steering,
      travel,
      pelletRespawn,
      nextPellet: nextPellet ? { ...nextPellet } : null,
    };
  },
  menuItemRect: menuRect,
  setScreen(s: State, screen: C.Screen) {
    requireValue(C.SCREENS.includes(screen));
    return patch(s, { screen });
  },
  setMenuIndex(s: State, menuIndex: number) {
    integer(menuIndex, Math.max(0, items(s.screen).length - 1));
    return patch(s, { menuIndex });
  },
  setScore(s: State, score: number) {
    integer(score);
    return patch(s, { score });
  },
  setBest(s: State, best: number) {
    integer(best);
    return patch(s, { best });
  },
  setCombo(s: State, combo: number) {
    integer(combo, C.COMBO_MAX, 1);
    return patch(s, { combo });
  },
  setComboWindow(s: State, comboWindow: number) {
    requireValue(
      Number.isFinite(comboWindow) &&
        comboWindow >= 0 &&
        comboWindow <= C.COMBO_WINDOW,
    );
    return patch(s, { comboWindow });
  },
  setSnake(s: State, cells: readonly C.Cell[]) {
    requireValue(Array.isArray(cells) && cells.length > 0);
    const seen = new Set<string>();
    cells.forEach((p, i) => {
      requireValue(
        interior(p) &&
          !s.obstacles.some((o) => same(o, p)) &&
          !seen.has(`${p.col},${p.row}`),
      );
      if (i)
        requireValue(
          Math.abs(p.col - cells[i - 1].col) +
            Math.abs(p.row - cells[i - 1].row) ===
            1,
        );
      seen.add(`${p.col},${p.row}`);
    });
    return patch(s, { snake: cells.map((p) => ({ ...p })) });
  },
  setDirection(s: State, dir: C.Direction) {
    requireValue(C.DIRECTIONS.includes(dir));
    return patch(s, { dir });
  },
  clearTurns: (s: State) => patch(s, { turns: [] }),
  setSnakeSteering: (s: State, on: boolean) => flag(s, "steering", on),
  setSnakeTravel: (s: State, on: boolean) => flag(s, "travel", on),
  setPelletRespawn: (s: State, on: boolean) => flag(s, "pelletRespawn", on),
  setPellet(s: State, col: number, row: number) {
    const pellet = { col, row };
    requireValue(
      interior(pellet) &&
        ![...s.snake, ...s.obstacles].some((p) => same(p, pellet)),
    );
    return patch(s, { pellet });
  },
  clearPellet: (s: State) => patch(s, { pellet: null }),
  setNextPellet(s: State, col: number, row: number) {
    integer(col, C.GRID_COLS - 1);
    integer(row, C.GRID_ROWS - 1);
    return patch(s, { nextPellet: { col, row } });
  },
  drawPelletCell,
};
export type CoilDebugApi = typeof debug;

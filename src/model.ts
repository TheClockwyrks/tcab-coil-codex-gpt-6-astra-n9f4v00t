import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";

export interface Snapshot {
  version: number;
  screen: C.Screen;
  menuIndex: number;
  titleIndex: number;
  mode: typeof C.MODE;
  score: number;
  best: number;
  combo: number;
  comboWindow: number;
  muted: boolean;
  ticks: number;
  simTime: number;
  dir: C.Direction;
  turns: C.Direction[];
  snake: C.Cell[];
  pellet: C.Cell | null;
  obstacles: C.Cell[];
  steering: boolean;
  travel: boolean;
  pelletRespawn: boolean;
  nextPellet: C.Cell | null;
}
export interface CoilState extends Snapshot {
  accumulator: number;
  biteAt: number;
  burst: C.Cell | null;
  contacts: Record<number, { screen: C.Screen; index: number }>;
  sprites: {
    head: ImageBitmap[];
    body: ImageBitmap;
    corner: ImageBitmap;
    tail: ImageBitmap;
  };
}
export type State = DeepReadonly<CoilState>;
export const same = (a: C.Cell, b: C.Cell) =>
  a.col === b.col && a.row === b.row;
export const interior = (p: C.Cell) =>
  Number.isInteger(p.col) &&
  Number.isInteger(p.row) &&
  p.col >= C.INTERIOR_MIN_COL &&
  p.col <= C.INTERIOR_MAX_COL &&
  p.row >= C.INTERIOR_MIN_ROW &&
  p.row <= C.INTERIOR_MAX_ROW;
export function copy(s: State): CoilState {
  return {
    ...s,
    snake: s.snake.map((p) => ({ ...p })),
    obstacles: s.obstacles.map((p) => ({ ...p })),
    turns: [...s.turns],
    contacts: { ...s.contacts },
    sprites: { ...s.sprites, head: [...s.sprites.head] },
  };
}
export function opening(
  sprites: CoilState["sprites"],
  muted = false,
): CoilState {
  return {
    version: C.COIL_DEBUG_VERSION,
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    mode: C.MODE,
    score: 0,
    best: 0,
    combo: 1,
    comboWindow: 0,
    muted,
    ticks: 0,
    simTime: 0,
    dir: C.START_DIR,
    turns: [],
    snake: C.START_CELLS.map((p) => ({ ...p })),
    pellet: null,
    obstacles: [],
    steering: true,
    travel: true,
    pelletRespawn: true,
    nextPellet: null,
    accumulator: 0,
    biteAt: -100,
    burst: null,
    contacts: {},
    sprites,
  };
}
export function items(screen: C.Screen): readonly string[] {
  switch (screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "howto":
      return ["BACK"];
    case "paused":
      return C.PAUSE_ITEMS;
    case "gameover":
    case "cleared":
      return C.OVER_ITEMS;
    default:
      return [];
  }
}
export function menuRect(s: State, index: number) {
  if (!Number.isInteger(index) || index < 0)
    throw new RangeError("Invalid menu index");
  if (index >= items(s.screen).length) return null;
  return {
    x: s.screen === "title" ? 240 : 470,
    y:
      (s.screen === "title" ? 440 : s.screen === "howto" ? 581 : 415) +
      index * 60,
    w: 340,
    h: 48,
  };
}
export function validCells(s: State): C.Cell[] {
  const occupied = new Set(
    [...s.snake, ...s.obstacles, ...(s.pellet ? [s.pellet] : [])].map(
      (p) => `${p.col},${p.row}`,
    ),
  );
  const cells: C.Cell[] = [];
  for (let row = C.INTERIOR_MIN_ROW; row <= C.INTERIOR_MAX_ROW; row++)
    for (let col = C.INTERIOR_MIN_COL; col <= C.INTERIOR_MAX_COL; col++)
      if (!occupied.has(`${col},${row}`)) cells.push({ col, row });
  return cells;
}
export function drawPelletCell(s: State): C.Cell | null {
  const cells = validCells(s);
  return cells[Math.floor(Math.random() * cells.length)] ?? null;
}
export function spawn(s: CoilState): void {
  const cells = validCells(s);
  s.pellet =
    (s.nextPellet && cells.find((p) => same(p, s.nextPellet!))) ||
    cells[Math.floor(Math.random() * cells.length)] ||
    null;
  s.nextPellet = null;
  if (!s.pellet) {
    s.screen = "cleared";
    s.menuIndex = 0;
  }
}

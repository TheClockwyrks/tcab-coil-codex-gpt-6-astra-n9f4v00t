import { describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import type {
  InitApi,
  UpdateApi,
  PointerSample,
  RenderApi,
} from "@clockwyrks/simple-2d";
import { game, type CoilState } from "./game";
import { debug } from "./debug";
import { update } from "./simulation";
import { render } from "./render";
import { copy, opening, validCells } from "./model";
import * as C from "./constants";

async function harness() {
  const cues: string[] = [],
    loops = new Set<string>();
  let muted = false;
  const diagnostics = new Map<string, (s: CoilState) => unknown>();
  const initial = {
    input: { register: vi.fn() },
    audio: { load: vi.fn() },
    assets: { loadImage: async (p: string) => await loadImage(`assets/${p}`) },
    diagnostics: {
      register: (n: string, fn: (s: CoilState) => unknown) =>
        diagnostics.set(n, fn),
    },
  } as unknown as InitApi<CoilState>;
  const [state, surface] = await game.initialize(initial);
  let keys: string[] = [],
    samples: PointerSample[] = [];
  const api = {
    input: {
      pressed: (k: string) => keys.includes(k),
      pointerSamples: () => samples,
    },
    audio: {
      play: (c: string) => cues.push(c),
      loop: (c: string) => loops.add(c),
      stop: (c: string) => loops.delete(c),
      muted: () => muted,
      setMuted: (m: boolean) => {
        muted = m;
      },
    },
  } as unknown as UpdateApi;
  return {
    state,
    surface,
    cues,
    loops,
    diagnostics,
    step(
      s: CoilState,
      dt = 0,
      actions: string[] = [],
      p: PointerSample[] = [],
    ) {
      keys = actions;
      samples = p;
      return update(s, api, dt);
    },
  };
}
function sample(
  type: PointerSample["type"],
  x: number,
  y: number,
  id = 1,
): PointerSample {
  return {
    type,
    x,
    y,
    id,
    primary: true,
    device: "touch",
    button: "primary",
    buttons: type === "up" ? [] : ["primary"],
  };
}

describe("Coil simulation", () => {
  it("initializes all assets, debug readings and fresh session values", async () => {
    const h = await harness();
    expect(h.surface).toBe(debug);
    expect(debug.snapshot(h.state)).toMatchObject({
      screen: "title",
      score: 0,
      best: 0,
      combo: 1,
      ticks: 0,
      simTime: 0,
      pellet: null,
      obstacles: [],
      turns: [],
      nextPellet: null,
    });
    expect([...h.diagnostics.keys()]).toHaveLength(9);
    for (const source of h.diagnostics.values())
      expect(source(h.state)).toBeDefined();
  });
  it("uses the accumulator independently of frame subdivision and preserves its input", async () => {
    const h = await harness();
    const s = h.step(h.state, 0, ["confirm"]);
    const before = debug.snapshot(s);
    const single = h.step(s, 1);
    let split = s;
    for (let i = 0; i < 100; i++) split = h.step(split, 0.01);
    expect(single.snake).toEqual(split.snake);
    expect(split.ticks).toBe(8);
    expect(split.accumulator).toBeCloseTo(0);
    expect(debug.snapshot(s)).toEqual(before);
  });
  it("buffers two requests, rejects reversal at consumption, and turns at most once per tick", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["confirm"]);
    s = h.step(s, 0, ["down"]);
    s = h.step(s, 0, ["left"]);
    s = h.step(s, 0, ["up"]);
    expect(s.turns).toEqual(["down", "left"]);
    s = h.step(s, 0.125);
    expect(s.dir).toBe("down");
    s = h.step(s, 0.125);
    expect(s.dir).toBe("left");
    s = h.step(s, 0.125, ["right"]);
    expect(s.dir).toBe("left");
    s = h.step(s, 0.125, ["left"]);
    expect(s.dir).toBe("left");
  });
  it("scores, grows, caps combos, consumes spawn poses and emits distinct cues", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["confirm"]);
    for (let i = 0; i < 6; i++) {
      s = debug.setPellet(s, s.snake[0].col + 1, s.snake[0].row);
      s = debug.setNextPellet(s, 2 + i, 2);
      s = h.step(s, 0.125);
      expect(s.nextPellet).toBeNull();
      expect(s.pellet).toEqual({ col: 2 + i, row: 2 });
    }
    expect(s.score).toBe(200);
    expect(s.best).toBe(200);
    expect(s.combo).toBe(5);
    expect(s.snake).toHaveLength(9);
    expect(s.comboWindow).toBe(3.375);
    expect(h.cues.filter((c) => c === "eat")).toHaveLength(6);
    expect(h.cues.filter((c) => c === "combo-up")).toHaveLength(4);
  });
  it("expires the window on exactly its 28th tick even with travel disabled", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["confirm"]);
    s = debug.setSnakeTravel(s, false);
    s = debug.setCombo(s, 5);
    s = debug.setComboWindow(s, 3.5);
    s = h.step(s, 27 * 0.125);
    expect(s.combo).toBe(5);
    expect(s.comboWindow).toBe(0.125);
    s = h.step(s, 0.125);
    expect(s.combo).toBe(1);
    expect(s.comboWindow).toBe(0);
  });
  it("holds all round timing while paused and resumes with its remainder", async () => {
    const h = await harness();
    let s = h.step(h.state, 0.06, ["confirm"]);
    s = h.step(s, 0, ["pause"]);
    const snap = debug.snapshot(s);
    s = h.step(s, 20);
    expect(debug.snapshot(s)).toEqual(snap);
    expect(h.loops.has("music")).toBe(true);
    s = h.step(s, 0.065, ["back"]);
    expect(s.ticks).toBe(1);
    expect(s.screen).toBe("playing");
  });
  it("ends on a wall without moving the chain or draining combo; discards excess time", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["confirm"]);
    s = debug.setSnake(s, [{ col: 28, row: 8 }]);
    s = debug.setComboWindow(s, 2);
    const old = s.snake;
    s = h.step(s, 2);
    expect(s.screen).toBe("gameover");
    expect(s.snake).toEqual(old);
    expect(s.comboWindow).toBe(2);
    expect(s.ticks).toBe(1);
    expect(s.accumulator).toBe(0);
    expect(h.cues).toEqual(["death"]);
    expect(h.loops.size).toBe(0);
    s = debug.setScreen(s, "playing");
    s = h.step(s, 0);
    expect(s.screen).toBe("playing");
    expect(s.ticks).toBe(1);
  });
  it("allows the vacating tail but rejects a growing tail and body collision", async () => {
    const h = await harness();
    let s = debug.setScreen(h.state, "playing");
    s = debug.setSnake(s, [
      { col: 3, row: 3 },
      { col: 3, row: 4 },
      { col: 2, row: 4 },
      { col: 2, row: 3 },
    ]);
    s = debug.setDirection(s, "left");
    expect(h.step(s, 0.125).screen).toBe("playing");
    expect(h.step({ ...s, pellet: { col: 2, row: 3 } }, 0.125).screen).toBe(
      "gameover",
    );
    expect(h.step(debug.setDirection(s, "down"), 0.125).screen).toBe(
      "gameover",
    );
    expect(
      h.step({ ...s, obstacles: [{ col: 2, row: 3 }] }, 0.125).screen,
    ).toBe("gameover");
  });
  it("keeps driver switches independent and holds a posed spawn while respawn is off", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["confirm"]);
    s = h.step(s, 0, ["up"]);
    s = debug.setSnakeSteering(s, false);
    expect(s.turns).toEqual([]);
    s = h.step(s, 0, ["left"]);
    expect(s.turns).toEqual([]);
    s = debug.setPelletRespawn(s, false);
    s = debug.setNextPellet(s, 5, 5);
    s = debug.setPellet(s, 16, 8);
    s = h.step(s, 0.125);
    expect(s.pellet).toBeNull();
    expect(s.nextPellet).toEqual({ col: 5, row: 5 });
    s = debug.setSnakeSteering(s, true);
    s = debug.setSnakeTravel(s, false);
    const chain = s.snake;
    s = h.step(s, 0.125, ["up"]);
    expect(s.dir).toBe("up");
    expect(s.snake).toEqual(chain);
  });
  it("wins when the last available cell is eaten", async () => {
    const h = await harness();
    let s = debug.setScreen(h.state, "playing");
    const cells: C.Cell[] = [];
    for (let row = 1; row <= 16; row++)
      for (let i = 0; i < 28; i++)
        cells.push({ col: row % 2 ? i + 1 : 28 - i, row });
    s = debug.setSnake(s, cells.slice(1));
    s = debug.setDirection(s, "left");
    s = debug.setPellet(s, 1, 1);
    s = debug.setNextPellet(s, 1, 1);
    s = h.step(s, 0.125);
    expect(s.screen).toBe("cleared");
    expect(s.snake).toHaveLength(448);
    expect(s.pellet).toBeNull();
    expect(s.nextPellet).toBeNull();
    expect(s.score).toBe(10);
  });
  it("draws only valid cells, excludes the old pellet and ignores invalid spawn poses", async () => {
    const h = await harness();
    let s = debug.setPellet(h.state, 1, 1);
    s = { ...s, obstacles: [{ col: 2, row: 2 }] };
    const valid = validCells(s);
    for (let i = 0; i < 100; i++)
      expect(valid).toContainEqual(debug.drawPelletCell(s));
    s = debug.setNextPellet(s, 0, 0);
    s = h.step(s, 0, ["confirm"]);
    expect(s.nextPellet).toBeNull();
    expect(s.pellet?.col).toBeGreaterThan(0);
  });
});
describe("menus and debug poses", () => {
  it("remembers title selection through how-to, supports wrapping and mute everywhere", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["up"]);
    expect(s.menuIndex).toBe(1);
    s = h.step(s, 0, ["confirm"]);
    expect(s.screen).toBe("howto");
    expect(s.titleIndex).toBe(1);
    s = h.step(s, 0, ["mute"]);
    expect(s.muted).toBe(true);
    s = h.step(s, 0, ["back"]);
    expect(s.menuIndex).toBe(1);
    s = h.step(s, 0, ["down"]);
    expect(s.menuIndex).toBe(0);
    s = h.step(s, 0, ["back"]);
    expect(s.screen).toBe("title");
  });
  it("restarts and exits from pause and both endings", async () => {
    const h = await harness();
    let s = h.step(h.state, 0, ["confirm"]);
    s = debug.setScore(s, 100);
    s = h.step(s, 0, ["pause"]);
    s = debug.setMenuIndex(s, 1);
    s = h.step(s, 0, ["confirm"]);
    expect(s.score).toBe(0);
    expect(s.best).toBe(100);
    s = h.step(s, 0, ["pause"]);
    s = debug.setMenuIndex(s, 2);
    s = h.step(s, 0, ["confirm"]);
    expect(s.screen).toBe("title");
    for (const screen of ["gameover", "cleared"] as const) {
      s = debug.setScreen(s, screen);
      s = debug.setMenuIndex(s, 0);
      s = h.step(s, 0, ["confirm"]);
      expect(s.screen).toBe("playing");
      s = debug.setScreen(s, screen);
      s = debug.setMenuIndex(s, 1);
      s = h.step(s, 0, ["confirm"]);
      expect(s.screen).toBe("title");
    }
  });
  it("processes same-frame pointer edges and refuses mismatched press/release", async () => {
    const h = await harness();
    const r = debug.menuItemRect(h.state, 1)!;
    let s = h.step(
      h.state,
      0,
      [],
      [sample("down", r.x + 4, r.y + 4), sample("up", r.x + 4, r.y + 4)],
    );
    expect(s.screen).toBe("howto");
    s = h.step(s, 0, ["back"]);
    const a = debug.menuItemRect(s, 0)!;
    s = h.step(
      s,
      0,
      [],
      [sample("down", a.x + 4, a.y + 4), sample("up", r.x + 4, r.y + 4)],
    );
    expect(s.screen).toBe("title");
    expect(s.menuIndex).toBe(1);
    s = h.step(
      s,
      0,
      [],
      [sample("down", 0, 0), sample("up", a.x + 4, a.y + 4)],
    );
    expect(s.screen).toBe("title");
    s = h.step(s, 0, [], [sample("down", a.x + 4, a.y + 4)]);
    s = h.step(s, 0, [], [sample("up", a.x + 4, a.y + 4)]);
    expect(s.screen).toBe("playing");
  });
  it("poses without side effects, reconciles purely and resets all transient state", async () => {
    const h = await harness();
    let s = debug.setScore(h.state, 400);
    expect(s.best).toBe(0);
    expect(debug.reconcile(s)).toEqual(s);
    s = h.step(s);
    expect(s.best).toBe(400);
    s = debug.setBest(s, 1);
    s = h.step(s);
    expect(s.best).toBe(400);
    s = debug.clearPellet(s);
    s = debug.clearTurns(s);
    s = h.step(s, 0, ["mute"]);
    s = debug.reset(s);
    expect(s.muted).toBe(true);
    expect({ ...s, sprites: null }).toEqual({
      ...opening(s.sprites, true),
      sprites: null,
    });
    expect(debug.menuItemRect(s, 99)).toBeNull();
    expect(debug.menuItemRect(debug.setScreen(s, "playing"), 0)).toBeNull();
    const snap = debug.snapshot(s);
    snap.snake[0] = { col: 1, row: 1 };
    expect(s.snake[0]).toEqual(C.START_CELLS[0]);
  });
  it("rejects undefined poses loudly", async () => {
    const { state: s } = await harness();
    for (const n of [-1, NaN, Infinity, 1.2]) {
      expect(() => debug.setScore(s, n)).toThrow();
      expect(() => debug.setBest(s, n)).toThrow();
    }
    expect(() => debug.setCombo(s, 6)).toThrow();
    expect(() => debug.setComboWindow(s, 4)).toThrow();
    expect(() => debug.setMenuIndex(s, 2)).toThrow();
    expect(() => debug.menuItemRect(s, -1)).toThrow();
    expect(() => debug.setScreen(s, "bad" as C.Screen)).toThrow();
    expect(() => debug.setDirection(s, "bad" as C.Direction)).toThrow();
    expect(() => debug.setNextPellet(s, 30, 2)).toThrow();
    expect(() => debug.setPellet(s, 15, 8)).toThrow();
    expect(() => debug.setSnake(s, [])).toThrow();
    expect(() =>
      debug.setSnake(s, [
        { col: 1, row: 1 },
        { col: 3, row: 1 },
      ]),
    ).toThrow();
    expect(() => debug.setSnake(s, [{ col: 0, row: 1 }])).toThrow();
    expect(() => debug.setSnakeTravel(s, 1 as unknown as boolean)).toThrow();
  });
  it("draws all screens from real sprites without mutating state", async () => {
    const h = await harness();
    const canvas = createCanvas(1280, 720);
    const api = { ctx: canvas.getContext("2d") } as unknown as RenderApi;
    for (const screen of C.SCREENS) {
      const s = {
        ...copy(h.state),
        screen,
        combo: 3,
        comboWindow: 2,
        pellet: { col: 22, row: 10 },
        burst: { col: 15, row: 8 },
        biteAt: 0,
      };
      const snapshot = debug.snapshot(s);
      render(s, api);
      expect(debug.snapshot(s)).toEqual(snapshot);
    }
    expect(canvas.toBuffer("image/png").byteLength).toBeGreaterThan(10000);
  });
});

import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { opening } from "./model";
import type { CoilState } from "./model";
import { debug } from "./debug";
import type { CoilDebugApi } from "./debug";
import { update } from "./simulation";
import { render } from "./render";
export type { CoilState, CoilDebugApi };
export const BACKGROUND = "#080f18";
export const game: Game<CoilState, CoilDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const [head, body, corner, tail] = await Promise.all([
      Promise.all(C.SPRITE_PATHS.head.map((p) => api.assets.loadImage(p))),
      api.assets.loadImage(C.SPRITE_PATHS.body),
      api.assets.loadImage(C.SPRITE_PATHS.corner),
      api.assets.loadImage(C.SPRITE_PATHS.tail),
      ...Object.values(C.CUES).map((cue) =>
        api.audio.load(cue, C.CUE_PATHS[cue]),
      ),
    ]);
    for (const key of [
      "screen",
      "score",
      "best",
      "combo",
      "comboWindow",
      "dir",
    ] as const)
      api.diagnostics.register(key, (s) => s[key]);
    api.diagnostics.register("length", (s) => s.snake.length);
    api.diagnostics.register(
      "head",
      (s) => `${s.snake[0].col}, ${s.snake[0].row}`,
    );
    api.diagnostics.register("pellet", (s) =>
      s.pellet ? `${s.pellet.col}, ${s.pellet.row}` : "none",
    );
    return [opening({ head, body, corner, tail }), debug];
  },
  update,
  render,
};

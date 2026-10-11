import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { State } from "./model";
import { items, menuRect } from "./model";
const mint = "#a7f9c7",
  muted = "#6c8790",
  white = "#e1f0e8",
  amber = "#ffbf69";
type Context = RenderApi["ctx"];
function text(
  ctx: Context,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = white,
  align: CanvasTextAlign = "left",
  weight = 500,
) {
  ctx.font = `${weight} ${size}px ${size >= 48 ? '"Arial Black", Arial' : '"Courier New", monospace'}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function line(
  ctx: Context,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function sprite(
  ctx: Context,
  image: ImageBitmap,
  col: number,
  row: number,
  rotation: number,
) {
  ctx.save();
  ctx.translate(
    C.BOARD_X + col * C.CELL + C.CELL / 2,
    C.BOARD_Y + row * C.CELL + C.CELL / 2,
  );
  ctx.rotate((rotation * Math.PI) / 2);
  ctx.drawImage(image, -C.CELL / 2, -C.CELL / 2, C.CELL, C.CELL);
  ctx.restore();
}
function bearing(a: C.Cell, b: C.Cell) {
  return b.col > a.col ? 0 : b.row > a.row ? 1 : b.col < a.col ? 2 : 3;
}
function snake(
  ctx: Context,
  s: State,
  cells: readonly C.Cell[] = s.snake,
  dir: C.Direction = s.dir,
) {
  cells.forEach((p, i) => {
    if (i === 0) {
      const elapsed = s.simTime - s.biteAt;
      const frame =
        elapsed >= 0 && elapsed < C.BITE_SECONDS
          ? Math.min(
              C.HEAD_FRAMES - 1,
              1 + Math.floor(elapsed / (C.BITE_SECONDS / (C.HEAD_FRAMES - 1))),
            )
          : 0;
      sprite(
        ctx,
        s.sprites.head[frame],
        p.col,
        p.row,
        { right: 0, down: 1, left: 2, up: 3 }[dir],
      );
    } else if (i === cells.length - 1)
      sprite(ctx, s.sprites.tail, p.col, p.row, bearing(p, cells[i - 1]));
    else {
      const a = bearing(p, cells[i - 1]),
        b = bearing(p, cells[i + 1]);
      if ((a + 2) % 4 === b) sprite(ctx, s.sprites.body, p.col, p.row, a);
      else {
        const rotation =
          [0, 1, 2, 3].find(
            (r) =>
              (a === r && b === (r + 1) % 4) || (b === r && a === (r + 1) % 4),
          ) ?? 0;
        sprite(ctx, s.sprites.corner, p.col, p.row, rotation);
      }
    }
  });
}
function board(ctx: Context, s: State) {
  ctx.fillStyle = "#0b1921";
  ctx.fillRect(
    C.BOARD_X,
    C.BOARD_Y,
    C.GRID_COLS * C.CELL,
    C.GRID_ROWS * C.CELL,
  );
  for (let r = 0; r < C.GRID_ROWS; r++)
    for (let c = 0; c < C.GRID_COLS; c++) {
      const x = C.BOARD_X + c * C.CELL,
        y = C.BOARD_Y + r * C.CELL,
        wall =
          r === 0 || c === 0 || r === C.GRID_ROWS - 1 || c === C.GRID_COLS - 1;
      if (wall) {
        ctx.fillStyle = "#162b33";
        ctx.fillRect(x + 1, y + 1, C.CELL - 2, C.CELL - 2);
        line(ctx, x + 5, y + 6, x + 26, y + 6, "#28434a");
        ctx.fillStyle = "#29494f";
        ctx.fillRect(x + 14, y + 19, 4, 2);
      } else {
        ctx.strokeStyle = "#14272f";
        ctx.strokeRect(x + 0.5, y + 0.5, C.CELL, C.CELL);
      }
    }
  ctx.strokeStyle = "#37665f";
  ctx.strokeRect(
    C.BOARD_X + 0.5,
    C.BOARD_Y + 0.5,
    C.GRID_COLS * C.CELL - 1,
    C.GRID_ROWS * C.CELL - 1,
  );
  ctx.strokeStyle = "#538b77";
  ctx.strokeRect(
    C.BOARD_X + C.CELL + 0.5,
    C.BOARD_Y + C.CELL + 0.5,
    (C.GRID_COLS - 2) * C.CELL - 1,
    (C.GRID_ROWS - 2) * C.CELL - 1,
  );
  for (const p of s.obstacles) {
    ctx.fillStyle = "#945566";
    ctx.fillRect(
      C.BOARD_X + p.col * C.CELL + 2,
      C.BOARD_Y + p.row * C.CELL + 2,
      28,
      28,
    );
  }
  if (s.pellet) {
    const x = C.BOARD_X + s.pellet.col * C.CELL + 16,
      y = C.BOARD_Y + s.pellet.row * C.CELL + 16;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = amber;
    ctx.shadowBlur = 16;
    ctx.fillStyle = amber;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff4c6";
    ctx.fillRect(-3, -5, 4, 6);
    ctx.strokeStyle = "#8d6845";
    ctx.strokeRect(-14, -14, 28, 28);
    ctx.restore();
  }
  snake(ctx, s);
  const age = s.simTime - s.biteAt;
  if (s.burst && age >= 0 && age < 0.45) {
    ctx.save();
    ctx.globalAlpha = 1 - age / 0.45;
    const x = C.BOARD_X + s.burst.col * C.CELL + 16,
      y = C.BOARD_Y + s.burst.row * C.CELL + 16;
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        d = 12 + age * 90;
      ctx.fillStyle = i % 2 ? mint : amber;
      ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 3, 3);
    }
    ctx.restore();
  }
}
function hud(ctx: Context, s: State) {
  text(ctx, C.TITLE_TEXT, 160, 61, 32, mint, "left", 900);
  text(ctx, "GRID / 01", 162, 84, 11, muted);
  text(ctx, C.SCORE_LABEL, 348, 39, 12, muted);
  text(ctx, String(s.score).padStart(4, "0"), 348, 79, 34, white);
  text(ctx, C.BEST_LABEL, 523, 39, 12, muted);
  text(ctx, String(s.best).padStart(4, "0"), 523, 79, 34, white);
  if (s.combo >= 2) {
    text(ctx, `x${s.combo}`, 708, 66, 32, amber);
    ctx.fillStyle = "#332d26";
    ctx.fillRect(708, 80, 144, 4);
    ctx.fillStyle = amber;
    ctx.fillRect(708, 80, (144 * s.comboWindow) / C.COMBO_WINDOW, 4);
  }
  text(ctx, C.MODE_LABEL, 930, 42, 14, mint);
  text(ctx, s.muted ? "M / SOUND OFF" : "M / SOUND ON", 930, 70, 12, muted);
  line(ctx, 160, 102, 1120, 102, "#243c43");
  text(ctx, "P / PAUSE", 32, 672, 11, muted);
  text(ctx, "08 HZ", 1150, 672, 11, muted);
}
function menus(ctx: Context, s: State) {
  items(s.screen).forEach((label, i) => {
    const r = menuRect(s, i)!,
      selected = i === s.menuIndex;
    ctx.fillStyle = selected ? mint : "#11242c";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = selected ? mint : "#2c4249";
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    text(
      ctx,
      selected ? "›" : "·",
      r.x + 18,
      r.y + 31,
      24,
      selected ? "#102a27" : muted,
    );
    text(
      ctx,
      label,
      r.x + 48,
      r.y + 30,
      17,
      selected ? "#102a27" : white,
      "left",
      700,
    );
    if (selected)
      text(ctx, "↵", r.x + r.w - 20, r.y + 30, 18, "#28534a", "right");
  });
}
export function render(s: State, { ctx }: RenderApi): void {
  ctx.imageSmoothingEnabled = false;
  const bg = ctx.createRadialGradient(700, 320, 40, 640, 360, 740);
  bg.addColorStop(0, "#13252c");
  bg.addColorStop(1, "#080f18");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
  hud(ctx, s);
  board(ctx, s);
  if (s.screen === "playing") return;
  ctx.fillStyle = s.screen === "title" ? "#080f18" : "rgba(8,15,24,.77)";
  ctx.fillRect(0, 110, C.STAGE_W, C.STAGE_H - 110);
  if (s.screen === "title") {
    text(ctx, "A GAME OF APPETITE & MOMENTUM", 240, 208, 12, muted);
    text(ctx, C.TITLE_TEXT, 232, 338, 142, mint, "left", 900);
    text(ctx, C.TAGLINE_TEXT, 242, 379, 21, white);
    line(ctx, 240, 405, 580, 405, "#33554f");
    // A static attract coil uses the actual authored cell sprites at native size.
    const cells: C.Cell[] = [];
    for (let col = 23; col >= 19; col--) cells.push({ col, row: 5 });
    for (let row = 6; row <= 11; row++) cells.push({ col: 19, row });
    for (let col = 20; col <= 25; col++) cells.push({ col, row: 11 });
    for (let row = 10; row >= 3; row--) cells.push({ col: 25, row });
    for (let col = 24; col >= 17; col--) cells.push({ col, row: 3 });
    for (let row = 4; row <= 13; row++) cells.push({ col: 17, row });
    ctx.strokeStyle = "#1f343a";
    for (let x = 672; x <= 1056; x += 32) line(ctx, x, 184, x, 600, "#1b2d33");
    for (let y = 184; y <= 600; y += 32) line(ctx, 672, y, 1056, y, "#1b2d33");
    snake(ctx, s, cells, "right");
    text(ctx, "EAT. TURN. REPEAT.", 848, 610, 13, muted, "center");
    text(ctx, "01 / CLASSIC", 240, 631, 11, muted);
    text(ctx, "ARROWS / WASD TO NAVIGATE", 240, 653, 11, muted);
  } else if (s.screen === "howto") {
    ctx.fillStyle = "#0c1a23";
    ctx.fillRect(280, 150, 720, 510);
    ctx.strokeStyle = "#34534f";
    ctx.strokeRect(280.5, 150.5, 720, 510);
    text(ctx, "FIELD GUIDE / 01", 320, 187, 12, mint);
    text(ctx, "HOW TO PLAY", 320, 237, 36, white, "left", 800);
    const rows = [
      [
        "KEEP MOVING",
        "The coil never stops. Your turn lands on the next tick.",
      ],
      ["TAKE THE CORNER", "Turn at right angles. You cannot double back."],
      ["FEED THE COIL", "Eat the amber pellet to grow one cell longer."],
      ["MIND THE EDGE", "Walls and your own body end the run."],
      [
        "CHASE THE COMBO",
        "Eat quickly to build x5. Wait too long and it drops to x1.",
      ],
    ];
    rows.forEach(([h, b], i) => {
      text(ctx, h, 320, 281 + i * 48, 12, mint);
      text(ctx, b, 320, 300 + i * 48, 13, white);
    });
    text(
      ctx,
      "ARROWS / WASD  steer    ENTER / SPACE  select",
      320,
      539,
      13,
      muted,
    );
    text(
      ctx,
      "P / ESC  pause or return    M  sound    ↑ ↓  menu",
      320,
      562,
      13,
      muted,
    );
  } else {
    ctx.fillStyle = "#0c1a23";
    ctx.fillRect(415, 213, 450, s.screen === "paused" ? 398 : 340);
    ctx.strokeStyle = "#3b5f56";
    ctx.strokeRect(415.5, 213.5, 450, s.screen === "paused" ? 398 : 340);
    text(
      ctx,
      s.screen === "paused" ? "SIGNAL HELD" : "ROUND COMPLETE",
      640,
      251,
      12,
      mint,
      "center",
    );
    text(
      ctx,
      s.screen === "paused"
        ? "PAUSED"
        : s.screen === "cleared"
          ? C.CLEARED_TEXT
          : C.GAMEOVER_TEXT,
      640,
      310,
      s.screen === "cleared" ? 35 : 42,
      white,
      "center",
      900,
    );
    if (s.screen === "paused")
      text(
        ctx,
        "Take a breath. The coil can wait.",
        640,
        361,
        14,
        muted,
        "center",
      );
    else {
      text(ctx, `${C.SCORE_LABEL}  ${s.score}`, 510, 369, 18, white);
      text(ctx, `${C.BEST_LABEL}  ${s.best}`, 755, 369, 18, mint, "right");
    }
  }
  menus(ctx, s);
}

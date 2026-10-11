/* global document, KeyboardEvent */
import { URL } from "node:url";
// Run with the development server running at localhost:5173.
import { chromium } from "playwright";
import { writeFile, unlink } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const temporary = new URL("../capture.html", import.meta.url);
await writeFile(
  temporary,
  '<body style="margin:0;background:#080f18"><canvas id="game" style="width:1280px;height:720px"></canvas></body>',
);
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  await page.goto("http://localhost:5173/capture.html");
  await page.waitForTimeout(700);
  // The engine stays local to the capture callback. The shipped page has no globals.
  const recording = await page.evaluate(async () => {
    const { createEngine, ConstantClock } =
      await import("/node_modules/@clockwyrks/simple-2d/dist/index.js");
    const { game, BACKGROUND } = await import("/src/game.ts");
    const engine = createEngine({
      canvas: document.querySelector("canvas"),
      width: 1280,
      height: 720,
      game,
      background: BACKGROUND,
      clock: new ConstantClock(1000 / 32),
      layout: "dpad-4",
    });
    await engine.initialize();
    const d = engine.debug;
    const cells = [];
    for (let col = 8; col >= 4; col--) cells.push({ col, row: 5 });
    for (let row = 6; row <= 12; row++) cells.push({ col: 4, row });
    for (let col = 5; col <= 17; col++) cells.push({ col, row: 12 });
    engine.apply((s) => d.setSnake(s, cells));
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setScore(s, 120));
    engine.apply((s) => d.setCombo(s, 2));
    engine.apply((s) => d.setComboWindow(s, 3.5));
    const key = (code) => {
      document.dispatchEvent(new KeyboardEvent("keydown", { code }));
      document.dispatchEvent(new KeyboardEvent("keyup", { code }));
    };
    const route = [];
    let col = 8,
      row = 5;
    for (let i = 0; i < 51; i++) {
      if (i < 18) col++;
      else if (i < 26) row++;
      else col--;
      route.push({ col, row });
    }
    engine.apply((s) => d.setPellet(s, route[0].col, route[0].row));
    engine.startRecording();
    for (let tick = 0; tick < 48; tick++) {
      if (tick === 18) key("ArrowDown");
      if (tick === 26) key("ArrowLeft");
      if (tick % 3 === 0) {
        const p = route[tick + 3];
        engine.apply((s) => d.setNextPellet(s, p.col, p.row));
      }
      await engine.advance(4);
      if (engine.state.screen !== "playing")
        throw new Error("Showcase run collided");
    }
    const result = engine.stopRecording();
    engine.destroy();
    return result;
  });
  await writeFile(
    new URL("../showcase/combo.json.gz", import.meta.url),
    gzipSync(JSON.stringify(recording)),
  );
  await page.screenshot({ path: "showcase/board.png" });
  await page.goto("http://localhost:5173/");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "showcase/title.png" });
} finally {
  await browser.close();
  await unlink(temporary);
}

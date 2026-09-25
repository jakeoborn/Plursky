// Render every mock screen to a PNG at App Store 6.9" size (440x956 @3x =
// 1320x2868), plus a board overview per direction.
//   node design/system-exploration/render.mjs [outDir] [dir...]
// Photos load from design/system-exploration/photos/ (private, gitignored);
// without them each direction shows its own fallback surface.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, "out"));
const dirs = process.argv.slice(3).length ? process.argv.slice(3) : ["laser", "holo", "headliner"];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
for (const d of dirs) {
  const file = path.join(here, d, "index.html");
  if (!fs.existsSync(file)) { console.log("skip", d); continue; }
  const page = await browser.newPage({ viewport: { width: 560, height: 1000 }, deviceScaleFactor: 3 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("file://" + file + "#render");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const shots = await page.$$(".screen-wrap");
  for (const s of shots) {
    const key = await s.getAttribute("data-screen");
    const ph = await s.$(".phone");
    await ph.scrollIntoViewIfNeeded();
    const b = await ph.boundingBox();
    // Clip to the exact 440×956 box at a whole-pixel origin: an element shot
    // at a fractional position comes out 1323×2871, not App Store 1320×2868.
    await page.screenshot({ path: path.join(out, `${d}-${key}.png`), animations: "disabled", clip: { x: Math.round(b.x), y: Math.round(b.y), width: 440, height: 956 } });
  }
  await page.setViewportSize({ width: 1400, height: 1000 });
  const p2 = await browser.newPage({ viewport: { width: 2600, height: 1100 }, deviceScaleFactor: 1 });
  await p2.goto("file://" + file);
  await p2.evaluate(() => document.fonts.ready);
  await p2.waitForTimeout(600);
  await p2.screenshot({ path: path.join(out, `${d}-board.png`), fullPage: true });
  console.log(d, shots.length, "screens", errs.length ? "ERRORS: " + errs.join(" | ") : "no page errors");
  await page.close(); await p2.close();
}
await browser.close();

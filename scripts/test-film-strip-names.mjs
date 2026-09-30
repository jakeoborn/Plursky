#!/usr/bin/env node
// Memories film strip: every frame names its artist in FULL.
//
// _renderFilmStrip printed `artist.name.toUpperCase().slice(0, 18)` over each
// frame, so "Chris Lake b2b Disclosure" shipped as "CHRIS LAKE B2B DISC". Same
// class as #247's map-chat chips. The label now wraps to the frame's width
// (_heroWrap: nothing clipped, nothing ellipsised) and stacks upward.
//
// Runs the real renderer in the running app: the frame sources are stubbed
// (no photo store needed), every fillText is recorded, and the name lines are
// read back. Controls: the frame numbers still draw, and a short name draws
// as one line. Detector: no `.name…slice(0, N)` in a canvas renderer.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { localStorage.setItem("onboarded", "v1"); localStorage.setItem("cloud_nudge_seen", "1"); });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window._renderFilmStrip === "function" && Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 60000 });

  const r = await page.evaluate(async () => {
    const LONG = "Chris Lake b2b Disclosure";
    const VERY_LONG = "Fixture Artist With A Name Long Enough To Need Two Lines Over One Frame b2b Another";
    const SHORT = "ROYA";
    const fx = [LONG, VERY_LONG, SHORT].map((name, i) => ({ id: `fixture-film-${i}`, name, stage: "x", day: 1, start: "20:00", end: "21:00" }));
    window.ARTISTS = [...window.ARTISTS, ...fx];
    const src = document.createElement("canvas"); src.width = 60; src.height = 80;
    window._recapSources = async (moments) => moments.map(m => ({ img: src, moment: m }));
    const drawn = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y) {
      drawn.push({ t: String(t), x, y, font: this.font, w: this.measureText(String(t)).width });
      return orig.apply(this, arguments);
    };
    const c = await window._renderFilmStrip(fx.map((a, i) => ({ id: `m${i}`, artistId: a.id })));
    CanvasRenderingContext2D.prototype.fillText = orig;
    const names = drawn.filter(d => /(^|\s)8px\s/.test(d.font));
    return { ok: !!c, W: c?.width, names, frameNums: drawn.filter(d => /^\d+A$/.test(d.t)).map(d => d.t),
             fx: fx.map(a => a.name.toUpperCase()) };
  });

  check(r.ok, "harness: the film strip rendered");
  check(JSON.stringify(r.frameNums) === JSON.stringify(["1A", "2A", "3A"]), `control: three frame numbers drawn (got ${JSON.stringify(r.frameNums)})`);
  const FRAME_W = 300;
  // Lines of one label share an x (the frame centre); group by it.
  const byX = new Map();
  for (const d of r.names) byX.set(d.x, [...(byX.get(d.x) || []), d]);
  const labels = [...byX.values()].map(ls => ls.sort((a, b) => a.y - b.y));
  check(labels.length === 3, `three frames carry a name label (got ${labels.length})`);
  r.fx.forEach((full, i) => {
    const ls = labels[i] || [];
    const joined = ls.map(l => l.t).join(" ");
    check(joined === full, `frame ${i + 1}: the name is drawn in full ("${joined}" vs "${full}")`);
    check(ls.every(l => l.w <= FRAME_W + 0.5), `frame ${i + 1}: every name line fits the ${FRAME_W}px frame (widest ${Math.max(0, ...ls.map(l => Math.round(l.w)))})`);
    check(ls.every(l => l.y < 95), `frame ${i + 1}: the name sits above the frame, not on the photo`);
  });
  check((labels[1] || []).length >= 2, "the very long fixture name wraps to more than one line (not squeezed or cut)");
  check((labels[2] || []).length === 1, "control: a short name draws as one line");
  await browser.close();
} finally {
  server.kill();
}

// Detector: a fixed-length slice of an artist name inside a canvas renderer.
const src = readFileSync(join(ROOT, "recap-engine.jsx"), "utf8").split("\n");
const hits = src.map((l, i) => [l.replace(/\/\/.*$/, ""), i + 1])
  .filter(([l]) => /\.name(\.toUpperCase\(\)|\.toLowerCase\(\))?\.slice\(0,\s*\d+\)/.test(l))
  .map(([l, n]) => `recap-engine.jsx:${n}: ${l.trim()}`);
check(hits.length === 0, `no fixed-length name slices in recap-engine.jsx:\n     ${hits.join("\n     ")}`);

console.log(`  ${failed ? "✗" : "✓"}  film strip names: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);

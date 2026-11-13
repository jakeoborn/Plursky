#!/usr/bin/env node
// SPEC-193 P1 — field-conditions harness. Boots the REAL app (full index.html
// script chain, vendored CDN copies) for every festival the app can open and
// asks the questions someone standing in a field with bad signal would ask:
// does it open, does the lineup render, does it still work offline, on a
// 4-second-latency link, with the map tile host dead?
//
//   node scripts/field/field-readiness.mjs [--only <fid,fid>] [--workers 6] [--date YYYY-MM-DD]
//
// Writes reports/field-readiness-<date>.{md,json}; a screenshot per FAIL under
// reports/field/ (JPEG, capped at 40 MB). Read-only against the app: it seeds
// localStorage in fresh browser contexts and never writes the repo's data.
//
// Matrix: festival × viewport (320x568, 390x844, 430x932) × network (online,
// offline-after-first-load, slow-3g+4s, map-tiles-blocked). Deeper flows (day
// switcher, artist page, My schedule persistence, clash banner, Music/recap)
// run once per festival at 390x844 online. Global storage scenarios (fresh
// install, stored selection on a long-ended festival, stale service worker)
// and both colour schemes run once per viewport. A failed cell is retried
// once; a pass on retry is reported FLAKY, never hidden.
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, statSync, readdirSync, symlinkSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { wireVendor } from "../lib/vendor-cdn.mjs";
import { FLOWS } from "./flows.mjs";

const ROOT = process.cwd();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATE = arg("--date", new Date().toISOString().slice(0, 10));
const ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const WORKERS = +arg("--workers", 6);
const OUTDIR = resolve(arg("--out", join(ROOT, "reports")));
const SHOTS = join(OUTDIR, "field");
const SHOT_CAP = 40 * 1024 * 1024;
mkdirSync(SHOTS, { recursive: true });

// Console noise a gate causes ON PURPOSE (every outside host is aborted, so
// fetches fail): not app faults. A real exception still lands via pageerror.
const OFFLINE_NOISE = /Failed to load resource|net::ERR_|ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to fetch|NetworkError|Load failed|\[sw\] cdn precache miss/;
export const VIEWPORTS = [[320, 568], [390, 844], [430, 932]];
export const NETWORKS = ["online", "offline", "slow3g", "tiles-blocked"];
const TILE_HOSTS = /(^|\.)(tiles\.openfreemap\.org|server\.arcgisonline\.com|basemaps\.cartocdn\.com|tile\.openstreetmap\.org)$/;

// ── server ───────────────────────────────────────────────────────────────
// The stale-SW scenario needs the SAME origin to serve two builds, so the
// server roots at a temp dir holding a symlink `app` that is repointed from
// the previous build to this one between loads.
const TMP = join(OUTDIR, ".field-tmp");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
writeFileSync(join(TMP, ".gitignore"), "*\n"); // scratch server root, never committed
symlinkSync(ROOT, join(TMP, "app"));
const PORT = 8600 + Math.floor(Math.random() * 300);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: TMP, stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
export const BASE = `http://127.0.0.1:${PORT}/app/`;

const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });

// ── festival list: whatever the app itself says it can open ──────────────
async function festivalList() {
  const { ctx, page } = await openCtx({ w: 390, h: 844, sw: false });
  await boot(page, "index.html");
  const list = await page.evaluate(() => FESTIVALS_REGISTRY.filter(f => festivalCanBeActive(f) && _DATA_SETS[f.config.id]).map(f => ({
    id: f.config.id, name: f.config.name, startMs: f.config.startMs, endMs: f.config.endMs,
    tz: f.config.tz || f.config.timezone || null, tba: isScheduleTBA(f.config.id), mapMode: f.config.mapMode || null,
  })));
  await ctx.close();
  return list;
}

export async function openCtx({ w, h, sw, scheme = "dark", fid = null, seed = true, extra = null }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: sw ? "allow" : "block", colorScheme: scheme });
  await wireVendor(ctx);
  // Never reach the outside world from a gate: anything not on the local
  // server or vendored is answered by an abort (images fall back, APIs fail
  // the way they would with no signal). Map tiles too, unless a cell wants them.
  await ctx.route(url => !url.href.startsWith(`http://127.0.0.1:${PORT}/`) && !/cdn\.jsdelivr\.net|unpkg\.com/.test(url.host), r => r.abort());
  if (seed) await ctx.addInitScript(({ fid, extra }) => {
    if (sessionStorage.getItem("__field_seeded")) return;
    sessionStorage.setItem("__field_seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("plursky_display_name", "Field");
    ["cloud_nudge_seen", "ft_guide_seen", "notif_nudge_dismissed", "plursky_recap_seen_v1"].forEach(k => localStorage.setItem(k, "1"));
    if (fid) { localStorage.setItem("active_festival_id", fid); localStorage.setItem("active_festival_explicit", "1"); }
    for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v);
  }, { fid, extra });
  const page = await ctx.newPage();
  page._errors = [];
  page.on("pageerror", e => page._errors.push(String(e.message || e).split("\n")[0]));
  page.on("console", m => { if (m.type() === "error" && !OFFLINE_NOISE.test(m.text())) page._errors.push("console: " + m.text().slice(0, 160)); });
  return { ctx, page };
}

export async function boot(page, path, timeout = 30000) {
  const t0 = Date.now();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout });
  await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, null, { timeout });
  return Date.now() - t0;
}

// ── shared checks ─────────────────────────────────────────────────────────
export const scan = page => page.evaluate(() => {
  const txt = document.body.innerText || "";
  const stray = [];
  for (const [label, re] of [["undefined", /\bundefined\b/], ["NaN", /\bNaN\b/], ["[object Object]", /\[object Object\]/], ["//", /(^|\s)\/\/(\s|$)/m]]) {
    const m = re.exec(txt); if (m) stray.push(`${label} near "${txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " ")}"`);
  }
  const se = document.scrollingElement || document.documentElement;
  return { stray, overflowX: Math.max(se.scrollWidth, document.body.scrollWidth) - innerWidth, textLen: txt.length };
});

// A screen region is "blank" when it paints almost one colour (the grey
// MapLibre plate with no tiles and nothing on it).
export async function regionDistinctColours(page, box) {
  const buf = await page.screenshot({ clip: box, type: "png" });
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return seen.size;
  }, buf.toString("base64"));
}

let shotBytes = 0;
export async function shot(page, name) {
  if (shotBytes > SHOT_CAP) return null;
  const f = join(SHOTS, name.replace(/[^a-z0-9._-]/gi, "_") + ".jpg");
  try { await page.screenshot({ path: f, type: "jpeg", quality: 55 }); shotBytes += statSync(f).size; return "field/" + f.split("/field/")[1]; } catch { return null; }
}

// ── matrix cell ───────────────────────────────────────────────────────────
// Returns { status: PASS|FAIL|NA, checks: [{flow, ok, note}], ms, shot }.
async function cell(f, [w, h], net) {
  const sw = net === "offline" || net === "slow3g";
  const { ctx, page } = await openCtx({ w, h, sw, fid: f.id });
  const checks = [], add = (flow, ok, note = "") => checks.push({ flow, ok, note });
  let ms = 0;
  try {
    if (net === "tiles-blocked") {
      ms = await boot(page, "index.html?tab=map");
      await page.waitForTimeout(3500);
      const r = await page.evaluate(() => {
        const head = document.querySelector("[data-map-header]");
        const note = document.querySelector("[data-map-fallback-note]")?.innerText || "";
        const err = document.querySelector("[data-realmap-err]")?.innerText || "";
        const nav = [...document.querySelectorAll("button")].find(b => /^(Today|Lineup)$/.test(b.textContent.trim()));
        const top = head ? head.getBoundingClientRect().bottom : 0;
        const bottom = nav ? nav.getBoundingClientRect().top : innerHeight;
        return { head: !!head, note, err, top, bottom };
      });
      if (!r.head) add("6 map screen", false, "map header never rendered");
      else {
        const box = { x: 0, y: Math.round(r.top) + 4, width: w, height: Math.max(40, Math.round(r.bottom - r.top) - 8) };
        const colours = await regionDistinctColours(page, box);
        const explained = !!(r.note || r.err);
        add("6 map: tiles blocked → not a blank plate", colours > 24 || explained, `${colours} colours in the map area${r.note ? `; note "${r.note}"` : ""}${r.err ? `; err "${r.err}"` : ""}`);
      }
    } else {
      if (sw) {
        await boot(page, "index.html?tab=lineup");
        await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
        await page.waitForTimeout(2500);
        if (net === "offline") await ctx.setOffline(true);
        else {
          // "Slow 3G" (400 ms) plus the spec's 4 s extra, on every request the
          // page OR its service worker makes. CDP network emulation does not
          // reach service-worker fetches, so the delay is a route: the app's
          // network-first own-origin fetches really do wait 4.4 s each.
          await ctx.route(() => true, async r => { await new Promise(res => setTimeout(res, 4400)); await r.fallback(); });
        }
        page._errors.length = 0;
        const t0 = Date.now();
        await page.goto(BASE + "index.html?tab=lineup", { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, null, { timeout: 60000 });
        ms = Date.now() - t0;
      } else ms = await boot(page, "index.html?tab=lineup");
      const lineupUp = await page.waitForSelector("[data-lineup-scroll], [data-grid-scroll]", { timeout: net === "slow3g" ? 60000 : 20000 }).then(() => true, () => false);
      add("1 opens on the stored festival", await page.evaluate(id => window.FESTIVAL_CONFIG?.id === id, f.id), `active ${await page.evaluate(() => window.FESTIVAL_CONFIG?.id)}`);
      add("2 lineup renders", lineupUp, `${net} in ${ms} ms`);
      if (lineupUp) {
        await page.waitForTimeout(600);
        const rows = await page.locator("[data-set-name]").count();
        add("2 lineup has set rows", rows > 0, `${rows} rows`);
        const s = await scan(page);
        add("2 no horizontal overflow", s.overflowX <= 1, `${s.overflowX}px over`);
        add("2 no stray text", s.stray.length === 0, s.stray.join("; "));
      }
      if (net === "slow3g") add("2 usable within 20 s on slow 3G (warm cache)", ms < 20000, `${ms} ms to first paint`);
    }
    const errs = page._errors.filter(e => !OFFLINE_NOISE.test(e));
    add("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
  } catch (e) {
    add("cell ran", false, String(e.message || e).split("\n")[0].slice(0, 200));
  }
  const failed = checks.filter(c => !c.ok);
  const out = { status: failed.length ? "FAIL" : "PASS", checks, ms };
  if (failed.length) out.shot = await shot(page, `${f.id}-${w}x${h}-${net}`);
  await ctx.close();
  return out;
}

async function withRetry(fn, label) {
  const a = await fn();
  if (a.status !== "FAIL") return a;
  const b = await fn();
  if (b.status === "PASS") return { ...b, status: "FLAKY", firstTry: a.checks.filter(c => !c.ok) };
  return b;
}

// ── pool ──────────────────────────────────────────────────────────────────
async function pool(jobs, n) {
  const out = new Array(jobs.length); let i = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < jobs.length) {
      const k = i++; out[k] = await jobs[k]();
      if (++done % 25 === 0) console.log(`  … ${done}/${jobs.length}`);
    }
  }));
  return out;
}

// ── run ───────────────────────────────────────────────────────────────────
const t0 = Date.now();
const allFests = await festivalList();
let fests = allFests;
if (ONLY.length) fests = fests.filter(f => ONLY.includes(f.id));
console.log(`field-readiness: ${fests.length} festivals × ${VIEWPORTS.length} viewports × ${NETWORKS.length} networks, ${WORKERS} workers`);

const matrixJobs = [];
for (const f of fests) for (const vp of VIEWPORTS) for (const net of NETWORKS)
  matrixJobs.push(async () => ({ festival: f.id, viewport: vp.join("x"), network: net, ...(await withRetry(() => cell(f, vp, net))) }));
const flowJobs = fests.map(f => async () => ({ festival: f.id, ...(await withRetry(() => FLOWS.perFestival(f, { openCtx, boot, scan, shot, regionDistinctColours }))) }));
const globalJobs = VIEWPORTS.flatMap(vp => FLOWS.global.map(g => async () => ({ scenario: g.name, viewport: vp.join("x"),
  ...(await withRetry(() => g.run(vp, { openCtx, boot, scan, shot, fests, allFests, ROOT, TMP, BASE }))) })));

const matrix = await pool(matrixJobs, WORKERS);
const flows = await pool(flowJobs, WORKERS);
const globals = [];
for (const j of globalJobs) globals.push(await j());   // serial: the stale-SW scenario repoints the served build

await browser.close(); server.kill();
rmSync(TMP, { recursive: true, force: true });

// Drop screenshots no FAIL/FLAKY row points at (a pass on retry wrote one on its first try).
const keep = new Set([...matrix, ...flows, ...globals].map(r => r.shot).filter(Boolean).map(s => s.replace(/^field\//, "")));
for (const f of readdirSync(SHOTS)) if (!keep.has(f)) rmSync(join(SHOTS, f));

const { writeReport } = await import("./report.mjs");
const res = writeReport({ DATE, OUTDIR, fests, matrix, flows, globals, ms: Date.now() - t0, head: execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim() });
console.log(res.summary);
process.exit(0);

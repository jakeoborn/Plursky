#!/usr/bin/env node
// Live Set Check-in — hand-run browser e2e (needs Playwright Chromium and a
// fresh `node scripts/compile.mjs`). The native bits are MOCKED: Capacitor
// reports native, ShazamPlugin answers buildChannel/identify/cancel, the GPS
// fix is Playwright's geolocation, and the clock is pinned to EDC night 1,
// 22:30. This proves the web half — state machine, review, save, Memories —
// not ShazamKit or GPS accuracy, which only a device trial can.
//   node scripts/e2e-live-checkin.mjs [shotDir]
import { chromium } from "playwright";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.argv[2] || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const p = u.endsWith("/") ? u + "index.html" : u;
  try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

let checks = 0, failed = 0;
function check(ok, msg) { checks++; console.log(`  ${ok ? "✓" : "✗"}  ${msg}`); if (!ok) failed++; }
const browser = await chromium.launch();
const seed = { onboarded: "v1", active_festival_id: "edc-lv-2026", active_festival_explicit: "1" };

// Phase 0: read the fixture off the real app — the pinned instant and a
// stage with exactly one set on at that instant.
const fx = await (async () => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed);
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.resolveLiveCheckin === "function" || typeof resolveLiveCheckin === "function", null, { timeout: 30000 });
  const out = await page.evaluate(() => {
    const ds = _DATA_SETS["edc-lv-2026"], cfg = ds.config, T = cfg.dayDates[1].midnightUtc + 22.5 * 3600000;
    const anchors = resolvedStageAnchors(cfg);
    for (const a of anchors) {
      const r = resolveLiveCheckin({ cfg, artists: ds.artists, anchors, atMs: T, fix: { lat: a.lat, lng: a.lng, accuracy: 10 } });
      if (r.basis === "gps-schedule") return { T, lat: a.lat, lng: a.lng, stageId: a.stageId, artistId: r.artistId };
    }
    return null;
  });
  await ctx.close();
  return out;
})();
check(!!fx, `fixture: ${fx && fx.stageId} → ${fx && fx.artistId} at EDC night 1, 22:30`);

async function open({ channel = "testflight", geo = true, native = true, identify = "match" } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    ...(geo ? { geolocation: { latitude: fx.lat, longitude: fx.lng, accuracy: 10 }, permissions: ["geolocation"] } : {}),
  });
  await ctx.addInitScript(({ s, channel, native, identify }) => {
    for (const [k, v] of Object.entries(s)) if (localStorage.getItem(k) == null) localStorage.setItem(k, v);
    if (!native) return;
    window.__shz = { identify: 0, cancel: 0 };
    let pending = null;
    const shazam = {
      buildChannel: async () => ({ channel }),
      identify: () => { window.__shz.identify++; return new Promise(res => {
        pending = res;
        if (identify === "match") setTimeout(() => pending && (pending({ matched: true, title: "Mock Track", artist: "Somebody Else", appleMusicID: "1", artworkURL: "" }), pending = null), 1500);
      }); },
      cancel: async () => { window.__shz.cancel++; if (pending) { pending({ matched: false, cancelled: true, debug: { reason: "cancelled" } }); pending = null; } return { cancelled: true }; },
    };
    const inert = new Proxy({}, { get: () => async () => ({}) });
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", isPluginAvailable: n => n === "ShazamPlugin",
      convertFileSrc: x => x, Plugins: new Proxy({}, { get: (_, k) => (k === "ShazamPlugin" ? shazam : inert) }), registerPlugin: () => inert };
  }, { s: seed, channel, native, identify });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e)));
  await page.clock.setFixedTime(new Date(fx.T));
  await page.goto(BASE);
  await page.waitForFunction(() => !!document.querySelector("#root")?.children.length, null, { timeout: 30000 });
  return { ctx, page, errors };
}
const moments = page => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}")).flat().filter(m => m.kind === "checkin"));
const shot = (page, name) => SHOTS ? page.screenshot({ path: join(SHOTS, `${name}.png`) }) : null;

// 1. The full path: tap → locate → listen → review → save → Memories.
{
  const { ctx, page, errors } = await open();
  const btn = page.locator('[data-checkin-phase="idle"]');
  await btn.waitFor({ timeout: 15000 });
  check(await btn.innerText() === "CHECK IN TO THIS SET", "trial bar shows one CHECK IN TO THIS SET button");
  check(await page.locator('[data-checkin-firstuse]').count() === 1, "first-use copy under the button");
  check(await page.getByTitle("What's playing?").count() === 0, "the separate 🎵 and CAPTURE controls are replaced in the trial");
  await shot(page, "1-bar-idle");
  await btn.click();
  await page.locator('[data-checkin-status="listening"]').waitFor({ timeout: 10000 });
  check(true, "visible LISTENING indicator while the mic is on");
  await shot(page, "2-listening");
  const dlg = page.locator('[aria-label="Check in to this set"]');
  await dlg.waitFor({ timeout: 10000 });
  check(await dlg.getAttribute("data-checkin-basis") === "gps-schedule", `review basis ${await dlg.getAttribute("data-checkin-basis")}`);
  check(await page.locator('[data-checkin-set]').getAttribute("data-checkin-set") === fx.artistId, "review proposes the set at the GPS stage");
  check(/Mock Track/.test(await page.locator('[data-checkin-song]').innerText()), "review shows the song match");
  check(/GPS \+ schedule/.test(await page.locator('[data-checkin-confidence]').innerText()), "confidence reads GPS + schedule");
  check((await moments(page)).length === 0, "nothing saved before SAVE");
  await shot(page, "3-review");
  await page.locator('[data-checkin-action="SAVE CHECK-IN"]').click();
  await page.locator('[data-checkin-phase="saved"]').waitFor({ timeout: 5000 });
  const saved = await moments(page);
  const m = saved[0] || {};
  check(saved.length === 1 && m.artistId === fx.artistId && m.stageId === fx.stageId && m.tagSource === "live-gps-schedule" && m.songCapture?.artist === "Somebody Else",
    `one moment saved: ${m.artistId} @ ${m.stageId}, ${m.tagSource}, song by ${m.songCapture?.artist}`);
  check(!/"lat"|"lng"|latitude|longitude/.test(JSON.stringify(saved)), "no coordinates in the stored moment");
  check(await page.evaluate(() => window.__shz.identify) === 1, "one native listen");
  await shot(page, "4-saved");
  await page.locator('[data-checkin-phase="saved"]').click();
  await page.locator('[data-checkin-card]').first().waitFor({ timeout: 10000 }).catch(() => {});
  const card = page.locator('[data-checkin-card]').first();
  check(await card.count() === 1 && /CHECKED IN/.test(await card.innerText()) && /Mock Track/.test(await card.innerText()), "Memories renders the check-in card with no photo");
  if (await card.count()) { await card.scrollIntoViewIfNeeded(); await shot(page, "5-memories-card"); }
  check(errors.length === 0, `no page errors (${errors.join(" | ").slice(0, 200)})`);
  await ctx.close();
}

// 2. Cancel while listening: the native listen is cancelled, nothing saved.
{
  const { ctx, page, errors } = await open({ identify: "hang" });
  await page.locator('[data-checkin-phase="idle"]').click({ timeout: 15000 });
  await page.locator('[data-checkin-status="listening"]').waitFor({ timeout: 10000 });
  await page.locator('[data-checkin-phase="listening"]').click();
  await page.locator('[data-checkin-phase="idle"]').waitFor({ timeout: 5000 });
  check(await page.evaluate(() => window.__shz.cancel) >= 1, "CANCEL calls native cancel()");
  check(await page.locator('[aria-label="Check in to this set"]').count() === 0 && (await moments(page)).length === 0, "no review, nothing saved");
  check(errors.length === 0, "no page errors");
  await ctx.close();
}

// 3. No GPS, sets on at several stages: the user must choose.
{
  const { ctx, page, errors } = await open({ geo: false });
  await page.locator('[data-checkin-phase="idle"]').click({ timeout: 15000 });
  const dlg = page.locator('[aria-label="Check in to this set"]');
  await dlg.waitFor({ timeout: 15000 });
  check(await dlg.getAttribute("data-checkin-basis") === "choose", "no GPS → Choose set");
  const save = page.locator('[data-checkin-action="SAVE CHECK-IN"]');
  check(await save.isDisabled(), "SAVE is disabled until a set is chosen");
  const choices = page.locator('[data-checkin-choice]');
  const n = await choices.count();
  check(n > 2 && n < 40, `chooser offers a slice: ${n - 1} sets + NOT SURE`);
  await shot(page, "6-choose");
  await page.locator(`[data-checkin-choice="${fx.artistId}"]`).click();
  check(!(await save.isDisabled()), "a choice enables SAVE");
  await save.click();
  await page.locator('[data-checkin-phase="saved"]').waitFor({ timeout: 5000 });
  const m = (await moments(page))[0] || {};
  check(m.artistId === fx.artistId && m.tagSource === "live-manual" && m.proposedArtistId === null && m.gpsStatus !== "trusted", `manual pick saved: ${m.tagSource}, gps ${m.gpsStatus}`);
  check(errors.length === 0, "no page errors");
  await ctx.close();
}

// 4. Outside the trial: an App Store build and the web keep today's bar.
for (const [label, opts] of [["App Store build", { channel: "appstore" }], ["web", { native: false }]]) {
  const { ctx, page, errors } = await open(opts);
  await page.waitForTimeout(2500);
  check(await page.locator('[data-checkin-phase]').count() === 0, `${label}: no check-in control`);
  if (label === "App Store build") check(await page.getByTitle("What's playing?").count() === 1, `${label}: the 🎵 + CAPTURE bar is unchanged`);
  check(errors.length === 0, `${label}: no page errors`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `  ✗ ${failed} of ${checks} e2e checks failed` : `  ✓ ${checks} e2e checks`);
process.exit(failed ? 1 : 0);

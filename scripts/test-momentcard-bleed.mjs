#!/usr/bin/env node
// MomentCard right-edge bleed (TODO "MomentCard right-edge bleed", open since
// 2026-06). In the Memories library a text moment (no photo) renders as a
// MomentCard inside its set's group card. A note holding one unbroken run, a
// pasted link most often, printed past the card's right edge at 390 and 320 px
// because the headline had no wrap rule; ordinary prose wrapped fine, which is
// why the bleed only showed up in some screenshots. The note must wrap inside
// its card at both widths. Ancestors clip overflow-x, so a page-pan check
// cannot see this; the note's own box is measured against its card.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close((e) => (e ? rej(e) : res(a.port))); }); });

const LONG = "https://example.com/" + "averyverylongpastedlinkwithnobreaks".repeat(3);
const PROSE = "Best drop of the night, the whole crowd jumped at once and I lost my friends for a bit";
const at = (m) => `2026-05-16T04:${String(m).padStart(2, "0")}:00.000Z`;   // Fri May 15, 9 PM PT
const MOMENTS = JSON.stringify({ 1: [
  { kind: "photo", festivalId: "edc-lv-2026", createdAt: 1, id: "t1", night: 1, _fingerprint: "t1", artistId: "k1", takenAt: at(0), text: PROSE },
  { kind: "photo", festivalId: "edc-lv-2026", createdAt: 2, id: "t2", night: 1, _fingerprint: "t2", artistId: "k1", takenAt: at(10), text: LONG },
  { kind: "photo", festivalId: "edc-lv-2026", createdAt: 3, id: "p1", night: 1, _fingerprint: "p1", artistId: "k1", takenAt: at(20), photoId: "p1" },
] });

const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
// CI runners carry system Chrome, not Playwright's headless shell; use it when present (same as the sibling gates).
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  for (const width of [390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block", timezoneId: "America/Los_Angeles" });
    await wireVendor(ctx);
    await ctx.addInitScript((m) => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Jake");
      for (const k of ["cloud_nudge_seen", "ft_guide_seen", "notif_nudge_dismissed", "plursky_recap_seen_v1"]) localStorage.setItem(k, "1");
      localStorage.setItem("active_festival_id", "edc-lv-2026"); localStorage.setItem("active_festival_explicit", "1");
      localStorage.setItem("plursky_last_festival_id", "edc-lv-2026"); localStorage.setItem("plursky_landing_migrated_v1", "1");
      localStorage.setItem("plursky_memories_view_v1", "library");
      localStorage.setItem("plursky_moments_v1", m);
      localStorage.setItem("plursky_attended_v1", JSON.stringify({ 1: ["k1"] }));
      localStorage.setItem("edc-lv-2026_saved_v1", JSON.stringify(["k1"]));
      localStorage.setItem("plursky_saved_festivals_v1", JSON.stringify({ v: 1, ids: ["edc-lv-2026"] }));
    }, MOMENTS);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    await page.goto(`http://127.0.0.1:${PORT}/?tab=memories`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });
    const ready = await page.waitForFunction((texts) => texts.every((t) => [...document.querySelectorAll(".duo-headline")].some((e) => e.textContent === t)), [PROSE, LONG], { timeout: 15000 }).then(() => true, () => false);
    check(ready, `${width}: both text moments render as MomentCards in the Memories library`);
    if (ready) {
      await sleep(300);
      const rows = await page.evaluate((texts) => texts.map((t) => {
        const el = [...document.querySelectorAll(".duo-headline")].find((e) => e.textContent === t);
        // The card is the nearest ancestor with rounded corners.
        let card = el.parentElement; while (card && card !== document.body && !(parseFloat(getComputedStyle(card).borderTopLeftRadius) >= 8)) card = card.parentElement;
        const r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
        return { t: t.slice(0, 24), over: Math.round(el.scrollWidth - el.clientWidth), past: Math.round(r.right - c.right), inView: r.right <= innerWidth + 0.5 };
      }), [PROSE, LONG]);
      for (const row of rows) {
        check(row.over <= 0, `${width}: "${row.t}…" wraps inside its own box (scrollWidth over clientWidth by ${row.over} px)`);
        check(row.past <= 0 && row.inView, `${width}: "${row.t}…" stays inside its card (${row.past} px past the card's right edge)`);
      }
    }
    check(errors.length === 0, `${width}: no page errors (${errors.join(" | ")})`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (failed) { console.log(`✗ momentcard bleed: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ momentcard bleed: ${checks} checks (a note with an unbroken link wraps inside its card at 390 and 320)`);

#!/usr/bin/env node
// ACL 2026 Weekend 2 now-playing, against the REAL grid (the _aclMk rows).
//
// The weekend resolver is clock-first once W2 has begun (founder ruling
// 2026-09-08). "Begun" meant weekendStartMs.W2, the first SET, so W2 Friday
// morning resolved to W1: Oct 2-4 dates, no next set, no night, on the day
// itself. It now begins when W2's first festival day opens (08:00 local, the
// app's night window). Expectations are computed here from the source rows
// (W2 = Oct 9-11 CDT; W1-only acts excluded), not from the app's helpers, and
// checked at real W2 clock times against four saved mixes. One case is the
// ruling, not a bug: during W1, a W2-majority saver resolves to W2.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = readFileSync(join(ROOT, "data.jsx"), "utf8");
const rows = [...SRC.matchAll(/_aclMk\("([^"]+)","([^"]+)","[^"]*","([^"]+)",(\d),"(\d\d:\d\d)","(\d\d:\d\d)"(?:,"(W[12])")?\)/g)]
  .map(m => ({ id: m[1], name: m[2], stage: m[3], day: +m[4], start: m[5], end: m[6], wk: m[7] || "both" }));
if (rows.length !== 137) { console.log(`✗ parsed ${rows.length} ACL rows, want 137`); process.exit(1); }
console.log("rows parsed:", rows.length, "W1", rows.filter(r => r.wk === "W1").length, "W2", rows.filter(r => r.wk === "W2").length, "both", rows.filter(r => r.wk === "both").length);

// W2 wall dates: Fri Oct 9, Sat Oct 10, Sun Oct 11, CDT = UTC-5.
const W2DATE = { 1: 9, 2: 10, 3: 11 }, W1DATE = { 1: 2, 2: 3, 3: 4 };
const at = (dates, day, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return Date.UTC(2026, 9, dates[day], h + 5, m); };
const expectLive = (dates, wk, t) => rows.filter(r => r.wk !== (wk === "W2" ? "W1" : "W2"))
  .filter(r => t >= at(dates, r.day, r.start) && t < at(dates, r.day, r.end)).map(r => r.id).sort();
const expectNext = (dates, wk, t) => rows.filter(r => r.wk !== (wk === "W2" ? "W1" : "W2"))
  .map(r => ({ r, s: at(dates, r.day, r.start) })).filter(x => x.s > t).sort((a, b) => a.s - b.s)[0]?.r.id || null;

const w1Only = rows.filter(r => r.wk === "W1").slice(0, 3).map(r => r.id);
const w2Only = rows.filter(r => r.wk === "W2").slice(0, 3).map(r => r.id);
const bothOnly = rows.filter(r => r.wk === "both").slice(0, 3).map(r => r.id);
const SAVES = { none: [], w1Majority: [...w1Only, w2Only[0]], w2Majority: [...w2Only, w1Only[0]], bothOnly };
const TIMES = {
  "W2 Fri 08:05 CDT (day open)": "2026-10-09T13:05:00Z",
  "W2 Fri 11:30 CDT (pre-gates)": "2026-10-09T16:30:00Z",
  "W2 Fri 13:15 CDT": "2026-10-09T18:15:00Z",
  "W2 Sat 17:45 CDT": "2026-10-10T22:45:00Z",
  "W2 Sun 21:15 CDT": "2026-10-12T02:15:00Z",
  "W1 Sat 17:45 CDT (control)": "2026-10-03T22:45:00Z",
};

const PORT = 8000 + Math.floor(Math.random() * 900);
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
let bad = 0;
try {
  for (const [tl, iso] of Object.entries(TIMES)) for (const [sl, saved] of Object.entries(SAVES)) {
    const ctx = await browser.newContext();
    await ctx.clock.install({ time: new Date(iso) });
    await ctx.addInitScript(({ saved }) => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", "acl-2026");
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("acl-2026_saved_v1", JSON.stringify(saved));
    }, { saved });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=acl-2026`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.FESTIVAL_CONFIG?.id === "acl-2026" && typeof window.NOW !== "undefined" || typeof NOW !== "undefined", null, { timeout: 60000 });
    await page.clock.runFor(1500);
    const got = await page.evaluate(() => ({ live: [...NOW.liveIds].sort(), cur: NOW.currentArtistId, next: NOW.nextArtistId,
      wk: activeWeekend(), days: (window.DAYS || DAYS).map(d => d.date).join(","), night: NOW.night }));
    const t = Date.parse(iso);
    const isW1 = tl.startsWith("W1");
    // The ruling: before W2 begins, a W2-majority saver is on W2.
    const byRuling = isW1 && sl === "w2Majority";
    const wantWk = isW1 && !byRuling ? "W1" : "W2";
    const dates = wantWk === "W1" ? W1DATE : W2DATE;
    const want = { live: expectLive(dates, wantWk, t), next: expectNext(dates, wantWk, t) };
    const ok = got.wk === wantWk && JSON.stringify(got.live) === JSON.stringify(want.live) && got.next === want.next;
    if (!ok) bad++;
    console.log(`${ok ? "✓" : "✗"} ${tl} | saved=${sl} | wk=${got.wk} days=${got.days} night=${got.night} | live got ${got.live.length} want ${want.live.length} | next got ${got.next} want ${want.next}`);
    if (!ok && JSON.stringify(got.live) !== JSON.stringify(want.live)) console.log(`    live got [${got.live}] want [${want.live}]`);
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
console.log(bad ? `✗ ACL W2 now-playing: ${bad} scenario(s) wrong` : `✓ ACL W2 now-playing: ${Object.keys(TIMES).length * Object.keys(SAVES).length} scenarios match the grid`);
process.exit(bad ? 1 : 0);

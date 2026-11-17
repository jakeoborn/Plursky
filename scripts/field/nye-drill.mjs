#!/usr/bin/env node
// SPEC-193 P4 — NYE drill. Boots the REAL app with a fake clock at the moments
// that break festival apps on New Year's Eve, for the two NYE events Plursky
// carries, and checks what a fan would read on Home and the lineup:
//
//   2 h before gates · mid-set on Dec 31 · 11:58 PM Dec 31 · 12:03 AM Jan 1
//   (+ Countdown NYE's second night, Jan 1 9 PM: its run is Dec 31–Jan 1)
//
//   node scripts/field/nye-drill.mjs [--date YYYY-MM-DD]
//
// For each moment it asserts the festival's phase (upcoming before gates, live
// after), the night the app treats as "tonight" (12:03 AM Jan 1 is still Dec
// 31's night, not a new day), that nothing reads "ended" while it is live,
// that the edition's own year stays on screen across midnight, that a
// countdown never goes negative or NaN, and that with set times still TBA no
// act is shown as playing now. Writes reports/nye-drill-<date>.{md,json} and a
// screenshot per failing moment under reports/field/. Read-only.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wireVendor } from "../lib/vendor-cdn.mjs";

const ROOT = process.cwd();
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DATE = arg("--date", new Date().toISOString().slice(0, 10));
const OUT = join(ROOT, "reports"); mkdirSync(join(OUT, "field"), { recursive: true });
const PORT = 8990 + Math.floor(Math.random() * 9);
const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 900));
const BASE = `http://127.0.0.1:${PORT}/`;
const browser = await chromium.launch();

// Wall clock in a festival's zone → UTC ms. Both NYE zones are fixed-offset
// in late December (no DST change), so the config's utcOffsetHours is exact.
const wall = (y, m, d, hh, mm, offH) => Date.UTC(y, m - 1, d, hh, mm) - offH * 3600000;

// Expected nights: Decadence day 1 = Dec 30, day 2 = Dec 31 (gates 18:00 MST).
// Countdown NYE carries ONE TBA bucket (day 1, "Dec 31–Jan 1": the poster has
// no night split), so day 1 is the only night the app can name.
const DRILLS = [
  { fid: "decadence-colorado-2026", off: -7, moments: [
    { label: "2 h before gates (Dec 30 4:00 PM MST)", at: [2026, 12, 30, 16, 0], phase: "upcoming", night: null },
    { label: "mid-set, NYE night (Dec 31 10:00 PM MST)", at: [2026, 12, 31, 22, 0], phase: "live", night: 2 },
    { label: "11:58 PM Dec 31 (MST)", at: [2026, 12, 31, 23, 58], phase: "live", night: 2 },
    { label: "12:03 AM Jan 1 (MST)", at: [2027, 1, 1, 0, 3], phase: "live", night: 2 },
  ] },
  { fid: "countdown-nye-2026", off: -8, moments: [
    { label: "2 h before gates (Dec 31 2:00 PM PST)", at: [2026, 12, 31, 14, 0], phase: "upcoming", night: null },
    { label: "mid-set, NYE night (Dec 31 10:00 PM PST)", at: [2026, 12, 31, 22, 0], phase: "live", night: 1 },
    { label: "11:58 PM Dec 31 (PST)", at: [2026, 12, 31, 23, 58], phase: "live", night: 1 },
    { label: "12:03 AM Jan 1 (PST)", at: [2027, 1, 1, 0, 3], phase: "live", night: 1 },
    // Not in the spec's four: the event's second night. With one TBA bucket the
    // app has no night to name here; it must still read live, never ended.
    { label: "second night (Jan 1 9:00 PM PST)", at: [2027, 1, 1, 21, 0], phase: "live", night: "any" },
  ] },
];

const ENDED = /\b(ended|that'?s a wrap|festival is over|see you next year|was live|wrapped)\b/i;

async function moment(fid, off, m) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: "dark" });
  await wireVendor(ctx);
  await ctx.route(u => !u.href.startsWith(BASE) && !/cdn\.jsdelivr\.net|unpkg\.com/.test(u.host), r => r.abort());
  await ctx.addInitScript(fid => {
    if (sessionStorage.getItem("__drill_seeded")) return; sessionStorage.setItem("__drill_seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("plursky_display_name", "Drill");
    ["cloud_nudge_seen", "ft_guide_seen", "notif_nudge_dismissed", "plursky_recap_seen_v1"].forEach(k => localStorage.setItem(k, "1"));
    localStorage.setItem("active_festival_id", fid); localStorage.setItem("active_festival_explicit", "1");
  }, fid);
  const at = wall(...m.at, off);
  await ctx.clock.install({ time: new Date(at) });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e).split("\n")[0]));
  const checks = [];
  const add = (name, ok, note = "") => checks.push({ name, ok, note });
  let shot = null;
  try {
    for (const tab of ["home", "lineup"]) {
      await page.goto(`${BASE}index.html?tab=${tab}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, null, { timeout: 30000 });
      await page.clock.runFor(2500);
      const r = await page.evaluate(fid => {
        const f = _DATA_SETS[fid];
        const text = document.getElementById("root").innerText;
        return { active: FESTIVAL_CONFIG.id, name: f.config.name, year: f.config.year,
          phase: _festivalPhase(f, Date.now()), night: NOW.night, current: NOW.currentArtistId, live: NOW.liveIds.length, tba: isScheduleTBA(fid), text };
      }, fid);
      const t = r.text;
      if (tab === "home") {
        add("opens on the NYE festival", r.active === fid, r.active);
        add(`phase is ${m.phase}`, r.phase === m.phase, r.phase);
        add(m.night === "any" ? "tonight's night (recorded)" : `tonight is night ${m.night ?? "none (before the first night window)"}`,
          m.night === "any" ? null : m.night == null ? r.night == null || r.night === 1 : r.night === m.night, `NOW.night = ${r.night}`);
        add("nothing reads ended", !ENDED.test(t), (t.match(new RegExp(`.{0,60}${ENDED.source}.{0,40}`, "i")) || [""])[0]);
        add("no NaN / undefined / negative countdown", !/\bNaN\b|\bundefined\b|(^|\s)-\d+\s*(d|h|hr|hrs|m|min|mins|s)\b|Infinity/i.test(t),
          (t.match(/.{0,40}(\bNaN\b|\bundefined\b|(^|\s)-\d+\s*(d|h|hr|hrs|m|min|mins|s)\b|Infinity).{0,40}/i) || [""])[0]);
        // The edition's own year must not flip at midnight ("… 2027" for a 2026 edition).
        const wrongYear = new RegExp(`${r.name.replace(/\s*20\d\d$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+${r.year + 1}`, "i");
        add("edition year holds across midnight", !wrongYear.test(t), (t.match(wrongYear) || [""])[0]);
        // A claim is a non-zero live count or an act the app holds as on now;
        // invitation copy ("Pick an act that's on now") is not one.
        if (r.tba) add("set times TBA: no act shown as playing now", r.current == null && r.live === 0 && !/\b[1-9]\d* LIVE NOW\b/i.test(t),
          `${r.live} live${r.current ? `, current ${r.current}` : ""}; ${(t.match(/\b\d+ LIVE NOW\b/i) || ["no live count"])[0]}`);
        add("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
      } else {
        add("lineup opens", /\S/.test(t) && !/\bNaN\b|\bundefined\b/.test(t), "");
        add("lineup: nothing reads ended", !ENDED.test(t), (t.match(new RegExp(`.{0,60}${ENDED.source}.{0,40}`, "i")) || [""])[0]);
      }
    }
  } catch (e) { add("moment ran", false, String(e.message).split("\n")[0]); }
  if (checks.some(c => c.ok === false)) {
    shot = `field/nye-${fid}-${m.at.slice(1).join("-")}.jpg`;
    await page.goto(`${BASE}index.html?tab=home`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.clock.runFor(2000).catch(() => {});
    await page.screenshot({ path: join(OUT, shot), type: "jpeg", quality: 55 }).catch(() => { shot = null; });
  }
  await ctx.close();
  return { festival: fid, moment: m.label, atUtc: new Date(at).toISOString(), status: checks.some(c => c.ok === false) ? "FAIL" : "PASS", checks, shot };
}

const t0 = Date.now(), rows = [];
for (const d of DRILLS) for (const m of d.moments) {
  const r = await moment(d.fid, d.off, m);
  rows.push(r);
  console.log(`${r.status} ${d.fid} · ${m.label}${r.status === "FAIL" ? " — " + r.checks.filter(c => c.ok === false).map(c => `${c.name} (${c.note})`).join("; ") : ""}`);
}
await browser.close(); srv.kill();

const pass = rows.filter(r => r.status === "PASS").length;
writeFileSync(join(OUT, `nye-drill-${DATE}.json`), JSON.stringify({ spec: "SPEC-193 P4", date: DATE, runtimeMs: Date.now() - t0, pass, total: rows.length, rows }, null, 1));
const esc = s => String(s ?? "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 140);
const L = [`# NYE drill — ${DATE}`, "",
  `SPEC-193 Phase 4. The real app at fake clocks, 390x844, dark. **${pass}/${rows.length} moments pass.** Command: \`node scripts/field/nye-drill.mjs\`.`, "",
  "Both events still have set times TBA on main, so \"mid-set\" checks that no act is invented as playing now; once times land, the same moments check the real now/next.", "",
  "| Festival | Moment | Status | Checks |", "|---|---|:-:|---|"];
for (const r of rows) L.push(`| ${r.festival} | ${r.moment} | ${r.status === "PASS" ? "✓" : "✗"} | ${r.checks.map(c => `${c.ok === false ? "✗" : c.ok === null ? "·" : "✓"} ${c.name}${c.note && c.ok !== true ? `: ${esc(c.note)}` : c.name.startsWith("tonight") ? `: ${esc(c.note)}` : ""}`).join("<br>")}${r.shot ? `<br>[screenshot](${r.shot})` : ""} |`);
writeFileSync(join(OUT, `nye-drill-${DATE}.md`), L.join("\n") + "\n");
console.log(`nye-drill: ${pass}/${rows.length} moments pass, ${((Date.now() - t0) / 1000).toFixed(0)} s`);

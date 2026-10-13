#!/usr/bin/env node
// Summerfest 2026's ten School of Rock billings, in the RUNNING app.
// test-summerfest-time-evidence.mjs proves the data contract in a VM; this
// proves what a person sees and exports:
//   L. no surface leaks a disputed time: lineup list, grid, artist page, Me
//      and saved rows, aria-labels, Build My Night text, Copy-as-text, print,
//      both calendar exports, the story image, the recap video frame, the
//      artist collage subtitle and the live schedule.json. Each says "Set
//      times unconfirmed" in words, never a dash, a range or 12:00/15:50,
//      and an ordinary timed row on the same day reads exactly as before.
//   S. the map star: an untimed saved set never blocks a timed one, in either
//      saved order; ordinary TBA is excluded too; an untimed-only stage gets
//      no star.
//   N. an OLD install (its bundle still says 12:00) taps Updates: the sheet
//      lists the change, APPLY stores an overlay, and the saved ids and a
//      seeded moment are byte-identical after the reload.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { serverReady } from "./lib/server-ready.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FID = "summerfest-2026";
const SOR4 = ["su152", "su157", "su168", "su173", "su179"];
const SOR = [...SOR4, "su198", "su203", "su214", "su219", "su224"];
const COPY = "Set times unconfirmed";
// The legacy readings, in every form a surface could print them.
const LEGACY = /\b12:00\b|\b15:50\b|\b15:35\b|12:00 PM|3:50 PM|3:35 PM|\b3:50\b|\b3:35\b/;
let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const MOD = readFileSync(join(ROOT, "data", "festivals", `${FID}.js`), "utf8");
// An old install's bundle: the ten rows at their legacy times, no record.
const LEGACY_MOD = MOD.replace(/ timeEvidence: TIME_EVIDENCE,/, "")
  .replace(/mk\("(su\d+)",([^\n]*?)"", ""\)/g, (m, id, mid) => {
    if (!SOR.includes(id)) return m;
    return `mk("${id}",${mid}"12:00", "${SOR4.includes(id) ? "15:50" : "15:35"}")`;
  });

const reservePort = () => new Promise((resolve, reject) => { const s = createServer(); s.once("error", reject); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  const open = async ({ saved = [], query = "tab=lineup&day=4", view = "list", at = "2026-10-13T15:00:00Z", legacy = false, moments = null, width = 390 } = {}) => {
    const bctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
    await bctx.clock.install({ time: new Date(at) });
    if (legacy) {
      await bctx.route(new RegExp(`/data/festivals/${FID}\\.js`), r => r.fulfill({ status: 200, contentType: "application/javascript", body: LEGACY_MOD }));
    }
    await bctx.addInitScript(({ FID, saved, view, moments }) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", FID);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky_lineup_view", view);
      localStorage.setItem(`${FID}_saved_v1`, JSON.stringify(saved));
      if (moments) localStorage.setItem("plursky_moments_v1", moments);
    }, { FID, saved, view, moments });
    const page = await bctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html?f=${FID}&${query}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid && typeof window.setTimeStatus === "function"
      && typeof window.savedStarsByStage === "function" && typeof window.exportLineupICS === "function", FID, { timeout: 60000 });
    await page.clock.runFor(4000);
    return { bctx, page };
  };
  // Every aria-label and every text node of the elements that mention School of Rock.
  const sorText = page => page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("");
      const lab = el.getAttribute("aria-label") || "";
      if (/School of Rock/i.test(lab)) out.push(`aria:${lab}`);
      if (/School of Rock/i.test(own)) {
        // The WHOLE row (time column included), not the nearest button: in the
        // list the name is its own button and the time sits beside it.
        const row = el.closest("[data-grid-unplaced-set]") || el.closest(".duo-lrow") || el.closest("li, tr") || el.closest("button") || el.parentElement;
        out.push(`row:${row.innerText.replace(/\s+/g, " ")}`);
      }
    }
    return out;
  });

  // ── L. surfaces ───────────────────────────────────────────────────────────
  const timedId = await (async () => {
    const { bctx, page } = await open();
    const r = await page.evaluate(SOR => {
      const lineup = window.activeLineup();
      const sor = SOR.map(id => lineup.find(a => a.id === id));
      const timed = lineup.find(a => a.day === 4 && a.stage === "uline" && a.start > "13:00");
      return { sor: sor.map(a => a && [a.id, a.start, a.end, window.setTimeStatus(a), !!a.timeEvidence]), timed: timed && [timed.id, timed.start, timed.end, window.fmt12(timed.start)] };
    }, SOR);
    check(r.sor.every(x => x && x[1] === "" && x[2] === "" && x[3] === "unconfirmed" && x[4]), "L. app: all ten load blank, unconfirmed, with their record");
    check(!!r.timed, "L. harness: a timed Uline set later on Jun 25");

    // Lineup list, day 4.
    const list = await sorText(page);
    check(list.some(t => t.startsWith("row:") && t.includes(COPY)), `L. list: School of Rock rows say "${COPY}"`);
    check(!list.some(t => LEGACY.test(t) || /—|–/.test(t.replace(/^aria:/, ""))), `L. list: no legacy time, dash or range on a School of Rock row (${list.filter(t => LEGACY.test(t) || /—|–/.test(t)).slice(0, 2).join(" | ")})`);
    const timedRow = await page.evaluate(([id, , , label]) => {
      const el = [...document.querySelectorAll(".duo-lrow")].find(r => r.querySelector("[data-set-time]") && r.innerText.includes(window.activeLineup().find(a => a.id === id).name));
      return el ? el.querySelector("[data-set-time]").textContent.trim() === label : null;
    }, r.timed);
    check(timedRow === true, "L. list: the timed Uline row on the same day still prints its own time");
    await bctx.close();
    return r.timed[0];
  })();

  {
    // Grid, day 4: the ten never get a block; the unplaced group lists them.
    const { bctx, page } = await open({ view: "grid" });
    const g = await page.evaluate(SOR4 => {
      const blocks = [...document.querySelectorAll("[data-grid-block]")].map(b => b.innerText);
      const group = document.querySelector('[data-grid-unplaced-group="unconfirmed"]');
      return {
        blockSor: blocks.filter(t => /School of Rock/i.test(t)).length,
        blocks: blocks.length,
        groupIds: group ? [...group.querySelectorAll("[data-grid-unplaced-set]")].map(e => e.getAttribute("data-grid-unplaced-set")) : null,
        groupText: group ? group.innerText : "",
        nanTops: [...document.querySelectorAll("[data-grid-block]")].filter(b => !isFinite(parseFloat(b.dataset.top))).length,
      };
    }, SOR4);
    check(g.blocks > 0 && g.blockSor === 0, `L. grid: ${g.blocks} timed blocks, none for School of Rock`);
    check(same((g.groupIds || []).sort(), [...SOR4].sort()), `L. grid: the "Times unconfirmed" group lists the five Jun 25 showcases (${JSON.stringify(g.groupIds)})`);
    check(/Times unconfirmed/.test(g.groupText) && g.groupText.includes(COPY) && !LEGACY.test(g.groupText), "L. grid: the group is labelled and carries the words, no legacy time");
    check(g.nanTops === 0, "L. grid: no block positioned at NaN");
    await bctx.close();
  }

  {
    // Artist page for su179.
    const { bctx, page } = await open({ query: "artist=su179" });
    const t = await page.evaluate(() => ({
      pill: document.querySelector("[data-artist-day-pill]")?.textContent || null,
      card: document.querySelector("[data-artist-set-card]")?.innerText || null,
      body: document.body.innerText,
    }));
    check(t.pill === `DAY 4 · ${COPY}`, `L. artist: the day pill reads "DAY 4 · ${COPY}" (got ${JSON.stringify(t.pill)})`);
    check(t.card && t.card.includes(COPY) && !LEGACY.test(t.card) && !/→/.test(t.card), "L. artist: the set card says the words, no time and no range");
    check(!LEGACY.test(t.body), "L. artist: no legacy time anywhere on the page");
    await bctx.close();
  }

  {
    // At 320 the long pill must wrap clear of the back button, not slide under it.
    const { bctx, page } = await open({ query: "artist=su179", width: 320 });
    const r = await page.evaluate(() => {
      const back = document.querySelector('button[aria-label="Back"]')?.getBoundingClientRect();
      const pill = document.querySelector("[data-artist-day-pill]")?.parentElement.getBoundingClientRect();
      return back && pill ? { backRight: back.right, pillLeft: pill.left, pillRight: pill.right, vw: innerWidth } : null;
    });
    check(r && r.pillLeft >= r.backRight && r.pillRight <= r.vw, `L. artist 320: the day pill clears the back button and the edge (${JSON.stringify(r)})`);
    await bctx.close();
  }

  {
    // Me + saved rows, and every export, with su179 + su152 + a timed set saved.
    const saved = ["su179", "su152", timedId];
    const { bctx, page } = await open({ saved, query: "tab=home" });
    const r = await page.evaluate(async ({ saved, FID }) => {
      const blobs = [], toasts = [], fills = [];
      const B = window.Blob;
      window.Blob = function (parts, opts) { try { blobs.push(parts.map(String).join("")); } catch {} return new B(parts, opts); };
      window.plurskyToast = t => toasts.push(t);
      const ft = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s, ...r) { fills.push(String(s)); return ft.call(this, s, ...r); };
      let printed = "";
      window.open = () => ({ document: { write: h => { printed += h; }, close() {} }, focus() {}, print() {} });
      let clip = "";
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async t => { clip = t; } } });
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      URL.createObjectURL = () => "blob:fixture";
      HTMLAnchorElement.prototype.click = function () {};
      const state = { saved, tab: "lineup" };
      const out = {};
      out.homeText = document.body.innerText;
      out.night = window._nightShareText(saved);
      blobs.length = 0; toasts.length = 0;
      out.ics1 = await window.exportLineupICS(state); out.ics1Body = blobs.join("\n"); out.ics1Toasts = [...toasts];
      blobs.length = 0; toasts.length = 0;
      await window.exportSavedSetsICS(saved); out.ics2Body = blobs.join("\n"); out.ics2Toasts = [...toasts];
      out.print = window.printLineupPDF(state); out.printed = printed;
      out.copy = await window.copyScheduleText(state); out.clip = clip;
      fills.length = 0;
      await window.shareLineupImage(state); out.story = [...fills];
      // The recap video frame for a moment on su179.
      fills.length = 0;
      const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
      const img = document.createElement("canvas"); img.width = 10; img.height = 10;
      window._renderVideoFrame(cv.getContext("2d"), 1080, 1920, 0.5,
        [{ type: "photo", start: 0, end: 1, photo: { img, moment: { id: "m1", artistId: "su179" } } }], { accent: "#000" }, { transitionSec: 0.3 });
      out.frame = [...fills];
      // The artist collage subtitle, captured before any render.
      let sub = null;
      window._shareCollage = async o => { sub = o.subtitle; return { ok: true }; };
      await window._shareArtistCollage(window.activeLineup().find(a => a.id === "su179"), [], "png");
      out.collage = sub;
      // The hero card.
      fills.length = 0;
      window._drawHeroCard(window.activeLineup().find(a => a.id === "su179"), null);
      out.hero = [...fills];
      out.feed = await (await fetch(`/f/${FID}/schedule.json`)).json();
      out.aria = [...document.querySelectorAll("[aria-label]")].map(e => e.getAttribute("aria-label")).filter(l => /School of Rock/i.test(l));
      return out;
    }, { saved, FID });
    const homeSor = r.homeText.split("\n").map((l, i, all) => /School of Rock/.test(l) ? all.slice(Math.max(0, i - 2), i + 3).join(" / ") : null).filter(Boolean);
    check(homeSor.length > 0 && homeSor.every(b => b.includes(COPY) || b.includes(COPY.toUpperCase())) && !homeSor.some(b => LEGACY.test(b)),
      `L. home: every School of Rock row says the words (${homeSor.slice(0, 2).join(" || ")})`);
    check(r.aria.length > 0 && r.aria.every(l => /set times unconfirmed/i.test(l) && !/—|12:00|3:50/.test(l)), `L. aria-labels: every School of Rock label says "set times unconfirmed" (${r.aria.slice(0, 2).join(" | ")})`);
    check(/School of Rock \(set times unconfirmed\)/.test(r.night) && !LEGACY.test(r.night.split("\n").filter(l => /School of Rock/.test(l)).join()), "L. Build My Night text: the words, no time");
    check(r.clip.includes("set times unconfirmed") && !r.clip.split("\n").filter(l => /School of Rock/.test(l)).some(l => LEGACY.test(l) || /—/.test(l)), "L. Copy as text: the words, no time or dash");
    check(r.printed.includes(COPY) && !/School of Rock[\s\S]{0,400}?(12:00 PM|3:50 PM)/.test(r.printed), "L. print: the words in the time cell, no legacy time");
    for (const [k, body, toasts] of [["exportLineupICS", r.ics1Body, r.ics1Toasts], ["exportSavedSetsICS", r.ics2Body, r.ics2Toasts]]) {
      check(/BEGIN:VEVENT/.test(body), `L. ${k}: the timed set is still exported`);
      check(!/plursky-su179|plursky-su152|School of Rock/.test(body), `L. ${k}: no event for a School of Rock set`);
      check(toasts.some(t => t === "2 saved sets left out: set times unconfirmed"), `L. ${k}: says "2 saved sets left out: set times unconfirmed" (${JSON.stringify(toasts)})`);
    }
    check(r.story.some(s => s.includes("SET TIMES UNCONFIRMED")) && !r.story.some(s => LEGACY.test(s) || s === "—"), `L. story image: the words, no time or lone dash (${r.story.filter(s => LEGACY.test(s) || s === "—").join(",")})`);
    check(r.frame.some(s => s.includes("SET TIMES UNCONFIRMED")) && !r.frame.some(s => LEGACY.test(s)), `L. recap video frame: the words (${r.frame.filter(s => /·/.test(s)).join(" | ")})`);
    check(typeof r.collage === "string" && r.collage.endsWith("SET TIMES UNCONFIRMED") && !LEGACY.test(r.collage) && !/–/.test(r.collage), `L. collage subtitle: the words (${r.collage})`);
    // The hero card wraps its meta line and draws bottom-up, so the words
    // arrive as two runs: "…· Set times" and "unconfirmed".
    check(r.hero.some(s => /· Set times$/.test(s)) && r.hero.includes("unconfirmed") && !r.hero.some(s => LEGACY.test(s) || /· —/.test(s)), `L. hero card: the words (${r.hero.join(" | ")})`);
    const feed10 = r.feed.acts.filter(a => SOR.includes(a.id));
    check(feed10.length === 10 && feed10.every(a => a.start === "" && a.end === "" && a.timeStatus === "unconfirmed"), "L. schedule.json: the ten ship blank with timeStatus unconfirmed");
    check(r.feed.acts.filter(a => "timeStatus" in a).length === 10, "L. schedule.json: no other act carries timeStatus");
    await bctx.close();
  }

  // ── S. the map star ──────────────────────────────────────────────────────
  {
    // 13:00 CDT on Thu Jun 25, Summerfest's night 4.
    const { bctx, page } = await open({ query: "tab=map", at: "2026-06-25T18:00:00Z" });
    const s = await page.evaluate(timed => {
      const star = ids => { const o = window.savedStarsByStage(ids); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.artist.id])); };
      const night = window.NOW.night;
      const a = star(["su179", timed]), b = star([timed, "su179"]), only = star(["su152"]);
      // Ordinary TBA (no record): a blank clone of the timed set on the same stage.
      const real = window.activeLineup;
      const t = real().find(x => x.id === timed);
      window.activeLineup = (...args) => [...real(...args), { ...t, id: "tba-fixture", start: "", end: "", timeEvidence: undefined }];
      const tba = star(["tba-fixture", timed]);
      window.activeLineup = real;
      return { night, a, b, only, tba };
    }, timedId);
    check(s.night === 4, `S. harness: the clock sits in Summerfest night 4 (NOW.night ${s.night})`);
    check(s.a.uline === timedId, `S. saved [su179, timed]: the Uline star is the timed set (${JSON.stringify(s.a)})`);
    check(s.b.uline === timedId, `S. saved [timed, su179]: the Uline star is the timed set (${JSON.stringify(s.b)})`);
    check(!("briggs" in s.only), `S. an untimed-only stage (Briggs, su152 saved) gets no star (${JSON.stringify(s.only)})`);
    check(s.tba.uline === timedId, `S. an ordinary TBA saved set is excluded too (${JSON.stringify(s.tba)})`);
    await bctx.close();
  }

  // ── N. the old install's schedule-change notice ──────────────────────────
  {
    const moments = JSON.stringify({ [FID]: [{ id: "m-sor", artistId: "su179", festivalId: FID, night: 4, ts: Date.parse("2026-06-25T17:30:00Z") }] });
    const saved = ["su179", "su152", timedId];
    const { bctx, page } = await open({ saved, query: "tab=lineup&day=4", legacy: true, moments });
    const before = await page.evaluate(fid => ({ saved: localStorage.getItem(`${fid}_saved_v1`), moments: localStorage.getItem("plursky_moments_v1"),
      su179: window.activeLineup().find(a => a.id === "su179")?.start }), FID);
    check(before.su179 === "12:00", "N. harness: the old bundle bills su179 at 12:00");
    // Updates sits with the plan actions, under "My plan".
    await page.click('[data-lineup-show="saved"]');
    await page.clock.runFor(300);
    await page.click("[data-sched-check]");
    let phase = null;
    for (let i = 0; i < 40 && phase !== "ready"; i++) {
      await page.clock.runFor(250);
      phase = await page.evaluate(() => document.querySelector("[data-sched-phase]")?.getAttribute("data-sched-phase") || null);
    }
    const sheet = await page.evaluate(() => document.querySelector("[data-sched-phase]")?.innerText || "");
    check(phase === "ready", `N. Updates opens the review sheet (phase ${phase})`);
    check(/School of Rock/.test(sheet) && /time TBA/.test(sheet), "N. the sheet lists School of Rock moving to time TBA");
    check(!/cancel|removed from your plan|clash/i.test(sheet), "N. nothing is cancelled, dropped from the plan or flagged as a clash");
    const nav = page.waitForEvent("load", { timeout: 30000 }).catch(() => null);
    await page.getByRole("button", { name: "APPLY UPDATE" }).click();
    await page.clock.runFor(2000);
    await nav;
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    await page.clock.runFor(2000);
    const after = await page.evaluate(fid => ({ saved: localStorage.getItem(`${fid}_saved_v1`), moments: localStorage.getItem("plursky_moments_v1"),
      overlay: !!localStorage.getItem("plursky_schedule_overlay_v1"), su179: window.activeLineup().find(a => a.id === "su179")?.start }), FID);
    check(after.overlay, "N. APPLY stored an overlay");
    check(after.saved === before.saved, `N. saved ids are byte-identical after APPLY (${after.saved})`);
    check(after.moments === before.moments, "N. the seeded moment is byte-identical after APPLY");
    check(after.su179 === "", "N. the old install now shows su179 without a time");
    await bctx.close();
  }
  await browser.close();
} finally {
  server.kill();
}

console.log(`  ${failed ? "✗" : "✓"}  Summerfest School of Rock runtime: ${checks - failed}/${checks} checks`);
process.exit(failed ? 1 : 0);

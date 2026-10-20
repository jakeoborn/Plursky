#!/usr/bin/env node
// L3 (Oct 16 spec), Jake's exact case on III Points 2026, Friday night:
// Vintage Culture B2B Max Styler 02:00–04:00 (Isotropic) and PAWSA 02:30–04:00
// (Mind Melt) are both saved — a real 2:30–4:00 overlap. Rendered in the app:
//   banner   a full overlap reads "1 clash", never "tight transition" (the
//            old banner counted conflicts as tight transitions);
//   split    Resolve → Split the night → switch 3:00 → Split here clears the
//            clash on both rows, the banner, the alert and the Lineup day chip,
//            and the rows say "2:00 AM → you leave 3:00 AM" / "You arrive 3:00 AM";
//   persist  a reload keeps the split;
//   reset    Reset restores both whole sets and the clash comes back;
//   keepboth Keep both dismisses the banner; rows read "overlap accepted", no red.
// Controls: the same steps on a pair that does NOT overlap change nothing.
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
const toMin = hhmm => { const [h, m] = hhmm.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "iii-points-2026", AT = "2026-10-17T05:00:00Z";          // Fri night, 1:00 AM ET
const VC = "iiip-max-styler-b2b-vintage-cul", PW = "iiip-pawsa";
const URL = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`;

try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 900 } });
  await wireVendor(ctx);
  await ctx.clock.install({ time: new Date(AT) });
  // Seed once (not on every load): the reload step must read what the app wrote.
  await ctx.addInitScript(([fid, ids]) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(ids));
  }, [FID, [VC, PW]]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  const boot = async () => {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    await page.clock.runFor(1200);
  };
  const openNight = async () => {
    const b = page.locator('[aria-label="Follow your night: open my night"]');
    await b.first().click({ timeout: 20000 }); await page.clock.runFor(600); await page.waitForTimeout(300);
  };
  const read = () => page.evaluate(([vc, pw]) => {
    const t = document.body.innerText;
    const row = id => document.querySelector(`[data-attend-window="${id}"]`)?.innerText || "";
    const pa = ARTISTS.find(a => a.id === pw), va = ARTISTS.find(a => a.id === vc);
    return {
      banner: document.querySelector("[data-plan-banner]")?.innerText || "",
      tightWord: /tight transition/i.test(document.querySelector("[data-plan-banner]")?.innerText || ""),
      clashWord: (t.match(/· clash/g) || []).length,
      accepted: document.querySelectorAll("[data-overlap-accepted]").length,
      vcRow: row(vc), pwRow: row(pw),
      pred: { clash: setsClash(va, pa), acc: setsOverlapAccepted(va, pa) },
      alerts: computeAlerts([vc, pw], 1, "01:00").filter(x => x.kind === "conflict").length,
    };
  }, [VC, PW]);

  await boot(); await openNight();
  let r = await read();
  check(r.pred.clash, "fixture: the two saved sets clash (2:30–4:00 overlap)");
  check(/^1 clash$/.test(r.banner) && !r.tightWord, `banner says "1 clash", not tight transitions (got "${r.banner}")`);
  check(r.alerts === 1, `one conflict alert before the split (got ${r.alerts})`);

  // Split at 3:00 through the UI.
  await page.locator("button", { hasText: /^Resolve$/ }).first().click(); await page.clock.runFor(300);
  await page.locator("button", { hasText: /^Split the night$/ }).first().click(); await page.clock.runFor(300);
  const sheet = await page.locator("[data-split-sheet]").count();
  check(sheet === 1, "Split the night opens the split picker (it used to jump to the Map)");
  const preview0 = await page.locator("[data-split-time]").first().innerText().catch(() => "");
  check(/2:30/.test(preview0), `default switch is the later set's start, 2:30 (got "${preview0}")`);
  await page.locator("#split-switch").evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }, 27 * 60);
  await page.clock.runFor(200);
  const prev = await page.locator("[data-split-preview]").innerText();
  check(/2:00 AM–3:00 AM/.test(prev) && /3:00 AM–4:00 AM/.test(prev), `live preview shows the split before confirm (${prev.replace(/\n/g, " | ")})`);
  await page.locator("[data-split-confirm]").click(); await page.clock.runFor(500); await page.waitForTimeout(200);
  r = await read();
  check(!r.pred.clash && r.clashWord === 0, `after the split there is no clash (predicate ${r.pred.clash}, "· clash" ×${r.clashWord})`);
  // The row leads with when you arrive, the time its countdown counts to.
  const lead = await page.evaluate(pw => { const row = document.querySelector(`[data-attend-window="${pw}"]`); let el = row; while (el && !el.querySelector(".duo-data")) el = el.parentElement; return el?.querySelector(".duo-data")?.textContent.trim() || ""; }, PW);
  check(lead === "3:00 AM", `after the split PAWSA's row leads with its arrival, 3:00 AM (got "${lead}")`);
  check(!/clash/i.test(r.banner), `the banner no longer counts a clash (got "${r.banner}")`);
  check(r.alerts === 0, `no conflict alert after the split (got ${r.alerts})`);
  check(/2:00 AM → you leave 3:00 AM/.test(r.vcRow), `Vintage Culture row: "2:00 AM → you leave 3:00 AM" (got "${r.vcRow}")`);
  check(/You arrive 3:00 AM/.test(r.pwRow), `PAWSA row: "You arrive 3:00 AM" (got "${r.pwRow}")`);

  // Lineup's day chip counts no clash either.
  const chipClash = await page.evaluate(() => {
    let n = 0; const s = ARTISTS.filter(a => a.day === 1 && ["iiip-max-styler-b2b-vintage-cul", "iiip-pawsa"].includes(a.id));
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (setsClash(s[i], s[j])) n++;
    return n;
  });
  check(chipClash === 0, `Lineup's clash count for the day is 0 (got ${chipClash})`);

  // Persistence across a reload.
  await boot(); await openNight();
  r = await read();
  check(!r.pred.clash && /you leave 3:00 AM/.test(r.vcRow) && /You arrive 3:00 AM/.test(r.pwRow), "the split survives a reload");

  // A half-split never outlives its partner: with Vintage Culture no longer
  // saved, PAWSA reads as its whole set again (any removal path).
  const orphan = await page.evaluate(([fid, vc, pw]) => {
    const k = `${fid}_saved_v1`, keep = localStorage.getItem(k);
    localStorage.setItem(k, JSON.stringify([pw]));
    const w = attendWindow(ARTISTS.find(a => a.id === pw));
    localStorage.setItem(k, keep);
    return { partial: w.partial, back: attendWindow(ARTISTS.find(a => a.id === pw)).partial };
  }, [FID, VC, PW]);
  check(!orphan.partial && orphan.back, `unsaving one half drops the other half's window (partial ${orphan.partial}; restored ${orphan.back})`);

  // Reset restores the whole sets and the clash.
  await page.locator(`[data-attend-window="${VC}"] [data-attend-reset]`).click(); await page.clock.runFor(400);
  r = await read();
  check(r.pred.clash && r.vcRow === "" && r.pwRow === "" && /^1 clash$/.test(r.banner), `Reset restores both sets and the clash (clash ${r.pred.clash}, banner "${r.banner}")`);

  // Keep both: accepted, no alarm.
  await page.locator("button", { hasText: /^Resolve$/ }).first().click(); await page.clock.runFor(300);
  await page.locator("button", { hasText: /^Keep both$/ }).first().click(); await page.clock.runFor(400);
  r = await read();
  check(!r.pred.clash && r.pred.acc, "Keep both: the pair is accepted, not a clash");
  check(r.banner === "" && r.clashWord === 0 && r.accepted >= 1, `Keep both: no banner, no red, "overlap accepted" on the row (banner "${r.banner}", accepted ×${r.accepted})`);
  check(r.alerts === 0, `Keep both: no conflict alert (got ${r.alerts})`);

  // Control: two sets that do not overlap never clash, before or after.
  const ctl = await page.evaluate(() => {
    const day1 = ARTISTS.filter(a => a.day === 1 && a.start && a.end && a.stage === "mind-melt").sort((x, y) => toNightMin(x.start) - toNightMin(y.start));
    const [x, y] = day1; return x && y ? { clash: setsClash(x, y), raw: overlaps(x, y) } : null;
  });
  check(ctl && !ctl.raw && !ctl.clash, "control: back-to-back sets on one stage are not a clash");
  // Codex P1 (#335): two sets that START TOGETHER (ARC's AZZECCA 16:00–17:30 /
  // CAMOUFLY 16:00–17:00 shape). The old default switch was the shared start,
  // a zero-length first half that attendWindow drops, so confirming the
  // untouched picker left the clash standing.
  const zero = await page.evaluate(fid => {
    const a = { id: "t-zl-a", start: "16:00", end: "17:30", day: 1 }, b = { id: "t-zl-b", start: "16:00", end: "17:00", day: 1 };
    // A split holds only while its partner is in the lineup, so the synthetic
    // pair joins it for the duration of the check.
    window.ARTISTS.push(a, b);
    const key = `${fid}_saved_v1`, keep = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify([...(JSON.parse(keep || "[]")), a.id, b.id]));
    const r = splitRange(a, b);
    const before = setsClash(a, b);
    splitNight(a, b, r.def);
    const after = setsClash(a, b), wa = attendWindow(a), wb = attendWindow(b);
    resetAttendWindow(a.id); resetAttendWindow(b.id);
    // No non-empty split exists: both 16:00–16:05.
    const c = { id: "t-zl-c", start: "16:00", end: "16:05", day: 1 }, d = { id: "t-zl-d", start: "16:00", end: "16:05", day: 1 };
    const none = splitRange(c, d);
    splitNight(c, d, none.def);
    const wrote = c.id in attendWindows() || d.id in attendWindows();
    if (keep == null) localStorage.removeItem(key); else localStorage.setItem(key, keep);
    window.ARTISTS.splice(window.ARTISTS.indexOf(a), 1); window.ARTISTS.splice(window.ARTISTS.indexOf(b), 1);
    return { ok: r.ok, lo: r.lo, startMin: toNightMin("16:00"), before, after, pa: wa.partial, pb: wb.partial, noneOk: none.ok, wrote };
  }, FID);
  check(zero.ok && zero.lo > zero.startMin, `same-start pair: the default switch is strictly after the shared start (lo ${zero.lo} > ${zero.startMin})`);
  check(zero.before && !zero.after && zero.pa && zero.pb, `same-start pair: confirming the default split clears the clash with two non-empty halves (before ${zero.before}, after ${zero.after})`);
  check(!zero.noneOk && !zero.wrote, "a pair with no non-empty 5-minute split offers none and writes nothing");

  // Codex P1 (#335): Today's plan checks EVERY earlier saved set, not only the
  // adjacent one. A real Friday triple where x spans z, y sits between: accept
  // x/y and the x/z clash must still be reported.
  const tri = await page.evaluate(fid => {
    const night = NOW.night, L = activeLineup().filter(a => a.day === night && a.start && a.end);
    const m = s => toNightMin(s);
    let t = null;
    for (const x of L) { for (const y of L) { if (y === x || m(y.start) < m(x.start) || !overlaps(x, y)) continue;
      for (const z of L) { if (z === x || z === y || m(z.start) <= m(y.start) || overlaps(y, z) || !overlaps(x, z)) continue; t = [x, y, z]; break; }
      if (t) break; } if (t) break; }
    if (!t) return null;
    const [x, y, z] = t, key = `${fid}_saved_v1`, keep = localStorage.getItem(key), kb = localStorage.getItem(CLASH_KEPT_BOTH_KEY);
    localStorage.setItem(key, JSON.stringify([x.id, y.id, z.id]));
    acceptClash(x, y);
    const plan = buildTonightsPlan({ saved: [x.id, y.id, z.id] });
    const rowZ = plan.find(p => p.artist.id === z.id);
    const pairs = plan.flatMap(p => (p.clashes || []).map(b => [b.id, p.artist.id].join(">")));
    const alertXZ = computeAlerts([x.id, y.id, z.id], night, "00:00").some(o => o.kind === "conflict" && o.id === `conflict_${x.id}_${z.id}`);
    if (keep == null) localStorage.removeItem(key); else localStorage.setItem(key, keep);
    if (kb == null) localStorage.removeItem(CLASH_KEPT_BOTH_KEY); else localStorage.setItem(CLASH_KEPT_BOTH_KEY, kb);
    return { names: t.map(a => `${a.name} ${a.start}-${a.end}`), zConflict: !!rowZ?.conflict, xz: pairs.includes(`${x.id}>${z.id}`), xy: pairs.includes(`${x.id}>${y.id}`), n: pairs.length, alertXZ };
  }, FID);
  check(!!tri, "a real Friday triple (first spans third, middle clear of third) exists to test");
  check(tri && tri.zConflict && tri.xz && !tri.xy, `accepting the first pair leaves the first/third clash reported (${tri ? tri.names.join(" · ") : "none"}; pairs ${tri?.n})`);
  check(tri && tri.alertXZ, "the in-app alerts report the same first/third clash (every pair, not neighbours)");

  // Codex P2s (#335): after Jake's split at 3:00 (VC keeps 2:00–3:00, PAWSA
  // 3:00–4:00), Today's row status and the in-app reminder follow the attend
  // window, not the published set.
  // NOW is a Proxy over the clock, so the clock moves (AT = 1:00 AM ET).
  const keepP2 = await page.evaluate(([fid, vc, pw]) => {
    const key = `${fid}_saved_v1`, keep = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify([vc, pw]));
    const L = activeLineup();
    splitNight(L.find(a => a.id === vc), L.find(a => a.id === pw), toNightMin("03:00"));
    return keep;
  }, [FID, VC, PW]);
  const rowsAt = async iso => { await page.clock.setSystemTime(new Date(iso)); return page.evaluate(([vc, pw]) => {
    const plan = buildTonightsPlan({ saved: [vc, pw] });
    const v = plan.find(p => p.artist.id === vc), p = plan.find(p => p.artist.id === pw);
    return { now: NOW.time, v: { live: v.isLive, past: v.isPast }, p: { live: p.isLive, mins: p.minsUntil } };
  }, [VC, PW]); };
  // Home's "Your plan" card is another door onto the same windows: at 2:40 it
  // must lift Vintage Culture (Live, to 3:00), at 3:10 PAWSA (Live, to 4:00),
  // never PAWSA Live from its published 2:30 while the plan has you elsewhere.
  const cardAt = async iso => { await page.clock.setSystemTime(new Date(Date.parse(iso) - 61000)); await page.keyboard.press("Escape").catch(() => {}); await page.clock.runFor(61000);
    return page.evaluate(() => { const c = document.querySelector("[data-duo-plan]"); return c ? c.innerText.replace(/\s+/g, " ") : ""; }); };
  const c240 = await cardAt("2026-10-17T06:40:00Z"), c310 = await cardAt("2026-10-17T07:10:00Z");
  check(/Vintage Culture/i.test(c240) && /TO 3:00/.test(c240) && /20 MIN LEFT/.test(c240) && !/PAWSA/i.test(c240), `2:40: Your plan lifts Vintage Culture, Live to 3:00, 20 min left (${c240})`);
  check(/PAWSA/i.test(c310) && /TO 4:00/.test(c310) && !/Vintage/i.test(c310), `3:10: Your plan lifts PAWSA, Live to 4:00 (${c310})`);
  const r1 = await rowsAt("2026-10-17T06:40:00Z"), r2 = await rowsAt("2026-10-17T07:10:00Z");
  await page.clock.setSystemTime(new Date(AT));
  const p2 = await page.evaluate(([fid, vc, pw, keep]) => {
    const a1 = computeAlerts([vc, pw], NOW.night, "02:40").find(o => o.id === `remind_${pw}`);
    const a0 = computeAlerts([vc, pw], NOW.night, "02:10").find(o => o.id === `remind_${pw}`);
    resetAttendWindow(vc); resetAttendWindow(pw);
    const key = `${fid}_saved_v1`;
    if (keep == null) localStorage.removeItem(key); else localStorage.setItem(key, keep);
    return { a1: a1 ? a1.title + " | " + a1.body : null, a0: !!a0 };
  }, [FID, VC, PW, keepP2]);
  Object.assign(p2, { pw240: r1.p, vc240: r1.v.live, vc310: r2.v, pw310: r2.p.live, t: [r1.now, r2.now] });
  check(!p2.pw240.live && p2.pw240.mins === 20 && p2.vc240, `2:40, before the switch: PAWSA counts down 20 min (at ${p2.t[0]}: live ${p2.pw240.live}, ${p2.pw240.mins}m), VC is Live`);
  check(!p2.vc310.live && p2.vc310.past && p2.pw310, `3:10, after the switch: VC is Done, PAWSA is Live (vc live ${p2.vc310.live}, past ${p2.vc310.past})`);
  check(p2.a1 && /you arrive in 20 min/.test(p2.a1) && /3:00 AM/.test(p2.a1), `the in-app reminder counts to the arrival (${p2.a1})`);
  check(!p2.a0, "at 2:10 the published 2:30 start raises no reminder: the arrival is 50 min out");


  // Codex P1 (#335, r4325845282): a split whose partner LEFT THE LINEUP. A
  // schedule update can drop an act while its raw saved id stays (orphans are
  // kept, savedInLineup). The surviving half used to keep its partial window:
  // "You arrive 3:00 AM", a reminder timed to that arrival, and a clash
  // computed on half a set. Every case below is read from persisted state.
  const stale = await page.evaluate(([fid, vc, pw]) => {
    const sk = `${fid}_saved_v1`, ak = `${fid}_attend_v1`;
    const keepS = localStorage.getItem(sk), keepA = localStorage.getItem(ak);
    const L = window.ARTISTS, va = L.find(a => a.id === vc), pa = L.find(a => a.id === pw);
    const split = { [vc]: { start: "02:00", end: "03:00", with: pw }, [pw]: { start: "03:00", end: "04:00", with: vc } };
    const put = (saved, att) => { localStorage.setItem(sk, JSON.stringify(saved)); localStorage.setItem(ak, JSON.stringify(att)); };
    const win = () => attendWindow(pa);
    const out = {};
    put([vc, pw], split);
    out.present = win().partial && setsClash(va, pa) === false;
    // The partner leaves the lineup; its saved id and both stored halves stay.
    L.splice(L.indexOf(va), 1);
    out.removed = win();
    out.removedReminder = (computeAlerts([vc, pw], 1, "02:10").find(o => o.id === `remind_${pw}`) || {}).body || null;
    out.keptStored = Object.keys(attendWindows()).length === 2 && JSON.parse(localStorage.getItem(sk)).includes(vc);
    L.push(va);
    out.back = win().partial;                       // the act returns: so does the split
    put([pw], split);  out.unsaved = win().partial;
    put([vc, pw], { [pw]: split[pw] });                       out.noReciprocal = win().partial;
    put([vc, pw], { ...split, [vc]: { ...split[vc], with: "someone-else" } }); out.wrongWith = win().partial;
    put([vc, pw], { ...split, [vc]: { start: "05:00", end: "06:00", with: pw } }); out.outside = win().partial;
    put([vc, pw], { ...split, [vc]: "garbage" });            out.garbage = win().partial;
    put([vc, pw], { ...split, [vc]: { start: null, end: 3, with: pw } }); out.nulls = win().partial;
    // Another festival's split resolves against THAT festival's lineup, not the
    // active one (the switcher's per-festival clash count reads it).
    const ofid = "edc-lv-2026", O = window._DATA_SETS[ofid].artists;
    const oa = O.find(a => a.id === "cg4"), ob = O.find(a => a.id === "k4");
    const osk = `${ofid}_saved_v1`, oak = `${ofid}_attend_v1`, ko = [localStorage.getItem(osk), localStorage.getItem(oak)];
    localStorage.setItem(osk, JSON.stringify([oa.id, ob.id])); localStorage.removeItem(oak);
    out.otherBefore = _festivalPlanStatus(ofid).conflicts;
    splitNight(oa, ob, toNightMin("22:32"), ofid);
    out.otherAfter = _festivalPlanStatus(ofid).conflicts;
    out.otherPartial = attendWindow(oa, ofid).partial && attendWindow(ob, ofid).partial;
    [[osk, ko[0]], [oak, ko[1]]].forEach(([k, v]) => v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
    // The edit/split boundary never throws on a missing set.
    let boundary = "ok";
    try {
      const r = splitRange(pa, undefined); if (r.ok) boundary = "splitRange offered a split with a missing set";
      splitNight(pa, undefined, 180);
      const host = document.createElement("div"); document.body.appendChild(host);
      ReactDOM.flushSync(() => ReactDOM.createRoot(host).render(React.createElement(SplitNightSheet, { pair: [pa, undefined] })));
      if (host.childElementCount) boundary = "sheet rendered for a missing set";
      host.remove();
    } catch (e) { boundary = "THREW: " + e.message; }
    out.boundary = boundary;
    if (keepS == null) localStorage.removeItem(sk); else localStorage.setItem(sk, keepS);
    if (keepA == null) localStorage.removeItem(ak); else localStorage.setItem(ak, keepA);
    return out;
  }, [FID, VC, PW]);
  check(stale.present, "partner present: the split holds and clears the clash");
  check(!stale.removed.partial && stale.removed.start === "02:30", `partner removed from the lineup (id still saved): PAWSA is its whole set again (partial ${stale.removed.partial}, start ${stale.removed.start})`);
  check(stale.removedReminder && /2:30 AM/.test(stale.removedReminder) && !/arrive/.test(stale.removedReminder), `…and its reminder counts to the published 2:30 start (${stale.removedReminder})`);
  check(stale.keptStored, "…and the orphan saved id and both stored halves are kept, not deleted");
  check(stale.back, "the partner returns to the lineup: the kept split holds again");
  check(!stale.unsaved, "partner unsaved: whole set");
  check(!stale.noReciprocal, "partner's half missing: whole set");
  check(!stale.wrongWith, "partner's half points at another set: whole set");
  check(!stale.outside, "partner's half no longer inside its set: whole set");
  check(!stale.garbage && !stale.nulls, "malformed stored halves (a string, null/number ends): whole set, no throw");
  check(stale.otherBefore === 1 && stale.otherAfter === 0 && stale.otherPartial, `another festival's split resolves against its own lineup (EDC LV clash count ${stale.otherBefore} → ${stale.otherAfter})`);
  check(stale.boundary === "ok", `a missing set at the edit/split boundary offers nothing and throws nothing (${stale.boundary})`);

  // Persisted stale state through the real UI: reload with the partner gone,
  // open the night, the row reads whole and offers no Edit.
  await page.evaluate(([fid, vc, pw]) => {
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify([vc, pw]));
    localStorage.setItem(`${fid}_attend_v1`, JSON.stringify({ [vc]: { start: "02:00", end: "03:00", with: pw }, [pw]: { start: "03:00", end: "04:00", with: vc } }));
    sessionStorage.setItem("__drop", vc);
  }, [FID, VC, PW]);
  await ctx.addInitScript(() => {
    const vc = sessionStorage.getItem("__drop"); if (!vc) return;
    const iv = setInterval(() => { if (window._DATA_SETS && window.ARTISTS && window.FESTIVAL_CONFIG) {
      for (const L of [window.ARTISTS, ...Object.values(window._DATA_SETS).map(d => d.artists)]) { const i = L.findIndex(a => a.id === vc); if (i >= 0) L.splice(i, 1); }
      clearInterval(iv); } }, 1);
  });
  await boot(); await openNight();
  const staleUi = await page.evaluate(([vc, pw]) => ({
    gone: !ARTISTS.some(a => a.id === vc),
    row: document.querySelector(`[data-attend-window="${pw}"]`)?.innerText || "",
    edit: document.querySelectorAll("[data-attend-edit]").length,
  }), [VC, PW]);
  await page.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/stale-partner-390.png` : "/dev/null" }).catch(() => {});
  check(staleUi.gone && staleUi.row === "" && staleUi.edit === 0, `reloaded with the partner gone: PAWSA's row is the whole set, no Edit (row "${staleUi.row}", edit ×${staleUi.edit})`);
  await page.evaluate(() => sessionStorage.removeItem("__drop"));

  // Codex P2 (#335, r4325845294): ONE switch grid. EDC LV 2026's shipped
  // I Hate Models 22:00–23:15 / Chris Lorenzo 22:07–23:15: lo is 22:07, so the
  // slider steps 22:07, 22:12, …; confirm used to round from midnight and save
  // 22:10 for a previewed 22:12. Driven through the real Resolve → Split sheet.
  const EFID = "edc-lv-2026", IHM = "cg4", CL = "k4";
  const ectx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 900 } });
  await wireVendor(ectx);
  await ectx.clock.install({ time: new Date("2026-05-16T04:30:00Z") });   // Fri May 15, 9:30 PM PDT
  await ectx.addInitScript(([fid, ids]) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(ids));
  }, [EFID, [IHM, CL]]);
  const ep = await ectx.newPage(); ep.on("pageerror", e => errors.push(e.message));
  await ep.goto(`http://127.0.0.1:${PORT}/index.html?f=${EFID}&tab=home`, { waitUntil: "domcontentloaded" });
  await ep.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, EFID, { timeout: 60000 });
  await ep.clock.runFor(1200);
  await ep.locator('[aria-label="Follow your night: open my night"]').first().click({ timeout: 20000 }); await ep.clock.runFor(600);
  await ep.locator("button", { hasText: /^Resolve$/ }).first().click(); await ep.clock.runFor(300);
  await ep.locator("button", { hasText: /^Split the night$/ }).first().click(); await ep.clock.runFor(300);
  const slide = async v => { await ep.locator("#split-switch").evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }, v); await ep.clock.runFor(200); return { t: await ep.locator("[data-split-time]").innerText(), v: Number(await ep.locator("#split-switch").inputValue()) }; };
  const g = await ep.evaluate(() => { const r = splitRange(ARTISTS.find(a => a.id === "cg4"), ARTISTS.find(a => a.id === "k4")); return { lo: r.lo, hi: r.hi, min: Number(document.querySelector("#split-switch").min) }; });
  const d0 = await ep.locator("[data-split-time]").innerText();
  check(g.lo === toMin("22:07") && g.min === g.lo && d0 === "10:07 PM", `fixture: lo is 22:07, off the midnight 5-minute grid, and the default reads 10:07 PM (lo ${g.lo}, "${d0}")`);
  const top = await slide(9999), bot = await slide(-50);
  check(top.t === "11:07 PM" && top.v === toMin("23:07"), `top endpoint: the slider stops on the grid at 11:07 PM, not hi 11:10 (got "${top.t}", ${top.v})`);
  check(bot.t === "10:07 PM" && bot.v === g.lo, `bottom endpoint: 10:07 PM (got "${bot.t}")`);
  const pick = await slide(toMin("22:12"));
  await ep.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/offgrid-preview-390.png` : "/dev/null" }).catch(() => {});
  const pv = await ep.locator("[data-split-preview]").innerText();
  check(pick.t === "10:12 PM" && /10:00 PM–10:12 PM/.test(pv) && /10:12 PM–11:15 PM/.test(pv), `preview at 10:12 PM (${pv.replace(/\n/g, " | ")})`);
  await ep.locator("[data-split-confirm]").click(); await ep.clock.runFor(500); await ep.waitForTimeout(200);
  const saved = await ep.evaluate(([fid, ihm, cl]) => {
    const w = attendWindows(fid), L = ARTISTS;
    const rem = computeAlerts([ihm, cl], 1, "21:50").find(o => o.id === `remind_${cl}`);
    return { ihm: w[ihm], cl: w[cl], lab: attendWindowLabel(L.find(a => a.id === cl)), labI: attendWindowLabel(L.find(a => a.id === ihm)),
      row: document.querySelector(`[data-attend-window="${cl}"]`)?.innerText || "", rem: rem ? rem.title + " | " + rem.body : null };
  }, [EFID, IHM, CL]);
  await ep.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/offgrid-saved-row-390.png` : "/dev/null" }).catch(() => {});
  check(saved.ihm?.end === "22:12" && saved.cl?.start === "22:12", `saved window is the previewed 22:12, not 22:10 (I Hate Models ends ${saved.ihm?.end}, Chris Lorenzo starts ${saved.cl?.start})`);
  check(/You arrive 10:12 PM/.test(saved.lab) && /you leave 10:12 PM/.test(saved.labI) && /10:12 PM/.test(saved.row), `labels match the preview ("${saved.lab}" / "${saved.labI}")`);
  check(saved.rem && /you arrive in 22 min/.test(saved.rem) && /10:12 PM/.test(saved.rem), `the reminder counts to 10:12 PM (${saved.rem})`);
  // The grid rule itself: out of bounds, malformed, off-step, midnight.
  const rule = await ep.evaluate(() => {
    if (typeof snapSplitSwitch !== "function") return { missing: true };
    const lo = toNightMin("22:07"), hi = toNightMin("23:10");
    const m = toNightMin("23:57"), mh = toNightMin("01:00");
    return { neg: snapSplitSwitch(-5, lo, hi), big: snapSplitSwitch(1e9, lo, hi), nan: snapSplitSwitch(NaN, lo, hi), str: snapSplitSwitch("abc", lo, hi),
      num: snapSplitSwitch("1337", lo, hi), off: snapSplitSwitch(lo + 3, lo, hi), mid: nightMinToHHMM(snapSplitSwitch(m + 5, m, mh)), midTop: nightMinToHHMM(snapSplitSwitch(1e9, m, mh)), lo, hi };
  });
  check(rule.neg === rule.lo && rule.big === rule.lo + 60 && rule.nan === rule.lo && rule.str === rule.lo, `out-of-bounds and malformed switches land on the grid (${rule.neg}, ${rule.big}, ${rule.nan}, ${rule.str})`);
  check(rule.num === 1337 && rule.off === rule.lo + 5, `a numeric string keeps its grid value; an off-step value rounds along the grid from lo (${rule.num}, ${rule.off})`);
  check(rule.mid === "00:02" && rule.midTop === "00:57", `midnight rollover: a 23:57 grid steps to 00:02 and tops out at 00:57 (${rule.mid}, ${rule.midTop})`);
  await ectx.close();

  // Codex P1/P2s on d35f737, reproduced on ARC 2026 Friday: AZZECCA 16:00–17:30
  // (Grid) and TIGA B2B BRUNELLO 16:00–17:30 (Expansions) split at 17:25 leave
  // TIGA 17:25–17:30, still over ZULAN 17:00–18:00 (area909).
  //   one split per act  (Jake's ruling) splitting TIGA/ZULAN used to overwrite
  //                      TIGA's partner, so AZZECCA's clash came back and TIGA
  //                      read 16:00–17:15. It is refused, atomically, and the
  //                      sheet names the split holding it;
  //   plan order         rows follow the arrival, so ZULAN 17:00 sits above
  //                      TIGA's 17:25 and prev/walk/tight read true neighbours;
  //   reminder wording   a delayed arrival is "you arrive in", web and native.
  const AFID = "arc-2026", AZ = "arc-azzecca-grid-d1", TI = "arc-tiga-b2b-brunello-expansions-d1", ZU = "arc-zulan-area909-d1";
  const actx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 900 } });
  await wireVendor(actx);
  await actx.clock.install({ time: new Date("2026-09-04T21:30:00Z") });   // Fri Sep 4, 4:30 PM CDT
  await actx.addInitScript(([fid, ids]) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(ids));
  }, [AFID, [AZ, TI, ZU]]);
  const ap = await actx.newPage(); ap.on("pageerror", e => errors.push(e.message));
  const aboot = async () => {
    await ap.goto(`http://127.0.0.1:${PORT}/index.html?f=${AFID}&tab=home`, { waitUntil: "domcontentloaded" });
    await ap.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, AFID, { timeout: 60000 });
    await ap.clock.runFor(1200);
  };
  await aboot();
  const arc = await ap.evaluate(([fid, az, ti, zu]) => {
    const A = id => ARTISTS.find(a => a.id === id), key = `${fid}_attend_v1`;
    const raw = () => localStorage.getItem(key);
    const w = id => { const x = attendWindow(A(id)); return `${x.start}-${x.end}${x.with ? ">" + x.with : ""}`; };
    const blockerOf = (a, b) => typeof splitBlocker === "function" ? splitBlocker(a, b) : null;   // absent before the fix
    const r = { pre: setsClash(A(az), A(ti)) && setsClash(A(ti), A(zu)) };
    r.first = splitNight(A(az), A(ti), toNightMin("17:25")) !== false;
    r.afterFirst = { az: w(az), ti: w(ti), clearedAzTi: !setsClash(A(az), A(ti)), tiZu: setsClash(A(ti), A(zu)) };
    // Refused, both orders and both acts already paired: nothing is written.
    const before = raw();
    r.blocker = (b => b && [b.act.id, b.partner.id])(blockerOf(A(ti), A(zu)));
    r.refused = [splitNight(A(ti), A(zu), toNightMin("17:15")), splitNight(A(zu), A(ti), toNightMin("17:15")), splitNight(A(az), A(zu), toNightMin("17:10"))];
    r.unchanged = raw() === before && !setsClash(A(az), A(ti)) && w(ti) === `17:25-17:30>${az}`;
    // The plan follows the arrival.
    r.plan = buildTonightsPlan({ saved: [az, ti, zu] }).map(p => [p.artist.id, p.win.start, p.prev ? p.prev.id : null]);
    // The same pair can still be adjusted.
    r.adjust = (splitNight(A(az), A(ti), toNightMin("17:10")) !== false) && w(az) === `16:00-17:10>${ti}` && w(ti) === `17:10-17:30>${az}`;
    // Reset, then the other pair splits.
    resetAttendWindow(az); resetAttendWindow(ti);
    r.resplit = (splitNight(A(ti), A(zu), toNightMin("17:15")) !== false) && w(ti) === `16:00-17:15>${zu}` && w(zu) === `17:15-18:00>${ti}` && w(az) === "16:00-17:30";
    // A partner that is no longer saved, or no longer in the lineup, locks
    // nothing: the act it pointed at may join a new split. Stored windows are
    // left alone (no repair of old saved plans).
    resetAttendWindow(ti); resetAttendWindow(zu);
    splitNight(A(az), A(ti), toNightMin("17:25"));
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify([ti, zu]));
    r.unsavedFree = !blockerOf(A(ti), A(zu)) && (splitNight(A(ti), A(zu), toNightMin("17:15")) !== false) && w(ti) === `16:00-17:15>${zu}`;
    r.orphanKept = JSON.parse(raw())[az]?.with === ti;
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify([az, ti, zu]));
    localStorage.setItem(key, JSON.stringify({ [ti]: { start: "17:25", end: "17:30", with: "arc-gone-d1" }, "arc-gone-d1": { start: "16:00", end: "17:25", with: ti } }));
    r.goneFree = !blockerOf(A(ti), A(zu)) && splitNight(A(ti), A(zu), toNightMin("17:15")) !== false;
    r.goneKept = !!JSON.parse(raw())["arc-gone-d1"];
    // Back to the ruled case for the UI and the reminders below.
    localStorage.setItem(key, "{}");
    splitNight(A(az), A(ti), toNightMin("17:25"));
    return r;
  }, [AFID, AZ, TI, ZU]);
  check(arc.pre && arc.first && arc.afterFirst.clearedAzTi && arc.afterFirst.tiZu, `fixture: AZZECCA/TIGA split at 17:25 clears that clash and leaves TIGA over ZULAN (${JSON.stringify(arc.afterFirst)})`);
  check(arc.blocker?.[0] === TI && arc.blocker?.[1] === AZ, `TIGA/ZULAN is blocked by TIGA's split with AZZECCA (${arc.blocker})`);
  check(arc.refused.every(x => x === false) && arc.unchanged, `a second split is refused in either order and writes nothing: both first-split windows unchanged, AZZECCA/TIGA still clear (${arc.refused})`);
  check(arc.plan.map(p => p[0]).join() === [AZ, ZU, TI].join() && arc.plan[2][2] === ZU && arc.plan[1][2] === AZ, `plan ordered by arrival: AZZECCA 16:00, ZULAN 17:00, TIGA 17:25, each prev its true neighbour (${JSON.stringify(arc.plan)})`);
  check(arc.adjust, "the same pair can be re-split at a new time");
  check(arc.resplit, "after Reset, TIGA/ZULAN splits and AZZECCA is whole");
  check(arc.unsavedFree && arc.orphanKept, `an unsaved partner does not lock the act out of a new split, and its stored window is kept (${arc.unsavedFree}, ${arc.orphanKept})`);
  check(arc.goneFree && arc.goneKept, `a partner gone from the lineup does not lock the act out, and its stored window is kept (${arc.goneFree}, ${arc.goneKept})`);

  // The refusal through the real sheet, then the reminders.
  await aboot();
  await ap.locator('[aria-label="Follow your night: open my night"]').first().click({ timeout: 20000 }); await ap.clock.runFor(600); await ap.waitForTimeout(200);
  const order = await ap.evaluate(() => [...document.querySelectorAll("[data-plan-row]")].map(e => e.getAttribute("data-plan-row")));
  check(order.indexOf(ZU) >= 0 && order.indexOf(ZU) < order.indexOf(TI), `rendered night lists ZULAN above TIGA (${order.join(", ")})`);
  await ap.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/arc-night-order-390.png` : "/dev/null" }).catch(() => {});
  await ap.locator("button", { hasText: /^Resolve$/ }).first().click(); await ap.clock.runFor(300);
  await ap.locator("button", { hasText: /^Split the night$/ }).first().click(); await ap.clock.runFor(300);
  const ref = await ap.evaluate(() => ({ text: document.querySelector("[data-split-refused]")?.innerText || "", slider: !!document.querySelector("#split-switch"), confirm: !!document.querySelector("[data-split-confirm]") }));
  await ap.locator("[data-split-refused]").scrollIntoViewIfNeeded().catch(() => {});
  await ap.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/arc-second-split-refused-390.png` : "/dev/null" }).catch(() => {});
  check(/^(AZZECCA is already split with TIGA B2B BRUNELLO|TIGA B2B BRUNELLO is already split with AZZECCA)\./m.test(ref.text) && /Reset/.test(ref.text) && !ref.slider && !ref.confirm, `the sheet refuses, names the existing partner and says how to Reset, with no slider or Split here ("${ref.text.replace(/\n/g, " | ")}")`);
  const rem = await ap.evaluate(([az, ti, zu]) => {
    const state = { saved: [az, ti, zu] };
    let sched = null; const keep = window.Capacitor;
    window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: { cancel: () => Promise.resolve(), schedule: o => { sched = o.notifications.map(n => `${n.title} | ${n.body}`); return Promise.resolve(); } } } };
    try { scheduleReminders(state, () => {}); } finally { if (keep === undefined) delete window.Capacitor; else window.Capacitor = keep; }
    window.__web = [];
    scheduleReminders(state, (t, o) => window.__web.push(`${t} | ${o.body}`));
    return { sched, pend: JSON.parse(localStorage.getItem("reminders_v1") || "[]").map(p => `${p.id}:${p.late}`) };
  }, [AZ, TI, ZU]);
  await ap.clock.runFor(41 * 60000);   // 4:30 → 5:11 PM, past both fire times (4:45, 5:10)
  const web = await ap.evaluate(() => window.__web);
  const want = { ti: "TIGA B2B BRUNELLO: you arrive in 15 min | Expansions · you arrive 5:25 PM", zu: /^ZULAN starts in 15 min \| .+ · 5:00 PM$/ };
  const firstOf = (xs, n) => (xs || []).find(x => x.startsWith(n)) || "";
  check(firstOf(rem.sched, "TIGA") === want.ti && want.zu.test(firstOf(rem.sched, "ZULAN")), `native payload: the delayed arrival says "you arrive in", a whole set still "starts in" (${JSON.stringify(rem.sched)})`);
  check(firstOf(web, "TIGA") === want.ti && want.zu.test(firstOf(web, "ZULAN")) && web.length === 2, `web reminders fire with the same wording (${JSON.stringify(web)})`);
  check(rem.pend.includes(`${TI}:true`) && rem.pend.includes(`${ZU}:false`), `the persisted slate carries late, so a reload rehydrates the same wording (${rem.pend})`);

  // Codex P2 on 5774e37, a stored split and the festival night. A schedule
  // update that moves a partner to another night or weekend ends the split
  // even when its clock times still contain the old half; festival night is
  // the app's identity (day + a weekend both play), so a 01:00 set is still
  // the night before. A same-night time change that still fits keeps it.
  const night = await ap.evaluate(([fid, az, ti]) => {
    const A = id => ARTISTS.find(a => a.id === id), key = `${fid}_attend_v1`;
    const w = id => { const x = attendWindow(A(id)); return x.partial ? `${x.start}-${x.end}` : "whole"; };
    const r = {};
    localStorage.setItem(key, "{}"); splitNight(A(az), A(ti), toNightMin("17:25"));
    const t = A(ti), keep = { day: t.day, end: t.end, wk: t.weekend, azwk: A(az).weekend };
    t.day = keep.day + 1; r.movedDay = [w(az), w(ti)]; t.day = keep.day;
    t.weekend = "W2"; A(az).weekend = "W1"; r.movedWeekend = [w(az), w(ti)];
    A(az).weekend = "both"; r.bothWeekend = [w(az), w(ti)];
    if (keep.wk === undefined) delete t.weekend; else t.weekend = keep.wk;
    if (keep.azwk === undefined) delete A(az).weekend; else A(az).weekend = keep.azwk;
    t.end = "17:45"; r.adjusted = [w(az), w(ti)]; t.end = keep.end;
    r.restored = [w(az), w(ti)];
    // An overnight pair on one festival night: 23:30-01:30 and 00:30-02:30.
    const mk = (id, start, end) => ({ ...A(az), id, name: id.toUpperCase(), start, end });
    ARTISTS.push(mk("zz-late-a", "23:30", "01:30"), mk("zz-late-b", "00:30", "02:30"));
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify([...JSON.parse(localStorage.getItem(`${fid}_saved_v1`)), "zz-late-a", "zz-late-b"]));
    r.overnightSplit = splitNight(A("zz-late-a"), A("zz-late-b"), toNightMin("01:00")) !== false;
    r.overnight = [w("zz-late-a"), w("zz-late-b"), setsClash(A("zz-late-a"), A("zz-late-b"))];
    ARTISTS.splice(ARTISTS.findIndex(a => a.id === "zz-late-a"), 2);
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(JSON.parse(localStorage.getItem(`${fid}_saved_v1`)).filter(id => !id.startsWith("zz-"))));
    return r;
  }, [AFID, AZ, TI]);
  check(night.movedDay.join() === "whole,whole", `a partner moved to another night: both read as whole sets (${night.movedDay})`);
  check(night.movedWeekend.join() === "whole,whole", `partners on different weekends: both whole (${night.movedWeekend})`);
  check(night.bothWeekend.join() === "16:00-17:25,17:25-17:30", `a partner playing both weekends keeps the split (${night.bothWeekend})`);
  check(night.adjusted.join() === "16:00-17:25,17:25-17:30", `a same-night time change that still fits keeps the split (${night.adjusted})`);
  check(night.restored.join() === "16:00-17:25,17:25-17:30", `restoring the schedule restores the split, stored data untouched (${night.restored})`);
  check(night.overnightSplit && night.overnight.join() === "23:30-01:00,01:00-02:30,false", `an overnight pair across midnight keeps its split on one festival night (${night.overnight})`);

  // Codex P2 on 5774e37, Build My Night previews the selection Save will
  // write. AZZECCA/TIGA split at 17:00; dropping TIGA in the wizard leaves
  // AZZECCA whole (16:00-17:30) over ZULAN (17:00), and the wizard must say so
  // before Save, as the saved plan does after. With TIGA kept, the split holds.
  await ap.evaluate(([fid, az, ti, zu]) => {
    const A = id => ARTISTS.find(a => a.id === id);
    localStorage.setItem(`${fid}_attend_v1`, "{}");
    localStorage.setItem(`${fid}_saved_v1`, JSON.stringify([az, ti, zu]));
    splitNight(A(az), A(ti), toNightMin("17:00"));
    localStorage.setItem("plursky_lineup_view", "list");
  }, [AFID, AZ, TI, ZU]);
  await ap.goto(`http://127.0.0.1:${PORT}/index.html?f=${AFID}&tab=lineup`, { waitUntil: "domcontentloaded" });
  await ap.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, AFID, { timeout: 60000 });
  await ap.clock.runFor(4000);
  // Lineup scrolls to "now", under its sticky clock; the header button is
  // clicked in place rather than scrolled back up to.
  await ap.locator("[data-lineup-actions] button", { hasText: /^My night$/ }).first().evaluate(b => b.click()); await ap.clock.runFor(500);
  const wiz = () => ap.evaluate(() => ({
    day: (document.body.innerText.match(/(\d+) CLASH/) || [])[1] || "0",
    marked: [...document.querySelectorAll("button[aria-label^='Drop ']")].filter(b => /Clash ·/.test(b.parentElement.innerText)).map(b => b.getAttribute("aria-label").slice(5)),
  }));
  const kept = await wiz();
  check(kept.day === "1" && kept.marked.sort().join() === "TIGA B2B BRUNELLO,ZULAN", `wizard with TIGA kept: the split holds, only TIGA/ZULAN clash (${JSON.stringify(kept)})`);
  await ap.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/arc-wizard-tiga-kept-390.png` : "/dev/null" }).catch(() => {});
  await ap.getByRole("button", { name: "Drop TIGA B2B BRUNELLO" }).click(); await ap.clock.runFor(300);
  const dropped = await wiz();
  await ap.screenshot({ path: process.env.SPLIT_PIXELS ? `${process.env.SPLIT_PIXELS}/arc-wizard-tiga-dropped-390.png` : "/dev/null" }).catch(() => {});
  check(dropped.day === "1" && dropped.marked.sort().join() === "AZZECCA,ZULAN", `wizard after dropping TIGA, before Save: AZZECCA (now whole) clashes ZULAN (${JSON.stringify(dropped)})`);
  await ap.getByRole("button", { name: "Save" }).first().click(); await ap.clock.runFor(500);
  const after = await ap.evaluate(([fid, az, ti, zu]) => {
    const A = id => ARTISTS.find(a => a.id === id);
    return { saved: JSON.parse(localStorage.getItem(`${fid}_saved_v1`)), azZu: setsClash(A(az), A(zu)), az: attendWindow(A(az)).partial };
  }, [AFID, AZ, TI, ZU]);
  check(!after.saved.includes(TI) && after.azZu && !after.az, `after Save the plan matches the preview: TIGA gone, AZZECCA whole, AZZECCA/ZULAN clash (${JSON.stringify(after)})`);

  await actx.close();

  check(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ split the night: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ split the night: ${checks} checks (split clears the clash everywhere, persists, resets; one split per act; plan by arrival; keep-both accepts; banner counts clashes)`);

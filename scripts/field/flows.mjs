// SPEC-193 P1 — the deeper flows (once per festival, 390x844, online) and the
// global storage / colour-scheme scenarios (once per viewport). Imported by
// field-readiness.mjs, which hands each flow its helpers.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DAY = 864e5;
const result = (checks, extra = {}) => ({ status: checks.some(c => c.ok === false) ? "FAIL" : checks.every(c => c.ok === null) ? "NA" : "PASS", checks, ...extra });

// ── data facts, read from the running app (never re-derived here) ────────
const dataFacts = page => page.evaluate(() => {
  const days = festivalDayNums();
  const out = { days: [], badTimes: [], overlaps: [] };
  for (const d of days) {
    const sets = ARTISTS.filter(a => a.day === d);
    const timed = sets.map(a => ({ a, t: setTimingMin(a) })).filter(x => x.t);
    out.days.push({ day: d, sets: sets.length, timed: timed.length });
    for (const { a, t } of timed) if (!(t.end > t.start)) out.badTimes.push(`${a.name} (${a.stage}, day ${d}) ${a.start}-${a.end}`);
    const byStage = {};
    for (const x of timed) (byStage[x.a.stage] ||= []).push(x);
    for (const [st, xs] of Object.entries(byStage)) {
      xs.sort((p, q) => p.t.start - q.t.start);
      for (let i = 1; i < xs.length; i++) for (let j = 0; j < i; j++) {
        const p = xs[j], q = xs[i];
        const wp = p.a.weekend || "both", wq = q.a.weekend || "both";
        if (wp !== "both" && wq !== "both" && wp !== wq) continue;     // different weekends never share a stage-time
        if (q.t.start < p.t.end) out.overlaps.push(`${st} day ${d}: ${p.a.name} ${p.a.start}-${p.a.end} × ${q.a.name} ${q.a.start}-${q.a.end}`);
      }
    }
  }
  return out;
});

async function perFestival(f, { openCtx, boot, scan, shot }) {
  const checks = [], add = (flow, ok, note = "") => checks.push({ flow, ok, note });
  let failShot = null;
  // 3 · days and set times
  {
    const { ctx, page } = await openCtx({ w: 390, h: 844, sw: false, fid: f.id });
    try {
      await boot(page, "index.html?tab=lineup");
      const facts = await dataFacts(page);
      const empty = facts.days.filter(d => d.sets === 0).map(d => d.day);
      add("3 every day has at least one set", empty.length === 0, empty.length ? `empty day(s) ${empty}` : facts.days.map(d => `d${d.day}:${d.sets}/${d.timed} timed`).join(" "));
      add("3 no set ends before it starts", facts.badTimes.length === 0, facts.badTimes.slice(0, 3).join("; "));
      add("3 set times monotonic within a stage (no same-stage overlap)", facts.overlaps.length === 0, `${facts.overlaps.length}: ${facts.overlaps.slice(0, 3).join("; ")}`);
      const ovDay = facts.overlaps.length ? +(/day (\d+)/.exec(facts.overlaps[0]) || [])[1] : null;
      // The switcher itself: open each day by its tab and read back rows that belong to that day.
      for (const d of facts.days) {
        await page.goto(page.url().split("?")[0] + `?tab=lineup&day=${d.day}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("[data-lineup-scroll], [data-grid-scroll]", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(500);
        const r = await page.evaluate(day => {
          const names = [...document.querySelectorAll("[data-set-name]")].map(e => e.textContent.trim()).filter(Boolean);
          const onDay = new Set(ARTISTS.filter(a => a.day === day).map(a => a.name));
          return { rows: names.length, ofDay: names.filter(n => onDay.has(n)).length };
        }, d.day);
        add(`3 day ${d.day} opens and shows its own sets`, d.sets === 0 ? null : r.rows > 0 && r.ofDay > 0, `${r.rows} rows, ${r.ofDay} of day ${d.day}`);
      }
      const s = await scan(page);
      add("2 lineup (last day) no stray text", s.stray.length === 0, s.stray.join("; "));
      if (ovDay) { // the evidence for an overlap is the lineup day it sits on
        await page.goto(page.url().split("?")[0] + `?tab=lineup&day=${ovDay}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("[data-set-name]", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(500);
        failShot ||= await shot(page, `${f.id}-flow-overlap-day${ovDay}`);
      }
    } catch (e) { add("3 day flow ran", false, String(e.message).split("\n")[0]); failShot ||= await shot(page, `${f.id}-flow-days`); }
    await ctx.close();
  }
  // 4 + 5 · artist page from a set row, photo fallback, My schedule add/remove across reload and offline
  {
    // Photo fallback in its own context: a route on a service-worker context
    // makes Chromium fail offline navigations (a Playwright artefact, not the
    // app), so the photo-kill route never shares a context with the offline step.
    {
      const pc = await openCtx({ w: 390, h: 844, sw: false, fid: f.id });
      await pc.ctx.route(/\/artist-photos\//, r => r.abort());          // every artist photo fails
      try {
        await boot(pc.page, "index.html?tab=lineup");
        await pc.page.waitForSelector("[data-set-name]", { timeout: 20000 });
        await pc.page.locator("[data-set-name]").first().click();
        await pc.page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Add to lineup|Saved to lineup/.test(b.textContent)), null, { timeout: 8000 });
        await pc.page.waitForTimeout(900);
        const img = await pc.page.evaluate(() => {
          const broken = [...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight && i.complete && i.naturalWidth === 0 && getComputedStyle(i).visibility !== "hidden" && +getComputedStyle(i).opacity > 0; });
          return { broken: broken.map(i => i.alt || i.src.split("/").pop()).slice(0, 3) };
        });
        add("4 photo failure falls back cleanly (no broken image on screen)", img.broken.length === 0, img.broken.join(", "));
        if (img.broken.length) failShot ||= await shot(pc.page, `${f.id}-flow-photo`);
      } catch (e) { add("4 photo fallback ran", false, String(e.message).split("\n")[0]); }
      await pc.ctx.close();
    }
    const mark45 = checks.length; // flow 3's data failures must not trigger a flow 4/5 screenshot
    const { ctx, page } = await openCtx({ w: 390, h: 844, sw: true, fid: f.id });
    try {
      await boot(page, "index.html?tab=lineup");
      await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready).catch(() => {});
      await page.waitForSelector("[data-set-name]", { timeout: 20000 });
      const name = (await page.locator("[data-set-name]").first().textContent()).trim();
      await page.locator("[data-set-name]").first().click();
      const opened = await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Add to lineup|Saved to lineup/.test(b.textContent)), null, { timeout: 8000 }).then(() => true, () => false);
      add("4 artist page opens from a set row", opened, name);
      if (opened) {
        await page.waitForTimeout(500);
        const id = await page.evaluate(n => ARTISTS.find(a => a.name === n)?.id, name);
        const key = await page.evaluate(() => typeof _SAVED_KEY !== "undefined" ? _SAVED_KEY : null);
        const btn = page.locator("button", { hasText: /Add to lineup|Saved to lineup/ }).first();
        if (/Saved to lineup/.test(await btn.textContent())) { await btn.click(); await page.waitForTimeout(500); }
        await btn.click(); await page.waitForTimeout(700);
        const savedNow = await page.evaluate(([k, id]) => JSON.parse(localStorage.getItem(k) || "[]").includes(id), [key, id]);
        add("5 add a set writes My schedule", savedNow, `${key} has ${id}: ${savedNow}`);
        await page.goto(page.url().split("?")[0] + `?artist=${id}`, { waitUntil: "domcontentloaded" });
        const afterReload = await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Saved to lineup/.test(b.textContent)), null, { timeout: 10000 }).then(() => true, () => false);
        add("5 saved set survives a reload", afterReload);
        await ctx.setOffline(true);
        let offlineOk = false;
        try {
          await page.goto(page.url().split("?")[0] + `?artist=${id}`, { waitUntil: "domcontentloaded", timeout: 20000 });
          offlineOk = await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => /Saved to lineup/.test(b.textContent)), null, { timeout: 15000 }).then(() => true, () => false);
        } catch {}
        add("5 saved set survives offline", offlineOk);
        await ctx.setOffline(false);
        if (afterReload) {
          await page.locator("button", { hasText: /Saved to lineup/ }).first().click(); await page.waitForTimeout(600);
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1500);
          const gone = await page.evaluate(([k, id]) => !JSON.parse(localStorage.getItem(k) || "[]").includes(id), [key, id]);
          add("5 remove persists across reload", gone);
        }
      }
    } catch (e) { add("4/5 artist flow ran", false, String(e.message).split("\n")[0]); }
    if (checks.slice(mark45).some(c => c.ok === false)) failShot ||= await shot(page, `${f.id}-flow-artist`);
    await ctx.close();
  }
  // 7 · clash banner: two saved sets that fully overlap must read "clash", never "tight transitions"
  {
    const probe = await openCtx({ w: 390, h: 844, sw: false, fid: f.id });
    let pick = null;
    try {
      await boot(probe.page, "index.html?tab=lineup");
      pick = await probe.page.evaluate(() => {
        const cfg = FESTIVAL_CONFIG, tz = cfg.tz || cfg.timezone;
        for (const d of festivalDayNums()) {
          const t = ARTISTS.filter(a => a.day === d).map(a => ({ a, m: setTimingMin(a) })).filter(x => x.m);
          for (const p of t) for (const q of t) {
            if (p.a.id >= q.a.id || p.a.stage === q.a.stage) continue;
            const wp = p.a.weekend || "both", wq = q.a.weekend || "both";
            if (wp !== wq) continue;                                    // same weekend, or both on both
            if (q.m.start >= p.m.start && q.m.end <= p.m.end) {       // q sits wholly inside p: a full clash
              let at = null;
              // The weekend this pair resolves to, from the pair itself (a W1-only
              // act is not on stage on the W2 date), then 15 min into the outer set.
              try { at = _wallMs(dayDateFor(d, cfg.startMs - 864e5, [p.a.id, q.a.id]), q.a.start, tz) + 15 * 60e3; } catch {}
              // Home treats the hours before the festival's own start as pre-festival
              // (no plan), so a pair playing before it is not a test of the banner.
              if (at && at >= cfg.startMs) return { ids: [p.a.id, q.a.id], names: [p.a.name, q.a.name], day: d, at };
            }
          }
        }
        return null;
      });
    } catch {}
    await probe.ctx.close();
    const mark7 = checks.length; // only this flow's failures earn its screenshot
    if (!pick || !pick.at) add("7 full clash reads as a clash", null, pick ? "no wall time for the pair" : "no fully overlapping pair in the data");
    else {
      const { ctx, page } = await openCtx({ w: 390, h: 844, sw: false, fid: f.id, extra: { [`${f.id}_saved_v1`]: JSON.stringify(pick.ids) } });
      await ctx.clock.install({ time: new Date(pick.at) });
      var seenAny = true;
      try {
        await boot(page, "index.html?tab=home");
        await page.clock.runFor(2500);
        // Home says it two ways: the plan banner ("N clash(es) · …") and the
        // lifted "Clash · pick one" card. Either must say clash; neither may
        // call this pair a tight transition.
        const r = await page.evaluate(() => {
          const banner = [...document.querySelectorAll("[data-plan-banner]")].map(e => e.textContent.trim()).join(" | ");
          const txt = document.body.innerText;
          const clashLine = (/[^\n]*\bclash\b[^\n]*/i.exec(txt) || [""])[0].trim();
          return { banner, clashLine, tightOnly: /^\d+ tight transitions?\b/m.test(banner) };
        });
        // A real fully-overlapping pair, both saved, at a moment inside both
        // sets: Home MUST name the clash. Silence is a failure, not "n/a".
        const seen = r.banner || r.clashLine; seenAny = !!seen;
        add("7 full clash reads as a clash", seen ? (/clash/i.test(seen) && !r.tightOnly) : false,
          seen ? `"${(r.banner || r.clashLine).slice(0, 80)}" for ${pick.names.join(" × ")}` : `Home shows no clash line for ${pick.names.join(" × ")} at ${new Date(pick.at).toISOString()}`);
      } catch (e) { add("7 clash flow ran", false, String(e.message).split("\n")[0]); }
      if (checks.slice(mark7).some(c => c.ok === false) || !seenAny) failShot ||= await shot(page, `${f.id}-flow-clash`);
      await ctx.close();
    }
  }
  // 8 · Music/recap, Memories and Me open without errors (the share and recap surfaces live there)
  {
    const { ctx, page } = await openCtx({ w: 390, h: 844, sw: false, fid: f.id });
    for (const tab of ["spotify", "memories", "me", "home"]) {
      try {
        page._errors.length = 0;
        await boot(page, `index.html?tab=${tab}`);
        await page.waitForTimeout(1200);
        const s = await scan(page);
        const errs = page._errors;
        add(`8 ${tab} opens clean`, errs.length === 0 && s.stray.length === 0 && s.overflowX <= 1, [errs.slice(0, 2).join(" | "), s.stray.join("; "), s.overflowX > 1 ? `${s.overflowX}px overflow` : ""].filter(Boolean).join(" · "));
        if (errs.length || s.stray.length || s.overflowX > 1) failShot ||= await shot(page, `${f.id}-flow-${tab}`);
      } catch (e) { add(`8 ${tab} opens`, false, String(e.message).split("\n")[0]); }
    }
    await ctx.close();
  }
  return result(checks, failShot ? { shot: failShot } : {});
}

// ── global scenarios, once per viewport ──────────────────────────────────
const nowMs = () => Date.now();
const global = [
  { name: "fresh install cold open", run: async ([w, h], { openCtx, boot, scan, shot, allFests: fests }) => {
    const checks = [], add = (flow, ok, note = "") => checks.push({ flow, ok, note });
    const { ctx, page } = await openCtx({ w, h, sw: false, seed: false });
    let s = null;
    try {
      await boot(page, "index.html");
      await page.waitForTimeout(1500);
      s = await scan(page);
      const def = await page.evaluate(() => _resolveDefaultFestivalId(Date.now()));
      const f = fests.find(x => x.id === def);
      const live = fests.filter(x => x.startMs <= nowMs() && nowMs() < x.endMs).map(x => x.id);
      const next = fests.filter(x => x.startMs > nowMs()).sort((a, b) => a.startMs - b.startMs)[0];
      const endedDays = f && f.endMs < nowMs() ? Math.floor((nowMs() - f.endMs) / DAY) : 0;
      add("1 default festival is in progress or the nearest upcoming (never one that ended > 7 days ago)", !!f && endedDays <= 7,
        `default ${def}${endedDays ? ` (ended ${endedDays} d ago)` : ""}; in progress [${live}]; nearest upcoming ${next?.id}`);
      // Info, not a gate: the app's rule (data.jsx _resolveDefaultFestivalId)
      // skips festivals whose set times are TBA, so with every upcoming one
      // TBA the default is the most recently ENDED timed festival.
      const nextTimed = fests.filter(x => x.startMs > nowMs() && !x.tba).sort((a, b) => a.startMs - b.startMs)[0];
      add("1 default vs nearest upcoming (info)", null, `default ${def}; nearest upcoming ${next?.id} (${next?.tba ? "set times TBA" : "timed"}); nearest upcoming with set times ${nextTimed?.id || "none"}`);
      add("2 no stray text / overflow on first screen", s.stray.length === 0 && s.overflowX <= 1, [s.stray.join("; "), s.overflowX > 1 ? `${s.overflowX}px` : ""].filter(Boolean).join(" · "));
      add("no page errors", page._errors.length === 0, page._errors.slice(0, 2).join(" | "));
    } catch (e) { add("ran", false, String(e.message).split("\n")[0]); }
    const r = result(checks); if (r.status === "FAIL") r.shot = await shot(page, `global-fresh-${w}x${h}`);
    await ctx.close(); return r;
  } },
  { name: "stored selection on a festival that ended > 7 days ago", run: async ([w, h], { openCtx, boot, scan, shot, allFests: fests }) => {
    const checks = [], add = (flow, ok, note = "") => checks.push({ flow, ok, note });
    const old = fests.filter(x => x.endMs < nowMs() - 7 * DAY).sort((a, b) => a.endMs - b.endMs)[0];
    const { ctx, page } = await openCtx({ w, h, sw: false, fid: old?.id });
    try {
      await boot(page, "index.html");
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ txt: document.body.innerText.slice(0, 400), wrap: /THAT'S A WRAP|ENDED/i.test(document.body.innerText.slice(0, 300)) }));
      add("1 plain launch does not land on the ended festival's wrap page", !r.wrap, `stored ${old?.id}; first screen: "${r.txt.replace(/\s+/g, " ").slice(0, 90)}"`);
      const s = await scan(page);
      add("2 no stray text / overflow", s.stray.length === 0 && s.overflowX <= 1, s.stray.join("; "));
      add("no page errors", page._errors.length === 0, page._errors.slice(0, 2).join(" | "));
    } catch (e) { add("ran", false, String(e.message).split("\n")[0]); }
    const r = result(checks); if (r.status === "FAIL") r.shot = await shot(page, `global-stale-selection-${w}x${h}`);
    await ctx.close(); return r;
  } },
  { name: "stale service worker from the previous build", run: async ([w, h], { openCtx, boot, shot, ROOT, TMP }) => {
    const checks = [], add = (flow, ok, note = "") => checks.push({ flow, ok, note });
    const ver = src => (/v(\d{3})/.exec(src) || [])[1];
    const cur = ver(readFileSync(join(ROOT, "sw.js"), "utf8"));
    // The previous build: the parent of the commit that last moved sw.js's version.
    const prevDir = join(TMP, "prev");
    if (!existsSync(prevDir)) {
      const last = execFileSync("git", ["log", "-n1", "--format=%H", "-G", "v[0-9]{3}", "--", "sw.js"], { cwd: ROOT, encoding: "utf8" }).trim();
      mkdirSync(prevDir, { recursive: true });
      execFileSync("sh", ["-c", `git archive ${last}^ | tar -x -C "${prevDir}"`], { cwd: ROOT });
      try { symlinkSync(join(ROOT, "scripts"), join(prevDir, "scripts-cur")); } catch {}
    }
    const prev = ver(readFileSync(join(prevDir, "sw.js"), "utf8"));
    const point = to => { rmSync(join(TMP, "app"), { force: true }); symlinkSync(to, join(TMP, "app")); };
    const { ctx, page } = await openCtx({ w, h, sw: true, fid: null });
    try {
      point(prevDir);
      await boot(page, "index.html");
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForTimeout(2500);
      point(ROOT);
      let got = null;
      for (let i = 0; i < 3 && got !== cur; i++) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.getElementById("root")?.childElementCount > 0, null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(2500);
        got = await page.evaluate(() => (/[?&]v=v?(\d{3})/.exec([...document.scripts].map(s => s.src).find(s => /app\.js|app\.jsx/.test(s)) || "") || [])[1] || null);
        add(`stale SW: reload ${i + 1} serves v${got}`, null);
      }
      add(`stale SW (v${prev}) → current build v${cur} within 3 reloads`, got === cur, `served v${got}`);
      add("app mounts after the update", await page.evaluate(() => document.getElementById("root")?.childElementCount > 0));
    } catch (e) { add("ran", false, String(e.message).split("\n")[0]); }
    point(ROOT);
    const r = result(checks); if (r.status === "FAIL") r.shot = await shot(page, `global-stale-sw-${w}x${h}`);
    await ctx.close(); return r;
  } },
  ...["light", "dark"].map(scheme => ({ name: `${scheme} colour scheme`, run: async ([w, h], { openCtx, boot, scan, shot, fests }) => {
    const checks = [], add = (flow, ok, note = "") => checks.push({ flow, ok, note });
    const f = fests.find(x => !x.tba && x.endMs > nowMs()) || fests[0];
    const { ctx, page } = await openCtx({ w, h, sw: false, fid: f.id, scheme });
    for (const tab of ["home", "lineup", "map", "me"]) {
      try {
        page._errors.length = 0;
        await boot(page, `index.html?tab=${tab}`);
        await page.waitForTimeout(1200);
        const s = await scan(page);
        const appearance = await page.evaluate(() => document.documentElement.getAttribute("data-appearance") || document.body.getAttribute("data-appearance") || document.querySelector("[data-appearance]")?.getAttribute("data-appearance"));
        add(`${scheme}: ${tab} clean (${f.id}, appearance ${appearance})`, s.stray.length === 0 && s.overflowX <= 1 && page._errors.length === 0,
          [s.stray.join("; "), s.overflowX > 1 ? `${s.overflowX}px overflow` : "", page._errors.slice(0, 1).join("")].filter(Boolean).join(" · "));
      } catch (e) { add(`${scheme}: ${tab}`, false, String(e.message).split("\n")[0]); }
    }
    const r = result(checks); if (r.status === "FAIL") r.shot = await shot(page, `global-${scheme}-${w}x${h}`);
    await ctx.close(); return r;
  } })),
];

export const FLOWS = { perFestival, global };

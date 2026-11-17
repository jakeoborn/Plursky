#!/usr/bin/env node
// test-scan-multi-pass.mjs: the multi-scan regression for build 39.
//
// On a real phone a second Scan of ACL left 60 clips under one Charli XCX
// card. The vm gates test the pure parts; this one drives the REAL app in
// headless Chrome (index.html, the real Scan button, the real import handler
// processImportedFiles, the real moment store) with only the native plugins
// stubbed: PhotoScan lists a fake library and exports blobs, Share is a no-op.
//
// The library: 27 ACL weekend-2 items (photos and videos) across 11 acts on
// three nights, 4 of those acts saved, one dinner shot taken 3 km away during a
// saved set, and 2 photos at 11:16 (lunch, outside set times).
//   Scan 1: LIMITED access (the library shows about half), 2 exports fail.
//   Then: one moment hand-tagged to another act, one marked Unknown.
//   Scan 2: FULL access, exports work: everything left lands, the 2 failed
//           ones are retried, nothing from scan 1 is re-tagged or duplicated.
//   Scan 3: adds nothing and writes nothing.
//   A stale cloud copy (taken after scan 1, with one moment under an older
//   night, plus one moment only the cloud has) restores only that one.
// Every check reads the stored moments, which is what Memories renders.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const reservePort = () => new Promise((resolve, reject) => {
  const s = createServer(); s.once("error", reject);
  s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? reject(e) : resolve(a.port)); });
});
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: process.cwd(), stdio: "ignore" });
const fails = [];
let n = 0;
const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
let browser;
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, timezoneId: "America/Chicago" });
  await wireVendor(ctx);
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem("__seeded")) {
      sessionStorage.setItem("__seeded", "1");
      localStorage.clear();
      indexedDB.deleteDatabase("plursky_memories");
    }
    // Every load opens ACL, as on the phone, not the festival picker.
    localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
    localStorage.setItem("active_festival_id", "acl-2026"); localStorage.setItem("active_festival_explicit", "1");
  });
  // The native shell: PhotoScan over window.__lib, Share as a no-op.
  await ctx.addInitScript(() => {
    window.__access = "limited";
    window.__failExport = new Set();
    window.__lib = [];
    window.__blobs = {};
    const PhotoScan = {
      requestAccess: async () => ({ status: window.__access }),
      scan: async ({ startMs, endMs }) => ({
        assets: window.__lib.filter(a => a.createdMs >= startMs && a.createdMs <= endMs && (window.__access === "authorized" || a.shared))
          .map(({ id, createdMs, mediaType, lat, lng, acc }) => ({ id, createdMs, mediaType, lat, lng, acc })),
      }),
      export: async ({ id }) => {
        if (window.__failExport.has(id)) throw new Error("export failed");
        const a = window.__lib.find(x => x.id === id);
        return { path: window.__blobs[id], name: a.name, mimeType: a.mime };
      },
      discard: async () => ({}),
    };
    const cap = { isNativePlatform: () => true, getPlatform: () => "ios", convertFileSrc: p => p,
                  Plugins: { PhotoScan, Share: { share: async () => ({}) } } };
    Object.defineProperty(window, "Capacitor", { configurable: true, get: () => cap, set: () => {} });
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0 && window.FESTIVAL_CONFIG?.id === "acl-2026", null, { timeout: 30000 });

  // 1. Pick acts from ACL's own weekend-2 set times and save four of them.
  const plan = await page.evaluate(() => {
    const ds = window._DATA_SETS["acl-2026"];
    const anchors = new Map(resolvedStageAnchors(ds.config).map(x => [x.stageId, x]));
    const toMin = s => { const [h, m] = s.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
    const timed = a => /^\d{1,2}:\d{2}$/.test(a.start || "") && /^\d{1,2}:\d{2}$/.test(a.end || "");
    const w2 = a => actPlaysWeekend(a, "W2");
    const plays = (b, night, lo, hi) => b.day === night && timed(b) && w2(b) && toMin(b.start) <= hi && toMin(b.end) >= lo;
    const acts = [];
    // ACL runs 7 stages at once, so most minutes have several acts. The
    // first 4 picks are SAVED and photographed with no GPS (saved + time is
    // all there is), so no other saved pick may overlap them. The other 7
    // are unsaved and photographed AT their stage's anchor, like a phone in
    // the crowd; they need an anchored stage.
    for (const night of [1, 2, 3]) {
      for (const a of ds.artists) {
        if (acts.length >= 11) break;
        if (a.day !== night || !timed(a) || !w2(a) || toMin(a.end) - toMin(a.start) < 40) continue;
        const min = toMin(a.start) + 20;
        const saved = acts.length < 4;
        if (saved && acts.some(x => x.saved && x.night === night && Math.abs(x.min - min) < 60)) continue;
        if (!saved && !anchors.has(a.stage)) continue;
        if (acts.some(x => x.night === night && x.stage === a.stage)) continue;
        if (acts.filter(x => x.night === night).length >= 6) continue;
        acts.push({ id: a.id, night, min, stage: a.stage, saved,
                    gps: saved ? null : { lat: anchors.get(a.stage).lat, lng: anchors.get(a.stage).lng } });
      }
    }
    const saved = acts.filter(a => a.saved).map(a => a.id);
    const anchoredStages = [...anchors.keys()];
    localStorage.setItem("acl-2026_saved_v1", JSON.stringify(saved));
    return { acts, saved, anchoredStages };
  });
  const anchoredStages = plan.anchoredStages;
  t(plan.acts.length === 11 && plan.saved.length === 4, `fixture: wanted 11 ACL W2 acts (4 saved), found ${plan.acts.length}/${plan.saved.length}`);
  if (plan.acts.length !== 11) throw new Error("setup");
  await page.goto(`http://127.0.0.1:${PORT}/?tab=me`, { waitUntil: "domcontentloaded" }); // the app rewrites the URL, so a bare reload opens the picker
  await page.waitForFunction(() => window.FESTIVAL_CONFIG?.id === "acl-2026" && Array.isArray(window.ARTISTS) && window.ARTISTS.length > 0, null, { timeout: 30000 });

  // 2. The library: 22 at act times (20 photos, 2 videos), a dinner 3 km
  // away during the first saved set, and two 11:16 lunches.
  const lib = await page.evaluate(async (plan) => {
    const cfg = window._DATA_SETS["acl-2026"].config;
    const shift = cfg.weekendStartMs.W2 - cfg.weekendStartMs.W1;
    const at = (night, min) => cfg.dayDates[night].midnightUtc + shift + min * 60000;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d");
    const jpeg = (i) => { g.fillStyle = `hsl(${(i * 47) % 360},70%,${30 + (i % 5) * 8}%)`; g.fillRect(0, 0, 64, 64); g.fillStyle = "#fff"; g.fillText(String(i), 8, 30);
      return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9)); };
    const webm = async (i) => {
      const rec = new MediaRecorder(canvas.captureStream(10), { mimeType: "video/webm" });
      const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
      const done = new Promise(r => { rec.onstop = r; }); rec.start();
      for (let k = 0; k < 4; k++) { g.fillStyle = `hsl(${(i * 90 + k * 20) % 360},60%,50%)`; g.fillRect(0, 0, 64, 64); await new Promise(r => setTimeout(r, 60)); }
      rec.stop(); await done; return new Blob(chunks, { type: "video/webm" });
    };
    const out = [];
    const add = async (night, min, kind, expect, extra = {}) => {
      const i = out.length, id = `asset-${i}`;
      const blob = kind === "video" ? await webm(i) : await jpeg(i);
      window.__blobs[id] = URL.createObjectURL(blob);
      out.push({ id, createdMs: at(night, min), mediaType: kind, name: `IMG_${1000 + i}.${kind === "video" ? "webm" : "jpg"}`,
                 mime: blob.type, lat: null, lng: null, acc: null, shared: false, expect, ...extra });
    };
    const A = plan.acts;
    const geo = a => a.gps ? { lat: a.gps.lat, lng: a.gps.lng, acc: 10 } : {};
    for (const a of A) { await add(a.night, a.min, "image", a.id, geo(a)); await add(a.night, a.min + 3, "image", a.id, geo(a)); }
    await add(A[4].night, A[4].min + 6, "video", A[4].id, geo(A[4]));
    await add(A[5].night, A[5].min + 6, "video", A[5].id, geo(A[5]));
    await add(A[0].night, A[0].min + 9, "image", "off_venue", { lat: cfg.gps.lat + 0.03, lng: cfg.gps.lng, acc: 12 });
    await add(1, 11 * 60 + 16, "image", "skip"); await add(2, 11 * 60 + 16, "image", "skip");
    // Limited access shows 15 items: every other one, so it mixes nights,
    // kinds, both lunches' neighbours and the dinner.
    out.forEach((a, k) => { a.shared = k % 2 === 0 || k === 21; });
    window.__lib = out;
    return out.map(({ id, mediaType, expect, shared }) => ({ id, mediaType, expect, shared }));
  }, plan);
  t(lib.length === 27 && lib.filter(a => a.mediaType === "video").length === 2, `fixture: library ${lib.length} items`);

  // 3. A prior manual Pick of asset-0, hand-tagged to another act. Its
  // fingerprint is the Pick's own (FNV-1a of the first 2 KB, size, the Pick's
  // file name); Scan then exports the SAME bytes under a different name. The
  // review reproduced 25 → 26 here (#384): the scan must link to the picked
  // moment by content and leave its tag alone.
  const prior = await page.evaluate(async (plan) => {
    const a0 = window.__lib[0];
    const bytes = new Uint8Array(await (await (await fetch(window.__blobs[a0.id])).blob()).arrayBuffer());
    let h = 0x811c9dc5;
    for (let i = 0; i < Math.min(2048, bytes.length); i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
    const fp = `${(h >>> 0).toString(36)}_${bytes.length}_${a0.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    const to = plan.acts[1].id;
    // As an older build stored it: the photo recompressed in IndexedDB, and
    // no _contentSha256 (that field starts with build 39).
    const stored = await _compressMomentImage(new File([bytes], a0.name, { type: a0.mime }));
    await _putPhoto("p_m_prior_pick", stored);
    const m = { id: "m_prior_pick", night: plan.acts[0].night, text: "", artistId: to, photoId: "p_m_prior_pick", kind: "image",
                createdAt: Date.now(), tagSource: "manual", festivalId: "acl-2026", _fingerprint: fp };
    const all = _readMoments();
    all[m.night] = [...(all[m.night] || []), m];
    _writeMoments(all);
    a0.name = "CHANGED_EXPORT_NAME.jpg";
    return { id: m.id, artistId: to, fp };
  }, plan);
  // 4. Positive control for the content key (#384 review: 25 → 24): two
  // DIFFERENT valid JPEGs with the same byte size and identical first 2 KB
  // (a shared 2.2 KB comment segment up front, a filler comment to even the
  // sizes, then each image's own data). The key finds a candidate; only a
  // full-content check may skip, so both must import.
  const pair = await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d");
    const draw = async (hue, label) => { g.fillStyle = `hsl(${hue},80%,45%)`; g.fillRect(0, 0, 64, 64); g.fillStyle = "#000"; g.fillText(label, 10, 34);
      return new Uint8Array(await (await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9))).arrayBuffer()); };
    const x = await draw(10, "A"), y = await draw(200, "B");
    const com = (n) => { const seg = new Uint8Array(n + 4); seg.set([0xFF, 0xFE, ((n + 2) >> 8) & 255, (n + 2) & 255]); seg.fill(0x41, 4); return seg; };
    const head = com(2200);
    const size = 2 + head.length + 4 + Math.max(x.length, y.length) - 2 + 8;
    const build = (j) => { const fill = size - 2 - head.length - (j.length - 2);
      const out = new Uint8Array(size); out.set([0xFF, 0xD8]); out.set(head, 2); out.set(com(fill - 4), 2 + head.length); out.set(j.subarray(2), 2 + head.length + fill); return out; };
    const A = build(x), B = build(y);
    const okA = await new Promise(r => { const im = new Image(); im.onload = () => r(im.width === 64); im.onerror = () => r(false); im.src = URL.createObjectURL(new Blob([A], { type: "image/jpeg" })); });
    const okB = await new Promise(r => { const im = new Image(); im.onload = () => r(im.width === 64); im.onerror = () => r(false); im.src = URL.createObjectURL(new Blob([B], { type: "image/jpeg" })); });
    let samePrefix = A.length === B.length; for (let i = 0; i < 2048; i++) if (A[i] !== B[i]) samePrefix = false;
    let differ = false; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) { differ = true; break; }
    // Two in-window photos that only full access sees, so both land in scan 2.
    const pick = window.__lib.filter(a => a.mediaType === "image" && !a.shared && a.expect !== "skip" && a.expect !== "off_venue").slice(0, 2);
    window.__blobs[pick[0].id] = URL.createObjectURL(new Blob([A], { type: "image/jpeg" }));
    window.__blobs[pick[1].id] = URL.createObjectURL(new Blob([B], { type: "image/jpeg" }));
    return { ids: pick.map(a => a.id), size: A.length, samePrefix, differ, valid: okA && okB };
  });
  t(pair.ids.length === 2 && pair.samePrefix && pair.differ && pair.valid, `fixture: collision pair not two valid, different, same-size, same-first-2KB JPEGs (${JSON.stringify(pair)})`);
  const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"));
  const flat = (all) => Object.entries(all).flatMap(([night, arr]) => (arr || []).map(m => ({ ...m, _n: night })));
  const scanOnce = async (label) => {
    const btn = page.locator("[data-scan-weekend]");
    if (!(await btn.count())) {
      const mem = page.locator("[data-me-action=memories]").first();
      await mem.waitFor({ timeout: 30000 });
      await mem.click();
    }
    await btn.waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector("[data-scan-weekend]")?.disabled, null, { timeout: 60000 });
    await btn.click();
    await page.waitForFunction(() => {
      const txt = [...document.querySelectorAll("[role=status]")].map(s => s.textContent || "").join(" ");
      return /Imported \d+ from|No new photos from|Couldn.t finish the scan/.test(txt);
    }, null, { timeout: 120000 });
    const msg = await page.evaluate(() => [...document.querySelectorAll("[role=status]")].map(s => s.textContent || "").find(x => /Imported \d+ from|No new photos|Couldn.t finish/.test(x)) || "");
    if (process.env.MP_SHOT) await page.screenshot({ path: `${process.env.MP_SHOT}-${label.replace(/\W+/g, "")}.png` });
    const done = await page.locator("[data-review-done]").first();
    let reviewLabel = null;
    if (await done.count()) { reviewLabel = (await done.textContent()) || ""; await done.click(); }
    return { msg, reviewLabel, label };
  };
  const ACT = new Map(lib.map(a => [a.id, a]));

  // ── Scan 1: limited access, two exports fail ───────────────────────────
  const shared = lib.filter(a => a.shared);
  const failIds = shared.filter(a => a.expect !== "skip").slice(1, 3).map(a => a.id);
  await page.evaluate((ids) => { window.__access = "limited"; window.__failExport = new Set(ids); }, failIds);
  const s1 = await scanOnce("scan 1");
  const after1 = flat(await store());
  const want1 = shared.filter(a => a.expect !== "skip").length - failIds.length;
  t(after1.length === want1, `scan 1 stored ${after1.length}, want ${want1} (${s1.msg})`);
  t(/couldn.t be read/.test(s1.msg) && /outside set times/.test(s1.msg), `scan 1 message does not report the failures and the skip: "${s1.msg}"`);
  t(s1.reviewLabel && !/^Looks right/.test(s1.reviewLabel.trim()), `scan 1 review says "${s1.reviewLabel}" with saved-only guesses in it`);
  const seen1 = await page.evaluate(() => JSON.parse(localStorage.getItem("plursky_scan_seen_v1") || "[]"));
  t(failIds.every(id => !seen1.includes(id)), "a failed export was marked as seen");
  t(lib.filter(a => a.expect === "skip").every(a => !seen1.includes(a.id)), "an outside-set-times item was marked as seen");

  // Hand choices: one moment re-tagged to another act, one marked Unknown.
  t(after1.filter(m => m.id === prior.id).length === 1 && after1.find(m => m.id === prior.id)?.artistId === prior.artistId
    && after1.find(m => m.id === prior.id)?.tagSource === "manual", "scan 1 changed the picked moment's tag");
  const tagged1 = after1.filter(m => m.artistId && m.id !== prior.id);
  const manualId = tagged1[0]?.id, unknownId = tagged1[1]?.id;
  const manualTo = plan.acts.find(a => a.id !== tagged1[0]?.artistId)?.id;
  await page.evaluate(({ manualId, unknownId, manualTo }) => {
    let all = _readMoments();
    all = _patchMoments(all, [manualId], _retagPatch({ artistId: manualTo }));
    all = _patchMoments(all, [unknownId], _retagPatch({ unknown: true }));
    _writeMoments(all);
  }, { manualId, unknownId, manualTo });
  const cloudStale = await store(); // the cloud's copy, as of now

  // ── Scan 2: full access, exports work ──────────────────────────────────
  await page.evaluate(() => { window.__access = "authorized"; window.__failExport = new Set(); });
  const s2 = await scanOnce("scan 2");
  const after2 = flat(await store());
  const inWindow = lib.filter(a => a.expect !== "skip");
  t(after2.length === inWindow.length, `scan 2 stored ${after2.length}, want ${inWindow.length} (${s2.msg})`);
  const ids2 = after2.map(m => m.id);
  t(new Set(ids2).size === ids2.length, "a moment id appears twice");
  t(after2.filter(m => m._fingerprint && m._fingerprint.split("_").slice(0, 2).join("_") === prior.fp.split("_").slice(0, 2).join("_")).length === 1,
    "the picked photo was imported again under its new export name (Pick then Scan duplicate)");
  t(after2.filter(m => (m._fingerprint || "").split("_")[1] === String(pair.size)).length === 2,
    "the two same-size, same-first-2KB photos did not both import (one was taken for a duplicate)");
  t(after2.find(m => m.id === prior.id)?.artistId === prior.artistId && after2.find(m => m.id === prior.id)?.tagSource === "manual", "scan 2 changed the picked moment's tag");
  // Nothing from scan 1 moved, other than the two hand choices.
  const byId2 = new Map(after2.map(m => [m.id, m]));
  let moved = 0;
  for (const m of after1) {
    if (m.id === manualId || m.id === unknownId) continue;
    const b = byId2.get(m.id);
    if (!b || b.artistId !== m.artistId || b._n !== m._n || b.tagSource !== m.tagSource) moved++;
  }
  t(moved === 0, `scan 2 changed ${moved} moments from scan 1`);
  t(byId2.get(manualId)?.artistId === manualTo && byId2.get(manualId)?.tagSource === "manual", "the hand-tagged moment did not survive scan 2");
  t(byId2.get(unknownId)?.tagSource === "unknown" && !byId2.get(unknownId)?.artistId, "the Unknown choice did not survive scan 2");
  // Every act-time item is on its own act (no collapse onto one card).
  if (process.env.MP_DEBUG) {
    for (const m of after2) console.log("M", m.id.slice(-8), m.artistId, m.tagSource, m.matchReason, m.matchEvidence, m.tagSuggested, m.lat != null, m.tagAmbiguous, JSON.stringify(m.tagAlternatives));
    for (const a of plan.acts) console.log("P", a.id, a.night, a.min, a.stage, a.saved);
  }
  const artists2 = new Set(after2.filter(m => m.artistId && m.tagSource !== "manual").map(m => m.artistId));
  t(artists2.size >= 10, `scan 2 tags span only ${artists2.size} acts (collapse?)`);
  const dinner = after2.find(m => m.tagSource === "off_venue");
  t(!!dinner && !dinner.artistId && dinner.matchReason === "off_venue", `the dinner 3 km away was not left off the saved set (${JSON.stringify(dinner && [dinner.artistId, dinner.tagSource, dinner.matchReason])})`);
  const savedOnly = after2.filter(m => m.matchReason === "saved_set_time" && m.tagSource === "photokit"); // a hand choice is an answer
  t(savedOnly.length > 0 && savedOnly.every(m => m.tagSuggested === true && /^saved\+time(;gps-other-stage)?$/.test(m.matchEvidence || "")), "a saved-set guess was stored as certain");
  // GPS at another stage while a saved act plays. SPEC-179: a trusted fix
  // tags the act at ITS stage; when the saved act's stage has no pin (ACL's
  // Beatbox) the tag is flagged, so the fix-tag chip shows and the saved act
  // stays offered.
  const conflict = after2.filter(m => m.tagSource === "photokit" && /^trusted-gps\+time;over-saved$/.test(m.matchEvidence || "")); // a hand choice is an answer
  t(conflict.length > 0 && conflict.every(m => m.tagAmbiguous && (m.tagAlternatives || []).length > 1), "a saved guess contradicted by stage GPS did not show the fix-tag chip");
  const gpsWins = plan.acts.filter(a => !a.saved && plan.acts.some(s2 => s2.saved && s2.night === a.night && Math.abs(s2.min - a.min) < 45 && anchoredStages.includes(s2.stage)));
  t(gpsWins.length > 0, "fixture: no unsaved act overlaps a saved act on an anchored stage (vacuous check)");
  t(gpsWins.every(a => after2.some(m => m.artistId === a.id)), `GPS at an anchored stage lost to a saved act on an anchored stage (${gpsWins.map(a => a.id)})`);
  t(after2.filter(m => m.matchReason === "matched").every(m => !m.tagSuggested), "an unsaved time match was flagged suggested");
  t(after2.every(m => m.tagSource !== "photokit" || m.takenAtSource === "photokit"), "tagSource and capture-time source disagree");

  // ── Scan 3: nothing new ────────────────────────────────────────────────
  const raw2 = await page.evaluate(() => localStorage.getItem("plursky_moments_v1"));
  const s3 = await scanOnce("scan 3");
  const raw3 = await page.evaluate(() => localStorage.getItem("plursky_moments_v1"));
  t(raw3 === raw2, "scan 3 wrote to the moment store");
  t(/No new photos/.test(s3.msg) && new RegExp(`${inWindow.length} were already imported`).test(s3.msg), `scan 3 message: "${s3.msg}"`);

  // ── Cloud restore: a stale copy cannot clobber ─────────────────────────
  const merged = await page.evaluate((cloud) => {
    const c = JSON.parse(JSON.stringify(cloud));
    // The cloud copy holds one moment under an OLDER night, and one moment
    // the device does not have at all.
    const nights = Object.keys(c);
    const m0 = c[nights[0]][0];
    c[nights[0]] = c[nights[0]].slice(1);
    c["9"] = [{ ...m0, artistId: "zz-stale" }];
    c[nights[0]].push({ id: "m_cloud_only_1", night: Number(nights[0]), artistId: null, tagSource: "fallback" });
    const local = _readMoments();
    return _mergeCloudMoments(local, c);
  }, cloudStale);
  const mFlat = flat(merged.local);
  t(merged.added === 1 && mFlat.some(m => m.id === "m_cloud_only_1"), `cloud restore added ${merged.added}, want only the cloud-only moment`);
  t(!mFlat.some(m => m.artistId === "zz-stale"), "a stale cloud copy came back as a duplicate in its old night");
  t(mFlat.find(m => m.id === manualId)?.tagSource === "manual", "cloud restore undid the hand tag");

  // ── Scan 4: a night with no set times is scanned in full ───────────────
  // Jake 2026-11-05. Night 3's times are blanked in the loaded data (both
  // weekends), and two new photos are taken on it outside its old hours: a
  // late lunch and a 23:40 shot. Both import, the card names the full-night
  // scan on its own line, and neither claims a set.
  const late = await page.evaluate(() => {
    const ds = window._DATA_SETS["acl-2026"];
    for (const a of [...ds.artists, ...(window.ARTISTS || [])]) if (Number(a.day) === 3) { a.start = ""; a.end = ""; }
    const cfg = ds.config, shift = cfg.weekendStartMs.W2 - cfg.weekendStartMs.W1;
    const at = (min) => cfg.dayDates[3].midnightUtc + shift + min * 60000;
    const mk = (id, ms) => ({ id, createdMs: ms, mediaType: "image", name: `${id}.jpg`, mime: "image/jpeg", lat: null, lng: null, acc: null, shared: true });
    const items = [mk("late-1", at(14 * 60 + 5)), mk("late-2", at(23 * 60 + 40))];
    return Promise.all(items.map(async (it, k) => {
      const c = document.createElement("canvas"); c.width = c.height = 48; const g = c.getContext("2d");
      g.fillStyle = k ? "#1a6" : "#a16"; g.fillRect(0, 0, 48, 48);
      window.__blobs[it.id] = URL.createObjectURL(await new Promise(r => c.toBlob(r, "image/jpeg", 0.9)));
      window.__lib.push(it); return it.id;
    }));
  });
  const before4 = flat(await store()).length;
  const s4 = await scanOnce("scan 4");
  const after4 = flat(await store());
  const note4 = await page.evaluate(() => document.querySelector("[data-scan-untimed-note]")?.textContent || "");
  t(after4.length === before4 + 2, `scan 4 stored ${after4.length - before4} from the night without set times, want 2 (${s4.msg})`);
  t(/^\d+ nights? ha(s|ve) no set times, scanned in full\.$/.test(note4.trim()), `the card does not name the full-night scan on its own line ("${note4}")`);
  const new4 = after4.filter(m => !flat(cloudStale).some(x => x.id === m.id) && Number(m._n) === 3 && m._fingerprint && /late[12]\.jpg$/.test(m._fingerprint));
  t(new4.length === 2 && new4.every(m => !m.artistId || m.tagSuggested), `a full-night photo claimed a set (${JSON.stringify(new4.map(m => [m.artistId, m.tagSuggested, m._n]))})`);

  // The scan diagnostic named the writer for every import.
  const diag = await page.evaluate(() => JSON.parse(localStorage.getItem("plursky_scan_diag_v1") || "null"));
  t(!!diag?.before && diag.events.some(e => e.ev === "write" && /processImportedFiles/.test(e.origin)), "the diagnostic did not record the import writes by name");
  t(errs.length === 0, `page errors: ${errs.join(" | ")}`);
} catch (e) {
  if (e.message !== "setup") fails.push(`harness error: ${e.stack || e}`);
} finally {
  await browser?.close().catch(() => {});
  server.kill("SIGTERM");
}
if (fails.length) { console.log(fails.map(f => `    ✗ ${f}`).join("\n")); console.log(`  ✗ multi-pass scan: ${fails.length} of ${n} checks failed`); process.exit(1); }
console.log(`  ✓ multi-pass scan: ${n} checks`);

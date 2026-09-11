#!/usr/bin/env node
// Offline festival packs — end to end, against the REAL OpenFreeMap + unpkg.
// Not part of verify.mjs (CI runs that, and this needs the network). Run by
// hand before shipping a change to the pack path:
//
//   node scripts/e2e-offline-packs.mjs            # screenshots → $E2E_OUT or /tmp
//
// Phases (A–F run with service workers BLOCKED, which is what the native app
// is: capacitor://localhost has no SW, so nothing may depend on one):
//   A. First launch: no pack; the Offline map sheet lists Lost Lands as unsaved.
//   B. Save Lost Lands: manifest written last, every file present, schedule
//      hash equals the published feed's.
//   C. A tile that 500s mid-update: the update fails, the saved copy is
//      byte-for-byte the one from B, no orphaned files.
//   D. Offline, first map open of the session: MapLibre comes from the pack's
//      stored copy (unpkg unreachable), tiles through pack://, OFFLINE badge.
//   E. Stale (feed hash moved) and expired (festival over) read as such; DELETE
//      frees every file, shared MapLibre copy included.
//   F. Not Plus: SAVE opens the Plursky+ sheet and saves nothing.
//   G. Service workers ON: saving two festivals leaves every Cache API cache —
//      the active festival's app cache and the tile cache — byte-identical.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8791, ORIGIN = `http://localhost:${PORT}`;
const OUT = process.env.E2E_OUT || "/tmp/plursky-e2e-packs";
mkdirSync(OUT, { recursive: true });
const FID = "lost-lands-2026";

let checks = 0, failed = 0;
function check(ok, msg) { checks++; console.log(`  ${ok ? "✓" : "✗"}  ${msg}`); if (!ok) failed++; }

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch();

function seed({ plus }) {
  return ([fid, plus]) => {
    localStorage.setItem("onboarded", "v1");
    localStorage.setItem("user_name", "Test");
    localStorage.setItem("active_festival_id", fid);
    localStorage.setItem("active_festival_explicit", "1");
    localStorage.setItem("plursky_use_realmap", "1");
    if (plus) localStorage.setItem("plursky_plus_active", "1"); else localStorage.removeItem("plursky_plus_active");
  };
}
async function newPage(ctx, tab = "home") {
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log(`    pageerror: ${e.message}`));
  await page.goto(`${ORIGIN}/?tab=${tab}`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof downloadFestivalPack === "function" && document.getElementById("root")?.children.length > 0, null, { timeout: 30000 });
  return page;
}
const idbKeys = page => page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open("plursky_packs", 1);
  r.onsuccess = () => { const q = r.result.transaction("files").objectStore("files").getAllKeys(); q.onsuccess = () => res(q.result.map(String)); q.onerror = rej; };
  r.onerror = rej;
}));
async function openSheet(page) {
  await page.getByRole("button", { name: "Map layers" }).click();
  await page.getByRole("button", { name: /Offline map/ }).click();
  await page.getByRole("dialog", { name: "Offline map" }).waitFor({ timeout: 10000 });
}
const rowStatus = (page, fid) => page.locator(`[data-pack-row="${fid}"] [data-pack-status]`).getAttribute("data-pack-status");
const closeSheet = page => page.getByRole("dialog", { name: "Offline map" }).getByRole("button", { name: "Close" }).click();

try {
  // ── A–E: service workers blocked (the native app) ─────────────────────────
  const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(seed({ plus: true }), [FID, true]);
  let page = await newPage(ctx, "map");

  console.log("A. first launch");
  check(JSON.stringify(await page.evaluate(() => _packMirror())) === "{}", "no pack on first launch");
  await openSheet(page);
  check(await rowStatus(page, FID) === "none", `Lost Lands row reads "none"`);
  await page.screenshot({ path: join(OUT, "A-sheet-first-launch.png") });

  console.log("B. save Lost Lands");
  await page.locator(`[data-pack-row="${FID}"]`).getByRole("button", { name: "SAVE" }).click();
  await page.waitForFunction(fid => _packMirror()[fid], FID, { timeout: 120000 });
  const m1 = await page.evaluate(fid => _packMirror()[fid], FID);
  const keys1 = await idbKeys(page);
  const own1 = keys1.filter(k => k.startsWith(m1.packId + "|"));
  check(own1.length === m1.files + 1, `${own1.length} files under ${m1.packId} = ${m1.files} downloaded + style`);
  check(keys1.includes("lib|js") && keys1.includes("lib|css"), "shared MapLibre copy stored");
  check(keys1.every(k => k.startsWith("lib|") || k.startsWith(m1.packId + "|")), "no file outside this pack and the shared lib");
  const feed = await page.evaluate(fid => fetch(`f/${fid}/schedule.json`).then(r => r.json()), FID);
  check(m1.scheduleHash === feed.scheduleHash, `manifest schedule hash ${m1.scheduleHash} = feed ${feed.scheduleHash}`);
  check(/^\d{8}_\d{6}_pt$/.test(m1.tileVersion || ""), `tile release recorded (${m1.tileVersion})`);
  console.log(`    ${m1.files} files, ${(m1.bytes / 1024).toFixed(0)} KB, z${m1.zoom.join("–")}`);
  await page.screenshot({ path: join(OUT, "B-sheet-saved.png") });
  await closeSheet(page);

  console.log("C. a failing tile mid-update keeps the saved copy");
  const sample = own1.find(k => k.includes("|t/14/"));
  const before = await page.evaluate(k => _packGet(k).then(b => b && b.byteLength), sample);
  let hit = 0;
  await page.route(/tiles\.openfreemap\.org\/planet\/[^?]+\/14\//, route => { hit++; return route.fulfill({ status: 500, body: "boom" }); });
  const err = await page.evaluate(fid => downloadFestivalPack(fid).then(() => null, e => e.message), FID);
  await page.unroute(/tiles\.openfreemap\.org\/planet\/[^?]+\/14\//);
  check(hit > 0 && /500/.test(err || ""), `update rejected (${err})`);
  const m2 = await page.evaluate(fid => _packMirror()[fid], FID);
  check(m2.packId === m1.packId && m2.savedAt === m1.savedAt, "manifest unchanged");
  const keys2 = await idbKeys(page);
  check(JSON.stringify(keys2.sort()) === JSON.stringify(keys1.sort()), "no orphaned files from the failed update");
  check(await page.evaluate(k => _packGet(k).then(b => b && b.byteLength), sample) === before, "a saved tile still reads back");
  // The failed update as the user sees it. Born from run 3: the message held
  // the full tile URL, one unbreakable line that ran under RETRY / DELETE.
  await openSheet(page);
  check(await rowStatus(page, FID) === "error", `row shows the failed update (status ${await rowStatus(page, FID)})`);
  const fit = await page.evaluate(fid => {
    const row = document.querySelector(`[data-pack-row="${fid}"]`);
    const text = row.querySelector("[data-pack-status]").getBoundingClientRect();
    const left = Math.min(...[...row.querySelectorAll("button")].map(b => b.getBoundingClientRect().left));
    return { text: Math.round(text.right), btn: Math.round(left), overflow: row.scrollWidth - row.clientWidth, line: row.querySelector("[data-pack-status]").textContent };
  }, FID);
  check(fit.text <= fit.btn && fit.overflow <= 0 && !/https?:\/\//.test(fit.line),
    `error line clear of its buttons, no URL (text right ${fit.text}, buttons left ${fit.btn}, overflow ${fit.overflow}: "${fit.line}")`);
  await page.screenshot({ path: join(OUT, "C-sheet-error.png") });
  await closeSheet(page);

  console.log("E1. stale: the published schedule moved");
  await page.evaluate(fid => { delete _packJobs[fid]; }, FID);   // C's error outranks stale; start clean
  await page.evaluate(async fid => {
    const m = { ..._packMirror()[fid], scheduleHash: "0000000000000000" };
    await _packTx("packs", "readwrite", s => { s.put(m); });
    await _packsReconcile();
  }, FID);
  await openSheet(page);
  await page.waitForFunction(fid => document.querySelector(`[data-pack-row="${fid}"] [data-pack-status]`)?.getAttribute("data-pack-status") === "stale", FID, { timeout: 10000 }).catch(() => {});
  check(await rowStatus(page, FID) === "stale", `row reads "stale"`);
  await page.screenshot({ path: join(OUT, "E1-sheet-stale.png") });
  await page.evaluate(async (m) => { await _packTx("packs", "readwrite", s => { s.put(m); }); await _packsReconcile(); }, m1);
  await page.close();

  console.log("D. offline, first map open of the session");
  page = await newPage(ctx, "home");
  check(await page.evaluate(() => !window.maplibregl), "MapLibre not loaded yet");
  // Phase A loaded MapLibre from unpkg in this context, and Chromium's HTTP
  // cache still answers while "offline". A phone that never opened the map
  // has no such copy — clear it so the pack's stored copy is what is tested.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  // Record every key the map asks the pack for, hit or miss (top-level
  // functions are window properties, and bare-name calls resolve through them).
  await page.evaluate(() => {
    window.__packLog = [];
    const get = window._packGet;
    window._packGet = async k => { const b = await get(k); window.__packLog.push([k, !!b]); return b; };
  });
  await ctx.setOffline(true);
  await page.getByRole("button", { name: /^Map$/ }).first().click();
  await page.getByText("OFFLINE · SAVED STREET MAP").waitFor({ timeout: 20000 });
  await page.waitForTimeout(4000);
  const log = await page.evaluate(() => window.__packLog || []);
  const of = re => log.filter(([k]) => re.test(k));
  const show = xs => xs.map(([k, h]) => k.split("|")[1] + (h ? "" : " ✗")).join(", ");
  const tiles = of(/\|t\//), tileMiss = tiles.filter(([, h]) => !h);
  check(tiles.length > 0 && tileMiss.length === 0, `every tile the map asked for came from the pack (${tiles.length} asked${tileMiss.length ? `; missing ${show(tileMiss.slice(0, 4))}` : ""})`);
  const sprites = of(/\|s\//);
  check(sprites.length >= 2 && sprites.every(([, h]) => h), `sprite from the pack (${show(sprites) || "none asked"})`);
  // A view with no text in it asks for no glyphs (Lost Lands' farm at z16
  // asked for none), so prove the labels path directly: a saved range read
  // through pack:// with the URL MapLibre would build from the saved style.
  const glyphs = of(/\|g\//);
  console.log(`    glyph ranges this view asked for: ${show(glyphs) || "none (no text in view)"}`);
  const [stack, glyphBytes] = await page.evaluate(async fid => {
    const st = await _packStyleFor(fid);
    const font = st.layers.map(l => l.layout && l.layout["text-font"]).find(f => Array.isArray(f) && f.every(x => typeof x === "string"));
    const url = st.glyphs.replace("{fontstack}", encodeURIComponent(font.join(","))).replace("{range}", "0-255");
    const r = await _packProtocol({ url, type: "arrayBuffer" });
    return [font.join(","), r.data.byteLength];
  }, FID);
  check(glyphBytes > 1000 && glyphs.every(([, h]) => h),
    `a saved glyph range reads back through pack:// (${stack} 0-255: ${glyphBytes} bytes)${glyphs.some(([, h]) => !h) ? "; a range the view asked for was not saved" : ""}`);
  const lib = of(/^lib\|/);
  const srcs = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(s => /maplibre|^blob:/.test(s)));
  check(lib.length === 2 && lib.every(([, h]) => h) && srcs.some(s => s.startsWith("blob:")) && await page.evaluate(() => !!window.maplibregl),
    `MapLibre loaded from the pack's stored copy (lib reads: ${show(lib) || "none"}; scripts: ${srcs.map(s => s.slice(0, 40)).join(", ")})`);
  check(await page.getByText("MAP ERROR").count() === 0, "no MAP ERROR");
  check(await page.getByText(/festival map shown|check your connection/i).count() === 0, "no offline fallback note");
  await page.screenshot({ path: join(OUT, "D-map-offline.png") });

  console.log("E2. expired, then delete");
  await page.evaluate(async fid => {
    const m = { ..._packMirror()[fid], endMs: Date.now() - 60000 };
    await _packTx("packs", "readwrite", s => { s.put(m); });
    await _packsReconcile();
  }, FID);
  await openSheet(page);
  check(await rowStatus(page, FID) === "over", `row reads "over"`);
  await page.screenshot({ path: join(OUT, "E2-sheet-over.png") });
  await page.locator(`[data-pack-row="${FID}"]`).getByRole("button", { name: "DELETE" }).click();
  await page.waitForFunction(fid => !_packMirror()[fid], FID, { timeout: 10000 });
  // The mirror flips before the file sweep finishes — wait on the store itself.
  let left = await idbKeys(page);
  for (let i = 0; i < 20 && left.length; i++) { await page.waitForTimeout(250); left = await idbKeys(page); }
  check(left.length === 0, `DELETE freed every file, shared MapLibre copy included${left.length ? ` — ${left.length} left: ${left.slice(0, 6).join(", ")}` : ""}`);
  await ctx.setOffline(false);
  await ctx.close();

  console.log("F. not Plus");
  const free = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  await free.addInitScript(seed({ plus: false }), [FID, false]);
  page = await newPage(free, "map");
  await openSheet(page);
  await page.locator(`[data-pack-row="${FID}"]`).getByRole("button", { name: "SAVE" }).click();
  await page.getByText(/Season Pass/i).first().waitFor({ timeout: 10000 }).catch(() => {});
  check(await page.getByText(/Season Pass/i).count() > 0, "SAVE opened the Plursky+ sheet");
  check(JSON.stringify(await page.evaluate(() => _packMirror())) === "{}" && !(await page.evaluate(() => Object.keys(_packJobs).length)), "nothing saved, no download started");
  await page.screenshot({ path: join(OUT, "F-free-save.png") });
  await free.close();

  console.log("G. service workers on: every Cache API cache untouched");
  const sw = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await sw.addInitScript(seed({ plus: true }), [FID, true]);
  page = await newPage(sw, "home");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller && typeof downloadFestivalPack === "function", null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const snap = () => page.evaluate(async () => {
    const out = {};
    for (const name of (await caches.keys()).sort()) {
      const c = await caches.open(name);
      const reqs = await c.keys();
      out[name] = [];
      for (const r of reqs) { const b = await (await c.match(r)).arrayBuffer(); out[name].push([r.url, b.byteLength, Array.from(new Uint8Array(await crypto.subtle.digest("SHA-1", b))).map(x => x.toString(16).padStart(2, "0")).join("")]); }
      out[name].sort();
    }
    return out;
  });
  const s1 = await snap();
  for (const fid of [FID, "edc-lv-2026"]) await page.evaluate(f => downloadFestivalPack(f), fid);
  const s2 = await snap();
  const names = Object.keys(s1);
  check(names.some(n => /^plursky-v\d+$/.test(n)), `app cache present (${names.join(", ")})`);
  check(JSON.stringify(s1) === JSON.stringify(s2), `every cache byte-identical after saving two festivals (${names.map(n => `${n}: ${s1[n].length}`).join(", ")})`);
  check(Object.keys(await page.evaluate(() => _packMirror())).length === 2, "both packs saved");
  await sw.close();
} catch (e) {
  failed++;
  console.log(`  ✗  aborted: ${e && e.stack || e}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `✗ ${failed} of ${checks} e2e checks failed` : `✓ ${checks} e2e checks · screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);

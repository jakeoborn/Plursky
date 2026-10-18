#!/usr/bin/env node
// Item 6 (Oct 16 spec): festival list rows carry official art and a state chip.
//   Ledger (data/festival-art.js): every entry is complete (official source
//   page, retrieval date, licence note, credit), its 168x168 webp tile exists,
//   is tracked in the SW precache and fits the file budget; no tile is map art,
//   and FestivalThumb reads art only through the ledger.
//   Coverage: every festival live or starting within 90 days of the pinned
//   date has a tile, or a named fallback reason.
//   Rendered (General Home, Sat Oct 17 2026, 390 and 320, Dark and Light):
//   ledger festivals show their tile, the rest a tile in their own registry
//   accent; every row has a right-aligned chip of the right kind; chip text is
//   AA (4.5:1); names are whole; no sideways pan.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0, failed = 0;
const check = (ok, msg) => { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } };

const TILE_BUDGET = 16 * 1024, TOTAL_BUDGET = 256 * 1024;   // 25 tiles at ~8 KB
// Every listed festival carries art (Jake 2026-10-18: "a visual based app,
// lots of photos"). A festival allowed the tinted letter tile goes here, with
// why. None today.
const FALLBACK = {};
// Sat Oct 17, 4 pm ET: III Points is live, so all three chip kinds are on the page.
const AT = "2026-10-17T20:00:00Z";

// ── Ledger ──────────────────────────────────────────────────────────────
const win = {};
vm.runInNewContext(readFileSync(join(ROOT, "data/festival-art.js"), "utf8"), { window: win });
const ART = win.PLURSKY_FESTIVAL_ART || {};
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const webpSize = (buf) => {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
  if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  return null;
};
let total = 0;
const ids = Object.keys(ART);
check(ids.length >= 8, `ledger has entries (${ids.length})`);
for (const id of ids) {
  const r = ART[id];
  for (const k of ["tile", "sourcePage", "credit", "retrieved", "license", "kind"])
    check(typeof r[k] === "string" && r[k].length > 0, `${id}: ${k} is recorded`);
  check(/^https:\/\//.test(r.sourcePage || ""), `${id}: sourcePage is an https URL`);
  check(r.assetUrl === null || /^https:\/\//.test(r.assetUrl || ""), `${id}: assetUrl is https or explicitly null`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(r.retrieved || ""), `${id}: retrieval date is YYYY-MM-DD`);
  check(["photo", "key-art", "logo"].includes(r.kind), `${id}: kind is photo / key-art / logo (${r.kind})`);
  check(!/map/i.test(r.tile || "") && !/map/i.test(r.card || ""), `${id}: no map art in the tile or card`);
  check(r.tile === `festival-art/tiles/${id}.webp`, `${id}: tile path is festival-art/tiles/${id}.webp`);
  const f = join(ROOT, r.tile || "-");
  if (!existsSync(f)) { check(false, `${id}: tile file exists`); continue; }
  const sz = statSync(f).size; total += sz;
  const dim = webpSize(readFileSync(f));
  check(dim && dim.w === 168 && dim.h === 168 && r.width === 168 && r.height === 168, `${id}: tile is 168x168 webp (${dim?.w}x${dim?.h})`);
  check(sz <= TILE_BUDGET, `${id}: tile within ${TILE_BUDGET} B (${sz})`);
  check(sw.includes(`'./${r.tile}'`), `${id}: tile is in the SW precache`);
  if (r.card) check(existsSync(join(ROOT, r.card)) && sw.includes(`'./${r.card}'`), `${id}: card file exists and is precached`);
}
check(total <= TOTAL_BUDGET, `all tiles within ${TOTAL_BUDGET} B (${total})`);
// One door: FestivalThumb resolves art only through the ledger.
const chrome = readFileSync(join(ROOT, "chrome.jsx"), "utf8");
const thumb = chrome.slice(chrome.indexOf("function FestivalThumb("), chrome.indexOf("\n}\n", chrome.indexOf("function FestivalThumb(")));
check(thumb.length > 100 && /festivalArtFor\(/.test(thumb), "FestivalThumb reads art through festivalArtFor (the ledger)");
check(!/mapImage|festival-art\/[a-z]/.test(thumb), "FestivalThumb names no map image and no art path of its own");

// ── Rendered ────────────────────────────────────────────────────────────
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const lum = (rgb) => { const c = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const kindsSeen = new Set();
  for (const mode of ["dark", "light"]) for (const w of [390, 320, 1280]) {
    const tag = `${mode} ${w}`;
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: w, height: 900 } });
    await wireVendor(ctx);
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript((mode) => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("user_name", "Test");
      localStorage.setItem("plursky.appearance", mode);
    }, mode);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
    const ok = await page.waitForSelector("[data-landing-row]", { timeout: 60000 }).then(() => true, () => false);
    check(ok, `${tag}: General Home lists festival rows`);
    if (!ok) { await ctx.close(); continue; }
    await page.clock.runFor(1200); await page.waitForTimeout(600);
    const res = await page.evaluate(({ AT, FALLBACK }) => {
      const now = Date.parse(AT), horizon = now + 90 * 864e5;
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0.5)) return rgb(c); } return [255, 255, 255]; };
      const rows = [...document.querySelectorAll("[data-landing-row]")].map(row => {
        const id = row.getAttribute("data-landing-row");
        const entry = (window.FESTIVALS_REGISTRY || []).find(f => f.config.id === id);
        const thumb = row.querySelector("[data-festival-thumb]"), chip = row.querySelector("[data-landing-chip]");
        const name = row.querySelector("[data-fit-words]");
        const rb = row.getBoundingClientRect(), cb = chip?.getBoundingClientRect(), tb = thumb?.getBoundingClientRect();
        const img = thumb?.querySelector("img");
        const cs = chip ? getComputedStyle(chip) : null;
        return {
          id, art: thumb?.getAttribute("data-art"), imgOk: !!img && img.complete && img.naturalWidth === 168,
          src: img?.getAttribute("src") || "", tileW: tb ? Math.round(tb.width) : 0,
          radius: thumb ? getComputedStyle(thumb).borderTopLeftRadius : "",
          chip: chip?.getAttribute("data-landing-chip"), chipText: chip?.textContent || "",
          chipRight: cb ? rb.right - cb.right <= 1 : false, chipInside: cb ? cb.left >= (tb?.right || 0) : false,
          chipFg: cs ? rgb(cs.color) : null, chipBg: chip ? bgOf(chip) : null,
          nameWhole: name ? name.scrollWidth <= name.clientWidth + 1 : false,
          // Jake 2026-10-18: one line, or at most two, at 320 / 390 / desktop.
          nameLines: name ? Math.round(name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight)) : 0,
          chipLines: cs ? Math.round((cb.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) / parseFloat(cs.lineHeight)) : 0,
          accent: entry?.accent || null,
          window: !!entry && (entry.config.startMs <= horizon && entry.config.endMs >= now),
          hasLedger: !!window.PLURSKY_FESTIVAL_ART?.[id],
        };
      });
      return { rows, hscroll: document.documentElement.scrollWidth > innerWidth };
    }, { AT, FALLBACK });
    check(res.rows.length >= 10, `${tag}: rows rendered (${res.rows.length})`);
    check(!res.hscroll, `${tag}: no sideways pan`);
    for (const r of res.rows) {
      kindsSeen.add(r.chip);
      check(r.tileW === 56 && r.radius === "12px", `${tag}: ${r.id}: 56 px tile, 12 px radius (${r.tileW}, ${r.radius})`);
      if (r.hasLedger) check(r.art === "ledger" && r.imgOk && r.src.includes(`tiles/${r.id}.webp`), `${tag}: ${r.id}: shows its ledger tile (${r.art}, ${r.src})`);
      else check(r.art === (r.accent ? "tinted" : "plain"), `${tag}: ${r.id}: no art, so the tile is tinted in its own accent (${r.art})`);
      check(["fill", "accent", "neutral"].includes(r.chip) && r.chipText.length > 0, `${tag}: ${r.id}: has a state chip (${r.chip} "${r.chipText}")`);
      check(r.chipRight && r.chipInside, `${tag}: ${r.id}: the chip sits at the row's right edge`);
      const cr = r.chipFg && r.chipBg ? ratio(r.chipFg, r.chipBg) : 0;
      check(cr >= 4.5, `${tag}: ${r.id}: chip text is AA (${cr.toFixed(2)}:1)`);
      check(r.nameWhole, `${tag}: ${r.id}: the name is whole`);
      check(r.nameLines >= 1 && r.nameLines <= 2, `${tag}: ${r.id}: the name takes one or two lines (${r.nameLines})`);
      check(r.chipLines >= 1 && r.chipLines <= 2, `${tag}: ${r.id}: the chip takes one or two lines (${r.chipLines})`);
      check(r.hasLedger || FALLBACK[r.id], `${tag}: ${r.id}: every listed festival has its art (or a named fallback)`);
    }
    const st = (chip) => res.rows.find(r => r.chip === chip);
    check(res.rows.some(r => r.chipText === "Lineup in · set times TBA" && r.chip === "accent"), `${tag}: "Lineup in · set times TBA" draws as the accent outline`);
    check(res.rows.some(r => r.chipText === "Not open yet" && r.chip === "neutral"), `${tag}: "Not open yet" draws neutral`);
    check(!errors.length, `${tag}: no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  check(kindsSeen.has("fill") && kindsSeen.has("accent") && kindsSeen.has("neutral"), `all three chip kinds render (${[...kindsSeen].join(", ")})`);
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ festival art: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ festival art: ${checks} checks (official tiles from the ledger, tinted fallbacks, state chips AA, names and chips at most two lines, 390, 320 and 1280, both modes)`);

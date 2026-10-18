#!/usr/bin/env node
// Item 5 (Oct 16 spec): every set row carries the act's face. Lineup rows and
// the post-festival recap already did; Today's "Your night so far" (NpSaved)
// was name-only. Rendered on III Points 2026 before doors (Thu Oct 15) with
// three saved sets, both modes, 390 and 320:
//   · every saved row has a 40 px face, beside (not over) the name;
//   · a licensed-ledger act shows its ledger portrait;
//   · a B2B / "with" act shows one face per member, never the first member alone;
//   · an act with no photo shows initials; names are never truncated.
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
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
const FID = "iii-points-2026", AT = "2026-10-15T18:00:00Z";
const URL = `http://127.0.0.1:${PORT}/index.html?f=${FID}&tab=home`;

try {
  await serverReady(`http://127.0.0.1:${PORT}/index.html`);
  const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const open = async (w, mode, saved) => {
    const ctx = await browser.newContext({ serviceWorkers: "block", viewport: { width: w, height: 900 } });
    await wireVendor(ctx);
    await ctx.route(/api\.spotify\.com|i\.scdn\.co/, r => r.abort());   // no Spotify: photos are ledger or initials
    await ctx.clock.install({ time: new Date(AT) });
    await ctx.addInitScript(([fid, mode, saved]) => {
      localStorage.setItem("onboarded", "v1"); localStorage.setItem("active_festival_id", fid);
      localStorage.setItem("active_festival_explicit", "1"); localStorage.setItem("cloud_nudge_seen", "1");
      localStorage.setItem("plursky.appearance", mode);
      if (saved) localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(saved));
    }, [FID, mode, saved]);
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(fid => window.FESTIVAL_CONFIG?.id === fid, FID, { timeout: 60000 });
    return { ctx, page, errors };
  };
  // Pick the three acts from the data: the ledger act, a two-member act, a no-photo act.
  const pre = await open(390, "dark", null);
  const pick = await pre.page.evaluate(() => {
    const acts = (window.ARTISTS || []).filter(a => a.start && a.day != null);
    const ledger = acts.find(a => getPermanentArtistImage(a.name));
    const pair = acts.find(a => _duoMembers(a.name).length === 2);
    const plain = acts.find(a => _duoMembers(a.name).length === 1 && !getPermanentArtistImage(a.name) && a !== ledger);
    return { ledger: ledger?.id, pair: pair?.id, pairName: pair?.name, plain: plain?.id, ledgerName: ledger?.name, plainName: plain?.name };
  });
  await pre.ctx.close();
  check(pick.ledger && pick.pair && pick.plain, `fixture acts found in ${FID} (ledger ${pick.ledgerName}, pair ${pick.pairName}, plain ${pick.plainName})`);
  const saved = [pick.ledger, pick.pair, pick.plain].filter(Boolean);

  for (const mode of ["dark", "light"]) for (const w of [390, 320]) {
    const tag = `${mode} ${w}`;
    const { ctx, page, errors } = await open(w, mode, saved);
    const ok = await page.waitForSelector("[data-np-saved] .np-srow", { timeout: 60000 }).then(() => true, () => false);
    check(ok, `${tag}: Today shows "Your night so far" with the saved rows`);
    if (!ok) { await ctx.close(); continue; }
    await page.clock.runFor(1000); await page.waitForTimeout(400);
    const rows = await page.evaluate(() => [...document.querySelectorAll("[data-np-saved] .np-srow")].map(r => {
      const faces = [...r.querySelectorAll("[data-face]")];
      const name = r.querySelector(".np-sname"), face = r.querySelector(".np-sface");
      const nb = name.getBoundingClientRect(), fb = face?.getBoundingClientRect();
      // Every drawn face, not just the slot: a pair laid out wider than its
      // slot ran under the name while the slot itself measured clean.
      const faceRight = Math.max(fb ? fb.right : 0, ...faces.map(f => f.getBoundingClientRect().right));
      return {
        label: r.getAttribute("aria-label"),
        faces: faces.map(f => ({ who: f.getAttribute("data-face"), src: f.getAttribute("data-photo-source"), img: !!f.querySelector("img") })),
        faceW: fb ? Math.round(fb.width) : 0, overlap: fb ? faceRight > nb.left + 0.5 : true,
        truncated: name.scrollWidth > name.clientWidth + 1 || getComputedStyle(name).textOverflow === "ellipsis",
      };
    }));
    check(rows.length === 3, `${tag}: three saved rows (got ${rows.length})`);
    for (const r of rows) {
      check(r.faces.length >= 1 && r.faceW >= 38 && (r.faces.length > 1 || r.faceW <= 42), `${tag}: ${r.label}: a 40 px face, or a whole face per member (${r.faceW} px, ${r.faces.length} face)`);
      check(!r.overlap, `${tag}: ${r.label}: the face sits beside the name, not over it`);
      check(!r.truncated, `${tag}: ${r.label}: the name is not truncated`);
    }
    const L = rows.find(r => r.label?.startsWith(pick.ledgerName));
    check(L && L.faces[0]?.img && L.faces[0]?.src && L.faces[0].src !== "initials" && L.faces[0].src !== "spotify", `${tag}: ${pick.ledgerName} shows its licensed portrait (source ${L?.faces[0]?.src})`);
    const P = rows.find(r => r.label?.startsWith(pick.pairName));
    check(P && P.faces.length === 2 && P.faces[0].who !== P.faces[1].who, `${tag}: ${pick.pairName} shows a face per member (${P?.faces.map(f => f.who).join(" + ")})`);
    const N = rows.find(r => r.label?.startsWith(pick.plainName));
    check(N && N.faces[0]?.src === "initials" && !N.faces[0].img, `${tag}: ${pick.plainName} (no photo) shows initials`);
    check(!errors.length, `${tag}: no page errors (${errors.slice(0, 2).join(" | ")})`);
    await ctx.close();
  }
  await browser.close();
} finally { server.kill(); }
if (failed) { console.log(`✗ set row faces: ${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`✓ set row faces: ${checks} checks (Today's saved rows carry ledger / pair / initials faces, both modes, 390 and 320)`);

#!/usr/bin/env node
// SPEC-179 PR B, the real MomentLightbox: a III Points clip opened while ACL
// is the active festival. The Fix-it picker must render a search input wired
// to the query, list the clip's OWN festival's acts with THAT festival's stage
// labels, and after a pick show the picked act and its stage — not look the id
// up in ACL's lineup (which shows nothing). Typing "yukimatsu" must find the
// stylized billing "¥ØU$UK€ ¥UK1MAT$U" on RC95.
//
// Runs the real compiled app in Chrome. Mutants are served in place of
// build/spotify.js; each must turn the gate red.
//
//   node scripts/test-lightbox-retag-search.mjs [--shots <dir>]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { serverReady } from "./lib/server-ready.mjs";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = process.cwd();
const SHOTS = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
const BUILT = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const reservePort = () => new Promise((res, rej) => { const s = createServer(); s.once("error", rej); s.listen(0, "127.0.0.1", () => { const a = s.address(); s.close(e => e ? rej(e) : res(a.port)); }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PORT = await reservePort();
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await serverReady(`http://127.0.0.1:${PORT}/index.html`);
const executablePath = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

async function run(spotifySrc, { width = 393, shotPrefix = null } = {}) {
  const fails = []; let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  await wireVendor(ctx);
  await ctx.addInitScript(() => {
    localStorage.setItem("onboarded", "v1");
    localStorage.setItem("active_festival_id", "acl-2026");
    localStorage.setItem("active_festival_explicit", "1");
    localStorage.setItem("artist_images_v1", "{}");
  });
  await ctx.route(/api\.spotify\.com|itunes\.apple\.com|theaudiodb\.com/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  if (spotifySrc !== BUILT) await ctx.route(/\/build\/spotify\.js/, r => r.fulfill({ status: 200, contentType: "application/javascript", body: spotifySrc }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof MomentLightbox === "function" && window._DATA_SETS?.["iii-points-2026"]?.artists?.length > 0
      && document.getElementById("root")?.children.length > 0, null, { timeout: 60000 });
    const fx = await page.evaluate(() => {
      const ds = window._DATA_SETS["iii-points-2026"];
      const yuki = ds.artists.find(a => /UK1MAT/.test(a.name));
      const horse = ds.artists.find(a => /horsegiirl/i.test(a.name));
      const st = id => (ds.stages.find(s => s.id === id) || {});
      return { active: window.FESTIVAL_CONFIG.id, yuki: { id: yuki.id, name: yuki.name, stage: st(yuki.stage).name, short: st(yuki.stage).short },
               horse: { id: horse.id, name: horse.name, stage: st(horse.stage).name },
               inActive: (window.ARTISTS || []).some(a => a.id === horse.id) };
    });
    t(fx.active === "acl-2026", `fixture: ACL is the active festival (got ${fx.active})`);
    t(!fx.inActive, "fixture: horsegiirL is not in the active lineup");
    await page.evaluate(({ horse, yuki }) => {
      document.body.innerHTML = '<div id="lb"></div>';
      window.__lb = { updates: [] };
      const clip = { id: "c1", festivalId: "iii-points-2026", night: 2, kind: "image", photoId: null,
        takenAt: "2026-10-17 23:31", artistId: horse.id, tagSource: "time", tagAmbiguous: true, tagAlternatives: [yuki.id, horse.id] };
      function Host() {
        const [ms, setMs] = React.useState([clip]);
        window.__lb.moments = ms;
        return React.createElement(MomentLightbox, { moments: ms, index: 0, onClose() {}, onIndexChange() {},
          onUpdate: (m, patch) => { window.__lb.updates.push(patch); setMs(xs => xs.map(x => x.id === m.id ? { ...x, ...patch } : x)); } });
      }
      ReactDOM.createRoot(document.getElementById("lb")).render(React.createElement(Host));
    }, fx);
    await sleep(400);
    const body = () => page.evaluate(() => document.getElementById("lb").innerText);
    let txt = await body();
    t(txt.includes(fx.horse.name), "the clip's current act (horsegiirL) is shown from its own festival");
    t(txt.includes(fx.horse.stage), `its own festival's stage label is shown (${fx.horse.stage})`);
    const fix = page.getByRole("button", { name: /Wrong act\? Fix it/ });
    t(await fix.count() === 1, "\"Wrong act? Fix it\" is offered (the act resolved)");
    if (await fix.count()) await fix.click();
    else await page.getByRole("button", { name: /Tag this moment/ }).click().catch(() => {});
    const input = page.locator("input[data-retag-search]");
    t(await input.count() === 1, "the picker renders a search input");
    if (await input.count()) {
      t(/III Points|this festival/i.test(await input.getAttribute("placeholder") || ""), "the input names the clip's festival");
      await input.fill("yukimatsu");
      await sleep(250);
      t((await input.inputValue()) === "yukimatsu", "the input holds the query");
      const opts = page.locator("#lb button").filter({ hasText: fx.yuki.name });
      t(await opts.count() === 1, `typing "yukimatsu" lists ${fx.yuki.name}`);
      const rows = page.locator("#lb button").filter({ hasText: /\d:\d\d\s?(AM|PM)/ });
      t(await rows.filter({ hasText: fx.horse.name }).count() === 0, "horsegiirL is not a match for \"yukimatsu\"");
      t(await rows.count() === 1, `exactly one act matches "yukimatsu" (got ${await rows.count()})`);
      const label = await opts.first().innerText().catch(() => "");
      t(label.includes(fx.yuki.short) && /11:15/.test(label), `the match carries III Points' stage label and time (got ${JSON.stringify(label)})`);
      if (shotPrefix) await page.screenshot({ path: `${shotPrefix}-search.png`, fullPage: false });
      await input.fill("zzqx-no-act");
      await sleep(200);
      t(/No act matches/.test(await body()), "a query with no match says so");
      await input.fill("yukimatsu");
      await sleep(200);
      if (await opts.count()) await opts.first().click();
      await sleep(300);
      const last = await page.evaluate(() => ({ u: window.__lb.updates.at(-1), m: window.__lb.moments[0] }));
      t(last.m.artistId === fx.yuki.id && last.m.tagSource === "manual", `the pick tags Yukimatsu by hand (got ${JSON.stringify(last.m.artistId)} / ${last.m.tagSource})`);
      t(last.m.tagAlternatives === null, "the pick clears the offered alternatives");
      txt = await body();
      t(txt.includes(fx.yuki.name), "after the pick the lightbox shows Yukimatsu");
      t(txt.includes(fx.yuki.stage), `after the pick the lightbox shows his stage (${fx.yuki.stage})`);
      t(!txt.includes(fx.horse.name), "horsegiirL is gone after the pick");
      if (shotPrefix) await page.screenshot({ path: `${shotPrefix}-picked.png`, fullPage: false });
    }
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    t(wide <= 0, `no sideways scroll at ${width}px (${wide}px over)`);
    t(!errors.length, `no page errors (${errors.slice(0, 2).join(" | ")})`);
  } catch (e) { fails.push(`threw: ${e.message.split("\n")[0]}`); }
  await ctx.close();
  return { n, fails };
}

const MUTANTS = [
  ["no search input", [/retagging && React\.createElement\("input", \{\s*type: "search",/, 'false && React.createElement("input", { type: "search",']],
  ["act looked up in the active lineup", [/var artist = m\?\.artistId \? mf\.artists\.find/, "var artist = m?.artistId ? ARTISTS.find"]],
  ["picker labels from the active stages", [/var st = mf\.stages\.find\(s => s\.id === a\.stage\);/, "var st = STAGES.find(s => s.id === a.stage);"]],
  ["input not wired to the query", [/onChange: e => setRetagQuery\(e\.target\.value\)/, "onChange: e => {}"]],
];

let all = [], checks = 0, caught = 0;
try {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  for (const w of [393, 320]) {
    const r = await run(BUILT, { width: w, shotPrefix: SHOTS ? join(SHOTS, `lightbox-retag-${w}`) : null });
    checks += r.n; all.push(...r.fails.map(f => `${w}px: ${f}`));
  }
  for (const [name, [re, rep]] of MUTANTS) {
    if (!re.test(BUILT)) { all.push(`mutant "${name}" did not apply (pattern missing)`); continue; }
    const r = await run(BUILT.replace(re, rep));
    if (r.fails.length) caught++; else all.push(`mutant "${name}" survived`);
  }
} finally { await browser.close(); server.kill(); }
console.log(`  lightbox retag search: ${checks} checks, ${caught}/${MUTANTS.length} mutants caught`);
if (all.length) { for (const f of all) console.log(`  ✗ ${f}`); process.exit(1); }
console.log("  ✓ a III Points clip under ACL: search input, own-festival matches and stage labels, the pick shows Yukimatsu on RC95");

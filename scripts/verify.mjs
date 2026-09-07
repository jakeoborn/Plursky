#!/usr/bin/env node
// The verify gate — the one CLAUDE.md §2 and AGENTS.md §2 rule 2 demand.
//
// `scripts/build.mjs` only COPIES files. A green "[build] dist/ ready" means
// nothing was validated, so every change has needed a manual Babel transform
// plus a manual headless mount probe. Manual means skippable, and it means the
// local check and CI can drift apart. This is that check as code, run by both.
//
//   node scripts/verify.mjs              # parse gate + mount probe
//   node scripts/verify.mjs --parse-only # skip the browser (no network needed)
//
// Exits non-zero on the first failure.

import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { transformAsync } from "@babel/core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FESTIVAL_MODULES = readdirSync(join(ROOT, "data", "festivals"))
  .filter(f => f.endsWith(".js")).sort();
const fail = m => { console.error(`\n✗ ${m}`); process.exit(1); };

// ── 0. Tracked-symlink gate ────────────────────────────────────────────────
// A symlink committed at the repo root killed the GitHub Pages deploy on
// 2026-08-29: `git add -A` picked up a `node_modules` symlink because
// .gitignore said `node_modules/`, and a trailing slash matches DIRECTORIES
// ONLY. Its target was an absolute path outside the repo, so on the runner it
// dangled and `actions/upload-pages-artifact`'s `tar --dereference` exited 1
// with "File removed before we read it". The deploy failed on two consecutive
// merges while plursky.com kept serving the build from before them.
//
// Nothing caught it: sanity.yml is green on a tree that cannot deploy, because
// every gate reads FILES and this is a property of the INDEX. So the check is
// on the index. It is deliberately absolute — the repo ships no symlinks and
// has no reason to, and a "symlinks that resolve" rule would still pass
// locally (where the target exists) and fail on the runner, which is exactly
// the failure being prevented.
const symlinks = execFileSync("git", ["ls-files", "-s"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean)
  .filter(l => l.startsWith("120000"))
  .map(l => l.split("\t").slice(1).join("\t"));
console.log("▸ Tracked-symlink gate — the index must contain no symlinks");
if (symlinks.length) {
  for (const f of symlinks) console.log(`  ✗  ${f}`);
  fail(
    `${symlinks.length} symlink(s) tracked in git — this breaks the Pages ` +
    `deploy (tar --dereference cannot follow them on the runner). ` +
    `Remove with: git rm --cached ${symlinks.join(" ")}`
  );
}
console.log("  ✓ none");

// ── 0b. Podfile path gate ──────────────────────────────────────────────────
// Second face of the same symlink bug. `npx cap sync ios` REWRITES every pod
// path from the resolved realpath of node_modules, so running it in a
// worktree whose node_modules is a symlink emits
// `:path => '../../../wtmap/node_modules/@capacitor/ios'` — a path outside
// the repo, pointing at a scratchpad that exists on exactly one machine.
// Committed, that breaks `pod install` for every clean checkout and CI.
// Caught by hand on 2026-08-29 while preparing the 1.12 (24) resubmit; a
// gate is cheaper than catching it by hand twice.
const podfile = join(ROOT, "ios/App/Podfile");
console.log("▸ Podfile path gate — pod paths must stay inside the repo");
if (existsSync(podfile)) {
  const bad = readFileSync(podfile, "utf8").split("\n")
    .filter(l => /:path\s*=>|require_relative/.test(l))
    .filter(l => !/(\.\.\/){1,2}node_modules\//.test(l) && /node_modules/.test(l));
  if (bad.length) {
    for (const l of bad) console.log(`  ✗  ${l.trim()}`);
    fail(
      `${bad.length} pod path(s) escape the repo — re-run \`npx cap sync ios\` ` +
      `in a worktree where node_modules is a REAL directory, not a symlink.`
    );
  }
  console.log("  ✓ all pod paths repo-relative");
} else console.log("  – no Podfile");

// ── 0c. Precompile gates (v253) ────────────────────────────────────────────
// The app no longer transpiles in the browser. Three ways that can rot:
// index.html slipping back to text/babel, build/ going stale against the
// sources it was compiled from, and sw.js precaching URLs nobody requests
// (which strands offline users on the previous version).
{
  console.log("▸ Precompile gate — no in-browser Babel, build/ current");
  const html = readFileSync(join(ROOT, "index.html"), "utf8");

  if (/type="text\/babel"/.test(html))
    fail("index.html still has a text/babel script — the browser would need Babel again");
  if (/@babel\/standalone/.test(html))
    fail("index.html still loads babel-standalone");
  for (const dev of ["react.development.js", "react-dom.development.js"])
    if (html.includes(dev)) fail(`index.html ships ${dev} — production builds only`);

  const { compileTargets, compileOne, hostileSyntax } = await import("./compile.mjs");
  const names = compileTargets(html);
  if (names.length < 10) fail(`only ${names.length} compile target(s) found in index.html`);

  // Byte-compare the committed output against a fresh in-memory compile. A
  // stale build/ is invisible at runtime — the app boots happily on last
  // week's code — so it has to be caught here.
  let stale = [];
  for (const n of names) {
    const out = join(ROOT, "build", `${n}.js`);
    if (!existsSync(out)) { stale.push(`${n}.js (missing)`); continue; }
    const fresh = await compileOne(n);
    if (hostileSyntax(fresh).length) fail(`${n}.js contains iOS-hostile syntax`);
    if (readFileSync(out, "utf8") !== fresh) stale.push(`${n}.js`);
  }
  if (stale.length)
    fail(`build/ is stale vs sources: ${stale.join(", ")} — run node scripts/compile.mjs`);

  // sw.js precaches by URL. A missed file fails addAll ATOMICALLY, which
  // wedges an updating user on the old service worker.
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const swBuilt = [...sw.matchAll(/`\.\/build\/([A-Za-z0-9._-]+)\.js\?v=/g)].map(m => m[1]);
  const missingSw = names.filter(n => !swBuilt.includes(n));
  const extraSw  = swBuilt.filter(n => !names.includes(n));
  if (missingSw.length) fail(`sw.js precache is missing: ${missingSw.join(", ")}`);
  if (extraSw.length)   fail(`sw.js precaches files index.html does not load: ${extraSw.join(", ")}`);
  if (/@babel\/standalone/.test(sw)) fail("sw.js still precaches babel-standalone");

  // The check above compares the WORKING TREE against a fresh compile, which
  // catches "forgot to recompile". It cannot catch "committed a stale build/",
  // because CI runs build.mjs before this and would have silently regenerated
  // it. So also require that build/ be clean against the index — in CI the
  // checkout starts clean, so any diff here means the commit was stale.
  // Locally that is just uncommitted work in progress, hence warn-only.
  const dirty = execFileSync("git", ["status", "--porcelain", "--", "build"], { cwd: ROOT })
    .toString().trim();
  if (dirty) {
    if (process.env.CI)
      fail(`build/ differs from the commit — recompile and commit:\n${dirty}`);
    console.log(`  ! build/ has uncommitted changes (fine locally, fatal in CI)`);
  }

  console.log(`  ✓ ${names.length} compiled file(s) current, sw.js mirrors index.html`);
}

// ── 1. Parse gate ──────────────────────────────────────────────────────────
// Babel with the react preset — the same transform the browser applies to each
// <script type="text/babel">. tsc's syntax pass does NOT cover JSX semantics
// the preset rejects, which is why this runs in addition to it.
const jsx = execFileSync("git", ["ls-files", "*.jsx", ":!ios/**"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean);

console.log(`▸ Parse gate — @babel/preset-react over ${jsx.length} files`);
let bad = 0;
for (const f of jsx) {
  try {
    await transformAsync(readFileSync(join(ROOT, f), "utf8"), {
      filename: f, presets: [["@babel/preset-react", {}]], babelrc: false, configFile: false,
    });
  } catch (e) {
    console.error(`  ✗ ${f}: ${e.message.split("\n")[0]}`);
    bad++;
  }
}
if (bad) fail(`${bad} file(s) failed the react-preset transform`);
console.log(`  ✓ all ${jsx.length} parsed`);

// The wave-1 festival data modules are plain .js, so the *.jsx glob above skips
// them — but they are loaded by index.html and a syntax error in one would take
// data.jsx's registry down with it. Same transform, same gate.
const fdata = FESTIVAL_MODULES.map(f => `data/festivals/${f}`);
if (fdata.length) {
  console.log(`▸ Parse gate — festival data modules (${fdata.length})`);
  let fbad = 0;
  for (const f of fdata) {
    try {
      await transformAsync(readFileSync(join(ROOT, f), "utf8"), {
        filename: f, presets: [["@babel/preset-react", {}]], babelrc: false, configFile: false,
      });
    } catch (e) { console.error(`  ✗ ${f}: ${e.message.split("\n")[0]}`); fbad++; }
  }
  if (fbad) fail(`${fbad} festival data module(s) failed to parse`);
  console.log(`  ✓ all ${fdata.length} parsed`);
}

// ── Festival registration gate ───────────────────────────────────────────
// A module in data/festivals/ has to be named in THREE places or it is dead
// weight: index.html's script tags (or the browser never loads it), sw.js's
// LOCAL precache (or the festival vanishes offline), and _WAVE1_IDS in
// data.jsx (or data.jsx never reads it into the registry). Miss one and the
// failure is SILENT — that is the iii-points lesson, and CLAUDE.md's build
// bar has carried "registered in ALL THREE" as a manual checklist item ever
// since. A recurring manual check is a design bug, so it is a gate now.
{
  console.log(`▸ Festival registration gate — every module named in all three places`);
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const sw   = readFileSync(join(ROOT, "sw.js"), "utf8");
  const djsx = readFileSync(join(ROOT, "data.jsx"), "utf8");
  const waveBlock = (djsx.match(/const _WAVE1_IDS = \[([\s\S]*?)\];/) || [, ""])[1];
  let rbad = 0;
  for (const file of FESTIVAL_MODULES) {
    const id = file.replace(/\.js$/, "");
    const missing = [];
    if (!html.includes(`data/festivals/${file}?v=`))          missing.push("index.html <script>");
    if (!sw.includes(`./data/festivals/${file}?v=`))          missing.push("sw.js LOCAL precache");
    if (!waveBlock.includes(`"${id}"`))                       missing.push("_WAVE1_IDS in data.jsx");
    if (missing.length) { console.log(`  ✗ ${id.padEnd(26)} missing from ${missing.join(" + ")}`); rbad++; }
    else console.log(`  ok ${id.padEnd(26)} index.html + sw.js + _WAVE1_IDS`);
  }
  if (rbad) fail(`${rbad} festival module(s) not registered in all three places`);
  console.log(`  ✓ ${FESTIVAL_MODULES.length} module(s) fully registered`);
}

// ── Day-count gate ───────────────────────────────────────────────────────
// Born from a real defect, shipped and live: home.jsx printed the night
// counter as `NIGHT ${day} / 3` — a hardcoded denominator. It renders ONLY
// during a festival, so for as long as every shipped festival was still in
// the future nobody could see it. The moment ARC 2026 (Sep 4–7) went live
// it read "NIGHT 3 / 3" on a four-night festival, and the same literal was
// already wrong for Summerfest (9 days → "NIGHT 7 / 3") and Lollapalooza
// (4 days), both available.
//
// Day counts are per-festival and switch with the active config, so ANY
// numeric literal as the denominator of a day/night counter is a bug.
// Read the count off DAYS (data.jsx re-derives it from the active config).
{
  console.log(`▸ Day-count gate — no hardcoded day/night denominators`);
  const SRC = readdirSync(ROOT).filter(f => f.endsWith(".jsx")).sort();
  // `NIGHT ${x} / 3`, `DAY ${x} of 3`, `${x} / 3 nights` and friends.
  const PATTERNS = [
    /(?:NIGHT|DAY)\s+\$\{[^}]+\}\s*(?:\/|of)\s*\d+/gi,
    /\$\{[^}]+\}\s*(?:\/|of)\s*\d+\s*(?:nights?|days?)\b/gi,
  ];
  let dbad = 0;
  for (const f of SRC) {
    const lines = readFileSync(join(ROOT, f), "utf8").split("\n");
    lines.forEach((ln, i) => {
      if (ln.trim().startsWith("//")) return;          // the comment above cites the old form
      for (const re of PATTERNS) {
        re.lastIndex = 0;
        const m = re.exec(ln);
        if (m) { console.log(`  ✗ ${f}:${i + 1}  ${m[0].trim()}`); dbad++; return; }
      }
    });
  }
  if (dbad) fail(`${dbad} hardcoded day/night denominator(s) — read the count off DAYS.length`);
  console.log(`  ✓ ${SRC.length} source file(s) — every day/night counter reads its total from the active config`);
}

let REG_LIVE = [];
// Live festivals that carry a stage LAYOUT GRID but too few anchors to enter
// REG_LIVE. Hoisted for the same reason REG_LIVE is: the registry lives in a
// vm sandbox further down. See the distance-readout gate for why they get
// their own row instead of being skipped in silence.
let REG_GRID_NO_AFFINE = [];
// Mirrors MAP_REGISTRATION_TOL_M in map.jsx. The readout gate asserts the
// two are equal, so this copy cannot silently drift from the shipped one.
const REGISTRATION_TOL_M = 25;

// ── 1b. GPS anchor self-consistency ────────────────────────────────────────
// Every festival's gpsAnchors comment says the non-calibration anchors were
// "derived from the SVG layout via the <trio> affine". Nothing enforced it, and
// on 2026-08-27 none of the five festivals actually satisfied it — EDC LV's
// `neon` was 6.9 grid units out, ACL's `tmobile` 28.7, EDC Orlando's `stereo`
// 56.9 (over half the footprint). These anchors are not decorative: map.jsx
// projects the official map and every dot through them, and photo-tag.jsx
// attributes a photo to a stage by matching EXIF GPS against them, so a bad
// anchor silently mis-tags real memories.
//
// The check: push each stored anchor back through the affine its own first
// three anchors define. It must land on that stage's x/y. Fatal for a LIVE
// festival; a warning for a gated one, whose whole data layer is provisional
// by construction and is re-measured at its flip session.
//
// ⚠️ WHAT THIS CHECK CANNOT SEE (learned 2026-08-28). It is CIRCULAR whenever
// the anchors were themselves "derived from the SVG layout via the affine",
// which is exactly how most of them were produced: derive anchors from x/y
// through an affine, then assert they satisfy that affine, and it passes by
// construction no matter how wrong the anchors are in the real world. EDC LV
// passed this gate for months while three of its nine anchors — including
// Kinetic Field, the main stage — sat OUTSIDE the speedway oval, on the track
// banking. Deriving world coordinates from poster coordinates is the bug, not
// the fix: a stylised poster is not a projection of the ground.
//
// So two things now happen. Festivals whose config says
// `mapArtIsGeoregistered: false` skip the affine check entirely (its premise
// is false for them), and EVERY festival that declares `venue.footprint` gets
// checked against REAL geometry instead: each anchor must fall inside the
// venue polygon. That one is not circular — it can only be satisfied by
// anchors that are actually in the right place.
{
  const vm = await import("node:vm");
  const ctx = { window:{}, console, Date, Math, JSON, Object, Array, String, Number,
    isNaN, parseInt, parseFloat, fetch:()=>{},
    localStorage:{ getItem:()=>null, setItem:()=>{}, removeItem:()=>{} } };
  vm.createContext(ctx);
  // The wave-1 festivals register themselves on window.PLURSKY_FESTIVALS, so
  // their modules have to run before data.jsx here exactly as they do in the
  // browser — otherwise the gate silently checks four festivals instead of nine.
  // Read the DIRECTORY, not `git ls-files`. This used to be the git index, and
  // that quietly excluded any module that was not yet staged — so a brand-new
  // festival was invisible to EVERY gate below on the run that mattered most,
  // the first one. Caught on hard-summer-2026 (2026-09-06): the footprint gate
  // reported 13 festivals and looked clean while the 14th, the one just
  // written, had never been loaded. Same silent-drop class as iii-points.
  // gen-festival-pages.mjs already reads the directory; these two must agree
  // on what "the festival modules" means, so they now do it the same way.
  const modFiles = FESTIVAL_MODULES;
  const mods = modFiles.map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
  vm.runInContext(mods + "\n" + readFileSync(join(ROOT,"data.jsx"),"utf8") +
    "\n;__o={REG:FESTIVALS_REGISTRY,DS:_DATA_SETS};", ctx);
  const { REG, DS } = ctx.__o;
  const TOL = 1.5;   // grid units on the 0-100 layout; ~20 m at EDC's scale

  // ── Anchor provenance gate ───────────────────────────────────────────────
  // Every gpsAnchor must say where its lat/lng came from, and an anchor that
  // was computed FROM the map grid may never be used to validate that grid.
  //
  // This exists because the affine gate below cannot tell the difference on
  // its own. Tito's anchor was exactly mapToGps(80,31) — back-computed from a
  // stage position that was itself ~132 m wrong — and because a derived value
  // reproduces its own affine perfectly, the gate reported ACL at "worst 0.06"
  // and stayed green. The check was real; its input was circular.
  //
  // Inference cannot recover this after the fact: the same Tito's anchor,
  // re-derived and rounded to six decimal places, now shows a residual of
  // 0.004 — indistinguishable from a genuine measurement at that scale. So
  // provenance has to be DECLARED at the point the number is written down,
  // which is the only moment anyone actually knows it.
  const VALID_SRC = new Set(["osm", "crowd", "poster", "prov", "derived"]);
  const EVIDENCE_SRC = new Set(["osm", "crowd"]);
  {
    console.log("▸ Anchor provenance gate — every anchor declares its source");
    let undeclared = 0, badSrc = 0, inBasis = 0, total = 0;
    const tally = {};
    for (const f of REG) {
      const cfg = f.config, an = cfg.gpsAnchors || [];
      an.forEach((a, i) => {
        total++;
        tally[a.src || "(none)"] = (tally[a.src || "(none)"] || 0) + 1;
        if (a.src == null) {
          console.log(`  ✗  ${cfg.id} / ${a.stageId} — no src`);
          undeclared++;
        } else if (!VALID_SRC.has(a.src)) {
          console.log(`  ✗  ${cfg.id} / ${a.stageId} — src "${a.src}" is not a known provenance`);
          badSrc++;
        }
        // A derived anchor in the leading triple would mean the affine is
        // solved from a number the affine produced. Fatal regardless of
        // whether the festival is live — a gated festival flips eventually.
        if (i < 3 && a.src === "derived" && cfg.mapArtIsGeoregistered !== false) {
          console.log(`  ✗  ${cfg.id} / ${a.stageId} — derived anchor in the calibration basis`);
          inBasis++;
        }
      });
    }
    console.log(`  ${Object.entries(tally).sort().map(([k,v]) => `${k}=${v}`).join("  ")}`);
    if (undeclared) fail(`${undeclared} gpsAnchor(s) do not declare src — see the GpsAnchor typedef in data.jsx`);
    if (badSrc) fail(`${badSrc} gpsAnchor(s) declare an unknown src`);
    if (inBasis) fail(`${inBasis} calibration-basis anchor(s) are derived — the affine would be validating itself`);
    console.log(`  ✓ ${total} anchor(s), all declared; no derived anchor in any calibration basis`);
  }

  // One date for every waiver in this file — two clocks is one clock too many.
  const TODAY = new Date().toISOString().slice(0, 10);
  console.log("▸ GPS anchor gate — anchors must satisfy their own affine");
  let hard = 0, soft = 0, checked = 0, blind = 0, unsourced = 0;
  // ── Waiver: art that provably cannot carry an affine ──────────────────
  // Different in kind from every other waiver in this file, because the
  // defect is in the ART, not the anchors. Ultra's anchors are all `osm`,
  // measured against the official 2026 site map registered through the OSM
  // street grid. The drawn SVG simply is not an affine image of Bayfront
  // Park, so pushing the real layout through it puts `main` 53 grid units
  // (~387 m) from where the art draws it. No better survey fixes that —
  // only redrawing the map does.
  //
  // Founder call 2026-09-06 (Q2): adopt the measured anchors now, redraw
  // later. The anchors are already earning their keep in photo-tag.jsx,
  // which was mis-attributing photos by up to 650 m; distance readouts stay
  // suppressed either way, because MAP_REGISTRATION_SOURCED needs a sourced
  // anchor that AGREES with the art and this festival has none.
  //
  // Closed in both directions, like the registration waivers below: an
  // uncovered failure is fatal, an expired waiver is fatal, and a waiver
  // naming a festival that now PASSES is fatal too — so this entry cannot
  // outlive the redraw it is standing in for.
  const ART_WAIVERS = {
    "ultra-miami-2026": {
      // Chosen to force the redraw into the quiet window before the 2027
      // festival roll, rather than into Ultra flip week.
      expires: "2026-12-01",
      note: "ultra-2026.svg is drawn art, not a projection; redraw it from the surveyed layout, then delete this waiver.",
    },
  };
  const artWaived = new Set();

  // Per-festival findings, so the waiver pass below can name the exact
  // condition it excuses instead of excusing a festival wholesale.
  const regFindings = [];
  for (const f of REG) {
    const cfg = f.config, stages = DS[cfg.id]?.stages || [];
    const an = cfg.gpsAnchors || [];
    if (an.length < 3 || !stages.length) continue;
    const at = (id) => stages.find(s => s.id === id);
    if (cfg.mapArtIsGeoregistered === false) {
      console.log(`  –  ${cfg.id.padEnd(22)} affine check skipped — map art is not georegistered`);
      continue;
    }
    const [a0,a1,a2] = an;
    if (!at(a0.stageId) || !at(a1.stageId) || !at(a2.stageId)) continue;
    const A={lat:a0.lat,lng:a0.lng,mx:at(a0.stageId).x,my:at(a0.stageId).y};
    const B={lat:a1.lat,lng:a1.lng,mx:at(a1.stageId).x,my:at(a1.stageId).y};
    const C={lat:a2.lat,lng:a2.lng,mx:at(a2.stageId).x,my:at(a2.stageId).y};
    const det=A.lat*(B.lng-C.lng)-A.lng*(B.lat-C.lat)+(B.lat*C.lng-C.lat*B.lng);
    if (Math.abs(det) < 1e-12) continue;
    const sol=(v1,v2,v3)=>[
      (v1*(B.lng-C.lng)-A.lng*(v2-v3)+(C.lng*v2-B.lng*v3))/det,
      (A.lat*(v2-v3)-v1*(B.lat-C.lat)+(B.lat*v3-C.lat*v2))/det,
      (A.lat*(B.lng*v3-C.lng*v2)-A.lng*(B.lat*v3-C.lat*v2)+v1*(B.lat*C.lng-C.lat*B.lng))/det];
    const X=sol(A.mx,B.mx,C.mx), Y=sol(A.my,B.my,C.my);
    // Residuals are only EVIDENCE for anchors that could have disagreed.
    //  · the leading three ARE the affine — their residual is zero by
    //    construction and always was.
    //  · a "derived" anchor was back-computed from this same affine, so it
    //    also cannot disagree. Counting it is a self-check.
    // Tito's was exactly mapToGps(80,31) — 0 m from its own prediction — and
    // this gate printed "worst 0.06" over a 132 m error until someone looked
    // at the map. The number was never wrong; it was answering a question
    // nobody should have asked.
    let worst = 0, who = "", evidence = 0;
    const notEvidence = [];
    for (let i = 0; i < an.length; i++) {
      const a = an[i], st = at(a.stageId); if (!st) continue;
      const e = Math.hypot(X[0]*a.lat+X[1]*a.lng+X[2]-st.x, Y[0]*a.lat+Y[1]*a.lng+Y[2]-st.y);
      if (i < 3) continue;                                  // is the affine
      if (!EVIDENCE_SRC.has(a.src)) { notEvidence.push(`${a.stageId}:${a.src}`); continue; }
      evidence++;
      if (e > worst) { worst = e; who = a.stageId; }
    }
    checked++;
    const bad = evidence > 0 && worst > TOL;
    const tag = !bad ? "  ok" : (f.available ? "  ✗ " : "  ! ");
    // The basis IS the registration. If none of the three came from outside
    // the app, every distance the map reports is a guess propagated with
    // great precision — which is a separate failure from having no
    // cross-check, and the more serious one.
    const basisSrc = [a0, a1, a2].map(a => a.src);
    const basisSourced = basisSrc.some(x => EVIDENCE_SRC.has(x));
    const detail = evidence
      ? `worst ${worst.toFixed(2)} (${who}) over ${evidence} independent anchor(s)`
      : notEvidence.length
        ? `no cross-check — all ${notEvidence.length} non-basis anchor(s) are ${[...new Set(notEvidence.map(x=>x.split(":")[1]))].join("/")}`
        : `no cross-check — ${an.length} anchor(s), all of them the basis`;
    console.log(`${tag} ${cfg.id.padEnd(22)} basis ${basisSrc.join("/")} · ${detail}`);
    const conds = [];
    if (!basisSourced) conds.push("unsourced");
    if (!evidence) conds.push("blind");
    if (conds.length) regFindings.push({ id: cfg.id, live: !!f.available, conds });
    if (!basisSourced && f.available) unsourced++;
    if (!evidence && f.available) blind++;
    if (bad && f.available) {
      const w = ART_WAIVERS[cfg.id];
      if (!w) hard++;
      else if (w.expires < TODAY) {
        console.log(`  ✗  ${cfg.id} — art waiver EXPIRED ${w.expires} (today ${TODAY}); redraw the map or re-date it deliberately`);
        // Counts as USED even though it is not honoured, so the staleness
        // sweep below does not then report the opposite ("no longer fails").
        artWaived.add(cfg.id);
        hard++;
      } else {
        artWaived.add(cfg.id);
        console.log(`     waived until ${w.expires} — ${w.note}`);
      }
    }
    else if (bad) soft++;
  }
  // A waiver for art that now fits is an excuse nobody is paying for.
  for (const [id, w] of Object.entries(ART_WAIVERS)) {
    if (!artWaived.has(id)) fail(`art waiver for ${id} is STALE: it no longer fails the affine check (expires ${w.expires}). Delete the entry.`);
  }
  if (!checked) console.log("  (no festival has both anchors and stages)");
  if (soft) console.log(`  ${soft} gated festival(s) inconsistent — re-derive at the flip session`);
  if (hard) fail(`${hard} LIVE festival(s) have gpsAnchors that do not satisfy their own affine`);
  console.log(`  ✓ ${checked} festival(s) checked; where independent anchors exist they agree within ${TOL} grid units`);

  // ── Registration provenance is a GATE now, not a warning ─────────────
  // Two findings used to print ⚠ and pass:
  //   · unsourced — no osm/crowd anchor anywhere in the calibration basis, so
  //     the whole grid-to-world registration is somebody reading poster art
  //   · blind     — no independent anchor outside the basis, so nothing in
  //     the data can contradict the affine even when it is wrong
  // Both are now fatal for a LIVE festival (founder call 2026-09-05). A
  // festival flipping available:true from here on gets NO waiver and has to
  // arrive with a sourced basis — which is the point: the three below are
  // grandfathered breakage, and everything after them is a choice.
  //
  // THE EXPIRY IS THE MECHANISM. The footprint waiver above has none and has
  // already outlived several sessions; a waiver without a date is a quieter
  // spelling of the warning it replaced. On its expiry date this gate goes
  // red and someone has to either do the survey or consciously re-date it,
  // which is a decision with a name on it rather than a line nobody reads.
  //
  // Same closure as the footprint waiver, in both directions: a condition no
  // waiver excuses is fatal, AND a waiver excusing a condition the festival
  // no longer has is fatal, because an excuse that outlives its defect is how
  // a repo ends up carrying apologies for bugs it already fixed.
  const REGISTRATION_WAIVERS = {
    // All three were re-surveyed at a desk on 2026-09-06 (issue #57), so the
    // `unsourced` half of each of these waivers is GONE — every basis below
    // is measured now. What survives is `blind`: a basis can be perfectly
    // sourced and still have nothing independent to check it against, and
    // that is the condition that keeps distance readouts off.
    "acl-2026": {
      excuses: ["blind"],
      expires: "2026-10-19",
      // ⚠️ The 2026-09-06 desk survey ASKED for this waiver to be deleted, on
      // the strength of a 34 m independent cross-check against `ladybird`.
      // Retracted by Instinct 2026-09-06 once the reconciliation landed:
      // `ladybird` is a 2024 stage that the 2026 lineup replaced with the
      // Snapchat Stage, so the cross-check was real geometry against a stage
      // this app does not have. `bonus` was a label borrowed from the
      // Lollapalooza module. The basis (amex/miller/tmobile) is genuinely
      // satellite-measured now; the only other anchor, `bmi`, is derived
      // through that same basis and therefore cannot disagree with it.
      //
      // Clears when the official 2026 patron map publishes and `snapchat` —
      // the one real 2026 stage still unanchored — can be measured. That is
      // an independent anchor, which is exactly what is missing.
      //
      // Still true, still worth repeating: the Weekend 2 crowd pass does NOT
      // clear this. A crowd anchor answers "where does a person STAND"; a
      // gpsAnchor answers "where did the artist DRAW it". EDC's measured
      // kinetic centroid is 438 m from its own poster pin.
      note: "basis is satellite-measured (amex/miller/tmobile) but nothing " +
            "independent checks it — bmi is derived through that same basis. " +
            "Needs the 2026 patron map to anchor snapchat",
    },
    // ultra-miami-2026 is NO LONGER HERE. Its basis is measured and it has
    // four independent osm anchors, so it has neither registration finding.
    // Its problem moved up a gate: those four anchors DISAGREE with the drawn
    // art by up to 53 grid units, which is ART_WAIVERS above, not this.
    "governors-ball-2026": {
      excuses: ["blind"],
      expires: "2026-10-19",
      // `blind` here is structural and re-sourcing cannot fix it: Governor's
      // Ball has three stages, so all three anchors ARE the basis and no
      // fourth anchor exists to disagree with them. The 2026-09-06 survey
      // measured `grove` off satellite and fitted the other two to the
      // official 2025 map, which is a real improvement — verizon moved 390 m
      // out of woods that cannot hold a main stage — but it cannot add a
      // fourth stage that does not exist.
      //
      // Two ways out: the 2026 patron map (which would also settle the
      // snapchat north/south conflict, currently 737 m wide), or a non-stage
      // landmark tie point such as the Unisphere. The latter needs a schema
      // change, since gpsAnchors are stageId-keyed.
      note: "3 anchors, all of them the basis — structurally uncheckable " +
            "until a fourth tie point exists. grove is satellite-measured; " +
            "verizon and snapchat are fitted to the official 2025 map",
    },
  };
  const regProblems = [];
  const waived = new Set();
  for (const f of regFindings) {
    if (!f.live) continue;              // gated festivals are provisional by construction
    const w = REGISTRATION_WAIVERS[f.id];
    const uncovered = f.conds.filter(c => !w || !w.excuses.includes(c));
    if (uncovered.length) {
      regProblems.push(`  ✗  ${f.id} — ${uncovered.join(", ")} with no waiver`);
      continue;
    }
    if (w.expires < TODAY) {
      regProblems.push(`  ✗  ${f.id} — waiver EXPIRED ${w.expires} (today ${TODAY}); re-survey it or re-date it deliberately`);
      continue;
    }
    waived.add(f.id);
    console.log(`  !  ${f.id.padEnd(22)} ${f.conds.join(" + ")} — WAIVED until ${w.expires}`);
    console.log(`     ${w.note}`);
  }
  // A waiver that no longer excuses anything, or names a festival with no
  // live finding at all, is stale — fatal, same as the footprint gate.
  for (const [id, w] of Object.entries(REGISTRATION_WAIVERS)) {
    const found = regFindings.find(f => f.id === id && f.live);
    if (!found) {
      regProblems.push(`  ✗  ${id} — waiver is STALE: no live registration finding at all. Delete the entry.`);
      continue;
    }
    const stale = w.excuses.filter(c => !found.conds.includes(c));
    if (stale.length) {
      regProblems.push(`  ✗  ${id} — waiver is STALE: ${stale.join(", ")} no longer applies. Drop it from excuses.`);
    }
  }
  if (regProblems.length) {
    regProblems.forEach(l => console.log(l));
    fail(`${regProblems.length} LIVE festival(s) have an unsourced or uncheckable map registration — see above`);
  }
  console.log(`  ✓ registration provenance: ${unsourced} unsourced, ${blind} blind — all ${waived.size} covered by a dated waiver`);

  // Handed to the distance-readout gate below so it checks the app against
  // the SAME provenance the anchor gate just read, not a second opinion.
  // `sourced` is BOTH halves of MAP_REGISTRATION_SOURCED, computed here
  // independently of map.jsx so the readout gate below is a real cross-check
  // and not the app agreeing with itself:
  //
  //   provenance    — the basis rests on a measurement, and
  //   corroboration — at least one SOURCED anchor OUTSIDE the basis lands
  //                   within MAP_REGISTRATION_TOL_M of where the affine
  //                   actually draws its stage.
  //
  // Provenance alone shipped for one PR and was not enough. _solveMapAffine()
  // fits the first three anchors exactly, so a basis can never disagree with
  // itself; art whose local scale wanders (ACL's runs 5.8-11.3 m/unit) yields
  // a transform that looks perfect at the three basis stages and puts the rest
  // in a lake. Measured 2026-09-06: all three re-surveyed festivals passed
  // provenance and would have switched their readouts back on.
  const _mToGps = (X, Y, x, y) => {
    const det = X[0]*Y[1] - X[1]*Y[0];
    if (Math.abs(det) < 1e-12) return null;
    return { lat: ( Y[1]*(x-X[2]) - X[1]*(y-Y[2])) / det,
             lng: (-Y[0]*(x-X[2]) + X[0]*(y-Y[2])) / det };
  };
  const _hav = (la1, lo1, la2, lo2) => {
    const R = 6371000, r = Math.PI/180;
    const h = Math.sin((la2-la1)*r/2)**2 +
              Math.cos(la1*r)*Math.cos(la2*r)*Math.sin((lo2-lo1)*r/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  };
  REG_GRID_NO_AFFINE = REG
    .filter(f => f.available && (f.config.gpsAnchors || []).length < 3 &&
                 ((DS[f.config.id] || {}).stages || []).some(st => typeof st.x === "number"))
    .map(f => ({ id: f.config.id, anchors: (f.config.gpsAnchors || []).length }));
  REG_LIVE = REG.filter(f => f.available && (f.config.gpsAnchors || []).length >= 3)
    .map(f => {
      const an = f.config.gpsAnchors, stages = (DS[f.config.id] || {}).stages || [];
      const provenance = an.slice(0, 3).some(a => EVIDENCE_SRC.has(a.src));
      const st = id => stages.find(x => x.id === id);
      const [a0, a1, a2] = an;
      let corroborated = false;
      if (provenance && st(a0.stageId) && st(a1.stageId) && st(a2.stageId)) {
        const A = { lat: a0.lat, lng: a0.lng, mx: st(a0.stageId).x, my: st(a0.stageId).y };
        const B = { lat: a1.lat, lng: a1.lng, mx: st(a1.stageId).x, my: st(a1.stageId).y };
        const C = { lat: a2.lat, lng: a2.lng, mx: st(a2.stageId).x, my: st(a2.stageId).y };
        const det = A.lat*(B.lng-C.lng) - A.lng*(B.lat-C.lat) + (B.lat*C.lng - C.lat*B.lng);
        if (Math.abs(det) > 1e-12) {
          const sol = (v1, v2, v3) => [
            (v1*(B.lng-C.lng) - A.lng*(v2-v3) + (C.lng*v2 - B.lng*v3)) / det,
            (A.lat*(v2-v3) - v1*(B.lat-C.lat) + (B.lat*v3 - C.lat*v2)) / det,
            (A.lat*(B.lng*v3-C.lng*v2) - A.lng*(B.lat*v3-C.lat*v2) + v1*(B.lat*C.lng-C.lat*B.lng)) / det];
          const X = sol(A.mx, B.mx, C.mx), Y = sol(A.my, B.my, C.my);
          corroborated = an.slice(3).some(a => {
            if (!EVIDENCE_SRC.has(a.src)) return false;
            const s = st(a.stageId); if (!s) return false;
            const g = _mToGps(X, Y, s.x, s.y); if (!g) return false;
            return _hav(a.lat, a.lng, g.lat, g.lng) <= REGISTRATION_TOL_M;
          });
        }
      }
      return { id: f.config.id, sourced: provenance && corroborated };
    });

  // ── Anchors must fall inside the real venue ──────────────────────────────
  // Not circular: `venue.footprint` is surveyed geometry (OSM), so this can
  // only pass if the anchors are genuinely in the right place. A festival
  // listed below is a KNOWN, MEASURED defect awaiting ground truth, not a
  // bypass — deleting the entry is the one-line change once it is resolved.
  //
  // A waiver names the EXACT anchors it excuses, never the festival. The
  // first version waived by festival id, which quietly meant "edc-lv may
  // have any anchors anywhere": a fourth stage drifting out of the oval, or
  // one of the six good ones going bad in a later edit, would have printed
  // the same reassuring PENDING line. A waiver that grows to cover new
  // breakage is not a waiver, it is a disabled gate. So the set is closed in
  // both directions — an unlisted anchor outside the venue is still fatal,
  // and a listed anchor that has come back INSIDE fails too, because a
  // waiver outliving its defect is how a repo ends up carrying excuses for
  // bugs it already fixed.
  //
  // Not switched to a wider `festivalBounds` polygon: no surveyed bounds for
  // the EDC build exist, so any polygon drawn big enough to contain these
  // three would be sized FROM the anchors it is meant to test — the same
  // derive-then-assert circularity that let the main stage sit on the track
  // banking for months. A gate you widen until it passes tests nothing.
  const ANCHORS_PENDING_GROUND_TRUTH = {
    "edc-lv-2026": {
      // Provisional by founder decision (2026-08-29): do NOT nudge these
      // inside the oval to satisfy the gate. kinetic and cosmic are two of
      // the three anchors the affine basis is solved from, so moving them
      // re-derives the six dependent anchors and manufactures precision
      // nobody measured. They stay put until a real geo source exists.
      stageIds: ["kinetic", "cosmic", "bionic"],
      note:
        "3 of 9 anchors sit outside the LVMS oval (kinetic 16 m, cosmic 95 m, " +
        "bionic 152 m). They were derived from poster space, which does not " +
        "register to the world; no satellite capture of a finished EDC build " +
        "exists to re-measure from. Held PROVISIONAL pending a real geo " +
        "source — see ~/Plursky-private/EDC-MAP-REGISTRATION-2026-08-28.md",
    },
  };
  const inside = (lat, lng, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  console.log("▸ Venue footprint gate — anchors must fall inside the real venue");
  let fpHard = 0, fpChecked = 0, fpWaived = 0, fpArmed = 0, fpUnbounded = 0, fpReal = 0;
  for (const f of REG) {
    const cfg = f.config, poly = cfg.venue?.footprint;
    const an = cfg.gpsAnchors || [];
    // Arming must be VISIBLE (Instinct ruling, 2026-09-06). These two states
    // used to `continue` silently, so a festival that had armed the gate but
    // never measured anything, and a festival whose anchors no polygon can
    // bound, both read exactly like a festival that passed. That is the same
    // blind-spot class as the `available === true` gap and as the residuals
    // gap before it: the audit looked clean because it was not looking.
    // Both states are REPORTED, neither FAILS — declaring one half of the
    // pair is a legitimate waypoint, it just must not masquerade as done.
    if (poly?.length && !an.length) {
      // mapMode "real" draws actual basemap tiles, so it needs no anchors by
      // design and is not "unmeasured" in any meaningful sense. Counting it
      // alongside a festival that genuinely has not been surveyed would
      // overstate the problem, which is its own kind of dishonest report.
      if (cfg.mapMode === "real") {
        fpReal++;
        console.log(`  ·  ${cfg.id.padEnd(22)} footprint declared (${poly.length} vertices) — real basemap, no anchors needed`);
      } else {
        fpArmed++;
        console.log(`  ·  ${cfg.id.padEnd(22)} footprint declared (${poly.length} vertices), 0 anchors — ARMED, unmeasured`);
        console.log(`     layout only — no registration until the flip adds anchors`);
      }
      continue;
    }
    if (!poly?.length && an.length) {
      fpUnbounded++;
      console.log(`  ·  ${cfg.id.padEnd(22)} ${an.length} anchor(s), NO footprint — UNGUARDED by this gate`);
      continue;
    }
    if (!poly?.length || !an.length) continue;
    fpChecked++;
    const out = an.filter(a => !inside(a.lat, a.lng, poly)).map(a => a.stageId);
    const waiver = ANCHORS_PENDING_GROUND_TRUTH[cfg.id];
    const excused = new Set(waiver?.stageIds || []);
    // Anchors outside the venue that NO waiver covers — the real finding.
    const unexcused = out.filter(id => !excused.has(id));
    // Anchors a waiver still excuses that are no longer outside — the waiver
    // has outlived the defect and must shrink.
    const stale = (waiver?.stageIds || []).filter(id => !out.includes(id));

    if (!out.length && !waiver) { console.log(`  ok ${cfg.id.padEnd(22)} all ${an.length} anchors inside`); continue; }

    if (waiver && !unexcused.length && !stale.length) {
      fpWaived++;
      console.log(`  !  ${cfg.id.padEnd(22)} ${out.length}/${an.length} OUTSIDE (${out.join(", ")}) — PENDING`);
      console.log(`     ${waiver.note}`);
    } else if (waiver && stale.length) {
      fpHard++;
      console.log(`  ✗  ${cfg.id.padEnd(22)} waiver is STALE — ${stale.join(", ")} now inside the venue`);
      console.log(`     Drop ${stale.map(s => `"${s}"`).join(", ")} from ANCHORS_PENDING_GROUND_TRUTH["${cfg.id}"].stageIds.`);
    } else if (waiver) {
      fpHard++;
      console.log(`  ✗  ${cfg.id.padEnd(22)} ${unexcused.length} UNWAIVED anchor(s) outside (${unexcused.join(", ")})`);
      console.log(`     The waiver covers ${[...excused].join(", ")} only. Measure these, do not extend the waiver.`);
    } else {
      // HARD regardless of `available` (Instinct ruling, 2026-09-06). This
      // branch used to warn-and-pass for a gated festival, which inverted the
      // whole point of the pre-flip lane: a basis authored weeks out surfaced
      // as a warning, and the hard failure landed in flip week when there is
      // no time to re-survey. Proven by experiment before the change — an
      // anchor 11 km outside Glen Helen on gated Nocturnal printed `— gated`
      // and verify still exited 0.
      //
      // Declaring BOTH a footprint and anchors is the opt-in: a festival with
      // no footprint yet, or no anchors yet, still `continue`s above. So this
      // cannot fail a festival that has not claimed to be georeferenced.
      fpHard++;
      const when = f.available ? "" : " (gated — fix before the flip, not during)";
      console.log(`  ✗  ${cfg.id.padEnd(22)} ${out.length}/${an.length} OUTSIDE (${out.join(", ")})${when}`);
    }
  }
  if (!fpChecked && !fpArmed && !fpUnbounded && !fpReal) console.log("  (no festival declares venue.footprint yet)");
  if (fpHard) fail(`${fpHard} festival(s) failed the venue footprint gate — see above`);
  if (fpWaived) console.log(`  ${fpWaived} festival(s) waived pending ground truth — see notes above`);
  if (fpReal) console.log(`  ${fpReal} festival(s) on a real basemap — anchors not applicable`);
  if (fpArmed) console.log(`  ${fpArmed} festival(s) ARMED but unmeasured — the gate cannot vouch for them`);
  if (fpUnbounded) console.log(`  ${fpUnbounded} festival(s) carry anchors no footprint bounds — this gate is silent on them`);
  console.log(`  ✓ ${fpChecked} festival(s) actually checked against a real venue polygon`);

  // ── Layout-only gate ─────────────────────────────────────────────────────
  // Instinct ruling, 2026-09-06: layout-only is the DEFAULT posture for a
  // gated festival. No new poster-class anchors pre-flip — while provenance
  // stays FAIL the readouts are withheld either way, so they buy nothing and
  // cost a basis that later has to be argued with. Lost Lands is the case
  // that earned this: seven `prov` anchors that failed three independent
  // checks and had to be deleted, not adjusted.
  //
  // Recorded as a gate rather than a comment because a comment is exactly
  // what the next flip session will not read. EDC Orlando is grandfathered:
  // its five poster anchors are already authored and internally consistent
  // (3 m / 7 m off their own affine), so they stand as the calibration set
  // for whenever a real osm/crowd source lands. That is the last batch.
  const LAYOUT_ONLY_GRANDFATHERED = new Set(["edc-orlando-2026"]);
  const LO_EVIDENCE = EVIDENCE_SRC;
  console.log("▸ Layout-only gate — no new poster-class anchors on a gated festival");
  let loHard = 0, loOk = 0;
  for (const f of REG) {
    if (f.available === true) continue;              // live festivals are out of scope
    const cfg = f.config, an = cfg.gpsAnchors || [];
    if (!an.length) { loOk++; continue; }            // layout only — the default, silently fine
    const weak = an.filter(a => !LO_EVIDENCE.has(a.src)).map(a => `${a.stageId}(${a.src})`);
    if (!weak.length) {
      loOk++;
      console.log(`  ok ${cfg.id.padEnd(22)} ${an.length} anchor(s), all evidence-class`);
    } else if (LAYOUT_ONLY_GRANDFATHERED.has(cfg.id)) {
      loOk++;
      console.log(`  ok ${cfg.id.padEnd(22)} ${weak.length} poster-class anchor(s) — GRANDFATHERED calibration set`);
    } else {
      loHard++;
      console.log(`  ✗  ${cfg.id.padEnd(22)} ${weak.length} new poster-class anchor(s): ${weak.join(", ")}`);
      console.log(`     Gated festivals are layout-only. Delete these, or land an osm/crowd source first.`);
    }
  }
  if (loHard) fail(`${loHard} gated festival(s) carry poster-class anchors — see above`);
  console.log(`  ✓ ${loOk} gated festival(s) hold the layout-only default`);

  // ── Crowd-anchor gate ────────────────────────────────────────────────────
  // crowdAnchors are MEASURED positions, so unlike gpsAnchors there is no
  // waiver here and none should ever be added: a crowd centroid that falls
  // outside the venue is not "pending ground truth", it is wrong.
  //
  // Honest about what this can and cannot prove. n >= 3, spread < 100 m, and
  // in-venue are CHECKED. The third shipping condition — exactly one
  // saved/attended set live in the window — is NOT checkable here: it depends
  // on the replay's schedule window, and the neon/quantum blend rejected this
  // round (n=4, tight spread) would pass a pure n/spread test. So it is
  // carried as an explicit attestation, `soleSetInWindow: true`, and the gate
  // refuses any anchor that omits it. That does not verify the claim — it
  // forces someone to make it, which is what stops a future batch script from
  // dumping centroids in silently. cosmic (n=1) IS caught mechanically.
  console.log("▸ Crowd-anchor gate — measured anchors, no waivers");
  let caHard = 0, caTotal = 0, caFest = 0;
  for (const f of REG) {
    const cfg = f.config, poly = cfg.venue?.footprint;
    const ca = cfg.crowdAnchors || [];
    if (!ca.length) continue;
    caFest++;
    const stages = DS[cfg.id]?.stages || [];
    for (const a of ca) {
      caTotal++;
      const problems = [];
      if (stages.length && !stages.some(s => s.id === a.stageId)) problems.push("unknown stageId");
      if (!(typeof a.n === "number" && a.n >= 3)) problems.push(`n=${a.n} (need >= 3)`);
      if (!(typeof a.spreadM === "number" && a.spreadM < 100)) problems.push(`spreadM=${a.spreadM} (need < 100)`);
      if (!a.measuredAt || !a.source) problems.push("missing provenance (measuredAt/source)");
      if (a.soleSetInWindow !== true) problems.push("missing soleSetInWindow attestation (blend check)");
      if (poly?.length && !inside(a.lat, a.lng, poly)) problems.push("OUTSIDE the venue footprint");
      if (problems.length) {
        caHard++;
        console.log(`  ✗  ${cfg.id}/${a.stageId} — ${problems.join("; ")}`);
      } else {
        console.log(`  ok ${cfg.id.padEnd(16)} ${String(a.stageId).padEnd(9)} n=${String(a.n).padEnd(3)} nights=${a.nights} spread=${a.spreadM}m  ${a.source}`);
      }
    }
  }
  if (!caFest) console.log("  (no festival declares crowdAnchors yet)");
  if (caHard) fail(`${caHard} crowd anchor(s) violate the shipping rule (n >= 3, spread < 100 m, in-venue, soleSetInWindow attested)`);
  if (caTotal) console.log(`  ✓ ${caTotal} crowd anchor(s) across ${caFest} festival(s) — all measured, all in-venue`);
}

// ── 1c. Distance-readout suppression ───────────────────────────────────────
// The gate above establishes WHICH festivals have an unsourced registration.
// This one establishes that the app then declines to quote distances on them,
// which is the half a user actually experiences. Without it the two can drift:
// someone re-sources a basis, or adds a fourth walk readout that formats
// lo/hi itself, and the data says one thing while the screen says another.
//
// It runs the REAL compiled build/map.js against the REAL festival config in
// a vm, and checks both directions per festival — suppressed for a live
// position on an unsourced grid, and NOT suppressed anywhere else, because a
// gate that only ever asserts absence would pass just as happily if the whole
// map went blank.
{
  const vm = await import("node:vm");
  const load = (fid) => {
    const store = { active_festival_id: fid, active_festival_explicit: "1" };
    const noop = () => {};
    const ctx = {
      console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array,
      String, Number, Boolean, Set, Map, isNaN, parseInt, parseFloat, isFinite,
      setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
      fetch: () => new Promise(noop), URLSearchParams, location: { search: "" },
      localStorage: { getItem: k => (k in store ? store[k] : null),
                      setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
      navigator: { userAgent: "node", geolocation: {} },
      document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} },
                  createElement: () => ({ style: {}, setAttribute: noop }), getElementById: () => null,
                  querySelector: () => null, head: { appendChild: noop } },
      React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
      ReactDOM: { createRoot: () => ({ render: noop }) },
    };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    ctx.window.addEventListener = noop; ctx.window.removeEventListener = noop;
    ctx.window.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
    vm.createContext(ctx);
    const mods = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
      .toString().trim().split("\n").filter(Boolean)
      .map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
    vm.runInContext(mods, ctx);
    vm.runInContext(readFileSync(join(ROOT, "build/data.js"), "utf8"), ctx);
    vm.runInContext(readFileSync(join(ROOT, "build/map.js"), "utf8"), ctx);
    vm.runInContext(readFileSync(join(ROOT, "build/survey.js"), "utf8"), ctx);
    return ctx;
  };

  console.log("▸ Distance-readout gate — no metres or minutes off an unsourced grid");
  let rdHard = 0, rdChecked = 0;
  for (const f of REG_LIVE) {
    const c = load(f.id);
    if (c.MAP_REGISTRATION_TOL_M !== REGISTRATION_TOL_M) {
      fail(`map.jsx MAP_REGISTRATION_TOL_M=${c.MAP_REGISTRATION_TOL_M} but verify.mjs uses ${REGISTRATION_TOL_M} — one number, two copies, already drifted`);
    }
    const sourced = c.MAP_REGISTRATION_SOURCED;
    if (sourced !== f.sourced) {
      console.log(`  ✗  ${f.id} — map.jsx says registration sourced=${sourced}, the anchor data says ${f.sourced}`);
      rdHard++; continue;
    }
    const stage = (c.STAGES || [])[1];
    if (!stage) continue;
    rdChecked++;
    const d = Math.hypot(stage.x - 50, stage.y - 50);
    const demo = { x: 50, y: 50 };
    const live = { x: 50, y: 50, live: true };
    const probes = {
      walk:   a => c.walkMinsLabel(c.computeWalkRange(a, stage, d, "22:00")) != null,
      mins:   a => c.distToMins(d, a) != null,
      away:   a => c.minsAwaySuffix(d, a) !== "",
      metres: a => c.gridDistMeters(50, 50, stage.x, stage.y, a) != null,
    };
    const bad = [];
    for (const [name, probe] of Object.entries(probes)) {
      // The demo avatar is an admitted simulation and keeps its numbers —
      // blanking those would only make the pre-festival app look broken.
      if (probe(demo) !== true) bad.push(`${name} suppressed for the DEMO avatar`);
      if (probe(live) !== sourced) {
        bad.push(sourced ? `${name} suppressed on a SOURCED map` : `${name} still quoted from a LIVE position`);
      }
    }
    if (bad.length) { rdHard++; console.log(`  ✗  ${f.id} — ${bad.join("; ")}`); }
    else console.log(`  ok ${f.id.padEnd(22)} ${sourced ? "sourced — readouts quoted" : "unsourced — 4/4 readouts withheld from a live position"}`);
  }
  if (rdHard) fail(`${rdHard} festival(s) quote distances they cannot support — see above`);
  // A LIVE festival with a stage grid but FEWER THAN 3 ANCHORS never enters
  // REG_LIVE, so the loop above skips it in silence. hard-summer-2026 is the
  // first such config: available, seven registered stage x/y read off the
  // official patron map, zero gpsAnchors. It is structurally safe — with no
  // affine there is nothing for the app to quote a distance FROM — but
  // "structurally safe" and "not looked at" print identically when the row
  // is simply absent, which is the blind spot the arming rulings closed on
  // the footprint gate. So say it out loud.
  // "Structurally safe" is a claim, so PROVE it rather than print it: run the
  // same four probes from a LIVE position and require all four to withhold.
  for (const f of REG_GRID_NO_AFFINE) {
    const c = load(f.id);
    const stage = (c.STAGES || []).find(st => typeof st.x === "number");
    if (!stage) continue;
    const d = Math.hypot(stage.x - 50, stage.y - 50);
    const live = { x: 50, y: 50, live: true };
    const quoted = [];
    if (c.walkMinsLabel(c.computeWalkRange(live, stage, d, "22:00")) != null) quoted.push("walk");
    if (c.distToMins(d, live) != null)                                        quoted.push("mins");
    if (c.minsAwaySuffix(d, live) !== "")                                     quoted.push("away");
    if (c.gridDistMeters(50, 50, stage.x, stage.y, live) != null)             quoted.push("metres");
    if (quoted.length) {
      rdHard++;
      console.log(`  ✗  ${f.id.padEnd(22)} ${f.anchors} anchor(s) and NO affine, yet quotes ${quoted.join(", ")} from a live position`);
    } else {
      console.log(`  ok ${f.id.padEnd(22)} grid, ${f.anchors} anchor(s), no affine — 4/4 readouts withheld`);
    }
  }
  if (rdHard) fail(`${rdHard} festival(s) quote distances they cannot support — see above`);
  console.log(`  ✓ ${rdChecked} live festival(s): every grid readout matches its registration provenance`);
  if (REG_GRID_NO_AFFINE.length)
    console.log(`  ✓ ${REG_GRID_NO_AFFINE.length} more carry a layout grid with no affine — checked, not assumed`);

  // ── The capture path must emit what the crowd-anchor gate accepts ──────
  // survey.jsx exists to produce crowdAnchors rows, and the gate above
  // decides whether a crowdAnchors row may ship. Those two rules living in
  // different files is how a founder gets to a festival, records three
  // stages, and finds out on the way home that the export is rejected. So
  // the tool's output is round-tripped through the gate's own conditions
  // here, on synthetic dwells, every run.
  console.log("▸ Survey export gate — captured anchors must satisfy the shipping rule");
  {
    const c = load(REG_LIVE[0] ? REG_LIVE[0].id : "acl-2026");
    const fid = c.FESTIVAL_CONFIG.id;
    const st = (c.STAGES || [])[0];
    const dwell = (stageId, n, spread, day) => ({
      festivalId: fid, stageId, soleSet: true, startedAt: Date.UTC(2026, 9, day, 20),
      samples: Array.from({ length: n }, (_, i) => ({
        lat: 30.2669 + Math.sin(i * 2.4) * spread, lng: -97.7729 + Math.cos(i * 2.4) * spread,
        acc: 8, ts: i,
      })),
    });
    const seed = (rows) => c.localStorage.setItem("plursky_survey_v1", JSON.stringify(rows));
    const bad = [];
    // Good dwell ships; the three ways of being unshippable do not.
    seed([dwell(st.id, 9, 0.00025, 9)]);
    const roll = c.surveyRollup(fid);
    if (!roll[0] || !roll[0].ok) bad.push("a clean 9-fix dwell was not shippable");
    for (const [why, rows] of [
      ["n<3",              [dwell(st.id, 2, 0.00025, 9)]],
      ["spread>=100m",     [dwell(st.id, 6, 0.0020, 9)]],
      ["unattested",       [{ ...dwell(st.id, 6, 0.00025, 9), soleSet: null }]],
    ]) {
      seed(rows);
      const r = c.surveyRollup(fid)[0];
      if (r && r.ok) bad.push(`${why} was allowed to ship`);
      if (c.surveyExportBlock(fid) !== "") bad.push(`${why} still produced an export block`);
    }
    // And the shipping row has to satisfy the crowd-anchor gate field for field.
    seed([dwell(st.id, 9, 0.00025, 9), dwell(st.id, 5, 0.00025, 10)]);
    const block = c.surveyExportBlock(fid);
    let rows = [];
    try { rows = vm.runInContext(`(function(){ return ({ ${block.replace(/^\s*\/\/.*$/gm, "")} }).crowdAnchors; })()`, c); }
    catch (e) { bad.push(`export block does not parse: ${e.message}`); }
    for (const a of rows) {
      if (!(c.STAGES || []).some(x => x.id === a.stageId)) bad.push("export names an unknown stageId");
      if (!(typeof a.n === "number" && a.n >= 3)) bad.push("export n < 3");
      if (!(typeof a.spreadM === "number" && a.spreadM < 100)) bad.push("export spreadM >= 100");
      if (!a.measuredAt || !a.source) bad.push("export missing measuredAt/source");
      if (a.soleSetInWindow !== true) bad.push("export missing the soleSetInWindow attestation");
      if (!(typeof a.lat === "number" && typeof a.lng === "number")) bad.push("export lat/lng not numeric");
    }
    if (rows.length && rows[0].nights !== 2) bad.push(`two dwells on different days gave nights=${rows[0].nights}`);
    if (bad.length) { bad.forEach(b => console.log(`  ✗  ${b}`)); fail(`survey export violates the crowd-anchor shipping rule`); }
    console.log(`  ✓ export round-trips the gate; n<3, spread>=100 m and an unanswered attestation each refuse to ship`);
  }
}

if (process.argv.includes("--parse-only")) process.exit(0);

// ── 2. Mount probe ─────────────────────────────────────────────────────────
// Loads the REAL index.html in an iframe rather than reconstructing the script
// order. An earlier version of this check derived load order by grepping
// index.html for "*.jsx" — which also matched filenames written in PROSE
// COMMENTS, hoisting app.jsx ahead of data.jsx and reporting a false root=0 on
// perfectly healthy code. Loading the real document can't get the order wrong,
// because it isn't guessing at it.
const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser", "/usr/bin/chromium",
].find(existsSync);
if (!CHROME) fail("no Chrome/Chromium found — run with --parse-only to skip the mount probe");

const TYPES = { html:"text/html", js:"text/javascript", jsx:"text/babel",
                css:"text/css", json:"application/json", svg:"image/svg+xml",
                webp:"image/webp", png:"image/png", jpg:"image/jpeg", xml:"application/xml" };

const server = createServer({ keepAlive: false }, (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const p = join(ROOT, rel.endsWith("/") ? rel + "index.html" : rel);
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); return res.end("nope"); }
  // Connection: close matters. With keep-alive, Chrome treats the sockets as
  // pending network work and --virtual-time-budget never advances, so
  // --dump-dom hangs until the process timeout instead of settling.
  let body = readFileSync(p);
  // Errors inside an iframe do NOT propagate to the parent, so the probe page
  // cannot see a boot failure on its own — an earlier version of this gate
  // passed a file containing a bare `throw`. Inject a capture prelude ahead of
  // everything else when serving the document. index.html itself is untouched
  // on disk and served verbatim apart from this one prepended <script>.
  if (p.endsWith("index.html")) {
    body = Buffer.from(
      `<script>window.__probeErrs=[];` +
      `addEventListener("error",e=>__probeErrs.push((e.message||"error")+" @"+((e.filename||"").split("/").pop()||"?")+":"+e.lineno));` +
      `addEventListener("unhandledrejection",e=>__probeErrs.push("unhandled rejection: "+e.reason));` +
      `</script>` + body.toString("utf8"), "utf8");
  }
  res.writeHead(200, {
    "content-type": TYPES[p.split(".").pop()] || "application/octet-stream",
    "connection": "close", "cache-control": "no-store",
  });
  res.end(body);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

// Must live at the server root so the iframe is same-origin and its globals
// are reachable.
// Floor for a healthy render. Used BOTH as the probe's settle condition
// and as the final assertion, so a slow machine waits instead of failing.
const MIN_RENDERED_CHARS = 5000;
const PROBE = join(ROOT, "__verify_probe.html");
// One top-level symbol per source file. A file whose evaluation dies still
// leaves the others intact and the app can still mount, so `root > 0` alone
// does NOT prove every script ran — this is what catches a dead file.
const FNS = [
  "IOSStatusBar",        // ios-frame.jsx
  "getActiveFestivalId", // data.jsx
  "_randNonce",          // supabase.jsx
  "Screen",              // chrome.jsx
  "festivalNightDate",   // home.jsx
  "buildSmartReplies",   // map.jsx
  "isLegendary",         // lineup.jsx
  "_slDate",             // artist.jsx
  "_parseDateString",    // photo-tag.jsx
  "_loadMusicKit",       // spotify-api.jsx
  "_buildVideoTimeline", // recap-engine.jsx
  "PlusGate",            // spotify.jsx
  "_purchasePlus", "_isPlusSub",
];
writeFileSync(PROBE, `<!doctype html><meta charset="utf-8">
<iframe id="f" src="/" style="width:420px;height:900px;border:0"></iframe>
<script>
window.__e=[];addEventListener("error",e=>__e.push(e.message));
// POLL, don't sleep. This used to read the iframe once at a fixed 9s and
// report whatever it found. That is a race, not a measurement: on a cold or
// loaded machine Babel had not finished compiling the script chain yet, so
// the gate failed RED with root=0 on a perfectly healthy tree. Sample every
// 250ms and stop at the first fully-mounted reading; only the DEADLINE is a
// failure, and a healthy app now also finishes sooner than 9s.
var FNS=${JSON.stringify(FNS)};
var DEADLINE=11500, t0=Date.now();
function read(){
  try{
    var w=document.getElementById("f").contentWindow, r=w.document.getElementById("root");
    return {root:r?r.childElementCount:-1, chars:r?r.innerHTML.length:0,
            fns:FNS.map(function(f){return f+"="+typeof w[f];}),
            // ⚠ The whole multi-festival switch rides on this. data.jsx ends
            // with Object.assign(window,{FESTIVAL_CONFIG:<active>,…}) and every
            // later file reads those by BARE NAME — which only reaches the
            // window property if top-level declarations were lowered to var.
            // Ship const and the bare names hit the shadowing EDC base
            // declarations instead: app boots, mounts, passes every other
            // check, and quietly serves EDC's config at ACL. Measured in v253.
            winProps:["FESTIVAL_START_MS","FESTIVAL_CONFIG","ARTISTS","STAGES"]
              .map(function(k){return k+"="+typeof w[k];}),
            activeId:(function(){try{return w.FESTIVAL_CONFIG&&w.FESTIVAL_CONFIG.id;}catch(e){return "?";}})(),
            preCd:(function(){try{return w.preEventCountdown?JSON.stringify(w.preEventCountdown([])):"nofn";}catch(e){return "threw";}})(),
            // Read the ACTIVE config's own start so the countdown can be
            // checked against it rather than against an assumption that
            // every shipped festival is still in the future. See below.
            startMs:(function(){try{return w.FESTIVAL_START_MS||null;}catch(e){return null;}})(),
            nowMs:Date.now(),
            errs:(w.__probeErrs||[]).concat(window.__e), waitedMs:Date.now()-t0};
  }catch(err){ return {root:-1,chars:0,fns:[],winProps:[],activeId:"?",preCd:"?",startMs:null,nowMs:0,errs:["probe: "+err.message],waitedMs:Date.now()-t0}; }
}
function emit(o){
  var p=document.createElement("pre"); p.id="R"; p.textContent=JSON.stringify(o);
  document.body.appendChild(p);
}
var lastChars=-1, stable=0;
(function tick(){
  var o=read();
  // index.html ships ~2,066 chars of SEO fallback markup INSIDE #root, and it
  // is perfectly stable until React commits over it. So root>0 plus "three
  // identical samples" was satisfiable by the pre-hydration page: the gate
  // sampled the fallback, called it settled, and then failed itself on the
  // 5,000-char floor below — red on a tree whose app mounts fine. The floor
  // has to gate the WAIT, not just the verdict.
  var mounted=o.root>0 && o.chars>=${MIN_RENDERED_CHARS} &&
              o.fns.every(function(f){return f.slice(-9)==="=function";});
  // "Mounted" is not "rendered": #root gains its first child while the tree
  // below is still filling in, and stopping there dropped the rendered-chars
  // reading from ~19k to ~1.4k — a gate that no longer proves much. So also
  // wait for the DOM to stop growing: three identical size samples in a row.
  stable = (o.chars===lastChars) ? stable+1 : 0;
  lastChars=o.chars;
  if((mounted&&stable>=2)||Date.now()-t0>=DEADLINE) return emit(o);
  setTimeout(tick,250);
})();
</script>`);

console.log("▸ Mount probe — real index.html, headless Chrome");
// spawn, NOT execFileSync. The static server above runs in THIS process, so a
// synchronous child blocks the event loop and the server can never answer
// Chrome — every request hangs, virtual time never advances, and --dump-dom
// waits out its timeout. It looks exactly like a broken app.
const dom = await new Promise((resolve) => {
  const child = spawn(CHROME, ["--headless=new","--disable-gpu","--no-sandbox",
    "--virtual-time-budget=14000","--dump-dom",`http://127.0.0.1:${PORT}/__verify_probe.html`],
    { stdio: ["ignore","pipe","ignore"] });
  let out = "";
  const kill = setTimeout(() => child.kill("SIGKILL"), 90000);
  child.stdout.on("data", d => { out += d; });
  child.on("close", () => { clearTimeout(kill); resolve(out); });
  child.on("error", () => { clearTimeout(kill); resolve(""); });
});
try { unlinkSync(PROBE); } catch {}
server.close();

const m = dom.match(/<pre id="R">([\s\S]*?)<\/pre>/);
if (!m) fail("probe produced no result — Chrome may have died or the page never settled");
const r = JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"));

console.log(`  root children : ${r.root}`);
console.log(`  rendered chars: ${r.chars}`);
if (r.waitedMs != null) console.log(`  settled after : ${r.waitedMs} ms`);
const okFns = r.fns.filter(f => f.endsWith("=function"));
console.log(`  globals       : ${okFns.length}/${r.fns.length} present`);
for (const f of r.fns) if (!f.endsWith("=function")) console.log(`      ✗ ${f}`);
if (r.errs.length) console.log(`  console errors: ${r.errs.join(" / ")}`);

if (r.root < 1) fail(`#root has ${r.root} children — the app did not mount`);
// `root >= 1` does NOT mean the app rendered: RootErrorBoundary also produces
// exactly one child, and so does a render caught mid-flight. This number was
// printed but never asserted, so both failure modes read as a pass. Observed
// 2026-08-29: a probe that settled slowly under load reported 2,066 chars
// against a healthy 19,376 and the gate still went green.
// A trip here is either a real regression or a slow-machine capture — re-run
// once to tell them apart; a regression reproduces, a slow capture does not.
if (r.chars < MIN_RENDERED_CHARS)
  fail(`#root rendered only ${r.chars} chars (floor ${MIN_RENDERED_CHARS}) — error boundary or a partial render, not a healthy mount`);
const missing = r.fns.filter(f => !f.endsWith("=function"));
if (missing.length) fail(`not a function: ${missing.join(", ")}`);

// ── The window-property contract (v253) ───────────────────────────────────
// Bare cross-file names must reach the window properties data.jsx assigns,
// not shadowing top-level declarations. If the compile stops lowering
// const→var this is the ONLY check that notices: everything above still
// passes while the app serves the wrong festival's data.
const badProps = (r.winProps || []).filter(p => p.endsWith("=undefined"));
console.log(`  window props  : ${(r.winProps || []).length - badProps.length}/${(r.winProps || []).length} reachable`);
if (badProps.length)
  fail(`top-level declarations are not reaching window (${badProps.join(", ")}) — ` +
       `compile.mjs must lower const/let to var, see CLAUDE.md §5`);

// And the observable consequence, so the contract is checked by BEHAVIOUR and
// not only by shape: the active festival must be the resolved one, and the
// pre-event countdown must AGREE WITH THAT FESTIVAL'S OWN START TIME.
//
// ⚠ This assertion used to be "preCd must be non-null", full stop. That held
// only because every festival in the repo was still in the future. ARC 2026
// (Sep 4–7) is the first one that is LIVE while the suite runs, and
// preEventCountdown correctly returns null once now >= FESTIVAL_START_MS —
// so the old form failed a green tree and blamed bare-name resolution for it.
// Checking it in BOTH directions is also the stronger test: a stale config
// would show a countdown when the active festival has already started, and
// the absence of one when it has not. Either way the mismatch is the signal,
// never the null on its own.
console.log(`  active festival: ${r.activeId}`);
if (!r.activeId || r.activeId === "?") fail("no active festival resolved");
if (r.preCd === "threw") fail("preEventCountdown threw — bare-name resolution is reading a stale config");
if (r.preCd === "nofn")  fail("preEventCountdown is not reachable by bare name");
{
  const started = r.startMs != null && r.nowMs >= r.startMs;
  const counting = r.preCd !== "null";
  const when = r.startMs == null ? "unknown start" : new Date(r.startMs).toISOString().slice(0, 16) + "Z";
  if (started && counting)
    fail(`${r.activeId} started ${when} yet preEventCountdown still counts down — stale config`);
  if (!started && !counting)
    fail(`${r.activeId} starts ${when}, still in the future, yet preEventCountdown returned null — stale config`);
  console.log(`  countdown     : ${started ? `withheld — ${r.activeId} is live/past (started ${when})`
                                            : `counting to ${when}`} — agrees with the active config`);
}

if (r.errs.length) fail(`${r.errs.length} console error(s) during boot`);

console.log("\n✓ verify gate passed");

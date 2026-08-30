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

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { transformAsync } from "@babel/core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
const fdata = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean);
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
  const mods = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
    .toString().trim().split("\n").filter(Boolean)
    .map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
  vm.runInContext(mods + "\n" + readFileSync(join(ROOT,"data.jsx"),"utf8") +
    "\n;__o={REG:FESTIVALS_REGISTRY,DS:_DATA_SETS};", ctx);
  const { REG, DS } = ctx.__o;
  const TOL = 1.5;   // grid units on the 0-100 layout; ~20 m at EDC's scale
  console.log("▸ GPS anchor gate — anchors must satisfy their own affine");
  let hard = 0, soft = 0, checked = 0;
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
    let worst = 0, who = "";
    for (const a of an) {
      const st = at(a.stageId); if (!st) continue;
      const e = Math.hypot(X[0]*a.lat+X[1]*a.lng+X[2]-st.x, Y[0]*a.lat+Y[1]*a.lng+Y[2]-st.y);
      if (e > worst) { worst = e; who = a.stageId; }
    }
    checked++;
    const bad = worst > TOL;
    const tag = !bad ? "  ok" : (f.available ? "  ✗ " : "  ! ");
    console.log(`${tag} ${cfg.id.padEnd(22)} worst ${worst.toFixed(2)} (${who})`);
    if (bad && f.available) hard++;
    else if (bad) soft++;
  }
  if (!checked) console.log("  (no festival has both anchors and stages)");
  if (soft) console.log(`  ${soft} gated festival(s) inconsistent — re-derive at the flip session`);
  if (hard) fail(`${hard} LIVE festival(s) have gpsAnchors that do not satisfy their own affine`);
  console.log(`  ✓ ${checked} festival(s) checked, live ones consistent within ${TOL} grid units`);

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
  let fpHard = 0, fpChecked = 0, fpWaived = 0;
  for (const f of REG) {
    const cfg = f.config, poly = cfg.venue?.footprint;
    const an = cfg.gpsAnchors || [];
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
    } else if (f.available) {
      fpHard++;
      console.log(`  ✗  ${cfg.id.padEnd(22)} ${out.length}/${an.length} OUTSIDE (${out.join(", ")})`);
    } else {
      console.log(`  !  ${cfg.id.padEnd(22)} ${out.length}/${an.length} outside (${out.join(", ")}) — gated`);
    }
  }
  if (!fpChecked) console.log("  (no festival declares venue.footprint yet)");
  if (fpHard) fail(`${fpHard} festival(s) failed the venue footprint gate — see above`);
  if (fpWaived) console.log(`  ${fpWaived} festival(s) waived pending ground truth — see notes above`);

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
            errs:(w.__probeErrs||[]).concat(window.__e), waitedMs:Date.now()-t0};
  }catch(err){ return {root:-1,chars:0,fns:[],errs:["probe: "+err.message],waitedMs:Date.now()-t0}; }
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
if (r.errs.length) fail(`${r.errs.length} console error(s) during boot`);

console.log("\n✓ verify gate passed");

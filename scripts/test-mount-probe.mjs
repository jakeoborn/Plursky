#!/usr/bin/env node
// Mount probe — boots the REAL index.html in headless Chrome and asserts the
// app mounted: #root children, a rendered-size floor, one global per source
// file, the window-property contract and the active festival's countdown.
// verify.mjs runs it as one gate; it also runs on its own so a failure can be
// reproduced in seconds, and against another tree for a mutation check:
//   node scripts/test-mount-probe.mjs                # this repo
//   node scripts/test-mount-probe.mjs --root <dir>   # a copy with a planted break
// The three pinned CDN scripts in index.html (React, ReactDOM, supabase-js)
// are served from scripts/vendor/ after their sha384 check, never the live
// CDN: the gate has no network dependency. That proves the APP mounts, not
// that the production CDN is reachable — that stays a separate live check.
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { vendoredScripts } from "./lib/vendor-cdn.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > 0 ? resolve(process.argv[rootArg + 1]) : REPO;
const fail = m => { console.error(`\n✗ ${m}`); process.exit(1); };

// ── 2. Mount probe ─────────────────────────────────────────────────────────
// Loads the REAL index.html in an iframe rather than reconstructing the script
// order. An earlier version of this check derived load order by grepping
// index.html for "*.jsx" — which also matched filenames written in PROSE
// COMMENTS, hoisting app.jsx ahead of data.jsx and reporting a false root=0 on
// perfectly healthy code. Loading the real document can't get the order wrong,
// because it isn't guessing at it.
// Playwright's headless shell first: it is the browser every other browser
// gate here already runs on, it has no component updater, no extensions, no
// first-run work and no display dependency. The Google Chrome app came
// second on 2026-10-15: with --headless=new it logged the request for
// index.html and never sent it (0 requests reached the local server) on two
// full runs and six direct launches on this Mac, with and without a fresh
// --user-data-dir and with background networking off, while the shell
// mounted the same page in 1.5 s. A gate must not depend on the user's
// Chrome app being in a mood to navigate.
const headlessShell = () => {
  const roots = [join(homedir(), "Library", "Caches", "ms-playwright"), join(homedir(), ".cache", "ms-playwright")];
  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root)) {
      if (!d.startsWith("chromium_headless_shell-")) continue;
      for (const rel of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-headless-shell-mac-x64/chrome-headless-shell", "chrome-headless-shell-linux64/chrome-headless-shell"]) {
        const p = join(root, d, rel);
        if (existsSync(p)) found.push({ p, n: Number(d.split("-")[1]) || 0 });
      }
    }
  }
  return found.sort((a, b) => b.n - a.n)[0]?.p;
};
const CHROME = [
  headlessShell(),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser", "/usr/bin/chromium",
].filter(Boolean).find(existsSync);
if (!CHROME) fail("no Chrome/Chromium found — run with --parse-only to skip the mount probe");

const TYPES = { html:"text/html", js:"text/javascript", jsx:"text/babel",
                css:"text/css", json:"application/json", svg:"image/svg+xml",
                webp:"image/webp", png:"image/png", jpg:"image/jpeg", xml:"application/xml" };

// The pinned CDN scripts, served from the hash-checked vendored copies at
// /__vendor/<n>. index.html's <script src> is rewritten to that path in the
// served copy only; the integrity attribute stays, so the browser still checks
// every body against the app's own pin. Measured 2026-10-22: with no network
// for Chromium, the live-CDN probe sat at readyState "loading" on these three
// tags and failed as "#root has -1 children" on a tree that mounts fine.
let VENDOR = [];
try {
  VENDOR = vendoredScripts(join(ROOT, "index.html"), join(ROOT, "map.jsx")).filter(s => s.pin === "index.html");
} catch (e) { fail(e.message); }
{
  // An outside script left unrewritten would put the network back in the
  // gate and fail it as a non-mount, so name it here instead.
  let html = readFileSync(join(ROOT, "index.html"), "utf8");
  for (const s of VENDOR) html = html.split(`src="${s.url}"`).join("");
  const live = [...html.matchAll(/<script[^>]*\ssrc="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  if (live.length) fail(`index.html loads ${live.join(", ")} from the network with no vendored copy — pin it and run node scripts/vendor-cdn.mjs`);
}
const server = createServer({ keepAlive: false }, (req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const vend = rel.match(/^__vendor\/(\d+)$/);
  if (vend && VENDOR[+vend[1]]) {
    res.writeHead(200, { "content-type": VENDOR[+vend[1]].type, "connection": "close", "cache-control": "no-store" });
    return res.end(VENDOR[+vend[1]].body);
  }
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
    let html = body.toString("utf8");
    VENDOR.forEach((s, i) => { html = html.split(`src="${s.url}"`).join(`src="/__vendor/${i}"`); });
    body = Buffer.from(html, "utf8");
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

// The hard wall-clock cap on Chrome. It is BOUNDED, not a hang: #107 reported
// this probe "hangs indefinitely", but on 2026-09-10 six full runs on main
// settled in ~1 s (7–16 s end to end), and a probe forced never to settle
// (infinite virtual-time budget) was killed on the cap and failed red with no
// orphaned Chrome. What CAN look like a hang is the silence while waiting
// out the cap, and a failure line that did not say it was a timeout. So the
// cap is announced up front, a timeout is named as one, and
// VERIFY_PROBE_TIMEOUT_MS lets that path be exercised in seconds.
const PROBE_TIMEOUT_MS = Number(process.env.VERIFY_PROBE_TIMEOUT_MS) || 90000;
console.log(`▸ Mount probe — real index.html, headless Chrome (capped at ${PROBE_TIMEOUT_MS / 1000}s)`);
// spawn, NOT execFileSync. The static server above runs in THIS process, so a
// synchronous child blocks the event loop and the server can never answer
// Chrome — every request hangs, virtual time never advances, and --dump-dom
// waits out its timeout. It looks exactly like a broken app.
const probeT0 = Date.now();
let probeTimedOut = false;
const dom = await new Promise((resolve) => {
  const child = spawn(CHROME, ["--headless=new","--disable-gpu","--no-sandbox",
    "--virtual-time-budget=14000","--dump-dom",`http://127.0.0.1:${PORT}/__verify_probe.html`],
    { stdio: ["ignore","pipe","ignore"] });
  let out = "";
  const kill = setTimeout(() => { probeTimedOut = true; child.kill("SIGKILL"); }, PROBE_TIMEOUT_MS);
  child.stdout.on("data", d => { out += d; });
  child.on("close", () => { clearTimeout(kill); resolve(out); });
  child.on("error", () => { clearTimeout(kill); resolve(""); });
});
try { unlinkSync(PROBE); } catch {}
server.close();

const m = dom.match(/<pre id="R">([\s\S]*?)<\/pre>/);
if (!m && probeTimedOut)
  fail(`probe TIMED OUT — Chrome was killed after ${Math.round((Date.now() - probeT0) / 1000)}s ` +
       `without dumping the DOM (virtual time never drained). Re-run once; a slow machine ` +
       `does not reproduce, a real stall does`);
if (!m) fail("probe produced no result — Chrome exited without a result (crashed, or failed to launch)");
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

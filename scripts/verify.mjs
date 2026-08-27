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
setTimeout(()=>{
  let o;
  try{
    const w=document.getElementById("f").contentWindow, d=w.document, r=d.getElementById("root");
    o={root:r?r.childElementCount:-1, chars:r?r.innerHTML.length:0,
       fns:${JSON.stringify(FNS)}.map(f=>f+"="+typeof w[f]),
       errs:(w.__probeErrs||[]).concat(window.__e)};
  }catch(err){ o={root:-1,chars:0,fns:[],errs:["probe: "+err.message]}; }
  const p=document.createElement("pre"); p.id="R"; p.textContent=JSON.stringify(o);
  document.body.appendChild(p);
},9000);
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
const okFns = r.fns.filter(f => f.endsWith("=function"));
console.log(`  globals       : ${okFns.length}/${r.fns.length} present`);
for (const f of r.fns) if (!f.endsWith("=function")) console.log(`      ✗ ${f}`);
if (r.errs.length) console.log(`  console errors: ${r.errs.join(" / ")}`);

if (r.root < 1) fail(`#root has ${r.root} children — the app did not mount`);
const missing = r.fns.filter(f => !f.endsWith("=function"));
if (missing.length) fail(`not a function: ${missing.join(", ")}`);
if (r.errs.length) fail(`${r.errs.length} console error(s) during boot`);

console.log("\n✓ verify gate passed");

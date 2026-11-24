#!/usr/bin/env node
// watch-settimes.mjs — the change-watcher for festivals whose official set
// times are not out yet (SPEC-212 W2). Run daily by
// .github/workflows/settimes-watch.yml.
//
// For each WATCH whose festival still says `registry.scheduleTBA: true`, it
// asks fetch-insomniac-settimes.mjs for day 1 of the official set-times pages:
//
//   fetcher exit 3 (page 404)  → still pending      → this step stays GREEN
//   fetcher exit 0 (parsed)    → SET TIMES ARE LIVE → RED, with the import line
//   anything else              → the page exists but did not parse, or the
//                                site errored       → RED, look at it
//
// It only reports. Importing writes festival data that ships to a public
// site, so a person runs the importer (it validates every row against the
// lineup) and opens a PR. Once that PR flips scheduleTBA off, the watch goes
// quiet by itself; nothing here needs editing.
//
//   node scripts/watch-settimes.mjs              run every armed watch
//   node scripts/watch-settimes.mjs --self-test  prove each verdict on a local server
//
// Never invents a time: it reads only the official pages, and a pending
// festival keeps its "set times pending" state until the import lands.

import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FETCHER = join(HERE, "fetch-insomniac-settimes.mjs");

// One row per festival being watched. `url` is the official set-times base;
// the fetcher appends /day-N/.
export const WATCHES = [
  { id: "countdown-nye-2026", url: "https://countdownnye.com/lineup/set-times" },
];

// Still pending? Read from the festival's own data file, so the import PR is
// what disarms the watch.
export function scheduleTBA(id, root = ROOT) {
  const src = readFileSync(join(root, "data", "festivals", `${id}.js`), "utf8");
  const window = {};
  vm.runInNewContext(src, { window, console: { log() {}, warn() {}, error() {} } });
  const reg = window.PLURSKY_FESTIVALS?.[id]?.registry;
  if (!reg) throw new Error(`${id}: no registry entry in data/festivals/${id}.js`);
  return reg.scheduleTBA === true;
}

// Pure: the fetcher's exit code → the watch's verdict.
export function verdict(code) {
  if (code === 3) return "pending";
  if (code === 0) return "live";
  return "error";
}

// Async on purpose: the self-test's site is a server in this same process,
// and a blocking spawn would starve it.
function probe(w, outDir) {
  return new Promise(resolve => {
    const ch = spawn(process.execPath, [FETCHER, w.url, "--days", "1", "--out", join(outDir, `${w.id}.tsv`)], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ch.stderr.on("data", d => { err += d; });
    const t = setTimeout(() => ch.kill("SIGKILL"), 60000);
    ch.on("close", status => {
      clearTimeout(t);
      const code = status == null ? -1 : status;
      resolve({ code, verdict: verdict(code), detail: err.trim().split("\n").slice(-3).join(" | ") });
    });
  });
}

// Every watch → one line each, and how many need a person.
export async function runWatches(watches, { root = ROOT, log = console.log } = {}) {
  const out = mkdtempSync(join(tmpdir(), "settimes-watch-"));
  let red = 0;
  try {
    for (const w of watches) {
      if (!scheduleTBA(w.id, root)) { log(`  ·  ${w.id}: set times already imported (scheduleTBA off), not watched`); continue; }
      const p = await probe(w, out);
      if (p.verdict === "pending") log(`  ✓  ${w.id}: official set times not published yet (${w.url}/day-1/ is 404); "set times pending" stays`);
      else if (p.verdict === "live") {
        red++;
        log(`  ✗  ${w.id}: OFFICIAL SET TIMES ARE LIVE at ${w.url}/day-1/ — ${p.detail}`);
        log(`     Import them (validates every row against the lineup), then open a PR that turns scheduleTBA off:`);
        log(`       node scripts/fetch-insomniac-settimes.mjs ${w.url} --days <N> --out /tmp/${w.id}.tsv`);
        log(`       node scripts/import-set-times.mjs ${w.id} /tmp/${w.id}.tsv --source ${w.url} --check`);
      } else {
        red++;
        log(`  ✗  ${w.id}: the set-times page did not read (fetcher exit ${p.code}): ${p.detail}`);
      }
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
  return red;
}

// ── self-test: real fetcher, real HTTP, a local server playing the site ──
async function selfTest() {
  const block = (id, name, s, e) => `<li><a class="set-block" data-settime-id="${id}"><div><span>${name}</span><span data-timestamp-start="${s}" data-timestamp-end="${e}"></span></div></a></li>`;
  const LIVE_PAGE = `<ul class="set-list"><li class="set-list__stage"> <h2>Main Stage</h2> </li>${block(1, "Test Act", 1798761600, 1798765200)}</ul>`;
  let mode = "404";
  const srv = createServer((req, res) => {
    if (mode === "404") { res.writeHead(404); return res.end("not found"); }
    if (mode === "500") { res.writeHead(500); return res.end("oops"); }
    if (mode === "relayout") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<html><body>Set times coming soon</body></html>"); }
    res.writeHead(200, { "content-type": "text/html" }); res.end(LIVE_PAGE);
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}/lineup/set-times`;
  const fails = [];
  let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); };
  let broken = 0;   // deliberately broken fixtures run, counted, not typed
  const brokenOk = (c, m) => { broken++; ok(c, `BROKEN FIXTURE: ${m}`); };
  const quiet = [];
  const W = [{ id: "countdown-nye-2026", url }];
  try {
    ok(verdict(3) === "pending" && verdict(0) === "live" && verdict(1) === "error" && verdict(-1) === "error", "verdict table");
    ok(scheduleTBA("countdown-nye-2026") === true, "Countdown is not pending in its data file; the watch would never arm");
    mode = "404";      ok((await runWatches(W, { log: x => quiet.push(x) })) === 0, "unpublished page (404) turned red");
    // Deliberately broken fixtures: each must turn the step red.
    mode = "live";     brokenOk((await runWatches(W, { log: x => quiet.push(x) })) === 1, "published set times stayed green");
    ok(quiet.some(l => /OFFICIAL SET TIMES ARE LIVE/.test(l)), "the live line is not printed");
    mode = "500";      brokenOk((await runWatches(W, { log: x => quiet.push(x) })) === 1, "a site error read as pending");
    mode = "relayout"; brokenOk((await runWatches(W, { log: x => quiet.push(x) })) === 1, "a published page that does not parse read as pending");
    // Disarm: a festival whose data says the times are in is not probed at all.
    const fake = mkdtempSync(join(tmpdir(), "settimes-root-"));
    try {
      const src = readFileSync(join(ROOT, "data", "festivals", "countdown-nye-2026.js"), "utf8").replace("scheduleTBA: true", "scheduleTBA: false");
      const { mkdirSync, writeFileSync } = await import("node:fs");
      mkdirSync(join(fake, "data", "festivals"), { recursive: true });
      writeFileSync(join(fake, "data", "festivals", "countdown-nye-2026.js"), src);
      mode = "live";
      ok(src.includes("scheduleTBA: false") && (await runWatches(W, { root: fake, log: x => quiet.push(x) })) === 0, "an imported festival is still watched");
    } finally { rmSync(fake, { recursive: true, force: true }); }
  } finally { srv.close(); }
  for (const f of fails) console.log(`  ✗  ${f}`);
  console.log(`${fails.length ? "✗" : "✓"} set-times watch: ${checks - fails.length}/${checks} checks, ${broken - fails.filter(f => f.startsWith("BROKEN")).length}/${broken} broken fixtures turn it red`);
  return fails.length ? 1 : 0;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  if (process.argv.includes("--self-test")) process.exit(await selfTest());
  console.log(`▸ set-times watch: ${WATCHES.length} festival(s)`);
  process.exit((await runWatches(WATCHES)) ? 1 : 0);
}

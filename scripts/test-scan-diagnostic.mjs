#!/usr/bin/env node
// test-scan-diagnostic.mjs: the build 39 scan diagnostic (photo-tag.jsx).
//
// A real phone showed 60 ACL clips under one Charli XCX card after a second
// Scan, and nothing we can read reproduces it. Build 39 records the store and
// every write so the device can tell us. This gate runs the SHIPPED build
// (build/data.js + build/photo-tag.js) in a vm and proves:
//   1. the "before" snapshot is taken when the file loads, from the store as
//      found, and is never overwritten by a later load or event;
//   2. nothing in the diagnostic writes the moment store: it is byte-identical
//      after every diagnostic call;
//   3. privacy: the exported text holds only allowlisted keys, and none of a
//      moment's private values (raw ids, file names, paths, GPS, location,
//      fingerprints, text) appear anywhere in it;
//   4. a write that moves records is logged with the caller's function name
//      and a per-record from>to line; back-to-back writes from one caller
//      fold into one event; record hashes are stable for a salt and differ
//      across salts;
//   5. size: a 3,000-moment store exports under the 38,000-character limit,
//      marked truncated rather than silently cut;
//   6. wiring: _writeMoments and the cloud restore both log, scan start/end
//      and review close log, and the Memories screen has the one-tap button;
//   7. review holds (#383): the WHOLE export stays under 38,000 chars even
//      with 3,000 distinct artists (summaries and events included), with
//      truncation and totals explicit; a field planted in the persisted
//      diagnostic (privatePath) never reaches the export; with no share sheet,
//      no navigator.share and no clipboard the share reports "unavailable";
//      no capture or import time is exported.
//   8. mutations: spreading the whole moment into the record, letting a later
//      load overwrite "before", skipping the summary trim, copying stored
//      events through, and reporting "copied" with no clipboard each fail.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEST_DIR = join(ROOT, "data", "festivals");
const MODS = readdirSync(FEST_DIR).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(FEST_DIR, f), "utf8")).join("\n");
const BUILD = n => readFileSync(join(ROOT, "build", `${n}.js`), "utf8");
const SRC = n => readFileSync(join(ROOT, n), "utf8");

function boot(photoTagSrc, store, nav = null) {
  const noop = () => {};
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  let rnd = 7;
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, Date, Math, JSON, Uint8Array,
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (rnd = (rnd * 1103515245 + 12345) & 0xff); return a; } },
    location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: nav || { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
    indexedDB: { open: () => ({}) },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  vm.runInContext(BUILD("data"), ctx);
  vm.runInContext(photoTagSrc, ctx);
  return ctx;
}

// Private values planted on every moment; none may reach the export.
const PRIVATE = {
  photoId: "p_m_secretphoto", posterId: "poster_secret", nativePath: "/var/mobile/Containers/Data/secret/IMG_4242.MOV",
  parsedGps: { lat: 30.26712345, lng: -97.76998765 }, location: { lat: 30.26712345, lng: -97.76998765, label: "Zilker secret spot" },
  _fingerprint: "IMG_4242.MOV_123456789_1696800000000", text: "my private caption", fileType: "video/quicktime",
  gpsAccM: 37, heading: 211, name: "IMG_4242.MOV", _scanPath: "/tmp/scan-export/secret.jpg",
};
const FORBIDDEN = ["secretphoto", "poster_secret", "/var/mobile", "IMG_4242", "30.267", "97.769", "Zilker secret",
  "123456789", "private caption", "quicktime", "/tmp/scan-export", "m_17000000",
  "2026-10-10 20:37", "2025-01-02T03:04", "privatePath", "/private/var/secret-planted"];
function store(nMoments = 6, distinctArtists = false) {
  const nights = {};
  for (let i = 0; i < nMoments; i++) {
    const night = String(1 + (i % 3));
    (nights[night] = nights[night] || []).push({
      id: `m_17000000${String(i).padStart(5, "0")}_${i}_ab${i}`, night: Number(night),
      artistId: distinctArtists ? `zz${i}` : i % 2 ? "as10" : "af40", festivalId: "acl-2026", tagSource: i % 2 ? "photokit" : "exif",
      festivalStampSource: "capture-time", takenAtSource: "photokit", kind: i % 4 ? "photo" : "video",
      takenAt: "2026-10-10 20:37", importedAt: "2025-01-02T03:04:05.000Z", autoTagged: true, tagAmbiguous: false,
      needsRetag: false, ...PRIVATE,
    });
  }
  return { plursky_moments_v1: JSON.stringify(nights) };
}

let pass = 0, fail = 0;
const fails = [];
function check(name, ok, detail = "") {
  if (ok) pass++;
  else { fail++; fails.push(`✗ ${name}${detail ? ` — ${detail}` : ""}`); }
  return ok;
}

const ALLOWED_KEYS = new Set(["schema", "created", "app", "activeFestival", "scanSeen", "before", "now", "events",
  "eventsTotal", "t", "tEnd", "summary", "truncated", "records", "total", "byFest", "bySource", "nights",
  "ev", "origin", "added", "removed", "changed", "changes", "writes",
  "h", "f", "n", "a", "ts", "fs", "tk", "k", "auto", "amb", "rt", "fp"]);
// byFest / nights / bySource / per-night maps are keyed by data (festival ids,
// night numbers, artist ids, tag sources); those keys are checked by pattern.
const DATA_KEY = /^[A-Za-z0-9_.:-]{1,40}$/;
function keysOk(o, path = "", underData = false) {
  if (Array.isArray(o)) return o.every((x, i) => keysOk(x, `${path}[${i}]`, false));
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      const dataMap = /(^|\.)(byFest|bySource|nights)$/.test(path) || /\.nights\.[^.]+$/.test(path);
      if (dataMap ? !DATA_KEY.test(k) : !ALLOWED_KEYS.has(k)) { keysOk.bad = `${path}.${k}`; return false; }
      if (!keysOk(v, path ? `${path}.${k}` : k)) return false;
    }
  }
  return true;
}

function runChecks(photoTagSrc, label) {
  const before = fail;
  const st = store();
  const ctx = boot(photoTagSrc, st);
  const momentsAtLoad = st.plursky_moments_v1;
  const d0 = JSON.parse(st.plursky_scan_diag_v1 || "null");
  check(`${label}: before snapshot taken at load`, !!d0?.before && d0.before.summary.total === 6, JSON.stringify(d0?.before?.summary?.total));

  // A later move: two records retagged to Charli (as5) by some caller.
  const moved = JSON.parse(st.plursky_moments_v1);
  moved["1"][0].artistId = "as5"; moved["2"][0].artistId = "as5";
  st.plursky_moments_v1 = JSON.stringify(moved);
  const stackA = "processImportedFiles@capacitor://localhost/build/spotify.js?v=v513:61:22\n_writeMoments@capacitor://localhost/build/spotify.js:9:3";
  ctx._scanDiagLog("write", moved, stackA);
  ctx._scanDiagLog("write", moved, stackA);
  // Reload the file (next app open): "before" must not move.
  vm.runInContext(photoTagSrc, ctx);
  const d1 = JSON.parse(st.plursky_scan_diag_v1);
  check(`${label}: before survives a later load`, d1.before.t === d0.before.t
    && d1.before.records.every(r => r.a !== "as5"), "before was overwritten");
  const w = d1.events.filter(e => e.ev === "write");
  check(`${label}: write logged with caller name, folded`, w.length === 1 && w[0].origin === "processImportedFiles" && w[0].writes === 2,
    JSON.stringify(w.map(e => [e.origin, e.writes])));
  check(`${label}: move named per record`, w[0]?.changed === 2 && w[0].changes.filter(c => c.startsWith("~") && c.endsWith("|as5|photokit") || /\|as5\|/.test(c)).length === 2,
    JSON.stringify(w[0]?.changes));
  check(`${label}: store untouched by diagnostics`, st.plursky_moments_v1 === JSON.stringify(moved));

  const text = ctx._scanDiagExportText({ appVersion: "v514" });
  let parsed = null; try { parsed = JSON.parse(text); } catch {}
  check(`${label}: export parses`, !!parsed);
  keysOk.bad = null;
  check(`${label}: export keys allowlisted`, parsed && keysOk(parsed), keysOk.bad || "");
  const leaks = FORBIDDEN.filter(s => text.includes(s));
  check(`${label}: no private values in export`, leaks.length === 0, leaks.join(", "));
  check(`${label}: export carries before and now`, parsed?.before?.summary?.total === 6 && parsed?.now?.summary?.total === 6
    && parsed.now.summary.byFest["acl-2026"]?.nights?.["1"]?.as5 === 1);
  check(`${label}: store untouched after export`, st.plursky_moments_v1 === JSON.stringify(moved));
  // The stored diagnostic itself (device-local) holds no private values
  // either: the export's rebuild is a second line, not the only one.
  const storedLeaks = FORBIDDEN.filter(x => (st.plursky_scan_diag_v1 || "").includes(x));
  check(`${label}: persisted diagnostic holds no private values`, storedLeaks.length === 0, storedLeaks.join(", "));
  return fail === before;
}

// 5–7. Size bound, persisted-data rebuild and share result: run on every
// source (shipped and mutants), so each fix has a mutant that fails here.
async function boundChecks(src, label) {
  const before = fail;
  // Size: 3,000 moments, every one under a different artist. The per-artist
  // summary alone is past 38k, so only a bounded summary keeps it under.
  {
    const st = store(3000, true);
    const ctx = boot(src, st);
    const text = ctx._scanDiagExportText({});
    let p = null; try { p = JSON.parse(text); } catch {}
    check(`${label}: 3,000 distinct artists export under 38,000 chars`, text.length <= 38000, String(text.length));
    check(`${label}: big export parses with exact totals`, !!p && p.now?.total === 3000 && p.now?.summary?.total === 3000 && p.before?.total === 3000,
      JSON.stringify([p?.now?.total, p?.now?.summary?.total, p?.before?.total]));
    check(`${label}: big export marks what it shed`, p?.now?.truncated === true && p?.truncated?.records === true && p?.truncated?.summary === true,
      JSON.stringify(p?.truncated));
  }
  // Rebuild: plant a private field at every level of the PERSISTED
  // diagnostic. The export may only carry fields it rebuilds itself.
  {
    const st = store();
    const ctx = boot(src, st);
    const d = JSON.parse(st.plursky_scan_diag_v1);
    const P = "/private/var/secret-planted/IMG_9.MOV";
    d.before.privatePath = P;
    d.before.records[0].privatePath = P;
    d.before.records[1].w = "2026-10-10 20:37";
    d.before.summary.privatePath = P;
    d.before.summary.byFest["acl-2026"].privatePath = P;
    d.events[0].privatePath = P;
    d.events.push({ t: "2026-11-05T22:12:31.000Z", ev: "write", origin: "x", total: 1, added: 1, removed: 0, changed: 0,
                    changes: [`+0123456789abcdef:${P}`], privatePath: P });
    st.plursky_scan_diag_v1 = JSON.stringify(d);
    const text = ctx._scanDiagExportText({});
    const leaks = FORBIDDEN.filter(x => text.includes(x));
    check(`${label}: planted privatePath dropped from the export`, leaks.length === 0, leaks.join(", "));
    let p = null; try { p = JSON.parse(text); } catch {}
    keysOk.bad = null;
    check(`${label}: rebuilt export keys allowlisted`, !!p && keysOk(p), keysOk.bad || "");
  }
  // Share: no native share, no navigator.share, no clipboard → unavailable.
  {
    const ctx = boot(src, store(), { userAgent: "node" });
    const r = await ctx._scanDiagShare({});
    check(`${label}: no share API reports unavailable`, r && r.ok === false && r.mode === "unavailable", JSON.stringify(r));
    // Positive control: a working clipboard IS reported as copied.
    let got = null;
    const ctx2 = boot(src, store(), { userAgent: "node", clipboard: { writeText: async t => { got = t; } } });
    const r2 = await ctx2._scanDiagShare({});
    check(`${label}: clipboard control reports copied`, r2?.mode === "copied" && typeof got === "string" && got.length > 0, JSON.stringify(r2));
  }
  return fail === before;
}

// 1–7 on the shipped build.
const SHIPPED = BUILD("photo-tag");
runChecks(SHIPPED, "shipped");
await boundChecks(SHIPPED, "shipped");

// Hash: stable for one salt, different across salts.
{
  const ctx = boot(SHIPPED, store());
  const a1 = ctx._scanDiagHash("m_1", "aa"), a2 = ctx._scanDiagHash("m_1", "aa"), b = ctx._scanDiagHash("m_1", "bb");
  check("hash stable per salt, differs across salts", a1 === a2 && a1 !== b && /^[0-9a-f]{16}$/.test(a1));
  check("origin keeps names only", ctx._scanDiagOrigin("    at async handleScanWeekend (file:///x/spotify.js:1:2)\n    at _writeMoments (file:///y:1:1)") === "handleScanWeekend");
}

// 6. Wiring in the source.
{
  const sp = SRC("spotify.jsx"), sb = SRC("supabase.jsx");
  const wm = sp.slice(sp.indexOf("function _writeMoments(all)"), sp.indexOf("function _writeMoments(all)") + 600);
  check("_writeMoments logs", /_scanDiagLog\("write", all, new Error\(\)\.stack\)/.test(wm));
  check("cloud restore logs", /_scanDiagLog\("cloud-restore", local\)/.test(sb));
  check("scan start/end log", /_scanDiagLog\("scan-start"\)/.test(sp) && /finally \{\s*try \{ _scanDiagLog\("scan-end"\)/.test(sp));
  check("review close logs", /setReview\(null\); try \{ _scanDiagLog\("review-close"\)/.test(sp));
  check("one-tap button on Memories", /data-scan-diag onClick=\{async \(\) => \{[\s\S]{0,200}_scanDiagShare\(/.test(sp) && />\s*Share scan diagnostic\s*</.test(sp));
  const dataLines = sp.split("\n").filter(l => /_scanDiag/.test(l) && !/^\s*(\/\/|\{\/\*)/.test(l));
  check("diagnostic never writes moments", !/_scanDiag[^\n]*setItem\("plursky_moments_v1"/.test(SRC("photo-tag.jsx")) && dataLines.length >= 5);
}

// 8. Mutations: each must fail at least one check.
const MUTANTS = [
  ["record spreads the whole moment", SHIPPED.replace(/return \{\s*h: _scanDiagHash\(String\(m\.id\), salt\),/, "return { ...m, h: _scanDiagHash(String(m.id), salt),")],
  ["a later load overwrites before", SHIPPED.replace(/if \(d\.before\) return false;/, "")],
  // Built text (Babel reformats object literals onto lines and const → var).
  ["summaries are never trimmed", SHIPPED.replace(/if \(k === Infinity\) return \{/, "return {")],
  ["stored events copied through", SHIPPED.replace(/(var|const) events = \(Array\.isArray\(d\.events\) \? d\.events : \[\]\)\.map\(_scanDiagCleanEvent\)\.filter\(Boolean\);/, "var events = Array.isArray(d.events) ? d.events : [];")],
  ["no clipboard still says copied", SHIPPED.replace(/if \(!clip \|\| typeof clip\.writeText !== "function"\) return \{[^}]*\};\s*try \{\s*await clip\.writeText\(text\);/, "try { await clip?.writeText?.(text);")],
];
for (const [name, src] of MUTANTS) {
  if (src === SHIPPED) { check(`mutant applies: ${name}`, false, "pattern not found"); continue; }
  const saved = { pass, fail, fails: fails.slice() };
  let caught;
  try { caught = !(runChecks(src, `mutant(${name})`) & await boundChecks(src, `mutant(${name})`)); }
  catch { caught = true; }
  pass = saved.pass; fail = saved.fail; fails.length = 0; fails.push(...saved.fails);
  check(`mutant caught: ${name}`, caught);
}

if (fail) { console.log(fails.join("\n")); console.log(`  ✗ scan diagnostic: ${fail} of ${pass + fail} checks failed`); process.exit(1); }
console.log(`  ✓ scan diagnostic: ${pass} checks (before snapshot at load, read-only, rebuilt allowlisted export hard-capped at 38k incl. 3,000 artists, planted fields dropped, share unavailable without APIs, wiring, ${MUTANTS.length} mutants caught)`);

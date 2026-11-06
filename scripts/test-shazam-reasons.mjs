#!/usr/bin/env node
// Build 39 PR 3: Shazam on a library video says WHY it failed. On the REAL
// compiled spotify.js in a vm, with the native ShazamPlugin stubbed:
//   1. Each failure has its own reason and its own words: missing file,
//      recognizer unavailable, no audio, audio extraction failure, service or
//      network error, timeout, too large, and a genuine no-match.
//   2. A stale cache path (missing-file from identifyFile) is retried once
//      from the clip kept in IndexedDB, with a size cap; a clip over the cap
//      is refused before base64 is built.
//   3. Library recognition never calls the live-mic identify(), so it can
//      never prompt for the microphone.
//   4. Only { matched, title, artist, source } or { matched, reason } come
//      back: no path, no native debug payload, no Apple Music ids or artwork.
//   5. ShazamPlugin.swift's file path: distinct reasons, no microphone, no
//      system error text in what it resolves.
// Then mutations on the built source, each of which must be caught.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const SPOTIFY_BUILT = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const SWIFT = readFileSync(join(ROOT, "ios", "App", "App", "ShazamPlugin.swift"), "utf8");
const noop = () => {};
const PATH = "/var/mobile/Containers/Data/Application/SECRET-UUID/Library/Caches/scan-export/IMG_4242.MOV";

function boot(spotifySrc) {
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = { active_festival_id: "acl-2026", active_festival_explicit: "1" };
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    // The 30 s guard fires on the next macrotask, after any stub that answers
    // in microtasks: a stub that never answers is a timeout, others are not.
    setTimeout: (fn, ms) => (ms === 30000 ? setImmediate(fn) : 0), clearTimeout: (h) => { if (h && typeof h === "object") clearImmediate(h); },
    setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  for (const n of ["data", "photo-tag"]) vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
  vm.runInContext(spotifySrc, ctx, { filename: "build/spotify.js" });
  return ctx;
}

// A native shell whose ShazamPlugin answers from `script`, recording calls.
function shell(ctx, { file, b64, native = true, plugin = true, blob = { size: 4_000_000, type: "video/quicktime" } } = {}) {
  const calls = { file: 0, b64: 0, mic: 0, b64ext: null, b64Built: 0 };
  ctx.Capacitor = { isNativePlatform: () => native };
  ctx.ShazamPlugin = plugin ? {
    identify: async () => { calls.mic++; return { matched: false }; },          // the live mic: must never run
    ...(file !== undefined ? { identifyFile: async ({ path }) => { calls.file++; return typeof file === "function" ? file(path) : file; } } : {}),
    ...(b64 !== undefined ? { identifyBase64: async ({ ext }) => { calls.b64++; calls.b64ext = ext; return typeof b64 === "function" ? b64() : b64; } } : {}),
  } : null;
  ctx._getPhoto = async () => blob;
  ctx._blobToBase64 = async () => { calls.b64Built++; return "AAAA"; };
  return calls;
}
const VIDEO = { photoId: "p1", kind: "video", nativePath: PATH };
const nm = (reason) => ({ matched: false, title: "", artist: "", debug: { reason, fileBytes: 1 } });

async function checks(ctx) {
  const fails = []; let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const id = (m = VIDEO) => ctx.identifySongFromVideo(m, noop);
  const TEXT = vm.runInContext("_SONG_FAIL_TEXT", ctx);
  const clean = (r, label) => {
    const keys = Object.keys(r || {}).sort().join(",");
    t(keys === "matched,reason" || keys === "artist,matched,source,title", `${label}: result carries extra fields (${keys})`);
    t(!JSON.stringify(r).includes("SECRET-UUID") && !JSON.stringify(r).includes("IMG_4242"), `${label}: result carries the file path`);
  };

  // 1. Distinct reasons.
  { const c = shell(ctx, { native: false, file: nm("no-match") }); const r = await id();
    t(r.reason === "unavailable" && c.file === 0, `web: ${JSON.stringify(r)}`); clean(r, "web"); }
  { shell(ctx, { plugin: false }); const r = await id(); t(r.reason === "unavailable", `no plugin: ${JSON.stringify(r)}`); }
  const cases = [
    ["no-match", "no-match"], ["no-audio", "no-audio"], ["audio-failed", "audio-failed"],
    ["service-error", "service-error"], ["timeout", "timeout"], ["busy", "service-error"],
    // the reasons an older native build sends
    ["no-audio-track-or-reader", "no-audio"], ["no-pcm-appended", "audio-failed"], ["match-timeout", "timeout"], ["did-not-find", "no-match"],
  ];
  for (const [native, want] of cases) {
    const c = shell(ctx, { file: nm(native), b64: nm("no-match") });
    const r = await id();
    t(r.matched === false && r.reason === want, `native "${native}" → ${r.reason}, want ${want}`);
    t(c.b64 === 0, `native "${native}" retried from IndexedDB (only a missing file should)`);
    clean(r, native);
  }
  { shell(ctx, { file: () => new Promise(noop), b64: nm("no-match") }); const r = await id();
    t(r.reason === "timeout", `a bridge that never answers → ${r.reason}`); }
  { shell(ctx, { file: () => { throw new Error("Failed to write temp file"); }, b64: nm("no-match") }); const r = await id();
    t(r.reason === "missing-file" || r.reason === "no-match" || r.reason === "audio-failed", `a rejected identifyFile → ${r.reason}`); }

  // A match: only the four fields, never the native payload.
  { const c = shell(ctx, { file: { matched: true, title: "Song", artist: "Act", appleMusicID: "123", artworkURL: "https://x/y.jpg", debug: { path: PATH } } });
    const r = await id();
    t(r.matched === true && r.title === "Song" && r.artist === "Act" && r.source === "video-shazam", `match: ${JSON.stringify(r)}`);
    clean(r, "match"); t(c.mic === 0, "match path touched the mic"); }

  // 2. Stale cache path → the IndexedDB copy, once.
  { const c = shell(ctx, { file: nm("missing-file"), b64: { matched: true, title: "From blob", artist: "A" } });
    const r = await id();
    t(r.matched && r.title === "From blob" && c.file === 1 && c.b64 === 1 && c.b64ext === "mov", `stale path not retried from IndexedDB: ${JSON.stringify([r, c])}`); }
  { const c = shell(ctx, { file: () => { throw new Error("Missing file path"); }, b64: nm("no-match") });
    const r = await id(); t(r.reason === "no-match" && c.b64 === 1, `a missing-path rejection did not retry: ${JSON.stringify([r, c])}`); }
  { const c = shell(ctx, { file: nm("missing-file"), b64: nm("no-match"), blob: null });
    const r = await id(); t(r.reason === "missing-file" && c.b64 === 0, `no stored copy → ${r.reason}`); }
  { const c = shell(ctx, { file: nm("missing-file"), b64: nm("no-match"), blob: { size: 61 * 1024 * 1024, type: "video/quicktime" } });
    const r = await id(); t(r.reason === "too-large" && c.b64Built === 0 && c.b64 === 0, `over-cap clip → ${r.reason}, base64 built ${c.b64Built}×`); }
  { const c = shell(ctx, { file: nm("missing-file"), b64: nm("no-match"), blob: { size: 59 * 1024 * 1024, type: "video/mp4" } });
    const r = await id(); t(r.reason === "no-match" && c.b64 === 1 && c.b64ext === "mp4", `under-cap clip not retried: ${JSON.stringify([r, c])}`); }
  // No native path at all (an older import): straight to the stored copy.
  { const c = shell(ctx, { file: nm("no-match"), b64: { matched: true, title: "S", artist: "" } });
    const r = await id({ photoId: "p1", kind: "video" }); t(r.matched && c.file === 0 && c.b64 === 1, `no nativePath: ${JSON.stringify(c)}`); }
  { shell(ctx, { file: nm("no-match") }); const r = await id({ photoId: "p1", kind: "photo" }); t(r.matched === false, "a photo was sent to Shazam"); }

  // 3. Never the mic, across every case above and a fresh pass.
  { let mic = 0; for (const [native] of cases) { const c = shell(ctx, { file: nm(native), b64: nm("no-match") }); await id(); mic += c.mic; }
    t(mic === 0, `library recognition called the live mic ${mic}×`); }

  // Words: one per reason, and only "no-match" says "No match".
  const reasons = ["no-match", "missing-file", "unavailable", "no-audio", "audio-failed", "service-error", "timeout", "too-large"];
  t(reasons.every(r => typeof TEXT[r] === "string" && TEXT[r].length > 8), "a failure reason has no words");
  t(new Set(reasons.map(r => TEXT[r])).size === reasons.length, "two failure reasons share words");
  t(reasons.filter(r => /no match/i.test(TEXT[r])).join() === "no-match", "a non-match failure says \"No match\"");
  return { fails, n };
}

const base = await checks(boot(SPOTIFY_BUILT));

// 4. Source wiring the vm cannot reach.
const SP = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
const fileRegion = SWIFT.slice(SWIFT.indexOf("@objc func identifyFile"), SWIFT.indexOf("// MARK: - Live mic"));
const resolvedText = SWIFT.replace(/logDebug\([^\n]*\n/g, "");
const wire = [
  [/: idState === "fail"\s*\? \(_SONG_FAIL_TEXT\[idFail\] \|\| _SONG_FAIL_TEXT\["no-match"\]\)/.test(SP), "the Shazam button does not show the failure's own words"],
  [/if \(!result\?\.matched\) \{\s*setIdFail\(result\?\.reason/.test(SP), "runIdentify does not keep the failure reason"],
  [!/identify\(\s*\{/.test(SP.slice(SP.indexOf("async function identifySongFromVideo"), SP.indexOf("// ── 0.4 recovery"))), "identifySongFromVideo calls the live-mic identify()"],
  [fileRegion.length > 500 && !/recordPermission|requestRecordPermission|AVAudioEngine|AVAudioSession/.test(fileRegion), "the Swift file path touches the microphone"],
  [["missing-file", "no-audio", "audio-failed", "service-error", "timeout", "no-match", "busy"].every(r => fileRegion.includes(`"${r}"`) || SWIFT.includes(`"${r}"`)), "a Swift failure reason is missing"],
  [!/localizedDescription/.test(resolvedText), "Swift resolves a system error string (may carry a file name)"],
  [/FileManager\.default\.fileExists\(atPath: url\.path\)/.test(fileRegion), "identifyFile does not check the file exists"],
  [/if savedCall != nil \{/.test(fileRegion), "a second file match can orphan the first"],
];
for (const [ok, msg] of wire) { base.n++; if (!ok) base.fails.push(msg); }

// 5. Mutations on the built source.
const MUTANTS = [
  ["stale path is not retried from IndexedDB", SPOTIFY_BUILT.replace(/if \(r\.reason !== "missing-file"\) return r;/, "return r;")],
  ["no size cap on the stored clip", SPOTIFY_BUILT.replace(/if \(blob\.size > _SONG_BLOB_MAX_BYTES\) return _songFail\("too-large"\);/, "")],
  ["every native failure reads as no-match", SPOTIFY_BUILT.replace(/return _songFail\(_SONG_NATIVE_REASON\[r\?\.debug\?\.reason\] \|\| "no-match"\);/, 'return _songFail("no-match");')],
  ["native payload passed through", SPOTIFY_BUILT.replace(/if \(r\?\.matched && r\.title\) return \{\s*matched: true,\s*title: r\.title,/, "if (r?.matched && r.title) return { ...r, matched: true, title: r.title,")],
  ["no timeout guard", SPOTIFY_BUILT.replace(/if \(r\?\.__timeout\) return _songFail\("timeout"\);/, "").replace(/_SONG_CALL_TIMEOUT_MS\);/, "1e9);")],
];
const caught = [];
for (const [name, src] of MUTANTS) {
  base.n++;
  if (src === SPOTIFY_BUILT) { base.fails.push(`mutant did not apply: ${name}`); continue; }
  let killed;
  try { killed = (await Promise.race([checks(boot(src)), new Promise(r => setTimeout(() => r({ fails: ["hung"] }), 5000))])).fails.length > 0; }
  catch { killed = true; }
  if (!killed) base.fails.push(`mutant survived: ${name}`); else caught.push(name);
}

if (base.fails.length) {
  console.log(base.fails.map(f => `    ✗ ${f}`).join("\n"));
  console.log(`  ✗ shazam reasons: ${base.fails.length} of ${base.n} checks failed`);
  process.exit(1);
}
console.log(`  ✓ shazam reasons: ${base.n} checks (8 distinct reasons + words, stale path retried from IndexedDB under a 60 MB cap, never the mic, no path or payload in results, Swift file path) · ${caught.length} mutants caught`);
process.exit(0);

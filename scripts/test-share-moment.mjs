#!/usr/bin/env node
// SPEC-179 PR A: sharing a moment never sits on "Preparing…". On the REAL
// compiled spotify.js + recap-engine.js in a vm, with media, canvas and the
// native Share plugin stubbed:
//   1. A video shares from its STORED POSTER; the clip is not read and no
//      frame is decoded from it.
//   2. A video with no poster whose frame never decodes answers "timeout"
//      within the prep cap, and never opens a sheet afterwards.
//   3. The prep cap is at most 8 s.
//   4. A video with no readable frame still shares, on the plain hero.
//   5. Missing media is "no_photo"; a failed PNG encode is "encode_fail";
//      each has words the person sees (none are swallowed).
//   6. A photo shares through the native Capacitor sheet first, not
//      navigator.share; closing the native sheet does not open a second one.
//   7. A real native error falls back to the web sheet; the download fallback
//      on iOS is reported as a failure, not a success.
//   8. Source: both share buttons route the result to a toast, the card names
//      the clip's own festival, and the old no-timeout grabber is gone.
// Then mutations on the built source, each of which must be caught.
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODS = readdirSync(join(ROOT, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(join(ROOT, "data", "festivals", f), "utf8")).join("\n");
const SPOTIFY_BUILT = readFileSync(join(ROOT, "build", "spotify.js"), "utf8");
const RECAP_BUILT = readFileSync(join(ROOT, "build", "recap-engine.js"), "utf8");
const SPOTIFY_JSX = readFileSync(join(ROOT, "spotify.jsx"), "utf8");
const noop = () => {};
const PNG = { size: 10, type: "image/png", __png: true };

function boot(spotifySrc, recapSrc) {
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, removeChild: noop, addEventListener: noop, click: noop,
                      classList: { add: noop, remove: noop, toggle: noop, contains: () => false } });
  const store = { active_festival_id: "acl-2026", active_festival_explicit: "1" };
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Intl, fetch: () => new Promise(noop),
    setTimeout, clearTimeout, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    URLSearchParams, URL: { createObjectURL: () => "blob:x", revokeObjectURL: noop },
    location: { search: "", hash: "", pathname: "/", href: "http://x/", protocol: "http:" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop, onLine: true },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: { appendChild: noop },
                fonts: { ready: Promise.resolve() } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }), createPortal: () => null },
    CustomEvent: function CustomEvent() {},
    File: function File(parts, name, opts) { this.name = name; this.type = opts && opts.type; },
    FileReader: function FileReader() { this.readAsDataURL = () => { this.result = "data:image/png;base64,AAAA"; setImmediate(() => this.onload()); }; },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop; ctx.dispatchEvent = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  for (const n of ["data", "photo-tag"]) vm.runInContext(readFileSync(join(ROOT, "build", `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
  vm.runInContext(recapSrc, ctx, { filename: "build/recap-engine.js" });
  vm.runInContext(spotifySrc, ctx, { filename: "build/spotify.js" });
  return ctx;
}

// One device: which blobs exist, how the frame grabber and encoder behave,
// and what the native / web share sheets do. Records every call.
function device(ctx, { media = {}, grab = "frame", encode = true, native = true, cap = "ok", web = "ok", reader = "ok" } = {}) {
  const calls = { read: [], grab: 0, cap: 0, web: 0, capFiles: null, sheets: 0, readerAborted: 0 };
  // The PNG → data URL read before the native sheet: "ok", "hang" (never fires
  // load or error until aborted), "abort" (fires abort) or "error".
  ctx.FileReader = function FileReader() {
    this.abort = () => { calls.readerAborted++; if (reader === "hang") setImmediate(() => this.onabort && this.onabort()); };
    this.readAsDataURL = () => {
      if (reader === "hang") return;
      if (reader === "abort") return setImmediate(() => this.onabort && this.onabort());
      if (reader === "error") { this.error = new Error("read failed"); return setImmediate(() => this.onerror()); }
      this.result = "data:image/png;base64,AAAA"; setImmediate(() => this.onload());
    };
  };
  ctx._getPhoto = async (id) => { calls.read.push(id); return media[id] || null; };
  ctx._imgFromBlob = async () => ({ img: { width: 640, height: 360 }, revoke: noop });
  ctx._videoPosterBlob = (blob) => { calls.grab++; return grab === "hang" ? new Promise(noop) : Promise.resolve(grab === "none" ? null : { size: 5 }); };
  const ctx2d = new Proxy({}, { get: (t, k) => k === "measureText" ? () => ({ width: 10 })
    : k === "createLinearGradient" ? () => ({ addColorStop: noop }) : (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
  ctx.document.createElement = (tag) => tag === "canvas"
    ? { width: 0, height: 0, getContext: () => ctx2d, toBlob: (cb) => setImmediate(() => cb(encode ? PNG : null)) }
    : { style: {}, setAttribute: noop, click: noop };
  ctx.Capacitor = { isNativePlatform: () => native, Plugins: { Share: { share: async ({ files }) => {
    calls.cap++; calls.sheets++; calls.capFiles = files;
    if (cap === "cancel") throw new Error("Share canceled");
    if (cap === "error") throw new Error("Something broke");
  } } } };
  ctx.navigator.canShare = () => web !== "none";
  ctx.navigator.share = async () => { calls.web++; calls.sheets++; if (web === "abort") { const e = new Error("x"); e.name = "AbortError"; throw e; } };
  return calls;
}

const META = { artistName: "Cloonee", timeLabel: "11:59 PM", subLabel: "MIND MELT", festival: "III POINTS" };
const VIDEO = { id: "m1", photoId: "clip1", kind: "video" };
const PHOTO = { id: "m2", photoId: "img1", kind: "image" };

async function checks(ctx) {
  const fails = []; let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  const posterKey = vm.runInContext("_posterKey", ctx)("m1");
  const share = (m, opts) => ctx._shareMoment(m, META, opts);
  const failText = (r) => ctx._shareMomentFailText(r);

  // 3. The cap.
  const cap = vm.runInContext("typeof _SHARE_PREP_MS === 'number' ? _SHARE_PREP_MS : -1", ctx);
  t(cap > 0 && cap <= 8000, `prep cap is ${cap} ms, must be ≤ 8000`);

  // 1. Stored poster: the clip is never read, no frame grabbed, native sheet opens.
  {
    const c = device(ctx, { media: { [posterKey]: { size: 3 }, clip1: { size: 9e6 } } });
    const r = await share(VIDEO);
    t(r.ok && r.mode === "native", `video with poster → native sheet (got ${JSON.stringify(r)})`);
    t(!c.read.includes("clip1"), "video with a stored poster must not read the clip");
    t(c.grab === 0, "video with a stored poster must not decode a frame");
    t(c.cap === 1 && c.web === 0, `exactly one native sheet (cap ${c.cap}, web ${c.web})`);
    t(Array.isArray(c.capFiles) && /^data:image\/png/.test(c.capFiles[0] || ""), "native sheet gets the PNG");
    t(failText(r) === null, "a shared moment shows no error");
  }
  // 2. No poster, frame never decodes → timeout inside the cap, and no late sheet.
  {
    const c = device(ctx, { media: { clip1: { size: 9e6 } }, grab: "hang" });
    const t0 = Date.now();
    const r = await share(VIDEO, { prepMs: 60 });
    const took = Date.now() - t0;
    t(!r.ok && r.reason === "timeout", `hung frame → timeout (got ${JSON.stringify(r)})`);
    t(took < 1000, `hung frame answered in ${took} ms with a 60 ms cap`);
    t(typeof failText(r) === "string" && /too long/i.test(failText(r)), "timeout has words");
    await new Promise(res => setTimeout(res, 50));
    t(c.sheets === 0, "a timed-out share never opens a sheet later");
  }
  // 2b. Default cap applies with no options (fonts.ready that never settles).
  {
    device(ctx, { media: { [posterKey]: { size: 3 } } });
    const fonts = ctx.document.fonts; ctx.document.fonts = { ready: new Promise(noop) };
    const r = await share(VIDEO, { prepMs: 60 });
    ctx.document.fonts = fonts;
    t(!r.ok && r.reason === "timeout", "fonts that never load are capped too");
  }
  // 4. No poster, frame grab returns nothing → still shares on the plain hero.
  {
    const c = device(ctx, { media: { clip1: { size: 9e6 } }, grab: "none" });
    const r = await share(VIDEO);
    t(r.ok && r.mode === "native" && c.grab === 1, `no readable frame still shares (got ${JSON.stringify(r)})`);
  }
  // 6. The PNG → data URL read is inside the cap: a reader that never fires
  // answers timeout within the cap, is aborted, and opens no sheet later.
  {
    const c = device(ctx, { media: { [posterKey]: { size: 3 } }, reader: "hang" });
    const t0 = Date.now();
    const r = await share(VIDEO, { prepMs: 60 });
    const took = Date.now() - t0;
    t(!r.ok && r.reason === "timeout", `reader that never fires → timeout (got ${JSON.stringify(r)})`);
    t(took < 1000, `stalled reader answered in ${took} ms with a 60 ms cap`);
    t(c.readerAborted === 1, `the stalled reader is aborted (${c.readerAborted})`);
    await new Promise(res => setTimeout(res, 80));
    t(c.sheets === 0, `a stalled read never opens a sheet later (sheets ${c.sheets})`);
  }
  // 6b. A reader that aborts or errors settles at once and falls back to the
  // web sheet, never hangs.
  for (const how of ["abort", "error"]) {
    const c = device(ctx, { media: { [posterKey]: { size: 3 } }, reader: how });
    const r = await share(VIDEO, { prepMs: 500 });
    t(r.ok && r.mode === "share" && c.cap === 0 && c.web === 1, `reader ${how} → web sheet (got ${JSON.stringify(r)}, cap ${c.cap}, web ${c.web})`);
  }
  // 6c. The other share cards pass no deadline: their read is not capped and still shares.
  {
    const c = device(ctx, { media: {} });
    const r = await ctx._shareBlobAsImage(PNG, { filename: "x.png", title: "x" });
    t(r.ok && r.mode === "native" && c.cap === 1, `uncapped tail still shares natively (got ${JSON.stringify(r)})`);
  }
  // 5. No media at all → no_photo; encode failure → encode_fail. Both have words.
  {
    const c = device(ctx, {});
    const r = await share(VIDEO);
    t(!r.ok && r.reason === "no_photo" && c.sheets === 0, `missing clip → no_photo (got ${JSON.stringify(r)})`);
    t(/isn't on this phone/.test(failText(r) || ""), "no_photo has words");
    const r2 = await share(PHOTO);
    t(!r2.ok && r2.reason === "no_photo", "missing photo → no_photo");
  }
  {
    const c = device(ctx, { media: { img1: { size: 3 } }, encode: false });
    const r = await share(PHOTO);
    t(!r.ok && r.reason === "encode_fail" && c.sheets === 0, `encode failure → encode_fail (got ${JSON.stringify(r)})`);
    t(/Couldn't make the share card/.test(failText(r) || ""), "encode_fail has words");
  }
  // 6. Photo → native sheet first; cancel ends it, no second sheet, no error.
  {
    const c = device(ctx, { media: { img1: { size: 3 } } });
    const r = await share(PHOTO);
    t(r.ok && r.mode === "native" && c.cap === 1 && c.web === 0, `photo → native sheet (got ${JSON.stringify(r)}, web ${c.web})`);
  }
  {
    const c = device(ctx, { media: { img1: { size: 3 } }, cap: "cancel" });
    const r = await share(PHOTO);
    t(r.ok && r.mode === "abort" && c.web === 0, `closing the native sheet opens no second sheet (web ${c.web})`);
    t(failText(r) === null, "closing the sheet is not an error");
  }
  // 7. A real native error falls back to the web sheet; iOS download = failure.
  {
    const c = device(ctx, { media: { img1: { size: 3 } }, cap: "error" });
    const r = await share(PHOTO);
    t(r.ok && r.mode === "share" && c.cap === 1 && c.web === 1, `native error → web sheet (got ${JSON.stringify(r)})`);
  }
  {
    device(ctx, { media: { img1: { size: 3 } }, cap: "error", web: "none" });
    const r = await share(PHOTO);
    t(r.mode === "download" && /share sheet/.test(failText(r) || ""), "download fallback inside the iOS app is reported");
    device(ctx, { media: { img1: { size: 3 } }, native: false, web: "none" });
    const r2 = await share(PHOTO);
    t(r2.mode === "download" && failText(r2) === null, "download on the web is a real save, not an error");
  }
  // The boolean wrapper other cards use keeps its meaning.
  {
    device(ctx, { media: {}, cap: "cancel" });
    const fake = { toBlob: (cb) => cb(PNG) };
    t(await ctx._shareCanvasAsImage(fake, { filename: "a.png", title: "a" }) === false, "_shareCanvasAsImage: cancel → false");
    device(ctx, { media: {} });
    t(await ctx._shareCanvasAsImage(fake, { filename: "a.png", title: "a" }) === true, "_shareCanvasAsImage: native → true");
  }
  return { n, fails };
}

function staticChecks() {
  const fails = []; let n = 0;
  const t = (ok, msg) => { n++; if (!ok) fails.push(msg); };
  t(!/_frameFromVideoBlob/.test(SPOTIFY_JSX), "the no-timeout _frameFromVideoBlob is gone");
  const calls = SPOTIFY_JSX.match(/await _shareMoment\(/g) || [];
  const toasts = SPOTIFY_JSX.match(/const why = _shareMomentFailText\(res\);/g) || [];
  t(calls.length >= 2 && toasts.length === calls.length, `every _shareMoment caller shows its error (${toasts.length}/${calls.length})`);
  t(!/\.catch\(\(\) => \{\}\);\s*\n\s*setSharing\(false\)/.test(SPOTIFY_JSX), "the lightbox share no longer swallows its result");
  t(/_momentFestival\(m\)\.cfg/.test(SPOTIFY_JSX), "the lightbox card names the clip's own festival");
  return { n, fails };
}

// Patterns match the COMPILED output (var, objects split across lines).
const MUTANTS = [
  ["no prep cap (await the card directly)", "spotify", [/var ready = await Promise\.race\(\[prep, timeout\]\);/, "var ready = await prep;"]],
  ["read the clip before the poster", "spotify", [/var frame = await _getPhoto\(_posterKey\(moment\.id\)\)\.catch\(\(\) => null\);/, "var frame = null;"]],
  ["web sheet before native", "recap", [/if \(capShare\?\.share && window\.Capacitor\?\.isNativePlatform\?\.\(\)\) \{/, "if (false) {"]],
  ["data URL read not capped", "recap", [/var capped = deadline == null \? read :/, "var capped = true ? read :"]],
  ["reader abort never settles", "recap", [/reader\.onabort = \(\) => reject\(new Error\("read aborted"\)\);/, ""]],
  ["moment share passes no deadline", "spotify", [/,\s*deadline\s*\}\);/, "});"]],
  ["native cancel falls through", "recap", [/if \(\/cancel\|abort\/i\.test\(e\?\.message \|\| ""\)\) return/, "if (false) return"]],
  ["errors swallowed", "spotify", [/function _shareMomentFailText\(res\) \{/, "function _shareMomentFailText(res) { return null;"]],
  ["encode failure reads as success", "spotify", [/if \(!png\) return \{\s*reason: "encode_fail"\s*\};/, "if (!png) return { png: {} };"]],
  ["missing clip shares anyway", "spotify", [/if \(!clip\) return \{\s*reason: "no_photo"\s*\};/, "if (!clip) return { source: null };"]],
];

const base = await checks(boot(SPOTIFY_BUILT, RECAP_BUILT));
const st = staticChecks();
let caught = 0;
const mutantFails = [];
for (const [name, file, [re, rep]] of MUTANTS) {
  const src = file === "spotify" ? SPOTIFY_BUILT : RECAP_BUILT;
  if (!re.test(src)) { mutantFails.push(`mutant "${name}" did not apply (pattern missing)`); continue; }
  const mut = src.replace(re, rep);
  let r;
  // A mutant that removes the cap hangs forever; the guard timer is what
  // catches it (and keeps the event loop alive while it waits).
  let guard;
  try {
    r = await Promise.race([
      checks(file === "spotify" ? boot(mut, RECAP_BUILT) : boot(SPOTIFY_BUILT, mut)),
      new Promise(res => { guard = setTimeout(() => res({ fails: ["hung"] }), 3000); }),
    ]);
  } catch (e) { r = { fails: ["threw"] }; }
  clearTimeout(guard);
  if (r.fails.length) caught++; else mutantFails.push(`mutant "${name}" survived`);
}
const all = [...base.fails, ...st.fails, ...mutantFails];
console.log(`  share-moment: ${base.n + st.n} checks, ${caught}/${MUTANTS.length} mutants caught`);
if (all.length) { for (const f of all) console.log(`  ✗ ${f}`); process.exit(1); }
console.log("  ✓ share never hangs: poster first, 8 s cap, native sheet, every failure has words");

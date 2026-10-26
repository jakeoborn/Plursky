// Apple Music on the iPhone app signs in natively (v474).
//
// Born from: inside the app the page runs at capacitor://localhost, and the
// MusicKit web sign-in can only post its token back to an origin registered
// on the MusicKit identifier. So connectAppleMusic refused up front with
// "only works on plursky.com", and no iPhone user could link Apple Music or
// build a playlist. The AppleMusicNative plugin now supplies both tokens.
//
// Runs the REAL compiled build/spotify-api.js in a vm, with the plugin and
// api.music.apple.com stubbed:
//   1. Native + authorized: connect succeeds without loading MusicKit JS, and
//      the user token lands where every caller reads it.
//   2. Every Apple Music API call carries the developer token the plugin
//      returned, not the bundled one (playlist search + POST, library read).
//   3. After a restart (fresh vm, user token still stored) the builder picks
//      the native developer token back up silently, with no prompt.
//   4. Denied, not signed in and terms-not-accepted each get their own
//      sentence; a connect never throws.
//   5. On the web nothing changes: no plugin, the bundled token, and the
//      plursky.com origin check still runs.
// Mutation: making _amDevToken return APPLE_DEV_TOKEN fails section 2.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "build", "spotify-api.js"), "utf8");
const NATIVE_DEV = "native.dev.token";
const NATIVE_USER = "native.user.token";
const noop = () => {};

function boot({ native, plugin, store = {}, hostname = "localhost" }) {
  const calls = { authorize: 0, tokens: 0, scripts: 0, fetches: [] };
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop });
  const ctx = {
    console: { log: noop, warn: noop, error: noop, info: noop }, Intl, URL, URLSearchParams, TextEncoder,
    Uint32Array, Uint8Array, ArrayBuffer, DataView, Promise, Date, Math, JSON, Object, Array, String, Number, Set, Map,
    setTimeout: (f) => { f(); return 0; }, clearTimeout: noop,
    location: { hostname, search: "", hash: "", pathname: "/", href: `https://${hostname}/`, origin: `https://${hostname}` },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node" },
    document: { createElement: () => { calls.scripts++; return el(); }, head: { appendChild: noop }, addEventListener: noop },
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, CustomEvent: function () {},
    fetch: async (url, opts = {}) => {
      calls.fetches.push({ url: String(url), auth: opts.headers?.Authorization || null, method: opts.method || "GET" });
      const u = String(url);
      if (u.includes("/me/storefront")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "us" }] }) };
      if (u.includes("/catalog/")) return { ok: true, status: 200, json: async () => ({ results: { songs: { data: [
        { id: "s1", attributes: { artistName: "Test Act", name: "Song One" } },
        { id: "s2", attributes: { artistName: "Test Act", name: "Song Two" } },
      ] } } }) };
      if (u.includes("/me/library/playlists")) return { ok: true, status: 201, json: async () => ({ data: [{ id: "p.1" }] }) };
      if (u.includes("/me/library/artists")) return { ok: true, status: 200, json: async () => ({ data: [{ attributes: { name: "Test Act" } }] }) };
      return { ok: false, status: 404, json: async () => ({}) };
    },
    ARTISTS: [{ id: "a1", name: "Test Act", day: 1, start: "20:00", end: "21:00", tier: 3, stage: "main" }],
    STAGES: [{ id: "main", name: "Main" }],
    FESTIVAL_CONFIG: { shortName: "Test Fest" },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.setTimingMin = () => 1200; ctx.compareSetsByTime = () => 0; ctx.getAllAttended = () => ({});
  if (native) {
    const plugins = { App: { addListener: noop } };
    if (plugin) plugins.AppleMusicNative = {
      authorize: async (a) => { calls.authorize++; calls.lastFallback = a?.fallbackDeveloperToken; return plugin("authorize"); },
      tokens: async () => { calls.tokens++; return plugin("tokens"); },
    };
    ctx.Capacitor = { isNativePlatform: () => true, Plugins: plugins, convertFileSrc: x => x };
  }
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "build/spotify-api.js" });
  return { ctx, calls, store };
}

let checks = 0, failed = 0;
function check(ok, msg) { checks++; if (!ok) { failed++; console.log(`  ✗  ${msg}`); } }

const authorized = () => ({ status: "authorized", developerToken: NATIVE_DEV, userToken: NATIVE_USER, tokenSource: "musickit", hasCloudLibraryEnabled: true });
const bundled = (ctx) => vm.runInContext("APPLE_DEV_TOKEN", ctx);

// ── 1 + 2. Native connect, then every call carries the native token ─────────
{
  const { ctx, calls, store } = boot({ native: true, plugin: authorized });
  const r = await ctx.connectAppleMusic();
  check(r.ok === true, `native connect succeeds (got ${JSON.stringify(r)})`);
  check(store.am_user_token === NATIVE_USER, "native user token stored as am_user_token");
  check(calls.authorize === 1, "connect asks the plugin once, with the prompt");
  check(calls.lastFallback === bundled(ctx), "the bundled token is offered as the fallback");
  check(calls.scripts === 0, "MusicKit JS is never loaded in the app");
  const p = await ctx.createAppleMusicPlaylist({ saved: ["a1"] });
  check(p && p.ok !== false, `playlist builds (got ${JSON.stringify(p)})`);
  const apple = calls.fetches.filter(f => f.url.includes("api.music.apple.com"));
  check(apple.length >= 3, `playlist made Apple Music calls (${apple.length})`);
  check(apple.every(f => f.auth === `Bearer ${NATIVE_DEV}`), "every playlist call carries the native developer token");
  check(apple.some(f => f.method === "POST" && f.url.includes("/me/library/playlists")), "the playlist POST was sent");
  calls.fetches.length = 0;
  await ctx.fetchAppleMusicArtists();
  const lib = calls.fetches.filter(f => f.url.includes("/me/library/artists"));
  check(lib.length === 1 && lib[0].auth === `Bearer ${NATIVE_DEV}`, "library read carries the native developer token");
  ctx.disconnectAppleMusic();
  check(!("am_user_token" in store), "disconnect clears the stored user token");
  check(vm.runInContext("_amDevToken()", ctx) === bundled(ctx), "disconnect drops the native developer token");
  console.log("  ✓ native connect: tokens stored, MusicKit JS skipped, native token on every call");
}

// ── 3. After a restart the builder recovers the native token silently ───────
{
  const { ctx, calls } = boot({ native: true, plugin: authorized, store: { am_user_token: NATIVE_USER } });
  await ctx.createAppleMusicPlaylist({ saved: ["a1"] });
  check(calls.authorize === 0, "no prompt after a restart");
  check(calls.tokens >= 1, "the silent token read ran");
  const apple = calls.fetches.filter(f => f.url.includes("api.music.apple.com"));
  check(apple.length > 0 && apple.every(f => f.auth === `Bearer ${NATIVE_DEV}`), "after a restart every call carries the native token");
  console.log("  ✓ restart: native token recovered without a prompt");
}

// ── 4. Failures each say what to do ─────────────────────────────────────────
{
  const cases = [
    [() => ({ status: "denied" }), /Settings/, "denied"],
    [() => { const e = new Error("userNotSignedIn"); e.code = "user_token_failed"; throw e; }, /Music app/, "not signed in"],
    [() => { const e = new Error("privacyAcknowledgementRequired"); e.code = "user_token_failed"; throw e; }, /terms/, "terms not accepted"],
    [() => { const e = new Error("x"); e.code = "developer_token_failed"; throw e; }, /set up/, "no developer token"],
  ];
  for (const [plugin, re, why] of cases) {
    const { ctx } = boot({ native: true, plugin });
    let r; try { r = await ctx.connectAppleMusic(); } catch (e) { r = { threw: String(e) }; }
    check(!r.threw, `${why}: connect does not throw`);
    check(r.ok !== true && re.test(r.error || ""), `${why}: says so (got ${JSON.stringify(r)})`);
  }
  console.log(`  ✓ failures: ${cases.length} reasons, each with its own sentence`);
}

// ── 5. The web is unchanged ─────────────────────────────────────────────────
{
  const off = boot({ native: false, hostname: "localhost" });
  const r = await off.ctx.connectAppleMusic();
  check(/plursky\.com/.test(r.error || ""), "web off plursky.com still gets the origin message");
  check(vm.runInContext("_amNative()", off.ctx) === null, "no plugin on the web");
  const web = boot({ native: false, hostname: "plursky.com", store: { am_user_token: "web.user" } });
  await web.ctx.fetchAppleMusicArtists();
  const lib = web.calls.fetches.filter(f => f.url.includes("/me/library/artists"));
  check(lib.length === 1 && lib[0].auth === `Bearer ${bundled(web.ctx)}`, "web library read carries the bundled token");
  console.log("  ✓ web: unchanged");
}

if (failed) { console.log(`\n✗ ${failed} of ${checks} Apple Music native checks failed`); process.exit(1); }
console.log(`  ✓ ${checks} Apple Music native checks`);

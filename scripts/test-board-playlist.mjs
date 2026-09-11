#!/usr/bin/env node
// Board playlist — planner fixtures, a sweep of every lineup, and the adapter.
//
// Runs the REAL compiled code (build/spotify-api.js, with build/data.js and
// build/artist.js for the lineups and _b2bParts) in a vm. No browser.
//   1. A hand-built lineup where every reason kind has exactly one right answer.
//   2. Two-weekend nights: a W1 set and a W2 set must never bracket a "gap".
//   3. Every festival in _DATA_SETS: saved sets are always seeds, picks are
//      capped, unsaved and reasoned, each reason is TRUE of the data, and the
//      plan is deterministic.
//   4. The adapter, against a stubbed Spotify API on a 4-day festival: every
//      plan entry's tracks are written, in plan order. Day buckets keyed
//      { 1, 2, 3 } used to drop day 4 and every unscheduled act.
// BOARD_BUILD_DIR points section 4 at another build (the positive control
// against main); BOARD_ADAPTER_ONLY=1 skips sections 1-3 for that run.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = process.env.BOARD_BUILD_DIR || join(ROOT, "build");
const ADAPTER_ONLY = process.env.BOARD_ADAPTER_ONLY === "1";
const MODS = execFileSync("git", ["ls-files", "data/festivals/*.js"], { cwd: ROOT })
  .toString().trim().split("\n").filter(Boolean).map(f => readFileSync(join(ROOT, f), "utf8")).join("\n");
const noop = () => {};
function boot(store = {}) {
  const el = () => ({ style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop, remove: noop } });
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array, Promise,
    String, Number, Boolean, Set, Map, WeakMap, Symbol, Proxy, Reflect, RegExp, Error, isNaN, parseInt, parseFloat, isFinite,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
    fetch: () => new Promise(noop), URLSearchParams, URL, location: { search: "", hash: "", pathname: "/", href: "http://x/" },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: "node", geolocation: {}, vibrate: noop },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} }, body: el(),
                createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }) },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.addEventListener = noop; ctx.removeEventListener = noop;
  ctx.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  vm.runInContext(MODS, ctx);
  for (const n of ["data", "artist", "spotify-api"]) vm.runInContext(readFileSync(join(BUILD, `${n}.js`), "utf8"), ctx, { filename: `build/${n}.js` });
  return ctx;
}

const bad = [];
const check = (label, ok, detail = "") => { if (!ok) bad.push(`${label}${detail ? ` — ${detail}` : ""}`); };
const ids = xs => xs.map(x => x.artist.id).join(",");
const nightMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const ctx = boot();
const plan = ctx.planBoardPlaylist;
const said = [];

if (!ADAPTER_ONLY) {
  if (typeof plan !== "function") { console.error("✗ planBoardPlaylist is not a global function in build/spotify-api.js"); process.exit(1); }

  // ── 1. Fixture lineup ──────────────────────────────────────────────────
  const STG = [{ id: "a", short: "ALPHA STG" }, { id: "b", short: "BRAVO STG" }];
  const A = (id, name, stage, day, start, end, tier = 1, extra = {}) => ({ id, name, stage, day, start, end, tier, ...extra });
  const LINEUP = [
    A("s1", "Alpha", "a", 1, "20:00", "21:00", 2),
    A("s2", "Bravo", "a", 1, "23:00", "00:30", 3),
    A("s2b", "Bravo", "b", 2, "23:00", "00:30", 3),       // repeat act, unsaved → same act, excluded
    A("n1", "Next Up", "a", 1, "21:15", "22:15", 1),      // 15 min after Alpha, same stage → adjacent
    A("n2", "Gapper", "b", 1, "21:30", "22:30", 2),       // inside the 9pm–11pm hole → gap
    A("n3", "Alpha b2b Zed", "b", 2, "22:00", "23:00", 1),// carries a saved name → b2b
    A("n4", "Heard", "b", 2, "18:00", "19:00", 1),        // in the listening list → listen
    A("n5", "Lonely", "b", 2, "15:00", "16:00", 1),       // nothing ties it to the board → never picked
    A("n6", "Stagey", "a", 2, "17:00", "18:00", 1),       // saved twice on ALPHA STG → stage
    A("n7", "Ghost", null, null, "", "", 2),              // unscheduled, unheard → never picked
    A("n8", "Ghost Heard", null, null, "", "", 2),        // unscheduled but heard → listen
  ];
  const full = plan({ artists: LINEUP, savedIds: ["s1", "s2", "missing-id"], affinityNames: ["Heard", "ghost heard"], stages: STG, maxDiscovery: 8 });
  check("fixture: every saved set that exists is a seed", ids(full.seeds) === "s1,s2", ids(full.seeds));
  check("fixture: seeds carry tier track depth", full.seeds.map(s => s.trackLimit).join(",") === "4,5");
  check("fixture: unknown saved id reported", full.diagnostics.unknownSaved.join() === "missing-id");
  const kinds = Object.fromEntries(full.candidates.map(c => [c.artist.id, c.kind]));
  const want = { n1: "adjacent", n2: "gap", n3: "b2b", n4: "listen", n6: "stage", n8: "listen" };
  for (const [id, k] of Object.entries(want)) check(`fixture: ${id} reason kind`, kinds[id] === k, `got ${kinds[id]}, want ${k}`);
  for (const id of ["n5", "n7", "s2b", "s1", "s2"]) check(`fixture: ${id} is not a candidate`, !(id in kinds));
  const reasonOf = id => full.candidates.find(c => c.artist.id === id)?.reason;
  check("fixture: adjacent reason names the set and stage", reasonOf("n1") === "Right after Alpha on ALPHA STG", reasonOf("n1"));
  check("fixture: gap reason names the hole", reasonOf("n2") === "Fills your 9pm–11pm gap on Day 1", reasonOf("n2"));
  check("fixture: b2b reason names the saved artist", reasonOf("n3") === "B2B with Alpha, who you saved", reasonOf("n3"));
  check("fixture: stage reason counts the saves", reasonOf("n6") === "On ALPHA STG, where you saved 2 sets", reasonOf("n6"));
  check("fixture: exclusions counted", JSON.stringify(full.diagnostics.excluded) === JSON.stringify({ saved: 2, sameAct: 1, noSignal: 2, dupName: 0 }),
    JSON.stringify(full.diagnostics.excluded));
  check("fixture: 2 seeds cap discovery at 2", full.cap === 2 && full.picks.length === 2, `cap ${full.cap}, picks ${full.picks.length}`);
  check("fixture: the cap keeps the strongest reasons", full.picks.every(p => p.kind === "listen"), full.picks.map(p => p.kind).join());
  check("fixture: play order is the weekend in sequence", ids(full.order) === "s1,s2,n4,n8", ids(full.order));
  const both = plan({ artists: LINEUP, savedIds: ["s1"], affinityNames: ["zed"], stages: STG });
  check("fixture: listen beats b2b on the same act", both.candidates.find(c => c.artist.id === "n3")?.kind === "listen");
  const empty = plan({ artists: LINEUP, savedIds: [], affinityNames: ["Heard"], stages: STG });
  check("fixture: nothing saved → nothing picked", empty.cap === 0 && empty.picks.length === 0 && empty.order.length === 0);

  // ── 2. Two-weekend nights ──────────────────────────────────────────────
  const WK = [
    A("w1", "Early W1", "a", 1, "18:00", "19:00", 2, { weekend: "W1" }),
    A("w2", "Late W2", "a", 1, "22:00", "23:00", 2, { weekend: "W2" }),
    A("mid", "Middle Both", "b", 1, "20:00", "21:00", 2, { weekend: "both" }),
  ];
  const wk = plan({ artists: WK, savedIds: ["w1", "w2"], stages: STG });
  check("weekends: a W1 set and a W2 set bracket no gap", wk.diagnostics.gaps === 0 && !wk.candidates.some(c => c.kind === "gap"),
    `${wk.diagnostics.gaps} gap(s)`);
  const wk2 = plan({ artists: [...WK, A("w1b", "Late W1", "a", 1, "22:00", "23:00", 2, { weekend: "W1" })], savedIds: ["w1", "w1b"], stages: STG });
  check("weekends: two W1 sets do bracket the both-weekend act", wk2.candidates.find(c => c.artist.id === "mid")?.kind === "gap",
    wk2.candidates.map(c => `${c.artist.id}:${c.kind}`).join());
  said.push(`fixtures: all 5 reason kinds, cap, exclusions, empty board, weekend-split nights`);

  // ── 3. Every lineup ────────────────────────────────────────────────────
  let swept = 0, pickTotal = 0;
  for (const [fid, ds] of Object.entries(ctx._DATA_SETS || {})) {
    const artists = ds.artists || [];
    if (artists.length < 10) continue;
    // A plausible board: the top-tier act of each day, plus every 9th act.
    const saved = [...new Set([
      ...[...new Set(artists.map(a => a.day).filter(d => d != null))].map(d =>
        artists.filter(a => a.day === d).sort((x, y) => (y.tier || 0) - (x.tier || 0) || x.id.localeCompare(y.id))[0]?.id),
      ...artists.filter((_, i) => i % 9 === 0).map(a => a.id),
    ].filter(Boolean))];
    const heard = artists.filter((_, i) => i % 13 === 5).map(a => a.name);
    const args = { artists, savedIds: saved, affinityNames: heard, stages: ds.stages || [] };
    const p = plan(args);
    const tag = `${fid}:`;
    const savedSet = new Set(saved);
    const seedNames = new Set(p.seeds.map(s => s.artist.name.trim().toLowerCase()));
    const distinctSavedNames = new Set(saved.map(id => artists.find(a => a.id === id)?.name.trim().toLowerCase()));
    check(`${tag} every saved act is a seed`, seedNames.size === distinctSavedNames.size, `${seedNames.size} of ${distinctSavedNames.size}`);
    check(`${tag} picks within cap`, p.picks.length <= p.cap && p.cap <= 8, `${p.picks.length}/${p.cap}`);
    check(`${tag} cap filled when candidates exist`, p.picks.length === Math.min(p.cap, p.candidates.length));
    check(`${tag} order holds seeds and picks exactly once`, p.order.length === p.seeds.length + p.picks.length &&
      new Set(p.order.map(o => o.artist.id)).size === p.order.length);
    check(`${tag} deterministic`, JSON.stringify(plan(args)) === JSON.stringify(p));
    let lastDay = -1;
    for (const o of p.order) { const d = o.artist.day ?? 99; check(`${tag} order runs night by night`, d >= lastDay, `${o.artist.id} day ${d} after ${lastDay}`); lastDay = d; }
    for (const c of p.candidates) {
      const a = c.artist, why = `${a.id} "${a.name}" → ${c.kind}: ${c.reason}`;
      check(`${tag} candidate is unsaved`, !savedSet.has(a.id), why);
      check(`${tag} candidate is not a seed act`, !seedNames.has(a.name.trim().toLowerCase()), why);
      check(`${tag} candidate has a reason`, typeof c.reason === "string" && c.reason.length > 3, why);
      if (c.kind === "adjacent") {
        // Match the WHOLE reason: a substring test let "MCR-T on" pick the solo
        // MCR-T seed for "Right before DJ Gigola b2b MCR-T on CSM".
        const st = (ds.stages || []).find(s => s.id === a.stage);
        const stShort = st?.short || st?.name || a.stage;
        const seed = p.seeds.find(s => c.reason === `Right after ${s.artist.name} on ${stShort}` ||
                                       c.reason === `Right before ${s.artist.name} on ${stShort}`)?.artist;
        const ok = seed && seed.stage === a.stage && seed.day === a.day &&
          (!seed.weekend || !a.weekend || seed.weekend === "both" || a.weekend === "both" || seed.weekend === a.weekend) &&
          (() => { const as = nightMin(a.start), ae = nightMin(a.end), ss = nightMin(seed.start), se = nightMin(seed.end);
                   return (as >= se && as - se <= 30) || (ae <= ss && ss - ae <= 30); })();
        check(`${tag} adjacent reason is true`, ok, why);
      }
      if (c.kind === "stage") {
        const n = p.seeds.filter(s => s.artist.stage === a.stage).length;
        check(`${tag} stage reason is true`, n >= 2 && c.reason.endsWith(`saved ${n} sets`), why);
      }
      if (c.kind === "listen") {
        const parts = ctx._b2bParts(a.name).map(s => s.trim().toLowerCase());
        check(`${tag} listen reason is true`, parts.some(x => heard.some(h => h.trim().toLowerCase() === x)), why);
      }
      if (c.kind === "b2b") {
        const parts = ctx._b2bParts(a.name).map(s => s.trim().toLowerCase());
        const seedParts = new Set(p.seeds.flatMap(s => ctx._b2bParts(s.artist.name).map(x => x.trim().toLowerCase())));
        check(`${tag} b2b reason is true`, parts.some(x => seedParts.has(x)) && !parts.every(x => seedParts.has(x)), why);
      }
    }
    swept++; pickTotal += p.picks.length;
  }
  check("sweep: covered the registered lineups", swept >= 10, `${swept} lineup(s)`);
  said.push(`${swept} lineup(s) swept — ${pickTotal} pick(s), every one unsaved, capped, deterministic and truly reasoned`);
}

// ── 4. Adapter: every plan entry reaches the playlist, in order ──────────
{
  const four = Object.entries(ctx._DATA_SETS || {})
    .filter(([, ds]) => Object.keys(ds.config?.dayDates || {}).length >= 4 && (ds.artists || []).some(a => a.day === 4 && a.start))
    .map(([id]) => id).sort()[0];
  check("adapter: a 4-day festival exists to test on", !!four);
  const c = four && boot({ active_festival_id: four, active_festival_explicit: "1" });
  if (c) {
    // Granted AFTER boot: app boot clears a stale scope record, and a build
    // without playlist-modify returns "reconnect" before touching tracks.
    c.localStorage.setItem("spotify_auth_scopes", "playlist-modify-private");
    check("adapter: booted the 4-day festival", c.FESTIVAL_CONFIG?.id === four, `booted ${c.FESTIVAL_CONFIG?.id}`);
    const top = d => c.ARTISTS.filter(a => a.day === d && a.start).sort((x, y) => (y.tier || 0) - (x.tier || 0) || x.id.localeCompare(y.id))[0];
    const days = c.festivalDayNums();
    c.ARTISTS.push({ id: "zz-unsched", name: "Zz Unscheduled", stage: null, day: null, start: "", end: "", tier: 1 });
    const saved = [top(days[0]).id, top(days[days.length - 1]).id, "zz-unsched"];
    let writes = [];
    c.getValidToken = async () => "tok";
    c.ensureSpotifyProfile = async () => ({ id: "me" });
    c.fetch = async (url, init = {}) => {
      const res = body => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
      const u = new URL(url);
      if (u.pathname === "/v1/me/playlists") return res({ items: [{ id: "pl", name: "Plursky", owner: { id: "me" }, external_urls: { spotify: "https://open.spotify.com/playlist/pl" } }] });
      if (u.pathname === "/v1/search") {
        const name = /artist:"([^"]+)"/.exec(u.searchParams.get("q") || "")?.[1] || "";
        return res({ tracks: { items: [1, 2, 3, 4, 5, 6].map(n => ({ uri: `spotify:track:${name}#${n}`, artists: [{ id: `id-${name}`, name }] })) } });
      }
      if (u.pathname === "/v1/playlists/pl/tracks") { writes.push(...JSON.parse(init.body).uris); return res({}); }
      return res({});
    };
    const build = c.createSetsPlaylist || c.createEdcPlaylist;
    const clean = n => (c._lookupName?.(n) || n);
    const firstAt = a => Math.min(...c._b2bParts(a.name).map(p => writes.findIndex(u => u.startsWith(`spotify:track:${clean(p.trim())}#`))).filter(i => i >= 0));
    const r = await build({ saved }, {});
    check("adapter: plain build succeeds", r?.ok, JSON.stringify(r));
    for (const id of saved) {
      const a = c.ARTISTS.find(x => x.id === id);
      check(`adapter: plain build writes ${id} (day ${a.day ?? "unscheduled"})`, Number.isFinite(firstAt(a)), `${a.name} has no tracks in the playlist`);
    }
    if (!ADAPTER_ONLY) {
      const pool = c.ARTISTS.filter(a => !saved.includes(a.id) && a.day != null && a.start);
      const p = c.planBoardPlaylist({ artists: c.ARTISTS, savedIds: saved, affinityNames: pool.filter((_, i) => i % 11 === 3).map(a => a.name), stages: c.STAGES });
      check("adapter: the board plan has picks to write", p.picks.length > 0, `cap ${p.cap}, ${p.candidates.length} candidate(s)`);
      writes = [];
      const r2 = await build({ saved }, { plan: p });
      check("adapter: board build succeeds", r2?.ok && r2.total === p.seeds.length && r2.picks === p.picks.length, JSON.stringify({ ok: r2?.ok, total: r2?.total, picks: r2?.picks }));
      check("adapter: per-entry outcome covers the plan", (r2.entries || []).map(e => e.id).join() === p.order.map(o => o.artist.id).join());
      const at = p.order.map(o => firstAt(o.artist));
      check("adapter: every plan entry is written", at.every(Number.isFinite), p.order.filter((o, i) => !Number.isFinite(at[i])).map(o => o.artist.name).join(", "));
      check("adapter: tracks land in plan order", at.every((x, i) => i === 0 || x > at[i - 1]), at.join(","));
      for (const pk of p.picks) {
        const n = (r2.entries || []).find(e => e.id === pk.artist.id)?.tracks;
        check(`adapter: pick ${pk.artist.id} gets ${pk.trackLimit} tracks`, n === pk.trackLimit * c._b2bParts(pk.artist.name).length, `got ${n}`);
      }
    }
    said.push(`adapter on ${four}: day ${days[0]}, day ${days[days.length - 1]} and an unscheduled act all written${ADAPTER_ONLY ? "" : "; the board plan's seeds and picks written in plan order"}`);
  }
}

if (bad.length) {
  for (const b of bad.slice(0, 40)) console.log(`  ✗ ${b}`);
  console.error(`✗ board playlist: ${bad.length} failure(s)`);
  process.exit(1);
}
for (const s of said) console.log(`  ✓ ${s}`);

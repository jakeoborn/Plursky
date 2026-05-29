// ─────────────────────────────────────────────────────────────────
// spotify-api.jsx — Spotify + Apple Music integration (monolith split 2/N)
// Extracted verbatim from spotify.jsx.
//
// Pure logic, no React components: Apple Music (MusicKit) connect/fetch,
// Spotify PKCE auth + token refresh + profile, playlist creation
// (createEdcPlaylist / createHypePlaylist), Spotify data fetching
// (top artists / followed / preview URLs), and lineup matching + genre
// analysis + discovery scoring.
//
// Cross-file contract (unchanged): top-level decls are global across these
// babel scripts, so bare call sites in app/artist/supabase
// (startSpotifyAuth, getValidToken, getSpotifyProfileSync,
// ensureSpotifyProfile, fetchPreviewUrl) resolve at runtime regardless of
// load order. window-exported names below match what spotify.jsx exported
// for this cluster before the split. Loaded before spotify.jsx.
// ─────────────────────────────────────────────────────────────────

// ── Apple Music ───────────────────────────────────────────────
// Requires an Apple Developer account + MusicKit identifier.
// 1. enroll.developer.apple.com → create a MusicKit key
// 2. Sign a developer JWT (6-month expiry) — paste below.
// Guide: https://developer.apple.com/documentation/musickit
const APPLE_DEV_TOKEN = "";

let _mkReady = false;
let _mkLoadP  = null;
function _loadMusicKit() {
  if (_mkReady) return Promise.resolve();
  if (_mkLoadP)  return _mkLoadP;
  _mkLoadP = new Promise((res, rej) => {
    const s   = document.createElement("script");
    s.src     = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
    s.onload  = () => { _mkReady = true; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return _mkLoadP;
}

async function connectAppleMusic() {
  if (!APPLE_DEV_TOKEN) return { error: "not_configured" };
  try {
    await _loadMusicKit();
    await MusicKit.configure({
      developerToken: APPLE_DEV_TOKEN,
      app: { name: "Plursky", build: "1.0.0" },
    });
    const music = MusicKit.getInstance();
    await music.authorize();
    const ut = music.musicUserToken;
    if (!ut) return { error: "No user token — authorization may have been denied." };
    localStorage.setItem("am_user_token", ut);
    return { ok: true };
  } catch (e) {
    return { error: e?.message || "Authorization failed" };
  }
}

function disconnectAppleMusic() {
  localStorage.removeItem("am_user_token");
  if (typeof MusicKit !== "undefined") {
    try { MusicKit.getInstance().unauthorize(); } catch {}
  }
}

// Paginate through the user's entire Apple Music library and return
// a flat array of {name} objects (one per unique artist).
async function fetchAppleMusicArtists() {
  const ut  = localStorage.getItem("am_user_token");
  if (!ut || !APPLE_DEV_TOKEN) return null;
  const headers = {
    Authorization:    `Bearer ${APPLE_DEV_TOKEN}`,
    "Music-User-Token": ut,
  };
  const seen    = new Set();
  const artists = [];
  let offset = 0;
  try {
    while (true) {
      const res = await fetch(
        `https://api.music.apple.com/v1/me/library/artists?limit=100&offset=${offset}`,
        { headers }
      );
      if (!res.ok) {
        if (res.status === 401) localStorage.removeItem("am_user_token");
        break;
      }
      const json  = await res.json();
      const items = json.data || [];
      items.forEach(a => {
        const name = a.attributes?.name;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          artists.push({ name });
        }
      });
      if (!json.next || items.length < 100) break;
      offset += 100;
    }
    return artists;
  } catch { return []; }
}

function _appleMusicConfigured() { return !!APPLE_DEV_TOKEN; }

// Build an Apple Music playlist from saved/attended sets. The big win over
// Spotify: the Apple Music API has NO Development-Mode 5-user cap and NO
// playlist-creation block — any Apple Music subscriber can authorize and we
// POST /me/library/playlists directly. Inert until APPLE_DEV_TOKEN is set
// (see top of file). Mirrors createEdcPlaylist: day-ordered FRI→SAT→SUN,
// more tracks for higher-tier acts.
async function createAppleMusicPlaylist(state, opts = {}) {
  const prog = (m) => { if (opts.onProgress) opts.onProgress(m); };
  if (!APPLE_DEV_TOKEN) return { ok: false, reason: "not_configured" };

  let ut = null;
  try { ut = localStorage.getItem("am_user_token"); } catch {}
  if (!ut) {
    const c = await connectAppleMusic();           // prompts MusicKit authorize
    if (!c.ok) return { ok: false, reason: "not_connected", message: c.error };
    try { ut = localStorage.getItem("am_user_token"); } catch {}
  }
  if (!ut) return { ok: false, reason: "not_connected" };

  const devHeaders  = { Authorization: `Bearer ${APPLE_DEV_TOKEN}` };
  const userHeaders = { ...devHeaders, "Music-User-Token": ut };

  const source = opts.source === "attended" ? "attended" : "saved";
  const sourceIds = source === "attended"
    ? Object.values(window.getAllAttended?.() || {}).flat()
    : (state.saved || []);
  const saved = sourceIds.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean);
  if (!saved.length) return { ok: false, reason: "empty" };

  const timeKey = hhmm => { const h = parseInt(hhmm); return h < 6 ? h + 24 : h; };
  const sorted = [...saved].sort((a, b) =>
    a.day !== b.day ? a.day - b.day : timeKey(a.start) - timeKey(b.start)
  );
  const trackLimit = tier => tier === 3 ? 5 : tier === 2 ? 4 : 3;

  // Storefront drives which catalog we search; default to US if lookup fails.
  let storefront = "us";
  try {
    const sr = await fetch("https://api.music.apple.com/v1/me/storefront", { headers: userHeaders });
    if (sr.ok) { const sj = await sr.json(); storefront = sj.data?.[0]?.id || "us"; }
  } catch {}

  // Resolve each saved artist to catalog song IDs, kept in set order.
  const tracks = [];
  const seen = new Set();
  let missed = 0;
  for (const a of sorted) {
    prog(`Finding ${a.name}…`);
    try {
      const r = await fetch(
        `https://api.music.apple.com/v1/catalog/${storefront}/search?types=songs&limit=15&term=${encodeURIComponent(a.name)}`,
        { headers: devHeaders }
      );
      if (!r.ok) { missed++; continue; }
      const j = await r.json();
      const songs = j.results?.songs?.data || [];
      const ln = a.name.toLowerCase();
      const byArtist = songs.filter(s => (s.attributes?.artistName || "").toLowerCase().includes(ln));
      const pool = byArtist.length ? byArtist : songs.slice(0, 1);
      let added = 0;
      for (const s of pool) {
        if (added >= trackLimit(a.tier)) break;
        if (s.id && !seen.has(s.id)) { seen.add(s.id); tracks.push({ id: s.id, type: "songs" }); added++; }
      }
      if (!added) missed++;
    } catch { missed++; }
  }
  if (!tracks.length) return { ok: false, reason: "no_tracks" };

  prog("Creating playlist…");
  const CFG = window.FESTIVAL_CONFIG || {};
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const res = await fetch("https://api.music.apple.com/v1/me/library/playlists", {
    method: "POST",
    headers: { ...userHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      attributes: {
        name: `${CFG.shortName || "Festival"} — Plursky`,
        description: `${saved.length} sets · headliners deep · FRI→SAT→SUN · built with Plursky · ${dateStr}`,
      },
      relationships: { tracks: { data: tracks } },
    }),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      try { localStorage.removeItem("am_user_token"); } catch {}
      return { ok: false, reason: "reconnect", status: res.status };
    }
    return { ok: false, reason: "create_fail", status: res.status };
  }
  let id = null;
  try { const j = await res.json(); id = j.data?.[0]?.id || null; } catch {}
  return { ok: true, service: "apple", added: tracks.length, missed, id };
}

// ShazamKit bridge — iOS only, auto-detects via Capacitor
if (window.Capacitor?.isNativePlatform()) {
  try {
    window.ShazamPlugin = window.Capacitor.Plugins.ShazamPlugin || null;
  } catch { window.ShazamPlugin = null; }
} else {
  window.ShazamPlugin = null;
}


const SPOTIFY_CLIENT_ID     = "2219c68606c54629a8799f467a996a81";
const SPOTIFY_REDIRECT_WEB  = "https://plursky.com/callback";
// v132: native iOS uses a custom URL scheme so Spotify's redirect comes back
// INTO the app via Capacitor's appUrlOpen listener (vs. dumping the user
// into a web tab at the wrong origin). Requires:
//   • Info.plist registers the `plursky` URL scheme (see CFBundleURLTypes)
//   • Spotify dashboard adds `plursky://callback` to Redirect URIs
function _isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.();
}
const SPOTIFY_REDIRECT_NATIVE = "plursky://callback";
function _spotifyRedirectUri() {
  return _isNativeApp() ? SPOTIFY_REDIRECT_NATIVE : SPOTIFY_REDIRECT_WEB;
}
// Back-compat alias — pre-v132 code referenced SPOTIFY_REDIRECT directly.
const SPOTIFY_REDIRECT = SPOTIFY_REDIRECT_WEB;
const SPOTIFY_SCOPES    = "user-top-read user-read-recently-played user-library-read user-read-private user-read-email user-follow-read playlist-read-private playlist-modify-public playlist-modify-private";

// Genre keywords → EDC stage affinity
const STAGE_GENRES = {
  kinetic:  ["big room", "progressive house", "electro house", "edm", "dutch", "future house", "pop dance"],
  cosmic:   ["melodic bass", "future bass", "breakbeat", "big beat", "melodic", "indie electronic"],
  circuit:  ["techno", "melodic techno", "minimal techno", "industrial techno", "dark techno", "detroit techno"],
  neon:     ["house", "deep house", "afro house", "acid house", "organic house", "microhouse"],
  quantum:  ["trance", "psytrance", "uplifting trance", "vocal trance", "progressive trance", "goa"],
  stereo:   ["tech house", "bass house", "slap house", "uk house", "underground"],
  bionic:   ["indie dance", "nu disco", "french house", "electro", "uk garage", "disco"],
  basspod:  ["dubstep", "riddim", "uk bass", "brostep", "drum and bass", "dnb", "liquid dnb", "bass music"],
  waste:    ["hardstyle", "hardcore", "uptempo", "hard dance", "gabber", "rawstyle"],
};

// ── PKCE helpers ─────────────────────────────────────────────
// crypto.getRandomValues is available everywhere we care about; if not we
// fall back to Math.random (only called for the verifier, which is opaque).
function _randString(n) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
  } else {
    for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// Pure-JS SHA-256 — drop-in fallback for environments where
// crypto.subtle.digest is missing (Safari over HTTP, some installed-PWA
// webviews, etc.). Returns an ArrayBuffer of 32 bytes.
const _SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]);
function _sha256js(str) {
  const utf8 = new TextEncoder().encode(str);
  const len = utf8.length;
  const paddedLen = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(paddedLen);
  buf.set(utf8);
  buf[len] = 0x80;
  const bitLen = len * 8;
  buf[paddedLen - 4] = (bitLen >>> 24) & 0xff;
  buf[paddedLen - 3] = (bitLen >>> 16) & 0xff;
  buf[paddedLen - 2] = (bitLen >>> 8) & 0xff;
  buf[paddedLen - 1] = bitLen & 0xff;
  const H = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = (buf[i+t*4]<<24) | (buf[i+t*4+1]<<16) | (buf[i+t*4+2]<<8) | buf[i+t*4+3];
    }
    for (let t = 16; t < 64; t++) {
      const x = W[t-15], y = W[t-2];
      const s0 = ((x>>>7)|(x<<25)) ^ ((x>>>18)|(x<<14)) ^ (x>>>3);
      const s1 = ((y>>>17)|(y<<15)) ^ ((y>>>19)|(y<<13)) ^ (y>>>10);
      W[t] = (W[t-16] + s0 + W[t-7] + s1) >>> 0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
      const ch = (e & f) ^ ((~e) & g);
      const T1 = (h + S1 + ch + _SHA256_K[t] + W[t]) >>> 0;
      const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const T2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + T1) >>> 0;
      d = c; c = b; b = a; a = (T1 + T2) >>> 0;
    }
    H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i*4]   = (H[i] >>> 24) & 0xff;
    out[i*4+1] = (H[i] >>> 16) & 0xff;
    out[i*4+2] = (H[i] >>> 8)  & 0xff;
    out[i*4+3] =  H[i]         & 0xff;
  }
  return out.buffer;
}

async function _sha256(plain) {
  // Prefer WebCrypto when available; fall back to pure JS otherwise.
  // Some Safari/PWA contexts expose `crypto` but `crypto.subtle` is undefined.
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    try {
      return await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
    } catch {
      // fall through to JS fallback
    }
  }
  return _sha256js(plain);
}
function _b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// iOS PWA + Android TWA in "standalone" mode have their own localStorage
// silo. OAuth redirects break out to the system browser, which can't see
// the PKCE verifier we just saved → connect fails. Detect that case and
// warn the user before redirecting.
function isStandalonePWA() {
  return (typeof window !== "undefined") &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
     window.navigator.standalone === true);
}
function isMobile() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

// Build the Spotify authorize URL + persist the PKCE verifier. We pre-warm
// this on module load so the eventual click handler can navigate
// synchronously — iOS Safari silently blocks redirects that happen *after*
// `await` chains in click handlers (the user-gesture token expires).
async function _buildSpotifyAuthUrl() {
  const verifier  = _randString(128);
  const challenge = _b64url(await _sha256(verifier));
  // Persist in BOTH stores. iOS Safari occasionally drops one across the
  // auth-domain redirect; the other usually survives.
  try { localStorage.setItem("spotify_pkce_verifier", verifier); } catch {}
  try { sessionStorage.setItem("spotify_pkce_verifier", verifier); } catch {}
  // Note: `spotify_auth_scopes` is the GRANTED-scope record, not the requested
  // one — only callback.html writes it (after the token exchange returns the
  // actual `scope` field). Writing here would falsely promise scopes that
  // Spotify might silently downgrade if the user denied any.
  const params = new URLSearchParams({
    client_id:             SPOTIFY_CLIENT_ID,
    response_type:         "code",
    redirect_uri:          _spotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge:        challenge,
    scope:                 SPOTIFY_SCOPES,
    // Force the consent screen even for previously-authorized users so newly
    // added scopes (playlist-read-private etc.) actually get granted instead
    // of Spotify silently re-issuing a token with the old scope set.
    show_dialog:           "true",
  });
  return "https://accounts.spotify.com/authorize?" + params;
}

// v132 native OAuth: exchange the auth code for a token in-process. On the
// web this is done by callback.html; on native we never hit a web page so
// we replicate the logic here. Records the granted scope + caches profile.
async function _spotifyExchangeCode(code, redirectUri) {
  const verifier =
    localStorage.getItem("spotify_pkce_verifier") ||
    sessionStorage.getItem("spotify_pkce_verifier");
  if (!verifier) return { error: "session_lost" };
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     SPOTIFY_CLIENT_ID,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        code_verifier: verifier,
      }),
    });
    const data = await res.json();
    if (!data.access_token) return { error: data.error_description || data.error || "no_token" };
    try {
      localStorage.setItem("spotify_token",         data.access_token);
      localStorage.setItem("spotify_refresh_token", data.refresh_token || "");
      localStorage.setItem("spotify_expires",       Date.now() + data.expires_in * 1000);
      if (data.scope) localStorage.setItem("spotify_auth_scopes", data.scope);
      localStorage.removeItem("spotify_pkce_verifier");
      sessionStorage.removeItem("spotify_pkce_verifier");
    } catch {}
    // Pre-fetch profile so home/me screens render personalised on first paint.
    try {
      const profRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: "Bearer " + data.access_token },
      });
      if (profRes.ok) {
        const p = await profRes.json();
        localStorage.setItem("spotify_profile", JSON.stringify({
          id: p.id,
          name: p.display_name || p.id,
          email: p.email || null,
          image: p.images?.[0]?.url || null,
          country: p.country || null,
          product: p.product || null,
        }));
      }
    } catch {}
    return { ok: true };
  } catch (e) {
    return { error: e?.message || "network" };
  }
}

// Capacitor's appUrlOpen fires when iOS hands a `plursky://...` URL to the
// app. We listen for `plursky://callback?code=...` here, run the token
// exchange, close the in-app browser, and notify React via a custom event
// the SpotifyScreen (and Me-tab account card) listen for.
let _spotifyNativeHandlerRegistered = false;
function _registerNativeSpotifyHandler() {
  if (_spotifyNativeHandlerRegistered) return;
  const App = window.Capacitor?.Plugins?.App;
  const Browser = window.Capacitor?.Plugins?.Browser;
  if (!App?.addListener) return;
  _spotifyNativeHandlerRegistered = true;
  App.addListener("appUrlOpen", async (event) => {
    const url = event?.url || "";
    if (!/^plursky:\/\/callback/i.test(url)) return;
    let parsed;
    try { parsed = new URL(url); } catch { return; }
    const code  = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error");
    // Close the in-app SafariViewController; user lands back in Plursky.
    try { await Browser?.close?.(); } catch {}
    if (error || !code) {
      _spotifyDebugToast("Spotify connect cancelled.", "#9b1c1c");
      try { window.dispatchEvent(new CustomEvent("plursky-spotify-connect", { detail: { error: error || "no_code" } })); } catch {}
      return;
    }
    const { error: exErr } = await _spotifyExchangeCode(code, SPOTIFY_REDIRECT_NATIVE);
    if (exErr) {
      _spotifyDebugToast("Spotify connect failed: " + exErr, "#9b1c1c");
      try { window.dispatchEvent(new CustomEvent("plursky-spotify-connect", { detail: { error: exErr } })); } catch {}
      return;
    }
    // Success — React state lives one layer up; broadcast and let listeners
    // setState({ spotifyConnected: true, spotifyProfile: ... }).
    try { window.dispatchEvent(new CustomEvent("plursky-spotify-connect", { detail: { ok: true } })); } catch {}
  });
}
if (typeof window !== "undefined") _registerNativeSpotifyHandler();

// Cached URL ready by the time the user actually taps CONNECT.
let _SPOTIFY_AUTH_URL = null;
let _SPOTIFY_AUTH_ERR = null;
function _prewarmSpotifyAuth() {
  _SPOTIFY_AUTH_URL = null;
  _SPOTIFY_AUTH_ERR = null;
  return _buildSpotifyAuthUrl()
    .then(u => { _SPOTIFY_AUTH_URL = u; })
    .catch(e => { _SPOTIFY_AUTH_ERR = e; });
}
// Kick off immediately at module load.
if (typeof window !== "undefined") _prewarmSpotifyAuth();

// One-shot v80 migration: pre-v80 versions wrote the REQUESTED scope string
// (not the granted one) to spotify_auth_scopes on every page load, falsely
// promising playlist-modify scopes the running token may not have. Wipe it
// for any user who hasn't migrated yet — _hasPlaylistWriteScope will then
// correctly fail-closed and prompt reconnect.
if (typeof window !== "undefined") {
  try {
    if (!localStorage.getItem("plursky_scope_migration_v80")) {
      localStorage.removeItem("spotify_auth_scopes");
      localStorage.setItem("plursky_scope_migration_v80", "1");
    }
  } catch {}
}

// Tiny visible toast — used when something silently goes wrong on iOS.
// We DOM-inject so it works even if React state is in a bad place.
function _spotifyDebugToast(text, color) {
  try {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText = `
      position:fixed;left:50%;bottom:80px;transform:translateX(-50%);
      background:${color || "#1a120d"};color:#f7ede0;
      padding:10px 14px;border-radius:10px;
      font:12px/1.4 'Geist Mono',monospace;letter-spacing:.4px;
      z-index:99999;max-width:88%;text-align:center;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  } catch {}
}

function startSpotifyAuth() {
  // Native iOS (Capacitor): open the auth URL in an in-app SafariViewController
  // via @capacitor/browser. Spotify redirects back to `plursky://callback?code=…`,
  // which iOS hands to the app via App.appUrlOpen — handled by the listener
  // registered at module load. The in-browser SafariViewController also keeps
  // the user's existing Spotify session cookie from Safari, so most users get
  // a one-tap "Allow" sheet instead of a full email/password form.
  if (_isNativeApp()) {
    const Browser = window.Capacitor?.Plugins?.Browser;
    if (!Browser?.open) {
      _spotifyDebugToast("Spotify connect needs an app update.", "#9b1c1c");
      return;
    }
    const go = (url) => {
      Browser.open({ url, presentationStyle: "popover" }).catch(err => {
        _spotifyDebugToast("Spotify connect failed: " + (err?.message || err), "#9b1c1c");
      });
    };
    if (_SPOTIFY_AUTH_URL) { go(_SPOTIFY_AUTH_URL); return; }
    _spotifyDebugToast("Preparing Spotify…", "#1a120d");
    _buildSpotifyAuthUrl().then(go).catch(err => {
      _spotifyDebugToast("Spotify connect failed: " + (err?.message || err), "#9b1c1c");
    });
    return;
  }

  // Web (plursky.com): Mobile-PWA OAuth gotcha — installed-PWA standalone mode
  // has its own localStorage silo that the system browser can't see, so the
  // PKCE verifier we just wrote is unreachable after redirect. Warn and let
  // the user opt out.
  if (isStandalonePWA() && isMobile()) {
    const ack = confirm(
      "Heads up: Spotify login is more reliable in your phone's browser " +
      "than in this installed app.\n\n" +
      "Tap OK to continue here (may fail), or Cancel and open plursky.com " +
      "in Safari/Chrome to connect there first."
    );
    if (!ack) return;
  }

  // Fast path: URL is already pre-computed → navigate synchronously inside
  // the user-gesture handler. This is what iOS Safari needs.
  if (_SPOTIFY_AUTH_URL) {
    window.location.assign(_SPOTIFY_AUTH_URL);
    return;
  }

  // The pre-warm failed earlier — surface it so we don't fail silently.
  if (_SPOTIFY_AUTH_ERR) {
    _spotifyDebugToast(
      "Spotify init failed: " + (_SPOTIFY_AUTH_ERR.message || _SPOTIFY_AUTH_ERR),
      "#9b1c1c"
    );
    _prewarmSpotifyAuth(); // try again in the background
    return;
  }

  // Pre-warm hasn't resolved yet (unusual — sha256 is sub-millisecond).
  // Compute now and navigate when ready; if it never finishes we toast.
  _spotifyDebugToast("Preparing Spotify…", "#1a120d");
  _buildSpotifyAuthUrl()
    .then(url => { window.location.assign(url); })
    .catch(err => {
      _spotifyDebugToast(
        "Spotify connect failed: " + (err && err.message ? err.message : "unknown"),
        "#9b1c1c"
      );
    });
}

function disconnectSpotify(setState, state) {
  // Keep spotify_pkce_verifier — startSpotifyAuth() may be called immediately
  // after disconnect (reconnect flow) and still needs the pre-warmed verifier.
  // callback.html removes it after a successful token exchange.
  ["spotify_token","spotify_refresh_token","spotify_expires","spotify_profile",
   "spotify_auth_scopes"]
    .forEach(k => localStorage.removeItem(k));
  // Drop cached scan results — stale data with old (limited) scopes would
  // otherwise persist and the user wouldn't see the playlist-matched artists
  // appear after reconnecting with the broader scope set.
  setState({ ...state, spotifyConnected: false, spotifyProfile: null });
}

// Returns a valid access token, silently refreshing via the refresh token if expired.
// Returns null if no token and no refresh token (user must reconnect).
async function getValidToken() {
  const token = localStorage.getItem("spotify_token");
  const expires = localStorage.getItem("spotify_expires");
  if (token && expires && Date.now() < parseInt(expires) - 60000) return token;
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     SPOTIFY_CLIENT_ID,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    localStorage.setItem("spotify_token",   data.access_token);
    localStorage.setItem("spotify_expires", Date.now() + data.expires_in * 1000);
    if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
    return data.access_token;
  } catch { return null; }
}

// Read the cached Spotify profile (set by callback.html on first connect).
// Falls back to fetching /me if missing — runs lazily on demand.
function getSpotifyProfileSync() {
  try {
    const raw = localStorage.getItem("spotify_profile");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function ensureSpotifyProfile() {
  const cached = getSpotifyProfileSync();
  if (cached) return cached;
  const token = await getValidToken();
  if (!token) return null;
  try {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) return null;
    const p = await res.json();
    const prof = {
      id: p.id,
      name: p.display_name || p.id,
      email: p.email || null,
      image: p.images?.[0]?.url || null,
      country: p.country || null,
      product: p.product || null,
    };
    localStorage.setItem("spotify_profile", JSON.stringify(prof));
    return prof;
  } catch { return null; }
}

// Pick the right artist when Spotify returns multiple name collisions.
// E.g. "Westend" (EDC tech-house DJ) vs "Westend" (rock band). Strategy:
// exact-name matches first; among those, prefer electronic genres; tie-break
// by Spotify popularity. Falls back to substring matches if no exact hit.
const _ELECTRONIC_HINTS = ["electronic","dance","edm","house","techno","trance","dubstep","bass","garage","hardstyle","breakbeat","trap","electro","club","rave","tech","ambient","downtempo","progressive","jungle","phonk","riddim","dnb","drum and bass","drum & bass","psytrance","synthwave","moombahton","nu-disco","disco","hardcore","dance-pop"];
function _isElectronicArtist(a) {
  const gs = a?.genres || [];
  if (gs.length === 0) return false;
  return gs.some(g => {
    const lower = String(g).toLowerCase();
    return _ELECTRONIC_HINTS.some(k => lower.includes(k));
  });
}
function _pickArtistMatch(items, ln) {
  if (!items || items.length === 0) return null;
  const byPop = arr => [...arr].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  const exact = items.filter(a => a.name.toLowerCase() === ln);
  if (exact.length) {
    const elec = exact.filter(_isElectronicArtist);
    return (elec.length ? byPop(elec) : byPop(exact))[0];
  }
  const partial = items.filter(a =>
    a.name.toLowerCase().includes(ln) || ln.includes(a.name.toLowerCase())
  );
  if (partial.length) {
    const elec = partial.filter(_isElectronicArtist);
    return (elec.length ? byPop(elec) : byPop(partial))[0];
  }
  return null;
}

// Tokens issued by app versions <= v53 don't carry playlist-modify scopes —
// refreshing inherits the original (limited) scope set, so the only fix is
// a fresh OAuth grant. We detect this up-front to skip a guaranteed 403.
function _hasPlaylistWriteScope() {
  let s = "";
  try { s = localStorage.getItem("spotify_auth_scopes") || ""; } catch {}
  // Treat unknown (legacy connection, never recorded) as "missing" — better to
  // ask the user to reconnect than to round-trip the API and 403.
  if (!s) return false;
  return s.includes("playlist-modify-public") || s.includes("playlist-modify-private");
}

// Find a user-owned playlist whose name starts with "plursky" (case-insensitive).
// Falls back from a cached ID. Returns one of:
//   { playlist }                    — found
//   { error: "not_found" }          — searched all pages, none matched
//   { error: "rate_limited" }       — 429 (often after heavy API churn)
//   { error: "fetch_failed", status } — other non-ok response
// Used because POST /users/{id}/playlists is blocked for Spotify Development
// Mode apps (post-Nov 2024) — the user creates a "Plursky" playlist manually
// once, then modify-existing endpoints (which are NOT restricted) take over.
async function _findPlurskyPlaylist(token, profileId) {
  // Brief retry helper for transient 429s — Spotify's rate limit windows are
  // short (seconds), so two retries with backoff usually clears them.
  const fetchWithRetry = async (url) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (r.status !== 429) return r;
      const retryAfter = parseInt(r.headers.get("Retry-After") || "2");
      const wait = Math.min(retryAfter * 1000, 4000) + attempt * 500;
      if (attempt < 2) await new Promise(res => setTimeout(res, wait));
    }
    return null;
  };

  let cachedId = null;
  try { cachedId = localStorage.getItem("plursky_target_playlist_id"); } catch {}
  if (cachedId) {
    try {
      const r = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${cachedId}`);
      if (r?.ok) {
        const candidate = await r.json();
        if (candidate?.owner?.id === profileId) return { playlist: candidate };
      }
    } catch {}
    try { localStorage.removeItem("plursky_target_playlist_id"); } catch {}
  }
  for (let offset = 0; offset < 200; offset += 50) {
    const r = await fetchWithRetry(
      `https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`
    );
    if (!r) return { error: "rate_limited" };
    if (!r.ok) return { error: "fetch_failed", status: r.status };
    const j = await r.json();
    const items = j.items || [];
    const found = items.find(p =>
      p?.owner?.id === profileId &&
      typeof p?.name === "string" &&
      p.name.trim().toLowerCase().startsWith("plursky")
    );
    if (found) return { playlist: found };
    if (items.length < 50) break;
  }
  return { error: "not_found" };
}

// Auto-create the user's "Plursky" playlist via POST. Succeeds when the app
// has Spotify Extended Quota Mode (or the account is on the dev allowlist).
// Development Mode 403s this — callers then fall back to asking the user to
// create the playlist by hand, after which _findPlurskyPlaylist takes over.
// Returns { playlist } | { error: "forbidden", status } | { error: "fetch_failed", status }
async function _createPlurskyPlaylist(token, profileId) {
  try {
    const r = await fetch(`https://api.spotify.com/v1/users/${profileId}/playlists`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Plursky",
        description: "Your festival sets · built with Plursky · plursky.com",
        public: false,
      }),
    });
    if (r.ok) return { playlist: await r.json() };
    if (r.status === 401 || r.status === 403) return { error: "forbidden", status: r.status };
    return { error: "fetch_failed", status: r.status };
  } catch {
    return { error: "fetch_failed", status: 0 };
  }
}

// #12 Build my playlist — push the user's saved EDC sets into their existing
// "Plursky" Spotify playlist (created manually, see _findPlurskyPlaylist).
// Skips artists Spotify can't find.
async function createEdcPlaylist(state, opts = {}) {
  const source = opts.source === "attended" ? "attended" : "saved";
  const token   = await getValidToken();
  const profile = await ensureSpotifyProfile();
  if (!token || !profile) return { ok: false, reason: "not_connected" };
  if (!_hasPlaylistWriteScope()) return { ok: false, reason: "reconnect", status: 403, message: "Need to reconnect for playlist permission" };

  // v147: "attended" variant pulls from the attendance store (plursky_attended_v1)
  // instead of the saved set — turns Recap into a one-tap "make a playlist of what
  // I actually caught this weekend" button.
  const sourceIds = source === "attended"
    ? Object.values(window.getAllAttended?.() || {}).flat()
    : state.saved;
  const saved = sourceIds
    .map(id => ARTISTS.find(a => a.id === id))
    .filter(Boolean);
  if (saved.length === 0) return { ok: false, reason: "empty" };

  // Sort by night (day 1→2→3) then by set start time with after-midnight wrap
  const timeKey = hhmm => { const h = parseInt(hhmm); return h < 6 ? h + 24 : h; };
  const sorted = [...saved].sort((a, b) =>
    a.day !== b.day ? a.day - b.day : timeKey(a.start) - timeKey(b.start)
  );

  // Track depth: headliners (tier 3) = 5, prime time (tier 2) = 4, openers (tier 1) = 3
  const trackLimit = tier => tier === 3 ? 5 : tier === 2 ? 4 : 3;
  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // 1) Find the user's manually-created "Plursky" playlist
  const lookup = await _findPlurskyPlaylist(token, profile.id);
  if (lookup.error === "rate_limited") {
    return { ok: false, reason: "rate_limited", message: "Spotify rate limit — wait 30s & retry" };
  }
  if (lookup.error === "fetch_failed") {
    if (lookup.status === 401 || lookup.status === 403) {
      ["spotify_token","spotify_expires","spotify_auth_scopes"].forEach(k => { try { localStorage.removeItem(k); } catch {} });
      return { ok: false, reason: "reconnect", status: lookup.status, message: "Reconnect required" };
    }
    return { ok: false, reason: "create_fail", status: lookup.status, message: "Spotify lookup failed" };
  }
  let playlist;
  if (lookup.error === "not_found" || !lookup.playlist) {
    // No existing "Plursky" playlist — try to create one automatically.
    // Works with Extended Quota Mode / allowlisted accounts; Development Mode
    // 403s, in which case we fall back to the manual create-it-yourself flow.
    const created = await _createPlurskyPlaylist(token, profile.id);
    if (created.playlist) {
      playlist = created.playlist;
    } else if (created.error === "forbidden") {
      return {
        ok: false,
        reason: "no_target_playlist",
        message: "Create empty Spotify playlist named 'Plursky' first",
      };
    } else {
      return { ok: false, reason: "create_fail", status: created.status, message: "Couldn't create playlist" };
    }
  } else {
    playlist = lookup.playlist;
  }
  try { localStorage.setItem("plursky_target_playlist_id", playlist.id); } catch {}

  // 2) Top tracks per saved artist, kept in day buckets for FRI→SAT→SUN ordering.
  //    B2B names split so each artist contributes independently.
  const seenUris = new Set();
  const urisByDay = { 1: [], 2: [], 3: [] };
  let missed = 0;

  // Shared 429 retry — Spotify throttles bursty token traffic. Without retry,
  // a single rate-limited search drops the artist (counted as missed) and a
  // rate-limited write batch silently loses tracks.
  const fetchWithRetry = async (url, init) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url, init);
      if (r.status !== 429) return r;
      const retryAfter = parseInt(r.headers.get("Retry-After") || "2");
      const wait = Math.min(retryAfter * 1000, 4000) + attempt * 500;
      if (attempt < 2) await new Promise(res => setTimeout(res, wait));
    }
    return null;
  };

  const searchOne = async (searchName, limit) => {
    // Track-search path: avoids /artists/{id}/top-tracks which is blocked for
    // Development-Mode apps post-Nov 2024. Disambiguates name collisions
    // (e.g. Westend the rock band vs Westend the EDC house DJ) by counting
    // how many tracks each candidate artist ID owns and picking the most-
    // represented one — Spotify's track relevance ranking surfaces the
    // popular artist's catalog first.
    // Strip lineup-only suffixes like "(DJ Set)", "(VIP)", "(Live)" — Spotify's
    // canonical artist name doesn't include them, so the exact-name match below
    // would fail otherwise.
    const clean = searchName.replace(/\s*\([^)]*\)\s*/g, "").trim() || searchName;
    try {
      const tr = await fetchWithRetry(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:"${clean}"`)}&type=track&limit=10`,
        { headers: { Authorization: "Bearer " + token } }
      );
      if (!tr || !tr.ok) return [];
      const tj = await tr.json();
      const items = tj.tracks?.items || [];
      const ln = clean.toLowerCase();
      const byArtist = new Map();
      for (const t of items) {
        const matched = (t.artists || []).find(a => a.name.toLowerCase() === ln);
        if (!matched) continue;
        if (!byArtist.has(matched.id)) byArtist.set(matched.id, []);
        byArtist.get(matched.id).push(t);
      }
      if (byArtist.size === 0) return [];
      let bestId = null, bestCount = 0;
      for (const [id, ts] of byArtist) {
        if (ts.length > bestCount) { bestId = id; bestCount = ts.length; }
      }
      const collected = [];
      for (const t of byArtist.get(bestId)) {
        if (!t?.uri || seenUris.has(t.uri) || collected.length >= limit) continue;
        seenUris.add(t.uri); collected.push(t.uri);
      }
      return collected;
    } catch { return []; }
  };

  const search = async (artist) => {
    const parts = artist.name.split(/ b2b /i).map(s => s.trim());
    const limit = trackLimit(artist.tier);
    let total = 0;
    for (const part of parts) {
      const uris = await searchOne(part, limit);
      uris.forEach(u => (urisByDay[artist.day] || []).push(u));
      total += uris.length;
    }
    if (total === 0) missed++;
  };

  // 4-wide concurrency keeps us under Spotify's burst limit for token-auth
  // search calls. Higher widths trigger 429s that the retry helper has to
  // unwind — slower overall than a slightly narrower fan-out.
  for (let i = 0; i < sorted.length; i += 4) {
    try { opts.onProgress?.(`${Math.min(i + 4, sorted.length)}/${sorted.length} ARTISTS`); } catch {}
    await Promise.all(sorted.slice(i, i + 4).map(search));
  }

  // 3) Replace existing tracks: PUT clears+sets the first batch, POST appends rest.
  //    PUT with { uris: [] } clears entirely — runs even if we have zero matched
  //    tracks, so a rebuild with no matches still empties the playlist.
  const allUris = [
    ...(urisByDay[1] || []),
    ...(urisByDay[2] || []),
    ...(urisByDay[3] || []),
  ];
  const batches = [];
  for (let i = 0; i < allUris.length; i += 100) batches.push(allUris.slice(i, i + 100));
  if (batches.length === 0) batches.push([]);
  let addedCount = 0;
  let writeFailStatus = null;
  for (let i = 0; i < batches.length; i++) {
    try {
      const isFirst = i === 0;
      const ar = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: isFirst ? "PUT" : "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: batches[i] }),
      });
      if (ar?.ok) addedCount += batches[i].length;
      else if (writeFailStatus === null) writeFailStatus = ar?.status || 429;
    } catch {}
  }
  if (allUris.length > 0 && addedCount === 0 && writeFailStatus) {
    // Couldn't write any tracks — likely scope or ownership issue; surface it
    // rather than silently reporting a "successful" empty rebuild.
    if (writeFailStatus === 401 || writeFailStatus === 403) {
      ["spotify_token","spotify_expires","spotify_auth_scopes"].forEach(k => { try { localStorage.removeItem(k); } catch {} });
      return { ok: false, reason: "reconnect", status: writeFailStatus, message: "Reconnect required" };
    }
    return { ok: false, reason: "create_fail", status: writeFailStatus, message: "Couldn't write tracks" };
  }

  // 4) Update description with per-day track counts for easy navigation
  const dayLabels = [1, 2, 3].map(d => {
    const n = (urisByDay[d] || []).length;
    return n > 0 ? `${FESTIVAL_CONFIG.dayDates[d].short} ${n}` : null;
  }).filter(Boolean);
  if (dayLabels.length > 0) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `${sorted.length} sets · ${dayLabels.join(" · ")} tracks · headliners 5 songs · built with Plursky · ${dateStr}`,
      }),
    }).catch(() => {});
  }

  return {
    ok:    true,
    added: addedCount,
    total: sorted.length,
    missed,
    url:   playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    id:    playlist.id,
  };
}

// Pre-game hype playlist — full lineup, 1 top track per artist, headliners first.
// Distinct from createEdcPlaylist (saved sets, 2 tracks each = post-festival recap).
async function createHypePlaylist() {
  const token   = await getValidToken();
  const profile = await ensureSpotifyProfile();
  if (!token || !profile) return { ok: false, reason: "not_connected" };

  // Full lineup sorted tier-desc, deduplicated by name (some artists span days)
  const seen = new Set();
  const artists = [...ARTISTS]
    .sort((a, b) => (b.tier - a.tier) || a.name.localeCompare(b.name))
    .filter(a => { const k = a.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

  const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const plRes = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${FESTIVAL_CONFIG.shortName} 2026 — Pre-Game Hype`,
      description: `${artists.length} acts · 1 track each · headliners first · built with Plursky · ${dateStr}`,
      public: false,
    }),
  });
  if (!plRes.ok) {
    const err = await plRes.json().catch(() => ({}));
    if (plRes.status === 401 || plRes.status === 403) {
      ["spotify_token","spotify_expires"].forEach(k => localStorage.removeItem(k));
      return { ok: false, reason: "reconnect", status: plRes.status };
    }
    return { ok: false, reason: "create_fail", status: plRes.status, message: err.error?.message || "" };
  }
  const playlist = await plRes.json();

  const uris = [];
  let missed = 0;
  const searchHypeOne = async (searchName) => {
    // Same track-search path as createEdcPlaylist — see comment there.
    const clean = searchName.replace(/\s*\([^)]*\)\s*/g, "").trim() || searchName;
    try {
      const tr = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:"${clean}"`)}&type=track&limit=10`,
        { headers: { Authorization: "Bearer " + token } }
      );
      if (!tr.ok) return false;
      const tj = await tr.json();
      const items = tj.tracks?.items || [];
      const ln = clean.toLowerCase();
      const byArtist = new Map();
      for (const t of items) {
        const matched = (t.artists || []).find(a => a.name.toLowerCase() === ln);
        if (!matched) continue;
        if (!byArtist.has(matched.id)) byArtist.set(matched.id, []);
        byArtist.get(matched.id).push(t);
      }
      if (byArtist.size === 0) return false;
      let bestId = null, bestCount = 0;
      for (const [id, ts] of byArtist) {
        if (ts.length > bestCount) { bestId = id; bestCount = ts.length; }
      }
      const first = byArtist.get(bestId)[0];
      if (first?.uri) { uris.push(first.uri); return true; }
      return false;
    } catch { return false; }
  };
  const search = async (artist) => {
    const parts = artist.name.split(/ b2b /i).map(s => s.trim());
    let ok = false;
    for (const part of parts) ok = await searchHypeOne(part) || ok;
    if (!ok) missed++;
  };
  for (let i = 0; i < artists.length; i += 6) {
    await Promise.all(artists.slice(i, i + 6).map(search));
  }
  for (let i = 0; i < uris.length; i += 100) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }
  return { ok: true, added: uris.length, total: artists.length, missed, url: playlist.external_urls?.spotify, id: playlist.id };
}

// Returns full artist objects (with .genres array, deduped across all 3 time ranges,
// each tagged with a `_score` weighting recent listens 3×, 6mo 2×, all-time 1×).
// Returns null on token expiry, [] on error.
// Returns EDC artists the user follows on Spotify but hasn't saved to their lineup.
// Paginates up to 200 followed artists (4 pages × 50).
async function fetchFollowedEdcArtists(savedIds) {
  const token = await getValidToken();
  if (!token) return [];
  const savedNames = new Set(
    savedIds
      .map(id => ARTISTS.find(a => a.id === id))
      .filter(Boolean)
      .flatMap(a => a.name.split(/ b2b /i).map(s => s.trim().toLowerCase()))
  );
  const followedLower = [];
  let after = null;
  for (let page = 0; page < 4; page++) {
    try {
      const url = `https://api.spotify.com/v1/me/following?type=artist&limit=50${after ? "&after=" + after : ""}`;
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) break;
      const json = await res.json();
      const items = json.artists?.items || [];
      items.forEach(a => followedLower.push(a.name.toLowerCase()));
      after = json.artists?.cursors?.after;
      if (!after || items.length < 50) break;
    } catch { break; }
  }
  if (!followedLower.length) return [];
  const result = [];
  const seen = new Set();
  ARTISTS.forEach(a => {
    if (seen.has(a.id)) return;
    const parts = a.name.split(/ b2b /i).map(s => s.trim().toLowerCase());
    const follows = parts.some(p => followedLower.some(f => f === p || f.includes(p) || p.includes(f)));
    if (follows && !savedIds.includes(a.id)) { seen.add(a.id); result.push(a); }
  });
  return result;
}

async function fetchSpotifyTopArtists(onProgress) {
  const _progress = (msg) => { try { onProgress?.(msg); } catch {} };
  const token = await getValidToken();
  if (!token) return [];
  const ranges = [
    { range: "short_term",  weight: 3 },  // last 4 weeks
    { range: "medium_term", weight: 2 },  // last 6 months
    { range: "long_term",   weight: 1 },  // all-time
  ];
  try {
    const responses = await Promise.all(ranges.map(({ range }) =>
      fetch(`https://api.spotify.com/v1/me/top/artists?limit=50&time_range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ));
    if (responses.some(r => r.status === 401)) {
      ["spotify_token","spotify_expires"].forEach(k => localStorage.removeItem(k));
      return null;
    }
    _progress("TOP ARTISTS");
    const datas = await Promise.all(responses.map(r => r.ok ? r.json() : { items: [] }));
    // Dedupe by artist id; score = Σ weight × (51 − rank) across the ranges they appear in.
    const byId = new Map();
    ranges.forEach(({ weight }, i) => {
      (datas[i]?.items || []).forEach((artist, idx) => {
        const score = (51 - (idx + 1)) * weight;
        const cur = byId.get(artist.id);
        if (cur) cur._score += score;
        else byId.set(artist.id, { ...artist, _score: score });
      });
    });
    const top = Array.from(byId.values()).sort((a, b) => b._score - a._score);

    // Persist artist images keyed by lowercase name for ArtistScreen hero
    try {
      const imgs = JSON.parse(localStorage.getItem("artist_images_v1") || "{}");
      top.forEach(a => {
        const url = a.images?.[0]?.url;
        if (url && a.name) imgs[a.name.toLowerCase()] = url;
      });
      localStorage.setItem("artist_images_v1", JSON.stringify(imgs));
    } catch {}

    // Also pull recently-played + Liked Songs so artists you've played even
    // once (but aren't in your top 50) get matched against the lineup.
    // Charlotte de Witte / one-off plays were invisible before this.
    const seen = new Set(top.map(a => a.id));
    const extras = [];
    const pull = async (url, sourceTag, baseScore) => {
      try {
        const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
        if (!r.ok) return;  // silently degrade if scope missing on legacy tokens
        const d = await r.json();
        (d.items || []).forEach(item => {
          (item.track?.artists || []).forEach(a => {
            if (!a?.id || seen.has(a.id)) return;
            seen.add(a.id);
            extras.push({ id: a.id, name: a.name, genres: [], _score: baseScore, _source: sourceTag });
          });
        });
      } catch {}
    };
    _progress("LIKED SONGS + FOLLOWING");
    // Pull recently-played (max 50) + first 6 pages of liked songs (300 tracks).
    // More pages → more EDM artists who appear only a few times in the library.
    // Followed artists — cursor-paginated, different shape from track-based pulls.
    // An artist you follow but never play (e.g. you like an EDM act's posts but
    // listen to other genres at home) was invisible to the matcher before this.
    const pullFollowing = async () => {
      let after = null;
      for (let page = 0; page < 4; page++) {
        try {
          const url = `https://api.spotify.com/v1/me/following?type=artist&limit=50${after ? "&after=" + after : ""}`;
          const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
          if (!r.ok) return;
          const d = await r.json();
          const items = d.artists?.items || [];
          items.forEach(a => {
            if (!a?.id || seen.has(a.id)) return;
            seen.add(a.id);
            extras.push({ id: a.id, name: a.name, genres: a.genres || [], _score: 50, _source: "following" });
          });
          after = d.artists?.cursors?.after;
          if (!after || items.length < 50) break;
        } catch { return; }
      }
    };
    await Promise.all([
      pull("https://api.spotify.com/v1/me/player/recently-played?limit=50", "recent", 60),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=0",   "saved", 40),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=50",  "saved", 35),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=100", "saved", 30),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=150", "saved", 25),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=200", "saved", 20),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=250", "saved", 15),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=300", "saved", 12),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=350", "saved", 10),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=400", "saved", 8),
      pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=450", "saved", 6),
      pullFollowing(),
    ]);

    _progress("SCANNING PLAYLISTS");
    // Walk ALL playlists (owned + followed) — paginate both the playlist list
    // and each playlist's tracks so a 1000-song playlist is fully scanned.
    // _playlistCount stays 0 if the scope or token blocks the list endpoint.
    // _playlistScanOk is true only if the endpoint responded with HTTP 2xx at
    // least once — distinguishes "0 playlists" from "API call failed".
    // Scope pre-check: if the stored auth scopes (written by _buildSpotifyAuthUrl
    // since v54) don't include playlist-read-private, surface the banner now
    // rather than letting the scan silently return an empty playlist list.
    const _storedScopes = (() => { try { return localStorage.getItem("spotify_auth_scopes") || ""; } catch { return ""; } })();
    const _missingScopeRecord = _storedScopes !== "" && !_storedScopes.includes("playlist-read-private");
    let _playlistCount = 0;
    let _playlistScanOk = _missingScopeRecord ? false : false; // stays false until first HTTP 2xx
    // Retry helper — Spotify throttles bursty token traffic with 429.
    // Treating 429 as "scan failed" surfaces a misleading reconnect banner,
    // so retry up to 3 times honoring Retry-After before giving up.
    const fetchPlaylistsWithRetry = async (url) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
        if (r.status !== 429) return r;
        const retryAfter = parseInt(r.headers.get("Retry-After") || "2");
        const wait = Math.min(retryAfter * 1000, 4000) + attempt * 500;
        if (attempt < 2) await new Promise(res => setTimeout(res, wait));
      }
      return null;
    };
    try {
      // Fetch every playlist the user has (paginate the list — max 50 per page)
      const allPlaylists = [];
      let plOffset = 0;
      while (true) {
        const plRes = await fetchPlaylistsWithRetry(
          `https://api.spotify.com/v1/me/playlists?limit=50&offset=${plOffset}`
        );
        if (!plRes || !plRes.ok) break;
        _playlistScanOk = true;
        const plData = await plRes.json();
        const items = (plData.items || []).filter(p => p?.id);
        allPlaylists.push(...items);
        if (items.length < 50 || !plData.next) break;
        plOffset += 50;
      }
      _playlistCount = allPlaylists.length;

      // Per-playlist: paginate every track page (100 tracks at a time)
      // No `fields=` param — avoids comma encoding bugs that break `next`
      const fetchPl = async (pl) => {
        try {
          let offset = 0;
          while (true) {
            const tr = await fetchPlaylistsWithRetry(
              `https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100&offset=${offset}`
            );
            if (!tr || !tr.ok) break;
            const td = await tr.json();
            const items = td.items || [];
            items.forEach(item => {
              // Primary track artists
              (item.track?.artists || []).forEach(a => {
                if (!a?.id || seen.has(a.id)) return;
                seen.add(a.id);
                extras.push({ id: a.id, name: a.name, genres: [], _score: 25, _source: "playlist" });
              });
              // Remix / edit credits buried in the track title:
              // "Song (Layton Giordani Remix)" → extract "Layton Giordani".
              // EDM labels often credit remixers only in the title, not as a
              // track artist — this catches them.
              const title = item.track?.name || "";
              // Spotify formats remix credits three ways: "(Name Remix)",
              // "[Name Remix]", or " - Name Remix" (dash with no parens, e.g.
              // "Drinkee - Sofi Tukker Remix"). All three covered below.
              const rxMatch = title.match(/\(\s*([^)]+?)\s+(?:Remix|Edit|Mix|Rework|Bootleg|Flip|VIP)\s*\)/i)
                           || title.match(/\[\s*([^\]]+?)\s+(?:Remix|Edit|Mix|Rework|Bootleg|Flip|VIP)\s*\]/i)
                           || title.match(/\s[-–—]\s+([^-–—]+?)\s+(?:Remix|Edit|Mix|Rework|Bootleg|Flip|VIP)\s*$/i);
              if (rxMatch) {
                const remixerRaw = rxMatch[1].trim();
                // A track can have a compound remixer credit like "A & B" — split on & / x / vs
                remixerRaw.split(/\s*[&,]\s*|\s+(?:x|vs\.?)\s+/i).forEach(rName => {
                  const n = rName.trim();
                  if (!n || seen.has("remix_" + n.toLowerCase())) return;
                  seen.add("remix_" + n.toLowerCase());
                  extras.push({ id: "remix_" + n.toLowerCase(), name: n, genres: [], _score: 20, _source: "playlist" });
                });
              }
            });
            // Stop when we received fewer than a full page, or Spotify says no more
            if (items.length < 100 || !td.next) break;
            offset += 100;
          }
        } catch {}
      };

      // 6-wide concurrency keeps us under Spotify's rate limit
      for (let i = 0; i < allPlaylists.length; i += 6) {
        _progress(`PLAYLIST ${Math.min(i + 6, allPlaylists.length)}/${allPlaylists.length}`);
        await Promise.all(allPlaylists.slice(i, i + 6).map(fetchPl));
      }
    } catch {}

    const result = [...top, ...extras];
    result._playlistCount = _playlistCount;
    result._playlistScanOk = _playlistScanOk;

    // S1: Cache artist scores for video overlay + artist card stats
    const cache = {};
    result.forEach(a => {
      if (a.name) cache[a.name.toLowerCase()] = { score: a._score || 0, playCount: Math.round((a._score || 0) / 3), source: a._source || "top" };
    });
    window._spotifyArtistCache = cache;

    return result;
  } catch {
    return [];
  }
}

// Search Spotify for a 30-sec preview URL for a given artist name.
// Spotify deprecated `preview_url` for new apps in late 2024 — most tracks
// now return null. Falls back to iTunes Search (free, no auth, CORS-OK)
// which still serves 30s previews for ~95% of mainstream artists.
async function fetchPreviewUrl(artistName) {
  const cacheKey = "preview_urls_v1";
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    const entry = cached[artistName.toLowerCase()];
    if (entry) return entry;
  } catch {}

  const _cachePreview = (result) => {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
      cached[artistName.toLowerCase()] = result;
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch {}
    return result;
  };

  const token = localStorage.getItem("spotify_token");
  const firstWord = artistName.toLowerCase().split(" ")[0];

  if (token) {
    try {
      const q   = encodeURIComponent(artistName);
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${q}&type=track&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data   = await res.json();
        const tracks = data.tracks?.items || [];
        const first  = tracks.find(t =>
          t.preview_url &&
          t.artists.some(a => a.name.toLowerCase().includes(firstWord))
        ) || tracks.find(t => t.preview_url);
        if (first) return _cachePreview({ url: first.preview_url, name: first.name, source: "spotify" });
      }
    } catch {}
  }

  // iTunes fallback — works without auth, returns 30s m4a previews
  try {
    const q = encodeURIComponent(artistName);
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=10`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    const first = results.find(t =>
      t.previewUrl && t.artistName?.toLowerCase().includes(firstWord)
    ) || results.find(t => t.previewUrl);
    return first ? _cachePreview({ url: first.previewUrl, name: first.trackName, source: "itunes" }) : null;
  } catch {
    return null;
  }
}

// Match Spotify artist names against the EDC lineup.
// B2B entries ("A b2b B") are kept as a single entry — the full compound
// set shows in the matched list. Matching fires if ANY individual part of
// the B2B name is found in the user's Spotify library, so "Peggy Gou b2b
// Ki/Ki" surfaces if you follow Peggy Gou.
function matchLineupArtists(spotifyArtists) {
  if (!spotifyArtists?.length) return [];
  const names = spotifyArtists.map(a => a.name.toLowerCase());
  const result = [];
  const seen   = new Set();

  ARTISTS.forEach(a => {
    if (seen.has(a.id)) return;
    const parts = a.name.split(/ b2b /i).map(s => s.trim().toLowerCase());
    const matches = parts.some(part => names.some(n => part.includes(n) || n.includes(part)));
    if (!matches) return;
    seen.add(a.id);
    result.push(a);
  });
  return result;
}

// Count genre frequencies and score each EDC stage
function analyzeGenres(spotifyArtists) {
  const counts = {};
  spotifyArtists.forEach(artist => {
    (artist.genres || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; });
  });

  const stageScores = {};
  STAGES.forEach(s => { stageScores[s.id] = 0; });
  Object.entries(counts).forEach(([genre, count]) => {
    Object.entries(STAGE_GENRES).forEach(([sid, keywords]) => {
      if (keywords.some(k => genre.includes(k))) {
        stageScores[sid] = (stageScores[sid] || 0) + count;
      }
    });
  });

  const maxScore = Math.max(...Object.values(stageScores), 1);
  const topGenres = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([genre, count]) => ({ genre, count }));
  const stageRecs = Object.entries(stageScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, score]) => ({
      stage: STAGES.find(s => s.id === id),
      pct:   Math.round((score / maxScore) * 100),
    }));

  return { topGenres, stageRecs };
}

// EDC artists you'd probably love but aren't already in your Spotify top.
// Scored by stage affinity (your genre profile → stage weights) + tier bonus.
function getDiscoveries(spotifyArtists, matched, savedIds, max = 8) {
  if (!spotifyArtists?.length) return [];
  // Use real IDs (strip B2B virtual suffix) so matched B2B halves don't leak
  // into the discovery list under the original compound entry ID.
  const matchedIds = new Set((matched || []).map(a => a._realId || a.id));
  const savedSet   = new Set(savedIds || []);
  // Stage profile: count how many of your top artist genres map to each EDC stage.
  const stageProfile = {};
  STAGES.forEach(s => { stageProfile[s.id] = 0; });
  spotifyArtists.forEach(a => {
    (a.genres || []).forEach(g => {
      Object.entries(STAGE_GENRES).forEach(([sid, kws]) => {
        if (kws.some(k => g.includes(k))) stageProfile[sid] += 1;
      });
    });
  });
  const total = Math.max(1, Object.values(stageProfile).reduce((a, b) => a + b, 0));
  // Identify the user's strongest stage so we can call it out by name in the
  // recommendation reason ("matches your top stage").
  const ranked = Object.entries(stageProfile).sort((a, b) => b[1] - a[1]);
  const topStageId = ranked[0]?.[1] > 0 ? ranked[0][0] : null;
  const scored = ARTISTS
    .filter(a => !matchedIds.has(a.id) && !savedSet.has(a.id) && a.tier >= 2)
    .map(a => {
      const stageWeight = (stageProfile[a.stage] || 0) / total;
      const tierBonus   = a.tier * 0.5; // light nudge toward primetime/headliner picks
      const stage       = STAGES.find(s => s.id === a.stage);
      const stageShort  = stage?.short || stage?.name || a.stage;
      let reason;
      if (a.stage === topStageId && stageWeight > 0) reason = `Your top stage · ${stageShort}`;
      else if (stageWeight > 0)                     reason = `Matches your ${stageShort} taste`;
      else                                           reason = null;
      return { artist: { ...a, _reason: reason }, score: stageWeight * 100 + tierBonus };
    });
  // Only surface picks with a real genre-fit reason — random "headliner you
  // haven't heard" suggestions assumed unfamiliarity that wasn't there.
  const meaningful = scored.filter(s => s.artist._reason);
  return meaningful.sort((a, b) => b.score - a.score).slice(0, max).map(s => s.artist);
}

// Window exports — same set spotify.jsx exported for this cluster before
// the split, so existing call sites are unaffected.
Object.assign(window, {
  startSpotifyAuth, ensureSpotifyProfile, getSpotifyProfileSync,
  createEdcPlaylist, fetchPreviewUrl,
  connectAppleMusic, disconnectAppleMusic, createAppleMusicPlaylist, _appleMusicConfigured,
});

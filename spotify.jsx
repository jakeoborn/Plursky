// Spotify / Music + Me screens

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
  if (lookup.error === "not_found" || !lookup.playlist) {
    return {
      ok: false,
      reason: "no_target_playlist",
      message: "Create empty Spotify playlist named 'Plursky' first",
    };
  }
  const playlist = lookup.playlist;
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

// ── SPOTIFY SCREEN ────────────────────────────────────────────
function SpotifyScreen({ state, setState }) {
  const connected = state.spotifyConnected;
  const [spotifyArtists,  setSpotifyArtists]  = React.useState(null);
  const [tokenBad,        setTokenBad]        = React.useState(false);
  const [saveFlash,         setSaveFlash]         = React.useState(false);
  const [playlistCount,     setPlaylistCount]     = React.useState(null);
  const [playlistScanFailed, setPlaylistScanFailed] = React.useState(false);
  const [showAllArtists,  setShowAllArtists]  = React.useState(false);
  const [scanProgress,    setScanProgress]    = React.useState("");

  // Apple Music state
  const [amConnected, setAmConnected] = React.useState(() => !!localStorage.getItem("am_user_token"));
  const [amArtists,   setAmArtists]   = React.useState(null);
  const [amLoading,   setAmLoading]   = React.useState(false);
  const [amError,     setAmError]     = React.useState("");

  React.useEffect(() => {
    if (!connected) { setSpotifyArtists([]); setPlaylistCount(null); setPlaylistScanFailed(false); setScanProgress(""); return; }
    fetchSpotifyTopArtists((msg) => setScanProgress(msg)).then(artists => {
      setScanProgress("");
      if (artists === null) { setTokenBad(true); setState({ ...state, spotifyConnected: false }); }
      else {
        setSpotifyArtists(artists);
        setPlaylistCount(artists._playlistCount ?? null);
        setPlaylistScanFailed(artists._playlistScanOk === false);
        try {
          const ids = matchLineupArtists(artists).map(a => a._realId || a.id);
          localStorage.setItem('spotify_matched_ids_v1', JSON.stringify(ids));
        } catch {}
      }
    });
  }, [connected]);

  React.useEffect(() => {
    if (!amConnected) { setAmArtists(null); return; }
    fetchAppleMusicArtists().then(artists => {
      if (artists === null) { setAmConnected(false); }
      else setAmArtists(artists);
    });
  }, [amConnected]);

  const handleAmConnect = async () => {
    if (!APPLE_DEV_TOKEN) return;
    setAmLoading(true); setAmError("");
    const result = await connectAppleMusic();
    setAmLoading(false);
    if (result.ok) { setAmConnected(true); }
    else setAmError(result.error || "Connection failed");
  };

  const handleAmDisconnect = () => {
    disconnectAppleMusic();
    setAmConnected(false);
    setAmArtists(null);
  };

  const amMatched = amArtists ? matchLineupArtists(amArtists) : [];

  const matched  = matchLineupArtists(spotifyArtists);
  const { topGenres, stageRecs } = spotifyArtists?.length
    ? analyzeGenres(spotifyArtists)
    : { topGenres: [], stageRecs: [] };
  const maxCount    = topGenres[0]?.count || 1;
  const discoveries = spotifyArtists?.length
    ? getDiscoveries(spotifyArtists, matched, state.saved, 8)
    : [];
  const fallback    = ARTISTS.filter(a => a.tier === 3).slice(0, 8);
  const recs        = matched.length ? matched : fallback;

  // Check if this connection was made after scope-recording was introduced (v54).
  // Old connections have no record → private playlists may have been silently skipped.
  const noScopeRecord = (() => { try { return !localStorage.getItem("spotify_auth_scopes"); } catch { return false; } })();
  // Tokens granted before user-follow-read was added to SPOTIFY_SCOPES can't fetch
  // followed artists — Layton Giordani / Sofi Tukker etc. get missed if user only follows them.
  const missingFollowScope = (() => {
    try { const s = localStorage.getItem("spotify_auth_scopes") || ""; return s !== "" && !s.includes("user-follow-read"); }
    catch { return false; }
  })();

  const handleSaveAll = () => {
    const newSaved = [...new Set([...state.saved, ...matched.map(a => a._realId || a.id)])];
    setState({ ...state, saved: newSaved });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2200);
  };

  return (
    <Screen bg="var(--paper)">
      <div style={{ padding: "8px 20px" }}>
        <TopBar title={<span>Music</span>} sub="SOUNDTRACK" tight />
      </div>

      <ScrollBody style={{ padding: "10px 20px 94px" }}>

        {/* Native-iOS Spotify fallback hint (v132). On the App Store binary
            before the @capacitor/browser OAuth path landed, Spotify connect
            failed silently because the redirect went to a different origin.
            Even with the fix in place, surfacing a "Safari also works" hint
            gives users a path forward if the in-app SafariViewController
            misbehaves. */}
        {!connected && _isNativeApp() && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px", marginBottom: 14,
            background: "rgba(232,93,46,0.10)",
            border: "1px solid rgba(232,93,46,0.35)",
            borderRadius: 12,
          }}>
            <span aria-hidden style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>
              If Spotify sign-in stalls, open <strong>plursky.com</strong> in mobile Safari — it works there reliably and your saved sets sync if you signed in with Apple on Me.
            </div>
          </div>
        )}

        {/* ── Connect card ───────────────────────────────── */}
        <div style={{
          borderRadius: 20, padding: 20,
          background: connected ? "#1a3d2b" : "var(--ink)",
          color: "var(--paper)", marginBottom: 20,
          position: "relative", overflow: "hidden",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" style={{ position: "absolute", top: 16, right: 16 }}>
            <circle cx="12" cy="12" r="11" fill="#1DB954"/>
            <path d="M6 10 Q12 8 18 11" stroke="#000" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
            <path d="M7 13 Q12 11.5 17 14" stroke="#000" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
            <path d="M8 15.8 Q12 14.5 16 16.5" stroke="#000" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          </svg>

          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, opacity: 0.65, marginBottom: 8 }}>
            {connected ? "CONNECTED" : "CONNECT SPOTIFY"}
          </div>
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10, maxWidth: "78%" }}>
            {connected
              ? <>Your lineup is <span style={{ fontStyle: "italic" }}>personalised</span></>
              : <>Build your <span style={{ fontStyle: "italic" }}>perfect</span> festival night</>}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.55, marginBottom: connected && spotifyArtists !== null && (playlistScanFailed || noScopeRecord) ? 8 : 16, maxWidth: "88%" }}>
            {connected
              ? matched.length
                ? `${matched.length} artists match · scanned top, recent, liked songs${playlistCount > 0 ? ` + ${playlistCount} playlist${playlistCount === 1 ? "" : "s"}` : ""}.`
                : spotifyArtists === null ? "Loading your taste…" : "No direct matches — showing genre-based picks below."
              : "Link Spotify to see your matches, genre breakdown, and play 30-sec previews on any artist."}
          </div>

          {connected && spotifyArtists !== null && (playlistScanFailed || noScopeRecord || missingFollowScope) && (
            <button
              onClick={() => { disconnectSpotify(setState, state); startSpotifyAuth(); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                fontSize: 13, lineHeight: 1.5, marginBottom: 14,
                background: "rgba(245,154,54,0.18)", border: "1px solid rgba(245,154,54,0.4)",
                borderRadius: 8, padding: "8px 10px", color: "#fde68a",
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {missingFollowScope
                ? "↻ Reconnect Spotify — your current session can't see followed artists. Layton Giordani, Sofi Tukker and others you follow won't be matched until you reconnect."
                : noScopeRecord && !playlistScanFailed
                  ? "↻ Reconnect Spotify to unlock full playlist scanning — artists in private playlists may be missing."
                  : "↻ Your playlists weren't scanned. Tap to reconnect Spotify with full access — this fixes missing artists like those in private playlists."}
            </button>
          )}

          {tokenBad && (
            <div style={{ fontSize: 13, color: "#f87171", marginBottom: 10, letterSpacing: 0.8 }}>
              Session expired — please reconnect.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {connected && matched.length > 0 && (
              <button onClick={handleSaveAll} style={{
                background: saveFlash ? "#2d7a55" : "#1DB954",
                color: "#fff", border: "none",
                borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
                transition: "background 0.3s",
              }}>
                {saveFlash ? `✓ SAVED ${matched.length} ARTISTS` : `SAVE ALL ${matched.length} ARTISTS`}
              </button>
            )}
            {connected && state.saved.length > 0 && (
              <BuildPlaylistButton state={state} />
            )}
            <button
              onClick={() => { if (!connected) window.plurskyHaptic?.("MEDIUM"); connected ? disconnectSpotify(setState, state) : startSpotifyAuth(); }}
              style={{
                background: connected ? "rgba(29,185,84,0.2)" : "rgba(247,237,224,0.12)",
                color: "var(--paper)",
                border: connected ? "1px solid rgba(29,185,84,0.5)" : "1px solid rgba(247,237,224,0.28)",
                borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 500,
                transition: "all 0.3s var(--ease-spring)",
                animation: connected && spotifyArtists === null ? "savePop 1.2s ease-in-out infinite" : undefined,
              }}>
              {connected && spotifyArtists === null ? "⟳ LOADING…" : connected ? "✓ CONNECTED" : "CONNECT ACCOUNT"}
            </button>
          </div>
        </div>

        {/* ── Followed artists nudge ────────────────────── */}
        {connected && <FollowedNudge state={state} setState={setState} />}

        {/* ── Apple Music card ──────────────────────────── */}
        {/* Hidden entirely until a dev token is wired — the previous
            "add your token" copy was a developer reminder that nagged every
            end user without offering them any action. */}
        {APPLE_DEV_TOKEN && <div style={{
          borderRadius: 20, padding: 20,
          background: amConnected ? "#3a1a1a" : "var(--paper-2)",
          border: `1px solid ${amConnected ? "rgba(252,60,60,0.25)" : "var(--line)"}`,
          color: amConnected ? "var(--paper)" : "var(--ink)",
          marginBottom: 14, position: "relative", overflow: "hidden",
        }}>
          {/* Apple Music logo */}
          <svg width="36" height="36" viewBox="0 0 24 24" style={{ position: "absolute", top: 16, right: 16 }}>
            <rect width="24" height="24" rx="6" fill="#fc3c44"/>
            <path d="M16.5 7.5 L10 9 L10 15" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="8.5" cy="15" r="1.5" fill="#fff"/>
            <circle cx="15" cy="13" r="1.5" fill="#fff"/>
          </svg>

          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, opacity: amConnected ? 0.65 : 0.5, marginBottom: 8 }}>
            {amConnected ? "APPLE MUSIC CONNECTED" : "CONNECT APPLE MUSIC"}
          </div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 8, maxWidth: "78%" }}>
            {amConnected
              ? <>{amMatched.length} festival <span style={{ fontStyle: "italic" }}>matches</span> found</>
              : <>Don't use Spotify? <span style={{ fontStyle: "italic" }}>Link Apple Music</span></>}
          </div>

          {!amConnected && (
            <>
              <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5, marginBottom: 14, maxWidth: "88%" }}>
                Scan your Apple Music library to find which artists you already know and love.
              </div>
              {amError && (
                <div style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>{amError}</div>
              )}
              <button onClick={handleAmConnect} disabled={amLoading} style={{
                background: "#fc3c44", color: "#fff", border: "none",
                borderRadius: 999, padding: "10px 18px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
              }}>
                {amLoading ? "CONNECTING…" : "CONNECT APPLE MUSIC"}
              </button>
            </>
          )}

          {amConnected && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {amMatched.length > 0 && (
                <button onClick={() => {
                  const newSaved = [...new Set([...state.saved, ...amMatched.map(a => a.id)])];
                  setState({ ...state, saved: newSaved });
                }} style={{
                  background: "#fc3c44", color: "#fff", border: "none",
                  borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
                }}>
                  SAVE ALL {amMatched.length} ARTISTS
                </button>
              )}
              <button onClick={handleAmDisconnect} style={{
                background: "rgba(247,237,224,0.12)", color: "var(--paper)",
                border: "1px solid rgba(247,237,224,0.28)",
                borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2,
              }}>DISCONNECT</button>
            </div>
          )}

          {amConnected && amArtists === null && (
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, opacity: 0.6 }}>LOADING LIBRARY…</div>
          )}
        </div>}

        {/* ── Harmony score ──────────────────────────────── */}
        {connected && spotifyArtists !== null && (
          <div style={{
            borderRadius: 16, padding: "14px 16px", marginBottom: 20,
            background: "var(--paper-2)", border: "1px solid var(--line)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div className="serif" style={{ fontSize: 20, lineHeight: 1, letterSpacing: -0.3 }}>Harmony score</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                  YOUR SPOTIFY VS THE LINEUP
                </div>
              </div>
              <div className="serif" style={{ fontSize: 42, lineHeight: 1, letterSpacing: -1.5 }}>
                {Math.round(matched.length / ARTISTS.length * 100)}<span style={{ fontSize: 22, opacity: 0.45 }}>%</span>
              </div>
            </div>
            <div style={{ height: 6, background: "var(--line)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                width: `${Math.round(matched.length / ARTISTS.length * 100)}%`, height: "100%",
                background: "linear-gradient(90deg, var(--ember), var(--horizon))",
                borderRadius: 6, transition: "width 0.8s ease",
              }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              {matched.length} of {ARTISTS.length} artists match your Spotify — scanned across top, recent, liked &amp; playlists.
            </div>
          </div>
        )}

        {/* ── Genre DNA chart ────────────────────────────── */}
        {connected && topGenres.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginBottom: 3 }}>Your music DNA</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
              FROM YOUR SPOTIFY TOP 50 ARTISTS
            </div>
            {topGenres.map(({ genre, count }) => {
              const pct = Math.round((count / maxCount) * 100);
              // Find matching stage color
              let barColor = "var(--ember)";
              for (const [sid, keywords] of Object.entries(STAGE_GENRES)) {
                if (keywords.some(k => genre.includes(k))) {
                  barColor = STAGES.find(s => s.id === sid)?.color || barColor;
                  break;
                }
              }
              return (
                <div key={genre} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, textTransform: "capitalize", color: "var(--ink)" }}>{genre}</span>
                    <span className="mono" style={{ fontSize: 10, letterSpacing: 0.8, color: "var(--muted)" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: "var(--line)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: barColor, borderRadius: 5,
                      transition: "width 0.7s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Best stages for you ───────────────────────── */}
        {connected && stageRecs.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginBottom: 3 }}>Best stages for you</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
              BASED ON YOUR GENRE TASTE
            </div>
            {stageRecs.map(({ stage, pct }) => (
              <div key={stage.id} style={{
                padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                background: "var(--paper-2)",
                borderLeft: `3px solid ${stage.color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div className="serif" style={{ fontSize: 18, lineHeight: 1 }}>{stage.name}</div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: stage.color, fontWeight: 700 }}>
                    {pct}% MATCH
                  </div>
                </div>
                <div style={{ height: 3, background: "var(--line)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: stage.color, borderRadius: 3 }} />
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)" }}>
                  {stage.desc.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Artist picks ──────────────────────────────── */}
        <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginBottom: 3 }}>
          {connected && matched.length ? "Your matches" : connected && spotifyArtists === null ? "Loading your matches" : "Top picks for you"}
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
          {connected && matched.length ? "FROM YOUR SPOTIFY · TAP TO VIEW" : connected && spotifyArtists === null ? (scanProgress ? `SCANNING · ${scanProgress}` : "SCANNING YOUR LIBRARY…") : "HEADLINERS · TAP + TO SAVE"}
        </div>

        {connected && spotifyArtists === null && (
          <div style={{ marginBottom: 14 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="skel" style={{ width: 48, height: 48, borderRadius: 48, flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div className="skel" style={{ width: `${50 + i * 10}%`, height: 14, marginBottom: 6 }}/>
                  <div className="skel" style={{ width: "40%", height: 9 }}/>
                </div>
                <div className="skel" style={{ width: 34, height: 34, borderRadius: 34, flexShrink: 0 }}/>
              </div>
            ))}
          </div>
        )}

        {recs.map(a => {
          const realId  = a._realId || a.id;
          const stg     = STAGES.find(s => s.id === a.stage);
          const isSaved = state.saved.includes(realId);
          return (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: "1px solid var(--line)",
            }}>
              <ArtistSwatch artist={a} size={48} />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                   onClick={() => setState({ ...state, tab: "home", artist: realId })}>
                <div className="serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{a.name}</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                  {stg.name} · DAY {a.day} · {fmt12(a.start)}
                </div>
              </div>
              <button onClick={() => toggleSave(state, setState, realId)} style={{
                width: 34, height: 34, borderRadius: 34,
                background: isSaved ? "var(--ember)" : "transparent",
                color: isSaved ? "#fff" : "var(--ink)",
                border: isSaved ? "none" : "1px solid var(--line-2)",
                cursor: "pointer", fontSize: 18, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{isSaved ? "✓" : "+"}</button>
            </div>
          );
        })}

        {/* ── Discoveries: EDC artists you don't listen to yet, but should ── */}
        {connected && discoveries.length > 0 && (
          <>
            <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginTop: 24, marginBottom: 3 }}>
              Recommended for you
            </div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
              ARTISTS THAT MATCH YOUR TASTE · NOT IN YOUR TOP YET
            </div>
            {discoveries.map(a => {
              const stg     = STAGES.find(s => s.id === a.stage);
              const isSaved = state.saved.includes(a.id);
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderBottom: "1px solid var(--line)",
                }}>
                  <ArtistSwatch artist={a} size={48} />
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                       onClick={() => setState({ ...state, tab: "home", artist: a.id })}>
                    <div className="serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                      {stg.name} · DAY {a.day} · {fmt12(a.start)}
                    </div>
                    {a._reason && (
                      <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--horizon)", marginTop: 3, lineHeight: 1.3 }}>
                        {a._reason}
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleSave(state, setState, a.id)} style={{
                    width: 34, height: 34, borderRadius: 34,
                    background: isSaved ? "var(--ember)" : "transparent",
                    color: isSaved ? "#fff" : "var(--ink)",
                    border: isSaved ? "none" : "1px solid var(--line-2)",
                    cursor: "pointer", fontSize: 18, fontWeight: 300,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{isSaved ? "✓" : "+"}</button>
                </div>
              );
            })}
          </>
        )}

        {/* ── All scanned artists ─────────────────────────── */}
        {connected && spotifyArtists !== null && spotifyArtists.length > 0 && (
          <div style={{ marginTop: 28, marginBottom: 8 }}>
            <button
              onClick={() => setShowAllArtists(v => !v)}
              style={{
                width: "100%", textAlign: "left", background: "none", border: "none",
                padding: 0, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "space-between",
              }}>
              <div>
                <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3 }}>
                  Your scanned artists
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                  {spotifyArtists.length} ARTISTS FROM YOUR SPOTIFY
                </div>
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>
                {showAllArtists ? "▲ HIDE" : "▼ SHOW"}
              </div>
            </button>

            {showAllArtists && (
              <div style={{ marginTop: 14 }}>
                {[...spotifyArtists]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((a, i) => {
                    const srcLabel = a._source === "top" ? "TOP" : a._source === "recent" ? "RECENT" : a._source === "saved" ? "LIKED" : "PLAYLIST";
                    const srcColor = a._source === "top" ? "var(--ember)" : a._source === "recent" ? "var(--horizon)" : a._source === "saved" ? "#34d399" : "var(--muted)";
                    const isEdc = ARTISTS.some(e => e.name.toLowerCase() === a.name.toLowerCase());
                    return (
                      <div key={a.id || i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "7px 0", borderBottom: "1px solid var(--line)",
                      }}>
                        <div style={{ fontSize: 14, color: isEdc ? "var(--ink)" : "var(--muted)", fontWeight: isEdc ? 500 : 400 }}>
                          {a.name}{isEdc && <span style={{ fontSize: 10, color: "var(--ember)", marginLeft: 6 }}>· ✓</span>}
                        </div>
                        <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: srcColor }}>{srcLabel}</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </ScrollBody>
    </Screen>
  );
}

// ── ME SCREEN ─────────────────────────────────────────────────
// ── Safety & Wellness — harm-reduction surface ────────────────
const SAFETY_LINKS = [
  {
    id: "ground",
    title: "Ground Control",
    sub: "Free water · cool down · friendly faces. Look for the high-vis vests.",
    color: "var(--horizon)",
    icon: "shield",
    href: "https://insomniac.com/festival/edc-las-vegas/2026/info/health-safety/",
  },
  {
    id: "amnesty",
    title: "Amnesty Boxes",
    sub: "Drop unwanted substances at any entrance. No questions, no consequences.",
    color: "var(--ember)",
    icon: "amnesty",
    href: "https://insomniac.com/festival/edc-las-vegas/2026/info/health-safety/",
  },
  {
    id: "dancesafe",
    title: "DanceSafe",
    sub: "Drug-checking, harm-reduction info, peer support. Independent nonprofit.",
    color: "#34d399",
    icon: "info",
    href: "https://dancesafe.org",
  },
  {
    id: "consent",
    title: "Consent Reporting",
    sub: "Report anonymously. Insomniac Cares + 24/7 confidential line.",
    color: "var(--ink)",
    icon: "consent",
    href: "https://insomniac.com/cares",
  },
  {
    id: "medical",
    title: "Medical · 24/7",
    sub: "3 medic tents on-site · roamers in the crowd. Tap → map.",
    color: "#f87171",
    icon: "med",
    onClick: (state, setState) => setState({ ...state, tab: "map" }),
  },
];

function SafetyIcon({ kind, color }) {
  const stroke = color || "currentColor";
  if (kind === "shield") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 L20 6 V12 C20 17 16 20.5 12 22 C8 20.5 4 17 4 12 V6 Z"/><path d="M9 12 L11 14 L15 10"/></svg>;
  if (kind === "amnesty") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M8 8 V6 a4 4 0 0 1 8 0 V8"/><path d="M9 14 H15"/></svg>;
  if (kind === "info") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11 V16"/><circle cx="12" cy="8" r="0.7" fill={stroke}/></svg>;
  if (kind === "consent") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12 a9 9 0 1 1-3-6.7"/><path d="M21 4 V10 H15"/></svg>;
  if (kind === "med") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M12 10 V16"/><path d="M9 13 H15"/></svg>;
  return null;
}

function SafetyCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {SAFETY_LINKS.map(item => {
        const onClick = item.href
          ? () => window.open(item.href, "_blank", "noopener")
          : () => item.onClick?.();
        return (
          <button key={item.id} onClick={onClick} style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: "12px 14px", borderRadius: 12,
            background: "var(--paper)", border: "1px solid var(--line)",
            borderLeft: `3px solid ${item.color}`,
            cursor: "pointer", textAlign: "left", color: "var(--ink)",
            fontFamily: "inherit",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `${item.color}1f`, color: item.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <SafetyIcon kind={item.icon} color={item.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{item.sub}</div>
            </div>
            {item.href && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 4 }}>
                <path d="M7 17 L17 7"/><path d="M9 7 H17 V15"/>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Essentials checklist — persisted to localStorage so users can tick items
// off as they pack at home and the state is still there at the venue.
const PACK_ITEMS = [
  { id: "hydra",  label: "Hydration pack / Camelbak", emoji: "💧" },
  { id: "ear",    label: "Earplugs", emoji: "🎧" },
  { id: "sun",    label: "Sunscreen + lip balm", emoji: "☀️" },
  { id: "boots",  label: "Comfortable boots / sneakers", emoji: "👟" },
  { id: "jacket", label: "Light jacket (60°F at sunrise)", emoji: "🧥" },
  { id: "power",  label: "Phone charger / battery pack", emoji: "🔋" },
  { id: "cash",   label: "Cash + ID + bank card", emoji: "💳" },
  { id: "bandana",label: "Bandana / dust mask", emoji: "🌪️" },
  { id: "kandi",  label: "Kandi + totem (foldable)", emoji: "🌈" },
  { id: "snacks", label: "Snacks + gum", emoji: "🍭" },
];

function PackListCard() {
  const [checked, setChecked] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`${FESTIVAL_CONFIG.id}_pack_v1`) || "{}"); }
    catch { return {}; }
  });
  const [custom, setCustom] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("pack_custom_v1") || "[]"); }
    catch { return []; }
  });
  const [draft, setDraft] = React.useState("");

  const saveChecked = (next) => {
    setChecked(next);
    try { localStorage.setItem(`${FESTIVAL_CONFIG.id}_pack_v1`, JSON.stringify(next)); } catch {}
  };
  const saveCustom = (next) => {
    setCustom(next);
    try { localStorage.setItem("pack_custom_v1", JSON.stringify(next)); } catch {}
  };

  const toggle = (id) => saveChecked({ ...checked, [id]: !checked[id] });

  const addItem = () => {
    const label = draft.trim();
    if (!label) return;
    const id = "c_" + Date.now();
    saveCustom([...custom, { id, label, emoji: "📝" }]);
    setDraft("");
  };
  const removeCustom = (id) => {
    saveCustom(custom.filter(it => it.id !== id));
    const next = { ...checked };
    delete next[id];
    saveChecked(next);
  };

  const allItems = [...PACK_ITEMS, ...custom];
  const done = allItems.filter(i => checked[i.id]).length;

  const itemRow = (it, isLast, isCustom) => (
    <div key={it.id} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 4px",
      borderBottom: isLast ? "none" : "1px solid var(--line)",
    }}>
      <button onClick={() => toggle(it.id)} style={{
        display: "flex", alignItems: "center", gap: 12, flex: 1,
        background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 6,
          background: checked[it.id] ? "var(--ember)" : "transparent",
          border: `1.5px solid ${checked[it.id] ? "var(--ember)" : "var(--line-2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 12, fontWeight: 700,
          flexShrink: 0, transition: "all .15s",
        }}>{checked[it.id] ? "✓" : ""}</span>
        <span style={{ fontSize: 14, opacity: 0.7, width: 22, textAlign: "center" }}>{it.emoji}</span>
        <span style={{
          flex: 1, fontFamily: "Geist, sans-serif", fontSize: 14,
          color: checked[it.id] ? "var(--muted)" : "var(--ink)",
          textDecoration: checked[it.id] ? "line-through" : "none",
          transition: "color .15s",
        }}>{it.label}</span>
      </button>
      {isCustom && (
        <button onClick={() => removeCustom(it.id)} style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0,
        }}>×</button>
      )}
    </div>
  );

  return (
    <div style={{ marginTop: 20, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="serif" style={{ fontSize: 22 }}>Pack list</div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: done === allItems.length ? "var(--success)" : "var(--muted)", fontWeight: 700 }}>
          {done}/{allItems.length} {done === allItems.length && "✓"}
        </div>
      </div>
      {PACK_ITEMS.map((it, i) => itemRow(it, i === allItems.length - 1 && custom.length === 0, false))}
      {custom.map((it, i) => itemRow(it, i === custom.length - 1, true))}
      {/* Add custom item */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addItem()}
          placeholder="Add an item…"
          style={{
            flex: 1, background: "var(--paper-2)", border: "1px solid var(--line-2)",
            borderRadius: 10, padding: "9px 12px",
            fontFamily: "Geist, sans-serif", fontSize: 14, color: "var(--ink)", outline: "none",
          }}
        />
        <button onClick={addItem} style={{
          background: draft.trim() ? "var(--ember)" : "var(--paper-2)",
          color: draft.trim() ? "#fff" : "var(--muted)",
          border: "none", borderRadius: 10, padding: "9px 14px",
          cursor: draft.trim() ? "pointer" : "default",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1, fontWeight: 700,
          transition: "all .15s",
        }}>ADD</button>
      </div>
    </div>
  );
}

// Me+ / Plenty of Fish-modeled badges section. Festival milestones
// derived from state.saved + ARTISTS data, no new infra. Earned badges
// render full-color; locked stay greyed out with their unlock criteria
// visible so users know what to chase.
function BadgesSection({ state }) {
  const saved = state.saved || [];
  const savedArtists = saved
    .map(id => window.ARTISTS?.find(a => a.id === id))
    .filter(Boolean);
  const stageCount = new Set(savedArtists.map(a => a.stage)).size;
  const headlinerCount = savedArtists.filter(a => a.tier === 3).length;
  const byStage = (stageId) => savedArtists.filter(a => a.stage === stageId).length;
  // Hours of music saved across all nights
  const totalMin = savedArtists.reduce((acc, a) => {
    const s = window.toNightMin?.(a.start) || 0;
    const e = window.toNightMin?.(a.end) || 0;
    return acc + Math.max(0, e - s);
  }, 0);
  const hasSunriseSet = savedArtists.some(a => {
    const s = window.toNightMin?.(a.start) || 0;
    return s >= 18 * 60; // 02:00+ in night-min space = sunrise-adjacent
  });

  const BADGES = [
    { id: "first-save",    icon: "✦", name: "First Save",       desc: "Save your first set",                earned: savedArtists.length >= 1 },
    { id: "all-stages",    icon: "◉", name: "All 9 Stages",     desc: "Save a set from every stage",        earned: stageCount >= 9 },
    { id: "five-stages",   icon: "◍", name: "Five Stages",      desc: "Save sets across 5+ stages",         earned: stageCount >= 5 },
    { id: "headliner",     icon: "★", name: "Headliner Hunter", desc: "Save 3+ tier-3 headliner sets",      earned: headlinerCount >= 3 },
    { id: "sunrise",       icon: "☀", name: "Sunrise Survivor", desc: "Save a set running past 2 AM",       earned: hasSunriseSet },
    { id: "ten-deep",      icon: "▤", name: "Ten Deep",         desc: "10+ saved sets across the run",      earned: savedArtists.length >= 10 },
    { id: "twenty-deep",   icon: "▥", name: "Twenty Deep",      desc: "20+ saved sets across the run",      earned: savedArtists.length >= 20 },
    { id: "trance-fam",    icon: "△", name: "Trance Family",    desc: "Save 3+ Quantum Valley sets",        earned: byStage("quantum") >= 3 },
    { id: "house-heads",   icon: "⬡", name: "House Heads HQ",   desc: "Save 3+ Neon Garden sets",           earned: byStage("neon") >= 3 },
    { id: "techno-vault",  icon: "▣", name: "Techno Vault",     desc: "Save 3+ Circuit Grounds sets",       earned: byStage("circuit") >= 3 },
    { id: "bass-faithful", icon: "◆", name: "Bass Faithful",    desc: "Save 3+ Basspod or Wasteland sets",  earned: (byStage("basspod") + byStage("waste")) >= 3 },
    { id: "marathon",      icon: "⌬", name: "Marathon",         desc: "6+ hours of saved music",            earned: totalMin >= 360 },
    { id: "thirty-years",  icon: "✺", name: "30 Years Crew",    desc: "Plursky veteran crew",     earned: true },
  ];

  const earned = BADGES.filter(b => b.earned);
  const locked = BADGES.filter(b => !b.earned);

  const cardStyle = (on) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 12,
    background: on ? "var(--paper-2)" : "var(--paper)",
    border: on ? "1px solid var(--line)" : "1px dashed var(--line-2)",
    opacity: on ? 1 : 0.55,
  });
  const iconCircle = (on) => ({
    width: 36, height: 36, borderRadius: 999,
    background: on ? "linear-gradient(135deg, var(--ember), var(--horizon))" : "var(--paper-2)",
    color: on ? "#fff" : "var(--muted)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "Instrument Serif, serif", fontSize: 18, flexShrink: 0,
    border: on ? "none" : "1px solid var(--line-2)",
  });

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: 700, color: "var(--ink)" }}>
          BADGES
        </span>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)" }}>
          {earned.length} of {BADGES.length} EARNED
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {earned.map(b => (
          <div key={b.id} style={cardStyle(true)}>
            <div style={iconCircle(true)}>{b.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.15 }}>{b.name}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>
                EARNED · {b.desc.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
        {locked.map(b => (
          <div key={b.id} style={cardStyle(false)}>
            <div style={iconCircle(false)}>{b.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.15, color: "var(--muted)" }}>{b.name}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>
                LOCKED · {b.desc.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Runbuds-modeled History/Records section. Lives on the Me page below
// the 4-card grid. History rows = per-night recap (sets caught, total
// minutes, top stage color stripe). Records = derived superlatives
// (most saved on one night, top stage, longest single set, etc.).
function HistoryRecordsSection({ state, setState }) {
  const [view, setView] = React.useState("history"); // "history" | "records"

  const days = Object.keys(window.FESTIVAL_CONFIG?.dayDates || {})
    .map(Number).sort((a, b) => a - b);

  // Per-night stats — for HISTORY rows.
  const nights = days.map((n) => {
    const dayDate = window.FESTIVAL_CONFIG.dayDates[n] || {};
    const savedThisDay = (state.saved || [])
      .map((id) => window.ARTISTS.find((a) => a.id === id))
      .filter((a) => a && a.day === n);
    const totalMin = savedThisDay.reduce((acc, a) => {
      const s = window.toNightMin?.(a.start) || 0;
      const e = window.toNightMin?.(a.end) || 0;
      return acc + Math.max(0, e - s);
    }, 0);
    // Top stage = stage with the most saved sets on this night
    const stageCounts = {};
    savedThisDay.forEach((a) => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1; });
    const topStageId = Object.keys(stageCounts).sort((x, y) => stageCounts[y] - stageCounts[x])[0];
    const topStage = topStageId ? window.STAGES.find((s) => s.id === topStageId) : null;
    return {
      n,
      label: dayDate.short || `DAY ${n}`,
      name:  dayDate.name  || "",
      count: savedThisDay.length,
      totalMin,
      topStage,
      isPast: typeof window.NOW !== "undefined" && window.NOW.day > n,
      isLive: typeof window.NOW !== "undefined" && window.NOW.day === n,
    };
  });

  // Records — superlatives derived from the saved set
  const records = (() => {
    const out = [];
    const allSaved = (state.saved || [])
      .map((id) => window.ARTISTS.find((a) => a.id === id))
      .filter(Boolean);
    if (allSaved.length === 0) return out;
    // Most saved on one night
    const peakNight = nights.slice().sort((a, b) => b.count - a.count)[0];
    if (peakNight && peakNight.count > 0) {
      out.push({
        label: "BUSIEST NIGHT",
        value: `${peakNight.label} · ${peakNight.count}`,
        accent: peakNight.topStage?.color || "var(--ember)",
      });
    }
    // Top stage across the run
    const stageAll = {};
    allSaved.forEach((a) => { stageAll[a.stage] = (stageAll[a.stage] || 0) + 1; });
    const topId = Object.keys(stageAll).sort((x, y) => stageAll[y] - stageAll[x])[0];
    const topStage = topId ? window.STAGES.find((s) => s.id === topId) : null;
    if (topStage) {
      out.push({
        label: "TOP STAGE",
        value: `${topStage.name.toUpperCase()} · ${stageAll[topId]}×`,
        accent: topStage.color,
      });
    }
    // Longest single set
    const longest = allSaved.slice().sort((x, y) => {
      const xLen = (window.toNightMin?.(y.end) || 0) - (window.toNightMin?.(y.start) || 0);
      const yLen = (window.toNightMin?.(x.end) || 0) - (window.toNightMin?.(x.start) || 0);
      return xLen - yLen;
    })[0];
    if (longest) {
      const len = (window.toNightMin?.(longest.end) || 0) - (window.toNightMin?.(longest.start) || 0);
      if (len > 0) {
        out.push({
          label: "LONGEST SET",
          value: `${longest.name.toUpperCase()} · ${Math.floor(len / 60) ? `${Math.floor(len / 60)}H` : ""}${len % 60}M`,
          accent: window.STAGES.find((s) => s.id === longest.stage)?.color || "var(--horizon)",
        });
      }
    }
    return out;
  })();

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Toggle pills */}
      <div style={{
        display: "inline-flex", padding: 3, gap: 2,
        background: "var(--paper-2)", borderRadius: 999,
        marginBottom: 10,
      }}>
        {["history", "records"].map((k) => {
          const on = view === k;
          return (
            <button key={k} onClick={() => setView(k)} className="mono" style={{
              padding: "5px 12px", borderRadius: 999, border: "none",
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--paper)" : "var(--ink)",
              fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
              cursor: "pointer",
            }}>{k.toUpperCase()}</button>
          );
        })}
      </div>

      {view === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {nights.map((n) => (
            <button key={n.n}
              onClick={() => setState && setState(s => ({ ...s, tab: "memories", memoriesNight: n.n }))}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: "var(--paper-2)",
                borderLeft: `3px solid ${n.topStage?.color || "var(--line-2)"}`,
                opacity: n.count === 0 && !n.isLive ? 0.62 : 1,
                border: "none", cursor: "pointer", textAlign: "left",
                width: "100%",
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 16, lineHeight: 1.15 }}>
                  {n.name || `Night ${n.n}`}
                  {n.isLive && (
                    <span className="mono" style={{
                      marginLeft: 8, fontSize: 8, letterSpacing: 1.2, fontWeight: 800,
                      color: "var(--success)", background: "rgba(45,122,85,0.14)",
                      padding: "1px 6px", borderRadius: 999,
                      border: "0.5px solid rgba(45,122,85,0.55)",
                    }}>● LIVE</span>
                  )}
                </div>
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 3,
                  display: "flex", gap: 8, flexWrap: "wrap",
                }}>
                  <span>{n.count} {n.count === 1 ? "SET" : "SETS"}</span>
                  {n.totalMin > 0 && (
                    <span>· {Math.floor(n.totalMin / 60) ? `${Math.floor(n.totalMin / 60)}H ` : ""}{n.totalMin % 60}M</span>
                  )}
                  {n.topStage && <span style={{ color: n.topStage.color, fontWeight: 700 }}>· {n.topStage.short || n.topStage.name.split(" ")[0].toUpperCase()}</span>}
                </div>
              </div>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                color: n.isPast ? "var(--muted)" : (n.isLive ? "var(--success)" : "var(--horizon)"),
              }}>{n.isPast ? "DONE" : n.isLive ? "TONIGHT" : "UPCOMING"}</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6 }}>›</span>
            </button>
          ))}
        </div>
      )}

      {view === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {records.length === 0 ? (
            <div style={{
              padding: "18px 14px", borderRadius: 12, background: "var(--paper-2)",
              textAlign: "center",
            }}>
              <div className="serif" style={{ fontSize: 16, marginBottom: 4 }}>No records yet</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)" }}>
                SAVE SETS TO UNLOCK SUPERLATIVES
              </div>
            </div>
          ) : records.map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: "var(--paper-2)",
              borderLeft: `3px solid ${r.accent}`,
            }}>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
                width: 110, flexShrink: 0,
              }}>{r.label}</div>
              <div style={{ fontFamily: "Geist, sans-serif", fontSize: 13, fontWeight: 500, flex: 1 }}>
                {r.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Memories: photos + moments per night ──────────────────────────
// Metadata in localStorage (small JSON, sync access for MEMORIES count).
// Photos in IndexedDB (Blob-native, big quota on iOS Safari ~hundreds of MB).
// Zero backend cost — everything stays on-device.

const MOMENTS_KEY = "plursky_moments_v1";

function _readMoments() {
  try { return JSON.parse(localStorage.getItem(MOMENTS_KEY) || "{}"); }
  catch { return {}; }
}
function _writeMoments(all) {
  localStorage.setItem(MOMENTS_KEY, JSON.stringify(all));
  // Fire so cross-screen consumers (per-artist strip on Artist screen,
  // Recap counts, etc.) re-read without prop-drilling.
  try { window.dispatchEvent(new CustomEvent("plursky-moments-change")); } catch {}
}
function _countMoments() {
  const all = _readMoments();
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}

let _memDbP = null;
function _openMemDB() {
  if (_memDbP) return _memDbP;
  _memDbP = new Promise((resolve, reject) => {
    const req = indexedDB.open("plursky_memories", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
  return _memDbP;
}
async function _putPhoto(id, blob) {
  const db = await _openMemDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put({ id, blob, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
}
async function _getPhoto(id) {
  const db = await _openMemDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const r  = tx.objectStore("photos").get(id);
    r.onsuccess = () => resolve(r.result?.blob || null);
    r.onerror   = e => reject(e.target.error);
  });
}
async function _deletePhoto(id) {
  const db = await _openMemDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
}

// Compress on pick: 720px max edge, JPEG q0.78 → typical 80-150KB.
function _compressMomentImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxEdge = 720;
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) resolve(blob); else reject(new Error("blob conversion failed"));
        }, "image/jpeg", 0.78);
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

// v135: videos go in as-is — no transcoding in-browser (would need FFmpeg
// WASM, way too heavy). Cap at 200 MB per clip so a stray 4K Cinematic
// can't blow out the IndexedDB quota in a single import.
const _MAX_VIDEO_BYTES = 200 * 1024 * 1024;
async function _processMomentMedia(file) {
  if (/^image\//.test(file.type)) {
    return { blob: await _compressMomentImage(file), kind: "image" };
  }
  if (/^video\//.test(file.type)) {
    if (file.size > _MAX_VIDEO_BYTES) {
      throw new Error(`Video too large (${Math.round(file.size / 1048576)} MB > 200 MB cap)`);
    }
    // Store raw — modern iOS records H.265/HEVC which Safari plays natively.
    return { blob: file, kind: "video" };
  }
  throw new Error("Unsupported file type: " + file.type);
}

// Fallback ladder when EXIF is missing:
//   1. XMP date (handled in _parseExifMeta — it scans XMP segments too now)
//   2. Filename pattern (iOS "Screenshot ..." / "Photo on ..." / Android
//      IMG_YYYYMMDD_HHMMSS)
//   3. file.lastModified — BUT only if it's clearly the original capture
//      time, not the WebKit conversion timestamp. iOS WKWebView's
//      HEIC→JPEG conversion sets lastModified to "now"; trusting that
//      would dump every photo into the current festival night fallback.
//      The heuristic: lastModified within 30s of now ⇒ conversion stamp,
//      skip it.
function _metaFromFile(file, exifMeta) {
  const out = { date: exifMeta?.date || null, lat: exifMeta?.lat ?? null, lng: exifMeta?.lng ?? null };
  if (!out.date) {
    const fileDate = _parseFilenameDate(file?.name);
    if (fileDate) out.date = fileDate;
  }
  if (!out.date && file?.lastModified) {
    const ageMs = Date.now() - file.lastModified;
    // <30s old = almost certainly WebKit's conversion timestamp, not the
    // photo's real capture time. Skip in that case so the moment lands
    // as fallback (truthfully no-date) rather than tagged to today's
    // night using a manufactured timestamp.
    if (ageMs >= 30 * 1000) {
      const d = new Date(file.lastModified);
      out.date = {
        yr: d.getFullYear(), mo: d.getMonth() + 1, dy: d.getDate(),
        hh: d.getHours(), mm: d.getMinutes(), ss: d.getSeconds(),
      };
    }
  }
  return out;
}

function _fmtMomentTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function useMomentPhoto(photoId) {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!photoId) { setUrl(null); return; }
    let cancelled = false;
    let objectUrl = null;
    _getPhoto(photoId).then(blob => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);
  return url;
}

// Single memory thumbnail for the home strip — loads its photo blob lazily.
function _HomeMemoryThumb({ moment, onClick }) {
  const url = useMomentPhoto(moment.photoId);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 96, height: 128, borderRadius: 14,
      border: "1px solid var(--line)", overflow: "hidden", position: "relative",
      background: url ? "#000" : "var(--paper-2)", cursor: "pointer", padding: 0,
    }}>
      {url ? (
        // Video needs <video preload="metadata"> to paint a poster frame —
        // a blob URL inside <img> renders as a blank/black tile.
        moment.kind === "video" ? (
          <video src={url} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}/>
        ) : (
          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        )
      ) : (
        <div className="skel" style={{ width: "100%", height: "100%" }}/>
      )}
      {moment.kind === "video" && (
        <div style={{
          position: "absolute", top: 6, right: 6, width: 20, height: 20,
          borderRadius: 20, background: "rgba(0,0,0,0.45)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, paddingLeft: 1,
        }}>▶</div>
      )}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent)",
        padding: "16px 8px 7px",
      }}>
        <div className="mono" style={{ fontSize: 8, letterSpacing: 0.6, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {artist ? artist.name.toUpperCase() : "NIGHT " + moment.night}
        </div>
      </div>
    </button>
  );
}

// Home-screen "Your Memories" strip (B) — horizontal scroll of the most
// recent captured photos/videos. Grows as the festival progresses; the
// retention loop's front door so the rewatch surface isn't buried in Me.
function HomeMemoriesStrip({ state, setState }) {
  const [all, setAll] = React.useState(() => { try { return _readMoments(); } catch { return {}; } });
  React.useEffect(() => {
    const refresh = () => { try { setAll(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);

  const recent = React.useMemo(() => {
    const flat = [];
    Object.values(all).forEach(arr => { if (Array.isArray(arr)) flat.push(...arr); });
    return flat
      .filter(m => m.photoId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);
  }, [all]);

  if (recent.length === 0) return null;
  const total = recent.length;
  const go = (night) => (window._pushNav || ((n) => setState({ ...state, ...n })))({ tab: "memories", memoriesNight: night, artist: null });

  return (
    <div data-animate style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="serif" style={{ fontSize: 22 }}>
          Your <span style={{ fontStyle: "italic", color: "var(--ember)" }}>memories</span>
        </div>
        <button onClick={() => go(NOW.day)} className="mono" style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700,
        }}>SEE ALL →</button>
      </div>
      <div className="no-scrollbar" style={{
        display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
        marginRight: -16, paddingRight: 16,
      }}>
        {recent.map(m => (
          <_HomeMemoryThumb key={m.id} moment={m} onClick={() => go(m.night || NOW.day)} />
        ))}
      </div>
    </div>
  );
}

// Short label for how a moment got its tag. Shown as a small chip so the
// user can tell at a glance whether the auto-tagger was confident or
// dropped this one into a fallback bucket they should retag.
// ── Setlist-to-photo song matching ──────────────────────────────
// Two sources: 1001tracklists (has timestamps, best for DJs) and
// setlist.fm (has API, best for live acts). Try 1001tl first.
const _setlistCache = {};

async function _getSupabaseTracklist(artistName) {
  try {
    const festId = window.FESTIVAL_CONFIG?.id || "edc-lv-2026";
    const url = `https://pzoijbqsbbwyuyjinjtj.supabase.co/rest/v1/tracklists?artist_name=eq.${encodeURIComponent(artistName)}&festival_id=eq.${encodeURIComponent(festId)}&select=tracks,source,source_url`;
    const res = await fetch(url, {
      headers: {
        "apikey": window.SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2lqYnFzYmJ3eXV5amluanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU3NzkwNDUsImV4cCI6MjAzMTM1NTA0NX0.aYMVriNmLAlkCN4DI1HGrj7VH9MNUxbYg8I1kpGl3Ow",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length || !rows[0].tracks?.length) return null;
    return { source: rows[0].source || "1001tracklists", tracks: rows[0].tracks, url: rows[0].source_url };
  } catch { return null; }
}

async function _getSetlistFmData(artistName) {
  try {
    const setlists = await window.fetchSetlists?.(artistName);
    if (!setlists?.length) return null;
    const festBrand = (window.FESTIVAL_CONFIG?.brand || "").toLowerCase();
    const festSetlist = setlists.find(sl => {
      const v = (sl.venue?.name || "").toLowerCase();
      return v.includes(festBrand) || v.includes("electric daisy") || v.includes("motor speedway") ||
        v.includes("zilker") || v.includes("austin city");
    });
    const target = festSetlist || setlists[0];
    const songs = (target.sets?.set || []).flatMap(s => (s.song || []).map(song => song.name)).filter(Boolean);
    if (!songs.length) return null;
    return { source: "setlist.fm", songs, venue: target.venue?.name };
  } catch { return null; }
}

async function _getTracklistForArtist(artistName) {
  const key = artistName.toLowerCase().replace(/\W+/g, "_");
  if (_setlistCache[key]) return _setlistCache[key];
  const tl = await _getSupabaseTracklist(artistName);
  if (tl) { _setlistCache[key] = tl; return tl; }
  const sl = await _getSetlistFmData(artistName);
  if (sl) { _setlistCache[key] = sl; return sl; }
  _setlistCache[key] = null;
  return null;
}

function _matchSongAtTime(artist, trackData, photoTakenAt) {
  if (!photoTakenAt || !artist) return null;
  const CFG = window.FESTIVAL_CONFIG || {};
  const dm = CFG.dayDates?.[artist.day];
  if (!dm) return null;
  const [sh, sm] = artist.start.split(":").map(Number);
  const setStartMs = dm.midnightUtc + (sh < 6 ? sh + 24 : sh) * 3600000 + sm * 60000;
  const photoMs = Date.parse(photoTakenAt.replace(" ", "T"));
  if (isNaN(photoMs)) return null;
  const elapsedMs = photoMs - setStartMs;
  if (elapsedMs < 0) return null;

  if (trackData.source === "1001tracklists" && trackData.tracks?.length) {
    let matched = trackData.tracks[0];
    for (const t of trackData.tracks) {
      if (t.timeMs <= elapsedMs) matched = t;
      else break;
    }
    const display = matched.artist ? `${matched.artist} — ${matched.title}` : matched.title;
    return { song: display, source: "1001tracklists", confidence: "exact", url: trackData.url };
  }

  if (trackData.source === "setlist.fm" && trackData.songs?.length) {
    const [eh, em] = artist.end.split(":").map(Number);
    const setEndMs = dm.midnightUtc + (eh < 6 ? eh + 24 : eh) * 3600000 + em * 60000;
    const setDuration = setEndMs - setStartMs;
    if (setDuration <= 0 || elapsedMs > setDuration) return null;
    const idx = Math.min(Math.floor((elapsedMs / setDuration) * trackData.songs.length), trackData.songs.length - 1);
    return { song: trackData.songs[idx], source: "setlist.fm", confidence: "estimated" };
  }
  return null;
}

function useSetlistSong(artist, takenAt) {
  const [result, setResult] = React.useState(null);
  React.useEffect(() => {
    if (!artist || !takenAt) return;
    let cancelled = false;
    _getTracklistForArtist(artist.name).then(data => {
      if (cancelled || !data) return;
      const r = _matchSongAtTime(artist, data, takenAt);
      if (r) setResult(r);
    });
    return () => { cancelled = true; };
  }, [artist?.id, takenAt]);
  return result;
}

const _TAG_SOURCE_LABEL = {
  exif:                 { text: "AUTO · EXIF",       tone: "ok" },
  filetime:             { text: "AUTO · FILE TIME",  tone: "ok" },
  "exif-night-only":    { text: "EXIF NIGHT · PICK A SET", tone: "warn" },
  "filetime-night-only":{ text: "FILE TIME · PICK A SET",  tone: "warn" },
  off_stage:            { text: "📍 BETWEEN SETS",    tone: "info" },
  fallback:             { text: "FALLBACK · RETAG",  tone: "warn" },
  manual:               { text: "MANUAL",            tone: "ok" },
};

// Best-available capture time for a moment. handleBatchPick stores both
// `createdAt` (import wall-clock, same for every photo in a batch) and
// `takenAt` (the actual EXIF / lastModified capture moment, formatted as
// "YYYY-MM-DD HH:MM"). Manually-added moments have no takenAt; their
// createdAt IS the capture moment. Prefer takenAt when present.
function _momentCaptureMs(m) {
  if (m.takenAt) {
    const t = Date.parse(m.takenAt.replace(" ", "T"));
    if (!isNaN(t)) return t;
  }
  return m.createdAt || 0;
}

// Free-tier "AI workaround": find other moments tagged within ±30 min of
// THIS moment's CAPTURE time (not import time) on the same night and
// suggest the most-common artist. If the user has already tagged any
// moment near this photo's time, we have strong signal without calling a
// vision model. Returns null when there's nothing to suggest.
function _siblingSuggestionFor(moment, allMoments) {
  if (moment.artistId) return null;
  const nightMoments = allMoments[moment.night] || [];
  const myTime = _momentCaptureMs(moment);
  if (!myTime) return null;
  const WINDOW_MS = 30 * 60 * 1000;
  const counts = new Map();
  for (const m of nightMoments) {
    if (!m.artistId || m.id === moment.id) continue;
    const theirTime = _momentCaptureMs(m);
    if (!theirTime) continue;
    if (Math.abs(theirTime - myTime) > WINDOW_MS) continue;
    counts.set(m.artistId, (counts.get(m.artistId) || 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestId = null, bestCount = 0;
  for (const [id, n] of counts) {
    if (n > bestCount) { bestId = id; bestCount = n; }
  }
  return { artistId: bestId, count: bestCount };
}

// One-tap bulk retag for a stuck untagged batch. Appears above the TO
// RETAG group when 3+ moments are sitting untagged and the user has
// saved artists for that night. Tap a chip → all moments in the group
// get that artistId at once. Confirms before applying since this is a
// destructive-ish action (it overwrites any partial tags).
function BulkRetagRow({ moments, savedNightArtists, onUpdate }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const apply = (artistId) => {
    try { window.plurskyHaptic?.("MEDIUM"); } catch {}
    for (const m of moments) {
      onUpdate?.(m, { artistId, tagSource: "manual", autoTagged: false });
    }
    setConfirmId(null);
  };
  return (
    <div style={{
      margin: "8px 0 10px", padding: "9px 10px",
      background: "var(--paper-2)", border: "1px dashed var(--line-2)", borderRadius: 10,
    }}>
      <div className="mono" style={{
        fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700,
        marginBottom: 6,
      }}>
        ⚡ BULK · TAG ALL {moments.length} AS
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {savedNightArtists
          .slice()
          .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
          .map(a => {
            const stage = STAGES.find(s => s.id === a.stage);
            const isConfirming = confirmId === a.id;
            return (
              <button key={a.id}
                onClick={() => isConfirming ? apply(a.id) : setConfirmId(a.id)}
                className="mono" style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: isConfirming ? "var(--ember)" : (stage ? `${stage.color}18` : "var(--paper)"),
                  color:      isConfirming ? "#fff" : (stage ? stage.color : "var(--ink)"),
                  border:     isConfirming ? "none" : (stage ? `1px solid ${stage.color}40` : "1px solid var(--line-2)"),
                  fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>
                {isConfirming ? `TAP AGAIN TO TAG ${moments.length}` : a.name.toUpperCase()}
              </button>
            );
          })}
        {confirmId && (
          <button onClick={() => setConfirmId(null)} className="mono" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            padding: "5px 8px",
          }}>CANCEL</button>
        )}
      </div>
    </div>
  );
}

// ── Retroactive song ID from a video's own audio ─────────────────
// The unlock: the music in a video you already shot IS the recognition
// sample. Identifying it turns the song tag from a tracklist *estimate*
// into ground truth — and if the matched artist contradicts the photo's
// auto-tag, that's a signal to fix the tag (and therefore the location).
// Native iOS uses ShazamPlugin.identifyFile (exact, on-device). Web
// captures the playing video's audio and routes it to the recognize-song
// proxy. Returns { title, artist, source } or null.
async function identifySongFromVideo(moment, onProgress) {
  if (!moment?.photoId || moment.kind !== "video") return null;
  const blob = await _getPhoto(moment.photoId).catch(() => null);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    onProgress?.("listening");
    // Web path: play the video muted-to-user through Web Audio, record
    // ~10s of its audio track, hand the clip to the recognition proxy.
    const video = document.createElement("video");
    video.src = url; video.muted = false; video.volume = 0; // route to graph, not speakers
    video.playsInline = true;
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const srcNode = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    srcNode.connect(dest);
    const rec = new MediaRecorder(dest.stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const done = new Promise((resolve) => { rec.onstop = resolve; });
    rec.start();
    await video.play().catch(() => {});
    const clipMs = Math.min(12000, (video.duration || 12) * 1000);
    await new Promise(r => setTimeout(r, clipMs));
    if (rec.state === "recording") rec.stop();
    await done;
    video.pause();
    try { ctx.close(); } catch {}
    const audioBlob = new Blob(chunks, { type: rec.mimeType });
    onProgress?.("matching");
    const form = new FormData();
    form.append("audio", audioBlob, "clip.webm");
    const res = await fetch("https://pzoijbqsbbwyuyjinjtj.functions.supabase.co/recognize-song", {
      method: "POST", body: form,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title) return null;
    return { title: data.title, artist: data.artist || "", source: "video-shazam" };
  } catch { return null; }
  finally { URL.revokeObjectURL(url); }
}

// Given a Shazam-matched artist name, find the lineup artist it best
// corresponds to — used to detect when a video's true audio disagrees
// with the photo's auto-tag (proves the user was at a different stage).
function _lineupArtistFromShazam(shazamArtist) {
  if (!shazamArtist) return null;
  const norm = shazamArtist.toLowerCase().trim();
  return ARTISTS.find(a => {
    const an = a.name.toLowerCase();
    return an === norm || an.includes(norm) || norm.includes(an.split(/ b2b /i)[0]);
  }) || null;
}

// ── Full-screen photo lightbox — the rewatch surface ─────────────
// Tap any memory to open it full-bleed on black: the photo, the artist,
// and — the Plursky signature — the song that was playing the moment you
// took it. Swipe or tap edges to move through the group. Modeled on
// Careem/NAVER photo viewers (close top-left, counter top-right, caption
// + filmstrip at the bottom) per the Mobbin design pass.
function MomentLightbox({ moments, index, onClose, onIndexChange, onArtistClick, onUpdate }) {
  const m = moments[index];
  const photoUrl = useMomentPhoto(m?.photoId);
  const artist = m?.artistId ? ARTISTS.find(a => a.id === m.artistId) : null;
  const stage  = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const estimatedSong = useSetlistSong(artist, m?.takenAt);
  // Prefer a Shazam-confirmed song over the tracklist estimate.
  const song   = m?.confirmedSong ? { song: m.confirmedSong } : estimatedSong;
  const touch  = React.useRef({ x: 0 });
  const [idState, setIdState] = React.useState("idle"); // idle|listening|matching|done|fail
  const [mismatch, setMismatch] = React.useState(null);  // suggested artist if audio disagrees with tag

  React.useEffect(() => { setIdState("idle"); setMismatch(null); }, [index]);

  const runIdentify = async () => {
    setIdState("listening");
    const result = await identifySongFromVideo(m, (p) => setIdState(p));
    if (!result) { setIdState("fail"); setTimeout(() => setIdState("idle"), 2500); return; }
    setIdState("done");
    const confirmed = result.artist ? `${result.artist} — ${result.title}` : result.title;
    onUpdate?.(m, { confirmedSong: confirmed, songSource: "video-shazam" });
    // Cross-check: does the recognized artist contradict the photo's tag?
    const matchedArtist = _lineupArtistFromShazam(result.artist);
    if (matchedArtist && matchedArtist.id !== m.artistId) setMismatch(matchedArtist);
    try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < moments.length - 1) onIndexChange(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, moments.length]);

  if (!m) return null;
  const prettyTime = (() => {
    if (!m.takenAt) return null;
    try {
      const t = m.takenAt.split(" ")[1] || "";
      const [h, mm] = t.split(":").map(Number);
      const ap = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
      return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
    } catch { return null; }
  })();

  const onTouchStart = (e) => { touch.current.x = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touch.current.x;
    if (dx < -50 && index < moments.length - 1) onIndexChange(index + 1);
    if (dx >  50 && index > 0) onIndexChange(index - 1);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: "#000",
      display: "flex", flexDirection: "column", animation: "fadeIn .2s",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close" style={{
          width: 36, height: 36, borderRadius: 36, border: "none",
          background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
        <span className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
          {index + 1} / {moments.length}
        </span>
      </div>

      {/* Photo — tap left/right thirds to navigate */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{
        flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {photoUrl ? (
          m.kind === "video"
            ? <video src={photoUrl} controls playsInline autoPlay style={{ maxWidth: "100%", maxHeight: "100%" }}/>
            : <img src={photoUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
        ) : (
          <div className="skel-dark" style={{ width: "80%", height: "60%", borderRadius: 12 }}/>
        )}
        {index > 0 && (
          <button onClick={() => onIndexChange(index - 1)} aria-label="Previous" style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: "30%",
            background: "transparent", border: "none", cursor: "pointer", color: "transparent",
          }}>‹</button>
        )}
        {index < moments.length - 1 && (
          <button onClick={() => onIndexChange(index + 1)} aria-label="Next" style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: "30%",
            background: "transparent", border: "none", cursor: "pointer", color: "transparent",
          }}>›</button>
        )}
      </div>

      {/* Caption — artist · song that was playing · stage · time */}
      <div style={{ padding: "16px 20px calc(20px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
        {artist ? (
          <button onClick={() => { onArtistClick?.(artist.id); onClose(); }} style={{
            background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", display: "block",
          }}>
            <div className="serif" style={{ fontSize: 26, lineHeight: 1, color: "#fff", marginBottom: 6 }}>
              {artist.name}
            </div>
          </button>
        ) : (
          <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "rgba(255,255,255,0.6)", fontStyle: "italic", marginBottom: 6 }}>
            Untagged moment
          </div>
        )}
        {song?.song && (
          <div className="mono" style={{ fontSize: 11, letterSpacing: 0.8, color: stage?.color || "var(--ember)", fontWeight: 700, marginBottom: 4 }}>
            ♫ {song.song}
            {m.confirmedSong && <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>· SHAZAMED</span>}
          </div>
        )}
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
          {[stage?.name?.toUpperCase(), prettyTime, m.location?.label?.toUpperCase()].filter(Boolean).join(" · ")}
        </div>

        {/* Retroactive song ID — video moments only. The audio you shot
            becomes the recognition sample: estimate → proven. */}
        {m.kind === "video" && !m.confirmedSong && (
          <button onClick={runIdentify} disabled={idState !== "idle" && idState !== "fail"} className="mono" style={{
            marginTop: 12, padding: "9px 14px", borderRadius: 999, width: "100%",
            background: idState === "fail" ? "rgba(232,93,46,0.2)" : "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.25)", color: "#fff",
            fontSize: 10, letterSpacing: 1.3, fontWeight: 700, cursor: "pointer",
          }}>
            {idState === "idle"      ? "🎵 IDENTIFY THE SONG FROM THIS VIDEO"
             : idState === "listening" ? "● LISTENING TO YOUR VIDEO…"
             : idState === "matching"  ? "◌ MATCHING…"
             : idState === "fail"      ? "NO MATCH — TRY ANOTHER CLIP"
             : "✓ IDENTIFIED"}
          </button>
        )}

        {/* Audio disagrees with the auto-tag → offer the correction */}
        {mismatch && (
          <button onClick={() => { onUpdate?.(m, { artistId: mismatch.id, tagSource: "video-shazam", autoTagged: false }); setMismatch(null); }} style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 10, width: "100%",
            background: "rgba(245,154,54,0.15)", border: "1px solid rgba(245,154,54,0.45)",
            color: "#fde68a", cursor: "pointer", textAlign: "left",
          }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 700, marginBottom: 2 }}>
              AUDIO SAYS {mismatch.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              This video's song is {mismatch.name}'s — retag this moment to them? (You were probably at {STAGES.find(s => s.id === mismatch.stage)?.name || "their stage"}.)
            </div>
          </button>
        )}

        {/* Filmstrip — quick-jump within the group */}
        {moments.length > 1 && (
          <div className="no-scrollbar" style={{ display: "flex", gap: 5, overflowX: "auto", marginTop: 14, scrollbarWidth: "none" }}>
            {moments.map((mm, i) => (
              <_LightboxThumb key={mm.id} moment={mm} active={i === index} onClick={() => onIndexChange(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function _LightboxThumb({ moment, active, onClick }) {
  const url = useMomentPhoto(moment.photoId);
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 44, height: 44, borderRadius: 8, padding: 0, cursor: "pointer",
      border: active ? "2px solid #fff" : "2px solid transparent",
      opacity: active ? 1 : 0.5, overflow: "hidden", background: "#222",
      transition: "opacity 0.15s",
    }}>
      {url && <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>}
    </button>
  );
}

function MomentCard({ moment, idx, total, onDelete, onArtistClick, onUpdate, savedArtistIds, groupMoments, onOpenLightbox }) {
  const photoUrl = useMomentPhoto(moment.photoId);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  const stage  = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const nowPlaying = useSetlistSong(artist, moment.takenAt);
  const [editing, setEditing] = React.useState(false);
  const tagInfo = (() => {
    const base = _TAG_SOURCE_LABEL[moment.tagSource] || null;
    if (moment.tagSource === "off_stage" && moment.location) {
      return { text: `${moment.location.icon} ${moment.location.label.toUpperCase()}`, tone: "info" };
    }
    return base;
  })();
  // Sibling-suggestion: cheap "AI workaround" for untagged moments. Reads
  // localStorage moments (~hundreds of bytes) on each render — and on the
  // "plursky-moments-change" event so cascading retags update siblings.
  const [allMoments, setAllMoments] = React.useState(() => {
    try { return _readMoments(); } catch { return {}; }
  });
  React.useEffect(() => {
    const refresh = () => { try { setAllMoments(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  const suggestion = React.useMemo(
    () => _siblingSuggestionFor(moment, allMoments),
    [moment.id, moment.artistId, moment.night, moment.createdAt, allMoments]
  );
  const suggestedArtist = suggestion ? ARTISTS.find(a => a.id === suggestion.artistId) : null;
  const suggestedStage  = suggestedArtist ? STAGES.find(s => s.id === suggestedArtist.stage) : null;
  // Prefer the saved-on-this-night sets as the picker options (most likely
  // intent), with an "all sets" expand for the rare case the user took a
  // photo at a set they hadn't saved.
  const [showAll, setShowAll] = React.useState(false);
  // Recompute on every render so a night-change inside the editor swaps in
  // the new night's lineup without needing a parent re-key.
  const nightArtists = ARTISTS.filter(a => a.day === moment.night);
  const savedNightArtists = nightArtists.filter(a => (savedArtistIds || []).includes(a.id));
  const pickerArtists = showAll
    ? nightArtists
    : (savedNightArtists.length ? savedNightArtists : nightArtists);
  const setArtist = (id) => {
    try { window.plurskyHaptic?.("LIGHT"); } catch {}
    onUpdate?.(moment, { artistId: id, tagSource: "manual", autoTagged: false });
    setEditing(false);
  };
  const moveToNight = (n) => {
    if (n === moment.night) return;
    try { window.plurskyHaptic?.("LIGHT"); } catch {}
    // Drop artist when moving nights — old artist almost certainly belonged
    // to the wrong night's lineup. User picks a new one from the new night.
    onUpdate?.(moment, { night: n, artistId: null, tagSource: "manual", autoTagged: false });
  };
  return (
    <div style={{
      background: "var(--paper-2)", border: "1px solid var(--line)",
      borderRadius: 14, padding: 12, marginBottom: 10,
    }}>
      {moment.photoId && (
        photoUrl ? (
          moment.kind === "video" ? (
            <video src={photoUrl} controls playsInline preload="metadata" style={{
              width: "100%", borderRadius: 10, display: "block",
              marginBottom: moment.text ? 10 : 8,
              background: "#000",
            }}/>
          ) : (
            <img src={photoUrl} alt="" onClick={() => onOpenLightbox?.(groupMoments || [moment], idx || 0)} style={{
              width: "100%", borderRadius: 10, display: "block",
              marginBottom: moment.text ? 10 : 8,
              cursor: "pointer",
            }}/>
          )
        ) : (
          <div style={{
            width: "100%", aspectRatio: "4/3", borderRadius: 10,
            background: "var(--paper)", border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: moment.text ? 10 : 8,
          }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700 }}>
              LOADING…
            </span>
          </div>
        )
      )}
      {moment.text && (
        <div className="serif" style={{ fontSize: 18, lineHeight: 1.3, color: "var(--ink)" }}>
          {moment.text}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {artist ? (
          <button onClick={() => onArtistClick(artist.id)} className="mono" style={{
            background: stage ? `${stage.color}18` : "var(--paper)",
            color:      stage ? stage.color       : "var(--muted)",
            border:     stage ? `1px solid ${stage.color}40` : "1px solid var(--line-2)",
            borderRadius: 999, padding: "3px 9px",
            fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
          }}>♬ {artist.name.toUpperCase()}</button>
        ) : suggestion ? (
          <button onClick={() => setArtist(suggestion.artistId)} className="mono" title={`${suggestion.count} other moment${suggestion.count === 1 ? "" : "s"} in the same 30-min window tagged to this artist`} style={{
            background: suggestedStage ? `${suggestedStage.color}18` : "var(--paper-2)",
            color:      suggestedStage ? suggestedStage.color       : "var(--ink)",
            border:     suggestedStage ? `1px dashed ${suggestedStage.color}66` : "1px dashed var(--line-2)",
            borderRadius: 999, padding: "3px 9px",
            fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            + TAG AS {suggestedArtist?.name.toUpperCase() || "—"} ({suggestion.count})
          </button>
        ) : (
          <button onClick={() => setEditing(true)} className="mono" style={{
            background: "rgba(232,93,46,0.12)", color: "var(--ember)",
            border: "1px dashed rgba(232,93,46,0.5)",
            borderRadius: 999, padding: "3px 9px",
            fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
          }}>+ TAG A SET</button>
        )}
        {/* Escape hatch — when sibling-suggestion is showing, also give the
            user a way to open the full editor in case the neighbour-pick
            is wrong (e.g., 3 nearby moments tagged Peggy Gou but THIS
            shot was a side trip to Cosmic Meadow). */}
        {!artist && suggestion && onUpdate && (
          <button onClick={() => setEditing(true)} className="mono" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
            padding: "3px 5px",
          }}>OTHER</button>
        )}
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 600 }}>
          {_fmtMomentTime(moment.createdAt)} · {idx + 1}/{total}
        </span>
        {artist && onUpdate && (
          <button onClick={() => setEditing(e => !e)} className="mono" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
            padding: "3px 5px",
          }}>{editing ? "DONE" : "EDIT TAG"}</button>
        )}
        <button onClick={() => onDelete(moment)} aria-label="Delete moment" className="mono" style={{
          marginLeft: "auto",
          background: "transparent", border: "none",
          color: "var(--muted)", cursor: "pointer",
          fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
          padding: "3px 5px",
        }}>DELETE</button>
      </div>
      {tagInfo && (
        <div className="mono" title={moment.takenAt ? `Photo time: ${moment.takenAt}` : undefined}
          style={{
            marginTop: 6, fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            color: tagInfo.tone === "warn" ? "var(--ember)" : "var(--muted)",
          }}>
          {tagInfo.text}{moment.takenAt ? ` · ${moment.takenAt.slice(11)}` : ""}
        </div>
      )}
      {moment.hasGps === false && moment.autoTagged && (
        <div className="mono" style={{
          marginTop: 4, fontSize: 8, letterSpacing: 1, color: "var(--muted)",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ opacity: 0.6 }}>📡</span> NO GPS — TAGGED BY TIME ONLY
        </div>
      )}
      {nowPlaying && (
        <div style={{
          marginTop: 5, animation: "song-fade-in 0.5s ease-out",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 22, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${stage?.color || "var(--horizon)"}22`,
              animation: "song-ripple 1.5s ease-out",
            }}>
              <span style={{ fontSize: 10, color: stage?.color || "var(--horizon)" }}>♫</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{
                fontSize: 8, letterSpacing: 0.8, fontWeight: 700,
                color: stage?.color || "var(--horizon)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {nowPlaying.song?.toUpperCase()}
              </div>
              {nowPlaying.source === "1001tracklists" && artist && (() => {
                const CFG = window.FESTIVAL_CONFIG || {};
                const dm = CFG.dayDates?.[artist.day];
                if (!dm) return null;
                const [sh, sm] = artist.start.split(":").map(Number);
                const [eh, em] = artist.end.split(":").map(Number);
                const setStartMs = dm.midnightUtc + (sh < 6 ? sh + 24 : sh) * 3600000 + sm * 60000;
                const setEndMs = dm.midnightUtc + (eh < 6 ? eh + 24 : eh) * 3600000 + em * 60000;
                const photoMs = Date.parse(moment.takenAt?.replace(" ", "T"));
                if (isNaN(photoMs)) return null;
                const elapsed = photoMs - setStartMs;
                const duration = setEndMs - setStartMs;
                if (duration <= 0 || elapsed < 0) return null;
                const pct = Math.min(elapsed / duration, 1);
                const mins = Math.round(elapsed / 60000);
                const totalMins = Math.round(duration / 60000);
                return (
                  <div className="mono" style={{
                    fontSize: 8, letterSpacing: 0.8, color: "var(--muted)",
                    marginTop: 1, display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>{mins}min into {totalMins}min set</span>
                    <div style={{
                      width: 30, height: 3, borderRadius: 2,
                      background: "rgba(255,255,255,0.1)",
                    }}>
                      <div style={{
                        width: `${pct * 100}%`, height: "100%", borderRadius: 2,
                        background: stage?.color || "var(--horizon)",
                      }} />
                    </div>
                  </div>
                );
              })()}
            </div>
            <span className="mono" style={{
              fontSize: 8, letterSpacing: 0.8, padding: "2px 5px", borderRadius: 4, flexShrink: 0,
              background: nowPlaying.confidence === "exact" ? "rgba(45,122,85,0.15)" : "rgba(232,93,46,0.1)",
              color: nowPlaying.confidence === "exact" ? "var(--success)" : "var(--ember)",
              fontWeight: 700,
            }}>{nowPlaying.confidence === "exact" ? "EXACT" : "~EST"}</span>
          </div>
        </div>
      )}
      {editing && onUpdate && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: "1px solid var(--line)",
        }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
            NIGHT
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(window.DAYS || []).map(d => {
              const on = moment.night === d.n;
              return (
                <button key={d.n} onClick={() => moveToNight(d.n)} className="mono" style={{
                  flex: 1, padding: "6px 0", borderRadius: 8,
                  background: on ? "var(--ink)"   : "var(--paper)",
                  color:      on ? "var(--paper)" : "var(--ink)",
                  border:     on ? "none"          : "1px solid var(--line-2)",
                  fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                }}>{(d.label || `DAY ${d.n}`).toString().toUpperCase()}</button>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
            {showAll ? "ALL SETS THIS NIGHT" : (savedNightArtists?.length ? "YOUR SAVED SETS THIS NIGHT" : "SETS THIS NIGHT")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {pickerArtists
              .slice()
              .sort((a, b) => a.start.localeCompare(b.start))
              .map(a => {
                const on = moment.artistId === a.id;
                return (
                  <button key={a.id} onClick={() => setArtist(on ? null : a.id)} className="mono" style={{
                    padding: "5px 10px", borderRadius: 999,
                    background: on ? "var(--ink)"   : "var(--paper)",
                    color:      on ? "var(--paper)" : "var(--ink)",
                    border:     on ? "none"          : "1px solid var(--line-2)",
                    fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}>{a.name.toUpperCase()}</button>
                );
              })}
            {pickerArtists.length === 0 && (
              <span className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 600 }}>
                NO SETS LISTED FOR THIS NIGHT
              </span>
            )}
          </div>
          {savedNightArtists?.length > 0 && (nightArtists?.length || 0) > savedNightArtists.length && (
            <button onClick={() => setShowAll(s => !s)} className="mono" style={{
              background: "transparent", border: "none", color: "var(--muted)",
              cursor: "pointer", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
              padding: 0,
            }}>{showAll ? "← BACK TO SAVED ONLY" : "SHOW ALL SETS THIS NIGHT →"}</button>
          )}
        </div>
      )}
    </div>
  );
}

// Shared renderer for the ARTIST / STAGE views in MemoriesScreen.
// Takes a flat moment list and a key extractor, builds groups, sorts,
// and renders each group as a stage-colored header + the MomentCards
// under it. Untagged moments float to the bottom via the sortKeys hook.
function _renderByGroup({ allMoments, keyOf, headerFor, sortKeys, state, setState, handleDelete, handleUpdate, onOpenLightbox }) {
  const groups = new Map();
  for (const m of allMoments) {
    const k = keyOf(m);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const keys = [...groups.keys()].sort(sortKeys);
  if (keys.length === 0) {
    return (
      <div style={{
        padding: "28px 14px", textAlign: "center", marginTop: 18,
        border: "1px dashed var(--line-2)", borderRadius: 14,
        background: "var(--paper-2)",
      }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          NO MOMENTS YET — IMPORT FROM CAMERA ROLL ABOVE
        </div>
      </div>
    );
  }
  return keys.map(k => {
    const items = groups.get(k).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const h = headerFor(k);
    return (
      <div key={k} style={{ marginTop: 18 }}>
        <button onClick={h.onClick || undefined} disabled={!h.onClick} style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "6px 4px",
          background: "transparent", border: "none",
          textAlign: "left", cursor: h.onClick ? "pointer" : "default",
        }}>
          <span style={{
            width: 4, alignSelf: "stretch",
            background: h.accent, borderRadius: 3, minHeight: 30,
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: h.accent,
            }}>{h.mono}</div>
            <div className="serif" style={{
              fontSize: 18, color: "var(--ink)", lineHeight: 1.1, marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{h.serif}</div>
          </div>
          <span className="mono" style={{
            fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 700,
            flexShrink: 0,
          }}>{items.length} {items.length === 1 ? "MOMENT" : "MOMENTS"}</span>
        </button>
        {items.map((m, i) => (
          <MomentCard
            key={m.id}
            moment={m}
            idx={i}
            total={items.length}
            groupMoments={items}
            onOpenLightbox={onOpenLightbox}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            savedArtistIds={state.saved || []}
            onArtistClick={(id) => setState(s => ({ ...s, artist: id }))}
          />
        ))}
      </div>
    );
  });
}

function AddMomentForm({ night, savedNightArtists, onAdd, onCancel }) {
  const [blob,       setBlob]       = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [text,       setText]       = React.useState("");
  const [artistId,   setArtistId]   = React.useState(null);
  const [busy,       setBusy]       = React.useState(false);
  const [err,        setErr]        = React.useState("");

  // Revoke any preview URL on unmount/replace.
  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const [mediaKind, setMediaKind] = React.useState("image"); // image | video
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try {
      // Read EXIF / fall back to file.lastModified so the matcher can pre-fill
      // the artist chip. _compressMomentImage strips EXIF (canvas re-encode)
      // so we have to read it BEFORE processing.
      const exif = await _parseExifMeta(file).catch(() => null);
      const meta = _metaFromFile(file, exif);
      if (meta && meta.date && !artistId) {
        const matched = _matchArtistForPhoto(meta, savedNightArtists.map(a => a.id));
        if (matched.artistId) setArtistId(matched.artistId);
      }
      const out = await _processMomentMedia(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(out.blob);
      setMediaKind(out.kind);
      setPreviewUrl(URL.createObjectURL(out.blob));
    } catch (err) {
      setErr(err?.message || "Couldn't load that file.");
    }
    setBusy(false);
  };
  const clearPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!blob && !text.trim()) {
      setErr("Add a photo or some text first.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let photoId = null;
      if (blob) {
        photoId = `p_${id}`;
        await _putPhoto(photoId, blob);
      }
      const moment = {
        id, night, text: text.trim(), artistId, photoId,
        kind: blob ? mediaKind : null,
        createdAt: Date.now(),
        tagSource: artistId ? "manual" : undefined,
      };
      onAdd(moment);
    } catch (e) {
      if (e?.name === "QuotaExceededError" || e?.message?.includes("quota")) {
        setErr("Storage full — delete an older moment to free space.");
      } else {
        setErr("Couldn't save. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: "var(--paper-2)", border: "1px solid var(--line-2)",
      borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 14,
    }}>
      {previewUrl ? (
        <div style={{ position: "relative", marginBottom: 10 }}>
          {mediaKind === "video" ? (
            <video src={previewUrl} controls playsInline
              style={{ width: "100%", borderRadius: 10, display: "block", background: "#000" }}/>
          ) : (
            <img src={previewUrl} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }}/>
          )}
          <button onClick={clearPhoto} aria-label="Remove media" style={{
            position: "absolute", top: 8, right: 8,
            width: 28, height: 28, borderRadius: 999,
            background: "rgba(0,0,0,0.55)", color: "#fff",
            border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}>×</button>
        </div>
      ) : (
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px", background: "var(--paper)", border: "1px dashed var(--line-2)",
          borderRadius: 10, cursor: "pointer", marginBottom: 10,
          color: "var(--muted)",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
        }}>
          <span>📷 ADD PHOTO OR VIDEO (OPTIONAL)</span>
          <input type="file" accept="image/*,video/*"
            onChange={handlePhoto} style={{ display: "none" }}/>
        </label>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What happened?"
        rows={2}
        maxLength={240}
        style={{
          width: "100%", padding: "10px 12px", boxSizing: "border-box",
          background: "var(--paper)", border: "1px solid var(--line-2)",
          borderRadius: 10, resize: "none",
          fontFamily: "Geist, sans-serif", fontSize: 14, lineHeight: 1.4,
          color: "var(--ink)", outline: "none", marginBottom: 10,
        }}
      />

      {savedNightArtists.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
            TAG A SET (OPTIONAL)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {savedNightArtists.map(a => {
              const on = artistId === a.id;
              return (
                <button key={a.id} onClick={() => setArtistId(on ? null : a.id)} className="mono" style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: on ? "var(--ink)"  : "var(--paper)",
                  color:      on ? "var(--paper)" : "var(--ink)",
                  border:     on ? "none"         : "1px solid var(--line-2)",
                  fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>{a.name.toUpperCase()}</button>
              );
            })}
          </div>
        </div>
      )}

      {err && (
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "#c14a4a", marginBottom: 10, fontWeight: 700 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} disabled={busy} className="mono" style={{
          flex: 1, padding: "12px", borderRadius: 10,
          background: "transparent", border: "1px solid var(--line-2)", color: "var(--ink)",
          fontSize: 10, letterSpacing: 1.2, fontWeight: 700, cursor: busy ? "default" : "pointer",
        }}>CANCEL</button>
        <button onClick={handleSave} disabled={busy} className="mono" style={{
          flex: 2, padding: "12px", borderRadius: 10,
          background: busy ? "var(--muted)" : "var(--ember)",
          color: "#fff", border: "none",
          fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}>{busy ? "WORKING…" : "✓ SAVE MOMENT"}</button>
      </div>
    </div>
  );
}

// ── EXIF + auto-tag (v135) ────────────────────────────────────
// Parse JPEG EXIF for DateTimeOriginal + GPSLatitude/Longitude so a
// photo dragged in from Camera Roll lands on the right artist without
// the user picking from a chip list. iOS encodes EXIF time as local
// wall-clock (no tz) — at EDC that's PT, so we treat the parsed
// "YYYY:MM:DD HH:MM:SS" string as PT and convert to epoch ms via the
// festival's day-midnight UTC constants (which already bake in PT).

const _EXIF_TAG_EXIF_IFD = 0x8769;
const _EXIF_TAG_GPS_IFD  = 0x8825;
const _EXIF_TAG_DATETIME_ORIGINAL = 0x9003;
const _EXIF_TAG_GPS_LAT_REF = 0x0001;
const _EXIF_TAG_GPS_LAT     = 0x0002;
const _EXIF_TAG_GPS_LNG_REF = 0x0003;
const _EXIF_TAG_GPS_LNG     = 0x0004;

// Try multiple date formats — ISO 8601 (XMP-style) and EXIF (colon-sep).
// Returns the canonical { yr, mo, dy, hh, mm, ss } shape or null.
function _parseDateString(s) {
  if (!s) return null;
  // ISO 8601: 2026-05-15T23:35:00(.000)?(±HH:MM|Z)?
  let m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  // EXIF colon: 2026:05:15 23:35:00
  m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  return null;
}

// XMP packets are XML embedded in an APP1 segment with the prefix
// "http://ns.adobe.com/xap/1.0/\0". WebKit (and most iOS pickers)
// sometimes strip the binary EXIF block but leave the XMP intact — so
// this is a real recovery path for "the photo has no DateTimeOriginal
// but the XMP CreateDate is fine". Regex over the packet text is way
// simpler than spinning up a DOM parser for the rare cases we hit it.
function _parseXmpDateFromText(xmpText) {
  if (!xmpText) return null;
  const patterns = [
    /<exif:DateTimeOriginal>([^<]+)<\/exif:DateTimeOriginal>/,
    /exif:DateTimeOriginal=["']([^"']+)["']/,
    /<photoshop:DateCreated>([^<]+)<\/photoshop:DateCreated>/,
    /photoshop:DateCreated=["']([^"']+)["']/,
    /<xmp:CreateDate>([^<]+)<\/xmp:CreateDate>/,
    /xmp:CreateDate=["']([^"']+)["']/,
  ];
  for (const re of patterns) {
    const m = re.exec(xmpText);
    if (m) {
      const parsed = _parseDateString(m[1].trim());
      if (parsed) return parsed;
    }
  }
  return null;
}

// Tertiary fallback when both EXIF and XMP are stripped: iOS screenshots
// and a few other system-generated files encode the capture time in the
// filename. Worth a try because file.lastModified on the WebKit picker
// path is usually the conversion timestamp (= "right now"), not when
// the photo was taken.
function _parseFilenameDate(name) {
  if (!name) return null;
  let m;
  // iOS screenshot: "Screenshot 2026-05-15 at 23.35.49.png"
  m = /Screenshot\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{2})\.(\d{2})\.(\d{2})/i.exec(name);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  // iOS "Photo on" format: "Photo on 2026-05-15 at 11.35 PM.jpg"
  m = /Photo\s+on\s+(\d{4})-(\d{2})-(\d{2})\s+at\s+(\d{1,2})\.(\d{2})\s*(AM|PM)/i.exec(name);
  if (m) {
    let hh = +m[4];
    if (/PM/i.test(m[6]) && hh < 12) hh += 12;
    if (/AM/i.test(m[6]) && hh === 12) hh = 0;
    return { yr: +m[1], mo: +m[2], dy: +m[3], hh, mm: +m[5], ss: 0 };
  }
  // Android camera: "IMG_20260515_233549.jpg" / "VID_20260515_233549.mp4"
  m = /[IV][MD][GP]_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(name);
  if (m) return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +m[6] };
  return null;
}

async function _parseExifMeta(file) {
  const out = { date: null, lat: null, lng: null };
  if (!file || !/^image\//.test(file.type)) return out;
  try {
    // 256 KB is enough for the APP1 segment on any modern phone photo.
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const dv = new DataView(buf);
    if (dv.getUint16(0) !== 0xFFD8) return out; // not a JPEG → no EXIF
    // Scan ALL APP1 segments — a file may have separate EXIF + XMP
    // segments, and WebKit's HEIC→JPEG conversion is observed to
    // sometimes strip one but preserve the other. Try both before
    // giving up.
    let off = 2;
    while (off + 4 < dv.byteLength) {
      if (dv.getUint8(off) !== 0xFF) break;
      const marker = dv.getUint16(off);
      const len    = dv.getUint16(off + 2);
      if (marker === 0xFFE1 && len > 8) {
        // "Exif\0\0" header at off+4
        const exifHdr =
          dv.getUint8(off + 4) === 0x45 && // E
          dv.getUint8(off + 5) === 0x78 && // x
          dv.getUint8(off + 6) === 0x69 && // i
          dv.getUint8(off + 7) === 0x66;   // f
        if (!exifHdr) {
          // Not EXIF — maybe XMP. Check the Adobe namespace header.
          if (!out.date) {
            const XMP_HDR = "http://ns.adobe.com/xap/1.0/";
            let isXmp = true;
            for (let i = 0; i < XMP_HDR.length; i++) {
              if (dv.getUint8(off + 4 + i) !== XMP_HDR.charCodeAt(i)) { isXmp = false; break; }
            }
            if (isXmp) {
              const xmpStart = off + 4 + XMP_HDR.length + 1; // skip header + NUL
              const xmpEnd   = off + 2 + len;
              let text = "";
              for (let i = xmpStart; i < Math.min(xmpEnd, dv.byteLength); i++) {
                text += String.fromCharCode(dv.getUint8(i));
              }
              const xmpDate = _parseXmpDateFromText(text);
              if (xmpDate) out.date = xmpDate;
            }
          }
          off += 2 + len; continue;
        }
        const tiff = off + 10;
        const byteOrder = dv.getUint16(tiff);
        const little = byteOrder === 0x4949;
        const u16 = (p) => dv.getUint16(p, little);
        const u32 = (p) => dv.getUint32(p, little);
        if (u16(tiff + 2) !== 0x002A) return out;
        const ifd0 = tiff + u32(tiff + 4);
        const readEntries = (ifdOff) => {
          const n = u16(ifdOff);
          const entries = {};
          for (let i = 0; i < n; i++) {
            const eOff = ifdOff + 2 + i * 12;
            entries[u16(eOff)] = {
              type:  u16(eOff + 2),
              count: u32(eOff + 4),
              valOff: eOff + 8, // 4-byte value or pointer
            };
          }
          return entries;
        };
        const ifd0Entries = readEntries(ifd0);
        // ExifIFD → DateTimeOriginal
        const exifPtr = ifd0Entries[_EXIF_TAG_EXIF_IFD];
        if (exifPtr) {
          const exifIfd = tiff + u32(exifPtr.valOff);
          const exifEntries = readEntries(exifIfd);
          const dto = exifEntries[_EXIF_TAG_DATETIME_ORIGINAL];
          if (dto && dto.count > 0) {
            // ASCII at value or pointer (string > 4 bytes → pointer)
            const strOff = dto.count > 4 ? tiff + u32(dto.valOff) : dto.valOff;
            let str = "";
            for (let i = 0; i < Math.min(dto.count - 1, 24); i++) {
              const c = dv.getUint8(strOff + i);
              if (c === 0) break;
              str += String.fromCharCode(c);
            }
            // Format: "YYYY:MM:DD HH:MM:SS"
            const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(str);
            if (m) {
              // Build PT epoch — EDC festival is in Vegas (UTC-7 PDT in May).
              // FESTIVAL_CONFIG.dayDates[*].midnightUtc already encodes that
              // (e.g. May 15 00:00 PT = May 15 07:00 UTC). We compute the
              // photo's offset from its calendar day's PT midnight, then add
              // to the day's midnightUtc to land on a true UTC epoch.
              const yr = +m[1], mo = +m[2], dy = +m[3];
              const hh = +m[4], mm = +m[5], ss = +m[6];
              // For now, ignore the date-from-EXIF year/month and just use
              // time-of-day vs. nearest festival night. This sidesteps EXIF
              // timezone weirdness — if a photo was taken at 11:30 PM it was
              // taken at 11:30 PM whatever the device clock thinks the day is.
              out.date = { yr, mo, dy, hh, mm, ss };
            }
          }
        }
        // GPSIFD → Latitude + Longitude
        const gpsPtr = ifd0Entries[_EXIF_TAG_GPS_IFD];
        if (gpsPtr) {
          const gpsIfd = tiff + u32(gpsPtr.valOff);
          const gpsEntries = readEntries(gpsIfd);
          const readRationalDeg = (entry) => {
            if (!entry || entry.count !== 3 || entry.type !== 5) return null;
            const off2 = tiff + u32(entry.valOff);
            const r = (p) => u32(p) / u32(p + 4);
            return r(off2) + r(off2 + 8) / 60 + r(off2 + 16) / 3600;
          };
          const lat = readRationalDeg(gpsEntries[_EXIF_TAG_GPS_LAT]);
          const lng = readRationalDeg(gpsEntries[_EXIF_TAG_GPS_LNG]);
          if (lat != null) {
            const refEntry = gpsEntries[_EXIF_TAG_GPS_LAT_REF];
            const refCh = refEntry ? String.fromCharCode(dv.getUint8(refEntry.valOff)) : "N";
            out.lat = refCh === "S" ? -lat : lat;
          }
          if (lng != null) {
            const refEntry = gpsEntries[_EXIF_TAG_GPS_LNG_REF];
            const refCh = refEntry ? String.fromCharCode(dv.getUint8(refEntry.valOff)) : "E";
            out.lng = refCh === "W" ? -lng : lng;
          }
        }
        return out;
      }
      off += 2 + len;
    }
  } catch {}
  return out;
}

// Given EXIF metadata + the list of saved-set IDs the user has tagged for
// any night, pick the best matching artist:
//   1. Prefer an artist whose set window contains the photo time AND whose
//      stage is closest to the photo GPS (if GPS available).
//   2. If no time match in saved sets, expand to ALL artists on that night.
//   3. If still nothing, return null.
// v146 fix: use the photo's actual DATE (yr/mo/dy) to determine which
// festival night it belongs to BEFORE matching artists. The prior version
// only used time-of-day, which meant a Saturday 10:30 PM photo could be
// tagged as a Friday artist whose set happened to overlap 10:30 PM.
//
// Festival night N runs from Day N at 19:00 local to Day N+1 at 06:00 local.
// `FESTIVAL_CONFIG.dayDates[n].midnightUtc` is the UTC epoch corresponding
// to Day N's local 00:00, so [+19h, +30h] is the night window in UTC.
function _festivalTzOffsetHours() {
  const day1 = window.FESTIVAL_CONFIG?.dayDates?.[1];
  if (!day1) return -7; // PT default
  return -new Date(day1.midnightUtc).getUTCHours();
}
function _photoEpochUtc(date) {
  // EXIF DateTimeOriginal / file.lastModified gives festival-local wall
  // clock (iOS phones store capture time in device-local, no tz). Convert
  // to UTC epoch using the festival's offset.
  const offset = _festivalTzOffsetHours(); // e.g. -7 for PDT
  return Date.UTC(date.yr, date.mo - 1, date.dy, date.hh, date.mm, date.ss || 0)
       - offset * 3600000;
}
function _photoFestivalNight(date) {
  if (!date) return null;
  const cfg = window.FESTIVAL_CONFIG;
  if (!cfg?.dayDates) return null;
  const photoMs = _photoEpochUtc(date);
  for (const n of Object.keys(cfg.dayDates).map(Number)) {
    const dm = cfg.dayDates[n];
    if (!dm) continue;
    const startMs = dm.midnightUtc + 19 * 3600000;     // 19:00 PT of day N
    const endMs   = dm.midnightUtc + 30 * 3600000;     // 06:00 PT day N+1
    if (photoMs >= startMs - 30 * 60000 && photoMs <= endMs + 30 * 60000) return n;
  }
  return null;
}

// Great-circle distance in meters. Only used for off-stage detection so
// precision isn't critical, but haversine is ~5 lines and exact.
function _haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function _matchNearestLocation(lat, lng) {
  const amenities = window.AMENITIES || [];
  if (!amenities.length) return null;
  const cfg = window.FESTIVAL_CONFIG || {};
  const mapToGps = window.mapToGps;
  const hasAffine = !!(cfg.gpsAnchors?.length >= 3);

  const amenityToGps = (am) => {
    if (hasAffine && mapToGps) return mapToGps(am.x, am.y);
    if (!cfg.gps) return null;
    const scale = (cfg.gps.onSiteRadiusMi || 0.4) * 1609.34 / 50;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(cfg.gps.lat * Math.PI / 180);
    return {
      lat: cfg.gps.lat + ((am.y - 50) * scale) / mPerDegLat,
      lng: cfg.gps.lng + ((am.x - 50) * scale) / mPerDegLng,
    };
  };

  let best = null, bestDist = Infinity;
  for (const am of amenities) {
    const gps = amenityToGps(am);
    if (!gps) continue;
    const d = _haversineMeters(lat, lng, gps.lat, gps.lng);
    if (d < bestDist) { bestDist = d; best = am; }
  }
  if (!best || bestDist > 200) return null;
  const ICONS = { water: "💧", food: "🍔", med: "🏥", toilet: "🚻", art: "🎨", info: "ℹ️", charge: "🔋", locker: "🔐" };
  return { label: best.label, type: best.type, icon: ICONS[best.type] || "📍", distMeters: Math.round(bestDist) };
}

function _matchArtistForPhoto({ date, lat, lng }, savedIds) {
  if (!date) return { artistId: null, night: null, reason: "no_date" };
  // First: which festival night does this photo's DATE place it in?
  const night = _photoFestivalNight(date);
  if (!night) return { artistId: null, night: null, reason: "outside_festival_window" };

  // Off-stage check: if the photo has GPS and it's beyond ~80m from
  // EVERY known stage anchor, the user wasn't AT a set — they were on
  // Rainbow Road, at the food court, in line for a charger, in Downtown
  // EDC. Don't force-tag the closest artist in that case; surface as
  // "off_stage" so the UI shows 📍 BETWEEN SETS instead of a wrong
  // artist chip. With anchors for all 9 stages (data.jsx gpsAnchors,
  // v163+), 80m is the tightest threshold that doesn't false-positive
  // "back of the crowd". Earlier v163 launch used 150m because only 3
  // of 9 anchors were calibrated — that left big gaps near the other
  // 6 stages, forcing a conservative threshold.
  if (lat != null && lng != null) {
    const anchors = window.FESTIVAL_CONFIG?.gpsAnchors || [];
    if (anchors.length > 0) {
      const stageDistances = anchors.map(a => ({ stageId: a.stageId, dist: _haversineMeters(lat, lng, a.lat, a.lng) }));
      const minMeters = Math.min(...stageDistances.map(s => s.dist));
      if (minMeters > 120) {
        const loc = _matchNearestLocation(lat, lng);
        return { artistId: null, night, reason: "off_stage", distMeters: Math.round(minMeters), location: loc };
      }
    }
  }

  // Then: which artist on THAT night was playing at the photo's time?
  const minOfDay = date.hh * 60 + date.mm;
  const adjustedMin = minOfDay < 360 ? minOfDay + 1440 : minOfDay;
  const candidates = [];
  for (const a of (window.ARTISTS || [])) {
    if (a.day !== night) continue;
    const [sh, sm] = a.start.split(":").map(Number);
    const [eh, em] = a.end.split(":").map(Number);
    const startMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
    const endMin   = (eh < 6 ? eh + 24 : eh) * 60 + em;
    if (adjustedMin >= startMin - 5 && adjustedMin <= endMin + 10) {
      candidates.push({ a, startMin, endMin });
    }
  }
  if (candidates.length === 0) {
    // We know the night but no specific artist — return the night so the
    // photo still lands in the right bucket (e.g. between sets, in the
    // shuttle line, etc.).
    return { artistId: null, night, reason: "no_artist_at_time" };
  }
  // Prefer saved artists; GPS tiebreaker; then tightest time fit
  const savedSet = new Set(savedIds || []);
  const inSaved = candidates.filter(c => savedSet.has(c.a.id));
  const pool = inSaved.length > 0 ? inSaved : candidates;
  const stageDist = (a) => {
    if (lat == null || lng == null) return Infinity;
    const anchor = (window.FESTIVAL_CONFIG?.gpsAnchors || []).find(g => g.stageId === a.stage);
    if (!anchor) return Infinity;
    const dLat = lat - anchor.lat, dLng = lng - anchor.lng;
    return dLat * dLat + dLng * dLng;
  };
  pool.sort((x, y) => {
    const dx = stageDist(x.a), dy = stageDist(y.a);
    if (dx !== Infinity && dy !== Infinity && Math.abs(dx - dy) > 1e-9) return dx - dy;
    return Math.abs(adjustedMin - x.startMin) - Math.abs(adjustedMin - y.startMin);
  });
  return { artistId: pool[0].a.id, night, reason: "matched" };
}

// v150: Manage-storage panel rendered at the bottom of the Memories screen.
// Surfaces how much disk space Plursky is using (via the Storage Manager
// API) + lets the user purge moments per-night or wholesale. Each delete
// nukes both the localStorage metadata AND the IndexedDB photo blob so
// nothing leaks.
async function _purgeNightMoments(night) {
  const all = _readMoments();
  const list = all[night] || [];
  for (const m of list) {
    if (m.photoId) { try { await _deletePhoto(m.photoId); } catch {} }
  }
  delete all[night];
  _writeMoments(all);
}
async function _purgeAllMoments() {
  const all = _readMoments();
  for (const list of Object.values(all)) {
    for (const m of list || []) {
      if (m.photoId) { try { await _deletePhoto(m.photoId); } catch {} }
    }
  }
  _writeMoments({});
}

function StorageManager({ all, onChange }) {
  const [usage, setUsage] = React.useState(null);
  const [busy, setBusy]   = React.useState(false);
  const [confirming, setConfirming] = React.useState(null); // night | 'all' | null

  const refresh = React.useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        setUsage({ used: e.usage || 0, quota: e.quota || 0 });
      } else setUsage({ used: null, quota: null });
    } catch { setUsage({ used: null, quota: null }); }
  }, []);
  React.useEffect(() => { refresh(); }, [refresh, all]);

  const totalMoments = Object.values(all).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  if (totalMoments === 0) return null;

  const fmtBytes = (b) => {
    if (b == null) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  };
  const usedPct = usage?.quota ? Math.round((usage.used / usage.quota) * 100) : null;

  const handlePurge = async (target) => {
    setBusy(true);
    try {
      if (target === "all") await _purgeAllMoments();
      else                  await _purgeNightMoments(target);
    } finally {
      setBusy(false);
      setConfirming(null);
      onChange?.();
    }
  };

  const DAYS = window.DAYS || [];

  return (
    <div style={{
      marginTop: 22, padding: "14px 16px",
      background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 14,
    }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>
        STORAGE
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "var(--ink)" }}>
          {totalMoments} moment{totalMoments === 1 ? "" : "s"}
        </span>
        {usage?.used != null && (
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
            {fmtBytes(usage.used)}{usage.quota ? ` / ${fmtBytes(usage.quota)}` : ""}
          </span>
        )}
      </div>
      {usedPct != null && (
        <>
          <div style={{ height: 4, background: "var(--paper)", borderRadius: 4, overflow: "hidden", marginBottom: usedPct > 80 ? 6 : 10 }}>
            <div style={{
              height: "100%", width: `${Math.min(100, usedPct)}%`,
              background: usedPct > 80 ? "var(--ember)" : "var(--horizon)",
              transition: "width 0.3s",
            }}/>
          </div>
          {usedPct > 80 && (
            <div className="mono" style={{
              fontSize: 9, letterSpacing: 1.2, fontWeight: 700, marginBottom: 10,
              color: "var(--ember)", background: "rgba(232,93,46,0.10)",
              border: "1px solid rgba(232,93,46,0.3)", borderRadius: 8,
              padding: "6px 10px",
            }}>
              ⚠ STORAGE {usedPct}% FULL · PURGE OLD NIGHTS TO FREE SPACE
            </div>
          )}
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {DAYS.map(d => {
          const list = all[d.n] || [];
          if (list.length === 0) return null;
          const photos = list.filter(m => m.photoId && m.kind !== "video").length;
          const videos = list.filter(m => m.kind === "video").length;
          const isConfirm = confirming === d.n;
          return (
            <div key={d.n} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 8,
              background: isConfirm ? "rgba(232,93,46,0.10)" : "var(--paper)",
              border: isConfirm ? "1px solid rgba(232,93,46,0.5)" : "1px solid var(--line)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--ink)" }}>
                  {d.label} <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>· {list.length} TOTAL</span>
                </div>
                {(photos > 0 || videos > 0) && (
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>
                    {photos > 0 && `${photos} PHOTO${photos === 1 ? "" : "S"}`}
                    {photos > 0 && videos > 0 && " · "}
                    {videos > 0 && `${videos} VIDEO${videos === 1 ? "" : "S"}`}
                  </div>
                )}
              </div>
              {isConfirm ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setConfirming(null)} disabled={busy} className="mono" style={{
                    padding: "4px 9px", borderRadius: 999, background: "transparent", border: "1px solid var(--line-2)",
                    color: "var(--ink)", cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  }}>CANCEL</button>
                  <button onClick={() => handlePurge(d.n)} disabled={busy} className="mono" style={{
                    padding: "4px 9px", borderRadius: 999, background: "var(--ember)", color: "#fff", border: "none",
                    cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  }}>{busy ? "..." : "DELETE"}</button>
                </div>
              ) : (
                <button onClick={() => setConfirming(d.n)} aria-label="Clear night" className="mono" style={{
                  padding: "4px 9px", borderRadius: 999, background: "transparent", border: "1px solid var(--line-2)",
                  color: "var(--muted)", cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                }}>CLEAR</button>
              )}
            </div>
          );
        })}
      </div>
      {totalMoments > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {confirming === "all" ? (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(232,93,46,0.10)", border: "1px solid rgba(232,93,46,0.5)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>
                Delete all {totalMoments} moments?
              </span>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setConfirming(null)} disabled={busy} className="mono" style={{
                  padding: "5px 10px", borderRadius: 999, background: "transparent", border: "1px solid var(--line-2)",
                  color: "var(--ink)", cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                }}>NO</button>
                <button onClick={() => handlePurge("all")} disabled={busy} className="mono" style={{
                  padding: "5px 10px", borderRadius: 999, background: "var(--ember)", color: "#fff", border: "none",
                  cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                }}>{busy ? "..." : "DELETE ALL"}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming("all")} className="mono" style={{
              padding: "8px 14px", width: "100%", borderRadius: 8,
              background: "transparent", border: "1px dashed var(--line-2)",
              color: "var(--muted)", cursor: "pointer",
              fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
            }}>🗑  CLEAR ALL MEMORIES</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── "That Night" story view ──────────────────────────────────────
// Weaves the four facts into one chronological scroll per night: a
// vertical timeline where each captured moment becomes a beat —
// time · artist · the song that was playing · the photo. Reads like
// a story of the night instead of a grid of files. The emotional
// payoff surface for the who/what/where/when graph.
function _MemoryStoryBeat({ moment, isLast, onOpen }) {
  const url = useMomentPhoto(moment.photoId);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  const stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const estSong = useSetlistSong(artist, moment.takenAt);
  const song = moment.confirmedSong || estSong?.song;
  const accent = stage?.color || "var(--muted)";
  const time = (() => {
    if (!moment.takenAt) return null;
    try {
      const [h, mm] = (moment.takenAt.split(" ")[1] || "").split(":").map(Number);
      const ap = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(mm).padStart(2,"0")} ${ap}`;
    } catch { return null; }
  })();
  return (
    <div style={{ display: "flex", gap: 12, position: "relative" }}>
      {/* Timeline rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
        <div style={{ width: 11, height: 11, borderRadius: 11, background: accent, marginTop: 5, boxShadow: `0 0 0 3px ${accent}22` }}/>
        {!isLast && <div style={{ flex: 1, width: 2, background: "var(--line)", marginTop: 2 }}/>}
      </div>
      {/* Beat */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>
        {time && <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>{time}</div>}
        {artist ? (
          <div className="serif" style={{ fontSize: 20, lineHeight: 1.05, color: "var(--ink)" }}>{artist.name}</div>
        ) : (
          <div className="serif" style={{ fontSize: 18, fontStyle: "italic", color: "var(--muted)" }}>A moment</div>
        )}
        {song && (
          <div className="mono" style={{ fontSize: 9, letterSpacing: 0.8, color: accent, fontWeight: 700, marginTop: 3 }}>
            ♫ {song}{moment.confirmedSong ? " · SHAZAMED" : ""}
          </div>
        )}
        {stage && (
          <div className="mono" style={{ fontSize: 8, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>{stage.name.toUpperCase()}</div>
        )}
        {url && (
          <button onClick={onOpen} style={{ marginTop: 8, padding: 0, border: "none", background: "none", cursor: "pointer", display: "block", width: "100%", position: "relative" }}>
            {moment.kind === "video" ? (
              <>
                {/* preload="metadata" paints the first frame as a poster;
                    tapping opens the lightbox player (controls + autoplay).
                    Before the fix this rendered inside an <img>, so video
                    moments showed as a broken tile in the default Story view. */}
                <video src={url} muted playsInline preload="metadata" style={{
                  width: "100%", borderRadius: 12, display: "block",
                  maxHeight: 340, objectFit: "cover", background: "#000",
                  pointerEvents: "none",
                }}/>
                <span style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center", pointerEvents: "none",
                }}>
                  <span style={{
                    width: 52, height: 52, borderRadius: 52,
                    background: "rgba(0,0,0,0.5)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 19, paddingLeft: 3,
                  }}>▶</span>
                </span>
                <span className="mono" style={{
                  position: "absolute", bottom: 8, right: 8,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  fontSize: 8, letterSpacing: 1, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 999, pointerEvents: "none",
                }}>VIDEO</span>
              </>
            ) : (
              <img src={url} alt="" style={{ width: "100%", borderRadius: 12, display: "block", maxHeight: 340, objectFit: "cover" }}/>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function MemoryStory({ allMoments, state, setState, onOpenLightbox }) {
  const [night, setNight] = React.useState(() => {
    const nights = [...new Set(allMoments.map(m => m.night))].sort((a, b) => a - b);
    return nights[0] || NOW.day || 1;
  });
  const nights = React.useMemo(
    () => [...new Set(allMoments.map(m => m.night))].sort((a, b) => a - b),
    [allMoments]
  );
  const beats = React.useMemo(() => {
    return allMoments
      .filter(m => m.night === night)
      .sort((a, b) => {
        const ta = a.takenAt || "", tb = b.takenAt || "";
        if (ta && tb) return ta.localeCompare(tb);
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }, [allMoments, night]);

  if (allMoments.length === 0) {
    return (
      <div style={{ padding: "28px 14px", textAlign: "center", marginTop: 18, border: "1px dashed var(--line-2)", borderRadius: 14, background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          NO MOMENTS YET — IMPORT FROM CAMERA ROLL ABOVE
        </div>
      </div>
    );
  }

  const dayMeta = DAYS.find(d => d.n === night);
  return (
    <div style={{ marginTop: 14 }}>
      {nights.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {nights.map(n => {
            const dm = DAYS.find(d => d.n === n);
            const on = n === night;
            return (
              <button key={n} onClick={() => setNight(n)} className="mono" style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                background: on ? "var(--ink)" : "var(--paper-2)",
                color: on ? "var(--paper)" : "var(--muted)",
                border: on ? "none" : "1px solid var(--line)",
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
              }}>{dm?.label || `DAY ${n}`}</button>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <div className="serif" style={{ fontSize: 26, lineHeight: 1, color: "var(--ink)" }}>
          {dayMeta ? dayMeta.label.charAt(0) + dayMeta.label.slice(1).toLowerCase() : `Night ${night}`} <span style={{ fontStyle: "italic", color: "var(--ember)" }}>night</span>
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 4, fontWeight: 700 }}>
          {beats.length} {beats.length === 1 ? "MOMENT" : "MOMENTS"} · YOUR STORY
        </div>
      </div>
      {beats.map((m, i) => (
        <_MemoryStoryBeat
          key={m.id}
          moment={m}
          isLast={i === beats.length - 1}
          onOpen={() => onOpenLightbox(beats, i)}
        />
      ))}
    </div>
  );
}

function MemoriesScreen({ state, setState }) {
  const [all, setAll] = React.useState(_readMoments);
  const [adding, setAdding] = React.useState(null); // night number being added to, or null
  const [batch, setBatch] = React.useState(null);   // null | { total, done, results: [{name, night, artistId, err?}] }
  const [lightbox, setLightbox] = React.useState(null); // null | { moments: [], index }
  const batchInputRef = React.useRef(null);
  const nightSectionRefs = React.useRef({});
  const openLightbox = React.useCallback((moments, index) => setLightbox({ moments, index }), []);

  // Stay in sync with cross-screen retags. The local handlers (handleAdd /
  // handleUpdate / handleDelete) all call setAll directly so this listener
  // is only doing work for external writes — e.g., the user retags a
  // moment from the Artist screen's "YourPhotosStrip" and we want the
  // Memories tab to reflect that next time they swap to it. _writeMoments
  // dispatches "plursky-moments-change" on every write.
  React.useEffect(() => {
    const refresh = () => { try { setAll(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);

  // v141: when a user taps a FRI/SAT/SUN row on the Me-tab History list,
  // it sets state.memoriesNight + state.tab="memories". This effect scrolls
  // that night's section to the top of the ScrollBody so the user lands
  // on the right place + clears the hint so a manual navigation later
  // doesn't snap them back.
  React.useEffect(() => {
    if (!state.memoriesNight) return;
    const id = requestAnimationFrame(() => {
      const el = nightSectionRefs.current[state.memoriesNight];
      if (el?.scrollIntoView) el.scrollIntoView({ behavior: "instant", block: "start" });
      setState(s => ({ ...s, memoriesNight: null }));
    });
    return () => cancelAnimationFrame(id);
  }, [state.memoriesNight]);

  const handleAdd = (moment) => {
    const next = { ..._readMoments() };
    next[moment.night] = [...(next[moment.night] || []), moment];
    _writeMoments(next);
    setAll(next);
    setAdding(null);
  };

  // Auto-import multiple photos at once. For each file we read EXIF, ask the
  // matcher which artist+night it belongs to, compress + save to IndexedDB,
  // and write a moment. Photos with no EXIF date land in a fallback night
  // and surface a RETAG chip so the user can fix them.
  const handleBatchPick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-pick of same files
    return processImportedFiles(files);
  };

  // The actual ingest loop. Pulled out of handleBatchPick so the native
  // @capacitor/camera picker can feed it File objects directly without
  // going through a hidden <input>.
  const _fileFingerprint = async (file) => {
    try {
      const slice = file.slice(0, 2048);
      const buf = await slice.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let h = 0x811c9dc5;
      for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
      return `${(h >>> 0).toString(36)}_${file.size}_${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    } catch { return null; }
  };

  const processImportedFiles = async (files) => {
    if (files.length === 0) return;
    const results = [];
    setBatch({ total: files.length, done: 0, results });
    const savedIds = state.saved || [];
    const current = { ..._readMoments() };

    const existingFingerprints = new Set();
    for (const moments of Object.values(current)) {
      for (const m of moments) { if (m._fingerprint) existingFingerprints.add(m._fingerprint); }
    }
    // Fallback target night when we can't infer one from EXIF: prefer the
    // current festival day, then yesterday (post-midnight shoot earlier in
    // the morning), else the first festival night. Better to import every
    // photo into SOME night so the user can re-tag than silently skip.
    const allNights = Object.keys(window.FESTIVAL_CONFIG?.dayDates || {}).map(Number).sort((a, b) => a - b);
    const fallbackNight = (window.NOW?.day && allNights.includes(window.NOW.day))
      ? window.NOW.day
      : (allNights[allNights.length - 1] || 1);
    let skippedDupes = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const fp = await _fileFingerprint(f);
        if (fp && existingFingerprints.has(fp)) {
          skippedDupes++;
          results.push({ name: f.name, night: null, artistId: null, skipped: "duplicate" });
          setBatch({ total: files.length, done: i + 1, results: results.slice() });
          continue;
        }
        const exif = await _parseExifMeta(f).catch(() => null);
        const meta = _metaFromFile(f, exif);
        const matched = meta?.date ? _matchArtistForPhoto(meta, savedIds) : { artistId: null, night: null, reason: "no_date" };
        // v141: never skip — if EXIF/lastModified didn't pick a night, drop
        // into the current festival night untagged. User can re-tag from
        // the moment card later or delete if it doesn't belong.
        const night = matched.night || fallbackNight;
        // Why was this tag picked? Surface it on the moment so the card can
        // show "TAGGED FROM EXIF" vs "FALLBACK — RETAG", and so we can debug
        // import failures from the UI alone.
        const hadExifDate = !!exif?.date;
        const hadFileTime = !exif?.date && !!meta?.date;
        const tagSource =
          matched.reason === "off_stage"  ? "off_stage" :
          matched.artistId && hadExifDate ? "exif" :
          matched.artistId && hadFileTime ? "filetime" :
          matched.night    && hadExifDate ? "exif-night-only" :
          matched.night    && hadFileTime ? "filetime-night-only" :
          "fallback";
        const out = await _processMomentMedia(f);
        const id = `m_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        const photoId = `p_${id}`;
        await _putPhoto(photoId, out.blob);
        const moment = {
          id, night, text: "", artistId: matched.artistId, photoId,
          kind: out.kind,
          createdAt: Date.now(),
          takenAt: meta?.date ? `${meta.date.yr}-${String(meta.date.mo).padStart(2,"0")}-${String(meta.date.dy).padStart(2,"0")} ${String(meta.date.hh).padStart(2,"0")}:${String(meta.date.mm).padStart(2,"0")}` : null,
          autoTagged: !!matched.artistId,
          tagSource,
          parsedGps: exif?.lat != null && exif?.lng != null ? { lat: exif.lat, lng: exif.lng } : null,
          location: matched.location || null,
          hasGps: !!(exif?.lat != null && exif?.lng != null),
          fileType: f.type || null,
          _fingerprint: fp || null,
        };
        if (fp) existingFingerprints.add(fp);
        current[night] = [...(current[night] || []), moment];
        results.push({ name: f.name, night, artistId: matched.artistId, fallback: !matched.night, tagSource });
      } catch (err) {
        results.push({ name: f.name, night: null, artistId: null, err: err?.message || "failed" });
      }
      setBatch({ total: files.length, done: i + 1, results: results.slice() });
    }
    _writeMoments(current);
    setAll(current);
    // Auto-dismiss summary banner after 6s if user doesn't tap it
    setTimeout(() => setBatch(b => (b && b.done === b.total ? null : b)), 6000);
  };

  const handleDelete = async (moment) => {
    if (!window.confirm("Delete this moment?")) return;
    if (moment.photoId) { try { await _deletePhoto(moment.photoId); } catch {} }
    const next = { ..._readMoments() };
    for (const n of Object.keys(next)) {
      next[n] = (next[n] || []).filter(m => m.id !== moment.id);
    }
    _writeMoments(next);
    setAll(next);
  };

  // Route the import button through the native @capawesome/capacitor-file-picker
  // PHPicker when (a) we're inside the iOS Capacitor shell AND (b) the
  // __USE_NATIVE_PICKER__ flag is on. `pickMedia` returns BOTH photos and
  // videos from one native sheet (Camera.pickImages was photos-only — the
  // reason videos couldn't be imported on the native build).
  //
  // skipTranscoding:false is load-bearing: iOS then transcodes HEIC photos
  // to JPEG, which keeps EXIF DateTimeOriginal in a form _parseExifMeta can
  // read (it bails on non-JPEG). That preserves time-based auto-tagging —
  // the whole point of the native picker. Videos come through as-is/MP4 and
  // get stored raw by _processMomentMedia.
  //
  // PHPicker is out-of-process, so it needs NO NSPhotoLibraryUsageDescription
  // and triggers no permission prompt. GPS is stripped by PHPicker unless the
  // user grants full library access in iOS Settings — same as before.
  const pickViaNative = async () => {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !window.__USE_NATIVE_PICKER__) return null;
    const FilePicker = cap.Plugins?.FilePicker;
    if (!FilePicker?.pickMedia) return null;
    try {
      const result = await FilePicker.pickMedia({ skipTranscoding: false, limit: 50, readData: false });
      const files = result?.files || [];
      if (files.length === 0) return [];
      const out = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        // `path` is a native file URL; convertFileSrc makes it loadable by
        // the WebView so fetch() can read it into a Blob, then we wrap it as
        // a File so the existing ingest pipeline sees the same shape it would
        // from <input type="file">.
        const src = f.path ? (cap.convertFileSrc ? cap.convertFileSrc(f.path) : f.path) : null;
        if (!src) continue;
        const blob = await fetch(src).then(r => r.blob());
        const isVideo = /^video\//.test(f.mimeType || "") || /\.(mov|mp4|m4v)$/i.test(f.name || "");
        const type = f.mimeType || blob.type || (isVideo ? "video/mp4" : "image/jpeg");
        const name = f.name || `pick-${i}.${isVideo ? "mp4" : "jpg"}`;
        out.push(new File([blob], name, {
          type,
          // modifiedAt is the freshly-transcoded temp file's mtime (≈now),
          // which the <30s heuristic in _metaFromFile correctly ignores so
          // photos tag from real EXIF rather than the conversion stamp.
          lastModified: f.modifiedAt || Date.now(),
        }));
      }
      return out;
    } catch (err) {
      console.warn('[memories] native pickMedia failed; falling back to web input', err);
      return null;
    }
  };

  const handlePickClick = async () => {
    const nativeFiles = await pickViaNative();
    if (nativeFiles && nativeFiles.length > 0) {
      await processImportedFiles(nativeFiles);
    } else if (nativeFiles === null) {
      // Native path declined to handle (flag off / not in Capacitor / errored).
      // Fall through to the existing hidden-input click.
      batchInputRef.current?.click();
    }
    // nativeFiles === [] means the user opened the native picker and cancelled
    // without picking — don't fall back to the web input, just no-op.
  };

  // In-place edit (e.g. retagging the artist on an auto-imported photo
  // that landed without a match). Re-reads from disk first so concurrent
  // batch imports don't get clobbered.
  const handleUpdate = (moment, patch) => {
    const next = { ..._readMoments() };
    for (const n of Object.keys(next)) {
      next[n] = (next[n] || []).map(m => m.id === moment.id ? { ...m, ...patch } : m);
    }
    _writeMoments(next);
    setAll(next);
  };

  const totalCount = Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);

  // Three lenses on the same data. Default is "night" (preserves the
  // festival narrative + keeps + ADD MOMENT and the attendance review
  // affordances per night). "artist" and "stage" are rewatch lenses:
  // flatten across all nights, group by the dimension. Untagged moments
  // always float to a bottom group so retag work is grouped.
  // Persisted across navigations — users settle on one lens; resetting
  // to "night" every time the user comes back from another tab was
  // unnecessary friction.
  const [view, setView] = React.useState(() => {
    try {
      const v = localStorage.getItem("plursky_memories_view_v1");
      if (v === "story" || v === "night" || v === "artist" || v === "stage") return v;
    } catch {}
    return "story";
  });
  React.useEffect(() => {
    try { localStorage.setItem("plursky_memories_view_v1", view); } catch {}
  }, [view]);
  // Flatten moments once for the artist/stage views.
  const allMoments = React.useMemo(() => {
    const out = [];
    for (const n of Object.keys(all)) {
      for (const m of (all[n] || [])) out.push(m);
    }
    return out;
  }, [all]);

  return (
    <Screen bg="var(--paper)">
      {lightbox && (
        <MomentLightbox
          moments={lightbox.moments}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox(lb => ({ ...lb, index: i }))}
          onArtistClick={(id) => setState(s => ({ ...s, artist: id }))}
          onUpdate={(mom, patch) => {
            handleUpdate(mom, patch);
            // Reflect the patch in the open lightbox immediately
            setLightbox(lb => lb ? { ...lb, moments: lb.moments.map(mm => mm.id === mom.id ? { ...mm, ...patch } : mm) } : lb);
          }}
        />
      )}
      <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => window._popNav ? window._popNav() : setState(s => ({ ...s, tab: "me" }))} aria-label="Back" style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          fontSize: 22, color: "var(--ink)", lineHeight: 1,
          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TopBar
            title={<span>Memories</span>}
            sub={`${totalCount} ${totalCount === 1 ? "MOMENT" : "MOMENTS"} · ${FESTIVAL_CONFIG.shortName.toUpperCase()}`}
            tight
          />
        </div>
      </div>
      <ScrollBody style={{ padding: "0 20px 94px" }}>
        {/* v135 batch import — auto-tags each photo by EXIF time + GPS,
            then drops it into the right night without further input. */}
        <input
          ref={batchInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleBatchPick}
          style={{ display: "none" }}
        />
        <button onClick={handlePickClick}
          disabled={!!batch && batch.done < batch.total}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", marginTop: 12, padding: "12px 14px",
            background: "linear-gradient(135deg, rgba(232,93,46,0.12), rgba(123,61,154,0.10))",
            border: "1px solid rgba(232,93,46,0.4)",
            borderRadius: 14, color: "var(--ink)", cursor: "pointer",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 17 }}>✨</span>
            <div style={{ textAlign: "left" }}>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.1 }}>Import from camera roll</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2, fontWeight: 700 }}>
                AUTO-TAGS BY TIME + LOCATION
              </div>
            </div>
          </div>
          <span className="mono" style={{
            background: "var(--ember)", color: "#fff",
            padding: "5px 11px", borderRadius: 999,
            fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>{batch && batch.done < batch.total ? `${batch.done}/${batch.total}` : "PICK"}</span>
        </button>
        {batch && batch.done === batch.total && (() => {
          const tagged    = batch.results.filter(r => !r.err && !r.skipped && r.artistId).length;
          const needRetag = batch.results.filter(r => !r.err && !r.skipped && !r.artistId).length;
          const failed    = batch.results.filter(r => r.err).length;
          const dupes     = batch.results.filter(r => r.skipped === "duplicate").length;
          const allTagged = tagged > 0 && needRetag === 0 && failed === 0;
          return (
            <div onClick={() => setBatch(null)} style={{
              marginTop: 8, padding: "9px 12px",
              background: allTagged ? "rgba(45,122,85,0.12)" : "rgba(232,93,46,0.10)",
              border: allTagged ? "1px solid rgba(45,122,85,0.4)" : "1px solid rgba(232,93,46,0.4)",
              borderRadius: 10, cursor: "pointer",
            }}>
              <div className="mono" style={{
                fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                color: allTagged ? "var(--success)" : "var(--ember)",
              }}>
                ✓ {tagged} TAGGED{needRetag > 0 ? ` · ${needRetag} NEED RETAG` : ""}{dupes > 0 ? ` · ${dupes} SKIPPED (DUPLICATE)` : ""}{failed > 0 ? ` · ${failed} FAILED` : ""}
              </div>
              {needRetag > 0 && (
                <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 600 }}>
                  iOS sometimes strips photo time when copying — tap an untagged moment to pick its set.
                </div>
              )}
              <div className="mono" style={{ marginTop: 4, fontSize: 9, color: "var(--muted)" }}>TAP TO DISMISS</div>
            </div>
          );
        })()}
        {/* View selector — three lenses on the same moments. NIGHT is the
            "manage" view (with + ADD MOMENT and the per-night attendance
            review). ARTIST and STAGE are rewatch lenses that flatten
            everything across the weekend. */}
        <div style={{
          display: "flex", gap: 4, marginTop: 14, marginBottom: 8,
          padding: 3, background: "var(--paper-2)", borderRadius: 10,
          border: "1px solid var(--line)",
        }}>
          {[
            { id: "story",  label: "STORY" },
            { id: "night",  label: "NIGHT" },
            { id: "artist", label: "ARTIST" },
            { id: "stage",  label: "STAGE" },
          ].map(v => {
            const on = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)} className="mono" style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                background: on ? "var(--ink)"   : "transparent",
                color:      on ? "var(--paper)" : "var(--muted)",
                border: "none", cursor: "pointer",
                fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              }}>{v.label}</button>
            );
          })}
        </div>
        {view === "story" && <MemoryStory allMoments={allMoments} state={state} setState={setState} onOpenLightbox={openLightbox} />}
        {view === "artist" && _renderByGroup({
          allMoments,
          keyOf: m => m.artistId || "__untagged__",
          headerFor: (key) => {
            if (key === "__untagged__") return { mono: "TO RETAG", serif: "Untagged moments", accent: "var(--ember)", onClick: null };
            const a = ARTISTS.find(x => x.id === key);
            const s = a ? STAGES.find(st => st.id === a.stage) : null;
            return {
              mono: (s?.short || "").toUpperCase() + (s ? " STAGE" : ""),
              serif: a?.name || "Unknown",
              accent: s?.color || "var(--muted)",
              onClick: a ? () => setState(st => ({ ...st, artist: a.id })) : null,
            };
          },
          sortKeys: (a, b) => {
            if (a === "__untagged__") return 1;
            if (b === "__untagged__") return -1;
            const savedSet = new Set(state.saved || []);
            const aSaved = savedSet.has(a), bSaved = savedSet.has(b);
            if (aSaved !== bSaved) return aSaved ? -1 : 1;
            const aA = ARTISTS.find(x => x.id === a);
            const bA = ARTISTS.find(x => x.id === b);
            return (aA?.day || 99) - (bA?.day || 99)
                || (aA?.start || "99:99").localeCompare(bA?.start || "99:99");
          },
          state, setState, handleDelete, handleUpdate, onOpenLightbox: openLightbox,
        })}
        {view === "stage" && _renderByGroup({
          allMoments,
          keyOf: m => {
            if (!m.artistId) return "__untagged__";
            const a = ARTISTS.find(x => x.id === m.artistId);
            return a?.stage || "__untagged__";
          },
          headerFor: (key) => {
            if (key === "__untagged__") return { mono: "TO RETAG", serif: "Untagged moments", accent: "var(--ember)", onClick: null };
            const s = STAGES.find(st => st.id === key);
            return {
              mono: (s?.short || key).toUpperCase(),
              serif: s?.name || "Unknown stage",
              accent: s?.color || "var(--muted)",
              onClick: s ? () => setState(st => ({ ...st, tab: "map", focusStage: s.id })) : null,
            };
          },
          sortKeys: (a, b) => {
            if (a === "__untagged__") return 1;
            if (b === "__untagged__") return -1;
            return (STAGES.find(s => s.id === a)?.name || "").localeCompare(STAGES.find(s => s.id === b)?.name || "");
          },
          state, setState, handleDelete, handleUpdate, onOpenLightbox: openLightbox,
        })}
        {view === "night" && DAYS.map(d => {
          const moments = (all[d.n] || []).slice().sort((a, b) => a.createdAt - b.createdAt);
          const dateInfo = FESTIVAL_CONFIG.dayDates?.[d.n];
          const savedNightArtists = state.saved
            .map(id => ARTISTS.find(a => a.id === id))
            .filter(a => a && a.day === d.n);
          return (
            <div key={d.n}
              ref={el => { nightSectionRefs.current[d.n] = el; }}
              style={{ marginBottom: 22, scrollMarginTop: 12 }}
            >
              <div style={{
                display: "flex", alignItems: "baseline", gap: 10,
                paddingTop: 14, paddingBottom: 8, marginBottom: 4,
                borderBottom: "1px solid var(--line)",
              }}>
                <div className="serif" style={{ fontSize: 24, color: "var(--ink)" }}>
                  {d.label}
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700 }}>
                  · {(dateInfo?.short || `DAY ${d.n}`).toString().toUpperCase()}
                </div>
                {moments.length > 0 && (
                  <>
                    <button
                      onClick={() => window._shareNightCollage?.(d.n, moments)}
                      className="mono"
                      title={`Share a collage of ${d.label}`}
                      style={{
                        marginLeft: "auto",
                        background: "var(--ember)", color: "#fff", border: "none",
                        borderRadius: 999, padding: "4px 10px", cursor: "pointer",
                        fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}>📸 SHARE</button>
                    <button
                      onClick={() => window._shareNightCollage?.(d.n, moments, "gif")}
                      className="mono"
                      title={`Share an animated GIF of ${d.label}`}
                      style={{
                        background: "#6D28D9", color: "#fff", border: "none",
                        borderRadius: 999, padding: "4px 10px", cursor: "pointer",
                        fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}>🎬 GIF</button>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700 }}>
                      {moments.length} MOMENT{moments.length === 1 ? "" : "S"}
                    </div>
                  </>
                )}
              </div>

              {moments.length === 0 && adding !== d.n && (
                <div style={{
                  padding: "18px 14px", textAlign: "center",
                  border: "1px dashed var(--line-2)", borderRadius: 14,
                  background: "var(--paper-2)", marginTop: 10, marginBottom: 10,
                }}>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
                    NO MOMENTS YET
                  </div>
                </div>
              )}

              {(() => {
                // Group this night's moments by artist (with null = untagged
                // floated to the bottom). Saved-on-this-night artists come
                // first, sorted by set start time, then any other artists
                // (e.g. you took a photo at a set you hadn't saved), then
                // the untagged group last so retag work is grouped where
                // the user can find it.
                const groups = new Map(); // artistId → moments[]
                for (const m of moments) {
                  const key = m.artistId || "__untagged__";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key).push(m);
                }
                const savedSet = new Set(state.saved || []);
                const orderedKeys = [...groups.keys()].sort((aId, bId) => {
                  if (aId === "__untagged__") return 1;
                  if (bId === "__untagged__") return -1;
                  const aSaved = savedSet.has(aId), bSaved = savedSet.has(bId);
                  if (aSaved !== bSaved) return aSaved ? -1 : 1;
                  const aA = ARTISTS.find(x => x.id === aId);
                  const bA = ARTISTS.find(x => x.id === bId);
                  return (aA?.start || "99:99").localeCompare(bA?.start || "99:99");
                });
                return orderedKeys.map(aId => {
                  const groupMoments = groups.get(aId);
                  const isUntagged = aId === "__untagged__";
                  const artist = !isUntagged ? ARTISTS.find(x => x.id === aId) : null;
                  const stage  = artist ? STAGES.find(s => s.id === artist.stage) : null;
                  const accent = isUntagged ? "var(--ember)" : (stage?.color || "var(--muted)");
                  return (
                    <div key={aId} style={{ marginTop: 10 }}>
                      <button
                        onClick={() => !isUntagged && setState(s => ({ ...s, artist: aId }))}
                        disabled={isUntagged}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "6px 4px",
                          background: "transparent", border: "none",
                          textAlign: "left",
                          cursor: isUntagged ? "default" : "pointer",
                        }}>
                        <span style={{
                          width: 4, alignSelf: "stretch",
                          background: accent, borderRadius: 3,
                        }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono" style={{
                            fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
                            color: accent,
                          }}>
                            {isUntagged ? "TO RETAG" : (stage?.short || stage?.name || "").toUpperCase()}
                          </div>
                          <div className="serif" style={{
                            fontSize: 18, color: "var(--ink)", lineHeight: 1.1,
                            marginTop: 2,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {isUntagged ? "Untagged moments" : artist?.name || "Unknown"}
                          </div>
                        </div>
                        <span className="mono" style={{
                          fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 700,
                          flexShrink: 0,
                        }}>{groupMoments.length} {groupMoments.length === 1 ? "MOMENT" : "MOMENTS"}</span>
                      </button>
                      {/* Bulk retag: when the TO RETAG group has 3+ moments
                          AND the user has saved sets on this night, surface
                          a chip row that one-taps all of them to the same
                          artist. Cheaper-than-AI escape from a stuck
                          batch where EXIF was stripped on a bunch of
                          photos at the same set. */}
                      {isUntagged && groupMoments.length >= 3 && savedNightArtists.length > 0 && (
                        <BulkRetagRow
                          moments={groupMoments}
                          savedNightArtists={savedNightArtists}
                          onUpdate={handleUpdate}
                        />
                      )}
                      {groupMoments.map((m, i) => (
                        <MomentCard
                          key={m.id}
                          moment={m}
                          idx={i}
                          total={groupMoments.length}
                          groupMoments={groupMoments}
                          onOpenLightbox={openLightbox}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                          savedArtistIds={state.saved || []}
                          onArtistClick={(id) => setState(s => ({ ...s, artist: id }))}
                        />
                      ))}
                    </div>
                  );
                });
              })()}

              {adding === d.n ? (
                <AddMomentForm
                  night={d.n}
                  savedNightArtists={savedNightArtists}
                  onAdd={handleAdd}
                  onCancel={() => setAdding(null)}
                />
              ) : (
                <button onClick={() => setAdding(d.n)} className="mono" style={{
                  width: "100%", padding: "12px",
                  background: "transparent", border: "1px dashed var(--line-2)",
                  borderRadius: 12, color: "var(--ink)",
                  fontSize: 10, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer",
                  marginTop: moments.length > 0 ? 4 : 0,
                }}>+ ADD MOMENT</button>
              )}

              {savedNightArtists.length > 0 && (
                <AttendanceReview night={d.n} savedNightArtists={savedNightArtists} />
              )}
            </div>
          );
        })}

        <StorageManager all={all} onChange={() => setAll(_readMoments())} />
      </ScrollBody>
    </Screen>
  );
}

// v137: manual attendance review — checkbox list of every saved set for a
// given night. Toggling persists via markAttended/unmarkAttended which both
// emit the "plursky-attended-change" event so other UI (Me-tab SETS CAUGHT)
// stays in sync.
function AttendanceReview({ night, savedNightArtists }) {
  const [attended, setAttended] = React.useState(() => getAttendedForNight(night));
  React.useEffect(() => {
    const refresh = () => setAttended(getAttendedForNight(night));
    window.addEventListener("plursky-attended-change", refresh);
    return () => window.removeEventListener("plursky-attended-change", refresh);
  }, [night]);
  const toggle = (id) => {
    try { window.plurskyHaptic?.(attended.has(id) ? "LIGHT" : "MEDIUM"); } catch {}
    if (attended.has(id)) unmarkAttended(night, id);
    else markAttended(night, id, "manual");
  };
  const caught = savedNightArtists.filter(a => attended.has(a.id)).length;
  return (
    <div style={{
      marginTop: 10, padding: "12px 14px",
      background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          SETS YOU CAUGHT
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: caught === savedNightArtists.length ? "var(--success)" : "var(--muted)", fontWeight: 700 }}>
          {caught} / {savedNightArtists.length}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {savedNightArtists
          .slice()
          .sort((a, b) => a.start.localeCompare(b.start))
          .map(a => {
            const on = attended.has(a.id);
            const stage = STAGES.find(s => s.id === a.stage);
            const src = on ? getAttendanceSource(a.id) : null;
            return (
              <button key={a.id} onClick={() => toggle(a.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8,
                background: on ? "rgba(45,122,85,0.10)" : "var(--paper)",
                border: on ? "1px solid rgba(45,122,85,0.4)" : "1px solid var(--line)",
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  background: on ? "var(--success)" : "transparent",
                  border: on ? "none" : "1.5px solid var(--line-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                }}>{on ? "✓" : ""}</span>
                <div style={{ width: 3, alignSelf: "stretch", background: stage?.color || "var(--line-2)", borderRadius: 3 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 14, lineHeight: 1.1 }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>
                    {(stage?.short || "").toUpperCase()} · {a.start}
                  </div>
                </div>
                {src === "gps" && (
                  <span className="mono" style={{
                    fontSize: 8, letterSpacing: 1, color: "var(--success)", fontWeight: 700,
                    padding: "2px 6px", borderRadius: 999,
                    background: "rgba(45,122,85,0.14)",
                  }}>📍 GPS</span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

function MeScreen({ state, setState }) {
  // Build identity from Spotify profile when available, else fall back to user-set name
  const [profile, setProfile] = React.useState(getSpotifyProfileSync);
  const [localName, setLocalName] = React.useState(() => {
    try { return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || ""; } catch { return ""; }
  });
  React.useEffect(() => {
    if (state.spotifyConnected && !profile) {
      ensureSpotifyProfile().then(setProfile);
    }
  }, [state.spotifyConnected]);

  // Resolve display name from Spotify profile → display_name → user_name
  // (matches Runbuds-style identity: serif name + ping chip + tagline).
  const rawName = profile?.name || localName || "";
  const displayName = rawName || "—";
  const initial = rawName ? (rawName.match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase() : "?";
  const promptName = () => {
    const next = (window.prompt("Your name (shown to crew & on this screen):", localName || "") || "").trim();
    if (!next) return;
    try { localStorage.setItem("plursky_display_name", next); } catch {}
    setLocalName(next);
  };

  // Ping code (e.g. SAGE) — exported on window by map.jsx
  const pingCode = (typeof window.getMyPingCode === "function" ? window.getMyPingCode() : "PLUR");

  // Deterministic ping color from code → palette token. Stays in the
  // desert-dawn family (ember/flare/horizon/sky/success). Avatar circle
  // + ping chip dot pull from this so identity reads consistent.
  const PING_PALETTE = ["var(--ember)", "var(--flare)", "var(--horizon)", "var(--sky)", "var(--success)"];
  let pingHash = 0;
  for (let i = 0; i < pingCode.length; i++) pingHash = (pingHash * 31 + pingCode.charCodeAt(i)) >>> 0;
  const pingColor = PING_PALETTE[pingHash % PING_PALETTE.length];

  // Live crew count from Supabase Realtime presence (0 if not connected)
  const [crewCount, setCrewCount] = React.useState(() => {
    try {
      const snap = window.sbGetPresSnap?.() || {};
      const mine = window.sbGetMyPresId?.();
      return Object.keys(snap).filter(id => id !== mine).length;
    } catch { return 0; }
  });
  React.useEffect(() => {
    if (typeof window.sbOnPresenceChange !== "function") return;
    return window.sbOnPresenceChange(snap => {
      try {
        const mine = window.sbGetMyPresId?.();
        setCrewCount(Object.keys(snap).filter(id => id !== mine).length);
      } catch {}
    });
  }, []);

  // Settings (Notifications / Battery / Pack list / Wizard) folded into a
  // single disclosure so the festival-flavored top of the page reads first.
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [festivalOpen, setFestivalOpen] = React.useState(true);
  const [socialOpen, setSocialOpen] = React.useState(true);

  // Stats — kept locally per the spec; intentionally cheap, not precious.
  // SETS CAUGHT now reflects real attendance (live GPS auto-detect + manual
  // review checklist in Memories). Re-renders on any attendance change via
  // the global "plursky-attended-change" event.
  const [setsCaught, setSetsCaught] = React.useState(getAttendedCount);
  React.useEffect(() => {
    const refresh = () => setSetsCaught(getAttendedCount());
    window.addEventListener("plursky-attended-change", refresh);
    return () => window.removeEventListener("plursky-attended-change", refresh);
  }, []);
  const daysHere = NOW.day || 0;
  const savedCount = state.saved.length;
  // Earned-badge count for the 4-card grid badge — cheap derivation mirroring
  // BadgesSection's logic. Always at least 1 (the "30 Years Crew" auto-earn).
  const badgesEarnedCount = React.useMemo(() => {
    const savedArtists = state.saved.map(id => ARTISTS.find(x => x.id === id)).filter(Boolean);
    const stages = new Set(savedArtists.map(a => a.stage));
    const heads  = savedArtists.filter(a => a.tier === 3).length;
    const byStg  = (id) => savedArtists.filter(a => a.stage === id).length;
    let n = 1; // 30 Years Crew always
    if (savedArtists.length >= 1) n++;
    if (savedArtists.length >= 10) n++;
    if (savedArtists.length >= 20) n++;
    if (stages.size >= 5) n++;
    if (stages.size >= 9) n++;
    if (heads >= 3) n++;
    if (byStg("quantum") >= 3) n++;
    if (byStg("neon") >= 3) n++;
    if (byStg("circuit") >= 3) n++;
    if (byStg("basspod") + byStg("waste") >= 3) n++;
    return n;
  }, [state.saved]);

  // Tagline — "DAY N OF EDC LV 2026" once the festival is live, otherwise
  // a pre-festival countdown line with the date range.
  const _cfg = window.FESTIVAL_CONFIG || {};
  const tagline = daysHere
    ? `DAY ${daysHere} OF ${(_cfg.shortName || _cfg.brand || "").toUpperCase()}`
    : `${(_cfg.shortName || _cfg.brand || "").toUpperCase()} · ${(_cfg.dates || "").toUpperCase()}`;

  return (
    <Screen bg="var(--paper)">
      <div style={{ padding: "8px 20px" }}>
        <TopBar title={<span>Me</span>} sub={FESTIVAL_CONFIG.shortName.toUpperCase()} tight />
      </div>
      <ScrollBody ref={useStaggerFade("me")} style={{ padding: "10px 20px 94px" }}>
        {/* ── 1. Identity card (Runbuds-modeled) ───────────────────
            Centered avatar in the user's ping color, serif name,
            ping-code chip in mono caps, festival-day tagline. */}
        <div data-animate style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "18px 16px 20px", marginBottom: 16,
        }}>
          <div
            onClick={profile ? undefined : promptName}
            style={{
              width: 78, height: 78, borderRadius: 999,
              background: profile?.image ? "transparent" : pingColor,
              border: "3px solid #fff",
              boxShadow: "0 2px 8px rgba(26,18,13,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              cursor: profile ? "default" : "pointer",
              marginBottom: 10,
            }}
          >
            {profile?.image ? (
              <img src={profile.image} alt="" style={{
                width: "100%", height: "100%", objectFit: "cover",
              }}/>
            ) : (
              <span className="serif" style={{
                fontSize: 36, color: "#fff", lineHeight: 1,
                textShadow: "0 1px 2px rgba(26,18,13,0.25)",
              }}>{initial}</span>
            )}
          </div>
          <div
            className="serif"
            onClick={rawName ? undefined : promptName}
            style={{
              fontSize: 28, lineHeight: 1.05, color: rawName ? "var(--ink)" : "var(--muted)",
              textAlign: "center", marginBottom: 8,
              cursor: rawName ? "default" : "pointer",
            }}
          >
            {displayName}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--paper-2)", borderRadius: 999, padding: "4px 10px",
            marginBottom: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: pingColor,
              display: "inline-block",
            }}/>
            <span className="mono" style={{
              fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--ink)",
            }}>PING · {pingCode}</span>
          </div>
          <div className="mono" style={{
            fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
          }}>{tagline}</div>
        </div>

        {/* ── 2. Three-stat row (Forest-modeled) ───────────────────
            Sets caught (saved sets whose day has passed/is today),
            crew (live presence count), days here (NOW.day). */}
        <div data-animate style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          background: "var(--paper-2)", border: "1px solid var(--line)",
          borderRadius: 14, padding: "14px 4px", marginBottom: 18,
        }}>
          {[
            { n: setsCaught, label: "SETS CAUGHT" },
            { n: crewCount,  label: "CREW" },
            { n: daysHere,   label: "DAYS HERE" },
          ].map((s, i) => (
            <div key={s.label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              borderLeft: i === 0 ? "none" : "1px solid var(--line)",
              padding: "2px 6px",
            }}>
              <div className="serif" style={{ fontSize: 28, lineHeight: 1, color: "var(--ink)", marginBottom: 6 }}>
                {s.n}
              </div>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
                textAlign: "center",
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── 3. 4-card grid (komoot-modeled) ──────────────────────
            Quick jumps to Saved, Memories (stub), Crew (stub),
            Badges (stub). 2x2 square-ish cells with emoji + count. */}
        <div data-animate style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
          marginBottom: 22,
        }}>
          {[
            { key: "saved",    label: "SAVED",    count: savedCount, icon: "★",
              onClick: () => setState(st => ({ ...st, tab: "lineup" })) },
            { key: "memories", label: "MEMORIES", count: _countMoments(), icon: "◐",
              onClick: () => setState(s => ({ ...s, tab: "memories" })) },
            { key: "crew",     label: "CREW",     count: crewCount,   icon: "☷",
              onClick: () => alert("See Crew below") },
            { key: "badges",   label: "BADGES",   count: badgesEarnedCount, icon: "✦",
              onClick: () => {
                document.getElementById("plursky-badges-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
              } },
          ].map(card => (
            <button key={card.key} onClick={card.onClick} style={{
              position: "relative",
              background: "var(--paper-2)", border: "1px solid var(--line)",
              borderRadius: 14, padding: 14, minHeight: 96,
              display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "space-between",
              textAlign: "left", cursor: "pointer",
              fontFamily: "inherit", color: "var(--ink)",
            }}>
              <div style={{
                position: "absolute", top: 12, right: 14,
                fontSize: 18, lineHeight: 1, color: "var(--muted)",
              }}>{card.icon}</div>
              <div/>
              <div>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "var(--ink)" }}>
                  {card.count}
                </div>
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
                  marginTop: 4,
                }}>{card.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Festival Recap entry (v145) ───────────────────────────
            Spotify-Wrapped-style summary of the weekend — sets caught,
            top stage, top genre, hidden gems. Lives behind a big card
            on Me so it's discoverable but optional. Only renders once
            the festival is over (otherwise the stats are noise). */}
        {typeof window.FESTIVAL_CONFIG?.endMs === "number" && Date.now() > window.FESTIVAL_CONFIG.endMs && (
          <button onClick={() => setState(s => ({ ...s, tab: "recap" }))} style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%", padding: "14px 16px", marginBottom: 14,
            background: "linear-gradient(135deg, var(--ink) 0%, var(--horizon) 100%)",
            border: "none", borderRadius: 16,
            color: "var(--paper)", cursor: "pointer", textAlign: "left",
            boxShadow: "0 4px 18px rgba(123,61,154,0.30)",
          }}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>✦</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 20, lineHeight: 1.05 }}>
                Your <span style={{ fontStyle: "italic", color: "var(--flare)" }}>{_cfg.brand || "festival"}</span> weekend
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "rgba(247,237,224,0.65)", marginTop: 4, fontWeight: 700 }}>
                THE RECAP · {getAttendedCount?.() || 0} SETS CAUGHT · TAP TO SEE
              </div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.75 }}>→</span>
          </button>
        )}

        {/* ── FESTIVAL section (collapsible) ──────────────────── */}
        <div data-animate style={{ borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 14, marginBottom: 18 }}>
          <button onClick={() => setFestivalOpen(o => !o)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px",
            textAlign: "left", color: "var(--ink)",
          }}>
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.05 }}>
                Festival
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                HISTORY · BADGES · MUSIC · HEADLINERS
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "transform 0.25s var(--ease-spring)", transform: festivalOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <path d="M9 18 L15 12 L9 6"/>
            </svg>
          </button>
          <div style={{
            display: "grid",
            gridTemplateRows: festivalOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.3s var(--ease-smooth)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <HistoryRecordsSection state={state} setState={setState} />
              <div style={{ marginTop: 14 }}/>
              <div id="plursky-badges-anchor"/>
              <BadgesSection state={state} />
              <div style={{ marginTop: 14 }}/>
              <button
                onClick={() => setState({ ...state, tab: "spotify" })}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "13px 14px", marginBottom: 14,
                  background: state.spotifyConnected
                    ? "linear-gradient(135deg, rgba(29,185,84,0.12), rgba(123,61,154,0.10))"
                    : "var(--paper-2)",
                  border: state.spotifyConnected
                    ? "1px solid rgba(29,185,84,0.4)"
                    : "1px solid var(--line-2)",
                  borderRadius: 14, cursor: "pointer", textAlign: "left",
                }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 38, flexShrink: 0,
                  background: state.spotifyConnected
                    ? "linear-gradient(135deg, #1DB954, var(--horizon))"
                    : "linear-gradient(135deg, var(--ember), var(--horizon))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="15" r="2.5"/>
                    <path d="M9.5 17 L9.5 5 L19.5 3 L19.5 15"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 18, lineHeight: 1.05, color: "var(--ink)" }}>
                    {state.spotifyConnected ? "Music · matched" : "Match the lineup to your Spotify"}
                  </div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)", marginTop: 3 }}>
                    {state.spotifyConnected ? "TOP ARTISTS · DISCOVERIES · BUILD PLAYLIST" : "TAP TO CONNECT"}
                  </div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M9 18 L15 12 L9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── SOCIAL section (collapsible) ─────────────────────── */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 18 }}>
          <button onClick={() => setSocialOpen(o => !o)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px",
            textAlign: "left", color: "var(--ink)",
          }}>
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.05 }}>
                Friends & <span style={{ fontStyle: "italic" }}>crew</span>
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                LIVE LOCATION · SHARED LINEUPS
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "transform 0.25s var(--ease-spring)", transform: socialOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <path d="M9 18 L15 12 L9 6"/>
            </svg>
          </button>
          <div style={{
            display: "grid",
            gridTemplateRows: socialOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.3s var(--ease-smooth)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ marginBottom: 14 }}>
                <FriendsCard state={state} setState={setState} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <CrewCard state={state} />
              </div>
              <AccountCard state={state} setState={setState} />
            </div>
          </div>
        </div>

        {/* Settings — folds Notifications, Battery saver, Pack list, and the
            setup-wizard re-run into one disclosure to keep the festival top
            of the page above the fold. */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            style={{
              width: "100%", padding: "13px 14px",
              background: "var(--paper-2)", border: "1px solid var(--line-2)",
              borderRadius: 14, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12,
              fontFamily: "inherit", color: "var(--ink)",
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.05 }}>Settings</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 3 }}>
                NOTIFICATIONS · BATTERY · PACK LIST · WIZARD
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "transform 0.25s var(--ease-spring)", transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <path d="M9 18 L15 12 L9 6"/>
            </svg>
          </button>
          {settingsOpen && (
            <div style={{ marginTop: 10 }}>
              <NotificationsCard state={state} />
              <BatterySaverCard />
              <PackListCard />
              <div style={{ marginTop: 14 }}>
                <button onClick={() => window.plurskyOpenOnboarding?.()} style={{
                  background: "transparent", border: "1px solid var(--line-2)",
                  borderRadius: 999, padding: "8px 14px", cursor: "pointer",
                  color: "var(--muted)",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
                }}>
                  ↻ RE-RUN SETUP WIZARD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Safety & Wellness — harm-reduction one tap away */}
        <div className="serif" style={{ fontSize: 22, marginTop: 20, marginBottom: 3 }}>
          Safety & <span style={{ fontStyle: "italic" }}>care</span>
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 12 }}>
          ON-SITE TEAMS · NO QUESTIONS ASKED
        </div>
        <SafetyCards />

        {/* Your headliners — saved tier-3 sets, tappable to artist screen.
            Replaces the old static "Memories" grid which was unlinked
            decoration. Hidden if the user hasn't saved any headliners yet. */}
        {(() => {
          const savedHeadliners = state.saved
            .map(id => ARTISTS.find(a => a.id === id))
            .filter(a => a && a.tier === 3)
            .slice(0, 6);
          if (savedHeadliners.length === 0) return null;
          return (
            <>
              <div className="serif" style={{ fontSize: 22, marginTop: 20, marginBottom: 10 }}>
                Your <span style={{ fontStyle: "italic" }}>headliners</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {savedHeadliners.map(a => (
                  <button key={a.id} onClick={() => setState({ ...state, artist: a.id })} style={{
                    aspectRatio: "1/1", borderRadius: 10, background: a.img,
                    position: "relative", overflow: "hidden", border: "none", padding: 0, cursor: "pointer",
                  }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.65))" }}/>
                    <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, color: "#fff", textAlign: "left" }} className="mono">
                      <div style={{ fontSize: 10, letterSpacing: 0.4, fontWeight: 700, lineHeight: 1.1, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                      <div style={{ fontSize: 8, letterSpacing: 1, opacity: 0.8 }}>
                        {FESTIVAL_CONFIG.dayDates[a.day]?.short || ""} · {fmt12(a.start)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          );
        })()}
        <div style={{
          padding: "24px 0 40px", textAlign: "center",
          borderTop: "1px solid var(--line)", marginTop: 24,
        }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", marginBottom: 10 }}>
            PLURSKY · {window.FESTIVAL_CONFIG?.shortName || ""}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <a href="https://plursky.com/privacy" target="_blank" rel="noopener noreferrer"
              className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", textDecoration: "none" }}>
              PRIVACY POLICY
            </a>
            <a href="https://plursky.com/terms" target="_blank" rel="noopener noreferrer"
              className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", textDecoration: "none" }}>
              TERMS
            </a>
            <button onClick={() => window.open("mailto:hello@plursky.com")}
              className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              CONTACT
            </button>
          </div>
        </div>
      </ScrollBody>
    </Screen>
  );
}

function FollowedNudge({ state, setState }) {
  const [followed, setFollowed] = React.useState(null); // null=loading, []=none
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    fetchFollowedEdcArtists(state.saved).then(setFollowed);
  }, [state.saved.length]);

  if (!followed || followed.length === 0) return null;

  const handleSave = (artist) => {
    setState(s => ({ ...s, saved: [...new Set([...s.saved, artist.id])] }));
  };
  const handleSaveAll = () => {
    setState(s => ({ ...s, saved: [...new Set([...s.saved, ...followed.map(a => a.id)])] }));
  };

  return (
    <div style={{
      background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.25)",
      borderRadius: 16, padding: "14px 16px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "#1DB954", fontWeight: 700 }}>
            YOU FOLLOW {followed.length} {(FESTIVAL_CONFIG.brand || "").toUpperCase()} ACT{followed.length > 1 ? "S" : ""} NOT IN YOUR LINEUP
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleSaveAll} style={{
            background: "#1DB954", color: "#000", border: "none",
            borderRadius: 999, padding: "5px 10px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1, fontWeight: 700,
          }}>SAVE ALL</button>
          <button onClick={() => setExpanded(e => !e)} style={{
            background: "transparent", color: "rgba(247,237,224,0.6)",
            border: "1px solid rgba(247,237,224,0.2)",
            borderRadius: 999, padding: "5px 10px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1,
          }}>{expanded ? "HIDE" : "VIEW"}</button>
        </div>
      </div>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {followed.map(a => {
            const st = STAGES.find(s => s.id === a.stage);
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "8px 12px",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 8, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>
                    {st?.short} · DAY {a.day} · {fmt12(a.start)}
                  </div>
                </div>
                <button onClick={() => handleSave(a)} style={{
                  background: "transparent", color: st?.color || "#1DB954",
                  border: `1px solid ${st?.color || "#1DB954"}`,
                  borderRadius: 999, padding: "5px 10px", cursor: "pointer",
                  fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 1, fontWeight: 700,
                }}>+ SAVE</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuildPlaylistButton({ state }) {
  const [status, setStatus] = React.useState("idle"); // idle | working | done | err
  const [result, setResult] = React.useState(null);
  const [buildProgress, setBuildProgress] = React.useState("");

  const run = async () => {
    setStatus("working");
    setBuildProgress("");
    try {
      const r = await createEdcPlaylist(state, { onProgress: (msg) => setBuildProgress(msg) });
      setResult(r);
      if (r.ok) {
        setStatus("done");
      } else {
        setStatus("err");
        // Persist actionable errors (reconnect, missing target playlist) so the
        // user has time to read + click. Auto-clear only transient failures.
        if (r.reason !== "reconnect" && r.reason !== "no_target_playlist") {
          setTimeout(() => setStatus("idle"), 4500);
        }
      }
    } catch (e) {
      setResult({ ok: false, reason: "create_fail", message: String(e?.message || e) });
      setStatus("err");
      setTimeout(() => setStatus("idle"), 4500);
    }
  };

  // After the user reconnects via OAuth and returns to the app, resume the
  // build automatically if they were mid-flow. Removes the otherwise required
  // third click ("connect", "back", "build again").
  React.useEffect(() => {
    let pending = null;
    try { pending = localStorage.getItem("plursky_pending_build"); } catch {}
    if (pending && state.spotifyConnected && _hasPlaylistWriteScope()) {
      try { localStorage.removeItem("plursky_pending_build"); } catch {}
      run();
    }
  }, []); // mount-only — pending flag is one-shot

  const onClick = async () => {
    if (status === "working") return;
    if (status === "err" && (result?.reason === "reconnect" || result?.reason === "not_connected")) {
      // Mark intent so we auto-resume after the OAuth round-trip.
      try { localStorage.setItem("plursky_pending_build", "1"); } catch {}
      startSpotifyAuth(); return;
    }
    if (status === "err" && result?.reason === "no_target_playlist") {
      window.open("https://open.spotify.com/", "_blank", "noopener"); return;
    }
    // When done, clicking opens the playlist (user-initiated — not blocked)
    if (status === "done" && result?.url) {
      window.open(result.url, "_blank", "noopener"); return;
    }
    window.plurskyHaptic?.("MEDIUM");
    run();
  };

  let label, bg = "rgba(29,185,84,0.14)", color = "#1DB954", border = "1px solid #1DB954";
  if (status === "working") {
    label = buildProgress ? `BUILDING · ${buildProgress}` : "BUILDING…";
  } else if (status === "done") {
    const missed = result?.missed || 0;
    label = missed > 0
      ? `✓ ${result?.added} TRACKS (${missed} not on Spotify) — OPEN ↗`
      : `✓ ${result?.added} TRACKS · FRI→SAT→SUN — OPEN ↗`;
    bg = "#1DB954"; color = "#000"; border = "none";
  } else if (status === "err") {
    if (result?.reason === "reconnect" || result?.reason === "not_connected") label = "↻ TAP TO GRANT SPOTIFY ACCESS";
    else if (result?.reason === "no_target_playlist") label = "↗ CREATE 'PLURSKY' PLAYLIST IN SPOTIFY";
    else if (result?.reason === "rate_limited") label = "⏱ SPOTIFY BUSY · WAIT 30S, TAP AGAIN";
    else if (result?.reason === "empty") label = "SAVE SETS FIRST";
    else if (result?.reason === "create_fail") {
      const msg = (result?.message || "").slice(0, 28);
      label = msg ? `✕ ${result?.status} · ${msg}` : `✕ FAILED · ${result?.status || "?"}`;
    } else label = "✕ TRY AGAIN";
    bg = "rgba(248,113,113,0.18)"; color = "#fecaca"; border = "1px solid #f87171";
  } else {
    label = "BUILD MY PLAYLIST";
  }

  return (
    <button onClick={onClick} disabled={status === "working"} style={{
      background: bg, color, border,
      borderRadius: 999, padding: "10px 16px",
      cursor: status === "working" ? "wait" : "pointer",
      fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
      transition: "all .2s",
    }}>{label}</button>
  );
}


// ── Festival Archive — multi-festival memory ──────────────────
// Snapshots the current festival's attendance + moments + saved sets
// when the active festival changes (e.g., EDC ends, ACL activates).
// Snapshots are immutable so users can scroll back through past festivals.
const ARCHIVE_KEY = "plursky_festival_archive_v1";

function _readArchive() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "{}"); } catch { return {}; }
}

function archiveFestival(festivalId, festivalName, festivalConfig) {
  if (!festivalId) return false;
  try {
    const archive = _readArchive();
    // Don't overwrite an existing snapshot — first archive wins (the user
    // explicitly archived) unless empty (auto-archive after re-entry).
    const attended = JSON.parse(localStorage.getItem("plursky_attended_v1") || "{}");
    const moments  = JSON.parse(localStorage.getItem("plursky_moments_v1")  || "{}");
    const saved    = JSON.parse(localStorage.getItem("edc_saved") || "[]");
    const totalAttended = Object.values(attended).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    const totalMoments  = Object.values(moments).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    if (totalAttended === 0 && totalMoments === 0 && saved.length === 0) return false;
    archive[festivalId] = {
      id: festivalId,
      name: festivalName,
      brand: festivalConfig?.brand,
      year: festivalConfig?.year,
      dates: festivalConfig?.dates,
      locationShort: festivalConfig?.locationShort,
      archivedAt: new Date().toISOString(),
      saved, attended, moments,
      totalAttended, totalMoments, totalSaved: saved.length,
    };
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    return true;
  } catch { return false; }
}

// Auto-archive trigger: stamp the current festival ID on first load. When it
// changes, snapshot the previous one. Runs once per session via a module-level
// flag so multiple component mounts don't re-trigger.
let _archiveCheckDone = false;
function _maybeAutoArchive() {
  if (_archiveCheckDone) return;
  _archiveCheckDone = true;
  try {
    const cur = window.FESTIVAL_CONFIG?.id;
    if (!cur) return;
    const lastSeen = localStorage.getItem("plursky_last_festival_id");
    if (lastSeen && lastSeen !== cur) {
      // Festival switched — snapshot the previous one's data BEFORE it's
      // co-mingled with the new festival
      const archive = _readArchive();
      if (!archive[lastSeen]) {
        // Need the old config to populate the snapshot meta; pull from registry
        const reg = window.FESTIVALS_REGISTRY || [];
        const prevCfg = reg.find(r => r.config?.id === lastSeen)?.config;
        archiveFestival(lastSeen, prevCfg?.name || lastSeen, prevCfg);
      }
    }
    localStorage.setItem("plursky_last_festival_id", cur);
  } catch {}
}
if (typeof window !== "undefined") setTimeout(_maybeAutoArchive, 100);

// ── Festival Recap (v145) ─────────────────────────────────────
// Spotify-Wrapped-style post-festival summary. Stitches together the
// attendance store (plursky_attended_v1), saved sets, Memories moments,
// and any cached Spotify popularity stats into a series of full-bleed
// cards that scroll vertically. No "tap to next" gesture — just a clean
// long-form recap the user can screenshot at will.
function _computeRecap(state) {
  const attended = getAllAttended();                // { night: artistId[] }
  const moments  = _readMoments();                   // { night: moment[] }
  const ARTISTS  = window.ARTISTS || [];
  const STAGES   = window.STAGES  || [];
  const CFG      = window.FESTIVAL_CONFIG;

  // Flatten to attended-artist objects with night info
  const caughtArtists = [];
  Object.keys(attended).forEach(n => {
    (attended[n] || []).forEach(id => {
      const a = ARTISTS.find(x => x.id === id);
      if (a) caughtArtists.push({ ...a, _night: +n });
    });
  });
  const setsCount = caughtArtists.length;

  // Time spent (minutes) across all attended sets
  const totalMin = caughtArtists.reduce((sum, a) => {
    const sm = window.toNightMin?.(a.start) || 0;
    const em = window.toNightMin?.(a.end)   || 0;
    return sum + Math.max(0, em - sm);
  }, 0);

  // Sets per night → busiest night
  const byNight = {};
  caughtArtists.forEach(a => { byNight[a._night] = (byNight[a._night] || 0) + 1; });
  const busiestNight = Object.keys(byNight).sort((x, y) => byNight[y] - byNight[x])[0];
  const busiestNightCount = busiestNight ? byNight[busiestNight] : 0;
  const busiestNightLabel = busiestNight && CFG?.dayDates?.[busiestNight]?.name || `Night ${busiestNight || "—"}`;

  // Sets per stage → top stage
  const byStage = {};
  const stageMinutes = {};
  caughtArtists.forEach(a => {
    byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    const sm = window.toNightMin?.(a.start) || 0;
    const em = window.toNightMin?.(a.end)   || 0;
    stageMinutes[a.stage] = (stageMinutes[a.stage] || 0) + Math.max(0, em - sm);
  });
  const topStageId = Object.keys(stageMinutes).sort((x, y) => stageMinutes[y] - stageMinutes[x])[0];
  const topStage   = topStageId ? STAGES.find(s => s.id === topStageId) : null;
  const topStageMin = topStageId ? stageMinutes[topStageId] : 0;

  // Genre tally
  const byGenre = {};
  caughtArtists.forEach(a => { byGenre[a.genre] = (byGenre[a.genre] || 0) + 1; });
  const topGenre = Object.keys(byGenre).sort((x, y) => byGenre[y] - byGenre[x])[0] || null;

  // First and last set (chronologically across all 3 nights)
  const _artistEpoch = (a) => {
    const dm = CFG?.dayDates?.[a._night];
    if (!dm) return 0;
    const [h, m] = a.start.split(":").map(Number);
    const adjustH = h < 6 ? h + 24 : h;
    return dm.midnightUtc + adjustH * 3600000 + m * 60000;
  };
  const chronological = caughtArtists.slice().sort((x, y) => _artistEpoch(x) - _artistEpoch(y));
  const firstSet = chronological[0] || null;
  const lastSet  = chronological[chronological.length - 1] || null;

  // Headliners caught
  const headlinersCaught = caughtArtists.filter(a => a.tier === 3);
  const headlinerNames = headlinersCaught.map(a => a.name);

  // Sunrise sets caught (started at or after 04:00 next-day, i.e. early-AM)
  const sunriseSets = caughtArtists.filter(a => {
    const [h] = a.start.split(":").map(Number);
    return h >= 4 && h <= 8;
  });

  // Hidden gem: lowest Spotify popularity among the artists they caught
  // (requires the spotify_artist_data_v1 cache that artist.jsx populates).
  let hiddenGem = null;
  let topByPop  = null;
  try {
    const cache = JSON.parse(localStorage.getItem("spotify_artist_data_v1") || "{}");
    const annotated = caughtArtists
      .map(a => {
        const c = cache[a.name.toLowerCase()];
        return c?.popularity > 0 ? { ...a, _pop: c.popularity } : null;
      })
      .filter(Boolean);
    if (annotated.length) {
      annotated.sort((x, y) => x._pop - y._pop);
      hiddenGem = annotated[0];
      topByPop  = annotated[annotated.length - 1];
    }
  } catch {}

  // Memories
  const allMoments = Object.values(moments).flat();
  const photoMoments = allMoments.filter(m => m.photoId);
  const videoMoments = allMoments.filter(m => m.kind === "video");
  // v148: hero-photo candidate — earliest photo we have so the hero card
  // reads chronologically. Image-only (videos render slow/heavy as a bg).
  const heroPhotoMoment = photoMoments
    .filter(m => m.kind !== "video")
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0] || null;

  // v147: stages visited (unique stages with ≥1 attended set)
  const stagesVisited = Array.from(new Set(caughtArtists.map(a => a.stage)));
  const stagesVisitedNames = stagesVisited
    .map(id => STAGES.find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.name);

  // v147: walking distance estimate — sum minutes from WALK_PAIRS for every
  // stage-to-stage transition in chronological attendance, then convert to
  // approximate metres at festival pace (~75 m/min).
  const _artistEpochM = (a) => {
    const dm = CFG?.dayDates?.[a._night];
    if (!dm) return 0;
    const [h, m] = a.start.split(":").map(Number);
    return dm.midnightUtc + (h < 6 ? h + 24 : h) * 3600000 + m * 60000;
  };
  const walkSequence = caughtArtists.slice().sort((a, b) => _artistEpochM(a) - _artistEpochM(b));
  let walkingMinutesLo = 0, walkingMinutesHi = 0;
  const WP = window.WALK_PAIRS || {};
  const PK = window._pairKey || ((a, b) => a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 1; i < walkSequence.length; i++) {
    const prev = walkSequence[i - 1].stage;
    const cur  = walkSequence[i].stage;
    if (prev === cur) continue;
    const pair = WP[PK(prev, cur)];
    if (!pair) continue;
    walkingMinutesLo += pair[0];
    walkingMinutesHi += pair[1];
  }
  const walkingMetersLo = Math.round(walkingMinutesLo * 75);
  const walkingMetersHi = Math.round(walkingMinutesHi * 75);

  // v147: B2B sets caught — artist names containing "b2b" or " b2b "
  const b2bSets = caughtArtists.filter(a => /\bb2b\b/i.test(a.name));

  return {
    setsCount,
    totalMin,
    nights: Object.keys(byNight).length,
    busiestNightLabel,
    busiestNightCount,
    topStage, topStageMin,
    topGenre,
    firstSet, lastSet,
    headlinersCaught: headlinersCaught.length,
    headlinerNames,
    sunriseSetsCount: sunriseSets.length,
    hiddenGem, topByPop,
    momentsCount: allMoments.length,
    photosCount:  photoMoments.length,
    videosCount:  videoMoments.length,
    stagesVisitedCount: stagesVisited.length,
    stagesVisitedNames,
    walkingMinutesLo, walkingMinutesHi,
    walkingMetersLo,  walkingMetersHi,
    b2bCount: b2bSets.length,
    b2bNames: b2bSets.map(a => a.name),
    heroPhotoMoment,
    // v148: saved-but-not-attended = the ones you marked then missed.
    // Trim to the most "valuable" — by tier desc, then by chronological order.
    missedSaved: (state.saved || [])
      .map(id => ARTISTS.find(a => a.id === id))
      .filter(a => a && !caughtArtists.some(ca => ca.id === a.id))
      .sort((a, b) => (b.tier || 0) - (a.tier || 0))
      .slice(0, 6),

    // S2: Genre breakdown from caught artists
    genreBreakdown: (() => {
      const counts = {};
      caughtArtists.forEach(a => {
        const g = (a.genre || "").toLowerCase();
        if (g) counts[g] = (counts[g] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({ genre, count }));
    })(),

    // S4: Festival vibe score — energy heuristic from genres
    vibeScore: (() => {
      const highEnergy = ["dubstep","bass","hardstyle","hardcore","drum and bass","dnb","tech house","techno","riddim","psytrance","hard dance"];
      const chill = ["ambient","downtempo","lofi","acoustic","folk","singer-songwriter","jazz","blues"];
      let energy = 0, total = 0;
      caughtArtists.forEach(a => {
        const g = (a.genre || "").toLowerCase();
        if (!g) return;
        total++;
        if (highEnergy.some(k => g.includes(k))) energy++;
        else if (chill.some(k => g.includes(k))) energy -= 0.3;
        else energy += 0.5;
      });
      return total > 0 ? Math.min(100, Math.max(0, Math.round(energy / total * 100))) : null;
    })(),
  };
}

function _fmtHrsMin(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}M`;
  if (m === 0) return `${h}H`;
  return `${h}H ${m}M`;
}

function _aggregateSoundtrack(moments) {
  const songMap = {};
  const artists = window.ARTISTS || [];
  for (const m of Object.values(moments)) {
    if (!m.artistId || !m.takenAt) continue;
    const artist = artists.find(a => a.id === m.artistId);
    if (!artist) continue;
    const cached = _setlistCache[artist.name.toLowerCase().replace(/\W+/g, "_")];
    if (!cached || cached.source !== "1001tracklists") continue;
    const match = _matchSongAtTime(artist, cached, m.takenAt);
    if (!match) continue;
    const key = match.song.toLowerCase();
    if (!songMap[key]) songMap[key] = { song: match.song, count: 0, artists: new Set() };
    songMap[key].count++;
    songMap[key].artists.add(artist.name);
  }
  return Object.values(songMap).sort((a, b) => b.count - a.count);
}

// ── Festival Wrapped — Spotify-style swipeable story ─────────────
function WrappedStory({ recap, onClose }) {
  const [idx, setIdx] = React.useState(0);
  const CFG = window.FESTIVAL_CONFIG || {};
  const heroUrl = useMomentPhoto(recap.heroPhotoMoment?.photoId);

  const cards = React.useMemo(() => {
    const c = [];
    c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #6D28D9 50%, #e85d2e 100%)",
      kicker: (CFG.shortName || "FESTIVAL").toUpperCase() + " · " + (CFG.year || ""),
      headline: <>Your <em>Wrapped</em></>,
      sub: `${recap.setsCount} sets · ${recap.nights} nights · ${recap.stagesVisitedCount} stages`,
    });
    if (recap.setsCount > 0) c.push({
      bg: "linear-gradient(155deg, #1a120d 0%, #e85d2e 100%)",
      kicker: "SETS CAUGHT",
      headline: <>{recap.setsCount}</>,
      sub: `across ${recap.nights} night${recap.nights !== 1 ? "s" : ""} and ${recap.stagesVisitedCount} stages`,
    });
    if (recap.topStage) c.push({
      bg: `linear-gradient(155deg, #0a0618 0%, ${recap.topStage.color} 100%)`,
      kicker: "YOUR HOME STAGE",
      headline: <>{recap.topStage.name}</>,
      sub: `${Math.round(recap.topStageMin / 60 * 10) / 10} hours spent here`,
    });
    if (recap.topGenre) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #ec4899 100%)",
      kicker: "TOP GENRE",
      headline: <>{recap.topGenre}</>,
      sub: recap.genreBreakdown ? Object.entries(recap.genreBreakdown).sort((a,b) => b[1]-a[1]).slice(0,3).map(([g,n]) => `${g}: ${n}`).join(" · ") : "",
    });
    if (recap.totalMin > 0) {
      const mi = recap.walkingMetersHi ? (recap.walkingMetersHi / 1609.34).toFixed(1) : null;
      c.push({
        bg: "linear-gradient(155deg, #1a120d 0%, #22c55e 100%)",
        kicker: "TIME UNDER THE SKY",
        headline: <>{Math.round(recap.totalMin / 60 * 10) / 10}<span style={{ fontSize: "0.5em" }}> hours</span></>,
        sub: mi ? `~${mi} miles walked between stages` : `${recap.setsCount} sets across ${recap.nights} nights`,
      });
    }
    if (recap.sunriseSetsCount > 0) c.push({
      bg: "linear-gradient(155deg, #1a120d 0%, #fbbf24 60%, #e85d2e 100%)",
      kicker: "SUNRISE WARRIOR",
      headline: <>{recap.sunriseSetsCount} sunrise set{recap.sunriseSetsCount > 1 ? "s" : ""}</>,
      sub: recap.lastSet ? `Last set ended at ${window.fmt12?.(recap.lastSet.end) || recap.lastSet.end}` : "",
    });
    if (recap.hiddenGem) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #7b3d9a 100%)",
      kicker: "YOUR HIDDEN GEM",
      headline: <>{recap.hiddenGem.name}</>,
      sub: `Only ${recap.hiddenGem._pop}% mainstream — you found something special`,
    });
    if (recap.momentsCount > 0) c.push({
      bg: heroUrl
        ? `linear-gradient(155deg, rgba(10,6,24,0.8) 0%, rgba(109,40,217,0.7) 100%), url(${heroUrl}) center/cover`
        : "linear-gradient(155deg, #0a0618 0%, #6D28D9 100%)",
      kicker: "MEMORIES CAPTURED",
      headline: <>{recap.photosCount + recap.videosCount}</>,
      sub: `${recap.photosCount} photos${recap.videosCount ? ` · ${recap.videosCount} videos` : ""} — your festival, preserved`,
    });
    const soundtrack = _aggregateSoundtrack(_readMoments());
    if (soundtrack.length > 0) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #1DB954 100%)",
      kicker: "YOUR SOUNDTRACK",
      headline: <>{soundtrack.length} <span style={{ fontSize: "0.5em" }}>songs captured</span></>,
      sub: soundtrack.slice(0, 3).map(s => s.song).join(" · "),
      custom: React.createElement("div", { style: { marginTop: 16, textAlign: "left", width: "100%", maxWidth: 300 } },
        soundtrack.slice(0, 5).map((s, i) => React.createElement("div", {
          key: i,
          className: "mono",
          style: {
            fontSize: 9, letterSpacing: 0.8, padding: "6px 0",
            borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.1)" : "none",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: "rgba(255,255,255,0.9)",
          },
        },
          React.createElement("span", { style: { fontWeight: 700 } }, `${i + 1}. ${s.song}`),
          React.createElement("span", { style: { color: "rgba(255,255,255,0.4)", fontSize: 8 } }, `${s.count} photo${s.count > 1 ? "s" : ""}`)
        ))
      ),
    });
    c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #6D28D9 50%, #e85d2e 100%)",
      kicker: "THAT'S A WRAP",
      headline: <>See you next year</>,
      sub: `${recap.setsCount} sets · ${recap.stagesVisitedCount} stages · ${recap.momentsCount} memories`,
      final: true,
    });
    return c;
  }, [recap, heroUrl]);

  const card = cards[idx] || cards[0];
  const next = () => setIdx(i => Math.min(i + 1, cards.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));

  const handleTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) prev();
    else next();
  };

  const handleExport = async () => {
    if (!_isPlusSub()) { alert("Upgrade to Plursky+ to export your Wrapped cards."); return; }
    try { await _shareRecapCard(recap); } catch {}
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", gap: 3, padding: "12px 16px 0",
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
      }}>
        {cards.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= idx ? "#fff" : "rgba(255,255,255,0.25)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      <button onClick={onClose} style={{
        position: "absolute", top: 22, right: 16, zIndex: 3,
        width: 36, height: 36, borderRadius: 36, border: "none",
        background: "rgba(255,255,255,0.15)", color: "#fff",
        fontSize: 18, cursor: "pointer", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>✕</button>

      <div onClick={handleTap} style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 32px 120px",
        background: card.bg,
        transition: "background 0.5s",
        cursor: "pointer", userSelect: "none",
      }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.5)",
          fontWeight: 700, marginBottom: 24,
        }}>{card.kicker}</div>
        <div className="serif" style={{
          fontSize: card.headline?.props?.children?.toString?.()?.length > 15 ? 38 : 64,
          lineHeight: 0.95, color: "#fff", textAlign: "center",
          letterSpacing: -1, marginBottom: 16,
        }}>{card.headline}</div>
        <div style={{
          fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center",
          lineHeight: 1.5, maxWidth: 280,
        }}>{card.sub}</div>
          {card.custom && card.custom}
      </div>

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "20px 24px 40px",
        display: "flex", justifyContent: "center", gap: 12,
      }}>
        {card.final ? (
          <button onClick={onClose} className="mono" style={{
            padding: "12px 32px", borderRadius: 999, border: "none",
            background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
            color: "#fff", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 20px rgba(109,40,217,0.4)",
          }}>CLOSE WRAPPED</button>
        ) : (
          <button onClick={handleExport} className="mono" style={{
            padding: "10px 20px", borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)", fontSize: 9, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer", backdropFilter: "blur(4px)",
          }}>↗ SHARE CARD{!_isPlusSub() ? " · PLUS" : ""}</button>
        )}
      </div>
    </div>
  );
}

function RecapCard({ accent = "var(--ink)", paper = "var(--paper)", children, mono, kicker }) {
  return (
    <div style={{
      borderRadius: 22, padding: "26px 22px",
      background: paper, color: accent,
      marginBottom: 14,
      minHeight: 200,
      border: "1px solid var(--line)",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 6px 22px rgba(26,18,13,0.06)",
    }}>
      {kicker && (
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
          color: mono || "var(--muted)", marginBottom: 14,
        }}>{kicker}</div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

// v151: in-app rating prompt. Routes through `@capacitor-community/in-app-review`
// on native (SKStoreReviewController — iOS throttles to ~3 prompts/year by
// itself, so we don't have to be clever about timing). Web fallback opens the
// App Store listing in a new tab. Auto-trigger on Recap from the 2nd visit
// onward (1st visit = "let me see what this is"; 2nd = "I like this enough
// to come back") via a localStorage visit counter. Plus a manual link in
// the AccountCard for users who never opens Recap.
// Numeric App Store ID — paste the digits from your App Store listing URL.
// 1) Open https://apps.apple.com/us/app/plursky-live in any browser
// 2) Grab the trailing "/id<NUMBER>" from the URL (10-12 digits)
// 3) Replace null below with the number (no quotes, no slashes)
//
// Once set, the in-app rating prompt's web fallback deep-links straight to
// the listing on web; otherwise it falls back to a generic search. The
// native iOS path (InAppReview, see requestRating) doesn't depend on this
// value — it's only the web-fallback / Account-card link.
const APP_STORE_ID = 6768888507;

// ── Plursky+ paywall ──────────────────────────────────────────────
// Free: 1 static collage per festival (watermarked). Plus: unlimited
// collages, no watermark, GIF, video. $2.99/festival or $7.99/yr.
//
// IAP is handled by RevenueCat (@revenuecat/purchases-capacitor).
// On native: RevenueCat manages StoreKit, receipt validation, and
// entitlement checks. On web: falls back to localStorage flag.
//
// Setup: create products in App Store Connect, configure them in
// RevenueCat dashboard, paste your API key below.
const PLUS_KEY = "plursky_plus_active";
const RC_API_KEY = "appl_xXQYsWOMgIpVPdCTxiXmPeyxFId";
const RC_PRODUCT_IDS = {
  festival: "plursky_plus_festival",  // $2.99 non-consumable
  annual:   "plursky_plus_annual",    // $7.99/yr auto-renewable
};
const RC_ENTITLEMENT = "plus";

let _rcInitialized = false;
async function _initRevenueCat() {
  if (_rcInitialized || !RC_API_KEY) return;
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey: RC_API_KEY });
    _rcInitialized = true;
    const { customerInfo } = await Purchases.getCustomerInfo();
    _syncEntitlements(customerInfo);
    Purchases.addCustomerInfoUpdateListener(({ customerInfo: info }) => _syncEntitlements(info));
    if (typeof DEV !== "undefined") console.log("[plursky-iap] RevenueCat initialized");
  } catch (e) { console.warn("[plursky-iap] init failed:", e); }
}

function _syncEntitlements(info) {
  const active = info?.entitlements?.active?.[RC_ENTITLEMENT];
  _setPlusSub(!!active);
}

async function _purchasePlus(productId) {
  if (!window.Capacitor?.isNativePlatform?.()) {
    if (typeof DEV !== "undefined") console.log("[plursky-iap] web mode — toggling Plus for testing");
    _setPlusSub(true);
    return { success: true, web: true };
  }
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return { success: false, error: "RevenueCat not configured" };
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { offerings } = await Purchases.getOfferings();
    const pkg = offerings?.current?.availablePackages?.find(p =>
      p.product?.identifier === productId
    );
    if (!pkg) {
      console.warn("[plursky-iap] product not found:", productId);
      return { success: false, error: "Product not available" };
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    _syncEntitlements(customerInfo);
    return { success: !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT] };
  } catch (e) {
    if (e?.code === "1" || e?.message?.includes("cancelled")) {
      return { success: false, cancelled: true };
    }
    console.error("[plursky-iap] purchase error:", e);
    return { success: false, error: e.message };
  }
}

async function _restorePurchases() {
  if (!window.Capacitor?.isNativePlatform?.()) return { success: false, error: "Web mode" };
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return { success: false, error: "RevenueCat not configured" };
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    _syncEntitlements(customerInfo);
    const restored = !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
    return { success: true, restored };
  } catch (e) {
    console.error("[plursky-iap] restore error:", e);
    return { success: false, error: e.message };
  }
}

function _isPlusSub() { try { return localStorage.getItem(PLUS_KEY) === "1"; } catch { return false; } }
function _setPlusSub(v) { try { localStorage.setItem(PLUS_KEY, v ? "1" : "0"); } catch {} }

// Initialize RevenueCat on first load (non-blocking)
try { _initRevenueCat(); } catch {}

function PlusGate({ children, feature }) {
  if (_isPlusSub()) return children;
  const [busy, setBusy] = React.useState(false);

  const handlePurchase = async (productId) => {
    setBusy(true);
    try {
      const result = await _purchasePlus(productId || RC_PRODUCT_IDS.festival);
      if (result.success) window.location.reload();
    } catch {}
    setBusy(false);
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const result = await _restorePurchases();
      if (result.restored) window.location.reload();
      else if (!result.restored && result.success) alert("No previous Plursky+ purchase found for this Apple ID.");
    } catch {}
    setBusy(false);
  };

  const _PLUS_PERKS = [
    ["No watermarks", "Clean, brandable exports"],
    ["Unlimited shares", "No daily limit"],
    ["Premium templates", "Film Strip, Passport & more"],
    ["Custom accents", "Pick your festival color"],
  ];

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ filter: "blur(3px)", pointerEvents: "none", opacity: 0.35 }}>{children}</div>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 0,
        background: "linear-gradient(180deg, rgba(26,18,13,0.85) 0%, rgba(109,40,217,0.55) 100%)",
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", marginBottom: 10,
          background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 24px rgba(109,40,217,0.5)",
        }}>
          <span style={{ fontSize: 18 }}>+</span>
        </div>
        <div className="serif" style={{ fontSize: 24, color: "#fff", letterSpacing: -0.5 }}>Plursky+</div>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.4, color: "rgba(255,255,255,0.5)",
          marginTop: 4, marginBottom: 14,
        }}>
          UNLOCK {(feature || "THIS FEATURE").toUpperCase()}
        </div>

        <div style={{
          display: "flex", flexDirection: "column", gap: 7, width: "80%", maxWidth: 240,
          marginBottom: 16,
        }}>
          {_PLUS_PERKS.map(([title, sub], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#fff", fontWeight: 700,
              }}>&#10003;</div>
              <div>
                <div style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => handlePurchase(RC_PRODUCT_IDS.festival)} disabled={busy} className="mono" style={{
          padding: "11px 28px", borderRadius: 12, border: "none",
          background: busy ? "rgba(109,40,217,0.5)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
          color: "#fff", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
          boxShadow: "0 4px 20px rgba(109,40,217,0.45), 0 0 40px rgba(232,93,46,0.2)",
        }}>
          {busy ? "PROCESSING…" : "$2.99 / FESTIVAL"}
        </button>
        <div className="mono" style={{
          fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.35)",
          marginTop: 8,
        }}>
          ONE-TIME · PER FESTIVAL
        </div>
        <button onClick={handleRestore} disabled={busy} className="mono" style={{
          marginTop: 10, padding: "4px 12px", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
          color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 1,
          cursor: "pointer",
        }}>
          RESTORE PURCHASE
        </button>
      </div>
    </div>
  );
}
// P1: Export rate limiter — 5/day free, unlimited Plus
const DAILY_SHARE_LIMIT = 5;
function _getShareCount() {
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_share_count") || "{}");
    const today = new Date().toISOString().slice(0, 10);
    return raw.date === today ? (raw.count || 0) : 0;
  } catch { return 0; }
}
function _incShareCount() {
  const today = new Date().toISOString().slice(0, 10);
  const count = _getShareCount() + 1;
  try { localStorage.setItem("plursky_share_count", JSON.stringify({ date: today, count })); } catch {}
  return count;
}
function _canShare() {
  if (_isPlusSub()) return { allowed: true, remaining: Infinity };
  const used = _getShareCount();
  return { allowed: used < DAILY_SHARE_LIMIT, remaining: DAILY_SHARE_LIMIT - used };
}
function _showShareLimitToast() {
  let el = document.getElementById("plursky-share-limit");
  if (el) return;
  el = document.createElement("div");
  el.id = "plursky-share-limit";
  el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:14px 20px;text-align:center;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:1.2px;font-weight:700;color:#fff;background:#e85d2e;";
  el.textContent = "📸 DAILY SHARE LIMIT REACHED · UPGRADE TO PLURSKY+ FOR UNLIMITED";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// P2: Resolution gate — free=540, Plus=1080
function _exportScale() { return _isPlusSub() ? 1 : 0.5; }
function _exportW() { return Math.round(1080 * _exportScale()); }
function _exportH(baseH) { return Math.round((baseH || 1350) * _exportScale()); }

// P3: Festival archive — snapshot recaps per festival
function _archiveRecap(festivalId, recap) {
  try {
    const key = "plursky_recap_archive";
    const archive = JSON.parse(localStorage.getItem(key) || "{}");
    archive[festivalId] = { ...recap, archivedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(archive));
  } catch {}
}
function _getRecapArchive() {
  try { return JSON.parse(localStorage.getItem("plursky_recap_archive") || "{}"); } catch { return {}; }
}

// P4: Priority preview gate
function _canAccessFestival(festivalEntry) {
  if (festivalEntry.available) return true;
  if (festivalEntry.previewOnly && _isPlusSub()) return true;
  return false;
}

// P5: Custom accent color — Plus-only
function _getCustomAccent() {
  if (!_isPlusSub()) return null;
  try { return localStorage.getItem("plursky_custom_accent") || null; } catch { return null; }
}
function _setCustomAccent(hex) {
  try { localStorage.setItem("plursky_custom_accent", hex); } catch {}
}

function _appStoreUrl() {
  if (APP_STORE_ID) return `https://apps.apple.com/app/plursky-live/id${APP_STORE_ID}`;
  return "https://apps.apple.com/search?term=plursky%20live";
}
async function requestRating() {
  try {
    const native = window.Capacitor?.Plugins?.InAppReview;
    if (native?.requestReview && window.Capacitor?.isNativePlatform?.()) {
      await native.requestReview();
      return { ok: true, source: "native" };
    }
  } catch (e) { /* fall through to web */ }
  try { window.open(_appStoreUrl(), "_blank", "noopener"); return { ok: true, source: "web" }; }
  catch { return { ok: false }; }
}
function _maybeAutoRatingPromptOnRecap() {
  try {
    const key = "plursky_recap_visits_v1";
    const visits = parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, String(visits));
    const lastPromptedAt = parseInt(localStorage.getItem("plursky_rating_prompted_at") || "0", 10);
    const oneYearMs = 365 * 24 * 3600 * 1000;
    if (visits < 2) return;                                            // wait for 2nd visit
    if (lastPromptedAt && Date.now() - lastPromptedAt < oneYearMs) return; // iOS will silently no-op anyway
    if (!window.Capacitor?.isNativePlatform?.()) return;               // only auto-prompt on native — web spam is bad
    localStorage.setItem("plursky_rating_prompted_at", String(Date.now()));
    // Small delay so the user is past the hero card animation before iOS pops
    setTimeout(() => { requestRating().catch(() => {}); }, 1500);
  } catch {}
}

// v147: shareable image card — paints the recap stats onto a 1080x1920 canvas
// (Instagram story aspect), then shares via navigator.share files API (which
// pops the iOS share sheet — IG, Messages, AirDrop, save to camera roll) or
// downloads as PNG on desktop. Fonts ship via Google Fonts in index.html; we
// await document.fonts.ready so canvas picks them up.
async function _renderRecapShareCard(recap) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const CFG = window.FESTIVAL_CONFIG || {};

  // Ensure custom fonts are ready before we draw — canvas falls back to a
  // generic serif if Instrument Serif hasn't loaded yet.
  try {
    await document.fonts.load("700 italic 96px 'Instrument Serif'");
    await document.fonts.load("700 24px 'Geist Mono'");
    await document.fonts.load("500 64px Geist");
  } catch {}

  // Background — same gradient as the hero card on screen
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,    "#1a120d");
  grad.addColorStop(0.55, "#7b3d9a");
  grad.addColorStop(1,    "#e85d2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle starfield to echo TopDownMap's aesthetic
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  let s = 0xdeadbeef;
  for (let i = 0; i < 60; i++) {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    const rng = () => ((s = Math.imul(s, 0x119de1f3)) >>> 0) / 0x100000000;
    const x = rng() * W, y = rng() * H * 0.5;
    const r = 1 + rng() * 2.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Kicker
  ctx.fillStyle = "rgba(247,237,224,0.65)";
  ctx.font = "700 26px 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`PLURSKY · ${(CFG.shortName || "EDC LV").toUpperCase()} · ${CFG.year || ""}`, 72, 130);

  // Title
  ctx.fillStyle = "#f7ede0";
  ctx.textAlign = "left";
  ctx.font = "400 130px 'Instrument Serif', serif";
  ctx.fillText("That was", 72, 290);
  ctx.font = "italic 400 130px 'Instrument Serif', serif";
  ctx.fillStyle = "#f59a36";
  ctx.fillText("your weekend.", 72, 440);

  // 2x2 stats grid
  const cells = [
    { big: String(recap.setsCount),                small: "SETS CAUGHT" },
    { big: _fmtHrsMin(recap.totalMin),             small: "ON DANCEFLOORS" },
    { big: String(recap.stagesVisitedCount || recap.nights), small: recap.stagesVisitedCount != null ? `OF ${(window.STAGES || []).length} STAGES` : "NIGHTS" },
    { big: String(recap.headlinersCaught),         small: "HEADLINERS" },
  ];
  const gridTop = 600, cellH = 240, cellW = W / 2;
  cells.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = col * cellW + 72;
    const y = gridTop + row * cellH;
    ctx.fillStyle = "#f7ede0";
    ctx.font = "400 130px 'Instrument Serif', serif";
    ctx.fillText(c.big, x, y + 130);
    ctx.fillStyle = "rgba(247,237,224,0.65)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(c.small, x, y + 175);
  });

  // Top-stage banner
  if (recap.topStage) {
    const by = gridTop + cellH * 2 + 60;
    ctx.fillStyle = recap.topStage.color;
    ctx.fillRect(72, by, W - 144, 6);
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText("YOU LIVED AT", 72, by + 60);
    ctx.fillStyle = "#f7ede0";
    ctx.font = "italic 400 80px 'Instrument Serif', serif";
    ctx.fillText(recap.topStage.name, 72, by + 150);
  }

  // Headliner pill row
  if (recap.headlinerNames?.length) {
    const hy = H - 380;
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.fillText(`HEADLINERS CAUGHT · ${recap.headlinersCaught}`, 72, hy);
    ctx.font = "700 28px 'Geist Mono', monospace";
    ctx.fillStyle = "#f7ede0";
    let lineY = hy + 60;
    let lineW = 0;
    recap.headlinerNames.slice(0, 8).forEach((name) => {
      const text = "★ " + name.toUpperCase();
      const w = ctx.measureText(text).width + 40;
      if (lineW + w > W - 144) {
        lineY += 60;
        lineW = 0;
      }
      ctx.fillText(text, 72 + lineW, lineY);
      lineW += w + 24;
    });
  }

  // Watermark
  ctx.fillStyle = "rgba(247,237,224,0.55)";
  ctx.textAlign = "left";
  ctx.font = "700 26px 'Geist Mono', monospace";
  ctx.fillText("PLURSKY.COM", 72, H - 90);
  ctx.textAlign = "right";
  ctx.fillText("UNDER THE ELECTRIC SKY", W - 72, H - 90);

  return canvas;
}

async function _shareRecapCard(recap) {
  let canvas;
  try { canvas = await _renderRecapShareCard(recap); }
  catch (e) { console.error("[plursky-recap] render failed:", e); return false; }
  const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  window.plurskyHaptic?.("LIGHT");
  const filename = `plursky-recap-${(window.FESTIVAL_CONFIG?.id || "festival")}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  const title = `My ${window.FESTIVAL_CONFIG?.shortName || "festival"}`;

  // Native iOS path (v163): @capacitor/share with `files` (data URL) — more
  // reliable inside WKWebView than the web `navigator.share({ files })` path
  // which can fail silently in some iOS versions.
  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await capShare.share({ title, files: [dataUrl] });
      return true;
    } catch (e) {
      // Fall through to web flow if the native sheet errors or is cancelled
      if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message);
    }
  }

  // Web path — navigator.share({ files }) where supported
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch (e) {
      if (e?.name === "AbortError") return false; // user cancelled — silent
    }
  }
  // Final fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ── RECAP VIDEO ENGINE ──────────────────────────────────────────────
// Canvas-based frame sequencer → MediaRecorder WebM. Beat-synced when
// audio is provided. Three templates: highlight, diary, ditl.

const _VIDEO_TEMPLATES = {
  highlight: { transition: "zoom", holdSec: 1.2, transitionSec: 0.3, fontStyle: "bold", order: "energy" },
  diary:     { transition: "crossfade", holdSec: 3.0, transitionSec: 0.8, fontStyle: "serif", order: "chronological" },
  ditl:      { transition: "slide", holdSec: 2.0, transitionSec: 0.5, fontStyle: "mono", order: "chronological" },
};

async function _detectBeats(audioUrl) {
  let actx;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const res = await fetch(audioUrl);
    const buf = await res.arrayBuffer();
    const audio = await actx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    const windowSize = Math.floor(sr * 0.05);
    const energies = [];
    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
      energies.push({ time: i / sr, energy: sum / windowSize });
    }
    const avgEnergy = energies.reduce((s, e) => s + e.energy, 0) / energies.length;
    const threshold = avgEnergy * 1.8;
    const beats = [];
    let lastBeat = -0.3;
    for (const e of energies) {
      if (e.energy > threshold && e.time - lastBeat > 0.25) {
        beats.push(e.time);
        lastBeat = e.time;
      }
    }
    return beats;
  } catch { return []; }
  finally { try { actx?.close(); } catch {} }
}

function _buildVideoTimeline(imgs, beats, duration, tmpl) {
  const timeline = [];
  const titleEnd = 2.5;
  const statsStart = duration - 5;
  const endCardStart = duration - 2;
  timeline.push({ start: 0, end: titleEnd, type: "title" });
  const photoWindow = statsStart - titleEnd;
  if (imgs.length === 0) {
    timeline.push({ start: titleEnd, end: statsStart, type: "empty" });
  } else if (beats && beats.length >= imgs.length) {
    const beatSlots = beats.filter(b => b >= titleEnd && b <= statsStart);
    let slotIdx = 0;
    for (let i = 0; i < imgs.length && slotIdx < beatSlots.length; i++) {
      const start = beatSlots[slotIdx];
      const end = slotIdx + 1 < beatSlots.length ? beatSlots[slotIdx + 1] : statsStart;
      timeline.push({ start, end, photo: imgs[i], transition: tmpl.transition });
      slotIdx++;
    }
  } else {
    const perPhoto = photoWindow / imgs.length;
    for (let i = 0; i < imgs.length; i++) {
      timeline.push({
        start: titleEnd + i * perPhoto,
        end: titleEnd + (i + 1) * perPhoto,
        photo: imgs[i],
        transition: tmpl.transition,
      });
    }
  }
  timeline.push({ start: statsStart, end: endCardStart, type: "stats" });
  timeline.push({ start: endCardStart, end: duration, type: "end" });
  return timeline;
}

function _renderVideoFrame(ctx, W, H, t, timeline, chrome, tmpl) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const seg = timeline.find(s => t >= s.start && t < s.end) || timeline[timeline.length - 1];
  const segProgress = (t - seg.start) / (seg.end - seg.start);

  ctx.fillStyle = "#1a120d";
  ctx.fillRect(0, 0, W, H);

  if (seg.type === "title") {
    const fade = Math.min(1, segProgress * 2);
    ctx.globalAlpha = fade;
    ctx.fillStyle = chrome.accent || "#6D28D9";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 72px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText(chrome.title || "My Weekend", W / 2, H / 2 - 40);
    ctx.font = "700 18px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(chrome.subtitle || (CFG.shortName || "FESTIVAL").toUpperCase(), W / 2, H / 2 + 20);
    ctx.font = "700 14px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("MADE WITH PLURSKY", W / 2, H - 60);
    ctx.globalAlpha = 1;
    return;
  }

  if (seg.type === "stats") {
    const recap = chrome.recap || {};
    ctx.fillStyle = "#f7ede0";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a120d";
    ctx.font = "italic 400 56px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText("The Numbers", W / 2, 200);
    ctx.font = "700 16px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(26,18,13,0.6)";
    const stats = [
      recap.setsCount ? `${recap.setsCount} SETS CAUGHT` : null,
      recap.stagesVisitedCount ? `${recap.stagesVisitedCount} STAGES VISITED` : null,
      recap.momentsCount ? `${recap.momentsCount} MEMORIES CAPTURED` : null,
      recap.topStage ? `TOP STAGE: ${recap.topStage.name?.toUpperCase()}` : null,
      recap.topGenre ? `TOP GENRE: ${recap.topGenre.toUpperCase()}` : null,
    ].filter(Boolean);
    stats.forEach((s, i) => {
      const staggerFade = Math.min(1, Math.max(0, (segProgress - i * 0.12) * 4));
      ctx.globalAlpha = staggerFade;
      ctx.fillText(s, W / 2, 300 + i * 50);
    });
    ctx.globalAlpha = 1;
    return;
  }

  if (seg.type === "end") {
    ctx.fillStyle = chrome.accent || "#6D28D9";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 48px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText("plursky.com", W / 2, H / 2 - 10);
    ctx.font = "700 14px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("YOUR FESTIVAL. YOUR STORY.", W / 2, H / 2 + 40);
    return;
  }

  if (seg.type === "empty" || !seg.photo) return;
  const { img, moment } = seg.photo;
  const artist = moment?.artistId ? (window.ARTISTS || []).find(a => a.id === moment.artistId) : null;
  const stage = artist ? (window.STAGES || []).find(s => s.id === artist.stage) : null;

  const transitionDur = tmpl.transitionSec || 0.3;
  const fadeIn = Math.min(1, segProgress * (seg.end - seg.start) / transitionDur);
  const fadeOut = Math.min(1, (1 - segProgress) * (seg.end - seg.start) / transitionDur);
  const alpha = Math.min(fadeIn, fadeOut);

  // W2: 3D parallax — foreground layer moves faster than background
  const kenBurnsZoom = 1 + 0.08 * segProgress;
  const parallaxFg = (segProgress - 0.5) * 30;
  const parallaxBg = (segProgress - 0.5) * 12;
  const panY = (segProgress - 0.5) * 8;

  ctx.save();
  ctx.globalAlpha = Math.max(0.01, alpha);
  const sc = Math.max(W / img.width, H / img.height) * kenBurnsZoom;
  const dw = img.width * sc, dh = img.height * sc;
  ctx.drawImage(img, (W - dw) / 2 + parallaxBg, (H - dh) / 2 + panY, dw, dh);

  if (_isPlusSub()) {
    ctx.globalAlpha = Math.max(0.01, alpha) * 0.15;
    const fgZoom = kenBurnsZoom * 1.03;
    const fgSc = Math.max(W / img.width, H / img.height) * fgZoom;
    const fgDw = img.width * fgSc, fgDh = img.height * fgSc;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(img, (W - fgDw) / 2 + parallaxFg, (H - fgDh) / 2 + panY * 1.5, fgDw, fgDh);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, H - 200, W, 200);

  if (artist) {
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 42px 'Instrument Serif', serif";
    ctx.textAlign = "left";
    ctx.fillText(artist.name, 60, H - 120);
    if (stage) {
      ctx.fillStyle = stage.color || "rgba(255,255,255,0.7)";
      ctx.font = "700 14px 'Geist Mono', monospace";
      ctx.fillText(`${stage.name?.toUpperCase()} · ${artist.start || ""}`, 60, H - 80);
    }
  }

  // W4: Spotify listening overlay
  if (_isPlusSub() && artist) {
    const cache = window._spotifyArtistCache || {};
    const entry = cache[artist.name?.toLowerCase()];
    const playCount = entry?.playCount || entry?.topTrackPop;
    if (playCount) {
      const fadeOverlay = Math.min(1, Math.max(0, (segProgress - 0.2) * 3));
      ctx.globalAlpha = fadeOverlay * 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const pillW = 320, pillH = 36, pillX = 60, pillY = 60;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = "#1DB954";
      ctx.font = "700 11px 'Geist Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`♫ YOU'VE PLAYED THIS ARTIST ${playCount}× ON SPOTIFY`, pillX + 16, pillY + 23);
      ctx.globalAlpha = 1;
    }
  }

  if (!_isPlusSub()) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "700 48px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0);
    ctx.restore();
  }

  const progressY = 30, progressR = 18;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W - 50, progressY + progressR, progressR, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.arc(W - 50, progressY + progressR, progressR, -Math.PI / 2, -Math.PI / 2 + (t / (timeline[timeline.length - 1]?.end || 15)) * Math.PI * 2); ctx.stroke();
}

async function _renderRecapVideo({ moments, audioUrl, template, title, subtitle, kicker, accent, avatars, totemUrl, recap, onProgress }) {
  const W = 1080, H = 1350, FPS = 30;
  const CFG = window.FESTIVAL_CONFIG || {};

  try {
    await document.fonts.load("italic 400 72px 'Instrument Serif'");
    await document.fonts.load("700 18px 'Geist Mono'");
  } catch {}

  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 12);
  const imgs = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (img) imgs.push({ img, moment: m });
    } catch {}
  }
  if (!imgs.length) return null;

  let beats = audioUrl ? await _detectBeats(audioUrl) : [];
  const DURATION = audioUrl ? 30 : 15;
  const tmpl = _VIDEO_TEMPLATES[template || "highlight"] || _VIDEO_TEMPLATES.highlight;
  const timeline = _buildVideoTimeline(imgs, beats, DURATION, tmpl);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  if (typeof canvas.captureStream !== "function") return null;

  const stream = canvas.captureStream(FPS);
  let audioEl = null;
  if (audioUrl) {
    try {
      audioEl = new Audio();
      audioEl.crossOrigin = "anonymous";
      audioEl.src = audioUrl;
      await new Promise((r, j) => { audioEl.oncanplaythrough = r; audioEl.onerror = () => { audioEl = null; r(); }; });
      if (audioEl) {
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const src = actx.createMediaElementSource(audioEl);
        const dest = actx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(actx.destination);
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      }
    } catch { audioEl = null; }
  }

  const chrome = { title: title || "My Weekend", subtitle: subtitle || `${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`, accent: accent || "#1a120d", recap: recap || {} };
  const chunks = [];
  const mimeType = MediaRecorder.isTypeSupported?.("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const cleanup = () => {
    try { stream.getTracks().forEach(t => t.stop()); } catch {}
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; }
    canvas.width = 0; canvas.height = 0;
  };

  return new Promise((resolve) => {
    const TIMEOUT = (DURATION + 10) * 1000;
    const timer = setTimeout(() => {
      try { recorder.stop(); } catch {}
      cleanup();
      resolve(null);
    }, TIMEOUT);

    recorder.onstop = () => {
      clearTimeout(timer);
      cleanup();
      resolve(chunks.length ? new Blob(chunks, { type: mimeType }) : null);
    };
    recorder.onerror = () => {
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    recorder.start(100);
    if (audioEl) audioEl.play().catch(() => {});

    const t0 = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed >= DURATION) {
        try { recorder.stop(); } catch {}
        return;
      }
      _renderVideoFrame(ctx, W, H, elapsed, timeline, chrome, tmpl);
      if (onProgress) onProgress(elapsed / DURATION);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function _videoProgress(show, pct) {
  let el = document.getElementById("plursky-video-progress");
  if (show && !el) {
    el = document.createElement("div");
    el.id = "plursky-video-progress";
    el.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,6,24,0.92);backdrop-filter:blur(8px);";
    el.innerHTML = `
      <svg width="120" height="120" viewBox="0 0 120 120" style="margin-bottom:20px">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
        <circle id="vp-ring" cx="60" cy="60" r="52" fill="none" stroke="url(#vp-grad)" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7"
          transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .3s"/>
        <defs><linearGradient id="vp-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#6D28D9"/><stop offset="100%" stop-color="#e85d2e"/>
        </linearGradient></defs>
        <text id="vp-pct" x="60" y="66" text-anchor="middle" fill="#fff"
          font-family="'Geist Mono',monospace" font-size="24" font-weight="700">0%</text>
      </svg>
      <div style="font-family:'Geist Mono',monospace;font-size:12px;letter-spacing:1.6px;font-weight:700;color:#fff;margin-bottom:6px">
        RENDERING YOUR RECAP
      </div>
      <div style="font-family:'Geist',sans-serif;font-size:12px;color:rgba(255,255,255,0.4)">
        Keep Plursky open while we create your video
      </div>
    `;
    document.body.appendChild(el);
  }
  if (el) {
    if (!show) { el.remove(); return; }
    const p = Math.round((pct || 0) * 100);
    const ring = el.querySelector("#vp-ring");
    const txt = el.querySelector("#vp-pct");
    if (ring) ring.setAttribute("stroke-dashoffset", String(326.7 * (1 - (pct || 0))));
    if (txt) txt.textContent = p + "%";
  }
}

async function _shareRecapVideo({ moments, audioUrl, template, title, subtitle, accent, recap, format }) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  _videoProgress(true, 0);
  let blob;
  try {
    blob = await _renderRecapVideo({
      moments, audioUrl, template, title, subtitle, accent, recap,
      onProgress: (p) => _videoProgress(true, p),
    });
  } catch (e) { console.error("[plursky-video]", e); }
  _videoProgress(false);
  if (!blob) return false;

  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  const filename = "plursky-recap.webm";
  const file = new File([blob], filename, { type: blob.type });
  const sheetTitle = `My ${window.FESTIVAL_CONFIG?.shortName || "festival"} recap`;

  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob);
      });
      await capShare.share({ title: sheetTitle, files: [dataUrl] });
      return true;
    } catch (e) { if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message); }
  }
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: sheetTitle }); return true; }
    catch (e) { if (e?.name === "AbortError") return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// GIF support — lazy-loaded on first use so gif.js is never fetched
// unless someone taps a GIF button.
let _gifWorkerBlobUrl = null;
async function _ensureGifJs() {
  if (window.GIF) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load gif.js"));
    document.head.appendChild(s);
  });
  if (!_gifWorkerBlobUrl) {
    const res = await fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
    const text = await res.text();
    _gifWorkerBlobUrl = URL.createObjectURL(new Blob([text], { type: "application/javascript" }));
  }
}

function _gifProgress(show) {
  let el = document.getElementById("plursky-gif-progress");
  if (show && !el) {
    el = document.createElement("div");
    el.id = "plursky-gif-progress";
    el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 20px;text-align:center;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:1.4px;font-weight:700;color:#fff;background:linear-gradient(135deg,#6D28D9,#e85d2e);";
    el.textContent = "⏳ CREATING GIF…";
    document.body.appendChild(el);
  } else if (!show && el) {
    el.remove();
  }
}

async function _renderCollageGif({ title, subtitle, kicker, accent, moments, avatars, totemUrl }) {
  await _ensureGifJs();
  const W = 540, H = 675;
  const CFG = window.FESTIVAL_CONFIG || {};

  try {
    await document.fonts.load("italic 400 42px 'Instrument Serif'");
    await document.fonts.load("700 11px 'Geist Mono'");
  } catch {}

  let totemImg = null;
  if (totemUrl) {
    try { totemImg = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = totemUrl; }); } catch {}
  }

  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 6);
  const imgs = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (img) imgs.push(img);
    } catch {}
  }
  if (!imgs.length) return null;

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const hH = 115, fH = 55, mT = hH, mH = H - hH - fH;

  const drawChrome = () => {
    ctx.fillStyle = accent || "#1a120d";
    ctx.fillRect(0, 0, W, hH);
    const tL = totemImg ? 100 : 30;
    if (totemImg) {
      const tR = 30, tCx = 60, tCy = hH / 2;
      ctx.save();
      ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.clip();
      const ts = Math.max(tR * 2 / totemImg.width, tR * 2 / totemImg.height);
      ctx.drawImage(totemImg, tCx - totemImg.width * ts / 2, tCy - totemImg.height * ts / 2, totemImg.width * ts, totemImg.height * ts);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 11px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(kicker || `PLURSKY · ${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()}`, tL, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "italic 400 42px 'Instrument Serif', serif";
    let safe = title || "Memories";
    while (ctx.measureText(safe).width > W - tL - 30 && safe.length > 4) safe = safe.slice(0, -2);
    if (safe !== (title || "Memories")) safe = safe.slice(0, -1) + "…";
    ctx.fillText(safe, tL, 85);
    if (subtitle) {
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "700 9px 'Geist Mono', monospace";
      ctx.fillText(subtitle, tL, 105);
    }
    ctx.fillStyle = "#1a120d";
    ctx.fillRect(0, H - fH, W, fH);
    let ftx = 30;
    if (avatars && avatars.length > 0) {
      const avR = 8, avStep = 11, cy = H - fH / 2;
      const avN = Math.min(avatars.length, 8);
      for (let ai = avN - 1; ai >= 0; ai--) {
        const cx = 30 + avR + ai * avStep;
        ctx.fillStyle = "#1a120d";
        ctx.beginPath(); ctx.arc(cx, cy, avR + 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = avatars[ai].color || "#7b3d9a";
        ctx.beginPath(); ctx.arc(cx, cy, avR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "700 7px 'Geist Mono', monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText((avatars[ai].initial || "?")[0], cx, cy + 1);
      }
      ftx = 30 + avR * 2 + (avN - 1) * avStep + 8;
      ctx.textBaseline = "alphabetic";
    }
    ctx.fillStyle = "#f7ede0";
    ctx.textAlign = "left";
    ctx.font = "700 11px 'Geist Mono', monospace";
    ctx.fillText("MADE WITH PLURSKY", ftx, H - 27);
    ctx.fillStyle = "rgba(247,237,224,0.7)";
    ctx.font = "italic 400 12px 'Instrument Serif', serif";
    ctx.textAlign = "right";
    ctx.fillText("plursky.com", W - 30, H - 27);
  };

  const drawPhoto = (img, zoom, panX, panY, alpha) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, mT, W, mH); ctx.clip();
    if (alpha < 1) ctx.globalAlpha = alpha;
    const sc = Math.max(W / img.width, mH / img.height) * zoom;
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, (W - dw) / 2 + panX, mT + (mH - dh) / 2 + panY, dw, dh);
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const gif = new GIF({ workers: 2, quality: 10, width: W, height: H, workerScript: _gifWorkerBlobUrl });

  for (let i = 0; i < imgs.length; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    for (let f = 0; f < 2; f++) {
      ctx.fillStyle = "#f7ede0"; ctx.fillRect(0, 0, W, H);
      drawChrome();
      drawPhoto(imgs[i], 1 + 0.06 * f, dir * f * 8, -f * 4, 1);
      if (!_isPlusSub()) { ctx.save(); ctx.translate(W/2, mT + mH/2); ctx.rotate(-Math.PI/6); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "700 32px 'Geist Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("PLURSKY+", 0, 0); ctx.restore(); }
      gif.addFrame(ctx, { copy: true, delay: 500 });
    }
    if (imgs.length > 1) {
      const next = imgs[(i + 1) % imgs.length];
      ctx.fillStyle = "#f7ede0"; ctx.fillRect(0, 0, W, H);
      drawChrome();
      drawPhoto(imgs[i], 1.06, dir * 8, -4, 0.35);
      drawPhoto(next, 1, 0, 0, 0.65);
      if (!_isPlusSub()) { ctx.save(); ctx.translate(W/2, mT + mH/2); ctx.rotate(-Math.PI/6); ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.font = "700 32px 'Geist Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("PLURSKY+", 0, 0); ctx.restore(); }
      gif.addFrame(ctx, { copy: true, delay: 250 });
    }
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => { try { gif.abort(); } catch {} resolve(null); }, 30000);
    gif.on("finished", (blob) => { clearTimeout(timer); resolve(blob); });
    gif.on("error", () => { clearTimeout(timer); resolve(null); });
    try { gif.render(); } catch { clearTimeout(timer); resolve(null); }
  });
}

// Generic shareable collage. Same renderer underlies the per-artist,
// per-stage, per-night, and weekend collages — only title/subtitle/
// kicker/accent/moments change. 1080×1350 = Instagram 4:5, also reads
// as a Story since the safe area is centered.
async function _renderCollage({ title, subtitle, kicker, accent, moments, avatars, totemUrl }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const CFG = window.FESTIVAL_CONFIG || {};

  try {
    await document.fonts.load("400 96px 'Instrument Serif'");
    await document.fonts.load("italic 400 80px 'Instrument Serif'");
    await document.fonts.load("700 20px 'Geist Mono'");
  } catch {}

  let totemImg = null;
  if (totemUrl) {
    try {
      totemImg = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = totemUrl; });
    } catch {}
  }

  ctx.fillStyle = "#f7ede0";
  ctx.fillRect(0, 0, W, H);

  // Accent-colored header band
  const headerH = 230;
  ctx.fillStyle = accent || "#1a120d";
  ctx.fillRect(0, 0, W, headerH);

  const textLeft = totemImg ? 200 : 60;

  if (totemImg) {
    const tR = 60, tCx = 120, tCy = headerH / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.clip();
    const ts = Math.max(tR * 2 / totemImg.width, tR * 2 / totemImg.height);
    ctx.drawImage(totemImg, tCx - totemImg.width * ts / 2, tCy - totemImg.height * ts / 2, totemImg.width * ts, totemImg.height * ts);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tCx, tCy, tR, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 22px 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(kicker || `PLURSKY · ${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()}`, textLeft, 80);
  ctx.fillStyle = "#fff";
  ctx.font = "italic 400 84px 'Instrument Serif', serif";
  let safeTitle = title || "Memories";
  const maxTitleW = W - textLeft - 60;
  while (ctx.measureText(safeTitle).width > maxTitleW && safeTitle.length > 4) {
    safeTitle = safeTitle.slice(0, -2);
  }
  if (safeTitle !== (title || "Memories")) safeTitle = safeTitle.slice(0, -1) + "…";
  ctx.fillText(safeTitle, textLeft, 170);
  if (subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "700 18px 'Geist Mono', monospace";
    ctx.fillText(subtitle, textLeft, 210);
  }

  // Photo mosaic area (between header + footer)
  const footerH = 110;
  const mosaicTop = headerH;
  const mosaicH = H - headerH - footerH;
  const mosaicW = W;
  const gap = 8;

  // Pull image blobs from IDB (filter out videos for v1 — video frames
  // require seeking + decode, deferred to v1.5 video recap).
  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 6);
  const imgs = await Promise.all(photoMoments.map(async (m) => {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) return null;
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(blob);
      });
    } catch { return null; }
  }));
  const valid = imgs.filter(Boolean);
  const n = valid.length;

  // Layout grid by count — each entry is [x, y, w, h] inside the mosaic
  let cells;
  if (n === 0)       cells = [];
  else if (n === 1)  cells = [[0, 0, mosaicW, mosaicH]];
  else if (n === 2)  cells = [[0, 0, mosaicW/2, mosaicH], [mosaicW/2, 0, mosaicW/2, mosaicH]];
  else if (n === 3)  cells = [[0, 0, mosaicW*0.6, mosaicH], [mosaicW*0.6, 0, mosaicW*0.4, mosaicH/2], [mosaicW*0.6, mosaicH/2, mosaicW*0.4, mosaicH/2]];
  else if (n === 4)  cells = [[0, 0, mosaicW/2, mosaicH/2], [mosaicW/2, 0, mosaicW/2, mosaicH/2], [0, mosaicH/2, mosaicW/2, mosaicH/2], [mosaicW/2, mosaicH/2, mosaicW/2, mosaicH/2]];
  else { // 5 or 6 — 3 across, 2 rows
    const cw = mosaicW / 3, ch = mosaicH / 2;
    cells = [
      [0, 0, cw, ch], [cw, 0, cw, ch], [cw*2, 0, cw, ch],
      [0, ch, cw, ch], [cw, ch, cw, ch], [cw*2, ch, cw, ch],
    ].slice(0, n);
  }

  // Draw each photo cover-fit into its cell
  valid.forEach((img, i) => {
    const [x, y, w, h] = cells[i];
    const ix = x + gap/2, iy = mosaicTop + y + gap/2;
    const iw = w - gap, ih = h - gap;
    const scale = Math.max(iw / img.width, ih / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = ix - (dw - iw) / 2;
    const dy = iy - (dh - ih) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  });

  // Empty state — collage requested but no photos in IDB
  if (n === 0) {
    ctx.fillStyle = "rgba(26,18,13,0.45)";
    ctx.font = "italic 400 52px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText("No photos yet from this set", W/2, mosaicTop + mosaicH/2);
  }

  // Watermark for free tier
  if (n > 0 && !_isPlusSub()) {
    ctx.save();
    ctx.translate(W / 2, mosaicTop + mosaicH / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font = "700 64px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0);
    ctx.restore();
  }

  // Footer band — branding + count + optional crew avatars
  ctx.fillStyle = "#1a120d";
  ctx.fillRect(0, H - footerH, W, footerH);
  let footerTextX = 60;
  if (avatars && avatars.length > 0) {
    const avR = 15, avStep = 22, centerY = H - footerH / 2;
    const avCount = Math.min(avatars.length, 8);
    for (let ai = avCount - 1; ai >= 0; ai--) {
      const cx = 60 + avR + ai * avStep;
      ctx.fillStyle = "#1a120d";
      ctx.beginPath(); ctx.arc(cx, centerY, avR + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = avatars[ai].color || "#7b3d9a";
      ctx.beginPath(); ctx.arc(cx, centerY, avR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 13px 'Geist Mono', monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((avatars[ai].initial || "?")[0], cx, centerY + 1);
    }
    footerTextX = 60 + avR * 2 + (avCount - 1) * avStep + 16;
    ctx.textBaseline = "alphabetic";
  }
  ctx.fillStyle = "#f7ede0";
  ctx.textAlign = "left";
  ctx.font = "700 22px 'Geist Mono', monospace";
  ctx.fillText(`MADE WITH PLURSKY · ${n} MOMENT${n === 1 ? "" : "S"}`, footerTextX, H - 55);
  ctx.fillStyle = "rgba(247,237,224,0.7)";
  ctx.font = "italic 400 24px 'Instrument Serif', serif";
  ctx.textAlign = "right";
  ctx.fillText("plursky.com", W - 60, H - 55);

  return canvas;
}

// Generic share helper. Renders + shares + downloads-on-fallback. The
// per-{artist,stage,night,weekend} wrappers below just feed this their
// specific title/subtitle/accent.
async function _shareCollage({ title, subtitle, kicker, accent, moments, avatars, totemUrl, filenameSlug, shareTitle, format }) {
  const gate = _canShare();
  if (!gate.allowed) { _showShareLimitToast(); return false; }
  const customAccent = _getCustomAccent();
  if (customAccent) accent = customAccent;
  let blob;
  if (format === "gif") {
    _gifProgress(true);
    try {
      blob = await _renderCollageGif({ title, subtitle, kicker, accent, moments, avatars, totemUrl });
    } catch (e) { console.error("[plursky-collage] gif render failed:", e); }
    _gifProgress(false);
    if (!blob) return false;
  } else {
    let canvas;
    try {
      canvas = await _renderCollage({ title, subtitle, kicker, accent, moments, avatars, totemUrl });
    } catch (e) { console.error("[plursky-collage] render failed:", e); return false; }
    blob = await new Promise(r => canvas.toBlob(r, "image/png"));
    if (!blob) return false;
  }
  try { window.plurskyHaptic?.("LIGHT"); } catch {}
  _incShareCount();
  const isGif = format === "gif";
  const slug = (filenameSlug || title || "set").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
  const filename = `plursky-${slug}.${isGif ? "gif" : "png"}`;
  const file = new File([blob], filename, { type: isGif ? "image/gif" : "image/png" });
  const sheetTitle = shareTitle || `${title} at ${window.FESTIVAL_CONFIG?.shortName || "the festival"}`;

  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await capShare.share({ title: sheetTitle, files: [dataUrl] });
      return true;
    } catch (e) {
      if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message);
    }
  }
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: sheetTitle });
      return true;
    } catch (e) {
      if (e?.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Per-{artist, stage, night, weekend} share entry points. Each computes
// the right title/subtitle/accent + filters moments before delegating to
// _shareCollage. All exposed via window so any screen can call them.

async function _shareArtistCollage(artist, moments, format) {
  const stage = (window.STAGES || []).find(s => s.id === artist.stage) || {};
  const CFG = window.FESTIVAL_CONFIG || {};
  const dayShort = CFG.dayDates?.[artist.day]?.short || `DAY ${artist.day}`;
  return _shareCollage({
    title:    artist.name,
    subtitle: `${(stage.name || "").toUpperCase()} · ${dayShort.toUpperCase()} · ${artist.start}–${artist.end}`,
    accent:   stage.color || "#1a120d",
    moments,
    filenameSlug: artist.name,
    shareTitle:   `${artist.name} at ${CFG.shortName || "the festival"}`,
    format,
  });
}

async function _shareStageCollage(stage, momentsAcrossArtists, format) {
  const CFG = window.FESTIVAL_CONFIG || {};
  return _shareCollage({
    title:    stage.name,
    subtitle: `MY NIGHTS AT ${stage.short || stage.name?.toUpperCase()}`,
    accent:   stage.color || "#1a120d",
    moments:  momentsAcrossArtists,
    filenameSlug: `stage-${stage.short || stage.id}`,
    shareTitle:   `My ${stage.name} at ${CFG.shortName || "the festival"}`,
    format,
  });
}

async function _shareNightCollage(night, momentsForNight, format) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const di = CFG.dayDates?.[night] || {};
  return _shareCollage({
    title:    di.name || `Night ${night}`,
    subtitle: `${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()} · ${(di.short || `DAY ${night}`).toUpperCase()}`,
    accent:   "#e85d2e",
    moments:  momentsForNight,
    filenameSlug: `night-${night}`,
    shareTitle:   `My ${di.name || "festival night"} at ${CFG.shortName || "the festival"}`,
    format,
  });
}

async function _shareWeekendCollage(allMoments, format) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const tagged   = allMoments.filter(m => m.artistId);
  const untagged = allMoments.filter(m => !m.artistId);
  const pool = tagged.length >= 6 ? tagged : [...tagged, ...untagged];
  const byNight = new Map();
  for (const m of pool) {
    if (!byNight.has(m.night)) byNight.set(m.night, []);
    byNight.get(m.night).push(m);
  }
  const picked = [];
  const nights = [...byNight.keys()].sort((a, b) => a - b);
  while (picked.length < 6 && nights.some(n => byNight.get(n).length > 0)) {
    for (const n of nights) {
      const arr = byNight.get(n);
      if (arr.length > 0) picked.push(arr.shift());
      if (picked.length >= 6) break;
    }
  }
  return _shareCollage({
    title:    "My Weekend",
    subtitle: `${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`,
    accent:   "#1a120d",
    moments:  picked,
    filenameSlug: `weekend-${CFG.id || "festival"}`,
    shareTitle:   `My ${CFG.shortName || "festival weekend"}`,
    format,
  });
}

async function _shareCrewCollage({ crewNames, avatars, crewArtistIds, overlapIds, format, totemUrl }) {
  const CFG = window.FESTIVAL_CONFIG || {};
  const all = [];
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    for (const k of Object.keys(raw)) for (const m of (raw[k] || [])) all.push(m);
  } catch {}

  const overlapSet = new Set(overlapIds || []);
  const crewSet = new Set(crewArtistIds || []);
  const overlapMoments = all.filter(m => m.artistId && overlapSet.has(m.artistId));
  const crewMoments = all.filter(m => m.artistId && crewSet.has(m.artistId));
  const pool = overlapMoments.length >= 6 ? overlapMoments : crewMoments.length > 0 ? crewMoments : all;

  const tagged = pool.filter(m => m.artistId);
  const untagged = pool.filter(m => !m.artistId);
  const source = tagged.length >= 6 ? tagged : [...tagged, ...untagged];
  const byNight = new Map();
  for (const m of source) {
    if (!byNight.has(m.night)) byNight.set(m.night, []);
    byNight.get(m.night).push(m);
  }
  const picked = [];
  const nights = [...byNight.keys()].sort((a, b) => a - b);
  while (picked.length < 6 && nights.some(n => byNight.get(n).length > 0)) {
    for (const n of nights) {
      const arr = byNight.get(n);
      if (arr.length > 0) picked.push(arr.shift());
      if (picked.length >= 6) break;
    }
  }

  let subtitle = (crewNames || []).map(n => n.toUpperCase()).join(" · ");
  if (subtitle.length > 55) subtitle = `${crewNames.length} CREW · ${(overlapIds || []).length} SETS IN COMMON`;

  return _shareCollage({
    title: "Our Weekend",
    subtitle,
    kicker: `PLURSKY · ${(CFG.shortName || CFG.name || "FESTIVAL").toUpperCase()} · CREW`,
    accent: "#6D28D9",
    moments: picked,
    avatars,
    totemUrl,
    filenameSlug: `crew-${CFG.id || "festival"}`,
    shareTitle: `Our crew's weekend at ${CFG.shortName || "the festival"}`,
    format,
  });
}

// ── WOW FEATURES (Plursky+ exclusive) ──────────────────────────────

// W1: Festival DNA — unique color barcode from your weekend's photos
async function _renderFestivalDNA(moments) {
  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 20);
  const colors = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (!img) continue;
      const tc = document.createElement("canvas");
      tc.width = 32; tc.height = 32;
      const tctx = tc.getContext("2d");
      tctx.drawImage(img, 0, 0, 32, 32);
      const d = tctx.getImageData(0, 0, 32, 32).data;
      let rSum = 0, gSum = 0, bSum = 0;
      for (let i = 0; i < d.length; i += 4) { rSum += d[i]; gSum += d[i+1]; bSum += d[i+2]; }
      const px = d.length / 4;
      colors.push(`rgb(${Math.round(rSum/px)},${Math.round(gSum/px)},${Math.round(bSum/px)})`);
    } catch {}
  }
  if (!colors.length) return null;

  const W = 1080, H = 1350;
  const CFG = window.FESTIVAL_CONFIG || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 72px 'Instrument Serif'"); await document.fonts.load("700 16px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, H);

  const stripY = 320, stripH = 600;
  const barW = W / colors.length;
  colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * barW, stripY, barW + 1, stripH); });

  ctx.fillStyle = "rgba(26,18,13,0.3)";
  ctx.fillRect(0, stripY, W, 2);
  ctx.fillRect(0, stripY + stripH - 2, W, 2);

  ctx.fillStyle = "#f7ede0";
  ctx.font = "italic 400 72px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.fillText("Festival DNA", W/2, 160);
  ctx.font = "700 16px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(247,237,224,0.5)";
  ctx.fillText(`${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${colors.length} MOMENTS · YOUR UNIQUE PALETTE`, W/2, 210);

  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, stripY + stripH/2); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = "rgba(247,237,224,0.2)"; ctx.font = "700 64px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }
  ctx.fillStyle = "rgba(247,237,224,0.3)";
  ctx.font = "700 12px 'Geist Mono', monospace";
  ctx.fillText("MADE WITH PLURSKY+", W/2, H - 80);
  ctx.fillStyle = "rgba(247,237,224,0.5)";
  ctx.font = "italic 400 20px 'Instrument Serif', serif";
  ctx.fillText("plursky.com", W/2, H - 50);

  return c;
}

async function _shareFestivalDNA(moments) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderFestivalDNA(moments);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-festival-dna.png", { type: "image/png" });
  const sheetTitle = `My Festival DNA — ${window.FESTIVAL_CONFIG?.shortName || "festival"}`;
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: sheetTitle }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-festival-dna.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// W3: Festival Passport — stamped stage card
async function _renderFestivalPassport(state) {
  const W = 1080, H = 1350;
  const CFG = window.FESTIVAL_CONFIG || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 56px 'Instrument Serif'"); await document.fonts.load("700 14px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#f7ede0"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(26,18,13,0.15)"; ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeRect(50, 50, W - 100, H - 100);

  ctx.fillStyle = "#1a120d";
  ctx.font = "italic 400 56px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.fillText("Festival Passport", W/2, 140);
  ctx.font = "700 14px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(26,18,13,0.4)";
  ctx.fillText(`${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || "2026"}`, W/2, 180);

  const attended = [];
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_attended_v1") || "{}");
    for (const [id, v] of Object.entries(raw)) { if (v) attended.push(id); }
  } catch {}

  const stages = window.STAGES || [];
  const artists = window.ARTISTS || [];
  const stageStats = new Map();
  for (const aid of attended) {
    const a = artists.find(x => x.id === aid);
    if (!a) continue;
    const s = stages.find(x => x.id === a.stage);
    if (!s) continue;
    if (!stageStats.has(s.id)) stageStats.set(s.id, { stage: s, count: 0 });
    stageStats.get(s.id).count++;
  }

  const sorted = [...stageStats.values()].sort((a, b) => b.count - a.count);
  const setsTotal = attended.length;
  const badge = setsTotal >= 20 ? "FESTIVAL VETERAN" : setsTotal >= 10 ? "WEEKEND WARRIOR" : setsTotal >= 5 ? "EXPLORER" : "FIRST TIMER";

  ctx.save();
  ctx.translate(W/2, 260);
  ctx.strokeStyle = setsTotal >= 20 ? "#e85d2e" : setsTotal >= 10 ? "#6D28D9" : "#2d7a55";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.font = "700 10px 'Geist Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(badge, 0, 0);
  ctx.restore();

  ctx.font = "700 11px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(26,18,13,0.35)";
  ctx.textAlign = "center";
  ctx.fillText(`${setsTotal} SETS CAUGHT · ${stageStats.size} STAGES VISITED`, W/2, 330);

  const stampStartY = 380;
  const cols = 3, stampW = 280, stampH = 200, gapX = 40, gapY = 30;
  const startX = (W - cols * stampW - (cols - 1) * gapX) / 2;

  sorted.slice(0, 9).forEach((entry, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (stampW + gapX);
    const y = stampStartY + row * (stampH + gapY);
    const s = entry.stage;

    ctx.save();
    ctx.translate(x + stampW/2, y + stampH/2);
    ctx.rotate((Math.random() - 0.5) * 0.15);

    ctx.strokeStyle = s.color || "#e85d2e";
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(-stampW/2 + r, -stampH/2);
    ctx.lineTo(stampW/2 - r, -stampH/2);
    ctx.quadraticCurveTo(stampW/2, -stampH/2, stampW/2, -stampH/2 + r);
    ctx.lineTo(stampW/2, stampH/2 - r);
    ctx.quadraticCurveTo(stampW/2, stampH/2, stampW/2 - r, stampH/2);
    ctx.lineTo(-stampW/2 + r, stampH/2);
    ctx.quadraticCurveTo(-stampW/2, stampH/2, -stampW/2, stampH/2 - r);
    ctx.lineTo(-stampW/2, -stampH/2 + r);
    ctx.quadraticCurveTo(-stampW/2, -stampH/2, -stampW/2 + r, -stampH/2);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = s.color || "#1a120d";
    ctx.font = "italic 400 28px 'Instrument Serif', serif";
    ctx.textAlign = "center";
    ctx.fillText(s.name || s.id, 0, -15);
    ctx.font = "700 32px 'Geist Mono', monospace";
    ctx.fillText(`${entry.count}`, 0, 30);
    ctx.font = "700 10px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(26,18,13,0.4)";
    ctx.fillText("SETS CAUGHT", 0, 55);

    ctx.font = "700 9px 'Geist Mono', monospace";
    ctx.fillStyle = s.color || "#e85d2e";
    ctx.fillText("✓ STAMPED", 0, 80);

    ctx.restore();
  });

  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, H/2); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = "rgba(26,18,13,0.12)"; ctx.font = "700 72px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }
  ctx.fillStyle = "rgba(26,18,13,0.25)";
  ctx.font = "700 12px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("MADE WITH PLURSKY+", W/2, H - 80);
  ctx.fillStyle = "rgba(26,18,13,0.4)";
  ctx.font = "italic 400 18px 'Instrument Serif', serif";
  ctx.fillText("plursky.com", W/2, H - 55);

  return c;
}

async function _shareFestivalPassport(state) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderFestivalPassport(state);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-festival-passport.png", { type: "image/png" });
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "My Festival Passport" }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-festival-passport.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// W5: Photo Film Strip — retro Kodak negative export
async function _renderFilmStrip(moments) {
  const photoMoments = moments.filter(m => m.photoId && (m.kind === "image" || !m.kind)).slice(0, 6);
  const imgs = [];
  for (const m of photoMoments) {
    try {
      const blob = await _getPhoto(m.photoId);
      if (!blob) continue;
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(blob); });
      if (img) imgs.push({ img, moment: m });
    } catch {}
  }
  if (!imgs.length) return null;

  const CFG = window.FESTIVAL_CONFIG || {};
  const frameW = 300, frameH = 420, sprocketR = 10, sprocketGap = 40;
  const filmPad = 50, borderW = 35;
  const W = imgs.length * frameW + (imgs.length - 1) * 20 + filmPad * 2 + borderW * 2;
  const H = frameH + borderW * 2 + filmPad * 2 + 120;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 36px 'Instrument Serif'"); await document.fonts.load("700 11px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, H);

  const stripY = 60;
  const stripH = frameH + borderW * 2;
  ctx.fillStyle = "#2a1f15"; ctx.fillRect(0, stripY, W, stripH);

  for (let x = filmPad; x < W - filmPad; x += sprocketGap) {
    ctx.fillStyle = "#1a120d";
    ctx.beginPath(); ctx.roundRect(x, stripY + 6, 18, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, stripY + stripH - 18, 18, 12, 3); ctx.fill();
  }

  imgs.forEach(({ img, moment }, i) => {
    const x = filmPad + borderW + i * (frameW + 20);
    const y = stripY + borderW;

    ctx.fillStyle = "#0a0806"; ctx.fillRect(x - 4, y - 4, frameW + 8, frameH + 8);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, frameW, frameH); ctx.clip();
    const sc = Math.max(frameW / img.width, frameH / img.height);
    const dw = img.width * sc, dh = img.height * sc;
    ctx.drawImage(img, x + (frameW - dw) / 2, y + (frameH - dh) / 2, dw, dh);
    ctx.restore();

    ctx.fillStyle = "rgba(232,93,46,0.7)";
    ctx.font = "700 9px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1}A`, x + frameW / 2, y + frameH + 22);

    const artist = moment?.artistId ? (window.ARTISTS || []).find(a => a.id === moment.artistId) : null;
    if (artist) {
      ctx.fillStyle = "rgba(247,237,224,0.6)";
      ctx.font = "700 8px 'Geist Mono', monospace";
      ctx.fillText(artist.name.toUpperCase().slice(0, 18), x + frameW / 2, y - 10);
    }
  });

  ctx.fillStyle = "#f7ede0";
  ctx.font = "italic 400 36px 'Instrument Serif', serif";
  ctx.textAlign = "left";
  ctx.fillText(`${CFG.shortName || "Festival"} Memories`, filmPad, H - 30);
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  ctx.font = "700 11px 'Geist Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("PLURSKY+ · plursky.com", W - filmPad, H - 35);
  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, stripY + stripH/2); ctx.rotate(-Math.PI/12);
    ctx.fillStyle = "rgba(247,237,224,0.2)"; ctx.font = "700 48px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }

  return c;
}

async function _shareFilmStrip(moments) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderFilmStrip(moments);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-film-strip.png", { type: "image/png" });
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Festival Film Strip" }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-film-strip.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// W6: Crew Comparison Card — head-to-head stats
async function _renderCrewComparison(myName, myState, otherName, otherArtistIds) {
  const W = 1080, H = 1350;
  const CFG = window.FESTIVAL_CONFIG || {};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  try { await document.fonts.load("italic 400 56px 'Instrument Serif'"); await document.fonts.load("700 14px 'Geist Mono'"); } catch {}

  ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.font = "italic 400 56px 'Instrument Serif', serif";
  ctx.textAlign = "center";
  ctx.fillText("Crew Showdown", W/2, 120);
  ctx.font = "700 14px 'Geist Mono', monospace";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText(`${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`, W/2, 160);

  const mySaved = myState.saved || [];
  const theirSaved = otherArtistIds || [];
  const overlap = mySaved.filter(id => theirSaved.includes(id));
  const myOnly = mySaved.filter(id => !theirSaved.includes(id));
  const theirOnly = theirSaved.filter(id => !mySaved.includes(id));

  const artists = window.ARTISTS || [];
  const stages = window.STAGES || [];

  const myTopStage = _topStageFor(mySaved, artists, stages);
  const theirTopStage = _topStageFor(theirSaved, artists, stages);

  const myGem = _hiddenGemFor(mySaved, artists);
  const theirGem = _hiddenGemFor(theirSaved, artists);

  const midX = W / 2;
  const colL = W * 0.25, colR = W * 0.75;

  ctx.fillStyle = "#6D28D9"; ctx.beginPath(); ctx.arc(colL, 260, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "700 22px 'Geist Mono', monospace"; ctx.textAlign = "center";
  ctx.fillText((myName || "ME")[0].toUpperCase(), colL, 268);
  ctx.fillStyle = "#e85d2e"; ctx.beginPath(); ctx.arc(colR, 260, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText((otherName || "THEM")[0].toUpperCase(), colR, 268);

  ctx.font = "italic 400 24px 'Instrument Serif', serif";
  ctx.fillStyle = "#f7ede0";
  ctx.fillText(myName || "Me", colL, 330);
  ctx.fillText(otherName || "Friend", colR, 330);

  const rows = [
    { label: "SETS SAVED", left: `${mySaved.length}`, right: `${theirSaved.length}` },
    { label: "IN COMMON", left: `${overlap.length}`, right: `${overlap.length}`, highlight: true },
    { label: "UNIQUE PICKS", left: `${myOnly.length}`, right: `${theirOnly.length}` },
    { label: "TOP STAGE", left: myTopStage?.name?.toUpperCase() || "—", right: theirTopStage?.name?.toUpperCase() || "—" },
    { label: "HIDDEN GEM", left: myGem || "—", right: theirGem || "—" },
  ];

  let rowY = 400;
  rows.forEach(row => {
    ctx.fillStyle = row.highlight ? "rgba(109,40,217,0.15)" : "rgba(247,237,224,0.04)";
    ctx.fillRect(80, rowY - 25, W - 160, 60);

    ctx.fillStyle = row.highlight ? "#a78bfa" : "rgba(247,237,224,0.35)";
    ctx.font = "700 10px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(row.label, midX, rowY - 5);

    ctx.fillStyle = "#f7ede0";
    ctx.font = "700 22px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(row.left, colL, rowY + 22);
    ctx.fillText(row.right, colR, rowY + 22);

    rowY += 80;
  });

  const vsY = 260;
  ctx.fillStyle = "#1a120d";
  ctx.beginPath(); ctx.arc(midX, vsY, 25, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(247,237,224,0.2)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(midX, vsY, 25, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#f7ede0"; ctx.font = "italic 400 20px 'Instrument Serif', serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("vs", midX, vsY + 1);
  ctx.textBaseline = "alphabetic";

  if (overlap.length > 0) {
    const overlapNames = overlap.slice(0, 4).map(id => { const a = artists.find(x => x.id === id); return a?.name || id; });
    ctx.fillStyle = "rgba(247,237,224,0.3)";
    ctx.font = "700 10px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`SHARED SETS: ${overlapNames.join(" · ").toUpperCase()}${overlap.length > 4 ? ` + ${overlap.length - 4} MORE` : ""}`, W/2, rowY + 20);
  }

  if (!_isPlusSub()) {
    ctx.save(); ctx.translate(W/2, H/2 + 40); ctx.rotate(-Math.PI/6);
    ctx.fillStyle = "rgba(247,237,224,0.12)"; ctx.font = "700 64px 'Geist Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText("PLURSKY+", 0, 0); ctx.restore();
  }
  ctx.fillStyle = "rgba(247,237,224,0.2)";
  ctx.font = "700 11px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("MADE WITH PLURSKY+", W/2, H - 70);
  ctx.fillStyle = "rgba(247,237,224,0.4)";
  ctx.font = "italic 400 18px 'Instrument Serif', serif";
  ctx.fillText("plursky.com", W/2, H - 42);

  return c;
}

function _topStageFor(savedIds, artists, stages) {
  const counts = new Map();
  for (const id of savedIds) {
    const a = artists.find(x => x.id === id);
    if (!a) continue;
    counts.set(a.stage, (counts.get(a.stage) || 0) + 1);
  }
  let topId = null, topN = 0;
  for (const [sid, n] of counts) { if (n > topN) { topId = sid; topN = n; } }
  return topId ? stages.find(s => s.id === topId) : null;
}

function _hiddenGemFor(savedIds, artists) {
  let gem = null, lowestPop = Infinity;
  for (const id of savedIds) {
    const a = artists.find(x => x.id === id);
    if (!a) continue;
    const pop = a.spotifyPop ?? a.popularity ?? 50;
    if (pop < lowestPop) { lowestPop = pop; gem = a.name; }
  }
  return gem;
}

async function _shareCrewComparison(myName, myState, otherName, otherArtistIds) {
  const gate = _canShare(); if (!gate.allowed) { _showShareLimitToast(); return false; }
  const c = await _renderCrewComparison(myName, myState, otherName, otherArtistIds);
  if (!c) return false;
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  if (!blob) return false;
  try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  _incShareCount();
  const file = new File([blob], "plursky-crew-showdown.png", { type: "image/png" });
  if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Crew Showdown" }); return true; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "plursky-crew-showdown.png";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ── Festival Archive list — shown when user has past festival snapshots
function FestivalArchiveList({ archive }) {
  if (!archive?.length) return null;
  const sorted = [...archive].sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));
  return (
    <div style={{ marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>
        FESTIVAL ARCHIVE · {archive.length} {archive.length === 1 ? "PAST FESTIVAL" : "PAST FESTIVALS"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(f => (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 14,
            background: "var(--paper-2)", border: "1px solid var(--line)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, var(--ember), var(--horizon))",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>
              {(f.brand || f.name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 17, lineHeight: 1.1, color: "var(--ink)" }}>
                {f.name || f.id}
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 3 }}>
                {f.dates ? `${f.dates.toUpperCase()} · ` : ""}{f.totalAttended} CAUGHT · {f.totalMoments} MEMORIES
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
        TAP TO VIEW · COMING SOON
      </div>
    </div>
  );
}

function RecapScreen({ state, setState }) {
  const recap = React.useMemo(() => _computeRecap(state), [state]);
  const CFG   = window.FESTIVAL_CONFIG || {};
  const fmt12 = window.fmt12 || ((t) => t);
  const [wrappedOpen, setWrappedOpen] = React.useState(false);

  const back = () => window._popNav ? window._popNav() : setState(s => ({ ...s, tab: "me" }));

  // v151: ask for an iOS rating on 2nd+ Recap visit. iOS handles cool-off
  // (3 prompts / year) so we don't need to be cute about it.
  React.useEffect(() => {
    if (recap.setsCount > 0 || recap.momentsCount > 0) {
      _maybeAutoRatingPromptOnRecap();
      _archiveRecap(CFG.id, recap);
    }
  }, []);

  // v148: async-load the hero photo blob from IndexedDB so we can paint it
  // as the hero card background. Falls back to the gradient when no photo.
  const heroPhotoUrl = useMomentPhoto(recap.heroPhotoMoment?.photoId);

  // v148: crew highlights — pull last 100 crew_messages for the user's
  // current crew code (if any) and derive simple stats. One round-trip,
  // results cached in component state.
  const [crewStats, setCrewStats] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    try {
      const code = localStorage.getItem("plursky_group_code");
      if (!code || typeof window.sbCrewFetchMessages !== "function") return;
      window.sbCrewFetchMessages(code, 100).then(rows => {
        if (cancelled) return;
        if (!rows?.length) { setCrewStats({ total: 0, code }); return; }
        const counts = {};
        rows.forEach(r => {
          const name = r.sender_name || "Friend";
          counts[name] = (counts[name] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setCrewStats({
          total: rows.length,
          uniqueSenders: Object.keys(counts).length,
          topSender: top ? { name: top[0], count: top[1] } : null,
          code,
        });
      }).catch(() => {});
    } catch {}
    return () => { cancelled = true; };
  }, []);

  // v147: build a Spotify playlist of what the user actually CAUGHT (attended)
  // — separate from the existing build-playlist flow which uses saved sets.
  const [playlistState, setPlaylistState] = React.useState({ status: "idle" });
  const buildAttendedPlaylist = async () => {
    setPlaylistState({ status: "building" });
    try {
      const result = await createEdcPlaylist(state, { source: "attended" });
      if (result.ok) {
        setPlaylistState({ status: "done", url: result.url, added: result.added });
      } else {
        const reason = result.reason || "fail";
        const msg = {
          not_connected:     "Connect Spotify on the Me tab first.",
          empty:             "Mark sets you caught in Memories first.",
          reconnect:         "Reconnect Spotify (needs playlist permission).",
          no_target_playlist: "Create an empty Spotify playlist named 'Plursky' first.",
          rate_limited:      "Spotify is throttling — wait 30s and retry.",
        }[reason] || (result.message || "Couldn't build playlist.");
        setPlaylistState({ status: "error", msg });
      }
    } catch (e) {
      setPlaylistState({ status: "error", msg: e?.message || "Couldn't build playlist." });
    }
  };

  // Empty-state guard — nothing to recap (for the current festival).
  // Still show past festival archives if any exist.
  if (recap.setsCount === 0 && recap.momentsCount === 0) {
    const archive = (typeof _readArchive === "function") ? _readArchive() : {};
    const archived = Object.values(archive).filter(f => f.id !== CFG.id);
    return (
      <Screen bg="var(--paper)">
        <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={back} aria-label="Back" style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer",
            fontSize: 22, color: "var(--ink)", lineHeight: 1, width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>←</button>
          <TopBar title={<span>Recap</span>} sub={CFG.shortName?.toUpperCase()} tight />
        </div>
        <ScrollBody style={{ padding: "10px 20px 94px" }}>
          <div style={{ padding: "40px 0 24px", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 24, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>
              Nothing to recap yet
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              MARK SETS YOU CAUGHT IN MEMORIES — TODAY'S WEEKEND RECAP WILL FILL IN
            </div>
          </div>
          {archived.length > 0 && <FestivalArchiveList archive={archived} />}
        </ScrollBody>
      </Screen>
    );
  }

  return (
    <Screen bg="var(--paper-2)">
      <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
        <button onClick={back} aria-label="Back" style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          fontSize: 22, color: "var(--ink)", lineHeight: 1, width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>←</button>
        <TopBar title={<span>Recap</span>} sub={(CFG.shortName || "Festival").toUpperCase() + " · YOUR WEEKEND"} tight />
      </div>
      <ScrollBody style={{ padding: "14px 16px 94px" }}>
        {/* HERO ─ totals · share button bottom-right */}
        <div style={{
          borderRadius: 22, padding: "26px 22px", marginBottom: 14,
          background: heroPhotoUrl
            ? `linear-gradient(155deg, rgba(26,18,13,0.85) 0%, rgba(123,61,154,0.72) 60%, rgba(232,93,46,0.65) 130%), url(${heroPhotoUrl}) center/cover`
            : "linear-gradient(155deg, var(--ink) 0%, var(--horizon) 60%, var(--ember) 130%)",
          color: "var(--paper)",
          boxShadow: "0 10px 30px rgba(26,18,13,0.18)",
          position: "relative",
          overflow: "hidden",
        }}>
          <button
            onClick={async () => { await _shareRecapCard(recap); }}
            aria-label="Share recap"
            style={{
              position: "absolute", top: 16, right: 16,
              padding: "7px 12px", borderRadius: 999,
              background: "rgba(247,237,224,0.18)", color: "#f7ede0",
              border: "1px solid rgba(247,237,224,0.35)", cursor: "pointer",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              backdropFilter: "blur(8px)",
            }}>↗ SHARE</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.6, color: "rgba(247,237,224,0.75)", fontWeight: 700, marginBottom: 10 }}>
              YOUR {(CFG.shortName || "FESTIVAL").toUpperCase()} · {CFG.year || ""}
            </div>
          </div>
          <div className="serif" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: -0.5, marginBottom: 18 }}>
            That was <span style={{ fontStyle: "italic", color: "var(--flare)" }}>your</span> weekend.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{recap.setsCount}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>SETS CAUGHT</div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{_fmtHrsMin(recap.totalMin)}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>ON DANCEFLOORS</div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{recap.nights}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>NIGHTS</div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{recap.headlinersCaught}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>HEADLINERS</div>
            </div>
          </div>
        </div>

        {/* WRAPPED CTA */}
        {recap.setsCount > 0 && (
          <button onClick={() => setWrappedOpen(true)} style={{
            width: "100%", padding: "16px 20px", marginBottom: 14,
            borderRadius: 16, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(109,40,217,0.35)",
          }}>
            <div style={{ textAlign: "left" }}>
              <div className="serif" style={{ fontSize: 20, lineHeight: 1.1 }}>
                Your <em>Wrapped</em>
              </div>
              <div className="mono" style={{ fontSize: 8, letterSpacing: 1.4, color: "rgba(255,255,255,0.6)", marginTop: 3, fontWeight: 700 }}>
                SWIPE THROUGH YOUR FESTIVAL STORY
              </div>
            </div>
            <span style={{ fontSize: 22 }}>→</span>
          </button>
        )}

        {/* YOUR SOUNDTRACK */}
        {(() => {
          const soundtrack = _aggregateSoundtrack(_readMoments());
          if (!soundtrack.length) return null;
          return (
            <RecapCard kicker="YOUR SOUNDTRACK" paper="#1DB95418" mono="#1DB954">
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: -0.4, marginBottom: 10 }}>
                <span style={{ color: "#1DB954" }}>{soundtrack.length}</span> songs were playing when you took photos
              </div>
              <div style={{ marginTop: 8 }}>
                {soundtrack.slice(0, 5).map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 0",
                    borderBottom: i < Math.min(soundtrack.length, 5) - 1 ? "1px solid var(--line)" : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {i + 1}. {s.song}
                      </div>
                      <div className="mono" style={{ fontSize: 8, color: "var(--muted)", letterSpacing: 0.8, marginTop: 1 }}>
                        {[...s.artists].join(", ")}
                      </div>
                    </div>
                    <div className="mono" style={{
                      fontSize: 8, letterSpacing: 0.8, color: "#1DB954", fontWeight: 700, flexShrink: 0, marginLeft: 8,
                    }}>
                      {s.count} {s.count === 1 ? "PHOTO" : "PHOTOS"}
                    </div>
                  </div>
                ))}
              </div>
              {soundtrack.length > 0 && (
                <button onClick={() => {
                  const q = soundtrack.slice(0, 10).map(s => s.song).join(" ");
                  window.open(`https://open.spotify.com/search/${encodeURIComponent(q)}`, "_blank");
                }} style={{
                  marginTop: 12, width: "100%", padding: "10px 16px",
                  borderRadius: 20, border: "none", cursor: "pointer",
                  background: "#1DB954", color: "#fff", fontWeight: 700,
                  fontSize: 10, letterSpacing: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 14 }}>♫</span> FIND ON SPOTIFY
                </button>
              )}
            </RecapCard>
          );
        })()}

        {/* TOP STAGE */}
        {recap.topStage && (
          <RecapCard
            kicker="YOUR HEADQUARTERS"
            paper={`${recap.topStage.color}18`}
            mono={recap.topStage.color}
          >
            <div className="serif" style={{ fontSize: 32, lineHeight: 1, letterSpacing: -0.4, marginBottom: 8 }}>
              You lived at <span style={{ fontStyle: "italic", color: recap.topStage.color }}>{recap.topStage.name}</span>
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 6, fontWeight: 600 }}>
              {_fmtHrsMin(recap.topStageMin)} of your weekend was right here
            </div>
          </RecapCard>
        )}

        {/* BUSIEST NIGHT */}
        {recap.busiestNightCount > 0 && (
          <RecapCard kicker="BUSIEST NIGHT">
            <div className="serif" style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: -0.4 }}>
              <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{recap.busiestNightLabel}</span> was your peak —
              {" "}{recap.busiestNightCount} sets in one night.
            </div>
          </RecapCard>
        )}

        {/* TOP GENRE */}
        {recap.topGenre && (
          <RecapCard kicker="THE SOUND OF YOUR WEEKEND" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.0, letterSpacing: -0.4 }}>
              You went deep on{" "}
              <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>{recap.topGenre}</span>.
            </div>
          </RecapCard>
        )}

        {/* FIRST + LAST */}
        {recap.firstSet && recap.lastSet && (
          <RecapCard kicker="BOOKENDS">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 14 }}>
              You opened with <span style={{ color: "var(--ember)" }}>{recap.firstSet.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 16 }}> · {fmt12(recap.firstSet.start)}</span>
            </div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>
              and closed with <span style={{ color: "var(--ember)" }}>{recap.lastSet.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 16 }}> · {fmt12(recap.lastSet.start)}</span>
            </div>
          </RecapCard>
        )}

        {/* SUNRISE */}
        {recap.sunriseSetsCount > 0 && (
          <RecapCard kicker="STAYED UP">
            <div className="serif" style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: -0.4 }}>
              {recap.sunriseSetsCount === 1 ? "One sunrise set" : `${recap.sunriseSetsCount} sunrise sets`}.{" "}
              <span style={{ color: "var(--flare)", fontStyle: "italic" }}>Respect.</span>
            </div>
          </RecapCard>
        )}

        {/* HIDDEN GEM */}
        {recap.hiddenGem && (
          <RecapCard kicker="HIDDEN GEM" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3 }}>
              Most under-the-radar artist you saw:{" "}
              <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>{recap.hiddenGem.name}</span>.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              SPOTIFY POPULARITY {recap.hiddenGem._pop} / 100 · TASTE 🤌
            </div>
          </RecapCard>
        )}

        {/* STAGES VISITED */}
        {recap.stagesVisitedCount > 0 && (
          <RecapCard kicker={`STAGES VISITED · ${recap.stagesVisitedCount} OF ${(window.STAGES || []).length}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10 }}>
              {recap.stagesVisitedCount === (window.STAGES || []).length
                ? <>Every <span style={{ fontStyle: "italic", color: "var(--ember)" }}>stage</span>. Completionist.</>
                : <>You set foot at <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{recap.stagesVisitedCount}</span> of {(window.STAGES || []).length} stages.</>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {recap.stagesVisitedNames.map(name => (
                <span key={name} className="mono" style={{
                  padding: "4px 9px", borderRadius: 999,
                  background: "var(--paper)", border: "1px solid var(--line-2)",
                  color: "var(--ink)", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
                }}>{name.toUpperCase()}</span>
              ))}
            </div>
          </RecapCard>
        )}

        {/* WALKING DISTANCE */}
        {recap.walkingMinutesHi > 0 && (
          <RecapCard kicker="DISTANCE COVERED">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3 }}>
              You walked roughly{" "}
              <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>
                {recap.walkingMetersHi >= 1000
                  ? `${(recap.walkingMetersLo / 1000).toFixed(1)}–${(recap.walkingMetersHi / 1000).toFixed(1)} km`
                  : `${recap.walkingMetersLo}–${recap.walkingMetersHi} m`}
              </span>{" "}
              between stages.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              ~{recap.walkingMinutesLo}–{recap.walkingMinutesHi} MIN WALKING TOTAL
            </div>
          </RecapCard>
        )}

        {/* B2B SETS */}
        {recap.b2bCount > 0 && (
          <RecapCard kicker={`B2B SETS · ${recap.b2bCount}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 8 }}>
              You caught {recap.b2bCount === 1 ? "a" : recap.b2bCount} <span style={{ fontStyle: "italic", color: "var(--ember)" }}>back-to-back</span> collab{recap.b2bCount === 1 ? "" : "s"}.
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
              {recap.b2bNames.join(" · ")}
            </div>
          </RecapCard>
        )}

        {/* HEADLINERS */}
        {recap.headlinersCaught > 0 && (
          <RecapCard kicker={`HEADLINERS CAUGHT · ${recap.headlinersCaught}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {recap.headlinerNames.map(n => (
                <span key={n} className="mono" style={{
                  padding: "6px 11px", borderRadius: 999,
                  background: "var(--ink)", color: "var(--paper)",
                  fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                }}>★ {n.toUpperCase()}</span>
              ))}
            </div>
          </RecapCard>
        )}

        {/* MEMORIES */}
        {recap.momentsCount > 0 && (
          <RecapCard kicker="MEMORIES" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: -0.4 }}>
              <span style={{ color: "var(--ember)" }}>{recap.momentsCount}</span>{" "}
              {recap.momentsCount === 1 ? "moment" : "moments"} captured.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              {recap.photosCount} PHOTO{recap.photosCount === 1 ? "" : "S"}
              {recap.videosCount > 0 ? ` · ${recap.videosCount} VIDEO${recap.videosCount === 1 ? "" : "S"}` : ""}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => setState(s => ({ ...s, tab: "memories" }))} style={{
                padding: "8px 14px", borderRadius: 999,
                background: "var(--ink)", color: "var(--paper)", border: "none",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                cursor: "pointer",
              }}>OPEN MEMORIES →</button>
              <button
                onClick={async () => {
                  // Grab every moment from localStorage, hand to the weekend
                  // collage builder which picks 6 best across nights.
                  const all = [];
                  try {
                    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
                    for (const n of Object.keys(raw)) {
                      for (const m of (raw[n] || [])) all.push(m);
                    }
                  } catch {}
                  await window._shareWeekendCollage?.(all);
                }}
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  background: "var(--ember)", color: "#fff", border: "none",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                  cursor: "pointer",
                }}>📸 SHARE WEEKEND</button>
              <button
                onClick={async () => {
                  const all = [];
                  try {
                    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
                    for (const n of Object.keys(raw)) {
                      for (const m of (raw[n] || [])) all.push(m);
                    }
                  } catch {}
                  await window._shareWeekendCollage?.(all, "gif");
                }}
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  background: "#6D28D9", color: "#fff", border: "none",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                  cursor: "pointer",
                }}>🎬 GIF</button>
            </div>
          </RecapCard>
        )}

        {/* RECAP VIDEO */}
        {recap.momentsCount >= 3 && (() => {
          const [vidTemplate, setVidTemplate] = React.useState("highlight");
          const [vidState, setVidState] = React.useState("idle");
          const [trackQuery, setTrackQuery] = React.useState("");
          const [trackResults, setTrackResults] = React.useState([]);
          const [selectedTrack, setSelectedTrack] = React.useState(null);
          const [previewAudio, setPreviewAudio] = React.useState(null);
          const [searching, setSearching] = React.useState(false);

          const searchTracks = async (q) => {
            if (!q || q.length < 2) { setTrackResults([]); return; }
            setSearching(true);
            try {
              const token = localStorage.getItem("spotify_token");
              if (token) {
                const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=6`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                  const d = await res.json();
                  setTrackResults((d.tracks?.items || []).filter(t => t.preview_url).slice(0, 5));
                }
              } else {
                const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`);
                if (res.ok) {
                  const d = await res.json();
                  setTrackResults((d.results || []).filter(t => t.previewUrl).slice(0, 5).map(t => ({ name: t.trackName, artists: [{ name: t.artistName }], preview_url: t.previewUrl, album: { images: [{ url: t.artworkUrl60 }] } })));
                }
              }
            } catch {}
            setSearching(false);
          };

          const togglePreview = (url) => {
            if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); }
            if (previewAudio?.src === url) return;
            const a = new Audio(url);
            a.play().catch(() => {});
            setPreviewAudio(a);
          };

          return (
            <RecapCard kicker="RECAP VIDEO" paper="#1a120d" accent="#fff">
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, color: "#f7ede0", letterSpacing: -0.3 }}>
                Turn your memories into a{" "}
                <span style={{ fontStyle: "italic", color: "#a78bfa" }}>video</span>.
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {["highlight", "diary", "ditl"].map(t => {
                  const locked = t !== "highlight" && !_isPlusSub();
                  return (
                    <button key={t} onClick={() => locked ? null : setVidTemplate(t)} className="mono" style={{
                      padding: "5px 10px", borderRadius: 999, cursor: locked ? "default" : "pointer", border: "none",
                      background: vidTemplate === t ? "#6D28D9" : "rgba(247,237,224,0.1)",
                      color: vidTemplate === t ? "#fff" : locked ? "rgba(247,237,224,0.25)" : "rgba(247,237,224,0.5)",
                      fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                      opacity: locked ? 0.6 : 1,
                    }}>{t === "highlight" ? "HIGHLIGHT REEL" : t === "diary" ? "🔒 FESTIVAL DIARY" : "🔒 DAY IN THE LIFE"}{locked ? "" : ""}</button>
                  );
                })}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.35)", marginTop: 8, letterSpacing: 1 }}>
                {vidTemplate === "highlight" ? "Fast cuts synced to the beat — your best moments, drop by drop." : vidTemplate === "diary" ? "Slow, cinematic. Your weekend told as a story." : "Morning to sunrise — one continuous timeline."}
              </div>

              {/* Track picker — Plus-only custom music */}
              <div style={{ marginTop: 14 }}>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(247,237,224,0.4)", marginBottom: 6 }}>
                  🎵 {selectedTrack ? "SOUNDTRACK" : _isPlusSub() ? "PICK A SONG (OPTIONAL)" : "🔒 CUSTOM SOUNDTRACK · PLURSKY+"}
                </div>
                {!_isPlusSub() && !selectedTrack ? (
                  <div className="mono" style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(247,237,224,0.04)", border: "1px solid rgba(247,237,224,0.08)", color: "rgba(247,237,224,0.2)", fontSize: 10, textAlign: "center" }}>
                    Upgrade to Plursky+ to pick your own soundtrack
                  </div>
                ) : selectedTrack ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(109,40,217,0.2)" }}>
                    {selectedTrack.album?.images?.[0]?.url && (
                      <img src={selectedTrack.album.images[0].url} style={{ width: 32, height: 32, borderRadius: 6 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#f7ede0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedTrack.name}</div>
                      <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.5)" }}>{selectedTrack.artists?.[0]?.name}</div>
                    </div>
                    <button onClick={() => { setSelectedTrack(null); if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); } }} className="mono" style={{
                      background: "none", border: "none", color: "rgba(247,237,224,0.4)", cursor: "pointer", fontSize: 14, padding: "4px",
                    }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text" value={trackQuery}
                      onChange={e => { setTrackQuery(e.target.value); searchTracks(e.target.value); }}
                      placeholder="Search for a song…"
                      style={{
                        width: "100%", padding: "8px 12px", borderRadius: 10,
                        background: "rgba(247,237,224,0.08)", border: "1px solid rgba(247,237,224,0.1)",
                        color: "#f7ede0", fontFamily: "Geist Mono, monospace", fontSize: 10,
                        outline: "none",
                      }}
                    />
                    {trackResults.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {trackResults.map((tr, i) => (
                          <button key={i} onClick={() => { setSelectedTrack(tr); setTrackResults([]); setTrackQuery(""); togglePreview(tr.preview_url); }} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8,
                            background: "rgba(247,237,224,0.05)", border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                          }}>
                            {tr.album?.images?.[0]?.url && <img src={tr.album.images[0].url} style={{ width: 28, height: 28, borderRadius: 4 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: "#f7ede0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr.name}</div>
                              <div className="mono" style={{ fontSize: 8, color: "rgba(247,237,224,0.4)" }}>{tr.artists?.[0]?.name}</div>
                            </div>
                            <div className="mono" style={{ fontSize: 8, color: "#a78bfa" }}>▶</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searching && <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.3)", marginTop: 4 }}>Searching…</div>}
                  </>
                )}
              </div>

              <button
                disabled={vidState === "rendering"}
                onClick={async () => {
                  if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); }
                  setVidState("rendering");
                  const all = [];
                  try {
                    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
                    for (const n of Object.keys(raw)) for (const m of (raw[n] || [])) all.push(m);
                  } catch {}
                  let audioUrl = selectedTrack?.preview_url || null;
                  if (!audioUrl && recap.topByPop?.name) {
                    try { const r = await fetchPreviewUrl(recap.topByPop.name); audioUrl = r?.url; } catch {}
                  }
                  await window._shareRecapVideo?.({
                    moments: all, audioUrl, template: vidTemplate, recap,
                    title: "My Weekend",
                    subtitle: `${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`,
                    accent: "#6D28D9",
                  });
                  setVidState("idle");
                }}
                className="mono"
                style={{
                  width: "100%", marginTop: 14, padding: "13px",
                  background: vidState === "rendering" ? "rgba(109,40,217,0.4)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
                  color: "#fff", border: "none", borderRadius: 12, cursor: vidState === "rendering" ? "wait" : "pointer",
                  fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
                }}>{vidState === "rendering" ? "⏳ RENDERING…" : "🎬 CREATE RECAP VIDEO"}</button>
            </RecapCard>
          );
        })()}

        {/* S2: GENRE BREAKDOWN */}
        {recap.genreBreakdown?.length > 0 && (
          <RecapCard kicker="YOUR GENRE MIX" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 12 }}>
              Your festival was <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{recap.genreBreakdown[0]?.genre || "eclectic"}</span>.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recap.genreBreakdown.map(({ genre, count }, i) => {
                const maxCount = recap.genreBreakdown[0]?.count || 1;
                return (
                  <div key={genre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", width: 120, textAlign: "right", flexShrink: 0, fontWeight: 600 }}>
                      {genre.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, height: 18, borderRadius: 9, background: "var(--paper-2)", overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.max(8, Math.round(count / maxCount * 100))}%`, height: "100%",
                        borderRadius: 9, background: i === 0 ? "var(--ember)" : i === 1 ? "#6D28D9" : "var(--line-2)",
                        transition: "width .3s",
                      }} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink)", width: 20, textAlign: "right" }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </RecapCard>
        )}

        {/* S4: FESTIVAL VIBE SCORE */}
        {recap.vibeScore != null && (
          <RecapCard kicker="FESTIVAL VIBE" paper="var(--paper)">
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={recap.vibeScore >= 70 ? "#e85d2e" : recap.vibeScore >= 40 ? "#6D28D9" : "#2d7a55"} strokeWidth="6"
                    strokeDasharray={`${recap.vibeScore * 2.136} 213.6`} strokeLinecap="round"
                    transform="rotate(-90 40 40)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{recap.vibeScore}</span>
                </div>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
                  {recap.vibeScore >= 80 ? "Peak energy." : recap.vibeScore >= 60 ? "High octane." : recap.vibeScore >= 40 ? "Balanced vibe." : "Laid back."}
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>
                  {recap.vibeScore >= 70 ? "YOU CHASED THE DROPS ALL WEEKEND" : recap.vibeScore >= 40 ? "MIX OF ENERGY + CHILL" : "YOU FOUND THE QUIET CORNERS"}
                </div>
              </div>
            </div>
          </RecapCard>
        )}

        {/* AI SET RECOMMENDER — HIDDEN GEMS */}
        {(() => {
          let discoveries = [];
          try {
            const raw = localStorage.getItem("spotify_matched_v1");
            const spotifyArtists = JSON.parse(localStorage.getItem("spotify_top_artists_v1") || "null");
            const matched = raw ? JSON.parse(raw) : [];
            if (spotifyArtists?.length) discoveries = getDiscoveries(spotifyArtists, matched, state.saved, 5);
          } catch {}
          if (!discoveries.length) return null;
          const freeLimit = 2;
          const showAll = _isPlusSub();
          const visible = showAll ? discoveries : discoveries.slice(0, freeLimit);
          return (
            <RecapCard kicker="HIDDEN GEMS — AI PICKS FOR YOU" paper="var(--night)" accent="#fff">
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, color: "#f7ede0", marginBottom: 12 }}>
                Artists you'd <em style={{ color: "#a78bfa" }}>love</em>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visible.map((a, i) => {
                  const stage = STAGES.find(s => s.id === a.stage);
                  const isSaved = (state.saved || []).includes(a.id);
                  return (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: stage?.color || "#6D28D9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, color: "#fff", fontWeight: 700,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f7ede0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                        <div className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                          {a._reason || (stage?.name || "")} · {FESTIVAL_CONFIG.dayDates?.[a.day]?.short || ""} {window.fmt12?.(a.start) || a.start}
                        </div>
                      </div>
                      <button onClick={() => {
                        if (isSaved) return;
                        setState(s => ({ ...s, saved: [...new Set([...s.saved, a.id])] }));
                        try { window.plurskyHaptic?.("LIGHT"); } catch {}
                      }} className="mono" style={{
                        padding: "5px 10px", borderRadius: 999, flexShrink: 0,
                        background: isSaved ? "rgba(45,122,85,0.3)" : "rgba(167,139,250,0.2)",
                        border: isSaved ? "1px solid rgba(45,122,85,0.5)" : "1px solid rgba(167,139,250,0.4)",
                        color: isSaved ? "#2d7a55" : "#a78bfa",
                        fontSize: 8, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
                      }}>{isSaved ? "✓ SAVED" : "+ SAVE"}</button>
                    </div>
                  );
                })}
                {!showAll && discoveries.length > freeLimit && (
                  <PlusGate feature="all hidden gems">
                    <div style={{ padding: 20, textAlign: "center" }}>
                      <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1.2 }}>
                        +{discoveries.length - freeLimit} MORE PICKS WAITING
                      </div>
                    </div>
                  </PlusGate>
                )}
              </div>
            </RecapCard>
          );
        })()}

        {/* CREW COMPATIBILITY */}
        {crewStats?.total > 0 && (
          <RecapCard kicker="CREW COMPATIBILITY" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 12 }}>
              Your crew <em style={{ color: "var(--ember)" }}>vibe check</em>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 10 }}>
              {crewStats.total} messages sent in crew chat{crewStats.topChatter ? ` · ${crewStats.topChatter[0]} was the most active` : ""}.
            </div>
            <PlusGate feature="crew compatibility">
              <button onClick={async () => {
                try { await window._shareCrewComparison?.(state); } catch {}
              }} className="mono" style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, var(--ember), var(--horizon))",
                color: "#fff", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>EXPORT CREW SHOWDOWN CARD</button>
            </PlusGate>
          </RecapCard>
        )}

        {/* TRADING CARDS — collectible per-artist cards */}
        {recap.setsCount > 0 && (
          <RecapCard kicker="FESTIVAL TRADING CARDS" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 6 }}>
              Collect your <em style={{ color: "var(--horizon)" }}>set cards</em>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
              {recap.setsCount} cards earned — one for every set you caught. Export as shareable collectibles.
            </div>
            <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10, padding: "2px 0" }}>
              {(() => {
                const attended = window.getAllAttended?.() || {};
                const artists = Object.values(attended).flat().map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).slice(0, 6);
                return artists.map((a, i) => {
                  const stage = STAGES.find(s => s.id === a.stage);
                  return (
                    <div key={a.id} style={{
                      width: 90, height: 130, flexShrink: 0, borderRadius: 10,
                      background: `linear-gradient(155deg, ${stage?.color || "#6D28D9"}22 0%, ${stage?.color || "#6D28D9"}44 100%)`,
                      border: `1.5px solid ${stage?.color || "#6D28D9"}55`,
                      padding: "10px 8px", display: "flex", flexDirection: "column",
                      justifyContent: "space-between",
                    }}>
                      <div className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: stage?.color || "var(--muted)", fontWeight: 700 }}>
                        {stage?.short || ""}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, color: "var(--ink)" }}>
                          {a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name}
                        </div>
                        <div className="mono" style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, letterSpacing: 0.8 }}>
                          {FESTIVAL_CONFIG.dayDates?.[a.day]?.short || ""} · {window.fmt12?.(a.start) || a.start}
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 8, letterSpacing: 1, color: stage?.color, fontWeight: 700, textAlign: "right" }}>
                        #{String(i + 1).padStart(3, "0")}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <PlusGate feature="trading cards export">
              <button onClick={async () => {
                try { await window._shareFestivalPassport?.(state); } catch {}
              }} className="mono" style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "var(--ink)", color: "var(--paper)",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>EXPORT FULL COLLECTION</button>
            </PlusGate>
          </RecapCard>
        )}

        {/* SETLIST MEMORIES */}
        {recap.momentsCount > 0 && recap.setsCount > 0 && (
          <RecapCard kicker="SETLIST MEMORIES" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 6 }}>
              What was <em style={{ color: "var(--ember)" }}>playing</em>?
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              Your photos are matched to the actual setlist — showing which song was playing when you took each shot. Open any moment in Memories to see the track.
            </div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--success)", fontWeight: 700, marginTop: 10 }}>
              ✓ LIVE · POWERED BY SETLIST.FM
            </div>
          </RecapCard>
        )}

        {/* PLURSKY+ WOW FEATURES */}
        {recap.momentsCount > 0 && (
          <RecapCard kicker="PLURSKY+ EXCLUSIVES" paper="#1a120d" accent="#fff">
            <div className="serif" style={{ fontSize: 24, lineHeight: 1.1, color: "#f7ede0", letterSpacing: -0.3 }}>
              Your weekend, <span style={{ fontStyle: "italic", color: "#a78bfa" }}>elevated</span>.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <button onClick={async () => {
                const all = []; try { const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"); for (const n of Object.keys(raw)) for (const m of (raw[n] || [])) all.push(m); } catch {}
                await window._shareFestivalDNA?.(all);
              }} className="mono" style={{
                padding: "12px", background: "linear-gradient(90deg, #e85d2e, #6D28D9, #2d7a55, #f59a36)", color: "#fff",
                border: "none", borderRadius: 10, cursor: "pointer", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>🧬 FESTIVAL DNA — YOUR UNIQUE COLOR BARCODE</button>
              <button onClick={() => window._shareFestivalPassport?.(state)} className="mono" style={{
                padding: "12px", background: "rgba(247,237,224,0.08)", color: "#f7ede0",
                border: "1px solid rgba(247,237,224,0.15)", borderRadius: 10, cursor: "pointer",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>🛂 FESTIVAL PASSPORT — STAGE STAMPS</button>
              <button onClick={async () => {
                const all = []; try { const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"); for (const n of Object.keys(raw)) for (const m of (raw[n] || [])) all.push(m); } catch {}
                await window._shareFilmStrip?.(all);
              }} className="mono" style={{
                padding: "12px", background: "rgba(247,237,224,0.08)", color: "#f7ede0",
                border: "1px solid rgba(247,237,224,0.15)", borderRadius: 10, cursor: "pointer",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>🎞️ FILM STRIP — RETRO PHOTO REEL</button>
            </div>
            {!_isPlusSub() && (
              <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.3)", marginTop: 10, textAlign: "center", letterSpacing: 1.2 }}>
                FREE PREVIEW WITH WATERMARK · UPGRADE TO REMOVE
              </div>
            )}
          </RecapCard>
        )}

        {/* P5: CUSTOM ACCENT (Plus-only) */}
        {_isPlusSub() && (
          <RecapCard kicker="YOUR STYLE" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, letterSpacing: -0.3 }}>
              Pick your <span style={{ fontStyle: "italic", color: _getCustomAccent() || "var(--ember)" }}>accent color</span>.
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>
              Applies to all collages, GIFs, and video exports.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {["#e85d2e","#6D28D9","#ec4899","#2563eb","#22c55e","#f97316","#1a120d","#14b8a6","#fbbf24"].map(c => (
                <button key={c} onClick={() => { _setCustomAccent(c); setState(s => ({ ...s })); }} style={{
                  width: 32, height: 32, borderRadius: 32, background: c, border: _getCustomAccent() === c ? "3px solid var(--ink)" : "2px solid var(--line)",
                  cursor: "pointer", boxShadow: _getCustomAccent() === c ? "0 0 0 2px var(--paper), 0 0 0 4px var(--ink)" : "none",
                }} />
              ))}
              <button onClick={() => { _setCustomAccent(""); setState(s => ({ ...s })); }} className="mono" style={{
                height: 32, padding: "0 10px", borderRadius: 32, background: "var(--paper-2)", border: "1px solid var(--line-2)",
                cursor: "pointer", fontSize: 8, letterSpacing: 1, color: "var(--muted)", fontWeight: 700,
              }}>RESET</button>
            </div>
          </RecapCard>
        )}

        {/* P3: FESTIVAL ARCHIVE (Plus-only) */}
        {_isPlusSub() && (() => {
          const archive = _getRecapArchive();
          const archiveEntries = Object.entries(archive).filter(([id]) => id !== FESTIVAL_CONFIG.id);
          if (!archiveEntries.length) return null;
          return (
            <RecapCard kicker="PAST FESTIVALS" paper="var(--paper)">
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, letterSpacing: -0.3, marginBottom: 10 }}>
                Your festival <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>archive</span>.
              </div>
              {archiveEntries.map(([id, r]) => (
                <div key={id} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--line)", marginBottom: 6 }}>
                  <div className="serif" style={{ fontSize: 16 }}>{id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                    {r.setsCount || 0} sets · {r.momentsCount || 0} memories · {r.stagesVisitedCount || 0} stages
                  </div>
                </div>
              ))}
            </RecapCard>
          );
        })()}

        {/* WEEKEND PLAYLIST */}
        {state.spotifyConnected && recap.setsCount > 0 && (
          <RecapCard kicker="YOUR SOUNDTRACK" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 14 }}>
              Take the weekend <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>home</span> with you.
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 }}>
              Build a Spotify playlist of every set you actually caught — top tracks from each, in chronological set order.
            </div>
            {playlistState.status === "done" ? (
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(45,122,85,0.12)", border: "1px solid rgba(45,122,85,0.4)",
              }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--success)", fontWeight: 700, marginBottom: 6 }}>
                  ✓ {playlistState.added} TRACKS ADDED
                </div>
                {playlistState.url && (
                  <a href={playlistState.url} target="_blank" rel="noopener noreferrer" className="mono" style={{
                    fontSize: 10, letterSpacing: 1.1, color: "var(--ink)", fontWeight: 700,
                    textDecoration: "underline",
                  }}>OPEN IN SPOTIFY ↗</a>
                )}
              </div>
            ) : (
              <button onClick={buildAttendedPlaylist} disabled={playlistState.status === "building"} style={{
                background: playlistState.status === "building" ? "var(--paper-2)" : "#1DB954",
                color: playlistState.status === "building" ? "var(--muted)" : "#fff",
                border: "none", borderRadius: 999, padding: "11px 18px",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
                cursor: playlistState.status === "building" ? "default" : "pointer",
                alignSelf: "flex-start",
              }}>
                {playlistState.status === "building" ? "BUILDING…" : "↗ BUILD WEEKEND PLAYLIST"}
              </button>
            )}
            {playlistState.status === "error" && (
              <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "#c14a4a", marginTop: 8, fontWeight: 600 }}>
                {playlistState.msg}
              </div>
            )}
          </RecapCard>
        )}

        {/* DISCOVERY — saved but didn't catch */}
        {recap.missedSaved.length > 0 && (
          <RecapCard kicker={`MISSED · ${recap.missedSaved.length}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10 }}>
              You saved {recap.missedSaved.length} sets you didn't make it to.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
              CATCH THEM NEXT YEAR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recap.missedSaved.map(a => {
                const stage = (window.STAGES || []).find(s => s.id === a.stage);
                return (
                  <button key={a.id}
                    onClick={() => setState(s => ({ ...s, artist: a.id }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 8,
                      background: "var(--paper)", border: "1px solid var(--line)",
                      cursor: "pointer", textAlign: "left",
                    }}>
                    <div style={{ width: 3, alignSelf: "stretch", background: stage?.color || "var(--line-2)", borderRadius: 2, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, flex: 1 }}>{a.name}</span>
                    <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
                      {stage?.short || ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </RecapCard>
        )}

        {/* CREW HIGHLIGHTS */}
        {crewStats && crewStats.total > 0 && (
          <RecapCard kicker={`CREW · ${crewStats.code}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10 }}>
              Your crew sent <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{crewStats.total}</span> messages this weekend.
            </div>
            {crewStats.topSender && (
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Loudest in the group chat:{" "}
                <strong style={{ color: "var(--ink)" }}>{crewStats.topSender.name}</strong>
                {" "}({crewStats.topSender.count} messages).
              </div>
            )}
            {crewStats.uniqueSenders > 1 && (
              <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
                {crewStats.uniqueSenders} VOICES · 1 PLUR
              </div>
            )}
          </RecapCard>
        )}

        {/* OUTRO */}
        <RecapCard
          kicker="UNTIL NEXT YEAR"
          paper="linear-gradient(155deg, var(--paper) 0%, rgba(245,154,54,0.18) 100%)"
        >
          <div className="serif" style={{ fontSize: 32, lineHeight: 1, letterSpacing: -0.4 }}>
            See you under the <span style={{ fontStyle: "italic", color: "var(--ember)" }}>electric sky</span>.
          </div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
            PLURSKY · {CFG.year || ""}
          </div>
        </RecapCard>
      </ScrollBody>
      {wrappedOpen && <WrappedStory recap={recap} onClose={() => setWrappedOpen(false)} />}
    </Screen>
  );
}

/* ─── NowPlayingBar ──────────────────────────────────────────────── */
function NowPlayingBar() {
  const [liveState, setLiveState] = React.useState({ stage: null, artist: null, song: null, listening: false, usersHere: 0 });
  const [captured, setCaptured] = React.useState(false);
  const CFG = window.FESTIVAL_CONFIG || {};

  const debugLive = React.useMemo(() => {
    try { return localStorage.getItem("plursky-debug-live") === "true"; } catch { return false; }
  }, []);

  // Check if we're during festival hours (or debug override)
  const isFestivalLive = React.useMemo(() => {
    if (debugLive) return true;
    if (!CFG.dayDates) return false;
    const now = Date.now();
    for (const dd of Object.values(CFG.dayDates)) {
      const openMs = dd.midnightUtc + 19 * 3600000; // 7pm
      const closeMs = dd.midnightUtc + (5.5 + 24) * 3600000; // 5:30am next day
      if (now >= openMs && now <= closeMs) return true;
    }
    return false;
  }, [debugLive]);

  // GPS watch for current stage (debug: simulate first stage + first artist on night 1)
  React.useEffect(() => {
    if (!isFestivalLive) return;

    if (debugLive) {
      const stages = window.STAGES || [];
      const artists = window.ARTISTS || [];
      const debugStage = stages[0];
      const debugArtist = artists.find(a => a.stage === debugStage?.id && a.day === 1) || artists[0];
      if (debugStage) {
        setLiveState(s => ({ ...s, stage: debugStage, artist: debugArtist || null }));
        if (window.joinStagePresence) window.joinStagePresence(debugStage.id);
      }
      return () => { if (window.leaveStagePresence) window.leaveStagePresence(); };
    }

    let watchId;
    const anchors = CFG.gpsAnchors || [];
    if (!anchors.length || !navigator.geolocation) return;

    watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const dists = anchors.map(a => ({ stageId: a.stageId, dist: _haversineMeters(lat, lng, a.lat, a.lng) }));
      const nearest = dists.sort((a, b) => a.dist - b.dist)[0];
      if (!nearest || nearest.dist > 200) { setLiveState(s => ({ ...s, stage: null, artist: null })); return; }

      const stageObj = (window.STAGES || []).find(s => s.id === nearest.stageId);
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();
      const adjustedMin = (hh < 6 ? hh + 24 : hh) * 60 + mm;

      // Find current night
      let currentNight = null;
      if (CFG.dayDates) {
        const nowMs = Date.now();
        for (const [day, dd] of Object.entries(CFG.dayDates)) {
          const openMs = dd.midnightUtc + 19 * 3600000;
          const closeMs = dd.midnightUtc + (5.5 + 24) * 3600000;
          if (nowMs >= openMs && nowMs <= closeMs) { currentNight = parseInt(day); break; }
        }
      }

      // Find artist playing now at this stage
      let currentArtist = null;
      if (currentNight) {
        for (const a of (window.ARTISTS || [])) {
          if (a.day !== currentNight || a.stage !== nearest.stageId) continue;
          const [sh, sm] = a.start.split(":").map(Number);
          const [eh, em] = a.end.split(":").map(Number);
          const startMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
          const endMin = (eh < 6 ? eh + 24 : eh) * 60 + em;
          if (adjustedMin >= startMin && adjustedMin < endMin) { currentArtist = a; break; }
        }
      }

      setLiveState(s => ({ ...s, stage: stageObj, artist: currentArtist }));
      if (stageObj?.id && window.joinStagePresence) window.joinStagePresence(stageObj.id);
    }, null, { enableHighAccuracy: true, maximumAge: 10000 });

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (window.leaveStagePresence) window.leaveStagePresence();
    };
  }, [isFestivalLive, debugLive]);

  // Listen for presence count updates
  React.useEffect(() => {
    const onPresence = (e) => {
      if (e.detail?.stageId === liveState.stage?.id) {
        setLiveState(s => ({ ...s, usersHere: e.detail.count }));
      }
    };
    window.addEventListener("plursky-presence", onPresence);
    return () => window.removeEventListener("plursky-presence", onPresence);
  }, [liveState.stage?.id]);

  // Pre-fetch tracklist for the current artist so estimatedSong can read it
  const [tracklistReady, setTracklistReady] = React.useState(0);
  React.useEffect(() => {
    if (!liveState.artist?.name) return;
    _getTracklistForArtist(liveState.artist.name).then(() => setTracklistReady(n => n + 1));
  }, [liveState.artist?.name]);

  // Estimated song from tracklist position (debug: pick track from mid-set)
  const estimatedSong = React.useMemo(() => {
    if (!liveState.artist) return null;
    const key = liveState.artist.name.toLowerCase().replace(/\W+/g, "_");
    const cached = _setlistCache[key];
    if (!cached) return null;
    if (debugLive && cached.source === "1001tracklists" && cached.tracks?.length) {
      const t = cached.tracks[Math.floor(cached.tracks.length / 3)];
      const display = t.artist ? `${t.artist} — ${t.title}` : t.title;
      return { song: display, source: "1001tracklists", confidence: "exact (debug)", url: cached.url };
    }
    if (debugLive && cached.source === "setlist.fm" && cached.songs?.length) {
      return { song: cached.songs[Math.floor(cached.songs.length / 3)], source: "setlist.fm", confidence: "estimated (debug)" };
    }
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    return _matchSongAtTime(liveState.artist, cached, now);
  }, [liveState.artist, debugLive, tracklistReady]);

  const [listenProgress, setListenProgress] = React.useState(0);

  const handleShazam = async () => {
    setLiveState(s => ({ ...s, listening: true }));
    setListenProgress(0);
    try {
      // Path 1: Native iOS ShazamKit (10s timeout)
      if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin) {
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000));
        const progressId = setInterval(() => setListenProgress(p => Math.min(p + 10, 95)), 1000);
        try {
          const result = await Promise.race([window.ShazamPlugin.identify(), timeout]);
          clearInterval(progressId);
          if (result?.title) {
            setLiveState(s => ({ ...s, song: { song: `${result.artist} — ${result.title}`, source: "shazam", confidence: "exact" }, listening: false }));
            setListenProgress(100);
            return;
          }
        } catch {
          clearInterval(progressId);
          window.plurskyToast?.("No match — try again closer to a speaker");
        }
      }
      // Path 2: Web audio capture → recognition API (8s with countdown)
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
          const chunks = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          const progressId = setInterval(() => setListenProgress(p => Math.min(p + 12.5, 95)), 1000);
          recorder.onstop = async () => {
            clearInterval(progressId);
            stream.getTracks().forEach(t => t.stop());
            setListenProgress(95);
            const blob = new Blob(chunks, { type: recorder.mimeType });
            try {
              const form = new FormData();
              form.append("audio", blob, "sample.webm");
              const res = await fetch("https://pzoijbqsbbwyuyjinjtj.functions.supabase.co/recognize-song", {
                method: "POST", body: form,
              });
              if (res.ok) {
                const data = await res.json();
                if (data.title) {
                  setLiveState(s => ({ ...s,
                    song: { song: `${data.artist || "?"} — ${data.title}`, source: "web-recognition", confidence: "exact" },
                    listening: false,
                  }));
                  setListenProgress(100);
                  window.plurskyToast?.(`♫ ${data.title}`);
                  return;
                }
              }
            } catch {}
            if (estimatedSong) {
              setLiveState(s => ({ ...s, song: estimatedSong, listening: false }));
            } else {
              setLiveState(s => ({ ...s, listening: false }));
              window.plurskyToast?.("Couldn't identify — try again closer to a speaker");
            }
            setListenProgress(0);
          };
          recorder.start();
          setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 8000);
          return;
        } catch (micErr) {
          if (micErr.name === "NotAllowedError") {
            window.plurskyToast?.("Mic access denied — enable in browser settings");
          }
        }
      }
      // Path 3: Fallback to estimated song from tracklist
      if (estimatedSong) {
        setLiveState(s => ({ ...s, song: estimatedSong, listening: false }));
      } else {
        setLiveState(s => ({ ...s, listening: false }));
      }
    } catch {
      setLiveState(s => ({ ...s, listening: false }));
    }
    setListenProgress(0);
  };

  const handleCapture = () => {
    const song = liveState.song || estimatedSong;
    const momentId = `cap_${Date.now()}`;
    const night = liveState.artist?.day || 1;
    const all = _readMoments();
    all[night] = [...(all[night] || []), {
      id: momentId,
      night,
      artistId: liveState.artist?.id || null,
      takenAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      tagSource: "live_capture",
      createdAt: Date.now(),
      songCapture: song ? { song: song.song, source: song.source || "live" } : null,
      hasGps: true,
    }];
    _writeMoments(all);
    setCaptured(true);
    window.plurskyHaptic?.("MEDIUM");
    setTimeout(() => setCaptured(false), 2000);
  };

  if (!isFestivalLive || !liveState.stage) return null;

  const displaySong = liveState.song || estimatedSong;
  const stageColor = liveState.stage?.color || "var(--horizon)";

  return (
    <div style={{
      position: "fixed", bottom: 64, left: 8, right: 8, zIndex: 900,
      borderRadius: 16, overflow: "hidden",
      background: "rgba(10,6,24,0.92)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 20px ${stageColor}33`,
      padding: "10px 14px",
      animation: "song-fade-in 0.4s ease-out",
    }}>
      {/* Set progress ring — SVG arc showing how far through the set */}
      {liveState.artist && (() => {
        const nowMin = typeof toNightMin === "function" && NOW?.time ? toNightMin(NOW.time) : 0;
        const startMin = typeof toNightMin === "function" ? toNightMin(liveState.artist.start) : 0;
        const endMin = typeof toNightMin === "function" ? toNightMin(liveState.artist.end) : 1;
        const total = Math.max(1, endMin - startMin);
        const elapsed = Math.max(0, nowMin - startMin);
        const pct = Math.min(1, elapsed / total);
        const minsLeft = Math.max(0, Math.round(total - elapsed));
        return (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3, overflow: "hidden", borderRadius: "16px 16px 0 0",
          }}>
            <div style={{
              width: `${pct * 100}%`, height: "100%",
              background: `linear-gradient(90deg, ${stageColor}, ${stageColor}cc)`,
              borderRadius: "0 3px 3px 0",
              transition: "width 30s linear",
              boxShadow: `0 0 8px ${stageColor}`,
            }}/>
            {minsLeft > 0 && minsLeft <= 10 && (
              <div className="mono" style={{
                position: "absolute", right: 6, top: 5, fontSize: 8, letterSpacing: 1,
                color: stageColor, fontWeight: 800, textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              }}>{minsLeft}M LEFT</div>
            )}
          </div>
        );
      })()}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Pulsing live dot + stage info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{
              width: 6, height: 6, borderRadius: 6, background: "#ef4444",
              animation: "pulse 2s infinite",
            }} />
            <span className="mono" style={{
              fontSize: 8, letterSpacing: 1.4, fontWeight: 700, color: stageColor,
            }}>LIVE · {liveState.stage?.name?.toUpperCase()}{liveState.usersHere > 1 ? ` · ${liveState.usersHere} HERE` : ""}</span>
          </div>

          {liveState.artist && (
            <div className="serif" style={{
              fontSize: 14, color: "#fff", lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{liveState.artist.name}</div>
          )}

          {displaySong && (
            <div className="mono" style={{
              fontSize: 8, letterSpacing: 0.6, color: "rgba(255,255,255,0.5)",
              marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ color: stageColor, fontSize: 9 }}>♫</span>
              {displaySong.song}
            </div>
          )}
        </div>

        {/* What's Playing button */}
        <button onClick={handleShazam} disabled={liveState.listening} style={{
          width: 36, height: 36, borderRadius: 36, border: "none", cursor: "pointer",
          background: liveState.listening ? `${stageColor}44` : `${stageColor}22`,
          color: stageColor, fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: liveState.listening ? "pulse 1s infinite" : "none",
          transition: "background 0.2s",
        }} title="What's playing?">
          {liveState.listening ? "..." : "🎵"}
        </button>

        {/* Capture button */}
        <button onClick={handleCapture} style={{
          height: 36, borderRadius: 36, border: "none", cursor: "pointer",
          padding: "0 14px",
          background: captured ? "var(--success)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
          color: "#fff", fontWeight: 700, fontSize: 9, letterSpacing: 1.2,
          display: "flex", alignItems: "center", gap: 5,
          transition: "all 0.3s",
          fontFamily: "Geist Mono, monospace",
        }}>
          {captured ? "✓ SAVED" : "CAPTURE"}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  NowPlayingBar,
  SpotifyScreen, MeScreen, MemoriesScreen, RecapScreen, fetchPreviewUrl,
  archiveFestival, HomeMemoriesStrip,
  ensureSpotifyProfile, getSpotifyProfileSync, createEdcPlaylist,
  startSpotifyAuth, PackListCard,
  _renderCollage, _renderCollageGif, _shareCollage,
  _shareArtistCollage, _shareStageCollage, _shareNightCollage, _shareWeekendCollage, _shareCrewCollage,
  _renderRecapVideo, _shareRecapVideo, _detectBeats, _VIDEO_TEMPLATES,
  _isPlusSub, _setPlusSub, PlusGate, _purchasePlus, _restorePurchases, RC_PRODUCT_IDS, _canShare, _getCustomAccent, _setCustomAccent, _archiveRecap, _getRecapArchive, _canAccessFestival,
  _shareFestivalDNA, _shareFestivalPassport, _shareFilmStrip, _shareCrewComparison,
  _getTracklistForArtist,
});

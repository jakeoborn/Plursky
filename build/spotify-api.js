var APPLE_DEV_TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6Ik5CS0M4MjVOOVcifQ.eyJpc3MiOiJYNTRROVA3NDNTIiwiaWF0IjoxNzgwMDU1MDY0LCJleHAiOjE3OTU4MzIwNjR9.cWXrwsgXT6F3bN_EOVd6kdo8FGSIZDQDTvbbsGIvBuZNqVdXUFwr_4f8lwj_WWLIwiwKiBFQLP26HWbjgpDSnA";
var _mkReady = false;
var _mkLoadP = null;
function _loadMusicKit() {
  if (_mkReady) return Promise.resolve();
  if (_mkLoadP) return _mkLoadP;
  _mkLoadP = new Promise((res, rej) => {
    var s = document.createElement("script");
    s.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
    s.onload = () => {
      _mkReady = true;
      res();
    };
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return _mkLoadP;
}
var _mkConfigured = false;
async function _ensureMusicKitConfigured() {
  if (!APPLE_DEV_TOKEN) throw new Error("not_configured");
  await _loadMusicKit();
  if (!_mkConfigured) {
    await MusicKit.configure({
      developerToken: APPLE_DEV_TOKEN,
      app: {
        name: "Plursky",
        build: "1.0.0"
      }
    });
    _mkConfigured = true;
  }
  return MusicKit.getInstance();
}
var AM_AUTHORIZED_HOSTS = ["plursky.com", "www.plursky.com"];
function _appleMusicOriginOk() {
  try {
    return AM_AUTHORIZED_HOSTS.includes(location.hostname);
  } catch {
    return false;
  }
}
async function connectAppleMusic() {
  if (!APPLE_DEV_TOKEN) return {
    error: "not_configured"
  };
  if (!_appleMusicOriginOk()) {
    return {
      error: "Apple Music connect only works on plursky.com. Open the live site (not localhost) and tap CONNECT there."
    };
  }
  try {
    var music = await _ensureMusicKitConfigured();
    await music.authorize();
    var ut = music.musicUserToken;
    if (!ut) return {
      error: "No user token — authorization may have been denied."
    };
    localStorage.setItem("am_user_token", ut);
    return {
      ok: true
    };
  } catch (e) {
    var msg = e?.message || "";
    if (!msg || /popup|window|blocked|AUTHORIZATION_ERROR/i.test(msg)) {
      return {
        error: "Apple's sign-in window couldn't open. Allow pop-ups for plursky.com, then tap CONNECT again."
      };
    }
    return {
      error: msg
    };
  }
}
function disconnectAppleMusic() {
  localStorage.removeItem("am_user_token");
  if (typeof MusicKit !== "undefined") {
    try {
      MusicKit.getInstance().unauthorize();
    } catch {}
  }
}
async function fetchAppleMusicArtists() {
  var ut = localStorage.getItem("am_user_token");
  if (!ut || !APPLE_DEV_TOKEN) return null;
  var headers = {
    Authorization: `Bearer ${APPLE_DEV_TOKEN}`,
    "Music-User-Token": ut
  };
  var seen = new Set();
  var artists = [];
  var offset = 0;
  try {
    while (true) {
      var res = await fetch(`https://api.music.apple.com/v1/me/library/artists?limit=100&offset=${offset}`, {
        headers
      });
      if (!res.ok) {
        if (res.status === 401) localStorage.removeItem("am_user_token");
        break;
      }
      var json = await res.json();
      var items = json.data || [];
      items.forEach(a => {
        var name = a.attributes?.name;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          artists.push({
            name
          });
        }
      });
      if (!json.next || items.length < 100) break;
      offset += 100;
    }
    return artists;
  } catch {
    return [];
  }
}
function _appleMusicConfigured() {
  return !!APPLE_DEV_TOKEN;
}
function _collectMomentSongs() {
  var all = {};
  try {
    all = typeof _readMoments === "function" ? _readMoments() : window._readMoments?.() || {};
  } catch {}
  var out = [],
    seen = new Set();
  for (var arr of Object.values(all || {})) {
    if (!Array.isArray(arr)) continue;
    var _loop = function (m) {
        if (!m || !m.confirmedTitle && !m.confirmedSong) return 0;
        var title = m.confirmedTitle,
          artist = m.confirmedArtist;
        if (!title && m.confirmedSong) {
          var parts = String(m.confirmedSong).split(" — ");
          if (parts.length >= 2) {
            artist = artist || parts[0];
            title = parts.slice(1).join(" — ");
          } else title = m.confirmedSong;
        }
        if (!artist && m.artistId) {
          var a = (typeof ARTISTS !== "undefined" ? ARTISTS : window.ARTISTS || []).find(x => x.id === m.artistId);
          artist = a?.name || "";
        }
        if (!title) return 0;
        var key = (title + "|" + (artist || "")).toLowerCase().trim();
        if (seen.has(key)) return 0;
        seen.add(key);
        out.push({
          title,
          artist: artist || ""
        });
      },
      _ret;
    for (var m of arr) {
      _ret = _loop(m);
      if (_ret === 0) continue;
    }
  }
  return out;
}
async function createAppleMusicPlaylist(state, opts = {}) {
  var prog = m => {
    if (opts.onProgress) opts.onProgress(m);
  };
  if (!APPLE_DEV_TOKEN) return {
    ok: false,
    reason: "not_configured"
  };
  var ut = null;
  try {
    ut = localStorage.getItem("am_user_token");
  } catch {}
  if (!ut) {
    var c = await connectAppleMusic();
    if (!c.ok) return {
      ok: false,
      reason: "not_connected",
      message: c.error
    };
    try {
      ut = localStorage.getItem("am_user_token");
    } catch {}
  }
  if (!ut) return {
    ok: false,
    reason: "not_connected"
  };
  var devHeaders = {
    Authorization: `Bearer ${APPLE_DEV_TOKEN}`
  };
  var userHeaders = {
    ...devHeaders,
    "Music-User-Token": ut
  };
  var source = opts.source === "attended" ? "attended" : "saved";
  var sourceIds = source === "attended" ? Object.values(window.getAllAttended?.() || {}).flat() : state.saved || [];
  var saved = sourceIds.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean);
  if (!saved.length) return {
    ok: false,
    reason: "empty"
  };
  var timeKey = hhmm => {
    var h = parseInt(hhmm);
    return h < 6 ? h + 24 : h;
  };
  var sorted = [...saved].sort((a, b) => a.day !== b.day ? a.day - b.day : timeKey(a.start) - timeKey(b.start));
  var trackLimit = tier => tier === 3 ? 5 : tier === 2 ? 4 : 3;
  var storefront = "us";
  try {
    var sr = await fetch("https://api.music.apple.com/v1/me/storefront", {
      headers: userHeaders
    });
    if (sr.ok) {
      var sj = await sr.json();
      storefront = sj.data?.[0]?.id || "us";
    }
  } catch {}
  var tracks = [];
  var seen = new Set();
  var missed = 0;
  var songsMatched = 0;
  if (opts.soundtrack) {
    for (var ms of _collectMomentSongs()) {
      prog(`Finding ${ms.title}…`);
      try {
        var term = encodeURIComponent(`${ms.title} ${ms.artist}`.trim());
        var r = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/search?types=songs&limit=5&term=${term}`, {
          headers: devHeaders
        });
        if (!r.ok) continue;
        var s = ((await r.json()).results?.songs?.data || [])[0];
        if (s?.id && !seen.has(s.id)) {
          seen.add(s.id);
          tracks.push({
            id: s.id,
            type: "songs"
          });
          songsMatched++;
        }
      } catch {}
    }
  }
  var _loop2 = async function () {
    prog(`Finding ${a.name}…`);
    try {
      var _r = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/search?types=songs&limit=15&term=${encodeURIComponent(a.name)}`, {
        headers: devHeaders
      });
      if (!_r.ok) {
        missed++;
        return 1;
      }
      var _j = await _r.json();
      var songs = _j.results?.songs?.data || [];
      var ln = a.name.toLowerCase();
      var byArtist = songs.filter(s => (s.attributes?.artistName || "").toLowerCase().includes(ln));
      var pool = byArtist.length ? byArtist : songs.slice(0, 1);
      var added = 0;
      for (var _s of pool) {
        if (added >= trackLimit(a.tier)) break;
        if (_s.id && !seen.has(_s.id)) {
          seen.add(_s.id);
          tracks.push({
            id: _s.id,
            type: "songs"
          });
          added++;
        }
      }
      if (!added) missed++;
    } catch {
      missed++;
    }
  };
  for (var a of sorted) {
    if (await _loop2()) continue;
  }
  if (!tracks.length) return {
    ok: false,
    reason: "no_tracks"
  };
  prog("Creating playlist…");
  var CFG = window.FESTIVAL_CONFIG || {};
  var dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
  var res = await fetch("https://api.music.apple.com/v1/me/library/playlists", {
    method: "POST",
    headers: {
      ...userHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      attributes: {
        name: opts.soundtrack ? `${CFG.shortName || "Festival"} — Your Weekend` : `${CFG.shortName || "Festival"} — Plursky`,
        description: opts.soundtrack ? `${songsMatched} song${songsMatched === 1 ? "" : "s"} you were there for + ${saved.length} sets · built with Plursky · ${dateStr}` : `${saved.length} sets · headliners deep · FRI→SAT→SUN · built with Plursky · ${dateStr}`
      },
      relationships: {
        tracks: {
          data: tracks
        }
      }
    })
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      try {
        localStorage.removeItem("am_user_token");
      } catch {}
      return {
        ok: false,
        reason: "reconnect",
        status: res.status
      };
    }
    return {
      ok: false,
      reason: "create_fail",
      status: res.status
    };
  }
  var id = null;
  try {
    var j = await res.json();
    id = j.data?.[0]?.id || null;
  } catch {}
  var url = id ? `https://music.apple.com/library/playlist/${id}` : null;
  return {
    ok: true,
    service: "apple",
    added: tracks.length,
    missed,
    songsMatched,
    id,
    url
  };
}
if (window.Capacitor?.isNativePlatform()) {
  try {
    window.ShazamPlugin = window.Capacitor.Plugins.ShazamPlugin || null;
  } catch {
    window.ShazamPlugin = null;
  }
} else {
  window.ShazamPlugin = null;
}
var SPOTIFY_CLIENT_ID = "2219c68606c54629a8799f467a996a81";
var SPOTIFY_REDIRECT_WEB = "https://plursky.com/callback";
function _isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.();
}
var SPOTIFY_REDIRECT_NATIVE = "plursky://callback";
function _spotifyRedirectUri() {
  return _isNativeApp() ? SPOTIFY_REDIRECT_NATIVE : SPOTIFY_REDIRECT_WEB;
}
var SPOTIFY_REDIRECT = SPOTIFY_REDIRECT_WEB;
var SPOTIFY_SCOPES = "user-top-read user-read-recently-played user-library-read user-read-private user-read-email user-follow-read playlist-read-private playlist-modify-public playlist-modify-private";
var STAGE_GENRES = {
  kinetic: ["big room", "progressive house", "electro house", "edm", "dutch", "future house", "pop dance"],
  cosmic: ["melodic bass", "future bass", "breakbeat", "big beat", "melodic", "indie electronic"],
  circuit: ["techno", "melodic techno", "minimal techno", "industrial techno", "dark techno", "detroit techno"],
  neon: ["house", "deep house", "afro house", "acid house", "organic house", "microhouse"],
  quantum: ["trance", "psytrance", "uplifting trance", "vocal trance", "progressive trance", "goa"],
  stereo: ["tech house", "bass house", "slap house", "uk house", "underground"],
  bionic: ["indie dance", "nu disco", "french house", "electro", "uk garage", "disco"],
  basspod: ["dubstep", "riddim", "uk bass", "brostep", "drum and bass", "dnb", "liquid dnb", "bass music"],
  waste: ["hardstyle", "hardcore", "uptempo", "hard dance", "gabber", "rawstyle"]
};
function _randString(n) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    var buf = new Uint8Array(n);
    crypto.getRandomValues(buf);
    for (var i = 0; i < n; i++) out += chars[buf[i] % chars.length];
  } else {
    for (var _i = 0; _i < n; _i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
var _SHA256_K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function _sha256js(str) {
  var utf8 = new TextEncoder().encode(str);
  var len = utf8.length;
  var paddedLen = len + 9 + 63 >> 6 << 6;
  var buf = new Uint8Array(paddedLen);
  buf.set(utf8);
  buf[len] = 0x80;
  var bitLen = len * 8;
  buf[paddedLen - 4] = bitLen >>> 24 & 0xff;
  buf[paddedLen - 3] = bitLen >>> 16 & 0xff;
  buf[paddedLen - 2] = bitLen >>> 8 & 0xff;
  buf[paddedLen - 1] = bitLen & 0xff;
  var H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  var W = new Uint32Array(64);
  for (var i = 0; i < paddedLen; i += 64) {
    for (var t = 0; t < 16; t++) {
      W[t] = buf[i + t * 4] << 24 | buf[i + t * 4 + 1] << 16 | buf[i + t * 4 + 2] << 8 | buf[i + t * 4 + 3];
    }
    for (var _t = 16; _t < 64; _t++) {
      var x = W[_t - 15],
        y = W[_t - 2];
      var s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3;
      var s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10;
      W[_t] = W[_t - 16] + s0 + W[_t - 7] + s1 >>> 0;
    }
    var a = H[0],
      b = H[1],
      c = H[2],
      d = H[3],
      e = H[4],
      f = H[5],
      g = H[6],
      h = H[7];
    for (var _t2 = 0; _t2 < 64; _t2++) {
      var S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      var ch = e & f ^ ~e & g;
      var T1 = h + S1 + ch + _SHA256_K[_t2] + W[_t2] >>> 0;
      var S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      var mj = a & b ^ a & c ^ b & c;
      var T2 = S0 + mj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + T1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = T1 + T2 >>> 0;
    }
    H[0] = H[0] + a >>> 0;
    H[1] = H[1] + b >>> 0;
    H[2] = H[2] + c >>> 0;
    H[3] = H[3] + d >>> 0;
    H[4] = H[4] + e >>> 0;
    H[5] = H[5] + f >>> 0;
    H[6] = H[6] + g >>> 0;
    H[7] = H[7] + h >>> 0;
  }
  var out = new Uint8Array(32);
  for (var _i2 = 0; _i2 < 8; _i2++) {
    out[_i2 * 4] = H[_i2] >>> 24 & 0xff;
    out[_i2 * 4 + 1] = H[_i2] >>> 16 & 0xff;
    out[_i2 * 4 + 2] = H[_i2] >>> 8 & 0xff;
    out[_i2 * 4 + 3] = H[_i2] & 0xff;
  }
  return out.buffer;
}
async function _sha256(plain) {
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    try {
      return await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
    } catch {}
  }
  return _sha256js(plain);
}
function _b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function isStandalonePWA() {
  return typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
}
function isMobile() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}
async function _buildSpotifyAuthUrl() {
  var verifier = _randString(128);
  var challenge = _b64url(await _sha256(verifier));
  try {
    localStorage.setItem("spotify_pkce_verifier", verifier);
  } catch {}
  try {
    sessionStorage.setItem("spotify_pkce_verifier", verifier);
  } catch {}
  var params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: _spotifyRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES,
    show_dialog: "true"
  });
  return "https://accounts.spotify.com/authorize?" + params;
}
async function _spotifyExchangeCode(code, redirectUri) {
  var verifier = localStorage.getItem("spotify_pkce_verifier") || sessionStorage.getItem("spotify_pkce_verifier");
  if (!verifier) return {
    error: "session_lost"
  };
  try {
    var res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      })
    });
    var data = await res.json();
    if (!data.access_token) return {
      error: data.error_description || data.error || "no_token"
    };
    try {
      localStorage.setItem("spotify_token", data.access_token);
      localStorage.setItem("spotify_refresh_token", data.refresh_token || "");
      localStorage.setItem("spotify_expires", Date.now() + data.expires_in * 1000);
      if (data.scope) localStorage.setItem("spotify_auth_scopes", data.scope);
      localStorage.removeItem("spotify_pkce_verifier");
      sessionStorage.removeItem("spotify_pkce_verifier");
    } catch {}
    try {
      var profRes = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: "Bearer " + data.access_token
        }
      });
      if (profRes.ok) {
        var p = await profRes.json();
        localStorage.setItem("spotify_profile", JSON.stringify({
          id: p.id,
          name: p.display_name || p.id,
          email: p.email || null,
          image: p.images?.[0]?.url || null,
          country: p.country || null,
          product: p.product || null
        }));
      }
    } catch {}
    return {
      ok: true
    };
  } catch (e) {
    return {
      error: e?.message || "network"
    };
  }
}
var _spotifyNativeHandlerRegistered = false;
function _registerNativeSpotifyHandler() {
  if (_spotifyNativeHandlerRegistered) return;
  var App = window.Capacitor?.Plugins?.App;
  var Browser = window.Capacitor?.Plugins?.Browser;
  if (!App?.addListener) return;
  _spotifyNativeHandlerRegistered = true;
  App.addListener("appUrlOpen", async event => {
    var url = event?.url || "";
    if (!/^plursky:\/\/callback/i.test(url)) return;
    var parsed;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    var code = parsed.searchParams.get("code");
    var error = parsed.searchParams.get("error");
    try {
      await Browser?.close?.();
    } catch {}
    if (error || !code) {
      _spotifyDebugToast("Spotify connect cancelled.", "#9b1c1c");
      try {
        window.dispatchEvent(new CustomEvent("plursky-spotify-connect", {
          detail: {
            error: error || "no_code"
          }
        }));
      } catch {}
      return;
    }
    var {
      error: exErr
    } = await _spotifyExchangeCode(code, SPOTIFY_REDIRECT_NATIVE);
    if (exErr) {
      _spotifyDebugToast("Spotify connect failed: " + exErr, "#9b1c1c");
      try {
        window.dispatchEvent(new CustomEvent("plursky-spotify-connect", {
          detail: {
            error: exErr
          }
        }));
      } catch {}
      return;
    }
    try {
      window.dispatchEvent(new CustomEvent("plursky-spotify-connect", {
        detail: {
          ok: true
        }
      }));
    } catch {}
  });
}
if (typeof window !== "undefined") _registerNativeSpotifyHandler();
var _SPOTIFY_AUTH_URL = null;
var _SPOTIFY_AUTH_ERR = null;
function _prewarmSpotifyAuth() {
  _SPOTIFY_AUTH_URL = null;
  _SPOTIFY_AUTH_ERR = null;
  return _buildSpotifyAuthUrl().then(u => {
    _SPOTIFY_AUTH_URL = u;
  }).catch(e => {
    _SPOTIFY_AUTH_ERR = e;
  });
}
if (typeof window !== "undefined") _prewarmSpotifyAuth();
if (typeof window !== "undefined") {
  try {
    if (!localStorage.getItem("plursky_scope_migration_v80")) {
      localStorage.removeItem("spotify_auth_scopes");
      localStorage.setItem("plursky_scope_migration_v80", "1");
    }
  } catch {}
}
function _spotifyDebugToast(text, color) {
  try {
    var el = document.createElement("div");
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
  if (_isNativeApp()) {
    var Browser = window.Capacitor?.Plugins?.Browser;
    if (!Browser?.open) {
      _spotifyDebugToast("Spotify connect needs an app update.", "#9b1c1c");
      return;
    }
    var go = url => {
      Browser.open({
        url,
        presentationStyle: "popover"
      }).catch(err => {
        _spotifyDebugToast("Spotify connect failed: " + (err?.message || err), "#9b1c1c");
      });
    };
    if (_SPOTIFY_AUTH_URL) {
      go(_SPOTIFY_AUTH_URL);
      return;
    }
    _spotifyDebugToast("Preparing Spotify…", "#1a120d");
    _buildSpotifyAuthUrl().then(go).catch(err => {
      _spotifyDebugToast("Spotify connect failed: " + (err?.message || err), "#9b1c1c");
    });
    return;
  }
  if (isStandalonePWA() && isMobile()) {
    var ack = confirm("Heads up: Spotify login is more reliable in your phone's browser " + "than in this installed app.\n\n" + "Tap OK to continue here (may fail), or Cancel and open plursky.com " + "in Safari/Chrome to connect there first.");
    if (!ack) return;
  }
  if (_SPOTIFY_AUTH_URL) {
    window.location.assign(_SPOTIFY_AUTH_URL);
    return;
  }
  if (_SPOTIFY_AUTH_ERR) {
    _spotifyDebugToast("Spotify init failed: " + (_SPOTIFY_AUTH_ERR.message || _SPOTIFY_AUTH_ERR), "#9b1c1c");
    _prewarmSpotifyAuth();
    return;
  }
  _spotifyDebugToast("Preparing Spotify…", "#1a120d");
  _buildSpotifyAuthUrl().then(url => {
    window.location.assign(url);
  }).catch(err => {
    _spotifyDebugToast("Spotify connect failed: " + (err && err.message ? err.message : "unknown"), "#9b1c1c");
  });
}
function disconnectSpotify(setState, state) {
  ["spotify_token", "spotify_refresh_token", "spotify_expires", "spotify_profile", "spotify_auth_scopes"].forEach(k => localStorage.removeItem(k));
  setState({
    ...state,
    spotifyConnected: false,
    spotifyProfile: null
  });
}
async function getValidToken() {
  var token = localStorage.getItem("spotify_token");
  var expires = localStorage.getItem("spotify_expires");
  if (token && expires && Date.now() < parseInt(expires) - 60000) return token;
  var refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return null;
  try {
    var res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: SPOTIFY_CLIENT_ID
      })
    });
    if (!res.ok) return null;
    var data = await res.json();
    if (!data.access_token) return null;
    localStorage.setItem("spotify_token", data.access_token);
    localStorage.setItem("spotify_expires", Date.now() + data.expires_in * 1000);
    if (data.refresh_token) localStorage.setItem("spotify_refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}
function getSpotifyProfileSync() {
  try {
    var raw = localStorage.getItem("spotify_profile");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function ensureSpotifyProfile() {
  var cached = getSpotifyProfileSync();
  if (cached) return cached;
  var token = await getValidToken();
  if (!token) return null;
  try {
    var res = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: "Bearer " + token
      }
    });
    if (!res.ok) return null;
    var p = await res.json();
    var prof = {
      id: p.id,
      name: p.display_name || p.id,
      email: p.email || null,
      image: p.images?.[0]?.url || null,
      country: p.country || null,
      product: p.product || null
    };
    localStorage.setItem("spotify_profile", JSON.stringify(prof));
    return prof;
  } catch {
    return null;
  }
}
var _ELECTRONIC_HINTS = ["electronic", "dance", "edm", "house", "techno", "trance", "dubstep", "bass", "garage", "hardstyle", "breakbeat", "trap", "electro", "club", "rave", "tech", "ambient", "downtempo", "progressive", "jungle", "phonk", "riddim", "dnb", "drum and bass", "drum & bass", "psytrance", "synthwave", "moombahton", "nu-disco", "disco", "hardcore", "dance-pop"];
function _isElectronicArtist(a) {
  var gs = a?.genres || [];
  if (gs.length === 0) return false;
  return gs.some(g => {
    var lower = String(g).toLowerCase();
    return _ELECTRONIC_HINTS.some(k => lower.includes(k));
  });
}
function _pickArtistMatch(items, ln) {
  if (!items || items.length === 0) return null;
  var byPop = arr => [...arr].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  var exact = items.filter(a => a.name.toLowerCase() === ln);
  if (exact.length) {
    var elec = exact.filter(_isElectronicArtist);
    return (elec.length ? byPop(elec) : byPop(exact))[0];
  }
  var partial = items.filter(a => a.name.toLowerCase().includes(ln) || ln.includes(a.name.toLowerCase()));
  if (partial.length) {
    var _elec = partial.filter(_isElectronicArtist);
    return (_elec.length ? byPop(_elec) : byPop(partial))[0];
  }
  return null;
}
function _hasPlaylistWriteScope() {
  var s = "";
  try {
    s = localStorage.getItem("spotify_auth_scopes") || "";
  } catch {}
  if (!s) return false;
  return s.includes("playlist-modify-public") || s.includes("playlist-modify-private");
}
async function _findPlurskyPlaylist(token, profileId) {
  var fetchWithRetry = async url => {
    var _loop3 = async function () {
        var r = await fetch(url, {
          headers: {
            Authorization: "Bearer " + token
          }
        });
        if (r.status !== 429) return {
          v: r
        };
        var retryAfter = parseInt(r.headers.get("Retry-After") || "2");
        var wait = Math.min(retryAfter * 1000, 4000) + attempt * 500;
        if (attempt < 2) await new Promise(res => setTimeout(res, wait));
      },
      _ret2;
    for (var attempt = 0; attempt < 3; attempt++) {
      _ret2 = await _loop3();
      if (_ret2) return _ret2.v;
    }
    return null;
  };
  var cachedId = null;
  try {
    cachedId = localStorage.getItem("plursky_target_playlist_id");
  } catch {}
  if (cachedId) {
    try {
      var r = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${cachedId}`);
      if (r?.ok) {
        var candidate = await r.json();
        if (candidate?.owner?.id === profileId) return {
          playlist: candidate
        };
      }
    } catch {}
    try {
      localStorage.removeItem("plursky_target_playlist_id");
    } catch {}
  }
  for (var offset = 0; offset < 200; offset += 50) {
    var _r2 = await fetchWithRetry(`https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`);
    if (!_r2) return {
      error: "rate_limited"
    };
    if (!_r2.ok) return {
      error: "fetch_failed",
      status: _r2.status
    };
    var j = await _r2.json();
    var items = j.items || [];
    var found = items.find(p => p?.owner?.id === profileId && typeof p?.name === "string" && p.name.trim().toLowerCase().startsWith("plursky"));
    if (found) return {
      playlist: found
    };
    if (items.length < 50) break;
  }
  return {
    error: "not_found"
  };
}
async function _createPlurskyPlaylist(token, profileId) {
  try {
    var r = await fetch(`https://api.spotify.com/v1/users/${profileId}/playlists`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Plursky",
        description: "Your festival sets · built with Plursky · plursky.com",
        public: false
      })
    });
    if (r.ok) return {
      playlist: await r.json()
    };
    if (r.status === 401 || r.status === 403) return {
      error: "forbidden",
      status: r.status
    };
    return {
      error: "fetch_failed",
      status: r.status
    };
  } catch {
    return {
      error: "fetch_failed",
      status: 0
    };
  }
}
async function createSetsPlaylist(state, opts = {}) {
  var source = opts.source === "attended" ? "attended" : "saved";
  var token = await getValidToken();
  var profile = await ensureSpotifyProfile();
  if (!token || !profile) return {
    ok: false,
    reason: "not_connected"
  };
  if (!_hasPlaylistWriteScope()) return {
    ok: false,
    reason: "reconnect",
    status: 403,
    message: "Need to reconnect for playlist permission"
  };
  var sourceIds = source === "attended" ? Object.values(window.getAllAttended?.() || {}).flat() : state.saved;
  var plan = opts.plan || planBoardPlaylist({
    artists: ARTISTS,
    savedIds: sourceIds,
    maxDiscovery: 0
  });
  var entries = plan.order;
  var seedCount = plan.seeds.length,
    pickCount = plan.picks.length;
  if (seedCount === 0) return {
    ok: false,
    reason: "empty"
  };
  var dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
  var lookup = await _findPlurskyPlaylist(token, profile.id);
  if (lookup.error === "rate_limited") {
    return {
      ok: false,
      reason: "rate_limited",
      message: "Spotify rate limit — wait 30s & retry"
    };
  }
  if (lookup.error === "fetch_failed") {
    if (lookup.status === 401 || lookup.status === 403) {
      ["spotify_token", "spotify_expires", "spotify_auth_scopes"].forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      return {
        ok: false,
        reason: "reconnect",
        status: lookup.status,
        message: "Reconnect required"
      };
    }
    return {
      ok: false,
      reason: "create_fail",
      status: lookup.status,
      message: "Spotify lookup failed"
    };
  }
  var playlist;
  if (lookup.error === "not_found" || !lookup.playlist) {
    var created = await _createPlurskyPlaylist(token, profile.id);
    if (created.playlist) {
      playlist = created.playlist;
    } else if (created.error === "forbidden") {
      return {
        ok: false,
        reason: "no_target_playlist",
        message: "Create empty Spotify playlist named 'Plursky' first"
      };
    } else {
      return {
        ok: false,
        reason: "create_fail",
        status: created.status,
        message: "Couldn't create playlist"
      };
    }
  } else {
    playlist = lookup.playlist;
  }
  try {
    localStorage.setItem("plursky_target_playlist_id", playlist.id);
  } catch {}
  var seenUris = new Set();
  var urisByEntry = entries.map(() => []);
  var missed = 0;
  var missedNames = [];
  var fetchWithRetry = async (url, init) => {
    var _loop4 = async function () {
        var r = await fetch(url, init);
        if (r.status !== 429) return {
          v: r
        };
        var retryAfter = parseInt(r.headers.get("Retry-After") || "2");
        var wait = Math.min(retryAfter * 1000, 4000) + attempt * 500;
        if (attempt < 2) await new Promise(res => setTimeout(res, wait));
      },
      _ret3;
    for (var attempt = 0; attempt < 3; attempt++) {
      _ret3 = await _loop4();
      if (_ret3) return _ret3.v;
    }
    return null;
  };
  var searchOne = async (searchName, limit) => {
    var clean = (typeof _lookupName === "function" ? _lookupName(searchName) : searchName) || searchName;
    try {
      var tr = await fetchWithRetry(`https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:"${clean}"`)}&type=track&limit=10`, {
        headers: {
          Authorization: "Bearer " + token
        }
      });
      if (!tr || !tr.ok) return [];
      var tj = await tr.json();
      var items = tj.tracks?.items || [];
      var ln = clean.toLowerCase();
      var byArtist = new Map();
      for (var t of items) {
        var matched = (t.artists || []).find(a => a.name.toLowerCase() === ln);
        if (!matched) continue;
        if (!byArtist.has(matched.id)) byArtist.set(matched.id, []);
        byArtist.get(matched.id).push(t);
      }
      if (byArtist.size === 0) return [];
      var bestId = null,
        bestCount = 0;
      for (var [id, ts] of byArtist) {
        if (ts.length > bestCount) {
          bestId = id;
          bestCount = ts.length;
        }
      }
      var collected = [];
      for (var _t3 of byArtist.get(bestId)) {
        if (!_t3?.uri || seenUris.has(_t3.uri) || collected.length >= limit) continue;
        seenUris.add(_t3.uri);
        collected.push(_t3.uri);
      }
      return collected;
    } catch {
      return [];
    }
  };
  var search = async (entry, idx) => {
    var parts = _b2bParts(entry.artist.name).map(s => s.trim());
    var total = 0;
    for (var part of parts) {
      var uris = await searchOne(part, entry.trackLimit);
      urisByEntry[idx].push(...uris);
      total += uris.length;
    }
    if (total === 0) {
      missed++;
      missedNames.push(entry.artist.name);
    }
  };
  var _loop5 = async function (i) {
    try {
      opts.onProgress?.(`${Math.min(i + 4, entries.length)}/${entries.length} ARTISTS`);
    } catch {}
    await Promise.all(entries.slice(i, i + 4).map((e, j) => search(e, i + j)));
  };
  for (var i = 0; i < entries.length; i += 4) {
    await _loop5(i);
  }
  var soundtrackUris = [];
  var songsMatched = 0;
  if (opts.soundtrack) {
    for (var ms of _collectMomentSongs()) {
      try {
        opts.onProgress?.(`♫ ${ms.title}`);
      } catch {}
      var q = ms.artist ? `track:"${ms.title}" artist:"${ms.artist}"` : `track:"${ms.title}"`;
      var tr = await fetchWithRetry(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`, {
        headers: {
          Authorization: "Bearer " + token
        }
      });
      if (!tr || !tr.ok) continue;
      var t = ((await tr.json()).tracks?.items || [])[0];
      if (t?.uri && !seenUris.has(t.uri)) {
        seenUris.add(t.uri);
        soundtrackUris.push(t.uri);
        songsMatched++;
      }
    }
  }
  var allUris = [...soundtrackUris, ...urisByEntry.flat()];
  var batches = [];
  for (var _i3 = 0; _i3 < allUris.length; _i3 += 100) batches.push(allUris.slice(_i3, _i3 + 100));
  if (batches.length === 0) batches.push([]);
  var addedCount = 0;
  var writeFailStatus = null;
  for (var _i4 = 0; _i4 < batches.length; _i4++) {
    try {
      var isFirst = _i4 === 0;
      var ar = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: isFirst ? "PUT" : "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uris: batches[_i4]
        })
      });
      if (ar?.ok) addedCount += batches[_i4].length;else if (writeFailStatus === null) writeFailStatus = ar?.status || 429;
    } catch {}
  }
  if (allUris.length > 0 && addedCount === 0 && writeFailStatus) {
    if (writeFailStatus === 401 || writeFailStatus === 403) {
      ["spotify_token", "spotify_expires", "spotify_auth_scopes"].forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      return {
        ok: false,
        reason: "reconnect",
        status: writeFailStatus,
        message: "Reconnect required"
      };
    }
    return {
      ok: false,
      reason: "create_fail",
      status: writeFailStatus,
      message: "Couldn't write tracks"
    };
  }
  var dayLabels = festivalDayNums().map(d => {
    var n = entries.reduce((s, e, i) => s + (e.artist.day === d ? urisByEntry[i].length : 0), 0);
    return n > 0 ? `${FESTIVAL_CONFIG.dayDates[d].short} ${n}` : null;
  }).filter(Boolean);
  if (dayLabels.length > 0) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description: `${seedCount} sets${pickCount ? ` + ${pickCount} picks` : ""} · ${dayLabels.join(" · ")} tracks · headliners 5 songs · built with Plursky · ${dateStr}`
      })
    }).catch(() => {});
  }
  return {
    ok: true,
    added: addedCount,
    total: seedCount,
    picks: pickCount,
    missed,
    missedNames,
    songsMatched,
    entries: entries.map((e, i) => ({
      id: e.artist.id,
      name: e.artist.name,
      role: e.role,
      tracks: urisByEntry[i].length
    })),
    url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    id: playlist.id
  };
}
var createEdcPlaylist = createSetsPlaylist;
async function createHypePlaylist() {
  var token = await getValidToken();
  var profile = await ensureSpotifyProfile();
  if (!token || !profile) return {
    ok: false,
    reason: "not_connected"
  };
  var seen = new Set();
  var artists = [...ARTISTS].sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)).filter(a => {
    var k = a.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  var dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
  var plRes = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: `${FESTIVAL_CONFIG.shortName} 2026 — Pre-Game Hype`,
      description: `${artists.length} acts · 1 track each · headliners first · built with Plursky · ${dateStr}`,
      public: false
    })
  });
  if (!plRes.ok) {
    var err = await plRes.json().catch(() => ({}));
    if (plRes.status === 401 || plRes.status === 403) {
      ["spotify_token", "spotify_expires"].forEach(k => localStorage.removeItem(k));
      return {
        ok: false,
        reason: "reconnect",
        status: plRes.status
      };
    }
    return {
      ok: false,
      reason: "create_fail",
      status: plRes.status,
      message: err.error?.message || ""
    };
  }
  var playlist = await plRes.json();
  var uris = [];
  var missed = 0;
  var searchHypeOne = async searchName => {
    var clean = (typeof _lookupName === "function" ? _lookupName(searchName) : searchName) || searchName;
    try {
      var tr = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(`artist:"${clean}"`)}&type=track&limit=10`, {
        headers: {
          Authorization: "Bearer " + token
        }
      });
      if (!tr.ok) return false;
      var tj = await tr.json();
      var items = tj.tracks?.items || [];
      var ln = clean.toLowerCase();
      var byArtist = new Map();
      for (var t of items) {
        var matched = (t.artists || []).find(a => a.name.toLowerCase() === ln);
        if (!matched) continue;
        if (!byArtist.has(matched.id)) byArtist.set(matched.id, []);
        byArtist.get(matched.id).push(t);
      }
      if (byArtist.size === 0) return false;
      var bestId = null,
        bestCount = 0;
      for (var [id, ts] of byArtist) {
        if (ts.length > bestCount) {
          bestId = id;
          bestCount = ts.length;
        }
      }
      var first = byArtist.get(bestId)[0];
      if (first?.uri) {
        uris.push(first.uri);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };
  var search = async artist => {
    var parts = _b2bParts(artist.name).map(s => s.trim());
    var ok = false;
    for (var part of parts) ok = (await searchHypeOne(part)) || ok;
    if (!ok) missed++;
  };
  for (var i = 0; i < artists.length; i += 6) {
    await Promise.all(artists.slice(i, i + 6).map(search));
  }
  for (var _i5 = 0; _i5 < uris.length; _i5 += 100) {
    await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uris: uris.slice(_i5, _i5 + 100)
      })
    });
  }
  return {
    ok: true,
    added: uris.length,
    total: artists.length,
    missed,
    url: playlist.external_urls?.spotify,
    id: playlist.id
  };
}
async function fetchFollowedEdcArtists(savedIds) {
  var token = await getValidToken();
  if (!token) return [];
  var savedNames = new Set(savedIds.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).flatMap(a => _b2bParts(a.name).map(s => s.trim().toLowerCase())));
  var followedLower = [];
  var after = null;
  for (var page = 0; page < 4; page++) {
    try {
      var url = `https://api.spotify.com/v1/me/following?type=artist&limit=50${after ? "&after=" + after : ""}`;
      var res = await fetch(url, {
        headers: {
          Authorization: "Bearer " + token
        }
      });
      if (!res.ok) break;
      var json = await res.json();
      var items = json.artists?.items || [];
      items.forEach(a => followedLower.push(a.name.toLowerCase()));
      after = json.artists?.cursors?.after;
      if (!after || items.length < 50) break;
    } catch {
      break;
    }
  }
  if (!followedLower.length) return [];
  var result = [];
  var seen = new Set();
  ARTISTS.forEach(a => {
    if (seen.has(a.id)) return;
    var parts = _b2bParts(a.name).map(s => s.trim().toLowerCase());
    var follows = parts.some(p => followedLower.some(f => f === p || f.includes(p) || p.includes(f)));
    if (follows && !savedIds.includes(a.id)) {
      seen.add(a.id);
      result.push(a);
    }
  });
  return result;
}
async function fetchSpotifyTopArtists(onProgress) {
  var _progress = msg => {
    try {
      onProgress?.(msg);
    } catch {}
  };
  var token = await getValidToken();
  if (!token) return [];
  var ranges = [{
    range: "short_term",
    weight: 3
  }, {
    range: "medium_term",
    weight: 2
  }, {
    range: "long_term",
    weight: 1
  }];
  try {
    var responses = await Promise.all(ranges.map(({
      range
    }) => fetch(`https://api.spotify.com/v1/me/top/artists?limit=50&time_range=${range}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })));
    if (responses.some(r => r.status === 401)) {
      ["spotify_token", "spotify_expires"].forEach(k => localStorage.removeItem(k));
      return null;
    }
    _progress("TOP ARTISTS");
    var datas = await Promise.all(responses.map(r => r.ok ? r.json() : {
      items: []
    }));
    var byId = new Map();
    ranges.forEach(({
      weight
    }, i) => {
      (datas[i]?.items || []).forEach((artist, idx) => {
        var score = (51 - (idx + 1)) * weight;
        var cur = byId.get(artist.id);
        if (cur) cur._score += score;else byId.set(artist.id, {
          ...artist,
          _score: score
        });
      });
    });
    var top = Array.from(byId.values()).sort((a, b) => b._score - a._score);
    try {
      var imgs = JSON.parse(localStorage.getItem("artist_images_v1") || "{}");
      top.forEach(a => {
        var url = a.images?.[0]?.url;
        if (url && a.name) imgs[a.name.toLowerCase()] = url;
      });
      localStorage.setItem("artist_images_v1", JSON.stringify(imgs));
    } catch {}
    var seen = new Set(top.map(a => a.id));
    var extras = [];
    var pull = async (url, sourceTag, baseScore) => {
      try {
        var r = await fetch(url, {
          headers: {
            Authorization: "Bearer " + token
          }
        });
        if (!r.ok) return;
        var d = await r.json();
        (d.items || []).forEach(item => {
          (item.track?.artists || []).forEach(a => {
            if (!a?.id || seen.has(a.id)) return;
            seen.add(a.id);
            extras.push({
              id: a.id,
              name: a.name,
              genres: [],
              _score: baseScore,
              _source: sourceTag
            });
          });
        });
      } catch {}
    };
    _progress("LIKED SONGS + FOLLOWING");
    var pullFollowing = async () => {
      var after = null;
      for (var page = 0; page < 4; page++) {
        try {
          var url = `https://api.spotify.com/v1/me/following?type=artist&limit=50${after ? "&after=" + after : ""}`;
          var r = await fetch(url, {
            headers: {
              Authorization: "Bearer " + token
            }
          });
          if (!r.ok) return;
          var d = await r.json();
          var items = d.artists?.items || [];
          items.forEach(a => {
            if (!a?.id || seen.has(a.id)) return;
            seen.add(a.id);
            extras.push({
              id: a.id,
              name: a.name,
              genres: a.genres || [],
              _score: 50,
              _source: "following"
            });
          });
          after = d.artists?.cursors?.after;
          if (!after || items.length < 50) break;
        } catch {
          return;
        }
      }
    };
    await Promise.all([pull("https://api.spotify.com/v1/me/player/recently-played?limit=50", "recent", 60), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=0", "saved", 40), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=50", "saved", 35), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=100", "saved", 30), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=150", "saved", 25), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=200", "saved", 20), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=250", "saved", 15), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=300", "saved", 12), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=350", "saved", 10), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=400", "saved", 8), pull("https://api.spotify.com/v1/me/tracks?limit=50&offset=450", "saved", 6), pullFollowing()]);
    _progress("SCANNING PLAYLISTS");
    var _storedScopes = (() => {
      try {
        return localStorage.getItem("spotify_auth_scopes") || "";
      } catch {
        return "";
      }
    })();
    var _missingScopeRecord = _storedScopes !== "" && !_storedScopes.includes("playlist-read-private");
    var _playlistCount = 0;
    var _playlistScanOk = _missingScopeRecord ? false : false;
    var fetchPlaylistsWithRetry = async url => {
      var _loop6 = async function () {
          var r = await fetch(url, {
            headers: {
              Authorization: "Bearer " + token
            }
          });
          if (r.status !== 429) return {
            v: r
          };
          var retryAfter = parseInt(r.headers.get("Retry-After") || "2");
          var wait = Math.min(retryAfter * 1000, 4000) + attempt * 500;
          if (attempt < 2) await new Promise(res => setTimeout(res, wait));
        },
        _ret4;
      for (var attempt = 0; attempt < 3; attempt++) {
        _ret4 = await _loop6();
        if (_ret4) return _ret4.v;
      }
      return null;
    };
    try {
      var allPlaylists = [];
      var plOffset = 0;
      while (true) {
        var plRes = await fetchPlaylistsWithRetry(`https://api.spotify.com/v1/me/playlists?limit=50&offset=${plOffset}`);
        if (!plRes || !plRes.ok) break;
        _playlistScanOk = true;
        var plData = await plRes.json();
        var items = (plData.items || []).filter(p => p?.id);
        allPlaylists.push(...items);
        if (items.length < 50 || !plData.next) break;
        plOffset += 50;
      }
      _playlistCount = allPlaylists.length;
      var fetchPl = async pl => {
        try {
          var offset = 0;
          while (true) {
            var tr = await fetchPlaylistsWithRetry(`https://api.spotify.com/v1/playlists/${pl.id}/tracks?limit=100&offset=${offset}`);
            if (!tr || !tr.ok) break;
            var td = await tr.json();
            var _items = td.items || [];
            _items.forEach(item => {
              (item.track?.artists || []).forEach(a => {
                if (!a?.id || seen.has(a.id)) return;
                seen.add(a.id);
                extras.push({
                  id: a.id,
                  name: a.name,
                  genres: [],
                  _score: 25,
                  _source: "playlist"
                });
              });
              var title = item.track?.name || "";
              var rxMatch = title.match(/\(\s*([^)]+?)\s+(?:Remix|Edit|Mix|Rework|Bootleg|Flip|VIP)\s*\)/i) || title.match(/\[\s*([^\]]+?)\s+(?:Remix|Edit|Mix|Rework|Bootleg|Flip|VIP)\s*\]/i) || title.match(/\s[-–—]\s+([^-–—]+?)\s+(?:Remix|Edit|Mix|Rework|Bootleg|Flip|VIP)\s*$/i);
              if (rxMatch) {
                var remixerRaw = rxMatch[1].trim();
                remixerRaw.split(/\s*[&,]\s*|\s+(?:x|vs\.?)\s+/i).forEach(rName => {
                  var n = rName.trim();
                  if (!n || seen.has("remix_" + n.toLowerCase())) return;
                  seen.add("remix_" + n.toLowerCase());
                  extras.push({
                    id: "remix_" + n.toLowerCase(),
                    name: n,
                    genres: [],
                    _score: 20,
                    _source: "playlist"
                  });
                });
              }
            });
            if (_items.length < 100 || !td.next) break;
            offset += 100;
          }
        } catch {}
      };
      for (var i = 0; i < allPlaylists.length; i += 6) {
        _progress(`PLAYLIST ${Math.min(i + 6, allPlaylists.length)}/${allPlaylists.length}`);
        await Promise.all(allPlaylists.slice(i, i + 6).map(fetchPl));
      }
    } catch {}
    var result = [...top, ...extras];
    result._playlistCount = _playlistCount;
    result._playlistScanOk = _playlistScanOk;
    var cache = {};
    result.forEach(a => {
      if (a.name) cache[a.name.toLowerCase()] = {
        score: a._score || 0,
        playCount: Math.round((a._score || 0) / 3),
        source: a._source || "top"
      };
    });
    window._spotifyArtistCache = cache;
    return result;
  } catch {
    return [];
  }
}
async function fetchPreviewUrl(artistName) {
  artistName = typeof _lookupName === "function" ? _lookupName(artistName) : artistName;
  var cacheKey = "preview_urls_v1";
  try {
    var cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    var entry = cached[artistName.toLowerCase()];
    if (entry) return entry;
  } catch {}
  var _cachePreview = result => {
    try {
      var _cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");
      _cached[artistName.toLowerCase()] = result;
      localStorage.setItem(cacheKey, JSON.stringify(_cached));
    } catch {}
    return result;
  };
  var token = localStorage.getItem("spotify_token");
  var firstWord = artistName.toLowerCase().split(" ")[0];
  if (token) {
    try {
      var q = encodeURIComponent(artistName);
      var res = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        var data = await res.json();
        var tracks = data.tracks?.items || [];
        var first = tracks.find(t => t.preview_url && t.artists.some(a => a.name.toLowerCase().includes(firstWord))) || tracks.find(t => t.preview_url);
        if (first) return _cachePreview({
          url: first.preview_url,
          name: first.name,
          source: "spotify"
        });
      }
    } catch {}
  }
  try {
    var _q = encodeURIComponent(artistName);
    var _res = await fetch(`https://itunes.apple.com/search?term=${_q}&entity=song&limit=10`);
    if (!_res.ok) return null;
    var _data = await _res.json();
    var results = _data.results || [];
    var _first = results.find(t => t.previewUrl && t.artistName?.toLowerCase().includes(firstWord)) || results.find(t => t.previewUrl);
    return _first ? _cachePreview({
      url: _first.previewUrl,
      name: _first.trackName,
      source: "itunes"
    }) : null;
  } catch {
    return null;
  }
}
function matchLineupArtists(spotifyArtists) {
  if (!spotifyArtists?.length) return [];
  var names = spotifyArtists.map(a => a.name.toLowerCase());
  var result = [];
  var seen = new Set();
  ARTISTS.forEach(a => {
    if (seen.has(a.id)) return;
    var parts = _b2bParts(a.name).map(s => s.trim().toLowerCase());
    var matches = parts.some(part => names.some(n => part.includes(n) || n.includes(part)));
    if (!matches) return;
    seen.add(a.id);
    result.push(a);
  });
  return result;
}
function analyzeGenres(spotifyArtists) {
  var counts = {};
  spotifyArtists.forEach(artist => {
    (artist.genres || []).forEach(g => {
      counts[g] = (counts[g] || 0) + 1;
    });
  });
  var stageScores = {};
  STAGES.forEach(s => {
    stageScores[s.id] = 0;
  });
  Object.entries(counts).forEach(([genre, count]) => {
    Object.entries(STAGE_GENRES).forEach(([sid, keywords]) => {
      if (keywords.some(k => genre.includes(k))) {
        stageScores[sid] = (stageScores[sid] || 0) + count;
      }
    });
  });
  var maxScore = Math.max(...Object.values(stageScores), 1);
  var topGenres = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({
    genre,
    count
  }));
  var stageRecs = Object.entries(stageScores).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, score]) => ({
    stage: STAGES.find(s => s.id === id),
    pct: Math.round(score / maxScore * 100)
  }));
  return {
    topGenres,
    stageRecs
  };
}
function getDiscoveries(spotifyArtists, matched, savedIds, max = 8) {
  if (!spotifyArtists?.length) return [];
  var matchedIds = new Set((matched || []).map(a => a._realId || a.id));
  var savedSet = new Set(savedIds || []);
  var stageProfile = {};
  STAGES.forEach(s => {
    stageProfile[s.id] = 0;
  });
  spotifyArtists.forEach(a => {
    (a.genres || []).forEach(g => {
      Object.entries(STAGE_GENRES).forEach(([sid, kws]) => {
        if (kws.some(k => g.includes(k))) stageProfile[sid] += 1;
      });
    });
  });
  var total = Math.max(1, Object.values(stageProfile).reduce((a, b) => a + b, 0));
  var ranked = Object.entries(stageProfile).sort((a, b) => b[1] - a[1]);
  var topStageId = ranked[0]?.[1] > 0 ? ranked[0][0] : null;
  var scored = ARTISTS.filter(a => !matchedIds.has(a.id) && !savedSet.has(a.id) && a.tier >= 2).map(a => {
    var stageWeight = (stageProfile[a.stage] || 0) / total;
    var tierBonus = a.tier * 0.5;
    var stage = STAGES.find(s => s.id === a.stage);
    var stageShort = stage?.short || stage?.name || a.stage;
    var reason;
    if (a.stage === topStageId && stageWeight > 0) reason = `Your top stage · ${stageShort}`;else if (stageWeight > 0) reason = `Matches your ${stageShort} taste`;else reason = null;
    return {
      artist: {
        ...a,
        _reason: reason
      },
      score: stageWeight * 100 + tierBonus
    };
  });
  var meaningful = scored.filter(s => s.artist._reason);
  return meaningful.sort((a, b) => b.score - a.score).slice(0, max).map(s => s.artist);
}
var BOARD_ADJACENT_MIN = 30;
var BOARD_GAP_MIN = 45;
var BOARD_PICK_TRACKS = 2;
var _boardSeedTracks = tier => tier === 3 ? 5 : tier === 2 ? 4 : 3;
function _boardNightMin(hhmm) {
  if (typeof hhmm !== "string" || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  var [h, m] = hhmm.split(":").map(Number);
  return (h < 8 ? h + 24 : h) * 60 + m;
}
function _boardClock(min) {
  var h = Math.floor(min / 60) % 24,
    m = min % 60;
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
}
function _boardParts(name) {
  var parts = typeof _b2bParts === "function" ? _b2bParts(name) : [String(name || "")];
  return parts.map(s => s.trim().toLowerCase()).filter(Boolean);
}
function planBoardPlaylist({
  artists = [],
  savedIds = [],
  affinityNames = [],
  affinityLabel = "your listening",
  stages = [],
  dayLabel = d => `Day ${d}`,
  maxDiscovery = 8
} = {}) {
  var byId = new Map(artists.map(a => [a.id, a]));
  var stageShort = id => {
    var s = stages.find(x => x.id === id);
    return s?.short || s?.name || id;
  };
  var scheduled = a => a.day != null && _boardNightMin(a.start) != null && _boardNightMin(a.end) != null;
  var sameWeekend = (a, b) => !a.weekend || !b.weekend || a.weekend === "both" || b.weekend === "both" || a.weekend === b.weekend;
  var sameNight = (a, b) => a.day === b.day && sameWeekend(a, b);
  var span = a => {
    var s = _boardNightMin(a.start);
    var e = _boardNightMin(a.end);
    if (e <= s) e += 24 * 60;
    return [s, e];
  };
  var unknownSaved = [],
    dupSaved = [];
  var seeds = [],
    seedNames = new Set();
  for (var id of [...new Set(savedIds)]) {
    var a = byId.get(id);
    if (!a) {
      unknownSaved.push(id);
      continue;
    }
    var key = a.name.trim().toLowerCase();
    if (seedNames.has(key)) {
      dupSaved.push(id);
      continue;
    }
    seedNames.add(key);
    seeds.push({
      artist: a,
      role: "seed",
      kind: "saved",
      reason: "Saved",
      trackLimit: _boardSeedTracks(a.tier)
    });
  }
  var savedIdSet = new Set(savedIds);
  var seedPart = new Map();
  for (var s of seeds) for (var p of _boardParts(s.artist.name)) if (!seedPart.has(p)) seedPart.set(p, s.artist);
  var affinity = new Set(affinityNames.map(n => String(n || "").trim().toLowerCase()).filter(Boolean));
  var stageCounts = {};
  for (var _s2 of seeds) if (_s2.artist.stage) stageCounts[_s2.artist.stage] = (stageCounts[_s2.artist.stage] || 0) + 1;
  var gaps = [];
  var seedSets = seeds.map(s => s.artist).filter(scheduled);
  var _loop7 = function (day) {
    var onDay = seedSets.filter(a => a.day === day);
    var split = onDay.some(a => a.weekend === "W1" || a.weekend === "W2");
    var _loop9 = function (wk) {
      var spans = onDay.filter(a => !wk || !a.weekend || a.weekend === "both" || a.weekend === wk).map(span).sort((x, y) => x[0] - y[0]);
      var reach = null;
      for (var [_s3, e] of spans) {
        if (reach != null && _s3 - reach >= BOARD_GAP_MIN) gaps.push({
          day,
          weekend: wk,
          from: reach,
          to: _s3
        });
        reach = reach == null ? e : Math.max(reach, e);
      }
    };
    for (var wk of split ? ["W1", "W2"] : [null]) {
      _loop9(wk);
    }
  };
  for (var day of [...new Set(seedSets.map(a => a.day))]) {
    _loop7(day);
  }
  var excluded = {
    saved: 0,
    sameAct: 0,
    noSignal: 0,
    dupName: 0
  };
  var best = new Map();
  var _loop8 = function (_a) {
      if (savedIdSet.has(_a.id)) {
        excluded.saved++;
        return 0;
      }
      var parts = _boardParts(_a.name);
      if (!parts.length || seedNames.has(_a.name.trim().toLowerCase()) || parts.every(p => seedPart.has(p))) {
        excluded.sameAct++;
        return 0;
      }
      var tier = _a.tier || 1;
      var pick = null;
      var offer = (kind, score, reason) => {
        if (!pick || score > pick.score) pick = {
          kind,
          score,
          reason
        };
      };
      var heard = parts.find(p => affinity.has(p));
      if (heard) offer("listen", 1000 + tier, `In ${affinityLabel}`);
      var partner = parts.map(p => seedPart.get(p)).find(Boolean);
      if (partner) offer("b2b", 800 + tier, `B2B with ${partner.name}, who you saved`);
      if (scheduled(_a)) {
        var [as, ae] = span(_a);
        for (var _s4 of seeds) {
          var o = _s4.artist;
          if (!scheduled(o) || o.stage !== _a.stage || !sameNight(_a, o)) continue;
          var [os, oe] = span(o);
          if (as >= oe && as - oe <= BOARD_ADJACENT_MIN) offer("adjacent", 600 + tier - (as - oe) / 100, `Right after ${o.name} on ${stageShort(_a.stage)}`);else if (ae <= os && os - ae <= BOARD_ADJACENT_MIN) offer("adjacent", 600 + tier - (os - ae) / 100, `Right before ${o.name} on ${stageShort(_a.stage)}`);
        }
        var hole = gaps.find(g => g.day === _a.day && (!g.weekend || !_a.weekend || _a.weekend === "both" || _a.weekend === g.weekend) && as >= g.from && ae <= g.to);
        if (hole) offer("gap", 400 + tier * 10, `Fills your ${_boardClock(hole.from)}–${_boardClock(hole.to)} gap on ${dayLabel(_a.day)}`);
        if ((stageCounts[_a.stage] || 0) >= 2) offer("stage", 200 + tier * 10 + stageCounts[_a.stage], `On ${stageShort(_a.stage)}, where you saved ${stageCounts[_a.stage]} sets`);
      }
      if (!pick) {
        excluded.noSignal++;
        return 0;
      }
      var key = _a.name.trim().toLowerCase();
      var prev = best.get(key);
      if (prev) excluded.dupName++;
      if (!prev || pick.score > prev.score) best.set(key, {
        artist: _a,
        role: "pick",
        ...pick,
        trackLimit: BOARD_PICK_TRACKS
      });
    },
    _ret5;
  for (var _a of artists) {
    _ret5 = _loop8(_a);
    if (_ret5 === 0) continue;
  }
  var cap = seeds.length ? Math.min(maxDiscovery, Math.max(2, Math.ceil(seeds.length / 2))) : 0;
  var ranked = [...best.values()].sort((x, y) => y.score - x.score || (y.artist.tier || 0) - (x.artist.tier || 0) || (x.artist.day ?? 99) - (y.artist.day ?? 99) || (_boardNightMin(x.artist.start) ?? 9999) - (_boardNightMin(y.artist.start) ?? 9999) || String(x.artist.id).localeCompare(String(y.artist.id)));
  var picks = ranked.slice(0, cap);
  var order = [...seeds, ...picks].sort((x, y) => {
    var xa = x.artist,
      ya = y.artist;
    var xd = xa.day ?? 99,
      yd = ya.day ?? 99;
    if (xd !== yd) return xd - yd;
    var xw = xa.weekend === "W2" ? 1 : 0,
      yw = ya.weekend === "W2" ? 1 : 0;
    if (xw !== yw) return xw - yw;
    var xs = _boardNightMin(xa.start) ?? 9999,
      ys = _boardNightMin(ya.start) ?? 9999;
    if (xs !== ys) return xs - ys;
    if (x.role !== y.role) return x.role === "seed" ? -1 : 1;
    return String(xa.id).localeCompare(String(ya.id));
  });
  var byKind = {};
  for (var _p of picks) byKind[_p.kind] = (byKind[_p.kind] || 0) + 1;
  return {
    seeds,
    picks,
    order,
    cap,
    candidates: ranked,
    diagnostics: {
      lineup: artists.length,
      saved: savedIdSet.size,
      seeds: seeds.length,
      unknownSaved,
      dupSaved,
      gaps: gaps.length,
      candidates: best.size,
      capped: Math.max(0, best.size - picks.length),
      excluded,
      byKind,
      affinityNames: affinity.size
    }
  };
}
Object.assign(window, {
  startSpotifyAuth,
  ensureSpotifyProfile,
  getSpotifyProfileSync,
  createSetsPlaylist,
  createEdcPlaylist,
  fetchPreviewUrl,
  connectAppleMusic,
  disconnectAppleMusic,
  createAppleMusicPlaylist,
  _appleMusicConfigured,
  _ensureMusicKitConfigured,
  _collectMomentSongs,
  planBoardPlaylist
});
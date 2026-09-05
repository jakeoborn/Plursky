var SUPABASE_URL = "https://pzoijbqsbbwyuyjinjtj.supabase.co";
var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2lqYnFzYmJ3eXV5amluanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTY4OTYsImV4cCI6MjA5MjkzMjg5Nn0.193dyHNHbc_zsm6l6UfQnpz4jXqRoPFBC4TWylyFPfA";
var _sb = SUPABASE_URL && SUPABASE_ANON ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON) : null;
async function sbSignInWithSpotify() {
  if (!_sb) return {
    error: "Supabase not configured"
  };
  var {
    error
  } = await _sb.auth.signInWithOAuth({
    provider: "spotify",
    options: {
      scopes: "user-top-read user-read-recently-played user-library-read user-read-private user-read-email user-follow-read playlist-read-private playlist-modify-public playlist-modify-private",
      redirectTo: window.location.origin
    }
  });
  return {
    error: error?.message || null
  };
}
async function _sha256Hex(s) {
  var enc = new TextEncoder().encode(s);
  var buf = await (window.crypto.subtle || window.crypto.webkitSubtle).digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sbSignInWithApple() {
  if (!_sb) return {
    error: "Supabase not configured"
  };
  var cap = window.Capacitor;
  var isNative = !!cap?.isNativePlatform?.();
  var native = cap?.Plugins?.SignInWithApple;
  if (isNative) {
    if (!native) {
      return {
        error: "Sign in with Apple is unavailable on this build."
      };
    }
    try {
      var rawNonce = _randNonce();
      var hashedNonce;
      try {
        hashedNonce = await _sha256Hex(rawNonce);
      } catch {
        hashedNonce = rawNonce;
      }
      var res = await native.authorize({
        clientId: "com.plursky.app",
        redirectURI: "https://plursky.com/",
        scopes: "email name",
        state: "",
        nonce: hashedNonce
      });
      var identityToken = res?.response?.identityToken;
      if (!identityToken) return {
        error: "Apple did not return an identity token."
      };
      try {
        var given = res?.response?.givenName || "";
        var family = res?.response?.familyName || "";
        var full = `${given} ${family}`.trim();
        if (full) localStorage.setItem("plursky_apple_name", full);
      } catch {}
      var out = await _sb.auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
        nonce: rawNonce
      });
      if (out?.error && /nonce|jwt/i.test(out.error.message || "")) {
        out = await _sb.auth.signInWithIdToken({
          provider: "apple",
          token: identityToken
        });
      }
      if (out?.error) {
        try {
          console.warn("[plursky:apple-signin] supabase rejected token:", out.error);
        } catch {}
        return {
          error: out.error.message
        };
      }
      var who = res?.response || {};
      if (who.givenName || who.familyName || who.email) {
        try {
          await _sb.auth.updateUser({
            data: {
              full_name: [who.givenName, who.familyName].filter(Boolean).join(" ") || undefined,
              email: who.email || undefined
            }
          });
        } catch {}
      }
      return {
        error: null
      };
    } catch (e) {
      var msg = e?.message || String(e);
      if (/cancel|1001/i.test(msg) && !/1000/.test(msg)) return {
        error: null,
        cancelled: true
      };
      try {
        console.warn("[plursky:apple-signin] plugin error:", e);
      } catch {}
      return {
        error: msg,
        code: e?.code,
        type: e?.errorMessage || e?.name
      };
    }
  }
  var {
    error
  } = await _sb.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: window.location.origin
    }
  });
  return {
    error: error?.message || null
  };
}
function _randNonce() {
  var a = new Uint8Array(16);
  var c = window.crypto || window.msCrypto;
  if (c?.getRandomValues) c.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
}
async function sbDeleteAccount() {
  if (!_sb) return {
    error: "Supabase not configured"
  };
  var {
    data: {
      session
    }
  } = await _sb.auth.getSession();
  var accessToken = session?.access_token;
  if (!accessToken) return {
    error: "Not signed in."
  };
  try {
    var res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON,
        "content-type": "application/json"
      }
    });
    var body = await res.json().catch(() => ({}));
    if (!res.ok) return {
      error: body?.error || `delete failed (${res.status})`
    };
    try {
      await _sb.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem("plursky_apple_name");
      localStorage.removeItem("spotify_profile");
      localStorage.removeItem("spotify_token");
      localStorage.removeItem("spotify_refresh_token");
      localStorage.removeItem("spotify_expires");
    } catch {}
    return {
      error: null
    };
  } catch (e) {
    return {
      error: e?.message || "network error"
    };
  }
}
async function sbSignOut() {
  if (!_sb) return;
  await _sb.auth.signOut();
}
async function sbGetUser() {
  if (!_sb) return null;
  var {
    data
  } = await _sb.auth.getUser();
  return data?.user || null;
}
function sbOnAuthChange(cb) {
  if (!_sb) return () => {};
  var {
    data
  } = _sb.auth.onAuthStateChange((event, session) => {
    cb(event, session?.user || null, session);
    if (event === "SIGNED_IN" && session?.provider_token) {
      try {
        localStorage.setItem("spotify_token", session.provider_token);
        localStorage.setItem("spotify_expires", String(Date.now() + 3600000));
        if (session.provider_refresh_token) localStorage.setItem("spotify_refresh_token", session.provider_refresh_token);
        fetch("https://api.spotify.com/v1/me", {
          headers: {
            Authorization: "Bearer " + session.provider_token
          }
        }).then(r => r.ok ? r.json() : null).then(p => {
          if (!p) return;
          localStorage.setItem("spotify_profile", JSON.stringify({
            id: p.id,
            name: p.display_name || p.id,
            email: p.email || null,
            image: p.images?.[0]?.url || null,
            country: p.country || null,
            product: p.product || null
          }));
        }).catch(() => {});
      } catch {}
    }
    if (event === "SIGNED_IN") {
      try {
        var meta = session?.user?.user_metadata;
        var name = meta?.full_name || meta?.name;
        if (name) localStorage.setItem("plursky_apple_name", name);
      } catch {}
    }
  });
  return () => data.subscription.unsubscribe();
}
var _MOMENT_LOCAL_FIELDS = ["nativePath", "_fingerprint"];
function _slimMomentsForSync(all) {
  var out = {};
  for (var night of Object.keys(all || {})) {
    var arr = all[night];
    if (!Array.isArray(arr)) continue;
    out[night] = arr.map(m => {
      if (!m || typeof m !== "object") return m;
      var copy = {
        ...m
      };
      for (var f of _MOMENT_LOCAL_FIELDS) delete copy[f];
      return copy;
    });
  }
  return out;
}
var _MOMENTS_SYNC_BUDGET = 2000000;
async function sbPush(artistIds, notes) {
  if (!_sb) return;
  var user = await sbGetUser();
  if (!user) return;
  var row = {
    user_id: user.id,
    updated_at: new Date().toISOString()
  };
  var server = {};
  try {
    var {
      data
    } = await _sb.from("user_data").select("artist_ids, notes, meta").eq("user_id", user.id).single();
    if (data && typeof data === "object") server = data;
  } catch {}
  row.artist_ids = Array.isArray(artistIds) ? artistIds : Array.isArray(server.artist_ids) ? server.artist_ids : [];
  row.notes = notes && typeof notes === "object" ? notes : server.notes && typeof server.notes === "object" ? server.notes : {};
  var serverMeta = server.meta && typeof server.meta === "object" ? server.meta : {};
  row.meta = {
    ...serverMeta
  };
  delete row.meta.momentsSyncWarning;
  try {
    var raw = localStorage.getItem("spotify_profile");
    if (raw) row.meta.spotify = JSON.parse(raw);
  } catch {}
  try {
    var removedRaw = localStorage.getItem("plursky_removed_at_v1");
    if (removedRaw) row.meta.removed_at = JSON.parse(removedRaw);
  } catch {}
  try {
    var momentsRaw = localStorage.getItem("plursky_moments_v1");
    if (momentsRaw) {
      var slim = _slimMomentsForSync(JSON.parse(momentsRaw));
      var size = JSON.stringify(slim).length;
      if (size <= _MOMENTS_SYNC_BUDGET) {
        row.meta.moments = slim;
      } else {
        row.meta.momentsSyncWarning = {
          size,
          budget: _MOMENTS_SYNC_BUDGET,
          at: new Date().toISOString()
        };
      }
    }
  } catch {}
  await _sb.from("user_data").upsert(row);
}
async function sbPushMoments() {
  if (!_sb) return;
  var saved = null,
    notes = null;
  try {
    var fid = window.FESTIVAL_CONFIG && window.FESTIVAL_CONFIG.id;
    var raw = fid ? localStorage.getItem(`${fid}_saved_v1`) : null;
    if (raw) {
      var p = JSON.parse(raw);
      if (Array.isArray(p)) saved = p;
    }
  } catch {}
  try {
    var _raw = localStorage.getItem("artist_notes_v1");
    if (_raw) {
      var _p = JSON.parse(_raw);
      if (_p && typeof _p === "object") notes = _p;
    }
  } catch {}
  await sbPush(saved, notes);
}
function sbMarkRemoved(artistId) {
  try {
    var map = JSON.parse(localStorage.getItem("plursky_removed_at_v1") || "{}");
    map[artistId] = new Date().toISOString();
    localStorage.setItem("plursky_removed_at_v1", JSON.stringify(map));
  } catch {}
}
function sbClearRemoved(artistId) {
  try {
    var map = JSON.parse(localStorage.getItem("plursky_removed_at_v1") || "{}");
    if (map[artistId]) {
      delete map[artistId];
      localStorage.setItem("plursky_removed_at_v1", JSON.stringify(map));
    }
  } catch {}
}
async function sbPull() {
  if (!_sb) return null;
  var user = await sbGetUser();
  if (!user) return null;
  var {
    data
  } = await _sb.from("user_data").select("artist_ids, notes, meta, updated_at").eq("user_id", user.id).single();
  return data || null;
}
async function sbGetArtistSaveCounts(artistIds) {
  if (!_sb || !artistIds?.length) return {};
  var CACHE_TTL = 3600000;
  var now = Date.now();
  var result = {};
  var toFetch = [];
  for (var id of artistIds) {
    try {
      var c = JSON.parse(localStorage.getItem(`sb_sc_${id}`) || "null");
      if (c && now - c.ts < CACHE_TTL) {
        result[id] = c.count;
        continue;
      }
    } catch {}
    toFetch.push(id);
  }
  if (!toFetch.length) return result;
  try {
    var {
      data,
      error
    } = await _sb.rpc("get_artist_save_counts", {
      ids: toFetch
    });
    if (!error && data) {
      for (var row of data) {
        var count = Number(row.save_count);
        result[row.artist_id] = count;
        try {
          localStorage.setItem(`sb_sc_${row.artist_id}`, JSON.stringify({
            count,
            ts: now
          }));
        } catch {}
      }
    }
  } catch {}
  return result;
}
async function sbExportUserData(state) {
  var cloudUser = null;
  try {
    if (window.sbGetUser) cloudUser = await window.sbGetUser();
  } catch {}
  var safeLs = k => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  var parseJson = s => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  var payload = {
    exportedAt: new Date().toISOString(),
    plurskyVersion: safeLs("app_version"),
    festival: window.FESTIVAL_CONFIG?.id || null,
    user: {
      pid: safeLs("plursky_pid"),
      displayName: safeLs("plursky_display_name") || safeLs("user_name"),
      cloudId: cloudUser?.id || null,
      cloudEmail: cloudUser?.email || null,
      spotifyProfile: parseJson(safeLs("spotify_profile"))
    },
    saved: state.saved || [],
    attended: parseJson(safeLs("plursky_attended_v1")) || {},
    moments: parseJson(safeLs("plursky_moments_v1")) || {},
    notes: parseJson(safeLs("artist_notes_v1")) || {},
    crewCode: safeLs("plursky_group_code"),
    settings: {
      reminderLeadMin: parseJson(safeLs("plursky_reminder_lead_min")),
      batterySaver: safeLs("plursky_battery_saver"),
      pinger: safeLs("plursky_pinger_v1")
    },
    keptBothConflicts: parseJson(safeLs("plursky_conflicts_kept_both_v1")) || [],
    blockedPids: parseJson(safeLs("plursky_blocked_pids_v1")) || []
  };
  var json = JSON.stringify(payload, null, 2);
  var blob = new Blob([json], {
    type: "application/json"
  });
  var filename = `plursky-export-${window.FESTIVAL_CONFIG?.id || "festival"}-${Date.now()}.json`;
  var title = "Plursky data export";
  var capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      var dataUrl = await new Promise((resolve, reject) => {
        var r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await capShare.share({
        title,
        files: [dataUrl]
      });
      return;
    } catch (e) {
      if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-share]", e.message);
    }
  }
  if (navigator.share && typeof navigator.canShare === "function") {
    var file = new File([blob], filename, {
      type: "application/json"
    });
    if (navigator.canShare({
      files: [file]
    })) {
      try {
        await navigator.share({
          files: [file],
          title
        });
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
  }
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function AccountCard({
  state,
  setState
}) {
  var configured = !!(SUPABASE_URL && SUPABASE_ANON);
  var [sbUser, setSbUser] = React.useState(null);
  var [appleBusy, setAppleBusy] = React.useState(false);
  var [appleErr, setAppleErr] = React.useState("");
  var [syncing, setSyncing] = React.useState(false);
  var [syncMsg, setSyncMsg] = React.useState("");
  var [deletePhase, setDeletePhase] = React.useState("idle");
  var [deleteErr, setDeleteErr] = React.useState("");
  var [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!configured) return;
    sbGetUser().then(setSbUser);
    return sbOnAuthChange((event, user, session) => {
      setSbUser(user);
      if (event === "SIGNED_IN" && session?.provider_token) {
        setState(st => ({
          ...st,
          spotifyConnected: true
        }));
      }
      if (event === "SIGNED_IN" && user) {
        sbPull().then(cloud => {
          if (!cloud) return;
          setState(st => {
            var cloudRemoved = cloud.meta?.removed_at || {};
            var localRemoved = {};
            try {
              localRemoved = JSON.parse(localStorage.getItem("plursky_removed_at_v1") || "{}");
            } catch {}
            var mergedRemoved = {
              ...cloudRemoved
            };
            Object.entries(localRemoved).forEach(([id, ts]) => {
              if (!mergedRemoved[id] || ts > mergedRemoved[id]) mergedRemoved[id] = ts;
            });
            try {
              localStorage.setItem("plursky_removed_at_v1", JSON.stringify(mergedRemoved));
            } catch {}
            var cloudUpdated = cloud.updated_at || new Date(0).toISOString();
            var union = new Set([...st.saved, ...(cloud.artist_ids || [])]);
            for (var [id, removedAt] of Object.entries(mergedRemoved)) {
              if (removedAt > cloudUpdated) union.delete(id);
            }
            var merged = [...union];
            var localNotes = {};
            try {
              localNotes = JSON.parse(localStorage.getItem("artist_notes_v1") || "{}");
            } catch {}
            var mergedNotes = {
              ...localNotes,
              ...cloud.notes
            };
            try {
              localStorage.setItem("artist_notes_v1", JSON.stringify(mergedNotes));
            } catch {}
            return {
              ...st,
              saved: merged
            };
          });
          try {
            var cloudMoments = cloud.meta?.moments;
            if (cloudMoments && typeof cloudMoments === "object") {
              var local = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
              var added = 0;
              var _loop = function () {
                var localArr = Array.isArray(local[night]) ? local[night] : [];
                var haveIds = new Set(localArr.map(m => m && m.id));
                var restored = (cloudMoments[night] || []).filter(m => m && m.id && !haveIds.has(m.id));
                if (restored.length) {
                  local[night] = [...localArr, ...restored];
                  added += restored.length;
                }
              };
              for (var night of Object.keys(cloudMoments)) {
                _loop();
              }
              if (added) {
                localStorage.setItem("plursky_moments_v1", JSON.stringify(local));
                try {
                  window.dispatchEvent(new Event("plursky-moments-change"));
                } catch {}
              }
            }
          } catch {}
          try {
            var localRaw = localStorage.getItem("plursky_moments_v1");
            if (localRaw && localRaw.length > 2 && window.sbPushMoments) {
              setTimeout(() => {
                try {
                  window.sbPushMoments()?.catch?.(() => {});
                } catch {}
              }, 1500);
            }
          } catch {}
        });
      }
    });
  }, [configured]);
  var handleApple = async () => {
    if (appleBusy) return;
    setAppleBusy(true);
    setAppleErr("");
    try {
      var r = await sbSignInWithApple();
      if (r?.cancelled) return;
      if (r?.error) {
        var detail = r?.code || r?.type ? ` [${r.code || r.type}]` : "";
        var msg = `${r.error}${detail}`;
        try {
          console.error("[plursky:apple-signin]", r);
        } catch {}
        setAppleErr(msg);
      }
    } catch (e) {
      try {
        console.error("[plursky:apple-signin]", e);
      } catch {}
      setAppleErr(e?.message || "Sign in failed");
    } finally {
      setAppleBusy(false);
    }
  };
  var handleSignOut = async () => {
    await sbSignOut();
    setSbUser(null);
  };
  var handleDelete = async () => {
    setDeletePhase("working");
    setDeleteErr("");
    var {
      error
    } = await sbDeleteAccount();
    if (error) {
      setDeletePhase("confirming");
      setDeleteErr(error);
      return;
    }
    setSbUser(null);
    setDeletePhase("idle");
    setState(st => ({
      ...st,
      saved: []
    }));
  };
  var handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    var notes = {};
    try {
      notes = JSON.parse(localStorage.getItem("artist_notes_v1") || "{}");
    } catch {}
    await sbPush(state.saved, notes);
    setSyncing(false);
    setSyncMsg("Saved to cloud ✓");
    setTimeout(() => setSyncMsg(""), 2500);
  };
  var summary = !configured ? "NOT CONFIGURED" : sbUser ? React.createElement("span", {
    style: {
      color: "var(--success)"
    }
  }, "● SYNCED · ", (sbUser.email || sbUser.user_metadata?.full_name || "signed in").toString().slice(0, 22)) : "TAP TO SIGN IN";
  return React.createElement("div", {
    style: {
      marginTop: 20,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 16
    }
  }, React.createElement("button", {
    onClick: () => setExpanded(e => !e),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      marginBottom: expanded ? 14 : 0,
      background: "transparent",
      border: "none",
      padding: 0,
      cursor: "pointer",
      textAlign: "left",
      color: "var(--ink)"
    }
  }, React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: "var(--ink)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--paper)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), React.createElement("path", {
    d: "M4 20 c0-4 3.6-7 8-7 s8 3 8 7"
  }))), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      lineHeight: 1
    }
  }, "Cloud account"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, expanded ? "SYNC LINEUP + NOTES ACROSS DEVICES" : summary)), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--muted)",
      transform: expanded ? "rotate(180deg)" : "none",
      transition: "transform .15s"
    }
  }, "▾")), !expanded ? null : React.createElement(React.Fragment, null, !configured && React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      lineHeight: 1.5
    }
  }, "Add your Supabase URL and anon key to ", React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, "supabase.jsx"), " to enable cloud sync."), configured && sbUser && (() => {
    var sp = (() => {
      try {
        return JSON.parse(localStorage.getItem("spotify_profile") || "null");
      } catch {
        return null;
      }
    })();
    var appleName = (() => {
      try {
        return localStorage.getItem("plursky_apple_name");
      } catch {
        return null;
      }
    })();
    var isApple = sbUser.app_metadata?.provider === "apple";
    var avatar = sp?.image || null;
    var displayName = sp?.name || appleName || sbUser.user_metadata?.full_name || sbUser.email || "?";
    var initial = displayName[0].toUpperCase();
    return React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--paper-2)",
        borderRadius: 10,
        marginBottom: 12
      }
    }, React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 32,
        flexShrink: 0,
        overflow: "hidden",
        background: "linear-gradient(135deg, var(--ember), var(--horizon))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "Instrument Serif, serif",
        fontSize: 15
      }
    }, avatar ? React.createElement("img", {
      src: avatar,
      alt: displayName,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover"
      }
    }) : initial), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: 500,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, displayName), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.1,
        color: "var(--success)",
        marginTop: 2
      }
    }, "● SIGNED IN", sp ? " · SPOTIFY LINKED" : isApple ? " · APPLE" : ""))), React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }
    }, React.createElement("button", {
      onClick: handleSync,
      disabled: syncing,
      style: {
        flex: 1,
        background: syncMsg ? "var(--success)" : "var(--ink)",
        color: "var(--paper)",
        border: "none",
        borderRadius: 10,
        padding: "10px 14px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 600,
        transition: "background 0.3s"
      }
    }, syncing ? "SYNCING…" : syncMsg || `↑ PUSH ${state.saved.length} SETS TO CLOUD`), React.createElement("button", {
      onClick: handleSignOut,
      style: {
        background: "transparent",
        border: "1px solid var(--line-2)",
        borderRadius: 10,
        padding: "10px 14px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        color: "var(--muted)"
      }
    }, "SIGN OUT")), React.createElement("div", {
      style: {
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--line)"
      }
    }, React.createElement("button", {
      onClick: () => sbExportUserData(state),
      style: {
        background: "transparent",
        border: "none",
        padding: "4px 0",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        color: "var(--muted)",
        textDecoration: "underline"
      }
    }, "↓ EXPORT MY DATA")), React.createElement("div", {
      style: {
        marginTop: 10,
        paddingTop: 12,
        borderTop: "1px solid var(--line)"
      }
    }, deletePhase === "idle" && React.createElement("button", {
      onClick: () => {
        setDeletePhase("confirming");
        setDeleteErr("");
      },
      style: {
        background: "transparent",
        border: "none",
        padding: "4px 0",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        color: "var(--muted)",
        textDecoration: "underline"
      }
    }, "DELETE ACCOUNT"), deletePhase !== "idle" && React.createElement("div", {
      style: {
        padding: "10px 12px",
        background: "rgba(232,93,46,0.08)",
        border: "1px solid rgba(232,93,46,0.35)",
        borderRadius: 10
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--ember)",
        marginBottom: 4
      }
    }, "DELETE ACCOUNT?"), React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--ink)",
        lineHeight: 1.45,
        marginBottom: 10
      }
    }, "Permanently removes your saved sets, notes, and sign-in. This can't be undone."), React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, React.createElement("button", {
      onClick: handleDelete,
      disabled: deletePhase === "working",
      style: {
        flex: 1,
        background: "var(--ember)",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "9px 12px",
        cursor: deletePhase === "working" ? "default" : "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 700
      }
    }, deletePhase === "working" ? "DELETING…" : "YES, DELETE EVERYTHING"), React.createElement("button", {
      onClick: () => {
        setDeletePhase("idle");
        setDeleteErr("");
      },
      disabled: deletePhase === "working",
      style: {
        background: "transparent",
        border: "1px solid var(--line-2)",
        borderRadius: 10,
        padding: "9px 14px",
        cursor: deletePhase === "working" ? "default" : "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        color: "var(--muted)"
      }
    }, "CANCEL")), deleteErr && React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#f87171",
        marginTop: 6
      }
    }, deleteErr))));
  })(), configured && !sbUser && React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: handleApple,
    disabled: appleBusy,
    style: {
      width: "100%",
      marginBottom: appleErr ? 6 : 0,
      background: appleBusy ? "#444" : "#000",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "11px 14px",
      cursor: appleBusy ? "default" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontFamily: "Geist, sans-serif",
      fontSize: 14,
      fontWeight: 500
    }
  }, appleBusy ? React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 14,
      border: "2px solid rgba(255,255,255,0.35)",
      borderTopColor: "#fff",
      animation: "spin 0.8s linear infinite",
      display: "inline-block"
    }
  }) : React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 814 1000",
    fill: "white"
  }, React.createElement("path", {
    d: "M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663.1 0 541.8c0-207.5 133.4-317.1 264.5-317.1 70.4 0 128.9 45.5 173 45.5 42.9 0 109.9-48.1 190.5-48.1C500.1 222.2 620.9 240.3 788.1 340.9zM530.4 220.5c-20.1-29.7-47.1-66.8-97.3-66.8-12.1 0-24.2 2.3-35.7 5.1-7.1 1.8-14.1 3.9-21.3 3.9-1.9 0-3.8-.1-5.7-.3 11.4-57.7 56.4-143.4 122.3-180.5 27.9-15.7 59-26.2 91.9-26.2 2.9 0 5.8.1 8.7.3-1 56.1-23.8 117.3-63 164.5z"
  })), appleBusy ? "Signing in…" : "Sign in with Apple"), appleErr && React.createElement("div", {
    style: {
      background: "rgba(248,113,113,0.10)",
      border: "1px solid rgba(248,113,113,0.45)",
      borderRadius: 10,
      padding: "10px 12px",
      marginTop: 10,
      fontSize: 12,
      color: "#c14a4a",
      lineHeight: 1.45
    }
  }, React.createElement("div", {
    style: {
      marginBottom: 6,
      fontWeight: 600
    }
  }, "Couldn't sign in with Apple"), React.createElement("div", {
    style: {
      marginBottom: 8,
      opacity: 0.85,
      fontSize: 11,
      wordBreak: "break-word"
    }
  }, appleErr), React.createElement("button", {
    onClick: handleApple,
    className: "mono",
    style: {
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 999,
      padding: "5px 11px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "TRY AGAIN")))));
}
var PRESENCE_FALLBACK = `presence-${FESTIVAL_CONFIG?.id || "festival"}`;
var PRESENCE_COLORS = ["#e85d2e", "#7b3d9a", "#f59a36", "#6f8fb8", "#2d7a55", "#e85d8f", "#34b4e8", "#a855f7"];
function _presChannelName() {
  var code = null;
  try {
    code = localStorage.getItem("plursky_group_code") || null;
  } catch {}
  return code ? `crew-${code}` : PRESENCE_FALLBACK;
}
function _presColor(id) {
  if (!id) return PRESENCE_COLORS[0];
  var h = 0;
  for (var i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}
function _myPresId() {
  var id;
  try {
    id = localStorage.getItem("plursky_pid");
  } catch {}
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10);
    try {
      localStorage.setItem("plursky_pid", id);
    } catch {}
  }
  return id;
}
var _presCh = null;
var _presCbs = new Set();
var _presSnap = {};
var _presMyId = null;
var _myLoc = null;
var _myRally = null;
var _activeRally = null;
var _rallyCbs = new Set();
var _PRES_STALE_MS = 90000;
function _presPrune() {
  var now = Date.now();
  var changed = false;
  for (var [id, e] of Object.entries(_presSnap)) {
    if (id !== _presMyId && now - (e.ts || 0) > _PRES_STALE_MS) {
      delete _presSnap[id];
      changed = true;
    }
  }
  return changed;
}
function _presNotify() {
  _presPrune();
  var s = {
    ..._presSnap
  };
  _presCbs.forEach(fn => {
    try {
      fn(s);
    } catch {}
  });
}
function _broadcastMyLoc() {
  if (!_presCh || !_myLoc) return;
  try {
    _presCh.send({
      type: "broadcast",
      event: "loc",
      payload: {
        ..._myLoc,
        ts: Date.now()
      }
    });
  } catch {}
}
function sbPresenceJoin({
  name,
  stageId,
  gps
}) {
  if (!_sb) return;
  _presMyId = _myPresId();
  var color = _presColor(_presMyId);
  if (_presCh) {
    _sb.removeChannel(_presCh);
    _presCh = null;
  }
  var pingCode;
  try {
    pingCode = localStorage.getItem("ping_code") || undefined;
  } catch {}
  _myLoc = {
    pid: _presMyId,
    name,
    stageId,
    color,
    pingCode,
    gps,
    ts: Date.now()
  };
  _presCh = _sb.channel(_presChannelName(), {
    config: {
      broadcast: {
        self: false
      }
    }
  });
  _presCh.on("broadcast", {
    event: "loc"
  }, ({
    payload
  }) => {
    if (!payload?.pid || payload.pid === _presMyId) return;
    _presSnap[payload.pid] = payload;
    _presNotify();
  }).on("broadcast", {
    event: "loc-req"
  }, () => {
    _broadcastMyLoc();
    _broadcastMyRally();
  }).on("broadcast", {
    event: "loc-bye"
  }, ({
    payload
  }) => {
    if (payload?.pid && _presSnap[payload.pid]) {
      delete _presSnap[payload.pid];
      _presNotify();
    }
  }).on("broadcast", {
    event: "rally"
  }, ({
    payload
  }) => {
    if (!payload?.rallyId || payload.fromPid === _presMyId) return;
    _activeRally = payload;
    _rallyNotify();
  }).on("broadcast", {
    event: "rally-clear"
  }, ({
    payload
  }) => {
    if (_activeRally && _activeRally.fromPid === payload?.fromPid) {
      _activeRally = null;
      _rallyNotify();
    }
  }).subscribe(async status => {
    if (status === "SUBSCRIBED") {
      _presSnap[_presMyId] = {
        ..._myLoc,
        ts: Date.now()
      };
      _broadcastMyLoc();
      try {
        _presCh.send({
          type: "broadcast",
          event: "loc-req",
          payload: {
            pid: _presMyId
          }
        });
      } catch {}
      _presNotify();
      _startPresenceHeartbeat();
    }
  });
}
async function sbPresenceUpdate(arg) {
  if (!_presCh || !_myLoc) return;
  var patch = typeof arg === "string" ? {
    stageId: arg
  } : arg || {};
  _myLoc = {
    ..._myLoc,
    ...patch,
    ts: Date.now()
  };
  _presSnap[_presMyId] = {
    ..._myLoc
  };
  _broadcastMyLoc();
  _presNotify();
}
var _heartbeatId = null;
function _startPresenceHeartbeat() {
  if (_heartbeatId) clearInterval(_heartbeatId);
  _heartbeatId = setInterval(() => {
    _broadcastMyLoc();
    _broadcastMyRally();
    _presNotify();
  }, 20000);
}
function _stopPresenceHeartbeat() {
  if (_heartbeatId) {
    clearInterval(_heartbeatId);
    _heartbeatId = null;
  }
}
function sbPresenceRefresh() {
  if (!_myLoc) return false;
  sbPresenceJoin({
    name: _myLoc.name,
    stageId: _myLoc.stageId,
    gps: _myLoc.gps
  });
  return true;
}
function sbPresenceLeave() {
  _stopPresenceHeartbeat();
  if (_presCh && _sb) {
    try {
      _presCh.send({
        type: "broadcast",
        event: "loc-bye",
        payload: {
          pid: _presMyId
        }
      });
    } catch {}
    _sb.removeChannel(_presCh);
    _presCh = null;
  }
  _presSnap = {};
  _myLoc = null;
  _myRally = null;
  _activeRally = null;
  _presMyId = null;
  _presNotify();
}
function sbOnPresenceChange(cb) {
  _presCbs.add(cb);
  return () => _presCbs.delete(cb);
}
function _broadcastMyRally() {
  if (!_presCh || !_myRally) return;
  try {
    _presCh.send({
      type: "broadcast",
      event: "rally",
      payload: {
        ..._myRally,
        ts: Date.now()
      }
    });
  } catch {}
}
function _rallyNotify() {
  var r = _activeRally;
  _rallyCbs.forEach(fn => {
    try {
      fn(r);
    } catch {}
  });
}
function sbBroadcastRally({
  x,
  y,
  label,
  stageId
}) {
  if (!_presCh) return false;
  _myRally = {
    rallyId: (_presMyId || "me") + "_" + Date.now(),
    x,
    y,
    label,
    stageId: stageId || null,
    fromPid: _presMyId,
    fromName: _myLoc && _myLoc.name || "Someone"
  };
  _broadcastMyRally();
  return true;
}
function sbClearRally() {
  if (!_myRally) return;
  _myRally = null;
  if (_presCh) {
    try {
      _presCh.send({
        type: "broadcast",
        event: "rally-clear",
        payload: {
          fromPid: _presMyId
        }
      });
    } catch {}
  }
}
function sbOnRally(cb) {
  _rallyCbs.add(cb);
  return () => _rallyCbs.delete(cb);
}
function sbGetMyPresId() {
  return _presMyId || _myPresId();
}
function sbGetPresSnap() {
  return {
    ..._presSnap
  };
}
function sbFindByPingCode(code) {
  var upper = (code || "").trim().toUpperCase();
  if (!upper) return null;
  for (var [id, entry] of Object.entries(_presSnap)) {
    if ((entry.pingCode || "").toUpperCase() === upper) {
      return {
        presId: id,
        name: entry.name,
        stageId: entry.stageId,
        color: entry.color,
        ts: entry.ts
      };
    }
  }
  return null;
}
function FriendsCard({
  state,
  setState
}) {
  var configured = !!(SUPABASE_URL && SUPABASE_ANON);
  var [sharing, setSharing] = React.useState(false);
  var [myName, setMyName] = React.useState(() => {
    try {
      return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || "";
    } catch {
      return "";
    }
  });
  var [stageId, setStageId] = React.useState(() => STAGES?.[0]?.id || "");
  var [editName, setEditName] = React.useState(false);
  var [nameInput, setNameInput] = React.useState("");
  var [snap, setSnap] = React.useState(() => sbGetPresSnap());
  React.useEffect(() => sbOnPresenceChange(setSnap), []);
  React.useEffect(() => {
    if (!myName && state.spotifyConnected) {
      ensureSpotifyProfile().then(p => {
        var first = p?.name?.split(/\s+/)[0] || "";
        if (first && !localStorage.getItem("plursky_display_name")) setMyName(first);
      });
    }
  }, [state.spotifyConnected]);
  var myId = sbGetMyPresId();
  var friends = Object.entries(snap).filter(([id]) => id !== myId).map(([id, e]) => ({
    id,
    ...e
  }));
  var saveName = val => {
    var v = val.trim().slice(0, 20);
    if (!v) return;
    setMyName(v);
    try {
      localStorage.setItem("plursky_display_name", v);
    } catch {}
    setEditName(false);
    setNameInput("");
  };
  var handleToggle = () => {
    if (!sharing) {
      if (!myName) {
        setEditName(true);
        return;
      }
      sbPresenceJoin({
        name: myName,
        stageId
      });
      setSharing(true);
    } else {
      sbPresenceLeave();
      setSharing(false);
    }
  };
  var handleStage = id => {
    setStageId(id);
    if (sharing) sbPresenceUpdate(id);
  };
  if (!configured) {
    var demo = [{
      id: "r",
      name: "Remi",
      color: "#e85d2e",
      stageId: "bionic",
      ts: Date.now() - 60000
    }, {
      id: "j",
      name: "Juno",
      color: "#7b3d9a",
      stageId: "quantum",
      ts: Date.now() - 120000
    }, {
      id: "k",
      name: "Kai",
      color: "#f59a36",
      stageId: "stereo",
      ts: Date.now() - 240000
    }, {
      id: "s",
      name: "Sage",
      color: "#6f8fb8",
      stageId: "circuit",
      ts: Date.now() - 30000
    }];
    return React.createElement(React.Fragment, null, React.createElement(_FriendsHeader, {
      count: 4,
      live: false
    }), React.createElement(_FriendRows, {
      friends: demo,
      state: state,
      setState: setState
    }));
  }
  return React.createElement(React.Fragment, null, React.createElement(_FriendsHeader, {
    count: friends.length,
    live: sharing
  }), React.createElement("div", {
    style: {
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 8,
      background: sharing ? "var(--ink)" : "var(--paper)",
      border: `1px solid ${sharing ? "transparent" : "var(--line)"}`,
      color: sharing ? "var(--paper)" : "var(--ink)",
      transition: "background .2s"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 38,
      flexShrink: 0,
      background: sharing ? _presColor(_presMyId || "x") : "var(--paper-2)",
      border: sharing ? "none" : "1px solid var(--line-2)",
      color: sharing ? "#fff" : "var(--muted)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Instrument Serif, serif",
      fontSize: 18,
      position: "relative"
    }
  }, myName ? myName[0].toUpperCase() : "?", sharing && React.createElement("div", {
    style: {
      position: "absolute",
      bottom: -1,
      right: -1,
      width: 11,
      height: 11,
      borderRadius: 11,
      background: "var(--success)",
      border: "2px solid var(--ink)"
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      lineHeight: 1
    }
  }, myName || "Set your name"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      marginTop: 3,
      textTransform: "uppercase",
      color: sharing ? "rgba(247,237,224,0.55)" : "var(--muted)"
    }
  }, sharing ? (STAGES?.find(s => s.id === stageId)?.name || stageId) + " · LIVE" : "You · tap GO LIVE to share")), React.createElement("button", {
    onClick: handleToggle,
    style: {
      background: sharing ? "rgba(247,237,224,0.15)" : "var(--ember)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "7px 12px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      flexShrink: 0
    }
  }, sharing ? "STOP" : myName ? "GO LIVE" : "SET NAME")), !sharing && editName && React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, React.createElement("input", {
    type: "text",
    value: nameInput,
    onChange: e => setNameInput(e.target.value),
    onKeyDown: e => e.key === "Enter" && saveName(nameInput),
    placeholder: "First name…",
    autoFocus: true,
    maxLength: 20,
    style: {
      flex: 1,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      padding: "8px 12px",
      fontFamily: "Geist, sans-serif",
      fontSize: 14,
      color: "var(--ink)",
      outline: "none"
    }
  }), React.createElement("button", {
    onClick: () => saveName(nameInput),
    style: {
      background: nameInput.trim() ? "var(--ember)" : "var(--paper-2)",
      color: nameInput.trim() ? "#fff" : "var(--muted)",
      border: "none",
      borderRadius: 10,
      padding: "8px 12px",
      cursor: nameInput.trim() ? "pointer" : "default",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, "OK")), sharing && React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1.2,
      color: "rgba(247,237,224,0.45)",
      marginBottom: 6
    }
  }, "CURRENT STAGE"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 5
    }
  }, STAGES?.map(s => React.createElement("button", {
    key: s.id,
    onClick: () => handleStage(s.id),
    style: {
      background: stageId === s.id ? s.color : "rgba(247,237,224,0.08)",
      color: stageId === s.id ? "#fff" : "rgba(247,237,224,0.65)",
      border: `1px solid ${stageId === s.id ? s.color : "rgba(247,237,224,0.18)"}`,
      borderRadius: 999,
      padding: "4px 9px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 8,
      letterSpacing: 1,
      fontWeight: 600,
      transition: "all .12s"
    }
  }, s.name))))), friends.length > 0 ? React.createElement(_FriendRows, {
    friends: friends,
    state: state,
    setState: setState
  }) : React.createElement("div", {
    style: {
      padding: "13px 14px",
      borderRadius: 12,
      background: "var(--paper)",
      border: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)"
    }
  }, "NO FRIENDS ONLINE YET"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      marginTop: 3,
      lineHeight: 1.45
    }
  }, "Share Plursky with your crew — anyone who taps GO LIVE shows up here instantly.")));
}
function _FriendsHeader({
  count,
  live
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 10
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22
    }
  }, "Friends at ", window.FESTIVAL_CONFIG?.brand || "the festival"), live && count > 0 && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--success)"
    }
  }, "● ", count, " LIVE"));
}
function _FriendRows({
  friends,
  state,
  setState
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, friends.map(f => {
    var stage = STAGES?.find(s => s.id === f.stageId);
    var minsAgo = f.ts ? Math.floor((Date.now() - f.ts) / 60000) : null;
    var age = minsAgo == null ? "Live" : minsAgo < 1 ? "Just now" : `${minsAgo}m ago`;
    return React.createElement("div", {
      key: f.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 12
      }
    }, React.createElement("div", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 38,
        background: f.color || "#888",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Instrument Serif, serif",
        fontSize: 18,
        position: "relative",
        flexShrink: 0
      }
    }, (f.name || "?")[0].toUpperCase(), React.createElement("div", {
      style: {
        position: "absolute",
        bottom: -1,
        right: -1,
        width: 11,
        height: 11,
        borderRadius: 11,
        background: "var(--success)",
        border: "2px solid var(--paper)"
      }
    })), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 17,
        lineHeight: 1
      }
    }, f.name || "Friend"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--muted)",
        marginTop: 3,
        textTransform: "uppercase"
      }
    }, stage?.name || f.stageId || "Unknown", " · ", age)), React.createElement("button", {
      onClick: () => setState({
        ...state,
        tab: "map"
      }),
      style: {
        background: "transparent",
        border: "1px solid var(--line-2)",
        borderRadius: 999,
        padding: "6px 10px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--ink)"
      }
    }, "LOCATE"));
  }));
}
var _groupChannels = new Map();
function sbGetOrCreateGroupCode() {
  try {
    var code = localStorage.getItem("plursky_group_code");
    if (!code) {
      code = Math.random().toString(36).slice(2, 8).toUpperCase();
      localStorage.setItem("plursky_group_code", code);
    }
    return code;
  } catch {
    return "PLURSK";
  }
}
function sbGroupJoin(code, {
  pid,
  name,
  artistIds
}, onChange) {
  if (!_sb) return () => {};
  sbGroupLeave(code);
  var members = new Map();
  var entry = {
    ch: null,
    members,
    myState: {
      pid,
      name,
      artistIds
    },
    hb: null
  };
  var ch = _sb.channel(`group-${code}`);
  entry.ch = ch;
  var sendState = () => {
    try {
      ch.send({
        type: "broadcast",
        event: "lineup",
        payload: entry.myState
      });
    } catch {}
  };
  ch.on("broadcast", {
    event: "lineup"
  }, ({
    payload
  }) => {
    if (!payload || !payload.pid || payload.pid === entry.myState.pid) return;
    var isNew = !members.has(payload.pid);
    members.set(payload.pid, {
      name: payload.name,
      artistIds: payload.artistIds || [],
      ts: Date.now()
    });
    onChange?.(new Map(members));
    if (isNew) {
      sendState();
      setTimeout(sendState, 1500);
    }
  }).subscribe(status => {
    if (status !== "SUBSCRIBED") return;
    sendState();
    setTimeout(sendState, 800);
    setTimeout(sendState, 2500);
    entry.hb = setInterval(sendState, 25000);
  });
  _groupChannels.set(code, entry);
  return () => sbGroupLeave(code);
}
function sbGroupLeave(code) {
  var entry = _groupChannels.get(code);
  if (!entry) return;
  try {
    _sb.removeChannel(entry.ch);
  } catch {}
  _groupChannels.delete(code);
}
function sbGroupUpdate(code, payload) {
  var entry = _groupChannels.get(code);
  if (!entry) return;
  entry.myState = payload;
  try {
    entry.ch.send({
      type: "broadcast",
      event: "lineup",
      payload
    });
  } catch {}
}
function sbGetCrewCount(artistId) {
  var myPid = sbGetMyPresId();
  for (var [, entry] of _groupChannels) {
    var n = 0;
    for (var [pid, m] of entry.members) {
      if (pid !== myPid && (m.artistIds || []).includes(artistId)) n++;
    }
    return n;
  }
  return 0;
}
async function sbCrewFetchMessages(code, limit = 50) {
  if (!_sb || !code) return [];
  var {
    data,
    error
  } = await _sb.from("crew_messages").select("id, sender_pid, sender_name, body, created_at").eq("crew_code", code).order("created_at", {
    ascending: false
  }).limit(limit);
  if (error) return [];
  return (data || []).slice().reverse();
}
var OUTBOX_KEY = "plursky_outbox_v1";
function sbOutboxList() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}
function sbOutboxAdd(entry) {
  var list = sbOutboxList();
  list.push({
    id: Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    ts: Date.now(),
    attempts: 0,
    ...entry
  });
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  } catch {}
}
function sbOutboxRemove(id) {
  var list = sbOutboxList().filter(e => e.id !== id);
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  } catch {}
}
function sbOutboxBumpAttempts(id) {
  var list = sbOutboxList();
  var e = list.find(x => x.id === id);
  if (e) {
    e.attempts = (e.attempts || 0) + 1;
  }
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  } catch {}
}
async function _sbCrewInsertRaw(code, pid, name, body) {
  if (!_sb) return {
    error: "no_supabase"
  };
  try {
    var {
      error
    } = await _sb.from("crew_messages").insert({
      crew_code: code,
      sender_pid: pid,
      sender_name: name || "Friend",
      body
    });
    return {
      error: error?.message || null
    };
  } catch (e) {
    return {
      error: e?.message || "network"
    };
  }
}
var _outboxDraining = false;
async function sbOutboxDrain() {
  if (_outboxDraining) return;
  _outboxDraining = true;
  try {
    var list = sbOutboxList();
    for (var e of list) {
      if (e.type !== "crew_msg") continue;
      var {
        error
      } = await _sbCrewInsertRaw(e.code, e.pid, e.name, e.body);
      if (!error) {
        sbOutboxRemove(e.id);
      } else {
        sbOutboxBumpAttempts(e.id);
        break;
      }
    }
  } finally {
    _outboxDraining = false;
  }
}
var _outboxInitialized = false;
function sbOutboxInit() {
  if (typeof window === "undefined" || _outboxInitialized) return;
  _outboxInitialized = true;
  setTimeout(() => {
    if (navigator.onLine) sbOutboxDrain();
  }, 800);
  window.addEventListener("online", () => sbOutboxDrain());
  setInterval(() => {
    if (navigator.onLine) sbOutboxDrain();
  }, 30000);
}
async function sbCrewSendMessage(code, pid, name, body) {
  if (!code) return {
    error: "no_code",
    queued: false
  };
  var trimmed = (body || "").trim().slice(0, 500);
  if (!trimmed) return {
    error: "empty",
    queued: false
  };
  if (!_sb) {
    sbOutboxAdd({
      type: "crew_msg",
      code,
      pid,
      name,
      body: trimmed
    });
    return {
      error: null,
      queued: true
    };
  }
  var {
    error
  } = await _sbCrewInsertRaw(code, pid, name, trimmed);
  if (error) {
    sbOutboxAdd({
      type: "crew_msg",
      code,
      pid,
      name,
      body: trimmed
    });
    return {
      error: null,
      queued: true
    };
  }
  return {
    error: null,
    queued: false
  };
}
function sbCrewSubscribeMessages(code, onMessage) {
  if (!_sb || !code) return () => {};
  var ch = _sb.channel(`crew-msgs-${code}`).on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "crew_messages",
    filter: `crew_code=eq.${code}`
  }, payload => {
    try {
      onMessage?.(payload.new);
    } catch {}
  }).subscribe();
  return () => {
    try {
      _sb.removeChannel(ch);
    } catch {}
  };
}
function sbDMRoomCode(idA, idB) {
  return `dm-${[idA, idB].sort().join("-")}`;
}
async function sbDMFetchMessages(myPid, otherPid, limit = 100) {
  return sbCrewFetchMessages(sbDMRoomCode(myPid, otherPid), limit);
}
async function sbDMSend(myPid, otherPid, myName, body) {
  return sbCrewSendMessage(sbDMRoomCode(myPid, otherPid), myPid, myName, body);
}
function sbDMSubscribe(myPid, otherPid, onMessage) {
  return sbCrewSubscribeMessages(sbDMRoomCode(myPid, otherPid), onMessage);
}
function sbGenerateShareToken() {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  } catch {
    return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  }
}
async function sbLiveShareStart({
  token,
  pid,
  name,
  color,
  expiresAt,
  gps,
  stageId
}) {
  if (!_sb || !token) return {
    error: "no_supabase_or_token"
  };
  var row = {
    token,
    pid,
    name: (name || "Friend").slice(0, 40),
    color: color || null,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    accuracy: gps?.accuracy ?? null,
    stage_id: stageId || null,
    expires_at: new Date(expiresAt).toISOString(),
    updated_at: new Date().toISOString()
  };
  var {
    error
  } = await _sb.from("live_shares").upsert(row, {
    onConflict: "token"
  });
  return {
    error: error?.message || null
  };
}
async function sbLiveShareUpdate(token, partial) {
  if (!_sb || !token) return {
    error: "no_supabase_or_token"
  };
  var update = {
    updated_at: new Date().toISOString()
  };
  if (partial?.gps) {
    update.lat = partial.gps.lat;
    update.lng = partial.gps.lng;
    update.accuracy = partial.gps.accuracy;
  }
  if (partial && "stageId" in partial) update.stage_id = partial.stageId || null;
  if (Object.keys(update).length === 1) return {
    error: null
  };
  var {
    error
  } = await _sb.from("live_shares").update(update).eq("token", token);
  return {
    error: error?.message || null
  };
}
async function sbLiveShareStop(token) {
  if (!_sb || !token) return;
  try {
    await _sb.from("live_shares").delete().eq("token", token);
  } catch {}
}
async function sbLiveShareFetch(token) {
  if (!_sb || !token) return null;
  var {
    data,
    error
  } = await _sb.from("live_shares").select("*").eq("token", token).maybeSingle();
  if (error) return null;
  return data;
}
var BLOCKED_PIDS_KEY = "plursky_blocked_pids_v1";
function sbGetBlockedPids() {
  try {
    var arr = JSON.parse(localStorage.getItem(BLOCKED_PIDS_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function sbIsBlocked(pid) {
  return !!pid && sbGetBlockedPids().includes(pid);
}
function sbBlockPid(pid) {
  if (!pid) return;
  var cur = sbGetBlockedPids();
  if (cur.includes(pid)) return;
  cur.push(pid);
  try {
    localStorage.setItem(BLOCKED_PIDS_KEY, JSON.stringify(cur));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("plursky-blocklist-change"));
  } catch {}
}
function sbUnblockPid(pid) {
  var next = sbGetBlockedPids().filter(p => p !== pid);
  try {
    localStorage.setItem(BLOCKED_PIDS_KEY, JSON.stringify(next));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("plursky-blocklist-change"));
  } catch {}
}
async function sbCrewReportMessage({
  message,
  code,
  reporterPid,
  reporterName,
  reason,
  note
}) {
  if (!_sb) return {
    error: "no_supabase"
  };
  if (!message || !message.id) return {
    error: "no_message"
  };
  if (!reporterPid || reporterPid === message.sender_pid) return {
    error: "self_report"
  };
  var allowedReasons = new Set(["spam", "harassment", "sexual", "violence", "other"]);
  var safeReason = allowedReasons.has(reason) ? reason : "other";
  var body = (message.body || "").slice(0, 600);
  try {
    var {
      error
    } = await _sb.from("crew_message_reports").insert({
      message_id: message.id,
      crew_code: code,
      sender_pid: message.sender_pid,
      sender_name: message.sender_name || "Friend",
      body_snapshot: body,
      reporter_pid: reporterPid,
      reporter_name: (reporterName || "").slice(0, 80) || null,
      reason: safeReason,
      reporter_note: (note || "").trim().slice(0, 500) || null
    });
    return {
      error: error?.message || null
    };
  } catch (e) {
    return {
      error: e?.message || "network"
    };
  }
}
var POLL_RE = /^\[POLL ([a-z0-9]{6,12})\]\s+(.+?)\s+\|\|\s+(.+)$/;
var VOTE_RE = /^\[VOTE ([a-z0-9]{6,12})\]\s+(.+)$/;
function _parsePoll(body) {
  var m = POLL_RE.exec(body || "");
  if (!m) return null;
  var opts = m[3].split("||").map(s => s.trim()).filter(Boolean);
  if (opts.length < 2) return null;
  return {
    id: m[1],
    question: m[2].trim(),
    options: opts
  };
}
function _parseVote(body) {
  var m = VOTE_RE.exec(body || "");
  if (!m) return null;
  return {
    pollId: m[1],
    option: m[2].trim()
  };
}
function _newPollId() {
  return Math.random().toString(36).slice(2, 10);
}
function _formatPollBody(id, question, options) {
  return `[POLL ${id}] ${question} || ${options.join(" || ")}`;
}
function _formatVoteBody(pollId, option) {
  return `[VOTE ${pollId}] ${option}`;
}
function ReportSheet({
  message,
  code,
  reporterPid,
  reporterName,
  onClose,
  onSubmitted
}) {
  var [reason, setReason] = React.useState("harassment");
  var [note, setNote] = React.useState("");
  var [busy, setBusy] = React.useState(false);
  var [err, setErr] = React.useState(null);
  var REASONS = [{
    id: "spam",
    label: "Spam"
  }, {
    id: "harassment",
    label: "Harassment"
  }, {
    id: "sexual",
    label: "Sexual content"
  }, {
    id: "violence",
    label: "Violence or threats"
  }, {
    id: "other",
    label: "Something else"
  }];
  var submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    var {
      error
    } = await sbCrewReportMessage({
      message,
      code,
      reporterPid,
      reporterName,
      reason,
      note
    });
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    onSubmitted?.();
  };
  return React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 12,
      padding: "12px 14px",
      marginBottom: 8,
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "REPORT MESSAGE"), React.createElement("div", {
    style: {
      padding: "8px 10px",
      borderRadius: 8,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      fontSize: 12,
      color: "var(--ink)",
      lineHeight: 1.4,
      maxHeight: 80,
      overflowY: "auto"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1,
      color: "var(--muted)",
      marginBottom: 4
    }
  }, "FROM ", (message.sender_name || "Friend").toUpperCase()), React.createElement("div", {
    style: {
      wordBreak: "break-word"
    }
  }, message.body)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1.1,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "WHY ARE YOU REPORTING?"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 5
    }
  }, REASONS.map(r => {
    var on = reason === r.id;
    return React.createElement("button", {
      key: r.id,
      onClick: () => setReason(r.id),
      style: {
        padding: "7px 11px",
        borderRadius: 999,
        background: on ? "var(--ink)" : "var(--paper)",
        color: on ? "var(--paper)" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9.5,
        letterSpacing: 1,
        fontWeight: 700
      }
    }, r.label);
  })), React.createElement("textarea", {
    value: note,
    onChange: e => setNote(e.target.value.slice(0, 500)),
    placeholder: "Add context (optional)",
    rows: 2,
    style: {
      padding: "8px 10px",
      borderRadius: 8,
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      fontFamily: "Geist",
      fontSize: 12,
      color: "var(--ink)",
      outline: "none",
      resize: "vertical",
      minHeight: 44
    }
  }), err && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--ember)",
      padding: "4px 8px",
      textAlign: "center"
    }
  }, "· ", err.toUpperCase(), " ·"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, React.createElement("button", {
    onClick: onClose,
    disabled: busy,
    style: {
      flex: 1,
      padding: "9px 10px",
      borderRadius: 999,
      background: "var(--paper)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "CANCEL"), React.createElement("button", {
    onClick: submit,
    disabled: busy,
    style: {
      flex: 1,
      padding: "9px 10px",
      borderRadius: 999,
      background: busy ? "var(--paper)" : "var(--ember)",
      color: busy ? "var(--muted)" : "#fff",
      border: "none",
      cursor: busy ? "default" : "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, busy ? "SENDING…" : "SUBMIT REPORT")));
}
function BlockedManager({
  blockedPids,
  recentMsgs,
  onUnblock
}) {
  var [open, setOpen] = React.useState(false);
  var nameForPid = React.useMemo(() => {
    var map = {};
    (recentMsgs || []).forEach(m => {
      if (m.sender_pid && m.sender_name) map[m.sender_pid] = m.sender_name;
    });
    return map;
  }, [recentMsgs]);
  return React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      width: "100%",
      padding: "7px 11px",
      borderRadius: 8,
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      color: "var(--muted)",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, React.createElement("span", null, "🚫 ", blockedPids.length, " BLOCKED"), React.createElement("span", {
    style: {
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform .15s"
    }
  }, "▾")), open && React.createElement("div", {
    style: {
      marginTop: 4,
      padding: 4,
      borderRadius: 8,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, blockedPids.map(pid => {
    var label = nameForPid[pid] || `${pid.slice(0, 8)}…`;
    return React.createElement("div", {
      key: pid,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 8px"
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 12,
        color: "var(--ink)"
      }
    }, label), React.createElement("button", {
      onClick: () => onUnblock(pid),
      style: {
        padding: "4px 9px",
        borderRadius: 999,
        background: "transparent",
        color: "var(--ink)",
        border: "1px solid var(--line-2)",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 8.5,
        letterSpacing: 1,
        fontWeight: 700
      }
    }, "UNBLOCK"));
  })));
}
function CrewChat({
  code,
  myPid,
  myName
}) {
  var [msgs, setMsgs] = React.useState([]);
  var [input, setInput] = React.useState("");
  var [busy, setBusy] = React.useState(false);
  var [loaded, setLoaded] = React.useState(false);
  var [menuMsgId, setMenuMsgId] = React.useState(null);
  var [reportMsg, setReportMsg] = React.useState(null);
  var [reportSent, setReportSent] = React.useState(false);
  var [blockedPids, setBlockedPids] = React.useState(() => sbGetBlockedPids());
  var [online, setOnline] = React.useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  var [queueSize, setQueueSize] = React.useState(() => sbOutboxList().filter(e => e.type === "crew_msg" && e.code === code).length);
  var threadRef = React.useRef(null);
  var inputRef = React.useRef(null);
  React.useEffect(() => {
    var onOnline = () => setOnline(true);
    var onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    var tick = setInterval(() => {
      try {
        var n = sbOutboxList().filter(e => e.type === "crew_msg" && e.code === code).length;
        setQueueSize(prev => prev !== n ? n : prev);
      } catch {}
    }, 1000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(tick);
    };
  }, [code]);
  React.useEffect(() => {
    var refresh = () => setBlockedPids(sbGetBlockedPids());
    window.addEventListener("plursky-blocklist-change", refresh);
    return () => window.removeEventListener("plursky-blocklist-change", refresh);
  }, []);
  var blockedSet = React.useMemo(() => new Set(blockedPids), [blockedPids]);
  React.useEffect(() => {
    setMsgs([]);
    setLoaded(false);
    var cancelled = false;
    sbCrewFetchMessages(code).then(rows => {
      if (cancelled) return;
      setMsgs(prev => {
        var realKeys = new Set(rows.map(r => `${r.sender_pid}::${r.body}`));
        var aliveStubs = prev.filter(m => m.id < 0 && !realKeys.has(`${m.sender_pid}::${m.body}`));
        return [...rows, ...aliveStubs];
      });
      setLoaded(true);
    });
    var unsub = sbCrewSubscribeMessages(code, row => {
      setMsgs(prev => {
        if (prev.some(m => m.id === row.id)) return prev;
        if (row.sender_pid === myPid) {
          var idx = prev.findIndex(m => m.id < 0 && m.sender_pid === myPid && m.body === row.body);
          if (idx >= 0) {
            var next = prev.slice();
            next.splice(idx, 1, row);
            return next;
          }
        }
        return [...prev, row];
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [code, myPid]);
  React.useEffect(() => {
    var el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);
  var visibleMsgs = React.useMemo(() => msgs.filter(m => !blockedSet.has(m.sender_pid)), [msgs, blockedSet]);
  var pollState = React.useMemo(() => {
    var polls = {};
    visibleMsgs.forEach(m => {
      var p = _parsePoll(m.body);
      if (p) polls[p.id] = {
        ...p,
        author_pid: m.sender_pid,
        author_name: m.sender_name,
        ts: m.created_at,
        votes: polls[p.id]?.votes || {}
      };
    });
    visibleMsgs.forEach(m => {
      var v = _parseVote(m.body);
      if (!v) return;
      if (!polls[v.pollId]) return;
      polls[v.pollId].votes[m.sender_pid] = {
        option: v.option,
        ts: m.created_at,
        name: m.sender_name
      };
    });
    return polls;
  }, [visibleMsgs]);
  var [pollOpen, setPollOpen] = React.useState(false);
  var [pollQ, setPollQ] = React.useState("Which stage next?");
  var [pollStageIds, setPollStageIds] = React.useState([]);
  var stagesById = React.useMemo(() => {
    var map = {};
    (window.STAGES || []).forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, []);
  var togglePollStage = id => {
    setPollStageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  var sendPoll = async () => {
    var q = pollQ.trim().slice(0, 120);
    var opts = pollStageIds.map(id => stagesById[id]?.name).filter(Boolean);
    if (!q || opts.length < 2) return;
    var id = _newPollId();
    var body = _formatPollBody(id, q, opts);
    setPollOpen(false);
    setPollStageIds([]);
    await sendBody(body, null);
  };
  var castVote = async (pollId, option) => {
    if (busy) return;
    await sendBody(_formatVoteBody(pollId, option), null);
  };
  var sendBody = async (body, replaceStubId) => {
    setBusy(true);
    try {
      window.plurskyHaptic?.("LIGHT");
    } catch {}
    var optimistic = {
      id: -Date.now() - Math.floor(Math.random() * 1000),
      sender_pid: myPid,
      sender_name: myName,
      body,
      created_at: new Date().toISOString(),
      _pending: true
    };
    if (replaceStubId != null) {
      setMsgs(prev => prev.map(m => m.id === replaceStubId ? optimistic : m));
    } else {
      setMsgs(prev => [...prev, optimistic]);
    }
    var {
      error,
      queued
    } = await sbCrewSendMessage(code, myPid, myName, body);
    if (queued) {
      setMsgs(prev => prev.map(m => m.id === optimistic.id ? {
        ...m,
        _queued: true,
        _pending: false
      } : m));
    } else if (error) {
      setMsgs(prev => prev.map(m => m.id === optimistic.id ? {
        ...m,
        _failed: true,
        _pending: false
      } : m));
    } else {
      setTimeout(() => {
        setMsgs(prev => prev.map(m => m.id === optimistic.id ? {
          ...m,
          _pending: false
        } : m));
      }, 4000);
    }
    setBusy(false);
  };
  var send = async () => {
    var body = input.trim();
    if (!body || busy) return;
    setInput("");
    await sendBody(body, null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  var retry = stub => {
    if (busy) return;
    sendBody(stub.body, stub.id);
  };
  var fmtTime = iso => {
    try {
      var d = new Date(iso);
      return d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };
  return React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 6,
      padding: "0 2px"
    }
  }, "CREW CHAT"), (!online || queueSize > 0) && React.createElement("div", {
    className: "mono",
    style: {
      marginBottom: 6,
      padding: "7px 10px",
      borderRadius: 10,
      background: !online ? "rgba(232,93,46,0.10)" : "var(--paper-2)",
      border: !online ? "1px solid rgba(232,93,46,0.35)" : "1px solid var(--line)",
      color: !online ? "var(--ember)" : "var(--muted)",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, React.createElement("span", null, !online ? "⏱ OFFLINE" : "↑ SENDING"), React.createElement("span", {
    style: {
      color: "var(--muted)",
      fontWeight: 600
    }
  }, "·"), React.createElement("span", null, queueSize, " ", queueSize === 1 ? "MESSAGE" : "MESSAGES", " ", !online ? "QUEUED" : "DRAINING")), React.createElement("div", {
    ref: threadRef,
    style: {
      maxHeight: 280,
      overflowY: "auto",
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "10px 12px",
      marginBottom: 8,
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, !loaded ? React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      textAlign: "center",
      padding: "16px 0"
    }
  }, "LOADING…") : visibleMsgs.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "18px 0"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 4
    }
  }, "QUIET"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      lineHeight: 1.4
    }
  }, msgs.length === 0 ? "Be the first to drop a message." : "All messages are from blocked users.")) : visibleMsgs.map((m, _msgIdx) => {
    var _promoCard = !window._isPlusSub?.() && _msgIdx > 0 && _msgIdx % 15 === 0 ? React.createElement("div", {
      key: `promo-${_msgIdx}`,
      style: {
        padding: "10px 14px",
        borderRadius: 12,
        marginBottom: 6,
        textAlign: "center",
        background: "linear-gradient(135deg, rgba(109,40,217,0.08), rgba(232,93,46,0.08))",
        border: "1px solid rgba(109,40,217,0.12)"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "#6D28D9",
        fontWeight: 700
      }
    }, "✨ PLURSKY+ · CREW SHOWDOWN · FESTIVAL DNA · NO WATERMARKS"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        color: "var(--muted)",
        marginTop: 3
      }
    }, "$14.99 · SEASON PASS")) : null;
    if (_parseVote(m.body)) return null;
    var parsedPoll = _parsePoll(m.body);
    var mine = m.sender_pid === myPid;
    var menuOpen = menuMsgId === m.id;
    if (parsedPoll) {
      var live = pollState[parsedPoll.id];
      var tally = {};
      var totalVotes = 0;
      parsedPoll.options.forEach(opt => {
        tally[opt] = 0;
      });
      var myVote = live?.votes?.[myPid]?.option;
      if (live) {
        Object.values(live.votes).forEach(v => {
          if (tally[v.option] != null) {
            tally[v.option] += 1;
            totalVotes += 1;
          }
        });
      }
      return React.createElement(React.Fragment, {
        key: m.id
      }, _promoCard, React.createElement("div", {
        style: {
          background: "var(--paper-2)",
          borderRadius: 14,
          padding: "12px 14px",
          margin: "4px 0",
          border: "1px solid var(--line)"
        }
      }, React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8.5,
          letterSpacing: 1.2,
          color: "var(--muted)",
          fontWeight: 700,
          marginBottom: 6
        }
      }, "POLL · ", (m.sender_name || "Friend").toUpperCase()), React.createElement("div", {
        className: "serif",
        style: {
          fontSize: 16,
          marginBottom: 10
        }
      }, parsedPoll.question), React.createElement("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 6
        }
      }, parsedPoll.options.map(opt => {
        var count = tally[opt] || 0;
        var pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
        var onMine = myVote === opt;
        return React.createElement("button", {
          key: opt,
          onClick: () => castVote(parsedPoll.id, opt),
          style: {
            position: "relative",
            overflow: "hidden",
            padding: "8px 12px",
            borderRadius: 10,
            background: "var(--paper)",
            border: onMine ? "1px solid var(--ember)" : "1px solid var(--line-2)",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--ink)"
          }
        }, React.createElement("div", {
          style: {
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: onMine ? "rgba(232,93,46,0.16)" : "rgba(123,61,154,0.12)",
            transition: "width 0.3s"
          }
        }), React.createElement("span", {
          style: {
            position: "relative",
            width: 14,
            height: 14,
            borderRadius: 14,
            border: onMine ? "4px solid var(--ember)" : "1.5px solid var(--line-2)",
            background: onMine ? "var(--paper)" : "transparent",
            flexShrink: 0
          }
        }), React.createElement("span", {
          style: {
            position: "relative",
            flex: 1,
            fontFamily: "Geist",
            fontSize: 13,
            fontWeight: 500
          }
        }, opt), React.createElement("span", {
          className: "mono",
          style: {
            position: "relative",
            fontSize: 9,
            letterSpacing: 1.1,
            fontWeight: 700,
            color: count > 0 ? "var(--ink)" : "var(--muted)"
          }
        }, count > 0 ? `${count} · ${pct}%` : "—"));
      })), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 0.8,
          color: "var(--muted)",
          marginTop: 8,
          textAlign: "right"
        }
      }, totalVotes, " ", totalVotes === 1 ? "VOTE" : "VOTES", " · ", fmtTime(m.created_at))));
    }
    return React.createElement(React.Fragment, {
      key: m.id
    }, _promoCard, React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: mine ? "flex-end" : "flex-start"
      }
    }, !mine && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8.5,
        letterSpacing: 1,
        color: "var(--muted)",
        marginBottom: 2,
        padding: "0 4px"
      }
    }, (m.sender_name || "Friend").toUpperCase()), React.createElement("div", {
      onClick: m._failed ? () => retry(m) : undefined,
      style: {
        maxWidth: "80%",
        padding: "7px 11px",
        borderRadius: 12,
        background: mine ? "var(--ink)" : "var(--paper-2)",
        color: mine ? "var(--paper)" : "var(--ink)",
        fontSize: 13,
        lineHeight: 1.4,
        opacity: m._pending ? 0.55 : m._queued ? 0.75 : 1,
        border: m._failed ? "1px solid var(--ember)" : m._queued ? "1px dashed var(--line-2)" : "none",
        cursor: m._failed ? "pointer" : "default",
        wordBreak: "break-word"
      }
    }, m.body), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 0.8,
        color: m._failed ? "var(--ember)" : "var(--muted)",
        marginTop: 2,
        padding: "0 4px",
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, React.createElement("span", null, m._failed ? "FAILED · TAP TO RETRY" : m._queued ? "⏱ QUEUED · WILL SEND WHEN ONLINE" : fmtTime(m.created_at)), !mine && !m._pending && !m._failed && !m._queued && React.createElement("button", {
      onClick: () => setMenuMsgId(menuOpen ? null : m.id),
      "aria-label": "Message options",
      title: "Report or block",
      style: {
        background: "transparent",
        border: "none",
        padding: "2px 6px",
        borderRadius: 8,
        color: "var(--muted)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        letterSpacing: 1,
        minHeight: 18,
        lineHeight: 1
      }
    }, "⋯")), menuOpen && !mine && React.createElement("div", {
      style: {
        marginTop: 6,
        padding: 6,
        borderRadius: 12,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 200,
        maxWidth: "85%"
      }
    }, React.createElement("button", {
      onClick: () => {
        setReportMsg(m);
        setMenuMsgId(null);
      },
      style: {
        padding: "9px 12px",
        borderRadius: 8,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--ink)",
        textAlign: "left",
        fontFamily: "inherit",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("span", {
      "aria-hidden": true,
      style: {
        fontSize: 13
      }
    }, "🚩"), React.createElement("span", null, "Report message")), React.createElement("button", {
      onClick: () => {
        sbBlockPid(m.sender_pid);
        setMenuMsgId(null);
      },
      style: {
        padding: "9px 12px",
        borderRadius: 8,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--ember)",
        textAlign: "left",
        fontFamily: "inherit",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("span", {
      "aria-hidden": true,
      style: {
        fontSize: 13
      }
    }, "🚫"), React.createElement("span", null, "Block ", m.sender_name || "Friend")), React.createElement("button", {
      onClick: () => setMenuMsgId(null),
      style: {
        padding: "9px 12px",
        borderRadius: 8,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--muted)",
        textAlign: "left",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9.5,
        letterSpacing: 1.2,
        fontWeight: 700
      }
    }, "CANCEL"))));
  })), reportMsg && React.createElement(ReportSheet, {
    message: reportMsg,
    code: code,
    reporterPid: myPid,
    reporterName: myName,
    onClose: () => setReportMsg(null),
    onSubmitted: () => {
      setReportMsg(null);
      setReportSent(true);
      setTimeout(() => setReportSent(false), 2400);
    }
  }), reportSent && React.createElement("div", {
    style: {
      padding: "8px 12px",
      marginBottom: 8,
      borderRadius: 10,
      background: "rgba(45,122,85,0.12)",
      color: "var(--success)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9.5,
      letterSpacing: 1.2,
      textAlign: "center",
      fontWeight: 700
    }
  }, "✓ REPORTED · WE REVIEW WITHIN 24H"), blockedPids.length > 0 && React.createElement(BlockedManager, {
    blockedPids: blockedPids,
    recentMsgs: msgs,
    onUnblock: pid => sbUnblockPid(pid)
  }), pollOpen && React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 12,
      padding: "10px 12px",
      marginBottom: 8,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "NEW POLL"), React.createElement("input", {
    value: pollQ,
    onChange: e => setPollQ(e.target.value),
    maxLength: 120,
    style: {
      padding: "8px 10px",
      borderRadius: 8,
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      fontFamily: "Geist",
      fontSize: 13,
      color: "var(--ink)",
      outline: "none"
    }
  }), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1.1,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "PICK 2–6 STAGES"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 4
    }
  }, (window.STAGES || []).map(s => {
    var on = pollStageIds.includes(s.id);
    return React.createElement("button", {
      key: s.id,
      onClick: () => togglePollStage(s.id),
      style: {
        padding: "6px 4px",
        borderRadius: 8,
        background: on ? s.color : "var(--paper)",
        color: on ? "#fff" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 8,
        letterSpacing: 0.8,
        fontWeight: on ? 700 : 500,
        cursor: "pointer"
      }
    }, s.short);
  })), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, React.createElement("button", {
    onClick: () => {
      setPollOpen(false);
      setPollStageIds([]);
    },
    style: {
      flex: 1,
      padding: "8px 10px",
      borderRadius: 999,
      background: "var(--paper)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "CANCEL"), React.createElement("button", {
    disabled: !pollQ.trim() || pollStageIds.length < 2 || pollStageIds.length > 6 || busy,
    onClick: sendPoll,
    style: {
      flex: 1,
      padding: "8px 10px",
      borderRadius: 999,
      background: pollQ.trim() && pollStageIds.length >= 2 && pollStageIds.length <= 6 ? "var(--ember)" : "var(--paper)",
      color: pollQ.trim() && pollStageIds.length >= 2 && pollStageIds.length <= 6 ? "#fff" : "var(--muted)",
      border: pollQ.trim() && pollStageIds.length >= 2 && pollStageIds.length <= 6 ? "none" : "1px solid var(--line-2)",
      cursor: pollQ.trim() && pollStageIds.length >= 2 && pollStageIds.length <= 6 ? "pointer" : "default",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9.5,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "SEND POLL"))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, React.createElement("button", {
    onClick: () => setPollOpen(o => !o),
    title: "Create a poll",
    "aria-label": "Poll",
    style: {
      padding: "9px 11px",
      borderRadius: 10,
      background: pollOpen ? "var(--ink)" : "var(--paper-2)",
      color: pollOpen ? "var(--paper)" : "var(--ink)",
      border: pollOpen ? "none" : "1px solid var(--line-2)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, "📊"), React.createElement("input", {
    ref: inputRef,
    type: "text",
    value: input,
    maxLength: 500,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") send();
    },
    placeholder: "Message your crew…",
    style: {
      flex: 1,
      padding: "9px 12px",
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      fontFamily: "inherit",
      fontSize: 13,
      color: "var(--ink)",
      outline: "none"
    }
  }), React.createElement("button", {
    onClick: send,
    disabled: !input.trim() || busy,
    style: {
      padding: "9px 14px",
      background: input.trim() && !busy ? "var(--ember)" : "var(--paper-2)",
      color: input.trim() && !busy ? "#fff" : "var(--muted)",
      border: "none",
      borderRadius: 10,
      cursor: input.trim() && !busy ? "pointer" : "default",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, "SEND")));
}
function CrewCard({
  state
}) {
  var configured = !!(SUPABASE_URL && SUPABASE_ANON);
  var [code, setCode] = React.useState(() => sbGetOrCreateGroupCode());
  var [joined, setJoined] = React.useState(false);
  var [members, setMembers] = React.useState(new Map());
  var [codeInput, setCodeInput] = React.useState("");
  var [joining, setJoining] = React.useState(false);
  var [copied, setCopied] = React.useState(false);
  var [expanded, setExpanded] = React.useState(false);
  var [expandedPid, setExpandedPid] = React.useState(null);
  var [totemUrl, setTotemUrl] = React.useState(null);
  var totemInputRef = React.useRef(null);
  var leaveRef = React.useRef(null);
  var myPid = sbGetMyPresId();
  var myName = (() => {
    try {
      return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || "Me";
    } catch {
      return "Me";
    }
  })();
  var joinCrew = c => {
    var newCode = (c || code).toUpperCase().trim().slice(0, 6);
    if (newCode.length < 4) return;
    setCode(newCode);
    try {
      localStorage.setItem("plursky_group_code", newCode);
    } catch {}
    if (leaveRef.current) leaveRef.current();
    leaveRef.current = sbGroupJoin(newCode, {
      pid: myPid,
      name: myName,
      artistIds: state.saved
    }, setMembers);
    setJoined(true);
    setJoining(false);
    setCodeInput("");
    setExpanded(true);
    sbPresenceRefresh();
  };
  React.useEffect(() => {
    if (joined) sbGroupUpdate(code, {
      pid: myPid,
      name: myName,
      artistIds: state.saved
    });
  }, [state.saved.join(","), joined]);
  React.useEffect(() => {
    var pending = null;
    try {
      pending = localStorage.getItem("plursky_crew_autojoin");
    } catch {}
    if (pending && configured) {
      try {
        localStorage.removeItem("plursky_crew_autojoin");
      } catch {}
      joinCrew(code);
    }
  }, []);
  React.useEffect(() => () => {
    if (leaveRef.current) leaveRef.current();
  }, []);
  React.useEffect(() => {
    (async () => {
      try {
        var db = await new Promise((res, rej) => {
          var r = indexedDB.open("plursky_memories", 1);
          r.onsuccess = e => res(e.target.result);
          r.onerror = e => rej(e.target.error);
          r.onupgradeneeded = e => {
            if (!e.target.result.objectStoreNames.contains("photos")) e.target.result.createObjectStore("photos", {
              keyPath: "id"
            });
          };
        });
        var r = db.transaction("photos", "readonly").objectStore("photos").get("crew_totem");
        r.onsuccess = () => {
          if (r.result?.blob) setTotemUrl(URL.createObjectURL(r.result.blob));
        };
      } catch {}
    })();
  }, []);
  var pickTotem = async file => {
    if (!file) return;
    var canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    var ctx = canvas.getContext("2d");
    var img = await new Promise(r => {
      var i = new Image();
      i.onload = () => r(i);
      i.onerror = () => r(null);
      i.src = URL.createObjectURL(file);
    });
    if (!img) return;
    var scale = Math.max(256 / img.width, 256 / img.height);
    var dw = img.width * scale,
      dh = img.height * scale;
    ctx.drawImage(img, (256 - dw) / 2, (256 - dh) / 2, dw, dh);
    var blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
    try {
      var db = await new Promise((res, rej) => {
        var r = indexedDB.open("plursky_memories", 1);
        r.onsuccess = e => res(e.target.result);
        r.onerror = e => rej(e.target.error);
      });
      var tx = db.transaction("photos", "readwrite");
      tx.objectStore("photos").put({
        id: "crew_totem",
        blob,
        createdAt: Date.now()
      });
    } catch {}
    setTotemUrl(URL.createObjectURL(blob));
  };
  var others = [...members.entries()].filter(([pid]) => pid !== myPid);
  if (!configured) return null;
  return React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, React.createElement("button", {
    onClick: () => setExpanded(e => !e),
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: expanded ? 10 : 0,
      background: "transparent",
      border: "none",
      padding: 0,
      cursor: "pointer",
      textAlign: "left",
      color: "var(--ink)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22
    }
  }, "Crew Mode"), !expanded && !joined && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)"
    }
  }, "· TAP TO START OR JOIN")), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, joined && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--success)"
    }
  }, "● ", others.length + 1, " IN CREW"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--muted)",
      transform: expanded ? "rotate(180deg)" : "none",
      transition: "transform .15s"
    }
  }, "▾"))), !expanded ? null : !joined ? React.createElement("div", {
    style: {
      padding: "15px 14px",
      borderRadius: 14,
      background: "var(--paper)",
      border: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Share a crew code with friends. When they join, you'll see which sets overlap — and the lineup shows crew badges."), React.createElement("button", {
    onClick: () => joinCrew(code),
    style: {
      width: "100%",
      padding: "11px",
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      marginBottom: 8
    }
  }, "START CREW · ", React.createElement("span", {
    style: {
      letterSpacing: 4
    }
  }, code)), joining ? React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("input", {
    type: "text",
    value: codeInput,
    onChange: e => setCodeInput(e.target.value.toUpperCase().slice(0, 6)),
    onKeyDown: e => e.key === "Enter" && joinCrew(codeInput),
    placeholder: "Enter crew code…",
    autoFocus: true,
    maxLength: 6,
    style: {
      flex: 1,
      padding: "9px 12px",
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      fontFamily: "Geist Mono, monospace",
      fontSize: 13,
      color: "var(--ink)",
      outline: "none",
      letterSpacing: 3
    }
  }), React.createElement("button", {
    onClick: () => joinCrew(codeInput),
    style: {
      padding: "9px 14px",
      background: codeInput.length >= 4 ? "var(--ember)" : "var(--paper-2)",
      color: codeInput.length >= 4 ? "#fff" : "var(--muted)",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, "JOIN")) : React.createElement("button", {
    onClick: () => setJoining(true),
    style: {
      width: "100%",
      padding: "9px",
      background: "transparent",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      cursor: "pointer",
      color: "var(--muted)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9.5,
      letterSpacing: 1.2
    }
  }, "JOIN A FRIEND'S CREW")) : React.createElement("div", null, React.createElement("div", {
    style: {
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 8,
      background: "var(--ink)",
      color: "var(--paper)",
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("button", {
    onClick: () => totemInputRef.current?.click(),
    "aria-label": totemUrl ? "Change crew totem photo" : "Set crew totem photo",
    className: totemUrl ? "totem-alive" : "",
    style: {
      width: 44,
      height: 44,
      borderRadius: 44,
      flexShrink: 0,
      border: totemUrl ? "2px solid rgba(247,237,224,0.5)" : "2px dashed rgba(247,237,224,0.3)",
      background: totemUrl ? `url(${totemUrl}) center/cover` : "rgba(247,237,224,0.08)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(247,237,224,0.4)",
      fontSize: 16,
      padding: 0,
      animation: totemUrl ? "totem-pulse 3s ease-in-out infinite" : "none"
    }
  }, totemUrl ? "" : "📷"), React.createElement("input", {
    ref: totemInputRef,
    type: "file",
    accept: "image/*",
    style: {
      display: "none"
    },
    onChange: e => {
      pickTotem(e.target.files?.[0]);
      e.target.value = "";
    }
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1.2,
      color: "rgba(247,237,224,0.45)",
      marginBottom: 3
    }
  }, totemUrl ? "YOUR TOTEM · TAP TO CHANGE" : "TAP 📷 TO SET YOUR TOTEM"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 28,
      letterSpacing: 8,
      fontWeight: 700,
      lineHeight: 1
    }
  }, code)), React.createElement("button", {
    onClick: async () => {
      var url = `${window.location.origin}${window.location.pathname}?crew=${code}`;
      var text = `Join my Plursky crew · code ${code}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Plursky crew",
            text,
            url
          });
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
          return;
        } catch (e) {
          if (e?.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch {}
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    style: {
      background: copied ? "rgba(45,122,85,0.3)" : "rgba(247,237,224,0.12)",
      border: "none",
      borderRadius: 8,
      padding: "7px 11px",
      cursor: "pointer",
      color: copied ? "var(--success)" : "var(--paper)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      transition: "all .15s"
    }
  }, copied ? "✓" : "↗ SHARE"), React.createElement("button", {
    onClick: () => {
      if (leaveRef.current) leaveRef.current();
      setJoined(false);
      setMembers(new Map());
    },
    style: {
      background: "rgba(247,237,224,0.08)",
      border: "none",
      borderRadius: 8,
      padding: "7px 11px",
      cursor: "pointer",
      color: "rgba(247,237,224,0.5)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2
    }
  }, "LEAVE")), others.length === 0 ? React.createElement("div", {
    style: {
      padding: "13px 14px",
      borderRadius: 12,
      background: "var(--paper)",
      border: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)"
    }
  }, "WAITING FOR CREW"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      marginTop: 3,
      lineHeight: 1.45
    }
  }, "Share code ", React.createElement("strong", null, code), " — friends' saved sets appear when they join.")) : React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 7
    }
  }, others.map(([pid, m]) => {
    var ids = m.artistIds || [];
    var inCommon = ids.filter(id => state.saved.includes(id)).length;
    var isOpen = expandedPid === pid;
    var ARTISTS = window.ARTISTS || [];
    var STAGES = window.STAGES || [];
    var picks = ids.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).sort((a, b) => (a.day || 0) - (b.day || 0) || (a.start || "").localeCompare(b.start || ""));
    return React.createElement("div", {
      key: pid,
      style: {
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden"
      }
    }, React.createElement("button", {
      onClick: () => setExpandedPid(isOpen ? null : pid),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 36,
        background: _presColor(pid),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Instrument Serif, serif",
        fontSize: 17,
        flexShrink: 0
      }
    }, (m.name || "?")[0].toUpperCase()), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 16,
        color: "var(--ink)"
      }
    }, m.name || "Friend"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.1,
        color: "var(--muted)",
        marginTop: 2
      }
    }, ids.length, " SETS", inCommon > 0 ? ` · ${inCommon} IN COMMON` : "")), React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--muted)",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        flexShrink: 0,
        transition: "transform 0.25s var(--ease-spring)",
        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
      }
    }, React.createElement("path", {
      d: "M9 18 L15 12 L9 6"
    }))), isOpen && React.createElement("div", {
      style: {
        padding: "0 14px 12px",
        borderTop: "1px solid var(--line)"
      }
    }, picks.length === 0 ? React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--muted)",
        padding: "12px 0"
      }
    }, "NO SETS SAVED YET") : picks.map(a => {
      var st = STAGES.find(s => s.id === a.stage);
      var shared = state.saved.includes(a.id);
      return React.createElement("div", {
        key: a.id,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 0",
          borderBottom: "1px solid var(--line)"
        }
      }, React.createElement("span", {
        style: {
          width: 6,
          height: 6,
          borderRadius: 6,
          background: st?.color || "var(--muted)",
          flexShrink: 0
        }
      }), React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          color: "var(--ink)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, a.name), shared && React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 7.5,
          letterSpacing: 1,
          fontWeight: 800,
          color: "var(--horizon)",
          background: "rgba(123,61,154,0.12)",
          padding: "1px 5px",
          borderRadius: 999
        }
      }, "BOTH"), React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 0.8,
          color: "var(--muted)",
          flexShrink: 0
        }
      }, (st?.short || "").toUpperCase(), " · ", window.fmt12 ? window.fmt12(a.start) : a.start));
    })));
  })), others.length > 0 && (() => {
    var _crewShare = async fmt => {
      var crewNames = [myName || "Me"];
      var avs = [{
        initial: (myName || "M")[0].toUpperCase(),
        color: _presColor(myPid)
      }];
      var crewArtistIds = new Set(state.saved || []);
      var overlapIds = new Set();
      for (var [pid, m] of others) {
        crewNames.push(m.name || "Friend");
        avs.push({
          initial: (m.name || "F")[0].toUpperCase(),
          color: _presColor(pid)
        });
        for (var id of m.artistIds || []) {
          crewArtistIds.add(id);
          if ((state.saved || []).includes(id)) overlapIds.add(id);
        }
      }
      await window._shareCrewCollage?.({
        crewNames,
        avatars: avs,
        crewArtistIds: [...crewArtistIds],
        overlapIds: [...overlapIds],
        format: fmt,
        totemUrl
      });
    };
    return React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 10
      }
    }, React.createElement("button", {
      onClick: () => _crewShare(),
      style: {
        flex: 1,
        padding: "11px",
        background: "#6D28D9",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.4,
        fontWeight: 700
      }
    }, "📸 SHARE OUR WEEKEND"), React.createElement("button", {
      onClick: () => _crewShare("gif"),
      style: {
        padding: "11px 14px",
        background: "#6D28D9",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.4,
        fontWeight: 700
      }
    }, "🎬 GIF"));
  })(), others.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginTop: 6
    }
  }, others.map(([pid, m]) => React.createElement("button", {
    key: pid,
    onClick: () => window._shareCrewComparison?.(myName, state, m.name || "Friend", m.artistIds || []),
    className: "mono",
    style: {
      padding: "8px 11px",
      background: "rgba(109,40,217,0.08)",
      color: "var(--ink)",
      border: "1px solid rgba(109,40,217,0.15)",
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      textAlign: "left"
    }
  }, "⚔️ SHOWDOWN VS ", (m.name || "FRIEND").toUpperCase()))), React.createElement(CrewChat, {
    code: code,
    myPid: myPid,
    myName: myName
  })));
}
var _stagePresChannel = null;
var _currentPresenceStage = null;
function joinStagePresence(stageId) {
  if (!_sb || !stageId) return;
  if (_currentPresenceStage === stageId) return;
  if (_stagePresChannel) {
    _stagePresChannel.unsubscribe();
    _stagePresChannel = null;
  }
  _currentPresenceStage = stageId;
  var deviceId = localStorage.getItem("plursky-device-id") || (() => {
    var id = `anon_${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem("plursky-device-id", id);
    } catch {}
    return id;
  })();
  _stagePresChannel = _sb.channel(`stage:${stageId}`, {
    config: {
      presence: {
        key: deviceId
      }
    }
  });
  _stagePresChannel.on("presence", {
    event: "sync"
  }, () => {
    var state = _stagePresChannel.presenceState();
    var count = Object.keys(state).length;
    window.dispatchEvent(new CustomEvent("plursky-presence", {
      detail: {
        stageId,
        count
      }
    }));
  });
  _stagePresChannel.subscribe(async status => {
    if (status === "SUBSCRIBED") {
      await _stagePresChannel.track({
        stage: stageId,
        joined: Date.now()
      });
    }
  });
}
function leaveStagePresence() {
  if (_stagePresChannel) {
    _stagePresChannel.unsubscribe();
    _stagePresChannel = null;
  }
  _currentPresenceStage = null;
}
var _MEDIA_BUCKET = "moment-media";
var _cloudMissing = new Set();
async function sbUploadMomentMedia(photoId, blob) {
  if (!_sb || !photoId || !blob) return false;
  try {
    var user = await sbGetUser();
    if (!user) return false;
    var {
      error
    } = await _sb.storage.from(_MEDIA_BUCKET).upload(`${user.id}/${photoId}`, blob, {
      upsert: true,
      contentType: blob.type || "application/octet-stream"
    });
    if (error) {
      console.warn("[backup] upload failed:", photoId, error.message);
      return false;
    }
    _cloudMissing.delete(photoId);
    return true;
  } catch (e) {
    console.warn("[backup] upload error:", e?.message);
    return false;
  }
}
async function sbDownloadMomentMedia(photoId) {
  if (!_sb || !photoId || _cloudMissing.has(photoId)) return null;
  try {
    var user = await sbGetUser();
    if (!user) return null;
    var {
      data,
      error
    } = await _sb.storage.from(_MEDIA_BUCKET).download(`${user.id}/${photoId}`);
    if (error || !data) {
      _cloudMissing.add(photoId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
Object.assign(window, {
  sbUploadMomentMedia,
  sbDownloadMomentMedia,
  AccountCard,
  sbSignInWithSpotify,
  sbSignInWithApple,
  sbDeleteAccount,
  sbSignOut,
  sbGetUser,
  sbPush,
  sbPull,
  sbOnAuthChange,
  sbMarkRemoved,
  sbClearRemoved,
  sbPushMoments,
  sbGetArtistSaveCounts,
  sbPresenceJoin,
  sbPresenceUpdate,
  sbPresenceLeave,
  sbPresenceRefresh,
  sbOnPresenceChange,
  sbGetMyPresId,
  sbGetPresSnap,
  sbFindByPingCode,
  sbBroadcastRally,
  sbClearRally,
  sbOnRally,
  FriendsCard,
  CrewCard,
  sbGetOrCreateGroupCode,
  sbGroupJoin,
  sbGroupLeave,
  sbGroupUpdate,
  sbGetCrewCount,
  sbCrewFetchMessages,
  sbCrewSendMessage,
  sbCrewSubscribeMessages,
  sbCrewReportMessage,
  sbGetBlockedPids,
  sbIsBlocked,
  sbBlockPid,
  sbUnblockPid,
  sbDMRoomCode,
  sbDMFetchMessages,
  sbDMSend,
  sbDMSubscribe,
  sbOutboxList,
  sbOutboxDrain,
  sbOutboxInit,
  sbGenerateShareToken,
  sbLiveShareStart,
  sbLiveShareUpdate,
  sbLiveShareStop,
  sbLiveShareFetch,
  joinStagePresence,
  leaveStagePresence
});
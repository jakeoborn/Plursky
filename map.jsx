// Hybrid map — top-down navigation (default) + ground-level peek when a stage is selected.
// Designed to feel like a real wayfinding app: glanceable, easy to meet friends, easy to route.

const _mapDebug = (() => { try { return localStorage.getItem("plursky-debug") === "1"; } catch { return false; } })();
const _mapLog = (...a) => { if (_mapDebug) console.log(...a); };

// ── Messaging ─────────────────────────────────────────────────
// Per-friend chat threads persisted in localStorage. Demo seed so the
// drawer feels alive; real backend would replace _fakeReply with a fetch.
const QUICK_REPLIES = [
  { tag: "OMW",          text: "🚀 omw" },
  { tag: "AT STAGE",     text: "📍 at the stage now" },
  { tag: "MEET TOTEM",   text: "🪧 meet at the totem?" },
  { tag: "WATER",        text: "💧 water break — back in 10" },
  { tag: "FOUND U",      text: "👀 i see you" },
  { tag: "NEED YOU",     text: "🆘 come find me" },
];

// Beside-style context-aware reply templates. Drafted from what we know
// (my stage, friend's stage, the next saved set, the live artist) so the
// chip row offers a relevant suggestion instead of a generic OMW. v1 is
// rule-based; a future iteration can call the Anthropic API to draft a
// real personalized message when online.
function buildSmartReplies({ myStage, friendStage, nextSavedSet }) {
  const out = [];
  if (myStage) {
    out.push({
      tag: `AT ${myStage.short}`,
      text: `📍 at ${myStage.name} now — come find me`,
      smart: true,
    });
  }
  if (friendStage) {
    out.push({
      tag: `OMW TO ${friendStage.short}`,
      text: `🚀 omw to ${friendStage.name}`,
      smart: true,
    });
  }
  if (nextSavedSet) {
    const a = nextSavedSet.artist;
    const stage = STAGES.find(s => s.id === a.stage);
    const stageName = stage ? stage.name : "the stage";
    if (nextSavedSet.isLive) {
      out.push({
        tag: `${a.name.toUpperCase().slice(0, 8)} LIVE`,
        text: `🎧 ${a.name} is LIVE at ${stageName} — get over here`,
        smart: true,
      });
    } else if (nextSavedSet.minsUntil > 0 && nextSavedSet.minsUntil <= 90) {
      out.push({
        tag: `${a.name.toUpperCase().slice(0, 8)} ${nextSavedSet.minsUntil}M`,
        text: `${a.name} in ${nextSavedSet.minsUntil}m at ${stageName} — meet there?`,
        smart: true,
      });
    }
  }
  return out;
}
const _SEED_MSGS = {
  f1: [
    { from: "them", text: "yooo where you at??", ts: Date.now() - 1000*60*22 },
    { from: "me",   text: "kineticFIELD, by the totems", ts: Date.now() - 1000*60*19 },
    { from: "them", text: "🚀 omw", ts: Date.now() - 1000*60*4 },
  ],
  f2: [
    { from: "them", text: "trance hit different tonight 😭", ts: Date.now() - 1000*60*38 },
  ],
  f3: [],
  f4: [
    { from: "them", text: "circuitGROUNDS in 5", ts: Date.now() - 1000*60*8 },
  ],
};
function loadThread(friendId) {
  try {
    const raw = localStorage.getItem(`msg_${friendId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return _SEED_MSGS[friendId] || [];
}
function saveThread(friendId, msgs) {
  try { localStorage.setItem(`msg_${friendId}`, JSON.stringify(msgs)); } catch {}
}
function clearAllThreads() {
  Object.keys(localStorage).filter(k => k.startsWith("msg_")).forEach(k => localStorage.removeItem(k));
}
function unreadCount(friendId) {
  const t = loadThread(friendId);
  const lastRead = parseInt(localStorage.getItem(`msg_read_${friendId}`) || "0", 10);
  return t.filter(m => m.from === "them" && m.ts > lastRead).length;
}
function markRead(friendId) {
  try { localStorage.setItem(`msg_read_${friendId}`, String(Date.now())); } catch {}
}
// Returns a contextual reply based on the user's last message
function _fakeReply(userText) {
  const t = userText.toLowerCase();
  if (/omw|on my way/.test(t))                return ["see you in a sec 🌟", 5000];
  if (/water|hydrat/.test(t))                  return ["💧 same. by the cosmic water tent", 6500];
  if (/totem|meet/.test(t))                    return ["📍 already there", 4500];
  if (/kinetic|field/.test(t))                 return ["pulling up to kineticFIELD now", 7000];
  if (/circuit|techno/.test(t))                return ["circuit's going off rn 🔥", 5500];
  if (/where|location/.test(t))                return ["bionic — pin coming", 6000];
  if (/help|need|sos|🆘/.test(t))              return ["coming. stay where u are 🚨", 3500];
  if (/love|👀|❤️/.test(t))                    return ["🥺 ur the best", 5000];
  return ["🫶", 4500 + Math.random()*2500];
}

// Friend status broadcasts — what stage they're at + freshness
const _SEED_STATUSES = {
  f1: { stage: "bionic",  ts: Date.now() - 1000*60*8  },
  f2: { stage: "quantum", ts: Date.now() - 1000*60*22 },
  f3: { stage: "stereo",  ts: Date.now() - 1000*60*4  },
  f4: { stage: "circuit", ts: Date.now() - 1000*60*15 },
};
function friendStatus(friendId) {
  try {
    const raw = localStorage.getItem(`status_${friendId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return _SEED_STATUSES[friendId] || null;
}
function getMyStatus() {
  try { return JSON.parse(localStorage.getItem("status_me") || "null"); } catch { return null; }
}
function persistMyStatus(stageId) {
  try { localStorage.setItem("status_me", JSON.stringify({ stage: stageId, ts: Date.now() })); } catch {}
}
function broadcastMyLocation(stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  if (!stage) return;
  const msg = `I'm at ${stage.name} 👋 come through`;
  FRIENDS.forEach(f => {
    saveThread(f.id, [...loadThread(f.id), { from: "me", text: msg, ts: Date.now(), status: "sent" }]);
  });
}


// ── Wellness state ── persists across sessions in localStorage
//
// Hydration drifts down -1% every 90s while the page is open. We don't try
// to back-fill drift while the page is closed (that'd punish someone who
// closed the app at 100% and reopened next day at 0%); instead we cap
// computed drift at 6 hrs since last drink.
const HYD_DRIFT_PER_MIN = 60 / 90;       // ~0.67%/min
const HYD_DRIFT_CAP_MIN = 6 * 60;        // 6h max drift

function readWellness() {
  try {
    const raw = localStorage.getItem("wellness");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { lastDrink: Date.now(), lastRest: Date.now() };
}
function writeWellness(w) {
  try { localStorage.setItem("wellness", JSON.stringify(w)); } catch {}
}
function computeHydration(lastDrink) {
  const minsSince = Math.min(HYD_DRIFT_CAP_MIN, (Date.now() - lastDrink) / 60000);
  return Math.max(0, Math.round(100 - minsSince * HYD_DRIFT_PER_MIN));
}

function WellnessPill() {
  const [w, setW] = React.useState(readWellness);
  const [open, setOpen] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const { active: bsActive } = useBatterySaver();
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), bsActive ? 120000 : 30000);
    return () => clearInterval(id);
  }, [bsActive]);

  const hyd = computeHydration(w.lastDrink);
  const restMin = Math.floor((Date.now() - w.lastRest) / 60000);
  const hydColor = hyd > 70 ? "#34d399" : hyd > 40 ? "#f59a36" : "#f87171";
  const restColor = restMin < 75 ? "rgba(247,237,224,0.85)" : restMin < 120 ? "#f59a36" : "#f87171";

  const drank = () => {
    const nw = { ...w, lastDrink: Date.now() };
    setW(nw); writeWellness(nw); setTick(t => t + 1);
  };
  const rested = () => {
    const nw = { ...w, lastRest: Date.now() };
    setW(nw); writeWellness(nw); setTick(t => t + 1);
  };
  const restLabel = restMin < 60 ? `${restMin}m` : `${Math.floor(restMin / 60)}h${(restMin % 60).toString().padStart(2, "0")}`;

  const restColorLight = restMin < 75 ? "var(--ink)" : restMin < 120 ? "#b8651b" : "#c14a4a";
  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{
        position: "absolute", top: 14, left: 10, zIndex: 4,
        display: "flex", alignItems: "center", gap: 7,
        padding: "5px 10px 5px 7px", borderRadius: 999,
        background: "rgba(247,237,224,0.88)",
        border: `1px solid ${hyd < 40 || restMin > 120 ? "#c14a4a" : "var(--line-2)"}`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "var(--ink)",
        fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 0.8, fontWeight: 600,
        cursor: "pointer",
        boxShadow: hyd < 40 ? "0 0 0 4px rgba(193,74,74,0.16)" : "0 2px 8px rgba(26,18,13,0.06)",
      }}>
        <span style={{ fontSize: 12 }}>💧</span>
        <span style={{ color: hyd > 70 ? "var(--ink)" : hyd > 40 ? "#b8651b" : "#c14a4a", fontWeight: 700 }}>{hyd}%</span>
        <span style={{ width: 1, height: 10, background: "var(--line-2)" }}/>
        <span style={{ color: restColorLight, fontWeight: 700 }}>{restLabel}</span>
      </button>

      {open && (
        <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}/>
          <div style={{
            position: "absolute", left: 14, right: 14, top: 100,
            background: "var(--paper)", color: "var(--ink)",
            borderRadius: 16, padding: 16,
            boxShadow: "0 14px 40px rgba(0,0,0,0.4)",
          }}>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, color: "var(--muted)", marginBottom: 6 }}>
              WELLNESS · DESERT DEFAULTS
            </div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.05, marginBottom: 12 }}>
              Take care of you.
            </div>

            {/* Hydration */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: hydColor, fontWeight: 700 }}>HYDRATION</span>
                <span className="serif" style={{ fontSize: 24, color: hydColor }}>{hyd}%</span>
              </div>
              <div style={{ height: 6, background: "var(--line)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${hyd}%`, height: "100%", background: hydColor, borderRadius: 6, transition: "width .35s" }}/>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5, lineHeight: 1.4 }}>
                {hyd > 70 ? "Cruising — top up next set." : hyd > 40 ? "Hit a water station soon." : "Drink water now. ~−1% per 90 sec in the heat."}
              </div>
              <button onClick={drank} style={{
                marginTop: 8, width: "100%",
                background: "#38bdf8", color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 12px",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                cursor: "pointer",
              }}>💧 LOGGED · DRANK WATER</button>
            </div>

            {/* Rest */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: restColor, fontWeight: 700 }}>ON FEET</span>
                <span className="serif" style={{ fontSize: 24, color: restColor }}>{restLabel}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 0, lineHeight: 1.4 }}>
                {restMin < 75 ? "Pace is good." : restMin < 120 ? "Sit down at the next break." : "Take 10 min off your feet — you'll dance harder later."}
              </div>
              <button onClick={rested} style={{
                marginTop: 8, width: "100%",
                background: "var(--paper-2)", color: "var(--ink)", border: "1px solid var(--line-2)",
                borderRadius: 10, padding: "10px 12px",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                cursor: "pointer",
              }}>🦵 LOGGED · TOOK A BREAK</button>
            </div>

            <button onClick={() => setOpen(false)} style={{
              marginTop: 12, width: "100%",
              background: "transparent", border: "none",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.4, color: "var(--muted)",
              cursor: "pointer", textTransform: "uppercase",
            }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Real GPS plumbing ─────────────────────────────────────────
// Three stage GPS anchors (from FESTIVAL_CONFIG.gpsAnchors) give us an
// affine transform from (lat, lng) → SVG (mapX, mapY) on the 0-100 grid.
// Swap the festival config and the transform automatically retunes for
// the new venue.
const FESTIVAL_LAT       = FESTIVAL_CONFIG.gps.lat;
const FESTIVAL_LNG       = FESTIVAL_CONFIG.gps.lng;
const ON_SITE_RADIUS_MI  = FESTIVAL_CONFIG.gps.onSiteRadiusMi;

// 3-point Cramer affine: [mapX, mapY] = M · [lat, lng, 1]
function _solveMapAffine() {
  if (!FESTIVAL_CONFIG.gpsAnchors || FESTIVAL_CONFIG.gpsAnchors.length < 3) return null;
  const find = (id) => STAGES.find(s => s.id === id);
  const [a0, a1, a2] = FESTIVAL_CONFIG.gpsAnchors;
  if (!find(a0.stageId) || !find(a1.stageId) || !find(a2.stageId)) return null;
  const A = { lat: a0.lat, lng: a0.lng, mx: find(a0.stageId).x, my: find(a0.stageId).y };
  const B = { lat: a1.lat, lng: a1.lng, mx: find(a1.stageId).x, my: find(a1.stageId).y };
  const C = { lat: a2.lat, lng: a2.lng, mx: find(a2.stageId).x, my: find(a2.stageId).y };
  const det = A.lat*(B.lng - C.lng) - A.lng*(B.lat - C.lat) + (B.lat*C.lng - C.lat*B.lng);
  if (Math.abs(det) < 1e-12) return null;
  const solve = (v1, v2, v3) => {
    // Cramer's rule for [v1; v2; v3] = M * [a; b; c] where M is the
    // 3-anchor [lat,lng,1] system. Last term of `a` had its sign
    // flipped — should be (C.lng*v2 - B.lng*v3), not (B.lng*v3 - C.lng*v2).
    // That bug made MAP_AFFINE.x[0] / .y[0] (the latitude coefficient)
    // wrong, which inverted to mapToGps(50,22) → lat~0 lng~-84 instead
    // of the actual Kinetic GPS at LVMS.
    const a = (v1*(B.lng - C.lng)        - A.lng*(v2 - v3)            + (C.lng*v2 - B.lng*v3)) / det;
    const b = (A.lat*(v2 - v3)           - v1*(B.lat - C.lat)         + (B.lat*v3 - C.lat*v2)) / det;
    const c = (A.lat*(B.lng*v3 - C.lng*v2) - A.lng*(B.lat*v3 - C.lat*v2) + v1*(B.lat*C.lng - C.lat*B.lng)) / det;
    return [a, b, c];
  };
  return { x: solve(A.mx, B.mx, C.mx), y: solve(A.my, B.my, C.my) };
}
const MAP_AFFINE = _solveMapAffine();
function gpsToMap(lat, lng) {
  if (!MAP_AFFINE) return { x: 50, y: 50 };
  return {
    x: MAP_AFFINE.x[0]*lat + MAP_AFFINE.x[1]*lng + MAP_AFFINE.x[2],
    y: MAP_AFFINE.y[0]*lat + MAP_AFFINE.y[1]*lng + MAP_AFFINE.y[2],
  };
}
// Haversine miles
function distMiles(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Meetups (offline-first) ─────────────────────────────────
// Crew-agreed meeting points that work without a live connection. List
// is localStorage-backed and survives reloads. Each entry pins to a
// stage (or just to a time) so the crew can show up at the same place
// at the same moment without ever messaging at the venue. Sync to
// Supabase is a future follow-up — this layer is purely local for now.
const MEETUPS_KEY = "plursky_meetups_v1";

function readMeetups() {
  try { return JSON.parse(localStorage.getItem(MEETUPS_KEY) || "[]"); }
  catch { return []; }
}
function writeMeetups(arr) {
  try { localStorage.setItem(MEETUPS_KEY, JSON.stringify(arr)); } catch {}
}
function addMeetup({ name, stageId, atTs, notes }) {
  const list = readMeetups();
  list.push({
    id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name: (name || "").slice(0, 60),
    stageId: stageId || null,
    atTs: Number(atTs) || Date.now(),
    notes: (notes || "").slice(0, 200),
    createdAt: Date.now(),
  });
  // Keep sorted by atTs ascending
  list.sort((a, b) => a.atTs - b.atTs);
  writeMeetups(list);
  return list;
}
function removeMeetup(id) {
  const list = readMeetups().filter(m => m.id !== id);
  writeMeetups(list);
  return list;
}
// Surface only upcoming entries (not in the past). Anything older than
// 30 min is also stale-removed automatically — keeps the list tidy.
function upcomingMeetups() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const list = readMeetups().filter(m => m.atTs > cutoff);
  // Rewrite if we pruned anything stale
  if (list.length !== readMeetups().length) writeMeetups(list);
  return list;
}

// "Last seen" staleness for friend pins. Buckets that match festival reality:
// fresh = the data is trustworthy ("they ARE there"); stale = trust but verify;
// cold = treat as a hint, not a fact. Designed for 4AM-tired eyes.
function formatLastSeen(ts) {
  if (!ts) return { label: "", freshness: "cold", color: "rgba(255,255,255,0.45)" };
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1)  return { label: "NOW",            freshness: "fresh", color: "#2d7a55" };  // var(--success)
  if (mins < 5)  return { label: `${mins}m`,       freshness: "fresh", color: "#2d7a55" };
  if (mins < 15) return { label: `${mins}m`,       freshness: "stale", color: "#f59a36" };  // var(--flare)
  if (mins < 60) return { label: `${mins}m`,       freshness: "cold",  color: "rgba(255,255,255,0.55)" };
  const hrs = Math.floor(mins / 60);
  return     { label: `${hrs}h+`,                  freshness: "cold",  color: "rgba(255,255,255,0.45)" };
}

// Watch the user's real position. Returns { pos, status, lastUpdate }.
// In battery-saver mode, drops high-accuracy GPS and lets the browser cache
// fixes for 30s — saves a meaningful chunk of battery on long late-night sessions.
function useGeolocation(enabled) {
  const [pos, setPos] = React.useState(null);
  const [status, setStatus] = React.useState("idle"); // idle | locating | live | denied | unavailable
  const { active: bsActive } = useBatterySaver();
  React.useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    if (!navigator.geolocation) { setStatus("unavailable"); return; }
    setStatus("locating");
    let alive = true;
    const opts = bsActive
      ? { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
      : { enableHighAccuracy: true,  maximumAge: 4000,  timeout: 15000 };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!alive) return;
        const lat = p.coords.latitude, lng = p.coords.longitude;
        setPos({ lat, lng, accuracy: p.coords.accuracy, ts: Date.now() });
        setStatus("live");
        // v137: live attendance auto-detect — silently marks the user as
        // "caught" the current set when GPS confirms they're inside a stage's
        // footprint AND the timing matches. Idempotent + cheap; no record
        // means we're between stages or it's not set time.
        try {
          const hit = window.recordAttendanceFromGps?.(lat, lng);
          if (hit && typeof window.plurskyToast === "function") {
            const a = (window.ARTISTS || []).find(x => x.id === hit.artistId);
            if (a) window.plurskyToast(`✓ Caught ${a.name}`);
          }
        } catch {}
      },
      (e) => {
        if (!alive) return;
        setStatus(e.code === 1 ? "denied" : "unavailable");
      },
      opts
    );
    return () => { alive = false; navigator.geolocation.clearWatch(id); };
  }, [enabled, bsActive]);
  return { pos, status };
}

// ── Walking time model ─────────────────────────────────────
// Reddit/raver-sourced estimates beat naïve dist*c. KIN→CIR is the longest
// walk on the map (15-25 min); adjacent stages are 5-15 min depending on
// pinch-points. The 1-3 AM crowd window adds ~50-60% as people leak between
// mainstage drops. Avatar→stage falls back to a piecewise distance curve
// when the avatar isn't anchored to a known stage.
// All 36 stage pairs; keys alphabetically sorted so _pairKey always hits.
const WALK_PAIRS = {
  "basspod,bionic":  [10, 16],
  "basspod,circuit": [ 6, 10],
  "basspod,cosmic":  [ 9, 13],
  "basspod,kinetic": [ 6, 10],
  "basspod,neon":    [10, 14],
  "basspod,quantum": [10, 14],
  "basspod,stereo":  [ 8, 12],
  "basspod,waste":   [ 6, 10],
  "bionic,circuit":  [14, 22],
  "bionic,cosmic":   [ 6, 10],
  "bionic,kinetic":  [ 7, 11],
  "bionic,neon":     [12, 17],
  "bionic,quantum":  [10, 14],
  "bionic,stereo":   [ 4,  7],
  "bionic,waste":    [ 7, 11],
  "circuit,cosmic":  [12, 18],
  "circuit,kinetic": [15, 25],
  "circuit,neon":    [ 5,  9],
  "circuit,quantum": [ 9, 13],
  "circuit,stereo":  [11, 16],
  "circuit,waste":   [10, 14],
  "cosmic,kinetic":  [10, 15],
  "cosmic,neon":     [13, 18],
  "cosmic,quantum":  [13, 18],
  "cosmic,stereo":   [ 6, 10],
  "cosmic,waste":    [ 7, 11],
  "kinetic,neon":    [10, 14],
  "kinetic,quantum": [ 5,  9],
  "kinetic,stereo":  [ 8, 12],
  "kinetic,waste":   [ 6, 10],
  "neon,quantum":    [ 7, 11],
  "neon,stereo":     [10, 14],
  "neon,waste":      [12, 17],
  "quantum,stereo":  [ 7, 11],
  "quantum,waste":   [13, 18],
  "stereo,waste":    [ 7, 11],
};

function _pairKey(a, b) { return a < b ? `${a},${b}` : `${b},${a}`; }

function _nearestStageId(x, y, radius = 9) {
  let best = null, bestD = radius;
  for (const s of STAGES) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) { bestD = d; best = s.id; }
  }
  return best;
}

function _distToBand(d) {
  if (d < 12) return [ 2,  4];
  if (d < 22) return [ 4,  7];
  if (d < 35) return [ 6, 10];
  if (d < 50) return [10, 14];
  if (d < 65) return [13, 20];
  return        [18, 28];
}

// { lo, hi, peak, plan } — `plan` flips on for the "plan 20+ min" advisory
// during the 01:00-03:00 crowd peak when the upper bound is already > 15.
function computeWalkRange(avatarX, avatarY, targetStage, dist, nowTime) {
  let lo, hi;
  const fromStage = _nearestStageId(avatarX, avatarY);
  if (fromStage && targetStage && fromStage !== targetStage.id) {
    const k = _pairKey(fromStage, targetStage.id);
    if (WALK_PAIRS[k]) [lo, hi] = WALK_PAIRS[k];
  }
  if (lo == null) [lo, hi] = _distToBand(dist);

  const hour = nowTime ? parseInt(String(nowTime).split(":")[0], 10) : -1;
  const isPeak = hour >= 1 && hour < 3;
  if (isPeak) { lo = Math.round(lo * 1.5); hi = Math.round(hi * 1.6); }

  return { lo, hi, peak: isPeak, plan: isPeak && hi >= 15 };
}

// Single-number flavour for meet-pin ETAs (avatar→pin / friend→pin).
function distToMins(d) {
  const [lo, hi] = _distToBand(d);
  return Math.max(1, Math.round((lo + hi) / 2));
}

// Find the user's next saved set today: live now, or starting soon. Returns
// null if nothing saved on the current festival day. Used by NextSetStrip
// to power the top-of-map heads-up banner.
function findNextSavedSet(savedIds) {
  const nowMin = toNightMin(NOW.time);
  const todays = savedIds
    .map(id => ARTISTS.find(a => a.id === id))
    .filter(a => a && a.day === NOW.day)
    .map(a => ({ a, sM: toNightMin(a.start), eM: toNightMin(a.end) }))
    .filter(x => x.eM > nowMin)
    .sort((x, y) => x.sM - y.sM);
  if (!todays.length) return null;
  const live = todays.find(x => x.sM <= nowMin && x.eM > nowMin);
  const pick = live || todays[0];
  return {
    artist:    pick.a,
    isLive:    !!live,
    minsUntil: Math.max(0, pick.sM - nowMin),
    minsLeft:  Math.max(0, pick.eM - nowMin),
  };
}

// ── Friend ping codes ─────────────────────────────────────────
// Each user gets a friendly 4-letter code (LIME, FROG, etc.) generated
// once + persisted. Share your code with a friend; they enter it in
// their app to drop a "find me" pin on your live position. Without a
// backend, lookup is demo-only: codes that match one of the seeded
// friends drop the pin on that friend; unknown codes drop near the
// avatar with a "code not found, demo pin" notice.
const PING_WORDS = [
  "LIME","KIWI","PLUM","SAGE","ROSE","DUSK","DAWN","NEON",
  "LOFT","FROG","STAR","MOTH","MINT","JADE","RUBY","PINE",
  "FERN","SOLO","HOWL","WAVE","MOON","ECHO","HAZE","SAGA",
];
function getMyPingCode() {
  try {
    let c = localStorage.getItem("ping_code");
    if (c && /^[A-Z]{4}$/.test(c)) return c;
    c = PING_WORDS[Math.floor(Math.random() * PING_WORDS.length)];
    localStorage.setItem("ping_code", c);
    return c;
  } catch {
    return "PLUR";
  }
}
// Demo-only: 4-letter "address book" mapping codes to seeded friends.
// In production this would be a server lookup against the user's actual
// friend list / contacts.
const DEMO_FRIEND_CODES = { LIME: "f1", FROG: "f2", NEON: "f3", PLUM: "f4" };

function PingSheet({ onClose, onDropPin, friends }) {
  const myCode = getMyPingCode();
  const [input, setInput] = React.useState("");
  const [feedback, setFeedback] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  const submit = () => {
    const c = input.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) {
      setFeedback({ kind: "err", text: "Enter a 4-letter code." });
      return;
    }
    // Check live CREW presence first — real lookup, no server needed
    if (typeof sbFindByPingCode === "function") {
      const live = sbFindByPingCode(c);
      if (live) {
        const st = STAGES.find(s => s.id === live.stageId);
        if (st) {
          onDropPin({ x: st.x, y: st.y, label: `${live.name} (${c})` });
          setFeedback({ kind: "ok", text: `Live pin dropped on ${live.name} at ${st.name}.` });
          setTimeout(onClose, 900);
          return;
        }
      }
    }
    // Fall back to demo address book
    const friendId = DEMO_FRIEND_CODES[c];
    if (friendId) {
      const f = friends.find(fr => fr.id === friendId);
      if (f) {
        onDropPin({ x: f.x, y: f.y, label: `${f.name} (${c})` });
        setFeedback({ kind: "ok", text: `Pin dropped on ${f.name}.` });
        setTimeout(onClose, 700);
        return;
      }
    }
    setFeedback({ kind: "warn", text: `"${c}" isn't in CREW right now. Ask them to join CREW so their code goes live.` });
  };

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`Find me on Plursky — code ${myCode}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  };
  const shareCode = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Plursky",
          text: `Find me on Plursky — code ${myCode}`,
        });
      } else {
        copyCode();
      }
    } catch {}
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(13,10,8,0.55)",
      zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460,
        background: "var(--paper)", color: "var(--ink)",
        borderRadius: "16px 16px 0 0",
        padding: "16px 18px 22px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>PING CODES</span>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        <div className="serif" style={{ fontSize: 14, color: "var(--muted)", marginBottom: 10 }}>
          Share your code so a friend can drop a pin on you.
        </div>

        <div style={{
          background: "var(--ink)", color: "var(--paper)",
          borderRadius: 14, padding: "16px 18px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, opacity: 0.6, marginBottom: 2 }}>YOUR CODE</div>
            <div className="serif" style={{ fontSize: 34, letterSpacing: 4, fontWeight: 400 }}>{myCode}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={shareCode} style={{
              background: "var(--ember)", color: "#fff", border: "none",
              borderRadius: 8, padding: "7px 14px",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
              cursor: "pointer",
            }}>SHARE</button>
            <button onClick={copyCode} style={{
              background: "transparent", color: "var(--paper)",
              border: "1px solid rgba(247,237,224,0.35)",
              borderRadius: 8, padding: "7px 14px",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
              cursor: "pointer",
            }}>{copied ? "COPIED" : "COPY"}</button>
          </div>
        </div>

        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
          DROP A PIN FROM A FRIEND'S CODE
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="LIME"
            maxLength={4}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && submit()}
            style={{
              flex: 1, background: "var(--paper-2)", color: "var(--ink)",
              border: "1px solid var(--line-2)",
              borderRadius: 10, padding: "10px 14px",
              fontFamily: "Geist Mono, monospace", fontSize: 18,
              letterSpacing: 4, fontWeight: 700, textTransform: "uppercase",
              outline: "none",
            }}
          />
          <button onClick={submit} style={{
            background: "var(--ink)", color: "var(--paper)", border: "none",
            borderRadius: 10, padding: "10px 18px",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer",
          }}>DROP PIN</button>
        </div>
        {feedback && (
          <div className="mono" style={{
            marginTop: 10, fontSize: 10, letterSpacing: 1.1, fontWeight: 700,
            color: feedback.kind === "ok" ? "var(--success)"
                 : feedback.kind === "err" ? "var(--ember)"
                 : "var(--horizon)",
          }}>{feedback.text}</div>
        )}
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>
          TIP: use the <span style={{ color: "var(--success)", fontWeight: 700 }}>CREW</span> button above for live real-time tracking with friends.
        </div>
      </div>
    </div>
  );
}

function IAmAtSheet({ onClose, initialStage, onStatusSet }) {
  const [selected, setSelected] = React.useState(initialStage || null);
  const [sent, setSent] = React.useState(false);

  const stage = STAGES.find(s => s.id === selected);

  const shareLink = async () => {
    if (!stage) return;
    persistMyStatus(selected);
    onStatusSet(selected);
    const text = `I'm at ${stage.name} at ${FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name} 🎧 come find me — plursky.com`;
    if (navigator.share) {
      try { await navigator.share({ text, title: "Where I'm at" }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); } catch {}
    }
    onClose();
  };

  const tellCrew = () => {
    if (!stage) return;
    persistMyStatus(selected);
    onStatusSet(selected);
    broadcastMyLocation(selected);
    setSent(true);
    setTimeout(onClose, 900);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(13,10,8,0.55)",
      zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460,
        background: "var(--paper)", color: "var(--ink)",
        borderRadius: "16px 16px 0 0",
        padding: "16px 18px 28px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>WHERE ARE YOU?</span>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
          {STAGES.map(s => {
            const on = selected === s.id;
            return (
              <button key={s.id} onClick={() => setSelected(s.id)} style={{
                padding: "8px 6px", borderRadius: 10,
                background: on ? s.color : "var(--paper-2)",
                color: on ? "#fff" : "var(--ink)",
                border: on ? "none" : "1px solid var(--line-2)",
                cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: on ? "rgba(255,255,255,0.7)" : s.color }} />
                <span className="mono" style={{ fontSize: 8, letterSpacing: 0.8, fontWeight: on ? 700 : 500, textAlign: "center", lineHeight: 1.2 }}>{s.short}</span>
              </button>
            );
          })}
        </div>

        {stage && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 10, background: `${stage.color}18`, borderLeft: `3px solid ${stage.color}` }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: stage.color, fontWeight: 700 }}>
              {stage.vibe?.toUpperCase()}
            </span>
            <span className="serif" style={{ fontSize: 14, marginLeft: 8 }}>{stage.name}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={tellCrew} disabled={!stage} style={{
            flex: 1, padding: "10px 12px", borderRadius: 999,
            background: sent ? "var(--success)" : (stage ? "var(--ink)" : "var(--paper-2)"),
            color: stage ? "var(--paper)" : "var(--muted)",
            border: "none", cursor: stage ? "pointer" : "default",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
            transition: "background .2s",
          }}>{sent ? "✓ CREW NOTIFIED" : "TELL MY CREW"}</button>
          <button onClick={shareLink} disabled={!stage} style={{
            flex: 1, padding: "10px 12px", borderRadius: 999,
            background: stage ? "var(--ember)" : "var(--paper-2)",
            color: stage ? "#fff" : "var(--muted)",
            border: "none", cursor: stage ? "pointer" : "default",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
          }}>SHARE LINK ↗</button>
        </div>
      </div>
    </div>
  );
}

// ── Share Location sheet ─────────────────────────────────────
// Front door for broadcasting *anything* about your location to crew —
// replaces the old one-tap "Crew live" toggle with a Fi-style consent
// moment. Bundles: big start/stop pill, what's-shared checklist (GPS
// + stage), battery cost callout, and an AllTrails-style auto-expire
// picker so sharing dies on its own.

// Next sunrise epoch (UTC ms) computed from FESTIVAL_CONFIG.sunTimes.
// Falls back to festival end if we're past the last sunrise of the run.
function _nextSunriseEpochMs() {
  const now = Date.now();
  const dayKeys = Object.keys(FESTIVAL_CONFIG.dayDates || {}).sort();
  for (const k of dayKeys) {
    const d = FESTIVAL_CONFIG.dayDates[k];
    const rise = (FESTIVAL_CONFIG.sunTimes?.[k]?.rise) || "05:30";
    const [h, m] = rise.split(":").map(Number);
    const epoch = (d.midnightUtc || 0) + h * 3600000 + m * 60000;
    if (epoch > now + 60000) return epoch;       // at least a minute out
  }
  return FESTIVAL_CONFIG.endMs || (now + 4 * 3600000);
}

const _SHARE_EXPIRY_OPTIONS = [
  { key: "1h",       label: "1H",       compute: () => Date.now() + 60 * 60 * 1000 },
  { key: "4h",       label: "4H",       compute: () => Date.now() + 4 * 60 * 60 * 1000 },
  { key: "sunrise",  label: "SUNRISE",  compute: _nextSunriseEpochMs },
  { key: "festival", label: "FESTIVAL", compute: () => FESTIVAL_CONFIG.endMs || (Date.now() + 24 * 3600000) },
];

function _expiryKeyFromState(shareState) {
  if (!shareState?.expiresAt) return "4h";
  const remain = shareState.expiresAt - Date.now();
  if (remain < 90 * 60 * 1000) return "1h";
  if (remain < 5 * 60 * 60 * 1000) return "4h";
  if (shareState.expiresAt < (FESTIVAL_CONFIG.endMs || Infinity) - 60000) return "sunrise";
  return "festival";
}

// Inline "shareable link" row used inside the Share With Crew sheet. Builds
// the public viewer URL from the token, supports navigator.share when
// available, falls back to clipboard. Shows "COPIED" for 1.5s.
function ShareLinkRow({ token }) {
  const [copied, setCopied] = React.useState(false);
  const url = React.useMemo(() => {
    if (typeof window === "undefined") return `share.html?t=${token}`;
    const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}`;
    return `${base}share.html?t=${token}`;
  }, [token]);
  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Find me at ${FESTIVAL_CONFIG.brand || "the festival"}`, text: "Live location on Plursky", url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch { /* user canceled or no clipboard */ }
  };
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10, background: "var(--paper-2)",
      marginBottom: 14, display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>🔗</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500 }}>Shareable link</div>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 0.6, color: "var(--muted)",
          marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{url}</div>
      </div>
      <button onClick={onShare} style={{
        background: copied ? "var(--success)" : "var(--ink)",
        color: "var(--paper)", border: "none", borderRadius: 999,
        padding: "7px 12px", cursor: "pointer",
        fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
      }}>{copied ? "COPIED" : "COPY"}</button>
    </div>
  );
}

function ShareLocationSheet({
  onClose, shareState, crewCount, crewCode,
  gpsPos, gpsStatus, myStatusStage,
  onSave, onStop,
}) {
  const [includeGps,   setIncludeGps]   = React.useState(shareState?.includeGps   ?? true);
  const [includeStage, setIncludeStage] = React.useState(shareState?.includeStage ?? true);
  const [expiryKey,    setExpiryKey]    = React.useState(() => _expiryKeyFromState(shareState));

  const active = !!shareState?.active &&
                 (!shareState?.expiresAt || shareState.expiresAt > Date.now());
  const isDenied      = gpsStatus === "denied";
  const isUnavailable = gpsStatus === "unavailable";
  const canShareGps   = !isDenied && !isUnavailable;
  const stage         = myStatusStage ? STAGES.find(s => s.id === myStatusStage) : null;

  const handleStart = () => {
    if (!includeGps && !includeStage) return;
    const opt = _SHARE_EXPIRY_OPTIONS.find(o => o.key === expiryKey) || _SHARE_EXPIRY_OPTIONS[1];
    onSave({
      active: true,
      includeGps: includeGps && canShareGps,
      includeStage,
      expiresAt: opt.compute(),
    });
    onClose();
  };

  const handleStop = () => {
    onStop();
    onClose();
  };

  const _fmtRemaining = () => {
    if (!shareState?.expiresAt) return "";
    const mins = Math.max(0, Math.round((shareState.expiresAt - Date.now()) / 60000));
    if (mins < 60) return `${mins}m left`;
    return `${Math.round(mins / 60)}h left`;
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(13,10,8,0.55)",
      zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460,
        background: "var(--paper)", color: "var(--ink)",
        borderRadius: "16px 16px 0 0",
        padding: "16px 18px 28px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>SHARE WITH CREW</span>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Crew context line */}
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700,
          marginBottom: 12,
        }}>
          {crewCode
            ? <>● {crewCount || 0} IN CREW · {crewCode}</>
            : <>NO CREW YET — JOIN ONE FIRST</>
          }
        </div>

        {/* Big status pill — visual anchor */}
        <div style={{
          background: active ? "var(--ember)" : "var(--paper-2)",
          color: active ? "#fff" : "var(--ink)",
          border: active ? "none" : "1px solid var(--line-2)",
          borderRadius: 14, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 14,
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: 12,
            background: active ? "rgba(255,255,255,0.92)" : "var(--line-2)",
            animation: active ? "pulse 1.6s infinite" : "none",
          }}/>
          <span className="serif" style={{ fontSize: 18, flex: 1 }}>
            {active ? "Sharing now" : "Not sharing"}
          </span>
          {active && (
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 700, opacity: 0.85 }}>
              {_fmtRemaining()}
            </span>
          )}
        </div>

        {/* What's shared */}
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700,
          marginBottom: 8,
        }}>WHAT'S SHARED</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10,
            background: "var(--paper-2)",
            cursor: canShareGps ? "pointer" : "not-allowed",
            opacity: canShareGps ? 1 : 0.55,
          }}>
            <input type="checkbox"
              checked={includeGps && canShareGps}
              disabled={!canShareGps}
              onChange={(e) => setIncludeGps(e.target.checked)}
              style={{ accentColor: "var(--ember)", width: 16, height: 16 }}
            />
            <span style={{ fontSize: 18 }}>📍</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500 }}>My GPS location</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2 }}>
                {gpsStatus === "live" && gpsPos
                  ? `LIVE · ±${Math.round(gpsPos.accuracy || 0)}m`
                  : gpsStatus === "locating" ? "FINDING…"
                  : gpsStatus === "denied"   ? "DENIED IN BROWSER"
                  : gpsStatus === "unavailable" ? "UNSUPPORTED"
                  : "OFF"}
              </div>
            </div>
          </label>

          <label style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 10,
            background: "var(--paper-2)", cursor: "pointer",
          }}>
            <input type="checkbox"
              checked={includeStage}
              onChange={(e) => setIncludeStage(e.target.checked)}
              style={{ accentColor: "var(--ember)", width: 16, height: 16 }}
            />
            <span style={{ fontSize: 18 }}>🎪</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500 }}>Current stage</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2 }}>
                {stage ? stage.name.toUpperCase() : "NOT SET — TAP “I'M AT” FIRST"}
              </div>
            </div>
          </label>
        </div>

        {/* GPS-denied inline banner */}
        {includeGps && isDenied && (
          <div style={{
            padding: "8px 11px", borderRadius: 999,
            background: "rgba(193,74,74,0.10)", border: "1px solid rgba(193,74,74,0.35)",
            marginBottom: 12,
          }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "#c14a4a", fontWeight: 700 }}>
              GPS DENIED · ENABLE LOCATION IN BROWSER
            </span>
          </div>
        )}

        {/* Auto-expire picker */}
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700,
          marginBottom: 8,
        }}>AUTO-EXPIRE AFTER</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {_SHARE_EXPIRY_OPTIONS.map(opt => {
            const on = expiryKey === opt.key;
            return (
              <button key={opt.key} onClick={() => setExpiryKey(opt.key)} style={{
                flex: 1, padding: "8px 4px", borderRadius: 999,
                background: on ? "var(--ink)" : "var(--paper-2)",
                color: on ? "var(--paper)" : "var(--ink)",
                border: on ? "none" : "1px solid var(--line-2)",
                fontFamily: "Geist Mono, monospace", fontSize: 9,
                letterSpacing: 1.1, fontWeight: 700, cursor: "pointer",
              }}>{opt.label}</button>
            );
          })}
        </div>

        {/* Shareable link — only meaningful while sharing AND we have a token.
            Copies a URL friends can open without installing Plursky. */}
        {active && shareState?.token && (
          <ShareLinkRow token={shareState.token} />
        )}

        {/* Battery callout */}
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.1, color: "var(--muted)",
          marginBottom: 14, textAlign: "center",
        }}>
          ⚡ USES ~1% MORE BATTERY PER HOUR
        </div>

        {/* Primary CTA */}
        {active ? (
          <button onClick={handleStop} style={{
            width: "100%", padding: "12px 16px", borderRadius: 999,
            background: "var(--paper-2)", color: "var(--ink)",
            border: "1px solid var(--line-2)", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 10,
            letterSpacing: 1.3, fontWeight: 700,
          }}>STOP SHARING</button>
        ) : (
          <button onClick={handleStart}
            disabled={(!includeGps || !canShareGps) && !includeStage}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 999,
              background: ((!includeGps || !canShareGps) && !includeStage)
                ? "var(--paper-2)" : "var(--ember)",
              color: ((!includeGps || !canShareGps) && !includeStage)
                ? "var(--muted)" : "#fff",
              border: "none",
              cursor: ((!includeGps || !canShareGps) && !includeStage) ? "default" : "pointer",
              fontFamily: "Geist Mono, monospace", fontSize: 10,
              letterSpacing: 1.3, fontWeight: 700,
            }}>START SHARING</button>
        )}
      </div>
    </div>
  );
}

// ── Meetups sheet ──────────────────────────────────────────────
// List + create form for offline-first crew meetup primitives. Same
// backdrop + paper pattern as ShareLocationSheet/IAmAtSheet.
function MeetupsSheet({ onClose }) {
  const [list, setList] = React.useState(() => upcomingMeetups());
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [stageId, setStageId] = React.useState(STAGES[0]?.id || "");
  const [whenLocal, setWhenLocal] = React.useState(() => {
    // Default to 1 hour from now, formatted for <input type="datetime-local">
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [notes, setNotes] = React.useState("");

  const reset = () => {
    setCreating(false);
    setName("");
    setStageId(STAGES[0]?.id || "");
    setNotes("");
  };

  const handleSave = () => {
    const atTs = new Date(whenLocal).getTime();
    if (!atTs || Number.isNaN(atTs)) return;
    const finalName = name.trim() || (STAGES.find(s => s.id === stageId)?.name || "Meetup");
    const next = addMeetup({ name: finalName, stageId, atTs, notes: notes.trim() });
    setList(next.filter(m => m.atTs > Date.now() - 30 * 60 * 1000));
    reset();
  };
  const handleRemove = (id) => {
    const next = removeMeetup(id);
    setList(next.filter(m => m.atTs > Date.now() - 30 * 60 * 1000));
  };

  const fmtWhen = (ts) => {
    try {
      const d = new Date(ts);
      const today = new Date();
      const sameDay = d.toDateString() === today.toDateString();
      const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const mins = Math.round((ts - Date.now()) / 60000);
      const rel = mins < 60 ? `IN ${Math.max(1, mins)}M`
                : mins < 24 * 60 ? `IN ${Math.round(mins / 60)}H`
                : `${d.toLocaleDateString([], { weekday: "short" }).toUpperCase()}`;
      return { primary: time, rel: sameDay ? rel : `${rel} · ${d.toLocaleDateString([], { weekday: "short" })}` };
    } catch { return { primary: "—", rel: "" }; }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(13,10,8,0.55)",
      zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460,
        background: "var(--paper)", color: "var(--ink)",
        borderRadius: "16px 16px 0 0",
        padding: "16px 18px 28px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>MEETUPS</span>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700, marginBottom: 12 }}>
          AGREE ON A PLACE + TIME BEFORE SERVICE DIES
        </div>

        {/* List */}
        {list.length === 0 && !creating && (
          <div style={{
            padding: "20px 12px", borderRadius: 12,
            background: "var(--paper-2)", textAlign: "center", marginBottom: 12,
          }}>
            <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>No meetups yet</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)" }}>
              CREATE ONE BELOW
            </div>
          </div>
        )}

        {list.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {list.map(m => {
              const stage = m.stageId ? STAGES.find(s => s.id === m.stageId) : null;
              const tFmt = fmtWhen(m.atTs);
              return (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12,
                  background: "var(--paper-2)",
                  borderLeft: stage ? `3px solid ${stage.color}` : "3px solid var(--line-2)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="serif" style={{ fontSize: 16, lineHeight: 1.2 }}>{m.name}</div>
                    <div className="mono" style={{
                      fontSize: 9, letterSpacing: 1.1, color: "var(--muted)",
                      marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap",
                    }}>
                      {stage && <span style={{ color: stage.color, fontWeight: 700 }}>{stage.name.toUpperCase()}</span>}
                      <span>{tFmt.primary}</span>
                      <span style={{ opacity: 0.6 }}>· {tFmt.rel}</span>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(m.id)} aria-label="Remove" style={{
                    background: "transparent", border: "none", color: "var(--muted)",
                    fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 4,
                  }}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Create form */}
        {!creating ? (
          <button onClick={() => setCreating(true)} style={{
            width: "100%", padding: "12px 16px", borderRadius: 999,
            background: "var(--ember)", color: "#fff", border: "none",
            cursor: "pointer", fontFamily: "Geist Mono, monospace",
            fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
          }}>+ NEW MEETUP</button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={`Find a stage or friend`} maxLength={60}
              style={{
                padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--line-2)", background: "var(--paper)",
                fontFamily: "Geist", fontSize: 14, color: "var(--ink)",
              }}/>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {STAGES.map(s => {
                const on = stageId === s.id;
                return (
                  <button key={s.id} onClick={() => setStageId(s.id)} style={{
                    padding: "6px 4px", borderRadius: 8,
                    background: on ? s.color : "var(--paper-2)",
                    color: on ? "#fff" : "var(--ink)",
                    border: on ? "none" : "1px solid var(--line-2)",
                    fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 0.8,
                    fontWeight: on ? 700 : 500, cursor: "pointer",
                  }}>{s.short}</button>
                );
              })}
            </div>
            <input type="datetime-local"
              value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)}
              style={{
                padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--line-2)", background: "var(--paper)",
                fontFamily: "Geist", fontSize: 14, color: "var(--ink)",
              }}/>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)" maxLength={200} rows={2}
              style={{
                padding: "10px 12px", borderRadius: 10,
                border: "1px solid var(--line-2)", background: "var(--paper)",
                fontFamily: "Geist", fontSize: 13, color: "var(--ink)", resize: "none",
              }}/>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={reset} style={{
                flex: 1, padding: "10px 12px", borderRadius: 999,
                background: "var(--paper-2)", color: "var(--ink)",
                border: "1px solid var(--line-2)", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              }}>CANCEL</button>
              <button onClick={handleSave} style={{
                flex: 1, padding: "10px 12px", borderRadius: 999,
                background: "var(--ember)", color: "#fff", border: "none", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              }}>SAVE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Saved-set reminders ──────────────────────────────────────
// 15-min-before reminder hook. Fires a Web Notification when a saved set
// is about to start. Two layers:
//   1) Permission + opt-in persisted in localStorage ("notify_enabled")
//   2) setInterval(60s) checks real wall-clock against each saved set's
//      absolute start time; fires once per set, deduped via fired Set.
// Limitation: only works while the app is open in a tab. Reliable
// background delivery requires a Web Push subscription + backend; the
// SW push handler in sw.js is already wired for that future swap.
function readNotifyEnabled() {
  try { return localStorage.getItem("notify_enabled") === "1"; } catch { return false; }
}
function writeNotifyEnabled(v) {
  try { localStorage.setItem("notify_enabled", v ? "1" : "0"); } catch {}
}
function _setStartRealMs(artist) {
  // Use FESTIVAL_CONFIG.dayDates to map (day, "HH:MM") → real local Date.
  const meta = FESTIVAL_CONFIG.dayDates?.[artist.day];
  if (!meta) return null;
  const [h, m] = artist.start.split(":").map(Number);
  const d = new Date(meta.y, meta.m, meta.d, h, m, 0, 0);
  // Sets before 08:00 are early-morning of the *next* calendar day
  if (h < 8) d.setDate(d.getDate() + 1);
  return d.getTime();
}
function useSavedSetReminders(savedIds, enabled) {
  const firedRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const readLead = () => {
      try {
        const raw = parseInt(localStorage.getItem("plursky_reminder_lead_min") || "", 10);
        if ([5, 15, 30, 60].includes(raw)) return raw;
      } catch {}
      return 15;
    };
    const tick = () => {
      const now = Date.now();
      const leadMin = readLead();
      savedIds.forEach(id => {
        if (firedRef.current.has(id)) return;
        const a = ARTISTS.find(x => x.id === id);
        if (!a) return;
        const startMs = _setStartRealMs(a);
        if (!startMs) return;
        const minsUntil = (startMs - now) / 60000;
        // Fire once when 0..leadMin minutes out
        if (minsUntil > 0 && minsUntil <= leadMin) {
          firedRef.current.add(id);
          try {
            const stage = STAGES.find(s => s.id === a.stage);
            new Notification(`${a.name} in ${Math.round(minsUntil)} min`, {
              body: `${stage?.name || a.stage} · ${fmt12(a.start)}`,
              tag: `set-${id}`,
              icon: "/og.svg",
            });
          } catch {}
        }
      });
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [savedIds, enabled]);
}

function NotifyPill({ enabled, onChange }) {
  const supported = typeof Notification !== "undefined";
  const denied = supported && Notification.permission === "denied";
  const onClick = async () => {
    if (!supported) return;
    if (enabled) { writeNotifyEnabled(false); onChange(false); return; }
    let perm = Notification.permission;
    if (perm === "default") {
      try { perm = await Notification.requestPermission(); } catch { perm = "denied"; }
    }
    if (perm !== "granted") { onChange(false); return; }
    writeNotifyEnabled(true);
    onChange(true);
    try {
      new Notification("Plursky notifications on", {
        body: "You'll get a heads-up 15 min before saved sets.",
        tag: "notify-on",
        icon: "/og.svg",
      });
    } catch {}
  };
  const label = !supported ? "N/A" : denied ? "BLOCKED" : enabled ? "🔔 ON" : "🔔 OFF";
  return (
    <button onClick={onClick} disabled={!supported || denied} title="Set reminders 15 min before saved sets" style={{
      display: "flex", alignItems: "center", gap: 4,
      background: enabled ? "var(--ember)" : "var(--paper)",
      color: enabled ? "#fff" : "var(--muted)",
      border: enabled ? "none" : "1px solid var(--line-2)",
      borderRadius: 999, padding: "3px 8px",
      fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
      cursor: supported && !denied ? "pointer" : "not-allowed",
      opacity: !supported || denied ? 0.55 : 1,
    }}>{label}</button>
  );
}

// ── Weather strip ────────────────────────────────────────────
// Live conditions at the festival lat/lng via Open-Meteo (free, no
// auth, CORS-friendly). Cached in localStorage for 1h so we don't
// hammer the API on every map mount. Vegas mid-May norms: 85°F days,
// 60°F nights, occasional 20+ mph wind gusts that knock totems over.
const WMO_LABELS = {
  0:"Clear", 1:"Mostly clear", 2:"Partly cloudy", 3:"Overcast",
  45:"Fog", 48:"Icy fog",
  51:"Drizzle", 53:"Drizzle", 55:"Drizzle",
  61:"Rain", 63:"Rain", 65:"Heavy rain",
  71:"Snow", 73:"Snow", 75:"Snow",
  80:"Showers", 81:"Showers", 82:"Heavy showers",
  95:"Thunder", 96:"Thunder", 99:"Severe thunder",
};
function _weatherEmoji(code, isNight) {
  if (code === 0 || code === 1) return isNight ? "🌙" : "☀️";
  if (code === 2 || code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 65) return "🌧️";
  if (code >= 71 && code <= 75) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}
function _weatherVibe({ tempF, windMph, code }) {
  if (code >= 95) return "Lightning — find shelter NOW.";
  if (code >= 61 && code <= 82) return "Rain — kandi runs first, dance second.";
  if (windMph >= 25) return "Heavy gusts — secure totems and headpieces.";
  if (windMph >= 15) return "Breezy — light layers stay zipped.";
  if (tempF <= 55) return "Cold for Vegas — long sleeves, hand warmers.";
  if (tempF <= 62) return "Cool night — bring a hoodie for sunrise.";
  if (tempF <= 72) return "Perfect dancing weather.";
  if (tempF <= 82) return "Warm — hydrate every set.";
  return "Hot — water station every set, no excuses.";
}
function readCachedWeather() {
  try {
    const raw = localStorage.getItem("weather_cache");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.ts || Date.now() - obj.ts > 60 * 60 * 1000) return null;
    return obj.data;
  } catch { return null; }
}
function writeCachedWeather(data) {
  try { localStorage.setItem("weather_cache", JSON.stringify({ ts: Date.now(), data })); } catch {}
}
function useWeather() {
  const [w, setW] = React.useState(readCachedWeather);
  React.useEffect(() => {
    if (w) return;
    const lat = FESTIVAL_LAT, lng = FESTIVAL_LNG;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    let cancelled = false;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled || !j?.current) return;
        const data = {
          tempF:    Math.round(j.current.temperature_2m),
          windMph:  Math.round(j.current.wind_speed_10m),
          code:     j.current.weather_code,
          isDay:    !!j.current.is_day,
        };
        writeCachedWeather(data);
        setW(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [w]);
  return w;
}
function WeatherStrip() {
  const w = useWeather();
  if (!w) return null;
  const label = WMO_LABELS[w.code] || "Conditions";
  const emoji = _weatherEmoji(w.code, !w.isDay);
  const isAlert = w.code >= 95 || w.windMph >= 25 || (w.code >= 61 && w.code <= 82);
  return (
    <div style={{
      width: "100%", display: "flex", alignItems: "center", gap: 8,
      padding: "5px 11px", marginTop: 6, borderRadius: 999,
      background: isAlert ? "rgba(232,93,46,0.10)" : "var(--paper-2)",
      border: `1px solid ${isAlert ? "rgba(232,93,46,0.45)" : "var(--line)"}`,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
      <span className="mono" style={{
        fontSize: 9, letterSpacing: 1.2, fontWeight: 700, flexShrink: 0,
        color: isAlert ? "var(--ember)" : "var(--muted)",
      }}>{(FESTIVAL_CONFIG.locationShort || FESTIVAL_CONFIG.brand || "").toUpperCase()}</span>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--ink)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{w.tempF}°F · {label}</span>
      <span className="mono" style={{
        fontSize: 9, letterSpacing: 0.8, fontWeight: 600, color: "var(--muted)", flexShrink: 0,
      }}>{w.windMph} MPH</span>
    </div>
  );
}

// Sunrise countdown to Kinetic Field — only renders 90 min before
// sunrise to 30 min after. EDC's sunrise sets at KIN are the festival's
// signature moment; this strip flags it so a vet doesn't sleep through.
function SunriseStrip({ avatar, onSelect }) {
  const sun = FESTIVAL_CONFIG.sunTimes?.[NOW.day];
  if (!sun) return null;
  const nowMin = toNightMin(NOW.time);
  const riseMin = toNightMin(sun.rise);
  const minsUntil = riseMin - nowMin;
  // Render window: 90 min before → 30 min after sunrise
  if (minsUntil > 90 || minsUntil < -30) return null;
  const kin = STAGES.find(s => s.id === "kinetic");
  if (!kin) return null;
  const dist = Math.hypot(kin.x - avatar.x, kin.y - avatar.y);
  const walk = computeWalkRange(avatar.x, avatar.y, kin, dist, NOW.time);
  const walkLabel = walk.lo === walk.hi ? `${walk.lo}` : `${walk.lo}–${walk.hi}`;
  const isUp = minsUntil <= 0;

  return (
    <button onClick={() => onSelect(kin.id)} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 8,
      padding: "5px 11px", marginTop: 6,
      background: "linear-gradient(90deg, #f59a36 0%, #e85d2e 60%, #a78bfa 100%)",
      color: "#fff", border: "none", borderRadius: 999,
      cursor: "pointer", textAlign: "left",
      boxShadow: "0 3px 10px rgba(245,154,54,0.30)",
    }}>
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>🌅</span>
      <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 800, opacity: 0.92, flexShrink: 0 }}>SUNRISE</span>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{isUp ? "Sun's up — head to the lotus" : "Hold the line"}</span>
      <span className="mono" style={{ fontSize: 10, letterSpacing: 1, fontWeight: 800, flexShrink: 0 }}>
        {isUp ? "NOW" : `${minsUntil}M`} · {walkLabel}M
      </span>
    </button>
  );
}

function NextSetStrip({ savedIds, avatar, onSelect }) {
  const next = findNextSavedSet(savedIds);
  if (!next) return null;
  const stage = STAGES.find(s => s.id === next.artist.stage);
  if (!stage) return null;
  const dist = Math.hypot(stage.x - avatar.x, stage.y - avatar.y);
  const walk = computeWalkRange(avatar.x, avatar.y, stage, dist, NOW.time);
  const walkLabel = walk.lo === walk.hi ? `${walk.lo}` : `${walk.lo}–${walk.hi}`;

  // "LIVE — 38m" vs "IN 0h 24m" framing
  const headline = next.isLive
    ? `LIVE · ${next.minsLeft}M`
    : next.minsUntil < 60
        ? `IN ${next.minsUntil}M`
        : `IN ${Math.floor(next.minsUntil/60)}H ${next.minsUntil%60}M`;
  // Walk vs start-time tension flag
  const willBeLate = !next.isLive && walk.hi >= next.minsUntil && next.minsUntil > 0;

  return (
    <button onClick={() => onSelect(stage.id)} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 9,
      padding: "6px 10px", marginTop: 6,
      background: next.isLive ? "var(--ember)" : "var(--ink)",
      color: next.isLive ? "#fff" : "var(--paper)",
      border: "none", borderRadius: 12,
      cursor: "pointer", textAlign: "left",
      boxShadow: next.isLive ? "0 3px 10px rgba(232,93,46,0.30)" : "0 2px 6px rgba(26,18,13,0.15)",
    }}>
      <div style={{ width: 5, alignSelf: "stretch", borderRadius: 3, background: stage.color }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{
          fontSize: 8, letterSpacing: 1.3, fontWeight: 700, opacity: 0.7, lineHeight: 1.1,
        }}>{next.isLive ? "★ NEXT — LIVE" : "★ NEXT"}</div>
        <div className="serif" style={{
          fontSize: 14, lineHeight: 1.15, letterSpacing: -0.2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {next.artist.name}
          <span className="mono" style={{ fontSize: 9, letterSpacing: 0.8, opacity: 0.6, marginLeft: 6 }}>
            {stage.short} · {fmt12(next.artist.start)}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.1, fontWeight: 800, lineHeight: 1.1 }}>
          {headline}
        </div>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 0.9, fontWeight: 600,
          opacity: willBeLate ? 1 : 0.7,
          color: willBeLate ? "#fbbf24" : "inherit",
          marginTop: 1,
        }}>{walkLabel}M{willBeLate ? " ⚠" : ""}</div>
      </div>
    </button>
  );
}

function MapScreen({ state, setState }) {
  const [selectedStage, setSelectedStage] = React.useState(state.focusStage || null);
  const [gpsLive, setGpsLive] = React.useState(true);
  const [demoAvatar, setDemoAvatar] = React.useState(AVATAR_START);
  const [friends, setFriends] = React.useState(FRIENDS);
  const [peek, setPeek] = React.useState(false);
  const [meetMode, setMeetMode] = React.useState(false);
  const [meetTarget, setMeetTarget] = React.useState(null);
  const [meetGroup, setMeetGroup] = React.useState([]);
  // Rally: a meet point I've broadcast to my crew (sender), and one a crew
  // member has broadcast to me (receiver). dismissed tracks rallies I've
  // declined so the 20s re-broadcast doesn't keep re-popping the banner.
  const [rallySent, setRallySent] = React.useState(false);
  const [incomingRally, setIncomingRally] = React.useState(null);
  const dismissedRallyRef = React.useRef(new Set());
  // "Crew gathered here": dismissed cluster signature (stageId:count) so the
  // nudge only re-appears when the gathering grows.
  const [clusterDismissed, setClusterDismissed] = React.useState(null);
  const clearMeet = () => { setMeetMode(false); setMeetTarget(null); setMeetGroup([]); setRallySent(false); sbClearRally(); };

  // Saved stages — a lightweight bookmark set persisted to localStorage so
  // "♥ SAVE" on the place card sticks across sessions. Surfaced back on the
  // card (filled heart) and as a ♥ marker in the search list.
  const [savedStages, setSavedStages] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("plursky_saved_stages_v1") || "[]")); }
    catch { return new Set(); }
  });
  const toggleSavedStage = React.useCallback((id) => {
    setSavedStages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("plursky_saved_stages_v1", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);
  // "GO HERE" on a stage → enter a lightweight navigation mode. Selecting a
  // stage already draws the animated walking route + ETA on the map (see the
  // route-line block in the SVG); GO HERE just collapses the full place card
  // to a slim "ROUTING TO" bar so that route is visible and you can start
  // walking. No meet-card reuse — this is purpose-built wayfinding chrome.
  const [navigating, setNavigating] = React.useState(false);
  // Any change of selected stage (pick a different one, or close) exits nav
  // mode so the next stage opens to its full card. GO HERE keeps the SAME
  // selectedStage, so this effect doesn't fire and nav mode sticks.
  React.useEffect(() => { setNavigating(false); }, [selectedStage]);
  const goToStage = React.useCallback((st) => {
    if (!st) return;
    setNavigating(true);
  }, []);

  const [search, setSearch] = React.useState("");
  // Bottom search sheet (Apple Maps pattern). Tap to expand from a thin
  // pill to a full sheet showing Find Nearby + heads-up strips. Auto-expands
  // when the user starts typing.
  const [searchSheetExpanded, setSearchSheetExpanded] = React.useState(false);
  const [heading, setHeading] = React.useState(0);
  const [chatFriend, setChatFriend] = React.useState(null);
  const [rideshareOpen, setRideshareOpen] = React.useState(false);
  const [showLabels, setShowLabels] = React.useState(false);
  // Official patron map over the real basemap: always on, no toggle. A
  // More-menu control was proposed with this layer and VETOED — the poster
  // IS the festival map, so a switch to turn it off is a setting nobody
  // needs and one more row in an already-long menu. RealMap's `officialMap`
  // prop defaults to true and stays in its signature so the layer remains
  // addressable if that call is ever revisited.
  const [showHeat,   setShowHeat]   = React.useState(false);
  // Real map (BETA) — guarded re-enable (2026-08-22). Never again a broken
  // festival-night map (EDC 2026-05-15 revert 139b50e): opt-in flag,
  // auto-fallback to the offline-safe SVG TopDownMap on offline-at-mount,
  // 12s boot timeout, 6 tile errors pre-first-load, or lib-load failure.
  const [useRealMap, setUseRealMap] = React.useState(() => {
    try { return localStorage.getItem("plursky_use_realmap") === "1"; } catch { return false; }
  });
  const [realMapNote, setRealMapNote] = React.useState(null);
  const _disableRealMap = (why) => {
    try { localStorage.removeItem("plursky_use_realmap"); } catch {}
    setUseRealMap(false);
    setRealMapNote((why || "Real map unavailable") + " — festival map shown");
    setTimeout(() => setRealMapNote(null), 7000);
  };
  // v133: pinch/button zoom + pan over the SVG TopDownMap. zoom=1 is fit-screen
  // (the v1.0 default view); >1 zooms in, <1 reveals more whitespace around
  // the festival footprint. Pan only takes effect when zoom > 1 — at zoom 1
  // a single tap still picks a stage (no gesture conflict).
  const [mapZoom, setMapZoom] = React.useState(1);
  const [mapPan,  setMapPan]  = React.useState({ x: 0, y: 0 });
  const MAP_ZOOM_MIN = 0.7, MAP_ZOOM_MAX = 3.5;
  const zoomIn  = () => setMapZoom(z => Math.min(MAP_ZOOM_MAX, +(z * 1.4).toFixed(3)));
  const zoomOut = () => setMapZoom(z => Math.max(MAP_ZOOM_MIN, +(z / 1.4).toFixed(3)));
  const zoomReset = () => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); };
  const [pingOpen, setPingOpen] = React.useState(false);
  const [iAmAtOpen, setIAmAtOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [meetupsOpen, setMeetupsOpen] = React.useState(false);
  // Local meetup list, refreshed on a 30s tick so the "IN 5M" countdowns
  // stay sensible and stale entries (>30 min past) clear themselves.
  const [meetups, setMeetups] = React.useState(() => upcomingMeetups());
  React.useEffect(() => {
    const id = setInterval(() => setMeetups(upcomingMeetups()), 30000);
    return () => clearInterval(id);
  }, []);
  // Also refresh whenever the meetups sheet closes (likely added/removed one)
  React.useEffect(() => {
    if (!meetupsOpen) setMeetups(upcomingMeetups());
  }, [meetupsOpen]);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [myStatusStage, setMyStatusStage] = React.useState(() => getMyStatus()?.stage || null);
  // shareState replaces the legacy `crewLive` boolean — single source of
  // truth for "what am I broadcasting and until when". Persisted so the
  // share survives app reloads but always respects the expiresAt watchdog.
  const [shareState, setShareState] = React.useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("plursky_share_state") || "null");
      if (s && s.expiresAt && s.expiresAt <= Date.now()) return null; // expired
      return s;
    } catch { return null; }
  });
  const isSharing = !!shareState?.active &&
                    (!shareState?.expiresAt || shareState.expiresAt > Date.now());
  const [crewSnap, setCrewSnap] = React.useState(() => sbGetPresSnap());
  const crewName = React.useMemo(() => {
    try { return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || ""; } catch { return ""; }
  }, []);
  // Push-style reminders for saved sets — see useSavedSetReminders below.
  const [notifyEnabled, setNotifyEnabled] = React.useState(readNotifyEnabled);
  useSavedSetReminders(state.saved, notifyEnabled);
  // Compass mode — rotate the entire map so the user's facing direction is
  // always "up". Uses DeviceOrientationEvent (with iOS permission gate).
  const [compass, setCompass] = React.useState(false);
  const [compassHeading, setCompassHeading] = React.useState(0);
  const [compassStatus, setCompassStatus] = React.useState("off"); // off/locating/live/denied/unavailable

  const enableCompass = React.useCallback(async () => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setCompassStatus("unavailable"); return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") { setCompassStatus("denied"); return; }
      } catch { setCompassStatus("denied"); return; }
    }
    setCompassStatus("locating");
    setCompass(true);
  }, []);

  const _compassRef = React.useRef({ smoothed: 0, absEverSeen: false });
  React.useEffect(() => {
    if (!compass) return;
    const ref = _compassRef.current;
    ref.absEverSeen = false;
    const handler = (e) => {
      let h = null;
      // iOS: webkitCompassHeading is calibrated true-north (preferred)
      if (e.webkitCompassHeading != null) {
        h = e.webkitCompassHeading;
      // Android Chrome: deviceorientationabsolute always has absolute=true
      } else if (e.absolute && e.alpha != null) {
        h = (360 - e.alpha) % 360;
        ref.absEverSeen = true;
      // Relative alpha only if no absolute source has fired (last resort)
      } else if (e.alpha != null && !ref.absEverSeen) {
        h = (360 - e.alpha) % 360;
      }
      if (h != null) {
        // Circular exponential smoothing (handles 359→1 wraparound)
        let delta = h - ref.smoothed;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        ref.smoothed = ((ref.smoothed + delta * 0.18) + 360) % 360;
        // Only push to state when change is visible (> 0.5°) to cut re-renders
        if (Math.abs(delta) > 0.5) setCompassHeading(Math.round(ref.smoothed * 2) / 2);
        setCompassStatus("live");
      }
    };
    window.addEventListener("deviceorientationabsolute", handler);
    window.addEventListener("deviceorientation", handler);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler);
      window.removeEventListener("deviceorientation", handler);
    };
  }, [compass]);

  // Real GPS → on-site map coords, off-site distance, or null
  const { pos: gpsPos, status: gpsStatus } = useGeolocation(gpsLive);
  const liveAvatar = React.useMemo(() => {
    if (!gpsPos) return null;
    const mi = distMiles(gpsPos.lat, gpsPos.lng, FESTIVAL_LAT, FESTIVAL_LNG);
    if (mi > ON_SITE_RADIUS_MI) return { offSite: true, mi };
    const { x, y } = gpsToMap(gpsPos.lat, gpsPos.lng);
    return {
      onSite: true,
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
      accuracy: gpsPos.accuracy,
    };
  }, [gpsPos]);

  const isLiveOnSite = !!liveAvatar?.onSite;
  // When we don't have real on-site GPS, use the demo avatar (auto-walks
  // toward selected stage / meet pin so the routing UI stays interactive).
  const useDemo = !isLiveOnSite;
  const avatar = isLiveOnSite ? { x: liveAvatar.x, y: liveAvatar.y } : demoAvatar;

  // Demo wander tick — only runs when not pinned to real on-site GPS.
  // Slows from 600ms → 2400ms in battery-saver mode (still feels alive,
  // 4× fewer renders).
  const { active: bsActive } = useBatterySaver();
  React.useEffect(() => {
    if (!useDemo) return;
    const id = setInterval(() => {
      const goal = meetMode && meetTarget ? meetTarget
                 : selectedStage ? STAGES.find(s => s.id === selectedStage)
                 : null;
      setDemoAvatar(a => {
        if (goal) {
          const dx = goal.x - a.x, dy = goal.y - a.y;
          const d = Math.hypot(dx, dy);
          setHeading(Math.atan2(dy, dx));
          if (d < 1.2) return a;
          return { x: a.x + (dx/d) * 0.35, y: a.y + (dy/d) * 0.35 };
        }
        return {
          x: Math.max(12, Math.min(88, a.x + (Math.random() - 0.5) * 0.2)),
          y: Math.max(12, Math.min(88, a.y + (Math.random() - 0.5) * 0.2)),
        };
      });
      setFriends(prev => prev.map(f => {
        if (meetMode && meetTarget && meetGroup.includes(f.id)) {
          const dx = meetTarget.x - f.x, dy = meetTarget.y - f.y;
          const d = Math.hypot(dx, dy);
          if (d < 1.2) return f;
          return { ...f, x: f.x + (dx/d) * 0.32, y: f.y + (dy/d) * 0.32 };
        }
        return {
          ...f,
          x: Math.max(12, Math.min(88, f.x + (Math.random() - 0.5) * 0.25)),
          y: Math.max(12, Math.min(88, f.y + (Math.random() - 0.5) * 0.25)),
        };
      }));
    }, bsActive ? 2400 : 600);
    return () => clearInterval(id);
  }, [useDemo, selectedStage, meetMode, meetTarget, meetGroup, bsActive]);

  // Heading derivation when real GPS is on-site and walking toward a goal
  React.useEffect(() => {
    if (!isLiveOnSite) return;
    const goal = meetMode && meetTarget ? meetTarget
               : selectedStage ? STAGES.find(s => s.id === selectedStage)
               : null;
    if (!goal) return;
    setHeading(Math.atan2(goal.y - avatar.y, goal.x - avatar.x));
  }, [isLiveOnSite, avatar.x, avatar.y, selectedStage, meetMode, meetTarget]);

  // Subscribe to Supabase Realtime presence — crew members broadcasting their stage
  React.useEffect(() => sbOnPresenceChange(s => setCrewSnap({ ...s })), []);

  // Incoming rally points from crew. Ignore ones I've dismissed (the caller
  // re-broadcasts every 20s) and clear the banner when the caller cancels.
  React.useEffect(() => sbOnRally(r => {
    if (r && dismissedRallyRef.current.has(r.rallyId)) return;
    setIncomingRally(r || null);
  }), []);

  // Convert presence snap → map positions for rendering
  const myPresId = sbGetMyPresId();
  const crewFriends = React.useMemo(() => {
    return Object.entries(crewSnap)
      .filter(([id]) => id !== myPresId)
      .map(([id, e]) => {
        // Prefer real GPS (set via Share With Crew → "📍 My GPS location");
        // fall back to stage centroid when only stage is broadcast.
        let x, y;
        if (e.gps && Number.isFinite(e.gps.lat) && Number.isFinite(e.gps.lng)) {
          const m = gpsToMap(e.gps.lat, e.gps.lng);
          x = Math.max(2, Math.min(98, m.x));
          y = Math.max(2, Math.min(98, m.y));
        } else {
          const st = e.stageId ? STAGES.find(s => s.id === e.stageId) : null;
          if (!st) return null;
          x = st.x; y = st.y;
        }
        return {
          id, name: e.name || "?",
          color: e.color || "#888",
          x, y, gps: e.gps || null,
          stageId: e.stageId, ts: e.ts,
        };
      }).filter(Boolean);
  }, [crewSnap, myPresId]);

  // Cluster crew by stage; surface the biggest gathering (>=2) as a nudge.
  // Serendipity layer that complements the active rally — "5 of your crew
  // are at Kinetic" → head over. Uses real crew presence (empty in demo).
  const crewCluster = React.useMemo(() => {
    if (!crewFriends.length) return null;
    const byStage = {};
    for (const f of crewFriends) {
      const sid = f.stageId || _nearestStageId(f.x, f.y);
      if (!sid) continue;
      (byStage[sid] = byStage[sid] || []).push(f);
    }
    let best = null;
    for (const [sid, arr] of Object.entries(byStage)) {
      if (arr.length >= 2 && (!best || arr.length > best.members.length)) {
        const st = STAGES.find(s => s.id === sid);
        if (st) best = { stage: st, members: arr };
      }
    }
    return best;
  }, [crewFriends]);

  // Persist shareState whenever it changes (or clear it when nulled).
  React.useEffect(() => {
    try {
      if (shareState) localStorage.setItem("plursky_share_state", JSON.stringify(shareState));
      else localStorage.removeItem("plursky_share_state");
    } catch {}
  }, [shareState]);

  // Drive Supabase presence from shareState. Joining is once-per-active-cycle
  // so we don't churn the channel on every GPS tick; pos/stage updates flow
  // through dedicated effects below.
  React.useEffect(() => {
    if (!isSharing) { sbPresenceLeave(); return; }
    const stageId = shareState.includeStage ? (myStatusStage || STAGES[0].id) : null;
    const gps = (shareState.includeGps && gpsPos)
      ? { lat: gpsPos.lat, lng: gpsPos.lng, accuracy: gpsPos.accuracy }
      : undefined;
    sbPresenceJoin({ name: crewName || "Anon", stageId, gps });
    return () => { /* leave handled by the next effect run or unmount */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharing]);

  // Unified broadcast heartbeat — fan out GPS/stage updates to both Supabase
  // Realtime presence (crew view) and the live_shares row (public link). One
  // effect avoids duplicate work; both write paths are idempotent.
  React.useEffect(() => {
    if (!isSharing) return;
    const gps = (shareState?.includeGps && gpsPos)
      ? { lat: gpsPos.lat, lng: gpsPos.lng, accuracy: gpsPos.accuracy }
      : undefined;
    const stageId = shareState?.includeStage ? (myStatusStage || STAGES[0].id) : null;
    if (gps || stageId !== undefined) sbPresenceUpdate({ gps, stageId });
    if (shareState?.token) sbLiveShareUpdate(shareState.token, { gps, stageId });
  }, [
    isSharing, shareState?.includeGps, shareState?.includeStage, shareState?.token,
    gpsPos?.lat, gpsPos?.lng, gpsPos?.accuracy, myStatusStage,
  ]);

  // Live share lifecycle: mint a token on first activation, upsert the row,
  // tear down on stop. Cleanup function fires when isSharing flips off or
  // shareState is cleared by the expiry watchdog.
  React.useEffect(() => {
    if (!isSharing) return;
    // First time → generate token, then wait for next render to actually start.
    if (!shareState.token) {
      const token = sbGenerateShareToken();
      setShareState(s => s ? { ...s, token } : s);
      return;
    }
    sbLiveShareStart({
      token: shareState.token,
      pid: sbGetMyPresId?.() || "anon",
      name: crewName || "Friend",
      expiresAt: shareState.expiresAt,
      gps: (shareState.includeGps && gpsPos)
        ? { lat: gpsPos.lat, lng: gpsPos.lng, accuracy: gpsPos.accuracy }
        : undefined,
      stageId: shareState.includeStage ? (myStatusStage || STAGES[0].id) : null,
    });
    const tokenCapture = shareState.token;
    return () => { sbLiveShareStop(tokenCapture); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSharing, shareState?.token]);

  // Auto-expiry watchdog. Schedules a one-shot timer for the remaining
  // window so we wake exactly when sharing should stop, without polling.
  React.useEffect(() => {
    if (!shareState?.active || !shareState.expiresAt) return;
    const remaining = shareState.expiresAt - Date.now();
    if (remaining <= 0) { setShareState(null); return; }
    const id = setTimeout(() => setShareState(null), Math.min(remaining, 2147483000));
    return () => clearTimeout(id);
  }, [shareState?.active, shareState?.expiresAt]);

  const stage = selectedStage ? STAGES.find(s => s.id === selectedStage) : null;
  const nowAtStage = stage ? ARTISTS.find(a => a.stage === stage.id && a.day === NOW.day) : null;
  const dx = stage ? stage.x - avatar.x : 0;
  const dy = stage ? stage.y - avatar.y : 0;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const walk = computeWalkRange(avatar.x, avatar.y, stage, dist, NOW.time);
  const meters = Math.round(dist * 22);

  // Search matches stages AND artists. Artist rows surface as
  // "Artist → stage", and tapping focuses that performer's stage on the map.
  const searchQuery = search.trim().toLowerCase();
  // Relevance score so "mar" surfaces "Marshmello" above "Armin van…" etc.
  // exact > prefix > word-start > substring, with a small tier tiebreak so
  // headliners win ties. (report-card #7)
  const _relevance = (name, term) => {
    const n = name.toLowerCase();
    if (n === term) return 100;
    if (n.startsWith(term)) return 80;
    if (n.split(/\s+/).some(w => w.startsWith(term))) return 60;
    if (n.includes(term)) return 40;
    return 0;
  };
  const stageMatches = React.useMemo(() => {
    if (!searchQuery) return [];
    return STAGES
      .map(s => ({ s, score: _relevance(s.name, searchQuery) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.s);
  }, [searchQuery]);
  const artistMatches = React.useMemo(() => {
    if (!searchQuery) return [];
    return ARTISTS
      .map(a => ({ a, score: _relevance(a.name, searchQuery) }))
      .filter(x => x.score > 0)
      .sort((x, y) => (y.score - x.score) || ((y.a.tier || 0) - (x.a.tier || 0)))
      .slice(0, 16)
      .map(x => x.a);
  }, [searchQuery]);

  // Click on map → drop meet pin
  const handleMapClick = (e) => {
    if (!meetMode) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const names = meetGroup.map(id => friends.find(f => f.id === id)?.name).filter(Boolean);
    setMeetTarget({ x, y, label: names.length ? `Meet ${names.join(" + ")}` : "Meet here" });
  };

  const toggleGroupMember = (friendId) => {
    const newGroup = meetGroup.includes(friendId)
      ? meetGroup.filter(id => id !== friendId)
      : [...meetGroup, friendId];
    setMeetGroup(newGroup);
    if (newGroup.length === 0) { setMeetTarget(null); return; }
    const selected = newGroup.map(id => friends.find(f => f.id === id)).filter(Boolean);
    const allX = [avatar.x, ...selected.map(f => f.x)];
    const allY = [avatar.y, ...selected.map(f => f.y)];
    const cx = allX.reduce((s, v) => s + v, 0) / allX.length;
    const cy = allY.reduce((s, v) => s + v, 0) / allY.length;
    setMeetTarget({ x: cx, y: cy, label: `Meet ${selected.map(f => f.name).join(" + ")}` });
  };

  // GPS pill label — reflects real status
  const gpsLabel = !gpsLive ? "OFF"
    : gpsStatus === "live"        ? (isLiveOnSite ? "LIVE" : "OFF-SITE")
    : gpsStatus === "locating"    ? "FINDING…"
    : gpsStatus === "denied"      ? "DENIED"
    : gpsStatus === "unavailable" ? "N/A"
    : "DEMO";
  const gpsActive = gpsLive && (gpsStatus === "live" || gpsStatus === "locating");

  // Unified sheet handles visibility internally based on stage/meetMode/search state.

  return (
    <Screen bg="var(--paper)" ink="var(--ink)">
      {/* MAP + PEEK WINDOW — full bleed; chrome floats over the map
          (Apple Maps / Snap Map pattern). */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--paper-2)" }}>
        <WellnessPill />

        {state._navStack?.length > 0 && (
          <button onClick={() => window._popNav?.()} aria-label="Back" style={{
            position: "absolute", top: 12, left: 10, zIndex: 5,
            width: 38, height: 38, borderRadius: 12,
            background: "rgba(247,237,224,0.92)", backdropFilter: "blur(10px)",
            border: "1px solid var(--line-2)", color: "var(--ink)",
            cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
        )}

        {/* ── Top-right icon column — GPS toggle + Layers menu. Glass
            background so it reads over any map style. */}
        <div style={{
          position: "absolute", top: 12, right: 10, zIndex: 4,
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <button onClick={() => setGpsLive(g => !g)} aria-label="Toggle GPS" aria-pressed={gpsActive} style={{
            minWidth: 46, padding: "6px 8px", borderRadius: 14,
            background: gpsActive ? "var(--ember)" : "rgba(247,237,224,0.92)",
            color: gpsActive ? "#fff" : (gpsStatus === "denied" ? "#c14a4a" : "var(--ink)"),
            border: gpsActive ? "none" : "1px solid var(--line-2)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12"/>
              <circle cx="12" cy="12" r="6"/>
              {gpsActive && <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>}
            </svg>
            <span className="mono" style={{
              fontSize: 9, letterSpacing: 0.8, fontWeight: 800, lineHeight: 1,
            }}>{gpsLabel}</span>
          </button>
          {/* Unified control capsule — layers + zoom in one glass pill */}
          <div style={{
            display: "flex", flexDirection: "column",
            background: "rgba(247,237,224,0.92)",
            border: "1px solid var(--line-2)",
            borderRadius: 14, overflow: "hidden",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
          }}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Map layers" aria-pressed={menuOpen} style={{
              width: 46, height: 36, padding: 0,
              background: menuOpen ? "var(--ink)" : "transparent",
              color: menuOpen ? "var(--paper)" : "var(--ink)",
              border: "none",
              borderBottom: "1px solid var(--line)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 L21 8 L12 13 L3 8 Z"/>
                <path d="M3 12 L12 17 L21 12"/>
                <path d="M3 16 L12 21 L21 16"/>
              </svg>
            </button>
            <button onClick={zoomIn} disabled={mapZoom >= MAP_ZOOM_MAX} aria-label="Zoom in" style={{
              width: 46, height: 36, padding: 0,
              background: "transparent", border: "none",
              borderBottom: "1px solid var(--line)",
              cursor: mapZoom >= MAP_ZOOM_MAX ? "default" : "pointer",
              opacity: mapZoom >= MAP_ZOOM_MAX ? 0.35 : 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink)", fontFamily: "Geist Mono, monospace",
              fontSize: 18, fontWeight: 600, lineHeight: 1,
            }}>+</button>
            <button onClick={zoomOut} disabled={mapZoom <= MAP_ZOOM_MIN} aria-label="Zoom out" style={{
              width: 46, height: 36, padding: 0,
              background: "transparent", border: "none",
              cursor: mapZoom <= MAP_ZOOM_MIN ? "default" : "pointer",
              opacity: mapZoom <= MAP_ZOOM_MIN ? 0.35 : 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink)", fontFamily: "Geist Mono, monospace",
              fontSize: 20, fontWeight: 600, lineHeight: 1,
            }}>−</button>
            {(mapZoom !== 1 || mapPan.x !== 0 || mapPan.y !== 0) && (
              <button onClick={zoomReset} aria-label="Reset zoom" style={{
                width: 46, padding: "5px 0",
                background: "var(--ink)", color: "var(--paper)",
                border: "none", borderTop: "1px solid var(--line)",
                cursor: "pointer",
                fontFamily: "Geist Mono, monospace",
                fontSize: 8, letterSpacing: 1.1, fontWeight: 700,
              }}>RESET</button>
            )}
          </div>
        </div>

        {/* Layers popover (anchored to the icon column above) */}
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 5 }}/>
            <div style={{
              position: "absolute", top: 90, right: 10, zIndex: 6,
              background: "var(--paper)", border: "1px solid var(--line-2)",
              borderRadius: 12, padding: 5, minWidth: 220,
              boxShadow: "0 10px 28px rgba(26,18,13,0.20)",
            }}>
              {[
                { id: "notify", label: "🔔  Reminders",
                  active: notifyEnabled,
                  onToggle: async () => {
                    if (typeof Notification === "undefined") return;
                    if (Notification.permission === "denied") return;
                    if (notifyEnabled) { writeNotifyEnabled(false); setNotifyEnabled(false); return; }
                    let perm = Notification.permission;
                    if (perm === "default") {
                      try { perm = await Notification.requestPermission(); } catch { perm = "denied"; }
                    }
                    if (perm !== "granted") { setNotifyEnabled(false); return; }
                    writeNotifyEnabled(true); setNotifyEnabled(true);
                  },
                },
                { id: "compass", label: "⌖  Compass mode",
                  active: compass && compassStatus === "live",
                  onToggle: () => { if (compass) { setCompass(false); setCompassStatus("off"); } else enableCompass(); },
                },
                { id: "crowd",  label: "🔥  Crowd heatmap",   active: showHeat,   onToggle: () => setShowHeat(s => !s) },
                { id: "labels", label: "🏷  Landmark labels", active: showLabels, onToggle: () => setShowLabels(s => !s) },
                { id: "realmap", label: "🗺  Real map (BETA)",  active: useRealMap,
                  onToggle: () => {
                    const v = !useRealMap;
                    try {
                      if (v) localStorage.setItem("plursky_use_realmap", "1");
                      else localStorage.removeItem("plursky_use_realmap");
                    } catch {}
                    setRealMapNote(null);
                    setUseRealMap(v);
                  },
                },
              ].map(item => (
                <div key={item.id} role="button" onClick={item.onToggle} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                }}>
                  <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{item.label}</span>
                  <span style={{
                    width: 30, height: 18, borderRadius: 18,
                    background: item.active ? "var(--ember)" : "var(--line-2)",
                    position: "relative", flexShrink: 0, transition: "background 0.15s",
                  }}>
                    <span style={{
                      position: "absolute", top: 2, left: item.active ? 14 : 2,
                      width: 14, height: 14, borderRadius: 14,
                      background: "#fff", transition: "left 0.18s",
                    }}/>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* GPS denied toast — small floating pill, top-center */}
        {gpsLive && gpsStatus === "denied" && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 4,
            padding: "4px 10px", borderRadius: 999,
            background: "rgba(193,74,74,0.95)", color: "#fff",
            backdropFilter: "blur(8px)",
          }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 700 }}>
              GPS DENIED · ENABLE LOCATION IN BROWSER
            </span>
          </div>
        )}

        {/* #6 Persistent live-sharing badge — sharing state is the trust
            backbone of the crew moat, so it's unmissable + one tap to stop
            (was buried in the overflow menu / a fumbleable GPS icon). */}
        {isSharing && (
          <button onClick={() => setShareState(null)} aria-label="Stop sharing your location" style={{
            position: "absolute", top: 46, left: "50%", transform: "translateX(-50%)",
            zIndex: 6, display: "flex", alignItems: "center", gap: 7,
            padding: "5px 12px", borderRadius: 999, cursor: "pointer", border: "none",
            background: "rgba(45,122,85,0.96)", color: "#fff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.35)", backdropFilter: "blur(8px)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: "#fff", animation: "pulse 1.6s infinite" }}/>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 800 }}>SHARING · TAP TO STOP</span>
          </button>
        )}

        {/* Off-site demo pill — top-center near GPS denied; clarifies we're showing demo data */}
        {liveAvatar?.offSite && !(gpsLive && gpsStatus === "denied") && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 4,
            padding: "5px 12px", borderRadius: 999,
            background: "rgba(245,154,54,0.95)", color: "#fff",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
          }} title={`${liveAvatar.mi.toFixed(1)} mi from venue · showing demo`}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>
              {liveAvatar.mi >= 1 ? `${liveAvatar.mi.toFixed(0)} MI AWAY` : "OUTSIDE VENUE"} · DEMO
            </span>
          </div>
        )}

        {/* Rideshare FAB — hidden; accessible via ⋯ menu to reduce map clutter */}

        {/* Bottom search sheet — Apple Maps pattern. Collapsed = just the
            input pill above the Friends bar. Expanded = Find Nearby chips +
            NextSet / Sunrise / Weather heads-up strips. Auto-expands while
            typing to show stage + artist results. Hidden when a stage is
            selected or meet mode is active so the place card takes over. */}
        {/* ── UNIFIED BOTTOM SHEET ────────────────────────────────
            Single surface: collapsed → half → full → place-card.
            Friends live inside the sheet as avatar dots (collapsed) or
            a full row (half). Stage place card is the same surface. */}
        {(() => {
          const hasPlaceCard = !!(stage || (meetMode && meetTarget));
          const sheetMode = hasPlaceCard ? "place-card" : search.trim().length > 0 ? "full" : searchSheetExpanded ? "half" : "collapsed";
          const isShort = typeof window !== "undefined" && window.innerHeight < 700;
          const sheetMaxH = sheetMode === "full" ? (isShort ? "44vh" : "48vh") : sheetMode === "half" ? (isShort ? 260 : 320) : 82;

          if (sheetMode === "place-card") return null;

          return (
            <div style={{
              position: "absolute", left: 8, right: 8, bottom: 10,
              zIndex: 5,
              background: "var(--paper)",
              border: "1px solid var(--line-2)",
              borderRadius: 16,
              boxShadow: "0 -6px 24px rgba(0,0,0,0.18)",
              maxHeight: sheetMaxH,
              overflow: "hidden",
              display: "flex", flexDirection: "column",
              transition: "max-height 0.3s var(--ease-smooth)",
              willChange: "max-height",
            }}>
              {/* Drag handle */}
              <div onClick={() => setSearchSheetExpanded(e => !e)} style={{
                display: "flex", justifyContent: "center", cursor: "pointer",
                padding: "6px 0 4px", flexShrink: 0,
              }}>
                <div style={{ width: 36, height: 4, borderRadius: 4, background: "var(--line-2)" }}/>
              </div>

              {/* Search input pill */}
              <div style={{ padding: "0 8px 6px", flexShrink: 0 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: "var(--paper-2)",
                  borderRadius: 999, padding: "7px 11px",
                  border: "1px solid var(--line)",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="7"/><path d="M20 20 L16 16"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search stages or artists…"
                    value={search}
                    onFocus={() => setSearchSheetExpanded(true)}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
                      color: "var(--ink)", fontFamily: "Geist, sans-serif", fontSize: 13,
                    }}
                  />
                  {search && (
                    <button onClick={() => { setSearch(""); }} aria-label="Clear search" style={{
                      background: "transparent", border: "none",
                      color: "var(--muted)", cursor: "pointer", padding: 0,
                      width: 18, height: 18, borderRadius: 999,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, lineHeight: 1, flexShrink: 0,
                    }}>×</button>
                  )}
                </div>
              </div>

              {/* Collapsed: friend avatar dots + MEET UP inline */}
              {sheetMode === "collapsed" && (
                <div style={{ padding: "0 10px 8px", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <button onClick={() => {
                    if (meetMode) { clearMeet(); }
                    else { setMeetMode(true); }
                  }} style={{
                    background: meetMode ? "var(--ember)" : "var(--ink)",
                    color: "#fff", border: "none", borderRadius: 999, padding: "4px 10px",
                    fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                  }}>{meetMode ? "× CANCEL" : "MEET UP"}</button>
                  <div className="no-scrollbar" style={{ display: "flex", gap: 3, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
                    {friends.map(f => {
                      const unread = unreadCount(f.id);
                      return (
                        <button key={f.id} onClick={() => setChatFriend(f)} aria-label={`Chat with ${f.name}`} style={{
                          position: "relative", flexShrink: 0, width: 22, height: 22,
                          borderRadius: 22, background: f.avatarTone, border: "1.5px solid #fff",
                          padding: 0, cursor: "pointer",
                        }}>
                          {unread > 0 && <span style={{
                            position: "absolute", top: -3, right: -3,
                            width: 8, height: 8, borderRadius: 8,
                            background: "var(--ember)", border: "1px solid var(--paper)",
                          }}/>}
                        </button>
                      );
                    })}
                    {crewFriends.map(f => (
                      <button key={f.id} onClick={() => setChatFriend({ id: f.id, presId: f.id, name: f.name, avatarTone: f.color, x: f.x, y: f.y })} aria-label={`Chat with ${f.name}`} style={{
                        flexShrink: 0, width: 22, height: 22, borderRadius: 22,
                        background: `${f.color}44`, border: `1.5px solid ${f.color}`,
                        padding: 0, cursor: "pointer", position: "relative",
                      }}>
                        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ width: 6, height: 6, borderRadius: 6, background: f.color, animation: "pulse 1.6s infinite" }}/>
                        </span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setMoreOpen(o => !o)} aria-label="More options" aria-pressed={moreOpen} style={{
                    background: "var(--paper-2)", border: "1px solid var(--line-2)",
                    borderRadius: 999, width: 26, height: 22, padding: 0,
                    cursor: "pointer", flexShrink: 0, fontSize: 14, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)",
                  }}>⋯</button>
                </div>
              )}

              {/* Search results (full) */}
              {search && (
                <div style={{ overflowY: "auto", padding: "0 8px 10px", flex: 1 }}>
                  <div style={{ background: "var(--paper-2)", borderRadius: 10 }}>
                    {stageMatches.length > 0 && (
                      <div className="mono" style={{ padding: "8px 12px 4px", fontSize: 9, letterSpacing: 1.4, color: "var(--muted)" }}>STAGES</div>
                    )}
                    {stageMatches.map((s) => (
                      <button key={`stage-${s.id}`} onClick={() => { setSelectedStage(s.id); setSearch(""); setSearchSheetExpanded(false); }} style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                        background: "transparent", border: "none", color: "var(--ink)", textAlign: "left", cursor: "pointer",
                        borderRadius: 10,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color, boxShadow: `0 0 6px ${s.color}` }}/>
                        <span style={{ fontFamily: "Geist, sans-serif", fontSize: 13, flex: 1 }}>{s.name}</span>
                        {savedStages.has(s.id) && <span aria-label="Saved" style={{ color: "var(--ember)", fontSize: 12 }}>♥</span>}
                      </button>
                    ))}
                    {artistMatches.length > 0 && (
                      <div className="mono" style={{ padding: "8px 12px 4px", fontSize: 9, letterSpacing: 1.4, color: "var(--muted)" }}>ARTISTS</div>
                    )}
                    {artistMatches.map((a) => {
                      const st = STAGES.find(s => s.id === a.stage);
                      const isSaved = state.saved.includes(a.id);
                      const when = a.start ? `${a.start}${a.day ? ` · D${a.day}` : ""}` : "";
                      return (
                        <button key={`artist-${a.id}`} onClick={() => { setSelectedStage(a.stage); setSearch(""); setSearchSheetExpanded(false); }} style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
                          background: "transparent", border: "none", color: "var(--ink)", textAlign: "left", cursor: "pointer",
                          borderRadius: 10,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: 8, background: st?.color || "var(--muted)", flexShrink: 0 }}/>
                          <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 1 }}>
                            <span style={{ fontFamily: "Geist, sans-serif", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {isSaved && <span style={{ color: "var(--ember)", marginRight: 4 }}>★</span>}{a.name}
                            </span>
                            {when && <span className="mono" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--muted)" }}>{when}</span>}
                          </span>
                          <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", flexShrink: 0 }}>
                            → {st?.short || st?.name || ""}
                          </span>
                        </button>
                      );
                    })}
                    {stageMatches.length === 0 && artistMatches.length === 0 && (
                      <div style={{ padding: "18px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 4 }}>No matches for "{search}"</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>Try an artist name, a stage, or a genre.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Half: heads-up strips + Find Nearby + friends row */}
              {!search && sheetMode === "half" && (
                <>
                  <div style={{
                    padding: "0 10px 8px",
                    display: "flex", flexDirection: "column", gap: 8,
                    flexShrink: 0,
                  }}>
                    <NextSetStrip
                      savedIds={state.saved}
                      avatar={avatar}
                      onSelect={(id) => { setSelectedStage(id); setPeek(false); setSearchSheetExpanded(false); }}
                    />
                    <SunriseStrip
                      avatar={avatar}
                      onSelect={(id) => { setSelectedStage(id); setPeek(false); setSearchSheetExpanded(false); }}
                    />
                    <WeatherStrip />
                  </div>
                  <div style={{ padding: "0 10px 6px" }}>
                    <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
                      {[
                        { type: "water",  label: "Water",  emoji: "💧", color: "#38bdf8" },
                        { type: "med",    label: "Medic",  emoji: "✚",  color: "#f87171" },
                        { type: "toilet", label: "Toilet", emoji: "🚻", color: "#94a3b8" },
                        { type: "charge", label: "Charge", emoji: "⚡", color: "#facc15" },
                        { type: "locker", label: "Locker", emoji: "🔒", color: "#a78bfa" },
                      ].map(c => (
                        <button key={c.type} onClick={() => {
                          const matches = (typeof AMENITIES !== "undefined" ? AMENITIES : []).filter(a => a.type === c.type);
                          if (!matches.length) return;
                          const nearest = matches
                            .map(a => ({ ...a, _d: Math.hypot(a.x - avatar.x, a.y - avatar.y) }))
                            .sort((a, b) => a._d - b._d)[0];
                          setMeetTarget({ x: nearest.x, y: nearest.y, label: nearest.label, isAmenity: true });
                          setMeetMode(true);
                          setSearchSheetExpanded(false);
                        }} className="mono" style={{
                          flexShrink: 0,
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "7px 12px", borderRadius: 999,
                          background: "var(--paper-2)", border: `1px solid ${c.color}55`,
                          color: "var(--ink)", cursor: "pointer",
                          fontSize: 10, letterSpacing: 1.1, fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}>
                          <span style={{ fontSize: 13, lineHeight: 1 }}>{c.emoji}</span>
                          <span>{c.label.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Saved spots — quick-tap destinations for ♥-saved stages,
                      the reachable home for the place-card SAVE action. */}
                  {savedStages.size > 0 && (
                    <div style={{ padding: "0 10px 6px" }}>
                      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700, padding: "0 2px 5px" }}>SAVED SPOTS</div>
                      <div className="no-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
                        {STAGES.filter(s => savedStages.has(s.id)).map(s => (
                          <button key={`saved-${s.id}`} onClick={() => { setSelectedStage(s.id); setPeek(false); setSearchSheetExpanded(false); }}
                            aria-label={`Open ${s.name}`} className="mono" style={{
                            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "7px 12px", borderRadius: 999,
                            background: "var(--paper-2)", border: `1px solid ${s.color}66`,
                            color: "var(--ink)", cursor: "pointer",
                            fontSize: 10, letterSpacing: 1.1, fontWeight: 700, whiteSpace: "nowrap",
                          }}>
                            <span style={{ color: "var(--ember)", fontSize: 11, lineHeight: 1 }}>♥</span>
                            <span>{s.name.toUpperCase()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Friends row inside the sheet */}
                  <div style={{
                    padding: "4px 8px 8px", display: "flex", alignItems: "center", gap: 6,
                    borderTop: "1px solid var(--line)", flexShrink: 0,
                  }}>
                    <button onClick={() => {
                      if (meetMode) { clearMeet(); }
                      else { setMeetMode(true); }
                    }} style={{
                      background: meetMode ? "var(--ember)" : "var(--ink)",
                      color: "#fff", border: "none", borderRadius: 999, padding: "6px 11px",
                      fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    }}>{meetMode ? "× CANCEL" : "MEET UP"}</button>
                    <button onClick={() => setMoreOpen(o => !o)} aria-label="More options" aria-pressed={moreOpen} style={{
                      background: moreOpen ? "var(--ink)" : "var(--paper-2)",
                      color: moreOpen ? "var(--paper)" : "var(--ink)",
                      border: moreOpen ? "none" : "1px solid var(--line-2)",
                      borderRadius: 999, width: 32, height: 26, padding: 0,
                      cursor: "pointer", flexShrink: 0, fontSize: 16, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>⋯</button>
                    <div className="no-scrollbar" style={{ display: "flex", gap: 5, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
                      {friends.map(f => {
                        const d = Math.round(Math.sqrt((f.x-avatar.x)**2 + (f.y-avatar.y)**2) * 1.8);
                        const active = meetGroup.includes(f.id);
                        return (
                          <button key={f.id} onClick={() => { if (meetMode) { toggleGroupMember(f.id); return; } setChatFriend(f); }}
                            style={{
                              position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                              padding: "3px 8px 3px 3px", borderRadius: 999,
                              background: active ? f.color : "var(--paper-2)",
                              border: `1px solid ${active ? f.color : "var(--line-2)"}`,
                              color: active ? "#fff" : "var(--ink)",
                              cursor: "pointer",
                              fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 0.4, fontWeight: 600,
                            }}>
                            <span style={{ width: 14, height: 14, borderRadius: 14, background: f.avatarTone, border: "1.2px solid #fff", flexShrink: 0 }}/>
                            {f.name.toUpperCase()}·{d}M
                            {unreadCount(f.id) > 0 && !meetMode && (
                              <span style={{
                                position: "absolute", top: -3, right: -3,
                                minWidth: 14, height: 14, padding: "0 4px",
                                background: "var(--ember)", color: "#fff",
                                borderRadius: 14, fontSize: 8, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                border: "1.5px solid var(--paper)",
                              }}>{unreadCount(f.id)}</span>
                            )}
                          </button>
                        );
                      })}
                      {crewFriends.map(f => {
                        const st = STAGES.find(s => s.id === f.stageId);
                        const minsAgo = f.ts ? Math.floor((Date.now() - f.ts) / 60000) : null;
                        const age = minsAgo == null ? "" : minsAgo < 1 ? " · now" : ` · ${minsAgo}m`;
                        return (
                          <button key={f.id}
                            onClick={() => setChatFriend({ id: f.id, presId: f.id, name: f.name, avatarTone: f.color, x: f.x, y: f.y })}
                            style={{
                              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                              padding: "3px 8px 3px 5px", borderRadius: 999,
                              background: `${f.color}22`, border: `1px solid ${f.color}`,
                              fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 0.4, fontWeight: 600,
                              color: "var(--ink)", cursor: "pointer",
                            }}>
                            <span style={{ width: 7, height: 7, borderRadius: 7, background: f.color, animation: "pulse 1.6s infinite", flexShrink: 0 }}/>
                            {f.name.toUpperCase()}
                            <span style={{ fontSize: 8, opacity: 0.7, letterSpacing: 0.8, color: st?.color }}>
                              {st?.short || ""}{age}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {useRealMap ? (
          <RealMap
            avatar={avatar} stages={STAGES}
            crewFriends={crewFriends}
            saved={state.saved}
            showHeat={showHeat}
            showLabels={showLabels}
            compass={compass && compassStatus === "live"}
            compassHeading={compassHeading}
            selected={selectedStage}
            meetMode={meetMode} meetTarget={meetTarget}
            onPickStage={(id) => { setSelectedStage(id); setPeek(false); }}
            onMapClick={(xy) => {
              if (!meetMode) return;
              const names = meetGroup.map(id => friends.find(f => f.id === id)?.name).filter(Boolean);
              setMeetTarget({ x: xy.x, y: xy.y, label: names.length ? `Meet ${names.join(" + ")}` : "Meet here" });
            }}
            onFatal={_disableRealMap}
          />
        ) : (
          <TopDownMap
            avatar={avatar} heading={heading} friends={friends} stages={STAGES}
            saved={state.saved} showLabels={showLabels} showHeat={showHeat} showAmenities={searchSheetExpanded}
            compass={compass && compassStatus === "live"}
            compassHeading={compassHeading}
            selected={selectedStage} meetMode={meetMode} meetTarget={meetTarget} meetGroup={meetGroup}
            crewFriends={crewFriends}
            zoom={mapZoom} pan={mapPan} zoomMin={MAP_ZOOM_MIN} zoomMax={MAP_ZOOM_MAX}
            onZoomChange={setMapZoom} onPanChange={setMapPan}
            onPickStage={(id) => { setSelectedStage(id); setPeek(false); }}
            onClick={handleMapClick}
          />
        )}
        {realMapNote && (
          <div style={{
            position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
            zIndex: 4, padding: "4px 10px", borderRadius: 999,
            background: "rgba(245,154,54,0.95)", color: "#fff",
            backdropFilter: "blur(8px)", maxWidth: "88%", textAlign: "center",
          }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 700 }}>
              {realMapNote.toUpperCase()}
            </span>
          </div>
        )}

        {/* Ground-level peek window (picture-in-picture) */}
        {stage && peek && (
          <GroundPeek stage={stage} onClose={() => setPeek(false)} />
        )}

        {/* Meet mode banner — full-width bar with clear affordance */}
        {meetMode && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            background: meetTarget ? "var(--ember)" : "rgba(26,18,13,0.92)",
            color: "#fff",
            padding: "10px 14px",
            paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            zIndex: 8, display: "flex", alignItems: "center", gap: 10,
            animation: "springIn 0.3s ease-out",
          }}>
            <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 7 }}>
              {meetTarget ? (
                <>
                  <span style={{ width: 7, height: 7, borderRadius: 7, background: "#fff", animation: "pulse 1.4s infinite" }}/>
                  {meetTarget.isAmenity
                    ? `→ ${meetTarget.label.toUpperCase()}`
                    : `${meetTarget.label.toUpperCase()} · ${meetGroup.length > 1 ? `GROUP (${meetGroup.length + 1})` : "BOTH"} WALKING`}
                </>
              ) : meetGroup.length ? "TAP THE MAP TO DROP A PIN" : "MEET MODE — TAP MAP TO DROP A PIN"}
            </span>
            {meetTarget && isSharing && (
              <button onClick={() => {
                const ok = sbBroadcastRally({
                  x: meetTarget.x, y: meetTarget.y, label: meetTarget.label,
                  stageId: meetTarget.stageId || _nearestStageId(meetTarget.x, meetTarget.y),
                });
                if (ok) setRallySent(true);
              }} disabled={rallySent} style={{
                background: rallySent ? "rgba(255,255,255,0.25)" : "#fff",
                color: rallySent ? "#fff" : "var(--ember)",
                border: "none", borderRadius: 999, padding: "5px 12px",
                cursor: rallySent ? "default" : "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 800,
              }}>{rallySent ? "✓ CREW PINGED" : "📣 RALLY CREW"}</button>
            )}
            <button onClick={clearMeet} style={{
              background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 999,
              padding: "5px 12px", color: "#fff", cursor: "pointer",
              fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            }}>× CANCEL</button>
          </div>
        )}

        {/* Incoming rally — a crew member dropped a meet point and pinged us */}
        {incomingRally && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 9,
            background: "linear-gradient(135deg, #7b3d9a, var(--ember))",
            color: "#fff", padding: "10px 14px",
            paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", gap: 10,
            animation: "springIn 0.3s ease-out",
          }}>
            <span style={{ fontSize: 18 }}>📣</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mono" style={{ display: "block", fontSize: 8.5, letterSpacing: 1.3, fontWeight: 800, opacity: 0.85 }}>
                {(incomingRally.fromName || "CREW").toUpperCase()} WANTS TO MEET
              </span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {incomingRally.label} · {distToMins(Math.hypot(incomingRally.x - avatar.x, incomingRally.y - avatar.y))} min away
              </span>
            </span>
            <button onClick={() => {
              dismissedRallyRef.current.add(incomingRally.rallyId);
              setMeetMode(true);
              setMeetTarget({ x: incomingRally.x, y: incomingRally.y, label: incomingRally.label, isRally: true });
              setIncomingRally(null);
            }} className="mono" style={{
              background: "#fff", color: "var(--ember)", border: "none", borderRadius: 999,
              padding: "6px 13px", cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 800, flexShrink: 0,
            }}>HEAD OVER</button>
            <button onClick={() => { dismissedRallyRef.current.add(incomingRally.rallyId); setIncomingRally(null); }} aria-label="Dismiss" style={{
              background: "rgba(0,0,0,0.2)", color: "#fff", border: "none", borderRadius: 999,
              width: 26, height: 26, cursor: "pointer", fontSize: 12, flexShrink: 0,
            }}>✕</button>
          </div>
        )}

        {/* "Crew gathered here" — serendipity nudge when >=2 crew share a stage */}
        {(() => {
          if (!crewCluster || meetMode || incomingRally) return null;
          const sig = `${crewCluster.stage.id}:${crewCluster.members.length}`;
          if (sig === clusterDismissed) return null;
          const headOver = () => {
            setMeetMode(true);
            setMeetTarget({ x: crewCluster.stage.x, y: crewCluster.stage.y, label: crewCluster.stage.name, stageId: crewCluster.stage.id });
            setClusterDismissed(sig);
          };
          return (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 8,
              background: "linear-gradient(135deg, #2d7a55, #1a120d)", color: "#fff",
              padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              display: "flex", alignItems: "center", gap: 10, animation: "springIn 0.3s ease-out",
            }}>
              <span style={{ display: "flex", flexShrink: 0 }}>
                {crewCluster.members.slice(0, 3).map((m, i) => (
                  <span key={m.id} style={{
                    width: 22, height: 22, borderRadius: 22, background: m.color || "#888",
                    border: "2px solid #1a120d", marginLeft: i ? -7 : 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, color: "#fff", fontFamily: "Geist Mono, monospace",
                  }}>{(m.name || "?")[0].toUpperCase()}</span>
                ))}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="mono" style={{ display: "block", fontSize: 8.5, letterSpacing: 1.3, fontWeight: 800, opacity: 0.8 }}>CREW GATHERED</span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {crewCluster.members.length} of your crew at {crewCluster.stage.name}
                </span>
              </span>
              <button onClick={headOver} className="mono" style={{
                background: "#fff", color: "#2d7a55", border: "none", borderRadius: 999,
                padding: "6px 13px", cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 800, flexShrink: 0,
              }}>HEAD OVER</button>
              <button onClick={() => setClusterDismissed(sig)} aria-label="Dismiss" style={{
                background: "rgba(0,0,0,0.2)", color: "#fff", border: "none", borderRadius: 999,
                width: 26, height: 26, cursor: "pointer", fontSize: 12, flexShrink: 0,
              }}>✕</button>
            </div>
          );
        })()}

        {/* PLACE CARD — same visual surface as unified sheet, positioned as absolute overlay */}
        {(stage || (meetMode && meetTarget)) && (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 6,
          }}>
            {stage && navigating ? (
              <StageNavBar
                stage={stage} walk={walk}
                onDetails={() => setNavigating(false)}
                onStop={() => { setNavigating(false); setSelectedStage(null); }}
              />
            ) : (
              <BottomSheet
                stage={stage} nowAtStage={nowAtStage} dist={dist} walk={walk}
                peek={peek} setPeek={setPeek}
                meetMode={meetMode} meetTarget={meetTarget} friends={friends} meetGroup={meetGroup} avatar={avatar}
                onClose={() => setSelectedStage(null)}
                onCancelMeet={clearMeet}
                onOpenArtist={(id) => setState({ ...state, tab: "home", artist: id })}
                onGoHere={goToStage}
                stageSaved={stage ? savedStages.has(stage.id) : false}
                onToggleSave={toggleSavedStage}
                state={state} setState={setState}
              />
            )}
          </div>
        )}

        {/* More-actions popover (PING / CREW / I'M AT) */}
        {moreOpen && (
          <>
            <div onClick={() => setMoreOpen(false)} style={{
              position: "absolute", inset: 0, zIndex: 6,
            }}/>
            <div style={{
              position: "absolute", left: 10, right: 10,
              bottom: stage || meetMode ? 184 : 96, zIndex: 7,
              background: "var(--paper)", border: "1px solid var(--line-2)",
              borderRadius: 14, padding: 5,
              boxShadow: "0 10px 28px rgba(26,18,13,0.20)",
            }}>
              <button onClick={() => { setPingOpen(true); setMoreOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 11px", background: "transparent", border: "none",
                borderRadius: 8, cursor: "pointer", color: "var(--ink)", textAlign: "left",
              }}>
                <span style={{ fontSize: 14, width: 18 }}>◉</span>
                <span style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500, flex: 1 }}>Ping code</span>
                <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", fontWeight: 700 }}>SHARE / DROP</span>
              </button>
              <button onClick={() => { setShareOpen(true); setMoreOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 11px",
                background: isSharing ? "rgba(45,122,85,0.10)" : "transparent",
                border: "none", borderRadius: 8, cursor: "pointer",
                color: "var(--ink)", textAlign: "left",
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 14,
                  background: isSharing ? "var(--success)" : "var(--line-2)",
                  animation: isSharing ? "pulse 1.6s infinite" : "none",
                }}/>
                <span style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500, flex: 1 }}>
                  Share with crew{crewFriends.length > 0 ? ` · ${crewFriends.length}` : ""}
                </span>
                <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: isSharing ? "var(--success)" : "var(--muted)", fontWeight: 700 }}>
                  {isSharing ? "ON" : "OFF"}
                </span>
              </button>
              {(() => {
                const ms = myStatusStage ? STAGES.find(s => s.id === myStatusStage) : null;
                return (
                  <button onClick={() => { setIAmAtOpen(true); setMoreOpen(false); }} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 11px", background: "transparent", border: "none",
                    borderRadius: 8, cursor: "pointer", color: "var(--ink)", textAlign: "left",
                  }}>
                    <span style={{ fontSize: 14, width: 18 }}>📍</span>
                    <span style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500, flex: 1 }}>I'm at…</span>
                    <span className="mono" style={{
                      fontSize: 9, letterSpacing: 1, fontWeight: 700,
                      color: ms ? ms.color : "var(--muted)",
                    }}>{ms ? ms.short : "PICK STAGE"}</span>
                  </button>
                );
              })()}
              <button onClick={() => { setMeetupsOpen(true); setMoreOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 11px", background: "transparent", border: "none",
                borderRadius: 8, cursor: "pointer", color: "var(--ink)", textAlign: "left",
              }}>
                <span style={{ fontSize: 14, width: 18 }}>🗓</span>
                <span style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500, flex: 1 }}>Meetups</span>
                <span className="mono" style={{
                  fontSize: 9, letterSpacing: 1, color: meetups.length ? "var(--ember)" : "var(--muted)", fontWeight: 700,
                }}>{meetups.length ? `${meetups.length} UPCOMING` : "NONE"}</span>
              </button>
              <button onClick={() => { setRideshareOpen(true); setMoreOpen(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 11px", background: "transparent", border: "none",
                borderRadius: 8, cursor: "pointer", color: "var(--ink)", textAlign: "left",
              }}>
                <span style={{ fontSize: 14, width: 18 }}>🚗</span>
                <span style={{ fontFamily: "Geist", fontSize: 13, fontWeight: 500, flex: 1 }}>Rideshare</span>
                <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", fontWeight: 700 }}>UBER / LYFT</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Chat drawer — opens on friend tap (when not in meet mode) */}
      {chatFriend && (
        <MessageDrawer
          friend={chatFriend}
          myPresId={myPresId}
          avatarStage={selectedStage}
          saved={state.saved}
          onClose={() => setChatFriend(null)}
          onSwitchToMeet={() => {
            setMeetMode(true);
            setMeetGroup([chatFriend.id]);
            const f = friends.find(fr => fr.id === chatFriend.id);
            if (f) setMeetTarget({ x: (avatar.x + f.x) / 2, y: (avatar.y + f.y) / 2, label: `Meet ${f.name}` });
            setChatFriend(null);
          }}
        />
      )}

      {/* BottomSheet moved inside map container as absolute overlay */}

      {rideshareOpen && <RideshareSheet onClose={() => setRideshareOpen(false)} />}

      {pingOpen && (
        <PingSheet
          friends={friends}
          onClose={() => setPingOpen(false)}
          onDropPin={(target) => {
            setMeetMode(true);
            setMeetTarget(target);
          }}
        />
      )}

      {iAmAtOpen && (
        <IAmAtSheet
          initialStage={myStatusStage}
          onClose={() => setIAmAtOpen(false)}
          onStatusSet={(stageId) => {
            setMyStatusStage(stageId);
            // If already sharing, the dedicated stage-update effect will
            // re-broadcast on the next render. We no longer auto-start
            // broadcasting from "I'm at" — the user goes through the
            // Share With Crew sheet's consent moment for that.
          }}
        />
      )}

      {shareOpen && (
        <ShareLocationSheet
          shareState={shareState}
          crewCount={crewFriends.length}
          crewCode={sbGetOrCreateGroupCode?.() || ""}
          gpsPos={gpsPos}
          gpsStatus={gpsStatus}
          myStatusStage={myStatusStage}
          onClose={() => setShareOpen(false)}
          onSave={(s) => setShareState(s)}
          onStop={() => setShareState(null)}
        />
      )}

      {meetupsOpen && (
        <MeetupsSheet onClose={() => setMeetupsOpen(false)} />
      )}
    </Screen>
  );
}

// ---- Stage silhouette icons ────────────────────────────────
// Per-stage SVG silhouette evoking each stage's real-world shape:
// Kinetic = lotus, Bass Pod = speaker stack, Circuit = hangar, etc.
// Drawn at (cx, cy) with base radius r in SVG units. Small enough to
// stay readable at full-map zoom but distinctive enough to skim.
function StageIcon({ id, cx, cy, r, on, color }) {
  const op = on ? 1 : 0.92;
  const W = "rgba(255,255,255,0.94)";

  if (id === "kinetic") {
    // Lotus: 4-petal flower with diamond core (matches Image #3 lotus arch)
    const pts = [0, 1, 2, 3].map(i => {
      const a = i * Math.PI/2 - Math.PI/2;
      const tx = cx + r*1.2*Math.cos(a), ty = cy + r*1.2*Math.sin(a);
      return <ellipse key={i} cx={tx} cy={ty} rx={r*0.55} ry={r*0.32}
        fill={color} opacity={op}
        transform={`rotate(${i*90 + 90} ${tx} ${ty})`}/>;
    });
    return (<g>
      {pts}
      <path d={`M ${cx},${cy-r*0.7} L ${cx+r*0.7},${cy} L ${cx},${cy+r*0.7} L ${cx-r*0.7},${cy} Z`} fill={W}/>
      <circle cx={cx} cy={cy} r={r*0.3} fill={color}/>
    </g>);
  }

  if (id === "circuit") {
    // Hangar: rounded rect with LED tunnel stripe
    return (<g>
      <rect x={cx-r*1.05} y={cy-r*0.7} width={r*2.1} height={r*1.4} rx={r*0.3} fill={color} opacity={op}/>
      <rect x={cx-r*0.75} y={cy-r*0.18} width={r*1.5} height={r*0.36} fill={W}/>
    </g>);
  }

  if (id === "basspod") {
    // Triangular speaker stack pointing up
    return (<g>
      <path d={`M ${cx},${cy-r*1.05} L ${cx+r},${cy+r*0.7} L ${cx-r},${cy+r*0.7} Z`} fill={color} opacity={op}/>
      <circle cx={cx} cy={cy+r*0.1} r={r*0.32} fill={W}/>
      <line x1={cx-r*0.55} y1={cy+r*0.55} x2={cx+r*0.55} y2={cy+r*0.55} stroke={W} strokeWidth={r*0.15} strokeLinecap="round"/>
    </g>);
  }

  if (id === "neon") {
    // Hexagon (greenhouse / honeycomb)
    const pts = [0, 1, 2, 3, 4, 5].map(i => {
      const a = i * Math.PI/3 - Math.PI/2;
      return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`;
    }).join(" ");
    return (<g>
      <polygon points={pts} fill={color} opacity={op}/>
      <circle cx={cx} cy={cy} r={r*0.32} fill={W}/>
    </g>);
  }

  if (id === "cosmic") {
    // Sun/dome with rays
    return (<g>
      {[0, 60, 120, 180, 240, 300].map(deg => {
        const a = deg * Math.PI/180;
        return <line key={deg}
          x1={cx + r*0.9*Math.cos(a)} y1={cy + r*0.9*Math.sin(a)}
          x2={cx + r*1.4*Math.cos(a)} y2={cy + r*1.4*Math.sin(a)}
          stroke={color} strokeWidth={r*0.22} strokeLinecap="round" opacity={op}/>;
      })}
      <circle cx={cx} cy={cy} r={r*0.85} fill={color} opacity={op}/>
      <circle cx={cx} cy={cy} r={r*0.35} fill={W}/>
    </g>);
  }

  if (id === "stereo") {
    // 6-petal bloom
    return (<g>
      {[0, 60, 120, 180, 240, 300].map(deg => {
        const a = deg * Math.PI/180;
        const px = cx + r*0.6*Math.cos(a), py = cy + r*0.6*Math.sin(a);
        return <ellipse key={deg} cx={px} cy={py} rx={r*0.55} ry={r*0.32}
          fill={color} opacity={on ? 0.95 : 0.85}
          transform={`rotate(${deg} ${px} ${py})`}/>;
      })}
      <circle cx={cx} cy={cy} r={r*0.32} fill={W}/>
    </g>);
  }

  if (id === "bionic") {
    // Tree: trunk + canopy
    return (<g>
      <rect x={cx-r*0.18} y={cy+r*0.05} width={r*0.36} height={r*0.85} fill={color} opacity={op}/>
      <circle cx={cx} cy={cy-r*0.18} r={r*0.95} fill={color} opacity={op}/>
      <circle cx={cx-r*0.3} cy={cy-r*0.35} r={r*0.32} fill={W} opacity="0.6"/>
      <circle cx={cx} cy={cy-r*0.18} r={r*0.32} fill={W}/>
    </g>);
  }

  if (id === "quantum") {
    // Pyramid (trance peak) with prism inset
    return (<g>
      <path d={`M ${cx},${cy-r*1.05} L ${cx+r},${cy+r*0.65} L ${cx-r},${cy+r*0.65} Z`} fill={color} opacity={op}/>
      <path d={`M ${cx-r*0.55},${cy-r*0.1} L ${cx+r*0.55},${cy-r*0.1} L ${cx},${cy+r*0.5} Z`} fill={W} opacity="0.92"/>
    </g>);
  }

  if (id === "waste") {
    // Industrial 8-point gear/star
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI/8 - Math.PI/2;
      const rad = i % 2 === 0 ? r : r * 0.62;
      pts.push(`${cx + rad*Math.cos(a)},${cy + rad*Math.sin(a)}`);
    }
    return (<g>
      <polygon points={pts.join(" ")} fill={color} opacity={op}/>
      <circle cx={cx} cy={cy} r={r*0.32} fill={W}/>
    </g>);
  }

  // Fallback: original 2-circle dot
  return (<g>
    <circle cx={cx} cy={cy} r={r} fill={color} opacity={op}/>
    <circle cx={cx} cy={cy} r={r*0.38} fill={W}/>
  </g>);
}

// ─── Map styles (kept simple, all free / no token required) ──────
const REAL_MAP_STYLES = {
  stylized: {
    label: "STYLIZED",
    url: "https://tiles.openfreemap.org/styles/liberty",
  },
  satellite: {
    label: "SATELLITE",
    // Inline raster style: Esri World Imagery tiles, free for non-commercial.
    // If commercial use becomes a concern, swap to Mapbox/MapTiler satellite.
    style: {
      version: 8,
      sources: {
        sat: {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery © Esri, Maxar",
        },
      },
      layers: [{ id: "sat", type: "raster", source: "sat" }],
    },
  },
};

// Inject the keyframes/classes we use on map markers exactly once.
// Lives in the document head so swapping the map style doesn't drop it.
function _ensureRealMapStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("plursky-realmap-styles")) return;
  const el = document.createElement("style");
  el.id = "plursky-realmap-styles";
  el.textContent = [
    "@keyframes plursky-stage-pulse {",
    "  0%,100% { transform: scale(1); }",
    "  50%     { transform: scale(1.35); }",
    "}",
    "@keyframes plursky-halo-pulse {",
    "  0%   { transform: scale(0.7); opacity: 0.55; }",
    "  100% { transform: scale(2.2); opacity: 0; }",
    "}",
    ".plursky-stage-selected { animation: plursky-stage-pulse 1.6s ease-in-out infinite; }",
    ".plursky-avatar-halo {",
    "  position: absolute; top: 50%; left: 50%;",
    "  width: 40px; height: 40px; margin: -20px 0 0 -20px;",
    "  border-radius: 999px; background: rgba(245,154,54,0.55);",
    "  animation: plursky-halo-pulse 2.2s ease-out infinite;",
    "  pointer-events: none;",
    "}",
  ].join("\n");
  document.head.appendChild(el);
}

// ─── MapLibre lazy loader ───────────────────────────────────────
// Loaded only when the user toggles the "Real map (BETA)" experiment.
// Adds ~330KB of JS to the page, so we keep it off the initial bundle.
let _mapLibrePromise = null;
function _loadMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (_mapLibrePromise) return _mapLibrePromise;
  _mapLibrePromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
    s.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibregl missing"));
    s.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(s);
  });
  return _mapLibrePromise;
}

// Inverse of gpsToMap. Given a 100-space (x, y) inside the LVMS infield,
// return (lat, lng). Same 3-point affine, solved in the other direction.
function mapToGps(x, y) {
  if (!MAP_AFFINE) return { lat: FESTIVAL_CONFIG.gps.lat, lng: FESTIVAL_CONFIG.gps.lng };
  const A = MAP_AFFINE.x;  // [ax, ay, cx]
  const B = MAP_AFFINE.y;  // [bx, by, cy]
  const det = A[0]*B[1] - A[1]*B[0];
  const lat = ( B[1]*(x - A[2]) - A[1]*(y - B[2])) / det;
  const lng = (-B[0]*(x - A[2]) + A[0]*(y - B[2])) / det;
  return { lat, lng };
}

// ── Official-map (poster) geo-anchoring ───────────────────────
// The official patron map is authored against the SAME 0-100 grid the stage
// x/y live on, so mapToGps() already knows how to place it in the world. The
// only subtlety is HOW MUCH of the image the 0-100 box covers.
//
// TopDownMap draws it as <image x=0 y=0 width=100 height=100
// preserveAspectRatio="xMidYMid slice"> — "slice" means COVER: scale until the
// short edge fills, centre, crop the overflow. Three of the five assets are
// deliberately square (acl-park 1708², ef-forest 1200², lostlands 1400²) so
// cover is exact and the extent is the plain 0-100 box. Two are NOT:
// edc-map-2026.jpg is 1320×1649 and edco-tinker-2026.jpg is 960×1200, both
// ~0.80 aspect, so the SVG crops ~12.5% off the top AND bottom.
//
// MapLibre's `image` source does no cropping — it stretches the WHOLE image
// into the quad it is given. Feeding it the plain 0-100 corners would squash
// EDC's poster by 25% vertically and slide every printed feature off the stage
// dots. So we return the extent the FULL image occupies in 0-100 space, which
// for a 0.8-aspect asset runs y = -12.5 .. 112.5. The cropped strips then sit
// outside the SVG's box but in the geographically correct place, which is
// strictly more map, correctly anchored.
function _officialMapExtent(natW, natH) {
  if (!natW || !natH) return { x0: 0, y0: 0, x1: 100, y1: 100 };
  const scale = Math.max(100 / natW, 100 / natH);   // "slice" == CSS cover
  const w = natW * scale, h = natH * scale;
  const x0 = (100 - w) / 2, y0 = (100 - h) / 2;
  return { x0, y0, x1: x0 + w, y1: y0 + h };
}

// Natural dimensions of a map asset, memoised per src. Measured at runtime
// rather than hardcoded so replacing a provisional poster with the official
// one (the flip-session ritual) needs no code change — drop the file in and
// the anchoring retunes itself.
const _imgDimsCache = {};
function _officialMapDims(src) {
  if (_imgDimsCache[src]) return _imgDimsCache[src];
  _imgDimsCache[src] = new Promise((resolve) => {
    const im = new Image();
    im.onload  = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = src;
  });
  return _imgDimsCache[src];
}

// Corner quad for a MapLibre `image` source: [TL, TR, BR, BL] as [lng, lat].
function _officialMapCorners(natW, natH) {
  const e = _officialMapExtent(natW, natH);
  const pt = (x, y) => { const { lat, lng } = mapToGps(x, y); return [lng, lat]; };
  return [pt(e.x0, e.y0), pt(e.x1, e.y0), pt(e.x1, e.y1), pt(e.x0, e.y1)];
}

// ─── RealMap ────────────────────────────────────────────────────
// MapLibre-based festival map. Real LVMS geography, native pinch-zoom
// and pan, tilted pitch for a 3D feel. Stage markers + avatar + route
// line are overlay layers projected from the existing 100-space x/y
// via mapToGps(). Behind the "Real map (BETA)" toggle in the More menu;
// when off, MapScreen falls back to the SVG TopDownMap.
function RealMap({
  avatar, stages, crewFriends = [], saved = [],
  showHeat = false, showLabels = false, officialMap = true,
  compass = false, compassHeading = 0,
  selected, meetMode = false, meetTarget, onPickStage, onMapClick,
  onFatal,
}) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const stageMarkersRef = React.useRef({});
  const avatarMarkerRef = React.useRef(null);
  const meetMarkerRef = React.useRef(null);
  const savedStarMarkersRef = React.useRef({});
  const friendMarkersRef = React.useRef({}); // id -> { marker, lastSig }
  const landmarkElsRef = React.useRef([]);  // landmark label elements, toggled by showLabels
  const officialMapDimsRef = React.useRef(null); // natural {w,h} of the poster asset
  const officialMapRef = React.useRef(officialMap);
  const showLabelsRef = React.useRef(showLabels);
  const onPickStageRef = React.useRef(onPickStage);
  const onMapClickRef = React.useRef(onMapClick);
  const meetModeRef = React.useRef(meetMode);
  const [loaded, setLoaded] = React.useState(false);
  const [err, setErr] = React.useState(null);
  // Fatal-fallback wiring (2026-08-22): one-shot; MapScreen flips back to the
  // SVG TopDownMap and clears the BETA flag so a bad network/failing tiles
  // can never trap the map again at festival time.
  const fatalRef = React.useRef(false);
  const loadedRef = React.useRef(false);
  const tileErrRef = React.useRef(0);
  const _fatal = React.useCallback((why) => {
    if (fatalRef.current) return; fatalRef.current = true;
    console.warn("[plursky-map] fatal — falling back to SVG map:", why);
    try { onFatal?.(typeof why === "string" ? why : null); } catch {}
  }, [onFatal]);
  const [styleKey, setStyleKey] = React.useState(() => {
    try { return localStorage.getItem("plursky_real_map_style") || "satellite"; } catch { return "satellite"; }
  });

  // Read through a ref so the map-init effect (which runs once) always sees
  // the CURRENT toggle state without listing showLabels as a dependency and
  // tearing the whole map down on every toggle.
  const _applyLandmarkVisibility = React.useCallback(() => {
    const vis = showLabelsRef.current ? "" : "none";
    landmarkElsRef.current.forEach((el) => { el.style.display = vis; });
  }, []);
  React.useEffect(() => {
    showLabelsRef.current = showLabels;
    _applyLandmarkVisibility();
  }, [showLabels, _applyLandmarkVisibility]);

  // Official-map toggle. Visibility rather than add/remove: re-adding the
  // layer would re-download the asset and re-race the beforeId placement.
  React.useEffect(() => {
    officialMapRef.current = officialMap;
    const map = mapRef.current;
    if (!map || !map.getLayer?.("official-map")) return;
    try {
      map.setLayoutProperty("official-map", "visibility", officialMap ? "visible" : "none");
    } catch {}
  }, [officialMap]);

  React.useEffect(() => { onPickStageRef.current = onPickStage; }, [onPickStage]);
  React.useEffect(() => { onMapClickRef.current  = onMapClick;  }, [onMapClick]);
  React.useEffect(() => { meetModeRef.current    = meetMode;    }, [meetMode]);

  // Init MapLibre once on mount
  React.useEffect(() => {
    _ensureRealMapStyles();
    let cancelled = false;
    // Guards (2026-08-22): at a festival the network can be dead — don't strand
    // the user on a map that needs remote tiles. Bail to the SVG map fast.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      console.warn("[plursky-map] offline at mount — skipping RealMap");
      _fatal("No network connection");
      return () => {};
    }
    const bootTimer = setTimeout(() => {
      if (!loadedRef.current && !fatalRef.current) _fatal("Real map timed out");
    }, 12000);
    _mapLog("[plursky-map] RealMap useEffect — calling _loadMapLibre()");
    _loadMapLibre().then((maplibregl) => {
      _mapLog("[plursky-map] _loadMapLibre resolved — MapLibre loaded");
      if (cancelled || !containerRef.current) {
        console.warn("[plursky-map] aborted post-load: cancelled=" + cancelled + " hasContainer=" + !!containerRef.current);
        return;
      }
      const center = FESTIVAL_CONFIG.gps;
      const initialStyle = REAL_MAP_STYLES[styleKey] || REAL_MAP_STYLES.stylized;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle.style || initialStyle.url,
        center: [center.lng, center.lat],
        // Tight default zoom — the festival fills the view by default
        // (Snapchat-style "this map is for the fairgrounds, not Vegas").
        // setMaxBounds below pins panning to ±400m of the festival.
        zoom: 16.2,
        // Slight isometric pitch — Snapchat Map vibe. Each stage's iconic
        // 3D shape (lotus, pyramid, dome, gear, etc.) reads as a stylized
        // building, with the name pill floating above it.
        pitch: 18,
        bearing: 0,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;

      // Flexible polygon generator around (lat,lng) with optional
      // alternating inner/outer radii (for star/flower/gear shapes) and
      // non-uniform XY scaling (for rectangles + ovals). Equirectangular
      // at local lat for longitude correction — accurate at festival scale.
      const _shapePolygon = (lat, lng, opts) => {
        const EARTH = 6378137;
        const out = [];
        const lngScale = 1 / Math.cos((lat * Math.PI) / 180);
        const rot = ((opts.rot || 0) * Math.PI) / 180;
        const ax = (opts.aspect && opts.aspect[0]) || 1;
        const ay = (opts.aspect && opts.aspect[1]) || 1;
        const innerMult = opts.altInner;     // alternate inner-radius for star/gear/petal shapes
        for (let i = 0; i <= opts.sides; i++) {
          const a = (i / opts.sides) * 2 * Math.PI + rot;
          const r = (innerMult != null && i % 2 === 1) ? opts.radius * innerMult : opts.radius;
          const dx = r * Math.cos(a) * ax;
          const dy = r * Math.sin(a) * ay;
          const dLat = (dy / EARTH) * (180 / Math.PI);
          const dLng = (dx / EARTH) * (180 / Math.PI) * lngScale;
          out.push([lng + dLng, lat + dLat]);
        }
        return [out];
      };

      // Per-stage silhouette tuned to match Plursky's StageIcon SVG art
      // (each stage's iconic shape on the SVG TopDownMap) — lotus for
      // Kinetic, pyramid for Quantum, dome for Bionic, 6-petal bloom for
      // Stereo, sunburst for Cosmic, hex grid for Neon, industrial gear
      // for Wasteland, diamond speaker for Bass Pod, hangar rectangle
      // for Circuit. Heights are exaggerated for visual impact at the
      // festival's zoom range; mainstage Kinetic dwarfs side stages.
      // Per-amenity-type silhouette + color, matching the existing SVG
      // amenity dot palette. Shapes chosen to evoke each type: octagon
      // tap for water, diamond for food, square cross for medic, hex for
      // toilets, star for art, circle info booth, diamond bolt for
      // charging, square locker. Heights are intentionally small so
      // amenities never compete visually with stages.
      const AMENITY_DESIGN = {
        water:  { color: "#38bdf8", height: 14, radius: 5, sides:  8 },
        food:   { color: "#fb923c", height: 16, radius: 6, sides:  4, rot: 45 },
        med:    { color: "#ef4444", height: 18, radius: 6, sides:  4 },
        toilet: { color: "#64748b", height: 12, radius: 5, sides:  6 },
        art:    { color: "#f59a36", height: 22, radius: 7, sides: 12, altInner: 0.5 },
        info:   { color: "#16a34a", height: 14, radius: 5, sides: 24 },
        charge: { color: "#facc15", height: 16, radius: 5, sides:  4, rot: 22.5 },
        locker: { color: "#a78bfa", height: 13, radius: 5, sides:  4 },
      };
      const amenitiesExtrusionData = () => ({
        type: "FeatureCollection",
        features: (window.AMENITIES || []).map((a) => {
          const { lat, lng } = mapToGps(a.x, a.y);
          const d = AMENITY_DESIGN[a.type] || AMENITY_DESIGN.info;
          return {
            type: "Feature",
            properties: {
              id: a.id,
              type: a.type,
              label: a.label,
              color: d.color,
              height: d.height,
            },
            geometry: {
              type: "Polygon",
              coordinates: _shapePolygon(lat, lng, {
                sides: d.sides,
                radius: d.radius,
                rot: d.rot || 0,
                altInner: d.altInner,
              }),
            },
          };
        }),
      });

      // Sub-landmark labels — named places printed on the official patron
      // map (walkways + districts + standalone art), projected into GPS and
      // rendered as DOM markers below.
      //
      // Was a hardcoded EDC list here AND a second copy in TopDownMap. Both
      // are now FESTIVAL_CONFIG.landmarks, so ACL no longer gets "KINETIC
      // TRAIL" drawn across Zilker Park. A festival with no landmarks key
      // renders none, which is the correct empty state rather than a bug.
      const SUB_LANDMARKS = FESTIVAL_CONFIG.landmarks || [];

      // Stage heights tuned for Snapchat-style isometric overlay — building
      // scale (12-32m), NOT the prior 80-220m skyscrapers. At pitch ~22°
      // these read as distinctive stylized buildings without dominating
      // the festival ground or blocking the stages behind them.
      const STAGE_3D_DESIGN = {
        kinetic: { sides: 16, radius: 40, height: 32, rot:  0, altInner: 0.42 }, // 8-petal lotus, mainstage
        quantum: { sides:  3, radius: 30, height: 22, rot: 30 },                  // trance pyramid
        bionic:  { sides: 24, radius: 24, height: 16, rot:  0 },                  // jungle dome
        stereo:  { sides: 12, radius: 22, height: 14, rot: 15, altInner: 0.55 }, // 6-petal bloom
        cosmic:  { sides: 12, radius: 28, height: 18, rot:  0, altInner: 0.62 }, // sun + rays
        neon:    { sides:  6, radius: 26, height: 16, rot:  0 },                  // hexagon
        waste:   { sides: 16, radius: 24, height: 18, rot:  0, altInner: 0.62 }, // 8-point gear
        basspod: { sides:  4, radius: 22, height: 16, rot: 45 },                  // diamond speaker
        circuit: { sides:  4, radius: 30, height: 22, rot:  0, aspect: [1.4, 0.9] }, // hangar
      };
      const _designFor = (id) => STAGE_3D_DESIGN[id] || { sides: 24, radius: 22, height: 16, rot: 0 };

      // Per-stage 3D pillar geometry. Selected stage gets +60% height,
      // +20% footprint, and higher opacity for the Pokémon-Go-gym "you
      // tapped this one" pop.
      // Multi-tier stage geometry — each stage stacks TWO extrusions:
      // a wider, shorter BASE (the platform) + the main shape on top
      // (the stage proper). Gives the pillars architectural depth
      // instead of looking like a single solid cylinder.
      //
      // tier="base" → 1.45× radius, 30% height, fill-extrusion-base 0
      // tier="main" → 1.0× radius, full height, fill-extrusion-base = base height
      const stagesExtrusionData = (selectedId) => {
        const feats = [];
        stages.forEach((s) => {
          const { lat, lng } = mapToGps(s.x, s.y);
          const d   = _designFor(s.id);
          const sel = s.id === selectedId;
          const r   = d.radius * (sel ? 1.2 : 1.0);
          const h   = d.height * (sel ? 1.6 : 1.0);
          const baseH = Math.max(8, h * 0.18);
          // BASE platform — wider, octagonal regardless of stage shape, dim
          feats.push({
            type: "Feature",
            properties: {
              id: s.id, tier: "base", color: s.color,
              height: baseH, base: 0,
              opacity: sel ? 0.5 : 0.42,
            },
            geometry: {
              type: "Polygon",
              coordinates: _shapePolygon(lat, lng, {
                sides: 8, radius: r * 1.45, rot: 22.5,
              }),
            },
          });
          // MAIN stage shape — sits on top of the base
          feats.push({
            type: "Feature",
            properties: {
              id: s.id, tier: "main", color: s.color,
              height: h, base: baseH,
              opacity: sel ? 0.95 : 0.85,
            },
            geometry: {
              type: "Polygon",
              coordinates: _shapePolygon(lat, lng, {
                sides: d.sides, radius: r, rot: d.rot,
                altInner: d.altInner, aspect: d.aspect,
              }),
            },
          });
        });
        return { type: "FeatureCollection", features: feats };
      };

      // LVMS grandstand — the actual oval structure around the speedway,
      // extruded as a faux 3D backdrop. Built once on map load, never
      // changes. Sits BELOW the festival clip mask hole (LVMS infield),
      // surrounded by horizon-purple, so when zoomed out users see a
      // recognizable racetrack silhouette around the festival footprint.
      const grandstandFeature = () => {
        if (!FESTIVAL_CONFIG.venue?.ovalBounds) return null;
        const b = FESTIVAL_CONFIG.venue.ovalBounds;
        // Outer ring (the grandstand outline) + inner ring (the infield)
        // = a "donut" extrusion that traces the speedway grandstand.
        // Slightly oversized vs the paved track for visual weight.
        const inset = 0.0008;
        return {
          type: "Feature",
          properties: { color: "#3a2a55", height: 22 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [[b.west - inset, b.north + inset], [b.east + inset, b.north + inset],
               [b.east + inset, b.south - inset], [b.west - inset, b.south - inset],
               [b.west - inset, b.north + inset]],
              [[b.west, b.north], [b.east, b.north],
               [b.east, b.south], [b.west, b.south],
               [b.west, b.north]],
            ],
          },
        };
      };

      // Repaint relevant basemap layers (water, roads, buildings, landuse,
      // labels) in Plursky's palette. Iterates once per styledata event so
      // it survives setStyle. Uses heuristics on layer IDs since
      // OpenFreeMap Liberty's exact IDs aren't documented. Skipped on
      // raster styles (no vector layers to repaint).
      const applyPlurskyPalette = () => {
        try {
          const layers = map.getStyle().layers || [];
          layers.forEach((lyr) => {
            const id = lyr.id || "";
            // Water — deep horizon purple
            if (/water|river|ocean|lake/i.test(id) && lyr.type === "fill") {
              map.setPaintProperty(id, "fill-color", "#2a1a3d");
            }
            // Park / landuse — dim ink with very low opacity
            if (/(park|landuse|natural|grass|wood|forest)/i.test(id) && lyr.type === "fill") {
              map.setPaintProperty(id, "fill-color", "#1a120d");
              map.setPaintProperty(id, "fill-opacity", 0.22);
            }
            // Buildings + parking — HIDE entirely. Jake wants just the
            // speedway oval + stages on top, not OSM building polygons
            // (grandstand structures + parking lots) cluttering the view.
            if (/(building|parking|housenum)/i.test(id) && (lyr.type === "fill" || lyr.type === "fill-extrusion")) {
              try { map.setLayoutProperty(id, "visibility", "none"); } catch {}
            }
            // Roads — ember on motorways, flare on secondary, muted on side
            if (lyr.type === "line" && /road|highway|street|motorway|primary|secondary|tertiary|service|bridge|tunnel|path/i.test(id)) {
              if (/motorway|primary|trunk/.test(id))   map.setPaintProperty(id, "line-color", "#e85d2e");
              else if (/secondary|tertiary/.test(id))   map.setPaintProperty(id, "line-color", "#f59a36");
              else                                       map.setPaintProperty(id, "line-color", "rgba(247,237,224,0.35)");
            }
            // Text labels — keep mono-cap feel; recolor to paper
            if (lyr.type === "symbol") {
              try { map.setPaintProperty(id, "text-color", "rgba(247,237,224,0.85)"); } catch {}
              try { map.setPaintProperty(id, "text-halo-color", "rgba(10,6,24,0.85)"); } catch {}
            }
            // Background = deep night sky
            if (lyr.type === "background") {
              map.setPaintProperty(id, "background-color", "#0a0618");
            }
          });
        } catch {}
      };

      // GeoJSON Polygon with a huge outer ring + a hole at the LVMS festival
      // footprint. Painted opaque on top of the basemap, this "removes
      // everything that isn't EDC" — Vegas Boulevard, surrounding parking
      // lots, casinos, the airport, etc. all get masked. The festival
      // footprint shows through the hole.
      const edcClipFeature = () => {
        if (!FESTIVAL_CONFIG.venue?.festivalBounds) return null;
        const b = FESTIVAL_CONFIG.venue.festivalBounds;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              // Outer ring (CCW per MapLibre convention for outer)
              [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
              // Inner ring (CW) — the LVMS festival footprint
              [
                [b.west, b.north], [b.east, b.north],
                [b.east, b.south], [b.west, b.south],
                [b.west, b.north],
              ],
            ],
          },
        };
      };
      // Polygon of *just* the festival footprint, used as a `within` filter
      // to constrain the 3D building extrusion layer.
      const festivalFootprint = () => {
        if (!FESTIVAL_CONFIG.venue?.festivalBounds) return null;
        const b = FESTIVAL_CONFIG.venue.festivalBounds;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [b.west, b.north], [b.east, b.north],
              [b.east, b.south], [b.west, b.south],
              [b.west, b.north],
            ]],
          },
        };
      };

      // Style-dependent layers (clip mask, EDC poster, 3D buildings, route)
      // get torn down on setStyle(), so we re-add them every time a new
      // style finishes loading. Clip first → poster on top → 3D buildings
      // extrude from poster → route line → DOM markers.
      // Helper — wrap layer setup so one broken layer doesn't abort the rest.
      // Errors get logged with the layer id so Jake can screenshot the console
      // and we can diagnose remotely without browser access.
      const _safeLayer = (id, fn) => {
        try { fn(); }
        catch (e) { console.error(`[plursky-map] layer "${id}" failed:`, e); }
      };

      const setupOverlayLayers = () => {
        _mapLog("[plursky-map] setupOverlayLayers START — stages count:", stages?.length || 0);
        if (stages && stages.length) {
          const s0 = stages[0];
          const ll = mapToGps(s0.x, s0.y);
          _mapLog(`[plursky-map] stage[0] = id:${s0.id} svg(${s0.x},${s0.y}) → lat:${ll?.lat?.toFixed(5)} lng:${ll?.lng?.toFixed(5)}`);
        }

        // Repaint basemap into Plursky palette + hide buildings/parking.
        applyPlurskyPalette();

        // Outside-festival clip mask — covers everything outside the
        // festival footprint with Plursky paper, so only the speedway
        // grounds show through. Restored after the Cramer fix; the polygon
        // hole now lines up with the actual festival GPS.
        _safeLayer("outside-mask", () => {
          if (!FESTIVAL_CONFIG.venue?.festivalBounds) return;
          const _maskFeature = () => {
            const b = FESTIVAL_CONFIG.venue.festivalBounds;
            const cx = (b.west + b.east) / 2;
            const cy = (b.north + b.south) / 2;
            const big = 0.02; // ~2km half-edge — covers visible viewport at zoom 16
            return {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  // Outer ring CCW
                  [
                    [cx - big, cy - big], [cx + big, cy - big],
                    [cx + big, cy + big], [cx - big, cy + big],
                    [cx - big, cy - big],
                  ],
                  // Inner ring CW — festival "window"
                  [
                    [b.west, b.north], [b.east, b.north],
                    [b.east, b.south], [b.west, b.south],
                    [b.west, b.north],
                  ],
                ],
              },
            };
          };
          if (!map.getSource("outside-mask")) {
            map.addSource("outside-mask", { type: "geojson", data: _maskFeature() });
          }
          if (!map.getLayer("outside-mask")) {
            map.addLayer({
              id: "outside-mask",
              type: "fill",
              source: "outside-mask",
              paint: {
                "fill-color":   "#eee0cb",  // Plursky --paper-2
                "fill-opacity": 0.97,
                "fill-antialias": true,
              },
            });
          }
        });

        // Festival floor — warm Plursky tint over the festival rectangle.
        _safeLayer("festival-floor", () => {
          const fp = festivalFootprint();
          if (!fp) return;
          if (!map.getSource("festival-floor")) {
            map.addSource("festival-floor", {
              type: "geojson",
              data: fp,
            });
          }
          if (!map.getLayer("festival-floor")) {
            map.addLayer({
              id: "festival-floor",
              type: "fill",
              source: "festival-floor",
              paint: {
                "fill-color":   "#1a1030",
                "fill-opacity": 0.30,
                "fill-antialias": true,
              },
            });
          }
        });

        // Plursky-native stage zone glows — colored ground patches in each
        // stage's color. Painted-ground wayfinding (Snapchat Map's POI
        // zones). 70m radius keeps zones distinct on tight clusters; at
        // 90m adjacent stages' zones overlapped + color-mixed into muddy
        // intermediates.
        const stageZonesData = () => ({
          type: "FeatureCollection",
          features: stages.map((s) => {
            const { lat, lng } = mapToGps(s.x, s.y);
            return {
              type: "Feature",
              properties: { id: s.id, color: s.color },
              geometry: {
                type: "Polygon",
                coordinates: _shapePolygon(lat, lng, { sides: 36, radius: 70 }),
              },
            };
          }),
        });
        // Official patron map — the printed festival map, geo-anchored over the
        // real basemap. This is the layer the render-order comment above has
        // described since the RealMap landed ("clip first -> poster on top");
        // it was never actually built, so the real map showed satellite
        // imagery with dots on it and none of the festival's own cartography.
        //
        // Placed with an explicit beforeId rather than by call order: the
        // natural image dimensions arrive asynchronously, so this can be
        // re-invoked AFTER stage-zones/plaza/route already exist. Appending
        // would then draw the poster over the stage dots, routes and presence
        // dots — the exact inversion the work order rules out.
        const _addOfficialMap = () => {
          // NOTE: deliberately NOT gated on officialMapRef.current. Skipping
          // creation while the toggle is off would leave the visibility effect
          // below with no layer to turn back ON, making the toggle one-way.
          // Build it always; set initial visibility from the toggle.
          if (FESTIVAL_CONFIG.mapStyle !== "image-overlay" || !FESTIVAL_CONFIG.mapImage) return;
          if (!MAP_AFFINE) return;   // no anchors -> no defensible placement
          const dims = officialMapDimsRef.current;
          if (!dims) return;         // still loading; the .then() below re-runs us
          const src = FESTIVAL_CONFIG.mapImage;
          const coordinates = _officialMapCorners(dims.w, dims.h);
          if (!map.getSource("official-map")) {
            map.addSource("official-map", { type: "image", url: src, coordinates });
          } else {
            // Style swaps preserve nothing, but a re-run on an existing source
            // should still retune if the affine changed under us.
            try { map.getSource("official-map").setCoordinates(coordinates); } catch {}
          }
          if (!map.getLayer("official-map")) {
            const below = ["stage-zones", "plaza", "route-line", "stages-3d"]
              .find(id => map.getLayer(id));
            map.addLayer({
              id: "official-map",
              type: "raster",
              source: "official-map",
              layout: { visibility: officialMapRef.current ? "visible" : "none" },
              paint: {
                // Park maps (ACL) are clean line art and read best near-opaque;
                // the poster-style ones (EDC) are dense and busy, so they sit
                // back far enough for the basemap and the dots to stay legible.
                "raster-opacity": FESTIVAL_CONFIG.mapTheme === "park" ? 0.92 : 0.78,
                "raster-fade-duration": 0,
                "raster-resampling": "linear",
              },
            }, below);
            _mapLog("[plursky-map] official-map added", src, dims.w + "x" + dims.h,
                    below ? "below " + below : "(top — no overlay layers yet)");
          }
        };
        _safeLayer("official-map", _addOfficialMap);
        if (!officialMapDimsRef.current && FESTIVAL_CONFIG.mapImage) {
          _officialMapDims(FESTIVAL_CONFIG.mapImage).then((d) => {
            if (cancelled || !d || !mapRef.current) return;
            officialMapDimsRef.current = d;
            _safeLayer("official-map", _addOfficialMap);
          });
        }

        _safeLayer("stage-zones", () => {
          const _zd = stageZonesData();
          _mapLog("[plursky-map] stage-zones features:", _zd.features.length, "first poly verts:", _zd.features[0]?.geometry?.coordinates?.[0]?.length || 0);
          if (!map.getSource("stage-zones")) {
            map.addSource("stage-zones", { type: "geojson", data: _zd });
          }
          if (!map.getLayer("stage-zones")) {
            map.addLayer({
              id: "stage-zones",
              source: "stage-zones",
              type: "fill",
              paint: {
                "fill-color":   ["get", "color"],
                // Soft ground glow — visible enough to read as a stage zone,
                // not so loud it competes with the 3D iconic shape on top.
                "fill-opacity": 0.20,
                "fill-antialias": true,
              },
            });
          }
        });

        // Daisy Lane plaza — central plaza marker at the festival centroid.
        // (Walkway spokes were tried but read as a busy starburst from a
        // single point; the plaza alone gives the map its center of gravity.)
        const _centroidLatLng = (() => {
          const pts = stages.map(s => mapToGps(s.x, s.y));
          const lat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
          const lng = pts.reduce((sum, p) => sum + p.lng, 0) / pts.length;
          return { lat, lng };
        })();
        // Small filled circle in Plursky ember, anchors the radial walkway
        // pattern and gives the map a defined center of gravity.
        const plazaData = () => ({
          type: "Feature",
          properties: { name: "Daisy Lane" },
          geometry: {
            type: "Polygon",
            coordinates: _shapePolygon(_centroidLatLng.lat, _centroidLatLng.lng, {
              sides: 8, radius: 22,
            }),
          },
        });
        _safeLayer("plaza", () => {
          if (!map.getSource("plaza")) {
            map.addSource("plaza", { type: "geojson", data: plazaData() });
          }
          if (!map.getLayer("plaza")) {
            map.addLayer({
              id: "plaza",
              source: "plaza",
              type: "fill",
              paint: {
                "fill-color":   "#e85d2e",
                "fill-opacity": 0.18,
                "fill-antialias": true,
              },
            });
          }
          if (!map.getLayer("plaza-stroke")) {
            map.addLayer({
              id: "plaza-stroke",
              source: "plaza",
              type: "line",
              paint: {
                "line-color":   "#e85d2e",
                "line-width":   1.5,
                "line-opacity": 0.55,
              },
            });
          }
        });
        // Crowd heatmap — Mapbox native heatmap layer driven by
        // _crowdDensity. Lives BELOW stage pillars so stages still pop
        // when heat is on. Visibility toggles via setLayoutProperty in
        // the dedicated useEffect below.
        if (!map.getSource("crowd-heat")) {
          map.addSource("crowd-heat", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
        if (!map.getLayer("crowd-heat")) {
          map.addLayer({
            id: "crowd-heat",
            source: "crowd-heat",
            type: "heatmap",
            layout: { visibility: "none" },
            paint: {
              "heatmap-weight":   ["interpolate", ["linear"], ["get", "density"], 0, 0, 1, 1],
              "heatmap-intensity":["interpolate", ["linear"], ["zoom"], 14, 1.0, 17, 2.8],
              "heatmap-color": [
                "interpolate", ["linear"], ["heatmap-density"],
                0,    "rgba(0,0,0,0)",
                0.2,  "rgba(251,191,36,0.35)",
                0.5,  "rgba(249,115,22,0.65)",
                0.8,  "rgba(239,68,68,0.85)",
                1.0,  "rgba(239,68,68,0.95)",
              ],
              "heatmap-radius":  ["interpolate", ["linear"], ["zoom"], 14, 26, 17, 78],
              "heatmap-opacity": 0.72,
            },
          });
        }

        // 3D STAGE PILLARS — the headline visual. Each stage becomes a
        // colored cylinder rising out of the poster (Pokémon-Go gym vibe).
        // Tap = onPickStage. Selected stage updates via setData on the
        // GeoJSON source (no DOM marker class flipping needed).
        // 3D stage extrusions hidden — DOM markers (added in the load
        // handler) are now the primary visual for navigation. The
        // extrusion source/layers are kept in place so we can flip
        // them back on later via setLayoutProperty if we want the
        // Snapchat-3D atmosphere back.
        _safeLayer("stages-3d", () => {
        const _sd = stagesExtrusionData(null);
        _mapLog("[plursky-map] stages-3d features:", _sd.features.length);
        if (!map.getSource("stages-3d")) {
          map.addSource("stages-3d", { type: "geojson", data: _sd });
        }
        // Split into TWO layers (base + main) because
        // fill-extrusion-opacity is a uniform paint property in MapLibre
        // — it does NOT accept data expressions. Each layer has a
        // constant opacity matching its tier, with a filter selecting
        // the right features. Color/height/base remain data-driven from
        // the same single source.
        if (!map.getLayer("stages-3d-base")) {
          map.addLayer({
            id: "stages-3d-base",
            source: "stages-3d",
            type: "fill-extrusion",
            filter: ["==", ["get", "tier"], "base"],
            paint: {
              "fill-extrusion-color":   ["get", "color"],
              "fill-extrusion-height":  ["get", "height"],
              "fill-extrusion-base":    ["get", "base"],
              "fill-extrusion-opacity": 0.45,
            },
          });
        }
        if (!map.getLayer("stages-3d")) {
          map.addLayer({
            id: "stages-3d",
            source: "stages-3d",
            type: "fill-extrusion",
            filter: ["==", ["get", "tier"], "main"],
            paint: {
              "fill-extrusion-color":   ["get", "color"],
              "fill-extrusion-height":  ["get", "height"],
              "fill-extrusion-base":    ["get", "base"],
              "fill-extrusion-opacity": 0.88,
            },
          });
          // Tap target lives on the visible upper structure only.
          map.on("click", "stages-3d", (e) => {
            const f = e.features && e.features[0];
            if (f && onPickStageRef.current) onPickStageRef.current(f.properties.id);
          });
          map.on("mouseenter", "stages-3d", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "stages-3d", () => { map.getCanvas().style.cursor = ""; });
        }
        });

        // Force my overlay layers to the TOP of the render stack. styledata
        // events sometimes add basemap layers AFTER the first setupOverlayLayers
        // call, which can leave my layers buried below. moveLayer with no
        // second arg moves to top.
        // outside-mask FIRST so the festival-floor, zones, etc. render
        // INSIDE the festival hole on top of the satellite imagery,
        // while the mask covers everything else.
        ["outside-mask", "festival-floor", "stage-zones", "plaza", "plaza-stroke", "stages-3d-base", "stages-3d", "route"].forEach((id) => {
          try { if (map.getLayer(id)) map.moveLayer(id); } catch (e) {
            console.error(`[plursky-map] moveLayer "${id}" failed:`, e);
          }
        });

        try {
          const existing = (map.getStyle().layers || [])
            .filter((l) => /festival|stage|plaza|route/.test(l.id))
            .map((l) => `${l.id}(${l.type})`);
          _mapLog("[plursky-map] my layers after setup:", existing.join(", ") || "(none)");
        } catch (e) {
          console.error("[plursky-map] getStyle failed:", e);
        }

        _mapLog("[plursky-map] setupOverlayLayers END");

        if (!map.getSource("route")) {
          map.addSource("route", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
          });
        }
        if (!map.getLayer("route")) {
          map.addLayer({
            id: "route", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#e85d2e",
              "line-width": 4,
              "line-opacity": 0.9,
              "line-dasharray": [2, 1.5],
            },
          });
        }
        // Hide basemap text labels (Speedway Boulevard, Las Vegas Motor
        // Speedway, etc.) so they don't render *through* our opaque clip
        // mask. MapLibre renders symbol/text layers in a separate pass
        // that ignores fill layers above them, so this is the only fix.
        try {
          (map.getStyle().layers || []).forEach((lyr) => {
            if (lyr.type === "symbol") map.setLayoutProperty(lyr.id, "visibility", "none");
          });
        } catch {}

      };

      // One-shot setup that runs after the first style finishes loading.
      // Markers (DOM overlays) persist across setStyle(), so we add them once.
      map.on("load", () => {
        _mapLog("[plursky-map] map.on('load') fired");
        if (cancelled) return;

        // Lock panning to the festival footprint + tiny buffer. The map
        // is for the fairgrounds exclusively (Snapchat-style focus); users
        // shouldn't be able to pan out to the Strip or surrounding Vegas.
        if (FESTIVAL_CONFIG.venue?.festivalBounds) {
          const b = FESTIVAL_CONFIG.venue.festivalBounds;
          map.setMaxBounds([[b.west - 0.004, b.south - 0.004], [b.east + 0.004, b.north + 0.004]]);
        }

        // Sub-landmark text labels — named places/walkways printed on the
        // official patron map, projected into GPS via mapToGps + rendered as
        // DOM markers.
        //
        // These used to be created unconditionally, so the More menu's
        // "Landmark labels" toggle moved the SVG map and did nothing at all on
        // the real map. The elements are kept in a ref and shown/hidden by the
        // showLabels effect below rather than rebuilt, because Marker churn on
        // every toggle also churns the GPS projection.
        SUB_LANDMARKS.forEach((lm) => {
          const { lat, lng } = mapToGps(lm.x, lm.y);
          const el = document.createElement("div");
          el.style.cssText =
            "font-family:'Geist Mono',monospace;font-weight:700;" +
            "font-size:9px;letter-spacing:1.4px;white-space:nowrap;" +
            `color:${lm.color};` +
            "text-shadow:0 1px 6px rgba(0,0,0,0.85);" +
            "pointer-events:none;" +
            `transform:rotate(${lm.rot}deg);`;
          el.textContent = lm.label;
          landmarkElsRef.current.push(el);
          new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
        });
        _applyLandmarkVisibility();

        // Stage name pills — float ABOVE each 3D iconic shape so users
        // can read the stage name at a glance. The 3D shape itself is
        // the visual icon (Kinetic lotus, Quantum pyramid, etc.) and
        // the pill is just the label. Tap either to open the place card.
        stages.forEach(s => {
          const { lat, lng } = mapToGps(s.x, s.y);
          const pill = document.createElement("div");
          pill.style.cssText =
            "background:rgba(247,237,224,0.96);color:#1a120d;" +
            `border:2px solid ${s.color};` +
            "padding:4px 11px;border-radius:999px;" +
            "font-family:'Geist Mono',monospace;font-size:10.5px;" +
            "letter-spacing:1.1px;font-weight:800;white-space:nowrap;" +
            "box-shadow:0 4px 12px rgba(0,0,0,0.45);" +
            "pointer-events:auto;cursor:pointer;" +
            "transform:translate(0,-44px);";  // float above the 3D shape
          pill.textContent = s.name.toUpperCase();
          pill.onclick = () => onPickStageRef.current && onPickStageRef.current(s.id);
          stageMarkersRef.current[s.id] = new maplibregl.Marker({ element: pill, anchor: "center" })
            .setLngLat([lng, lat])
            .addTo(map);
        });
        _mapLog("[plursky-map] stage name pills added:", stages.length);

        // Avatar — outer halo (pulse animation) + inner amber dot
        const avWrap = document.createElement("div");
        avWrap.style.cssText = "position:relative;width:18px;height:18px;pointer-events:none;";
        const halo = document.createElement("div");
        halo.className = "plursky-avatar-halo";
        const avDot = document.createElement("div");
        avDot.style.cssText =
          "position:absolute;inset:0;border-radius:999px;" +
          "background:#f59a36;border:2px solid rgba(255,255,255,0.95);" +
          "box-shadow:0 0 16px rgba(245,154,54,0.9),0 2px 6px rgba(0,0,0,0.5);";
        avWrap.appendChild(halo);
        avWrap.appendChild(avDot);
        const avLatLng = mapToGps(avatar.x, avatar.y);
        avatarMarkerRef.current = new maplibregl.Marker({ element: avWrap })
          .setLngLat([avLatLng.lng, avLatLng.lat])
          .addTo(map);

        setupOverlayLayers();
        loadedRef.current = true;
        setLoaded(true);
      });

      // Every time a NEW style finishes loading (after setStyle), re-add the
      // route line + 3D buildings. Markers persist; layers don't.
      map.on("styledata", () => {
        if (cancelled || !mapRef.current) return;
        setupOverlayLayers();
      });

      // Map-canvas click → in meet mode, drop a pin at the clicked GPS,
      // converted back to 100-space x/y so the existing meet-target
      // state machine in MapScreen accepts it. Ignored when not in meet
      // mode (stage clicks have their own handler on the stages-3d layer).
      map.on("click", (e) => {
        if (!meetModeRef.current || !onMapClickRef.current) return;
        // Skip if a stage was clicked — the stages-3d layer handler covers it.
        const hits = map.queryRenderedFeatures(e.point, { layers: ["stages-3d"] });
        if (hits && hits.length) return;
        const ll = e.lngLat;
        const xy = mapToGps && (typeof gpsToMap === "function") ? gpsToMap(ll.lat, ll.lng) : null;
        if (!xy) return;
        onMapClickRef.current({ x: Math.max(2, Math.min(98, xy.x)), y: Math.max(2, Math.min(98, xy.y)) });
      });

      map.on("error", (e) => {
        if (cancelled) return;
        const msg = (e && e.error && e.error.message) || "tile load failed";
        console.error("[plursky-map] MapLibre error:", msg, e?.error || e);
        // Tile fetch errors fire constantly while panning out-of-bounds;
        // only surface the first one.
        setErr(prev => prev || msg);
        tileErrRef.current += 1;
        if (tileErrRef.current >= 6 && !loadedRef.current) _fatal("Real map tiles are failing");
      });
    }).catch(e => {
      console.error("[plursky-map] _loadMapLibre rejected:", e?.message || e, e);
      if (!cancelled) { setErr(e.message || "library failed to load"); _fatal("Map library failed to load"); }
    });

    return () => {
      clearTimeout(bootTimer);
      cancelled = true;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch {}
        mapRef.current = null;
      }
      stageMarkersRef.current = {};
      avatarMarkerRef.current = null;
      friendMarkersRef.current = {};
      savedStarMarkersRef.current = {};
      meetMarkerRef.current = null;
    };
  }, []);

  // Avatar follows GPS / demo position
  React.useEffect(() => {
    if (!loaded || !avatarMarkerRef.current) return;
    const { lat, lng } = mapToGps(avatar.x, avatar.y);
    avatarMarkerRef.current.setLngLat([lng, lat]);
  }, [loaded, avatar.x, avatar.y]);

  // Crew friend markers — Instagram-style avatar circles. Reconcile diffs on
  // every crewFriends change: add new, move existing, remove dropped. Stable
  // marker DOM nodes so positions animate smoothly.
  React.useEffect(() => {
    if (!loaded || !mapRef.current || !window.maplibregl) return;
    const map = mapRef.current;
    const live = friendMarkersRef.current;
    const seenIds = new Set();

    crewFriends.forEach(f => {
      seenIds.add(f.id);
      const lat = f.gps?.lat ?? mapToGps(f.x, f.y).lat;
      const lng = f.gps?.lng ?? mapToGps(f.x, f.y).lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const seen = formatLastSeen(f.ts);
      const initial = (f.name?.[0] || "?").toUpperCase();
      // Signature changes when display-affecting fields change — avoid
      // re-rendering DOM when only position changes (positions update via
      // setLngLat on the same element).
      const sig = `${initial}|${f.color}|${seen.color}|${seen.freshness}|${seen.label}|${f.name}`;

      let entry = live[f.id];
      if (!entry) {
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;";
        entry = { marker: new window.maplibregl.Marker({ element: wrap, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map), wrap, sig: "" };
        live[f.id] = entry;
      }
      if (entry.sig !== sig) {
        entry.wrap.innerHTML =
          `<div style="width:30px;height:30px;border-radius:999px;background:${f.color};` +
          `border:2px solid rgba(255,255,255,0.95);box-shadow:0 3px 12px ${f.color}aa,0 0 0 1px rgba(0,0,0,0.4);` +
          `display:flex;align-items:center;justify-content:center;color:#fff;` +
          `font-family:'Instrument Serif',serif;font-size:17px;line-height:1;` +
          `opacity:${seen.freshness === "cold" ? 0.78 : 1};">${initial}</div>` +
          `<div style="display:flex;align-items:center;gap:4px;` +
          `background:rgba(6,4,18,0.86);color:#fff;` +
          `border:1px solid rgba(255,255,255,0.18);` +
          `padding:2px 7px;border-radius:999px;` +
          `font-family:'Geist Mono',monospace;font-size:8px;letter-spacing:1.1px;` +
          `font-weight:700;white-space:nowrap;">` +
          `<span style="width:5px;height:5px;border-radius:5px;background:${seen.color};` +
          `${seen.freshness === "fresh" ? "animation:pulse 1.6s infinite;" : ""}"></span>` +
          `${f.name.toUpperCase()}${seen.label && seen.freshness !== "fresh" ? ` · ${seen.label}` : ""}` +
          `</div>`;
        entry.sig = sig;
      }
      entry.marker.setLngLat([lng, lat]);
    });

    // Remove markers for friends no longer in the snap
    Object.keys(live).forEach(id => {
      if (!seenIds.has(id)) {
        try { live[id].marker.remove(); } catch {}
        delete live[id];
      }
    });
  }, [loaded, crewFriends]);

  // Selected stage refreshes the 3D extrusion source so the chosen pillar
  // grows + brightens, and flyTo cinematically swings the camera in.
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    // Re-fire the geojson with the new selectedId so the per-stage height/
    // opacity/radius updates flow through. The source's setData replaces
    // the FeatureCollection in place — no marker re-creation needed.
    const src = mapRef.current.getSource("stages-3d");
    if (src && mapRef.current._plurskyExtrusionData) {
      src.setData(mapRef.current._plurskyExtrusionData(selected));
    }
    if (!selected) return;
    const s = stages.find(st => st.id === selected);
    if (!s) return;
    const { lat, lng } = mapToGps(s.x, s.y);
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 16.6,
      pitch: 58,
      duration: 1400,
      essential: true,
    });
  }, [loaded, selected, stages]);

  // Compass bearing — rotate the map so the user's facing direction is "up"
  // when compass mode is active. Easing keeps it from feeling robotic.
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    try {
      mapRef.current.easeTo({
        bearing: compass ? -compassHeading : 0,
        duration: 220,
      });
    } catch {}
  }, [loaded, compass, compassHeading]);

  // Meet pin — ember pulse marker at meetTarget GPS. Reuses the existing
  // .plursky-avatar-halo CSS keyframe for the pulse animation.
  React.useEffect(() => {
    if (!loaded || !mapRef.current || !window.maplibregl) return;
    if (!meetTarget) {
      if (meetMarkerRef.current) {
        try { meetMarkerRef.current.remove(); } catch {}
        meetMarkerRef.current = null;
      }
      return;
    }
    const { lat, lng } = mapToGps(meetTarget.x, meetTarget.y);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!meetMarkerRef.current) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:relative;width:22px;height:22px;pointer-events:none;";
      const halo = document.createElement("div");
      halo.className = "plursky-avatar-halo";
      halo.style.background = "rgba(232,93,46,0.55)";
      const dot = document.createElement("div");
      dot.style.cssText =
        "position:absolute;inset:0;border-radius:999px;" +
        "background:var(--ember,#e85d2e);border:2px solid rgba(255,255,255,0.95);" +
        "box-shadow:0 0 18px rgba(232,93,46,0.85),0 2px 6px rgba(0,0,0,0.55);";
      wrap.appendChild(halo);
      wrap.appendChild(dot);
      meetMarkerRef.current = new window.maplibregl.Marker({ element: wrap })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    } else {
      meetMarkerRef.current.setLngLat([lng, lat]);
    }
  }, [loaded, meetTarget?.x, meetTarget?.y]);

  // Saved-set gold ★ markers — small star DOM pin floating above each
  // stage pillar whose lineup has an upcoming saved set today. Mirrors
  // the SVG TopDownMap's savedByStage logic.
  React.useEffect(() => {
    if (!loaded || !mapRef.current || !window.maplibregl) return;
    const live = savedStarMarkersRef.current;
    const seen = new Set();
    const now = window.NOW || {};
    const nowMin = (typeof toNightMin === "function" && now.time) ? toNightMin(now.time) : 0;
    const byStage = {};
    saved.forEach(id => {
      const a = window.ARTISTS?.find(x => x.id === id);
      if (!a || a.day !== now.day) return;
      const sM = toNightMin(a.start), eM = toNightMin(a.end);
      if (eM <= nowMin) return; // already over
      const cur = byStage[a.stage];
      if (!cur || sM - nowMin < cur.minsUntil) {
        byStage[a.stage] = { artist: a, minsUntil: sM - nowMin };
      }
    });
    Object.keys(byStage).forEach(stageId => {
      const s = stages.find(st => st.id === stageId);
      if (!s) return;
      seen.add(stageId);
      const { lat, lng } = mapToGps(s.x, s.y);
      if (!live[stageId]) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:20px;height:20px;border-radius:999px;background:rgba(13,8,4,0.92);" +
          "border:1.5px solid #fbbf24;display:flex;align-items:center;justify-content:center;" +
          "color:#fbbf24;font-family:'Geist Mono',monospace;font-size:13px;font-weight:900;" +
          "box-shadow:0 0 12px rgba(251,191,36,0.5),0 2px 6px rgba(0,0,0,0.5);" +
          "transform:translate(14px,-14px);pointer-events:none;";
        el.textContent = "★";
        live[stageId] = new window.maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat]).addTo(mapRef.current);
      } else {
        live[stageId].setLngLat([lng, lat]);
      }
    });
    Object.keys(live).forEach(stageId => {
      if (!seen.has(stageId)) {
        try { live[stageId].remove(); } catch {}
        delete live[stageId];
      }
    });
  }, [loaded, saved, stages]);

  // Crowd heatmap visibility + data refresh. Toggles the layer on/off based
  // on the showHeat prop; re-computes density on a 60s tick so the heat
  // shifts as sets cross set boundaries through the night.
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer("crowd-heat")) {
      try { map.setLayoutProperty("crowd-heat", "visibility", showHeat ? "visible" : "none"); } catch {}
    }
    if (!showHeat) return;
    const rebuild = () => {
      const nowMin = (typeof toNightMin === "function" && window.NOW?.time)
        ? toNightMin(window.NOW.time)
        : 0;
      const features = stages.map(s => {
        const { lat, lng } = mapToGps(s.x, s.y);
        const density = typeof _crowdDensity === "function" ? _crowdDensity(s.id, nowMin) : 0.04;
        return {
          type: "Feature",
          properties: { id: s.id, density },
          geometry: { type: "Point", coordinates: [lng, lat] },
        };
      });
      const src = map.getSource("crowd-heat");
      if (src) src.setData({ type: "FeatureCollection", features });
    };
    rebuild();
    const id = setInterval(rebuild, 60000);
    return () => clearInterval(id);
  }, [loaded, showHeat, stages]);

  // Swap the basemap style when the user toggles Stylized / Satellite.
  // styledata listener re-adds overlay layers; markers persist across swaps.
  // Track whether we've handled the initial styleKey so we don't double-set
  // the basemap on first mount (constructor already booted with it).
  const _styleKeyInitRef = React.useRef(styleKey);
  React.useEffect(() => {
    if (!mapRef.current) return;
    if (_styleKeyInitRef.current === styleKey) {
      _styleKeyInitRef.current = "__seeded__"; // first run, skip
      return;
    }
    const cfg = REAL_MAP_STYLES[styleKey];
    if (!cfg) return;
    try {
      _mapLog("[plursky-map] setStyle →", styleKey);
      mapRef.current.setStyle(cfg.style || cfg.url);
    } catch (e) { console.error("[plursky-map] setStyle failed:", e); }
  }, [styleKey]);

  // Route line: avatar → selected stage / meet target
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const target = meetTarget || (selected ? stages.find(s => s.id === selected) : null);
    const src = mapRef.current.getSource("route");
    if (!src) return;
    if (!target) {
      src.setData({ type: "Feature", geometry: { type: "LineString", coordinates: [] } });
      return;
    }
    const a = mapToGps(avatar.x, avatar.y);
    const t = mapToGps(target.x, target.y);
    src.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [t.lng, t.lat]] },
    });
  }, [loaded, avatar.x, avatar.y, selected, meetTarget, stages]);

  const pickStyle = (k) => {
    setStyleKey(k);
    try { localStorage.setItem("plursky_real_map_style", k); } catch {}
  };

  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden",
      background: "#060412",
    }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }}/>

      {/* Style switcher — Stylized / Satellite. Positioned below the
          MapScreen's top-right icon column (GPS + Layers) so they don't stack. */}
      {/* Style toggle — always visible (was gated on `loaded`, which never
          flipped true for some users → toggle was hidden). */}
      <div style={{
        position: "absolute", top: 108, right: 10, zIndex: 4,
        display: "flex", background: "rgba(6,4,18,0.78)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 999, padding: 3, gap: 2,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}>
        {Object.entries(REAL_MAP_STYLES).map(([k, cfg]) => {
          const on = styleKey === k;
          return (
            <button key={k} onClick={() => pickStyle(k)} style={{
              background: on ? "var(--ember)" : "transparent",
              color: "#fff", border: "none",
              padding: "5px 11px", borderRadius: 999,
              fontFamily: "'Geist Mono',monospace", fontSize: 9,
              letterSpacing: 1.3, fontWeight: 700,
              cursor: "pointer", transition: "background 0.15s",
            }}>{cfg.label}</button>
          );
        })}
      </div>

      {/* (Removed the LOADING MAP overlay — basemap tiles + stage layers
          render progressively as MapLibre fetches them; a full-screen
          "loading" curtain on top of an already-painting map was noise.
          Errors still show the {err} block below.) */}
      {err && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          color: "#f87171",
          fontFamily: "'Geist Mono',monospace", fontSize: 10, letterSpacing: 1.3,
          gap: 6, padding: 20, textAlign: "center",
        }}>
          <div>MAP ERROR</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, maxWidth: 240 }}>{err}</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, marginTop: 4 }}>
            Tip: the festival map below works offline — one tap switches and remembers.
          </div>
          <button onClick={() => _fatal("Switched to festival map")} style={{
            marginTop: 8, padding: "7px 16px", borderRadius: 999, border: "none",
            background: "var(--ember)", color: "#fff", cursor: "pointer",
            fontFamily: "'Geist Mono',monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>USE FESTIVAL MAP</button>
        </div>
      )}
    </div>
  );
}

// ---- CROWD HEATMAP ----
// Estimated crowd density 0–1 at a stage for a given nowMin.
// Tiers: headliner=3, prime=2, opener=1. Crowd fades out over 20 min after a set ends.
function _crowdDensity(stageId, nowMin) {
  const playing = ARTISTS.find(a =>
    a.stage === stageId &&
    toNightMin(a.start) <= nowMin &&
    toNightMin(a.end)   >  nowMin
  );
  if (playing) return 0.25 + (playing.tier / 3) * 0.75;

  // Find the most recently ended set at this stage (within 20 min)
  let recent = null;
  ARTISTS.forEach(a => {
    if (a.stage !== stageId) return;
    const endMin = toNightMin(a.end);
    if (endMin > nowMin || endMin < nowMin - 20) return;
    if (!recent || endMin > toNightMin(recent.end)) recent = a;
  });
  if (recent) {
    const fade = 1 - (nowMin - toNightMin(recent.end)) / 20;
    return (0.25 + (recent.tier / 3) * 0.75) * fade * 0.55;
  }
  return 0.04; // ambient
}

// ---- TOP-DOWN NAVIGATION MAP ----
function TopDownMap({ avatar, heading, friends, stages, saved = [], showLabels = false, showHeat = false, showAmenities = false, compass = false, compassHeading = 0, selected, meetMode, meetTarget, meetGroup = [], crewFriends = [], zoom = 1, pan = { x: 0, y: 0 }, zoomMin = 0.7, zoomMax = 3.5, onZoomChange, onPanChange, onPickStage, onClick }) {
  // Compass mode: rotate the entire map by -heading so the user's facing
  // direction is always "up" on screen. Readable text labels counter-rotate
  // back to upright so they stay legible at any heading.
  const mapRotate = compass ? -compassHeading : 0;
  const counterRot = compass ? ` rotate(${compassHeading}deg)` : "";
  const sel = stages.find(s => s.id === selected);

  // Stages where the user has an upcoming saved set today — used to draw a
  // gold ★ overlay so users can spot at a glance "where am I going next?"
  const savedByStage = React.useMemo(() => {
    const nowMin = toNightMin(NOW.time);
    const map = {};
    saved.forEach(id => {
      const a = ARTISTS.find(x => x.id === id);
      if (!a || a.day !== NOW.day) return;
      const startMin = toNightMin(a.start);
      const endMin = toNightMin(a.end);
      if (endMin <= nowMin) return; // already over
      const minsUntil = startMin - nowMin;
      const existing = map[a.stage];
      if (!existing || minsUntil < existing.minsUntil) {
        map[a.stage] = { artist: a, minsUntil, isLive: nowMin >= startMin };
      }
    });
    return map;
  }, [saved]);

  // Pre-computed starfield — deterministic LCG so it doesn't flicker on re-render
  const stars = React.useMemo(() => {
    let s = 0xdeadbeef;
    const rng = () => { s = Math.imul(s ^ (s >>> 17), 0x45d9f3b) ^ ((s * 0x119de1f3) >>> 16); return ((s >>> 0) / 0x100000000); };
    const out = [];
    for (let i = 0; i < 55; i++) {
      const angle = rng() * Math.PI * 2;
      const dist  = 36 + rng() * 28;
      const x     = +(50 + Math.cos(angle) * dist).toFixed(1);
      const y     = +(50 + Math.sin(angle) * dist).toFixed(1);
      if (x < 0.5 || x > 99.5 || y < 0.5 || y > 99.5) continue;
      out.push({ x, y, r: +(0.18 + rng() * 0.32).toFixed(2), op: +(0.25 + rng() * 0.55).toFixed(2) });
    }
    return out;
  }, []);

  // Push label OUT from stage in the direction farthest from the Daisy Lane
  // plaza centre (50,50), so labels never collide with the central rectangle.
  const anchorFor = (s) => {
    const cx = 50, cy = 50;
    const dx = s.x - cx, dy = s.y - cy;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return dy < 0 ? "N" : "S";
    return dx < 0 ? "W" : "E";
  };

  // v133 pinch + pan. Two-finger pinch updates zoom via onZoomChange; when
  // zoomed in (zoom > 1) a single-finger drag panes via onPanChange. We
  // track whether the gesture actually MOVED so a tap-and-release at the
  // same point still reaches the SVG's onClick (= stage-select / meet pin).
  const gestureRef = React.useRef({ mode: null, startDist: 0, startZoom: 1, startPanX: 0, startPanY: 0, startTouchX: 0, startTouchY: 0, moved: false });
  const _pinchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  const onTouchStart = (e) => {
    const g = gestureRef.current;
    g.moved = false;
    if (e.touches.length >= 2) {
      g.mode = "pinch";
      g.startDist = _pinchDist(e.touches);
      g.startZoom = zoom;
    } else if (e.touches.length === 1 && zoom > 1) {
      g.mode = "pan";
      g.startTouchX = e.touches[0].clientX;
      g.startTouchY = e.touches[0].clientY;
      g.startPanX = pan.x;
      g.startPanY = pan.y;
    } else {
      g.mode = null;
    }
  };
  const onTouchMove = (e) => {
    const g = gestureRef.current;
    if (g.mode === "pinch" && e.touches.length >= 2) {
      e.preventDefault?.();
      const d = _pinchDist(e.touches);
      if (g.startDist <= 0) return;
      const next = Math.max(zoomMin, Math.min(zoomMax, g.startZoom * (d / g.startDist)));
      g.moved = true;
      onZoomChange?.(+next.toFixed(3));
    } else if (g.mode === "pan" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startTouchX;
      const dy = e.touches[0].clientY - g.startTouchY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
      onPanChange?.({ x: g.startPanX + dx, y: g.startPanY + dy });
    }
  };
  const onTouchEnd = () => { gestureRef.current.mode = null; };
  const guardedClick = (e) => {
    // If the user pinched or panned, swallow the synthetic click that fires
    // after touchend so we don't accidentally drop a meet pin or select a
    // stage at the gesture's release point.
    if (gestureRef.current.moved) return;
    onClick?.(e);
  };

  return (
    <div style={{
      position: "absolute", inset: 0, overflow: "hidden",
      background: "#060412",
      touchAction: "none",
    }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
    <div style={{
      position: "absolute", inset: 0,
      transform: `${compass ? `rotate(${mapRotate}deg) ` : ""}translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: "50% 50%",
      // Linear (not ease) so heading changes feel responsive like a real
      // compass needle rather than spongy. The zoom/pan transform shares
      // the same wrapper so they compose cleanly with compass rotation.
      transition: gestureRef.current.mode ? "none" : "transform 0.18s linear",
      willChange: "transform",
    }}>
      {/* xMidYMin (top-anchored) instead of xMidYMid: the map is a square
          (100×100) inside a taller-than-wide container, so centering left a
          navy letterbox band both ABOVE and below it — the top band pushed the
          layers/zoom + OFF-SITE controls into dead space. Anchoring to the top
          collapses the top band entirely (controls now sit over the map) and
          drops the single remaining band to the bottom, where the floating
          search sheet + Friends bar already cover it. Whole map stays visible
          (meet = no cropping). */}
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMin meet"
        onClick={guardedClick}
        style={{ position: "absolute", inset: 0, cursor: meetMode ? "crosshair" : "default", display: "block" }}>
        <defs>
          {/* Night sky ground — deepest at edges, slightly less dark at center */}
          <radialGradient id="mapGround" cx="50%" cy="48%" r="72%">
            <stop offset="0%"   stopColor="#130b28"/>
            <stop offset="55%"  stopColor="#0c0820"/>
            <stop offset="100%" stopColor="#060412"/>
          </radialGradient>
          {/* Purple–teal nebula wash over the infield */}
          <radialGradient id="infieldGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="rgba(120,60,210,0.22)"/>
            <stop offset="60%"  stopColor="rgba(60,30,120,0.08)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
          </radialGradient>
          {/* Warm amber glow at exact infield center for Daisy Lane plaza */}
          <radialGradient id="daisyGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="rgba(240,160,40,0.18)"/>
            <stop offset="100%" stopColor="rgba(240,160,40,0)"/>
          </radialGradient>
          {/* Rainbow LED ring — unchanged, looks great on dark bg */}
          <linearGradient id="ledring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#e85d2e"/>
            <stop offset="20%"  stopColor="#f59a36"/>
            <stop offset="40%"  stopColor="#22c55e"/>
            <stop offset="60%"  stopColor="#38bdf8"/>
            <stop offset="80%"  stopColor="#a78bfa"/>
            <stop offset="100%" stopColor="#ec4899"/>
          </linearGradient>
          {/* Strong glow for stage markers on dark background */}
          <filter id="stageglow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Soft outer bloom for star twinkle */}
          <filter id="starbloom" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Festival-specific map background */}
        {FESTIVAL_CONFIG.mapStyle === "image-overlay" && FESTIVAL_CONFIG.mapImage ? (<>
          <defs>
            <filter id="mapClean" colorInterpolationFilters="sRGB">
              <feColorMatrix type="saturate" values="0.55"/>
              <feColorMatrix type="matrix" values="1.02 0.04 0 0 0.03  0 1.0 0.02 0 0.02  0 0 0.96 0 0.01  0 0 0 1 0"/>
            </filter>
            <linearGradient id="mapFadeL" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#e8dfcf" stopOpacity="0.96"/>
              <stop offset="0.35" stopColor="#e8dfcf" stopOpacity="0.7"/>
              <stop offset="0.65" stopColor="#e8dfcf" stopOpacity="0.15"/>
              <stop offset="1" stopColor="#e8dfcf" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="mapFadeB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8dfcf" stopOpacity="0"/>
              <stop offset="0.7" stopColor="#e8dfcf" stopOpacity="0"/>
              <stop offset="0.88" stopColor="#e8dfcf" stopOpacity="0.5"/>
              <stop offset="1" stopColor="#e8dfcf" stopOpacity="0.92"/>
            </linearGradient>
            <linearGradient id="mapFadeT" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8dfcf" stopOpacity="0.8"/>
              <stop offset="0.12" stopColor="#e8dfcf" stopOpacity="0.3"/>
              <stop offset="0.25" stopColor="#e8dfcf" stopOpacity="0"/>
            </linearGradient>
            <radialGradient id="mapVignette" cx="50%" cy="45%" r="52%">
              <stop offset="0" stopColor="#000" stopOpacity="0"/>
              <stop offset="0.7" stopColor="#000" stopOpacity="0"/>
              <stop offset="1" stopColor="#1a120d" stopOpacity="0.28"/>
            </radialGradient>
            <linearGradient id="parkScrim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.74" stopColor="#0a0f0b" stopOpacity="0"/>
              <stop offset="1" stopColor="#0a0f0b" stopOpacity="0.8"/>
            </linearGradient>
          </defs>
          {FESTIVAL_CONFIG.mapTheme === "park" ? (<>
            {/* Clean park map (ACL) — the official patron map, processed into a
                square asset (legend/title removed, dark letterbox baked in).
                Render crisp + full-bleed; just a soft vignette and a bottom
                scrim so the place card stays legible over it. */}
            <rect x="0" y="0" width="100" height="100" fill="#0a0f0b"/>
            <image href={FESTIVAL_CONFIG.mapImage} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>
            <rect x="0" y="0" width="100" height="100" fill="url(#mapVignette)"/>
            <rect x="0" y="0" width="100" height="100" fill="url(#parkScrim)"/>
          </>) : (<>
            <rect x="0" y="0" width="100" height="100" fill="var(--paper-2)"/>
            <image href={FESTIVAL_CONFIG.mapImage} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" opacity="0.82" filter="url(#mapClean)"/>
            <rect x="0" y="0" width="22" height="100" fill="url(#mapFadeL)"/>
            <rect x="0" y="0" width="100" height="100" fill="url(#mapFadeB)"/>
            <rect x="0" y="0" width="100" height="100" fill="url(#mapFadeT)"/>
            <rect x="0" y="0" width="100" height="100" fill="url(#mapVignette)"/>
            <rect x="0" y="0" width="100" height="100" fill="rgba(247,237,224,0.06)"/>
          </>)}
        </>) : (<>
        {/* Night sky base */}
        <rect x="0" y="0" width="100" height="100" fill="url(#mapGround)"/>

        {/* Starfield — pre-computed positions, no re-render flicker */}
        <g filter="url(#starbloom)">
          {stars.map((st, i) => (
            <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" opacity={st.op}/>
          ))}
        </g>

        {/* LVMS tri-oval track — LED ring blazes bright on dark sky */}
        <path d="M 42 14 L 58 14 A 36 36 0 0 1 58 86 Q 54 88 50 90 Q 46 88 42 86 A 36 36 0 0 1 42 14 Z"
          fill="rgba(20,12,40,0.6)" stroke="rgba(180,140,255,0.12)" strokeWidth="3.2"/>
        <path d="M 42 14 L 58 14 A 36 36 0 0 1 58 86 Q 54 88 50 90 Q 46 88 42 86 A 36 36 0 0 1 42 14 Z"
          fill="none" stroke="url(#ledring)" strokeWidth="1.2" opacity="0.95"/>
        <path d="M 42 14 L 58 14 A 36 36 0 0 1 58 86 Q 54 88 50 90 Q 46 88 42 86 A 36 36 0 0 1 42 14 Z"
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.3"/>
        <path d="M 47 19 L 53 19 A 31 31 0 0 1 53 81 Q 51.5 82.5 50 84 Q 48.5 82.5 47 81 A 31 31 0 0 1 47 19 Z"
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.22" strokeDasharray="1 1.5"/>
        {/* Start/finish stripe */}
        <line x1="50" y1="89.4" x2="50" y2="91.6" stroke="rgba(255,255,255,0.6)" strokeWidth="0.55" strokeLinecap="round"/>
        <line x1="49" y1="90.5" x2="51" y2="90.5" stroke="rgba(0,0,0,0.9)" strokeWidth="0.45" strokeLinecap="round"/>

        {/* Infield nebula glow */}
        <ellipse cx="50" cy="50" rx="38" ry="30" fill="url(#infieldGlow)"/>
        {/* Daisy Lane plaza warm amber center glow */}
        <rect x="37" y="43" width="26" height="16" rx="4" fill="url(#daisyGlow)" opacity="0.85"/>

        {/* Crowd heatmap — estimated density per stage based on lineup tiers.
            Gaussian-blurred circles shift amber→orange→red with crowd level. */}
        {showHeat && (() => {
          const nowMin = toNightMin(NOW.time);
          return (
            <g>
              <defs>
                <filter id="crowdBlur" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4.5"/>
                </filter>
              </defs>
              <g filter="url(#crowdBlur)">
                {stages.map(s => {
                  const d = _crowdDensity(s.id, nowMin);
                  if (d < 0.06) return null;
                  const r   = 5 + d * 11;
                  const col = d > 0.72 ? "#ef4444"
                            : d > 0.44 ? "#f97316"
                            : "#fbbf24";
                  return (
                    <circle key={s.id} cx={s.x} cy={s.y} r={r}
                      fill={col} opacity={0.28 + d * 0.38}/>
                  );
                })}
              </g>
            </g>
          );
        })()}

        {/* Pedestrian arteries — glowing white paths on night sky */}
        <path d="M50,16 Q50,50 50,84" stroke="rgba(255,255,255,0.06)" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
        <path d="M50,16 Q50,50 50,84" stroke="rgba(255,255,255,0.18)" strokeWidth="0.55" fill="none" strokeLinecap="round" strokeDasharray="1.2 1.6"/>
        <path d="M16,50 Q50,52 84,50" stroke="rgba(255,255,255,0.05)" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
        <path d="M16,50 Q50,52 84,50" stroke="rgba(255,255,255,0.14)" strokeWidth="0.45" fill="none" strokeLinecap="round" strokeDasharray="1.2 1.6"/>
        <path d="M28,28 Q38,38 50,51" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" fill="none" strokeLinecap="round" strokeDasharray="0.8 1.2"/>
        <path d="M72,28 Q62,38 50,51" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" fill="none" strokeLinecap="round" strokeDasharray="0.8 1.2"/>

        {/* Daisy Lane central plaza — glowing ember on dark sky */}
        <rect x="37" y="43" width="26" height="16" fill="rgba(232,93,46,0.10)" stroke="rgba(232,93,46,0.55)" strokeWidth="0.35" rx="2.5"/>
        <circle cx="50" cy="51" r="3.5" fill="none" stroke="rgba(232,93,46,0.4)" strokeWidth="0.35"/>
        <circle cx="50" cy="51" r="1.4" fill="rgba(240,160,60,1)">
          <animate attributeName="r" values="1.0;1.6;1.0" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;1;0.9" dur="3s" repeatCount="indefinite"/>
        </circle>

        {/* Entrance gates — bright green on dark, easy to spot */}
        {[
          { id: "S",  x: 76, y: 16 },
          { id: "CD", x:  8, y: 50 },
          { id: "P",  x: 18, y: 84 },
        ].map(g => (
          <g key={g.id}>
            <circle cx={g.x} cy={g.y} r="2.8" fill="rgba(34,197,94,0.22)"/>
            <circle cx={g.x} cy={g.y} r="1.5" fill="#22c55e" stroke="rgba(255,255,255,0.95)" strokeWidth="0.35"/>
            <circle cx={g.x} cy={g.y} r="0.5" fill="#fff"/>
          </g>
        ))}
        </>)}

        {/* Amenity markers — only shown when search sheet is expanded (Find
            Nearby mode). Otherwise they add visual noise over the map. */}
        {!meetMode && showAmenities && (typeof AMENITIES !== "undefined" ? AMENITIES : []).map(a => {
          const cfg = ({
            water:  { color: "#38bdf8", letter: ""  },
            food:   { color: "#fb923c", letter: ""  },
            med:    { color: "#ef4444", letter: "+" },
            toilet: { color: "#64748b", letter: ""  },
            art:    { color: "#f59a36", letter: ""  },
            info:   { color: "#16a34a", letter: "i" },
            charge: { color: "#facc15", letter: "⚡" },
            locker: { color: "#a78bfa", letter: "L" },
          })[a.type] || { color: "#000", letter: "" };
          return (
            <g key={a.id}>
              <circle cx={a.x} cy={a.y} r="1.4" fill={cfg.color} opacity="0.92" stroke="#fff" strokeWidth="0.22"/>
              {cfg.letter && (
                <text x={a.x} y={a.y + 0.65} textAnchor="middle" fontSize="1.8"
                  fill="#fff" fontFamily="Geist Mono, monospace" fontWeight="900">
                  {cfg.letter}
                </text>
              )}
            </g>
          );
        })}

        {/* Route line to selected stage or meet point */}
        {(sel || meetTarget) && (() => {
          const target = meetTarget || sel;
          const c = meetTarget ? "#e85d2e" : "#e85d2e";
          return (
            <g>
              <path d={`M ${avatar.x},${avatar.y} L ${target.x},${target.y}`}
                stroke={c} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.18"/>
              <path d={`M ${avatar.x},${avatar.y} L ${target.x},${target.y}`}
                stroke={c} strokeWidth="0.85" fill="none" strokeLinecap="round" strokeDasharray="2.2 1.6"/>
            </g>
          );
        })()}

        {/* Stage markers */}
        {stages.map(s => {
          const on = s.id === selected;
          const r = 2.8 + (s.size - 1) * 1.1;
          // On the photographic park map, glow blobs look blown-out — use a
          // crisp Mobbin-style pin instead. EDC's dark aerial keeps the glow.
          const isPark = FESTIVAL_CONFIG.mapTheme === "park";
          const pinR = 2.1 + (s.size - 1) * 0.5;
          const savedHere = savedByStage[s.id];
          const nowMin = NOW.time ? toNightMin(NOW.time) : 0;
          const liveArtist = typeof ARTISTS !== "undefined" ? ARTISTS.find(a =>
            a.stage === s.id && a.day === NOW.day &&
            nowMin >= toNightMin(a.start) && nowMin < toNightMin(a.end)
          ) : null;
          const energyR = liveArtist ? (liveArtist.tier === 3 ? 12 : liveArtist.tier === 2 ? 9 : 6) : 0;
          return (
            <g key={s.id} role="button" tabIndex={0} aria-label={`${s.name} stage`}
              style={{ cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onPickStage(s.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPickStage(s.id); } }}>
              {liveArtist && !on && (<>
                <circle cx={s.x} cy={s.y} r={r + 2} fill="none" stroke={s.color} strokeWidth="0.4" opacity="0.7">
                  <animate attributeName="r" values={`${r + 2};${r + energyR};${r + 2}`} dur={liveArtist.tier === 3 ? "1.8s" : "2.4s"} repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0;0.6" dur={liveArtist.tier === 3 ? "1.8s" : "2.4s"} repeatCount="indefinite"/>
                </circle>
                <circle cx={s.x} cy={s.y} r={r + 1} fill="none" stroke={s.color} strokeWidth="0.25" opacity="0.4">
                  <animate attributeName="r" values={`${r + 1};${r + energyR * 0.6};${r + 1}`} dur="3s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite"/>
                </circle>
              </>)}
              {on && (
                <circle cx={s.x} cy={s.y} r={r + 1} fill="none" stroke={s.color} strokeWidth="0.5" opacity="0.9">
                  <animate attributeName="r" values={`${r};${r+6};${r}`} dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
                </circle>
              )}
              {!isPark && (
                <circle cx={s.x} cy={s.y} r={r + 2.4} fill={s.color} opacity={on ? 0.32 : liveArtist ? 0.22 : 0.14} filter="url(#stageglow)"/>
              )}
              {isPark ? (
                <g>
                  <circle cx={s.x} cy={s.y} r={pinR + 0.5} fill="rgba(10,15,11,0.5)"/>
                  <circle cx={s.x} cy={s.y} r={pinR} fill={s.color} stroke="#fff" strokeWidth={on ? 0.7 : 0.5}/>
                  <circle cx={s.x} cy={s.y} r={pinR * 0.34} fill="#fff"/>
                </g>
              ) : (
                <StageIcon id={s.id} cx={s.x} cy={s.y} r={r} on={on} color={s.color}/>
              )}
              {/* Gold ★ pin if the user has an upcoming saved set on this stage */}
              {savedHere && (
                <g transform={`translate(${s.x + r * 0.85}, ${s.y - r * 0.85})`}>
                  <circle r="1.9" fill="rgba(13,8,4,0.85)" stroke="#fbbf24" strokeWidth="0.25"/>
                  <text y="0.85" textAnchor="middle" fontSize="2.4" fontWeight="900" fill="#fbbf24"
                    fontFamily="Geist Mono, monospace">★</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Crew proximity glow — shared ring when you and a friend are near the same spot */}
        {friends.map(f => {
          const dist = Math.hypot(f.x - avatar.x, f.y - avatar.y);
          if (dist > 8) return null;
          const mx = (f.x + avatar.x) / 2, my = (f.y + avatar.y) / 2;
          return (
            <circle key={`prox-${f.id}`} cx={mx} cy={my} r="5" fill="none" stroke={f.color} strokeWidth="0.4" opacity="0.5">
              <animate attributeName="r" values="3;7;3" dur="2.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2.5s" repeatCount="indefinite"/>
            </circle>
          );
        })}

        {/* Friends */}
        {friends.map(f => {
          const focused = meetGroup.includes(f.id);
          const nearby = Math.hypot(f.x - avatar.x, f.y - avatar.y) <= 8;
          return (
            <g key={f.id}>
              <circle cx={f.x} cy={f.y} r="2.5" fill={f.color} opacity={nearby ? 0.35 : 0.22}>
                <animate attributeName="r" values={nearby ? "2.5;4;2.5" : "2;3.5;2"} dur={nearby ? "1.8s" : "2.8s"} repeatCount="indefinite"/>
              </circle>
              <circle cx={f.x} cy={f.y} r={focused ? 1.8 : 1.5} fill={f.avatarTone} stroke={nearby ? "#fff" : "rgba(255,255,255,0.9)"} strokeWidth={nearby ? 0.7 : 0.5}/>
            </g>
          );
        })}

        {/* Meet pin */}
        {meetMode && meetTarget && (
          <g>
            <circle cx={meetTarget.x} cy={meetTarget.y} r="3" fill="none" stroke="#e85d2e" strokeWidth="0.6" opacity="0.8">
              <animate attributeName="r" values="1.5;5.5;1.5" dur="1.4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0;0.9" dur="1.4s" repeatCount="indefinite"/>
            </circle>
            <circle cx={meetTarget.x} cy={meetTarget.y} r="1.6" fill="#e85d2e" stroke="#fff" strokeWidth="0.5"/>
          </g>
        )}

        {/* Walking route line — animated dashed path from avatar to selected stage */}
        {selected && !meetMode && (() => {
          const target = stages.find(s => s.id === selected);
          if (!target) return null;
          const dist = Math.hypot(target.x - avatar.x, target.y - avatar.y);
          if (dist < 4) return null;
          const mid1x = avatar.x + (target.x - avatar.x) * 0.33 + (Math.random() > 0.5 ? 3 : -3);
          const mid1y = avatar.y + (target.y - avatar.y) * 0.33;
          const mid2x = avatar.x + (target.x - avatar.x) * 0.66;
          const mid2y = avatar.y + (target.y - avatar.y) * 0.66 + (Math.random() > 0.5 ? 2 : -2);
          const walkMins = typeof _pairKey === "function" && typeof WALK_PAIRS !== "undefined"
            ? (WALK_PAIRS[_pairKey(_nearestStageId(avatar.x, avatar.y) || "", selected)] || [0, 0])
            : [0, 0];
          const etaMin = Math.round((walkMins[0] + walkMins[1]) / 2) || Math.round(dist * 0.4);
          return (
            <g>
              <path d={`M${avatar.x},${avatar.y} C${mid1x},${mid1y} ${mid2x},${mid2y} ${target.x},${target.y}`}
                fill="none" stroke={target.color} strokeWidth="0.6" strokeDasharray="2 2" opacity="0.6">
                <animate attributeName="stroke-dashoffset" values="0;-8" dur="1.5s" repeatCount="indefinite"/>
              </path>
              <text x={(avatar.x + target.x) / 2} y={(avatar.y + target.y) / 2 - 2}
                textAnchor="middle" fontSize="3" fontFamily="Geist Mono, monospace" fontWeight="700"
                fill={target.color} opacity="0.85"
              >{etaMin} MIN</text>
            </g>
          );
        })()}

        {/* Avatar — you */}
        <g>
          <path d={`M${avatar.x},${avatar.y}
                    L${avatar.x + Math.cos(heading - 0.38) * 6.5},${avatar.y + Math.sin(heading - 0.38) * 6.5}
                    L${avatar.x + Math.cos(heading + 0.38) * 6.5},${avatar.y + Math.sin(heading + 0.38) * 6.5} Z`}
            fill="#f59a36" opacity="0.3"/>
          <circle cx={avatar.x} cy={avatar.y} r="3.2" fill="#f59a36" opacity="0.22">
            <animate attributeName="r" values="2.5;4.5;2.5" dur="2.2s" repeatCount="indefinite"/>
          </circle>
          <circle cx={avatar.x} cy={avatar.y} r="1.8" fill="#f59a36" stroke="rgba(255,255,255,0.95)" strokeWidth="0.6"/>
          <circle cx={avatar.x} cy={avatar.y} r="0.7" fill="#fff"/>
        </g>
      </svg>

      {/* HTML label overlay — sized to match the SVG's xMidYMid-meet square so
          left/top % values align exactly with the dots inside the SVG. */}
      <div style={{
        position: "absolute", top: "50%", left: 0, width: "100%",
        aspectRatio: "1 / 1", transform: "translateY(-50%)",
        pointerEvents: "none",
      }}>
        {/* EDC-specific place labels (Daisy Lane plaza, gates, landmark
            walkways) — hidden on the ACL/park map, which uses the real
            patron-map artwork for all of that. */}
        {FESTIVAL_CONFIG.mapTheme !== "park" && (<>
        <div style={{
          position: "absolute", left: "50%", top: "43%",
          transform: "translate(-50%, -130%)",
          fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 2.2, fontWeight: 700,
          color: "rgba(232,93,46,0.85)",
        }}>DAISY LANE</div>

        {/* Entrance gate labels */}
        {[
          { label: "GATE S",   x: 76, y: 10 },
          { label: "GATE C/D", x:  9, y: 44 },
          { label: "GATE P",   x: 18, y: 91 },
        ].map((g, i) => (
          <div key={i} style={{
            position: "absolute", left: `${g.x}%`, top: `${g.y}%`,
            transform: `translate(-50%, -50%)${counterRot}`,
            fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 1.4, fontWeight: 700,
            color: "rgba(80,230,160,0.92)",
            textShadow: "0 0 8px rgba(80,230,160,0.5)",
            whiteSpace: "nowrap", pointerEvents: "none",
          }}>{g.label}</div>
        ))}

        {/* Named landmarks + walkways from the official patron map.
            Hidden by default; toggle "Landmark labels" in the More menu.
            Per-festival via FESTIVAL_CONFIG.landmarks — this was an inline
            EDC-only array, duplicated in RealMap, drawn on every festival. */}
        {showLabels && (FESTIVAL_CONFIG.landmarks || []).map((lm, i) => (
          <div key={i} style={{
            position: "absolute", left: `${lm.x}%`, top: `${lm.y}%`,
            transform: `translate(-50%, -50%) rotate(${lm.rot}deg)`,
            fontFamily: "Geist Mono, monospace",
            fontSize: lm.size, letterSpacing: lm.ls, fontWeight: 700,
            color: lm.color,
            textShadow: "0 1px 6px rgba(0,0,0,0.8)",
            whiteSpace: "nowrap", pointerEvents: "none",
          }}>{lm.label}</div>
        ))}
        </>)}

        {stages.map(s => {
          const on = s.id === selected;
          // The ACL park map already prints every stage name in its artwork,
          // so always-on dark label pills would clutter + duplicate. On park,
          // show a stage's pill only when it's selected; the crisp pin carries
          // the rest. EDC's text-free aerial keeps labels always on.
          //
          // That test used to be `mapTheme === "park"`, which conflates two
          // different things: mapTheme is about ART STYLE (crisp full-bleed vs
          // faded aerial), not about typography. The wave-1 ground plates are
          // park-themed AND print no text whatsoever, so keying the pills off
          // the theme left Ultra, Gov Ball, Summerfest, Lolla and Outside Lands
          // as nine unlabelled coloured dots with no way to tell them apart.
          // Ask what the code actually means — does this festival's map art
          // already print the stage names? — and default to the old answer for
          // any festival that hasn't said.
          const artPrintsStageNames = FESTIVAL_CONFIG.mapPrintsStageNames
            ?? (FESTIVAL_CONFIG.mapTheme === "park");
          if (artPrintsStageNames && !on) return null;
          // Edge-aware anchor: edge stages prefer vertical anchors (N/S) so
          // their labels don't collide with the central Rainbow Road / plaza
          // landmarks. Pure top/bottom edges fall back to inward push.
          const anchor = (() => {
            const edgeX = s.x < 22 || s.x > 78;
            if (edgeX) {
              // Mid-height edge (cosmic / neon): push UP, away from the busy
              // y≈50 corridor and the central Daisy Lane plaza.
              if (s.y >= 40 && s.y <= 60) return "N";
              if (s.y > 60) return "S";
              return "N";
            }
            if (s.y < 22) return "S";   // far north → label south of dot
            if (s.y > 78) return "N";   // far south → label north of dot
            return anchorFor(s);
          })();
          const pos = { left: `${s.x}%`, top: `${s.y}%` };
          const off = 18;
          const tx = {
            N: { transform: `translate(-50%, calc(-100% - ${off}px))${counterRot}` },
            S: { transform: `translate(-50%, ${off}px)${counterRot}` },
            E: { transform: `translate(${off}px, -50%)${counterRot}` },
            W: { transform: `translate(calc(-100% - ${off}px), -50%)${counterRot}` },
          }[anchor];
          return (
            <div key={s.id} role="button" tabIndex={0} aria-label={`${s.name} stage`}
              onClick={(e) => { e.stopPropagation(); onPickStage(s.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPickStage(s.id); } }}
              style={{
                position: "absolute", ...pos, ...tx,
                pointerEvents: "auto", cursor: "pointer",
                background: on ? s.color : "rgba(6,4,18,0.82)",
                color: on ? "#fff" : "rgba(255,255,255,0.88)",
                border: `1px solid ${on ? s.color : "rgba(255,255,255,0.18)"}`,
                padding: on ? "4px 10px" : "3px 9px",
                borderRadius: 999,
                fontFamily: "Geist Mono, monospace",
                fontSize: on ? 9.5 : 8.5,
                letterSpacing: 1.2, fontWeight: 700,
                whiteSpace: "nowrap",
                boxShadow: on
                  ? `0 4px 18px ${s.color}66, 0 0 8px ${s.color}33`
                  : "0 1px 0 rgba(0,0,0,0.4), 0 2px 12px rgba(0,0,0,0.5)",
                transition: "all 0.15s",
              }}>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: 6,
                background: on ? "#fff" : s.color, marginRight: 6,
                verticalAlign: "1px",
              }}/>
              {s.name.toUpperCase()}
            </div>
          );
        })}

        {friends.map(f => meetGroup.includes(f.id) && (
          <div key={f.id} style={{
            position: "absolute", left: `${f.x}%`, top: `${f.y}%`,
            transform: `translate(-50%, 14px)${counterRot}`,
            background: f.color, color: "#fff",
            padding: "2px 7px", borderRadius: 999,
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            boxShadow: `0 3px 10px ${f.color}66`, pointerEvents: "none",
          }}>
            {f.name.toUpperCase()}
          </div>
        ))}

        {crewFriends.map(f => {
          const seen    = formatLastSeen(f.ts);
          const initial = (f.name?.[0] || "?").toUpperCase();
          const atStage = f.stageId ? stages.find(s => s.id === f.stageId) : null;
          return (
            <div key={`crew-${f.id}`} style={{
              position: "absolute", left: `${f.x}%`, top: `${f.y}%`,
              transform: `translate(-50%, calc(-100% - 4px))${counterRot}`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              pointerEvents: "none",
              opacity: seen.freshness === "cold" ? 0.78 : 1,
            }}>
              {/* Avatar circle — Instagram-style, color background, serif initial */}
              <div style={{
                width: 32, height: 32, borderRadius: 999,
                background: f.color,
                border: "2px solid rgba(255,255,255,0.95)",
                boxShadow: `0 4px 14px ${f.color}aa, 0 0 0 1px rgba(0,0,0,0.45)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
                fontFamily: "Instrument Serif, serif", fontSize: 18, fontWeight: 400,
                lineHeight: 1,
              }}>{initial}</div>
              {/* Name + last-seen pill */}
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(6,4,18,0.85)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.18)",
                padding: "2px 7px", borderRadius: 999,
                fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 1.1, fontWeight: 700,
                whiteSpace: "nowrap",
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: 5,
                  background: seen.color,
                  animation: seen.freshness === "fresh" ? "pulse 1.6s infinite" : "none",
                }}/>
                {f.name.toUpperCase()}
                {atStage && (
                  <span style={{ color: atStage.color, fontWeight: 700 }}>
                    · {(atStage.short || atStage.name).toUpperCase()}
                  </span>
                )}
                {seen.label && seen.freshness !== "fresh" && (
                  <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                    · {seen.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div style={{
          position: "absolute", left: `${avatar.x}%`, top: `${avatar.y}%`,
          transform: `translate(-50%, -22px)${counterRot}`,
          background: "rgba(245,154,54,0.95)", color: "#fff",
          padding: "2px 8px", borderRadius: 999,
          fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
          pointerEvents: "none", boxShadow: "0 3px 10px rgba(245,154,54,0.45)",
        }}>YOU</div>
      </div>
    </div>

      {/* Compass rose — fixed-position badge in the upper-right of the map.
          The needle inside rotates so the red tip always points to true north
          regardless of which way the user is facing. Tells you at a glance
          "which direction am I oriented?" without obscuring the map. */}
      {compass && (
        <div style={{
          position: "absolute", top: 12, right: 12,
          width: 44, height: 44, borderRadius: 44,
          background: "rgba(247,237,224,0.92)",
          border: "1px solid var(--line-2)",
          boxShadow: "0 3px 10px rgba(26,18,13,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 5, pointerEvents: "none",
        }}>
          <div style={{
            width: 32, height: 32, position: "relative",
            transform: `rotate(${mapRotate}deg)`,
            transition: "transform 0.18s linear",
          }}>
            <div style={{
              position: "absolute", top: 0, left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "Geist Mono, monospace", fontSize: 8, fontWeight: 800,
              color: "#c14a4a", letterSpacing: 0.5,
            }}>N</div>
            <svg width="32" height="32" viewBox="-16 -16 32 32" style={{ position: "absolute", inset: 0 }}>
              <path d="M0,-9 L2.5,2 L0,0 L-2.5,2 Z" fill="#c14a4a"/>
              <path d="M0,9 L2.5,-2 L0,0 L-2.5,-2 Z" fill="rgba(26,18,13,0.45)"/>
              <circle cx="0" cy="0" r="1.2" fill="var(--ink)"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- RIDESHARE SHEET ----
// Drivers can't enter the speedway grounds; the official pickup is the
// south parking rideshare lot (~36.255, -115.012). We open the universal
// Uber/Lyft web links — these auto-bridge to the native app if installed,
// else fall through to the in-browser request flow.
function RideshareSheet({ onClose }) {
  if (!FESTIVAL_CONFIG.rideshareGps) {
    return (
      <div onClick={onClose} style={{
        position: "absolute", inset: 0, zIndex: 12,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end",
        animation: "fadeIn .2s",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "var(--paper)", color: "var(--ink)",
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          width: "100%", padding: "28px 24px 36px", textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", margin: "0 auto 14px",
            background: "var(--paper-2)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>🚗</div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 400, marginBottom: 6 }}>Rideshare coming soon</div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, maxWidth: 260, margin: "0 auto" }}>
            We're mapping pickup zones for {FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name}. Check back closer to the festival.
          </div>
          <button onClick={onClose} className="mono" style={{
            marginTop: 18, padding: "10px 32px", borderRadius: 10, border: "none",
            background: "var(--ink)", color: "var(--paper)",
            fontSize: 10, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
          }}>GOT IT</button>
        </div>
      </div>
    );
  }
  const { lat, lng, label, note } = FESTIVAL_CONFIG.rideshareGps;
  const open = (url) => { window.open(url, "_blank", "noopener"); onClose(); };
  const nickname = encodeURIComponent(`${FESTIVAL_CONFIG.brand} Rideshare Pickup`);
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${lat}&pickup[longitude]=${lng}&pickup[nickname]=${nickname}`;
  const lyftUrl = `https://lyft.com/ride?id=lyft&partner=&pickup[latitude]=${lat}&pickup[longitude]=${lng}`;

  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 12,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-end",
      animation: "fadeIn .2s",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--paper)", color: "var(--ink)",
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        width: "100%", padding: "14px 20px 24px",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: "var(--line-2)" }}/>
        </div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, color: "var(--muted)", marginBottom: 4 }}>
          RIDESHARE · {label.toUpperCase()}
        </div>
        <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, marginBottom: 10 }}>
          Get a ride from {FESTIVAL_CONFIG.locationShort}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 16 }}>
          {note} Pin pre-set so your driver finds you.
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <button onClick={() => open(uberUrl)} style={{
            background: "#000", color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 16px",
            fontFamily: "Geist Mono, monospace", fontSize: 12, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer",
          }}>OPEN UBER</button>
          <button onClick={() => open(lyftUrl)} style={{
            background: "#FF00BF", color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 16px",
            fontFamily: "Geist Mono, monospace", fontSize: 12, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer",
          }}>OPEN LYFT</button>
          <button onClick={onClose} style={{
            background: "transparent", color: "var(--muted)",
            border: "1px solid var(--line-2)",
            borderRadius: 12, padding: "12px 16px",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
            cursor: "pointer",
          }}>CANCEL</button>
        </div>

        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 14, textAlign: "center" }}>
          Universal links — opens app if installed, web otherwise.
        </div>
      </div>
    </div>
  );
}

// ---- GROUND-LEVEL PEEK (picture-in-picture window showing stage from avatar POV) ----
function GroundPeek({ stage, onClose }) {
  return (
    <div style={{
      position: "absolute", top: 12, right: 12,
      width: 160, height: 120,
      borderRadius: 12, overflow: "hidden",
      background: "#0a0414",
      border: "1px solid rgba(247,237,224,0.2)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      zIndex: 4,
    }}>
      <svg viewBox="0 0 200 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`peekSky-${stage.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a0a3d"/>
            <stop offset="60%" stopColor="#3d1a5a"/>
            <stop offset="100%" stopColor="#e85d2e"/>
          </linearGradient>
          <linearGradient id={`peekGnd-${stage.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1530"/>
            <stop offset="100%" stopColor="#0a0414"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="60" fill={`url(#peekSky-${stage.id})`}/>
        <rect x="0" y="60" width="200" height="80" fill={`url(#peekGnd-${stage.id})`}/>
        {/* stage silhouette */}
        <rect x="60" y="30" width="80" height="40" fill="#0a0414" stroke={stage.color} strokeWidth="1.5"/>
        <rect x="72" y="38" width="56" height="22" fill={stage.color} opacity="0.9"/>
        <rect x="56" y="24" width="88" height="4" fill="#0a0414" stroke={stage.color} strokeWidth="0.8"/>
        {[-2,-1,0,1,2].map(i => (
          <g key={i}>
            <circle cx={100 + i*16} cy={26} r="1.3" fill={stage.color}/>
            <line x1={100+i*16} y1={26} x2={100+i*16+i*6} y2={10} stroke={stage.color} strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
          </g>
        ))}
        {/* crowd */}
        <path d="M20,80 Q100,65 180,80 L180,95 L20,95 Z" fill="#000" opacity="0.8"/>
        {/* label */}
        <rect x="65" y="108" width="70" height="14" rx="7" fill="rgba(10,4,20,0.9)" stroke={stage.color} strokeWidth="0.8"/>
        <text x="100" y="117" textAnchor="middle" fill={stage.color} fontFamily="Geist Mono, monospace" fontSize="7" fontWeight="700" letterSpacing="1">{stage.name.toUpperCase()}</text>
      </svg>
      <button onClick={onClose} aria-label="Close" style={{
        position: "absolute", top: 4, right: 4,
        width: 20, height: 20, borderRadius: 20,
        background: "rgba(10,4,20,0.85)", border: "1px solid rgba(247,237,224,0.3)",
        color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, padding: 0,
      }}>×</button>
      <div style={{
        position: "absolute", bottom: 4, left: 4,
        fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 1.2,
        color: "rgba(247,237,224,0.7)", background: "rgba(10,4,20,0.6)",
        padding: "2px 5px", borderRadius: 4,
      }}>GROUND VIEW</div>
    </div>
  );
}

// ---- BOTTOM SHEET ----
// WCAG contrast helper — picks dark vs white ink for text/icons sitting ON a
// stage color, so light stages (cyan/green/yellow) don't render unreadable
// white text on the hero / GO HERE button / nav icon. Relative-luminance gate.
function _inkOn(hex) {
  try {
    const h = String(hex).replace("#", "");
    const n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const ch = i => { let v = parseInt(n.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
    return L > 0.45 ? "#1a120d" : "#fff";
  } catch { return "#fff"; }
}

// Slim "navigating" chrome shown after GO HERE: collapses the full place card
// so the animated walking route + ETA already drawn on the map are visible.
// Purpose-built wayfinding (not the meet card) — DETAILS reopens the card,
// STOP deselects the stage.
function StageNavBar({ stage, walk, onDetails, onStop }) {
  const eta = walk.lo === walk.hi ? `${walk.lo}` : `${walk.lo}–${walk.hi}`;
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onStop(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStop]);
  return (
    <div style={{
      background: "var(--paper)", color: "var(--ink)",
      padding: "12px 14px calc(12px + env(safe-area-inset-bottom, 0px))",
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", gap: 11,
      animation: "sheetUp 0.25s var(--ease-smooth)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 40, background: stage.color, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={_inkOn(stage.color)} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, fontWeight: 700, color: "var(--muted)" }}>ROUTING TO</div>
        <div className="serif" style={{ fontSize: 19, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stage.name}</div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 600, marginTop: 1 }}>~{eta} MIN · FOLLOW THE ROUTE</div>
      </div>
      <button onClick={onDetails} aria-label="Show stage details" className="mono" style={{
        flexShrink: 0, background: "var(--paper-2)", border: "1px solid var(--line-2)", color: "var(--ink)",
        borderRadius: 999, padding: "9px 13px", cursor: "pointer", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
      }}>DETAILS</button>
      <button onClick={onStop} aria-label="Stop routing" className="mono" style={{
        flexShrink: 0, background: "var(--ink)", border: "none", color: "var(--paper)",
        borderRadius: 999, padding: "9px 13px", cursor: "pointer", fontSize: 10, letterSpacing: 1.2, fontWeight: 800,
      }}>✕ STOP</button>
    </div>
  );
}

function BottomSheet({ stage, nowAtStage, dist, walk, peek, setPeek, meetMode, meetTarget, friends, meetGroup = [], avatar, onClose, onCancelMeet, onOpenArtist, onGoHere, stageSaved, onToggleSave, state, setState }) {
  if (meetMode && meetTarget) {
    const groupFriends = meetGroup.map(id => friends.find(fr => fr.id === id)).filter(Boolean);
    const youDist = Math.sqrt((meetTarget.x-avatar.x)**2 + (meetTarget.y-avatar.y)**2);
    const youMins = distToMins(youDist);
    const fEtas = groupFriends.map(f => ({ f, mins: distToMins(Math.sqrt((meetTarget.x-f.x)**2 + (meetTarget.y-f.y)**2)) }));
    const eta = Math.max(youMins, ...fEtas.map(e => e.mins), 0);
    const title = groupFriends.length === 0 ? "Pinned spot"
      : groupFriends.length === 1 ? `You + ${groupFriends[0].name}`
      : `Group · ${groupFriends.length + 1} people`;
    const routingLabel = groupFriends.length > 1 ? "ALL ROUTING LIVE" : groupFriends.length === 1 ? "BOTH ROUTING LIVE" : "ROUTING LIVE";
    return (
      <div style={{ background: "var(--paper)", color: "var(--ink)", padding: "14px 16px 12px", borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -10px 30px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 38, background: "var(--ember)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--ember)", fontWeight: 700 }}>MEETING</div>
            <div className="serif" style={{ fontSize: 20, lineHeight: 1.05 }}>{title}</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 2 }}>ETA ~{eta} MIN · {routingLabel}</div>
          </div>
          <button onClick={onCancelMeet} style={{ background: "transparent", border: "1px solid var(--line-2)", color: "var(--muted)", borderRadius: 999, padding: "7px 10px", cursor: "pointer", fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600 }}>END</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <div style={{ flex: "1 0 calc(50% - 4px)", background: "var(--paper-2)", borderRadius: 10, padding: "7px 10px" }}>
            <div className="mono" style={{ fontSize: 8, letterSpacing: 1.3, color: "var(--muted)" }}>YOUR ETA</div>
            <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>{youMins} <span style={{ fontSize: 11 }}>min</span></div>
          </div>
          {fEtas.map(({ f, mins }) => (
            <div key={f.id} style={{ flex: "1 0 calc(50% - 4px)", background: "var(--paper-2)", borderRadius: 10, padding: "7px 10px" }}>
              <div className="mono" style={{ fontSize: 8, letterSpacing: 1.3, color: f.color }}>{f.name.toUpperCase()} ETA</div>
              <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>{mins} <span style={{ fontSize: 11 }}>min</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!stage) return null;
  return <StageLineupSheet stage={stage} walk={walk} dist={dist} peek={peek} setPeek={setPeek} onClose={onClose} onOpenArtist={onOpenArtist} onGoHere={onGoHere} stageSaved={stageSaved} onToggleSave={onToggleSave} nowAtStage={nowAtStage} state={state} setState={setState}/>;
}

// Per-stage memories strip — same rewatch loop as the per-artist strip on
// the Artist screen, filtered by every moment whose tagged artist plays
// THIS stage. Hidden when the user has nothing here. Reuses
// _YourMomentThumb from artist.jsx (top-level globals; resolved at render
// time even though map.jsx parses first in the load order).
function YourStagePhotosStrip({ stageId, accent, onOpen, stageObj }) {
  const [moments, setMoments] = React.useState(() => {
    try { return _readMoments(); } catch { return {}; }
  });
  React.useEffect(() => {
    const refresh = () => { try { setMoments(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    refresh();
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  const mine = React.useMemo(() => {
    const out = [];
    for (const n of Object.keys(moments)) {
      for (const m of (moments[n] || [])) {
        if (!m.artistId) continue;
        const a = ARTISTS.find(x => x.id === m.artistId);
        if (a?.stage === stageId) out.push(m);
      }
    }
    return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [moments, stageId]);
  if (mine.length === 0) return null;
  const preview = mine.slice(0, 6);
  const more = mine.length - preview.length;
  return (
    <div style={{
      marginBottom: 10, padding: "10px 12px",
      background: `${accent}14`, border: `1px solid ${accent}40`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: accent, fontWeight: 700 }}>
            ◐ YOUR NIGHTS AT THIS STAGE
          </div>
          <div className="serif" style={{ fontSize: 13, color: "var(--ink)", marginTop: 2 }}>
            {mine.length} {mine.length === 1 ? "memory" : "memories"} saved
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {stageObj && mine.length > 0 && (<>
            <button
              onClick={() => window._shareStageCollage?.(stageObj, mine)}
              className="mono"
              title="Share a photo collage of your nights at this stage"
              style={{
                background: accent, color: "#fff", border: "none",
                borderRadius: 999, padding: "5px 11px", cursor: "pointer",
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                whiteSpace: "nowrap",
              }}>📸 SHARE</button>
            <button
              onClick={() => window._shareStageCollage?.(stageObj, mine, "gif")}
              className="mono"
              title="Share an animated GIF of your nights at this stage"
              style={{
                background: "#6D28D9", color: "#fff", border: "none",
                borderRadius: 999, padding: "5px 11px", cursor: "pointer",
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                whiteSpace: "nowrap",
              }}>🎬 GIF</button>
          </>)}
          <button onClick={onOpen} className="mono" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            padding: 0,
          }}>VIEW ALL →</button>
        </div>
      </div>
      <div style={{
        display: "flex", gap: 6, overflowX: "auto",
        margin: "0 -2px", padding: "0 2px 2px",
        scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
      }}>
        {preview.map(m => (
          <_YourMomentThumb key={m.id} moment={m} accent={accent} onClick={() => onOpen(m.night)} />
        ))}
        {more > 0 && (
          <button onClick={onOpen} className="mono" aria-label={`View all ${mine.length} memories`} style={{
            width: 76, height: 76, flexShrink: 0,
            borderRadius: 10,
            background: "transparent",
            border: `1px dashed ${accent}66`, color: accent,
            cursor: "pointer", fontSize: 10, letterSpacing: 1, fontWeight: 700,
          }}>+{more}</button>
        )}
      </div>
    </div>
  );
}

function StageLineupSheet({ stage, walk, dist, peek, setPeek, onClose, onOpenArtist, onGoHere, stageSaved, onToggleSave, nowAtStage, state, setState }) {
  const [day, setDay] = React.useState(NOW.day);
  const [expanded, setExpanded] = React.useState(false);
  const toSlot = t => { const h = parseInt(t.split(":")[0]); return h < 8 ? h + 24 : h; };
  const sets = ARTISTS
    .filter(a => a.stage === stage.id && a.day === day)
    .sort((a, b) => toSlot(a.start) - toSlot(b.start));
  const totalAcrossDays = ARTISTS.filter(a => a.stage === stage.id).length;
  const heroInk = _inkOn(stage.color);
  // Esc closes the place card (keyboard / a11y parity with the × button).
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={{
      background: "var(--paper)", color: "var(--ink)",
      padding: "0 0 10px",
      borderTopLeftRadius: 22, borderTopRightRadius: 22,
      boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
      maxHeight: expanded ? "72vh" : "auto",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      animation: "sheetUp 0.3s var(--ease-smooth)",
    }}>
      {/* Stage-color hero strip — Apple Maps place-card pattern. Ink (text +
          handle + close) auto-flips to dark on light stage colors so it stays
          WCAG-readable on cyan/green/yellow stages, not just dark ones. */}
      <div style={{
        background: stage.color, color: heroInk,
        padding: "6px 16px 12px", position: "relative",
      }}>
        <div onClick={() => setExpanded(e => !e)} style={{
          display: "flex", justifyContent: "center", cursor: "pointer",
          padding: "2px 0 8px",
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 4, background: heroInk === "#fff" ? "rgba(255,255,255,0.55)" : "rgba(26,18,13,0.45)" }}/>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, fontWeight: 700, opacity: 0.85, marginBottom: 3 }}>
              {stage.short} · STAGE
            </div>
            <div className="serif" style={{ fontSize: 24, lineHeight: 1, letterSpacing: -0.3 }}>
              {stage.name}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: heroInk === "#fff" ? "rgba(255,255,255,0.22)" : "rgba(26,18,13,0.14)",
            border: `1px solid ${heroInk === "#fff" ? "rgba(255,255,255,0.35)" : "rgba(26,18,13,0.25)"}`,
            color: heroInk, borderRadius: 999, width: 30, height: 30, padding: 0,
            cursor: "pointer", fontSize: 16, fontWeight: 700, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}>×</button>
        </div>
      </div>

      {/* Metadata grid — Apple-Maps place-card stat cells. Replaces the old
          crammed single 9px line: each fact gets its own scannable cell. */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
        padding: "10px 14px 0",
      }}>
        {[
          { label: "WALK", value: walk.lo === walk.hi ? `${walk.lo}` : `${walk.lo}–${walk.hi}`, unit: "min", note: walk.peak ? "PEAK" : walk.plan ? "PLAN 20+" : null },
          { label: "DISTANCE", value: `${Math.round(dist*22)}`, unit: "m", note: null },
          { label: "SETS", value: `${sets.length}`, unit: day === NOW.day ? "today" : "set day", note: `${totalAcrossDays} · 3 NIGHTS` },
        ].map(c => (
          <div key={c.label} style={{
            background: "var(--paper-2)", border: "1px solid var(--line)",
            borderRadius: 12, padding: "8px 10px", minWidth: 0,
          }}>
            <div className="mono" style={{ fontSize: 8, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>{c.label}</div>
            <div className="serif" style={{ fontSize: 20, lineHeight: 1, marginTop: 3, color: "var(--ink)" }}>
              {c.value}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)" }}> {c.unit}</span>
            </div>
            {c.note && <div className="mono" style={{ fontSize: 8, letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.note}</div>}
          </div>
        ))}
      </div>

      {/* Primary CTA row — GO HERE (route + live ETA) · PEEK · SAVE.
          Apple-Maps "Directions / … / bookmark" pattern. */}
      <div style={{ display: "flex", gap: 6, padding: "8px 14px 0" }}>
        <button onClick={() => onGoHere?.(stage)} className="mono" style={{
          flex: 2, background: stage.color, color: heroInk, border: "none",
          borderRadius: 12, padding: "11px 10px", cursor: "pointer",
          fontSize: 11, letterSpacing: 1.2, fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={heroInk} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
          GO HERE
        </button>
        <button onClick={() => setPeek(p => !p)} aria-pressed={peek} className="mono" style={{
          flex: 1, background: peek ? stage.color : "var(--paper-2)",
          color: peek ? "#fff" : "var(--ink)",
          border: peek ? "none" : "1px solid var(--line-2)",
          borderRadius: 12, padding: "11px 8px", cursor: "pointer",
          fontSize: 11, letterSpacing: 1.2, fontWeight: 700,
        }}>{peek ? "◉ PEEK" : "◯ PEEK"}</button>
        <button onClick={() => onToggleSave?.(stage.id)} aria-pressed={!!stageSaved}
          aria-label={stageSaved ? "Saved — remove this stage" : "Save this stage"} className="mono" style={{
          flex: 1, background: stageSaved ? "rgba(232,93,46,0.12)" : "var(--paper-2)",
          color: stageSaved ? "var(--ember)" : "var(--ink)",
          border: stageSaved ? "1px solid rgba(232,93,46,0.45)" : "1px solid var(--line-2)",
          borderRadius: 12, padding: "11px 8px", cursor: "pointer",
          fontSize: 11, letterSpacing: 1.2, fontWeight: 700,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>{stageSaved ? "♥ SAVED" : "♡ SAVE"}</button>
      </div>

      {/* Secondary — full lineup + far-stage hint. */}
      <div style={{ display: "flex", gap: 6, padding: "8px 14px 2px" }}>
        <button onClick={() => setState({ ...state, tab: "lineup", lineupDay: day, stageFilter: stage.id })} className="mono" style={{
          flex: 1, background: "transparent", border: "1px solid var(--line-2)",
          color: "var(--muted)", borderRadius: 999, padding: "7px 13px", cursor: "pointer",
          fontSize: 10, letterSpacing: 1.2, fontWeight: 700, whiteSpace: "nowrap",
        }}>☰ FULL LINEUP</button>
        {walk.lo > 25 && (
          <div className="mono" style={{
            flexShrink: 0, background: "rgba(193,74,74,0.1)", border: "1px solid rgba(193,74,74,0.35)",
            color: "#c14a4a", borderRadius: 999, padding: "7px 13px",
            fontSize: 10, letterSpacing: 1.2, fontWeight: 700, whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center",
          }}>↗ FAR · {walk.lo} MIN</div>
        )}
      </div>

      <div style={{ padding: "6px 14px 0" }}>

      {/* Stage vibe — vet-flavor descriptor that summarises the room's
          identity ("Sunrise Cathedral", "Loudest Drops") plus when it peaks.
          Falls back gracefully if the stage data has no vibe field yet. */}
      {stage.vibe && (
        <div style={{
          marginBottom: 10, padding: "9px 11px", borderRadius: 12,
          background: "var(--paper-2)",
          borderLeft: `3px solid ${stage.color}`,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: 1.4, fontWeight: 800,
              color: stage.color, textTransform: "uppercase",
            }}>{stage.vibe}</div>
            {stage.peak && (
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 600 }}>
                PEAKS {stage.peak}
              </div>
            )}
          </div>
          {stage.vibeNote && (
            <div style={{ fontSize: 12, lineHeight: 1.35, color: "var(--ink)", marginTop: 4 }}>
              {stage.vibeNote}
            </div>
          )}
        </div>
      )}

      {/* Per-stage memories strip — second surface in the rewatch loop.
          Hidden when there's nothing here yet. */}
      <YourStagePhotosStrip
        stageId={stage.id}
        accent={stage.color}
        stageObj={stage}
        onOpen={(n) => setState({ ...state, tab: "memories", memoriesNight: n || NOW.day, focusStage: null })}
      />

      {/* Day tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {DAYS.map(d => {
          const on = d.n === day;
          const count = ARTISTS.filter(a => a.stage === stage.id && a.day === d.n).length;
          return (
            <button key={d.n} onClick={() => { setDay(d.n); setExpanded(true); }} style={{
              flex: 1, padding: "7px 6px", borderRadius: 8,
              background: on ? stage.color : "var(--paper-2)",
              color: on ? "#fff" : "var(--ink)",
              border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            }}>
              <span className="mono" style={{ fontSize: 9, letterSpacing: 1.4, opacity: on ? 0.85 : 0.55, fontWeight: 600 }}>{d.label}</span>
              <span className="serif" style={{ fontSize: 13, lineHeight: 1 }}>{count} <span style={{ fontSize: 9, opacity: 0.7 }}>sets</span></span>
            </button>
          );
        })}
      </div>

      {/* Now playing marker (only if today) */}
      {day === NOW.day && nowAtStage && (
        <div onClick={() => onOpenArtist(nowAtStage.id)} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", marginBottom: 8,
          background: stage.color, color: "#fff",
          borderRadius: 12, cursor: "pointer",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 7, background: "#fff",
            boxShadow: "0 0 0 4px rgba(255,255,255,0.3)",
            animation: "pulse 1.6s infinite", flexShrink: 0,
          }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.6, fontWeight: 700, opacity: 0.9 }}>ON STAGE NOW</div>
            <div className="serif" style={{ fontSize: 16, lineHeight: 1.05 }}>{nowAtStage.name}</div>
          </div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1, opacity: 0.9, whiteSpace: "nowrap" }}>
            {fmt12(nowAtStage.start)}–{fmt12(nowAtStage.end)}
          </div>
        </div>
      )}

      {/* Full day lineup */}
      <div style={{ overflowY: "auto", flex: 1, maxHeight: expanded ? "50vh" : 180, paddingBottom: 6 }}>
        {sets.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 16, fontStyle: "italic", color: "var(--muted)" }}>
              No sets scheduled — stage dark tonight
            </div>
          </div>
        )}
        {sets.map(s => {
          const live = s.id === NOW.currentArtistId && day === NOW.day;
          const isSaved = state?.saved?.includes(s.id);
          const toggleSaveSet = (e) => {
            e.stopPropagation();
            if (!state || !setState) return;
            const next = isSaved
              ? state.saved.filter(id => id !== s.id)
              : [...state.saved, s.id];
            setState({ ...state, saved: next });
          };
          return (
            <div key={s.id} onClick={() => onOpenArtist(s.id)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 4px",
              borderBottom: "1px solid var(--line)",
              cursor: "pointer",
              opacity: live ? 1 : 0.92,
            }}>
              <div style={{ width: 52, flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: 0.3, fontWeight: 600, color: live ? stage.color : "var(--ink)" }}>{fmt12(s.start)}</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 0.8, color: "var(--muted)" }}>{fmt12(s.end)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 18, lineHeight: 1.1, letterSpacing: -0.2 }}>{s.name}</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2 }}>
                  {s.genre.toUpperCase()}
                </div>
              </div>
              {live && (
                <span className="mono" style={{
                  fontSize: 8, letterSpacing: 1.3, fontWeight: 700,
                  color: "#fff", background: stage.color,
                  padding: "2px 6px", borderRadius: 4,
                }}>LIVE</span>
              )}
              <button onClick={toggleSaveSet} aria-pressed={isSaved} aria-label={isSaved ? `Remove ${s.name} from saved sets` : `Save ${s.name}`} style={{
                background: isSaved ? "var(--ember)" : "transparent",
                border: `1px solid ${isSaved ? "var(--ember)" : "var(--line-2)"}`,
                color: isSaved ? "#fff" : "var(--muted)",
                borderRadius: 999, width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, fontSize: 13,
                transition: "all .15s",
              }}>{isSaved ? "✓" : "+"}</button>
            </div>
          );
        })}
      </div>

      {!expanded && sets.length > 3 && (
        <button onClick={() => setExpanded(true)} style={{
          marginTop: 4, padding: "8px",
          background: "transparent", border: "none",
          fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.3, color: "var(--muted)",
          cursor: "pointer", fontWeight: 600,
        }}>SEE ALL {sets.length} SETS ↓</button>
      )}
      </div>
    </div>
  );
}

// ── MESSAGE DRAWER ── per-friend chat with offline queue + canned replies
// Pass myPresId + friend.presId to enable real Supabase-persisted DMs.
// Persisted DMs (v132) piggyback on crew_messages with a sorted-pair
// `dm-${pidA}-${pidB}` room id — both sides resolve to the same room
// without coordinating, and threads survive reloads + offline gaps
// (vs the prior ephemeral broadcast channel).
// Falls back to the demo bot when either presId is absent or the
// persisted DM helpers aren't loaded.
function _crewRowToThreadItem(row, myPid) {
  return {
    id: row.id,
    from: row.sender_pid === myPid ? "me" : "them",
    text: row.body,
    ts:   new Date(row.created_at).getTime(),
    status: "sent",
  };
}
function MessageDrawer({ friend, myPresId, avatarStage, saved = [], onClose, onSwitchToMeet }) {
  const isRealDM = !!(myPresId && friend.presId && typeof sbDMSend === "function");
  const myName = (() => {
    try {
      return localStorage.getItem("plursky_display_name")
          || localStorage.getItem("user_name")
          || "Me";
    } catch { return "Me"; }
  })();

  const [thread, setThread] = React.useState(() => loadThread(friend.id));
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const scrollerRef = React.useRef(null);
  const replyTimer = React.useRef(null);
  const threadRef = React.useRef(thread);
  threadRef.current = thread;

  React.useEffect(() => {
    markRead(friend.id);
    return () => { if (replyTimer.current) clearTimeout(replyTimer.current); };
  }, [friend.id]);

  // Persisted DM path: fetch the full thread from crew_messages on open
  // (server is source of truth) and subscribe to new INSERTs. Failures
  // fall through to the localStorage-only thread so offline-on-open
  // still shows something.
  React.useEffect(() => {
    if (!isRealDM) return;
    let cancelled = false;
    sbDMFetchMessages(myPresId, friend.presId).then(rows => {
      if (cancelled) return;
      const server = rows.map(r => _crewRowToThreadItem(r, myPresId));
      // Preserve any local "queued" items not yet on server (offline sends).
      const localPending = threadRef.current.filter(m => m.status === "queued");
      const next = [...server, ...localPending];
      setThread(next);
      saveThread(friend.id, next);
    }).catch(() => {});
    const unsub = sbDMSubscribe(myPresId, friend.presId, (row) => {
      // Skip our own echoes — the optimistic stub from `send` covers it.
      if (row.sender_pid === myPresId) return;
      const incoming = _crewRowToThreadItem(row, myPresId);
      // De-dup on row id in case the same INSERT fires more than once.
      if (threadRef.current.some(m => m.id === incoming.id)) return;
      const updated = [...threadRef.current, incoming];
      setThread(updated);
      saveThread(friend.id, updated);
      setTyping(false);
    });
    return () => { cancelled = true; unsub?.(); };
  }, [isRealDM, myPresId, friend.presId]);

  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [thread, typing]);

  const friendStage = STAGES.find(s => s.id === (friendStatus(friend.id)?.stage));
  const status = friendStatus(friend.id);
  const statusAge = status ? Math.round((Date.now() - status.ts) / 60000) : null;

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const stamped = trimmed +
      (avatarStage && /(my (loc|spot)|where|here)/i.test(trimmed) && !/[a-z]field|stage/i.test(trimmed)
        ? ` (${STAGES.find(s => s.id === avatarStage)?.short || ""})` : "");
    const optimisticTs = Date.now();
    const optimistic = { from: "me", text: stamped, ts: optimisticTs, status: navigator.onLine ? "sent" : "queued" };
    const newThread = [...thread, optimistic];
    setThread(newThread);
    saveThread(friend.id, newThread);
    setDraft("");

    if (isRealDM) {
      // Persisted DM via crew_messages with `dm-${sortedPids}` room id.
      // sbCrewSendMessage queues to the offline outbox if the network is
      // down, so the message isn't lost. The realtime INSERT echo will
      // arrive shortly and de-dup against the row id we get back on
      // refetch — for now the optimistic stub stays as-is.
      const { error } = await sbDMSend(myPresId, friend.presId, myName, stamped);
      if (error && error !== "queued") {
        // Mark the optimistic stub as failed so the user can see it.
        setThread(prev => prev.map(m =>
          m.ts === optimisticTs && m.from === "me" ? { ...m, status: "failed" } : m
        ));
      }
    } else {
      // Demo bot (LIME/FROG/NEON/PLUM — no presId, no server room).
      const [reply, delay] = _fakeReply(stamped);
      setTyping(true);
      replyTimer.current = setTimeout(() => {
        setTyping(false);
        const next = [...newThread, { from: "them", text: reply, ts: Date.now() }];
        setThread(next);
        saveThread(friend.id, next);
      }, delay);
    }
  };

  const sendNativeSMS = async () => {
    const text = `(via Plursky) at ${avatarStage ? STAGES.find(s => s.id === avatarStage)?.name : "EDC"} — meet up?`;
    if (navigator.share) {
      try { await navigator.share({ text, title: `to ${friend.name}` }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", animation: "fadeIn .2s" }}/>
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: "var(--paper)", color: "var(--ink)",
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        height: "82%", display: "flex", flexDirection: "column",
        boxShadow: "0 -14px 36px rgba(0,0,0,0.45)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 11,
          padding: "14px 16px 12px", borderBottom: "1px solid var(--line)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 42, background: friend.avatarTone,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Instrument Serif, serif", fontSize: 20, position: "relative", flexShrink: 0,
          }}>
            {friend.name[0]}
            {!navigator.onLine ? null : (
              <div style={{
                position: "absolute", bottom: -1, right: -1,
                width: 11, height: 11, borderRadius: 11,
                background: "var(--success)", border: "2px solid var(--paper)",
              }}/>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>{friend.name}</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 3, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
              {friendStage
                ? `${friendStage.name} · ${statusAge}m AGO`
                : "STATUS UNKNOWN"}
              {isRealDM && (
                <span style={{ color: "var(--success)", letterSpacing: 1 }}>● LIVE</span>
              )}
            </div>
          </div>
          <button onClick={onSwitchToMeet} title="Meet here" style={{
            background: "transparent", border: "1px solid var(--line-2)", color: "var(--ink)",
            borderRadius: 999, padding: "7px 10px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>📍 MEET</button>
          <button onClick={sendNativeSMS} title="Open in Messages" style={{
            background: "transparent", border: "1px solid var(--line-2)", color: "var(--ink)",
            borderRadius: 999, padding: "7px 10px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>SMS</button>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--muted)", padding: 4, fontSize: 22, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Offline banner */}
        {!navigator.onLine && (
          <div style={{
            padding: "5px 16px", background: "rgba(232,93,46,0.08)",
            borderBottom: "1px solid rgba(232,93,46,0.18)",
          }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--ember)", fontWeight: 700 }}>
              ⚠ OFFLINE · MESSAGES QUEUE & SEND WHEN YOU'RE BACK ONLINE
            </span>
          </div>
        )}

        {/* Thread */}
        <div ref={scrollerRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
          {thread.length === 0 && (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div className="serif" style={{ fontSize: 18, color: "var(--muted)", fontStyle: "italic" }}>
                No messages yet
              </div>
              <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)", marginTop: 6 }}>
                TAP A QUICK REPLY ↓
              </div>
            </div>
          )}
          {thread.map((m, i) => {
            const mine = m.from === "me";
            const showTime = i === 0 || (m.ts - thread[i-1].ts) > 1000*60*5;
            return (
              <React.Fragment key={i}>
                {showTime && (
                  <div className="mono" style={{
                    textAlign: "center", fontSize: 9, letterSpacing: 1.3,
                    color: "var(--muted)", margin: "8px 0 6px", textTransform: "uppercase",
                  }}>{fmtTime(m.ts)}</div>
                )}
                <div style={{
                  display: "flex", justifyContent: mine ? "flex-end" : "flex-start",
                  marginBottom: 4,
                }}>
                  <div style={{
                    maxWidth: "76%",
                    padding: "8px 12px", borderRadius: 18,
                    background: mine ? "var(--ember)" : "var(--paper-2)",
                    color: mine ? "#fff" : "var(--ink)",
                    fontSize: 14, lineHeight: 1.35,
                    borderBottomRightRadius: mine ? 6 : 18,
                    borderBottomLeftRadius: mine ? 18 : 6,
                  }}>
                    {m.text}
                  </div>
                </div>
                {mine && m.status === "queued" && i === thread.length - 1 && (
                  <div className="mono" style={{ textAlign: "right", fontSize: 8, letterSpacing: 1.2, color: "var(--ember)", marginRight: 4, marginBottom: 4 }}>
                    QUEUED
                  </div>
                )}
              </React.Fragment>
            );
          })}
          {typing && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 4 }}>
              <div style={{
                padding: "10px 14px", borderRadius: 18,
                background: "var(--paper-2)", display: "flex", gap: 4,
                borderBottomLeftRadius: 6,
              }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 6, height: 6, borderRadius: 6, background: "var(--muted)",
                    animation: `tdot 1.2s ${i * 0.15}s infinite`,
                  }}/>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick replies */}
        <div className="no-scrollbar" style={{
          display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none",
          padding: "8px 14px 6px", borderTop: "1px solid var(--line)",
        }}>
          {(() => {
            const myStage = avatarStage ? STAGES.find(s => s.id === avatarStage) : null;
            const friendStage = friend?.stage ? STAGES.find(s => s.id === friend.stage) : null;
            const nextSavedSet = saved && saved.length ? findNextSavedSet(saved) : null;
            const smart = buildSmartReplies({ myStage, friendStage, nextSavedSet });
            const all = [...smart, ...QUICK_REPLIES];
            return all.map((qr, i) => (
              <button key={`${qr.tag}-${i}`} onClick={() => send(qr.text)} className="mono" style={{
                flexShrink: 0, padding: "6px 11px", borderRadius: 999,
                background: qr.smart ? "var(--ember)" : "var(--paper-2)",
                color: qr.smart ? "#fff" : "var(--ink)",
                border: qr.smart ? "none" : "1px solid var(--line-2)",
                fontSize: 10, letterSpacing: 1.1, fontWeight: 600,
                cursor: "pointer", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                {qr.smart && <span style={{ fontSize: 9 }}>✨</span>}
                {qr.tag}
              </button>
            ));
          })()}
        </div>

        {/* Compose */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px 14px",
        }}>
          <input
            type="text"
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(draft); }}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 999,
              background: "var(--paper-2)", border: "1px solid var(--line)",
              fontFamily: "Geist, sans-serif", fontSize: 14,
              color: "var(--ink)", outline: "none",
            }}
          />
          <button onClick={() => send(draft)} disabled={!draft.trim()} aria-label="Send message" style={{
            width: 38, height: 38, borderRadius: 38,
            background: draft.trim() ? "var(--ember)" : "var(--line-2)",
            color: "#fff", border: "none",
            cursor: draft.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background .2s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19 V5"/><path d="M5 12 L12 5 L19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { MapScreen, getMyPingCode, WALK_PAIRS, _pairKey });

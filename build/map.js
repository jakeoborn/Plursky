var _mapDebug = (() => {
  try {
    return localStorage.getItem("plursky-debug") === "1";
  } catch {
    return false;
  }
})();
var _mapLog = (...a) => {
  if (_mapDebug) console.log(...a);
};
var QUICK_REPLIES = [{
  tag: "OMW",
  text: "🚀 omw"
}, {
  tag: "AT STAGE",
  text: "📍 at the stage now"
}, {
  tag: "MEET TOTEM",
  text: "🪧 meet at the totem?"
}, {
  tag: "WATER",
  text: "💧 water break — back in 10"
}, {
  tag: "FOUND U",
  text: "👀 i see you"
}, {
  tag: "NEED YOU",
  text: "🆘 come find me"
}];
function buildSmartReplies({
  myStage,
  friendStage,
  nextSavedSet
}) {
  var out = [];
  if (myStage) {
    out.push({
      tag: `AT ${myStage.short}`,
      text: `📍 at ${myStage.name} now — come find me`,
      smart: true
    });
  }
  if (friendStage) {
    out.push({
      tag: `OMW TO ${friendStage.short}`,
      text: `🚀 omw to ${friendStage.name}`,
      smart: true
    });
  }
  if (nextSavedSet) {
    var a = nextSavedSet.artist;
    var stage = STAGES.find(s => s.id === a.stage);
    var stageName = stage ? stage.name : "the stage";
    if (nextSavedSet.isLive) {
      out.push({
        tag: `${a.name.toUpperCase().slice(0, 8)} LIVE`,
        text: `🎧 ${a.name} is LIVE at ${stageName} — get over here`,
        smart: true
      });
    } else if (nextSavedSet.minsUntil > 0 && nextSavedSet.minsUntil <= 90) {
      out.push({
        tag: `${a.name.toUpperCase().slice(0, 8)} ${nextSavedSet.minsUntil}M`,
        text: `${a.name} in ${nextSavedSet.minsUntil}m at ${stageName} — meet there?`,
        smart: true
      });
    }
  }
  return out;
}
var _SEED_MSGS = {
  f1: [{
    from: "them",
    text: "yooo where you at??",
    ts: Date.now() - 1000 * 60 * 22
  }, {
    from: "me",
    text: "kineticFIELD, by the totems",
    ts: Date.now() - 1000 * 60 * 19
  }, {
    from: "them",
    text: "🚀 omw",
    ts: Date.now() - 1000 * 60 * 4
  }],
  f2: [{
    from: "them",
    text: "trance hit different tonight 😭",
    ts: Date.now() - 1000 * 60 * 38
  }],
  f3: [],
  f4: [{
    from: "them",
    text: "circuitGROUNDS in 5",
    ts: Date.now() - 1000 * 60 * 8
  }]
};
function loadThread(friendId) {
  try {
    var raw = localStorage.getItem(`msg_${friendId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return _SEED_MSGS[friendId] || [];
}
function saveThread(friendId, msgs) {
  try {
    localStorage.setItem(`msg_${friendId}`, JSON.stringify(msgs));
  } catch {}
}
function clearAllThreads() {
  Object.keys(localStorage).filter(k => k.startsWith("msg_")).forEach(k => localStorage.removeItem(k));
}
function unreadCount(friendId) {
  var t = loadThread(friendId);
  var lastRead = parseInt(localStorage.getItem(`msg_read_${friendId}`) || "0", 10);
  return t.filter(m => m.from === "them" && m.ts > lastRead).length;
}
function markRead(friendId) {
  try {
    localStorage.setItem(`msg_read_${friendId}`, String(Date.now()));
  } catch {}
}
function _fakeReply(userText) {
  var t = userText.toLowerCase();
  if (/omw|on my way/.test(t)) return ["see you in a sec 🌟", 5000];
  if (/water|hydrat/.test(t)) return ["💧 same. by the cosmic water tent", 6500];
  if (/totem|meet/.test(t)) return ["📍 already there", 4500];
  if (/kinetic|field/.test(t)) return ["pulling up to kineticFIELD now", 7000];
  if (/circuit|techno/.test(t)) return ["circuit's going off rn 🔥", 5500];
  if (/where|location/.test(t)) return ["bionic — pin coming", 6000];
  if (/help|need|sos|🆘/.test(t)) return ["coming. stay where u are 🚨", 3500];
  if (/love|👀|❤️/.test(t)) return ["🥺 ur the best", 5000];
  return ["🫶", 4500 + Math.random() * 2500];
}
var _SEED_STATUSES = {
  f1: {
    stage: "bionic",
    ts: Date.now() - 1000 * 60 * 8
  },
  f2: {
    stage: "quantum",
    ts: Date.now() - 1000 * 60 * 22
  },
  f3: {
    stage: "stereo",
    ts: Date.now() - 1000 * 60 * 4
  },
  f4: {
    stage: "circuit",
    ts: Date.now() - 1000 * 60 * 15
  }
};
function friendStatus(friendId) {
  try {
    var raw = localStorage.getItem(`status_${friendId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return _SEED_STATUSES[friendId] || null;
}
function getMyStatus() {
  try {
    return JSON.parse(localStorage.getItem("status_me") || "null");
  } catch {
    return null;
  }
}
function persistMyStatus(stageId) {
  try {
    localStorage.setItem("status_me", JSON.stringify({
      stage: stageId,
      ts: Date.now()
    }));
  } catch {}
}
function broadcastMyLocation(stageId) {
  var stage = STAGES.find(s => s.id === stageId);
  if (!stage) return;
  var msg = `I'm at ${stage.name} 👋 come through`;
  FRIENDS.forEach(f => {
    saveThread(f.id, [...loadThread(f.id), {
      from: "me",
      text: msg,
      ts: Date.now(),
      status: "sent"
    }]);
  });
}
var HYD_DRIFT_PER_MIN = 60 / 90;
var HYD_DRIFT_CAP_MIN = 6 * 60;
function readWellness() {
  try {
    var raw = localStorage.getItem("wellness");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    lastDrink: Date.now(),
    lastRest: Date.now()
  };
}
function writeWellness(w) {
  try {
    localStorage.setItem("wellness", JSON.stringify(w));
  } catch {}
}
function computeHydration(lastDrink) {
  var minsSince = Math.min(HYD_DRIFT_CAP_MIN, (Date.now() - lastDrink) / 60000);
  return Math.max(0, Math.round(100 - minsSince * HYD_DRIFT_PER_MIN));
}
function WellnessPill() {
  var [w, setW] = React.useState(readWellness);
  var [open, setOpen] = React.useState(false);
  var [tick, setTick] = React.useState(0);
  var {
    active: bsActive
  } = useBatterySaver();
  React.useEffect(() => {
    var id = setInterval(() => setTick(t => t + 1), bsActive ? 120000 : 30000);
    return () => clearInterval(id);
  }, [bsActive]);
  var hyd = computeHydration(w.lastDrink);
  var restMin = Math.floor((Date.now() - w.lastRest) / 60000);
  var hydColor = hyd > 70 ? "#34d399" : hyd > 40 ? "#f59a36" : "#f87171";
  var restColor = restMin < 75 ? "rgba(247,237,224,0.85)" : restMin < 120 ? "#f59a36" : "#f87171";
  var drank = () => {
    var nw = {
      ...w,
      lastDrink: Date.now()
    };
    setW(nw);
    writeWellness(nw);
    setTick(t => t + 1);
  };
  var rested = () => {
    var nw = {
      ...w,
      lastRest: Date.now()
    };
    setW(nw);
    writeWellness(nw);
    setTick(t => t + 1);
  };
  var restLabel = restMin < 60 ? `${restMin}m` : `${Math.floor(restMin / 60)}h${(restMin % 60).toString().padStart(2, "0")}`;
  var restColorLight = restMin < 75 ? "var(--ink)" : restMin < 120 ? "#b8651b" : "#c14a4a";
  return React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    style: {
      position: "absolute",
      top: 14,
      left: 10,
      zIndex: 4,
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "5px 10px 5px 7px",
      borderRadius: 999,
      background: "rgba(247,237,224,0.88)",
      border: `1px solid ${hyd < 40 || restMin > 120 ? "#c14a4a" : "var(--line-2)"}`,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      color: "var(--ink)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 0.8,
      fontWeight: 600,
      cursor: "pointer",
      boxShadow: hyd < 40 ? "0 0 0 4px rgba(193,74,74,0.16)" : "0 2px 8px rgba(26,18,13,0.06)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12
    }
  }, "💧"), React.createElement("span", {
    style: {
      color: hyd > 70 ? "var(--ink)" : hyd > 40 ? "#b8651b" : "#c14a4a",
      fontWeight: 700
    }
  }, hyd, "%"), React.createElement("span", {
    style: {
      width: 1,
      height: 10,
      background: "var(--line-2)"
    }
  }), React.createElement("span", {
    style: {
      color: restColorLight,
      fontWeight: 700
    }
  }, restLabel)), open && React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 6
    }
  }, React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.4)"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      left: 14,
      right: 14,
      top: 100,
      background: "var(--paper)",
      color: "var(--ink)",
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 14px 40px rgba(0,0,0,0.4)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      color: "var(--muted)",
      marginBottom: 6
    }
  }, "WELLNESS · DESERT DEFAULTS"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05,
      marginBottom: 12
    }
  }, "Take care of you."), React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 6
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: hydColor,
      fontWeight: 700
    }
  }, "HYDRATION"), React.createElement("span", {
    className: "serif",
    style: {
      fontSize: 24,
      color: hydColor
    }
  }, hyd, "%")), React.createElement("div", {
    style: {
      height: 6,
      background: "var(--line)",
      borderRadius: 6,
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      width: `${hyd}%`,
      height: "100%",
      background: hydColor,
      borderRadius: 6,
      transition: "width .35s"
    }
  })), React.createElement("div", {
    style: {
      fontSize: 10,
      color: "var(--muted)",
      marginTop: 5,
      lineHeight: 1.4
    }
  }, hyd > 70 ? "Cruising — top up next set." : hyd > 40 ? "Hit a water station soon." : "Drink water now. ~−1% per 90 sec in the heat."), React.createElement("button", {
    onClick: drank,
    style: {
      marginTop: 8,
      width: "100%",
      background: "#38bdf8",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "10px 12px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "💧 LOGGED · DRANK WATER")), React.createElement("div", null, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 6
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: restColor,
      fontWeight: 700
    }
  }, "ON FEET"), React.createElement("span", {
    className: "serif",
    style: {
      fontSize: 24,
      color: restColor
    }
  }, restLabel)), React.createElement("div", {
    style: {
      fontSize: 10,
      color: "var(--muted)",
      marginTop: 0,
      lineHeight: 1.4
    }
  }, restMin < 75 ? "Pace is good." : restMin < 120 ? "Sit down at the next break." : "Take 10 min off your feet — you'll dance harder later."), React.createElement("button", {
    onClick: rested,
    style: {
      marginTop: 8,
      width: "100%",
      background: "var(--paper-2)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      padding: "10px 12px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "🦵 LOGGED · TOOK A BREAK")), React.createElement("button", {
    onClick: () => setOpen(false),
    style: {
      marginTop: 12,
      width: "100%",
      background: "transparent",
      border: "none",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.4,
      color: "var(--muted)",
      cursor: "pointer",
      textTransform: "uppercase"
    }
  }, "Close"))));
}
var FESTIVAL_LAT = FESTIVAL_CONFIG.gps.lat;
var FESTIVAL_LNG = FESTIVAL_CONFIG.gps.lng;
var ON_SITE_RADIUS_MI = FESTIVAL_CONFIG.gps.onSiteRadiusMi;
function _solveMapAffine() {
  if (!FESTIVAL_CONFIG.gpsAnchors || FESTIVAL_CONFIG.gpsAnchors.length < 3) return null;
  var find = id => STAGES.find(s => s.id === id);
  var [a0, a1, a2] = FESTIVAL_CONFIG.gpsAnchors;
  if (!find(a0.stageId) || !find(a1.stageId) || !find(a2.stageId)) return null;
  var A = {
    lat: a0.lat,
    lng: a0.lng,
    mx: find(a0.stageId).x,
    my: find(a0.stageId).y
  };
  var B = {
    lat: a1.lat,
    lng: a1.lng,
    mx: find(a1.stageId).x,
    my: find(a1.stageId).y
  };
  var C = {
    lat: a2.lat,
    lng: a2.lng,
    mx: find(a2.stageId).x,
    my: find(a2.stageId).y
  };
  var det = A.lat * (B.lng - C.lng) - A.lng * (B.lat - C.lat) + (B.lat * C.lng - C.lat * B.lng);
  if (Math.abs(det) < 1e-12) return null;
  var solve = (v1, v2, v3) => {
    var a = (v1 * (B.lng - C.lng) - A.lng * (v2 - v3) + (C.lng * v2 - B.lng * v3)) / det;
    var b = (A.lat * (v2 - v3) - v1 * (B.lat - C.lat) + (B.lat * v3 - C.lat * v2)) / det;
    var c = (A.lat * (B.lng * v3 - C.lng * v2) - A.lng * (B.lat * v3 - C.lat * v2) + v1 * (B.lat * C.lng - C.lat * B.lng)) / det;
    return [a, b, c];
  };
  return {
    x: solve(A.mx, B.mx, C.mx),
    y: solve(A.my, B.my, C.my)
  };
}
var MAP_AFFINE = _solveMapAffine();
var MAP_REGISTRATION_TOL_M = 25;
var PLACED_STAGES = (typeof STAGES !== "undefined" ? STAGES : []).filter(s => typeof s.x === "number" && typeof s.y === "number");
var MAP_REGISTRATION_SOURCED = (() => {
  var anchors = FESTIVAL_CONFIG.gpsAnchors || [];
  var basis = anchors.slice(0, 3);
  var isEvidence = a => a.src === "osm" || a.src === "crowd";
  if (basis.length !== 3 || !basis.some(isEvidence)) return false;
  if (!MAP_AFFINE) return false;
  return anchors.slice(3).some(a => {
    if (!isEvidence(a)) return false;
    var s = STAGES.find(x => x.id === a.stageId);
    if (!s) return false;
    var g = mapToGps(s.x, s.y);
    if (!g) return false;
    return distMiles(a.lat, a.lng, g.lat, g.lng) * 1609.34 <= MAP_REGISTRATION_TOL_M;
  });
})();
function readoutHonest(avatar) {
  return !avatar || !avatar.live || MAP_REGISTRATION_SOURCED;
}
function gpsToMap(lat, lng) {
  if (!MAP_AFFINE) return {
    x: 50,
    y: 50
  };
  return {
    x: MAP_AFFINE.x[0] * lat + MAP_AFFINE.x[1] * lng + MAP_AFFINE.x[2],
    y: MAP_AFFINE.y[0] * lat + MAP_AFFINE.y[1] * lng + MAP_AFFINE.y[2]
  };
}
function distMiles(lat1, lng1, lat2, lng2) {
  var R = 3959;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var MEETUPS_KEY = "plursky_meetups_v1";
function readMeetups() {
  try {
    return JSON.parse(localStorage.getItem(MEETUPS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeMeetups(arr) {
  try {
    localStorage.setItem(MEETUPS_KEY, JSON.stringify(arr));
  } catch {}
}
function addMeetup({
  name,
  stageId,
  atTs,
  notes
}) {
  var list = readMeetups();
  list.push({
    id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
    name: (name || "").slice(0, 60),
    stageId: stageId || null,
    atTs: Number(atTs) || Date.now(),
    notes: (notes || "").slice(0, 200),
    createdAt: Date.now()
  });
  list.sort((a, b) => a.atTs - b.atTs);
  writeMeetups(list);
  return list;
}
function removeMeetup(id) {
  var list = readMeetups().filter(m => m.id !== id);
  writeMeetups(list);
  return list;
}
function upcomingMeetups() {
  var cutoff = Date.now() - 30 * 60 * 1000;
  var list = readMeetups().filter(m => m.atTs > cutoff);
  if (list.length !== readMeetups().length) writeMeetups(list);
  return list;
}
function formatLastSeen(ts) {
  if (!ts) return {
    label: "",
    freshness: "cold",
    color: "rgba(255,255,255,0.45)"
  };
  var mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return {
    label: "NOW",
    freshness: "fresh",
    color: "#2d7a55"
  };
  if (mins < 5) return {
    label: `${mins}m`,
    freshness: "fresh",
    color: "#2d7a55"
  };
  if (mins < 15) return {
    label: `${mins}m`,
    freshness: "stale",
    color: "#f59a36"
  };
  if (mins < 60) return {
    label: `${mins}m`,
    freshness: "cold",
    color: "rgba(255,255,255,0.55)"
  };
  var hrs = Math.floor(mins / 60);
  return {
    label: `${hrs}h+`,
    freshness: "cold",
    color: "rgba(255,255,255,0.45)"
  };
}
function useGeolocation(enabled) {
  var [pos, setPos] = React.useState(null);
  var [status, setStatus] = React.useState("idle");
  var {
    active: bsActive
  } = useBatterySaver();
  React.useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    var alive = true;
    var opts = bsActive ? {
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 30000
    } : {
      enableHighAccuracy: true,
      maximumAge: 4000,
      timeout: 15000
    };
    var id = navigator.geolocation.watchPosition(p => {
      if (!alive) return;
      var lat = p.coords.latitude,
        lng = p.coords.longitude;
      setPos({
        lat,
        lng,
        accuracy: p.coords.accuracy,
        ts: Date.now()
      });
      setStatus("live");
      try {
        var hit = window.recordAttendanceFromGps?.(lat, lng);
        if (hit && typeof window.plurskyToast === "function") {
          var a = (window.ARTISTS || []).find(x => x.id === hit.artistId);
          if (a) window.plurskyToast(`✓ Caught ${a.name}`);
        }
      } catch {}
    }, e => {
      if (!alive) return;
      setStatus(e.code === 1 ? "denied" : "unavailable");
    }, opts);
    return () => {
      alive = false;
      navigator.geolocation.clearWatch(id);
    };
  }, [enabled, bsActive]);
  return {
    pos,
    status
  };
}
var WALK_PAIRS = {
  "basspod,bionic": [10, 16],
  "basspod,circuit": [6, 10],
  "basspod,cosmic": [9, 13],
  "basspod,kinetic": [6, 10],
  "basspod,neon": [10, 14],
  "basspod,quantum": [10, 14],
  "basspod,stereo": [8, 12],
  "basspod,waste": [6, 10],
  "bionic,circuit": [14, 22],
  "bionic,cosmic": [6, 10],
  "bionic,kinetic": [7, 11],
  "bionic,neon": [12, 17],
  "bionic,quantum": [10, 14],
  "bionic,stereo": [4, 7],
  "bionic,waste": [7, 11],
  "circuit,cosmic": [12, 18],
  "circuit,kinetic": [15, 25],
  "circuit,neon": [5, 9],
  "circuit,quantum": [9, 13],
  "circuit,stereo": [11, 16],
  "circuit,waste": [10, 14],
  "cosmic,kinetic": [10, 15],
  "cosmic,neon": [13, 18],
  "cosmic,quantum": [13, 18],
  "cosmic,stereo": [6, 10],
  "cosmic,waste": [7, 11],
  "kinetic,neon": [10, 14],
  "kinetic,quantum": [5, 9],
  "kinetic,stereo": [8, 12],
  "kinetic,waste": [6, 10],
  "neon,quantum": [7, 11],
  "neon,stereo": [10, 14],
  "neon,waste": [12, 17],
  "quantum,stereo": [7, 11],
  "quantum,waste": [13, 18],
  "stereo,waste": [7, 11]
};
function _pairKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}
function _nearestStageId(x, y, radius = 9) {
  var best = null,
    bestD = radius;
  for (var s of PLACED_STAGES) {
    var d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) {
      bestD = d;
      best = s.id;
    }
  }
  return best;
}
function _distToBand(d) {
  if (d < 12) return [2, 4];
  if (d < 22) return [4, 7];
  if (d < 35) return [6, 10];
  if (d < 50) return [10, 14];
  if (d < 65) return [13, 20];
  return [18, 28];
}
function computeWalkRange(avatar, targetStage, dist, nowTime) {
  var avatarX = avatar.x,
    avatarY = avatar.y;
  var lo, hi;
  var fromStage = _nearestStageId(avatarX, avatarY);
  if (fromStage && targetStage && fromStage !== targetStage.id) {
    var k = _pairKey(fromStage, targetStage.id);
    if (WALK_PAIRS[k]) [lo, hi] = WALK_PAIRS[k];
  }
  if (lo == null) [lo, hi] = _distToBand(dist);
  var hour = nowTime ? parseInt(String(nowTime).split(":")[0], 10) : -1;
  var isPeak = hour >= 1 && hour < 3;
  if (isPeak) {
    lo = Math.round(lo * 1.5);
    hi = Math.round(hi * 1.6);
  }
  return {
    lo,
    hi,
    peak: isPeak,
    plan: isPeak && hi >= 15,
    known: readoutHonest(avatar)
  };
}
function walkMinsLabel(walk) {
  if (!walk || walk.known === false) return null;
  return walk.lo === walk.hi ? `${walk.lo}` : `${walk.lo}\u2013${walk.hi}`;
}
function distToMins(d, avatar) {
  if (!readoutHonest(avatar)) return null;
  var [lo, hi] = _distToBand(d);
  return Math.max(1, Math.round((lo + hi) / 2));
}
function minsAwaySuffix(d, avatar) {
  var m = distToMins(d, avatar);
  return m == null ? "" : ` \u00b7 ${m} min away`;
}
function gridDistMeters(ax, ay, bx, by, avatar) {
  if (!MAP_AFFINE || !readoutHonest(avatar)) return null;
  var a = mapToGps(ax, ay),
    b = mapToGps(bx, by);
  var m = distMiles(a.lat, a.lng, b.lat, b.lng) * 1609.34;
  return isFinite(m) ? Math.round(m) : null;
}
function findNextSavedSet(savedIds) {
  var nowMin = toNightMin(NOW.time);
  var todays = savedIds.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && a.day === NOW.day).map(a => ({
    a,
    sM: toNightMin(a.start),
    eM: toNightMin(a.end)
  })).filter(x => x.eM > nowMin).sort((x, y) => x.sM - y.sM);
  if (!todays.length) return null;
  var live = todays.find(x => x.sM <= nowMin && x.eM > nowMin);
  var pick = live || todays[0];
  return {
    artist: pick.a,
    isLive: !!live,
    minsUntil: Math.max(0, pick.sM - nowMin),
    minsLeft: Math.max(0, pick.eM - nowMin)
  };
}
var PING_WORDS = ["LIME", "KIWI", "PLUM", "SAGE", "ROSE", "DUSK", "DAWN", "NEON", "LOFT", "FROG", "STAR", "MOTH", "MINT", "JADE", "RUBY", "PINE", "FERN", "SOLO", "HOWL", "WAVE", "MOON", "ECHO", "HAZE", "SAGA"];
function getMyPingCode() {
  try {
    var c = localStorage.getItem("ping_code");
    if (c && /^[A-Z]{4}$/.test(c)) return c;
    c = PING_WORDS[Math.floor(Math.random() * PING_WORDS.length)];
    localStorage.setItem("ping_code", c);
    return c;
  } catch {
    return "PLUR";
  }
}
var DEMO_FRIEND_CODES = {
  LIME: "f1",
  FROG: "f2",
  NEON: "f3",
  PLUM: "f4"
};
function PingSheet({
  onClose,
  onDropPin,
  friends
}) {
  var myCode = getMyPingCode();
  var [input, setInput] = React.useState("");
  var [feedback, setFeedback] = React.useState(null);
  var [copied, setCopied] = React.useState(false);
  var submit = () => {
    var c = input.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) {
      setFeedback({
        kind: "err",
        text: "Enter a 4-letter code."
      });
      return;
    }
    if (typeof sbFindByPingCode === "function") {
      var live = sbFindByPingCode(c);
      if (live) {
        var st = STAGES.find(s => s.id === live.stageId);
        if (st) {
          onDropPin({
            x: st.x,
            y: st.y,
            label: `${live.name} (${c})`
          });
          setFeedback({
            kind: "ok",
            text: `Live pin dropped on ${live.name} at ${st.name}.`
          });
          setTimeout(onClose, 900);
          return;
        }
      }
    }
    var friendId = DEMO_FRIEND_CODES[c];
    if (friendId) {
      var f = friends.find(fr => fr.id === friendId);
      if (f) {
        onDropPin({
          x: f.x,
          y: f.y,
          label: `${f.name} (${c})`
        });
        setFeedback({
          kind: "ok",
          text: `Pin dropped on ${f.name}.`
        });
        setTimeout(onClose, 700);
        return;
      }
    }
    setFeedback({
      kind: "warn",
      text: `"${c}" isn't in CREW right now. Ask them to join CREW so their code goes live.`
    });
  };
  var copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`Find me on Plursky — code ${myCode}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  };
  var shareCode = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Plursky",
          text: `Find me on Plursky — code ${myCode}`
        });
      } else {
        copyCode();
      }
    } catch {}
  };
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(13,10,8,0.55)",
      zIndex: 60,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 460,
      background: "var(--paper)",
      color: "var(--ink)",
      borderRadius: "16px 16px 0 0",
      padding: "16px 18px 22px",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.35)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: 800
    }
  }, "PING CODES"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      fontSize: 18,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "×")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 14,
      color: "var(--muted)",
      marginBottom: 10
    }
  }, "Share your code so a friend can drop a pin on you."), React.createElement("div", {
    style: {
      background: "var(--ink)",
      color: "var(--paper)",
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.5,
      opacity: 0.6,
      marginBottom: 2
    }
  }, "YOUR CODE"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 34,
      letterSpacing: 4,
      fontWeight: 400
    }
  }, myCode)), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, React.createElement("button", {
    onClick: shareCode,
    style: {
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "7px 14px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "SHARE"), React.createElement("button", {
    onClick: copyCode,
    style: {
      background: "transparent",
      color: "var(--paper)",
      border: "1px solid rgba(247,237,224,0.35)",
      borderRadius: 8,
      padding: "7px 14px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, copied ? "COPIED" : "COPY"))), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      color: "var(--muted)",
      marginBottom: 6
    }
  }, "DROP A PIN FROM A FRIEND'S CODE"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("input", {
    type: "text",
    placeholder: "LIME",
    maxLength: 4,
    value: input,
    onChange: e => setInput(e.target.value.toUpperCase()),
    onKeyDown: e => e.key === "Enter" && submit(),
    style: {
      flex: 1,
      background: "var(--paper-2)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      padding: "10px 14px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 18,
      letterSpacing: 4,
      fontWeight: 700,
      textTransform: "uppercase",
      outline: "none"
    }
  }), React.createElement("button", {
    onClick: submit,
    style: {
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 10,
      padding: "10px 18px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "DROP PIN")), feedback && React.createElement("div", {
    className: "mono",
    style: {
      marginTop: 10,
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 700,
      color: feedback.kind === "ok" ? "var(--success)" : feedback.kind === "err" ? "var(--ember)" : "var(--horizon)"
    }
  }, feedback.text), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 14,
      lineHeight: 1.5
    }
  }, "TIP: use the ", React.createElement("span", {
    style: {
      color: "var(--success)",
      fontWeight: 700
    }
  }, "CREW"), " button above for live real-time tracking with friends.")));
}
function IAmAtSheet({
  onClose,
  initialStage,
  onStatusSet
}) {
  var [selected, setSelected] = React.useState(initialStage || null);
  var [sent, setSent] = React.useState(false);
  var stage = STAGES.find(s => s.id === selected);
  var shareLink = async () => {
    if (!stage) return;
    persistMyStatus(selected);
    onStatusSet(selected);
    var text = `I'm at ${stage.name} at ${FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name} 🎧 come find me — plursky.com`;
    if (navigator.share) {
      try {
        await navigator.share({
          text,
          title: "Where I'm at"
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
      } catch {}
    }
    onClose();
  };
  var tellCrew = () => {
    if (!stage) return;
    persistMyStatus(selected);
    onStatusSet(selected);
    broadcastMyLocation(selected);
    setSent(true);
    setTimeout(onClose, 900);
  };
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(13,10,8,0.55)",
      zIndex: 60,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 460,
      background: "var(--paper)",
      color: "var(--ink)",
      borderRadius: "16px 16px 0 0",
      padding: "16px 18px 28px",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.35)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: 800
    }
  }, "WHERE ARE YOU?"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      fontSize: 18,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "×")), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 6,
      marginBottom: 14
    }
  }, STAGES.map(s => {
    var on = selected === s.id;
    return React.createElement("button", {
      key: s.id,
      onClick: () => setSelected(s.id),
      style: {
        padding: "8px 6px",
        borderRadius: 10,
        background: on ? s.color : "var(--paper-2)",
        color: on ? "#fff" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 8,
        background: on ? "rgba(255,255,255,0.7)" : s.color
      }
    }), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 0.8,
        fontWeight: on ? 700 : 500,
        textAlign: "center",
        lineHeight: 1.2
      }
    }, s.short));
  })), stage && React.createElement("div", {
    style: {
      marginBottom: 12,
      padding: "8px 12px",
      borderRadius: 10,
      background: `${stage.color}18`,
      borderLeft: `3px solid ${stage.color}`
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: stage.color,
      fontWeight: 700
    }
  }, stage.vibe?.toUpperCase()), React.createElement("span", {
    className: "serif",
    style: {
      fontSize: 14,
      marginLeft: 8
    }
  }, stage.name)), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    onClick: tellCrew,
    disabled: !stage,
    style: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 999,
      background: sent ? "var(--success)" : stage ? "var(--ink)" : "var(--paper-2)",
      color: stage ? "var(--paper)" : "var(--muted)",
      border: "none",
      cursor: stage ? "pointer" : "default",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700,
      transition: "background .2s"
    }
  }, sent ? "✓ CREW NOTIFIED" : "TELL MY CREW"), React.createElement("button", {
    onClick: shareLink,
    disabled: !stage,
    style: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 999,
      background: stage ? "var(--ember)" : "var(--paper-2)",
      color: stage ? "#fff" : "var(--muted)",
      border: "none",
      cursor: stage ? "pointer" : "default",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, "SHARE LINK ↗"))));
}
function _nextSunriseEpochMs() {
  var now = Date.now();
  var dayKeys = Object.keys(FESTIVAL_CONFIG.dayDates || {}).sort();
  for (var k of dayKeys) {
    var d = FESTIVAL_CONFIG.dayDates[k];
    var rise = FESTIVAL_CONFIG.sunTimes?.[k]?.rise || "05:30";
    var [h, m] = rise.split(":").map(Number);
    var epoch = (d.midnightUtc || 0) + h * 3600000 + m * 60000;
    if (epoch > now + 60000) return epoch;
  }
  return FESTIVAL_CONFIG.endMs || now + 4 * 3600000;
}
var _SHARE_EXPIRY_OPTIONS = [{
  key: "1h",
  label: "1H",
  compute: () => Date.now() + 60 * 60 * 1000
}, {
  key: "4h",
  label: "4H",
  compute: () => Date.now() + 4 * 60 * 60 * 1000
}, {
  key: "sunrise",
  label: "SUNRISE",
  compute: _nextSunriseEpochMs
}, {
  key: "festival",
  label: "FESTIVAL",
  compute: () => FESTIVAL_CONFIG.endMs || Date.now() + 24 * 3600000
}];
function _expiryKeyFromState(shareState) {
  if (!shareState?.expiresAt) return "4h";
  var remain = shareState.expiresAt - Date.now();
  if (remain < 90 * 60 * 1000) return "1h";
  if (remain < 5 * 60 * 60 * 1000) return "4h";
  if (shareState.expiresAt < (FESTIVAL_CONFIG.endMs || Infinity) - 60000) return "sunrise";
  return "festival";
}
function ShareLinkRow({
  token
}) {
  var [copied, setCopied] = React.useState(false);
  var url = React.useMemo(() => {
    if (typeof window === "undefined") return `share.html?t=${token}`;
    var base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}`;
    return `${base}share.html?t=${token}`;
  }, [token]);
  var onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Find me at ${FESTIVAL_CONFIG.brand || "the festival"}`,
          text: "Live location on Plursky",
          url
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  };
  return React.createElement("div", {
    style: {
      padding: "10px 12px",
      borderRadius: 10,
      background: "var(--paper-2)",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "🔗"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500
    }
  }, "Shareable link"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.6,
      color: "var(--muted)",
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, url)), React.createElement("button", {
    onClick: onShare,
    style: {
      background: copied ? "var(--success)" : "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 999,
      padding: "7px 12px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, copied ? "COPIED" : "COPY"));
}
function ShareLocationSheet({
  onClose,
  shareState,
  crewCount,
  crewCode,
  gpsPos,
  gpsStatus,
  myStatusStage,
  onSave,
  onStop
}) {
  var [includeGps, setIncludeGps] = React.useState(shareState?.includeGps ?? true);
  var [includeStage, setIncludeStage] = React.useState(shareState?.includeStage ?? true);
  var [expiryKey, setExpiryKey] = React.useState(() => _expiryKeyFromState(shareState));
  var active = !!shareState?.active && (!shareState?.expiresAt || shareState.expiresAt > Date.now());
  var isDenied = gpsStatus === "denied";
  var isUnavailable = gpsStatus === "unavailable";
  var canShareGps = !isDenied && !isUnavailable;
  var stage = myStatusStage ? STAGES.find(s => s.id === myStatusStage) : null;
  var handleStart = () => {
    if (!includeGps && !includeStage) return;
    var opt = _SHARE_EXPIRY_OPTIONS.find(o => o.key === expiryKey) || _SHARE_EXPIRY_OPTIONS[1];
    onSave({
      active: true,
      includeGps: includeGps && canShareGps,
      includeStage,
      expiresAt: opt.compute()
    });
    onClose();
  };
  var handleStop = () => {
    onStop();
    onClose();
  };
  var _fmtRemaining = () => {
    if (!shareState?.expiresAt) return "";
    var mins = Math.max(0, Math.round((shareState.expiresAt - Date.now()) / 60000));
    if (mins < 60) return `${mins}m left`;
    return `${Math.round(mins / 60)}h left`;
  };
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(13,10,8,0.55)",
      zIndex: 60,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 460,
      background: "var(--paper)",
      color: "var(--ink)",
      borderRadius: "16px 16px 0 0",
      padding: "16px 18px 28px",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
      maxHeight: "90vh",
      overflowY: "auto"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: 800
    }
  }, "SHARE WITH CREW"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      fontSize: 18,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "×")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 12
    }
  }, crewCode ? React.createElement(React.Fragment, null, "● ", crewCount || 0, " IN CREW · ", crewCode) : React.createElement(React.Fragment, null, "NO CREW YET — JOIN ONE FIRST")), React.createElement("div", {
    style: {
      background: active ? "var(--ember)" : "var(--paper-2)",
      color: active ? "#fff" : "var(--ink)",
      border: active ? "none" : "1px solid var(--line-2)",
      borderRadius: 14,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 14
    }
  }, React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 12,
      background: active ? "rgba(255,255,255,0.92)" : "var(--line-2)",
      animation: active ? "pulse 1.6s infinite" : "none"
    }
  }), React.createElement("span", {
    className: "serif",
    style: {
      fontSize: 18,
      flex: 1
    }
  }, active ? "Sharing now" : "Not sharing"), active && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      opacity: 0.85
    }
  }, _fmtRemaining())), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 8
    }
  }, "WHAT'S SHARED"), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 14
    }
  }, React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 10,
      background: "var(--paper-2)",
      cursor: canShareGps ? "pointer" : "not-allowed",
      opacity: canShareGps ? 1 : 0.55
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: includeGps && canShareGps,
    disabled: !canShareGps,
    onChange: e => setIncludeGps(e.target.checked),
    style: {
      accentColor: "var(--ember)",
      width: 16,
      height: 16
    }
  }), React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "📍"), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500
    }
  }, "My GPS location"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 2
    }
  }, gpsStatus === "live" && gpsPos ? `LIVE · ±${Math.round(gpsPos.accuracy || 0)}m` : gpsStatus === "locating" ? "FINDING…" : gpsStatus === "denied" ? "DENIED IN BROWSER" : gpsStatus === "unavailable" ? "UNSUPPORTED" : "OFF"))), React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 10,
      background: "var(--paper-2)",
      cursor: "pointer"
    }
  }, React.createElement("input", {
    type: "checkbox",
    checked: includeStage,
    onChange: e => setIncludeStage(e.target.checked),
    style: {
      accentColor: "var(--ember)",
      width: 16,
      height: 16
    }
  }), React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "🎪"), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500
    }
  }, "Current stage"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 2
    }
  }, stage ? stage.name.toUpperCase() : "NOT SET — TAP “I'M AT” FIRST")))), includeGps && isDenied && React.createElement("div", {
    style: {
      padding: "8px 11px",
      borderRadius: 999,
      background: "rgba(193,74,74,0.10)",
      border: "1px solid rgba(193,74,74,0.35)",
      marginBottom: 12
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "#c14a4a",
      fontWeight: 700
    }
  }, "GPS DENIED · ENABLE LOCATION IN BROWSER")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 8
    }
  }, "AUTO-EXPIRE AFTER"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12
    }
  }, _SHARE_EXPIRY_OPTIONS.map(opt => {
    var on = expiryKey === opt.key;
    return React.createElement("button", {
      key: opt.key,
      onClick: () => setExpiryKey(opt.key),
      style: {
        flex: 1,
        padding: "8px 4px",
        borderRadius: 999,
        background: on ? "var(--ink)" : "var(--paper-2)",
        color: on ? "var(--paper)" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9,
        letterSpacing: 1.1,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, opt.label);
  })), active && shareState?.token && React.createElement(ShareLinkRow, {
    token: shareState.token
  }), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginBottom: 14,
      textAlign: "center"
    }
  }, "⚡ USES ~1% MORE BATTERY PER HOUR"), active ? React.createElement("button", {
    onClick: handleStop,
    style: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: 999,
      background: "var(--paper-2)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "STOP SHARING") : React.createElement("button", {
    onClick: handleStart,
    disabled: (!includeGps || !canShareGps) && !includeStage,
    style: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: 999,
      background: (!includeGps || !canShareGps) && !includeStage ? "var(--paper-2)" : "var(--ember)",
      color: (!includeGps || !canShareGps) && !includeStage ? "var(--muted)" : "#fff",
      border: "none",
      cursor: (!includeGps || !canShareGps) && !includeStage ? "default" : "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "START SHARING")));
}
function MeetupsSheet({
  onClose
}) {
  var [list, setList] = React.useState(() => upcomingMeetups());
  var [creating, setCreating] = React.useState(false);
  var [name, setName] = React.useState("");
  var [stageId, setStageId] = React.useState(STAGES[0]?.id || "");
  var [whenLocal, setWhenLocal] = React.useState(() => {
    var d = new Date(Date.now() + 60 * 60 * 1000);
    var pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  var [notes, setNotes] = React.useState("");
  var reset = () => {
    setCreating(false);
    setName("");
    setStageId(STAGES[0]?.id || "");
    setNotes("");
  };
  var handleSave = () => {
    var atTs = new Date(whenLocal).getTime();
    if (!atTs || Number.isNaN(atTs)) return;
    var finalName = name.trim() || STAGES.find(s => s.id === stageId)?.name || "Meetup";
    var next = addMeetup({
      name: finalName,
      stageId,
      atTs,
      notes: notes.trim()
    });
    setList(next.filter(m => m.atTs > Date.now() - 30 * 60 * 1000));
    reset();
  };
  var handleRemove = id => {
    var next = removeMeetup(id);
    setList(next.filter(m => m.atTs > Date.now() - 30 * 60 * 1000));
  };
  var fmtWhen = ts => {
    try {
      var d = new Date(ts);
      var today = new Date();
      var sameDay = d.toDateString() === today.toDateString();
      var time = d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      });
      var mins = Math.round((ts - Date.now()) / 60000);
      var rel = mins < 60 ? `IN ${Math.max(1, mins)}M` : mins < 24 * 60 ? `IN ${Math.round(mins / 60)}H` : `${d.toLocaleDateString([], {
        weekday: "short"
      }).toUpperCase()}`;
      return {
        primary: time,
        rel: sameDay ? rel : `${rel} · ${d.toLocaleDateString([], {
          weekday: "short"
        })}`
      };
    } catch {
      return {
        primary: "—",
        rel: ""
      };
    }
  };
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(13,10,8,0.55)",
      zIndex: 60,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 460,
      background: "var(--paper)",
      color: "var(--ink)",
      borderRadius: "16px 16px 0 0",
      padding: "16px 18px 28px",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
      maxHeight: "90vh",
      overflowY: "auto"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: 800
    }
  }, "MEETUPS"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      fontSize: 18,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "×")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 12
    }
  }, "AGREE ON A PLACE + TIME BEFORE SERVICE DIES"), list.length === 0 && !creating && React.createElement("div", {
    style: {
      padding: "20px 12px",
      borderRadius: 12,
      background: "var(--paper-2)",
      textAlign: "center",
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      marginBottom: 4
    }
  }, "No meetups yet"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)"
    }
  }, "CREATE ONE BELOW")), list.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 12
    }
  }, list.map(m => {
    var stage = m.stageId ? STAGES.find(s => s.id === m.stageId) : null;
    var tFmt = fmtWhen(m.atTs);
    return React.createElement("div", {
      key: m.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: "var(--paper-2)",
        borderLeft: stage ? `3px solid ${stage.color}` : "3px solid var(--line-2)"
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 16,
        lineHeight: 1.2
      }
    }, m.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.1,
        color: "var(--muted)",
        marginTop: 3,
        display: "flex",
        gap: 6,
        flexWrap: "wrap"
      }
    }, stage && React.createElement("span", {
      style: {
        color: stage.color,
        fontWeight: 700
      }
    }, stage.name.toUpperCase()), React.createElement("span", null, tFmt.primary), React.createElement("span", {
      style: {
        opacity: 0.6
      }
    }, "· ", tFmt.rel))), React.createElement("button", {
      onClick: () => handleRemove(m.id),
      "aria-label": "Remove",
      style: {
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        fontSize: 16,
        cursor: "pointer",
        lineHeight: 1,
        padding: 4
      }
    }, "×"));
  })), !creating ? React.createElement("button", {
    onClick: () => setCreating(true),
    style: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: 999,
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "+ NEW MEETUP") : React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: `Find a stage or friend`,
    maxLength: 60,
    style: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid var(--line-2)",
      background: "var(--paper)",
      fontFamily: "Geist",
      fontSize: 14,
      color: "var(--ink)"
    }
  }), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 6
    }
  }, STAGES.map(s => {
    var on = stageId === s.id;
    return React.createElement("button", {
      key: s.id,
      onClick: () => setStageId(s.id),
      style: {
        padding: "6px 4px",
        borderRadius: 8,
        background: on ? s.color : "var(--paper-2)",
        color: on ? "#fff" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 8,
        letterSpacing: 0.8,
        fontWeight: on ? 700 : 500,
        cursor: "pointer"
      }
    }, s.short);
  })), React.createElement("input", {
    type: "datetime-local",
    value: whenLocal,
    onChange: e => setWhenLocal(e.target.value),
    style: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid var(--line-2)",
      background: "var(--paper)",
      fontFamily: "Geist",
      fontSize: 14,
      color: "var(--ink)"
    }
  }), React.createElement("textarea", {
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "Notes (optional)",
    maxLength: 200,
    rows: 2,
    style: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid var(--line-2)",
      background: "var(--paper)",
      fontFamily: "Geist",
      fontSize: 13,
      color: "var(--ink)",
      resize: "none"
    }
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    onClick: reset,
    style: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 999,
      background: "var(--paper-2)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "CANCEL"), React.createElement("button", {
    onClick: handleSave,
    style: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 999,
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "SAVE")))));
}
function readNotifyEnabled() {
  try {
    return localStorage.getItem("notify_enabled") === "1";
  } catch {
    return false;
  }
}
function writeNotifyEnabled(v) {
  try {
    localStorage.setItem("notify_enabled", v ? "1" : "0");
  } catch {}
}
function _setStartRealMs(artist) {
  var meta = FESTIVAL_CONFIG.dayDates?.[artist.day];
  if (!meta) return null;
  var [h, m] = artist.start.split(":").map(Number);
  var d = new Date(meta.y, meta.m, meta.d, h, m, 0, 0);
  if (h < 8) d.setDate(d.getDate() + 1);
  return d.getTime();
}
function useSavedSetReminders(savedIds, enabled) {
  var firedRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    var readLead = () => {
      try {
        var raw = parseInt(localStorage.getItem("plursky_reminder_lead_min") || "", 10);
        if ([5, 15, 30, 60].includes(raw)) return raw;
      } catch {}
      return 15;
    };
    var tick = () => {
      var now = Date.now();
      var leadMin = readLead();
      savedIds.forEach(id => {
        if (firedRef.current.has(id)) return;
        var a = ARTISTS.find(x => x.id === id);
        if (!a) return;
        var startMs = _setStartRealMs(a);
        if (!startMs) return;
        var minsUntil = (startMs - now) / 60000;
        if (minsUntil > 0 && minsUntil <= leadMin) {
          firedRef.current.add(id);
          try {
            var stage = STAGES.find(s => s.id === a.stage);
            new Notification(`${a.name} in ${Math.round(minsUntil)} min`, {
              body: `${stage?.name || a.stage} · ${fmt12(a.start)}`,
              tag: `set-${id}`,
              icon: "/og.svg"
            });
          } catch {}
        }
      });
    };
    tick();
    var id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [savedIds, enabled]);
}
function NotifyPill({
  enabled,
  onChange
}) {
  var supported = typeof Notification !== "undefined";
  var denied = supported && Notification.permission === "denied";
  var onClick = async () => {
    if (!supported) return;
    if (enabled) {
      writeNotifyEnabled(false);
      onChange(false);
      return;
    }
    var perm = Notification.permission;
    if (perm === "default") {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = "denied";
      }
    }
    if (perm !== "granted") {
      onChange(false);
      return;
    }
    writeNotifyEnabled(true);
    onChange(true);
    try {
      new Notification("Plursky notifications on", {
        body: "You'll get a heads-up 15 min before saved sets.",
        tag: "notify-on",
        icon: "/og.svg"
      });
    } catch {}
  };
  var label = !supported ? "N/A" : denied ? "BLOCKED" : enabled ? "🔔 ON" : "🔔 OFF";
  return React.createElement("button", {
    onClick: onClick,
    disabled: !supported || denied,
    title: "Set reminders 15 min before saved sets",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: enabled ? "var(--ember)" : "var(--paper)",
      color: enabled ? "#fff" : "var(--muted)",
      border: enabled ? "none" : "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "3px 8px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: supported && !denied ? "pointer" : "not-allowed",
      opacity: !supported || denied ? 0.55 : 1
    }
  }, label);
}
var WMO_LABELS = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  80: "Showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunder",
  96: "Thunder",
  99: "Severe thunder"
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
function _weatherVibe({
  tempF,
  windMph,
  code
}) {
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
    var raw = localStorage.getItem("weather_cache");
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.ts || Date.now() - obj.ts > 60 * 60 * 1000) return null;
    return obj.data;
  } catch {
    return null;
  }
}
function writeCachedWeather(data) {
  try {
    localStorage.setItem("weather_cache", JSON.stringify({
      ts: Date.now(),
      data
    }));
  } catch {}
}
function useWeather() {
  var [w, setW] = React.useState(readCachedWeather);
  React.useEffect(() => {
    if (w) return;
    var lat = FESTIVAL_LAT,
      lng = FESTIVAL_LNG;
    var url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    var cancelled = false;
    fetch(url).then(r => r.ok ? r.json() : null).then(j => {
      if (cancelled || !j?.current) return;
      var data = {
        tempF: Math.round(j.current.temperature_2m),
        windMph: Math.round(j.current.wind_speed_10m),
        code: j.current.weather_code,
        isDay: !!j.current.is_day
      };
      writeCachedWeather(data);
      setW(data);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [w]);
  return w;
}
function WeatherStrip() {
  var w = useWeather();
  if (!w) return null;
  var label = WMO_LABELS[w.code] || "Conditions";
  var emoji = _weatherEmoji(w.code, !w.isDay);
  var isAlert = w.code >= 95 || w.windMph >= 25 || w.code >= 61 && w.code <= 82;
  return React.createElement("div", {
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 11px",
      marginTop: 6,
      borderRadius: 999,
      background: isAlert ? "rgba(232,93,46,0.10)" : "var(--paper-2)",
      border: `1px solid ${isAlert ? "rgba(232,93,46,0.45)" : "var(--line)"}`
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      lineHeight: 1,
      flexShrink: 0
    }
  }, emoji), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      flexShrink: 0,
      color: isAlert ? "var(--ember)" : "var(--muted)"
    }
  }, (FESTIVAL_CONFIG.locationShort || FESTIVAL_CONFIG.brand || "").toUpperCase()), React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: 500,
      color: "var(--ink)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, w.tempF, "°F · ", label), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.8,
      fontWeight: 600,
      color: "var(--muted)",
      flexShrink: 0
    }
  }, w.windMph, " MPH"));
}
function SunriseStrip({
  avatar,
  onSelect
}) {
  var sun = FESTIVAL_CONFIG.sunTimes?.[NOW.day];
  if (!sun) return null;
  var nowMin = toNightMin(NOW.time);
  var riseMin = toNightMin(sun.rise);
  var minsUntil = riseMin - nowMin;
  if (minsUntil > 90 || minsUntil < -30) return null;
  var kin = STAGES.find(s => s.id === "kinetic");
  if (!kin) return null;
  var dist = Math.hypot(kin.x - avatar.x, kin.y - avatar.y);
  var walk = computeWalkRange(avatar, kin, dist, NOW.time);
  var walkLabel = walkMinsLabel(walk);
  var isUp = minsUntil <= 0;
  return React.createElement("button", {
    onClick: () => onSelect(kin.id),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 11px",
      marginTop: 6,
      background: "linear-gradient(90deg, #f59a36 0%, #e85d2e 60%, #a78bfa 100%)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      cursor: "pointer",
      textAlign: "left",
      boxShadow: "0 3px 10px rgba(245,154,54,0.30)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      lineHeight: 1,
      flexShrink: 0
    }
  }, "🌅"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800,
      opacity: 0.92,
      flexShrink: 0
    }
  }, "SUNRISE"), React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, isUp ? "Sun's up — head to the lotus" : "Hold the line"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: 800,
      flexShrink: 0
    }
  }, isUp ? "NOW" : `${minsUntil}M`, walkLabel ? ` \u00b7 ${walkLabel}M` : ""));
}
function NextSetStrip({
  savedIds,
  avatar,
  onSelect
}) {
  var next = findNextSavedSet(savedIds);
  if (!next) return null;
  var stage = STAGES.find(s => s.id === next.artist.stage);
  if (!stage) return null;
  var dist = Math.hypot(stage.x - avatar.x, stage.y - avatar.y);
  var walk = computeWalkRange(avatar, stage, dist, NOW.time);
  var walkLabel = walkMinsLabel(walk);
  var headline = next.isLive ? `LIVE · ${next.minsLeft}M` : next.minsUntil < 60 ? `IN ${next.minsUntil}M` : `IN ${Math.floor(next.minsUntil / 60)}H ${next.minsUntil % 60}M`;
  var willBeLate = walkLabel != null && !next.isLive && walk.hi >= next.minsUntil && next.minsUntil > 0;
  return React.createElement("button", {
    onClick: () => onSelect(stage.id),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 9,
      padding: "6px 10px",
      marginTop: 6,
      background: next.isLive ? "var(--ember)" : "var(--ink)",
      color: next.isLive ? "#fff" : "var(--paper)",
      border: "none",
      borderRadius: 12,
      cursor: "pointer",
      textAlign: "left",
      boxShadow: next.isLive ? "0 3px 10px rgba(232,93,46,0.30)" : "0 2px 6px rgba(26,18,13,0.15)"
    }
  }, React.createElement("div", {
    style: {
      width: 5,
      alignSelf: "stretch",
      borderRadius: 3,
      background: stage.color
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.3,
      fontWeight: 700,
      opacity: 0.7,
      lineHeight: 1.1
    }
  }, next.isLive ? "★ NEXT — LIVE" : "★ NEXT"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 14,
      lineHeight: 1.15,
      letterSpacing: -0.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, next.artist.name, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.8,
      opacity: 0.6,
      marginLeft: 6
    }
  }, stage.short, " · ", fmt12(next.artist.start)))), React.createElement("div", {
    style: {
      textAlign: "right",
      flexShrink: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 800,
      lineHeight: 1.1
    }
  }, headline), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.9,
      fontWeight: 600,
      opacity: willBeLate ? 1 : 0.7,
      color: willBeLate ? "#fbbf24" : "inherit",
      marginTop: 1
    }
  }, walkLabel ? `${walkLabel}M` : "\u2014", willBeLate ? " \u26a0" : "")));
}
function MapScreen({
  state,
  setState
}) {
  var [selectedStage, setSelectedStage] = React.useState(state.focusStage || null);
  var [gpsLive, setGpsLive] = React.useState(true);
  var [demoAvatar, setDemoAvatar] = React.useState(AVATAR_START);
  var [friends, setFriends] = React.useState(FRIENDS);
  var [peek, setPeek] = React.useState(false);
  var [meetMode, setMeetMode] = React.useState(false);
  var [meetTarget, setMeetTarget] = React.useState(null);
  var [meetGroup, setMeetGroup] = React.useState([]);
  var [rallySent, setRallySent] = React.useState(false);
  var [incomingRally, setIncomingRally] = React.useState(null);
  var dismissedRallyRef = React.useRef(new Set());
  var [clusterDismissed, setClusterDismissed] = React.useState(null);
  var clearMeet = () => {
    setMeetMode(false);
    setMeetTarget(null);
    setMeetGroup([]);
    setRallySent(false);
    sbClearRally();
  };
  var [savedStages, setSavedStages] = React.useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("plursky_saved_stages_v1") || "[]"));
    } catch {
      return new Set();
    }
  });
  var toggleSavedStage = React.useCallback(id => {
    setSavedStages(prev => {
      var next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      try {
        localStorage.setItem("plursky_saved_stages_v1", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);
  var [navigating, setNavigating] = React.useState(false);
  React.useEffect(() => {
    setNavigating(false);
  }, [selectedStage]);
  var goToStage = React.useCallback(st => {
    if (!st) return;
    setNavigating(true);
  }, []);
  var [search, setSearch] = React.useState("");
  var [searchSheetExpanded, setSearchSheetExpanded] = React.useState(false);
  var [heading, setHeading] = React.useState(0);
  var [chatFriend, setChatFriend] = React.useState(null);
  var [rideshareOpen, setRideshareOpen] = React.useState(false);
  var [showLabels, setShowLabels] = React.useState(false);
  var [showHeat, setShowHeat] = React.useState(false);
  var [amenityKey, setAmenityKey] = React.useState(false);
  var [amenityFilter, setAmenityFilter] = React.useState(null);
  var REAL_MAP_ONLY = FESTIVAL_CONFIG.mapMode === "real";
  var [useRealMap, setUseRealMap] = React.useState(() => {
    if (REAL_MAP_ONLY) return true;
    try {
      return localStorage.getItem("plursky_use_realmap") === "1";
    } catch {
      return false;
    }
  });
  var [realMapNote, setRealMapNote] = React.useState(null);
  var _disableRealMap = why => {
    if (REAL_MAP_ONLY) {
      setRealMapNote((why || "Map unavailable") + " — check your connection");
      setTimeout(() => setRealMapNote(null), 7000);
      return;
    }
    try {
      localStorage.removeItem("plursky_use_realmap");
    } catch {}
    setUseRealMap(false);
    setRealMapNote((why || "Real map unavailable") + " — festival map shown");
    setTimeout(() => setRealMapNote(null), 7000);
  };
  var [mapZoom, setMapZoom] = React.useState(1);
  var [mapPan, setMapPan] = React.useState({
    x: 0,
    y: 0
  });
  var MAP_ZOOM_MIN = 0.7,
    MAP_ZOOM_MAX = 3.5;
  var zoomIn = () => setMapZoom(z => Math.min(MAP_ZOOM_MAX, +(z * 1.4).toFixed(3)));
  var zoomOut = () => setMapZoom(z => Math.max(MAP_ZOOM_MIN, +(z / 1.4).toFixed(3)));
  var zoomReset = () => {
    setMapZoom(1);
    setMapPan({
      x: 0,
      y: 0
    });
  };
  var [pingOpen, setPingOpen] = React.useState(false);
  var [iAmAtOpen, setIAmAtOpen] = React.useState(false);
  var [shareOpen, setShareOpen] = React.useState(false);
  var [meetupsOpen, setMeetupsOpen] = React.useState(false);
  var [meetups, setMeetups] = React.useState(() => upcomingMeetups());
  React.useEffect(() => {
    var id = setInterval(() => setMeetups(upcomingMeetups()), 30000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    if (!meetupsOpen) setMeetups(upcomingMeetups());
  }, [meetupsOpen]);
  var [menuOpen, setMenuOpen] = React.useState(false);
  var [moreOpen, setMoreOpen] = React.useState(false);
  var [surveyOpen, setSurveyOpen] = React.useState(false);
  var surveyOn = React.useMemo(() => typeof surveyEnabled === "function" && surveyEnabled(), []);
  var [myStatusStage, setMyStatusStage] = React.useState(() => getMyStatus()?.stage || null);
  var [shareState, setShareState] = React.useState(() => {
    try {
      var s = JSON.parse(localStorage.getItem("plursky_share_state") || "null");
      if (s && s.expiresAt && s.expiresAt <= Date.now()) return null;
      return s;
    } catch {
      return null;
    }
  });
  var isSharing = !!shareState?.active && (!shareState?.expiresAt || shareState.expiresAt > Date.now());
  var [crewSnap, setCrewSnap] = React.useState(() => sbGetPresSnap());
  var crewName = React.useMemo(() => {
    try {
      return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || "";
    } catch {
      return "";
    }
  }, []);
  var [notifyEnabled, setNotifyEnabled] = React.useState(readNotifyEnabled);
  useSavedSetReminders(state.saved, notifyEnabled);
  var [compass, setCompass] = React.useState(false);
  var [compassHeading, setCompassHeading] = React.useState(0);
  var [compassStatus, setCompassStatus] = React.useState("off");
  var enableCompass = React.useCallback(async () => {
    if (typeof DeviceOrientationEvent === "undefined") {
      setCompassStatus("unavailable");
      return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        var result = await DeviceOrientationEvent.requestPermission();
        if (result !== "granted") {
          setCompassStatus("denied");
          return;
        }
      } catch {
        setCompassStatus("denied");
        return;
      }
    }
    setCompassStatus("locating");
    setCompass(true);
  }, []);
  var _compassRef = React.useRef({
    smoothed: 0,
    absEverSeen: false
  });
  React.useEffect(() => {
    if (!compass) return;
    var ref = _compassRef.current;
    ref.absEverSeen = false;
    var handler = e => {
      var h = null;
      if (e.webkitCompassHeading != null) {
        h = e.webkitCompassHeading;
      } else if (e.absolute && e.alpha != null) {
        h = (360 - e.alpha) % 360;
        ref.absEverSeen = true;
      } else if (e.alpha != null && !ref.absEverSeen) {
        h = (360 - e.alpha) % 360;
      }
      if (h != null) {
        var delta = h - ref.smoothed;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        ref.smoothed = (ref.smoothed + delta * 0.18 + 360) % 360;
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
  var {
    pos: gpsPos,
    status: gpsStatus
  } = useGeolocation(gpsLive);
  var liveAvatar = React.useMemo(() => {
    if (!gpsPos) return null;
    var mi = distMiles(gpsPos.lat, gpsPos.lng, FESTIVAL_LAT, FESTIVAL_LNG);
    if (mi > ON_SITE_RADIUS_MI) return {
      offSite: true,
      mi
    };
    var {
      x,
      y
    } = gpsToMap(gpsPos.lat, gpsPos.lng);
    return {
      onSite: true,
      x: Math.max(2, Math.min(98, x)),
      y: Math.max(2, Math.min(98, y)),
      accuracy: gpsPos.accuracy
    };
  }, [gpsPos]);
  var isLiveOnSite = !!liveAvatar?.onSite;
  var useDemo = !isLiveOnSite;
  var avatar = isLiveOnSite ? {
    x: liveAvatar.x,
    y: liveAvatar.y,
    live: true
  } : demoAvatar;
  var {
    active: bsActive
  } = useBatterySaver();
  React.useEffect(() => {
    if (!useDemo) return;
    var id = setInterval(() => {
      var goal = meetMode && meetTarget ? meetTarget : selectedStage ? STAGES.find(s => s.id === selectedStage) : null;
      setDemoAvatar(a => {
        if (goal) {
          var _dx = goal.x - a.x,
            _dy = goal.y - a.y;
          var d = Math.hypot(_dx, _dy);
          setHeading(Math.atan2(_dy, _dx));
          if (d < 1.2) return a;
          return {
            x: a.x + _dx / d * 0.35,
            y: a.y + _dy / d * 0.35
          };
        }
        return {
          x: Math.max(12, Math.min(88, a.x + (Math.random() - 0.5) * 0.2)),
          y: Math.max(12, Math.min(88, a.y + (Math.random() - 0.5) * 0.2))
        };
      });
      setFriends(prev => prev.map(f => {
        if (meetMode && meetTarget && meetGroup.includes(f.id)) {
          var _dx2 = meetTarget.x - f.x,
            _dy2 = meetTarget.y - f.y;
          var d = Math.hypot(_dx2, _dy2);
          if (d < 1.2) return f;
          return {
            ...f,
            x: f.x + _dx2 / d * 0.32,
            y: f.y + _dy2 / d * 0.32
          };
        }
        return {
          ...f,
          x: Math.max(12, Math.min(88, f.x + (Math.random() - 0.5) * 0.25)),
          y: Math.max(12, Math.min(88, f.y + (Math.random() - 0.5) * 0.25))
        };
      }));
    }, bsActive ? 2400 : 600);
    return () => clearInterval(id);
  }, [useDemo, selectedStage, meetMode, meetTarget, meetGroup, bsActive]);
  React.useEffect(() => {
    if (!isLiveOnSite) return;
    var goal = meetMode && meetTarget ? meetTarget : selectedStage ? STAGES.find(s => s.id === selectedStage) : null;
    if (!goal) return;
    setHeading(Math.atan2(goal.y - avatar.y, goal.x - avatar.x));
  }, [isLiveOnSite, avatar.x, avatar.y, selectedStage, meetMode, meetTarget]);
  React.useEffect(() => sbOnPresenceChange(s => setCrewSnap({
    ...s
  })), []);
  React.useEffect(() => sbOnRally(r => {
    if (r && dismissedRallyRef.current.has(r.rallyId)) return;
    setIncomingRally(r || null);
  }), []);
  var myPresId = sbGetMyPresId();
  var crewFriends = React.useMemo(() => {
    return Object.entries(crewSnap).filter(([id]) => id !== myPresId).map(([id, e]) => {
      var x, y;
      if (e.gps && Number.isFinite(e.gps.lat) && Number.isFinite(e.gps.lng)) {
        var m = gpsToMap(e.gps.lat, e.gps.lng);
        x = Math.max(2, Math.min(98, m.x));
        y = Math.max(2, Math.min(98, m.y));
      } else {
        var st = e.stageId ? STAGES.find(s => s.id === e.stageId) : null;
        if (!st) return null;
        x = st.x;
        y = st.y;
      }
      return {
        id,
        name: e.name || "?",
        color: e.color || "#888",
        x,
        y,
        gps: e.gps || null,
        stageId: e.stageId,
        ts: e.ts
      };
    }).filter(Boolean);
  }, [crewSnap, myPresId]);
  var crewCluster = React.useMemo(() => {
    if (!crewFriends.length) return null;
    var byStage = {};
    for (var f of crewFriends) {
      var sid = f.stageId || _nearestStageId(f.x, f.y);
      if (!sid) continue;
      (byStage[sid] = byStage[sid] || []).push(f);
    }
    var best = null;
    var _loop = function (_sid) {
      if (arr.length >= 2 && (!best || arr.length > best.members.length)) {
        var st = STAGES.find(s => s.id === _sid);
        if (st) best = {
          stage: st,
          members: arr
        };
      }
    };
    for (var [_sid, arr] of Object.entries(byStage)) {
      _loop(_sid);
    }
    return best;
  }, [crewFriends]);
  React.useEffect(() => {
    try {
      if (shareState) localStorage.setItem("plursky_share_state", JSON.stringify(shareState));else localStorage.removeItem("plursky_share_state");
    } catch {}
  }, [shareState]);
  React.useEffect(() => {
    if (!isSharing) {
      sbPresenceLeave();
      return;
    }
    var stageId = shareState.includeStage ? myStatusStage || STAGES[0]?.id || null : null;
    var gps = shareState.includeGps && gpsPos ? {
      lat: gpsPos.lat,
      lng: gpsPos.lng,
      accuracy: gpsPos.accuracy
    } : undefined;
    sbPresenceJoin({
      name: crewName || "Anon",
      stageId,
      gps
    });
    return () => {};
  }, [isSharing]);
  React.useEffect(() => {
    if (!isSharing) return;
    var gps = shareState?.includeGps && gpsPos ? {
      lat: gpsPos.lat,
      lng: gpsPos.lng,
      accuracy: gpsPos.accuracy
    } : undefined;
    var stageId = shareState?.includeStage ? myStatusStage || STAGES[0]?.id || null : null;
    if (gps || stageId !== undefined) sbPresenceUpdate({
      gps,
      stageId
    });
    if (shareState?.token) sbLiveShareUpdate(shareState.token, {
      gps,
      stageId
    });
  }, [isSharing, shareState?.includeGps, shareState?.includeStage, shareState?.token, gpsPos?.lat, gpsPos?.lng, gpsPos?.accuracy, myStatusStage]);
  React.useEffect(() => {
    if (!isSharing) return;
    if (!shareState.token) {
      var token = sbGenerateShareToken();
      setShareState(s => s ? {
        ...s,
        token
      } : s);
      return;
    }
    sbLiveShareStart({
      token: shareState.token,
      pid: sbGetMyPresId?.() || "anon",
      name: crewName || "Friend",
      expiresAt: shareState.expiresAt,
      gps: shareState.includeGps && gpsPos ? {
        lat: gpsPos.lat,
        lng: gpsPos.lng,
        accuracy: gpsPos.accuracy
      } : undefined,
      stageId: shareState.includeStage ? myStatusStage || STAGES[0]?.id || null : null
    });
    var tokenCapture = shareState.token;
    return () => {
      sbLiveShareStop(tokenCapture);
    };
  }, [isSharing, shareState?.token]);
  React.useEffect(() => {
    if (!shareState?.active || !shareState.expiresAt) return;
    var remaining = shareState.expiresAt - Date.now();
    if (remaining <= 0) {
      setShareState(null);
      return;
    }
    var id = setTimeout(() => setShareState(null), Math.min(remaining, 2147483000));
    return () => clearTimeout(id);
  }, [shareState?.active, shareState?.expiresAt]);
  var stage = selectedStage ? STAGES.find(s => s.id === selectedStage) : null;
  var nowAtStage = React.useMemo(() => {
    if (!stage) return null;
    var t = Date.now();
    if (t < FESTIVAL_START_MS || t > FESTIVAL_END_MS) return null;
    var mins = toNightMin(NOW.time);
    return ARTISTS.find(a => a.stage === stage.id && a.day === NOW.day && mins >= toNightMin(a.start) && mins < toNightMin(a.end)) || null;
  }, [stage && stage.id, NOW.day, NOW.time]);
  var dx = stage ? stage.x - avatar.x : 0;
  var dy = stage ? stage.y - avatar.y : 0;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var walk = computeWalkRange(avatar, stage, dist, NOW.time);
  var searchQuery = search.trim().toLowerCase();
  var _relevance = (name, term) => {
    var n = name.toLowerCase();
    if (n === term) return 100;
    if (n.startsWith(term)) return 80;
    if (n.split(/\s+/).some(w => w.startsWith(term))) return 60;
    if (n.includes(term)) return 40;
    return 0;
  };
  var stageMatches = React.useMemo(() => {
    if (!searchQuery) return [];
    return STAGES.map(s => ({
      s,
      score: _relevance(s.name, searchQuery)
    })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).map(x => x.s);
  }, [searchQuery]);
  var artistMatches = React.useMemo(() => {
    if (!searchQuery) return [];
    return ARTISTS.map(a => ({
      a,
      score: _relevance(a.name, searchQuery)
    })).filter(x => x.score > 0).sort((x, y) => y.score - x.score || (y.a.tier || 0) - (x.a.tier || 0)).slice(0, 16).map(x => x.a);
  }, [searchQuery]);
  var handleMapClick = e => {
    if (!meetMode) return;
    var svg = e.currentTarget;
    var rect = svg.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * 100;
    var y = (e.clientY - rect.top) / rect.height * 100;
    var names = meetGroup.map(id => friends.find(f => f.id === id)?.name).filter(Boolean);
    setMeetTarget({
      x,
      y,
      label: names.length ? `Meet ${names.join(" + ")}` : "Meet here"
    });
  };
  var toggleGroupMember = friendId => {
    var newGroup = meetGroup.includes(friendId) ? meetGroup.filter(id => id !== friendId) : [...meetGroup, friendId];
    setMeetGroup(newGroup);
    if (newGroup.length === 0) {
      setMeetTarget(null);
      return;
    }
    var selected = newGroup.map(id => friends.find(f => f.id === id)).filter(Boolean);
    var allX = [avatar.x, ...selected.map(f => f.x)];
    var allY = [avatar.y, ...selected.map(f => f.y)];
    var cx = allX.reduce((s, v) => s + v, 0) / allX.length;
    var cy = allY.reduce((s, v) => s + v, 0) / allY.length;
    setMeetTarget({
      x: cx,
      y: cy,
      label: `Meet ${selected.map(f => f.name).join(" + ")}`
    });
  };
  var gpsLabel = !gpsLive ? "OFF" : gpsStatus === "live" ? isLiveOnSite ? "LIVE" : "OFF-SITE" : gpsStatus === "locating" ? "FINDING…" : gpsStatus === "denied" ? "DENIED" : gpsStatus === "unavailable" ? "N/A" : "DEMO";
  var gpsActive = gpsLive && (gpsStatus === "live" || gpsStatus === "locating");
  return React.createElement(Screen, {
    bg: "var(--paper)",
    ink: "var(--ink)"
  }, React.createElement("div", {
    style: {
      flex: 1,
      position: "relative",
      overflow: "hidden",
      background: "var(--paper-2)"
    }
  }, React.createElement(WellnessPill, null), state._navStack?.length > 0 && React.createElement("button", {
    onClick: () => window._popNav?.(),
    "aria-label": "Back",
    style: {
      position: "absolute",
      top: 12,
      left: 10,
      zIndex: 5,
      width: 38,
      height: 38,
      borderRadius: 12,
      background: "rgba(247,237,224,0.92)",
      backdropFilter: "blur(10px)",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      cursor: "pointer",
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "←"), React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 10,
      zIndex: 4,
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, React.createElement("button", {
    onClick: () => setGpsLive(g => !g),
    "aria-label": "Toggle GPS",
    "aria-pressed": gpsActive,
    style: {
      minWidth: 46,
      padding: "6px 8px",
      borderRadius: 14,
      background: gpsActive ? "var(--ember)" : "rgba(247,237,224,0.92)",
      color: gpsActive ? "#fff" : gpsStatus === "denied" ? "#c14a4a" : "var(--ink)",
      border: gpsActive ? "none" : "1px solid var(--line-2)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      boxShadow: "0 4px 12px rgba(0,0,0,0.10)"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, React.createElement("path", {
    d: "M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12"
  }), React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "6"
  }), gpsActive && React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "2.5",
    fill: "currentColor",
    stroke: "none"
  })), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.8,
      fontWeight: 800,
      lineHeight: 1
    }
  }, gpsLabel)), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      background: "rgba(247,237,224,0.92)",
      border: "1px solid var(--line-2)",
      borderRadius: 14,
      overflow: "hidden",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.10)"
    }
  }, React.createElement("button", {
    onClick: () => setMenuOpen(o => !o),
    "aria-label": "Map layers",
    "aria-pressed": menuOpen,
    style: {
      width: 46,
      height: 36,
      padding: 0,
      background: menuOpen ? "var(--ink)" : "transparent",
      color: menuOpen ? "var(--paper)" : "var(--ink)",
      border: "none",
      borderBottom: "1px solid var(--line)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M12 3 L21 8 L12 13 L3 8 Z"
  }), React.createElement("path", {
    d: "M3 12 L12 17 L21 12"
  }), React.createElement("path", {
    d: "M3 16 L12 21 L21 16"
  }))), React.createElement("button", {
    onClick: zoomIn,
    disabled: mapZoom >= MAP_ZOOM_MAX,
    "aria-label": "Zoom in",
    style: {
      width: 46,
      height: 36,
      padding: 0,
      background: "transparent",
      border: "none",
      borderBottom: "1px solid var(--line)",
      cursor: mapZoom >= MAP_ZOOM_MAX ? "default" : "pointer",
      opacity: mapZoom >= MAP_ZOOM_MAX ? 0.35 : 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ink)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1
    }
  }, "+"), React.createElement("button", {
    onClick: zoomOut,
    disabled: mapZoom <= MAP_ZOOM_MIN,
    "aria-label": "Zoom out",
    style: {
      width: 46,
      height: 36,
      padding: 0,
      background: "transparent",
      border: "none",
      cursor: mapZoom <= MAP_ZOOM_MIN ? "default" : "pointer",
      opacity: mapZoom <= MAP_ZOOM_MIN ? 0.35 : 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--ink)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 20,
      fontWeight: 600,
      lineHeight: 1
    }
  }, "−"), (mapZoom !== 1 || mapPan.x !== 0 || mapPan.y !== 0) && React.createElement("button", {
    onClick: zoomReset,
    "aria-label": "Reset zoom",
    style: {
      width: 46,
      padding: "5px 0",
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderTop: "1px solid var(--line)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 8,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, "RESET"))), menuOpen && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => setMenuOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 5
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      top: 90,
      right: 10,
      zIndex: 6,
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      borderRadius: 12,
      padding: 5,
      minWidth: 220,
      boxShadow: "0 10px 28px rgba(26,18,13,0.20)"
    }
  }, [{
    id: "notify",
    label: "🔔  Reminders",
    active: notifyEnabled,
    onToggle: async () => {
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "denied") return;
      if (notifyEnabled) {
        writeNotifyEnabled(false);
        setNotifyEnabled(false);
        return;
      }
      var perm = Notification.permission;
      if (perm === "default") {
        try {
          perm = await Notification.requestPermission();
        } catch {
          perm = "denied";
        }
      }
      if (perm !== "granted") {
        setNotifyEnabled(false);
        return;
      }
      writeNotifyEnabled(true);
      setNotifyEnabled(true);
    }
  }, {
    id: "compass",
    label: "⌖  Compass mode",
    active: compass && compassStatus === "live",
    onToggle: () => {
      if (compass) {
        setCompass(false);
        setCompassStatus("off");
      } else enableCompass();
    }
  }, {
    id: "crowd",
    label: "🔥  Crowd heatmap",
    active: showHeat,
    onToggle: () => setShowHeat(s => !s)
  }, {
    id: "amenity",
    label: "🚻  Amenity key",
    active: amenityKey,
    onToggle: () => {
      setAmenityKey(v => !v);
      setAmenityFilter(null);
    }
  }, {
    id: "labels",
    label: "🏷  Landmark labels",
    active: showLabels,
    onToggle: () => setShowLabels(s => !s)
  }, ...(REAL_MAP_ONLY ? [] : [{
    id: "realmap",
    label: "🗺  Real map (BETA)",
    active: useRealMap,
    onToggle: () => {
      var v = !useRealMap;
      try {
        if (v) localStorage.setItem("plursky_use_realmap", "1");else localStorage.removeItem("plursky_use_realmap");
      } catch {}
      setRealMapNote(null);
      setUseRealMap(v);
    }
  }])].map(item => React.createElement("div", {
    key: item.id,
    role: "button",
    onClick: item.onToggle,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 10px",
      borderRadius: 8,
      cursor: "pointer"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--ink)",
      fontWeight: 500
    }
  }, item.label), React.createElement("span", {
    style: {
      width: 30,
      height: 18,
      borderRadius: 18,
      background: item.active ? "var(--ember)" : "var(--line-2)",
      position: "relative",
      flexShrink: 0,
      transition: "background 0.15s"
    }
  }, React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: item.active ? 14 : 2,
      width: 14,
      height: 14,
      borderRadius: 14,
      background: "#fff",
      transition: "left 0.18s"
    }
  })))))), gpsLive && gpsStatus === "denied" && React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 4,
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(193,74,74,0.95)",
      color: "#fff",
      backdropFilter: "blur(8px)",
      maxWidth: "calc(100% - 120px)"
    },
    title: "Location permission is denied — enable it for this site to place yourself on the map"
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "block"
    }
  }, "GPS DENIED · ENABLE LOCATION")), amenityKey && !meetMode && React.createElement("div", {
    style: {
      position: "absolute",
      left: 10,
      top: 90,
      zIndex: 6,
      background: "rgba(247,237,224,0.94)",
      border: "1px solid var(--line-2)",
      borderRadius: 12,
      padding: 4,
      minWidth: 124,
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      boxShadow: "0 6px 20px rgba(26,18,13,0.22)"
    }
  }, AMENITY_KEY.map(a => {
    var on = amenityFilter === a.type;
    var present = (typeof AMENITIES !== "undefined" ? AMENITIES : []).some(x => x.type === a.type);
    if (!present) return null;
    return React.createElement("div", {
      key: a.type,
      role: "button",
      tabIndex: 0,
      "aria-label": `Show only ${a.label} on the map`,
      "aria-pressed": on,
      onClick: () => setAmenityFilter(f => f === a.type ? null : a.type),
      onKeyDown: e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setAmenityFilter(f => f === a.type ? null : a.type);
        }
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 7px",
        borderRadius: 8,
        cursor: "pointer",
        background: on ? "var(--ink)" : "transparent",
        opacity: amenityFilter && !on ? 0.42 : 1,
        transition: "background 0.12s, opacity 0.12s"
      }
    }, React.createElement("span", {
      style: {
        width: 13,
        height: 13,
        borderRadius: 13,
        flexShrink: 0,
        background: a.color,
        border: "1.5px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Geist Mono, monospace",
        fontSize: 8,
        fontWeight: 900,
        color: "#fff",
        lineHeight: 1
      }
    }, a.letter), React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 600,
        flex: 1,
        color: on ? "var(--paper)" : "var(--ink)"
      }
    }, a.label));
  })), isSharing && React.createElement("button", {
    onClick: () => setShareState(null),
    "aria-label": "Stop sharing your location",
    style: {
      position: "absolute",
      top: 46,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 6,
      display: "flex",
      alignItems: "center",
      gap: 7,
      padding: "5px 12px",
      borderRadius: 999,
      cursor: "pointer",
      border: "none",
      background: "rgba(45,122,85,0.96)",
      color: "#fff",
      boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
      backdropFilter: "blur(8px)"
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 7,
      background: "#fff",
      animation: "pulse 1.6s infinite"
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800
    }
  }, "SHARING · TAP TO STOP")), liveAvatar?.offSite && !(gpsLive && gpsStatus === "denied") && React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 4,
      padding: "5px 12px",
      borderRadius: 999,
      background: "rgba(245,154,54,0.95)",
      color: "#fff",
      backdropFilter: "blur(8px)",
      boxShadow: "0 2px 10px rgba(0,0,0,0.15)"
    },
    title: `${liveAvatar.mi.toFixed(1)} mi from venue · showing demo`
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, liveAvatar.mi >= 1 ? `${liveAvatar.mi.toFixed(0)} MI AWAY` : "OUTSIDE VENUE", " · DEMO")), (() => {
    var hasPlaceCard = !!(stage || meetMode && meetTarget);
    var sheetMode = hasPlaceCard ? "place-card" : search.trim().length > 0 ? "full" : searchSheetExpanded ? "half" : "collapsed";
    var isShort = typeof window !== "undefined" && window.innerHeight < 700;
    var sheetMaxH = sheetMode === "full" ? isShort ? "44vh" : "48vh" : sheetMode === "half" ? isShort ? 260 : 320 : 82;
    if (sheetMode === "place-card") return null;
    return React.createElement("div", {
      style: {
        position: "absolute",
        left: 8,
        right: 8,
        bottom: 10,
        zIndex: 5,
        background: "var(--paper)",
        border: "1px solid var(--line-2)",
        borderRadius: 16,
        boxShadow: "0 -6px 24px rgba(0,0,0,0.18)",
        maxHeight: sheetMaxH,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "max-height 0.3s var(--ease-smooth)",
        willChange: "max-height"
      }
    }, React.createElement("div", {
      onClick: () => setSearchSheetExpanded(e => !e),
      style: {
        display: "flex",
        justifyContent: "center",
        cursor: "pointer",
        padding: "6px 0 4px",
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        width: 36,
        height: 4,
        borderRadius: 4,
        background: "var(--line-2)"
      }
    })), React.createElement("div", {
      style: {
        padding: "0 8px 6px",
        flexShrink: 0
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        background: "var(--paper-2)",
        borderRadius: 999,
        padding: "7px 11px",
        border: "1px solid var(--line)"
      }
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--muted)",
      strokeWidth: "2",
      style: {
        flexShrink: 0
      }
    }, React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), React.createElement("path", {
      d: "M20 20 L16 16"
    })), React.createElement("input", {
      type: "text",
      placeholder: "Search stages or artists…",
      value: search,
      onFocus: () => setSearchSheetExpanded(true),
      onChange: e => setSearch(e.target.value),
      style: {
        flex: 1,
        minWidth: 0,
        background: "transparent",
        border: "none",
        outline: "none",
        color: "var(--ink)",
        fontFamily: "Geist, sans-serif",
        fontSize: 13
      }
    }), search && React.createElement("button", {
      onClick: () => {
        setSearch("");
      },
      "aria-label": "Clear search",
      style: {
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        cursor: "pointer",
        padding: 0,
        width: 18,
        height: 18,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0
      }
    }, "×"))), sheetMode === "collapsed" && React.createElement("div", {
      style: {
        padding: "0 10px 8px",
        display: "flex",
        alignItems: "center",
        gap: 5,
        flexShrink: 0
      }
    }, React.createElement("button", {
      onClick: () => {
        if (meetMode) {
          clearMeet();
        } else {
          setMeetMode(true);
        }
      },
      style: {
        background: meetMode ? "var(--ember)" : "var(--ink)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: "4px 10px",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0
      }
    }, meetMode ? "× CANCEL" : "MEET UP"), React.createElement("div", {
      className: "no-scrollbar",
      style: {
        display: "flex",
        gap: 3,
        flex: 1,
        overflowX: "auto",
        scrollbarWidth: "none"
      }
    }, friends.map(f => {
      var unread = unreadCount(f.id);
      return React.createElement("button", {
        key: f.id,
        onClick: () => setChatFriend(f),
        "aria-label": `Chat with ${f.name}`,
        style: {
          position: "relative",
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 22,
          background: f.avatarTone,
          border: "1.5px solid #fff",
          padding: 0,
          cursor: "pointer"
        }
      }, unread > 0 && React.createElement("span", {
        style: {
          position: "absolute",
          top: -3,
          right: -3,
          width: 8,
          height: 8,
          borderRadius: 8,
          background: "var(--ember)",
          border: "1px solid var(--paper)"
        }
      }));
    }), crewFriends.map(f => React.createElement("button", {
      key: f.id,
      onClick: () => setChatFriend({
        id: f.id,
        presId: f.id,
        name: f.name,
        avatarTone: f.color,
        x: f.x,
        y: f.y
      }),
      "aria-label": `Chat with ${f.name}`,
      style: {
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: 22,
        background: `${f.color}44`,
        border: `1.5px solid ${f.color}`,
        padding: 0,
        cursor: "pointer",
        position: "relative"
      }
    }, React.createElement("span", {
      style: {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 6,
        background: f.color,
        animation: "pulse 1.6s infinite"
      }
    }))))), React.createElement("button", {
      onClick: () => setMoreOpen(o => !o),
      "aria-label": "More options",
      "aria-pressed": moreOpen,
      style: {
        background: "var(--paper-2)",
        border: "1px solid var(--line-2)",
        borderRadius: 999,
        width: 26,
        height: 22,
        padding: 0,
        cursor: "pointer",
        flexShrink: 0,
        fontSize: 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink)"
      }
    }, "⋯")), search && React.createElement("div", {
      style: {
        overflowY: "auto",
        padding: "0 8px 10px",
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        background: "var(--paper-2)",
        borderRadius: 10
      }
    }, stageMatches.length > 0 && React.createElement("div", {
      className: "mono",
      style: {
        padding: "8px 12px 4px",
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--muted)"
      }
    }, "STAGES"), stageMatches.map(s => React.createElement("button", {
      key: `stage-${s.id}`,
      onClick: () => {
        setSelectedStage(s.id);
        setSearch("");
        setSearchSheetExpanded(false);
      },
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        background: "transparent",
        border: "none",
        color: "var(--ink)",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 10
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 8,
        background: s.color,
        boxShadow: `0 0 6px ${s.color}`
      }
    }), React.createElement("span", {
      style: {
        fontFamily: "Geist, sans-serif",
        fontSize: 13,
        flex: 1
      }
    }, s.name), savedStages.has(s.id) && React.createElement("span", {
      "aria-label": "Saved",
      style: {
        color: "var(--ember)",
        fontSize: 12
      }
    }, "♥"))), artistMatches.length > 0 && React.createElement("div", {
      className: "mono",
      style: {
        padding: "8px 12px 4px",
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--muted)"
      }
    }, "ARTISTS"), artistMatches.map(a => {
      var st = STAGES.find(s => s.id === a.stage);
      var isSaved = state.saved.includes(a.id);
      var when = a.start ? `${a.start}${a.day ? ` · D${a.day}` : ""}` : "";
      return React.createElement("button", {
        key: `artist-${a.id}`,
        onClick: () => {
          setSelectedStage(a.stage);
          setSearch("");
          setSearchSheetExpanded(false);
        },
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          color: "var(--ink)",
          textAlign: "left",
          cursor: "pointer",
          borderRadius: 10
        }
      }, React.createElement("span", {
        style: {
          width: 8,
          height: 8,
          borderRadius: 8,
          background: st?.color || "var(--muted)",
          flexShrink: 0
        }
      }), React.createElement("span", {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          gap: 1
        }
      }, React.createElement("span", {
        style: {
          fontFamily: "Geist, sans-serif",
          fontSize: 13,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, isSaved && React.createElement("span", {
        style: {
          color: "var(--ember)",
          marginRight: 4
        }
      }, "★"), a.name), when && React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 0.5,
          color: "var(--muted)"
        }
      }, when)), React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 1,
          color: "var(--muted)",
          flexShrink: 0
        }
      }, "→ ", st?.short || st?.name || ""));
    }), stageMatches.length === 0 && artistMatches.length === 0 && React.createElement("div", {
      style: {
        padding: "18px 14px",
        textAlign: "center"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--ink)",
        marginBottom: 4
      }
    }, "No matches for \"", search, "\""), React.createElement("div", {
      style: {
        fontSize: 11,
        color: "var(--muted)"
      }
    }, "Try an artist name, a stage, or a genre.")))), !search && sheetMode === "half" && React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        padding: "0 10px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flexShrink: 0
      }
    }, React.createElement(NextSetStrip, {
      savedIds: state.saved,
      avatar: avatar,
      onSelect: id => {
        setSelectedStage(id);
        setPeek(false);
        setSearchSheetExpanded(false);
      }
    }), React.createElement(SunriseStrip, {
      avatar: avatar,
      onSelect: id => {
        setSelectedStage(id);
        setPeek(false);
        setSearchSheetExpanded(false);
      }
    }), React.createElement(WeatherStrip, null)), React.createElement("div", {
      style: {
        padding: "0 10px 6px"
      }
    }, React.createElement("div", {
      className: "no-scrollbar",
      style: {
        display: "flex",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
        paddingBottom: 2
      }
    }, [{
      type: "water",
      label: "Water",
      emoji: "💧",
      color: "#38bdf8"
    }, {
      type: "med",
      label: "Medic",
      emoji: "✚",
      color: "#f87171"
    }, {
      type: "toilet",
      label: "Toilet",
      emoji: "🚻",
      color: "#94a3b8"
    }, {
      type: "charge",
      label: "Charge",
      emoji: "⚡",
      color: "#facc15"
    }, {
      type: "locker",
      label: "Locker",
      emoji: "🔒",
      color: "#a78bfa"
    }].map(c => React.createElement("button", {
      key: c.type,
      onClick: () => {
        var matches = (typeof AMENITIES !== "undefined" ? AMENITIES : []).filter(a => a.type === c.type);
        if (!matches.length) return;
        var nearest = matches.map(a => ({
          ...a,
          _d: Math.hypot(a.x - avatar.x, a.y - avatar.y)
        })).sort((a, b) => a._d - b._d)[0];
        setMeetTarget({
          x: nearest.x,
          y: nearest.y,
          label: nearest.label,
          isAmenity: true
        });
        setMeetMode(true);
        setSearchSheetExpanded(false);
      },
      className: "mono",
      style: {
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        background: "var(--paper-2)",
        border: `1px solid ${c.color}55`,
        color: "var(--ink)",
        cursor: "pointer",
        fontSize: 10,
        letterSpacing: 1.1,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13,
        lineHeight: 1
      }
    }, c.emoji), React.createElement("span", null, c.label.toUpperCase()))))), savedStages.size > 0 && React.createElement("div", {
      style: {
        padding: "0 10px 6px"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--muted)",
        fontWeight: 700,
        padding: "0 2px 5px"
      }
    }, "SAVED SPOTS"), React.createElement("div", {
      className: "no-scrollbar",
      style: {
        display: "flex",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
        paddingBottom: 2
      }
    }, STAGES.filter(s => savedStages.has(s.id)).map(s => React.createElement("button", {
      key: `saved-${s.id}`,
      onClick: () => {
        setSelectedStage(s.id);
        setPeek(false);
        setSearchSheetExpanded(false);
      },
      "aria-label": `Open ${s.name}`,
      className: "mono",
      style: {
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        background: "var(--paper-2)",
        border: `1px solid ${s.color}66`,
        color: "var(--ink)",
        cursor: "pointer",
        fontSize: 10,
        letterSpacing: 1.1,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }
    }, React.createElement("span", {
      style: {
        color: "var(--ember)",
        fontSize: 11,
        lineHeight: 1
      }
    }, "♥"), React.createElement("span", null, s.name.toUpperCase()))))), React.createElement("div", {
      style: {
        padding: "4px 8px 8px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderTop: "1px solid var(--line)",
        flexShrink: 0
      }
    }, React.createElement("button", {
      onClick: () => {
        if (meetMode) {
          clearMeet();
        } else {
          setMeetMode(true);
        }
      },
      style: {
        background: meetMode ? "var(--ember)" : "var(--ink)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: "6px 11px",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.3,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0
      }
    }, meetMode ? "× CANCEL" : "MEET UP"), React.createElement("button", {
      onClick: () => setMoreOpen(o => !o),
      "aria-label": "More options",
      "aria-pressed": moreOpen,
      style: {
        background: moreOpen ? "var(--ink)" : "var(--paper-2)",
        color: moreOpen ? "var(--paper)" : "var(--ink)",
        border: moreOpen ? "none" : "1px solid var(--line-2)",
        borderRadius: 999,
        width: 32,
        height: 26,
        padding: 0,
        cursor: "pointer",
        flexShrink: 0,
        fontSize: 16,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, "⋯"), React.createElement("div", {
      className: "no-scrollbar",
      style: {
        display: "flex",
        gap: 5,
        overflowX: "auto",
        flex: 1,
        scrollbarWidth: "none"
      }
    }, friends.map(f => {
      var d = Math.round(Math.sqrt((f.x - avatar.x) ** 2 + (f.y - avatar.y) ** 2) * 1.8);
      var active = meetGroup.includes(f.id);
      return React.createElement("button", {
        key: f.id,
        onClick: () => {
          if (meetMode) {
            toggleGroupMember(f.id);
            return;
          }
          setChatFriend(f);
        },
        style: {
          position: "relative",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px 3px 3px",
          borderRadius: 999,
          background: active ? f.color : "var(--paper-2)",
          border: `1px solid ${active ? f.color : "var(--line-2)"}`,
          color: active ? "#fff" : "var(--ink)",
          cursor: "pointer",
          fontFamily: "Geist Mono, monospace",
          fontSize: 9,
          letterSpacing: 0.4,
          fontWeight: 600
        }
      }, React.createElement("span", {
        style: {
          width: 14,
          height: 14,
          borderRadius: 14,
          background: f.avatarTone,
          border: "1.2px solid #fff",
          flexShrink: 0
        }
      }), f.name.toUpperCase(), "·", d, "M", unreadCount(f.id) > 0 && !meetMode && React.createElement("span", {
        style: {
          position: "absolute",
          top: -3,
          right: -3,
          minWidth: 14,
          height: 14,
          padding: "0 4px",
          background: "var(--ember)",
          color: "#fff",
          borderRadius: 14,
          fontSize: 8,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1.5px solid var(--paper)"
        }
      }, unreadCount(f.id)));
    }), crewFriends.map(f => {
      var st = STAGES.find(s => s.id === f.stageId);
      var minsAgo = f.ts ? Math.floor((Date.now() - f.ts) / 60000) : null;
      var age = minsAgo == null ? "" : minsAgo < 1 ? " · now" : ` · ${minsAgo}m`;
      return React.createElement("button", {
        key: f.id,
        onClick: () => setChatFriend({
          id: f.id,
          presId: f.id,
          name: f.name,
          avatarTone: f.color,
          x: f.x,
          y: f.y
        }),
        style: {
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 8px 3px 5px",
          borderRadius: 999,
          background: `${f.color}22`,
          border: `1px solid ${f.color}`,
          fontFamily: "Geist Mono, monospace",
          fontSize: 9,
          letterSpacing: 0.4,
          fontWeight: 600,
          color: "var(--ink)",
          cursor: "pointer"
        }
      }, React.createElement("span", {
        style: {
          width: 7,
          height: 7,
          borderRadius: 7,
          background: f.color,
          animation: "pulse 1.6s infinite",
          flexShrink: 0
        }
      }), f.name.toUpperCase(), React.createElement("span", {
        style: {
          fontSize: 8,
          opacity: 0.7,
          letterSpacing: 0.8,
          color: st?.color
        }
      }, st?.short || "", age));
    })))));
  })(), useRealMap ? React.createElement(RealMap, {
    avatar: avatar,
    stages: PLACED_STAGES,
    officialMap: !!FESTIVAL_CONFIG.mapImage,
    crewFriends: crewFriends,
    saved: state.saved,
    showHeat: showHeat,
    showLabels: showLabels,
    compass: compass && compassStatus === "live",
    compassHeading: compassHeading,
    selected: selectedStage,
    meetMode: meetMode,
    meetTarget: meetTarget,
    onPickStage: id => {
      setSelectedStage(id);
      setPeek(false);
    },
    onMapClick: xy => {
      if (!meetMode) return;
      var names = meetGroup.map(id => friends.find(f => f.id === id)?.name).filter(Boolean);
      setMeetTarget({
        x: xy.x,
        y: xy.y,
        label: names.length ? `Meet ${names.join(" + ")}` : "Meet here"
      });
    },
    onFatal: _disableRealMap
  }) : React.createElement(TopDownMap, {
    avatar: avatar,
    heading: heading,
    friends: friends,
    stages: PLACED_STAGES,
    saved: state.saved,
    showLabels: showLabels,
    showHeat: showHeat,
    showAmenities: searchSheetExpanded || amenityKey,
    amenityFilter: amenityKey ? amenityFilter : null,
    compass: compass && compassStatus === "live",
    compassHeading: compassHeading,
    selected: selectedStage,
    meetMode: meetMode,
    meetTarget: meetTarget,
    meetGroup: meetGroup,
    crewFriends: crewFriends,
    zoom: mapZoom,
    pan: mapPan,
    zoomMin: MAP_ZOOM_MIN,
    zoomMax: MAP_ZOOM_MAX,
    onZoomChange: setMapZoom,
    onPanChange: setMapPan,
    onPickStage: id => {
      setSelectedStage(id);
      setPeek(false);
    },
    onClick: handleMapClick
  }), realMapNote && React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 4,
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(245,154,54,0.95)",
      color: "#fff",
      backdropFilter: "blur(8px)",
      maxWidth: "88%",
      textAlign: "center"
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, realMapNote.toUpperCase())), stage && peek && React.createElement(GroundPeek, {
    stage: stage,
    onClose: () => setPeek(false)
  }), meetMode && React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      background: meetTarget ? "var(--ember)" : "rgba(26,18,13,0.92)",
      color: "#fff",
      padding: "10px 14px",
      paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700,
      boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      zIndex: 8,
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "springIn 0.3s ease-out"
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 7
    }
  }, meetTarget ? React.createElement(React.Fragment, null, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 7,
      background: "#fff",
      animation: "pulse 1.4s infinite"
    }
  }), meetTarget.isAmenity ? `→ ${meetTarget.label.toUpperCase()}` : `${meetTarget.label.toUpperCase()} · ${meetGroup.length > 1 ? `GROUP (${meetGroup.length + 1})` : "BOTH"} WALKING`) : meetGroup.length ? "TAP THE MAP TO DROP A PIN" : "MEET MODE — TAP MAP TO DROP A PIN"), meetTarget && isSharing && React.createElement("button", {
    onClick: () => {
      var ok = sbBroadcastRally({
        x: meetTarget.x,
        y: meetTarget.y,
        label: meetTarget.label,
        stageId: meetTarget.stageId || _nearestStageId(meetTarget.x, meetTarget.y)
      });
      if (ok) setRallySent(true);
    },
    disabled: rallySent,
    style: {
      background: rallySent ? "rgba(255,255,255,0.25)" : "#fff",
      color: rallySent ? "#fff" : "var(--ember)",
      border: "none",
      borderRadius: 999,
      padding: "5px 12px",
      cursor: rallySent ? "default" : "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800
    }
  }, rallySent ? "✓ CREW PINGED" : "📣 RALLY CREW"), React.createElement("button", {
    onClick: clearMeet,
    style: {
      background: "rgba(255,255,255,0.2)",
      border: "none",
      borderRadius: 999,
      padding: "5px 12px",
      color: "#fff",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "× CANCEL")), incomingRally && React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9,
      background: "linear-gradient(135deg, #7b3d9a, var(--ember))",
      color: "#fff",
      padding: "10px 14px",
      paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "springIn 0.3s ease-out"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "📣"), React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      display: "block",
      fontSize: 8.5,
      letterSpacing: 1.3,
      fontWeight: 800,
      opacity: 0.85
    }
  }, (incomingRally.fromName || "CREW").toUpperCase(), " WANTS TO MEET"), React.createElement("span", {
    style: {
      display: "block",
      fontSize: 13,
      fontWeight: 700,
      marginTop: 1,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, incomingRally.label, minsAwaySuffix(Math.hypot(incomingRally.x - avatar.x, incomingRally.y - avatar.y), avatar))), React.createElement("button", {
    onClick: () => {
      dismissedRallyRef.current.add(incomingRally.rallyId);
      setMeetMode(true);
      setMeetTarget({
        x: incomingRally.x,
        y: incomingRally.y,
        label: incomingRally.label,
        isRally: true
      });
      setIncomingRally(null);
    },
    className: "mono",
    style: {
      background: "#fff",
      color: "var(--ember)",
      border: "none",
      borderRadius: 999,
      padding: "6px 13px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800,
      flexShrink: 0
    }
  }, "HEAD OVER"), React.createElement("button", {
    onClick: () => {
      dismissedRallyRef.current.add(incomingRally.rallyId);
      setIncomingRally(null);
    },
    "aria-label": "Dismiss",
    style: {
      background: "rgba(0,0,0,0.2)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      width: 26,
      height: 26,
      cursor: "pointer",
      fontSize: 12,
      flexShrink: 0
    }
  }, "✕")), (() => {
    if (!crewCluster || meetMode || incomingRally) return null;
    var sig = `${crewCluster.stage.id}:${crewCluster.members.length}`;
    if (sig === clusterDismissed) return null;
    var headOver = () => {
      setMeetMode(true);
      setMeetTarget({
        x: crewCluster.stage.x,
        y: crewCluster.stage.y,
        label: crewCluster.stage.name,
        stageId: crewCluster.stage.id
      });
      setClusterDismissed(sig);
    };
    return React.createElement("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 8,
        background: "linear-gradient(135deg, #2d7a55, #1a120d)",
        color: "#fff",
        padding: "10px 14px",
        paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation: "springIn 0.3s ease-out"
      }
    }, React.createElement("span", {
      style: {
        display: "flex",
        flexShrink: 0
      }
    }, crewCluster.members.slice(0, 3).map((m, i) => React.createElement("span", {
      key: m.id,
      style: {
        width: 22,
        height: 22,
        borderRadius: 22,
        background: m.color || "#888",
        border: "2px solid #1a120d",
        marginLeft: i ? -7 : 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        fontWeight: 800,
        color: "#fff",
        fontFamily: "Geist Mono, monospace"
      }
    }, (m.name || "?")[0].toUpperCase()))), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      className: "mono",
      style: {
        display: "block",
        fontSize: 8.5,
        letterSpacing: 1.3,
        fontWeight: 800,
        opacity: 0.8
      }
    }, "CREW GATHERED"), React.createElement("span", {
      style: {
        display: "block",
        fontSize: 13,
        fontWeight: 700,
        marginTop: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, crewCluster.members.length, " of your crew at ", crewCluster.stage.name)), React.createElement("button", {
      onClick: headOver,
      className: "mono",
      style: {
        background: "#fff",
        color: "#2d7a55",
        border: "none",
        borderRadius: 999,
        padding: "6px 13px",
        cursor: "pointer",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 800,
        flexShrink: 0
      }
    }, "HEAD OVER"), React.createElement("button", {
      onClick: () => setClusterDismissed(sig),
      "aria-label": "Dismiss",
      style: {
        background: "rgba(0,0,0,0.2)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        width: 26,
        height: 26,
        cursor: "pointer",
        fontSize: 12,
        flexShrink: 0
      }
    }, "✕"));
  })(), (stage || meetMode && meetTarget) && React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 6
    }
  }, stage && navigating ? React.createElement(StageNavBar, {
    stage: stage,
    walk: walk,
    onDetails: () => setNavigating(false),
    onStop: () => {
      setNavigating(false);
      setSelectedStage(null);
    }
  }) : React.createElement(BottomSheet, {
    stage: stage,
    nowAtStage: nowAtStage,
    dist: dist,
    walk: walk,
    peek: peek,
    setPeek: setPeek,
    meetMode: meetMode,
    meetTarget: meetTarget,
    friends: friends,
    meetGroup: meetGroup,
    avatar: avatar,
    onClose: () => setSelectedStage(null),
    onCancelMeet: clearMeet,
    onOpenArtist: id => setState({
      ...state,
      tab: "home",
      artist: id
    }),
    onGoHere: goToStage,
    stageSaved: stage ? savedStages.has(stage.id) : false,
    onToggleSave: toggleSavedStage,
    state: state,
    setState: setState
  })), moreOpen && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => setMoreOpen(false),
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 6
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: stage || meetMode ? 184 : 96,
      zIndex: 7,
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      borderRadius: 14,
      padding: 5,
      boxShadow: "0 10px 28px rgba(26,18,13,0.20)"
    }
  }, React.createElement("button", {
    onClick: () => {
      setPingOpen(true);
      setMoreOpen(false);
    },
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 11px",
      background: "transparent",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--ink)",
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      width: 18
    }
  }, "◉"), React.createElement("span", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500,
      flex: 1
    }
  }, "Ping code"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "SHARE / DROP")), React.createElement("button", {
    onClick: () => {
      setShareOpen(true);
      setMoreOpen(false);
    },
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 11px",
      background: isSharing ? "rgba(45,122,85,0.10)" : "transparent",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--ink)",
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 14,
      background: isSharing ? "var(--success)" : "var(--line-2)",
      animation: isSharing ? "pulse 1.6s infinite" : "none"
    }
  }), React.createElement("span", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500,
      flex: 1
    }
  }, "Share with crew", crewFriends.length > 0 ? ` · ${crewFriends.length}` : ""), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: isSharing ? "var(--success)" : "var(--muted)",
      fontWeight: 700
    }
  }, isSharing ? "ON" : "OFF")), (() => {
    var ms = myStatusStage ? STAGES.find(s => s.id === myStatusStage) : null;
    return React.createElement("button", {
      onClick: () => {
        setIAmAtOpen(true);
        setMoreOpen(false);
      },
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 11px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        color: "var(--ink)",
        textAlign: "left"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14,
        width: 18
      }
    }, "📍"), React.createElement("span", {
      style: {
        fontFamily: "Geist",
        fontSize: 13,
        fontWeight: 500,
        flex: 1
      }
    }, "I'm at…"), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700,
        color: ms ? ms.color : "var(--muted)"
      }
    }, ms ? ms.short : "PICK STAGE"));
  })(), React.createElement("button", {
    onClick: () => {
      setMeetupsOpen(true);
      setMoreOpen(false);
    },
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 11px",
      background: "transparent",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--ink)",
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      width: 18
    }
  }, "🗓"), React.createElement("span", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500,
      flex: 1
    }
  }, "Meetups"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: meetups.length ? "var(--ember)" : "var(--muted)",
      fontWeight: 700
    }
  }, meetups.length ? `${meetups.length} UPCOMING` : "NONE")), React.createElement("button", {
    onClick: () => {
      setRideshareOpen(true);
      setMoreOpen(false);
    },
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 11px",
      background: "transparent",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--ink)",
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      width: 18
    }
  }, "🚗"), React.createElement("span", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500,
      flex: 1
    }
  }, "Rideshare"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "UBER / LYFT")), surveyOn && React.createElement("button", {
    onClick: () => {
      setSurveyOpen(true);
      setMoreOpen(false);
    },
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 11px",
      background: "transparent",
      border: "none",
      borderTop: "1px solid var(--line)",
      borderRadius: 8,
      cursor: "pointer",
      color: "var(--ink)",
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      width: 18
    }
  }, "📐"), React.createElement("span", {
    style: {
      fontFamily: "Geist",
      fontSize: 13,
      fontWeight: 500,
      flex: 1
    }
  }, "Crowd survey"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--ember)",
      fontWeight: 700
    }
  }, "SURVEY MODE"))))), chatFriend && React.createElement(MessageDrawer, {
    friend: chatFriend,
    myPresId: myPresId,
    avatarStage: selectedStage,
    saved: state.saved,
    onClose: () => setChatFriend(null),
    onSwitchToMeet: () => {
      setMeetMode(true);
      setMeetGroup([chatFriend.id]);
      var f = friends.find(fr => fr.id === chatFriend.id);
      if (f) setMeetTarget({
        x: (avatar.x + f.x) / 2,
        y: (avatar.y + f.y) / 2,
        label: `Meet ${f.name}`
      });
      setChatFriend(null);
    }
  }), rideshareOpen && React.createElement(RideshareSheet, {
    onClose: () => setRideshareOpen(false)
  }), surveyOpen && React.createElement(SurveyPanel, {
    onClose: () => setSurveyOpen(false),
    nearestStageId: selectedStage
  }), pingOpen && React.createElement(PingSheet, {
    friends: friends,
    onClose: () => setPingOpen(false),
    onDropPin: target => {
      setMeetMode(true);
      setMeetTarget(target);
    }
  }), iAmAtOpen && React.createElement(IAmAtSheet, {
    initialStage: myStatusStage,
    onClose: () => setIAmAtOpen(false),
    onStatusSet: stageId => {
      setMyStatusStage(stageId);
    }
  }), shareOpen && React.createElement(ShareLocationSheet, {
    shareState: shareState,
    crewCount: crewFriends.length,
    crewCode: sbGetOrCreateGroupCode?.() || "",
    gpsPos: gpsPos,
    gpsStatus: gpsStatus,
    myStatusStage: myStatusStage,
    onClose: () => setShareOpen(false),
    onSave: s => setShareState(s),
    onStop: () => setShareState(null)
  }), meetupsOpen && React.createElement(MeetupsSheet, {
    onClose: () => setMeetupsOpen(false)
  }));
}
function StageIcon({
  id,
  cx,
  cy,
  r,
  on,
  color
}) {
  var op = on ? 1 : 0.92;
  var W = "rgba(255,255,255,0.94)";
  if (id === "kinetic") {
    var pts = [0, 1, 2, 3].map(i => {
      var a = i * Math.PI / 2 - Math.PI / 2;
      var tx = cx + r * 1.2 * Math.cos(a),
        ty = cy + r * 1.2 * Math.sin(a);
      return React.createElement("ellipse", {
        key: i,
        cx: tx,
        cy: ty,
        rx: r * 0.55,
        ry: r * 0.32,
        fill: color,
        opacity: op,
        transform: `rotate(${i * 90 + 90} ${tx} ${ty})`
      });
    });
    return React.createElement("g", null, pts, React.createElement("path", {
      d: `M ${cx},${cy - r * 0.7} L ${cx + r * 0.7},${cy} L ${cx},${cy + r * 0.7} L ${cx - r * 0.7},${cy} Z`,
      fill: W
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r * 0.3,
      fill: color
    }));
  }
  if (id === "circuit") {
    return React.createElement("g", null, React.createElement("rect", {
      x: cx - r * 1.05,
      y: cy - r * 0.7,
      width: r * 2.1,
      height: r * 1.4,
      rx: r * 0.3,
      fill: color,
      opacity: op
    }), React.createElement("rect", {
      x: cx - r * 0.75,
      y: cy - r * 0.18,
      width: r * 1.5,
      height: r * 0.36,
      fill: W
    }));
  }
  if (id === "basspod") {
    return React.createElement("g", null, React.createElement("path", {
      d: `M ${cx},${cy - r * 1.05} L ${cx + r},${cy + r * 0.7} L ${cx - r},${cy + r * 0.7} Z`,
      fill: color,
      opacity: op
    }), React.createElement("circle", {
      cx: cx,
      cy: cy + r * 0.1,
      r: r * 0.32,
      fill: W
    }), React.createElement("line", {
      x1: cx - r * 0.55,
      y1: cy + r * 0.55,
      x2: cx + r * 0.55,
      y2: cy + r * 0.55,
      stroke: W,
      strokeWidth: r * 0.15,
      strokeLinecap: "round"
    }));
  }
  if (id === "neon") {
    var _pts = [0, 1, 2, 3, 4, 5].map(i => {
      var a = i * Math.PI / 3 - Math.PI / 2;
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
    }).join(" ");
    return React.createElement("g", null, React.createElement("polygon", {
      points: _pts,
      fill: color,
      opacity: op
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r * 0.32,
      fill: W
    }));
  }
  if (id === "cosmic") {
    return React.createElement("g", null, [0, 60, 120, 180, 240, 300].map(deg => {
      var a = deg * Math.PI / 180;
      return React.createElement("line", {
        key: deg,
        x1: cx + r * 0.9 * Math.cos(a),
        y1: cy + r * 0.9 * Math.sin(a),
        x2: cx + r * 1.4 * Math.cos(a),
        y2: cy + r * 1.4 * Math.sin(a),
        stroke: color,
        strokeWidth: r * 0.22,
        strokeLinecap: "round",
        opacity: op
      });
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r * 0.85,
      fill: color,
      opacity: op
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r * 0.35,
      fill: W
    }));
  }
  if (id === "stereo") {
    return React.createElement("g", null, [0, 60, 120, 180, 240, 300].map(deg => {
      var a = deg * Math.PI / 180;
      var px = cx + r * 0.6 * Math.cos(a),
        py = cy + r * 0.6 * Math.sin(a);
      return React.createElement("ellipse", {
        key: deg,
        cx: px,
        cy: py,
        rx: r * 0.55,
        ry: r * 0.32,
        fill: color,
        opacity: on ? 0.95 : 0.85,
        transform: `rotate(${deg} ${px} ${py})`
      });
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r * 0.32,
      fill: W
    }));
  }
  if (id === "bionic") {
    return React.createElement("g", null, React.createElement("rect", {
      x: cx - r * 0.18,
      y: cy + r * 0.05,
      width: r * 0.36,
      height: r * 0.85,
      fill: color,
      opacity: op
    }), React.createElement("circle", {
      cx: cx,
      cy: cy - r * 0.18,
      r: r * 0.95,
      fill: color,
      opacity: op
    }), React.createElement("circle", {
      cx: cx - r * 0.3,
      cy: cy - r * 0.35,
      r: r * 0.32,
      fill: W,
      opacity: "0.6"
    }), React.createElement("circle", {
      cx: cx,
      cy: cy - r * 0.18,
      r: r * 0.32,
      fill: W
    }));
  }
  if (id === "quantum") {
    return React.createElement("g", null, React.createElement("path", {
      d: `M ${cx},${cy - r * 1.05} L ${cx + r},${cy + r * 0.65} L ${cx - r},${cy + r * 0.65} Z`,
      fill: color,
      opacity: op
    }), React.createElement("path", {
      d: `M ${cx - r * 0.55},${cy - r * 0.1} L ${cx + r * 0.55},${cy - r * 0.1} L ${cx},${cy + r * 0.5} Z`,
      fill: W,
      opacity: "0.92"
    }));
  }
  if (id === "waste") {
    var _pts2 = [];
    for (var i = 0; i < 16; i++) {
      var a = i * Math.PI / 8 - Math.PI / 2;
      var rad = i % 2 === 0 ? r : r * 0.62;
      _pts2.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
    }
    return React.createElement("g", null, React.createElement("polygon", {
      points: _pts2.join(" "),
      fill: color,
      opacity: op
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r * 0.32,
      fill: W
    }));
  }
  return React.createElement("g", null, React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: color,
    opacity: op
  }), React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r * 0.38,
    fill: W
  }));
}
var REAL_MAP_STYLES = {
  stylized: {
    label: "STYLIZED",
    url: "https://tiles.openfreemap.org/styles/liberty"
  },
  satellite: {
    label: "SATELLITE",
    style: {
      version: 8,
      sources: {
        sat: {
          type: "raster",
          tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery © Esri, Maxar"
        }
      },
      layers: [{
        id: "sat",
        type: "raster",
        source: "sat"
      }]
    }
  }
};
function _ensureRealMapStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("plursky-realmap-styles")) return;
  var el = document.createElement("style");
  el.id = "plursky-realmap-styles";
  el.textContent = ["@keyframes plursky-stage-pulse {", "  0%,100% { transform: scale(1); }", "  50%     { transform: scale(1.35); }", "}", "@keyframes plursky-halo-pulse {", "  0%   { transform: scale(0.7); opacity: 0.55; }", "  100% { transform: scale(2.2); opacity: 0; }", "}", ".plursky-stage-selected { animation: plursky-stage-pulse 1.6s ease-in-out infinite; }", ".plursky-avatar-halo {", "  position: absolute; top: 50%; left: 50%;", "  width: 40px; height: 40px; margin: -20px 0 0 -20px;", "  border-radius: 999px; background: rgba(245,154,54,0.55);", "  animation: plursky-halo-pulse 2.2s ease-out infinite;", "  pointer-events: none;", "}"].join("\n");
  document.head.appendChild(el);
}
var _mapLibrePromise = null;
function _loadMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (_mapLibrePromise) return _mapLibrePromise;
  _mapLibrePromise = new Promise((resolve, reject) => {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(css);
    var s = document.createElement("script");
    s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
    s.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibregl missing"));
    s.onerror = () => reject(new Error("script load failed"));
    document.head.appendChild(s);
  });
  return _mapLibrePromise;
}
function mapToGps(x, y) {
  if (!MAP_AFFINE) return {
    lat: FESTIVAL_CONFIG.gps.lat,
    lng: FESTIVAL_CONFIG.gps.lng
  };
  var A = MAP_AFFINE.x;
  var B = MAP_AFFINE.y;
  var det = A[0] * B[1] - A[1] * B[0];
  var lat = (B[1] * (x - A[2]) - A[1] * (y - B[2])) / det;
  var lng = (-B[0] * (x - A[2]) + A[0] * (y - B[2])) / det;
  return {
    lat,
    lng
  };
}
function _officialMapExtent(natW, natH) {
  if (!natW || !natH) return {
    x0: 0,
    y0: 0,
    x1: 100,
    y1: 100
  };
  var scale = Math.max(100 / natW, 100 / natH);
  var w = natW * scale,
    h = natH * scale;
  var x0 = (100 - w) / 2,
    y0 = (100 - h) / 2;
  return {
    x0,
    y0,
    x1: x0 + w,
    y1: y0 + h
  };
}
var _imgDimsCache = {};
function _officialMapDims(src) {
  if (_imgDimsCache[src]) return _imgDimsCache[src];
  _imgDimsCache[src] = new Promise(resolve => {
    var im = new Image();
    im.onload = () => resolve({
      w: im.naturalWidth,
      h: im.naturalHeight
    });
    im.onerror = () => resolve(null);
    im.src = src;
  });
  return _imgDimsCache[src];
}
function _officialMapCorners(natW, natH) {
  var e = _officialMapExtent(natW, natH);
  var pt = (x, y) => {
    var {
      lat,
      lng
    } = mapToGps(x, y);
    return [lng, lat];
  };
  return [pt(e.x0, e.y0), pt(e.x1, e.y0), pt(e.x1, e.y1), pt(e.x0, e.y1)];
}
function RealMap({
  avatar,
  stages,
  crewFriends = [],
  saved = [],
  showHeat = false,
  showLabels = false,
  officialMap = true,
  compass = false,
  compassHeading = 0,
  selected,
  meetMode = false,
  meetTarget,
  onPickStage,
  onMapClick,
  onFatal
}) {
  var containerRef = React.useRef(null);
  var mapRef = React.useRef(null);
  var stageMarkersRef = React.useRef({});
  var avatarMarkerRef = React.useRef(null);
  var meetMarkerRef = React.useRef(null);
  var savedStarMarkersRef = React.useRef({});
  var friendMarkersRef = React.useRef({});
  var landmarkElsRef = React.useRef([]);
  var officialMapDimsRef = React.useRef(null);
  var officialMapRef = React.useRef(officialMap);
  var showLabelsRef = React.useRef(showLabels);
  var onPickStageRef = React.useRef(onPickStage);
  var onMapClickRef = React.useRef(onMapClick);
  var meetModeRef = React.useRef(meetMode);
  var [loaded, setLoaded] = React.useState(false);
  var [err, setErr] = React.useState(null);
  var fatalRef = React.useRef(false);
  var loadedRef = React.useRef(false);
  var tileErrRef = React.useRef(0);
  var _fatal = React.useCallback(why => {
    if (fatalRef.current) return;
    fatalRef.current = true;
    console.warn("[plursky-map] fatal — falling back to SVG map:", why);
    try {
      onFatal?.(typeof why === "string" ? why : null);
    } catch {}
  }, [onFatal]);
  var [styleKey, setStyleKey] = React.useState(() => {
    try {
      return localStorage.getItem("plursky_real_map_style") || "satellite";
    } catch {
      return "satellite";
    }
  });
  var _applyLandmarkVisibility = React.useCallback(() => {
    var vis = showLabelsRef.current ? "" : "none";
    landmarkElsRef.current.forEach(el => {
      el.style.display = vis;
    });
  }, []);
  React.useEffect(() => {
    showLabelsRef.current = showLabels;
    _applyLandmarkVisibility();
  }, [showLabels, _applyLandmarkVisibility]);
  React.useEffect(() => {
    officialMapRef.current = officialMap;
    var map = mapRef.current;
    if (!map || !map.getLayer?.("official-map")) return;
    try {
      map.setLayoutProperty("official-map", "visibility", officialMap ? "visible" : "none");
    } catch {}
  }, [officialMap]);
  React.useEffect(() => {
    onPickStageRef.current = onPickStage;
  }, [onPickStage]);
  React.useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  React.useEffect(() => {
    meetModeRef.current = meetMode;
  }, [meetMode]);
  React.useEffect(() => {
    _ensureRealMapStyles();
    var cancelled = false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      console.warn("[plursky-map] offline at mount — skipping RealMap");
      _fatal("No network connection");
      return () => {};
    }
    var bootTimer = setTimeout(() => {
      if (!loadedRef.current && !fatalRef.current) _fatal("Real map timed out");
    }, 12000);
    _mapLog("[plursky-map] RealMap useEffect — calling _loadMapLibre()");
    _loadMapLibre().then(maplibregl => {
      _mapLog("[plursky-map] _loadMapLibre resolved — MapLibre loaded");
      if (cancelled || !containerRef.current) {
        console.warn("[plursky-map] aborted post-load: cancelled=" + cancelled + " hasContainer=" + !!containerRef.current);
        return;
      }
      var center = FESTIVAL_CONFIG.gps;
      var initialStyle = REAL_MAP_STYLES[styleKey] || REAL_MAP_STYLES.stylized;
      var map = new maplibregl.Map({
        container: containerRef.current,
        style: initialStyle.style || initialStyle.url,
        center: [center.lng, center.lat],
        zoom: 16.2,
        pitch: 18,
        bearing: 0,
        attributionControl: false
      });
      map.addControl(new maplibregl.AttributionControl({
        compact: true
      }), "bottom-right");
      mapRef.current = map;
      var _shapePolygon = (lat, lng, opts) => {
        var EARTH = 6378137;
        var out = [];
        var lngScale = 1 / Math.cos(lat * Math.PI / 180);
        var rot = (opts.rot || 0) * Math.PI / 180;
        var ax = opts.aspect && opts.aspect[0] || 1;
        var ay = opts.aspect && opts.aspect[1] || 1;
        var innerMult = opts.altInner;
        for (var i = 0; i <= opts.sides; i++) {
          var a = i / opts.sides * 2 * Math.PI + rot;
          var r = innerMult != null && i % 2 === 1 ? opts.radius * innerMult : opts.radius;
          var dx = r * Math.cos(a) * ax;
          var dy = r * Math.sin(a) * ay;
          var dLat = dy / EARTH * (180 / Math.PI);
          var dLng = dx / EARTH * (180 / Math.PI) * lngScale;
          out.push([lng + dLng, lat + dLat]);
        }
        return [out];
      };
      var AMENITY_DESIGN = {
        water: {
          color: "#38bdf8",
          height: 14,
          radius: 5,
          sides: 8
        },
        food: {
          color: "#fb923c",
          height: 16,
          radius: 6,
          sides: 4,
          rot: 45
        },
        med: {
          color: "#ef4444",
          height: 18,
          radius: 6,
          sides: 4
        },
        toilet: {
          color: "#64748b",
          height: 12,
          radius: 5,
          sides: 6
        },
        art: {
          color: "#f59a36",
          height: 22,
          radius: 7,
          sides: 12,
          altInner: 0.5
        },
        info: {
          color: "#16a34a",
          height: 14,
          radius: 5,
          sides: 24
        },
        charge: {
          color: "#facc15",
          height: 16,
          radius: 5,
          sides: 4,
          rot: 22.5
        },
        locker: {
          color: "#a78bfa",
          height: 13,
          radius: 5,
          sides: 4
        }
      };
      var amenitiesExtrusionData = () => ({
        type: "FeatureCollection",
        features: (window.AMENITIES || []).map(a => {
          var {
            lat,
            lng
          } = mapToGps(a.x, a.y);
          var d = AMENITY_DESIGN[a.type] || AMENITY_DESIGN.info;
          return {
            type: "Feature",
            properties: {
              id: a.id,
              type: a.type,
              label: a.label,
              color: d.color,
              height: d.height
            },
            geometry: {
              type: "Polygon",
              coordinates: _shapePolygon(lat, lng, {
                sides: d.sides,
                radius: d.radius,
                rot: d.rot || 0,
                altInner: d.altInner
              })
            }
          };
        })
      });
      var SUB_LANDMARKS = FESTIVAL_CONFIG.landmarks || [];
      var STAGE_3D_DESIGN = {
        kinetic: {
          sides: 16,
          radius: 40,
          height: 32,
          rot: 0,
          altInner: 0.42
        },
        quantum: {
          sides: 3,
          radius: 30,
          height: 22,
          rot: 30
        },
        bionic: {
          sides: 24,
          radius: 24,
          height: 16,
          rot: 0
        },
        stereo: {
          sides: 12,
          radius: 22,
          height: 14,
          rot: 15,
          altInner: 0.55
        },
        cosmic: {
          sides: 12,
          radius: 28,
          height: 18,
          rot: 0,
          altInner: 0.62
        },
        neon: {
          sides: 6,
          radius: 26,
          height: 16,
          rot: 0
        },
        waste: {
          sides: 16,
          radius: 24,
          height: 18,
          rot: 0,
          altInner: 0.62
        },
        basspod: {
          sides: 4,
          radius: 22,
          height: 16,
          rot: 45
        },
        circuit: {
          sides: 4,
          radius: 30,
          height: 22,
          rot: 0,
          aspect: [1.4, 0.9]
        }
      };
      var _designFor = id => STAGE_3D_DESIGN[id] || {
        sides: 24,
        radius: 22,
        height: 16,
        rot: 0
      };
      var stagesExtrusionData = selectedId => {
        var feats = [];
        stages.forEach(s => {
          var {
            lat,
            lng
          } = mapToGps(s.x, s.y);
          var d = _designFor(s.id);
          var sel = s.id === selectedId;
          var r = d.radius * (sel ? 1.2 : 1.0);
          var h = d.height * (sel ? 1.6 : 1.0);
          var baseH = Math.max(8, h * 0.18);
          feats.push({
            type: "Feature",
            properties: {
              id: s.id,
              tier: "base",
              color: s.color,
              height: baseH,
              base: 0,
              opacity: sel ? 0.5 : 0.42
            },
            geometry: {
              type: "Polygon",
              coordinates: _shapePolygon(lat, lng, {
                sides: 8,
                radius: r * 1.45,
                rot: 22.5
              })
            }
          });
          feats.push({
            type: "Feature",
            properties: {
              id: s.id,
              tier: "main",
              color: s.color,
              height: h,
              base: baseH,
              opacity: sel ? 0.95 : 0.85
            },
            geometry: {
              type: "Polygon",
              coordinates: _shapePolygon(lat, lng, {
                sides: d.sides,
                radius: r,
                rot: d.rot,
                altInner: d.altInner,
                aspect: d.aspect
              })
            }
          });
        });
        return {
          type: "FeatureCollection",
          features: feats
        };
      };
      var grandstandFeature = () => {
        if (!FESTIVAL_CONFIG.venue?.ovalBounds) return null;
        var b = FESTIVAL_CONFIG.venue.ovalBounds;
        var inset = 0.0008;
        return {
          type: "Feature",
          properties: {
            color: "#3a2a55",
            height: 22
          },
          geometry: {
            type: "Polygon",
            coordinates: [[[b.west - inset, b.north + inset], [b.east + inset, b.north + inset], [b.east + inset, b.south - inset], [b.west - inset, b.south - inset], [b.west - inset, b.north + inset]], [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]]]
          }
        };
      };
      var applyPlurskyPalette = () => {
        try {
          var layers = map.getStyle().layers || [];
          layers.forEach(lyr => {
            var id = lyr.id || "";
            if (/water|river|ocean|lake/i.test(id) && lyr.type === "fill") {
              map.setPaintProperty(id, "fill-color", "#2a1a3d");
            }
            if (/(park|landuse|natural|grass|wood|forest)/i.test(id) && lyr.type === "fill") {
              map.setPaintProperty(id, "fill-color", "#1a120d");
              map.setPaintProperty(id, "fill-opacity", 0.22);
            }
            if (/(building|parking|housenum)/i.test(id) && (lyr.type === "fill" || lyr.type === "fill-extrusion")) {
              try {
                map.setLayoutProperty(id, "visibility", "none");
              } catch {}
            }
            if (lyr.type === "line" && /road|highway|street|motorway|primary|secondary|tertiary|service|bridge|tunnel|path/i.test(id)) {
              if (/motorway|primary|trunk/.test(id)) map.setPaintProperty(id, "line-color", "#e85d2e");else if (/secondary|tertiary/.test(id)) map.setPaintProperty(id, "line-color", "#f59a36");else map.setPaintProperty(id, "line-color", "rgba(247,237,224,0.35)");
            }
            if (lyr.type === "symbol") {
              try {
                map.setPaintProperty(id, "text-color", "rgba(247,237,224,0.85)");
              } catch {}
              try {
                map.setPaintProperty(id, "text-halo-color", "rgba(10,6,24,0.85)");
              } catch {}
            }
            if (lyr.type === "background") {
              map.setPaintProperty(id, "background-color", "#0a0618");
            }
          });
        } catch {}
      };
      var edcClipFeature = () => {
        if (!FESTIVAL_CONFIG.venue?.festivalBounds) return null;
        var b = FESTIVAL_CONFIG.venue.festivalBounds;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]]]
          }
        };
      };
      var _footprintRing = () => {
        var fp = FESTIVAL_CONFIG.venue?.footprint;
        if (!fp?.length || fp.length < 3) return null;
        var ring = fp.map(([lat, lng]) => [lng, lat]);
        var [f0, fN] = [ring[0], ring[ring.length - 1]];
        if (f0[0] !== fN[0] || f0[1] !== fN[1]) ring.push([f0[0], f0[1]]);
        return ring;
      };
      var _boundsRing = () => {
        var b = FESTIVAL_CONFIG.venue?.festivalBounds;
        if (!b) return null;
        return [[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south], [b.west, b.north]];
      };
      var festivalFootprint = () => {
        var ring = _footprintRing() || _boundsRing();
        if (!ring) return null;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [ring]
          }
        };
      };
      var _safeLayer = (id, fn) => {
        try {
          fn();
        } catch (e) {
          console.error(`[plursky-map] layer "${id}" failed:`, e);
        }
      };
      var setupOverlayLayers = () => {
        _mapLog("[plursky-map] setupOverlayLayers START — stages count:", stages?.length || 0);
        if (stages && stages.length) {
          var s0 = stages[0];
          var ll = mapToGps(s0.x, s0.y);
          _mapLog(`[plursky-map] stage[0] = id:${s0.id} svg(${s0.x},${s0.y}) → lat:${ll?.lat?.toFixed(5)} lng:${ll?.lng?.toFixed(5)}`);
        }
        applyPlurskyPalette();
        _safeLayer("outside-mask", () => {
          if (FESTIVAL_CONFIG.mapMode === "real") return;
          var _hole = _footprintRing() || _boundsRing();
          if (!_hole) return;
          var _maskFeature = () => {
            var xs = _hole.map(p => p[0]),
              ys = _hole.map(p => p[1]);
            var cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            var cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            var big = 0.02;
            return {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [[[cx - big, cy - big], [cx + big, cy - big], [cx + big, cy + big], [cx - big, cy + big], [cx - big, cy - big]], _hole]
              }
            };
          };
          if (!map.getSource("outside-mask")) {
            map.addSource("outside-mask", {
              type: "geojson",
              data: _maskFeature()
            });
          }
          if (!map.getLayer("outside-mask")) {
            map.addLayer({
              id: "outside-mask",
              type: "fill",
              source: "outside-mask",
              paint: {
                "fill-color": "#eee0cb",
                "fill-opacity": 0.97,
                "fill-antialias": true
              }
            });
          }
        });
        _safeLayer("festival-floor", () => {
          var fp = festivalFootprint();
          if (!fp) return;
          if (!map.getSource("festival-floor")) {
            map.addSource("festival-floor", {
              type: "geojson",
              data: fp
            });
          }
          if (!map.getLayer("festival-floor")) {
            map.addLayer({
              id: "festival-floor",
              type: "fill",
              source: "festival-floor",
              paint: {
                "fill-color": "#1a1030",
                "fill-opacity": 0.30,
                "fill-antialias": true
              }
            });
          }
        });
        var stageZonesData = () => ({
          type: "FeatureCollection",
          features: stages.map(s => {
            var {
              lat,
              lng
            } = mapToGps(s.x, s.y);
            return {
              type: "Feature",
              properties: {
                id: s.id,
                color: s.color
              },
              geometry: {
                type: "Polygon",
                coordinates: _shapePolygon(lat, lng, {
                  sides: 36,
                  radius: 70
                })
              }
            };
          })
        });
        var _addOfficialMap = () => {
          if (FESTIVAL_CONFIG.mapStyle !== "image-overlay" || !FESTIVAL_CONFIG.mapImage) return;
          if (!MAP_AFFINE) return;
          var dims = officialMapDimsRef.current;
          if (!dims) return;
          var src = FESTIVAL_CONFIG.mapImage;
          var coordinates = _officialMapCorners(dims.w, dims.h);
          if (!map.getSource("official-map")) {
            map.addSource("official-map", {
              type: "image",
              url: src,
              coordinates
            });
          } else {
            try {
              map.getSource("official-map").setCoordinates(coordinates);
            } catch {}
          }
          if (!map.getLayer("official-map")) {
            var below = ["stage-zones", "plaza", "route-line", "stages-3d"].find(id => map.getLayer(id));
            map.addLayer({
              id: "official-map",
              type: "raster",
              source: "official-map",
              layout: {
                visibility: officialMapRef.current ? "visible" : "none"
              },
              paint: {
                "raster-opacity": FESTIVAL_CONFIG.mapTheme === "park" ? 0.92 : 0.78,
                "raster-fade-duration": 0,
                "raster-resampling": "linear"
              }
            }, below);
            _mapLog("[plursky-map] official-map added", src, dims.w + "x" + dims.h, below ? "below " + below : "(top — no overlay layers yet)");
          }
        };
        _safeLayer("official-map", _addOfficialMap);
        if (!officialMapDimsRef.current && FESTIVAL_CONFIG.mapImage) {
          _officialMapDims(FESTIVAL_CONFIG.mapImage).then(d => {
            if (cancelled || !d || !mapRef.current) return;
            officialMapDimsRef.current = d;
            _safeLayer("official-map", _addOfficialMap);
          });
        }
        _safeLayer("stage-zones", () => {
          var _zd = stageZonesData();
          _mapLog("[plursky-map] stage-zones features:", _zd.features.length, "first poly verts:", _zd.features[0]?.geometry?.coordinates?.[0]?.length || 0);
          if (!map.getSource("stage-zones")) {
            map.addSource("stage-zones", {
              type: "geojson",
              data: _zd
            });
          }
          if (!map.getLayer("stage-zones")) {
            map.addLayer({
              id: "stage-zones",
              source: "stage-zones",
              type: "fill",
              paint: {
                "fill-color": ["get", "color"],
                "fill-opacity": 0.20,
                "fill-antialias": true
              }
            });
          }
        });
        var _centroidLatLng = (() => {
          var pts = stages.map(s => mapToGps(s.x, s.y));
          var lat = pts.reduce((sum, p) => sum + p.lat, 0) / pts.length;
          var lng = pts.reduce((sum, p) => sum + p.lng, 0) / pts.length;
          return {
            lat,
            lng
          };
        })();
        var plazaData = () => ({
          type: "Feature",
          properties: {
            name: "Daisy Lane"
          },
          geometry: {
            type: "Polygon",
            coordinates: _shapePolygon(_centroidLatLng.lat, _centroidLatLng.lng, {
              sides: 8,
              radius: 22
            })
          }
        });
        _safeLayer("plaza", () => {
          if (!map.getSource("plaza")) {
            map.addSource("plaza", {
              type: "geojson",
              data: plazaData()
            });
          }
          if (!map.getLayer("plaza")) {
            map.addLayer({
              id: "plaza",
              source: "plaza",
              type: "fill",
              paint: {
                "fill-color": "#e85d2e",
                "fill-opacity": 0.18,
                "fill-antialias": true
              }
            });
          }
          if (!map.getLayer("plaza-stroke")) {
            map.addLayer({
              id: "plaza-stroke",
              source: "plaza",
              type: "line",
              paint: {
                "line-color": "#e85d2e",
                "line-width": 1.5,
                "line-opacity": 0.55
              }
            });
          }
        });
        if (!map.getSource("crowd-heat")) {
          map.addSource("crowd-heat", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: []
            }
          });
        }
        if (!map.getLayer("crowd-heat")) {
          map.addLayer({
            id: "crowd-heat",
            source: "crowd-heat",
            type: "heatmap",
            layout: {
              visibility: "none"
            },
            paint: {
              "heatmap-weight": ["interpolate", ["linear"], ["get", "density"], 0, 0, 1, 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 14, 1.0, 17, 2.8],
              "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "rgba(251,191,36,0.35)", 0.5, "rgba(249,115,22,0.65)", 0.8, "rgba(239,68,68,0.85)", 1.0, "rgba(239,68,68,0.95)"],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 14, 26, 17, 78],
              "heatmap-opacity": 0.72
            }
          });
        }
        _safeLayer("stages-3d", () => {
          var _sd = stagesExtrusionData(null);
          _mapLog("[plursky-map] stages-3d features:", _sd.features.length);
          if (!map.getSource("stages-3d")) {
            map.addSource("stages-3d", {
              type: "geojson",
              data: _sd
            });
          }
          if (!map.getLayer("stages-3d-base")) {
            map.addLayer({
              id: "stages-3d-base",
              source: "stages-3d",
              type: "fill-extrusion",
              filter: ["==", ["get", "tier"], "base"],
              paint: {
                "fill-extrusion-color": ["get", "color"],
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "base"],
                "fill-extrusion-opacity": 0.45
              }
            });
          }
          if (!map.getLayer("stages-3d")) {
            map.addLayer({
              id: "stages-3d",
              source: "stages-3d",
              type: "fill-extrusion",
              filter: ["==", ["get", "tier"], "main"],
              paint: {
                "fill-extrusion-color": ["get", "color"],
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "base"],
                "fill-extrusion-opacity": 0.88
              }
            });
            map.on("click", "stages-3d", e => {
              var f = e.features && e.features[0];
              if (f && onPickStageRef.current) onPickStageRef.current(f.properties.id);
            });
            map.on("mouseenter", "stages-3d", () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", "stages-3d", () => {
              map.getCanvas().style.cursor = "";
            });
          }
        });
        ["outside-mask", "festival-floor", "stage-zones", "plaza", "plaza-stroke", "stages-3d-base", "stages-3d", "route"].forEach(id => {
          try {
            if (map.getLayer(id)) map.moveLayer(id);
          } catch (e) {
            console.error(`[plursky-map] moveLayer "${id}" failed:`, e);
          }
        });
        try {
          var existing = (map.getStyle().layers || []).filter(l => /festival|stage|plaza|route/.test(l.id)).map(l => `${l.id}(${l.type})`);
          _mapLog("[plursky-map] my layers after setup:", existing.join(", ") || "(none)");
        } catch (e) {
          console.error("[plursky-map] getStyle failed:", e);
        }
        _mapLog("[plursky-map] setupOverlayLayers END");
        if (!map.getSource("route")) {
          map.addSource("route", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: []
              }
            }
          });
        }
        if (!map.getLayer("route")) {
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: {
              "line-cap": "round",
              "line-join": "round"
            },
            paint: {
              "line-color": "#e85d2e",
              "line-width": 4,
              "line-opacity": 0.9,
              "line-dasharray": [2, 1.5]
            }
          });
        }
        try {
          (map.getStyle().layers || []).forEach(lyr => {
            if (lyr.type === "symbol") map.setLayoutProperty(lyr.id, "visibility", "none");
          });
        } catch {}
      };
      map.on("load", () => {
        _mapLog("[plursky-map] map.on('load') fired");
        if (cancelled) return;
        if (FESTIVAL_CONFIG.venue?.festivalBounds) {
          var b = FESTIVAL_CONFIG.venue.festivalBounds;
          map.setMaxBounds([[b.west - 0.004, b.south - 0.004], [b.east + 0.004, b.north + 0.004]]);
        }
        SUB_LANDMARKS.forEach(lm => {
          var {
            lat,
            lng
          } = mapToGps(lm.x, lm.y);
          var el = document.createElement("div");
          el.style.cssText = "font-family:'Geist Mono',monospace;font-weight:700;" + "font-size:9px;letter-spacing:1.4px;white-space:nowrap;" + `color:${lm.color};` + "text-shadow:0 1px 6px rgba(0,0,0,0.85);" + "pointer-events:none;" + `transform:rotate(${lm.rot}deg);`;
          el.textContent = lm.label;
          landmarkElsRef.current.push(el);
          new maplibregl.Marker({
            element: el,
            anchor: "center"
          }).setLngLat([lng, lat]).addTo(map);
        });
        _applyLandmarkVisibility();
        stages.forEach(s => {
          var {
            lat,
            lng
          } = mapToGps(s.x, s.y);
          var pill = document.createElement("div");
          pill.style.cssText = "background:rgba(247,237,224,0.96);color:#1a120d;" + `border:2px solid ${s.color};` + "padding:4px 11px;border-radius:999px;" + "font-family:'Geist Mono',monospace;font-size:10.5px;" + "letter-spacing:1.1px;font-weight:800;white-space:nowrap;" + "box-shadow:0 4px 12px rgba(0,0,0,0.45);" + "pointer-events:auto;cursor:pointer;" + "transform:translate(0,-44px);";
          pill.textContent = s.name.toUpperCase();
          pill.onclick = () => onPickStageRef.current && onPickStageRef.current(s.id);
          stageMarkersRef.current[s.id] = new maplibregl.Marker({
            element: pill,
            anchor: "center"
          }).setLngLat([lng, lat]).addTo(map);
        });
        _mapLog("[plursky-map] stage name pills added:", stages.length);
        var avWrap = document.createElement("div");
        avWrap.style.cssText = "position:relative;width:18px;height:18px;pointer-events:none;";
        var halo = document.createElement("div");
        halo.className = "plursky-avatar-halo";
        var avDot = document.createElement("div");
        avDot.style.cssText = "position:absolute;inset:0;border-radius:999px;" + "background:#f59a36;border:2px solid rgba(255,255,255,0.95);" + "box-shadow:0 0 16px rgba(245,154,54,0.9),0 2px 6px rgba(0,0,0,0.5);";
        avWrap.appendChild(halo);
        avWrap.appendChild(avDot);
        var avLatLng = mapToGps(avatar.x, avatar.y);
        avatarMarkerRef.current = new maplibregl.Marker({
          element: avWrap
        }).setLngLat([avLatLng.lng, avLatLng.lat]).addTo(map);
        setupOverlayLayers();
        loadedRef.current = true;
        setLoaded(true);
      });
      map.on("styledata", () => {
        if (cancelled || !mapRef.current) return;
        setupOverlayLayers();
      });
      map.on("click", e => {
        if (!meetModeRef.current || !onMapClickRef.current) return;
        var hits = map.queryRenderedFeatures(e.point, {
          layers: ["stages-3d"]
        });
        if (hits && hits.length) return;
        var ll = e.lngLat;
        var xy = mapToGps && typeof gpsToMap === "function" ? gpsToMap(ll.lat, ll.lng) : null;
        if (!xy) return;
        onMapClickRef.current({
          x: Math.max(2, Math.min(98, xy.x)),
          y: Math.max(2, Math.min(98, xy.y))
        });
      });
      map.on("error", e => {
        if (cancelled) return;
        var msg = e && e.error && e.error.message || "tile load failed";
        console.error("[plursky-map] MapLibre error:", msg, e?.error || e);
        setErr(prev => prev || msg);
        tileErrRef.current += 1;
        if (tileErrRef.current >= 6 && !loadedRef.current) _fatal("Real map tiles are failing");
      });
    }).catch(e => {
      console.error("[plursky-map] _loadMapLibre rejected:", e?.message || e, e);
      if (!cancelled) {
        setErr(e.message || "library failed to load");
        _fatal("Map library failed to load");
      }
    });
    return () => {
      clearTimeout(bootTimer);
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
      stageMarkersRef.current = {};
      avatarMarkerRef.current = null;
      friendMarkersRef.current = {};
      savedStarMarkersRef.current = {};
      meetMarkerRef.current = null;
    };
  }, []);
  React.useEffect(() => {
    if (!loaded || !avatarMarkerRef.current) return;
    var {
      lat,
      lng
    } = mapToGps(avatar.x, avatar.y);
    avatarMarkerRef.current.setLngLat([lng, lat]);
  }, [loaded, avatar.x, avatar.y]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current || !window.maplibregl) return;
    var map = mapRef.current;
    var live = friendMarkersRef.current;
    var seenIds = new Set();
    crewFriends.forEach(f => {
      seenIds.add(f.id);
      var lat = f.gps?.lat ?? mapToGps(f.x, f.y).lat;
      var lng = f.gps?.lng ?? mapToGps(f.x, f.y).lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      var seen = formatLastSeen(f.ts);
      var initial = (f.name?.[0] || "?").toUpperCase();
      var sig = `${initial}|${f.color}|${seen.color}|${seen.freshness}|${seen.label}|${f.name}`;
      var entry = live[f.id];
      if (!entry) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;";
        entry = {
          marker: new window.maplibregl.Marker({
            element: wrap,
            anchor: "bottom"
          }).setLngLat([lng, lat]).addTo(map),
          wrap,
          sig: ""
        };
        live[f.id] = entry;
      }
      if (entry.sig !== sig) {
        entry.wrap.innerHTML = `<div style="width:30px;height:30px;border-radius:999px;background:${f.color};` + `border:2px solid rgba(255,255,255,0.95);box-shadow:0 3px 12px ${f.color}aa,0 0 0 1px rgba(0,0,0,0.4);` + `display:flex;align-items:center;justify-content:center;color:#fff;` + `font-family:'Instrument Serif',serif;font-size:17px;line-height:1;` + `opacity:${seen.freshness === "cold" ? 0.78 : 1};">${initial}</div>` + `<div style="display:flex;align-items:center;gap:4px;` + `background:rgba(6,4,18,0.86);color:#fff;` + `border:1px solid rgba(255,255,255,0.18);` + `padding:2px 7px;border-radius:999px;` + `font-family:'Geist Mono',monospace;font-size:8px;letter-spacing:1.1px;` + `font-weight:700;white-space:nowrap;">` + `<span style="width:5px;height:5px;border-radius:5px;background:${seen.color};` + `${seen.freshness === "fresh" ? "animation:pulse 1.6s infinite;" : ""}"></span>` + `${f.name.toUpperCase()}${seen.label && seen.freshness !== "fresh" ? ` · ${seen.label}` : ""}` + `</div>`;
        entry.sig = sig;
      }
      entry.marker.setLngLat([lng, lat]);
    });
    Object.keys(live).forEach(id => {
      if (!seenIds.has(id)) {
        try {
          live[id].marker.remove();
        } catch {}
        delete live[id];
      }
    });
  }, [loaded, crewFriends]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    var src = mapRef.current.getSource("stages-3d");
    if (src && mapRef.current._plurskyExtrusionData) {
      src.setData(mapRef.current._plurskyExtrusionData(selected));
    }
    if (!selected) return;
    var s = stages.find(st => st.id === selected);
    if (!s) return;
    var {
      lat,
      lng
    } = mapToGps(s.x, s.y);
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 16.6,
      pitch: 58,
      duration: 1400,
      essential: true
    });
  }, [loaded, selected, stages]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    try {
      mapRef.current.easeTo({
        bearing: compass ? -compassHeading : 0,
        duration: 220
      });
    } catch {}
  }, [loaded, compass, compassHeading]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current || !window.maplibregl) return;
    if (!meetTarget) {
      if (meetMarkerRef.current) {
        try {
          meetMarkerRef.current.remove();
        } catch {}
        meetMarkerRef.current = null;
      }
      return;
    }
    var {
      lat,
      lng
    } = mapToGps(meetTarget.x, meetTarget.y);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!meetMarkerRef.current) {
      var wrap = document.createElement("div");
      wrap.style.cssText = "position:relative;width:22px;height:22px;pointer-events:none;";
      var halo = document.createElement("div");
      halo.className = "plursky-avatar-halo";
      halo.style.background = "rgba(232,93,46,0.55)";
      var dot = document.createElement("div");
      dot.style.cssText = "position:absolute;inset:0;border-radius:999px;" + "background:var(--ember,#e85d2e);border:2px solid rgba(255,255,255,0.95);" + "box-shadow:0 0 18px rgba(232,93,46,0.85),0 2px 6px rgba(0,0,0,0.55);";
      wrap.appendChild(halo);
      wrap.appendChild(dot);
      meetMarkerRef.current = new window.maplibregl.Marker({
        element: wrap
      }).setLngLat([lng, lat]).addTo(mapRef.current);
    } else {
      meetMarkerRef.current.setLngLat([lng, lat]);
    }
  }, [loaded, meetTarget?.x, meetTarget?.y]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current || !window.maplibregl) return;
    var live = savedStarMarkersRef.current;
    var seen = new Set();
    var now = window.NOW || {};
    var nowMin = typeof toNightMin === "function" && now.time ? toNightMin(now.time) : 0;
    var byStage = {};
    saved.forEach(id => {
      var a = window.ARTISTS?.find(x => x.id === id);
      if (!a || a.day !== now.day) return;
      var sM = toNightMin(a.start),
        eM = toNightMin(a.end);
      if (eM <= nowMin) return;
      var cur = byStage[a.stage];
      if (!cur || sM - nowMin < cur.minsUntil) {
        byStage[a.stage] = {
          artist: a,
          minsUntil: sM - nowMin
        };
      }
    });
    Object.keys(byStage).forEach(stageId => {
      var s = stages.find(st => st.id === stageId);
      if (!s) return;
      seen.add(stageId);
      var {
        lat,
        lng
      } = mapToGps(s.x, s.y);
      if (!live[stageId]) {
        var el = document.createElement("div");
        el.style.cssText = "width:20px;height:20px;border-radius:999px;background:rgba(13,8,4,0.92);" + "border:1.5px solid #fbbf24;display:flex;align-items:center;justify-content:center;" + "color:#fbbf24;font-family:'Geist Mono',monospace;font-size:13px;font-weight:900;" + "box-shadow:0 0 12px rgba(251,191,36,0.5),0 2px 6px rgba(0,0,0,0.5);" + "transform:translate(14px,-14px);pointer-events:none;";
        el.textContent = "★";
        live[stageId] = new window.maplibregl.Marker({
          element: el,
          anchor: "center"
        }).setLngLat([lng, lat]).addTo(mapRef.current);
      } else {
        live[stageId].setLngLat([lng, lat]);
      }
    });
    Object.keys(live).forEach(stageId => {
      if (!seen.has(stageId)) {
        try {
          live[stageId].remove();
        } catch {}
        delete live[stageId];
      }
    });
  }, [loaded, saved, stages]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    var map = mapRef.current;
    if (map.getLayer("crowd-heat")) {
      try {
        map.setLayoutProperty("crowd-heat", "visibility", showHeat ? "visible" : "none");
      } catch {}
    }
    if (!showHeat) return;
    var rebuild = () => {
      var nowMin = typeof toNightMin === "function" && window.NOW?.time ? toNightMin(window.NOW.time) : 0;
      var features = stages.map(s => {
        var {
          lat,
          lng
        } = mapToGps(s.x, s.y);
        var density = typeof _crowdDensity === "function" ? _crowdDensity(s.id, nowMin) : 0.04;
        return {
          type: "Feature",
          properties: {
            id: s.id,
            density
          },
          geometry: {
            type: "Point",
            coordinates: [lng, lat]
          }
        };
      });
      var src = map.getSource("crowd-heat");
      if (src) src.setData({
        type: "FeatureCollection",
        features
      });
    };
    rebuild();
    var id = setInterval(rebuild, 60000);
    return () => clearInterval(id);
  }, [loaded, showHeat, stages]);
  var _styleKeyInitRef = React.useRef(styleKey);
  React.useEffect(() => {
    if (!mapRef.current) return;
    if (_styleKeyInitRef.current === styleKey) {
      _styleKeyInitRef.current = "__seeded__";
      return;
    }
    var cfg = REAL_MAP_STYLES[styleKey];
    if (!cfg) return;
    try {
      _mapLog("[plursky-map] setStyle →", styleKey);
      mapRef.current.setStyle(cfg.style || cfg.url);
    } catch (e) {
      console.error("[plursky-map] setStyle failed:", e);
    }
  }, [styleKey]);
  React.useEffect(() => {
    if (!loaded || !mapRef.current) return;
    var target = meetTarget || (selected ? stages.find(s => s.id === selected) : null);
    var src = mapRef.current.getSource("route");
    if (!src) return;
    if (!target) {
      src.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: []
        }
      });
      return;
    }
    var a = mapToGps(avatar.x, avatar.y);
    var t = mapToGps(target.x, target.y);
    src.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [[a.lng, a.lat], [t.lng, t.lat]]
      }
    });
  }, [loaded, avatar.x, avatar.y, selected, meetTarget, stages]);
  var pickStyle = k => {
    setStyleKey(k);
    try {
      localStorage.setItem("plursky_real_map_style", k);
    } catch {}
  };
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      background: "#060412"
    }
  }, React.createElement("div", {
    ref: containerRef,
    style: {
      position: "absolute",
      inset: 0
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      top: 108,
      right: 10,
      zIndex: 4,
      display: "flex",
      background: "rgba(6,4,18,0.78)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: 999,
      padding: 3,
      gap: 2,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)"
    }
  }, Object.entries(REAL_MAP_STYLES).map(([k, cfg]) => {
    var on = styleKey === k;
    return React.createElement("button", {
      key: k,
      onClick: () => pickStyle(k),
      style: {
        background: on ? "var(--ember)" : "transparent",
        color: "#fff",
        border: "none",
        padding: "5px 11px",
        borderRadius: 999,
        fontFamily: "'Geist Mono',monospace",
        fontSize: 9,
        letterSpacing: 1.3,
        fontWeight: 700,
        cursor: "pointer",
        transition: "background 0.15s"
      }
    }, cfg.label);
  })), err && React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "#f87171",
      fontFamily: "'Geist Mono',monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      gap: 6,
      padding: 20,
      textAlign: "center"
    }
  }, React.createElement("div", null, "MAP ERROR"), React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 9,
      maxWidth: 240
    }
  }, err), FESTIVAL_CONFIG.mapMode === "real" ? React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 10,
      marginTop: 10,
      letterSpacing: 1.1
    }
  }, FESTIVAL_CONFIG.venue?.name || FESTIVAL_CONFIG.locationShort), React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 9,
      maxWidth: 240
    }
  }, FESTIVAL_CONFIG.venue?.address || FESTIVAL_CONFIG.location), React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.4)",
      fontSize: 8,
      marginTop: 6,
      maxWidth: 250
    }
  }, "The official festival map publishes before doors. Until then this screen needs a connection."), React.createElement("button", {
    onClick: () => {
      setErr(null);
      fatalRef.current = false;
      tileErrRef.current = 0;
    },
    style: {
      marginTop: 10,
      padding: "7px 16px",
      borderRadius: 999,
      border: "none",
      background: "var(--ember)",
      color: "#fff",
      cursor: "pointer",
      fontFamily: "'Geist Mono',monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "RETRY")) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      color: "rgba(255,255,255,0.45)",
      fontSize: 8,
      marginTop: 4
    }
  }, "Tip: the festival map below works offline — one tap switches and remembers."), React.createElement("button", {
    onClick: () => _fatal("Switched to festival map"),
    style: {
      marginTop: 8,
      padding: "7px 16px",
      borderRadius: 999,
      border: "none",
      background: "var(--ember)",
      color: "#fff",
      cursor: "pointer",
      fontFamily: "'Geist Mono',monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "USE FESTIVAL MAP"))));
}
function _crowdDensity(stageId, nowMin) {
  var playing = ARTISTS.find(a => a.stage === stageId && toNightMin(a.start) <= nowMin && toNightMin(a.end) > nowMin);
  if (playing) return 0.25 + playing.tier / 3 * 0.75;
  var recent = null;
  ARTISTS.forEach(a => {
    if (a.stage !== stageId) return;
    var endMin = toNightMin(a.end);
    if (endMin > nowMin || endMin < nowMin - 20) return;
    if (!recent || endMin > toNightMin(recent.end)) recent = a;
  });
  if (recent) {
    var fade = 1 - (nowMin - toNightMin(recent.end)) / 20;
    return (0.25 + recent.tier / 3 * 0.75) * fade * 0.55;
  }
  return 0.04;
}
var AMENITY_KEY = [{
  type: "med",
  color: "#ef4444",
  letter: "+",
  label: "First aid"
}, {
  type: "water",
  color: "#38bdf8",
  letter: "",
  label: "Water"
}, {
  type: "toilet",
  color: "#64748b",
  letter: "",
  label: "Restrooms"
}, {
  type: "food",
  color: "#fb923c",
  letter: "",
  label: "Food"
}, {
  type: "charge",
  color: "#facc15",
  letter: "⚡",
  label: "Charging"
}, {
  type: "locker",
  color: "#a78bfa",
  letter: "L",
  label: "Lockers"
}, {
  type: "info",
  color: "#16a34a",
  letter: "i",
  label: "Info / lost"
}, {
  type: "art",
  color: "#f59a36",
  letter: "",
  label: "Art"
}];
var AMENITY_STYLE = Object.fromEntries(AMENITY_KEY.map(a => [a.type, a]));
function TopDownMap({
  avatar,
  heading,
  friends,
  stages,
  saved = [],
  showLabels = false,
  showHeat = false,
  showAmenities = false,
  amenityFilter = null,
  compass = false,
  compassHeading = 0,
  selected,
  meetMode,
  meetTarget,
  meetGroup = [],
  crewFriends = [],
  zoom = 1,
  pan = {
    x: 0,
    y: 0
  },
  zoomMin = 0.7,
  zoomMax = 3.5,
  onZoomChange,
  onPanChange,
  onPickStage,
  onClick
}) {
  var mapRotate = compass ? -compassHeading : 0;
  var counterRot = compass ? ` rotate(${compassHeading}deg)` : "";
  var sel = stages.find(s => s.id === selected);
  var artPrintsStageNames = FESTIVAL_CONFIG.mapPrintsStageNames ?? FESTIVAL_CONFIG.mapTheme === "park";
  var savedByStage = React.useMemo(() => {
    var nowMin = toNightMin(NOW.time);
    var map = {};
    saved.forEach(id => {
      var a = ARTISTS.find(x => x.id === id);
      if (!a || a.day !== NOW.day) return;
      var startMin = toNightMin(a.start);
      var endMin = toNightMin(a.end);
      if (endMin <= nowMin) return;
      var minsUntil = startMin - nowMin;
      var existing = map[a.stage];
      if (!existing || minsUntil < existing.minsUntil) {
        map[a.stage] = {
          artist: a,
          minsUntil,
          isLive: nowMin >= startMin
        };
      }
    });
    return map;
  }, [saved]);
  var stars = React.useMemo(() => {
    var s = 0xdeadbeef;
    var rng = () => {
      s = Math.imul(s ^ s >>> 17, 0x45d9f3b) ^ s * 0x119de1f3 >>> 16;
      return (s >>> 0) / 0x100000000;
    };
    var out = [];
    for (var i = 0; i < 55; i++) {
      var angle = rng() * Math.PI * 2;
      var dist = 36 + rng() * 28;
      var x = +(50 + Math.cos(angle) * dist).toFixed(1);
      var y = +(50 + Math.sin(angle) * dist).toFixed(1);
      if (x < 0.5 || x > 99.5 || y < 0.5 || y > 99.5) continue;
      out.push({
        x,
        y,
        r: +(0.18 + rng() * 0.32).toFixed(2),
        op: +(0.25 + rng() * 0.55).toFixed(2)
      });
    }
    return out;
  }, []);
  var _pillName = n => (n && n.length > 14 ? n.slice(0, 13).trimEnd() + "…" : n || "").toUpperCase();
  var anchorFor = s => {
    var cx = 50,
      cy = 50;
    var dx = s.x - cx,
      dy = s.y - cy;
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return dy < 0 ? "N" : "S";
    return dx < 0 ? "W" : "E";
  };
  var gestureRef = React.useRef({
    mode: null,
    startDist: 0,
    startZoom: 1,
    startPanX: 0,
    startPanY: 0,
    startTouchX: 0,
    startTouchY: 0,
    moved: false
  });
  var _pinchDist = touches => {
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };
  var onTouchStart = e => {
    var g = gestureRef.current;
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
  var onTouchMove = e => {
    var g = gestureRef.current;
    if (g.mode === "pinch" && e.touches.length >= 2) {
      e.preventDefault?.();
      var d = _pinchDist(e.touches);
      if (g.startDist <= 0) return;
      var next = Math.max(zoomMin, Math.min(zoomMax, g.startZoom * (d / g.startDist)));
      g.moved = true;
      onZoomChange?.(+next.toFixed(3));
    } else if (g.mode === "pan" && e.touches.length === 1) {
      var dx = e.touches[0].clientX - g.startTouchX;
      var dy = e.touches[0].clientY - g.startTouchY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
      onPanChange?.({
        x: g.startPanX + dx,
        y: g.startPanY + dy
      });
    }
  };
  var onTouchEnd = () => {
    gestureRef.current.mode = null;
  };
  var guardedClick = e => {
    if (gestureRef.current.moved) return;
    onClick?.(e);
  };
  var boxRef = React.useRef(null);
  var [box, setBox] = React.useState({
    w: 0,
    h: 0
  });
  React.useEffect(() => {
    var el = boxRef.current;
    if (!el) return;
    var read = () => {
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setBox(p => Math.abs(p.w - r.width) < 0.5 && Math.abs(p.h - r.height) < 0.5 ? p : {
          w: r.width,
          h: r.height
        });
      }
    };
    read();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", read);
      return () => window.removeEventListener("resize", read);
    }
    var ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  var VB_H = box.w > 0 && box.h > 0 ? Math.max(100, 100 * box.h / box.w) : 100;
  var yOff = (VB_H - 100) / 2;
  var mapY = y => (Number(y) + yOff) / VB_H * 100;
  return React.createElement("div", {
    ref: boxRef,
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      background: "#060412",
      touchAction: "none"
    },
    onTouchStart: onTouchStart,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchEnd
  }, React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      transform: `${compass ? `rotate(${mapRotate}deg) ` : ""}translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: "50% 50%",
      transition: gestureRef.current.mode ? "none" : "transform 0.18s linear",
      willChange: "transform"
    }
  }, React.createElement("svg", {
    viewBox: `0 0 100 ${VB_H}`,
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid meet",
    onClick: guardedClick,
    style: {
      position: "absolute",
      inset: 0,
      cursor: meetMode ? "crosshair" : "default",
      display: "block"
    }
  }, React.createElement("defs", null, React.createElement("radialGradient", {
    id: "mapGround",
    cx: "50%",
    cy: "48%",
    r: "72%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#130b28"
  }), React.createElement("stop", {
    offset: "55%",
    stopColor: "#0c0820"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#060412"
  })), React.createElement("radialGradient", {
    id: "infieldGlow",
    cx: "50%",
    cy: "50%",
    r: "55%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "rgba(120,60,210,0.22)"
  }), React.createElement("stop", {
    offset: "60%",
    stopColor: "rgba(60,30,120,0.08)"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "rgba(0,0,0,0)"
  })), React.createElement("radialGradient", {
    id: "daisyGlow",
    cx: "50%",
    cy: "50%",
    r: "60%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "rgba(240,160,40,0.18)"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "rgba(240,160,40,0)"
  })), React.createElement("linearGradient", {
    id: "ledring",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "100%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#e85d2e"
  }), React.createElement("stop", {
    offset: "20%",
    stopColor: "#f59a36"
  }), React.createElement("stop", {
    offset: "40%",
    stopColor: "#22c55e"
  }), React.createElement("stop", {
    offset: "60%",
    stopColor: "#38bdf8"
  }), React.createElement("stop", {
    offset: "80%",
    stopColor: "#a78bfa"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#ec4899"
  })), React.createElement("filter", {
    id: "stageglow",
    x: "-100%",
    y: "-100%",
    width: "300%",
    height: "300%"
  }, React.createElement("feGaussianBlur", {
    in: "SourceGraphic",
    stdDeviation: "2.2",
    result: "blur"
  }), React.createElement("feMerge", null, React.createElement("feMergeNode", {
    in: "blur"
  }), React.createElement("feMergeNode", {
    in: "SourceGraphic"
  }))), React.createElement("filter", {
    id: "starbloom",
    x: "-200%",
    y: "-200%",
    width: "500%",
    height: "500%"
  }, React.createElement("feGaussianBlur", {
    in: "SourceGraphic",
    stdDeviation: "0.5",
    result: "blur"
  }), React.createElement("feMerge", null, React.createElement("feMergeNode", {
    in: "blur"
  }), React.createElement("feMergeNode", {
    in: "SourceGraphic"
  })))), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: VB_H,
    fill: "url(#mapGround)"
  }), React.createElement("g", {
    transform: `translate(0 ${yOff})`
  }, FESTIVAL_CONFIG.mapStyle === "image-overlay" && FESTIVAL_CONFIG.mapImage ? React.createElement(React.Fragment, null, React.createElement("defs", null, React.createElement("filter", {
    id: "mapClean",
    colorInterpolationFilters: "sRGB"
  }, React.createElement("feColorMatrix", {
    type: "saturate",
    values: "0.55"
  }), React.createElement("feColorMatrix", {
    type: "matrix",
    values: "1.02 0.04 0 0 0.03  0 1.0 0.02 0 0.02  0 0 0.96 0 0.01  0 0 0 1 0"
  })), React.createElement("linearGradient", {
    id: "mapFadeL",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "0"
  }, React.createElement("stop", {
    offset: "0",
    stopColor: "#e8dfcf",
    stopOpacity: "0.96"
  }), React.createElement("stop", {
    offset: "0.35",
    stopColor: "#e8dfcf",
    stopOpacity: "0.7"
  }), React.createElement("stop", {
    offset: "0.65",
    stopColor: "#e8dfcf",
    stopOpacity: "0.15"
  }), React.createElement("stop", {
    offset: "1",
    stopColor: "#e8dfcf",
    stopOpacity: "0"
  })), React.createElement("linearGradient", {
    id: "mapFadeB",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0",
    stopColor: "#e8dfcf",
    stopOpacity: "0"
  }), React.createElement("stop", {
    offset: "0.7",
    stopColor: "#e8dfcf",
    stopOpacity: "0"
  }), React.createElement("stop", {
    offset: "0.88",
    stopColor: "#e8dfcf",
    stopOpacity: "0.5"
  }), React.createElement("stop", {
    offset: "1",
    stopColor: "#e8dfcf",
    stopOpacity: "0.92"
  })), React.createElement("linearGradient", {
    id: "mapFadeT",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0",
    stopColor: "#e8dfcf",
    stopOpacity: "0.8"
  }), React.createElement("stop", {
    offset: "0.12",
    stopColor: "#e8dfcf",
    stopOpacity: "0.3"
  }), React.createElement("stop", {
    offset: "0.25",
    stopColor: "#e8dfcf",
    stopOpacity: "0"
  })), React.createElement("radialGradient", {
    id: "mapVignette",
    cx: "50%",
    cy: "45%",
    r: "52%"
  }, React.createElement("stop", {
    offset: "0",
    stopColor: "#000",
    stopOpacity: "0"
  }), React.createElement("stop", {
    offset: "0.7",
    stopColor: "#000",
    stopOpacity: "0"
  }), React.createElement("stop", {
    offset: "1",
    stopColor: "#1a120d",
    stopOpacity: "0.28"
  })), React.createElement("linearGradient", {
    id: "parkScrim",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0.74",
    stopColor: "#0a0f0b",
    stopOpacity: "0"
  }), React.createElement("stop", {
    offset: "1",
    stopColor: "#0a0f0b",
    stopOpacity: "0.8"
  }))), FESTIVAL_CONFIG.mapTheme === "park" ? React.createElement(React.Fragment, null, React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "#0a0f0b"
  }), React.createElement("image", {
    href: FESTIVAL_CONFIG.mapImage,
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    preserveAspectRatio: "xMidYMid slice"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "url(#mapVignette)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "url(#parkScrim)"
  })) : React.createElement(React.Fragment, null, React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "var(--paper-2)"
  }), React.createElement("image", {
    href: FESTIVAL_CONFIG.mapImage,
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    preserveAspectRatio: "xMidYMid slice",
    opacity: "0.82",
    filter: "url(#mapClean)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "22",
    height: "100",
    fill: "url(#mapFadeL)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "url(#mapFadeB)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "url(#mapFadeT)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "url(#mapVignette)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "rgba(247,237,224,0.06)"
  }))) : React.createElement(React.Fragment, null, React.createElement("g", {
    filter: "url(#starbloom)"
  }, stars.map((st, i) => React.createElement("circle", {
    key: i,
    cx: st.x,
    cy: st.y,
    r: st.r,
    fill: "#fff",
    opacity: st.op
  }))), React.createElement("path", {
    d: "M 42 14 L 58 14 A 36 36 0 0 1 58 86 Q 54 88 50 90 Q 46 88 42 86 A 36 36 0 0 1 42 14 Z",
    fill: "rgba(20,12,40,0.6)",
    stroke: "rgba(180,140,255,0.12)",
    strokeWidth: "3.2"
  }), React.createElement("path", {
    d: "M 42 14 L 58 14 A 36 36 0 0 1 58 86 Q 54 88 50 90 Q 46 88 42 86 A 36 36 0 0 1 42 14 Z",
    fill: "none",
    stroke: "url(#ledring)",
    strokeWidth: "1.2",
    opacity: "0.95"
  }), React.createElement("path", {
    d: "M 42 14 L 58 14 A 36 36 0 0 1 58 86 Q 54 88 50 90 Q 46 88 42 86 A 36 36 0 0 1 42 14 Z",
    fill: "none",
    stroke: "rgba(255,255,255,0.18)",
    strokeWidth: "0.3"
  }), React.createElement("path", {
    d: "M 47 19 L 53 19 A 31 31 0 0 1 53 81 Q 51.5 82.5 50 84 Q 48.5 82.5 47 81 A 31 31 0 0 1 47 19 Z",
    fill: "none",
    stroke: "rgba(255,255,255,0.07)",
    strokeWidth: "0.22",
    strokeDasharray: "1 1.5"
  }), React.createElement("line", {
    x1: "50",
    y1: "89.4",
    x2: "50",
    y2: "91.6",
    stroke: "rgba(255,255,255,0.6)",
    strokeWidth: "0.55",
    strokeLinecap: "round"
  }), React.createElement("line", {
    x1: "49",
    y1: "90.5",
    x2: "51",
    y2: "90.5",
    stroke: "rgba(0,0,0,0.9)",
    strokeWidth: "0.45",
    strokeLinecap: "round"
  }), React.createElement("ellipse", {
    cx: "50",
    cy: "50",
    rx: "38",
    ry: "30",
    fill: "url(#infieldGlow)"
  }), React.createElement("rect", {
    x: "37",
    y: "43",
    width: "26",
    height: "16",
    rx: "4",
    fill: "url(#daisyGlow)",
    opacity: "0.85"
  }), showHeat && (() => {
    var nowMin = toNightMin(NOW.time);
    return React.createElement("g", null, React.createElement("defs", null, React.createElement("filter", {
      id: "crowdBlur",
      x: "-80%",
      y: "-80%",
      width: "260%",
      height: "260%"
    }, React.createElement("feGaussianBlur", {
      in: "SourceGraphic",
      stdDeviation: "4.5"
    }))), React.createElement("g", {
      filter: "url(#crowdBlur)"
    }, stages.map(s => {
      var d = _crowdDensity(s.id, nowMin);
      if (d < 0.06) return null;
      var r = 5 + d * 11;
      var col = d > 0.72 ? "#ef4444" : d > 0.44 ? "#f97316" : "#fbbf24";
      return React.createElement("circle", {
        key: s.id,
        cx: s.x,
        cy: s.y,
        r: r,
        fill: col,
        opacity: 0.28 + d * 0.38
      });
    })));
  })(), React.createElement("path", {
    d: "M50,16 Q50,50 50,84",
    stroke: "rgba(255,255,255,0.06)",
    strokeWidth: "3.4",
    fill: "none",
    strokeLinecap: "round"
  }), React.createElement("path", {
    d: "M50,16 Q50,50 50,84",
    stroke: "rgba(255,255,255,0.18)",
    strokeWidth: "0.55",
    fill: "none",
    strokeLinecap: "round",
    strokeDasharray: "1.2 1.6"
  }), React.createElement("path", {
    d: "M16,50 Q50,52 84,50",
    stroke: "rgba(255,255,255,0.05)",
    strokeWidth: "2.4",
    fill: "none",
    strokeLinecap: "round"
  }), React.createElement("path", {
    d: "M16,50 Q50,52 84,50",
    stroke: "rgba(255,255,255,0.14)",
    strokeWidth: "0.45",
    fill: "none",
    strokeLinecap: "round",
    strokeDasharray: "1.2 1.6"
  }), React.createElement("path", {
    d: "M28,28 Q38,38 50,51",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: "0.4",
    fill: "none",
    strokeLinecap: "round",
    strokeDasharray: "0.8 1.2"
  }), React.createElement("path", {
    d: "M72,28 Q62,38 50,51",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: "0.4",
    fill: "none",
    strokeLinecap: "round",
    strokeDasharray: "0.8 1.2"
  }), React.createElement("rect", {
    x: "37",
    y: "43",
    width: "26",
    height: "16",
    fill: "rgba(232,93,46,0.10)",
    stroke: "rgba(232,93,46,0.55)",
    strokeWidth: "0.35",
    rx: "2.5"
  }), React.createElement("circle", {
    cx: "50",
    cy: "51",
    r: "3.5",
    fill: "none",
    stroke: "rgba(232,93,46,0.4)",
    strokeWidth: "0.35"
  }), React.createElement("circle", {
    cx: "50",
    cy: "51",
    r: "1.4",
    fill: "rgba(240,160,60,1)"
  }, React.createElement("animate", {
    attributeName: "r",
    values: "1.0;1.6;1.0",
    dur: "3s",
    repeatCount: "indefinite"
  }), React.createElement("animate", {
    attributeName: "opacity",
    values: "0.9;1;0.9",
    dur: "3s",
    repeatCount: "indefinite"
  })), [{
    id: "S",
    x: 76,
    y: 16
  }, {
    id: "CD",
    x: 8,
    y: 50
  }, {
    id: "P",
    x: 18,
    y: 84
  }].map(g => React.createElement("g", {
    key: g.id
  }, React.createElement("circle", {
    cx: g.x,
    cy: g.y,
    r: "2.8",
    fill: "rgba(34,197,94,0.22)"
  }), React.createElement("circle", {
    cx: g.x,
    cy: g.y,
    r: "1.5",
    fill: "#22c55e",
    stroke: "rgba(255,255,255,0.95)",
    strokeWidth: "0.35"
  }), React.createElement("circle", {
    cx: g.x,
    cy: g.y,
    r: "0.5",
    fill: "#fff"
  })))), !meetMode && showAmenities && (typeof AMENITIES !== "undefined" ? AMENITIES : []).filter(a => !amenityFilter || a.type === amenityFilter).map(a => {
    var cfg = AMENITY_STYLE[a.type] || {
      color: "#000",
      letter: ""
    };
    return React.createElement("g", {
      key: a.id
    }, React.createElement("circle", {
      cx: a.x,
      cy: a.y,
      r: "1.4",
      fill: cfg.color,
      opacity: "0.92",
      stroke: "#fff",
      strokeWidth: "0.22"
    }), cfg.letter && React.createElement("text", {
      x: a.x,
      y: a.y + 0.65,
      textAnchor: "middle",
      fontSize: "1.8",
      fill: "#fff",
      fontFamily: "Geist Mono, monospace",
      fontWeight: "900"
    }, cfg.letter));
  }), (sel || meetTarget) && (() => {
    var target = meetTarget || sel;
    var c = meetTarget ? "#e85d2e" : "#e85d2e";
    return React.createElement("g", null, React.createElement("path", {
      d: `M ${avatar.x},${avatar.y} L ${target.x},${target.y}`,
      stroke: c,
      strokeWidth: "2.6",
      fill: "none",
      strokeLinecap: "round",
      opacity: "0.18"
    }), React.createElement("path", {
      d: `M ${avatar.x},${avatar.y} L ${target.x},${target.y}`,
      stroke: c,
      strokeWidth: "0.85",
      fill: "none",
      strokeLinecap: "round",
      strokeDasharray: "2.2 1.6"
    }));
  })(), stages.map(s => {
    var on = s.id === selected;
    var r = 2.8 + (s.size - 1) * 1.1;
    var isPark = FESTIVAL_CONFIG.mapTheme === "park";
    var pinR = 2.1 + (s.size - 1) * 0.5;
    var savedHere = savedByStage[s.id];
    var nowMin = NOW.time ? toNightMin(NOW.time) : 0;
    var liveArtist = typeof ARTISTS !== "undefined" ? ARTISTS.find(a => a.stage === s.id && a.day === NOW.day && nowMin >= toNightMin(a.start) && nowMin < toNightMin(a.end)) : null;
    var energyR = liveArtist ? liveArtist.tier === 3 ? 12 : liveArtist.tier === 2 ? 9 : 6 : 0;
    return React.createElement("g", {
      key: s.id,
      role: "button",
      tabIndex: 0,
      "aria-label": `${s.name} stage`,
      style: {
        cursor: "pointer"
      },
      onClick: e => {
        e.stopPropagation();
        onPickStage(s.id);
      },
      onKeyDown: e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPickStage(s.id);
        }
      }
    }, liveArtist && !on && React.createElement(React.Fragment, null, React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: r + 2,
      fill: "none",
      stroke: s.color,
      strokeWidth: "0.4",
      opacity: "0.7"
    }, React.createElement("animate", {
      attributeName: "r",
      values: `${r + 2};${r + energyR};${r + 2}`,
      dur: liveArtist.tier === 3 ? "1.8s" : "2.4s",
      repeatCount: "indefinite"
    }), React.createElement("animate", {
      attributeName: "opacity",
      values: "0.6;0;0.6",
      dur: liveArtist.tier === 3 ? "1.8s" : "2.4s",
      repeatCount: "indefinite"
    })), React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: r + 1,
      fill: "none",
      stroke: s.color,
      strokeWidth: "0.25",
      opacity: "0.4"
    }, React.createElement("animate", {
      attributeName: "r",
      values: `${r + 1};${r + energyR * 0.6};${r + 1}`,
      dur: "3s",
      repeatCount: "indefinite"
    }), React.createElement("animate", {
      attributeName: "opacity",
      values: "0.4;0;0.4",
      dur: "3s",
      repeatCount: "indefinite"
    }))), on && React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: r + 1,
      fill: "none",
      stroke: s.color,
      strokeWidth: "0.5",
      opacity: "0.9"
    }, React.createElement("animate", {
      attributeName: "r",
      values: `${r};${r + 6};${r}`,
      dur: "2s",
      repeatCount: "indefinite"
    }), React.createElement("animate", {
      attributeName: "opacity",
      values: "0.8;0;0.8",
      dur: "2s",
      repeatCount: "indefinite"
    })), !isPark && React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: r + 2.4,
      fill: s.color,
      opacity: on ? 0.32 : liveArtist ? 0.22 : 0.14,
      filter: "url(#stageglow)"
    }), isPark ? React.createElement("g", null, React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: pinR + 0.5,
      fill: "rgba(10,15,11,0.5)"
    }), React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: pinR,
      fill: s.color,
      stroke: "#fff",
      strokeWidth: on ? 0.7 : 0.5
    }), React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: pinR * 0.34,
      fill: "#fff"
    })) : React.createElement(StageIcon, {
      id: s.id,
      cx: s.x,
      cy: s.y,
      r: r,
      on: on,
      color: s.color
    }), savedHere && React.createElement("g", {
      transform: `translate(${s.x + r * 0.85}, ${s.y - r * 0.85})`
    }, React.createElement("circle", {
      r: "1.9",
      fill: "rgba(13,8,4,0.85)",
      stroke: "#fbbf24",
      strokeWidth: "0.25"
    }), React.createElement("text", {
      y: "0.85",
      textAnchor: "middle",
      fontSize: "2.4",
      fontWeight: "900",
      fill: "#fbbf24",
      fontFamily: "Geist Mono, monospace"
    }, "★")));
  }), friends.map(f => {
    var dist = Math.hypot(f.x - avatar.x, f.y - avatar.y);
    if (dist > 8) return null;
    var mx = (f.x + avatar.x) / 2,
      my = (f.y + avatar.y) / 2;
    return React.createElement("circle", {
      key: `prox-${f.id}`,
      cx: mx,
      cy: my,
      r: "5",
      fill: "none",
      stroke: f.color,
      strokeWidth: "0.4",
      opacity: "0.5"
    }, React.createElement("animate", {
      attributeName: "r",
      values: "3;7;3",
      dur: "2.5s",
      repeatCount: "indefinite"
    }), React.createElement("animate", {
      attributeName: "opacity",
      values: "0.5;0.1;0.5",
      dur: "2.5s",
      repeatCount: "indefinite"
    }));
  }), friends.map(f => {
    var focused = meetGroup.includes(f.id);
    var nearby = Math.hypot(f.x - avatar.x, f.y - avatar.y) <= 8;
    return React.createElement("g", {
      key: f.id
    }, React.createElement("circle", {
      cx: f.x,
      cy: f.y,
      r: "2.5",
      fill: f.color,
      opacity: nearby ? 0.35 : 0.22
    }, React.createElement("animate", {
      attributeName: "r",
      values: nearby ? "2.5;4;2.5" : "2;3.5;2",
      dur: nearby ? "1.8s" : "2.8s",
      repeatCount: "indefinite"
    })), React.createElement("circle", {
      cx: f.x,
      cy: f.y,
      r: focused ? 1.8 : 1.5,
      fill: f.avatarTone,
      stroke: nearby ? "#fff" : "rgba(255,255,255,0.9)",
      strokeWidth: nearby ? 0.7 : 0.5
    }));
  }), meetMode && meetTarget && React.createElement("g", null, React.createElement("circle", {
    cx: meetTarget.x,
    cy: meetTarget.y,
    r: "3",
    fill: "none",
    stroke: "#e85d2e",
    strokeWidth: "0.6",
    opacity: "0.8"
  }, React.createElement("animate", {
    attributeName: "r",
    values: "1.5;5.5;1.5",
    dur: "1.4s",
    repeatCount: "indefinite"
  }), React.createElement("animate", {
    attributeName: "opacity",
    values: "0.9;0;0.9",
    dur: "1.4s",
    repeatCount: "indefinite"
  })), React.createElement("circle", {
    cx: meetTarget.x,
    cy: meetTarget.y,
    r: "1.6",
    fill: "#e85d2e",
    stroke: "#fff",
    strokeWidth: "0.5"
  })), selected && !meetMode && (() => {
    var target = stages.find(s => s.id === selected);
    if (!target) return null;
    var dist = Math.hypot(target.x - avatar.x, target.y - avatar.y);
    if (dist < 4) return null;
    var mid1x = avatar.x + (target.x - avatar.x) * 0.33 + (Math.random() > 0.5 ? 3 : -3);
    var mid1y = avatar.y + (target.y - avatar.y) * 0.33;
    var mid2x = avatar.x + (target.x - avatar.x) * 0.66;
    var mid2y = avatar.y + (target.y - avatar.y) * 0.66 + (Math.random() > 0.5 ? 2 : -2);
    var walkMins = typeof _pairKey === "function" && typeof WALK_PAIRS !== "undefined" ? WALK_PAIRS[_pairKey(_nearestStageId(avatar.x, avatar.y) || "", selected)] || [0, 0] : [0, 0];
    var etaMin = Math.round((walkMins[0] + walkMins[1]) / 2) || Math.round(dist * 0.4);
    return React.createElement("g", null, React.createElement("path", {
      d: `M${avatar.x},${avatar.y} C${mid1x},${mid1y} ${mid2x},${mid2y} ${target.x},${target.y}`,
      fill: "none",
      stroke: target.color,
      strokeWidth: "0.6",
      strokeDasharray: "2 2",
      opacity: "0.6"
    }, React.createElement("animate", {
      attributeName: "stroke-dashoffset",
      values: "0;-8",
      dur: "1.5s",
      repeatCount: "indefinite"
    })), React.createElement("text", {
      x: (avatar.x + target.x) / 2,
      y: (avatar.y + target.y) / 2 - 2,
      textAnchor: "middle",
      fontSize: "3",
      fontFamily: "Geist Mono, monospace",
      fontWeight: "700",
      fill: target.color,
      opacity: "0.85"
    }, etaMin, " MIN"));
  })(), React.createElement("g", null, React.createElement("path", {
    d: `M${avatar.x},${avatar.y}
                    L${avatar.x + Math.cos(heading - 0.38) * 6.5},${avatar.y + Math.sin(heading - 0.38) * 6.5}
                    L${avatar.x + Math.cos(heading + 0.38) * 6.5},${avatar.y + Math.sin(heading + 0.38) * 6.5} Z`,
    fill: "#f59a36",
    opacity: "0.3"
  }), React.createElement("circle", {
    cx: avatar.x,
    cy: avatar.y,
    r: "3.2",
    fill: "#f59a36",
    opacity: "0.22"
  }, React.createElement("animate", {
    attributeName: "r",
    values: "2.5;4.5;2.5",
    dur: "2.2s",
    repeatCount: "indefinite"
  })), React.createElement("circle", {
    cx: avatar.x,
    cy: avatar.y,
    r: "1.8",
    fill: "#f59a36",
    stroke: "rgba(255,255,255,0.95)",
    strokeWidth: "0.6"
  }), React.createElement("circle", {
    cx: avatar.x,
    cy: avatar.y,
    r: "0.7",
    fill: "#fff"
  })))), React.createElement("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: 0,
      width: "100%",
      aspectRatio: "1 / 1",
      transform: "translateY(-50%)",
      pointerEvents: "none"
    }
  }, (FESTIVAL_CONFIG.placeLabel || (FESTIVAL_CONFIG.gates || []).length > 0) && React.createElement(React.Fragment, null, FESTIVAL_CONFIG.placeLabel && React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      top: "43%",
      transform: "translate(-50%, -130%)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 8,
      letterSpacing: 2.2,
      fontWeight: 700,
      color: "rgba(232,93,46,0.85)"
    }
  }, FESTIVAL_CONFIG.placeLabel), (FESTIVAL_CONFIG.gates || []).map((g, i) => React.createElement("div", {
    key: i,
    style: {
      position: "absolute",
      left: `${g.x}%`,
      top: `${mapY(g.y)}%`,
      transform: `translate(-50%, -50%)${counterRot}`,
      fontFamily: "Geist Mono, monospace",
      fontSize: 8,
      letterSpacing: 1.4,
      fontWeight: 700,
      color: "rgba(80,230,160,0.92)",
      textShadow: "0 0 8px rgba(80,230,160,0.5)",
      whiteSpace: "nowrap",
      pointerEvents: "none"
    }
  }, g.label)), showLabels && (FESTIVAL_CONFIG.landmarks || []).map((lm, i) => React.createElement("div", {
    key: i,
    style: {
      position: "absolute",
      left: `${lm.x}%`,
      top: `${mapY(lm.y)}%`,
      transform: `translate(-50%, -50%) rotate(${lm.rot}deg)`,
      fontFamily: "Geist Mono, monospace",
      fontSize: lm.size,
      letterSpacing: lm.ls,
      fontWeight: 700,
      color: lm.color,
      textShadow: "0 1px 6px rgba(0,0,0,0.8)",
      whiteSpace: "nowrap",
      pointerEvents: "none"
    }
  }, lm.label))), stages.map(s => {
    var on = s.id === selected;
    var savedHere = savedByStage[s.id];
    var label = on ? s.name.toUpperCase() : !artPrintsStageNames ? s.name.toUpperCase() : savedHere ? `★ ${_pillName(savedHere.artist.name)}${savedHere.isLive ? " · NOW" : savedHere.minsUntil <= 90 ? ` · ${savedHere.minsUntil}M` : ""}` : null;
    if (label === null) return null;
    var liveArtist = savedHere?.isLive ? savedHere.artist : null;
    var anchor = (() => {
      var edgeX = s.x < 22 || s.x > 78;
      if (edgeX) {
        if (s.y >= 40 && s.y <= 60) return "N";
        if (s.y > 60) return "S";
        return "N";
      }
      if (s.y < 22) return "S";
      if (s.y > 78) return "N";
      var a = anchorFor(s);
      if (a === "E" && s.x > 62) return "W";
      if (a === "W" && s.x < 38) return "E";
      return a;
    })();
    var pos = {
      left: `${s.x}%`,
      top: `${mapY(s.y)}%`
    };
    var off = 18;
    var hx = Math.max(0, Math.min(1, (s.x - 8) / 84));
    var shiftX = `${(-hx * 100).toFixed(1)}%`;
    var tx = {
      N: {
        transform: `translate(${shiftX}, calc(-100% - ${off}px))${counterRot}`
      },
      S: {
        transform: `translate(${shiftX}, ${off}px)${counterRot}`
      },
      E: {
        transform: `translate(${off}px, -50%)${counterRot}`
      },
      W: {
        transform: `translate(calc(-100% - ${off}px), -50%)${counterRot}`
      }
    }[anchor];
    return React.createElement("div", {
      key: s.id,
      role: "button",
      tabIndex: 0,
      "aria-label": `${s.name} stage`,
      onClick: e => {
        e.stopPropagation();
        onPickStage(s.id);
      },
      onKeyDown: e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPickStage(s.id);
        }
      },
      style: {
        position: "absolute",
        ...pos,
        ...tx,
        pointerEvents: "auto",
        cursor: "pointer",
        background: on ? s.color : "rgba(6,4,18,0.82)",
        color: on ? "#fff" : "rgba(255,255,255,0.88)",
        border: `1px solid ${on ? s.color : "rgba(255,255,255,0.18)"}`,
        padding: on ? "4px 10px" : "3px 9px",
        borderRadius: 999,
        fontFamily: "Geist Mono, monospace",
        fontSize: on ? 9.5 : 8.5,
        letterSpacing: 1.2,
        fontWeight: 700,
        whiteSpace: "nowrap",
        maxWidth: "46vw",
        overflow: "hidden",
        textOverflow: "ellipsis",
        boxShadow: on ? `0 4px 18px ${s.color}66, 0 0 8px ${s.color}33` : "0 1px 0 rgba(0,0,0,0.4), 0 2px 12px rgba(0,0,0,0.5)",
        transition: "all 0.15s"
      }
    }, React.createElement("span", {
      style: {
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 6,
        background: on ? "#fff" : s.color,
        marginRight: 6,
        verticalAlign: "1px",
        animation: liveArtist && !on ? "pulse 1.6s infinite" : "none"
      }
    }), label);
  }), friends.map(f => meetGroup.includes(f.id) && React.createElement("div", {
    key: f.id,
    style: {
      position: "absolute",
      left: `${f.x}%`,
      top: `${mapY(f.y)}%`,
      transform: `translate(-50%, 14px)${counterRot}`,
      background: f.color,
      color: "#fff",
      padding: "2px 7px",
      borderRadius: 999,
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      boxShadow: `0 3px 10px ${f.color}66`,
      pointerEvents: "none"
    }
  }, f.name.toUpperCase())), crewFriends.map(f => {
    var seen = formatLastSeen(f.ts);
    var initial = (f.name?.[0] || "?").toUpperCase();
    var atStage = f.stageId ? stages.find(s => s.id === f.stageId) : null;
    return React.createElement("div", {
      key: `crew-${f.id}`,
      style: {
        position: "absolute",
        left: `${f.x}%`,
        top: `${mapY(f.y)}%`,
        transform: `translate(-50%, calc(-100% - 4px))${counterRot}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        pointerEvents: "none",
        opacity: seen.freshness === "cold" ? 0.78 : 1
      }
    }, React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: 999,
        background: f.color,
        border: "2px solid rgba(255,255,255,0.95)",
        boxShadow: `0 4px 14px ${f.color}aa, 0 0 0 1px rgba(0,0,0,0.45)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "Instrument Serif, serif",
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1
      }
    }, initial), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "rgba(6,4,18,0.85)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.18)",
        padding: "2px 7px",
        borderRadius: 999,
        fontFamily: "Geist Mono, monospace",
        fontSize: 8,
        letterSpacing: 1.1,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }
    }, React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: 5,
        background: seen.color,
        animation: seen.freshness === "fresh" ? "pulse 1.6s infinite" : "none"
      }
    }), f.name.toUpperCase(), atStage && React.createElement("span", {
      style: {
        color: atStage.color,
        fontWeight: 700
      }
    }, "· ", (atStage.short || atStage.name).toUpperCase()), seen.label && seen.freshness !== "fresh" && React.createElement("span", {
      style: {
        color: "rgba(255,255,255,0.7)",
        fontWeight: 500
      }
    }, "· ", seen.label)));
  }), React.createElement("div", {
    style: {
      position: "absolute",
      left: `${avatar.x}%`,
      top: `${mapY(avatar.y)}%`,
      transform: `translate(-50%, -22px)${counterRot}`,
      background: "rgba(245,154,54,0.95)",
      color: "#fff",
      padding: "2px 8px",
      borderRadius: 999,
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700,
      pointerEvents: "none",
      boxShadow: "0 3px 10px rgba(245,154,54,0.45)"
    }
  }, "YOU"))), compass && React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 44,
      height: 44,
      borderRadius: 44,
      background: "rgba(247,237,224,0.92)",
      border: "1px solid var(--line-2)",
      boxShadow: "0 3px 10px rgba(26,18,13,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 5,
      pointerEvents: "none"
    }
  }, React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      position: "relative",
      transform: `rotate(${mapRotate}deg)`,
      transition: "transform 0.18s linear"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: "50%",
      transform: "translateX(-50%)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 8,
      fontWeight: 800,
      color: "#c14a4a",
      letterSpacing: 0.5
    }
  }, "N"), React.createElement("svg", {
    width: "32",
    height: "32",
    viewBox: "-16 -16 32 32",
    style: {
      position: "absolute",
      inset: 0
    }
  }, React.createElement("path", {
    d: "M0,-9 L2.5,2 L0,0 L-2.5,2 Z",
    fill: "#c14a4a"
  }), React.createElement("path", {
    d: "M0,9 L2.5,-2 L0,0 L-2.5,-2 Z",
    fill: "rgba(26,18,13,0.45)"
  }), React.createElement("circle", {
    cx: "0",
    cy: "0",
    r: "1.2",
    fill: "var(--ink)"
  })))));
}
function RideshareSheet({
  onClose
}) {
  if (!FESTIVAL_CONFIG.rideshareGps) {
    return React.createElement("div", {
      onClick: onClose,
      style: {
        position: "absolute",
        inset: 0,
        zIndex: 12,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        animation: "fadeIn .2s"
      }
    }, React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        background: "var(--paper)",
        color: "var(--ink)",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        width: "100%",
        padding: "28px 24px 36px",
        textAlign: "center"
      }
    }, React.createElement("div", {
      style: {
        width: 48,
        height: 48,
        borderRadius: "50%",
        margin: "0 auto 14px",
        background: "var(--paper-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22
      }
    }, "🚗"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 20,
        fontWeight: 400,
        marginBottom: 6
      }
    }, "Rideshare coming soon"), React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--muted)",
        lineHeight: 1.5,
        maxWidth: 260,
        margin: "0 auto"
      }
    }, "We're mapping pickup zones for ", FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name, ". Check back closer to the festival."), React.createElement("button", {
      onClick: onClose,
      className: "mono",
      style: {
        marginTop: 18,
        padding: "10px 32px",
        borderRadius: 10,
        border: "none",
        background: "var(--ink)",
        color: "var(--paper)",
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "GOT IT")));
  }
  var {
    lat,
    lng,
    label,
    note
  } = FESTIVAL_CONFIG.rideshareGps;
  var open = url => {
    window.open(url, "_blank", "noopener");
    onClose();
  };
  var nickname = encodeURIComponent(`${FESTIVAL_CONFIG.brand} Rideshare Pickup`);
  var uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${lat}&pickup[longitude]=${lng}&pickup[nickname]=${nickname}`;
  var lyftUrl = `https://lyft.com/ride?id=lyft&partner=&pickup[latitude]=${lat}&pickup[longitude]=${lng}`;
  return React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 12,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "flex-end",
      animation: "fadeIn .2s"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--paper)",
      color: "var(--ink)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      width: "100%",
      padding: "14px 20px 24px",
      boxShadow: "0 -10px 40px rgba(0,0,0,0.4)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 4,
      background: "var(--line-2)"
    }
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      color: "var(--muted)",
      marginBottom: 4
    }
  }, "RIDESHARE · ", label.toUpperCase()), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1.05,
      marginBottom: 10
    }
  }, "Get a ride from ", FESTIVAL_CONFIG.locationShort), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, note, " Pin pre-set so your driver finds you."), React.createElement("div", {
    style: {
      display: "grid",
      gap: 10
    }
  }, React.createElement("button", {
    onClick: () => open(uberUrl),
    style: {
      background: "#000",
      color: "#fff",
      border: "none",
      borderRadius: 12,
      padding: "14px 16px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 12,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "OPEN UBER"), React.createElement("button", {
    onClick: () => open(lyftUrl),
    style: {
      background: "#FF00BF",
      color: "#fff",
      border: "none",
      borderRadius: 12,
      padding: "14px 16px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 12,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "OPEN LYFT"), React.createElement("button", {
    onClick: onClose,
    style: {
      background: "transparent",
      color: "var(--muted)",
      border: "1px solid var(--line-2)",
      borderRadius: 12,
      padding: "12px 16px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "CANCEL")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 14,
      textAlign: "center"
    }
  }, "Universal links — opens app if installed, web otherwise.")));
}
function GroundPeek({
  stage,
  onClose
}) {
  return React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 160,
      height: 120,
      borderRadius: 12,
      overflow: "hidden",
      background: "#0a0414",
      border: "1px solid rgba(247,237,224,0.2)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      zIndex: 4
    }
  }, React.createElement("svg", {
    viewBox: "0 0 200 140",
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid slice"
  }, React.createElement("defs", null, React.createElement("linearGradient", {
    id: `peekSky-${stage.id}`,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#1a0a3d"
  }), React.createElement("stop", {
    offset: "60%",
    stopColor: "#3d1a5a"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#e85d2e"
  })), React.createElement("linearGradient", {
    id: `peekGnd-${stage.id}`,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#2a1530"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#0a0414"
  }))), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "200",
    height: "60",
    fill: `url(#peekSky-${stage.id})`
  }), React.createElement("rect", {
    x: "0",
    y: "60",
    width: "200",
    height: "80",
    fill: `url(#peekGnd-${stage.id})`
  }), React.createElement("rect", {
    x: "60",
    y: "30",
    width: "80",
    height: "40",
    fill: "#0a0414",
    stroke: stage.color,
    strokeWidth: "1.5"
  }), React.createElement("rect", {
    x: "72",
    y: "38",
    width: "56",
    height: "22",
    fill: stage.color,
    opacity: "0.9"
  }), React.createElement("rect", {
    x: "56",
    y: "24",
    width: "88",
    height: "4",
    fill: "#0a0414",
    stroke: stage.color,
    strokeWidth: "0.8"
  }), [-2, -1, 0, 1, 2].map(i => React.createElement("g", {
    key: i
  }, React.createElement("circle", {
    cx: 100 + i * 16,
    cy: 26,
    r: "1.3",
    fill: stage.color
  }), React.createElement("line", {
    x1: 100 + i * 16,
    y1: 26,
    x2: 100 + i * 16 + i * 6,
    y2: 10,
    stroke: stage.color,
    strokeWidth: "1",
    opacity: "0.4",
    strokeLinecap: "round"
  }))), React.createElement("path", {
    d: "M20,80 Q100,65 180,80 L180,95 L20,95 Z",
    fill: "#000",
    opacity: "0.8"
  }), React.createElement("rect", {
    x: "65",
    y: "108",
    width: "70",
    height: "14",
    rx: "7",
    fill: "rgba(10,4,20,0.9)",
    stroke: stage.color,
    strokeWidth: "0.8"
  }), React.createElement("text", {
    x: "100",
    y: "117",
    textAnchor: "middle",
    fill: stage.color,
    fontFamily: "Geist Mono, monospace",
    fontSize: "7",
    fontWeight: "700",
    letterSpacing: "1"
  }, stage.name.toUpperCase())), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 20,
      background: "rgba(10,4,20,0.85)",
      border: "1px solid rgba(247,237,224,0.3)",
      color: "#fff",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      padding: 0
    }
  }, "×"), React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 4,
      left: 4,
      fontFamily: "Geist Mono, monospace",
      fontSize: 8,
      letterSpacing: 1.2,
      color: "rgba(247,237,224,0.7)",
      background: "rgba(10,4,20,0.6)",
      padding: "2px 5px",
      borderRadius: 4
    }
  }, "GROUND VIEW"));
}
function _inkOn(hex) {
  try {
    var h = String(hex).replace("#", "");
    var n = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    var ch = i => {
      var v = parseInt(n.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    var L = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
    return L > 0.45 ? "#1a120d" : "#fff";
  } catch {
    return "#fff";
  }
}
function StageNavBar({
  stage,
  walk,
  onDetails,
  onStop
}) {
  var eta = walkMinsLabel(walk);
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onStop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStop]);
  return React.createElement("div", {
    style: {
      background: "var(--paper)",
      color: "var(--ink)",
      padding: "12px 14px calc(12px + env(safe-area-inset-bottom, 0px))",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      gap: 11,
      animation: "sheetUp 0.25s var(--ease-smooth)"
    }
  }, React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 40,
      background: stage.color,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: _inkOn(stage.color),
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M3 11l19-9-9 19-2-8-8-2z"
  }))), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      fontWeight: 700,
      color: "var(--muted)"
    }
  }, "ROUTING TO"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 19,
      lineHeight: 1.05,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, stage.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 600,
      marginTop: 1
    }
  }, eta ? `~${eta} MIN \u00b7 ` : "", "FOLLOW THE ROUTE")), React.createElement("button", {
    onClick: onDetails,
    "aria-label": "Show stage details",
    className: "mono",
    style: {
      flexShrink: 0,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      borderRadius: 999,
      padding: "9px 13px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "DETAILS"), React.createElement("button", {
    onClick: onStop,
    "aria-label": "Stop routing",
    className: "mono",
    style: {
      flexShrink: 0,
      background: "var(--ink)",
      border: "none",
      color: "var(--paper)",
      borderRadius: 999,
      padding: "9px 13px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 800
    }
  }, "✕ STOP"));
}
function BottomSheet({
  stage,
  nowAtStage,
  dist,
  walk,
  peek,
  setPeek,
  meetMode,
  meetTarget,
  friends,
  meetGroup = [],
  avatar,
  onClose,
  onCancelMeet,
  onOpenArtist,
  onGoHere,
  stageSaved,
  onToggleSave,
  state,
  setState
}) {
  if (meetMode && meetTarget) {
    var groupFriends = meetGroup.map(id => friends.find(fr => fr.id === id)).filter(Boolean);
    var youDist = Math.sqrt((meetTarget.x - avatar.x) ** 2 + (meetTarget.y - avatar.y) ** 2);
    var youMins = distToMins(youDist, avatar);
    var fEtas = groupFriends.map(f => ({
      f,
      mins: distToMins(Math.sqrt((meetTarget.x - f.x) ** 2 + (meetTarget.y - f.y) ** 2))
    }));
    var knownEtas = [youMins, ...fEtas.map(e => e.mins)].filter(m => m != null);
    var eta = knownEtas.length ? Math.max(...knownEtas) : null;
    var title = groupFriends.length === 0 ? "Pinned spot" : groupFriends.length === 1 ? `You + ${groupFriends[0].name}` : `Group · ${groupFriends.length + 1} people`;
    var routingLabel = groupFriends.length > 1 ? "ALL ROUTING LIVE" : groupFriends.length === 1 ? "BOTH ROUTING LIVE" : "ROUTING LIVE";
    return React.createElement("div", {
      style: {
        background: "var(--paper)",
        color: "var(--ink)",
        padding: "14px 16px 12px",
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        boxShadow: "0 -10px 30px rgba(0,0,0,0.4)"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10
      }
    }, React.createElement("div", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 38,
        background: "var(--ember)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }
    }, React.createElement("svg", {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "2"
    }, React.createElement("path", {
      d: "M12 2 C8 2 5 5 5 9 c0 5 7 13 7 13 s7-8 7-13 c0-4-3-7-7-7z"
    }), React.createElement("circle", {
      cx: "12",
      cy: "9",
      r: "2.5",
      fill: "#fff"
    }))), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--ember)",
        fontWeight: 700
      }
    }, "MEETING"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 20,
        lineHeight: 1.05
      }
    }, title), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--muted)",
        marginTop: 2
      }
    }, eta == null ? "" : `ETA ~${eta} MIN \u00b7 `, routingLabel)), React.createElement("button", {
      onClick: onCancelMeet,
      style: {
        background: "transparent",
        border: "1px solid var(--line-2)",
        color: "var(--muted)",
        borderRadius: 999,
        padding: "7px 10px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 600
      }
    }, "END")), React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        flex: "1 0 calc(50% - 4px)",
        background: "var(--paper-2)",
        borderRadius: 10,
        padding: "7px 10px"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.3,
        color: "var(--muted)"
      }
    }, "YOUR ETA"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        marginTop: 2
      }
    }, youMins == null ? React.createElement("span", {
      style: {
        fontSize: 11,
        color: "var(--muted)"
      }
    }, "UNSURVEYED") : React.createElement(React.Fragment, null, youMins, " ", React.createElement("span", {
      style: {
        fontSize: 11
      }
    }, "min")))), fEtas.map(({
      f,
      mins
    }) => React.createElement("div", {
      key: f.id,
      style: {
        flex: "1 0 calc(50% - 4px)",
        background: "var(--paper-2)",
        borderRadius: 10,
        padding: "7px 10px"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.3,
        color: f.color
      }
    }, f.name.toUpperCase(), " ETA"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        marginTop: 2
      }
    }, mins, " ", React.createElement("span", {
      style: {
        fontSize: 11
      }
    }, "min"))))));
  }
  if (!stage) return null;
  return React.createElement(StageLineupSheet, {
    stage: stage,
    walk: walk,
    dist: dist,
    distM: gridDistMeters(avatar.x, avatar.y, stage.x, stage.y, avatar),
    peek: peek,
    setPeek: setPeek,
    onClose: onClose,
    onOpenArtist: onOpenArtist,
    onGoHere: onGoHere,
    stageSaved: stageSaved,
    onToggleSave: onToggleSave,
    nowAtStage: nowAtStage,
    state: state,
    setState: setState
  });
}
function YourStagePhotosStrip({
  stageId,
  accent,
  onOpen,
  stageObj
}) {
  var [moments, setMoments] = React.useState(() => {
    try {
      return _readMoments();
    } catch {
      return {};
    }
  });
  React.useEffect(() => {
    var refresh = () => {
      try {
        setMoments(_readMoments());
      } catch {}
    };
    window.addEventListener("plursky-moments-change", refresh);
    refresh();
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  var mine = React.useMemo(() => {
    var out = [];
    for (var n of Object.keys(moments)) {
      var _loop2 = function (m) {
        if (!m.artistId) return 1;
        var a = ARTISTS.find(x => x.id === m.artistId);
        if (a?.stage === stageId) out.push(m);
      };
      for (var m of moments[n] || []) {
        if (_loop2(m)) continue;
      }
    }
    return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [moments, stageId]);
  if (mine.length === 0) return null;
  var preview = mine.slice(0, 6);
  var more = mine.length - preview.length;
  return React.createElement("div", {
    style: {
      marginBottom: 10,
      padding: "10px 12px",
      background: `${accent}14`,
      border: `1px solid ${accent}40`,
      borderRadius: 12
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 8
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: accent,
      fontWeight: 700
    }
  }, "◐ YOUR NIGHTS AT THIS STAGE"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 13,
      color: "var(--ink)",
      marginTop: 2
    }
  }, mine.length, " ", mine.length === 1 ? "memory" : "memories", " saved")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center"
    }
  }, stageObj && mine.length > 0 && React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => window._shareStageCollage?.(stageObj, mine),
    className: "mono",
    title: "Share a photo collage of your nights at this stage",
    style: {
      background: accent,
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "5px 11px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, "📸 SHARE"), React.createElement("button", {
    onClick: () => window._shareStageCollage?.(stageObj, mine, "gif"),
    className: "mono",
    title: "Share an animated GIF of your nights at this stage",
    style: {
      background: "#6D28D9",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "5px 11px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, "🎬 GIF")), React.createElement("button", {
    onClick: onOpen,
    className: "mono",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      padding: 0
    }
  }, "VIEW ALL →"))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      margin: "0 -2px",
      padding: "0 2px 2px",
      scrollbarWidth: "none",
      WebkitOverflowScrolling: "touch"
    }
  }, preview.map(m => React.createElement(_YourMomentThumb, {
    key: m.id,
    moment: m,
    accent: accent,
    onClick: () => onOpen(m.night)
  })), more > 0 && React.createElement("button", {
    onClick: onOpen,
    className: "mono",
    "aria-label": `View all ${mine.length} memories`,
    style: {
      width: 76,
      height: 76,
      flexShrink: 0,
      borderRadius: 10,
      background: "transparent",
      border: `1px dashed ${accent}66`,
      color: accent,
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, "+", more)));
}
function StageLineupSheet({
  stage,
  walk,
  dist,
  distM,
  peek,
  setPeek,
  onClose,
  onOpenArtist,
  onGoHere,
  stageSaved,
  onToggleSave,
  nowAtStage,
  state,
  setState
}) {
  var [day, setDay] = React.useState(NOW.day);
  var [expanded, setExpanded] = React.useState(false);
  var toSlot = t => {
    var h = parseInt(t.split(":")[0]);
    return h < 8 ? h + 24 : h;
  };
  var sets = ARTISTS.filter(a => a.stage === stage.id && a.day === day).sort((a, b) => toSlot(a.start) - toSlot(b.start));
  var totalAcrossDays = ARTISTS.filter(a => a.stage === stage.id).length;
  var heroInk = _inkOn(stage.color);
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return React.createElement("div", {
    style: {
      background: "var(--paper)",
      color: "var(--ink)",
      padding: "0 0 10px",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
      maxHeight: expanded ? "72vh" : "auto",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      animation: "sheetUp 0.3s var(--ease-smooth)"
    }
  }, React.createElement("div", {
    style: {
      background: stage.color,
      color: heroInk,
      padding: "6px 16px 12px",
      position: "relative"
    }
  }, React.createElement("div", {
    onClick: () => setExpanded(e => !e),
    style: {
      display: "flex",
      justifyContent: "center",
      cursor: "pointer",
      padding: "2px 0 8px"
    }
  }, React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 4,
      background: heroInk === "#fff" ? "rgba(255,255,255,0.55)" : "rgba(26,18,13,0.45)"
    }
  })), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      fontWeight: 700,
      opacity: 0.85,
      marginBottom: 3
    }
  }, stage.short, " · STAGE"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1,
      letterSpacing: -0.3
    }
  }, stage.name)), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: heroInk === "#fff" ? "rgba(255,255,255,0.22)" : "rgba(26,18,13,0.14)",
      border: `1px solid ${heroInk === "#fff" ? "rgba(255,255,255,0.35)" : "rgba(26,18,13,0.25)"}`,
      color: heroInk,
      borderRadius: 999,
      width: 30,
      height: 30,
      padding: 0,
      cursor: "pointer",
      fontSize: 16,
      fontWeight: 700,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(6px)"
    }
  }, "×"))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 6,
      padding: "10px 14px 0"
    }
  }, [walk.known === false ? {
    label: "WALK",
    value: "—",
    unit: "",
    note: "UNSURVEYED"
  } : {
    label: "WALK",
    value: walkMinsLabel(walk),
    unit: "min",
    note: walk.peak ? "PEAK" : walk.plan ? "PLAN 20+" : null
  }, distM == null ? {
    label: "DISTANCE",
    value: "—",
    unit: "",
    note: "UNSURVEYED"
  } : {
    label: "DISTANCE",
    value: `${distM}`,
    unit: "m",
    note: null
  }, {
    label: "SETS",
    value: `${sets.length}`,
    unit: day === NOW.day ? "today" : "set day",
    note: `${totalAcrossDays} · ${DAYS.length} NIGHTS`
  }].map(c => React.createElement("div", {
    key: c.label,
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "8px 10px",
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, c.label), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1,
      marginTop: 3,
      color: "var(--ink)"
    }
  }, c.value, c.unit ? React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 400,
      color: "var(--muted)"
    }
  }, " ", c.unit) : null), c.note && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.8,
      color: "var(--muted)",
      fontWeight: 700,
      marginTop: 2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, c.note)))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "8px 14px 0"
    }
  }, React.createElement("button", {
    onClick: () => onGoHere?.(stage),
    className: "mono",
    style: {
      flex: 2,
      background: stage.color,
      color: heroInk,
      border: "none",
      borderRadius: 12,
      padding: "11px 10px",
      cursor: "pointer",
      fontSize: 11,
      letterSpacing: 1.2,
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6
    }
  }, React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: heroInk,
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M3 11l19-9-9 19-2-8-8-2z"
  })), "GO HERE"), React.createElement("button", {
    onClick: () => setPeek(p => !p),
    "aria-pressed": peek,
    className: "mono",
    style: {
      flex: 1,
      background: peek ? stage.color : "var(--paper-2)",
      color: peek ? "#fff" : "var(--ink)",
      border: peek ? "none" : "1px solid var(--line-2)",
      borderRadius: 12,
      padding: "11px 8px",
      cursor: "pointer",
      fontSize: 11,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, peek ? "◉ PEEK" : "◯ PEEK"), React.createElement("button", {
    onClick: () => onToggleSave?.(stage.id),
    "aria-pressed": !!stageSaved,
    "aria-label": stageSaved ? "Saved — remove this stage" : "Save this stage",
    className: "mono",
    style: {
      flex: 1,
      background: stageSaved ? "rgba(232,93,46,0.12)" : "var(--paper-2)",
      color: stageSaved ? "var(--ember)" : "var(--ink)",
      border: stageSaved ? "1px solid rgba(232,93,46,0.45)" : "1px solid var(--line-2)",
      borderRadius: 12,
      padding: "11px 8px",
      cursor: "pointer",
      fontSize: 11,
      letterSpacing: 1.2,
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 5
    }
  }, stageSaved ? "♥ SAVED" : "♡ SAVE")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "8px 14px 2px"
    }
  }, React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "lineup",
      lineupDay: day,
      stageFilter: stage.id
    }),
    className: "mono",
    style: {
      flex: 1,
      background: "transparent",
      border: "1px solid var(--line-2)",
      color: "var(--muted)",
      borderRadius: 999,
      padding: "7px 13px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, "☰ FULL LINEUP"), walk.known !== false && walk.lo > 25 && React.createElement("div", {
    className: "mono",
    style: {
      flexShrink: 0,
      background: "rgba(193,74,74,0.1)",
      border: "1px solid rgba(193,74,74,0.35)",
      color: "#c14a4a",
      borderRadius: 999,
      padding: "7px 13px",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center"
    }
  }, "↗ FAR · ", walk.lo, " MIN")), React.createElement("div", {
    style: {
      padding: "6px 14px 0"
    }
  }, stage.vibe && React.createElement("div", {
    style: {
      marginBottom: 10,
      padding: "9px 11px",
      borderRadius: 12,
      background: "var(--paper-2)",
      borderLeft: `3px solid ${stage.color}`
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      fontWeight: 800,
      color: stage.color,
      textTransform: "uppercase"
    }
  }, stage.vibe), stage.peak && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 600
    }
  }, "PEAKS ", stage.peak)), stage.vibeNote && React.createElement("div", {
    style: {
      fontSize: 12,
      lineHeight: 1.35,
      color: "var(--ink)",
      marginTop: 4
    }
  }, stage.vibeNote)), React.createElement(YourStagePhotosStrip, {
    stageId: stage.id,
    accent: stage.color,
    stageObj: stage,
    onOpen: n => setState({
      ...state,
      tab: "memories",
      memoriesNight: n || NOW.day,
      focusStage: null
    })
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginBottom: 10
    }
  }, DAYS.map(d => {
    var on = d.n === day;
    var count = ARTISTS.filter(a => a.stage === stage.id && a.day === d.n).length;
    return React.createElement("button", {
      key: d.n,
      onClick: () => {
        setDay(d.n);
        setExpanded(true);
      },
      style: {
        flex: 1,
        padding: "7px 6px",
        borderRadius: 8,
        background: on ? stage.color : "var(--paper-2)",
        color: on ? "#fff" : "var(--ink)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1
      }
    }, React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        opacity: on ? 0.85 : 0.55,
        fontWeight: 600
      }
    }, d.label), React.createElement("span", {
      className: "serif",
      style: {
        fontSize: 13,
        lineHeight: 1
      }
    }, count, " ", React.createElement("span", {
      style: {
        fontSize: 9,
        opacity: 0.7
      }
    }, "sets")));
  })), day === NOW.day && nowAtStage && React.createElement("div", {
    onClick: () => onOpenArtist(nowAtStage.id),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 10px",
      marginBottom: 8,
      background: stage.color,
      color: "#fff",
      borderRadius: 12,
      cursor: "pointer"
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 7,
      background: "#fff",
      boxShadow: "0 0 0 4px rgba(255,255,255,0.3)",
      animation: "pulse 1.6s infinite",
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      fontWeight: 700,
      opacity: 0.9
    }
  }, "ON STAGE NOW"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      lineHeight: 1.05
    }
  }, nowAtStage.name)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      opacity: 0.9,
      whiteSpace: "nowrap"
    }
  }, fmt12(nowAtStage.start), "–", fmt12(nowAtStage.end))), React.createElement("div", {
    style: {
      overflowY: "auto",
      flex: 1,
      maxHeight: expanded ? "50vh" : 180,
      paddingBottom: 6
    }
  }, sets.length === 0 && React.createElement("div", {
    style: {
      padding: "20px 0",
      textAlign: "center"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      fontStyle: "italic",
      color: "var(--muted)"
    }
  }, "No sets scheduled — stage dark tonight")), sets.map(s => {
    var live = s.id === NOW.currentArtistId && day === NOW.day;
    var isSaved = state?.saved?.includes(s.id);
    var toggleSaveSet = e => {
      e.stopPropagation();
      if (!state || !setState) return;
      var next = isSaved ? state.saved.filter(id => id !== s.id) : [...state.saved, s.id];
      setState({
        ...state,
        saved: next
      });
    };
    return React.createElement("div", {
      key: s.id,
      onClick: () => onOpenArtist(s.id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 4px",
        borderBottom: "1px solid var(--line)",
        cursor: "pointer",
        opacity: live ? 1 : 0.92
      }
    }, React.createElement("div", {
      style: {
        width: 52,
        flexShrink: 0
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 0.3,
        fontWeight: 600,
        color: live ? stage.color : "var(--ink)"
      }
    }, fmt12(s.start)), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 0.8,
        color: "var(--muted)"
      }
    }, fmt12(s.end))), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        lineHeight: 1.1,
        letterSpacing: -0.2
      }
    }, s.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 2
      }
    }, s.genre.toUpperCase())), live && React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.3,
        fontWeight: 700,
        color: "#fff",
        background: stage.color,
        padding: "2px 6px",
        borderRadius: 4
      }
    }, "LIVE"), React.createElement("button", {
      onClick: toggleSaveSet,
      "aria-pressed": isSaved,
      "aria-label": isSaved ? `Remove ${s.name} from saved sets` : `Save ${s.name}`,
      style: {
        background: isSaved ? "var(--ember)" : "transparent",
        border: `1px solid ${isSaved ? "var(--ember)" : "var(--line-2)"}`,
        color: isSaved ? "#fff" : "var(--muted)",
        borderRadius: 999,
        width: 28,
        height: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        fontSize: 13,
        transition: "all .15s"
      }
    }, isSaved ? "✓" : "+"));
  })), !expanded && sets.length > 3 && React.createElement("button", {
    onClick: () => setExpanded(true),
    style: {
      marginTop: 4,
      padding: "8px",
      background: "transparent",
      border: "none",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      cursor: "pointer",
      fontWeight: 600
    }
  }, "SEE ALL ", sets.length, " SETS ↓")));
}
function _crewRowToThreadItem(row, myPid) {
  return {
    id: row.id,
    from: row.sender_pid === myPid ? "me" : "them",
    text: row.body,
    ts: new Date(row.created_at).getTime(),
    status: "sent"
  };
}
function MessageDrawer({
  friend,
  myPresId,
  avatarStage,
  saved = [],
  onClose,
  onSwitchToMeet
}) {
  var isRealDM = !!(myPresId && friend.presId && typeof sbDMSend === "function");
  var myName = (() => {
    try {
      return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || "Me";
    } catch {
      return "Me";
    }
  })();
  var [thread, setThread] = React.useState(() => loadThread(friend.id));
  var [draft, setDraft] = React.useState("");
  var [typing, setTyping] = React.useState(false);
  var scrollerRef = React.useRef(null);
  var replyTimer = React.useRef(null);
  var threadRef = React.useRef(thread);
  threadRef.current = thread;
  React.useEffect(() => {
    markRead(friend.id);
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, [friend.id]);
  React.useEffect(() => {
    if (!isRealDM) return;
    var cancelled = false;
    sbDMFetchMessages(myPresId, friend.presId).then(rows => {
      if (cancelled) return;
      var server = rows.map(r => _crewRowToThreadItem(r, myPresId));
      var localPending = threadRef.current.filter(m => m.status === "queued");
      var next = [...server, ...localPending];
      setThread(next);
      saveThread(friend.id, next);
    }).catch(() => {});
    var unsub = sbDMSubscribe(myPresId, friend.presId, row => {
      if (row.sender_pid === myPresId) return;
      var incoming = _crewRowToThreadItem(row, myPresId);
      if (threadRef.current.some(m => m.id === incoming.id)) return;
      var updated = [...threadRef.current, incoming];
      setThread(updated);
      saveThread(friend.id, updated);
      setTyping(false);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isRealDM, myPresId, friend.presId]);
  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [thread, typing]);
  var friendStage = STAGES.find(s => s.id === friendStatus(friend.id)?.stage);
  var status = friendStatus(friend.id);
  var statusAge = status ? Math.round((Date.now() - status.ts) / 60000) : null;
  var send = async text => {
    var trimmed = text.trim();
    if (!trimmed) return;
    var stamped = trimmed + (avatarStage && /(my (loc|spot)|where|here)/i.test(trimmed) && !/[a-z]field|stage/i.test(trimmed) ? ` (${STAGES.find(s => s.id === avatarStage)?.short || ""})` : "");
    var optimisticTs = Date.now();
    var optimistic = {
      from: "me",
      text: stamped,
      ts: optimisticTs,
      status: navigator.onLine ? "sent" : "queued"
    };
    var newThread = [...thread, optimistic];
    setThread(newThread);
    saveThread(friend.id, newThread);
    setDraft("");
    if (isRealDM) {
      var {
        error
      } = await sbDMSend(myPresId, friend.presId, myName, stamped);
      if (error && error !== "queued") {
        setThread(prev => prev.map(m => m.ts === optimisticTs && m.from === "me" ? {
          ...m,
          status: "failed"
        } : m));
      }
    } else {
      var [reply, delay] = _fakeReply(stamped);
      setTyping(true);
      replyTimer.current = setTimeout(() => {
        setTyping(false);
        var next = [...newThread, {
          from: "them",
          text: reply,
          ts: Date.now()
        }];
        setThread(next);
        saveThread(friend.id, next);
      }, delay);
    }
  };
  var sendNativeSMS = async () => {
    var text = `(via Plursky) at ${avatarStage ? STAGES.find(s => s.id === avatarStage)?.name : "EDC"} — meet up?`;
    if (navigator.share) {
      try {
        await navigator.share({
          text,
          title: `to ${friend.name}`
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };
  var fmtTime = ts => {
    var d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  };
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 50
    }
  }, React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      animation: "fadeIn .2s"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      background: "var(--paper)",
      color: "var(--ink)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      height: "82%",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 -14px 36px rgba(0,0,0,0.45)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11,
      padding: "14px 16px 12px",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 42,
      background: friend.avatarTone,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Instrument Serif, serif",
      fontSize: 20,
      position: "relative",
      flexShrink: 0
    }
  }, friend.name[0], !navigator.onLine ? null : React.createElement("div", {
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
      fontSize: 22,
      lineHeight: 1
    }
  }, friend.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 3,
      textTransform: "uppercase",
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, friendStage ? `${friendStage.name} · ${statusAge}m AGO` : "STATUS UNKNOWN", isRealDM && React.createElement("span", {
    style: {
      color: "var(--success)",
      letterSpacing: 1
    }
  }, "● LIVE"))), React.createElement("button", {
    onClick: onSwitchToMeet,
    title: "Meet here",
    style: {
      background: "transparent",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      borderRadius: 999,
      padding: "7px 10px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "📍 MEET"), React.createElement("button", {
    onClick: sendNativeSMS,
    title: "Open in Messages",
    style: {
      background: "transparent",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      borderRadius: 999,
      padding: "7px 10px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "SMS"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--muted)",
      padding: 4,
      fontSize: 22,
      lineHeight: 1
    }
  }, "×")), !navigator.onLine && React.createElement("div", {
    style: {
      padding: "5px 16px",
      background: "rgba(232,93,46,0.08)",
      borderBottom: "1px solid rgba(232,93,46,0.18)"
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--ember)",
      fontWeight: 700
    }
  }, "⚠ OFFLINE · MESSAGES QUEUE & SEND WHEN YOU'RE BACK ONLINE")), React.createElement("div", {
    ref: scrollerRef,
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "14px 16px"
    }
  }, thread.length === 0 && React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 32
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      color: "var(--muted)",
      fontStyle: "italic"
    }
  }, "No messages yet"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 6
    }
  }, "TAP A QUICK REPLY ↓")), thread.map((m, i) => {
    var mine = m.from === "me";
    var showTime = i === 0 || m.ts - thread[i - 1].ts > 1000 * 60 * 5;
    return React.createElement(React.Fragment, {
      key: i
    }, showTime && React.createElement("div", {
      className: "mono",
      style: {
        textAlign: "center",
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        margin: "8px 0 6px",
        textTransform: "uppercase"
      }
    }, fmtTime(m.ts)), React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        marginBottom: 4
      }
    }, React.createElement("div", {
      style: {
        maxWidth: "76%",
        padding: "8px 12px",
        borderRadius: 18,
        background: mine ? "var(--ember)" : "var(--paper-2)",
        color: mine ? "#fff" : "var(--ink)",
        fontSize: 14,
        lineHeight: 1.35,
        borderBottomRightRadius: mine ? 6 : 18,
        borderBottomLeftRadius: mine ? 18 : 6
      }
    }, m.text)), mine && m.status === "queued" && i === thread.length - 1 && React.createElement("div", {
      className: "mono",
      style: {
        textAlign: "right",
        fontSize: 8,
        letterSpacing: 1.2,
        color: "var(--ember)",
        marginRight: 4,
        marginBottom: 4
      }
    }, "QUEUED"));
  }), typing && React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-start",
      marginBottom: 4
    }
  }, React.createElement("div", {
    style: {
      padding: "10px 14px",
      borderRadius: 18,
      background: "var(--paper-2)",
      display: "flex",
      gap: 4,
      borderBottomLeftRadius: 6
    }
  }, [0, 1, 2].map(i => React.createElement("span", {
    key: i,
    style: {
      width: 6,
      height: 6,
      borderRadius: 6,
      background: "var(--muted)",
      animation: `tdot 1.2s ${i * 0.15}s infinite`
    }
  }))))), React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto",
      scrollbarWidth: "none",
      padding: "8px 14px 6px",
      borderTop: "1px solid var(--line)"
    }
  }, (() => {
    var myStage = avatarStage ? STAGES.find(s => s.id === avatarStage) : null;
    var friendStage = friend?.stage ? STAGES.find(s => s.id === friend.stage) : null;
    var nextSavedSet = saved && saved.length ? findNextSavedSet(saved) : null;
    var smart = buildSmartReplies({
      myStage,
      friendStage,
      nextSavedSet
    });
    var all = [...smart, ...QUICK_REPLIES];
    return all.map((qr, i) => React.createElement("button", {
      key: `${qr.tag}-${i}`,
      onClick: () => send(qr.text),
      className: "mono",
      style: {
        flexShrink: 0,
        padding: "6px 11px",
        borderRadius: 999,
        background: qr.smart ? "var(--ember)" : "var(--paper-2)",
        color: qr.smart ? "#fff" : "var(--ink)",
        border: qr.smart ? "none" : "1px solid var(--line-2)",
        fontSize: 10,
        letterSpacing: 1.1,
        fontWeight: 600,
        cursor: "pointer",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 4
      }
    }, qr.smart && React.createElement("span", {
      style: {
        fontSize: 9
      }
    }, "✨"), qr.tag));
  })()), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px 14px"
    }
  }, React.createElement("input", {
    type: "text",
    placeholder: "Message…",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") send(draft);
    },
    style: {
      flex: 1,
      padding: "10px 14px",
      borderRadius: 999,
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      fontFamily: "Geist, sans-serif",
      fontSize: 14,
      color: "var(--ink)",
      outline: "none"
    }
  }), React.createElement("button", {
    onClick: () => send(draft),
    disabled: !draft.trim(),
    "aria-label": "Send message",
    style: {
      width: 38,
      height: 38,
      borderRadius: 38,
      background: draft.trim() ? "var(--ember)" : "var(--line-2)",
      color: "#fff",
      border: "none",
      cursor: draft.trim() ? "pointer" : "default",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background .2s"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M12 19 V5"
  }), React.createElement("path", {
    d: "M5 12 L12 5 L19 12"
  }))))));
}
Object.assign(window, {
  MapScreen,
  getMyPingCode,
  WALK_PAIRS,
  _pairKey
});
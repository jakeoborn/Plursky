var SURVEY_KEY = "plursky_survey_v1";
var SURVEY_FLAG = "plursky_survey_enabled";
var SURVEY_MAX_ACCURACY_M = 25;
function surveyEnabled() {
  try {
    var p = new URLSearchParams(location.search);
    if (p.get("survey") === "1") localStorage.setItem(SURVEY_FLAG, "1");
    if (p.get("survey") === "0") localStorage.removeItem(SURVEY_FLAG);
    return localStorage.getItem(SURVEY_FLAG) === "1";
  } catch {
    return false;
  }
}
function readSurvey() {
  try {
    return JSON.parse(localStorage.getItem(SURVEY_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeSurvey(sessions) {
  try {
    localStorage.setItem(SURVEY_KEY, JSON.stringify(sessions));
  } catch {}
}
function _surveyM(lat1, lng1, lat2, lng2) {
  var R = 6371000,
    p = Math.PI / 180;
  var dLat = (lat2 - lat1) * p,
    dLng = (lng2 - lng1) * p;
  var a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function surveyCentroid(samples) {
  if (!samples.length) return null;
  var lat = samples.reduce((s, x) => s + x.lat, 0) / samples.length;
  var lng = samples.reduce((s, x) => s + x.lng, 0) / samples.length;
  return {
    lat,
    lng
  };
}
function surveySpreadM(samples, centroid) {
  if (!centroid || samples.length < 2) return 0;
  return Math.round(Math.max(...samples.map(s => _surveyM(centroid.lat, centroid.lng, s.lat, s.lng))));
}
function surveyRollup(festivalId) {
  var byStage = new Map();
  for (var s of readSurvey()) {
    if (s.festivalId !== festivalId || !s.samples?.length) continue;
    if (!byStage.has(s.stageId)) byStage.set(s.stageId, []);
    byStage.get(s.stageId).push(s);
  }
  return [...byStage.entries()].map(([stageId, sessions]) => {
    var samples = sessions.flatMap(s => s.samples);
    var centroid = surveyCentroid(samples);
    var spreadM = surveySpreadM(samples, centroid);
    var nights = new Set(sessions.map(s => new Date(s.startedAt).toDateString())).size;
    var soleSetInWindow = sessions.every(s => s.soleSet === true);
    var asked = sessions.every(s => s.soleSet != null);
    return {
      stageId,
      sessions,
      centroid,
      spreadM,
      nights,
      n: samples.length,
      soleSetInWindow,
      asked,
      ok: samples.length >= 3 && spreadM < 100 && soleSetInWindow
    };
  }).sort((a, b) => a.stageId.localeCompare(b.stageId));
}
function surveyExportBlock(festivalId) {
  var rows = surveyRollup(festivalId).filter(r => r.ok);
  if (!rows.length) return "";
  var date = new Date().toISOString().slice(0, 10);
  var src = `jake-${festivalId.replace(/-20\d\d$/, "")}${new Date().getFullYear()}-survey`;
  var body = rows.map(r => `    { stageId: ${JSON.stringify(r.stageId)}, lat: ${r.centroid.lat.toFixed(6)}, lng: ${r.centroid.lng.toFixed(6)}, n: ${r.n}, nights: ${r.nights},\n` + `      spreadM: ${r.spreadM}, soleSetInWindow: true, measuredAt: ${JSON.stringify(date)},\n` + `      source: ${JSON.stringify(src)} },`).join("\n");
  return `  // Captured in-app during ${festivalId}. spreadM is the furthest sample\n` + `  // from the centroid. Crowd positions — do NOT paste into gpsAnchors.\n` + `  crowdAnchors: [\n${body}\n  ],`;
}
function useSurveyRecorder() {
  var [active, setActive] = React.useState(null);
  var [lastFix, setLastFix] = React.useState(null);
  var [rejected, setRejected] = React.useState(0);
  var [error, setError] = React.useState(null);
  var watchRef = React.useRef(null);
  var stop = React.useCallback((keep = true) => {
    if (watchRef.current != null) {
      try {
        navigator.geolocation.clearWatch(watchRef.current);
      } catch {}
      watchRef.current = null;
    }
    setActive(cur => {
      if (cur && keep && cur.samples.length) {
        writeSurvey([...readSurvey(), {
          ...cur,
          endedAt: Date.now(),
          soleSet: null,
          id: `${cur.stageId}-${cur.startedAt}`
        }]);
      }
      return null;
    });
    setLastFix(null);
    setRejected(0);
  }, []);
  var start = React.useCallback(stageId => {
    if (!navigator.geolocation) {
      setError("This device has no geolocation.");
      return;
    }
    setError(null);
    setRejected(0);
    setActive({
      stageId,
      festivalId: FESTIVAL_CONFIG.id,
      startedAt: Date.now(),
      samples: []
    });
    watchRef.current = navigator.geolocation.watchPosition(p => {
      var acc = p.coords.accuracy;
      if (!(acc <= SURVEY_MAX_ACCURACY_M)) {
        setRejected(r => r + 1);
        setLastFix({
          acc,
          kept: false
        });
        return;
      }
      setLastFix({
        acc,
        kept: true
      });
      setActive(cur => cur && {
        ...cur,
        samples: [...cur.samples, {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          acc,
          ts: Date.now()
        }]
      });
    }, e => setError(e.code === 1 ? "Location permission denied." : "Could not get a fix."), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    });
  }, []);
  React.useEffect(() => () => {
    if (watchRef.current != null) {
      try {
        navigator.geolocation.clearWatch(watchRef.current);
      } catch {}
    }
  }, []);
  var centroid = active ? surveyCentroid(active.samples) : null;
  return {
    active,
    lastFix,
    rejected,
    error,
    start,
    stop,
    spreadM: active ? surveySpreadM(active.samples, centroid) : 0
  };
}
function SurveyPanel({
  onClose,
  nearestStageId
}) {
  var rec = useSurveyRecorder();
  var [tick, setTick] = React.useState(0);
  var [pick, setPick] = React.useState(nearestStageId || STAGES[0] && STAGES[0].id);
  var [copied, setCopied] = React.useState(false);
  var rollup = React.useMemo(() => surveyRollup(FESTIVAL_CONFIG.id), [tick, rec.active]);
  var shipping = rollup.filter(r => r.ok).length;
  var pending = rollup.filter(r => !r.asked && r.n >= 3);
  var answer = (stageId, yes) => {
    writeSurvey(readSurvey().map(s => s.stageId === stageId && s.festivalId === FESTIVAL_CONFIG.id && s.soleSet == null ? {
      ...s,
      soleSet: yes
    } : s));
    setTick(t => t + 1);
  };
  var drop = stageId => {
    writeSurvey(readSurvey().filter(s => !(s.stageId === stageId && s.festivalId === FESTIVAL_CONFIG.id)));
    setTick(t => t + 1);
  };
  var copy = async () => {
    var text = surveyExportBlock(FESTIVAL_CONFIG.id);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied("manual");
    }
  };
  var L = {
    fontFamily: "Geist Mono, monospace",
    fontSize: 9,
    letterSpacing: 1.3,
    fontWeight: 700,
    color: "var(--muted)"
  };
  var btn = (bg, fg) => ({
    background: bg,
    color: fg,
    border: "none",
    borderRadius: 999,
    padding: "9px 16px",
    cursor: "pointer",
    fontFamily: "Geist Mono, monospace",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: 700
  });
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 40,
      background: "rgba(26,18,13,0.55)",
      display: "flex",
      alignItems: "flex-end"
    }
  }, React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0
    }
  }), React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      maxHeight: "88%",
      overflowY: "auto",
      background: "var(--paper)",
      color: "var(--ink)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: "14px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
      boxShadow: "0 -10px 30px rgba(0,0,0,0.4)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 2
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      flex: 1
    }
  }, "Crowd survey"), React.createElement("button", {
    onClick: onClose,
    style: {
      ...btn("transparent", "var(--muted)"),
      border: "1px solid var(--line-2)",
      padding: "6px 12px"
    }
  }, "DONE")), React.createElement("div", {
    style: {
      ...L,
      marginBottom: 12,
      letterSpacing: 1,
      lineHeight: 1.5,
      textTransform: "none",
      fontWeight: 500,
      fontSize: 10.5
    }
  }, "Where people ", React.createElement("em", null, "stand"), " to watch a stage — this fixes photo tagging. It is not a map measurement and never goes into gpsAnchors."), rec.error && React.createElement("div", {
    style: {
      background: "rgba(193,74,74,0.10)",
      border: "1px solid rgba(193,74,74,0.35)",
      color: "#c14a4a",
      borderRadius: 10,
      padding: "9px 11px",
      marginBottom: 10,
      fontSize: 12
    }
  }, rec.error), rec.active ? React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "12px 13px",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 10,
      background: "var(--ember)",
      animation: "pulse 1.6s infinite"
    }
  }), React.createElement("span", {
    style: L
  }, "RECORDING · ", (STAGES.find(s => s.id === rec.active.stageId) || {}).short || rec.active.stageId)), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 30,
      lineHeight: 1.05,
      marginTop: 6
    }
  }, rec.active.samples.length, " ", React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--muted)"
    }
  }, "fixes · spread ", rec.spreadM, " m")), React.createElement("div", {
    style: {
      ...L,
      marginTop: 4,
      fontWeight: 500,
      letterSpacing: 0.6,
      textTransform: "none",
      fontSize: 10.5
    }
  }, rec.active.samples.length < 3 ? "Needs 3 to ship. Stay for the set and move about the crowd as you normally would." : rec.spreadM >= 100 ? "Spread is over 100 m — this is reading as two spots, not one. It will not ship." : "Enough to ship. Longer is better.", rec.rejected > 0 && ` ${rec.rejected} fix${rec.rejected > 1 ? "es" : ""} dropped as too coarse (> ${SURVEY_MAX_ACCURACY_M} m).`, rec.lastFix && ` Last fix ±${Math.round(rec.lastFix.acc)} m.`), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 11
    }
  }, React.createElement("button", {
    onClick: () => {
      rec.stop(true);
      setTick(t => t + 1);
    },
    style: {
      ...btn("var(--ink)", "var(--paper)"),
      flex: 1
    }
  }, "■ STOP & KEEP"), React.createElement("button", {
    onClick: () => rec.stop(false),
    style: {
      ...btn("transparent", "var(--muted)"),
      border: "1px solid var(--line-2)"
    }
  }, "DISCARD"))) : React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "12px 13px",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: L
  }, "YOU ARE STANDING AT"), React.createElement("select", {
    value: pick,
    onChange: e => setPick(e.target.value),
    style: {
      width: "100%",
      marginTop: 6,
      padding: "9px 10px",
      borderRadius: 10,
      border: "1px solid var(--line-2)",
      background: "var(--paper)",
      color: "var(--ink)",
      fontFamily: "Geist, sans-serif",
      fontSize: 14
    }
  }, STAGES.map(s => React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name))), React.createElement("button", {
    onClick: () => rec.start(pick),
    style: {
      ...btn("var(--ember)", "#fff"),
      width: "100%",
      marginTop: 9
    }
  }, "● START RECORDING")), pending.map(r => React.createElement("div", {
    key: r.stageId,
    style: {
      background: "rgba(245,154,54,0.10)",
      border: "1px solid rgba(245,154,54,0.4)",
      borderRadius: 12,
      padding: "10px 12px",
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.45
    }
  }, "At ", React.createElement("strong", null, (STAGES.find(s => s.id === r.stageId) || {}).name || r.stageId), ", was exactly ", React.createElement("strong", null, "one"), " set you were watching live for that whole window?"), React.createElement("div", {
    style: {
      ...L,
      marginTop: 3,
      fontWeight: 500,
      letterSpacing: 0.6,
      textTransform: "none",
      fontSize: 10
    }
  }, "If you drifted between two stages the centroid anchors neither. Nothing can check this but you."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 9
    }
  }, React.createElement("button", {
    onClick: () => answer(r.stageId, true),
    style: {
      ...btn("var(--ink)", "var(--paper)"),
      flex: 1
    }
  }, "YES — ONE SET"), React.createElement("button", {
    onClick: () => answer(r.stageId, false),
    style: {
      ...btn("transparent", "var(--muted)"),
      border: "1px solid var(--line-2)",
      flex: 1
    }
  }, "NO / UNSURE")))), React.createElement("div", {
    style: {
      ...L,
      marginTop: 4,
      marginBottom: 6
    }
  }, "CAPTURED · ", shipping, " OF 3 STAGES SHIPPABLE"), rollup.length === 0 && React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--muted)",
      marginBottom: 10
    }
  }, "Nothing recorded yet."), rollup.map(r => {
    var st = STAGES.find(s => s.id === r.stageId);
    var why = r.n < 3 ? `only ${r.n} fix${r.n > 1 ? "es" : ""}` : r.spreadM >= 100 ? `spread ${r.spreadM} m` : !r.asked ? "needs the one-set answer" : !r.soleSetInWindow ? "more than one set in the window" : null;
    return React.createElement("div", {
      key: r.stageId,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 11px",
        marginBottom: 6,
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: 12
      }
    }, React.createElement("span", {
      style: {
        width: 5,
        alignSelf: "stretch",
        borderRadius: 3,
        background: st && st.color || "var(--line-2)"
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "Geist, sans-serif",
        fontSize: 13.5,
        fontWeight: 600
      }
    }, st && st.name || r.stageId), React.createElement("div", {
      style: {
        ...L,
        fontWeight: 500,
        letterSpacing: 0.6,
        textTransform: "none",
        fontSize: 10.5
      }
    }, "n=", r.n, " · spread ", r.spreadM, " m · ", r.nights, " day", r.nights > 1 ? "s" : "", why ? ` · ${why}` : "")), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700,
        color: r.ok ? "var(--success)" : "var(--muted)"
      }
    }, r.ok ? "SHIPPABLE" : "HELD"), React.createElement("button", {
      onClick: () => drop(r.stageId),
      "aria-label": `Delete ${r.stageId} survey`,
      style: {
        ...btn("transparent", "var(--muted)"),
        border: "1px solid var(--line-2)",
        padding: "5px 9px",
        fontSize: 10
      }
    }, "✕"));
  }), shipping > 0 && React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: copy,
    style: {
      ...btn("var(--ink)", "var(--paper)"),
      width: "100%",
      marginTop: 8
    }
  }, copied === true ? "✓ COPIED" : `COPY crowdAnchors BLOCK · ${shipping} STAGE${shipping > 1 ? "S" : ""}`), copied === "manual" && React.createElement("textarea", {
    readOnly: true,
    value: surveyExportBlock(FESTIVAL_CONFIG.id),
    onFocus: e => e.target.select(),
    style: {
      width: "100%",
      height: 150,
      marginTop: 8,
      padding: 9,
      borderRadius: 10,
      border: "1px solid var(--line-2)",
      background: "var(--paper-2)",
      color: "var(--ink)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      whiteSpace: "pre"
    }
  }))));
}
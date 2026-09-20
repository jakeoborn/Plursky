var _SAVED_FESTIVALS_KEY = "plursky_saved_festivals_v1";
var _LANDING_MIGRATED_KEY = "plursky_landing_migrated_v1";
function readSavedFestivals() {
  try {
    var raw = JSON.parse(localStorage.getItem(_SAVED_FESTIVALS_KEY) || "null");
    if (!raw) return [];
    var ids = Array.isArray(raw) ? raw : Array.isArray(raw.ids) ? raw.ids : [];
    return [...new Set(ids.filter(id => typeof id === "string" && id))];
  } catch {
    return [];
  }
}
function writeSavedFestivals(ids) {
  try {
    localStorage.setItem(_SAVED_FESTIVALS_KEY, JSON.stringify({
      v: 1,
      ids: [...new Set(ids || [])]
    }));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("plursky-saved-festivals-change"));
  } catch {}
  return readSavedFestivals();
}
function isFestivalSaved(id) {
  return !!id && readSavedFestivals().includes(id);
}
function saveFestival(id) {
  if (!id) return readSavedFestivals();
  var cur = readSavedFestivals();
  return cur.includes(id) ? cur : writeSavedFestivals([...cur, id]);
}
function unsaveFestival(id) {
  return writeSavedFestivals(readSavedFestivals().filter(x => x !== id));
}
function toggleSavedFestival(id) {
  return isFestivalSaved(id) ? unsaveFestival(id) : saveFestival(id);
}
function runLandingMigration() {
  try {
    if (localStorage.getItem(_LANDING_MIGRATED_KEY) === "1") return {
      ran: false,
      autoSaved: []
    };
    localStorage.setItem(_LANDING_MIGRATED_KEY, "1");
  } catch {
    return {
      ran: false,
      autoSaved: []
    };
  }
  return {
    ran: true,
    autoSaved: []
  };
}
function landingShouldOpenGeneral(params) {
  var get = k => {
    try {
      return params && params.get ? params.get(k) : null;
    } catch {
      return null;
    }
  };
  var named = get("f") || get("festival") || get("artist") || get("stage") || get("tab") || get("lineup") || get("crew") || get("day");
  return !named;
}
function _isProvenFestivalMoment(m, festivalId) {
  return !!m && m.festivalId === festivalId && m.festivalAttribution !== "unresolved";
}
function momentsForFestival(all, festivalId, opts) {
  var out = [];
  if (!festivalId) return out;
  var loose = !!(opts && opts.includeUnresolved);
  for (var night of Object.keys(all || {})) {
    var arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (var m of arr) {
      if (!m) continue;
      if (loose ? m.festivalId === festivalId : _isProvenFestivalMoment(m, festivalId)) out.push(m);
    }
  }
  return out;
}
function _provenMediaIdentities(all) {
  var proven = new Set();
  var id = m => typeof _mediaIdentity === "function" ? _mediaIdentity(m) : m._fingerprint || m.photoId || m.id || null;
  for (var night of Object.keys(all || {})) {
    var arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (var m of arr) {
      if (!m || !m.festivalId || m.festivalAttribution === "unresolved") continue;
      var key = id(m);
      if (key) proven.add(key);
    }
  }
  return proven;
}
function unattributedMoments(all) {
  var out = [];
  var proven = _provenMediaIdentities(all);
  var id = m => typeof _mediaIdentity === "function" ? _mediaIdentity(m) : m._fingerprint || m.photoId || m.id || null;
  for (var night of Object.keys(all || {})) {
    var arr = all[night];
    if (!Array.isArray(arr)) continue;
    for (var m of arr) {
      if (!m || m.festivalId && m.festivalAttribution !== "unresolved") continue;
      var key = id(m);
      if (key && proven.has(key)) continue;
      out.push(m);
    }
  }
  return out;
}
function festivalMemoryCount(festivalId, all) {
  var src = all || (typeof _readMoments === "function" ? _readMoments() : {});
  var mine = momentsForFestival(src, festivalId, {
    includeUnresolved: true
  });
  var unique = typeof _dedupeByMedia === "function" ? _dedupeByMedia(mine) : mine;
  return unique.filter(m => m.festivalAttribution !== "unresolved").length;
}
var _FEST_VIEW_KEY = "plursky_festival_view_v1";
function readFestivalView(festivalId) {
  if (!festivalId) return {};
  try {
    var all = JSON.parse(localStorage.getItem(_FEST_VIEW_KEY) || "{}");
    return all && all[festivalId] || {};
  } catch {
    return {};
  }
}
function writeFestivalView(festivalId, patch) {
  if (!festivalId) return {};
  try {
    var all = JSON.parse(localStorage.getItem(_FEST_VIEW_KEY) || "{}");
    var next = {
      ...(all[festivalId] || {}),
      ...(patch || {})
    };
    all[festivalId] = next;
    localStorage.setItem(_FEST_VIEW_KEY, JSON.stringify(all));
    return next;
  } catch {
    return {};
  }
}
function _landingFestivalState(entry, now, plus) {
  var phase = typeof _festivalPhase === "function" ? _festivalPhase(entry, now) : "upcoming";
  if (!entry.available && !entry.previewOnly) return {
    label: "Not open yet",
    tone: "muted",
    locked: true
  };
  if (!entry.available && entry.previewOnly) {
    return plus ? {
      label: "Early access",
      tone: "signal"
    } : {
      label: "Early access · Plursky+",
      tone: "muted",
      locked: true,
      upsell: true
    };
  }
  if (phase === "live") return {
    label: "Happening now",
    tone: "signal"
  };
  if (phase === "ended") return {
    label: "Ended",
    tone: "muted"
  };
  if (phase === "tba") return {
    label: "Dates TBA",
    tone: "muted"
  };
  if (entry.scheduleTBA) return {
    label: "Lineup in · set times TBA",
    tone: "muted"
  };
  return {
    label: "Upcoming",
    tone: "muted"
  };
}
function landingCanEnter(entry, now, plus) {
  if (!entry || !entry.config) return false;
  return !_landingFestivalState(entry, now, plus).locked;
}
function _landingPrimary(ordered, savedIds, now, plus) {
  var ids = savedIds || [];
  var ok = f => landingCanEnter(f, now, plus);
  var saved = (ordered || []).filter(f => ids.includes(f.config.id) && ok(f));
  var phase = f => typeof _festivalPhase === "function" ? _festivalPhase(f, now) : "upcoming";
  return saved.find(f => phase(f) === "live") || saved.find(f => phase(f) === "upcoming") || (ordered || []).find(f => phase(f) === "live" && ok(f)) || saved[0] || null;
}
function _LandingFestivalCard({
  entry,
  saved,
  memoryCount,
  onEnter,
  onUpsell,
  plus
}) {
  var now = Date.now();
  var st = _landingFestivalState(entry, now, plus);
  var c = entry.config;
  var toneColor = st.tone === "signal" ? "var(--signal-ink)" : "var(--text-2)";
  var dead = st.locked && !st.upsell;
  return React.createElement("button", {
    onClick: () => {
      if (st.upsell) onUpsell?.(c.id, entry);else if (!st.locked) onEnter(c.id, entry);
    },
    disabled: dead,
    "aria-label": `${c.name}. ${st.label}.${st.upsell ? " Opens the Plursky+ offer." : ""}${saved ? " Saved." : ""}${memoryCount ? ` ${memoryCount} memories.` : ""}`,
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 72,
      padding: "10px 0",
      background: "transparent",
      border: "none",
      borderBottom: "1px solid var(--line)",
      color: "var(--ink)",
      textAlign: "left",
      fontFamily: "inherit",
      cursor: dead ? "default" : "pointer",
      opacity: dead ? 0.55 : st.upsell ? 0.8 : 1
    }
  }, typeof FestivalThumb === "function" ? React.createElement(FestivalThumb, {
    entry: entry
  }) : null, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      flexWrap: "wrap",
      minWidth: 0
    }
  }, React.createElement("span", {
    style: {
      fontSize: 17,
      lineHeight: 1.29,
      fontWeight: 600,
      minWidth: 0,
      overflowWrap: "anywhere"
    }
  }, c.name), saved && React.createElement("span", {
    "aria-hidden": "true",
    title: "Saved",
    style: {
      flexShrink: 0,
      fontSize: 12,
      color: "var(--signal-ink)"
    }
  }, "★")), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.38,
      color: "var(--text-2)",
      minWidth: 0,
      overflowWrap: "anywhere"
    }
  }, c.location, c.dates ? " · " : "", c.dates || null), React.createElement("div", {
    style: {
      marginTop: 2,
      fontSize: 13,
      lineHeight: 1.38,
      color: toneColor,
      fontVariantNumeric: "tabular-nums"
    }
  }, st.label, memoryCount > 0 ? ` · ${memoryCount} ${memoryCount === 1 ? "memory" : "memories"}` : "")), !dead && React.createElement("svg", {
    "aria-hidden": "true",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-3)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0
    }
  }, React.createElement("path", {
    d: "M9 6 L15 12 L9 18"
  })));
}
function GeneralLandingScreen({
  state,
  setState
}) {
  var [savedIds, setSavedIds] = React.useState(readSavedFestivals);
  var [q, setQ] = React.useState("");
  var [plusOpen, setPlusOpen] = React.useState(false);
  var plus = !!window._isPlusSub?.();
  var [moments, setMoments] = React.useState(() => {
    try {
      return typeof _readMoments === "function" ? _readMoments() : {};
    } catch {
      return {};
    }
  });
  React.useEffect(() => {
    var refresh = () => setSavedIds(readSavedFestivals());
    window.addEventListener("plursky-saved-festivals-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("plursky-saved-festivals-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  React.useEffect(() => {
    var refresh = () => {
      try {
        setMoments(_readMoments());
      } catch {}
    };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  var now = Date.now();
  var registry = (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : []).filter(f => f && f.config && f.config.id);
  var ordered = typeof _sortFestivalsForSwitcher === "function" ? _sortFestivalsForSwitcher(registry, now) : registry;
  var activeId = typeof FESTIVAL_CONFIG !== "undefined" && FESTIVAL_CONFIG ? FESTIVAL_CONFIG.id : null;
  var counts = React.useMemo(() => {
    var m = {};
    for (var f of registry) m[f.config.id] = festivalMemoryCount(f.config.id, moments);
    return m;
  }, [moments, registry.length]);
  var orphanCount = React.useMemo(() => {
    var u = unattributedMoments(moments);
    return (typeof _dedupeByMedia === "function" ? _dedupeByMedia(u) : u).length;
  }, [moments]);
  var enterFestival = React.useCallback(id => {
    var entry = (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : []).find(f => f && f.config && f.config.id === id);
    if (entry && !landingCanEnter(entry, Date.now(), plus)) {
      if (entry.previewOnly) setPlusOpen(true);
      return;
    }
    if (id && activeId && id !== activeId && typeof setActiveFestivalAndReload === "function") {
      try {
        sessionStorage.setItem("plursky_landing_entered", id);
      } catch {}
      setActiveFestivalAndReload(id);
      return;
    }
    setState(s => ({
      ...s,
      tab: "home",
      artist: null
    }));
  }, [activeId, setState, plus]);
  var saved = ordered.filter(f => savedIds.includes(f.config.id));
  var term = q.trim().toLowerCase();
  var matches = f => !term || `${f.config.name} ${f.config.location || ""}`.toLowerCase().includes(term);
  var browse = ordered.filter(matches);
  var phaseOf = f => typeof _festivalPhase === "function" ? _festivalPhase(f, now) : "upcoming";
  var groups = [{
    label: "Happening now",
    fests: browse.filter(f => phaseOf(f) === "live")
  }, {
    label: "Upcoming",
    fests: browse.filter(f => phaseOf(f) === "upcoming")
  }, {
    label: "Dates TBA",
    fests: browse.filter(f => phaseOf(f) === "tba")
  }, {
    label: "Past",
    fests: browse.filter(f => phaseOf(f) === "ended")
  }].filter(g => g.fests.length > 0);
  var eyebrow = {
    margin: "18px 0 2px",
    fontSize: 11,
    lineHeight: 1.27,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--text-2)"
  };
  var card = f => React.createElement(_LandingFestivalCard, {
    key: f.config.id,
    entry: f,
    plus: plus,
    saved: savedIds.includes(f.config.id),
    memoryCount: counts[f.config.id] || 0,
    onEnter: enterFestival,
    onUpsell: () => setPlusOpen(true)
  });
  var primary = _landingPrimary(ordered, savedIds, now, plus);
  if (plusOpen && typeof PlusSheet === "function") {
    return React.createElement(PlusSheet, {
      feature: "early festival access",
      onClose: () => setPlusOpen(false)
    });
  }
  return React.createElement(Screen, null, React.createElement(ScrollBody, {
    style: {
      padding: "0 16px calc(96px + env(safe-area-inset-bottom, 0px))"
    }
  }, React.createElement("header", {
    style: {
      paddingTop: 10
    }
  }, React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 28,
      lineHeight: 1.21,
      fontWeight: 700,
      letterSpacing: "-0.01em"
    }
  }, "Plursky"), React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: 15,
      lineHeight: 1.4,
      color: "var(--text-2)"
    }
  }, "Pick a festival to plan it, live it, and keep it.")), primary && React.createElement("button", {
    onClick: () => enterFestival(primary.config.id),
    style: {
      width: "100%",
      marginTop: 14,
      minHeight: 56,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "var(--signal)",
      color: "var(--on-signal)",
      border: "none",
      borderRadius: 14,
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit"
    }
  }, React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("span", {
    style: {
      display: "block",
      fontSize: 17,
      lineHeight: 1.29,
      fontWeight: 600
    }
  }, phaseOf(primary) === "live" ? `Open ${primary.config.name}` : `Plan ${primary.config.name}`), React.createElement("span", {
    style: {
      display: "block",
      fontSize: 13,
      lineHeight: 1.38,
      opacity: 0.85
    }
  }, phaseOf(primary) === "live" ? "Happening now" : primary.config.dates || "Upcoming"))), React.createElement("h2", {
    style: eyebrow
  }, "Saved festivals"), saved.length > 0 ? saved.map(card) : React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 15,
      lineHeight: 1.4,
      color: "var(--text-2)"
    }
  }, "Open a festival and tap Save to keep it here."), orphanCount > 0 && React.createElement("button", {
    onClick: () => setState(s => ({
      ...s,
      tab: "memories",
      artist: null
    })),
    style: {
      width: "100%",
      marginTop: 12,
      minHeight: 44,
      padding: "10px 14px",
      display: "block",
      textAlign: "left",
      borderRadius: 14,
      cursor: "pointer",
      background: "var(--paper-2)",
      border: "none",
      color: "var(--warn)",
      fontSize: 15,
      lineHeight: 1.33,
      fontWeight: 600,
      fontFamily: "inherit"
    }
  }, "⚑ ", orphanCount, " ", orphanCount === 1 ? "memory is" : "memories are", " not confirmed to a festival · Review"), React.createElement("h2", {
    style: eyebrow
  }, "Browse festivals"), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    type: "search",
    "aria-label": "Search festivals",
    placeholder: "Search festivals",
    style: {
      width: "100%",
      boxSizing: "border-box",
      marginTop: 6,
      marginBottom: 2,
      minHeight: 44,
      padding: "0 14px",
      borderRadius: 14,
      background: "var(--paper-2)",
      border: "none",
      color: "var(--ink)",
      fontSize: 16,
      fontFamily: "inherit",
      outline: "none"
    }
  }), groups.length === 0 ? React.createElement("p", {
    style: {
      margin: "10px 0 0",
      fontSize: 15,
      lineHeight: 1.4,
      color: "var(--text-2)"
    }
  }, "No festival matches “", q.trim(), "”.") : groups.map(g => React.createElement("section", {
    key: g.label
  }, React.createElement("h3", {
    style: eyebrow
  }, g.label), g.fests.map(card)))));
}
function FestivalSaveRow({
  festivalId,
  name
}) {
  var [saved, setSaved] = React.useState(() => isFestivalSaved(festivalId));
  React.useEffect(() => {
    setSaved(isFestivalSaved(festivalId));
  }, [festivalId]);
  var label = saved ? `Saved — ${name || "this festival"} is on your home screen` : `Save ${name || "this festival"} to your home screen`;
  return React.createElement("button", {
    onClick: () => {
      toggleSavedFestival(festivalId);
      setSaved(isFestivalSaved(festivalId));
    },
    "aria-pressed": saved,
    "aria-label": label,
    style: {
      width: "100%",
      minHeight: 52,
      marginBottom: 14,
      padding: "10px 14px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "var(--paper-2)",
      border: "none",
      borderRadius: 14,
      color: "var(--ink)",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit"
    }
  }, React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: 16,
      color: saved ? "var(--signal-ink)" : "var(--text-2)"
    }
  }, saved ? "★" : "☆"), React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      lineHeight: 1.33,
      fontWeight: 600
    }
  }, saved ? "Saved" : "Save this festival"), React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 13,
      lineHeight: 1.38,
      color: "var(--text-2)"
    }
  }, saved ? "Tap to remove" : "Keep it on your home screen"));
}
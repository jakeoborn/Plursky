var _SR_REPLAY_SEC = 12;
var _SR_MAX_CLIPS = 12;
var _SR_TIGHT_GPS_M = 50;
var _SR_NEIGHBOR_MS = 6 * 60000;
function _srDataSet(id) {
  var sets = typeof _allDataSets === "function" ? _allDataSets() : [];
  return sets.find(s => s.id === id) || sets[0] || null;
}
function _srStageName(ds, stageId) {
  var stages = window._DATA_SETS?.[ds?.id]?.stages || window.STAGES || [];
  var s = stages.find(x => x.id === stageId);
  return s && (s.name || s.label) || String(stageId || "").toUpperCase();
}
function _srClock(utcMs, cfg) {
  var w = _wallClockFromUtc(utcMs, cfg);
  var h = w.hh % 12 || 12;
  return `${h}:${String(w.mm).padStart(2, "0")} ${w.hh < 12 ? "AM" : "PM"}`;
}
function _srHHMM(s) {
  var [h, m] = String(s || "").split(":").map(Number);
  if (!isFinite(h)) return "";
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")}`;
}
function _srSetWindow(a, cfg) {
  var dm = cfg?.dayDates?.[a?.day];
  if (!dm) return null;
  var at = s => {
    var [h, m] = s.split(":").map(Number);
    return dm.midnightUtc + ((h < 8 ? h + 24 : h) * 60 + m) * 60000;
  };
  return {
    startMs: at(a.start),
    endMs: at(a.end)
  };
}
function _srAnchorMeters(ds, stageId, lat, lng) {
  if (lat == null || lng == null) return null;
  var an = resolvedStageAnchors(ds.config).find(g => g.stageId === stageId);
  return an ? {
    m: Math.round(_haversineMeters(lat, lng, an.lat, an.lng)),
    src: an.anchorSource
  } : null;
}
function _srLiveSets(ds, utcMs, lat, lng, gpsOk) {
  var out = [];
  for (var a of ds.artists) {
    var w = _srSetWindow(a, ds.config);
    if (w && utcMs >= w.startMs - 5 * 60000 && utcMs <= w.endMs + 10 * 60000) {
      var d = gpsOk ? _srAnchorMeters(ds, a.stage, lat, lng) : null;
      out.push({
        a,
        d: d ? d.m : Infinity,
        gap: Math.abs(utcMs - w.startMs)
      });
    }
  }
  return out.sort((x, y) => x.d - y.d || x.gap - y.gap).map(x => x.a.id);
}
function _srLocalStamp(utcMs) {
  var d = new Date(utcMs),
    p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function _srReadClip(file, idx) {
  var meta = await _parseExifMeta(file);
  var utcMs = meta.rawUtcMs;
  var match = utcMs != null ? _matchArtistForPhoto(meta, [], [], null) : {
    reason: "no_date"
  };
  return {
    id: `c${idx}-${file.name}`,
    name: file.name,
    file,
    url: URL.createObjectURL(file),
    meta,
    utcMs,
    match,
    ds: _srDataSet(match.festivalId),
    dur: null,
    poster: null,
    shazam: null
  };
}
function _srResolve(clips, fixes) {
  var views = clips.map(c => {
    var {
      meta,
      match,
      ds
    } = c;
    var cfg = ds?.config || {};
    var gpsOk = meta.lat != null && (meta.acc == null || meta.acc <= 200);
    var v = {
      c,
      ds,
      gpsOk
    };
    v.night = match.night ? {
      conf: "confirmed",
      label: `${_srClock(c.utcMs, cfg)} · ${cfg.dayDates?.[match.night]?.short || ""} NIGHT`,
      why: "capture clock"
    } : {
      conf: "unknown",
      label: c.utcMs == null ? "No capture time" : "Outside the festival",
      why: ""
    };
    var fix = fixes[c.id];
    var alts = (match.alternatives || []).filter(id => id !== match.artistId);
    if (fix) {
      v.artistId = fix;
      v.aConf = "you";
      v.aWhy = "you";
    } else if (match.artistId) {
      v.artistId = match.artistId;
      var d = _srAnchorMeters(ds, ds.artists.find(a => a.id === match.artistId)?.stage, meta.lat, meta.lng);
      var _decided = match.reason === "matched" && !match.ambiguous && (match.anchorSource === "crowd" || match.anchorSource === "osm") && meta.acc != null && meta.acc <= _SR_TIGHT_GPS_M;
      v.aConf = _decided ? "confirmed" : "likely";
      v.aWhy = _decided ? `GPS ±${Math.round(meta.acc)} m · ${d ? d.m + " m from the " + (d.src === "crowd" ? "crowd" : "stage") : "at the stage"}` : match.reason === "stage_time_proximity" ? "GPS at the stage, between set times" : !gpsOk && meta.lat != null ? `GPS too coarse (±${Math.round(meta.acc / 100) / 10} km) · time only` : meta.lat == null ? `no GPS · time only, ${alts.length + 1} sets on` : `time + GPS lean, ${alts.length + 1} sets on`;
    } else {
      v.artistId = null;
      v.aConf = "unknown";
      v.aWhy = match.reason === "off_stage" ? `GPS ±${Math.round(meta.acc || 0)} m · ${match.distMeters} m from any stage` : match.reason === "no_artist_at_time" ? "no set on at this time" : "";
    }
    v.alts = v.artistId && v.aConf !== "you" ? alts : [];
    if (!v.artistId && c.utcMs != null && ds) v.alts = _srLiveSets(ds, c.utcMs, meta.lat, meta.lng, gpsOk);
    return v;
  });
  var decided = views.filter(v => v.aConf === "confirmed" || v.aConf === "you");
  var _loop = function (v) {
      if (v.aConf === "confirmed" || v.aConf === "you" || v.gpsOk && v.aConf === "unknown") return 0;
      if (v.gpsOk && v.c.meta.acc != null && v.c.meta.acc <= _SR_TIGHT_GPS_M) return 0;
      var best = null;
      var _loop3 = function (d) {
          if (d.c.match.night !== v.c.match.night || d.ds?.id !== v.ds?.id) return 0;
          var dt = Math.abs(d.c.utcMs - v.c.utcMs);
          var a = d.ds.artists.find(x => x.id === d.artistId),
            w = _srSetWindow(a, d.ds.config);
          if (dt > _SR_NEIGHBOR_MS || !w || v.c.utcMs < w.startMs - 5 * 60000 || v.c.utcMs > w.endMs + 10 * 60000) return 0;
          if (!best || dt < best.dt) best = {
            d,
            dt
          };
        },
        _ret2;
      for (var d of decided) {
        _ret2 = _loop3(d);
        if (_ret2 === 0) continue;
      }
      if (best && best.d.artistId !== v.artistId) {
        var was = v.artistId;
        v.artistId = best.d.artistId;
        v.aConf = "likely";
        var s = Math.round(best.dt / 1000);
        v.aWhy = `${s < 90 ? s + " s" : Math.round(s / 60) + " min"} from a ${best.d.aConf === "you" ? "clip you fixed" : "GPS-decided clip"}`;
        v.alts = [was, ...v.alts].filter(id => id && id !== v.artistId);
        v.leanFrom = best.d.c.id;
      }
    },
    _ret;
  for (var v of views) {
    _ret = _loop(v);
    if (_ret === 0) continue;
  }
  var _loop2 = function (_v) {
    _v.artist = _v.artistId ? _v.ds.artists.find(a => a.id === _v.artistId) : null;
    _v.stage = _v.artist ? _srStageName(_v.ds, _v.artist.stage) : _v.c.match.reason === "off_stage" ? "Between stages" : null;
  };
  for (var _v of views) {
    _loop2(_v);
  }
  return views.sort((x, y) => (x.c.utcMs ?? 0) - (y.c.utcMs ?? 0));
}
async function _srSong(v) {
  if (v.c.shazam?.matched) return {
    conf: "confirmed",
    title: v.c.shazam.title,
    why: "Shazam"
  };
  var a = v.artist;
  if (!a || typeof _getTracklistForArtist !== "function") return {
    conf: "unknown",
    title: null,
    why: ""
  };
  var prev = window.FESTIVAL_CONFIG;
  var data = null,
    r = null;
  try {
    window.FESTIVAL_CONFIG = v.ds.config;
    data = await _getTracklistForArtist(a.name);
    if (data) r = _matchSongAtTime(a, data, _srLocalStamp(v.c.utcMs));
  } catch {} finally {
    window.FESTIVAL_CONFIG = prev;
  }
  if (!data) return {
    conf: "unknown",
    title: null,
    why: "no tracklist for this set"
  };
  if (!r?.song) return {
    conf: "unknown",
    title: null,
    why: "outside the tracklist"
  };
  var w = _srSetWindow(a, v.ds.config);
  var min = w ? Math.max(0, Math.round((v.c.utcMs - w.startMs) / 60000)) : null;
  return {
    conf: "likely",
    title: r.song,
    why: r.source === "1001tracklists" ? `tracklist cue${min != null ? ` · ${min} min in` : ""}` : "setlist order, not timed"
  };
}
function _srCut(views) {
  var withMedia = views.filter(v => v.c.dur);
  var n = withMedia.length;
  if (!n) return [];
  var len = _SR_REPLAY_SEC / n;
  var prevKey = null,
    group = -1;
  return withMedia.map((v, i) => {
    var key = v.artistId || `solo-${v.c.id}`;
    if (key !== prevKey) {
      group++;
      prevKey = key;
    }
    return {
      v,
      t0: i * len,
      t1: (i + 1) * len,
      from: Math.max(0, (v.c.dur - len) / 2),
      len,
      group,
      key
    };
  });
}
var _SR_CSS = `
.sr-root{position:fixed;inset:0;overflow-y:auto;background:var(--paper);color:var(--ink);font-family:var(--font-ui);-webkit-overflow-scrolling:touch}
.sr-col{max-width:390px;margin:0 auto;padding:0 0 96px;min-height:100%;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.sr-eyebrow{font-size:11px;letter-spacing:.14em;font-weight:700;text-transform:uppercase;color:var(--text-2)}
.sr-conf{display:inline-flex;align-items:center;gap:6px}
.sr-dot{width:7px;height:7px;border-radius:50%;flex:none}
.sr-dot.confirmed{background:var(--signal-ink)}
.sr-dot.you{background:var(--ink)}
.sr-dot.likely{border:1.5px dashed var(--text-2);width:6px;height:6px}
.sr-dot.unknown{border:1.5px solid var(--text-3);width:6px;height:6px}
.sr-guess{text-decoration:underline dashed;text-decoration-color:var(--text-3);text-underline-offset:4px}
.sr-chip{font:inherit;font-size:13px;line-height:1;padding:9px 11px;border-radius:999px;border:1px dashed var(--line-2);background:transparent;color:var(--ink);cursor:pointer;white-space:nowrap}
.sr-chip.yes{border-style:solid;border-color:var(--signal-ink);color:var(--signal-ink)}
.sr-chip:focus-visible,.sr-btn:focus-visible{outline:2px solid var(--signal-ink);outline-offset:2px}
.sr-btn{font:inherit;font-size:13px;line-height:1;padding:9px 12px;border-radius:999px;border:1px solid var(--line-2);background:var(--paper-2);color:var(--ink);cursor:pointer;white-space:nowrap}
.sr-alts{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-right:-16px;padding-right:16px;margin-top:4px}
.sr-alts::-webkit-scrollbar{display:none}
.sr-row{display:grid;grid-template-columns:56px 1fr;gap:12px;padding:14px 16px;border-top:1px solid var(--line);contain:content}
.sr-row.flash{animation:sr-flash 900ms ease-out}
.sr-field{opacity:0;animation:sr-in 320ms ease-out forwards}
@keyframes sr-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes sr-flash{from{background:rgba(109,40,217,.28)}to{background:transparent}}
@keyframes sr-pulse{0%{opacity:1}50%{opacity:.35}100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.sr-field{animation:none;opacity:1}.sr-row.flash{animation:none}}
`;
function SrConf({
  conf,
  why
}) {
  return React.createElement("span", {
    className: "sr-conf",
    "data-conf": conf,
    "data-evidence": conf === "confirmed" || conf === "you" ? why || "" : ""
  }, React.createElement("span", {
    className: `sr-dot ${conf}`,
    "aria-hidden": "true"
  }), React.createElement("span", {
    style: {
      fontSize: 12,
      color: conf === "unknown" ? "var(--text-3)" : "var(--text-2)"
    }
  }, conf === "you" ? "you fixed this" : conf === "likely" ? `likely · ${why}` : why || "not identified"));
}
function SrPlayer({
  cut,
  flashKeys,
  onTapPlay,
  playing
}) {
  var aRef = React.useRef(null),
    bRef = React.useRef(null),
    barRef = React.useRef(null);
  var front = React.useRef("a"),
    cur = React.useRef(-1),
    t0 = React.useRef(performance.now());
  var [seg, setSeg] = React.useState(0);
  var cutRef = React.useRef(cut);
  cutRef.current = cut;
  var playingRef = React.useRef(playing);
  playingRef.current = playing;
  var pausedAt = React.useRef(0);
  React.useEffect(() => {
    if (playing) t0.current = performance.now() - pausedAt.current;else pausedAt.current = (performance.now() - t0.current) % (_SR_REPLAY_SEC * 1000);
    var vids = [aRef.current, bRef.current];
    for (var _v2 of vids) {
      if (!_v2) continue;
      if (!playing) _v2.pause();
    }
    if (playing) {
      var f = front.current === "a" ? aRef.current : bRef.current;
      f && f.play().catch(() => {});
    }
  }, [playing]);
  React.useEffect(() => {
    var raf = 0;
    var load = (el, s) => {
      if (!el || !s) return;
      if (el.dataset.clip !== s.v.c.id) {
        el.dataset.clip = s.v.c.id;
        el.src = s.v.c.url;
      }
      try {
        el.currentTime = s.from;
      } catch {}
    };
    var tick = () => {
      raf = requestAnimationFrame(tick);
      var c = cutRef.current;
      if (!c.length) return;
      var t = playingRef.current ? (performance.now() - t0.current) / 1000 % _SR_REPLAY_SEC : pausedAt.current / 1000;
      if (barRef.current) barRef.current.style.transform = `scaleX(${t / _SR_REPLAY_SEC})`;
      var i = c.findIndex(s => t >= s.t0 && t < s.t1);
      if (i < 0) i = 0;
      if (i === cur.current) return;
      cur.current = i;
      var next = front.current === "a" ? bRef.current : aRef.current;
      var prev = front.current === "a" ? aRef.current : bRef.current;
      if (next.dataset.clip !== c[i].v.c.id) load(next, c[i]);else if (Math.abs(next.currentTime - c[i].from) > 0.25) {
        try {
          next.currentTime = c[i].from;
        } catch {}
      }
      next.style.opacity = "1";
      prev.style.opacity = "0";
      if (playingRef.current) next.play().catch(() => {});
      prev.pause();
      front.current = front.current === "a" ? "b" : "a";
      load(prev, c[(i + 1) % c.length]);
      setSeg(i);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  React.useEffect(() => {
    cur.current = -1;
  }, [cut]);
  var s = cut[seg] || cut[0];
  var v = s?.v;
  var groups = [];
  for (var x of cut) {
    var g = groups[groups.length - 1];
    if (g && g.key === x.key) g.t1 = x.t1;else groups.push({
      key: x.key,
      t0: x.t0,
      t1: x.t1,
      v: x.v
    });
  }
  var vidStyle = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0,
    transition: "opacity 80ms linear"
  };
  return React.createElement("div", {
    style: {
      position: "relative",
      height: 452,
      background: "#000",
      overflow: "hidden"
    },
    onClick: onTapPlay
  }, v?.c.poster && React.createElement("img", {
    alt: "",
    src: v.c.poster,
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), React.createElement("video", {
    ref: aRef,
    muted: true,
    playsInline: true,
    preload: "auto",
    style: vidStyle
  }), React.createElement("video", {
    ref: bRef,
    muted: true,
    playsInline: true,
    preload: "auto",
    style: vidStyle
  }), React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--media-scrim)",
      pointerEvents: "none"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      top: 14,
      left: 16,
      right: 16,
      display: "flex",
      justifyContent: "space-between"
    }
  }, React.createElement("span", {
    className: "sr-eyebrow",
    style: {
      color: "rgba(255,255,255,.8)"
    }
  }, "First replay · 12s"), React.createElement("span", {
    className: "sr-eyebrow mono",
    style: {
      color: "rgba(255,255,255,.8)"
    }
  }, playing ? "" : "Paused")), v && React.createElement("div", {
    key: s.key,
    style: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 30,
      color: "#fff"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: "-.01em",
      lineHeight: 1.1
    },
    className: v.aConf === "likely" ? "sr-guess" : "",
    "data-conf": v.aConf,
    "data-evidence": v.aConf === "confirmed" || v.aConf === "you" ? v.aWhy : ""
  }, v.artist ? v.artist.name : "Between sets", v.aConf === "likely" ? "?" : ""), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      marginTop: 6,
      color: "rgba(255,255,255,.78)"
    }
  }, [v.stage, v.artist && `${_srHHMM(v.artist.start)}–${_srHHMM(v.artist.end)}`, v.night.label].filter(Boolean).join("  ·  ")), v.song?.title && React.createElement("div", {
    style: {
      fontSize: 13,
      marginTop: 4,
      color: "rgba(255,255,255,.78)"
    }
  }, "♪ ", React.createElement("span", {
    className: v.song.conf === "likely" ? "sr-guess" : ""
  }, v.song.title, v.song.conf === "likely" ? "?" : ""))), React.createElement("div", {
    style: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 14,
      height: 4,
      display: "flex",
      gap: 2
    }
  }, groups.map((g, i) => React.createElement("div", {
    key: g.key + i,
    style: {
      flex: g.t1 - g.t0,
      background: g.v.aConf === "likely" || g.v.aConf === "unknown" ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.55)",
      borderRadius: 2,
      animation: flashKeys.has(g.key) ? "sr-pulse 450ms ease-in-out 2" : "none"
    }
  }))), React.createElement("div", {
    ref: barRef,
    style: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 14,
      height: 4,
      background: "var(--signal-ink)",
      transformOrigin: "left",
      transform: "scaleX(0)",
      mixBlendMode: "screen",
      borderRadius: 2
    }
  }));
}
function SrRow({
  v,
  onFix,
  flash,
  tapStart
}) {
  var a = v.artist;
  var d = i => ({
    animationDelay: `${i * 110}ms`
  });
  var altChips = v.alts.slice(0, 3);
  return React.createElement("div", {
    className: `sr-row${flash ? " flash" : ""}`
  }, React.createElement("div", {
    style: {
      width: 56,
      height: 72,
      borderRadius: 8,
      overflow: "hidden",
      background: "var(--paper-2)"
    }
  }, v.c.poster && React.createElement("img", {
    alt: "",
    src: v.c.poster,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  })), React.createElement("div", {
    style: {
      minWidth: 0,
      display: "grid",
      gap: 5
    }
  }, React.createElement("div", {
    className: "sr-field",
    style: d(0)
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: ".06em"
    }
  }, v.night.label)), React.createElement("div", {
    className: "sr-field",
    style: d(1)
  }, React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      lineHeight: 1.2
    }
  }, React.createElement("span", {
    className: v.aConf === "likely" ? "sr-guess" : ""
  }, a ? a.name : v.aConf === "unknown" && v.c.match.reason === "off_stage" ? "Between sets" : "No set identified"), v.aConf === "likely" ? "?" : ""), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-2)",
      marginTop: 2
    }
  }, [v.stage, a && `${_srHHMM(a.start)}–${_srHHMM(a.end)}`].filter(Boolean).join(" · ")), React.createElement("div", {
    style: {
      marginTop: 3
    }
  }, React.createElement(SrConf, {
    conf: v.aConf,
    why: v.aWhy
  }))), React.createElement("div", {
    className: "sr-field",
    style: d(2)
  }, v.song ? React.createElement("div", {
    style: {
      fontSize: 13
    }
  }, React.createElement("span", {
    style: {
      color: v.song.title ? "var(--ink)" : "var(--text-3)"
    },
    className: v.song.conf === "likely" ? "sr-guess" : ""
  }, "♪ ", v.song.title || "Song not identified", v.song.conf === "likely" ? "?" : ""), React.createElement("div", {
    style: {
      marginTop: 3
    }
  }, React.createElement(SrConf, {
    conf: v.song.conf,
    why: v.song.why
  }))) : React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-3)"
    }
  }, "♪ listening…")), (v.aConf === "likely" || v.aConf === "unknown") && (altChips.length > 0 || a) && React.createElement("div", {
    className: "sr-field sr-alts",
    style: d(3),
    onPointerDown: () => tapStart(v.c.id)
  }, a && React.createElement("button", {
    className: "sr-chip yes",
    onClick: () => onFix(v.c.id, a.id)
  }, "✓ ", a.name), altChips.map(id => {
    var x = v.ds.artists.find(q => q.id === id);
    return x && React.createElement("button", {
      key: id,
      className: "sr-chip",
      onClick: () => onFix(v.c.id, id)
    }, x.name, " ", React.createElement("span", {
      style: {
        color: "var(--text-2)"
      }
    }, "· ", _srStageName(v.ds, x.stage)));
  }))));
}
var SrRowMemo = React.memo(SrRow, (p, n) => {
  var a = p.v,
    b = n.v;
  return p.flash === n.flash && a.c.id === b.c.id && a.c.poster === b.c.poster && a.artistId === b.artistId && a.aConf === b.aConf && a.aWhy === b.aWhy && a.song === b.song && a.night.label === b.night.label && a.alts.join() === b.alts.join() && p.onFix === n.onFix && p.tapStart === n.tapStart;
});
function SrGates({
  gates,
  onClose
}) {
  var row = (label, value, ok) => React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      padding: "8px 0",
      borderTop: "1px solid var(--line)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13
    }
  }, label), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: ok == null ? "var(--text-2)" : ok ? "var(--ink)" : "var(--alert)"
    }
  }, value, ok == null ? "" : ok ? "  PASS" : "  FAIL"));
  var g = gates;
  return React.createElement("div", {
    role: "dialog",
    "aria-label": "Kill gates",
    style: {
      position: "fixed",
      left: "50%",
      transform: "translateX(-50%)",
      bottom: 16,
      width: "min(358px, calc(100% - 32px))",
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 14,
      padding: "12px 16px 8px",
      zIndex: 5
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 6
    }
  }, React.createElement("span", {
    className: "sr-eyebrow"
  }, "Kill gates · measured live"), React.createElement("button", {
    className: "sr-btn",
    style: {
      padding: "6px 10px"
    },
    onClick: onClose
  }, "Close")), row("First media frame", g.firstFrameMs == null ? "—" : `${g.firstFrameMs} ms`, g.firstFrameMs == null ? null : g.firstFrameMs < 2000), row("Scroll: frames over 50 ms", g.scrollFrames ? `${g.longFrames} / ${g.scrollFrames}` : "scroll the list", g.scrollFrames ? g.longFrames === 0 : null), row("Last correction", g.lastTaps == null ? "—" : `${g.lastTaps} tap${g.lastTaps === 1 ? "" : "s"}`, g.lastTaps == null ? null : g.lastTaps <= 2), row("Guesses styled as confirmed", String(g.falseConfirmed), g.falseConfirmed === 0));
}
function SetReconstruction() {
  var [clips, setClips] = React.useState([]);
  var [fixes, setFixes] = React.useState({});
  var [songs, setSongs] = React.useState({});
  var [flash, setFlash] = React.useState({
    rows: new Set(),
    keys: new Set()
  });
  var [playing, setPlaying] = React.useState(true);
  var [showGates, setShowGates] = React.useState(false);
  var [gates, setGates] = React.useState({
    firstFrameMs: null,
    longFrames: 0,
    scrollFrames: 0,
    lastTaps: null,
    falseConfirmed: 0
  });
  var importT0 = React.useRef(null),
    taps = React.useRef({
      id: null,
      n: 0
    });
  var rootRef = React.useRef(null);
  var sample = React.useMemo(() => (new URLSearchParams(location.search).get("sample") || "").split(",").filter(Boolean), []);
  var views = React.useMemo(() => _srResolve(clips, fixes).map(v => ({
    ...v,
    song: songs[`${v.c.id}|${v.artistId || ""}`] || null
  })), [clips, fixes, songs]);
  var cut = React.useMemo(() => _srCut(views), [views]);
  var prevViews = React.useRef(new Map());
  var posterQueue = React.useRef(Promise.resolve());
  var enqueueMedia = c => {
    posterQueue.current = posterQueue.current.then(async () => {
      var [dur, blob] = await Promise.all([_videoDuration(c.file).catch(() => null), _videoPosterBlob(c.file).catch(() => null)]);
      var poster = blob ? URL.createObjectURL(blob) : null;
      if (poster && importT0.current != null) {
        var img = new Image();
        img.onload = () => setGates(g => g.firstFrameMs != null ? g : {
          ...g,
          firstFrameMs: Math.round(performance.now() - importT0.current)
        });
        img.src = poster;
      }
      setClips(cs => cs.map(x => x.id === c.id ? {
        ...x,
        dur: dur || x.dur || 3,
        poster
      } : x));
    });
  };
  var addFiles = async files => {
    importT0.current = performance.now();
    setGates(g => ({
      ...g,
      firstFrameMs: null
    }));
    var list = files.slice(0, _SR_MAX_CLIPS);
    var _loop4 = async function () {
      var f = await list[i];
      if (!f) return 1;
      var c = await _srReadClip(f, clips.length + i);
      setClips(cs => [...cs, c].sort((x, y) => (x.utcMs ?? 0) - (y.utcMs ?? 0)));
      enqueueMedia(c);
    };
    for (var i = 0; i < list.length; i++) {
      if (await _loop4()) continue;
    }
    if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin?.identifyBase64 && typeof _blobToBase64 === "function") {
      var _loop5 = async function () {
        var file = await f;
        if (!file) return 1;
        try {
          var r = await window.ShazamPlugin.identifyBase64({
            data: await _blobToBase64(file),
            ext: (file.name.split(".").pop() || "mov").toLowerCase()
          });
          setClips(cs => cs.map(x => x.file === file ? {
            ...x,
            shazam: r?.matched ? {
              matched: true,
              title: r.artist ? `${r.artist} — ${r.title}` : r.title
            } : {
              matched: false
            }
          } : x));
        } catch {}
      };
      for (var f of list) {
        if (await _loop5()) continue;
      }
    }
  };
  var loadSample = () => addFiles(sample.map(n => ({
    then: (ok, bad) => fetch(`/.proto-media/${encodeURIComponent(n)}`).then(r => r.ok ? r.blob() : null).then(b => b ? new File([b], n, {
      type: "video/quicktime"
    }) : null).catch(() => null).then(ok, bad)
  })));
  var songQueue = React.useRef(Promise.resolve()),
    asked = React.useRef(new Set());
  React.useEffect(() => {
    var _loop6 = function (v) {
      var k = `${v.c.id}|${v.artistId || ""}`;
      if (asked.current.has(k)) return 1;
      asked.current.add(k);
      songQueue.current = songQueue.current.then(() => _srSong(v)).then(r => setSongs(s => ({
        ...s,
        [k]: r
      }))).catch(() => {});
    };
    for (var v of views) {
      if (_loop6(v)) continue;
    }
  }, [views]);
  React.useEffect(() => {
    var rows = new Set(),
      keys = new Set();
    for (var v of views) {
      var p = prevViews.current.get(v.c.id);
      if (p && (p.artistId !== v.artistId || p.aConf !== v.aConf)) {
        rows.add(v.c.id);
        keys.add(v.artistId || `solo-${v.c.id}`);
      }
    }
    prevViews.current = new Map(views.map(v => [v.c.id, {
      artistId: v.artistId,
      aConf: v.aConf
    }]));
    if (rows.size) {
      setFlash({
        rows,
        keys
      });
      var t = setTimeout(() => setFlash({
        rows: new Set(),
        keys: new Set()
      }), 950);
      return () => clearTimeout(t);
    }
  }, [views]);
  React.useEffect(() => {
    var t = setTimeout(() => {
      var bad = [...(rootRef.current?.querySelectorAll('[data-conf="confirmed"],[data-conf="you"]') || [])].filter(el => !el.dataset.evidence).length;
      setGates(g => g.falseConfirmed === bad ? g : {
        ...g,
        falseConfirmed: bad
      });
    }, 400);
    return () => clearTimeout(t);
  });
  React.useEffect(() => {
    var el = rootRef.current;
    if (!el) return;
    var moving = 0,
      last = 0,
      raf = 0;
    var onScroll = () => {
      moving = performance.now() + 150;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    var loop = now => {
      var dt = now - last;
      last = now;
      setGates(g => ({
        ...g,
        scrollFrames: g.scrollFrames + 1,
        longFrames: g.longFrames + (dt > 50 ? 1 : 0)
      }));
      raf = now < moving ? requestAnimationFrame(loop) : 0;
    };
    el.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  var tapStart = React.useCallback(id => {
    if (taps.current.id !== id) taps.current = {
      id,
      n: 0
    };
    taps.current.n++;
  }, []);
  var onFix = React.useCallback((id, artistId) => {
    var n = taps.current.id === id ? taps.current.n : 1;
    taps.current = {
      id: null,
      n: 0
    };
    setGates(g => ({
      ...g,
      lastTaps: n
    }));
    setFixes(f => ({
      ...f,
      [id]: artistId
    }));
  }, []);
  var ds = views[0]?.ds;
  var nights = [...new Set(views.map(v => v.c.match.night).filter(Boolean))];
  var nightName = nights.length === 1 ? ds?.config?.dayDates?.[nights[0]]?.name : null;
  var sets = new Set(views.filter(v => v.artistId).map(v => v.artistId)).size;
  var toCheck = views.filter(v => v.aConf === "likely" || v.aConf === "unknown").length;
  return React.createElement("div", {
    className: "sr-root",
    ref: rootRef
  }, React.createElement("style", null, _SR_CSS), React.createElement("div", {
    className: "sr-col"
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "calc(var(--top-pad, 0px) + 14px) 16px 12px"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "sr-eyebrow"
  }, "Set reconstruction · prototype"), React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      marginTop: 4
    }
  }, views.length ? `${nightName ? nightName + " night" : "Your night"}${ds?.config?.name ? " · " + ds.config.name : ""}` : "Rebuild a night from your clips")), React.createElement("button", {
    className: "sr-btn",
    onClick: () => {
      location.href = location.pathname;
    }
  }, "Done")), !views.length && React.createElement("div", {
    style: {
      padding: "8px 16px 24px",
      display: "grid",
      gap: 14
    }
  }, React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      lineHeight: 1.45,
      color: "var(--text-2)",
      maxWidth: "34ch"
    }
  }, "Pick 8–12 videos from one night. Plursky reads each clip's clock and GPS, lines it up against the set times, and cuts a 12-second replay you can fix as you go."), React.createElement("label", {
    className: "sr-chip yes",
    style: {
      justifySelf: "start",
      padding: "12px 16px",
      fontSize: 15
    }
  }, "Choose clips", React.createElement("input", {
    type: "file",
    accept: "video/*",
    multiple: true,
    style: {
      display: "none"
    },
    onChange: e => addFiles([...e.target.files].map(f => Promise.resolve(f)))
  })), sample.length > 0 && React.createElement("button", {
    className: "sr-chip",
    style: {
      justifySelf: "start",
      padding: "12px 16px",
      fontSize: 15
    },
    onClick: loadSample
  }, "Load the sample night (", sample.length, " clips)")), views.length > 0 && React.createElement(SrPlayer, {
    cut: cut,
    flashKeys: flash.keys,
    playing: playing,
    onTapPlay: () => setPlaying(p => !p)
  }), views.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      padding: "14px 16px",
      alignItems: "baseline"
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13
    }
  }, React.createElement("b", null, views.length), " clips"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13
    }
  }, React.createElement("b", null, sets), " sets"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      color: toCheck ? "var(--signal-ink)" : "var(--text-2)"
    }
  }, React.createElement("b", null, toCheck), " to check"), React.createElement("span", {
    style: {
      flex: 1
    }
  }), React.createElement("span", {
    className: "sr-conf",
    style: {
      fontSize: 11,
      color: "var(--text-2)",
      gap: 10
    }
  }, React.createElement("span", {
    className: "sr-conf"
  }, React.createElement("span", {
    className: "sr-dot confirmed"
  }), " sure"), React.createElement("span", {
    className: "sr-conf"
  }, React.createElement("span", {
    className: "sr-dot likely"
  }), " likely"))), views.map(v => React.createElement(SrRowMemo, {
    key: v.c.id,
    v: v,
    onFix: onFix,
    tapStart: tapStart,
    flash: flash.rows.has(v.c.id)
  }))), views.length > 0 && !showGates && React.createElement("button", {
    className: "sr-btn",
    style: {
      position: "fixed",
      right: "max(16px, calc(50% - 179px))",
      bottom: 16,
      zIndex: 5
    },
    onClick: () => setShowGates(true)
  }, "Gates"), showGates && React.createElement(SrGates, {
    gates: gates,
    onClose: () => setShowGates(false)
  }));
}
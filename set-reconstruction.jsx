// ── Set Reconstruction · PROTOTYPE ─────────────────────────────────────────
// Opened only with ?proto=reconstruct (see app.jsx). Branch-only: it is not
// for merge until Jake has judged it by eye.
//
// Import 8-12 clips from one night. Each one resolves into night / stage /
// artist / song with its confidence on its face, and a correction re-cuts the
// 12-second first replay in place. The replay is a timeline computed from
// state and played live from the original files; nothing is rendered, so a
// re-cut costs one React pass.
//
// Substrate only, nothing new underneath:
//   import    _parseExifMeta: capture clock, GPS and its accuracy radius
//   schedule  _matchArtistForPhoto: set windows, alternatives, ambiguity
//   GPS       resolvedStageAnchors: measured crowd anchors beat poster pins
//   songs     ShazamPlugin on iPhone (a match = confirmed). On the web, the
//             tracklist corpus via _getTracklistForArtist + _matchSongAtTime.
//             That is a cue position against the SCHEDULED start, so it is
//             shown as LIKELY even where the corpus calls it "exact".
//   recap     the recap cut policy: trim each clip to its middle
//
// THE HONESTY RULE. A field renders as confirmed only with evidence that
// decides it: the capture clock, a tight GPS fix at a measured anchor, a
// Shazam match, or you. Everything else is visibly a guess (dashed, "?",
// and the reason). The gates panel audits the DOM for exactly this.

const _SR_REPLAY_SEC = 12;
const _SR_MAX_CLIPS = 12;
// A fix this tight, at a crowd- or OSM-measured anchor, decides the stage.
// The tagger blinds anything over 200 m; between the two it is a lean.
const _SR_TIGHT_GPS_M = 50;
// A clip with no usable fix of its own inherits a decided neighbour's set when
// the two were shot this close together and that set was still on.
const _SR_NEIGHBOR_MS = 6 * 60000;

function _srDataSet(id) {
  const sets = (typeof _allDataSets === "function") ? _allDataSets() : [];
  return sets.find(s => s.id === id) || sets[0] || null;
}
function _srStageName(ds, stageId) {
  const stages = window._DATA_SETS?.[ds?.id]?.stages || window.STAGES || [];
  const s = stages.find(x => x.id === stageId);
  return (s && (s.name || s.label)) || String(stageId || "").toUpperCase();
}
function _srClock(utcMs, cfg) {
  const w = _wallClockFromUtc(utcMs, cfg);
  const h = w.hh % 12 || 12;
  return `${h}:${String(w.mm).padStart(2, "0")} ${w.hh < 12 ? "AM" : "PM"}`;
}
function _srHHMM(s) {
  const [h, m] = String(s || "").split(":").map(Number);
  if (!isFinite(h)) return "";
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")}`;
}
// A set's absolute window. Before 08:00 is still the same festival night,
// exactly as photo-tag.jsx's setWindow counts it.
function _srSetWindow(a, cfg) {
  const dm = cfg?.dayDates?.[a?.day];
  if (!dm) return null;
  const at = (s) => { const [h, m] = s.split(":").map(Number); return dm.midnightUtc + ((h < 8 ? h + 24 : h) * 60 + m) * 60000; };
  return { startMs: at(a.start), endMs: at(a.end) };
}
function _srAnchorMeters(ds, stageId, lat, lng) {
  if (lat == null || lng == null) return null;
  const an = resolvedStageAnchors(ds.config).find(g => g.stageId === stageId);
  return an ? { m: Math.round(_haversineMeters(lat, lng, an.lat, an.lng)), src: an.anchorSource } : null;
}
// Sets live at this instant (matcher tolerance: 5 min early, 10 late),
// nearest stage first when the clip has a usable fix. Used for the chips on
// a clip the matcher left empty ("between sets", "no set at this time").
function _srLiveSets(ds, utcMs, lat, lng, gpsOk) {
  const out = [];
  for (const a of ds.artists) {
    const w = _srSetWindow(a, ds.config);
    if (w && utcMs >= w.startMs - 5 * 60000 && utcMs <= w.endMs + 10 * 60000) {
      const d = gpsOk ? _srAnchorMeters(ds, a.stage, lat, lng) : null;
      out.push({ a, d: d ? d.m : Infinity, gap: Math.abs(utcMs - w.startMs) });
    }
  }
  return out.sort((x, y) => (x.d - y.d) || (x.gap - y.gap)).map(x => x.a.id);
}
// _matchSongAtTime parses its takenAt in the BROWSER's zone, so hand it the
// true instant written as browser-local wall time.
function _srLocalStamp(utcMs) {
  const d = new Date(utcMs), p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Reading one clip: the real import path, then the real tagger ─────────
async function _srReadClip(file, idx) {
  const meta = await _parseExifMeta(file);
  const utcMs = meta.rawUtcMs;
  const match = utcMs != null ? _matchArtistForPhoto(meta, [], [], null) : { reason: "no_date" };
  return { id: `c${idx}-${file.name}`, name: file.name, file, url: URL.createObjectURL(file), meta, utcMs, match,
           ds: _srDataSet(match.festivalId), dur: null, poster: null, shazam: null };
}

// ── Resolution: base evidence + your corrections → one view per clip ─────
// Pure. Runs on every correction; this IS the re-cut.
function _srResolve(clips, fixes) {
  const views = clips.map(c => {
    const { meta, match, ds } = c;
    const cfg = ds?.config || {};
    const gpsOk = meta.lat != null && (meta.acc == null || meta.acc <= 200);
    const v = { c, ds, gpsOk };
    v.night = match.night
      ? { conf: "confirmed", label: `${_srClock(c.utcMs, cfg)} · ${(cfg.dayDates?.[match.night]?.short || "")} NIGHT`, why: "capture clock" }
      : { conf: "unknown", label: c.utcMs == null ? "No capture time" : "Outside the festival", why: "" };
    const fix = fixes[c.id];
    const alts = (match.alternatives || []).filter(id => id !== match.artistId);
    if (fix) {
      v.artistId = fix; v.aConf = "you"; v.aWhy = "you";
    } else if (match.artistId) {
      v.artistId = match.artistId;
      const d = _srAnchorMeters(ds, ds.artists.find(a => a.id === match.artistId)?.stage, meta.lat, meta.lng);
      const decided = match.reason === "matched" && !match.ambiguous && (match.anchorSource === "crowd" || match.anchorSource === "osm") &&
        meta.acc != null && meta.acc <= _SR_TIGHT_GPS_M;
      v.aConf = decided ? "confirmed" : "likely";
      v.aWhy = decided ? `GPS ±${Math.round(meta.acc)} m · ${d ? d.m + " m from the " + (d.src === "crowd" ? "crowd" : "stage") : "at the stage"}`
        : match.reason === "stage_time_proximity" ? "GPS at the stage, between set times"
        : !gpsOk && meta.lat != null ? `GPS too coarse (±${Math.round(meta.acc / 100) / 10} km) · time only`
        : meta.lat == null ? `no GPS · time only, ${alts.length + 1} sets on`
        : `time + GPS lean, ${alts.length + 1} sets on`;
    } else {
      v.artistId = null; v.aConf = "unknown";
      v.aWhy = match.reason === "off_stage" ? `GPS ±${Math.round(meta.acc || 0)} m · ${match.distMeters} m from any stage`
        : match.reason === "no_artist_at_time" ? "no set on at this time" : "";
    }
    v.alts = v.artistId && v.aConf !== "you" ? alts : [];
    if (!v.artistId && c.utcMs != null && ds) v.alts = _srLiveSets(ds, c.utcMs, meta.lat, meta.lng, gpsOk);
    return v;
  });
  // Neighbours: a clip with no fix it can trust leans on a decided clip shot
  // within six minutes, if that set was still on. Still a lean: LIKELY.
  const decided = views.filter(v => v.aConf === "confirmed" || v.aConf === "you");
  for (const v of views) {
    if (v.aConf === "confirmed" || v.aConf === "you" || v.gpsOk && v.aConf === "unknown") continue;
    if (v.gpsOk && v.c.meta.acc != null && v.c.meta.acc <= _SR_TIGHT_GPS_M) continue;
    let best = null;
    for (const d of decided) {
      if (d.c.match.night !== v.c.match.night || d.ds?.id !== v.ds?.id) continue;
      const dt = Math.abs(d.c.utcMs - v.c.utcMs);
      const a = d.ds.artists.find(x => x.id === d.artistId), w = _srSetWindow(a, d.ds.config);
      if (dt > _SR_NEIGHBOR_MS || !w || v.c.utcMs < w.startMs - 5 * 60000 || v.c.utcMs > w.endMs + 10 * 60000) continue;
      if (!best || dt < best.dt) best = { d, dt };
    }
    if (best && best.d.artistId !== v.artistId) {
      const was = v.artistId;
      v.artistId = best.d.artistId; v.aConf = "likely";
      const s = Math.round(best.dt / 1000);
      v.aWhy = `${s < 90 ? s + " s" : Math.round(s / 60) + " min"} from a ${best.d.aConf === "you" ? "clip you fixed" : "GPS-decided clip"}`;
      v.alts = [was, ...v.alts].filter(id => id && id !== v.artistId);
      v.leanFrom = best.d.c.id;
    }
  }
  for (const v of views) {
    v.artist = v.artistId ? v.ds.artists.find(a => a.id === v.artistId) : null;
    v.stage = v.artist ? _srStageName(v.ds, v.artist.stage) : (v.c.match.reason === "off_stage" ? "Between stages" : null);
  }
  return views.sort((x, y) => (x.c.utcMs ?? 0) - (y.c.utcMs ?? 0));
}

// ── Songs: Shazam on iPhone, the tracklist corpus otherwise ──────────────
async function _srSong(v) {
  if (v.c.shazam?.matched) return { conf: "confirmed", title: v.c.shazam.title, why: "Shazam" };
  const a = v.artist;
  if (!a || typeof _getTracklistForArtist !== "function") return { conf: "unknown", title: null, why: "" };
  // The corpus lookup (_getSupabaseTracklist) keys on the ACTIVE festival's id
  // and _matchSongAtTime reads the active day table, so an EDC clip asked
  // while another festival is active gets that festival's answer, or none.
  // Song lookups here run one at a time (see songQueue), so point the global
  // at the clip's own festival for the whole lookup. Owed in production: pass
  // the festival through instead (and key the cache by it).
  const prev = window.FESTIVAL_CONFIG;
  let data = null, r = null;
  try {
    window.FESTIVAL_CONFIG = v.ds.config;
    data = await _getTracklistForArtist(a.name);
    if (data) r = _matchSongAtTime(a, data, _srLocalStamp(v.c.utcMs));
  } catch {} finally { window.FESTIVAL_CONFIG = prev; }
  if (!data) return { conf: "unknown", title: null, why: "no tracklist for this set" };
  if (!r?.song) return { conf: "unknown", title: null, why: "outside the tracklist" };
  const w = _srSetWindow(a, v.ds.config);
  const min = w ? Math.max(0, Math.round((v.c.utcMs - w.startMs) / 60000)) : null;
  return { conf: "likely", title: r.song,
           why: r.source === "1001tracklists" ? `tracklist cue${min != null ? ` · ${min} min in` : ""}` : "setlist order, not timed" };
}

// ── The cut: 12 seconds, one slot per clip, trimmed to the middle ────────
function _srCut(views) {
  const withMedia = views.filter(v => v.c.dur);
  const n = withMedia.length;
  if (!n) return [];
  const len = _SR_REPLAY_SEC / n;
  let prevKey = null, group = -1;
  return withMedia.map((v, i) => {
    const key = v.artistId || `solo-${v.c.id}`;
    if (key !== prevKey) { group++; prevKey = key; }
    return { v, t0: i * len, t1: (i + 1) * len, from: Math.max(0, (v.c.dur - len) / 2), len, group, key };
  });
}

// ── UI pieces ─────────────────────────────────────────────────────────────
const _SR_CSS = `
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

function SrConf({ conf, why }) {
  // data-evidence is what the honesty audit reads: a confirmed style with no
  // evidence behind it is a failure.
  return <span className="sr-conf" data-conf={conf} data-evidence={conf === "confirmed" || conf === "you" ? (why || "") : ""}>
    <span className={`sr-dot ${conf}`} aria-hidden="true" />
    <span style={{ fontSize: 12, color: conf === "unknown" ? "var(--text-3)" : "var(--text-2)" }}>
      {conf === "you" ? "you fixed this" : conf === "likely" ? `likely · ${why}` : why || "not identified"}
    </span>
  </span>;
}

function SrPlayer({ cut, flashKeys, onTapPlay, playing }) {
  const aRef = React.useRef(null), bRef = React.useRef(null), barRef = React.useRef(null);
  const front = React.useRef("a"), cur = React.useRef(-1), t0 = React.useRef(performance.now());
  const [seg, setSeg] = React.useState(0);
  const cutRef = React.useRef(cut); cutRef.current = cut;
  const playingRef = React.useRef(playing); playingRef.current = playing;
  const pausedAt = React.useRef(0);
  React.useEffect(() => {
    if (playing) t0.current = performance.now() - pausedAt.current;
    else pausedAt.current = (performance.now() - t0.current) % (_SR_REPLAY_SEC * 1000);
    const vids = [aRef.current, bRef.current];
    for (const v of vids) { if (!v) continue; if (!playing) v.pause(); }
    if (playing) { const f = front.current === "a" ? aRef.current : bRef.current; f && f.play().catch(() => {}); }
  }, [playing]);
  React.useEffect(() => {
    let raf = 0;
    const load = (el, s) => {
      if (!el || !s) return;
      if (el.dataset.clip !== s.v.c.id) { el.dataset.clip = s.v.c.id; el.src = s.v.c.url; }
      try { el.currentTime = s.from; } catch {}
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = cutRef.current;
      if (!c.length) return;
      const t = playingRef.current ? ((performance.now() - t0.current) / 1000) % _SR_REPLAY_SEC : pausedAt.current / 1000;
      if (barRef.current) barRef.current.style.transform = `scaleX(${t / _SR_REPLAY_SEC})`;
      let i = c.findIndex(s => t >= s.t0 && t < s.t1);
      if (i < 0) i = 0;
      if (i === cur.current) return;
      cur.current = i;
      const next = front.current === "a" ? bRef.current : aRef.current;
      const prev = front.current === "a" ? aRef.current : bRef.current;
      // The back element was preloaded with this slot; if not (a re-cut moved
      // it), load now. The poster underneath covers the seek.
      if (next.dataset.clip !== c[i].v.c.id) load(next, c[i]);
      else if (Math.abs(next.currentTime - c[i].from) > 0.25) { try { next.currentTime = c[i].from; } catch {} }
      next.style.opacity = "1"; prev.style.opacity = "0";
      if (playingRef.current) next.play().catch(() => {});
      prev.pause();
      front.current = front.current === "a" ? "b" : "a";
      load(prev, c[(i + 1) % c.length]);
      setSeg(i);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  // A re-cut keeps the clock running; force the current slot to re-resolve.
  React.useEffect(() => { cur.current = -1; }, [cut]);
  const s = cut[seg] || cut[0];
  const v = s?.v;
  const groups = [];
  for (const x of cut) { const g = groups[groups.length - 1]; if (g && g.key === x.key) g.t1 = x.t1; else groups.push({ key: x.key, t0: x.t0, t1: x.t1, v: x.v }); }
  const vidStyle = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0, transition: "opacity 80ms linear" };
  return <div style={{ position: "relative", height: 452, background: "#000", overflow: "hidden" }} onClick={onTapPlay}>
    {v?.c.poster && <img alt="" src={v.c.poster} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
    <video ref={aRef} muted playsInline preload="auto" style={vidStyle} />
    <video ref={bRef} muted playsInline preload="auto" style={vidStyle} />
    <div style={{ position: "absolute", inset: 0, background: "var(--media-scrim)", pointerEvents: "none" }} />
    <div style={{ position: "absolute", top: 14, left: 16, right: 16, display: "flex", justifyContent: "space-between" }}>
      <span className="sr-eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>First replay · 12s</span>
      <span className="sr-eyebrow mono" style={{ color: "rgba(255,255,255,.8)" }}>{playing ? "" : "Paused"}</span>
    </div>
    {v && <div key={s.key} style={{ position: "absolute", left: 16, right: 16, bottom: 30, color: "#fff" }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.1 }}
           className={v.aConf === "likely" ? "sr-guess" : ""} data-conf={v.aConf} data-evidence={v.aConf === "confirmed" || v.aConf === "you" ? v.aWhy : ""}>
        {v.artist ? v.artist.name : "Between sets"}{v.aConf === "likely" ? "?" : ""}
      </div>
      <div className="mono" style={{ fontSize: 13, marginTop: 6, color: "rgba(255,255,255,.78)" }}>
        {[v.stage, v.artist && `${_srHHMM(v.artist.start)}–${_srHHMM(v.artist.end)}`, v.night.label].filter(Boolean).join("  ·  ")}
      </div>
      {v.song?.title && <div style={{ fontSize: 13, marginTop: 4, color: "rgba(255,255,255,.78)" }}>
        ♪ <span className={v.song.conf === "likely" ? "sr-guess" : ""}>{v.song.title}{v.song.conf === "likely" ? "?" : ""}</span>
      </div>}
    </div>}
    <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, height: 4, display: "flex", gap: 2 }}>
      {groups.map((g, i) => <div key={g.key + i} style={{ flex: g.t1 - g.t0, background: g.v.aConf === "likely" || g.v.aConf === "unknown" ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.55)",
        borderRadius: 2, animation: flashKeys.has(g.key) ? "sr-pulse 450ms ease-in-out 2" : "none" }} />)}
    </div>
    <div ref={barRef} style={{ position: "absolute", left: 16, right: 16, bottom: 14, height: 4, background: "var(--signal-ink)", transformOrigin: "left", transform: "scaleX(0)", mixBlendMode: "screen", borderRadius: 2 }} />
  </div>;
}

function SrRow({ v, onFix, flash, tapStart }) {
  const a = v.artist;
  const d = (i) => ({ animationDelay: `${i * 110}ms` });
  const altChips = v.alts.slice(0, 3);
  return <div className={`sr-row${flash ? " flash" : ""}`}>
    <div style={{ width: 56, height: 72, borderRadius: 8, overflow: "hidden", background: "var(--paper-2)" }}>
      {v.c.poster && <img alt="" src={v.c.poster} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
    </div>
    <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
      <div className="sr-field" style={d(0)}>
        <div className="mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em" }}>{v.night.label}</div>
      </div>
      <div className="sr-field" style={d(1)}>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>
          <span className={v.aConf === "likely" ? "sr-guess" : ""}>{a ? a.name : v.aConf === "unknown" && v.c.match.reason === "off_stage" ? "Between sets" : "No set identified"}</span>
          {v.aConf === "likely" ? "?" : ""}
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
          {[v.stage, a && `${_srHHMM(a.start)}–${_srHHMM(a.end)}`].filter(Boolean).join(" · ")}
        </div>
        <div style={{ marginTop: 3 }}><SrConf conf={v.aConf} why={v.aWhy} /></div>
      </div>
      <div className="sr-field" style={d(2)}>
        {v.song ? <div style={{ fontSize: 13 }}>
          <span style={{ color: v.song.title ? "var(--ink)" : "var(--text-3)" }} className={v.song.conf === "likely" ? "sr-guess" : ""}>
            ♪ {v.song.title || "Song not identified"}{v.song.conf === "likely" ? "?" : ""}
          </span>
          <div style={{ marginTop: 3 }}><SrConf conf={v.song.conf} why={v.song.why} /></div>
        </div> : <div style={{ fontSize: 13, color: "var(--text-3)" }}>♪ listening…</div>}
      </div>
      {(v.aConf === "likely" || v.aConf === "unknown") && (altChips.length > 0 || a) && <div className="sr-field sr-alts" style={d(3)}
           onPointerDown={() => tapStart(v.c.id)}>
        {a && <button className="sr-chip yes" onClick={() => onFix(v.c.id, a.id)}>✓ {a.name}</button>}
        {altChips.map(id => { const x = v.ds.artists.find(q => q.id === id); return x &&
          <button key={id} className="sr-chip" onClick={() => onFix(v.c.id, id)}>{x.name} <span style={{ color: "var(--text-2)" }}>· {_srStageName(v.ds, x.stage)}</span></button>; })}
      </div>}
    </div>
  </div>;
}

// A correction re-resolves every view object, but only the rows whose content
// moved should re-render; the rest of the list must not cost a frame.
const SrRowMemo = React.memo(SrRow, (p, n) => {
  const a = p.v, b = n.v;
  return p.flash === n.flash && a.c.id === b.c.id && a.c.poster === b.c.poster && a.artistId === b.artistId &&
    a.aConf === b.aConf && a.aWhy === b.aWhy && a.song === b.song && a.night.label === b.night.label &&
    a.alts.join() === b.alts.join() && p.onFix === n.onFix && p.tapStart === n.tapStart;
});

function SrGates({ gates, onClose }) {
  const row = (label, value, ok) => <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
    <span style={{ fontSize: 13 }}>{label}</span>
    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: ok == null ? "var(--text-2)" : ok ? "var(--ink)" : "var(--alert)" }}>{value}{ok == null ? "" : ok ? "  PASS" : "  FAIL"}</span>
  </div>;
  const g = gates;
  return <div role="dialog" aria-label="Kill gates" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "min(358px, calc(100% - 32px))",
    background: "var(--paper-2)", border: "1px solid var(--line-2)", borderRadius: 14, padding: "12px 16px 8px", zIndex: 5 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 }}>
      <span className="sr-eyebrow">Kill gates · measured live</span>
      <button className="sr-btn" style={{ padding: "6px 10px" }} onClick={onClose}>Close</button>
    </div>
    {row("First media frame", g.firstFrameMs == null ? "—" : `${g.firstFrameMs} ms`, g.firstFrameMs == null ? null : g.firstFrameMs < 2000)}
    {row("Scroll: frames over 50 ms", g.scrollFrames ? `${g.longFrames} / ${g.scrollFrames}` : "scroll the list", g.scrollFrames ? g.longFrames === 0 : null)}
    {row("Last correction", g.lastTaps == null ? "—" : `${g.lastTaps} tap${g.lastTaps === 1 ? "" : "s"}`, g.lastTaps == null ? null : g.lastTaps <= 2)}
    {row("Guesses styled as confirmed", String(g.falseConfirmed), g.falseConfirmed === 0)}
  </div>;
}

// ── The screen ────────────────────────────────────────────────────────────
function SetReconstruction() {
  const [clips, setClips] = React.useState([]);
  const [fixes, setFixes] = React.useState({});
  const [songs, setSongs] = React.useState({});
  const [flash, setFlash] = React.useState({ rows: new Set(), keys: new Set() });
  const [playing, setPlaying] = React.useState(true);
  const [showGates, setShowGates] = React.useState(false);
  const [gates, setGates] = React.useState({ firstFrameMs: null, longFrames: 0, scrollFrames: 0, lastTaps: null, falseConfirmed: 0 });
  const importT0 = React.useRef(null), taps = React.useRef({ id: null, n: 0 });
  const rootRef = React.useRef(null);
  const sample = React.useMemo(() => (new URLSearchParams(location.search).get("sample") || "").split(",").filter(Boolean), []);

  const views = React.useMemo(() => _srResolve(clips, fixes).map(v => ({ ...v, song: songs[`${v.c.id}|${v.artistId || ""}`] || null })), [clips, fixes, songs]);
  const cut = React.useMemo(() => _srCut(views), [views]);
  const prevViews = React.useRef(new Map());

  // Posters and durations, one clip at a time in capture order: the first
  // frame on screen is what the gate measures, so nothing competes with it.
  const posterQueue = React.useRef(Promise.resolve());
  const enqueueMedia = (c) => {
    posterQueue.current = posterQueue.current.then(async () => {
      const [dur, blob] = await Promise.all([_videoDuration(c.file).catch(() => null), _videoPosterBlob(c.file).catch(() => null)]);
      const poster = blob ? URL.createObjectURL(blob) : null;
      if (poster && importT0.current != null) {
        const img = new Image();
        img.onload = () => setGates(g => g.firstFrameMs != null ? g : { ...g, firstFrameMs: Math.round(performance.now() - importT0.current) });
        img.src = poster;
      }
      setClips(cs => cs.map(x => x.id === c.id ? { ...x, dur: dur || x.dur || 3, poster } : x));
    });
  };
  const addFiles = async (files) => {
    importT0.current = performance.now();
    setGates(g => ({ ...g, firstFrameMs: null }));
    const list = files.slice(0, _SR_MAX_CLIPS);
    for (let i = 0; i < list.length; i++) {
      const f = await list[i];
      if (!f) continue;
      const c = await _srReadClip(f, clips.length + i);
      setClips(cs => [...cs, c].sort((x, y) => (x.utcMs ?? 0) - (y.utcMs ?? 0)));
      enqueueMedia(c);
    }
    // Shazam runs on the FULL clip, never a trim (recap-engine's ordering
    // constraint). iPhone only: the web has no recogniser.
    if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin?.identifyBase64 && typeof _blobToBase64 === "function") {
      for (const f of list) {
        const file = await f; if (!file) continue;
        try {
          const r = await window.ShazamPlugin.identifyBase64({ data: await _blobToBase64(file), ext: (file.name.split(".").pop() || "mov").toLowerCase() });
          setClips(cs => cs.map(x => x.file === file ? { ...x, shazam: r?.matched ? { matched: true, title: r.artist ? `${r.artist} — ${r.title}` : r.title } : { matched: false } } : x));
        } catch {}
      }
    }
  };
  // One download at a time, like files arriving from the picker: twelve
  // parallel 20-60 MB fetches would compete with the first poster the gate
  // is timing. Each promise starts only when addFiles awaits it.
  const loadSample = () => addFiles(sample.map(n => ({ then: (ok, bad) => fetch(`/.proto-media/${encodeURIComponent(n)}`)
    .then(r => r.ok ? r.blob() : null).then(b => b ? new File([b], n, { type: "video/quicktime" }) : null).catch(() => null).then(ok, bad) })));

  // Songs follow the artist: a correction asks again for the new set.
  const songQueue = React.useRef(Promise.resolve()), asked = React.useRef(new Set());
  React.useEffect(() => {
    for (const v of views) {
      const k = `${v.c.id}|${v.artistId || ""}`;
      if (asked.current.has(k)) continue;
      asked.current.add(k);
      songQueue.current = songQueue.current.then(() => _srSong(v)).then(r => setSongs(s => ({ ...s, [k]: r }))).catch(() => {});
    }
  }, [views]);

  // What a correction changed, so the list and the replay can show it.
  React.useEffect(() => {
    const rows = new Set(), keys = new Set();
    for (const v of views) {
      const p = prevViews.current.get(v.c.id);
      if (p && (p.artistId !== v.artistId || p.aConf !== v.aConf)) { rows.add(v.c.id); keys.add(v.artistId || `solo-${v.c.id}`); }
    }
    prevViews.current = new Map(views.map(v => [v.c.id, { artistId: v.artistId, aConf: v.aConf }]));
    if (rows.size) { setFlash({ rows, keys }); const t = setTimeout(() => setFlash({ rows: new Set(), keys: new Set() }), 950); return () => clearTimeout(t); }
  }, [views]);

  // Honesty audit: every element styled confirmed must carry its evidence.
  React.useEffect(() => {
    const t = setTimeout(() => {
      const bad = [...(rootRef.current?.querySelectorAll('[data-conf="confirmed"],[data-conf="you"]') || [])].filter(el => !el.dataset.evidence).length;
      setGates(g => g.falseConfirmed === bad ? g : { ...g, falseConfirmed: bad });
    }, 400);
    return () => clearTimeout(t);
  });

  // Scroll smoothness: count frames over 50 ms while the list is moving.
  React.useEffect(() => {
    const el = rootRef.current; if (!el) return;
    let moving = 0, last = 0, raf = 0;
    const onScroll = () => { moving = performance.now() + 150; if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const loop = (now) => {
      const dt = now - last; last = now;
      setGates(g => ({ ...g, scrollFrames: g.scrollFrames + 1, longFrames: g.longFrames + (dt > 50 ? 1 : 0) }));
      raf = now < moving ? requestAnimationFrame(loop) : 0;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // Stable identities, so a memoised row is not re-rendered for a new closure.
  const tapStart = React.useCallback((id) => { if (taps.current.id !== id) taps.current = { id, n: 0 }; taps.current.n++; }, []);
  const onFix = React.useCallback((id, artistId) => {
    const n = taps.current.id === id ? taps.current.n : 1;
    taps.current = { id: null, n: 0 };
    setGates(g => ({ ...g, lastTaps: n }));
    setFixes(f => ({ ...f, [id]: artistId }));
  }, []);

  const ds = views[0]?.ds;
  const nights = [...new Set(views.map(v => v.c.match.night).filter(Boolean))];
  const nightName = nights.length === 1 ? ds?.config?.dayDates?.[nights[0]]?.name : null;
  const sets = new Set(views.filter(v => v.artistId).map(v => v.artistId)).size;
  const toCheck = views.filter(v => v.aConf === "likely" || v.aConf === "unknown").length;

  return <div className="sr-root" ref={rootRef}>
    <style>{_SR_CSS}</style>
    <div className="sr-col">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "calc(var(--top-pad, 0px) + 14px) 16px 12px" }}>
        <div>
          <div className="sr-eyebrow">Set reconstruction · prototype</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
            {views.length ? `${nightName ? nightName + " night" : "Your night"}${ds?.config?.name ? " · " + ds.config.name : ""}` : "Rebuild a night from your clips"}
          </div>
        </div>
        <button className="sr-btn" onClick={() => { location.href = location.pathname; }}>Done</button>
      </div>

      {!views.length && <div style={{ padding: "8px 16px 24px", display: "grid", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--text-2)", maxWidth: "34ch" }}>
          Pick 8–12 videos from one night. Plursky reads each clip's clock and GPS, lines it up against the set times, and cuts a 12-second replay you can fix as you go.
        </p>
        <label className="sr-chip yes" style={{ justifySelf: "start", padding: "12px 16px", fontSize: 15 }}>
          Choose clips
          <input type="file" accept="video/*" multiple style={{ display: "none" }} onChange={e => addFiles([...e.target.files].map(f => Promise.resolve(f)))} />
        </label>
        {sample.length > 0 && <button className="sr-chip" style={{ justifySelf: "start", padding: "12px 16px", fontSize: 15 }} onClick={loadSample}>Load the sample night ({sample.length} clips)</button>}
      </div>}

      {views.length > 0 && <SrPlayer cut={cut} flashKeys={flash.keys} playing={playing} onTapPlay={() => setPlaying(p => !p)} />}

      {views.length > 0 && <div style={{ display: "flex", gap: 16, padding: "14px 16px", alignItems: "baseline" }}>
        <span className="mono" style={{ fontSize: 13 }}><b>{views.length}</b> clips</span>
        <span className="mono" style={{ fontSize: 13 }}><b>{sets}</b> sets</span>
        <span className="mono" style={{ fontSize: 13, color: toCheck ? "var(--signal-ink)" : "var(--text-2)" }}><b>{toCheck}</b> to check</span>
        <span style={{ flex: 1 }} />
        <span className="sr-conf" style={{ fontSize: 11, color: "var(--text-2)", gap: 10 }}>
          <span className="sr-conf"><span className="sr-dot confirmed" /> sure</span>
          <span className="sr-conf"><span className="sr-dot likely" /> likely</span>
        </span>
      </div>}

      {views.map(v => <SrRowMemo key={v.c.id} v={v} onFix={onFix} tapStart={tapStart} flash={flash.rows.has(v.c.id)} />)}
    </div>
    {views.length > 0 && !showGates && <button className="sr-btn" style={{ position: "fixed", right: "max(16px, calc(50% - 179px))", bottom: 16, zIndex: 5 }} onClick={() => setShowGates(true)}>Gates</button>}
    {showGates && <SrGates gates={gates} onClose={() => setShowGates(false)} />}
  </div>;
}

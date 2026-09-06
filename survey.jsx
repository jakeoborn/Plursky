// ── survey.jsx — crowd-anchor capture ────────────────────────────────────
//
// WHAT THIS PRODUCES, and what it does not.
//
// It writes `crowdAnchors`: "where does a person STAND to watch this stage".
// It does NOT produce `gpsAnchors`, which answer "where did the artist DRAW
// this stage" and are what MAP_AFFINE is solved from. Those are different
// quantities — EDC's measured kinetic centroid is 438 m from its own poster
// pin — so nothing captured here can source a map registration, and it must
// never be pasted into gpsAnchors. data.jsx says the same thing in bold.
//
// What it IS for: the tagger. photo-tag.jsx attributes a photo to a stage by
// matching EXIF GPS against resolvedStageAnchors(), which prefers a measured
// crowd anchor and falls back to the poster pin. On ACL every stage is on the
// poster fallback today, so auto-tagging is flagged ambiguous for the whole
// festival. Three measured stages turn that around for the sets that matter.
//
// ── Why a DWELL, not a tap ───────────────────────────────────────────────
// The shipping rule in data.jsx needs n >= 3 with spread < 100 m. Three taps
// five seconds apart would satisfy it arithmetically and mean nothing: the
// same person standing in the same spot is one observation, not three, and
// the tight spread would be an artifact of not having moved. So capture is
// bracketed — START when you arrive, STOP when you leave — and samples the
// whole dwell. Drifting through the crowd over a set is what makes the
// centroid a distribution instead of an anecdote.
//
// That is two taps a stage, six for the three-stage pass.
//
// ── Reveal ───────────────────────────────────────────────────────────────
// Founder tool, not a user feature. Open plursky.com/?survey=1 once and the
// row appears in the map's More menu from then on, offline included. There is
// no hidden gesture to remember at 1 AM in a field.

const SURVEY_KEY  = "plursky_survey_v1";
const SURVEY_FLAG = "plursky_survey_enabled";

// A fix worse than this is thrown away rather than averaged in. A 60 m fix
// does not "add information you can mean out" — it drags the centroid and
// inflates the spread toward the threshold the gate checks.
const SURVEY_MAX_ACCURACY_M = 25;

function surveyEnabled() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.get("survey") === "1") localStorage.setItem(SURVEY_FLAG, "1");
    if (p.get("survey") === "0") localStorage.removeItem(SURVEY_FLAG);
    return localStorage.getItem(SURVEY_FLAG) === "1";
  } catch { return false; }
}

function readSurvey() {
  try { return JSON.parse(localStorage.getItem(SURVEY_KEY) || "[]"); }
  catch { return []; }
}
function writeSurvey(sessions) {
  try { localStorage.setItem(SURVEY_KEY, JSON.stringify(sessions)); } catch {}
}

// Metres between two fixes. Local rather than reaching for map.jsx's
// distMiles() so this file stands on its own if the map is ever split up.
function _surveyM(lat1, lng1, lat2, lng2) {
  const R = 6371000, p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p, dLng = (lng2 - lng1) * p;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1*p) * Math.cos(lat2*p) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function surveyCentroid(samples) {
  if (!samples.length) return null;
  const lat = samples.reduce((s, x) => s + x.lat, 0) / samples.length;
  const lng = samples.reduce((s, x) => s + x.lng, 0) / samples.length;
  return { lat, lng };
}

// spreadM is the FURTHEST sample from the centroid, not a standard deviation
// or a mean radius. It is the number the gate compares against 100 m, so it
// should be the pessimistic reading: one wanderer to the back of the field is
// exactly the case worth surfacing rather than smoothing away.
function surveySpreadM(samples, centroid) {
  if (!centroid || samples.length < 2) return 0;
  return Math.round(Math.max(...samples.map(s => _surveyM(centroid.lat, centroid.lng, s.lat, s.lng))));
}

// Collapse every dwell at a stage into the single anchor row that ships.
// Two dwells on different days are the interesting case: `nights` counts
// distinct local dates, and an independent night agreeing with the first is
// what separates a measurement from an anecdote (see data.jsx on kinetic).
function surveyRollup(festivalId) {
  const byStage = new Map();
  for (const s of readSurvey()) {
    if (s.festivalId !== festivalId || !s.samples?.length) continue;
    if (!byStage.has(s.stageId)) byStage.set(s.stageId, []);
    byStage.get(s.stageId).push(s);
  }
  return [...byStage.entries()].map(([stageId, sessions]) => {
    const samples = sessions.flatMap(s => s.samples);
    const centroid = surveyCentroid(samples);
    const spreadM = surveySpreadM(samples, centroid);
    const nights = new Set(sessions.map(s => new Date(s.startedAt).toDateString())).size;
    // Same three conditions data.jsx ships under. (c) is not checkable from
    // here and never claims to be — it is asked, and carried as a signature.
    const soleSetInWindow = sessions.every(s => s.soleSet === true);
    const asked = sessions.every(s => s.soleSet != null);
    return {
      stageId, sessions, centroid, spreadM, nights,
      n: samples.length, soleSetInWindow, asked,
      ok: samples.length >= 3 && spreadM < 100 && soleSetInWindow,
    };
  }).sort((a, b) => a.stageId.localeCompare(b.stageId));
}

// The exact block that goes into the festival's config. Emitted as text to
// copy rather than written anywhere automatically: a measurement entering the
// repo should go through a diff someone reads, same as any other data.
function surveyExportBlock(festivalId) {
  const rows = surveyRollup(festivalId).filter(r => r.ok);
  if (!rows.length) return "";
  const date = new Date().toISOString().slice(0, 10);
  const src = `jake-${festivalId.replace(/-20\d\d$/, "")}${new Date().getFullYear()}-survey`;
  const body = rows.map(r =>
    `    { stageId: ${JSON.stringify(r.stageId)}, lat: ${r.centroid.lat.toFixed(6)}, lng: ${r.centroid.lng.toFixed(6)}, n: ${r.n}, nights: ${r.nights},\n` +
    `      spreadM: ${r.spreadM}, soleSetInWindow: true, measuredAt: ${JSON.stringify(date)},\n` +
    `      source: ${JSON.stringify(src)} },`
  ).join("\n");
  return `  // Captured in-app during ${festivalId}. spreadM is the furthest sample\n` +
         `  // from the centroid. Crowd positions — do NOT paste into gpsAnchors.\n` +
         `  crowdAnchors: [\n${body}\n  ],`;
}

// ── Recorder ─────────────────────────────────────────────────────────────
// Its own watchPosition rather than borrowing the map's: surveying has to
// work whether or not the user has the live-GPS toggle on, and a survey wants
// every fresh fix where the map is happy with a cached one.
function useSurveyRecorder() {
  const [active, setActive] = React.useState(null);   // { stageId, startedAt, samples }
  const [lastFix, setLastFix] = React.useState(null);
  const [rejected, setRejected] = React.useState(0);
  const [error, setError] = React.useState(null);
  const watchRef = React.useRef(null);

  const stop = React.useCallback((keep = true) => {
    if (watchRef.current != null) {
      try { navigator.geolocation.clearWatch(watchRef.current); } catch {}
      watchRef.current = null;
    }
    setActive(cur => {
      if (cur && keep && cur.samples.length) {
        // soleSet stays null until it is ASKED. An unanswered attestation must
        // not read as a yes — that is the whole point of carrying it.
        writeSurvey([...readSurvey(), { ...cur, endedAt: Date.now(), soleSet: null,
                                        id: `${cur.stageId}-${cur.startedAt}` }]);
      }
      return null;
    });
    setLastFix(null); setRejected(0);
  }, []);

  const start = React.useCallback((stageId) => {
    if (!navigator.geolocation) { setError("This device has no geolocation."); return; }
    setError(null); setRejected(0);
    setActive({ stageId, festivalId: FESTIVAL_CONFIG.id, startedAt: Date.now(), samples: [] });
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const acc = p.coords.accuracy;
        if (!(acc <= SURVEY_MAX_ACCURACY_M)) { setRejected(r => r + 1); setLastFix({ acc, kept: false }); return; }
        setLastFix({ acc, kept: true });
        setActive(cur => cur && ({ ...cur, samples: [...cur.samples, {
          lat: p.coords.latitude, lng: p.coords.longitude, acc, ts: Date.now(),
        }]}));
      },
      (e) => setError(e.code === 1 ? "Location permission denied." : "Could not get a fix."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }, []);

  // A recording that survives a screen lock but not a reload would lose a
  // whole set silently. Clearing the watch on unmount keeps the failure loud.
  React.useEffect(() => () => {
    if (watchRef.current != null) { try { navigator.geolocation.clearWatch(watchRef.current); } catch {} }
  }, []);

  const centroid = active ? surveyCentroid(active.samples) : null;
  return { active, lastFix, rejected, error, start, stop,
           spreadM: active ? surveySpreadM(active.samples, centroid) : 0 };
}

// ── Panel ────────────────────────────────────────────────────────────────
function SurveyPanel({ onClose, nearestStageId }) {
  const rec = useSurveyRecorder();
  const [tick, setTick] = React.useState(0);              // re-read localStorage after writes
  const [pick, setPick] = React.useState(nearestStageId || (STAGES[0] && STAGES[0].id));
  const [copied, setCopied] = React.useState(false);
  const rollup = React.useMemo(() => surveyRollup(FESTIVAL_CONFIG.id), [tick, rec.active]);
  const shipping = rollup.filter(r => r.ok).length;
  const pending  = rollup.filter(r => !r.asked && r.n >= 3);

  const answer = (stageId, yes) => {
    writeSurvey(readSurvey().map(s => s.stageId === stageId && s.festivalId === FESTIVAL_CONFIG.id && s.soleSet == null
      ? { ...s, soleSet: yes } : s));
    setTick(t => t + 1);
  };
  const drop = (stageId) => {
    writeSurvey(readSurvey().filter(s => !(s.stageId === stageId && s.festivalId === FESTIVAL_CONFIG.id)));
    setTick(t => t + 1);
  };
  const copy = async () => {
    const text = surveyExportBlock(FESTIVAL_CONFIG.id);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopied("manual"); }
  };

  const L = { fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "var(--muted)" };
  const btn = (bg, fg) => ({
    background: bg, color: fg, border: "none", borderRadius: 999,
    padding: "9px 16px", cursor: "pointer",
    fontFamily: "Geist Mono, monospace", fontSize: 11, letterSpacing: 1.2, fontWeight: 700,
  });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(26,18,13,0.55)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }}/>
      <div style={{
        position: "relative", width: "100%", maxHeight: "88%", overflowY: "auto",
        background: "var(--paper)", color: "var(--ink)",
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: "14px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
          <div className="serif" style={{ fontSize: 22, flex: 1 }}>Crowd survey</div>
          <button onClick={onClose} style={{ ...btn("transparent", "var(--muted)"), border: "1px solid var(--line-2)", padding: "6px 12px" }}>DONE</button>
        </div>
        <div style={{ ...L, marginBottom: 12, letterSpacing: 1, lineHeight: 1.5, textTransform: "none", fontWeight: 500, fontSize: 10.5 }}>
          Where people <em>stand</em> to watch a stage — this fixes photo tagging.
          It is not a map measurement and never goes into gpsAnchors.
        </div>

        {rec.error && (
          <div style={{ background: "rgba(193,74,74,0.10)", border: "1px solid rgba(193,74,74,0.35)", color: "#c14a4a",
                        borderRadius: 10, padding: "9px 11px", marginBottom: 10, fontSize: 12 }}>{rec.error}</div>
        )}

        {/* ── recording ── */}
        {rec.active ? (
          <div style={{ background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 13px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, background: "var(--ember)", animation: "pulse 1.6s infinite" }}/>
              <span style={L}>RECORDING · {(STAGES.find(s => s.id === rec.active.stageId) || {}).short || rec.active.stageId}</span>
            </div>
            <div className="serif" style={{ fontSize: 30, lineHeight: 1.05, marginTop: 6 }}>
              {rec.active.samples.length} <span style={{ fontSize: 13, color: "var(--muted)" }}>fixes · spread {rec.spreadM} m</span>
            </div>
            <div style={{ ...L, marginTop: 4, fontWeight: 500, letterSpacing: 0.6, textTransform: "none", fontSize: 10.5 }}>
              {rec.active.samples.length < 3
                ? "Needs 3 to ship. Stay for the set and move about the crowd as you normally would."
                : rec.spreadM >= 100
                  ? "Spread is over 100 m — this is reading as two spots, not one. It will not ship."
                  : "Enough to ship. Longer is better."}
              {rec.rejected > 0 && ` ${rec.rejected} fix${rec.rejected > 1 ? "es" : ""} dropped as too coarse (> ${SURVEY_MAX_ACCURACY_M} m).`}
              {rec.lastFix && ` Last fix ±${Math.round(rec.lastFix.acc)} m.`}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
              <button onClick={() => { rec.stop(true); setTick(t => t + 1); }} style={{ ...btn("var(--ink)", "var(--paper)"), flex: 1 }}>■ STOP &amp; KEEP</button>
              <button onClick={() => rec.stop(false)} style={{ ...btn("transparent", "var(--muted)"), border: "1px solid var(--line-2)" }}>DISCARD</button>
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 13px", marginBottom: 12 }}>
            <div style={L}>YOU ARE STANDING AT</div>
            <select value={pick} onChange={e => setPick(e.target.value)} style={{
              width: "100%", marginTop: 6, padding: "9px 10px", borderRadius: 10,
              border: "1px solid var(--line-2)", background: "var(--paper)", color: "var(--ink)",
              fontFamily: "Geist, sans-serif", fontSize: 14,
            }}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => rec.start(pick)} style={{ ...btn("var(--ember)", "#fff"), width: "100%", marginTop: 9 }}>● START RECORDING</button>
          </div>
        )}

        {/* ── the attestation data.jsx refuses to ship without ── */}
        {pending.map(r => (
          <div key={r.stageId} style={{ background: "rgba(245,154,54,0.10)", border: "1px solid rgba(245,154,54,0.4)",
                                        borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              At <strong>{(STAGES.find(s => s.id === r.stageId) || {}).name || r.stageId}</strong>, was
              exactly <strong>one</strong> set you were watching live for that whole window?
            </div>
            <div style={{ ...L, marginTop: 3, fontWeight: 500, letterSpacing: 0.6, textTransform: "none", fontSize: 10 }}>
              If you drifted between two stages the centroid anchors neither. Nothing can check this but you.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
              <button onClick={() => answer(r.stageId, true)} style={{ ...btn("var(--ink)", "var(--paper)"), flex: 1 }}>YES — ONE SET</button>
              <button onClick={() => answer(r.stageId, false)} style={{ ...btn("transparent", "var(--muted)"), border: "1px solid var(--line-2)", flex: 1 }}>NO / UNSURE</button>
            </div>
          </div>
        ))}

        {/* ── captured ── */}
        <div style={{ ...L, marginTop: 4, marginBottom: 6 }}>CAPTURED · {shipping} OF 3 STAGES SHIPPABLE</div>
        {rollup.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>Nothing recorded yet.</div>}
        {rollup.map(r => {
          const st = STAGES.find(s => s.id === r.stageId);
          const why = r.n < 3 ? `only ${r.n} fix${r.n > 1 ? "es" : ""}`
                    : r.spreadM >= 100 ? `spread ${r.spreadM} m`
                    : !r.asked ? "needs the one-set answer"
                    : !r.soleSetInWindow ? "more than one set in the window"
                    : null;
          return (
            <div key={r.stageId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", marginBottom: 6,
                                          background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 12 }}>
              <span style={{ width: 5, alignSelf: "stretch", borderRadius: 3, background: (st && st.color) || "var(--line-2)" }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Geist, sans-serif", fontSize: 13.5, fontWeight: 600 }}>{(st && st.name) || r.stageId}</div>
                <div style={{ ...L, fontWeight: 500, letterSpacing: 0.6, textTransform: "none", fontSize: 10.5 }}>
                  n={r.n} · spread {r.spreadM} m · {r.nights} day{r.nights > 1 ? "s" : ""}{why ? ` · ${why}` : ""}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 9, letterSpacing: 1, fontWeight: 700, color: r.ok ? "var(--success)" : "var(--muted)" }}>
                {r.ok ? "SHIPPABLE" : "HELD"}
              </span>
              <button onClick={() => drop(r.stageId)} aria-label={`Delete ${r.stageId} survey`}
                      style={{ ...btn("transparent", "var(--muted)"), border: "1px solid var(--line-2)", padding: "5px 9px", fontSize: 10 }}>✕</button>
            </div>
          );
        })}

        {/* ── export ── */}
        {shipping > 0 && (
          <>
            <button onClick={copy} style={{ ...btn("var(--ink)", "var(--paper)"), width: "100%", marginTop: 8 }}>
              {copied === true ? "✓ COPIED" : `COPY crowdAnchors BLOCK · ${shipping} STAGE${shipping > 1 ? "S" : ""}`}
            </button>
            {copied === "manual" && (
              <textarea readOnly value={surveyExportBlock(FESTIVAL_CONFIG.id)} onFocus={e => e.target.select()} style={{
                width: "100%", height: 150, marginTop: 8, padding: 9, borderRadius: 10,
                border: "1px solid var(--line-2)", background: "var(--paper-2)", color: "var(--ink)",
                fontFamily: "Geist Mono, monospace", fontSize: 10, whiteSpace: "pre",
              }}/>
            )}
          </>
        )}
      </div>
    </div>
  );
}

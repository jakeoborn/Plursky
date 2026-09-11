// Lineup / schedule screen — day tabs, stage-striped timeline list

// "Legendary" moments — auto-detected from the data so vets can surface
// the rare stuff (sunrise sets, B2Bs) without manual curation. Sunrise =
// any Kinetic Field set ending between 05:00 and 05:30 PT. B2B = any
// artist name with a "b2b" segment.
function isLegendary(a) {
  const name = (a.name || "").toLowerCase();
  if (name.includes("b2b") || name.includes("vs.") || name.includes(" x ")) return true;
  if (a.stage === "kinetic") {
    const [h, m] = a.end.split(":").map(Number);
    if (h >= 5 && h < 6) return true; // sunrise window
  }
  return false;
}

// ── ICS calendar export ──────────────────────────────────────
function _msToIcsDate(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function _artistMs(artist, hhmm) {
  // Feeds exportSavedSetsICS. Weekend-blind here meant a W2 attendee's entire
  // calendar export landed on Weekend 1. artistDayDate (data.jsx) stamps the
  // weekend THIS act plays, so a Build My Night selection that has not been
  // saved yet still exports on the right dates — the earlier fix filtered the
  // acts by the selection but still dated them from persisted storage.
  return _wallMs(artistDayDate(artist), hhmm, FESTIVAL_CONFIG && FESTIVAL_CONFIG.tz);
}

async function exportSavedSetsICS(savedIds) {
  const artists = activeLineup(savedIds).filter(a => savedIds.includes(a.id))
    .sort((a, b) => (a.day - b.day) || (a.start < b.start ? -1 : 1));
  if (!artists.length) return;

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0",
    `PRODID:-//Plursky//${FESTIVAL_CONFIG.name}//EN`,
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];

  artists.forEach(a => {
    const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
    const startMs = _artistMs(a, a.start);
    const endMs   = _artistMs(a, a.end);
    if (!startMs || !endMs) return;
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${_msToIcsDate(startMs)}`,
      `DTEND:${_msToIcsDate(endMs)}`,
      `SUMMARY:${a.name}${stage ? " @ " + stage.name : ""}`,
      `DESCRIPTION:${FESTIVAL_CONFIG.name}`,
      `LOCATION:${FESTIVAL_CONFIG.location}`,
      `UID:plursky-${a.id}@plursky.app`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const fileName = `${FESTIVAL_CONFIG.id}-plursky.ics`;

  // Native iOS first — @capacitor/share with a data URL, same v163 house
  // pattern as every other share fn (navigator.share({files}) can fail
  // silently inside WKWebView).
  const capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob);
      });
      await capShare.share({ title: `My ${FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name} schedule`, files: [dataUrl] });
      return;
    } catch (e) { if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-ics]", e.message); }
  }

  const shareFile = new File([blob], fileName, { type: "text/plain" });
  if (navigator.canShare?.({ files: [shareFile] }) && navigator.share) {
    try { await navigator.share({ files: [shareFile], title: `My ${FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name}` }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    window.open(`data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`, "_blank");
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

// The Build My Night text share. Resolves the weekend from the ids it is
// sharing, the way exportSavedSetsICS does: the selection is not written to
// storage until Save, and the no-arg activeLineup() this used to call resolved
// from storage and dropped every other-weekend pick (round 5).
function _nightShareText(ids) {
  const lines = festivalDayNums().flatMap(day => {
    const d = FESTIVAL_CONFIG.dayDates[day];
    const dayArtists = activeLineup(ids).filter(a => a.day === day && ids.includes(a.id))
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
    if (!dayArtists.length) return [];
    return [`${d.short} · ${d.name.toUpperCase()}`,
      ...dayArtists.map(a => `  ${fmt12(a.start)}  ${a.name}`), ""];
  });
  return [`My ${FESTIVAL_CONFIG.name} lineup (${ids.length} sets):`, "", ...lines].join("\n").trim();
}

// ── Build My Night wizard ─────────────────────────────────────
function NightWizard({ state, setState, onClose }) {
  const [activeDay, setActiveDay] = React.useState(() => {
    const best = DAYS.map(d => ({
      n: d.n,
      count: activeLineup().filter(a => a.day === d.n && state.saved.includes(a.id)).length,
    })).reduce((b, d) => d.count > b.count ? d : b, { n: 1, count: 0 });
    return best.n;
  });

  const [local, setLocal] = React.useState(() => new Set(state.saved));
  // Every read below acts on `local`, the in-progress selection, so the
  // weekend is resolved from `local` too. The ICS export already did; the
  // counts, the list, the gap fits and Auto-fill resolved from storage and
  // hid other-weekend picks until Save (round 5, same defect as the share).
  const localIds = Array.from(local);

  const dayStats = DAYS.map(d => {
    const sets = activeLineup(localIds).filter(a => a.day === d.n && local.has(a.id));
    let clashes = 0;
    for (let i = 0; i < sets.length; i++)
      for (let j = i + 1; j < sets.length; j++)
        if (overlaps(sets[i], sets[j])) clashes++;
    return { ...d, count: sets.length, clashes };
  });

  const sorted = activeLineup(localIds)
    .filter(a => a.day === activeDay && local.has(a.id))
    .sort((a, b) => toNightMin(a.start) - toNightMin(b.start));

  const conflictIds = new Set();
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++)
      if (overlaps(sorted[i], sorted[j])) { conflictIds.add(sorted[i].id); conflictIds.add(sorted[j].id); }

  // Build interleaved timeline: sets + gap items
  const items = [];
  for (let i = 0; i < sorted.length; i++) {
    items.push({ type: "set", artist: sorted[i] });
    if (i < sorted.length - 1) {
      const gS = toNightMin(sorted[i].end), gE = toNightMin(sorted[i + 1].start);
      if (gE > gS + 5) {
        const gapMin = gE - gS;
        const fits = activeLineup(localIds).filter(a =>
          a.day === activeDay && !local.has(a.id) &&
          toNightMin(a.start) >= gS && toNightMin(a.start) < gE - 14
        ).sort((a, b) => b.tier - a.tier).slice(0, 3);
        items.push({ type: "gap", gapMin, endOf: sorted[i].end, startOf: sorted[i + 1].start, fits });
      }
    }
  }

  const drop = id => setLocal(p => { const n = new Set(p); n.delete(id); return n; });
  const add  = id => setLocal(p => new Set([...p, id]));

  const handleSave = () => {
    setState(st => ({ ...st, saved: Array.from(local) }));
    onClose();
  };

  const autoFill = () => {
    const candidates = activeLineup(localIds).filter(a => a.day === activeDay)
      .sort((a, b) => (b.tier - a.tier) || (toNightMin(a.start) - toNightMin(b.start)));
    const picked = [];
    for (const a of candidates) {
      if (picked.length >= 8) break;
      if (!picked.some(p => overlaps(p, a))) picked.push(a);
    }
    setLocal(prev => {
      const merged = new Set(prev);
      // Remove existing day sets then add optimal picks
      activeLineup(localIds).filter(a => a.day === activeDay).forEach(a => merged.delete(a.id));
      picked.forEach(a => merged.add(a.id));
      return merged;
    });
  };

  const sunrise = FESTIVAL_CONFIG.sunTimes[activeDay]?.rise;
  const fmtGap = m => m >= 60 ? `${Math.floor(m / 60)}H ${m % 60}M` : `${m}M`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px 12px",
        paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
        borderBottom: "1px solid var(--line)",
      }}>
        <button onClick={onClose} aria-label="Close Build My Night" style={{
          width: 36, height: 36, borderRadius: 36, background: "var(--paper-2)",
          border: "1px solid var(--line-2)", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>←</button>
        <div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.8, fontWeight: 700, textAlign: "center" }}>BUILD MY NIGHT</div>
          <div className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", textAlign: "center", marginTop: 2 }}>
            {Array.from(local).length} SETS SAVED
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from(local).length > 0 && (<>
            <button
              onClick={() => exportSavedSetsICS(Array.from(local))}
              aria-label="Export to calendar"
              title="Export to calendar"
              style={{
                width: 36, height: 36, borderRadius: 36,
                background: "var(--paper-2)", border: "1px solid var(--line-2)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                <path d="M8 14h2v2H8z" fill="var(--ink)" stroke="none"/>
              </svg>
            </button>
            <button
              onClick={() => {
                const text = _nightShareText(Array.from(local));
                if (navigator.share) { navigator.share({ title: `My ${FESTIVAL_CONFIG.shortName || "festival"} lineup`, text }).catch(() => {}); }
                else { try { navigator.clipboard.writeText(text); } catch {} }
              }}
              aria-label="Share lineup"
              title="Share lineup"
              style={{
                width: 36, height: 36, borderRadius: 36,
                background: "var(--paper-2)", border: "1px solid var(--line-2)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/>
              </svg>
            </button>
          </>)}
          <button onClick={autoFill} title="Auto-fill best non-clashing sets for this day" style={{
            background: "var(--horizon)", color: "#fff", border: "none",
            borderRadius: 999, padding: "8px 13px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          }}>✦ AUTO</button>
          <button onClick={handleSave} style={{
            background: "var(--ember)", color: "#fff", border: "none",
            borderRadius: 999, padding: "8px 16px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          }}>SAVE ✓</button>
        </div>
      </div>

      {/* Day tabs */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 10px", borderBottom: "1px solid var(--line)" }}>
        {dayStats.map(d => {
          const on = d.n === activeDay;
          return (
            <button key={d.n} onClick={() => setActiveDay(d.n)} style={{
              flex: 1, padding: "8px 6px", borderRadius: 12, cursor: "pointer", textAlign: "center",
              background: on ? "var(--ink)" : "var(--paper-2)",
              border: on ? "none" : "1px solid var(--line)",
              transition: "all .15s",
            }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: on ? "rgba(247,237,224,0.55)" : "var(--muted)" }}>{d.short}</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: on ? "var(--paper)" : "var(--ink)", lineHeight: 1.15 }}>{d.count}</div>
              {d.clashes > 0
                ? <div className="mono" style={{ fontSize: 8, color: "var(--ember-ink)", letterSpacing: 0.8, marginTop: 1 }}>⚠ {d.clashes} CLASH</div>
                : d.count > 0
                  ? <div className="mono" style={{ fontSize: 8, color: on ? "rgba(247,237,224,0.4)" : "var(--muted)", letterSpacing: 0.8, marginTop: 1 }}>● CLEAN</div>
                  : <div style={{ height: 12 }} />
              }
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 16px 40px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 28, opacity: 0.25, marginBottom: 6 }}>★</div>
            <div className="serif" style={{ fontSize: 24, fontStyle: "italic", color: "var(--muted)" }}>Nothing saved</div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.3, color: "var(--muted)", marginTop: 8 }}>
              SAVE SETS IN LINEUP FIRST
            </div>
          </div>
        ) : (
          <>
            {items.map((item, idx) => {
              if (item.type === "set") {
                const a = item.artist;
                const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
                const clash = conflictIds.has(a.id);
                return (
                  <div key={a.id} style={{ display: "flex", gap: 10, marginBottom: 7, alignItems: "flex-start" }}>
                    {/* Time */}
                    <div className="mono" style={{ width: 36, flexShrink: 0, fontSize: 9, letterSpacing: 0.5, color: "var(--muted)", textAlign: "right", paddingTop: 11 }}>
                      {fmt12(a.start)}
                    </div>
                    {/* Block */}
                    <div style={{
                      flex: 1,
                      background: clash ? "var(--ink)" : "var(--paper-2)",
                      border: `1px solid ${clash ? "var(--ember)" : "var(--line)"}`,
                      borderLeft: `4px solid ${stage.color}`,
                      borderRadius: 12, padding: "9px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: clash ? "var(--paper)" : "var(--ink)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.name}
                          </div>
                          <div className="mono" style={{ fontSize: 9, letterSpacing: 0.9, color: clash ? "rgba(247,237,224,0.5)" : "var(--muted)", marginTop: 3 }}>
                            {stage.short} · {fmt12(a.start)}–{fmt12(a.end)}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {clash && <span className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "var(--ember-ink)", fontWeight: 700 }}>⚠ CLASH</span>}
                          <button onClick={() => drop(a.id)} style={{
                            background: "rgba(232,93,46,0.12)", border: "1px solid rgba(232,93,46,0.25)",
                            borderRadius: 999, padding: "3px 9px", cursor: "pointer",
                            fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 1, color: "var(--ember-ink)",
                          }}>DROP</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (item.type === "gap") {
                return (
                  <div key={`gap-${idx}`} style={{ display: "flex", gap: 10, marginBottom: 7, alignItems: "flex-start" }}>
                    <div style={{ width: 36, flexShrink: 0, paddingTop: 7 }}>
                      <div className="mono" style={{ fontSize: 8, color: "var(--muted)", textAlign: "right", letterSpacing: 0.5 }}>{item.endOf}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                        <span className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", whiteSpace: "nowrap" }}>
                          FREE · {fmtGap(item.gapMin)}
                        </span>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                      </div>
                      {item.fits.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 4 }}>
                          {item.fits.map(f => {
                            const fs = (STAGES.find(s => s.id === f.stage) || UNPLACED_STAGE);
                            return (
                              <button key={f.id} onClick={() => add(f.id)} style={{
                                background: `${fs.color}12`, border: `1px dashed ${fs.color}`,
                                borderRadius: 999, padding: "4px 10px", cursor: "pointer",
                                fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 0.8,
                                color: "var(--ink)",
                              }}>
                                + {f.name} {fmt12(f.start)} {fs.short}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {/* Sunrise */}
            {sunrise && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                <div className="mono" style={{ width: 36, flexShrink: 0, fontSize: 9, color: "var(--flare)", textAlign: "right", letterSpacing: 0.5 }}>{sunrise}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, var(--flare), transparent)` }} />
                  <span className="mono" style={{ fontSize: 8, letterSpacing: 1.4, color: "var(--flare)", fontWeight: 700 }}>☀ SUNRISE</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Bottom-sheet filter modal — replaces the in-page expanding filter
// drawer + active-filter chip strip with a single sectioned sheet.
// Stages its own copy of the filter state so users can experiment;
// commits via onApply or wipes via onReset. Live count on the
// primary CTA so users see how many sets they'll land on before
// they tap Apply.
function LineupFilterSheet({
  onClose, day, dayGenres, savedIds = [], weekendFilter = "all",
  initial,           // { filter, tierFilter, stageFilter, genreFilter, sortBy }
  onApply, onReset,
}) {
  const [f, setF] = React.useState(initial);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const savedCount = savedIds.length;
  const savedSet = React.useMemo(() => new Set(savedIds), [savedIds]);

  // Live preview count — apply the staged filters against ARTISTS for the
  // current day. Mirrors LineupScreen's dayArtists filter chain.
  const matchCount = React.useMemo(() => {
    return lineupFor(weekendFilter)
      .filter(a => a.day === day)
      .filter(a => f.filter === "all" || savedSet.has(a.id))
      .filter(a => f.stageFilter === "all" || a.stage === f.stageFilter)
      .filter(a => f.genreFilter === "all" || a.genre === f.genreFilter)
      .filter(a => {
        if (f.tierFilter === "all") return true;
        if (f.tierFilter === "head") return a.tier === 3;
        if (f.tierFilter === "prime") return a.tier === 2;
        if (f.tierFilter === "open") return a.tier === 1;
        if (f.tierFilter === "legend") return isLegendary(a);
        return true;
      }).length;
  }, [f, day, savedSet, weekendFilter]);

  const chip = (on, accent, delay) => ({
    flexShrink: 0, padding: "6px 12px", borderRadius: 999,
    background: on ? (accent || "var(--ink)") : "var(--paper-2)",
    color: on ? "#fff" : "var(--ink)",
    border: on ? "none" : "1px solid var(--line-2)",
    fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.1,
    fontWeight: on ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap",
    animation: delay != null ? `springIn 0.3s ease-out ${delay}ms both` : undefined,
  });
  const sectionLabel = {
    fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700,
    fontFamily: "Geist Mono, monospace", marginBottom: 6, marginTop: 4,
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
        padding: "16px 18px 18px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 800 }}>FILTERS</span>
          <button onClick={onClose} aria-label="Close filters" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            fontSize: 18, cursor: "pointer", lineHeight: 1,
          }}>×</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: 2 }}>
          {/* SHOW — all vs only mine */}
          <div style={sectionLabel}>SHOW</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { id: "all",   label: "ALL" },
              { id: "saved", label: `MINE${savedCount ? ` · ${savedCount}` : ""}`, accent: "var(--ember)" },
            ].map((o, i) => (
              <button key={o.id} onClick={() => set("filter", o.id)}
                style={chip(f.filter === o.id, o.accent, i * 25)}>{o.label}</button>
            ))}
          </div>

          {/* TIER */}
          <div style={sectionLabel}>TIER</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { id: "all",    label: "ALL TIERS" },
              { id: "legend", label: "★ LEGENDARY",   accent: "#fbbf24" },
              { id: "head",   label: "HEADLINERS",    accent: "var(--ember)" },
              { id: "prime",  label: "PRIME TIME",    accent: "var(--horizon)" },
              { id: "open",   label: "OPENERS",       accent: "var(--success)" },
            ].map((t, i) => (
              <button key={t.id} onClick={() => set("tierFilter", t.id)}
                style={chip(f.tierFilter === t.id, t.accent, 50 + i * 25)}>{t.label}</button>
            ))}
          </div>

          {/* STAGE */}
          <div style={sectionLabel}>STAGE</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => set("stageFilter", "all")}
              style={chip(f.stageFilter === "all", undefined, 175)}>ALL STAGES</button>
            {STAGES.map((s, i) => (
              <button key={s.id} onClick={() => set("stageFilter", s.id)}
                style={chip(f.stageFilter === s.id, s.color, 200 + i * 25)}>{s.short || s.name}</button>
            ))}
          </div>

          {/* GENRE — only if there's enough variety on the day */}
          {dayGenres.length > 0 && (
            <>
              <div style={sectionLabel}>GENRE</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                <button onClick={() => set("genreFilter", "all")}
                  style={chip(f.genreFilter === "all", undefined, 425)}>ALL GENRES</button>
                {dayGenres.map((g, i) => (
                  <button key={g} onClick={() => set("genreFilter", g)}
                    style={chip(f.genreFilter === g, "var(--horizon)", 450 + i * 25)}>{g.toUpperCase()}</button>
                ))}
              </div>
            </>
          )}

          {/* SORT */}
          <div style={sectionLabel}>SORT BY</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { id: "time",  label: "TIME" },
              { id: "tier",  label: "TIER" },
              { id: "stage", label: "STAGE" },
            ].map((o, i) => (
              <button key={o.id} onClick={() => set("sortBy", o.id)}
                style={chip(f.sortBy === o.id, undefined, 600 + i * 25)}>{o.label}</button>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div style={{
          display: "flex", gap: 8, paddingTop: 12,
          borderTop: "1px solid var(--line)",
          marginTop: 6,
        }}>
          <button onClick={() => onReset()} className="mono" style={{
            padding: "11px 16px", borderRadius: 999,
            background: "transparent", color: "var(--muted)",
            border: "1px solid var(--line-2)", cursor: "pointer",
            fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          }}>RESET</button>
          <button onClick={() => onApply(f)} className="mono" style={{
            flex: 1, padding: "11px 14px", borderRadius: 999,
            background: "var(--ember)", color: "#fff",
            border: "none", cursor: "pointer",
            fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
          }}>APPLY · {matchCount} {matchCount === 1 ? "SET" : "SETS"}</button>
        </div>
      </div>
    </div>
  );
}

function LineupScreen({ state, setState }) {
  // Highlight-on-arrival: ArtistScreen "SCHEDULE" hands off `lineupHighlight`.
  // Force the day to that artist's day so the flash actually has a target,
  // even if state.lineupDay was set to something else by an earlier route.
  const highlightId = state.lineupHighlight || null;
  const [day, setDay] = React.useState(() => {
    if (highlightId) {
      const a = ARTISTS.find(x => x.id === highlightId);
      if (a) return a.day;
    }
    return state.lineupDay || NOW.day;
  });
  const [filter, setFilter] = React.useState("all"); // all | saved
  const [stageFilter, setStageFilter] = React.useState("all"); // all | stage id
  const [tierFilter, setTierFilter] = React.useState("all"); // all | head | prime | open | legend
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [genreFilter, setGenreFilter] = React.useState("all");
  const hasWeekends = ARTISTS.some(a => a.weekend && a.weekend !== "both");
  // Two-weekend festivals: pick a weekend (no "Both" — it stacked W1/W2 acts in
  // the same slot and read as clutter). Single-weekend festivals stay "all" so
  // their (untagged) sets aren't filtered out, and the selector below is hidden
  // anyway via hasWeekends.
  //
  // The DEFAULT comes from the same resolver the clock and now-playing use
  // (dayDateFor / _weekendShiftMs in data.jsx), not a hardcoded "W1". Once the
  // rest of the app learned which weekend the user is actually on, leaving this
  // pinned to W1 would have opened a fresh seam in place of the old one: on
  // Saturday of Weekend 2, "now playing" would name a W2 act while this list
  // still opened on Weekend 1. The user can still switch freely — this only
  // decides which one is showing when the screen opens.
  const [weekendFilter, setWeekendFilter] = React.useState(
    () => hasWeekends ? (_weekendShiftMs(FESTIVAL_CONFIG) ? "W2" : "W1") : "all"); // W1 | W2 (| "all" only when no weekends)
  const [q, setQ] = React.useState(""); // artist/stage/genre search

  // After the screen renders, scroll the highlighted card/block into view and
  // let the CSS flash play. Then clear the highlight so re-mounts don't fire
  // the animation again. Querying the DOM (vs. holding a ref through both
  // list + grid views) keeps this independent of which view is active.
  React.useEffect(() => {
    if (!highlightId) return;
    const scroller = setTimeout(() => {
      const el = document.querySelector('[data-lineup-highlight="true"]');
      if (el) try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
    }, 100);
    const clearer = setTimeout(() => {
      setState(s => ({ ...s, lineupHighlight: null }));
    }, 2400);
    return () => { clearTimeout(scroller); clearTimeout(clearer); };
  }, [highlightId]);
  // Filter panel collapses by default — three chip rows (tier/stage/genre)
  // were dominating the top of the screen even when the user wasn't using
  // them. Active filters surface as dismissable chips so a user can clear
  // them without re-opening the panel.
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState(() => {
    try { return localStorage.getItem('plursky_lineup_view') || 'list'; } catch { return 'list'; }
  });
  React.useEffect(() => { try { localStorage.setItem('plursky_lineup_view', viewMode); } catch {} }, [viewMode]);

  // ── Collapsing header ────────────────────────────────────────────────────
  // The title block + dates + day cards + weekend toggle + toolbar + search
  // stacked ~250-300px above the set list and none of it yielded on scroll.
  // Scrolling down folds the title away; the day chips and weekend toggle
  // stay — they are the primary navigation and must always be reachable.
  // Scrolling up brings it back. Height + opacity, never display:none, so
  // the list underneath does not jump.
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    // The scrolling element differs by mode: LIST scrolls the page body,
    // GRID scrolls the grid itself (it owns the only scroll region there).
    let el = null, lastY = 0;
    const attach = () => {
      const next = document.querySelector(viewMode === "grid" ? "[data-grid-scroll]" : "[data-lineup-scroll]");
      if (next === el) return;
      if (el) el.removeEventListener("scroll", onScroll);
      el = next;
      lastY = el ? el.scrollTop : 0;
      if (el) el.addEventListener("scroll", onScroll, { passive: true });
    };
    // Read straight through — no rAF. The handler only reads scrollTop and
    // may set one boolean, and coalescing it behind a frame made the collapse
    // silently never fire under a throttled rAF.
    function onScroll() {
      if (!el) return;
      const y = el.scrollTop;
      // Hysteresis: collapse only after a real downward drag past the title's
      // own height, expand on any meaningful upward move. Without the gap the
      // header flickers on the momentum bounce.
      if (y > 56 && y > lastY + 4) setCollapsed(true);
      else if (y < lastY - 8 || y < 24) setCollapsed(false);
      lastY = y;
    }
    attach();
    // The grid mounts a beat after a mode switch, so retry once.
    const t = setTimeout(attach, 120);
    return () => {
      clearTimeout(t);
      if (el) el.removeEventListener("scroll", onScroll);
    };
  }, [viewMode, day]);
  // GRID opens collapsed: the grid IS the content there, and an expanded
  // header left it ~390px of an 812px screen. LIST opens expanded — the title
  // is the first thing you read on a list. Scrolling up restores the header in
  // either mode.
  React.useEffect(() => { setCollapsed(viewMode === "grid"); }, [day, viewMode, weekendFilter]);
  // v138: per-day section refs (kept for potential future use).
  const gridSectionRefs = React.useRef({});

  // v140: force a re-render every 30 s so the NOW indicator line on the
  // grid, the "● LIVE" pills, and the time-cursor on the saved-sets
  // sidebar all advance without needing the user to close-and-reopen
  // the app. NOW is a Proxy that recomputes on each access — the only
  // thing missing was a trigger to recommit React's rendered output.
  const [, _tickT] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const id = setInterval(_tickT, 30000);
    return () => clearInterval(id);
  }, []);

  // (v165: grid now shows one day at a time like list, so the scroll-to-
  // section listener and sessionStorage position restore are no longer needed.)
  // Sort: time (chronological), tier (headliners first), stage (grouped by stage order)
  const [sortBy, setSortBy] = React.useState("time");
  // Active-filter count powers the badge on the FILTERS trigger button — replaces
  // the old in-page dismissable-chip strip. "filter !== all" (Mine vs All) and
  // sortBy counted because they're meaningful state diverging from defaults.
  const activeFilterCount = (tierFilter !== "all" ? 1 : 0)
                          + (stageFilter !== "all" ? 1 : 0)
                          + (genreFilter !== "all" ? 1 : 0)
                          + (filter !== "all" ? 1 : 0)
                          + (sortBy !== "time" ? 1 : 0);
  React.useEffect(() => setGenreFilter("all"), [day]);
  // Which of the three content chips are narrowing the list right now, and
  // — when exactly one is — what to call it in an empty state. `filter`
  // (ALL/MINE) is deliberately NOT in here: "you have not saved anything" is
  // a different sentence and the branch below already says it.
  const _chipFilterActive = tierFilter !== "all" || stageFilter !== "all" || genreFilter !== "all";
  const _emptyChipLabel = (() => {
    const named = [
      stageFilter !== "all" ? (STAGES.find(s => s.id === stageFilter) || {}).name : null,
      genreFilter !== "all" ? genreFilter : null,
    ].filter(Boolean);
    return (named.length === 1 && tierFilter === "all") ? named[0] : null;
  })();


  const matchesActive = (a) => {
    if (weekendFilter !== "all" && a.weekend !== weekendFilter && a.weekend !== "both") return false;
    if (filter !== "all" && !state.saved.includes(a.id)) return false;
    if (stageFilter !== "all" && a.stage !== stageFilter) return false;
    if (genreFilter !== "all" && a.genre !== genreFilter) return false;
    if (tierFilter === "head"   && a.tier !== 3) return false;
    if (tierFilter === "prime"  && a.tier !== 2) return false;
    if (tierFilter === "open"   && a.tier !== 1) return false;
    if (tierFilter === "legend" && !isLegendary(a)) return false;
    return true;
  };

  const spotifyMatchedIds = React.useMemo(() => {
    try { return new Set(JSON.parse(localStorage.getItem('spotify_matched_ids_v1') || '[]')); }
    catch { return new Set(); }
  }, []);

  const dayGenres = React.useMemo(() => {
    const freq = {};
    lineupFor(weekendFilter).filter(a => a.day === day).forEach(a => {
      if (a.genre) freq[a.genre] = (freq[a.genre] || 0) + 1;
    });
    return Object.entries(freq)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);
  }, [day, weekendFilter]);

  // Memoized so the 6-filter chain + sort only recomputes when an input
  // actually changes — was rebuilding over all 400+ artists on every render
  // (perf jank on older phones, report-card #8). Search (#3) folds in here.
  const savedSetIds = React.useMemo(() => new Set(state.saved), [state.saved]);
  const dayArtists = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return lineupFor(weekendFilter)
      .filter(a => a.day === day)
      .filter(a => weekendFilter === "all" || a.weekend === weekendFilter || a.weekend === "both")
      .filter(a => filter === "all" || savedSetIds.has(a.id))
      .filter(a => stageFilter === "all" || a.stage === stageFilter)
      .filter(a => genreFilter === "all" || a.genre === genreFilter)
      .filter(a => {
        if (tierFilter === "all") return true;
        if (tierFilter === "head") return a.tier === 3;
        if (tierFilter === "prime") return a.tier === 2;
        if (tierFilter === "open") return a.tier === 1;
        if (tierFilter === "legend") return isLegendary(a);
        return true;
      })
      .filter(a => {
        if (!term) return true;
        const st = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
        return a.name.toLowerCase().includes(term)
          || (a.genre || "").toLowerCase().includes(term)
          || (st?.name || "").toLowerCase().includes(term);
      })
      .sort((a, b) => {
        // Ties broken by toNightMin, NOT by an hour-only slot. This used to
        // be a local `toSlot` that returned just the HOUR, so every set
        // starting in the same hour compared equal and the "time" sort fell
        // back to array order — which is stage-grouped. On EDC, where the
        // module was written and sets start on the hour or half hour, that
        // was invisible. On any festival with off-the-hour starts it is not:
        // Portola's 2:40 / 2:45 / 2:50 block listed as 2:40, 2:45, 2:50,
        // 2:45, and Lollapalooza, Summerfest and Outside Lands are all
        // shipping the same misorder today. toNightMin is right there in
        // this file, keeps the same early-AM rollover, and counts minutes.
        // Found 2026-09-06 rendering the Portola lineup.
        if (sortBy === "tier") {
          if (a.tier !== b.tier) return b.tier - a.tier;
        } else if (sortBy === "stage") {
          const ai = STAGES.findIndex(s => s.id === a.stage);
          const bi = STAGES.findIndex(s => s.id === b.stage);
          if (ai !== bi) return ai - bi;
        }
        return toNightMin(a.start) - toNightMin(b.start);
      });
  }, [day, weekendFilter, filter, stageFilter, genreFilter, tierFilter, sortBy, q, savedSetIds]);

  // When a search empties the current day, the overwhelmingly common reason is
  // that the artist plays a DIFFERENT day — so say so rather than leaving the
  // user to tap all three chips to find out. Same name/genre/stage test as the
  // filter above, day deliberately ignored.
  const _otherDayHits = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return 0;
    return lineupFor(weekendFilter).filter(a => {
      if (a.day === day) return false;
      const st = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
      return a.name.toLowerCase().includes(term)
        || (a.genre || "").toLowerCase().includes(term)
        || (st?.name || "").toLowerCase().includes(term);
    }).length;
  }, [q, day, weekendFilter]);

  // Per-day saved counts + conflict counts — memoized on saved and on the
  // weekend being shown (was an O(n²)-per-day overlap loop on every render,
  // report-card #8; without weekendFilter the chips kept the first weekend's
  // counts after the toggle flipped, round 5).
  const dayStats = React.useMemo(() => DAYS.map(d => {
    const savedThisDay = lineupFor(weekendFilter).filter(x => x.day === d.n && savedSetIds.has(x.id));
    let clashes = 0;
    for (let i = 0; i < savedThisDay.length; i++)
      for (let j = i + 1; j < savedThisDay.length; j++)
        if (overlaps(savedThisDay[i], savedThisDay[j])) clashes++;
    return { ...d, count: savedThisDay.length, clashes };
  }), [savedSetIds, weekendFilter]);
  const totalSaved = React.useMemo(() => dayStats.reduce((s, d) => s + d.count, 0), [dayStats]);

  // conflicts: 2+ saved sets overlap in time
  const savedToday = React.useMemo(
    () => lineupFor(weekendFilter).filter(a => a.day === day && savedSetIds.has(a.id)),
    [day, savedSetIds, weekendFilter]
  );
  // v141: pairs the user has explicitly "kept both" on — we still show them
  // as conflicts in the per-card ⚠ chip (information stays available) but
  // skip them in the top-level ConflictResolver card so it stops nagging.
  const [syncOpen, setSyncOpen] = React.useState(false);
  const hasFeed = FESTIVALS_REGISTRY.some(e => e.available && e.config.id === FESTIVAL_CONFIG.id);
  const CONFLICT_ACK_KEY = "plursky_conflicts_kept_both_v1";
  const _pairKey = (idA, idB) => [idA, idB].sort().join("|");
  const [ackedPairs, setAckedPairs] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(CONFLICT_ACK_KEY) || "[]")); }
    catch { return new Set(); }
  });
  const ackPair = (idA, idB) => {
    setAckedPairs(prev => {
      const next = new Set(prev);
      next.add(_pairKey(idA, idB));
      try { localStorage.setItem(CONFLICT_ACK_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  // conflictById: artist.id → array of saved set names this artist clashes with.
  // Powers the per-card ⚠ chip so users can spot WHICH saved sets clash, not
  // just the day-tab total. Memoized — was an O(n²) overlap loop on every
  // render (report-card #8); now only recomputes when saved/day/acks change.
  const { conflicts, conflictById } = React.useMemo(() => {
    const _conflicts = [];
    const _byId = {};
    for (let i = 0; i < savedToday.length; i++) {
      for (let j = i + 1; j < savedToday.length; j++) {
        if (overlaps(savedToday[i], savedToday[j])) {
          const a = savedToday[i], b = savedToday[j];
          if (!ackedPairs.has(_pairKey(a.id, b.id))) {
            _conflicts.push([a, b]);
          }
          // Per-card chip stays even after KEEP BOTH so the warning info
          // doesn't disappear — the only thing that hides is the resolver card.
          (_byId[a.id] = _byId[a.id] || []).push(b.name);
          (_byId[b.id] = _byId[b.id] || []).push(a.name);
        }
      }
    }
    return { conflicts: _conflicts, conflictById: _byId };
  }, [savedToday, ackedPairs]);

  // ── The utility stack (#116) ─────────────────────────────────────────────
  // Search, actions, conflict and stage-vibe cards, and Save-the-Day. LIST
  // renders them above the list as before. GRID hands them to TimelineGrid as
  // its `lead`, inside the grid's ONE scroller, so they scroll away with the
  // timetable and come back at the top — no separate show/hide state that
  // can disagree with the scroll position, and no second vertical scroller.
  // Same condition the grid itself renders under.
  const gridLead = viewMode === "grid" && !(filter === "saved" && state.saved.length === 0);
  // The floating global Search pill hides in GRID (app.jsx): the grid's own
  // search is one short upward scroll away, and the pill sat on set cards.
  React.useEffect(() => {
    const g = viewMode === "grid";
    setState(s => (!!s.lineupGrid === g ? s : { ...s, lineupGrid: g }));
  }, [viewMode]);

  const searchRow = (
    <div style={{ padding: gridLead ? "10px 12px 0" : "8px 16px 4px" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span aria-hidden="true" style={{
          position: "absolute", left: 12, fontSize: 13, color: "var(--muted)",
          pointerEvents: "none",
        }}>⌕</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search artists, stages, genres…"
          aria-label="Search the lineup"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "9px 34px 9px 32px", borderRadius: 12,
            border: "1px solid var(--line-2)", background: "var(--paper-2)",
            color: "var(--ink)", fontSize: 14, outline: "none",
            fontFamily: "inherit",
          }}
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear search"
            style={{
              position: "absolute", right: 6, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 999, border: "none", background: "transparent",
              color: "var(--muted)", fontSize: 16, cursor: "pointer",
            }}
          >×</button>
        )}
      </div>
    </div>
  );

  // MY NIGHT / SHARE / SURPRISE / SETS COUNT. In GRID the count leads on the
  // left so the row reads as one zone with the search above it.
  const actionsRow = (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: gridLead ? "space-between" : "flex-end",
      padding: gridLead ? "8px 12px 10px" : "10px 20px", gap: 8,
    }}>
      {gridLead && (
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>{dayArtists.length} SETS</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {totalSaved >= 2 && (
          <button onClick={() => setWizardOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: dayStats.some(d => d.clashes > 0) ? "var(--ember)" : "var(--ink)",
            color: "var(--paper)", border: "none",
            borderRadius: 999, padding: "5px 12px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>
            {dayStats.some(d => d.clashes > 0) ? "⚠" : "✦"} MY NIGHT
          </button>
        )}
        {state.saved.length > 0 && (
          <ShareLineupButton state={state} />
        )}
        <button onClick={() => {
          const savedArtists = ARTISTS.filter(a => state.saved.includes(a.id));
          const savedGenres = new Set(savedArtists.map(a => a.genre));
          const unsaved = ARTISTS.filter(a => !state.saved.includes(a.id));
          const pool = savedGenres.size
            ? unsaved.filter(a => savedGenres.has(a.genre))
            : unsaved;
          if (!(pool.length ? pool : unsaved).length) return;
          const pick = (pool.length ? pool : unsaved)[Math.floor(Math.random() * (pool.length || unsaved.length))];
          setState({ ...state, artist: pick.id });
        }} className="mono" title="Discover a random artist that matches your taste" style={{
          padding: "5px 10px", borderRadius: 999,
          background: "var(--horizon)", color: "#fff", border: "none",
          fontSize: 9, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
          whiteSpace: "nowrap",
        }}>✦ SURPRISE</button>
        {!gridLead && (
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
            {dayArtists.length} SETS
          </div>
        )}
      </div>
    </div>
  );

  const conflictCard = conflicts.length > 0 && filter !== "all" ? (
    <ConflictResolver
      conflicts={conflicts}
      onKeep={(keepId, dropId) => {
        setState({ ...state, saved: state.saved.filter(id => id !== dropId) });
      }}
      onKeepBoth={(pair) => ackPair(pair[0].id, pair[1].id)}
      onSplit={(pair) => setState({ ...state, tab: "map", focusStage: pair[0].stage })}
    />
  ) : null;

  const vibeCard = stageFilter !== "all" ? (() => {
    const stage = STAGES.find(s => s.id === stageFilter);
    if (!stage?.vibe) return null;
    return (
      <div style={{
        margin: gridLead ? "0 12px 10px" : "0 16px 10px",
        padding: "10px 12px",
        borderRadius: 12,
        borderLeft: `3px solid ${stage.color}`,
        background: `${stage.color}12`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: stage.vibeNote ? 5 : 0 }}>
          <span className="mono" style={{
            fontSize: 9, letterSpacing: 1.2, fontWeight: 800,
            color: stage.color, textTransform: "uppercase",
          }}>{stage.vibe}</span>
          {stage.peak && (
            <span className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
              · PEAKS {stage.peak}
            </span>
          )}
          {stage.desc && (
            <span className="mono" style={{ fontSize: 8, letterSpacing: 0.9, color: "var(--muted)", marginLeft: "auto" }}>
              {stage.desc.toUpperCase()}
            </span>
          )}
        </div>
        {stage.vibeNote && (
          <div style={{ fontSize: 12, lineHeight: 1.4, color: "var(--ink)", fontStyle: "italic" }}>
            {stage.vibeNote}
          </div>
        )}
      </div>
    );
  })() : null;

  // "Save the Day" — when nothing is saved for the selected day, one tap
  // saves every tier-3 top pick. Disappears once the day has any save. In
  // GRID it is an optional assist above the timetable, not the screen's
  // hero: one slim outlined row that scrolls away with the rest.
  const saveDayCard = savedToday.length === 0 ? (() => {
    const dayTopPicks = lineupFor(weekendFilter).filter(a => a.day === day && a.tier === 3);
    if (dayTopPicks.length === 0) return null;
    const dayLabel = DAYS.find(d => d.n === day)?.label || `Day ${day}`;
    const topPickIds = dayTopPicks.map(a => a.id);
    const save = () => setState(s => ({ ...s, saved: [...new Set([...s.saved, ...topPickIds])] }));
    if (gridLead) return (
      <button data-save-day onClick={save} style={{
        width: "calc(100% - 24px)", margin: "0 12px 10px",
        display: "flex", alignItems: "center", gap: 10, minHeight: 44,
        background: "transparent", color: "var(--ember-ink)", border: "1px solid var(--ember)",
        borderRadius: 12, padding: "8px 12px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}>
        <span aria-hidden="true" style={{ fontSize: 14, flexShrink: 0 }}>✦</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Save all top picks for {dayLabel}</span>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 800, flexShrink: 0 }}>+{dayTopPicks.length} · SAVE</span>
      </button>
    );
    return (
      <button
        onClick={save}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--ember)", color: "#fff", border: "none",
          borderRadius: 14, padding: "13px 16px",
          margin: "12px 0 14px",
          cursor: "pointer", textAlign: "left",
          boxShadow: "0 4px 16px rgba(232,93,46,0.30)",
          fontFamily: "inherit",
        }}>
        <span style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 999,
          background: "rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, lineHeight: 1,
        }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="serif" style={{ fontSize: 18, lineHeight: 1.05, color: "#fff" }}>
            Save all top picks for {dayLabel}
          </div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, marginTop: 3, opacity: 0.9, fontWeight: 700 }}>
            +{dayTopPicks.length} SETS · TAP TO ADD
          </div>
        </div>
        <span className="mono" style={{ fontSize: 10, letterSpacing: 1.3, fontWeight: 800, flexShrink: 0 }}>
          SAVE →
        </span>
      </button>
    );
  })() : null;

  return (
    <Screen bg="var(--paper)">
      {/* Title + dates. Folds on scroll down, returns on scroll up. Height
          and opacity, never display:none, so the list below never jumps.
          minHeight:0 because a column flex item's default min-height:auto
          would floor this at its content height. */}
      <div data-lineup-header data-collapsed={collapsed ? "1" : "0"} style={{
        padding: collapsed ? "0 20px" : "8px 20px 8px",
        display: "flex", alignItems: "center", gap: 8,
        maxHeight: collapsed ? 0 : 90, minHeight: 0,
        opacity: collapsed ? 0 : 1,
        overflow: "hidden", flexShrink: 0,
        transform: collapsed ? "translateY(-6px)" : "translateY(0)",
        transition: "max-height 220ms ease, opacity 160ms ease, padding 220ms ease, transform 220ms ease",
        pointerEvents: collapsed ? "none" : "auto",
      }}>
        {state._navStack?.length > 0 && (
          <button onClick={() => window._popNav?.()} aria-label="Go back" style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--paper-2)", border: "1px solid var(--line)",
            color: "var(--ink)", cursor: "pointer", fontSize: 16, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <TopBar title={<span>Lineup</span>} sub={`${FESTIVAL_CONFIG.brand.toUpperCase()} · ${FESTIVAL_CONFIG.dates.toUpperCase()}`} tight />
        </div>
        {hasFeed && (
          <button data-sched-check onClick={() => setSyncOpen(true)} aria-label="Check for schedule changes" style={{
            minHeight: 32, padding: "0 11px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
            background: "transparent", border: "1px solid var(--line-2)", color: "var(--ink)",
            fontFamily: "'Geist Mono', monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>↻ UPDATES</button>
        )}
      </div>

      {/* Day tabs — now with per-day saved + conflict badges baked in so a
          vet can see at a glance which night needs schedule attention. */}
      <div style={{
        display: "flex", gap: 6, flexShrink: 0,
        padding: collapsed ? "4px 16px 5px" : "4px 16px 10px",
        borderBottom: "1px solid var(--line)",
        transition: "padding 220ms ease",
      }}>
        {dayStats.map(d => {
          const on = d.n === day;
          return (
            <button key={d.n} onClick={() => {
              setDay(d.n);
              setState(s => ({ ...s, lineupDay: d.n }));
            }} style={{
              flex: 1,
              padding: collapsed ? "4px 8px" : "10px 8px",
              borderRadius: 12,
              transition: "padding 220ms ease",
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--paper)" : "var(--ink)",
              border: on ? "none" : "1px solid var(--line-2)",
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              position: "relative",
            }}>
              {collapsed ? (
                <span className="mono" style={{
                  fontSize: 10, letterSpacing: 1.2, fontWeight: 800,
                  display: "flex", alignItems: "baseline", gap: 5,
                }}>
                  {d.label} {d.date.split(" ")[1]}
                  {d.count > 0 && (
                    <span style={{ fontSize: 8, color: on ? "rgba(247,237,224,0.75)" : "var(--ember)" }}>
                      ★{d.count}{d.clashes > 0 ? `·${d.clashes}⚠` : ""}
                    </span>
                  )}
                </span>
              ) : (
                <>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: 1.6, opacity: on ? 0.7 : 0.5 }}>{d.label}</span>
                  <span className="serif" style={{ fontSize: 18 }}>{d.date.split(" ")[1]}</span>
                  {d.count > 0 && (
                    <span className="mono" style={{
                      fontSize: 8, letterSpacing: 1, fontWeight: 700,
                      color: on ? "rgba(247,237,224,0.7)" : "var(--muted)",
                      marginTop: 1,
                    }}>
                      {d.count} SAVED{d.clashes > 0 ? ` · ${d.clashes}⚠` : ""}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Weekend toggle — only shows for multi-weekend festivals like ACL */}
      {hasWeekends && (
        <div style={{
          display: "flex", gap: 4, padding: "8px 16px 6px",
          borderBottom: "1px solid var(--line)",
        }}>
          {[
            { value: "W1",  label: "WEEKEND 1" },
            { value: "W2",  label: "WEEKEND 2" },
          ].map(w => {
            const on = weekendFilter === w.value;
            return (
              <button key={w.value} onClick={() => setWeekendFilter(w.value)} className="mono" style={{
                flex: 1, padding: "7px 6px", borderRadius: 8,
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--muted)",
                border: on ? "none" : "1px solid var(--line-2)",
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
              }}>{w.label}</button>
            );
          })}
        </div>
      )}

      {/* Compact toolbar: view mode segment + single FILTERS trigger.
          All filter/sort dimensions live inside the bottom sheet now —
          no more in-page expanding drawer + active-chip strip. The
          badge count on the trigger replaces the strip's signaling. */}
      <div className="no-scrollbar" style={{
        display: "flex", alignItems: "center", gap: 6, padding: "10px 16px 8px",
        overflowX: "auto", scrollbarWidth: "none",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{
          flexShrink: 0, display: "inline-flex",
          border: "1px solid var(--line-2)", borderRadius: 999, padding: 2, gap: 2,
        }}>
          {[["list","☰ LIST"],["grid","⊞ GRID"]].map(([k,l]) => {
            const on = viewMode === k;
            return (
              <button key={k} onClick={() => setViewMode(k)} className="mono" style={{
                padding: "3px 9px", borderRadius: 999, border: "none",
                background: on ? "var(--ink)" : "transparent",
                color: on ? "var(--paper)" : "var(--ink)",
                fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap",
              }}>{l}</button>
            );
          })}
          <button onClick={() => setState({ ...state, tab: "map", focusStage: stageFilter !== "all" ? stageFilter : undefined })} className="mono" style={{
            padding: "3px 9px", borderRadius: 999, border: "none",
            background: "transparent", color: "var(--ink)",
            fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
          }}>◎ MAP</button>
        </div>
        <button onClick={() => setFilterSheetOpen(true)} className="mono" style={{
          flexShrink: 0, padding: "5px 11px", borderRadius: 999,
          background: activeFilterCount > 0 ? "var(--ember)" : "transparent",
          color: activeFilterCount > 0 ? "#fff" : "var(--ink)",
          border: activeFilterCount > 0 ? "none" : "1px solid var(--line-2)",
          fontSize: 10, letterSpacing: 1.1, cursor: "pointer",
          fontWeight: 700, whiteSpace: "nowrap",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <span>FILTERS</span>
          {activeFilterCount > 0 && (
            <span style={{
              background: "rgba(255,255,255,0.28)",
              borderRadius: 999, padding: "1px 7px",
              fontSize: 9, fontWeight: 800,
            }}>{activeFilterCount}</span>
          )}
        </button>
        {/* Pre-festival utility: saved sets → .ics into Calendar. The same
            export already lives in the NightWizard header; this surfaces it
            from the main schedule (Partiful/Eventbrite add-to-calendar
            pattern — affordance on the schedule itself). */}
        {state.saved.length > 0 && (
          <button onClick={() => { window.plurskyHaptic?.("LIGHT"); exportSavedSetsICS(state.saved); }} className="mono" style={{
            flexShrink: 0, padding: "5px 11px", borderRadius: 999,
            background: "transparent", color: "var(--ink)",
            border: "1px solid var(--line-2)",
            fontSize: 10, letterSpacing: 1.1, cursor: "pointer",
            fontWeight: 700, whiteSpace: "nowrap",
          }}>📅 CALENDAR</button>
        )}
        {sortBy !== "time" && (
          <span className="mono" style={{
            flexShrink: 0, padding: "5px 9px", borderRadius: 999,
            background: "var(--paper-2)", color: "var(--muted)",
            border: "1px solid var(--line-2)",
            fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
            whiteSpace: "nowrap",
          }}>SORT: {sortBy.toUpperCase()}</span>
        )}
      </div>

      {/* LIST: the utility stack sits here, above the list. GRID: the same
          elements ride INSIDE the grid's one scroller (TimelineGrid `lead`),
          so they scroll away and leave the timetable (#116). */}
      {!gridLead && searchRow}
      {!gridLead && actionsRow}

      {wizardOpen && (
        <NightWizard state={state} setState={setState} onClose={() => setWizardOpen(false)} />
      )}

      {!gridLead && conflictCard}
      {!gridLead && vibeCard}

      {/* In GRID mode this stops being a scroll container: the grid owns the
          only scrolling element on the screen. Two nested scroll regions was
          the whole "tough to navigate" complaint — a drag on iOS would pick
          whichever one it liked. LIST mode is unchanged. */}
      <ScrollBody data-lineup-scroll ref={useStaggerFade(`${day}-${viewMode}-${filter}-${stageFilter}-${tierFilter}-${genreFilter}-${sortBy}-${weekendFilter}`)} style={
        viewMode === "grid"
          ? { overflowY: "hidden", display: "flex", flexDirection: "column", padding: 0 }
          : { padding: "0 16px 90px" }
      }>
        {!gridLead && saveDayCard}
        {gridLead && (() => {
          // v165: grid now shows only the selected day (like list mode) so
          // navigation is clean — no more scrolling through all 3 days.
          const dayMeta = DAYS.find(x => x.n === day);
          // Grid respects the weekend toggle by HIDING the other weekend's
          // sets (not dimming) — otherwise W1/W2 acts sharing a stage+slot
          // (e.g. Skrillex W1 vs Kings of Leon W2 on amex) would stack and
          // collide. "Both" sets always show.
          const dayArt  = lineupFor(weekendFilter)
            .filter(a => a.day === day)
            .filter(a => weekendFilter === "all" || a.weekend === weekendFilter || a.weekend === "both");
          return (
            <div
              ref={el => { gridSectionRefs.current[day] = el; }}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            >
              {/* MY SETS rail removed — it ate ~100px (a third of the width)
                  and duplicated info already shown in-grid (saved sets are
                  highlighted), the day chips, and LIST view. The grid now gets
                  the full width so more stages are visible at once. */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <TimelineGrid
                  lead={<>{searchRow}{actionsRow}{conflictCard}{vibeCard}{saveDayCard}</>}
                  day={day}
                  allDayArtists={dayArt}
                  state={state}
                  setState={setState}
                  matchesActive={matchesActive}
                  conflictById={conflictById}
                  spotifyMatchedIds={spotifyMatchedIds}
                  highlightId={highlightId}
                />
              </div>
            </div>
          );
        })()}
        {/* Zero rows has two completely different causes and they used to share
            one message: a search that matched nothing told you "No sets saved
            yet — TAP ANY [+] TO SAVE YOUR FIRST SET", which answers a question
            nobody asked and hides the fact that the query is what emptied the
            list. Search loses to nothing else here, because when a query is
            active it is always the thing the user is looking at. */}
        {viewMode === "list" && dayArtists.length === 0 && q.trim() !== "" && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 22, color: "var(--muted)", fontStyle: "italic", marginBottom: 6 }}>
              No matches for “{q.trim()}”
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              {_otherDayHits > 0
                ? `${_otherDayHits} MATCH${_otherDayHits === 1 ? "" : "ES"} ON ANOTHER DAY`
                : "NO ARTIST, STAGE OR GENRE BY THAT NAME"}
            </div>
            <button onClick={() => setQ("")} className="mono" style={{
              marginTop: 14, padding: "8px 16px", borderRadius: 999,
              background: "var(--ink)", color: "var(--paper)", border: "none",
              fontSize: 10, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer",
            }}>CLEAR SEARCH</button>
          </div>
        )}
        {/* The SAME defect the search branch above was fixed for, one layer
            out: a TIER/STAGE/GENRE chip that matches nothing fell through to
            the saved-list message and told the user "No sets saved yet — TAP
            ANY [+] TO SAVE YOUR FIRST SET". Saving is not the problem and the
            filter is not mentioned. Reachable on any festival — a stage that
            does not run on the selected day, or a genre with no act that
            day. Named causes beat one generic message — that was the lesson
            the first fix wrote down, and it applies to the chips too. */}
        {viewMode === "list" && dayArtists.length === 0 && q.trim() === "" && _chipFilterActive && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 22, color: "var(--muted)", fontStyle: "italic", marginBottom: 6 }}>
              {_emptyChipLabel
                ? `Nothing on ${_emptyChipLabel} yet`
                : "Nothing matches those filters"}
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              {_emptyChipLabel ? "NOTHING THERE ON THIS DAY" : "TRY CLEARING ONE OF THEM"}
            </div>
            <button onClick={() => { setTierFilter("all"); setStageFilter("all"); setGenreFilter("all"); }} className="mono" style={{
              marginTop: 14, padding: "8px 16px", borderRadius: 999,
              background: "var(--ink)", color: "var(--paper)", border: "none",
              fontSize: 10, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer",
            }}>CLEAR FILTERS</button>
          </div>
        )}
        {viewMode === "list" && dayArtists.length === 0 && q.trim() === "" && !_chipFilterActive && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 22, color: "var(--muted)", fontStyle: "italic", marginBottom: 6 }}>
              {state.saved.length === 0 ? "No sets saved yet" : "Nothing saved for this day"}
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              {state.saved.length === 0
                ? "TAP ANY [+] TO SAVE YOUR FIRST SET"
                : 'SWITCH TO "ALL" TO BROWSE'}
            </div>
            {state.saved.length === 0 && filter !== "all" && (
              <button onClick={() => setFilter("all")} className="mono" style={{
                marginTop: 14, padding: "8px 16px", borderRadius: 999,
                background: "var(--ink)", color: "var(--paper)", border: "none",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer",
              }}>BROWSE ALL SETS</button>
            )}
          </div>
        )}
        {viewMode === "grid" && filter === "saved" && state.saved.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 22, color: "var(--muted)", fontStyle: "italic", marginBottom: 6 }}>
              No sets saved yet
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              SWITCH TO ALL — TAP ANY SET TO SAVE
            </div>
            <button onClick={() => setFilter("all")} className="mono" style={{
              marginTop: 14, padding: "8px 16px", borderRadius: 999,
              background: "var(--ink)", color: "var(--paper)", border: "none",
              fontSize: 10, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer",
            }}>BROWSE ALL SETS</button>
          </div>
        )}
        {viewMode === "list" && dayArtists.map(a => {
          const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
          const saved = state.saved.includes(a.id);
          const clashWith = conflictById[a.id];
          const isHighlighted = highlightId === a.id;
          // FotMob-style LIVE pill — green pulsing dot + LIVE caps when
          // the set is currently playing (real date AND time, see isSetLive).
          const isLive = isSetLive(a);
          return (
            <div key={a.id}
              data-animate
              data-lineup-highlight={isHighlighted ? "true" : undefined}
              style={{
                display: "flex", gap: 10, padding: "12px 8px",
                margin: "0 -8px",
                borderBottom: "1px solid var(--line)",
                alignItems: "center",
                borderRadius: isHighlighted ? 10 : 0,
                animation: isHighlighted ? "lineupFlash 1.8s ease-out" : undefined,
              }}>
              <div style={{ width: 46, flexShrink: 0 }}>
                <div className="mono" style={{ fontSize: 13, letterSpacing: 0.5, fontWeight: 500 }}>{fmt12(a.start)}</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)" }}>{fmt12(a.end)}</div>
                {isLive && (
                  <div className="mono" style={{
                    marginTop: 4, fontSize: 8, letterSpacing: 1, fontWeight: 800,
                    color: "var(--success)", background: "rgba(45,122,85,0.14)",
                    border: "0.5px solid rgba(45,122,85,0.55)",
                    padding: "1px 5px", borderRadius: 4,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: 5,
                      background: "var(--success)",
                      animation: "pulse 1.4s infinite",
                    }}/>LIVE
                  </div>
                )}
                {clashWith && (
                  <div className="mono" title={`Overlaps with ${clashWith.join(", ")}`} style={{
                    marginTop: 4, fontSize: 8, letterSpacing: 0.8, fontWeight: 800,
                    color: "var(--ember-ink)", background: "rgba(232,93,46,0.12)",
                    border: "0.5px solid rgba(232,93,46,0.55)",
                    padding: "1px 4px", borderRadius: 4,
                    display: "inline-block",
                  }}>⚠ CLASH</div>
                )}
              </div>
              <div style={{ width: 4, alignSelf: "stretch", background: stage.color, borderRadius: 3 }} />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                   onClick={() => setState({ ...state, artist: a.id })}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                  <div className="serif" style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: -0.3 }}>{a.name}</div>
                  <TierStars tier={a.tier} />
                  {isLegendary(a) && (
                    <span className="mono" style={{
                      fontSize: 8, letterSpacing: 1.2, fontWeight: 800,
                      color: "#fbbf24", background: "rgba(251,191,36,0.14)",
                      padding: "1px 6px", borderRadius: 999,
                      border: "0.5px solid rgba(251,191,36,0.6)",
                    }}>★ DON'T MISS</span>
                  )}
                  {spotifyMatchedIds.has(a.id) && (
                    <span className="mono" style={{
                      fontSize: 8, letterSpacing: 1.2, fontWeight: 700,
                      color: "#1DB954", background: "rgba(29,185,84,0.12)",
                      padding: "1px 6px", borderRadius: 999,
                      border: "0.5px solid rgba(29,185,84,0.5)",
                    }}>♫</span>
                  )}
                  {(() => { const n = window.sbGetCrewCount?.(a.id) || 0; return n > 0 ? (
                    <span className="mono" style={{
                      fontSize: 8, letterSpacing: 1, fontWeight: 700,
                      color: "var(--horizon)", background: "rgba(123,61,154,0.12)",
                      padding: "1px 6px", borderRadius: 999,
                      border: "0.5px solid rgba(123,61,154,0.5)",
                    }}>👥 {n}</span>
                  ) : null; })()}
                  {hasWeekends && a.weekend && a.weekend !== "both" && (
                    <span className="mono" style={{
                      fontSize: 8, letterSpacing: 1.2, fontWeight: 700,
                      color: a.weekend === "W1" ? "#2563eb" : "#9333ea",
                      background: a.weekend === "W1" ? "rgba(37,99,235,0.1)" : "rgba(147,51,234,0.1)",
                      padding: "1px 6px", borderRadius: 999,
                      border: `0.5px solid ${a.weekend === "W1" ? "rgba(37,99,235,0.4)" : "rgba(147,51,234,0.4)"}`,
                    }}>{a.weekend}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: stage.color, fontWeight: 600, textTransform: "uppercase" }}>
                    {stage.name}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>·</span>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase" }}>
                    {a.genre}
                  </span>
                </div>
                {stage.vibe && (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <span className="mono" style={{
                      fontSize: 8, letterSpacing: 1.1, fontWeight: 700,
                      color: stage.color,
                      padding: "1px 6px", borderRadius: 999,
                      background: `${stage.color}1a`,
                      border: `0.5px solid ${stage.color}55`,
                      textTransform: "uppercase",
                    }}>{stage.vibe}</span>
                    {stage.peak && (
                      <span className="mono" style={{ fontSize: 8, letterSpacing: 0.9, color: "var(--muted)" }}>
                        PEAKS {stage.peak}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => toggleSave(state, setState, a.id)}
                aria-label={saved ? `Unsave ${a.name}` : `Save ${a.name}`} aria-pressed={saved} style={{
                width: 44, height: 44, borderRadius: 44, flexShrink: 0,
                background: saved ? "var(--ember)" : "transparent",
                border: saved ? "none" : "1px solid var(--line-2)",
                color: saved ? "#fff" : "var(--ink)",
                cursor: "pointer",
                fontSize: 18, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{saved ? "✓" : "+"}</button>
            </div>
          );
        })}
      </ScrollBody>

      {viewMode === "grid" && NOW.night === day && NOW.time && (
        <button onClick={() => {
          const el = document.querySelector("[data-grid-scroll]");
          const nowMin = toNightMin(NOW.time);
          if (el && nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN) {
            // The utility stack rides above the timetable in the same scroller.
            const lead = el.querySelector("[data-grid-lead]");
            const top = (lead ? lead.offsetHeight : 0) + (nowMin - GRID_START_MIN) * GRID_PX_PER_MIN - 120;
            el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          }
        }} style={{
          // bottom:80 cleared the floating Search pill, which GRID no longer shows.
          position: "absolute", bottom: 16, right: 16, zIndex: 8,
          background: "var(--ember)", color: "#fff", border: "none",
          borderRadius: 999, padding: "8px 14px",
          boxShadow: "0 4px 16px rgba(232,93,46,0.4)",
          fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.4, fontWeight: 800,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          animation: "springIn 0.3s ease-out",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: "#fff", animation: "pulse 1.6s infinite" }}/>
          NOW
        </button>
      )}

      {filterSheetOpen && (
        <LineupFilterSheet
          day={day}
          dayGenres={dayGenres}
          savedIds={state.saved || []}
          weekendFilter={weekendFilter}
          initial={{ filter, tierFilter, stageFilter, genreFilter, sortBy }}
          onClose={() => setFilterSheetOpen(false)}
          onApply={(f) => {
            setFilter(f.filter);
            setTierFilter(f.tierFilter);
            setStageFilter(f.stageFilter);
            setGenreFilter(f.genreFilter);
            setSortBy(f.sortBy);
            setFilterSheetOpen(false);
          }}
          onReset={() => {
            setFilter("all");
            setTierFilter("all");
            setStageFilter("all");
            setGenreFilter("all");
            setSortBy("time");
            setFilterSheetOpen(false);
          }}
        />
      )}
      {syncOpen && <ScheduleReviewSheet saved={state.saved || []} onClose={() => setSyncOpen(false)} />}
    </Screen>
  );
}

// ── Schedule Sync: check the published schedule, review, confirm ──────────
// Nothing about the lineup, the plan or reminders changes before APPLY
// UPDATE. Rows read against the lineup as it stands now; applying stores the
// overlay (data.jsx applyScheduleReview) and reloads, which is how reminders
// and every other read pick the new schedule up.
function _schedSlotText(slot, cfg) {
  if (!slot) return "";
  const d = cfg.dayDates && cfg.dayDates[slot.day];
  const st = slot.stage && STAGES.find(s => s.id === slot.stage);
  const wk = slot.weekend && slot.weekend !== "both" ? `${slot.weekend} · ` : "";
  return `${wk}${d ? d.short : `DAY ${slot.day}`} · ${slot.start ? fmt12(slot.start) : "time TBA"} · ${st ? st.name : "stage TBA"}`;
}
function _schedObserved(src) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec((src && src.observedAt) || "");
  if (!m) return "";
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2] - 1];
  return m[3] ? `${mon} ${+m[3]}` : `${mon} ${m[1]}`;
}
function ScheduleReviewSheet({ saved, onClose }) {
  const cfg = FESTIVAL_CONFIG, fid = cfg.id;
  const { perm } = useNotifications();
  const [st, setSt] = React.useState({ phase: "checking" });
  const [showAll, setShowAll] = React.useState(false);
  const check = React.useCallback(() => {
    setSt({ phase: "checking" });
    fetchScheduleFeed(fid).then(feed => {
      const r = scheduleReview(fid, feed, { saved, remindersOn: perm === "granted", leadMin: getReminderLeadMin() });
      setSt(r.error ? { phase: "error" } : { phase: r.upToDate ? "current" : "ready", r });
    }, () => setSt({ phase: "error" }));
  }, [fid, perm]);
  React.useEffect(() => { check(); }, [check]);
  const apply = () => {
    const next = applyScheduleReview(st.r, saved);
    try { localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(next)); } catch {}
    window.location.reload();
  };

  const r = st.r;
  const mono = { fontFamily: "'Geist Mono', monospace", letterSpacing: 1.2, fontWeight: 700 };
  const btn = (label, onClick, primary) => (
    <button key={label} onClick={onClick} style={{
      ...mono, fontSize: 10, minHeight: 40, padding: "0 16px", borderRadius: 999, flexShrink: 0, cursor: "pointer",
      border: primary ? "none" : "1px solid var(--line-2)",
      background: primary ? "var(--ink)" : "transparent", color: primary ? "var(--paper)" : "var(--ink)",
    }}>{label}</button>
  );
  const tz = cfg.tz;
  const clock = ms => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) });
  const KIND = { day: "DAY", stage: "STAGE", start: "TIME", end: "END", weekend: "WEEKEND", cancelled: "CANCELLED", added: "NEW" };
  const row = (c, notes = []) => (
    <div key={c.id} data-sched-change={c.id} data-sched-kinds={c.kinds.join(",")} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--ink)", overflowWrap: "anywhere" }}>{c.name}</div>
        <div style={{ ...mono, fontSize: 8, flexShrink: 0, color: c.after ? "var(--muted)" : "var(--ember-ink)" }}>{c.kinds.map(k => KIND[k]).join(" · ")}</div>
      </div>
      {c.before && <div style={{ fontSize: 12, color: "var(--ink)", opacity: 0.5, marginTop: 2, textDecoration: c.after ? "line-through" : "none" }}>{_schedSlotText(c.before, cfg)}</div>}
      {c.after && <div style={{ fontSize: 12, color: "var(--ink)", marginTop: 2 }}>{c.before ? "→ " : ""}{_schedSlotText(c.after, cfg)}</div>}
      {notes.map((n, i) => <div key={i} data-sched-note style={{ fontSize: 11, color: "var(--ember-ink)", marginTop: 3, lineHeight: 1.35 }}>{n}</div>)}
    </div>
  );
  const head = (label, n) => (
    <div style={{ ...mono, fontSize: 9, color: "var(--muted)", marginTop: 16, marginBottom: 2 }}>{label}{n != null ? ` · ${n}` : ""}</div>
  );
  const notesFor = c => {
    const out = [];
    if (!c.after) out.push("Cancelled, so it comes out of your plan.");
    for (const [a, b] of r.clashes) if (a.id === c.id || b.id === c.id) out.push(`Now clashes with ${(a.id === c.id ? b : a).name}.`);
    const rem = r.reminders.find(x => x.id === c.id);
    if (rem) out.push(rem.to == null ? "Its reminder is cancelled." : rem.from == null ? `New reminder at ${clock(rem.to)}.` : `Reminder moves to ${clock(rem.to)}.`);
    return out;
  };
  const src = r && r.source, observed = _schedObserved(src);
  let host = "";
  try { host = src && src.url ? new URL(src.url).hostname.replace(/^www\./, "") : ""; } catch {}
  const basis = src ? [src.official ? "Official schedule" : `Source: ${host || "community"}`, observed && `observed ${observed}`].filter(Boolean).join(" · ") : "";
  const others = r && !r.upToDate ? r.shown.changes.filter(c => !saved.includes(c.id)) : [];
  const counts = r && r.shown.counts;
  const moved = r ? r.shown.changes.filter(c => c.before && c.after).length : 0;

  let title, body, actions;
  if (st.phase === "checking") {
    title = "Checking the published schedule…";
    actions = [btn("CLOSE", onClose)];
  } else if (st.phase === "error") {
    title = "Couldn't reach the schedule";
    body = <div style={{ fontSize: 13, color: "var(--ink)", opacity: 0.7, marginTop: 6, lineHeight: 1.45 }}>Check your connection and try again. Your lineup hasn't changed.</div>;
    actions = [btn("CLOSE", onClose), btn("RETRY", check, true)];
  } else if (st.phase === "current") {
    title = "You have the latest schedule";
    actions = [btn("DONE", onClose, true)];
  } else {
    const n = r.shown.changes.length;
    title = `${n} change${n === 1 ? "" : "s"} to the ${cfg.shortName || cfg.brand} schedule`;
    body = (
      <>
        <div data-sched-counts style={{ fontSize: 12, color: "var(--ink)", opacity: 0.7, marginTop: 4 }}>
          {[moved && `${moved} moved`, counts.cancelled && `${counts.cancelled} cancelled`, counts.added && `${counts.added} added`].filter(Boolean).join(" · ")}
        </div>
        <div data-sched-section="plan">
          {head("YOUR PLAN", r.savedChanges.length)}
          {r.savedChanges.length ? r.savedChanges.map(c => row(c, notesFor(c)))
            : <div style={{ fontSize: 12, color: "var(--ink)", opacity: 0.6, padding: "8px 0", borderTop: "1px solid var(--line)" }}>None of your saved sets change.</div>}
        </div>
        {r.clashes.length > 0 && (
          <div data-sched-section="clashes">
            {head("NEW CLASHES", r.clashes.length)}
            {r.clashes.map(([a, b]) => (
              <div key={a.id + b.id} data-sched-clash={`${a.id}|${b.id}`} style={{ padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>
                <b>{a.name}</b> and <b>{b.name}</b> overlap
                <div style={{ fontSize: 11, opacity: 0.55 }}>
                  {(cfg.dayDates && cfg.dayDates[a.day] ? cfg.dayDates[a.day].short : `DAY ${a.day}`)} · {fmt12(a.start)}–{fmt12(a.end)} and {fmt12(b.start)}–{fmt12(b.end)}
                </div>
              </div>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div data-sched-section="other">
            {head("OTHER CHANGES", others.length)}
            {(showAll ? others : others.slice(0, 6)).map(c => row(c))}
            {!showAll && others.length > 6 && (
              <button onClick={() => setShowAll(true)} style={{ ...mono, fontSize: 9, background: "none", border: "none", color: "var(--ember-ink)", padding: "8px 0", cursor: "pointer" }}>SHOW ALL {others.length}</button>
            )}
          </div>
        )}
      </>
    );
    actions = [btn("NOT NOW", onClose), btn("APPLY UPDATE", apply, true)];
  }

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div role="dialog" aria-modal="true" aria-label="Schedule update" data-sched-phase={st.phase} onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, maxHeight: "86vh", boxSizing: "border-box", display: "flex", flexDirection: "column",
        background: "var(--paper)", borderRadius: "18px 18px 0 0",
      }}>
        <div style={{ overflowY: "auto", padding: "16px 18px 8px" }}>
          <div style={{ ...mono, fontSize: 9, color: "var(--ember-ink)" }}>SCHEDULE UPDATE</div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "var(--ink)", marginTop: 3, lineHeight: 1.15 }}>{title}</div>
          {basis && <div data-sched-basis style={{ fontSize: 11, color: "var(--ink)", opacity: 0.5, marginTop: 4 }}>{basis}</div>}
          {body}
        </div>
        <div style={{ padding: "10px 18px calc(14px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)" }}>
          {st.phase === "ready" && (
            <div style={{ fontSize: 11, color: "var(--ink)", opacity: 0.55, marginBottom: 8, lineHeight: 1.4 }}>
              Nothing changes until you apply. Your saved sets and reminders then follow the new times.
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>{actions}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Treat times before 08:00 as "next day" so 23:00 < 01:30 etc. compares correctly.
function toNightMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h < 8 ? h + 24 : h) * 60 + m;
}
function overlaps(a, b) {
  const aS = toNightMin(a.start), aE = toNightMin(a.end);
  const bS = toNightMin(b.start), bE = toNightMin(b.end);
  return aS < bE && bS < aE;
}

// Calendar-style lane assignment for a single stage column: sets that overlap
// in time get placed in side-by-side sub-lanes instead of stacking on top of
// each other. Returns a map of set id -> { lane, lanes } where `lanes` is the
// width-divisor for that set's overlap cluster. Used to keep "Both Weekends"
// view legible — W1/W2 acts sharing a slot sit next to each other.
function layoutLanes(sets) {
  const items = sets
    .map(a => ({ a, s: toNightMin(a.start), e: toNightMin(a.end) }))
    .sort((x, y) => x.s - y.s || x.e - y.e);
  const result = {};
  let cluster = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds = []; // running end time of the last set placed in each lane
    cluster.forEach(it => {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= it.s) { colEnds[c] = it.e; it.lane = c; placed = true; break; }
      }
      if (!placed) { it.lane = colEnds.length; colEnds.push(it.e); }
    });
    const lanes = colEnds.length;
    cluster.forEach(it => { result[it.a.id] = { lane: it.lane, lanes }; });
    cluster = [];
    clusterEnd = -Infinity;
  };
  items.forEach(it => {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    if (it.e > clusterEnd) clusterEnd = it.e;
  });
  flush();
  return result;
}

// Grid time bounds derived from actual artist data so daytime festivals
// (ACL 11:00–22:00) and nighttime (EDC 19:00–05:30) both work correctly.
const _gridBounds = (() => {
  // weekend-exempt: earliest/latest set times, which both weekends share. It
  // also runs at module scope, before the active lineup exists.
  const all = typeof ARTISTS !== "undefined" ? ARTISTS : [];
  if (!all.length) return { start: 19 * 60, end: (24 + 5) * 60 + 30 };
  let lo = Infinity, hi = -Infinity;
  all.forEach(a => {
    const s = toNightMin(a.start), e = toNightMin(a.end);
    if (s < lo) lo = s;
    if (e > hi) hi = e;
  });
  return {
    start: Math.floor(lo / 60) * 60,
    end: Math.ceil(hi / 60) * 60,
  };
})();
const GRID_START_MIN = _gridBounds.start;
const GRID_END_MIN   = _gridBounds.end;
const GRID_PX_PER_MIN = 1.8;
const GRID_TOTAL_H = (GRID_END_MIN - GRID_START_MIN) * GRID_PX_PER_MIN;
const GRID_HEADER_H = 30;
function _minToTop(m) {
  return (Math.max(GRID_START_MIN, Math.min(GRID_END_MIN, m)) - GRID_START_MIN) * GRID_PX_PER_MIN;
}

// v139: time-aligned saved-sets sidebar. Each entry positions absolutely
// at the corresponding time row so the column reads like a personal vertical
// schedule next to the full grid. Tap an entry to open the artist page; tap
// the small × to un-save the set right there.
function SavedSidebar({ day, state, setState }) {
  const saved = state.saved
    .map(id => ARTISTS.find(a => a.id === id))
    .filter(a => a && a.day === day)
    .sort((a, b) => a.start.localeCompare(b.start));

  const unsave = (id, e) => {
    e.stopPropagation();
    setState(s => ({ ...s, saved: s.saved.filter(x => x !== id) }));
  };

  return (
    <div style={{
      flex: "0 0 100px", boxSizing: "border-box",
      borderRight: "1px solid var(--line)",
      background: "var(--paper)",
      position: "relative",
    }}>
      {/* Header matches the grid's sticky stage-header height so the rows
          below align with the time gutter pixel-for-pixel. */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        height: GRID_HEADER_H,
        display: "flex", alignItems: "center",
        padding: "0 8px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--line-2)",
      }}>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.2, color: "var(--muted)",
          fontWeight: 700,
        }}>MY SETS · {saved.length}</div>
      </div>
      <div style={{ position: "relative", height: GRID_TOTAL_H }}>
        {saved.length === 0 ? (
          <div style={{
            position: "absolute", top: 14, left: 6, right: 6,
            padding: "10px 6px", textAlign: "center",
            fontSize: 9, lineHeight: 1.3, color: "var(--muted)",
            border: "1px dashed var(--line-2)", borderRadius: 8,
          }}>
            Tap any set in the grid to add
          </div>
        ) : saved.map(a => {
          const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
          const startMin = toNightMin(a.start);
          const endMin   = toNightMin(a.end);
          const top      = _minToTop(startMin);
          const blockH   = Math.max(34, _minToTop(endMin) - top);
          const isLive = isSetLive(a);
          return (
            <button
              key={a.id}
              onClick={() => setState(s => ({ ...s, artist: a.id }))}
              style={{
                position: "absolute",
                top, left: 4, right: 4, height: blockH,
                display: "flex", alignItems: "stretch", gap: 5,
                padding: "4px 4px 4px 5px",
                background: stage ? `${stage.color}1a` : "var(--paper-2)",
                border: isLive ? "1px solid var(--success)" : `1px solid ${stage?.color || "var(--line-2)"}40`,
                borderLeft: `3px solid ${stage?.color || "var(--line-2)"}`,
                borderRadius: 6,
                cursor: "pointer", textAlign: "left",
                overflow: "hidden",
              }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: "var(--ink)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.1,
                }}>{a.name}</div>
                <div className="mono" style={{
                  fontSize: 8, letterSpacing: 0.5, fontWeight: 600,
                  color: isLive ? "var(--success)" : "var(--muted)",
                }}>
                  {isLive ? "● LIVE" : `${a.start}–${a.end}`}
                </div>
              </div>
              <span
                role="button"
                aria-label={`Remove ${a.name}`}
                onClick={(e) => unsave(a.id, e)}
                style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: 999,
                  background: "rgba(0,0,0,0.06)", color: "var(--muted)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, lineHeight: 1,
                  alignSelf: "flex-start",
                }}>×</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// One set block. Extracted from TimelineGrid's inline map so FOCUS and ALL
// modes render identical blocks — including the long-press-to-save gesture,
// which is easy to lose in a rewrite and impossible to notice missing.
function GridSetBlock({
  a, stage, state, setState, top, height, left, width,
  active, saved, clash, matched, isHighlighted, refStore,
  showEndTime, dueMins, narrow = false,
}) {
  const isHeadliner = a.tier === 3;
  // How many lines the name gets. This used to be a flat 2 above `narrow`,
  // which was fine when the only wide column was the 200px+ FOCUS panel and
  // wrong the moment every column became ~98px: it printed
  // "MAX DEAN B2B LUKE…" inside a block with room for four lines. Budget it
  // off the block's own height instead — line box ≈ font × 1.1, minus the
  // padding and the time row — and cap at 4 so a long slot does not become a
  // wall of text.
  const _lineH   = narrow ? 10.2 : isHeadliner ? 13.8 : 12.7;
  const _chrome  = narrow ? 8 : 20; // padding, plus the time line where it renders
  const nameLines = Math.max(1, Math.min(4, Math.floor((height - _chrome) / _lineH)));
  const fillAlpha = isHeadliner ? "38" : "22";
  const dimAlpha  = isHeadliner ? "14" : "08";
  const _store = refStore;
  const _resetHold = (e) => {
    const el = e.currentTarget, fill = el.querySelector("[data-lpfill]");
    el.style.transform = "";
    if (fill) { fill.style.transition = "width .12s"; fill.style.width = "0%"; }
    if (_store.lp) { clearTimeout(_store.lp); _store.lp = null; }
  };
  return (
    <div
      data-lineup-highlight={isHighlighted ? "true" : undefined}
      onClick={() => { if (_store.fired) { _store.fired = false; return; } setState({ ...state, artist: a.id }); }}
      onPointerDown={(e) => {
        const el = e.currentTarget, fill = el.querySelector("[data-lpfill]");
        el.style.transform = "scale(0.97)";
        if (fill) { fill.style.transition = "none"; fill.style.width = "0%"; void fill.offsetWidth; fill.style.transition = "width 0.5s linear"; fill.style.width = "100%"; }
        try { window.plurskyHaptic?.("LIGHT"); navigator.vibrate?.(8); } catch {}
        _store.lp = setTimeout(() => {
          _store.lp = null; _store.fired = true;
          el.style.transform = "";
          if (fill) { fill.style.transition = "none"; fill.style.width = "0%"; }
          toggleSave(state, setState, a.id);
        }, 500);
      }}
      onPointerUp={_resetHold}
      onPointerLeave={_resetHold}
      onPointerCancel={_resetHold}
      style={{
        position: "absolute", top, left, width, height,
        background: `${stage.color}${active || isHighlighted ? fillAlpha : dimAlpha}`,
        borderLeft: `3px solid ${active || isHighlighted ? stage.color : stage.color + "44"}`,
        borderRadius: 6,
        padding: narrow ? "3px 3px 3px 4px" : "4px 6px 4px 7px",
        cursor: "pointer", overflow: "hidden",
        opacity: active || isHighlighted ? 1 : 0.32,
        transition: "opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, border-left 0.2s ease, transform 0.12s ease",
        boxShadow: dueMins != null
          ? `0 0 0 2px var(--ember), 0 2px 12px ${stage.color}55`
          : clash && active
            ? "inset 0 0 0 1.5px var(--ember)"
            : (isHeadliner && (active || isHighlighted) ? `0 2px 8px ${stage.color}33` : "none"),
        zIndex: isHighlighted ? 6 : dueMins != null ? 5 : undefined,
        animation: isHighlighted ? "lineupFlash 1.8s ease-out" : undefined,
        display: "flex", flexDirection: "column",
      }}>
      <div style={{
        fontSize: narrow ? 9.5 : isHeadliner ? 12.5 : 11.5,
        fontWeight: isHeadliner ? 800 : 700,
        lineHeight: narrow ? 1.05 : 1.1, color: "var(--ink)",
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box",
        WebkitLineClamp: nameLines,
        WebkitBoxOrient: "vertical",
        // overflowWrap, NOT wordBreak. `wordBreak: break-word` breaks at any
        // character even when a space break was available, which turned
        // "Paris Paloma" into "Paris / Palom / a". overflowWrap breaks long
        // tokens only when they would otherwise overflow, so short names wrap
        // at their spaces and only genuinely-too-long words get split.
        overflowWrap: "break-word",
        paddingRight: saved ? (clash ? (narrow ? 19 : 23) : (narrow ? 9 : 12)) : 0,
        fontFamily: isHeadliner ? "Instrument Serif, Georgia, serif" : "Geist, -apple-system, sans-serif",
      }}>{a.name}</div>
      {/* Time label. The range only renders where it FITS — a 94px column
          clipped "2:45 PM - 3:30 P" mid-string, so narrow layouts show the
          start time alone rather than a truncated lie. Below `narrow` even the
          start does not fit, and the hour gutter already carries it. */}
      {!narrow && (
        <div className="mono" style={{
          fontSize: 8, letterSpacing: 0.3, color: "var(--muted)",
          marginTop: 2, whiteSpace: "nowrap",
        }}>{fmt12(a.start)}{showEndTime && height > 38 ? ` – ${fmt12(a.end)}` : ""}</div>
      )}
      {dueMins != null && height > 46 && (
        <div className="mono" style={{
          marginTop: "auto", fontSize: 8, letterSpacing: 1, fontWeight: 800,
          color: "var(--ember-ink)", whiteSpace: "nowrap",
        }}>YOU'RE DUE HERE · {dueMins} MIN</div>
      )}
      {saved && (
        <span style={{
          position: "absolute", top: 3, right: 5,
          fontSize: 10, color: "var(--ember-ink)", fontWeight: 800, lineHeight: 1,
        }}>★</span>
      )}
      {/* The conflict mark. conflictById is built from SAVED sets only, so
          a clash always carries a ★ too — the ⚠ sits just inside it. Same
          ⚠ language the LIST rows use, and the reason this view shows every
          stage at once: you cannot dodge a collision you cannot see. */}
      {clash && (
        <span title="Overlaps another saved set" aria-label="clash" style={{
          position: "absolute", top: 2.5, right: narrow ? 13 : 16,
          fontSize: 9, color: "var(--ember-ink)", fontWeight: 800, lineHeight: 1,
        }}>⚠</span>
      )}
      {!saved && matched && height > 30 && (
        <span style={{
          position: "absolute", top: 4, right: 5,
          fontSize: 9, color: "#1DB954", fontWeight: 800, lineHeight: 1,
        }}>♫</span>
      )}
      <div data-lpfill aria-hidden="true" style={{
        position: "absolute", left: 0, bottom: 0, height: 3, width: "0%",
        background: stage.color, borderRadius: "0 0 6px 6px",
        pointerEvents: "none", zIndex: 3,
      }}/>
    </div>
  );
}

// Hour rules + the NOW line, shared by both layouts.
function GridHourLines({ hours, minToTop }) {
  return hours.map(h => (
    <div key={h.label} style={{
      position: "absolute", left: 0, right: 0,
      top: minToTop(h.mins), height: 1, background: "var(--line)",
    }} />
  ));
}

// The multi-stage timetable. Every stage that has sets today is a column on
// one shared vertical timeline — the shape of the official festival grid, and
// the whole point of the view: you cannot see a conflict you cannot see two
// stages at once for.
//
// v271 replaced the one-stage-at-a-time pager (FOCUS) and the squeeze-it-all-
// in overview (FIT) with this single mode. FOCUS meant memorising seven swiped
// panels; FIT at 375px with 7 stages gave each column ~47px, which rendered
// artist names as three characters and an ellipsis. Neither was a timetable.
// There is deliberately ONE grid mode now — a third way to look at the same
// sets was the problem, not the solution.
function TimelineGrid({ lead, day, allDayArtists, state, setState, matchesActive, conflictById, spotifyMatchedIds, highlightId }) {
  const GUTTER_W = 44;
  // The stage header row lives INSIDE the scroll box so it can pin vertically
  // and pan horizontally at the same time. That means it occupies real scroll
  // height, and every scrollTop below has to add it back.
  const HEAD_H = 34;
  const TOTAL_H = GRID_TOTAL_H;
  const minToTop = _minToTop;

  const scrollRef = React.useRef(null);
  const leadRef = React.useRef(null);
  const _blockRefs = React.useRef({});

  const HOURS = [];
  for (let h = Math.floor(GRID_START_MIN / 60); h <= Math.floor(GRID_END_MIN / 60); h++) {
    const h24 = h % 24;
    const suffix = h24 < 12 ? "AM" : "PM";
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    HOURS.push({ label: `${h12} ${suffix}`, mins: h * 60 });
  }

  let nowTop = null, nowMin = null;
  if (NOW.night === day && NOW.time) {
    nowMin = toNightMin(NOW.time);
    if (nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN) nowTop = minToTop(nowMin);
  }

  // A stage with no sets today gets no column — an empty lane is dead width on
  // a screen that has none to spare.
  const cols = STAGES
    .map(s => ({ stage: s, artists: allDayArtists.filter(a => a.stage === s.id) }))
    .filter(c => c.artists.length > 0);

  // The user's next saved set today — the one piece of guidance no generic
  // grid can give, because it needs the lineup AND this person's saves.
  const due = React.useMemo(() => {
    if (nowMin == null) return null;
    const mine = allDayArtists
      .filter(a => state.saved.includes(a.id))
      .map(a => ({ a, start: toNightMin(a.start) }))
      .filter(x => x.start >= nowMin)
      .sort((x, y) => x.start - y.start);
    if (!mine.length) return null;
    return { id: mine[0].a.id, mins: Math.round(mine[0].start - nowMin), stageId: mine[0].a.stage };
  }, [allDayArtists, state.saved, nowMin]);

  // Column width needs the real box width, not an assumption — the pan target
  // for a header tap is computed from it.
  const [boxW, setBoxW] = React.useState(375);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const read = () => setBoxW(Math.max(240, Math.round(el.clientWidth || 375)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A timetable is only a timetable if a column is readable, so the band is a
  // FLOOR and never a squeeze: ~97px at 375px, which puts the gutter plus
  // three full stages on screen with the fourth peeking. That peek is the
  // affordance — a half-column is the one universally understood "there is
  // more this way". When a festival has few enough stages to fit, they spread
  // to fill the width instead of leaving a gap on the right.
  const BAND = Math.round(Math.min(118, Math.max(92, boxW * 0.26)));
  const COL_W = Math.max(BAND, Math.floor((boxW - GUTTER_W) / Math.max(1, cols.length)));
  // Only a wide column has room for a full "7:15 PM – 8:00 PM".
  const showEndTime = COL_W >= 120;
  // A column is never below this now, but a block SPLIT into overlap lanes
  // still can be, and a lane that narrow drops the time label rather than
  // clipping it mid-glyph (the hour gutter already carries the time — that is
  // the whole point of a timetable).
  const narrow = COL_W < 72;

  const scrollToStage = (id) => {
    const i = cols.findIndex(c => c.stage.id === id);
    const el = scrollRef.current;
    if (i < 0 || !el) return;
    // The gutter is sticky-left, so a column's resting place is exactly
    // i * COL_W — that lands it flush against the gutter, not under it.
    el.scrollTo({ left: i * COL_W, behavior: "smooth" });
  };

  // Open on the current hour (or the next saved set) instead of at the top of
  // a 12-hour day.
  const didInit = React.useRef(false);
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || didInit.current || !cols.length) return;
    didInit.current = true;
    const target = due ? toNightMin(ARTISTS.find(a => a.id === due.id)?.start || 0) : nowMin;
    if (target != null && target >= GRID_START_MIN && target <= GRID_END_MIN) {
      el.scrollTop = Math.max(0, (leadRef.current ? leadRef.current.offsetHeight : 0) + HEAD_H + minToTop(target) - 100);
    }
    // Horizontally we only pan away from the left edge when there is a reason
    // to: a saved set coming up on a stage that is off screen. Opening
    // mid-pan for no stated reason is more disorienting than opening at the
    // first stage.
    if (due) {
      const i = cols.findIndex(c => c.stage.id === due.stageId);
      if (i > 0) el.scrollLeft = i * COL_W;
    }
  }, [cols.length, COL_W, due, nowMin, minToTop]);

  const savedByStage = React.useMemo(() => {
    const m = {};
    for (const a of allDayArtists) if (state.saved.includes(a.id)) m[a.stage] = (m[a.stage] || 0) + 1;
    return m;
  }, [allDayArtists, state.saved]);

  // With a lead (the utility stack) the scroller still renders on a day with
  // no columns, so the search field can never unmount under the user's thumb.
  if (!cols.length && !lead) return null;

  return (
    // Fills the space the header leaves. There is exactly ONE scrolling
    // element here — the old build nested this grid's own scroll box inside
    // the page's ScrollBody, so on iOS a drag would hijack whichever region
    // it felt like. The height used to be calc(100dvh - 208px), a constant
    // that silently encoded the header's height; the header is collapsible
    // now, so the number is gone and flex does the work.
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        ref={scrollRef}
        data-grid-scroll
        style={{
          flex: 1, minHeight: 0, overflow: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}>
        <div style={{ minWidth: GUTTER_W + cols.length * COL_W, position: "relative" }}>
          {/* The utility stack (#116). In normal flow above the stage headers,
              so a vertical scroll carries it away and the headers then pin;
              sticky-LEFT at the box's width so a horizontal pan leaves it in
              place. It lives inside this full-width div on purpose: a sticky
              element cannot leave its parent, and only this parent spans
              every column. */}
          {lead && (
            <div ref={leadRef} data-grid-lead style={{ position: "sticky", left: 0, width: boxW, background: "var(--paper)" }}>
              {lead}
            </div>
          )}
          {cols.length > 0 ? (<>
          {/* Stage headers. Sticky to the TOP of the scroll box (they hold
              while you read down the night) but NOT to the left (they pan
              with their own columns). This IS the wayfinding that the old
              "SNAPCHAT STAGE · 2/7 · SWIPE FOR STAGES" bar was standing in
              for: you never have to be told which stage you are looking at,
              because the label is attached to the column. */}
          <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 8, height: HEAD_H }}>
            {/* Corner. Opaque, and pinned in both axes, so the hour labels
                cannot slide out from under the headers. */}
            <div style={{
              width: GUTTER_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 2,
              background: "var(--paper)",
              borderRight: "1px solid var(--line)",
              borderBottom: "1px solid var(--line-2)",
            }}/>
            {cols.map(({ stage: s }) => {
              const n = savedByStage[s.id] || 0;
              return (
                <button
                  key={s.id}
                  data-stage-head={s.id}
                  onClick={() => { try { window.plurskyHaptic?.("LIGHT"); } catch {} scrollToStage(s.id); }}
                  title={s.name}
                  className="mono"
                  style={{
                    width: COL_W, flexShrink: 0, height: HEAD_H,
                    border: "none", borderLeft: "1px solid var(--line)",
                    borderBottom: "1px solid var(--line-2)",
                    background: "var(--paper)", color: "var(--ink)",
                    padding: "3px 5px 0", cursor: "pointer", position: "relative",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    fontSize: 10, letterSpacing: 1.1, fontWeight: 800,
                    fontFamily: "inherit",
                  }}>
                  {/* The stage's colour, sitting directly on top of its own
                      column — the same colour the blocks below are tinted in. */}
                  <span aria-hidden="true" style={{
                    position: "absolute", left: 0, right: 0, top: 0, height: 3,
                    background: s.color,
                  }}/>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.short}</span>
                  {n > 0 && (
                    <span style={{ flexShrink: 0, color: "var(--ember-ink)", fontSize: 8.5, fontWeight: 800 }}>★{n}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", position: "relative" }}>
            {/* Time gutter — pinned left. */}
            <div style={{
              width: GUTTER_W, flexShrink: 0, position: "sticky", left: 0,
              height: TOTAL_H, zIndex: 4, background: "var(--paper)",
              borderRight: "1px solid var(--line)",
            }}>
              {HOURS.map(h => (
                <div key={h.label} className="mono" style={{
                  position: "absolute", top: minToTop(h.mins) - 6, right: 6,
                  fontSize: 9, letterSpacing: 0.3,
                  color: "var(--muted)", fontWeight: 700,
                }}>{h.label}</div>
              ))}
              {/* NOW docks to the gutter and stays there. It used to be
                  positioned in content space, so scrolling sideways slid it
                  over the set blocks. */}
              {nowTop != null && (
                <span className="mono" style={{
                  position: "absolute", left: 2, top: nowTop - 7, zIndex: 6,
                  fontSize: 8, letterSpacing: 0.6, color: "#fff", fontWeight: 800,
                  background: "var(--ember)", padding: "1px 4px", borderRadius: 3,
                }}>NOW</span>
              )}
            </div>

            {cols.map(({ stage, artists: stageArtists }, si) => {
              const lanes = layoutLanes(stageArtists);
              return (
                <div key={stage.id} style={{
                  width: COL_W, flexShrink: 0,
                  position: "relative", height: TOTAL_H,
                  borderLeft: "1px solid var(--line)",
                  background: si % 2 === 0 ? "transparent" : "rgba(26,18,13,0.018)",
                }}>
                  <GridHourLines hours={HOURS} minToTop={minToTop} />
                  {stageArtists.map(a => {
                    const start = toNightMin(a.start);
                    const end = toNightMin(a.end);
                    const top = minToTop(start);
                    const height = Math.max(24, minToTop(end) - top);
                    const lay = lanes[a.id] || { lane: 0, lanes: 1 };
                    const laneGap = lay.lanes > 1 ? 1.5 : 0;
                    const laneW = (COL_W - 4 - laneGap * (lay.lanes - 1)) / lay.lanes;
                    const laneLeft = 2 + lay.lane * (laneW + laneGap);
                    return (
                      <GridSetBlock
                        key={a.id}
                        a={a} stage={stage} state={state} setState={setState}
                        top={top} height={height} left={laneLeft} width={laneW}
                        active={matchesActive(a)}
                        saved={state.saved.includes(a.id)}
                        clash={!!conflictById[a.id]}
                        matched={spotifyMatchedIds && spotifyMatchedIds.has && spotifyMatchedIds.has(a.id)}
                        isHighlighted={highlightId === a.id}
                        refStore={_blockRefs.current[a.id] || (_blockRefs.current[a.id] = { lp: null, fired: false })}
                        showEndTime={showEndTime && lay.lanes === 1}
                        narrow={narrow || laneW < 72}
                        dueMins={due && due.id === a.id ? due.mins : null}
                      />
                    );
                  })}
                </div>
              );
            })}

            {nowTop != null && (
              <div style={{
                position: "absolute", left: GUTTER_W, right: 0, top: nowTop, height: 0,
                borderTop: "2px solid var(--ember)",
                boxShadow: "0 0 8px rgba(232,93,46,0.55)",
                zIndex: 3, pointerEvents: "none",
              }}/>
            )}
          </div>
          </>) : (
            <div className="mono" style={{ position: "sticky", left: 0, width: boxW, padding: "28px 16px", textAlign: "center", fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              NO SETS ON THIS DAY
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConflictResolver({ conflicts, onKeep, onKeepBoth, onSplit }) {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (conflicts.length > 0) {
      try { navigator.vibrate([50, 30, 50]); } catch {}
      try { window.plurskyHaptic?.("HEAVY"); } catch {}
    }
  }, [conflicts.length]);
  // If the current index falls out of range because a conflict was just
  // resolved (state mutation upstream re-renders us with a shorter list),
  // clamp back into bounds.
  const safeIdx = Math.min(idx, Math.max(0, conflicts.length - 1));
  if (!conflicts.length) return null;
  const pair = conflicts[safeIdx];
  const [a, b] = pair;
  const sA = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
  const sB = (STAGES.find(s => s.id === b.stage) || UNPLACED_STAGE);
  const overlapStart = a.start > b.start ? a.start : b.start;
  const overlapEnd = a.end < b.end ? a.end : b.end;

  const next = () => {
    setIdx(i => (i + 1 < conflicts.length ? i + 1 : i));
  };

  return (
    <div style={{
      margin: "0 16px 14px",
      padding: 14,
      borderRadius: 16,
      background: "var(--ink)",
      color: "var(--paper)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2">
            <polygon points="12,3 22,20 2,20" strokeLinejoin="round"/>
            <path d="M12 10 V14" strokeLinecap="round"/>
            <circle cx="12" cy="17" r="0.7" fill="var(--ember)"/>
          </svg>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.6, color: "var(--ember-ink)", fontWeight: 700 }}>
            CONFLICT {idx + 1}/{conflicts.length}
          </span>
        </div>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(247,237,224,0.55)" }}>
          OVERLAP {overlapStart}–{overlapEnd}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        {[a, b].map((art, i) => {
          const stg = i === 0 ? sA : sB;
          return (
            <div key={art.id} style={{
              background: "rgba(247,237,224,0.06)", borderRadius: 12, padding: "9px 10px",
              borderLeft: `3px solid ${stg.color}`,
            }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.05 }}>{art.name}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(247,237,224,0.55)", marginTop: 3 }}>
                {stg.name.toUpperCase()} · {fmt12(art.start)}–{fmt12(art.end)}
              </div>
              <button onClick={() => onKeep(art.id, i === 0 ? b.id : a.id)} style={{
                marginTop: 8, width: "100%",
                background: stg.color, color: "#fff", border: "none",
                borderRadius: 8, padding: "6px 8px",
                fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                cursor: "pointer",
              }}>KEEP THIS</button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onKeepBoth?.(pair)} style={{
          flex: 1, background: "rgba(247,237,224,0.08)",
          border: "1px solid rgba(247,237,224,0.3)",
          color: "var(--paper)", borderRadius: 10, padding: "8px 10px",
          fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          cursor: "pointer",
        }}>KEEP BOTH ↺</button>
        <button onClick={() => onSplit(pair)} style={{
          flex: 1, background: "transparent", border: "1px solid rgba(247,237,224,0.3)",
          color: "var(--paper)", borderRadius: 10, padding: "8px 10px",
          fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 600,
          cursor: "pointer",
        }}>SPLIT NIGHT →</button>
        {conflicts.length > 1 && (
          <button onClick={next} style={{
            background: "transparent", border: "1px solid rgba(247,237,224,0.3)",
            color: "rgba(247,237,224,0.65)", borderRadius: 10, padding: "8px 12px",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1.2, fontWeight: 600,
            cursor: "pointer",
          }}>NEXT</button>
        )}
      </div>
    </div>
  );
}

function TierStars({ tier }) {
  const colors = { 3: "#f59a36", 2: "var(--muted)", 1: "rgba(26,18,13,0.25)" };
  return (
    <span style={{ display: "inline-flex", gap: 1.5, alignItems: "center" }}>
      {/* not-days: three tier stars */}
      {[1, 2, 3].map(i => (
        <svg key={i} width="9" height="9" viewBox="0 0 24 24"
          fill={i <= tier ? colors[tier] : "rgba(26,18,13,0.12)"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </span>
  );
}

// ── .ics calendar export ──
// Festival timezone + day → date map come from FESTIVAL_CONFIG so this
// works for any festival once the config is loaded. Emit DTSTART/DTEND
// with TZID so any calendar app picks the right local time.
const _TZ_DB = {
  "America/Los_Angeles": { std: "PST", dst: "PDT", stdOff: "-0800", dstOff: "-0700", dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU" },
  "America/Chicago":     { std: "CST", dst: "CDT", stdOff: "-0600", dstOff: "-0500", dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU" },
  "America/New_York":    { std: "EST", dst: "EDT", stdOff: "-0500", dstOff: "-0400", dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU" },
  "America/Denver":      { std: "MST", dst: "MDT", stdOff: "-0700", dstOff: "-0600", dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU" },
};
function _icsTimezone(tz) {
  const t = _TZ_DB[tz] || _TZ_DB["America/Los_Angeles"];
  return [
    "BEGIN:VTIMEZONE", `TZID:${tz}`,
    "BEGIN:DAYLIGHT", `TZOFFSETFROM:${t.stdOff}`, `TZOFFSETTO:${t.dstOff}`,
    `TZNAME:${t.dst}`, "DTSTART:19700308T020000", `RRULE:${t.dstStart}`, "END:DAYLIGHT",
    "BEGIN:STANDARD", `TZOFFSETFROM:${t.dstOff}`, `TZOFFSETTO:${t.stdOff}`,
    `TZNAME:${t.std}`, "DTSTART:19701101T020000", `RRULE:${t.stdStart}`, "END:STANDARD",
    "END:VTIMEZONE",
  ];
}
function _setTimeToLocalDate(day, hhmm) {
  const meta = FESTIVAL_CONFIG.dayDates[day];
  const d = new Date(meta.y, meta.m, meta.d);
  const [h, m] = hhmm.split(":").map(Number);
  // Times before 08:00 are early-morning of the next calendar day
  if (h < 8) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}
function _icsLocal(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
function _icsEscape(s) {
  return String(s || "").replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
}

async function exportLineupICS(state) {
  const saved = state.saved
    .map(id => ARTISTS.find(a => a.id === id))
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start));
  if (saved.length === 0) return { ok: false, reason: "empty" };

  const tz = FESTIVAL_CONFIG.tz;
  const fid = FESTIVAL_CONFIG.id;
  const fname = FESTIVAL_CONFIG.shortName;
  const venue = FESTIVAL_CONFIG.locationShort;
  const dtstamp = _icsLocal(new Date());
  const events = saved.map(a => {
    const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
    const start = _icsLocal(_setTimeToLocalDate(a.day, a.start));
    const end   = _icsLocal(_setTimeToLocalDate(a.day, a.end));
    const summary = _icsEscape(`${a.name} · ${stage.short}`);
    const desc = _icsEscape(`${a.genre} · ${stage.name}\\nbuilt with Plursky · plursky.com`);
    const loc = _icsEscape(`${stage.name} · ${venue}`);
    return [
      "BEGIN:VEVENT",
      `UID:plursky-${a.id}-${fid}@plursky.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${tz}:${start}`,
      `DTEND;TZID=${tz}:${end}`,
      `SUMMARY:${summary}`,
      `LOCATION:${loc}`,
      `DESCRIPTION:${desc}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT15M",
      `DESCRIPTION:${summary} starts in 15 min`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  }).join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Plursky//${fname}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:My ${fname}`,
    `X-WR-TIMEZONE:${tz}`,
    ..._icsTimezone(tz),
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const fileName = `my-${fid}.ics`;
  // Use text/plain for the share file — text/calendar is NOT in the Web Share API
  // allowlist on iOS, causing canShare() to return false silently.
  // iOS Calendar and most apps still recognise .ics by filename extension.
  const shareFile = new File([blob], fileName, { type: "text/plain" });
  if (navigator.canShare?.({ files: [shareFile] }) && navigator.share) {
    try { await navigator.share({ files: [shareFile], title: `My ${fname}` }); return { ok: true, mode: "share", count: saved.length }; }
    catch (e) { if (e.name === "AbortError") return { ok: true, mode: "abort" }; }
  }
  // iOS PWA: link.download is blocked; open a data: URL instead which Safari
  // recognises as a calendar file and offers the "Add to Calendar" prompt.
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    window.open(dataUrl, "_blank");
    return { ok: true, mode: "download", count: saved.length };
  }
  // Desktop / Android: anchor download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = fileName;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, mode: "download", count: saved.length };
}

// ── Printable lineup PDF (browser native) ──
// Opens a print-friendly HTML view in a new window and triggers Print.
// User saves as PDF from the OS print dialog — no PDF library required.
function printLineupPDF(state) {
  const saved = state.saved
    .map(id => ARTISTS.find(a => a.id === id))
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start));
  if (saved.length === 0) return { ok: false, reason: "empty" };

  const dayLabel = Object.fromEntries(DAYS.map(d => [d.n, `${d.label} · ${d.date.toUpperCase()}`]));
  const stages = [...new Set(saved.map(a => a.stage))].length;
  const grouped = { 1: [], 2: [], 3: [] };
  saved.forEach(a => grouped[a.day].push(a));

  const dayBlock = (day, list) => list.length === 0 ? "" : `
    <section class="day">
      <h2>${dayLabel[day]}<span class="cnt">${list.length} sets</span></h2>
      <table>
        <colgroup><col class="ctime"><col><col class="cstage"></colgroup>
        ${list.map(a => {
          const st = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
          return `<tr>
            <td class="time">${fmt12(a.start)}<span class="end">${fmt12(a.end)}</span></td>
            <td>
              <div class="name">${a.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>
              <div class="genre">${a.genre}</div>
            </td>
            <td class="stage" style="border-left-color:${st.color}">${st.name}</td>
          </tr>`;
        }).join("")}
      </table>
    </section>`;

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>My Plan — Plursky</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Geist',system-ui,sans-serif;color:#1a120d;background:#f7ede0;padding:48px 56px;font-size:13px;line-height:1.5}
  .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a120d;padding-bottom:14px;margin-bottom:30px}
  .brand{font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:3px;font-weight:600;opacity:0.65}
  h1{font-family:'Instrument Serif',serif;font-size:48px;line-height:0.95;letter-spacing:-1px;margin-top:6px}
  h1 em{color:#e85d2e;font-style:italic}
  .meta{font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:1.6px;text-align:right;color:rgba(26,18,13,0.55)}
  .meta b{color:#1a120d;font-weight:600;font-size:14px}
  .day{margin-bottom:34px;page-break-inside:avoid}
  .day h2{font-family:'Geist Mono',monospace;font-size:13px;letter-spacing:2.5px;font-weight:700;color:#e85d2e;margin-bottom:10px;display:flex;justify-content:space-between;align-items:baseline}
  .cnt{font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:1.4px;color:rgba(26,18,13,0.5);font-weight:500}
  table{width:100%;border-collapse:collapse}
  col.ctime{width:90px}
  col.cstage{width:180px}
  tr{border-bottom:1px solid rgba(26,18,13,0.12)}
  td{padding:10px 6px;vertical-align:middle}
  td.time{font-family:'Geist Mono',monospace;font-size:14px;font-weight:600}
  td.time .end{display:block;font-weight:400;font-size:9.5px;letter-spacing:1px;color:rgba(26,18,13,0.5);margin-top:1px}
  .name{font-family:'Instrument Serif',serif;font-size:24px;line-height:1.1;letter-spacing:-0.3px}
  .genre{font-family:'Geist Mono',monospace;font-size:9.5px;letter-spacing:1.3px;color:rgba(26,18,13,0.5);margin-top:3px;text-transform:uppercase}
  td.stage{font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:1.6px;font-weight:700;text-align:right;border-left:3px solid;padding-left:14px;text-transform:uppercase}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid rgba(26,18,13,0.18);display:flex;justify-content:space-between;font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:1.4px;color:rgba(26,18,13,0.55)}
  footer em{font-family:'Instrument Serif',serif;font-size:14px;color:#1a120d;font-style:italic;letter-spacing:0}
  @media print{
    body{padding:24px 32px;background:#fff}
    .head{margin-bottom:22px}
    .day{margin-bottom:26px}
  }
</style></head>
<body>
  <div class="head">
    <div>
      <div class="brand">PLURSKY</div>
      <h1>My <em>plan</em></h1>
    </div>
    <div class="meta">
      <b>${saved.length}</b> SETS · <b>${stages}</b> STAGES<br>
      ${FESTIVAL_CONFIG.locationShort.toUpperCase()}<br>
      ${FESTIVAL_CONFIG.dates.toUpperCase()} · ${FESTIVAL_CONFIG.year}
    </div>
  </div>
  ${dayBlock(1, grouped[1])}
  ${dayBlock(2, grouped[2])}
  ${dayBlock(3, grouped[3])}
  <footer>
    <span>plursky.com</span>
    <em>Three nights under the electric sky</em>
  </footer>
</body></html>`;

  const w = window.open("", "plursky-print", "width=900,height=1100");
  if (!w) return { ok: false, reason: "popup_blocked" };
  w.document.write(html);
  w.document.close();
  w.focus();
  // Give fonts a moment to load before triggering Print
  setTimeout(() => { try { w.print(); } catch {} }, 500);
  return { ok: true };
}

async function copyScheduleText(state) {
  const ids = state.saved;
  if (!ids.length) return { ok: false, reason: "empty" };
  const lines = festivalDayNums().flatMap(day => {
    const d = FESTIVAL_CONFIG.dayDates[day];
    const artists = activeLineup().filter(a => a.day === day && ids.includes(a.id))
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
    if (!artists.length) return [];
    return [
      `${d.short} · ${d.name.toUpperCase()}`,
      ...artists.map(a => {
        const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
        return `  ${fmt12(a.start)}  ${a.name}  @  ${stage ? stage.name : a.stage}`;
      }),
      "",
    ];
  });
  const text = [`My ${FESTIVAL_CONFIG.name} lineup (${ids.length} sets):`, "", ...lines].join("\n").trim();
  try {
    if (navigator.share) {
      await navigator.share({ title: `My ${FESTIVAL_CONFIG.name} lineup`, text });
      return { ok: true };
    }
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch { return { ok: false }; }
}

function ShareLineupButton({ state }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(null); // 'image' | 'cal' | 'pdf' | 'txt' | null

  const wrap = (key, fn) => async () => {
    if (busy) return;
    setOpen(false); setBusy(true);
    const r = await fn(state);
    setBusy(false);
    if (r?.ok) { setDone(key); setTimeout(() => setDone(null), 1800); }
    else if (r?.reason === "popup_blocked") {
      alert("Popup blocked — allow popups for plursky.com and try again.");
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} disabled={busy} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 999,
        background: done ? "var(--success)" : "var(--ink)",
        color: "var(--paper)", border: "none",
        fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
        cursor: busy ? "wait" : "pointer", textTransform: "uppercase",
        opacity: busy ? 0.65 : 1,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4 V14"/><path d="M7 9 L12 4 L17 9"/><path d="M5 14 V20 H19 V14"/>
        </svg>
        {done === "image" ? "SAVED"
          : done === "cal" ? "ADDED"
          : done === "pdf" ? "PRINTED"
          : done === "txt" ? "COPIED"
          : busy ? "…" : "SHARE"}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 60, background: "transparent",
          }}/>
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 61,
            background: "var(--paper)", border: "1px solid var(--line-2)",
            borderRadius: 12, padding: 5, minWidth: 200,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          }}>
            <ShareMenuItem icon="img"  label="Image for stories" sub="1080×1920 PNG" onClick={wrap("image", shareLineupImage)} />
            <ShareMenuItem icon="cal"  label="Add to calendar"   sub=".ics with 15-min reminders" onClick={wrap("cal", exportLineupICS)} />
            <ShareMenuItem icon="prn"  label="Print schedule"    sub="Save as PDF from print dialog" onClick={wrap("pdf", async (s) => printLineupPDF(s))} />
            <ShareMenuItem icon="txt"  label="Copy as text"      sub="Paste anywhere" onClick={wrap("txt", copyScheduleText)} />
          </div>
        </>
      )}
    </div>
  );
}

function ShareMenuItem({ icon, label, sub, onClick }) {
  const ico =
    icon === "img" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17 L9 12 L14 16 L17 13 L21 17"/></svg> :
    icon === "cal" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9 H21"/><path d="M8 3 V7"/><path d="M16 3 V7"/></svg> :
    icon === "txt" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8 H16"/><path d="M8 12 H16"/><path d="M8 16 H12"/></svg> :
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9 V3 H18 V9"/><rect x="3" y="9" width="18" height="9" rx="1"/><rect x="6" y="14" width="12" height="6"/></svg>;
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "9px 10px", borderRadius: 8,
      background: "transparent", border: "none", cursor: "pointer",
      textAlign: "left", color: "var(--ink)",
      fontFamily: "inherit", transition: "background .15s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <span style={{ color: "var(--ember-ink)", display: "flex" }}>{ico}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span className="mono" style={{ display: "block", fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 1, textTransform: "uppercase" }}>{sub}</span>
      </span>
    </button>
  );
}

function toggleSave(state, setState, id) {
  const has = state.saved.includes(id);
  const prevSaved = state.saved;
  const next = has ? state.saved.filter(x => x !== id) : [...state.saved, id];
  // Tombstone tracking for cloud sync conflict resolution — unsaves get a
  // timestamp so deletion propagates instead of being undone by union merge
  if (has) { try { window.sbMarkRemoved?.(id); } catch {} }
  else     { try { window.sbClearRemoved?.(id); } catch {} }
  const a = ARTISTS.find(x => x.id === id);
  const hasConflict = !has && a && next.some(sid => {
    if (sid === id) return false;
    const b = ARTISTS.find(x => x.id === sid);
    return b && b.day === a.day && overlaps(a, b);
  });
  if (hasConflict) {
    try { navigator.vibrate([50, 30, 50]); } catch {}
    try { window.plurskyHaptic?.("HEAVY"); } catch {}
  } else {
    try { navigator.vibrate([has ? 15 : 30]); } catch {}
    try { window.plurskyHaptic?.(has ? "LIGHT" : "MEDIUM"); } catch {}
  }
  setState(s => ({ ...s, saved: next }));
  try {
    const label = a?.name ? a.name.toUpperCase() : "SET";
    const isFirstSave = !has && state.saved.length === 0;
    const isMilestone = !has && [5, 10, 15, 20].includes(next.length);
    const msg = has ? `REMOVED · ${label}`
      : isFirstSave ? `✦ FIRST SET SAVED · ${label} · LET'S GO`
      : isMilestone ? `✦ ${next.length} SETS · ${label} · LINEUP GROWING`
      : hasConflict ? `SAVED · ${label} · ⚠ CLASH`
      : `SAVED · ${next.length} SETS`;
    // 3s UNDO toast — restores the exact prior saved set and reverses the
    // cloud-sync tombstone so an accidental tap (or long-press) is one tap to
    // revert. Re-saving clears the removal tombstone; un-saving re-adds it.
    const undo = () => {
      if (has) { try { window.sbClearRemoved?.(id); } catch {} }
      else     { try { window.sbMarkRemoved?.(id); } catch {} }
      setState(s => ({ ...s, saved: prevSaved }));
      try { window.plurskyHaptic?.("LIGHT"); } catch {}
      window.plurskyToast?.(has ? `RE-SAVED · ${label}` : `REMOVED · ${label}`);
    };
    window.plurskyToast?.(msg, { actionLabel: "UNDO", onAction: undo, duration: 3000 });
    if ((isFirstSave || isMilestone) && !has) {
      window._plurskyCelebrate?.();
    }
  } catch {}
}

// ── Share lineup image (canvas → PNG → Web Share / download) ──
async function shareLineupImage(state) {
  const saved = state.saved
    .map(id => ARTISTS.find(a => a.id === id))
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start));

  if (saved.length === 0) return { ok: false, reason: "empty" };

  // Make sure custom fonts are loaded before drawing — canvas needs them ready
  try { await document.fonts?.ready; } catch {}

  // 1080×1920 = IG/TikTok story aspect
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  // Paper-tone gradient ground
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,    "#f7ede0");
  bg.addColorStop(0.55, "#eee0cb");
  bg.addColorStop(1,    "#e6d3b6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Sun-glow corner — distinct EDC desert vibe
  const glow = ctx.createRadialGradient(W * 0.85, 220, 30, W * 0.85, 220, 600);
  glow.addColorStop(0, "rgba(245,154,54,0.42)");
  glow.addColorStop(1, "rgba(245,154,54,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);

  // Header
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(26,18,13,0.55)";
  ctx.font = '600 22px "Geist Mono", monospace';
  ctx.fillText(`PLURSKY · MY ${(FESTIVAL_CONFIG.shortName || "").toUpperCase()}`, 80, 130);

  ctx.fillStyle = "#1a120d";
  ctx.font = '108px "Instrument Serif", serif';
  ctx.fillText(`My ${FESTIVAL_CONFIG.brand || "Festival"}`, 80, 280);
  ctx.font = 'italic 108px "Instrument Serif", serif';
  ctx.fillStyle = "#e85d2e";
  ctx.fillText("plan", 380, 280);

  ctx.fillStyle = "rgba(26,18,13,0.6)";
  ctx.font = '500 26px "Geist Mono", monospace';
  const stages = [...new Set(saved.map(a => a.stage))].length;
  ctx.fillText(`${saved.length} SETS · ${stages} STAGES · 3 NIGHTS`, 80, 340);

  // Set list
  let y = 470;
  let lastDay = null;
  const dayMeta = Object.fromEntries(DAYS.map(d => [d.n, { label: d.label, date: d.date.toUpperCase() }]));

  for (const a of saved) {
    if (a.day !== lastDay) {
      lastDay = a.day;
      // Day section header
      const dm = dayMeta[a.day];
      ctx.fillStyle = "rgba(26,18,13,0.18)";
      ctx.fillRect(80, y - 20, W - 160, 1);
      ctx.fillStyle = "#1a120d";
      ctx.font = '500 28px "Geist Mono", monospace';
      ctx.fillText(`${dm.label} · ${dm.date}`, 80, y + 18);
      ctx.fillStyle = "rgba(26,18,13,0.4)";
      const dayCount = saved.filter(s => s.day === a.day).length;
      ctx.textAlign = "right";
      ctx.fillText(`${dayCount} SETS`, W - 80, y + 18);
      ctx.textAlign = "left";
      y += 70;
    }

    const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);

    // Stage colour stripe
    ctx.fillStyle = stage.color;
    ctx.fillRect(80, y, 6, 78);

    // Time
    ctx.fillStyle = "#1a120d";
    ctx.font = '500 28px "Geist Mono", monospace';
    ctx.fillText(fmt12(a.start), 110, y + 32);
    ctx.fillStyle = "rgba(26,18,13,0.45)";
    ctx.font = '400 20px "Geist Mono", monospace';
    ctx.fillText(fmt12(a.end), 110, y + 60);

    // Name + stage
    ctx.fillStyle = "#1a120d";
    ctx.font = '46px "Instrument Serif", serif';
    let name = a.name;
    if (ctx.measureText(name).width > 760) {
      while (ctx.measureText(name + "…").width > 760 && name.length > 0) name = name.slice(0, -1);
      name = name + "…";
    }
    ctx.fillText(name, 250, y + 38);

    ctx.fillStyle = stage.color;
    ctx.font = '600 18px "Geist Mono", monospace';
    ctx.fillText(stage.name.toUpperCase() + " · " + a.genre.toUpperCase(), 250, y + 64);

    y += 92;
    if (y > H - 180) break; // safety: don't overflow story height
  }

  // Footer
  ctx.fillStyle = "#1a120d";
  ctx.font = '500 22px "Geist Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText("plursky.com", W / 2, H - 110);

  ctx.fillStyle = "rgba(26,18,13,0.45)";
  ctx.font = 'italic 26px "Instrument Serif", serif';
  ctx.fillText("Three nights under the electric sky", W / 2, H - 70);

  // Export — filename derives from the ACTIVE festival (was hardcoded to EDC,
  // which exported the wrong brand for ACL + every future festival).
  const fname = `my-${(FESTIVAL_CONFIG.id || FESTIVAL_CONFIG.shortName || "festival").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  return new Promise((resolve) => {
    cv.toBlob(async (blob) => {
      if (!blob) { resolve({ ok: false, reason: "encode_fail" }); return; }
      const file = new File([blob], fname, { type: "image/png" });
      // Try Web Share API w/ files first (iOS 15+, Android Chrome)
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: `My ${FESTIVAL_CONFIG.shortName || "festival"} plan` });
          resolve({ ok: true, mode: "share" });
          return;
        } catch (e) {
          if (e.name === "AbortError") { resolve({ ok: true, mode: "abort" }); return; }
          // fall through to download
        }
      }
      // Fallback: trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = fname;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve({ ok: true, mode: "download" });
    }, "image/png");
  });
}

Object.assign(window, { LineupScreen, NightWizard, toggleSave, toNightMin, overlaps, shareLineupImage });

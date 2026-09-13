// Main app — iOS frame + routing

function spotifyTokenValid() {
  const token = localStorage.getItem("spotify_token");
  const expires = localStorage.getItem("spotify_expires");
  if (token && expires && Date.now() < parseInt(expires)) return true;
  // Expired but has a refresh token — getValidToken() will renew silently on next API call
  return !!localStorage.getItem("spotify_refresh_token");
}

const ONBOARD_VERSION = "v1";

// First-launch flow — three quick steps that surface features users would
// otherwise have to discover by browsing into Me / Music. Each step can be
// skipped, but doing them once sets up the most valuable hooks (Spotify
// matching, push reminders, name personalisation) before the festival.
// Stage-coloured particle atmosphere. Lifted out of the step-1 hero so the
// onboarding backdrop and the hero share one definition and cannot drift.
// STAGES is the ACTIVE festival's stage list, so the particles are that
// festival's palette — see CLAUDE.md §5 on window-resolved bare names.
function VfxParticleField({ count = 14, scale = 1 }) {
  const colors = (typeof STAGES !== "undefined" ? STAGES : []).slice(0, 5).map(s => s.color);
  if (!colors.length) return null;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const c = colors[i % colors.length];
        const size = (i % 3 === 2 ? 10 + (i % 3) * 6 : 3 + (i % 3) * 2) * scale;
        return React.createElement("div", { key: i, style: {
          position: "absolute",
          left: `${(i * 37 + 13) % 100}%`,
          bottom: i % 3 === 0 ? 0 : undefined,
          top: i % 3 !== 0 ? `${(i * 53 + 7) % 100}%` : undefined,
          width: size, height: size,
          borderRadius: "50%", background: c,
          filter: i % 3 === 2 ? "blur(6px)" : "none",
          opacity: 0,
          animation: `${i % 3 === 0 ? "vfx-rise" : i % 3 === 2 ? "vfx-drift" : "vfx-fall"} ${3 + (i % 4)}s ease-in-out ${(i * 0.4) % 4}s infinite`,
        }});
      })}
    </div>
  );
}

// ── Field Mode onboarding ─────────────────────────────────────────
// Three pages that show the product with the festival's REAL lineup (no
// invented stats or placeholder art), then the festival list. No permission
// prompts here: name, Spotify and reminders are asked when the user opens
// Personalize (Home's setup notice, Me), each with one sentence of why.
function _onbHeadliners(n) {
  const lineup = (typeof activeLineup === "function" ? activeLineup() : ARTISTS) || [];
  return [...lineup]
    .sort((a, b) => (b.tier || 0) - (a.tier || 0) || (a.day - b.day) || (toNightMin(a.start) - toNightMin(b.start)))
    .slice(0, n);
}

function OnbSchedulePreview() {
  const rows = _onbHeadliners(4)
    .sort((a, b) => (a.day - b.day) || (toNightMin(a.start) - toNightMin(b.start)))
    .slice(0, 3);
  return (
    <div style={{ background: "var(--paper-2)", borderRadius: 16, padding: "4px 16px" }}>
      {rows.map((a, i) => {
        const st = STAGES.find(s => s.id === a.stage);
        return (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64, borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ width: 76, flexShrink: 0, fontSize: 15, lineHeight: "21px", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt12(a.start)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, lineHeight: "22px", fontWeight: 600, overflowWrap: "anywhere" }}>{a.name}</div>
              <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>{FESTIVAL_CONFIG.dayDates?.[a.day]?.name || ""}{st ? ` · ${st.name}` : ""}</div>
            </div>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill={i === 0 ? "var(--signal)" : "none"} stroke={i === 0 ? "var(--signal)" : "var(--text-2)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </div>
        );
      })}
    </div>
  );
}

// The real hero-card renderer, so onboarding shows exactly what a user keeps.
function OnbCardPreview({ artists, count = 1 }) {
  const [urls, setUrls] = React.useState([]);
  React.useEffect(() => {
    let live = true; const made = [];
    (async () => {
      for (const a of artists.slice(0, count)) {
        let c = null;
        try { c = typeof _renderHeroCard === "function" ? await _renderHeroCard(a) : null; } catch {}
        if (!live || !c) continue;
        const blob = await new Promise(r => c.toBlob(r, "image/png"));
        if (!live || !blob) continue;
        const u = URL.createObjectURL(blob);
        made.push(u);
        setUrls(prev => [...prev, u]);
      }
    })();
    return () => { live = false; made.forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); };
  }, []);
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
      {artists.slice(0, count).map((a, i) => (
        <div key={a.id} style={{ width: count === 1 ? "72%" : "31%", aspectRatio: "4 / 5", borderRadius: 14, overflow: "hidden", background: "var(--paper-2)" }}>
          {urls[i] && <img src={urls[i]} alt={`${a.name} set card`} style={{ width: "100%", height: "100%", display: "block" }} />}
        </div>
      ))}
    </div>
  );
}

function OnboardingModal({ onDone, setState, state }) {
  // 0-2 are the story, 3 is the festival list. Clamped: a double tap must
  // never run past the last page (the old wizard blanked that way).
  const [page, setPage] = React.useState(0);
  const [q, setQ] = React.useState("");
  const heads = React.useMemo(() => _onbHeadliners(3), []);
  const finish = (festId) => {
    try { localStorage.setItem("onboarded", ONBOARD_VERSION); } catch {}
    if (festId && festId !== FESTIVAL_CONFIG.id) { setActiveFestivalAndReload(festId); return; }
    onDone();
  };
  const PAGES = [
    { title: "Plan the night.", body: "Save the sets you want and see what’s on now, next and at every stage.", preview: <OnbSchedulePreview /> },
    { title: "Know what you caught.", body: "Your photos and clips land on the artist, stage and time they happened.", preview: <OnbCardPreview artists={heads} count={1} /> },
    { title: "Keep the weekend.", body: "Every set you catch becomes a card for your recap.", preview: <OnbCardPreview artists={heads} count={3} /> },
  ];
  const story = page < 3;
  const cur = PAGES[Math.min(page, 2)];
  const term = q.trim().toLowerCase();
  const now = Date.now();
  const list = FESTIVALS_REGISTRY
    .filter(f => (f.config.endMs || 0) >= now)
    .sort((a, b) => (a.config.startMs || 0) - (b.config.startMs || 0))
    .filter(f => !term || `${f.config.name} ${f.config.location}`.toLowerCase().includes(term));
  const inputStyle = {
    width: "100%", height: 44, borderRadius: 14, border: "none", background: "var(--paper-2)",
    color: "var(--ink)", padding: "0 16px", fontSize: 16, outline: "none", fontFamily: "inherit",
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to Plursky" style={{
      position: "absolute", inset: 0, zIndex: 100, background: "var(--paper)", color: "var(--ink)",
      display: "flex", flexDirection: "column",
      paddingTop: "var(--top-pad, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)",
      animation: "fadeIn .25s",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 52, padding: "0 8px 0 20px" }}>
        <span style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{story ? `${page + 1} of 3` : "Almost there"}</span>
        {story && <button onClick={() => setPage(3)} style={{ ...fieldIconBtn, width: "auto", padding: "0 12px", color: "var(--text-2)", fontSize: 15, fontWeight: 500 }}>Skip</button>}
      </div>
      {story ? (
        <>
          <div key={page} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 20px 0", display: "flex", flexDirection: "column", justifyContent: "center", animation: "fadeIn .2s" }}>
            {cur.preview}
          </div>
          <div style={{ padding: "24px 20px 16px" }}>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: "41px", fontWeight: 700, letterSpacing: "-0.01em" }}>{cur.title}</h1>
            <p style={{ margin: "8px 0 24px", fontSize: 15, lineHeight: "21px", color: "var(--text-2)" }}>{cur.body}</p>
            <FieldButton onClick={() => setPage(p => Math.min(p + 1, 3))}>{page < 2 ? "Continue" : "Choose your festival"}</FieldButton>
          </div>
        </>
      ) : (
        <>
          <div style={{ padding: "0 20px 8px" }}>
            <h1 style={{ margin: "0 0 12px", fontSize: 28, lineHeight: "34px", fontWeight: 700 }}>Where are you raving?</h1>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search festivals" aria-label="Search festivals" style={inputStyle} />
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 20px" }}>
            {list.map(f => {
              const isActive = f.config.id === FESTIVAL_CONFIG.id;
              const locked = !f.available;
              return (
                <button key={f.config.id} disabled={locked} onClick={() => finish(f.config.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, minHeight: 72, padding: "8px 0",
                  background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
                  color: "var(--ink)", textAlign: "left", fontFamily: "inherit",
                  cursor: locked ? "default" : "pointer", opacity: locked ? 0.55 : 1,
                }}>
                  <FestivalThumb entry={f} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, lineHeight: "22px", fontWeight: 600 }}>{f.config.name}</div>
                    <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>{f.config.location} · {f.config.dates}</div>
                    {(isActive || locked) && (
                      <div style={{ marginTop: 2, fontSize: 13, lineHeight: "18px", fontWeight: 600, color: isActive ? "var(--signal)" : "var(--text-2)" }}>
                        {isActive ? "✓ Selected" : f.previewOnly ? "Early access" : "Soon"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {!list.length && <p style={{ padding: "24px 0", fontSize: 15, lineHeight: "21px", color: "var(--text-2)" }}>No festival by that name yet.</p>}
          </div>
          <div style={{ padding: "12px 20px 16px" }}>
            <FieldButton onClick={() => finish(null)}>Continue with {FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name}</FieldButton>
          </div>
        </>
      )}
    </div>
  );
}

// Personalize: name, Spotify and reminders, each asked with one sentence of
// why, only when the user opens it. Closing saves the name.
function PersonalizeSheet({ state, onClose }) {
  const [name, setName] = React.useState(() => { try { return localStorage.getItem("user_name") || ""; } catch { return ""; } });
  const { supported: notifSupported, perm: notifPerm, enable: enableNotifs } = useNotifications();
  const save = () => {
    try {
      if (name.trim()) {
        localStorage.setItem("user_name", name.trim());
        localStorage.setItem("plursky_display_name", name.trim());
      }
    } catch {}
    onClose();
  };
  const title = { fontSize: 17, lineHeight: "22px", fontWeight: 600 };
  const why = { margin: "2px 0 12px", fontSize: 15, lineHeight: "21px", color: "var(--text-2)" };
  const rule = <div style={{ height: 1, background: "var(--line)", margin: "20px 0" }} />;
  const done = (text) => <div style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--signal)" }}>✓ {text}</div>;
  return (
    <FieldSheet title="Personalize Plursky" onClose={save}>
      <label htmlFor="plursky-name" style={{ display: "block", ...title }}>Your name</label>
      <p style={why}>Shown on your Me tab.</p>
      <input id="plursky-name" value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" autoComplete="nickname" style={{
        width: "100%", height: 44, borderRadius: 14, border: "none", background: "var(--paper-2)",
        color: "var(--ink)", padding: "0 16px", fontSize: 16, outline: "none", fontFamily: "inherit",
      }} />
      {rule}
      <div style={title}>Spotify</div>
      <p style={why}>Marks the artists you already love across the lineup.</p>
      {state.spotifyConnected ? done("Connected") : <FieldButton kind="secondary" onClick={() => startSpotifyAuth()}>Connect Spotify</FieldButton>}
      {rule}
      <div style={title}>Set reminders</div>
      <p style={why}>{notifSupported ? "A heads-up 15 minutes before each saved set starts." : "This browser can’t send notifications. You can still set alarms from the Lineup."}</p>
      {notifSupported && (notifPerm === "granted" ? done("On") : <FieldButton kind="secondary" onClick={() => enableNotifs()}>Turn on reminders</FieldButton>)}
      <FieldButton onClick={save} style={{ marginTop: 24 }}>Done</FieldButton>
    </FieldSheet>
  );
}

const _FID = FESTIVAL_CONFIG.id;
const _SAVED_KEY = `${_FID}_saved_v1`;

// ── Global command-palette search ────────────────────────────
// Searches all ~200 artists by name, stage, genre, or day keyword.
// Lives in App so it overlays any tab without prop-drilling.
// `saved` is a REQUIRED prop, not an optional nicety. The empty-query branch
// below renders the user's lineup, and it read a bare `state` that has never
// existed in this scope — so opening search threw "ReferenceError: state is
// not defined" and blanked the whole app, every time, for every user.
// Defaulted to [] so a future call site that forgets it degrades to "no
// lineup yet" instead of taking the app down again.
function SearchModal({ onClose, onSelectArtist, saved = [] }) {
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef(null);

  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  // Global Escape — previously only the input's onKeyDown listened, so once
  // focus left the input (e.g. user scrolled the result list or tapped a
  // chip) Escape became a dead key and the modal got stuck open. Listening
  // on document fixes that.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const query = q.trim().toLowerCase();
  const DAY_MAP = { fri: 1, friday: 1, "day 1": 1, sat: 2, saturday: 2, "day 2": 2, sun: 3, sunday: 3, "day 3": 3 };
  const dayFilter = DAY_MAP[query];

  const results = query.length === 0 ? [] : activeLineup().filter(a => {
    if (dayFilter) return a.day === dayFilter;
    const stage = STAGES.find(s => s.id === a.stage);
    return (
      a.name.toLowerCase().includes(query) ||
      a.genre.toLowerCase().includes(query) ||
      (stage?.name || "").toLowerCase().includes(query) ||
      (stage?.short || "").toLowerCase().includes(query) ||
      (stage?.vibe || "").toLowerCase().includes(query) ||
      (["legend","legendary","sunrise","b2b"].includes(query) && isLegendary(a))
    );
  }).sort((a, b) => {
    const aStart = a.name.toLowerCase().startsWith(query);
    const bStart = b.name.toLowerCase().startsWith(query);
    if (aStart !== bStart) return aStart ? -1 : 1;
    if (a.day !== b.day) return a.day - b.day;
    return toNightMin(a.start) - toNightMin(b.start);
  });

  const QUICK = [
    { label: "★ Legendary / B2B", q: "legendary" },
    { label: "Sunrise sets",       q: "sunrise"   },
    { label: "Kinetic Field",      q: "kinetic"   },
    { label: "Tech House",         q: "tech house"},
    { label: "Techno",             q: "techno"    },
    { label: "Trance",             q: "trance"    },
    { label: "Friday",             q: "fri"       },
    { label: "Saturday",           q: "sat"       },
    { label: "Sunday",             q: "sun"       },
  ];

  const DAY_LABEL = { 1: "FRI", 2: "SAT", 3: "SUN" };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 80, background: "var(--paper)",
      display: "flex", flexDirection: "column",
      animation: "slideUp 0.2s ease-out",
    }}>
      {/* Input row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px 12px",
        borderBottom: "1px solid var(--line)",
        paddingTop: "calc(14px + env(safe-area-inset-top, 0px))",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M21 21 L16.65 16.65"/>
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Artist, stage, genre, day…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: "Geist, sans-serif", fontSize: 18, color: "var(--ink)",
          }}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results[0]) { onSelectArtist(results[0].id); onClose(); }
          }}
        />
        {q && (
          <button onClick={() => setQ("")} style={{
            background: "var(--paper-2)", border: "none", borderRadius: 99,
            width: 20, height: 20, color: "var(--muted)", fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }} aria-label="Clear">×</button>
        )}
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--ember-ink)",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.1, fontWeight: 700,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>CLOSE</button>
      </div>

      {/* Results / suggestions */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {query.length === 0 ? (
          <div style={{ padding: "14px 16px" }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--muted)", marginBottom: 10 }}>QUICK SEARCH</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {QUICK.map((t, qi) => (
                <button key={t.label} onClick={() => setQ(t.q)} style={{
                  background: "var(--paper-2)", border: "1px solid var(--line-2)",
                  borderRadius: 999, padding: "6px 14px", cursor: "pointer",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1, color: "var(--ink)",
                  fontWeight: 600, transition: "background 0.12s, border-color 0.12s",
                  animation: `springIn 0.3s ease-out ${qi * 25}ms both`,
                }}>{t.label}</button>
              ))}
            </div>
            {saved.length > 0 && (
              <>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--muted)", marginBottom: 8 }}>
                  YOUR LINEUP · {saved.length} SETS
                </div>
                {saved.slice(0, 6).map(id => {
                  const a = ARTISTS.find(x => x.id === id);
                  if (!a) return null;
                  const st = STAGES.find(s => s.id === a.stage);
                  return (
                    <button key={a.id} onClick={() => { onSelectArtist(a.id); onClose(); }} style={{
                      display: "flex", gap: 10, padding: "8px 0", width: "100%",
                      borderBottom: "1px solid var(--line)", background: "transparent",
                      cursor: "pointer", textAlign: "left", alignItems: "center",
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: 6, background: st?.color, boxShadow: `0 0 5px ${st?.color}66`, flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="serif" style={{ fontSize: 16, lineHeight: 1.1, color: "var(--ink)" }}>{a.name}</div>
                        <div className="mono" style={{ fontSize: 9, letterSpacing: 0.8, color: "var(--muted)", marginTop: 2 }}>
                          {st?.short} · DAY {a.day} · {fmt12(a.start)}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--ember-ink)" }}>★</span>
                    </button>
                  );
                })}
                {saved.length > 6 && (
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", padding: "8px 0", textAlign: "center" }}>
                    +{saved.length - 6} MORE
                  </div>
                )}
              </>
            )}
          </div>
        ) : results.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>🔍</div>
            <div className="serif" style={{ fontSize: 22, color: "var(--muted)", fontStyle: "italic" }}>No results</div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)", marginTop: 6 }}>TRY A STAGE NAME, GENRE, OR DAY</div>
          </div>
        ) : (
          <>
            <div className="mono" style={{ padding: "10px 16px 4px", fontSize: 9, letterSpacing: 1.5, color: "var(--muted)" }}>
              {results.length} RESULT{results.length !== 1 ? "S" : ""}
            </div>
            {results.map((a, ri) => {
              // stage is null when a lineup is published before stage assignments
              // (Escape Halloween 2026, III Points 2026). See UNPLACED_STAGE in data.jsx.
              const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
              const leg = isLegendary(a);
              return (
                <button key={a.id} onClick={() => { onSelectArtist(a.id); onClose(); }} style={{
                  display: "flex", gap: 10, padding: "10px 16px",
                  borderBottom: "1px solid var(--line)", width: "100%",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  alignItems: "center", border: "none", borderBottom: "1px solid var(--line)",
                  animation: ri < 12 ? `springIn 0.3s ease-out ${ri * 30}ms both` : undefined,
                }}>
                  <div style={{ width: 4, alignSelf: "stretch", background: stage?.color || "#8a8580", borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <span className="serif" style={{ fontSize: 20, lineHeight: 1.05, letterSpacing: -0.2 }}>{a.name}</span>
                      {leg && <span className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "#fbbf24", fontWeight: 800 }}>★ DON'T MISS</span>}
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 2, alignItems: "center" }}>
                      <span style={{ width: 6, height: 6, borderRadius: 6, background: stage.color, boxShadow: `0 0 5px ${stage.color}66`, flexShrink: 0 }}/>
                      <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: stage.color, fontWeight: 600, textTransform: "uppercase" }}>{stage.short}</span>
                      <span style={{ color: "var(--muted)" }}>·</span>
                      <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)" }}>{DAY_LABEL[a.day]} {fmt12(a.start)}–{fmt12(a.end)}</span>
                      <span style={{ color: "var(--muted)" }}>·</span>
                      <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", textTransform: "uppercase" }}>{a.genre}</span>
                    </div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18 L15 12 L9 6"/>
                  </svg>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── Lightweight global toast (anyone can call window.plurskyToast) ──
// Used by save/unsave heart-tap and other quick confirmations.
function ToastHost() {
  const [msg, setMsg] = React.useState(null);
  React.useEffect(() => {
    // window.plurskyToast(text, opts?) — opts: { actionLabel, onAction, duration }.
    // Text-only calls keep the old 1600ms quick-confirm behaviour; passing an
    // action turns it into an actionable toast (e.g. a 3s UNDO).
    window.plurskyToast = (text, opts = {}) => {
      setMsg(null);
      requestAnimationFrame(() => setMsg({ text, id: Date.now(), ...opts }));
      try { navigator.vibrate?.(15); } catch {}
    };
    return () => { delete window.plurskyToast; };
  }, []);
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.duration || 1600);
    return () => clearTimeout(t);
  }, [msg?.id]);
  if (!msg) return null;
  const hasAction = msg.actionLabel && typeof msg.onAction === "function";
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 80, zIndex: 95,
      display: "flex", justifyContent: "center", pointerEvents: "none", padding: "0 16px",
    }}>
      <div className="mono" role="status" aria-live="polite" style={{
        background: "var(--ink)", color: "var(--paper)",
        padding: hasAction ? "7px 7px 7px 16px" : "9px 16px", borderRadius: 999,
        fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        animation: "fadeIn .15s", display: "flex", alignItems: "center", gap: 12, maxWidth: "100%",
        pointerEvents: hasAction ? "auto" : "none",
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.text}</span>
        {hasAction && (
          <button onClick={() => { try { msg.onAction(); } catch {} setMsg(null); }} className="mono" style={{
            flexShrink: 0, background: "var(--paper)", color: "var(--ink)", border: "none",
            borderRadius: 999, padding: "6px 13px", cursor: "pointer",
            fontSize: 10, letterSpacing: 1.2, fontWeight: 800,
          }}>{msg.actionLabel}</button>
        )}
      </div>
    </div>
  );
}

function App() {
  // First-time visitors get the welcome wizard auto-fired (hybrid C):
  // the wizard collects name + offers Spotify/notifications, but every
  // step is skippable and the empty-state nudges on Home pick up the rest
  // for anyone who skips through.
  const [showOnboarding, setShowOnboarding] = React.useState(() => {
    try {
      return localStorage.getItem("onboarded") !== ONBOARD_VERSION;
    }
    catch { return false; }
  });
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [personalizeOpen, setPersonalizeOpen] = React.useState(false);
  // True while any full-screen overlay is mounted. The search FAB below hides
  // rather than trying to out-stack it — see useDeclareModal in chrome.jsx.
  const modalOpen = useModalOpen();
  React.useEffect(() => {
    window.plurskyOpenOnboarding = () => setShowOnboarding(true);
    window.plurskyOpenPersonalize = () => setPersonalizeOpen(true);
    return () => { delete window.plurskyOpenOnboarding; delete window.plurskyOpenPersonalize; };
  }, []);
  // Drain the outbox (queued crew messages from offline moments) on mount,
  // on reconnect, and every 30s. Idempotent — safe to call once at startup.
  React.useEffect(() => {
    try { sbOutboxInit?.(); } catch {}
  }, []);
  // Night-aware theme — shifts palette with the sky during the festival, unless
  // the user has pinned LIGHT or DARK. The resolver and the pref both live in
  // chrome.jsx (see resolveThemeClass / useThemeMode); this effect only owns the
  // recompute cadence, so AUTO still crosses 20:00 without a reload. Re-runs on
  // themeMode so tapping the segmented control repaints immediately.
  const { mode: themeMode } = useThemeMode();
  React.useEffect(() => {
    applyThemeClass();
    const id = setInterval(applyThemeClass, 60000);
    return () => clearInterval(id);
  }, [themeMode]);
  // Native Spotify OAuth handoff (v196). When the user finishes the
  // SafariViewController flow, the appUrlOpen listener in spotify.jsx
  // exchanges the code for a token and dispatches this event. Mirror it
  // into React state so the UI flips from "Connect Spotify" to "Connected"
  // without requiring a page reload.
  React.useEffect(() => {
    const onConnect = (e) => {
      if (e?.detail?.ok) {
        setState(s => ({
          ...s,
          spotifyConnected: true,
          spotifyProfile: (typeof getSpotifyProfileSync === "function" ? getSpotifyProfileSync() : null),
        }));
      }
    };
    window.addEventListener("plursky-spotify-connect", onConnect);
    return () => window.removeEventListener("plursky-spotify-connect", onConnect);
  }, []);
  const { perm: notifPerm, showLocal } = useNotifications();
  const [state, setState] = React.useState(() => {
    let saved;
    try {
      const raw = localStorage.getItem(_SAVED_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {}

    // Parse deep-link params: ?artist=ID, ?tab=map, ?stage=kinetic, ?day=1, ?lineup=k9,k11,c5
    const rawSearch = window.location.search || (window.location.hash?.startsWith("#?") ? window.location.hash.slice(1) : "");
    const params = new URLSearchParams(rawSearch);

    // ?f=<festival-id> (alias ?festival=) — the crawlable /f/<id>/ stubs link
    // here so a visitor lands on the festival they were just reading about.
    //
    // Guarded deliberately, because the naive version RELOADS FOREVER:
    // getActiveFestivalId() only honours a stored id when that festival is
    // `available`, so writing a GATED id and reloading leaves the active
    // festival unchanged while ?f= is still in the URL — and the next boot
    // switches again, forever. Four of seven registry entries are gated, so
    // this is the common case, not the edge case. Hence:
    //   1. only switch when the festival would actually stick — the same rule
    //      FestivalSwitcher applies (available, or previewOnly for Plus),
    //   2. only when it differs from the festival already active,
    //   3. strip the param BEFORE reloading, so even if 1 or 2 ever regress a
    //      reload cannot re-trigger this.
    const dlFest = params.get("f") || params.get("festival");
    if (dlFest && typeof FESTIVALS_REGISTRY !== "undefined") {
      const fEntry = FESTIVALS_REGISTRY.find(f => f.config.id === dlFest);
      const canSwitch = !!fEntry && (fEntry.available || (fEntry.previewOnly && window._isPlusSub?.()));
      if (canSwitch && dlFest !== FESTIVAL_CONFIG.id) {
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete("f");
          u.searchParams.delete("festival");
          if (u.hash.startsWith("#?")) {
            const h = new URLSearchParams(u.hash.slice(2));
            h.delete("f"); h.delete("festival");
            u.hash = h.toString() ? "#?" + h.toString() : "";
          }
          window.history.replaceState({}, "", u.toString());
        } catch {}
        setActiveFestivalAndReload(dlFest);
      }
    }

    const dlArtist = params.get("artist");
    const dlTab    = params.get("tab");
    const dlStage  = params.get("stage");
    const dlDay    = params.get("day");
    const dlLineup = params.get("lineup");
    const dlFrom   = params.get("from"); // optional friend name
    const dlCrew   = params.get("crew"); // crew code from a shared invite link
    const validArtist = dlArtist && ARTISTS.find(a => a.id === dlArtist) ? dlArtist : null;
    const validTab    = ["home","map","lineup","spotify","me","memories"].includes(dlTab) ? dlTab : null;
    const validStage  = dlStage && STAGES.find(s => s.id === dlStage || s.short.toLowerCase() === dlStage.toLowerCase()) ? dlStage : null;
    const validDay    = dlDay && festivalDayNums().includes(+dlDay) ? +dlDay : null;
    // Decode shared lineup: comma-joined IDs validated against the local lineup so
    // a stale or malicious URL can't inject phantom artists.
    const validFriendIds = dlLineup
      ? dlLineup.split(",").map(s => s.trim()).filter(id => ARTISTS.find(a => a.id === id))
      : [];
    const validFrom = (dlFrom || "").slice(0, 24).replace(/[^a-zA-Z0-9 _.-]/g, "") || null;
    // Crew codes are short alphanumerics — sanitise hard so a malformed link
    // can't poison the localStorage key that scopes our presence channel.
    const validCrew = (dlCrew || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || null;
    if (validCrew) {
      try { localStorage.setItem("plursky_group_code", validCrew); } catch {}
      // Flag for CrewCard mount to auto-join the broadcast channel — otherwise
      // a friend who opens the share link sets the code locally but never
      // subscribes, so neither side sees the other in the crew.
      try { localStorage.setItem("plursky_crew_autojoin", "1"); } catch {}
      // Migrate any active presence to the crew-scoped channel. Safe no-op if
      // the user hasn't joined presence yet — sbPresenceJoin will pick the
      // crew channel automatically the next time it's called.
      try { window.sbPresenceRefresh?.(); } catch {}
    }

    // Clean the URL without reloading (so back button / sharing still works)
    if (dlArtist || dlTab || dlStage || dlDay || dlLineup || dlFrom || dlCrew) {
      try { history.replaceState(null, "", window.location.pathname); } catch {}
    }

    return {
      // Crew deep-link without an explicit tab routes to Me so CrewCard mounts
      // and auto-joins (otherwise the friend never subscribes to broadcasts).
      tab:             (validStage ? "lineup" : validTab) || (validCrew ? "me" : "home"),
      saved:           saved ?? [],
      spotifyConnected: spotifyTokenValid(),
      artist:          validArtist,
      focusStage:      validStage || null,
      lineupDay:       validDay || NOW.day,
      friendLineup:    validFriendIds.length ? validFriendIds : null,
      friendName:      validFriendIds.length ? validFrom : null,
      _navStack:       [],
    };
  });

  React.useEffect(() => {
    try { localStorage.setItem(_SAVED_KEY, JSON.stringify(state.saved)); } catch {}
  }, [state.saved]);

  React.useEffect(() => {
    const applyUrlParams = (rawUrl) => {
      try {
        const u = new URL(rawUrl || "", "capacitor://localhost");
        const raw = u.search || (u.hash?.startsWith("#?") ? u.hash.slice(1) : "");
        const params = new URLSearchParams(raw);
        const tab = params.get("tab");
        if (["home","map","lineup","spotify","me","memories"].includes(tab)) {
          setState(prev => ({ ...prev, tab }));
          setShowOnboarding(false);
        }
      } catch {}
    };
    window.plurskyApplyUrlParams = applyUrlParams;
    let sub = null;
    try {
      const capApp = window.Capacitor?.Plugins?.App;
      if (capApp?.addListener) {
        Promise.resolve(capApp.addListener("appUrlOpen", ({ url }) => applyUrlParams(url))).then(s => { sub = s; }).catch(() => {});
      }
    } catch {}
    return () => { try { sub?.remove?.(); } catch {}; delete window.plurskyApplyUrlParams; };
  }, []);

  React.useEffect(() => {
    if (!state.saved.length) return;
    const id = setTimeout(async () => {
      try {
        const user = await window.sbGetUser?.();
        if (user) await window.sbPush?.(state.saved);
      } catch {}
    }, 3000);
    return () => clearTimeout(id);
  }, [state.saved.join(",")]);

  const _pushNav = React.useCallback((next) => {
    setState(prev => ({
      ...prev,
      ...next,
      _navStack: [...(prev._navStack || []).slice(-4), { tab: prev.tab, artist: prev.artist, focusStage: prev.focusStage }],
    }));
  }, []);

  const _popNav = React.useCallback(() => {
    setState(prev => {
      const stack = [...(prev._navStack || [])];
      const entry = stack.pop();
      if (!entry) return { ...prev, artist: null };
      return { ...prev, ...entry, _navStack: stack };
    });
  }, []);

  React.useEffect(() => {
    window._pushNav = _pushNav;
    window._popNav = _popNav;
  }, [_pushNav, _popNav]);

  // Auto-schedule push reminders whenever saves change (if permission already granted)
  React.useEffect(() => {
    if (notifPerm === "granted") scheduleReminders(state, showLocal);
  }, [state.saved.join(","), notifPerm]);

  // Cloud-backup auto-push: when the user is signed in to Supabase, push their
  // saved lineup + notes 1s after the most recent change. Silent — the cloud
  // card already shows sync status. When NOT signed in, fire a one-time toast
  // after the first save so users know cloud backup exists.
  React.useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      try {
        const user = window.sbGetUser ? await window.sbGetUser() : null;
        // The `!state.saved.length` early-return that used to sit here blocked
        // the PUSH as well as the nudge. Two things broke: a note-only or
        // moment-only user never synced at all, and un-saving your LAST artist
        // never propagated — the server kept the stale artist_ids forever. The
        // nudge toast still waits for a real save; the push no longer does.
        if (user && window.sbPush) {
          let notes = {};
          try { notes = JSON.parse(localStorage.getItem("artist_notes_v1") || "{}"); } catch {}
          await window.sbPush(state.saved, notes);
        } else if (state.saved.length) {
          const seen = (() => { try { return localStorage.getItem("cloud_nudge_seen") === "1"; } catch { return false; } })();
          if (!seen && typeof window.plurskyToast === "function") {
            try { localStorage.setItem("cloud_nudge_seen", "1"); } catch {}
            window.plurskyToast("Saved. Sign in on Me tab to back up.");
          }
        }
      } catch {}
    }, 1000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [state.saved.join(",")]);

  let body;
  if (state.artist) body = <ArtistScreen state={state} setState={setState} />;
  else if (state.tab === "home")     body = <HomeScreen     state={state} setState={setState} />;
  else if (state.tab === "map")      body = <MapScreen      state={state} setState={setState} />;
  else if (state.tab === "lineup")   body = <LineupScreen   state={state} setState={setState} />;
  else if (state.tab === "spotify")  body = <SpotifyScreen  state={state} setState={setState} />;
  else if (state.tab === "memories") body = <MemoriesScreen state={state} setState={setState} />;
  else if (state.tab === "recap")    body = <RecapScreen    state={state} setState={setState} />;
  else if (state.tab === "me")       body = <MeScreen       state={state} setState={setState} />;

  // status bar tint — dark pane on map, light elsewhere
  const statusBarStyle = state.tab === "map" && !state.artist ? "light" : "dark";

  return (
    <IOSDevice dark={statusBarStyle === "light"}>
      {/* Field Mode Home runs its hero under the safe area and carries its
          own live/offline status, so it skips the top inset and the strip. */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", paddingTop: state.tab === "home" && !state.artist ? 0 : "var(--top-pad, 54px)" }}>
        {!(state.tab === "home" && !state.artist) && <StatusStrip />}
        <div style={{ flex: 1, position: "relative" }}>
          {body}
          {/* Search FAB — floats above TabBar, accessible from any screen.
              Labeled pill so first-time users actually notice it. */}
          {/* Not on the lineup GRID: its own search is one upward scroll away,
              and the pill covered set cards there (#116). */}
          {!state.artist && !searchOpen && state.tab !== "map" && !modalOpen && !(state.tab === "lineup" && state.lineupGrid) && (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search artists, stages, genres"
              style={{
                // Field Mode: quiet translucent chrome, not a bright pill.
                position: "absolute", bottom: 16, right: 16, zIndex: 30,
                height: 48, borderRadius: 24, padding: "0 18px 0 14px",
                background: "var(--chrome)", color: "var(--ink)",
                backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)",
                border: "1px solid var(--line-2)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 15, lineHeight: "20px", fontWeight: 600,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><path d="M21 21 L16.65 16.65"/>
              </svg>
              Search
            </button>
          )}
          <ToastHost />
        </div>
        {!state.artist && (() => {
          const postFest = (() => { try { return Date.now() > (FESTIVAL_CONFIG?.endMs || Infinity); } catch { return false; } })();
          // Post-festival the Memories tab is in the bar, so "memories" maps
          // to itself; pre-festival it folds into Me (where its card lives).
          const meFold = postFest ? ["spotify", "recap"] : ["spotify", "memories", "recap"];
          return (
            <TabBar
              active={meFold.includes(state.tab) ? "me" : state.tab}
              onChange={t => setState({ ...state, tab: t })}
            />
          );
        })()}
      </div>
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onSelectArtist={(id) => setState({ ...state, artist: id })}
          saved={state.saved || []}
        />
      )}
      {showOnboarding && (
        <OnboardingModal
          state={state}
          setState={setState}
          onDone={() => setShowOnboarding(false)}
        />
      )}
      {personalizeOpen && <PersonalizeSheet state={state} onClose={() => setPersonalizeOpen(false)} />}
      {window.NowPlayingBar && React.createElement(window.NowPlayingBar)}
      <BatterySaverToast />
    </IOSDevice>
  );
}

// Keyframes
const styleTag = document.createElement("style");
styleTag.textContent = `
  @keyframes pulse  { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes tdot   { 0%,60%,100% { transform: translateY(0); opacity: 0.4 } 30% { transform: translateY(-5px); opacity: 1 } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  /* Lineup highlight-on-arrival — flashes the card/grid block the user
     just navigated to from the ArtistScreen "SCHEDULE" handoff. */
  @keyframes lineupFlash {
    0%   { box-shadow: 0 0 0 0   rgba(232,93,46,0.55), inset 0 0 0 2px var(--ember); background-color: rgba(232,93,46,0.16); }
    60%  { box-shadow: 0 0 0 10px rgba(232,93,46,0),    inset 0 0 0 2px var(--ember); background-color: rgba(232,93,46,0.10); }
    100% { box-shadow: 0 0 0 0   rgba(232,93,46,0),    inset 0 0 0 0 rgba(232,93,46,0); background-color: transparent; }
  }
  /* Iso-mode sprite bob — bounces along the post-rotation Y axis so the
     character feels alive when standing on the tilted ground plane. */
  @keyframes isoBob { 0%,100% { translate: 0 0; } 50% { translate: 0 -6px; } }
  @keyframes isoShadowPulse { 0%,100% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; } 50% { transform: translate(-50%, -50%) scale(0.82); opacity: 0.35; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  button:active { opacity: 0.75; }
  @keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
`;
document.head.appendChild(styleTag);

function CelebrationOverlay() {
  const [particles, setParticles] = React.useState([]);
  React.useEffect(() => {
    window._plurskyCelebrate = () => {
      const colors = ["#e85d2e", "#f59a36", "#fbbf24", "#7b3d9a", "#38bdf8", "#22c55e", "#ec4899", "#fff"];
      const p = Array.from({ length: 36 }, (_, i) => ({
        id: Date.now() + i,
        x: 10 + Math.random() * 80,
        size: 4 + Math.random() * 6,
        color: colors[i % colors.length],
        dur: 1.2 + Math.random() * 1.5,
        delay: Math.random() * 0.4,
        shape: i % 3,
      }));
      setParticles(p);
      navigator.vibrate?.([15, 50, 15, 50, 30]);
      setTimeout(() => setParticles([]), 3000);
    };
    return () => { delete window._plurskyCelebrate; };
  }, []);
  if (!particles.length) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: -10,
          width: p.size, height: p.shape === 2 ? p.size * 1.6 : p.size,
          borderRadius: p.shape === 0 ? "50%" : p.shape === 1 ? "2px" : 0,
          background: p.color,
          transform: p.shape === 2 ? "rotate(45deg)" : undefined,
          animation: `confetti-fall ${p.dur}s ease-in ${p.delay}s forwards`,
        }}/>
      ))}
    </div>
  );
}

// Top-level error boundary. Without one, a single component throw blanks the
// whole app — at a festival with bad LTE that's a user we never get back.
// We show a recovery card with a "Reload" button (clears caches first so a
// hot-fixed deploy actually replaces the bad version on next boot).
class RootErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    // No analytics endpoint to phone home to; persist the last crash locally
    // so we can read it out of the user's tab via DevTools if they report it.
    try {
      localStorage.setItem("plursky_last_crash", JSON.stringify({
        message: err?.message || String(err),
        stack:   err?.stack?.slice(0, 4000) || null,
        compStack: info?.componentStack?.slice(0, 2000) || null,
        ts: new Date().toISOString(),
        version: "v319",
      }));
    } catch {}
  }
  reload = () => {
    // Drop SW caches before reload so the user always gets the freshest deploy
    // — if the crash was caused by a stale chunk the cache-bust unsticks them.
    const go = () => { try { window.location.reload(); } catch {} };
    if ("caches" in window) {
      caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(go, go);
    } else go();
  };
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "40px 24px",
        background: "#f7ede0", color: "#1a120d", fontFamily: "Geist, system-ui, sans-serif",
        textAlign: "center",
      }}>
        <div style={{ fontFamily: "Instrument Serif, serif", fontSize: 36, marginBottom: 6 }}>
          Something glitched.
        </div>
        <div style={{ fontSize: 14, color: "rgba(26,18,13,0.65)", marginBottom: 22, maxWidth: 340, lineHeight: 1.5 }}>
          Plursky hit an unexpected error. Your saved lineup is safe — reloading should fix it.
        </div>
        <button onClick={this.reload} style={{
          background: "#1a120d", color: "#f7ede0", border: "none",
          borderRadius: 12, padding: "12px 22px", cursor: "pointer",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
        }}>RELOAD</button>
        <div style={{ marginTop: 22, fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, color: "rgba(26,18,13,0.45)" }}>
          PLURSKY · v319
        </div>
      </div>
    );
  }
}

function SetStartingCinematic() {
  const [show, setShow] = React.useState(null);
  const shownRef = React.useRef(new Set());
  React.useEffect(() => {
    const check = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(`${FESTIVAL_CONFIG.id}_saved_v1`) || "[]");
        // Only on a real festival night: NOW.day names a day before the
        // festival too, and fired this a week early at the matching clock time.
        if (!saved.length || !NOW.time || NOW.night == null) return;
        const nowMin = toNightMin(NOW.time);
        for (const id of saved) {
          const a = activeLineup().find(x => x.id === id);
          if (!a || a.day !== NOW.night) continue;
          const startMin = toNightMin(a.start);
          const diff = startMin - nowMin;
          if (diff > 0 && diff <= 3 && !shownRef.current.has(a.id)) {
            shownRef.current.add(a.id);
            const stage = STAGES.find(s => s.id === a.stage);
            setShow({ artist: a, stage, minsLeft: diff });
            navigator.vibrate?.([30, 50, 30, 50, 60]);
            setTimeout(() => setShow(null), 6000);
            return;
          }
        }
      } catch {}
    };
    const id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  }, []);
  if (!show) return null;
  const { artist: a, stage, minsLeft } = show;
  const vfx = _genreToVfx(a.genre);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9998,
      background: "rgba(13,8,4,0.92)", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.5s ease-out",
      backdropFilter: "blur(12px)",
    }} onClick={() => setShow(null)}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.15,
        background: `radial-gradient(ellipse at 50% 40%, ${stage?.color || "var(--ember)"}, transparent 70%)`,
        animation: "vfx-pulse 2s ease-in-out infinite",
      }}/>
      <div style={{ position: "relative", textAlign: "center", padding: "0 32px" }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: 3, color: stage?.color || "var(--ember-ink)", fontWeight: 800, marginBottom: 12,
          animation: "vfx-pulse 1.5s ease-in-out infinite",
        }}>SET STARTING</div>
        <div className="serif" style={{
          fontSize: 42, lineHeight: 0.95, letterSpacing: -1, marginBottom: 8,
          textShadow: `0 0 40px ${stage?.color || "var(--ember)"}55`,
        }}>{a.name}</div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: stage?.color || "#fff", marginBottom: 24 }}>
          {stage?.name?.toUpperCase() || ""} · {fmt12(a.start)}
        </div>
        <div style={{
          fontFamily: "Geist Mono, monospace", fontSize: 52, fontWeight: 200,
          letterSpacing: 2, fontVariantNumeric: "tabular-nums",
          color: "#fff", textShadow: `0 0 30px ${stage?.color || "var(--ember)"}`,
        }}>{minsLeft} MIN</div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.6, color: "rgba(255,255,255,0.4)", marginTop: 20 }}>
          TAP TO DISMISS
        </div>
      </div>
    </div>
  );
}

// #116: pin the document (index.html .app-live) and put back a page the iOS
// keyboard left panned after it closes — the app never scrolls the document
// itself, so any offset left behind is a gap below the tab bar.
document.documentElement.classList.add("app-live");
document.addEventListener("focusout", () => {
  setTimeout(() => { if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0); }, 60);
});
ReactDOM.createRoot(document.getElementById("root")).render(
  <RootErrorBoundary><App /><CelebrationOverlay /><SetStartingCinematic /></RootErrorBoundary>
);

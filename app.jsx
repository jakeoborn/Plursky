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
function OnboardingModal({ onDone, setState, state }) {
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState(() => {
    try { return localStorage.getItem("user_name") || ""; } catch { return ""; }
  });
  const { supported: notifSupported, perm: notifPerm, enable: enableNotifs } = useNotifications();

  const finish = () => {
    try {
      localStorage.setItem("onboarded", ONBOARD_VERSION);
      if (name.trim()) {
        localStorage.setItem("user_name", name.trim());
        localStorage.setItem("plursky_display_name", name.trim());
      }
    } catch {}
    onDone();
  };
  const next = () => setStep(s => s + 1);

  const STEPS = [
    {
      kicker: "WELCOME",
      title: <>Welcome to <span style={{ fontStyle: "italic", color: "var(--ember)" }}>Plursky</span></>,
      body: `${ARTISTS.length} artists across ${STAGES.length} stages. Live map, walking ETAs, conflict detection, crew meetups, and set reminders — all offline. Built for ${FESTIVAL_CONFIG.name || "the festival"}.`,
      preview: (
        <>
          {/* VFX hero showcase — 3-second animated preview of the festival atmosphere */}
          <div style={{
            margin: "12px -22px 0", borderRadius: 14, overflow: "hidden",
            height: 120, position: "relative",
            background: "linear-gradient(160deg, #1a1030 0%, #2a1a3d 50%, #1a120d 100%)",
          }}>
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
              {Array.from({ length: 14 }, (_, i) => {
                const colors = STAGES.slice(0, 5).map(s => s.color);
                const c = colors[i % colors.length];
                return React.createElement("div", { key: i, style: {
                  position: "absolute",
                  left: `${(i * 37 + 13) % 100}%`,
                  bottom: i % 3 === 0 ? 0 : undefined,
                  top: i % 3 !== 0 ? `${(i * 53 + 7) % 100}%` : undefined,
                  width: i % 3 === 2 ? 10 + (i % 3) * 6 : 3 + (i % 3) * 2,
                  height: i % 3 === 2 ? 10 + (i % 3) * 6 : 3 + (i % 3) * 2,
                  borderRadius: "50%", background: c,
                  filter: i % 3 === 2 ? `blur(${6}px)` : "none",
                  opacity: 0,
                  animation: `${i % 3 === 0 ? "vfx-rise" : i % 3 === 2 ? "vfx-drift" : "vfx-fall"} ${3 + (i % 4)}s ease-in-out ${(i * 0.4) % 4}s infinite`,
                }});
              })}
            </div>
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(0deg, rgba(26,16,48,0.9) 0%, transparent 100%)",
              padding: "24px 16px 10px",
            }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.8, color: "var(--ember)", fontWeight: 800 }}>
                SEE WHAT PLURSKY LOOKS LIKE AT THE FESTIVAL
              </div>
            </div>
          </div>
          {/* Stage chips */}
          <div style={{
            display: "flex", gap: 6, overflowX: "auto", margin: "10px -22px 0", padding: "0 22px",
            scrollbarWidth: "none",
          }}>
            {STAGES.slice(0, 5).map(s => (
              <div key={s.id} style={{
                flexShrink: 0, width: 80, padding: "8px 6px",
                background: `${s.color}14`, border: `1px solid ${s.color}44`,
                borderRadius: 10, textAlign: "center",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 28, background: s.color,
                  margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 12px ${s.color}44`,
                }}>
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 800 }}>{ARTISTS.filter(a => a.stage === s.id).length}</span>
                </div>
                <div className="mono" style={{ fontSize: 8, letterSpacing: 0.8, color: "var(--ink)", fontWeight: 700 }}>{s.short}</div>
              </div>
            ))}
          </div>
        </>
      ),
      input: (
        <input
          type="text"
          placeholder="What should we call you?"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          style={{
            width: "100%", padding: "12px 14px", marginTop: 12,
            background: "var(--paper-2)", border: "1px solid var(--line-2)",
            borderRadius: 12, fontFamily: "Geist, sans-serif", fontSize: 14,
            color: "var(--ink)", outline: "none",
          }}/>
      ),
      cta: { label: name.trim() ? `CONTINUE AS ${name.trim().toUpperCase()}` : "CONTINUE", onClick: next },
    },
    {
      kicker: "STEP 2 OF 3",
      title: <>Match the <span style={{ fontStyle: "italic", color: "var(--ember)" }}>lineup</span> to your Spotify</>,
      body: "Connect Spotify and we'll mark every artist you already love across all 175 sets, plus surface deep-cut discoveries you don't know yet.",
      cta: state.spotifyConnected
        ? { label: "✓ ALREADY CONNECTED — CONTINUE", onClick: next }
        : { label: "CONNECT SPOTIFY", onClick: () => startSpotifyAuth() },
      skip: { label: "SKIP", onClick: next },
    },
    {
      kicker: "STEP 3 OF 3",
      title: <>Reminders before each <span style={{ fontStyle: "italic", color: "var(--ember)" }}>set</span></>,
      body: notifSupported
        ? `Get a push 15 minutes before any saved set starts — including the sunrise sets at ${STAGES.find(s => s.id === FESTIVAL_CONFIG.mainStageId)?.name || "the main stage"}. We don't track you, no account needed.`
        : "Push notifications aren't supported in this browser. You can still set custom alarms from the Lineup page.",
      cta: !notifSupported
        ? { label: "GOT IT", onClick: finish }
        : notifPerm === "granted"
          ? { label: "✓ ENABLED — FINISH", onClick: finish }
          : { label: "ENABLE NOTIFICATIONS", onClick: async () => { await enableNotifs(); finish(); } },
      skip: notifSupported && notifPerm !== "granted" ? { label: "MAYBE LATER", onClick: finish } : null,
    },
  ];

  const cur = STEPS[step];

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: "rgba(13,8,4,0.55)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-end", animation: "fadeIn .25s",
    }}>
      <div style={{
        background: "var(--paper)", color: "var(--ink)",
        borderTopLeftRadius: 26, borderTopRightRadius: 26,
        width: "100%", padding: "16px 22px 26px",
        boxShadow: "0 -16px 50px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 38, height: 4, borderRadius: 4, background: "var(--line-2)" }}/>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: i <= step ? "var(--ember)" : "var(--line)",
              transition: "background .2s",
            }}/>
          ))}
        </div>

        <div key={step} style={{ animation: "slideUp 0.25s ease-out" }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, color: "var(--muted)", marginBottom: 6, fontWeight: 600 }}>
          {cur.kicker}
        </div>
        <div className="serif" style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: -0.4, marginBottom: 12 }}>
          {cur.title}
        </div>
        <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, marginBottom: 18 }}>
          {cur.body}
        </div>

        {cur.preview}
        {cur.input}

        <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
          <button onClick={cur.cta.onClick} style={{
            background: "var(--ink)", color: "var(--paper)", border: "none",
            borderRadius: 999, padding: "13px 18px",
            fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer",
          }}>{cur.cta.label}</button>
          {cur.skip && (
            <button onClick={cur.skip.onClick} style={{
              background: "transparent", color: "var(--muted)", border: "none",
              padding: "8px 12px",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
              cursor: "pointer",
            }}>{cur.skip.label}</button>
          )}
        </div>
        </div>{/* close step animation wrapper */}
      </div>
    </div>
  );
}

const _FID = FESTIVAL_CONFIG.id;
const _SAVED_KEY = `${_FID}_saved_v1`;

// ── Global command-palette search ────────────────────────────
// Searches all ~200 artists by name, stage, genre, or day keyword.
// Lives in App so it overlays any tab without prop-drilling.
function SearchModal({ onClose, onSelectArtist }) {
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

  const results = query.length === 0 ? [] : ARTISTS.filter(a => {
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
          }}>×</button>
        )}
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--ember)",
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
            {state.saved.length > 0 && (
              <>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--muted)", marginBottom: 8 }}>
                  YOUR LINEUP · {state.saved.length} SETS
                </div>
                {state.saved.slice(0, 6).map(id => {
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
                      <span style={{ fontSize: 10, color: "var(--ember)" }}>★</span>
                    </button>
                  );
                })}
                {state.saved.length > 6 && (
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", padding: "8px 0", textAlign: "center" }}>
                    +{state.saved.length - 6} MORE
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
              const stage = STAGES.find(s => s.id === a.stage);
              const leg = isLegendary(a);
              return (
                <button key={a.id} onClick={() => { onSelectArtist(a.id); onClose(); }} style={{
                  display: "flex", gap: 10, padding: "10px 16px",
                  borderBottom: "1px solid var(--line)", width: "100%",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  alignItems: "center", border: "none", borderBottom: "1px solid var(--line)",
                  animation: ri < 12 ? `springIn 0.3s ease-out ${ri * 30}ms both` : undefined,
                }}>
                  <div style={{ width: 4, alignSelf: "stretch", background: stage.color, borderRadius: 3, flexShrink: 0 }} />
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
    window.plurskyToast = (text) => {
      setMsg(null);
      requestAnimationFrame(() => setMsg({ text, id: Date.now() }));
      try { navigator.vibrate?.(15); } catch {}
    };
    return () => { delete window.plurskyToast; };
  }, []);
  React.useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1600);
    return () => clearTimeout(t);
  }, [msg?.id]);
  if (!msg) return null;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 80, zIndex: 95,
      display: "flex", justifyContent: "center", pointerEvents: "none",
    }}>
      <div className="mono" style={{
        background: "var(--ink)", color: "var(--paper)",
        padding: "9px 16px", borderRadius: 999,
        fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
        animation: "fadeIn .15s",
      }}>{msg.text}</div>
    </div>
  );
}

function App() {
  // First-time visitors get the welcome wizard auto-fired (hybrid C):
  // the wizard collects name + offers Spotify/notifications, but every
  // step is skippable and the empty-state nudges on Home pick up the rest
  // for anyone who skips through.
  const [showOnboarding, setShowOnboarding] = React.useState(() => {
    try { return localStorage.getItem("onboarded") !== ONBOARD_VERSION; }
    catch { return false; }
  });
  const [searchOpen, setSearchOpen] = React.useState(false);
  React.useEffect(() => {
    window.plurskyOpenOnboarding = () => setShowOnboarding(true);
    return () => { delete window.plurskyOpenOnboarding; };
  }, []);
  // Drain the outbox (queued crew messages from offline moments) on mount,
  // on reconnect, and every 30s. Idempotent — safe to call once at startup.
  React.useEffect(() => {
    try { sbOutboxInit?.(); } catch {}
  }, []);
  // Night-aware theme — shifts palette with the sky during the festival.
  React.useEffect(() => {
    const update = () => {
      const now = Date.now();
      if (now < FESTIVAL_CONFIG.startMs || now > FESTIVAL_CONFIG.endMs) {
        document.documentElement.className = "";
        return;
      }
      const h = new Date().getHours();
      const theme = h >= 20 || h < 4 ? "theme-night" : h >= 4 && h < 7 ? "theme-dawn" : h >= 17 && h < 20 ? "theme-sunset" : "";
      document.documentElement.className = theme;
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  // Native Spotify OAuth handoff (v166). When the user finishes the
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
    const params = new URLSearchParams(window.location.search);
    const dlArtist = params.get("artist");
    const dlTab    = params.get("tab");
    const dlStage  = params.get("stage");
    const dlDay    = params.get("day");
    const dlLineup = params.get("lineup");
    const dlFrom   = params.get("from"); // optional friend name
    const dlCrew   = params.get("crew"); // crew code from a shared invite link
    const validArtist = dlArtist && ARTISTS.find(a => a.id === dlArtist) ? dlArtist : null;
    const validTab    = ["home","map","lineup","spotify","me"].includes(dlTab) ? dlTab : null;
    const validStage  = dlStage && STAGES.find(s => s.id === dlStage || s.short.toLowerCase() === dlStage.toLowerCase()) ? dlStage : null;
    const validDay    = dlDay && [1,2,3].includes(+dlDay) ? +dlDay : null;
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
    if (!state.saved.length) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      try {
        const user = window.sbGetUser ? await window.sbGetUser() : null;
        if (user && window.sbPush) {
          let notes = {};
          try { notes = JSON.parse(localStorage.getItem("artist_notes_v1") || "{}"); } catch {}
          await window.sbPush(state.saved, notes);
        } else {
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
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", paddingTop: "var(--top-pad, 54px)" }}>
        <StatusStrip />
        <div style={{ flex: 1, position: "relative" }}>
          {body}
          {/* Search FAB — floats above TabBar, accessible from any screen.
              Labeled pill so first-time users actually notice it. */}
          {!state.artist && !searchOpen && state.tab !== "map" && (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search artists, stages, genres"
              style={{
                position: "absolute", bottom: 16, right: 16, zIndex: 30,
                height: 42, borderRadius: 999, padding: "0 16px 0 12px",
                background: "var(--ink)", color: "var(--paper)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7"/><path d="M21 21 L16.65 16.65"/>
              </svg>
              SEARCH
            </button>
          )}
          <ToastHost />
        </div>
        {!state.artist && (
          <TabBar
            active={["spotify", "memories", "recap"].includes(state.tab) ? "me" : state.tab}
            onChange={t => setState({ ...state, tab: t })}
          />
        )}
      </div>
      {searchOpen && (
        <SearchModal
          onClose={() => setSearchOpen(false)}
          onSelectArtist={(id) => setState({ ...state, artist: id })}
        />
      )}
      {showOnboarding && (
        <OnboardingModal
          state={state}
          setState={setState}
          onDone={() => setShowOnboarding(false)}
        />
      )}
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
        version: "v166",
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
          PLURSKY · v166
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
        if (!saved.length || !NOW.time || !NOW.day) return;
        const nowMin = toNightMin(NOW.time);
        for (const id of saved) {
          const a = ARTISTS.find(x => x.id === id);
          if (!a || a.day !== NOW.day) continue;
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
          fontSize: 10, letterSpacing: 3, color: stage?.color || "var(--ember)", fontWeight: 800, marginBottom: 12,
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <RootErrorBoundary><App /><CelebrationOverlay /><SetStartingCinematic /></RootErrorBoundary>
);

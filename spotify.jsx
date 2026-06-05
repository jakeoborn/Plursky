// Spotify / Music + Me screens


// ── SPOTIFY SCREEN ────────────────────────────────────────────
function SpotifyScreen({ state, setState }) {
  const connected = state.spotifyConnected;
  const [spotifyArtists,  setSpotifyArtists]  = React.useState(null);
  const [tokenBad,        setTokenBad]        = React.useState(false);
  const [saveFlash,         setSaveFlash]         = React.useState(false);
  const [playlistCount,     setPlaylistCount]     = React.useState(null);
  const [playlistScanFailed, setPlaylistScanFailed] = React.useState(false);
  const [showAllArtists,  setShowAllArtists]  = React.useState(false);
  const [scanProgress,    setScanProgress]    = React.useState("");

  // Apple Music state
  const [amConnected, setAmConnected] = React.useState(() => !!localStorage.getItem("am_user_token"));
  const [amArtists,   setAmArtists]   = React.useState(null);
  const [amLoading,   setAmLoading]   = React.useState(false);
  const [amError,     setAmError]     = React.useState("");

  React.useEffect(() => {
    if (!connected) { setSpotifyArtists([]); setPlaylistCount(null); setPlaylistScanFailed(false); setScanProgress(""); return; }
    fetchSpotifyTopArtists((msg) => setScanProgress(msg)).then(artists => {
      setScanProgress("");
      if (artists === null) { setTokenBad(true); setState({ ...state, spotifyConnected: false }); }
      else {
        setSpotifyArtists(artists);
        setPlaylistCount(artists._playlistCount ?? null);
        setPlaylistScanFailed(artists._playlistScanOk === false);
        try {
          const ids = matchLineupArtists(artists).map(a => a._realId || a.id);
          localStorage.setItem('spotify_matched_ids_v1', JSON.stringify(ids));
        } catch {}
      }
    });
  }, [connected]);

  React.useEffect(() => {
    if (!amConnected) { setAmArtists(null); return; }
    fetchAppleMusicArtists().then(artists => {
      if (artists === null) { setAmConnected(false); }
      else setAmArtists(artists);
    });
  }, [amConnected]);

  const handleAmConnect = async () => {
    if (!APPLE_DEV_TOKEN) return;
    setAmLoading(true); setAmError("");
    const result = await connectAppleMusic();
    setAmLoading(false);
    if (result.ok) { setAmConnected(true); }
    else setAmError(result.error || "Connection failed");
  };

  const handleAmDisconnect = () => {
    disconnectAppleMusic();
    setAmConnected(false);
    setAmArtists(null);
  };

  const amMatched = amArtists ? matchLineupArtists(amArtists) : [];

  const matched  = matchLineupArtists(spotifyArtists);
  const { topGenres, stageRecs } = spotifyArtists?.length
    ? analyzeGenres(spotifyArtists)
    : { topGenres: [], stageRecs: [] };
  const maxCount    = topGenres[0]?.count || 1;
  const discoveries = spotifyArtists?.length
    ? getDiscoveries(spotifyArtists, matched, state.saved, 8)
    : [];
  const fallback    = ARTISTS.filter(a => a.tier === 3).slice(0, 8);
  const recs        = matched.length ? matched : fallback;

  // Check if this connection was made after scope-recording was introduced (v54).
  // Old connections have no record → private playlists may have been silently skipped.
  const noScopeRecord = (() => { try { return !localStorage.getItem("spotify_auth_scopes"); } catch { return false; } })();
  // Tokens granted before user-follow-read was added to SPOTIFY_SCOPES can't fetch
  // followed artists — Layton Giordani / Sofi Tukker etc. get missed if user only follows them.
  const missingFollowScope = (() => {
    try { const s = localStorage.getItem("spotify_auth_scopes") || ""; return s !== "" && !s.includes("user-follow-read"); }
    catch { return false; }
  })();

  const handleSaveAll = () => {
    const newSaved = [...new Set([...state.saved, ...matched.map(a => a._realId || a.id)])];
    setState({ ...state, saved: newSaved });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2200);
  };

  return (
    <Screen bg="var(--paper)">
      <div style={{ padding: "8px 20px" }}>
        <TopBar title={<span>Music</span>} sub="SOUNDTRACK" tight />
      </div>

      <ScrollBody style={{ padding: "10px 20px 94px" }}>

        {/* Native-iOS Spotify fallback hint (v132). On the App Store binary
            before the @capacitor/browser OAuth path landed, Spotify connect
            failed silently because the redirect went to a different origin.
            Even with the fix in place, surfacing a "Safari also works" hint
            gives users a path forward if the in-app SafariViewController
            misbehaves. */}
        {!connected && _isNativeApp() && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px", marginBottom: 14,
            background: "rgba(232,93,46,0.10)",
            border: "1px solid rgba(232,93,46,0.35)",
            borderRadius: 12,
          }}>
            <span aria-hidden style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.45 }}>
              If Spotify sign-in stalls, open <strong>plursky.com</strong> in mobile Safari — it works there reliably and your saved sets sync if you signed in with Apple on Me.
            </div>
          </div>
        )}

        {/* ── Connect card ───────────────────────────────── */}
        <div style={{
          borderRadius: 20, padding: 20,
          background: connected ? "#1a3d2b" : "var(--ink)",
          color: "var(--paper)", marginBottom: 20,
          position: "relative", overflow: "hidden",
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" style={{ position: "absolute", top: 16, right: 16 }}>
            <circle cx="12" cy="12" r="11" fill="#1DB954"/>
            <path d="M6 10 Q12 8 18 11" stroke="#000" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
            <path d="M7 13 Q12 11.5 17 14" stroke="#000" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
            <path d="M8 15.8 Q12 14.5 16 16.5" stroke="#000" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          </svg>

          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, opacity: 0.65, marginBottom: 8 }}>
            {connected ? "CONNECTED" : "CONNECT SPOTIFY"}
          </div>
          <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10, maxWidth: "78%" }}>
            {connected
              ? <>Your lineup is <span style={{ fontStyle: "italic" }}>personalised</span></>
              : <>Build your <span style={{ fontStyle: "italic" }}>perfect</span> festival night</>}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.55, marginBottom: connected && spotifyArtists !== null && (playlistScanFailed || noScopeRecord) ? 8 : 16, maxWidth: "88%" }}>
            {connected
              ? matched.length
                ? `${matched.length} artists match · scanned top, recent, liked songs${playlistCount > 0 ? ` + ${playlistCount} playlist${playlistCount === 1 ? "" : "s"}` : ""}.`
                : spotifyArtists === null ? "Loading your taste…" : "No direct matches — showing genre-based picks below."
              : "Link Spotify to see your matches, genre breakdown, and play 30-sec previews on any artist."}
          </div>

          {connected && spotifyArtists !== null && (playlistScanFailed || noScopeRecord || missingFollowScope) && (
            <button
              onClick={() => { disconnectSpotify(setState, state); startSpotifyAuth(); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                fontSize: 13, lineHeight: 1.5, marginBottom: 14,
                background: "rgba(245,154,54,0.18)", border: "1px solid rgba(245,154,54,0.4)",
                borderRadius: 8, padding: "8px 10px", color: "#fde68a",
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {missingFollowScope
                ? "↻ Reconnect Spotify — your current session can't see followed artists. Layton Giordani, Sofi Tukker and others you follow won't be matched until you reconnect."
                : noScopeRecord && !playlistScanFailed
                  ? "↻ Reconnect Spotify to unlock full playlist scanning — artists in private playlists may be missing."
                  : "↻ Your playlists weren't scanned. Tap to reconnect Spotify with full access — this fixes missing artists like those in private playlists."}
            </button>
          )}

          {tokenBad && (
            <div style={{ fontSize: 13, color: "#f87171", marginBottom: 10, letterSpacing: 0.8 }}>
              Session expired — please reconnect.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {connected && matched.length > 0 && (
              <button onClick={handleSaveAll} style={{
                background: saveFlash ? "#2d7a55" : "#1DB954",
                color: "#fff", border: "none",
                borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
                transition: "background 0.3s",
              }}>
                {saveFlash ? `✓ SAVED ${matched.length} ARTISTS` : `SAVE ALL ${matched.length} ARTISTS`}
              </button>
            )}
            {connected && state.saved.length > 0 && (
              <BuildPlaylistButton state={state} />
            )}
            {state.saved.length > 0 && <AppleMusicPlaylistButton state={state} />}
            {/* "Your Weekend Soundtrack" — appears once Shazam has confirmed
                songs in your moments: the real tracks you were there for,
                exportable to either service. */}
            {(window._collectMomentSongs?.() || []).length > 0 && (<>
              {connected && <BuildPlaylistButton state={state} soundtrack />}
              <AppleMusicPlaylistButton state={state} soundtrack />
            </>)}
            <button
              onClick={() => { if (!connected) window.plurskyHaptic?.("MEDIUM"); connected ? disconnectSpotify(setState, state) : startSpotifyAuth(); }}
              style={{
                background: connected ? "rgba(29,185,84,0.2)" : "rgba(247,237,224,0.12)",
                color: "var(--paper)",
                border: connected ? "1px solid rgba(29,185,84,0.5)" : "1px solid rgba(247,237,224,0.28)",
                borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 500,
                transition: "all 0.3s var(--ease-spring)",
                animation: connected && spotifyArtists === null ? "savePop 1.2s ease-in-out infinite" : undefined,
              }}>
              {connected && spotifyArtists === null ? "⟳ LOADING…" : connected ? "✓ CONNECTED" : "CONNECT ACCOUNT"}
            </button>
          </div>
          {/* #6 service-agnostic framing: your saved sets are the source;
              export to whichever service you have. Lets non-Spotify users
              (or anyone hitting Spotify's 5-user cap) still get a playlist. */}
          {APPLE_DEV_TOKEN && state.saved.length > 0 && (
            <div className="mono" style={{ marginTop: 10, fontSize: 9, letterSpacing: 0.5, lineHeight: 1.5, color: "rgba(247,237,224,0.55)" }}>
              💡 Your saved sets build a playlist on <span style={{ color: "rgba(247,237,224,0.92)", fontWeight: 700 }}>Spotify or Apple Music</span> — import your taste from one, export to either. No Spotify needed for the Apple Music playlist.
            </div>
          )}
        </div>

        {/* ── Followed artists nudge ────────────────────── */}
        {connected && <FollowedNudge state={state} setState={setState} />}

        {/* ── Apple Music card ──────────────────────────── */}
        {/* Hidden entirely until a dev token is wired — the previous
            "add your token" copy was a developer reminder that nagged every
            end user without offering them any action. */}
        {APPLE_DEV_TOKEN && <div style={{
          borderRadius: 20, padding: 20,
          background: amConnected ? "#3a1a1a" : "var(--paper-2)",
          border: `1px solid ${amConnected ? "rgba(252,60,60,0.25)" : "var(--line)"}`,
          color: amConnected ? "var(--paper)" : "var(--ink)",
          marginBottom: 14, position: "relative", overflow: "hidden",
        }}>
          {/* Apple Music logo */}
          <svg width="36" height="36" viewBox="0 0 24 24" style={{ position: "absolute", top: 16, right: 16 }}>
            <rect width="24" height="24" rx="6" fill="#fc3c44"/>
            <path d="M16.5 7.5 L10 9 L10 15" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="8.5" cy="15" r="1.5" fill="#fff"/>
            <circle cx="15" cy="13" r="1.5" fill="#fff"/>
          </svg>

          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, opacity: amConnected ? 0.65 : 0.5, marginBottom: 8 }}>
            {amConnected ? "APPLE MUSIC CONNECTED" : "CONNECT APPLE MUSIC"}
          </div>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 8, maxWidth: "78%" }}>
            {amConnected
              ? <>{amMatched.length} festival <span style={{ fontStyle: "italic" }}>matches</span> found</>
              : <>Don't use Spotify? <span style={{ fontStyle: "italic" }}>Link Apple Music</span></>}
          </div>

          {!amConnected && (
            <>
              <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5, marginBottom: 14, maxWidth: "88%" }}>
                Scan your Apple Music library to find which artists you already know and love.
              </div>
              {amError && (
                <div style={{ fontSize: 13, color: "#f87171", marginBottom: 8 }}>{amError}</div>
              )}
              <button onClick={handleAmConnect} disabled={amLoading} style={{
                background: "#fc3c44", color: "#fff", border: "none",
                borderRadius: 999, padding: "10px 18px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
              }}>
                {amLoading ? "CONNECTING…" : "CONNECT APPLE MUSIC"}
              </button>
            </>
          )}

          {amConnected && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {amMatched.length > 0 && (
                <button onClick={() => {
                  const newSaved = [...new Set([...state.saved, ...amMatched.map(a => a.id)])];
                  setState({ ...state, saved: newSaved });
                }} style={{
                  background: "#fc3c44", color: "#fff", border: "none",
                  borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
                }}>
                  SAVE ALL {amMatched.length} ARTISTS
                </button>
              )}
              <button onClick={handleAmDisconnect} style={{
                background: "rgba(247,237,224,0.12)", color: "var(--paper)",
                border: "1px solid rgba(247,237,224,0.28)",
                borderRadius: 999, padding: "10px 16px", cursor: "pointer",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2,
              }}>DISCONNECT</button>
            </div>
          )}

          {amConnected && amArtists === null && (
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, opacity: 0.6 }}>LOADING LIBRARY…</div>
          )}
        </div>}

        {/* ── Harmony score ──────────────────────────────── */}
        {connected && spotifyArtists !== null && (
          <div style={{
            borderRadius: 16, padding: "14px 16px", marginBottom: 20,
            background: "var(--paper-2)", border: "1px solid var(--line)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div className="serif" style={{ fontSize: 20, lineHeight: 1, letterSpacing: -0.3 }}>Harmony score</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                  YOUR SPOTIFY VS THE LINEUP
                </div>
              </div>
              <div className="serif" style={{ fontSize: 42, lineHeight: 1, letterSpacing: -1.5 }}>
                {Math.round(matched.length / ARTISTS.length * 100)}<span style={{ fontSize: 22, opacity: 0.45 }}>%</span>
              </div>
            </div>
            <div style={{ height: 6, background: "var(--line)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                width: `${Math.round(matched.length / ARTISTS.length * 100)}%`, height: "100%",
                background: "linear-gradient(90deg, var(--ember), var(--horizon))",
                borderRadius: 6, transition: "width 0.8s ease",
              }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              {matched.length} of {ARTISTS.length} artists match your Spotify — scanned across top, recent, liked &amp; playlists.
            </div>
          </div>
        )}

        {/* ── Genre DNA chart ────────────────────────────── */}
        {connected && topGenres.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginBottom: 3 }}>Your music DNA</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
              FROM YOUR SPOTIFY TOP 50 ARTISTS
            </div>
            {topGenres.map(({ genre, count }) => {
              const pct = Math.round((count / maxCount) * 100);
              // Find matching stage color
              let barColor = "var(--ember)";
              for (const [sid, keywords] of Object.entries(STAGE_GENRES)) {
                if (keywords.some(k => genre.includes(k))) {
                  barColor = STAGES.find(s => s.id === sid)?.color || barColor;
                  break;
                }
              }
              return (
                <div key={genre} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, textTransform: "capitalize", color: "var(--ink)" }}>{genre}</span>
                    <span className="mono" style={{ fontSize: 10, letterSpacing: 0.8, color: "var(--muted)" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: "var(--line)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: barColor, borderRadius: 5,
                      transition: "width 0.7s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Best stages for you ───────────────────────── */}
        {connected && stageRecs.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginBottom: 3 }}>Best stages for you</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
              BASED ON YOUR GENRE TASTE
            </div>
            {stageRecs.map(({ stage, pct }) => (
              <div key={stage.id} style={{
                padding: "12px 14px", borderRadius: 12, marginBottom: 8,
                background: "var(--paper-2)",
                borderLeft: `3px solid ${stage.color}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div className="serif" style={{ fontSize: 18, lineHeight: 1 }}>{stage.name}</div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: stage.color, fontWeight: 700 }}>
                    {pct}% MATCH
                  </div>
                </div>
                <div style={{ height: 3, background: "var(--line)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: stage.color, borderRadius: 3 }} />
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)" }}>
                  {stage.desc.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Artist picks ──────────────────────────────── */}
        <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginBottom: 3 }}>
          {connected && matched.length ? "Your matches" : connected && spotifyArtists === null ? "Loading your matches" : "Top picks for you"}
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
          {connected && matched.length ? "FROM YOUR SPOTIFY · TAP TO VIEW" : connected && spotifyArtists === null ? (scanProgress ? `SCANNING · ${scanProgress}` : "SCANNING YOUR LIBRARY…") : "HEADLINERS · TAP + TO SAVE"}
        </div>

        {connected && spotifyArtists === null && (
          <div style={{ marginBottom: 14 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="skel" style={{ width: 48, height: 48, borderRadius: 48, flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div className="skel" style={{ width: `${50 + i * 10}%`, height: 14, marginBottom: 6 }}/>
                  <div className="skel" style={{ width: "40%", height: 9 }}/>
                </div>
                <div className="skel" style={{ width: 34, height: 34, borderRadius: 34, flexShrink: 0 }}/>
              </div>
            ))}
          </div>
        )}

        {recs.map(a => {
          const realId  = a._realId || a.id;
          const stg     = STAGES.find(s => s.id === a.stage);
          const isSaved = state.saved.includes(realId);
          return (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderBottom: "1px solid var(--line)",
            }}>
              <ArtistSwatch artist={a} size={48} />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                   onClick={() => setState({ ...state, tab: "home", artist: realId })}>
                <div className="serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{a.name}</div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                  {stg.name} · DAY {a.day} · {fmt12(a.start)}
                </div>
              </div>
              <button onClick={() => toggleSave(state, setState, realId)} style={{
                width: 34, height: 34, borderRadius: 34,
                background: isSaved ? "var(--ember)" : "transparent",
                color: isSaved ? "#fff" : "var(--ink)",
                border: isSaved ? "none" : "1px solid var(--line-2)",
                cursor: "pointer", fontSize: 18, fontWeight: 300,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{isSaved ? "✓" : "+"}</button>
            </div>
          );
        })}

        {/* ── Discoveries: EDC artists you don't listen to yet, but should ── */}
        {connected && discoveries.length > 0 && (
          <>
            <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3, marginTop: 24, marginBottom: 3 }}>
              Recommended for you
            </div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 14 }}>
              ARTISTS THAT MATCH YOUR TASTE · NOT IN YOUR TOP YET
            </div>
            {discoveries.map(a => {
              const stg     = STAGES.find(s => s.id === a.stage);
              const isSaved = state.saved.includes(a.id);
              return (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0", borderBottom: "1px solid var(--line)",
                }}>
                  <ArtistSwatch artist={a} size={48} />
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                       onClick={() => setState({ ...state, tab: "home", artist: a.id })}>
                    <div className="serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 2, textTransform: "uppercase" }}>
                      {stg.name} · DAY {a.day} · {fmt12(a.start)}
                    </div>
                    {a._reason && (
                      <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--horizon)", marginTop: 3, lineHeight: 1.3 }}>
                        {a._reason}
                      </div>
                    )}
                  </div>
                  <button onClick={() => toggleSave(state, setState, a.id)} style={{
                    width: 34, height: 34, borderRadius: 34,
                    background: isSaved ? "var(--ember)" : "transparent",
                    color: isSaved ? "#fff" : "var(--ink)",
                    border: isSaved ? "none" : "1px solid var(--line-2)",
                    cursor: "pointer", fontSize: 18, fontWeight: 300,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{isSaved ? "✓" : "+"}</button>
                </div>
              );
            })}
          </>
        )}

        {/* ── All scanned artists ─────────────────────────── */}
        {connected && spotifyArtists !== null && spotifyArtists.length > 0 && (
          <div style={{ marginTop: 28, marginBottom: 8 }}>
            <button
              onClick={() => setShowAllArtists(v => !v)}
              style={{
                width: "100%", textAlign: "left", background: "none", border: "none",
                padding: 0, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "space-between",
              }}>
              <div>
                <div className="serif" style={{ fontSize: 22, letterSpacing: -0.3 }}>
                  Your scanned artists
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                  {spotifyArtists.length} ARTISTS FROM YOUR SPOTIFY
                </div>
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1 }}>
                {showAllArtists ? "▲ HIDE" : "▼ SHOW"}
              </div>
            </button>

            {showAllArtists && (
              <div style={{ marginTop: 14 }}>
                {[...spotifyArtists]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((a, i) => {
                    const srcLabel = a._source === "top" ? "TOP" : a._source === "recent" ? "RECENT" : a._source === "saved" ? "LIKED" : "PLAYLIST";
                    const srcColor = a._source === "top" ? "var(--ember)" : a._source === "recent" ? "var(--horizon)" : a._source === "saved" ? "#34d399" : "var(--muted)";
                    const isEdc = ARTISTS.some(e => e.name.toLowerCase() === a.name.toLowerCase());
                    return (
                      <div key={a.id || i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "7px 0", borderBottom: "1px solid var(--line)",
                      }}>
                        <div style={{ fontSize: 14, color: isEdc ? "var(--ink)" : "var(--muted)", fontWeight: isEdc ? 500 : 400 }}>
                          {a.name}{isEdc && <span style={{ fontSize: 10, color: "var(--ember)", marginLeft: 6 }}>· ✓</span>}
                        </div>
                        <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: srcColor }}>{srcLabel}</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </ScrollBody>
    </Screen>
  );
}

// ── ME SCREEN ─────────────────────────────────────────────────
// ── Safety & Wellness — harm-reduction surface ────────────────
const SAFETY_LINKS = [
  {
    id: "ground",
    title: "Ground Control",
    sub: "Free water · cool down · friendly faces. Look for the high-vis vests.",
    color: "var(--horizon)",
    icon: "shield",
    href: "https://insomniac.com/festival/edc-las-vegas/2026/info/health-safety/",
  },
  {
    id: "amnesty",
    title: "Amnesty Boxes",
    sub: "Drop unwanted substances at any entrance. No questions, no consequences.",
    color: "var(--ember)",
    icon: "amnesty",
    href: "https://insomniac.com/festival/edc-las-vegas/2026/info/health-safety/",
  },
  {
    id: "dancesafe",
    title: "DanceSafe",
    sub: "Drug-checking, harm-reduction info, peer support. Independent nonprofit.",
    color: "#34d399",
    icon: "info",
    href: "https://dancesafe.org",
  },
  {
    id: "consent",
    title: "Consent Reporting",
    sub: "Report anonymously. Insomniac Cares + 24/7 confidential line.",
    color: "var(--ink)",
    icon: "consent",
    href: "https://insomniac.com/cares",
  },
  {
    id: "medical",
    title: "Medical · 24/7",
    sub: "3 medic tents on-site · roamers in the crowd. Tap → map.",
    color: "#f87171",
    icon: "med",
    onClick: (state, setState) => setState({ ...state, tab: "map" }),
  },
];

function SafetyIcon({ kind, color }) {
  const stroke = color || "currentColor";
  if (kind === "shield") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 L20 6 V12 C20 17 16 20.5 12 22 C8 20.5 4 17 4 12 V6 Z"/><path d="M9 12 L11 14 L15 10"/></svg>;
  if (kind === "amnesty") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M8 8 V6 a4 4 0 0 1 8 0 V8"/><path d="M9 14 H15"/></svg>;
  if (kind === "info") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11 V16"/><circle cx="12" cy="8" r="0.7" fill={stroke}/></svg>;
  if (kind === "consent") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12 a9 9 0 1 1-3-6.7"/><path d="M21 4 V10 H15"/></svg>;
  if (kind === "med") return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M12 10 V16"/><path d="M9 13 H15"/></svg>;
  return null;
}

function SafetyCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {SAFETY_LINKS.map(item => {
        const onClick = item.href
          ? () => window.open(item.href, "_blank", "noopener")
          : () => item.onClick?.();
        return (
          <button key={item.id} onClick={onClick} style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: "12px 14px", borderRadius: 12,
            background: "var(--paper)", border: "1px solid var(--line)",
            borderLeft: `3px solid ${item.color}`,
            cursor: "pointer", textAlign: "left", color: "var(--ink)",
            fontFamily: "inherit",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `${item.color}1f`, color: item.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <SafetyIcon kind={item.icon} color={item.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.1 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{item.sub}</div>
            </div>
            {item.href && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 4 }}>
                <path d="M7 17 L17 7"/><path d="M9 7 H17 V15"/>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Essentials checklist — persisted to localStorage so users can tick items
// off as they pack at home and the state is still there at the venue.
const PACK_ITEMS = [
  { id: "hydra",  label: "Hydration pack / Camelbak", emoji: "💧" },
  { id: "ear",    label: "Earplugs", emoji: "🎧" },
  { id: "sun",    label: "Sunscreen + lip balm", emoji: "☀️" },
  { id: "boots",  label: "Comfortable boots / sneakers", emoji: "👟" },
  { id: "jacket", label: "Light jacket (60°F at sunrise)", emoji: "🧥" },
  { id: "power",  label: "Phone charger / battery pack", emoji: "🔋" },
  { id: "cash",   label: "Cash + ID + bank card", emoji: "💳" },
  { id: "bandana",label: "Bandana / dust mask", emoji: "🌪️" },
  { id: "kandi",  label: "Kandi + totem (foldable)", emoji: "🌈" },
  { id: "snacks", label: "Snacks + gum", emoji: "🍭" },
];

function PackListCard() {
  const [checked, setChecked] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(`${FESTIVAL_CONFIG.id}_pack_v1`) || "{}"); }
    catch { return {}; }
  });
  const [custom, setCustom] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("pack_custom_v1") || "[]"); }
    catch { return []; }
  });
  const [draft, setDraft] = React.useState("");

  const saveChecked = (next) => {
    setChecked(next);
    try { localStorage.setItem(`${FESTIVAL_CONFIG.id}_pack_v1`, JSON.stringify(next)); } catch {}
  };
  const saveCustom = (next) => {
    setCustom(next);
    try { localStorage.setItem("pack_custom_v1", JSON.stringify(next)); } catch {}
  };

  const toggle = (id) => saveChecked({ ...checked, [id]: !checked[id] });

  const addItem = () => {
    const label = draft.trim();
    if (!label) return;
    const id = "c_" + Date.now();
    saveCustom([...custom, { id, label, emoji: "📝" }]);
    setDraft("");
  };
  const removeCustom = (id) => {
    saveCustom(custom.filter(it => it.id !== id));
    const next = { ...checked };
    delete next[id];
    saveChecked(next);
  };

  const allItems = [...PACK_ITEMS, ...custom];
  const done = allItems.filter(i => checked[i.id]).length;

  const itemRow = (it, isLast, isCustom) => (
    <div key={it.id} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 4px",
      borderBottom: isLast ? "none" : "1px solid var(--line)",
    }}>
      <button onClick={() => toggle(it.id)} style={{
        display: "flex", alignItems: "center", gap: 12, flex: 1,
        background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 6,
          background: checked[it.id] ? "var(--ember)" : "transparent",
          border: `1.5px solid ${checked[it.id] ? "var(--ember)" : "var(--line-2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 12, fontWeight: 700,
          flexShrink: 0, transition: "all .15s",
        }}>{checked[it.id] ? "✓" : ""}</span>
        <span style={{ fontSize: 14, opacity: 0.7, width: 22, textAlign: "center" }}>{it.emoji}</span>
        <span style={{
          flex: 1, fontFamily: "Geist, sans-serif", fontSize: 14,
          color: checked[it.id] ? "var(--muted)" : "var(--ink)",
          textDecoration: checked[it.id] ? "line-through" : "none",
          transition: "color .15s",
        }}>{it.label}</span>
      </button>
      {isCustom && (
        <button onClick={() => removeCustom(it.id)} aria-label="Remove item" style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: "var(--muted)", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0,
        }}>×</button>
      )}
    </div>
  );

  return (
    <div style={{ marginTop: 20, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="serif" style={{ fontSize: 22 }}>Pack list</div>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: done === allItems.length ? "var(--success)" : "var(--muted)", fontWeight: 700 }}>
          {done}/{allItems.length} {done === allItems.length && "✓"}
        </div>
      </div>
      {PACK_ITEMS.map((it, i) => itemRow(it, i === allItems.length - 1 && custom.length === 0, false))}
      {custom.map((it, i) => itemRow(it, i === custom.length - 1, true))}
      {/* Add custom item */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addItem()}
          placeholder="Add an item…"
          style={{
            flex: 1, background: "var(--paper-2)", border: "1px solid var(--line-2)",
            borderRadius: 10, padding: "9px 12px",
            fontFamily: "Geist, sans-serif", fontSize: 14, color: "var(--ink)", outline: "none",
          }}
        />
        <button onClick={addItem} style={{
          background: draft.trim() ? "var(--ember)" : "var(--paper-2)",
          color: draft.trim() ? "#fff" : "var(--muted)",
          border: "none", borderRadius: 10, padding: "9px 14px",
          cursor: draft.trim() ? "pointer" : "default",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1, fontWeight: 700,
          transition: "all .15s",
        }}>ADD</button>
      </div>
    </div>
  );
}

// Me+ / Plenty of Fish-modeled badges section. Festival milestones
// derived from state.saved + ARTISTS data, no new infra. Earned badges
// render full-color; locked stay greyed out with their unlock criteria
// visible so users know what to chase.
function BadgesSection({ state }) {
  const saved = state.saved || [];
  const savedArtists = saved
    .map(id => window.ARTISTS?.find(a => a.id === id))
    .filter(Boolean);
  const stageCount = new Set(savedArtists.map(a => a.stage)).size;
  const headlinerCount = savedArtists.filter(a => a.tier === 3).length;
  const byStage = (stageId) => savedArtists.filter(a => a.stage === stageId).length;
  // Hours of music saved across all nights
  const totalMin = savedArtists.reduce((acc, a) => {
    const s = window.toNightMin?.(a.start) || 0;
    const e = window.toNightMin?.(a.end) || 0;
    return acc + Math.max(0, e - s);
  }, 0);
  const hasSunriseSet = savedArtists.some(a => {
    const s = window.toNightMin?.(a.start) || 0;
    return s >= 18 * 60; // 02:00+ in night-min space = sunrise-adjacent
  });

  const BADGES = [
    { id: "first-save",    icon: "✦", name: "First Save",       desc: "Save your first set",                earned: savedArtists.length >= 1 },
    { id: "all-stages",    icon: "◉", name: "All 9 Stages",     desc: "Save a set from every stage",        earned: stageCount >= 9 },
    { id: "five-stages",   icon: "◍", name: "Five Stages",      desc: "Save sets across 5+ stages",         earned: stageCount >= 5 },
    { id: "headliner",     icon: "★", name: "Headliner Hunter", desc: "Save 3+ tier-3 headliner sets",      earned: headlinerCount >= 3 },
    { id: "sunrise",       icon: "☀", name: "Sunrise Survivor", desc: "Save a set running past 2 AM",       earned: hasSunriseSet },
    { id: "ten-deep",      icon: "▤", name: "Ten Deep",         desc: "10+ saved sets across the run",      earned: savedArtists.length >= 10 },
    { id: "twenty-deep",   icon: "▥", name: "Twenty Deep",      desc: "20+ saved sets across the run",      earned: savedArtists.length >= 20 },
    { id: "trance-fam",    icon: "△", name: "Trance Family",    desc: "Save 3+ Quantum Valley sets",        earned: byStage("quantum") >= 3 },
    { id: "house-heads",   icon: "⬡", name: "House Heads HQ",   desc: "Save 3+ Neon Garden sets",           earned: byStage("neon") >= 3 },
    { id: "techno-vault",  icon: "▣", name: "Techno Vault",     desc: "Save 3+ Circuit Grounds sets",       earned: byStage("circuit") >= 3 },
    { id: "bass-faithful", icon: "◆", name: "Bass Faithful",    desc: "Save 3+ Basspod or Wasteland sets",  earned: (byStage("basspod") + byStage("waste")) >= 3 },
    { id: "marathon",      icon: "⌬", name: "Marathon",         desc: "6+ hours of saved music",            earned: totalMin >= 360 },
    { id: "thirty-years",  icon: "✺", name: "30 Years Crew",    desc: "Plursky veteran crew",     earned: true },
  ];

  const earned = BADGES.filter(b => b.earned);
  const locked = BADGES.filter(b => !b.earned);

  const cardStyle = (on) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 12px", borderRadius: 12,
    background: on ? "var(--paper-2)" : "var(--paper)",
    border: on ? "1px solid var(--line)" : "1px dashed var(--line-2)",
    opacity: on ? 1 : 0.55,
  });
  const iconCircle = (on) => ({
    width: 36, height: 36, borderRadius: 999,
    background: on ? "linear-gradient(135deg, var(--ember), var(--horizon))" : "var(--paper-2)",
    color: on ? "#fff" : "var(--muted)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "Instrument Serif, serif", fontSize: 18, flexShrink: 0,
    border: on ? "none" : "1px solid var(--line-2)",
  });

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: 700, color: "var(--ink)" }}>
          BADGES
        </span>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)" }}>
          {earned.length} of {BADGES.length} EARNED
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {earned.map(b => (
          <div key={b.id} style={cardStyle(true)}>
            <div style={iconCircle(true)}>{b.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.15 }}>{b.name}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>
                EARNED · {b.desc.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
        {locked.map(b => (
          <div key={b.id} style={cardStyle(false)}>
            <div style={iconCircle(false)}>{b.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.15, color: "var(--muted)" }}>{b.name}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>
                LOCKED · {b.desc.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Runbuds-modeled History/Records section. Lives on the Me page below
// the 4-card grid. History rows = per-night recap (sets caught, total
// minutes, top stage color stripe). Records = derived superlatives
// (most saved on one night, top stage, longest single set, etc.).
function HistoryRecordsSection({ state, setState }) {
  const [view, setView] = React.useState("history"); // "history" | "records"

  const days = Object.keys(window.FESTIVAL_CONFIG?.dayDates || {})
    .map(Number).sort((a, b) => a - b);

  // Per-night stats — for HISTORY rows.
  const nights = days.map((n) => {
    const dayDate = window.FESTIVAL_CONFIG.dayDates[n] || {};
    const savedThisDay = (state.saved || [])
      .map((id) => window.ARTISTS.find((a) => a.id === id))
      .filter((a) => a && a.day === n);
    const totalMin = savedThisDay.reduce((acc, a) => {
      const s = window.toNightMin?.(a.start) || 0;
      const e = window.toNightMin?.(a.end) || 0;
      return acc + Math.max(0, e - s);
    }, 0);
    // Top stage = stage with the most saved sets on this night
    const stageCounts = {};
    savedThisDay.forEach((a) => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1; });
    const topStageId = Object.keys(stageCounts).sort((x, y) => stageCounts[y] - stageCounts[x])[0];
    const topStage = topStageId ? window.STAGES.find((s) => s.id === topStageId) : null;
    return {
      n,
      label: dayDate.short || `DAY ${n}`,
      name:  dayDate.name  || "",
      count: savedThisDay.length,
      totalMin,
      topStage,
      isPast: typeof window.NOW !== "undefined" && window.NOW.day > n,
      isLive: typeof window.NOW !== "undefined" && window.NOW.day === n,
    };
  });

  // Records — superlatives derived from the saved set
  const records = (() => {
    const out = [];
    const allSaved = (state.saved || [])
      .map((id) => window.ARTISTS.find((a) => a.id === id))
      .filter(Boolean);
    if (allSaved.length === 0) return out;
    // Most saved on one night
    const peakNight = nights.slice().sort((a, b) => b.count - a.count)[0];
    if (peakNight && peakNight.count > 0) {
      out.push({
        label: "BUSIEST NIGHT",
        value: `${peakNight.label} · ${peakNight.count}`,
        accent: peakNight.topStage?.color || "var(--ember)",
      });
    }
    // Top stage across the run
    const stageAll = {};
    allSaved.forEach((a) => { stageAll[a.stage] = (stageAll[a.stage] || 0) + 1; });
    const topId = Object.keys(stageAll).sort((x, y) => stageAll[y] - stageAll[x])[0];
    const topStage = topId ? window.STAGES.find((s) => s.id === topId) : null;
    if (topStage) {
      out.push({
        label: "TOP STAGE",
        value: `${topStage.name.toUpperCase()} · ${stageAll[topId]}×`,
        accent: topStage.color,
      });
    }
    // Longest single set
    const longest = allSaved.slice().sort((x, y) => {
      const xLen = (window.toNightMin?.(y.end) || 0) - (window.toNightMin?.(y.start) || 0);
      const yLen = (window.toNightMin?.(x.end) || 0) - (window.toNightMin?.(x.start) || 0);
      return xLen - yLen;
    })[0];
    if (longest) {
      const len = (window.toNightMin?.(longest.end) || 0) - (window.toNightMin?.(longest.start) || 0);
      if (len > 0) {
        out.push({
          label: "LONGEST SET",
          value: `${longest.name.toUpperCase()} · ${Math.floor(len / 60) ? `${Math.floor(len / 60)}H` : ""}${len % 60}M`,
          accent: window.STAGES.find((s) => s.id === longest.stage)?.color || "var(--horizon)",
        });
      }
    }
    return out;
  })();

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Toggle pills */}
      <div style={{
        display: "inline-flex", padding: 3, gap: 2,
        background: "var(--paper-2)", borderRadius: 999,
        marginBottom: 10,
      }}>
        {["history", "records"].map((k) => {
          const on = view === k;
          return (
            <button key={k} onClick={() => setView(k)} className="mono" style={{
              padding: "5px 12px", borderRadius: 999, border: "none",
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--paper)" : "var(--ink)",
              fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
              cursor: "pointer",
            }}>{k.toUpperCase()}</button>
          );
        })}
      </div>

      {view === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {nights.map((n) => (
            <button key={n.n}
              onClick={() => setState && setState(s => ({ ...s, tab: "memories", memoriesNight: n.n }))}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: "var(--paper-2)",
                borderLeft: `3px solid ${n.topStage?.color || "var(--line-2)"}`,
                opacity: n.count === 0 && !n.isLive ? 0.62 : 1,
                border: "none", cursor: "pointer", textAlign: "left",
                width: "100%",
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 16, lineHeight: 1.15 }}>
                  {n.name || `Night ${n.n}`}
                  {n.isLive && (
                    <span className="mono" style={{
                      marginLeft: 8, fontSize: 8, letterSpacing: 1.2, fontWeight: 800,
                      color: "var(--success)", background: "rgba(45,122,85,0.14)",
                      padding: "1px 6px", borderRadius: 999,
                      border: "0.5px solid rgba(45,122,85,0.55)",
                    }}>● LIVE</span>
                  )}
                </div>
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 3,
                  display: "flex", gap: 8, flexWrap: "wrap",
                }}>
                  <span>{n.count} {n.count === 1 ? "SET" : "SETS"}</span>
                  {n.totalMin > 0 && (
                    <span>· {Math.floor(n.totalMin / 60) ? `${Math.floor(n.totalMin / 60)}H ` : ""}{n.totalMin % 60}M</span>
                  )}
                  {n.topStage && <span style={{ color: n.topStage.color, fontWeight: 700 }}>· {n.topStage.short || n.topStage.name.split(" ")[0].toUpperCase()}</span>}
                </div>
              </div>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                color: n.isPast ? "var(--muted)" : (n.isLive ? "var(--success)" : "var(--horizon)"),
              }}>{n.isPast ? "DONE" : n.isLive ? "TONIGHT" : "UPCOMING"}</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6 }}>›</span>
            </button>
          ))}
        </div>
      )}

      {view === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {records.length === 0 ? (
            <div style={{
              padding: "18px 14px", borderRadius: 12, background: "var(--paper-2)",
              textAlign: "center",
            }}>
              <div className="serif" style={{ fontSize: 16, marginBottom: 4 }}>No records yet</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)" }}>
                SAVE SETS TO UNLOCK SUPERLATIVES
              </div>
            </div>
          ) : records.map((r, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: "var(--paper-2)",
              borderLeft: `3px solid ${r.accent}`,
            }}>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
                width: 110, flexShrink: 0,
              }}>{r.label}</div>
              <div style={{ fontFamily: "Geist, sans-serif", fontSize: 13, fontWeight: 500, flex: 1 }}>
                {r.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Memories: photos + moments per night ──────────────────────────
// Metadata in localStorage (small JSON, sync access for MEMORIES count).
// Photos in IndexedDB (Blob-native, big quota on iOS Safari ~hundreds of MB).
// Zero backend cost — everything stays on-device.

const MOMENTS_KEY = "plursky_moments_v1";

function _readMoments() {
  try { return JSON.parse(localStorage.getItem(MOMENTS_KEY) || "{}"); }
  catch { return {}; }
}
function _writeMoments(all) {
  localStorage.setItem(MOMENTS_KEY, JSON.stringify(all));
  // Fire so cross-screen consumers (per-artist strip on Artist screen,
  // Recap counts, etc.) re-read without prop-drilling.
  try { window.dispatchEvent(new CustomEvent("plursky-moments-change")); } catch {}
}
function _countMoments() {
  const all = _readMoments();
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}


// Multi-festival scoping (v204). Moments share ONE localStorage key keyed by
// night, not festival — so without this filter EDC moments bleed onto the ACL
// page (both use nights 1/2/3). New moments are stamped with `festivalId` at
// creation; legacy moments (pre-v204, no festivalId) are backfilled by
// _maybeAutoArchive to the festival that was active when last seen. Here we
// keep a moment if it belongs to the ACTIVE festival; a legacy un-stamped
// moment is only shown when we haven't switched festivals (last seen === cur),
// so switching to a new festival hides the prior one's un-migrated moments too.
function _activeMoments(all) {
  const cur = window.FESTIVAL_CONFIG?.id;
  if (!cur) return all || {};
  let last = null;
  try { last = localStorage.getItem("plursky_last_festival_id"); } catch {}
  const out = {};
  for (const night of Object.keys(all || {})) {
    const arr = all[night];
    if (!Array.isArray(arr)) continue;
    const kept = arr.filter(m => m && (m.festivalId ? m.festivalId === cur : (!last || last === cur)));
    if (kept.length) out[night] = kept;
  }
  return out;
}

let _memDbP = null;
function _openMemDB() {
  if (_memDbP) return _memDbP;
  _memDbP = new Promise((resolve, reject) => {
    const req = indexedDB.open("plursky_memories", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", { keyPath: "id" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
  return _memDbP;
}
async function _putPhoto(id, blob) {
  const db = await _openMemDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put({ id, blob, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
}
async function _getPhoto(id) {
  const db = await _openMemDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readonly");
    const r  = tx.objectStore("photos").get(id);
    r.onsuccess = () => resolve(r.result?.blob || null);
    r.onerror   = e => reject(e.target.error);
  });
}
async function _deletePhoto(id) {
  const db = await _openMemDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
}

// Compress on pick: 720px max edge, JPEG q0.78 → typical 80-150KB.
function _compressMomentImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxEdge = 720;
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) resolve(blob); else reject(new Error("blob conversion failed"));
        }, "image/jpeg", 0.78);
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

// v135: videos go in as-is — no transcoding in-browser (would need FFmpeg
// WASM, way too heavy). Cap at 200 MB per clip so a stray 4K Cinematic
// can't blow out the IndexedDB quota in a single import.
const _MAX_VIDEO_BYTES = 200 * 1024 * 1024;
// Read a video's duration (seconds) by loading just its metadata. Used to
// stamp moments so tiles can show a 0:48-style badge like Photos/Facebook.
function _videoDuration(blob) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const v = document.createElement("video");
      v.preload = "metadata";
      const done = (d) => { try { URL.revokeObjectURL(url); } catch {} resolve(Number.isFinite(d) && d > 0 ? d : null); };
      v.onloadedmetadata = () => done(v.duration);
      v.onerror = () => done(null);
      v.src = url;
    } catch { resolve(null); }
  });
}

async function _processMomentMedia(file) {
  if (/^image\//.test(file.type)) {
    return { blob: await _compressMomentImage(file), kind: "image" };
  }
  if (/^video\//.test(file.type)) {
    if (file.size > _MAX_VIDEO_BYTES) {
      throw new Error(`Video too large (${Math.round(file.size / 1048576)} MB > 200 MB cap)`);
    }
    // Store raw — modern iOS records H.265/HEVC which Safari plays natively.
    const duration = await _videoDuration(file);
    return { blob: file, kind: "video", duration };
  }
  throw new Error("Unsupported file type: " + file.type);
}

// Fallback ladder when EXIF is missing:
//   1. XMP date (handled in _parseExifMeta — it scans XMP segments too now)
//   2. Filename pattern (iOS "Screenshot ..." / "Photo on ..." / Android
//      IMG_YYYYMMDD_HHMMSS)
//   3. file.lastModified — BUT only if it's clearly the original capture
//      time, not the WebKit conversion timestamp. iOS WKWebView's
//      HEIC→JPEG conversion sets lastModified to "now"; trusting that
//      would dump every photo into the current festival night fallback.
//      The heuristic: lastModified within 30s of now ⇒ conversion stamp,
//      skip it.
function _metaFromFile(file, exifMeta) {
  const out = {
    date: exifMeta?.date || null,
    lat: exifMeta?.lat ?? null,
    lng: exifMeta?.lng ?? null,
    takenAtSource: exifMeta?.timestampSource || (exifMeta?.date ? (/^video\//.test(file?.type || "") ? "video" : "exif") : "none"),
    locationSource: exifMeta?.locationSource || ((exifMeta?.lat != null && exifMeta?.lng != null) ? (/^video\//.test(file?.type || "") ? "video-gps" : "exif-gps") : "none"),
  };
  if (!out.date) {
    const fileDate = _parseFilenameDate(file?.name);
    if (fileDate) { out.date = fileDate; out.takenAtSource = "filename"; }
  }
  if (!out.date && file?.lastModified) {
    const ageMs = Date.now() - file.lastModified;
    // <30s old = almost certainly WebKit's conversion timestamp, not the
    // photo's real capture time. Skip in that case so the moment lands
    // as fallback (truthfully no-date) rather than tagged to today's
    // night using a manufactured timestamp.
    if (ageMs >= 30 * 1000) {
      const d = new Date(file.lastModified);
      const fileDate = {
        yr: d.getFullYear(), mo: d.getMonth() + 1, dy: d.getDate(),
        hh: d.getHours(), mm: d.getMinutes(), ss: d.getSeconds(),
      };
      if (_photoFestivalNight(fileDate) != null) { out.date = fileDate; out.takenAtSource = "file-lastModified"; }
    }
  }
  return out;
}

function _momentTakenAtToDateParts(takenAt) {
  const m = String(takenAt || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return { yr: +m[1], mo: +m[2], dy: +m[3], hh: +m[4], mm: +m[5], ss: +(m[6] || 0) };
}

function _momentDatePartsToTakenAt(date) {
  if (!date) return null;
  return `${date.yr}-${String(date.mo).padStart(2,"0")}-${String(date.dy).padStart(2,"0")} ${String(date.hh).padStart(2,"0")}:${String(date.mm).padStart(2,"0")}`;
}

function _mediaFingerprintParts(fp) {
  const parts = String(fp || "").split("_");
  if (parts.length < 3) return null;
  const size = parts[1];
  const basename = parts.slice(2).join("_").toLowerCase();
  if (!/^\d+$/.test(size) || !basename) return null;
  return { size, basename };
}

function _findArchivedVideoMomentForFingerprint(fp) {
  const cur = window.FESTIVAL_CONFIG?.id;
  if (!cur || !fp) return null;
  const target = _mediaFingerprintParts(fp);
  if (!target) return null;
  try {
    const archive = JSON.parse(localStorage.getItem("plursky_festival_archive_v1") || "{}");
    const archivedMoments = archive?.[cur]?.moments || {};
    const matches = [];
    for (const arr of Object.values(archivedMoments)) {
      if (!Array.isArray(arr)) continue;
      for (const m of arr) {
        if (!m || m.kind !== "video" || !m.takenAt) continue;
        const parts = _mediaFingerprintParts(m._fingerprint);
        if (parts && parts.size === target.size && parts.basename === target.basename) matches.push(m);
      }
    }
    return matches.length === 1 ? matches[0] : null;
  } catch { return null; }
}

function _recoverVideoMetaFromArchive(file, fp, meta) {
  if (!/^video\//.test(file?.type || "")) return null;
  const archiveMoment = _findArchivedVideoMomentForFingerprint(fp);
  const recoveredDate = _momentTakenAtToDateParts(archiveMoment?.takenAt);
  if (!archiveMoment || !recoveredDate) return null;
  const parsedNight = meta?.date ? _photoFestivalNight(meta.date) : null;
  if (parsedNight != null && meta?.takenAtSource !== "file-lastModified" && meta?.takenAtSource !== "none") return null;
  return {
    meta: { ...(meta || {}), date: recoveredDate, takenAtSource: "archive-recovered" },
    moment: archiveMoment,
  };
}

function _fmtMomentTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// `enabled` gates the IndexedDB read + object-URL creation. Passing it false
// (e.g. for an off-screen MomentCard) keeps the URL unallocated and revokes
// any existing one — bounding decoded-image memory in long lists WITHOUT
// unmounting the card (so in-progress edit state survives). Defaults true so
// the many call sites that always want the photo are unchanged.
function useMomentPhoto(photoId, enabled = true) {
  const [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!photoId || !enabled) { setUrl(null); return; }
    let cancelled = false;
    let objectUrl = null;
    _getPhoto(photoId).then(async blob => {
      if (cancelled) return;
      // Restore-on-view: this device doesn't have the blob locally (fresh
      // install / cleared cache) — pull it from the cloud backup if present,
      // re-cache to IndexedDB, then show it. No-ops for never-backed-up photos.
      if (!blob && typeof window.sbDownloadMomentMedia === "function") {
        try {
          const cloud = await window.sbDownloadMomentMedia(photoId);
          if (cancelled) return;
          if (cloud) { try { await _putPhoto(photoId, cloud); } catch {} blob = cloud; }
        } catch {}
      }
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, enabled]);
  return url;
}

// Returns [ref, near] — attach ref to an element; `near` flips true while it
// is within rootMargin of the viewport and false when it scrolls far away.
// Used to defer heavy work (photo loads) to on-screen rows without unmounting.
function useNearViewport(rootMargin = "600px 0px") {
  const ref = React.useRef(null);
  const [near, setNear] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.IntersectionObserver) { setNear(true); return; }
    const obs = new IntersectionObserver((entries) => {
      setNear(entries[entries.length - 1].isIntersecting);
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return [ref, near];
}

// ── Cloud media backup (Plursky+) ─────────────────────────────────
// P1: manual + wifi-only. P2: auto-backup (opt-in toggle) + a per-user storage
// cap so a phone full of 200MB videos can't run up the bill.
// Best-effort wifi gate: block only on a KNOWN cellular connection; allow when
// the type is unavailable (iOS WKWebView usually doesn't expose it).
function _onWifi() {
  try {
    const c = navigator.connection;
    if (c && c.type && !["wifi", "ethernet", "unknown"].includes(c.type)) return false;
  } catch {}
  return true;
}
const _BACKUP_SOFT_CAP = 1024 * 1024 * 1024;     // 1 GB — warn
const _BACKUP_HARD_CAP = 2 * 1024 * 1024 * 1024; // 2 GB — stop uploading
function _autoBackupOn() { try { return localStorage.getItem("plursky_autobackup") !== "0"; } catch { return true; } } // default on (Plus)
function _setAutoBackup(v) { try { localStorage.setItem("plursky_autobackup", v ? "1" : "0"); } catch {} }
function _fmtSize(b) { if (!b) return "0 MB"; const mb = b / 1048576; return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.max(1, Math.round(mb)) + " MB"; }
// Cloud bytes used = sum of per-moment backedUpBytes (accurate across deletes
// + re-uploads, unlike a running counter).
function _backedUpBytes(all) {
  let b = 0;
  for (const n of Object.keys(all)) for (const m of (all[n] || [])) if (m.backedUp) b += (m.backedUpBytes || 0);
  return b;
}

// Mirror every not-yet-backed-up moment photo/video to Supabase Storage, then
// stamp `backedUp` + `backedUpBytes` on the moment (one batched write at the
// end so we don't fire N re-renders). Stops at the hard cap. Returns
// {done, failed, total, capped, usedBytes} or {error}.
async function _backupMyWeekend(onProgress) {
  if (typeof window.sbUploadMomentMedia !== "function") return { error: "offline" };
  const user = window.sbGetUser ? await window.sbGetUser() : null;
  if (!user) return { error: "signin" };
  const all = _readMoments();
  let usedBytes = _backedUpBytes(all);
  const pending = [];
  for (const n of Object.keys(all)) for (const m of (all[n] || [])) {
    if (m.photoId && !m.backedUp) pending.push(m);
  }
  let done = 0, failed = 0, capped = false;
  const succeeded = {}; // id -> bytes
  for (const m of pending) {
    const blob = await _getPhoto(m.photoId).catch(() => null);
    if (!blob) { failed++; onProgress?.({ done, failed, total: pending.length }); continue; }
    if (usedBytes + blob.size > _BACKUP_HARD_CAP) { capped = true; break; }
    const ok = await window.sbUploadMomentMedia(m.photoId, blob);
    if (ok) { succeeded[m.id] = blob.size; usedBytes += blob.size; done++; } else failed++;
    onProgress?.({ done, failed, total: pending.length });
  }
  const ids = Object.keys(succeeded);
  if (ids.length) {
    const cur = _readMoments();
    for (const n of Object.keys(cur)) cur[n] = (cur[n] || []).map(x => succeeded[x.id] != null ? { ...x, backedUp: true, backedUpBytes: succeeded[x.id] } : x);
    _writeMoments(cur);
  }
  return { done, failed, total: pending.length, capped, usedBytes };
}

// Single memory thumbnail for the home strip — loads its photo blob lazily.
function _HomeMemoryThumb({ moment, onClick }) {
  const url = useMomentPhoto(moment.photoId);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 96, height: 128, borderRadius: 14,
      border: "1px solid var(--line)", overflow: "hidden", position: "relative",
      background: url ? "#000" : "var(--paper-2)", cursor: "pointer", padding: 0,
    }}>
      {url ? (
        // Video needs <video preload="metadata"> to paint a poster frame —
        // a blob URL inside <img> renders as a blank/black tile.
        moment.kind === "video" ? (
          // #t=0.1 forces iOS to decode + paint the first frame as a poster;
          // without it the tile stays black until the video is touched.
          <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}/>
        ) : (
          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        )
      ) : (
        <div className="skel" style={{ width: "100%", height: "100%" }}/>
      )}
      {moment.kind === "video" && (
        <_VideoBadge seconds={moment.duration} style={{ position: "absolute", top: 6, right: 6 }}/>
      )}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent)",
        padding: "16px 8px 7px",
      }}>
        <div className="mono" style={{ fontSize: 8, letterSpacing: 0.6, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {artist ? artist.name.toUpperCase() : "NIGHT " + moment.night}
        </div>
      </div>
    </button>
  );
}

// Tracks how many moments a night had the last time its recap was played or
// dismissed, so the "recap ready" nudge only re-appears when there are NEW
// moments since — never nags about a recap you've already seen.
function _readRecapSeen() {
  try { return JSON.parse(localStorage.getItem("plursky_recap_seen_v1") || "{}"); } catch { return {}; }
}
function _markRecapSeen(night, count) {
  try {
    const m = _readRecapSeen();
    m[night] = count;
    localStorage.setItem("plursky_recap_seen_v1", JSON.stringify(m));
  } catch {}
}

// Home-screen "Your Memories" strip (B) — horizontal scroll of the most
// recent captured photos/videos. Grows as the festival progresses; the
// retention loop's front door so the rewatch surface isn't buried in Me.
function HomeMemoriesStrip({ state, setState }) {
  const [rawAll, setAll] = React.useState(() => { try { return _readMoments(); } catch { return {}; } });
  // Scope to the active festival so EDC moments don't bleed onto the ACL home.
  const all = React.useMemo(() => _activeMoments(rawAll), [rawAll]);
  const [reel, setReel] = React.useState(null);
  React.useEffect(() => {
    const refresh = () => { try { setAll(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);

  const recent = React.useMemo(() => {
    const flat = [];
    Object.values(all).forEach(arr => { if (Array.isArray(arr)) flat.push(...arr); });
    return flat
      .filter(m => m.photoId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);
  }, [all]);

  // One-tap recap from Home plays the most-recent night chronologically —
  // same reel as Story's PLAY button, but a single tap from the front door.
  const reelData = React.useMemo(() => {
    if (!recent.length) return null;
    const night = recent[0].night || NOW.day || 1;
    const ms = (all[night] || []).filter(m => m.photoId).sort((a, b) => {
      const ta = a.takenAt || "", tb = b.takenAt || "";
      if (ta && tb) return ta.localeCompare(tb);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    const DAYS = window.DAYS || [];
    const dm = DAYS.find(d => d.n === night);
    const label = dm ? (dm.label.charAt(0) + dm.label.slice(1).toLowerCase()) + " night" : `Night ${night}`;
    return { moments: ms, label, night };
  }, [all, recent]);

  // Proactive resurfacing: a recap is "ready" when the most-recent night has
  // enough moments to feel like a story (≥3) AND has new moments since the
  // user last played/dismissed it. This is the retention pull from the front
  // door — turns passive capture into an active rewatch prompt.
  const [seen, setSeen] = React.useState(_readRecapSeen);
  const recapReady = React.useMemo(() => {
    if (!reelData || reelData.moments.length < 3) return null;
    if (reelData.moments.length <= (seen[reelData.night] || 0)) return null;
    return reelData;
  }, [reelData, seen]);

  // Playing or dismissing both record the current count so the nudge won't
  // re-appear until there are genuinely new moments.
  const playRecap = (data) => { _markRecapSeen(data.night, data.moments.length); setSeen(_readRecapSeen()); setReel(data); };
  const dismissRecap = () => { if (recapReady) { _markRecapSeen(recapReady.night, recapReady.moments.length); setSeen(_readRecapSeen()); } };

  // #8 — "Last night in 15s." When a recap is ready, play a tight hero-ranked
  // highlight (best ~6, videos/peak shots first) instead of the full roll, and
  // frame it as a morning-after nudge when the app is opened the next day. We
  // don't force-autoplay (browsers block it + it's intrusive) — the auto-
  // surfaced nudge IS the trigger; one tap plays.
  const HIGHLIGHT_CAP = 6;
  const highlightReel = React.useMemo(() => {
    if (!recapReady) return null;
    const best = recapReady.moments.slice()
      .sort((a, b) => _heroScore(b) - _heroScore(a))
      .slice(0, HIGHLIGHT_CAP)
      .sort((a, b) => { const ta = a.takenAt || "", tb = b.takenAt || ""; return (ta && tb) ? ta.localeCompare(tb) : (a.createdAt || 0) - (b.createdAt || 0); });
    return { ...recapReady, moments: best };
  }, [recapReady]);
  const morningAfter = (() => {
    try { const h = parseInt((window.NOW?.time || "").split(":")[0], 10); return h >= 4 && h <= 15; } catch { return false; }
  })();
  const playHighlights = () => {
    if (!recapReady || !highlightReel) return;
    _markRecapSeen(recapReady.night, recapReady.moments.length);
    setSeen(_readRecapSeen());
    setReel(highlightReel);
  };

  if (recent.length === 0) return null;
  const total = recent.length;
  const go = (night) => (window._pushNav || ((n) => setState({ ...state, ...n })))({ tab: "memories", memoriesNight: night, artist: null });
  const canRecap = reelData && reelData.moments.length >= 2;

  return (
    <div data-animate style={{ marginTop: 22 }}>
      {reel && (
        <MemoryReel
          moments={reel.moments}
          nightLabel={reel.label}
          night={reel.night}
          festival={window.FESTIVAL_CONFIG?.shortName || window.FESTIVAL_CONFIG?.name || ""}
          onClose={() => setReel(null)}
          onOpenArtist={(id) => setState({ ...state, tab: "lineup", artist: id })}
          onMakeVideo={() => setState({ ...state, tab: "recap", artist: null })}
        />
      )}
      {recapReady && (() => {
        const clips = (highlightReel || recapReady).moments;
        const vids = clips.filter(m => m.kind === "video").length;
        return (
          <button onClick={playHighlights} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "13px 14px", marginBottom: 14, borderRadius: 16, cursor: "pointer",
            border: "none", textAlign: "left",
            background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
            boxShadow: "0 6px 20px rgba(232,93,46,0.28)",
          }}>
            <span style={{
              width: 42, height: 42, flexShrink: 0, borderRadius: 999,
              background: "rgba(255,255,255,0.18)", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff",
            }}>▶</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mono" style={{ display: "block", fontSize: 8.5, letterSpacing: 1.4, fontWeight: 800, color: "rgba(255,255,255,0.8)" }}>{morningAfter ? "LAST NIGHT IN 15s" : "RECAP READY"}</span>
              <span className="serif" style={{ display: "block", fontSize: 18, lineHeight: 1.1, color: "#fff", marginTop: 1 }}>{morningAfter ? `Your ${recapReady.label}, recapped` : `Your ${recapReady.label}`}</span>
              <span className="mono" style={{ display: "block", fontSize: 9, letterSpacing: 0.6, color: "rgba(255,255,255,0.78)", marginTop: 3, fontWeight: 600 }}>
                {clips.length} BEST {clips.length === 1 ? "CLIP" : "CLIPS"}{vids ? ` · ${vids} VIDEO${vids === 1 ? "" : "S"}` : ""} · TAP TO PLAY
              </span>
            </span>
            <span onClick={(e) => { e.stopPropagation(); dismissRecap(); }} role="button" aria-label="Dismiss" style={{
              flexShrink: 0, width: 26, height: 26, borderRadius: 999,
              background: "rgba(0,0,0,0.18)", color: "#fff", fontSize: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</span>
          </button>
        );
      })()}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="serif" style={{ fontSize: 22 }}>
          Your <span style={{ fontStyle: "italic", color: "var(--ember)" }}>memories</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {canRecap && (
            <button onClick={() => playRecap(reelData)} className="mono" style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
              border: "none", borderRadius: 999, padding: "5px 11px",
              color: "#fff", cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 800,
            }}><span style={{ fontSize: 10 }}>▶</span> PLAY</button>
          )}
          <button onClick={() => go(NOW.day)} className="mono" style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700,
          }}>SEE ALL →</button>
        </div>
      </div>
      <div className="no-scrollbar" style={{
        display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
        marginRight: -16, paddingRight: 16,
      }}>
        {recent.map(m => (
          <_HomeMemoryThumb key={m.id} moment={m} onClick={() => go(m.night || NOW.day)} />
        ))}
      </div>
    </div>
  );
}

// Short label for how a moment got its tag. Shown as a small chip so the
// user can tell at a glance whether the auto-tagger was confident or
// dropped this one into a fallback bucket they should retag.
// ── Setlist-to-photo song matching ──────────────────────────────
// Two sources: 1001tracklists (has timestamps, best for DJs) and
// setlist.fm (has API, best for live acts). Try 1001tl first.
const _setlistCache = {};

async function _getSupabaseTracklist(artistName) {
  try {
    const festId = window.FESTIVAL_CONFIG?.id || "edc-lv-2026";
    const url = `https://pzoijbqsbbwyuyjinjtj.supabase.co/rest/v1/tracklists?artist_name=eq.${encodeURIComponent(artistName)}&festival_id=eq.${encodeURIComponent(festId)}&select=tracks,source,source_url`;
    const res = await fetch(url, {
      headers: {
        "apikey": window.SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2lqYnFzYmJ3eXV5amluanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU3NzkwNDUsImV4cCI6MjAzMTM1NTA0NX0.aYMVriNmLAlkCN4DI1HGrj7VH9MNUxbYg8I1kpGl3Ow",
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.length || !rows[0].tracks?.length) return null;
    return { source: rows[0].source || "1001tracklists", tracks: rows[0].tracks, url: rows[0].source_url };
  } catch { return null; }
}

async function _getSetlistFmData(artistName) {
  try {
    const setlists = await window.fetchSetlists?.(artistName);
    if (!setlists?.length) return null;
    const festBrand = (window.FESTIVAL_CONFIG?.brand || "").toLowerCase();
    const festSetlist = setlists.find(sl => {
      const v = (sl.venue?.name || "").toLowerCase();
      return v.includes(festBrand) || v.includes("electric daisy") || v.includes("motor speedway") ||
        v.includes("zilker") || v.includes("austin city");
    });
    const target = festSetlist || setlists[0];
    const songs = (target.sets?.set || []).flatMap(s => (s.song || []).map(song => song.name)).filter(Boolean);
    if (!songs.length) return null;
    return { source: "setlist.fm", songs, venue: target.venue?.name };
  } catch { return null; }
}

async function _getTracklistForArtist(artistName) {
  const key = artistName.toLowerCase().replace(/\W+/g, "_");
  if (_setlistCache[key]) return _setlistCache[key];
  const tl = await _getSupabaseTracklist(artistName);
  if (tl) { _setlistCache[key] = tl; return tl; }
  const sl = await _getSetlistFmData(artistName);
  if (sl) { _setlistCache[key] = sl; return sl; }
  _setlistCache[key] = null;
  return null;
}

function _matchSongAtTime(artist, trackData, photoTakenAt) {
  if (!photoTakenAt || !artist) return null;
  const CFG = window.FESTIVAL_CONFIG || {};
  const dm = CFG.dayDates?.[artist.day];
  if (!dm) return null;
  const [sh, sm] = artist.start.split(":").map(Number);
  const setStartMs = dm.midnightUtc + (sh < 8 ? sh + 24 : sh) * 3600000 + sm * 60000;
  const photoMs = Date.parse(photoTakenAt.replace(" ", "T"));
  if (isNaN(photoMs)) return null;
  const elapsedMs = photoMs - setStartMs;
  if (elapsedMs < 0) return null;

  if (trackData.source === "1001tracklists" && trackData.tracks?.length) {
    let matched = trackData.tracks[0];
    for (const t of trackData.tracks) {
      if (t.timeMs <= elapsedMs) matched = t;
      else break;
    }
    const display = matched.artist ? `${matched.artist} — ${matched.title}` : matched.title;
    return { song: display, source: "1001tracklists", confidence: "exact", url: trackData.url };
  }

  if (trackData.source === "setlist.fm" && trackData.songs?.length) {
    const [eh, em] = artist.end.split(":").map(Number);
    const setEndMs = dm.midnightUtc + (eh < 8 ? eh + 24 : eh) * 3600000 + em * 60000;
    const setDuration = setEndMs - setStartMs;
    if (setDuration <= 0 || elapsedMs > setDuration) return null;
    const idx = Math.min(Math.floor((elapsedMs / setDuration) * trackData.songs.length), trackData.songs.length - 1);
    return { song: trackData.songs[idx], source: "setlist.fm", confidence: "estimated" };
  }
  return null;
}

function useSetlistSong(artist, takenAt) {
  const [result, setResult] = React.useState(null);
  React.useEffect(() => {
    if (!artist || !takenAt) return;
    let cancelled = false;
    _getTracklistForArtist(artist.name).then(data => {
      if (cancelled || !data) return;
      const r = _matchSongAtTime(artist, data, takenAt);
      if (r) setResult(r);
    });
    return () => { cancelled = true; };
  }, [artist?.id, takenAt]);
  return result;
}

const _TAG_SOURCE_LABEL = {
  exif:                 { text: "AUTO · EXIF",       tone: "ok" },
  filetime:             { text: "AUTO · FILE TIME",  tone: "ok" },
  "exif-night-only":    { text: "EXIF NIGHT · PICK A SET", tone: "warn" },
  "filetime-night-only":{ text: "FILE TIME · PICK A SET",  tone: "warn" },
  off_stage:            { text: "📍 BETWEEN SETS",    tone: "info" },
  fallback:             { text: "FALLBACK · RETAG",  tone: "warn" },
  manual:               { text: "MANUAL",            tone: "ok" },
};

// Best-available capture time for a moment. handleBatchPick stores both
// `createdAt` (import wall-clock, same for every photo in a batch) and
// `takenAt` (the actual EXIF / lastModified capture moment, formatted as
// "YYYY-MM-DD HH:MM"). Manually-added moments have no takenAt; their
// createdAt IS the capture moment. Prefer takenAt when present.
function _momentCaptureMs(m) {
  if (m.takenAt) {
    const t = Date.parse(m.takenAt.replace(" ", "T"));
    if (!isNaN(t)) return t;
  }
  return m.createdAt || 0;
}

// Free-tier "AI workaround": find other moments tagged within ±30 min of
// THIS moment's CAPTURE time (not import time) on the same night and
// suggest the most-common artist. If the user has already tagged any
// moment near this photo's time, we have strong signal without calling a
// vision model. Returns null when there's nothing to suggest.
function _siblingSuggestionFor(moment, allMoments) {
  if (moment.artistId) return null;
  const nightMoments = allMoments[moment.night] || [];
  const myTime = _momentCaptureMs(moment);
  if (!myTime) return null;
  const WINDOW_MS = 30 * 60 * 1000;
  const counts = new Map();
  for (const m of nightMoments) {
    if (!m.artistId || m.id === moment.id) continue;
    const theirTime = _momentCaptureMs(m);
    if (!theirTime) continue;
    if (Math.abs(theirTime - myTime) > WINDOW_MS) continue;
    counts.set(m.artistId, (counts.get(m.artistId) || 0) + 1);
  }
  if (counts.size === 0) return null;
  let bestId = null, bestCount = 0;
  for (const [id, n] of counts) {
    if (n > bestCount) { bestId = id; bestCount = n; }
  }
  return { artistId: bestId, count: bestCount };
}

// One-tap bulk retag for a stuck untagged batch. Appears above the TO
// RETAG group when 3+ moments are sitting untagged and the user has
// saved artists for that night. Tap a chip → all moments in the group
// get that artistId at once. Confirms before applying since this is a
// destructive-ish action (it overwrites any partial tags).
function BulkRetagRow({ moments, savedNightArtists, onUpdate }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const apply = (artistId) => {
    try { window.plurskyHaptic?.("MEDIUM"); } catch {}
    for (const m of moments) {
      onUpdate?.(m, { artistId, tagSource: "manual", autoTagged: false });
    }
    setConfirmId(null);
  };
  return (
    <div style={{
      margin: "8px 0 10px", padding: "9px 10px",
      background: "var(--paper-2)", border: "1px dashed var(--line-2)", borderRadius: 10,
    }}>
      <div className="mono" style={{
        fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700,
        marginBottom: 6,
      }}>
        ⚡ BULK · TAG ALL {moments.length} AS
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {savedNightArtists
          .slice()
          .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
          .map(a => {
            const stage = STAGES.find(s => s.id === a.stage);
            const isConfirming = confirmId === a.id;
            return (
              <button key={a.id}
                onClick={() => isConfirming ? apply(a.id) : setConfirmId(a.id)}
                className="mono" style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: isConfirming ? "var(--ember)" : (stage ? `${stage.color}18` : "var(--paper)"),
                  color:      isConfirming ? "#fff" : (stage ? stage.color : "var(--ink)"),
                  border:     isConfirming ? "none" : (stage ? `1px solid ${stage.color}40` : "1px solid var(--line-2)"),
                  fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>
                {isConfirming ? `TAP AGAIN TO TAG ${moments.length}` : a.name.toUpperCase()}
              </button>
            );
          })}
        {confirmId && (
          <button onClick={() => setConfirmId(null)} className="mono" style={{
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            padding: "5px 8px",
          }}>CANCEL</button>
        )}
      </div>
    </div>
  );
}

// ── Retroactive song ID from a video's own audio ─────────────────
// The unlock: the music in a video you already shot IS the recognition
// sample. Identifying it turns the song tag from a tracklist *estimate*
// into ground truth — and if the matched artist contradicts the photo's
// auto-tag, that's a signal to fix the tag (and therefore the location).
// Native iOS uses ShazamPlugin.identifyFile (exact, on-device). There is
// no deployed web recognizer today, so browser/PWA video recognition returns
// null instead of calling the known-404 recognize-song endpoint.
function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { const s = String(fr.result); const i = s.indexOf(","); resolve(i >= 0 ? s.slice(i + 1) : s); };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function identifySongFromVideo(moment, onProgress) {
  if (!moment?.photoId || moment.kind !== "video") return null;
  const blob = await _getPhoto(moment.photoId).catch(() => null);
  if (!blob) return null;

  // Native iOS (focus path): hand the clip to on-device ShazamKit via the
  // ShazamPlugin — free, accurate, no backend. Browser/PWA returns null
  // because the web recognition proxy is not deployed.
  if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin) {
    try {
      onProgress?.("listening");
      if (moment.nativePath && window.ShazamPlugin.identifyFile) {
        onProgress?.("matching");
        const r = await window.ShazamPlugin.identifyFile({ path: moment.nativePath });
        if (r?.matched && r.title) return { title: r.title, artist: r.artist || "", source: "video-shazam" };
        return null;
      }
      if (!window.ShazamPlugin.identifyBase64) return null;
      const base64 = await _blobToBase64(blob);
      const ext = (blob.type || "").includes("quicktime") ? "mov" : "mp4";
      onProgress?.("matching");
      const r = await window.ShazamPlugin.identifyBase64({ data: base64, ext });
      if (r?.matched && r.title) return { title: r.title, artist: r.artist || "", source: "video-shazam" };
      return null; // native ran but found no match — don't bother the web path
    } catch { return null; }
  }

  return null;
}

// Given a Shazam-matched artist name, find the lineup artist it best
// corresponds to — used to detect when a video's true audio disagrees
// with the photo's auto-tag (proves the user was at a different stage).
function _lineupArtistFromShazam(shazamArtist) {
  if (!shazamArtist) return null;
  const norm = shazamArtist.toLowerCase().trim();
  return ARTISTS.find(a => {
    const an = a.name.toLowerCase();
    return an === norm || an.includes(norm) || norm.includes(an.split(/ b2b /i)[0]);
  }) || null;
}

// ── Full-screen photo lightbox — the rewatch surface ─────────────
// Tap any memory to open it full-bleed on black: the photo, the artist,
// and — the Plursky signature — the song that was playing the moment you
// took it. Swipe or tap edges to move through the group. Modeled on
// Careem/NAVER photo viewers (close top-left, counter top-right, caption
// + filmstrip at the bottom) per the Mobbin design pass.
// ⭐ Favorite — _heroScore already weights `m.favorite` at +1000, so starring a
// shot promotes it to the group/night cover. `_FavStar` is the tappable toggle
// (lightbox top bar + each MomentCard); `_FavBadge` is a display-only gold pip
// that marks favorited tiles in the grid/story so they read at a glance.
function _FavStar({ favorite, onToggle, tone }) {
  const dark = tone === "dark";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        try { window.plurskyHaptic?.(favorite ? "LIGHT" : "MEDIUM"); } catch {}
        onToggle?.(!favorite);
      }}
      aria-label={favorite ? "Remove from favorites" : "Mark as favorite"}
      aria-pressed={favorite}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "none", cursor: "pointer", lineHeight: 1,
        background: dark ? "rgba(255,255,255,0.14)" : "transparent",
        width: dark ? 36 : "auto", height: dark ? 36 : "auto",
        borderRadius: dark ? 36 : 999, padding: dark ? 0 : "3px 5px",
        fontSize: dark ? 17 : 13,
        color: favorite ? "#f5c451" : (dark ? "rgba(255,255,255,0.7)" : "var(--muted)"),
        transition: "color .15s ease, transform .15s ease",
        transform: favorite ? "scale(1.06)" : "scale(1)",
      }}
    >{favorite ? "★" : "☆"}</button>
  );
}
function _FavBadge({ style }) {
  return (
    <span aria-hidden="true" style={{
      position: "absolute", display: "flex", alignItems: "center", justifyContent: "center",
      width: 20, height: 20, borderRadius: 20, fontSize: 11, lineHeight: 1,
      background: "rgba(0,0,0,0.5)", color: "#f5c451",
      textShadow: "0 1px 2px rgba(0,0,0,0.5)", pointerEvents: "none",
      ...style,
    }}>★</span>
  );
}

function MomentLightbox({ moments, index, onClose, onIndexChange, onArtistClick, onUpdate }) {
  const m = moments[index];
  const photoUrl = useMomentPhoto(m?.photoId);
  const artist = m?.artistId ? ARTISTS.find(a => a.id === m.artistId) : null;
  const stage  = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const estimatedSong = useSetlistSong(artist, m?.takenAt);
  // Prefer a Shazam-confirmed song over the tracklist estimate.
  const song   = m?.confirmedSong ? { song: m.confirmedSong } : estimatedSong;
  const touch  = React.useRef({ x: 0 });
  const [idState, setIdState] = React.useState("idle"); // idle|listening|matching|done|fail
  const [mismatch, setMismatch] = React.useState(null);  // suggested artist if audio disagrees with tag
  const [sharing, setSharing] = React.useState(false);
  const [retagging, setRetagging] = React.useState(false); // inline "fix the artist" picker
  const [retagQuery, setRetagQuery] = React.useState("");

  React.useEffect(() => { setIdState("idle"); setMismatch(null); setRetagging(false); setRetagQuery(""); }, [index]);

  // Auto-tag guesses a stage by time (usually the mainstage) and gets the
  // night/stage wrong when there's no GPS. So the fix must search the WHOLE
  // lineup, not just this moment's guessed night. Quick-picks = acts playing
  // at this time across stages; the search box reaches every artist/day.
  const retagOptions = React.useMemo(() => {
    const q = retagQuery.trim().toLowerCase();
    if (q) {
      return ARTISTS.filter(a => a.name.toLowerCase().includes(q)).slice(0, 24);
    }
    if (!m) return [];
    const hhmm = (m.takenAt?.split(" ")[1] || "").slice(0, 5);
    const t = hhmm ? toNightMin(hhmm) : null;
    const night = m.night || NOW.day;
    const all = ARTISTS.filter(a => a.day === night);
    const playing = t != null ? all.filter(a => toNightMin(a.start) <= t && t < toNightMin(a.end)) : [];
    return (playing.length ? playing : all).slice().sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
  }, [m, retagQuery]);

  const runIdentify = async () => {
    setIdState("listening");
    const result = await identifySongFromVideo(m, (p) => setIdState(p));
    if (!result) { setIdState("fail"); setTimeout(() => setIdState("idle"), 2500); return; }
    setIdState("done");
    const confirmed = result.artist ? `${result.artist} — ${result.title}` : result.title;
    // Keep the raw title/artist (not just the display string) so the Weekend
    // Soundtrack can search the exact track on Spotify/Apple Music.
    onUpdate?.(m, { confirmedSong: confirmed, confirmedTitle: result.title, confirmedArtist: result.artist || "", songSource: "video-shazam" });
    // Cross-check: does the recognized artist contradict the photo's tag?
    const matchedArtist = _lineupArtistFromShazam(result.artist);
    if (matchedArtist && matchedArtist.id !== m.artistId) setMismatch(matchedArtist);
    // #7 proof-of-attendance: a song recognized from your OWN video is proof
    // you were at that set — auto-confirm attendance (feeds Recap "sets
    // caught" + the playlist "attended" source). Prefer the Shazam-matched
    // lineup artist; fall back to the moment's tag.
    const heardId = matchedArtist?.id || m.artistId;
    if (heardId && m.night != null && typeof markAttended === "function") {
      try { markAttended(m.night, heardId, "shazam"); } catch {}
    }
    try { window.plurskyHaptic?.("MEDIUM"); } catch {}
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < moments.length - 1) onIndexChange(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, moments.length]);

  if (!m) return null;
  const prettyTime = (() => {
    if (!m.takenAt) return null;
    try {
      const t = m.takenAt.split(" ")[1] || "";
      const [h, mm] = t.split(":").map(Number);
      const ap = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
      return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
    } catch { return null; }
  })();

  const onTouchStart = (e) => { touch.current.x = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touch.current.x;
    if (dx < -50 && index < moments.length - 1) onIndexChange(index + 1);
    if (dx >  50 && index > 0) onIndexChange(index - 1);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: "#000",
      display: "flex", flexDirection: "column", animation: "fadeIn .2s",
      paddingTop: "env(safe-area-inset-top, 0px)",
    }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close" style={{
          width: 36, height: 36, borderRadius: 36, border: "none",
          background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
            {index + 1} / {moments.length}
          </span>
          {onUpdate && (
            <_FavStar favorite={!!m.favorite} tone="dark"
              onToggle={(v) => onUpdate(m, { favorite: v })} />
          )}
        </div>
      </div>

      {/* Photo — tap left/right thirds to navigate */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{
        flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}>
        {photoUrl ? (
          m.kind === "video"
            ? <_LightboxVideo key={m.id} src={photoUrl}/>
            : <img src={photoUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/>
        ) : (
          <div className="skel-dark" style={{ width: "80%", height: "60%", borderRadius: 12 }}/>
        )}
        {/* Visible chevrons — vertically centered at the edges so they read
            as navigation and clear the video's center play + bottom scrubber.
            (Replaced invisible full-height tap-zones that hid the controls.) */}
        {index > 0 && (
          <button onClick={() => onIndexChange(index - 1)} aria-label="Previous" style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            width: 40, height: 40, borderRadius: 40, zIndex: 3,
            background: "rgba(255,255,255,0.16)", backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)", border: "none", cursor: "pointer",
            color: "#fff", fontSize: 22, lineHeight: 1, paddingBottom: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>‹</button>
        )}
        {index < moments.length - 1 && (
          <button onClick={() => onIndexChange(index + 1)} aria-label="Next" style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            width: 40, height: 40, borderRadius: 40, zIndex: 3,
            background: "rgba(255,255,255,0.16)", backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)", border: "none", cursor: "pointer",
            color: "#fff", fontSize: 22, lineHeight: 1, paddingBottom: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>›</button>
        )}
      </div>

      {/* Caption — artist · song that was playing · stage · time */}
      <div style={{ padding: "16px 20px calc(20px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
        {artist ? (
          <button onClick={() => { onArtistClick?.(artist.id); onClose(); }} style={{
            background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer", display: "block",
          }}>
            <div className="serif" style={{ fontSize: 26, lineHeight: 1, color: "#fff", marginBottom: 6 }}>
              {artist.name}
            </div>
          </button>
        ) : (
          <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "rgba(255,255,255,0.6)", fontStyle: "italic", marginBottom: 6 }}>
            Untagged moment
          </div>
        )}
        {song?.song && (
          <div className="mono" style={{ fontSize: 11, letterSpacing: 0.8, color: stage?.color || "var(--ember)", fontWeight: 700, marginBottom: 4 }}>
            ♫ {song.song}
            {m.confirmedSong && <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>· SHAZAMED</span>}
          </div>
        )}
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
          {[stage?.name?.toUpperCase(), prettyTime, m.location?.label?.toUpperCase()].filter(Boolean).join(" · ")}
        </div>

        {/* Prominent video-song proof: this is the P0 Shazam verification
            route for real clips. It uses the video's own audio through the
            native ShazamPlugin on iOS, then stores the exact song result. */}
        {m.kind === "video" && !m.confirmedSong && (
          <button onClick={runIdentify} disabled={idState !== "idle" && idState !== "fail"} className="mono" style={{
            marginTop: 12, padding: "12px 14px", borderRadius: 14, width: "100%",
            background: idState === "fail"
              ? "linear-gradient(135deg, rgba(232,93,46,0.28), rgba(245,154,54,0.16))"
              : "linear-gradient(135deg, rgba(109,40,217,0.85), rgba(232,93,46,0.78))",
            border: "1px solid rgba(255,255,255,0.22)", color: "#fff",
            boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
            fontSize: 10, letterSpacing: 1.3, fontWeight: 800, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            opacity: (idState !== "idle" && idState !== "fail") ? 0.85 : 1,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{idState === "listening" ? "●" : "🎵"}</span>
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block" }}>
                  {idState === "idle"      ? "SHAZAM THIS VIDEO"
                   : idState === "listening" ? "LISTENING TO YOUR VIDEO…"
                   : idState === "matching"  ? "MATCHING WITH SHAZAM…"
                   : idState === "fail"      ? "NO MATCH — TRY A LOUDER CLIP"
                   : "IDENTIFIED"}
                </span>
                <span style={{ display: "block", marginTop: 3, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.72)", fontWeight: 700 }}>
                  PROVES THE SONG FROM THE CLIP'S AUDIO
                </span>
              </span>
            </span>
            <span style={{ fontSize: 18 }}>→</span>
          </button>
        )}

        {/* Wrong artist? Auto-tag guesses by stage+time and is often wrong when
            you roam (e.g. tagged Martin Garrix but you were at John Summit).
            Fix it inline to whoever was actually playing at this time. */}
        <button onClick={() => setRetagging(r => !r)} className="mono" style={{
          marginTop: 9, background: "transparent", border: "none", padding: 0,
          color: "rgba(255,255,255,0.6)", fontSize: 9, letterSpacing: 1.1, fontWeight: 700, cursor: "pointer",
        }}>{retagging ? "✕ CANCEL" : (artist ? "✎ WRONG ACT? FIX IT" : "✎ TAG THIS MOMENT")}</button>
        {retagging && (
          <div className="no-scrollbar" style={{ marginTop: 8, maxHeight: 176, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {retagOptions.map(a => {
              const st = STAGES.find(s => s.id === a.stage);
              const on = a.id === m.artistId;
              return (
                <button key={a.id} onClick={() => { onUpdate?.(m, { artistId: a.id, tagSource: "manual", autoTagged: false }); setRetagging(false); try { window.plurskyHaptic?.("LIGHT"); } catch {} }} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10,
                  background: on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${on ? "#fff" : "rgba(255,255,255,0.14)"}`, cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: st?.color || "#888", flexShrink: 0 }}/>
                  <span style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                  <span className="mono" style={{ fontSize: 8, letterSpacing: 0.6, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{st?.short || ""} · {window.fmt12?.(a.start) || a.start}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Share — renders a branded story card with the photo + the song
            that was playing, and opens the OS share sheet. */}
        <button onClick={async () => {
          if (sharing) return;
          setSharing(true);
          try { window.plurskyHaptic?.("LIGHT"); } catch {}
          await _shareMoment(m, {
            artistName: artist?.name,
            songLabel: song?.song || null,
            stageColor: stage?.color,
            subLabel: [stage?.name, prettyTime].filter(Boolean).join(" · "),
            timeLabel: prettyTime,
            festival: FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name,
          }).catch(() => {});
          setSharing(false);
        }} disabled={sharing} className="mono" style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 999, width: "100%",
          background: "#fff", color: "#0d0a08", border: "none",
          fontSize: 11, letterSpacing: 1.3, fontWeight: 800, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          opacity: sharing ? 0.6 : 1,
        }}>{sharing ? "PREPARING…" : "↗  SHARE THIS MOMENT"}</button>

        {/* Audio disagrees with the auto-tag → offer the correction */}
        {mismatch && (
          <button onClick={() => { onUpdate?.(m, { artistId: mismatch.id, tagSource: "video-shazam", autoTagged: false }); setMismatch(null); }} style={{
            marginTop: 8, padding: "10px 12px", borderRadius: 10, width: "100%",
            background: "rgba(245,154,54,0.15)", border: "1px solid rgba(245,154,54,0.45)",
            color: "#fde68a", cursor: "pointer", textAlign: "left",
          }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, fontWeight: 700, marginBottom: 2 }}>
              AUDIO SAYS {mismatch.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>
              This video's song is {mismatch.name}'s — retag this moment to them? (You were probably at {STAGES.find(s => s.id === mismatch.stage)?.name || "their stage"}.)
            </div>
          </button>
        )}

        {/* Filmstrip — quick-jump within the group */}
        {moments.length > 1 && (
          <div className="no-scrollbar" style={{ display: "flex", gap: 5, overflowX: "auto", marginTop: 14, scrollbarWidth: "none" }}>
            {moments.map((mm, i) => (
              <_LightboxThumb key={mm.id} moment={mm} active={i === index} onClick={() => onIndexChange(i)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// mm:ss clock formatter shared by the player + duration badges.
function _fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// A small "▶ 0:48" pill for video tiles — matches Photos/Facebook/Instagram.
// Falls back to a bare ▶ when duration is unknown (older imports).
function _VideoBadge({ seconds, style }) {
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      background: "rgba(0,0,0,0.6)", color: "#fff",
      fontSize: 8, letterSpacing: 0.5, fontWeight: 700,
      padding: "2px 6px", borderRadius: 999, pointerEvents: "none",
      ...style,
    }}>
      <span style={{ fontSize: 7 }}>▶</span>{seconds ? _fmtClock(seconds) : "VIDEO"}
    </span>
  );
}

// Custom full-screen video player for the lightbox. Replaces the bare
// <video controls> (whose native chrome fought the edge tap-zones, making
// scrubbing impossible). Modeled on Netflix/HBO: tap-to-toggle, a clean
// scrubber with time, persistent mute. Scrubber/mute stopPropagation so
// they don't trigger the lightbox's swipe-to-next.
function _LightboxVideo({ src }) {
  const ref = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [dur, setDur] = React.useState(0);
  const [muted, setMuted] = React.useState(() => {
    try { return localStorage.getItem("plursky_lb_muted_v1") === "1"; } catch { return false; }
  });
  const [flash, setFlash] = React.useState(false);

  React.useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);

  const toggle = () => {
    const v = ref.current; if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
    setFlash(true); setTimeout(() => setFlash(false), 450);
    try { window.plurskyHaptic?.("LIGHT"); } catch {}
  };
  const seek = (e) => {
    const v = ref.current; if (!v || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    v.currentTime = Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * dur;
  };
  const pct = dur ? (cur / dur) * 100 : 0;
  const stop = (e) => e.stopPropagation();

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video ref={ref} src={src} autoPlay playsInline muted={muted}
        onClick={toggle}
        onTimeUpdate={() => { const v = ref.current; if (v) setCur(v.currentTime); }}
        onLoadedMetadata={() => { const v = ref.current; if (v) setDur(v.duration || 0); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{ maxWidth: "100%", maxHeight: "100%", display: "block" }}/>
      {/* Center play/pause — persistent ▶ when paused, brief flash otherwise */}
      {(!playing || flash) && (
        <div style={{
          position: "absolute", pointerEvents: "none",
          width: 66, height: 66, borderRadius: 66,
          background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 26, paddingLeft: playing ? 0 : 4,
          transition: "opacity .2s", opacity: 1,
        }}>{playing ? "❚❚" : "▶"}</div>
      )}
      {/* Mute toggle */}
      <button onClick={(e) => { stop(e); setMuted(mm => { const nx = !mm; try { localStorage.setItem("plursky_lb_muted_v1", nx ? "1" : "0"); } catch {} return nx; }); }}
        aria-label={muted ? "Unmute" : "Mute"} style={{
          position: "absolute", top: 12, right: 12, width: 38, height: 38, borderRadius: 38,
          background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{muted ? "🔇" : "🔊"}</button>
      {/* Scrubber */}
      <div onClick={stop} onTouchStart={stop} onTouchEnd={stop} style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
        <div onClick={seek} onTouchMove={seek} onTouchStart={seek} style={{
          height: 5, borderRadius: 5, background: "rgba(255,255,255,0.28)", position: "relative", cursor: "pointer",
        }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "#fff", borderRadius: 5 }}/>
          <div style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: 12, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }}/>
        </div>
        <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.7)", fontWeight: 700 }}>
          <span>{_fmtClock(cur)}</span><span>{_fmtClock(dur)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Share a moment ───────────────────────────────────────────────
// Renders a 1080×1920 story card: the photo (or video's first frame) as a
// full-bleed hero, the artist + the song that was playing + stage/time, and
// the Plursky wordmark watermark in the footer. The watermark is the
// free-tier differentiator (it's branding, not a feature gate), so every
// share carries it. Shares the PNG via the OS sheet, falling back to download.
function _imgFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ img, revoke: () => { try { URL.revokeObjectURL(url); } catch {} } });
    img.onerror = () => { try { URL.revokeObjectURL(url); } catch {} reject(new Error("img")); };
    img.src = url;
  });
}
function _frameFromVideoBlob(blob) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob);
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
      const fail = () => { try { URL.revokeObjectURL(url); } catch {} resolve(null); };
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, (v.duration || 1) * 0.1); } catch { fail(); } };
      v.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          c.width = v.videoWidth || 1080; c.height = v.videoHeight || 1920;
          c.getContext("2d").drawImage(v, 0, 0);
          URL.revokeObjectURL(url);
          resolve(c);
        } catch { fail(); }
      };
      v.onerror = fail;
    } catch { resolve(null); }
  });
}
function _drawCover(ctx, src, dx, dy, dw, dh) {
  const sW = src.width || src.videoWidth, sH = src.height || src.videoHeight;
  if (!sW || !sH) return;
  const ir = sW / sH, r = dw / dh;
  let sw, sh, sx, sy;
  if (ir > r) { sh = sH; sw = sh * r; sx = (sW - sw) / 2; sy = 0; }
  else { sw = sW; sh = sw / r; sx = 0; sy = (sH - sh) / 2; }
  ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
}
async function _shareMoment(moment, meta) {
  const blob = await _getPhoto(moment.photoId).catch(() => null);
  if (!blob) return { ok: false, reason: "no_photo" };
  let source = null, revoke = null;
  if (moment.kind === "video") {
    source = await _frameFromVideoBlob(blob);
  } else {
    try { const r = await _imgFromBlob(blob); source = r.img; revoke = r.revoke; } catch {}
  }
  try { await (document.fonts?.ready || Promise.resolve()); } catch {}

  const W = 1080, H = 1920, HERO = 1320;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#0d0a08"; ctx.fillRect(0, 0, W, H);
  if (source) _drawCover(ctx, source, 0, 0, W, HERO);
  else { ctx.fillStyle = "#1a120d"; ctx.fillRect(0, 0, W, HERO); }
  if (revoke) revoke();

  // Fade the hero into the text panel
  const g = ctx.createLinearGradient(0, HERO - 360, 0, HERO);
  g.addColorStop(0, "rgba(13,10,8,0)"); g.addColorStop(1, "#0d0a08");
  ctx.fillStyle = g; ctx.fillRect(0, HERO - 360, W, 360);

  const accent = meta.stageColor || "#e85d2e";
  let y = HERO + 30;
  ctx.textAlign = "left";
  if (meta.timeLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = '700 30px "Geist Mono", monospace';
    ctx.fillText(meta.timeLabel.toUpperCase(), 80, y); y += 70;
  }
  ctx.fillStyle = "#fff";
  ctx.font = '92px "Instrument Serif", serif';
  let name = meta.artistName || "A moment";
  if (ctx.measureText(name).width > W - 160) {
    while (ctx.measureText(name + "…").width > W - 160 && name.length) name = name.slice(0, -1);
    name += "…";
  }
  ctx.fillText(name, 80, y + 70); y += 130;
  if (meta.songLabel) {
    ctx.fillStyle = accent;
    ctx.font = '700 34px "Geist Mono", monospace';
    let s = "♫ " + meta.songLabel;
    if (ctx.measureText(s).width > W - 160) {
      while (ctx.measureText(s + "…").width > W - 160 && s.length) s = s.slice(0, -1);
      s += "…";
    }
    ctx.fillText(s, 80, y); y += 56;
  }
  if (meta.subLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = '600 26px "Geist Mono", monospace';
    ctx.fillText(meta.subLabel.toUpperCase(), 80, y);
  }

  // Footer watermark
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = '800 40px "Geist Mono", monospace';
  ctx.fillText("PLURSKY", 80, H - 70);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = '600 26px "Geist Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText((meta.festival || "").toUpperCase() + "  ·  PLURSKY.COM", W - 80, H - 72);

  const fname = `plursky-${(meta.artistName || "moment").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  const out = await new Promise((res) => cv.toBlob(res, "image/png", 0.92));
  if (!out) return { ok: false, reason: "encode_fail" };
  const file = new File([out], fname, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], title: meta.artistName ? `${meta.artistName} — Plursky` : "Plursky" }); return { ok: true, mode: "share" }; }
    catch (e) { if (e?.name === "AbortError") return { ok: true, mode: "abort" }; }
  }
  const url = URL.createObjectURL(out);
  const link = document.createElement("a");
  link.href = url; link.download = fname;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1500);
  return { ok: true, mode: "download" };
}

function _LightboxThumb({ moment, active, onClick }) {
  const url = useMomentPhoto(moment.photoId);
  return (
    <button onClick={onClick} aria-label="View moment" style={{
      flexShrink: 0, width: 44, height: 44, borderRadius: 8, padding: 0, cursor: "pointer",
      border: active ? "2px solid #fff" : "2px solid transparent",
      opacity: active ? 1 : 0.5, overflow: "hidden", background: "#222",
      transition: "opacity 0.15s", position: "relative",
    }}>
      {url && (moment.kind === "video"
        ? <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}/>
        : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
      )}
      {moment.kind === "video" && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, textShadow: "0 1px 2px rgba(0,0,0,0.6)", pointerEvents: "none" }}>▶</span>
      )}
    </button>
  );
}

function MomentCard({ moment, idx, total, onDelete, onArtistClick, onUpdate, savedArtistIds, groupMoments, onOpenLightbox }) {
  // Defer the photo load until the card is near the viewport — the card stays
  // mounted (edit state intact), but off-screen cards in long night/group
  // lists don't each hold a decoded image + live blob URL.
  const [cardRef, near] = useNearViewport();
  const photoUrl = useMomentPhoto(moment.photoId, near);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  const stage  = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const nowPlaying = useSetlistSong(artist, moment.takenAt);
  const [editing, setEditing] = React.useState(false);
  const tagInfo = (() => {
    const base = _TAG_SOURCE_LABEL[moment.tagSource] || null;
    if (moment.tagSource === "off_stage" && moment.location) {
      return { text: `${moment.location.icon} ${moment.location.label.toUpperCase()}`, tone: "info" };
    }
    return base;
  })();
  // Sibling-suggestion: cheap "AI workaround" for untagged moments. Reads
  // localStorage moments (~hundreds of bytes) on each render — and on the
  // "plursky-moments-change" event so cascading retags update siblings.
  const [allMoments, setAllMoments] = React.useState(() => {
    try { return _readMoments(); } catch { return {}; }
  });
  React.useEffect(() => {
    const refresh = () => { try { setAllMoments(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  const suggestion = React.useMemo(
    () => _siblingSuggestionFor(moment, allMoments),
    [moment.id, moment.artistId, moment.night, moment.createdAt, allMoments]
  );
  const suggestedArtist = suggestion ? ARTISTS.find(a => a.id === suggestion.artistId) : null;
  const suggestedStage  = suggestedArtist ? STAGES.find(s => s.id === suggestedArtist.stage) : null;
  // Prefer the saved-on-this-night sets as the picker options (most likely
  // intent), with an "all sets" expand for the rare case the user took a
  // photo at a set they hadn't saved.
  const [showAll, setShowAll] = React.useState(false);
  // Recompute on every render so a night-change inside the editor swaps in
  // the new night's lineup without needing a parent re-key.
  const nightArtists = ARTISTS.filter(a => a.day === moment.night);
  const savedNightArtists = nightArtists.filter(a => (savedArtistIds || []).includes(a.id));
  const pickerArtists = showAll
    ? nightArtists
    : (savedNightArtists.length ? savedNightArtists : nightArtists);
  const setArtist = (id) => {
    try { window.plurskyHaptic?.("LIGHT"); } catch {}
    onUpdate?.(moment, { artistId: id, tagSource: "manual", autoTagged: false });
    setEditing(false);
  };
  const moveToNight = (n) => {
    if (n === moment.night) return;
    try { window.plurskyHaptic?.("LIGHT"); } catch {}
    // Drop artist when moving nights — old artist almost certainly belonged
    // to the wrong night's lineup. User picks a new one from the new night.
    onUpdate?.(moment, { night: n, artistId: null, tagSource: "manual", autoTagged: false });
  };
  return (
    <div ref={cardRef} style={{
      background: "var(--paper-2)", border: "1px solid var(--line)",
      borderRadius: 14, padding: 12, marginBottom: 10,
    }}>
      {moment.photoId && (
        photoUrl ? (
          moment.kind === "video" ? (
            <video src={photoUrl} controls playsInline preload="metadata" style={{
              width: "100%", borderRadius: 10, display: "block",
              marginBottom: moment.text ? 10 : 8,
              background: "#000",
            }}/>
          ) : (
            <img src={photoUrl} alt="" onClick={() => onOpenLightbox?.(groupMoments || [moment], idx || 0)} style={{
              width: "100%", borderRadius: 10, display: "block",
              marginBottom: moment.text ? 10 : 8,
              cursor: "pointer",
            }}/>
          )
        ) : (
          <div style={{
            width: "100%", aspectRatio: "4/3", borderRadius: 10,
            background: "var(--paper)", border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: moment.text ? 10 : 8,
          }}>
            <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700 }}>
              LOADING…
            </span>
          </div>
        )
      )}
      {moment.text && (
        <div className="serif" style={{ fontSize: 18, lineHeight: 1.3, color: "var(--ink)" }}>
          {moment.text}
        </div>
      )}
      {/* PRIMARY row — the artist/tag chip + capture time read first. Edit and
          delete are demoted to a muted, right-aligned cluster so the card has
          a clear hierarchy instead of one crammed wrapping line. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {artist ? (
            <button onClick={() => onArtistClick(artist.id)} className="mono" style={{
              background: stage ? `${stage.color}18` : "var(--paper)",
              color:      stage ? stage.color       : "var(--muted)",
              border:     stage ? `1px solid ${stage.color}40` : "1px solid var(--line-2)",
              borderRadius: 999, padding: "3px 9px",
              fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
            }}>♬ {artist.name.toUpperCase()}</button>
          ) : suggestion ? (
            <button onClick={() => setArtist(suggestion.artistId)} className="mono" title={`${suggestion.count} other moment${suggestion.count === 1 ? "" : "s"} in the same 30-min window tagged to this artist`} style={{
              background: suggestedStage ? `${suggestedStage.color}18` : "var(--paper-2)",
              color:      suggestedStage ? suggestedStage.color       : "var(--ink)",
              border:     suggestedStage ? `1px dashed ${suggestedStage.color}66` : "1px dashed var(--line-2)",
              borderRadius: 999, padding: "3px 9px",
              fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
              whiteSpace: "nowrap",
            }}>
              + TAG AS {suggestedArtist?.name.toUpperCase() || "—"} ({suggestion.count})
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="mono" style={{
              background: "rgba(232,93,46,0.12)", color: "var(--ember)",
              border: "1px dashed rgba(232,93,46,0.5)",
              borderRadius: 999, padding: "3px 9px",
              fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
            }}>+ TAG A SET</button>
          )}
          {/* Low-confidence auto-tag (2+ overlapping sets): invite a fix
              prominently rather than letting a possibly-wrong tag look sure. */}
          {artist && moment.tagAmbiguous && onUpdate && !editing && (
            <button onClick={() => setEditing(true)} className="mono" title="More than one set overlapped this time — tap to confirm or fix the tag" style={{
              background: "rgba(232,93,46,0.12)", color: "var(--ember)",
              border: "1px dashed rgba(232,93,46,0.5)",
              borderRadius: 999, padding: "3px 9px",
              fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
              whiteSpace: "nowrap",
            }}>✎ FIX TAG?</button>
          )}
          {/* Escape hatch when a sibling-suggestion is showing but wrong. */}
          {!artist && suggestion && onUpdate && (
            <button onClick={() => setEditing(true)} className="mono" style={{
              background: "transparent", border: "none", color: "var(--muted)",
              cursor: "pointer", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
              padding: "3px 5px",
            }}>OTHER</button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 600 }}>
            {_fmtMomentTime(moment.createdAt)}
          </span>
          {onUpdate && (
            <_FavStar favorite={!!moment.favorite} tone="light"
              onToggle={(v) => onUpdate(moment, { favorite: v })} />
          )}
          {artist && onUpdate && (
            <button onClick={() => setEditing(e => !e)} aria-label={editing ? "Done editing" : "Edit tag"} className="mono" style={{
              background: editing ? "var(--ink)" : "transparent",
              color: editing ? "var(--paper)" : "var(--muted)",
              border: "none", borderRadius: 999, cursor: "pointer",
              fontSize: editing ? 9 : 12, letterSpacing: 1.1, fontWeight: 700,
              padding: editing ? "3px 8px" : "3px 5px",
            }}>{editing ? "DONE" : "✎"}</button>
          )}
          <button onClick={() => onDelete(moment)} aria-label="Delete moment" style={{
            background: "transparent", border: "none",
            color: "var(--muted)", cursor: "pointer",
            fontSize: 14, lineHeight: 1, opacity: 0.55, padding: "3px 4px",
          }}>×</button>
        </div>
      </div>
      {/* SECONDARY — tag provenance + GPS note, muted and small so it sits
          clearly below the primary line. */}
      {(tagInfo || (moment.hasGps === false && moment.autoTagged)) && (
        <div className="mono" title={moment.takenAt ? `Photo time: ${moment.takenAt}` : undefined}
          style={{
            marginTop: 6, fontSize: 8.5, letterSpacing: 1, fontWeight: 600,
            color: tagInfo?.tone === "warn" ? "var(--ember)" : "var(--muted)",
            opacity: tagInfo?.tone === "warn" ? 1 : 0.85,
          }}>
          {tagInfo ? `${tagInfo.text}${moment.takenAt ? ` · ${moment.takenAt.slice(11)}` : ""}` : ""}
          {moment.hasGps === false && moment.autoTagged ? `${tagInfo ? "  ·  " : ""}📡 NO GPS` : ""}
        </div>
      )}
      {nowPlaying && (
        <div style={{
          marginTop: 5, animation: "song-fade-in 0.5s ease-out",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 22, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${stage?.color || "var(--horizon)"}22`,
              animation: "song-ripple 1.5s ease-out",
            }}>
              <span style={{ fontSize: 10, color: stage?.color || "var(--horizon)" }}>♫</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{
                fontSize: 8, letterSpacing: 0.8, fontWeight: 700,
                color: stage?.color || "var(--horizon)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {nowPlaying.song?.toUpperCase()}
              </div>
              {nowPlaying.source === "1001tracklists" && artist && (() => {
                const CFG = window.FESTIVAL_CONFIG || {};
                const dm = CFG.dayDates?.[artist.day];
                if (!dm) return null;
                const [sh, sm] = artist.start.split(":").map(Number);
                const [eh, em] = artist.end.split(":").map(Number);
                const setStartMs = dm.midnightUtc + (sh < 6 ? sh + 24 : sh) * 3600000 + sm * 60000;
                const setEndMs = dm.midnightUtc + (eh < 6 ? eh + 24 : eh) * 3600000 + em * 60000;
                const photoMs = Date.parse(moment.takenAt?.replace(" ", "T"));
                if (isNaN(photoMs)) return null;
                const elapsed = photoMs - setStartMs;
                const duration = setEndMs - setStartMs;
                if (duration <= 0 || elapsed < 0) return null;
                const pct = Math.min(elapsed / duration, 1);
                const mins = Math.round(elapsed / 60000);
                const totalMins = Math.round(duration / 60000);
                return (
                  <div className="mono" style={{
                    fontSize: 8, letterSpacing: 0.8, color: "var(--muted)",
                    marginTop: 1, display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>{mins}min into {totalMins}min set</span>
                    <div style={{
                      width: 30, height: 3, borderRadius: 2,
                      background: "rgba(255,255,255,0.1)",
                    }}>
                      <div style={{
                        width: `${pct * 100}%`, height: "100%", borderRadius: 2,
                        background: stage?.color || "var(--horizon)",
                      }} />
                    </div>
                  </div>
                );
              })()}
            </div>
            <span className="mono" style={{
              fontSize: 8, letterSpacing: 0.8, padding: "2px 5px", borderRadius: 4, flexShrink: 0,
              background: nowPlaying.confidence === "exact" ? "rgba(45,122,85,0.15)" : "rgba(232,93,46,0.1)",
              color: nowPlaying.confidence === "exact" ? "var(--success)" : "var(--ember)",
              fontWeight: 700,
            }}>{nowPlaying.confidence === "exact" ? "EXACT" : "~EST"}</span>
          </div>
        </div>
      )}
      {editing && onUpdate && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: "1px solid var(--line)",
        }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
            NIGHT
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(window.DAYS || []).map(d => {
              const on = moment.night === d.n;
              return (
                <button key={d.n} onClick={() => moveToNight(d.n)} className="mono" style={{
                  flex: 1, padding: "6px 0", borderRadius: 8,
                  background: on ? "var(--ink)"   : "var(--paper)",
                  color:      on ? "var(--paper)" : "var(--ink)",
                  border:     on ? "none"          : "1px solid var(--line-2)",
                  fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                }}>{(d.label || `DAY ${d.n}`).toString().toUpperCase()}</button>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
            {showAll ? "ALL SETS THIS NIGHT" : (savedNightArtists?.length ? "YOUR SAVED SETS THIS NIGHT" : "SETS THIS NIGHT")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {pickerArtists
              .slice()
              .sort((a, b) => a.start.localeCompare(b.start))
              .map(a => {
                const on = moment.artistId === a.id;
                return (
                  <button key={a.id} onClick={() => setArtist(on ? null : a.id)} className="mono" style={{
                    padding: "5px 10px", borderRadius: 999,
                    background: on ? "var(--ink)"   : "var(--paper)",
                    color:      on ? "var(--paper)" : "var(--ink)",
                    border:     on ? "none"          : "1px solid var(--line-2)",
                    fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}>{a.name.toUpperCase()}</button>
                );
              })}
            {pickerArtists.length === 0 && (
              <span className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 600 }}>
                NO SETS LISTED FOR THIS NIGHT
              </span>
            )}
          </div>
          {savedNightArtists?.length > 0 && (nightArtists?.length || 0) > savedNightArtists.length && (
            <button onClick={() => setShowAll(s => !s)} className="mono" style={{
              background: "transparent", border: "none", color: "var(--muted)",
              cursor: "pointer", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
              padding: 0,
            }}>{showAll ? "← BACK TO SAVED ONLY" : "SHOW ALL SETS THIS NIGHT →"}</button>
          )}
        </div>
      )}
    </div>
  );
}

// Shared renderer for the ARTIST / STAGE views in MemoriesScreen.
// Takes a flat moment list and a key extractor, builds groups, sorts,
// and renders each group as a stage-colored header + the MomentCards
// under it. Untagged moments float to the bottom via the sortKeys hook.
// ── Hero pick (v205) ──────────────────────────────────────────────
// Score a moment for "best shot of this group" so night/artist/stage groups
// can lead with their strongest photo instead of just newest-first. Pure
// function over data we already capture — no new permissions. Higher = better.
//   • favorite (#7 hook)         — a human star always wins
//   • peak proximity             — shots near the set's climax (~75% through)
//                                  are the drops/sing-alongs you remember
//   • confirmedSong / video / GPS / caption — secondary "this was a real
//                                  moment" signals
function _heroScore(m) {
  if (!m || !m.photoId) return -Infinity;     // text-only can't be a cover
  let score = 0;
  if (m.favorite) score += 1000;
  const a = m.artistId ? (window.ARTISTS || []).find(x => x.id === m.artistId) : null;
  const cap = _momentCaptureMs(m);
  if (a && cap) {
    const dm = window.FESTIVAL_CONFIG?.dayDates?.[a.day];
    if (dm && a.start && a.end) {
      const [sh, sm] = a.start.split(":").map(Number);
      const [eh, em] = a.end.split(":").map(Number);
      const s = dm.midnightUtc + ((sh < 8 ? sh + 24 : sh) * 60 + sm) * 60000;
      const e = dm.midnightUtc + ((eh < 8 ? eh + 24 : eh) * 60 + em) * 60000;
      const dur = e - s;
      if (dur > 0) {
        const peak = s + dur * 0.75;           // climax sits in the last third
        score += Math.max(0, 1 - Math.abs(cap - peak) / dur) * 60;
      }
    }
  }
  if (m.confirmedSong) score += 25;
  if (m.kind === "video") score += 20;
  if (m.hasGps)         score += 10;
  if (m.text)           score += 6;
  return score;
}
function _pickHeroMoment(items) {
  let best = null, bestScore = -Infinity;
  for (const m of (items || [])) {
    const s = _heroScore(m);
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return (best && best.photoId) ? best : ((items || []).find(m => m.photoId) || null);
}

// Small rounded cover thumb for a group header — deferred photo load like the
// cards. Lives outside the header <button> (no nested buttons) as its own tap
// target that opens the group's lightbox at the hero.
function _GroupHeroThumb({ moment, accent, onClick }) {
  const url = useMomentPhoto(moment?.photoId);
  if (!moment?.photoId) return null;
  return (
    <button onClick={onClick} aria-label="Open best shot" style={{
      flexShrink: 0, width: 46, height: 46, borderRadius: 10, padding: 0, cursor: "pointer",
      overflow: "hidden", border: `1.5px solid ${accent || "var(--line-2)"}`,
      background: "#222", position: "relative",
    }}>
      {url && (moment.kind === "video"
        ? <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}/>
        : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
      )}
      {moment.kind === "video" && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, textShadow: "0 1px 2px rgba(0,0,0,0.6)", pointerEvents: "none" }}>▶</span>
      )}
    </button>
  );
}

// "Your peak · 20 min" — the densest 20-minute window of the night, the
// stretch where you shot the most. A sliding window over capture times
// (EXIF, falling back to import time) picks the start that captures the most
// moments. Only a "peak" if it clusters 3+ — a sparse night has no peak.
function _peakWindow(moments, windowMs) {
  windowMs = windowMs || 20 * 60000;
  const timed = (moments || [])
    .filter(m => m.photoId)
    .map(m => ({ m, t: _momentCaptureMs(m) }))
    .filter(x => x.t > 0)
    .sort((a, b) => a.t - b.t);
  if (timed.length < 3) return null;
  let best = null;
  for (let i = 0; i < timed.length; i++) {
    const end = timed[i].t + windowMs;
    const items = [];
    for (let j = i; j < timed.length && timed[j].t < end; j++) items.push(timed[j].m);
    if (!best || items.length > best.items.length) {
      best = { items, startMs: timed[i].t, endMs: timed[i + items.length - 1].t };
    }
  }
  return (best && best.items.length >= 3) ? best : null;
}

// Spotify-Wrapped-style stat card for the peak window: the count, the clock
// range, a thumb strip, and a one-tap "relive" reel of just that stretch.
function _clock12(ms) {
  const d = new Date(ms);
  let h = d.getHours(); const mn = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(mn).padStart(2, "0")} ${ap}`;
}
function PeakMomentCard({ peak, accent, onOpenLightbox, onPlayReel }) {
  if (!peak) return null;
  const { items, startMs, endMs } = peak;
  const a = accent || "var(--ember)";
  return (
    <div style={{
      marginTop: 10, marginBottom: 6, borderRadius: 14, padding: 12,
      background: `linear-gradient(135deg, ${a}1f, var(--paper-2))`,
      border: `1px solid ${a}40`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ fontSize: 15 }}>🔥</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1.4, fontWeight: 800, color: a }}>
            YOUR PEAK · 20 MIN
          </div>
          <div className="serif" style={{ fontSize: 17, color: "var(--ink)", lineHeight: 1.1, marginTop: 1 }}>
            {items.length} moments in 20 minutes
          </div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", fontWeight: 600, marginTop: 2 }}>
            {_clock12(startMs)} – {_clock12(endMs)}
          </div>
        </div>
        {onPlayReel && (
          <button onClick={() => { try { window.plurskyHaptic?.("MEDIUM"); } catch {} onPlayReel(items); }} className="mono" style={{
            flexShrink: 0, background: a, color: "#fff", border: "none",
            borderRadius: 999, padding: "7px 13px", cursor: "pointer",
            fontSize: 9, letterSpacing: 1.2, fontWeight: 800,
            display: "flex", alignItems: "center", gap: 5,
          }}>▶ RELIVE</button>
        )}
      </div>
      <div className="no-scrollbar" style={{ display: "flex", gap: 5, overflowX: "auto", marginTop: 10 }}>
        {items.map((m, i) => (
          <_GroupHeroThumb key={m.id} moment={m} accent={a}
            onClick={() => onOpenLightbox?.(items, i)} />
        ))}
      </div>
    </div>
  );
}

// ── #3 Set-song timeline (v205) ───────────────────────────────────
// "The song you were filming." For a single-artist group, fetch the set's
// tracklist and surface a compact, tappable index of the tracks you captured
// — tap a song, jump straight to that photo/clip. Reuses _getTracklistForArtist
// + _matchSongAtTime (the same engine MomentCard's "now playing" line uses), so
// it renders nothing unless a real tracklist exists AND a capture maps to a
// track. confirmedSong (Shazam) always wins over the time-estimated match.
function SetSongTimeline({ artist, moments, onOpenMoment }) {
  const [data, setData] = React.useState(undefined); // undefined=loading · null=none
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!artist?.name) { setData(null); return; }
    let cancelled = false;
    _getTracklistForArtist(artist.name)
      .then(d => { if (!cancelled) setData(d || null); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [artist?.id]);

  const filmed = React.useMemo(() => {
    if (!data) return [];
    return (moments || [])
      .filter(m => m.photoId && (m.takenAt || m.confirmedSong))
      .map(m => {
        const match = m.confirmedSong
          ? { song: m.confirmedSong, confidence: "exact" }
          : _matchSongAtTime(artist, data, m.takenAt);
        return match?.song ? { m, song: match.song, confidence: match.confidence } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.m.takenAt || "").localeCompare(b.m.takenAt || ""));
  }, [data, moments, artist?.id]);

  const stage = artist ? (window.STAGES || []).find(s => s.id === artist.stage) : null;
  const accent = stage?.color || "var(--horizon)";
  if (data === undefined || !filmed.length) return null;

  return (
    <div style={{ margin: "2px 0 8px", padding: "8px 10px", background: "var(--paper-2)", border: `1px solid ${accent}33`, borderRadius: 12 }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="mono" style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        background: "transparent", border: "none", cursor: "pointer", padding: 0,
        color: accent, fontSize: 9, letterSpacing: 1.2, fontWeight: 800, textAlign: "left",
      }}>
        <span>🎵 {filmed.length} SONG{filmed.length === 1 ? "" : "S"} YOU FILMED</span>
        <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {filmed.map(({ m, song, confidence }) => (
            <div key={m.id} role="button" tabIndex={0}
              onClick={() => onOpenMoment?.(m)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenMoment?.(m); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10,
                padding: 6, cursor: "pointer", textAlign: "left",
              }}>
              <_GroupHeroThumb moment={m} accent={accent} onClick={() => onOpenMoment?.(m)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>♫ {song}</div>
                <div className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "var(--muted)", fontWeight: 700, marginTop: 2 }}>
                  {m.takenAt ? m.takenAt.slice(11) : ""}{confidence === "exact" ? " · EXACT" : " · ~EST"}{m.kind === "video" ? " · VIDEO" : ""}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 9, color: accent, fontWeight: 700, flexShrink: 0 }}>OPEN ›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function _renderByGroup({ allMoments, keyOf, headerFor, sortKeys, state, setState, handleDelete, handleUpdate, onOpenLightbox }) {
  const groups = new Map();
  for (const m of allMoments) {
    const k = keyOf(m);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const keys = [...groups.keys()].sort(sortKeys);
  if (keys.length === 0) {
    return (
      <div style={{
        padding: "28px 14px", textAlign: "center", marginTop: 18,
        border: "1px dashed var(--line-2)", borderRadius: 14,
        background: "var(--paper-2)",
      }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          NO MOMENTS YET — IMPORT FROM CAMERA ROLL ABOVE
        </div>
      </div>
    );
  }
  return keys.map(k => {
    const chrono = groups.get(k).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    // Lead with the strongest shot, then the rest newest-first. The same hero
    // is the group's cover thumbnail in the header.
    const hero = _pickHeroMoment(chrono);
    const items = hero ? [hero, ...chrono.filter(m => m.id !== hero.id)] : chrono;
    const h = headerFor(k);
    return (
      <div key={k} style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={h.onClick || undefined} disabled={!h.onClick} style={{
            display: "flex", alignItems: "center", gap: 8,
            flex: 1, minWidth: 0, padding: "6px 4px",
            background: "transparent", border: "none",
            textAlign: "left", cursor: h.onClick ? "pointer" : "default",
          }}>
            <span style={{
              width: 4, alignSelf: "stretch",
              background: h.accent, borderRadius: 3, minHeight: 30,
            }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: h.accent,
              }}>{h.mono}</div>
              <div className="serif" style={{
                fontSize: 18, color: "var(--ink)", lineHeight: 1.1, marginTop: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{h.serif}</div>
            </div>
            <span className="mono" style={{
              fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 700,
              flexShrink: 0,
            }}>{items.length} {items.length === 1 ? "MOMENT" : "MOMENTS"}</span>
          </button>
          {hero && onOpenLightbox && (
            <_GroupHeroThumb moment={hero} accent={h.accent}
              onClick={() => onOpenLightbox(items, 0)} />
          )}
        </div>
        {items.map((m, i) => (
          <MomentCard
            key={m.id}
            moment={m}
            idx={i}
            total={items.length}
            groupMoments={items}
            onOpenLightbox={onOpenLightbox}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            savedArtistIds={state.saved || []}
            onArtistClick={(id) => setState(s => ({ ...s, artist: id }))}
          />
        ))}
      </div>
    );
  });
}

function AddMomentForm({ night, savedNightArtists, onAdd, onCancel }) {
  const [blob,       setBlob]       = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [text,       setText]       = React.useState("");
  const [artistId,   setArtistId]   = React.useState(null);
  const [busy,       setBusy]       = React.useState(false);
  const [err,        setErr]        = React.useState("");

  // Revoke any preview URL on unmount/replace.
  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const [mediaKind, setMediaKind] = React.useState("image"); // image | video
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try {
      // Read EXIF / fall back to file.lastModified so the matcher can pre-fill
      // the artist chip. _compressMomentImage strips EXIF (canvas re-encode)
      // so we have to read it BEFORE processing.
      const exif = await _parseExifMeta(file).catch(() => null);
      const meta = _metaFromFile(file, exif);
      if (meta && meta.date && !artistId) {
        const attendedIds = Object.values(window.getAllAttended?.() || {}).flat();
        const matched = _matchArtistForPhoto(meta, savedNightArtists.map(a => a.id), attendedIds);
        if (matched.artistId) setArtistId(matched.artistId);
      }
      const out = await _processMomentMedia(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(out.blob);
      setMediaKind(out.kind);
      setPreviewUrl(URL.createObjectURL(out.blob));
    } catch (err) {
      setErr(err?.message || "Couldn't load that file.");
    }
    setBusy(false);
  };
  const clearPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!blob && !text.trim()) {
      setErr("Add a photo or some text first.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let photoId = null;
      if (blob) {
        photoId = `p_${id}`;
        await _putPhoto(photoId, blob);
      }
      const moment = {
        id, night, text: text.trim(), artistId, photoId,
        kind: blob ? mediaKind : null,
        createdAt: Date.now(),
        festivalId: window.FESTIVAL_CONFIG?.id || null,
        tagSource: artistId ? "manual" : undefined,
      };
      onAdd(moment);
    } catch (e) {
      if (e?.name === "QuotaExceededError" || e?.message?.includes("quota")) {
        setErr("Storage full — delete an older moment to free space.");
      } else {
        setErr("Couldn't save. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: "var(--paper-2)", border: "1px solid var(--line-2)",
      borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 14,
    }}>
      {previewUrl ? (
        <div style={{ position: "relative", marginBottom: 10 }}>
          {mediaKind === "video" ? (
            <video src={previewUrl} controls playsInline
              style={{ width: "100%", borderRadius: 10, display: "block", background: "#000" }}/>
          ) : (
            <img src={previewUrl} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }}/>
          )}
          <button onClick={clearPhoto} aria-label="Remove media" style={{
            position: "absolute", top: 8, right: 8,
            width: 28, height: 28, borderRadius: 999,
            background: "rgba(0,0,0,0.55)", color: "#fff",
            border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}>×</button>
        </div>
      ) : (
        <label style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px", background: "var(--paper)", border: "1px dashed var(--line-2)",
          borderRadius: 10, cursor: "pointer", marginBottom: 10,
          color: "var(--muted)",
          fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
        }}>
          <span>📷 ADD PHOTO OR VIDEO (OPTIONAL)</span>
          <input type="file" accept="image/*,video/*"
            onChange={handlePhoto} style={{ display: "none" }}/>
        </label>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What happened?"
        rows={2}
        maxLength={240}
        style={{
          width: "100%", padding: "10px 12px", boxSizing: "border-box",
          background: "var(--paper)", border: "1px solid var(--line-2)",
          borderRadius: 10, resize: "none",
          fontFamily: "Geist, sans-serif", fontSize: 14, lineHeight: 1.4,
          color: "var(--ink)", outline: "none", marginBottom: 10,
        }}
      />

      {savedNightArtists.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginBottom: 6, fontWeight: 700 }}>
            TAG A SET (OPTIONAL)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {savedNightArtists.map(a => {
              const on = artistId === a.id;
              return (
                <button key={a.id} onClick={() => setArtistId(on ? null : a.id)} className="mono" style={{
                  padding: "5px 10px", borderRadius: 999,
                  background: on ? "var(--ink)"  : "var(--paper)",
                  color:      on ? "var(--paper)" : "var(--ink)",
                  border:     on ? "none"         : "1px solid var(--line-2)",
                  fontSize: 9, letterSpacing: 1, fontWeight: 700, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>{a.name.toUpperCase()}</button>
              );
            })}
          </div>
        </div>
      )}

      {err && (
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "#c14a4a", marginBottom: 10, fontWeight: 700 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} disabled={busy} className="mono" style={{
          flex: 1, padding: "12px", borderRadius: 10,
          background: "transparent", border: "1px solid var(--line-2)", color: "var(--ink)",
          fontSize: 10, letterSpacing: 1.2, fontWeight: 700, cursor: busy ? "default" : "pointer",
        }}>CANCEL</button>
        <button onClick={handleSave} disabled={busy} className="mono" style={{
          flex: 2, padding: "12px", borderRadius: 10,
          background: busy ? "var(--muted)" : "var(--ember)",
          color: "#fff", border: "none",
          fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}>{busy ? "WORKING…" : "✓ SAVE MOMENT"}</button>
      </div>
    </div>
  );
}


// v150: Manage-storage panel rendered at the bottom of the Memories screen.
// Surfaces how much disk space Plursky is using (via the Storage Manager
// API) + lets the user purge moments per-night or wholesale. Each delete
// nukes both the localStorage metadata AND the IndexedDB photo blob so
// nothing leaks.
async function _purgeNightMoments(night) {
  const all = _readMoments();
  const list = all[night] || [];
  for (const m of list) {
    if (m.photoId) { try { await _deletePhoto(m.photoId); } catch {} }
  }
  delete all[night];
  _writeMoments(all);
}
async function _purgeAllMoments() {
  const all = _readMoments();
  for (const list of Object.values(all)) {
    for (const m of list || []) {
      if (m.photoId) { try { await _deletePhoto(m.photoId); } catch {} }
    }
  }
  _writeMoments({});
}

function StorageManager({ all, onChange }) {
  const [usage, setUsage] = React.useState(null);
  const [busy, setBusy]   = React.useState(false);
  const [confirming, setConfirming] = React.useState(null); // night | 'all' | null

  const refresh = React.useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        const e = await navigator.storage.estimate();
        setUsage({ used: e.usage || 0, quota: e.quota || 0 });
      } else setUsage({ used: null, quota: null });
    } catch { setUsage({ used: null, quota: null }); }
  }, []);
  React.useEffect(() => { refresh(); }, [refresh, all]);

  const totalMoments = Object.values(all).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  if (totalMoments === 0) return null;

  const fmtBytes = (b) => {
    if (b == null) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  };
  const usedPct = usage?.quota ? Math.round((usage.used / usage.quota) * 100) : null;

  const handlePurge = async (target) => {
    setBusy(true);
    try {
      if (target === "all") await _purgeAllMoments();
      else                  await _purgeNightMoments(target);
    } finally {
      setBusy(false);
      setConfirming(null);
      onChange?.();
    }
  };

  const DAYS = window.DAYS || [];

  return (
    <div style={{
      marginTop: 22, padding: "14px 16px",
      background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 14,
    }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>
        STORAGE
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: "var(--ink)" }}>
          {totalMoments} moment{totalMoments === 1 ? "" : "s"}
        </span>
        {usage?.used != null && (
          <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
            {fmtBytes(usage.used)}{usage.quota ? ` / ${fmtBytes(usage.quota)}` : ""}
          </span>
        )}
      </div>
      {usedPct != null && (
        <>
          <div style={{ height: 4, background: "var(--paper)", borderRadius: 4, overflow: "hidden", marginBottom: usedPct > 80 ? 6 : 10 }}>
            <div style={{
              height: "100%", width: `${Math.min(100, usedPct)}%`,
              background: usedPct > 80 ? "var(--ember)" : "var(--horizon)",
              transition: "width 0.3s",
            }}/>
          </div>
          {usedPct > 80 && (
            <div className="mono" style={{
              fontSize: 9, letterSpacing: 1.2, fontWeight: 700, marginBottom: 10,
              color: "var(--ember)", background: "rgba(232,93,46,0.10)",
              border: "1px solid rgba(232,93,46,0.3)", borderRadius: 8,
              padding: "6px 10px",
            }}>
              ⚠ STORAGE {usedPct}% FULL · PURGE OLD NIGHTS TO FREE SPACE
            </div>
          )}
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
        {DAYS.map(d => {
          const list = all[d.n] || [];
          if (list.length === 0) return null;
          const photos = list.filter(m => m.photoId && m.kind !== "video").length;
          const videos = list.filter(m => m.kind === "video").length;
          const isConfirm = confirming === d.n;
          return (
            <div key={d.n} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 8,
              background: isConfirm ? "rgba(232,93,46,0.10)" : "var(--paper)",
              border: isConfirm ? "1px solid rgba(232,93,46,0.5)" : "1px solid var(--line)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--ink)" }}>
                  {d.label} <span className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>· {list.length} TOTAL</span>
                </div>
                {(photos > 0 || videos > 0) && (
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>
                    {photos > 0 && `${photos} PHOTO${photos === 1 ? "" : "S"}`}
                    {photos > 0 && videos > 0 && " · "}
                    {videos > 0 && `${videos} VIDEO${videos === 1 ? "" : "S"}`}
                  </div>
                )}
              </div>
              {isConfirm ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setConfirming(null)} disabled={busy} className="mono" style={{
                    padding: "4px 9px", borderRadius: 999, background: "transparent", border: "1px solid var(--line-2)",
                    color: "var(--ink)", cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  }}>CANCEL</button>
                  <button onClick={() => handlePurge(d.n)} disabled={busy} className="mono" style={{
                    padding: "4px 9px", borderRadius: 999, background: "var(--ember)", color: "#fff", border: "none",
                    cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                  }}>{busy ? "..." : "DELETE"}</button>
                </div>
              ) : (
                <button onClick={() => setConfirming(d.n)} aria-label="Clear night" className="mono" style={{
                  padding: "4px 9px", borderRadius: 999, background: "transparent", border: "1px solid var(--line-2)",
                  color: "var(--muted)", cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                }}>CLEAR</button>
              )}
            </div>
          );
        })}
      </div>
      {totalMoments > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {confirming === "all" ? (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(232,93,46,0.10)", border: "1px solid rgba(232,93,46,0.5)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <span style={{ fontSize: 13, color: "var(--ink)" }}>
                Delete all {totalMoments} moments?
              </span>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setConfirming(null)} disabled={busy} className="mono" style={{
                  padding: "5px 10px", borderRadius: 999, background: "transparent", border: "1px solid var(--line-2)",
                  color: "var(--ink)", cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                }}>NO</button>
                <button onClick={() => handlePurge("all")} disabled={busy} className="mono" style={{
                  padding: "5px 10px", borderRadius: 999, background: "var(--ember)", color: "#fff", border: "none",
                  cursor: "pointer", fontSize: 9, letterSpacing: 1, fontWeight: 700,
                }}>{busy ? "..." : "DELETE ALL"}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming("all")} className="mono" style={{
              padding: "8px 14px", width: "100%", borderRadius: 8,
              background: "transparent", border: "1px dashed var(--line-2)",
              color: "var(--muted)", cursor: "pointer",
              fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
            }}>🗑  CLEAR ALL MEMORIES</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recap reel — the auto-advancing montage ──────────────────────
// Full-screen story player (Instagram/Snapchat/Apple Memory Mixes): segmented
// progress bars up top, a Ken Burns drift on photos, autoplay for video, the
// artist + song that was playing animated over each beat. Tap right=next,
// left=prev, press-and-hold=pause. Ends on a recap card with Share + Replay.
// No background music track (we can't license one) — video beats play their
// own audio, photo beats are silent.
function MemoryReel({ moments, festival, nightLabel, night, onClose, onOpenArtist, onMakeVideo }) {
  const [idx, setIdx] = React.useState(0);
  const [ended, setEnded] = React.useState(false);
  const [prog, setProg] = React.useState(0);
  const pausedRef = React.useRef(false);
  const [pausedUI, setPausedUI] = React.useState(false);
  const m = moments[idx];
  const url = useMomentPhoto(m?.photoId);
  const vidRef = React.useRef(null);
  const advanceRef = React.useRef(() => {});

  const artist = m?.artistId ? ARTISTS.find(a => a.id === m.artistId) : null;
  const stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const est = useSetlistSong(artist, m?.takenAt);
  const song = m?.confirmedSong || est?.song;
  const PHOTO_MS = 3800;
  const dur = m?.kind === "video" ? Math.min((m.duration || 6), 15) * 1000 : PHOTO_MS;

  advanceRef.current = () => {
    if (idx + 1 >= moments.length) { setEnded(true); }
    else { setIdx(idx + 1); }
  };

  const setPaused = (v) => { pausedRef.current = v; setPausedUI(v); const vid = vidRef.current; if (vid) { if (v) vid.pause(); else vid.play().catch(() => {}); } };

  // Per-slide progress + auto-advance. Re-runs only when the slide changes;
  // pause is read from a ref so toggling it doesn't restart the timer.
  React.useEffect(() => {
    if (ended || !m) return;
    let raf, last = performance.now(), acc = 0, stop = false;
    setProg(0);
    const tick = (now) => {
      if (stop) return;
      // Clamp the frame delta: a backgrounded tab freezes RAF, so the first
      // frame after resume would otherwise carry the whole hidden duration
      // and fast-forward past several beats. 100ms also smooths any GC stall.
      const dt = Math.min(now - last, 100); last = now;
      if (!pausedRef.current) {
        acc += dt;
        const p = Math.min(1, acc / dur);
        setProg(p);
        if (p >= 1) { advanceRef.current(); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); };
  }, [idx, ended, dur]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") advanceRef.current();
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Backgrounding the app would otherwise keep the (muted) video playing and
  // let progress lurch on return. Pause on hide; the user taps to resume so
  // they never miss a beat they weren't looking at.
  React.useEffect(() => {
    const onVis = () => { if (document.hidden) setPaused(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Hold-to-pause vs tap-to-navigate.
  const holdRef = React.useRef({ t: null, held: false });
  const onDown = () => { holdRef.current.held = false; holdRef.current.t = setTimeout(() => { holdRef.current.held = true; setPaused(true); }, 180); };
  const onUp = (e, side) => {
    clearTimeout(holdRef.current.t);
    if (holdRef.current.held) { setPaused(false); return; }
    if (side === "prev") { if (idx > 0) setIdx(idx - 1); }
    else advanceRef.current();
  };

  const fmtTime = (() => {
    if (!m?.takenAt) return null;
    try { const [h, mm] = (m.takenAt.split(" ")[1] || "").split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`; } catch { return null; }
  })();

  const tagged = moments.filter(x => x.artistId).length;
  const vids = moments.filter(x => x.kind === "video").length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "#000", overflow: "hidden", animation: "fadeIn .2s" }}>
      <style>{`@keyframes plurskyKB{from{transform:scale(1.001) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-2%)}}@keyframes reelIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      {!ended ? (
        <>
          {/* Media */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
            {url && (m.kind === "video" ? (
              // Muted so iOS reliably autoplays each beat (autoplay-with-sound
              // is blocked without a fresh gesture); full audio lives in the
              // lightbox. The song that was playing still shows as a caption.
              <video ref={vidRef} key={m.id} src={url} autoPlay playsInline muted
                onEnded={() => advanceRef.current()}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
            ) : (
              <img key={m.id} src={url} alt="" style={{
                width: "100%", height: "100%", objectFit: "cover",
                animation: `plurskyKB ${PHOTO_MS + 400}ms linear forwards`,
                animationPlayState: pausedUI ? "paused" : "running",
              }}/>
            ))}
            {/* Legibility scrims */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160, background: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent)", pointerEvents: "none" }}/>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 280, background: "linear-gradient(0deg, rgba(0,0,0,0.75), transparent)", pointerEvents: "none" }}/>
          </div>

          {/* Tap zones */}
          <div onPointerDown={onDown} onPointerUp={(e) => onUp(e, "prev")} style={{ position: "absolute", left: 0, top: 60, bottom: 0, width: "33%", zIndex: 4 }}/>
          <div onPointerDown={onDown} onPointerUp={(e) => onUp(e, "next")} style={{ position: "absolute", right: 0, top: 60, bottom: 0, width: "67%", zIndex: 4 }}/>

          {/* Progress segments */}
          <div style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top, 0px))", left: 12, right: 12, display: "flex", gap: 4, zIndex: 6 }}>
            {moments.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#fff", width: i < idx ? "100%" : i === idx ? `${prog * 100}%` : "0%", transition: i === idx ? "none" : "width .2s" }}/>
              </div>
            ))}
          </div>

          {/* Close + pause hint */}
          <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: "calc(24px + env(safe-area-inset-top, 0px))", right: 14, zIndex: 7, width: 34, height: 34, borderRadius: 34, background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>

          {/* Caption */}
          <div key={`cap-${idx}`} style={{ position: "absolute", left: 20, right: 20, bottom: "calc(34px + env(safe-area-inset-bottom, 0px))", zIndex: 6, animation: "reelIn .4s ease-out", pointerEvents: "none" }}>
            {fmtTime && <div className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: "rgba(255,255,255,0.75)", fontWeight: 700, marginBottom: 6 }}>{fmtTime}</div>}
            <div className="serif" style={{ fontSize: 34, lineHeight: 1, color: "#fff" }}>{artist?.name || "A moment"}</div>
            {song && <div className="mono" style={{ fontSize: 11, letterSpacing: 0.8, color: stage?.color || "#e85d2e", fontWeight: 700, marginTop: 8 }}>♫ {song}{m.confirmedSong ? " · SHAZAMED" : ""}</div>}
            {stage && <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(255,255,255,0.6)", fontWeight: 600, marginTop: 4 }}>{stage.name.toUpperCase()}</div>}
          </div>

          {pausedUI && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
              <div style={{ width: 64, height: 64, borderRadius: 64, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24 }}>❚❚</div>
            </div>
          )}
        </>
      ) : (
        /* Recap card */
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center", background: "radial-gradient(120% 80% at 50% 0%, rgba(232,93,46,0.25), #0d0a08 60%)" }}>
          <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: "calc(24px + env(safe-area-inset-top, 0px))", right: 14, width: 34, height: 34, borderRadius: 34, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.6)", fontWeight: 700, marginBottom: 14 }}>THAT WAS</div>
          <div className="serif" style={{ fontSize: 44, lineHeight: 1.05, color: "#fff", marginBottom: 10 }}>
            Your <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{nightLabel || "night"}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: 1.3, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>
            {moments.length} {moments.length === 1 ? "MOMENT" : "MOMENTS"}{tagged ? ` · ${tagged} TAGGED` : ""}{vids ? ` · ${vids} VIDEO${vids === 1 ? "" : "S"}` : ""}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 30 }}>
            <button onClick={() => { setEnded(false); setIdx(0); }} className="mono" style={{ padding: "12px 20px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 11, letterSpacing: 1.3, fontWeight: 700, cursor: "pointer" }}>↺ REPLAY</button>
            {/* Share the whole night as a multi-moment collage (matches the
                night-view 📸 SHARE), not a single hero photo. Falls back to a
                single-moment story card if this reel isn't tied to a night. */}
            <button onClick={async () => {
              if (night != null && window._shareNightCollage) {
                await window._shareNightCollage(night, moments).catch(() => {});
                return;
              }
              const hero = _pickHeroMoment(moments) || moments.find(x => x.kind === "video") || moments.find(x => x.artistId) || moments[0];
              if (!hero) return;
              const a = hero.artistId ? ARTISTS.find(x => x.id === hero.artistId) : null;
              const s = a ? STAGES.find(x => x.id === a.stage) : null;
              await _shareMoment(hero, { artistName: a?.name, songLabel: hero.confirmedSong || null, stageColor: s?.color, subLabel: nightLabel, festival }).catch(() => {});
            }} className="mono" style={{ padding: "12px 20px", borderRadius: 999, background: "#fff", border: "none", color: "#0d0a08", fontSize: 11, letterSpacing: 1.3, fontWeight: 800, cursor: "pointer" }}>↗ SHARE</button>
          </div>
          {/* Cross-link to the exportable MP4 — instant in-app play and the
              beat-synced recap video are complementary, not duplicates. Only
              shown when there are ≥3 moments, since RecapScreen gates the
              RECAP VIDEO card on momentsCount >= 3 — below that this would
              dead-end on a screen with no exporter. */}
          {onMakeVideo && moments.length >= 3 && (
            <button onClick={() => { onClose(); onMakeVideo(); }} className="mono" style={{ marginTop: 14, padding: "10px 18px", borderRadius: 999, background: "transparent", border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)", fontSize: 10, letterSpacing: 1.3, fontWeight: 700, cursor: "pointer" }}>🎬 CREATE RECAP VIDEO</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── "That Night" story view ──────────────────────────────────────
// Weaves the four facts into one chronological scroll per night: a
// vertical timeline where each captured moment becomes a beat —
// time · artist · the song that was playing · the photo. Reads like
// a story of the night instead of a grid of files. The emotional
// payoff surface for the who/what/where/when graph.
function _MemoryStoryBeat({ moment, isLast, onOpen }) {
  const url = useMomentPhoto(moment.photoId);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  const stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  const estSong = useSetlistSong(artist, moment.takenAt);
  const song = moment.confirmedSong || estSong?.song;
  const accent = stage?.color || "var(--muted)";
  const time = (() => {
    if (!moment.takenAt) return null;
    try {
      const [h, mm] = (moment.takenAt.split(" ")[1] || "").split(":").map(Number);
      const ap = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(mm).padStart(2,"0")} ${ap}`;
    } catch { return null; }
  })();
  return (
    <div style={{ display: "flex", gap: 12, position: "relative" }}>
      {/* Timeline rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
        <div style={{ width: 11, height: 11, borderRadius: 11, background: accent, marginTop: 5, boxShadow: `0 0 0 3px ${accent}22` }}/>
        {!isLast && <div style={{ flex: 1, width: 2, background: "var(--line)", marginTop: 2 }}/>}
      </div>
      {/* Beat */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>
        {time && <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700, marginBottom: 3 }}>{time}</div>}
        {artist ? (
          <div className="serif" style={{ fontSize: 20, lineHeight: 1.05, color: "var(--ink)" }}>{artist.name}</div>
        ) : (
          <div className="serif" style={{ fontSize: 18, fontStyle: "italic", color: "var(--muted)" }}>A moment</div>
        )}
        {song && (
          <div className="mono" style={{ fontSize: 9, letterSpacing: 0.8, color: accent, fontWeight: 700, marginTop: 3 }}>
            ♫ {song}{moment.confirmedSong ? " · SHAZAMED" : ""}
          </div>
        )}
        {stage && (
          <div className="mono" style={{ fontSize: 8, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>{stage.name.toUpperCase()}</div>
        )}
        {url && (
          <button onClick={onOpen} aria-label="Open moment" style={{ marginTop: 8, padding: 0, border: "none", background: "none", cursor: "pointer", display: "block", width: "100%", position: "relative" }}>
            {moment.kind === "video" ? (
              <>
                {/* preload="metadata" paints the first frame as a poster;
                    tapping opens the lightbox player (controls + autoplay).
                    Before the fix this rendered inside an <img>, so video
                    moments showed as a broken tile in the default Story view. */}
                <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{
                  width: "100%", borderRadius: 12, display: "block",
                  maxHeight: 340, objectFit: "cover", background: "#000",
                  pointerEvents: "none",
                }}/>
                <span style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center", pointerEvents: "none",
                }}>
                  <span style={{
                    width: 52, height: 52, borderRadius: 52,
                    background: "rgba(0,0,0,0.5)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 19, paddingLeft: 3,
                  }}>▶</span>
                </span>
                <_VideoBadge seconds={moment.duration} style={{ position: "absolute", bottom: 8, right: 8 }}/>
              </>
            ) : (
              <img src={url} alt="" style={{ width: "100%", borderRadius: 12, display: "block", maxHeight: 340, objectFit: "cover" }}/>
            )}
            {moment.favorite && <_FavBadge style={{ top: 8, left: 8 }}/>}
          </button>
        )}
      </div>
    </div>
  );
}

// Night scrubber — drag along the night to scan it by time. Each moment is a
// tick placed by its capture time across the night's span; dragging snaps to
// the nearest moment and previews its thumb + clock, release opens it in the
// lightbox. Models the Apple Photos year-scrubber / a video timeline. Pointer
// events cover mouse + touch; setPointerCapture keeps the drag smooth.
function _ScrubPreview({ moment }) {
  const url = useMomentPhoto(moment?.photoId);
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 10, overflow: "hidden",
      border: "1.5px solid var(--ink)", background: "#000", flexShrink: 0,
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    }}>
      {url && (moment.kind === "video"
        ? <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>)}
    </div>
  );
}
function NightScrubber({ moments, onSeek }) {
  const trackRef = React.useRef(null);
  const [active, setActive] = React.useState(null); // index while dragging, else null
  const timed = React.useMemo(
    () => (moments || []).map(m => ({ m, t: _momentCaptureMs(m) })).sort((a, b) => a.t - b.t),
    [moments]
  );
  if (timed.length < 2) return null;
  const t0 = timed[0].t, t1 = timed[timed.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const fracOf = (i) => (timed[i].t - t0) / span;
  const idxFromX = (clientX) => {
    const el = trackRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    let best = 0, bd = Infinity;
    for (let i = 0; i < timed.length; i++) { const d = Math.abs(fracOf(i) - f); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const down = (e) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const i = idxFromX(e.clientX); if (i !== active) { try { window.plurskyHaptic?.("LIGHT"); } catch {} } setActive(i);
  };
  const move = (e) => { if (active == null) return; const i = idxFromX(e.clientX); if (i !== active) { try { window.plurskyHaptic?.("LIGHT"); } catch {} setActive(i); } };
  const up = () => { if (active != null) onSeek?.(active); setActive(null); };

  // Hour gridlines across the span.
  const hourMarks = [];
  const firstHour = Math.ceil(t0 / 3600000) * 3600000;
  for (let h = firstHour; h <= t1; h += 3600000) hourMarks.push(h);
  const activeFrac = active != null ? fracOf(active) : null;

  return (
    <div style={{ marginBottom: 16, userSelect: "none" }}>
      {/* Preview bubble while dragging */}
      <div style={{ height: 66, display: "flex", alignItems: "flex-end", marginBottom: 4, position: "relative" }}>
        {active != null && (
          <div style={{
            position: "absolute", bottom: 0,
            left: `clamp(0px, ${activeFrac * 100}%, 100%)`, transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            pointerEvents: "none",
          }}>
            <_ScrubPreview moment={timed[active].m} />
            <span className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: "var(--ink)", fontWeight: 700 }}>
              {_clock12(timed[active].t)}
            </span>
          </div>
        )}
      </div>
      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="slider" aria-label="Scrub the night by time"
        aria-valuemin={0} aria-valuemax={timed.length - 1} aria-valuenow={active ?? 0}
        style={{ position: "relative", height: 26, cursor: "pointer", touchAction: "none" }}
      >
        {/* base rail */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 11, height: 4, borderRadius: 4, background: "var(--line)" }}/>
        {/* hour ticks */}
        {hourMarks.map((h, i) => {
          const f = (h - t0) / span;
          return <div key={`h${i}`} style={{ position: "absolute", left: `${f * 100}%`, top: 7, width: 1, height: 12, background: "var(--line-2)" }}/>;
        })}
        {/* moment ticks */}
        {timed.map((x, i) => {
          const on = i === active;
          const fav = x.m.favorite;
          return (
            <div key={x.m.id} style={{
              position: "absolute", left: `${fracOf(i) * 100}%`, top: on ? 4 : 8,
              transform: "translateX(-50%)",
              width: on ? 4 : 3, height: on ? 18 : 10, borderRadius: 3,
              background: fav ? "#f5c451" : (on ? "var(--ink)" : "var(--ember)"),
              opacity: on ? 1 : 0.7, transition: "all .08s ease",
            }}/>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span className="mono" style={{ fontSize: 8, letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700 }}>{_clock12(t0)}</span>
        <span className="mono" style={{ fontSize: 8, letterSpacing: 0.8, color: "var(--muted)", fontWeight: 700 }}>{_clock12(t1)}</span>
      </div>
    </div>
  );
}

function MemoryStory({ allMoments, state, setState, onOpenLightbox, onPlayReel }) {
  const [night, setNight] = React.useState(() => {
    const nights = [...new Set(allMoments.map(m => m.night))].sort((a, b) => a - b);
    return nights[0] || NOW.day || 1;
  });
  const nights = React.useMemo(
    () => [...new Set(allMoments.map(m => m.night))].sort((a, b) => a - b),
    [allMoments]
  );
  const beats = React.useMemo(() => {
    return allMoments
      .filter(m => m.night === night)
      .sort((a, b) => {
        const ta = a.takenAt || "", tb = b.takenAt || "";
        if (ta && tb) return ta.localeCompare(tb);
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }, [allMoments, night]);

  if (allMoments.length === 0) {
    return (
      <div style={{ padding: "28px 14px", textAlign: "center", marginTop: 18, border: "1px dashed var(--line-2)", borderRadius: 14, background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          NO MOMENTS YET — IMPORT FROM CAMERA ROLL ABOVE
        </div>
      </div>
    );
  }

  const dayMeta = DAYS.find(d => d.n === night);
  return (
    <div style={{ marginTop: 14 }}>
      {nights.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {nights.map(n => {
            const dm = DAYS.find(d => d.n === n);
            const on = n === night;
            return (
              <button key={n} onClick={() => setNight(n)} className="mono" style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                background: on ? "var(--ink)" : "var(--paper-2)",
                color: on ? "var(--paper)" : "var(--muted)",
                border: on ? "none" : "1px solid var(--line)",
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
              }}>{dm?.label || `DAY ${n}`}</button>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <div className="serif" style={{ fontSize: 26, lineHeight: 1, color: "var(--ink)" }}>
          {dayMeta ? dayMeta.label.charAt(0) + dayMeta.label.slice(1).toLowerCase() : `Night ${night}`} <span style={{ fontStyle: "italic", color: "var(--ember)" }}>night</span>
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 4, fontWeight: 700 }}>
          {beats.length} {beats.length === 1 ? "MOMENT" : "MOMENTS"} · YOUR STORY
        </div>
      </div>
      <NightScrubber moments={beats} onSeek={(i) => onOpenLightbox(beats, i)} />
      {beats.length >= 2 && onPlayReel && (
        <button onClick={() => onPlayReel(beats, dayMeta ? (dayMeta.label.charAt(0) + dayMeta.label.slice(1).toLowerCase()) + " night" : `Night ${night}`, night)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          width: "100%", marginBottom: 18, padding: "13px 16px", borderRadius: 14,
          background: "linear-gradient(135deg, var(--ember), #7b3d9a)", border: "none",
          color: "#fff", cursor: "pointer",
        }}>
          <span style={{ fontSize: 15 }}>▶</span>
          <span className="mono" style={{ fontSize: 12, letterSpacing: 1.4, fontWeight: 800 }}>PLAY</span>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1, fontWeight: 600, opacity: 0.8 }}>· {beats.length} BEATS</span>
        </button>
      )}
      {beats.map((m, i) => (
        <_MemoryStoryBeat
          key={m.id}
          moment={m}
          isLast={i === beats.length - 1}
          onOpen={() => onOpenLightbox(beats, i)}
        />
      ))}
    </div>
  );
}

// Render-windowing wrapper (no lib). Mounts `children` only while the row is
// near the viewport (rootMargin pre-mounts ~one screen ahead so scrolling
// reveals ready tiles, not skeletons); otherwise renders a fixed-size
// placeholder so scroll position is preserved. Unmounting off-screen tiles
// frees their decoded image/video AND lets useMomentPhoto's cleanup revoke
// the object URL — the fix for the leaked-video-URL pile-up and the jank that
// hit once the grid held 100+ moments (every tile used to mount at once, each
// holding a live blob URL + a <video preload=metadata>). Falls back to
// always-visible where IntersectionObserver is absent.
function _LazyMount({ children, placeholder, minHeight = 120, rootMargin = "800px 0px", style }) {
  const ref = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  const [measured, setMeasured] = React.useState(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.IntersectionObserver) { setVisible(true); return; }
    const obs = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      if (e.isIntersecting) { setVisible(true); }
      else {
        // Snapshot the rendered footprint before unmounting so the spacer
        // keeps the same height (no scroll jump when content drops out).
        const h = el.offsetHeight;
        if (h) setMeasured(h);
        setVisible(false);
      }
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return (
    <div ref={ref} style={style}>
      {visible
        ? children
        : (placeholder != null
            ? placeholder
            : <div aria-hidden="true" style={{ height: measured || minHeight }} />)}
    </div>
  );
}

// A++ default lens: a dense, scannable photo grid of every moment (newest
// first) — the view people expect from a "memories" tab (Apple/Google Photos,
// Retro, Snapchat). Tap a tile → full-screen lightbox.
function _GridTile({ moment, onClick, stackCount = 1 }) {
  const url = useMomentPhoto(moment.photoId);
  const artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  const stacked = stackCount > 1;
  return (
    <button onClick={onClick} style={{
      position: "relative", width: "100%", height: "100%", aspectRatio: "1 / 1",
      borderRadius: 10, overflow: "hidden",
      border: "1px solid var(--line)", background: url ? "#000" : "var(--paper-2)",
      padding: 0, cursor: "pointer",
      // Burst stack: fake two cards peeking out bottom-right (Apple Photos
      // stack tile). Shadow stays within the 6px grid gap so it doesn't
      // collide with the neighbour.
      boxShadow: stacked
        ? "2.5px 2.5px 0 -0.5px var(--paper-2), 2.5px 2.5px 0 0 var(--line), 5px 5px 0 -1px var(--paper-2), 5px 5px 0 -0.5px var(--line)"
        : "none",
    }}>
      {url ? (moment.kind === "video"
        ? <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}/>
        : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
      ) : <div className="skel" style={{ width: "100%", height: "100%" }}/>}
      {moment.kind === "video" && <_VideoBadge seconds={moment.duration} style={{ position: "absolute", top: 5, right: 5 }}/>}
      {stacked && (
        <span className="mono" aria-label={`Burst of ${stackCount}`} style={{
          position: "absolute", top: 5, right: 5,
          display: "inline-flex", alignItems: "center", gap: 3,
          background: "rgba(0,0,0,0.6)", color: "#fff",
          fontSize: 8, letterSpacing: 0.5, fontWeight: 700,
          padding: "2px 6px", borderRadius: 999, pointerEvents: "none",
        }}><span style={{ fontSize: 9 }}>⧉</span>{stackCount}</span>
      )}
      {moment.favorite && <_FavBadge style={{ top: 5, left: 5 }}/>}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent)", padding: "16px 6px 5px" }}>
        <div className="mono" style={{ fontSize: 7.5, letterSpacing: 0.5, color: artist ? "#fff" : "rgba(255,255,255,0.7)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {artist ? artist.name.toUpperCase() : "+ TAP TO TAG"}
        </div>
      </div>
    </button>
  );
}

// Burst stacking: collapse a run of photos shot in quick succession (same
// artist/untagged, ≤4s apart, images — not videos) into one stacked tile, so
// 12 near-identical shots of a drop don't bury the rest of the night. Operates
// on the already-sorted (newest-first) list, so burst siblings are adjacent.
// The lightbox still receives the FULL list, so swiping traverses the whole
// burst — the collapse is display-only.
function _stackBursts(sorted, burstMs) {
  burstMs = burstMs || 4000;
  const stageOf = (m) => m.stageId || (m.artistId ? ARTISTS.find(a => a.id === m.artistId)?.stage : null) || null;
  const stacks = [];
  for (const m of sorted) {
    const last = stacks[stacks.length - 1];
    const t = _momentCaptureMs(m);
    if (last && m.kind === "image" && last.kind === "image"
        && (last.artistId || null) === (m.artistId || null)
        && (last.stageId || null) === stageOf(m)
        && Math.abs(last._t - t) <= burstMs) {
      last.items.push(m); last._t = t;
    } else {
      stacks.push({ items: [m], kind: m.kind, artistId: m.artistId || null, stageId: stageOf(m), _t: t });
    }
  }
  return stacks;
}
function MemoryGrid({ allMoments, onOpenLightbox }) {
  const sorted = React.useMemo(() =>
    allMoments.filter(m => m.photoId).slice().sort((a, b) => {
      const ta = a.takenAt || "", tb = b.takenAt || "";
      if (ta && tb) return tb.localeCompare(ta);
      return (b.createdAt || 0) - (a.createdAt || 0);
    }), [allMoments]);
  const stacks = React.useMemo(() => _stackBursts(sorted), [sorted]);
  if (!sorted.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 4 }}>
      {stacks.map((st) => {
        const hero = (st.items.length > 1 ? _pickHeroMoment(st.items) : st.items[0]) || st.items[0];
        const idx = sorted.indexOf(hero);
        return (
          <_LazyMount
            key={hero.id}
            rootMargin="600px 0px"
            style={{ aspectRatio: "1 / 1" }}
            placeholder={<div className="skel" style={{ width: "100%", height: "100%", borderRadius: 10 }} />}
          >
            <_GridTile moment={hero} stackCount={st.items.length}
              onClick={() => onOpenLightbox(sorted, idx < 0 ? 0 : idx)} />
          </_LazyMount>
        );
      })}
    </div>
  );
}

// Map lens — "where your night happened." Clusters moments onto the festival
// basemap by stage (artist→stage, or GPS projected to the nearest stage via
// map.jsx's gpsToMap/_nearestStageId), one count-pin per stage. Read-only:
// reuses STAGES coords + FESTIVAL_CONFIG.mapImage rather than the full
// MapScreen (which is coupled to live crew/zoom/meet state). Tap a pin → that
// stage's moments in the lightbox.
function MemoriesMapLens({ moments, onPinTap }) {
  const { pins, unplaced } = React.useMemo(() => {
    const byStage = new Map();
    let unplaced = 0;
    for (const m of (moments || [])) {
      if (!m.photoId) continue;
      let stageId = null;
      if (m.parsedGps && typeof gpsToMap === "function") {
        const p = gpsToMap(m.parsedGps.lat, m.parsedGps.lng);
        if (p && typeof _nearestStageId === "function") stageId = _nearestStageId(p.x, p.y);
      }
      const a = m.artistId ? ARTISTS.find(x => x.id === m.artistId) : null;
      if (!stageId && a) stageId = a.stage;
      const stage = stageId ? STAGES.find(s => s.id === stageId) : null;
      if (!stage) { unplaced++; continue; }
      if (!byStage.has(stageId)) byStage.set(stageId, []);
      byStage.get(stageId).push(m);
    }
    const pins = [...byStage.entries()]
      .map(([id, items]) => ({ id, items, stage: STAGES.find(s => s.id === id) }))
      .sort((a, b) => b.items.length - a.items.length);
    return { pins, unplaced };
  }, [moments]);

  if (!pins.length) {
    return (
      <div style={{ padding: "28px 14px", textAlign: "center", marginTop: 14, border: "1px dashed var(--line-2)", borderRadius: 14, background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          NO LOCATED MOMENTS YET — TAG A SET OR IMPORT GPS PHOTOS
        </div>
      </div>
    );
  }

  const img = (typeof FESTIVAL_CONFIG !== "undefined") ? FESTIVAL_CONFIG.mapImage : null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "1 / 1",
        borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)",
        background: "#0a0f0b",
      }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, display: "block" }}>
          {img && <image href={img} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" opacity="0.65"/>}
          <rect x="0" y="0" width="100" height="100" fill="rgba(8,7,11,0.42)"/>
          {pins.map(p => {
            const s = p.stage, c = p.items.length;
            const r = 3 + Math.min(6, Math.log2(c + 1) * 1.7);
            return (
              <g key={p.id} onClick={() => onPinTap?.(p)} style={{ cursor: "pointer" }}>
                <circle cx={s.x} cy={s.y} r={r + 1.6} fill={s.color} opacity="0.22"/>
                <circle cx={s.x} cy={s.y} r={r} fill={s.color} opacity="0.92" stroke="#fff" strokeWidth="0.5"/>
                <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={Math.max(2.4, r * 0.9)} fontWeight="800" fill="#fff"
                  fontFamily="ui-monospace, monospace" style={{ pointerEvents: "none" }}>{c}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* Tappable legend — same targets as the pins, for fat fingers + a11y. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {pins.map(p => (
          <button key={p.id} onClick={() => onPinTap?.(p)} className="mono" style={{
            display: "flex", alignItems: "center", gap: 6,
            background: `${p.stage.color}1a`, color: p.stage.color,
            border: `1px solid ${p.stage.color}44`, borderRadius: 999,
            padding: "5px 10px", cursor: "pointer",
            fontSize: 9, letterSpacing: 1, fontWeight: 700,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: p.stage.color }}/>
            {(p.stage.short || p.stage.name).toUpperCase()} · {p.items.length}
          </button>
        ))}
      </div>
      {unplaced > 0 && (
        <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: "var(--muted)", fontWeight: 600, marginTop: 8, opacity: 0.8 }}>
          +{unplaced} UNTAGGED MOMENT{unplaced === 1 ? "" : "S"} NOT ON THE MAP
        </div>
      )}
    </div>
  );
}

// Deterministic small offset from a moment id — used to nudge GPS-less
// thumbnails off their stage's exact center so same-stage moments don't stack
// pixel-perfect (and to give each pin a stable "scattered polaroid" rotation).
function _idHash(id) {
  let h = 0; const s = String(id || "");
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function _idJitter(id, amp = 2.6) {
  const h = _idHash(id);
  const ang = ((h % 997) / 997) * Math.PI * 2;
  const rad = amp * (0.35 + 0.65 * (((h >>> 9) % 991) / 991));
  return { dx: Math.cos(ang) * rad, dy: Math.sin(ang) * rad };
}
// Sortable capture time — prefer real EXIF/video takenAt, else createdAt.
function _momentTime(m) {
  if (m && m.takenAt) { const t = Date.parse(m.takenAt.replace(" ", "T")); if (!isNaN(t)) return t; }
  return (m && m.createdAt) || 0;
}

// One scattered photo/video thumbnail pinned on the basemap. Loads its blob
// lazily via useMomentPhoto (cloud restore-on-view), shows a stage-color ring,
// a ▶ marker on videos, and a "+N" badge when it fronts a declustered group.
function _PhotoPin({ cluster, onTap }) {
  const m = cluster.face;
  const url = useMomentPhoto(m.photoId, cluster.enabled !== false);
  const ring = (cluster.stage && cluster.stage.color) || "#9aa";
  const rot = ((_idHash(m.id) % 17) - 8); // -8..+8deg, stable per pin
  const extra = cluster.items.length - 1;
  const SIZE = cluster.items.length > 1 ? 52 : 46;
  return (
    <button onClick={() => onTap && onTap(cluster)} style={{
      position: "absolute", left: cluster.x + "%", top: cluster.y + "%",
      transform: `translate(-50%,-50%) rotate(${rot}deg)`,
      width: SIZE, height: SIZE, padding: 0, border: "none",
      background: "transparent", cursor: "pointer",
      zIndex: 2 + Math.min(40, cluster.items.length),
    }}>
      <div style={{
        width: "100%", height: "100%", borderRadius: 10, overflow: "hidden",
        border: `2px solid ${ring}`, background: url ? "#000" : "var(--paper-2)",
        boxShadow: "0 3px 9px rgba(0,0,0,0.5)",
      }}>
        {url ? (
          m.kind === "video"
            ? <video src={url + "#t=0.1"} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}/>
            : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        ) : <div className="skel" style={{ width: "100%", height: "100%" }}/>}
      </div>
      {m.kind === "video" && (
        <span className="mono" style={{
          position: "absolute", bottom: 3, left: 3, display: "inline-flex", alignItems: "center",
          background: "rgba(0,0,0,0.62)", color: "#fff", fontSize: 7, fontWeight: 800,
          padding: "1px 4px", borderRadius: 999, pointerEvents: "none",
        }}>▶</span>
      )}
      {extra > 0 && (
        <span className="mono" style={{
          position: "absolute", top: -7, right: -7, minWidth: 17, height: 17, padding: "0 3px",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: ring, color: "#fff", fontSize: 9, fontWeight: 800,
          borderRadius: 999, border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          pointerEvents: "none",
        }}>+{extra}</span>
      )}
    </button>
  );
}

// Photo-scatter map lens — drops the actual photo/video thumbnails at their
// real GPS coordinates on the festival basemap (vs MemoriesMapLens' per-stage
// count bubbles). No GPS → sits on the tagged artist's stage with a small
// deterministic jitter. Nearby thumbnails decluster into one face + "+N".
// Visible thumbnails capped for perf; the rest roll into a "+N more" note.
function MemoriesPhotoMapLens({ moments, onPinTap }) {
  const CAP = 24, CLUSTER_R = 6;
  const { clusters, hidden, unplaced } = React.useMemo(() => {
    const placed = [];
    let unplaced = 0;
    for (const m of (moments || [])) {
      if (!m.photoId) continue;
      let xy = null, stageId = null;
      if (m.parsedGps && typeof gpsToMap === "function") {
        const p = gpsToMap(m.parsedGps.lat, m.parsedGps.lng);
        if (p) { xy = { x: p.x, y: p.y }; if (typeof _nearestStageId === "function") stageId = _nearestStageId(p.x, p.y); }
      }
      if (!xy) {
        const a = m.artistId ? ARTISTS.find(x => x.id === m.artistId) : null;
        const stage = a ? STAGES.find(s => s.id === a.stage) : null;
        if (!stage) { unplaced++; continue; }
        const j = _idJitter(m.id);
        xy = { x: stage.x + j.dx, y: stage.y + j.dy };
        stageId = stage.id;
      }
      if (!stageId && typeof _nearestStageId === "function") stageId = _nearestStageId(xy.x, xy.y);
      const stage = stageId ? STAGES.find(s => s.id === stageId) : null;
      placed.push({ m, x: xy.x, y: xy.y, stage, t: _momentTime(m) });
    }
    // Greedy decluster: newest first, absorb everything within CLUSTER_R units.
    const sorted = placed.slice().sort((a, b) => b.t - a.t);
    const used = new Array(sorted.length).fill(false);
    const clusters = [];
    for (let i = 0; i < sorted.length; i++) {
      if (used[i]) continue;
      const head = sorted[i]; used[i] = true;
      const group = [head];
      for (let j = i + 1; j < sorted.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(sorted[j].x - head.x, sorted[j].y - head.y) <= CLUSTER_R) { used[j] = true; group.push(sorted[j]); }
      }
      clusters.push({ x: head.x, y: head.y, stage: head.stage, face: head.m, items: group.map(g => g.m) });
    }
    const visible = clusters.slice(0, CAP);
    const hidden = clusters.slice(CAP).reduce((n, c) => n + c.items.length, 0);
    return { clusters: visible, hidden, unplaced };
  }, [moments]);

  if (!clusters.length) {
    return (
      <div style={{ padding: "28px 14px", textAlign: "center", marginTop: 14, border: "1px dashed var(--line-2)", borderRadius: 14, background: "var(--paper-2)" }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          NOTHING TO MAP YET — IMPORT GPS PHOTOS OR TAG SETS
        </div>
      </div>
    );
  }

  const img = (typeof FESTIVAL_CONFIG !== "undefined") ? FESTIVAL_CONFIG.mapImage : null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "1 / 1",
        borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)",
        background: "#0a0f0b",
      }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, display: "block" }}>
          {img && <image href={img} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" opacity="0.6"/>}
          <rect x="0" y="0" width="100" height="100" fill="rgba(8,7,11,0.5)"/>
        </svg>
        {clusters.map((c, i) => <_PhotoPin key={c.face.id || i} cluster={c} onTap={onPinTap}/>)}
      </div>
      {(hidden > 0 || unplaced > 0) && (
        <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: "var(--muted)", fontWeight: 600, marginTop: 8, opacity: 0.85, display: "flex", flexWrap: "wrap", gap: 10 }}>
          {hidden > 0 && <span>+{hidden} MORE THUMBNAIL{hidden === 1 ? "" : "S"} CLUSTERED</span>}
          {unplaced > 0 && <span>+{unplaced} UNTAGGED NOT ON THE MAP</span>}
        </div>
      )}
    </div>
  );
}

// MAP-lens wrapper: a CLUSTERS ⇄ PHOTOS segmented toggle over the two lenses.
// Defaults to CLUSTERS (the v206 count-bubble view) so existing behavior is
// preserved; PHOTOS is the v212 GPS photo-scatter. Choice persists.
function MemoriesMapTab({ moments, onPinTap }) {
  const [mode, setMode] = React.useState(() => {
    try { return localStorage.getItem("plursky_maplens_mode") === "photos" ? "photos" : "clusters"; } catch { return "clusters"; }
  });
  const pick = (m) => { setMode(m); try { localStorage.setItem("plursky_maplens_mode", m); } catch {} };
  return (
    <div>
      <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--paper-2)", borderRadius: 9, border: "1px solid var(--line)" }}>
        {[{ id: "clusters", label: "CLUSTERS" }, { id: "photos", label: "PHOTOS" }].map(o => {
          const on = mode === o.id;
          return (
            <button key={o.id} onClick={() => pick(o.id)} className="mono" style={{
              flex: 1, padding: "6px 0", borderRadius: 7,
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--paper)" : "var(--muted)",
              border: "none", cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
            }}>{o.label}</button>
          );
        })}
      </div>
      {mode === "photos"
        ? <MemoriesPhotoMapLens moments={moments} onPinTap={onPinTap}/>
        : <MemoriesMapLens moments={moments} onPinTap={onPinTap}/>}
    </div>
  );
}

// v219: per-night inline map ("where this night happened"), collapsed by
// default so TIMELINE stays calm. Reuses the MAP-tab lens scoped to one night —
// this is where the old top-level MAP lens now lives.
function _NightMap({ moments, onPinTap }) {
  const [open, setOpen] = React.useState(false);
  if (!moments || !moments.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} className="mono" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "9px 12px", borderRadius: 10,
        background: "var(--paper-2)", border: "1px solid var(--line)",
        color: "var(--muted)", cursor: "pointer",
        fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
      }}>
        <span>📍 WHERE THIS NIGHT HAPPENED</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ marginTop: 8 }}><MemoriesMapTab moments={moments} onPinTap={onPinTap} /></div>}
    </div>
  );
}

// v219: one share affordance per night instead of two buttons (📸 SHARE +
// 🎬 GIF) competing with the day title. A single "SHARE ▾" opens a small menu.
function _NightShareMenu({ night, moments }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative", marginLeft: "auto" }}>
      <button onClick={() => setOpen(o => !o)} className="mono" style={{
        background: "var(--ember)", color: "#fff", border: "none",
        borderRadius: 999, padding: "4px 10px", cursor: "pointer",
        fontSize: 9, letterSpacing: 1.2, fontWeight: 700, whiteSpace: "nowrap",
      }}>📸 SHARE ▾</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 4 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 5,
            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)", overflow: "hidden", minWidth: 140,
          }}>
            {[["📸 Collage", undefined], ["🎬 Animated GIF", "gif"]].map(([lbl, mode], i) => (
              <button key={lbl}
                onClick={() => { setOpen(false); window._shareNightCollage?.(night, moments, mode); }}
                className="mono" style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "transparent", border: "none",
                  borderTop: i ? "1px solid var(--line)" : "none",
                  padding: "10px 12px", cursor: "pointer",
                  fontSize: 10, letterSpacing: 0.6, color: "var(--ink)", fontWeight: 600,
                }}>{lbl}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MemoriesScreen({ state, setState }) {
  const [rawAll, setAll] = React.useState(_readMoments);
  // Scope all views/counts to the active festival (moments share one store
  // keyed by night across festivals). Writes still go to the full store via
  // _readMoments()/_writeMoments in the handlers, preserving other festivals.
  const all = React.useMemo(() => _activeMoments(rawAll), [rawAll]);
  const [adding, setAdding] = React.useState(null); // night number being added to, or null
  const [batch, setBatch] = React.useState(null);   // null | { total, done, results: [{name, night, artistId, err?}] }
  const [lightbox, setLightbox] = React.useState(null); // null | { moments: [], index }
  const [reel, setReel] = React.useState(null); // null | { moments: [], label }
  const [backupBusy, setBackupBusy] = React.useState(false); // cloud-backup in progress
  const [backupProg, setBackupProg] = React.useState(null);  // { done, total } while running
  const [showPlus, setShowPlus] = React.useState(false);     // paywall overlay (free taps backup)
  const batchInputRef = React.useRef(null);
  const nightSectionRefs = React.useRef({});
  const openLightbox = React.useCallback((moments, index) => setLightbox({ moments, index }), []);
  const playReel = React.useCallback((moments, label, night) => { if (moments?.length) setReel({ moments, label, night }); }, []);

  // Stay in sync with cross-screen retags. The local handlers (handleAdd /
  // handleUpdate / handleDelete) all call setAll directly so this listener
  // is only doing work for external writes — e.g., the user retags a
  // moment from the Artist screen's "YourPhotosStrip" and we want the
  // Memories tab to reflect that next time they swap to it. _writeMoments
  // dispatches "plursky-moments-change" on every write.
  React.useEffect(() => {
    const refresh = () => { try { setAll(_readMoments()); } catch {} };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);

  // v141: when a user taps a FRI/SAT/SUN row on the Me-tab History list,
  // it sets state.memoriesNight + state.tab="memories". This effect scrolls
  // that night's section to the top of the ScrollBody so the user lands
  // on the right place + clears the hint so a manual navigation later
  // doesn't snap them back.
  React.useEffect(() => {
    if (!state.memoriesNight) return;
    const id = requestAnimationFrame(() => {
      const el = nightSectionRefs.current[state.memoriesNight];
      if (el?.scrollIntoView) el.scrollIntoView({ behavior: "instant", block: "start" });
      setState(s => ({ ...s, memoriesNight: null }));
    });
    return () => cancelAnimationFrame(id);
  }, [state.memoriesNight]);

  const handleAdd = (moment) => {
    const next = { ..._readMoments() };
    next[moment.night] = [...(next[moment.night] || []), moment];
    _writeMoments(next);
    setAll(next);
    setAdding(null);
  };

  // Auto-import multiple photos at once. For each file we read EXIF, ask the
  // matcher which artist+night it belongs to, compress + save to IndexedDB,
  // and write a moment. Photos with no EXIF date land in a fallback night
  // and surface a RETAG chip so the user can fix them.
  const handleBatchPick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-pick of same files
    return processImportedFiles(files);
  };

  // The actual ingest loop. Pulled out of handleBatchPick so the native
  // @capacitor/camera picker can feed it File objects directly without
  // going through a hidden <input>.
  const _fileFingerprint = async (file) => {
    try {
      const slice = file.slice(0, 2048);
      const buf = await slice.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let h = 0x811c9dc5;
      for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
      return `${(h >>> 0).toString(36)}_${file.size}_${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    } catch { return null; }
  };

  const processImportedFiles = async (files) => {
    if (files.length === 0) {
      window.plurskyToast?.("No photos received — pick a few at a time; if they're in iCloud, open them in Photos first so they download.");
      return;
    }
    const results = [];
    setBatch({ total: files.length, done: 0, results });
    const savedIds = state.saved || [];
    const attendedIds = Object.values(window.getAllAttended?.() || {}).flat();
    const current = { ..._readMoments() };

    const existingFingerprints = new Set();
    for (const moments of Object.values(current)) {
      for (const m of moments) { if (m._fingerprint) existingFingerprints.add(m._fingerprint); }
    }
    // Fallback target night when we can't infer one from EXIF: prefer the
    // current festival day, then yesterday (post-midnight shoot earlier in
    // the morning), else the first festival night. Better to import every
    // photo into SOME night so the user can re-tag than silently skip.
    const allNights = Object.keys(window.FESTIVAL_CONFIG?.dayDates || {}).map(Number).sort((a, b) => a - b);
    const fallbackNight = (window.NOW?.day && allNights.includes(window.NOW.day))
      ? window.NOW.day
      : (allNights[allNights.length - 1] || 1);
    let skippedDupes = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const fp = await _fileFingerprint(f);
        if (fp && existingFingerprints.has(fp)) {
          skippedDupes++;
          results.push({ name: f.name, night: null, artistId: null, skipped: "duplicate" });
          setBatch({ total: files.length, done: i + 1, results: results.slice() });
          continue;
        }
        const exif = await _parseExifMeta(f).catch(() => null);
        const baseMeta = _metaFromFile(f, exif);
        const recovered = _recoverVideoMetaFromArchive(f, fp, baseMeta);
        const meta = recovered?.meta || baseMeta;
        const matched = meta?.date ? _matchArtistForPhoto(meta, savedIds, attendedIds) : { artistId: null, night: null, reason: "no_date" };
        // v141: never skip — if EXIF/lastModified didn't pick a night, drop
        // into the current festival night untagged. User can re-tag from
        // the moment card later or delete if it doesn't belong.
        const night = matched.night || fallbackNight;
        // Why was this tag picked? Surface it on the moment so the card can
        // show "TAGGED FROM EXIF" vs "FALLBACK — RETAG", and so we can debug
        // import failures from the UI alone.
        const hadExifDate = !!exif?.date;
        const hadFileTime = meta?.takenAtSource === "file-lastModified";
        const hadTrustedMeta = !!meta?.date && meta.takenAtSource !== "file-lastModified" && meta.takenAtSource !== "none";
        const tagSource =
          recovered ? "archive-recovered" :
          matched.reason === "off_stage"  ? "off_stage" :
          matched.artistId && hadExifDate ? "exif" :
          matched.artistId && /^video-/.test(meta?.takenAtSource || "") ? "video-metadata" :
          matched.artistId && hadTrustedMeta ? meta.takenAtSource :
          matched.artistId && hadFileTime ? "filetime" :
          matched.night    && hadExifDate ? "exif-night-only" :
          matched.night    && /^video-/.test(meta?.takenAtSource || "") ? "video-night-only" :
          matched.night    && hadTrustedMeta ? `${meta.takenAtSource}-night-only` :
          matched.night    && hadFileTime ? "filetime-night-only" :
          "fallback";
        const out = await _processMomentMedia(f);
        const id = `m_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        const photoId = `p_${id}`;
        await _putPhoto(photoId, out.blob);
        const moment = {
          id, night, text: "", artistId: matched.artistId, photoId,
          kind: out.kind,
          duration: out.duration ?? null,
          createdAt: Date.now(),
          takenAt: _momentDatePartsToTakenAt(meta?.date),
          takenAtSource: meta?.takenAtSource || "none",
          locationSource: meta?.locationSource || ((meta?.lat != null && meta?.lng != null) ? "gps" : "none"),
          importedAt: new Date().toISOString(),
          needsRetag: out.kind === "video" && !recovered && (!meta?.takenAtSource || meta.takenAtSource === "file-lastModified" || meta.takenAtSource === "none"),
          autoTagged: !!(matched.artistId || recovered?.moment?.artistId),
          tagSource,
          nativePath: out.kind === "video" ? (f.nativePath || null) : null,
          // Low-confidence auto-tag: 2+ sets overlap this timestamp and GPS
          // couldn't separate them. Keep the best guess but flag it so the
          // card surfaces a prominent "fix tag" chip instead of looking sure.
          tagAmbiguous: !!(matched.artistId && matched.ambiguous),
          festivalId: window.FESTIVAL_CONFIG?.id || null,
          parsedGps: meta?.lat != null && meta?.lng != null ? { lat: meta.lat, lng: meta.lng } : null,
          location: matched.location || null,
          hasGps: !!(meta?.lat != null && meta?.lng != null),
          fileType: f.type || null,
          _fingerprint: fp || null,
        };
        if (recovered?.moment?.artistId && !moment.artistId) moment.artistId = recovered.moment.artistId;
        if (fp) existingFingerprints.add(fp);
        current[night] = [...(current[night] || []), moment];
        results.push({ name: f.name, night, artistId: matched.artistId, fallback: !matched.night, tagSource });
        // Persist + refresh after EACH file so a mid-batch Safari crash/OOM
        // (common on large iOS selections that include videos / iCloud photos)
        // keeps what's already imported and the grid fills in live — instead
        // of buffering everything in memory and losing it all if the tab dies
        // before the loop finishes. Photo blobs live in IndexedDB, so this
        // only re-serializes lightweight moment metadata each pass.
        _writeMoments(current);
        setAll({ ...current });
      } catch (err) {
        results.push({ name: f.name, night: null, artistId: null, err: err?.message || "failed" });
      }
      setBatch({ total: files.length, done: i + 1, results: results.slice() });
    }
    _writeMoments(current);
    setAll({ ...current });
    // Never fail silently: if nothing landed, say why out loud.
    const okCount = results.filter(r => !r.err && !r.skipped).length;
    if (okCount === 0) {
      const failed = results.filter(r => r.err).length;
      const dupes  = results.filter(r => r.skipped === "duplicate").length;
      if (dupes && !failed) window.plurskyToast?.(`Already imported — ${dupes} duplicate${dupes === 1 ? "" : "s"} skipped`);
      else window.plurskyToast?.(`Couldn't import ${failed} file${failed === 1 ? "" : "s"} — try a few at a time${failed ? ` · ${results.find(r => r.err)?.err || "failed"}` : ""}`);
    }
    // Auto-dismiss summary banner after 6s if user doesn't tap it
    setTimeout(() => setBatch(b => (b && b.done === b.total ? null : b)), 6000);
  };

  const handleDelete = async (moment) => {
    if (!window.confirm("Delete this moment?")) return;
    if (moment.photoId) { try { await _deletePhoto(moment.photoId); } catch {} }
    const next = { ..._readMoments() };
    for (const n of Object.keys(next)) {
      next[n] = (next[n] || []).filter(m => m.id !== moment.id);
    }
    _writeMoments(next);
    setAll(next);
  };

  // Route the import button through the native @capawesome/capacitor-file-picker
  // PHPicker when (a) we're inside the iOS Capacitor shell AND (b) the
  // __USE_NATIVE_PICKER__ flag is on. `pickMedia` returns BOTH photos and
  // videos from one native sheet (Camera.pickImages was photos-only — the
  // reason videos couldn't be imported on the native build).
  //
  // skipTranscoding:false is load-bearing: iOS then transcodes HEIC photos
  // to JPEG, which keeps EXIF DateTimeOriginal in a form _parseExifMeta can
  // read (it bails on non-JPEG). That preserves time-based auto-tagging —
  // the whole point of the native picker. Videos come through as-is/MP4 and
  // get stored raw by _processMomentMedia.
  //
  // PHPicker is out-of-process, so it needs NO NSPhotoLibraryUsageDescription
  // and triggers no permission prompt. GPS is stripped by PHPicker unless the
  // user grants full library access in iOS Settings — same as before.
  const pickViaNative = async () => {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !window.__USE_NATIVE_PICKER__) return null;
    const FilePicker = cap.Plugins?.FilePicker;
    if (!FilePicker?.pickMedia) return null;
    try {
      const result = await FilePicker.pickMedia({ skipTranscoding: false, limit: 50, readData: false });
      const files = result?.files || [];
      if (files.length === 0) return [];
      const out = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        // `path` is a native file URL; convertFileSrc makes it loadable by
        // the WebView so fetch() can read it into a Blob, then we wrap it as
        // a File so the existing ingest pipeline sees the same shape it would
        // from <input type="file">.
        const src = f.path ? (cap.convertFileSrc ? cap.convertFileSrc(f.path) : f.path) : null;
        if (!src) continue;
        const blob = await fetch(src).then(r => r.blob());
        const isVideo = /^video\//.test(f.mimeType || "") || /\.(mov|mp4|m4v)$/i.test(f.name || "");
        const type = f.mimeType || blob.type || (isVideo ? "video/mp4" : "image/jpeg");
        const name = f.name || `pick-${i}.${isVideo ? "mp4" : "jpg"}`;
        const pickedFile = new File([blob], name, {
          type,
          // modifiedAt is the freshly-transcoded temp file's mtime (≈now),
          // which the <30s heuristic in _metaFromFile correctly ignores so
          // photos tag from real EXIF rather than the conversion stamp.
          lastModified: f.modifiedAt || Date.now(),
        });
        if (isVideo && f.path) {
          try { Object.defineProperty(pickedFile, "nativePath", { value: f.path }); }
          catch { pickedFile.nativePath = f.path; }
        }
        out.push(pickedFile);
      }
      return out;
    } catch (err) {
      console.warn('[memories] native pickMedia failed; falling back to web input', err);
      return null;
    }
  };

  const handlePickClick = async () => {
    const nativeFiles = await pickViaNative();
    if (nativeFiles && nativeFiles.length > 0) {
      await processImportedFiles(nativeFiles);
    } else if (nativeFiles === null) {
      // Native path declined to handle (flag off / not in Capacitor / errored).
      // Fall through to the existing hidden-input click.
      batchInputRef.current?.click();
    }
    // nativeFiles === [] means the user opened the native picker and cancelled
    // without picking — don't fall back to the web input, just no-op.
  };

  // In-place edit (e.g. retagging the artist on an auto-imported photo
  // that landed without a match). Re-reads from disk first so concurrent
  // batch imports don't get clobbered.
  const handleUpdate = (moment, patch) => {
    const next = { ..._readMoments() };
    for (const n of Object.keys(next)) {
      next[n] = (next[n] || []).map(m => m.id === moment.id ? { ...m, ...patch } : m);
    }
    _writeMoments(next);
    setAll(next);
  };

  const totalCount = Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);

  // Three lenses on the same data. Default is "night" (preserves the
  // festival narrative + keeps + ADD MOMENT and the attendance review
  // affordances per night). "artist" and "stage" are rewatch lenses:
  // flatten across all nights, group by the dimension. Untagged moments
  // always float to a bottom group so retag work is grouped.
  // Persisted across navigations — users settle on one lens; resetting
  // to "night" every time the user comes back from another tab was
  // unnecessary friction.
  const [view, setView] = React.useState(() => {
    try {
      const v = localStorage.getItem("plursky_memories_view_v1");
      // v206: lenses simplified to GRID · STORY · NIGHT (the old 5-tab bar read
      // as cluttered). A persisted artist/stage selection falls back to NIGHT —
      // you still reach a single artist by tapping its group header.
      // v219: lenses collapsed to two modes — WALL (grid) · TIMELINE (night).
      // Legacy story/map/artist/stage all fold into TIMELINE: the per-night map
      // is inline now, and the whole-weekend reel is the "Relive your weekend"
      // hero at the top. Unknown/legacy → WALL (the calm default browse wall).
      if (["grid", "night"].includes(v)) return v;
      if (["story", "map", "artist", "stage"].includes(v)) return "night";
    } catch {}
    return "grid";
  });
  const [memQuery, setMemQuery] = React.useState(""); // grid search: artist/song/stage
  // v219: TIMELINE defaults to pure relive. Attendance check-off + ADD MOMENT
  // (data-entry) hide behind MANAGE so they don't clutter the browse surface.
  const [manage, setManage] = React.useState(false);
  React.useEffect(() => {
    try { localStorage.setItem("plursky_memories_view_v1", view); } catch {}
  }, [view]);
  // Flatten moments once for the artist/stage views.
  const allMoments = React.useMemo(() => {
    const out = [];
    for (const n of Object.keys(all)) {
      for (const m of (all[n] || [])) out.push(m);
    }
    return out;
  }, [all]);

  // Cloud-backup status (X/Y + bytes) + handler. Plus-gated media backup.
  // Free users tapping it open the paywall overlay.
  const [autoOn, setAutoOn] = React.useState(() => _autoBackupOn());
  const _autoBusy = React.useRef(false);
  const backupStat = React.useMemo(() => {
    let total = 0, done = 0, bytes = 0;
    for (const m of allMoments) { if (!m.photoId) continue; total++; if (m.backedUp) { done++; bytes += (m.backedUpBytes || 0); } }
    return { total, done, bytes };
  }, [allMoments]);
  const _afterBackup = (res) => {
    if (res?.error === "signin") window.plurskyToast?.("Sign in on the Me tab to back up");
    else if (res?.error) window.plurskyToast?.("Backup unavailable right now");
    else if (res?.capped) window.plurskyToast?.(`Backup limit reached (${_fmtSize(_BACKUP_HARD_CAP)}) · ${res.done} saved`);
    else window.plurskyToast?.(`☁ Backed up ${res.done} ${res.done === 1 ? "memory" : "memories"}${res.failed ? ` · ${res.failed} failed` : ""}`);
  };
  const handleBackup = async () => {
    if (!_isPlusSub()) { setShowPlus(true); return; }
    if (!_onWifi()) { window.plurskyToast?.("Wi-Fi only — connect to back up your media"); return; }
    setBackupBusy(true);
    setBackupProg({ done: backupStat.done, total: backupStat.total });
    const res = await _backupMyWeekend(p => setBackupProg({ done: backupStat.done + p.done, total: backupStat.total }));
    setBackupBusy(false); setBackupProg(null);
    setAll(_readMoments()); // refresh backedUp flags → button updates
    _afterBackup(res);
  };
  // P2 auto-backup: Plus + opted-in + Wi-Fi → quietly catch up pending uploads
  // on mount and whenever moments change (e.g. after an import). Ref-guarded
  // against concurrent runs; no-ops when nothing is pending.
  React.useEffect(() => {
    if (!autoOn || !_isPlusSub() || !_onWifi() || _autoBusy.current) return;
    if (!allMoments.some(m => m.photoId && !m.backedUp)) return;
    let cancelled = false;
    (async () => {
      if (!(window.sbGetUser && await window.sbGetUser())) return;
      if (cancelled || _autoBusy.current) return;
      _autoBusy.current = true;
      const res = await _backupMyWeekend().catch(() => null);
      _autoBusy.current = false;
      if (!cancelled) { setAll(_readMoments()); if (res?.done) window.plurskyToast?.(`☁ Auto-backed up ${res.done}`); }
    })();
    return () => { cancelled = true; };
  }, [allMoments, autoOn]);

  return (
    <Screen bg="var(--paper)">
      {lightbox && (
        <MomentLightbox
          moments={lightbox.moments}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox(lb => ({ ...lb, index: i }))}
          onArtistClick={(id) => setState(s => ({ ...s, artist: id }))}
          onUpdate={(mom, patch) => {
            handleUpdate(mom, patch);
            // Reflect the patch in the open lightbox immediately
            setLightbox(lb => lb ? { ...lb, moments: lb.moments.map(mm => mm.id === mom.id ? { ...mm, ...patch } : mm) } : lb);
          }}
        />
      )}
      {reel && (
        <MemoryReel
          moments={reel.moments}
          nightLabel={reel.label}
          night={reel.night}
          festival={FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name}
          onClose={() => setReel(null)}
          onOpenArtist={(id) => setState(s => ({ ...s, artist: id }))}
          onMakeVideo={() => setState(s => ({ ...s, tab: "recap", artist: null }))}
        />
      )}
      {/* Memories is a root bottom-nav tab — no back arrow (that read as a
          sub-screen). The tab bar is the way out. */}
      <div style={{ padding: "8px 20px" }}>
        <TopBar
          title={<span>Memories</span>}
          sub={`${totalCount} ${totalCount === 1 ? "MOMENT" : "MOMENTS"} · ${FESTIVAL_CONFIG.shortName.toUpperCase()}`}
          tight
        />
      </div>
      <ScrollBody style={{ padding: "0 20px 94px" }}>
        {/* v135 batch import — auto-tags each photo by EXIF time + GPS,
            then drops it into the right night without further input. */}
        <input
          ref={batchInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleBatchPick}
          style={{ display: "none" }}
        />
        <button onClick={handlePickClick}
          disabled={!!batch && batch.done < batch.total}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", marginTop: 12, padding: "12px 14px",
            background: "linear-gradient(135deg, rgba(232,93,46,0.12), rgba(123,61,154,0.10))",
            border: "1px solid rgba(232,93,46,0.4)",
            borderRadius: 14, color: "var(--ink)", cursor: "pointer",
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 17 }}>✨</span>
            <div style={{ textAlign: "left" }}>
              <div className="serif" style={{ fontSize: 16, lineHeight: 1.1 }}>Import from camera roll</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2, fontWeight: 700 }}>
                AUTO-TAGS BY TIME + LOCATION
              </div>
            </div>
          </div>
          <span className="mono" style={{
            background: "var(--ember)", color: "#fff",
            padding: "5px 11px", borderRadius: 999,
            fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>{batch && batch.done < batch.total ? `${batch.done}/${batch.total}` : "PICK"}</span>
        </button>
        {batch && batch.done === batch.total && (() => {
          const tagged    = batch.results.filter(r => !r.err && !r.skipped && r.artistId).length;
          const needRetag = batch.results.filter(r => !r.err && !r.skipped && !r.artistId).length;
          const failed    = batch.results.filter(r => r.err).length;
          const dupes     = batch.results.filter(r => r.skipped === "duplicate").length;
          const allTagged = tagged > 0 && needRetag === 0 && failed === 0;
          return (
            <div onClick={() => setBatch(null)} style={{
              marginTop: 8, padding: "9px 12px",
              background: allTagged ? "rgba(45,122,85,0.12)" : "rgba(232,93,46,0.10)",
              border: allTagged ? "1px solid rgba(45,122,85,0.4)" : "1px solid rgba(232,93,46,0.4)",
              borderRadius: 10, cursor: "pointer",
            }}>
              <div className="mono" style={{
                fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                color: allTagged ? "var(--success)" : "var(--ember)",
              }}>
                ✓ {tagged} TAGGED{needRetag > 0 ? ` · ${needRetag} NEED RETAG` : ""}{dupes > 0 ? ` · ${dupes} SKIPPED (DUPLICATE)` : ""}{failed > 0 ? ` · ${failed} FAILED` : ""}
              </div>
              {needRetag > 0 && (
                <div className="mono" style={{ marginTop: 4, fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 600 }}>
                  iOS sometimes strips photo time when copying — tap an untagged moment to pick its set.
                </div>
              )}
              <div className="mono" style={{ marginTop: 4, fontSize: 9, color: "var(--muted)" }}>TAP TO DISMISS</div>
            </div>
          );
        })()}

        {/* ✨ Create recap hero — the payoff CTA. Plays an auto-advancing reel
            of the whole weekend; the recap-video export lives one tap deeper. */}
        {allMoments.filter(m => m.photoId).length >= 3 && (
          <div style={{
            marginTop: 12, padding: "14px 16px", borderRadius: 16,
            background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 19, lineHeight: 1.05, color: "#fff" }}>
                Relive your <span style={{ fontStyle: "italic" }}>weekend</span>
              </div>
              <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1.2, color: "rgba(255,255,255,0.8)", fontWeight: 700, marginTop: 3 }}>
                {allMoments.filter(m => m.photoId).length} MOMENTS · AUTO-PLAY REEL
              </div>
            </div>
            <button onClick={() => {
              const ms = allMoments.filter(m => m.photoId).slice().sort((a, b) => {
                const ta = a.takenAt || "", tb = b.takenAt || "";
                if (ta && tb) return ta.localeCompare(tb);
                return (a.createdAt || 0) - (b.createdAt || 0);
              });
              playReel(ms, FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name, null);
            }} className="mono" style={{
              flexShrink: 0, background: "#fff", color: "var(--ember)", border: "none",
              borderRadius: 999, padding: "9px 16px", cursor: "pointer",
              fontSize: 10, letterSpacing: 1.2, fontWeight: 800,
            }}>▶ PLAY</button>
          </div>
        )}

        {/* MANAGE reveals the data surfaces (cloud backup + per-night
            attendance check-off + ADD MOMENT). Default-off keeps the screen a
            calm relive view, not a control panel. */}
        {totalCount > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={() => setManage(m => !m)} className="mono" style={{
              background: manage ? "var(--ink)" : "transparent",
              color: manage ? "var(--paper)" : "var(--muted)",
              border: "1px solid var(--line)", borderRadius: 999,
              padding: "5px 12px", cursor: "pointer",
              fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
            }}>{manage ? "✓ DONE MANAGING" : "⚙ MANAGE"}</button>
          </div>
        )}

        {/* Cloud backup (Plursky+) — manual, wifi-only. Free taps open the
            paywall; Plus runs the upload and shows X/Y backed up. Behind MANAGE. */}
        {manage && backupStat.total > 0 && (
          <button onClick={handleBackup} disabled={backupBusy}
            aria-label={_isPlusSub() ? "Back up your memories to the cloud" : "Back up to cloud — Plursky Plus"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", marginTop: 8, padding: "11px 14px",
              background: "var(--paper-2)", border: "1px solid var(--line)",
              borderRadius: 14, color: "var(--ink)", cursor: backupBusy ? "wait" : "pointer",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 16 }}>☁️</span>
              <div style={{ textAlign: "left", minWidth: 0 }}>
                <div className="serif" style={{ fontSize: 15, lineHeight: 1.1 }}>
                  {backupBusy ? "Backing up…" : (backupStat.done >= backupStat.total ? "Memories backed up" : "Back up my weekend")}
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1, marginTop: 2, fontWeight: 700,
                  color: backupStat.bytes >= _BACKUP_SOFT_CAP ? "var(--ember)" : "var(--muted)" }}>
                  {backupBusy && backupProg ? `BACKING UP… ${backupProg.done}/${backupProg.total}`
                    : backupStat.done >= backupStat.total ? `ALL SAFE · ${_fmtSize(backupStat.bytes)}`
                    : `${backupStat.done}/${backupStat.total} · ${_fmtSize(backupStat.bytes)} · WI-FI`}
                  {backupStat.bytes >= _BACKUP_SOFT_CAP ? ` · NEAR ${_fmtSize(_BACKUP_HARD_CAP)} LIMIT` : ""}
                </div>
              </div>
            </div>
            <span className="mono" style={{
              flexShrink: 0, color: "#fff", padding: "5px 11px", borderRadius: 999,
              fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
              background: _isPlusSub() ? "var(--ember)" : "linear-gradient(135deg,#6D28D9,#e85d2e)",
            }}>{_isPlusSub() ? (backupStat.done >= backupStat.total ? "✓" : "BACK UP") : "PLUS"}</span>
          </button>
        )}

        {/* P2: auto-backup toggle (Plus). Default on; wifi-only. Behind MANAGE. */}
        {manage && backupStat.total > 0 && _isPlusSub() && (
          <button onClick={() => { const v = !autoOn; _setAutoBackup(v); setAutoOn(v); }} className="mono" aria-pressed={autoOn} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "100%", marginTop: 6, padding: "7px 12px", borderRadius: 10,
            background: "transparent", border: "1px solid var(--line)",
            color: "var(--muted)", cursor: "pointer", fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
          }}>
            AUTO-BACKUP ON WI-FI · <span style={{ color: autoOn ? "var(--success)" : "var(--muted)" }}>{autoOn ? "ON" : "OFF"}</span>
          </button>
        )}

        {/* Paywall overlay — shown when a free user taps cloud backup. */}
        {showPlus && (
          <div onClick={() => setShowPlus(false)} style={{
            position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
            animation: "fadeIn .2s",
          }}>
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 340 }}>
              <button onClick={() => setShowPlus(false)} aria-label="Close" style={{
                position: "absolute", top: -14, right: -6, zIndex: 1,
                width: 30, height: 30, borderRadius: 30, background: "#fff", border: "none",
                color: "#1a120d", fontSize: 16, fontWeight: 700, cursor: "pointer",
              }}>×</button>
              <PlusGate feature="cloud backup"><div style={{ height: 460 }} /></PlusGate>
            </div>
          </div>
        )}

        {/* Inviting empty state — first run, no moments yet. */}
        {totalCount === 0 && (
          <div style={{ marginTop: 20, padding: "32px 22px", textAlign: "center", borderRadius: 18, background: "var(--paper-2)", border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📸</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, color: "var(--ink)", marginBottom: 8 }}>
              Your weekend, <span style={{ fontStyle: "italic", color: "var(--ember)" }}>remembered</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)", maxWidth: 280, margin: "0 auto" }}>
              Import your festival photos & videos — Plursky auto-tags each to the set you were watching, finds the song that was playing, and turns them into a recap.
            </div>
            <button onClick={handlePickClick} className="mono" style={{ marginTop: 16, padding: "11px 20px", borderRadius: 999, background: "var(--ember)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, letterSpacing: 1.2, fontWeight: 700 }}>✨ IMPORT FROM CAMERA ROLL</button>
          </div>
        )}

        {/* View selector (v206) — three clear lenses instead of five. GRID is
            the scannable photo wall, STORY is the auto-play reel, NIGHT is the
            "manage" view (+ ADD MOMENT + retag, grouped by night→artist with
            the hero + song timeline). Per-artist / per-stage are reached by
            tapping a group, not a top-level tab. */}
        {totalCount > 0 && <div style={{
          display: "flex", gap: 4, marginTop: 14, marginBottom: 8,
          padding: 3, background: "var(--paper-2)", borderRadius: 10,
          border: "1px solid var(--line)",
        }}>
          {[
            { id: "grid",   label: "WALL" },
            { id: "night",  label: "TIMELINE" },
          ].map(v => {
            const on = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)} className="mono" style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                background: on ? "var(--ink)"   : "transparent",
                color:      on ? "var(--paper)" : "var(--muted)",
                border: "none", cursor: "pointer",
                fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              }}>{v.label}</button>
            );
          })}
        </div>}
        {view === "grid" && (<>
          {/* Search — filter the grid by artist, song, or stage. */}
          <input
            value={memQuery}
            onChange={e => setMemQuery(e.target.value)}
            placeholder="Search artist, song, or stage…"
            className="mono"
            style={{
              width: "100%", boxSizing: "border-box", marginBottom: 8,
              padding: "9px 12px", borderRadius: 999,
              background: "var(--paper-2)", border: "1px solid var(--line)",
              color: "var(--ink)", fontSize: 11, letterSpacing: 0.5, outline: "none",
            }}
          />
          <MemoryGrid
            allMoments={(() => {
              const q = memQuery.trim().toLowerCase();
              if (!q) return allMoments;
              return allMoments.filter(m => {
                const a = m.artistId ? ARTISTS.find(x => x.id === m.artistId) : null;
                const s = a ? STAGES.find(st => st.id === a.stage) : null;
                return (a?.name || "").toLowerCase().includes(q)
                  || (m.confirmedSong || "").toLowerCase().includes(q)
                  || (s?.name || "").toLowerCase().includes(q);
              });
            })()}
            onOpenLightbox={openLightbox}
          />
        </>)}
        {/* v219: STORY/MAP/ARTIST/STAGE lenses folded into the 2-mode model.
            The whole-weekend reel is the "Relive your weekend" hero above; the
            per-night map is inline in TIMELINE; per-artist is reached by tapping
            a group header. */}
        {view === "night" && DAYS.map(d => {
          // Chronological by when the moment was CAPTURED (takenAt), not when
          // it was imported — _momentTime falls back to createdAt only when the
          // capture time is missing. takenAt carries a full date+time, so a clip
          // shot at 00:32 naturally sorts after one shot at 23:35 the same night.
          const moments = (all[d.n] || []).slice().sort((a, b) => _momentTime(a) - _momentTime(b));
          const dateInfo = FESTIVAL_CONFIG.dayDates?.[d.n];
          const savedNightArtists = state.saved
            .map(id => ARTISTS.find(a => a.id === id))
            .filter(a => a && a.day === d.n);
          return (
            <div key={d.n}
              ref={el => { nightSectionRefs.current[d.n] = el; }}
              style={{ marginBottom: 22, scrollMarginTop: 12 }}
            >
              <div style={{
                display: "flex", alignItems: "baseline", gap: 10,
                paddingTop: 14, paddingBottom: 8, marginBottom: 4,
                borderBottom: "1px solid var(--line)",
              }}>
                <div className="serif" style={{ fontSize: 24, color: "var(--ink)" }}>
                  {d.label}
                </div>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700 }}>
                  · {dateInfo ? `${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][dateInfo.m]} ${dateInfo.d}` : `DAY ${d.n}`}
                </div>
                {moments.length > 0 && (
                  <>
                    <_NightShareMenu night={d.n} moments={moments} />
                    <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", fontWeight: 700 }}>
                      {moments.length} MOMENT{moments.length === 1 ? "" : "S"}
                    </div>
                  </>
                )}
              </div>

              {moments.length > 0 && (
                <PeakMomentCard
                  peak={_peakWindow(moments)}
                  accent="var(--ember)"
                  onOpenLightbox={openLightbox}
                  onPlayReel={(items) => playReel(items, `${d.label} peak`, d.n)}
                />
              )}

              {/* Inline "where this night happened" map — absorbs the old MAP
                  lens, scoped to this night, collapsed by default. */}
              {moments.length > 0 && (
                <_NightMap moments={moments} onPinTap={(p) => openLightbox(p.items, 0)} />
              )}

              {moments.length === 0 && adding !== d.n && (
                <div style={{
                  padding: "18px 14px", textAlign: "center",
                  border: "1px dashed var(--line-2)", borderRadius: 14,
                  background: "var(--paper-2)", marginTop: 10, marginBottom: 10,
                }}>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
                    NO MOMENTS YET
                  </div>
                </div>
              )}

              {(() => {
                // Group this night's moments by artist (with null = untagged
                // floated to the bottom). Saved-on-this-night artists come
                // first, sorted by set start time, then any other artists
                // (e.g. you took a photo at a set you hadn't saved), then
                // the untagged group last so retag work is grouped where
                // the user can find it.
                const groups = new Map(); // artistId → moments[]
                for (const m of moments) {
                  const key = m.artistId || "__untagged__";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key).push(m);
                }
                const savedSet = new Set(state.saved || []);
                const orderedKeys = [...groups.keys()].sort((aId, bId) => {
                  if (aId === "__untagged__") return 1;
                  if (bId === "__untagged__") return -1;
                  const aSaved = savedSet.has(aId), bSaved = savedSet.has(bId);
                  if (aSaved !== bSaved) return aSaved ? -1 : 1;
                  const aA = ARTISTS.find(x => x.id === aId);
                  const bA = ARTISTS.find(x => x.id === bId);
                  // Order by night-relative start (toNightMin rolls post-midnight
                  // sets past the evening ones) so the night reads in real order,
                  // not lexically (which floated 00:32 above 20:00).
                  const aMin = aA?.start ? (window.toNightMin?.(aA.start) ?? 9999) : 9999;
                  const bMin = bA?.start ? (window.toNightMin?.(bA.start) ?? 9999) : 9999;
                  return aMin - bMin;
                });
                return orderedKeys.map(aId => {
                  const groupMoments = groups.get(aId);
                  const isUntagged = aId === "__untagged__";
                  const artist = !isUntagged ? ARTISTS.find(x => x.id === aId) : null;
                  const stage  = artist ? STAGES.find(s => s.id === artist.stage) : null;
                  const accent = isUntagged ? "var(--ember)" : (stage?.color || "var(--muted)");
                  // Tagged groups lead with their best shot (+ a cover thumb);
                  // the untagged group stays chronological so retag work is
                  // predictable.
                  const hero = isUntagged ? null : _pickHeroMoment(groupMoments);
                  const orderedMoments = hero
                    ? [hero, ...groupMoments.filter(m => m.id !== hero.id)]
                    : groupMoments;
                  return (
                    <div key={aId} style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => !isUntagged && setState(s => ({ ...s, artist: aId }))}
                        disabled={isUntagged}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          flex: 1, minWidth: 0, padding: "6px 4px",
                          background: "transparent", border: "none",
                          textAlign: "left",
                          cursor: isUntagged ? "default" : "pointer",
                        }}>
                        <span style={{
                          width: 4, alignSelf: "stretch",
                          background: accent, borderRadius: 3,
                        }}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono" style={{
                            fontSize: 9, letterSpacing: 1.3, fontWeight: 700,
                            color: accent,
                          }}>
                            {isUntagged ? "TO RETAG" : (stage?.short || stage?.name || "").toUpperCase()}
                          </div>
                          <div className="serif" style={{
                            fontSize: 18, color: "var(--ink)", lineHeight: 1.1,
                            marginTop: 2,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {isUntagged ? "Untagged moments" : artist?.name || "Unknown"}
                          </div>
                        </div>
                        <span className="mono" style={{
                          fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", fontWeight: 700,
                          flexShrink: 0,
                        }}>{groupMoments.length} {groupMoments.length === 1 ? "MOMENT" : "MOMENTS"}</span>
                      </button>
                      {hero && (
                        <_GroupHeroThumb moment={hero} accent={accent}
                          onClick={() => openLightbox(orderedMoments, 0)} />
                      )}
                      </div>
                      {/* #3 — "the song you were filming": a tappable index of
                          the tracks you captured during this set. */}
                      {!isUntagged && artist && (
                        <SetSongTimeline
                          artist={artist}
                          moments={orderedMoments}
                          onOpenMoment={(m) => openLightbox(orderedMoments, Math.max(0, orderedMoments.findIndex(x => x.id === m.id)))}
                        />
                      )}
                      {/* Bulk retag: when the TO RETAG group has 3+ moments
                          AND the user has saved sets on this night, surface
                          a chip row that one-taps all of them to the same
                          artist. Cheaper-than-AI escape from a stuck
                          batch where EXIF was stripped on a bunch of
                          photos at the same set. */}
                      {isUntagged && groupMoments.length >= 3 && savedNightArtists.length > 0 && (
                        <BulkRetagRow
                          moments={groupMoments}
                          savedNightArtists={savedNightArtists}
                          onUpdate={handleUpdate}
                        />
                      )}
                      {orderedMoments.map((m, i) => (
                        <MomentCard
                          key={m.id}
                          moment={m}
                          idx={i}
                          total={orderedMoments.length}
                          groupMoments={orderedMoments}
                          onOpenLightbox={openLightbox}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                          savedArtistIds={state.saved || []}
                          onArtistClick={(id) => setState(s => ({ ...s, artist: id }))}
                        />
                      ))}
                    </div>
                  );
                });
              })()}

              {(manage || adding === d.n) && (adding === d.n ? (
                <AddMomentForm
                  night={d.n}
                  savedNightArtists={savedNightArtists}
                  onAdd={handleAdd}
                  onCancel={() => setAdding(null)}
                />
              ) : (
                <button onClick={() => setAdding(d.n)} className="mono" style={{
                  width: "100%", padding: "12px",
                  background: "transparent", border: "1px dashed var(--line-2)",
                  borderRadius: 12, color: "var(--ink)",
                  fontSize: 10, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer",
                  marginTop: moments.length > 0 ? 4 : 0,
                }}>+ ADD MOMENT</button>
              ))}

              {manage && savedNightArtists.length > 0 && (
                <AttendanceReview night={d.n} savedNightArtists={savedNightArtists} />
              )}
            </div>
          );
        })}

        <StorageManager all={all} onChange={() => setAll(_readMoments())} />
      </ScrollBody>
    </Screen>
  );
}

// v137: manual attendance review — checkbox list of every saved set for a
// given night. Toggling persists via markAttended/unmarkAttended which both
// emit the "plursky-attended-change" event so other UI (Me-tab SETS CAUGHT)
// stays in sync.
function AttendanceReview({ night, savedNightArtists }) {
  const [attended, setAttended] = React.useState(() => getAttendedForNight(night));
  React.useEffect(() => {
    const refresh = () => setAttended(getAttendedForNight(night));
    window.addEventListener("plursky-attended-change", refresh);
    return () => window.removeEventListener("plursky-attended-change", refresh);
  }, [night]);
  const toggle = (id) => {
    try { window.plurskyHaptic?.(attended.has(id) ? "LIGHT" : "MEDIUM"); } catch {}
    if (attended.has(id)) unmarkAttended(night, id);
    else markAttended(night, id, "manual");
  };
  const caught = savedNightArtists.filter(a => attended.has(a.id)).length;
  return (
    <div style={{
      marginTop: 10, padding: "12px 14px",
      background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 700 }}>
          SETS YOU CAUGHT
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: caught === savedNightArtists.length ? "var(--success)" : "var(--muted)", fontWeight: 700 }}>
          {caught} / {savedNightArtists.length}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {savedNightArtists
          .slice()
          .sort((a, b) => (window.toNightMin?.(a.start) ?? 9999) - (window.toNightMin?.(b.start) ?? 9999))
          .map(a => {
            const on = attended.has(a.id);
            const stage = STAGES.find(s => s.id === a.stage);
            const src = on ? getAttendanceSource(a.id) : null;
            return (
              <button key={a.id} onClick={() => toggle(a.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8,
                background: on ? "rgba(45,122,85,0.10)" : "var(--paper)",
                border: on ? "1px solid rgba(45,122,85,0.4)" : "1px solid var(--line)",
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  background: on ? "var(--success)" : "transparent",
                  border: on ? "none" : "1.5px solid var(--line-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                }}>{on ? "✓" : ""}</span>
                <div style={{ width: 3, alignSelf: "stretch", background: stage?.color || "var(--line-2)", borderRadius: 3 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 14, lineHeight: 1.1 }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2, fontWeight: 600 }}>
                    {(stage?.short || "").toUpperCase()} · {fmt12(a.start)}
                  </div>
                </div>
                {src === "gps" && (
                  <span className="mono" style={{
                    fontSize: 8, letterSpacing: 1, color: "var(--success)", fontWeight: 700,
                    padding: "2px 6px", borderRadius: 999,
                    background: "rgba(45,122,85,0.14)",
                  }}>📍 GPS</span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}

// Collapsible section — used to tuck away during-festival surfaces (badges,
// safety) once the festival is over, so the post-fest Me tab leads with what
// still matters. Tap the header to expand.
function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ marginTop: 20 }}>
      <button onClick={() => setOpen(o => !o)} className="mono" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", background: "var(--paper-2)", border: "1px solid var(--line)",
        borderRadius: 12, padding: "12px 14px", cursor: "pointer",
        fontSize: 11, letterSpacing: 1.3, fontWeight: 700, color: "var(--ink)",
      }}>
        <span>{title}</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

function MeScreen({ state, setState }) {
  // Post-festival: during-festival sections (badges, safety) collapse so the
  // Me tab isn't cluttered with stuff that only mattered on-site.
  const _mePostFest = Date.now() > (FESTIVAL_CONFIG?.endMs || Infinity);
  // Build identity from Spotify profile when available, else fall back to user-set name
  const [profile, setProfile] = React.useState(getSpotifyProfileSync);
  const [localName, setLocalName] = React.useState(() => {
    try { return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || ""; } catch { return ""; }
  });
  React.useEffect(() => {
    if (state.spotifyConnected && !profile) {
      ensureSpotifyProfile().then(setProfile);
    }
  }, [state.spotifyConnected]);

  // Resolve display name from Spotify profile → display_name → user_name
  // (matches Runbuds-style identity: serif name + ping chip + tagline).
  const rawName = profile?.name || localName || "";
  const displayName = rawName || "—";
  const initial = rawName ? (rawName.match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase() : "?";
  const promptName = () => {
    const next = (window.prompt("Your name (shown to crew & on this screen):", localName || "") || "").trim();
    if (!next) return;
    try { localStorage.setItem("plursky_display_name", next); } catch {}
    setLocalName(next);
  };

  // Ping code (e.g. SAGE) — exported on window by map.jsx
  const pingCode = (typeof window.getMyPingCode === "function" ? window.getMyPingCode() : "PLUR");

  // Deterministic ping color from code → palette token. Stays in the
  // desert-dawn family (ember/flare/horizon/sky/success). Avatar circle
  // + ping chip dot pull from this so identity reads consistent.
  const PING_PALETTE = ["var(--ember)", "var(--flare)", "var(--horizon)", "var(--sky)", "var(--success)"];
  let pingHash = 0;
  for (let i = 0; i < pingCode.length; i++) pingHash = (pingHash * 31 + pingCode.charCodeAt(i)) >>> 0;
  const pingColor = PING_PALETTE[pingHash % PING_PALETTE.length];

  // Live crew count from Supabase Realtime presence (0 if not connected)
  const [crewCount, setCrewCount] = React.useState(() => {
    try {
      const snap = window.sbGetPresSnap?.() || {};
      const mine = window.sbGetMyPresId?.();
      return Object.keys(snap).filter(id => id !== mine).length;
    } catch { return 0; }
  });
  React.useEffect(() => {
    if (typeof window.sbOnPresenceChange !== "function") return;
    return window.sbOnPresenceChange(snap => {
      try {
        const mine = window.sbGetMyPresId?.();
        setCrewCount(Object.keys(snap).filter(id => id !== mine).length);
      } catch {}
    });
  }, []);

  // Settings (Notifications / Battery / Pack list / Wizard) folded into a
  // single disclosure so the festival-flavored top of the page reads first.
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [festivalOpen, setFestivalOpen] = React.useState(true);
  const [socialOpen, setSocialOpen] = React.useState(true);

  // Stats — kept locally per the spec; intentionally cheap, not precious.
  // SETS CAUGHT now reflects real attendance (live GPS auto-detect + manual
  // review checklist in Memories). Re-renders on any attendance change via
  // the global "plursky-attended-change" event.
  const [setsCaught, setSetsCaught] = React.useState(getAttendedCount);
  React.useEffect(() => {
    const refresh = () => setSetsCaught(getAttendedCount());
    window.addEventListener("plursky-attended-change", refresh);
    return () => window.removeEventListener("plursky-attended-change", refresh);
  }, []);
  const daysHere = NOW.day || 0;
  const savedCount = state.saved.length;
  // Earned-badge count for the 4-card grid badge — cheap derivation mirroring
  // BadgesSection's logic. Always at least 1 (the "30 Years Crew" auto-earn).
  const badgesEarnedCount = React.useMemo(() => {
    const savedArtists = state.saved.map(id => ARTISTS.find(x => x.id === id)).filter(Boolean);
    const stages = new Set(savedArtists.map(a => a.stage));
    const heads  = savedArtists.filter(a => a.tier === 3).length;
    const byStg  = (id) => savedArtists.filter(a => a.stage === id).length;
    let n = 1; // 30 Years Crew always
    if (savedArtists.length >= 1) n++;
    if (savedArtists.length >= 10) n++;
    if (savedArtists.length >= 20) n++;
    if (stages.size >= 5) n++;
    if (stages.size >= 9) n++;
    if (heads >= 3) n++;
    if (byStg("quantum") >= 3) n++;
    if (byStg("neon") >= 3) n++;
    if (byStg("circuit") >= 3) n++;
    if (byStg("basspod") + byStg("waste") >= 3) n++;
    return n;
  }, [state.saved]);

  // Tagline — "DAY N OF EDC LV 2026" once the festival is live, otherwise
  // a pre-festival countdown line with the date range.
  const _cfg = window.FESTIVAL_CONFIG || {};
  const tagline = daysHere
    ? `DAY ${daysHere} OF ${(_cfg.shortName || _cfg.brand || "").toUpperCase()}`
    : `${(_cfg.shortName || _cfg.brand || "").toUpperCase()} · ${(_cfg.dates || "").toUpperCase()}`;

  return (
    <Screen bg="var(--paper)">
      <div style={{ padding: "8px 20px" }}>
        <TopBar title={<span>Me</span>} sub={FESTIVAL_CONFIG.shortName.toUpperCase()} tight />
      </div>
      <ScrollBody ref={useStaggerFade("me")} style={{ padding: "10px 20px 94px" }}>
        {/* ── 1. Identity card (Runbuds-modeled) ───────────────────
            Centered avatar in the user's ping color, serif name,
            ping-code chip in mono caps, festival-day tagline. */}
        <div data-animate style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "18px 16px 20px", marginBottom: 16,
        }}>
          <div
            onClick={profile ? undefined : promptName}
            style={{
              width: 78, height: 78, borderRadius: 999,
              background: profile?.image ? "transparent" : pingColor,
              border: "3px solid #fff",
              boxShadow: "0 2px 8px rgba(26,18,13,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              cursor: profile ? "default" : "pointer",
              marginBottom: 10,
            }}
          >
            {profile?.image ? (
              <img src={profile.image} alt="" style={{
                width: "100%", height: "100%", objectFit: "cover",
              }}/>
            ) : (
              <span className="serif" style={{
                fontSize: 36, color: "#fff", lineHeight: 1,
                textShadow: "0 1px 2px rgba(26,18,13,0.25)",
              }}>{initial}</span>
            )}
          </div>
          <div
            className="serif"
            onClick={rawName ? undefined : promptName}
            style={{
              fontSize: 28, lineHeight: 1.05, color: rawName ? "var(--ink)" : "var(--muted)",
              textAlign: "center", marginBottom: 8,
              cursor: rawName ? "default" : "pointer",
            }}
          >
            {displayName}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--paper-2)", borderRadius: 999, padding: "4px 10px",
            marginBottom: 8,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 999, background: pingColor,
              display: "inline-block",
            }}/>
            <span className="mono" style={{
              fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--ink)",
            }}>PING · {pingCode}</span>
          </div>
          <div className="mono" style={{
            fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
          }}>{tagline}</div>
        </div>

        {/* ── 2. Three-stat row (Forest-modeled) ───────────────────
            Sets caught (saved sets whose day has passed/is today),
            crew (live presence count), days here (NOW.day). */}
        <div data-animate style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          background: "var(--paper-2)", border: "1px solid var(--line)",
          borderRadius: 14, padding: "14px 4px", marginBottom: 18,
        }}>
          {[
            { n: setsCaught, label: "SETS CAUGHT" },
            { n: crewCount,  label: "CREW" },
            { n: daysHere,   label: "DAYS HERE" },
          ].map((s, i) => (
            <div key={s.label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              borderLeft: i === 0 ? "none" : "1px solid var(--line)",
              padding: "2px 6px",
            }}>
              <div className="serif" style={{ fontSize: 28, lineHeight: 1, color: "var(--ink)", marginBottom: 6 }}>
                {s.n}
              </div>
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
                textAlign: "center",
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── 3. 4-card grid (komoot-modeled) ──────────────────────
            Quick jumps to Saved, Memories (stub), Crew (stub),
            Badges (stub). 2x2 square-ish cells with emoji + count. */}
        <div data-animate style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
          marginBottom: 22,
        }}>
          {[
            { key: "saved",    label: "SAVED",    count: savedCount, icon: "★",
              onClick: () => setState(st => ({ ...st, tab: "lineup" })) },
            { key: "memories", label: "MEMORIES", count: _countMoments(), icon: "◐",
              onClick: () => setState(s => ({ ...s, tab: "memories" })) },
            { key: "crew",     label: "CREW",     count: crewCount,   icon: "☷",
              onClick: () => document.getElementById("plursky-crew-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
            { key: "badges",   label: "BADGES",   count: badgesEarnedCount, icon: "✦",
              onClick: () => {
                document.getElementById("plursky-badges-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
              } },
          ].map(card => (
            <button key={card.key} onClick={card.onClick} style={{
              position: "relative",
              background: "var(--paper-2)", border: "1px solid var(--line)",
              borderRadius: 14, padding: 14, minHeight: 96,
              display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "space-between",
              textAlign: "left", cursor: "pointer",
              fontFamily: "inherit", color: "var(--ink)",
            }}>
              <div style={{
                position: "absolute", top: 12, right: 14,
                fontSize: 18, lineHeight: 1, color: "var(--muted)",
              }}>{card.icon}</div>
              <div/>
              <div>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1, color: "var(--ink)" }}>
                  {card.count}
                </div>
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: 1.2, fontWeight: 700, color: "var(--muted)",
                  marginTop: 4,
                }}>{card.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Festival Recap entry (v145) ───────────────────────────
            Spotify-Wrapped-style summary of the weekend — sets caught,
            top stage, top genre, hidden gems. Lives behind a big card
            on Me so it's discoverable but optional. Only renders once
            the festival is over (otherwise the stats are noise). */}
        {typeof window.FESTIVAL_CONFIG?.endMs === "number" && Date.now() > window.FESTIVAL_CONFIG.endMs && (
          <button onClick={() => setState(s => ({ ...s, tab: "recap" }))} style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%", padding: "14px 16px", marginBottom: 14,
            background: "linear-gradient(135deg, var(--ink) 0%, var(--horizon) 100%)",
            border: "none", borderRadius: 16,
            color: "var(--paper)", cursor: "pointer", textAlign: "left",
            boxShadow: "0 4px 18px rgba(123,61,154,0.30)",
          }}>
            <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>✦</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 20, lineHeight: 1.05 }}>
                Your <span style={{ fontStyle: "italic", color: "var(--flare)" }}>{_cfg.brand || "festival"}</span> weekend
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "rgba(247,237,224,0.65)", marginTop: 4, fontWeight: 700 }}>
                THE RECAP · {getAttendedCount?.() || 0} SETS CAUGHT · TAP TO SEE
              </div>
            </div>
            <span style={{ fontSize: 18, opacity: 0.75 }}>→</span>
          </button>
        )}

        {/* ── FESTIVAL section (collapsible) ──────────────────── */}
        <div data-animate style={{ borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 14, marginBottom: 18 }}>
          <button onClick={() => setFestivalOpen(o => !o)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px",
            textAlign: "left", color: "var(--ink)",
          }}>
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.05 }}>
                Festival
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                HISTORY · BADGES · MUSIC · HEADLINERS
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "transform 0.25s var(--ease-spring)", transform: festivalOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <path d="M9 18 L15 12 L9 6"/>
            </svg>
          </button>
          <div style={{
            display: "grid",
            gridTemplateRows: festivalOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.3s var(--ease-smooth)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <HistoryRecordsSection state={state} setState={setState} />
              <div style={{ marginTop: 14 }}/>
              <div id="plursky-badges-anchor"/>
              {_mePostFest
                ? <Collapsible title="🏅 BADGES"><BadgesSection state={state} /></Collapsible>
                : <BadgesSection state={state} />}
              <div style={{ marginTop: 14 }}/>
              <button
                onClick={() => setState({ ...state, tab: "spotify" })}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  width: "100%", padding: "13px 14px", marginBottom: 14,
                  background: state.spotifyConnected
                    ? "linear-gradient(135deg, rgba(29,185,84,0.12), rgba(123,61,154,0.10))"
                    : "var(--paper-2)",
                  border: state.spotifyConnected
                    ? "1px solid rgba(29,185,84,0.4)"
                    : "1px solid var(--line-2)",
                  borderRadius: 14, cursor: "pointer", textAlign: "left",
                }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 38, flexShrink: 0,
                  background: state.spotifyConnected
                    ? "linear-gradient(135deg, #1DB954, var(--horizon))"
                    : "linear-gradient(135deg, var(--ember), var(--horizon))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="15" r="2.5"/>
                    <path d="M9.5 17 L9.5 5 L19.5 3 L19.5 15"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 18, lineHeight: 1.05, color: "var(--ink)" }}>
                    {state.spotifyConnected ? "Music · matched" : "Match the lineup to your Spotify"}
                  </div>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)", marginTop: 3 }}>
                    {state.spotifyConnected ? "TOP ARTISTS · DISCOVERIES · BUILD PLAYLIST" : "TAP TO CONNECT"}
                  </div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M9 18 L15 12 L9 6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── SOCIAL section (collapsible) ─────────────────────── */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 18 }}>
          <button onClick={() => setSocialOpen(o => !o)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: "none", cursor: "pointer", padding: "0 0 12px",
            textAlign: "left", color: "var(--ink)",
          }}>
            <div>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.05 }}>
                Friends & <span style={{ fontStyle: "italic" }}>crew</span>
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 3 }}>
                LIVE LOCATION · SHARED LINEUPS
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "transform 0.25s var(--ease-spring)", transform: socialOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <path d="M9 18 L15 12 L9 6"/>
            </svg>
          </button>
          <div style={{
            display: "grid",
            gridTemplateRows: socialOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.3s var(--ease-smooth)",
          }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ marginBottom: 14 }}>
                <FriendsCard state={state} setState={setState} />
              </div>
              <div id="plursky-crew-anchor" style={{ marginBottom: 14, scrollMarginTop: 12 }}>
                <CrewCard state={state} />
              </div>
              <AccountCard state={state} setState={setState} />
            </div>
          </div>
        </div>

        {/* Settings — folds Notifications, Battery saver, Pack list, and the
            setup-wizard re-run into one disclosure to keep the festival top
            of the page above the fold. */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => setSettingsOpen(o => !o)}
            style={{
              width: "100%", padding: "13px 14px",
              background: "var(--paper-2)", border: "1px solid var(--line-2)",
              borderRadius: 14, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 12,
              fontFamily: "inherit", color: "var(--ink)",
            }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 18, lineHeight: 1.05 }}>Settings</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--muted)", marginTop: 3 }}>
                NOTIFICATIONS · BATTERY · PACK LIST · WIZARD
              </div>
            </div>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, transition: "transform 0.25s var(--ease-spring)", transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
              <path d="M9 18 L15 12 L9 6"/>
            </svg>
          </button>
          {settingsOpen && (
            <div style={{ marginTop: 10 }}>
              <NotificationsCard state={state} />
              <BatterySaverCard />
              <PackListCard />
              <div style={{ marginTop: 14 }}>
                <button onClick={() => window.plurskyOpenOnboarding?.()} style={{
                  background: "transparent", border: "1px solid var(--line-2)",
                  borderRadius: 999, padding: "8px 14px", cursor: "pointer",
                  color: "var(--muted)",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
                }}>
                  ↻ RE-RUN SETUP WIZARD
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Safety & Wellness — harm-reduction one tap away. Collapses
            post-festival (on-site teams aren't relevant once it's over). */}
        {_mePostFest ? (
          <Collapsible title="🛟 SAFETY & CARE"><SafetyCards /></Collapsible>
        ) : (<>
          <div className="serif" style={{ fontSize: 22, marginTop: 20, marginBottom: 3 }}>
            Safety & <span style={{ fontStyle: "italic" }}>care</span>
          </div>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginBottom: 12 }}>
            ON-SITE TEAMS · NO QUESTIONS ASKED
          </div>
          <SafetyCards />
        </>)}

        {/* Your headliners — saved tier-3 sets, tappable to artist screen.
            Replaces the old static "Memories" grid which was unlinked
            decoration. Hidden if the user hasn't saved any headliners yet. */}
        {(() => {
          const savedHeadliners = state.saved
            .map(id => ARTISTS.find(a => a.id === id))
            .filter(a => a && a.tier === 3)
            .slice(0, 6);
          if (savedHeadliners.length === 0) return null;
          return (
            <>
              <div className="serif" style={{ fontSize: 22, marginTop: 20, marginBottom: 10 }}>
                Your <span style={{ fontStyle: "italic" }}>headliners</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {savedHeadliners.map(a => (
                  <button key={a.id} onClick={() => setState({ ...state, artist: a.id })} style={{
                    aspectRatio: "1/1", borderRadius: 10, background: a.img,
                    position: "relative", overflow: "hidden", border: "none", padding: 0, cursor: "pointer",
                  }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.65))" }}/>
                    <div style={{ position: "absolute", bottom: 6, left: 6, right: 6, color: "#fff", textAlign: "left" }} className="mono">
                      <div style={{ fontSize: 10, letterSpacing: 0.4, fontWeight: 700, lineHeight: 1.1, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                      <div style={{ fontSize: 8, letterSpacing: 1, opacity: 0.8 }}>
                        {FESTIVAL_CONFIG.dayDates[a.day]?.short || ""} · {fmt12(a.start)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          );
        })()}
        <div style={{
          padding: "24px 0 40px", textAlign: "center",
          borderTop: "1px solid var(--line)", marginTop: 24,
        }}>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", marginBottom: 10 }}>
            PLURSKY · {window.FESTIVAL_CONFIG?.shortName || ""}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <a href="https://plursky.com/privacy" target="_blank" rel="noopener noreferrer"
              className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", textDecoration: "none" }}>
              PRIVACY POLICY
            </a>
            <a href="https://plursky.com/terms" target="_blank" rel="noopener noreferrer"
              className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", textDecoration: "none" }}>
              TERMS
            </a>
            <button onClick={() => window.open("mailto:hello@plursky.com")}
              className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              CONTACT
            </button>
          </div>
        </div>
      </ScrollBody>
    </Screen>
  );
}

function FollowedNudge({ state, setState }) {
  const [followed, setFollowed] = React.useState(null); // null=loading, []=none
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    fetchFollowedEdcArtists(state.saved).then(setFollowed);
  }, [state.saved.length]);

  if (!followed || followed.length === 0) return null;

  const handleSave = (artist) => {
    setState(s => ({ ...s, saved: [...new Set([...s.saved, artist.id])] }));
  };
  const handleSaveAll = () => {
    setState(s => ({ ...s, saved: [...new Set([...s.saved, ...followed.map(a => a.id)])] }));
  };

  return (
    <div style={{
      background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.25)",
      borderRadius: 16, padding: "14px 16px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "#1DB954", fontWeight: 700 }}>
            YOU FOLLOW {followed.length} {(FESTIVAL_CONFIG.brand || "").toUpperCase()} ACT{followed.length > 1 ? "S" : ""} NOT IN YOUR LINEUP
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleSaveAll} style={{
            background: "#1DB954", color: "#000", border: "none",
            borderRadius: 999, padding: "5px 10px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1, fontWeight: 700,
          }}>SAVE ALL</button>
          <button onClick={() => setExpanded(e => !e)} style={{
            background: "transparent", color: "rgba(247,237,224,0.6)",
            border: "1px solid rgba(247,237,224,0.2)",
            borderRadius: 999, padding: "5px 10px", cursor: "pointer",
            fontFamily: "Geist Mono, monospace", fontSize: 9, letterSpacing: 1,
          }}>{expanded ? "HIDE" : "VIEW"}</button>
        </div>
      </div>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {followed.map(a => {
            const st = STAGES.find(s => s.id === a.stage);
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "8px 12px",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--paper)" }}>{a.name}</div>
                  <div className="mono" style={{ fontSize: 8, letterSpacing: 1.1, color: "var(--muted)", marginTop: 2 }}>
                    {st?.short} · DAY {a.day} · {fmt12(a.start)}
                  </div>
                </div>
                <button onClick={() => handleSave(a)} style={{
                  background: "transparent", color: st?.color || "#1DB954",
                  border: `1px solid ${st?.color || "#1DB954"}`,
                  borderRadius: 999, padding: "5px 10px", cursor: "pointer",
                  fontFamily: "Geist Mono, monospace", fontSize: 8, letterSpacing: 1, fontWeight: 700,
                }}>+ SAVE</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuildPlaylistButton({ state, soundtrack }) {
  const [status, setStatus] = React.useState("idle"); // idle | working | done | err
  const [result, setResult] = React.useState(null);
  const [buildProgress, setBuildProgress] = React.useState("");

  const run = async () => {
    setStatus("working");
    setBuildProgress("");
    try {
      const r = await createEdcPlaylist(state, { soundtrack, onProgress: (msg) => setBuildProgress(msg) });
      setResult(r);
      if (r.ok) {
        setStatus("done");
      } else {
        setStatus("err");
        // Persist actionable errors (reconnect, missing target playlist) so the
        // user has time to read + click. Auto-clear only transient failures.
        if (r.reason !== "reconnect" && r.reason !== "no_target_playlist") {
          setTimeout(() => setStatus("idle"), 4500);
        }
      }
    } catch (e) {
      setResult({ ok: false, reason: "create_fail", message: String(e?.message || e) });
      setStatus("err");
      setTimeout(() => setStatus("idle"), 4500);
    }
  };

  // After the user reconnects via OAuth and returns to the app, resume the
  // build automatically if they were mid-flow. Removes the otherwise required
  // third click ("connect", "back", "build again").
  React.useEffect(() => {
    let pending = null;
    try { pending = localStorage.getItem("plursky_pending_build"); } catch {}
    if (pending && state.spotifyConnected && _hasPlaylistWriteScope()) {
      try { localStorage.removeItem("plursky_pending_build"); } catch {}
      run();
    }
  }, []); // mount-only — pending flag is one-shot

  const onClick = async () => {
    if (status === "working") return;
    if (status === "err" && (result?.reason === "reconnect" || result?.reason === "not_connected")) {
      // Mark intent so we auto-resume after the OAuth round-trip.
      try { localStorage.setItem("plursky_pending_build", "1"); } catch {}
      startSpotifyAuth(); return;
    }
    if (status === "err" && result?.reason === "no_target_playlist") {
      window.open("https://open.spotify.com/", "_blank", "noopener"); return;
    }
    // When done, clicking opens the playlist (user-initiated — not blocked)
    if (status === "done" && result?.url) {
      window.open(result.url, "_blank", "noopener"); return;
    }
    window.plurskyHaptic?.("MEDIUM");
    run();
  };

  let label, bg = "rgba(29,185,84,0.14)", color = "#1DB954", border = "1px solid #1DB954";
  if (status === "working") {
    label = buildProgress ? `BUILDING · ${buildProgress}` : "BUILDING…";
  } else if (status === "done") {
    const sm = result?.songsMatched || 0;
    label = soundtrack && sm > 0
      ? `✓ ${sm} OF YOUR SONGS + ${result?.added - sm} MORE — OPEN ↗`
      : `✓ ${result?.added} TRACKS · FRI→SAT→SUN — OPEN ↗`;
    bg = "#1DB954"; color = "#000"; border = "none";
  } else if (status === "err") {
    if (result?.reason === "reconnect" || result?.reason === "not_connected") label = "↻ TAP TO GRANT SPOTIFY ACCESS";
    else if (result?.reason === "no_target_playlist") label = "↗ CREATE 'PLURSKY' PLAYLIST IN SPOTIFY";
    else if (result?.reason === "rate_limited") label = "⏱ SPOTIFY BUSY · WAIT 30S, TAP AGAIN";
    else if (result?.reason === "empty") label = "SAVE SETS FIRST";
    else if (result?.reason === "create_fail") {
      const msg = (result?.message || "").slice(0, 28);
      label = msg ? `✕ ${result?.status} · ${msg}` : `✕ FAILED · ${result?.status || "?"}`;
    } else label = "✕ TRY AGAIN";
    bg = "rgba(248,113,113,0.18)"; color = "#fecaca"; border = "1px solid #f87171";
  } else {
    label = soundtrack ? "🎵 SOUNDTRACK → SPOTIFY" : "BUILD MY PLAYLIST";
  }

  return (
    <button onClick={onClick} disabled={status === "working"} style={{
      background: bg, color, border,
      borderRadius: 999, padding: "10px 16px",
      cursor: status === "working" ? "wait" : "pointer",
      fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
      transition: "all .2s",
    }}>{label}</button>
  );
}

// Apple Music playlist builder — sibling of BuildPlaylistButton. Apple Music
// has no Dev-Mode user cap or creation block, so this is the unblocked path.
// Renders nothing until APPLE_DEV_TOKEN is configured (see spotify-api.jsx),
// so it's invisible until Apple Music is wired up.
function AppleMusicPlaylistButton({ state, soundtrack }) {
  const [status, setStatus] = React.useState("idle"); // idle | working | done | err
  const [result, setResult] = React.useState(null);
  const [prog, setProg]     = React.useState("");
  if (!_appleMusicConfigured()) return null;

  const run = async () => {
    setStatus("working"); setProg("");
    try {
      const r = await createAppleMusicPlaylist(state, { soundtrack, onProgress: setProg });
      setResult(r);
      setStatus(r.ok ? "done" : "err");
      if (!r.ok && r.reason !== "not_connected") setTimeout(() => setStatus("idle"), 4500);
    } catch (e) {
      setResult({ ok: false, reason: "create_fail", message: String(e?.message || e) });
      setStatus("err"); setTimeout(() => setStatus("idle"), 4500);
    }
  };
  const onClick = () => { if (status === "working") return; window.plurskyHaptic?.("MEDIUM"); run(); };

  let label, bg = "rgba(250,45,90,0.14)", color = "#fa2d5a", border = "1px solid #fa2d5a";
  if (status === "working") {
    label = prog ? `BUILDING · ${prog}` : "BUILDING…";
  } else if (status === "done") {
    const sm = result?.songsMatched || 0;
    label = soundtrack && sm > 0
      ? `✓ ${sm} OF YOUR SONGS + ${result?.added - sm} MORE`
      : `✓ ${result?.added} TRACKS IN APPLE MUSIC`;
    bg = "#fa2d5a"; color = "#fff"; border = "none";
  } else if (status === "err") {
    if (result?.reason === "not_connected") label = "↻ TAP TO CONNECT APPLE MUSIC";
    else if (result?.reason === "empty") label = "SAVE SETS FIRST";
    else if (result?.reason === "no_tracks") label = "✕ NO TRACKS FOUND";
    else label = `✕ ${result?.status || ""} TRY AGAIN`;
    bg = "rgba(248,113,113,0.18)"; color = "#fecaca"; border = "1px solid #f87171";
  } else {
    label = soundtrack ? "🎵 SOUNDTRACK → APPLE MUSIC" : "BUILD APPLE MUSIC PLAYLIST";
  }

  return (
    <button onClick={onClick} disabled={status === "working"} style={{
      background: bg, color, border, borderRadius: 999, padding: "10px 16px",
      cursor: status === "working" ? "wait" : "pointer",
      fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
      transition: "all .2s",
    }}>{label}</button>
  );
}


// ── Festival Archive — multi-festival memory ──────────────────
// Snapshots the current festival's attendance + moments + saved sets
// when the active festival changes (e.g., EDC ends, ACL activates).
// Snapshots are immutable so users can scroll back through past festivals.
const ARCHIVE_KEY = "plursky_festival_archive_v1";

function _readArchive() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "{}"); } catch { return {}; }
}

function archiveFestival(festivalId, festivalName, festivalConfig) {
  if (!festivalId) return false;
  try {
    const archive = _readArchive();
    // Don't overwrite an existing snapshot — first archive wins (the user
    // explicitly archived) unless empty (auto-archive after re-entry).
    const attended = JSON.parse(localStorage.getItem("plursky_attended_v1") || "{}");
    const moments  = JSON.parse(localStorage.getItem("plursky_moments_v1")  || "{}");
    const saved    = JSON.parse(localStorage.getItem("edc_saved") || "[]");
    const totalAttended = Object.values(attended).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    const totalMoments  = Object.values(moments).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    if (totalAttended === 0 && totalMoments === 0 && saved.length === 0) return false;
    archive[festivalId] = {
      id: festivalId,
      name: festivalName,
      brand: festivalConfig?.brand,
      year: festivalConfig?.year,
      dates: festivalConfig?.dates,
      locationShort: festivalConfig?.locationShort,
      archivedAt: new Date().toISOString(),
      saved, attended, moments,
      totalAttended, totalMoments, totalSaved: saved.length,
    };
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    return true;
  } catch { return false; }
}

// Auto-archive trigger: stamp the current festival ID on first load. When it
// changes, snapshot the previous one. Runs once per session via a module-level
// flag so multiple component mounts don't re-trigger.
let _archiveCheckDone = false;
let _videoArchiveRecoveryDone = false;
function _recoverCurrentVideoMomentsFromArchive() {
  if (_videoArchiveRecoveryDone) return;
  _videoArchiveRecoveryDone = true;
  try {
    const cur = window.FESTIVAL_CONFIG?.id;
    if (!cur) return;
    const all = _readMoments();
    let changed = false;
    const moves = [];
    for (const night of Object.keys(all)) {
      const arr = Array.isArray(all[night]) ? all[night] : [];
      for (const m of arr) {
        if (!m || m.kind !== "video" || !m._fingerprint) continue;
        if (m.festivalId && m.festivalId !== cur) continue;
        const parsed = _momentTakenAtToDateParts(m.takenAt);
        const parsedNight = parsed ? _photoFestivalNight(parsed) : null;
        const needsRecovery = parsedNight == null || !m.artistId || m.tagSource === "fallback" || m.needsRetag;
        if (!needsRecovery) continue;
        const archived = _findArchivedVideoMomentForFingerprint(m._fingerprint);
        const recoveredDate = _momentTakenAtToDateParts(archived?.takenAt);
        if (!archived || !recoveredDate) continue;
        m.takenAt = archived.takenAt;
        m.takenAtSource = "archive-recovered";
        m.artistId = archived.artistId || m.artistId || null;
        const recoveredNight = archived.night || _photoFestivalNight(recoveredDate) || m.night;
        m.night = recoveredNight;
        m.tagSource = "archive-recovered";
        m.autoTagged = !!m.artistId;
        m.needsRetag = false;
        m.tagAmbiguous = false;
        if (!m.festivalId) m.festivalId = cur;
        if (String(recoveredNight) !== String(night)) moves.push({ from: night, to: String(recoveredNight), moment: m });
        changed = true;
      }
    }
    for (const move of moves) {
      all[move.from] = (all[move.from] || []).filter(m => m !== move.moment);
      all[move.to] = [...(all[move.to] || []), move.moment];
    }
    if (changed) _writeMoments(all);
  } catch {}
}
function _maybeAutoArchive() {
  if (_archiveCheckDone) return;
  _archiveCheckDone = true;
  try {
    const cur = window.FESTIVAL_CONFIG?.id;
    if (!cur) return;
    const lastSeen = localStorage.getItem("plursky_last_festival_id");
    // Backfill festivalId on legacy moments (pre-v204) so multi-festival
    // scoping works. They belong to whatever festival was active when they
    // were created = the last-seen festival (or the current one on first run).
    // Run BEFORE the switch handling so the prior festival's moments are
    // correctly attributed and then scoped out of the now-active festival.
    try {
      const moments = _readMoments();
      const attribId = lastSeen || cur;
      let changed = false;
      for (const arr of Object.values(moments)) {
        if (!Array.isArray(arr)) continue;
        for (const m of arr) { if (m && !m.festivalId) { m.festivalId = attribId; changed = true; } }
      }
      if (changed) _writeMoments(moments);
    } catch {}
    if (lastSeen && lastSeen !== cur) {
      // Festival switched — snapshot the previous one's data BEFORE it's
      // co-mingled with the new festival
      const archive = _readArchive();
      if (!archive[lastSeen]) {
        // Need the old config to populate the snapshot meta; pull from registry
        const reg = window.FESTIVALS_REGISTRY || [];
        const prevCfg = reg.find(r => r.config?.id === lastSeen)?.config;
        archiveFestival(lastSeen, prevCfg?.name || lastSeen, prevCfg);
      }
    }
    localStorage.setItem("plursky_last_festival_id", cur);
  } catch {}
}
if (typeof window !== "undefined") setTimeout(_maybeAutoArchive, 100);
if (typeof window !== "undefined") setTimeout(_recoverCurrentVideoMomentsFromArchive, 200);

// ── Festival Recap (v145) ─────────────────────────────────────
// Spotify-Wrapped-style post-festival summary. Stitches together the
// attendance store (plursky_attended_v1), saved sets, Memories moments,
// and any cached Spotify popularity stats into a series of full-bleed
// cards that scroll vertically. No "tap to next" gesture — just a clean
// long-form recap the user can screenshot at will.
function _computeRecap(state) {
  const attended = getAllAttended();                // { night: artistId[] }
  const moments  = _activeMoments(_readMoments());   // active-festival { night: moment[] }
  const ARTISTS  = window.ARTISTS || [];
  const STAGES   = window.STAGES  || [];
  const CFG      = window.FESTIVAL_CONFIG;

  // Flatten to attended-artist objects with night info
  const caughtArtists = [];
  Object.keys(attended).forEach(n => {
    (attended[n] || []).forEach(id => {
      const a = ARTISTS.find(x => x.id === id);
      if (a) caughtArtists.push({ ...a, _night: +n });
    });
  });
  const setsCount = caughtArtists.length;

  // Time spent (minutes) across all attended sets
  const totalMin = caughtArtists.reduce((sum, a) => {
    const sm = window.toNightMin?.(a.start) || 0;
    const em = window.toNightMin?.(a.end)   || 0;
    return sum + Math.max(0, em - sm);
  }, 0);

  // Sets per night → busiest night
  const byNight = {};
  caughtArtists.forEach(a => { byNight[a._night] = (byNight[a._night] || 0) + 1; });
  const busiestNight = Object.keys(byNight).sort((x, y) => byNight[y] - byNight[x])[0];
  const busiestNightCount = busiestNight ? byNight[busiestNight] : 0;
  const busiestNightLabel = busiestNight && CFG?.dayDates?.[busiestNight]?.name || `Night ${busiestNight || "—"}`;

  // Sets per stage → top stage
  const byStage = {};
  const stageMinutes = {};
  caughtArtists.forEach(a => {
    byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    const sm = window.toNightMin?.(a.start) || 0;
    const em = window.toNightMin?.(a.end)   || 0;
    stageMinutes[a.stage] = (stageMinutes[a.stage] || 0) + Math.max(0, em - sm);
  });
  const topStageId = Object.keys(stageMinutes).sort((x, y) => stageMinutes[y] - stageMinutes[x])[0];
  const topStage   = topStageId ? STAGES.find(s => s.id === topStageId) : null;
  const topStageMin = topStageId ? stageMinutes[topStageId] : 0;

  // Genre tally
  const byGenre = {};
  caughtArtists.forEach(a => { byGenre[a.genre] = (byGenre[a.genre] || 0) + 1; });
  const topGenre = Object.keys(byGenre).sort((x, y) => byGenre[y] - byGenre[x])[0] || null;

  // First and last set (chronologically across all 3 nights)
  const _artistEpoch = (a) => {
    const dm = CFG?.dayDates?.[a._night];
    if (!dm) return 0;
    const [h, m] = a.start.split(":").map(Number);
    const adjustH = h < 6 ? h + 24 : h;
    return dm.midnightUtc + adjustH * 3600000 + m * 60000;
  };
  const chronological = caughtArtists.slice().sort((x, y) => _artistEpoch(x) - _artistEpoch(y));
  const firstSet = chronological[0] || null;
  const lastSet  = chronological[chronological.length - 1] || null;

  // Headliners caught
  const headlinersCaught = caughtArtists.filter(a => a.tier === 3);
  const headlinerNames = headlinersCaught.map(a => a.name);

  // Sunrise sets caught (started at or after 04:00 next-day, i.e. early-AM)
  const sunriseSets = caughtArtists.filter(a => {
    const [h] = a.start.split(":").map(Number);
    return h >= 4 && h <= 8;
  });

  // Hidden gem: lowest Spotify popularity among the artists they caught
  // (requires the spotify_artist_data_v1 cache that artist.jsx populates).
  let hiddenGem = null;
  let topByPop  = null;
  try {
    const cache = JSON.parse(localStorage.getItem("spotify_artist_data_v1") || "{}");
    const annotated = caughtArtists
      .map(a => {
        const c = cache[a.name.toLowerCase()];
        return c?.popularity > 0 ? { ...a, _pop: c.popularity } : null;
      })
      .filter(Boolean);
    if (annotated.length) {
      annotated.sort((x, y) => x._pop - y._pop);
      hiddenGem = annotated[0];
      topByPop  = annotated[annotated.length - 1];
    }
  } catch {}

  // Memories
  const allMoments = Object.values(moments).flat();
  const photoMoments = allMoments.filter(m => m.photoId);
  const videoMoments = allMoments.filter(m => m.kind === "video");
  // v148: hero-photo candidate — earliest photo we have so the hero card
  // reads chronologically. Image-only (videos render slow/heavy as a bg).
  const heroPhotoMoment = photoMoments
    .filter(m => m.kind !== "video")
    .slice()
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0] || null;

  // v147: stages visited (unique stages with ≥1 attended set)
  const stagesVisited = Array.from(new Set(caughtArtists.map(a => a.stage)));
  const stagesVisitedNames = stagesVisited
    .map(id => STAGES.find(s => s.id === id))
    .filter(Boolean)
    .map(s => s.name);

  // v147: walking distance estimate — sum minutes from WALK_PAIRS for every
  // stage-to-stage transition in chronological attendance, then convert to
  // approximate metres at festival pace (~75 m/min).
  const _artistEpochM = (a) => {
    const dm = CFG?.dayDates?.[a._night];
    if (!dm) return 0;
    const [h, m] = a.start.split(":").map(Number);
    return dm.midnightUtc + (h < 6 ? h + 24 : h) * 3600000 + m * 60000;
  };
  const walkSequence = caughtArtists.slice().sort((a, b) => _artistEpochM(a) - _artistEpochM(b));
  let walkingMinutesLo = 0, walkingMinutesHi = 0;
  const WP = window.WALK_PAIRS || {};
  const PK = window._pairKey || ((a, b) => a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 1; i < walkSequence.length; i++) {
    const prev = walkSequence[i - 1].stage;
    const cur  = walkSequence[i].stage;
    if (prev === cur) continue;
    const pair = WP[PK(prev, cur)];
    if (!pair) continue;
    walkingMinutesLo += pair[0];
    walkingMinutesHi += pair[1];
  }
  const walkingMetersLo = Math.round(walkingMinutesLo * 75);
  const walkingMetersHi = Math.round(walkingMinutesHi * 75);

  // v147: B2B sets caught — artist names containing "b2b" or " b2b "
  const b2bSets = caughtArtists.filter(a => /\bb2b\b/i.test(a.name));

  return {
    setsCount,
    totalMin,
    nights: Object.keys(byNight).length,
    busiestNightLabel,
    busiestNightCount,
    topStage, topStageMin,
    topGenre,
    firstSet, lastSet,
    headlinersCaught: headlinersCaught.length,
    headlinerNames,
    sunriseSetsCount: sunriseSets.length,
    hiddenGem, topByPop,
    momentsCount: allMoments.length,
    photosCount:  photoMoments.length,
    videosCount:  videoMoments.length,
    stagesVisitedCount: stagesVisited.length,
    stagesVisitedNames,
    walkingMinutesLo, walkingMinutesHi,
    walkingMetersLo,  walkingMetersHi,
    b2bCount: b2bSets.length,
    b2bNames: b2bSets.map(a => a.name),
    heroPhotoMoment,
    // v148: saved-but-not-attended = the ones you marked then missed.
    // Trim to the most "valuable" — by tier desc, then by chronological order.
    missedSaved: (state.saved || [])
      .map(id => ARTISTS.find(a => a.id === id))
      .filter(a => a && !caughtArtists.some(ca => ca.id === a.id))
      .sort((a, b) => (b.tier || 0) - (a.tier || 0))
      .slice(0, 6),

    // S2: Genre breakdown from caught artists
    genreBreakdown: (() => {
      const counts = {};
      caughtArtists.forEach(a => {
        const g = (a.genre || "").toLowerCase();
        if (g) counts[g] = (counts[g] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({ genre, count }));
    })(),

    // S4: Festival vibe score — energy heuristic from genres
    vibeScore: (() => {
      const highEnergy = ["dubstep","bass","hardstyle","hardcore","drum and bass","dnb","tech house","techno","riddim","psytrance","hard dance"];
      const chill = ["ambient","downtempo","lofi","acoustic","folk","singer-songwriter","jazz","blues"];
      let energy = 0, total = 0;
      caughtArtists.forEach(a => {
        const g = (a.genre || "").toLowerCase();
        if (!g) return;
        total++;
        if (highEnergy.some(k => g.includes(k))) energy++;
        else if (chill.some(k => g.includes(k))) energy -= 0.3;
        else energy += 0.5;
      });
      return total > 0 ? Math.min(100, Math.max(0, Math.round(energy / total * 100))) : null;
    })(),
  };
}

function _fmtHrsMin(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}M`;
  if (m === 0) return `${h}H`;
  return `${h}H ${m}M`;
}

function _aggregateSoundtrack(moments) {
  const songMap = {};
  const artists = window.ARTISTS || [];
  for (const m of Object.values(moments)) {
    if (!m.artistId || !m.takenAt) continue;
    const artist = artists.find(a => a.id === m.artistId);
    if (!artist) continue;
    const cached = _setlistCache[artist.name.toLowerCase().replace(/\W+/g, "_")];
    if (!cached || cached.source !== "1001tracklists") continue;
    const match = _matchSongAtTime(artist, cached, m.takenAt);
    if (!match) continue;
    const key = match.song.toLowerCase();
    if (!songMap[key]) songMap[key] = { song: match.song, count: 0, artists: new Set() };
    songMap[key].count++;
    songMap[key].artists.add(artist.name);
  }
  return Object.values(songMap).sort((a, b) => b.count - a.count);
}

// ── Festival Wrapped — Spotify-style swipeable story ─────────────
function WrappedStory({ recap, onClose }) {
  const [idx, setIdx] = React.useState(0);
  const CFG = window.FESTIVAL_CONFIG || {};
  const heroUrl = useMomentPhoto(recap.heroPhotoMoment?.photoId);

  const cards = React.useMemo(() => {
    const c = [];
    c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #6D28D9 50%, #e85d2e 100%)",
      kicker: (CFG.shortName || "FESTIVAL").toUpperCase() + " · " + (CFG.year || ""),
      headline: <>Your <em>Wrapped</em></>,
      sub: `${recap.setsCount} sets · ${recap.nights} nights · ${recap.stagesVisitedCount} stages`,
    });
    if (recap.setsCount > 0) c.push({
      bg: "linear-gradient(155deg, #1a120d 0%, #e85d2e 100%)",
      kicker: "SETS CAUGHT",
      headline: <>{recap.setsCount}</>,
      sub: `across ${recap.nights} night${recap.nights !== 1 ? "s" : ""} and ${recap.stagesVisitedCount} stages`,
    });
    if (recap.topStage) c.push({
      bg: `linear-gradient(155deg, #0a0618 0%, ${recap.topStage.color} 100%)`,
      kicker: "YOUR HOME STAGE",
      headline: <>{recap.topStage.name}</>,
      sub: `${Math.round(recap.topStageMin / 60 * 10) / 10} hours spent here`,
    });
    if (recap.topGenre) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #ec4899 100%)",
      kicker: "TOP GENRE",
      headline: <>{recap.topGenre}</>,
      sub: recap.genreBreakdown ? Object.entries(recap.genreBreakdown).sort((a,b) => b[1]-a[1]).slice(0,3).map(([g,n]) => `${g}: ${n}`).join(" · ") : "",
    });
    if (recap.totalMin > 0) {
      const mi = recap.walkingMetersHi ? (recap.walkingMetersHi / 1609.34).toFixed(1) : null;
      c.push({
        bg: "linear-gradient(155deg, #1a120d 0%, #22c55e 100%)",
        kicker: "TIME UNDER THE SKY",
        headline: <>{Math.round(recap.totalMin / 60 * 10) / 10}<span style={{ fontSize: "0.5em" }}> hours</span></>,
        sub: mi ? `~${mi} miles walked between stages` : `${recap.setsCount} sets across ${recap.nights} nights`,
      });
    }
    if (recap.sunriseSetsCount > 0) c.push({
      bg: "linear-gradient(155deg, #1a120d 0%, #fbbf24 60%, #e85d2e 100%)",
      kicker: "SUNRISE WARRIOR",
      headline: <>{recap.sunriseSetsCount} sunrise set{recap.sunriseSetsCount > 1 ? "s" : ""}</>,
      sub: recap.lastSet ? `Last set ended at ${window.fmt12?.(recap.lastSet.end) || recap.lastSet.end}` : "",
    });
    if (recap.hiddenGem) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #7b3d9a 100%)",
      kicker: "YOUR HIDDEN GEM",
      headline: <>{recap.hiddenGem.name}</>,
      sub: `Only ${recap.hiddenGem._pop}% mainstream — you found something special`,
    });
    if (recap.momentsCount > 0) c.push({
      bg: heroUrl
        ? `linear-gradient(155deg, rgba(10,6,24,0.8) 0%, rgba(109,40,217,0.7) 100%), url(${heroUrl}) center/cover`
        : "linear-gradient(155deg, #0a0618 0%, #6D28D9 100%)",
      kicker: "MEMORIES CAPTURED",
      headline: <>{recap.photosCount + recap.videosCount}</>,
      sub: `${recap.photosCount} photos${recap.videosCount ? ` · ${recap.videosCount} videos` : ""} — your festival, preserved`,
    });
    const soundtrack = _aggregateSoundtrack(_readMoments());
    if (soundtrack.length > 0) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #1DB954 100%)",
      kicker: "YOUR SOUNDTRACK",
      headline: <>{soundtrack.length} <span style={{ fontSize: "0.5em" }}>songs captured</span></>,
      sub: soundtrack.slice(0, 3).map(s => s.song).join(" · "),
      custom: React.createElement("div", { style: { marginTop: 16, textAlign: "left", width: "100%", maxWidth: 300 } },
        soundtrack.slice(0, 5).map((s, i) => React.createElement("div", {
          key: i,
          className: "mono",
          style: {
            fontSize: 9, letterSpacing: 0.8, padding: "6px 0",
            borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.1)" : "none",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            color: "rgba(255,255,255,0.9)",
          },
        },
          React.createElement("span", { style: { fontWeight: 700 } }, `${i + 1}. ${s.song}`),
          React.createElement("span", { style: { color: "rgba(255,255,255,0.4)", fontSize: 8 } }, `${s.count} photo${s.count > 1 ? "s" : ""}`)
        ))
      ),
    });
    c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #6D28D9 50%, #e85d2e 100%)",
      kicker: "THAT'S A WRAP",
      headline: <>See you next year</>,
      sub: `${recap.setsCount} sets · ${recap.stagesVisitedCount} stages · ${recap.momentsCount} memories`,
      final: true,
    });
    return c;
  }, [recap, heroUrl]);

  const card = cards[idx] || cards[0];
  const next = () => setIdx(i => Math.min(i + 1, cards.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));

  const handleTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) prev();
    else next();
  };

  const handleExport = async () => {
    if (!_isPlusSub()) { alert("Upgrade to Plursky+ to export your Wrapped cards."); return; }
    try { await _shareRecapCard(recap); } catch {}
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", gap: 3, padding: "12px 16px 0",
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
      }}>
        {cards.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= idx ? "#fff" : "rgba(255,255,255,0.25)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>

      <button onClick={onClose} aria-label="Close" style={{
        position: "absolute", top: 22, right: 16, zIndex: 3,
        width: 36, height: 36, borderRadius: 36, border: "none",
        background: "rgba(255,255,255,0.15)", color: "#fff",
        fontSize: 18, cursor: "pointer", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>✕</button>

      <div onClick={handleTap} style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 32px 120px",
        background: card.bg,
        transition: "background 0.5s",
        cursor: "pointer", userSelect: "none",
      }}>
        <div className="mono" style={{
          fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.5)",
          fontWeight: 700, marginBottom: 24,
        }}>{card.kicker}</div>
        <div className="serif" style={{
          fontSize: card.headline?.props?.children?.toString?.()?.length > 15 ? 38 : 64,
          lineHeight: 0.95, color: "#fff", textAlign: "center",
          letterSpacing: -1, marginBottom: 16,
        }}>{card.headline}</div>
        <div style={{
          fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center",
          lineHeight: 1.5, maxWidth: 280,
        }}>{card.sub}</div>
          {card.custom && card.custom}
      </div>

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "20px 24px 40px",
        display: "flex", justifyContent: "center", gap: 12,
      }}>
        {card.final ? (
          <button onClick={onClose} className="mono" style={{
            padding: "12px 32px", borderRadius: 999, border: "none",
            background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
            color: "#fff", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 4px 20px rgba(109,40,217,0.4)",
          }}>CLOSE WRAPPED</button>
        ) : (
          <button onClick={handleExport} className="mono" style={{
            padding: "10px 20px", borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)", fontSize: 9, letterSpacing: 1.4, fontWeight: 700,
            cursor: "pointer", backdropFilter: "blur(4px)",
          }}>↗ SHARE CARD{!_isPlusSub() ? " · PLUS" : ""}</button>
        )}
      </div>
    </div>
  );
}

function RecapCard({ accent = "var(--ink)", paper = "var(--paper)", children, mono, kicker }) {
  return (
    <div style={{
      borderRadius: 22, padding: "26px 22px",
      background: paper, color: accent,
      marginBottom: 14,
      minHeight: 200,
      border: "1px solid var(--line)",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 6px 22px rgba(26,18,13,0.06)",
    }}>
      {kicker && (
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.5, fontWeight: 700,
          color: mono || "var(--muted)", marginBottom: 14,
        }}>{kicker}</div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

// v151: in-app rating prompt. Routes through `@capacitor-community/in-app-review`
// on native (SKStoreReviewController — iOS throttles to ~3 prompts/year by
// itself, so we don't have to be clever about timing). Web fallback opens the
// App Store listing in a new tab. Auto-trigger on Recap from the 2nd visit
// onward (1st visit = "let me see what this is"; 2nd = "I like this enough
// to come back") via a localStorage visit counter. Plus a manual link in
// the AccountCard for users who never opens Recap.
// Numeric App Store ID — paste the digits from your App Store listing URL.
// 1) Open https://apps.apple.com/us/app/plursky-live in any browser
// 2) Grab the trailing "/id<NUMBER>" from the URL (10-12 digits)
// 3) Replace null below with the number (no quotes, no slashes)
//
// Once set, the in-app rating prompt's web fallback deep-links straight to
// the listing on web; otherwise it falls back to a generic search. The
// native iOS path (InAppReview, see requestRating) doesn't depend on this
// value — it's only the web-fallback / Account-card link.
const APP_STORE_ID = 6768888507;

// ── Plursky+ paywall ──────────────────────────────────────────────
// Free: 1 static collage per festival (watermarked). Plus: unlimited
// collages, no watermark, GIF, video. $2.99/festival or $7.99/yr.
//
// IAP is handled by RevenueCat (@revenuecat/purchases-capacitor).
// On native: RevenueCat manages StoreKit, receipt validation, and
// entitlement checks. On web: falls back to localStorage flag.
//
// Setup: create products in App Store Connect, configure them in
// RevenueCat dashboard, paste your API key below.
const PLUS_KEY = "plursky_plus_active";
const RC_API_KEY = "appl_xXQYsWOMgIpVPdCTxiXmPeyxFId";
const RC_PRODUCT_IDS = {
  festival: "plursky_plus_festival",  // $2.99 non-consumable
  annual:   "plursky_plus_annual",    // $7.99/yr auto-renewable
};
const RC_ENTITLEMENT = "plus";

let _rcInitialized = false;
async function _initRevenueCat() {
  if (_rcInitialized || !RC_API_KEY) return;
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({ apiKey: RC_API_KEY });
    _rcInitialized = true;
    const { customerInfo } = await Purchases.getCustomerInfo();
    _syncEntitlements(customerInfo);
    Purchases.addCustomerInfoUpdateListener(({ customerInfo: info }) => _syncEntitlements(info));
    if (typeof DEV !== "undefined") console.log("[plursky-iap] RevenueCat initialized");
  } catch (e) { console.warn("[plursky-iap] init failed:", e); }
}

function _syncEntitlements(info) {
  const active = info?.entitlements?.active?.[RC_ENTITLEMENT];
  _setPlusSub(!!active);
}

async function _purchasePlus(productId) {
  if (!window.Capacitor?.isNativePlatform?.()) {
    if (typeof DEV !== "undefined") console.log("[plursky-iap] web mode — toggling Plus for testing");
    _setPlusSub(true);
    return { success: true, web: true };
  }
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return { success: false, error: "RevenueCat not configured" };
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { offerings } = await Purchases.getOfferings();
    const pkg = offerings?.current?.availablePackages?.find(p =>
      p.product?.identifier === productId
    );
    if (!pkg) {
      console.warn("[plursky-iap] product not found:", productId);
      return { success: false, error: "Product not available" };
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    _syncEntitlements(customerInfo);
    return { success: !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT] };
  } catch (e) {
    if (e?.code === "1" || e?.message?.includes("cancelled")) {
      return { success: false, cancelled: true };
    }
    console.error("[plursky-iap] purchase error:", e);
    return { success: false, error: e.message };
  }
}

async function _restorePurchases() {
  if (!window.Capacitor?.isNativePlatform?.()) return { success: false, error: "Web mode" };
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return { success: false, error: "RevenueCat not configured" };
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    _syncEntitlements(customerInfo);
    const restored = !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
    return { success: true, restored };
  } catch (e) {
    console.error("[plursky-iap] restore error:", e);
    return { success: false, error: e.message };
  }
}

function _isPlusSub() { try { return localStorage.getItem(PLUS_KEY) === "1"; } catch { return false; } }
function _setPlusSub(v) { try { localStorage.setItem(PLUS_KEY, v ? "1" : "0"); } catch {} }

// Initialize RevenueCat on first load (non-blocking)
try { _initRevenueCat(); } catch {}

function PlusGate({ children, feature }) {
  if (_isPlusSub()) return children;
  const [busy, setBusy] = React.useState(false);

  const handlePurchase = async (productId) => {
    setBusy(true);
    try {
      const result = await _purchasePlus(productId || RC_PRODUCT_IDS.annual);
      if (result.success) window.location.reload();
    } catch {}
    setBusy(false);
  };

  const handleRestore = async () => {
    setBusy(true);
    try {
      const result = await _restorePurchases();
      if (result.restored) window.location.reload();
      else if (!result.restored && result.success) alert("No previous Plursky+ purchase found for this Apple ID.");
    } catch {}
    setBusy(false);
  };

  const _PLUS_PERKS = [
    ["No watermarks", "Clean, brandable exports"],
    ["Cloud backup", "Your photos & videos, saved safely"],
    ["Unlimited shares", "No daily limit"],
    ["Premium templates", "Film Strip, Passport & more"],
    ["Custom accents", "Pick your festival color"],
  ];

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ filter: "blur(3px)", pointerEvents: "none", opacity: 0.35 }}>{children}</div>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 0,
        background: "linear-gradient(180deg, rgba(26,18,13,0.85) 0%, rgba(109,40,217,0.55) 100%)",
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", marginBottom: 10,
          background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 24px rgba(109,40,217,0.5)",
        }}>
          <span style={{ fontSize: 18 }}>+</span>
        </div>
        <div className="serif" style={{ fontSize: 24, color: "#fff", letterSpacing: -0.5 }}>Plursky+</div>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.4, color: "rgba(255,255,255,0.5)",
          marginTop: 4, marginBottom: 14,
        }}>
          UNLOCK {(feature || "THIS FEATURE").toUpperCase()}
        </div>

        <div style={{
          display: "flex", flexDirection: "column", gap: 7, width: "80%", maxWidth: 240,
          marginBottom: 16,
        }}>
          {_PLUS_PERKS.map(([title, sub], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: "#fff", fontWeight: 700,
              }}>&#10003;</div>
              <div>
                <div style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => handlePurchase(RC_PRODUCT_IDS.annual)} disabled={busy} className="mono" style={{
          padding: "11px 28px", borderRadius: 12, border: "none",
          background: busy ? "rgba(109,40,217,0.5)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
          color: "#fff", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
          boxShadow: "0 4px 20px rgba(109,40,217,0.45), 0 0 40px rgba(232,93,46,0.2)",
        }}>
          {busy ? "PROCESSING…" : "$7.99 / YEAR"}
        </button>
        {/* Auto-renewable subscription disclosure — required for App Store
            review (Guideline 3.1.2): name, price, term, auto-renew + T&Cs. */}
        <div className="mono" style={{
          fontSize: 8, letterSpacing: 0.5, color: "rgba(255,255,255,0.4)",
          marginTop: 8, lineHeight: 1.5, maxWidth: 264, textAlign: "center",
        }}>
          Plursky+ · $7.99/year, auto-renews until cancelled. Payment is charged to
          your Apple ID; manage or cancel anytime in Settings.
          <div style={{ marginTop: 4 }}>
            <a href="./terms.html" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.6)" }}>Terms</a>
            {"   ·   "}
            <a href="./privacy.html" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.6)" }}>Privacy</a>
          </div>
        </div>
        <button onClick={handleRestore} disabled={busy} className="mono" style={{
          marginTop: 10, padding: "4px 12px", borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
          color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 1,
          cursor: "pointer",
        }}>
          RESTORE PURCHASE
        </button>
      </div>
    </div>
  );
}
// P1: Export rate limiter — 5/day free, unlimited Plus
const DAILY_SHARE_LIMIT = 5;
function _getShareCount() {
  try {
    const raw = JSON.parse(localStorage.getItem("plursky_share_count") || "{}");
    const today = new Date().toISOString().slice(0, 10);
    return raw.date === today ? (raw.count || 0) : 0;
  } catch { return 0; }
}
function _incShareCount() {
  const today = new Date().toISOString().slice(0, 10);
  const count = _getShareCount() + 1;
  try { localStorage.setItem("plursky_share_count", JSON.stringify({ date: today, count })); } catch {}
  return count;
}
function _canShare() {
  if (_isPlusSub()) return { allowed: true, remaining: Infinity };
  const used = _getShareCount();
  return { allowed: used < DAILY_SHARE_LIMIT, remaining: DAILY_SHARE_LIMIT - used };
}
function _showShareLimitToast() {
  let el = document.getElementById("plursky-share-limit");
  if (el) return;
  el = document.createElement("div");
  el.id = "plursky-share-limit";
  el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:14px 20px;text-align:center;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:1.2px;font-weight:700;color:#fff;background:#e85d2e;";
  el.textContent = "📸 DAILY SHARE LIMIT REACHED · UPGRADE TO PLURSKY+ FOR UNLIMITED";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// P2: Resolution gate — free=540, Plus=1080
function _exportScale() { return _isPlusSub() ? 1 : 0.5; }
function _exportW() { return Math.round(1080 * _exportScale()); }
function _exportH(baseH) { return Math.round((baseH || 1350) * _exportScale()); }

// P3: Festival archive — snapshot recaps per festival
function _archiveRecap(festivalId, recap) {
  try {
    const key = "plursky_recap_archive";
    const archive = JSON.parse(localStorage.getItem(key) || "{}");
    archive[festivalId] = { ...recap, archivedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(archive));
  } catch {}
}
function _getRecapArchive() {
  try { return JSON.parse(localStorage.getItem("plursky_recap_archive") || "{}"); } catch { return {}; }
}

// P4: Priority preview gate
function _canAccessFestival(festivalEntry) {
  if (festivalEntry.available) return true;
  if (festivalEntry.previewOnly && _isPlusSub()) return true;
  return false;
}

// P5: Custom accent color — Plus-only
function _getCustomAccent() {
  if (!_isPlusSub()) return null;
  try { return localStorage.getItem("plursky_custom_accent") || null; } catch { return null; }
}
function _setCustomAccent(hex) {
  try { localStorage.setItem("plursky_custom_accent", hex); } catch {}
}

function _appStoreUrl() {
  if (APP_STORE_ID) return `https://apps.apple.com/app/plursky-live/id${APP_STORE_ID}`;
  return "https://apps.apple.com/search?term=plursky%20live";
}
async function requestRating() {
  try {
    const native = window.Capacitor?.Plugins?.InAppReview;
    if (native?.requestReview && window.Capacitor?.isNativePlatform?.()) {
      await native.requestReview();
      return { ok: true, source: "native" };
    }
  } catch (e) { /* fall through to web */ }
  try { window.open(_appStoreUrl(), "_blank", "noopener"); return { ok: true, source: "web" }; }
  catch { return { ok: false }; }
}
function _maybeAutoRatingPromptOnRecap() {
  try {
    const key = "plursky_recap_visits_v1";
    const visits = parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, String(visits));
    const lastPromptedAt = parseInt(localStorage.getItem("plursky_rating_prompted_at") || "0", 10);
    const oneYearMs = 365 * 24 * 3600 * 1000;
    if (visits < 2) return;                                            // wait for 2nd visit
    if (lastPromptedAt && Date.now() - lastPromptedAt < oneYearMs) return; // iOS will silently no-op anyway
    if (!window.Capacitor?.isNativePlatform?.()) return;               // only auto-prompt on native — web spam is bad
    localStorage.setItem("plursky_rating_prompted_at", String(Date.now()));
    // Small delay so the user is past the hero card animation before iOS pops
    setTimeout(() => { requestRating().catch(() => {}); }, 1500);
  } catch {}
}


// ── Festival Archive list — shown when user has past festival snapshots
function FestivalArchiveList({ archive }) {
  if (!archive?.length) return null;
  const sorted = [...archive].sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));
  return (
    <div style={{ marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 700, marginBottom: 10 }}>
        FESTIVAL ARCHIVE · {archive.length} {archive.length === 1 ? "PAST FESTIVAL" : "PAST FESTIVALS"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(f => (
          <div key={f.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 14,
            background: "var(--paper-2)", border: "1px solid var(--line)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "linear-gradient(135deg, var(--ember), var(--horizon))",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>
              {(f.brand || f.name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="serif" style={{ fontSize: 17, lineHeight: 1.1, color: "var(--ink)" }}>
                {f.name || f.id}
              </div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 3 }}>
                {f.dates ? `${f.dates.toUpperCase()} · ` : ""}{f.totalAttended} CAUGHT · {f.totalMoments} MEMORIES
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
        TAP TO VIEW · COMING SOON
      </div>
    </div>
  );
}

function RecapScreen({ state, setState }) {
  const recap = React.useMemo(() => _computeRecap(state), [state]);
  const CFG   = window.FESTIVAL_CONFIG || {};
  const fmt12 = window.fmt12 || ((t) => t);
  const [wrappedOpen, setWrappedOpen] = React.useState(false);

  const back = () => window._popNav ? window._popNav() : setState(s => ({ ...s, tab: "me" }));

  // v151: ask for an iOS rating on 2nd+ Recap visit. iOS handles cool-off
  // (3 prompts / year) so we don't need to be cute about it.
  React.useEffect(() => {
    if (recap.setsCount > 0 || recap.momentsCount > 0) {
      _maybeAutoRatingPromptOnRecap();
      _archiveRecap(CFG.id, recap);
    }
  }, []);

  // v148: async-load the hero photo blob from IndexedDB so we can paint it
  // as the hero card background. Falls back to the gradient when no photo.
  const heroPhotoUrl = useMomentPhoto(recap.heroPhotoMoment?.photoId);

  // v148: crew highlights — pull last 100 crew_messages for the user's
  // current crew code (if any) and derive simple stats. One round-trip,
  // results cached in component state.
  const [crewStats, setCrewStats] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    try {
      const code = localStorage.getItem("plursky_group_code");
      if (!code || typeof window.sbCrewFetchMessages !== "function") return;
      window.sbCrewFetchMessages(code, 100).then(rows => {
        if (cancelled) return;
        if (!rows?.length) { setCrewStats({ total: 0, code }); return; }
        const counts = {};
        rows.forEach(r => {
          const name = r.sender_name || "Friend";
          counts[name] = (counts[name] || 0) + 1;
        });
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setCrewStats({
          total: rows.length,
          uniqueSenders: Object.keys(counts).length,
          topSender: top ? { name: top[0], count: top[1] } : null,
          code,
        });
      }).catch(() => {});
    } catch {}
    return () => { cancelled = true; };
  }, []);

  // v147: build a Spotify playlist of what the user actually CAUGHT (attended)
  // — separate from the existing build-playlist flow which uses saved sets.
  const [playlistState, setPlaylistState] = React.useState({ status: "idle" });
  const buildAttendedPlaylist = async () => {
    setPlaylistState({ status: "building" });
    try {
      const result = await createEdcPlaylist(state, { source: "attended" });
      if (result.ok) {
        setPlaylistState({ status: "done", url: result.url, added: result.added });
      } else {
        const reason = result.reason || "fail";
        const msg = {
          not_connected:     "Connect Spotify on the Me tab first.",
          empty:             "Mark sets you caught in Memories first.",
          reconnect:         "Reconnect Spotify (needs playlist permission).",
          no_target_playlist: "Create an empty Spotify playlist named 'Plursky' first.",
          rate_limited:      "Spotify is throttling — wait 30s and retry.",
        }[reason] || (result.message || "Couldn't build playlist.");
        setPlaylistState({ status: "error", msg });
      }
    } catch (e) {
      setPlaylistState({ status: "error", msg: e?.message || "Couldn't build playlist." });
    }
  };

  // Empty-state guard — nothing to recap (for the current festival).
  // Still show past festival archives if any exist.
  if (recap.setsCount === 0 && recap.momentsCount === 0) {
    const archive = (typeof _readArchive === "function") ? _readArchive() : {};
    const archived = Object.values(archive).filter(f => f.id !== CFG.id);
    return (
      <Screen bg="var(--paper)">
        <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={back} aria-label="Back" style={{
            background: "transparent", border: "none", padding: 0, cursor: "pointer",
            fontSize: 22, color: "var(--ink)", lineHeight: 1, width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>←</button>
          <TopBar title={<span>Recap</span>} sub={CFG.shortName?.toUpperCase()} tight />
        </div>
        <ScrollBody style={{ padding: "10px 20px 94px" }}>
          <div style={{ padding: "40px 0 24px", textAlign: "center" }}>
            <div className="serif" style={{ fontSize: 24, color: "var(--muted)", fontStyle: "italic", marginBottom: 8 }}>
              Nothing to recap yet
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)" }}>
              MARK SETS YOU CAUGHT IN MEMORIES — TODAY'S WEEKEND RECAP WILL FILL IN
            </div>
          </div>
          {archived.length > 0 && <FestivalArchiveList archive={archived} />}
        </ScrollBody>
      </Screen>
    );
  }

  return (
    <Screen bg="var(--paper-2)">
      <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
        <button onClick={back} aria-label="Back" style={{
          background: "transparent", border: "none", padding: 0, cursor: "pointer",
          fontSize: 22, color: "var(--ink)", lineHeight: 1, width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>←</button>
        <TopBar title={<span>Recap</span>} sub={(CFG.shortName || "Festival").toUpperCase() + " · YOUR WEEKEND"} tight />
      </div>
      <ScrollBody style={{ padding: "14px 16px 94px" }}>
        {/* HERO ─ totals · share button bottom-right */}
        <div style={{
          borderRadius: 22, padding: "26px 22px", marginBottom: 14,
          background: heroPhotoUrl
            ? `linear-gradient(155deg, rgba(26,18,13,0.85) 0%, rgba(123,61,154,0.72) 60%, rgba(232,93,46,0.65) 130%), url(${heroPhotoUrl}) center/cover`
            : "linear-gradient(155deg, var(--ink) 0%, var(--horizon) 60%, var(--ember) 130%)",
          color: "var(--paper)",
          boxShadow: "0 10px 30px rgba(26,18,13,0.18)",
          position: "relative",
          overflow: "hidden",
        }}>
          <button
            onClick={async () => { await _shareRecapCard(recap); }}
            aria-label="Share recap"
            style={{
              position: "absolute", top: 16, right: 16,
              padding: "7px 12px", borderRadius: 999,
              background: "rgba(247,237,224,0.18)", color: "#f7ede0",
              border: "1px solid rgba(247,237,224,0.35)", cursor: "pointer",
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              backdropFilter: "blur(8px)",
            }}>↗ SHARE</button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.6, color: "rgba(247,237,224,0.75)", fontWeight: 700, marginBottom: 10 }}>
              YOUR {(CFG.shortName || "FESTIVAL").toUpperCase()} · {CFG.year || ""}
            </div>
          </div>
          <div className="serif" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: -0.5, marginBottom: 18 }}>
            That was <span style={{ fontStyle: "italic", color: "var(--flare)" }}>your</span> weekend.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{recap.setsCount}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>SETS CAUGHT</div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{_fmtHrsMin(recap.totalMin)}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>ON DANCEFLOORS</div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{recap.nights}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>NIGHTS</div>
            </div>
            <div>
              <div className="serif" style={{ fontSize: 36, lineHeight: 1 }}>{recap.headlinersCaught}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.3, fontWeight: 700, color: "rgba(247,237,224,0.7)", marginTop: 3 }}>HEADLINERS</div>
            </div>
          </div>
        </div>

        {/* WRAPPED CTA */}
        {recap.setsCount > 0 && (
          <button onClick={() => setWrappedOpen(true)} style={{
            width: "100%", padding: "16px 20px", marginBottom: 14,
            borderRadius: 16, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(109,40,217,0.35)",
          }}>
            <div style={{ textAlign: "left" }}>
              <div className="serif" style={{ fontSize: 20, lineHeight: 1.1 }}>
                Your <em>Wrapped</em>
              </div>
              <div className="mono" style={{ fontSize: 8, letterSpacing: 1.4, color: "rgba(255,255,255,0.6)", marginTop: 3, fontWeight: 700 }}>
                SWIPE THROUGH YOUR FESTIVAL STORY
              </div>
            </div>
            <span style={{ fontSize: 22 }}>→</span>
          </button>
        )}

        {/* YOUR SOUNDTRACK */}
        {(() => {
          const soundtrack = _aggregateSoundtrack(_readMoments());
          if (!soundtrack.length) return null;
          return (
            <RecapCard kicker="YOUR SOUNDTRACK" paper="#1DB95418" mono="#1DB954">
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: -0.4, marginBottom: 10 }}>
                <span style={{ color: "#1DB954" }}>{soundtrack.length}</span> songs were playing when you took photos
              </div>
              <div style={{ marginTop: 8 }}>
                {soundtrack.slice(0, 5).map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 0",
                    borderBottom: i < Math.min(soundtrack.length, 5) - 1 ? "1px solid var(--line)" : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {i + 1}. {s.song}
                      </div>
                      <div className="mono" style={{ fontSize: 8, color: "var(--muted)", letterSpacing: 0.8, marginTop: 1 }}>
                        {[...s.artists].join(", ")}
                      </div>
                    </div>
                    <div className="mono" style={{
                      fontSize: 8, letterSpacing: 0.8, color: "#1DB954", fontWeight: 700, flexShrink: 0, marginLeft: 8,
                    }}>
                      {s.count} {s.count === 1 ? "PHOTO" : "PHOTOS"}
                    </div>
                  </div>
                ))}
              </div>
              {soundtrack.length > 0 && (
                <button onClick={() => {
                  const q = soundtrack.slice(0, 10).map(s => s.song).join(" ");
                  window.open(`https://open.spotify.com/search/${encodeURIComponent(q)}`, "_blank");
                }} style={{
                  marginTop: 12, width: "100%", padding: "10px 16px",
                  borderRadius: 20, border: "none", cursor: "pointer",
                  background: "#1DB954", color: "#fff", fontWeight: 700,
                  fontSize: 10, letterSpacing: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 14 }}>♫</span> FIND ON SPOTIFY
                </button>
              )}
            </RecapCard>
          );
        })()}

        {/* TOP STAGE */}
        {recap.topStage && (
          <RecapCard
            kicker="YOUR HEADQUARTERS"
            paper={`${recap.topStage.color}18`}
            mono={recap.topStage.color}
          >
            <div className="serif" style={{ fontSize: 32, lineHeight: 1, letterSpacing: -0.4, marginBottom: 8 }}>
              You lived at <span style={{ fontStyle: "italic", color: recap.topStage.color }}>{recap.topStage.name}</span>
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 6, fontWeight: 600 }}>
              {_fmtHrsMin(recap.topStageMin)} of your weekend was right here
            </div>
          </RecapCard>
        )}

        {/* BUSIEST NIGHT */}
        {recap.busiestNightCount > 0 && (
          <RecapCard kicker="BUSIEST NIGHT">
            <div className="serif" style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: -0.4 }}>
              <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{recap.busiestNightLabel}</span> was your peak —
              {" "}{recap.busiestNightCount} sets in one night.
            </div>
          </RecapCard>
        )}

        {/* TOP GENRE */}
        {recap.topGenre && (
          <RecapCard kicker="THE SOUND OF YOUR WEEKEND" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.0, letterSpacing: -0.4 }}>
              You went deep on{" "}
              <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>{recap.topGenre}</span>.
            </div>
          </RecapCard>
        )}

        {/* FIRST + LAST */}
        {recap.firstSet && recap.lastSet && (
          <RecapCard kicker="BOOKENDS">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 14 }}>
              You opened with <span style={{ color: "var(--ember)" }}>{recap.firstSet.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 16 }}> · {fmt12(recap.firstSet.start)}</span>
            </div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>
              and closed with <span style={{ color: "var(--ember)" }}>{recap.lastSet.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 16 }}> · {fmt12(recap.lastSet.start)}</span>
            </div>
          </RecapCard>
        )}

        {/* SUNRISE */}
        {recap.sunriseSetsCount > 0 && (
          <RecapCard kicker="STAYED UP">
            <div className="serif" style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: -0.4 }}>
              {recap.sunriseSetsCount === 1 ? "One sunrise set" : `${recap.sunriseSetsCount} sunrise sets`}.{" "}
              <span style={{ color: "var(--flare)", fontStyle: "italic" }}>Respect.</span>
            </div>
          </RecapCard>
        )}

        {/* HIDDEN GEM */}
        {recap.hiddenGem && (
          <RecapCard kicker="HIDDEN GEM" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3 }}>
              Most under-the-radar artist you saw:{" "}
              <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>{recap.hiddenGem.name}</span>.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              SPOTIFY POPULARITY {recap.hiddenGem._pop} / 100 · TASTE 🤌
            </div>
          </RecapCard>
        )}

        {/* STAGES VISITED */}
        {recap.stagesVisitedCount > 0 && (
          <RecapCard kicker={`STAGES VISITED · ${recap.stagesVisitedCount} OF ${(window.STAGES || []).length}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10 }}>
              {recap.stagesVisitedCount === (window.STAGES || []).length
                ? <>Every <span style={{ fontStyle: "italic", color: "var(--ember)" }}>stage</span>. Completionist.</>
                : <>You set foot at <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{recap.stagesVisitedCount}</span> of {(window.STAGES || []).length} stages.</>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {recap.stagesVisitedNames.map(name => (
                <span key={name} className="mono" style={{
                  padding: "4px 9px", borderRadius: 999,
                  background: "var(--paper)", border: "1px solid var(--line-2)",
                  color: "var(--ink)", fontSize: 9, letterSpacing: 1.1, fontWeight: 700,
                }}>{name.toUpperCase()}</span>
              ))}
            </div>
          </RecapCard>
        )}

        {/* WALKING DISTANCE */}
        {recap.walkingMinutesHi > 0 && (
          <RecapCard kicker="DISTANCE COVERED">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3 }}>
              You walked roughly{" "}
              <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>
                {recap.walkingMetersHi >= 1000
                  ? `${(recap.walkingMetersLo / 1000).toFixed(1)}–${(recap.walkingMetersHi / 1000).toFixed(1)} km`
                  : `${recap.walkingMetersLo}–${recap.walkingMetersHi} m`}
              </span>{" "}
              between stages.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              ~{recap.walkingMinutesLo}–{recap.walkingMinutesHi} MIN WALKING TOTAL
            </div>
          </RecapCard>
        )}

        {/* B2B SETS */}
        {recap.b2bCount > 0 && (
          <RecapCard kicker={`B2B SETS · ${recap.b2bCount}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 8 }}>
              You caught {recap.b2bCount === 1 ? "a" : recap.b2bCount} <span style={{ fontStyle: "italic", color: "var(--ember)" }}>back-to-back</span> collab{recap.b2bCount === 1 ? "" : "s"}.
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
              {recap.b2bNames.join(" · ")}
            </div>
          </RecapCard>
        )}

        {/* HEADLINERS */}
        {recap.headlinersCaught > 0 && (
          <RecapCard kicker={`HEADLINERS CAUGHT · ${recap.headlinersCaught}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {recap.headlinerNames.map(n => (
                <span key={n} className="mono" style={{
                  padding: "6px 11px", borderRadius: 999,
                  background: "var(--ink)", color: "var(--paper)",
                  fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                }}>★ {n.toUpperCase()}</span>
              ))}
            </div>
          </RecapCard>
        )}

        {/* MEMORIES */}
        {recap.momentsCount > 0 && (
          <RecapCard kicker="MEMORIES" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 32, lineHeight: 1.0, letterSpacing: -0.4 }}>
              <span style={{ color: "var(--ember)" }}>{recap.momentsCount}</span>{" "}
              {recap.momentsCount === 1 ? "moment" : "moments"} captured.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
              {recap.photosCount} PHOTO{recap.photosCount === 1 ? "" : "S"}
              {recap.videosCount > 0 ? ` · ${recap.videosCount} VIDEO${recap.videosCount === 1 ? "" : "S"}` : ""}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => setState(s => ({ ...s, tab: "memories" }))} style={{
                padding: "8px 14px", borderRadius: 999,
                background: "var(--ink)", color: "var(--paper)", border: "none",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                cursor: "pointer",
              }}>OPEN MEMORIES →</button>
              <button
                onClick={async () => {
                  // Grab every moment from localStorage, hand to the weekend
                  // collage builder which picks 6 best across nights.
                  const all = [];
                  try {
                    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
                    for (const n of Object.keys(raw)) {
                      for (const m of (raw[n] || [])) all.push(m);
                    }
                  } catch {}
                  await window._shareWeekendCollage?.(all);
                }}
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  background: "var(--ember)", color: "#fff", border: "none",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                  cursor: "pointer",
                }}>📸 SHARE WEEKEND</button>
              <button
                onClick={async () => {
                  const all = [];
                  try {
                    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
                    for (const n of Object.keys(raw)) {
                      for (const m of (raw[n] || [])) all.push(m);
                    }
                  } catch {}
                  await window._shareWeekendCollage?.(all, "gif");
                }}
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  background: "#6D28D9", color: "#fff", border: "none",
                  fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                  cursor: "pointer",
                }}>🎬 GIF</button>
            </div>
          </RecapCard>
        )}

        {/* RECAP VIDEO */}
        {recap.momentsCount >= 3 && (() => {
          const [vidTemplate, setVidTemplate] = React.useState("highlight");
          const [vidState, setVidState] = React.useState("idle");
          const [trackQuery, setTrackQuery] = React.useState("");
          const [trackResults, setTrackResults] = React.useState([]);
          const [selectedTrack, setSelectedTrack] = React.useState(null);
          const [previewAudio, setPreviewAudio] = React.useState(null);
          const [searching, setSearching] = React.useState(false);

          const searchTracks = async (q) => {
            if (!q || q.length < 2) { setTrackResults([]); return; }
            setSearching(true);
            try {
              const token = localStorage.getItem("spotify_token");
              if (token) {
                const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=6`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                  const d = await res.json();
                  setTrackResults((d.tracks?.items || []).filter(t => t.preview_url).slice(0, 5));
                }
              } else {
                const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`);
                if (res.ok) {
                  const d = await res.json();
                  setTrackResults((d.results || []).filter(t => t.previewUrl).slice(0, 5).map(t => ({ name: t.trackName, artists: [{ name: t.artistName }], preview_url: t.previewUrl, album: { images: [{ url: t.artworkUrl60 }] } })));
                }
              }
            } catch {}
            setSearching(false);
          };

          const togglePreview = (url) => {
            if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); }
            if (previewAudio?.src === url) return;
            const a = new Audio(url);
            a.play().catch(() => {});
            setPreviewAudio(a);
          };

          return (
            <RecapCard kicker="RECAP VIDEO" paper="#1a120d" accent="#fff">
              <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, color: "#f7ede0", letterSpacing: -0.3 }}>
                Turn your memories into a{" "}
                <span style={{ fontStyle: "italic", color: "#a78bfa" }}>video</span>.
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {["highlight", "diary", "ditl"].map(t => {
                  const locked = t !== "highlight" && !_isPlusSub();
                  return (
                    <button key={t} onClick={() => locked ? null : setVidTemplate(t)} className="mono" style={{
                      padding: "5px 10px", borderRadius: 999, cursor: locked ? "default" : "pointer", border: "none",
                      background: vidTemplate === t ? "#6D28D9" : "rgba(247,237,224,0.1)",
                      color: vidTemplate === t ? "#fff" : locked ? "rgba(247,237,224,0.25)" : "rgba(247,237,224,0.5)",
                      fontSize: 9, letterSpacing: 1.2, fontWeight: 700,
                      opacity: locked ? 0.6 : 1,
                    }}>{t === "highlight" ? "HIGHLIGHT REEL" : t === "diary" ? "🔒 FESTIVAL DIARY" : "🔒 DAY IN THE LIFE"}{locked ? "" : ""}</button>
                  );
                })}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.35)", marginTop: 8, letterSpacing: 1 }}>
                {vidTemplate === "highlight" ? "Fast cuts synced to the beat — your best moments, drop by drop." : vidTemplate === "diary" ? "Slow, cinematic. Your weekend told as a story." : "Morning to sunrise — one continuous timeline."}
              </div>

              {/* Track picker — Plus-only custom music */}
              <div style={{ marginTop: 14 }}>
                <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "rgba(247,237,224,0.4)", marginBottom: 6 }}>
                  🎵 {selectedTrack ? "SOUNDTRACK" : _isPlusSub() ? "PICK A SONG (OPTIONAL)" : "🔒 CUSTOM SOUNDTRACK · PLURSKY+"}
                </div>
                {!_isPlusSub() && !selectedTrack ? (
                  <div className="mono" style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(247,237,224,0.04)", border: "1px solid rgba(247,237,224,0.08)", color: "rgba(247,237,224,0.2)", fontSize: 10, textAlign: "center" }}>
                    Upgrade to Plursky+ to pick your own soundtrack
                  </div>
                ) : selectedTrack ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(109,40,217,0.2)" }}>
                    {selectedTrack.album?.images?.[0]?.url && (
                      <img src={selectedTrack.album.images[0].url} alt="" style={{ width: 32, height: 32, borderRadius: 6 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#f7ede0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedTrack.name}</div>
                      <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.5)" }}>{selectedTrack.artists?.[0]?.name}</div>
                    </div>
                    <button onClick={() => { setSelectedTrack(null); if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); } }} aria-label="Remove song" className="mono" style={{
                      background: "none", border: "none", color: "rgba(247,237,224,0.4)", cursor: "pointer", fontSize: 14, padding: "4px",
                    }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text" value={trackQuery}
                      onChange={e => { setTrackQuery(e.target.value); searchTracks(e.target.value); }}
                      placeholder="Search for a song…"
                      style={{
                        width: "100%", padding: "8px 12px", borderRadius: 10,
                        background: "rgba(247,237,224,0.08)", border: "1px solid rgba(247,237,224,0.1)",
                        color: "#f7ede0", fontFamily: "Geist Mono, monospace", fontSize: 10,
                        outline: "none",
                      }}
                    />
                    {trackResults.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {trackResults.map((tr, i) => (
                          <button key={i} onClick={() => { setSelectedTrack(tr); setTrackResults([]); setTrackQuery(""); togglePreview(tr.preview_url); }} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8,
                            background: "rgba(247,237,224,0.05)", border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                          }}>
                            {tr.album?.images?.[0]?.url && <img src={tr.album.images[0].url} alt="" style={{ width: 28, height: 28, borderRadius: 4 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: "#f7ede0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr.name}</div>
                              <div className="mono" style={{ fontSize: 8, color: "rgba(247,237,224,0.4)" }}>{tr.artists?.[0]?.name}</div>
                            </div>
                            <div className="mono" style={{ fontSize: 8, color: "#a78bfa" }}>▶</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searching && <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.3)", marginTop: 4 }}>Searching…</div>}
                  </>
                )}
              </div>

              <button
                disabled={vidState === "rendering"}
                onClick={async () => {
                  if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); }
                  setVidState("rendering");
                  const all = [];
                  try {
                    const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
                    for (const n of Object.keys(raw)) for (const m of (raw[n] || [])) all.push(m);
                  } catch {}
                  let audioUrl = selectedTrack?.preview_url || null;
                  // #8: prefer a song you ACTUALLY heard (Shazam-confirmed in
                  // your moments) as the recap soundtrack — your real festival
                  // audio over a generic top track.
                  if (!audioUrl) {
                    try {
                      const mine = (window._collectMomentSongs?.() || [])[0];
                      if (mine) { const r = await fetchPreviewUrl(`${mine.artist} ${mine.title}`.trim()); audioUrl = r?.url; }
                    } catch {}
                  }
                  if (!audioUrl && recap.topByPop?.name) {
                    try { const r = await fetchPreviewUrl(recap.topByPop.name); audioUrl = r?.url; } catch {}
                  }
                  await window._shareRecapVideo?.({
                    moments: all, audioUrl, template: vidTemplate, recap,
                    title: "My Weekend",
                    subtitle: `${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`,
                    accent: "#6D28D9",
                  });
                  setVidState("idle");
                }}
                className="mono"
                style={{
                  width: "100%", marginTop: 14, padding: "13px",
                  background: vidState === "rendering" ? "rgba(109,40,217,0.4)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
                  color: "#fff", border: "none", borderRadius: 12, cursor: vidState === "rendering" ? "wait" : "pointer",
                  fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
                }}>{vidState === "rendering" ? "⏳ RENDERING…" : "🎬 CREATE RECAP VIDEO"}</button>
            </RecapCard>
          );
        })()}

        {/* S2: GENRE BREAKDOWN */}
        {recap.genreBreakdown?.length > 0 && (
          <RecapCard kicker="YOUR GENRE MIX" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 12 }}>
              Your festival was <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{recap.genreBreakdown[0]?.genre || "eclectic"}</span>.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recap.genreBreakdown.map(({ genre, count }, i) => {
                const maxCount = recap.genreBreakdown[0]?.count || 1;
                return (
                  <div key={genre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", width: 120, textAlign: "right", flexShrink: 0, fontWeight: 600 }}>
                      {genre.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, height: 18, borderRadius: 9, background: "var(--paper-2)", overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.max(8, Math.round(count / maxCount * 100))}%`, height: "100%",
                        borderRadius: 9, background: i === 0 ? "var(--ember)" : i === 1 ? "#6D28D9" : "var(--line-2)",
                        transition: "width .3s",
                      }} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink)", width: 20, textAlign: "right" }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </RecapCard>
        )}

        {/* S4: FESTIVAL VIBE SCORE */}
        {recap.vibeScore != null && (
          <RecapCard kicker="FESTIVAL VIBE" paper="var(--paper)">
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--line)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={recap.vibeScore >= 70 ? "#e85d2e" : recap.vibeScore >= 40 ? "#6D28D9" : "#2d7a55"} strokeWidth="6"
                    strokeDasharray={`${recap.vibeScore * 2.136} 213.6`} strokeLinecap="round"
                    transform="rotate(-90 40 40)" />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{recap.vibeScore}</span>
                </div>
              </div>
              <div>
                <div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
                  {recap.vibeScore >= 80 ? "Peak energy." : recap.vibeScore >= 60 ? "High octane." : recap.vibeScore >= 40 ? "Balanced vibe." : "Laid back."}
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>
                  {recap.vibeScore >= 70 ? "YOU CHASED THE DROPS ALL WEEKEND" : recap.vibeScore >= 40 ? "MIX OF ENERGY + CHILL" : "YOU FOUND THE QUIET CORNERS"}
                </div>
              </div>
            </div>
          </RecapCard>
        )}

        {/* AI SET RECOMMENDER — HIDDEN GEMS */}
        {(() => {
          let discoveries = [];
          try {
            const raw = localStorage.getItem("spotify_matched_v1");
            const spotifyArtists = JSON.parse(localStorage.getItem("spotify_top_artists_v1") || "null");
            const matched = raw ? JSON.parse(raw) : [];
            if (spotifyArtists?.length) discoveries = getDiscoveries(spotifyArtists, matched, state.saved, 5);
          } catch {}
          if (!discoveries.length) return null;
          const freeLimit = 2;
          const showAll = _isPlusSub();
          const visible = showAll ? discoveries : discoveries.slice(0, freeLimit);
          return (
            <RecapCard kicker="HIDDEN GEMS — AI PICKS FOR YOU" paper="var(--night)" accent="#fff">
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, color: "#f7ede0", marginBottom: 12 }}>
                Artists you'd <em style={{ color: "#a78bfa" }}>love</em>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visible.map((a, i) => {
                  const stage = STAGES.find(s => s.id === a.stage);
                  const isSaved = (state.saved || []).includes(a.id);
                  return (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                        background: stage?.color || "#6D28D9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, color: "#fff", fontWeight: 700,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#f7ede0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                        <div className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                          {a._reason || (stage?.name || "")} · {FESTIVAL_CONFIG.dayDates?.[a.day]?.short || ""} {window.fmt12?.(a.start) || a.start}
                        </div>
                      </div>
                      <button onClick={() => {
                        if (isSaved) return;
                        setState(s => ({ ...s, saved: [...new Set([...s.saved, a.id])] }));
                        try { window.plurskyHaptic?.("LIGHT"); } catch {}
                      }} className="mono" style={{
                        padding: "5px 10px", borderRadius: 999, flexShrink: 0,
                        background: isSaved ? "rgba(45,122,85,0.3)" : "rgba(167,139,250,0.2)",
                        border: isSaved ? "1px solid rgba(45,122,85,0.5)" : "1px solid rgba(167,139,250,0.4)",
                        color: isSaved ? "#2d7a55" : "#a78bfa",
                        fontSize: 8, letterSpacing: 1.2, fontWeight: 700, cursor: "pointer",
                      }}>{isSaved ? "✓ SAVED" : "+ SAVE"}</button>
                    </div>
                  );
                })}
                {!showAll && discoveries.length > freeLimit && (
                  <PlusGate feature="all hidden gems">
                    <div style={{ padding: 20, textAlign: "center" }}>
                      <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1.2 }}>
                        +{discoveries.length - freeLimit} MORE PICKS WAITING
                      </div>
                    </div>
                  </PlusGate>
                )}
              </div>
            </RecapCard>
          );
        })()}

        {/* CREW COMPATIBILITY */}
        {crewStats?.total > 0 && (
          <RecapCard kicker="CREW COMPATIBILITY" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 12 }}>
              Your crew <em style={{ color: "var(--ember)" }}>vibe check</em>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              {crewStats.total} messages sent in crew chat{crewStats.topChatter ? ` · ${crewStats.topChatter[0]} was the most active` : ""}.
            </div>
            {/* The "Crew Showdown" export needs a SECOND person to compare
                against (myName, myState, otherName, otherArtistIds), which only
                exists in the crew screen. _shareCrewComparison is correctly
                wired there (supabase.jsx); a one-arg call from here threw on
                myState.saved and silently did nothing, so the button is gone. */}
          </RecapCard>
        )}

        {/* TRADING CARDS — collectible per-artist cards */}
        {recap.setsCount > 0 && (
          <RecapCard kicker="FESTIVAL TRADING CARDS" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 6 }}>
              Collect your <em style={{ color: "var(--horizon)" }}>set cards</em>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
              {recap.setsCount} cards earned — one for every set you caught. Export as shareable collectibles.
            </div>
            <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10, padding: "2px 0" }}>
              {(() => {
                const attended = window.getAllAttended?.() || {};
                const artists = Object.values(attended).flat().map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).slice(0, 6);
                return artists.map((a, i) => {
                  const stage = STAGES.find(s => s.id === a.stage);
                  return (
                    <div key={a.id} style={{
                      width: 90, height: 130, flexShrink: 0, borderRadius: 10,
                      background: `linear-gradient(155deg, ${stage?.color || "#6D28D9"}22 0%, ${stage?.color || "#6D28D9"}44 100%)`,
                      border: `1.5px solid ${stage?.color || "#6D28D9"}55`,
                      padding: "10px 8px", display: "flex", flexDirection: "column",
                      justifyContent: "space-between",
                    }}>
                      <div className="mono" style={{ fontSize: 8, letterSpacing: 1.2, color: stage?.color || "var(--muted)", fontWeight: 700 }}>
                        {stage?.short || ""}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, color: "var(--ink)" }}>
                          {a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name}
                        </div>
                        <div className="mono" style={{ fontSize: 8, color: "var(--muted)", marginTop: 3, letterSpacing: 0.8 }}>
                          {FESTIVAL_CONFIG.dayDates?.[a.day]?.short || ""} · {window.fmt12?.(a.start) || a.start}
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 8, letterSpacing: 1, color: stage?.color, fontWeight: 700, textAlign: "right" }}>
                        #{String(i + 1).padStart(3, "0")}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <PlusGate feature="trading cards export">
              <button onClick={async () => {
                try { await window._shareFestivalPassport?.(state); } catch {}
              }} className="mono" style={{
                width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "var(--ink)", color: "var(--paper)",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>EXPORT FULL COLLECTION</button>
            </PlusGate>
          </RecapCard>
        )}

        {/* SETLIST MEMORIES */}
        {recap.momentsCount > 0 && recap.setsCount > 0 && (
          <RecapCard kicker="SETLIST MEMORIES" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 6 }}>
              What was <em style={{ color: "var(--ember)" }}>playing</em>?
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              Your photos are matched to the actual setlist — showing which song was playing when you took each shot. Open any moment in Memories to see the track.
            </div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--success)", fontWeight: 700, marginTop: 10 }}>
              ✓ LIVE · POWERED BY SETLIST.FM
            </div>
          </RecapCard>
        )}

        {/* PLURSKY+ WOW FEATURES */}
        {recap.momentsCount > 0 && (
          <RecapCard kicker="PLURSKY+ EXCLUSIVES" paper="#1a120d" accent="#fff">
            <div className="serif" style={{ fontSize: 24, lineHeight: 1.1, color: "#f7ede0", letterSpacing: -0.3 }}>
              Your weekend, <span style={{ fontStyle: "italic", color: "#a78bfa" }}>elevated</span>.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <button onClick={async () => {
                const all = []; try { const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"); for (const n of Object.keys(raw)) for (const m of (raw[n] || [])) all.push(m); } catch {}
                await window._shareFestivalDNA?.(all);
              }} className="mono" style={{
                padding: "12px", background: "linear-gradient(90deg, #e85d2e, #6D28D9, #2d7a55, #f59a36)", color: "#fff",
                border: "none", borderRadius: 10, cursor: "pointer", fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>🧬 FESTIVAL DNA — YOUR UNIQUE COLOR BARCODE</button>
              <button onClick={() => window._shareFestivalPassport?.(state)} className="mono" style={{
                padding: "12px", background: "rgba(247,237,224,0.08)", color: "#f7ede0",
                border: "1px solid rgba(247,237,224,0.15)", borderRadius: 10, cursor: "pointer",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>🛂 FESTIVAL PASSPORT — STAGE STAMPS</button>
              <button onClick={async () => {
                const all = []; try { const raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}"); for (const n of Object.keys(raw)) for (const m of (raw[n] || [])) all.push(m); } catch {}
                await window._shareFilmStrip?.(all);
              }} className="mono" style={{
                padding: "12px", background: "rgba(247,237,224,0.08)", color: "#f7ede0",
                border: "1px solid rgba(247,237,224,0.15)", borderRadius: 10, cursor: "pointer",
                fontSize: 10, letterSpacing: 1.4, fontWeight: 700,
              }}>🎞️ FILM STRIP — RETRO PHOTO REEL</button>
            </div>
            {!_isPlusSub() && (
              <div className="mono" style={{ fontSize: 9, color: "rgba(247,237,224,0.3)", marginTop: 10, textAlign: "center", letterSpacing: 1.2 }}>
                FREE PREVIEW WITH WATERMARK · UPGRADE TO REMOVE
              </div>
            )}
          </RecapCard>
        )}

        {/* P5: CUSTOM ACCENT (Plus-only) */}
        {_isPlusSub() && (
          <RecapCard kicker="YOUR STYLE" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, letterSpacing: -0.3 }}>
              Pick your <span style={{ fontStyle: "italic", color: _getCustomAccent() || "var(--ember)" }}>accent color</span>.
            </div>
            <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 4, letterSpacing: 1 }}>
              Applies to all collages, GIFs, and video exports.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {["#e85d2e","#6D28D9","#ec4899","#2563eb","#22c55e","#f97316","#1a120d","#14b8a6","#fbbf24"].map(c => (
                <button key={c} onClick={() => { _setCustomAccent(c); setState(s => ({ ...s })); }} style={{
                  width: 32, height: 32, borderRadius: 32, background: c, border: _getCustomAccent() === c ? "3px solid var(--ink)" : "2px solid var(--line)",
                  cursor: "pointer", boxShadow: _getCustomAccent() === c ? "0 0 0 2px var(--paper), 0 0 0 4px var(--ink)" : "none",
                }} />
              ))}
              <button onClick={() => { _setCustomAccent(""); setState(s => ({ ...s })); }} className="mono" style={{
                height: 32, padding: "0 10px", borderRadius: 32, background: "var(--paper-2)", border: "1px solid var(--line-2)",
                cursor: "pointer", fontSize: 8, letterSpacing: 1, color: "var(--muted)", fontWeight: 700,
              }}>RESET</button>
            </div>
          </RecapCard>
        )}

        {/* P3: FESTIVAL ARCHIVE (Plus-only) */}
        {_isPlusSub() && (() => {
          const archive = _getRecapArchive();
          const archiveEntries = Object.entries(archive).filter(([id]) => id !== FESTIVAL_CONFIG.id);
          if (!archiveEntries.length) return null;
          return (
            <RecapCard kicker="PAST FESTIVALS" paper="var(--paper)">
              <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, letterSpacing: -0.3, marginBottom: 10 }}>
                Your festival <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>archive</span>.
              </div>
              {archiveEntries.map(([id, r]) => (
                <div key={id} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--line)", marginBottom: 6 }}>
                  <div className="serif" style={{ fontSize: 16 }}>{id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                    {r.setsCount || 0} sets · {r.momentsCount || 0} memories · {r.stagesVisitedCount || 0} stages
                  </div>
                </div>
              ))}
            </RecapCard>
          );
        })()}

        {/* WEEKEND PLAYLIST */}
        {state.spotifyConnected && recap.setsCount > 0 && (
          <RecapCard kicker="YOUR SOUNDTRACK" paper="var(--paper)">
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 14 }}>
              Take the weekend <span style={{ fontStyle: "italic", color: "var(--horizon)" }}>home</span> with you.
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 14 }}>
              Build a Spotify playlist of every set you actually caught — top tracks from each, in chronological set order.
            </div>
            {playlistState.status === "done" ? (
              <div style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(45,122,85,0.12)", border: "1px solid rgba(45,122,85,0.4)",
              }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--success)", fontWeight: 700, marginBottom: 6 }}>
                  ✓ {playlistState.added} TRACKS ADDED
                </div>
                {playlistState.url && (
                  <a href={playlistState.url} target="_blank" rel="noopener noreferrer" className="mono" style={{
                    fontSize: 10, letterSpacing: 1.1, color: "var(--ink)", fontWeight: 700,
                    textDecoration: "underline",
                  }}>OPEN IN SPOTIFY ↗</a>
                )}
              </div>
            ) : (
              <button onClick={buildAttendedPlaylist} disabled={playlistState.status === "building"} style={{
                background: playlistState.status === "building" ? "var(--paper-2)" : "#1DB954",
                color: playlistState.status === "building" ? "var(--muted)" : "#fff",
                border: "none", borderRadius: 999, padding: "11px 18px",
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
                cursor: playlistState.status === "building" ? "default" : "pointer",
                alignSelf: "flex-start",
              }}>
                {playlistState.status === "building" ? "BUILDING…" : "↗ BUILD WEEKEND PLAYLIST"}
              </button>
            )}
            {playlistState.status === "error" && (
              <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "#c14a4a", marginTop: 8, fontWeight: 600 }}>
                {playlistState.msg}
              </div>
            )}
          </RecapCard>
        )}

        {/* DISCOVERY — saved but didn't catch */}
        {recap.missedSaved.length > 0 && (
          <RecapCard kicker={`MISSED · ${recap.missedSaved.length}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10 }}>
              You saved {recap.missedSaved.length} sets you didn't make it to.
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
              CATCH THEM NEXT YEAR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recap.missedSaved.map(a => {
                const stage = (window.STAGES || []).find(s => s.id === a.stage);
                return (
                  <button key={a.id}
                    onClick={() => setState(s => ({ ...s, artist: a.id }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px", borderRadius: 8,
                      background: "var(--paper)", border: "1px solid var(--line)",
                      cursor: "pointer", textAlign: "left",
                    }}>
                    <div style={{ width: 3, alignSelf: "stretch", background: stage?.color || "var(--line-2)", borderRadius: 2, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, flex: 1 }}>{a.name}</span>
                    <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", fontWeight: 600 }}>
                      {stage?.short || ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </RecapCard>
        )}

        {/* CREW HIGHLIGHTS */}
        {crewStats && crewStats.total > 0 && (
          <RecapCard kicker={`CREW · ${crewStats.code}`}>
            <div className="serif" style={{ fontSize: 28, lineHeight: 1.05, letterSpacing: -0.3, marginBottom: 10 }}>
              Your crew sent <span style={{ fontStyle: "italic", color: "var(--ember)" }}>{crewStats.total}</span> messages this weekend.
            </div>
            {crewStats.topSender && (
              <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Loudest in the group chat:{" "}
                <strong style={{ color: "var(--ink)" }}>{crewStats.topSender.name}</strong>
                {" "}({crewStats.topSender.count} messages).
              </div>
            )}
            {crewStats.uniqueSenders > 1 && (
              <div className="mono" style={{ fontSize: 10, letterSpacing: 1, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
                {crewStats.uniqueSenders} VOICES · 1 PLUR
              </div>
            )}
          </RecapCard>
        )}

        {/* OUTRO */}
        <RecapCard
          kicker="UNTIL NEXT YEAR"
          paper="linear-gradient(155deg, var(--paper) 0%, rgba(245,154,54,0.18) 100%)"
        >
          <div className="serif" style={{ fontSize: 32, lineHeight: 1, letterSpacing: -0.4 }}>
            See you under the <span style={{ fontStyle: "italic", color: "var(--ember)" }}>electric sky</span>.
          </div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--muted)", marginTop: 10, fontWeight: 600 }}>
            PLURSKY · {CFG.year || ""}
          </div>
        </RecapCard>
      </ScrollBody>
      {wrappedOpen && <WrappedStory recap={recap} onClose={() => setWrappedOpen(false)} />}
    </Screen>
  );
}

/* ─── NowPlayingBar ──────────────────────────────────────────────── */
function NowPlayingBar() {
  const [liveState, setLiveState] = React.useState({ stage: null, artist: null, song: null, listening: false, usersHere: 0 });
  const [captured, setCaptured] = React.useState(false);
  const CFG = window.FESTIVAL_CONFIG || {};

  const debugLive = React.useMemo(() => {
    try { return localStorage.getItem("plursky-debug-live") === "true"; } catch { return false; }
  }, []);

  // Check if we're during festival hours (or debug override)
  const isFestivalLive = React.useMemo(() => {
    if (debugLive) return true;
    if (!CFG.dayDates) return false;
    const now = Date.now();
    for (const dd of Object.values(CFG.dayDates)) {
      const openMs = dd.midnightUtc + 19 * 3600000; // 7pm
      const closeMs = dd.midnightUtc + (5.5 + 24) * 3600000; // 5:30am next day
      if (now >= openMs && now <= closeMs) return true;
    }
    return false;
  }, [debugLive]);

  // GPS watch for current stage (debug: simulate first stage + first artist on night 1)
  React.useEffect(() => {
    if (!isFestivalLive) return;

    if (debugLive) {
      const stages = window.STAGES || [];
      const artists = window.ARTISTS || [];
      const debugStage = stages[0];
      const debugArtist = artists.find(a => a.stage === debugStage?.id && a.day === 1) || artists[0];
      if (debugStage) {
        setLiveState(s => ({ ...s, stage: debugStage, artist: debugArtist || null }));
        if (window.joinStagePresence) window.joinStagePresence(debugStage.id);
      }
      return () => { if (window.leaveStagePresence) window.leaveStagePresence(); };
    }

    let watchId;
    const anchors = CFG.gpsAnchors || [];
    if (!anchors.length || !navigator.geolocation) return;

    watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const dists = anchors.map(a => ({ stageId: a.stageId, dist: _haversineMeters(lat, lng, a.lat, a.lng) }));
      const nearest = dists.sort((a, b) => a.dist - b.dist)[0];
      if (!nearest || nearest.dist > 200) { setLiveState(s => ({ ...s, stage: null, artist: null })); return; }

      const stageObj = (window.STAGES || []).find(s => s.id === nearest.stageId);
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();
      const adjustedMin = (hh < 6 ? hh + 24 : hh) * 60 + mm;

      // Find current night
      let currentNight = null;
      if (CFG.dayDates) {
        const nowMs = Date.now();
        for (const [day, dd] of Object.entries(CFG.dayDates)) {
          const openMs = dd.midnightUtc + 19 * 3600000;
          const closeMs = dd.midnightUtc + (5.5 + 24) * 3600000;
          if (nowMs >= openMs && nowMs <= closeMs) { currentNight = parseInt(day); break; }
        }
      }

      // Find artist playing now at this stage
      let currentArtist = null;
      if (currentNight) {
        for (const a of (window.ARTISTS || [])) {
          if (a.day !== currentNight || a.stage !== nearest.stageId) continue;
          const [sh, sm] = a.start.split(":").map(Number);
          const [eh, em] = a.end.split(":").map(Number);
          const startMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
          const endMin = (eh < 6 ? eh + 24 : eh) * 60 + em;
          if (adjustedMin >= startMin && adjustedMin < endMin) { currentArtist = a; break; }
        }
      }

      setLiveState(s => ({ ...s, stage: stageObj, artist: currentArtist }));
      if (stageObj?.id && window.joinStagePresence) window.joinStagePresence(stageObj.id);
    }, null, { enableHighAccuracy: true, maximumAge: 10000 });

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (window.leaveStagePresence) window.leaveStagePresence();
    };
  }, [isFestivalLive, debugLive]);

  // Listen for presence count updates
  React.useEffect(() => {
    const onPresence = (e) => {
      if (e.detail?.stageId === liveState.stage?.id) {
        setLiveState(s => ({ ...s, usersHere: e.detail.count }));
      }
    };
    window.addEventListener("plursky-presence", onPresence);
    return () => window.removeEventListener("plursky-presence", onPresence);
  }, [liveState.stage?.id]);

  // Pre-fetch tracklist for the current artist so estimatedSong can read it
  const [tracklistReady, setTracklistReady] = React.useState(0);
  React.useEffect(() => {
    if (!liveState.artist?.name) return;
    _getTracklistForArtist(liveState.artist.name).then(() => setTracklistReady(n => n + 1));
  }, [liveState.artist?.name]);

  // Estimated song from tracklist position (debug: pick track from mid-set)
  const estimatedSong = React.useMemo(() => {
    if (!liveState.artist) return null;
    const key = liveState.artist.name.toLowerCase().replace(/\W+/g, "_");
    const cached = _setlistCache[key];
    if (!cached) return null;
    if (debugLive && cached.source === "1001tracklists" && cached.tracks?.length) {
      const t = cached.tracks[Math.floor(cached.tracks.length / 3)];
      const display = t.artist ? `${t.artist} — ${t.title}` : t.title;
      return { song: display, source: "1001tracklists", confidence: "exact (debug)", url: cached.url };
    }
    if (debugLive && cached.source === "setlist.fm" && cached.songs?.length) {
      return { song: cached.songs[Math.floor(cached.songs.length / 3)], source: "setlist.fm", confidence: "estimated (debug)" };
    }
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    return _matchSongAtTime(liveState.artist, cached, now);
  }, [liveState.artist, debugLive, tracklistReady]);

  const [listenProgress, setListenProgress] = React.useState(0);

  const handleShazam = async () => {
    setLiveState(s => ({ ...s, listening: true }));
    setListenProgress(0);
    try {
      // Path 1: Native iOS ShazamKit — the ONLY working recognizer on device
      // (the web recognizer below is a 404 in production). So on native we treat
      // ShazamKit's answer as FINAL — success, honest no-match, or timeout — and
      // never fall through to the dead web path (which only wasted 8s recording
      // and then lied with "couldn't identify"). Timeout is 14s: native auto-
      // stops listening at 12s, so a 10s JS guard was ABORTING matches that were
      // about to land. The guard must outlast the native listen window.
      if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin) {
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 14000));
        const progressId = setInterval(() => setListenProgress(p => Math.min(p + 7, 95)), 1000);
        try {
          const result = await Promise.race([window.ShazamPlugin.identify(), timeout]);
          clearInterval(progressId);
          if (result?.title) {
            setLiveState(s => ({ ...s, song: { song: `${result.artist} — ${result.title}`, source: "shazam", confidence: "exact" }, listening: false }));
            setListenProgress(100);
            return;
          }
          // Native listened and found nothing in Apple's catalog — routine for
          // live DJ sets, mashups, and unreleased IDs. Be honest; if we have a
          // tracklist estimate, offer it rather than leaving them empty-handed.
          clearInterval(progressId);
          setListenProgress(0);
          if (estimatedSong) {
            setLiveState(s => ({ ...s, song: estimatedSong, listening: false }));
            window.plurskyToast?.("No exact match (live/unreleased?) — showing the set estimate");
          } else {
            setLiveState(s => ({ ...s, listening: false }));
            window.plurskyToast?.("No match — live & unreleased sets often aren't in Shazam's catalog");
          }
          return;
        } catch {
          clearInterval(progressId);
          setListenProgress(0);
          setLiveState(s => ({ ...s, listening: false }));
          window.plurskyToast?.("Shazam timed out — move closer to a speaker and try again");
          return;
        }
      }
      // Path 2: Web / non-native. There is no deployed web recognizer today
      // (`recognize-song` 404s), so do not record 8 seconds of mic audio and
      // then pretend recognition failed. Web can only show the schedule estimate;
      // exact Shazam is native-device only.
      if (estimatedSong) {
        setLiveState(s => ({ ...s, song: estimatedSong, listening: false }));
        setListenProgress(0);
        window.plurskyToast?.("Exact Shazam needs the iPhone build — showing the set estimate");
        return;
      }
      setLiveState(s => ({ ...s, listening: false }));
      setListenProgress(0);
      window.plurskyToast?.("Exact Shazam works in the iPhone build, not on web");
      return;
    } catch {
      setLiveState(s => ({ ...s, listening: false }));
    }
    setListenProgress(0);
  };

  const handleCapture = () => {
    const song = liveState.song || estimatedSong;
    const momentId = `cap_${Date.now()}`;
    const night = liveState.artist?.day || 1;
    const all = _readMoments();
    all[night] = [...(all[night] || []), {
      id: momentId,
      night,
      artistId: liveState.artist?.id || null,
      takenAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      tagSource: "live_capture",
      createdAt: Date.now(),
      songCapture: song ? { song: song.song, source: song.source || "live" } : null,
      // Live "Capture this moment" has no photo, so no real GPS coordinates.
      // hasGps must reflect that we have no parsedGps (was hardcoded true,
      // which only inflated hero-scoring by +10 for these text captures).
      hasGps: false,
    }];
    _writeMoments(all);
    setCaptured(true);
    window.plurskyHaptic?.("MEDIUM");
    setTimeout(() => setCaptured(false), 2000);
  };

  if (!isFestivalLive || !liveState.stage) return null;

  const displaySong = liveState.song || estimatedSong;
  const stageColor = liveState.stage?.color || "var(--horizon)";

  return (
    <div style={{
      position: "fixed", bottom: 64, left: 8, right: 8, zIndex: 900,
      borderRadius: 16, overflow: "hidden",
      background: "rgba(10,6,24,0.92)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 20px ${stageColor}33`,
      padding: "10px 14px",
      animation: "song-fade-in 0.4s ease-out",
    }}>
      {/* Set progress ring — SVG arc showing how far through the set */}
      {liveState.artist && (() => {
        const nowMin = typeof toNightMin === "function" && NOW?.time ? toNightMin(NOW.time) : 0;
        const startMin = typeof toNightMin === "function" ? toNightMin(liveState.artist.start) : 0;
        const endMin = typeof toNightMin === "function" ? toNightMin(liveState.artist.end) : 1;
        const total = Math.max(1, endMin - startMin);
        const elapsed = Math.max(0, nowMin - startMin);
        const pct = Math.min(1, elapsed / total);
        const minsLeft = Math.max(0, Math.round(total - elapsed));
        return (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3, overflow: "hidden", borderRadius: "16px 16px 0 0",
          }}>
            <div style={{
              width: `${pct * 100}%`, height: "100%",
              background: `linear-gradient(90deg, ${stageColor}, ${stageColor}cc)`,
              borderRadius: "0 3px 3px 0",
              transition: "width 30s linear",
              boxShadow: `0 0 8px ${stageColor}`,
            }}/>
            {minsLeft > 0 && minsLeft <= 10 && (
              <div className="mono" style={{
                position: "absolute", right: 6, top: 5, fontSize: 8, letterSpacing: 1,
                color: stageColor, fontWeight: 800, textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              }}>{minsLeft}M LEFT</div>
            )}
          </div>
        );
      })()}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Pulsing live dot + stage info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{
              width: 6, height: 6, borderRadius: 6, background: "#ef4444",
              animation: "pulse 2s infinite",
            }} />
            <span className="mono" style={{
              fontSize: 8, letterSpacing: 1.4, fontWeight: 700, color: stageColor,
            }}>LIVE · {liveState.stage?.name?.toUpperCase()}{liveState.usersHere > 1 ? ` · ${liveState.usersHere} HERE` : ""}</span>
          </div>

          {liveState.artist && (
            <div className="serif" style={{
              fontSize: 14, color: "#fff", lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{liveState.artist.name}</div>
          )}

          {displaySong && (
            <div className="mono" style={{
              fontSize: 8, letterSpacing: 0.6, color: "rgba(255,255,255,0.5)",
              marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ color: stageColor, fontSize: 9 }}>♫</span>
              {displaySong.song}
            </div>
          )}
        </div>

        {/* What's Playing button */}
        <button onClick={handleShazam} disabled={liveState.listening} style={{
          width: 36, height: 36, borderRadius: 36, border: "none", cursor: "pointer",
          background: liveState.listening ? `${stageColor}44` : `${stageColor}22`,
          color: stageColor, fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: liveState.listening ? "pulse 1s infinite" : "none",
          transition: "background 0.2s",
        }} title="What's playing?">
          {liveState.listening ? "..." : "🎵"}
        </button>

        {/* Capture button */}
        <button onClick={handleCapture} style={{
          height: 36, borderRadius: 36, border: "none", cursor: "pointer",
          padding: "0 14px",
          background: captured ? "var(--success)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
          color: "#fff", fontWeight: 700, fontSize: 9, letterSpacing: 1.2,
          display: "flex", alignItems: "center", gap: 5,
          transition: "all 0.3s",
          fontFamily: "Geist Mono, monospace",
        }}>
          {captured ? "✓ SAVED" : "CAPTURE"}
        </button>
      </div>
    </div>
  );
}

Object.assign(window, {
  NowPlayingBar,
  SpotifyScreen, MeScreen, MemoriesScreen, RecapScreen,
  archiveFestival, HomeMemoriesStrip, PackListCard,
  _isPlusSub, _setPlusSub, PlusGate, _purchasePlus, _restorePurchases, RC_PRODUCT_IDS, _canShare, _getCustomAccent, _setCustomAccent, _archiveRecap, _getRecapArchive, _canAccessFestival,
  _getTracklistForArtist,
  // Spotify/Apple-Music API moved to spotify-api.jsx (startSpotifyAuth,
  // ensureSpotifyProfile, getSpotifyProfileSync, createEdcPlaylist,
  // fetchPreviewUrl). recap/share engine moved to recap-engine.jsx
  // (_renderCollage/_shareRecapVideo/_share*Collage/DNA/Passport/etc.).
});

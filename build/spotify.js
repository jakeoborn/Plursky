function SpotifyScreen({
  state,
  setState
}) {
  var connected = state.spotifyConnected;
  var [spotifyArtists, setSpotifyArtists] = React.useState(null);
  var [tokenBad, setTokenBad] = React.useState(false);
  var [saveFlash, setSaveFlash] = React.useState(false);
  var [playlistCount, setPlaylistCount] = React.useState(null);
  var [playlistScanFailed, setPlaylistScanFailed] = React.useState(false);
  var [showAllArtists, setShowAllArtists] = React.useState(false);
  var [scanProgress, setScanProgress] = React.useState("");
  var [amConnected, setAmConnected] = React.useState(() => !!localStorage.getItem("am_user_token"));
  var [amArtists, setAmArtists] = React.useState(null);
  var [amLoading, setAmLoading] = React.useState(false);
  var [amError, setAmError] = React.useState("");
  React.useEffect(() => {
    if (!connected) {
      setSpotifyArtists([]);
      setPlaylistCount(null);
      setPlaylistScanFailed(false);
      setScanProgress("");
      return;
    }
    fetchSpotifyTopArtists(msg => setScanProgress(msg)).then(artists => {
      setScanProgress("");
      if (artists === null) {
        setTokenBad(true);
        setState({
          ...state,
          spotifyConnected: false
        });
      } else {
        setSpotifyArtists(artists);
        setPlaylistCount(artists._playlistCount ?? null);
        setPlaylistScanFailed(artists._playlistScanOk === false);
        try {
          var ids = matchLineupArtists(artists).map(a => a._realId || a.id);
          localStorage.setItem('spotify_matched_ids_v1', JSON.stringify(ids));
        } catch {}
      }
    });
  }, [connected]);
  React.useEffect(() => {
    if (!amConnected) {
      setAmArtists(null);
      return;
    }
    fetchAppleMusicArtists().then(artists => {
      if (artists === null) {
        setAmConnected(false);
      } else setAmArtists(artists);
    });
  }, [amConnected]);
  React.useEffect(() => {
    if (APPLE_DEV_TOKEN && !amConnected) {
      _ensureMusicKitConfigured().catch(() => {});
    }
  }, []);
  var handleAmConnect = async () => {
    if (!APPLE_DEV_TOKEN) return;
    setAmLoading(true);
    setAmError("");
    var result = await connectAppleMusic();
    setAmLoading(false);
    if (result.ok) {
      setAmConnected(true);
    } else setAmError(result.error || "Connection failed");
  };
  var handleAmDisconnect = () => {
    disconnectAppleMusic();
    setAmConnected(false);
    setAmArtists(null);
  };
  var amMatched = amArtists ? matchLineupArtists(amArtists) : [];
  var matched = matchLineupArtists(spotifyArtists);
  var {
    topGenres,
    stageRecs
  } = spotifyArtists?.length ? analyzeGenres(spotifyArtists) : {
    topGenres: [],
    stageRecs: []
  };
  var maxCount = topGenres[0]?.count || 1;
  var discoveries = spotifyArtists?.length ? getDiscoveries(spotifyArtists, matched, state.saved, 8) : [];
  var fallback = ARTISTS.filter(a => a.tier === 3).slice(0, 8);
  var recs = matched.length ? matched : fallback;
  var noScopeRecord = (() => {
    try {
      return !localStorage.getItem("spotify_auth_scopes");
    } catch {
      return false;
    }
  })();
  var missingFollowScope = (() => {
    try {
      var s = localStorage.getItem("spotify_auth_scopes") || "";
      return s !== "" && !s.includes("user-follow-read");
    } catch {
      return false;
    }
  })();
  var handleSaveAll = () => {
    var newSaved = [...new Set([...state.saved, ...matched.map(a => a._realId || a.id)])];
    setState({
      ...state,
      saved: newSaved
    });
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2200);
  };
  return React.createElement(Screen, {
    bg: "var(--paper)"
  }, React.createElement("div", {
    style: {
      padding: "8px 20px"
    }
  }, React.createElement(TopBar, {
    title: React.createElement("span", null, "Music"),
    sub: "SOUNDTRACK",
    tight: true
  })), React.createElement(ScrollBody, {
    style: {
      padding: "10px 20px 94px"
    }
  }, !connected && _isNativeApp() && React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 12px",
      marginBottom: 14,
      background: "rgba(232,93,46,0.10)",
      border: "1px solid rgba(232,93,46,0.35)",
      borderRadius: 12
    }
  }, React.createElement("span", {
    "aria-hidden": true,
    style: {
      fontSize: 14,
      flexShrink: 0
    }
  }, "ℹ️"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink)",
      lineHeight: 1.45
    }
  }, "If Spotify sign-in stalls, open ", React.createElement("strong", null, "plursky.com"), " in mobile Safari — it works there reliably and your saved sets sync if you signed in with Apple on Me.")), React.createElement("div", {
    style: {
      borderRadius: 20,
      padding: 20,
      background: connected ? "#1a3d2b" : "var(--ink)",
      color: "var(--paper)",
      marginBottom: 20,
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("svg", {
    width: "36",
    height: "36",
    viewBox: "0 0 24 24",
    style: {
      position: "absolute",
      top: 16,
      right: 16
    }
  }, React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "11",
    fill: "#1DB954"
  }), React.createElement("path", {
    d: "M6 10 Q12 8 18 11",
    stroke: "#000",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    fill: "none"
  }), React.createElement("path", {
    d: "M7 13 Q12 11.5 17 14",
    stroke: "#000",
    strokeWidth: "1.4",
    strokeLinecap: "round",
    fill: "none"
  }), React.createElement("path", {
    d: "M8 15.8 Q12 14.5 16 16.5",
    stroke: "#000",
    strokeWidth: "1.2",
    strokeLinecap: "round",
    fill: "none"
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      opacity: 0.65,
      marginBottom: 8
    }
  }, connected ? "CONNECTED" : "CONNECT SPOTIFY"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 10,
      maxWidth: "78%"
    }
  }, connected ? React.createElement(React.Fragment, null, "Your lineup is ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "personalised")) : React.createElement(React.Fragment, null, "Build your ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "perfect"), " festival night")), React.createElement("div", {
    style: {
      fontSize: 12,
      opacity: 0.75,
      lineHeight: 1.55,
      marginBottom: connected && spotifyArtists !== null && (playlistScanFailed || noScopeRecord) ? 8 : 16,
      maxWidth: "88%"
    }
  }, connected ? matched.length ? `${matched.length} artists match · scanned top, recent, liked songs${playlistCount > 0 ? ` + ${playlistCount} playlist${playlistCount === 1 ? "" : "s"}` : ""}.` : spotifyArtists === null ? "Loading your taste…" : "No direct matches — showing genre-based picks below." : "Link Spotify to see your matches, genre breakdown, and play 30-sec previews on any artist."), connected && spotifyArtists !== null && (playlistScanFailed || noScopeRecord || missingFollowScope) && React.createElement("button", {
    onClick: () => {
      disconnectSpotify(setState, state);
      startSpotifyAuth();
    },
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      fontSize: 13,
      lineHeight: 1.5,
      marginBottom: 14,
      background: "rgba(245,154,54,0.18)",
      border: "1px solid rgba(245,154,54,0.4)",
      borderRadius: 8,
      padding: "8px 10px",
      color: "#fde68a",
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, missingFollowScope ? "↻ Reconnect Spotify — your current session can't see followed artists. Layton Giordani, Sofi Tukker and others you follow won't be matched until you reconnect." : noScopeRecord && !playlistScanFailed ? "↻ Reconnect Spotify to unlock full playlist scanning — artists in private playlists may be missing." : "↻ Your playlists weren't scanned. Tap to reconnect Spotify with full access — this fixes missing artists like those in private playlists."), tokenBad && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#f87171",
      marginBottom: 10,
      letterSpacing: 0.8
    }
  }, "Session expired — please reconnect."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, connected && matched.length > 0 && React.createElement("button", {
    onClick: handleSaveAll,
    style: {
      background: saveFlash ? "#2d7a55" : "#1DB954",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "10px 16px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600,
      transition: "background 0.3s"
    }
  }, saveFlash ? `✓ SAVED ${matched.length} ARTISTS` : `SAVE ALL ${matched.length} ARTISTS`), connected && state.saved.length > 0 && React.createElement(BuildPlaylistButton, {
    state: state
  }), state.saved.length > 0 && React.createElement(AppleMusicPlaylistButton, {
    state: state
  }), (window._collectMomentSongs?.() || []).length > 0 && React.createElement(React.Fragment, null, connected && React.createElement(BuildPlaylistButton, {
    state: state,
    soundtrack: true
  }), React.createElement(AppleMusicPlaylistButton, {
    state: state,
    soundtrack: true
  })), React.createElement("button", {
    onClick: () => {
      if (!connected) window.plurskyHaptic?.("MEDIUM");
      connected ? disconnectSpotify(setState, state) : startSpotifyAuth();
    },
    style: {
      background: connected ? "rgba(29,185,84,0.2)" : "rgba(247,237,224,0.12)",
      color: "var(--paper)",
      border: connected ? "1px solid rgba(29,185,84,0.5)" : "1px solid rgba(247,237,224,0.28)",
      borderRadius: 999,
      padding: "10px 16px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 500,
      transition: "all 0.3s var(--ease-spring)",
      animation: connected && spotifyArtists === null ? "savePop 1.2s ease-in-out infinite" : undefined
    }
  }, connected && spotifyArtists === null ? "⟳ LOADING…" : connected ? "✓ CONNECTED" : "CONNECT ACCOUNT")), APPLE_DEV_TOKEN && state.saved.length > 0 && React.createElement("div", {
    className: "mono",
    style: {
      marginTop: 10,
      fontSize: 9,
      letterSpacing: 0.5,
      lineHeight: 1.5,
      color: "rgba(247,237,224,0.55)"
    }
  }, "💡 Your saved sets build a playlist on ", React.createElement("span", {
    style: {
      color: "rgba(247,237,224,0.92)",
      fontWeight: 700
    }
  }, "Spotify or Apple Music"), " — import your taste from one, export to either. No Spotify needed for the Apple Music playlist.")), connected && React.createElement(FollowedNudge, {
    state: state,
    setState: setState
  }), APPLE_DEV_TOKEN && React.createElement("div", {
    style: {
      borderRadius: 20,
      padding: 20,
      background: amConnected ? "#3a1a1a" : "var(--paper-2)",
      border: `1px solid ${amConnected ? "rgba(252,60,60,0.25)" : "var(--line)"}`,
      color: amConnected ? "var(--paper)" : "var(--ink)",
      marginBottom: 14,
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("svg", {
    width: "36",
    height: "36",
    viewBox: "0 0 24 24",
    style: {
      position: "absolute",
      top: 16,
      right: 16
    }
  }, React.createElement("rect", {
    width: "24",
    height: "24",
    rx: "6",
    fill: "#fc3c44"
  }), React.createElement("path", {
    d: "M16.5 7.5 L10 9 L10 15",
    stroke: "#fff",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none"
  }), React.createElement("circle", {
    cx: "8.5",
    cy: "15",
    r: "1.5",
    fill: "#fff"
  }), React.createElement("circle", {
    cx: "15",
    cy: "13",
    r: "1.5",
    fill: "#fff"
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      opacity: amConnected ? 0.65 : 0.5,
      marginBottom: 8
    }
  }, amConnected ? "APPLE MUSIC CONNECTED" : "CONNECT APPLE MUSIC"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 8,
      maxWidth: "78%"
    }
  }, amConnected ? React.createElement(React.Fragment, null, amMatched.length, " festival ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "matches"), " found") : React.createElement(React.Fragment, null, "Don't use Spotify? ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "Link Apple Music"))), !amConnected && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 12,
      opacity: 0.65,
      lineHeight: 1.5,
      marginBottom: 14,
      maxWidth: "88%"
    }
  }, "Scan your Apple Music library to find which artists you already know and love."), amError && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#f87171",
      marginBottom: 8
    }
  }, amError), React.createElement("button", {
    onClick: handleAmConnect,
    disabled: amLoading,
    style: {
      background: "#fc3c44",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "10px 18px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600
    }
  }, amLoading ? "CONNECTING…" : "CONNECT APPLE MUSIC")), amConnected && React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, amMatched.length > 0 && React.createElement("button", {
    onClick: () => {
      var newSaved = [...new Set([...state.saved, ...amMatched.map(a => a.id)])];
      setState({
        ...state,
        saved: newSaved
      });
    },
    style: {
      background: "#fc3c44",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "10px 16px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600
    }
  }, "SAVE ALL ", amMatched.length, " ARTISTS"), React.createElement("button", {
    onClick: handleAmDisconnect,
    style: {
      background: "rgba(247,237,224,0.12)",
      color: "var(--paper)",
      border: "1px solid rgba(247,237,224,0.28)",
      borderRadius: 999,
      padding: "10px 16px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2
    }
  }, "DISCONNECT")), amConnected && amArtists === null && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      opacity: 0.6
    }
  }, "LOADING LIBRARY…")), connected && spotifyArtists !== null && React.createElement("div", {
    style: {
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 20,
      background: "var(--paper-2)",
      border: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1,
      letterSpacing: -0.3
    }
  }, "Harmony score"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 3
    }
  }, "YOUR SPOTIFY VS THE LINEUP")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 42,
      lineHeight: 1,
      letterSpacing: -1.5
    }
  }, Math.round(matched.length / ARTISTS.length * 100), React.createElement("span", {
    style: {
      fontSize: 22,
      opacity: 0.45
    }
  }, "%"))), React.createElement("div", {
    style: {
      height: 6,
      background: "var(--line)",
      borderRadius: 6,
      overflow: "hidden",
      marginBottom: 8
    }
  }, React.createElement("div", {
    style: {
      width: `${Math.round(matched.length / ARTISTS.length * 100)}%`,
      height: "100%",
      background: "linear-gradient(90deg, var(--ember), var(--horizon))",
      borderRadius: 6,
      transition: "width 0.8s ease"
    }
  })), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      lineHeight: 1.5
    }
  }, matched.length, " of ", ARTISTS.length, " artists match your Spotify — scanned across top, recent, liked & playlists.")), connected && topGenres.length > 0 && React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      letterSpacing: -0.3,
      marginBottom: 3
    }
  }, "Your music DNA"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 14
    }
  }, "FROM YOUR SPOTIFY TOP 50 ARTISTS"), topGenres.map(({
    genre,
    count
  }) => {
    var pct = Math.round(count / maxCount * 100);
    var barColor = "var(--ember)";
    var _loop = function (sid) {
      if (keywords.some(k => genre.includes(k))) {
        barColor = STAGES.find(s => s.id === sid)?.color || barColor;
        return 1;
      }
    };
    for (var [sid, keywords] of Object.entries(STAGE_GENRES)) {
      if (_loop(sid)) break;
    }
    return React.createElement("div", {
      key: genre,
      style: {
        marginBottom: 10
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 5
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13,
        textTransform: "capitalize",
        color: "var(--ink)"
      }
    }, genre), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 0.8,
        color: "var(--muted)"
      }
    }, pct, "%")), React.createElement("div", {
      style: {
        height: 5,
        background: "var(--line)",
        borderRadius: 5,
        overflow: "hidden"
      }
    }, React.createElement("div", {
      style: {
        width: `${pct}%`,
        height: "100%",
        background: barColor,
        borderRadius: 5,
        transition: "width 0.7s ease"
      }
    })));
  })), connected && stageRecs.length > 0 && React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      letterSpacing: -0.3,
      marginBottom: 3
    }
  }, "Best stages for you"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 14
    }
  }, "BASED ON YOUR GENRE TASTE"), stageRecs.map(({
    stage,
    pct
  }) => React.createElement("div", {
    key: stage.id,
    style: {
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 8,
      background: "var(--paper-2)",
      borderLeft: `3px solid ${stage.color}`
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      lineHeight: 1
    }
  }, stage.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: stage.color,
      fontWeight: 700
    }
  }, pct, "% MATCH")), React.createElement("div", {
    style: {
      height: 3,
      background: "var(--line)",
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 6
    }
  }, React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      background: stage.color,
      borderRadius: 3
    }
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)"
    }
  }, stage.desc.toUpperCase())))), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      letterSpacing: -0.3,
      marginBottom: 3
    }
  }, connected && matched.length ? "Your matches" : connected && spotifyArtists === null ? "Loading your matches" : "Top picks for you"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 14
    }
  }, connected && matched.length ? "FROM YOUR SPOTIFY · TAP TO VIEW" : connected && spotifyArtists === null ? scanProgress ? `SCANNING · ${scanProgress}` : "SCANNING YOUR LIBRARY…" : "HEADLINERS · TAP + TO SAVE"), connected && spotifyArtists === null && React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, [1, 2, 3, 4].map(i => React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    className: "skel",
    style: {
      width: 48,
      height: 48,
      borderRadius: 48,
      flexShrink: 0
    }
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    className: "skel",
    style: {
      width: `${50 + i * 10}%`,
      height: 14,
      marginBottom: 6
    }
  }), React.createElement("div", {
    className: "skel",
    style: {
      width: "40%",
      height: 9
    }
  })), React.createElement("div", {
    className: "skel",
    style: {
      width: 34,
      height: 34,
      borderRadius: 34,
      flexShrink: 0
    }
  })))), recs.map(a => {
    var realId = a._realId || a.id;
    var stg = STAGES.find(s => s.id === a.stage);
    var isSaved = state.saved.includes(realId);
    return React.createElement("div", {
      key: a.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--line)"
      }
    }, React.createElement(ArtistSwatch, {
      artist: a,
      size: 48
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        cursor: "pointer"
      },
      onClick: () => setState({
        ...state,
        tab: "home",
        artist: realId
      })
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        lineHeight: 1.1
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--muted)",
        marginTop: 2,
        textTransform: "uppercase"
      }
    }, stg?.name || "Stage TBA", " · DAY ", a.day, " · ", fmt12(a.start))), React.createElement("button", {
      onClick: () => toggleSave(state, setState, realId),
      style: {
        width: 34,
        height: 34,
        borderRadius: 34,
        background: isSaved ? "var(--ember)" : "transparent",
        color: isSaved ? "#fff" : "var(--ink)",
        border: isSaved ? "none" : "1px solid var(--line-2)",
        cursor: "pointer",
        fontSize: 18,
        fontWeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, isSaved ? "✓" : "+"));
  }), connected && discoveries.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      letterSpacing: -0.3,
      marginTop: 24,
      marginBottom: 3
    }
  }, "Recommended for you"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 14
    }
  }, "ARTISTS THAT MATCH YOUR TASTE · NOT IN YOUR TOP YET"), discoveries.map(a => {
    var stg = STAGES.find(s => s.id === a.stage);
    var isSaved = state.saved.includes(a.id);
    return React.createElement("div", {
      key: a.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--line)"
      }
    }, React.createElement(ArtistSwatch, {
      artist: a,
      size: 48
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        cursor: "pointer"
      },
      onClick: () => setState({
        ...state,
        tab: "home",
        artist: a.id
      })
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        lineHeight: 1.1
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--muted)",
        marginTop: 2,
        textTransform: "uppercase"
      }
    }, stg?.name || "Stage TBA", " · DAY ", a.day, " · ", fmt12(a.start)), a._reason && React.createElement("div", {
      style: {
        fontSize: 10,
        fontStyle: "italic",
        color: "var(--horizon)",
        marginTop: 3,
        lineHeight: 1.3
      }
    }, a._reason)), React.createElement("button", {
      onClick: () => toggleSave(state, setState, a.id),
      style: {
        width: 34,
        height: 34,
        borderRadius: 34,
        background: isSaved ? "var(--ember)" : "transparent",
        color: isSaved ? "#fff" : "var(--ink)",
        border: isSaved ? "none" : "1px solid var(--line-2)",
        cursor: "pointer",
        fontSize: 18,
        fontWeight: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, isSaved ? "✓" : "+"));
  })), connected && spotifyArtists !== null && spotifyArtists.length > 0 && React.createElement("div", {
    style: {
      marginTop: 28,
      marginBottom: 8
    }
  }, React.createElement("button", {
    onClick: () => setShowAllArtists(v => !v),
    style: {
      width: "100%",
      textAlign: "left",
      background: "none",
      border: "none",
      padding: 0,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      letterSpacing: -0.3
    }
  }, "Your scanned artists"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 3
    }
  }, spotifyArtists.length, " ARTISTS FROM YOUR SPOTIFY")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)",
      letterSpacing: 1
    }
  }, showAllArtists ? "▲ HIDE" : "▼ SHOW")), showAllArtists && React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, [...spotifyArtists].sort((a, b) => a.name.localeCompare(b.name)).map((a, i) => {
    var srcLabel = a._source === "top" ? "TOP" : a._source === "recent" ? "RECENT" : a._source === "saved" ? "LIKED" : "PLAYLIST";
    var srcColor = a._source === "top" ? "var(--ember)" : a._source === "recent" ? "var(--horizon)" : a._source === "saved" ? "#34d399" : "var(--muted)";
    var isEdc = ARTISTS.some(e => e.name.toLowerCase() === a.name.toLowerCase());
    return React.createElement("div", {
      key: a.id || i,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 0",
        borderBottom: "1px solid var(--line)"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 14,
        color: isEdc ? "var(--ink)" : "var(--muted)",
        fontWeight: isEdc ? 500 : 400
      }
    }, a.name, isEdc && React.createElement("span", {
      style: {
        fontSize: 10,
        color: "var(--ember-ink)",
        marginLeft: 6
      }
    }, "· ✓")), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: srcColor
      }
    }, srcLabel));
  })))));
}
var SAFETY_LINKS = [{
  id: "ground",
  title: "Ground Control",
  sub: "Free water · cool down · friendly faces. Look for the high-vis vests.",
  color: "var(--horizon)",
  icon: "shield",
  href: "https://insomniac.com/festival/edc-las-vegas/2026/info/health-safety/"
}, {
  id: "amnesty",
  title: "Amnesty Boxes",
  sub: "Drop unwanted substances at any entrance. No questions, no consequences.",
  color: "var(--ember-ink)",
  icon: "amnesty",
  href: "https://insomniac.com/festival/edc-las-vegas/2026/info/health-safety/"
}, {
  id: "dancesafe",
  title: "DanceSafe",
  sub: "Drug-checking, harm-reduction info, peer support. Independent nonprofit.",
  color: "#34d399",
  icon: "info",
  href: "https://dancesafe.org"
}, {
  id: "consent",
  title: "Consent Reporting",
  sub: "Report anonymously. Insomniac Cares + 24/7 confidential line.",
  color: "var(--ink)",
  icon: "consent",
  href: "https://insomniac.com/cares"
}, {
  id: "medical",
  title: "Medical · 24/7",
  sub: "3 medic tents on-site · roamers in the crowd. Tap → map.",
  color: "#f87171",
  icon: "med",
  onClick: (state, setState) => setState({
    ...state,
    tab: "map"
  })
}];
function SafetyIcon({
  kind,
  color
}) {
  var stroke = color || "currentColor";
  if (kind === "shield") return React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: stroke,
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M12 3 L20 6 V12 C20 17 16 20.5 12 22 C8 20.5 4 17 4 12 V6 Z"
  }), React.createElement("path", {
    d: "M9 12 L11 14 L15 10"
  }));
  if (kind === "amnesty") return React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: stroke,
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "4",
    y: "8",
    width: "16",
    height: "12",
    rx: "1.5"
  }), React.createElement("path", {
    d: "M8 8 V6 a4 4 0 0 1 8 0 V8"
  }), React.createElement("path", {
    d: "M9 14 H15"
  }));
  if (kind === "info") return React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: stroke,
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), React.createElement("path", {
    d: "M12 11 V16"
  }), React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "0.7",
    fill: stroke
  }));
  if (kind === "consent") return React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: stroke,
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M21 12 a9 9 0 1 1-3-6.7"
  }), React.createElement("path", {
    d: "M21 4 V10 H15"
  }));
  if (kind === "med") return React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: stroke,
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, React.createElement("rect", {
    x: "4",
    y: "6",
    width: "16",
    height: "14",
    rx: "2"
  }), React.createElement("path", {
    d: "M12 10 V16"
  }), React.createElement("path", {
    d: "M9 13 H15"
  }));
  return null;
}
function SafetyCards() {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, SAFETY_LINKS.map(item => {
    var onClick = item.href ? () => window.open(item.href, "_blank", "noopener") : () => item.onClick?.();
    return React.createElement("button", {
      key: item.id,
      onClick: onClick,
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderLeft: `3px solid ${item.color}`,
        cursor: "pointer",
        textAlign: "left",
        color: "var(--ink)",
        fontFamily: "inherit"
      }
    }, React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 10,
        background: `${item.color}1f`,
        color: item.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }
    }, React.createElement(SafetyIcon, {
      kind: item.icon,
      color: item.color
    })), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        lineHeight: 1.1
      }
    }, item.title), React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--muted)",
        marginTop: 3,
        lineHeight: 1.45
      }
    }, item.sub)), item.href && React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--muted)",
      strokeWidth: "2",
      style: {
        flexShrink: 0,
        marginTop: 4
      }
    }, React.createElement("path", {
      d: "M7 17 L17 7"
    }), React.createElement("path", {
      d: "M9 7 H17 V15"
    })));
  }));
}
var PACK_ITEMS = [{
  id: "hydra",
  label: "Hydration pack / Camelbak",
  emoji: "💧"
}, {
  id: "ear",
  label: "Earplugs",
  emoji: "🎧"
}, {
  id: "sun",
  label: "Sunscreen + lip balm",
  emoji: "☀️"
}, {
  id: "boots",
  label: "Comfortable boots / sneakers",
  emoji: "👟"
}, {
  id: "jacket",
  label: "Light jacket (60°F at sunrise)",
  emoji: "🧥"
}, {
  id: "power",
  label: "Phone charger / battery pack",
  emoji: "🔋"
}, {
  id: "cash",
  label: "Cash + ID + bank card",
  emoji: "💳"
}, {
  id: "bandana",
  label: "Bandana / dust mask",
  emoji: "🌪️"
}, {
  id: "kandi",
  label: "Kandi + totem (foldable)",
  emoji: "🌈"
}, {
  id: "snacks",
  label: "Snacks + gum",
  emoji: "🍭"
}];
function PackListCard() {
  var [checked, setChecked] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`${FESTIVAL_CONFIG.id}_pack_v1`) || "{}");
    } catch {
      return {};
    }
  });
  var [custom, setCustom] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("pack_custom_v1") || "[]");
    } catch {
      return [];
    }
  });
  var [draft, setDraft] = React.useState("");
  var saveChecked = next => {
    setChecked(next);
    try {
      localStorage.setItem(`${FESTIVAL_CONFIG.id}_pack_v1`, JSON.stringify(next));
    } catch {}
  };
  var saveCustom = next => {
    setCustom(next);
    try {
      localStorage.setItem("pack_custom_v1", JSON.stringify(next));
    } catch {}
  };
  var toggle = id => saveChecked({
    ...checked,
    [id]: !checked[id]
  });
  var addItem = () => {
    var label = draft.trim();
    if (!label) return;
    var id = "c_" + Date.now();
    saveCustom([...custom, {
      id,
      label,
      emoji: "📝"
    }]);
    setDraft("");
  };
  var removeCustom = id => {
    saveCustom(custom.filter(it => it.id !== id));
    var next = {
      ...checked
    };
    delete next[id];
    saveChecked(next);
  };
  var allItems = [...PACK_ITEMS, ...custom];
  var done = allItems.filter(i => checked[i.id]).length;
  var itemRow = (it, isLast, isCustom) => React.createElement("div", {
    key: it.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "11px 4px",
      borderBottom: isLast ? "none" : "1px solid var(--line)"
    }
  }, React.createElement("button", {
    onClick: () => toggle(it.id),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flex: 1,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      padding: 0
    }
  }, React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      background: checked[it.id] ? "var(--ember)" : "transparent",
      border: `1.5px solid ${checked[it.id] ? "var(--ember)" : "var(--line-2)"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
      flexShrink: 0,
      transition: "all .15s"
    }
  }, checked[it.id] ? "✓" : ""), React.createElement("span", {
    style: {
      fontSize: 14,
      opacity: 0.7,
      width: 22,
      textAlign: "center"
    }
  }, it.emoji), React.createElement("span", {
    style: {
      flex: 1,
      fontFamily: "Geist, sans-serif",
      fontSize: 14,
      color: checked[it.id] ? "var(--muted)" : "var(--ink)",
      textDecoration: checked[it.id] ? "line-through" : "none",
      transition: "color .15s"
    }
  }, it.label)), isCustom && React.createElement("button", {
    onClick: () => removeCustom(it.id),
    "aria-label": "Remove item",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "var(--muted)",
      fontSize: 16,
      lineHeight: 1,
      padding: "0 2px",
      flexShrink: 0
    }
  }, "×"));
  return React.createElement("div", {
    style: {
      marginTop: 20,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 16
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22
    }
  }, "Pack list"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: done === allItems.length ? "var(--success)" : "var(--muted)",
      fontWeight: 700
    }
  }, done, "/", allItems.length, " ", done === allItems.length && "✓")), PACK_ITEMS.map((it, i) => itemRow(it, i === allItems.length - 1 && custom.length === 0, false)), custom.map((it, i) => itemRow(it, i === custom.length - 1, true)), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTop: "1px solid var(--line)"
    }
  }, React.createElement("input", {
    type: "text",
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => e.key === "Enter" && addItem(),
    placeholder: "Add an item…",
    style: {
      flex: 1,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      padding: "9px 12px",
      fontFamily: "Geist, sans-serif",
      fontSize: 14,
      color: "var(--ink)",
      outline: "none"
    }
  }), React.createElement("button", {
    onClick: addItem,
    style: {
      background: draft.trim() ? "var(--ember)" : "var(--paper-2)",
      color: draft.trim() ? "#fff" : "var(--muted)",
      border: "none",
      borderRadius: 10,
      padding: "9px 14px",
      cursor: draft.trim() ? "pointer" : "default",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1,
      fontWeight: 700,
      transition: "all .15s"
    }
  }, "ADD")));
}
var _FESTIVAL_BADGE_PACKS = {
  "edc-lv-2026": ctx => [{
    id: "sunrise",
    icon: "☀",
    name: "Sunrise Survivor",
    desc: "Save a set running past 2 AM",
    earned: ctx.savedArtists.some(a => (window.toNightMin?.(a.start) || 0) >= 18 * 60)
  }, {
    id: "trance-fam",
    icon: "△",
    name: "Trance Family",
    desc: "Save 3+ Quantum Valley sets",
    earned: ctx.byStage("quantum") >= 3
  }, {
    id: "house-heads",
    icon: "⬡",
    name: "House Heads HQ",
    desc: "Save 3+ Neon Garden sets",
    earned: ctx.byStage("neon") >= 3
  }, {
    id: "techno-vault",
    icon: "▣",
    name: "Techno Vault",
    desc: "Save 3+ Circuit Grounds sets",
    earned: ctx.byStage("circuit") >= 3
  }, {
    id: "bass-faithful",
    icon: "◆",
    name: "Bass Faithful",
    desc: "Save 3+ Basspod or Wasteland sets",
    earned: ctx.byStage("basspod") + ctx.byStage("waste") >= 3
  }, {
    id: "thirty-years",
    icon: "✺",
    name: "30 Years Crew",
    desc: "Part of EDC's 30th year",
    earned: true
  }],
  "acl-2026": ctx => [{
    id: "closing-time",
    icon: "☾",
    name: "Closing Time",
    desc: "Save a headline-hour set (8 PM+)",
    earned: ctx.savedArtists.some(a => (window.toNightMin?.(a.start) || 0) >= 12 * 60)
  }, {
    id: "amex-front",
    icon: "△",
    name: "Amex Front Row",
    desc: "Save 3+ American Express sets",
    earned: ctx.byStage("amex") >= 3
  }, {
    id: "tmobile-faithful",
    icon: "⬡",
    name: "West Side Regular",
    desc: "Save 3+ T-Mobile Stage sets",
    earned: ctx.byStage("tmobile") >= 3
  }, {
    id: "crate-digger",
    icon: "▣",
    name: "Crate Digger",
    desc: "Save 3+ BMI or Tito's sets",
    earned: ctx.byStage("bmi") + ctx.byStage("titos") >= 3
  }, {
    id: "three-day",
    icon: "◆",
    name: "Three-Day Texan",
    desc: "Save a set on all 3 days",
    earned: new Set(ctx.savedArtists.map(a => a.day)).size >= 3
  }, {
    id: "zilker-crew",
    icon: "✺",
    name: "Zilker Crew",
    desc: "Two weekends in the park",
    earned: true
  }],
  "electric-forest-2027": ctx => [{
    id: "canopy-after-dark",
    icon: "☾",
    name: "Canopy After Dark",
    desc: "Save a set running past midnight",
    earned: ctx.savedArtists.some(a => (window.toNightMin?.(a.start) || 0) >= 24 * 60)
  }, {
    id: "ranch-hand",
    icon: "△",
    name: "Ranch Hand",
    desc: "Save 3+ Ranch Arena sets",
    earned: ctx.byStage("ranch") >= 3
  }, {
    id: "sherwood-spirit",
    icon: "⬡",
    name: "Sherwood Spirit",
    desc: "Save 3+ Sherwood Court sets",
    earned: ctx.byStage("sherwood") >= 3
  }, {
    id: "tripolee-tribe",
    icon: "▣",
    name: "Tripolee Tribe",
    desc: "Save 3+ Tripolee sets",
    earned: ctx.byStage("tripolee") >= 3
  }, {
    id: "hideout-regular",
    icon: "◆",
    name: "Hideout Regular",
    desc: "Save 3+ Honeybee Hideout or Carousel Club sets",
    earned: ctx.byStage("honeybee") + ctx.byStage("carousel") >= 3
  }, {
    id: "four-day-forester",
    icon: "✦",
    name: "Four-Day Forester",
    desc: "Save a set on all 4 days",
    earned: new Set(ctx.savedArtists.map(a => a.day)).size >= 4
  }, {
    id: "forest-family",
    icon: "✺",
    name: "Forest Family",
    desc: "Part of Forest Family 2027",
    earned: true
  }]
};
function _computeBadges(saved) {
  var ARTISTS = window.ARTISTS || [];
  var STAGES = window.STAGES || [];
  var savedArtists = (saved || []).map(id => ARTISTS.find(a => a.id === id)).filter(Boolean);
  var stageCount = new Set(savedArtists.map(a => a.stage)).size;
  var headlinerCount = savedArtists.filter(a => a.tier === 3).length;
  var byStage = stageId => savedArtists.filter(a => a.stage === stageId).length;
  var totalMin = savedArtists.reduce((acc, a) => {
    var s = window.toNightMin?.(a.start) || 0;
    var e = window.toNightMin?.(a.end) || 0;
    return acc + Math.max(0, e - s);
  }, 0);
  var nStages = STAGES.length || 9;
  var core = [{
    id: "first-save",
    icon: "✦",
    name: "First Save",
    desc: "Save your first set",
    earned: savedArtists.length >= 1
  }, {
    id: "all-stages",
    icon: "◉",
    name: `All ${nStages} Stages`,
    desc: "Save a set from every stage",
    earned: stageCount >= nStages
  }, {
    id: "five-stages",
    icon: "◍",
    name: "Five Stages",
    desc: "Save sets across 5+ stages",
    earned: stageCount >= 5
  }, {
    id: "headliner",
    icon: "★",
    name: "Headliner Hunter",
    desc: "Save 3+ headliner sets",
    earned: headlinerCount >= 3
  }, {
    id: "ten-deep",
    icon: "▤",
    name: "Ten Deep",
    desc: "10+ saved sets across the run",
    earned: savedArtists.length >= 10
  }, {
    id: "twenty-deep",
    icon: "▥",
    name: "Twenty Deep",
    desc: "20+ saved sets across the run",
    earned: savedArtists.length >= 20
  }, {
    id: "marathon",
    icon: "⌬",
    name: "Marathon",
    desc: "6+ hours of saved music",
    earned: totalMin >= 360
  }];
  var ctx = {
    savedArtists,
    byStage,
    stageCount,
    headlinerCount,
    totalMin
  };
  var pack = _FESTIVAL_BADGE_PACKS[window.FESTIVAL_CONFIG?.id];
  var flavored = pack ? pack(ctx) : window.FESTIVAL_CONFIG?.mainStageId ? [{
    id: "main-stage",
    icon: "◆",
    name: "Main Stage Regular",
    desc: "Save 3+ main-stage sets",
    earned: byStage(window.FESTIVAL_CONFIG.mainStageId) >= 3
  }] : [];
  return [...core, ...flavored];
}
function BadgesSection({
  state
}) {
  var BADGES = _computeBadges(state.saved);
  var earned = BADGES.filter(b => b.earned);
  var locked = BADGES.filter(b => !b.earned);
  var cardStyle = on => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: on ? "var(--paper-2)" : "var(--paper)",
    border: on ? "1px solid var(--line)" : "1px dashed var(--line-2)",
    opacity: on ? 1 : 0.55
  });
  var iconCircle = on => ({
    width: 36,
    height: 36,
    borderRadius: 999,
    background: on ? "linear-gradient(135deg, var(--ember), var(--horizon))" : "var(--paper-2)",
    color: on ? "#fff" : "var(--muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Instrument Serif, serif",
    fontSize: 18,
    flexShrink: 0,
    border: on ? "none" : "1px solid var(--line-2)"
  });
  return React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 8
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, "BADGES"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)"
    }
  }, earned.length, " of ", BADGES.length, " EARNED")), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, earned.map(b => React.createElement("div", {
    key: b.id,
    style: cardStyle(true)
  }, React.createElement("div", {
    style: iconCircle(true)
  }, b.icon), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      lineHeight: 1.15
    }
  }, b.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 2
    }
  }, "EARNED · ", b.desc.toUpperCase())))), locked.map(b => React.createElement("div", {
    key: b.id,
    style: cardStyle(false)
  }, React.createElement("div", {
    style: iconCircle(false)
  }, b.icon), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      lineHeight: 1.15,
      color: "var(--muted)"
    }
  }, b.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 2
    }
  }, "LOCKED · ", b.desc.toUpperCase()))))));
}
function HistoryRecordsSection({
  state,
  setState
}) {
  var [view, setView] = React.useState("history");
  var days = Object.keys(window.FESTIVAL_CONFIG?.dayDates || {}).map(Number).sort((a, b) => a - b);
  var nights = days.map(n => {
    var dayDate = window.FESTIVAL_CONFIG.dayDates[n] || {};
    var savedThisDay = (state.saved || []).map(id => window.ARTISTS.find(a => a.id === id)).filter(a => a && a.day === n);
    var totalMin = savedThisDay.reduce((acc, a) => {
      var s = window.toNightMin?.(a.start) || 0;
      var e = window.toNightMin?.(a.end) || 0;
      return acc + Math.max(0, e - s);
    }, 0);
    var stageCounts = {};
    savedThisDay.forEach(a => {
      stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1;
    });
    var topStageId = Object.keys(stageCounts).sort((x, y) => stageCounts[y] - stageCounts[x])[0];
    var topStage = topStageId ? window.STAGES.find(s => s.id === topStageId) : null;
    return {
      n,
      label: dayDate.short || `DAY ${n}`,
      name: dayDate.name || "",
      count: savedThisDay.length,
      totalMin,
      topStage,
      isPast: typeof window.NOW !== "undefined" && window.NOW.day > n,
      isLive: typeof window.NOW !== "undefined" && window.NOW.day === n
    };
  });
  var records = (() => {
    var out = [];
    var allSaved = (state.saved || []).map(id => window.ARTISTS.find(a => a.id === id)).filter(Boolean);
    if (allSaved.length === 0) return out;
    var peakNight = nights.slice().sort((a, b) => b.count - a.count)[0];
    if (peakNight && peakNight.count > 0) {
      out.push({
        label: "BUSIEST NIGHT",
        value: `${peakNight.label} · ${peakNight.count}`,
        accent: peakNight.topStage?.color || "var(--ember)"
      });
    }
    var stageAll = {};
    allSaved.forEach(a => {
      stageAll[a.stage] = (stageAll[a.stage] || 0) + 1;
    });
    var topId = Object.keys(stageAll).sort((x, y) => stageAll[y] - stageAll[x])[0];
    var topStage = topId ? window.STAGES.find(s => s.id === topId) : null;
    if (topStage) {
      out.push({
        label: "TOP STAGE",
        value: `${topStage.name.toUpperCase()} · ${stageAll[topId]}×`,
        accent: topStage.color
      });
    }
    var longest = allSaved.slice().sort((x, y) => {
      var xLen = (window.toNightMin?.(y.end) || 0) - (window.toNightMin?.(y.start) || 0);
      var yLen = (window.toNightMin?.(x.end) || 0) - (window.toNightMin?.(x.start) || 0);
      return xLen - yLen;
    })[0];
    if (longest) {
      var len = (window.toNightMin?.(longest.end) || 0) - (window.toNightMin?.(longest.start) || 0);
      if (len > 0) {
        out.push({
          label: "LONGEST SET",
          value: `${longest.name.toUpperCase()} · ${Math.floor(len / 60) ? `${Math.floor(len / 60)}H` : ""}${len % 60}M`,
          accent: window.STAGES.find(s => s.id === longest.stage)?.color || "var(--horizon)"
        });
      }
    }
    return out;
  })();
  return React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      display: "inline-flex",
      padding: 3,
      gap: 2,
      background: "var(--paper-2)",
      borderRadius: 999,
      marginBottom: 10
    }
  }, ["history", "records"].map(k => {
    var on = view === k;
    return React.createElement("button", {
      key: k,
      onClick: () => setView(k),
      className: "mono",
      style: {
        padding: "5px 12px",
        borderRadius: 999,
        border: "none",
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--paper)" : "var(--ink)",
        fontSize: 9,
        letterSpacing: 1.3,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, k.toUpperCase());
  })), view === "history" && React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, nights.map(n => React.createElement("button", {
    key: n.n,
    onClick: () => setState && setState(s => ({
      ...s,
      tab: "memories",
      memoriesNight: n.n
    })),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 12,
      background: "var(--paper-2)",
      borderLeft: `3px solid ${n.topStage?.color || "var(--line-2)"}`,
      opacity: n.count === 0 && !n.isLive ? 0.62 : 1,
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      width: "100%"
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
      lineHeight: 1.15
    }
  }, n.name || `Night ${n.n}`, n.isLive && React.createElement("span", {
    className: "mono",
    style: {
      marginLeft: 8,
      fontSize: 8,
      letterSpacing: 1.2,
      fontWeight: 800,
      color: "var(--success)",
      background: "rgba(45,122,85,0.14)",
      padding: "1px 6px",
      borderRadius: 999,
      border: "0.5px solid rgba(45,122,85,0.55)"
    }
  }, "● LIVE")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 3,
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("span", null, n.count, " ", n.count === 1 ? "SET" : "SETS"), n.totalMin > 0 && React.createElement("span", null, "· ", Math.floor(n.totalMin / 60) ? `${Math.floor(n.totalMin / 60)}H ` : "", n.totalMin % 60, "M"), n.topStage && React.createElement("span", {
    style: {
      color: n.topStage.color,
      fontWeight: 700
    }
  }, "· ", n.topStage.short || n.topStage.name.split(" ")[0].toUpperCase()))), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      color: n.isPast ? "var(--muted)" : n.isLive ? "var(--success)" : "var(--horizon)"
    }
  }, n.isPast ? "DONE" : n.isLive ? "TONIGHT" : "UPCOMING"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--muted)",
      marginLeft: 6
    }
  }, "›")))), view === "records" && React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, records.length === 0 ? React.createElement("div", {
    style: {
      padding: "18px 14px",
      borderRadius: 12,
      background: "var(--paper-2)",
      textAlign: "center"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      marginBottom: 4
    }
  }, "No records yet"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)"
    }
  }, "SAVE SETS TO UNLOCK SUPERLATIVES")) : records.map((r, i) => React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 12,
      background: "var(--paper-2)",
      borderLeft: `3px solid ${r.accent}`
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      color: "var(--muted)",
      width: 110,
      flexShrink: 0
    }
  }, r.label), React.createElement("div", {
    style: {
      fontFamily: "Geist, sans-serif",
      fontSize: 13,
      fontWeight: 500,
      flex: 1
    }
  }, r.value)))));
}
var MOMENTS_KEY = "plursky_moments_v1";
function _readMoments() {
  try {
    return JSON.parse(localStorage.getItem(MOMENTS_KEY) || "{}");
  } catch {
    return {};
  }
}
var _momentSyncTimer = null;
function _writeMoments(all) {
  localStorage.setItem(MOMENTS_KEY, JSON.stringify(all));
  try {
    window.dispatchEvent(new CustomEvent("plursky-moments-change"));
  } catch {}
  try {
    clearTimeout(_momentSyncTimer);
    _momentSyncTimer = setTimeout(() => {
      try {
        window.sbPushMoments?.()?.catch?.(() => {});
      } catch {}
    }, 2500);
  } catch {}
}
function _countMoments() {
  var all = _activeMoments(_readMoments());
  return Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
}
function _activeMoments(all) {
  var cur = window.FESTIVAL_CONFIG?.id;
  if (!cur) return all || {};
  var last = null;
  try {
    last = localStorage.getItem("plursky_last_festival_id");
  } catch {}
  var out = {};
  for (var night of Object.keys(all || {})) {
    var arr = all[night];
    if (!Array.isArray(arr)) continue;
    var kept = arr.filter(m => m && (m.festivalId ? m.festivalId === cur : !last || last === cur));
    if (kept.length) out[night] = kept;
  }
  return out;
}
var _memDbP = null;
function _openMemDB() {
  if (_memDbP) return _memDbP;
  _memDbP = new Promise((resolve, reject) => {
    var req = indexedDB.open("plursky_memories", 1);
    req.onupgradeneeded = e => {
      var db = e.target.result;
      if (!db.objectStoreNames.contains("photos")) {
        db.createObjectStore("photos", {
          keyPath: "id"
        });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
  return _memDbP;
}
async function _putPhoto(id, blob) {
  var db = await _openMemDB();
  return new Promise((resolve, reject) => {
    var tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").put({
      id,
      blob,
      createdAt: Date.now()
    });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}
async function _getPhoto(id) {
  var db = await _openMemDB();
  return new Promise((resolve, reject) => {
    var tx = db.transaction("photos", "readonly");
    var r = tx.objectStore("photos").get(id);
    r.onsuccess = () => resolve(r.result?.blob || null);
    r.onerror = e => reject(e.target.error);
  });
}
async function _deletePhoto(id) {
  var db = await _openMemDB();
  return new Promise((resolve, reject) => {
    var tx = db.transaction("photos", "readwrite");
    tx.objectStore("photos").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}
function _compressMomentImage(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.onload = e => {
      var img = new Image();
      img.onload = () => {
        var maxEdge = 720;
        var scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);else reject(new Error("blob conversion failed"));
        }, "image/jpeg", 0.78);
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}
var _MAX_VIDEO_BYTES = 200 * 1024 * 1024;
function _videoDuration(blob) {
  return new Promise(resolve => {
    try {
      var url = URL.createObjectURL(blob);
      var v = document.createElement("video");
      v.preload = "metadata";
      var done = d => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        resolve(Number.isFinite(d) && d > 0 ? d : null);
      };
      v.onloadedmetadata = () => done(v.duration);
      v.onerror = () => done(null);
      v.src = url;
    } catch {
      resolve(null);
    }
  });
}
async function _processMomentMedia(file) {
  if (/^image\//.test(file.type)) {
    return {
      blob: await _compressMomentImage(file),
      kind: "image"
    };
  }
  if (/^video\//.test(file.type)) {
    if (file.size > _MAX_VIDEO_BYTES) {
      throw new Error(`Video too large (${Math.round(file.size / 1048576)} MB > 200 MB cap)`);
    }
    var duration = await _videoDuration(file);
    return {
      blob: file,
      kind: "video",
      duration
    };
  }
  throw new Error("Unsupported file type: " + file.type);
}
function _metaFromFile(file, exifMeta) {
  var out = {
    date: exifMeta?.date || null,
    lat: exifMeta?.lat ?? null,
    lng: exifMeta?.lng ?? null,
    takenAtSource: exifMeta?.timestampSource || (exifMeta?.date ? /^video\//.test(file?.type || "") ? "video" : "exif" : "none"),
    locationSource: exifMeta?.locationSource || (exifMeta?.lat != null && exifMeta?.lng != null ? /^video\//.test(file?.type || "") ? "video-gps" : "exif-gps" : "none")
  };
  if (!out.date) {
    var fileDate = _parseFilenameDate(file?.name);
    if (fileDate) {
      out.date = fileDate;
      out.takenAtSource = "filename";
    }
  }
  if (!out.date && file?.lastModified) {
    var ageMs = Date.now() - file.lastModified;
    if (ageMs >= 30 * 1000) {
      var d = new Date(file.lastModified);
      var _fileDate = {
        yr: d.getFullYear(),
        mo: d.getMonth() + 1,
        dy: d.getDate(),
        hh: d.getHours(),
        mm: d.getMinutes(),
        ss: d.getSeconds()
      };
      if (_anyFestivalNight(_fileDate) != null) {
        out.date = _fileDate;
        out.takenAtSource = "file-lastModified";
      }
    }
  }
  if (out.date && file?.lastModified) {
    var capMs = new Date(out.date.yr, out.date.mo - 1, out.date.dy, out.date.hh, out.date.mm, out.date.ss || 0).getTime();
    var deltaMs = Math.abs(capMs - file.lastModified);
    if (isFinite(deltaMs) && deltaMs <= _DATE_UNVERIFIED_WINDOW_MS) {
      out.dateUnverified = true;
      out.dateUnverifiedDeltaS = Math.round(deltaMs / 1000);
    }
  }
  return out;
}
function _momentTakenAtToDateParts(takenAt) {
  var m = String(takenAt || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return {
    yr: +m[1],
    mo: +m[2],
    dy: +m[3],
    hh: +m[4],
    mm: +m[5],
    ss: +(m[6] || 0)
  };
}
function _momentDatePartsToTakenAt(date) {
  if (!date) return null;
  return `${date.yr}-${String(date.mo).padStart(2, "0")}-${String(date.dy).padStart(2, "0")} ${String(date.hh).padStart(2, "0")}:${String(date.mm).padStart(2, "0")}`;
}
function _mediaFingerprintParts(fp) {
  var parts = String(fp || "").split("_");
  if (parts.length < 3) return null;
  var size = parts[1];
  var basename = parts.slice(2).join("_").toLowerCase();
  if (!/^\d+$/.test(size) || !basename) return null;
  return {
    size,
    basename
  };
}
function _findArchivedVideoMomentForFingerprint(fp) {
  var cur = window.FESTIVAL_CONFIG?.id;
  if (!cur || !fp) return null;
  var target = _mediaFingerprintParts(fp);
  if (!target) return null;
  try {
    var archive = JSON.parse(localStorage.getItem("plursky_festival_archive_v1") || "{}");
    var archivedMoments = archive?.[cur]?.moments || {};
    var matches = [];
    for (var arr of Object.values(archivedMoments)) {
      if (!Array.isArray(arr)) continue;
      for (var m of arr) {
        if (!m || m.kind !== "video" || !m.takenAt) continue;
        var parts = _mediaFingerprintParts(m._fingerprint);
        if (parts && parts.size === target.size && parts.basename === target.basename) matches.push(m);
      }
    }
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}
function _recoverVideoMetaFromArchive(file, fp, meta) {
  if (!/^video\//.test(file?.type || "")) return null;
  var archiveMoment = _findArchivedVideoMomentForFingerprint(fp);
  var recoveredDate = _momentTakenAtToDateParts(archiveMoment?.takenAt);
  if (!archiveMoment || !recoveredDate) return null;
  var parsedNight = meta?.date || meta?.rawUtcMs != null ? _anyFestivalNight(meta.date, meta.rawUtcMs)?.night ?? null : null;
  if (parsedNight != null && meta?.takenAtSource !== "file-lastModified" && meta?.takenAtSource !== "none") return null;
  return {
    meta: {
      ...(meta || {}),
      date: recoveredDate,
      takenAtSource: "archive-recovered"
    },
    moment: archiveMoment
  };
}
function _fmtMomentTime(ts) {
  var d = new Date(ts);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}
function useMomentPhoto(photoId, enabled = true) {
  var [url, setUrl] = React.useState(null);
  React.useEffect(() => {
    if (!photoId || !enabled) {
      setUrl(null);
      return;
    }
    var cancelled = false;
    var objectUrl = null;
    _getPhoto(photoId).then(async blob => {
      if (cancelled) return;
      if (!blob && typeof window.sbDownloadMomentMedia === "function") {
        try {
          var cloud = await window.sbDownloadMomentMedia(photoId);
          if (cancelled) return;
          if (cloud) {
            try {
              await _putPhoto(photoId, cloud);
            } catch {}
            blob = cloud;
          }
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
function useNearViewport(rootMargin = "600px 0px") {
  var ref = React.useRef(null);
  var [near, setNear] = React.useState(false);
  React.useEffect(() => {
    var el = ref.current;
    if (!el) return;
    if (!window.IntersectionObserver) {
      setNear(true);
      return;
    }
    var obs = new IntersectionObserver(entries => {
      setNear(entries[entries.length - 1].isIntersecting);
    }, {
      rootMargin
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return [ref, near];
}
function _onWifi() {
  try {
    var c = navigator.connection;
    if (c && c.type && !["wifi", "ethernet", "unknown"].includes(c.type)) return false;
  } catch {}
  return true;
}
var _BACKUP_SOFT_CAP = 1024 * 1024 * 1024;
var _BACKUP_HARD_CAP = 2 * 1024 * 1024 * 1024;
function _autoBackupOn() {
  try {
    return localStorage.getItem("plursky_autobackup") !== "0";
  } catch {
    return true;
  }
}
function _setAutoBackup(v) {
  try {
    localStorage.setItem("plursky_autobackup", v ? "1" : "0");
  } catch {}
}
function _fmtSize(b) {
  if (!b) return "0 MB";
  var mb = b / 1048576;
  return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.max(1, Math.round(mb)) + " MB";
}
function _backedUpBytes(all) {
  var b = 0;
  for (var n of Object.keys(all)) for (var m of all[n] || []) if (m.backedUp) b += m.backedUpBytes || 0;
  return b;
}
async function _backupMyWeekend(onProgress) {
  if (typeof window.sbUploadMomentMedia !== "function") return {
    error: "offline"
  };
  var user = window.sbGetUser ? await window.sbGetUser() : null;
  if (!user) return {
    error: "signin"
  };
  var all = _readMoments();
  var usedBytes = _backedUpBytes(all);
  var pending = [];
  for (var n of Object.keys(all)) for (var m of all[n] || []) {
    if (m.photoId && !m.backedUp) pending.push(m);
  }
  var done = 0,
    failed = 0,
    capped = false;
  var succeeded = {};
  for (var _m of pending) {
    var blob = await _getPhoto(_m.photoId).catch(() => null);
    if (!blob) {
      failed++;
      onProgress?.({
        done,
        failed,
        total: pending.length
      });
      continue;
    }
    if (usedBytes + blob.size > _BACKUP_HARD_CAP) {
      capped = true;
      break;
    }
    var ok = await window.sbUploadMomentMedia(_m.photoId, blob);
    if (ok) {
      succeeded[_m.id] = blob.size;
      usedBytes += blob.size;
      done++;
    } else failed++;
    onProgress?.({
      done,
      failed,
      total: pending.length
    });
  }
  var ids = Object.keys(succeeded);
  if (ids.length) {
    var cur = _readMoments();
    for (var _n of Object.keys(cur)) cur[_n] = (cur[_n] || []).map(x => succeeded[x.id] != null ? {
      ...x,
      backedUp: true,
      backedUpBytes: succeeded[x.id]
    } : x);
    _writeMoments(cur);
  }
  return {
    done,
    failed,
    total: pending.length,
    capped,
    usedBytes
  };
}
function _HomeMemoryThumb({
  moment,
  onClick
}) {
  var url = useMomentPhoto(moment.photoId);
  var artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  return React.createElement("button", {
    onClick: onClick,
    style: {
      flexShrink: 0,
      width: 96,
      height: 128,
      borderRadius: 14,
      border: "1px solid var(--line)",
      overflow: "hidden",
      position: "relative",
      background: url ? "#000" : "var(--paper-2)",
      cursor: "pointer",
      padding: 0
    }
  }, url ? moment.kind === "video" ? React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none"
    }
  }) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : React.createElement("div", {
    className: "skel",
    style: {
      width: "100%",
      height: "100%"
    }
  }), moment.kind === "video" && React.createElement(_VideoBadge, {
    seconds: moment.duration,
    style: {
      position: "absolute",
      top: 6,
      right: 6
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent)",
      padding: "16px 8px 7px"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.6,
      color: "#fff",
      fontWeight: 700,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, artist ? artist.name.toUpperCase() : "NIGHT " + moment.night)));
}
function _readRecapSeen() {
  try {
    return JSON.parse(localStorage.getItem("plursky_recap_seen_v1") || "{}");
  } catch {
    return {};
  }
}
function _markRecapSeen(night, count) {
  try {
    var m = _readRecapSeen();
    m[night] = count;
    localStorage.setItem("plursky_recap_seen_v1", JSON.stringify(m));
  } catch {}
}
function HomeMemoriesStrip({
  state,
  setState
}) {
  var [rawAll, setAll] = React.useState(() => {
    try {
      return _readMoments();
    } catch {
      return {};
    }
  });
  var all = React.useMemo(() => _activeMoments(rawAll), [rawAll]);
  var [reel, setReel] = React.useState(null);
  React.useEffect(() => {
    var refresh = () => {
      try {
        setAll(_readMoments());
      } catch {}
    };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  var recent = React.useMemo(() => {
    var flat = [];
    Object.values(all).forEach(arr => {
      if (Array.isArray(arr)) flat.push(...arr);
    });
    return flat.filter(m => m.photoId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
  }, [all]);
  var reelData = React.useMemo(() => {
    if (!recent.length) return null;
    var night = recent[0].night || NOW.day || 1;
    var ms = (all[night] || []).filter(m => m.photoId).sort((a, b) => {
      var ta = a.takenAt || "",
        tb = b.takenAt || "";
      if (ta && tb) return ta.localeCompare(tb);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    var DAYS = window.DAYS || [];
    var dm = DAYS.find(d => d.n === night);
    var label = dm ? dm.label.charAt(0) + dm.label.slice(1).toLowerCase() + " night" : `Night ${night}`;
    return {
      moments: ms,
      label,
      night
    };
  }, [all, recent]);
  var [seen, setSeen] = React.useState(_readRecapSeen);
  var recapReady = React.useMemo(() => {
    if (!reelData || reelData.moments.length < 3) return null;
    if (reelData.moments.length <= (seen[reelData.night] || 0)) return null;
    return reelData;
  }, [reelData, seen]);
  var playRecap = data => {
    _markRecapSeen(data.night, data.moments.length);
    setSeen(_readRecapSeen());
    setReel(data);
  };
  var dismissRecap = () => {
    if (recapReady) {
      _markRecapSeen(recapReady.night, recapReady.moments.length);
      setSeen(_readRecapSeen());
    }
  };
  var HIGHLIGHT_CAP = 6;
  var highlightReel = React.useMemo(() => {
    if (!recapReady) return null;
    var best = recapReady.moments.slice().sort((a, b) => _heroScore(b) - _heroScore(a)).slice(0, HIGHLIGHT_CAP).sort((a, b) => {
      var ta = a.takenAt || "",
        tb = b.takenAt || "";
      return ta && tb ? ta.localeCompare(tb) : (a.createdAt || 0) - (b.createdAt || 0);
    });
    return {
      ...recapReady,
      moments: best
    };
  }, [recapReady]);
  var morningAfter = (() => {
    try {
      var h = parseInt((window.NOW?.time || "").split(":")[0], 10);
      return h >= 4 && h <= 15;
    } catch {
      return false;
    }
  })();
  var playHighlights = () => {
    if (!recapReady || !highlightReel) return;
    _markRecapSeen(recapReady.night, recapReady.moments.length);
    setSeen(_readRecapSeen());
    setReel(highlightReel);
  };
  if (recent.length === 0) return null;
  var total = recent.length;
  var go = night => (window._pushNav || (n => setState({
    ...state,
    ...n
  })))({
    tab: "memories",
    memoriesNight: night,
    artist: null
  });
  var canRecap = reelData && reelData.moments.length >= 2;
  return React.createElement("div", {
    "data-animate": true,
    style: {
      marginTop: 22
    }
  }, reel && React.createElement(MemoryReel, {
    moments: reel.moments,
    nightLabel: reel.label,
    night: reel.night,
    festival: window.FESTIVAL_CONFIG?.shortName || window.FESTIVAL_CONFIG?.name || "",
    onClose: () => setReel(null),
    onOpenArtist: id => setState({
      ...state,
      tab: "lineup",
      artist: id
    }),
    onMakeVideo: () => setState({
      ...state,
      tab: "recap",
      artist: null
    })
  }), recapReady && (() => {
    var clips = (highlightReel || recapReady).moments;
    var vids = clips.filter(m => m.kind === "video").length;
    return React.createElement("button", {
      onClick: playHighlights,
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 14px",
        marginBottom: 14,
        borderRadius: 16,
        cursor: "pointer",
        border: "none",
        textAlign: "left",
        background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
        boxShadow: "0 6px 20px rgba(232,93,46,0.28)"
      }
    }, React.createElement("span", {
      style: {
        width: 42,
        height: 42,
        flexShrink: 0,
        borderRadius: 999,
        background: "rgba(255,255,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        color: "#fff"
      }
    }, "▶"), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      className: "mono",
      style: {
        display: "block",
        fontSize: 8.5,
        letterSpacing: 1.4,
        fontWeight: 800,
        color: "rgba(255,255,255,0.8)"
      }
    }, morningAfter ? "LAST NIGHT IN 15s" : "RECAP READY"), React.createElement("span", {
      className: "serif",
      style: {
        display: "block",
        fontSize: 18,
        lineHeight: 1.1,
        color: "#fff",
        marginTop: 1
      }
    }, morningAfter ? `Your ${recapReady.label}, recapped` : `Your ${recapReady.label}`), React.createElement("span", {
      className: "mono",
      style: {
        display: "block",
        fontSize: 9,
        letterSpacing: 0.6,
        color: "rgba(255,255,255,0.78)",
        marginTop: 3,
        fontWeight: 600
      }
    }, clips.length, " BEST ", clips.length === 1 ? "CLIP" : "CLIPS", vids ? ` · ${vids} VIDEO${vids === 1 ? "" : "S"}` : "", " · TAP TO PLAY")), React.createElement("span", {
      onClick: e => {
        e.stopPropagation();
        dismissRecap();
      },
      role: "button",
      "aria-label": "Dismiss",
      style: {
        flexShrink: 0,
        width: 26,
        height: 26,
        borderRadius: 999,
        background: "rgba(0,0,0,0.18)",
        color: "#fff",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    }, "✕"));
  })(), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 10
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22
    }
  }, "Your ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "memories")), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, canRecap && React.createElement("button", {
    onClick: () => playRecap(reelData),
    className: "mono",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
      border: "none",
      borderRadius: 999,
      padding: "5px 11px",
      color: "#fff",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10
    }
  }, "▶"), " PLAY"), React.createElement("button", {
    onClick: () => go(NOW.day),
    className: "mono",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "SEE ALL →"))), React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      scrollbarWidth: "none",
      marginRight: -16,
      paddingRight: 16
    }
  }, recent.map(m => React.createElement(_HomeMemoryThumb, {
    key: m.id,
    moment: m,
    onClick: () => go(m.night || NOW.day)
  }))));
}
var _setlistCache = {};
async function _getSupabaseTracklist(artistName) {
  try {
    var festId = window.FESTIVAL_CONFIG?.id || "edc-lv-2026";
    var url = `https://pzoijbqsbbwyuyjinjtj.supabase.co/rest/v1/tracklists?artist_name=eq.${encodeURIComponent(artistName)}&festival_id=eq.${encodeURIComponent(festId)}&select=tracks,source,source_url`;
    var res = await fetch(url, {
      headers: {
        "apikey": window.SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6b2lqYnFzYmJ3eXV5amluanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU3NzkwNDUsImV4cCI6MjAzMTM1NTA0NX0.aYMVriNmLAlkCN4DI1HGrj7VH9MNUxbYg8I1kpGl3Ow",
        "Accept": "application/json"
      }
    });
    if (!res.ok) return null;
    var rows = await res.json();
    if (!rows?.length || !rows[0].tracks?.length) return null;
    return {
      source: rows[0].source || "1001tracklists",
      tracks: rows[0].tracks,
      url: rows[0].source_url
    };
  } catch {
    return null;
  }
}
async function _getSetlistFmData(artistName) {
  try {
    var setlists = await window.fetchSetlists?.(artistName);
    if (!setlists?.length) return null;
    var festBrand = (window.FESTIVAL_CONFIG?.brand || "").toLowerCase();
    var festSetlist = setlists.find(sl => {
      var v = (sl.venue?.name || "").toLowerCase();
      return v.includes(festBrand) || v.includes("electric daisy") || v.includes("motor speedway") || v.includes("zilker") || v.includes("austin city");
    });
    var target = festSetlist || setlists[0];
    var songs = (target.sets?.set || []).flatMap(s => (s.song || []).map(song => song.name)).filter(Boolean);
    if (!songs.length) return null;
    return {
      source: "setlist.fm",
      songs,
      venue: target.venue?.name
    };
  } catch {
    return null;
  }
}
async function _getTracklistForArtist(artistName) {
  var key = artistName.toLowerCase().replace(/\W+/g, "_");
  if (_setlistCache[key]) return _setlistCache[key];
  var tl = await _getSupabaseTracklist(artistName);
  if (tl) {
    _setlistCache[key] = tl;
    return tl;
  }
  var sl = await _getSetlistFmData(artistName);
  if (sl) {
    _setlistCache[key] = sl;
    return sl;
  }
  _setlistCache[key] = null;
  return null;
}
function _matchSongAtTime(artist, trackData, photoTakenAt) {
  if (!photoTakenAt || !artist) return null;
  var CFG = window.FESTIVAL_CONFIG || {};
  var dm = CFG.dayDates?.[artist.day];
  if (!dm) return null;
  var [sh, sm] = artist.start.split(":").map(Number);
  var setStartMs = dm.midnightUtc + (sh < 8 ? sh + 24 : sh) * 3600000 + sm * 60000;
  var photoMs = Date.parse(photoTakenAt.replace(" ", "T"));
  if (isNaN(photoMs)) return null;
  var elapsedMs = photoMs - setStartMs;
  if (elapsedMs < 0) return null;
  if (trackData.source === "1001tracklists" && trackData.tracks?.length) {
    var matched = trackData.tracks[0];
    for (var t of trackData.tracks) {
      if (t.timeMs <= elapsedMs) matched = t;else break;
    }
    var display = matched.artist ? `${matched.artist} — ${matched.title}` : matched.title;
    return {
      song: display,
      source: "1001tracklists",
      confidence: "exact",
      url: trackData.url
    };
  }
  if (trackData.source === "setlist.fm" && trackData.songs?.length) {
    var [eh, em] = artist.end.split(":").map(Number);
    var setEndMs = dm.midnightUtc + (eh < 8 ? eh + 24 : eh) * 3600000 + em * 60000;
    var setDuration = setEndMs - setStartMs;
    if (setDuration <= 0 || elapsedMs > setDuration) return null;
    var idx = Math.min(Math.floor(elapsedMs / setDuration * trackData.songs.length), trackData.songs.length - 1);
    return {
      song: trackData.songs[idx],
      source: "setlist.fm",
      confidence: "estimated"
    };
  }
  return null;
}
function useSetlistSong(artist, takenAt) {
  var [result, setResult] = React.useState(null);
  React.useEffect(() => {
    if (!artist || !takenAt) return;
    var cancelled = false;
    _getTracklistForArtist(artist.name).then(data => {
      if (cancelled || !data) return;
      var r = _matchSongAtTime(artist, data, takenAt);
      if (r) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [artist?.id, takenAt]);
  return result;
}
var _DATE_UNVERIFIED_WINDOW_MS = 2 * 60 * 1000;
var _TAG_SOURCE_LABEL = {
  exif: {
    text: "AUTO · EXIF",
    tone: "ok"
  },
  filetime: {
    text: "AUTO · FILE TIME",
    tone: "ok"
  },
  "exif-night-only": {
    text: "EXIF NIGHT · PICK A SET",
    tone: "warn"
  },
  "filetime-night-only": {
    text: "FILE TIME · PICK A SET",
    tone: "warn"
  },
  off_stage: {
    text: "📍 BETWEEN SETS",
    tone: "info"
  },
  "stage-neighbor": {
    text: "NEARBY SET · VERIFY",
    tone: "warn"
  },
  fallback: {
    text: "FALLBACK · RETAG",
    tone: "warn"
  },
  "song-recovered": {
    text: "RECOVERED · SONG",
    tone: "ok"
  },
  manual: {
    text: "MANUAL",
    tone: "ok"
  }
};
function _momentCaptureMs(m) {
  if (m.takenAt) {
    var t = Date.parse(m.takenAt.replace(" ", "T"));
    if (!isNaN(t)) return t;
  }
  return m.createdAt || 0;
}
function _siblingSuggestionFor(moment, allMoments) {
  if (moment.artistId) return null;
  var nightMoments = allMoments[moment.night] || [];
  var myTime = _momentCaptureMs(moment);
  if (!myTime) return null;
  var WINDOW_MS = 30 * 60 * 1000;
  var counts = new Map();
  for (var m of nightMoments) {
    if (!m.artistId || m.id === moment.id) continue;
    var theirTime = _momentCaptureMs(m);
    if (!theirTime) continue;
    if (Math.abs(theirTime - myTime) > WINDOW_MS) continue;
    counts.set(m.artistId, (counts.get(m.artistId) || 0) + 1);
  }
  if (counts.size === 0) return null;
  var bestId = null,
    bestCount = 0;
  for (var [id, n] of counts) {
    if (n > bestCount) {
      bestId = id;
      bestCount = n;
    }
  }
  return {
    artistId: bestId,
    count: bestCount
  };
}
function BulkRetagRow({
  moments,
  savedNightArtists,
  onUpdate
}) {
  var [confirmId, setConfirmId] = React.useState(null);
  var apply = artistId => {
    try {
      window.plurskyHaptic?.("MEDIUM");
    } catch {}
    for (var m of moments) {
      onUpdate?.(m, {
        artistId,
        tagSource: "manual",
        autoTagged: false
      });
    }
    setConfirmId(null);
  };
  return React.createElement("div", {
    style: {
      margin: "8px 0 10px",
      padding: "9px 10px",
      background: "var(--paper-2)",
      border: "1px dashed var(--line-2)",
      borderRadius: 10
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 6
    }
  }, "⚡ BULK · TAG ALL ", moments.length, " AS"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, savedNightArtists.slice().sort((a, b) => (a.start || "").localeCompare(b.start || "")).map(a => {
    var stage = STAGES.find(s => s.id === a.stage);
    var isConfirming = confirmId === a.id;
    return React.createElement("button", {
      key: a.id,
      onClick: () => isConfirming ? apply(a.id) : setConfirmId(a.id),
      className: "mono",
      style: {
        padding: "5px 10px",
        borderRadius: 999,
        background: isConfirming ? "var(--ember)" : stage ? `${stage.color}18` : "var(--paper)",
        color: isConfirming ? "#fff" : stage ? stage.color : "var(--ink)",
        border: isConfirming ? "none" : stage ? `1px solid ${stage.color}40` : "1px solid var(--line-2)",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, isConfirming ? `TAP AGAIN TO TAG ${moments.length}` : a.name.toUpperCase());
  }), confirmId && React.createElement("button", {
    onClick: () => setConfirmId(null),
    className: "mono",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      padding: "5px 8px"
    }
  }, "CANCEL")));
}
function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();
    fr.onload = () => {
      var s = String(fr.result);
      var i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
async function identifySongFromVideo(moment, onProgress) {
  if (!moment?.photoId || moment.kind !== "video") return null;
  var blob = await _getPhoto(moment.photoId).catch(() => null);
  if (!blob) return null;
  if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin) {
    try {
      onProgress?.("listening");
      if (moment.nativePath && window.ShazamPlugin.identifyFile) {
        onProgress?.("matching");
        var _r = await window.ShazamPlugin.identifyFile({
          path: moment.nativePath
        });
        if (_r?.matched && _r.title) return {
          title: _r.title,
          artist: _r.artist || "",
          source: "video-shazam"
        };
        return null;
      }
      if (!window.ShazamPlugin.identifyBase64) return null;
      var base64 = await _blobToBase64(blob);
      var ext = (blob.type || "").includes("quicktime") ? "mov" : "mp4";
      onProgress?.("matching");
      var r = await window.ShazamPlugin.identifyBase64({
        data: base64,
        ext
      });
      if (r?.matched && r.title) return {
        title: r.title,
        artist: r.artist || "",
        source: "video-shazam"
      };
      return null;
    } catch {
      return null;
    }
  }
  return null;
}
function _soleSlotForArtist(artistId) {
  if (!artistId) return null;
  var all = typeof ARTISTS !== "undefined" ? ARTISTS : window.ARTISTS || [];
  var slots = all.filter(a => a.id === artistId);
  return slots.length === 1 ? slots[0] : null;
}
function _lineupArtistsFromShazam(shazamArtist) {
  if (!shazamArtist) return [];
  var norm = String(shazamArtist).toLowerCase().trim();
  var all = typeof ARTISTS !== "undefined" ? ARTISTS : window.ARTISTS || [];
  var seen = new Set(),
    out = [];
  for (var a of all) {
    var an = String(a.name || "").toLowerCase();
    if (!an) continue;
    if (an === norm || an.includes(norm) || norm.includes(an.split(/ b2b /i)[0])) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}
function _slotsForShazamArtist(shazamArtist) {
  var out = [];
  var _loop2 = function (a) {
    var all = typeof ARTISTS !== "undefined" ? ARTISTS : window.ARTISTS || [];
    for (var slot of all.filter(x => x.id === a.id)) out.push(slot);
  };
  for (var a of _lineupArtistsFromShazam(shazamArtist)) {
    _loop2(a);
  }
  return out;
}
function _songRecoveryFor(moment, matchedArtist, shazamArtistRaw) {
  if (!moment || !matchedArtist) return null;
  if (!moment.dateUnverified && moment.tagSource !== "fallback") return null;
  var slots = shazamArtistRaw ? _slotsForShazamArtist(shazamArtistRaw) : _soleSlotForArtist(matchedArtist.id) ? [_soleSlotForArtist(matchedArtist.id)] : [];
  if (slots.length !== 1) return null;
  var slot = slots[0];
  if (!slot || slot.day == null) return null;
  if (String(slot.day) === String(moment.night) && moment.artistId === slot.id) return null;
  var name = (typeof ARTISTS !== "undefined" ? ARTISTS : window.ARTISTS || []).find(a => a.id === slot.id)?.name || matchedArtist.name;
  return {
    artistId: slot.id,
    night: slot.day,
    stage: slot.stage,
    name
  };
}
function _lineupArtistFromShazam(shazamArtist) {
  if (!shazamArtist) return null;
  var norm = shazamArtist.toLowerCase().trim();
  return ARTISTS.find(a => {
    var an = a.name.toLowerCase();
    return an === norm || an.includes(norm) || norm.includes(an.split(/ b2b /i)[0]);
  }) || null;
}
function _FavStar({
  favorite,
  onToggle,
  tone
}) {
  var dark = tone === "dark";
  return React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      try {
        window.plurskyHaptic?.(favorite ? "LIGHT" : "MEDIUM");
      } catch {}
      onToggle?.(!favorite);
    },
    "aria-label": favorite ? "Remove from favorites" : "Mark as favorite",
    "aria-pressed": favorite,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      cursor: "pointer",
      lineHeight: 1,
      background: dark ? "rgba(255,255,255,0.14)" : "transparent",
      width: dark ? 36 : "auto",
      height: dark ? 36 : "auto",
      borderRadius: dark ? 36 : 999,
      padding: dark ? 0 : "3px 5px",
      fontSize: dark ? 17 : 13,
      color: favorite ? "#f5c451" : dark ? "rgba(255,255,255,0.7)" : "var(--muted)",
      transition: "color .15s ease, transform .15s ease",
      transform: favorite ? "scale(1.06)" : "scale(1)"
    }
  }, favorite ? "★" : "☆");
}
function _FavBadge({
  style
}) {
  return React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 20,
      height: 20,
      borderRadius: 20,
      fontSize: 11,
      lineHeight: 1,
      background: "rgba(0,0,0,0.5)",
      color: "#f5c451",
      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
      pointerEvents: "none",
      ...style
    }
  }, "★");
}
function MomentLightbox({
  moments,
  index,
  onClose,
  onIndexChange,
  onArtistClick,
  onUpdate,
  onRecoverNight
}) {
  var m = moments[index];
  var photoUrl = useMomentPhoto(m?.photoId);
  var artist = m?.artistId ? ARTISTS.find(a => a.id === m.artistId) : null;
  var stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  var estimatedSong = useSetlistSong(artist, m?.takenAt);
  var song = m?.confirmedSong ? {
    song: m.confirmedSong
  } : estimatedSong;
  var touch = React.useRef({
    x: 0
  });
  var [idState, setIdState] = React.useState("idle");
  var [mismatch, setMismatch] = React.useState(null);
  var [recovery, setRecovery] = React.useState(null);
  var [sharing, setSharing] = React.useState(false);
  var [retagging, setRetagging] = React.useState(false);
  var [retagQuery, setRetagQuery] = React.useState("");
  React.useEffect(() => {
    setIdState("idle");
    setMismatch(null);
    setRecovery(null);
    setRetagging(false);
    setRetagQuery("");
  }, [index]);
  var retagOptions = React.useMemo(() => {
    var q = retagQuery.trim().toLowerCase();
    if (q) {
      return ARTISTS.filter(a => a.name.toLowerCase().includes(q)).slice(0, 24);
    }
    if (!m) return [];
    var hhmm = (m.takenAt?.split(" ")[1] || "").slice(0, 5);
    var t = hhmm ? toNightMin(hhmm) : null;
    var night = m.night || NOW.day;
    var all = ARTISTS.filter(a => a.day === night);
    var playing = t != null ? all.filter(a => toNightMin(a.start) <= t && t < toNightMin(a.end)) : [];
    return (playing.length ? playing : all).slice().sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
  }, [m, retagQuery]);
  var runIdentify = async () => {
    setIdState("listening");
    var result = await identifySongFromVideo(m, p => setIdState(p));
    if (!result) {
      setIdState("fail");
      setTimeout(() => setIdState("idle"), 2500);
      return;
    }
    setIdState("done");
    var confirmed = result.artist ? `${result.artist} — ${result.title}` : result.title;
    onUpdate?.(m, {
      confirmedSong: confirmed,
      confirmedTitle: result.title,
      confirmedArtist: result.artist || "",
      songSource: "video-shazam"
    });
    var matchedArtist = _lineupArtistFromShazam(result.artist);
    var creditIsAmbiguous = _lineupArtistsFromShazam(result.artist).length > 1;
    if (matchedArtist && !creditIsAmbiguous && matchedArtist.id !== m.artistId && matchedArtist.day === m.night) {
      setMismatch(matchedArtist);
    } else if (matchedArtist && onRecoverNight) {
      var rec = _songRecoveryFor(m, matchedArtist, result.artist);
      if (rec) setRecovery(rec);
    }
    var heardId = matchedArtist?.id || m.artistId;
    if (heardId && m.night != null && typeof markAttended === "function") {
      try {
        markAttended(m.night, heardId, "shazam");
      } catch {}
    }
    try {
      window.plurskyHaptic?.("MEDIUM");
    } catch {}
  };
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < moments.length - 1) onIndexChange(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, moments.length]);
  if (!m) return null;
  var prettyTime = (() => {
    if (!m.takenAt) return null;
    try {
      var t = m.takenAt.split(" ")[1] || "";
      var [h, mm] = t.split(":").map(Number);
      var ap = h >= 12 ? "PM" : "AM";
      var h12 = h % 12 || 12;
      return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
    } catch {
      return null;
    }
  })();
  var onTouchStart = e => {
    touch.current.x = e.touches[0].clientX;
  };
  var onTouchEnd = e => {
    var dx = e.changedTouches[0].clientX - touch.current.x;
    if (dx < -50 && index < moments.length - 1) onIndexChange(index + 1);
    if (dx > 50 && index > 0) onIndexChange(index - 1);
  };
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: "#000",
      display: "flex",
      flexDirection: "column",
      animation: "fadeIn .2s",
      paddingTop: "env(safe-area-inset-top, 0px)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      flexShrink: 0
    }
  }, React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      width: 36,
      height: 36,
      borderRadius: 36,
      border: "none",
      background: "rgba(255,255,255,0.14)",
      color: "#fff",
      fontSize: 18,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "✕"), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: "rgba(255,255,255,0.7)",
      fontWeight: 700
    }
  }, index + 1, " / ", moments.length), onUpdate && React.createElement(_FavStar, {
    favorite: !!m.favorite,
    tone: "dark",
    onToggle: v => onUpdate(m, {
      favorite: v
    })
  }))), React.createElement("div", {
    onTouchStart: onTouchStart,
    onTouchEnd: onTouchEnd,
    style: {
      flex: 1,
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden"
    }
  }, photoUrl ? m.kind === "video" ? React.createElement(_LightboxVideo, {
    key: m.id,
    src: photoUrl
  }) : React.createElement("img", {
    src: photoUrl,
    alt: "",
    style: {
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain"
    }
  }) : React.createElement("div", {
    className: "skel-dark",
    style: {
      width: "80%",
      height: "60%",
      borderRadius: 12
    }
  }), index > 0 && React.createElement("button", {
    onClick: () => onIndexChange(index - 1),
    "aria-label": "Previous",
    style: {
      position: "absolute",
      left: 10,
      top: "50%",
      transform: "translateY(-50%)",
      width: 40,
      height: 40,
      borderRadius: 40,
      zIndex: 3,
      background: "rgba(255,255,255,0.16)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      border: "none",
      cursor: "pointer",
      color: "#fff",
      fontSize: 22,
      lineHeight: 1,
      paddingBottom: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "‹"), index < moments.length - 1 && React.createElement("button", {
    onClick: () => onIndexChange(index + 1),
    "aria-label": "Next",
    style: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      width: 40,
      height: 40,
      borderRadius: 40,
      zIndex: 3,
      background: "rgba(255,255,255,0.16)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      border: "none",
      cursor: "pointer",
      color: "#fff",
      fontSize: 22,
      lineHeight: 1,
      paddingBottom: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "›")), React.createElement("div", {
    style: {
      padding: "16px 20px calc(20px + env(safe-area-inset-bottom, 0px))",
      flexShrink: 0
    }
  }, artist ? React.createElement("button", {
    onClick: () => {
      onArtistClick?.(artist.id);
      onClose();
    },
    style: {
      background: "transparent",
      border: "none",
      padding: 0,
      textAlign: "left",
      cursor: "pointer",
      display: "block"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 26,
      lineHeight: 1,
      color: "#fff",
      marginBottom: 6
    }
  }, artist.name)) : React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1,
      color: "rgba(255,255,255,0.6)",
      fontStyle: "italic",
      marginBottom: 6
    }
  }, "Untagged moment"), song?.song && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: stage?.color || "var(--ember-ink)",
      fontWeight: 700,
      marginBottom: 4
    }
  }, "♫ ", song.song, m.confirmedSong && React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.45)",
      marginLeft: 6
    }
  }, "· SHAZAMED")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.5)",
      fontWeight: 600
    }
  }, [stage?.name?.toUpperCase(), prettyTime, m.location?.label?.toUpperCase()].filter(Boolean).join(" · ")), m.kind === "video" && !m.confirmedSong && React.createElement("button", {
    onClick: runIdentify,
    disabled: idState !== "idle" && idState !== "fail",
    className: "mono",
    style: {
      marginTop: 12,
      padding: "12px 14px",
      borderRadius: 14,
      width: "100%",
      background: idState === "fail" ? "linear-gradient(135deg, rgba(232,93,46,0.28), rgba(245,154,54,0.16))" : "linear-gradient(135deg, rgba(109,40,217,0.85), rgba(232,93,46,0.78))",
      border: "1px solid rgba(255,255,255,0.22)",
      color: "#fff",
      boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 800,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      opacity: idState !== "idle" && idState !== "fail" ? 0.85 : 1
    }
  }, React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18,
      lineHeight: 1
    }
  }, idState === "listening" ? "●" : "🎵"), React.createElement("span", {
    style: {
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      display: "block"
    }
  }, idState === "idle" ? "SHAZAM THIS VIDEO" : idState === "listening" ? "LISTENING TO YOUR VIDEO…" : idState === "matching" ? "MATCHING WITH SHAZAM…" : idState === "fail" ? "NO MATCH — TRY A LOUDER CLIP" : "IDENTIFIED"), React.createElement("span", {
    style: {
      display: "block",
      marginTop: 3,
      fontSize: 8,
      letterSpacing: 1,
      color: "rgba(255,255,255,0.72)",
      fontWeight: 700
    }
  }, "PROVES THE SONG FROM THE CLIP'S AUDIO"))), React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "→")), React.createElement("button", {
    onClick: () => setRetagging(r => !r),
    className: "mono",
    style: {
      marginTop: 9,
      background: "transparent",
      border: "none",
      padding: 0,
      color: "rgba(255,255,255,0.6)",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, retagging ? "✕ CANCEL" : artist ? "✎ WRONG ACT? FIX IT" : "✎ TAG THIS MOMENT"), retagging && React.createElement("div", {
    className: "no-scrollbar",
    style: {
      marginTop: 8,
      maxHeight: 176,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, retagOptions.map(a => {
    var st = STAGES.find(s => s.id === a.stage);
    var on = a.id === m.artistId;
    return React.createElement("button", {
      key: a.id,
      onClick: () => {
        onUpdate?.(m, {
          artistId: a.id,
          tagSource: "manual",
          autoTagged: false
        });
        setRetagging(false);
        try {
          window.plurskyHaptic?.("LIGHT");
        } catch {}
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        background: on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${on ? "#fff" : "rgba(255,255,255,0.14)"}`,
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 8,
        background: st?.color || "#888",
        flexShrink: 0
      }
    }), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, a.name), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 0.6,
        color: "rgba(255,255,255,0.5)",
        flexShrink: 0
      }
    }, st?.short || "", " · ", window.fmt12?.(a.start) || a.start));
  })), React.createElement("button", {
    onClick: async () => {
      if (sharing) return;
      setSharing(true);
      try {
        window.plurskyHaptic?.("LIGHT");
      } catch {}
      await _shareMoment(m, {
        artistName: artist?.name,
        songLabel: song?.song || null,
        stageColor: stage?.color,
        subLabel: [stage?.name, prettyTime].filter(Boolean).join(" · "),
        timeLabel: prettyTime,
        festival: FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name
      }).catch(() => {});
      setSharing(false);
    },
    disabled: sharing,
    className: "mono",
    style: {
      marginTop: 14,
      padding: "10px 14px",
      borderRadius: 999,
      width: "100%",
      background: "#fff",
      color: "#0d0a08",
      border: "none",
      fontSize: 11,
      letterSpacing: 1.3,
      fontWeight: 800,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      opacity: sharing ? 0.6 : 1
    }
  }, sharing ? "PREPARING…" : "↗  SHARE THIS MOMENT"), mismatch && React.createElement("button", {
    onClick: () => {
      onUpdate?.(m, {
        artistId: mismatch.id,
        tagSource: "video-shazam",
        autoTagged: false
      });
      setMismatch(null);
    },
    style: {
      marginTop: 8,
      padding: "10px 12px",
      borderRadius: 10,
      width: "100%",
      background: "rgba(245,154,54,0.15)",
      border: "1px solid rgba(245,154,54,0.45)",
      color: "#fde68a",
      cursor: "pointer",
      textAlign: "left"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      marginBottom: 2
    }
  }, "AUDIO SAYS ", mismatch.name.toUpperCase()), React.createElement("div", {
    style: {
      fontSize: 12,
      lineHeight: 1.4
    }
  }, "This video's song is ", mismatch.name, "'s — retag this moment to them? (You were probably at ", STAGES.find(s => s.id === mismatch.stage)?.name || "their stage", ".)")), recovery && React.createElement("button", {
    onClick: () => {
      onRecoverNight?.(m, recovery);
      setRecovery(null);
    },
    style: {
      marginTop: 8,
      padding: "10px 12px",
      borderRadius: 10,
      width: "100%",
      background: "rgba(56,189,248,0.15)",
      border: "1px solid rgba(56,189,248,0.45)",
      color: "#bae6fd",
      cursor: "pointer",
      textAlign: "left"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      marginBottom: 2
    }
  }, "RECOVER FROM SONG · NIGHT ", recovery.night), React.createElement("div", {
    style: {
      fontSize: 12,
      lineHeight: 1.4
    }
  }, "This clip's date was unverified, but its song is ", recovery.name, "'s and they played once — night ", recovery.night, STAGES.find(s => s.id === recovery.stage)?.name ? ` at ${STAGES.find(s => s.id === recovery.stage).name}` : "", ". File it there?")), moments.length > 1 && React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 5,
      overflowX: "auto",
      marginTop: 14,
      scrollbarWidth: "none"
    }
  }, moments.map((mm, i) => React.createElement(_LightboxThumb, {
    key: mm.id,
    moment: mm,
    active: i === index,
    onClick: () => onIndexChange(i)
  })))));
}
function _fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  var m = Math.floor(sec / 60),
    s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function _VideoBadge({
  seconds,
  style
}) {
  return React.createElement("span", {
    className: "mono",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      background: "rgba(0,0,0,0.6)",
      color: "#fff",
      fontSize: 8,
      letterSpacing: 0.5,
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: 999,
      pointerEvents: "none",
      ...style
    }
  }, React.createElement("span", {
    style: {
      fontSize: 7
    }
  }, "▶"), seconds ? _fmtClock(seconds) : "VIDEO");
}
function _LightboxVideo({
  src
}) {
  var ref = React.useRef(null);
  var [playing, setPlaying] = React.useState(false);
  var [cur, setCur] = React.useState(0);
  var [dur, setDur] = React.useState(0);
  var [muted, setMuted] = React.useState(() => {
    try {
      return localStorage.getItem("plursky_lb_muted_v1") === "1";
    } catch {
      return false;
    }
  });
  var [flash, setFlash] = React.useState(false);
  React.useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);
  var toggle = () => {
    var v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});else v.pause();
    setFlash(true);
    setTimeout(() => setFlash(false), 450);
    try {
      window.plurskyHaptic?.("LIGHT");
    } catch {}
  };
  var seek = e => {
    var v = ref.current;
    if (!v || !dur) return;
    var rect = e.currentTarget.getBoundingClientRect();
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    v.currentTime = Math.max(0, Math.min(1, (cx - rect.left) / rect.width)) * dur;
  };
  var pct = dur ? cur / dur * 100 : 0;
  var stop = e => e.stopPropagation();
  return React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("video", {
    ref: ref,
    src: src,
    autoPlay: true,
    playsInline: true,
    muted: muted,
    onClick: toggle,
    onTimeUpdate: () => {
      var v = ref.current;
      if (v) setCur(v.currentTime);
    },
    onLoadedMetadata: () => {
      var v = ref.current;
      if (v) setDur(v.duration || 0);
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    style: {
      maxWidth: "100%",
      maxHeight: "100%",
      display: "block"
    }
  }), (!playing || flash) && React.createElement("div", {
    style: {
      position: "absolute",
      pointerEvents: "none",
      width: 66,
      height: 66,
      borderRadius: 66,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 26,
      paddingLeft: playing ? 0 : 4,
      transition: "opacity .2s",
      opacity: 1
    }
  }, playing ? "❚❚" : "▶"), React.createElement("button", {
    onClick: e => {
      stop(e);
      setMuted(mm => {
        var nx = !mm;
        try {
          localStorage.setItem("plursky_lb_muted_v1", nx ? "1" : "0");
        } catch {}
        return nx;
      });
    },
    "aria-label": muted ? "Unmute" : "Mute",
    style: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 38,
      height: 38,
      borderRadius: 38,
      background: "rgba(0,0,0,0.5)",
      border: "none",
      color: "#fff",
      fontSize: 15,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, muted ? "🔇" : "🔊"), React.createElement("div", {
    onClick: stop,
    onTouchStart: stop,
    onTouchEnd: stop,
    style: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 12
    }
  }, React.createElement("div", {
    onClick: seek,
    onTouchMove: seek,
    onTouchStart: seek,
    style: {
      height: 5,
      borderRadius: 5,
      background: "rgba(255,255,255,0.28)",
      position: "relative",
      cursor: "pointer"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: `${pct}%`,
      background: "#fff",
      borderRadius: 5
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      left: `${pct}%`,
      top: "50%",
      transform: "translate(-50%,-50%)",
      width: 12,
      height: 12,
      borderRadius: 12,
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.5)"
    }
  })), React.createElement("div", {
    className: "mono",
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 5,
      fontSize: 8,
      letterSpacing: 1,
      color: "rgba(255,255,255,0.7)",
      fontWeight: 700
    }
  }, React.createElement("span", null, _fmtClock(cur)), React.createElement("span", null, _fmtClock(dur)))));
}
function _imgFromBlob(blob) {
  return new Promise((resolve, reject) => {
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = () => resolve({
      img,
      revoke: () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    });
    img.onerror = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      reject(new Error("img"));
    };
    img.src = url;
  });
}
function _frameFromVideoBlob(blob) {
  return new Promise(resolve => {
    try {
      var url = URL.createObjectURL(blob);
      var v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.src = url;
      var fail = () => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        resolve(null);
      };
      v.onloadeddata = () => {
        try {
          v.currentTime = Math.min(0.1, (v.duration || 1) * 0.1);
        } catch {
          fail();
        }
      };
      v.onseeked = () => {
        try {
          var c = document.createElement("canvas");
          c.width = v.videoWidth || 1080;
          c.height = v.videoHeight || 1920;
          c.getContext("2d").drawImage(v, 0, 0);
          URL.revokeObjectURL(url);
          resolve(c);
        } catch {
          fail();
        }
      };
      v.onerror = fail;
    } catch {
      resolve(null);
    }
  });
}
function _drawCover(ctx, src, dx, dy, dw, dh) {
  var sW = src.width || src.videoWidth,
    sH = src.height || src.videoHeight;
  if (!sW || !sH) return;
  var ir = sW / sH,
    r = dw / dh;
  var sw, sh, sx, sy;
  if (ir > r) {
    sh = sH;
    sw = sh * r;
    sx = (sW - sw) / 2;
    sy = 0;
  } else {
    sw = sW;
    sh = sw / r;
    sx = 0;
    sy = (sH - sh) / 2;
  }
  ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
}
async function _shareMoment(moment, meta) {
  var blob = await _getPhoto(moment.photoId).catch(() => null);
  if (!blob) return {
    ok: false,
    reason: "no_photo"
  };
  var source = null,
    revoke = null;
  if (moment.kind === "video") {
    source = await _frameFromVideoBlob(blob);
  } else {
    try {
      var r = await _imgFromBlob(blob);
      source = r.img;
      revoke = r.revoke;
    } catch {}
  }
  try {
    await (document.fonts?.ready || Promise.resolve());
  } catch {}
  var W = 1080,
    H = 1920,
    HERO = 1320;
  var cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  var ctx = cv.getContext("2d");
  ctx.fillStyle = "#0d0a08";
  ctx.fillRect(0, 0, W, H);
  if (source) _drawCover(ctx, source, 0, 0, W, HERO);else {
    ctx.fillStyle = "#1a120d";
    ctx.fillRect(0, 0, W, HERO);
  }
  if (revoke) revoke();
  var g = ctx.createLinearGradient(0, HERO - 360, 0, HERO);
  g.addColorStop(0, "rgba(13,10,8,0)");
  g.addColorStop(1, "#0d0a08");
  ctx.fillStyle = g;
  ctx.fillRect(0, HERO - 360, W, 360);
  var accent = meta.stageColor || "#e85d2e";
  var y = HERO + 30;
  ctx.textAlign = "left";
  if (meta.timeLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = '700 30px "Geist Mono", monospace';
    ctx.fillText(meta.timeLabel.toUpperCase(), 80, y);
    y += 70;
  }
  ctx.fillStyle = "#fff";
  ctx.font = '92px "Instrument Serif", serif';
  var name = meta.artistName || "A moment";
  if (ctx.measureText(name).width > W - 160) {
    while (ctx.measureText(name + "…").width > W - 160 && name.length) name = name.slice(0, -1);
    name += "…";
  }
  ctx.fillText(name, 80, y + 70);
  y += 130;
  if (meta.songLabel) {
    ctx.fillStyle = accent;
    ctx.font = '700 34px "Geist Mono", monospace';
    var s = "♫ " + meta.songLabel;
    if (ctx.measureText(s).width > W - 160) {
      while (ctx.measureText(s + "…").width > W - 160 && s.length) s = s.slice(0, -1);
      s += "…";
    }
    ctx.fillText(s, 80, y);
    y += 56;
  }
  if (meta.subLabel) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = '600 26px "Geist Mono", monospace';
    ctx.fillText(meta.subLabel.toUpperCase(), 80, y);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = '800 40px "Geist Mono", monospace';
  ctx.fillText("PLURSKY", 80, H - 70);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = '600 26px "Geist Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText((meta.festival || "").toUpperCase() + "  ·  PLURSKY.COM", W - 80, H - 72);
  var fname = `plursky-${(meta.artistName || "moment").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  var out = await new Promise(res => cv.toBlob(res, "image/png", 0.92));
  if (!out) return {
    ok: false,
    reason: "encode_fail"
  };
  var file = new File([out], fname, {
    type: "image/png"
  });
  if (navigator.canShare?.({
    files: [file]
  }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: meta.artistName ? `${meta.artistName} — Plursky` : "Plursky"
      });
      return {
        ok: true,
        mode: "share"
      };
    } catch (e) {
      if (e?.name === "AbortError") return {
        ok: true,
        mode: "abort"
      };
    }
  }
  var url = URL.createObjectURL(out);
  var link = document.createElement("a");
  link.href = url;
  link.download = fname;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }, 1500);
  return {
    ok: true,
    mode: "download"
  };
}
function _LightboxThumb({
  moment,
  active,
  onClick
}) {
  var url = useMomentPhoto(moment.photoId);
  return React.createElement("button", {
    onClick: onClick,
    "aria-label": "View moment",
    style: {
      flexShrink: 0,
      width: 44,
      height: 44,
      borderRadius: 8,
      padding: 0,
      cursor: "pointer",
      border: active ? "2px solid #fff" : "2px solid transparent",
      opacity: active ? 1 : 0.5,
      overflow: "hidden",
      background: "#222",
      transition: "opacity 0.15s",
      position: "relative"
    }
  }, url && (moment.kind === "video" ? React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none"
    }
  }) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  })), moment.kind === "video" && React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 10,
      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      pointerEvents: "none"
    }
  }, "▶"));
}
function MomentCard({
  moment,
  idx,
  total,
  onDelete,
  onArtistClick,
  onUpdate,
  savedArtistIds,
  groupMoments,
  onOpenLightbox
}) {
  var [cardRef, near] = useNearViewport();
  var photoUrl = useMomentPhoto(moment.photoId, near);
  var artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  var stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  var nowPlaying = useSetlistSong(artist, moment.takenAt);
  var [editing, setEditing] = React.useState(false);
  var tagInfo = (() => {
    var base = _TAG_SOURCE_LABEL[moment.tagSource] || null;
    if (moment.tagSource === "off_stage" && moment.location) {
      return {
        text: `${moment.location.icon} ${moment.location.label.toUpperCase()}`,
        tone: "info"
      };
    }
    return base;
  })();
  var [allMoments, setAllMoments] = React.useState(() => {
    try {
      return _readMoments();
    } catch {
      return {};
    }
  });
  React.useEffect(() => {
    var refresh = () => {
      try {
        setAllMoments(_readMoments());
      } catch {}
    };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  var suggestion = React.useMemo(() => _siblingSuggestionFor(moment, allMoments), [moment.id, moment.artistId, moment.night, moment.createdAt, allMoments]);
  var suggestedArtist = suggestion ? ARTISTS.find(a => a.id === suggestion.artistId) : null;
  var suggestedStage = suggestedArtist ? STAGES.find(s => s.id === suggestedArtist.stage) : null;
  var [showAll, setShowAll] = React.useState(false);
  var nightArtists = ARTISTS.filter(a => a.day === moment.night);
  var savedNightArtists = nightArtists.filter(a => (savedArtistIds || []).includes(a.id));
  var pickerArtists = showAll ? nightArtists : savedNightArtists.length ? savedNightArtists : nightArtists;
  var setArtist = id => {
    try {
      window.plurskyHaptic?.("LIGHT");
    } catch {}
    onUpdate?.(moment, {
      artistId: id,
      tagSource: "manual",
      autoTagged: false
    });
    setEditing(false);
  };
  var moveToNight = n => {
    if (n === moment.night) return;
    try {
      window.plurskyHaptic?.("LIGHT");
    } catch {}
    onUpdate?.(moment, {
      night: n,
      artistId: null,
      tagSource: "manual",
      autoTagged: false
    });
  };
  return React.createElement("div", {
    ref: cardRef,
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: 12,
      marginBottom: 10
    }
  }, moment.photoId && (photoUrl ? moment.kind === "video" ? React.createElement("video", {
    src: photoUrl,
    controls: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      borderRadius: 10,
      display: "block",
      marginBottom: moment.text ? 10 : 8,
      background: "#000"
    }
  }) : React.createElement("img", {
    src: photoUrl,
    alt: "",
    onClick: () => onOpenLightbox?.(groupMoments || [moment], idx || 0),
    style: {
      width: "100%",
      borderRadius: 10,
      display: "block",
      marginBottom: moment.text ? 10 : 8,
      cursor: "pointer"
    }
  }) : React.createElement("div", {
    style: {
      width: "100%",
      aspectRatio: "4/3",
      borderRadius: 10,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: moment.text ? 10 : 8
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "LOADING…"))), moment.text && React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      lineHeight: 1.3,
      color: "var(--ink)"
    }
  }, moment.text), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 8
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      flex: 1,
      minWidth: 0
    }
  }, artist ? React.createElement("button", {
    onClick: () => onArtistClick(artist.id),
    className: "mono",
    style: {
      background: stage ? `${stage.color}18` : "var(--paper)",
      color: stage ? stage.color : "var(--muted)",
      border: stage ? `1px solid ${stage.color}40` : "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "♬ ", artist.name.toUpperCase()) : suggestion ? React.createElement("button", {
    onClick: () => setArtist(suggestion.artistId),
    className: "mono",
    title: `${suggestion.count} other moment${suggestion.count === 1 ? "" : "s"} in the same 30-min window tagged to this artist`,
    style: {
      background: suggestedStage ? `${suggestedStage.color}18` : "var(--paper-2)",
      color: suggestedStage ? suggestedStage.color : "var(--ink)",
      border: suggestedStage ? `1px dashed ${suggestedStage.color}66` : "1px dashed var(--line-2)",
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "+ TAG AS ", suggestedArtist?.name.toUpperCase() || "—", " (", suggestion.count, ")") : React.createElement("button", {
    onClick: () => setEditing(true),
    className: "mono",
    style: {
      background: "rgba(232,93,46,0.12)",
      color: "var(--ember-ink)",
      border: "1px dashed rgba(232,93,46,0.5)",
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "+ TAG A SET"), artist && moment.tagAmbiguous && onUpdate && !editing && React.createElement("button", {
    onClick: () => setEditing(true),
    className: "mono",
    title: "More than one set overlapped this time — tap to confirm or fix the tag",
    style: {
      background: "rgba(232,93,46,0.12)",
      color: "var(--ember-ink)",
      border: "1px dashed rgba(232,93,46,0.5)",
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "✎ FIX TAG?"), moment.dateUnverified && !editing && React.createElement("span", {
    className: "mono",
    title: "The capture time matched the file's own timestamp, so it was probably rewritten when the file was shared. This night is a guess.",
    style: {
      background: "rgba(56,189,248,0.12)",
      color: "#7dd3fc",
      border: "1px dashed rgba(56,189,248,0.5)",
      borderRadius: 999,
      padding: "3px 9px",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, "◷ DATE UNVERIFIED"), !artist && suggestion && onUpdate && React.createElement("button", {
    onClick: () => setEditing(true),
    className: "mono",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700,
      padding: "3px 5px"
    }
  }, "OTHER")), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      flexShrink: 0
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      fontWeight: 600
    }
  }, _fmtMomentTime(_momentTime(moment))), onUpdate && React.createElement(_FavStar, {
    favorite: !!moment.favorite,
    tone: "light",
    onToggle: v => onUpdate(moment, {
      favorite: v
    })
  }), artist && onUpdate && React.createElement("button", {
    onClick: () => setEditing(e => !e),
    "aria-label": editing ? "Done editing" : "Edit tag",
    className: "mono",
    style: {
      background: editing ? "var(--ink)" : "transparent",
      color: editing ? "var(--paper)" : "var(--muted)",
      border: "none",
      borderRadius: 999,
      cursor: "pointer",
      fontSize: editing ? 9 : 12,
      letterSpacing: 1.1,
      fontWeight: 700,
      padding: editing ? "3px 8px" : "3px 5px"
    }
  }, editing ? "DONE" : "✎"), React.createElement("button", {
    onClick: () => onDelete(moment),
    "aria-label": "Delete moment",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 14,
      lineHeight: 1,
      opacity: 0.55,
      padding: "3px 4px"
    }
  }, "×"))), (tagInfo || moment.hasGps === false && moment.autoTagged) && React.createElement("div", {
    className: "mono",
    title: moment.takenAt ? `Photo time: ${moment.takenAt}` : undefined,
    style: {
      marginTop: 6,
      fontSize: 8.5,
      letterSpacing: 1,
      fontWeight: 600,
      color: tagInfo?.tone === "warn" ? "var(--ember-ink)" : "var(--muted)",
      opacity: tagInfo?.tone === "warn" ? 1 : 0.85
    }
  }, tagInfo ? `${tagInfo.text}${moment.takenAt ? ` · ${moment.takenAt.slice(11)}` : ""}` : "", moment.hasGps === false && moment.autoTagged ? `${tagInfo ? "  ·  " : ""}📡 NO GPS` : ""), nowPlaying && React.createElement("div", {
    style: {
      marginTop: 5,
      animation: "song-fade-in 0.5s ease-out"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 22,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `${stage?.color || "var(--horizon)"}22`,
      animation: "song-ripple 1.5s ease-out"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      color: stage?.color || "var(--horizon)"
    }
  }, "♫")), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.8,
      fontWeight: 700,
      color: stage?.color || "var(--horizon)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, nowPlaying.song?.toUpperCase()), nowPlaying.source === "1001tracklists" && artist && (() => {
    var CFG = window.FESTIVAL_CONFIG || {};
    var dm = CFG.dayDates?.[artist.day];
    if (!dm) return null;
    var [sh, sm] = artist.start.split(":").map(Number);
    var [eh, em] = artist.end.split(":").map(Number);
    var setStartMs = dm.midnightUtc + (sh < 6 ? sh + 24 : sh) * 3600000 + sm * 60000;
    var setEndMs = dm.midnightUtc + (eh < 6 ? eh + 24 : eh) * 3600000 + em * 60000;
    var photoMs = Date.parse(moment.takenAt?.replace(" ", "T"));
    if (isNaN(photoMs)) return null;
    var elapsed = photoMs - setStartMs;
    var duration = setEndMs - setStartMs;
    if (duration <= 0 || elapsed < 0) return null;
    var pct = Math.min(elapsed / duration, 1);
    var mins = Math.round(elapsed / 60000);
    var totalMins = Math.round(duration / 60000);
    return React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 0.8,
        color: "var(--muted)",
        marginTop: 1,
        display: "flex",
        alignItems: "center",
        gap: 4
      }
    }, React.createElement("span", null, mins, "min into ", totalMins, "min set"), React.createElement("div", {
      style: {
        width: 30,
        height: 3,
        borderRadius: 2,
        background: "rgba(255,255,255,0.1)"
      }
    }, React.createElement("div", {
      style: {
        width: `${pct * 100}%`,
        height: "100%",
        borderRadius: 2,
        background: stage?.color || "var(--horizon)"
      }
    })));
  })()), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.8,
      padding: "2px 5px",
      borderRadius: 4,
      flexShrink: 0,
      background: nowPlaying.confidence === "exact" ? "rgba(45,122,85,0.15)" : "rgba(232,93,46,0.1)",
      color: nowPlaying.confidence === "exact" ? "var(--success)" : "var(--ember-ink)",
      fontWeight: 700
    }
  }, nowPlaying.confidence === "exact" ? "EXACT" : "~EST"))), editing && onUpdate && React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginBottom: 6,
      fontWeight: 700
    }
  }, "NIGHT"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10
    }
  }, (window.DAYS || []).map(d => {
    var on = moment.night === d.n;
    return React.createElement("button", {
      key: d.n,
      onClick: () => moveToNight(d.n),
      className: "mono",
      style: {
        flex: 1,
        padding: "6px 0",
        borderRadius: 8,
        background: on ? "var(--ink)" : "var(--paper)",
        color: on ? "var(--paper)" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, (d.label || `DAY ${d.n}`).toString().toUpperCase());
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginBottom: 6,
      fontWeight: 700
    }
  }, showAll ? "ALL SETS THIS NIGHT" : savedNightArtists?.length ? "YOUR SAVED SETS THIS NIGHT" : "SETS THIS NIGHT"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 8
    }
  }, pickerArtists.slice().sort((a, b) => a.start.localeCompare(b.start)).map(a => {
    var on = moment.artistId === a.id;
    return React.createElement("button", {
      key: a.id,
      onClick: () => setArtist(on ? null : a.id),
      className: "mono",
      style: {
        padding: "5px 10px",
        borderRadius: 999,
        background: on ? "var(--ink)" : "var(--paper)",
        color: on ? "var(--paper)" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, a.name.toUpperCase());
  }), pickerArtists.length === 0 && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      fontWeight: 600
    }
  }, "NO SETS LISTED FOR THIS NIGHT")), savedNightArtists?.length > 0 && (nightArtists?.length || 0) > savedNightArtists.length && React.createElement("button", {
    onClick: () => setShowAll(s => !s),
    className: "mono",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700,
      padding: 0
    }
  }, showAll ? "← BACK TO SAVED ONLY" : "SHOW ALL SETS THIS NIGHT →")));
}
function _heroScore(m) {
  if (!m || !m.photoId) return -Infinity;
  var score = 0;
  if (m.favorite) score += 1000;
  var a = m.artistId ? (window.ARTISTS || []).find(x => x.id === m.artistId) : null;
  var cap = _momentCaptureMs(m);
  if (a && cap) {
    var dm = window.FESTIVAL_CONFIG?.dayDates?.[a.day];
    if (dm && a.start && a.end) {
      var [sh, sm] = a.start.split(":").map(Number);
      var [eh, em] = a.end.split(":").map(Number);
      var s = dm.midnightUtc + ((sh < 8 ? sh + 24 : sh) * 60 + sm) * 60000;
      var e = dm.midnightUtc + ((eh < 8 ? eh + 24 : eh) * 60 + em) * 60000;
      var dur = e - s;
      if (dur > 0) {
        var peak = s + dur * 0.75;
        score += Math.max(0, 1 - Math.abs(cap - peak) / dur) * 60;
      }
    }
  }
  if (m.confirmedSong) score += 25;
  if (m.kind === "video") score += 20;
  if (m.hasGps) score += 10;
  if (m.text) score += 6;
  return score;
}
function _pickHeroMoment(items) {
  var best = null,
    bestScore = -Infinity;
  for (var m of items || []) {
    var s = _heroScore(m);
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  return best && best.photoId ? best : (items || []).find(m => m.photoId) || null;
}
function _GroupHeroThumb({
  moment,
  accent,
  onClick
}) {
  var url = useMomentPhoto(moment?.photoId);
  if (!moment?.photoId) return null;
  return React.createElement("button", {
    onClick: onClick,
    "aria-label": "Open best shot",
    style: {
      flexShrink: 0,
      width: 46,
      height: 46,
      borderRadius: 10,
      padding: 0,
      cursor: "pointer",
      overflow: "hidden",
      border: `1.5px solid ${accent || "var(--line-2)"}`,
      background: "#222",
      position: "relative"
    }
  }, url && (moment.kind === "video" ? React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none"
    }
  }) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  })), moment.kind === "video" && React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 11,
      textShadow: "0 1px 2px rgba(0,0,0,0.6)",
      pointerEvents: "none"
    }
  }, "▶"));
}
function _peakWindow(moments, windowMs) {
  windowMs = windowMs || 20 * 60000;
  var timed = (moments || []).filter(m => m.photoId).map(m => ({
    m,
    t: _momentCaptureMs(m)
  })).filter(x => x.t > 0).sort((a, b) => a.t - b.t);
  if (timed.length < 3) return null;
  var best = null;
  for (var i = 0; i < timed.length; i++) {
    var end = timed[i].t + windowMs;
    var items = [];
    for (var j = i; j < timed.length && timed[j].t < end; j++) items.push(timed[j].m);
    if (!best || items.length > best.items.length) {
      best = {
        items,
        startMs: timed[i].t,
        endMs: timed[i + items.length - 1].t
      };
    }
  }
  return best && best.items.length >= 3 ? best : null;
}
function _clock12(ms) {
  var d = new Date(ms);
  var h = d.getHours();
  var mn = d.getMinutes();
  var ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(mn).padStart(2, "0")} ${ap}`;
}
function PeakMomentCard({
  peak,
  accent,
  onOpenLightbox,
  onPlayReel
}) {
  if (!peak) return null;
  var {
    items,
    startMs,
    endMs
  } = peak;
  var a = accent || "var(--ember)";
  return React.createElement("div", {
    style: {
      marginTop: 10,
      marginBottom: 6,
      borderRadius: 14,
      padding: 12,
      background: `linear-gradient(135deg, ${a}1f, var(--paper-2))`,
      border: `1px solid ${a}40`
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9
    }
  }, React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, "🔥"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1.4,
      fontWeight: 800,
      color: a
    }
  }, "YOUR PEAK · 20 MIN"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 17,
      color: "var(--ink)",
      lineHeight: 1.1,
      marginTop: 1
    }
  }, items.length, " moments in 20 minutes"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 600,
      marginTop: 2
    }
  }, _clock12(startMs), " – ", _clock12(endMs))), onPlayReel && React.createElement("button", {
    onClick: () => {
      try {
        window.plurskyHaptic?.("MEDIUM");
      } catch {}
      onPlayReel(items);
    },
    className: "mono",
    style: {
      flexShrink: 0,
      background: a,
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "7px 13px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, "▶ RELIVE")), React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 5,
      overflowX: "auto",
      marginTop: 10
    }
  }, items.map((m, i) => React.createElement(_GroupHeroThumb, {
    key: m.id,
    moment: m,
    accent: a,
    onClick: () => onOpenLightbox?.(items, i)
  }))));
}
function SetSongTimeline({
  artist,
  moments,
  onOpenMoment
}) {
  var [data, setData] = React.useState(undefined);
  var [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!artist?.name) {
      setData(null);
      return;
    }
    var cancelled = false;
    _getTracklistForArtist(artist.name).then(d => {
      if (!cancelled) setData(d || null);
    }).catch(() => {
      if (!cancelled) setData(null);
    });
    return () => {
      cancelled = true;
    };
  }, [artist?.id]);
  var filmed = React.useMemo(() => {
    if (!data) return [];
    return (moments || []).filter(m => m.photoId && (m.takenAt || m.confirmedSong)).map(m => {
      var match = m.confirmedSong ? {
        song: m.confirmedSong,
        confidence: "exact"
      } : _matchSongAtTime(artist, data, m.takenAt);
      return match?.song ? {
        m,
        song: match.song,
        confidence: match.confidence
      } : null;
    }).filter(Boolean).sort((a, b) => (a.m.takenAt || "").localeCompare(b.m.takenAt || ""));
  }, [data, moments, artist?.id]);
  var stage = artist ? (window.STAGES || []).find(s => s.id === artist.stage) : null;
  var accent = stage?.color || "var(--horizon)";
  if (data === undefined || !filmed.length) return null;
  return React.createElement("div", {
    style: {
      margin: "2px 0 8px",
      padding: "8px 10px",
      background: "var(--paper-2)",
      border: `1px solid ${accent}33`,
      borderRadius: 12
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    "aria-expanded": open,
    className: "mono",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: 0,
      color: accent,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 800,
      textAlign: "left"
    }
  }, React.createElement("span", null, "🎵 ", filmed.length, " SONG", filmed.length === 1 ? "" : "S", " YOU FILMED"), React.createElement("span", {
    style: {
      marginLeft: "auto",
      color: "var(--muted)",
      fontSize: 11
    }
  }, open ? "▾" : "▸")), open && React.createElement("div", {
    style: {
      marginTop: 8,
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, filmed.map(({
    m,
    song,
    confidence
  }) => React.createElement("div", {
    key: m.id,
    role: "button",
    tabIndex: 0,
    onClick: () => onOpenMoment?.(m),
    onKeyDown: e => {
      if (e.key === "Enter" || e.key === " ") onOpenMoment?.(m);
    },
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      padding: 6,
      cursor: "pointer",
      textAlign: "left"
    }
  }, React.createElement(_GroupHeroThumb, {
    moment: m,
    accent: accent,
    onClick: () => onOpenMoment?.(m)
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--ink)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, "♫ ", song), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 700,
      marginTop: 2
    }
  }, m.takenAt ? m.takenAt.slice(11) : "", confidence === "exact" ? " · EXACT" : " · ~EST", m.kind === "video" ? " · VIDEO" : "")), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      color: accent,
      fontWeight: 700,
      flexShrink: 0
    }
  }, "OPEN ›")))));
}
function _renderByGroup({
  allMoments,
  keyOf,
  headerFor,
  sortKeys,
  state,
  setState,
  handleDelete,
  handleUpdate,
  onOpenLightbox
}) {
  var groups = new Map();
  for (var m of allMoments) {
    var k = keyOf(m);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  var keys = [...groups.keys()].sort(sortKeys);
  if (keys.length === 0) {
    return React.createElement("div", {
      style: {
        padding: "28px 14px",
        textAlign: "center",
        marginTop: 18,
        border: "1px dashed var(--line-2)",
        borderRadius: 14,
        background: "var(--paper-2)"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "NO MOMENTS YET — IMPORT FROM CAMERA ROLL ABOVE"));
  }
  return keys.map(k => {
    var chrono = groups.get(k).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    var hero = _pickHeroMoment(chrono);
    var items = hero ? [hero, ...chrono.filter(m => m.id !== hero.id)] : chrono;
    var h = headerFor(k);
    return React.createElement("div", {
      key: k,
      style: {
        marginTop: 18
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("button", {
      onClick: h.onClick || undefined,
      disabled: !h.onClick,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flex: 1,
        minWidth: 0,
        padding: "6px 4px",
        background: "transparent",
        border: "none",
        textAlign: "left",
        cursor: h.onClick ? "pointer" : "default"
      }
    }, React.createElement("span", {
      style: {
        width: 4,
        alignSelf: "stretch",
        background: h.accent,
        borderRadius: 3,
        minHeight: 30
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
        letterSpacing: 1.3,
        fontWeight: 700,
        color: h.accent
      }
    }, h.mono), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        color: "var(--ink)",
        lineHeight: 1.1,
        marginTop: 2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, h.serif)), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.1,
        color: "var(--muted)",
        fontWeight: 700,
        flexShrink: 0
      }
    }, items.length, " ", items.length === 1 ? "MOMENT" : "MOMENTS")), hero && onOpenLightbox && React.createElement(_GroupHeroThumb, {
      moment: hero,
      accent: h.accent,
      onClick: () => onOpenLightbox(items, 0)
    })), items.map((m, i) => React.createElement(MomentCard, {
      key: m.id,
      moment: m,
      idx: i,
      total: items.length,
      groupMoments: items,
      onOpenLightbox: onOpenLightbox,
      onDelete: handleDelete,
      onUpdate: handleUpdate,
      savedArtistIds: state.saved || [],
      onArtistClick: id => setState(s => ({
        ...s,
        artist: id
      }))
    })));
  });
}
function AddMomentForm({
  night,
  savedNightArtists,
  onAdd,
  onCancel
}) {
  var [blob, setBlob] = React.useState(null);
  var [previewUrl, setPreviewUrl] = React.useState(null);
  var [text, setText] = React.useState("");
  var [artistId, setArtistId] = React.useState(null);
  var [busy, setBusy] = React.useState(false);
  var [err, setErr] = React.useState("");
  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  var [mediaKind, setMediaKind] = React.useState("image");
  var handlePhoto = async e => {
    var file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      var exif = await _parseExifMeta(file).catch(() => null);
      var meta = _metaFromFile(file, exif);
      if (meta && meta.date && !artistId) {
        var attendedIds = Object.values(window.getAllAttended?.() || {}).flat();
        var matched = _matchArtistForPhoto(meta, savedNightArtists.map(a => a.id), attendedIds);
        var activeId = window.FESTIVAL_CONFIG?.id || null;
        if (matched.artistId && (!matched.festivalId || matched.festivalId === activeId)) {
          setArtistId(matched.artistId);
        }
      }
      var out = await _processMomentMedia(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(out.blob);
      setMediaKind(out.kind);
      setPreviewUrl(URL.createObjectURL(out.blob));
    } catch (err) {
      setErr(err?.message || "Couldn't load that file.");
    }
    setBusy(false);
  };
  var clearPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
  };
  var handleSave = async () => {
    if (!blob && !text.trim()) {
      setErr("Add a photo or some text first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      var id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      var photoId = null;
      if (blob) {
        photoId = `p_${id}`;
        await _putPhoto(photoId, blob);
      }
      var moment = {
        id,
        night,
        text: text.trim(),
        artistId,
        photoId,
        kind: blob ? mediaKind : null,
        createdAt: Date.now(),
        festivalId: window.FESTIVAL_CONFIG?.id || null,
        tagSource: artistId ? "manual" : undefined
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
  return React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 14,
      padding: 14,
      marginTop: 8,
      marginBottom: 14
    }
  }, previewUrl ? React.createElement("div", {
    style: {
      position: "relative",
      marginBottom: 10
    }
  }, mediaKind === "video" ? React.createElement("video", {
    src: previewUrl,
    controls: true,
    playsInline: true,
    style: {
      width: "100%",
      borderRadius: 10,
      display: "block",
      background: "#000"
    }
  }) : React.createElement("img", {
    src: previewUrl,
    alt: "",
    style: {
      width: "100%",
      borderRadius: 10,
      display: "block"
    }
  }), React.createElement("button", {
    onClick: clearPhoto,
    "aria-label": "Remove media",
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 999,
      background: "rgba(0,0,0,0.55)",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backdropFilter: "blur(6px)"
    }
  }, "×")) : React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "14px",
      background: "var(--paper)",
      border: "1px dashed var(--line-2)",
      borderRadius: 10,
      cursor: "pointer",
      marginBottom: 10,
      color: "var(--muted)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, React.createElement("span", null, "📷 ADD PHOTO OR VIDEO (OPTIONAL)"), React.createElement("input", {
    type: "file",
    accept: "image/*,video/*",
    onChange: handlePhoto,
    style: {
      display: "none"
    }
  })), React.createElement("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "What happened?",
    rows: 2,
    maxLength: 240,
    style: {
      width: "100%",
      padding: "10px 12px",
      boxSizing: "border-box",
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      resize: "none",
      fontFamily: "Geist, sans-serif",
      fontSize: 14,
      lineHeight: 1.4,
      color: "var(--ink)",
      outline: "none",
      marginBottom: 10
    }
  }), savedNightArtists.length > 0 && React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginBottom: 6,
      fontWeight: 700
    }
  }, "TAG A SET (OPTIONAL)"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, savedNightArtists.map(a => {
    var on = artistId === a.id;
    return React.createElement("button", {
      key: a.id,
      onClick: () => setArtistId(on ? null : a.id),
      className: "mono",
      style: {
        padding: "5px 10px",
        borderRadius: 999,
        background: on ? "var(--ink)" : "var(--paper)",
        color: on ? "var(--paper)" : "var(--ink)",
        border: on ? "none" : "1px solid var(--line-2)",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, a.name.toUpperCase());
  }))), err && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "#c14a4a",
      marginBottom: 10,
      fontWeight: 700
    }
  }, err), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    onClick: onCancel,
    disabled: busy,
    className: "mono",
    style: {
      flex: 1,
      padding: "12px",
      borderRadius: 10,
      background: "transparent",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: busy ? "default" : "pointer"
    }
  }, "CANCEL"), React.createElement("button", {
    onClick: handleSave,
    disabled: busy,
    className: "mono",
    style: {
      flex: 2,
      padding: "12px",
      borderRadius: 10,
      background: busy ? "var(--muted)" : "var(--ember)",
      color: "#fff",
      border: "none",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: busy ? "default" : "pointer"
    }
  }, busy ? "WORKING…" : "✓ SAVE MOMENT")));
}
async function _purgeVisibleMoments(match) {
  var all = _readMoments();
  var visible = _activeMoments(all);
  var doomed = new Set();
  for (var night of Object.keys(visible)) {
    for (var m of visible[night] || []) if (match(m, night)) doomed.add(m);
  }
  if (!doomed.size) return 0;
  for (var _night of Object.keys(all)) {
    var arr = Array.isArray(all[_night]) ? all[_night] : [];
    for (var _m2 of arr) {
      if (!doomed.has(_m2) || !_m2.photoId) continue;
      try {
        await _deletePhoto(_m2.photoId);
      } catch {}
    }
    var kept = arr.filter(m => !doomed.has(m));
    if (kept.length) all[_night] = kept;else delete all[_night];
  }
  _writeMoments(all);
  return doomed.size;
}
async function _purgeNightMoments(night) {
  return _purgeVisibleMoments((m, n) => String(n) === String(night));
}
async function _purgeAllMoments() {
  return _purgeVisibleMoments(() => true);
}
function StorageManager({
  all,
  onChange
}) {
  var [usage, setUsage] = React.useState(null);
  var [busy, setBusy] = React.useState(false);
  var [confirming, setConfirming] = React.useState(null);
  var refresh = React.useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        var e = await navigator.storage.estimate();
        setUsage({
          used: e.usage || 0,
          quota: e.quota || 0
        });
      } else setUsage({
        used: null,
        quota: null
      });
    } catch {
      setUsage({
        used: null,
        quota: null
      });
    }
  }, []);
  React.useEffect(() => {
    refresh();
  }, [refresh, all]);
  var totalMoments = Object.values(all).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
  if (totalMoments === 0) return null;
  var fmtBytes = b => {
    if (b == null) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
    return `${(b / 1073741824).toFixed(2)} GB`;
  };
  var usedPct = usage?.quota ? Math.round(usage.used / usage.quota * 100) : null;
  var handlePurge = async target => {
    setBusy(true);
    try {
      if (target === "all") await _purgeAllMoments();else await _purgeNightMoments(target);
    } finally {
      setBusy(false);
      setConfirming(null);
      onChange?.();
    }
  };
  var DAYS = window.DAYS || [];
  return React.createElement("div", {
    style: {
      marginTop: 22,
      padding: "14px 16px",
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 10
    }
  }, "STORAGE"), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 4
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--ink)"
    }
  }, totalMoments, " moment", totalMoments === 1 ? "" : "s"), usage?.used != null && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 600
    }
  }, fmtBytes(usage.used), usage.quota ? ` / ${fmtBytes(usage.quota)}` : "")), usedPct != null && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      height: 4,
      background: "var(--paper)",
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: usedPct > 80 ? 6 : 10
    }
  }, React.createElement("div", {
    style: {
      height: "100%",
      width: `${Math.min(100, usedPct)}%`,
      background: usedPct > 80 ? "var(--ember)" : "var(--horizon)",
      transition: "width 0.3s"
    }
  })), usedPct > 80 && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      marginBottom: 10,
      color: "var(--ember-ink)",
      background: "rgba(232,93,46,0.10)",
      border: "1px solid rgba(232,93,46,0.3)",
      borderRadius: 8,
      padding: "6px 10px"
    }
  }, "⚠ STORAGE ", usedPct, "% FULL · PURGE OLD NIGHTS TO FREE SPACE")), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      marginTop: 4
    }
  }, DAYS.map(d => {
    var list = all[d.n] || [];
    if (list.length === 0) return null;
    var photos = list.filter(m => m.photoId && m.kind !== "video").length;
    var videos = list.filter(m => m.kind === "video").length;
    var isConfirm = confirming === d.n;
    return React.createElement("div", {
      key: d.n,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        borderRadius: 8,
        background: isConfirm ? "rgba(232,93,46,0.10)" : "var(--paper)",
        border: isConfirm ? "1px solid rgba(232,93,46,0.5)" : "1px solid var(--line)"
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--ink)"
      }
    }, d.label, " ", React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 1,
        color: "var(--muted)",
        fontWeight: 600
      }
    }, "· ", list.length, " TOTAL")), (photos > 0 || videos > 0) && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 2,
        fontWeight: 600
      }
    }, photos > 0 && `${photos} PHOTO${photos === 1 ? "" : "S"}`, photos > 0 && videos > 0 && " · ", videos > 0 && `${videos} VIDEO${videos === 1 ? "" : "S"}`)), isConfirm ? React.createElement("div", {
      style: {
        display: "flex",
        gap: 4
      }
    }, React.createElement("button", {
      onClick: () => setConfirming(null),
      disabled: busy,
      className: "mono",
      style: {
        padding: "4px 9px",
        borderRadius: 999,
        background: "transparent",
        border: "1px solid var(--line-2)",
        color: "var(--ink)",
        cursor: "pointer",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700
      }
    }, "CANCEL"), React.createElement("button", {
      onClick: () => handlePurge(d.n),
      disabled: busy,
      className: "mono",
      style: {
        padding: "4px 9px",
        borderRadius: 999,
        background: "var(--ember)",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700
      }
    }, busy ? "..." : "DELETE")) : React.createElement("button", {
      onClick: () => setConfirming(d.n),
      "aria-label": "Clear night",
      className: "mono",
      style: {
        padding: "4px 9px",
        borderRadius: 999,
        background: "transparent",
        border: "1px solid var(--line-2)",
        color: "var(--muted)",
        cursor: "pointer",
        fontSize: 9,
        letterSpacing: 1,
        fontWeight: 700
      }
    }, "CLEAR"));
  })), totalMoments > 0 && React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: "1px solid var(--line)"
    }
  }, confirming === "all" ? React.createElement("div", {
    style: {
      padding: "10px 12px",
      borderRadius: 8,
      background: "rgba(232,93,46,0.10)",
      border: "1px solid rgba(232,93,46,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--ink)"
    }
  }, "Delete all ", totalMoments, " moments?"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      flexShrink: 0
    }
  }, React.createElement("button", {
    onClick: () => setConfirming(null),
    disabled: busy,
    className: "mono",
    style: {
      padding: "5px 10px",
      borderRadius: 999,
      background: "transparent",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, "NO"), React.createElement("button", {
    onClick: () => handlePurge("all"),
    disabled: busy,
    className: "mono",
    style: {
      padding: "5px 10px",
      borderRadius: 999,
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, busy ? "..." : "DELETE ALL"))) : React.createElement("button", {
    onClick: () => setConfirming("all"),
    className: "mono",
    style: {
      padding: "8px 14px",
      width: "100%",
      borderRadius: 8,
      background: "transparent",
      border: "1px dashed var(--line-2)",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "🗑  CLEAR ALL MEMORIES")));
}
function MemoryReel({
  moments,
  festival,
  nightLabel,
  night,
  onClose,
  onOpenArtist,
  onMakeVideo
}) {
  var [idx, setIdx] = React.useState(0);
  var [ended, setEnded] = React.useState(false);
  var [prog, setProg] = React.useState(0);
  var pausedRef = React.useRef(false);
  var [pausedUI, setPausedUI] = React.useState(false);
  var m = moments[idx];
  var url = useMomentPhoto(m?.photoId);
  var vidRef = React.useRef(null);
  var advanceRef = React.useRef(() => {});
  var artist = m?.artistId ? ARTISTS.find(a => a.id === m.artistId) : null;
  var stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  var est = useSetlistSong(artist, m?.takenAt);
  var song = m?.confirmedSong || est?.song;
  var PHOTO_MS = 3800;
  var dur = m?.kind === "video" ? Math.min(m.duration || 6, 15) * 1000 : PHOTO_MS;
  advanceRef.current = () => {
    if (idx + 1 >= moments.length) {
      setEnded(true);
    } else {
      setIdx(idx + 1);
    }
  };
  var setPaused = v => {
    pausedRef.current = v;
    setPausedUI(v);
    var vid = vidRef.current;
    if (vid) {
      if (v) vid.pause();else vid.play().catch(() => {});
    }
  };
  React.useEffect(() => {
    if (ended || !m) return;
    var raf,
      last = performance.now(),
      acc = 0,
      stop = false;
    setProg(0);
    var tick = now => {
      if (stop) return;
      var dt = Math.min(now - last, 100);
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        var p = Math.min(1, acc / dur);
        setProg(p);
        if (p >= 1) {
          advanceRef.current();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
    };
  }, [idx, ended, dur]);
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") advanceRef.current();
      if (e.key === "ArrowLeft") setIdx(i => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  React.useEffect(() => {
    var onVis = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  var holdRef = React.useRef({
    t: null,
    held: false
  });
  var onDown = () => {
    holdRef.current.held = false;
    holdRef.current.t = setTimeout(() => {
      holdRef.current.held = true;
      setPaused(true);
    }, 180);
  };
  var onUp = (e, side) => {
    clearTimeout(holdRef.current.t);
    if (holdRef.current.held) {
      setPaused(false);
      return;
    }
    if (side === "prev") {
      if (idx > 0) setIdx(idx - 1);
    } else advanceRef.current();
  };
  var fmtTime = (() => {
    if (!m?.takenAt) return null;
    try {
      var [h, mm] = (m.takenAt.split(" ")[1] || "").split(":").map(Number);
      var ap = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`;
    } catch {
      return null;
    }
  })();
  var tagged = moments.filter(x => x.artistId).length;
  var vids = moments.filter(x => x.kind === "video").length;
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 250,
      background: "#000",
      overflow: "hidden",
      animation: "fadeIn .2s"
    }
  }, React.createElement("style", null, `@keyframes plurskyKB{from{transform:scale(1.001) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-2%)}}@keyframes reelIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`), !ended ? React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#000"
    }
  }, url && (m.kind === "video" ? React.createElement("video", {
    ref: vidRef,
    key: m.id,
    src: url,
    autoPlay: true,
    playsInline: true,
    muted: true,
    onEnded: () => advanceRef.current(),
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain"
    }
  }) : React.createElement("img", {
    key: m.id,
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      animation: `plurskyKB ${PHOTO_MS + 400}ms linear forwards`,
      animationPlayState: pausedUI ? "paused" : "running"
    }
  })), React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 160,
      background: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent)",
      pointerEvents: "none"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 280,
      background: "linear-gradient(0deg, rgba(0,0,0,0.75), transparent)",
      pointerEvents: "none"
    }
  })), React.createElement("div", {
    onPointerDown: onDown,
    onPointerUp: e => onUp(e, "prev"),
    style: {
      position: "absolute",
      left: 0,
      top: 60,
      bottom: 0,
      width: "33%",
      zIndex: 4
    }
  }), React.createElement("div", {
    onPointerDown: onDown,
    onPointerUp: e => onUp(e, "next"),
    style: {
      position: "absolute",
      right: 0,
      top: 60,
      bottom: 0,
      width: "67%",
      zIndex: 4
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      top: "calc(10px + env(safe-area-inset-top, 0px))",
      left: 12,
      right: 12,
      display: "flex",
      gap: 4,
      zIndex: 6
    }
  }, moments.map((_, i) => React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: 3,
      borderRadius: 3,
      background: "rgba(255,255,255,0.3)",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      height: "100%",
      background: "#fff",
      width: i < idx ? "100%" : i === idx ? `${prog * 100}%` : "0%",
      transition: i === idx ? "none" : "width .2s"
    }
  })))), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      position: "absolute",
      top: "calc(24px + env(safe-area-inset-top, 0px))",
      right: 14,
      zIndex: 7,
      width: 34,
      height: 34,
      borderRadius: 34,
      background: "rgba(0,0,0,0.4)",
      border: "none",
      color: "#fff",
      fontSize: 16,
      cursor: "pointer"
    }
  }, "✕"), React.createElement("div", {
    key: `cap-${idx}`,
    style: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: "calc(34px + env(safe-area-inset-bottom, 0px))",
      zIndex: 6,
      animation: "reelIn .4s ease-out",
      pointerEvents: "none"
    }
  }, fmtTime && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: "rgba(255,255,255,0.75)",
      fontWeight: 700,
      marginBottom: 6
    }
  }, fmtTime), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 34,
      lineHeight: 1,
      color: "#fff"
    }
  }, artist?.name || "A moment"), song && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: stage?.color || "#e85d2e",
      fontWeight: 700,
      marginTop: 8
    }
  }, "♫ ", song, m.confirmedSong ? " · SHAZAMED" : ""), stage && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.6)",
      fontWeight: 600,
      marginTop: 4
    }
  }, stage.name.toUpperCase())), pausedUI && React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 5
    }
  }, React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 64,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 24
    }
  }, "❚❚"))) : React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 30,
      textAlign: "center",
      background: "radial-gradient(120% 80% at 50% 0%, rgba(232,93,46,0.25), #0d0a08 60%)"
    }
  }, React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      position: "absolute",
      top: "calc(24px + env(safe-area-inset-top, 0px))",
      right: 14,
      width: 34,
      height: 34,
      borderRadius: 34,
      background: "rgba(255,255,255,0.12)",
      border: "none",
      color: "#fff",
      fontSize: 16,
      cursor: "pointer"
    }
  }, "✕"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 2,
      color: "rgba(255,255,255,0.6)",
      fontWeight: 700,
      marginBottom: 14
    }
  }, "THAT WAS"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 44,
      lineHeight: 1.05,
      color: "#fff",
      marginBottom: 10
    }
  }, "Your ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, nightLabel || "night")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      letterSpacing: 1.3,
      color: "rgba(255,255,255,0.7)",
      fontWeight: 600
    }
  }, moments.length, " ", moments.length === 1 ? "MOMENT" : "MOMENTS", tagged ? ` · ${tagged} TAGGED` : "", vids ? ` · ${vids} VIDEO${vids === 1 ? "" : "S"}` : ""), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 30
    }
  }, React.createElement("button", {
    onClick: () => {
      setEnded(false);
      setIdx(0);
    },
    className: "mono",
    style: {
      padding: "12px 20px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.14)",
      border: "1px solid rgba(255,255,255,0.3)",
      color: "#fff",
      fontSize: 11,
      letterSpacing: 1.3,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "↺ REPLAY"), React.createElement("button", {
    onClick: async () => {
      if (night != null && window._shareNightCollage) {
        await window._shareNightCollage(night, moments).catch(() => {});
        return;
      }
      var hero = _pickHeroMoment(moments) || moments.find(x => x.kind === "video") || moments.find(x => x.artistId) || moments[0];
      if (!hero) return;
      var a = hero.artistId ? ARTISTS.find(x => x.id === hero.artistId) : null;
      var s = a ? STAGES.find(x => x.id === a.stage) : null;
      await _shareMoment(hero, {
        artistName: a?.name,
        songLabel: hero.confirmedSong || null,
        stageColor: s?.color,
        subLabel: nightLabel,
        festival
      }).catch(() => {});
    },
    className: "mono",
    style: {
      padding: "12px 20px",
      borderRadius: 999,
      background: "#fff",
      border: "none",
      color: "#0d0a08",
      fontSize: 11,
      letterSpacing: 1.3,
      fontWeight: 800,
      cursor: "pointer"
    }
  }, "↗ SHARE")), onMakeVideo && moments.length >= 3 && React.createElement("button", {
    onClick: () => {
      onClose();
      onMakeVideo();
    },
    className: "mono",
    style: {
      marginTop: 14,
      padding: "10px 18px",
      borderRadius: 999,
      background: "transparent",
      border: "1px solid rgba(255,255,255,0.25)",
      color: "rgba(255,255,255,0.85)",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "🎬 CREATE RECAP VIDEO")));
}
function _MemoryStoryBeat({
  moment,
  isLast,
  onOpen
}) {
  var url = useMomentPhoto(moment.photoId);
  var artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  var stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
  var estSong = useSetlistSong(artist, moment.takenAt);
  var song = moment.confirmedSong || estSong?.song;
  var accent = stage?.color || "var(--muted)";
  var time = (() => {
    if (!moment.takenAt) return null;
    try {
      var [h, mm] = (moment.takenAt.split(" ")[1] || "").split(":").map(Number);
      var ap = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${ap}`;
    } catch {
      return null;
    }
  })();
  return React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      position: "relative"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flexShrink: 0,
      width: 14
    }
  }, React.createElement("div", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 11,
      background: accent,
      marginTop: 5,
      boxShadow: `0 0 0 3px ${accent}22`
    }
  }), !isLast && React.createElement("div", {
    style: {
      flex: 1,
      width: 2,
      background: "var(--line)",
      marginTop: 2
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      paddingBottom: 20
    }
  }, time && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 3
    }
  }, time), artist ? React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.05,
      color: "var(--ink)"
    }
  }, artist.name) : React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      fontStyle: "italic",
      color: "var(--muted)"
    }
  }, "A moment"), song && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.8,
      color: accent,
      fontWeight: 700,
      marginTop: 3
    }
  }, "♫ ", song, moment.confirmedSong ? " · SHAZAMED" : ""), stage && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 2
    }
  }, stage.name.toUpperCase()), url && React.createElement("button", {
    onClick: onOpen,
    "aria-label": "Open moment",
    style: {
      marginTop: 8,
      padding: 0,
      border: "none",
      background: "none",
      cursor: "pointer",
      display: "block",
      width: "100%",
      position: "relative"
    }
  }, moment.kind === "video" ? React.createElement(React.Fragment, null, React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      borderRadius: 12,
      display: "block",
      maxHeight: 340,
      objectFit: "cover",
      background: "#000",
      pointerEvents: "none"
    }
  }), React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none"
    }
  }, React.createElement("span", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 52,
      background: "rgba(0,0,0,0.5)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 19,
      paddingLeft: 3
    }
  }, "▶")), React.createElement(_VideoBadge, {
    seconds: moment.duration,
    style: {
      position: "absolute",
      bottom: 8,
      right: 8
    }
  })) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      borderRadius: 12,
      display: "block",
      maxHeight: 340,
      objectFit: "cover"
    }
  }), moment.favorite && React.createElement(_FavBadge, {
    style: {
      top: 8,
      left: 8
    }
  }))));
}
function _ScrubPreview({
  moment
}) {
  var url = useMomentPhoto(moment?.photoId);
  return React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: "hidden",
      border: "1.5px solid var(--ink)",
      background: "#000",
      flexShrink: 0,
      boxShadow: "0 4px 14px rgba(0,0,0,0.4)"
    }
  }, url && (moment.kind === "video" ? React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  })));
}
function NightScrubber({
  moments,
  onSeek
}) {
  var trackRef = React.useRef(null);
  var [active, setActive] = React.useState(null);
  var timed = React.useMemo(() => (moments || []).map(m => ({
    m,
    t: _momentCaptureMs(m)
  })).sort((a, b) => a.t - b.t), [moments]);
  if (timed.length < 2) return null;
  var t0 = timed[0].t,
    t1 = timed[timed.length - 1].t;
  var span = Math.max(1, t1 - t0);
  var fracOf = i => (timed[i].t - t0) / span;
  var idxFromX = clientX => {
    var el = trackRef.current;
    if (!el) return 0;
    var r = el.getBoundingClientRect();
    var f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    var best = 0,
      bd = Infinity;
    for (var i = 0; i < timed.length; i++) {
      var d = Math.abs(fracOf(i) - f);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  var down = e => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    var i = idxFromX(e.clientX);
    if (i !== active) {
      try {
        window.plurskyHaptic?.("LIGHT");
      } catch {}
    }
    setActive(i);
  };
  var move = e => {
    if (active == null) return;
    var i = idxFromX(e.clientX);
    if (i !== active) {
      try {
        window.plurskyHaptic?.("LIGHT");
      } catch {}
      setActive(i);
    }
  };
  var up = () => {
    if (active != null) onSeek?.(active);
    setActive(null);
  };
  var hourMarks = [];
  var firstHour = Math.ceil(t0 / 3600000) * 3600000;
  for (var h = firstHour; h <= t1; h += 3600000) hourMarks.push(h);
  var activeFrac = active != null ? fracOf(active) : null;
  return React.createElement("div", {
    style: {
      marginBottom: 16,
      userSelect: "none"
    }
  }, React.createElement("div", {
    style: {
      height: 66,
      display: "flex",
      alignItems: "flex-end",
      marginBottom: 4,
      position: "relative"
    }
  }, active != null && React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: `clamp(0px, ${activeFrac * 100}%, 100%)`,
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      pointerEvents: "none"
    }
  }, React.createElement(_ScrubPreview, {
    moment: timed[active].m
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1,
      color: "var(--ink)",
      fontWeight: 700
    }
  }, _clock12(timed[active].t)))), React.createElement("div", {
    ref: trackRef,
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: up,
    onPointerCancel: up,
    role: "slider",
    "aria-label": "Scrub the night by time",
    "aria-valuemin": 0,
    "aria-valuemax": timed.length - 1,
    "aria-valuenow": active ?? 0,
    style: {
      position: "relative",
      height: 26,
      cursor: "pointer",
      touchAction: "none"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 11,
      height: 4,
      borderRadius: 4,
      background: "var(--line)"
    }
  }), hourMarks.map((h, i) => {
    var f = (h - t0) / span;
    return React.createElement("div", {
      key: `h${i}`,
      style: {
        position: "absolute",
        left: `${f * 100}%`,
        top: 7,
        width: 1,
        height: 12,
        background: "var(--line-2)"
      }
    });
  }), timed.map((x, i) => {
    var on = i === active;
    var fav = x.m.favorite;
    return React.createElement("div", {
      key: x.m.id,
      style: {
        position: "absolute",
        left: `${fracOf(i) * 100}%`,
        top: on ? 4 : 8,
        transform: "translateX(-50%)",
        width: on ? 4 : 3,
        height: on ? 18 : 10,
        borderRadius: 3,
        background: fav ? "#f5c451" : on ? "var(--ink)" : "var(--ember)",
        opacity: on ? 1 : 0.7,
        transition: "all .08s ease"
      }
    });
  })), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 2
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.8,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, _clock12(t0)), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.8,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, _clock12(t1))));
}
function MemoryStory({
  allMoments,
  state,
  setState,
  onOpenLightbox,
  onPlayReel
}) {
  var [night, setNight] = React.useState(() => {
    var nights = [...new Set(allMoments.map(m => m.night))].sort((a, b) => a - b);
    return nights[0] || NOW.day || 1;
  });
  var nights = React.useMemo(() => [...new Set(allMoments.map(m => m.night))].sort((a, b) => a - b), [allMoments]);
  var beats = React.useMemo(() => {
    return allMoments.filter(m => m.night === night).sort((a, b) => {
      var ta = a.takenAt || "",
        tb = b.takenAt || "";
      if (ta && tb) return ta.localeCompare(tb);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [allMoments, night]);
  if (allMoments.length === 0) {
    return React.createElement("div", {
      style: {
        padding: "28px 14px",
        textAlign: "center",
        marginTop: 18,
        border: "1px dashed var(--line-2)",
        borderRadius: 14,
        background: "var(--paper-2)"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "NO MOMENTS YET — IMPORT FROM CAMERA ROLL ABOVE"));
  }
  var dayMeta = DAYS.find(d => d.n === night);
  return React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, nights.length > 1 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16
    }
  }, nights.map(n => {
    var dm = DAYS.find(d => d.n === n);
    var on = n === night;
    return React.createElement("button", {
      key: n,
      onClick: () => setNight(n),
      className: "mono",
      style: {
        flex: 1,
        padding: "8px 0",
        borderRadius: 8,
        background: on ? "var(--ink)" : "var(--paper-2)",
        color: on ? "var(--paper)" : "var(--muted)",
        border: on ? "none" : "1px solid var(--line)",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, dm?.label || `DAY ${n}`);
  })), React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 26,
      lineHeight: 1,
      color: "var(--ink)"
    }
  }, dayMeta ? dayMeta.label.charAt(0) + dayMeta.label.slice(1).toLowerCase() : `Night ${night}`, " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "night")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 4,
      fontWeight: 700
    }
  }, beats.length, " ", beats.length === 1 ? "MOMENT" : "MOMENTS", " · YOUR STORY")), React.createElement(NightScrubber, {
    moments: beats,
    onSeek: i => onOpenLightbox(beats, i)
  }), beats.length >= 2 && onPlayReel && React.createElement("button", {
    onClick: () => onPlayReel(beats, dayMeta ? dayMeta.label.charAt(0) + dayMeta.label.slice(1).toLowerCase() + " night" : `Night ${night}`, night),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      width: "100%",
      marginBottom: 18,
      padding: "13px 16px",
      borderRadius: 14,
      background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
      border: "none",
      color: "#fff",
      cursor: "pointer"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, "▶"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      letterSpacing: 1.4,
      fontWeight: 800
    }
  }, "PLAY"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 600,
      opacity: 0.8
    }
  }, "· ", beats.length, " BEATS")), beats.map((m, i) => React.createElement(_MemoryStoryBeat, {
    key: m.id,
    moment: m,
    isLast: i === beats.length - 1,
    onOpen: () => onOpenLightbox(beats, i)
  })));
}
function _LazyMount({
  children,
  placeholder,
  minHeight = 120,
  rootMargin = "800px 0px",
  style
}) {
  var ref = React.useRef(null);
  var [visible, setVisible] = React.useState(false);
  var [measured, setMeasured] = React.useState(null);
  React.useEffect(() => {
    var el = ref.current;
    if (!el) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    var obs = new IntersectionObserver(entries => {
      var e = entries[entries.length - 1];
      if (e.isIntersecting) {
        setVisible(true);
      } else {
        var h = el.offsetHeight;
        if (h) setMeasured(h);
        setVisible(false);
      }
    }, {
      rootMargin
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return React.createElement("div", {
    ref: ref,
    style: style
  }, visible ? children : placeholder != null ? placeholder : React.createElement("div", {
    "aria-hidden": "true",
    style: {
      height: measured || minHeight
    }
  }));
}
function _GridTile({
  moment,
  onClick,
  stackCount = 1
}) {
  var url = useMomentPhoto(moment.photoId);
  var artist = moment.artistId ? ARTISTS.find(a => a.id === moment.artistId) : null;
  var stacked = stackCount > 1;
  return React.createElement("button", {
    onClick: onClick,
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 10,
      overflow: "hidden",
      border: "1px solid var(--line)",
      background: url ? "#000" : "var(--paper-2)",
      padding: 0,
      cursor: "pointer",
      boxShadow: stacked ? "2.5px 2.5px 0 -0.5px var(--paper-2), 2.5px 2.5px 0 0 var(--line), 5px 5px 0 -1px var(--paper-2), 5px 5px 0 -0.5px var(--line)" : "none"
    }
  }, url ? moment.kind === "video" ? React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none"
    }
  }) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : React.createElement("div", {
    className: "skel",
    style: {
      width: "100%",
      height: "100%"
    }
  }), moment.kind === "video" && React.createElement(_VideoBadge, {
    seconds: moment.duration,
    style: {
      position: "absolute",
      top: 5,
      right: 5
    }
  }), stacked && React.createElement("span", {
    className: "mono",
    "aria-label": `Burst of ${stackCount}`,
    style: {
      position: "absolute",
      top: 5,
      right: 5,
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      background: "rgba(0,0,0,0.6)",
      color: "#fff",
      fontSize: 8,
      letterSpacing: 0.5,
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: 999,
      pointerEvents: "none"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 9
    }
  }, "⧉"), stackCount), moment.favorite && React.createElement(_FavBadge, {
    style: {
      top: 5,
      left: 5
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      background: "linear-gradient(0deg, rgba(0,0,0,0.8), transparent)",
      padding: "16px 6px 5px"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 7.5,
      letterSpacing: 0.5,
      color: artist ? "#fff" : "rgba(255,255,255,0.7)",
      fontWeight: 700,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, artist ? artist.name.toUpperCase() : "+ TAP TO TAG")));
}
function _stackBursts(sorted, burstMs) {
  burstMs = burstMs || 4000;
  var stageOf = m => m.stageId || (m.artistId ? ARTISTS.find(a => a.id === m.artistId)?.stage : null) || null;
  var stacks = [];
  for (var m of sorted) {
    var last = stacks[stacks.length - 1];
    var t = _momentCaptureMs(m);
    if (last && m.kind === "image" && last.kind === "image" && (last.artistId || null) === (m.artistId || null) && (last.stageId || null) === stageOf(m) && Math.abs(last._t - t) <= burstMs) {
      last.items.push(m);
      last._t = t;
    } else {
      stacks.push({
        items: [m],
        kind: m.kind,
        artistId: m.artistId || null,
        stageId: stageOf(m),
        _t: t
      });
    }
  }
  return stacks;
}
function MemoryGrid({
  allMoments,
  onOpenLightbox
}) {
  var sorted = React.useMemo(() => allMoments.filter(m => m.photoId).slice().sort((a, b) => {
    var ta = a.takenAt || "",
      tb = b.takenAt || "";
    if (ta && tb) return tb.localeCompare(ta);
    return (b.createdAt || 0) - (a.createdAt || 0);
  }), [allMoments]);
  var stacks = React.useMemo(() => _stackBursts(sorted), [sorted]);
  if (!sorted.length) return null;
  return React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 6,
      marginTop: 4
    }
  }, stacks.map(st => {
    var hero = (st.items.length > 1 ? _pickHeroMoment(st.items) : st.items[0]) || st.items[0];
    var idx = sorted.indexOf(hero);
    return React.createElement(_LazyMount, {
      key: hero.id,
      rootMargin: "600px 0px",
      style: {
        aspectRatio: "1 / 1"
      },
      placeholder: React.createElement("div", {
        className: "skel",
        style: {
          width: "100%",
          height: "100%",
          borderRadius: 10
        }
      })
    }, React.createElement(_GridTile, {
      moment: hero,
      stackCount: st.items.length,
      onClick: () => onOpenLightbox(sorted, idx < 0 ? 0 : idx)
    }));
  }));
}
function MemoriesMapLens({
  moments,
  onPinTap
}) {
  var {
    pins,
    unplaced
  } = React.useMemo(() => {
    var byStage = new Map();
    var unplaced = 0;
    var _loop3 = function (m) {
        if (!m.photoId) return 0;
        var stageId = null;
        if (m.parsedGps && typeof gpsToMap === "function") {
          var p = gpsToMap(m.parsedGps.lat, m.parsedGps.lng);
          if (p && typeof _nearestStageId === "function") stageId = _nearestStageId(p.x, p.y);
        }
        var a = m.artistId ? ARTISTS.find(x => x.id === m.artistId) : null;
        if (!stageId && a) stageId = a.stage;
        var stage = stageId ? STAGES.find(s => s.id === stageId) : null;
        if (!stage) {
          unplaced++;
          return 0;
        }
        if (!byStage.has(stageId)) byStage.set(stageId, []);
        byStage.get(stageId).push(m);
      },
      _ret;
    for (var m of moments || []) {
      _ret = _loop3(m);
      if (_ret === 0) continue;
    }
    var pins = [...byStage.entries()].map(([id, items]) => ({
      id,
      items,
      stage: STAGES.find(s => s.id === id)
    })).sort((a, b) => b.items.length - a.items.length);
    return {
      pins,
      unplaced
    };
  }, [moments]);
  if (!pins.length) {
    return React.createElement("div", {
      style: {
        padding: "28px 14px",
        textAlign: "center",
        marginTop: 14,
        border: "1px dashed var(--line-2)",
        borderRadius: 14,
        background: "var(--paper-2)"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "NO LOCATED MOMENTS YET — TAG A SET OR IMPORT GPS PHOTOS"));
  }
  var img = typeof FESTIVAL_CONFIG !== "undefined" ? FESTIVAL_CONFIG.mapImage : null;
  return React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid var(--line)",
      background: "#0a0f0b"
    }
  }, React.createElement("svg", {
    viewBox: "0 0 100 100",
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid slice",
    style: {
      position: "absolute",
      inset: 0,
      display: "block"
    }
  }, img && React.createElement("image", {
    href: img,
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    preserveAspectRatio: "xMidYMid slice",
    opacity: "0.65"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "rgba(8,7,11,0.42)"
  }), pins.map(p => {
    var s = p.stage,
      c = p.items.length;
    var r = 3 + Math.min(6, Math.log2(c + 1) * 1.7);
    return React.createElement("g", {
      key: p.id,
      onClick: () => onPinTap?.(p),
      style: {
        cursor: "pointer"
      }
    }, React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: r + 1.6,
      fill: s.color,
      opacity: "0.22"
    }), React.createElement("circle", {
      cx: s.x,
      cy: s.y,
      r: r,
      fill: s.color,
      opacity: "0.92",
      stroke: "#fff",
      strokeWidth: "0.5"
    }), React.createElement("text", {
      x: s.x,
      y: s.y,
      textAnchor: "middle",
      dominantBaseline: "central",
      fontSize: Math.max(2.4, r * 0.9),
      fontWeight: "800",
      fill: "#fff",
      fontFamily: "ui-monospace, monospace",
      style: {
        pointerEvents: "none"
      }
    }, c));
  }))), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10
    }
  }, pins.map(p => React.createElement("button", {
    key: p.id,
    onClick: () => onPinTap?.(p),
    className: "mono",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      background: `${p.stage.color}1a`,
      color: p.stage.color,
      border: `1px solid ${p.stage.color}44`,
      borderRadius: 999,
      padding: "5px 10px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 7,
      background: p.stage.color
    }
  }), (p.stage.short || p.stage.name).toUpperCase(), " · ", p.items.length))), unplaced > 0 && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 600,
      marginTop: 8,
      opacity: 0.8
    }
  }, "+", unplaced, " UNTAGGED MOMENT", unplaced === 1 ? "" : "S", " NOT ON THE MAP"));
}
function _idHash(id) {
  var h = 0;
  var s = String(id || "");
  for (var i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0;
  return h >>> 0;
}
function _idJitter(id, amp = 2.6) {
  var h = _idHash(id);
  var ang = h % 997 / 997 * Math.PI * 2;
  var rad = amp * (0.35 + 0.65 * ((h >>> 9) % 991 / 991));
  return {
    dx: Math.cos(ang) * rad,
    dy: Math.sin(ang) * rad
  };
}
function _momentTime(m) {
  if (m && m.takenAt) {
    var t = Date.parse(m.takenAt.replace(" ", "T"));
    if (!isNaN(t)) return t;
  }
  return m && m.createdAt || 0;
}
function _PhotoPin({
  cluster,
  onTap
}) {
  var m = cluster.face;
  var url = useMomentPhoto(m.photoId, cluster.enabled !== false);
  var ring = cluster.stage && cluster.stage.color || "#9aa";
  var rot = _idHash(m.id) % 17 - 8;
  var extra = cluster.items.length - 1;
  var SIZE = cluster.items.length > 1 ? 52 : 46;
  return React.createElement("button", {
    onClick: () => onTap && onTap(cluster),
    style: {
      position: "absolute",
      left: cluster.x + "%",
      top: cluster.y + "%",
      transform: `translate(-50%,-50%) rotate(${rot}deg)`,
      width: SIZE,
      height: SIZE,
      padding: 0,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      zIndex: 2 + Math.min(40, cluster.items.length)
    }
  }, React.createElement("div", {
    style: {
      width: "100%",
      height: "100%",
      borderRadius: 10,
      overflow: "hidden",
      border: `2px solid ${ring}`,
      background: url ? "#000" : "var(--paper-2)",
      boxShadow: "0 3px 9px rgba(0,0,0,0.5)"
    }
  }, url ? m.kind === "video" ? React.createElement("video", {
    src: url + "#t=0.1",
    muted: true,
    playsInline: true,
    preload: "metadata",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      pointerEvents: "none"
    }
  }) : React.createElement("img", {
    src: url,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : React.createElement("div", {
    className: "skel",
    style: {
      width: "100%",
      height: "100%"
    }
  })), m.kind === "video" && React.createElement("span", {
    className: "mono",
    style: {
      position: "absolute",
      bottom: 3,
      left: 3,
      display: "inline-flex",
      alignItems: "center",
      background: "rgba(0,0,0,0.62)",
      color: "#fff",
      fontSize: 7,
      fontWeight: 800,
      padding: "1px 4px",
      borderRadius: 999,
      pointerEvents: "none"
    }
  }, "▶"), extra > 0 && React.createElement("span", {
    className: "mono",
    style: {
      position: "absolute",
      top: -7,
      right: -7,
      minWidth: 17,
      height: 17,
      padding: "0 3px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: ring,
      color: "#fff",
      fontSize: 9,
      fontWeight: 800,
      borderRadius: 999,
      border: "1.5px solid #fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      pointerEvents: "none"
    }
  }, "+", extra));
}
function MemoriesPhotoMapLens({
  moments,
  onPinTap
}) {
  var CAP = 24,
    CLUSTER_R = 6;
  var {
    clusters,
    hidden,
    unplaced
  } = React.useMemo(() => {
    var placed = [];
    var unplaced = 0;
    var _loop4 = function (m) {
        if (!m.photoId) return 0;
        var xy = null,
          stageId = null;
        if (m.parsedGps && typeof gpsToMap === "function") {
          var p = gpsToMap(m.parsedGps.lat, m.parsedGps.lng);
          if (p) {
            xy = {
              x: p.x,
              y: p.y
            };
            if (typeof _nearestStageId === "function") stageId = _nearestStageId(p.x, p.y);
          }
        }
        if (!xy) {
          var a = m.artistId ? ARTISTS.find(x => x.id === m.artistId) : null;
          var _stage = a ? STAGES.find(s => s.id === a.stage) : null;
          if (!_stage || !Number.isFinite(_stage.x) || !Number.isFinite(_stage.y)) {
            unplaced++;
            return 0;
          }
          var _j = _idJitter(m.id);
          xy = {
            x: _stage.x + _j.dx,
            y: _stage.y + _j.dy
          };
          stageId = _stage.id;
        }
        if (!stageId && typeof _nearestStageId === "function") stageId = _nearestStageId(xy.x, xy.y);
        var stage = stageId ? STAGES.find(s => s.id === stageId) : null;
        placed.push({
          m,
          x: xy.x,
          y: xy.y,
          stage,
          t: _momentTime(m)
        });
      },
      _ret2;
    for (var m of moments || []) {
      _ret2 = _loop4(m);
      if (_ret2 === 0) continue;
    }
    var sorted = placed.slice().sort((a, b) => b.t - a.t);
    var used = new Array(sorted.length).fill(false);
    var clusters = [];
    for (var i = 0; i < sorted.length; i++) {
      if (used[i]) continue;
      var head = sorted[i];
      used[i] = true;
      var group = [head];
      for (var j = i + 1; j < sorted.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(sorted[j].x - head.x, sorted[j].y - head.y) <= CLUSTER_R) {
          used[j] = true;
          group.push(sorted[j]);
        }
      }
      clusters.push({
        x: head.x,
        y: head.y,
        stage: head.stage,
        face: head.m,
        items: group.map(g => g.m)
      });
    }
    var visible = clusters.slice(0, CAP);
    var hidden = clusters.slice(CAP).reduce((n, c) => n + c.items.length, 0);
    return {
      clusters: visible,
      hidden,
      unplaced
    };
  }, [moments]);
  if (!clusters.length) {
    return React.createElement("div", {
      style: {
        padding: "28px 14px",
        textAlign: "center",
        marginTop: 14,
        border: "1px dashed var(--line-2)",
        borderRadius: 14,
        background: "var(--paper-2)"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "NOTHING TO MAP YET — IMPORT GPS PHOTOS OR TAG SETS"));
  }
  var img = typeof FESTIVAL_CONFIG !== "undefined" ? FESTIVAL_CONFIG.mapImage : null;
  return React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      aspectRatio: "1 / 1",
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid var(--line)",
      background: "#0a0f0b"
    }
  }, React.createElement("svg", {
    viewBox: "0 0 100 100",
    width: "100%",
    height: "100%",
    preserveAspectRatio: "xMidYMid slice",
    style: {
      position: "absolute",
      inset: 0,
      display: "block"
    }
  }, img && React.createElement("image", {
    href: img,
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    preserveAspectRatio: "xMidYMid slice",
    opacity: "0.6"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: "rgba(8,7,11,0.5)"
  })), clusters.map((c, i) => React.createElement(_PhotoPin, {
    key: c.face.id || i,
    cluster: c,
    onTap: onPinTap
  }))), (hidden > 0 || unplaced > 0) && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 600,
      marginTop: 8,
      opacity: 0.85,
      display: "flex",
      flexWrap: "wrap",
      gap: 10
    }
  }, hidden > 0 && React.createElement("span", null, "+", hidden, " MORE THUMBNAIL", hidden === 1 ? "" : "S", " CLUSTERED"), unplaced > 0 && React.createElement("span", null, "+", unplaced, " UNTAGGED NOT ON THE MAP")));
}
function MemoriesMapTab({
  moments,
  onPinTap
}) {
  var [mode, setMode] = React.useState(() => {
    try {
      return localStorage.getItem("plursky_maplens_mode") === "photos" ? "photos" : "clusters";
    } catch {
      return "clusters";
    }
  });
  var pick = m => {
    setMode(m);
    try {
      localStorage.setItem("plursky_maplens_mode", m);
    } catch {}
  };
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      padding: 3,
      background: "var(--paper-2)",
      borderRadius: 9,
      border: "1px solid var(--line)"
    }
  }, [{
    id: "clusters",
    label: "CLUSTERS"
  }, {
    id: "photos",
    label: "PHOTOS"
  }].map(o => {
    var on = mode === o.id;
    return React.createElement("button", {
      key: o.id,
      onClick: () => pick(o.id),
      className: "mono",
      style: {
        flex: 1,
        padding: "6px 0",
        borderRadius: 7,
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--paper)" : "var(--muted)",
        border: "none",
        cursor: "pointer",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700
      }
    }, o.label);
  })), mode === "photos" ? React.createElement(MemoriesPhotoMapLens, {
    moments: moments,
    onPinTap: onPinTap
  }) : React.createElement(MemoriesMapLens, {
    moments: moments,
    onPinTap: onPinTap
  }));
}
function _NightMap({
  moments,
  onPinTap
}) {
  var [open, setOpen] = React.useState(false);
  if (!moments || !moments.length) return null;
  return React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    className: "mono",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      padding: "9px 12px",
      borderRadius: 10,
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, React.createElement("span", null, "📍 WHERE THIS NIGHT HAPPENED"), React.createElement("span", null, open ? "▾" : "▸")), open && React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement(MemoriesMapTab, {
    moments: moments,
    onPinTap: onPinTap
  })));
}
function _NightShareMenu({
  night,
  moments
}) {
  var [open, setOpen] = React.useState(false);
  return React.createElement("div", {
    style: {
      position: "relative",
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    className: "mono",
    style: {
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, "📸 SHARE ▾"), open && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 4
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      right: 0,
      top: "calc(100% + 4px)",
      zIndex: 5,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderRadius: 10,
      boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
      overflow: "hidden",
      minWidth: 140
    }
  }, [["📸 Collage", undefined], ["🎬 Animated GIF", "gif"], ["🎞 Night video", "video"]].map(([lbl, mode], i) => React.createElement("button", {
    key: lbl,
    onClick: () => {
      setOpen(false);
      if (mode === "video") {
        window._shareScopedRecap?.({
          scope: "night",
          night,
          moments
        });
        return;
      }
      window._shareNightCollage?.(night, moments, mode);
    },
    className: "mono",
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      background: "transparent",
      border: "none",
      borderTop: i ? "1px solid var(--line)" : "none",
      padding: "10px 12px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 0.6,
      color: "var(--ink)",
      fontWeight: 600
    }
  }, lbl)))));
}
function MemoriesScreen({
  state,
  setState
}) {
  var [rawAll, setAll] = React.useState(_readMoments);
  var all = React.useMemo(() => _activeMoments(rawAll), [rawAll]);
  var [adding, setAdding] = React.useState(null);
  var [batch, setBatch] = React.useState(null);
  var [lightbox, setLightbox] = React.useState(null);
  var [reel, setReel] = React.useState(null);
  var [backupBusy, setBackupBusy] = React.useState(false);
  var [backupProg, setBackupProg] = React.useState(null);
  var [showPlus, setShowPlus] = React.useState(false);
  var batchInputRef = React.useRef(null);
  var nightSectionRefs = React.useRef({});
  var openLightbox = React.useCallback((moments, index) => setLightbox({
    moments,
    index
  }), []);
  var playReel = React.useCallback((moments, label, night) => {
    if (moments?.length) setReel({
      moments,
      label,
      night
    });
  }, []);
  React.useEffect(() => {
    var refresh = () => {
      try {
        setAll(_readMoments());
      } catch {}
    };
    window.addEventListener("plursky-moments-change", refresh);
    return () => window.removeEventListener("plursky-moments-change", refresh);
  }, []);
  React.useEffect(() => {
    if (!state.memoriesNight) return;
    var id = requestAnimationFrame(() => {
      var el = nightSectionRefs.current[state.memoriesNight];
      if (el?.scrollIntoView) el.scrollIntoView({
        behavior: "instant",
        block: "start"
      });
      setState(s => ({
        ...s,
        memoriesNight: null
      }));
    });
    return () => cancelAnimationFrame(id);
  }, [state.memoriesNight]);
  var handleAdd = moment => {
    var next = {
      ..._readMoments()
    };
    next[moment.night] = [...(next[moment.night] || []), moment];
    _writeMoments(next);
    setAll(next);
    setAdding(null);
  };
  var handleBatchPick = async e => {
    var files = Array.from(e.target.files || []);
    e.target.value = "";
    return processImportedFiles(files);
  };
  var _fileFingerprint = async file => {
    try {
      var slice = file.slice(0, 2048);
      var buf = await slice.arrayBuffer();
      var bytes = new Uint8Array(buf);
      var h = 0x811c9dc5;
      for (var i = 0; i < bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193);
      }
      return `${(h >>> 0).toString(36)}_${file.size}_${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
    } catch {
      return null;
    }
  };
  var processImportedFiles = async files => {
    if (files.length === 0) {
      window.plurskyToast?.("No photos received — pick a few at a time; if they're in iCloud, open them in Photos first so they download.");
      return;
    }
    var results = [];
    setBatch({
      total: files.length,
      done: 0,
      results
    });
    var savedIds = state.saved || [];
    var attendedIds = Object.values(window.getAllAttended?.() || {}).flat();
    var current = {
      ..._readMoments()
    };
    var existingFingerprints = new Set();
    for (var moments of Object.values(current)) {
      for (var m of moments) {
        if (m._fingerprint) existingFingerprints.add(m._fingerprint);
      }
    }
    var allNights = Object.keys(window.FESTIVAL_CONFIG?.dayDates || {}).map(Number).sort((a, b) => a - b);
    var fallbackNight = window.NOW?.day && allNights.includes(window.NOW.day) ? window.NOW.day : allNights[allNights.length - 1] || 1;
    var skippedDupes = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      try {
        var fp = await _fileFingerprint(f);
        if (fp && existingFingerprints.has(fp)) {
          skippedDupes++;
          results.push({
            name: f.name,
            night: null,
            artistId: null,
            skipped: "duplicate"
          });
          setBatch({
            total: files.length,
            done: i + 1,
            results: results.slice()
          });
          continue;
        }
        var exif = await _parseExifMeta(f).catch(() => null);
        var baseMeta = _metaFromFile(f, exif);
        var recovered = _recoverVideoMetaFromArchive(f, fp, baseMeta);
        var meta = recovered?.meta || baseMeta;
        var matched = meta?.date ? _matchArtistForPhoto(meta, savedIds, attendedIds) : {
          artistId: null,
          night: null,
          reason: "no_date"
        };
        var night = matched.night || fallbackNight;
        var hadExifDate = !!exif?.date;
        var hadFileTime = meta?.takenAtSource === "file-lastModified";
        var hadTrustedMeta = !!meta?.date && meta.takenAtSource !== "file-lastModified" && meta.takenAtSource !== "none";
        var tagSource = recovered ? "archive-recovered" : matched.reason === "stage_time_proximity" ? "stage-neighbor" : matched.reason === "off_stage" ? "off_stage" : matched.artistId && hadExifDate ? "exif" : matched.artistId && /^video-/.test(meta?.takenAtSource || "") ? "video-metadata" : matched.artistId && hadTrustedMeta ? meta.takenAtSource : matched.artistId && hadFileTime ? "filetime" : matched.night && hadExifDate ? "exif-night-only" : matched.night && /^video-/.test(meta?.takenAtSource || "") ? "video-night-only" : matched.night && hadTrustedMeta ? `${meta.takenAtSource}-night-only` : matched.night && hadFileTime ? "filetime-night-only" : "fallback";
        var out = await _processMomentMedia(f);
        var id = `m_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        var photoId = `p_${id}`;
        await _putPhoto(photoId, out.blob);
        var moment = {
          id,
          night,
          text: "",
          artistId: matched.artistId,
          photoId,
          kind: out.kind,
          duration: out.duration ?? null,
          createdAt: Date.now(),
          takenAt: _momentDatePartsToTakenAt(matched?.localDate || meta?.date),
          takenAtSource: meta?.takenAtSource || "none",
          locationSource: meta?.locationSource || (meta?.lat != null && meta?.lng != null ? "gps" : "none"),
          importedAt: new Date().toISOString(),
          needsRetag: out.kind === "video" && !recovered && (!meta?.takenAtSource || meta.takenAtSource === "file-lastModified" || meta.takenAtSource === "none"),
          autoTagged: !!(matched.artistId || recovered?.moment?.artistId),
          tagSource,
          nativePath: out.kind === "video" ? f.nativePath || null : null,
          tagAmbiguous: !!(matched.artistId && matched.ambiguous),
          anchorSource: matched.anchorSource || null,
          gpsAccM: meta?.acc != null ? Math.round(meta.acc) : null,
          gpsRejected: !!matched.gpsRejected,
          dateUnverified: !!meta?.dateUnverified,
          dateUnverifiedDeltaS: meta?.dateUnverifiedDeltaS ?? null,
          heading: meta?.heading != null ? Math.round(meta.heading) : null,
          headingRef: meta?.headingRef || null,
          festivalId: matched.festivalId || window.FESTIVAL_CONFIG?.id || null,
          parsedGps: meta?.lat != null && meta?.lng != null ? {
            lat: meta.lat,
            lng: meta.lng
          } : null,
          location: matched.location || null,
          hasGps: !!(meta?.lat != null && meta?.lng != null),
          fileType: f.type || null,
          _fingerprint: fp || null
        };
        if (recovered?.moment?.artistId && !moment.artistId) moment.artistId = recovered.moment.artistId;
        if (fp) existingFingerprints.add(fp);
        current[night] = [...(current[night] || []), moment];
        results.push({
          name: f.name,
          night,
          artistId: matched.artistId,
          fallback: !matched.night,
          tagSource,
          festivalId: moment.festivalId
        });
        _writeMoments(current);
        setAll({
          ...current
        });
      } catch (err) {
        results.push({
          name: f.name,
          night: null,
          artistId: null,
          err: err?.message || "failed"
        });
      }
      setBatch({
        total: files.length,
        done: i + 1,
        results: results.slice()
      });
    }
    _writeMoments(current);
    setAll({
      ...current
    });
    var okCount = results.filter(r => !r.err && !r.skipped).length;
    var activeFid = window.FESTIVAL_CONFIG?.id || null;
    var elsewhere = results.filter(r => !r.err && !r.skipped && r.festivalId && r.festivalId !== activeFid);
    if (elsewhere.length) {
      var byFest = {};
      for (var r of elsewhere) byFest[r.festivalId] = (byFest[r.festivalId] || 0) + 1;
      var label = id => window._DATA_SETS?.[id]?.config?.shortName || window._DATA_SETS?.[id]?.config?.name || id;
      var parts = Object.keys(byFest).map(id => `${byFest[id]} to ${label(id)}`);
      window.plurskyToast?.(`Filed by capture date — ${parts.join(", ")}. Switch festivals to see them.`);
    }
    if (okCount === 0) {
      var failed = results.filter(r => r.err).length;
      var dupes = results.filter(r => r.skipped === "duplicate").length;
      if (dupes && !failed) window.plurskyToast?.(`Already imported — ${dupes} duplicate${dupes === 1 ? "" : "s"} skipped`);else window.plurskyToast?.(`Couldn't import ${failed} file${failed === 1 ? "" : "s"} — try a few at a time${failed ? ` · ${results.find(r => r.err)?.err || "failed"}` : ""}`);
    }
    setTimeout(() => setBatch(b => b && b.done === b.total ? null : b), 6000);
  };
  var handleDelete = async moment => {
    if (!window.confirm("Delete this moment?")) return;
    if (moment.photoId) {
      try {
        await _deletePhoto(moment.photoId);
      } catch {}
    }
    var next = {
      ..._readMoments()
    };
    for (var n of Object.keys(next)) {
      next[n] = (next[n] || []).filter(m => m.id !== moment.id);
    }
    _writeMoments(next);
    setAll(next);
  };
  var pickViaNative = async () => {
    var cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !window.__USE_NATIVE_PICKER__) return null;
    var FilePicker = cap.Plugins?.FilePicker;
    if (!FilePicker?.pickMedia) return null;
    try {
      var result = await FilePicker.pickMedia({
        skipTranscoding: false,
        limit: 50,
        readData: false
      });
      var files = result?.files || [];
      if (files.length === 0) return [];
      var out = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var src = f.path ? cap.convertFileSrc ? cap.convertFileSrc(f.path) : f.path : null;
        if (!src) continue;
        var blob = await fetch(src).then(r => r.blob());
        var isVideo = /^video\//.test(f.mimeType || "") || /\.(mov|mp4|m4v)$/i.test(f.name || "");
        var type = f.mimeType || blob.type || (isVideo ? "video/mp4" : "image/jpeg");
        var name = f.name || `pick-${i}.${isVideo ? "mp4" : "jpg"}`;
        var pickedFile = new File([blob], name, {
          type,
          lastModified: f.modifiedAt || Date.now()
        });
        if (isVideo && f.path) {
          try {
            Object.defineProperty(pickedFile, "nativePath", {
              value: f.path
            });
          } catch {
            pickedFile.nativePath = f.path;
          }
        }
        out.push(pickedFile);
      }
      return out;
    } catch (err) {
      console.warn('[memories] native pickMedia failed; falling back to web input', err);
      return null;
    }
  };
  var handlePickClick = async () => {
    var nativeFiles = await pickViaNative();
    if (nativeFiles && nativeFiles.length > 0) {
      await processImportedFiles(nativeFiles);
    } else if (nativeFiles === null) {
      batchInputRef.current?.click();
    }
  };
  var handleUpdate = (moment, patch) => {
    var next = {
      ..._readMoments()
    };
    for (var n of Object.keys(next)) {
      next[n] = (next[n] || []).map(m => m.id === moment.id ? {
        ...m,
        ...patch
      } : m);
    }
    _writeMoments(next);
    setAll(next);
  };
  var handleRecoverNight = (moment, rec) => {
    if (!moment || !rec || rec.night == null) return;
    var next = {
      ..._readMoments()
    };
    var to = String(rec.night);
    var found = null;
    for (var n of Object.keys(next)) {
      var arr = next[n] || [];
      var hit = arr.find(m => m.id === moment.id);
      if (!hit) continue;
      found = {
        ...hit,
        night: rec.night,
        artistId: rec.artistId,
        tagSource: "song-recovered",
        autoTagged: false,
        dateUnverified: false,
        needsRetag: false,
        tagAmbiguous: false
      };
      next[n] = arr.filter(m => m.id !== moment.id);
    }
    if (!found) return;
    next[to] = [...(next[to] || []), found];
    _writeMoments(next);
    setAll(next);
    try {
      window.plurskyHaptic?.("MEDIUM");
    } catch {}
    if (found.night != null && typeof markAttended === "function") {
      try {
        markAttended(found.night, found.artistId, "shazam");
      } catch {}
    }
  };
  var totalCount = Object.values(all).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
  var [view, setView] = React.useState(() => {
    try {
      var v = localStorage.getItem("plursky_memories_view_v1");
      if (["grid", "night"].includes(v)) return v;
      if (["story", "map", "artist", "stage"].includes(v)) return "night";
    } catch {}
    return "grid";
  });
  var [memQuery, setMemQuery] = React.useState("");
  var [manage, setManage] = React.useState(false);
  React.useEffect(() => {
    try {
      localStorage.setItem("plursky_memories_view_v1", view);
    } catch {}
  }, [view]);
  var allMoments = React.useMemo(() => {
    var out = [];
    for (var n of Object.keys(all)) {
      for (var m of all[n] || []) out.push(m);
    }
    return out;
  }, [all]);
  var [autoOn, setAutoOn] = React.useState(() => _autoBackupOn());
  var _autoBusy = React.useRef(false);
  var everyMoment = React.useMemo(() => Object.values(rawAll || {}).flatMap(a => Array.isArray(a) ? a : []), [rawAll]);
  var backupStat = React.useMemo(() => {
    var total = 0,
      done = 0,
      bytes = 0;
    for (var m of everyMoment) {
      if (!m.photoId) continue;
      total++;
      if (m.backedUp) {
        done++;
        bytes += m.backedUpBytes || 0;
      }
    }
    return {
      total,
      done,
      bytes
    };
  }, [everyMoment]);
  var backupScopeHint = React.useMemo(() => {
    var here = allMoments.filter(m => m.photoId).length;
    return backupStat.total > here ? " · ALL FESTIVALS" : "";
  }, [allMoments, backupStat.total]);
  var _afterBackup = res => {
    if (res?.error === "signin") window.plurskyToast?.("Sign in on the Me tab to back up");else if (res?.error) window.plurskyToast?.("Backup unavailable right now");else if (res?.capped) window.plurskyToast?.(`Backup limit reached (${_fmtSize(_BACKUP_HARD_CAP)}) · ${res.done} saved`);else window.plurskyToast?.(`☁ Backed up ${res.done} ${res.done === 1 ? "memory" : "memories"}${res.failed ? ` · ${res.failed} failed` : ""}`);
  };
  var handleBackup = async () => {
    if (!_isPlusSub()) {
      setShowPlus(true);
      return;
    }
    if (!_onWifi()) {
      window.plurskyToast?.("Wi-Fi only — connect to back up your media");
      return;
    }
    setBackupBusy(true);
    setBackupProg({
      done: backupStat.done,
      total: backupStat.total
    });
    var res = await _backupMyWeekend(p => setBackupProg({
      done: backupStat.done + p.done,
      total: backupStat.total
    }));
    setBackupBusy(false);
    setBackupProg(null);
    setAll(_readMoments());
    _afterBackup(res);
  };
  React.useEffect(() => {
    if (!autoOn || !_isPlusSub() || !_onWifi() || _autoBusy.current) return;
    if (!everyMoment.some(m => m.photoId && !m.backedUp)) return;
    var cancelled = false;
    (async () => {
      if (!(window.sbGetUser && (await window.sbGetUser()))) return;
      if (cancelled || _autoBusy.current) return;
      _autoBusy.current = true;
      var res = await _backupMyWeekend().catch(() => null);
      _autoBusy.current = false;
      if (!cancelled) {
        setAll(_readMoments());
        if (res?.done) window.plurskyToast?.(`☁ Auto-backed up ${res.done}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [everyMoment, autoOn]);
  return React.createElement(Screen, {
    bg: "var(--paper)"
  }, lightbox && React.createElement(MomentLightbox, {
    moments: lightbox.moments,
    index: lightbox.index,
    onClose: () => setLightbox(null),
    onIndexChange: i => setLightbox(lb => ({
      ...lb,
      index: i
    })),
    onArtistClick: id => setState(s => ({
      ...s,
      artist: id
    })),
    onRecoverNight: handleRecoverNight,
    onUpdate: (mom, patch) => {
      handleUpdate(mom, patch);
      setLightbox(lb => lb ? {
        ...lb,
        moments: lb.moments.map(mm => mm.id === mom.id ? {
          ...mm,
          ...patch
        } : mm)
      } : lb);
    }
  }), reel && React.createElement(MemoryReel, {
    moments: reel.moments,
    nightLabel: reel.label,
    night: reel.night,
    festival: FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name,
    onClose: () => setReel(null),
    onOpenArtist: id => setState(s => ({
      ...s,
      artist: id
    })),
    onMakeVideo: () => setState(s => ({
      ...s,
      tab: "recap",
      artist: null
    }))
  }), React.createElement("div", {
    style: {
      padding: "8px 20px"
    }
  }, React.createElement(TopBar, {
    title: React.createElement("span", null, "Memories"),
    sub: `${totalCount} ${totalCount === 1 ? "MOMENT" : "MOMENTS"} · ${FESTIVAL_CONFIG.shortName.toUpperCase()}`,
    tight: true
  })), React.createElement(ScrollBody, {
    style: {
      padding: "0 20px 94px"
    }
  }, React.createElement("input", {
    ref: batchInputRef,
    type: "file",
    accept: "image/*,video/*",
    multiple: true,
    onChange: handleBatchPick,
    style: {
      display: "none"
    }
  }), React.createElement("button", {
    onClick: handlePickClick,
    disabled: !!batch && batch.done < batch.total,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginTop: 12,
      padding: "12px 14px",
      background: "linear-gradient(135deg, rgba(232,93,46,0.12), rgba(123,61,154,0.10))",
      border: "1px solid rgba(232,93,46,0.4)",
      borderRadius: 14,
      color: "var(--ink)",
      cursor: "pointer"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 17
    }
  }, "✨"), React.createElement("div", {
    style: {
      textAlign: "left"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 16,
      lineHeight: 1.1
    }
  }, "Import from camera roll"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 2,
      fontWeight: 700
    }
  }, "AUTO-TAGS BY TIME + LOCATION"))), React.createElement("span", {
    className: "mono",
    style: {
      background: "var(--ember)",
      color: "#fff",
      padding: "5px 11px",
      borderRadius: 999,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, batch && batch.done < batch.total ? `${batch.done}/${batch.total}` : "PICK")), batch && batch.done === batch.total && (() => {
    var tagged = batch.results.filter(r => !r.err && !r.skipped && r.artistId).length;
    var needRetag = batch.results.filter(r => !r.err && !r.skipped && !r.artistId).length;
    var failed = batch.results.filter(r => r.err).length;
    var dupes = batch.results.filter(r => r.skipped === "duplicate").length;
    var allTagged = tagged > 0 && needRetag === 0 && failed === 0;
    return React.createElement("div", {
      onClick: () => setBatch(null),
      style: {
        marginTop: 8,
        padding: "9px 12px",
        background: allTagged ? "rgba(45,122,85,0.12)" : "rgba(232,93,46,0.10)",
        border: allTagged ? "1px solid rgba(45,122,85,0.4)" : "1px solid rgba(232,93,46,0.4)",
        borderRadius: 10,
        cursor: "pointer"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 1.2,
        fontWeight: 700,
        color: allTagged ? "var(--success)" : "var(--ember-ink)"
      }
    }, "✓ ", tagged, " TAGGED", needRetag > 0 ? ` · ${needRetag} NEED RETAG` : "", dupes > 0 ? ` · ${dupes} SKIPPED (DUPLICATE)` : "", failed > 0 ? ` · ${failed} FAILED` : ""), needRetag > 0 && React.createElement("div", {
      className: "mono",
      style: {
        marginTop: 4,
        fontSize: 9,
        letterSpacing: 1.1,
        color: "var(--muted)",
        fontWeight: 600
      }
    }, "iOS sometimes strips photo time when copying — tap an untagged moment to pick its set."), React.createElement("div", {
      className: "mono",
      style: {
        marginTop: 4,
        fontSize: 9,
        color: "var(--muted)"
      }
    }, "TAP TO DISMISS"));
  })(), allMoments.filter(m => m.photoId).length >= 3 && React.createElement("div", {
    style: {
      marginTop: 12,
      padding: "14px 16px",
      borderRadius: 16,
      background: "linear-gradient(135deg, var(--ember), #7b3d9a)",
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 19,
      lineHeight: 1.05,
      color: "#fff"
    }
  }, "Relive your ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "weekend")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8.5,
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.8)",
      fontWeight: 700,
      marginTop: 3
    }
  }, allMoments.filter(m => m.photoId).length, " MOMENTS · AUTO-PLAY REEL")), React.createElement("button", {
    onClick: () => {
      var ms = allMoments.filter(m => m.photoId).slice().sort((a, b) => {
        var ta = a.takenAt || "",
          tb = b.takenAt || "";
        if (ta && tb) return ta.localeCompare(tb);
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
      playReel(ms, FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name, null);
    },
    className: "mono",
    style: {
      flexShrink: 0,
      background: "#fff",
      color: "var(--ember)",
      border: "none",
      borderRadius: 999,
      padding: "9px 16px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 800
    }
  }, "▶ PLAY")), totalCount > 0 && React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      marginTop: 8
    }
  }, React.createElement("button", {
    onClick: () => setManage(m => !m),
    className: "mono",
    style: {
      background: manage ? "var(--ink)" : "transparent",
      color: manage ? "var(--paper)" : "var(--muted)",
      border: "1px solid var(--line)",
      borderRadius: 999,
      padding: "5px 12px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, manage ? "✓ DONE MANAGING" : "⚙ MANAGE")), manage && backupStat.total > 0 && React.createElement("button", {
    onClick: handleBackup,
    disabled: backupBusy,
    "aria-label": _isPlusSub() ? "Back up your memories to the cloud" : "Back up to cloud — Plursky Plus",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginTop: 8,
      padding: "11px 14px",
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      color: "var(--ink)",
      cursor: backupBusy ? "wait" : "pointer"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0
    }
  }, React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "☁️"), React.createElement("div", {
    style: {
      textAlign: "left",
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 15,
      lineHeight: 1.1
    }
  }, backupBusy ? "Backing up…" : backupStat.done >= backupStat.total ? "Memories backed up" : "Back up my weekend"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      marginTop: 2,
      fontWeight: 700,
      color: backupStat.bytes >= _BACKUP_SOFT_CAP ? "var(--ember-ink)" : "var(--muted)"
    }
  }, backupBusy && backupProg ? `BACKING UP… ${backupProg.done}/${backupProg.total}` : backupStat.done >= backupStat.total ? `ALL SAFE${backupScopeHint} · ${_fmtSize(backupStat.bytes)}` : `${backupStat.done}/${backupStat.total}${backupScopeHint} · ${_fmtSize(backupStat.bytes)} · WI-FI`, backupStat.bytes >= _BACKUP_SOFT_CAP ? ` · NEAR ${_fmtSize(_BACKUP_HARD_CAP)} LIMIT` : ""))), React.createElement("span", {
    className: "mono",
    style: {
      flexShrink: 0,
      color: "#fff",
      padding: "5px 11px",
      borderRadius: 999,
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      background: _isPlusSub() ? "var(--ember)" : "linear-gradient(135deg,#6D28D9,#e85d2e)"
    }
  }, _isPlusSub() ? backupStat.done >= backupStat.total ? "✓" : "BACK UP" : "PLUS")), manage && backupStat.total > 0 && _isPlusSub() && React.createElement("button", {
    onClick: () => {
      var v = !autoOn;
      _setAutoBackup(v);
      setAutoOn(v);
    },
    className: "mono",
    "aria-pressed": autoOn,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: "100%",
      marginTop: 6,
      padding: "7px 12px",
      borderRadius: 10,
      background: "transparent",
      border: "1px solid var(--line)",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "AUTO-BACKUP ON WI-FI · ", React.createElement("span", {
    style: {
      color: autoOn ? "var(--success)" : "var(--muted)"
    }
  }, autoOn ? "ON" : "OFF")), showPlus && React.createElement("div", {
    onClick: () => setShowPlus(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 260,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      animation: "fadeIn .2s"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: "relative",
      width: "100%",
      maxWidth: 340
    }
  }, React.createElement("button", {
    onClick: () => setShowPlus(false),
    "aria-label": "Close",
    style: {
      position: "absolute",
      top: -14,
      right: -6,
      zIndex: 1,
      width: 30,
      height: 30,
      borderRadius: 30,
      background: "#fff",
      border: "none",
      color: "#1a120d",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "×"), React.createElement(PlusGate, {
    feature: "cloud backup"
  }, React.createElement("div", {
    style: {
      height: 460
    }
  })))), totalCount === 0 && React.createElement("div", {
    style: {
      marginTop: 20,
      padding: "32px 22px",
      textAlign: "center",
      borderRadius: 18,
      background: "var(--paper-2)",
      border: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 34,
      marginBottom: 10
    }
  }, "📸"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.1,
      color: "var(--ink)",
      marginBottom: 8
    }
  }, "Your weekend, ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "remembered")), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: 1.5,
      color: "var(--muted)",
      maxWidth: 280,
      margin: "0 auto"
    }
  }, "Import your festival photos & videos — Plursky auto-tags each to the set you were watching, finds the song that was playing, and turns them into a recap."), React.createElement("button", {
    onClick: handlePickClick,
    className: "mono",
    style: {
      marginTop: 16,
      padding: "11px 20px",
      borderRadius: 999,
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      cursor: "pointer",
      fontSize: 11,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "✨ IMPORT FROM CAMERA ROLL")), totalCount > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginTop: 14,
      marginBottom: 8,
      padding: 3,
      background: "var(--paper-2)",
      borderRadius: 10,
      border: "1px solid var(--line)"
    }
  }, [{
    id: "grid",
    label: "WALL"
  }, {
    id: "night",
    label: "TIMELINE"
  }].map(v => {
    var on = view === v.id;
    return React.createElement("button", {
      key: v.id,
      onClick: () => setView(v.id),
      className: "mono",
      style: {
        flex: 1,
        padding: "8px 0",
        borderRadius: 8,
        background: on ? "var(--ink)" : "transparent",
        color: on ? "var(--paper)" : "var(--muted)",
        border: "none",
        cursor: "pointer",
        fontSize: 10,
        letterSpacing: 1.3,
        fontWeight: 700
      }
    }, v.label);
  })), view === "grid" && React.createElement(React.Fragment, null, React.createElement("input", {
    value: memQuery,
    onChange: e => setMemQuery(e.target.value),
    placeholder: "Search artist, song, or stage…",
    className: "mono",
    style: {
      width: "100%",
      boxSizing: "border-box",
      marginBottom: 8,
      padding: "9px 12px",
      borderRadius: 999,
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      color: "var(--ink)",
      fontSize: 11,
      letterSpacing: 0.5,
      outline: "none"
    }
  }), React.createElement(MemoryGrid, {
    allMoments: (() => {
      var q = memQuery.trim().toLowerCase();
      if (!q) return allMoments;
      return allMoments.filter(m => {
        var a = m.artistId ? ARTISTS.find(x => x.id === m.artistId) : null;
        var s = a ? STAGES.find(st => st.id === a.stage) : null;
        return (a?.name || "").toLowerCase().includes(q) || (m.confirmedSong || "").toLowerCase().includes(q) || (s?.name || "").toLowerCase().includes(q);
      });
    })(),
    onOpenLightbox: openLightbox
  })), view === "night" && DAYS.map(d => {
    var moments = (all[d.n] || []).slice().sort((a, b) => _momentTime(a) - _momentTime(b));
    var dateInfo = FESTIVAL_CONFIG.dayDates?.[d.n];
    var savedNightArtists = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && a.day === d.n);
    return React.createElement("div", {
      key: d.n,
      ref: el => {
        nightSectionRefs.current[d.n] = el;
      },
      style: {
        marginBottom: 22,
        scrollMarginTop: 12
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        paddingTop: 14,
        paddingBottom: 8,
        marginBottom: 4,
        borderBottom: "1px solid var(--line)"
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 24,
        color: "var(--ink)"
      }
    }, d.label), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "· ", dateInfo ? `${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][dateInfo.m]} ${dateInfo.d}` : `DAY ${d.n}`), moments.length > 0 && React.createElement(React.Fragment, null, React.createElement(_NightShareMenu, {
      night: d.n,
      moments: moments
    }), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, moments.length, " MOMENT", moments.length === 1 ? "" : "S"))), moments.length > 0 && React.createElement(PeakMomentCard, {
      peak: _peakWindow(moments),
      accent: "var(--ember)",
      onOpenLightbox: openLightbox,
      onPlayReel: items => playReel(items, `${d.label} peak`, d.n)
    }), moments.length > 0 && React.createElement(_NightMap, {
      moments: moments,
      onPinTap: p => openLightbox(p.items, 0)
    }), moments.length === 0 && adding !== d.n && React.createElement("div", {
      style: {
        padding: "18px 14px",
        textAlign: "center",
        border: "1px dashed var(--line-2)",
        borderRadius: 14,
        background: "var(--paper-2)",
        marginTop: 10,
        marginBottom: 10
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, "NO MOMENTS YET")), (() => {
      var attendedSet = (typeof getAttendedForNight === "function" ? getAttendedForNight(d.n) : null) || new Set();
      var byArtist = new Map();
      var untagged = [];
      for (var m of moments) {
        if (m.artistId) {
          if (!byArtist.has(m.artistId)) byArtist.set(m.artistId, []);
          byArtist.get(m.artistId).push(m);
        } else untagged.push(m);
      }
      var spineIds = [...new Set([...attendedSet, ...byArtist.keys()])].filter(id => ARTISTS.find(a => a.id === id)).sort((aId, bId) => {
        var aA = ARTISTS.find(x => x.id === aId),
          bA = ARTISTS.find(x => x.id === bId);
        var aMin = aA?.start ? window.toNightMin?.(aA.start) ?? 9999 : 9999;
        var bMin = bA?.start ? window.toNightMin?.(bA.start) ?? 9999 : 9999;
        return aMin - bMin;
      });
      if (!spineIds.length && !untagged.length) return null;
      return React.createElement(React.Fragment, null, spineIds.length > 0 && React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 1.4,
          color: "var(--muted)",
          fontWeight: 700,
          marginTop: 14,
          marginBottom: 2
        }
      }, "SETS YOU WATCHED"), spineIds.map(aId => {
        var artist = ARTISTS.find(x => x.id === aId);
        var stage = artist ? STAGES.find(s => s.id === artist.stage) : null;
        var accent = stage?.color || "var(--muted)";
        var groupMoments = byArtist.get(aId) || [];
        var hero = groupMoments.length ? _pickHeroMoment(groupMoments) : null;
        var orderedMoments = hero ? [hero, ...groupMoments.filter(m => m.id !== hero.id)] : groupMoments;
        var setTime = artist?.start ? fmt12(artist.start) : "";
        return React.createElement("div", {
          key: aId,
          style: {
            marginTop: 10
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8
          }
        }, React.createElement("button", {
          onClick: () => setState(s => ({
            ...s,
            artist: aId
          })),
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 0,
            padding: "6px 4px",
            background: "transparent",
            border: "none",
            textAlign: "left",
            cursor: "pointer"
          }
        }, React.createElement("span", {
          style: {
            width: 4,
            alignSelf: "stretch",
            background: accent,
            borderRadius: 3
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
            letterSpacing: 1.3,
            fontWeight: 700,
            color: accent
          }
        }, [(stage?.short || stage?.name || "").toUpperCase(), setTime].filter(Boolean).join(" · ")), React.createElement("div", {
          className: "serif",
          style: {
            fontSize: 18,
            color: "var(--ink)",
            lineHeight: 1.1,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }
        }, artist?.name || "Unknown")), React.createElement("span", {
          className: "mono",
          style: {
            fontSize: 9,
            letterSpacing: 1.1,
            color: groupMoments.length ? "var(--muted)" : "var(--line-2)",
            fontWeight: 700,
            flexShrink: 0
          }
        }, groupMoments.length ? `${groupMoments.length} ${groupMoments.length === 1 ? "CLIP" : "CLIPS"}` : "✓ CAUGHT")), hero && React.createElement(_GroupHeroThumb, {
          moment: hero,
          accent: accent,
          onClick: () => openLightbox(orderedMoments, 0)
        })), artist && groupMoments.length > 0 && React.createElement(SetSongTimeline, {
          artist: artist,
          moments: orderedMoments,
          onOpenMoment: m => openLightbox(orderedMoments, Math.max(0, orderedMoments.findIndex(x => x.id === m.id)))
        }), groupMoments.length === 0 && React.createElement("div", {
          className: "mono",
          style: {
            fontSize: 9,
            letterSpacing: 1,
            color: "var(--muted)",
            fontWeight: 600,
            padding: "4px 0 2px 12px"
          }
        }, "You were here · no clips from this set yet"), orderedMoments.map((m, i) => React.createElement(MomentCard, {
          key: m.id,
          moment: m,
          idx: i,
          total: orderedMoments.length,
          groupMoments: orderedMoments,
          onOpenLightbox: openLightbox,
          onDelete: handleDelete,
          onUpdate: handleUpdate,
          savedArtistIds: state.saved || [],
          onArtistClick: id => setState(s => ({
            ...s,
            artist: id
          }))
        })));
      }), untagged.length > 0 && React.createElement("div", {
        key: "__other__",
        style: {
          marginTop: 14
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 4px"
        }
      }, React.createElement("span", {
        style: {
          width: 4,
          alignSelf: "stretch",
          background: "var(--ember)",
          borderRadius: 3
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
          letterSpacing: 1.3,
          fontWeight: 700,
          color: "var(--ember-ink)"
        }
      }, "BETWEEN SETS"), React.createElement("div", {
        className: "serif",
        style: {
          fontSize: 18,
          color: "var(--ink)",
          lineHeight: 1.1,
          marginTop: 2
        }
      }, "Other moments")), React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 1.1,
          color: "var(--muted)",
          fontWeight: 700,
          flexShrink: 0
        }
      }, untagged.length, " ", untagged.length === 1 ? "CLIP" : "CLIPS")), untagged.length >= 3 && savedNightArtists.length > 0 && React.createElement(BulkRetagRow, {
        moments: untagged,
        savedNightArtists: savedNightArtists,
        onUpdate: handleUpdate
      }), untagged.map((m, i) => React.createElement(MomentCard, {
        key: m.id,
        moment: m,
        idx: i,
        total: untagged.length,
        groupMoments: untagged,
        onOpenLightbox: openLightbox,
        onDelete: handleDelete,
        onUpdate: handleUpdate,
        savedArtistIds: state.saved || [],
        onArtistClick: id => setState(s => ({
          ...s,
          artist: id
        }))
      }))));
    })(), (manage || adding === d.n) && (adding === d.n ? React.createElement(AddMomentForm, {
      night: d.n,
      savedNightArtists: savedNightArtists,
      onAdd: handleAdd,
      onCancel: () => setAdding(null)
    }) : React.createElement("button", {
      onClick: () => setAdding(d.n),
      className: "mono",
      style: {
        width: "100%",
        padding: "12px",
        background: "transparent",
        border: "1px dashed var(--line-2)",
        borderRadius: 12,
        color: "var(--ink)",
        fontSize: 10,
        letterSpacing: 1.4,
        fontWeight: 700,
        cursor: "pointer",
        marginTop: moments.length > 0 ? 4 : 0
      }
    }, "+ ADD MOMENT")), manage && savedNightArtists.length > 0 && React.createElement(AttendanceReview, {
      night: d.n,
      savedNightArtists: savedNightArtists
    }));
  }), manage && React.createElement(StorageManager, {
    all: all,
    onChange: () => setAll(_readMoments())
  })));
}
function AttendanceReview({
  night,
  savedNightArtists
}) {
  var [attended, setAttended] = React.useState(() => getAttendedForNight(night));
  React.useEffect(() => {
    var refresh = () => setAttended(getAttendedForNight(night));
    window.addEventListener("plursky-attended-change", refresh);
    return () => window.removeEventListener("plursky-attended-change", refresh);
  }, [night]);
  var toggle = id => {
    try {
      window.plurskyHaptic?.(attended.has(id) ? "LIGHT" : "MEDIUM");
    } catch {}
    if (attended.has(id)) unmarkAttended(night, id);else markAttended(night, id, "manual");
  };
  var caught = savedNightArtists.filter(a => attended.has(a.id)).length;
  return React.createElement("div", {
    style: {
      marginTop: 10,
      padding: "12px 14px",
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 12
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 8
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "SETS YOU CAUGHT"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: caught === savedNightArtists.length ? "var(--success)" : "var(--muted)",
      fontWeight: 700
    }
  }, caught, " / ", savedNightArtists.length)), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, savedNightArtists.slice().sort((a, b) => (window.toNightMin?.(a.start) ?? 9999) - (window.toNightMin?.(b.start) ?? 9999)).map(a => {
    var on = attended.has(a.id);
    var stage = STAGES.find(s => s.id === a.stage);
    var src = on ? getAttendanceSource(a.id) : null;
    return React.createElement("button", {
      key: a.id,
      onClick: () => toggle(a.id),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: on ? "rgba(45,122,85,0.10)" : "var(--paper)",
        border: on ? "1px solid rgba(45,122,85,0.4)" : "1px solid var(--line)",
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement("span", {
      style: {
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0,
        background: on ? "var(--success)" : "transparent",
        border: on ? "none" : "1.5px solid var(--line-2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700
      }
    }, on ? "✓" : ""), React.createElement("div", {
      style: {
        width: 3,
        alignSelf: "stretch",
        background: stage?.color || "var(--line-2)",
        borderRadius: 3
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 14,
        lineHeight: 1.1
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 2,
        fontWeight: 600
      }
    }, (stage?.short || "").toUpperCase(), " · ", fmt12(a.start))), src === "gps" && React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1,
        color: "var(--success)",
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 999,
        background: "rgba(45,122,85,0.14)"
      }
    }, "📍 GPS"));
  })));
}
function Collapsible({
  title,
  defaultOpen = false,
  children
}) {
  var [open, setOpen] = React.useState(defaultOpen);
  return React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    className: "mono",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      padding: "12px 14px",
      cursor: "pointer",
      fontSize: 11,
      letterSpacing: 1.3,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, React.createElement("span", null, title), React.createElement("span", {
    style: {
      color: "var(--muted)",
      fontSize: 12
    }
  }, open ? "▾" : "▸")), open && React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, children));
}
function MeScreen({
  state,
  setState
}) {
  var _mePostFest = Date.now() > (FESTIVAL_CONFIG?.endMs || Infinity);
  var [profile, setProfile] = React.useState(getSpotifyProfileSync);
  var [localName, setLocalName] = React.useState(() => {
    try {
      return localStorage.getItem("plursky_display_name") || localStorage.getItem("user_name") || "";
    } catch {
      return "";
    }
  });
  React.useEffect(() => {
    if (state.spotifyConnected && !profile) {
      ensureSpotifyProfile().then(setProfile);
    }
  }, [state.spotifyConnected]);
  var rawName = profile?.name || localName || "";
  var displayName = rawName || "—";
  var initial = rawName ? (rawName.match(/[A-Za-z0-9]/) || ["?"])[0].toUpperCase() : "?";
  var promptName = () => {
    var next = (window.prompt("Your name (shown to crew & on this screen):", localName || "") || "").trim();
    if (!next) return;
    try {
      localStorage.setItem("plursky_display_name", next);
    } catch {}
    setLocalName(next);
  };
  var pingCode = typeof window.getMyPingCode === "function" ? window.getMyPingCode() : "PLUR";
  var PING_PALETTE = ["var(--ember)", "var(--flare)", "var(--horizon)", "var(--sky)", "var(--success)"];
  var pingHash = 0;
  for (var i = 0; i < pingCode.length; i++) pingHash = pingHash * 31 + pingCode.charCodeAt(i) >>> 0;
  var pingColor = PING_PALETTE[pingHash % PING_PALETTE.length];
  var [crewCount, setCrewCount] = React.useState(() => {
    try {
      var snap = window.sbGetPresSnap?.() || {};
      var mine = window.sbGetMyPresId?.();
      return Object.keys(snap).filter(id => id !== mine).length;
    } catch {
      return 0;
    }
  });
  React.useEffect(() => {
    if (typeof window.sbOnPresenceChange !== "function") return;
    return window.sbOnPresenceChange(snap => {
      try {
        var mine = window.sbGetMyPresId?.();
        setCrewCount(Object.keys(snap).filter(id => id !== mine).length);
      } catch {}
    });
  }, []);
  var [settingsOpen, setSettingsOpen] = React.useState(false);
  var [festivalOpen, setFestivalOpen] = React.useState(true);
  var [socialOpen, setSocialOpen] = React.useState(true);
  var [plusOpen, setPlusOpen] = React.useState(false);
  var plusActive = _isPlusSub();
  var [setsCaught, setSetsCaught] = React.useState(getAttendedCount);
  React.useEffect(() => {
    var refresh = () => setSetsCaught(getAttendedCount());
    window.addEventListener("plursky-attended-change", refresh);
    return () => window.removeEventListener("plursky-attended-change", refresh);
  }, []);
  var daysHere = NOW.day || 0;
  var savedCount = state.saved.length;
  var badgesEarnedCount = React.useMemo(() => _computeBadges(state.saved).filter(b => b.earned).length, [state.saved]);
  var _cfg = window.FESTIVAL_CONFIG || {};
  var tagline = daysHere ? `DAY ${daysHere} OF ${(_cfg.shortName || _cfg.brand || "").toUpperCase()}` : `${(_cfg.shortName || _cfg.brand || "").toUpperCase()} · ${(_cfg.dates || "").toUpperCase()}`;
  return React.createElement(Screen, {
    bg: "var(--paper)"
  }, React.createElement("div", {
    style: {
      padding: "8px 20px"
    }
  }, React.createElement(TopBar, {
    title: React.createElement("span", null, "Me"),
    sub: FESTIVAL_CONFIG.shortName.toUpperCase(),
    tight: true
  })), React.createElement(ScrollBody, {
    ref: useStaggerFade("me"),
    style: {
      padding: "10px 20px 94px"
    }
  }, React.createElement("div", {
    "data-animate": true,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "18px 16px 20px",
      marginBottom: 16
    }
  }, React.createElement("div", {
    onClick: profile ? undefined : promptName,
    style: {
      width: 78,
      height: 78,
      borderRadius: 999,
      background: profile?.image ? "transparent" : pingColor,
      border: "3px solid #fff",
      boxShadow: "0 2px 8px rgba(26,18,13,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      cursor: profile ? "default" : "pointer",
      marginBottom: 10
    }
  }, profile?.image ? React.createElement("img", {
    src: profile.image,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : React.createElement("span", {
    className: "serif",
    style: {
      fontSize: 36,
      color: "#fff",
      lineHeight: 1,
      textShadow: "0 1px 2px rgba(26,18,13,0.25)"
    }
  }, initial)), React.createElement("div", {
    className: "serif",
    onClick: rawName ? undefined : promptName,
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      color: rawName ? "var(--ink)" : "var(--muted)",
      textAlign: "center",
      marginBottom: 8,
      cursor: rawName ? "default" : "pointer"
    }
  }, displayName), React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "var(--paper-2)",
      borderRadius: 999,
      padding: "4px 10px",
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: pingColor,
      display: "inline-block"
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, "PING · ", pingCode)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      color: "var(--muted)"
    }
  }, tagline)), React.createElement("div", {
    "data-animate": true,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: "14px 4px",
      marginBottom: 18
    }
  }, [{
    n: setsCaught,
    label: "SETS CAUGHT"
  }, {
    n: daysHere,
    label: "DAYS HERE"
  }].map((s, i) => React.createElement("div", {
    key: s.label,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      borderLeft: i === 0 ? "none" : "1px solid var(--line)",
      padding: "2px 6px"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1,
      color: "var(--ink)",
      marginBottom: 6
    }
  }, s.n), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      color: "var(--muted)",
      textAlign: "center"
    }
  }, s.label)))), plusActive ? React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "14px 16px",
      marginBottom: 14,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 16,
      color: "var(--ink)",
      textAlign: "left"
    }
  }, React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: "50%",
      flexShrink: 0,
      background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontSize: 16,
      fontWeight: 700,
      lineHeight: 1
    }
  }, "+"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.05
    }
  }, "Plursky+"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 4,
      fontWeight: 700
    }
  }, "ACTIVE · THANK YOU")), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--success)",
      fontWeight: 700
    }
  }, "✓")) : React.createElement("button", {
    onClick: () => setPlusOpen(true),
    "aria-label": "Plursky Plus — see what's included and subscribe",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "14px 16px",
      marginBottom: 14,
      background: "linear-gradient(135deg, #6D28D9 0%, #e85d2e 100%)",
      border: "none",
      borderRadius: 16,
      color: "#fff",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit",
      boxShadow: "0 4px 18px rgba(109,40,217,0.30)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 24,
      lineHeight: 1,
      flexShrink: 0,
      fontWeight: 700
    }
  }, "+"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.05
    }
  }, "Plursky", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "+")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "rgba(255,255,255,0.72)",
      marginTop: 4,
      fontWeight: 700
    }
  }, "NO WATERMARKS · CLOUD BACKUP · MORE")), React.createElement("span", {
    style: {
      fontSize: 18,
      opacity: 0.85
    }
  }, "→")), plusOpen && React.createElement("div", {
    onClick: () => setPlusOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 260,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      animation: "fadeIn .2s"
    }
  }, React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: "relative",
      width: "100%",
      maxWidth: 340
    }
  }, React.createElement("button", {
    onClick: () => setPlusOpen(false),
    "aria-label": "Close",
    style: {
      position: "absolute",
      top: -14,
      right: -6,
      zIndex: 1,
      width: 30,
      height: 30,
      borderRadius: 30,
      background: "#fff",
      border: "none",
      color: "#1a120d",
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "×"), React.createElement(PlusGate, {
    feature: "everything in Plursky+"
  }, React.createElement("div", {
    style: {
      height: 460
    }
  })))), React.createElement("div", {
    "data-animate": true,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 22
    }
  }, [{
    key: "saved",
    label: "SAVED",
    count: savedCount,
    icon: "★",
    onClick: () => setState(st => ({
      ...st,
      tab: "lineup"
    }))
  }, {
    key: "memories",
    label: "MEMORIES",
    count: _countMoments(),
    icon: "◐",
    onClick: () => setState(s => ({
      ...s,
      tab: "memories"
    }))
  }, {
    key: "crew",
    label: "CREW",
    count: crewCount,
    icon: "☷",
    onClick: () => document.getElementById("plursky-crew-anchor")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    })
  }, {
    key: "badges",
    label: "BADGES",
    count: badgesEarnedCount,
    icon: "✦",
    onClick: () => {
      document.getElementById("plursky-badges-anchor")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }].map(card => React.createElement("button", {
    key: card.key,
    onClick: card.onClick,
    style: {
      position: "relative",
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 14,
      padding: 14,
      minHeight: 96,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "space-between",
      textAlign: "left",
      cursor: "pointer",
      fontFamily: "inherit",
      color: "var(--ink)"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 14,
      fontSize: 18,
      lineHeight: 1,
      color: "var(--muted)"
    }
  }, card.icon), React.createElement("div", null), React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1,
      color: "var(--ink)"
    }
  }, card.count), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700,
      color: "var(--muted)",
      marginTop: 4
    }
  }, card.label))))), typeof window.FESTIVAL_CONFIG?.endMs === "number" && Date.now() > window.FESTIVAL_CONFIG.endMs && React.createElement("button", {
    onClick: () => setState(s => ({
      ...s,
      tab: "recap"
    })),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "14px 16px",
      marginBottom: 14,
      background: "linear-gradient(135deg, var(--ink) 0%, var(--horizon) 100%)",
      border: "none",
      borderRadius: 16,
      color: "var(--paper)",
      cursor: "pointer",
      textAlign: "left",
      boxShadow: "0 4px 18px rgba(123,61,154,0.30)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 24,
      lineHeight: 1,
      flexShrink: 0
    }
  }, "✦"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.05
    }
  }, "Your ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--flare)"
    }
  }, _cfg.brand || "festival"), " weekend"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "rgba(247,237,224,0.65)",
      marginTop: 4,
      fontWeight: 700
    }
  }, "THE RECAP · ", getAttendedCount?.() || 0, " SETS CAUGHT · TAP TO SEE")), React.createElement("span", {
    style: {
      fontSize: 18,
      opacity: 0.75
    }
  }, "→")), React.createElement("div", {
    "data-animate": true,
    style: {
      borderTop: "1px solid var(--line)",
      marginTop: 6,
      paddingTop: 14,
      marginBottom: 18
    }
  }, React.createElement("button", {
    onClick: () => setFestivalOpen(o => !o),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: "0 0 12px",
      textAlign: "left",
      color: "var(--ink)"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05
    }
  }, "Festival"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 3
    }
  }, "HISTORY · BADGES · MUSIC · HEADLINERS")), React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      transition: "transform 0.25s var(--ease-spring)",
      transform: festivalOpen ? "rotate(90deg)" : "rotate(0deg)"
    }
  }, React.createElement("path", {
    d: "M9 18 L15 12 L9 6"
  }))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateRows: festivalOpen ? "1fr" : "0fr",
      transition: "grid-template-rows 0.3s var(--ease-smooth)"
    }
  }, React.createElement("div", {
    style: {
      overflow: "hidden"
    }
  }, React.createElement(HistoryRecordsSection, {
    state: state,
    setState: setState
  }), React.createElement("div", {
    style: {
      marginTop: 14
    }
  }), React.createElement("div", {
    id: "plursky-badges-anchor"
  }), React.createElement(Collapsible, {
    title: "🏅 BADGES"
  }, React.createElement(BadgesSection, {
    state: state
  })), React.createElement("div", {
    style: {
      marginTop: 14
    }
  }), React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "spotify"
    }),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      padding: "13px 14px",
      marginBottom: 14,
      background: state.spotifyConnected ? "linear-gradient(135deg, rgba(29,185,84,0.12), rgba(123,61,154,0.10))" : "var(--paper-2)",
      border: state.spotifyConnected ? "1px solid rgba(29,185,84,0.4)" : "1px solid var(--line-2)",
      borderRadius: 14,
      cursor: "pointer",
      textAlign: "left"
    }
  }, React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 38,
      flexShrink: 0,
      background: state.spotifyConnected ? "linear-gradient(135deg, #1DB954, var(--horizon))" : "linear-gradient(135deg, var(--ember), var(--horizon))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("circle", {
    cx: "7",
    cy: "17",
    r: "2.5"
  }), React.createElement("circle", {
    cx: "17",
    cy: "15",
    r: "2.5"
  }), React.createElement("path", {
    d: "M9.5 17 L9.5 5 L19.5 3 L19.5 15"
  }))), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      lineHeight: 1.05,
      color: "var(--ink)"
    }
  }, state.spotifyConnected ? "Music · matched" : "Match the lineup to your Spotify"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 3
    }
  }, state.spotifyConnected ? "TOP ARTISTS · DISCOVERIES · BUILD PLAYLIST" : "TAP TO CONNECT")), React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0
    }
  }, React.createElement("path", {
    d: "M9 18 L15 12 L9 6"
  })))))), React.createElement("div", {
    style: {
      borderTop: "1px solid var(--line)",
      paddingTop: 14,
      marginBottom: 18
    }
  }, React.createElement("button", {
    onClick: () => setSocialOpen(o => !o),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: "0 0 12px",
      textAlign: "left",
      color: "var(--ink)"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05
    }
  }, "Friends & ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "crew")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 3
    }
  }, "LIVE LOCATION · SHARED LINEUPS")), React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      transition: "transform 0.25s var(--ease-spring)",
      transform: socialOpen ? "rotate(90deg)" : "rotate(0deg)"
    }
  }, React.createElement("path", {
    d: "M9 18 L15 12 L9 6"
  }))), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateRows: socialOpen ? "1fr" : "0fr",
      transition: "grid-template-rows 0.3s var(--ease-smooth)"
    }
  }, React.createElement("div", {
    style: {
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, React.createElement(FriendsCard, {
    state: state,
    setState: setState
  })), React.createElement("div", {
    id: "plursky-crew-anchor",
    style: {
      marginBottom: 14,
      scrollMarginTop: 12
    }
  }, React.createElement(CrewCard, {
    state: state
  })), React.createElement(AccountCard, {
    state: state,
    setState: setState
  })))), React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, React.createElement("button", {
    onClick: () => setSettingsOpen(o => !o),
    style: {
      width: "100%",
      padding: "13px 14px",
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 14,
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: "inherit",
      color: "var(--ink)"
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      lineHeight: 1.05
    }
  }, "Settings"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 3
    }
  }, "NOTIFICATIONS · THEME · BATTERY · PACK LIST")), React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      transition: "transform 0.25s var(--ease-spring)",
      transform: settingsOpen ? "rotate(90deg)" : "rotate(0deg)"
    }
  }, React.createElement("path", {
    d: "M9 18 L15 12 L9 6"
  }))), settingsOpen && React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement(NotificationsCard, {
    state: state
  }), React.createElement(ThemeCard, null), React.createElement(BatterySaverCard, null), React.createElement(PackListCard, null), React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, React.createElement("button", {
    onClick: () => window.plurskyOpenOnboarding?.(),
    style: {
      background: "transparent",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "8px 14px",
      cursor: "pointer",
      color: "var(--muted)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600
    }
  }, "↻ RE-RUN SETUP WIZARD")))), _mePostFest ? React.createElement(Collapsible, {
    title: "🛟 SAFETY & CARE"
  }, React.createElement(SafetyCards, null)) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      marginTop: 20,
      marginBottom: 3
    }
  }, "Safety & ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "care")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginBottom: 12
    }
  }, "ON-SITE TEAMS · NO QUESTIONS ASKED"), React.createElement(SafetyCards, null)), (() => {
    var savedHeadliners = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && a.tier === 3).slice(0, 6);
    if (savedHeadliners.length === 0) return null;
    return React.createElement(React.Fragment, null, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 22,
        marginTop: 20,
        marginBottom: 10
      }
    }, "Your ", React.createElement("span", {
      style: {
        fontStyle: "italic"
      }
    }, "headliners")), React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 6
      }
    }, savedHeadliners.map(a => React.createElement("button", {
      key: a.id,
      onClick: () => setState({
        ...state,
        artist: a.id
      }),
      style: {
        aspectRatio: "1/1",
        borderRadius: 10,
        background: a.img,
        position: "relative",
        overflow: "hidden",
        border: "none",
        padding: 0,
        cursor: "pointer"
      }
    }, React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.65))"
      }
    }), React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 6,
        left: 6,
        right: 6,
        color: "#fff",
        textAlign: "left"
      },
      className: "mono"
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        letterSpacing: 0.4,
        fontWeight: 700,
        lineHeight: 1.1,
        marginBottom: 2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, a.name), React.createElement("div", {
      style: {
        fontSize: 8,
        letterSpacing: 1,
        opacity: 0.8
      }
    }, FESTIVAL_CONFIG.dayDates[a.day]?.short || "", " · ", fmt12(a.start)))))));
  })(), React.createElement("div", {
    style: {
      padding: "24px 0 40px",
      textAlign: "center",
      borderTop: "1px solid var(--line)",
      marginTop: 24
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--muted)",
      marginBottom: 10
    }
  }, "PLURSKY · ", window.FESTIVAL_CONFIG?.shortName || ""), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 16
    }
  }, React.createElement("a", {
    href: "https://plursky.com/privacy",
    target: "_blank",
    rel: "noopener noreferrer",
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.2,
      color: "var(--muted)",
      textDecoration: "none"
    }
  }, "PRIVACY POLICY"), React.createElement("a", {
    href: "https://plursky.com/terms",
    target: "_blank",
    rel: "noopener noreferrer",
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.2,
      color: "var(--muted)",
      textDecoration: "none"
    }
  }, "TERMS"), React.createElement("button", {
    onClick: () => window.open("mailto:hello@plursky.com"),
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.2,
      color: "var(--muted)",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 0
    }
  }, "CONTACT")))));
}
function FollowedNudge({
  state,
  setState
}) {
  var [followed, setFollowed] = React.useState(null);
  var [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    fetchFollowedEdcArtists(state.saved).then(setFollowed);
  }, [state.saved.length]);
  if (!followed || followed.length === 0) return null;
  var handleSave = artist => {
    setState(s => ({
      ...s,
      saved: [...new Set([...s.saved, artist.id])]
    }));
  };
  var handleSaveAll = () => {
    setState(s => ({
      ...s,
      saved: [...new Set([...s.saved, ...followed.map(a => a.id)])]
    }));
  };
  return React.createElement("div", {
    style: {
      background: "rgba(29,185,84,0.1)",
      border: "1px solid rgba(29,185,84,0.25)",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8
    }
  }, React.createElement("div", null, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "#1DB954",
      fontWeight: 700
    }
  }, "YOU FOLLOW ", followed.length, " ", (FESTIVAL_CONFIG.brand || "").toUpperCase(), " ACT", followed.length > 1 ? "S" : "", " NOT IN YOUR LINEUP")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, React.createElement("button", {
    onClick: handleSaveAll,
    style: {
      background: "#1DB954",
      color: "#000",
      border: "none",
      borderRadius: 999,
      padding: "5px 10px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, "SAVE ALL"), React.createElement("button", {
    onClick: () => setExpanded(e => !e),
    style: {
      background: "transparent",
      color: "rgba(247,237,224,0.6)",
      border: "1px solid rgba(247,237,224,0.2)",
      borderRadius: 999,
      padding: "5px 10px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1
    }
  }, expanded ? "HIDE" : "VIEW"))), expanded && React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, followed.map(a => {
    var st = STAGES.find(s => s.id === a.stage);
    return React.createElement("div", {
      key: a.id,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,0,0,0.2)",
        borderRadius: 10,
        padding: "8px 12px"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: "var(--paper)"
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.1,
        color: "var(--muted)",
        marginTop: 2
      }
    }, st?.short, " · DAY ", a.day, " · ", fmt12(a.start))), React.createElement("button", {
      onClick: () => handleSave(a),
      style: {
        background: "transparent",
        color: st?.color || "#1DB954",
        border: `1px solid ${st?.color || "#1DB954"}`,
        borderRadius: 999,
        padding: "5px 10px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 8,
        letterSpacing: 1,
        fontWeight: 700
      }
    }, "+ SAVE"));
  })));
}
function BuildPlaylistButton({
  state,
  soundtrack
}) {
  var [status, setStatus] = React.useState("idle");
  var [result, setResult] = React.useState(null);
  var [buildProgress, setBuildProgress] = React.useState("");
  var run = async () => {
    setStatus("working");
    setBuildProgress("");
    try {
      var r = await createEdcPlaylist(state, {
        soundtrack,
        onProgress: msg => setBuildProgress(msg)
      });
      setResult(r);
      if (r.ok) {
        setStatus("done");
      } else {
        setStatus("err");
        if (r.reason !== "reconnect" && r.reason !== "no_target_playlist") {
          setTimeout(() => setStatus("idle"), 4500);
        }
      }
    } catch (e) {
      setResult({
        ok: false,
        reason: "create_fail",
        message: String(e?.message || e)
      });
      setStatus("err");
      setTimeout(() => setStatus("idle"), 4500);
    }
  };
  React.useEffect(() => {
    var pending = null;
    try {
      pending = localStorage.getItem("plursky_pending_build");
    } catch {}
    if (pending && state.spotifyConnected && _hasPlaylistWriteScope()) {
      try {
        localStorage.removeItem("plursky_pending_build");
      } catch {}
      run();
    }
  }, []);
  var onClick = async () => {
    if (status === "working") return;
    if (status === "err" && (result?.reason === "reconnect" || result?.reason === "not_connected")) {
      try {
        localStorage.setItem("plursky_pending_build", "1");
      } catch {}
      startSpotifyAuth();
      return;
    }
    if (status === "err" && result?.reason === "no_target_playlist") {
      window.open("https://open.spotify.com/", "_blank", "noopener");
      return;
    }
    if (status === "done" && result?.url) {
      window.open(result.url, "_blank", "noopener");
      return;
    }
    window.plurskyHaptic?.("MEDIUM");
    run();
  };
  var label,
    bg = "rgba(29,185,84,0.14)",
    color = "#1DB954",
    border = "1px solid #1DB954";
  if (status === "working") {
    label = buildProgress ? `BUILDING · ${buildProgress}` : "BUILDING…";
  } else if (status === "done") {
    var sm = result?.songsMatched || 0;
    label = soundtrack && sm > 0 ? `✓ ${sm} OF YOUR SONGS + ${result?.added - sm} MORE — OPEN ↗` : `✓ ${result?.added} TRACKS · FRI→SAT→SUN — OPEN ↗`;
    bg = "#1DB954";
    color = "#000";
    border = "none";
  } else if (status === "err") {
    if (result?.reason === "reconnect" || result?.reason === "not_connected") label = "↻ TAP TO GRANT SPOTIFY ACCESS";else if (result?.reason === "no_target_playlist") label = "↗ CREATE 'PLURSKY' PLAYLIST IN SPOTIFY";else if (result?.reason === "rate_limited") label = "⏱ SPOTIFY BUSY · WAIT 30S, TAP AGAIN";else if (result?.reason === "empty") label = "SAVE SETS FIRST";else if (result?.reason === "create_fail") {
      var msg = (result?.message || "").slice(0, 28);
      label = msg ? `✕ ${result?.status} · ${msg}` : `✕ FAILED · ${result?.status || "?"}`;
    } else label = "✕ TRY AGAIN";
    bg = "rgba(248,113,113,0.18)";
    color = "#fecaca";
    border = "1px solid #f87171";
  } else {
    label = soundtrack ? "🎵 SOUNDTRACK → SPOTIFY" : "BUILD MY PLAYLIST";
  }
  return React.createElement("button", {
    onClick: onClick,
    disabled: status === "working",
    style: {
      background: bg,
      color,
      border,
      borderRadius: 999,
      padding: "10px 16px",
      cursor: status === "working" ? "wait" : "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      transition: "all .2s"
    }
  }, label);
}
function AppleMusicPlaylistButton({
  state,
  soundtrack
}) {
  var [status, setStatus] = React.useState("idle");
  var [result, setResult] = React.useState(null);
  var [prog, setProg] = React.useState("");
  if (!_appleMusicConfigured()) return null;
  var run = async () => {
    setStatus("working");
    setProg("");
    try {
      var r = await createAppleMusicPlaylist(state, {
        soundtrack,
        onProgress: setProg
      });
      setResult(r);
      setStatus(r.ok ? "done" : "err");
      if (!r.ok && r.reason !== "not_connected") setTimeout(() => setStatus("idle"), 4500);
    } catch (e) {
      setResult({
        ok: false,
        reason: "create_fail",
        message: String(e?.message || e)
      });
      setStatus("err");
      setTimeout(() => setStatus("idle"), 4500);
    }
  };
  var onClick = () => {
    if (status === "working") return;
    if (status === "done" && result?.url) {
      window.open(result.url, "_blank", "noopener");
      return;
    }
    window.plurskyHaptic?.("MEDIUM");
    run();
  };
  var label,
    bg = "rgba(250,45,90,0.14)",
    color = "#fa2d5a",
    border = "1px solid #fa2d5a";
  if (status === "working") {
    label = prog ? `BUILDING · ${prog}` : "BUILDING…";
  } else if (status === "done") {
    var sm = result?.songsMatched || 0;
    var open = result?.url ? " — OPEN ↗" : "";
    label = soundtrack && sm > 0 ? `✓ ${sm} OF YOUR SONGS + ${result?.added - sm} MORE${open}` : `✓ ${result?.added} TRACKS IN APPLE MUSIC${open}`;
    bg = "#fa2d5a";
    color = "#fff";
    border = "none";
  } else if (status === "err") {
    if (result?.reason === "not_connected") label = "↻ TAP TO CONNECT APPLE MUSIC";else if (result?.reason === "empty") label = "SAVE SETS FIRST";else if (result?.reason === "no_tracks") label = "✕ NO TRACKS FOUND";else label = `✕ ${result?.status || ""} TRY AGAIN`;
    bg = "rgba(248,113,113,0.18)";
    color = "#fecaca";
    border = "1px solid #f87171";
  } else {
    label = soundtrack ? "🎵 SOUNDTRACK → APPLE MUSIC" : "BUILD APPLE MUSIC PLAYLIST";
  }
  return React.createElement("button", {
    onClick: onClick,
    disabled: status === "working",
    style: {
      background: bg,
      color,
      border,
      borderRadius: 999,
      padding: "10px 16px",
      cursor: status === "working" ? "wait" : "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      transition: "all .2s"
    }
  }, label);
}
var ARCHIVE_KEY = "plursky_festival_archive_v1";
function _readArchive() {
  try {
    return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "{}");
  } catch {
    return {};
  }
}
function archiveFestival(festivalId, festivalName, festivalConfig) {
  if (!festivalId) return false;
  try {
    var archive = _readArchive();
    var attended = JSON.parse(localStorage.getItem("plursky_attended_v1") || "{}");
    var moments = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
    var saved = JSON.parse(localStorage.getItem("edc_saved") || "[]");
    var totalAttended = Object.values(attended).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    var totalMoments = Object.values(moments).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    if (totalAttended === 0 && totalMoments === 0 && saved.length === 0) return false;
    archive[festivalId] = {
      id: festivalId,
      name: festivalName,
      brand: festivalConfig?.brand,
      year: festivalConfig?.year,
      dates: festivalConfig?.dates,
      locationShort: festivalConfig?.locationShort,
      archivedAt: new Date().toISOString(),
      saved,
      attended,
      moments,
      totalAttended,
      totalMoments,
      totalSaved: saved.length
    };
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
    return true;
  } catch {
    return false;
  }
}
var _archiveCheckDone = false;
var _videoArchiveRecoveryDone = false;
function _recoverCurrentVideoMomentsFromArchive() {
  if (_videoArchiveRecoveryDone) return;
  _videoArchiveRecoveryDone = true;
  try {
    var cur = window.FESTIVAL_CONFIG?.id;
    if (!cur) return;
    var all = _readMoments();
    var changed = false;
    var moves = [];
    for (var night of Object.keys(all)) {
      var arr = Array.isArray(all[night]) ? all[night] : [];
      for (var m of arr) {
        if (!m || m.kind !== "video" || !m._fingerprint) continue;
        if (m.festivalId && m.festivalId !== cur) continue;
        var parsed = _momentTakenAtToDateParts(m.takenAt);
        var parsedNight = parsed ? _photoFestivalNight(parsed) : null;
        var needsRecovery = parsedNight == null || !m.artistId || m.tagSource === "fallback" || m.needsRetag;
        if (!needsRecovery) continue;
        var archived = _findArchivedVideoMomentForFingerprint(m._fingerprint);
        var recoveredDate = _momentTakenAtToDateParts(archived?.takenAt);
        if (!archived || !recoveredDate) continue;
        m.takenAt = archived.takenAt;
        m.takenAtSource = "archive-recovered";
        m.artistId = archived.artistId || m.artistId || null;
        var recoveredNight = archived.night || _photoFestivalNight(recoveredDate) || m.night;
        m.night = recoveredNight;
        m.tagSource = "archive-recovered";
        m.autoTagged = !!m.artistId;
        m.needsRetag = false;
        m.tagAmbiguous = false;
        if (!m.festivalId) m.festivalId = cur;
        if (String(recoveredNight) !== String(night)) moves.push({
          from: night,
          to: String(recoveredNight),
          moment: m
        });
        changed = true;
      }
    }
    var _loop5 = function (move) {
      all[move.from] = (all[move.from] || []).filter(m => m !== move.moment);
      all[move.to] = [...(all[move.to] || []), move.moment];
    };
    for (var move of moves) {
      _loop5(move);
    }
    if (changed) _writeMoments(all);
  } catch {}
}
function _maybeAutoArchive() {
  if (_archiveCheckDone) return;
  _archiveCheckDone = true;
  try {
    var cur = window.FESTIVAL_CONFIG?.id;
    if (!cur) return;
    var lastSeen = localStorage.getItem("plursky_last_festival_id");
    try {
      var moments = _readMoments();
      var attribId = lastSeen || cur;
      var changed = false;
      for (var arr of Object.values(moments)) {
        if (!Array.isArray(arr)) continue;
        for (var m of arr) {
          if (m && !m.festivalId) {
            m.festivalId = attribId;
            changed = true;
          }
        }
      }
      if (changed) _writeMoments(moments);
    } catch {}
    if (lastSeen && lastSeen !== cur) {
      var archive = _readArchive();
      if (!archive[lastSeen]) {
        var reg = window.FESTIVALS_REGISTRY || [];
        var prevCfg = reg.find(r => r.config?.id === lastSeen)?.config;
        archiveFestival(lastSeen, prevCfg?.name || lastSeen, prevCfg);
      }
    }
    localStorage.setItem("plursky_last_festival_id", cur);
  } catch {}
}
if (typeof window !== "undefined") setTimeout(_maybeAutoArchive, 100);
if (typeof window !== "undefined") setTimeout(_recoverCurrentVideoMomentsFromArchive, 200);
function _artistsForFestival(festId) {
  try {
    if (window.FESTIVAL_CONFIG?.id === festId) return window.ARTISTS || [];
    var set = (window._DATA_SETS || {})[festId];
    if (set?.artists) return set.artists;
  } catch {}
  return window.ARTISTS || [];
}
function _computeFestivalYear() {
  var CFG = window.FESTIVAL_CONFIG || {};
  var entries = [];
  try {
    Object.values(_readArchive()).forEach(f => {
      if (!f || f.id === CFG.id) return;
      entries.push({
        id: f.id,
        name: f.name || f.id,
        brand: f.brand,
        year: f.year,
        dates: f.dates,
        attended: f.attended || {},
        moments: f.totalMoments || 0,
        archived: true
      });
    });
  } catch {}
  try {
    entries.push({
      id: CFG.id,
      name: CFG.name || CFG.id,
      brand: CFG.brand,
      year: CFG.year,
      dates: CFG.dates,
      attended: getAllAttended(),
      moments: Object.values(_activeMoments(_readMoments())).flat().length,
      archived: false
    });
  } catch {}
  var artistCounts = {};
  var festivals = [];
  var totalSets = 0,
    totalMoments = 0,
    totalMin = 0;
  entries.forEach(e => {
    var lineup = _artistsForFestival(e.id);
    var sets = 0;
    Object.values(e.attended || {}).forEach(ids => (Array.isArray(ids) ? ids : []).forEach(aid => {
      sets++;
      var a = lineup.find(x => x.id === aid);
      if (a?.name) artistCounts[a.name] = (artistCounts[a.name] || 0) + 1;
      if (a?.start && a?.end) {
        var sm = window.toNightMin?.(a.start) || 0;
        var em = window.toNightMin?.(a.end) || 0;
        totalMin += Math.max(0, em - sm);
      }
    }));
    if (sets === 0 && e.moments === 0) return;
    festivals.push({
      id: e.id,
      name: e.name,
      brand: e.brand,
      year: e.year,
      dates: e.dates,
      sets,
      moments: e.moments,
      archived: e.archived
    });
    totalSets += sets;
    totalMoments += e.moments;
  });
  var topArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({
    name,
    count
  }));
  var years = festivals.map(f => f.year).filter(Boolean);
  return {
    year: years.length ? Math.max(...years) : CFG.year || new Date().getFullYear(),
    festivals,
    totalFestivals: festivals.length,
    archivedCount: festivals.filter(f => f.archived).length,
    totalSets,
    totalMoments,
    totalMin,
    topArtists
  };
}
function _computeRecap(state) {
  var attended = getAllAttended();
  var moments = _activeMoments(_readMoments());
  var ARTISTS = window.ARTISTS || [];
  var STAGES = window.STAGES || [];
  var CFG = window.FESTIVAL_CONFIG;
  var caughtArtists = [];
  Object.keys(attended).forEach(n => {
    (attended[n] || []).forEach(id => {
      var a = ARTISTS.find(x => x.id === id);
      if (a) caughtArtists.push({
        ...a,
        _night: +n
      });
    });
  });
  var setsCount = caughtArtists.length;
  var totalMin = caughtArtists.reduce((sum, a) => {
    var sm = window.toNightMin?.(a.start) || 0;
    var em = window.toNightMin?.(a.end) || 0;
    return sum + Math.max(0, em - sm);
  }, 0);
  var byNight = {};
  caughtArtists.forEach(a => {
    byNight[a._night] = (byNight[a._night] || 0) + 1;
  });
  var busiestNight = Object.keys(byNight).sort((x, y) => byNight[y] - byNight[x])[0];
  var busiestNightCount = busiestNight ? byNight[busiestNight] : 0;
  var busiestNightLabel = busiestNight && CFG?.dayDates?.[busiestNight]?.name || `Night ${busiestNight || "—"}`;
  var byStage = {};
  var stageMinutes = {};
  caughtArtists.forEach(a => {
    byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    var sm = window.toNightMin?.(a.start) || 0;
    var em = window.toNightMin?.(a.end) || 0;
    stageMinutes[a.stage] = (stageMinutes[a.stage] || 0) + Math.max(0, em - sm);
  });
  var topStageId = Object.keys(stageMinutes).sort((x, y) => stageMinutes[y] - stageMinutes[x])[0];
  var topStage = topStageId ? STAGES.find(s => s.id === topStageId) : null;
  var topStageMin = topStageId ? stageMinutes[topStageId] : 0;
  var byGenre = {};
  caughtArtists.forEach(a => {
    byGenre[a.genre] = (byGenre[a.genre] || 0) + 1;
  });
  var topGenre = Object.keys(byGenre).sort((x, y) => byGenre[y] - byGenre[x])[0] || null;
  var _artistEpoch = a => {
    var dm = CFG?.dayDates?.[a._night];
    if (!dm) return 0;
    var [h, m] = a.start.split(":").map(Number);
    var adjustH = h < 6 ? h + 24 : h;
    return dm.midnightUtc + adjustH * 3600000 + m * 60000;
  };
  var chronological = caughtArtists.slice().sort((x, y) => _artistEpoch(x) - _artistEpoch(y));
  var firstSet = chronological[0] || null;
  var lastSet = chronological[chronological.length - 1] || null;
  var headlinersCaught = caughtArtists.filter(a => a.tier === 3);
  var headlinerNames = headlinersCaught.map(a => a.name);
  var sunriseSets = caughtArtists.filter(a => {
    var [h] = a.start.split(":").map(Number);
    return h >= 4 && h <= 8;
  });
  var hiddenGem = null;
  var topByPop = null;
  try {
    var cache = JSON.parse(localStorage.getItem("spotify_artist_data_v1") || "{}");
    var annotated = caughtArtists.map(a => {
      var c = cache[a.name.toLowerCase()];
      return c?.popularity > 0 ? {
        ...a,
        _pop: c.popularity
      } : null;
    }).filter(Boolean);
    if (annotated.length) {
      annotated.sort((x, y) => x._pop - y._pop);
      hiddenGem = annotated[0];
      topByPop = annotated[annotated.length - 1];
    }
  } catch {}
  var allMoments = Object.values(moments).flat();
  var photoMoments = allMoments.filter(m => m.photoId);
  var videoMoments = allMoments.filter(m => m.kind === "video");
  var heroPhotoMoment = photoMoments.filter(m => m.kind !== "video").slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0] || null;
  var stagesVisited = Array.from(new Set(caughtArtists.map(a => a.stage)));
  var stagesVisitedNames = stagesVisited.map(id => STAGES.find(s => s.id === id)).filter(Boolean).map(s => s.name);
  var _artistEpochM = a => {
    var dm = CFG?.dayDates?.[a._night];
    if (!dm) return 0;
    var [h, m] = a.start.split(":").map(Number);
    return dm.midnightUtc + (h < 6 ? h + 24 : h) * 3600000 + m * 60000;
  };
  var walkSequence = caughtArtists.slice().sort((a, b) => _artistEpochM(a) - _artistEpochM(b));
  var walkingMinutesLo = 0,
    walkingMinutesHi = 0;
  var WP = window.WALK_PAIRS || {};
  var PK = window._pairKey || ((a, b) => a < b ? `${a},${b}` : `${b},${a}`);
  for (var i = 1; i < walkSequence.length; i++) {
    var prev = walkSequence[i - 1].stage;
    var cur = walkSequence[i].stage;
    if (prev === cur) continue;
    var pair = WP[PK(prev, cur)];
    if (!pair) continue;
    walkingMinutesLo += pair[0];
    walkingMinutesHi += pair[1];
  }
  var walkingMetersLo = Math.round(walkingMinutesLo * 75);
  var walkingMetersHi = Math.round(walkingMinutesHi * 75);
  var b2bSets = caughtArtists.filter(a => /\bb2b\b/i.test(a.name));
  return {
    setsCount,
    totalMin,
    nights: Object.keys(byNight).length,
    busiestNightLabel,
    busiestNightCount,
    topStage,
    topStageMin,
    topGenre,
    firstSet,
    lastSet,
    headlinersCaught: headlinersCaught.length,
    headlinerNames,
    sunriseSetsCount: sunriseSets.length,
    hiddenGem,
    topByPop,
    momentsCount: allMoments.length,
    photosCount: photoMoments.length,
    videosCount: videoMoments.length,
    stagesVisitedCount: stagesVisited.length,
    stagesVisitedNames,
    walkingMinutesLo,
    walkingMinutesHi,
    walkingMetersLo,
    walkingMetersHi,
    b2bCount: b2bSets.length,
    b2bNames: b2bSets.map(a => a.name),
    heroPhotoMoment,
    missedSaved: (state.saved || []).map(id => ARTISTS.find(a => a.id === id)).filter(a => a && !caughtArtists.some(ca => ca.id === a.id)).sort((a, b) => (b.tier || 0) - (a.tier || 0)).slice(0, 6),
    genreBreakdown: (() => {
      var counts = {};
      caughtArtists.forEach(a => {
        var g = (a.genre || "").toLowerCase();
        if (g) counts[g] = (counts[g] || 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([genre, count]) => ({
        genre,
        count
      }));
    })(),
    vibeScore: (() => {
      var highEnergy = ["dubstep", "bass", "hardstyle", "hardcore", "drum and bass", "dnb", "tech house", "techno", "riddim", "psytrance", "hard dance"];
      var chill = ["ambient", "downtempo", "lofi", "acoustic", "folk", "singer-songwriter", "jazz", "blues"];
      var energy = 0,
        total = 0;
      caughtArtists.forEach(a => {
        var g = (a.genre || "").toLowerCase();
        if (!g) return;
        total++;
        if (highEnergy.some(k => g.includes(k))) energy++;else if (chill.some(k => g.includes(k))) energy -= 0.3;else energy += 0.5;
      });
      return total > 0 ? Math.min(100, Math.max(0, Math.round(energy / total * 100))) : null;
    })()
  };
}
function _fmtHrsMin(mins) {
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  if (h === 0) return `${m}M`;
  if (m === 0) return `${h}H`;
  return `${h}H ${m}M`;
}
function _aggregateSoundtrack(moments) {
  var songMap = {};
  var artists = window.ARTISTS || [];
  var _loop6 = function (m) {
      if (!m.artistId || !m.takenAt) return 0;
      var artist = artists.find(a => a.id === m.artistId);
      if (!artist) return 0;
      var cached = _setlistCache[artist.name.toLowerCase().replace(/\W+/g, "_")];
      if (!cached || cached.source !== "1001tracklists") return 0;
      var match = _matchSongAtTime(artist, cached, m.takenAt);
      if (!match) return 0;
      var key = match.song.toLowerCase();
      if (!songMap[key]) songMap[key] = {
        song: match.song,
        count: 0,
        artists: new Set()
      };
      songMap[key].count++;
      songMap[key].artists.add(artist.name);
    },
    _ret3;
  for (var m of Object.values(moments)) {
    _ret3 = _loop6(m);
    if (_ret3 === 0) continue;
  }
  return Object.values(songMap).sort((a, b) => b.count - a.count);
}
function WrappedStory({
  recap,
  onClose
}) {
  var [idx, setIdx] = React.useState(0);
  var CFG = window.FESTIVAL_CONFIG || {};
  var heroUrl = useMomentPhoto(recap.heroPhotoMoment?.photoId);
  var cards = React.useMemo(() => {
    var c = [];
    c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #6D28D9 50%, #e85d2e 100%)",
      kicker: (CFG.shortName || "FESTIVAL").toUpperCase() + " · " + (CFG.year || ""),
      headline: React.createElement(React.Fragment, null, "Your ", React.createElement("em", null, "Wrapped")),
      sub: `${recap.setsCount} sets · ${recap.nights} nights · ${recap.stagesVisitedCount} stages`
    });
    if (recap.setsCount > 0) c.push({
      bg: "linear-gradient(155deg, #1a120d 0%, #e85d2e 100%)",
      kicker: "SETS CAUGHT",
      headline: React.createElement(React.Fragment, null, recap.setsCount),
      sub: `across ${recap.nights} night${recap.nights !== 1 ? "s" : ""} and ${recap.stagesVisitedCount} stages`
    });
    if (recap.topStage) c.push({
      bg: `linear-gradient(155deg, #0a0618 0%, ${recap.topStage.color} 100%)`,
      kicker: "YOUR HOME STAGE",
      headline: React.createElement(React.Fragment, null, recap.topStage.name),
      sub: `${Math.round(recap.topStageMin / 60 * 10) / 10} hours spent here`
    });
    if (recap.topGenre) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #ec4899 100%)",
      kicker: "TOP GENRE",
      headline: React.createElement(React.Fragment, null, recap.topGenre),
      sub: recap.genreBreakdown ? Object.entries(recap.genreBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g, n]) => `${g}: ${n}`).join(" · ") : ""
    });
    if (recap.totalMin > 0) {
      var mi = recap.walkingMetersHi ? (recap.walkingMetersHi / 1609.34).toFixed(1) : null;
      c.push({
        bg: "linear-gradient(155deg, #1a120d 0%, #22c55e 100%)",
        kicker: "TIME UNDER THE SKY",
        headline: React.createElement(React.Fragment, null, Math.round(recap.totalMin / 60 * 10) / 10, React.createElement("span", {
          style: {
            fontSize: "0.5em"
          }
        }, " hours")),
        sub: mi ? `~${mi} miles walked between stages` : `${recap.setsCount} sets across ${recap.nights} nights`
      });
    }
    if (recap.sunriseSetsCount > 0) c.push({
      bg: "linear-gradient(155deg, #1a120d 0%, #fbbf24 60%, #e85d2e 100%)",
      kicker: "SUNRISE WARRIOR",
      headline: React.createElement(React.Fragment, null, recap.sunriseSetsCount, " sunrise set", recap.sunriseSetsCount > 1 ? "s" : ""),
      sub: recap.lastSet ? `Last set ended at ${window.fmt12?.(recap.lastSet.end) || recap.lastSet.end}` : ""
    });
    if (recap.hiddenGem) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #7b3d9a 100%)",
      kicker: "YOUR HIDDEN GEM",
      headline: React.createElement(React.Fragment, null, recap.hiddenGem.name),
      sub: `Only ${recap.hiddenGem._pop}% mainstream — you found something special`
    });
    if (recap.momentsCount > 0) c.push({
      bg: heroUrl ? `linear-gradient(155deg, rgba(10,6,24,0.8) 0%, rgba(109,40,217,0.7) 100%), url(${heroUrl}) center/cover` : "linear-gradient(155deg, #0a0618 0%, #6D28D9 100%)",
      kicker: "MEMORIES CAPTURED",
      headline: React.createElement(React.Fragment, null, recap.photosCount + recap.videosCount),
      sub: `${recap.photosCount} photos${recap.videosCount ? ` · ${recap.videosCount} videos` : ""} — your festival, preserved`
    });
    var soundtrack = _aggregateSoundtrack(_readMoments());
    if (soundtrack.length > 0) c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #1DB954 100%)",
      kicker: "YOUR SOUNDTRACK",
      headline: React.createElement(React.Fragment, null, soundtrack.length, " ", React.createElement("span", {
        style: {
          fontSize: "0.5em"
        }
      }, "songs captured")),
      sub: soundtrack.slice(0, 3).map(s => s.song).join(" · "),
      custom: React.createElement("div", {
        style: {
          marginTop: 16,
          textAlign: "left",
          width: "100%",
          maxWidth: 300
        }
      }, soundtrack.slice(0, 5).map((s, i) => React.createElement("div", {
        key: i,
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 0.8,
          padding: "6px 0",
          borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.1)" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "rgba(255,255,255,0.9)"
        }
      }, React.createElement("span", {
        style: {
          fontWeight: 700
        }
      }, `${i + 1}. ${s.song}`), React.createElement("span", {
        style: {
          color: "rgba(255,255,255,0.4)",
          fontSize: 8
        }
      }, `${s.count} photo${s.count > 1 ? "s" : ""}`))))
    });
    c.push({
      bg: "linear-gradient(155deg, #0a0618 0%, #6D28D9 50%, #e85d2e 100%)",
      kicker: "THAT'S A WRAP",
      headline: React.createElement(React.Fragment, null, "See you next year"),
      sub: `${recap.setsCount} sets · ${recap.stagesVisitedCount} stages · ${recap.momentsCount} memories`,
      final: true
    });
    return c;
  }, [recap, heroUrl]);
  var card = cards[idx] || cards[0];
  var next = () => setIdx(i => Math.min(i + 1, cards.length - 1));
  var prev = () => setIdx(i => Math.max(i - 1, 0));
  var handleTap = e => {
    var rect = e.currentTarget.getBoundingClientRect();
    var x = e.clientX - rect.left;
    if (x < rect.width * 0.3) prev();else next();
  };
  var handleExport = async () => {
    if (!_isPlusSub()) {
      alert("Upgrade to Plursky+ to export your Wrapped cards.");
      return;
    }
    try {
      await _shareRecapCard(recap);
    } catch {}
  };
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#000",
      display: "flex",
      flexDirection: "column"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 3,
      padding: "12px 16px 0",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2
    }
  }, cards.map((_, i) => React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      background: i <= idx ? "#fff" : "rgba(255,255,255,0.25)",
      transition: "background 0.3s"
    }
  }))), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      position: "absolute",
      top: 22,
      right: 16,
      zIndex: 3,
      width: 36,
      height: 36,
      borderRadius: 36,
      border: "none",
      background: "rgba(255,255,255,0.15)",
      color: "#fff",
      fontSize: 18,
      cursor: "pointer",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "✕"), React.createElement("div", {
    onClick: handleTap,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 32px 120px",
      background: card.bg,
      transition: "background 0.5s",
      cursor: "pointer",
      userSelect: "none"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 2,
      color: "rgba(255,255,255,0.5)",
      fontWeight: 700,
      marginBottom: 24
    }
  }, card.kicker), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: card.headline?.props?.children?.toString?.()?.length > 15 ? 38 : 64,
      lineHeight: 0.95,
      color: "#fff",
      textAlign: "center",
      letterSpacing: -1,
      marginBottom: 16
    }
  }, card.headline), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(255,255,255,0.6)",
      textAlign: "center",
      lineHeight: 1.5,
      maxWidth: 280
    }
  }, card.sub), card.custom && card.custom), React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: "20px 24px 40px",
      display: "flex",
      justifyContent: "center",
      gap: 12
    }
  }, card.final ? React.createElement("button", {
    onClick: onClose,
    className: "mono",
    style: {
      padding: "12px 32px",
      borderRadius: 999,
      border: "none",
      background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
      color: "#fff",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 4px 20px rgba(109,40,217,0.4)"
    }
  }, "CLOSE WRAPPED") : React.createElement("button", {
    onClick: handleExport,
    className: "mono",
    style: {
      padding: "10px 20px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.7)",
      fontSize: 9,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: "pointer",
      backdropFilter: "blur(4px)"
    }
  }, "↗ SHARE CARD", !_isPlusSub() ? " · PLUS" : "")));
}
function RecapCard({
  accent = "var(--ink)",
  paper = "var(--paper)",
  children,
  mono,
  kicker
}) {
  return React.createElement("div", {
    style: {
      borderRadius: 22,
      padding: "26px 22px",
      background: paper,
      color: accent,
      marginBottom: 14,
      minHeight: 200,
      border: "1px solid var(--line)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      boxShadow: "0 6px 22px rgba(26,18,13,0.06)"
    }
  }, kicker && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.5,
      fontWeight: 700,
      color: mono || "var(--muted)",
      marginBottom: 14
    }
  }, kicker), React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, children));
}
var APP_STORE_ID = 6768888507;
var PLUS_KEY = "plursky_plus_active";
var RC_API_KEY = "appl_xXQYsWOMgIpVPdCTxiXmPeyxFId";
var RC_PRODUCT_IDS = {
  festival: "plursky_plus_festival",
  annual: "plursky_plus_annual",
  season: "plursky_season_pass_2026",
  monthly: "plursky_plus_monthly"
};
var RC_ENTITLEMENT = "plus";
var _rcInitialized = false;
async function _initRevenueCat() {
  if (_rcInitialized || !RC_API_KEY) return;
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    var {
      Purchases
    } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({
      apiKey: RC_API_KEY
    });
    _rcInitialized = true;
    var {
      customerInfo
    } = await Purchases.getCustomerInfo();
    _syncEntitlements(customerInfo);
    Purchases.addCustomerInfoUpdateListener(info => _syncEntitlements(info));
    if (typeof DEV !== "undefined") console.log("[plursky-iap] RevenueCat initialized");
  } catch (e) {
    console.warn("[plursky-iap] init failed:", e);
  }
}
function _syncEntitlements(info) {
  var active = info?.entitlements?.active?.[RC_ENTITLEMENT];
  _setPlusSub(!!active);
}
var _IAP_DEV_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1", ""];
function _iapDevHost() {
  try {
    var h = location.hostname;
    return _IAP_DEV_HOSTS.includes(h) || h.endsWith(".local");
  } catch {
    return false;
  }
}
function _iapAvailable() {
  return !!window.Capacitor?.isNativePlatform?.() || _iapDevHost();
}
async function _purchasePlus(productId) {
  if (!window.Capacitor?.isNativePlatform?.()) {
    if (!_iapDevHost()) {
      console.warn("[plursky-iap] purchase blocked — web build has no StoreKit");
      return {
        success: false,
        unsupported: true,
        error: "Plursky+ purchases are only available in the iOS app."
      };
    }
    console.log("[plursky-iap] local dev host — toggling Plus for testing");
    _setPlusSub(true);
    return {
      success: true,
      web: true
    };
  }
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return {
    success: false,
    error: "RevenueCat not configured"
  };
  try {
    var {
      Purchases
    } = await import("@revenuecat/purchases-capacitor");
    var offerings = await Purchases.getOfferings();
    var pkg = offerings?.current?.availablePackages?.find(p => p.product?.identifier === productId);
    if (!pkg) {
      console.warn("[plursky-iap] product not found:", productId);
      return {
        success: false,
        error: "Product not available"
      };
    }
    var {
      customerInfo
    } = await Purchases.purchasePackage({
      aPackage: pkg
    });
    _syncEntitlements(customerInfo);
    return {
      success: !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT]
    };
  } catch (e) {
    if (e?.code === "1" || e?.message?.includes("cancelled")) {
      return {
        success: false,
        cancelled: true
      };
    }
    console.error("[plursky-iap] purchase error:", e);
    return {
      success: false,
      error: e.message
    };
  }
}
var PLUS_PRICE_FALLBACK = {
  [RC_PRODUCT_IDS.season]: "$14.99",
  [RC_PRODUCT_IDS.monthly]: "$4.99"
};
async function _plusPriceStrings() {
  if (!window.Capacitor?.isNativePlatform?.()) return null;
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return null;
  try {
    var {
      Purchases
    } = await import("@revenuecat/purchases-capacitor");
    var offerings = await Purchases.getOfferings();
    var out = {};
    for (var pkg of offerings?.current?.availablePackages || []) {
      var id = pkg.product?.identifier,
        price = pkg.product?.priceString;
      if (id && price) out[id] = price;
    }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.warn("[plursky-iap] price lookup failed, using fallback copy:", e?.message);
    return null;
  }
}
function usePlusPrices() {
  var [prices, setPrices] = React.useState(PLUS_PRICE_FALLBACK);
  React.useEffect(() => {
    var dead = false;
    _plusPriceStrings().then(live => {
      if (!dead && live) setPrices({
        ...PLUS_PRICE_FALLBACK,
        ...live
      });
    });
    return () => {
      dead = true;
    };
  }, []);
  return prices;
}
async function _restorePurchases() {
  if (!window.Capacitor?.isNativePlatform?.()) return {
    success: false,
    error: "Web mode"
  };
  if (!_rcInitialized) await _initRevenueCat();
  if (!_rcInitialized) return {
    success: false,
    error: "RevenueCat not configured"
  };
  try {
    var {
      Purchases
    } = await import("@revenuecat/purchases-capacitor");
    var {
      customerInfo
    } = await Purchases.restorePurchases();
    _syncEntitlements(customerInfo);
    var restored = !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT];
    return {
      success: true,
      restored
    };
  } catch (e) {
    console.error("[plursky-iap] restore error:", e);
    return {
      success: false,
      error: e.message
    };
  }
}
function _isPlusSub() {
  try {
    return localStorage.getItem(PLUS_KEY) === "1";
  } catch {
    return false;
  }
}
function _setPlusSub(v) {
  try {
    localStorage.setItem(PLUS_KEY, v ? "1" : "0");
  } catch {}
}
try {
  _initRevenueCat();
} catch {}
function PlusGate({
  children,
  feature
}) {
  var [busy, setBusy] = React.useState(false);
  var [pending, setPending] = React.useState(null);
  var prices = usePlusPrices();
  if (_isPlusSub()) return children;
  var canBuy = _iapAvailable();
  var handlePurchase = async productId => {
    var target = productId || RC_PRODUCT_IDS.season;
    setBusy(true);
    setPending(target);
    try {
      var result = await _purchasePlus(target);
      if (result.success) window.location.reload();
    } catch {}
    setBusy(false);
    setPending(null);
  };
  var handleRestore = async () => {
    setBusy(true);
    try {
      var result = await _restorePurchases();
      if (result.restored) window.location.reload();else if (!result.restored && result.success) alert("No previous Plursky+ purchase found for this Apple ID.");
    } catch {}
    setBusy(false);
  };
  var _PLUS_PERKS = [["No watermarks", "Clean, brandable exports"], ["Cloud backup", "Your photos & videos, saved safely"], ["Unlimited shares", "No daily limit"], ["Premium templates", "Film Strip, Passport & more"], ["Custom accents", "Pick your festival color"]];
  return React.createElement("div", {
    style: {
      position: "relative",
      borderRadius: 14,
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      filter: "blur(3px)",
      pointerEvents: "none",
      opacity: 0.35
    }
  }, children), React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      background: "linear-gradient(180deg, rgba(26,18,13,0.85) 0%, rgba(109,40,217,0.55) 100%)",
      backdropFilter: "blur(6px)"
    }
  }, React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: "50%",
      marginBottom: 10,
      background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 0 24px rgba(109,40,217,0.5)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "+")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      color: "#fff",
      letterSpacing: -0.5
    }
  }, "Plursky+"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "rgba(255,255,255,0.5)",
      marginTop: 4,
      marginBottom: 14
    }
  }, "UNLOCK ", (feature || "THIS FEATURE").toUpperCase()), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 7,
      width: "80%",
      maxWidth: 240,
      marginBottom: 16
    }
  }, _PLUS_PERKS.map(([title, sub], i) => React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: "50%",
      flexShrink: 0,
      background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      color: "#fff",
      fontWeight: 700
    }
  }, "✓"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#fff",
      fontWeight: 600
    }
  }, title), React.createElement("div", {
    style: {
      fontSize: 9,
      color: "rgba(255,255,255,0.45)"
    }
  }, sub))))), canBuy ? React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => handlePurchase(RC_PRODUCT_IDS.season),
    disabled: busy,
    className: "mono",
    style: {
      padding: "11px 28px",
      borderRadius: 12,
      border: "none",
      background: busy ? "rgba(109,40,217,0.5)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
      color: "#fff",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: busy ? "wait" : "pointer",
      boxShadow: "0 4px 20px rgba(109,40,217,0.45), 0 0 40px rgba(232,93,46,0.2)"
    }
  }, pending === RC_PRODUCT_IDS.season ? "PROCESSING…" : `${prices[RC_PRODUCT_IDS.season]} SEASON PASS`), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.5,
      color: "rgba(255,255,255,0.4)",
      marginTop: 6,
      lineHeight: 1.5,
      maxWidth: 264,
      textAlign: "center"
    }
  }, "Season Pass · ", prices[RC_PRODUCT_IDS.season], " one-time purchase. No subscription, nothing auto-renews."), React.createElement("button", {
    onClick: () => handlePurchase(RC_PRODUCT_IDS.monthly),
    disabled: busy,
    className: "mono",
    style: {
      marginTop: 12,
      padding: "9px 24px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.22)",
      background: "transparent",
      color: busy ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)",
      fontSize: 9,
      letterSpacing: 1.4,
      fontWeight: 700,
      cursor: busy ? "wait" : "pointer"
    }
  }, pending === RC_PRODUCT_IDS.monthly ? "PROCESSING…" : `${prices[RC_PRODUCT_IDS.monthly]} / MONTH`), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.5,
      color: "rgba(255,255,255,0.4)",
      marginTop: 6,
      lineHeight: 1.5,
      maxWidth: 264,
      textAlign: "center"
    }
  }, "Plursky+ · ", prices[RC_PRODUCT_IDS.monthly], "/month, auto-renews until cancelled. Payment is charged to your Apple ID; manage or cancel anytime in Settings."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.5,
      color: "rgba(255,255,255,0.4)",
      marginTop: 6,
      textAlign: "center"
    }
  }, React.createElement("a", {
    href: "./terms.html",
    target: "_blank",
    rel: "noopener",
    style: {
      color: "rgba(255,255,255,0.6)"
    }
  }, "Terms"), "   ·   ", React.createElement("a", {
    href: "./privacy.html",
    target: "_blank",
    rel: "noopener",
    style: {
      color: "rgba(255,255,255,0.6)"
    }
  }, "Privacy")), React.createElement("button", {
    onClick: handleRestore,
    disabled: busy,
    className: "mono",
    style: {
      marginTop: 10,
      padding: "4px 12px",
      borderRadius: 6,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "transparent",
      color: "rgba(255,255,255,0.4)",
      fontSize: 8,
      letterSpacing: 1,
      cursor: "pointer"
    }
  }, "RESTORE PURCHASE")) : React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 0.6,
      color: "rgba(255,255,255,0.55)",
      marginTop: 2,
      lineHeight: 1.6,
      maxWidth: 264,
      textAlign: "center"
    }
  }, "Plursky+ is available in the iOS app.", React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement("a", {
    href: _appStoreUrl(),
    target: "_blank",
    rel: "noopener",
    style: {
      display: "inline-block",
      padding: "8px 20px",
      borderRadius: 10,
      background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
      color: "#fff",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700,
      textDecoration: "none"
    }
  }, "GET THE APP")), React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, React.createElement("a", {
    href: "./terms.html",
    target: "_blank",
    rel: "noopener",
    style: {
      color: "rgba(255,255,255,0.5)"
    }
  }, "Terms"), "   ·   ", React.createElement("a", {
    href: "./privacy.html",
    target: "_blank",
    rel: "noopener",
    style: {
      color: "rgba(255,255,255,0.5)"
    }
  }, "Privacy")))));
}
var DAILY_SHARE_LIMIT = 5;
function _getShareCount() {
  try {
    var raw = JSON.parse(localStorage.getItem("plursky_share_count") || "{}");
    var today = new Date().toISOString().slice(0, 10);
    return raw.date === today ? raw.count || 0 : 0;
  } catch {
    return 0;
  }
}
function _incShareCount() {
  var today = new Date().toISOString().slice(0, 10);
  var count = _getShareCount() + 1;
  try {
    localStorage.setItem("plursky_share_count", JSON.stringify({
      date: today,
      count
    }));
  } catch {}
  return count;
}
function _canShare() {
  if (_isPlusSub()) return {
    allowed: true,
    remaining: Infinity
  };
  var used = _getShareCount();
  return {
    allowed: used < DAILY_SHARE_LIMIT,
    remaining: DAILY_SHARE_LIMIT - used
  };
}
function _showShareLimitToast() {
  var el = document.getElementById("plursky-share-limit");
  if (el) return;
  el = document.createElement("div");
  el.id = "plursky-share-limit";
  el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;padding:14px 20px;text-align:center;font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:1.2px;font-weight:700;color:#fff;background:#e85d2e;";
  el.textContent = "📸 DAILY SHARE LIMIT REACHED · UPGRADE TO PLURSKY+ FOR UNLIMITED";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
function _exportScale() {
  return _isPlusSub() ? 1 : 0.5;
}
function _exportW() {
  return Math.round(1080 * _exportScale());
}
function _exportH(baseH) {
  return Math.round((baseH || 1350) * _exportScale());
}
function _archiveRecap(festivalId, recap) {
  try {
    var key = "plursky_recap_archive";
    var archive = JSON.parse(localStorage.getItem(key) || "{}");
    archive[festivalId] = {
      ...recap,
      archivedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(archive));
  } catch {}
}
function _getRecapArchive() {
  try {
    return JSON.parse(localStorage.getItem("plursky_recap_archive") || "{}");
  } catch {
    return {};
  }
}
function _canAccessFestival(festivalEntry) {
  if (festivalEntry.available) return true;
  if (festivalEntry.previewOnly && _isPlusSub()) return true;
  return false;
}
function _getCustomAccent() {
  if (!_isPlusSub()) return null;
  try {
    return localStorage.getItem("plursky_custom_accent") || null;
  } catch {
    return null;
  }
}
function _setCustomAccent(hex) {
  try {
    localStorage.setItem("plursky_custom_accent", hex);
  } catch {}
}
function _appStoreUrl() {
  if (APP_STORE_ID) return `https://apps.apple.com/app/plursky-live/id${APP_STORE_ID}`;
  return "https://apps.apple.com/search?term=plursky%20live";
}
async function requestRating() {
  try {
    var native = window.Capacitor?.Plugins?.InAppReview;
    if (native?.requestReview && window.Capacitor?.isNativePlatform?.()) {
      await native.requestReview();
      return {
        ok: true,
        source: "native"
      };
    }
  } catch (e) {}
  try {
    window.open(_appStoreUrl(), "_blank", "noopener");
    return {
      ok: true,
      source: "web"
    };
  } catch {
    return {
      ok: false
    };
  }
}
function _maybeAutoRatingPromptOnRecap() {
  try {
    var key = "plursky_recap_visits_v1";
    var visits = parseInt(localStorage.getItem(key) || "0", 10) + 1;
    localStorage.setItem(key, String(visits));
    var lastPromptedAt = parseInt(localStorage.getItem("plursky_rating_prompted_at") || "0", 10);
    var oneYearMs = 365 * 24 * 3600 * 1000;
    if (visits < 2) return;
    if (lastPromptedAt && Date.now() - lastPromptedAt < oneYearMs) return;
    if (!window.Capacitor?.isNativePlatform?.()) return;
    localStorage.setItem("plursky_rating_prompted_at", String(Date.now()));
    setTimeout(() => {
      requestRating().catch(() => {});
    }, 1500);
  } catch {}
}
function FestivalYearCard({
  yearData
}) {
  var [sharing, setSharing] = React.useState(false);
  if (!yearData || yearData.archivedCount < 1 || yearData.totalFestivals < 2) return null;
  var yd = yearData;
  var shareYear = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await window._shareFestivalYearCard?.(yd);
    } catch {}
    setSharing(false);
  };
  return React.createElement(RecapCard, {
    kicker: `YOUR FESTIVAL YEAR · ${yd.year}`,
    paper: "#0a0618",
    accent: "#fff",
    mono: "rgba(247,237,224,0.5)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      color: "#f7ede0",
      letterSpacing: -0.3
    }
  }, yd.totalFestivals, " festivals. One", " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "#a78bfa"
    }
  }, "year"), "."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "rgba(247,237,224,0.6)",
      marginTop: 8
    }
  }, yd.totalSets, " SETS · ", yd.totalMoments, " MEMORIES", yd.totalMin > 0 ? ` · ${_fmtHrsMin(yd.totalMin).toUpperCase()} ON DANCEFLOORS` : ""), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginTop: 14
    }
  }, yd.festivals.map(f => React.createElement("div", {
    key: f.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "9px 12px",
      borderRadius: 12,
      background: "rgba(247,237,224,0.06)",
      border: "1px solid rgba(247,237,224,0.1)"
    }
  }, React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      flexShrink: 0,
      background: "linear-gradient(135deg, var(--ember), #6D28D9)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 800,
      fontSize: 12
    }
  }, (f.brand || f.name || "?").slice(0, 2).toUpperCase()), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 15,
      lineHeight: 1.1,
      color: "#f7ede0",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, f.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1,
      color: "rgba(247,237,224,0.45)",
      marginTop: 2
    }
  }, f.sets, " SETS · ", f.moments, " MEMORIES", f.archived ? "" : " · LIVE"))))), yd.topArtists.length > 0 && React.createElement("div", {
    style: {
      marginTop: 12
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "rgba(247,237,224,0.4)",
      fontWeight: 700,
      marginBottom: 6
    }
  }, "YOUR ARTISTS OF THE YEAR"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, yd.topArtists.slice(0, 3).map(a => React.createElement("span", {
    key: a.name,
    className: "mono",
    style: {
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(167,139,250,0.15)",
      border: "1px solid rgba(167,139,250,0.3)",
      color: "#e9e2f7",
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: 700
    }
  }, "★ ", a.name.toUpperCase(), a.count > 1 ? ` ×${a.count}` : "")))), React.createElement("button", {
    onClick: shareYear,
    disabled: sharing,
    className: "mono",
    style: {
      width: "100%",
      marginTop: 14,
      padding: "13px",
      background: sharing ? "rgba(109,40,217,0.4)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
      color: "#fff",
      border: "none",
      borderRadius: 12,
      cursor: sharing ? "wait" : "pointer",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700
    }
  }, sharing ? "⏳ RENDERING…" : "📤 SHARE YOUR YEAR"));
}
function FestivalArchiveList({
  archive
}) {
  if (!archive?.length) return null;
  var sorted = [...archive].sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""));
  return React.createElement("div", {
    style: {
      marginTop: 8,
      borderTop: "1px solid var(--line)",
      paddingTop: 20
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 10
    }
  }, "FESTIVAL ARCHIVE · ", archive.length, " ", archive.length === 1 ? "PAST FESTIVAL" : "PAST FESTIVALS"), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, sorted.map(f => React.createElement("div", {
    key: f.id,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 14,
      background: "var(--paper-2)",
      border: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 12,
      background: "linear-gradient(135deg, var(--ember), var(--horizon))",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      fontWeight: 800,
      fontSize: 16,
      flexShrink: 0
    }
  }, (f.brand || f.name || "?").slice(0, 2).toUpperCase()), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 17,
      lineHeight: 1.1,
      color: "var(--ink)"
    }
  }, f.name || f.id), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 3
    }
  }, f.dates ? `${f.dates.toUpperCase()} · ` : "", f.totalAttended, " CAUGHT · ", f.totalMoments, " MEMORIES"))))), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 10,
      textAlign: "center"
    }
  }, "TAP TO VIEW · COMING SOON"));
}
function RecapScreen({
  state,
  setState
}) {
  var recap = React.useMemo(() => _computeRecap(state), [state]);
  var yearData = React.useMemo(() => {
    try {
      return _computeFestivalYear();
    } catch {
      return null;
    }
  }, [state]);
  var CFG = window.FESTIVAL_CONFIG || {};
  var fmt12 = window.fmt12 || (t => t);
  var [wrappedOpen, setWrappedOpen] = React.useState(false);
  var back = () => window._popNav ? window._popNav() : setState(s => ({
    ...s,
    tab: "me"
  }));
  React.useEffect(() => {
    if (recap.setsCount > 0 || recap.momentsCount > 0) {
      _maybeAutoRatingPromptOnRecap();
      _archiveRecap(CFG.id, recap);
    }
  }, []);
  var heroPhotoUrl = useMomentPhoto(recap.heroPhotoMoment?.photoId);
  var [crewStats, setCrewStats] = React.useState(null);
  React.useEffect(() => {
    var cancelled = false;
    try {
      var code = localStorage.getItem("plursky_group_code");
      if (!code || typeof window.sbCrewFetchMessages !== "function") return;
      window.sbCrewFetchMessages(code, 100).then(rows => {
        if (cancelled) return;
        if (!rows?.length) {
          setCrewStats({
            total: 0,
            code
          });
          return;
        }
        var counts = {};
        rows.forEach(r => {
          var name = r.sender_name || "Friend";
          counts[name] = (counts[name] || 0) + 1;
        });
        var top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        setCrewStats({
          total: rows.length,
          uniqueSenders: Object.keys(counts).length,
          topSender: top ? {
            name: top[0],
            count: top[1]
          } : null,
          code
        });
      }).catch(() => {});
    } catch {}
    return () => {
      cancelled = true;
    };
  }, []);
  var [playlistState, setPlaylistState] = React.useState({
    status: "idle"
  });
  var buildAttendedPlaylist = async () => {
    setPlaylistState({
      status: "building"
    });
    try {
      var result = await createEdcPlaylist(state, {
        source: "attended"
      });
      if (result.ok) {
        setPlaylistState({
          status: "done",
          url: result.url,
          added: result.added
        });
      } else {
        var reason = result.reason || "fail";
        var msg = {
          not_connected: "Connect Spotify on the Me tab first.",
          empty: "Mark sets you caught in Memories first.",
          reconnect: "Reconnect Spotify (needs playlist permission).",
          no_target_playlist: "Create an empty Spotify playlist named 'Plursky' first.",
          rate_limited: "Spotify is throttling — wait 30s and retry."
        }[reason] || result.message || "Couldn't build playlist.";
        setPlaylistState({
          status: "error",
          msg
        });
      }
    } catch (e) {
      setPlaylistState({
        status: "error",
        msg: e?.message || "Couldn't build playlist."
      });
    }
  };
  if (recap.setsCount === 0 && recap.momentsCount === 0) {
    var archive = typeof _readArchive === "function" ? _readArchive() : {};
    var archived = Object.values(archive).filter(f => f.id !== CFG.id);
    return React.createElement(Screen, {
      bg: "var(--paper)"
    }, React.createElement("div", {
      style: {
        padding: "8px 20px",
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement("button", {
      onClick: back,
      "aria-label": "Back",
      style: {
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: 22,
        color: "var(--ink)",
        lineHeight: 1,
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }
    }, "←"), React.createElement(TopBar, {
      title: React.createElement("span", null, "Recap"),
      sub: CFG.shortName?.toUpperCase(),
      tight: true
    })), React.createElement(ScrollBody, {
      style: {
        padding: "10px 20px 94px"
      }
    }, React.createElement("div", {
      style: {
        padding: "40px 0 24px",
        textAlign: "center"
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 24,
        color: "var(--muted)",
        fontStyle: "italic",
        marginBottom: 8
      }
    }, "Nothing to recap yet"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 1.2,
        color: "var(--muted)"
      }
    }, "MARK SETS YOU CAUGHT IN MEMORIES — TODAY'S WEEKEND RECAP WILL FILL IN")), React.createElement(FestivalYearCard, {
      yearData: yearData
    }), archived.length > 0 && React.createElement(FestivalArchiveList, {
      archive: archived
    })));
  }
  return React.createElement(Screen, {
    bg: "var(--paper-2)"
  }, React.createElement("div", {
    style: {
      padding: "8px 20px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "var(--paper)"
    }
  }, React.createElement("button", {
    onClick: back,
    "aria-label": "Back",
    style: {
      background: "transparent",
      border: "none",
      padding: 0,
      cursor: "pointer",
      fontSize: 22,
      color: "var(--ink)",
      lineHeight: 1,
      width: 30,
      height: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, "←"), React.createElement(TopBar, {
    title: React.createElement("span", null, "Recap"),
    sub: (CFG.shortName || "Festival").toUpperCase() + " · YOUR WEEKEND",
    tight: true
  })), React.createElement(ScrollBody, {
    style: {
      padding: "14px 16px 94px"
    }
  }, React.createElement("div", {
    style: {
      borderRadius: 22,
      padding: "26px 22px",
      marginBottom: 14,
      background: heroPhotoUrl ? `linear-gradient(155deg, rgba(26,18,13,0.85) 0%, rgba(123,61,154,0.72) 60%, rgba(232,93,46,0.65) 130%), url(${heroPhotoUrl}) center/cover` : "linear-gradient(155deg, var(--ink) 0%, var(--horizon) 60%, var(--ember) 130%)",
      color: "var(--paper)",
      boxShadow: "0 10px 30px rgba(26,18,13,0.18)",
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("button", {
    onClick: async () => {
      await _shareRecapCard(recap);
    },
    "aria-label": "Share recap",
    style: {
      position: "absolute",
      top: 16,
      right: 16,
      padding: "7px 12px",
      borderRadius: 999,
      background: "rgba(247,237,224,0.18)",
      color: "#f7ede0",
      border: "1px solid rgba(247,237,224,0.35)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700,
      backdropFilter: "blur(8px)"
    }
  }, "↗ SHARE"), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "rgba(247,237,224,0.75)",
      fontWeight: 700,
      marginBottom: 10
    }
  }, "YOUR ", (CFG.shortName || "FESTIVAL").toUpperCase(), " · ", CFG.year || "")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 42,
      lineHeight: 0.95,
      letterSpacing: -0.5,
      marginBottom: 18
    }
  }, "That was ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--flare)"
    }
  }, "your"), " weekend."), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 1
    }
  }, recap.setsCount), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700,
      color: "rgba(247,237,224,0.7)",
      marginTop: 3
    }
  }, "SETS CAUGHT")), React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 1
    }
  }, _fmtHrsMin(recap.totalMin)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700,
      color: "rgba(247,237,224,0.7)",
      marginTop: 3
    }
  }, "ON DANCEFLOORS")), React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 1
    }
  }, recap.nights), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700,
      color: "rgba(247,237,224,0.7)",
      marginTop: 3
    }
  }, "NIGHTS")), React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 1
    }
  }, recap.headlinersCaught), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700,
      color: "rgba(247,237,224,0.7)",
      marginTop: 3
    }
  }, "HEADLINERS")))), recap.setsCount > 0 && React.createElement("button", {
    onClick: () => setWrappedOpen(true),
    style: {
      width: "100%",
      padding: "16px 20px",
      marginBottom: 14,
      borderRadius: 16,
      border: "none",
      cursor: "pointer",
      background: "linear-gradient(135deg, #6D28D9, #e85d2e)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      boxShadow: "0 4px 20px rgba(109,40,217,0.35)"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "left"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.1
    }
  }, "Your ", React.createElement("em", null, "Wrapped")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.4,
      color: "rgba(255,255,255,0.6)",
      marginTop: 3,
      fontWeight: 700
    }
  }, "SWIPE THROUGH YOUR FESTIVAL STORY")), React.createElement("span", {
    style: {
      fontSize: 22
    }
  }, "→")), (() => {
    var soundtrack = _aggregateSoundtrack(_readMoments());
    if (!soundtrack.length) return null;
    return React.createElement(RecapCard, {
      kicker: "YOUR SOUNDTRACK",
      paper: "#1DB95418",
      mono: "#1DB954"
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 28,
        lineHeight: 1.1,
        letterSpacing: -0.4,
        marginBottom: 10
      }
    }, React.createElement("span", {
      style: {
        color: "#1DB954"
      }
    }, soundtrack.length), " songs were playing when you took photos"), React.createElement("div", {
      style: {
        marginTop: 8
      }
    }, soundtrack.slice(0, 5).map((s, i) => React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: i < Math.min(soundtrack.length, 5) - 1 ? "1px solid var(--line)" : "none"
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
        fontWeight: 700,
        letterSpacing: 0.6,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, i + 1, ". ", s.song), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        color: "var(--muted)",
        letterSpacing: 0.8,
        marginTop: 1
      }
    }, [...s.artists].join(", "))), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 0.8,
        color: "#1DB954",
        fontWeight: 700,
        flexShrink: 0,
        marginLeft: 8
      }
    }, s.count, " ", s.count === 1 ? "PHOTO" : "PHOTOS")))), soundtrack.length > 0 && React.createElement("button", {
      onClick: () => {
        var q = soundtrack.slice(0, 10).map(s => s.song).join(" ");
        window.open(`https://open.spotify.com/search/${encodeURIComponent(q)}`, "_blank");
      },
      style: {
        marginTop: 12,
        width: "100%",
        padding: "10px 16px",
        borderRadius: 20,
        border: "none",
        cursor: "pointer",
        background: "#1DB954",
        color: "#fff",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14
      }
    }, "♫"), " FIND ON SPOTIFY"));
  })(), recap.topStage && React.createElement(RecapCard, {
    kicker: "YOUR HEADQUARTERS",
    paper: `${recap.topStage.color}18`,
    mono: recap.topStage.color
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 32,
      lineHeight: 1,
      letterSpacing: -0.4,
      marginBottom: 8
    }
  }, "You lived at ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: recap.topStage.color
    }
  }, recap.topStage.name)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 6,
      fontWeight: 600
    }
  }, _fmtHrsMin(recap.topStageMin), " of your weekend was right here")), recap.busiestNightCount > 0 && React.createElement(RecapCard, {
    kicker: "BUSIEST NIGHT"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 32,
      lineHeight: 1.0,
      letterSpacing: -0.4
    }
  }, React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, recap.busiestNightLabel), " was your peak —", " ", recap.busiestNightCount, " sets in one night.")), recap.topGenre && React.createElement(RecapCard, {
    kicker: "THE SOUND OF YOUR WEEKEND",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.0,
      letterSpacing: -0.4
    }
  }, "You went deep on", " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--horizon)"
    }
  }, recap.topGenre), ".")), recap.firstSet && recap.lastSet && React.createElement(RecapCard, {
    kicker: "BOOKENDS"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.15,
      marginBottom: 14
    }
  }, "You opened with ", React.createElement("span", {
    style: {
      color: "var(--ember-ink)"
    }
  }, recap.firstSet.name), React.createElement("span", {
    style: {
      color: "var(--muted)",
      fontSize: 16
    }
  }, " · ", fmt12(recap.firstSet.start))), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.15
    }
  }, "and closed with ", React.createElement("span", {
    style: {
      color: "var(--ember-ink)"
    }
  }, recap.lastSet.name), React.createElement("span", {
    style: {
      color: "var(--muted)",
      fontSize: 16
    }
  }, " · ", fmt12(recap.lastSet.start)))), recap.sunriseSetsCount > 0 && React.createElement(RecapCard, {
    kicker: "STAYED UP"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 32,
      lineHeight: 1.0,
      letterSpacing: -0.4
    }
  }, recap.sunriseSetsCount === 1 ? "One sunrise set" : `${recap.sunriseSetsCount} sunrise sets`, ".", " ", React.createElement("span", {
    style: {
      color: "var(--flare)",
      fontStyle: "italic"
    }
  }, "Respect."))), recap.hiddenGem && React.createElement(RecapCard, {
    kicker: "HIDDEN GEM",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3
    }
  }, "Most under-the-radar artist you saw:", " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--horizon)"
    }
  }, recap.hiddenGem.name), "."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 10,
      fontWeight: 600
    }
  }, "SPOTIFY POPULARITY ", recap.hiddenGem._pop, " / 100 · TASTE 🤌")), recap.stagesVisitedCount > 0 && React.createElement(RecapCard, {
    kicker: `STAGES VISITED · ${recap.stagesVisitedCount} OF ${(window.STAGES || []).length}`
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 10
    }
  }, recap.stagesVisitedCount === (window.STAGES || []).length ? React.createElement(React.Fragment, null, "Every ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "stage"), ". Completionist.") : React.createElement(React.Fragment, null, "You set foot at ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, recap.stagesVisitedCount), " of ", (window.STAGES || []).length, " stages.")), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 5,
      marginTop: 8
    }
  }, recap.stagesVisitedNames.map(name => React.createElement("span", {
    key: name,
    className: "mono",
    style: {
      padding: "4px 9px",
      borderRadius: 999,
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: 700
    }
  }, name.toUpperCase())))), recap.walkingMinutesHi > 0 && React.createElement(RecapCard, {
    kicker: "DISTANCE COVERED"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3
    }
  }, "You walked roughly", " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--horizon)"
    }
  }, recap.walkingMetersHi >= 1000 ? `${(recap.walkingMetersLo / 1000).toFixed(1)}–${(recap.walkingMetersHi / 1000).toFixed(1)} km` : `${recap.walkingMetersLo}–${recap.walkingMetersHi} m`), " ", "between stages."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 10,
      fontWeight: 600
    }
  }, "~", recap.walkingMinutesLo, "–", recap.walkingMinutesHi, " MIN WALKING TOTAL")), recap.b2bCount > 0 && React.createElement(RecapCard, {
    kicker: `B2B SETS · ${recap.b2bCount}`
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 8
    }
  }, "You caught ", recap.b2bCount === 1 ? "a" : recap.b2bCount, " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "back-to-back"), " collab", recap.b2bCount === 1 ? "" : "s", "."), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.45
    }
  }, recap.b2bNames.join(" · "))), recap.headlinersCaught > 0 && React.createElement(RecapCard, {
    kicker: `HEADLINERS CAUGHT · ${recap.headlinersCaught}`
  }, React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 4
    }
  }, recap.headlinerNames.map(n => React.createElement("span", {
    key: n,
    className: "mono",
    style: {
      padding: "6px 11px",
      borderRadius: 999,
      background: "var(--ink)",
      color: "var(--paper)",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "★ ", n.toUpperCase())))), recap.momentsCount > 0 && React.createElement(RecapCard, {
    kicker: "MEMORIES",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 32,
      lineHeight: 1.0,
      letterSpacing: -0.4
    }
  }, React.createElement("span", {
    style: {
      color: "var(--ember-ink)"
    }
  }, recap.momentsCount), " ", recap.momentsCount === 1 ? "moment" : "moments", " captured."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 10,
      fontWeight: 600
    }
  }, recap.photosCount, " PHOTO", recap.photosCount === 1 ? "" : "S", recap.videosCount > 0 ? ` · ${recap.videosCount} VIDEO${recap.videosCount === 1 ? "" : "S"}` : ""), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 14,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    onClick: () => setState(s => ({
      ...s,
      tab: "memories"
    })),
    style: {
      padding: "8px 14px",
      borderRadius: 999,
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "OPEN MEMORIES →"), React.createElement("button", {
    onClick: async () => {
      var all = [];
      try {
        var raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
        for (var n of Object.keys(raw)) {
          for (var m of raw[n] || []) all.push(m);
        }
      } catch {}
      await window._shareWeekendCollage?.(all);
    },
    style: {
      padding: "8px 14px",
      borderRadius: 999,
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "📸 SHARE WEEKEND"), React.createElement("button", {
    onClick: async () => {
      var all = [];
      try {
        var raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
        for (var n of Object.keys(raw)) {
          for (var m of raw[n] || []) all.push(m);
        }
      } catch {}
      await window._shareWeekendCollage?.(all, "gif");
    },
    style: {
      padding: "8px 14px",
      borderRadius: 999,
      background: "#6D28D9",
      color: "#fff",
      border: "none",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "🎬 GIF"))), recap.momentsCount >= 3 && (() => {
    var [vidTemplate, setVidTemplate] = React.useState("highlight");
    var [vidFormat, setVidFormat] = React.useState("story");
    var [vidState, setVidState] = React.useState("idle");
    var [trackQuery, setTrackQuery] = React.useState("");
    var [trackResults, setTrackResults] = React.useState([]);
    var [selectedTrack, setSelectedTrack] = React.useState(null);
    var [previewAudio, setPreviewAudio] = React.useState(null);
    var [searching, setSearching] = React.useState(false);
    var searchTracks = async q => {
      if (!q || q.length < 2) {
        setTrackResults([]);
        return;
      }
      setSearching(true);
      try {
        var token = localStorage.getItem("spotify_token");
        if (token) {
          var res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=6`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            var d = await res.json();
            setTrackResults((d.tracks?.items || []).filter(t => t.preview_url).slice(0, 5));
          }
        } else {
          var _res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=6`);
          if (_res.ok) {
            var _d = await _res.json();
            setTrackResults((_d.results || []).filter(t => t.previewUrl).slice(0, 5).map(t => ({
              name: t.trackName,
              artists: [{
                name: t.artistName
              }],
              preview_url: t.previewUrl,
              album: {
                images: [{
                  url: t.artworkUrl60
                }]
              }
            })));
          }
        }
      } catch {}
      setSearching(false);
    };
    var togglePreview = url => {
      if (previewAudio) {
        previewAudio.pause();
        setPreviewAudio(null);
      }
      if (previewAudio?.src === url) return;
      var a = new Audio(url);
      a.play().catch(() => {});
      setPreviewAudio(a);
    };
    return React.createElement(RecapCard, {
      kicker: "RECAP VIDEO",
      paper: "#1a120d",
      accent: "#fff"
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 28,
        lineHeight: 1.05,
        color: "#f7ede0",
        letterSpacing: -0.3
      }
    }, "Turn your memories into a", " ", React.createElement("span", {
      style: {
        fontStyle: "italic",
        color: "#a78bfa"
      }
    }, "video"), "."), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginTop: 12
      }
    }, ["highlight", "diary", "ditl"].map(t => {
      var locked = t !== "highlight" && !_isPlusSub();
      return React.createElement("button", {
        key: t,
        onClick: () => locked ? null : setVidTemplate(t),
        className: "mono",
        style: {
          padding: "5px 10px",
          borderRadius: 999,
          cursor: locked ? "default" : "pointer",
          border: "none",
          background: vidTemplate === t ? "#6D28D9" : "rgba(247,237,224,0.1)",
          color: vidTemplate === t ? "#fff" : locked ? "rgba(247,237,224,0.25)" : "rgba(247,237,224,0.5)",
          fontSize: 9,
          letterSpacing: 1.2,
          fontWeight: 700,
          opacity: locked ? 0.6 : 1
        }
      }, t === "highlight" ? "HIGHLIGHT REEL" : t === "diary" ? "🔒 FESTIVAL DIARY" : "🔒 DAY IN THE LIFE", locked ? "" : "");
    })), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        color: "rgba(247,237,224,0.35)",
        marginTop: 8,
        letterSpacing: 1
      }
    }, vidTemplate === "highlight" ? "Fast cuts synced to the beat — your best moments, drop by drop." : vidTemplate === "diary" ? "Slow, cinematic. Your weekend told as a story." : "Morning to sunrise — one continuous timeline."), React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginTop: 12,
        alignItems: "center"
      }
    }, [["story", "📱 STORY 9:16"], ["feed", "FEED 4:5"]].map(([f, label]) => React.createElement("button", {
      key: f,
      onClick: () => setVidFormat(f),
      className: "mono",
      style: {
        padding: "5px 10px",
        borderRadius: 999,
        cursor: "pointer",
        border: vidFormat === f ? "1px solid #a78bfa" : "1px solid rgba(247,237,224,0.15)",
        background: vidFormat === f ? "rgba(109,40,217,0.35)" : "transparent",
        color: vidFormat === f ? "#fff" : "rgba(247,237,224,0.5)",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700
      }
    }, label)), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        color: "rgba(247,237,224,0.3)",
        letterSpacing: 1
      }
    }, vidFormat === "story" ? "FOR IG STORIES · TIKTOK" : "FOR THE FEED")), React.createElement("div", {
      style: {
        marginTop: 14
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: "rgba(247,237,224,0.4)",
        marginBottom: 6
      }
    }, "🎵 ", selectedTrack ? "SOUNDTRACK" : _isPlusSub() ? "PICK A SONG (OPTIONAL)" : "🔒 CUSTOM SOUNDTRACK · PLURSKY+"), !_isPlusSub() && !selectedTrack ? React.createElement("div", {
      className: "mono",
      style: {
        padding: "8px 12px",
        borderRadius: 10,
        background: "rgba(247,237,224,0.04)",
        border: "1px solid rgba(247,237,224,0.08)",
        color: "rgba(247,237,224,0.2)",
        fontSize: 10,
        textAlign: "center"
      }
    }, "Upgrade to Plursky+ to pick your own soundtrack") : selectedTrack ? React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(109,40,217,0.2)"
      }
    }, selectedTrack.album?.images?.[0]?.url && React.createElement("img", {
      src: selectedTrack.album.images[0].url,
      alt: "",
      style: {
        width: 32,
        height: 32,
        borderRadius: 6
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        color: "#f7ede0",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, selectedTrack.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        color: "rgba(247,237,224,0.5)"
      }
    }, selectedTrack.artists?.[0]?.name)), React.createElement("button", {
      onClick: () => {
        setSelectedTrack(null);
        if (previewAudio) {
          previewAudio.pause();
          setPreviewAudio(null);
        }
      },
      "aria-label": "Remove song",
      className: "mono",
      style: {
        background: "none",
        border: "none",
        color: "rgba(247,237,224,0.4)",
        cursor: "pointer",
        fontSize: 14,
        padding: "4px"
      }
    }, "×")) : React.createElement(React.Fragment, null, React.createElement("input", {
      type: "text",
      value: trackQuery,
      onChange: e => {
        setTrackQuery(e.target.value);
        searchTracks(e.target.value);
      },
      placeholder: "Search for a song…",
      style: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: 10,
        background: "rgba(247,237,224,0.08)",
        border: "1px solid rgba(247,237,224,0.1)",
        color: "#f7ede0",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        outline: "none"
      }
    }), trackResults.length > 0 && React.createElement("div", {
      style: {
        marginTop: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }
    }, trackResults.map((tr, i) => React.createElement("button", {
      key: i,
      onClick: () => {
        setSelectedTrack(tr);
        setTrackResults([]);
        setTrackQuery("");
        togglePreview(tr.preview_url);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 8,
        background: "rgba(247,237,224,0.05)",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "100%"
      }
    }, tr.album?.images?.[0]?.url && React.createElement("img", {
      src: tr.album.images[0].url,
      alt: "",
      style: {
        width: 28,
        height: 28,
        borderRadius: 4
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 12,
        color: "#f7ede0",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, tr.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        color: "rgba(247,237,224,0.4)"
      }
    }, tr.artists?.[0]?.name)), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        color: "#a78bfa"
      }
    }, "▶")))), searching && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        color: "rgba(247,237,224,0.3)",
        marginTop: 4
      }
    }, "Searching…"))), React.createElement("button", {
      disabled: vidState === "rendering",
      onClick: async () => {
        if (previewAudio) {
          previewAudio.pause();
          setPreviewAudio(null);
        }
        setVidState("rendering");
        var all = [];
        try {
          var raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
          for (var n of Object.keys(raw)) for (var m of raw[n] || []) all.push(m);
        } catch {}
        var audioUrl = selectedTrack?.preview_url || null;
        if (!audioUrl) {
          try {
            var mine = (window._collectMomentSongs?.() || [])[0];
            if (mine) {
              var r = await fetchPreviewUrl(`${mine.artist} ${mine.title}`.trim());
              audioUrl = r?.url;
            }
          } catch {}
        }
        if (!audioUrl && recap.topByPop?.name) {
          try {
            var _r2 = await fetchPreviewUrl(recap.topByPop.name);
            audioUrl = _r2?.url;
          } catch {}
        }
        await window._shareRecapVideo?.({
          moments: all,
          audioUrl,
          template: vidTemplate,
          format: vidFormat,
          recap,
          title: "My Weekend",
          subtitle: `${(CFG.shortName || "FESTIVAL").toUpperCase()} · ${CFG.dates || ""}`,
          accent: "#6D28D9"
        });
        setVidState("idle");
      },
      className: "mono",
      style: {
        width: "100%",
        marginTop: 14,
        padding: "13px",
        background: vidState === "rendering" ? "rgba(109,40,217,0.4)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
        color: "#fff",
        border: "none",
        borderRadius: 12,
        cursor: vidState === "rendering" ? "wait" : "pointer",
        fontSize: 10,
        letterSpacing: 1.4,
        fontWeight: 700
      }
    }, vidState === "rendering" ? "⏳ RENDERING…" : "🎬 CREATE RECAP VIDEO"));
  })(), recap.genreBreakdown?.length > 0 && React.createElement(RecapCard, {
    kicker: "YOUR GENRE MIX",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 12
    }
  }, "Your festival was ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, recap.genreBreakdown[0]?.genre || "eclectic"), "."), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, recap.genreBreakdown.map(({
    genre,
    count
  }, i) => {
    var maxCount = recap.genreBreakdown[0]?.count || 1;
    return React.createElement("div", {
      key: genre,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        width: 120,
        textAlign: "right",
        flexShrink: 0,
        fontWeight: 600
      }
    }, genre.toUpperCase()), React.createElement("div", {
      style: {
        flex: 1,
        height: 18,
        borderRadius: 9,
        background: "var(--paper-2)",
        overflow: "hidden"
      }
    }, React.createElement("div", {
      style: {
        width: `${Math.max(8, Math.round(count / maxCount * 100))}%`,
        height: "100%",
        borderRadius: 9,
        background: i === 0 ? "var(--ember)" : i === 1 ? "#6D28D9" : "var(--line-2)",
        transition: "width .3s"
      }
    })), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: "var(--ink)",
        width: 20,
        textAlign: "right"
      }
    }, count));
  }))), recap.vibeScore != null && React.createElement(RecapCard, {
    kicker: "FESTIVAL VIBE",
    paper: "var(--paper)"
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      width: 80,
      height: 80,
      flexShrink: 0
    }
  }, React.createElement("svg", {
    width: "80",
    height: "80",
    viewBox: "0 0 80 80"
  }, React.createElement("circle", {
    cx: "40",
    cy: "40",
    r: "34",
    fill: "none",
    stroke: "var(--line)",
    strokeWidth: "6"
  }), React.createElement("circle", {
    cx: "40",
    cy: "40",
    r: "34",
    fill: "none",
    stroke: recap.vibeScore >= 70 ? "#e85d2e" : recap.vibeScore >= 40 ? "#6D28D9" : "#2d7a55",
    strokeWidth: "6",
    strokeDasharray: `${recap.vibeScore * 2.136} 213.6`,
    strokeLinecap: "round",
    transform: "rotate(-90 40 40)"
  })), React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 18,
      fontWeight: 700
    }
  }, recap.vibeScore))), React.createElement("div", null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1.1
    }
  }, recap.vibeScore >= 80 ? "Peak energy." : recap.vibeScore >= 60 ? "High octane." : recap.vibeScore >= 40 ? "Balanced vibe." : "Laid back."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      color: "var(--muted)",
      marginTop: 4,
      letterSpacing: 1
    }
  }, recap.vibeScore >= 70 ? "YOU CHASED THE DROPS ALL WEEKEND" : recap.vibeScore >= 40 ? "MIX OF ENERGY + CHILL" : "YOU FOUND THE QUIET CORNERS")))), (() => {
    var discoveries = [];
    try {
      var raw = localStorage.getItem("spotify_matched_v1");
      var spotifyArtists = JSON.parse(localStorage.getItem("spotify_top_artists_v1") || "null");
      var matched = raw ? JSON.parse(raw) : [];
      if (spotifyArtists?.length) discoveries = getDiscoveries(spotifyArtists, matched, state.saved, 5);
    } catch {}
    if (!discoveries.length) return null;
    var freeLimit = 2;
    var showAll = _isPlusSub();
    var visible = showAll ? discoveries : discoveries.slice(0, freeLimit);
    return React.createElement(RecapCard, {
      kicker: "HIDDEN GEMS — AI PICKS FOR YOU",
      paper: "var(--night)",
      accent: "#fff"
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 22,
        lineHeight: 1.1,
        color: "#f7ede0",
        marginBottom: 12
      }
    }, "Artists you'd ", React.createElement("em", {
      style: {
        color: "#a78bfa"
      }
    }, "love")), React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, visible.map((a, i) => {
      var stage = STAGES.find(s => s.id === a.stage);
      var isSaved = (state.saved || []).includes(a.id);
      return React.createElement("div", {
        key: a.id,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)"
        }
      }, React.createElement("div", {
        style: {
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          background: stage?.color || "#6D28D9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#fff",
          fontWeight: 700
        }
      }, i + 1), React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 600,
          color: "#f7ede0",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, a.name), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1,
          color: "rgba(255,255,255,0.4)",
          marginTop: 2
        }
      }, a._reason || stage?.name || "", " · ", FESTIVAL_CONFIG.dayDates?.[a.day]?.short || "", " ", window.fmt12?.(a.start) || a.start)), React.createElement("button", {
        onClick: () => {
          if (isSaved) return;
          setState(s => ({
            ...s,
            saved: [...new Set([...s.saved, a.id])]
          }));
          try {
            window.plurskyHaptic?.("LIGHT");
          } catch {}
        },
        className: "mono",
        style: {
          padding: "5px 10px",
          borderRadius: 999,
          flexShrink: 0,
          background: isSaved ? "rgba(45,122,85,0.3)" : "rgba(167,139,250,0.2)",
          border: isSaved ? "1px solid rgba(45,122,85,0.5)" : "1px solid rgba(167,139,250,0.4)",
          color: isSaved ? "#2d7a55" : "#a78bfa",
          fontSize: 8,
          letterSpacing: 1.2,
          fontWeight: 700,
          cursor: "pointer"
        }
      }, isSaved ? "✓ SAVED" : "+ SAVE"));
    }), !showAll && discoveries.length > freeLimit && React.createElement(PlusGate, {
      feature: "all hidden gems"
    }, React.createElement("div", {
      style: {
        padding: 20,
        textAlign: "center"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: 1.2
      }
    }, "+", discoveries.length - freeLimit, " MORE PICKS WAITING")))));
  })(), crewStats?.total > 0 && React.createElement(RecapCard, {
    kicker: "CREW COMPATIBILITY",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.1,
      marginBottom: 12
    }
  }, "Your crew ", React.createElement("em", {
    style: {
      color: "var(--ember-ink)"
    }
  }, "vibe check")), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5
    }
  }, crewStats.total, " messages sent in crew chat", crewStats.topChatter ? ` · ${crewStats.topChatter[0]} was the most active` : "", ".")), recap.setsCount > 0 && React.createElement(RecapCard, {
    kicker: "FESTIVAL TRADING CARDS",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.1,
      marginBottom: 6
    }
  }, "Collect your ", React.createElement("em", {
    style: {
      color: "var(--horizon)"
    }
  }, "set cards")), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, recap.setsCount, " cards earned — one for every set you caught. Export as shareable collectibles."), React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      marginBottom: 10,
      padding: "2px 0"
    }
  }, (() => {
    var attended = window.getAllAttended?.() || {};
    var artists = Object.values(attended).flat().map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).slice(0, 6);
    return artists.map((a, i) => {
      var stage = STAGES.find(s => s.id === a.stage);
      return React.createElement("div", {
        key: a.id,
        style: {
          width: 90,
          height: 130,
          flexShrink: 0,
          borderRadius: 10,
          background: `linear-gradient(155deg, ${stage?.color || "#6D28D9"}22 0%, ${stage?.color || "#6D28D9"}44 100%)`,
          border: `1.5px solid ${stage?.color || "#6D28D9"}55`,
          padding: "10px 8px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }
      }, React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1.2,
          color: stage?.color || "var(--muted)",
          fontWeight: 700
        }
      }, stage?.short || ""), React.createElement("div", null, React.createElement("div", {
        style: {
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1.2,
          color: "var(--ink)"
        }
      }, a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          color: "var(--muted)",
          marginTop: 3,
          letterSpacing: 0.8
        }
      }, FESTIVAL_CONFIG.dayDates?.[a.day]?.short || "", " · ", window.fmt12?.(a.start) || a.start)), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1,
          color: stage?.color,
          fontWeight: 700,
          textAlign: "right"
        }
      }, "#", String(i + 1).padStart(3, "0")));
    });
  })()), React.createElement(PlusGate, {
    feature: "trading cards export"
  }, React.createElement("button", {
    onClick: async () => {
      try {
        await window._shareFestivalPassport?.(state);
      } catch {}
    },
    className: "mono",
    style: {
      width: "100%",
      padding: "12px",
      borderRadius: 10,
      border: "none",
      cursor: "pointer",
      background: "var(--ink)",
      color: "var(--paper)",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700
    }
  }, "EXPORT FULL COLLECTION"))), recap.momentsCount > 0 && recap.setsCount > 0 && React.createElement(RecapCard, {
    kicker: "SETLIST MEMORIES",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.1,
      marginBottom: 6
    }
  }, "What was ", React.createElement("em", {
    style: {
      color: "var(--ember-ink)"
    }
  }, "playing"), "?"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--muted)",
      lineHeight: 1.5
    }
  }, "Your photos are matched to the actual setlist — showing which song was playing when you took each shot. Open any moment in Memories to see the track."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--success)",
      fontWeight: 700,
      marginTop: 10
    }
  }, "✓ LIVE · POWERED BY SETLIST.FM")), recap.momentsCount > 0 && React.createElement(RecapCard, {
    kicker: "PLURSKY+ EXCLUSIVES",
    paper: "#1a120d",
    accent: "#fff"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1.1,
      color: "#f7ede0",
      letterSpacing: -0.3
    }
  }, "Your weekend, ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "#a78bfa"
    }
  }, "elevated"), "."), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginTop: 14
    }
  }, React.createElement("button", {
    onClick: async () => {
      var all = [];
      try {
        var raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
        for (var n of Object.keys(raw)) for (var m of raw[n] || []) all.push(m);
      } catch {}
      await window._shareFestivalDNA?.(all);
    },
    className: "mono",
    style: {
      padding: "12px",
      background: "linear-gradient(90deg, #e85d2e, #6D28D9, #2d7a55, #f59a36)",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700
    }
  }, "🧬 FESTIVAL DNA — YOUR UNIQUE COLOR BARCODE"), React.createElement("button", {
    onClick: () => window._shareFestivalPassport?.(state),
    className: "mono",
    style: {
      padding: "12px",
      background: "rgba(247,237,224,0.08)",
      color: "#f7ede0",
      border: "1px solid rgba(247,237,224,0.15)",
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700
    }
  }, "🛂 FESTIVAL PASSPORT — STAGE STAMPS"), React.createElement("button", {
    onClick: async () => {
      var all = [];
      try {
        var raw = JSON.parse(localStorage.getItem("plursky_moments_v1") || "{}");
        for (var n of Object.keys(raw)) for (var m of raw[n] || []) all.push(m);
      } catch {}
      await window._shareFilmStrip?.(all);
    },
    className: "mono",
    style: {
      padding: "12px",
      background: "rgba(247,237,224,0.08)",
      color: "#f7ede0",
      border: "1px solid rgba(247,237,224,0.15)",
      borderRadius: 10,
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.4,
      fontWeight: 700
    }
  }, "🎞️ FILM STRIP — RETRO PHOTO REEL")), !_isPlusSub() && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      color: "rgba(247,237,224,0.3)",
      marginTop: 10,
      textAlign: "center",
      letterSpacing: 1.2
    }
  }, "FREE PREVIEW WITH WATERMARK · UPGRADE TO REMOVE")), _isPlusSub() && React.createElement(RecapCard, {
    kicker: "YOUR STYLE",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.1,
      letterSpacing: -0.3
    }
  }, "Pick your ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: _getCustomAccent() || "var(--ember-ink)"
    }
  }, "accent color"), "."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      color: "var(--muted)",
      marginTop: 4,
      letterSpacing: 1
    }
  }, "Applies to all collages, GIFs, and video exports."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 12,
      flexWrap: "wrap"
    }
  }, ["#e85d2e", "#6D28D9", "#ec4899", "#2563eb", "#22c55e", "#f97316", "#1a120d", "#14b8a6", "#fbbf24"].map(c => React.createElement("button", {
    key: c,
    onClick: () => {
      _setCustomAccent(c);
      setState(s => ({
        ...s
      }));
    },
    style: {
      width: 32,
      height: 32,
      borderRadius: 32,
      background: c,
      border: _getCustomAccent() === c ? "3px solid var(--ink)" : "2px solid var(--line)",
      cursor: "pointer",
      boxShadow: _getCustomAccent() === c ? "0 0 0 2px var(--paper), 0 0 0 4px var(--ink)" : "none"
    }
  })), React.createElement("button", {
    onClick: () => {
      _setCustomAccent("");
      setState(s => ({
        ...s
      }));
    },
    className: "mono",
    style: {
      height: 32,
      padding: "0 10px",
      borderRadius: 32,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      fontSize: 8,
      letterSpacing: 1,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "RESET"))), React.createElement(FestivalYearCard, {
    yearData: yearData
  }), _isPlusSub() && (() => {
    var archive = _getRecapArchive();
    var archiveEntries = Object.entries(archive).filter(([id]) => id !== FESTIVAL_CONFIG.id);
    if (!archiveEntries.length) return null;
    return React.createElement(RecapCard, {
      kicker: "PAST FESTIVALS",
      paper: "var(--paper)"
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 22,
        lineHeight: 1.1,
        letterSpacing: -0.3,
        marginBottom: 10
      }
    }, "Your festival ", React.createElement("span", {
      style: {
        fontStyle: "italic",
        color: "var(--horizon)"
      }
    }, "archive"), "."), archiveEntries.map(([id, r]) => React.createElement("div", {
      key: id,
      style: {
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        marginBottom: 6
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 16
      }
    }, id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        color: "var(--muted)",
        marginTop: 2
      }
    }, r.setsCount || 0, " sets · ", r.momentsCount || 0, " memories · ", r.stagesVisitedCount || 0, " stages"))));
  })(), state.spotifyConnected && recap.setsCount > 0 && React.createElement(RecapCard, {
    kicker: "YOUR SOUNDTRACK",
    paper: "var(--paper)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 14
    }
  }, "Take the weekend ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--horizon)"
    }
  }, "home"), " with you."), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Build a Spotify playlist of every set you actually caught — top tracks from each, in chronological set order."), playlistState.status === "done" ? React.createElement("div", {
    style: {
      padding: "10px 12px",
      borderRadius: 10,
      background: "rgba(45,122,85,0.12)",
      border: "1px solid rgba(45,122,85,0.4)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--success)",
      fontWeight: 700,
      marginBottom: 6
    }
  }, "✓ ", playlistState.added, " TRACKS ADDED"), playlistState.url && React.createElement("a", {
    href: playlistState.url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.1,
      color: "var(--ink)",
      fontWeight: 700,
      textDecoration: "underline"
    }
  }, "OPEN IN SPOTIFY ↗")) : React.createElement("button", {
    onClick: buildAttendedPlaylist,
    disabled: playlistState.status === "building",
    style: {
      background: playlistState.status === "building" ? "var(--paper-2)" : "#1DB954",
      color: playlistState.status === "building" ? "var(--muted)" : "#fff",
      border: "none",
      borderRadius: 999,
      padding: "11px 18px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700,
      cursor: playlistState.status === "building" ? "default" : "pointer",
      alignSelf: "flex-start"
    }
  }, playlistState.status === "building" ? "BUILDING…" : "↗ BUILD WEEKEND PLAYLIST"), playlistState.status === "error" && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "#c14a4a",
      marginTop: 8,
      fontWeight: 600
    }
  }, playlistState.msg)), recap.missedSaved.length > 0 && React.createElement(RecapCard, {
    kicker: `MISSED · ${recap.missedSaved.length}`
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 10
    }
  }, "You saved ", recap.missedSaved.length, " sets you didn't make it to."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginBottom: 10,
      fontWeight: 600
    }
  }, "CATCH THEM NEXT YEAR"), React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, recap.missedSaved.map(a => {
    var stage = (window.STAGES || []).find(s => s.id === a.stage);
    return React.createElement("button", {
      key: a.id,
      onClick: () => setState(s => ({
        ...s,
        artist: a.id
      })),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 8,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement("div", {
      style: {
        width: 3,
        alignSelf: "stretch",
        background: stage?.color || "var(--line-2)",
        borderRadius: 2,
        flexShrink: 0
      }
    }), React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--ink)",
        fontWeight: 500,
        flex: 1
      }
    }, a.name), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        fontWeight: 600
      }
    }, stage?.short || ""));
  }))), crewStats && crewStats.total > 0 && React.createElement(RecapCard, {
    kicker: `CREW · ${crewStats.code}`
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 1.05,
      letterSpacing: -0.3,
      marginBottom: 10
    }
  }, "Your crew sent ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, crewStats.total), " messages this weekend."), crewStats.topSender && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--muted)",
      lineHeight: 1.5
    }
  }, "Loudest in the group chat:", " ", React.createElement("strong", {
    style: {
      color: "var(--ink)"
    }
  }, crewStats.topSender.name), " ", "(", crewStats.topSender.count, " messages)."), crewStats.uniqueSenders > 1 && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 10,
      fontWeight: 600
    }
  }, crewStats.uniqueSenders, " VOICES · 1 PLUR")), React.createElement(RecapCard, {
    kicker: "UNTIL NEXT YEAR",
    paper: "linear-gradient(155deg, var(--paper) 0%, rgba(245,154,54,0.18) 100%)"
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 32,
      lineHeight: 1,
      letterSpacing: -0.4
    }
  }, "See you under the ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "electric sky"), "."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 10,
      fontWeight: 600
    }
  }, "PLURSKY · ", CFG.year || ""))), wrappedOpen && React.createElement(WrappedStory, {
    recap: recap,
    onClose: () => setWrappedOpen(false)
  }));
}
function NowPlayingBar() {
  var [liveState, setLiveState] = React.useState({
    stage: null,
    artist: null,
    song: null,
    listening: false,
    usersHere: 0
  });
  var [captured, setCaptured] = React.useState(false);
  var CFG = window.FESTIVAL_CONFIG || {};
  var debugLive = React.useMemo(() => {
    try {
      return localStorage.getItem("plursky-debug-live") === "true";
    } catch {
      return false;
    }
  }, []);
  var isFestivalLive = React.useMemo(() => {
    if (debugLive) return true;
    if (!CFG.dayDates) return false;
    var now = Date.now();
    for (var dd of Object.values(CFG.dayDates)) {
      var openMs = dd.midnightUtc + 19 * 3600000;
      var closeMs = dd.midnightUtc + (5.5 + 24) * 3600000;
      if (now >= openMs && now <= closeMs) return true;
    }
    return false;
  }, [debugLive]);
  React.useEffect(() => {
    if (!isFestivalLive) return;
    if (debugLive) {
      var stages = window.STAGES || [];
      var artists = window.ARTISTS || [];
      var debugStage = stages[0];
      var debugArtist = artists.find(a => a.stage === debugStage?.id && a.day === 1) || artists[0];
      if (debugStage) {
        setLiveState(s => ({
          ...s,
          stage: debugStage,
          artist: debugArtist || null
        }));
        if (window.joinStagePresence) window.joinStagePresence(debugStage.id);
      }
      return () => {
        if (window.leaveStagePresence) window.leaveStagePresence();
      };
    }
    var watchId;
    var anchors = typeof resolvedStageAnchors === "function" ? resolvedStageAnchors(CFG) : CFG.gpsAnchors || [];
    if (!anchors.length || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(pos => {
      var {
        latitude: lat,
        longitude: lng
      } = pos.coords;
      var dists = anchors.map(a => ({
        stageId: a.stageId,
        dist: _haversineMeters(lat, lng, a.lat, a.lng)
      }));
      var nearest = dists.sort((a, b) => a.dist - b.dist)[0];
      if (!nearest || nearest.dist > 200) {
        setLiveState(s => ({
          ...s,
          stage: null,
          artist: null
        }));
        return;
      }
      var stageObj = (window.STAGES || []).find(s => s.id === nearest.stageId);
      var now = new Date();
      var hh = now.getHours();
      var mm = now.getMinutes();
      var adjustedMin = (hh < 6 ? hh + 24 : hh) * 60 + mm;
      var currentNight = null;
      if (CFG.dayDates) {
        var nowMs = Date.now();
        for (var [day, dd] of Object.entries(CFG.dayDates)) {
          var openMs = dd.midnightUtc + 19 * 3600000;
          var closeMs = dd.midnightUtc + (5.5 + 24) * 3600000;
          if (nowMs >= openMs && nowMs <= closeMs) {
            currentNight = parseInt(day);
            break;
          }
        }
      }
      var currentArtist = null;
      if (currentNight) {
        for (var a of window.ARTISTS || []) {
          if (a.day !== currentNight || a.stage !== nearest.stageId) continue;
          var [sh, sm] = a.start.split(":").map(Number);
          var [eh, em] = a.end.split(":").map(Number);
          var startMin = (sh < 6 ? sh + 24 : sh) * 60 + sm;
          var endMin = (eh < 6 ? eh + 24 : eh) * 60 + em;
          if (adjustedMin >= startMin && adjustedMin < endMin) {
            currentArtist = a;
            break;
          }
        }
      }
      setLiveState(s => ({
        ...s,
        stage: stageObj,
        artist: currentArtist
      }));
      if (stageObj?.id && window.joinStagePresence) window.joinStagePresence(stageObj.id);
    }, null, {
      enableHighAccuracy: true,
      maximumAge: 10000
    });
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (window.leaveStagePresence) window.leaveStagePresence();
    };
  }, [isFestivalLive, debugLive]);
  React.useEffect(() => {
    var onPresence = e => {
      if (e.detail?.stageId === liveState.stage?.id) {
        setLiveState(s => ({
          ...s,
          usersHere: e.detail.count
        }));
      }
    };
    window.addEventListener("plursky-presence", onPresence);
    return () => window.removeEventListener("plursky-presence", onPresence);
  }, [liveState.stage?.id]);
  var [tracklistReady, setTracklistReady] = React.useState(0);
  React.useEffect(() => {
    if (!liveState.artist?.name) return;
    _getTracklistForArtist(liveState.artist.name).then(() => setTracklistReady(n => n + 1));
  }, [liveState.artist?.name]);
  var estimatedSong = React.useMemo(() => {
    if (!liveState.artist) return null;
    var key = liveState.artist.name.toLowerCase().replace(/\W+/g, "_");
    var cached = _setlistCache[key];
    if (!cached) return null;
    if (debugLive && cached.source === "1001tracklists" && cached.tracks?.length) {
      var t = cached.tracks[Math.floor(cached.tracks.length / 3)];
      var display = t.artist ? `${t.artist} — ${t.title}` : t.title;
      return {
        song: display,
        source: "1001tracklists",
        confidence: "exact (debug)",
        url: cached.url
      };
    }
    if (debugLive && cached.source === "setlist.fm" && cached.songs?.length) {
      return {
        song: cached.songs[Math.floor(cached.songs.length / 3)],
        source: "setlist.fm",
        confidence: "estimated (debug)"
      };
    }
    var now = new Date().toISOString().replace("T", " ").slice(0, 19);
    return _matchSongAtTime(liveState.artist, cached, now);
  }, [liveState.artist, debugLive, tracklistReady]);
  var [listenProgress, setListenProgress] = React.useState(0);
  var handleShazam = async () => {
    setLiveState(s => ({
      ...s,
      listening: true
    }));
    setListenProgress(0);
    try {
      if (window.Capacitor?.isNativePlatform?.() && window.ShazamPlugin) {
        var timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 14000));
        var progressId = setInterval(() => setListenProgress(p => Math.min(p + 7, 95)), 1000);
        try {
          var result = await Promise.race([window.ShazamPlugin.identify(), timeout]);
          clearInterval(progressId);
          if (result?.title) {
            setLiveState(s => ({
              ...s,
              song: {
                song: `${result.artist} — ${result.title}`,
                source: "shazam",
                confidence: "exact"
              },
              listening: false
            }));
            setListenProgress(100);
            return;
          }
          clearInterval(progressId);
          setListenProgress(0);
          if (estimatedSong) {
            setLiveState(s => ({
              ...s,
              song: estimatedSong,
              listening: false
            }));
            window.plurskyToast?.("No exact match (live/unreleased?) — showing the set estimate");
          } else {
            setLiveState(s => ({
              ...s,
              listening: false
            }));
            window.plurskyToast?.("No match — live & unreleased sets often aren't in Shazam's catalog");
          }
          return;
        } catch {
          clearInterval(progressId);
          setListenProgress(0);
          setLiveState(s => ({
            ...s,
            listening: false
          }));
          window.plurskyToast?.("Shazam timed out — move closer to a speaker and try again");
          return;
        }
      }
      if (estimatedSong) {
        setLiveState(s => ({
          ...s,
          song: estimatedSong,
          listening: false
        }));
        setListenProgress(0);
        window.plurskyToast?.("Exact Shazam needs the iPhone build — showing the set estimate");
        return;
      }
      setLiveState(s => ({
        ...s,
        listening: false
      }));
      setListenProgress(0);
      window.plurskyToast?.("Exact Shazam works in the iPhone build, not on web");
      return;
    } catch {
      setLiveState(s => ({
        ...s,
        listening: false
      }));
    }
    setListenProgress(0);
  };
  var handleCapture = () => {
    var song = liveState.song || estimatedSong;
    var momentId = `cap_${Date.now()}`;
    var night = liveState.artist?.day || 1;
    var all = _readMoments();
    all[night] = [...(all[night] || []), {
      id: momentId,
      night,
      artistId: liveState.artist?.id || null,
      takenAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      tagSource: "live_capture",
      createdAt: Date.now(),
      songCapture: song ? {
        song: song.song,
        source: song.source || "live"
      } : null,
      hasGps: false
    }];
    _writeMoments(all);
    setCaptured(true);
    window.plurskyHaptic?.("MEDIUM");
    setTimeout(() => setCaptured(false), 2000);
  };
  if (!isFestivalLive || !liveState.stage) return null;
  var displaySong = liveState.song || estimatedSong;
  var stageColor = liveState.stage?.color || "var(--horizon)";
  return React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 64,
      left: 8,
      right: 8,
      zIndex: 900,
      borderRadius: 16,
      overflow: "hidden",
      background: "rgba(10,6,24,0.92)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 20px ${stageColor}33`,
      padding: "10px 14px",
      animation: "song-fade-in 0.4s ease-out"
    }
  }, liveState.artist && (() => {
    var nowMin = typeof toNightMin === "function" && NOW?.time ? toNightMin(NOW.time) : 0;
    var startMin = typeof toNightMin === "function" ? toNightMin(liveState.artist.start) : 0;
    var endMin = typeof toNightMin === "function" ? toNightMin(liveState.artist.end) : 1;
    var total = Math.max(1, endMin - startMin);
    var elapsed = Math.max(0, nowMin - startMin);
    var pct = Math.min(1, elapsed / total);
    var minsLeft = Math.max(0, Math.round(total - elapsed));
    return React.createElement("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        overflow: "hidden",
        borderRadius: "16px 16px 0 0"
      }
    }, React.createElement("div", {
      style: {
        width: `${pct * 100}%`,
        height: "100%",
        background: `linear-gradient(90deg, ${stageColor}, ${stageColor}cc)`,
        borderRadius: "0 3px 3px 0",
        transition: "width 30s linear",
        boxShadow: `0 0 8px ${stageColor}`
      }
    }), minsLeft > 0 && minsLeft <= 10 && React.createElement("div", {
      className: "mono",
      style: {
        position: "absolute",
        right: 6,
        top: 5,
        fontSize: 8,
        letterSpacing: 1,
        color: stageColor,
        fontWeight: 800,
        textShadow: "0 1px 4px rgba(0,0,0,0.8)"
      }
    }, minsLeft, "M LEFT"));
  })(), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 3
    }
  }, React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 6,
      background: "#ef4444",
      animation: "pulse 2s infinite"
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.4,
      fontWeight: 700,
      color: stageColor
    }
  }, "LIVE · ", liveState.stage?.name?.toUpperCase(), liveState.usersHere > 1 ? ` · ${liveState.usersHere} HERE` : "")), liveState.artist && React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 14,
      color: "#fff",
      lineHeight: 1.2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, liveState.artist.name), displaySong && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.6,
      color: "rgba(255,255,255,0.5)",
      marginTop: 2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, React.createElement("span", {
    style: {
      color: stageColor,
      fontSize: 9
    }
  }, "♫"), displaySong.song)), React.createElement("button", {
    onClick: handleShazam,
    disabled: liveState.listening,
    style: {
      width: 36,
      height: 36,
      borderRadius: 36,
      border: "none",
      cursor: "pointer",
      background: liveState.listening ? `${stageColor}44` : `${stageColor}22`,
      color: stageColor,
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      animation: liveState.listening ? "pulse 1s infinite" : "none",
      transition: "background 0.2s"
    },
    title: "What's playing?"
  }, liveState.listening ? "..." : "🎵"), React.createElement("button", {
    onClick: handleCapture,
    style: {
      height: 36,
      borderRadius: 36,
      border: "none",
      cursor: "pointer",
      padding: "0 14px",
      background: captured ? "var(--success)" : "linear-gradient(135deg, #6D28D9, #e85d2e)",
      color: "#fff",
      fontWeight: 700,
      fontSize: 9,
      letterSpacing: 1.2,
      display: "flex",
      alignItems: "center",
      gap: 5,
      transition: "all 0.3s",
      fontFamily: "Geist Mono, monospace"
    }
  }, captured ? "✓ SAVED" : "CAPTURE")));
}
Object.assign(window, {
  NowPlayingBar,
  SpotifyScreen,
  MeScreen,
  MemoriesScreen,
  RecapScreen,
  archiveFestival,
  HomeMemoriesStrip,
  PackListCard,
  _isPlusSub,
  _setPlusSub,
  PlusGate,
  _purchasePlus,
  _restorePurchases,
  RC_PRODUCT_IDS,
  _canShare,
  _getCustomAccent,
  _setCustomAccent,
  _archiveRecap,
  _getRecapArchive,
  _canAccessFestival,
  _getTracklistForArtist
});
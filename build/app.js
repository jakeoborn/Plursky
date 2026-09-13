function spotifyTokenValid() {
  var token = localStorage.getItem("spotify_token");
  var expires = localStorage.getItem("spotify_expires");
  if (token && expires && Date.now() < parseInt(expires)) return true;
  return !!localStorage.getItem("spotify_refresh_token");
}
var ONBOARD_VERSION = "v1";
function VfxParticleField({
  count = 14,
  scale = 1
}) {
  var colors = (typeof STAGES !== "undefined" ? STAGES : []).slice(0, 5).map(s => s.color);
  if (!colors.length) return null;
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none"
    }
  }, Array.from({
    length: count
  }, (_, i) => {
    var c = colors[i % colors.length];
    var size = (i % 3 === 2 ? 10 + i % 3 * 6 : 3 + i % 3 * 2) * scale;
    return React.createElement("div", {
      key: i,
      style: {
        position: "absolute",
        left: `${(i * 37 + 13) % 100}%`,
        bottom: i % 3 === 0 ? 0 : undefined,
        top: i % 3 !== 0 ? `${(i * 53 + 7) % 100}%` : undefined,
        width: size,
        height: size,
        borderRadius: "50%",
        background: c,
        filter: i % 3 === 2 ? "blur(6px)" : "none",
        opacity: 0,
        animation: `${i % 3 === 0 ? "vfx-rise" : i % 3 === 2 ? "vfx-drift" : "vfx-fall"} ${3 + i % 4}s ease-in-out ${i * 0.4 % 4}s infinite`
      }
    });
  }));
}
function _onbHeadliners(n) {
  var lineup = (typeof activeLineup === "function" ? activeLineup() : ARTISTS) || [];
  return [...lineup].sort((a, b) => (b.tier || 0) - (a.tier || 0) || a.day - b.day || toNightMin(a.start) - toNightMin(b.start)).slice(0, n);
}
function OnbSchedulePreview() {
  var rows = _onbHeadliners(4).sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start)).slice(0, 3);
  return React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      borderRadius: 16,
      padding: "4px 16px"
    }
  }, rows.map((a, i) => {
    var st = STAGES.find(s => s.id === a.stage);
    return React.createElement("div", {
      key: a.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none"
      }
    }, React.createElement("div", {
      style: {
        width: 76,
        flexShrink: 0,
        fontSize: 15,
        lineHeight: "21px",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap"
      }
    }, fmt12(a.start)), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 17,
        lineHeight: "22px",
        fontWeight: 600,
        overflowWrap: "anywhere"
      }
    }, a.name), React.createElement("div", {
      style: {
        fontSize: 13,
        lineHeight: "18px",
        color: "var(--text-2)"
      }
    }, FESTIVAL_CONFIG.dayDates?.[a.day]?.name || "", st ? ` · ${st.name}` : "")), React.createElement("svg", {
      "aria-hidden": "true",
      width: "22",
      height: "22",
      viewBox: "0 0 24 24",
      fill: i === 0 ? "var(--signal)" : "none",
      stroke: i === 0 ? "var(--signal)" : "var(--text-2)",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
    })));
  }));
}
function OnbCardPreview({
  artists,
  count = 1
}) {
  var [urls, setUrls] = React.useState([]);
  React.useEffect(() => {
    var live = true;
    var made = [];
    (async () => {
      var _loop = async function () {
          var c = null;
          try {
            c = typeof _renderHeroCard === "function" ? await _renderHeroCard(a) : null;
          } catch {}
          if (!live || !c) return 0;
          var blob = await new Promise(r => c.toBlob(r, "image/png"));
          if (!live || !blob) return 0;
          var u = URL.createObjectURL(blob);
          made.push(u);
          setUrls(prev => [...prev, u]);
        },
        _ret;
      for (var a of artists.slice(0, count)) {
        _ret = await _loop();
        if (_ret === 0) continue;
      }
    })();
    return () => {
      live = false;
      made.forEach(u => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, []);
  return React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      gap: 8
    }
  }, artists.slice(0, count).map((a, i) => React.createElement("div", {
    key: a.id,
    style: {
      width: count === 1 ? "72%" : "31%",
      aspectRatio: "4 / 5",
      borderRadius: 14,
      overflow: "hidden",
      background: "var(--paper-2)"
    }
  }, urls[i] && React.createElement("img", {
    src: urls[i],
    alt: `${a.name} set card`,
    style: {
      width: "100%",
      height: "100%",
      display: "block"
    }
  }))));
}
function OnboardingModal({
  onDone,
  setState,
  state
}) {
  var [page, setPage] = React.useState(0);
  var [q, setQ] = React.useState("");
  var heads = React.useMemo(() => _onbHeadliners(3), []);
  var finish = festId => {
    try {
      localStorage.setItem("onboarded", ONBOARD_VERSION);
    } catch {}
    if (festId && festId !== FESTIVAL_CONFIG.id) {
      setActiveFestivalAndReload(festId);
      return;
    }
    onDone();
  };
  var PAGES = [{
    title: "Plan the night.",
    body: "Save the sets you want and see what’s on now, next and at every stage.",
    preview: React.createElement(OnbSchedulePreview, null)
  }, {
    title: "Know what you caught.",
    body: "Your photos and clips land on the artist, stage and time they happened.",
    preview: React.createElement(OnbCardPreview, {
      artists: heads,
      count: 1
    })
  }, {
    title: "Keep the weekend.",
    body: "Every set you catch becomes a card for your recap.",
    preview: React.createElement(OnbCardPreview, {
      artists: heads,
      count: 3
    })
  }];
  var story = page < 3;
  var cur = PAGES[Math.min(page, 2)];
  var term = q.trim().toLowerCase();
  var now = Date.now();
  var list = FESTIVALS_REGISTRY.filter(f => (f.config.endMs || 0) >= now).sort((a, b) => (a.config.startMs || 0) - (b.config.startMs || 0)).filter(f => !term || `${f.config.name} ${f.config.location}`.toLowerCase().includes(term));
  var inputStyle = {
    width: "100%",
    height: 44,
    borderRadius: 14,
    border: "none",
    background: "var(--paper-2)",
    color: "var(--ink)",
    padding: "0 16px",
    fontSize: 16,
    outline: "none",
    fontFamily: "inherit"
  };
  return React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Welcome to Plursky",
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 100,
      background: "var(--paper)",
      color: "var(--ink)",
      display: "flex",
      flexDirection: "column",
      paddingTop: "var(--top-pad, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      animation: "fadeIn .25s"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 52,
      padding: "0 8px 0 20px"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      fontVariantNumeric: "tabular-nums"
    }
  }, story ? `${page + 1} of 3` : "Almost there"), story && React.createElement("button", {
    onClick: () => setPage(3),
    style: {
      ...fieldIconBtn,
      width: "auto",
      padding: "0 12px",
      color: "var(--text-2)",
      fontSize: 15,
      fontWeight: 500
    }
  }, "Skip")), story ? React.createElement(React.Fragment, null, React.createElement("div", {
    key: page,
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      padding: "8px 20px 0",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      animation: "fadeIn .2s"
    }
  }, cur.preview), React.createElement("div", {
    style: {
      padding: "24px 20px 16px"
    }
  }, React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 34,
      lineHeight: "41px",
      fontWeight: 700,
      letterSpacing: "-0.01em"
    }
  }, cur.title), React.createElement("p", {
    style: {
      margin: "8px 0 24px",
      fontSize: 15,
      lineHeight: "21px",
      color: "var(--text-2)"
    }
  }, cur.body), React.createElement(FieldButton, {
    onClick: () => setPage(p => Math.min(p + 1, 3))
  }, page < 2 ? "Continue" : "Choose your festival"))) : React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      padding: "0 20px 8px"
    }
  }, React.createElement("h1", {
    style: {
      margin: "0 0 12px",
      fontSize: 28,
      lineHeight: "34px",
      fontWeight: 700
    }
  }, "Where are you raving?"), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search festivals",
    "aria-label": "Search festivals",
    style: inputStyle
  })), React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      padding: "0 20px"
    }
  }, list.map(f => {
    var isActive = f.config.id === FESTIVAL_CONFIG.id;
    var locked = !f.available;
    return React.createElement("button", {
      key: f.config.id,
      disabled: locked,
      onClick: () => finish(f.config.id),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 72,
        padding: "8px 0",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink)",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: locked ? "default" : "pointer",
        opacity: locked ? 0.55 : 1
      }
    }, React.createElement(FestivalThumb, {
      entry: f
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        fontSize: 17,
        lineHeight: "22px",
        fontWeight: 600
      }
    }, f.config.name), React.createElement("div", {
      style: {
        fontSize: 13,
        lineHeight: "18px",
        color: "var(--text-2)"
      }
    }, f.config.location, " · ", f.config.dates), (isActive || locked) && React.createElement("div", {
      style: {
        marginTop: 2,
        fontSize: 13,
        lineHeight: "18px",
        fontWeight: 600,
        color: isActive ? "var(--signal)" : "var(--text-2)"
      }
    }, isActive ? "✓ Selected" : f.previewOnly ? "Early access" : "Soon")));
  }), !list.length && React.createElement("p", {
    style: {
      padding: "24px 0",
      fontSize: 15,
      lineHeight: "21px",
      color: "var(--text-2)"
    }
  }, "No festival by that name yet.")), React.createElement("div", {
    style: {
      padding: "12px 20px 16px"
    }
  }, React.createElement(FieldButton, {
    onClick: () => finish(null)
  }, "Continue with ", FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name))));
}
function PersonalizeSheet({
  state,
  onClose
}) {
  var [name, setName] = React.useState(() => {
    try {
      return localStorage.getItem("user_name") || "";
    } catch {
      return "";
    }
  });
  var {
    supported: notifSupported,
    perm: notifPerm,
    enable: enableNotifs
  } = useNotifications();
  var save = () => {
    try {
      if (name.trim()) {
        localStorage.setItem("user_name", name.trim());
        localStorage.setItem("plursky_display_name", name.trim());
      }
    } catch {}
    onClose();
  };
  var title = {
    fontSize: 17,
    lineHeight: "22px",
    fontWeight: 600
  };
  var why = {
    margin: "2px 0 12px",
    fontSize: 15,
    lineHeight: "21px",
    color: "var(--text-2)"
  };
  var rule = React.createElement("div", {
    style: {
      height: 1,
      background: "var(--line)",
      margin: "20px 0"
    }
  });
  var done = text => React.createElement("div", {
    style: {
      fontSize: 15,
      lineHeight: "20px",
      fontWeight: 600,
      color: "var(--signal)"
    }
  }, "✓ ", text);
  return React.createElement(FieldSheet, {
    title: "Personalize Plursky",
    onClose: save
  }, React.createElement("label", {
    htmlFor: "plursky-name",
    style: {
      display: "block",
      ...title
    }
  }, "Your name"), React.createElement("p", {
    style: why
  }, "Shown on your Me tab."), React.createElement("input", {
    id: "plursky-name",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "What should we call you?",
    autoComplete: "nickname",
    style: {
      width: "100%",
      height: 44,
      borderRadius: 14,
      border: "none",
      background: "var(--paper-2)",
      color: "var(--ink)",
      padding: "0 16px",
      fontSize: 16,
      outline: "none",
      fontFamily: "inherit"
    }
  }), rule, React.createElement("div", {
    style: title
  }, "Spotify"), React.createElement("p", {
    style: why
  }, "Marks the artists you already love across the lineup."), state.spotifyConnected ? done("Connected") : React.createElement(FieldButton, {
    kind: "secondary",
    onClick: () => startSpotifyAuth()
  }, "Connect Spotify"), rule, React.createElement("div", {
    style: title
  }, "Set reminders"), React.createElement("p", {
    style: why
  }, notifSupported ? "A heads-up 15 minutes before each saved set starts." : "This browser can’t send notifications. You can still set alarms from the Lineup."), notifSupported && (notifPerm === "granted" ? done("On") : React.createElement(FieldButton, {
    kind: "secondary",
    onClick: () => enableNotifs()
  }, "Turn on reminders")), React.createElement(FieldButton, {
    onClick: save,
    style: {
      marginTop: 24
    }
  }, "Done"));
}
var _FID = FESTIVAL_CONFIG.id;
var _SAVED_KEY = `${_FID}_saved_v1`;
function SearchModal({
  onClose,
  onSelectArtist,
  saved = []
}) {
  var [q, setQ] = React.useState("");
  var inputRef = React.useRef(null);
  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);
  React.useEffect(() => {
    var onKey = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  var query = q.trim().toLowerCase();
  var DAY_MAP = {
    fri: 1,
    friday: 1,
    "day 1": 1,
    sat: 2,
    saturday: 2,
    "day 2": 2,
    sun: 3,
    sunday: 3,
    "day 3": 3
  };
  var dayFilter = DAY_MAP[query];
  var results = query.length === 0 ? [] : activeLineup().filter(a => {
    if (dayFilter) return a.day === dayFilter;
    var stage = STAGES.find(s => s.id === a.stage);
    return a.name.toLowerCase().includes(query) || a.genre.toLowerCase().includes(query) || (stage?.name || "").toLowerCase().includes(query) || (stage?.short || "").toLowerCase().includes(query) || (stage?.vibe || "").toLowerCase().includes(query) || ["legend", "legendary", "sunrise", "b2b"].includes(query) && isLegendary(a);
  }).sort((a, b) => {
    var aStart = a.name.toLowerCase().startsWith(query);
    var bStart = b.name.toLowerCase().startsWith(query);
    if (aStart !== bStart) return aStart ? -1 : 1;
    if (a.day !== b.day) return a.day - b.day;
    return toNightMin(a.start) - toNightMin(b.start);
  });
  var QUICK = [{
    label: "★ Legendary / B2B",
    q: "legendary"
  }, {
    label: "Sunrise sets",
    q: "sunrise"
  }, {
    label: "Kinetic Field",
    q: "kinetic"
  }, {
    label: "Tech House",
    q: "tech house"
  }, {
    label: "Techno",
    q: "techno"
  }, {
    label: "Trance",
    q: "trance"
  }, {
    label: "Friday",
    q: "fri"
  }, {
    label: "Saturday",
    q: "sat"
  }, {
    label: "Sunday",
    q: "sun"
  }];
  var DAY_LABEL = {
    1: "FRI",
    2: "SAT",
    3: "SUN"
  };
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 80,
      background: "var(--paper)",
      display: "flex",
      flexDirection: "column",
      animation: "slideUp 0.2s ease-out"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 16px 12px",
      borderBottom: "1px solid var(--line)",
      paddingTop: "calc(14px + env(safe-area-inset-top, 0px))"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }, React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), React.createElement("path", {
    d: "M21 21 L16.65 16.65"
  })), React.createElement("input", {
    ref: inputRef,
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Artist, stage, genre, day…",
    style: {
      flex: 1,
      background: "transparent",
      border: "none",
      outline: "none",
      fontFamily: "Geist, sans-serif",
      fontSize: 18,
      color: "var(--ink)"
    },
    onKeyDown: e => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && results[0]) {
        onSelectArtist(results[0].id);
        onClose();
      }
    }
  }), q && React.createElement("button", {
    onClick: () => setQ(""),
    style: {
      background: "var(--paper-2)",
      border: "none",
      borderRadius: 99,
      width: 20,
      height: 20,
      color: "var(--muted)",
      fontSize: 13,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    "aria-label": "Clear"
  }, "×"), React.createElement("button", {
    onClick: onClose,
    style: {
      background: "transparent",
      border: "none",
      color: "var(--ember-ink)",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.1,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "CLOSE")), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch"
    }
  }, query.length === 0 ? React.createElement("div", {
    style: {
      padding: "14px 16px"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.5,
      color: "var(--muted)",
      marginBottom: 10
    }
  }, "QUICK SEARCH"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 18
    }
  }, QUICK.map((t, qi) => React.createElement("button", {
    key: t.label,
    onClick: () => setQ(t.q),
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "6px 14px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--ink)",
      fontWeight: 600,
      transition: "background 0.12s, border-color 0.12s",
      animation: `springIn 0.3s ease-out ${qi * 25}ms both`
    }
  }, t.label))), saved.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.5,
      color: "var(--muted)",
      marginBottom: 8
    }
  }, "YOUR LINEUP · ", saved.length, " SETS"), saved.slice(0, 6).map(id => {
    var a = ARTISTS.find(x => x.id === id);
    if (!a) return null;
    var st = STAGES.find(s => s.id === a.stage);
    return React.createElement("button", {
      key: a.id,
      onClick: () => {
        onSelectArtist(a.id);
        onClose();
      },
      style: {
        display: "flex",
        gap: 10,
        padding: "8px 0",
        width: "100%",
        borderBottom: "1px solid var(--line)",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        alignItems: "center"
      }
    }, React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 6,
        background: st?.color,
        boxShadow: `0 0 5px ${st?.color}66`,
        flexShrink: 0
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 16,
        lineHeight: 1.1,
        color: "var(--ink)"
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 0.8,
        color: "var(--muted)",
        marginTop: 2
      }
    }, st?.short, " · DAY ", a.day, " · ", fmt12(a.start))), React.createElement("span", {
      style: {
        fontSize: 10,
        color: "var(--ember-ink)"
      }
    }, "★"));
  }), saved.length > 6 && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      padding: "8px 0",
      textAlign: "center"
    }
  }, "+", saved.length - 6, " MORE"))) : results.length === 0 ? React.createElement("div", {
    style: {
      padding: 48,
      textAlign: "center"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 32,
      opacity: 0.3,
      marginBottom: 8
    }
  }, "🔍"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      color: "var(--muted)",
      fontStyle: "italic"
    }
  }, "No results"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 6
    }
  }, "TRY A STAGE NAME, GENRE, OR DAY")) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "mono",
    style: {
      padding: "10px 16px 4px",
      fontSize: 9,
      letterSpacing: 1.5,
      color: "var(--muted)"
    }
  }, results.length, " RESULT", results.length !== 1 ? "S" : ""), results.map((a, ri) => {
    var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
    var leg = isLegendary(a);
    return React.createElement("button", {
      key: a.id,
      onClick: () => {
        onSelectArtist(a.id);
        onClose();
      },
      style: {
        display: "flex",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--line)",
        width: "100%",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        alignItems: "center",
        border: "none",
        borderBottom: "1px solid var(--line)",
        animation: ri < 12 ? `springIn 0.3s ease-out ${ri * 30}ms both` : undefined
      }
    }, React.createElement("div", {
      style: {
        width: 4,
        alignSelf: "stretch",
        background: stage?.color || "#8a8580",
        borderRadius: 3,
        flexShrink: 0
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      className: "serif",
      style: {
        fontSize: 20,
        lineHeight: 1.05,
        letterSpacing: -0.2
      }
    }, a.name), leg && React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1,
        color: "#fbbf24",
        fontWeight: 800
      }
    }, "★ DON'T MISS")), React.createElement("div", {
      style: {
        display: "flex",
        gap: 5,
        marginTop: 2,
        alignItems: "center"
      }
    }, React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 6,
        background: stage.color,
        boxShadow: `0 0 5px ${stage.color}66`,
        flexShrink: 0
      }
    }), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: stage.color,
        fontWeight: 600,
        textTransform: "uppercase"
      }
    }, stage.short), React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "·"), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)"
      }
    }, DAY_LABEL[a.day], " ", fmt12(a.start), "–", fmt12(a.end)), React.createElement("span", {
      style: {
        color: "var(--muted)"
      }
    }, "·"), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        textTransform: "uppercase"
      }
    }, a.genre))), React.createElement("svg", {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--muted)",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M9 18 L15 12 L9 6"
    })));
  }))));
}
function ToastHost() {
  var [msg, setMsg] = React.useState(null);
  React.useEffect(() => {
    window.plurskyToast = (text, opts = {}) => {
      setMsg(null);
      requestAnimationFrame(() => setMsg({
        text,
        id: Date.now(),
        ...opts
      }));
      try {
        navigator.vibrate?.(15);
      } catch {}
    };
    return () => {
      delete window.plurskyToast;
    };
  }, []);
  React.useEffect(() => {
    if (!msg) return;
    var t = setTimeout(() => setMsg(null), msg.duration || 1600);
    return () => clearTimeout(t);
  }, [msg?.id]);
  if (!msg) return null;
  var hasAction = msg.actionLabel && typeof msg.onAction === "function";
  return React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 80,
      zIndex: 95,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
      padding: "0 16px"
    }
  }, React.createElement("div", {
    className: "mono",
    role: "status",
    "aria-live": "polite",
    style: {
      background: "var(--ink)",
      color: "var(--paper)",
      padding: hasAction ? "7px 7px 7px 16px" : "9px 16px",
      borderRadius: 999,
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600,
      boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      animation: "fadeIn .15s",
      display: "flex",
      alignItems: "center",
      gap: 12,
      maxWidth: "100%",
      pointerEvents: hasAction ? "auto" : "none"
    }
  }, React.createElement("span", {
    style: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, msg.text), hasAction && React.createElement("button", {
    onClick: () => {
      try {
        msg.onAction();
      } catch {}
      setMsg(null);
    },
    className: "mono",
    style: {
      flexShrink: 0,
      background: "var(--paper)",
      color: "var(--ink)",
      border: "none",
      borderRadius: 999,
      padding: "6px 13px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 800
    }
  }, msg.actionLabel)));
}
function App() {
  var [showOnboarding, setShowOnboarding] = React.useState(() => {
    try {
      return localStorage.getItem("onboarded") !== ONBOARD_VERSION;
    } catch {
      return false;
    }
  });
  var [searchOpen, setSearchOpen] = React.useState(false);
  var [personalizeOpen, setPersonalizeOpen] = React.useState(false);
  var modalOpen = useModalOpen();
  React.useEffect(() => {
    window.plurskyOpenOnboarding = () => setShowOnboarding(true);
    window.plurskyOpenPersonalize = () => setPersonalizeOpen(true);
    return () => {
      delete window.plurskyOpenOnboarding;
      delete window.plurskyOpenPersonalize;
    };
  }, []);
  React.useEffect(() => {
    try {
      sbOutboxInit?.();
    } catch {}
  }, []);
  var {
    mode: themeMode
  } = useThemeMode();
  React.useEffect(() => {
    applyThemeClass();
    var id = setInterval(applyThemeClass, 60000);
    return () => clearInterval(id);
  }, [themeMode]);
  React.useEffect(() => {
    var onConnect = e => {
      if (e?.detail?.ok) {
        setState(s => ({
          ...s,
          spotifyConnected: true,
          spotifyProfile: typeof getSpotifyProfileSync === "function" ? getSpotifyProfileSync() : null
        }));
      }
    };
    window.addEventListener("plursky-spotify-connect", onConnect);
    return () => window.removeEventListener("plursky-spotify-connect", onConnect);
  }, []);
  var {
    perm: notifPerm,
    showLocal
  } = useNotifications();
  var [state, setState] = React.useState(() => {
    var saved;
    try {
      var raw = localStorage.getItem(_SAVED_KEY);
      saved = raw ? JSON.parse(raw) : null;
    } catch {}
    var rawSearch = window.location.search || (window.location.hash?.startsWith("#?") ? window.location.hash.slice(1) : "");
    var params = new URLSearchParams(rawSearch);
    var dlFest = params.get("f") || params.get("festival");
    if (dlFest && typeof FESTIVALS_REGISTRY !== "undefined") {
      var fEntry = FESTIVALS_REGISTRY.find(f => f.config.id === dlFest);
      var canSwitch = !!fEntry && (fEntry.available || fEntry.previewOnly && window._isPlusSub?.());
      if (canSwitch && dlFest !== FESTIVAL_CONFIG.id) {
        try {
          var u = new URL(window.location.href);
          u.searchParams.delete("f");
          u.searchParams.delete("festival");
          if (u.hash.startsWith("#?")) {
            var h = new URLSearchParams(u.hash.slice(2));
            h.delete("f");
            h.delete("festival");
            u.hash = h.toString() ? "#?" + h.toString() : "";
          }
          window.history.replaceState({}, "", u.toString());
        } catch {}
        setActiveFestivalAndReload(dlFest);
      }
    }
    var dlArtist = params.get("artist");
    var dlTab = params.get("tab");
    var dlStage = params.get("stage");
    var dlDay = params.get("day");
    var dlLineup = params.get("lineup");
    var dlFrom = params.get("from");
    var dlCrew = params.get("crew");
    var validArtist = dlArtist && ARTISTS.find(a => a.id === dlArtist) ? dlArtist : null;
    var validTab = ["home", "map", "lineup", "spotify", "me", "memories"].includes(dlTab) ? dlTab : null;
    var validStage = dlStage && STAGES.find(s => s.id === dlStage || s.short.toLowerCase() === dlStage.toLowerCase()) ? dlStage : null;
    var validDay = dlDay && festivalDayNums().includes(+dlDay) ? +dlDay : null;
    var validFriendIds = dlLineup ? dlLineup.split(",").map(s => s.trim()).filter(id => ARTISTS.find(a => a.id === id)) : [];
    var validFrom = (dlFrom || "").slice(0, 24).replace(/[^a-zA-Z0-9 _.-]/g, "") || null;
    var validCrew = (dlCrew || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || null;
    if (validCrew) {
      try {
        localStorage.setItem("plursky_group_code", validCrew);
      } catch {}
      try {
        localStorage.setItem("plursky_crew_autojoin", "1");
      } catch {}
      try {
        window.sbPresenceRefresh?.();
      } catch {}
    }
    if (dlArtist || dlTab || dlStage || dlDay || dlLineup || dlFrom || dlCrew) {
      try {
        history.replaceState(null, "", window.location.pathname);
      } catch {}
    }
    return {
      tab: (validStage ? "lineup" : validTab) || (validCrew ? "me" : "home"),
      saved: saved ?? [],
      spotifyConnected: spotifyTokenValid(),
      artist: validArtist,
      focusStage: validStage || null,
      lineupDay: validDay || NOW.day,
      friendLineup: validFriendIds.length ? validFriendIds : null,
      friendName: validFriendIds.length ? validFrom : null,
      _navStack: []
    };
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(_SAVED_KEY, JSON.stringify(state.saved));
    } catch {}
  }, [state.saved]);
  React.useEffect(() => {
    var applyUrlParams = rawUrl => {
      try {
        var u = new URL(rawUrl || "", "capacitor://localhost");
        var raw = u.search || (u.hash?.startsWith("#?") ? u.hash.slice(1) : "");
        var params = new URLSearchParams(raw);
        var tab = params.get("tab");
        if (["home", "map", "lineup", "spotify", "me", "memories"].includes(tab)) {
          setState(prev => ({
            ...prev,
            tab
          }));
          setShowOnboarding(false);
        }
      } catch {}
    };
    window.plurskyApplyUrlParams = applyUrlParams;
    var sub = null;
    try {
      var capApp = window.Capacitor?.Plugins?.App;
      if (capApp?.addListener) {
        Promise.resolve(capApp.addListener("appUrlOpen", ({
          url
        }) => applyUrlParams(url))).then(s => {
          sub = s;
        }).catch(() => {});
      }
    } catch {}
    return () => {
      try {
        sub?.remove?.();
      } catch {}
      ;
      delete window.plurskyApplyUrlParams;
    };
  }, []);
  React.useEffect(() => {
    if (!state.saved.length) return;
    var id = setTimeout(async () => {
      try {
        var user = await window.sbGetUser?.();
        if (user) await window.sbPush?.(state.saved);
      } catch {}
    }, 3000);
    return () => clearTimeout(id);
  }, [state.saved.join(",")]);
  var _pushNav = React.useCallback(next => {
    setState(prev => ({
      ...prev,
      ...next,
      _navStack: [...(prev._navStack || []).slice(-4), {
        tab: prev.tab,
        artist: prev.artist,
        focusStage: prev.focusStage
      }]
    }));
  }, []);
  var _popNav = React.useCallback(() => {
    setState(prev => {
      var stack = [...(prev._navStack || [])];
      var entry = stack.pop();
      if (!entry) return {
        ...prev,
        artist: null
      };
      return {
        ...prev,
        ...entry,
        _navStack: stack
      };
    });
  }, []);
  React.useEffect(() => {
    window._pushNav = _pushNav;
    window._popNav = _popNav;
  }, [_pushNav, _popNav]);
  React.useEffect(() => {
    if (notifPerm === "granted") scheduleReminders(state, showLocal);
  }, [state.saved.join(","), notifPerm]);
  React.useEffect(() => {
    var cancelled = false;
    var t = setTimeout(async () => {
      if (cancelled) return;
      try {
        var user = window.sbGetUser ? await window.sbGetUser() : null;
        if (user && window.sbPush) {
          var notes = {};
          try {
            notes = JSON.parse(localStorage.getItem("artist_notes_v1") || "{}");
          } catch {}
          await window.sbPush(state.saved, notes);
        } else if (state.saved.length) {
          var seen = (() => {
            try {
              return localStorage.getItem("cloud_nudge_seen") === "1";
            } catch {
              return false;
            }
          })();
          if (!seen && typeof window.plurskyToast === "function") {
            try {
              localStorage.setItem("cloud_nudge_seen", "1");
            } catch {}
            window.plurskyToast("Saved. Sign in on Me tab to back up.");
          }
        }
      } catch {}
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [state.saved.join(",")]);
  var body;
  if (state.artist) body = React.createElement(ArtistScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "home") body = React.createElement(HomeScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "map") body = React.createElement(MapScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "lineup") body = React.createElement(LineupScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "spotify") body = React.createElement(SpotifyScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "memories") body = React.createElement(MemoriesScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "recap") body = React.createElement(RecapScreen, {
    state: state,
    setState: setState
  });else if (state.tab === "me") body = React.createElement(MeScreen, {
    state: state,
    setState: setState
  });
  var statusBarStyle = state.tab === "map" && !state.artist ? "light" : "dark";
  return React.createElement(IOSDevice, {
    dark: statusBarStyle === "light"
  }, React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      paddingTop: state.tab === "home" && !state.artist ? 0 : "var(--top-pad, 54px)"
    }
  }, !(state.tab === "home" && !state.artist) && React.createElement(StatusStrip, null), React.createElement("div", {
    style: {
      flex: 1,
      position: "relative"
    }
  }, body, !state.artist && !searchOpen && state.tab !== "map" && !modalOpen && !(state.tab === "lineup" && state.lineupGrid) && React.createElement("button", {
    onClick: () => setSearchOpen(true),
    "aria-label": "Search artists, stages, genres",
    style: {
      position: "absolute",
      bottom: 16,
      right: 16,
      zIndex: 30,
      height: 48,
      borderRadius: 24,
      padding: "0 18px 0 14px",
      background: "var(--chrome)",
      color: "var(--ink)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 15,
      lineHeight: "20px",
      fontWeight: 600
    }
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), React.createElement("path", {
    d: "M21 21 L16.65 16.65"
  })), "Search"), React.createElement(ToastHost, null)), !state.artist && (() => {
    var postFest = (() => {
      try {
        return Date.now() > (FESTIVAL_CONFIG?.endMs || Infinity);
      } catch {
        return false;
      }
    })();
    var meFold = postFest ? ["spotify", "recap"] : ["spotify", "memories", "recap"];
    return React.createElement(TabBar, {
      active: meFold.includes(state.tab) ? "me" : state.tab,
      onChange: t => setState({
        ...state,
        tab: t
      })
    });
  })()), searchOpen && React.createElement(SearchModal, {
    onClose: () => setSearchOpen(false),
    onSelectArtist: id => setState({
      ...state,
      artist: id
    }),
    saved: state.saved || []
  }), showOnboarding && React.createElement(OnboardingModal, {
    state: state,
    setState: setState,
    onDone: () => setShowOnboarding(false)
  }), personalizeOpen && React.createElement(PersonalizeSheet, {
    state: state,
    onClose: () => setPersonalizeOpen(false)
  }), window.NowPlayingBar && React.createElement(window.NowPlayingBar), React.createElement(BatterySaverToast, null));
}
var styleTag = document.createElement("style");
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
  var [particles, setParticles] = React.useState([]);
  React.useEffect(() => {
    window._plurskyCelebrate = () => {
      var colors = ["#e85d2e", "#f59a36", "#fbbf24", "#7b3d9a", "#38bdf8", "#22c55e", "#ec4899", "#fff"];
      var p = Array.from({
        length: 36
      }, (_, i) => ({
        id: Date.now() + i,
        x: 10 + Math.random() * 80,
        size: 4 + Math.random() * 6,
        color: colors[i % colors.length],
        dur: 1.2 + Math.random() * 1.5,
        delay: Math.random() * 0.4,
        shape: i % 3
      }));
      setParticles(p);
      navigator.vibrate?.([15, 50, 15, 50, 30]);
      setTimeout(() => setParticles([]), 3000);
    };
    return () => {
      delete window._plurskyCelebrate;
    };
  }, []);
  if (!particles.length) return null;
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      pointerEvents: "none",
      overflow: "hidden"
    }
  }, particles.map(p => React.createElement("div", {
    key: p.id,
    style: {
      position: "absolute",
      left: `${p.x}%`,
      top: -10,
      width: p.size,
      height: p.shape === 2 ? p.size * 1.6 : p.size,
      borderRadius: p.shape === 0 ? "50%" : p.shape === 1 ? "2px" : 0,
      background: p.color,
      transform: p.shape === 2 ? "rotate(45deg)" : undefined,
      animation: `confetti-fall ${p.dur}s ease-in ${p.delay}s forwards`
    }
  })));
}
class RootErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(err) {
    return {
      err
    };
  }
  componentDidCatch(err, info) {
    try {
      localStorage.setItem("plursky_last_crash", JSON.stringify({
        message: err?.message || String(err),
        stack: err?.stack?.slice(0, 4000) || null,
        compStack: info?.componentStack?.slice(0, 2000) || null,
        ts: new Date().toISOString(),
        version: "v319"
      }));
    } catch {}
  }
  reload = () => {
    var go = () => {
      try {
        window.location.reload();
      } catch {}
    };
    if ("caches" in window) {
      caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(go, go);
    } else go();
  };
  render() {
    if (!this.state.err) return this.props.children;
    return React.createElement("div", {
      style: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "#f7ede0",
        color: "#1a120d",
        fontFamily: "Geist, system-ui, sans-serif",
        textAlign: "center"
      }
    }, React.createElement("div", {
      style: {
        fontFamily: "Instrument Serif, serif",
        fontSize: 36,
        marginBottom: 6
      }
    }, "Something glitched."), React.createElement("div", {
      style: {
        fontSize: 14,
        color: "rgba(26,18,13,0.65)",
        marginBottom: 22,
        maxWidth: 340,
        lineHeight: 1.5
      }
    }, "Plursky hit an unexpected error. Your saved lineup is safe — reloading should fix it."), React.createElement("button", {
      onClick: this.reload,
      style: {
        background: "#1a120d",
        color: "#f7ede0",
        border: "none",
        borderRadius: 12,
        padding: "12px 22px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.4,
        fontWeight: 700
      }
    }, "RELOAD"), React.createElement("div", {
      style: {
        marginTop: 22,
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.2,
        color: "rgba(26,18,13,0.45)"
      }
    }, "PLURSKY · v319"));
  }
}
function SetStartingCinematic() {
  var [show, setShow] = React.useState(null);
  var shownRef = React.useRef(new Set());
  React.useEffect(() => {
    var check = () => {
      try {
        var saved = JSON.parse(localStorage.getItem(`${FESTIVAL_CONFIG.id}_saved_v1`) || "[]");
        if (!saved.length || !NOW.time || NOW.night == null) return;
        var nowMin = toNightMin(NOW.time);
        var _loop2 = function (_id) {
            var a = activeLineup().find(x => x.id === _id);
            if (!a || a.day !== NOW.night) return 0;
            var startMin = toNightMin(a.start);
            var diff = startMin - nowMin;
            if (diff > 0 && diff <= 3 && !shownRef.current.has(a.id)) {
              shownRef.current.add(a.id);
              var _stage = STAGES.find(s => s.id === a.stage);
              setShow({
                artist: a,
                stage: _stage,
                minsLeft: diff
              });
              navigator.vibrate?.([30, 50, 30, 50, 60]);
              setTimeout(() => setShow(null), 6000);
              return {
                v: void 0
              };
            }
          },
          _ret2;
        for (var _id of saved) {
          _ret2 = _loop2(_id);
          if (_ret2 === 0) continue;
          if (_ret2) return _ret2.v;
        }
      } catch {}
    };
    var id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  }, []);
  if (!show) return null;
  var {
    artist: a,
    stage,
    minsLeft
  } = show;
  var vfx = _genreToVfx(a.genre);
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 9998,
      background: "rgba(13,8,4,0.92)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      animation: "fadeIn 0.5s ease-out",
      backdropFilter: "blur(12px)"
    },
    onClick: () => setShow(null)
  }, React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0.15,
      background: `radial-gradient(ellipse at 50% 40%, ${stage?.color || "var(--ember)"}, transparent 70%)`,
      animation: "vfx-pulse 2s ease-in-out infinite"
    }
  }), React.createElement("div", {
    style: {
      position: "relative",
      textAlign: "center",
      padding: "0 32px"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 3,
      color: stage?.color || "var(--ember-ink)",
      fontWeight: 800,
      marginBottom: 12,
      animation: "vfx-pulse 1.5s ease-in-out infinite"
    }
  }, "SET STARTING"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 42,
      lineHeight: 0.95,
      letterSpacing: -1,
      marginBottom: 8,
      textShadow: `0 0 40px ${stage?.color || "var(--ember)"}55`
    }
  }, a.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: stage?.color || "#fff",
      marginBottom: 24
    }
  }, stage?.name?.toUpperCase() || "", " · ", fmt12(a.start)), React.createElement("div", {
    style: {
      fontFamily: "Geist Mono, monospace",
      fontSize: 52,
      fontWeight: 200,
      letterSpacing: 2,
      fontVariantNumeric: "tabular-nums",
      color: "#fff",
      textShadow: `0 0 30px ${stage?.color || "var(--ember)"}`
    }
  }, minsLeft, " MIN"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "rgba(255,255,255,0.4)",
      marginTop: 20
    }
  }, "TAP TO DISMISS")));
}
document.documentElement.classList.add("app-live");
document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
  }, 60);
});
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(RootErrorBoundary, null, React.createElement(App, null), React.createElement(CelebrationOverlay, null), React.createElement(SetStartingCinematic, null)));
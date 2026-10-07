var _ART_DIR_URL = "data/artists/directory.json";
var _artDirPromise = null;
function _artDirFetch() {
  if (!_artDirPromise) {
    _artDirPromise = fetch(_ART_DIR_URL).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => {
      _artDirPromise = null;
      throw e;
    });
  }
  return _artDirPromise;
}
function useArtistDirectory() {
  var [res, setRes] = React.useState({
    status: "loading"
  });
  var [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    var live = true;
    setRes({
      status: "loading"
    });
    _artDirFetch().then(data => {
      if (live) setRes({
        status: "ready",
        data
      });
    }).catch(() => {
      if (live) setRes({
        status: "error"
      });
    });
    return () => {
      live = false;
    };
  }, [attempt]);
  return [res, () => setAttempt(a => a + 1)];
}
var _artFold = s => window.PlurskyArtistKey.foldKey(s);
var _artFestShort = name => String(name).replace(/\s+20\d\d$/, "");
function _artToday() {
  var d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _artDay(ymd, weekday) {
  try {
    return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      ...(weekday ? {
        weekday: "short"
      } : {})
    });
  } catch {
    return ymd;
  }
}
function _artLetter(a) {
  var c = _artFold(a.n)[0] || "#";
  return /[a-z]/.test(c) ? c.toUpperCase() : "#";
}
function _artMeta(a, fests, today) {
  if (a.pending) return `${a.b.length} billing${a.b.length === 1 ? "" : "s"} · may be more than one act`;
  if (!a.b.length) return "";
  var brands = new Set(a.b.map(b => fests[b[0]].brand));
  var parts = [`${brands.size} festival${brands.size === 1 ? "" : "s"}`];
  var next = a.b.find(b => _artUpcoming(b, today));
  if (next) parts.push(`next: ${_artFestShort(fests[next[0]].name)}, ${_artDay(_artUpcoming(next, today))}`);else {
    var last = [...a.b].reverse().find(b => b[1]);
    if (last) parts.push(`last: ${_artFestShort(fests[last[0]].name)} ${last[1].slice(0, 4)}`);
  }
  return parts.join(" · ");
}
function _artUpcoming(b, today) {
  if (b[1] && b[1] >= today) return b[1];
  if (b[8] && b[8] >= today) return b[8];
  return null;
}
function _artSecond(a) {
  if (a.m) return a.m.join(" · ");
  if (a.p) return `Also plays as ${a.p.join(", ")}`;
  return null;
}
function _ArtFace({
  name,
  size = 40
}) {
  var rec = typeof getPermanentArtistImage === "function" ? getPermanentArtistImage(name) : null;
  return React.createElement("span", {
    className: "duo-av",
    "aria-hidden": "true",
    style: {
      width: size,
      height: size,
      fontSize: Math.round(size * 0.32)
    }
  }, rec ? React.createElement("img", {
    src: rec.url,
    alt: ""
  }) : _duoInitials(name));
}
function ArtistsDirectoryScreen({
  state,
  setState
}) {
  var [res, retry] = useArtistDirectory();
  var [q, setQ] = React.useState(state.artistsQuery || "");
  var [playing, setPlaying] = React.useState(false);
  var [fest, setFest] = React.useState("");
  var [open, setOpen] = React.useState(null);
  var today = _artToday(),
    year = today.slice(0, 4);
  var data = res.status === "ready" ? res.data : null;
  var fests = data ? data.festivals : [];
  var scoped = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!data || scoped.current) return;
    scoped.current = true;
    var i = state.artistsFestival ? data.festivals.findIndex(f => f.id === state.artistsFestival) : -1;
    if (i >= 0) setFest(String(i));
  }, [data]);
  var list = React.useMemo(() => {
    if (!data) return [];
    var fq = q.trim() ? _artFold(q.trim()) : "";
    var fi = fest === "" ? -1 : +fest;
    return data.artists.filter(a => {
      if (playing && !a.b.some(b => {
        var d = _artUpcoming(b, today);
        return d && d.startsWith(year);
      })) return false;
      if (fi >= 0 && !a.b.some(b => b[0] === fi)) return false;
      if (fq && ![a.n, ...(a.m || []), ...(a.p || [])].some(s => _artFold(s).includes(fq))) return false;
      return true;
    }).sort((x, y) => _artFold(x.n).localeCompare(_artFold(y.n)));
  }, [data, q, playing, fest, today, year]);
  var items = React.useMemo(() => {
    var out = [];
    var cur = null;
    for (var a of list) {
      var L = _artLetter(a);
      if (L !== cur) {
        cur = L;
        out.push({
          t: "h",
          key: `h:${L}`,
          letter: L
        });
      }
      out.push({
        t: "r",
        key: a.k,
        a
      });
    }
    return out;
  }, [list]);
  var back = () => {
    if (window._popNav) window._popNav();else setState(s => ({
      ...s,
      tab: "me"
    }));
  };
  var openBilling = b => {
    var f = fests[b[0]];
    if (b[7] && f.id === (window.FESTIVAL_CONFIG && FESTIVAL_CONFIG.id)) (window._pushNav || (n => setState(s => ({
      ...s,
      ...n
    }))))({
      artist: b[7]
    });else if (!b[7]) (window._pushNav || (n => setState(s => ({
      ...s,
      ...n
    }))))({
      tab: "past",
      pastEdition: f.id,
      pastDirect: true,
      artist: null
    });
    setOpen(null);
  };
  var festOptions = fests.map((f, i) => ({
    i,
    f
  })).sort((x, y) => (y.f.year || 0) - (x.f.year || 0) || x.f.name.localeCompare(y.f.name));
  return React.createElement(Screen, null, React.createElement(_HistHeader, {
    title: "Artists",
    sub: fest === "" ? "Across every festival" : "At one festival",
    onBack: back
  }), React.createElement("div", {
    "data-artists-controls": true,
    style: {
      padding: "8px 20px 4px",
      display: "grid",
      gap: 4
    }
  }, React.createElement("input", {
    type: "search",
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search artists",
    "aria-label": "Search artists",
    autoComplete: "off",
    spellCheck: false,
    style: {
      width: "100%",
      boxSizing: "border-box",
      height: 44,
      padding: "0 14px",
      borderRadius: "var(--rad-md)",
      border: "1px solid var(--line-2)",
      background: "var(--s2)",
      color: "var(--ink)",
      font: "400 16px/1 var(--f-ui)"
    }
  }), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center"
    }
  }, React.createElement("button", {
    className: "duo-chip",
    "aria-pressed": playing,
    "data-artists-playing": true,
    onClick: () => setPlaying(v => !v)
  }, React.createElement("span", null, "Playing ", year)), React.createElement("label", {
    className: "duo-chip",
    style: {
      position: "relative"
    }
  }, React.createElement("span", null, fest === "" ? "Festival" : _artFestShort(fests[+fest]?.name || "Festival") + (fests[+fest]?.year ? ` ${fests[+fest].year}` : "")), React.createElement("select", {
    "data-artists-festival": true,
    "aria-label": "Festival",
    value: fest,
    onChange: e => setFest(e.target.value),
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      width: "100%",
      cursor: "pointer"
    }
  }, React.createElement("option", {
    value: ""
  }, "All festivals"), festOptions.map(({
    i,
    f
  }) => React.createElement("option", {
    key: f.id,
    value: String(i)
  }, f.name))))), data && React.createElement("div", {
    className: "duo-data-s duo-ink3",
    "data-artists-count": true,
    "aria-live": "polite"
  }, list.length.toLocaleString("en-US"), " ", list.length === 1 ? "artist" : "artists")), res.status !== "ready" ? React.createElement(_HistStatus, {
    res: res,
    retry: retry,
    what: "artists"
  }) : list.length ? React.createElement(_ArtistsWindow, {
    items: items,
    fests: fests,
    today: today,
    onOpen: setOpen
  }) : React.createElement("p", {
    role: "status",
    className: "duo-body-s duo-ink2",
    style: {
      margin: "24px 20px",
      fontWeight: 400
    }
  }, "No artist matches. Names are as each festival billed them."), open && React.createElement(_ArtistBillingsSheet, {
    a: open,
    fests: fests,
    today: today,
    onClose: () => setOpen(null),
    onOpenBilling: openBilling
  }));
}
var _ART_EST = {
  h: 40,
  r: 72
};
function _ArtistsWindow({
  items,
  fests,
  today,
  onOpen
}) {
  var scRef = React.useRef(null);
  var heights = React.useRef(new Map());
  var [ver, setVer] = React.useState(0);
  var [view, setView] = React.useState({
    top: 0,
    h: 800
  });
  var offsets = React.useMemo(() => {
    var o = new Float64Array(items.length + 1);
    for (var i = 0; i < items.length; i++) o[i + 1] = o[i] + (heights.current.get(items[i].key) ?? _ART_EST[items[i].t]);
    return o;
  }, [items, ver]);
  React.useLayoutEffect(() => {
    if (scRef.current) scRef.current.scrollTop = 0;
  }, [items]);
  React.useLayoutEffect(() => {
    var sc = scRef.current;
    if (!sc) return undefined;
    var read = () => setView({
      top: sc.scrollTop,
      h: sc.clientHeight
    });
    read();
    var raf = 0;
    var onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        read();
      });
    };
    sc.addEventListener("scroll", onScroll, {
      passive: true
    });
    var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    if (ro) ro.observe(sc);
    return () => {
      sc.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  var OVER = 600;
  var lo = 0,
    hi = items.length;
  {
    var a = 0,
      b = items.length;
    while (a < b) {
      var m = a + b >> 1;
      if (offsets[m + 1] < view.top - OVER) a = m + 1;else b = m;
    }
    lo = a;
  }
  {
    var i = lo;
    while (i < items.length && offsets[i] < view.top + view.h + OVER) i++;
    hi = i;
  }
  React.useLayoutEffect(() => {
    var sc = scRef.current;
    if (!sc) return;
    var changed = false,
      above = 0;
    for (var el of sc.querySelectorAll("[data-dir-item]")) {
      var k = el.dataset.dirItem,
        h = el.offsetHeight,
        _i = +el.dataset.dirIndex;
      var was = heights.current.get(k) ?? _ART_EST[items[_i]?.t || "r"];
      if (Math.abs(was - h) > 0.5) {
        heights.current.set(k, h);
        changed = true;
        if (offsets[_i] < sc.scrollTop) above += h - was;
      } else if (!heights.current.has(k)) heights.current.set(k, h);
    }
    if (changed) {
      if (above) sc.scrollTop += above;
      setVer(v => v + 1);
    }
  });
  var letters = React.useMemo(() => items.map((it, i) => it.t === "h" ? [it.letter, i] : null).filter(Boolean), [items]);
  var jump = (y, rect) => {
    if (!letters.length) return;
    var i = Math.max(0, Math.min(letters.length - 1, Math.floor((y - rect.top) / (rect.height / letters.length))));
    var sc = scRef.current;
    if (sc) sc.scrollTop = offsets[letters[i][1]];
  };
  var onScrub = e => {
    var r = e.currentTarget.getBoundingClientRect();
    jump(e.clientY, r);
  };
  return React.createElement("div", {
    style: {
      flex: 1,
      position: "relative",
      minHeight: 0
    }
  }, React.createElement("div", {
    ref: scRef,
    "data-artists-scroll": true,
    style: {
      position: "absolute",
      inset: 0,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch"
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      height: offsets[items.length] + 94
    }
  }, items.slice(lo, hi).map((it, j) => {
    var i = lo + j;
    var pos = {
      position: "absolute",
      top: offsets[i],
      left: 0,
      right: 0
    };
    if (it.t === "h") return React.createElement("h2", {
      key: it.key,
      "data-dir-item": it.key,
      "data-dir-index": i,
      "data-dir-letter": it.letter,
      className: "duo-sect",
      style: {
        ...pos,
        margin: 0,
        padding: "16px 40px 6px 20px",
        boxSizing: "border-box"
      }
    }, it.letter);
    var a = it.a,
      second = _artSecond(a);
    return React.createElement("button", {
      key: it.key,
      "data-dir-item": it.key,
      "data-dir-index": i,
      "data-artist-row": a.k,
      onClick: () => onOpen(a),
      style: {
        ...pos,
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        boxSizing: "border-box",
        padding: "10px 40px 10px 20px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink)",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: "pointer"
      }
    }, React.createElement(_ArtFace, {
      name: a.n
    }), React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      className: "duo-name duo-body",
      style: {
        display: "block",
        fontWeight: 600
      }
    }, a.n), second && React.createElement("span", {
      className: "duo-body-s duo-ink2",
      style: {
        display: "block",
        fontWeight: 400,
        overflowWrap: "anywhere"
      }
    }, second), React.createElement("span", {
      className: "duo-body-s duo-ink3",
      style: {
        display: "block",
        fontWeight: 400,
        marginTop: 2
      }
    }, _artMeta(a, fests, today))));
  }))), letters.length > 1 && React.createElement("div", {
    "data-artists-scrubber": true,
    role: "navigation",
    "aria-label": "Jump to letter",
    onPointerDown: e => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      onScrub(e);
    },
    onPointerMove: e => {
      if (e.buttons) onScrub(e);
    },
    style: {
      position: "absolute",
      right: 0,
      top: 8,
      bottom: 94,
      width: 32,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-evenly",
      alignItems: "center",
      touchAction: "none",
      userSelect: "none",
      cursor: "pointer"
    }
  }, letters.map(([L, i]) => React.createElement("button", {
    key: L,
    "aria-label": `Artists starting with ${L === "#" ? "a number or symbol" : L}`,
    onClick: () => {
      var sc = scRef.current;
      if (sc) sc.scrollTop = offsets[i];
    },
    className: "duo-data-s duo-acc",
    style: {
      background: "none",
      border: "none",
      padding: 0,
      minHeight: 0,
      lineHeight: 1,
      font: "600 11px/1 var(--f-ui)",
      color: "var(--acc-ink)"
    }
  }, L))));
}
function _ArtistBillingsSheet({
  a,
  fests,
  today,
  onClose,
  onOpenBilling
}) {
  var years = [...new Set(a.b.map(b => (b[1] || "").slice(0, 4) || String(fests[b[0]].year || "")))].sort().reverse();
  var activeId = window.FESTIVAL_CONFIG && FESTIVAL_CONFIG.id;
  var second = _artSecond(a);
  return React.createElement(FieldSheet, {
    title: a.n,
    onClose: onClose
  }, React.createElement("div", {
    "data-artist-sheet": a.k
  }, second && React.createElement("p", {
    className: "duo-body-s duo-ink2",
    style: {
      margin: "0 0 8px",
      fontWeight: 400
    }
  }, second), a.pending && React.createElement("p", {
    "data-artist-sheet-pending": true,
    className: "duo-body-s duo-ink2",
    style: {
      margin: "0 0 8px",
      fontWeight: 400
    }
  }, "These billings share a name and may be more than one act. They are listed separately until an official source ties them together."), !a.b.length && React.createElement("p", {
    className: "duo-body-s duo-ink2",
    style: {
      margin: "8px 0",
      fontWeight: 400
    }
  }, "No billings under this name; see the projects above."), years.map(y => React.createElement("section", {
    key: y,
    style: {
      marginTop: 12
    }
  }, React.createElement("h3", {
    className: "duo-sect",
    style: {
      margin: "0 0 4px"
    }
  }, y), a.b.filter(b => ((b[1] || "").slice(0, 4) || String(fests[b[0]].year || "")) === y).slice().reverse().map((b, i) => {
    var f = fests[b[0]];
    var can = b[7] && f.id === activeId || !b[7];
    var when = [b[1] ? _artDay(b[1], true) + (b[8] ? ` and ${_artDay(b[8], true)}` : "") : "Date to be announced", b[3] && typeof fmt12 === "function" ? fmt12(b[3]) : b[3]].filter(Boolean).join(" · ");
    var where = [b[2], b[4]].filter(Boolean).join(" · ");
    var body = React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      className: "duo-body",
      style: {
        display: "block",
        fontWeight: 600
      }
    }, f.name), React.createElement("span", {
      className: "duo-body-s duo-ink2",
      style: {
        display: "block",
        fontWeight: 400
      }
    }, when, where ? ` · ${where}` : ""), _artFold(b[6]) !== _artFold(a.n) && React.createElement("span", {
      className: "duo-body-s duo-ink3",
      style: {
        display: "block",
        fontWeight: 400,
        overflowWrap: "anywhere"
      }
    }, "Billed as ", b[6]));
    return can ? React.createElement("button", {
      key: i,
      "data-artist-billing": true,
      onClick: () => onOpenBilling(b),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        padding: "8px 0",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--line)",
        color: "var(--ink)",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: "pointer"
      }
    }, body, React.createElement("svg", {
      "aria-hidden": "true",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        color: "var(--ink-3)",
        flex: "none"
      }
    }, React.createElement("path", {
      d: "M9 6 L15 12 L9 18"
    }))) : React.createElement("div", {
      key: i,
      "data-artist-billing": true,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        padding: "8px 0",
        borderBottom: "1px solid var(--line)"
      }
    }, body);
  })))));
}
function ArtistsDirectoryRow() {
  return React.createElement("button", {
    "data-artists-entry": true,
    onClick: () => (window._pushNav || (() => {}))({
      tab: "artists",
      artist: null,
      artistsQuery: "",
      artistsFestival: null
    }),
    className: "duo-card",
    style: {
      width: "100%",
      minHeight: 52,
      marginBottom: 14,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      border: "none",
      color: "var(--ink)",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit"
    }
  }, React.createElement("span", {
    className: "duo-headline",
    style: {
      flex: 1,
      minWidth: 0
    }
  }, "All artists"), React.createElement("span", {
    className: "duo-body-s duo-ink2",
    style: {
      flexShrink: 0
    }
  }, "Every festival"));
}
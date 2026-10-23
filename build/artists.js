var _ART_DIR_URL = "data/artists/directory.json";
var _ART_CAREER_URL = "data/artists/careers.json";
var _artSlices = {};
function _artSliceFetch(url) {
  if (!_artSlices[url]) {
    _artSlices[url] = fetch(url).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => {
      delete _artSlices[url];
      throw e;
    });
  }
  return _artSlices[url];
}
var _artDirFetch = () => _artSliceFetch(_ART_DIR_URL);
function _useArtSlice(url) {
  var [res, setRes] = React.useState({
    status: "loading"
  });
  var [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    var live = true;
    setRes({
      status: "loading"
    });
    _artSliceFetch(url).then(data => {
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
  }, [url, attempt]);
  return [res, () => setAttempt(a => a + 1)];
}
var useArtistDirectory = () => _useArtSlice(_ART_DIR_URL);
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
  var [q, setQ] = React.useState("");
  var [playing, setPlaying] = React.useState(false);
  var [fest, setFest] = React.useState("");
  var [open, setOpen] = React.useState(null);
  var today = _artToday(),
    year = today.slice(0, 4);
  var data = res.status === "ready" ? res.data : null;
  var fests = data ? data.festivals : [];
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
    _artOpenBilling(fests[b[0]], b[7], setState);
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
  var jumpTo = (y, el) => {
    if (!letters.length || !el) return;
    var best = 0,
      bestD = Infinity;
    [...el.children].forEach((c, k) => {
      var r = c.getBoundingClientRect(),
        d = Math.abs(y - (r.top + r.height / 2));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    var sc = scRef.current;
    if (sc) sc.scrollTop = offsets[letters[best][1]];
  };
  var onScrub = e => jumpTo(e.clientY, e.currentTarget);
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
      justifyContent: "center",
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
      flex: "0 1 18px",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
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
function _artOpenBilling(f, liveId, setState) {
  var go = window._pushNav || (n => setState(s => ({
    ...s,
    ...n
  })));
  if (liveId && f.id === (window.FESTIVAL_CONFIG && FESTIVAL_CONFIG.id)) go({
    artist: liveId
  });else if (!liveId) go({
    tab: "past",
    pastEdition: f.id,
    pastDirect: true,
    artist: null
  });
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
var _crYear = (x, fests) => (x[2] || "").slice(0, 4) || String(fests[x[1]].year || "");
var _crTime = t => t && typeof fmt12 === "function" ? fmt12(t) : t;
function _crPublished(ymd) {
  try {
    return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return ymd;
  }
}
var _crIsPartnerRole = x => x[7] === "b2b" || x[7] === "cobilled";
function useArtistCareer(festivalId, artistId, name) {
  var [res] = _useArtSlice(_ART_CAREER_URL);
  return React.useMemo(() => {
    if (res.status !== "ready" || !window.PlurskyArtistKey) return null;
    var d = res.data;
    if (!d._byBilling) {
      d._byBilling = new Map();
      for (var [k, a] of Object.entries(d.artists)) for (var x of a.b) d._byBilling.set(x[0], [...(d._byBilling.get(x[0]) || []), k]);
    }
    var want = window.PlurskyArtistKey.artistKey(name || "");
    var key = (d._byBilling.get(`${festivalId}:${artistId}`) || []).find(k => k === want);
    return key ? {
      key,
      c: d.artists[key],
      fests: d.festivals,
      nameOf: k => d.artists[k] && d.artists[k].n || d.names[k] || k
    } : null;
  }, [res, festivalId, artistId, name]);
}
function _careerModel(c, fests, today) {
  var bs = c.b,
    year = x => _crYear(x, fests);
  var years = [...new Set(bs.map(year))].sort();
  var brands = [];
  for (var x of bs) if (!brands.includes(fests[x[1]].brand)) brands.push(fests[x[1]].brand);
  var ladder = brands.map(br => {
    var mine = bs.filter(x => fests[x[1]].brand === br);
    var ys = [...new Set(mine.map(year))].sort(),
      moves = [];
    var _loop = function (i) {
      var from = mine.filter(x => year(x) === ys[i - 1]).slice(-1)[0],
        to = mine.find(x => year(x) === ys[i]);
      var timed = !!(from[4] && to[4]);
      var side = x => [x[3] || "stage TBA", timed ? _crTime(x[4]) : null].filter(Boolean).join(" ");
      moves.push({
        ids: [from[0], to[0]],
        text: `${ys[i - 1]} ${side(from)} → ${ys[i]} ${side(to)}${from[9] === false && to[9] === true ? " · main stage" : ""}`
      });
    };
    for (var i = 1; i < ys.length; i++) {
      _loop(i);
    }
    return {
      br,
      label: _artFestShort(fests[mine[0][1]].name),
      cells: years.map(y => mine.filter(x => year(x) === y)),
      moves
    };
  });
  var facts = [];
  facts.push({
    ids: [bs[0][0]],
    text: `First on a lineup in our records: ${fests[bs[0][1]].name}`
  });
  if (years.length > 1) facts.push({
    ids: bs.map(x => x[0]),
    text: years.map(y => {
      var n = new Set(bs.filter(x => year(x) === y).map(x => x[1])).size;
      return `${y}: ${n} festival${n === 1 ? "" : "s"}`;
    }).join(" → ")
  });
  var closed = new Map();
  for (var _x of bs) if (_x[8] === true && _x[3]) {
    var t = `Closed ${_x[3]}, ${fests[_x[1]].name}`;
    closed.set(t, [...(closed.get(t) || []), _x[0]]);
  }
  for (var [text, ids] of closed) facts.push({
    ids,
    text
  });
  var peak = x => x[9] === true || x[8] === true,
    neither = x => x[9] === false && x[8] === false;
  var pi = bs.findIndex(peak),
    prior = pi > 0 ? bs.slice(0, pi).find(neither) : null;
  if (prior) facts.push({
    ids: [prior[0], bs[pi][0]],
    text: `First ${bs[pi][9] === true ? "main-stage set" : "closing slot"} in our records: ${fests[bs[pi][1]].name}`
  });
  var upcoming = bs.filter(x => x[2] ? x[2] >= today || x[14] && x[14] >= today : year(x) >= today.slice(0, 4));
  var partners = new Map();
  for (var _x2 of bs) if (_crIsPartnerRole(_x2)) for (var k of _x2[10]) {
    var p = partners.get(k) || {
      k,
      years: new Set(),
      ids: []
    };
    p.years.add(year(_x2));
    p.ids.push(_x2[0]);
    partners.set(k, p);
  }
  return {
    years,
    ladder,
    facts,
    upcoming,
    partners: [...partners.values()]
  };
}
function _CareerNode({
  x,
  fests
}) {
  var main = x[9] === true,
    closing = x[8] === true,
    timed = !!x[4],
    split = timed && _crIsPartnerRole(x) && x[10].length > 0;
  var label = [fests[x[1]].name, x[3] || "stage TBA", timed ? _crTime(x[4]) : "time TBA", main && "main stage", closing && "closed the stage", split && "B2B"].filter(Boolean).join(", ");
  return React.createElement("svg", {
    "data-ladder-node": true,
    "data-billings": x[0],
    role: "img",
    "aria-label": label,
    width: "20",
    height: "20",
    viewBox: "0 0 20 20",
    style: {
      flex: "none",
      display: "block"
    }
  }, timed ? React.createElement("circle", {
    cx: "10",
    cy: "10",
    r: "6",
    fill: main ? "var(--signal)" : "var(--ink-2)"
  }) : React.createElement("circle", {
    cx: "10",
    cy: "10",
    r: "3",
    fill: "var(--ink-3)"
  }), closing && React.createElement("circle", {
    cx: "10",
    cy: "10",
    r: "9",
    fill: "none",
    stroke: "var(--signal)",
    strokeWidth: "1.5"
  }), split && React.createElement("line", {
    x1: "5.5",
    y1: "14.5",
    x2: "14.5",
    y2: "5.5",
    stroke: "var(--paper)",
    strokeWidth: "2"
  }));
}
function _CareerLadder({
  m,
  fests
}) {
  var n = m.years.length,
    cols = `repeat(${n}, minmax(0, 1fr))`;
  return React.createElement("div", {
    "data-career-ladder": true,
    className: "duo-card",
    style: {
      padding: "12px 14px",
      marginBottom: 10
    }
  }, React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: "grid",
      gridTemplateColumns: cols,
      marginBottom: 4
    }
  }, m.years.map(y => React.createElement("span", {
    key: y,
    className: "duo-data-s duo-ink3",
    style: {
      textAlign: "center"
    }
  }, y))), m.ladder.map(row => {
    var on = row.cells.map((c, i) => c.length ? i : -1).filter(i => i >= 0);
    var a = on[0],
      z = on[on.length - 1];
    return React.createElement("div", {
      key: row.br,
      "data-ladder-row": row.br,
      style: {
        padding: "6px 0",
        borderTop: "1px solid var(--line)"
      }
    }, React.createElement("div", {
      className: "duo-body-s",
      style: {
        fontWeight: 600,
        overflowWrap: "anywhere"
      }
    }, row.label), React.createElement("div", {
      style: {
        position: "relative",
        display: "grid",
        gridTemplateColumns: cols,
        alignItems: "center",
        minHeight: 24
      }
    }, z > a && React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        top: "50%",
        height: 2,
        marginTop: -1,
        background: "var(--line-2)",
        left: `${(a + 0.5) / n * 100}%`,
        right: `${(n - z - 0.5) / n * 100}%`
      }
    }), row.cells.map((c, i) => React.createElement("span", {
      key: i,
      style: {
        position: "relative",
        display: "flex",
        justifyContent: "center",
        gap: 2
      }
    }, c.map(x => React.createElement(_CareerNode, {
      key: x[0],
      x: x,
      fests: fests
    }))))), row.moves.map(mv => React.createElement("div", {
      key: mv.ids.join(" "),
      "data-claim": "move",
      "data-billings": mv.ids.join(" "),
      className: "duo-body-s duo-ink2",
      style: {
        fontWeight: 400,
        overflowWrap: "anywhere"
      }
    }, mv.text)));
  }), React.createElement("div", {
    className: "duo-body-s duo-ink3",
    style: {
      fontWeight: 400,
      marginTop: 6,
      display: "flex",
      flexWrap: "wrap",
      columnGap: 12
    }
  }, React.createElement("span", null, "● a set"), React.createElement("span", null, "• time TBA"), m.ladder.some(r => r.cells.some(c => c.some(x => x[9] === true))) && React.createElement("span", {
    style: {
      color: "var(--signal-ink)"
    }
  }, "● main stage"), m.ladder.some(r => r.cells.some(c => c.some(x => x[8] === true))) && React.createElement("span", null, "◯ closed the stage"), m.ladder.some(r => r.cells.some(c => c.some(x => x[4] && _crIsPartnerRole(x) && x[10].length))) && React.createElement("span", null, "⊘ B2B")));
}
function _CareerYear({
  y,
  rows,
  row,
  startOpen
}) {
  var [open, setOpen] = React.useState(startOpen);
  return React.createElement("div", {
    "data-career-year": y
  }, React.createElement("button", {
    "aria-expanded": open,
    onClick: () => setOpen(v => !v),
    className: "duo-body",
    style: {
      width: "100%",
      minHeight: 44,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 0,
      background: "transparent",
      border: "none",
      color: "var(--ink)",
      fontFamily: "inherit",
      fontWeight: 600,
      textAlign: "left",
      cursor: "pointer"
    }
  }, React.createElement("svg", {
    "aria-hidden": "true",
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: "none",
      transform: open ? "rotate(90deg)" : "none"
    }
  }, React.createElement("path", {
    d: "M9 6 L15 12 L9 18"
  })), y, " · ", rows.length, " ", rows.length === 1 ? "billing" : "billings"), open && rows.slice().reverse().map(row));
}
function ArtistCareer({
  part,
  festivalId,
  artistId,
  name,
  setState
}) {
  var career = useArtistCareer(festivalId, artistId, name);
  var [sheet, setSheet] = React.useState(null);
  if (!career) return null;
  var {
    c,
    fests,
    nameOf
  } = career;
  var today = _artToday();
  var m = c.pending ? null : _careerModel(c, fests, today);
  var openArtist = k => _artDirFetch().then(d => {
    var a = d.artists.find(x => x.k === k);
    if (a) setSheet({
      a,
      fests: d.festivals
    });
  }).catch(() => {});
  var sheetEl = sheet && React.createElement(_ArtistBillingsSheet, {
    a: sheet.a,
    fests: sheet.fests,
    today: today,
    onClose: () => setSheet(null),
    onOpenBilling: b => {
      _artOpenBilling(sheet.fests[b[0]], b[7], setState);
      setSheet(null);
    }
  });
  if (part === "arc") {
    if (c.pending) return React.createElement("p", {
      "data-artist-career": "pending",
      className: "duo-body-s duo-ink2",
      style: {
        margin: "0 0 14px",
        fontWeight: 400
      }
    }, "This name may be more than one act in our records, so its billings are listed separately below.");
    return React.createElement("section", {
      "data-artist-career": true,
      style: {
        marginBottom: 16
      }
    }, React.createElement("h2", {
      className: "duo-sect",
      style: {
        padding: "4px 0 6px"
      }
    }, "Career in our records"), c.b.length === 1 ? React.createElement("div", {
      "data-career-single": true,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, React.createElement(_CareerNode, {
      x: c.b[0],
      fests: fests
    }), React.createElement("span", {
      "data-claim": "first",
      "data-billings": c.b[0][0],
      className: "duo-body"
    }, m.facts[0].text)) : React.createElement(React.Fragment, null, React.createElement(_CareerLadder, {
      m: m,
      fests: fests
    }), m.facts.map(f => React.createElement("p", {
      key: f.text,
      "data-claim": "fact",
      "data-billings": f.ids.join(" "),
      className: "duo-body-s",
      style: {
        margin: "0 0 4px",
        fontWeight: 400
      }
    }, f.text))));
  }
  var row = (x, i) => {
    var f = fests[x[1]],
      live = x[13];
    var can = live && f.id === festivalId && live !== artistId || !live;
    var when = x[2] ? _artDay(x[2], true) + (x[14] ? ` and ${_artDay(x[14], true)}` : "") : "Date to be announced";
    var line = [when, x[3] || "stage TBA", x[4] ? _crTime(x[4]) : "time TBA", x[6], x[11] && `as published ${_crPublished(x[11])}`].filter(Boolean).join(" · ");
    var with_ = _crIsPartnerRole(x) && x[10].length ? `${x[7] === "b2b" ? "B2B with" : "With"} ${x[10].map(nameOf).join(", ")}` : null;
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
      "data-claim": "billing",
      "data-billings": x[0],
      className: "duo-body-s duo-ink2",
      style: {
        display: "block",
        fontWeight: 400
      }
    }, line), with_ && React.createElement("span", {
      "data-claim": "partners",
      "data-billings": x[0],
      className: "duo-body-s duo-ink2",
      style: {
        display: "block",
        fontWeight: 400
      }
    }, with_));
    var st = {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 56,
      padding: "8px 0",
      borderBottom: "1px solid var(--line)"
    };
    return can ? React.createElement("button", {
      key: i,
      "data-career-billing": x[0],
      onClick: () => _artOpenBilling(f, live, setState),
      style: {
        ...st,
        background: "transparent",
        border: "none",
        borderBottom: st.borderBottom,
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
      "data-career-billing": x[0],
      style: st
    }, body);
  };
  var yearsDesc = [...new Set(c.b.map(x => _crYear(x, fests)))].sort().reverse();
  return React.createElement("div", {
    "data-artist-career-detail": true
  }, m && m.upcoming.length > 0 && c.b.length > 1 && React.createElement("section", {
    "data-career-upcoming": true,
    style: {
      marginBottom: 18
    }
  }, React.createElement("h2", {
    className: "duo-sect",
    style: {
      padding: "4px 0 2px"
    }
  }, "Coming up"), m.upcoming.map(row)), React.createElement("section", {
    "data-career-years": true,
    style: {
      marginBottom: 18
    }
  }, React.createElement("h2", {
    className: "duo-sect",
    style: {
      padding: "4px 0 2px"
    }
  }, c.pending ? "Billings under this name" : "Year by year"), yearsDesc.map((y, i) => React.createElement(_CareerYear, {
    key: y,
    y: y,
    rows: c.b.filter(x => _crYear(x, fests) === y),
    row: row,
    startOpen: i === 0
  }))), m && m.partners.length > 0 && React.createElement("section", {
    "data-career-partners": true,
    style: {
      marginBottom: 18
    }
  }, React.createElement("h2", {
    className: "duo-sect",
    style: {
      padding: "4px 0 6px"
    }
  }, "B2B and collab partners"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      overflowX: "auto",
      paddingBottom: 4
    }
  }, m.partners.map(p => React.createElement("button", {
    key: p.k,
    "data-claim": "partner",
    "data-billings": p.ids.join(" "),
    onClick: () => openArtist(p.k),
    style: {
      flex: "none",
      width: 88,
      display: "grid",
      justifyItems: "center",
      gap: 4,
      padding: "4px 0",
      background: "transparent",
      border: "none",
      color: "var(--ink)",
      fontFamily: "inherit",
      cursor: "pointer",
      minHeight: 44
    }
  }, React.createElement(_ArtFace, {
    name: nameOf(p.k),
    size: 48
  }), React.createElement("span", {
    className: "duo-body-s",
    style: {
      fontWeight: 600,
      textAlign: "center",
      overflowWrap: "anywhere"
    }
  }, nameOf(p.k)), React.createElement("span", {
    className: "duo-body-s duo-ink3",
    style: {
      fontWeight: 400
    }
  }, [...p.years].sort().join(", ")))))), m && c.s && c.s.length > 0 && React.createElement("section", {
    "data-career-shared": true,
    style: {
      marginBottom: 18
    }
  }, React.createElement("h2", {
    className: "duo-sect",
    style: {
      padding: "4px 0 2px"
    }
  }, "Most often on the same lineup"), c.s.map(([k, n]) => React.createElement("button", {
    key: k,
    "data-claim": "shared",
    "data-shared": `${k}:${n}`,
    onClick: () => openArtist(k),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 52,
      padding: "6px 0",
      background: "transparent",
      border: "none",
      borderBottom: "1px solid var(--line)",
      color: "var(--ink)",
      textAlign: "left",
      fontFamily: "inherit",
      cursor: "pointer"
    }
  }, React.createElement(_ArtFace, {
    name: nameOf(k),
    size: 36
  }), React.createElement("span", {
    className: "duo-body",
    style: {
      flex: 1,
      minWidth: 0,
      fontWeight: 600,
      overflowWrap: "anywhere"
    }
  }, nameOf(k)), React.createElement("span", {
    className: "duo-body-s duo-ink2",
    style: {
      flexShrink: 0,
      fontWeight: 400
    }
  }, n, " festivals together")))), sheetEl);
}
function ArtistsDirectoryRow() {
  return React.createElement("button", {
    "data-artists-entry": true,
    onClick: () => (window._pushNav || (() => {}))({
      tab: "artists",
      artist: null
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
  }, "Artists"), React.createElement("span", {
    className: "duo-body-s duo-ink2",
    style: {
      flexShrink: 0
    }
  }, "Every festival"));
}
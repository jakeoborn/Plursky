var _HIST_BASE = "data/historical/";
var _histCache = {};
function _histFetch(path) {
  if (!_histCache[path]) {
    _histCache[path] = fetch(_HIST_BASE + path).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).catch(e => {
      delete _histCache[path];
      throw e;
    });
  }
  return _histCache[path];
}
function useHistorical(path) {
  var [res, setRes] = React.useState({
    status: "loading"
  });
  var [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    var live = true;
    setRes({
      status: "loading"
    });
    _histFetch(path).then(data => {
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
  }, [path, attempt]);
  return [res, () => setAttempt(a => a + 1)];
}
function _histDayParts(d) {
  var i = (d.label || "").lastIndexOf(" · ");
  return i < 0 ? {
    group: "",
    name: d.label || `Day ${d.day}`
  } : {
    group: d.label.slice(0, i),
    name: d.label.slice(i + 3)
  };
}
function _histDate(ymd, opts) {
  try {
    return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", {
      timeZone: "UTC",
      ...opts
    });
  } catch {
    return ymd;
  }
}
function _histDateRange(days) {
  if (!days?.length) return "";
  var a = days[0].date,
    b = days[days.length - 1].date;
  var md = {
    month: "short",
    day: "numeric"
  };
  if (a === b) return `${_histDate(a, md)}, ${a.slice(0, 4)}`;
  if (a.slice(0, 7) === b.slice(0, 7)) return `${_histDate(a, md)}–${+b.slice(8)}, ${a.slice(0, 4)}`;
  return `${_histDate(a, md)} – ${_histDate(b, md)}, ${a.slice(0, 4)}`;
}
function _histMinutes(t, rollover) {
  var [h, m] = (t || "").split(":").map(Number);
  if (isNaN(h)) return Infinity;
  return (h < (rollover ?? 6) ? h + 24 : h) * 60 + (m || 0);
}
var _histFold = s => (s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
function _histBack(state, setState) {
  if (state.pastEdition) setState(s => ({
    ...s,
    pastEdition: null
  }));else if (window._popNav) window._popNav();else setState(s => ({
    ...s,
    tab: "home"
  }));
}
function _HistHeader({
  title,
  sub,
  onBack,
  right
}) {
  return React.createElement("div", {
    style: {
      padding: "8px 8px 0 8px",
      display: "flex",
      alignItems: "flex-start",
      gap: 4
    }
  }, React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back",
    style: fieldIconBtn
  }, React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M15 6 L9 12 L15 18"
  }))), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2
    }
  }, sub && React.createElement("div", {
    style: {
      fontSize: 11,
      lineHeight: "14px",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--text-2)",
      marginBottom: 2
    }
  }, sub), React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 28,
      lineHeight: "34px",
      fontWeight: 700,
      letterSpacing: "-0.01em",
      overflowWrap: "anywhere"
    }
  }, title)), right);
}
function _HistStatus({
  res,
  retry,
  what
}) {
  if (res.status === "loading") return React.createElement("p", {
    role: "status",
    style: {
      margin: "24px 20px",
      color: "var(--text-2)"
    }
  }, "Loading ", what, "…");
  return React.createElement("div", {
    role: "status",
    style: {
      margin: "24px 20px",
      display: "grid",
      gap: 12
    }
  }, React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-2)"
    }
  }, "Couldn't load ", what, ". Past festivals need a connection the first time you open them."), React.createElement(FieldButton, {
    kind: "secondary",
    onClick: retry
  }, "Try again"));
}
function PastFestivalsScreen({
  state,
  setState
}) {
  if (state.pastEdition) return React.createElement(HistoricalEditionView, {
    key: state.pastEdition,
    state: state,
    setState: setState
  });
  return React.createElement(_HistLibrary, {
    state: state,
    setState: setState
  });
}
function _HistLibrary({
  state,
  setState
}) {
  var [res, retry] = useHistorical("index.json");
  var editions = res.status === "ready" ? res.data.editions || [] : [];
  var years = [...new Set(editions.map(e => e.year))].sort((a, b) => b - a);
  return React.createElement(Screen, null, React.createElement(_HistHeader, {
    title: "Past festivals",
    sub: "Official schedules · archived",
    onBack: () => _histBack(state, setState)
  }), React.createElement(ScrollBody, {
    style: {
      padding: "8px 20px 94px"
    }
  }, React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 15,
      lineHeight: "21px",
      color: "var(--text-2)",
      maxWidth: "60ch"
    }
  }, "Every lineup and set time as each festival printed it. Read-only; nothing here changes your plan."), res.status !== "ready" && React.createElement(_HistStatus, {
    res: res,
    retry: retry,
    what: "past festivals"
  }), years.map(y => React.createElement("section", {
    key: y,
    style: {
      marginTop: 16
    }
  }, React.createElement("h2", {
    style: {
      margin: "0 0 4px",
      fontSize: 11,
      lineHeight: "14px",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--text-2)"
    }
  }, y), editions.filter(e => e.year === y).map(e => React.createElement("button", {
    key: e.id,
    onClick: () => setState(s => ({
      ...s,
      pastEdition: e.id
    })),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: 72,
      padding: "10px 0",
      background: "transparent",
      border: "none",
      borderBottom: "1px solid var(--line)",
      color: "var(--ink)",
      textAlign: "left",
      fontFamily: "inherit",
      cursor: "pointer"
    }
  }, React.createElement("div", {
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
  }, e.festivalName), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)"
    }
  }, _histDateRange(e.days)), React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      fontVariantNumeric: "tabular-nums"
    }
  }, e.completeness === "lineup_only" ? `${e.counts.artists} artists · lineup only` : `${e.days.length} days · ${e.counts.stages} stages · ${e.counts.sets} sets`)), React.createElement("svg", {
    "aria-hidden": "true",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-3)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M9 6 L15 12 L9 18"
  }))))))));
}
var _HIST_METHOD = {
  structured_html: "Read from the festival's official set-times pages",
  official_image_transcription: "Transcribed from the festival's official schedule graphics, checked block by block"
};
function _HistProvenance({
  edition,
  onClose
}) {
  var p = edition.provenance || {};
  var stamp = ts => ts && /^\d{8}/.test(ts) ? _histDate(`${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }) : "";
  var dayLabel = n => edition.days.find(d => d.day === n)?.label || `Day ${n}`;
  var link = {
    color: "var(--signal-ink)",
    overflowWrap: "anywhere"
  };
  return React.createElement(FieldSheet, {
    title: "About this schedule",
    onClose: onClose
  }, React.createElement("div", {
    style: {
      display: "grid",
      gap: 14,
      fontSize: 15,
      lineHeight: "21px"
    }
  }, React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--text-2)"
    }
  }, _HIST_METHOD[p.extractionMethod] || "From the festival's official schedule", ", as archived by the Wayback Machine. Artist and stage names appear exactly as printed. Non-music activities are left out."), p.official && React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-2)"
    }
  }, "Official source"), React.createElement("div", {
    style: {
      overflowWrap: "anywhere"
    }
  }, p.official.replace(/^https?:\/\//, ""))), (p.captures || []).length > 0 && React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-2)",
      marginBottom: 4
    }
  }, "Archived captures"), (p.captures || []).map((c, i) => React.createElement("div", {
    key: i,
    style: {
      padding: "8px 0",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 600
    }
  }, dayLabel(c.day)), c.archivedUrl && React.createElement("a", {
    href: c.archivedUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: link
  }, "Set-times page · ", stamp(c.captureTimestamp)), c.imageArchivedUrl && React.createElement("div", null, React.createElement("a", {
    href: c.imageArchivedUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: link
  }, "Schedule graphic · ", stamp(c.imageCapture))), c.pageArchivedUrl && React.createElement("div", null, React.createElement("a", {
    href: c.pageArchivedUrl,
    target: "_blank",
    rel: "noopener noreferrer",
    style: link
  }, "Schedule page · ", stamp(c.pageCapture))))))));
}
function _HistChip({
  on,
  onClick,
  children,
  label
}) {
  return React.createElement("button", {
    onClick: onClick,
    "aria-pressed": on,
    "aria-label": label,
    style: {
      minHeight: 36,
      padding: "0 12px",
      borderRadius: 999,
      border: on ? "none" : "1px solid var(--line-2)",
      background: on ? "var(--signal)" : "transparent",
      color: on ? "var(--on-signal)" : "var(--ink)",
      fontFamily: "inherit",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, children);
}
function HistoricalEditionView({
  state,
  setState
}) {
  var [idx, retryIdx] = useHistorical("index.json");
  var meta = idx.status === "ready" ? (idx.data.editions || []).find(e => e.id === state.pastEdition) : null;
  var back = () => _histBack(state, setState);
  if (idx.status !== "ready") return React.createElement(Screen, null, React.createElement(_HistHeader, {
    title: "Past festivals",
    onBack: back
  }), React.createElement(_HistStatus, {
    res: idx,
    retry: retryIdx,
    what: "past festivals"
  }));
  if (!meta) return React.createElement(Screen, null, React.createElement(_HistHeader, {
    title: "Past festivals",
    onBack: back
  }), React.createElement("p", {
    style: {
      margin: "24px 20px",
      color: "var(--text-2)"
    }
  }, "That edition isn't in the library."));
  return React.createElement(_HistEdition, {
    meta: meta,
    back: back
  });
}
function _HistEdition({
  meta,
  back
}) {
  var [res, retry] = useHistorical(`editions/${meta.id}.json`);
  var [day, setDay] = React.useState(meta.days[0]?.day);
  var [q, setQ] = React.useState("");
  var [about, setAbout] = React.useState(false);
  var scroller = React.useRef(null);
  var e = res.status === "ready" ? res.data : null;
  var lineupOnly = meta.completeness === "lineup_only";
  var frozen = `Official ${meta.year} ${lineupOnly ? "lineup" : "schedule"} · archived`;
  var view = React.useMemo(() => {
    if (!e) return null;
    var artist = Object.fromEntries(e.artists.map(a => [a.id, a]));
    var stage = Object.fromEntries(e.stages.map(s => [s.id, s]));
    var byTime = (a, b) => _histMinutes(a.start, e.rolloverHour) - _histMinutes(b.start, e.rolloverHour);
    return {
      artist,
      stage,
      byTime
    };
  }, [e]);
  var infoBtn = React.createElement("button", {
    onClick: () => setAbout(true),
    "aria-label": "About this schedule",
    style: fieldIconBtn
  }, React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), React.createElement("path", {
    d: "M12 11 V16.5 M12 7.6 V7.5"
  })));
  var query = _histFold(q.trim());
  var time = s => s.end ? `${fmt12(s.start)} – ${fmt12(s.end)}` : fmt12(s.start);
  var setRow = (s, sub) => React.createElement("li", {
    key: s.id,
    style: {
      display: "flex",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid var(--line)",
      alignItems: "baseline"
    }
  }, React.createElement("div", {
    style: {
      width: 140,
      flexShrink: 0,
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap"
    }
  }, time(s), s.openEnd && React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-3)"
    }
  }, "no end time printed")), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontSize: 16,
      lineHeight: "21px",
      fontWeight: 600,
      overflowWrap: "anywhere"
    }
  }, view.artist[s.artistId]?.name), sub && React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)"
    }
  }, sub)));
  var body = null;
  if (e && lineupOnly) {
    var list = e.artists.filter(a => !query || _histFold(a.name).includes(query)).sort((a, b) => a.name.localeCompare(b.name));
    body = React.createElement(React.Fragment, null, React.createElement("p", {
      style: {
        margin: "4px 0 12px",
        fontSize: 14,
        color: "var(--text-2)"
      }
    }, "No official set times survive for this edition, so only the lineup is shown."), React.createElement("ul", {
      "aria-label": "Lineup",
      style: {
        listStyle: "none",
        margin: 0,
        padding: 0
      }
    }, list.map(a => React.createElement("li", {
      key: a.id,
      style: {
        padding: "10px 0",
        borderBottom: "1px solid var(--line)",
        fontSize: 16,
        fontWeight: 600,
        overflowWrap: "anywhere"
      }
    }, a.name))), !list.length && React.createElement("p", {
      style: {
        color: "var(--text-2)"
      }
    }, "No artist matches “", q.trim(), "”."));
  } else if (e && query) {
    var hits = e.sets.filter(s => _histFold(view.artist[s.artistId]?.name).includes(query));
    body = React.createElement(React.Fragment, null, meta.days.map(d => {
      var rows = hits.filter(s => s.day === d.day).sort(view.byTime);
      if (!rows.length) return null;
      return React.createElement("section", {
        key: d.day,
        style: {
          marginTop: 12
        }
      }, React.createElement("h2", {
        style: {
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-2)"
        }
      }, d.label, " · ", _histDate(d.date, {
        month: "short",
        day: "numeric"
      })), React.createElement("ul", {
        style: {
          listStyle: "none",
          margin: 0,
          padding: 0
        }
      }, rows.map(s => setRow(s, view.stage[s.stageId]?.name))));
    }), !hits.length && React.createElement("p", {
      style: {
        color: "var(--text-2)"
      }
    }, "No set matches “", q.trim(), "”."));
  } else if (e) {
    var daySets = e.sets.filter(s => s.day === day);
    var stages = e.stages.filter(st => daySets.some(s => s.stageId === st.id));
    var jump = id => {
      var el = scroller.current?.querySelector(`[data-stage="${CSS.escape(id)}"]`);
      if (el && scroller.current) scroller.current.scrollTo({
        top: el.offsetTop - 8,
        behavior: "smooth"
      });
    };
    body = React.createElement(React.Fragment, null, React.createElement("nav", {
      "aria-label": "Stages",
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        margin: "4px 0 8px"
      }
    }, stages.map(st => React.createElement("button", {
      key: st.id,
      onClick: () => jump(st.id),
      style: {
        minHeight: 32,
        padding: "0 10px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "var(--paper-2)",
        color: "var(--text-2)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer"
      }
    }, st.name))), stages.map(st => React.createElement("section", {
      key: st.id,
      "data-stage": st.id,
      style: {
        marginTop: 20
      }
    }, React.createElement("h2", {
      style: {
        margin: "0 0 2px",
        fontSize: 20,
        lineHeight: "25px",
        fontWeight: 700,
        overflowWrap: "anywhere"
      }
    }, st.name), React.createElement("ul", {
      style: {
        listStyle: "none",
        margin: 0,
        padding: 0
      }
    }, daySets.filter(s => s.stageId === st.id).sort(view.byTime).map(s => setRow(s))))));
  }
  var groups = [];
  meta.days.forEach(d => {
    var p = _histDayParts(d);
    var g = groups.find(x => x.name === p.group);
    if (!g) {
      g = {
        name: p.group,
        days: []
      };
      groups.push(g);
    }
    g.days.push({
      ...d,
      short: p.name
    });
  });
  return React.createElement(Screen, null, React.createElement(_HistHeader, {
    title: meta.festivalName,
    sub: frozen,
    onBack: back,
    right: infoBtn
  }), React.createElement("div", {
    style: {
      padding: "8px 20px 8px",
      display: "grid",
      gap: 8,
      borderBottom: "1px solid var(--line)"
    }
  }, !lineupOnly && !query && groups.map(g => React.createElement("div", {
    key: g.name || "days",
    role: "group",
    "aria-label": g.name || "Days",
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6
    }
  }, g.name && React.createElement("span", {
    style: {
      width: 84,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: "var(--text-2)"
    }
  }, g.name), g.days.map(d => React.createElement(_HistChip, {
    key: d.day,
    on: d.day === day,
    label: `${d.label}, ${_histDate(d.date, {
      month: "long",
      day: "numeric"
    })}`,
    onClick: () => {
      setDay(d.day);
      scroller.current?.scrollTo({
        top: 0
      });
    }
  }, d.short.slice(0, 3), " ", +d.date.slice(8))))), React.createElement("input", {
    type: "search",
    value: q,
    onChange: ev => setQ(ev.target.value),
    placeholder: lineupOnly ? "Search the lineup" : "Search every day",
    "aria-label": "Search artists",
    style: {
      width: "100%",
      boxSizing: "border-box",
      minHeight: 40,
      padding: "0 12px",
      borderRadius: 10,
      border: "1px solid var(--line-2)",
      background: "var(--paper-2)",
      color: "var(--ink)",
      fontFamily: "inherit",
      fontSize: 16
    }
  })), React.createElement(ScrollBody, {
    ref: scroller,
    style: {
      position: "relative",
      padding: "8px 20px 94px"
    }
  }, res.status !== "ready" ? React.createElement(_HistStatus, {
    res: res,
    retry: retry,
    what: meta.name
  }) : body), about && e && React.createElement(_HistProvenance, {
    edition: e,
    onClose: () => setAbout(false)
  }));
}
function isLegendary(a) {
  var name = (a.name || "").toLowerCase();
  if (name.includes("b2b") || name.includes("vs.") || name.includes(" x ")) return true;
  if (a.stage === "kinetic") {
    var [h, m] = a.end.split(":").map(Number);
    if (h >= 5 && h < 6) return true;
  }
  return false;
}
function _msToIcsDate(ms) {
  var d = new Date(ms);
  var pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function _artistMs(artist, hhmm) {
  return _wallMs(artistDayDate(artist), hhmm, FESTIVAL_CONFIG && FESTIVAL_CONFIG.tz);
}
async function exportSavedSetsICS(savedIds) {
  var artists = activeLineup(savedIds).filter(a => savedIds.includes(a.id)).sort((a, b) => a.day - b.day || (a.start < b.start ? -1 : 1));
  if (!artists.length) return;
  var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//Plursky//${FESTIVAL_CONFIG.name}//EN`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  artists.forEach(a => {
    var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
    var startMs = _artistMs(a, a.start);
    var endMs = _artistMs(a, a.end);
    if (!startMs || !endMs) return;
    lines.push("BEGIN:VEVENT", `DTSTART:${_msToIcsDate(startMs)}`, `DTEND:${_msToIcsDate(endMs)}`, `SUMMARY:${a.name}${stage ? " @ " + stage.name : ""}`, `DESCRIPTION:${FESTIVAL_CONFIG.name}`, `LOCATION:${FESTIVAL_CONFIG.location}`, `UID:plursky-${a.id}@plursky.app`, "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  var icsContent = lines.join("\r\n");
  var blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8"
  });
  var fileName = `${FESTIVAL_CONFIG.id}-plursky.ics`;
  var capShare = window.Capacitor?.Plugins?.Share;
  if (capShare?.share && window.Capacitor?.isNativePlatform?.()) {
    try {
      var dataUrl = await new Promise((resolve, reject) => {
        var r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      await capShare.share({
        title: `My ${FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name} schedule`,
        files: [dataUrl]
      });
      return;
    } catch (e) {
      if (e?.message && !/cancel|abort/i.test(e.message)) console.warn("[plursky-ics]", e.message);
    }
  }
  var shareFile = new File([blob], fileName, {
    type: "text/plain"
  });
  if (navigator.canShare?.({
    files: [shareFile]
  }) && navigator.share) {
    try {
      await navigator.share({
        files: [shareFile],
        title: `My ${FESTIVAL_CONFIG.shortName || FESTIVAL_CONFIG.name}`
      });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    window.open(`data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`, "_blank");
    return;
  }
  var url = URL.createObjectURL(blob);
  var a = Object.assign(document.createElement("a"), {
    href: url,
    download: fileName
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
function _nightShareText(ids) {
  var lines = festivalDayNums().flatMap(day => {
    var d = FESTIVAL_CONFIG.dayDates[day];
    var dayArtists = activeLineup(ids).filter(a => a.day === day && ids.includes(a.id)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
    if (!dayArtists.length) return [];
    return [`${d.short} · ${d.name.toUpperCase()}`, ...dayArtists.map(a => `  ${fmt12(a.start)}  ${a.name}`), ""];
  });
  return [`My ${FESTIVAL_CONFIG.name} lineup (${ids.length} sets):`, "", ...lines].join("\n").trim();
}
function NightWizard({
  state,
  setState,
  onClose
}) {
  var [activeDay, setActiveDay] = React.useState(() => {
    var best = DAYS.map(d => ({
      n: d.n,
      count: activeLineup().filter(a => a.day === d.n && state.saved.includes(a.id)).length
    })).reduce((b, d) => d.count > b.count ? d : b, {
      n: 1,
      count: 0
    });
    return best.n;
  });
  var [local, setLocal] = React.useState(() => new Set(state.saved));
  var localIds = Array.from(local);
  var dayStats = DAYS.map(d => {
    var sets = activeLineup(localIds).filter(a => a.day === d.n && local.has(a.id));
    var clashes = 0;
    for (var i = 0; i < sets.length; i++) for (var j = i + 1; j < sets.length; j++) if (overlaps(sets[i], sets[j])) clashes++;
    return {
      ...d,
      count: sets.length,
      clashes
    };
  });
  var sorted = activeLineup(localIds).filter(a => a.day === activeDay && local.has(a.id)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
  var conflictIds = new Set();
  for (var i = 0; i < sorted.length; i++) for (var j = i + 1; j < sorted.length; j++) if (overlaps(sorted[i], sorted[j])) {
    conflictIds.add(sorted[i].id);
    conflictIds.add(sorted[j].id);
  }
  var items = [];
  var _loop = function () {
    items.push({
      type: "set",
      artist: sorted[_i]
    });
    if (_i < sorted.length - 1) {
      var gS = toNightMin(sorted[_i].end),
        gE = toNightMin(sorted[_i + 1].start);
      if (gE > gS + 5) {
        var gapMin = gE - gS;
        var fits = activeLineup(localIds).filter(a => a.day === activeDay && !local.has(a.id) && toNightMin(a.start) >= gS && toNightMin(a.start) < gE - 14).sort((a, b) => b.tier - a.tier).slice(0, 3);
        items.push({
          type: "gap",
          gapMin,
          endOf: sorted[_i].end,
          startOf: sorted[_i + 1].start,
          fits
        });
      }
    }
  };
  for (var _i = 0; _i < sorted.length; _i++) {
    _loop();
  }
  var drop = id => setLocal(p => {
    var n = new Set(p);
    n.delete(id);
    return n;
  });
  var add = id => setLocal(p => new Set([...p, id]));
  var handleSave = () => {
    setState(st => ({
      ...st,
      saved: Array.from(local)
    }));
    onClose();
  };
  var autoFill = () => {
    var candidates = activeLineup(localIds).filter(a => a.day === activeDay).sort((a, b) => b.tier - a.tier || toNightMin(a.start) - toNightMin(b.start));
    var picked = [];
    var _loop2 = function (a) {
      if (picked.length >= 8) return 1;
      if (!picked.some(p => overlaps(p, a))) picked.push(a);
    };
    for (var a of candidates) {
      if (_loop2(a)) break;
    }
    setLocal(prev => {
      var merged = new Set(prev);
      activeLineup(localIds).filter(a => a.day === activeDay).forEach(a => merged.delete(a.id));
      picked.forEach(a => merged.add(a.id));
      return merged;
    });
  };
  var sunrise = FESTIVAL_CONFIG.sunTimes[activeDay]?.rise;
  var fmtGap = m => m >= 60 ? `${Math.floor(m / 60)}H ${m % 60}M` : `${m}M`;
  return React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 90,
      background: "var(--paper)",
      display: "flex",
      flexDirection: "column"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 18px 12px",
      paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close Build My Night",
    style: {
      width: 36,
      height: 36,
      borderRadius: 36,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      fontSize: 18,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "←"), React.createElement("div", null, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.8,
      fontWeight: 700,
      textAlign: "center"
    }
  }, "BUILD MY NIGHT"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.2,
      color: "var(--muted)",
      textAlign: "center",
      marginTop: 2
    }
  }, Array.from(local).length, " SETS SAVED")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, Array.from(local).length > 0 && React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => exportSavedSetsICS(Array.from(local)),
    "aria-label": "Export to calendar",
    title: "Export to calendar",
    style: {
      width: 36,
      height: 36,
      borderRadius: 36,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--ink)",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), React.createElement("path", {
    d: "M16 2v4M8 2v4M3 10h18"
  }), React.createElement("path", {
    d: "M8 14h2v2H8z",
    fill: "var(--ink)",
    stroke: "none"
  }))), React.createElement("button", {
    onClick: () => {
      var text = _nightShareText(Array.from(local));
      if (navigator.share) {
        navigator.share({
          title: `My ${FESTIVAL_CONFIG.shortName || "festival"} lineup`,
          text
        }).catch(() => {});
      } else {
        try {
          navigator.clipboard.writeText(text);
        } catch {}
      }
    },
    "aria-label": "Share lineup",
    title: "Share lineup",
    style: {
      width: 36,
      height: 36,
      borderRadius: 36,
      background: "var(--paper-2)",
      border: "1px solid var(--line-2)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--ink)",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("circle", {
    cx: "18",
    cy: "5",
    r: "3"
  }), React.createElement("circle", {
    cx: "6",
    cy: "12",
    r: "3"
  }), React.createElement("circle", {
    cx: "18",
    cy: "19",
    r: "3"
  }), React.createElement("path", {
    d: "M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"
  })))), React.createElement("button", {
    onClick: autoFill,
    title: "Auto-fill best non-clashing sets for this day",
    style: {
      background: "var(--horizon)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "8px 13px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "✦ AUTO"), React.createElement("button", {
    onClick: handleSave,
    style: {
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "8px 16px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "SAVE ✓"))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "10px 16px 10px",
      borderBottom: "1px solid var(--line)"
    }
  }, dayStats.map(d => {
    var on = d.n === activeDay;
    return React.createElement("button", {
      key: d.n,
      onClick: () => setActiveDay(d.n),
      style: {
        flex: 1,
        padding: "8px 6px",
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "center",
        background: on ? "var(--ink)" : "var(--paper-2)",
        border: on ? "none" : "1px solid var(--line)",
        transition: "all .15s"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: on ? "rgba(247,237,224,0.55)" : "var(--muted)"
      }
    }, d.short), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: on ? "var(--paper)" : "var(--ink)",
        lineHeight: 1.15
      }
    }, d.count), d.clashes > 0 ? React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        color: "var(--ember-ink)",
        letterSpacing: 0.8,
        marginTop: 1
      }
    }, "⚠ ", d.clashes, " CLASH") : d.count > 0 ? React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        color: on ? "rgba(247,237,224,0.4)" : "var(--muted)",
        letterSpacing: 0.8,
        marginTop: 1
      }
    }, "● CLEAN") : React.createElement("div", {
      style: {
        height: 12
      }
    }));
  })), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "14px 16px 40px"
    }
  }, sorted.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      paddingTop: 60
    }
  }, React.createElement("div", {
    style: {
      fontSize: 28,
      opacity: 0.25,
      marginBottom: 6
    }
  }, "★"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      fontStyle: "italic",
      color: "var(--muted)"
    }
  }, "Nothing saved"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.3,
      color: "var(--muted)",
      marginTop: 8
    }
  }, "SAVE SETS IN LINEUP FIRST")) : React.createElement(React.Fragment, null, items.map((item, idx) => {
    if (item.type === "set") {
      var a = item.artist;
      var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
      var clash = conflictIds.has(a.id);
      return React.createElement("div", {
        key: a.id,
        style: {
          display: "flex",
          gap: 10,
          marginBottom: 7,
          alignItems: "flex-start"
        }
      }, React.createElement("div", {
        className: "mono",
        style: {
          width: 36,
          flexShrink: 0,
          fontSize: 9,
          letterSpacing: 0.5,
          color: "var(--muted)",
          textAlign: "right",
          paddingTop: 11
        }
      }, fmt12(a.start)), React.createElement("div", {
        style: {
          flex: 1,
          background: clash ? "var(--ink)" : "var(--paper-2)",
          border: `1px solid ${clash ? "var(--ember)" : "var(--line)"}`,
          borderLeft: `4px solid ${stage.color}`,
          borderRadius: 12,
          padding: "9px 12px"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8
        }
      }, React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, React.createElement("div", {
        style: {
          fontSize: 14,
          fontWeight: 600,
          color: clash ? "var(--paper)" : "var(--ink)",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, a.name), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 0.9,
          color: clash ? "rgba(247,237,224,0.5)" : "var(--muted)",
          marginTop: 3
        }
      }, stage.short, " · ", fmt12(a.start), "–", fmt12(a.end))), React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0
        }
      }, clash && React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1,
          color: "var(--ember-ink)",
          fontWeight: 700
        }
      }, "⚠ CLASH"), React.createElement("button", {
        onClick: () => drop(a.id),
        style: {
          background: "rgba(232,93,46,0.12)",
          border: "1px solid rgba(232,93,46,0.25)",
          borderRadius: 999,
          padding: "3px 9px",
          cursor: "pointer",
          fontFamily: "Geist Mono, monospace",
          fontSize: 8,
          letterSpacing: 1,
          color: "var(--ember-ink)"
        }
      }, "DROP")))));
    }
    if (item.type === "gap") {
      return React.createElement("div", {
        key: `gap-${idx}`,
        style: {
          display: "flex",
          gap: 10,
          marginBottom: 7,
          alignItems: "flex-start"
        }
      }, React.createElement("div", {
        style: {
          width: 36,
          flexShrink: 0,
          paddingTop: 7
        }
      }, React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          color: "var(--muted)",
          textAlign: "right",
          letterSpacing: 0.5
        }
      }, item.endOf)), React.createElement("div", {
        style: {
          flex: 1
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 0"
        }
      }, React.createElement("div", {
        style: {
          flex: 1,
          height: 1,
          background: "var(--line)"
        }
      }), React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1.2,
          color: "var(--muted)",
          whiteSpace: "nowrap"
        }
      }, "FREE · ", fmtGap(item.gapMin)), React.createElement("div", {
        style: {
          flex: 1,
          height: 1,
          background: "var(--line)"
        }
      })), item.fits.length > 0 && React.createElement("div", {
        style: {
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          paddingBottom: 4
        }
      }, item.fits.map(f => {
        var fs = STAGES.find(s => s.id === f.stage) || UNPLACED_STAGE;
        return React.createElement("button", {
          key: f.id,
          onClick: () => add(f.id),
          style: {
            background: `${fs.color}12`,
            border: `1px dashed ${fs.color}`,
            borderRadius: 999,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: "Geist Mono, monospace",
            fontSize: 8,
            letterSpacing: 0.8,
            color: "var(--ink)"
          }
        }, "+ ", f.name, " ", fmt12(f.start), " ", fs.short);
      }))));
    }
    return null;
  }), sunrise && React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      marginTop: 6
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      width: 36,
      flexShrink: 0,
      fontSize: 9,
      color: "var(--flare)",
      textAlign: "right",
      letterSpacing: 0.5
    }
  }, sunrise), React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: `linear-gradient(90deg, var(--flare), transparent)`
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.4,
      color: "var(--flare)",
      fontWeight: 700
    }
  }, "☀ SUNRISE"))))));
}
function LineupFilterSheet({
  onClose,
  day,
  dayGenres,
  savedIds = [],
  weekendFilter = "all",
  initial,
  onApply,
  onReset
}) {
  var [f, setF] = React.useState(initial);
  var set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  var savedCount = savedIds.length;
  var savedSet = React.useMemo(() => new Set(savedIds), [savedIds]);
  var matchCount = React.useMemo(() => {
    return lineupFor(weekendFilter).filter(a => a.day === day).filter(a => f.filter === "all" || (f.filter === "saved" ? savedSet.has(a.id) : isSetLive(a))).filter(a => f.stageFilter === "all" || a.stage === f.stageFilter).filter(a => f.genreFilter === "all" || a.genre === f.genreFilter).filter(a => {
      if (f.tierFilter === "all") return true;
      if (f.tierFilter === "head") return a.tier === 3;
      if (f.tierFilter === "prime") return a.tier === 2;
      if (f.tierFilter === "open") return a.tier === 1;
      if (f.tierFilter === "legend") return isLegendary(a);
      return true;
    }).length;
  }, [f, day, savedSet, weekendFilter]);
  var chip = on => ({
    flexShrink: 0,
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 18,
    background: on ? "var(--paper-2)" : "transparent",
    color: on ? "var(--ink)" : "var(--text-2)",
    border: on ? "1.5px solid var(--signal)" : "1px solid var(--line-2)",
    fontSize: 15,
    lineHeight: "20px",
    fontWeight: on ? 600 : 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: 6
  });
  var sectionLabel = {
    ..._fieldEyebrow,
    color: "var(--text-2)",
    margin: "20px 0 8px"
  };
  var row = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap"
  };
  var opt = (key, id, label, extra) => React.createElement("button", {
    key: id,
    "aria-pressed": f[key] === id,
    onClick: () => set(key, id),
    style: chip(f[key] === id)
  }, extra, label);
  return React.createElement(FieldSheet, {
    title: "Filters",
    onClose: onClose
  }, React.createElement("div", {
    style: {
      ...sectionLabel,
      marginTop: 4
    }
  }, "Show"), React.createElement("div", {
    style: row
  }, opt("filter", "all", "All"), opt("filter", "saved", `Saved${savedCount ? ` · ${savedCount}` : ""}`), opt("filter", "now", "Now")), React.createElement("div", {
    style: sectionLabel
  }, "Tier"), React.createElement("div", {
    style: row
  }, opt("tierFilter", "all", "All tiers"), opt("tierFilter", "legend", "Legendary"), opt("tierFilter", "head", "Headliners"), opt("tierFilter", "prime", "Prime time"), opt("tierFilter", "open", "Openers")), React.createElement("div", {
    style: sectionLabel
  }, "Stage"), React.createElement("div", {
    style: row
  }, opt("stageFilter", "all", "All stages"), STAGES.map(s => opt("stageFilter", s.id, s.short || s.name, React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: s.color
    }
  })))), dayGenres.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: sectionLabel
  }, "Genre"), React.createElement("div", {
    style: row
  }, opt("genreFilter", "all", "All genres"), dayGenres.map(g => opt("genreFilter", g, g)))), React.createElement("div", {
    style: sectionLabel
  }, "Sort by"), React.createElement("div", {
    style: row
  }, opt("sortBy", "time", "Time"), opt("sortBy", "tier", "Tier"), opt("sortBy", "stage", "Stage")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 24
    }
  }, React.createElement(FieldButton, {
    kind: "secondary",
    onClick: () => onReset(),
    style: {
      width: "auto",
      flex: "0 0 auto"
    }
  }, "Reset"), React.createElement(FieldButton, {
    onClick: () => onApply(f),
    style: {
      flex: 1
    }
  }, "Show ", matchCount, " ", matchCount === 1 ? "set" : "sets")));
}
function LineupScreen({
  state,
  setState
}) {
  var highlightId = state.lineupHighlight || null;
  var [day, setDay] = React.useState(() => {
    if (highlightId) {
      var a = ARTISTS.find(x => x.id === highlightId);
      if (a) return a.day;
    }
    return state.lineupDay || NOW.day;
  });
  var [filter, setFilter] = React.useState("all");
  var [stageFilter, setStageFilter] = React.useState("all");
  var [tierFilter, setTierFilter] = React.useState("all");
  var [wizardOpen, setWizardOpen] = React.useState(false);
  var [genreFilter, setGenreFilter] = React.useState("all");
  var hasWeekends = ARTISTS.some(a => a.weekend && a.weekend !== "both");
  var [weekendFilter, setWeekendFilter] = React.useState(() => hasWeekends ? _weekendShiftMs(FESTIVAL_CONFIG) ? "W2" : "W1" : "all");
  var [q, setQ] = React.useState("");
  React.useEffect(() => {
    if (!highlightId) return;
    var scroller = setTimeout(() => {
      var el = document.querySelector('[data-lineup-highlight="true"]');
      if (el) try {
        el.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      } catch {}
    }, 100);
    var clearer = setTimeout(() => {
      setState(s => ({
        ...s,
        lineupHighlight: null
      }));
    }, 2400);
    return () => {
      clearTimeout(scroller);
      clearTimeout(clearer);
    };
  }, [highlightId]);
  var [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  var [viewMode, setViewMode] = React.useState(() => {
    try {
      return localStorage.getItem('plursky_lineup_view') || 'list';
    } catch {
      return 'list';
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem('plursky_lineup_view', viewMode);
    } catch {}
  }, [viewMode]);
  var [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    var el = null,
      lastY = 0;
    var attach = () => {
      var next = document.querySelector(viewMode === "grid" ? "[data-grid-scroll]" : "[data-lineup-scroll]");
      if (next === el) return;
      if (el) el.removeEventListener("scroll", onScroll);
      el = next;
      lastY = el ? el.scrollTop : 0;
      if (el) el.addEventListener("scroll", onScroll, {
        passive: true
      });
    };
    function onScroll() {
      if (!el) return;
      var y = el.scrollTop;
      if (y > 56 && y > lastY + 4) setCollapsed(true);else if (y < lastY - 8 || y < 24) setCollapsed(false);
      lastY = y;
    }
    attach();
    var t = setTimeout(attach, 120);
    return () => {
      clearTimeout(t);
      if (el) el.removeEventListener("scroll", onScroll);
    };
  }, [viewMode, day]);
  React.useEffect(() => {
    setCollapsed(viewMode === "grid");
  }, [day, viewMode, weekendFilter]);
  var gridSectionRefs = React.useRef({});
  var [, _tickT] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    var id = setInterval(_tickT, 30000);
    return () => clearInterval(id);
  }, []);
  var [sortBy, setSortBy] = React.useState("time");
  var activeFilterCount = (tierFilter !== "all" ? 1 : 0) + (stageFilter !== "all" ? 1 : 0) + (genreFilter !== "all" ? 1 : 0) + (filter !== "all" ? 1 : 0) + (sortBy !== "time" ? 1 : 0);
  React.useEffect(() => setGenreFilter("all"), [day]);
  var _chipFilterActive = tierFilter !== "all" || stageFilter !== "all" || genreFilter !== "all";
  var _emptyChipLabel = (() => {
    var named = [stageFilter !== "all" ? (STAGES.find(s => s.id === stageFilter) || {}).name : null, genreFilter !== "all" ? genreFilter : null].filter(Boolean);
    return named.length === 1 && tierFilter === "all" ? named[0] : null;
  })();
  var matchesActive = a => {
    if (weekendFilter !== "all" && a.weekend !== weekendFilter && a.weekend !== "both") return false;
    if (filter === "saved" && !state.saved.includes(a.id)) return false;
    if (filter === "now" && !isSetLive(a)) return false;
    if (stageFilter !== "all" && a.stage !== stageFilter) return false;
    if (genreFilter !== "all" && a.genre !== genreFilter) return false;
    if (tierFilter === "head" && a.tier !== 3) return false;
    if (tierFilter === "prime" && a.tier !== 2) return false;
    if (tierFilter === "open" && a.tier !== 1) return false;
    if (tierFilter === "legend" && !isLegendary(a)) return false;
    return true;
  };
  var spotifyMatchedIds = React.useMemo(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('spotify_matched_ids_v1') || '[]'));
    } catch {
      return new Set();
    }
  }, []);
  var dayGenres = React.useMemo(() => {
    var freq = {};
    lineupFor(weekendFilter).filter(a => a.day === day).forEach(a => {
      if (a.genre) freq[a.genre] = (freq[a.genre] || 0) + 1;
    });
    return Object.entries(freq).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([g]) => g);
  }, [day, weekendFilter]);
  var _nowBucket = filter === "now" ? Math.floor(Date.now() / 30000) : 0;
  var savedSetIds = React.useMemo(() => new Set(state.saved), [state.saved]);
  var dayArtists = React.useMemo(() => {
    var term = q.trim().toLowerCase();
    return lineupFor(weekendFilter).filter(a => a.day === day).filter(a => weekendFilter === "all" || a.weekend === weekendFilter || a.weekend === "both").filter(a => filter === "all" || (filter === "saved" ? savedSetIds.has(a.id) : isSetLive(a))).filter(a => stageFilter === "all" || a.stage === stageFilter).filter(a => genreFilter === "all" || a.genre === genreFilter).filter(a => {
      if (tierFilter === "all") return true;
      if (tierFilter === "head") return a.tier === 3;
      if (tierFilter === "prime") return a.tier === 2;
      if (tierFilter === "open") return a.tier === 1;
      if (tierFilter === "legend") return isLegendary(a);
      return true;
    }).filter(a => {
      if (!term) return true;
      var st = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
      return a.name.toLowerCase().includes(term) || (a.genre || "").toLowerCase().includes(term) || (st?.name || "").toLowerCase().includes(term);
    }).sort((a, b) => {
      if (sortBy === "tier") {
        if (a.tier !== b.tier) return b.tier - a.tier;
      } else if (sortBy === "stage") {
        var ai = STAGES.findIndex(s => s.id === a.stage);
        var bi = STAGES.findIndex(s => s.id === b.stage);
        if (ai !== bi) return ai - bi;
      }
      return toNightMin(a.start) - toNightMin(b.start);
    });
  }, [day, weekendFilter, filter, stageFilter, genreFilter, tierFilter, sortBy, q, savedSetIds, _nowBucket]);
  var _otherDayHits = React.useMemo(() => {
    var term = q.trim().toLowerCase();
    if (!term) return 0;
    return lineupFor(weekendFilter).filter(a => {
      if (a.day === day) return false;
      var st = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
      return a.name.toLowerCase().includes(term) || (a.genre || "").toLowerCase().includes(term) || (st?.name || "").toLowerCase().includes(term);
    }).length;
  }, [q, day, weekendFilter]);
  var dayStats = React.useMemo(() => DAYS.map(d => {
    var savedThisDay = lineupFor(weekendFilter).filter(x => x.day === d.n && savedSetIds.has(x.id));
    var clashes = 0;
    for (var i = 0; i < savedThisDay.length; i++) for (var j = i + 1; j < savedThisDay.length; j++) if (overlaps(savedThisDay[i], savedThisDay[j])) clashes++;
    return {
      ...d,
      count: savedThisDay.length,
      clashes
    };
  }), [savedSetIds, weekendFilter]);
  var totalSaved = React.useMemo(() => dayStats.reduce((s, d) => s + d.count, 0), [dayStats]);
  var savedToday = React.useMemo(() => lineupFor(weekendFilter).filter(a => a.day === day && savedSetIds.has(a.id)), [day, savedSetIds, weekendFilter]);
  var [syncOpen, setSyncOpen] = React.useState(false);
  var hasFeed = FESTIVALS_REGISTRY.some(e => e.available && e.config.id === FESTIVAL_CONFIG.id);
  var CONFLICT_ACK_KEY = "plursky_conflicts_kept_both_v1";
  var _pairKey = (idA, idB) => [idA, idB].sort().join("|");
  var [ackedPairs, setAckedPairs] = React.useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CONFLICT_ACK_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  var ackPair = (idA, idB) => {
    setAckedPairs(prev => {
      var next = new Set(prev);
      next.add(_pairKey(idA, idB));
      try {
        localStorage.setItem(CONFLICT_ACK_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };
  var {
    conflicts,
    conflictById
  } = React.useMemo(() => {
    var _conflicts = [];
    var _byId = {};
    for (var i = 0; i < savedToday.length; i++) {
      for (var j = i + 1; j < savedToday.length; j++) {
        if (overlaps(savedToday[i], savedToday[j])) {
          var a = savedToday[i],
            b = savedToday[j];
          if (!ackedPairs.has(_pairKey(a.id, b.id))) {
            _conflicts.push([a, b]);
          }
          (_byId[a.id] = _byId[a.id] || []).push(b.name);
          (_byId[b.id] = _byId[b.id] || []).push(a.name);
        }
      }
    }
    return {
      conflicts: _conflicts,
      conflictById: _byId
    };
  }, [savedToday, ackedPairs]);
  var gridLead = viewMode === "grid" && !(filter === "saved" && state.saved.length === 0);
  React.useEffect(() => {
    var g = viewMode === "grid";
    setState(s => !!s.lineupGrid === g ? s : {
      ...s,
      lineupGrid: g
    });
  }, [viewMode]);
  var online = useOnlineStatus();
  var otherFilterCount = (tierFilter !== "all" ? 1 : 0) + (stageFilter !== "all" ? 1 : 0) + (genreFilter !== "all" ? 1 : 0) + (sortBy !== "time" ? 1 : 0);
  var textBtn = {
    ...fieldIconBtn,
    width: "auto",
    padding: "0 8px",
    color: "var(--text-2)",
    fontSize: 15,
    fontWeight: 500
  };
  var [nowOff, setNowOff] = React.useState(false);
  React.useEffect(() => {
    if (viewMode !== "list") return undefined;
    var root = document.querySelector("[data-lineup-scroll]");
    var rule = document.querySelector("[data-now-rule]");
    if (!root || !rule || typeof IntersectionObserver !== "function") {
      setNowOff(false);
      return undefined;
    }
    var io = new IntersectionObserver(([e]) => setNowOff(!e.isIntersecting), {
      root
    });
    io.observe(rule);
    return () => io.disconnect();
  }, [viewMode, day, dayArtists, filter, sortBy]);
  var searchRow = React.createElement("div", {
    style: {
      padding: gridLead ? "12px 12px 0" : "12px 20px 4px"
    }
  }, React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, React.createElement("svg", {
    "aria-hidden": "true",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-2)",
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      position: "absolute",
      left: 14,
      pointerEvents: "none"
    }
  }, React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), React.createElement("path", {
    d: "M21 21 L16.65 16.65"
  })), React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search artists, stages, genres…",
    "aria-label": "Search the lineup",
    style: {
      width: "100%",
      boxSizing: "border-box",
      height: 44,
      padding: "0 44px 0 40px",
      borderRadius: 14,
      border: "none",
      background: "var(--paper-2)",
      color: "var(--ink)",
      fontSize: 15,
      outline: "none",
      fontFamily: "inherit"
    }
  }), q && React.createElement("button", {
    onClick: () => setQ(""),
    "aria-label": "Clear search",
    style: {
      ...fieldIconBtn,
      position: "absolute",
      right: 0,
      color: "var(--text-2)"
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, React.createElement("path", {
    d: "M6 6 L18 18 M18 6 L6 18"
  })))));
  var actionsRow = React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      padding: gridLead ? "4px 4px 8px 12px" : "4px 12px 4px 20px",
      gap: 4
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      fontVariantNumeric: "tabular-nums"
    }
  }, dayArtists.length, " ", dayArtists.length === 1 ? "set" : "sets"), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, totalSaved >= 2 && (() => {
    var clash = dayStats.some(d => d.clashes > 0);
    return React.createElement("button", {
      onClick: () => setWizardOpen(true),
      style: {
        ...textBtn,
        color: clash ? "var(--warn)" : "var(--ink)",
        fontWeight: 600
      }
    }, clash ? "⚠ My night" : "My night");
  })(), state.saved.length > 0 && React.createElement(ShareLineupButton, {
    state: state
  }), state.saved.length > 0 && React.createElement("button", {
    onClick: () => {
      window.plurskyHaptic?.("LIGHT");
      exportSavedSetsICS(state.saved);
    },
    style: textBtn
  }, "Calendar"), React.createElement("button", {
    onClick: () => {
      var savedArtists = ARTISTS.filter(a => state.saved.includes(a.id));
      var savedGenres = new Set(savedArtists.map(a => a.genre));
      var unsaved = ARTISTS.filter(a => !state.saved.includes(a.id));
      var pool = savedGenres.size ? unsaved.filter(a => savedGenres.has(a.genre)) : unsaved;
      if (!(pool.length ? pool : unsaved).length) return;
      var pick = (pool.length ? pool : unsaved)[Math.floor(Math.random() * (pool.length || unsaved.length))];
      setState({
        ...state,
        artist: pick.id
      });
    },
    title: "Discover a random artist that matches your taste",
    style: textBtn
  }, "Surprise me")));
  var conflictCard = conflicts.length > 0 && filter === "saved" ? React.createElement(ConflictResolver, {
    conflicts: conflicts,
    onKeep: (keepId, dropId) => {
      setState({
        ...state,
        saved: state.saved.filter(id => id !== dropId)
      });
    },
    onKeepBoth: pair => ackPair(pair[0].id, pair[1].id),
    onSplit: pair => setState({
      ...state,
      tab: "map",
      focusStage: pair[0].stage
    })
  }) : null;
  var vibeCard = stageFilter !== "all" ? (() => {
    var stage = STAGES.find(s => s.id === stageFilter);
    if (!stage?.vibe) return null;
    return React.createElement("div", {
      style: {
        margin: gridLead ? "0 12px 12px" : "4px 20px 12px",
        padding: "12px 14px",
        borderRadius: 14,
        background: "var(--paper-2)"
      }
    }, React.createElement("div", {
      style: {
        ..._fieldEyebrow,
        color: "var(--text-2)"
      }
    }, React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 7,
        height: 7,
        borderRadius: 4,
        background: stage.color
      }
    }), stage.name, " · ", stage.vibe, stage.peak ? ` · peaks ${stage.peak}` : ""), stage.desc && React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: "18px",
        color: "var(--text-2)"
      }
    }, stage.desc), stage.vibeNote && React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 15,
        lineHeight: "21px"
      }
    }, stage.vibeNote));
  })() : null;
  var saveDayCard = savedToday.length === 0 ? (() => {
    var dayTopPicks = lineupFor(weekendFilter).filter(a => a.day === day && a.tier === 3);
    if (dayTopPicks.length === 0) return null;
    var dayLabel = FESTIVAL_CONFIG.dayDates?.[day]?.name || DAYS.find(d => d.n === day)?.label || `Day ${day}`;
    var topPickIds = dayTopPicks.map(a => a.id);
    var save = () => setState(s => ({
      ...s,
      saved: [...new Set([...s.saved, ...topPickIds])]
    }));
    return React.createElement("button", {
      "data-save-day": true,
      onClick: save,
      style: {
        width: gridLead ? "calc(100% - 24px)" : "100%",
        margin: gridLead ? "0 12px 12px" : "12px 0",
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        background: "var(--paper-2)",
        color: "var(--ink)",
        border: "none",
        borderRadius: 14,
        padding: "10px 16px",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit"
      }
    }, React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("span", {
      style: {
        display: "block",
        fontSize: 15,
        lineHeight: "21px",
        fontWeight: 600
      }
    }, "Save all top picks for ", dayLabel), React.createElement("span", {
      style: {
        display: "block",
        fontSize: 13,
        lineHeight: "18px",
        color: "var(--text-2)"
      }
    }, dayTopPicks.length, " headliner", dayTopPicks.length === 1 ? "" : "s")), React.createElement("span", {
      style: {
        fontSize: 15,
        lineHeight: "20px",
        fontWeight: 600,
        flexShrink: 0
      }
    }, "Save"));
  })() : null;
  return React.createElement(Screen, {
    bg: "var(--paper)"
  }, React.createElement("div", {
    "data-lineup-header": true,
    "data-collapsed": collapsed ? "1" : "0",
    style: {
      padding: collapsed ? "0 8px 0 20px" : "4px 8px 4px 20px",
      display: "flex",
      alignItems: "center",
      gap: 4,
      maxHeight: collapsed ? 0 : 96,
      minHeight: 0,
      opacity: collapsed ? 0 : 1,
      overflow: "hidden",
      flexShrink: 0,
      transform: collapsed ? "translateY(-6px)" : "translateY(0)",
      transition: "max-height 220ms ease, opacity 160ms ease, padding 220ms ease, transform 220ms ease",
      pointerEvents: collapsed ? "none" : "auto"
    }
  }, state._navStack?.length > 0 && React.createElement("button", {
    onClick: () => window._popNav?.(),
    "aria-label": "Go back",
    style: {
      ...fieldIconBtn,
      marginLeft: -12
    }
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
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      ..._fieldEyebrow,
      color: "var(--text-2)"
    }
  }, FESTIVAL_CONFIG.brand, " · ", FESTIVAL_CONFIG.dates), React.createElement("h1", {
    style: {
      margin: "2px 0 0",
      fontSize: 28,
      lineHeight: "34px",
      fontWeight: 700,
      letterSpacing: "-0.01em"
    }
  }, "Lineup")), hasFeed && React.createElement("button", {
    "data-sched-check": true,
    onClick: () => setSyncOpen(true),
    "aria-label": "Check for schedule changes",
    style: textBtn
  }, "Updates"), React.createElement("button", {
    onClick: () => setViewMode(viewMode === "grid" ? "list" : "grid"),
    "aria-label": viewMode === "grid" ? "Show as list" : "Show as stage grid",
    style: fieldIconBtn
  }, React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, viewMode === "grid" ? React.createElement("path", {
    d: "M8 6 H20 M8 12 H20 M8 18 H20 M4 6 H4.5 M4 12 H4.5 M4 18 H4.5"
  }) : React.createElement("path", {
    d: "M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z"
  }))), React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "map",
      focusStage: stageFilter !== "all" ? stageFilter : undefined
    }),
    "aria-label": "Open map",
    style: fieldIconBtn
  }, React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z M9 4 V18 M15 6 V20"
  })))), React.createElement("div", {
    role: "tablist",
    "aria-label": "Festival day",
    style: {
      display: "flex",
      gap: 8,
      flexShrink: 0,
      padding: collapsed ? "4px 20px 8px" : "4px 20px 12px",
      transition: "padding 220ms ease"
    }
  }, dayStats.map(d => {
    var on = d.n === day;
    return React.createElement("button", {
      key: d.n,
      role: "tab",
      "aria-selected": on,
      "aria-label": `${d.label} ${d.date}${d.count ? `, ${d.count} saved` : ""}${d.clashes ? `, ${d.clashes} clash${d.clashes === 1 ? "" : "es"}` : ""}`,
      onClick: () => {
        setDay(d.n);
        setState(s => ({
          ...s,
          lineupDay: d.n
        }));
      },
      style: {
        flex: 1,
        minWidth: 0,
        minHeight: collapsed ? 44 : 64,
        padding: "6px 2px",
        borderRadius: 14,
        background: on ? "var(--paper-3)" : "transparent",
        border: on ? "1.5px solid var(--signal)" : "1px solid var(--line)",
        color: "var(--ink)",
        cursor: "pointer",
        display: "flex",
        flexDirection: collapsed ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: collapsed ? 6 : 1
      }
    }, React.createElement("span", {
      style: {
        fontSize: 11,
        lineHeight: "14px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        color: on ? "var(--ink)" : "var(--text-2)"
      }
    }, d.label), React.createElement("span", {
      style: {
        fontSize: collapsed ? 15 : 20,
        lineHeight: collapsed ? "20px" : "25px",
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums"
      }
    }, d.date.split(" ")[1]), !collapsed && d.count > 0 && React.createElement("span", {
      "aria-hidden": "true",
      style: {
        fontSize: 12,
        lineHeight: "16px",
        color: d.clashes ? "var(--warn)" : "var(--text-2)",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums"
      }
    }, d.clashes ? `${d.count} · ⚠` : `${d.count} saved`));
  })), hasWeekends && React.createElement("div", {
    role: "tablist",
    "aria-label": "Weekend",
    style: {
      display: "flex",
      gap: 8,
      padding: "0 20px 12px"
    }
  }, [{
    value: "W1",
    label: "Weekend 1"
  }, {
    value: "W2",
    label: "Weekend 2"
  }].map(w => {
    var on = weekendFilter === w.value;
    return React.createElement("button", {
      key: w.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => setWeekendFilter(w.value),
      style: {
        flex: 1,
        minHeight: 44,
        borderRadius: 14,
        cursor: "pointer",
        background: on ? "var(--paper-3)" : "transparent",
        border: on ? "1.5px solid var(--signal)" : "1px solid var(--line)",
        color: on ? "var(--ink)" : "var(--text-2)",
        fontSize: 15,
        lineHeight: "20px",
        fontWeight: 600
      }
    }, w.label);
  })), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 20px 12px",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Show",
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      background: "var(--paper-2)",
      borderRadius: 14
    }
  }, [{
    id: "all",
    label: "All stages"
  }, {
    id: "saved",
    label: "Saved"
  }, {
    id: "now",
    label: "Now"
  }].map(o => {
    var on = o.id === "all" ? filter === "all" && stageFilter === "all" : filter === o.id;
    return React.createElement("button", {
      key: o.id,
      role: "radio",
      "aria-checked": on,
      onClick: () => {
        setFilter(o.id);
        if (o.id === "all") setStageFilter("all");
      },
      style: {
        flex: o.id === "all" ? 1.4 : 1,
        minWidth: 0,
        minHeight: 44,
        borderRadius: 14,
        border: "none",
        cursor: "pointer",
        background: on ? "var(--paper-3)" : "transparent",
        boxShadow: on ? "inset 0 0 0 1.5px var(--signal)" : "none",
        color: on ? "var(--ink)" : "var(--text-2)",
        fontSize: 15,
        lineHeight: "20px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6
      }
    }, o.id === "now" && React.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 7,
        height: 7,
        borderRadius: 4,
        background: NOW.night === day ? "var(--signal)" : "var(--text-3)"
      }
    }), o.label);
  })), React.createElement("button", {
    onClick: () => setFilterSheetOpen(true),
    "aria-label": `Filters${otherFilterCount ? `, ${otherFilterCount} on` : ""}`,
    style: {
      ...fieldIconBtn,
      width: "auto",
      minWidth: 44,
      padding: "0 12px",
      gap: 6,
      background: "var(--paper-2)",
      fontSize: 15,
      fontWeight: 600
    }
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, React.createElement("path", {
    d: "M4 7 H20 M7 12 H17 M10 17 H14"
  })), otherFilterCount > 0 && React.createElement("span", {
    style: {
      fontVariantNumeric: "tabular-nums"
    }
  }, otherFilterCount))), !online && React.createElement("div", {
    role: "status",
    style: {
      padding: "8px 20px",
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      borderBottom: "1px solid var(--line)"
    }
  }, "Offline · showing the schedule saved on this phone"), !gridLead && searchRow, !gridLead && actionsRow, wizardOpen && React.createElement(NightWizard, {
    state: state,
    setState: setState,
    onClose: () => setWizardOpen(false)
  }), !gridLead && conflictCard, !gridLead && vibeCard, React.createElement(ScrollBody, {
    "data-lineup-scroll": true,
    ref: useStaggerFade(`${day}-${viewMode}-${filter}-${stageFilter}-${tierFilter}-${genreFilter}-${sortBy}-${weekendFilter}`),
    style: viewMode === "grid" ? {
      overflowY: "hidden",
      display: "flex",
      flexDirection: "column",
      padding: 0
    } : {
      padding: "0 20px 96px"
    }
  }, !gridLead && saveDayCard, gridLead && (() => {
    var dayMeta = DAYS.find(x => x.n === day);
    var dayArt = lineupFor(weekendFilter).filter(a => a.day === day).filter(a => weekendFilter === "all" || a.weekend === weekendFilter || a.weekend === "both");
    return React.createElement("div", {
      ref: el => {
        gridSectionRefs.current[day] = el;
      },
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0
      }
    }, React.createElement(TimelineGrid, {
      lead: React.createElement(React.Fragment, null, searchRow, actionsRow, conflictCard, vibeCard, saveDayCard),
      day: day,
      allDayArtists: dayArt,
      state: state,
      setState: setState,
      matchesActive: matchesActive,
      conflictById: conflictById,
      spotifyMatchedIds: spotifyMatchedIds,
      highlightId: highlightId
    })));
  })(), viewMode === "list" && dayArtists.length === 0 && (() => {
    var term = q.trim();
    var empty = term ? {
      title: `No matches for “${term}”`,
      sub: _otherDayHits > 0 ? `${_otherDayHits} match${_otherDayHits === 1 ? "" : "es"} on another day.` : "No artist, stage or genre by that name.",
      action: "Clear search",
      onAction: () => setQ("")
    } : _chipFilterActive ? {
      title: _emptyChipLabel ? `Nothing on ${_emptyChipLabel} yet` : "Nothing matches those filters",
      sub: _emptyChipLabel ? "Nothing there on this day." : "Try clearing one of them.",
      action: "Clear filters",
      onAction: () => {
        setTierFilter("all");
        setStageFilter("all");
        setGenreFilter("all");
      }
    } : filter === "now" ? {
      title: "Nothing is on right now",
      sub: NOW.night === day ? "Between sets on this day." : "This day isn't live right now.",
      action: "Show all sets",
      onAction: () => setFilter("all")
    } : {
      title: state.saved.length === 0 ? "No sets saved yet" : "Nothing saved for this day",
      sub: state.saved.length === 0 ? "Tap the save button on any set to add it." : "Switch to All stages to browse.",
      action: filter !== "all" ? "Show all sets" : null,
      onAction: () => setFilter("all")
    };
    return React.createElement("div", {
      style: {
        padding: "40px 0"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 17,
        lineHeight: "22px",
        fontWeight: 600
      }
    }, empty.title), React.createElement("div", {
      style: {
        marginTop: 4,
        fontSize: 15,
        lineHeight: "21px",
        color: "var(--text-2)"
      }
    }, empty.sub), empty.action && React.createElement(FieldButton, {
      kind: "secondary",
      onClick: empty.onAction,
      style: {
        marginTop: 16
      }
    }, empty.action));
  })(), viewMode === "grid" && filter === "saved" && state.saved.length === 0 && React.createElement("div", {
    style: {
      padding: "40px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 17,
      lineHeight: "22px",
      fontWeight: 600
    }
  }, "No sets saved yet"), React.createElement("div", {
    style: {
      marginTop: 4,
      fontSize: 15,
      lineHeight: "21px",
      color: "var(--text-2)"
    }
  }, "Switch to All stages and tap any set to save it."), React.createElement(FieldButton, {
    kind: "secondary",
    onClick: () => setFilter("all"),
    style: {
      marginTop: 16
    }
  }, "Show all sets")), viewMode === "list" && (() => {
    var nowMin = NOW.night === day && NOW.time && sortBy === "time" ? toNightMin(NOW.time) : null;
    var rows = dayArtists.map(a => {
      var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
      var saved = state.saved.includes(a.id);
      var clashWith = conflictById[a.id];
      var isHighlighted = highlightId === a.id;
      var isLive = isSetLive(a);
      var crew = window.sbGetCrewCount?.(a.id) || 0;
      var flags = [isLegendary(a) && "Don't miss", hasWeekends && a.weekend && a.weekend !== "both" && (a.weekend === "W1" ? "Weekend 1" : "Weekend 2"), spotifyMatchedIds.has(a.id) && "In your music", crew > 0 && `${crew} crew`].filter(Boolean);
      return React.createElement("div", {
        key: a.id,
        "data-animate": true,
        "data-lineup-highlight": isHighlighted ? "true" : undefined,
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          minHeight: 64,
          padding: "12px 8px",
          margin: "0 -8px",
          borderBottom: "1px solid var(--line)",
          borderRadius: isHighlighted ? 14 : 0,
          animation: isHighlighted ? "lineupFlash 1.8s ease-out" : undefined
        }
      }, React.createElement("div", {
        style: {
          width: 76,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap"
        }
      }, React.createElement("div", {
        style: {
          fontSize: 15,
          lineHeight: "21px",
          fontWeight: 600
        }
      }, fmt12(a.start)), React.createElement("div", {
        style: {
          fontSize: 13,
          lineHeight: "18px",
          color: "var(--text-2)"
        }
      }, fmt12(a.end))), React.createElement("button", {
        onClick: () => setState({
          ...state,
          artist: a.id
        }),
        style: {
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          padding: 0,
          background: "transparent",
          border: "none",
          color: "var(--ink)",
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start"
        }
      }, isLive && React.createElement("span", {
        style: {
          ..._fieldEyebrow,
          color: "var(--signal)",
          marginBottom: 2
        }
      }, React.createElement("span", {
        "aria-hidden": "true",
        style: {
          width: 7,
          height: 7,
          borderRadius: 4,
          background: "var(--signal)"
        }
      }), "Live"), React.createElement("span", {
        style: {
          fontSize: 17,
          lineHeight: "22px",
          fontWeight: 600,
          overflowWrap: "anywhere"
        }
      }, a.name), React.createElement("span", {
        style: {
          marginTop: 2,
          fontSize: 13,
          lineHeight: "18px",
          color: "var(--text-2)"
        }
      }, React.createElement("span", {
        "aria-hidden": "true",
        style: {
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: 4,
          background: stage.color,
          marginRight: 6,
          verticalAlign: "1px"
        }
      }), stage.name, a.genre ? ` · ${a.genre}` : ""), flags.length > 0 && React.createElement("span", {
        style: {
          marginTop: 2,
          fontSize: 13,
          lineHeight: "18px",
          color: "var(--text-2)"
        }
      }, flags.join(" · ")), clashWith && React.createElement("span", {
        style: {
          marginTop: 2,
          fontSize: 13,
          lineHeight: "18px",
          fontWeight: 600,
          color: "var(--warn)"
        }
      }, "⚠ Clashes with ", clashWith.join(", "))), React.createElement("button", {
        onClick: () => toggleSave(state, setState, a.id),
        "aria-label": saved ? `Unsave ${a.name}` : `Save ${a.name}`,
        "aria-pressed": saved,
        style: {
          ...fieldIconBtn,
          color: saved ? "var(--signal)" : "var(--text-2)"
        }
      }, React.createElement("svg", {
        width: "22",
        height: "22",
        viewBox: "0 0 24 24",
        fill: saved ? "currentColor" : "none",
        stroke: "currentColor",
        strokeWidth: "1.8",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }, React.createElement("path", {
        d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
      }))));
    });
    if (nowMin != null && dayArtists.length) {
      var i = dayArtists.findIndex(a => toNightMin(a.start) > nowMin);
      rows.splice(i === -1 ? rows.length : i, 0, React.createElement("div", {
        key: "__now",
        "data-now-rule": true,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 0"
        }
      }, React.createElement("span", {
        "aria-hidden": "true",
        style: {
          width: 8,
          height: 8,
          borderRadius: 4,
          background: "var(--signal)",
          flexShrink: 0
        }
      }), React.createElement("span", {
        style: {
          ..._fieldEyebrow,
          color: "var(--signal)",
          fontVariantNumeric: "tabular-nums"
        }
      }, "Now · ", fmt12(NOW.time)), React.createElement("span", {
        "aria-hidden": "true",
        style: {
          flex: 1,
          height: 1,
          background: "var(--signal)"
        }
      })));
    }
    return rows;
  })()), NOW.night === day && NOW.time && (viewMode === "grid" || nowOff && filter !== "now" && sortBy === "time") && React.createElement("button", {
    onClick: () => {
      if (viewMode === "grid") {
        var el = document.querySelector("[data-grid-scroll]");
        var nowMin = toNightMin(NOW.time);
        if (el && nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN) {
          var lead = el.querySelector("[data-grid-lead]");
          var top = (lead ? lead.offsetHeight : 0) + (nowMin - GRID_START_MIN) * GRID_PX_PER_MIN - 120;
          el.scrollTo({
            top: Math.max(0, top),
            behavior: "smooth"
          });
        }
      } else {
        var r = document.querySelector("[data-now-rule]");
        if (r) try {
          r.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        } catch {}
      }
    },
    "aria-label": "Jump to now",
    style: {
      position: "absolute",
      right: 16,
      bottom: viewMode === "grid" ? 16 : 76,
      zIndex: 8,
      minHeight: 44,
      padding: "0 16px 0 14px",
      borderRadius: 22,
      background: "var(--chrome)",
      border: "1px solid var(--line-2)",
      color: "var(--ink)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      fontSize: 15,
      lineHeight: "20px",
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: "var(--signal)"
    }
  }), "Now"), filterSheetOpen && React.createElement(LineupFilterSheet, {
    day: day,
    dayGenres: dayGenres,
    savedIds: state.saved || [],
    weekendFilter: weekendFilter,
    initial: {
      filter,
      tierFilter,
      stageFilter,
      genreFilter,
      sortBy
    },
    onClose: () => setFilterSheetOpen(false),
    onApply: f => {
      setFilter(f.filter);
      setTierFilter(f.tierFilter);
      setStageFilter(f.stageFilter);
      setGenreFilter(f.genreFilter);
      setSortBy(f.sortBy);
      setFilterSheetOpen(false);
    },
    onReset: () => {
      setFilter("all");
      setTierFilter("all");
      setStageFilter("all");
      setGenreFilter("all");
      setSortBy("time");
      setFilterSheetOpen(false);
    }
  }), syncOpen && React.createElement(ScheduleReviewSheet, {
    saved: state.saved || [],
    onClose: () => setSyncOpen(false)
  }));
}
function _schedSlotText(slot, cfg) {
  if (!slot) return "";
  var d = cfg.dayDates && cfg.dayDates[slot.day];
  var st = slot.stage && STAGES.find(s => s.id === slot.stage);
  var wk = slot.weekend && slot.weekend !== "both" ? `${slot.weekend} · ` : "";
  return `${wk}${d ? d.short : `DAY ${slot.day}`} · ${slot.start ? fmt12(slot.start) : "time TBA"} · ${st ? st.name : "stage TBA"}`;
}
function _schedObserved(src) {
  var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(src && src.observedAt || "");
  if (!m) return "";
  var mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1];
  return m[3] ? `${mon} ${+m[3]}` : `${mon} ${m[1]}`;
}
function ScheduleReviewSheet({
  saved,
  onClose
}) {
  var cfg = FESTIVAL_CONFIG,
    fid = cfg.id;
  var {
    perm
  } = useNotifications();
  var [st, setSt] = React.useState({
    phase: "checking"
  });
  var [showAll, setShowAll] = React.useState(false);
  var check = React.useCallback(() => {
    setSt({
      phase: "checking"
    });
    fetchScheduleFeed(fid).then(feed => {
      var r = scheduleReview(fid, feed, {
        saved,
        remindersOn: perm === "granted",
        leadMin: getReminderLeadMin()
      });
      setSt(r.error ? {
        phase: "error"
      } : {
        phase: r.upToDate ? "current" : "ready",
        r
      });
    }, () => setSt({
      phase: "error"
    }));
  }, [fid, perm]);
  React.useEffect(() => {
    check();
  }, [check]);
  var apply = () => {
    var next = applyScheduleReview(st.r, saved);
    try {
      localStorage.setItem(`${fid}_saved_v1`, JSON.stringify(next));
    } catch {}
    window.location.reload();
  };
  var r = st.r;
  var mono = {
    fontFamily: "'Geist Mono', monospace",
    letterSpacing: 1.2,
    fontWeight: 700
  };
  var btn = (label, onClick, primary) => React.createElement("button", {
    key: label,
    onClick: onClick,
    style: {
      ...mono,
      fontSize: 10,
      minHeight: 40,
      padding: "0 16px",
      borderRadius: 999,
      flexShrink: 0,
      cursor: "pointer",
      border: primary ? "none" : "1px solid var(--line-2)",
      background: primary ? "var(--ink)" : "transparent",
      color: primary ? "var(--paper)" : "var(--ink)"
    }
  }, label);
  var tz = cfg.tz;
  var clock = ms => new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(tz ? {
      timeZone: tz
    } : {})
  });
  var KIND = {
    day: "DAY",
    stage: "STAGE",
    start: "TIME",
    end: "END",
    weekend: "WEEKEND",
    cancelled: "CANCELLED",
    added: "NEW"
  };
  var row = (c, notes = []) => React.createElement("div", {
    key: c.id,
    "data-sched-change": c.id,
    "data-sched-kinds": c.kinds.join(","),
    style: {
      padding: "10px 0",
      borderTop: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      fontWeight: 600,
      color: "var(--ink)",
      overflowWrap: "anywhere"
    }
  }, c.name), React.createElement("div", {
    style: {
      ...mono,
      fontSize: 8,
      flexShrink: 0,
      color: c.after ? "var(--muted)" : "var(--ember-ink)"
    }
  }, c.kinds.map(k => KIND[k]).join(" · "))), c.before && React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink)",
      opacity: 0.5,
      marginTop: 2,
      textDecoration: c.after ? "line-through" : "none"
    }
  }, _schedSlotText(c.before, cfg)), c.after && React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink)",
      marginTop: 2
    }
  }, c.before ? "→ " : "", _schedSlotText(c.after, cfg)), notes.map((n, i) => React.createElement("div", {
    key: i,
    "data-sched-note": true,
    style: {
      fontSize: 11,
      color: "var(--ember-ink)",
      marginTop: 3,
      lineHeight: 1.35
    }
  }, n)));
  var head = (label, n) => React.createElement("div", {
    style: {
      ...mono,
      fontSize: 9,
      color: "var(--muted)",
      marginTop: 16,
      marginBottom: 2
    }
  }, label, n != null ? ` · ${n}` : "");
  var notesFor = c => {
    var out = [];
    if (!c.after) out.push("Cancelled, so it comes out of your plan.");
    for (var [a, b] of r.clashes) if (a.id === c.id || b.id === c.id) out.push(`Now clashes with ${(a.id === c.id ? b : a).name}.`);
    var rem = r.reminders.find(x => x.id === c.id);
    if (rem) out.push(rem.to == null ? "Its reminder is cancelled." : rem.from == null ? `New reminder at ${clock(rem.to)}.` : `Reminder moves to ${clock(rem.to)}.`);
    return out;
  };
  var src = r && r.source,
    observed = _schedObserved(src);
  var host = "";
  try {
    host = src && src.url ? new URL(src.url).hostname.replace(/^www\./, "") : "";
  } catch {}
  var basis = src ? [src.official ? "Official schedule" : `Source: ${host || "community"}`, observed && `observed ${observed}`].filter(Boolean).join(" · ") : "";
  var others = r && !r.upToDate ? r.shown.changes.filter(c => !saved.includes(c.id)) : [];
  var counts = r && r.shown.counts;
  var moved = r ? r.shown.changes.filter(c => c.before && c.after).length : 0;
  var title, body, actions;
  if (st.phase === "checking") {
    title = "Checking the published schedule…";
    actions = [btn("CLOSE", onClose)];
  } else if (st.phase === "error") {
    title = "Couldn't reach the schedule";
    body = React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--ink)",
        opacity: 0.7,
        marginTop: 6,
        lineHeight: 1.45
      }
    }, "Check your connection and try again. Your lineup hasn't changed.");
    actions = [btn("CLOSE", onClose), btn("RETRY", check, true)];
  } else if (st.phase === "current") {
    title = "You have the latest schedule";
    actions = [btn("DONE", onClose, true)];
  } else {
    var n = r.shown.changes.length;
    title = `${n} change${n === 1 ? "" : "s"} to the ${cfg.shortName || cfg.brand} schedule`;
    body = React.createElement(React.Fragment, null, React.createElement("div", {
      "data-sched-counts": true,
      style: {
        fontSize: 12,
        color: "var(--ink)",
        opacity: 0.7,
        marginTop: 4
      }
    }, [moved && `${moved} moved`, counts.cancelled && `${counts.cancelled} cancelled`, counts.added && `${counts.added} added`].filter(Boolean).join(" · ")), React.createElement("div", {
      "data-sched-section": "plan"
    }, head("YOUR PLAN", r.savedChanges.length), r.savedChanges.length ? r.savedChanges.map(c => row(c, notesFor(c))) : React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--ink)",
        opacity: 0.6,
        padding: "8px 0",
        borderTop: "1px solid var(--line)"
      }
    }, "None of your saved sets change.")), r.clashes.length > 0 && React.createElement("div", {
      "data-sched-section": "clashes"
    }, head("NEW CLASHES", r.clashes.length), r.clashes.map(([a, b]) => React.createElement("div", {
      key: a.id + b.id,
      "data-sched-clash": `${a.id}|${b.id}`,
      style: {
        padding: "9px 0",
        borderTop: "1px solid var(--line)",
        fontSize: 13,
        color: "var(--ink)",
        lineHeight: 1.4
      }
    }, React.createElement("b", null, a.name), " and ", React.createElement("b", null, b.name), " overlap", React.createElement("div", {
      style: {
        fontSize: 11,
        opacity: 0.55
      }
    }, cfg.dayDates && cfg.dayDates[a.day] ? cfg.dayDates[a.day].short : `DAY ${a.day}`, " · ", fmt12(a.start), "–", fmt12(a.end), " and ", fmt12(b.start), "–", fmt12(b.end))))), others.length > 0 && React.createElement("div", {
      "data-sched-section": "other"
    }, head("OTHER CHANGES", others.length), (showAll ? others : others.slice(0, 6)).map(c => row(c)), !showAll && others.length > 6 && React.createElement("button", {
      onClick: () => setShowAll(true),
      style: {
        ...mono,
        fontSize: 9,
        background: "none",
        border: "none",
        color: "var(--ember-ink)",
        padding: "8px 0",
        cursor: "pointer"
      }
    }, "SHOW ALL ", others.length)));
    actions = [btn("NOT NOW", onClose), btn("APPLY UPDATE", apply, true)];
  }
  return ReactDOM.createPortal(React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 9000,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center"
    }
  }, React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Schedule update",
    "data-sched-phase": st.phase,
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "86vh",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      background: "var(--paper)",
      borderRadius: "18px 18px 0 0"
    }
  }, React.createElement("div", {
    style: {
      overflowY: "auto",
      padding: "16px 18px 8px"
    }
  }, React.createElement("div", {
    style: {
      ...mono,
      fontSize: 9,
      color: "var(--ember-ink)"
    }
  }, "SCHEDULE UPDATE"), React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', serif",
      fontSize: 22,
      color: "var(--ink)",
      marginTop: 3,
      lineHeight: 1.15
    }
  }, title), basis && React.createElement("div", {
    "data-sched-basis": true,
    style: {
      fontSize: 11,
      color: "var(--ink)",
      opacity: 0.5,
      marginTop: 4
    }
  }, basis), body), React.createElement("div", {
    style: {
      padding: "10px 18px calc(14px + env(safe-area-inset-bottom))",
      borderTop: "1px solid var(--line)"
    }
  }, st.phase === "ready" && React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--ink)",
      opacity: 0.55,
      marginBottom: 8,
      lineHeight: 1.4
    }
  }, "Nothing changes until you apply. Your saved sets and reminders then follow the new times."), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end"
    }
  }, actions)))), document.body);
}
function toNightMin(hhmm) {
  var [h, m] = hhmm.split(":").map(Number);
  return (h < 8 ? h + 24 : h) * 60 + m;
}
function overlaps(a, b) {
  var aS = toNightMin(a.start),
    aE = toNightMin(a.end);
  var bS = toNightMin(b.start),
    bE = toNightMin(b.end);
  return aS < bE && bS < aE;
}
function layoutLanes(sets) {
  var items = sets.map(a => ({
    a,
    s: toNightMin(a.start),
    e: toNightMin(a.end)
  })).sort((x, y) => x.s - y.s || x.e - y.e);
  var result = {};
  var cluster = [];
  var clusterEnd = -Infinity;
  var flush = () => {
    if (!cluster.length) return;
    var colEnds = [];
    cluster.forEach(it => {
      var placed = false;
      for (var c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= it.s) {
          colEnds[c] = it.e;
          it.lane = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        it.lane = colEnds.length;
        colEnds.push(it.e);
      }
    });
    var lanes = colEnds.length;
    cluster.forEach(it => {
      result[it.a.id] = {
        lane: it.lane,
        lanes
      };
    });
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
var _gridBounds = (() => {
  var all = typeof ARTISTS !== "undefined" ? ARTISTS : [];
  if (!all.length) return {
    start: 19 * 60,
    end: (24 + 5) * 60 + 30
  };
  var lo = Infinity,
    hi = -Infinity;
  all.forEach(a => {
    var s = toNightMin(a.start),
      e = toNightMin(a.end);
    if (s < lo) lo = s;
    if (e > hi) hi = e;
  });
  return {
    start: Math.floor(lo / 60) * 60,
    end: Math.ceil(hi / 60) * 60
  };
})();
var GRID_START_MIN = _gridBounds.start;
var GRID_END_MIN = _gridBounds.end;
var GRID_PX_PER_MIN = 1.8;
var GRID_TOTAL_H = (GRID_END_MIN - GRID_START_MIN) * GRID_PX_PER_MIN;
var GRID_HEADER_H = 30;
function _minToTop(m) {
  return (Math.max(GRID_START_MIN, Math.min(GRID_END_MIN, m)) - GRID_START_MIN) * GRID_PX_PER_MIN;
}
function SavedSidebar({
  day,
  state,
  setState
}) {
  var saved = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && a.day === day).sort((a, b) => a.start.localeCompare(b.start));
  var unsave = (id, e) => {
    e.stopPropagation();
    setState(s => ({
      ...s,
      saved: s.saved.filter(x => x !== id)
    }));
  };
  return React.createElement("div", {
    style: {
      flex: "0 0 100px",
      boxSizing: "border-box",
      borderRight: "1px solid var(--line)",
      background: "var(--paper)",
      position: "relative"
    }
  }, React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 5,
      height: GRID_HEADER_H,
      display: "flex",
      alignItems: "center",
      padding: "0 8px",
      background: "var(--paper)",
      borderBottom: "1px solid var(--line-2)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      fontWeight: 700
    }
  }, "MY SETS · ", saved.length)), React.createElement("div", {
    style: {
      position: "relative",
      height: GRID_TOTAL_H
    }
  }, saved.length === 0 ? React.createElement("div", {
    style: {
      position: "absolute",
      top: 14,
      left: 6,
      right: 6,
      padding: "10px 6px",
      textAlign: "center",
      fontSize: 9,
      lineHeight: 1.3,
      color: "var(--muted)",
      border: "1px dashed var(--line-2)",
      borderRadius: 8
    }
  }, "Tap any set in the grid to add") : saved.map(a => {
    var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
    var startMin = toNightMin(a.start);
    var endMin = toNightMin(a.end);
    var top = _minToTop(startMin);
    var blockH = Math.max(34, _minToTop(endMin) - top);
    var isLive = isSetLive(a);
    return React.createElement("button", {
      key: a.id,
      onClick: () => setState(s => ({
        ...s,
        artist: a.id
      })),
      style: {
        position: "absolute",
        top,
        left: 4,
        right: 4,
        height: blockH,
        display: "flex",
        alignItems: "stretch",
        gap: 5,
        padding: "4px 4px 4px 5px",
        background: stage ? `${stage.color}1a` : "var(--paper-2)",
        border: isLive ? "1px solid var(--success)" : `1px solid ${stage?.color || "var(--line-2)"}40`,
        borderLeft: `3px solid ${stage?.color || "var(--line-2)"}`,
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden"
      }
    }, React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1
      }
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--ink)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        lineHeight: 1.1
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 0.5,
        fontWeight: 600,
        color: isLive ? "var(--success)" : "var(--muted)"
      }
    }, isLive ? "● LIVE" : `${a.start}–${a.end}`)), React.createElement("span", {
      role: "button",
      "aria-label": `Remove ${a.name}`,
      onClick: e => unsave(a.id, e),
      style: {
        flexShrink: 0,
        width: 18,
        height: 18,
        borderRadius: 999,
        background: "rgba(0,0,0,0.06)",
        color: "var(--muted)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        alignSelf: "flex-start"
      }
    }, "×"));
  })));
}
function GridSetBlock({
  a,
  stage,
  state,
  setState,
  top,
  height,
  left,
  width,
  active,
  saved,
  clash,
  matched,
  isHighlighted,
  refStore,
  showEndTime,
  dueMins,
  narrow = false
}) {
  var isHeadliner = a.tier === 3;
  var _lineH = narrow ? 10.2 : isHeadliner ? 13.8 : 12.7;
  var _chrome = narrow ? 8 : 20;
  var nameLines = Math.max(1, Math.min(4, Math.floor((height - _chrome) / _lineH)));
  var fillAlpha = isHeadliner ? "38" : "22";
  var dimAlpha = isHeadliner ? "14" : "08";
  var _store = refStore;
  var _resetHold = e => {
    var el = e.currentTarget,
      fill = el.querySelector("[data-lpfill]");
    el.style.transform = "";
    if (fill) {
      fill.style.transition = "width .12s";
      fill.style.width = "0%";
    }
    if (_store.lp) {
      clearTimeout(_store.lp);
      _store.lp = null;
    }
  };
  return React.createElement("div", {
    "data-lineup-highlight": isHighlighted ? "true" : undefined,
    onClick: () => {
      if (_store.fired) {
        _store.fired = false;
        return;
      }
      setState({
        ...state,
        artist: a.id
      });
    },
    onPointerDown: e => {
      var el = e.currentTarget,
        fill = el.querySelector("[data-lpfill]");
      el.style.transform = "scale(0.97)";
      if (fill) {
        fill.style.transition = "none";
        fill.style.width = "0%";
        void fill.offsetWidth;
        fill.style.transition = "width 0.5s linear";
        fill.style.width = "100%";
      }
      try {
        window.plurskyHaptic?.("LIGHT");
        navigator.vibrate?.(8);
      } catch {}
      _store.lp = setTimeout(() => {
        _store.lp = null;
        _store.fired = true;
        el.style.transform = "";
        if (fill) {
          fill.style.transition = "none";
          fill.style.width = "0%";
        }
        toggleSave(state, setState, a.id);
      }, 500);
    },
    onPointerUp: _resetHold,
    onPointerLeave: _resetHold,
    onPointerCancel: _resetHold,
    style: {
      position: "absolute",
      top,
      left,
      width,
      height,
      background: `${stage.color}${active || isHighlighted ? fillAlpha : dimAlpha}`,
      borderLeft: `3px solid ${active || isHighlighted ? stage.color : stage.color + "44"}`,
      borderRadius: 6,
      padding: narrow ? "3px 3px 3px 4px" : "4px 6px 4px 7px",
      cursor: "pointer",
      overflow: "hidden",
      opacity: active || isHighlighted ? 1 : 0.32,
      transition: "opacity 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, border-left 0.2s ease, transform 0.12s ease",
      boxShadow: dueMins != null ? `0 0 0 2px var(--ember), 0 2px 12px ${stage.color}55` : clash && active ? "inset 0 0 0 1.5px var(--ember)" : isHeadliner && (active || isHighlighted) ? `0 2px 8px ${stage.color}33` : "none",
      zIndex: isHighlighted ? 6 : dueMins != null ? 5 : undefined,
      animation: isHighlighted ? "lineupFlash 1.8s ease-out" : undefined,
      display: "flex",
      flexDirection: "column"
    }
  }, React.createElement("div", {
    style: {
      fontSize: narrow ? 9.5 : isHeadliner ? 12.5 : 11.5,
      fontWeight: isHeadliner ? 800 : 700,
      lineHeight: narrow ? 1.05 : 1.1,
      color: "var(--ink)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "-webkit-box",
      WebkitLineClamp: nameLines,
      WebkitBoxOrient: "vertical",
      overflowWrap: "break-word",
      paddingRight: saved ? clash ? narrow ? 19 : 23 : narrow ? 9 : 12 : 0,
      fontFamily: isHeadliner ? "Instrument Serif, Georgia, serif" : "Geist, -apple-system, sans-serif"
    }
  }, a.name), !narrow && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 0.3,
      color: "var(--muted)",
      marginTop: 2,
      whiteSpace: "nowrap"
    }
  }, fmt12(a.start), showEndTime && height > 38 ? ` – ${fmt12(a.end)}` : ""), dueMins != null && height > 46 && React.createElement("div", {
    className: "mono",
    style: {
      marginTop: "auto",
      fontSize: 8,
      letterSpacing: 1,
      fontWeight: 800,
      color: "var(--ember-ink)",
      whiteSpace: "nowrap"
    }
  }, "YOU'RE DUE HERE · ", dueMins, " MIN"), saved && React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      right: 5,
      fontSize: 10,
      color: "var(--ember-ink)",
      fontWeight: 800,
      lineHeight: 1
    }
  }, "★"), clash && React.createElement("span", {
    title: "Overlaps another saved set",
    "aria-label": "clash",
    style: {
      position: "absolute",
      top: 2.5,
      right: narrow ? 13 : 16,
      fontSize: 9,
      color: "var(--ember-ink)",
      fontWeight: 800,
      lineHeight: 1
    }
  }, "⚠"), !saved && matched && height > 30 && React.createElement("span", {
    style: {
      position: "absolute",
      top: 4,
      right: 5,
      fontSize: 9,
      color: "#1DB954",
      fontWeight: 800,
      lineHeight: 1
    }
  }, "♫"), React.createElement("div", {
    "data-lpfill": true,
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: 0,
      bottom: 0,
      height: 3,
      width: "0%",
      background: stage.color,
      borderRadius: "0 0 6px 6px",
      pointerEvents: "none",
      zIndex: 3
    }
  }));
}
function GridHourLines({
  hours,
  minToTop
}) {
  return hours.map(h => React.createElement("div", {
    key: h.label,
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: minToTop(h.mins),
      height: 1,
      background: "var(--line)"
    }
  }));
}
function TimelineGrid({
  lead,
  day,
  allDayArtists,
  state,
  setState,
  matchesActive,
  conflictById,
  spotifyMatchedIds,
  highlightId
}) {
  var GUTTER_W = 44;
  var HEAD_H = 34;
  var TOTAL_H = GRID_TOTAL_H;
  var minToTop = _minToTop;
  var scrollRef = React.useRef(null);
  var leadRef = React.useRef(null);
  var _blockRefs = React.useRef({});
  var HOURS = [];
  for (var h = Math.floor(GRID_START_MIN / 60); h <= Math.floor(GRID_END_MIN / 60); h++) {
    var h24 = h % 24;
    var suffix = h24 < 12 ? "AM" : "PM";
    var h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    HOURS.push({
      label: `${h12} ${suffix}`,
      mins: h * 60
    });
  }
  var nowTop = null,
    nowMin = null;
  if (NOW.night === day && NOW.time) {
    nowMin = toNightMin(NOW.time);
    if (nowMin >= GRID_START_MIN && nowMin <= GRID_END_MIN) nowTop = minToTop(nowMin);
  }
  var cols = STAGES.map(s => ({
    stage: s,
    artists: allDayArtists.filter(a => a.stage === s.id)
  })).filter(c => c.artists.length > 0);
  var due = React.useMemo(() => {
    if (nowMin == null) return null;
    var mine = allDayArtists.filter(a => state.saved.includes(a.id)).map(a => ({
      a,
      start: toNightMin(a.start)
    })).filter(x => x.start >= nowMin).sort((x, y) => x.start - y.start);
    if (!mine.length) return null;
    return {
      id: mine[0].a.id,
      mins: Math.round(mine[0].start - nowMin),
      stageId: mine[0].a.stage
    };
  }, [allDayArtists, state.saved, nowMin]);
  var [boxW, setBoxW] = React.useState(375);
  React.useLayoutEffect(() => {
    var el = scrollRef.current;
    if (!el) return;
    var read = () => setBoxW(Math.max(240, Math.round(el.clientWidth || 375)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    var ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  var BAND = Math.round(Math.min(118, Math.max(92, boxW * 0.26)));
  var COL_W = Math.max(BAND, Math.floor((boxW - GUTTER_W) / Math.max(1, cols.length)));
  var showEndTime = COL_W >= 120;
  var narrow = COL_W < 72;
  var scrollToStage = id => {
    var i = cols.findIndex(c => c.stage.id === id);
    var el = scrollRef.current;
    if (i < 0 || !el) return;
    el.scrollTo({
      left: i * COL_W,
      behavior: "smooth"
    });
  };
  var didInit = React.useRef(false);
  React.useLayoutEffect(() => {
    var el = scrollRef.current;
    if (!el || didInit.current || !cols.length) return;
    didInit.current = true;
    var target = due ? toNightMin(ARTISTS.find(a => a.id === due.id)?.start || 0) : nowMin;
    if (target != null && target >= GRID_START_MIN && target <= GRID_END_MIN) {
      el.scrollTop = Math.max(0, (leadRef.current ? leadRef.current.offsetHeight : 0) + HEAD_H + minToTop(target) - 100);
    }
    if (due) {
      var i = cols.findIndex(c => c.stage.id === due.stageId);
      if (i > 0) el.scrollLeft = i * COL_W;
    }
  }, [cols.length, COL_W, due, nowMin, minToTop]);
  var savedByStage = React.useMemo(() => {
    var m = {};
    for (var a of allDayArtists) if (state.saved.includes(a.id)) m[a.stage] = (m[a.stage] || 0) + 1;
    return m;
  }, [allDayArtists, state.saved]);
  if (!cols.length && !lead) return null;
  return (React.createElement("div", {
      style: {
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column"
      }
    }, React.createElement("div", {
      ref: scrollRef,
      "data-grid-scroll": true,
      style: {
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain"
      }
    }, React.createElement("div", {
      style: {
        minWidth: GUTTER_W + cols.length * COL_W,
        position: "relative"
      }
    }, lead && React.createElement("div", {
      ref: leadRef,
      "data-grid-lead": true,
      style: {
        position: "sticky",
        left: 0,
        width: boxW,
        background: "var(--paper)"
      }
    }, lead), cols.length > 0 ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        display: "flex",
        position: "sticky",
        top: 0,
        zIndex: 8,
        height: HEAD_H
      }
    }, React.createElement("div", {
      style: {
        width: GUTTER_W,
        flexShrink: 0,
        position: "sticky",
        left: 0,
        zIndex: 2,
        background: "var(--paper)",
        borderRight: "1px solid var(--line)",
        borderBottom: "1px solid var(--line-2)"
      }
    }), cols.map(({
      stage: s
    }) => {
      var n = savedByStage[s.id] || 0;
      return React.createElement("button", {
        key: s.id,
        "data-stage-head": s.id,
        onClick: () => {
          try {
            window.plurskyHaptic?.("LIGHT");
          } catch {}
          scrollToStage(s.id);
        },
        title: s.name,
        className: "mono",
        style: {
          width: COL_W,
          flexShrink: 0,
          height: HEAD_H,
          border: "none",
          borderLeft: "1px solid var(--line)",
          borderBottom: "1px solid var(--line-2)",
          background: "var(--paper)",
          color: "var(--ink)",
          padding: "3px 5px 0",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          fontSize: 10,
          letterSpacing: 1.1,
          fontWeight: 800,
          fontFamily: "inherit"
        }
      }, React.createElement("span", {
        "aria-hidden": "true",
        style: {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 3,
          background: s.color
        }
      }), React.createElement("span", {
        style: {
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, s.short), n > 0 && React.createElement("span", {
        style: {
          flexShrink: 0,
          color: "var(--ember-ink)",
          fontSize: 8.5,
          fontWeight: 800
        }
      }, "★", n));
    })), React.createElement("div", {
      style: {
        display: "flex",
        position: "relative"
      }
    }, React.createElement("div", {
      style: {
        width: GUTTER_W,
        flexShrink: 0,
        position: "sticky",
        left: 0,
        height: TOTAL_H,
        zIndex: 4,
        background: "var(--paper)",
        borderRight: "1px solid var(--line)"
      }
    }, HOURS.map(h => React.createElement("div", {
      key: h.label,
      className: "mono",
      style: {
        position: "absolute",
        top: minToTop(h.mins) - 6,
        right: 6,
        fontSize: 9,
        letterSpacing: 0.3,
        color: "var(--muted)",
        fontWeight: 700
      }
    }, h.label)), nowTop != null && React.createElement("span", {
      className: "mono",
      style: {
        position: "absolute",
        left: 2,
        top: nowTop - 7,
        zIndex: 6,
        fontSize: 8,
        letterSpacing: 0.6,
        color: "#fff",
        fontWeight: 800,
        background: "var(--ember)",
        padding: "1px 4px",
        borderRadius: 3
      }
    }, "NOW")), cols.map(({
      stage,
      artists: stageArtists
    }, si) => {
      var lanes = layoutLanes(stageArtists);
      return React.createElement("div", {
        key: stage.id,
        style: {
          width: COL_W,
          flexShrink: 0,
          position: "relative",
          height: TOTAL_H,
          borderLeft: "1px solid var(--line)",
          background: si % 2 === 0 ? "transparent" : "rgba(26,18,13,0.018)"
        }
      }, React.createElement(GridHourLines, {
        hours: HOURS,
        minToTop: minToTop
      }), stageArtists.map(a => {
        var start = toNightMin(a.start);
        var end = toNightMin(a.end);
        var top = minToTop(start);
        var height = Math.max(24, minToTop(end) - top);
        var lay = lanes[a.id] || {
          lane: 0,
          lanes: 1
        };
        var laneGap = lay.lanes > 1 ? 1.5 : 0;
        var laneW = (COL_W - 4 - laneGap * (lay.lanes - 1)) / lay.lanes;
        var laneLeft = 2 + lay.lane * (laneW + laneGap);
        return React.createElement(GridSetBlock, {
          key: a.id,
          a: a,
          stage: stage,
          state: state,
          setState: setState,
          top: top,
          height: height,
          left: laneLeft,
          width: laneW,
          active: matchesActive(a),
          saved: state.saved.includes(a.id),
          clash: !!conflictById[a.id],
          matched: spotifyMatchedIds && spotifyMatchedIds.has && spotifyMatchedIds.has(a.id),
          isHighlighted: highlightId === a.id,
          refStore: _blockRefs.current[a.id] || (_blockRefs.current[a.id] = {
            lp: null,
            fired: false
          }),
          showEndTime: showEndTime && lay.lanes === 1,
          narrow: narrow || laneW < 72,
          dueMins: due && due.id === a.id ? due.mins : null
        });
      }));
    }), nowTop != null && React.createElement("div", {
      style: {
        position: "absolute",
        left: GUTTER_W,
        right: 0,
        top: nowTop,
        height: 0,
        borderTop: "2px solid var(--ember)",
        boxShadow: "0 0 8px rgba(232,93,46,0.55)",
        zIndex: 3,
        pointerEvents: "none"
      }
    }))) : React.createElement("div", {
      className: "mono",
      style: {
        position: "sticky",
        left: 0,
        width: boxW,
        padding: "28px 16px",
        textAlign: "center",
        fontSize: 10,
        letterSpacing: 1.2,
        color: "var(--muted)"
      }
    }, "NO SETS ON THIS DAY"))))
  );
}
function ConflictResolver({
  conflicts,
  onKeep,
  onKeepBoth,
  onSplit
}) {
  var [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (conflicts.length > 0) {
      try {
        navigator.vibrate([50, 30, 50]);
      } catch {}
      try {
        window.plurskyHaptic?.("HEAVY");
      } catch {}
    }
  }, [conflicts.length]);
  var safeIdx = Math.min(idx, Math.max(0, conflicts.length - 1));
  if (!conflicts.length) return null;
  var pair = conflicts[safeIdx];
  var [a, b] = pair;
  var sA = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
  var sB = STAGES.find(s => s.id === b.stage) || UNPLACED_STAGE;
  var overlapStart = a.start > b.start ? a.start : b.start;
  var overlapEnd = a.end < b.end ? a.end : b.end;
  var next = () => {
    setIdx(i => i + 1 < conflicts.length ? i + 1 : i);
  };
  var crBtn = {
    ...fieldIconBtn,
    width: "auto",
    padding: "0 10px",
    color: "var(--text-2)",
    fontSize: 15,
    fontWeight: 500
  };
  return React.createElement("div", {
    role: "group",
    "aria-label": "Schedule clash",
    style: {
      margin: "4px 20px 12px",
      padding: "12px 14px 4px",
      borderRadius: 14,
      background: "var(--paper-2)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      ..._fieldEyebrow,
      color: "var(--warn)"
    }
  }, "⚠ Clash ", safeIdx + 1, " of ", conflicts.length), React.createElement("span", {
    style: {
      fontSize: 13,
      lineHeight: "18px",
      color: "var(--text-2)",
      fontVariantNumeric: "tabular-nums"
    }
  }, "Overlap ", fmt12(overlapStart), "–", fmt12(overlapEnd))), [a, b].map((art, i) => {
    var stg = i === 0 ? sA : sB;
    return React.createElement("div", {
      key: art.id,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 56,
        borderBottom: "1px solid var(--line)"
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
        fontWeight: 600,
        overflowWrap: "anywhere"
      }
    }, art.name), React.createElement("div", {
      style: {
        fontSize: 13,
        lineHeight: "18px",
        color: "var(--text-2)",
        fontVariantNumeric: "tabular-nums"
      }
    }, stg.name, " · ", fmt12(art.start), "–", fmt12(art.end))), React.createElement("button", {
      onClick: () => onKeep(art.id, i === 0 ? b.id : a.id),
      style: {
        ...crBtn,
        color: "var(--ink)",
        fontWeight: 600
      }
    }, "Keep this"));
  }), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    onClick: () => onKeepBoth?.(pair),
    style: crBtn
  }, "Keep both"), React.createElement("button", {
    onClick: () => onSplit(pair),
    style: crBtn
  }, "Split the night"), conflicts.length > 1 && React.createElement("button", {
    onClick: next,
    style: crBtn
  }, "Next clash")));
}
function TierStars({
  tier
}) {
  var colors = {
    3: "#f59a36",
    2: "var(--muted)",
    1: "var(--text-3)"
  };
  return React.createElement("span", {
    style: {
      display: "inline-flex",
      gap: 1.5,
      alignItems: "center"
    }
  }, [1, 2, 3].map(i => React.createElement("svg", {
    key: i,
    width: "9",
    height: "9",
    viewBox: "0 0 24 24",
    fill: i <= tier ? colors[tier] : "var(--line-2)"
  }, React.createElement("path", {
    d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
  }))));
}
var _TZ_DB = {
  "America/Los_Angeles": {
    std: "PST",
    dst: "PDT",
    stdOff: "-0800",
    dstOff: "-0700",
    dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU"
  },
  "America/Chicago": {
    std: "CST",
    dst: "CDT",
    stdOff: "-0600",
    dstOff: "-0500",
    dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU"
  },
  "America/New_York": {
    std: "EST",
    dst: "EDT",
    stdOff: "-0500",
    dstOff: "-0400",
    dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU"
  },
  "America/Denver": {
    std: "MST",
    dst: "MDT",
    stdOff: "-0700",
    dstOff: "-0600",
    dstStart: "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    stdStart: "FREQ=YEARLY;BYMONTH=11;BYDAY=1SU"
  }
};
function _icsTimezone(tz) {
  var t = _TZ_DB[tz] || _TZ_DB["America/Los_Angeles"];
  return ["BEGIN:VTIMEZONE", `TZID:${tz}`, "BEGIN:DAYLIGHT", `TZOFFSETFROM:${t.stdOff}`, `TZOFFSETTO:${t.dstOff}`, `TZNAME:${t.dst}`, "DTSTART:19700308T020000", `RRULE:${t.dstStart}`, "END:DAYLIGHT", "BEGIN:STANDARD", `TZOFFSETFROM:${t.dstOff}`, `TZOFFSETTO:${t.stdOff}`, `TZNAME:${t.std}`, "DTSTART:19701101T020000", `RRULE:${t.stdStart}`, "END:STANDARD", "END:VTIMEZONE"];
}
function _setTimeToLocalDate(day, hhmm) {
  var meta = FESTIVAL_CONFIG.dayDates[day];
  var d = new Date(meta.y, meta.m, meta.d);
  var [h, m] = hhmm.split(":").map(Number);
  if (h < 8) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d;
}
function _icsLocal(d) {
  var pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}
function _icsEscape(s) {
  return String(s || "").replace(/[\\,;]/g, m => "\\" + m).replace(/\n/g, "\\n");
}
async function exportLineupICS(state) {
  var saved = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start));
  if (saved.length === 0) return {
    ok: false,
    reason: "empty"
  };
  var tz = FESTIVAL_CONFIG.tz;
  var fid = FESTIVAL_CONFIG.id;
  var fname = FESTIVAL_CONFIG.shortName;
  var venue = FESTIVAL_CONFIG.locationShort;
  var dtstamp = _icsLocal(new Date());
  var events = saved.map(a => {
    var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
    var start = _icsLocal(_setTimeToLocalDate(a.day, a.start));
    var end = _icsLocal(_setTimeToLocalDate(a.day, a.end));
    var summary = _icsEscape(`${a.name} · ${stage.short}`);
    var desc = _icsEscape(`${a.genre} · ${stage.name}\\nbuilt with Plursky · plursky.com`);
    var loc = _icsEscape(`${stage.name} · ${venue}`);
    return ["BEGIN:VEVENT", `UID:plursky-${a.id}-${fid}@plursky.com`, `DTSTAMP:${dtstamp}`, `DTSTART;TZID=${tz}:${start}`, `DTEND;TZID=${tz}:${end}`, `SUMMARY:${summary}`, `LOCATION:${loc}`, `DESCRIPTION:${desc}`, "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15M", `DESCRIPTION:${summary} starts in 15 min`, "END:VALARM", "END:VEVENT"].join("\r\n");
  }).join("\r\n");
  var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//Plursky//${fname}//EN`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:My ${fname}`, `X-WR-TIMEZONE:${tz}`, ..._icsTimezone(tz), events, "END:VCALENDAR"].join("\r\n");
  var blob = new Blob([ics], {
    type: "text/calendar;charset=utf-8"
  });
  var fileName = `my-${fid}.ics`;
  var shareFile = new File([blob], fileName, {
    type: "text/plain"
  });
  if (navigator.canShare?.({
    files: [shareFile]
  }) && navigator.share) {
    try {
      await navigator.share({
        files: [shareFile],
        title: `My ${fname}`
      });
      return {
        ok: true,
        mode: "share",
        count: saved.length
      };
    } catch (e) {
      if (e.name === "AbortError") return {
        ok: true,
        mode: "abort"
      };
    }
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    var dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    window.open(dataUrl, "_blank");
    return {
      ok: true,
      mode: "download",
      count: saved.length
    };
  }
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return {
    ok: true,
    mode: "download",
    count: saved.length
  };
}
function printLineupPDF(state) {
  var saved = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start));
  if (saved.length === 0) return {
    ok: false,
    reason: "empty"
  };
  var dayLabel = Object.fromEntries(DAYS.map(d => [d.n, `${d.label} · ${d.date.toUpperCase()}`]));
  var stages = [...new Set(saved.map(a => a.stage))].length;
  var grouped = {
    1: [],
    2: [],
    3: []
  };
  saved.forEach(a => grouped[a.day].push(a));
  var dayBlock = (day, list) => list.length === 0 ? "" : `
    <section class="day">
      <h2>${dayLabel[day]}<span class="cnt">${list.length} sets</span></h2>
      <table>
        <colgroup><col class="ctime"><col><col class="cstage"></colgroup>
        ${list.map(a => {
    var st = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
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
  var html = `<!DOCTYPE html>
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
  var w = window.open("", "plursky-print", "width=900,height=1100");
  if (!w) return {
    ok: false,
    reason: "popup_blocked"
  };
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {}
  }, 500);
  return {
    ok: true
  };
}
async function copyScheduleText(state) {
  var ids = state.saved;
  if (!ids.length) return {
    ok: false,
    reason: "empty"
  };
  var lines = festivalDayNums().flatMap(day => {
    var d = FESTIVAL_CONFIG.dayDates[day];
    var artists = activeLineup().filter(a => a.day === day && ids.includes(a.id)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
    if (!artists.length) return [];
    return [`${d.short} · ${d.name.toUpperCase()}`, ...artists.map(a => {
      var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
      return `  ${fmt12(a.start)}  ${a.name}  @  ${stage ? stage.name : a.stage}`;
    }), ""];
  });
  var text = [`My ${FESTIVAL_CONFIG.name} lineup (${ids.length} sets):`, "", ...lines].join("\n").trim();
  try {
    if (navigator.share) {
      await navigator.share({
        title: `My ${FESTIVAL_CONFIG.name} lineup`,
        text
      });
      return {
        ok: true
      };
    }
    await navigator.clipboard.writeText(text);
    return {
      ok: true
    };
  } catch {
    return {
      ok: false
    };
  }
}
function ShareLineupButton({
  state
}) {
  var [open, setOpen] = React.useState(false);
  var [busy, setBusy] = React.useState(false);
  var [done, setDone] = React.useState(null);
  var wrap = (key, fn) => async () => {
    if (busy) return;
    setOpen(false);
    setBusy(true);
    var r = await fn(state);
    setBusy(false);
    if (r?.ok) {
      setDone(key);
      setTimeout(() => setDone(null), 1800);
    } else if (r?.reason === "popup_blocked") {
      alert("Popup blocked — allow popups for plursky.com and try again.");
    }
  };
  return React.createElement("div", {
    style: {
      position: "relative"
    }
  }, React.createElement("button", {
    onClick: () => setOpen(o => !o),
    disabled: busy,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      minHeight: 44,
      padding: "0 4px",
      borderRadius: 14,
      background: "transparent",
      border: "none",
      color: done ? "var(--signal)" : "var(--text-2)",
      fontSize: 15,
      lineHeight: "20px",
      fontWeight: 500,
      cursor: busy ? "wait" : "pointer",
      opacity: busy ? 0.65 : 1
    }
  }, React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M12 4 V14"
  }), React.createElement("path", {
    d: "M7 9 L12 4 L17 9"
  }), React.createElement("path", {
    d: "M5 14 V20 H19 V14"
  })), done === "image" ? "Saved" : done === "cal" ? "Added" : done === "pdf" ? "Printed" : done === "txt" ? "Copied" : busy ? "…" : "Share"), open && React.createElement(React.Fragment, null, React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 60,
      background: "transparent"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      right: 0,
      top: "calc(100% + 6px)",
      zIndex: 61,
      background: "var(--paper)",
      border: "1px solid var(--line-2)",
      borderRadius: 12,
      padding: 5,
      minWidth: 200,
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)"
    }
  }, React.createElement(ShareMenuItem, {
    icon: "img",
    label: "Image for stories",
    sub: "1080×1920 PNG",
    onClick: wrap("image", shareLineupImage)
  }), React.createElement(ShareMenuItem, {
    icon: "cal",
    label: "Add to calendar",
    sub: ".ics with 15-min reminders",
    onClick: wrap("cal", exportLineupICS)
  }), React.createElement(ShareMenuItem, {
    icon: "prn",
    label: "Print schedule",
    sub: "Save as PDF from print dialog",
    onClick: wrap("pdf", async s => printLineupPDF(s))
  }), React.createElement(ShareMenuItem, {
    icon: "txt",
    label: "Copy as text",
    sub: "Paste anywhere",
    onClick: wrap("txt", copyScheduleText)
  }))));
}
function ShareMenuItem({
  icon,
  label,
  sub,
  onClick
}) {
  var ico = icon === "img" ? React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "16",
    rx: "2"
  }), React.createElement("circle", {
    cx: "9",
    cy: "10",
    r: "1.6"
  }), React.createElement("path", {
    d: "M3 17 L9 12 L14 16 L17 13 L21 17"
  })) : icon === "cal" ? React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "16",
    rx: "2"
  }), React.createElement("path", {
    d: "M3 9 H21"
  }), React.createElement("path", {
    d: "M8 3 V7"
  }), React.createElement("path", {
    d: "M16 3 V7"
  })) : icon === "txt" ? React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("rect", {
    x: "5",
    y: "3",
    width: "14",
    height: "18",
    rx: "2"
  }), React.createElement("path", {
    d: "M8 8 H16"
  }), React.createElement("path", {
    d: "M8 12 H16"
  }), React.createElement("path", {
    d: "M8 16 H12"
  })) : React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M6 9 V3 H18 V9"
  }), React.createElement("rect", {
    x: "3",
    y: "9",
    width: "18",
    height: "9",
    rx: "1"
  }), React.createElement("rect", {
    x: "6",
    y: "14",
    width: "12",
    height: "6"
  }));
  return React.createElement("button", {
    onClick: onClick,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "9px 10px",
      borderRadius: 8,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      color: "var(--ink)",
      fontFamily: "inherit",
      transition: "background .15s"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--paper-2)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, React.createElement("span", {
    style: {
      color: "var(--ember-ink)",
      display: "flex"
    }
  }, ico), React.createElement("span", {
    style: {
      flex: 1
    }
  }, React.createElement("span", {
    style: {
      display: "block",
      fontSize: 13,
      fontWeight: 500
    }
  }, label), React.createElement("span", {
    className: "mono",
    style: {
      display: "block",
      fontSize: 9,
      letterSpacing: 1.1,
      color: "var(--muted)",
      marginTop: 1,
      textTransform: "uppercase"
    }
  }, sub)));
}
function toggleSave(state, setState, id) {
  var has = state.saved.includes(id);
  var prevSaved = state.saved;
  var next = has ? state.saved.filter(x => x !== id) : [...state.saved, id];
  if (has) {
    try {
      window.sbMarkRemoved?.(id);
    } catch {}
  } else {
    try {
      window.sbClearRemoved?.(id);
    } catch {}
  }
  var a = ARTISTS.find(x => x.id === id);
  var hasConflict = !has && a && next.some(sid => {
    if (sid === id) return false;
    var b = ARTISTS.find(x => x.id === sid);
    return b && b.day === a.day && overlaps(a, b);
  });
  if (hasConflict) {
    try {
      navigator.vibrate([50, 30, 50]);
    } catch {}
    try {
      window.plurskyHaptic?.("HEAVY");
    } catch {}
  } else {
    try {
      navigator.vibrate([has ? 15 : 30]);
    } catch {}
    try {
      window.plurskyHaptic?.(has ? "LIGHT" : "MEDIUM");
    } catch {}
  }
  setState(s => ({
    ...s,
    saved: next
  }));
  try {
    var label = a?.name ? a.name.toUpperCase() : "SET";
    var isFirstSave = !has && state.saved.length === 0;
    var isMilestone = !has && [5, 10, 15, 20].includes(next.length);
    var msg = has ? `REMOVED · ${label}` : isFirstSave ? `✦ FIRST SET SAVED · ${label} · LET'S GO` : isMilestone ? `✦ ${next.length} SETS · ${label} · LINEUP GROWING` : hasConflict ? `SAVED · ${label} · ⚠ CLASH` : `SAVED · ${next.length} SETS`;
    var undo = () => {
      if (has) {
        try {
          window.sbClearRemoved?.(id);
        } catch {}
      } else {
        try {
          window.sbMarkRemoved?.(id);
        } catch {}
      }
      setState(s => ({
        ...s,
        saved: prevSaved
      }));
      try {
        window.plurskyHaptic?.("LIGHT");
      } catch {}
      window.plurskyToast?.(has ? `RE-SAVED · ${label}` : `REMOVED · ${label}`);
    };
    window.plurskyToast?.(msg, {
      actionLabel: "UNDO",
      onAction: undo,
      duration: 3000
    });
    if ((isFirstSave || isMilestone) && !has) {
      window._plurskyCelebrate?.();
    }
  } catch {}
}
async function shareLineupImage(state) {
  var saved = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(Boolean).sort((a, b) => a.day - b.day || toNightMin(a.start) - toNightMin(b.start));
  if (saved.length === 0) return {
    ok: false,
    reason: "empty"
  };
  try {
    await document.fonts?.ready;
  } catch {}
  var W = 1080,
    H = 1920;
  var cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  var ctx = cv.getContext("2d");
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f7ede0");
  bg.addColorStop(0.55, "#eee0cb");
  bg.addColorStop(1, "#e6d3b6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  var glow = ctx.createRadialGradient(W * 0.85, 220, 30, W * 0.85, 220, 600);
  glow.addColorStop(0, "rgba(245,154,54,0.42)");
  glow.addColorStop(1, "rgba(245,154,54,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);
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
  var stages = [...new Set(saved.map(a => a.stage))].length;
  ctx.fillText(`${saved.length} SETS · ${stages} STAGES · 3 NIGHTS`, 80, 340);
  var y = 470;
  var lastDay = null;
  var dayMeta = Object.fromEntries(DAYS.map(d => [d.n, {
    label: d.label,
    date: d.date.toUpperCase()
  }]));
  var _loop3 = async function (a) {
    if (a.day !== lastDay) {
      lastDay = a.day;
      var dm = dayMeta[a.day];
      ctx.fillStyle = "rgba(26,18,13,0.18)";
      ctx.fillRect(80, y - 20, W - 160, 1);
      ctx.fillStyle = "#1a120d";
      ctx.font = '500 28px "Geist Mono", monospace';
      ctx.fillText(`${dm.label} · ${dm.date}`, 80, y + 18);
      ctx.fillStyle = "rgba(26,18,13,0.4)";
      var dayCount = saved.filter(s => s.day === a.day).length;
      ctx.textAlign = "right";
      ctx.fillText(`${dayCount} SETS`, W - 80, y + 18);
      ctx.textAlign = "left";
      y += 70;
    }
    var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
    ctx.fillStyle = stage.color;
    ctx.fillRect(80, y, 6, 78);
    ctx.fillStyle = "#1a120d";
    ctx.font = '500 28px "Geist Mono", monospace';
    ctx.fillText(fmt12(a.start), 110, y + 32);
    ctx.fillStyle = "rgba(26,18,13,0.45)";
    ctx.font = '400 20px "Geist Mono", monospace';
    ctx.fillText(fmt12(a.end), 110, y + 60);
    ctx.fillStyle = "#1a120d";
    ctx.font = '46px "Instrument Serif", serif';
    var name = a.name;
    if (ctx.measureText(name).width > 760) {
      while (ctx.measureText(name + "…").width > 760 && name.length > 0) name = name.slice(0, -1);
      name = name + "…";
    }
    ctx.fillText(name, 250, y + 38);
    ctx.fillStyle = stage.color;
    ctx.font = '600 18px "Geist Mono", monospace';
    ctx.fillText(stage.name.toUpperCase() + " · " + a.genre.toUpperCase(), 250, y + 64);
    y += 92;
    if (y > H - 180) return 1;
  };
  for (var a of saved) {
    if (await _loop3(a)) break;
  }
  ctx.fillStyle = "#1a120d";
  ctx.font = '500 22px "Geist Mono", monospace';
  ctx.textAlign = "center";
  ctx.fillText("plursky.com", W / 2, H - 110);
  ctx.fillStyle = "rgba(26,18,13,0.45)";
  ctx.font = 'italic 26px "Instrument Serif", serif';
  ctx.fillText("Three nights under the electric sky", W / 2, H - 70);
  var fname = `my-${(FESTIVAL_CONFIG.id || FESTIVAL_CONFIG.shortName || "festival").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
  return new Promise(resolve => {
    cv.toBlob(async blob => {
      if (!blob) {
        resolve({
          ok: false,
          reason: "encode_fail"
        });
        return;
      }
      var file = new File([blob], fname, {
        type: "image/png"
      });
      if (navigator.canShare?.({
        files: [file]
      }) && navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: `My ${FESTIVAL_CONFIG.shortName || "festival"} plan`
          });
          resolve({
            ok: true,
            mode: "share"
          });
          return;
        } catch (e) {
          if (e.name === "AbortError") {
            resolve({
              ok: true,
              mode: "abort"
            });
            return;
          }
        }
      }
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fname;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve({
        ok: true,
        mode: "download"
      });
    }, "image/png");
  });
}
Object.assign(window, {
  LineupScreen,
  NightWizard,
  toggleSave,
  toNightMin,
  overlaps,
  shareLineupImage,
  ShareLineupButton
});
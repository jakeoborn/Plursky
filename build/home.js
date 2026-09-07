var FESTIVAL_START_MS = FESTIVAL_CONFIG.startMs;
var FESTIVAL_END_MS = FESTIVAL_CONFIG.endMs;
function festivalNightDate(day, hhmm) {
  if (!hhmm) return new Date(NaN);
  var [h, m] = hhmm.split(":").map(Number);
  var dayMeta = FESTIVAL_CONFIG.dayDates[day];
  if (!dayMeta) return new Date(NaN);
  var isOvernight = h < 12;
  var dayMs = dayMeta.midnightUtc + (isOvernight ? 86400000 : 0);
  return new Date(dayMs + h * 3600000 + m * 60000);
}
function fmtCountdown(ms) {
  if (ms <= 0) return null;
  var total = Math.floor(ms / 1000);
  var h = Math.floor(total / 3600);
  var m = Math.floor(total % 3600 / 60);
  if (h >= 24) return `${Math.floor(h / 24)}D ${h % 24}H`;
  if (h >= 1) return `${h}H ${m.toString().padStart(2, "0")}M`;
  return `${m} MIN`;
}
async function fetchEdcForecast() {
  try {
    var cacheKey = `forecast_${FESTIVAL_CONFIG.id}`;
    var cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
      var c = JSON.parse(cacheRaw);
      if (Date.now() - c.fetchedAt < 3600000) return c.data;
    }
    var points = await fetch(FESTIVAL_CONFIG.weatherEndpoint, {
      headers: {
        Accept: "application/geo+json"
      }
    }).then(r => r.ok ? r.json() : null);
    if (!points) return null;
    var forecast = await fetch(points.properties.forecast, {
      headers: {
        Accept: "application/geo+json"
      }
    }).then(r => r.ok ? r.json() : null);
    if (!forecast) return null;
    var data = forecast.properties.periods.slice(0, 6);
    localStorage.setItem(cacheKey, JSON.stringify({
      fetchedAt: Date.now(),
      data
    }));
    return data;
  } catch {
    return null;
  }
}
async function fetchHourlyForecast() {
  try {
    var cacheKey = `forecast_hourly_${FESTIVAL_CONFIG.id}`;
    var cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
      var c = JSON.parse(cacheRaw);
      if (Date.now() - c.fetchedAt < 3600000) return c.data;
    }
    var points = await fetch(FESTIVAL_CONFIG.weatherEndpoint, {
      headers: {
        Accept: "application/geo+json"
      }
    }).then(r => r.ok ? r.json() : null);
    if (!points?.properties?.forecastHourly) return null;
    var forecast = await fetch(points.properties.forecastHourly, {
      headers: {
        Accept: "application/geo+json"
      }
    }).then(r => r.ok ? r.json() : null);
    if (!forecast) return null;
    var data = (forecast.properties.periods || []).slice(0, 48).map(p => ({
      startTime: p.startTime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      shortForecast: p.shortForecast,
      windSpeed: p.windSpeed,
      probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value || 0
    }));
    localStorage.setItem(cacheKey, JSON.stringify({
      fetchedAt: Date.now(),
      data
    }));
    return data;
  } catch {
    return null;
  }
}
function useHourlyForecast() {
  var [hours, setHours] = React.useState(null);
  React.useEffect(() => {
    var alive = true;
    fetchHourlyForecast().then(h => {
      if (alive) setHours(h);
    });
    return () => {
      alive = false;
    };
  }, []);
  return hours;
}
function useNwsForecast() {
  var [result, setResult] = React.useState({
    periods: null,
    fromCache: false,
    fetchedAt: null
  });
  React.useEffect(() => {
    var alive = true;
    var cacheKey = `forecast_${FESTIVAL_CONFIG.id}`;
    var fromCache = false,
      fetchedAt = null;
    try {
      var raw = localStorage.getItem(cacheKey);
      if (raw) {
        var c = JSON.parse(raw);
        if (Date.now() - c.fetchedAt < 3600000) {
          fromCache = true;
          fetchedAt = c.fetchedAt;
        }
      }
    } catch {}
    fetchEdcForecast().then(p => {
      if (!alive) return;
      if (!fromCache) {
        try {
          var _raw = localStorage.getItem(cacheKey);
          if (_raw) fetchedAt = JSON.parse(_raw).fetchedAt;
        } catch {}
      }
      setResult({
        periods: p,
        fromCache,
        fetchedAt
      });
    });
    return () => {
      alive = false;
    };
  }, []);
  return result;
}
var _WEATHER_ALERT_RE = /thunderstorm|tornado|lightning|wind advisory|excessive heat|dust storm|flash flood|\bhail\b|severe weather/i;
function useWeatherAlert() {
  var [alert, setAlert] = React.useState(null);
  React.useEffect(() => {
    fetchEdcForecast().then(periods => {
      if (!periods) return;
      for (var p of periods) {
        var text = (p.shortForecast || "") + " " + (p.detailedForecast || "");
        var m = text.match(_WEATHER_ALERT_RE);
        if (m) {
          setAlert({
            shortForecast: p.shortForecast,
            keyword: m[0]
          });
          return;
        }
      }
    });
  }, []);
  return alert;
}
function pickRelevantPeriod(periods) {
  if (!periods?.length) return null;
  var now = Date.now();
  var future = periods.filter(p => new Date(p.endTime).getTime() > now);
  if (future.length) return future[0];
  return periods[0];
}
function TonightCard({
  state,
  setState
}) {
  var {
    periods,
    fromCache,
    fetchedAt
  } = useNwsForecast();
  var period = pickRelevantPeriod(periods);
  var hourly = useHourlyForecast();
  var cacheAgeLabel = (() => {
    if (!fromCache || !fetchedAt) return null;
    var mins = Math.round((Date.now() - fetchedAt) / 60000);
    if (mins < 2) return null;
    return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
  })();
  var day = NOW.day;
  var sunTimes = FESTIVAL_CONFIG.sunTimes || {};
  var sun = sunTimes[day] || sunTimes[1] || {
    rise: "07:00",
    set: "19:00"
  };
  var now = Date.now();
  var isPreEvent = now < FESTIVAL_START_MS;
  var sunsetMs = festivalNightDate(day, sun.set).getTime();
  var sunriseMs = festivalNightDate(day, sun.rise).getTime();
  var nextSun = sunTimes[day + 1] || sun;
  var nextSunsetMs = sunsetMs > now ? sunsetMs : day < 3 ? festivalNightDate(day + 1, nextSun.set).getTime() : null;
  var nextSunriseMs = sunriseMs > now ? sunriseMs : day < 3 ? festivalNightDate(day + 1, nextSun.rise).getTime() : null;
  var lastShuttleMs = FESTIVAL_CONFIG.lastShuttleHHMM ? festivalNightDate(day, FESTIVAL_CONFIG.lastShuttleHHMM).getTime() : NaN;
  var inShuttleWindow = !isPreEvent && now < lastShuttleMs && lastShuttleMs - now < 4 * 3600000;
  var shuttleMins = Math.floor((lastShuttleMs - now) / 60000);
  var shuttleUrgent = inShuttleWindow && shuttleMins < 60;
  var sunriseSet = nextSunriseMs ? fmtCountdown(nextSunriseMs - now) : null;
  var sunsetSet = nextSunsetMs ? fmtCountdown(nextSunsetMs - now) : null;
  var sunriseArtistId = (() => {
    if (!nextSunriseMs) return null;
    var d = new Date(nextSunriseMs);
    var utcH = d.getUTCHours(),
      utcM = d.getUTCMinutes();
    var pdtH = (utcH + 24 - 7) % 24;
    var sunriseDay = (() => {
      var days = Object.keys(FESTIVAL_CONFIG.dayDates || {
        1: null
      }).map(Number).sort((a, b) => a - b).map(n => festivalNightDate(n, (sunTimes[n] || sun).rise));
      var idx = days.findIndex(x => Math.abs(x.getTime() - nextSunriseMs) < 60000);
      return idx + 1;
    })();
    var target = `${pdtH.toString().padStart(2, "0")}:${utcM.toString().padStart(2, "0")}`;
    return ARTISTS.find(a => a.day === sunriseDay && a.stage === (FESTIVAL_CONFIG.mainStageId || "kinetic") && toNightMin(a.start) <= toNightMin(target) && toNightMin(a.end) > toNightMin(target));
  })();
  var card = (label, value, sub, accent) => React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "rgba(247,237,224,0.55)",
      fontWeight: 600
    }
  }, label), React.createElement("div", {
    style: {
      fontFamily: "Geist Mono, monospace",
      fontSize: 18,
      fontWeight: 600,
      color: accent || "var(--paper)",
      marginTop: 3,
      lineHeight: 1
    }
  }, value), sub && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.1,
      color: "rgba(247,237,224,0.6)",
      marginTop: 4
    }
  }, sub));
  return React.createElement("div", {
    style: {
      marginTop: 18,
      background: "var(--night)",
      borderRadius: 16,
      padding: "14px 16px 16px",
      color: "var(--paper)",
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "radial-gradient(120% 60% at 80% 0%, rgba(245,154,54,0.18), transparent 55%), radial-gradient(80% 50% at 10% 110%, rgba(167,139,250,0.18), transparent 60%)",
      pointerEvents: "none"
    }
  }), React.createElement("div", {
    style: {
      position: "relative"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 12
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      color: "rgba(247,237,224,0.6)"
    }
  }, isPreEvent ? "OPENING NIGHT" : `TONIGHT · DAY ${day}`), period && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "rgba(247,237,224,0.5)",
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, "NWS · ", period.name.toUpperCase(), cacheAgeLabel && React.createElement("span", {
    style: {
      background: "rgba(247,237,224,0.1)",
      border: "1px solid rgba(247,237,224,0.18)",
      borderRadius: 4,
      padding: "1px 5px",
      fontSize: 8,
      letterSpacing: 1
    }
  }, "CACHED · ", cacheAgeLabel))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start"
    }
  }, sunsetSet && card("SUNSET", sun.set, sunsetSet ? `IN ${sunsetSet}` : null, "var(--flare)"), sunriseSet && card("SUNRISE", sun.rise, sunriseArtistId ? `${sunriseArtistId.name.toUpperCase()} · KINETIC` : `IN ${sunriseSet}`, "#fbbf24"), period ? card("WEATHER", `${period.temperature}°${period.temperatureUnit}`, `${period.windSpeed} ${period.windDirection}`, "#a8d4ff") : React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 80,
      padding: "8px 10px",
      borderRadius: 10,
      background: "rgba(247,237,224,0.06)",
      border: "1px solid rgba(247,237,224,0.1)"
    }
  }, React.createElement("div", {
    className: "skel-dark",
    style: {
      width: "60%",
      height: 8,
      marginBottom: 6
    }
  }), React.createElement("div", {
    className: "skel-dark",
    style: {
      width: "80%",
      height: 14,
      marginBottom: 4
    }
  }), React.createElement("div", {
    className: "skel-dark",
    style: {
      width: "50%",
      height: 8
    }
  }))), hourly?.length > 0 && (() => {
    var next12 = hourly.slice(0, 12);
    var temps = next12.map(h => h.temperature);
    var min = Math.min(...temps),
      max = Math.max(...temps);
    var range = max - min || 1;
    var W = 280,
      H = 40;
    var points = next12.map((h, i) => {
      var x = i / (next12.length - 1) * W;
      var y = H - (h.temperature - min) / range * (H - 8) - 4;
      return `${x},${y}`;
    }).join(" ");
    var firstHour = new Date(next12[0].startTime).getHours();
    var fmtH = h => h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
    var lastHour = new Date(next12[next12.length - 1].startTime).getHours();
    return React.createElement("div", {
      style: {
        marginTop: 14,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(247,237,224,0.05)",
        border: "1px solid rgba(247,237,224,0.1)"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 6
      }
    }, React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "rgba(247,237,224,0.55)",
        fontWeight: 600
      }
    }, "NEXT 12H"), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "rgba(247,237,224,0.5)"
      }
    }, min, "° → ", max, "°")), React.createElement("svg", {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "none",
      style: {
        width: "100%",
        height: H,
        display: "block"
      }
    }, React.createElement("polyline", {
      points: points,
      fill: "none",
      stroke: "#a8d4ff",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), next12.map((h, i) => i % 3 === 0 && React.createElement("circle", {
      key: i,
      cx: i / (next12.length - 1) * W,
      cy: H - (h.temperature - min) / range * (H - 8) - 4,
      r: "1.5",
      fill: "#a8d4ff"
    }))), React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: 4
      }
    }, React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1,
        color: "rgba(247,237,224,0.4)"
      }
    }, fmtH(firstHour)), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1,
        color: "rgba(247,237,224,0.4)"
      }
    }, fmtH(lastHour))));
  })(), inShuttleWindow && React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "map"
    }),
    style: {
      marginTop: 14,
      width: "100%",
      background: shuttleUrgent ? "var(--ember)" : "rgba(247,237,224,0.08)",
      border: shuttleUrgent ? "none" : "1px solid rgba(247,237,224,0.2)",
      color: "var(--paper)",
      borderRadius: 10,
      padding: "10px 12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700,
      textAlign: "left"
    }
  }, React.createElement("span", null, "🚌  LAST SHUTTLE TO STRIP"), React.createElement("span", {
    style: {
      color: shuttleUrgent ? "#fff" : "var(--flare)"
    }
  }, shuttleMins > 0 ? `${shuttleMins} MIN` : "DEPARTED")), !inShuttleWindow && sunriseArtistId && !isPreEvent && React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: sunriseArtistId.id
    }),
    style: {
      marginTop: 14,
      width: "100%",
      background: "rgba(247,237,224,0.06)",
      border: "1px solid rgba(247,237,224,0.18)",
      color: "var(--paper)",
      borderRadius: 10,
      padding: "9px 12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 600,
      textAlign: "left"
    }
  }, React.createElement("span", null, "🌅  SUNRISE SET · ", sunriseArtistId.name.toUpperCase()), React.createElement("span", {
    style: {
      color: "#fbbf24"
    }
  }, sunriseSet))));
}
function preEventCountdown(savedIds) {
  var now = Date.now();
  if (now >= FESTIVAL_START_MS) return null;
  var targetMs = FESTIVAL_START_MS;
  if (FESTIVAL_CONFIG.weekendStartMs) {
    var saved = (savedIds || []).map(id => ARTISTS.find(a => a.id === id)).filter(Boolean);
    var w2Count = saved.filter(a => a.weekend === "W2").length;
    var w1Count = saved.filter(a => a.weekend === "W1").length;
    if (w2Count > w1Count) targetMs = FESTIVAL_CONFIG.weekendStartMs.W2 || targetMs;else if (w1Count > 0) targetMs = FESTIVAL_CONFIG.weekendStartMs.W1 || targetMs;
  }
  var diff = targetMs - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000 % 24),
    mins: Math.floor(diff / 60000 % 60),
    secs: Math.floor(diff / 1000 % 60),
    weekend: FESTIVAL_CONFIG.weekendStartMs ? targetMs === FESTIVAL_CONFIG.weekendStartMs?.W2 ? "W2" : "W1" : null,
    targetMs
  };
}
var _SKY_FALLBACK_MS = 90 * 86400000;
function skyFillStartMs(targetMs) {
  var announced = FESTIVAL_CONFIG.lineupAnnouncedMs;
  if (typeof announced === "number" && announced < targetMs) return announced;
  return targetMs - _SKY_FALLBACK_MS;
}
function _hhmmMin(s) {
  var parts = String(s || "").split(":").map(Number);
  if (parts.length < 2 || parts.some(n => !isFinite(n))) return null;
  return parts[0] * 60 + parts[1];
}
function festivalSunGeometry() {
  var st = FESTIVAL_CONFIG.sunTimes && FESTIVAL_CONFIG.sunTimes[1];
  if (!st) return null;
  var riseMin = _hhmmMin(st.rise);
  var setMin = _hhmmMin(st.set);
  if (riseMin == null || setMin == null || setMin <= riseMin) return null;
  var daylightMin = setMin - riseMin;
  var local = new Date(FESTIVAL_START_MS + (FESTIVAL_CONFIG.utcOffsetHours || 0) * 3600000);
  var gatesMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  var gatesFrac = Math.max(0.08, Math.min(0.92, (gatesMin - riseMin) / daylightMin));
  return {
    daylightMin,
    gatesFrac,
    riseMin
  };
}
function beforeFestivalSunrise(now) {
  var geo = festivalSunGeometry();
  if (!geo) return true;
  var local = new Date(now + (FESTIVAL_CONFIG.utcOffsetHours || 0) * 3600000);
  return local.getUTCHours() * 60 + local.getUTCMinutes() < geo.riseMin;
}
function festivalAccent() {
  var e = (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : []).find(f => f && f.config && f.config.id === FESTIVAL_CONFIG.id);
  return e && e.accent || null;
}
var _SKY_STARS = [[0.073, 18], [0.193, 34], [0.320, 12], [0.437, 40], [0.560, 21], [0.680, 33], [0.793, 15], [0.893, 38], [0.147, 52], [0.497, 60], [0.943, 55]];
function FestivalSkyBand({
  accent,
  progress,
  preDawn
}) {
  var uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  var idSky = `fcSky${uid}`,
    idGround = `fcGround${uid}`,
    idSun = `fcSun${uid}`;
  var hostRef = React.useRef(null);
  var [bandW, setBandW] = React.useState(375);
  React.useLayoutEffect(() => {
    var el = hostRef.current;
    if (!el) return;
    var read = () => setBandW(Math.max(240, Math.round(el.clientWidth || 375)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    var ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  var geo = festivalSunGeometry();
  var mainStage = STAGES.find(s => s.id === FESTIVAL_CONFIG.mainStageId);
  var stageColor = mainStage && mainStage.color || accent;
  var sky = festivalAccent() || accent;
  var W = bandW,
    H = 120,
    HORIZON = 104;
  var lift = geo ? Math.max(0.55, Math.min(1.15, geo.daylightMin / 720)) : 0.9;
  var arcX = x => 22 + x * (W - 44);
  var arcY = x => HORIZON - Math.sin(Math.PI * x) * 66 * lift;
  var gates = geo ? geo.gatesFrac : null;
  var sunAt = gates == null ? null : preDawn ? 0 : gates * progress;
  var px = sunAt == null ? 0 : arcX(sunAt);
  var py = sunAt == null ? 0 : preDawn ? HORIZON + 12 : arcY(sunAt);
  var rigFrac = gates != null && gates >= 0.5 ? 0.22 : 0.78;
  var rig = arcX(rigFrac);
  var starOpacity = preDawn ? 0.1 : Math.max(0.12, 0.75 * (1 - progress));
  var glow = preDawn ? 0.34 : 0.28 + 0.5 * progress;
  var zenith = preDawn ? "#05040a" : "#130d14";
  var ease = "opacity 700ms ease, transform 700ms ease";
  var path = Array.from({
    length: 25
  }, (_, i) => {
    var x = i / 24;
    return `${i ? "L" : "M"}${arcX(x).toFixed(1)},${arcY(x).toFixed(1)}`;
  }).join(" ");
  return React.createElement("div", {
    ref: hostRef,
    style: {
      width: "100%",
      lineHeight: 0
    }
  }, React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: H,
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    style: {
      display: "block"
    }
  }, React.createElement("defs", null, React.createElement("linearGradient", {
    id: idSky,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: zenith
  }), preDawn && React.createElement("stop", {
    offset: "72%",
    stopColor: zenith
  }), React.createElement("stop", {
    offset: preDawn ? "90%" : "62%",
    stopColor: sky,
    stopOpacity: glow * (preDawn ? 0.10 : 0.22)
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: sky,
    stopOpacity: glow * (preDawn ? 1.1 : 0.65)
  })), React.createElement("linearGradient", {
    id: idGround,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#0b0812"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#1f1517"
  })), React.createElement("radialGradient", {
    id: idSun
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#fff8e6"
  }), React.createElement("stop", {
    offset: "55%",
    stopColor: sky
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: sky,
    stopOpacity: "0"
  }))), React.createElement("rect", {
    x: "0",
    y: "0",
    width: W,
    height: HORIZON,
    fill: zenith
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: W,
    height: HORIZON,
    fill: `url(#${idSky})`
  }), React.createElement("rect", {
    x: "0",
    y: HORIZON,
    width: W,
    height: H - HORIZON,
    fill: `url(#${idGround})`
  }), _SKY_STARS.map(([sf, sy], i) => React.createElement("circle", {
    key: i,
    cx: (sf * W).toFixed(1),
    cy: sy,
    r: i % 3 === 0 ? 1.1 : 0.8,
    fill: "#fff",
    opacity: starOpacity * (i % 2 ? 0.7 : 1),
    style: {
      transition: ease
    }
  })), gates != null && React.createElement(React.Fragment, null, React.createElement("path", {
    d: path,
    fill: "none",
    stroke: "#fff",
    strokeOpacity: "0.13",
    strokeWidth: "1",
    strokeDasharray: "2 5"
  }), React.createElement("circle", {
    cx: arcX(gates),
    cy: arcY(gates),
    r: "9",
    fill: "none",
    stroke: sky,
    strokeOpacity: "0.5",
    strokeWidth: "1",
    strokeDasharray: "2 3"
  })), React.createElement("line", {
    x1: "0",
    y1: HORIZON,
    x2: W,
    y2: HORIZON,
    stroke: sky,
    strokeOpacity: "0.7",
    strokeWidth: "1"
  }), React.createElement("g", {
    stroke: stageColor,
    fill: "none",
    strokeLinecap: "round"
  }, React.createElement("g", {
    opacity: 0.35 + 0.35 * progress,
    style: {
      transition: ease
    }
  }, React.createElement("line", {
    x1: rig - 26,
    y1: HORIZON,
    x2: rig - 26,
    y2: HORIZON - 26,
    strokeWidth: "2"
  }), React.createElement("line", {
    x1: rig + 26,
    y1: HORIZON,
    x2: rig + 26,
    y2: HORIZON - 26,
    strokeWidth: "2"
  }), React.createElement("path", {
    d: `M${rig - 26},${HORIZON - 26} L${rig - 34},${HORIZON - 58}`,
    strokeWidth: "1",
    strokeOpacity: "0.35"
  }), React.createElement("path", {
    d: `M${rig + 26},${HORIZON - 26} L${rig + 34},${HORIZON - 58}`,
    strokeWidth: "1",
    strokeOpacity: "0.35"
  })), React.createElement("g", {
    opacity: progress >= 0.4 ? 0.75 : 0,
    style: {
      transition: ease
    }
  }, React.createElement("line", {
    x1: rig - 26,
    y1: HORIZON - 26,
    x2: rig + 26,
    y2: HORIZON - 26,
    strokeWidth: "2"
  }), React.createElement("line", {
    x1: rig - 12,
    y1: HORIZON,
    x2: rig - 12,
    y2: HORIZON - 26,
    strokeWidth: "1"
  }), React.createElement("line", {
    x1: rig + 12,
    y1: HORIZON,
    x2: rig + 12,
    y2: HORIZON - 26,
    strokeWidth: "1"
  })), React.createElement("g", {
    opacity: progress >= 0.8 ? 1 : 0,
    style: {
      transition: ease
    }
  }, React.createElement("path", {
    d: `M${rig - 30},${HORIZON - 26} Q${rig},${HORIZON - 46} ${rig + 30},${HORIZON - 26}`,
    strokeWidth: "2"
  }), React.createElement("circle", {
    cx: rig,
    cy: HORIZON - 30,
    r: "16",
    fill: stageColor,
    fillOpacity: "0.16",
    stroke: "none"
  }))), sunAt != null && React.createElement("g", {
    style: {
      transition: ease
    },
    transform: `translate(${px.toFixed(1)},${py.toFixed(1)})`
  }, React.createElement("circle", {
    r: preDawn ? 26 : 18,
    fill: `url(#${idSun})`,
    opacity: preDawn ? 0.7 : 0.25 + 0.55 * progress
  }), !preDawn && React.createElement("circle", {
    r: "6.5",
    fill: "#fff3d6",
    opacity: 0.55 + 0.45 * progress
  }))));
}
function useTick(intervalMs) {
  var [, setT] = React.useState(0);
  React.useEffect(() => {
    var id = setInterval(() => setT(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
var _WALK_MIN = {
  "basspod,bionic": 13,
  "basspod,circuit": 8,
  "basspod,cosmic": 11,
  "basspod,kinetic": 8,
  "basspod,neon": 12,
  "basspod,quantum": 12,
  "basspod,stereo": 10,
  "basspod,waste": 8,
  "bionic,circuit": 18,
  "bionic,cosmic": 8,
  "bionic,kinetic": 9,
  "bionic,neon": 15,
  "bionic,quantum": 12,
  "bionic,stereo": 6,
  "bionic,waste": 9,
  "circuit,cosmic": 15,
  "circuit,kinetic": 20,
  "circuit,neon": 7,
  "circuit,quantum": 11,
  "circuit,stereo": 14,
  "circuit,waste": 12,
  "cosmic,kinetic": 13,
  "cosmic,neon": 16,
  "cosmic,quantum": 16,
  "cosmic,stereo": 8,
  "cosmic,waste": 9,
  "kinetic,neon": 12,
  "kinetic,quantum": 7,
  "kinetic,stereo": 10,
  "kinetic,waste": 8,
  "neon,quantum": 9,
  "neon,stereo": 12,
  "neon,waste": 15,
  "quantum,stereo": 9,
  "quantum,waste": 16,
  "stereo,waste": 9
};
function stageWalkMinutes(fromId, toId) {
  if (fromId === toId) return 0;
  var key = fromId < toId ? `${fromId},${toId}` : `${toId},${fromId}`;
  if (_WALK_MIN[key] != null) return _WALK_MIN[key];
  var a = STAGES.find(s => s.id === fromId),
    b = STAGES.find(s => s.id === toId);
  if (!a || !b) return 0;
  return Math.max(2, Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 0.4));
}
function liveAcrossStages() {
  var now = toNightMin(NOW.time);
  return STAGES.map(s => {
    var live = ARTISTS.find(a => {
      if (a.stage !== s.id || a.day !== NOW.day) return false;
      var start = toNightMin(a.start),
        end = toNightMin(a.end);
      return now >= start && now < end;
    });
    var upcoming = !live ? ARTISTS.filter(a => a.stage === s.id && a.day === NOW.day && toNightMin(a.start) > now).sort((a, b) => toNightMin(a.start) - toNightMin(b.start))[0] || null : null;
    var minsUntil = upcoming ? toNightMin(upcoming.start) - now : null;
    return {
      stage: s,
      artist: live,
      upcoming,
      minsUntil
    };
  });
}
function buildTonightsPlan(state) {
  var nowMin = toNightMin(NOW.time);
  var sets = state.saved.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && a.day === NOW.day).sort((x, y) => toNightMin(x.start) - toNightMin(y.start));
  return sets.map((a, i) => {
    var prev = sets[i - 1];
    var walk = prev ? stageWalkMinutes(prev.stage, a.stage) : 0;
    var startMin = toNightMin(a.start);
    var endMin = toNightMin(a.end);
    var minsUntil = startMin - nowMin;
    var isLive = nowMin >= startMin && nowMin < endMin;
    var isPast = nowMin >= endMin;
    var leaveBy = walk > 0 ? startMin - walk : null;
    var prevEnd = prev ? toNightMin(prev.end) : null;
    var tight = prev && walk > 0 && startMin - prevEnd < walk;
    var conflict = prev && overlaps(prev, a);
    return {
      artist: a,
      prev,
      walk,
      minsUntil,
      isLive,
      isPast,
      leaveBy,
      tight,
      conflict
    };
  });
}
function computeAlerts(savedIds, day, timeStr) {
  if (!savedIds?.length) return [];
  var nowMin = toNightMin(timeStr);
  var todaySaved = ARTISTS.filter(a => a.day === day && savedIds.includes(a.id)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
  var out = [];
  var _loop = function (a) {
    var s = toNightMin(a.start);
    var minsAway = s - nowMin;
    if (minsAway > 0 && minsAway <= 30) {
      var stage = STAGES.find(st => st.id === a.stage);
      out.push({
        id: `remind_${a.id}`,
        kind: "reminder",
        title: `${a.name} in ${minsAway} min`,
        body: `${stage?.name || a.stage} · ${fmt12(a.start)}`,
        time: timeStr,
        unread: true
      });
    }
  };
  for (var a of todaySaved) {
    _loop(a);
  }
  for (var i = 0; i < todaySaved.length - 1; i++) {
    var _a = todaySaved[i],
      b = todaySaved[i + 1];
    if (overlaps(_a, b)) {
      out.push({
        id: `conflict_${_a.id}_${b.id}`,
        kind: "conflict",
        title: "Schedule conflict",
        body: `${_a.name} and ${b.name} overlap at ${b.start}.`,
        time: timeStr,
        unread: true
      });
    }
  }
  return out;
}
function PostFestivalRecap({
  state,
  setState
}) {
  var savedIds = state.saved || [];
  var byDay = [1, 2, 3].map(day => ({
    day,
    meta: FESTIVAL_CONFIG.dayDates[day],
    artists: ARTISTS.filter(a => a.day === day && savedIds.includes(a.id)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start))
  })).filter(d => d.artists.length);
  return React.createElement("div", {
    style: {
      padding: "0 0 24px"
    }
  }, window.HomeMemoriesStrip && React.createElement(window.HomeMemoriesStrip, {
    state,
    setState
  }), byDay.length > 0 && React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 18,
      padding: "16px 16px 8px",
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.6,
      color: "var(--muted)",
      fontWeight: 600,
      marginBottom: 14
    }
  }, "YOUR SAVED SETS"), byDay.map(({
    day,
    meta,
    artists
  }) => React.createElement("div", {
    key: day,
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.8,
      color: "var(--ember-ink)",
      fontWeight: 700,
      marginBottom: 8
    }
  }, meta.short, " · ", meta.name.toUpperCase()), artists.map(a => {
    var stage = STAGES.find(s => s.id === a.stage);
    return React.createElement("button", {
      key: a.id,
      onClick: () => setState({
        ...state,
        tab: "home",
        artist: a.id
      }),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--line-2)",
        padding: "8px 0",
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement(ArtistSwatch, {
      artist: a,
      size: 36
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
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 1
      }
    }, stage ? stage.short : "", " · ", fmt12(a.start), "–", fmt12(a.end))));
  })))), savedIds.length === 0 && React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 18,
      padding: 20,
      textAlign: "center",
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--muted)"
    }
  }, "NO SAVED SETS — NEXT YEAR, START PLANNING EARLY")));
}
function DayStrip({
  value,
  onChange,
  hasYesterday,
  hasUpcoming
}) {
  var tabs = [{
    id: "yesterday",
    label: "YESTERDAY",
    enabled: hasYesterday
  }, {
    id: "today",
    label: "TODAY",
    enabled: true
  }, {
    id: "upcoming",
    label: "UPCOMING",
    enabled: hasUpcoming
  }];
  return React.createElement("div", {
    style: {
      display: "flex",
      gap: 0,
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 999,
      padding: 3
    }
  }, tabs.map(t => {
    var active = value === t.id;
    return React.createElement("button", {
      key: t.id,
      onClick: () => t.enabled && onChange(t.id),
      disabled: !t.enabled,
      className: "mono",
      style: {
        flex: 1,
        padding: "8px 6px",
        background: active ? "var(--ember)" : "transparent",
        color: active ? "#fff" : t.enabled ? "var(--muted)" : "rgba(26,18,13,0.25)",
        border: "none",
        borderRadius: 999,
        cursor: t.enabled ? "pointer" : "default",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: 1.3,
        fontWeight: 700,
        transform: active ? "scale(1)" : "scale(0.95)",
        transition: "all 0.25s var(--ease-spring)"
      }
    }, t.label);
  }));
}
function F1TonightHero({
  state,
  setState,
  parallax = 0
}) {
  var now = Date.now();
  var isPreEvent = now < FESTIVAL_START_MS;
  var isPostEvent = now > FESTIVAL_END_MS;
  var day = NOW.day;
  var dayMeta = FESTIVAL_CONFIG.dayDates[day];
  var savedIds = state.saved || [];
  var live = (() => {
    if (isPreEvent || isPostEvent) return null;
    var nowMin = toNightMin(NOW.time);
    var allLive = ARTISTS.filter(a => {
      if (a.day !== day) return false;
      return nowMin >= toNightMin(a.start) && nowMin < toNightMin(a.end);
    });
    return allLive.find(a => a.stage === FESTIVAL_CONFIG.mainStageId) || [...allLive].sort((a, b) => (b.tier || 0) - (a.tier || 0))[0] || null;
  })();
  var headliner = (() => {
    var savedTonight = ARTISTS.filter(a => a.day === day && savedIds.includes(a.id)).sort((a, b) => (b.tier || 0) - (a.tier || 0) || toNightMin(b.end) - toNightMin(b.start) - (toNightMin(a.end) - toNightMin(a.start)));
    if (savedTonight.length) return savedTonight[0];
    return [...ARTISTS].filter(a => a.day === day).sort((a, b) => (b.tier || 0) - (a.tier || 0))[0] || null;
  })();
  var spotlight = (() => {
    if (!isPreEvent) return null;
    var headliners = ARTISTS.filter(a => a.tier === 3).sort((a, b) => a.id.localeCompare(b.id));
    if (!headliners.length) return null;
    var dayIndex = Math.floor(Date.now() / 86400000) % headliners.length;
    return headliners[dayIndex];
  })();
  var featured = live || headliner || spotlight;
  var stage = featured ? STAGES.find(s => s.id === featured.stage) : null;
  var stageAccent = stage?.color || "var(--ember)";
  var accent = now < FESTIVAL_START_MS && festivalAccent() || stageAccent;
  var photo = useArtistPhoto(featured?.name || "");
  var preCd = isPreEvent ? preEventCountdown(savedIds) : null;
  var preDawn = !!preCd && preCd.days === 0 && beforeFestivalSunrise(now);
  var skyProgress = (() => {
    if (!preCd) return 1;
    var from = skyFillStartMs(preCd.targetMs);
    var span = preCd.targetMs - from;
    if (!(span > 0)) return 1;
    return Math.max(0, Math.min(1, (now - from) / span));
  })();
  var firstSetMs = dayMeta && !isPreEvent && !isPostEvent ? (() => {
    var todays = ARTISTS.filter(a => a.day === day).sort((x, y) => toNightMin(x.start) - toNightMin(y.start));
    var first = todays[0];
    if (!first) return null;
    return festivalNightDate(day, first.start).getTime();
  })() : null;
  var beforeFirstSet = !isPreEvent && !isPostEvent && firstSetMs && now < firstSetMs;
  var doorsLabel = beforeFirstSet ? fmtCountdown(firstSetMs - now) : null;
  var phase = isPreEvent ? "pre" : live ? "live" : beforeFirstSet ? "doors" : "between";
  return React.createElement("div", {
    style: {
      background: "linear-gradient(160deg, #1a120d 0%, #2a1a1f 60%, #1a120d 100%)",
      borderRadius: 16,
      padding: 0,
      marginBottom: 18,
      color: "#fff",
      position: "relative",
      overflow: "hidden",
      border: `1px solid ${accent}55`
    }
  }, React.createElement("div", {
    style: {
      height: 4,
      background: accent
    }
  }), photo && React.createElement("div", {
    style: {
      position: "absolute",
      top: 4,
      left: 0,
      right: 0,
      bottom: -20,
      backgroundImage: `url(${photo})`,
      backgroundSize: "cover",
      backgroundPosition: "center 18%",
      opacity: phase === "pre" ? 0.22 : 0.32,
      transform: `translateY(${-parallax * 0.3}px) scale(1.08)`,
      willChange: "transform"
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      top: 4,
      left: 0,
      right: 0,
      bottom: 0,
      background: phase === "pre" ? `linear-gradient(180deg, rgba(26,18,13,0.6) 0%, rgba(26,18,13,0.85) 100%)` : `radial-gradient(120% 80% at 80% 0%, ${accent}30, transparent 55%), linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.55) 100%)`,
      pointerEvents: "none"
    }
  }), React.createElement("div", {
    style: {
      position: "relative",
      padding: "16px 18px 18px"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.8,
      color: accent,
      fontWeight: 800
    }
  }, phase === "pre" ? `${FESTIVAL_CONFIG.brand.toUpperCase()} ${FESTIVAL_CONFIG.year}` : phase === "live" ? `● LIVE · ${stage?.name?.toUpperCase() || ""}` : `TONIGHT · ${dayMeta?.name?.toUpperCase() || "DAY " + day}`), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "rgba(255,255,255,0.55)",
      fontWeight: 600
    }
  }, phase === "pre" ? FESTIVAL_CONFIG.dates.toUpperCase() : `NIGHT ${day} / ${DAYS.length}`)), phase === "pre" && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      margin: "-2px -18px 16px"
    }
  }, React.createElement(FestivalSkyBand, {
    accent: accent,
    progress: skyProgress,
    preDawn: preDawn
  })), React.createElement("div", {
    style: {
      fontSize: 28,
      lineHeight: 0.96,
      letterSpacing: -0.5,
      marginBottom: 6,
      fontWeight: 600
    }
  }, FESTIVAL_CONFIG.dayDates[1]?.short, " · ", React.createElement("span", {
    className: "serif",
    style: {
      fontStyle: "italic",
      fontWeight: 400,
      color: accent
    }
  }, FESTIVAL_CONFIG.brand)), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(255,255,255,0.7)",
      lineHeight: 1.4,
      marginBottom: spotlight ? 16 : 0
    }
  }, preCd && preCd.days === 0 ? `gates in ${preCd.hours}h ${preCd.mins}m${preDawn ? " — sleep." : "."}` : `${FESTIVAL_CONFIG.locationShort} · gates open ${FESTIVAL_CONFIG.dayDates[1]?.name || "Friday"}.`), spotlight && (() => {
    var sStage = STAGES.find(s => s.id === spotlight.stage);
    return React.createElement("button", {
      onClick: () => setState({
        ...state,
        artist: spotlight.id
      }),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 12px",
        borderRadius: 12,
        background: `rgba(255,255,255,0.06)`,
        border: `1px solid ${sStage?.color || accent}33`,
        cursor: "pointer",
        textAlign: "left",
        color: "#fff"
      }
    }, React.createElement(ArtistSwatch, {
      artist: spotlight,
      size: 44
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.6,
        color: sStage?.color || accent,
        fontWeight: 800,
        marginBottom: 3
      }
    }, "ARTIST OF THE DAY"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 20,
        lineHeight: 1,
        letterSpacing: -0.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, spotlight.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 0.8,
        color: "rgba(255,255,255,0.55)",
        marginTop: 3
      }
    }, sStage?.name?.toUpperCase() || "", " · DAY ", spotlight.day, " · ", fmt12(spotlight.start))), React.createElement("div", {
      style: {
        color: "rgba(255,255,255,0.4)",
        fontSize: 16,
        flexShrink: 0
      }
    }, "→"));
  })()), phase === "live" && featured && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 10
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 7,
      background: accent,
      boxShadow: `0 0 0 4px ${accent}33`,
      animation: "pulse 1.6s ease-in-out infinite"
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "rgba(255,255,255,0.75)",
      fontWeight: 600
    }
  }, "NOW · ", featured.genre.toUpperCase())), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 34,
      lineHeight: 0.95,
      letterSpacing: -0.4,
      marginBottom: 6
    }
  }, featured.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: "rgba(255,255,255,0.7)",
      marginBottom: 14
    }
  }, fmt12(featured.start), " – ", fmt12(featured.end)), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "map",
      focusStage: featured.stage
    }),
    style: homeBtn("solid")
  }, "Navigate"), React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: featured.id
    }),
    style: homeBtn("ghost")
  }, "Details"))), phase === "doors" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 0.96,
      letterSpacing: -0.4,
      marginBottom: 6
    }
  }, dayMeta?.name || "Day " + day, " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: accent
    }
  }, "Night")), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10,
      marginBottom: 14,
      padding: "8px 12px",
      borderRadius: 10,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.12)"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: accent,
      fontWeight: 800
    }
  }, "DOORS IN"), React.createElement("div", {
    style: {
      fontFamily: "Geist Mono, monospace",
      fontSize: 20,
      fontWeight: 600,
      color: "#fff",
      letterSpacing: 0.5,
      fontVariantNumeric: "tabular-nums",
      marginLeft: "auto"
    }
  }, doorsLabel || "SOON")), featured && React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: featured.id
    }),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer",
      textAlign: "left",
      color: "#fff"
    }
  }, React.createElement("div", {
    style: {
      width: 3,
      alignSelf: "stretch",
      background: accent,
      borderRadius: 3,
      minHeight: 36
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
      letterSpacing: 1.4,
      color: accent,
      fontWeight: 700
    }
  }, savedIds.includes(featured.id) ? "YOUR HEADLINER" : "TONIGHT'S HEADLINER"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05,
      marginTop: 2
    }
  }, featured.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.6)",
      marginTop: 2
    }
  }, stage?.short || "", " · ", fmt12(featured.start))))), phase === "between" && React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 28,
      lineHeight: 0.96,
      letterSpacing: -0.4,
      marginBottom: 6
    }
  }, "Stage ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: accent
    }
  }, "changeover")), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(255,255,255,0.7)",
      lineHeight: 1.4,
      marginBottom: 12
    }
  }, "Decks are quiet between sets — your next pick is queued below."), featured && React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: featured.id
    }),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 12,
      padding: "10px 12px",
      cursor: "pointer",
      textAlign: "left",
      color: "#fff"
    }
  }, React.createElement("div", {
    style: {
      width: 3,
      alignSelf: "stretch",
      background: accent,
      borderRadius: 3,
      minHeight: 36
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
      letterSpacing: 1.4,
      color: accent,
      fontWeight: 700
    }
  }, "UP NEXT TONIGHT"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05,
      marginTop: 2
    }
  }, featured.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "rgba(255,255,255,0.6)",
      marginTop: 2
    }
  }, stage?.short || "", " · ", fmt12(featured.start)))))));
}
function LastNightRecap({
  state,
  setState
}) {
  var day = NOW.day;
  var prevDay = day - 1;
  if (prevDay < 1 || prevDay > 3) return null;
  var meta = FESTIVAL_CONFIG.dayDates[prevDay];
  var savedIds = state.saved || [];
  var score = a => {
    var dur = Math.max(20, toNightMin(a.end) - toNightMin(a.start));
    return (a.tier || 1) * 100 + dur;
  };
  var yoursLastNight = ARTISTS.filter(a => a.day === prevDay && savedIds.includes(a.id)).sort((a, b) => score(b) - score(a));
  var podiumSource = yoursLastNight.length ? yoursLastNight : ARTISTS.filter(a => a.day === prevDay).sort((a, b) => score(b) - score(a));
  var top3 = podiumSource.slice(0, 3);
  if (!top3.length) return null;
  var setsCaught = yoursLastNight.length;
  var totalMin = yoursLastNight.reduce((sum, a) => sum + Math.max(0, toNightMin(a.end) - toNightMin(a.start)), 0);
  var stageCounts = yoursLastNight.reduce((acc, a) => {
    acc[a.stage] = (acc[a.stage] || 0) + 1;
    return acc;
  }, {});
  var topStageId = Object.entries(stageCounts).sort((x, y) => y[1] - x[1])[0]?.[0];
  var topStage = topStageId ? STAGES.find(s => s.id === topStageId) : null;
  var PodiumRow = ({
    artist,
    place
  }) => {
    var stage = STAGES.find(s => s.id === artist.stage);
    var heights = {
      1: 78,
      2: 60,
      3: 48
    };
    var colors = {
      1: "var(--ember)",
      2: "var(--flare)",
      3: "var(--horizon)"
    };
    return React.createElement("button", {
      onClick: () => setState({
        ...state,
        tab: "home",
        artist: artist.id
      }),
      style: {
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: colors[place],
        fontWeight: 800,
        marginBottom: 4
      }
    }, place === 1 ? "1ST · HEADLINER" : place === 2 ? "2ND" : "3RD"), React.createElement("div", {
      style: {
        height: heights[place],
        background: stage?.color || "var(--paper-2)",
        borderRadius: 10,
        padding: "8px 10px",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end"
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: place === 1 ? 17 : 13,
        lineHeight: 1.05,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, artist.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1,
        color: "rgba(255,255,255,0.85)",
        marginTop: 2
      }
    }, stage?.short || "", " · ", fmt12(artist.start))));
  };
  return React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 32,
      lineHeight: 0.95,
      letterSpacing: -0.4,
      marginBottom: 4
    }
  }, meta?.name || "Day " + prevDay, " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "Night")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.4,
      color: "var(--muted)",
      fontWeight: 600,
      marginBottom: 14
    }
  }, meta?.short, " · ", yoursLastNight.length ? "YOUR PODIUM" : "TOP BILLED"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 0,
      marginBottom: 14,
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 12,
      overflow: "hidden"
    }
  }, [{
    label: "SETS",
    value: setsCaught || "—"
  }, {
    label: "HOURS",
    value: totalMin ? (totalMin / 60).toFixed(1) : "—"
  }, {
    label: "TOP STAGE",
    value: topStage?.short || "—",
    color: topStage?.color
  }].map((s, i) => React.createElement("div", {
    key: s.label,
    style: {
      flex: 1,
      padding: "10px 12px",
      borderLeft: i > 0 ? "1px solid var(--line)" : "none"
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      fontWeight: 600
    }
  }, s.label), React.createElement("div", {
    style: {
      fontFamily: "Geist Mono, monospace",
      fontSize: 18,
      fontWeight: 600,
      color: s.color || "var(--ink)",
      marginTop: 3,
      lineHeight: 1
    }
  }, s.value)))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "flex-end"
    }
  }, top3[1] ? React.createElement(PodiumRow, {
    artist: top3[1],
    place: 2
  }) : React.createElement("div", {
    style: {
      flex: 1
    }
  }), top3[0] ? React.createElement(PodiumRow, {
    artist: top3[0],
    place: 1
  }) : React.createElement("div", {
    style: {
      flex: 1
    }
  }), top3[2] ? React.createElement(PodiumRow, {
    artist: top3[2],
    place: 3
  }) : React.createElement("div", {
    style: {
      flex: 1
    }
  })), !yoursLastNight.length && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)",
      textAlign: "center",
      marginTop: 12
    }
  }, "NO SAVED SETS LAST NIGHT — SHOWING TOP-BILLED INSTEAD"));
}
function UpcomingTeaser({
  state,
  setState
}) {
  var now = Date.now();
  var isPreEvent = now < FESTIVAL_START_MS;
  var savedIds = state.saved || [];
  var upcomingDays = (() => {
    if (isPreEvent) return [1, 2, 3];
    var next = NOW.day + 1;
    return next <= 3 ? [next] : [];
  })();
  if (!upcomingDays.length) {
    return React.createElement("div", {
      style: {
        border: "1px dashed var(--line-2)",
        borderRadius: 14,
        padding: "24px 16px",
        textAlign: "center"
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        color: "var(--muted)",
        fontStyle: "italic"
      }
    }, "No more nights ahead"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        marginTop: 6
      }
    }, "THIS IS THE LAST NIGHT — MAKE IT COUNT"));
  }
  return React.createElement("div", null, upcomingDays.map(day => {
    var meta = FESTIVAL_CONFIG.dayDates[day];
    var dayStartMs = festivalNightDate(day, "18:00").getTime();
    var countdownLabel = dayStartMs > now ? fmtCountdown(dayStartMs - now) : null;
    var todays = ARTISTS.filter(a => a.day === day);
    var saved = todays.filter(a => savedIds.includes(a.id)).sort((a, b) => (b.tier || 0) - (a.tier || 0));
    var topPicks = todays.filter(a => !savedIds.includes(a.id)).sort((a, b) => (b.tier || 0) - (a.tier || 0));
    var highlights = [...saved, ...topPicks].slice(0, 4);
    return React.createElement("div", {
      key: day,
      style: {
        marginBottom: 14,
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: "14px 16px"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10
      }
    }, React.createElement("div", null, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "var(--ember-ink)",
        fontWeight: 700
      }
    }, meta?.short, " · ", meta?.name?.toUpperCase()), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 24,
        lineHeight: 1.05,
        marginTop: 2
      }
    }, meta?.name, " ", React.createElement("span", {
      style: {
        fontStyle: "italic",
        color: "var(--muted)"
      }
    }, "night"))), countdownLabel && React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        fontWeight: 600,
        textAlign: "right"
      }
    }, "IN ", countdownLabel)), highlights.length === 0 ? React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)",
        padding: "10px 0",
        textAlign: "center"
      }
    }, "NO SETS SCHEDULED") : highlights.map(a => {
      var stage = STAGES.find(s => s.id === a.stage);
      var isSaved = savedIds.includes(a.id);
      return React.createElement("button", {
        key: a.id,
        onClick: () => setState({
          ...state,
          tab: "home",
          artist: a.id
        }),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid var(--line-2)",
          padding: "8px 0",
          cursor: "pointer",
          textAlign: "left"
        }
      }, React.createElement("div", {
        style: {
          width: 3,
          alignSelf: "stretch",
          background: stage?.color,
          borderRadius: 3,
          minHeight: 30
        }
      }), React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6
        }
      }, React.createElement("div", {
        className: "serif",
        style: {
          fontSize: 16,
          lineHeight: 1.1,
          color: "var(--ink)"
        }
      }, a.name), isSaved && React.createElement("svg", {
        width: "10",
        height: "10",
        viewBox: "0 0 24 24",
        fill: stage?.color,
        stroke: "none"
      }, React.createElement("path", {
        d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
      }))), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 1,
          color: "var(--muted)",
          marginTop: 1
        }
      }, stage?.short, " · ", fmt12(a.start), "–", fmt12(a.end))));
    }));
  }));
}
function HomeScreen({
  state,
  setState
}) {
  var [alertsOpen, setAlertsOpen] = React.useState(false);
  var [firstTimerOpen, setFirstTimerOpen] = React.useState(false);
  var [offline, setOffline] = React.useState(state.offline || false);
  var [weatherAlertDismissed, setWeatherAlertDismissed] = React.useState(false);
  var [homeSubTab, setHomeSubTab] = React.useState("today");
  var [notifNudgeDismissed, setNotifNudgeDismissed] = React.useState(() => {
    try {
      return localStorage.getItem("notif_nudge_dismissed") === "1";
    } catch {
      return false;
    }
  });
  var [setupBannerDismissed, setSetupBannerDismissed] = React.useState(() => {
    try {
      return localStorage.getItem("setup_banner_dismissed") === "1";
    } catch {
      return false;
    }
  });
  React.useEffect(() => {
    if (setupBannerDismissed) return;
    if ((state.saved?.length || 0) === 0) return;
    try {
      localStorage.setItem("setup_banner_dismissed", "1");
    } catch {}
    setSetupBannerDismissed(true);
  }, [state.saved?.length, setupBannerDismissed]);
  var {
    perm: notifPerm,
    enable: enableNotifs
  } = useNotifications();
  var weatherAlert = useWeatherAlert();
  var ftSeen = (() => {
    try {
      return localStorage.getItem("ft_guide_seen") === "1";
    } catch {
      return false;
    }
  })();
  var [ftDismissed, setFtDismissed] = React.useState(ftSeen);
  useTick(60000);
  var countdown = preEventCountdown(state.saved);
  var isPostFestival = Date.now() > FESTIVAL_END_MS;
  React.useEffect(() => {
    var saved = state.saved || [];
    if (!saved.length || !navigator.onLine) return;
    if (typeof fetchAudioDB !== "function") return;
    var cached = {};
    try {
      cached = JSON.parse(localStorage.getItem("artist_images_v1") || "{}");
    } catch {}
    var missing = saved.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && !cached[a.name.toLowerCase()]).slice(0, 12);
    if (!missing.length) return;
    var live = true;
    (async () => {
      for (var a of missing) {
        if (!live) return;
        var img = null;
        try {
          img = (await fetchAudioDB(a.name, a.genre))?.image || null;
        } catch {}
        if (!live) return;
        if (img) {
          try {
            var imgs = JSON.parse(localStorage.getItem("artist_images_v1") || "{}");
            if (!imgs[a.name.toLowerCase()]) {
              imgs[a.name.toLowerCase()] = img;
              localStorage.setItem("artist_images_v1", JSON.stringify(imgs));
            }
          } catch {}
        }
        await new Promise(r => setTimeout(r, 400));
      }
    })();
    return () => {
      live = false;
    };
  }, [state.saved?.length]);
  var current = ARTISTS.find(a => a.id === NOW.currentArtistId) || null;
  var next = ARTISTS.find(a => a.id === NOW.nextArtistId) || null;
  var stageOf = id => STAGES.find(s => s.id === id);
  var currentPhoto = useArtistPhoto(current?.name || "");
  var totalMin = current ? Math.max(1, toNightMin(current.end) - toNightMin(current.start)) : 90;
  var progress = current ? Math.min(1, NOW.elapsedMin / totalMin) : 0;
  var minsLeft = current ? Math.max(0, totalMin - NOW.elapsedMin) : 0;
  var upNextMin = next ? Math.max(0, toNightMin(next.start) - toNightMin(NOW.time)) : 0;
  var tonight = buildTonightsPlan(state);
  var liveStrip = liveAcrossStages();
  var _dynAlerts = !countdown && state.saved?.length ? computeAlerts(state.saved, NOW.day, NOW.time) : [];
  var alerts = _dynAlerts.length ? _dynAlerts : state.alerts || ALERTS;
  var unread = alerts.filter(a => a.unread).length;
  var [heroParallax, setHeroParallax] = React.useState(0);
  var scrollRef = React.useRef(null);
  var handleHomeScroll = React.useCallback(() => {
    var el = scrollRef.current;
    if (el) setHeroParallax(Math.min(el.scrollTop * 0.35, 80));
  }, []);
  var [pullRefresh, setPullRefresh] = React.useState(false);
  var _prRef = React.useRef({
    startY: 0,
    pulling: false
  });
  var handlePullStart = e => {
    _prRef.current = {
      startY: e.touches[0].clientY,
      pulling: false
    };
  };
  var handlePullMove = e => {
    var el = e.currentTarget;
    if (el.scrollTop > 0) return;
    var dy = e.touches[0].clientY - _prRef.current.startY;
    if (dy > 60 && !_prRef.current.pulling) {
      _prRef.current.pulling = true;
      setPullRefresh(true);
      navigator.vibrate?.([15]);
      setTimeout(() => {
        setPullRefresh(false);
        window.location.reload();
      }, 600);
    }
  };
  return React.createElement(Screen, {
    bg: "var(--paper)"
  }, React.createElement(ScrollBody, {
    ref: scrollRef,
    onScroll: handleHomeScroll,
    style: {
      padding: "0 0 70px"
    },
    onTouchStart: handlePullStart,
    onTouchMove: handlePullMove
  }, pullRefresh && React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      padding: "12px 0"
    }
  }, React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: "50%",
      border: "2px solid var(--line)",
      borderTopColor: "var(--ember)",
      animation: "spin 0.8s linear infinite"
    }
  })), React.createElement("div", {
    style: {
      padding: "8px 20px 14px",
      background: "linear-gradient(180deg, var(--paper) 0%, var(--paper-2) 100%)",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, React.createElement(Wordmark, {
    size: 16
  }), React.createElement(FestivalChip, {
    compact: true
  })), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("button", {
    onClick: () => setOffline(o => !o),
    title: "Offline mode",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      background: offline ? "var(--ink)" : "transparent",
      color: offline ? "var(--paper)" : "var(--muted)",
      border: offline ? "none" : "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "3px 8px",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2"
  }, offline ? React.createElement(React.Fragment, null, React.createElement("path", {
    d: "M4 4 L20 20"
  }), React.createElement("path", {
    d: "M2 8 Q6 4 10 4.5 M22 8 Q18 4 14 4.5"
  }), React.createElement("path", {
    d: "M6 12 Q12 7 18 12",
    opacity: "0.5"
  })) : React.createElement(React.Fragment, null, React.createElement("path", {
    d: "M2 8 Q12 -2 22 8"
  }), React.createElement("path", {
    d: "M5 12 Q12 5 19 12"
  }), React.createElement("path", {
    d: "M8 16 Q12 12 16 16"
  }), React.createElement("circle", {
    cx: "12",
    cy: "19.5",
    r: "0.8",
    fill: "currentColor"
  }))), offline ? "OFF" : !countdown && !isPostFestival ? "LIVE" : "ON"), React.createElement("button", {
    onClick: () => setAlertsOpen(true),
    "aria-label": "Alerts",
    style: {
      position: "relative",
      background: "transparent",
      border: "none",
      padding: 4,
      cursor: "pointer",
      color: "var(--ink)"
    }
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M6 9 C6 5.5 8.5 3 12 3 C15.5 3 18 5.5 18 9 L18 13 L20 16 L4 16 L6 13 Z"
  }), React.createElement("path", {
    d: "M10 19 Q12 21 14 19"
  })), unread > 0 && React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: 8,
      background: "var(--ember)",
      border: "1.5px solid var(--paper)"
    }
  })), !countdown && !isPostFestival && React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)"
    }
  }, "DAY ", NOW.day, " · ", NOW.time))), countdown ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 0.95,
      letterSpacing: -0.5
    }
  }, (() => {
    var words = (FESTIVAL_CONFIG.tagline || "Under the electric sky").split(/\s/);
    var last = words.pop();
    return React.createElement(React.Fragment, null, words.join(" "), " ", React.createElement("span", {
      style: {
        fontStyle: "italic",
        color: "var(--ember-ink)"
      }
    }, last), " in");
  })()), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 14,
      marginTop: 10
    }
  }, React.createElement(CountdownPart, {
    n: countdown.days,
    label: "DAYS"
  }), React.createElement(CountdownPart, {
    n: countdown.hours,
    label: "HRS"
  }), React.createElement(CountdownPart, {
    n: countdown.mins,
    label: "MIN"
  })), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: "var(--muted)",
      marginTop: 8
    }
  }, FESTIVAL_CONFIG.locationShort.toUpperCase(), " · ", FESTIVAL_CONFIG.dates.toUpperCase())) : isPostFestival ? React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 0.95,
      letterSpacing: -0.5
    }
  }, FESTIVAL_CONFIG.brand, " ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, FESTIVAL_CONFIG.year), " — that's a wrap."), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: "var(--muted)",
      marginTop: 6,
      marginBottom: 14
    }
  }, FESTIVAL_CONFIG.locationShort.toUpperCase(), " · ", FESTIVAL_CONFIG.dates.toUpperCase()), (() => {
    var attendedCount = typeof window.getAttendedCount === "function" ? window.getAttendedCount() : 0;
    if (attendedCount === 0) return null;
    return React.createElement("button", {
      onClick: () => setState(s => ({
        ...s,
        tab: "recap"
      })),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        marginTop: 6,
        padding: "13px 14px",
        background: "linear-gradient(135deg, var(--ink) 0%, var(--horizon) 90%, var(--ember) 130%)",
        border: "none",
        borderRadius: 16,
        color: "var(--paper)",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: "0 4px 18px rgba(123,61,154,0.28)"
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
    }, "weekend"), ", recapped"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "rgba(247,237,224,0.7)",
        marginTop: 4,
        fontWeight: 700
      }
    }, attendedCount, " SET", attendedCount === 1 ? "" : "S", " CAUGHT · TAP TO SEE THE FULL RECAP")), React.createElement("span", {
      style: {
        fontSize: 18,
        opacity: 0.75
      }
    }, "→"));
  })()) : React.createElement(React.Fragment, null, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 36,
      lineHeight: 0.95,
      letterSpacing: -0.5
    }
  }, FESTIVAL_CONFIG.dayDates[NOW.day]?.name || "Day " + NOW.day, " at ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, FESTIVAL_CONFIG.brand)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      color: "var(--muted)",
      marginTop: 6
    }
  }, FESTIVAL_CONFIG.locationShort.toUpperCase(), " · ", FESTIVAL_CONFIG.dates.toUpperCase()))), (() => {
    var ip = useInstallPrompt();
    var userName = "";
    try {
      userName = localStorage.getItem("user_name") || "";
    } catch {}
    var showSetup = !setupBannerDismissed && !userName && !state.spotifyConnected;
    var showInstall = !showSetup && ip.canInstall;
    var showNotif = !showSetup && !showInstall && state.saved.length > 0 && notifPerm === "default" && !notifNudgeDismissed;
    var showWeather = !showSetup && !showInstall && !showNotif && weatherAlert && !weatherAlertDismissed;
    if (showSetup) return React.createElement("div", {
      style: {
        padding: "8px 16px 0"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "linear-gradient(135deg, rgba(232,93,46,0.12), rgba(123,61,154,0.10))",
        border: "1px solid rgba(232,93,46,0.4)",
        borderRadius: 14,
        padding: "12px 12px"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 18,
        flexShrink: 0
      }
    }, "✦"), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        color: "var(--ink)",
        lineHeight: 1.4
      }
    }, "Personalize Plursky — name, Spotify, reminders."), React.createElement("button", {
      onClick: () => window.plurskyOpenOnboarding?.(),
      style: {
        background: "var(--ink)",
        color: "var(--paper)",
        border: "none",
        borderRadius: 999,
        padding: "5px 11px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        flexShrink: 0
      }
    }, "SET UP"), React.createElement("button", {
      onClick: () => {
        try {
          localStorage.setItem("setup_banner_dismissed", "1");
        } catch {}
        setSetupBannerDismissed(true);
      },
      "aria-label": "Dismiss",
      style: {
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        fontSize: 18,
        cursor: "pointer",
        flexShrink: 0,
        lineHeight: 1
      }
    }, "×")));
    if (showInstall) return React.createElement(InstallBanner, null);
    if (showNotif) return React.createElement("div", {
      style: {
        padding: "8px 16px 0"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(123,61,154,0.1)",
        border: "1px solid rgba(123,61,154,0.35)",
        borderRadius: 14,
        padding: "12px 12px"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 18,
        flexShrink: 0
      }
    }, "🔔"), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 13,
        color: "var(--ink)",
        lineHeight: 1.4
      }
    }, "Get notified 15 min before each saved set"), React.createElement("button", {
      onClick: async () => {
        await enableNotifs();
        setNotifNudgeDismissed(true);
        try {
          localStorage.setItem("notif_nudge_dismissed", "1");
        } catch {}
      },
      style: {
        background: "var(--horizon)",
        color: "#fff",
        border: "none",
        borderRadius: 999,
        padding: "5px 11px",
        cursor: "pointer",
        fontFamily: "Geist Mono, monospace",
        fontSize: 9,
        letterSpacing: 1.2,
        fontWeight: 700,
        flexShrink: 0
      }
    }, "ENABLE"), React.createElement("button", {
      onClick: () => {
        setNotifNudgeDismissed(true);
        try {
          localStorage.setItem("notif_nudge_dismissed", "1");
        } catch {}
      },
      "aria-label": "Dismiss",
      style: {
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        fontSize: 18,
        cursor: "pointer",
        flexShrink: 0,
        lineHeight: 1
      }
    }, "×")));
    if (showWeather) return React.createElement("div", {
      style: {
        padding: "8px 16px 0"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "rgba(251,191,36,0.12)",
        border: "1px solid rgba(251,191,36,0.4)",
        borderRadius: 14,
        padding: "12px 14px"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 18,
        flexShrink: 0
      }
    }, "⚠️"), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.4,
        color: "#fbbf24",
        fontWeight: 700,
        marginBottom: 3
      }
    }, "NWS WEATHER ALERT"), React.createElement("div", {
      style: {
        fontSize: 13,
        color: "var(--ink)",
        lineHeight: 1.4
      }
    }, weatherAlert.shortForecast, " — check the weather card below for details.")), React.createElement("button", {
      onClick: () => setWeatherAlertDismissed(true),
      "aria-label": "Dismiss",
      style: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "var(--muted)",
        fontSize: 18,
        lineHeight: 1,
        padding: "0 2px",
        flexShrink: 0
      }
    }, "×")));
    return null;
  })(), countdown && !ftDismissed && React.createElement("div", {
    style: {
      padding: "10px 20px 0"
    }
  }, React.createElement("button", {
    onClick: () => setFirstTimerOpen(true),
    style: {
      background: "transparent",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "5px 10px",
      color: "var(--muted)",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 600
    }
  }, "FIRST ", FESTIVAL_CONFIG.brand || "TIME", "? READ THE BASICS →")), !countdown && !isPostFestival && React.createElement("div", {
    style: {
      padding: "10px 16px 4px"
    }
  }, React.createElement(DayStrip, {
    value: homeSubTab,
    onChange: setHomeSubTab,
    hasYesterday: NOW.day > 1,
    hasUpcoming: NOW.day < 3
  })), React.createElement("div", {
    ref: useStaggerFade(),
    style: {
      padding: "16px 16px 24px"
    }
  }, homeSubTab === "yesterday" && React.createElement(LastNightRecap, {
    state: state,
    setState: setState
  }), homeSubTab === "upcoming" && React.createElement(UpcomingTeaser, {
    state: state,
    setState: setState
  }), (homeSubTab === "today" || isPostFestival) && React.createElement(React.Fragment, null, isPostFestival && React.createElement(PostFestivalRecap, {
    state: state,
    setState: setState
  }), !isPostFestival && React.createElement("div", {
    "data-animate": true
  }, React.createElement(F1TonightHero, {
    state: state,
    setState: setState,
    parallax: heroParallax
  })), !countdown && !isPostFestival && React.createElement(React.Fragment, null, current && React.createElement("div", {
    style: {
      background: currentPhoto ? "#000" : current.img,
      borderRadius: 22,
      padding: 18,
      color: "#fff",
      position: "relative",
      overflow: "hidden",
      marginBottom: 14
    }
  }, currentPhoto && React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `url(${currentPhoto})`,
      backgroundSize: "cover",
      backgroundPosition: "center 15%",
      opacity: 0.55
    }
  }), React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: currentPhoto ? "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)" : "radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.18), transparent 60%), linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.35) 100%)",
      pointerEvents: "none"
    }
  }), React.createElement("div", {
    style: {
      position: "relative"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 14
    }
  }, React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 7,
      background: "#fff",
      boxShadow: "0 0 0 4px rgba(255,255,255,0.25)",
      animation: "pulse 1.6s ease-in-out infinite"
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 2,
      fontWeight: 600
    }
  }, "NOW PLAYING · ", stageOf(current.stage)?.name?.toUpperCase() || "")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 34,
      lineHeight: 0.96,
      letterSpacing: -0.5,
      marginBottom: 4
    }
  }, current.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      opacity: 0.85,
      marginBottom: 22
    }
  }, current.genre.toUpperCase(), " · ", fmt12(current.start), "–", fmt12(current.end)), React.createElement("div", {
    style: {
      height: 3,
      background: "rgba(255,255,255,0.25)",
      borderRadius: 3,
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      width: `${progress * 100}%`,
      height: "100%",
      background: "#fff"
    }
  })), React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 6
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      opacity: 0.8
    }
  }, NOW.elapsedMin, " MIN IN"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      opacity: 0.8
    }
  }, minsLeft, " MIN LEFT")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 16
    }
  }, React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "map",
      focusStage: current.stage
    }),
    style: homeBtn("solid")
  }, "Navigate to stage"), React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: current.id
    }),
    style: homeBtn("ghost")
  }, "Details"), (() => {
    var isSaved = (state.saved || []).includes(current.id);
    return React.createElement("button", {
      onClick: () => {
        try {
          navigator.vibrate([30]);
        } catch {}
        var saved = state.saved || [];
        setState({
          ...state,
          saved: isSaved ? saved.filter(id => id !== current.id) : [...saved, current.id]
        });
      },
      title: isSaved ? "Unsave set" : "Save set",
      "aria-label": isSaved ? "Unsave set" : "Save set",
      "aria-pressed": isSaved,
      style: {
        marginLeft: "auto",
        background: "transparent",
        border: "1.5px solid rgba(255,255,255,0.4)",
        borderRadius: 999,
        width: 36,
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: isSaved ? "#fff" : "rgba(255,255,255,0.6)",
        flexShrink: 0
      }
    }, React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: isSaved ? "#fff" : "none",
      stroke: "#fff",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
    })));
  })()))), next && React.createElement("div", {
    style: {
      background: "var(--paper-2)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 14,
      marginBottom: 18,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, React.createElement(ArtistSwatch, {
    artist: next,
    size: 48
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "var(--muted)"
    }
  }, "UP NEXT · ", upNextMin > 0 ? `IN ${upNextMin} MIN` : "STARTING"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.05,
      marginTop: 2
    }
  }, next.name), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: "var(--muted)",
      marginTop: 2
    }
  }, stageOf(next.stage)?.name?.toUpperCase() || "", " · ", fmt12(next.start))), React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: next.id
    }),
    style: {
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 999,
      padding: "8px 12px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 500
    }
  }, "OPEN")), React.createElement(LiveAcrossStrip, {
    strip: liveStrip,
    setState: setState,
    state: state
  }), React.createElement(TonightsPlan, {
    plan: tonight,
    setState: setState,
    state: state
  })), countdown && (() => {
    var headliners = ARTISTS.filter(a => a.tier >= 2).sort((a, b) => b.tier - a.tier || a.day - b.day || toNightMin(a.start) - toNightMin(b.start)).slice(0, 9);
    if (!headliners.length) return null;
    var dayGroups = [1, 2, 3].map(d => ({
      day: d,
      meta: FESTIVAL_CONFIG.dayDates[d],
      artists: headliners.filter(a => a.day === d).slice(0, 3)
    })).filter(g => g.artists.length);
    return React.createElement("div", {
      style: {
        marginTop: 18
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 10,
        letterSpacing: 1.6,
        color: "var(--muted)",
        fontWeight: 600,
        marginBottom: 10
      }
    }, "LINEUP HIGHLIGHTS"), React.createElement("div", {
      className: "no-scrollbar",
      style: {
        display: "flex",
        gap: 10,
        overflowX: "auto",
        scrollbarWidth: "none",
        marginRight: -16,
        paddingRight: 16
      }
    }, dayGroups.map(g => {
      var gateMs = g.meta?.midnightUtc ? g.meta.midnightUtc + 18 * 3600000 : 0;
      var daysUntil = gateMs > Date.now() ? Math.ceil((gateMs - Date.now()) / 86400000) : 0;
      return React.createElement("div", {
        key: g.day,
        style: {
          flexShrink: 0,
          width: 200,
          background: "var(--paper-2)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "12px 14px",
          overflow: "hidden"
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8
        }
      }, React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 1.6,
          color: "var(--ember-ink)",
          fontWeight: 700
        }
      }, g.meta?.name?.toUpperCase() || `DAY ${g.day}`), daysUntil > 0 && React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1,
          color: "var(--muted)"
        }
      }, daysUntil, "D")), g.artists.map(a => {
        var st = STAGES.find(s => s.id === a.stage);
        return React.createElement("button", {
          key: a.id,
          onClick: () => setState({
            ...state,
            artist: a.id
          }),
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            background: "transparent",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            textAlign: "left"
          }
        }, React.createElement("div", {
          style: {
            width: 3,
            height: 28,
            borderRadius: 3,
            background: st?.color || "var(--line-2)",
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
            fontSize: 14,
            lineHeight: 1.1,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }
        }, a.name), React.createElement("div", {
          className: "mono",
          style: {
            fontSize: 8,
            letterSpacing: 0.8,
            color: "var(--muted)",
            marginTop: 1
          }
        }, st?.short || "", " · ", fmt12(a.start))));
      }));
    })));
  })(), !isPostFestival && window.HomeMemoriesStrip && React.createElement(window.HomeMemoriesStrip, {
    state,
    setState
  }), React.createElement("div", {
    "data-animate": true
  }, !isPostFestival && React.createElement(TonightCard, {
    state: state,
    setState: setState
  })), React.createElement("div", {
    "data-animate": true
  }, !isPostFestival && React.createElement(DontMissStrip, {
    day: countdown ? 1 : NOW.day,
    state: state,
    setState: setState
  })), state.friendLineup?.length > 0 && React.createElement(FriendLineupBanner, {
    state: state,
    setState: setState
  }), state.saved?.length > 0 && typeof NotificationsCard === "function" && React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, React.createElement(NotificationsCard, {
    state: state
  })), countdown && (() => {
    var savedIds = state.saved || [];
    var byDay = [1, 2, 3].map(day => ({
      day,
      meta: FESTIVAL_CONFIG.dayDates[day],
      artists: ARTISTS.filter(a => a.day === day && savedIds.includes(a.id)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start))
    })).filter(d => d.artists.length);
    if (!byDay.length) return React.createElement("button", {
      onClick: () => setState({
        ...state,
        tab: "lineup"
      }),
      style: {
        width: "100%",
        background: "var(--paper-2)",
        border: "1px dashed var(--line)",
        borderRadius: 18,
        padding: "28px 20px",
        marginTop: 18,
        textAlign: "center",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        fontSize: 28,
        opacity: 0.4
      }
    }, "+"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 18,
        color: "var(--ink)",
        fontStyle: "italic"
      }
    }, "Build your lineup"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)"
      }
    }, "TAP TO BROWSE ", ARTISTS.length, " ARTISTS"));
    return React.createElement("div", {
      style: {
        marginTop: 22
      }
    }, React.createElement("div", {
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
    }, "lineup")), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.3,
        color: "var(--muted)"
      }
    }, savedIds.length, " SETS"), React.createElement(ShareLineupButton, {
      savedIds: savedIds
    }))), React.createElement("div", {
      style: {
        background: "var(--paper-2)",
        border: "1px solid var(--line)",
        borderRadius: 18,
        padding: "14px 16px 6px"
      }
    }, byDay.map(({
      day,
      meta,
      artists
    }) => {
      var rows = artists.map((a, i) => {
        var prev = artists[i - 1];
        var walk = prev ? stageWalkMinutes(prev.stage, a.stage) : 0;
        var prevEnd = prev ? toNightMin(prev.end) : null;
        var startMin = toNightMin(a.start);
        var tight = prev && walk > 0 && startMin - prevEnd < walk;
        var conflict = prev && overlaps(prev, a);
        return {
          a,
          prev,
          walk,
          tight,
          conflict
        };
      });
      var conflictCount = rows.filter(r => r.conflict).length;
      return React.createElement("div", {
        key: day,
        style: {
          marginBottom: 10
        }
      }, React.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8
        }
      }, React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 9,
          letterSpacing: 1.8,
          color: "var(--ember-ink)",
          fontWeight: 700
        }
      }, meta.short, " · ", meta.name.toUpperCase()), conflictCount > 0 && React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1.2,
          color: "var(--ember-ink)",
          padding: "1px 5px",
          borderRadius: 3,
          fontWeight: 700,
          border: "1px solid var(--ember)"
        }
      }, conflictCount, " CLASH")), rows.map(({
        a,
        prev,
        walk,
        tight,
        conflict
      }) => {
        var stage = STAGES.find(s => s.id === a.stage);
        return React.createElement("div", {
          key: a.id
        }, prev && walk > 0 && React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "2px 0 2px 46px"
          }
        }, React.createElement("div", {
          style: {
            width: 1,
            height: 14,
            background: tight ? "var(--ember)" : "var(--line-2)"
          }
        }), React.createElement("span", {
          className: "mono",
          style: {
            fontSize: 8,
            letterSpacing: 1.1,
            color: tight ? "var(--ember-ink)" : "var(--muted)",
            fontWeight: tight ? 700 : 500
          }
        }, walk, " MIN WALK · ", prev.stage === a.stage ? "SAME STAGE" : `${STAGES.find(s => s.id === prev.stage)?.short} → ${stage?.short}`)), React.createElement("button", {
          onClick: () => setState({
            ...state,
            artist: a.id
          }),
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            background: conflict ? "rgba(232,93,46,0.06)" : "transparent",
            border: "none",
            borderBottom: "1px solid var(--line-2)",
            padding: "8px 6px",
            cursor: "pointer",
            textAlign: "left"
          }
        }, React.createElement(ArtistSwatch, {
          artist: a,
          size: 36
        }), React.createElement("div", {
          style: {
            flex: 1,
            minWidth: 0
          }
        }, React.createElement("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6
          }
        }, React.createElement("div", {
          className: "serif",
          style: {
            fontSize: 16,
            lineHeight: 1.1,
            color: "var(--ink)"
          }
        }, a.name), conflict && React.createElement("span", {
          className: "mono",
          style: {
            fontSize: 8,
            letterSpacing: 1.2,
            color: "var(--ember-ink)",
            padding: "1px 4px",
            borderRadius: 3,
            fontWeight: 700,
            border: "1px solid var(--ember)"
          }
        }, "CLASH")), React.createElement("div", {
          className: "mono",
          style: {
            fontSize: 9,
            letterSpacing: 1,
            color: "var(--muted)",
            marginTop: 1
          }
        }, stage ? stage.short : "", " · ", fmt12(a.start), "–", fmt12(a.end)))));
      }));
    })));
  })()))), offline && React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      background: "var(--ink)",
      color: "var(--paper)",
      padding: "6px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      zIndex: 8
    }
  }, React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, React.createElement("path", {
    d: "M4 4 L20 20"
  }), React.createElement("circle", {
    cx: "12",
    cy: "18",
    r: "1",
    fill: "currentColor"
  })), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 600
    }
  }, "OFFLINE · LAST SYNC 10:41 PM · LINEUP & MAP AVAILABLE")), alertsOpen && React.createElement(AlertsDrawer, {
    alerts: alerts,
    onClose: () => {
      setAlertsOpen(false);
      setState({
        ...state,
        alerts: alerts.map(a => ({
          ...a,
          unread: false
        }))
      });
    },
    onOpenMap: () => {
      setAlertsOpen(false);
      setState({
        ...state,
        tab: "map"
      });
    },
    onOpenLineup: () => {
      setAlertsOpen(false);
      setState({
        ...state,
        tab: "lineup"
      });
    }
  }), firstTimerOpen && React.createElement(FirstTimerGuide, {
    onClose: () => {
      setFirstTimerOpen(false);
      setFtDismissed(true);
      try {
        localStorage.setItem("ft_guide_seen", "1");
      } catch {}
    },
    onOpenMap: () => {
      setFirstTimerOpen(false);
      setState({
        ...state,
        tab: "map"
      });
    },
    onOpenLineup: () => {
      setFirstTimerOpen(false);
      setState({
        ...state,
        tab: "lineup"
      });
    }
  }));
}
function LiveAcrossStrip({
  strip,
  state,
  setState
}) {
  var savedSet = new Set(state.saved || []);
  var liveCount = strip.filter(s => s.artist).length;
  return React.createElement("div", {
    style: {
      marginBottom: 18
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
      fontSize: 10,
      letterSpacing: 1.6,
      color: "var(--muted)",
      fontWeight: 600
    }
  }, "LIVE ACROSS STAGES"), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--ember-ink)"
    }
  }, liveCount, "/", strip.length, " ON")), React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 7,
      overflowX: "auto",
      scrollbarWidth: "none",
      marginRight: -16,
      paddingRight: 16
    }
  }, strip.map(({
    stage,
    artist,
    upcoming,
    minsUntil
  }) => {
    var isSaved = artist && savedSet.has(artist.id);
    var nextSaved = upcoming && savedSet.has(upcoming.id);
    return React.createElement("button", {
      key: stage.id,
      onClick: () => {
        if (artist) return setState({
          ...state,
          tab: "home",
          artist: artist.id
        });
        if (upcoming) return setState({
          ...state,
          tab: "home",
          artist: upcoming.id
        });
        setState({
          ...state,
          tab: "map",
          focusStage: stage.id
        });
      },
      style: {
        flexShrink: 0,
        width: 136,
        textAlign: "left",
        padding: "9px 11px",
        borderRadius: 13,
        background: isSaved ? `${stage.color}18` : artist ? "var(--paper-2)" : "transparent",
        border: `1px solid ${isSaved ? stage.color + "55" : artist ? "var(--line)" : "var(--line-2)"}`,
        borderLeft: `3px solid ${stage.color}`,
        cursor: "pointer",
        opacity: artist || upcoming ? 1 : 0.45
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 4
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 5
      }
    }, artist && React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 6,
        background: stage.color,
        boxShadow: `0 0 0 3px ${stage.color}33`,
        animation: "pulse 1.6s ease-in-out infinite",
        flexShrink: 0
      }
    }), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.2,
        color: stage.color,
        fontWeight: 700
      }
    }, stage.short)), isSaved && React.createElement("svg", {
      width: "9",
      height: "9",
      viewBox: "0 0 24 24",
      fill: stage.color,
      stroke: "none"
    }, React.createElement("path", {
      d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
    }))), artist ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 14,
        lineHeight: 1.1,
        marginTop: 4,
        color: "var(--ink)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, artist.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 2
      }
    }, fmt12(artist.start), "–", fmt12(artist.end))) : upcoming ? React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        fontSize: 10,
        lineHeight: 1.15,
        marginTop: 4,
        color: nextSaved ? stage.color : "var(--muted)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontStyle: "italic"
      }
    }, upcoming.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 2
      }
    }, "IN ", minsUntil, "m · ", fmt12(upcoming.start))) : React.createElement(React.Fragment, null, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 13,
        lineHeight: 1.1,
        marginTop: 4,
        color: "var(--muted)"
      }
    }, "Stage dark"), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        marginTop: 2
      }
    }, stage.name.toUpperCase())));
  })));
}
function TonightsPlan({
  plan,
  state,
  setState
}) {
  var tightCount = plan.filter(p => p.tight || p.conflict).length;
  var conflicts = plan.filter(p => p.conflict).map(p => [p.prev, p.artist]);
  var [resolverOpen, setResolverOpen] = React.useState(false);
  return React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 10
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      letterSpacing: -0.3
    }
  }, "Tonight's ", React.createElement("span", {
    style: {
      fontStyle: "italic"
    }
  }, "plan")), React.createElement("button", {
    onClick: () => setState({
      ...state,
      tab: "lineup"
    }),
    className: "mono",
    style: {
      background: "none",
      border: "none",
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)",
      cursor: "pointer",
      textTransform: "uppercase"
    }
  }, "All →")), plan.length === 0 ? React.createElement("div", {
    style: {
      border: "1px dashed var(--line-2)",
      borderRadius: 14,
      padding: "20px 16px",
      textAlign: "center"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 18,
      color: "var(--muted)",
      fontStyle: "italic"
    }
  }, "No sets saved for tonight"), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 6
    }
  }, "TAP + ON ANY ARTIST TO ADD")) : React.createElement(React.Fragment, null, tightCount > 0 && React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 10px",
      marginBottom: 10,
      background: "rgba(232,93,46,0.07)",
      borderRadius: 8,
      border: "1px solid rgba(232,93,46,0.2)"
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1.3,
      color: "var(--ember-ink)"
    }
  }, "⚠ ", tightCount, " TIGHT TRANSITION", tightCount > 1 ? "S" : "", " · CHECK LEAVE-BY TIMES"), conflicts.length > 0 && React.createElement("button", {
    onClick: () => setResolverOpen(r => !r),
    style: {
      background: resolverOpen ? "transparent" : "var(--ember)",
      color: resolverOpen ? "var(--ember-ink)" : "#fff",
      border: resolverOpen ? "1px solid var(--ember)" : "none",
      borderRadius: 6,
      padding: "4px 10px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, resolverOpen ? "CLOSE ×" : "RESOLVE →")), resolverOpen && conflicts.length > 0 && React.createElement("div", {
    style: {
      margin: "0 -4px 10px"
    }
  }, React.createElement(ConflictResolver, {
    conflicts: conflicts,
    onKeep: (keepId, dropId) => {
      setState({
        ...state,
        saved: state.saved.filter(id => id !== dropId)
      });
      setResolverOpen(false);
    },
    onSplit: () => setResolverOpen(false)
  })), plan.map(p => React.createElement(PlanRow, {
    key: p.artist.id,
    entry: p,
    state: state,
    setState: setState
  }))));
}
function PlanRow({
  entry,
  state,
  setState
}) {
  var {
    artist: a,
    prev,
    walk,
    minsUntil,
    isLive,
    isPast,
    leaveBy,
    tight,
    conflict
  } = entry;
  var stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
  var leaveByLabel = leaveBy != null ? (() => {
    var m = (leaveBy % (24 * 60) + 24 * 60) % (24 * 60);
    var h = Math.floor(m / 60) % 24;
    var mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  })() : null;
  return React.createElement("div", null, prev && walk > 0 && React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "4px 0 4px 56px",
      marginBottom: 2
    }
  }, React.createElement("div", {
    style: {
      width: 1,
      height: 18,
      background: tight ? "var(--ember)" : "var(--line-2)"
    }
  }), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: tight ? "var(--ember-ink)" : "var(--muted)",
      fontWeight: tight ? 700 : 500
    }
  }, walk, " MIN WALK · ", prev.stage === a.stage ? "SAME STAGE" : `${STAGES.find(s => s.id === prev.stage)?.short || "TBA"} → ${stage?.short || "TBA"}`, leaveByLabel && ` · LEAVE BY ${leaveByLabel}`)), React.createElement("div", {
    onClick: () => setState({
      ...state,
      tab: "home",
      artist: a.id
    }),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 4px",
      borderBottom: "1px solid var(--line)",
      cursor: "pointer",
      opacity: isPast ? 0.45 : 1,
      background: conflict ? "rgba(232,93,46,0.04)" : "transparent"
    }
  }, React.createElement("div", {
    style: {
      width: 44
    }
  }, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      letterSpacing: 1,
      color: isLive ? stage?.color || "#8a8580" : "var(--ink)",
      fontWeight: isLive ? 700 : 500
    }
  }, fmt12(a.start)), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1,
      color: "var(--muted)"
    }
  }, isLive ? "LIVE" : isPast ? "DONE" : minsUntil < 60 ? `${minsUntil}m` : `${Math.floor(minsUntil / 60)}h${(minsUntil % 60).toString().padStart(2, "0")}`)), React.createElement("div", {
    style: {
      width: 3,
      alignSelf: "stretch",
      background: stage.color,
      borderRadius: 3
    }
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 20,
      lineHeight: 1.1,
      textDecoration: isPast ? "line-through" : "none"
    }
  }, a.name), isLive && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.3,
      color: "#fff",
      background: stage.color,
      padding: "1px 5px",
      borderRadius: 3,
      fontWeight: 700
    }
  }, "LIVE"), conflict && React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 8,
      letterSpacing: 1.3,
      color: "var(--ember-ink)",
      padding: "1px 5px",
      borderRadius: 3,
      fontWeight: 700,
      border: "1px solid var(--ember)"
    }
  }, "CLASH")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.2,
      color: "var(--muted)",
      marginTop: 2
    }
  }, stage.name.toUpperCase(), " · ", a.genre.toUpperCase())), React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--muted)",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, React.createElement("path", {
    d: "M9 6 L15 12 L9 18"
  }))));
}
function CountdownPart({
  n,
  label
}) {
  return React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start"
    }
  }, React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 52,
      lineHeight: 0.92,
      letterSpacing: -1.5,
      color: "var(--ink)",
      fontVariantNumeric: "tabular-nums"
    }
  }, String(n).padStart(2, "0")), React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.5,
      color: "var(--muted)",
      marginTop: 2,
      fontWeight: 600
    }
  }, label));
}
function homeBtn(kind) {
  var base = {
    border: "none",
    cursor: "pointer",
    borderRadius: 999,
    padding: "11px 16px",
    fontFamily: "Geist Mono, monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: 500,
    textTransform: "uppercase"
  };
  if (kind === "solid") return {
    ...base,
    background: "#fff",
    color: "var(--ink)"
  };
  if (kind === "ghost") return {
    ...base,
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    backdropFilter: "blur(6px)"
  };
  return base;
}
function AlertsDrawer({
  alerts,
  onClose,
  onOpenMap,
  onOpenLineup
}) {
  var iconFor = k => {
    var c = {
      reminder: "var(--flare)",
      friend: "var(--ember)",
      safety: "var(--horizon)",
      conflict: "var(--ember)",
      drop: "var(--success)"
    }[k] || "var(--ink)";
    return c;
  };
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 9,
      display: "flex",
      flexDirection: "column"
    }
  }, React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.35)"
    }
  }), React.createElement("div", {
    style: {
      marginTop: "auto",
      background: "var(--paper)",
      color: "var(--ink)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "78%",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 -10px 30px rgba(0,0,0,0.35)",
      position: "relative",
      animation: "sheetUp 0.3s var(--ease-smooth)"
    }
  }, React.createElement("div", {
    style: {
      padding: "14px 18px 10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid var(--line)"
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "var(--muted)"
    }
  }, "LIVE FEED"), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1,
      marginTop: 2
    }
  }, "Alerts")), React.createElement("button", {
    onClick: onClose,
    style: {
      background: "transparent",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "6px 10px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2
    }
  }, "CLOSE")), React.createElement("div", {
    style: {
      overflowY: "auto",
      padding: "6px 14px 18px"
    }
  }, alerts.map(a => {
    var onClick = a.kind === "conflict" ? onOpenLineup : a.kind === "friend" ? onOpenMap : null;
    return React.createElement("div", {
      key: a.id,
      onClick: onClick,
      style: {
        display: "flex",
        gap: 12,
        padding: "12px 6px",
        borderBottom: "1px solid var(--line)",
        cursor: onClick ? "pointer" : "default",
        opacity: a.unread ? 1 : 0.7
      }
    }, React.createElement("div", {
      style: {
        width: 6,
        borderRadius: 6,
        background: iconFor(a.kind),
        flexShrink: 0,
        alignSelf: "stretch",
        opacity: a.unread ? 1 : 0.4
      }
    }), React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8
      }
    }, React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 16,
        lineHeight: 1.15
      }
    }, a.title), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1,
        color: "var(--muted)",
        whiteSpace: "nowrap"
      }
    }, a.time)), React.createElement("div", {
      style: {
        fontSize: 12,
        color: "var(--muted)",
        marginTop: 3,
        lineHeight: 1.35
      }
    }, a.body)));
  }))));
}
function DontMissStrip({
  day,
  state,
  setState
}) {
  var moments = React.useMemo(() => {
    return ARTISTS.filter(a => a.day === day && (typeof isLegendary === "function" ? isLegendary(a) : false)).sort((a, b) => toNightMin(a.start) - toNightMin(b.start)).slice(0, 6);
  }, [day]);
  if (!moments.length) return null;
  var dayMeta = FESTIVAL_CONFIG.dayDates[day];
  return React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, React.createElement("div", {
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
  }, "Don't ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "#fbbf24"
    }
  }, "miss")), React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.3,
      color: "var(--muted)"
    }
  }, dayMeta?.name?.toUpperCase() || `DAY ${day}`, " · LEGENDARY")), React.createElement("div", {
    className: "no-scrollbar",
    style: {
      display: "flex",
      gap: 8,
      overflowX: "auto",
      scrollbarWidth: "none",
      marginRight: -16,
      paddingRight: 16
    }
  }, moments.map(a => {
    var stage = STAGES.find(s => s.id === a.stage);
    var isSunrise = stage?.id === FESTIVAL_CONFIG.mainStageId && parseInt(a.end) >= 5 && parseInt(a.end) < 6;
    return React.createElement("button", {
      key: a.id,
      onClick: () => setState({
        ...state,
        tab: "home",
        artist: a.id
      }),
      style: {
        flexShrink: 0,
        width: 168,
        padding: "10px 11px",
        textAlign: "left",
        borderRadius: 14,
        border: "1px solid rgba(251,191,36,0.45)",
        background: "linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(232,93,46,0.06) 100%)",
        cursor: "pointer"
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 8,
        letterSpacing: 1.4,
        color: "#b8651b",
        fontWeight: 800
      }
    }, isSunrise ? "🌅 SUNRISE SET" : "★ B2B COLLAB"), React.createElement("div", {
      className: "serif",
      style: {
        fontSize: 16,
        lineHeight: 1.1,
        marginTop: 5,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, a.name), React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.1,
        color: "var(--muted)",
        marginTop: 4,
        textTransform: "uppercase"
      }
    }, stage?.short || "", " · ", fmt12(a.start)));
  })));
}
var FT_SECTIONS = [{
  id: "gates",
  icon: "🚪",
  title: "Gates & entry",
  items: ["Gates open 4 PM Friday-Sunday. Music runs 7 PM – 5:30 AM.", "Bring a valid government-issued photo ID. 18+ event.", "Wristband activates online before you arrive — don't show up with it un-paired.", "One re-entry per day, only between 4 PM and midnight.", "Clear bag, max 12\" × 6\" × 12\". Hydration packs OK if empty."]
}, {
  id: "lingo",
  icon: "🗣️",
  title: "Words you'll hear",
  items: ["PLUR — Peace, Love, Unity, Respect. The unspoken code.", "Kandi — beaded bracelets. Trade them with strangers.", "Totem — tall flag/sign so your group can find you in the crowd.", "Sunrise set — the legendary final set as the sun comes up at Kinetic Field.", "Headliner — top-billed act, usually 11 PM – 5 AM at the biggest stages.", "B2B — back-to-back DJ set; two artists trading on the decks."]
}, {
  id: "survive",
  icon: "💧",
  title: "Survive the desert",
  items: ["Drink water before you're thirsty. Free refill stations all over the map (tap the 💧 chip).", "Days are warm (~70°F), nights are cold (~50°F). Bring a light jacket.", "Earplugs. Your future self will thank you.", "Eat real food before headliners. The food halls in Daisy Lane stay open all night.", "If you or a friend feels off, the Ground Control & GroundedSpace tents are no-questions-asked safe spaces."]
}, {
  id: "travel",
  icon: "🚌",
  title: "Getting there & back",
  items: ["Shuttles run from Strip hotels all night. Last departure ~5:30 AM.", "Driving: lots fill 6–8 PM, exiting at 5 AM is a 90-min crawl.", "Rideshare: Uber/Lyft pickup is the South Lot — tap the 🚗 button on the map for one-tap deep links.", "Phone signal at the venue is unreliable. Set a meeting point with your group BEFORE entering."]
}, {
  id: "day1",
  icon: "🌅",
  title: "Recommended Day 1",
  items: ["Arrive by 7 PM. Walk the perimeter once to find your bearings — it's huge.", "Hit Kinetic Field for the opening; the stage drop at sundown is the moment.", "Anchor for one full headliner set, then wander. Don't try to chase 12 sets.", "Eat at midnight. Sleep is for after the sunrise set.", "End at Cosmic Meadow, Stereo Bloom, or stay at Kinetic for the sunrise."]
}];
function FirstTimerGuide({
  onClose,
  onOpenMap,
  onOpenLineup
}) {
  var [openIdx, setOpenIdx] = React.useState(0);
  return React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 9,
      display: "flex",
      flexDirection: "column"
    }
  }, React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,0.4)"
    }
  }), React.createElement("div", {
    style: {
      marginTop: "auto",
      background: "var(--paper)",
      color: "var(--ink)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "85%",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 -10px 30px rgba(0,0,0,0.4)",
      position: "relative"
    }
  }, React.createElement("div", {
    style: {
      padding: "14px 18px 12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: "1px solid var(--line)",
      background: "linear-gradient(180deg, var(--paper) 0%, var(--paper-2) 100%)",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22
    }
  }, React.createElement("div", null, React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "var(--ember-ink)",
      fontWeight: 700
    }
  }, "FIRST TIME AT ", FESTIVAL_CONFIG.brand.toUpperCase()), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 24,
      lineHeight: 1,
      marginTop: 2
    }
  }, "The basics")), React.createElement("button", {
    onClick: onClose,
    style: {
      background: "transparent",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "6px 12px",
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 9,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "CLOSE")), React.createElement("div", {
    style: {
      overflowY: "auto",
      padding: "8px 14px 18px"
    }
  }, FT_SECTIONS.map((s, i) => {
    var isOpen = openIdx === i;
    return React.createElement("div", {
      key: s.id,
      style: {
        marginTop: 8,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden"
      }
    }, React.createElement("button", {
      onClick: () => setOpenIdx(isOpen ? -1 : i),
      style: {
        width: "100%",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: isOpen ? "var(--paper-2)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 20
      }
    }, s.icon), React.createElement("span", {
      className: "serif",
      style: {
        flex: 1,
        fontSize: 18,
        lineHeight: 1
      }
    }, s.title), React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--muted)",
        fontWeight: 700,
        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.2s"
      }
    }, "›")), isOpen && React.createElement("ul", {
      style: {
        listStyle: "none",
        margin: 0,
        padding: "4px 14px 14px 50px"
      }
    }, s.items.map((it, k) => React.createElement("li", {
      key: k,
      style: {
        position: "relative",
        marginTop: 8,
        fontSize: 13,
        lineHeight: 1.4,
        color: "var(--ink)"
      }
    }, React.createElement("span", {
      style: {
        position: "absolute",
        left: -14,
        top: 6,
        width: 5,
        height: 5,
        borderRadius: 5,
        background: "var(--ember)"
      }
    }), it))));
  }), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 14
    }
  }, React.createElement("button", {
    onClick: onOpenMap,
    style: {
      flex: 1,
      padding: "10px 12px",
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "EXPLORE MAP"), React.createElement("button", {
    onClick: onOpenLineup,
    style: {
      flex: 1,
      padding: "10px 12px",
      background: "var(--paper)",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      borderRadius: 10,
      cursor: "pointer",
      fontFamily: "Geist Mono, monospace",
      fontSize: 10,
      letterSpacing: 1.3,
      fontWeight: 700
    }
  }, "BROWSE LINEUP")))));
}
function _buildShareUrl(savedIds) {
  var base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?lineup=${savedIds.join(",")}`;
}
function ShareLineupButton({
  savedIds
}) {
  var [flash, setFlash] = React.useState(null);
  if (!savedIds?.length) return null;
  var onShare = async () => {
    var url = _buildShareUrl(savedIds);
    var text = `My ${FESTIVAL_CONFIG.brand} lineup — ${savedIds.length} sets saved on Plursky`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${FESTIVAL_CONFIG.brand} lineup`,
          text,
          url
        });
        setFlash("shared");
        setTimeout(() => setFlash(null), 1800);
        return;
      } catch (e) {
        if (e?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setFlash("copied");
      setTimeout(() => setFlash(null), 1800);
    } catch {
      prompt("Copy your lineup link:", url);
    }
  };
  return React.createElement("button", {
    onClick: onShare,
    className: "mono",
    style: {
      background: flash ? "var(--success)" : "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 999,
      padding: "5px 10px",
      cursor: "pointer",
      fontSize: 9,
      letterSpacing: 1.3,
      fontWeight: 700,
      transition: "background 0.2s"
    }
  }, flash === "shared" ? "✓ SHARED" : flash === "copied" ? "✓ COPIED" : "↗ SHARE");
}
function FriendLineupBanner({
  state,
  setState
}) {
  var friendIds = state.friendLineup || [];
  var savedSet = new Set(state.saved || []);
  var overlap = friendIds.filter(id => savedSet.has(id));
  var fresh = friendIds.filter(id => !savedSet.has(id));
  var [expanded, setExpanded] = React.useState(false);
  var dismiss = () => setState({
    ...state,
    friendLineup: null,
    friendName: null
  });
  var addAll = () => {
    var merged = [...new Set([...(state.saved || []), ...friendIds])];
    setState({
      ...state,
      saved: merged
    });
  };
  var addOverlap = () => {
    if (!fresh.length) return;
    var merged = [...new Set([...(state.saved || []), ...fresh])];
    setState({
      ...state,
      saved: merged
    });
  };
  return React.createElement("div", {
    style: {
      marginTop: 18,
      padding: "16px 16px 14px",
      borderRadius: 18,
      background: "linear-gradient(135deg, rgba(123,61,154,0.12), rgba(232,93,46,0.08))",
      border: "1px solid rgba(123,61,154,0.3)"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8
    }
  }, React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: "var(--horizon)",
      fontWeight: 700
    }
  }, "SHARED WITH YOU", state.friendName ? ` · ${state.friendName.toUpperCase()}` : ""), React.createElement("button", {
    onClick: dismiss,
    "aria-label": "Dismiss",
    style: {
      background: "transparent",
      border: "none",
      color: "var(--muted)",
      cursor: "pointer",
      fontSize: 14,
      padding: 0,
      lineHeight: 1
    }
  }, "×")), React.createElement("div", {
    className: "serif",
    style: {
      fontSize: 22,
      lineHeight: 1.1,
      marginBottom: 4
    }
  }, state.friendName ? state.friendName : "Your friend", "'s ", React.createElement("span", {
    style: {
      fontStyle: "italic",
      color: "var(--ember-ink)"
    }
  }, "lineup")), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--ink)",
      opacity: 0.75,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, friendIds.length, " sets saved · ", overlap.length, " match yours", fresh.length > 0 && ` · ${fresh.length} new to you`), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, React.createElement("button", {
    onClick: () => setExpanded(e => !e),
    className: "mono",
    style: {
      background: "var(--ink)",
      color: "var(--paper)",
      border: "none",
      borderRadius: 999,
      padding: "8px 14px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, expanded ? "HIDE SETS" : "VIEW SETS"), fresh.length > 0 && React.createElement("button", {
    onClick: addOverlap,
    className: "mono",
    style: {
      background: "var(--ember)",
      color: "#fff",
      border: "none",
      borderRadius: 999,
      padding: "8px 14px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "+ ADD ", fresh.length, " NEW"), React.createElement("button", {
    onClick: addAll,
    className: "mono",
    style: {
      background: "transparent",
      color: "var(--ink)",
      border: "1px solid var(--line-2)",
      borderRadius: 999,
      padding: "8px 14px",
      cursor: "pointer",
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: 700
    }
  }, "+ ADD ALL")), expanded && React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 10,
      borderTop: "1px solid var(--line)"
    }
  }, [1, 2, 3].map(day => {
    var dayArtists = friendIds.map(id => ARTISTS.find(a => a.id === id)).filter(a => a && a.day === day).sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
    if (!dayArtists.length) return null;
    var meta = FESTIVAL_CONFIG.dayDates[day];
    return React.createElement("div", {
      key: day,
      style: {
        marginBottom: 10
      }
    }, React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 9,
        letterSpacing: 1.6,
        color: "var(--horizon)",
        fontWeight: 700,
        marginBottom: 6
      }
    }, meta.short, " · ", meta.name.toUpperCase()), dayArtists.map(a => {
      var stage = STAGES.find(s => s.id === a.stage);
      var isOverlap = savedSet.has(a.id);
      return React.createElement("button", {
        key: a.id,
        onClick: () => setState({
          ...state,
          artist: a.id
        }),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid var(--line-2)",
          padding: "6px 0",
          cursor: "pointer",
          textAlign: "left"
        }
      }, React.createElement("span", {
        style: {
          width: 8,
          height: 8,
          borderRadius: 999,
          background: isOverlap ? "var(--success)" : stage?.color || "var(--muted)",
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
          fontSize: 14,
          lineHeight: 1.15,
          color: "var(--ink)"
        }
      }, a.name), React.createElement("div", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1,
          color: "var(--muted)",
          marginTop: 1
        }
      }, stage?.short, " · ", fmt12(a.start))), isOverlap && React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 8,
          letterSpacing: 1,
          color: "var(--success)",
          fontWeight: 700
        }
      }, "MATCH"));
    }));
  })));
}
Object.assign(window, {
  HomeScreen,
  FriendLineupBanner,
  ShareLineupButton
});
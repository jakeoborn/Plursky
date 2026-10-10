// Home / "Today" screen — now playing + schedule preview

// All festival timing constants come from FESTIVAL_CONFIG (data.jsx) so
// the same code works for any festival once a config is loaded.
const FESTIVAL_START_MS = FESTIVAL_CONFIG.startMs;
const FESTIVAL_END_MS   = FESTIVAL_CONFIG.endMs;

// Convert an HH:MM in "festival night" coords (>=18:00 today, <12:00 next
// day) to absolute Date for the given festival day. Anchors to the day's
// midnight in the festival's tz (stored in FESTIVAL_CONFIG.dayDates).
function festivalNightDate(day, hhmm) {
  if (!hhmm) return new Date(NaN);
  const [h, m] = hhmm.split(":").map(Number);
  const dayMeta = FESTIVAL_CONFIG.dayDates[day];
  if (!dayMeta) return new Date(NaN);
  const isOvernight = h < 12; // 00:00–11:59 belongs to the *next* calendar day
  const dayMs = dayMeta.midnightUtc + (isOvernight ? 86400000 : 0);
  return new Date(dayMs + h * 3600000 + m * 60000);
}

function fmtCountdown(ms) {
  if (ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  // ≥24h MUST normalize. The upcoming-night day cards feed this a delta of
  // weeks pre-festival, which is how "657H 12M" shipped. Sub-24h output is
  // byte-identical to before, so the sunrise/sunset chips and the doors
  // countdown — which never cross a day — are unaffected.
  if (h >= 24) return `${Math.floor(h / 24)}D ${h % 24}H`;
  if (h >= 1) return `${h}H ${m.toString().padStart(2, "0")}M`;
  return `${m} MIN`;
}

// ── NWS weather (free, keyless, browser-CORS-friendly) ──
// Two endpoints: forecast (6 daily/12hr periods) for at-a-glance Tonight
// card; forecastHourly (next 7 days at 1h granularity) for the festival
// day curve. Both cached for 1h.
async function fetchEdcForecast() {
  try {
    const cacheKey = `forecast_${FESTIVAL_CONFIG.id}`;
    const cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
      const c = JSON.parse(cacheRaw);
      if (Date.now() - c.fetchedAt < 3600000) return c.data;
    }
    const points = await fetch(FESTIVAL_CONFIG.weatherEndpoint, {
      headers: { Accept: "application/geo+json" },
    }).then(r => r.ok ? r.json() : null);
    if (!points) return null;
    const forecast = await fetch(points.properties.forecast, {
      headers: { Accept: "application/geo+json" },
    }).then(r => r.ok ? r.json() : null);
    if (!forecast) return null;
    const data = forecast.properties.periods.slice(0, 6);
    localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), data }));
    return data;
  } catch { return null; }
}

// Hourly forecast — used for festival-day temp curve and current-hour
// temp on map/home. 24h granularity is overkill for casual "is it hot
// tonight?" but exact when you're deciding between sunset set and
// staying for sunrise. Cached separately so the 6-period cache TTL
// doesn't get reset by hourly fetches.
async function fetchHourlyForecast() {
  try {
    const cacheKey = `forecast_hourly_${FESTIVAL_CONFIG.id}`;
    const cacheRaw = localStorage.getItem(cacheKey);
    if (cacheRaw) {
      const c = JSON.parse(cacheRaw);
      if (Date.now() - c.fetchedAt < 3600000) return c.data;
    }
    const points = await fetch(FESTIVAL_CONFIG.weatherEndpoint, {
      headers: { Accept: "application/geo+json" },
    }).then(r => r.ok ? r.json() : null);
    if (!points?.properties?.forecastHourly) return null;
    const forecast = await fetch(points.properties.forecastHourly, {
      headers: { Accept: "application/geo+json" },
    }).then(r => r.ok ? r.json() : null);
    if (!forecast) return null;
    // Keep next 48 hours — covers the rest of today + tomorrow's full curve
    const data = (forecast.properties.periods || []).slice(0, 48).map(p => ({
      startTime: p.startTime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      shortForecast: p.shortForecast,
      windSpeed: p.windSpeed,
      probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value || 0,
    }));
    localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), data }));
    return data;
  } catch { return null; }
}

function useHourlyForecast() {
  const [hours, setHours] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    fetchHourlyForecast().then(h => { if (alive) setHours(h); });
    return () => { alive = false; };
  }, []);
  return hours;
}

function useNwsForecast() {
  const [result, setResult] = React.useState({ periods: null, fromCache: false, fetchedAt: null });
  React.useEffect(() => {
    let alive = true;
    // Check cache before fetching so we can surface the age
    const cacheKey = `forecast_${FESTIVAL_CONFIG.id}`;
    let fromCache = false, fetchedAt = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const c = JSON.parse(raw);
        if (Date.now() - c.fetchedAt < 3600000) { fromCache = true; fetchedAt = c.fetchedAt; }
      }
    } catch {}
    fetchEdcForecast().then(p => {
      if (!alive) return;
      // After fetch, re-read timestamp (may have been refreshed)
      if (!fromCache) {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) fetchedAt = JSON.parse(raw).fetchedAt;
        } catch {}
      }
      setResult({ periods: p, fromCache, fetchedAt });
    });
    return () => { alive = false; };
  }, []);
  return result;
}

const _WEATHER_ALERT_RE = /thunderstorm|tornado|lightning|wind advisory|excessive heat|dust storm|flash flood|\bhail\b|severe weather/i;

function useWeatherAlert() {
  const [alert, setAlert] = React.useState(null);
  React.useEffect(() => {
    fetchEdcForecast().then(periods => {
      if (!periods) return;
      for (const p of periods) {
        const text = (p.shortForecast || "") + " " + (p.detailedForecast || "");
        const m = text.match(_WEATHER_ALERT_RE);
        if (m) { setAlert({ shortForecast: p.shortForecast, keyword: m[0] }); return; }
      }
    });
  }, []);
  return alert;
}

// Pre-festival: pick the period named "Friday" (opening day) or the next
// "Tonight". During-festival: use the upcoming period.
function pickRelevantPeriod(periods) {
  if (!periods?.length) return null;
  const now = Date.now();
  const future = periods.filter(p => new Date(p.endTime).getTime() > now);
  if (future.length) return future[0];
  return periods[0];
}

// Tonight info card — sunset/sunrise, weather, last-shuttle warning.
// Visible pre-festival (focused on opening day) and during-festival
// (focused on tonight).
// The night the sun times are for: the sheet's eyebrow. The forecast block says whose
// forecast it is (the site's, now), so a 14-day countdown never sits under "tonight".
function openingDateLabel() {
  const d = FESTIVAL_CONFIG.dayDates?.[1];
  if (!d) return null;
  try { return new Date(Date.UTC(d.y, d.m, d.d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); } catch { return null; }
}
function tonightEyebrow() {
  if (Date.now() < FESTIVAL_START_MS) { const when = openingDateLabel(); return `Opening night${when ? ` · ${when}` : ""}`; }
  return `Tonight · Day ${NOW.day}`;
}
function TonightCard({ state, setState }) {
  const { periods, fromCache, fetchedAt } = useNwsForecast();
  const hourly = useHourlyForecast();
  const cacheAgeLabel = (() => {
    if (!fromCache || !fetchedAt) return null;
    const mins = Math.round((Date.now() - fetchedAt) / 60000);
    if (mins < 2) return null;
    return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
  })();
  const day = NOW.day; // 1, 2, or 3 during festival
  const sunTimes = FESTIVAL_CONFIG.sunTimes || {};
  const sun = sunTimes[day] || sunTimes[1] || { rise: "07:00", set: "19:00" };
  const now = Date.now();
  const isPreEvent = now < FESTIVAL_START_MS;
  // Before the festival only a forecast that covers opening night counts: today's forecast
  // at the site is not "opening night". NWS posts about a week out, so until then the sheet
  // says when the forecast lands instead of printing a curve for the wrong day.
  const openingMs = festivalNightDate(1, (sunTimes[1] || sun).set).getTime();
  const covers = (p) => p && new Date(p.startTime).getTime() <= openingMs && new Date(p.endTime).getTime() > openingMs;
  const period = isPreEvent ? ((periods || []).find(covers) || null) : pickRelevantPeriod(periods);
  const hourlyShown = isPreEvent ? (hourly || []).filter(x => { const t = new Date(x.startTime).getTime(); return t >= openingMs - 3 * 3600000 && t < openingMs + 9 * 3600000; }) : hourly;

  // Next sunrise & sunset to display
  const sunsetMs = festivalNightDate(day, sun.set).getTime();
  const sunriseMs = festivalNightDate(day, sun.rise).getTime();
  const nextSun = sunTimes[day + 1] || sun;
  const nextSunsetMs = sunsetMs > now ? sunsetMs
    : (day < 3 ? festivalNightDate(day + 1, nextSun.set).getTime() : null);
  const nextSunriseMs = sunriseMs > now ? sunriseMs
    : (day < 3 ? festivalNightDate(day + 1, nextSun.rise).getTime() : null);

  // Last shuttle: only relevant in the wee hours after midnight on a
  // festival night. Not all festivals have shuttle data.
  const lastShuttleMs = FESTIVAL_CONFIG.lastShuttleHHMM
    ? festivalNightDate(day, FESTIVAL_CONFIG.lastShuttleHHMM).getTime() : NaN;
  const inShuttleWindow = !isPreEvent && now < lastShuttleMs && (lastShuttleMs - now) < 4 * 3600000;
  const shuttleMins = Math.floor((lastShuttleMs - now) / 60000);
  const shuttleUrgent = inShuttleWindow && shuttleMins < 60;

  const sunriseSet = nextSunriseMs ? fmtCountdown(nextSunriseMs - now) : null;
  const sunsetSet = nextSunsetMs ? fmtCountdown(nextSunsetMs - now) : null;

  // Find the artist playing at next sunrise (legendary "sunrise set")
  const sunriseArtistId = (() => {
    if (!nextSunriseMs) return null;
    const d = new Date(nextSunriseMs);
    const utcH = d.getUTCHours(), utcM = d.getUTCMinutes();
    const pdtH = (utcH + 24 - 7) % 24;
    const sunriseDay = (() => {
      // Was hardcoded to [1, 2, 3] and read sunTimes[2]/sunTimes[3] with no
      // guard, so ANY festival with fewer than three program days threw
      // "Cannot read properties of undefined (reading 'rise')" and took the
      // whole Today screen to the error boundary. That is four of the
      // thirteen registered festivals — the three 2027 scaffolds (0 days)
      // and III Points (1). Derive the list from the festival's own
      // dayDates instead of assuming EDC's shape.
      const days = Object.keys(FESTIVAL_CONFIG.dayDates || { 1: null })
        .map(Number).sort((a, b) => a - b)
        .map(n => festivalNightDate(n, (sunTimes[n] || sun).rise));
      const idx = days.findIndex(x => Math.abs(x.getTime() - nextSunriseMs) < 60000);
      return idx + 1;
    })();
    const target = `${pdtH.toString().padStart(2, "0")}:${utcM.toString().padStart(2, "0")}`;
    return activeLineup().find(a =>
      a.day === sunriseDay && a.stage === (FESTIVAL_CONFIG.mainStageId || "kinetic")
      && toNightMin(a.start) <= toNightMin(target) && toNightMin(a.end) > toNightMin(target)
    );
  })();

  const card = (label, value, sub, accent) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="np-mono" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div style={{ font: "700 clamp(16px, 5.4vw, 22px)/1 var(--f-data)", letterSpacing: "-0.01em", color: accent || "var(--ink)", marginTop: 6, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div className="np-mono" style={{ color: "var(--ink-3)", marginTop: 6 }}>{sub}</div>}
    </div>
  );


  return (
    <div style={{ marginTop: 2 }}>
      <div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "6px 0 16px", borderBottom: "1px solid var(--line)" }}>
          {sunsetSet && card("Sunset", fmt12(sun.set), sunsetSet ? `in ${sunsetSet}` : null)}
          {sunriseSet && card(
            "Sunrise",
            fmt12(sun.rise),
            sunriseArtistId ? `${sunriseArtistId.name} · ${(STAGES || []).find(s => s.id === (FESTIVAL_CONFIG.mainStageId || "kinetic"))?.name || "main stage"}` : `in ${sunriseSet}`
          )}
          {period ? card(
            "Weather",
            `${period.temperature}°${period.temperatureUnit}`,
            `${period.windSpeed} ${period.windDirection}`
          ) : periods == null ? (
            /* still loading; once loaded with nothing that covers the night, the slot is simply absent */
            <div style={{ flex: 1, minWidth: 80 }}>
              <div className="skel-dark" style={{ width: "60%", height: 8, marginBottom: 6 }}/>
              <div className="skel-dark" style={{ width: "80%", height: 14, marginBottom: 4 }}/>
              <div className="skel-dark" style={{ width: "50%", height: 8 }}/>
            </div>
          ) : null}
        </div>

        {period && (
          <div className="np-mono" style={{ color: "var(--ink-3)", padding: "12px 0 0" }}>
            NWS · {period.name}{cacheAgeLabel ? ` · cached ${cacheAgeLabel}` : ""}
          </div>
        )}
        {isPreEvent && !period && (
          <div className="np-mono" style={{ color: "var(--ink-3)", padding: "12px 0 4px" }}>
            NWS forecast for {openingDateLabel() || "opening night"} lands a week out
          </div>
        )}
        {/* Hourly temperature curve: twelve hours on the night (opening night before the festival). */}
        {hourlyShown?.length > 0 && (() => {
          const next12 = hourlyShown.slice(0, 12);
          const temps = next12.map(h => h.temperature);
          const min = Math.min(...temps), max = Math.max(...temps);
          const range = max - min || 1;
          const W = 280, H = 40;
          const points = next12.map((h, i) => {
            const x = (i / (next12.length - 1)) * W;
            const y = H - ((h.temperature - min) / range) * (H - 8) - 4;
            return `${x},${y}`;
          }).join(" ");
          const firstHour = new Date(next12[0].startTime).getHours();
          const fmtH = (h) => h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
          const lastHour = new Date(next12[next12.length - 1].startTime).getHours();
          return (
            <div style={{ padding: "14px 0 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span className="np-mono" style={{ color: "var(--ink-3)" }}>{isPreEvent ? "Opening night, by the hour" : "Next 12h"}</span>
                <span className="np-mono" style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>{min}° → {max}°</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }}>
                <polyline points={points} fill="none" stroke="var(--signal-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                {next12.map((h, i) => i % 3 === 0 && (
                  <circle key={i} cx={(i / (next12.length - 1)) * W} cy={H - ((h.temperature - min) / range) * (H - 8) - 4} r="1.5" fill="var(--signal-ink)"/>
                ))}
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span className="np-mono" style={{ color: "var(--ink-3)" }}>{fmtH(firstHour)}</span>
                <span className="np-mono" style={{ color: "var(--ink-3)" }}>{fmtH(lastHour)}</span>
              </div>
            </div>
          );
        })()}

        {inShuttleWindow && (
          <button
            onClick={() => setState({ ...state, tab: "map" })}
            style={{
              marginTop: 14, width: "100%", minHeight: 44,
              background: shuttleUrgent ? "var(--acc)" : "transparent",
              border: shuttleUrgent ? "none" : "1px solid var(--line-2)",
              color: shuttleUrgent ? "var(--on-acc)" : "var(--ink)",
              borderRadius: "var(--rad-sm)", padding: "10px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              font: "700 10px/1.2 var(--f-data)", letterSpacing: "0.13em", textTransform: "uppercase",
              textAlign: "left",
            }}>
            <span>Last shuttle to Strip</span>
            <span style={{ color: shuttleUrgent ? "inherit" : "var(--sun)" }}>
              {shuttleMins > 0 ? `${shuttleMins} MIN` : "DEPARTED"}
            </span>
          </button>
        )}

        {!inShuttleWindow && sunriseArtistId && !isPreEvent && (
          <button
            onClick={() => setState({ ...state, tab: "home", artist: sunriseArtistId.id })}
            style={{
              marginTop: 14, width: "100%",
              background: "rgba(var(--ink-rgb),0.06)", border: "1px solid rgba(var(--ink-rgb),0.18)",
              color: "var(--ink)", borderRadius: 10, padding: "9px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: 1.2, fontWeight: 600,
              textAlign: "left",
            }}>
            <span>🌅  SUNRISE SET · {sunriseArtistId.name.toUpperCase()}</span>
            <span style={{ color: "var(--signal-ink)" }}>{sunriseSet}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function preEventCountdown(savedIds) {
  const now = Date.now();
  if (now >= FESTIVAL_START_MS) return null;
  let targetMs = FESTIVAL_START_MS;
  if (FESTIVAL_CONFIG.weekendStartMs) {
    const saved = (savedIds || []).map(id => ARTISTS.find(a => a.id === id)).filter(Boolean);
    const w2Count = saved.filter(a => a.weekend === "W2").length;
    const w1Count = saved.filter(a => a.weekend === "W1").length;
    if (w2Count > w1Count) targetMs = FESTIVAL_CONFIG.weekendStartMs.W2 || targetMs;
    else if (w1Count > 0) targetMs = FESTIVAL_CONFIG.weekendStartMs.W1 || targetMs;
  }
  const diff = targetMs - now;
  if (diff <= 0) return null;
  return {
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins:  Math.floor((diff / 60000) % 60),
    secs:  Math.floor((diff / 1000) % 60),
    weekend: FESTIVAL_CONFIG.weekendStartMs ? (targetMs === FESTIVAL_CONFIG.weekendStartMs?.W2 ? "W2" : "W1") : null,
    // Exposed so the Festival Clock's sky can count to the same instant the
    // header strip does — otherwise a W2-weighted user sees a sun racing to
    // Oct 2 above a countdown that reads Oct 9.
    targetMs,
  };
}

// ── The Festival Clock ────────────────────────────────────────────────────
// The sky band on the pre-festival home hero. Every mark it draws is this
// festival's own data, which is the whole point of it: the arc is day 1's
// real daylight span (config.sunTimes), the destination marker is where the
// sun will actually stand over the park when gates open (startMs measured
// against that span), and the silhouette wears the main stage's colour.
// Swap the festival and the sky genuinely changes.
// The sky fills from the day the lineup dropped to the moment gates open —
// both real dates, so nothing on the card is a chosen number. Festivals with
// no SOURCED announcement date fall back to a generic window; that constant
// is reached only when we genuinely don't know, never as a default.
const _SKY_FALLBACK_MS = 90 * 86400000;

function skyFillStartMs(targetMs) {
  const announced = FESTIVAL_CONFIG.lineupAnnouncedMs;
  if (typeof announced === "number" && announced < targetMs) return announced;
  return targetMs - _SKY_FALLBACK_MS;
}

function _hhmmMin(s) {
  const parts = String(s || "").split(":").map(Number);
  if (parts.length < 2 || parts.some(n => !isFinite(n))) return null;
  return parts[0] * 60 + parts[1];
}

// Day-1 solar geometry, or null when the festival ships no sunTimes — in
// which case the band draws no sun at all rather than inventing a position.
function festivalSunGeometry() {
  const st = FESTIVAL_CONFIG.sunTimes && FESTIVAL_CONFIG.sunTimes[1];
  if (!st) return null;
  const riseMin = _hhmmMin(st.rise);
  const setMin  = _hhmmMin(st.set);
  if (riseMin == null || setMin == null || setMin <= riseMin) return null;
  const daylightMin = setMin - riseMin;
  // Gates-open as a local minute-of-day, from the config's own UTC start
  // plus utcOffsetHours — no Intl, no tz database, no guess.
  const local = new Date(FESTIVAL_START_MS + (FESTIVAL_CONFIG.utcOffsetHours || 0) * 3600000);
  const gatesMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const gatesFrac = Math.max(0.08, Math.min(0.92, (gatesMin - riseMin) / daylightMin));
  return { daylightMin, gatesFrac, riseMin };
}

// Is `now` before day 1's sunrise, in the festival's local time? Without
// sun data we treat the last day as night, which is the safe default for
// the "go to sleep" copy.
function beforeFestivalSunrise(now) {
  const geo = festivalSunGeometry();
  if (!geo) return true;
  const local = new Date(now + (FESTIVAL_CONFIG.utcOffsetHours || 0) * 3600000);
  return local.getUTCHours() * 60 + local.getUTCMinutes() < geo.riseMin;
}

// The festival's own identity colour, off the registry entry (it lives
// beside `config`, not inside it). Distinct from the per-day stage accent:
// the sky over Zilker in October is burnt orange whoever happens to be the
// Artist of the Day, so it must not turn purple because Kings of Leon play
// the T-Mobile stage.
function festivalAccent() {
  const e = (typeof FESTIVALS_REGISTRY !== "undefined" ? FESTIVALS_REGISTRY : [])
    .find(f => f && f.config && f.config.id === FESTIVAL_CONFIG.id);
  return (e && e.accent) || null;
}

// Fixed star field — deterministic, so the sky doesn't reshuffle every tick.
// x as a FRACTION of band width (the viewBox is sized to the real element,
// so absolute x would drift), y in absolute units from the top.
const _SKY_STARS = [
  [0.073, 18], [0.193, 34], [0.320, 12], [0.437, 40], [0.560, 21],
  [0.680, 33], [0.793, 15], [0.893, 38], [0.147, 52], [0.497, 60], [0.943, 55],
];

function FestivalSkyBand({ accent, progress, preDawn }) {
  // Gradient ids must be unique per instance: SVG paint refs are resolved
  // document-wide, so two bands sharing id="fcSky" would both paint with
  // whichever one the DOM reached first. Strip the punctuation React's
  // useId emits — a raw ":r1:" is not usable inside url(#…).
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const idSky = `fcSky${uid}`, idGround = `fcGround${uid}`, idSun = `fcSun${uid}`;
  // The viewBox is sized to the element's real pixel width so the scale
  // stays 1:1. Previously it was a fixed 300 units with
  // preserveAspectRatio="none", which stretched the band by ~25% on a
  // 375px screen — the sun rendered as a visible ellipse.
  const hostRef = React.useRef(null);
  const [bandW, setBandW] = React.useState(375);
  React.useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const read = () => setBandW(Math.max(240, Math.round(el.clientWidth || 375)));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = festivalSunGeometry();
  const mainStage = STAGES.find(s => s.id === FESTIVAL_CONFIG.mainStageId);
  const stageColor = (mainStage && mainStage.color) || accent;
  const sky = festivalAccent() || accent;
  const W = bandW, H = 120, HORIZON = 104;

  // Arc height tracks real day length: a 14-hour summer festival gets a
  // taller sun path than an 11-hour autumn one. 12h is the reference arc.
  const lift = geo ? Math.max(0.55, Math.min(1.15, geo.daylightMin / 720)) : 0.9;
  const arcX = (x) => 22 + x * (W - 44);
  const arcY = (x) => HORIZON - Math.sin(Math.PI * x) * 66 * lift;

  const gates = geo ? geo.gatesFrac : null;
  const sunAt = gates == null ? null : (preDawn ? 0 : gates * progress);
  const px = sunAt == null ? 0 : arcX(sunAt);
  const py = sunAt == null ? 0 : (preDawn ? HORIZON + 12 : arcY(sunAt));

  // Silhouette sits on the far side of the horizon from the sun's
  // destination, so the two never collide whatever the festival's gate time.
  const rigFrac = (gates != null && gates >= 0.5) ? 0.22 : 0.78;
  const rig = arcX(rigFrac);

  const starOpacity = preDawn ? 0.1 : Math.max(0.12, 0.75 * (1 - progress));
  const glow = preDawn ? 0.34 : 0.28 + 0.5 * progress;
  const zenith = preDawn ? "#05040a" : "#130d14";
  const ease = "opacity 700ms ease, transform 700ms ease";

  // Full daylight path, sampled — the sun's whole day, faint, behind it.
  const path = Array.from({ length: 25 }, (_, i) => {
    const x = i / 24;
    return `${i ? "L" : "M"}${arcX(x).toFixed(1)},${arcY(x).toFixed(1)}`;
  }).join(" ");

  return (
    <div ref={hostRef} style={{ width: "100%", lineHeight: 0 }}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
         aria-hidden="true" style={{ display: "block" }}>
      <defs>
        <linearGradient id={idSky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={zenith} />
          {/* Pre-dawn holds ink almost to the ground, then breaks into a
              hard band of accent right where the sun is about to come up.
              Without this stop the gradient interpolated ink→accent across
              the whole band and the "night before" read as a sunset. */}
          {preDawn && <stop offset="72%" stopColor={zenith} />}
          <stop offset={preDawn ? "90%" : "62%"} stopColor={sky} stopOpacity={glow * (preDawn ? 0.10 : 0.22)} />
          <stop offset="100%" stopColor={sky} stopOpacity={glow * (preDawn ? 1.1 : 0.65)} />
        </linearGradient>
        <linearGradient id={idGround} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0b0812" />
          <stop offset="100%" stopColor="#1f1517" />
        </linearGradient>
        <radialGradient id={idSun}>
          <stop offset="0%"   stopColor="#fff8e6" />
          <stop offset="55%"  stopColor={sky} />
          <stop offset="100%" stopColor={sky} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky + ground. Opaque, so the card's artist photo never bleeds
          through the sky — the horizon has to read as a horizon. */}
      <rect x="0" y="0" width={W} height={HORIZON} fill={zenith} />
      <rect x="0" y="0" width={W} height={HORIZON} fill={`url(#${idSky})`} />
      <rect x="0" y={HORIZON} width={W} height={H - HORIZON} fill={`url(#${idGround})`} />

      {_SKY_STARS.map(([sf, sy], i) => (
        <circle key={i} cx={(sf * W).toFixed(1)} cy={sy} r={i % 3 === 0 ? 1.1 : 0.8}
                fill="var(--ink)" opacity={starOpacity * (i % 2 ? 0.7 : 1)}
                style={{ transition: ease }} />
      ))}

      {/* The day's full sun path + where the sun will be at gates. */}
      {gates != null && (
        <>
          <path d={path} fill="none" stroke="var(--ink)" strokeOpacity="0.13"
                strokeWidth="1" strokeDasharray="2 5" />
          <circle cx={arcX(gates)} cy={arcY(gates)} r="9" fill="none"
                  stroke={sky} strokeOpacity="0.5" strokeWidth="1"
                  strokeDasharray="2 3" />
        </>
      )}

      <line x1="0" y1={HORIZON} x2={W} y2={HORIZON}
            stroke={sky} strokeOpacity="0.7" strokeWidth="1" />

      {/* Main-stage silhouette, assembling as the date closes in. */}
      <g stroke={stageColor} fill="none" strokeLinecap="round">
        <g opacity={0.35 + 0.35 * progress} style={{ transition: ease }}>
          <line x1={rig - 26} y1={HORIZON} x2={rig - 26} y2={HORIZON - 26} strokeWidth="2" />
          <line x1={rig + 26} y1={HORIZON} x2={rig + 26} y2={HORIZON - 26} strokeWidth="2" />
          <path d={`M${rig - 26},${HORIZON - 26} L${rig - 34},${HORIZON - 58}`}
                strokeWidth="1" strokeOpacity="0.35" />
          <path d={`M${rig + 26},${HORIZON - 26} L${rig + 34},${HORIZON - 58}`}
                strokeWidth="1" strokeOpacity="0.35" />
        </g>
        <g opacity={progress >= 0.4 ? 0.75 : 0} style={{ transition: ease }}>
          <line x1={rig - 26} y1={HORIZON - 26} x2={rig + 26} y2={HORIZON - 26} strokeWidth="2" />
          <line x1={rig - 12} y1={HORIZON} x2={rig - 12} y2={HORIZON - 26} strokeWidth="1" />
          <line x1={rig + 12} y1={HORIZON} x2={rig + 12} y2={HORIZON - 26} strokeWidth="1" />
        </g>
        <g opacity={progress >= 0.8 ? 1 : 0} style={{ transition: ease }}>
          <path d={`M${rig - 30},${HORIZON - 26} Q${rig},${HORIZON - 46} ${rig + 30},${HORIZON - 26}`}
                strokeWidth="2" />
          <circle cx={rig} cy={HORIZON - 30} r="16" fill={stageColor}
                  fillOpacity="0.16" stroke="none" />
        </g>
      </g>

      {/* The sun, climbing toward gates. Dim and low at 90 days out. */}
      {sunAt != null && (
        <g style={{ transition: ease }} transform={`translate(${px.toFixed(1)},${py.toFixed(1)})`}>
          <circle r={preDawn ? 26 : 18} fill={`url(#${idSun})`}
                  opacity={preDawn ? 0.7 : 0.25 + 0.55 * progress} />
          {!preDawn && <circle r="6.5" fill="var(--ink)" opacity={0.55 + 0.45 * progress} />}
        </g>
      )}
    </svg>
    </div>
  );
}

// Bumps every 30s so countdown stays accurate without spamming renders.
// Returns the counter so a memo/effect can list it as a dependency.
function useTick(intervalMs) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

// Walk-time lookup keyed by alphabetically-sorted stage-id pair.
// Midpoints of the lo/hi bands from map.jsx WALK_PAIRS.
//
// ⛔ These are EDC LAS VEGAS measurements and they describe no other festival.
// The keys are BARE stage ids, and four of them — kinetic, circuit, neon,
// stereo — are also EDC Orlando stage names, so this table will happily
// answer for a festival it has never seen. stageWalkMinutes() below checks
// WHICH festival is asking. There is no fallback for an unlisted pair; the
// old "~0.4 min per SVG unit" fallthrough was the fabrication #203 removed.
const _WALK_MIN = {
  "basspod,bionic":  13, "basspod,circuit": 8,  "basspod,cosmic":  11,
  "basspod,kinetic": 8,  "basspod,neon":    12, "basspod,quantum": 12,
  "basspod,stereo":  10, "basspod,waste":   8,  "bionic,circuit":  18,
  "bionic,cosmic":   8,  "bionic,kinetic":  9,  "bionic,neon":     15,
  "bionic,quantum":  12, "bionic,stereo":   6,  "bionic,waste":    9,
  "circuit,cosmic":  15, "circuit,kinetic": 20, "circuit,neon":    7,
  "circuit,quantum": 11, "circuit,stereo":  14, "circuit,waste":   12,
  "cosmic,kinetic":  13, "cosmic,neon":     16, "cosmic,quantum":  16,
  "cosmic,stereo":   8,  "cosmic,waste":    9,  "kinetic,neon":    12,
  "kinetic,quantum": 7,  "kinetic,stereo":  10, "kinetic,waste":   8,
  "neon,quantum":    9,  "neon,stereo":     12, "neon,waste":      15,
  "quantum,stereo":  9,  "quantum,waste":   16, "stereo,waste":    9,
};
// Minutes between two stages, or null when nobody has measured it.
//
// The table above is hand-measured EDC LV geometry. This used to fall through
// to `hypot(x, y) * 0.4` on the STAGE GRID for any pair it did not hold —
// which is 12 of the 13 festivals that have stages. Those x/y are ART:
// data.jsx says it outright, "the poster is art, not a survey", and #97
// forbids deriving world coordinates from poster coordinates. ACL therefore
// printed "amex → beatbox = 29 min", plus a LEAVE BY time computed from it,
// to someone standing in Zilker Park.
//
// The map layer already refuses this: computeWalkRange stamps
// `known: readoutHonest(avatar)` and walkMinsLabel returns null when the grid
// is unsourced. This function was exactly the "fourth walk readout that
// formats lo/hi itself" the distance-readout gate warns about — same claim,
// different door, no check.
//
// So: 0 for the same stage (true whatever the geometry), the measured number
// when EDC Las Vegas is the festival asking, and null otherwise — a number
// existing in the table is NOT the same as it describing your festival.
// null means WE DO NOT KNOW, and every
// call site renders the transition without a number instead of inventing one.
// A festival earns its readouts back when its geometry is verified against an
// official patron map — blind is the honest state until then.
function stageWalkMinutes(fromId, toId, festivalId) {
  if (fromId === toId) return 0;
  // WHICH festival is asking decides whether the table may be read at all.
  // festivalId is an explicit parameter rather than just FESTIVAL_CONFIG.id
  // because a gated festival can never be the active one, so a check that
  // could only ask through the active-festival switch would be structurally
  // blind to EDC Orlando — the one festival whose ids actually collide.
  const fid = festivalId ||
    (typeof FESTIVAL_CONFIG !== "undefined" && FESTIVAL_CONFIG ? FESTIVAL_CONFIG.id : null);
  if (fid !== WALK_TABLE_FESTIVAL_ID) return null;
  // Identity is NOT evidence. The table being hand-measured says somebody
  // walked it; it does not say the geometry was ever checked against an
  // official patron map, and EDC LV's own registration is unsourced today.
  // So the same predicate that governs every map readout governs this one —
  // one semantic, asked per festival, never about the avatar.
  if (typeof geometryVerifiedFor !== "function" || !geometryVerifiedFor(fid)) return null;
  const key = fromId < toId ? `${fromId},${toId}` : `${toId},${fromId}`;
  return _WALK_MIN[key] != null ? _WALK_MIN[key] : null;
}

// What's playing at every stage right now. Live comes from real dates
// (isSetLive); "up next" exists only inside a real festival night (NOW.night),
// so before the festival, after it and between weekends every stage is dark.
function liveAcrossStages() {
  const night = NOW.night;
  const now = toNightMin(NOW.time);
  return STAGES.map(s => {
    const live = activeLineup().find(a => a.stage === s.id && isSetLive(a));
    // When stage is dark, find the next artist starting on this stage tonight
    const upcoming = !live && night != null ? activeLineup()
      .filter(a => a.stage === s.id && a.day === night && a.start && toNightMin(a.start) > now)
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start))[0] || null
      : null;
    const minsUntil = upcoming ? toNightMin(upcoming.start) - now : null;
    return { stage: s, artist: live, upcoming, minsUntil };
  });
}

// Build Tonight's Plan: saved sets sorted by start, with prev-stage walk
// times and "leave by" warnings when transitions would make you late.
// Only on a REAL festival night (NOW.night): with NOW.day, a clock later
// than a set's end marked it DONE a week before it played. Inside the night,
// clock-of-day math is exact (toNightMin folds the small hours in).
function buildTonightsPlan(state) {
  const night = NOW.night;
  if (night == null) return [];
  const nowMin = toNightMin(NOW.time);
  const saved = savedInLineup(state.saved);
  const lineup = activeLineup(saved);
  const sets = saved
    .map(id => lineup.find(a => a.id === id))
    .filter(a => a && a.day === night && a.start)
    .sort((x, y) => toNightMin(x.start) - toNightMin(y.start));

  return sets.map((a, i) => {
    const prev      = sets[i - 1];
    const walk      = prev ? stageWalkMinutes(prev.stage, a.stage) : 0;
    const startMin  = toNightMin(a.start);
    const endMin    = toNightMin(a.end);
    const minsUntil = startMin - nowMin;
    const isLive    = isSetLive(a);
    const isPast    = nowMin >= endMin;
    // walk is null when the pair is unmeasured. A LEAVE BY time and a "tight"
    // warning are both distance claims, so neither may be inferred from an
    // unknown — an explicit null test, not `null > 0` happening to be false.
    const known     = walk != null && walk > 0;
    const leaveBy   = known ? startMin - walk : null;
    // Tight transition flag — only meaningful if previous set actually overlaps walk window
    const prevEnd   = prev ? toNightMin(prev.end) : null;
    const tight     = !!prev && known && (startMin - prevEnd) < walk;
    const conflict  = prev && overlaps(prev, a);
    return { artist: a, prev, walk, minsUntil, isLive, isPast, leaveBy, tight, conflict };
  });
}

// Compute live alerts from the user's saved sets for the current festival day.
// Returns upcoming-set reminders (≤30 min away) and overlap conflicts.
// Falls back to the static ALERTS demo when nothing is saved or pre-event.
function computeAlerts(savedIds, day, timeStr) {
  if (!savedIds?.length) return [];
  const nowMin = toNightMin(timeStr);
  const todaySaved = activeLineup(savedIds)
    .filter(a => a.day === day && savedIds.includes(a.id))
    .sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
  const out = [];

  for (const a of todaySaved) {
    const s = toNightMin(a.start);
    const minsAway = s - nowMin;
    if (minsAway > 0 && minsAway <= 30) {
      const stage = STAGES.find(st => st.id === a.stage);
      out.push({
        id: `remind_${a.id}`, kind: "reminder",
        title: `${a.name} in ${minsAway} min`,
        body: `${stage?.name || a.stage} · ${fmt12(a.start)}`,
        time: timeStr, unread: true,
      });
    }
  }

  for (let i = 0; i < todaySaved.length - 1; i++) {
    const a = todaySaved[i], b = todaySaved[i + 1];
    if (overlaps(a, b)) {
      out.push({
        id: `conflict_${a.id}_${b.id}`, kind: "conflict",
        title: "Schedule conflict",
        body: `${a.name} and ${b.name} overlap at ${b.start}.`,
        time: timeStr, unread: true,
      });
    }
  }

  return out;
}

function PostFestivalRecap({ state, setState }) {
  const savedIds = savedInLineup(state.saved);
  const byDay = festivalDayNums().map(day => ({
    day,
    meta: FESTIVAL_CONFIG.dayDates[day],
    // weekend-exempt: this is HISTORY. The resolver is clock-first, so from
    // the moment Weekend 2 begins it answers W2 for good — filtering here
    // would blank a Weekend 1 attendee's recap of the festival they attended.
    artists: ARTISTS.filter(a => a.day === day && savedIds.includes(a.id))
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start)),
  })).filter(d => d.artists.length);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* No duplicate hero here — the HomeScreen header already says
          "<fest> — that's a wrap" + the recap CTA. Lead with the real payoff:
          your Memories (photos/videos + one-tap recap). The strip renders
          nothing if there are no moments. */}
      {window.HomeMemoriesStrip && React.createElement(window.HomeMemoriesStrip, { state, setState })}

      {/* Saved sets recap grouped by day: one card, a Michroma day label,
          faces on the rows (duo board). */}
      {byDay.length > 0 && (
        <div className="duo-card" data-duo-recap style={{ padding: "16px 16px 6px" }}>
          <DuoSect title="Your saved sets" right={<span className="duo-data-s duo-ink3">{savedIds.length} SETS</span>} />
          {byDay.map(({ day, meta, artists }) => (
            <div key={day} style={{ marginTop: 14 }}>
              <div className="duo-label duo-acc" style={{ marginBottom: 4 }}>{meta.name} · {_MON[meta.m]} {meta.d}</div>
              {artists.map((a, i) => {
                const stage = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
                return (
                  <button key={a.id} className={`duo-press${i ? " duo-hair" : ""}`}
                    onClick={() => setState({ ...state, tab: "home", artist: a.id })}
                    aria-label={`${a.name}, ${stage.name}, ${fmt12(a.start)} to ${fmt12(a.end)}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", minHeight: 44 }}>
                    <DuoAvatar name={a.name} size={40} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="duo-headline duo-name" style={{ display: "block" }}>{actDisplayName(a.name)}</span>
                      <span className="duo-data-s duo-ink3" style={{ display: "block", marginTop: 3 }}><span className="np-pair"><span>{stage.name.toUpperCase()}</span><span>{fmt12(a.start)}–{fmt12(a.end)}</span></span></span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {savedIds.length === 0 && (
        <div className="duo-card" style={{ padding: 16 }}>
          <DuoSect title="Your saved sets" />
          <p className="duo-body duo-ink2" style={{ margin: "10px 0 0" }}>No saved sets this time. Next year, start planning early.</p>
        </div>
      )}
    </div>
  );
}

// ── Day-strip segmented control ────────────────────────────────────
// Apple Sports–style "YESTERDAY · TODAY · UPCOMING" pill at the top of
// the Home tab. Single ember-active segment, mono caps. Sub-tab state
// lives on the HomeScreen, not in `state.tab` (which still routes the
// app's main 4 tabs).
function DayStrip({ value, onChange, hasYesterday, hasUpcoming }) {
  const tabs = [
    { id: "yesterday", label: "YESTERDAY", enabled: hasYesterday },
    { id: "today",     label: "TODAY",     enabled: true },
    { id: "upcoming",  label: "UPCOMING",  enabled: hasUpcoming },
  ];
  return (
    <div style={{
      display: "flex", gap: 0,
      background: "var(--paper-2)", border: "1px solid var(--line)",
      borderRadius: 999, padding: 3,
    }}>
      {tabs.map(t => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => t.enabled && onChange(t.id)}
            disabled={!t.enabled}
            className="mono"
            style={{
              flex: 1, padding: "8px 6px",
              background: active ? "var(--ember)" : "transparent",
              color: active ? "var(--on-ember)" : (t.enabled ? "var(--muted)" : "var(--text-3)"),
              border: "none", borderRadius: 999,
              cursor: t.enabled ? "pointer" : "default",
              fontFamily: "Geist Mono, monospace",
              fontSize: 10, letterSpacing: 1.3, fontWeight: 700,
              transform: active ? "scale(1)" : "scale(0.95)",
              transition: "all 0.25s var(--ease-spring)",
            }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── F1-style "Tonight" hero ────────────────────────────────────────
// Full-bleed hero card at the top of the TODAY tab. Four phases:
//   1. Pre-festival (countdown still running)  — Round-style date strip
//   2. During-festival, before first set       — "Doors in Xh Ym" + headliner
//   3. During-festival, mid-night              — "● LIVE · Now at <stage>"
//   4. Post-festival                           — caller renders PostFestivalRecap
// Accent = the festival's colour pre-gates, the relevant artist's stage
// colour once the festival is running (mainstage red as fallback).
function F1TonightHero({ state, setState, parallax = 0 }) {
  const now = Date.now();
  const isPreEvent  = now < FESTIVAL_START_MS;
  const isPostEvent = now > FESTIVAL_END_MS;
  const day = NOW.day;
  const dayMeta = FESTIVAL_CONFIG.dayDates[day];
  const savedIds = savedInLineup(state.saved);

  // The currently-live artist (anywhere on grounds), preferring mainstage.
  const live = (() => {
    if (isPreEvent || isPostEvent) return null;
    const nowMin = toNightMin(NOW.time);
    const allLive = activeLineup().filter(a => isSetLive(a));
    return allLive.find(a => a.stage === FESTIVAL_CONFIG.mainStageId)
      || [...allLive].sort((a, b) => (b.tier || 0) - (a.tier || 0))[0]
      || null;
  })();

  // Headliner pick: highest-tier saved set tonight, else highest-tier scheduled artist of the day.
  const headliner = (() => {
    const savedTonight = activeLineup()
      .filter(a => a.day === day && savedIds.includes(a.id))
      .sort((a, b) => (b.tier || 0) - (a.tier || 0)
        || (toNightMin(b.end) - toNightMin(b.start)) - (toNightMin(a.end) - toNightMin(a.start)));
    if (savedTonight.length) return savedTonight[0];
    return [...activeLineup()]
      .filter(a => a.day === day)
      .sort((a, b) => (b.tier || 0) - (a.tier || 0))[0] || null;
  })();

  // Artist of the Day — rotates through headliners daily during pre-festival.
  const spotlight = (() => {
    if (!isPreEvent) return null;
    const headliners = ARTISTS.filter(a => a.tier === 3).sort((a, b) => a.id.localeCompare(b.id));
    if (!headliners.length) return null;
    const dayIndex = Math.floor(Date.now() / 86400000) % headliners.length;
    return headliners[dayIndex];
  })();

  const featured = live || headliner || spotlight;
  const stage = featured ? STAGES.find(s => s.id === featured.stage) : null;
  const stageAccent = stage?.color || "var(--ember)";
  // Pre-festival this card is about the FESTIVAL, so its stripe, border and
  // eyebrow wear the festival's colour. Once the gates open it goes back to
  // tracking whoever is actually on stage.
  const accent = (now < FESTIVAL_START_MS && festivalAccent()) || stageAccent;
  const photo  = useArtistPhoto(featured?.name || "");

  // Pre-event: preEventCountdown targets the user's own weekend, which the
  // raw FESTIVAL_START_MS delta this used to compute could not do.
  // (fmtCountdown's missing day-normalization — the "26D 646H 55M" half of
  // the bug — is fixed at its definition, since the day cards hit it too.)
  const preCd = isPreEvent ? preEventCountdown(savedIds) : null;
  // "Pre-dawn" has to actually BE pre-dawn. days === 0 covers the whole 24h
  // before gates, and ACL's gates are NOON — so a bare <24h test painted an
  // ink sky and told the user to sleep at 9am, four hours after sunrise,
  // contradicting the very sunTimes the sky is drawn from.
  const preDawn = !!preCd && preCd.days === 0 && beforeFestivalSunrise(now);
  // Sky fill: 0 the day the lineup dropped, 1 at gates.
  const skyProgress = (() => {
    if (!preCd) return 1;
    const from = skyFillStartMs(preCd.targetMs);
    const span = preCd.targetMs - from;
    if (!(span > 0)) return 1;
    return Math.max(0, Math.min(1, (now - from) / span));
  })();

  // Tonight-but-pre-doors: first set of day hasn't started yet
  const firstSetMs = dayMeta && !isPreEvent && !isPostEvent
    ? (() => {
        const todays = activeLineup().filter(a => a.day === day)
          .sort((x, y) => toNightMin(x.start) - toNightMin(y.start));
        const first = todays[0];
        if (!first) return null;
        return festivalNightDate(day, first.start).getTime();
      })()
    : null;
  const beforeFirstSet = !isPreEvent && !isPostEvent && firstSetMs && now < firstSetMs;
  const doorsLabel = beforeFirstSet ? fmtCountdown(firstSetMs - now) : null;

  // Phase enum — caller already handles post-festival via PostFestivalRecap.
  const phase = isPreEvent ? "pre" : live ? "live" : beforeFirstSet ? "doors" : "between";

  return (
    <div style={{
      // Literal ink, NOT var(--ink): theme-night inverts that token to
      // #f0e6d8, which turned this card cream while its text stayed
      // hardcoded #fff — unreadable, and only during the festival's own
      // 20:00–04:00 window, which is when this card matters most.
      background: "linear-gradient(160deg, var(--paper) 0%, var(--paper) 60%, var(--paper) 100%)",
      borderRadius: 16, padding: 0, marginBottom: 18,
      color: "var(--ink)", position: "relative", overflow: "hidden",
      border: `1px solid ${accent}55`,
    }}>
      {/* Accent stripe along the top edge — F1 brand-bar feel */}
      <div style={{ height: 4, background: accent }}/>

      {/* Background photo with vignette — shows in all phases when available */}
      {photo && (
        <div style={{
          position: "absolute", top: 4, left: 0, right: 0, bottom: -20,
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover", backgroundPosition: "center 18%",
          opacity: phase === "pre" ? 0.22 : 0.32,
          transform: `translateY(${-parallax * 0.3}px) scale(1.08)`,
          willChange: "transform",
        }}/>
      )}
      <div style={{
        position: "absolute", top: 4, left: 0, right: 0, bottom: 0,
        background: phase === "pre"
          ? `linear-gradient(180deg, rgba(26,18,13,0.6) 0%, rgba(26,18,13,0.85) 100%)`
          : `radial-gradient(120% 80% at 80% 0%, ${accent}30, transparent 55%), linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.55) 100%)`,
        pointerEvents: "none",
      }}/>

      <div style={{ position: "relative", padding: "16px 18px 18px" }}>
        {/* Header chip-row: round number + date */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="mono" style={{
            fontSize: 9, letterSpacing: 1.8, color: accent, fontWeight: 800,
          }}>
            {phase === "pre"
              ? `${FESTIVAL_CONFIG.brand.toUpperCase()} ${FESTIVAL_CONFIG.year}`
              : phase === "live"
                ? `● LIVE · ${stage?.name?.toUpperCase() || ""}`
                : `TONIGHT · ${dayMeta?.name?.toUpperCase() || "DAY " + day}`}
          </div>
          <div className="mono" style={{
            fontSize: 9, letterSpacing: 1.4, color: "var(--text-3)", fontWeight: 600,
          }}>
            {phase === "pre"
              ? FESTIVAL_CONFIG.dates.toUpperCase()
              // ⚠ This denominator was the literal 3 until v269. It is only
              // ever rendered DURING a festival, and until ARC 2026 (Sep 4–7)
              // no shipped festival had ever been live while anyone looked —
              // so "NIGHT 7 / 3" sat in Summerfest (9 days) and "NIGHT 4 / 3"
              // in Lollapalooza, both available, both wrong, unnoticed.
              // DAYS is re-derived from the ACTIVE config (data.jsx), so it
              // follows the festival switch. Never hardcode a day count.
              : `NIGHT ${day} / ${DAYS.length}`}
          </div>
        </div>

        {/* Pre-festival: the Festival Clock + Artist of the Day spotlight.
            ⚠ There is deliberately NO numeric countdown in this card. The
            HomeScreen header strip (CountdownPart DAYS/HRS/MIN) owns that
            number and sits ~200px above; a pill here rendered it twice. */}
        {phase === "pre" && (
          <>
            <div style={{ margin: "-2px -18px 16px" }}>
              <FestivalSkyBand accent={accent} progress={skyProgress} preDawn={preDawn} />
            </div>
            <div style={{ fontSize: 28, lineHeight: 0.96, letterSpacing: -0.5, marginBottom: 6, fontWeight: 600 }}>
              {FESTIVAL_CONFIG.dayDates[1]?.short} · <span className="serif" style={{ fontStyle: "italic", fontWeight: 400, color: accent }}>{FESTIVAL_CONFIG.brand}</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.4, marginBottom: spotlight ? 16 : 0 }}>
              {preCd && preCd.days === 0
                ? `gates in ${preCd.hours}h ${preCd.mins}m${preDawn ? " — sleep." : "."}`
                : `${FESTIVAL_CONFIG.locationShort} · gates open ${FESTIVAL_CONFIG.dayDates[1]?.name || "Friday"}.`}
            </div>
            {spotlight && (() => {
              const sStage = STAGES.find(s => s.id === spotlight.stage);
              return (
                <button onClick={() => setState({ ...state, artist: spotlight.id })} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "10px 12px", borderRadius: 12,
                  background: `rgba(var(--ink-rgb),0.06)`,
                  border: `1px solid ${sStage?.color || accent}33`,
                  cursor: "pointer", textAlign: "left", color: "var(--ink)",
                }}>
                  <ArtistSwatch artist={spotlight} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{
                      fontSize: 8, letterSpacing: 1.6, color: sStage?.color || accent,
                      fontWeight: 800, marginBottom: 3,
                    }}>ARTIST OF THE DAY</div>
                    <div className="serif" style={{
                      fontSize: 20, lineHeight: 1, letterSpacing: -0.3,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{spotlight.name}</div>
                    <div className="mono" style={{
                      fontSize: 9, letterSpacing: 0.8, color: "var(--text-3)", marginTop: 3,
                    }}>
                      {sStage?.name?.toUpperCase() || ""} · DAY {spotlight.day} · {fmt12(spotlight.start)}
                    </div>
                  </div>
                  <div style={{
                    color: "var(--text-3)", fontSize: 16, flexShrink: 0,
                  }}>→</div>
                </button>
              );
            })()}
          </>
        )}

        {/* Live phase: now-playing artist */}
        {phase === "live" && featured && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <span style={{
                width: 7, height: 7, borderRadius: 7, background: accent,
                boxShadow: `0 0 0 4px ${accent}33`,
                animation: "pulse 1.6s ease-in-out infinite",
              }}/>
              <span className="mono" style={{ fontSize: 9, letterSpacing: 1.6, color: "var(--text-2)", fontWeight: 600 }}>
                NOW · {featured.genre.toUpperCase()}
              </span>
            </div>
            <div className="serif" style={{ fontSize: 34, lineHeight: 0.95, letterSpacing: -0.4, marginBottom: 6 }}>
              {featured.name}
            </div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--text-2)", marginBottom: 14 }}>
              {fmt12(featured.start)} – {fmt12(featured.end)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setState({ ...state, tab: "map", focusStage: featured.stage })}
                style={homeBtn("solid")}>Navigate</button>
              <button onClick={() => setState({ ...state, tab: "home", artist: featured.id })}
                style={homeBtn("ghost")}>Details</button>
            </div>
          </>
        )}

        {/* Doors-not-yet-open phase */}
        {phase === "doors" && (
          <>
            <div className="serif" style={{ fontSize: 28, lineHeight: 0.96, letterSpacing: -0.4, marginBottom: 6 }}>
              {dayMeta?.name || ("Day " + day)}{" "}
              <span style={{ fontStyle: "italic", color: accent }}>Night</span>
            </div>
            <div style={{
              display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14,
              padding: "8px 12px", borderRadius: 10,
              background: "rgba(var(--ink-rgb),0.06)", border: "1px solid rgba(var(--ink-rgb),0.12)",
            }}>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: accent, fontWeight: 800 }}>
                DOORS IN
              </div>
              <div style={{
                fontFamily: "Geist Mono, monospace", fontSize: 20, fontWeight: 600,
                color: "var(--ink)", letterSpacing: 0.5, fontVariantNumeric: "tabular-nums",
                marginLeft: "auto",
              }}>
                {doorsLabel || "SOON"}
              </div>
            </div>
            {featured && (
              <button
                onClick={() => setState({ ...state, tab: "home", artist: featured.id })}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  background: "rgba(var(--ink-rgb),0.06)", border: "1px solid rgba(var(--ink-rgb),0.14)",
                  borderRadius: 12, padding: "10px 12px", cursor: "pointer",
                  textAlign: "left", color: "var(--ink)",
                }}>
                <div style={{ width: 3, alignSelf: "stretch", background: accent, borderRadius: 3, minHeight: 36 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: accent, fontWeight: 700 }}>
                    {savedIds.includes(featured.id) ? "YOUR HEADLINER" : "TONIGHT'S HEADLINER"}
                  </div>
                  <div className="serif" style={{ fontSize: 22, lineHeight: 1.05, marginTop: 2 }}>
                    {featured.name}
                  </div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--text-3)", marginTop: 2 }}>
                    {stage?.short || ""} · {fmt12(featured.start)}
                  </div>
                </div>
              </button>
            )}
          </>
        )}

        {/* Between-sets phase (festival on, no artist live on any stage). */}
        {phase === "between" && (
          <>
            <div className="serif" style={{ fontSize: 28, lineHeight: 0.96, letterSpacing: -0.4, marginBottom: 6 }}>
              Stage <span style={{ fontStyle: "italic", color: accent }}>changeover</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.4, marginBottom: 12 }}>
              Decks are quiet between sets — your next pick is queued below.
            </div>
            {featured && (
              <button
                onClick={() => setState({ ...state, tab: "home", artist: featured.id })}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  background: "rgba(var(--ink-rgb),0.06)", border: "1px solid rgba(var(--ink-rgb),0.14)",
                  borderRadius: 12, padding: "10px 12px", cursor: "pointer",
                  textAlign: "left", color: "var(--ink)",
                }}>
                <div style={{ width: 3, alignSelf: "stretch", background: accent, borderRadius: 3, minHeight: 36 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.4, color: accent, fontWeight: 700 }}>
                    UP NEXT TONIGHT
                  </div>
                  <div className="serif" style={{ fontSize: 22, lineHeight: 1.05, marginTop: 2 }}>
                    {featured.name}
                  </div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--text-3)", marginTop: 2 }}>
                    {stage?.short || ""} · {fmt12(featured.start)}
                  </div>
                </div>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── F1 podium-style "Last night" recap ────────────────────────────
// Renders for night 2 & 3 when the user actually attended the prior
// night. Top-3 of YOUR saved sets, ranked by tier × duration; 1st
// gets the big serif treatment, 2nd & 3rd flank as smaller cards.
// If you saved nothing, falls back to the night's top-billed sets.
function LastNightRecap({ state, setState }) {
  const day = NOW.day;
  const prevDay = day - 1;
  if (prevDay < 1 || prevDay > 3) return null;
  const meta = FESTIVAL_CONFIG.dayDates[prevDay];
  const savedIds = savedInLineup(state.saved);

  // Score = tier (1-3) weighted by set duration in minutes
  const score = a => {
    const dur = Math.max(20, toNightMin(a.end) - toNightMin(a.start));
    return (a.tier || 1) * 100 + dur;
  };

  const yoursLastNight = activeLineup()
    .filter(a => a.day === prevDay && savedIds.includes(a.id))
    .sort((a, b) => score(b) - score(a));

  // No saves last night — fall back to top-tier scheduled sets so the
  // tab isn't an empty void.
  const podiumSource = yoursLastNight.length
    ? yoursLastNight
    : activeLineup().filter(a => a.day === prevDay).sort((a, b) => score(b) - score(a));

  const top3 = podiumSource.slice(0, 3);
  if (!top3.length) return null;

  // Counts row
  const setsCaught = yoursLastNight.length;
  const totalMin = yoursLastNight.reduce(
    (sum, a) => sum + Math.max(0, toNightMin(a.end) - toNightMin(a.start)), 0
  );
  const stageCounts = yoursLastNight.reduce((acc, a) => {
    acc[a.stage] = (acc[a.stage] || 0) + 1; return acc;
  }, {});
  const topStageId = Object.entries(stageCounts).sort((x, y) => y[1] - x[1])[0]?.[0];
  const topStage   = topStageId ? STAGES.find(s => s.id === topStageId) : null;

  const PodiumRow = ({ artist, place }) => {
    const stage = STAGES.find(s => s.id === artist.stage);
    const heights = { 1: 78, 2: 60, 3: 48 };
    const colors  = { 1: "var(--ember)", 2: "var(--flare)", 3: "var(--horizon)" };
    return (
      <button onClick={() => setState({ ...state, tab: "home", artist: artist.id })}
        style={{
          flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
          alignItems: "stretch", background: "transparent",
          border: "none", padding: 0, cursor: "pointer", textAlign: "left",
        }}>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.4, color: colors[place], fontWeight: 800,
          marginBottom: 4,
        }}>
          {place === 1 ? "1ST · HEADLINER" : place === 2 ? "2ND" : "3RD"}
        </div>
        <div style={{
          height: heights[place],
          background: place === 1 ? "var(--signal)" : "var(--paper-3)",
          borderRadius: 10,
          padding: "8px 10px",
          color: "var(--ink)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
          <div className="serif" style={{
            fontSize: place === 1 ? 17 : 13, lineHeight: 1.05,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {artist.name}
          </div>
          <div className="mono" style={{
            fontSize: 8, letterSpacing: 1, color: "var(--text-2)", marginTop: 2,
          }}>
            {stage?.short || ""} · {fmt12(artist.start)}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Title */}
      <div className="serif" style={{ fontSize: 32, lineHeight: 0.95, letterSpacing: -0.4, marginBottom: 4 }}>
        {meta?.name || ("Day " + prevDay)}{" "}
        <span style={{ fontStyle: "italic", color: "var(--ember-ink)" }}>Night</span>
      </div>
      <div className="mono" style={{
        fontSize: 9, letterSpacing: 1.4, color: "var(--muted)", fontWeight: 600, marginBottom: 14,
      }}>
        {meta?.short} · {yoursLastNight.length ? "YOUR PODIUM" : "TOP BILLED"}
      </div>

      {/* Stat row */}
      <div style={{
        display: "flex", gap: 0, marginBottom: 14,
        background: "var(--paper-2)", border: "1px solid var(--line)",
        borderRadius: 12, overflow: "hidden",
      }}>
        {[
          { label: "SETS",      value: setsCaught || "—" },
          { label: "HOURS",     value: totalMin ? (totalMin / 60).toFixed(1) : "—" },
          { label: "TOP STAGE", value: topStage?.short || "—", color: topStage?.color },
        ].map((s, i) => (
          <div key={s.label} style={{
            flex: 1, padding: "10px 12px",
            borderLeft: i > 0 ? "1px solid var(--line)" : "none",
          }}>
            <div className="mono" style={{
              fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 600,
            }}>{s.label}</div>
            <div style={{
              fontFamily: "Geist Mono, monospace", fontSize: 18, fontWeight: 600,
              color: s.color || "var(--ink)", marginTop: 3, lineHeight: 1,
            }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Podium: 2 / 1 / 3 layout to mimic actual podium heights */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {top3[1] ? <PodiumRow artist={top3[1]} place={2} /> : <div style={{ flex: 1 }}/>}
        {top3[0] ? <PodiumRow artist={top3[0]} place={1} /> : <div style={{ flex: 1 }}/>}
        {top3[2] ? <PodiumRow artist={top3[2]} place={3} /> : <div style={{ flex: 1 }}/>}
      </div>

      {!yoursLastNight.length && (
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.3, color: "var(--muted)",
          textAlign: "center", marginTop: 12,
        }}>
          NO SAVED SETS LAST NIGHT — SHOWING TOP-BILLED INSTEAD
        </div>
      )}
    </div>
  );
}

// ── UPCOMING tab content ──────────────────────────────────────────
// Pre-festival: teaser cards for nights 1+2+3. During festival:
// tomorrow's headliner-to-watch list. Empty on the final night.
function UpcomingTeaser({ state, setState }) {
  const now = Date.now();
  const isPreEvent = now < FESTIVAL_START_MS;
  const savedIds = savedInLineup(state.saved);

  // Which days to surface
  const upcomingDays = (() => {
    const days = festivalDayNums();
    if (isPreEvent) return days;
    const next = NOW.day + 1;
    return days.includes(next) ? [next] : [];
  })();

  if (!upcomingDays.length) {
    return (
      <div style={{
        border: "1px dashed var(--line-2)", borderRadius: 14,
        padding: "24px 16px", textAlign: "center",
      }}>
        <div className="serif" style={{ fontSize: 18, color: "var(--muted)", fontStyle: "italic" }}>
          No more nights ahead
        </div>
        <div className="mono" style={{
          fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", marginTop: 6,
        }}>
          THIS IS THE LAST NIGHT — MAKE IT COUNT
        </div>
      </div>
    );
  }

  return (
    <div>
      {upcomingDays.map(day => {
        const meta = FESTIVAL_CONFIG.dayDates[day];
        const dayStartMs = festivalNightDate(day, "18:00").getTime();
        const countdownLabel = dayStartMs > now ? fmtCountdown(dayStartMs - now) : null;
        // Pick up to 4 highlights: saved sets first, then top-tier non-saved.
        const todays = activeLineup().filter(a => a.day === day);
        const saved  = todays.filter(a => savedIds.includes(a.id))
          .sort((a, b) => (b.tier || 0) - (a.tier || 0));
        const topPicks = todays
          .filter(a => !savedIds.includes(a.id))
          .sort((a, b) => (b.tier || 0) - (a.tier || 0));
        const highlights = [...saved, ...topPicks].slice(0, 4);

        return (
          <div key={day} style={{
            marginBottom: 14,
            background: "var(--paper-2)", border: "1px solid var(--line)",
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: 1.4, color: "var(--ember-ink)", fontWeight: 700,
                }}>
                  {meta?.short} · {meta?.name?.toUpperCase()}
                </div>
                <div className="serif" style={{ fontSize: 24, lineHeight: 1.05, marginTop: 2 }}>
                  {meta?.name} <span style={{ fontStyle: "italic", color: "var(--muted)" }}>night</span>
                </div>
              </div>
              {countdownLabel && (
                <div className="mono" style={{
                  fontSize: 9, letterSpacing: 1.3, color: "var(--muted)", fontWeight: 600,
                  textAlign: "right",
                }}>
                  IN {countdownLabel}
                </div>
              )}
            </div>

            {highlights.length === 0 ? (
              <div className="mono" style={{
                fontSize: 9, letterSpacing: 1.3, color: "var(--muted)",
                padding: "10px 0", textAlign: "center",
              }}>
                NO SETS SCHEDULED
              </div>
            ) : (
              highlights.map(a => {
                const stage = STAGES.find(s => s.id === a.stage);
                const isSaved = savedIds.includes(a.id);
                return (
                  <button key={a.id}
                    onClick={() => setState({ ...state, tab: "home", artist: a.id })}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      background: "transparent", border: "none",
                      borderBottom: "1px solid var(--line-2)",
                      padding: "8px 0", cursor: "pointer", textAlign: "left",
                    }}>
                    <div style={{
                      width: 3, alignSelf: "stretch", background: "var(--line-2)",
                      borderRadius: 3, minHeight: 30,
                    }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div className="serif" style={{ fontSize: 16, lineHeight: 1.1, color: "var(--ink)" }}>
                          {a.name}
                        </div>
                        {isSaved && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--signal-ink)" stroke="none">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                          </svg>
                        )}
                      </div>
                      <div className="mono" style={{
                        fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 1,
                      }}>
                        {stage?.short} · {fmt12(a.start)}–{fmt12(a.end)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

function HomeScreen({ state, setState }) {
  const [alertsOpen, setAlertsOpen] = React.useState(false);
  const [firstTimerOpen, setFirstTimerOpen] = React.useState(false);
  const [offline, setOffline] = React.useState(state.offline || false);
  const [weatherAlertDismissed, setWeatherAlertDismissed] = React.useState(false);
  const [homeSubTab, setHomeSubTab] = React.useState("today");
  const [notifNudgeDismissed, setNotifNudgeDismissed] = React.useState(() => {
    try { return localStorage.getItem("notif_nudge_dismissed") === "1"; } catch { return false; }
  });
  const [setupBannerDismissed, setSetupBannerDismissed] = React.useState(() => {
    try { return localStorage.getItem("setup_banner_dismissed") === "1"; } catch { return false; }
  });
  // Once the user saves their first set, they've engaged — auto-dismiss the
  // setup nudge so we stop nagging. Persisted so it stays dismissed even if
  // they later un-save everything.
  React.useEffect(() => {
    if (setupBannerDismissed) return;
    if (savedInLineup(state.saved).length === 0) return;
    try { localStorage.setItem("setup_banner_dismissed", "1"); } catch {}
    setSetupBannerDismissed(true);
  }, [state.saved?.join(","), setupBannerDismissed]);
  const { perm: notifPerm, enable: enableNotifs } = useNotifications();
  const weatherAlert = useWeatherAlert();
  // Pre-event newcomers haven't seen the first-timer guide yet — show a
  // prominent CTA card until they open it once. After that the small badge
  // in the alerts row keeps it discoverable without nagging.
  const ftSeen = (() => {
    try { return localStorage.getItem("ft_guide_seen") === "1"; }
    catch { return false; }
  })();
  const [ftDismissed, setFtDismissed] = React.useState(ftSeen);

  // Re-render every minute so the pre-event countdown stays accurate
  useTick(60000);
  const liveSaved = savedInLineup(state.saved);
  const countdown = preEventCountdown(liveSaved);
  const isPostFestival = Date.now() > FESTIVAL_END_MS;

  const current = ARTISTS.find(a => a.id === NOW.currentArtistId) || null;
  const next    = ARTISTS.find(a => a.id === NOW.nextArtistId) || null;
  const stageOf = id => STAGES.find(s => s.id === id);
  const currentPhoto = useArtistPhoto(current?.name || "");

  const totalMin = current ? Math.max(1, toNightMin(current.end) - toNightMin(current.start)) : 90;
  const progress = current ? Math.min(1, NOW.elapsedMin / totalMin) : 0;
  const minsLeft = current ? Math.max(0, totalMin - NOW.elapsedMin) : 0;
  const upNextMin = next ? Math.max(0, toNightMin(next.start) - toNightMin(NOW.time)) : 0;
  const tonight   = buildTonightsPlan(state);
  const liveStrip = liveAcrossStages();

  // Computed alerts from saved sets — replaces static demo ALERTS during festival
  const _dynAlerts = !countdown && liveSaved.length
    ? computeAlerts(liveSaved, NOW.night, NOW.time)
    : [];
  const alerts = _dynAlerts.length ? _dynAlerts : (state.alerts || ALERTS);
  const unread = alerts.filter(a => a.unread).length;

  const [heroParallax, setHeroParallax] = React.useState(0);
  const scrollRef = React.useRef(null);
  const handleHomeScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (el) setHeroParallax(Math.min(el.scrollTop * 0.35, 80));
  }, []);

  const [pullRefresh, setPullRefresh] = React.useState(false);
  const _prRef = React.useRef({ startY: 0, pulling: false });
  const handlePullStart = (e) => { _prRef.current = { startY: e.touches[0].clientY, pulling: false }; };
  const handlePullMove = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop > 0) return;
    const dy = e.touches[0].clientY - _prRef.current.startY;
    if (dy > 60 && !_prRef.current.pulling) {
      _prRef.current.pulling = true;
      setPullRefresh(true);
      navigator.vibrate?.([15]);
      setTimeout(() => { setPullRefresh(false); window.location.reload(); }, 600);
    }
  };

  // ── Field Mode Home ──
  // Answers "what matters now?" in one glance: a real-media hero, one
  // Now/Next row, one primary action, then flat rows. Every section the old
  // Home carried is still one tap away, in the essentials row or a sheet.
  const [sheet, setSheet] = React.useState(null);
  const savedIds = savedInLineup(state.saved);
  const online = useOnlineStatus();
  const isLive = !countdown && !isPostFestival;

  const ip = useInstallPrompt();
  let userName = "";
  try { userName = localStorage.getItem("user_name") || ""; } catch {}
  const showSetup = !setupBannerDismissed && !userName && !state.spotifyConnected;
  const showInstall = !showSetup && ip.canInstall;
  // Set reminders only mean something while a saved set is still ahead.
  const showNotif = !showSetup && !showInstall && !isPostFestival && savedIds.length > 0 && notifPerm === "default" && !notifNudgeDismissed;
  // A weather alert means something while the festival is ahead or on; two
  // weeks after the last set it is noise on the recap.
  const showWeather = !showSetup && !showInstall && !showNotif && !isPostFestival && weatherAlert && !weatherAlertDismissed;
  const dismissNotif = () => {
    setNotifNudgeDismissed(true);
    try { localStorage.setItem("notif_nudge_dismissed", "1"); } catch {}
  };
  // At most one notice at a time: offline > setup > install > reminders > weather.
  const notice = offline ? (
    <FieldNotice eyebrow="Offline mode" text="Lineup and map stay available on this phone." />
  ) : showSetup ? (
    <FieldNotice text="Personalize Plursky — name, Spotify, reminders."
      action="Set up" onAction={() => window.plurskyOpenPersonalize?.()}
      onDismiss={() => {
        try { localStorage.setItem("setup_banner_dismissed", "1"); } catch {}
        setSetupBannerDismissed(true);
      }} />
  ) : showInstall ? (
    <div style={{ padding: "0 20px" }}><InstallBanner /></div>
  ) : showNotif ? (
    <FieldNotice text="Get notified 15 min before each saved set."
      action="Enable" onAction={async () => { await enableNotifs(); dismissNotif(); }}
      onDismiss={dismissNotif} />
  ) : showWeather ? (
    <FieldNotice eyebrow="NWS weather alert" warn text={weatherAlert.shortForecast}
      action="Details" onAction={() => setSheet("tonight")}
      onDismiss={() => setWeatherAlertDismissed(true)} />
  ) : null;

  const icon = (d) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
  );
  const essentials = [
    { id: "map", label: "Map", icon: icon("M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z M9 4 V18 M15 6 V20"),
      onClick: () => setState({ ...state, tab: "map" }) },
    !isPostFestival && { id: "tonight", label: "Sun & weather", icon: icon("M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6 M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8"),
      onClick: () => setSheet("tonight") },
    !isPostFestival && { id: "dontmiss", label: "Don't miss", icon: icon("M12 3 L14.6 8.6 L20.5 9.3 L16.1 13.4 L17.3 19.3 L12 16.3 L6.7 19.3 L7.9 13.4 L3.5 9.3 L9.4 8.6 Z"),
      onClick: () => setSheet("dontmiss") },
    countdown && { id: "headliners", label: "Headliners", icon: icon("M4 18 H20 M6 18 L7 8 L10.5 11 L12 5 L13.5 11 L17 8 L18 18"),
      onClick: () => setSheet("headliners") },
    isLive && NOW.day > 1 && { id: "lastnight", label: "Last night", icon: icon("M3 12 A9 9 0 1 0 6 5.3 M3 4 V9 H8 M12 7 V12 L15 14"),
      onClick: () => setSheet("lastnight") },
    isLive && NOW.day < 3 && { id: "upcoming", label: "Coming up", icon: icon("M4 6 H20 V20 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"),
      onClick: () => setSheet("upcoming") },
    { id: "basics", label: "Basics", icon: icon("M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3 M12 11 V16 M12 8 V8.5"),
      onClick: () => setFirstTimerOpen(true) },
    { id: "alerts", label: "Alerts", sub: unread ? `${unread} new` : null, icon: icon("M6 9 C6 5.5 8.5 3 12 3 C15.5 3 18 5.5 18 9 L18 13 L20 16 L4 16 L6 13 Z M10 19 Q12 21 14 19"),
      onClick: () => setAlertsOpen(true) },
  ].filter(Boolean);

  const sheetView = (() => {
    switch (sheet) {
      case "night": return isLive
        ? { title: "My night", body: <><LiveAcrossStrip strip={liveStrip} setState={setState} state={state} /><TonightsPlan plan={tonight} setState={setState} state={state} /></> }
        : { title: "My saved sets", body: <SavedByDay state={state} setState={setState} /> };
      case "tonight":    return { title: "Sun & weather", eyebrow: tonightEyebrow(), body: <TonightCard state={state} setState={setState} /> };
      case "dontmiss":   return { title: "Don't miss",    body: <DontMissStrip day={countdown ? 1 : NOW.day} state={state} setState={setState} /> };
      case "headliners": return { title: "Headliners",    body: <HeadlinerHighlights state={state} setState={setState} /> };
      case "lastnight":  return { title: "Last night",    body: <LastNightRecap state={state} setState={setState} /> };
      case "upcoming":   return { title: "Coming up",     body: <UpcomingTeaser state={state} setState={setState} /> };
      default: return null;
    }
  })();

  // ── Night Print composition ──
  // Before the festival the poster leads; on the night the plan and the
  // stage board lead above a compressed edition strip; after it the recap
  // leads. Every block is real data or absent.
  const bill = activeLineup().length;
  const tba = typeof isScheduleTBA === "function" && isScheduleTBA(FESTIVAL_CONFIG.id);
  const savedRows = activeLineup(savedIds).filter(a => savedIds.includes(a.id))
    .sort((a, b) => ((a.day ?? 99) - (b.day ?? 99)) || ((a.start ? toNightMin(a.start) : 9999) - (b.start ? toNightMin(b.start) : 9999)));
  const liveCount = liveStrip.filter(s => s.artist).length;
  const stampText = countdown
    ? (countdown.days > 0 ? `IN ${countdown.days} DAY${countdown.days === 1 ? "" : "S"}` : countdown.hours > 0 ? `IN ${countdown.hours} HR` : `IN ${countdown.mins} MIN`)
    : "";
  const steps = [
    { id: "people", title: ["Pick your", "people."], aria: "Pick your people: open the lineup",
      sub: isPostFestival ? (savedIds.length ? `${savedIds.length} picked. See who you caught.` : "The artists you came for.") : savedIds.length ? `${savedIds.length} picked. Find more.` : "Find the artists you came for.",
      onClick: () => setState({ ...state, tab: "lineup" }) },
    { id: "night", title: ["Follow", "your night."], aria: isPostFestival ? "Follow your night: open your recap" : "Follow your night: open my night",
      sub: isPostFestival ? "How your weekend went." : isLive ? "Now, next, and every stage." : savedIds.length ? "Your saved sets, in order." : "Save a set and it lands here.",
      onClick: () => isPostFestival ? setState({ ...state, tab: "recap" }) : setSheet("night") },
    { id: "playlist", title: ["Build Your", "Playlist."], aria: "Build Your Playlist: open Music",
      sub: "Take the music with you.", onClick: () => setState({ ...state, tab: "spotify" }) },
    { id: "gallery", title: ["Create Your", "Gallery."], aria: "Create Your Gallery: open Memories",
      sub: "Keep your festival photos together.", onClick: () => setState({ ...state, tab: "memories" }) },
  ];
  const utilityLinks = essentials.map(({ id, label, sub, onClick }) => ({ id, label: label.toUpperCase(), sub: sub ? sub.toUpperCase() : null, onClick }));
  const claim = isLive
    ? <NpClaim eyebrow={`${liveCount} LIVE NOW / NO SETS SAVED`} title="ONE SET. YOUR WHOLE NIGHT." body="Nothing saved yet. Pick an act that's on now, or the next one up." action="FIND A SET NOW" onAction={() => setState({ ...state, tab: "lineup" })} />
    : <NpClaim eyebrow={`NO SETS SAVED / ${bill} ON THE BILL`} title="ONE SET. YOUR WHOLE NIGHT."
        body={tba ? "No sets saved yet. Start with one artist. Set times land here when they're published." : "No sets saved yet. Start with one artist. Then make the festival yours."}
        action="FIND YOUR FIRST SET" onAction={() => setState({ ...state, tab: "lineup" })} />;
  const boardGap = { display: "flex", flexDirection: "column", gap: 24, padding: "24px 0" };

  return (
    <Screen bg="var(--paper)">
      <ScrollBody ref={scrollRef} className="np" data-night-print style={{ padding: "calc(var(--top-pad, 0px) + 4px) 0 0", ...npSchemeVars() }} onTouchStart={handlePullStart} onTouchMove={handlePullMove}>
      {pullRefresh && (
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            border: "2px solid var(--line)", borderTopColor: "var(--np-ink)",
            animation: "spin 0.8s linear infinite",
          }}/>
        </div>
      )}
      {/* One composed print column on a wide screen, never a stretched
          phone screenshot: the sheet keeps its gutters and its rules. */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <NpHead online={online} offline={offline} onToggleOffline={() => setOffline(o => !o)}
        unread={unread} onAlerts={() => setAlertsOpen(true)} onSearch={() => window.plurskyOpenSearch?.()} />

      {isPostFestival
        ? <NpStrip status="ENDED" fold="THAT'S A WRAP" foldRight={FESTIVAL_CONFIG.dates} />
        : isLive
          ? <NpStrip status={duoNightLabel().toUpperCase()} fold="YOUR NIGHT IS ON" foldRight={FESTIVAL_CONFIG.dates} sunrise={duoSunrise()} />
          : <NpPoster countdown={countdown} stampText={stampText} fold="YOUR NIGHT STARTS HERE" foldRight="↓" />}

      {isPostFestival && (
        <div style={boardGap}>
          <div style={{ padding: "0 18px" }}><PostFestivalRecap state={state} setState={setState} /></div>
          {notice}
          {state.friendLineup?.length > 0 && <div style={{ padding: "0 18px" }}><FriendLineupBanner state={state} setState={setState} /></div>}
        </div>
      )}

      {isLive && (
        <div style={boardGap}>
          {savedIds.length > 0
            ? <DuoPlanCard state={state} setState={setState} plan={tonight} onOpenNight={() => setSheet("night")} />
            : <div style={{ margin: "-24px 0 0" }}>{claim}</div>}
          {NOW.night != null && <DuoStageBoard state={state} setState={setState} />}
          {notice}
          {state.friendLineup?.length > 0 && <div style={{ padding: "0 18px" }}><FriendLineupBanner state={state} setState={setState} /></div>}
        </div>
      )}

      {!isPostFestival && !isLive && (
        <>
          {(notice || state.friendLineup?.length > 0) && (
            <div style={boardGap}>
              {notice}
              {state.friendLineup?.length > 0 && <div style={{ padding: "0 18px" }}><FriendLineupBanner state={state} setState={setState} /></div>}
            </div>
          )}
          {savedRows.length
            ? <NpSaved rows={savedRows} state={state} setState={setState} onAll={() => setSheet("night")} />
            : claim}
        </>
      )}

      <NpJourney steps={steps} />

      {/* Recent memories: the rewatch loop's front door. Post-festival,
          PostFestivalRecap above leads with its own memories. */}
      {!isPostFestival && window.HomeMemoriesStrip && (
        <div style={{ padding: "8px 18px 24px" }}>{React.createElement(window.HomeMemoriesStrip, { state, setState })}</div>
      )}

      <NpUtility eyebrow={isPostFestival ? "AFTER THE NIGHT" : isLive ? "TONIGHT" : "BEFORE YOU GO"} links={utilityLinks} />

      {/* This festival's past editions (historical.jsx), newest first.
          Read-only look-backs; nothing renders when there are none. */}
      {typeof PastEditionsSection === "function" && <div style={{ padding: "8px 0 32px" }} data-np-after><PastEditionsSection festivalId={FESTIVAL_CONFIG.id} /></div>}
      </div>
      </ScrollBody>

      <div className="np" style={{ display: "contents" }}>
      {/* Alerts drawer */}
      {alertsOpen && (
        <AlertsDrawer alerts={alerts} onClose={() => {
          setAlertsOpen(false);
          setState({ ...state, alerts: alerts.map(a => ({ ...a, unread: false })) });
        }} onOpenMap={() => { setAlertsOpen(false); setState({ ...state, tab: "map" }); }}
          onOpenLineup={() => { setAlertsOpen(false); setState({ ...state, tab: "lineup" }); }}
        />
      )}

      {/* First-timer guide drawer — bundles gate hours, bag policy, lingo,
          survival tips, and a recommended day-1 plan in one scrollable sheet. */}
      {firstTimerOpen && (
        <FirstTimerGuide onClose={() => {
          setFirstTimerOpen(false);
          setFtDismissed(true);
          try { localStorage.setItem("ft_guide_seen", "1"); } catch {}
        }}
        onOpenMap={() => { setFirstTimerOpen(false); setState({ ...state, tab: "map" }); }}
        onOpenLineup={() => { setFirstTimerOpen(false); setState({ ...state, tab: "lineup" }); }}
        />
      )}
      {sheetView && (
        <FieldSheet title={sheetView.title} eyebrow={sheetView.eyebrow} onClose={() => setSheet(null)}>
          {sheetView.body}
        </FieldSheet>
      )}
      </div>
    </Screen>
  );
}

// Pre-festival headliners by night (moved verbatim out of the old Home body;
// Field Home opens it from the essentials row).
function HeadlinerHighlights({ state, setState }) {
          const headliners = ARTISTS.filter(a => a.tier >= 2)
            .sort((a, b) => (b.tier - a.tier) || a.day - b.day || toNightMin(a.start) - toNightMin(b.start))
            .slice(0, 9);
          if (!headliners.length) return null;
          const dayGroups = festivalDayNums().map(d => ({
            day: d, meta: FESTIVAL_CONFIG.dayDates[d],
            artists: headliners.filter(a => a.day === d).slice(0, 3),
          })).filter(g => g.artists.length);
          return (
            <div style={{ marginTop: 18 }}>
              <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, color: "var(--muted)", fontWeight: 600, marginBottom: 10 }}>
                LINEUP HIGHLIGHTS
              </div>
              <div className="no-scrollbar" style={{
                display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none",
                marginRight: -16, paddingRight: 16,
              }}>
                {dayGroups.map(g => {
                  const gateMs = g.meta?.midnightUtc ? g.meta.midnightUtc + 18 * 3600000 : 0;
                  const daysUntil = gateMs > Date.now() ? Math.ceil((gateMs - Date.now()) / 86400000) : 0;
                  return (
                    <div key={g.day} style={{
                      flexShrink: 0, width: 200,
                      background: "var(--paper-2)", border: "1px solid var(--line)",
                      borderRadius: 14, padding: "12px 14px", overflow: "hidden",
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.6, color: "var(--ember-ink)", fontWeight: 700 }}>
                          {g.meta?.name?.toUpperCase() || `DAY ${g.day}`}
                        </span>
                        {daysUntil > 0 && (
                          <span className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "var(--muted)" }}>
                            {daysUntil}D
                          </span>
                        )}
                      </div>
                      {g.artists.map(a => {
                        const st = STAGES.find(s => s.id === a.stage);
                        return (
                          <button key={a.id} onClick={() => setState({ ...state, artist: a.id })} style={{
                            display: "flex", alignItems: "center", gap: 8, width: "100%",
                            background: "transparent", border: "none", padding: "4px 0",
                            cursor: "pointer", textAlign: "left",
                          }}>
                            <div style={{
                              width: 3, height: 28, borderRadius: 3,
                              background: st?.color || "var(--line-2)", flexShrink: 0,
                            }}/>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="serif" style={{
                                fontSize: 14, lineHeight: 1.1, color: "var(--ink)",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}>{a.name}</div>
                              <div className="mono" style={{ fontSize: 8, letterSpacing: 0.8, color: "var(--muted)", marginTop: 1 }}>
                                {st?.short || ""} · {fmt12(a.start)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
}

// Saved sets by day as flat, time-led rows with walk gaps. A clash is a small
// warning with its word, never a neon card. Opened as "My saved sets".
function SavedByDay({ state, setState }) {
  const savedIds = savedInLineup(state.saved);
  const byDay = festivalDayNums().map(day => ({
    day, meta: FESTIVAL_CONFIG.dayDates[day],
    artists: activeLineup(savedIds).filter(a => a.day === day && savedIds.includes(a.id))
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start)),
  })).filter(d => d.artists.length);
  if (!byDay.length) return (
    <div>
      <p style={{ margin: "0 0 16px", fontSize: 15, lineHeight: "21px", color: "var(--text-2)" }}>No saved sets yet.</p>
      <FieldButton onClick={() => setState({ ...state, tab: "lineup" })}>Browse lineup</FieldButton>
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <span style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>
          {savedIds.length} saved {savedIds.length === 1 ? "set" : "sets"}
        </span>
        <ShareLineupButton state={state} />
      </div>
      {byDay.map(({ day, meta, artists }) => (
        <section key={day} style={{ marginTop: 24 }}>
          <h3 style={{ ..._fieldEyebrow, margin: "0 0 4px", color: "var(--text-2)" }}>{meta?.name || `Day ${day}`}</h3>
          {artists.map((a, i) => {
            const prev = artists[i - 1];
            const walk = prev ? stageWalkMinutes(prev.stage, a.stage) : 0;
            const tight = !!prev && walk != null && walk > 0 && (toNightMin(a.start) - toNightMin(prev.end)) < walk;
            const conflict = prev && overlaps(prev, a);
            const stage = STAGES.find(s => s.id === a.stage);
            const prevStage = prev ? STAGES.find(s => s.id === prev.stage) : null;
            return (
              <div key={a.id}>
                {/* The stage change is still worth showing when the walk is
                    unmeasured (walk === null) — you are moving, and by how far
                    is the only part nobody can honestly state. walk === 0 is a
                    same-stage back-to-back, which needs no row at all. */}
                {prev && walk !== 0 && (
                  <div style={{ padding: "4px 0 4px 88px", fontSize: 13, lineHeight: "18px", color: tight ? "var(--warn)" : "var(--text-3)" }}>
                    {tight ? "Tight · " : ""}{walk != null ? `${walk} min walk · ` : ""}{prev.stage === a.stage ? "same stage" : `${prevStage?.short || ""} → ${stage?.short || ""}`}
                  </div>
                )}
                <button onClick={() => setState({ ...state, artist: a.id })} style={{
                  width: "100%", minHeight: 64, padding: "12px 0",
                  display: "flex", alignItems: "flex-start", gap: 12,
                  background: "transparent", border: "none", borderBottom: "1px solid var(--line)",
                  color: "var(--ink)", textAlign: "left", cursor: "pointer",
                }}>
                  <div style={{ width: 76, flexShrink: 0, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 15, lineHeight: "21px", fontWeight: 600 }}>{fmt12(a.start)}</div>
                    <div style={{ fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>{fmt12(a.end)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, lineHeight: "22px", fontWeight: 600, overflowWrap: "anywhere" }}>{actDisplayName(a.name)}</div>
                    {stage && <div style={{ marginTop: 2, fontSize: 13, lineHeight: "18px", color: "var(--text-2)" }}>{stage.name}</div>}
                    {conflict && <div style={{ marginTop: 2, fontSize: 13, lineHeight: "18px", fontWeight: 600, color: "var(--warn)" }}>⚠ Clashes with {actDisplayName(prev.name)} · {fmt12(prev.start)} · {(STAGES.find(s => s.id === prev.stage) || {}).name || "stage TBA"}</div>}
                  </div>
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

const _fieldEyebrow = {
  fontSize: 11, lineHeight: "14px", fontWeight: 600,
  letterSpacing: "0.04em", textTransform: "uppercase",
  display: "flex", alignItems: "center", gap: 6,
};

// ── Today, on the duo board (design/system-exploration @ 6524ccb) ──
// Apple Sports' scoreboard under Apple Invites' header: the status line, the
// festival, then your plan as the one lifted card, then every stage's Now and
// Next. Each piece is real data or absent; nothing is drawn for show.

const _MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Night 2 · Sat May 16": which night of the festival it is, and its date.
function duoNightLabel() {
  const n = NOW.night ?? NOW.day;
  const dd = FESTIVAL_CONFIG.dayDates?.[n];
  const idx = festivalDayNums().indexOf(n);
  const night = idx >= 0 ? `Night ${idx + 1}` : (dd?.name || `Day ${n}`);
  return dd ? `${night} · ${dd.short} ${_MON[dd.m]} ${dd.d}` : night;
}

// Sunrise that ends tonight: the next festival day's sunrise when there is
// one, else tonight's own. Only shown when the config carries sun data.
function duoSunrise() {
  const n = NOW.night;
  const st = FESTIVAL_CONFIG.sunTimes;
  if (n == null || !st) return null;
  const rise = (st[n + 1] || st[n] || {}).rise;
  return rise ? fmt12(rise).replace(/\s?AM$/, "") : null;
}

// A set time inside tonight's scoreboard, as the board prints it: "1:42",
// no AM/PM, because the night heading already says which night it is.
function duoClock(t) {
  return fmt12(t).replace(/\s?(AM|PM)$/, "");
}

// The hero title drops a trailing edition year; the festival chip above it
// already carries the year.
function duoFestivalTitle(name) {
  const y = FESTIVAL_CONFIG.year;
  return y ? String(name).replace(new RegExp(`\\s+${y}$`), "") : name;
}

// Not rendered since Night Print (v411) replaced the board header on Today;
// kept because #296's edition-skin band is written into it until that PR is
// reconciled against the print (which carries the festival's colour itself).
function DuoTodayHeader({ status, live, deviceOffline, title, sub, offline, onToggleOffline, unread, onAlerts, onSearch }) {
  const rise = live ? duoSunrise() : null;
  const tool = { ...fieldIconBtn, color: "var(--ink-2)", position: "relative" };
  return (
    <header style={{ paddingTop: "calc(var(--top-pad, 0px) + 14px)" }}>
      <div style={{ padding: "0 20px" }}>
        {/* The board's first line: which night, and when the sun comes up. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", minHeight: 20 }}>
          <span className="duo-label duo-ink3">{status}{deviceOffline ? " · No signal" : ""}</span>
          {rise && (
            <span className="duo-sun" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4"/></svg>
              <span className="duo-data-s">SUNRISE {rise}</span>
            </span>
          )}
        </div>
        {/* The festival's name is the switcher: tap it to change festival. */}
        <div style={{ marginTop: 8 }}>
          <FestivalChip title={<h1 className="duo-hero duo-name" style={{ margin: 0, fontSize: "clamp(34px, 11.2vw, 44px)" }}>{duoFestivalTitle(title)}</h1>} />
        </div>
      </div>
      {/* Where it is, with the page's three tools set quietly beside it. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 8px 0 20px" }}>
        <span className="duo-body-s duo-ink2" style={{ fontWeight: 400, minWidth: 0 }}>{sub}</span>
        <span style={{ display: "flex", alignItems: "center", flex: "none" }}>
          {onSearch && (
            <button onClick={onSearch} aria-label="Search artists, stages, genres" style={tool}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M15.3 15.3 20 20"/></svg>
            </button>
          )}
          <button onClick={onToggleOffline} aria-label="Offline mode" aria-pressed={offline} style={{ ...tool, color: offline ? "var(--acc-ink)" : "var(--ink-2)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              {offline
                ? <><path d="M4 4 L20 20"/><path d="M8.5 16 Q12 13 15.5 16"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/></>
                : <><path d="M2 8.5 Q12 -1 22 8.5"/><path d="M5 12 Q12 5.5 19 12"/><path d="M8.5 15.5 Q12 12.5 15.5 15.5"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/></>}
            </svg>
          </button>
          <button onClick={onAlerts} aria-label={unread ? `Alerts, ${unread} new` : "Alerts"} style={tool}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9 C6 5.5 8.5 3 12 3 C15.5 3 18 5.5 18 9 L18 13 L20 16 L4 16 L6 13 Z"/><path d="M10 19 Q12 21 14 19"/>
            </svg>
            {unread > 0 && <span aria-hidden="true" style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, background: "var(--acc)", boxShadow: "0 0 0 1.5px var(--bg)" }} />}
          </button>
        </span>
      </div>
    </header>
  );
}

// Your plan: the saved set that is live, else the next one, as the one
// lifted card on the screen. A clash among the sets still ahead tonight sits
// inside it, and "Choose" opens the night sheet whose resolver settles it.
function DuoPlanCard({ state, setState, plan, onOpenNight }) {
  const savedIds = savedInLineup(state.saved);
  const saved = activeLineup(savedIds).filter(a => savedIds.includes(a.id));
  const now = Date.now();
  const live = saved.find(a => isSetLive(a)) || null;
  const next = live ? null : (saved
    .map(a => ({ a, t: festivalNightDate(a.day, a.start).getTime() }))
    .filter(x => x.t > now)
    .sort((x, y) => x.t - y.t)[0] || {}).a || null;
  const set = live || next;
  const open = (id) => setState({ ...state, artist: id });
  if (!set) {
    return (
      <section style={{ padding: "0 20px" }}>
        <div className="duo-card" style={{ padding: 16 }}>
          <DuoSect title="Your plan" />
          <p className="duo-body duo-ink2" style={{ margin: "10px 0 14px" }}>
            {saved.length ? "Your saved sets are all done." : "Save a few sets and your night shows up here."}
          </p>
          <button className="duo-btn pri" style={{ width: "100%" }} onClick={() => setState({ ...state, tab: "lineup" })}>Browse lineup</button>
        </div>
      </section>
    );
  }
  const stage = STAGES.find(s => s.id === set.stage) || UNPLACED_STAGE;
  const startMs = festivalNightDate(set.day, set.start).getTime();
  const endMs = startMs + Math.max(1, toNightMin(set.end) - toNightMin(set.start)) * 60000;
  const minsLeft = Math.max(0, Math.round((endMs - now) / 60000));
  const pct = live ? Math.min(100, Math.max(0, Math.round((now - startMs) / (endMs - startMs) * 100))) : 0;
  const minsUntil = Math.round((startMs - now) / 60000);
  const until = minsUntil < 60 ? `In ${Math.max(1, minsUntil)} min`
    : minsUntil < 12 * 60 ? `In ${Math.floor(minsUntil / 60)} hr ${minsUntil % 60} min`
    : (FESTIVAL_CONFIG.dayDates?.[set.day]?.name || `Day ${set.day}`);
  const clash = (plan || []).find(p => p.conflict && !p.isPast && p.prev) || null;
  const side = (a) => {
    const st = STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE;
    return (
      <button key={a.id} className="duo-press" onClick={() => open(a.id)} aria-label={`${a.name}, ${fmt12(a.start)}, ${st.name}`}
        style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
        <DuoAvatar name={a.name} size={30} ring="cl" />
        <span style={{ minWidth: 0 }}>
          <span className="duo-name" style={{ display: "block", fontWeight: 600, fontSize: 14, lineHeight: 1.29, fontFamily: "var(--f-ui)" }}>{actDisplayName(a.name)}</span>
          <span className="duo-data-s duo-ink2" style={{ display: "block", marginTop: 2 }}>{duoClock(a.start)} · {st.name.toUpperCase()}</span>
        </span>
      </button>
    );
  };
  return (
    <section style={{ padding: "0 20px" }}>
      <div className="duo-card duo-lift" data-duo-plan style={{ padding: "14px 16px" }}>
        <DuoSect title={<button className="duo-press" onClick={onOpenNight} aria-label="Your plan, open my night" style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "auto", minHeight: 32, color: "inherit", font: "inherit", letterSpacing: "inherit", textTransform: "inherit" }}>Your plan<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>}
          right={live ? <DuoLive /> : <span className="duo-label duo-ink3">Next · {until}</span>} />
        <button className="duo-press" onClick={() => open(set.id)} aria-label={`${set.name}, ${stage.name}, ${live ? `live until ${fmt12(set.end)}` : `${until}, ${fmt12(set.start)}`}`}
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginTop: 12 }}>
          <span style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
            <DuoAvatar name={set.name} size={52} ring="on" />
            <span style={{ minWidth: 0, paddingTop: 3 }}>
              <span className="duo-name" style={{ display: "block", fontWeight: 700, fontSize: 18, lineHeight: 1.222, fontFamily: "var(--f-ui)" }}>{actDisplayName(set.name)}</span>
              <span className="duo-data-s duo-ink3" style={{ display: "block", marginTop: 4 }}><span className="np-pair"><span>{stage.name.toUpperCase()}</span><span>{live ? `TO ${duoClock(set.end)}` : duoClock(set.start)}</span></span></span>
            </span>
          </span>
          {live && (
            <span className="duo-wide" style={{ textAlign: "right", flex: "none" }}>
              <span className="duo-clock" style={{ display: "block" }}>{minsLeft}</span>
              <span className="duo-data-s duo-ink3" style={{ display: "block", marginTop: 3 }}>MIN LEFT</span>
            </span>
          )}
        </button>
        {live && <div className="duo-narrow duo-data-s duo-ink3" style={{ marginTop: 10, textAlign: "right" }}>{minsLeft} MIN LEFT</div>}
        {live && <div className="duo-track" style={{ marginTop: 12 }} role="progressbar" aria-label="Set progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><b style={{ width: `${pct}%` }} /></div>}
        {clash && (
          <div className="duo-well" style={{ marginTop: 14, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span className="duo-label duo-clash">Clash<span className="duo-wide" style={{ display: "inline" }}> · pick one</span></span>
              <button className="duo-link" onClick={onOpenNight}>Choose</button>
            </div>
            <div style={{ display: "grid", gap: 4, marginTop: 4 }}>{side(clash.prev)}{side(clash.artist)}</div>
          </div>
        )}
      </div>
    </section>
  );
}

// Every stage, Now and Next, the way a scoreboard lists games: the stage,
// then who is on and who follows, face first. Tapping a name opens the act.
function duoStageNowNext() {
  const night = NOW.night;
  const nowMin = toNightMin(NOW.time);
  const lineup = activeLineup();
  return STAGES.map(stage => {
    const on = lineup.find(a => a.stage === stage.id && isSetLive(a)) || null;
    const next = night == null ? null : lineup
      .filter(a => a.stage === stage.id && a.day === night && a.start && toNightMin(a.start) > nowMin && a !== on)
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start))[0] || null;
    return { stage, on, next };
  }).filter(r => r.on || r.next);
}

function DuoStageBoard({ state, setState }) {
  const rows = duoStageNowNext();
  const savedSet = new Set(state.saved || []);
  // Nine rows of Now / Next pushed the rest of the page a screen and a half down on
  // festival night. The board opens on the stages that carry one of your sets (filled
  // to three with stages that are live), and one row shows every stage in place.
  const [allStages, setAllStages] = React.useState(false);
  const lead = React.useMemo(() => {
    const picked = rows.filter(r => (r.on && savedSet.has(r.on.id)) || (r.next && savedSet.has(r.next.id)));
    for (const r of rows) { if (picked.length >= 3) break; if (!picked.includes(r) && r.on) picked.push(r); }
    for (const r of rows) { if (picked.length >= 3) break; if (!picked.includes(r)) picked.push(r); }
    return new Set(picked);
  }, [rows.length, state.saved]);
  if (!rows.length) return null;
  const folded = rows.length > 4 && !allStages;
  const shown = folded ? rows.filter(r => lead.has(r)) : rows;
  const liveCount = rows.filter(r => r.on).length;
  const cell = (a, detail, spoken, tag) => a ? (
    <button className="duo-press" onClick={() => setState({ ...state, artist: a.id })} aria-label={`${a.name}, ${spoken}`}
      style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, minHeight: 44 }}>
      <DuoAvatar name={a.name} size={36} ring={savedSet.has(a.id) ? "on" : ""} />
      <span style={{ minWidth: 0, paddingTop: 1 }}>
        <span className="duo-name" style={{ display: "block", fontWeight: 600, fontSize: 14, lineHeight: 1.29, fontFamily: "var(--f-ui)" }}>{actDisplayName(a.name)}</span>
        <span className="duo-data-s duo-ink3" style={{ display: "block", marginTop: 3 }}><span className="duo-sb-tag">{tag.toUpperCase()} · </span>{detail}</span>
      </span>
    </button>
  ) : <span className="duo-body-s duo-ink3" style={{ fontWeight: 400, paddingTop: 8 }}><span className="duo-sb-tag">{tag} · </span>Stage closed</span>;
  return (
    <section style={{ padding: "0 20px" }} data-duo-stages>
      <DuoSect title="Every stage" right={<span className="duo-data-s duo-ink3">{liveCount} LIVE</span>} />
      <div className="duo-card" style={{ marginTop: 10, overflow: "hidden" }}>
        <div className="duo-sb-grid duo-sb-head" style={{ padding: "10px 16px 8px" }}>
          <DuoLive>Now</DuoLive><span className="duo-label duo-ink3">Next</span>
        </div>
        {shown.map(({ stage, on, next }) => (
          <div key={stage.id} className="duo-hair" style={{ padding: "12px 16px 14px" }}>
            <div className="duo-ink2" style={{ font: "600 13px/1.23 var(--f-ui)" }}>{stage.name}</div>
            <div className="duo-sb-grid" style={{ marginTop: 10 }}>
              {cell(on, on ? `TO ${duoClock(on.end)}` : "", on ? `until ${fmt12(on.end)}` : "", "Now")}
              {cell(next, next ? duoClock(next.start) : "", next ? `next at ${fmt12(next.start)}` : "", "Next")}
            </div>
          </div>
        ))}
        {rows.length > 4 && (
          <button className="duo-link duo-hair" data-duo-stages-toggle aria-expanded={!folded} onClick={() => setAllStages(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 16px", minHeight: 48, textAlign: "left" }}>
            <span>{folded ? `All ${rows.length} stages` : "Fewer stages"}</span>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: folded ? "none" : "rotate(180deg)", transition: "transform .2s" }}><path d="M6 9l6 6 6-6"/></svg>
          </button>
        )}
      </div>
    </section>
  );
}

// One notice card. A warning carries its label in text and a glyph, set in
// the sunrise/caution colour, never colour alone.
function FieldNotice({ eyebrow, text, action, onAction, onDismiss, warn }) {
  return (
    <div role="status" className="duo-card" style={{
      margin: "0 20px", display: "flex", alignItems: "center", gap: 4,
      padding: "10px 4px 10px 16px",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div className={`duo-label ${warn ? "duo-sun" : "duo-ink3"}`} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {warn && <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 L21.5 20 H2.5 Z"/><path d="M12 10 V14"/><path d="M12 17 V17.2"/></svg>}
            {eyebrow}
          </div>
        )}
        <div className="duo-body" style={{ fontSize: 15 }}>{text}</div>
      </div>
      {action && <button className="duo-link" onClick={onAction} style={{ padding: "0 12px", fontSize: 15 }}>{action}</button>}
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" style={{ ...fieldIconBtn, color: "var(--ink-3)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>
        </button>
      )}
    </div>
  );
}

function LiveAcrossStrip({ strip, state, setState }) {
  const savedSet = new Set(state.saved || []);
  const liveCount = strip.filter(s => s.artist).length;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: 1.6, color: "var(--muted)", fontWeight: 600 }}>
          LIVE ACROSS STAGES
        </div>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--ember-ink)" }}>
          {liveCount}/{strip.length} ON
        </span>
      </div>
      <div className="no-scrollbar" style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", marginRight: -16, paddingRight: 16 }}>
        {strip.map(({ stage, artist, upcoming, minsUntil }) => {
          const isSaved   = artist   && savedSet.has(artist.id);
          const nextSaved = upcoming && savedSet.has(upcoming.id);
          return (
            <button
              key={stage.id}
              onClick={() => {
                if (artist)   return setState({ ...state, tab: "home", artist: artist.id });
                if (upcoming) return setState({ ...state, tab: "home", artist: upcoming.id });
                setState({ ...state, tab: "map", focusStage: stage.id });
              }}
              style={{
                flexShrink: 0, width: 136, textAlign: "left",
                padding: "9px 11px", borderRadius: 13,
                background: isSaved
                  ? "rgba(var(--signal-rgb),0.12)"
                  : artist ? "var(--paper-2)" : "transparent",
                border: `1px solid ${isSaved ? "rgba(var(--signal-rgb),0.4)" : artist ? "var(--line)" : "var(--line-2)"}`,
                borderLeft: `3px solid ${isSaved ? "var(--signal)" : "var(--line-2)"}`,
                cursor: "pointer",
                opacity: (artist || upcoming) ? 1 : 0.45,
              }}>

              {/* Stage label row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {artist && (
                    <span style={{
                      width: 6, height: 6, borderRadius: 6, background: "var(--signal)",
                      boxShadow: "0 0 0 3px rgba(var(--signal-rgb),0.2)",
                      animation: "pulse 1.6s ease-in-out infinite",
                      flexShrink: 0,
                    }}/>
                  )}
                  <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--text-2)", fontWeight: 700 }}>
                    {stage.short}
                  </span>
                </div>
                {isSaved && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--signal-ink)" stroke="none">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                )}
              </div>

              {/* Artist name or "dark" state */}
              {artist ? (
                <>
                  <div className="serif" style={{
                    fontSize: 14, lineHeight: 1.1, marginTop: 4,
                    color: "var(--ink)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {artist.name}
                  </div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2 }}>
                    {fmt12(artist.start)}–{fmt12(artist.end)}
                  </div>
                </>
              ) : upcoming ? (
                <>
                  <div style={{
                    fontSize: 10, lineHeight: 1.15, marginTop: 4,
                    color: nextSaved ? "var(--signal-ink)" : "var(--muted)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    fontStyle: "italic",
                  }}>
                    {upcoming.name}
                  </div>
                  <div className="mono" style={{ fontSize: 8, letterSpacing: 1, color: "var(--muted)", marginTop: 2 }}>
                    IN {minsUntil}m · {fmt12(upcoming.start)}
                  </div>
                </>
              ) : (
                <>
                  <div className="serif" style={{ fontSize: 13, lineHeight: 1.1, marginTop: 4, color: "var(--muted)" }}>
                    Stage dark
                  </div>
                  <div className="mono" style={{ fontSize: 9, letterSpacing: 1, color: "var(--muted)", marginTop: 2 }}>
                    {stage.name.toUpperCase()}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TonightsPlan({ plan, state, setState }) {
  const tightCount = plan.filter(p => p.tight || p.conflict).length;
  const conflicts = plan.filter(p => p.conflict).map(p => [p.prev, p.artist]);
  const [resolverOpen, setResolverOpen] = React.useState(false);
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 className="duo-sect">Tonight's plan</h3>
        <button onClick={() => setState({ ...state, tab: "lineup" })} className="duo-link">All →</button>
      </div>

      {plan.length === 0 ? (
        <div className="duo-well" style={{ padding: "20px 16px", textAlign: "center" }}>
          <div className="duo-headline">No sets saved for tonight</div>
          <div className="duo-body-s duo-ink2" style={{ marginTop: 4, fontWeight: 400 }}>
            Tap + on any set in the Lineup to add it.
          </div>
        </div>
      ) : (
        <>
          {tightCount > 0 && (
            <div className="duo-card" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "6px 6px 6px 14px", marginBottom: 10, minHeight: 52,
            }}>
              <span className="duo-body-s" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, fontWeight: 400 }}>
                <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--clash)", flexShrink: 0 }} />
                {tightCount} tight transition{tightCount > 1 ? "s" : ""} · check leave-by times
              </span>
              {conflicts.length > 0 && (
                <button onClick={() => setResolverOpen(r => !r)} aria-expanded={resolverOpen} className="duo-chip">
                  <span>{resolverOpen ? "Close" : "Resolve"}</span>
                </button>
              )}
            </div>
          )}
          {resolverOpen && conflicts.length > 0 && (
            <div style={{ margin: "0 -4px 10px" }}>
              <ConflictResolver
                conflicts={conflicts}
                onKeep={(keepId, dropId) => {
                  setState({ ...state, saved: state.saved.filter(id => id !== dropId) });
                  setResolverOpen(false);
                }}
                onSplit={() => setResolverOpen(false)}
              />
            </div>
          )}
          {plan.map(p => <PlanRow key={p.artist.id} entry={p} state={state} setState={setState} />)}
        </>
      )}
    </>
  );
}

function PlanRow({ entry, state, setState }) {
  const { artist: a, prev, walk, minsUntil, isLive, isPast, leaveBy, tight, conflict } = entry;
  // stage is null when a lineup is published before stage assignments
  // (Escape Halloween 2026, III Points 2026). See UNPLACED_STAGE in data.jsx.
  const stage = (STAGES.find(s => s.id === a.stage) || UNPLACED_STAGE);
  const leaveByLabel = leaveBy != null ? (() => {
    const m = ((leaveBy % (24 * 60)) + (24 * 60)) % (24 * 60);
    const h = Math.floor(m / 60) % 24;
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  })() : null;

  return (
    <div>
      {/* Walking transition pill from previous set */}
      {prev && walk !== 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 0 4px 56px", marginBottom: 2,
        }}>
          <div style={{ width: 1.5, height: 18, background: tight ? "var(--clash)" : "var(--line-2)" }}/>
          <span className="duo-data-s" style={{
            color: tight ? "var(--clash)" : "var(--ink-2)",
          }}>
            {/* No minutes and no LEAVE BY on an unmeasured pair: leaveByLabel
                is already null there, because leaveBy is. */}
            {walk != null ? `${walk} min walk · ` : ""}{prev.stage === a.stage ? "Same stage" : `${STAGES.find(s=>s.id===prev.stage)?.short || "TBA"} → ${stage?.short || "TBA"}`}
            {leaveByLabel && ` · leave by ${leaveByLabel}`}
          </span>
        </div>
      )}

      {/* The set row: the board's list row. A past set reads quieter by
          colour (opacity took its labels under AA); live = the lifted card;
          a clash = the clash ring and the word. */}
      <div onClick={() => setState({ ...state, tab: "home", artist: a.id })}
        className={"duo-lrow" + (isLive ? " live" : "")}
        style={{ cursor: "pointer", margin: 0, paddingLeft: 4 }}>
        <div style={{ width: 72, flexShrink: 0 }}>
          <div className="duo-data" style={{ fontSize: 13, color: isPast ? "var(--ink-3)" : "var(--ink)" }}>{fmt12(a.start)}</div>
          <div className="duo-data-s" style={{ color: isLive ? "var(--live)" : "var(--ink-2)", marginTop: 1 }}>
            {isLive ? "Live" : isPast ? "Done" : minsUntil < 60 ? `${minsUntil}m` : `${Math.floor(minsUntil/60)}h${(minsUntil%60).toString().padStart(2,"0")}`}
          </div>
        </div>
        <DuoAvatar name={a.name} size={42} ring={conflict ? "cl" : isLive ? "on" : ""} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="duo-headline duo-name" style={{ fontWeight: 700, color: isPast ? "var(--ink-2)" : "var(--ink)" }}>{actDisplayName(a.name)}</div>
          <div className="duo-body-s duo-ink2" style={{ fontWeight: 400 }}>
            {stage.name}{conflict ? <span style={{ color: "var(--clash)" }}> · clash</span> : ""}
          </div>
        </div>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M9 6 L15 12 L9 18" />
        </svg>
      </div>
    </div>
  );
}

function CountdownPart({ n, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div className="serif" style={{
        fontSize: 52, lineHeight: 0.92, letterSpacing: -1.5,
        color: "var(--ink)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {String(n).padStart(2, "0")}
      </div>
      <div className="mono" style={{
        fontSize: 9, letterSpacing: 1.5, color: "var(--muted)",
        marginTop: 2, fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  );
}

function homeBtn(kind) {
  const base = {
    border: "none", cursor: "pointer",
    borderRadius: 999, padding: "11px 16px",
    fontFamily: "Geist Mono, monospace",
    fontSize: 10, letterSpacing: 1.2, fontWeight: 500,
    textTransform: "uppercase",
  };
  if (kind === "solid")  return { ...base, background: "var(--ink)", color: "var(--paper)" };
  if (kind === "ghost")  return { ...base, background: "rgba(var(--ink-rgb),0.15)", color: "var(--ink)", backdropFilter: "blur(6px)" };
  return base;
}

function AlertsDrawer({ alerts, onClose, onOpenMap, onOpenLineup }) {
  // One ink per kind, from the print's own semantic tokens.
  const inkFor = (k) => ({ reminder: "var(--sun)", friend: "var(--acc)", safety: "var(--alert)", conflict: "var(--clash)", drop: "var(--live)" }[k] || "var(--ink)");
  return (
    <FieldSheet title="Alerts" eyebrow="Live feed" onClose={onClose}>
      {!alerts.length && (
        <div style={{ padding: "14px 0 10px" }}>
          <div style={{ font: "700 20px/1.1 var(--f-ui)", letterSpacing: "-0.02em" }}>Nothing yet.</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>Clashes in your plan, friend pings and weather warnings land here.</div>
        </div>
      )}
      {alerts.map(a => {
        const onClick = a.kind === "conflict" ? onOpenLineup : a.kind === "friend" ? onOpenMap : null;
        const Row = onClick ? "button" : "div";
        return (
          <Row key={a.id} onClick={onClick || undefined} style={{
            display: "flex", gap: 12, width: "100%", minHeight: 44, padding: "12px 0",
            borderBottom: "1px solid var(--line)", background: "none", border: 0, borderBottomWidth: 1,
            color: "inherit", font: "inherit", textAlign: "left",
            cursor: onClick ? "pointer" : "default",
            opacity: a.unread ? 1 : 0.7,
          }}>
            <div style={{ width: 4, background: inkFor(a.kind), flexShrink: 0, alignSelf: "stretch", opacity: a.unread ? 1 : 0.4 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ font: "700 16px/1.15 var(--f-ui)", letterSpacing: "-0.01em" }}>{a.title}</div>
                <div className="np-mono" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{a.time}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.35 }}>{a.body}</div>
            </div>
          </Row>
        );
      })}
    </FieldSheet>
  );
}

// ── Don't-miss strip ───────────────────────────────────────────────
// Surfaces auto-detected legendary moments (sunrise sets, B2B collabs)
// for the given festival day. Same isLegendary logic as lineup.jsx so
// vets see the same callouts whether they're browsing or skimming home.
function DontMissStrip({ day, state, setState }) {
  const moments = React.useMemo(() => {
    return activeLineup()
      .filter(a => a.day === day && (typeof isLegendary === "function" ? isLegendary(a) : false))
      .sort((a, b) => toNightMin(a.start) - toNightMin(b.start))
      .slice(0, 6);
  }, [day]);
  if (!moments.length) return null;
  const dayMeta = FESTIVAL_CONFIG.dayDates[day];
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div className="serif" style={{ fontSize: 22 }}>
          Don't <span style={{ fontStyle: "italic", color: "var(--signal-ink)" }}>miss</span>
        </div>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: "var(--muted)" }}>
          {dayMeta?.name?.toUpperCase() || `DAY ${day}`} · LEGENDARY
        </span>
      </div>
      <div className="no-scrollbar" style={{
        display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
        marginRight: -16, paddingRight: 16,
      }}>
        {moments.map(a => {
          const stage = STAGES.find(s => s.id === a.stage);
          const isSunrise = stage?.id === FESTIVAL_CONFIG.mainStageId && parseInt(a.end) >= 5 && parseInt(a.end) < 6;
          return (
            <button key={a.id} onClick={() => setState({ ...state, tab: "home", artist: a.id })} style={{
              flexShrink: 0, width: 168, padding: "10px 11px", textAlign: "left",
              borderRadius: 14, border: "1px solid rgba(var(--signal-rgb),0.45)",
              background: "linear-gradient(135deg, rgba(var(--signal-rgb),0.10) 0%, rgba(var(--signal-rgb),0.06) 100%)",
              cursor: "pointer",
            }}>
              <div className="mono" style={{ fontSize: 8, letterSpacing: 1.4, color: "var(--signal-ink)", fontWeight: 800 }}>
                {isSunrise ? "🌅 SUNRISE SET" : "★ B2B COLLAB"}
              </div>
              <div className="serif" style={{
                fontSize: 16, lineHeight: 1.1, marginTop: 5,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{a.name}</div>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.1, color: "var(--muted)", marginTop: 4, textTransform: "uppercase" }}>
                {stage?.short || ""} · {fmt12(a.start)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── First-timer guide ──────────────────────────────────────────────
// Concise sections covering the things a Plursky-newcomer needs before they
// arrive at LVMS. Sourced from the official EDC Festival Guide (gates, bag
// policy, sunrise sets) and harm-reduction guidance from DanceSafe.
const FT_SECTIONS = [
  {
    id: "gates",
    icon: "🚪",
    title: "Gates & entry",
    items: [
      "Gates open 4 PM Friday\u2013Sunday. Music runs 7\u00a0PM\u00a0\u2013\u00a05:30\u00a0AM.",
      "Bring a valid government-issued photo ID. 18+ event.",
      "Wristband activates online before you arrive — don't show up with it unpaired.",
      "One re-entry per day, only between 4 PM and midnight.",
      "Clear bag, max 12\" × 6\" × 12\". Hydration packs OK if empty.",
    ],
  },
  {
    id: "lingo",
    icon: "🗣️",
    title: "Words you'll hear",
    items: [
      "PLUR — Peace, Love, Unity, Respect. The unspoken code.",
      "Kandi — beaded bracelets. Trade them with strangers.",
      "Totem — tall flag/sign so your group can find you in the crowd.",
      "Sunrise set — the legendary final set as the sun comes up at Kinetic Field.",
      "Headliner — top-billed act, usually 11 PM – 5 AM at the biggest stages.",
      "B2B — back-to-back DJ set; two artists trading on the decks.",
    ],
  },
  {
    id: "survive",
    icon: "💧",
    title: "Survive the desert",
    items: [
      "Drink water before you're thirsty. Free refill stations all over the map (tap the 💧 chip).",
      "Days are warm (~70°F), nights are cold (~50°F). Bring a light jacket.",
      "Earplugs. Your future self will thank you.",
      "Eat real food before headliners. The food halls in Daisy Lane stay open all night.",
      "If you or a friend feels off, the Ground Control & GroundedSpace tents are no-questions-asked safe spaces.",
    ],
  },
  {
    id: "travel",
    icon: "🚌",
    title: "Getting there & back",
    items: [
      "Shuttles run from Strip hotels all night. Last departure ~5:30 AM.",
      "Driving: lots fill 6–8 PM, exiting at 5 AM is a 90-min crawl.",
      "Rideshare: Uber/Lyft pickup is the South Lot — tap the 🚗 button on the map for one-tap deep links.",
      "Phone signal at the venue is unreliable. Set a meeting point with your group BEFORE entering.",
    ],
  },
  {
    id: "day1",
    icon: "🌅",
    title: "Recommended Day 1",
    items: [
      "Arrive by 7 PM. Walk the perimeter once to find your bearings — it's huge.",
      "Hit Kinetic Field for the opening; the stage drop at sundown is the moment.",
      "Anchor for one full headliner set, then wander. Don't try to chase 12 sets.",
      "Eat at midnight. Sleep is for after the sunrise set.",
      "End at Cosmic Meadow, Stereo Bloom, or stay at Kinetic for the sunrise.",
    ],
  },
];

// Each section is a numbered row on a rule (the print's journey, not a card); the
// first opens by default. The quick jumps are the sheet's footer, so a scrolled list
// never cuts them and they always clear the tab bar.
function FirstTimerGuide({ onClose, onOpenMap, onOpenLineup }) {
  const [openIdx, setOpenIdx] = React.useState(0);
  const jump = (primary) => ({
    flex: 1, minHeight: 44, padding: "0 12px", cursor: "pointer",
    background: primary ? "var(--ink)" : "var(--paper)", color: primary ? "var(--paper)" : "var(--ink)",
    border: primary ? "none" : "1px solid var(--line-2)", borderRadius: "var(--rad-sm)",
    font: "700 10px/1.2 var(--f-data)", letterSpacing: "0.13em", textTransform: "uppercase",
  });
  const footer = (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onOpenMap} style={jump(true)}>Explore map</button>
      <button onClick={onOpenLineup} style={jump(false)}>Browse lineup</button>
    </div>
  );
  return (
    <FieldSheet title="The basics" eyebrow={`First time at ${FESTIVAL_CONFIG.brand}`} footer={footer} onClose={onClose}>
      {FT_SECTIONS.map((s, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
            <button onClick={() => setOpenIdx(isOpen ? -1 : i)} aria-expanded={isOpen} style={{
              width: "100%", minHeight: 56, padding: "12px 0", display: "flex", alignItems: "center", gap: 14,
              background: "none", border: 0, color: "inherit", textAlign: "left", cursor: "pointer", font: "inherit",
            }}>
              <span className="np-idx" style={{ color: "var(--ink-3)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, font: "700 18px/1.15 var(--f-ui)", letterSpacing: "-0.02em" }}>{s.title}</span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {isOpen && (
              <ul style={{ listStyle: "none", margin: 0, padding: "0 0 16px 38px" }}>
                {s.items.map((it, k) => (
                  <li key={k} style={{ position: "relative", marginTop: 8, fontSize: 13, lineHeight: 1.4, color: "var(--ink)" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: -14, top: 7, width: 5, height: 5, borderRadius: 5, background: "var(--acc)" }}/>
                    {it.replace(/(\d)\s(AM|PM)\b/g, "$1\u00a0$2")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </FieldSheet>
  );
}

// ── Lineup sharing ───────────────────────────────────────────
// Encode/decode happens via the ?lineup=id1,id2 query param parsed in app.jsx
// state init. The link is fully self-contained — no server, no friend graph,
// no privacy model. Drop it in iMessage / Snap / WhatsApp and the receiver
// sees your saved sets next to their own.

function _buildShareUrl(savedIds) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?lineup=${savedIds.join(",")}`;
}


function FriendLineupBanner({ state, setState }) {
  const friendIds = savedInLineup(state.friendLineup);
  const savedSet = new Set(state.saved || []);
  const overlap = friendIds.filter(id => savedSet.has(id));
  const fresh = friendIds.filter(id => !savedSet.has(id));
  const [expanded, setExpanded] = React.useState(false);

  const dismiss = () => setState({ ...state, friendLineup: null, friendName: null });

  const addAll = () => {
    const merged = [...new Set([...(state.saved || []), ...friendIds])];
    setState({ ...state, saved: merged });
  };
  const addOverlap = () => {
    // Already-overlapping IDs are by definition already saved — meaningful only
    // when the friend has sets you don't yet. Falls back to addAll otherwise.
    if (!fresh.length) return;
    const merged = [...new Set([...(state.saved || []), ...fresh])];
    setState({ ...state, saved: merged });
  };

  return (
    <div className="duo-card" style={{ marginTop: 18, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="duo-label duo-acc" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          Shared with you{state.friendName ? ` · ${state.friendName}` : ""}
        </span>
        <button onClick={dismiss} aria-label="Dismiss" style={{
          background: "transparent", border: "none", color: "var(--ink-2)",
          cursor: "pointer", fontSize: 20, minWidth: 44, minHeight: 44, marginRight: -12, lineHeight: 1, flexShrink: 0,
        }}>×</button>
      </div>
      <div className="duo-headline" style={{ fontSize: 20, marginBottom: 2 }}>
        {state.friendName ? state.friendName : "Your friend"}’s lineup
      </div>
      <div className="duo-data-s duo-ink2" style={{ marginBottom: 6 }}>
        {friendIds.length} sets saved · {overlap.length} match yours
        {fresh.length > 0 && ` · ${fresh.length} new to you`}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setExpanded(e => !e)} aria-expanded={expanded} className="duo-chip">
          <span>{expanded ? "Hide sets" : "View sets"}</span>
        </button>
        {fresh.length > 0 && (
          <button onClick={addOverlap} className="duo-btn pri" style={{ minHeight: 44, padding: "0 16px", fontSize: 14 }}>
            + Add {fresh.length} new
          </button>
        )}
        <button onClick={addAll} className="duo-chip"><span>+ Add all</span></button>
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          {festivalDayNums().map(day => {
            const dayArtists = friendIds
              .map(id => ARTISTS.find(a => a.id === id))
              .filter(a => a && a.day === day)
              .sort((a, b) => toNightMin(a.start) - toNightMin(b.start));
            if (!dayArtists.length) return null;
            const meta = FESTIVAL_CONFIG.dayDates[day];
            return (
              <div key={day} style={{ marginBottom: 8 }}>
                <h3 className="duo-sect" style={{ margin: "10px 0 2px" }}>{meta.name}</h3>
                {dayArtists.map(a => {
                  const stage = STAGES.find(s => s.id === a.stage);
                  const isOverlap = savedSet.has(a.id);
                  // The board row: time, face (ringed when it is also on your
                  // plan), name over stage. A match is said in words too.
                  return (
                    <button key={a.id} onClick={() => setState({ ...state, artist: a.id })}
                      className={"duo-lrow duo-press" + (isOverlap ? " plan" : "")}
                      style={{ display: "flex", width: "auto", color: "var(--ink)", textAlign: "left" }}>
                      <span className="duo-data duo-ink2" style={{ width: 72, flexShrink: 0, fontSize: 13 }}>{fmt12(a.start)}</span>
                      <DuoAvatar name={a.name} size={42} ring={isOverlap ? "on" : ""} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="duo-headline duo-name" style={{ display: "block", fontWeight: 700 }}>{actDisplayName(a.name)}</span>
                        <span className="duo-body-s duo-ink2" style={{ display: "block", fontWeight: 400 }}>
                          {stage?.name}{isOverlap ? " · on your plan too" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { HomeScreen, FriendLineupBanner });
// ── Night Print: Today as a ticket / poster (round 5, Oct 7 steering) ──
// Cream and ink are the body; ONE festival accent (the config's `print`
// ledger, a verified first-party source per festival) paints the poster
// identity, the chosen action and the Step 3 playlist ticket. Each piece is
// real data or absent: the stamp carries the real countdown, the claim block
// the real act count, the rows the real saved sets. Type is the interface.
const NP_CREAM = "#EEE9D9", NP_BLACK = "#1A171A";
function _npLum(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function _npContrast(a, b) { const x = _npLum(a), y = _npLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// The festival's print accent, with the print constant that reads on it.
// null = no verified accent (or one neither constant can read at 3:1): the
// poster keeps the neutral ink/paper treatment and says nothing it cannot.
// `small` says whether 10-12px metadata may sit directly on the accent
// (4.5:1); otherwise that metadata goes on an ink chip.
function npAccent(cfg) {
  const p = (cfg || FESTIVAL_CONFIG).print;
  if (!p || !/^#[0-9a-f]{6}$/i.test(p.accent || "")) return null;
  const onBlack = _npContrast(p.accent, NP_BLACK), onCream = _npContrast(p.accent, NP_CREAM);
  const ratio = Math.max(onBlack, onCream);
  if (ratio < 3) return null;
  const fg = onBlack >= onCream ? NP_BLACK : NP_CREAM;
  const acc2 = /^#[0-9a-f]{6}$/i.test(p.accent2 || "") ? p.accent2 : null;
  return { acc: p.accent, fg, other: fg === NP_BLACK ? NP_CREAM : NP_BLACK, ratio, small: ratio >= 4.5, acc2 };
}
// The scheme's second colour as the ink bands' small type (the fold's line,
// the utility eyebrow): on the ink band in Light, on the cream band in Dark,
// and only where it reads at 4.5:1; otherwise the band's own paper.
function npSchemeVars(cfg) {
  const sk = npAccent(cfg);
  const a2 = sk && sk.acc2;
  return {
    "--np-acc2-on-black": a2 && _npContrast(a2, NP_BLACK) >= 4.5 ? a2 : NP_CREAM,
    "--np-acc2-on-cream": a2 && _npContrast(a2, NP_CREAM) >= 4.5 ? a2 : NP_BLACK,
  };
}
// The festival's name as poster words: the edition year drops (the meta line
// carries it), and a word that is a Roman numeral (III Points) is set in the
// serif, as the festival sets it. Never forced on another name.
function npWords(name) {
  return duoFestivalTitle(name).split(/\s+/).filter(Boolean)
    .map(w => ({ w, roman: /^[IVX]{2,}$/.test(w) }));
}
// Small print on the accent: directly when the pair passes 4.5:1, else on an
// ink chip so the metadata is never the one thing that fails.
function npMeta(sk, extra) {
  if (!sk) return { className: "np-mono", style: extra };
  return sk.small
    ? { className: "np-mono", style: { color: sk.fg, ...extra } }
    : { className: "np-mono", style: { background: sk.fg, color: sk.other, padding: "3px 6px", ...extra } };
}
function NpTool({ label, pressed, on, onClick, children }) {
  return (
    <button type="button" className="np-tool" onClick={onClick} aria-label={label} aria-pressed={pressed}
      style={on ? { textDecoration: "underline", textUnderlineOffset: 6 } : undefined}>{children}</button>
  );
}
// The print head: wordmark left, the page's three tools right (search,
// offline, alerts), each a 44px target.
function NpHead({ online, offline, onToggleOffline, unread, onAlerts, onSearch }) {
  return (
    <div className="np-head" data-np-head>
      <span className="np-mono-m" style={{ fontWeight: 600 }}>PLURSKY®{!online ? <b style={{ fontWeight: 400, marginLeft: 8 }}>· NO SIGNAL</b> : null}</span>
      <span className="np-tools">
        {onSearch && (
          <NpTool label="Search artists, stages, genres" onClick={onSearch}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M15.3 15.3 20 20"/></svg>
          </NpTool>
        )}
        <NpTool label="Offline mode" pressed={offline} on={offline} onClick={onToggleOffline}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {offline
              ? <><path d="M4 4 L20 20"/><path d="M8.5 16 Q12 13 15.5 16"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/></>
              : <><path d="M2 8.5 Q12 -1 22 8.5"/><path d="M5 12 Q12 5.5 19 12"/><path d="M8.5 15.5 Q12 12.5 15.5 15.5"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/></>}
          </svg>
        </NpTool>
        <NpTool label={unread ? `Alerts, ${unread} new` : "Alerts"} onClick={onAlerts}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9 C6 5.5 8.5 3 12 3 C15.5 3 18 5.5 18 9 L18 13 L20 16 L4 16 L6 13 Z"/><path d="M10 19 Q12 21 14 19"/></svg>
          {unread > 0 && <span aria-hidden="true" style={{ position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, background: "currentColor" }} />}
        </NpTool>
      </span>
    </div>
  );
}
// The festival's name is the switcher, as on the board: one block-width
// button (so the word fit has a real box), the switcher sheet behind it.
function NpTitle({ word, className, children }) {
  const [open, setOpen] = React.useState(false);
  const canSwitch = FESTIVALS_REGISTRY.filter(f => f.available).length > 1;
  return (
    <>
      <button type="button" className={className} data-switch={canSwitch ? "on" : undefined}
        onClick={canSwitch ? () => setOpen(true) : undefined} disabled={!canSwitch}
        aria-label={canSwitch ? `${duoFestivalTitle(FESTIVAL_CONFIG.name)}, switch festival` : undefined}>
        {children}
      </button>
      {open && <FestivalSwitcher onClose={() => setOpen(false)} />}
    </>
  );
}
// Before the festival: the full poster. Identity (real name, location,
// dates), the countdown stamp, a barcode as print decoration, then the fold.
// The rail down the right edge prints the venue when it fits its box (at 10px, then
// 9px); when it does not (a one-line name leaves a short box) there is no rail and the
// venue prints under the dates. Never an ellipsis: a ticket does not trim its own venue.
// The box follows the fitted title, so the pick re-runs on resize.
function useRailFit(ref, venue, city) {
  const [fit, setFit] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const run = () => {
      const tries = [[venue, 10], [venue, 9]].filter(t => t[0]);
      let pick = null;
      for (const [text, size] of tries) {
        el.textContent = text; el.style.fontSize = size + "px";
        if (el.scrollHeight <= el.clientHeight + 1) { pick = { text, size }; break; }
      }
      if (!pick) { el.textContent = ""; }
      setFit(prev => { const next = pick || { text: "", size: 0 }; return prev && prev.text === next.text && prev.size === next.size ? prev : next; });
    };
    run();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(run) : null;
    if (ro) ro.observe(el.parentElement);
    return () => { if (ro) ro.disconnect(); };
  }, [venue, city]);
  return fit;
}
// A date range never breaks inside itself: a word joiner on both sides of its dash.
function npNoBreak(s) { return String(s || "").replace(/(\d)\s*([\u2013\u2014-])\s*(\d)/g, (m, a, d, b) => a + "\u2060" + d + "\u2060" + b).replace(/([A-Za-z]{3,})\s(\d)/g, "$1\u00a0$2"); }
// The barcode is seeded from the edition id, so each ticket prints its own bars.
function npBarcode(id) {
  let x = 0, hsh = 2166136261;
  for (const ch of String(id || "plursky")) { hsh ^= ch.charCodeAt(0); hsh = Math.imul(hsh, 16777619) >>> 0; }
  const stops = [];
  while (x < 88) {
    hsh = Math.imul(hsh ^ (hsh >>> 15), 2246822507) >>> 0;
    const w = 1 + (hsh & 3), g = 1 + ((hsh >>> 2) & 3);
    stops.push(`currentColor ${x}px ${x + w}px, transparent ${x + w}px ${x + w + g}px`); x += w + g;
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
function NpPoster({ countdown, stampText, fold, foldRight }) {
  const sk = npAccent();
  const words = npWords(FESTIVAL_CONFIG.name);
  const tone = sk ? { background: sk.acc, color: sk.fg } : {};
  const meta = npMeta(sk);
  const railRef = React.useRef(null);
  const city = (String(FESTIVAL_CONFIG.location || "").split(" · ").pop() || "").trim() || null;
  const rail = useRailFit(railRef, FESTIVAL_CONFIG.locationShort || null, city);
  const place = rail && !rail.text ? (FESTIVAL_CONFIG.locationShort || city) : null;
  return (
    <section className="np-poster" data-np-poster data-np-accent={sk ? sk.acc : "none"} style={tone}>
      <div className="np-meta">
        <span {...meta}>EDITION {FESTIVAL_CONFIG.year || ""}</span>
        <span {...npMeta(sk, { whiteSpace: "nowrap" })}>{countdown ? "PRE\u2011FESTIVAL" : "FESTIVAL"}</span>
      </div>
      <div className="np-titlebox">
        {(FESTIVAL_CONFIG.locationShort || city) && <div ref={railRef} className="np-rot np-mono" aria-hidden="true" data-np-rail={rail ? (rail.text ? "on" : "off") : "measuring"} style={rail && !rail.text ? { visibility: "hidden" } : undefined} />}
        <NpTitle className="np-title">
          <h1 className="np-word" data-fit-words data-fit-min="32">
            {words.map((x, i) => <React.Fragment key={i}>{i ? " " : ""}<span className={x.roman ? "np-roman" : undefined}>{x.w}</span></React.Fragment>)}
          </h1>
        </NpTitle>
      </div>
      <div className="np-foot">
        <div>
          <div {...npMeta(sk, { display: "inline-block" })}>{npNoBreak(FESTIVAL_CONFIG.dates)}</div>
          {place && <div className="np-mono" style={{ marginTop: 6, ...(sk && !sk.small ? { color: sk.fg } : {}) }}>{place}</div>}
          <div className="np-barcode" aria-hidden="true" style={{ background: npBarcode(FESTIVAL_CONFIG.id) }} />
        </div>
        <div className="np-stamp" data-np-stamp aria-label={stampText.replace(/\s+/g, " ")}>{stampText}</div>
      </div>
      <div className="np-cut" data-np-cut><b>{fold}</b><span>{foldRight}</span></div>
    </section>
  );
}
// On the night and after: the poster compresses into an edition strip, so
// the live plan and the stage board lead. Same accent, same fold.
function NpStrip({ status, fold, foldRight, sunrise }) {
  const sk = npAccent();
  const tone = sk ? { background: sk.acc, color: sk.fg } : {};
  const meta = npMeta(sk);
  return (
    <section className="np-poster" data-np-strip data-np-accent={sk ? sk.acc : "none"} style={{ ...tone, paddingTop: 16 }}>
      <div className="np-meta">
        <span {...meta}>EDITION {FESTIVAL_CONFIG.year || ""}</span>
        <span {...npMeta(sk, { whiteSpace: "nowrap", textAlign: "right" })}>{status}</span>
      </div>
      <NpTitle className="np-title" >
        <h1 className="np-strip-word" data-fit-words data-fit-min="20" style={{ margin: "14px 0 16px" }}>{duoFestivalTitle(FESTIVAL_CONFIG.name)}</h1>
      </NpTitle>
      <div className="np-cut" data-np-cut>
        <b>{fold}</b>
        {sunrise
          ? <span className="duo-sun" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "inherit" }}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4"/></svg>
              SUNRISE {sunrise}
            </span>
          : <span>{foldRight}</span>}
      </div>
    </section>
  );
}
// Nothing saved yet: the claim and the one action. The count is the real
// bill; the line under it is honest about set times when they are pending.
function NpClaim({ eyebrow, title, body, action, onAction }) {
  return (
    <section className="np-block" data-np-claim>
      <div className="np-mono" style={{ marginBottom: 17 }}>{eyebrow}</div>
      <h2 className="np-claim" data-fit-words data-fit-min="34">{title}</h2>
      <p className="np-body">{body}</p>
      <button type="button" className="np-act" onClick={onAction}>{action}<span aria-hidden="true">↗</span></button>
    </section>
  );
}
// Saved sets before the festival: the real rows, by day and time, the first
// five and a path to all of them. Full name, day, stage, time; a tap opens
// the act. Shares through the existing lineup share.
function NpSaved({ rows, state, setState, onAll }) {
  const days = new Set(rows.map(a => a.day).filter(d => d != null));
  const n = rows.length;
  // All of them up to six; from seven, four and the link. One row behind a link is worse than the row.
  const SHOW = n <= 6 ? n : 4;
  return (
    <section className="np-block" data-np-saved data-today-saved>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 44, marginBottom: 6 }}>
        <span className="np-mono">YOUR NIGHT SO FAR</span>
        <ShareLineupButton state={state} />
      </div>
      <h2 className="np-claim" data-fit-words data-fit-min="34">
        <span style={{ display: "block" }}>{n} SET{n === 1 ? "" : "S"}.</span>
        {days.size > 0 && <span style={{ display: "block" }}>{days.size} NIGHT{days.size === 1 ? "" : "S"}.</span>}
      </h2>
      <div style={{ marginTop: 20 }}>
        {rows.slice(0, SHOW).map(a => {
          const dd = FESTIVAL_CONFIG.dayDates?.[a.day];
          const day = dd?.name || (a.day != null ? `Day ${a.day}` : "Day TBA");
          const stage = (STAGES.find(s => s.id === a.stage) || {}).name;
          return (
            <button type="button" key={a.id} className="np-srow" onClick={() => setState({ ...state, artist: a.id })}
              aria-label={`${a.name}, ${day}, ${a.start ? fmt12(a.start) : "time to be announced"}${stage ? `, ${stage}` : ""}`}>
              <span className="np-mono-m" style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{a.start ? fmt12(a.start) : "TBA"}</span>
              <span style={{ minWidth: 0 }}>
                <span className="np-sname duo-name">{actDisplayName(a.name)}</span>
                <span className="np-ssub np-mono">{[day, stage].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="np-act" onClick={onAll}>{n > SHOW ? `ALL ${n} SAVED SETS` : "YOUR SAVED SETS"}<span aria-hidden="true">↗</span></button>
    </section>
  );
}
// The four-step journey. Step 3's accent ticket is the emphasis; its plate
// tilts, its hit area does not.
function NpJourney({ steps }) {
  const sk = npAccent();
  const row = (s, i) => (
    <>
      <span className="np-idx" aria-hidden="true">0{i + 1}</span>
      <span style={{ minWidth: 0 }}>
        <h3 className="np-jt duo-name">{s.title.map((t, k) => <span key={k} style={{ display: "block" }}>{t}</span>)}</h3>
        <p>{s.sub}</p>
      </span>
      <span className="np-arrow" aria-hidden="true">↗</span>
    </>
  );
  return (
    <section className="np-journey" data-np-journey aria-label="Your night, in four steps">
      {steps.map((s, i) => i === 2 ? (
        <button type="button" key={s.id} className="np-j3" data-np-step={s.id} onClick={s.onClick} aria-label={s.aria}
          style={sk ? { color: sk.fg } : undefined}>
          <span className="np-j3-plate" aria-hidden="true" style={{ background: sk ? sk.acc : "var(--np-ink)", ...(sk ? {} : {}) }} />
          <span className="np-j" style={{ padding: "24px 8px", ...(sk ? {} : { color: "var(--np-paper)" }) }}>{row(s, i)}</span>
        </button>
      ) : (
        <button type="button" key={s.id} className="np-j" data-np-step={s.id} onClick={s.onClick} aria-label={s.aria}>{row(s, i)}</button>
      ))}
    </section>
  );
}
// The utility strip: every essential as a type link, inverted. Nothing from
// the essentials row is dropped; each is a 44px target with its full label.
function NpUtility({ eyebrow, links }) {
  return (
    <section className="np-util" data-np-util aria-label={eyebrow}>
      <span className="np-mono">{eyebrow}</span>
      <div className="np-links" data-today-essentials>
        {links.map(l => (
          <button type="button" key={l.id} className="np-link" data-np-link={l.id} onClick={l.onClick} aria-label={l.sub ? `${l.label}, ${l.sub}` : l.label}>
            <span>{l.label}{l.sub && <b>{l.sub}</b>}</span><span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
    </section>
  );
}

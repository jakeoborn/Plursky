// ═══════════════════════════════════════════════════════════════════════
// TIME WARP GERMANY 2027 — Maimarkthalle · Mannheim, Germany
// Sat Apr 3, 2027, 21:00 to Sun Apr 4, 14:00. One night, one day.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true): lineup-only
// festivals switched on 2026-11-16, 38 acts match the official page, set
// times pending. The official page prints the
// lineup "in alphabetical order" with no days, floors or set times, so every
// act is day 1 with no stage and no time. Nothing below is invented.
//
// SOURCE lineup + date + venue + hours + age: the official 2027 event page
// www.time-warp.de/germany/mannheim/, read 2026-11-16 in Chrome — "03. April
// 2027 · Maimarkthalle | Mannheim", "LINEUP in alphabetical order" (38
// billings, below), "Saturday 03 April 2027 21:00 - 14:00", "18+",
// address Xaver-Fuhr-Straße 101, 68163 Mannheim. The page also says "The
// only German edition in 2027".
// BILLINGS: each printed line is ONE act, co-billings kept whole ("BEN KLOCK
// B2B RØDHÅD"). "(HYBRID DJ SET)" stays with WhoMadeWho, as printed.
// NAME CASING: the page prints every name in capitals. A name is written the
// way the artist registry already spells it from an earlier festival (21),
// else as printed (17). Rows whose casing differs from the page note the
// printed form.
// HOURS: 21:00 Saturday to 14:00 Sunday local. startMs/endMs bound Apr 3
// 00:00 to Apr 4 14:00 local (the published close), not doors-to-close.
// No cfg.hours: published hours ship only through a lane ruling
// (scripts/test-festival-maps-hours.mjs), and there is none for this page.
// Germany is on CEST (UTC+2) from Mar 28, 2027.
// GPS: the Maimarkt fairground that holds Maimarkthalle, from
// de.wikipedia.org/wiki/Maimarkt, read 2026-11-16 — 49.46889°N 8.52278°E.
// It is the grounds' point, not a surveyed hall entrance, so the on-site
// radius covers the grounds.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC+2) at the gps
// point: Apr 3 sunset 19:59, Apr 4 sunrise 06:58.
// ART: no cleared official art yet (scripts/test-festival-art.mjs), so the
// festival shows its letter tile.
(function () {
  "use strict";

  const STAGES = [];
  const AMENITIES = [];
  const SCHEDULE = {};
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day,
      bio: "Playing Time Warp Germany 2027." };
  };
  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #3b82f6, #0b1020)",
    bio: "Playing Time Warp Germany in Mannheim on April 3, 2027. " +
         "Floor and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("tw27-2high-aka-adrian-mills", "2HIGH AKA ADRIÁN MILLS"),
    mk("tw27-adiel-b2b-quest", "Adiel B2B Quest"),  // printed "ADIEL B2B QUEST"
    mk("tw27-ahmed-spins", "Ahmed Spins"),  // printed "AHMED SPINS"
    mk("tw27-alarico-b2b-chlar-b2b-yanamaste", "ALARICO B2B CHLÄR B2B YANAMASTE"),
    mk("tw27-beltran-b2b-ben-sterling", "Beltran B2B Ben Sterling"),  // printed "BELTRAN B2B BEN STERLING"
    mk("tw27-ben-klock-b2b-rodhad", "BEN KLOCK B2B RØDHÅD"),
    mk("tw27-ben-ufo-b2b-enzo-siragusa", "BEN UFO B2B ENZO SIRAGUSA"),
    mk("tw27-biia", "BIIA"),
    mk("tw27-carlita-b2b-rossi", "CARLITA B2B ROSSI."),
    mk("tw27-charlotte-de-witte", "Charlotte de Witte"),  // printed "CHARLOTTE DE WITTE"
    mk("tw27-cinthie", "CINTHIE"),
    mk("tw27-cirillo", "CIRILLO"),
    mk("tw27-cloudy-b2b-ki-ki", "CLOUDY B2B KI/KI"),
    mk("tw27-dennis-cruz", "Dennis Cruz"),  // printed "DENNIS CRUZ"
    mk("tw27-enrico-sangiuliano", "Enrico Sangiuliano"),  // printed "ENRICO SANGIULIANO"
    mk("tw27-fumi-b2b-uberkikz", "FUMI B2B ÜBERKIKZ"),
    mk("tw27-funk-tribu", "Funk Tribu"),  // printed "FUNK TRIBU"
    mk("tw27-i-hate-models", "I Hate Models"),  // printed "I HATE MODELS"
    mk("tw27-indira-paganotto", "Indira Paganotto"),  // printed "INDIRA PAGANOTTO"
    mk("tw27-jane-fitz", "JANE FITZ"),
    mk("tw27-joseph-capriati", "Joseph Capriati"),  // printed "JOSEPH CAPRIATI"
    mk("tw27-josh-baker", "Josh Baker"),  // printed "JOSH BAKER"
    mk("tw27-kalte-liebe", "KALTE LIEBE"),
    mk("tw27-kevin-de-vries-b2b-maceo-plex", "KEVIN DE VRIES B2B MACEO PLEX"),
    mk("tw27-loco-dice", "Loco Dice"),  // printed "LOCO DICE"
    mk("tw27-mau-p", "Mau P"),  // printed "MAU P"
    mk("tw27-mischluft-b2b-serafina", "MISCHLUFT B2B SERAFINA"),
    mk("tw27-nina-kraviz", "Nina Kraviz"),  // printed "NINA KRAVIZ"
    mk("tw27-novah", "Novah"),  // printed "NOVAH"
    mk("tw27-pan-pot", "Pan-Pot"),  // printed "PAN-POT"
    mk("tw27-rhadoo", "RHADOO"),
    mk("tw27-richie-hawtin", "Richie Hawtin"),  // printed "RICHIE HAWTIN"
    mk("tw27-sama-abdulhadi", "SAMA' ABDULHADI"),
    mk("tw27-seebase", "SEEBASE"),
    mk("tw27-seth-troxler", "Seth Troxler"),  // printed "SETH TROXLER"
    mk("tw27-sven-vath", "Sven Väth"),  // printed "SVEN VÄTH"
    mk("tw27-ueberrest", "UEBERREST"),
    mk("tw27-whomadewho-hybrid-dj-set", "WhoMadeWho (Hybrid DJ Set)"),  // printed "WHOMADEWHO (HYBRID DJ SET)"
  ];

  const CEST = 2;
  const CONFIG = {
    id: "time-warp-2027",
    lineupSource: { url: "https://www.time-warp.de/germany/mannheim/", observedAt: "2026-11-16", official: true },
    name: "Time Warp Germany 2027",
    shortName: "Time Warp",
    brand: "Time Warp",
    tagline: "One night of techno in Mannheim",
    location: "Maimarkthalle · Mannheim, Germany",
    locationShort: "Maimarkthalle",
    dates: "Apr 3, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://www.time-warp.de/", observedAt: "2026-11-12" }, note: "Not measured yet; the theme-color meta is #0048FF, so confirm against the site's own CSS before setting it." },
    officialEvent: {
      website: "https://www.time-warp.de/germany/mannheim/",
      observedAt: "2026-11-16",
    },
    startMs: Date.UTC(2027, 3, 3, -CEST, 0, 0),   // Apr 3 00:00 local
    endMs: Date.UTC(2027, 3, 4, 14 - CEST, 0, 0), // Apr 4 14:00 local, the published close
    tz: "Europe/Berlin",
    tzAbbr: "CEST",
    utcOffsetHours: CEST,
    dayDates: {
      1: { y: 2027, m: 3, d: 3, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2027, 3, 3, -CEST, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point; rise is the Apr 4 sunrise.
    sunTimes: { 1: { rise: "06:58", set: "19:59" } },
    gps: { lat: 49.46889, lng: 8.52278, onSiteRadiusMi: 0.5 },
    venue: {
      name: "Maimarkthalle",
      address: "Xaver-Fuhr-Straße 101, 68163 Mannheim, Germany",
      terrain: "multifloor event hall",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["time-warp-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#3b82f6", emoji: "⏱️", region: "Europe" },
  };
})();

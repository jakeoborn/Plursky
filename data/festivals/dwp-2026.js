// ═══════════════════════════════════════════════════════════════════════
// DJAKARTA WAREHOUSE PROJECT 2026 — JIExpo Kemayoran · Jakarta, Indonesia
// Dec 11–13, 2026. Ismaya.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11: switch on the festivals with a full lineup). Set times still TBA. No day split, stages, set
// times, hours or site map are published, so every act sits unplaced in one
// TBA bucket.
//
// SOURCE lineup: dwpfest.com/lineup, read 2026-11-11 — "In alphabetical
// order", 25 acts, each kept exactly as printed ("Adnan Veron x HBRP",
// "Axwell B2B Sebastian Ingrosso", "W.w").
// SOURCE dates: dwpfest.com, read 2026-11-11 — "11 • 12 • 13 DEC 2026
// JAKARTA, INDONESIA".
// SOURCE venue: the official pages name only Jakarta. JIExpo Kemayoran is
// from premiertickets.co's event page, read 2026-11-11 ("at Jakarta
// International Expo (JIExpo) Kemayoran"), and fits the official site's
// travel packages, all at Kemayoran hotels including the Holiday Inn Express
// "Jakarta International Expo". Confirm on an official page before the flip.
// SOURCE gps + address: en.wikipedia.org/wiki/Jakarta_International_Expo,
// read 2026-11-11 — 6.146701°S 106.845681°E; Jalan Benyamin Sueb,
// Pademangan, North Jakarta (the house number was not readable).
// NO HOURS: none published for 2026 (the FAQ still describes the 2025 Bali
// edition). startMs/endMs bound the three calendar days in Jakarta time, not
// doors-to-close. NO AGE POLICY loaded for the same reason.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC+7).
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
      bio: "Playing DWP 2026." };
  };
  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #22d3ee, #0a0f1f)",
    bio: "Playing Djakarta Warehouse Project 2026. Day, stage and set time " +
         "are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("dwp-adnan-veron-x-hbrp", "Adnan Veron x HBRP"),
    mk("dwp-afrojack", "Afrojack"),
    mk("dwp-agents-of-time", "Agents of Time"),
    mk("dwp-alok", "Alok"),
    mk("dwp-angger-dimas", "Angger Dimas"),
    mk("dwp-artbat", "ARTBAT"),
    mk("dwp-axwell-b2b-sebastian-ingrosso", "Axwell B2B Sebastian Ingrosso"),
    mk("dwp-billy-gillies", "Billy Gillies"),
    mk("dwp-cosmic-gate", "Cosmic Gate"),
    mk("dwp-dimension", "Dimension"),
    mk("dwp-dimitri-vegas", "Dimitri Vegas"),
    mk("dwp-eli-and-fur", "Eli & Fur"),
    mk("dwp-ely-oaks", "Ely Oaks"),
    mk("dwp-gil-glaze", "Gil Glaze"),
    mk("dwp-halo", "HALO"),
    mk("dwp-ian-asher", "Ian Asher"),
    mk("dwp-josiah", "Josiah"),
    mk("dwp-lilly-palmer", "Lilly Palmer"),
    mk("dwp-maddix", "Maddix"),
    mk("dwp-marlo", "Marlo"),
    mk("dwp-r3hab", "R3hab"),
    mk("dwp-syber", "Syber"),
    mk("dwp-tye-turner", "Tye Turner"),
    mk("dwp-w-w", "W.w"),
    mk("dwp-whisnu-santika", "Whisnu Santika"),
  ];

  const CONFIG = {
    id: "dwp-2026",
    lineupSource: { url: "https://dwpfest.com/lineup", observedAt: "2026-11-11", official: true },
    name: "Djakarta Warehouse Project 2026",
    shortName: "DWP",
    brand: "Djakarta Warehouse Project",
    tagline: "Three nights of dance music in Jakarta",
    location: "JIExpo Kemayoran · Jakarta, Indonesia",
    locationShort: "JIExpo Kemayoran",
    dates: "Dec 11–13, 2026",
    year: 2026,
    print: { accent: null, source: { url: "https://dwpfest.com/", observedAt: "2026-11-11" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://dwpfest.com/",
      observedAt: "2026-11-11",
    },
    // Calendar-day bounds in WIB (UTC+7), not published hours (see header).
    startMs: Date.UTC(2026, 11, 10, 17, 0, 0),  // Dec 11 00:00 WIB
    endMs: Date.UTC(2026, 11, 13, 17, 0, 0),    // Dec 14 00:00 WIB
    tz: "Asia/Jakarta",
    tzAbbr: "WIB",
    utcOffsetHours: 7,
    dayDates: {
      1: { y: 2026, m: 11, d: 11, name: "Dec 11–13", short: "TBA",
           midnightUtc: Date.UTC(2026, 11, 10, 17, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point for Dec 11; Dec 13 is 05:33 / 18:01.
    sunTimes: { 1: { rise: "05:32", set: "18:00" } },
    gps: { lat: -6.146701, lng: 106.845681, onSiteRadiusMi: 0.4 },
    venue: {
      name: "Jakarta International Expo (JIExpo) Kemayoran",
      address: "Jalan Benyamin Sueb, Pademangan, North Jakarta, Indonesia",
      terrain: "expo grounds on the former Kemayoran Airport site — halls and open lots",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["dwp-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#22d3ee", emoji: "🌃", region: "Asia" },
  };
})();

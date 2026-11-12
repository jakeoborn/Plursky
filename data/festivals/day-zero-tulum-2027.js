// ═══════════════════════════════════════════════════════════════════════
// DAY ZERO TULUM 2027 — jungle site near Tulum, Quintana Roo, Mexico
// Sat Jan 9, 2027, sunset to sunrise. Crosstown Rebels / Damian Lazarus.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11:
// switch on the festivals with a full lineup). One night, so one day; no
// stages or set times are published.
//
// SOURCE lineup + date: dayzerofestival.com/tulum/, read 2026-11-12 —
// "TULUM, MEXICO · 9 JAN 2027". 30 acts; the closing "& VERY SPECIAL GUEST"
// is not an act and is not loaded. RPR Soundsystem is one act, kept with its
// printed members.
// NAME CASING: the page prints every name in capitals and has no bios. A
// name is written the way the artist registry already spells it from an
// earlier festival (12), else as printed (18). "(LIVE)" follows the name: it
// stays capitals on a printed name and reads "(Live)" on a registry-cased one,
// the registry's most common form. Rows whose casing differs from the page
// note the printed form.
// SOURCE hours: the same page — "from sunset to sunrise" in "the jungles of
// Tulum". No clock times. startMs/endMs bound Jan 9 00:00 to Jan 10 08:00
// local, just past the computed Jan 10 sunrise (07:27); not doors-to-close.
// NO VENUE: the official page names only Tulum. gps is the town of Tulum,
// en.wikipedia.org/wiki/Tulum,_Quintana_Roo, read 2026-11-12 — 20.21194°N
// 87.46583°W, with a wide on-site radius because the site is not announced.
// Re-check before treating the map point as the venue.
// NO AGE POLICY loaded: none read from an official page.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC-5; Quintana Roo
// keeps UTC-5 all year) at the gps point.
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
      bio: "Playing Day Zero Tulum 2027." };
  };
  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #d4a373, #1b2a1f)",
    bio: "Playing Day Zero Tulum on January 9, 2027, sunset to sunrise. " +
         "Stage and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("dzt-and-me", "&ME"),
    mk("dzt-antaares", "ANTAARES"),
    mk("dzt-badwolf", "BADWOLF"),
    mk("dzt-brunello", "Brunello"),  // printed "BRUNELLO"
    mk("dzt-chloe-caillet", "Chloé Caillet"),  // printed "CHLOÉ CAILLET"
    mk("dzt-culoe-de-song", "CULOE DE SONG"),
    mk("dzt-damian-lazarus", "Damian Lazarus"),  // printed "DAMIAN LAZARUS"
    mk("dzt-dan-ghenacia", "DAN GHENACIA"),
    mk("dzt-deer-jade", "Deer Jade"),  // printed "DEER JADE"
    mk("dzt-hardt-antoine", "HARDT ANTOINE"),
    mk("dzt-jane-fitz", "JANE FITZ"),
    mk("dzt-jawar", "JAWAR"),
    mk("dzt-jhony-chief-live", "JHONY CHIEF (LIVE)"),
    mk("dzt-katana", "KATANA"),
    mk("dzt-kinahau", "KinAhau"),  // printed "KINAHAU"
    mk("dzt-lp-giobbi", "LP Giobbi"),  // printed "LP GIOBBI"
    mk("dzt-lum", "LUM"),
    mk("dzt-mary-jane", "MARY JANE"),
    mk("dzt-mira", "MIRA"),
    mk("dzt-mita-gami", "Mita Gami"),  // printed "MITA GAMI"
    mk("dzt-rafael", "Rafael"),  // printed "RAFAEL"
    mk("dzt-robag-wruhme", "ROBAG WRUHME"),
    mk("dzt-rpr-soundsystem-raresh-rhadoo-petre-inspirescu", "RPR SOUNDSYSTEM (RARESH, RHADOO, PETRE INSPIRESCU)"),
    mk("dzt-satori-live", "Satori (Live)"),  // printed "SATORI (LIVE)"
    mk("dzt-secret-echoes-live", "SECRET ECHOES (LIVE)"),
    mk("dzt-soul-of-hex", "SOUL OF HEX"),
    mk("dzt-tiga", "Tiga"),  // printed "TIGA"
    mk("dzt-victor-calderone", "Victor Calderone"),  // printed "VICTOR CALDERONE"
    mk("dzt-vintage-culture", "Vintage Culture"),  // printed "VINTAGE CULTURE"
    mk("dzt-wadley-live", "WADLEY (LIVE)"),
  ];

  const CONFIG = {
    id: "day-zero-tulum-2027",
    lineupSource: { url: "https://dayzerofestival.com/tulum/", observedAt: "2026-11-12", official: true },
    name: "Day Zero Tulum 2027",
    shortName: "Day Zero",
    brand: "Day Zero",
    tagline: "Sunset to sunrise in the jungles of Tulum",
    location: "Tulum, Mexico",
    locationShort: "Tulum",
    dates: "Jan 9, 2027",
    year: 2027,
    print: { accent: null, source: { url: "https://dayzerofestival.com/tulum/", observedAt: "2026-11-12" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://dayzerofestival.com/tulum/",
      observedAt: "2026-11-12",
    },
    // Quintana Roo is UTC-5 all year (no DST).
    startMs: Date.UTC(2027, 0, 9, 5, 0, 0),    // Jan 9 00:00 local
    endMs: Date.UTC(2027, 0, 10, 13, 0, 0),    // Jan 10 08:00 local, after sunrise
    tz: "America/Cancun",
    tzAbbr: "EST",
    utcOffsetHours: -5,
    dayDates: {
      1: { y: 2027, m: 0, d: 9, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2027, 0, 9, 5, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point; Jan 10 sunrise is 07:27.
    sunTimes: { 1: { rise: "07:27", set: "18:25" } },
    gps: { lat: 20.21194, lng: -87.46583, onSiteRadiusMi: 6 },
    venue: {
      name: "Jungle site near Tulum (not announced)",
      address: "Tulum, Quintana Roo, Mexico",
      terrain: "jungle clearing, outdoors overnight",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["day-zero-tulum-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#d4a373", emoji: "🌿", region: "Latin America" },
  };
})();

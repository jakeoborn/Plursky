// ═══════════════════════════════════════════════════════════════════════
// DECADENCE ARIZONA 2026 — Phoenix Raceway · Avondale, AZ
// Dec 30–31, 2026. Relentless Beats.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11: switch on the festivals with a full lineup). Set times still TBA. The lineup AND its day
// split are official; stages, set times and the site map are not published.
// The FAQ says "Time slots will be released the week of the event."
//
// SOURCE lineup + day split: decadencearizona.com/lineup, read 2026-11-11 —
// "Dec 30–31 · 2026 · Phoenix Raceway". Day 1 lists 16 billed acts plus 3
// support acts, Day 2 lists 18 plus 2 support: 39 rows, each kept exactly as
// printed ("Wankdat (Crankdat + Wooli)", "Disclosure (DJ Set)", "Bunt.").
// Support acts are on the official lineup, so they are rows here too.
//
// SOURCE hours, age, re-entry: decadencearizona.com/faq, read 2026-11-11 —
// "Doors open at 6:00PM each day ... The event ends at 3:00 AM on each
// night", "Decadence Arizona is strictly 18+", "Re-entry is not permitted in
// the same day". The page names no separate drinking age, so none is set.
//
// SOURCE gps + address: en.wikipedia.org/wiki/Phoenix_Raceway, read
// 2026-11-10 — 33.374750, -112.311150; 7602 Jimmie Johnson Drive, Avondale,
// AZ 85323. NOT MEASURED: venue footprint (OSM lookups are refused by this
// build environment's proxy), so the map is real tiles around the point.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC-7; Arizona keeps
// no DST). Re-check against a lookup before the flip.
//
// Night Print accent not set: the site's theme-color is #0c0420, a near-black
// background, not a chromatic brand accent. Read the site CSS at the flip.
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
      bio: "Playing Decadence Arizona 2026." };
  };
  const mk = (id, name, day) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #e879f9, #0c0420)",
    bio: "Playing Decadence Arizona 2026 on " +
         (day === 1 ? "December 30" : "December 31") +
         ". Stage and set time are released the week of the event.",
    provisional: true,
  });

  const ARTISTS = [
    // ── Dec 30 (day 1) ── 16 billed + 3 support
    mk("daz-a-hundred-drums-b2b-zen-selekta", "A Hundred Drums B2B Zen Selekta", 1),
    mk("daz-azzecca", "Azzecca", 1),
    mk("daz-chris-lake", "Chris Lake", 1),
    mk("daz-coone", "Coone", 1),
    mk("daz-eli-brown", "Eli Brown", 1),
    mk("daz-gorgon-city", "Gorgon City", 1),
    mk("daz-i-hate-models", "I Hate Models", 1),
    mk("daz-masquerade", "Masquerade", 1),
    mk("daz-max-dean-b2b-luke-dean", "Max Dean B2B Luke Dean", 1),
    mk("daz-polo-and-pan", "Polo & Pan", 1),
    mk("daz-roz", "RØZ", 1),
    mk("daz-ruze", "Ruze", 1),
    mk("daz-slander", "Slander", 1),
    mk("daz-sosa", "SOSA", 1),
    mk("daz-tommy-phillips", "Tommy Phillips", 1),
    mk("daz-wankdat", "Wankdat (Crankdat + Wooli)", 1),
    mk("daz-cece", "CECE", 1),
    mk("daz-donk", "DONK", 1),
    mk("daz-zuze", "ZUZE", 1),

    // ── Dec 31 (day 2) ── 18 billed + 2 support
    mk("daz-beauz", "Beauz", 2),
    mk("daz-beltran", "Beltran", 2),
    mk("daz-brayden-terzo", "Brayden Terzo", 2),
    mk("daz-bunt", "Bunt.", 2),
    mk("daz-daily-bread", "daily bread", 2),
    mk("daz-disclosure-dj-set", "Disclosure (DJ Set)", 2),
    mk("daz-ero808", "Ero808", 2),
    mk("daz-isoxo", "ISOxo", 2),
    mk("daz-jkyl-and-hyde", "Jkyl & Hyde", 2),
    mk("daz-kettama", "KETTAMA", 2),
    mk("daz-levity", "Levity", 2),
    mk("daz-lyny", "LYNY", 2),
    mk("daz-mellizos", "Mellizos", 2),
    mk("daz-patrick-topping", "Patrick Topping", 2),
    mk("daz-roddy-lima", "Roddy Lima", 2),
    mk("daz-starjunk95", "Starjunk95", 2),
    mk("daz-steve-aoki", "Steve Aoki", 2),
    mk("daz-zomboy", "Zomboy", 2),
    mk("daz-felix-mun", "Felix Mün", 2),
    mk("daz-randy-perez", "Randy Perez", 2),
  ];

  const CONFIG = {
    id: "decadence-arizona-2026",
    lineupSource: { url: "https://decadencearizona.com/lineup", observedAt: "2026-11-11", official: true },
    name: "Decadence Arizona 2026",
    shortName: "Decadence AZ",
    brand: "Decadence Arizona",
    tagline: "Two nights in the desert to close out the year",
    location: "Phoenix Raceway · Avondale, AZ",
    locationShort: "Phoenix Raceway",
    dates: "Dec 30–31, 2026",
    year: 2026,
    print: { accent: null, source: { url: "https://decadencearizona.com/", observedAt: "2026-11-11" }, note: "Not measured yet; the theme-color meta is a near-black background, so read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://decadencearizona.com/",
      tickets: "https://tixr.com/e/182815",
      observedAt: "2026-11-11",
    },
    // Arizona is MST (UTC-7) all year. Hours are published (FAQ, see header).
    startMs: Date.UTC(2026, 11, 31, 1, 0, 0),  // Dec 30 18:00 MST, doors
    endMs: Date.UTC(2027, 0, 1, 10, 0, 0),     // Jan 1 03:00 MST, end of night 2
    tz: "America/Phoenix",
    tzAbbr: "MST",
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 11, d: 30, name: "Dec 30", short: "WED",
           midnightUtc: Date.UTC(2026, 11, 30, 7, 0, 0) },
      2: { y: 2026, m: 11, d: 31, name: "Dec 31", short: "NYE",
           midnightUtc: Date.UTC(2026, 11, 31, 7, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point, MST.
    sunTimes: {
      1: { rise: "07:32", set: "17:30" },
      2: { rise: "07:33", set: "17:31" },
    },
    gps: { lat: 33.37475, lng: -112.31115, onSiteRadiusMi: 0.6 },
    venue: {
      name: "Phoenix Raceway",
      address: "7602 Jimmie Johnson Drive, Avondale, AZ 85323",
      terrain: "motor raceway — infield, paved lots and grandstand areas",
    },
    weatherEndpoint: "https://api.weather.gov/points/33.3748,-112.3112",
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
    policies: { minimumAge: 18, reentry: false },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["decadence-arizona-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#e879f9", emoji: "🏜️", region: "North America" },
  };
})();

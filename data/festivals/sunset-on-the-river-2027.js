// ═══════════════════════════════════════════════════════════════════════
// SUNSET ON THE RIVER 2027 — Julian B. Lane Riverfront Park · Tampa, FL
// Feb 20–21, 2027. Sunset Events + Disco Presents. 21+.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11: switch on the festivals with a full lineup). Set times still TBA. First edition under this
// name: the organisers' release calls it the "inaugural edition" of the
// renamed Sunset Music Festival, moved from Memorial Day weekend to February.
// No day split, stages, set times, hours or site map are published, so every
// act sits unplaced in one TBA bucket.
//
// SOURCE lineup, dates, venue, age: the organisers' press release as printed
// by Rock At Night, "NEW Sunset on the River Festival in Tampa features Alesso
// and Disco Lines", published 2026-11-10, read 2026-11-11 — its "COMPLETE 2027
// LINEUP" block lists 16 acts, kept as printed except for case (the block is
// all caps; names follow the release's own body text, e.g. "TOKiMONSTA").
// A press relay, not the festival's own page, so lineupSource.official is
// false. sunsetotr.com is the official site but served no readable text to
// this build environment on 2026-11-11.
//
// SOURCE address: tampa.gov/parks-and-recreation/featured-parks/riverfrontpark,
// read 2026-11-11 — "1001 N Blvd, Tampa, FL 33607", a 25-acre park.
// SOURCE gps: 2markers.com map listing (27°57′12.17″N, 82°28′2.71″W), read
// 2026-11-11 — a third-party map point, not a survey; the park has no
// Wikipedia article. Re-check before the flip.
// NO HOURS: none published. startMs/endMs bound the two calendar days in
// Tampa time, not doors-to-close. Replace with the official hours when out.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC-5).
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
      bio: "Playing Sunset On The River 2027." };
  };
  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #fb923c, #1e0b2e)",
    bio: "Playing Sunset On The River 2027. Day, stage and set time are not " +
         "published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("sotr-acraze", "ACRAZE"),
    mk("sotr-alesso", "Alesso"),
    mk("sotr-alok", "ALOK"),
    mk("sotr-angrybaby", "Angrybaby"),
    mk("sotr-disco-lines", "Disco Lines"),
    mk("sotr-dj-mandy", "DJ Mandy"),
    mk("sotr-john-anthony", "John Anthony"),
    mk("sotr-kyefi", "Kyefi"),
    mk("sotr-leondis", "Leondis"),
    mk("sotr-lost-frequencies", "Lost Frequencies"),
    mk("sotr-omnom", "OMNOM"),
    mk("sotr-pushman", "Pushman"),
    mk("sotr-sueno", "Sueno"),
    mk("sotr-tokimonsta", "TOKiMONSTA"),
    mk("sotr-westend", "Westend"),
    mk("sotr-wes-mills", "Wes Mills"),
  ];

  const CONFIG = {
    id: "sunset-on-the-river-2027",
    lineupSource: { url: "https://www.rockatnight.com/2026/11/new-sunset-on-the-river-festival-in-tampa-features-alesso-and-disco-lines/", observedAt: "2026-11-11", official: false },
    name: "Sunset On The River 2027",
    shortName: "Sunset OTR",
    brand: "Sunset On The River",
    tagline: "A 21+ riverfront weekend in downtown Tampa",
    location: "Julian B. Lane Riverfront Park · Tampa, FL",
    locationShort: "Julian B. Lane Riverfront Park",
    dates: "Feb 20–21, 2027",
    year: 2027,
    print: { accent: null, source: { url: "https://sunsetotr.com/", observedAt: "2026-11-11" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://sunsetotr.com/",
      observedAt: "2026-11-11",
    },
    // Calendar-day bounds in EST, not published hours (see header).
    startMs: Date.UTC(2027, 1, 20, 5, 0, 0),  // Feb 20 00:00 EST
    endMs: Date.UTC(2027, 1, 22, 5, 0, 0),    // Feb 22 00:00 EST
    tz: "America/New_York",
    tzAbbr: "EST",
    utcOffsetHours: -5,
    dayDates: {
      1: { y: 2027, m: 1, d: 20, name: "Feb 20–21", short: "TBA",
           midnightUtc: Date.UTC(2027, 1, 20, 5, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point for Feb 20; Feb 21 is 07:03 / 18:24.
    sunTimes: { 1: { rise: "07:04", set: "18:24" } },
    gps: { lat: 27.953381, lng: -82.467419, onSiteRadiusMi: 0.3 },
    venue: {
      name: "Julian B. Lane Riverfront Park",
      address: "1001 N Blvd, Tampa, FL 33607",
      terrain: "riverfront city park — lawns and plazas on the Hillsborough River",
    },
    weatherEndpoint: "https://api.weather.gov/points/27.9534,-82.4674",
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    policies: { minimumAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["sunset-on-the-river-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#fb923c", emoji: "🌅", region: "North America" },
  };
})();

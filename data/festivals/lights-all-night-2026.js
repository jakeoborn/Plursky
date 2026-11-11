// ═══════════════════════════════════════════════════════════════════════
// LIGHTS ALL NIGHT 2026 — Fair Park · Dallas, TX
// Dec 30–31, 2026 (16th edition; LAN began NYE 2010). Disco Presents.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11: switch on the festivals with a full lineup). Set times still TBA. No official day split,
// stage assignments, set times or 2026 map are published, so every act is
// unplaced and untimed in one TBA bucket. Gaps stay empty.
//
// SOURCE lineup: EDMTunes, "Lights All Night 2026 lineup", published
// 2026-07-09, read 2026-11-10 — 39 billings, kept exactly as printed. This is
// a press relay of the official poster, NOT the poster itself, so
// lineupSource.official is false. The official poster is hosted on
// 2026-lightsallnight-com.imgix.net, which this build environment could not
// reach (proxy 403, 2026-11-10). Check the rows against the poster before the
// flip. A third-party guide (festiplannr) claims 41 artists; unverified, so
// nothing was added from it. A partial night split seen on a third-party blog
// is not official and is NOT used.
//
// SOURCE dates, venue, hours, age: lightsallnight.com/guide and
// lightsallnight.com/location, read 2026-11-10 — Dec 30 + Dec 31, 2026 at
// Fair Park, 3809 Grand Ave, Dallas, TX 75210; gates 6 PM, event ends 3 AM
// both nights; parking + box office open 5 PM; 18+ entry, 21+ alcohol; three
// stages, all main stages indoors. The guide's dated block reads "Day 2:
// Wednesday, December 31st", but Dec 31, 2026 is a Thursday, so the block is
// not provably this edition's. Same ruling as Countdown NYE: no hours field
// until the page prints a block that matches this edition.
//
// SOURCE gps: en.wikipedia.org/wiki/Fair_Park infobox, read 2026-11-10 —
// 32°46′55″N 96°45′56″W (32.78194, -96.76556), 277 acres.
// NOT MEASURED: venue footprint. The OSM lookups used for other venues were
// refused by this environment's proxy (2026-11-10), so no surveyed ring is
// declared; the map shows real basemap tiles around the gps point only.
// sunTimes are COMPUTED, not looked up: NOAA solar-position formula, zenith
// 90.833°, at the gps point, UTC-6 (api.sunrise-sunset.org was refused by the
// proxy). Re-check against a lookup before the flip.
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
      bio: "Playing Lights All Night 2026." };
  };
  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #f59e0b, #07031a)",
    bio: "Playing Lights All Night 2026. Stage, night and set time are not " +
         "published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("lan-armnhmr", "ARMNHMR"),
    mk("lan-artifakts", "ARTIFAKTS"),
    mk("lan-atliens", "ATLiens"),
    mk("lan-avello", "AVELLO"),
    mk("lan-azyr", "AZYR"),
    mk("lan-beauz", "BEAUZ"),
    mk("lan-byorn", "BYORN"),
    mk("lan-chris-lake", "Chris Lake"),
    mk("lan-conrad-taylor", "Conrad Taylor"),
    mk("lan-devault", "Devault"),
    mk("lan-dj-mandy", "DJ Mandy"),
    mk("lan-fly", "FLY"),
    mk("lan-gg-magree", "GG Magree"),
    mk("lan-gryffin", "Gryffin"),
    mk("lan-hershe", "Hershe"),
    mk("lan-hhunter", "HHUNTER"),
    mk("lan-hydraulix", "Hydraulix"),
    mk("lan-i-hate-models", "I Hate Models"),
    mk("lan-ian-asher", "Ian Asher"),
    mk("lan-jigitz", "JIGITZ"),
    mk("lan-jon-casey", "Jon Casey"),
    mk("lan-josh-baker", "Josh Baker"),
    mk("lan-kettama", "KETTAMA"),
    mk("lan-level-up", "Level Up"),
    mk("lan-lyny", "LYNY"),
    mk("lan-mad-dubz-b2b-vktm", "Mad Dubz b2b VKTM"),
    mk("lan-madgrrl", "MADGRRL"),
    mk("lan-marie-vaunt", "Marie Vaunt"),
    mk("lan-mindset", "Mindset"),
    mk("lan-ninajirachi", "Ninajirachi"),
    mk("lan-sidequest", "Sidequest"),
    mk("lan-skull-machine-black-tiger-sex-machine-x-kai-wachi", "Skull Machine (Black Tiger Sex Machine x Kai Wachi)"),
    mk("lan-subtronics", "Subtronics"),
    mk("lan-telykast", "Telykast"),
    mk("lan-tiesto", "Tiësto"),
    mk("lan-william-black", "William Black"),
    mk("lan-wtchcrft", "WTCHCRFT"),
    mk("lan-ydg", "YDG"),
    mk("lan-yousuke-yuk1matsu", "YØU$UKE YUK1MAT$U"),
  ];

  const CONFIG = {
    id: "lights-all-night-2026",
    // No hours field: the official guide's dated block does not match this
    // edition's weekdays (see SOURCE above).
    lineupSource: { url: "https://www.edmtunes.com/2026/07/09/lights-all-night-2026-lineup-tiesto-chris-lake-subtronics-more/", observedAt: "2026-11-10", official: false },
    name: "Lights All Night 2026",
    shortName: "LAN",
    brand: "Lights All Night",
    tagline: "Two nights into the new year in Dallas",
    location: "Fair Park · Dallas, TX",
    locationShort: "Fair Park",
    dates: "Dec 30–31, 2026",
    year: 2026,
    // Night Print accent not measured yet: the site's stylesheet has not been
    // read. accent null means a neutral print until it is sourced.
    print: { accent: null, source: { url: "https://lightsallnight.com/", observedAt: "2026-11-10" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://lightsallnight.com/",
      tickets: "https://wl.eventim.us/event/Lights-All-Night-2026/696830",
      observedAt: "2026-11-10",
    },
    startMs: Date.UTC(2026, 11, 31, 0, 0, 0),  // Dec 30 18:00 CST (gates)
    endMs: Date.UTC(2027, 0, 1, 9, 0, 0),      // Jan 1 03:00 CST (end of night 2)
    tz: "America/Chicago",
    tzAbbr: "CST",
    utcOffsetHours: -6,
    // No official night split. One TBA bucket keeps every billing browsable
    // without claiming an artist plays both nights.
    dayDates: {
      1: { y: 2026, m: 11, d: 30, name: "Dec 30–31", short: "TBA",
           midnightUtc: Date.UTC(2026, 11, 30, 6, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point for Dec 30, 2026; Dec 31 is
    // 07:29 / 17:30.
    sunTimes: { 1: { rise: "07:29", set: "17:29" } },
    gps: { lat: 32.78194, lng: -96.76556, onSiteRadiusMi: 0.5 },
    venue: {
      name: "Fair Park",
      address: "3809 Grand Ave, Dallas, TX 75210",
      terrain: "historic fairground — indoor halls, paved plazas and lots",
    },
    weatherEndpoint: "https://api.weather.gov/points/32.7819,-96.7656",
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    policies: { minimumAge: 18, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["lights-all-night-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#f59e0b", emoji: "🎇", region: "North America" },
  };
})();

// ═══════════════════════════════════════════════════════════════════════
// EDC THAILAND 2026 — Rhythm Park · Phuket, Thailand
// Dec 18–20, 2026. Insomniac. Second Thai edition of the year.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY, OPEN (available: true, scheduleTBA: true; Jake 2026-11-11: switch on the festivals with a full lineup). Set times still TBA. The lineup AND its day
// split are official; stages, set times and the site map are not published.
//
// SOURCE lineup + day split: thailand.edc.com/en/lineup/, read 2026-11-11,
// "By Day" tab — Friday December 18 lists 34 acts, Saturday December 19
// lists 33, Sunday December 20 lists 33: 100 rows, each kept exactly as
// printed ("Leveltronics (Subtronics B2B Level Up)", "Subtronics (Sunset
// Set)", "WhoMadeWho (Hybrid DJ Set)"). One exception: the page prints
// "Showtek Hardstyle Set"; it is written "Showtek (Hardstyle Set)" here, as
// Escape 2026 prints it, so the artist registry keeps one Showtek. The
// Dec 17 Hotel EDC beach party at XANA Beach Club is a separate ticketed
// event and is not loaded.
// SOURCE dates + venue: thailand.edc.com/en/, read 2026-11-11 — title
// "EDC Thailand | December 18+19+20 | Rhythm Park"; travel/location page:
// "Rhythm Park, Phuket", a new venue for this edition.
//
// SOURCE hours: NOT OFFICIAL. ra.co/events/2466189, read 2026-11-11, lists
// "Fri 15:00 - Mon 01:00". The official site published no hours page that
// this build could read (its FAQ path 404s). startMs/endMs use the RA span;
// re-check against the official hours before the flip.
// SOURCE gps + address: NOT OFFICIAL. evephuket.com venue listing for
// "Rhythm Park | EDC Thailand", read 2026-11-11 — map point 8.008681,
// 98.315498; "Bandon-Cherngtalay Rd, Bang Tao Beach, Choeng Thale, Thalang
// District, Phuket 83110". A third-party map point, not a survey.
// NO AGE POLICY loaded: none read from an official page.
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
      bio: "Playing EDC Thailand 2026." };
  };
  const DAY_NAME = { 1: "December 18", 2: "December 19", 3: "December 20" };
  const mk = (id, name, day) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #2dd4bf, #0b1a2e)",
    bio: "Playing EDC Thailand 2026 on " + DAY_NAME[day] +
         ". Stage and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    // ── Fri Dec 18 (day 1) ── 34 acts
    mk("edcth-and-friends", "&friends", 1),
    mk("edcth-above-and-beyond", "Above & Beyond", 1),
    mk("edcth-adiel-b2b-anne", "Adiel B2B Annē", 1),
    mk("edcth-alleycvt", "ALLEYCVT", 1),
    mk("edcth-ana-rova", "Ana Rova", 1),
    mk("edcth-andy-c", "Andy C", 1),
    mk("edcth-atliens", "ATLiens", 1),
    mk("edcth-baggi", "Baggi", 1),
    mk("edcth-barbara-lago", "Barbara Lago", 1),
    mk("edcth-basstripper", "Basstripper", 1),
    mk("edcth-camelphat", "CamelPhat", 1),
    mk("edcth-charlotte-de-witte", "Charlotte de Witte", 1),
    mk("edcth-coop", "Coop", 1),
    mk("edcth-dennett", "Dennett", 1),
    mk("edcth-dom-dolla", "Dom Dolla", 1),
    mk("edcth-funk-tribu", "Funk Tribu", 1),
    mk("edcth-guide", "Guide", 1),
    mk("edcth-hanky", "Hanky", 1),
    mk("edcth-jackie-hollander", "Jackie Hollander", 1),
    mk("edcth-jwp", "JWP.", 1),
    mk("edcth-kamiko", "Kamiko", 1),
    mk("edcth-korolova", "Korolova", 1),
    mk("edcth-kream", "KREAM", 1),
    mk("edcth-leveltronics-subtronics-b2b-level-up", "Leveltronics (Subtronics B2B Level Up)", 1),
    mk("edcth-nghtshift", "Nghtshift", 1),
    mk("edcth-noise-mafia-b2b-afem-syko", "Noise Mafia B2B Afem Syko", 1),
    mk("edcth-odd-mob", "Odd Mob", 1),
    mk("edcth-omnom", "OMNOM", 1),
    mk("edcth-peterblue", "PETERBLUE", 1),
    mk("edcth-pnny-collective", "Pnny Collective", 1),
    mk("edcth-sabai", "SABAI", 1),
    mk("edcth-vintage-culture", "Vintage Culture", 1),
    mk("edcth-whomadewho-hybrid-dj-set", "WhoMadeWho (Hybrid DJ Set)", 1),
    mk("edcth-wujackers", "Wujackers", 1),

    // ── Sat Dec 19 (day 2) ── 33 acts
    mk("edcth-afem-syko-b2b-funk-tribu", "Afem Syko B2B Funk Tribu", 2),
    mk("edcth-alex-wann", "Alex Wann", 2),
    mk("edcth-alpha-9", "ALPHA 9", 2),
    mk("edcth-am-not-joy", "Am Not Joy", 2),
    mk("edcth-andrew-rayel", "Andrew Rayel", 2),
    mk("edcth-chasewest", "ChaseWest", 2),
    mk("edcth-daxson", "Daxson", 2),
    mk("edcth-ekanan", "Ekanan", 2),
    mk("edcth-giuseppe-ottaviani", "Giuseppe Ottaviani", 2),
    mk("edcth-gudfella", "GUDFELLA", 2),
    mk("edcth-hannah-laing", "Hannah Laing", 2),
    mk("edcth-horsegiirl", "horsegiirL", 2),
    mk("edcth-i-hate-models", "I Hate Models", 2),
    mk("edcth-jaidee", "Jaidee", 2),
    mk("edcth-james-hype", "James Hype", 2),
    mk("edcth-kaku", "Kaku", 2),
    mk("edcth-kanine-b2b-sota", "Kanine B2B Sota", 2),
    mk("edcth-kaskade", "Kaskade", 2),
    mk("edcth-kikie", "Kikie", 2),
    mk("edcth-marlo", "MaRLo", 2),
    mk("edcth-martin-garrix", "Martin Garrix", 2),
    mk("edcth-mau-p", "Mau P", 2),
    mk("edcth-nakadia", "Nakadia", 2),
    mk("edcth-omri", "OMRI.", 2),
    mk("edcth-paul-van-dyk", "Paul van Dyk", 2),
    mk("edcth-rafael", "Rafael", 2),
    mk("edcth-restricted", "Restricted", 2),
    mk("edcth-space-92-x-popof-present-turbulences", "Space 92 x Popof Present: Turbulences", 2),
    mk("edcth-subtronics-sunset-set", "Subtronics (Sunset Set)", 2),
    mk("edcth-supergloss", "Supergloss", 2),
    mk("edcth-taiki-nulight", "Taiki Nulight", 2),
    mk("edcth-thanac", "Thanac", 2),
    mk("edcth-vtss", "VTSS", 2),

    // ── Sun Dec 20 (day 3) ── 33 acts
    mk("edcth-anderex", "Anderex", 3),
    mk("edcth-bella-claxton-b2b-kyle-starkey", "Bella Claxton B2B Kyle Starkey", 3),
    mk("edcth-bravery", "Bravery", 3),
    mk("edcth-carta", "Carta", 3),
    mk("edcth-clara-cuve", "Clara Cuvé", 3),
    mk("edcth-coone", "Coone", 3),
    mk("edcth-da-tweekaz", "Da Tweekaz", 3),
    mk("edcth-darren-styles", "Darren Styles", 3),
    mk("edcth-dean-turnley", "Dean Turnley", 3),
    mk("edcth-dj-snake", "DJ Snake", 3),
    mk("edcth-fifi", "FIFI", 3),
    mk("edcth-genji", "Genji", 3),
    mk("edcth-green-velvet-b2b-steve-angello", "Green Velvet B2B Steve Angello", 3),
    mk("edcth-hamdi", "Hamdi", 3),
    mk("edcth-jamie-jones", "Jamie Jones", 3),
    mk("edcth-lil-texas", "Lil Texas", 3),
    mk("edcth-loco-dice", "Loco Dice", 3),
    mk("edcth-max-styler", "Max Styler", 3),
    mk("edcth-miss-monique", "Miss Monique", 3),
    mk("edcth-mr-sour-b2b-sachi-moki", "Mr. Sour B2B Sachi Moki", 3),
    mk("edcth-omar-plus", "Omar+", 3),
    mk("edcth-osmosis-jones", "Osmosis Jones", 3),
    mk("edcth-oxyboy", "Oxyboy", 3),
    mk("edcth-quest", "Quest", 3),
    mk("edcth-roz", "RØZ", 3),
    mk("edcth-showtek-hardstyle-set", "Showtek (Hardstyle Set)", 3),
    mk("edcth-sickmode", "Sickmode", 3),
    mk("edcth-sihk", "Sihk", 3),
    mk("edcth-sofi-tukker", "Sofi Tukker", 3),
    mk("edcth-sundaysundae", "SundaySundae", 3),
    mk("edcth-tiesto", "Tiësto", 3),
    mk("edcth-worship", "Worship", 3),
    mk("edcth-yanamaste", "Yanamaste", 3),
  ];

  const CONFIG = {
    id: "edc-thailand-2026",
    lineupSource: { url: "https://thailand.edc.com/en/lineup/", observedAt: "2026-11-11", official: true },
    name: "EDC Thailand 2026",
    shortName: "EDC Thailand",
    brand: "EDC Thailand",
    tagline: "Under the Electric Sky in Phuket",
    location: "Rhythm Park · Phuket, Thailand",
    locationShort: "Rhythm Park",
    dates: "Dec 18–20, 2026",
    year: 2026,
    print: { accent: null, source: { url: "https://thailand.edc.com/en/", observedAt: "2026-11-11" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://thailand.edc.com/en/",
      observedAt: "2026-11-11",
    },
    // Thailand is ICT (UTC+7), no DST. Hours from RA, not official (header).
    startMs: Date.UTC(2026, 11, 18, 8, 0, 0),   // Dec 18 15:00 ICT
    endMs: Date.UTC(2026, 11, 20, 18, 0, 0),    // Dec 21 01:00 ICT
    tz: "Asia/Bangkok",
    tzAbbr: "ICT",
    utcOffsetHours: 7,
    dayDates: {
      1: { y: 2026, m: 11, d: 18, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 11, 17, 17, 0, 0) },
      2: { y: 2026, m: 11, d: 19, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 11, 18, 17, 0, 0) },
      3: { y: 2026, m: 11, d: 20, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 11, 19, 17, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point, ICT.
    sunTimes: {
      1: { rise: "06:33", set: "18:13" },
      2: { rise: "06:34", set: "18:13" },
      3: { rise: "06:34", set: "18:14" },
    },
    gps: { lat: 8.008681, lng: 98.315498, onSiteRadiusMi: 0.4 },
    venue: {
      name: "Rhythm Park",
      address: "Bandon-Cherngtalay Rd, Bang Tao Beach, Choeng Thale, Thalang District, Phuket 83110, Thailand",
      terrain: "open festival grounds near Bang Tao Beach",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["edc-thailand-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#2dd4bf", emoji: "🏝️", region: "Asia" },
  };
})();

// ═══════════════════════════════════════════════════════════════════════
// COUNTDOWN NYE 2026 — NOS Events Center · San Bernardino, CA
// Dec 31, 2026–Jan 1, 2027
// ═══════════════════════════════════════════════════════════════════════
// LINEUP + NIGHT SPLIT. The official lineup page names the artists and the
// night each plays. No stage assignments, set times or site map are
// published. Those gaps stay empty rather than borrowing 2025 data or guessing.
//
// SOURCE poster (the record until 2026-11-08), embedded on
// countdownnye.com/, uploaded 2026-09-21:
// https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/59/2026/09/21114928/lineup.png
// Parsed and visually checked 2026-09-21: 71 billed rows. Collaboration,
// project and takeover text is preserved as one billing exactly as printed.
//
// SOURCE night split, now the source of record for the rows:
// countdownnye.com/lineup/ "By Day", re-read 2026-11-08. The stale "2025
// LINEUP" heading seen on 2026-09-21 is gone. It lists 70 acts:
// "Thursday, December 31" 35 and "Friday, January 01" 35, with no act on
// both nights. Thursday Dec 31 + Friday Jan 1 is this edition's calendar.
// Lane ruling 2026-11-08: the official page wins where it differs from the
// poster. Against the 71 poster rows that means:
//   + Of The Trees (Jan 1), on the page but not the poster;
//   - Bassrush Experience and Insomniac Records Takeover, poster billings
//     the page lists on neither night (kept in git history, not deleted data);
//   spelling as the page prints it: S.Y.N (Svdden Death, yvm3, NIMDA); SINCERA.
// The page keeps the poster's B2B billings (HEYZ B2B Tynan, LYNY B2B
// Peekaboo, Mija B2B sim0ne) as single rows.
//
// SOURCE dates + venue: countdownnye.com/ and Insomniac's official event page,
// read 2026-09-21 — Dec 31 + Jan 1, 2027, San Bernardino; official homepage
// names NOS Events Center. Official April announcement confirms two days,
// five covered stages and 75+ individual artists. The poster's 71 billings can
// contain multiple artists, so those counts do not conflict.
// SOURCE hours + age: countdownnye.com/hours-and-info/, read 2026-09-21 —
// NOS Events Center, 689 S E St., 4 PM–2 AM, 18+ entry and 21+ alcohol. That
// page's dated block reads "Thursday, December 31, 2025 + Friday, January 1"
// (re-read 2026-09-24). The weekday fits 2026 but the year says 2025, so the
// block is not provably this edition's. Lane ruling 2026-09-24: no hours field
// until the page prints a block dated for Dec 31, 2026 (the edition gate,
// editionHours() in scripts/lib/festival-page-data.mjs, refuses anything else).
// SOURCE venue geometry: OpenStreetMap way 563078901, legal name "National
// Orange Show & Event Center". The same surveyed venue data already used by
// Escape 2026 is reused here; no festival layout is inferred from it.
//
// NOT PUBLISHED: stage assignments, set times, 2026 stage names, stage
// positions and 2026 map. Every act sits on its night, unplaced and untimed.
// The app uses real basemap tiles and the surveyed venue footprint.
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
      bio: "Playing Countdown NYE 2026." };
  };
  const mk = (id, name, day) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #06b6d4, #07031a)",
    bio: "Playing Countdown NYE 2026. Stage and set time are not " +
         "published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("cdny-33-below", "33 Below", 2),
    mk("cdny-acraze", "ACRAZE", 1),
    mk("cdny-ahee", "AHEE", 1),
    mk("cdny-alesso", "Alesso", 2),
    mk("cdny-archie-hamilton", "Archie Hamilton", 2),
    mk("cdny-arlo", "Arlo", 2),
    mk("cdny-aych", "AYCH", 2),
    mk("cdny-blaise-bracic", "Blaise Bracic", 2),
    mk("cdny-borne", "borne", 2),
    mk("cdny-brandon", "Brandon", 1),
    mk("cdny-bunt", "BUNT.", 2),
    mk("cdny-bushbaby", "Bushbaby", 2),
    mk("cdny-chozen", "CHOZEN", 2),
    mk("cdny-crumb-pit", "Crumb Pit", 1),
    mk("cdny-deathpact", "Deathpact", 1),
    mk("cdny-discovery-project", "Discovery Project", 1),
    mk("cdny-dj-diesel", "DJ Diesel", 1),
    mk("cdny-dj-guestlist", "DJ Guestlist", 1),
    mk("cdny-dj-snake", "DJ Snake", 1),
    mk("cdny-dmina", "DØMINA", 1),
    mk("cdny-ecchi-mp4", "ECCHI.MP4", 2),
    mk("cdny-esse", "ESSE", 1),
    mk("cdny-flosstradamus", "Flosstradamus", 2),
    mk("cdny-ghengar", "Ghengar", 2),
    mk("cdny-gordo", "Gordo", 2),
    mk("cdny-gorillat", "GorillaT", 2),
    mk("cdny-gravedgr", "GRAVEDGR", 1),
    mk("cdny-green-matter", "Green Matter", 1),
    mk("cdny-heyz-b2b-tynan", "HEYZ B2B Tynan", 2),
    mk("cdny-hills", "Hills", 1),
    mk("cdny-hol", "HOL!", 1),
    mk("cdny-jaden-bojsen", "Jaden Bojsen", 1),
    mk("cdny-james-hype", "James Hype", 1),
    mk("cdny-jessica-audiffred", "Jessica Audiffred", 2),
    mk("cdny-jev", "Jev", 2),
    mk("cdny-joshwa", "Joshwa", 2),
    mk("cdny-kelland", "Kelland", 2),
    mk("cdny-khrome", "KHROME", 1),
    mk("cdny-kloud", "Kloud", 1),
    mk("cdny-lavern", "Lavern", 1),
    mk("cdny-loud-luxury", "Loud Luxury", 2),
    mk("cdny-lucky", "Lucky", 1),
    mk("cdny-lyny-b2b-peekaboo", "LYNY B2B Peekaboo", 2),
    mk("cdny-madvktm", "MADVKTM", 2),
    mk("cdny-marshmello", "Marshmello", 2),
    mk("cdny-matroda", "Matroda", 1),
    mk("cdny-mija-b2b-sim0ne", "Mija B2B sim0ne", 1),
    mk("cdny-nghtmre", "NGHTMRE", 2),
    mk("cdny-noise-mafia", "Noise Mafia", 1),
    mk("cdny-of-the-trees", "Of The Trees", 2),
    mk("cdny-oliver-heldens", "Oliver Heldens", 1),
    mk("cdny-r3hab", "R3HAB", 1),
    mk("cdny-ranger-trucco", "Ranger Trucco", 2),
    mk("cdny-rinzen", "Rinzen", 1),
    mk("cdny-rz", "RØZ", 1),
    mk("cdny-seven-lions", "Seven Lions", 2),
    mk("cdny-sincera", "SINCERA", 2),
    mk("cdny-skilah", "Skilah", 1),
    mk("cdny-smoakland", "Smoakland", 1),
    mk("cdny-space-laces", "Space Laces", 2),
    mk("cdny-subtronics", "Subtronics", 1),
    mk("cdny-s-y-n-svdden-death-yvm3-nimda", "S.Y.N (Svdden Death, yvm3, NIMDA)", 1),
    mk("cdny-taiki-nulight", "Taiki Nulight", 2),
    mk("cdny-tchami", "Tchami", 1),
    mk("cdny-tobehonest", "TOBEHONEST", 2),
    mk("cdny-tokimonsta", "TOKiMONSTA", 2),
    mk("cdny-troyboi", "TroyBoi", 2),
    mk("cdny-walker-and-royce", "Walker & Royce", 1),
    mk("cdny-wax-motif", "Wax Motif", 2),
    mk("cdny-zingara", "Zingara", 1),
  ];

  const CONFIG = {
    id: "countdown-nye-2026",
    // No hours field: the official page's dated block says 2025 (see SOURCE
    // hours above). Add one only with a `dated` block for this edition.
    // Where the lineup rows came from (the SOURCE note above), as data so the
    // public /f/ page can cite it. observedAt = the date it was read.
    lineupSource: { url: "https://countdownnye.com/lineup/", observedAt: "2026-11-08", official: true },
    name: "Countdown NYE 2026",
    shortName: "Countdown",
    brand: "Countdown",
    tagline: "Five stages into the new year",
    location: "NOS Events Center · San Bernardino, CA",
    locationShort: "NOS Events Center",
    dates: "Dec 31, 2026 – Jan 1, 2027",
    year: 2026,
    // Night Print accent: the festival's own first-party colour (ledger: scripts/test-night-print.mjs)
    print: { accent: "#6000DF", source: { url: "https://countdownnye.com/wp-content/assets/css/countdown.min.css?ver=2.2.41", observedAt: "2026-10-09", seenAs: "a{color}, .button{background-color}, active nav link, blockquote, .card__category (15 uses)", confidence: "high" }, note: "The per-festival stylesheet of Insomniac's shared 'festival' theme sets every link, primary button and category label to this violet; no theme-color meta." },
    officialEvent: {
      id: 554480,
      url: "https://www.insomniac.com/events/our-world/countdown/",
      website: "https://countdownnye.com/",
      tickets: "https://countdownnye.frontgatetickets.com/",
      observedAt: "2026-09-21",
    },
    startMs: Date.UTC(2027, 0, 1, 0, 0, 0),  // Dec 31 16:00 PST
    endMs: Date.UTC(2027, 0, 2, 10, 0, 0),   // Jan 2 02:00 PST
    tz: "America/Los_Angeles",
    tzAbbr: "PST",
    utcOffsetHours: -8,
    // Night split from countdownnye.com/lineup/ "By Day", read 2026-11-08:
    // 35 acts on Thursday, December 31 and 35 on Friday, January 01.
    dayDates: {
      1: { y: 2026, m: 11, d: 31, name: "Dec 31", short: "NYE",
           midnightUtc: Date.UTC(2026, 11, 31, 8, 0, 0) },
      2: { y: 2027, m: 0, d: 1, name: "Jan 1", short: "FRI",
           midnightUtc: Date.UTC(2027, 0, 1, 8, 0, 0) },
    },
    // api.sunrise-sunset.org at the surveyed venue centroid, read 2026-11-08.
    // Dec 31 and Jan 1 are identical to the minute at both ends.
    sunTimes: { 1: { rise: "06:54", set: "16:50" }, 2: { rise: "06:54", set: "16:50" } },
    gps: { lat: 34.085405, lng: -117.292632, onSiteRadiusMi: 0.5 },
    venue: {
      name: "NOS Events Center",
      address: "689 S. E St, San Bernardino, CA 92408",
      terrain: "flat fairground — paved lots, exhibition halls and grass",
      footprint: [
        [34.0919499,-117.2939607],[34.0889253,-117.2939574],[34.0882510,-117.2938318],[34.0880895,-117.2938060],[34.0880485,-117.2938228],[34.0875780,-117.2937319],[34.0872993,-117.2936883],[34.0869375,-117.2936495],[34.0860440,-117.2936557],[34.0860471,-117.2936286],[34.0858136,-117.2936083],[34.0858109,-117.2936386],[34.0855076,-117.2935946],[34.0855014,-117.2923447],[34.0839807,-117.2923422],[34.0837217,-117.2925021],[34.0827894,-117.2924415],[34.0826157,-117.2926259],[34.0825001,-117.2928187],[34.0824426,-117.2929744],[34.0823809,-117.2931736],[34.0823303,-117.2934148],[34.0822738,-117.2937917],[34.0819100,-117.2938239],[34.0815023,-117.2938256],[34.0814870,-117.2937922],[34.0814855,-117.2929290],[34.0814885,-117.2925513],[34.0815218,-117.2925318],[34.0815363,-117.2910087],[34.0815101,-117.2910057],[34.0815159,-117.2907388],[34.0823581,-117.2907465],[34.0823682,-117.2898196],[34.0861679,-117.2898114],[34.0906740,-117.2897916],[34.0916264,-117.2897863],[34.0916275,-117.2904588],[34.0920349,-117.2904585],[34.0920212,-117.2938722],[34.0919499,-117.2939607]
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/34.0854,-117.2926",
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    policies: { minimumAge: 18, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["countdown-nye-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#60a5fa", emoji: "🎆", region: "North America" },
  };
})();

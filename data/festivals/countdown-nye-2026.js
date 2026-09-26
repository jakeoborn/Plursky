// ═══════════════════════════════════════════════════════════════════════
// COUNTDOWN NYE 2026 — NOS Events Center · San Bernardino, CA
// Dec 31, 2026–Jan 1, 2027
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY BUILD. The official poster names the artists, but no official
// 2026 day split, stage assignments, set times or site map are published.
// Those gaps stay empty rather than borrowing 2025 data or guessing.
//
// SOURCE lineup, source of record: official poster embedded on
// countdownnye.com/, uploaded 2026-09-21:
// https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/59/2026/09/21114928/lineup.png
// Parsed and visually checked 2026-09-21: 71 billed rows. Collaboration,
// project and takeover text is preserved as one billing exactly as printed.
//
// CORROBORATION: countdownnye.com/lineup/, read 2026-09-21. Its underlying
// lineup payload agrees on the ordinary artist rows, but the visible heading
// still says "2025 LINEUP" and its stale stage groupings are not 2026 proof.
// The poster is canonical where the payload flattens or omits poster billings:
//   HEYZ B2B Tynan; LYNY B2B Peekaboo; Mija B2B sim0ne;
//   S.Y.N (SVDDEN DEATH, yvm3, NIMDA); Bassrush Experience;
//   Insomniac Records Takeover; Sincera.
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
// NOT PUBLISHED: day split, stage assignments, set times, 2026 stage names,
// stage positions and 2026 map. Every act is unplaced and untimed in one TBA
// bucket. The app uses real basemap tiles and the surveyed venue footprint.
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
  const mk = (id, name) => scheduled({
    id, name, genre: "—", country: "—",
    stage: null, day: 1, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #06b6d4, #07031a)",
    bio: "Playing Countdown NYE 2026. Stage, night and set time are not " +
         "published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("cdny-33-below", "33 Below"),
    mk("cdny-acraze", "ACRAZE"),
    mk("cdny-ahee", "AHEE"),
    mk("cdny-alesso", "Alesso"),
    mk("cdny-archie-hamilton", "Archie Hamilton"),
    mk("cdny-arlo", "Arlo"),
    mk("cdny-aych", "AYCH"),
    mk("cdny-bassrush-experience", "Bassrush Experience"),
    mk("cdny-blaise-bracic", "Blaise Bracic"),
    mk("cdny-borne", "borne"),
    mk("cdny-brandon", "Brandon"),
    mk("cdny-bunt", "BUNT."),
    mk("cdny-bushbaby", "Bushbaby"),
    mk("cdny-chozen", "CHOZEN"),
    mk("cdny-crumb-pit", "Crumb Pit"),
    mk("cdny-deathpact", "Deathpact"),
    mk("cdny-discovery-project", "Discovery Project"),
    mk("cdny-dj-diesel", "DJ Diesel"),
    mk("cdny-dj-guestlist", "DJ Guestlist"),
    mk("cdny-dj-snake", "DJ Snake"),
    mk("cdny-dmina", "DØMINA"),
    mk("cdny-ecchi-mp4", "ECCHI.MP4"),
    mk("cdny-esse", "ESSE"),
    mk("cdny-flosstradamus", "Flosstradamus"),
    mk("cdny-ghengar", "Ghengar"),
    mk("cdny-gordo", "Gordo"),
    mk("cdny-gorillat", "GorillaT"),
    mk("cdny-gravedgr", "GRAVEDGR"),
    mk("cdny-green-matter", "Green Matter"),
    mk("cdny-heyz-b2b-tynan", "HEYZ B2B Tynan"),
    mk("cdny-hills", "Hills"),
    mk("cdny-hol", "HOL!"),
    mk("cdny-insomniac-records-takeover", "Insomniac Records Takeover"),
    mk("cdny-jaden-bojsen", "Jaden Bojsen"),
    mk("cdny-james-hype", "James Hype"),
    mk("cdny-jessica-audiffred", "Jessica Audiffred"),
    mk("cdny-jev", "Jev"),
    mk("cdny-joshwa", "Joshwa"),
    mk("cdny-kelland", "Kelland"),
    mk("cdny-khrome", "KHROME"),
    mk("cdny-kloud", "Kloud"),
    mk("cdny-lavern", "Lavern"),
    mk("cdny-loud-luxury", "Loud Luxury"),
    mk("cdny-lucky", "Lucky"),
    mk("cdny-lyny-b2b-peekaboo", "LYNY B2B Peekaboo"),
    mk("cdny-madvktm", "MADVKTM"),
    mk("cdny-marshmello", "Marshmello"),
    mk("cdny-matroda", "Matroda"),
    mk("cdny-mija-b2b-sim0ne", "Mija B2B sim0ne"),
    mk("cdny-nghtmre", "NGHTMRE"),
    mk("cdny-noise-mafia", "Noise Mafia"),
    mk("cdny-oliver-heldens", "Oliver Heldens"),
    mk("cdny-r3hab", "R3HAB"),
    mk("cdny-ranger-trucco", "Ranger Trucco"),
    mk("cdny-rinzen", "Rinzen"),
    mk("cdny-rz", "RØZ"),
    mk("cdny-s-y-n-svdden-death-yvm3-nimda", "S.Y.N (SVDDEN DEATH, yvm3, NIMDA)"),
    mk("cdny-seven-lions", "Seven Lions"),
    mk("cdny-sincera", "Sincera"),
    mk("cdny-skilah", "Skilah"),
    mk("cdny-smoakland", "Smoakland"),
    mk("cdny-space-laces", "Space Laces"),
    mk("cdny-subtronics", "Subtronics"),
    mk("cdny-taiki-nulight", "Taiki Nulight"),
    mk("cdny-tchami", "Tchami"),
    mk("cdny-tobehonest", "TOBEHONEST"),
    mk("cdny-tokimonsta", "TOKiMONSTA"),
    mk("cdny-troyboi", "TroyBoi"),
    mk("cdny-walker-and-royce", "Walker & Royce"),
    mk("cdny-wax-motif", "Wax Motif"),
    mk("cdny-zingara", "Zingara"),
  ];

  const CONFIG = {
    id: "countdown-nye-2026",
    // Entry age, camping and ticket state: first-party, per edition (festivalEssentials).
    essentialsSources: {"minimumAge": {"url": "https://countdownnye.com/tickets/", "observedAt": "2026-09-26", "edition": "2026"}, "tickets": {"url": "https://countdownnye.frontgatetickets.com/", "state": "on-sale", "observedAt": "2026-09-26", "edition": "2026", "evidence": "https://countdownnye.com/tickets/"}},
    // No hours field: the official page's dated block says 2025 (see SOURCE
    // hours above). Add one only with a `dated` block for this edition.
    // Where the lineup rows came from (the SOURCE note above), as data so the
    // public /f/ page can cite it. observedAt = the date it was read.
    lineupSource: { url: "https://countdownnye.com/lineup/", observedAt: "2026-09-21", official: true },
    name: "Countdown NYE 2026",
    shortName: "Countdown",
    brand: "Countdown",
    tagline: "Five stages into the new year",
    location: "NOS Events Center · San Bernardino, CA",
    locationShort: "NOS Events Center",
    dates: "Dec 31, 2026 – Jan 1, 2027",
    year: 2026,
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
    // The official poster does not publish a night split. One TBA bucket keeps
    // all billings browsable without claiming an artist performs both nights.
    dayDates: {
      1: { y: 2026, m: 11, d: 31, name: "Dec 31–Jan 1", short: "TBA",
           midnightUtc: Date.UTC(2026, 11, 31, 8, 0, 0) },
    },
    // api.sunrise-sunset.org at the surveyed venue centroid, 2026-09-21.
    sunTimes: { 1: { rise: "06:53", set: "16:51" } },
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

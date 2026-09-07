// ═══════════════════════════════════════════════════════════════════════
// ESCAPE HALLOWEEN 2026 — NOS Events Center · San Bernardino, CA
// Oct 30–31, 2026 · Insomniac
// ═══════════════════════════════════════════════════════════════════════
// GATED BUILD. Real stages, real day split, real venue, real map — but NO
// set times and NO artist→stage mapping, because Insomniac has published
// neither. Nothing here is invented; the gaps are left as gaps.
//
// SOURCE lineup + day split: escapehalloween.com/lineup, read 2026-09-07.
//   The page ships THREE official lists: one alphabetical (83 acts) and one
//   per day (42 Friday, 41 Saturday).
//   ✓ CROSS-CHECKED: 42 + 41 = 83, the two day lists are disjoint, and their
//   union equals the alphabetical list exactly — zero orphans in either
//   direction. Two independent official listings, one answer.
//   ⚠ "VNSSA B2B ????" is VERBATIM — the official site prints the four
//   question marks. It is a real TBA, not a parse artifact. Do not "fix" it.
// SOURCE stages: escapehalloween.com/experience/stages — five stages, each
//   with official lore copy. See the ⚠ on Psycho Circus below.
// SOURCE hours + policy: /guide/hours-and-info and /guide/faq, read
//   2026-09-07 — "Show Dates: October 30 + 31, 2026", "Festival Hours
//   4PM-2AM", "Afterparty 2AM-6AM", "You must be 18+ to enter and 21+ for
//   alcohol/VIP", "NO Re-entry/ins & outs per day", and on cash: "Yes, ATMs
//   will be available both inside and outside the venue grounds."
// SOURCE venue: OpenStreetMap way 563078901, via Nominatim 2026-09-07.
// SOURCE sun times: api.sunrise-sunset.org at the venue, converted to PDT.
//
// ⛔ THE OSM LOOKUP THAT FAILS. Searching OSM for "NOS Events Center" —
// the name the festival itself uses on every page — returns NOTHING. The
// venue is tagged "National Orange Show & Event Center". This is the third
// time this exact shape has cost a session (Pier 80 in portola-2026.js, the
// unlinked map page in hard-summer-2026.js): search by the LEGAL name and
// by the street address before concluding a venue is not in OSM.
//
// ⚠ PSYCHO CIRCUS IS NOT A 2026 STAGE. It appears prominently on the map
// art below, because that art is the 2025 map. The official 2026 stages
// page lists five stages and Psycho Circus is not among them. Do not add it
// back by reading the artwork — the artwork is a year out of date, which is
// the whole point of the fallback rule.
//
// ── THE MAP: LAST YEAR'S, DELIBERATELY ──
// Founder ruling (2026-09-06): "each edition ships its own map once it's
// officially released; until release week, fall back to last year's map."
// Insomniac has NOT released a 2026 map — /guide/festival-map/ still serves
// esc_2025_de_festival_map_1080x1350_r03.webp, and the FAQ still says
// amenities "will be clearly marked on the festival map" in the future
// tense. So this ships the 2025 map, and the five 2026 stages are
// registered to where they stand ON THAT ART.
//
//   ⚠ THIS IS A FALLBACK AND MUST BE REPLACED. Swap in the 2026 map the
//   week it drops and RE-MEASURE all five x/y — do not assume the layout
//   carried over. 2026 already dropped a stage; positions can move too.
//
//   The asset is 1040×1040 SQUARE ON PURPOSE. The source is 1080×1350; the
//   map panel was cropped and letterboxed to a square because map.jsx draws
//   image-overlay art with preserveAspectRatio="xMidYMid slice" — feed it a
//   non-square asset and every stage x/y silently shifts. Learned on HARD
//   Summer; do not "fix" the black bars.
//
//   Stage x/y were measured against a labelled 10×10 grid and then VERIFIED
//   by drawing the pins back onto the art and looking. That second step is
//   not optional: the first pass put FEEDING GROUNDS on its banner ribbon,
//   WAREHOUSE out on Psycho Path, SEWER DISTRICT beside its structure and
//   BIG TOP off the tent. Four of five were wrong, exactly as on HARD
//   Summer. Measure the STRUCTURE, never the label.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-09-07, do not fabricate) ──
// SET TIMES: absent. Insomniac posts them days before, on the site and the
//   Insomniac app ("available prior to the event on this site and the
//   Insomniac app").
// ARTIST → STAGE: absent. Every act below therefore carries stage: null.
//   The five stages are real and the day split is real; who plays where is
//   simply not published yet. Filling that in from a guess would be the
//   invented-precision failure PR #36 removed from EDC LV.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// gpsAnchors: NONE. Not T3, not provisional, ABSENT. mapArtIsGeoregistered
// is false, MAP_AFFINE stays null, and the v257/v260 gate suppresses every
// distance and walk-time readout.
//
// ── FLIP CHECKLIST (when Insomniac drops the schedule, ~late Oct) ──
//   1. Set times → real start/end on every act; drop `provisional`.
//   2. Artist → stage from the official per-stage lineups.
//   3. The 2026 map replaces escape-2025-map.webp; RE-MEASURE all x/y.
//   4. Re-check the stage list against the 2026 map (2025 had six).
//   5. registry.available → true, its own PR, founder review (AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // Colours are APP-ASSIGNED, chosen to echo each stage's own art on the
  // 2025 map. Insomniac publishes no stage palette — do not cite these as
  // official. Order and copy follow the official /experience/stages/ page.
  const STAGES = [
    { id: "big-top",        name: "The Big Top",     short: "BIGTOP",  color: "#29B6F6", size: 1.6,
      x: 20.0, y: 66.0,
      desc: "Main stage · carnival lights masking a darker secret" },
    { id: "feeding-grounds", name: "Feeding Grounds", short: "FEEDING", color: "#7CB342", size: 1.4,
      x: 30.0, y: 30.0,
      desc: "Giant creepy crawlers, waiting in the dark" },
    { id: "warehouse",      name: "The Warehouse",   short: "WAREHSE", color: "#FFB300", size: 1.4,
      x: 64.0, y: 53.0,
      desc: "The last curtain call — where the show ends and the spirits remain" },
    { id: "sewer-district", name: "Sewer District",  short: "SEWER",   color: "#9C27B0", size: 1.3,
      x: 87.0, y: 59.0,
      desc: "Dystopian lockdown · subliminal minimalism and live art" },
    { id: "cage",           name: "The Cage",        short: "CAGE",    color: "#F4511E", size: 1.3,
      x: 18.5, y: 27.5,
      desc: "Realm of hellfire — fire-breathers, metal-benders and welders" },
  ];

  // No amenity list published for 2026. The 2025 map art carries amenity
  // icons, but reading 2026 amenities off last year's artwork is exactly the
  // thing the Psycho Circus note above warns against.
  const AMENITIES = [];

  // Day is REAL (official per-day lists). Stage and set time are NOT
  // published, so stage is null and the times are empty rather than guessed.
  // `tier` drives lineup card weighting; with no times there is no basis to
  // rank, so every act sits at the same tier. `provisional: true` marks the
  // whole set for the flip session.
  const mk = (id, name, day) => ({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #F4511E, #1a0a14)",
    bio: `Playing Escape Halloween 2026 on ${day === 1 ? "Friday, October 30" : "Saturday, October 31"}. ` +
         `Stage and set time are not published yet — Insomniac posts the schedule in the days before the festival.`,
    provisional: true,
  });

  const ARTISTS = [
    // ─────────── Friday, October 30 (42 acts) ───────────
    mk("esc-a-little-sound-d1", "A Little Sound", 1),
    mk("esc-adam-ten-d1", "Adam Ten", 1),
    mk("esc-all-the-reason-d1", "All The Reason", 1),
    mk("esc-anime-no-boundaries-d1", "AniMe - No Boundaries", 1),
    mk("esc-azyr-d1", "Azyr", 1),
    mk("esc-benny-benassi-d1", "Benny Benassi", 1),
    mk("esc-cascada-d1", "Cascada", 1),
    mk("esc-cera-khin-d1", "Cera Khin", 1),
    mk("esc-clara-cuv-d1", "Clara Cuvé", 1),
    mk("esc-cloonee-d1", "Cloonee", 1),
    mk("esc-coone-b2b-dj-isaac-d1", "Coone B2B DJ Isaac", 1),
    mk("esc-cyclops-d1", "Cyclops", 1),
    mk("esc-darren-styles-d1", "Darren Styles", 1),
    mk("esc-dimitri-vegas-and-like-mike-d1", "Dimitri Vegas & Like Mike", 1),
    mk("esc-discovery-project-d1", "Discovery Project", 1),
    mk("esc-dj-tennis-d1", "DJ Tennis", 1),
    mk("esc-excision-d1", "Excision", 1),
    mk("esc-frontliner-journey-set-d1", "Frontliner (Journey Set)", 1),
    mk("esc-gammer-d1", "Gammer", 1),
    mk("esc-getter-d1", "Getter", 1),
    mk("esc-hershe-d1", "HerShe", 1),
    mk("esc-jamie-jones-b2b-franky-rizardo-d1", "Jamie Jones B2B Franky Rizardo", 1),
    mk("esc-joseph-capriati-b2b-sosa-d1", "Joseph Capriati B2B Sosa", 1),
    mk("esc-kqd-presents-kill-the-kid-d1", "k?d presents: Kill The Kid", 1),
    mk("esc-kai-wachi-d1", "Kai Wachi", 1),
    mk("esc-kana-hishiya-d1", "Kana Hishiya", 1),
    mk("esc-kloud-d1", "Kloud", 1),
    mk("esc-kream-d1", "KREAM", 1),
    mk("esc-lady-faith-b2b-lny-tnz-d1", "Lady Faith B2B LNY TNZ", 1),
    mk("esc-level-up-d1", "Level Up", 1),
    mk("esc-mish-d1", "Mish", 1),
    mk("esc-modal-nodes-d1", "MODAL NODES", 1),
    mk("esc-morelia-d1", "Morelia", 1),
    mk("esc-morten-d1", "MORTEN", 1),
    mk("esc-nervo-d1", "Nervo", 1),
    mk("esc-pixie-dust-d1", "Pixie Dust", 1),
    mk("esc-showtek-hardstyle-set-d1", "Showtek (Hardstyle Set)", 1),
    mk("esc-silvie-loto-d1", "Silvie Loto", 1),
    mk("esc-steve-aoki-d1", "Steve Aoki", 1),
    mk("esc-trancemaster-krause-d1", "Trancemaster Krause", 1),
    mk("esc-trym-d1", "Trym", 1),
    mk("esc-ydg-d1", "YDG", 1),
    // ─────────── Saturday, October 31 (41 acts) ───────────
    mk("esc-999999999-d2", "999999999", 2),
    mk("esc-ac-slater-d2", "AC Slater", 2),
    mk("esc-acyan-d2", "Acyan", 2),
    mk("esc-adventure-club-d2", "Adventure Club", 2),
    mk("esc-alex-chapman-b2b-zoe-gitter-d2", "Alex Chapman B2B Zoe Gitter", 2),
    mk("esc-alok-d2", "Alok", 2),
    mk("esc-andruss-b2b-juos-d2", "Andruss B2B Juos", 2),
    mk("esc-avalon-emerson-d2", "Avalon Emerson", 2),
    mk("esc-bou-d2", "Bou", 2),
    mk("esc-cat-and-maomi-d2", "Cat & Maomi", 2),
    mk("esc-champion-d2", "Champion", 2),
    mk("esc-chrysalis-d2", "Chrysalis", 2),
    mk("esc-dabin-d2", "Dabin", 2),
    mk("esc-disco-lines-d2", "Disco Lines", 2),
    mk("esc-dj-heartstring-d2", "DJ Heartstring", 2),
    mk("esc-dr-fresch-d2", "Dr. Fresch", 2),
    mk("esc-ero808-d2", "ero808", 2),
    mk("esc-funk-assault-d2", "Funk Assault", 2),
    mk("esc-galantis-d2", "Galantis", 2),
    mk("esc-ian-asher-d2", "Ian Asher", 2),
    mk("esc-ice-cube-d2", "Ice Cube", 2),
    mk("esc-indira-paganotto-d2", "Indira Paganotto", 2),
    mk("esc-jon-casey-d2", "Jon Casey", 2),
    mk("esc-joyryde-sunset-set-d2", "JOYRYDE (Sunset Set)", 2),
    mk("esc-jsmn-d2", "JSMN", 2),
    mk("esc-know-good-d2", "Know Good", 2),
    mk("esc-liquid-stranger-d2", "Liquid Stranger", 2),
    mk("esc-lumi-d2", "LUMI", 2),
    mk("esc-maddix-d2", "Maddix", 2),
    mk("esc-malugi-d2", "MALUGI", 2),
    mk("esc-nina-kraviz-d2", "Nina Kraviz", 2),
    mk("esc-omnom-d2", "OMNOM", 2),
    mk("esc-pedroz-d2", "PEDROZ", 2),
    mk("esc-richie-hawtin-d2", "Richie Hawtin", 2),
    mk("esc-rommii-d2", "Rommii", 2),
    mk("esc-san-pacho-d2", "San Pacho", 2),
    mk("esc-sedef-adas-d2", "Sedef Adasï", 2),
    mk("esc-telykast-d2", "TELYKAST", 2),
    mk("esc-vnssa-b2b-qqqq-d2", "VNSSA B2B ????", 2),
    mk("esc-yanamaste-d2", "Yanamaste", 2),
    mk("esc-zedd-d2", "Zedd", 2),
  ];

  const CONFIG = {
    id:        "escape-halloween-2026",
    name:      "Escape Halloween 2026",
    shortName: "Escape",
    brand:     "Escape",
    tagline:   "Two nights of psycho circus",
    location:  "NOS Events Center · San Bernardino, CA",
    locationShort: "NOS Events Center",
    dates:     "Oct 30–31, 2026",
    year:      2026,
    // Official: "Festival Hours 4PM-2AM". Both nights run 16:00 into 02:00
    // the following morning, so endMs lands on Nov 1.
    startMs: Date.UTC(2026, 9, 30, 23, 0, 0),  // Oct 30 16:00 PDT, gates
    endMs:   Date.UTC(2026, 10, 1,  9, 0, 0),  // Nov 1 02:00 PDT, close of night 2
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    // ⚠ US DST ends 02:00 on Sun Nov 1, 2026 — the exact instant night 2
    // closes. Both festival nights are entirely within PDT (UTC-7), so this
    // offset is correct; endMs above is the unambiguous UTC instant.
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 9, d: 30, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 9, 30, 7, 0, 0) },
      2: { y: 2026, m: 9, d: 31, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 9, 31, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 34.0866,-117.2917, converted to PDT.
    sunTimes: {
      1: { rise: "07:06", set: "17:59" },
      2: { rise: "07:06", set: "17:58" },
    },
    // Polygon centroid of the OSM venue. The grounds are long and narrow
    // (385 × 1174 m), so the radius covers the far ends from the centre.
    gps: { lat: 34.085405, lng: -117.292632, onSiteRadiusMi: 0.5 },
    venue: {
      name:    "NOS Events Center",
      address: "689 S. E St, San Bernardino, CA 92408",
      terrain: "flat fairground — paved lots, exhibition halls and grass",
      // OpenStreetMap way 563078901, all 41 vertices verbatim. 385 × 1174 m.
      // Found by LEGAL name ("National Orange Show & Event Center"), not by
      // the name the festival uses — see the ⛔ note in the header.
      footprint: [
        [34.0919499, -117.2939607], [34.0889253, -117.2939574], [34.0882510, -117.2938318], [34.0880895,
        -117.2938060], [34.0880485, -117.2938228], [34.0875780, -117.2937319], [34.0872993,
        -117.2936883], [34.0869375, -117.2936495], [34.0860440, -117.2936557], [34.0860471,
        -117.2936286], [34.0858136, -117.2936083], [34.0858109, -117.2936386], [34.0855076,
        -117.2935946], [34.0855014, -117.2923447], [34.0839807, -117.2923422], [34.0837217,
        -117.2925021], [34.0827894, -117.2924415], [34.0826157, -117.2926259], [34.0825001,
        -117.2928187], [34.0824426, -117.2929744], [34.0823809, -117.2931736], [34.0823303,
        -117.2934148], [34.0822738, -117.2937917], [34.0819100, -117.2938239], [34.0815023,
        -117.2938256], [34.0814870, -117.2937922], [34.0814855, -117.2929290], [34.0814885,
        -117.2925513], [34.0815218, -117.2925318], [34.0815363, -117.2910087], [34.0815101,
        -117.2910057], [34.0815159, -117.2907388], [34.0823581, -117.2907465], [34.0823682,
        -117.2898196], [34.0861679, -117.2898114], [34.0906740, -117.2897916], [34.0916264,
        -117.2897863], [34.0916275, -117.2904588], [34.0920349, -117.2904585], [34.0920212,
        -117.2938722], [34.0919499, -117.2939607]
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/34.0854,-117.2926",
    // The Big Top is listed first on the official stages page and is the
    // largest structure on the map art. With no artist→stage mapping there
    // is no headliner-based way to confirm it; revisit at the flip.
    mainStageId: "big-top",
    // ── THE MAP ──
    // LAST YEAR'S map, per the founder ruling. See the header before
    // touching any of this.
    mapImage: "escape-2025-map.webp",
    mapStyle: "image-overlay",
    mapTheme: "park",
    mapPrintsStageNames: true,
    mapArtIsGeoregistered: false,
    // Published policy: 18+ entry, 21+ alcohol, no ins-and-outs. NOT
    // cashless — the FAQ says ATMs are available inside and outside.
    policies: { minimumAge: 18, alcoholAge: 21, reentry: false, cashless: false },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["escape-halloween-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // GATED: set times and artist→stage are unpublished, and the map is last
    // year's. Flip when Insomniac drops the schedule (~late Oct).
    registry: { available: false, accent: "#F4511E", emoji: "🎪", region: "North America" },
  };
})();

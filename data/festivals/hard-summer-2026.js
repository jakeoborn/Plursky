// ═══════════════════════════════════════════════════════════════════════
// HARD SUMMER 2026 — Hollywood Park · Inglewood, CA
// Aug 1–2, 2026  ·  ALREADY RAN
// ═══════════════════════════════════════════════════════════════════════
// The first build under the PAST-EDITIONS ruling (Jake, 2026-09-06): for a
// festival that has already happened, an archived grid may be the basis for
// set times. It turned out not to be needed. HARD's own set-times pages are
// still up, so this module is built entirely from OFFICIAL sources and the
// archived grid served only as a cross-check — which is the stronger
// outcome, and the one to try for on every historical build before reaching
// for an archive. CHECK THE OFFICIAL SITE FIRST; a past festival's pages
// are often still live.
//
// SOURCE set times: hardsummer.com/lineup/set-times/day-1/ and /day-2/,
//   read 2026-09-06. Every start/end below is the page's own
//   `data-timestamp-start` / `data-timestamp-end` attribute — machine
//   values, not OCR off a grid image, so there is no transcription risk.
//   ⚠ Those epochs encode LOCAL WALL-CLOCK AS UTC: Kali Uchis reads
//   1785617760 = 2026-08-01T20:56Z, and the page renders it "08:56 PM".
//   Read them with a UTC formatter and you get the local time directly.
//   Convert them to real PDT instants and every set shifts 7 hours.
// SOURCE stages: the same two pages — seven `set-list__stage` headings,
//   in the order HARD, HARDER, Green, Purple, Pink, Ice Cream Truck,
//   Beatbox Art Car. Same seven both days.
// SOURCE venue + hours + policy: hardsummer.com/info/, read 2026-09-06 —
//   "Hollywood Park adjacent to SoFi Stadium", "1011 Stadium Dr, Inglewood,
//   CA 90305", both days "starts at 2PM · ends at 10PM", "You must be 18+
//   to enter and 21+ for alcohol/VIP", NO re-entry, NO camping, cashless,
//   rain or shine.
// SOURCE venue polygon: OpenStreetMap way 34007147, via Overpass
//   2026-09-06. All 93 surveyed vertices verbatim.
// SOURCE sun times: api.sunrise-sunset.org at the OSM polygon centroid,
//   2026-09-06, converted to PDT.
//
// ── CROSS-CHECK AGAINST THE ARCHIVE, AND WHY OFFICIAL WON ──
// The Setline archive (setlineapp.com, pulled 2026-09-06) carries 88 acts
// against the official 91, and it is WRONG in a way that matters:
//   • Sunday HARDER is SHIFTED BY ONE SLOT. Setline omits KsoFresKo (the
//     14:00 opener) and then fills 17:20–18:30 with "Andy C", who is not on
//     the official grid at all. Everything between moves up one billing:
//     Setline's Canary Yellow 14:00 is officially 15:00, its FIFI 15:00 is
//     officially 16:10, its Oppidan 16:10 is officially 17:20. After
//     Midnight and RL Grime are each off by 10 minutes on top of that.
//   • Saturday is short three sets — two on Green, one on Pink.
//   • B2B billings are split: official "Interplanetary Criminal B2B Main
//     Phase", "X CLUB. B2B ATRIP" and "DJ Seinfeld B2B Luuk van Dijk" are
//     separate acts there; "Shygirl presents Club Shy" is just "Shygirl";
//     "DJ Snake (Hip Hop Set)" loses its set type.
// Every one of those resolves to the official page. The remaining 84 acts
// agree act-for-act. ⛔ Do not "restore" Andy C, and do not reconcile any
// name below toward the archive — the archive is the thing that is wrong.
//
// ── NAME CASING IS OFFICIAL, NOT NORMALISED ──
// Unlike Portola and CRSSD (whose only lineup artifact is all-caps poster
// type), HARD publishes artist names as HTML text with authored casing.
// "underscores", "debbiesthuglife" and "fun2bjane" are lowercase on the
// official page; "FIFI", "BOLO", "SHAKING", "DREYA V" and "FLABBERGAST"
// are uppercase there. Both are verbatim. Do not title-case either group.
//
// ⛔ THE SEARCH THAT FAILS — AND DID FAIL HERE FIRST. The official 2026
// patron map EXISTS, at hardsummer.com/info/festival-map/. It is NOT LINKED
// FROM ANY NAV MENU: the Info dropdown lists Info & Hours, Bag Policy,
// Anti-Theft, Acceptable Items, Lost & Found, Health & Wellness and
// Accessibility, and stops. The first pass of this module walked the nav and
// the homepage links, found nothing, and wrote "no map exists" into this
// header — the same shape of mistake as the Pier 80 OSM lookup in
// portola-2026.js: a search bug reported as a data gap.
//   ✅ THE CHECK THAT WORKS: read /wp-sitemap.xml. Every page is enumerated
//   there whether or not anything links to it. Do that BEFORE concluding a
//   festival publishes no map, on this site and on every other one.
//   THE MAP: hsmf_2026_de_festival_map_1080x1350_r04.png on the site's own
//   CDN, uploaded 2026-07-27 — five days before doors, i.e. released for the
//   edition, which under the map ruling (Jake: "each edition ships its own
//   map once it's officially released; until release week, fall back to last
//   year's map") is the map this festival should carry.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-09-06, do not fabricate) ──
// STAGE POSITIONS: not read yet — see SPATIAL MODEL for why this build
//   ships without them rather than guessing at them from the map.
// STAGE COLOURS: absent FROM THE WEB PAGES — the set-times stylesheet is
//   monochrome (#000 / #fff / #7f7f7f) and the only brand colour on it is
//   the link red #E51D1D. The patron map DOES print the three lettered
//   stages' names in their own colours (Green green, Pink pink, Purple
//   purple), which corroborates the name-derived colours in STAGES; it
//   assigns no colour to HARD, HARDER or either art car. See STAGES.
// AMENITIES: PUBLISHED, and not yet transcribed. The patron map carries a
//   24-entry legend (first aid, water, restrooms, ADA viewing, lockers,
//   charge stations, box office, info, cash exchange, ID check, wifi, photo
//   ops, merch, food, bars, VIP variants…) and places roughly a hundred
//   icons on the site. This build ships AMENITIES empty because reading a
//   hundred pins is its own pass, not because none exist — do not record
//   this festival as having no amenity data.
//
// ── SPATIAL MODEL ──
// `mapStyle: "image-overlay"` over the official 2026 patron map, with all
// seven stages registered to it. LAYOUT ONLY: no gpsAnchors, MAP_AFFINE
// null, and the v257/v260 gate therefore still suppresses every distance
// and walk-time readout. A stage's position on this artwork is a position
// on ARTWORK; it is not a measurement of the ground.
//
// HOW THE SEVEN x/y WERE READ. Each pin is the STAGE STRUCTURE on the
// artwork, not its text label — the labels sit out in the crowd areas and
// are offset by up to 6 grid units, so registering to them would have put
// every pin in the wrong place. Method: crop the panel, overlay a 1-unit
// grid, zoom each stage to ~4x, read the structure's bounding box, take its
// centre; then re-render all seven pins back onto the map and confirm each
// one lands on its own structure. The last step is the one that matters —
// it caught four pins sitting beside their stages rather than on them.
//
// ⚠ venue.footprint is THE WHOLE DISTRICT (297 acres — OSM's
// "Los Angeles Stadium and Entertainment District at Hollywood Park",
// wikidata Q49502455), which contains SoFi Stadium, the Kia Forum and the
// Intuit Dome. HARD Summer occupies the open grounds NEXT TO the stadium,
// a subset of it. Same caveat as III Points and Portola: this is the only
// surveyed polygon that exists, so it is a WEAK bound — it will not catch
// an anchor typo'd onto the stadium roof. Tighten it only from an official
// map, never by estimating.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// gpsAnchors: NONE. Not T3, not provisional, ABSENT.
//
// ── AVAILABLE: TRUE, ON PURPOSE ──
// This ships live rather than gated. Gating exists to hold a build back
// until its set times are real; these are real, official, and the festival
// is over — there is nothing left to wait for. It matches the wave-1 five
// (Summerfest, Gov Ball, Ultra, Lolla, Outside Lands), which are likewise
// finished 2026 editions shipping live, and it is the point of the
// back-catalogue ruling. One line in `registry` reverses it.
(function () {
  "use strict";

  // ⚠ NO x/y ON ANY STAGE — see SPATIAL MODEL in the header. Real stages,
  // unknown positions; not stages awaiting tidy-up.
  //
  // COLOURS. HARD publishes none, so these split into two honest groups and
  // the split is worth keeping straight:
  //   • Green / Pink / Purple — the stage's own official NAME *is* a colour.
  //     These three are read off the name, not chosen.
  //   • HARD / HARDER / Ice Cream Truck / Beatbox Art Car — no published
  //     colour exists. These are APP-SIDE UI TOKENS, nothing more. HARD
  //     takes the brand red #E51D1D sampled from hardsummer.com's own
  //     stylesheet; the other three are chosen to stay distinguishable from
  //     the four above. If HARD ever publishes stage colours, replace all
  //     four — and leave the first three alone.
  //
  // `desc` stays factual. HARD publishes no stage blurbs, so nothing here
  // characterises a stage's genre — "Art car" is a description of the
  // structure, which the stage's own name states.
  const STAGES = [
    { id: "hard",     name: "HARD",            short: "HARD",    color: "#E51D1D", size: 1.6,
      x: 14.2, y: 5.5,
      desc: "Main stage" },
    { id: "harder",   name: "HARDER",          short: "HARDER",  color: "#F97316", size: 1.5,
      x: 35.9, y: 84.0,
      desc: "Second stage" },
    { id: "green",    name: "Green",           short: "GREEN",   color: "#3FA34D", size: 1.3,
      x: 13.2, y: 37.0,
      desc: "" },
    { id: "purple",   name: "Purple",          short: "PURPLE",  color: "#8B5CF6", size: 1.3,
      x: 42.9, y: 8.0,
      desc: "" },
    { id: "pink",     name: "Pink",            short: "PINK",    color: "#EC4899", size: 1.3,
      x: 52.7, y: 8.0,
      desc: "" },
    { id: "icecream", name: "Ice Cream Truck", short: "TRUCK",   color: "#38BDF8", size: 0.9,
      x: 41.9, y: 37.0,
      desc: "Art car" },
    { id: "beatbox",  name: "Beatbox Art Car", short: "BEATBOX", color: "#FACC15", size: 0.9,
      x: 62.5, y: 57.0,
      desc: "Art car" },
  ];

  // Empty pending transcription, NOT because none are published — the
  // official map has a 24-entry legend and ~100 placed icons. See header.
  const AMENITIES = [];

  // Real stage, real day, REAL SET TIMES off the official grid. `tier` is
  // derived from the start hour exactly as the other timed festivals do it.
  // No `provisional` flag: nothing here is a placeholder.
  const mk = (id, name, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 19 ? 3 : h >= 16 ? 2 : 1;
    return { id, name, genre: "—", country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a0a1a)`,
      bio: `Played HARD Summer 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage.` };
  };

  const ARTISTS = [
    // ═══════ DAY 1 · Saturday Aug 1 ═══════
    // HARD
    mk("hs1-quinn-blake",                       "Quinn Blake",                                   "hard",      1, "14:00", "15:00"),
    mk("hs1-bushbaby",                          "Bushbaby",                                      "hard",      1, "15:00", "16:10"),
    mk("hs1-bolo",                              "BOLO",                                          "hard",      1, "16:15", "17:20"),
    mk("hs1-chris-lorenzo",                     "Chris Lorenzo",                                 "hard",      1, "17:25", "18:45"),
    mk("hs1-mau-p",                             "Mau P",                                         "hard",      1, "18:45", "20:15"),
    mk("hs1-kali-uchis",                        "Kali Uchis",                                    "hard",      1, "20:56", "22:00"),
    // HARDER
    mk("hs1-shaking",                           "SHAKING",                                       "harder",    1, "14:00", "15:00"),
    mk("hs1-jon-casey",                         "Jon Casey",                                     "harder",    1, "15:00", "16:00"),
    mk("hs1-mary-droppinz",                     "Mary Droppinz",                                 "harder",    1, "16:00", "17:10"),
    mk("hs1-rz",                                "RØZ",                                           "harder",    1, "17:10", "18:25"),
    mk("hs1-tokischa",                          "Tokischa",                                      "harder",    1, "18:35", "19:20"),
    mk("hs1-brutalismus-3000",                  "Brutalismus 3000",                              "harder",    1, "19:35", "20:35"),
    mk("hs1-charlotte-de-witte",                "Charlotte de Witte",                            "harder",    1, "20:45", "22:00"),
    // Green
    mk("hs1-dj-warning",                        "DJ Warning",                                    "green",     1, "14:00", "15:00"),
    mk("hs1-lovefoxy",                          "Lovefoxy",                                      "green",     1, "15:00", "16:00"),
    mk("hs1-x-club-b2b-atrip",                  "X CLUB. B2B ATRIP",                             "green",     1, "16:00", "17:30"),
    mk("hs1-pegassi",                           "Pegassi",                                       "green",     1, "17:30", "18:30"),
    mk("hs1-anetha",                            "Anetha",                                        "green",     1, "18:30", "19:30"),
    mk("hs1-hannah-laing",                      "Hannah Laing",                                  "green",     1, "19:30", "20:45"),
    mk("hs1-interplanetary-criminal-b2b-main-p", "Interplanetary Criminal B2B Main Phase",        "green",     1, "20:45", "22:00"),
    // Purple
    mk("hs1-cquestt",                           "Cquestt",                                       "purple",    1, "14:00", "15:00"),
    mk("hs1-nick-leon",                         "Nick León",                                     "purple",    1, "15:00", "16:00"),
    mk("hs1-six-sex",                           "Six Sex",                                       "purple",    1, "16:10", "16:50"),
    mk("hs1-confidence-man",                    "Confidence Man",                                "purple",    1, "17:10", "18:00"),
    mk("hs1-salute",                            "salute",                                        "purple",    1, "18:10", "19:30"),
    mk("hs1-zack-fox",                          "Zack Fox",                                      "purple",    1, "19:30", "20:45"),
    mk("hs1-u-uk-uk1mat-u",                     "¥ØU$UK€ ¥UK1MAT$U",                             "purple",    1, "20:45", "22:00"),
    // Pink
    mk("hs1-dreya-v",                           "DREYA V",                                       "pink",      1, "14:00", "15:00"),
    mk("hs1-brunello",                          "Brunello",                                      "pink",      1, "15:00", "16:00"),
    mk("hs1-locklead",                          "Locklead",                                      "pink",      1, "16:00", "17:00"),
    mk("hs1-luke-alessi",                       "Luke Alessi",                                   "pink",      1, "17:00", "18:00"),
    mk("hs1-omar",                              "Omar+",                                         "pink",      1, "18:00", "19:00"),
    mk("hs1-dj-seinfeld-b2b-luuk-van-dijk",     "DJ Seinfeld B2B Luuk van Dijk",                 "pink",      1, "19:00", "20:30"),
    mk("hs1-maceo-plex",                        "Maceo Plex",                                    "pink",      1, "20:30", "22:00"),
    // Ice Cream Truck
    mk("hs1-naomi-green",                       "Naomi Green",                                   "icecream",  1, "14:00", "15:00"),
    mk("hs1-gay-felony",                        "Gay Felony",                                    "icecream",  1, "15:00", "16:00"),
    mk("hs1-debbiesthuglife",                   "debbiesthuglife",                               "icecream",  1, "16:00", "17:30"),
    mk("hs1-mesme",                             "Mesmé",                                         "icecream",  1, "17:30", "19:00"),
    mk("hs1-lake-hills-b2b-nyx",                "Lake Hills B2B Ønyx",                           "icecream",  1, "19:00", "20:30"),
    mk("hs1-capes",                             "Capes",                                         "icecream",  1, "20:30", "22:00"),
    // Beatbox Art Car
    mk("hs1-montique",                          "Montique",                                      "beatbox",   1, "14:00", "15:00"),
    mk("hs1-sim-ivy",                           "Sim Ivy",                                       "beatbox",   1, "15:00", "16:00"),
    mk("hs1-small-danny-g-luvs-u-b2b-bori",     "Small (danny g luvs u B2B Bori)",               "beatbox",   1, "16:00", "17:30"),
    mk("hs1-dj-kita",                           "DJ Kita",                                       "beatbox",   1, "17:30", "19:00"),
    mk("hs1-spinorita",                         "Spiñorita",                                    "beatbox",   1, "19:00", "20:30"),
    mk("hs1-dj-blackmarket",                    "DJ Blackmarket",                                "beatbox",   1, "20:30", "22:00"),
    // ═══════ DAY 2 · Sunday Aug 2 ═══════
    // HARD
    mk("hs2-strawbry",                          "Strawbry",                                      "hard",      2, "14:00", "15:05"),
    mk("hs2-1tbsp",                             "1tbsp",                                         "hard",      2, "15:05", "16:20"),
    mk("hs2-hyperbeam",                         "Hyperbeam",                                     "hard",      2, "16:20", "17:50"),
    mk("hs2-snow-strippers",                    "Snow Strippers",                                "hard",      2, "18:05", "18:40"),
    mk("hs2-sammy-virji",                       "Sammy Virji",                                   "hard",      2, "19:00", "20:15"),
    mk("hs2-knock2-b2b-zedd",                   "Knock2 B2B Zedd",                               "hard",      2, "20:45", "22:00"),
    // HARDER
    mk("hs2-ksofresko",                         "KsoFresKo",                                     "harder",    2, "14:00", "15:00"),
    mk("hs2-canary-yellow",                     "Canary Yellow",                                 "harder",    2, "15:00", "16:10"),
    mk("hs2-fifi",                              "FIFI",                                          "harder",    2, "16:10", "17:20"),
    mk("hs2-oppidan",                           "Oppidan",                                       "harder",    2, "17:20", "18:30"),
    mk("hs2-after-midnight",                    "After Midnight",                                "harder",    2, "18:30", "20:00"),
    mk("hs2-rl-grime",                          "RL Grime",                                      "harder",    2, "20:00", "21:00"),
    mk("hs2-dj-snake-hip-hop-set",              "DJ Snake (Hip Hop Set)",                        "harder",    2, "21:00", "22:00"),
    // Green
    mk("hs2-etari",                             "Etari",                                         "green",     2, "14:00", "15:00"),
    mk("hs2-dj-fuckoff",                        "DJ Fuckoff",                                    "green",     2, "15:00", "16:00"),
    mk("hs2-alarico-b2b-yanamaste",             "Alarico B2B Yanamaste",                         "green",     2, "16:00", "17:30"),
    mk("hs2-adiel-b2b-quest",                   "Adiel B2B Quest",                               "green",     2, "17:30", "19:30"),
    mk("hs2-vtss",                              "VTSS",                                          "green",     2, "19:30", "20:45"),
    mk("hs2-amelie-lens",                       "Amelie Lens",                                   "green",     2, "20:45", "22:00"),
    // Purple
    mk("hs2-fun2bjane",                         "fun2bjane",                                     "purple",    2, "14:00", "14:45"),
    mk("hs2-10cust",                            "10cust",                                        "purple",    2, "14:45", "15:40"),
    mk("hs2-underscores",                       "underscores",                                   "purple",    2, "15:50", "16:30"),
    mk("hs2-frost-children",                    "Frost Children",                                "purple",    2, "16:40", "17:35"),
    mk("hs2-mcr-t",                             "MCR-T",                                         "purple",    2, "17:40", "18:40"),
    mk("hs2-shygirl-presents-club-shy",         "Shygirl presents Club Shy",                     "purple",    2, "18:40", "19:40"),
    mk("hs2-2hollis",                           "2hollis",                                       "purple",    2, "19:50", "20:35"),
    mk("hs2-b3k-b2b-boys-noize",                "B3K B2B Boys Noize",                            "purple",    2, "20:50", "22:00"),
    // Pink
    mk("hs2-cole-terrazas",                     "Cole Terrazas",                                 "pink",      2, "14:00", "15:00"),
    mk("hs2-miluhska",                          "Miluhska",                                      "pink",      2, "15:00", "16:00"),
    mk("hs2-ranger-trucco",                     "Ranger Trucco",                                 "pink",      2, "16:00", "17:30"),
    mk("hs2-miguelle-tons",                     "Miguelle & Tons",                               "pink",      2, "17:30", "19:00"),
    mk("hs2-tiga",                              "Tiga",                                          "pink",      2, "19:00", "20:30"),
    mk("hs2-vintage-culture",                   "Vintage Culture",                               "pink",      2, "20:30", "22:00"),
    // Ice Cream Truck
    mk("hs2-adult-hits",                        "Adult Hits",                                    "icecream",  2, "14:00", "15:00"),
    mk("hs2-bahar-khadem",                      "Bahar Khadem",                                  "icecream",  2, "15:00", "16:00"),
    // Official lineup card bills "Samwise (TX)"; the official set-time page
    // prints "Samwise". Preserve schedule billing and carry the card alias.
    { ...mk("hs2-samwise", "Samwise", "icecream", 2, "16:00", "17:30"),
      officialLineupAliases: ["Samwise (TX)"] },
    mk("hs2-bianca-oblivion-b2b-star-eyes",     "Bianca Oblivion B2B Star Eyes",                 "icecream",  2, "17:30", "19:00"),
    mk("hs2-mez-monty-b2b-shane-thomas",        "Mez Monty B2B Shane Thomas",                    "icecream",  2, "19:00", "20:30"),
    mk("hs2-oscar-osorio",                      "Oscar Osorio",                                  "icecream",  2, "20:30", "22:00"),
    // Beatbox Art Car
    mk("hs2-chloe404-b2b-kyle-arthur",          "Chloe404 B2B Kyle Arthur",                      "beatbox",   2, "14:00", "15:00"),
    mk("hs2-edge-control",                      "Edge Control",                                  "beatbox",   2, "15:00", "16:00"),
    mk("hs2-cerulo",                            "Cerulo",                                        "beatbox",   2, "16:00", "17:30"),
    mk("hs2-lily-ardalan",                      "Lily Ardalan",                                  "beatbox",   2, "17:30", "19:00"),
    mk("hs2-pitchblack",                        "PITCHBLACK",                                    "beatbox",   2, "19:00", "20:30"),
    mk("hs2-flabbergast",                       "FLABBERGAST",                                   "beatbox",   2, "20:30", "22:00"),
  ];

  const CONFIG = {
    id:        "hard-summer-2026",
    // From the SOURCE note above: hardsummer.com/lineup/set-times/day-1/ + /day-2/, read 2026-09-06. Feeds /f/<id>/schedule.json.
    scheduleSource: { url: "https://hardsummer.com/lineup/set-times/day-1/", observedAt: "2026-09-06", official: true },
    name:      "HARD Summer 2026",
    shortName: "HARD Summer",
    brand:     "HARD",
    tagline:   "Two days of stacked lineups next door to SoFi Stadium",
    location:  "Hollywood Park · Inglewood, CA",
    locationShort: "Hollywood Park",
    dates:     "Aug 1–2, 2026",
    year:      2026,
    officialStages: ["HARD", "HARDER", "Green", "Purple", "Pink", "Ice Cream Truck", "Beatbox Art Car"],
    officialEvent: {
      website: "https://www.hardsummer.com/",
      tickets: "https://www.hardsummer.com/tickets/",
      observedAt: "2026-09-10",
    },
    // Official /info/: both days "starts at 2PM · ends at 10PM". California
    // is PDT (UTC-7) in August. The grid agrees exactly — every stage's
    // first set starts 14:00 and every last set ends 22:00, both days — so
    // these bounds are measured twice, not assumed once.
    startMs: Date.UTC(2026, 7, 1, 21, 0, 0),  // Aug 1 14:00 PDT, gates
    endMs:   Date.UTC(2026, 7, 3,  5, 0, 0),  // Aug 2 22:00 PDT, last set ends
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 7, d: 1, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 7, 1, 7, 0, 0) },
      2: { y: 2026, m: 7, d: 2, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 7, 2, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 33.950875,-118.338027, converted to PDT.
    // Nothing runs after 22:00, so every set on both days ends after dark.
    sunTimes: {
      1: { rise: "06:03", set: "19:55" },
      2: { rise: "06:04", set: "19:54" },
    },
    // Polygon centroid of the OSM district. The radius covers the whole
    // 1344 × 1227 m district (half-diagonal ≈ 0.57 mi), because the
    // festival's own perimeter inside it is not published.
    gps: { lat: 33.950875, lng: -118.338027, onSiteRadiusMi: 0.6 },
    venue: {
      name:    "Hollywood Park",
      address: "1011 Stadium Dr, Inglewood, CA 90305",
      terrain: "paved lots and open grounds beside SoFi Stadium",
      // OpenStreetMap way 34007147 — "Los Angeles Stadium and Entertainment
      // District at Hollywood Park", all 93 vertices verbatim. 1,200,848 m²
      // (296.7 acres), 1344 m E–W × 1227 m N–S.
      //
      // This is the DISTRICT, not the festival perimeter. Read the ⚠ in the
      // header before treating it as a tight bound.
      footprint: [
        [33.94564, -118.33395], [33.94564, -118.34000], [33.94564, -118.34173], [33.94564, -118.34205],
        [33.94564, -118.34372], [33.94569, -118.34377], [33.94716, -118.34378], [33.94718, -118.34377],
        [33.94726, -118.34374], [33.94728, -118.34374], [33.94775, -118.34373], [33.94779, -118.34368],
        [33.94789, -118.34369], [33.94798, -118.34369], [33.94803, -118.34374], [33.94893, -118.34374],
        [33.94927, -118.34378], [33.95134, -118.34378], [33.95286, -118.34374], [33.95290, -118.34380],
        [33.95331, -118.34380], [33.95332, -118.34380], [33.95334, -118.34380], [33.95345, -118.34376],
        [33.95346, -118.34376], [33.95347, -118.34376], [33.95402, -118.34377], [33.95406, -118.34372],
        [33.95433, -118.34376], [33.95437, -118.34380], [33.95525, -118.34380], [33.95543, -118.34380],
        [33.95588, -118.34380], [33.95591, -118.34380], [33.95600, -118.34377], [33.95602, -118.34377],
        [33.95638, -118.34377], [33.95660, -118.34376], [33.95662, -118.34376], [33.95663, -118.34375],
        [33.95664, -118.34373], [33.95665, -118.34372], [33.95665, -118.34371], [33.95666, -118.34369],
        [33.95666, -118.34367], [33.95666, -118.34332], [33.95666, -118.34320], [33.95666, -118.34300],
        [33.95665, -118.34281], [33.95664, -118.34263], [33.95663, -118.34244], [33.95661, -118.34226],
        [33.95658, -118.34208], [33.95656, -118.34191], [33.95652, -118.34174], [33.95650, -118.34163],
        [33.95645, -118.34134], [33.95641, -118.34104], [33.95641, -118.34100], [33.95639, -118.34080],
        [33.95637, -118.34060], [33.95636, -118.34035], [33.95635, -118.34010], [33.95632, -118.34006],
        [33.95632, -118.34002], [33.95631, -118.33991], [33.95631, -118.33988], [33.95634, -118.33986],
        [33.95634, -118.33984], [33.95634, -118.33981], [33.95634, -118.33894], [33.95634, -118.33884],
        [33.95633, -118.33782], [33.95632, -118.33771], [33.95631, -118.33746], [33.95619, -118.33648],
        [33.95616, -118.33624], [33.95613, -118.33599], [33.95611, -118.33575], [33.95610, -118.33551],
        [33.95608, -118.33523], [33.95272, -118.33525], [33.95273, -118.33088], [33.95247, -118.32980],
        [33.95224, -118.32930], [33.95222, -118.32926], [33.94880, -118.32925], [33.94880, -118.32939],
        [33.94882, -118.32939], [33.94882, -118.33088], [33.94898, -118.33186], [33.94898, -118.33400],
        [33.94898, -118.33482]
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/33.9509,-118.3380",
    // HARD is first on both official grids and carries Kali Uchis (Sat) and
    // Knock2 B2B Zedd (Sun). It is also the festival's own name.
    mainStageId: "hard",
    // ── THE MAP ──
    // hard-summer-2026.webp = the OFFICIAL 2026 patron map
    // (hsmf_2026_de_festival_map_1080x1350_r04.png, HARD's own CDN, uploaded
    // 2026-07-27), processed for the app exactly the way acl-park.webp was:
    // the poster's title band and the 24-entry legend are cropped away and
    // only the map panel is kept.
    //
    // ⚠ THE CROP IS LOAD-BEARING. Panel = source pixels x 128..953,
    // y 212..1037 — 826 × 826, square on purpose, because the image-overlay
    // branch draws at x=0 y=0 w=100 h=100 with preserveAspectRatio
    // "xMidYMid slice". A non-square asset gets side-cropped and every stage
    // x/y below silently shifts. Re-crop the source and you MUST re-register
    // all seven stages. Same rule that bit acl-park.webp.
    mapImage: "hard-summer-2026.webp",
    mapStyle: "image-overlay",
    mapTheme: "park",
    // The artwork prints all seven stage names in display type, so the app
    // must not draw its own labels on top of them.
    mapPrintsStageNames: true,
    // Stylised art, not a projection: no affine, no gpsAnchors, MAP_AFFINE
    // stays null and the v257/v260 gate keeps suppressing distance readouts.
    // Stage x/y are LAYOUT ONLY — read off this artwork, never converted to
    // world coordinates. That is the EDC poster mistake and it stays unmade.
    mapArtIsGeoregistered: false,
    // Published policy: 18+ entry, 21+ alcohol/VIP, no re-entry, no camping,
    // cashless, rain or shine.
    policies: { minimumAge: 18, alcoholAge: 21, reentry: false, cashless: true },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["hard-summer-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // LIVE. See "AVAILABLE: TRUE, ON PURPOSE" in the header.
    registry: { available: true, accent: "#E51D1D", emoji: "🔥", region: "North America" },
  };
})();

// ═══════════════════════════════════════════════════════════════════════
// PORTOLA 2026 — Pier 80 · San Francisco, CA
// Sep 26–27, 2026
// ═══════════════════════════════════════════════════════════════════════
// The most COMPLETE gated build in the repo: real stages, real day split,
// and REAL SET TIMES. The only thing missing is the site map, so this ships
// gated with `mapMode: "real"` and nothing invented.
//
// SOURCE set times: portolamusicfestival.com/set-times — the two official
//   grid images, 2026-Portola-SetTimes-Saturday.jpg and -Sunday.jpg,
//   read 2026-09-06. Every start/end below is off those grids.
// SOURCE stages + day split: the SAME page's four per-stage lineup posters
//   (warehouse-26.jpg, crane-stage-26.jpg, ship-tent-26.jpg,
//   pier-stage-26.jpg), read independently of the grids.
//   ✓ CROSS-CHECKED: the posters and the grids agree act-for-act on all
//   four stages across both days — 63 acts, zero orphans in either
//   direction. Two independent official artifacts, one answer.
//   ⚠ DESPACIO appears ONLY on the set-time grids, never on a poster,
//   because it has no lineup — it IS the act (the mirrorball soundsystem,
//   one continuous set per day). That makes FIVE stages, not four. Do not
//   "correct" this down to the four that have posters.
// SOURCE stage COLOURS: sampled from the poster backgrounds themselves —
//   #DFB930 Warehouse, #DE6A2F Crane, #2B5223 Ship Tent, #2C4096 Pier.
//   Despacio has no poster and therefore no official colour; see below.
// SOURCE hours + policy: portolamusicfestival.com/general-info, read
//   2026-09-06 — "Venue doors open at 1pm PT both days", "You must be 21
//   years or older", "No Re-Entry", cashless, no parking, rain or shine.
// SOURCE venue: OpenStreetMap way 24311406, via Overpass 2026-09-06.
// SOURCE sun times: api.sunrise-sunset.org at the OSM centroid, 2026-09-06.
//
// ⛔ THE OSM LOOKUP THAT FAILS. Searching OSM for a feature NAMED "Pier 80"
// returns NOTHING — not by name, not through Nominatim, not in a 3 km box.
// The pier shed is tagged `addr:housenumber: "Pier 80"` with no `name` at
// all. A future session that concludes "Pier 80 is not in OSM" and reaches
// for an estimated centroid will be repeating a search bug, not finding a
// data gap. Query by address, or by way id 24311406.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-09-06, do not fabricate) ──
// SITE MAP: absent. The festival-info template still carries a "Festival
//   Maps" heading, but it is inside an HTML comment — built and not yet
//   switched on. No map image exists under the site's 2026 asset prefix.
// STAGE POSITIONS: absent, and therefore not here. See SPATIAL MODEL.
//
// ── SPATIAL MODEL ──
// `mapMode: "real"` — real basemap over the surveyed pier, live blue dot,
// venue outline. No stage x/y, no gpsAnchors, no map art.
//
// This one is tempting in a way CRSSD was not: Pier 80's stages have
// obvious homes — Warehouse is inside the shed, Pier Stage is out on the
// apron. Tempting is exactly the failure mode. "Obvious" is not measured,
// and a pin dropped from a plausible reading of an aerial photo is the same
// invented precision PR #36 removed from EDC LV. MAP_AFFINE stays null, the
// v257/v260 gate suppresses every distance and walk-time readout, and the
// blue dot lives on the real-map layer where it is actually true.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// gpsAnchors: NONE. Not T3, not provisional, ABSENT.
//
// ⚠ venue.footprint is THE CARGO SHED (310 × 90 m, 20,674 m²), not the
// festival perimeter. Portola runs across the whole pier apron, which is
// several times larger; the shed is simply the only surveyed polygon that
// exists. Same caveat as III Points. Widen it at the flip, from the
// official map — never by estimating.
//
// ⚠ NAME CASING IS VERBATIM ALL-CAPS, AND THAT IS A KNOWN DEFECT, NOT A
// STYLE CHOICE. Portola publishes NO text lineup anywhere — not on /lineup,
// not on /music, not in any JSON. Every artist name in existence on this
// site is display type on a poster, and that type is uniformly uppercase,
// so it carries ZERO information about authored casing. "EAR" is the artist
// CRSSD's own A–Z tier writes as "ear"; "OSKAR MED K" is their "oskar med
// k"; "UNDERSCORES" and "NIMINO" are lowercase-styled acts. Title-casing
// all 64 would be 64 guesses, and would also destroy the genuine caps
// (FCUKERS, VTSS, MGNA CRRRTA, JT). Verbatim invents nothing, which is the
// only property worth defending here.
//   This is now the SECOND festival with this exact problem (see
//   crssd-fall-2026.js). If a third arrives, the fix belongs at the app
//   layer — a display-casing pass with a stylised-name allowlist — not in
//   another module header.
//
// ⚠ TWO OFFICIAL SPELLINGS, RECONCILED. The Crane Saturday act is
// "ERIKA B2B SF COWBOY" on the stage poster and "ERIKA B2B SFCOWBOY" on the
// grid; the poster's spacing is used. "SG LEWIS" is billed "LIVE" on the
// poster and "(LIVE)" on the grid; the grid's parenthetical is used, to
// match "MELANIE C (DJ SET)". "DOG BLOOD" carries the grid's fuller
// "(SKRILLEX + BOYS NOIZE)" billing.
//
// ── FLIP CHECKLIST (official map, ~days before Sep 26) ──
//   1. STAGES get real lat/lng from the official map, and x/y DERIVED from
//      that lat/lng — never the reverse. Then mapMode can leave "real".
//   2. gpsAnchors once the stages have positions — src "poster" for art
//      reads, "osm" for satellite-measured features. `derived` is banned
//      from the basis.
//   3. Widen venue.footprint from the shed to the real pier perimeter.
//   4. amenities from the official map legend.
//   5. Re-check every set time against the app's own schedule; grids get
//      reissued when a set moves.
//   6. Artist casing, if a text source ever appears.
//   7. registry.available → true — its own PR, founder review (AGENTS.md).
(function () {
  "use strict";

  // Colours are Portola's own, sampled from the four official stage posters.
  // Despacio has no poster and no official colour, so its #A8AEC4 is OURS —
  // a mirrorball silver, chosen, not sourced. Labelled so nobody later
  // treats it as measured.
  //
  // ⚠ NO x/y ON ANY STAGE. See the SPATIAL MODEL note in the header.
  const STAGES = [
    { id: "pier", name: "Pier Stage", short: "PIER", color: "#2C4096", size: 1.6,
      desc: "Main stage · pier apron" },
    { id: "warehouse", name: "Warehouse", short: "WRHSE", color: "#DFB930", size: 1.5,
      desc: "House + techno · inside the shed" },
    { id: "crane", name: "Crane Stage", short: "CRANE", color: "#DE6A2F", size: 1.4,
      desc: "Live + eclectic" },
    { id: "ship", name: "Ship Tent", short: "SHIP", color: "#2B5223", size: 1.2,
      desc: "Club + selectors" },
    { id: "despacio", name: "Despacio", short: "DSPCO", color: "#A8AEC4", size: 1.0,
      desc: "Mirrorball soundsystem · one continuous set" },
  ];

  // No amenity map published — see the header.
  const AMENITIES = [];

  // Real stage, real day, REAL SET TIMES. `tier` is derived from the start
  // hour exactly as the other timed festivals do it, so late sets weight
  // heavier on lineup cards. No `provisional` flag: nothing here is a
  // placeholder.
  const mk = (id, name, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 19 ? 3 : h >= 16 ? 2 : 1;
    return { id, name, genre: "—", country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a0a1a)`,
      bio: `Playing Portola 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage.` };
  };

  const ARTISTS = [
    // ═══════ DAY 1 · Saturday Sep 26 ═══════
    // Pier Stage
    mk("pt1-airwolf-paradise",                    "AIRWOLF PARADISE",                                      "pier",       1, "13:30", "14:30"),
    mk("pt1-gelli-haha",                          "GELLI HAHA",                                            "pier",       1, "14:40", "15:30"),
    mk("pt1-oskar-med-k",                         "OSKAR MED K",                                           "pier",       1, "15:40", "16:30"),
    mk("pt1-fcukers",                             "FCUKERS",                                               "pier",       1, "16:40", "17:30"),
    mk("pt1-tove-lo",                             "TOVE LO",                                               "pier",       1, "17:40", "18:30"),
    mk("pt1-robyn",                               "ROBYN",                                                 "pier",       1, "19:10", "20:10"),
    mk("pt1-dog-blood-skrillex-boys-noize",       "DOG BLOOD (SKRILLEX + BOYS NOIZE)",                     "pier",       1, "21:00", "22:15"),
    // Crane Stage
    mk("pt1-erika-b2b-sf-cowboy",                 "ERIKA B2B SF COWBOY",                                   "crane",      1, "13:30", "15:00"),
    mk("pt1-tricky",                              "TRICKY",                                                "crane",      1, "15:20", "16:10"),
    mk("pt1-nimino",                              "NIMINO",                                                "crane",      1, "16:25", "17:15"),
    mk("pt1-dj-shadow-celebrates-30-years-of-e",  "DJ SHADOW CELEBRATES 30 YEARS OF ENDTRODUCING.....",    "crane",      1, "17:30", "18:30"),
    mk("pt1-skepta",                              "SKEPTA",                                                "crane",      1, "18:45", "19:35"),
    mk("pt1-fatboy-slim",                         "FATBOY SLIM",                                           "crane",      1, "19:55", "21:25"),
    mk("pt1-soulwax",                             "SOULWAX",                                               "crane",      1, "21:55", "22:55"),
    // Warehouse
    mk("pt1-sam-alfred",                          "SAM ALFRED",                                            "warehouse",  1, "13:30", "14:45"),
    mk("pt1-ranger-trucco-b2b-alisha",            "RANGER TRUCCO B2B ALISHA",                              "warehouse",  1, "14:45", "15:45"),
    mk("pt1-chloe-caillet",                       "CHLOÉ CAILLET",                                         "warehouse",  1, "15:45", "16:45"),
    mk("pt1-groove-armada",                       "GROOVE ARMADA",                                         "warehouse",  1, "16:45", "18:00"),
    mk("pt1-max-styler",                          "MAX STYLER",                                            "warehouse",  1, "18:00", "19:15"),
    mk("pt1-kettama",                             "KETTAMA",                                               "warehouse",  1, "19:15", "20:30"),
    mk("pt1-beltran-b2b-ben-sterling",            "BELTRAN B2B BEN STERLING",                              "warehouse",  1, "20:30", "21:45"),
    mk("pt1-prospa",                              "PROSPA",                                                "warehouse",  1, "21:45", "23:00"),
    // Ship Tent
    mk("pt1-felly-fell",                          "FELLY FELL",                                            "ship",       1, "13:40", "14:40"),
    mk("pt1-mgna-crrrta",                         "MGNA CRRRTA",                                           "ship",       1, "14:50", "15:30"),
    mk("pt1-six-sex",                             "SIX SEX",                                               "ship",       1, "15:40", "16:20"),
    mk("pt1-mike-d-5d",                           "MIKE D 5D",                                             "ship",       1, "16:40", "17:30"),
    mk("pt1-jyoty",                               "JYOTY",                                                 "ship",       1, "17:40", "18:40"),
    mk("pt1-bassvictim",                          "BASSVICTIM",                                            "ship",       1, "18:50", "19:40"),
    mk("pt1-jigitz",                              "JIGITZ",                                                "ship",       1, "19:50", "20:40"),
    mk("pt1-nate-sib",                            "NATE SIB",                                              "ship",       1, "20:55", "21:35"),
    mk("pt1-melanie-c-dj-set",                    "MELANIE C (DJ SET)",                                    "ship",       1, "21:50", "22:30"),
    // Despacio
    mk("pt1-despacio",                            "DESPACIO",                                              "despacio",   1, "14:45", "21:45"),
    // ═══════ DAY 2 · Sunday Sep 27 ═══════
    // Pier Stage
    mk("pt2-clearcast",                           "CLEARCAST",                                             "pier",       2, "13:30", "14:20"),
    mk("pt2-mind-enterprises",                    "MIND ENTERPRISES",                                      "pier",       2, "14:30", "15:20"),
    mk("pt2-channel-tres",                        "CHANNEL TRES",                                          "pier",       2, "15:30", "16:20"),
    mk("pt2-sg-lewis-live",                       "SG LEWIS (LIVE)",                                       "pier",       2, "16:30", "17:25"),
    mk("pt2-mochakk",                             "MOCHAKK",                                               "pier",       2, "17:35", "18:35"),
    mk("pt2-zara-larsson",                        "ZARA LARSSON",                                          "pier",       2, "19:05", "20:05"),
    mk("pt2-swedish-house-mafia",                 "SWEDISH HOUSE MAFIA",                                   "pier",       2, "20:45", "22:00"),
    // Crane Stage
    mk("pt2-torren-foot",                         "TORREN FOOT",                                           "crane",      2, "13:30", "14:30"),
    mk("pt2-azzecca",                             "AZZECCA",                                               "crane",      2, "14:30", "15:30"),
    mk("pt2-adela",                               "ADÉLA",                                                 "crane",      2, "15:50", "16:30"),
    mk("pt2-zulan",                               "ZULAN",                                                 "crane",      2, "16:45", "17:35"),
    mk("pt2-underscores",                         "UNDERSCORES",                                           "crane",      2, "17:50", "18:40"),
    mk("pt2-ninajirachi",                         "NINAJIRACHI",                                           "crane",      2, "19:00", "19:50"),
    mk("pt2-horsegiirl",                          "HORSEGIIRL",                                            "crane",      2, "20:10", "21:00"),
    mk("pt2-parcels",                             "PARCELS",                                               "crane",      2, "21:30", "22:45"),
    // Warehouse
    mk("pt2-dean-turnley",                        "DEAN TURNLEY",                                          "warehouse",  2, "13:30", "14:30"),
    mk("pt2-silva-bumpa",                         "SILVA BUMPA",                                           "warehouse",  2, "14:30", "15:30"),
    mk("pt2-brunello",                            "BRUNELLO",                                              "warehouse",  2, "15:30", "16:30"),
    mk("pt2-vtss",                                "VTSS",                                                  "warehouse",  2, "16:30", "17:30"),
    mk("pt2-marlon-hoffstadt",                    "MARLON HOFFSTADT",                                      "warehouse",  2, "17:30", "18:45"),
    mk("pt2-tiesto",                              "TIËSTO",                                                "warehouse",  2, "18:45", "20:15"),
    mk("pt2-overmono",                            "OVERMONO",                                              "warehouse",  2, "20:20", "21:20"),
    mk("pt2-four-tet",                            "FOUR TET",                                              "warehouse",  2, "21:30", "23:00"),
    // Ship Tent
    mk("pt2-kaytree",                             "KAYTREE",                                               "ship",       2, "13:40", "14:55"),
    mk("pt2-riria",                               "RIRIA",                                                 "ship",       2, "14:55", "16:10"),
    mk("pt2-ear",                                 "EAR",                                                   "ship",       2, "16:20", "17:00"),
    mk("pt2-ben-ufo",                             "BEN UFO",                                               "ship",       2, "17:10", "18:30"),
    mk("pt2-daphni",                              "DAPHNI",                                                "ship",       2, "18:30", "19:50"),
    mk("pt2-kelela",                              "KELELA",                                                "ship",       2, "20:05", "20:50"),
    mk("pt2-jt",                                  "JT",                                                    "ship",       2, "21:00", "21:30"),
    mk("pt2-baby-j",                              "BABY J",                                                "ship",       2, "21:40", "22:30"),
    // Despacio
    mk("pt2-despacio",                            "DESPACIO",                                              "despacio",   2, "15:30", "22:30"),
  ];

  const CONFIG = {
    id:        "portola-2026",
    // From the SOURCE note above: portolamusicfestival.com/set-times, read 2026-09-06. Feeds /f/<id>/schedule.json.
    scheduleSource: { url: "https://portolamusicfestival.com/set-times", observedAt: "2026-09-06", official: true },
    name:      "Portola 2026",
    shortName: "Portola",
    brand:     "Portola",
    tagline:   "Two days of dance music on the San Francisco waterfront",
    location:  "Pier 80 · San Francisco, CA",
    locationShort: "Pier 80",
    dates:     "Sep 26–27, 2026",
    year:      2026,
    // "Venue doors open at 1pm PT both days" (official general-info).
    // California is PDT (UTC-7) in September. The last set each night ends
    // at 23:00 on the official grid, so unlike the other gated builds these
    // bounds are the REAL published hours, not a generous guess.
    startMs: Date.UTC(2026, 8, 26, 20, 0, 0),  // Sep 26 13:00 PDT, doors
    endMs:   Date.UTC(2026, 8, 28,  6, 0, 0),  // Sep 27 23:00 PDT, last set ends
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 8, d: 26, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 8, 26, 7, 0, 0) },
      2: { y: 2026, m: 8, d: 27, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 8, 27, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 37.74877,-122.38239, converted to PDT.
    sunTimes: {
      1: { rise: "06:59", set: "19:01" },
      2: { rise: "07:00", set: "19:00" },
    },
    // Polygon centroid of the OSM cargo shed. The festival is bigger than
    // the shed (see venue.footprint), so the radius covers the pier apron
    // rather than the building.
    gps: { lat: 37.74877, lng: -122.38239, onSiteRadiusMi: 0.4 },
    venue: {
      name:    "Pier 80",
      address: "Pier 80, Cesar Chavez St & Illinois St, San Francisco, CA 94124",
      terrain: "concrete pier apron and an indoor cargo shed",
      // OpenStreetMap way 24311406 — the Pier 80 cargo shed, all 5 vertices
      // verbatim. 20,674 m², 310 × 90 m, one level, 13 m tall. Found by
      // ADDRESS, not name: see the ⛔ note in the header.
      //
      // This is the BUILDING, not the festival perimeter. See the header
      // before widening it.
      footprint: [
        [37.74897, -122.38415], [37.74836, -122.38409], [37.74856, -122.38063], [37.74861, -122.38063], [37.74917, -122.38069],
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/37.7488,-122.3824",
    // Pier Stage carries Robyn and Swedish House Mafia and is first on both
    // official grids.
    mainStageId: "pier",
    // ── THE MAP ──
    // No mapImage, no gpsAnchors. See the header for why the "obvious"
    // stage positions here are exactly the ones not to invent.
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    // Published policy: 21+ entry, no re-entry, cashless, no parking.
    policies: { minimumAge: 21, alcoholAge: 21, reentry: false, cashless: true },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["portola-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // LIVE (flipped 2026-09-08). The site map is STILL unpublished — it was
    // never the blocker it looks like. This festival is `mapMode: "real"`, so
    // the Map tab draws OSM ground, not festival art, and an unreleased art
    // plate changes nothing about what renders. The stages carry no lat/lng
    // and therefore no pins, which is not a regression: arc-2026 has shipped
    // LIVE in exactly that shape (mapMode real, 4 stages, 0 coordinates).
    // Verified against main before flipping — 64 acts, 32/32 across the two
    // days, every `stage` resolving to a real STAGES id, every start/end a
    // well-formed HH:MM, no duplicate ids. Set times are the founder-facing
    // promise and they are complete, so the gate had nothing left to protect.
    // Stage pins land when the official map does; that is an enhancement now,
    // not a gate.
    registry: { available: true, accent: "#2C4096", emoji: "🪩", region: "North America" },
  };
})();

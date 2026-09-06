// ═══════════════════════════════════════════════════════════════════════
// CRSSD FEST FALL 2026 — Waterfront Park · San Diego, CA
// Sep 26–27, 2026
// ═══════════════════════════════════════════════════════════════════════
// GATED SCAFFOLD. This one sits between the other two gated builds: III
// Points has no stages at all, Nocturnal has stages AND a day split — CRSSD
// publishes REAL STAGES but NO DAY SPLIT and NO SET TIMES, and nothing below
// invents either.
//
// SOURCE lineup + stages: crssdfest.com (official home page), accessed
//   2026-09-06. The lineup is authored as three `.vc_ls__stage-group`
//   blocks — `--ocean-view-stage`, `--palms-stage`, `--city-steps-stage` —
//   so the stage assignment is the site's own, not an inference. 52 acts.
//   B2B billing is preserved VERBATIM as one act, because that is how the
//   set is sold and how the schedule will print it. Same for "(dj set)",
//   which the site marks up as its own `.vc_ls__settype` span.
// SOURCE stage COLOURS: the same page's stylesheet, which gives each stage
//   group its own hover glow — ocean #56fbf1, city steps #fdb915, palms
//   #7e9f5d. Those are CRSSD's own stage colours, read off their CSS rather
//   than picked by us.
// SOURCE hours + policies: crssdfest.com/info/ (official FAQ), accessed
//   2026-09-06 — "Doors open at 12PM both days", "CRSSD is a 21+ event
//   only", "no re-entry is permitted", "100% smoke-free venue".
// SOURCE venue: OpenStreetMap way 133055389 "Waterfront Park", fetched via
//   Overpass 2026-09-06. 39 vertices, 64,524 m², 489 m N–S × 152 m E–W.
// SOURCE sun times: api.sunrise-sunset.org at the OSM centroid, 2026-09-06.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-09-06, do not fabricate) ──
// DAY SPLIT: absent. The lineup is grouped by STAGE only — there are no
//   Sat/Sun tabs and no per-act day. See the dayDates comment below for why
//   that becomes one TBA bucket rather than `day: null`.
// SET TIMES: absent, and the FAQ says so itself — "Set times will be posted
//   on the website, social media pages, and the CRSSD mobile app a few days
//   before the festival." Every act carries start/end "".
// SITE MAP: absent. The FAQ references one ("clearly marked on the map"),
//   but no map is published on the site yet — no 2026 map, and no prior-year
//   map either. Checked every `wp-content/uploads` image reference on both
//   the home page and the FAQ page; there is none.
//
// ── SPATIAL MODEL ──
// The stages are REAL and NAMED, and they have NO POSITIONS. That is the
// whole shape of this build.
//
// Waterfront Park's three stages sit in the same places every edition, and
// it would be easy to drop pins from memory of the venue. That is exactly
// the defect PR #36 removed from EDC LV and the 2026-09-06 re-survey found
// on three more festivals: a coordinate nobody measured, rendered at a
// precision nobody earned. Nocturnal got layout from an official prior-year
// map (founder call, 2026-09-06); CRSSD has no official map in any year to
// read, so there is nothing to read.
//
// So `mapMode: "real"` — the III Points answer. Real street tiles centred on
// the surveyed park, the live blue dot, and the OSM park outline: all true,
// none of it drawn by us. The three stages appear everywhere a stage should
// (pills, filters, lineup cards) and carry no map pin, which map.jsx's
// PLACED_STAGES filter handles by drawing nothing rather than a pin at NaN.
//
// No gpsAnchors, so MAP_AFFINE is null and the v257/v260 honesty gate
// suppresses every distance and walk-time readout. Nothing quotes a number
// it cannot support.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// gpsAnchors: NONE. Not T3, not provisional, ABSENT — a stage anchor cannot
// be tiered before the stage has a position.
//
// ⚠ venue.footprint is OSM's park polygon, and OSM tags it `source=knowledge`
// — someone's local knowledge, NOT a survey or an imagery trace. It is the
// best published outline available and it is the right shape and place, but
// do not promote it to T1 VERIFIED on the strength of being in OSM. Its
// 15.9 acres also exceed the County's stated 12: the polygon is the park
// boundary with the County Administration Center still inside it, not the
// lawn area alone. Replace it at the flip from the official festival map.
//
// ⚠ ADDRESS: the FAQ writes "1600 Pacific Coast Highway". The street is
// Pacific Highway — there is no Pacific Coast Highway in downtown San Diego —
// so the navigable address below says Pacific Hwy. This is the one place a
// verbatim official string is not used, and it is deliberate.
//
// ⚠ NAME CASING is verbatim, which means it is INCONSISTENT, on purpose.
// The site types its headliner tier in caps ("SONNY FODERA") and its A–Z
// tier in real casing ("salute", "ear", "oskar med k", "beginagain"). No
// `text-transform` is involved — that is the authored text. Since the caps
// tier mixes possible stylisations (CHASEWEST, HORSEGIIRL) with ordinary
// names shouted by the poster, title-casing it would be a guess applied to
// both. Verbatim is the only option that invents nothing; fix it at the flip
// against the set-times listing, which prints real casing.
//   Datapoint for that session: iii-points-2026.js carries the same act as
//   "ChaseWest", off III Points' own official page. Two official sources,
//   two casings — which is the argument for not guessing here, and a hint
//   that this tier is poster typography rather than artist styling.
//
// ── FLIP CHECKLIST (set times + official map, a few days before Sep 26) ──
//   1. Real Sat/Sun dayDates; per-act `day`; drop `provisional`.
//   2. start/end per act from the official schedule.
//   3. STAGES get real lat/lng from the official map, and x/y DERIVED from
//      that lat/lng — never the reverse. Then mapMode can leave "real".
//   4. gpsAnchors once the stages have positions — src "poster" for art
//      reads, "osm" for satellite-measured features. `derived` is banned
//      from the basis.
//   5. Replace venue.footprint with the real festival perimeter.
//   6. amenities from the official map legend (water refills are documented
//      as "near the center fountain"; the rest is not published).
//   7. Re-check artist name casing against the set-times listing.
//   8. registry.available → true — its own PR, founder review (AGENTS.md).
(function () {
  "use strict";

  // Colours are CRSSD's own, read off the stage-group hover rules in the
  // official page's stylesheet. Ocean View is the largest tier there ("Ocean
  // View — clearly the largest tier" in their CSS comment) and carries the
  // Chris Lake b2b Disclosure billing, so it is the main stage.
  //
  // ⚠ NO x/y ON ANY STAGE. See the SPATIAL MODEL note in the header — no
  // official map exists in any year, so there is no layout to read. These
  // are real stages with unknown positions, not stages awaiting tidy-up.
  const STAGES = [
    { id: "oceanview", name: "Ocean View", short: "OCEAN", color: "#56fbf1", size: 1.6,
      desc: "Main stage · bayfront" },
    { id: "citysteps", name: "City Steps", short: "CITY", color: "#fdb915", size: 1.4,
      desc: "Techno + club" },
    { id: "palms", name: "The Palms", short: "PALMS", color: "#7e9f5d", size: 1.3,
      desc: "House" },
  ];

  // No amenity map published — see the header.
  const AMENITIES = [];

  // Every act has a REAL stage and NOTHING ELSE: no day, no set time. `tier`
  // drives lineup card weighting; with no times there is no basis to rank, so
  // every act sits at the same tier rather than being silently ordered by a
  // guess. `provisional: true` marks the whole set for the flip session.
  const mk = (id, name, stage) => ({
    id, name, genre: "—", country: "—",
    stage, day: 1, start: "", end: "", tier: 2,
    img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a1420)`,
    bio: `Playing CRSSD Fest Fall 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage. ` +
         `Day and set time are not published yet — CRSSD posts the schedule a few days before the festival.`,
    provisional: true,
  });

  const ARTISTS = [
    // ─────────── Ocean View ───────────
    mk("crssd-chris-lake-b2b-disclosure",        "CHRIS LAKE b2b DISCLOSURE",        "oceanview"),
    mk("crssd-mochakk",                          "MOCHAKK",                          "oceanview"),
    mk("crssd-ayybo",                            "AYYBO",                            "oceanview"),
    mk("crssd-balu-brigada",                     "Balu Brigada",                     "oceanview"),
    mk("crssd-beginagain",                       "beginagain",                       "oceanview"),
    mk("crssd-big-wild",                         "Big Wild",                         "oceanview"),
    mk("crssd-drama",                            "DRAMA",                            "oceanview"),
    mk("crssd-ear",                              "ear",                              "oceanview"),
    mk("crssd-mind-enterprises",                 "Mind Enterprises",                 "oceanview"),
    mk("crssd-notion",                           "Notion",                           "oceanview"),
    mk("crssd-oskar-med-k",                      "oskar med k",                      "oceanview"),
    mk("crssd-roya",                             "ROYA",                             "oceanview"),
    mk("crssd-saand",                            "SAAND",                            "oceanview"),
    mk("crssd-sebastien-tellier",                "Sébastien Tellier",                "oceanview"),
    // ─────────── The Palms ───────────
    mk("crssd-chasewest",                        "CHASEWEST",                        "palms"),
    mk("crssd-horsegiirl",                       "HORSEGIIRL",                       "palms"),
    mk("crssd-kettama",                          "KETTAMA",                          "palms"),
    mk("crssd-layton-giordani",                  "LAYTON GIORDANI",                  "palms"),
    mk("crssd-prospa",                           "PROSPA",                           "palms"),
    mk("crssd-rossi-b2b-carlita",                "ROSSI. b2b CARLITA",               "palms"),
    mk("crssd-skepta-mas-tiempo",                "SKEPTA MÁS TIEMPO",                "palms"),
    mk("crssd-sonny-fodera",                     "SONNY FODERA",                     "palms"),
    mk("crssd-dean-turnley",                     "Dean Turnley",                     "palms"),
    mk("crssd-genesi",                           "GENESI",                           "palms"),
    mk("crssd-greg-99",                          "GREG 99",                          "palms"),
    mk("crssd-heminguey",                        "Heminguey",                        "palms"),
    mk("crssd-jamback",                          "Jamback",                          "palms"),
    mk("crssd-jay-de-lys",                       "Jay de Lys",                       "palms"),
    mk("crssd-locklead",                         "Locklead",                         "palms"),
    mk("crssd-marco-strous",                     "Marco Strous",                     "palms"),
    mk("crssd-punkybutter",                      "Punkybutter",                      "palms"),
    mk("crssd-rafael",                           "Rafael",                           "palms"),
    mk("crssd-sam-alfred",                       "Sam Alfred",                       "palms"),
    mk("crssd-torren-foot",                      "Torren Foot",                      "palms"),
    // ─────────── City Steps ───────────
    mk("crssd-999999999",                        "999999999",                        "citysteps"),
    mk("crssd-boys-noize",                       "BOYS NOIZE",                       "citysteps"),
    mk("crssd-groove-armada-dj-set",             "GROOVE ARMADA (dj set)",           "citysteps"),
    mk("crssd-i-hate-models",                    "I HATE MODELS",                    "citysteps"),
    mk("crssd-marlon-hoffstadt",                 "MARLON HOFFSTADT",                 "citysteps"),
    mk("crssd-mathame",                          "MATHAME",                          "citysteps"),
    mk("crssd-vtss",                             "VTSS",                             "citysteps"),
    mk("crssd-adam-sellouk",                     "Adam Sellouk",                     "citysteps"),
    mk("crssd-ahadadream",                       "Ahadadream",                       "citysteps"),
    mk("crssd-arodes",                           "ARODES",                           "citysteps"),
    mk("crssd-bb-shaine",                        "BB Shaine",                        "citysteps"),
    mk("crssd-ben-ufo",                          "Ben UFO",                          "citysteps"),
    mk("crssd-helena-hauff",                     "Helena Hauff",                     "citysteps"),
    mk("crssd-kas-st",                           "KAS:ST",                           "citysteps"),
    mk("crssd-mph",                              "MPH",                              "citysteps"),
    mk("crssd-rivka-m",                          "Rivka M",                          "citysteps"),
    mk("crssd-salute",                           "salute",                           "citysteps"),
    mk("crssd-son-of-son",                       "Son of Son",                       "citysteps"),
  ];

  const CONFIG = {
    id:        "crssd-fall-2026",
    name:      "CRSSD Fest Fall 2026",
    shortName: "CRSSD",
    brand:     "CRSSD Fest",
    tagline:   "Two days on the San Diego bay",
    location:  "Waterfront Park · San Diego, CA",
    locationShort: "Waterfront Park",
    dates:     "Sep 26–27, 2026",
    year:      2026,
    // "Doors open at 12PM both days" (official FAQ). California is PDT
    // (UTC-7) in September — DST does not end until Nov 1.
    //
    // ⚠ The CLOSE time is NOT published. Waterfront Park is a County park
    // with a curfew, but no hour is stated anywhere official, so endMs
    // bounds day 2 generously at local midnight rather than asserting a
    // curfew we would be inventing. It gets replaced by the real hours at
    // the flip, along with the set times.
    startMs: Date.UTC(2026, 8, 26, 19, 0, 0),  // Sep 26 12:00 PDT, doors
    endMs:   Date.UTC(2026, 8, 28,  7, 0, 0),  // Sep 28 00:00 PDT, generous bound
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    utcOffsetHours: -7,
    // ⚠️ ONE bucket for a TWO-day festival, on purpose — the III Points
    // precedent, for the same measured reason. The day split is not
    // published (see header), and:
    //   - day: null on every act → the lineup screen renders EMPTY, because
    //     the app filters `a.day === activeDay` in 48 places. 52 acts
    //     shipped and none reachable.
    //   - each act on BOTH days → claims every act plays twice. False.
    //   - ONE bucket labelled TBA → every act browsable and saveable now,
    //     and the label states exactly what is unknown.
    // Reverses cleanly at the flip, where this becomes the real Sat/Sun pair
    // and each act gets its true day.
    dayDates: {
      1: { y: 2026, m: 8, d: 26, name: "Sep 26–27", short: "TBA",
           midnightUtc: Date.UTC(2026, 8, 26, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 32.72204,-117.17210, converted to PDT.
    // Sep 26 and 27 differ by one minute at each end; the single bucket
    // takes day 1's, which is correct to within that minute for either date.
    sunTimes: {
      1: { rise: "06:38", set: "18:41" },
    },
    // Polygon centroid of the OSM park way, not a street geocode. The park
    // is long and narrow (489 × 152 m), so 0.3 mi from the centroid covers
    // it end to end with a little apron.
    gps: { lat: 32.72204, lng: -117.17210, onSiteRadiusMi: 0.3 },
    venue: {
      name:    "Waterfront Park",
      // See the header: the FAQ writes "Pacific Coast Highway"; the street
      // is Pacific Highway, and this string has to be navigable.
      address: "1600 Pacific Hwy, San Diego, CA 92101",
      terrain: "green grass and walking paths",
      // OpenStreetMap way 133055389, all 39 vertices VERBATIM — no
      // decimation, so there is no epsilon for a future reader to wonder
      // about. 64,524 m². OSM tags this `source=knowledge`, so it is the
      // best published outline rather than a survey; see the header before
      // treating it as measured, and replace it at the flip.
      footprint: [
        [32.72003, -117.17285], [32.72003, -117.17234], [32.72001, -117.17124],
        [32.72005, -117.17124], [32.72088, -117.17124], [32.72107, -117.17123],
        [32.72107, -117.17126], [32.72111, -117.17126], [32.72122, -117.17127],
        [32.72129, -117.17128], [32.72139, -117.17132], [32.72148, -117.17134],
        [32.72156, -117.17134], [32.72162, -117.17134], [32.72186, -117.17134],
        [32.72205, -117.17134], [32.72229, -117.17134], [32.72243, -117.17135],
        [32.72283, -117.17143], [32.72283, -117.17142], [32.72283, -117.17139],
        [32.72421, -117.17167], [32.72443, -117.17173], [32.72443, -117.17175],
        [32.72432, -117.1721], [32.72409, -117.17285], [32.7239, -117.17285],
        [32.72303, -117.17285], [32.72299, -117.17285], [32.7225, -117.17285],
        [32.72247, -117.17285], [32.72228, -117.17285], [32.7217, -117.17285],
        [32.72164, -117.17285], [32.72144, -117.17285], [32.72142, -117.17285],
        [32.72092, -117.17285], [32.72088, -117.17285], [32.7202, -117.17285],
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/32.7220,-117.1721",
    mainStageId: "oceanview",
    // ── THE MAP ──
    // No mapImage, no mapStyle: "image-overlay", no gpsAnchors. This festival
    // opens straight into the real basemap. See the header for why that is
    // the honest choice here rather than a fallback — unlike Nocturnal, there
    // is no official map in ANY year to take a layout from.
    mapMode: "real",
    mapPrintsStageNames: false,
    // The affine-vs-poster gate has no poster to check against here. Not a
    // waiver — there is genuinely nothing to register.
    mapArtIsGeoregistered: false,
    // Flip markers, read by humans rather than by code.
    setTimesProvisional: true,
    // Published policy: 21+ entry, no re-entry, smoke-free.
    policies: { minimumAge: 21, alcoholAge: 21, reentry: false, smokeFree: true },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["crssd-fall-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // GATED: day split, set times and the site map are all unpublished.
    registry: { available: false, accent: "#56fbf1", emoji: "🌊", region: "North America" },
  };
})();

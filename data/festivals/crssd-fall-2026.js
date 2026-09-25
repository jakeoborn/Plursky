// ═══════════════════════════════════════════════════════════════════════
// CRSSD FEST FALL 2026 — Waterfront Park · San Diego, CA
// Sep 26–27, 2026
// ═══════════════════════════════════════════════════════════════════════
// SET TIMES ARE OFFICIAL (2026-09-25). Every timed act below is read off
// CRSSD's own set-times graphics; the two acts the grid does not list keep
// their stage and nothing else. See SET TIMES and MISMATCHES below.
//
// SOURCE set times: crssdfest.com/set-times/ (page dateModified
//   2026-09-25T02:47:48Z), which carries one graphic per day, headed
//   SATURDAY / SUNDAY and footed "FALL … 2026":
//     CFS26_SaturdaySetTimes_Web.png  Last-Modified 2026-09-25 01:58:18 UTC  sha256 a6589a93b6725916…
//     CFS26_SundaySetTimes_Web.png    Last-Modified 2026-09-25 01:58:23 UTC  sha256 b50de29c6e65df85…
//   (the 1080×1920 story versions print the same grid with the day header.)
//   Transcribed by hand, then checked row by row against a macOS Vision OCR
//   of both graphics: every stage, start and end agrees. 51 timed acts.
//
// MISMATCHES between official sources — recorded, not resolved by guessing:
//   1. SKEPTA MÁS TIEMPO: on Sunday's grid (City Steps 3:45–5:00 PM), but
//      GONE from the lineup page as re-read 2026-09-25 (Last-Modified 12:28
//      UTC, ten hours after the graphics). The newer official billing wins,
//      so the act is not in this lineup and its slot is not shown. If CRSSD
//      re-bills it, it goes back from the grid row above.
//   2. PETE SOUL (Ocean View) and CHRIS LORENZO (The Palms): new on that same
//      lineup page, on neither graphic. Listed with their stage, no day, no
//      time (ARTISTS, end).
//   3. SATURDAY OCEAN VIEW 3:00–4:30 PM prints "Special Guest": an unnamed
//      slot, so it is not an act (the historical DROP_RULES precedent).
//      Nothing official ties it to Pete Soul, so he is not placed in it.
//   4. HORSEGIIRL and GROOVE ARMADA: the 2026-09-06 lineup page grouped them
//      under The Palms and City Steps; the grid and the re-read lineup page
//      both put them on Ocean View and The Palms. Moved.
//   5. The lineup page bills "DISCLOSURE dj set"; the grid prints "Chris Lake
//      b2b Disclosure" with no set type. The grid's billing is used.
//   6. The site's own meta description reads "SEP 25 + 27"; the page body,
//      the set-times page and both graphics say 26 + 27. 26 + 27 is used.
//
// SOURCE lineup + stages: crssdfest.com (official home page), accessed
//   2026-09-06. The lineup is authored as three `.vc_ls__stage-group`
//   blocks — `--ocean-view-stage`, `--palms-stage`, `--city-steps-stage` —
//   so the stage assignment is the site's own, not an inference. 52 acts.
//   B2B billing is preserved VERBATIM as one act, because that is how the
//   set is sold and how the schedule will print it. Same for "(dj set)",
//   which the site marks up as its own `.vc_ls__settype` span.
//   RE-READ 2026-09-25 for the flip (Last-Modified 12:28 UTC): 53 billings
//   after Pete Soul and Chris Lorenzo were added and Skepta Más Tiempo was
//   removed (MISMATCHES 1–2).
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
// ── WHAT IS NOT PUBLISHED (do not fabricate) ──
// SITE MAP: absent for this edition (re-checked 2026-09-25: crssdfest.com/map
//   shows the Fall 2025 PDFs and Spring 2026 JPGs, no Fall 2026 map). The FAQ references one ("clearly marked on the map"),
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
// lawn area alone. Replace it from an official festival map when one publishes.
//
// ⚠ ADDRESS: the FAQ writes "1600 Pacific Coast Highway". The street is
// Pacific Highway — there is no Pacific Coast Highway in downtown San Diego —
// so the navigable address below says Pacific Hwy. This is the one place a
// verbatim official string is not used, and it is deliberate.
//
// NAME CASING is the set-times grid's, verbatim. The lineup page types its
// headliner tier in caps ("SONNY FODERA"); the grid prints real casing
// ("Sonny Fodera", "horsegiirl", "Roya"), so the grid wins wherever the two
// differ. Where the grid itself prints caps (CHASEWEST, AYYBO, DRAMA, SAAND,
// GENESI, GREG 99, VTSS, MPH) that is the act's own styling and is kept.
// Pete Soul and Chris Lorenzo are not on the grid, so they carry the lineup
// page's casing.
//   iii-points-2026.js carries the same act as "ChaseWest", off III Points'
//   own page; CRSSD's grid prints CHASEWEST. Each festival keeps its own.
//
// ── STILL OPEN (the map half of the old flip checklist) ──
//   · STAGES get real lat/lng from an official Fall 2026 map, x/y DERIVED
//     from it; then gpsAnchors, the real perimeter and amenities. Until
//     then mapMode stays "real" and no distance is quoted.
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

  // The OFFICIAL set-times grid (see the header), transcribed into a sheet
  // and written here by the importer, which checks every row against the
  // lineup, the stages and its neighbours on the same stage:
  //   node scripts/import-set-times.mjs crssd-fall-2026 <sheet.tsv> --days-from-sheet --source <official-url>
  // id → [stageId, start, end, day]. `tier` stays 2 for every act: the grid
  // prints times, not a billing rank.
  const SCHEDULE = {
    // SCHEDULE:BEGIN crssd-fall-2026
    // source: https://www.crssdfest.com/set-times/ · imported 2026-09-25 · 51 of 53 acts
    "crssd-beginagain": ["oceanview", "12:30", "13:15", 1],  // beginagain
    "crssd-ear": ["oceanview", "13:15", "14:15", 1],  // ear
    "crssd-mind-enterprises": ["oceanview", "16:45", "17:45", 1],  // Mind Enterprises
    "crssd-ayybo": ["oceanview", "18:00", "19:00", 1],  // AYYBO
    "crssd-notion": ["oceanview", "19:15", "20:15", 1],  // Notion
    "crssd-horsegiirl": ["oceanview", "20:30", "21:45", 1],  // horsegiirl (live)
    "crssd-mochakk": ["oceanview", "22:00", "23:00", 1],  // Mochakk
    "crssd-bb-shaine": ["citysteps", "12:00", "12:45", 1],  // BB Shaine
    "crssd-adam-sellouk": ["citysteps", "12:45", "14:00", 1],  // Adam Sellouk
    "crssd-ahadadream": ["citysteps", "14:00", "15:15", 1],  // Ahadadream
    "crssd-salute": ["citysteps", "15:15", "16:30", 1],  // salute
    "crssd-mph": ["citysteps", "16:30", "17:45", 1],  // MPH
    "crssd-ben-ufo": ["citysteps", "17:45", "19:00", 1],  // Ben UFO
    "crssd-marlon-hoffstadt": ["citysteps", "19:00", "20:30", 1],  // Marlon Hoffstadt
    "crssd-i-hate-models": ["citysteps", "20:30", "21:45", 1],  // I Hate Models
    "crssd-vtss": ["citysteps", "21:45", "23:00", 1],  // VTSS
    "crssd-heminguey": ["palms", "12:00", "13:00", 1],  // Heminguey
    "crssd-torren-foot": ["palms", "13:00", "14:00", 1],  // Torren Foot
    "crssd-rafael": ["palms", "14:00", "15:00", 1],  // Rafael
    "crssd-dean-turnley": ["palms", "15:00", "16:00", 1],  // Dean Turnley
    "crssd-jamback": ["palms", "16:00", "17:00", 1],  // Jamback
    "crssd-locklead": ["palms", "17:00", "18:00", 1],  // Locklead
    "crssd-rossi-b2b-carlita": ["palms", "18:00", "19:30", 1],  // Rossi. b2b Carlita
    "crssd-chasewest": ["palms", "19:30", "21:00", 1],  // CHASEWEST
    "crssd-layton-giordani": ["palms", "21:00", "22:00", 1],  // Layton Giordani
    "crssd-sonny-fodera": ["palms", "22:00", "23:00", 1],  // Sonny Fodera
    "crssd-saand": ["oceanview", "12:30", "13:00", 2],  // SAAND
    "crssd-roya": ["oceanview", "13:15", "14:00", 2],  // Roya
    "crssd-sebastien-tellier": ["oceanview", "14:30", "15:15", 2],  // Sébastien Tellier
    "crssd-balu-brigada": ["oceanview", "15:45", "16:30", 2],  // Balu Brigada
    "crssd-oskar-med-k": ["oceanview", "17:00", "17:45", 2],  // oskar med K
    "crssd-drama": ["oceanview", "18:00", "18:45", 2],  // DRAMA
    "crssd-big-wild": ["oceanview", "19:00", "20:00", 2],  // Big Wild
    "crssd-chris-lake-b2b-disclosure": ["oceanview", "20:30", "22:00", 2],  // Chris Lake b2b Disclosure
    "crssd-rivka-m": ["citysteps", "12:00", "12:30", 2],  // Rivka M
    "crssd-son-of-son": ["citysteps", "12:30", "13:30", 2],  // Son of Son
    "crssd-arodes": ["citysteps", "13:30", "14:30", 2],  // Arodes
    "crssd-kas-st": ["citysteps", "14:30", "15:45", 2],  // KAS:ST
    "crssd-mathame": ["citysteps", "17:00", "18:15", 2],  // Mathame
    "crssd-helena-hauff": ["citysteps", "18:15", "19:30", 2],  // Helena Hauff
    "crssd-boys-noize": ["citysteps", "19:30", "20:45", 2],  // Boys Noize
    "crssd-999999999": ["citysteps", "20:45", "22:00", 2],  // 999999999
    "crssd-punkybutter": ["palms", "12:00", "12:30", 2],  // Punkybutter
    "crssd-greg-99": ["palms", "12:30", "13:30", 2],  // GREG 99
    "crssd-sam-alfred": ["palms", "13:30", "14:30", 2],  // Sam Alfred
    "crssd-jay-de-lys": ["palms", "14:30", "15:30", 2],  // Jay de Lys
    "crssd-genesi": ["palms", "15:30", "16:30", 2],  // GENESI
    "crssd-marco-strous": ["palms", "16:30", "17:30", 2],  // Marco Strous
    "crssd-groove-armada-dj-set": ["palms", "17:30", "19:00", 2],  // Groove Armada (dj set)
    "crssd-prospa": ["palms", "19:00", "20:30", 2],  // Prospa
    "crssd-kettama": ["palms", "20:30", "22:00", 2],  // Kettama
    // SCHEDULE:END
  };
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day, bio: "Playing CRSSD Fest Fall 2026." };
  };

  const mk = (id, name, stage) => scheduled({
    id, name, genre: "—", country: "—",
    stage, day: 1, start: "", end: "", tier: 2,
    img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a1420)`,
    bio: `Playing CRSSD Fest Fall 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage. ` +
         `Day and set time are not published yet — CRSSD posts the schedule a few days before the festival.`,
    provisional: true,
  });

  // A billed act the official schedule does not place: real stage, no day,
  // no time (see the end of ARTISTS).
  const mkUnscheduled = (id, name, stage) => ({
    id, name, genre: "—", country: "—",
    stage, day: null, start: "", end: "", tier: 2,
    img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a1420)`,
    bio: `On the official CRSSD Fest Fall 2026 lineup, ${(STAGES.find(s => s.id === stage) || {}).name} stage. ` +
         `The official set times do not list this act, so its day and set time are not published.`,
    unscheduled: true,
  });

  // Names are the SET-TIMES GRID's casing (flip checklist step 7): the grid
  // prints real casing where the lineup page shouts a headliner tier. Ids are
  // unchanged from the gated scaffold, so saved acts survive the flip.
  // Stages are the grid's. Two acts moved stage between the 2026-09-06
  // lineup read and the grid (horsegiirl → Ocean View, Groove Armada → The
  // Palms); the lineup page re-read on 2026-09-25 agrees with the grid on both.
  const ARTISTS = [
    // ─────────── Ocean View ───────────
    mk("crssd-chris-lake-b2b-disclosure",        "Chris Lake b2b Disclosure",        "oceanview"),
    mk("crssd-mochakk",                          "Mochakk",                          "oceanview"),
    mk("crssd-horsegiirl",                       "horsegiirl (live)",                "oceanview"),
    mk("crssd-ayybo",                            "AYYBO",                            "oceanview"),
    mk("crssd-balu-brigada",                     "Balu Brigada",                     "oceanview"),
    mk("crssd-beginagain",                       "beginagain",                       "oceanview"),
    mk("crssd-big-wild",                         "Big Wild",                         "oceanview"),
    mk("crssd-drama",                            "DRAMA",                            "oceanview"),
    mk("crssd-ear",                              "ear",                              "oceanview"),
    mk("crssd-mind-enterprises",                 "Mind Enterprises",                 "oceanview"),
    mk("crssd-notion",                           "Notion",                           "oceanview"),
    mk("crssd-oskar-med-k",                      "oskar med K",                      "oceanview"),
    mk("crssd-roya",                             "Roya",                             "oceanview"),
    mk("crssd-saand",                            "SAAND",                            "oceanview"),
    mk("crssd-sebastien-tellier",                "Sébastien Tellier",                "oceanview"),
    // ─────────── The Palms ───────────
    mk("crssd-chasewest",                        "CHASEWEST",                        "palms"),
    mk("crssd-groove-armada-dj-set",             "Groove Armada (dj set)",           "palms"),
    mk("crssd-kettama",                          "Kettama",                          "palms"),
    mk("crssd-layton-giordani",                  "Layton Giordani",                  "palms"),
    mk("crssd-prospa",                           "Prospa",                           "palms"),
    mk("crssd-rossi-b2b-carlita",                "Rossi. b2b Carlita",               "palms"),
    mk("crssd-sonny-fodera",                     "Sonny Fodera",                     "palms"),
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
    mk("crssd-boys-noize",                       "Boys Noize",                       "citysteps"),
    mk("crssd-i-hate-models",                    "I Hate Models",                    "citysteps"),
    mk("crssd-marlon-hoffstadt",                 "Marlon Hoffstadt",                 "citysteps"),
    mk("crssd-mathame",                          "Mathame",                          "citysteps"),
    mk("crssd-vtss",                             "VTSS",                             "citysteps"),
    mk("crssd-adam-sellouk",                     "Adam Sellouk",                     "citysteps"),
    mk("crssd-ahadadream",                       "Ahadadream",                       "citysteps"),
    mk("crssd-arodes",                           "Arodes",                           "citysteps"),
    mk("crssd-bb-shaine",                        "BB Shaine",                        "citysteps"),
    mk("crssd-ben-ufo",                          "Ben UFO",                          "citysteps"),
    mk("crssd-helena-hauff",                     "Helena Hauff",                     "citysteps"),
    mk("crssd-kas-st",                           "KAS:ST",                           "citysteps"),
    mk("crssd-mph",                              "MPH",                              "citysteps"),
    mk("crssd-rivka-m",                          "Rivka M",                          "citysteps"),
    mk("crssd-salute",                           "salute",                           "citysteps"),
    mk("crssd-son-of-son",                       "Son of Son",                       "citysteps"),
    // ─────────── Billed, not on the grid ───────────
    // On the lineup page as re-read 2026-09-25 (Last-Modified 12:28 UTC,
    // ten hours after the grid's 01:58 UTC graphics), absent from both day
    // graphics. Stage is the lineup page's; day and time are unpublished, so
    // day is null (the Escape precedent) and nothing is inferred. Saturday
    // Ocean View prints an unnamed "Special Guest" 3:00–4:30 PM; nothing
    // official says either act is that slot, so neither is placed in it.
    mkUnscheduled("crssd-pete-soul",            "Pete Soul",                        "oceanview"),
    mkUnscheduled("crssd-chris-lorenzo",        "Chris Lorenzo",                    "palms"),
  ];

  const CONFIG = {
    id:        "crssd-fall-2026",
    // Where the lineup rows came from (the SOURCE note above), as data so the
    // public /f/ page can cite it. observedAt = the date it was read.
    lineupSource: { url: "https://www.crssdfest.com/", observedAt: "2026-09-25", official: true },
    // The day graphics on the official set-times page (see the header).
    scheduleSource: { url: "https://www.crssdfest.com/set-times/", observedAt: "2026-09-25", official: true },
    name:      "CRSSD Fest Fall 2026",
    shortName: "CRSSD",
    brand:     "CRSSD Fest",
    tagline:   "Two days on the San Diego bay",
    location:  "Waterfront Park · San Diego, CA",
    locationShort: "Waterfront Park",
    dates:     "Sep 26–27, 2026",
    year:      2026,
    // "Doors open at 12PM both days" (official FAQ). California is PDT
    // (UTC-7) in September — DST does not end until Nov 1. The close is the
    // official grid's last set: 11:00 PM Saturday, 10:00 PM Sunday.
    startMs: Date.UTC(2026, 8, 26, 19, 0, 0),  // Sep 26 12:00 PDT, doors
    endMs:   Date.UTC(2026, 8, 28,  5, 0, 0),  // Sep 27 22:00 PDT, last set ends
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    utcOffsetHours: -7,
    // The official set-times graphics head each day SATURDAY / SUNDAY, and
    // the site dates the edition "Saturday + Sunday SEPTEMBER 26 + 27".
    dayDates: {
      1: { y: 2026, m: 8, d: 26, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 8, 26, 7, 0, 0) },
      2: { y: 2026, m: 8, d: 27, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 8, 27, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 32.72204,-117.17210, tzid America/Los_Angeles,
    // fetched 2026-09-25.
    sunTimes: {
      1: { rise: "06:38", set: "18:41" },
      2: { rise: "06:39", set: "18:39" },
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
      // treating it as measured, and replace it from an official map.
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

    // The festival's OWN map page, linked (never embedded) by the /f/ page:
    // official publication is provenance, not reuse rights. mapYear is the
    // year printed on the map the page showed when checked — the Fall '26 page still shows the Fall 2025 maps.
    mapSource: { url: "https://www.crssdfest.com/map", observedAt: "2026-09-24", mapYear: 2025 },
    mapPrintsStageNames: false,
    // The affine-vs-poster gate has no poster to check against here. Not a
    // waiver — there is genuinely nothing to register.
    mapArtIsGeoregistered: false,
    // Published policy: 21+ entry, no re-entry, smoke-free.
    policies: { minimumAge: 21, alcoholAge: 21, reentry: false, smokeFree: true },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["crssd-fall-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Set times are the official grid (see the header). The site map is
    // still unpublished for this edition, so mapMode stays "real".
    registry: { available: true, accent: "#56fbf1", emoji: "🌊", region: "North America" },
  };
})();

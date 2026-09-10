// ═══════════════════════════════════════════════════════════════════════
// NOCTURNAL WONDERLAND 2026 — Glen Helen Regional Park · San Bernardino, CA
// Sep 19–20, 2026
// ═══════════════════════════════════════════════════════════════════════
// LIVE 2026 BUILD. Every act carries its official day, stage, start, and end.
// The 2026 site map is still unpublished; the existing honest map posture stays
// in place, with no invented georeference or Rave Cave position.
//
// SOURCE lineup: nocturnalwonderland.com/lineup/ (official), accessed
//   2026-09-06. The page carries TWO independent splits — by day and by stage
//   — and both were read in full: 86 acts each side, joined on exact artist
//   name with zero orphans in either direction (40 on Sat, 46 on Sun). B2B
//   billing is preserved VERBATIM as one act, because that is how the set is
//   sold and how the schedule will print it.
// SOURCE stages: nocturnalwonderland.com/experience/stages/ (official),
//   accessed 2026-09-06 — Mystic Wild, Dawn Mountain, Aurora Plains, Rave
//   Cave, with the stage blurbs quoted below. ⚠ That page lists FOUR; the
//   lineup page bills a FIFTH, Beatbox Boombox, with 18 acts on it. Both are
//   official, so all five ship. Do not "correct" this to four.
// SOURCE hours + age policy: nocturnalwonderland.com/guide/hours-and-info/,
//   accessed 2026-09-06 — "Festival Hours: 3PM-12AM daily", "You must be 18+
//   to enter and 21+ for alcohol/VIP."
// SOURCE venue: OpenStreetMap, Glen Helen Amphitheater / festival grounds,
//   34.2045945,-117.4017347. Address 2555 Glen Helen Pkwy per the official
//   guide's own map link.
// SOURCE sun times: api.sunrise-sunset.org at the OSM centroid, 2026-09-06.
//
// ⛔ DO NOT take stage names from press coverage or search summaries. Search
// results for this festival confidently return Labyrinth, Wolves' Den and
// Sunken Garden — those are REAL Nocturnal stages from EARLIER YEARS, and the
// 2026 site uses none of them. That mistake was live in this session before
// the official pages were read. Official pages only.
//
// SOURCE set times: nocturnalwonderland.com/lineup/set-times/day-1/ and
//   /day-2/ (official), accessed 2026-09-10. The two pages print 86 complete
//   stage/time rows: 42 Saturday and 44 Sunday. The source epochs encode the
//   printed wall clock as UTC, so this transcription follows the visible labels
//   (3PM–12AM PDT), not local conversion of those epoch integers.
// STAGE POSITIONS: absent. No 2026 site map exists, and the festival build
//   does not exist to measure off satellite either.
//
// ── SPATIAL MODEL ── (revised 2026-09-06 after the founder supplied the
// official 2025 festival map: "use the 2025 map if the 2026 map does not
// exist")
//
// LAYOUT is real; GEOREFERENCE is not, and the difference is the whole point.
//
// The 2025 official map gives RELATIVE layout — which stage sits where in
// relation to the others — so the four stages it shows carry 0-100 grid x/y
// read off it,
//
// ...and that read now has an INDEPENDENT corroboration (2026-09-06, #76).
// EDM Identity's 2025 review describes the layout in prose without reference
// to any map: entering the festival, Mystic Wild is on the far left, Dawn
// Mountain on the far right, Aurora Plains in the middle of the two. The grid
// agrees — mysticwild x=29.9, auroraplains x=61.7, dawnmountain x=70.8 — from
// a source that could not have copied it. That is corroboration of the
// LAYOUT only; it says nothing about world coordinates, and does not license
// anchors. and nocturnal-2026.svg is an abstract plate GENERATED from
// those coordinates (no festival artwork is reproduced; lostlands-2026.jpg
// precedent). That is a real, browsable site map.
//
// It does NOT give world coordinates, so there are NO gpsAnchors. Turning
// poster space into lat/lng is the exact defect PR #36 removed from EDC LV
// and the 2026-09-06 re-survey found on three more festivals. The EDCO spec
// (#68) does produce honest poster-class anchors, but by georeferencing the
// art onto county orthophotos with a 7-point least-squares affine against
// fixed street furniture. That measurement was not available in this session,
// and the alternative — eyeballing lat/lng off a screenshot — is precisely
// the invented precision the gate exists to stop. So: layout yes, anchors no,
// and anchoring is specced work for a session that has the imagery.
//
// Consequence, and it is the correct one: MAP_AFFINE is null, so every
// distance and walk-time readout suppresses itself through the v257/v260
// honesty gate, and the blue dot stays on the real-map layer where it is
// actually true. Nothing quotes a number it cannot support.
//
// ⚠ RAVE CAVE HAS NO POSITION. On the 2025 map it is an ART INSTALLATION in
// the legend, not a stage; for 2026 the lineup bills it as a stage with 15
// acts. It is real, its location is unknown, and map.jsx's PLACED_STAGES
// filter drops stages it cannot place rather than drawing a pin at NaN.
//
// ── FLIP CHECKLIST (Insomniac app set times + site map, ~Sep 12) ──
//   1. start/end per act from the official schedule; drop `provisional`.
//   2. GEOREFERENCE the site map onto ortho imagery the way #68 did for EDC
//      Orlando, then add gpsAnchors — src "poster" for art reads, "osm" for
//      satellite-measured features. `derived` is banned from the basis.
//      ── TIE POINTS ARE ALREADY FOUND (2026-09-06, #76). Glen Helen is
//      unusually well surveyed in OSM, and these four are distinctive enough
//      to recognise on any site map, so the flip session does not have to go
//      looking. Fit the affine against these, not against street furniture:
//        Large Lake            OSM way 437353375  centroid 34.20748,-117.40467  258 x 233 m
//        Small Lake            OSM way 437353374  centroid 34.20579,-117.40466  171 x 174 m
//        Amphitheater bowl     OSM way 233008519  centroid 34.20419,-117.40176   86 x 132 m
//        Amphitheater building OSM way 233008518  centroid 34.20440,-117.40239   58 x  79 m
//      Two named lakes 190 m apart on a north-south line, plus the bowl to
//      the south-east, give three well-spread non-collinear points — which is
//      the minimum an affine needs and more than EDC LV has ever had.
//      ⚠ WHAT IS STILL MISSING is the map image itself. The 2025 official map
//      is not retrievable from the open web (checked 2026-09-06: the official
//      site publishes no map page, and the aggregators that mirrored Lost
//      Lands' maps carry only Nocturnal's lineup poster). The flip session
//      gets the 2026 map from the Insomniac app; THAT is the input, and no
//      anchor may be authored before it exists.
//   3. Re-derive stage x/y from the measured lat/lng, never the reverse, and
//      regenerate nocturnal-2026.svg from the corrected coordinates.
//   4. Give Rave Cave a position, or leave it unplaced if still unknown.
//   5. amenities from the official map legend.
//   6. registry.available → true — its own PR, founder review (AGENTS.md).
(function () {
  "use strict";

  // Blurbs are quoted from the official stages page. Beatbox Boombox has no
  // blurb there — it is billed only on the lineup page — so it carries none
  // rather than an invented one.
  const STAGES = [
    { id: "mysticwild", name: "Mystic Wild", short: "MYSTIC", color: "#a855f7", size: 1.7,
      x: 29.9, y: 57.9,
      desc: "Main stage",
      vibe: "Claim Your Habitat",
      vibeNote: "\u201cGather your pack! At this grand scenic stage, hordes of wildly dancing creatures will claim their natural habitat.\u201d" },
    { id: "dawnmountain", name: "Dawn Mountain", short: "DAWN MTN", color: "#f97316", size: 1.4,
      x: 70.8, y: 9.3,
      desc: "Bass \u00b7 Bassrush",
      vibe: "A Maze of Sound",
      vibeNote: "\u201cAs you wander the pathways through this maze of sound, never fear! The beasts within hunger only for music.\u201d" },
    { id: "auroraplains", name: "Aurora Plains", short: "AURORA", color: "#14b8a6", size: 1.3,
      x: 61.7, y: 43.6,
      desc: "House + techno \u00b7 Insomniac Records",
      vibe: "Aural Flora",
      vibeNote: "\u201cImmerse yourself in a lush valley of sound as you revel in the aural flora of this bountiful stage.\u201d" },
    // ⚠ NO x/y ON PURPOSE. On the 2025 map "Rave Cave" is an ART
    // INSTALLATION in the legend, not a stage, and it has no stage structure
    // to read a position from. For 2026 the lineup bills it as a stage with
    // 15 acts, so it is real — but its LOCATION is genuinely unknown, and the
    // 2025 art cannot supply it. It shows up everywhere a stage should (pills,
    // filters, lineup cards) and simply carries no map pin until the 2026 map
    // lands. Do not borrow a nearby installation's spot.
    { id: "ravecave", name: "Rave Cave", short: "CAVE", color: "#ec4899", size: 1.1,
      desc: "Old-school + underground",
      vibe: "Creatures of the Night",
      vibeNote: "\u201cCalling all the creatures of the night!\u201d" },
    { id: "beatboxboombox", name: "Beatbox Boombox", short: "BOOMBOX", color: "#facc15", size: 0.9,
      x: 26.0, y: 81.4,
      desc: "Art car",
      vibe: "The Art Car",
      vibeNote: "Billed on the official lineup with 18 acts of its own. Insomniac has not published a stage blurb for it." },
  ];

  // No amenity map published — see the header.
  const AMENITIES = [];

  // Every act has a REAL day, stage, start and end from the official schedule.
  // `tier` is display weighting derived from the official start hour.
  const mk = (id, name, stage, day, start, end) => ({
    id, name, genre: "—", country: "—",
    stage, day, start, end,
    tier: +start.slice(0, 2) >= 22 ? 3 : +start.slice(0, 2) >= 20 ? 2 : 1,
    img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0a0a1a)`,
    bio: `Playing Nocturnal Wonderland 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage at ${start}.`,
  });

  const ARTISTS = [
    // ─────────── Mystic Wild ───────────
    mk("nw-angrybaby", "Angrybaby", "mysticwild", 2, "16:45", "17:45"),
    mk("nw-chyl", "CHYL", "mysticwild", 2, "17:45", "18:45"),
    mk("nw-deadmau5", "deadmau5", "mysticwild", 1, "23:00", "00:00"),
    mk("nw-deorro", "Deorro", "mysticwild", 1, "22:00", "23:00"),
    mk("nw-jordan-savage", "Jordan Savage", "mysticwild", 2, "15:00", "15:45"),
    mk("nw-flava-d", "Flava D", "mysticwild", 1, "16:00", "17:00"),
    mk("nw-gravagerz", "GRAVAGERZ", "mysticwild", 1, "17:00", "18:00"),
    mk("nw-illenium", "Illenium", "mysticwild", 2, "23:00", "00:00"),
    mk("nw-james-hype", "James Hype", "mysticwild", 1, "21:00", "22:00"),
    mk("nw-jstjr", "JSTJR", "mysticwild", 1, "20:00", "21:00"),
    mk("nw-malaa", "Malaa", "mysticwild", 1, "19:00", "20:00"),
    mk("nw-mattilo", "Mattilo", "mysticwild", 2, "15:45", "16:45"),
    mk("nw-r3hab", "R3HAB", "mysticwild", 2, "19:50", "20:50"),
    mk("nw-sabai", "SABAI", "mysticwild", 1, "18:00", "19:00"),
    mk("nw-said-the-sky-sunset-set", "Said The Sky (Sunset Set)", "mysticwild", 2, "18:50", "19:50"),
    mk("nw-seven-lions", "Seven Lions", "mysticwild", 2, "21:55", "22:55"),
    mk("nw-shima", "Shima", "mysticwild", 1, "15:00", "16:00"),
    mk("nw-sidepiece", "SIDEPIECE", "mysticwild", 2, "20:50", "21:50"),
    // ─────────── Dawn Mountain ───────────
    mk("nw-barely-alive", "BARELY ALIVE", "dawnmountain", 2, "19:30", "20:30"),
    mk("nw-callen-b2b-sektor-8", "CALLEN B2B SEKTOR 8", "dawnmountain", 1, "15:00", "16:00"),
    mk("nw-eliminate", "Eliminate", "dawnmountain", 2, "18:30", "19:30"),
    mk("nw-friction", "Friction", "dawnmountain", 2, "17:30", "18:30"),
    mk("nw-hedex", "Hedex", "dawnmountain", 2, "21:30", "22:30"),
    mk("nw-hybrid-minds", "Hybrid Minds", "dawnmountain", 1, "19:00", "20:00"),
    mk("nw-infekt-b2b-virtual-riot", "INFEKT B2B Virtual Riot", "dawnmountain", 1, "21:00", "22:00"),
    mk("nw-jkyl-and-hyde-b2b-nikita-the-wicked", "Jkyl & Hyde B2B Nikita, the Wicked", "dawnmountain", 1, "18:00", "19:00"),
    mk("nw-kompany-b2b-samplifire", "Kompany B2B Samplifire", "dawnmountain", 1, "20:00", "21:00"),
    mk("nw-layz", "LAYZ", "dawnmountain", 2, "20:30", "21:30"),
    mk("nw-nghtmre", "NGHTMRE", "dawnmountain", 1, "22:00", "23:00"),
    mk("nw-nightstalker-with-mc-dino", "Nightstalker with MC Dino", "dawnmountain", 2, "15:00", "16:30"),
    mk("nw-riot", "RIOT", "dawnmountain", 2, "16:30", "17:30"),
    mk("nw-sippy", "Sippy", "dawnmountain", 1, "17:00", "18:00"),
    mk("nw-svdden-death", "Svdden Death", "dawnmountain", 1, "23:00", "00:00"),
    mk("nw-teddy-pain-t-pain-bass-set", "Teddy Pain (T-Pain Bass Set)", "dawnmountain", 2, "23:30", "00:00"),
    mk("nw-troyboi", "TroyBoi", "dawnmountain", 2, "22:30", "23:30"),
    mk("nw-wolfie", "Wolfie", "dawnmountain", 1, "16:00", "17:00"),
    // ─────────── Aurora Plains ───────────
    mk("nw-braydon-terzo", "Braydon Terzo", "auroraplains", 1, "16:00", "17:00"),
    mk("nw-dombresky", "Dombresky", "auroraplains", 2, "23:00", "00:00"),
    mk("nw-ely-oaks", "Ely Oaks", "auroraplains", 2, "21:00", "22:00"),
    mk("nw-fleur-shore", "Fleur Shore", "auroraplains", 1, "18:00", "19:00"),
    mk("nw-gainz", "GAINZ", "auroraplains", 2, "15:00", "16:00"),
    mk("nw-green-velvet", "Green Velvet", "auroraplains", 1, "22:30", "00:00"),
    mk("nw-gudfella", "GUDFELLA", "auroraplains", 2, "19:00", "20:00"),
    mk("nw-inntraw", "Inntraw", "auroraplains", 2, "17:00", "18:00"),
    mk("nw-joshwa", "Joshwa", "auroraplains", 2, "20:00", "21:00"),
    mk("nw-juos", "Juos", "auroraplains", 2, "16:00", "17:00"),
    mk("nw-m-high", "M-High", "auroraplains", 1, "17:00", "18:00"),
    mk("nw-partiboi69", "Partiboi69", "auroraplains", 1, "21:15", "22:30"),
    mk("nw-patrick-topping", "Patrick Topping", "auroraplains", 1, "20:00", "21:15"),
    mk("nw-ragie-ban", "Ragie Ban", "auroraplains", 1, "19:00", "20:00"),
    mk("nw-tini-gessler", "Tini Gessler", "auroraplains", 2, "18:00", "19:00"),
    mk("nw-trainer-red", "Trainer Red", "auroraplains", 1, "15:00", "16:00"),
    mk("nw-walker-and-royce", "Walker & Royce", "auroraplains", 2, "22:00", "23:00"),
    // ─────────── Rave Cave ───────────
    mk("nw-b-side", "B-Side", "ravecave", 2, "17:00", "18:00"),
    mk("nw-basstripper", "Basstripper", "ravecave", 1, "22:45", "00:00"),
    mk("nw-dj-uncle-noah", "DJ Uncle Noah", "ravecave", 2, "15:00", "16:00"),
    mk("nw-ed-bailey", "Ed Bailey", "ravecave", 1, "18:00", "19:00"),
    mk("nw-john-kelley", "John Kelley", "ravecave", 2, "19:00", "20:00"),
    mk("nw-oscar-da-grouch", "Oscar Da Grouch", "ravecave", 1, "19:00", "20:00"),
    mk("nw-oscure", "Oscure", "ravecave", 2, "16:00", "17:00"),
    mk("nw-reid-speed", "Reid Speed", "ravecave", 1, "20:00", "21:30"),
    mk("nw-simply-jeff-feat-sharyn-maceren-live", "Simply Jeff feat. Sharyn Maceren (Live)", "ravecave", 2, "21:00", "22:30"),
    mk("nw-stanton-warriors", "Stanton Warriors", "ravecave", 2, "22:30", "00:00"),
    mk("nw-star-eyes", "Star Eyes", "ravecave", 2, "20:00", "21:00"),
    mk("nw-steve-leclair", "Steve Leclair", "ravecave", 1, "15:00", "16:30"),
    mk("nw-steve-loria", "Steve Loria", "ravecave", 1, "16:30", "18:00"),
    mk("nw-subsonic", "Subsonic", "ravecave", 1, "21:30", "22:45"),
    mk("nw-vitamin-d", "Vitamin D", "ravecave", 2, "18:00", "19:00"),
    // ─────────── Beatbox Boombox ───────────
    mk("nw-dack-janiels-b2b-mongrel", "Dack Janiels B2B Mongrel", "beatboxboombox", 1, "22:00", "23:00"),
    mk("nw-dances-b2b-techno-tupac", "Dances B2B Techno Tupac", "beatboxboombox", 1, "20:00", "21:00"),
    mk("nw-dmz-and-friends", "DMZ and Friends", "beatboxboombox", 1, "19:00", "20:00"),
    mk("nw-donald-glaude-b2b-thee-o", "Donald Glaude B2B Thee-O", "beatboxboombox", 2, "23:00", "00:00"),
    mk("nw-hekler", "Hekler", "beatboxboombox", 1, "21:00", "22:00"),
    mk("nw-kendo-b2b-slayy", "Kendo B2B SLAYY", "beatboxboombox", 2, "18:00", "19:00"),
    mk("nw-kittamami-b2b-tony-h", "Kittamami B2B Tony H", "beatboxboombox", 1, "18:00", "19:00"),
    mk("nw-kristin-lush", "Kristin Lush", "beatboxboombox", 2, "15:00", "16:00"),
    mk("nw-lenny-v", "Lenny V", "beatboxboombox", 2, "20:00", "21:00"),
    mk("nw-lily-ardalan", "Lily Ardalan", "beatboxboombox", 1, "16:00", "17:00"),
    mk("nw-mark-lewis", "Mark Lewis", "beatboxboombox", 2, "21:00", "22:00"),
    mk("nw-maximus-grooves", "Maximus Grooves", "beatboxboombox", 2, "19:00", "20:00"),
    mk("nw-neda", "NEDA(:", "beatboxboombox", 1, "15:00", "16:00"),
    mk("nw-nifty-nubez", "Nifty Nubez", "beatboxboombox", 2, "17:00", "18:00"),
    mk("nw-shay-de-castro", "Shay De Castro", "beatboxboombox", 2, "22:00", "23:00"),
    mk("nw-tankdubz", "TankDubz", "beatboxboombox", 2, "16:00", "17:00"),
    mk("nw-tha4saken", "THA4SAKEN", "beatboxboombox", 1, "17:00", "18:00"),
    mk("nw-woof-logik", "Woof Logik", "beatboxboombox", 1, "23:00", "00:00"),
  ];

  const CONFIG = {
    id:        "nocturnal-wonderland-2026",
    name:      "Nocturnal Wonderland 2026",
    shortName: "Nocturnal",
    brand:     "Nocturnal Wonderland",
    tagline:   "Two nights with the creatures of the night",
    location:  "Glen Helen Regional Park \u00b7 San Bernardino, CA",
    locationShort: "Glen Helen Regional Park",
    dates:     "Sep 19\u201320, 2026",
    year:      2026,
    // Official hours are 3PM-12AM daily (guide/hours-and-info). California is
    // PDT (UTC-7) in September \u2014 DST does not end until Nov 1.
    startMs: Date.UTC(2026, 8, 19, 22, 0, 0),  // Sep 19 15:00 PDT, gates
    endMs:   Date.UTC(2026, 8, 21,  7, 0, 0),  // Sep 21 00:00 PDT, close of night 2
    tz:      "America/Los_Angeles",
    tzAbbr:  "PDT",
    utcOffsetHours: -7,
    dayDates: {
      1: { y: 2026, m: 8, d: 19, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 8, 19, 7, 0, 0) },
      2: { y: 2026, m: 8, d: 20, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 8, 20, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at the OSM centroid, converted to PDT.
    sunTimes: {
      1: { rise: "06:34", set: "18:51" },
      2: { rise: "06:35", set: "18:50" },
    },
    // OpenStreetMap centroid of the Glen Helen festival grounds, not a street
    // geocode. Radius covers the whole park, which is larger than the
    // amphitheater bowl the name suggests.
    gps: { lat: 34.20459, lng: -117.40173, onSiteRadiusMi: 0.6 },
    venue: {
      name:    "Glen Helen Regional Park",
      address: "2555 Glen Helen Pkwy, San Bernardino, CA 92407",
      // The SURVEY. OSM way 233008517, amenity=festival_grounds, 85 vertices,
      // 558 m E-W x 676 m N-S — the actual festival-grounds ring, added
      // 2026-09-06 (#76) so the venue-footprint gate RUNS here the moment the
      // flip adds anchors. It only checks festivals that declare a footprint,
      // and Lost Lands showed what that gap costs: four invented anchors sat
      // outside their venue for weeks because nothing was watching.
      footprint: [
          [34.20677, -117.40236], [34.20638, -117.40256], [34.20589, -117.40277],
          [34.20546, -117.40297], [34.20524, -117.40307], [34.20500, -117.40319],
          [34.20482, -117.40338], [34.20473, -117.40347], [34.20452, -117.40367],
          [34.20417, -117.40401], [34.20376, -117.40444], [34.20297, -117.40526],
          [34.20271, -117.40577], [34.20255, -117.40575], [34.20239, -117.40572],
          [34.20230, -117.40567], [34.20210, -117.40556], [34.20191, -117.40542],
          [34.20183, -117.40537], [34.20176, -117.40531], [34.20171, -117.40524],
          [34.20168, -117.40515], [34.20154, -117.40464], [34.20149, -117.40428],
          [34.20153, -117.40343], [34.20167, -117.40267], [34.20186, -117.40191],
          [34.20191, -117.40188], [34.20193, -117.40186], [34.20195, -117.40182],
          [34.20188, -117.40173], [34.20189, -117.40169], [34.20191, -117.40164],
          [34.20194, -117.40160], [34.20219, -117.40121], [34.20231, -117.40096],
          [34.20255, -117.40045], [34.20269, -117.40023], [34.20284, -117.40010],
          [34.20297, -117.39998], [34.20314, -117.39990], [34.20337, -117.39982],
          [34.20357, -117.39975], [34.20376, -117.39971], [34.20427, -117.39976],
          [34.20448, -117.39982], [34.20467, -117.39990], [34.20481, -117.39996],
          [34.20497, -117.40004], [34.20515, -117.40019], [34.20525, -117.40026],
          [34.20537, -117.40036], [34.20543, -117.40042], [34.20550, -117.40056],
          [34.20546, -117.40083], [34.20553, -117.40086], [34.20556, -117.40086],
          [34.20557, -117.40092], [34.20559, -117.40098], [34.20568, -117.40106],
          [34.20570, -117.40104], [34.20576, -117.40108], [34.20574, -117.40112],
          [34.20567, -117.40131], [34.20596, -117.40153], [34.20604, -117.40159],
          [34.20608, -117.40165], [34.20610, -117.40171], [34.20611, -117.40177],
          [34.20643, -117.40194], [34.20653, -117.40196], [34.20661, -117.40197],
          [34.20669, -117.40199], [34.20680, -117.40203], [34.20689, -117.40207],
          [34.20690, -117.40205], [34.20692, -117.40204], [34.20708, -117.40228],
          [34.20716, -117.40237], [34.20722, -117.40240], [34.20757, -117.40240],
          [34.20756, -117.40247], [34.20757, -117.40257], [34.20728, -117.40263],
          [34.20677, -117.40236],
      ],
      // The BOX, kept deliberately. It is not a worse footprint — the two
      // remaining consumers want a rectangle and nothing else will do: the
      // basemap clip mask (an outer ring with a hole punched in it) and
      // map.setMaxBounds, which takes a bbox by definition. Everything that
      // wants the real outline reads `footprint` and map.jsx already prefers
      // it. Its numbers are this polygon's own bounding box, so they cannot
      // drift apart.
      festivalBounds: { north: 34.2075695, south: 34.2014929,
                        west: -117.4057721, east: -117.3997092 },
    },
    weatherEndpoint: "https://api.weather.gov/points/34.2046,-117.4017",
    // Mystic Wild is the main stage: it is first on the official stages page
    // and carries deadmau5, Illenium and Seven Lions.
    mainStageId: "mysticwild",
    // ── THE MAP ──
    // Layout comes from the 2025 OFFICIAL map (founder call 2026-09-06: use
    // 2025 if 2026 does not exist). nocturnal-2026.svg is GENERATED from the
    // stage coordinates below — no festival artwork is reproduced, per the
    // lostlands-2026.jpg precedent.
    mapImage: "nocturnal-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "forest",
    // The plate prints no stage names, so the pills carry them.
    mapPrintsStageNames: false,
    // ⚠ NO gpsAnchors, deliberately, and this is the important line.
    // The 2025 map gives RELATIVE LAYOUT — which stage sits where, relative to
    // the others. It does NOT give world coordinates, and converting poster
    // space into lat/lng is precisely the defect PR #36 removed from EDC LV
    // and the 2026-09-06 re-survey found on three more festivals. So the art
    // places the pins and nothing claims to register them to the ground: no
    // affine, so the v257/v260 gate suppresses every distance and walk time,
    // and the blue dot stays on the real-map layer where it is actually true.
    mapArtIsGeoregistered: false,
    // Flip markers, read by humans rather than by code.
    setTimesProvisional: false,
    // Published policy: 18+ to enter, 21+ for alcohol/VIP.
    policies: { minimumAge: 18, alcoholAge: 21 },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["nocturnal-wonderland-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Live with official set times. The map remains unregistered until 2026 art publishes.
    registry: { available: true, accent: "#a855f7", emoji: "🌙", region: "North America" },
  };
})();

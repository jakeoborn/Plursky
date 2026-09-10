// ═══════════════════════════════════════════════════════════════════════
// DECADENCE COLORADO 2026 — Colorado Convention Center · Denver, CO
// Dec 30–31, 2026
// ═══════════════════════════════════════════════════════════════════════
// GATED SCAFFOLD, and a notably RICH one. The lineup is complete, the DAY
// SPLIT IS PUBLISHED, the hours are published and the venue is a named
// surveyed building. What is missing is stages and set times.
//
// ⛔ SOURCING TRAP, CARRY IT PERMANENTLY (#113): `decadencenye.CO` is a
//   RESALE MARKETPLACE that serves a FABRICATED lineup. The festival is
//   `decadencenye.COM`. One character, and the wrong one hands you a
//   confident, plausible, entirely invented artist list. Every source below
//   is .COM and was read on 2026-09-10.
//
// ── SOURCES ──
//
// LINEUP: decadencenye.com/lineup/ — 23 acts, parsed from the
//   `a.artist-container > .artist-name > span` nodes, not from page text.
//   The page carries TWO renderings of the same lineup, an "Alphabetical"
//   tab and an "Artists By Day" tab, and they were cross-checked against
//   each other rather than one being trusted:
//     alphabetical  23
//     Dec 30        13
//     Dec 31        10
//     13 + 10 = 23, zero acts on both days, and the day union is exactly
//     the alphabetical set. A clean partition, verified by set difference.
//
//   ⚠ THE "+" HERE IS DECORATION, NOT A CO-BILLING — the exact inverse of
//   the Dreamstate SoCal trap in the module next door. Between every two
//   artists this page emits `<div class="artist-divider">+</div>`. Reading
//   the page as text gives "Alesso + ALLEYCVT + Black Tiger Sex Machine …",
//   which looks precisely like Dreamstate's genuinely co-billed rows. There,
//   splitting on "+" invents 11 billings that do not exist; here, NOT
//   splitting on "+" would collapse 23 artists into one. The same character
//   means opposite things on two official festival sites, so the rule cannot
//   be about the character: parse the ELEMENT that holds one artist, which
//   on this site is the `<a>` with its own /artist/<slug>/ href.
//
// DAY SPLIT: the same page's "Artists By Day" tab, under the headings
//   "December 30th" and "December 31st". This is the FIRST of the recent
//   gated scaffolds where the split is actually published — III Points,
//   CRSSD and Dreamstate SoCal all had to fall back to a single TBA bucket.
//   Real days ship here, and this module needs no TBA workaround at all.
//
// DATES + HOURS: decadencenye.com/about/ — "Date: Wednesday, December 30th
//   & Thursday, December 31st 2026", "Hours: Venue Doors & Will Call Open at
//   5:00pm, Event Runs 6:00pm-2:00am Daily". Corroborated by the FAQ:
//   "Q: What are the event times? A: 6:00pm-2:00am Daily".
// VENUE + AGE + RE-ENTRY: decadencenye.com/about/ and /venue-info/ —
//   "Colorado Convention Center, 700 14th St, Denver, CO 80202",
//   "18+ Entry. 21+ for Bars", "Re-entry is not permitted".
// SET TIMES + MAP, explicitly unpublished: FAQ — "Q: Will set times and a
//   map of the show be released in advance? A: Set times and map will come
//   closer to event." That is the gate, in the festival's own words.
// VENUE GEOMETRY: OpenStreetMap way 26281758 "Colorado Convention Center",
//   `building=civic`, `addr:housenumber=700`, `addr:street=14th Street` —
//   which matches the official address exactly, so the building identity is
//   confirmed by the data and not by a name search. 117 vertices, 100,416 m²,
//   centroid 39.742394,-104.996650, fetched from the OSM map API 2026-09-10.
// SUN TIMES: api.sunrise-sunset.org at that centroid, 2026-09-10.
//
// ── THE VENUE IS INDOORS, AND THAT IS NEW HERE ──
//
// Every other festival in the registry is an outdoor site. This one is
// 400,000+ sq ft of exhibit hall inside a downtown building, and three
// consequences are written down rather than discovered later:
//
//   1. THE FOOTPRINT IS THE BUILDING, NOT THE FESTIVAL. The OSM polygon is
//      the whole convention center — 100,416 m² (1,080,873 sq ft). The
//      official copy says "Over 400,000 square feet of the exhibit halls
//      will be transformed into two massive arenas", so the event occupies
//      roughly 40% of it. Unlike Dreamstate's ship, shipping this footprint
//      is still correct: every attendee is inside this polygon, and the
//      halls used are not a separately surveyable feature. It bounds, it
//      does not claim.
//   2. THE BLUE DOT IS INDOORS. GPS degrades badly inside a steel-framed
//      building; a phone here is usually on wifi/cell positioning. The
//      on-site radius is sized off the polygon (228 m worst-case vertex
//      radius → 0.25 mi covers the whole building) so arrival detection has
//      slack. No distance or ETA readouts are possible anyway — there are no
//      anchors and no grid, so the distance-readout gate withholds them.
//      Whether indoor accuracy is good enough for anything finer is an OPEN
//      question and belongs to the flip, measured on site, not guessed here.
//   3. THERE ARE TWO STAGES AND THEY HAVE NO PUBLISHED NAMES. "two massive
//      arenas" is the only official statement about them — a count, with no
//      names, no positions and no act assignments. So STAGES is empty and
//      every act is stage: null. Do NOT borrow names from a previous
//      Decadence; this is the same trap Nocturnal carries.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-09-10, do not fabricate) ──
//
// STAGE NAMES + COUNT-BEYOND-TWO. Only "two massive arenas".
// SET TIMES. The FAQ says twice that they come closer to the event.
// SITE MAP. Same answer. /map/ is a street address page, not a site plan.
// AMENITY POSITIONS. The amenities themselves ARE published on /venue-info/
//   — smoking area, food & beverage, multiple 21+ bars, coat check in the
//   lobby, ATMs, water refill stations, will call inside the lobby near the
//   main entrance. Every one of them lacks a position, and an AMENITIES row
//   requires x/y, so AMENITIES is empty and the list above is the flip lead.
// SIDE PROGRAMMING. The site advertises a Silent Disco and Pre & Recovery
//   Parties. Neither is a stage in the lineup sense and neither is dated
//   here; check at the flip before modelling them.
//
// ── SPATIAL MODEL ──
// mapMode: "real" — real street tiles over the surveyed building outline and
// the live blue dot. No map art, no grid, no gpsAnchors: there is no site
// plan to register, and a convention center's interior is not something a
// basemap shows. Same posture as CRSSD (#79 lineage), with a footprint that
// is a genuinely surveyed building rather than a park drawn from knowledge.
//
// ── FLIP CHECKLIST (set times + map, ~late Dec) ──
//   1. Stage names from the official map or set-time grid — two of them,
//      unless the map says otherwise. Never from a previous year.
//   2. Real positions per stage IF the released map is a site plan that can
//      be registered; if it is a schematic of hall interiors, it is NOT
//      georeferenceable and the stages stay position-less. Decide by looking.
//   3. start/end + stage per act; drop `provisional`.
//   4. amenities from the map legend, using the list above as the checklist.
//   5. mainStageId once the grid names the bigger arena.
//   6. Re-measure indoor GPS on site before trusting any distance readout.
//   7. registry.available → true.
//   8. Re-run node scripts/gen-festival-pages.mjs and commit the result.
(function () {
  "use strict";

  // "Two massive arenas" is the whole official statement — a count with no
  // names. Empty on purpose, and the app must stay correct with it empty.
  const STAGES = [];

  // Published as a list, unpublished as positions — see the header. An
  // AMENITIES row requires x/y, and there is no map to take one from.
  const AMENITIES = [];

  // Day is REAL here. Stage and set time are not. `tier` drives lineup card
  // weighting; with no times there is no basis to rank, so every act sits at
  // the same tier rather than being silently ordered by a guess.
  // `provisional: true` marks the whole set for the flip session.
  const mk = (id, name, day) => ({
    id, name, genre: "\u2014", country: "\u2014",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #d946ef, #0b0620)",
    bio: "Playing Decadence Colorado 2026 on " +
         (day === 1 ? "December 30" : "December 31") +
         ". Stage and set time are not published yet \u2014 the official " +
         "schedule and map drop closer to the event.",
    provisional: true,
  });

  // IDs are internal. Every DISPLAY name below is the official string
  // verbatim, stylised characters included ("YØU$UK€ ¥UK1MAT$U", the curly
  // apostrophe in "it’s murph"). The id for the first is a transliteration,
  // because the site's own slug URL-encodes to `¥ouuke-¥uk1matu` and is not
  // usable as one.
  const ARTISTS = [
    // ── Dec 30 (day 1) ── 13 acts
    mk("dec-alesso",                    "Alesso", 1),
    mk("dec-black-tiger-sex-machine",   "Black Tiger Sex Machine", 1),
    mk("dec-daniel-allan",              "Daniel Allan", 1),
    mk("dec-deathpact",                 "Deathpact", 1),
    mk("dec-dj-snake",                  "DJ Snake", 1),
    mk("dec-excision",                  "Excision", 1),
    mk("dec-green-velvet",              "Green Velvet", 1),
    mk("dec-lane-8",                    "Lane 8", 1),
    mk("dec-seven-lions",               "Seven Lions", 1),
    mk("dec-sullivan-king",             "Sullivan King", 1),
    mk("dec-yousuke-yukimatsu",         "YØU$UK€ ¥UK1MAT$U", 1),
    mk("dec-zeds-dead",                 "Zeds Dead", 1),
    mk("dec-zingara",                   "Zingara", 1),

    // ── Dec 31 (day 2) ── 10 acts
    mk("dec-alleycvt",                  "ALLEYCVT", 2),
    mk("dec-crankdat",                  "Crankdat", 2),
    mk("dec-gorillat",                  "GorillaT", 2),
    mk("dec-griz",                      "GRiZ", 2),
    mk("dec-isoxo",                     "ISOxo", 2),
    mk("dec-its-murph",                 "it’s murph", 2),
    mk("dec-kasbo",                     "Kasbo", 2),
    mk("dec-levity",                    "Levity", 2),
    mk("dec-marshmello",                "Marshmello", 2),
    mk("dec-the-resistance",            "The Resistance", 2),
  ];

  const CONFIG = {
    id:        "decadence-colorado-2026",
    name:      "Decadence Colorado 2026",
    shortName: "Decadence",
    brand:     "Decadence NYE",
    tagline:   "Two nights indoors to close out the year in Denver",
    location:  "Colorado Convention Center \u00b7 Denver, CO",
    locationShort: "Colorado Convention Center",
    dates:     "Dec 30\u201331, 2026",
    year:      2026,
    // Denver is MST (UTC-7) on these dates. Hours ARE published, so these
    // are the real ones: doors 5 PM Dec 30, last night ends 2 AM Jan 1.
    startMs: Date.UTC(2026, 11, 31, 0, 0, 0),   // Dec 30 17:00 MST, doors
    endMs:   Date.UTC(2027,  0,  1, 9, 0, 0),   // Jan 1 02:00 MST, close
    tz:      "America/Denver",
    tzAbbr:  "MST",
    utcOffsetHours: -7,
    // ⚠ NOTE THE YEAR BOUNDARY. Night 2 starts Dec 31 2026 and ends at
    // 02:00 on Jan 1 2027. `year` is the festival's year, not the end date's.
    //
    // TWO REAL DAYS, not a TBA bucket — the day split is published and was
    // cross-checked (see header). This is the first of the recent gated
    // scaffolds that did not need the III Points workaround.
    dayDates: {
      1: { y: 2026, m: 11, d: 30, name: "Dec 30", short: "WED",
           midnightUtc: Date.UTC(2026, 11, 30, 7, 0, 0) },
      2: { y: 2026, m: 11, d: 31, name: "Dec 31", short: "NYE",
           midnightUtc: Date.UTC(2026, 11, 31, 7, 0, 0) },
    },
    // api.sunrise-sunset.org at 39.742394,-104.996650, converted to MST.
    // Dec 30 and Dec 31 are identical to the minute at both ends.
    sunTimes: {
      1: { rise: "07:19", set: "16:46" },
      2: { rise: "07:19", set: "16:46" },
    },
    // Polygon centroid of the OSM building way, not a street geocode. Worst
    // vertex sits 228 m out, so 0.25 mi (402 m) covers the whole building
    // with slack for an indoor fix.
    gps: { lat: 39.742394, lng: -104.996650, onSiteRadiusMi: 0.25 },
    venue: {
      name:    "Colorado Convention Center",
      address: "700 14th St, Denver, CO 80202",
      terrain: "indoor exhibit halls",
      // OpenStreetMap way 26281758, all 117 vertices VERBATIM at OSM's own
      // precision — no decimation, so there is no epsilon for a future
      // reader to wonder about. 100,416 m². This is the BUILDING; the event
      // uses 400,000+ sq ft of it. See the header before reading it as the
      // festival perimeter.
      footprint: [
        [39.7443483, -104.996556], [39.744366, -104.9965002], [39.7443708, -104.9964503],
        [39.7443689, -104.9964085], [39.7444321, -104.9963955], [39.7444184, -104.9963271],
        [39.7443924, -104.9962719], [39.7443533, -104.9962272], [39.7443382, -104.9962125],
        [39.7440157, -104.9958986], [39.7439885, -104.995872], [39.7439604, -104.9958446],
        [39.7439289, -104.995814], [39.7438137, -104.9957018], [39.7438069, -104.9956952],
        [39.7437847, -104.995655], [39.7437797, -104.995646], [39.7437721, -104.9956323],
        [39.7432233, -104.9946414], [39.7432173, -104.9946306], [39.7431312, -104.994487],
        [39.7431217, -104.994507], [39.7430155, -104.994732], [39.7428883, -104.9945366],
        [39.7428467, -104.9945909], [39.74273, -104.9947432], [39.7426901, -104.9946905],
        [39.742619, -104.9945966], [39.7427077, -104.9944678], [39.7427324, -104.9944106],
        [39.7427428, -104.99435], [39.7427404, -104.9942946], [39.7427306, -104.9942521],
        [39.7427171, -104.9942123], [39.7426907, -104.9941718], [39.7426609, -104.9941421],
        [39.7426318, -104.994125], [39.7426068, -104.9941154], [39.7425667, -104.9941139],
        [39.7425337, -104.9941212], [39.7425007, -104.9941382], [39.74248, -104.994154],
        [39.7417949, -104.9950403], [39.7412035, -104.9958043], [39.7408795, -104.9962238],
        [39.7405909, -104.9965979], [39.7405599, -104.9966527], [39.7405399, -104.9967156],
        [39.7405328, -104.9967682], [39.7405335, -104.9968215], [39.7405544, -104.9969143],
        [39.7405907, -104.9969825], [39.740642, -104.9970347], [39.7406813, -104.9970571],
        [39.7407233, -104.997069], [39.7407831, -104.997067], [39.7408484, -104.9970384],
        [39.7409028, -104.9969853], [39.7409398, -104.996918], [39.7409594, -104.9968445],
        [39.7409633, -104.9967809], [39.7409559, -104.996707], [39.7409655, -104.9967197],
        [39.7410442, -104.9968247], [39.741103, -104.9969038], [39.7409983, -104.9970091],
        [39.7410886, -104.9971732], [39.7411486, -104.9972785], [39.7410102, -104.9972898],
        [39.74091, -104.997157], [39.7408653, -104.9971562], [39.7407958, -104.9972461],
        [39.740822, -104.9972768], [39.7408114, -104.9972912], [39.7407306, -104.997255],
        [39.7406988, -104.9972407], [39.7406707, -104.997339], [39.7406418, -104.9974719],
        [39.7406412, -104.9975372], [39.7406403, -104.9976376], [39.7406596, -104.9977993],
        [39.7406877, -104.9978945], [39.7407047, -104.9979522], [39.7407719, -104.9980818],
        [39.7408602, -104.9981988], [39.7409946, -104.9983106], [39.7411369, -104.9983682],
        [39.7412957, -104.9983803], [39.741428, -104.9983534], [39.7414912, -104.9983234],
        [39.7415043, -104.9983474], [39.7416496, -104.9981249], [39.7417325, -104.9982645],
        [39.7417592, -104.9983094], [39.7418028, -104.9983829], [39.7418245, -104.9984195],
        [39.7420961, -104.9988768], [39.7421699, -104.9987309], [39.7421875, -104.9987033],
        [39.7422935, -104.9988618], [39.7423665, -104.9989721], [39.7423846, -104.9989489],
        [39.7423945, -104.9989626], [39.7424025, -104.9989737], [39.742439, -104.9990238],
        [39.7424882, -104.998963], [39.7426251, -104.9987853], [39.7426545, -104.9987467],
        [39.7427694, -104.9985887], [39.7435419, -104.9975942], [39.7435568, -104.9976144],
        [39.743562, -104.9976215], [39.7435814, -104.997596], [39.7436497, -104.997506],
        [39.7436447, -104.9974994], [39.7436302, -104.9974805], [39.7438641, -104.9971793],
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/39.7424,-104.9967",
    mainStageId: null,
    // ── THE MAP ──
    // No mapImage, no mapStyle: "image-overlay", no gpsAnchors. Opens
    // straight into the real basemap. See the header for why that is the
    // honest choice for an indoor venue rather than a fallback.
    mapMode: "real",
    mapPrintsStageNames: false,
    // Nothing to register — not a waiver.
    mapArtIsGeoregistered: false,
    // Flip marker, read by humans rather than by code.
    setTimesProvisional: true,
    // Published policy: 18+ entry, 21+ bars, no re-entry, and smoking
    // prohibited inside the convention center (designated areas only).
    policies: { minimumAge: 18, alcoholAge: 21, reentry: false, smokeFree: true },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["decadence-colorado-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // GATED: stage names, stage assignments, set times and the official map
    // are all unpublished. The lineup and the day split are real.
    registry: { available: false, accent: "#d946ef", emoji: "\u2728", region: "North America" },
  };
})();

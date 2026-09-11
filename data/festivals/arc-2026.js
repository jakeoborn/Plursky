// ═══════════════════════════════════════════════════════════════════════
// ARC MUSIC FESTIVAL 2026 — Union Park · Chicago, IL
// Sep 4–7, 2026 (Labor Day weekend)
// ═══════════════════════════════════════════════════════════════════════
// A COMPLETE build off official artifacts: four stages, four days, 96 real
// sets with real start/end times. The only thing missing is a patron map,
// and that is missing because ARC never published one — see below.
//
// ⚠ THE QUEUE ROW SAID "Sep 4–6". IT IS WRONG. Issue #57 lists ARC as a
// three-day festival. The official set-time graphics are headed FRI SEPT 04,
// SAT SEPT 05, SUN SEPT 06 and MON SEPT 07, and every page on the site
// reads "SEPT 4th - 7th 2026". It is a FOUR-day Labor Day festival. A build
// that trusted the backlog row would have silently dropped 25 Monday sets,
// including Green Velvet, Honey Dijon, Derrick Carter and Michael Bibi.
//
// SOURCE set times: arcmusicfestival.com/set-times — the four official grid
//   images ARC2026_SetTimes_IG_02-2, _03-4, _04-4 and _05-2 (1200x1500),
//   read 2026-09-06. Every start/end below is off those grids. All four
//   stages run 2:00 PM – 10:00 PM every day.
// SOURCE stages: the same four column headers, cross-checked against the
//   site's own `stage` taxonomy (wp-sitemap-taxonomies-stage-1.xml).
//   ⚠ The taxonomy lists FIVE terms — the-grid, expansions, area-909 and
//   elrow. elrow is NOT a 2026 festival stage: it is the recurring elrow
//   takeover brand (see /2025/04/elrow-theme-announced/) and appears on no
//   2026 grid. The Midway, which DOES appear on all four grids, has no
//   taxonomy term at all. Trust the grids, not the taxonomy.
// SOURCE hours + policy: arcmusicfestival.com/faqs, read 2026-09-06 —
//   "What are the hours of the festival? 2pm – 10pm", "ARC is 18+",
//   "No. Tickets are only valid for one entry to the festival per day.
//   No re-entry.", "This is a cash-free event!".
// SOURCE venue: OpenStreetMap relation 20437366 (Union Park, Near West
//   Side, Chicago), via Nominatim 2026-09-06.
// SOURCE sun times: api.sunrise-sunset.org at the venue, converted to CDT.
//
// ── WHAT IS NOT PUBLISHED (verified 2026-09-06, do not fabricate) ──
// PATRON MAP: absent, and absent on purpose — ARC's own FAQ says the
//   accessibility hub "will be labeled on the event map WHEN IT IS
//   RELEASED", i.e. the map is an on-site/app artifact, not a web one.
//   Three independent checks, all negative:
//     1. /wp-sitemap.xml enumerates all 30 pages. No map page. (This is
//        the check that the HARD Summer build learned the hard way — see
//        the ⛔ note in hard-summer-2026.js. Do it FIRST, always.)
//     2. /info/, /location/, /stages/ and /plot-layouts-reference-page/
//        reference no 2026 image asset at all. /stages/ is still lorem
//        ipsum — an unpublished template, not a stub we should mine.
//     3. Wayback CDX over the site's ENTIRE archived history:
//        cdx/search/cdx?url=arcmusicfestival.com*&filter=original:.*map.*
//        returns ZERO rows. No ARC URL has ever contained "map".
//   ⛔ CDX REGEX GOTCHA, and it cost real time here: the `filter` regex
//   silently matches NOTHING for a bracket class like `.*[Mm][Aa][Pp].*`.
//   It returns an empty body and HTTP 200 — indistinguishable from a
//   genuine "no results". Use a plain lowercase `.*map.*` (CDX already
//   folds case in the urlkey), and ALWAYS run a control query you know
//   matches before you believe an empty one.
// STAGE POSITIONS: absent, and therefore not here. See SPATIAL MODEL.
// STAGE COLOURS: ARC publishes none — the grid graphics are one shared
//   lime→cyan gradient across all four columns, and the stage logos are
//   white on black. The four hexes below are APP-ASSIGNED for legibility
//   and contrast, not brand values. Do not cite them as official.
//
// ── SPATIAL MODEL ──
// `mapMode: "real"` — real basemap over the surveyed park, live blue dot,
// venue outline. No stage x/y, no gpsAnchors, no map art. Union Park is
// 265 x 247 m; the whole festival fits inside one screen of real basemap,
// which is a better artifact than an invented plate would be.
//
// ── ANCHOR PROVENANCE (SPEC-add-festivals tiering) ──
// gpsAnchors: NONE. Not T3, not provisional, ABSENT. MAP_AFFINE stays
// null and the v257/v260 gate suppresses every distance and walk-time
// readout. The v268 registration gate covers the three-place wiring.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // Colours are app-assigned (see header) — ARC publishes no stage palette.
  const STAGES = [
    { id: "grid", name: "The Grid", short: "GRID", color: "#C4F82A", size: 1.6,
      desc: "Main stage" },
    { id: "expansions", name: "Expansions", short: "EXPAND", color: "#FF5C39", size: 1.5,
      desc: "House + techno" },
    { id: "area909", name: "area909", short: "909", color: "#8B5CF6", size: 1.4,
      desc: "Underground · daily takeovers" },
    { id: "midway", name: "The Midway", short: "MIDWAY", color: "#22C3E6", size: 1.4,
      desc: "Open-air" },
  ];

  // No amenity map published — see the header.
  const AMENITIES = [];

  // `tier` is derived from set hour exactly as in the other 2026 modules:
  // 19:00+ headline, 16:00+ mid, else opener. `crew` carries the collective
  // members that the official graphic prints as a sub-line.
  const mk = (id, name, stage, day, start, end, crew) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 19 ? 3 : h >= 16 ? 2 : 1;
    const st = STAGES.find(s => s.id === stage) || STAGES[0];
    return { id, name, genre: "—", country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${st.color}, #0a1420)`,
      bio: crew
        ? `${crew} — played ARC Music Festival 2026 on the ${st.name} stage.`
        : `Played ARC Music Festival 2026 on the ${st.name} stage.` };
  };

  const ARTISTS = [
    // ─────────── FRI Sep 4 · The Grid ───────────
    mk("arc-virago-grid-d1", "VIRAGO", "grid", 1, "14:00", "15:00"),
    mk("arc-invt-grid-d1", "INVT", "grid", 1, "15:00", "16:00"),
    mk("arc-azzecca-grid-d1", "AZZECCA", "grid", 1, "16:00", "17:30"),
    mk("arc-ki-ki-grid-d1", "KI/KI", "grid", 1, "17:30", "19:00"),
    mk("arc-chase-and-status-grid-d1", "CHASE & STATUS", "grid", 1, "19:00", "20:30"),
    mk("arc-sara-landry-presents-eternalism-grid-d1", "SARA LANDRY PRESENTS ETERNALISM", "grid", 1, "20:45", "22:00"),
    // ─────────── FRI Sep 4 · Expansions ───────────
    mk("arc-muffy-expansions-d1", "MUFFY", "expansions", 1, "14:00", "15:00"),
    mk("arc-idemi-expansions-d1", "IDEMI", "expansions", 1, "15:00", "16:00"),
    mk("arc-tiga-b2b-brunello-expansions-d1", "TIGA B2B BRUNELLO", "expansions", 1, "16:00", "17:30"),
    mk("arc-max-dean-b2b-luke-dean-expansions-d1", "MAX DEAN B2B LUKE DEAN", "expansions", 1, "17:30", "19:00"),
    mk("arc-prospa-expansions-d1", "PROSPA", "expansions", 1, "19:00", "20:30"),
    mk("arc-chris-stussy-expansions-d1", "CHRIS STUSSY", "expansions", 1, "20:30", "22:00"),
    // ─────────── FRI Sep 4 · area909 ───────────
    mk("arc-frechette-area909-d1", "FRECHETTE", "area909", 1, "14:00", "15:00"),
    mk("arc-canary-yellow-area909-d1", "CANARY YELLOW", "area909", 1, "15:00", "16:00"),
    mk("arc-camoufly-area909-d1", "CAMOUFLY", "area909", 1, "16:00", "17:00"),
    mk("arc-zulan-area909-d1", "ZULAN", "area909", 1, "17:00", "18:00"),
    mk("arc-silva-bumpa-area909-d1", "SILVA BUMPA", "area909", 1, "18:00", "19:00"),
    mk("arc-pegassi-area909-d1", "PEGASSI", "area909", 1, "19:00", "20:00"),
    mk("arc-bad-boombox-b2b-mischluft-area909-d1", "BAD BOOMBOX B2B MISCHLUFT", "area909", 1, "20:00", "21:00"),
    mk("arc-joy-orbison-b2b-ben-ufo-area909-d1", "JOY ORBISON B2B BEN UFO", "area909", 1, "21:00", "22:00"),
    // ─────────── FRI Sep 4 · The Midway ───────────
    mk("arc-dabura-b2b-anna-maria-midway-d1", "DABURA B2B ANNA MARIA", "midway", 1, "14:00", "16:00"),
    mk("arc-notre-dame-midway-d1", "NOTRE DAME", "midway", 1, "16:00", "17:30"),
    mk("arc-korolova-b2b-kasia-midway-d1", "KOROLOVA B2B KASIA", "midway", 1, "17:30", "19:00"),
    mk("arc-eli-and-fur-b2b-cristoph-midway-d1", "ELI & FUR B2B CRISTOPH", "midway", 1, "19:00", "20:30"),
    mk("arc-meduza-b2b-genesi-midway-d1", "MEDUZA B2B GENESI", "midway", 1, "20:30", "22:00"),
    // ─────────── SAT Sep 5 · The Grid ───────────
    mk("arc-m3rch-grid-d2", "M3RCH", "grid", 2, "14:00", "15:00"),
    mk("arc-tr-s-mortimer-b2b-cole-knight-grid-d2", "TRÈS MORTIMER B2B COLE KNIGHT", "grid", 2, "15:00", "16:00"),
    mk("arc-omarplus-b2b-obsk-r-grid-d2", "OMAR+ B2B OBSKÜR", "grid", 2, "16:00", "17:30"),
    mk("arc-odd-mob-grid-d2", "ODD MOB", "grid", 2, "17:30", "19:00"),
    mk("arc-cloonee-grid-d2", "CLOONEE", "grid", 2, "19:00", "20:25"),
    mk("arc-mau-p-grid-d2", "MAU P", "grid", 2, "20:30", "22:00"),
    // ─────────── SAT Sep 5 · Expansions ───────────
    mk("arc-flores-negras-expansions-d2", "FLORES NEGRAS", "expansions", 2, "14:00", "15:00"),
    mk("arc-dj-hyperactive-b2b-lindsey-herbert-expansions-d2", "DJ HYPERACTIVE B2B LINDSEY HERBERT", "expansions", 2, "15:00", "16:00"),
    mk("arc-dax-j-live-expansions-d2", "DAX J LIVE", "expansions", 2, "16:00", "17:00"),
    mk("arc-999999999-expansions-d2", "999999999", "expansions", 2, "17:00", "18:30"),
    mk("arc-i-hate-models-expansions-d2", "I HATE MODELS", "expansions", 2, "18:30", "20:30"),
    mk("arc-nico-moreno-expansions-d2", "NICO MORENO", "expansions", 2, "20:30", "22:00"),
    // ─────────── SAT Sep 5 · area909 ───────────
    mk("arc-superjane-area909-d2", "SUPERJANE", "area909", 2, "14:00", "16:00", "DJ Heather, Colette, DJ Lady D, Dayhota"),
    mk("arc-chaos-in-the-cbd-area909-d2", "CHAOS IN THE CBD", "area909", 2, "16:00", "17:30"),
    mk("arc-detroit-love-area909-d2", "DETROIT LOVE", "area909", 2, "17:30", "19:00", "Carl Craig, Moodymann, Stacey Pullen"),
    mk("arc-salute-area909-d2", "SALUTE", "area909", 2, "19:00", "20:30"),
    mk("arc-the-blessed-madonna-b2b-lil-louis-area909-d2", "THE BLESSED MADONNA B2B LIL' LOUIS", "area909", 2, "20:30", "22:00"),
    // ─────────── SAT Sep 5 · The Midway ───────────
    mk("arc-jj-illgen-b2b-janesita-midway-d2", "JJ ILLGEN B2B JANESITA", "midway", 2, "14:00", "15:30"),
    mk("arc-laurence-guy-b2b-monty-kiddo-midway-d2", "LAURENCE GUY B2B MONTY KIDDO", "midway", 2, "15:30", "17:00"),
    mk("arc-discip-b2b-roddy-lima-midway-d2", "DISCIP B2B RODDY LIMA", "midway", 2, "17:00", "18:30"),
    mk("arc-luuk-van-dijk-b2b-sidney-charles-midway-d2", "LUUK VAN DIJK B2B SIDNEY CHARLES", "midway", 2, "18:30", "20:00"),
    mk("arc-nicole-moudaber-b2b-paco-osuna-b2b-dubfire-midway-d2", "NICOLE MOUDABER B2B PACO OSUNA B2B DUBFIRE", "midway", 2, "20:00", "22:00"),
    // ─────────── SUN Sep 6 · The Grid ───────────
    mk("arc-banchan-grid-d3", "BANCHAN", "grid", 3, "14:00", "15:00"),
    mk("arc-son-of-son-grid-d3", "SON OF SON", "grid", 3, "15:00", "16:00"),
    mk("arc-swimming-paul-grid-d3", "SWIMMING PAUL", "grid", 3, "16:00", "17:20"),
    mk("arc-chris-avantgarde-b2b-kevin-de-vries-grid-d3", "CHRIS AVANTGARDE B2B KEVIN DE VRIES", "grid", 3, "17:20", "18:50"),
    mk("arc-underworld-grid-d3", "UNDERWORLD", "grid", 3, "19:15", "20:15"),
    mk("arc-anyma-grid-d3", "ANYMA", "grid", 3, "20:30", "22:00"),
    // ─────────── SUN Sep 6 · Expansions ───────────
    mk("arc-nick-c-expansions-d3", "NICK C", "expansions", 3, "14:00", "15:00"),
    mk("arc-locklead-expansions-d3", "LOCKLEAD", "expansions", 3, "15:00", "16:00"),
    mk("arc-jamback-b2b-marsolo-expansions-d3", "JAMBACK B2B MARSOLO", "expansions", 3, "16:00", "17:30"),
    mk("arc-dennis-cruz-b2b-ben-sterling-expansions-d3", "DENNIS CRUZ B2B BEN STERLING", "expansions", 3, "17:30", "19:00"),
    mk("arc-beltran-expansions-d3", "BELTRAN", "expansions", 3, "19:00", "20:30"),
    mk("arc-mochakk-expansions-d3", "MOCHAKK", "expansions", 3, "20:30", "22:00"),
    // ─────────── SUN Sep 6 · area909 ───────────
    mk("arc-10cust-area909-d3", "10CUST", "area909", 3, "14:00", "15:30"),
    mk("arc-pluko-dj-set-area909-d3", "PLUKO DJ SET", "area909", 3, "15:30", "16:30"),
    mk("arc-mcr-t-area909-d3", "MCR-T", "area909", 3, "16:30", "17:30"),
    mk("arc-nia-archives-b2b-x-club-area909-d3", "NIA ARCHIVES B2B X CLUB.", "area909", 3, "17:30", "19:00"),
    mk("arc-dj-gigola-b2b-skin-on-skin-area909-d3", "DJ GIGOLA B2B SKIN ON SKIN", "area909", 3, "19:00", "20:45"),
    mk("arc-brutalismus-3000-area909-d3", "BRUTALISMUS 3000", "area909", 3, "21:00", "22:00"),
    // ─────────── SUN Sep 6 · The Midway ───────────
    mk("arc-rika-b-midway-d3", "RIKA B", "midway", 3, "14:00", "15:00"),
    mk("arc-mike-dunn-midway-d3", "MIKE DUNN", "midway", 3, "15:00", "16:00"),
    mk("arc-will-clarke-midway-d3", "WILL CLARKE", "midway", 3, "16:00", "17:30"),
    mk("arc-biscits-midway-d3", "BISCITS", "midway", 3, "17:30", "19:00"),
    mk("arc-walker-and-royce-b2b-vnssa-midway-d3", "WALKER & ROYCE B2B VNSSA", "midway", 3, "19:00", "20:30"),
    mk("arc-after-midnight-midway-d3", "AFTER MIDNIGHT", "midway", 3, "20:30", "22:00", "Matroda x San Pacho"),
    // ─────────── MON Sep 7 · The Grid ───────────
    mk("arc-madeline-grid-d4", "MADELINE", "grid", 4, "14:00", "15:00"),
    mk("arc-silvie-loto-b2b-kinahau-grid-d4", "SILVIE LOTO B2B KINAHAU", "grid", 4, "15:00", "16:15"),
    mk("arc-derrick-carter-grid-d4", "DERRICK CARTER", "grid", 4, "16:15", "17:30"),
    mk("arc-honey-dijon-grid-d4", "HONEY DIJON", "grid", 4, "17:30", "19:00"),
    mk("arc-michael-bibi-grid-d4", "MICHAEL BIBI", "grid", 4, "19:00", "20:30"),
    mk("arc-green-velvet-b2b-josh-baker-grid-d4", "GREEN VELVET B2B JOSH BAKER", "grid", 4, "20:30", "22:00"),
    // ─────────── MON Sep 7 · Expansions ───────────
    mk("arc-oogie-b2b-phives-expansions-d4", "OOGIE B2B PHIVES", "expansions", 4, "14:00", "15:00"),
    mk("arc-lusid-expansions-d4", "LUSID", "expansions", 4, "15:00", "16:00"),
    mk("arc-anna-b2b-traumer-expansions-d4", "ANNA B2B TRAUMER", "expansions", 4, "16:00", "17:30"),
    mk("arc-josh-baker-expansions-d4", "JOSH BAKER", "expansions", 4, "17:30", "19:00"),
    mk("arc-carlita-b2b-whomadewho-expansions-d4", "CARLITA B2B WHOMADEWHO", "expansions", 4, "19:00", "20:30"),
    mk("arc-vintage-culture-b2b-damian-lazarus-expansions-d4", "VINTAGE CULTURE B2B DAMIAN LAZARUS", "expansions", 4, "20:30", "22:00"),
    // ─────────── MON Sep 7 · area909 ───────────
    mk("arc-kirk-area909-d4", "KIRK", "area909", 4, "14:00", "15:00"),
    mk("arc-hotpretty-area909-d4", "HOTPRETTY", "area909", 4, "15:00", "16:00"),
    mk("arc-bushbaby-area909-d4", "BUSHBABY", "area909", 4, "16:00", "17:00"),
    mk("arc-sam-alfred-b2b-club-angel-area909-d4", "SAM ALFRED B2B CLUB ANGEL", "area909", 4, "17:00", "18:00"),
    mk("arc-bullet-tooth-area909-d4", "BULLET TOOTH", "area909", 4, "18:00", "19:00"),
    mk("arc-dj-heartstring-b2b-baugruppe90-area909-d4", "DJ HEARTSTRING B2B BAUGRUPPE90", "area909", 4, "19:00", "20:30"),
    mk("arc-boys-noize-b2b-hiroko-yamamura-area909-d4", "BOYS NOIZE B2B HIROKO YAMAMURA", "area909", 4, "20:30", "22:00"),
    // ─────────── MON Sep 7 · The Midway ───────────
    mk("arc-roobies4ever-midway-d4", "ROOBIES4EVER", "midway", 4, "14:00", "15:00"),
    mk("arc-dunes-of-dawn-midway-d4", "DUNES OF DAWN", "midway", 4, "15:00", "16:00"),
    mk("arc-oguz-midway-d4", "OGUZ", "midway", 4, "16:00", "17:30"),
    mk("arc-quest-b2b-ellen-allien-midway-d4", "QUEST B2B ELLEN ALLIEN", "midway", 4, "17:30", "19:00"),
    mk("arc-adri-n-mills-b2b-fumi-b2b-serafina-midway-d4", "ADRIÁN MILLS B2B FUMI B2B SERAFINA", "midway", 4, "19:00", "20:30"),
    mk("arc-kloud-midway-d4", "KLOUD", "midway", 4, "20:30", "22:00"),
  ];

  const CONFIG = {
    id:        "arc-2026",
    // From the SOURCE note above: arcmusicfestival.com/set-times, read 2026-09-06. Feeds /f/<id>/schedule.json.
    scheduleSource: { url: "https://arcmusicfestival.com/set-times", observedAt: "2026-09-06", official: true },
    name:      "ARC Music Festival 2026",
    shortName: "ARC",
    brand:     "ARC",
    tagline:   "Four days of house and techno in the middle of Chicago",
    location:  "Union Park · Chicago, IL",
    locationShort: "Union Park",
    dates:     "Sep 4–7, 2026",
    year:      2026,
    // Official FAQ: "What are the hours of the festival? 2pm – 10pm".
    // Both bounds are the REAL published hours and match all four grids.
    startMs: Date.UTC(2026, 8, 4, 19, 0, 0),  // Sep 4 14:00 CDT, doors
    endMs:   Date.UTC(2026, 8, 8,  3, 0, 0),  // Sep 7 22:00 CDT, last set ends
    tz:      "America/Chicago",
    tzAbbr:  "CDT",
    utcOffsetHours: -5,
    dayDates: {
      1: { y: 2026, m: 8, d: 4, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 8, 4, 5, 0, 0) },
      2: { y: 2026, m: 8, d: 5, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 8, 5, 5, 0, 0) },
      3: { y: 2026, m: 8, d: 6, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 8, 6, 5, 0, 0) },
      4: { y: 2026, m: 8, d: 7, name: "Monday", short: "MON",
           midnightUtc: Date.UTC(2026, 8, 7, 5, 0, 0) },
    },
    // api.sunrise-sunset.org at 41.8842,-87.6652, converted to CDT.
    sunTimes: {
      1: { rise: "06:18", set: "19:20" },
      2: { rise: "06:19", set: "19:19" },
      3: { rise: "06:20", set: "19:17" },
      4: { rise: "06:21", set: "19:15" },
    },
    gps: { lat: 41.884190, lng: -87.665168, onSiteRadiusMi: 0.3 },
    venue: {
      name:    "Union Park",
      address: "1501 W Randolph St, Chicago, IL 60607",
      terrain: "flat city park — grass fields, paved paths, mature trees",
      // OpenStreetMap relation 20437366. ⚠ OSM models Union Park as THREE
      // separate parcels (streets bisect it): 46,320 m², 8,910 m² and
      // 991 m², 56,221 m² total — which matches the Chicago Park District's
      // published 13.46 acres (54,470 m²) to within 3%. This footprint is
      // the LARGEST parcel, the main block the festival is built on, all 48
      // vertices verbatim. Widening it to the union of all three would be a
      // change to what "inside the venue" means — do that deliberately or
      // not at all.
      footprint: [
        [41.8852543, -87.6667817], [41.8849738, -87.6667776], [41.8847242, -87.6667579], [41.8843510,
        -87.6667464], [41.8841866, -87.6667397], [41.8834051, -87.6667164], [41.8833952, -87.6667161],
        [41.8833817, -87.6667077], [41.8833742, -87.6666918], [41.8833737, -87.6666731], [41.8833794,
        -87.6664056], [41.8833747, -87.6662831], [41.8833681, -87.6661795], [41.8833550, -87.6660665],
        [41.8833387, -87.6659729], [41.8833097, -87.6658379], [41.8832728, -87.6657148], [41.8831540,
        -87.6653198], [41.8831175, -87.6651797], [41.8830899, -87.6650642], [41.8830843, -87.6649919],
        [41.8830876, -87.6649354], [41.8830924, -87.6648880], [41.8831035, -87.6648331], [41.8831208,
        -87.6647740], [41.8831484, -87.6647106], [41.8831764, -87.6646635], [41.8832157, -87.6646164],
        [41.8834383, -87.6643922], [41.8839054, -87.6639275], [41.8840774, -87.6637604], [41.8841031,
        -87.6637303], [41.8841307, -87.6636901], [41.8841588, -87.6636430], [41.8841803, -87.6636078],
        [41.8841934, -87.6635920], [41.8842075, -87.6635863], [41.8842177, -87.6635876], [41.8842304,
        -87.6636020], [41.8842851, -87.6636926], [41.8845207, -87.6640737], [41.8848120, -87.6645535],
        [41.8852777, -87.6653202], [41.8852926, -87.6653523], [41.8853006, -87.6653844], [41.8852788,
        -87.6667662], [41.8852718, -87.6667780], [41.8852543, -87.6667817]
      ],
    },
    weatherEndpoint: "https://api.weather.gov/points/41.8842,-87.6652",
    // The Grid is the first column on all four official grids and carries
    // Anyma, Underworld, Chase & Status and Green Velvet.
    mainStageId: "grid",
    // ── THE MAP ──
    // No mapImage, no gpsAnchors. ARC publishes no patron map on the web
    // (three negative checks in the header). Real basemap instead.
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    // Published policy: 18+, no re-entry, cashless.
    policies: { minimumAge: 18, alcoholAge: 21, reentry: false, cashless: true },
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["arc-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Complete: real stages, real four-day split, real set times, surveyed
    // venue. Nothing is gated on a future artifact. `available` is still a
    // founder call at merge (AGENTS.md) — flagged in the PR.
    registry: { available: true, accent: "#C4F82A", emoji: "🎛️", region: "North America" },
  };
})();

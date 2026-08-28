// Las Vegas 2026 — real lineup by stage (public lineup info, Plursky is an independent companion app)

// ─────────────────────────────────────────────────────────────
// FESTIVAL_CONFIG — Type Definitions
// ─────────────────────────────────────────────────────────────
/** @typedef {{ y: number, m: number, d: number, name: string, short: string, midnightUtc: number }} DayDate */
/** @typedef {{ rise: string, set: string }} SunTime */
/** @typedef {{ lat: number, lng: number, onSiteRadiusMi: number }} FestivalGps */
/** @typedef {{ lat: number, lng: number, label: string, note: string }} RideshareGps */
/** @typedef {{ north: number, south: number, west: number, east: number }} GeoBounds */
/** @typedef {{ lat: number, lng: number }} GeoPoint */
/** @typedef {{ name: string, address: string, trackLengthMi: number, trackShape: string, bankingTurnsDeg: number, bankingStraightsDeg: number, ovalBounds: GeoBounds, ovalCenter: GeoPoint, festivalBounds: GeoBounds }} Venue */
/** @typedef {{ stageId: string, lat: number, lng: number }} GpsAnchor */
/**
 * @typedef {Object} FestivalConfig
 * @property {string} id - Unique festival identifier (e.g. "edc-lv-2026")
 * @property {string} name - Full display name
 * @property {string} shortName - Compact name for tight spaces
 * @property {string} brand - Festival brand (EDC, ACL, etc.)
 * @property {string} tagline - One-liner descriptor
 * @property {string} location - Full venue + region
 * @property {string} locationShort - Venue name only
 * @property {string} dates - Human-readable date range
 * @property {number} year - Festival year
 * @property {number} startMs - UTC ms timestamp for gates open
 * @property {number} endMs - UTC ms timestamp for festival close
 * @property {string} tz - IANA timezone identifier
 * @property {string} tzAbbr - Timezone abbreviation (PDT, CDT, etc.)
 * @property {number} utcOffsetHours - UTC offset in hours
 * @property {Object<number, DayDate>} dayDates - Day number → date metadata
 * @property {Object<number, SunTime>} sunTimes - Day number → sunrise/sunset
 * @property {string} lastShuttleHHMM - Last shuttle clock time (HH:MM)
 * @property {FestivalGps} gps - Festival centroid + radius
 * @property {RideshareGps} rideshareGps - Rideshare pickup zone
 * @property {Venue} venue - Venue physical details
 * @property {GpsAnchor[]} gpsAnchors - Stage GPS calibration points
 * @property {string} weatherEndpoint - Weather API URL
 * @property {string} mainStageId - Default/main stage identifier
 * @property {string} mapImage - Map asset filename
 * @property {string} mapStyle - Map rendering style
 */

// ─────────────────────────────────────────────────────────────
// FESTIVAL_CONFIG
// ─────────────────────────────────────────────────────────────
// Single source of truth for everything festival-specific. Drop
// in another festival's config (Coachella, Tomorrowland, Burning
// Man, etc.) and the entire app re-skins for it. Phase 1 of the
// multi-festival rollout — Phase 2 will introduce a FESTIVALS
// registry + a switcher UI.
/** @type {FestivalConfig} */
const FESTIVAL_CONFIG = {
  // ── Identity ──
  id:           "edc-lv-2026",
  name:         "EDC Las Vegas 2026",
  shortName:    "EDC LV 2026",
  brand:        "EDC",
  tagline:      "Three nights under the electric sky",
  location:     "Las Vegas Motor Speedway · Nevada",
  locationShort:"Las Vegas Motor Speedway",
  dates:        "May 15–17, 2026",
  year:         2026,

  // ── Timing (all instants in UTC ms) ──
  startMs: Date.UTC(2026, 4, 16, 0, 0, 0),  // May 15 17:00 PDT (gates open day 1)
  endMs:   Date.UTC(2026, 4, 18, 12, 0, 0), // May 18 05:00 PDT (sunday close)
  tz:      "America/Los_Angeles",
  tzAbbr:  "PDT",
  utcOffsetHours: -7,

  // Festival day n → calendar date + UTC midnight anchor (used to
  // convert HH:MM clock-times to absolute Date instances)
  dayDates: {
    1: { y: 2026, m: 4, d: 15, name: "Friday",   short: "FRI",
         midnightUtc: Date.UTC(2026, 4, 15, 7, 0, 0) },
    2: { y: 2026, m: 4, d: 16, name: "Saturday", short: "SAT",
         midnightUtc: Date.UTC(2026, 4, 16, 7, 0, 0) },
    3: { y: 2026, m: 4, d: 17, name: "Sunday",   short: "SUN",
         midnightUtc: Date.UTC(2026, 4, 17, 7, 0, 0) },
  },

  // Sunrise / sunset per festival day (clock time in tz)
  sunTimes: {
    1: { rise: "05:36", set: "19:34" },
    2: { rise: "05:35", set: "19:35" },
    3: { rise: "05:34", set: "19:36" },
  },

  // Last-shuttle cutoff per night (clock time in tz)
  lastShuttleHHMM: "05:45",

  // ── Geography ──
  // FESTIVAL_CONFIG.gps is the EDC build centroid (~270m north of the
  // tri-oval geometric center because EDC extends into the LVMS dirt
  // area north of the north turn). 0.5mi radius covers the full
  // festival footprint including South Lot rideshare.
  gps: { lat: 36.27370, lng: -115.0125, onSiteRadiusMi: 0.5 },

  // Rideshare pickup zone (universal-link target for Uber/Lyft)
  rideshareGps: {
    lat: 36.258,
    lng: -115.011,
    label: "South Lot · Rideshare Pickup",
    note:  "Drivers can't enter the venue. Walk south through the rideshare gate.",
  },

  // ── LVMS canonical geometry ──
  // Las Vegas Motor Speedway: 1.500 mi (2.414 km) tri-oval, long axis
  // ~N-S, frontstretch (start/finish) on the south side, 20° banking
  // in turns / 9° on straights. Facility GPS center per Wikipedia /
  // public records: 36.2713 N, -115.0111 W. EDC's festival footprint
  // includes the infield + the dirt area north of the north turn.
  venue: {
    name: "Las Vegas Motor Speedway",
    address: "7000 N Las Vegas Blvd, Las Vegas, NV 89115",
    trackLengthMi: 1.5,
    trackShape: "tri-oval",
    bankingTurnsDeg: 20,
    bankingStraightsDeg: 9,
    // Tri-oval bounding box (paved track only)
    ovalBounds:    { north: 36.27520, south: 36.26790, west: -115.01700, east: -115.00540 },
    ovalCenter:    { lat: 36.27155,   lng: -115.01120 },
    // Full EDC build footprint (oval + dirt extension + south lots)
    festivalBounds:{ north: 36.27780, south: 36.26720, west: -115.01740, east: -115.00500 },
  },

  // ⚠ PROVISIONAL anchors — pending official 2026 EDC site map
  // (Insomniac typically releases ~2 weeks before the festival).
  // Update these once the 2026 map drops; the affine transform in
  // map.jsx auto-retunes the whole GPS→SVG projection.
  //
  // Three anchors (kinetic / cosmic / basspod) were measured during
  // pre-festival site reconnaissance and define the SVG↔GPS affine
  // transform. The other six (quantum / bionic / stereo / neon / waste
  // / circuit) are DERIVED from that transform using their SVG layout
  // coordinates — they snap cleanly to the same projection so adding
  // them doesn't shift any existing math, but it gives the off-stage
  // detector (_matchArtistForPhoto in photo-tag.jsx) a tight reference
  // point near every stage instead of only three. Threshold drops
  // 150m → 80m as a result.
  //
  // Verify by overlaying these on Google Maps satellite view of the
  // Las Vegas Motor Speedway infield — each anchor should land at
  // its stage's apparent center on a previous EDC's footprint
  // (Insomniac re-uses similar layouts year-over-year).
  gpsAnchors: [
    // Calibrated (do not move without re-deriving the others)
    { stageId: "kinetic", lat: 36.27512, lng: -115.01180 },
    { stageId: "cosmic",  lat: 36.27370, lng: -115.01480 },
    { stageId: "basspod", lat: 36.27075, lng: -115.01230 },
    // Derived from the SVG layout via the kinetic/cosmic/basspod affine.
    // RE-DERIVED 2026-08-27: these were labelled "derived" but did not
    // actually satisfy the affine. Feeding each stored anchor back through
    // gpsToMap() should return that stage's own x/y; `neon` came back 6.85
    // grid units out (~85 m on this footprint) — a typo'd longitude, not
    // rounding. It matters beyond the map: photo-tag.jsx attributes photos
    // to a stage by comparing EXIF GPS against these anchors, so a stage
    // sitting 85 m from where the app thinks it is mis-tags the photos
    // taken at it. The rest moved <1 unit (4-decimal rounding, now 5).
    { stageId: "quantum", lat: 36.27433, lng: -115.01026 },
    { stageId: "bionic",  lat: 36.27544, lng: -115.01386 },
    { stageId: "stereo",  lat: 36.27404, lng: -115.01285 },
    { stageId: "neon",    lat: 36.27218, lng: -115.01010 },
    { stageId: "waste",   lat: 36.27179, lng: -115.01366 },
    { stageId: "circuit", lat: 36.27088, lng: -115.01068 },
  ],

  // ── Weather ──
  // NWS endpoint for US festivals (free, keyless). For non-US
  // festivals, swap to OpenWeatherMap or another provider and the
  // useNwsForecast hook can branch on this URL pattern.
  weatherEndpoint: "https://api.weather.gov/points/36.27,-115.01",

  // ── Defaults ──
  mainStageId: "kinetic",
  mapImage: "edc-map-2026.jpg",
  mapStyle: "image-overlay",
  // The poster prints all nine stage names in display type (verified against
  // the asset, 2026-08-27), so Plursky must not echo them a few pixels away.
  mapPrintsStageNames: true,

  // ── Named landmarks (walkways, districts, standalone art) ──
  // Places printed on the official patron map that are NOT stages, in the
  // same 0-100 grid the STAGES x/y use. Drawn behind the "Landmark labels"
  // toggle on both map renderers.
  //
  // This list USED to be hardcoded twice inside map.jsx — once in TopDownMap
  // (behind the toggle) and once in RealMap (always on). Both copies were
  // EDC's, with no festival gate, so switching to ACL or Lost Lands drew
  // "KINETIC TRAIL" and "DAISY FIELDS" across Zilker Park and Legend Valley.
  // Per-festival data belongs in the per-festival config: a festival with no
  // `landmarks` key now correctly renders none.
  landmarks: [
    // Walkways
    { label: "KINETIC TRAIL",   x: 41, y: 28, rot: -55, color: "rgba(251,191,36,0.85)",  size: 6.8, ls: 1.6 },
    { label: "MEMORY LANE",     x: 33, y: 55, rot: -90, color: "rgba(247,237,224,0.7)",  size: 6.8, ls: 1.6 },
    { label: "POWER PATH",      x: 67, y: 38, rot: -90, color: "rgba(167,139,250,0.85)", size: 6.8, ls: 1.6 },
    { label: "RAINBOW ROAD",    x: 65, y: 64, rot: -90, color: "rgba(244,114,182,0.85)", size: 6.8, ls: 1.6 },
    { label: "ELECTRIC AVENUE", x: 50, y: 62, rot:   0, color: "rgba(252,211,77,0.95)",  size: 6.8, ls: 2.0 },
    { label: "BASS LANE",       x: 56, y: 71, rot: -90, color: "rgba(96,165,250,0.85)",  size: 6.5, ls: 1.6 },
    { label: "NOMADS ALLEY",    x: 22, y: 70, rot: -22, color: "rgba(247,237,224,0.7)",  size: 6.5, ls: 1.5 },
    // Sub-areas / districts
    { label: "DAISY FIELDS",    x: 40, y: 24, rot:   0, color: "rgba(252,211,77,0.85)",  size: 5.8, ls: 1.4 },
    { label: "NOMADS LAND",     x: 38, y: 70, rot:   0, color: "rgba(252,211,77,0.95)",  size: 6.5, ls: 1.6 },
    // Inside-plaza landmarks
    { label: "RAINBOW BAZAAR",  x: 50, y: 47, rot:   0, color: "rgba(255,255,255,0.92)", size: 5.8, ls: 1.4 },
    { label: "DOWNTOWN EDC",    x: 50, y: 55, rot:   0, color: "rgba(251,191,36,0.95)",  size: 6.5, ls: 1.6 },
    // Standalone landmarks
    { label: "FLOWER TUNNEL",   x: 45, y: 33, rot:   0, color: "rgba(244,114,182,0.9)",  size: 6.2, ls: 1.5 },
    { label: "PIXEL FOREST",    x: 78, y: 60, rot:   0, color: "rgba(244,114,182,0.85)", size: 6.2, ls: 1.5 },
    { label: "NOMADS PORTAL",   x: 38, y: 76, rot:   0, color: "rgba(244,114,182,0.85)", size: 5.6, ls: 1.4 },
  ],
};

// Backwards-compat alias — older code reads `FESTIVAL.name` etc.
// Eventually we can delete this and make every consumer read from
// FESTIVAL_CONFIG directly.
const FESTIVAL = FESTIVAL_CONFIG;

// ─────────────────────────────────────────────────────────────
// FESTIVALS_REGISTRY (Phase 2)
// ─────────────────────────────────────────────────────────────
// All festivals the platform knows about. Currently only EDC LV
// 2026 has full data (STAGES + ARTISTS + AMENITIES). The rest are
// "preview" entries — visible in the festival switcher as "Coming
// soon" so users see the platform's roadmap, but not selectable
// until their data layer is filled in.
const FESTIVALS_REGISTRY = [
  {
    config: FESTIVAL_CONFIG,
    available: true,
    accent: "#e85d2e",
    emoji: "🌵",
    region: "North America",
  },
  {
    // ── Electric Forest 2027 — Double JJ Ranch, Rothbury MI ──
    // ROLLED 2026-08-27 from electric-forest-2026. The 2026 edition ran
    // Jun 25–28 and this entry never flipped to available:true, so its whole
    // data layer (EF_STAGES / EF_ARTISTS / EF_AMENITIES, ~123 acts with
    // PROVISIONAL stage assignments and placeholder set times, plus
    // centroid-guessed gpsAnchors) described a festival that is now in the
    // past. Per AGENTS.md §4 a gated entry whose date has passed never flips,
    // so shipping it forward would only ever mis-tag photos and mis-date
    // JSON-LD. It is deleted here rather than carried: recover the full block
    // with `git show 615fa40:data.jsx` (EF_STAGES ≈ L1271, EF_ARTISTS ≈ L1296,
    // EF_AMENITIES ≈ L1426) when the 2027 flip session rebuilds it against the
    // official 2027 map + lineup.
    //
    // ⛔ NO OFFICIAL 2027 DATES EXIST (checked 2026-08-27). Electric Forest had
    // not announced them; the only figure in circulation, "Thu Jun 24 2027",
    // comes from a prediction page, not the festival. `dates` is therefore the
    // literal string "Dates TBA", which gen-festival-pages.mjs's date regex
    // deliberately fails to parse — so the /f/ page emits NO JSON-LD
    // startDate/endDate rather than a fabricated one. Replace with the real
    // dates when announced; do NOT infer them from 2026's.
    config: {
      id:        "electric-forest-2027",
      name:      "Electric Forest 2027",
      shortName: "Forest 2027",
      brand:     "Electric Forest",
      tagline:   "Four days under the electric canopy",
      location:  "Double JJ Ranch · Rothbury, MI",
      locationShort: "Double JJ Ranch",
      dates:     "Dates TBA",
      year:      2027,
    },
    available: false,
    accent:    "#34d399",
    emoji:     "🌲",
    region:    "North America",
  },
  {
    // ── Lost Lands 2026 — Legend Valley, Thornville OH ──
    // ⛔ GATE (same pattern as Forest): lineup + day assignments are REAL
    // (official daily poster, aug 2026) but SET TIMES + STAGES are NOT
    // published yet (checked 2026-08-22; official app schedule historically
    // drops ~1 week out). All start/end, stage assignments, stage x/y,
    // gpsAnchors, and the map image are PROVISIONAL. Flip `available: true`
    // only after the official schedule + 2026 patron map land.
    // NOT re-derived on 2026-08-27 (the work order leaves LL provisional).
    // For the flip session: `forest-stage` is 39.9 grid units off the
    // prehistoric/wompy-woods/crater affine, `raptor-alley` 14.9, `grove`
    // 12.3, `subsidia` 9.3. Re-measure the trio on satellite, then re-derive
    // the rest from it rather than by eye.
    config: {
      id:        "lost-lands-2026",
      name:      "Lost Lands 2026",
      shortName: "Lost Lands",
      brand:     "Lost Lands",
      tagline:   "Three nights in Legend Valley",
      location:  "Legend Valley · Thornville, OH",
      locationShort: "Legend Valley",
      dates:     "Sep 18–20, 2026",
      year:      2026,
      startMs: Date.UTC(2026, 8, 16, 16, 0, 0), // Sep 16 noon EDT (early-entry Wed opens)
      endMs:   Date.UTC(2026, 8, 21, 6, 0, 0),  // Sep 21 02:00 EDT (Sunday close)
      tz:      "America/New_York",
      tzAbbr:  "EDT",
      utcOffsetHours: -4,
      // Lost Lands runs FIVE program days: Wed–Thu early entry (pre-party,
      // Crater Stage) + Fri–Sun main days.
      dayDates: {
        1: { y: 2026, m: 8, d: 16, name: "Wednesday", short: "WED",
             midnightUtc: Date.UTC(2026, 8, 16, 4, 0, 0) },
        2: { y: 2026, m: 8, d: 17, name: "Thursday",  short: "THU",
             midnightUtc: Date.UTC(2026, 8, 17, 4, 0, 0) },
        3: { y: 2026, m: 8, d: 18, name: "Friday",    short: "FRI",
             midnightUtc: Date.UTC(2026, 8, 18, 4, 0, 0) },
        4: { y: 2026, m: 8, d: 19, name: "Saturday",  short: "SAT",
             midnightUtc: Date.UTC(2026, 8, 19, 4, 0, 0) },
        5: { y: 2026, m: 8, d: 20, name: "Sunday",    short: "SUN",
             midnightUtc: Date.UTC(2026, 8, 20, 4, 0, 0) },
      },
      // sunrise-sunset.org @ venue coords (EDT reads):
      sunTimes: {
        1: { rise: "07:11", set: "19:38" },
        2: { rise: "07:11", set: "19:37" },
        3: { rise: "07:12", set: "19:35" },
        4: { rise: "07:13", set: "19:34" },
        5: { rise: "07:14", set: "19:32" },
      },
      // Venue centroid from OpenStreetMap (Legend Valley, 7585 Jacksontown
      // Rd SE, Thornville OH); NWS points endpoint verified live 2026-08-22.
      gps: { lat: 39.9403, lng: -82.4039, onSiteRadiusMi: 1.0 },
      // ⚠ ALL anchors PROVISIONAL (spread around the centroid from the
      // general stage layout - no 2026 patron map exists yet). Recalibrate
      // at the flip session per the map.jsx ACL 3-point affine workflow.
      gpsAnchors: [
        { stageId: "prehistoric",  lat: 39.93800, lng: -82.40650 },
        { stageId: "wompy-woods",  lat: 39.94150, lng: -82.40100 },
        { stageId: "crater",       lat: 39.94050, lng: -82.40750 },
        { stageId: "subsidia",     lat: 39.94180, lng: -82.40450 },
        { stageId: "forest-stage", lat: 39.93900, lng: -82.40200 },
        { stageId: "raptor-alley", lat: 39.94250, lng: -82.40700 },
        { stageId: "grove",        lat: 39.94300, lng: -82.40150 },
      ],
      mainStageId: "prehistoric",
      // lostlands-2026.jpg = PROVISIONAL generated abstract valley overlay
      // (ImageMagick gradient, NOT traced). Replace with the processed
      // official 2026 patron map (acl-park.webp treatment) when it drops.
      mapImage: "lostlands-2026.jpg",
      mapStyle: "image-overlay",
      mapTheme: "forest",
      weatherEndpoint: "https://api.weather.gov/points/39.9403,-82.4039",
      // Flip-session marker: replace provisional set times/stages, then delete.
      setTimesProvisional: true,
    },
    available: false,
    accent:    "#84cc16",
    emoji:     "🦖",
    region:    "North America",
  },
  // ─── Preview entries (visible in the switcher as "Coming soon") ───
  // These are intentionally minimal — name + dates + brand colors only.
  // To turn one ON: ship a full FESTIVAL_CONFIG (same shape as EDC LV
  // 2026's), plus a STAGES + ARTISTS + AMENITIES data set, then flip
  // `available: true`. See data.jsx top of file for the contract.
  //
  // Why hardcoded vs CMS-driven: each festival's STAGES + ARTISTS is
  // ~500 lines of structured data. Hosting it remote (Supabase table,
  // markdown in repo, etc.) adds load-order complexity for marginal
  // benefit at the current scale. Re-evaluate at festival #5.
  {
    // ── EDC Orlando 2026 — Tinker Field, Orlando FL ──
    // ⛔ GATE (revival wave 2026-08-22): full data set (EDCO_STAGES /
    // EDCO_ARTISTS / EDCO_AMENITIES) is staged below; DATES CORRECTED vs
    // the June preview stub, which carried "Nov 13–15, 2026" — the
    // official dates per the Insomniac press release (2026-06-23) and
    // orlando.edc.com are NOV 6–8, 2026. Day-by-day lineup is REAL
    // (109 acts, official site day filters); set times, per-artist stage
    // assignments, and the official 2026 map are NOT published yet
    // (checked 2026-08-22; Insomniac drops them in the EDC app ~1-2
    // weeks out). Flip `available: true` ONLY after the flip session
    // replaces times/stages/map + recalibrates gpsAnchors.
    config: {
      id:        "edc-orlando-2026",
      name:      "EDC Orlando 2026",
      shortName: "EDC Orlando",
      brand:     "EDC",
      tagline:   "Three nights under the kinetic Florida sky",
      location:  "Tinker Field · Orlando",
      locationShort: "Tinker Field",
      dates:     "Nov 6–8, 2026",
      year:      2026,
      // NOTE: Nov 6-8 is AFTER US DST ends (Nov 1) — Orlando is EST (UTC-5).
      startMs: Date.UTC(2026, 10, 6, 21, 0, 0), // Nov 6 16:00 EST gates
      endMs:   Date.UTC(2026, 10, 9, 5, 0, 0),  // Nov 9 00:00 EST Sunday close
      tz:      "America/New_York",
      tzAbbr:  "EST",
      utcOffsetHours: -5,
      dayDates: {
        1: { y: 2026, m: 10, d: 6, name: "Friday",   short: "FRI", midnightUtc: Date.UTC(2026, 10, 6, 5, 0, 0) },
        2: { y: 2026, m: 10, d: 7, name: "Saturday", short: "SAT", midnightUtc: Date.UTC(2026, 10, 7, 5, 0, 0) },
        3: { y: 2026, m: 10, d: 8, name: "Sunday",   short: "SUN", midnightUtc: Date.UTC(2026, 10, 8, 5, 0, 0) },
      },
      // Early-Nov Orlando approximates (theme guidance only): sunrise
      // ~06:38 / sunset ~17:35 EST, drifting ~1 min/day. Not load-bearing.
      sunTimes: {
        1: { rise: "06:38", set: "17:35" },
        2: { rise: "06:39", set: "17:34" },
        3: { rise: "06:40", set: "17:33" },
      },
      // ⚠ PROVISIONAL venue centroid (Tinker Field Plaza, Nominatim
      // 2026-08-22). Recalibrate against the official 2026 map + satellite.
      gps: { lat: 28.5382, lng: -81.4053, onSiteRadiusMi: 0.6 },
      // ⚠ ALL anchors PROVISIONAL (venue centroid offsets only).
      // NOT re-derived (per the work order, EDCO stays provisional). For the
      // flip session: `stereo` is 56.9 grid units off the kinetic/circuit/neon
      // affine and `bacardi` 13.0 — over half the footprint. Re-measure the
      // trio on satellite first, then re-derive the other two from it.
      gpsAnchors: [
        { stageId: "kinetic", lat: 28.53890, lng: -81.40450 },
        { stageId: "circuit", lat: 28.53760, lng: -81.40630 },
        { stageId: "neon",    lat: 28.53800, lng: -81.40320 },
        { stageId: "stereo",  lat: 28.53920, lng: -81.40610 },
        { stageId: "bacardi", lat: 28.53720, lng: -81.40400 },
      ],
      mainStageId: "kinetic",
      // edco-tinker-2026.jpg = PROVISIONAL generated abstract overlay
      // (ImageMagick plasma, not traced). Replace with the processed
      // official 2026 map when it drops.
      mapImage: "edco-tinker-2026.jpg",
      mapStyle: "image-overlay",
      mapTheme: "park",
      weatherEndpoint: "https://api.weather.gov/points/28.54,-81.41",
      setTimesProvisional: true,
    },
    available: false,
    accent:    "#22c55e",
    emoji:     "🌴",
    region:    "North America",
  },
  {
    // ── Tomorrowland 2027 — De Schorre, Boom BE ──
    // ROLLED 2026-08-27 from tomorrowland-2026 (that edition ran Jul 17–19 &
    // 24–26 and never flipped). Always a registry-only preview entry — no
    // data layer to strip.
    //
    // ⛔ NO OFFICIAL 2027 DATES EXIST (checked 2026-08-27), and the widely
    // reposted "Jul 17–19 and 24–26, 2027" is demonstrably wrong: those are
    // 2026's day numbers copied forward. Jul 17 and Jul 24 were FRIDAYS in
    // 2026 and are SATURDAYS in 2027, and Tomorrowland runs Fri–Sun. The
    // aggregators pattern-guessed. Do not "correct" this to Jul 16–18 &
    // 23–25 either — that is our arithmetic, not an announcement.
    config: {
      id:        "tomorrowland-2027",
      name:      "Tomorrowland 2027",
      shortName: "Tomorrowland",
      brand:     "Tomorrowland",
      tagline:   "We are one",
      location:  "De Schorre · Boom, Belgium",
      dates:     "Dates TBA",
      year:      2027,
    },
    available: false,
    accent:    "#fbbf24",
    emoji:     "🍄",
    region:    "Europe",
  },
  {
    config: {
      id:        "acl-2026",
      name:      "Austin City Limits 2026",
      shortName: "ACL 2026",
      brand:     "ACL",
      tagline:   "Two weekends in Zilker Park",
      location:  "Zilker Park · Austin, TX",
      locationShort: "Zilker Park",
      dates:     "Oct 2–4 & 9–11, 2026",
      year:      2026,
      startMs: Date.UTC(2026, 9, 2, 17, 0, 0),
      endMs:   Date.UTC(2026, 9, 12, 5, 0, 0),
      weekendStartMs: {
        W1: Date.UTC(2026, 9, 2, 17, 0, 0),
        W2: Date.UTC(2026, 9, 9, 17, 0, 0),
      },
      tz:      "America/Chicago",
      tzAbbr:  "CDT",
      utcOffsetHours: -5,
      dayDates: {
        1: { y: 2026, m: 9, d: 2, name: "Friday",   short: "FRI",
             midnightUtc: Date.UTC(2026, 9, 2, 5, 0, 0) },
        2: { y: 2026, m: 9, d: 3, name: "Saturday", short: "SAT",
             midnightUtc: Date.UTC(2026, 9, 3, 5, 0, 0) },
        3: { y: 2026, m: 9, d: 4, name: "Sunday",   short: "SUN",
             midnightUtc: Date.UTC(2026, 9, 4, 5, 0, 0) },
      },
      sunTimes: {
        1: { rise: "07:19", set: "19:09" },
        2: { rise: "07:20", set: "19:08" },
        3: { rise: "07:21", set: "19:07" },
      },
      gps: { lat: 30.2630, lng: -97.7730, onSiteRadiusMi: 0.4 },
      // ⚠ GPS anchors for Zilker Park — calibrated against ACL 2025
      // map overlaid on satellite imagery.  Three reference anchors
      // (amex / miller / beatbox) were placed at known Zilker Park
      // landmarks; the remaining stages are derived via the same
      // 3-point Cramer affine used by EDC (see map.jsx).
      gpsAnchors: [
        // Calibrated (do not move without re-deriving the others)
        { stageId: "amex",    lat: 30.26360, lng: -97.76640 },
        { stageId: "miller",  lat: 30.26600, lng: -97.77240 },
        { stageId: "beatbox", lat: 30.26140, lng: -97.77340 },
        // Derived from the SVG layout via the amex/miller/beatbox affine.
        // RE-DERIVED 2026-08-27 — same defect as EDC LV and Forest. `tmobile`
        // was 28.7 grid units off its own stated derivation and `honda` 17.9
        // (~190 m across Zilker), which for photo-tag.jsx means photos shot
        // at Honda could resolve to a neighbouring stage. ACL is `available:
        // true`, so this one was live.
        { stageId: "honda",    lat: 30.26581, lng: -97.77409 },
        { stageId: "titos",    lat: 30.26533, lng: -97.76755 },
        { stageId: "tmobile",  lat: 30.26504, lng: -97.77471 },
        { stageId: "ladybird", lat: 30.26332, lng: -97.77077 },
        { stageId: "bmi",      lat: 30.26313, lng: -97.77306 },
        { stageId: "barton",   lat: 30.26130, lng: -97.77042 },
        { stageId: "bonus",    lat: 30.26216, lng: -97.76991 },
      ],
      mainStageId: "honda",
      // acl-park.webp = the official ACL patron map, processed for the app:
      // legend panel + title chrome removed, padded to a square so the whole
      // park always shows (no side-crop of T-Mobile/AMEX) and stage coords
      // map directly. See scripts note / map.jsx image-overlay branch.
      mapImage: "acl-park.webp",
      mapStyle: "image-overlay",
      mapTheme: "park",
      weatherEndpoint: "https://api.weather.gov/points/30.26,-97.77",
    },
    available: true,
    accent:    "#e85d2e",
    emoji:     "🤠",
    region:    "North America",
  },
  {
    config: {
      id:        "coachella-2027",
      name:      "Coachella 2027",
      shortName: "Coachella",
      brand:     "Coachella",
      tagline:   "Two weekends, one polo field",
      location:  "Empire Polo Club · Indio, CA",
      dates:     "Apr 9–18, 2027",
      year:      2027,
    },
    available: false,
    accent:    "#ec4899",
    emoji:     "🌵",
    region:    "North America",
  },
];

// Read the user's chosen festival from localStorage. Defaults to the
// first registered festival. Switching festivals reloads the page so
// the new FESTIVAL_CONFIG takes effect cleanly.
function getActiveFestivalId() {
  try {
    const stored = localStorage.getItem("active_festival_id");
    if (stored && FESTIVALS_REGISTRY.find(f => f.config.id === stored && f.available)) return stored;
  } catch {}
  return FESTIVALS_REGISTRY[0].config.id;
}
function setActiveFestivalAndReload(id) {
  try { localStorage.setItem("active_festival_id", id); } catch {}
  window.location.reload();
}

// Stage positions on the LVMS infield. The tri-oval's long axis runs
// roughly N-S; kineticFIELD sits near the north end, basspod near the
// south, cosmic anchors the west side, and neon the east.
//
// Stage colours mirror the official EDC poster's zone palette:
//   kineticFIELD    — ember red (mainstage)
//   quantumVALLEY   — sky cyan (trance)
//   bionicJUNGLE    — teal (jungle/house)
//   stereoBLOOM     — green
//   cosmicMEADOW    — yellow
//   neonGARDEN      — hot pink
//   wasteLAND       — orange (desert)
//   bassPOD         — royal blue
//   circuitGROUNDS  — navy blue (paired blue zone with bassPOD)
// Stage x/y coords calibrated to Insomniac's official EDC LV 2026
// site map (north-up orientation, 0-100 SVG grid). Validated May 2026.
// Constrained to fit inside the tri-oval infield (inner radius ~31
// around 50,50).
const STAGES = [
  { id: "kinetic", name: "Kinetic Field",   short: "KIN", color: "#e85d2e", x: 50, y: 22, size: 1.7,  desc: "Mainstage · headliners, sunrise sets",
    vibe: "Sunrise Cathedral",  vibeNote: "Park here for the sunrise set. Mainstage scale, screen on screen, and the only place worth standing still.",  peak: "03:00–05:30" },
  { id: "quantum", name: "Quantum Valley",  short: "QNT", color: "#38bdf8", x: 70, y: 26, size: 1.1,
    vibe: "Trance Family",      vibeNote: "Hands up for ten hours straight. ASOT crowd, melodic, weeping at 4 AM.",                                       peak: "01:00–05:00",
    desc: "Trance, psytrance" },
  { id: "bionic",  name: "Bionic Jungle",   short: "BIO", color: "#14b8a6", x: 24, y: 26, size: 1.0,
    vibe: "Underground Forest", vibeNote: "Tucked, leafy, intimate. Where tastemakers go between mainstage acts.",                                        peak: "00:00–04:00",
    desc: "House, tech house" },
  { id: "stereo",  name: "Stereo Bloom",    short: "STR", color: "#22c55e", x: 38, y: 40, size: 0.95,
    vibe: "Deepest Crowd",      vibeNote: "Smaller stage, heavier heads. Tech house with a real ear in the crowd.",                                       peak: "23:30–03:30",
    desc: "Tech house, underground" },
  { id: "cosmic",  name: "Cosmic Meadow",   short: "CSM", color: "#fbbf24", x: 14, y: 52, size: 1.2,
    vibe: "Wide-Open Vibe",     vibeNote: "Open-air, art cars, room to breathe. Best stage to wander in and out of.",                                     peak: "22:00–02:00",
    desc: "Open-air · big room, legends" },
  { id: "neon",    name: "Neon Garden",     short: "NEN", color: "#ec4899", x: 74, y: 53, size: 1.05,
    vibe: "House Heads HQ",     vibeNote: "If you came for house, this is the room. Long blends, deep selectors, tightest crowd of the night.",            peak: "00:00–04:30",
    desc: "House, deep techno" },
  { id: "waste",   name: "Wasteland",       short: "WST", color: "#f97316", x: 30, y: 72, size: 1.0,
    vibe: "Hard Dance Pit",     vibeNote: "Hardstyle, hardcore, raw. Bring earplugs you actually trust. The only stage where the BPM never drops.",        peak: "23:00–04:00",
    desc: "Dubstep, bass" },
  { id: "basspod", name: "Basspod",         short: "BAS", color: "#2563eb", x: 48, y: 80, size: 1.05,
    vibe: "Loudest Drops",      vibeNote: "Dubstep, riddim, headbang central. Kicks you can feel in your sternum from a quarter-mile out.",                peak: "23:00–03:30",
    desc: "Dubstep, hard bass" },
  { id: "circuit", name: "Circuit Grounds", short: "CIR", color: "#1e40af", x: 68, y: 72, size: 1.15,
    vibe: "Techno Vault",       vibeNote: "Industrial techno temple. Drifters from Berghain feel at home. Lasers cut through fog like blades.",            peak: "01:00–05:00",
    desc: "Techno, big room" },
];

const AMENITIES = [
  { id: "a1", type: "water",  label: "Hydration",   x: 40, y: 40 },
  { id: "a2", type: "water",  label: "Hydration",   x: 60, y: 60 },
  { id: "a3", type: "water",  label: "Hydration",   x: 62, y: 38 },
  { id: "a4", type: "food",   label: "Rainbow Bazaar",  x: 45, y: 48 },
  { id: "a5", type: "med",    label: "Medic",       x: 55, y: 25 },
  { id: "a6", type: "med",    label: "Medic",       x: 32, y: 70 },
  { id: "a7", type: "toilet", label: "Restrooms",   x: 35, y: 58 },
  { id: "a8", type: "toilet", label: "Restrooms",   x: 65, y: 68 },
  { id: "a9", type: "art",    label: "Daisy Lane",  x: 50, y: 50 },
  { id: "a10",type: "info",   label: "Info / Lost", x: 55, y: 45 },

  // Phone-charging banks. EDC publishes "battery charging stations" on the
  // Amenities page without exact coords, so these track the obvious crowd
  // arteries (Rainbow Road + each major stage plaza).
  { id: "ch1", type: "charge", label: "Charging — Rainbow Road",  x: 50, y: 55 },
  { id: "ch2", type: "charge", label: "Charging — Kinetic Plaza", x: 48, y: 26 },
  { id: "ch3", type: "charge", label: "Charging — Quantum Walk",  x: 64, y: 34 },
  { id: "ch4", type: "charge", label: "Charging — Cosmic Walk",   x: 16, y: 56 },
  { id: "ch5", type: "charge", label: "Charging — Basspod Plaza", x: 52, y: 76 },
  { id: "ch6", type: "charge", label: "Charging — Circuit Plaza", x: 68, y: 70 },

  // Mobile Charging Lockers (Insomniac's official locker partner). 5 banks:
  // GA on Rainbow Road, three VIP-only at stage VIPs, one inside Passport
  // Lounge. Each contains a universal iPhone+Android charger.
  // Source: secure.mobilecharginglockers.com — EDC LV 2026 listings.
  { id: "lk1", type: "locker", label: "Lockers — Main Merch (GA)",      x: 50, y: 52, tier: "GA",       price: "$30 day · $90 / 3-day" },
  { id: "lk2", type: "locker", label: "Lockers — VIP Kinetic",          x: 48, y: 18, tier: "VIP",      price: "$90 · sold out" },
  { id: "lk3", type: "locker", label: "Lockers — VIP Circuit Grounds",  x: 72, y: 70, tier: "VIP",      price: "$90 / 3-day" },
  { id: "lk4", type: "locker", label: "Lockers — VIP Basspod",          x: 52, y: 78, tier: "VIP",      price: "$90 / 3-day" },
  { id: "lk5", type: "locker", label: "Lockers — Passport Lounge",      x: 78, y: 42, tier: "Passport", price: "$25 day · $75 / 3-day" },
];

const AVATAR_START = { x: 50, y: 52 };

const FRIENDS = [];

// Real artists + official set times from EDC Las Vegas 2026 schedule
// (festivaldust.com lineup release, May 2026). Stages outside the 9
// stages we render (Beatbox Art Car / Forest House / YeeDC / Casa
// Bacardi / Insomniac Fridays) are omitted.
const gradFor = (stageId) => {
  const s = STAGES.find(st => st.id === stageId);
  return `linear-gradient(135deg, ${s.color}, #1a0a28)`;
};

const mk = (id, name, genre, stage, day, start, end, bio) => {
  const h = parseInt(start.split(':')[0]);
  // tier: 3=headliner (23:00-05:59), 2=prime time (21:00-22:59), 1=opener (19:00-20:59)
  const tier = (h < 6 || h >= 23) ? 3 : (h >= 21) ? 2 : 1;
  return {
    id, name, genre, country: "—", stage, day, start, end, tier,
    img: `linear-gradient(135deg, ${STAGES.find(s=>s.id===stage).color}, #1a0a28)`,
    bio: bio || `Playing ${FESTIVAL_CONFIG?.name || "EDC Las Vegas 2026"}.`
  };
};

// 24h "HH:MM" → 12h "H:MM AM/PM" for display. Sort/diff logic still uses raw a.start.
function fmt12(t) {
  if (!t || typeof t !== "string") return t;
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return t;
  const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  const ap  = h < 12 ? "AM" : "PM";
  return `${h12}:${mStr} ${ap}`;
}

const ARTISTS = [
  // ─────────────────────────── KINETIC FIELD ───────────────────────────
  // FRI
  mk("k1",  "Laidback Luke b2b Chuckie","House",                 "kinetic", 1, "19:00", "20:00"),
  mk("k2",  "Korolova",                "Melodic Techno",         "kinetic", 1, "20:00", "21:00"),
  mk("k3",  "Argy",                    "Melodic Techno",         "kinetic", 1, "21:00", "22:00"),
  mk("k4",  "Chris Lorenzo",           "Bass House",             "kinetic", 1, "22:07", "23:15"),
  mk("k5",  "Sofi Tukker",             "House",                  "kinetic", 1, "23:19", "00:30"),
  mk("k6",  "The Chainsmokers",        "Electro Pop",            "kinetic", 1, "00:32", "01:42"),
  mk("k7",  "FISHER",                  "Tech House",             "kinetic", 1, "01:47", "02:57"),
  mk("k8",  "Porter Robinson (DJ Set)","Electronic",             "kinetic", 1, "03:01", "04:11"),
  mk("k9",  "Charlotte de Witte",      "Techno",                 "kinetic", 1, "04:14", "05:29", "Belgian techno queen, mainstage rarity."),
  // SAT
  mk("k10", "AR/CO",                   "Live Electronic",        "kinetic", 2, "19:00", "20:00"),
  mk("k11", "Hayla",                   "DnB Vocalist",           "kinetic", 2, "20:00", "21:00"),
  mk("k12", "Sub Focus",               "DnB",                    "kinetic", 2, "21:00", "22:00"),
  mk("k13", "Steve Aoki",              "Electro",                "kinetic", 2, "22:07", "23:15"),
  mk("k14", "Hardwell",                "Big Room",               "kinetic", 2, "23:19", "00:29"),
  mk("k15", "John Summit",             "Tech House",             "kinetic", 2, "00:32", "01:42"),
  mk("k16", "Subtronics",              "Dubstep",                "kinetic", 2, "01:47", "02:57"),
  mk("k17", "Kaskade",                 "Progressive House",      "kinetic", 2, "03:01", "04:11"),
  mk("k18", "Above & Beyond (Sunrise Set)","Trance",             "kinetic", 2, "04:14", "05:29", "Group therapy under the desert dawn."),
  // SUN
  mk("k19", "Trace",                   "DnB",                    "kinetic", 3, "19:00", "20:00"),
  mk("k20", "Ship Wrek",               "Bass",                   "kinetic", 3, "20:00", "21:00"),
  mk("k21", "Layton Giordani",         "Techno",                 "kinetic", 3, "21:00", "22:00"),
  mk("k22", "Funk Tribu",              "Hard Techno",            "kinetic", 3, "22:07", "23:15"),
  mk("k23", "GRiZ b2b Wooli",          "Bass / Funk",            "kinetic", 3, "23:19", "00:29"),
  mk("k24", "Zedd",                    "Electro House",          "kinetic", 3, "00:32", "01:42"),
  mk("k25", "Martin Garrix",           "Big Room / Progressive", "kinetic", 3, "01:47", "02:57", "Dutch headliner. Animals-era anthems to melodic trance."),
  mk("k26", "Cloonee",                 "Tech House",             "kinetic", 3, "03:01", "04:11"),
  mk("k27", "Armin van Buuren (Sunrise Set)","Trance",           "kinetic", 3, "04:14", "05:29", "ASOT captain. Sunrise trance ceremony."),

  // ─────────────────────────── CIRCUIT GROUNDS ─────────────────────────
  // FRI
  mk("cg1", "1991",                    "DnB",                    "circuit", 1, "19:00", "20:00"),
  mk("cg2", "Bou",                     "DnB",                    "circuit", 1, "20:00", "21:00"),
  mk("cg3", "Nico Moreno",             "Hard Techno",            "circuit", 1, "21:00", "22:00"),
  mk("cg4", "I Hate Models",           "Industrial Techno",      "circuit", 1, "22:00", "23:15"),
  mk("cg5", "Levity",                  "Melodic Bass",           "circuit", 1, "23:15", "00:25"),
  mk("cg6", "Wooli",                   "Melodic Bass",           "circuit", 1, "00:25", "01:35"),
  mk("cg7", "The Outlaw",              "Hard Techno",            "circuit", 1, "01:35", "02:35"),
  mk("cg8", "Holy Priest",             "Hard Techno",            "circuit", 1, "02:35", "03:30"),
  mk("cg9", "Ray Volpe",               "Dubstep",                "circuit", 1, "03:30", "04:30"),
  mk("cg10","Level Up",                "Dubstep",                "circuit", 1, "04:30", "05:30"),
  // SAT
  mk("cg11","DJ Mandy",                "House",                  "circuit", 2, "19:00", "20:00"),
  mk("cg12","RØZ",                     "House",                  "circuit", 2, "20:00", "21:15"),
  mk("cg13","Kettama",                 "Rave / Breaks",          "circuit", 2, "21:15", "22:45"),
  mk("cg14","Sammy Virji",             "UK Garage",              "circuit", 2, "22:45", "00:15"),
  mk("cg15","Tiësto",                  "Big Room",               "circuit", 2, "00:15", "01:45"),
  mk("cg16","Peggy Gou b2b Ki/Ki",     "House / Techno",         "circuit", 2, "01:45", "03:15"),
  mk("cg17","Boys Noize",              "Electro",                "circuit", 2, "03:15", "04:30"),
  mk("cg18","Lilly Palmer",            "Techno",                 "circuit", 2, "04:30", "05:30"),
  // SUN
  mk("cg19","Linska",                  "Techno",                 "circuit", 3, "19:00", "20:30"),
  mk("cg20","ANNA",                    "Techno",                 "circuit", 3, "20:30", "22:00"),
  mk("cg21","Beltran",                 "Tech House",             "circuit", 3, "22:00", "23:30"),
  mk("cg22","Chris Stussy",            "Tech House",             "circuit", 3, "23:30", "01:00"),
  mk("cg23","Solomun",                 "Melodic House",          "circuit", 3, "01:00", "02:30"),
  mk("cg24","Vintage Culture",         "Melodic House",          "circuit", 3, "02:30", "04:00"),
  mk("cg25","Kevin de Vries",          "Melodic Techno",         "circuit", 3, "04:00", "05:30"),

  // ─────────────────────────── NEON GARDEN ─────────────────────────────
  // FRI
  mk("n1",  "Anastazja",               "Trance / Techno",        "neon",    1, "19:00", "20:30"),
  mk("n2",  "Mestiza",                 "Electronic",             "neon",    1, "20:30", "22:00"),
  mk("n3",  "DJ Tennis b2b Chloé Caillet","House",               "neon",    1, "22:00", "23:30"),
  mk("n4",  "Peggy Gou",               "House",                  "neon",    1, "23:30", "01:00"),
  mk("n5",  "Adriatique",              "Melodic Techno",         "neon",    1, "01:00", "02:30"),
  mk("n6",  "Joseph Capriati",         "Techno",                 "neon",    1, "02:30", "04:00"),
  mk("n7",  "Eli Brown",               "Techno",                 "neon",    1, "04:00", "05:30"),
  // SAT
  mk("n8",  "Mink",                    "Techno",                 "neon",    2, "19:00", "20:30"),
  mk("n9",  "Silvie Loto",             "Techno",                 "neon",    2, "20:30", "22:00"),
  mk("n10", "Ahmed Spins",             "Afrohouse",              "neon",    2, "22:00", "23:30"),
  mk("n11", "Luciano",                 "Tech House",             "neon",    2, "23:30", "01:30"),
  mk("n12", "Prospa",                  "House",                  "neon",    2, "01:30", "03:30"),
  mk("n13", "Josh Baker b2b Kettama b2b Prospa","Breaks / House","neon",    2, "03:30", "05:30"),
  // SUN
  mk("n14", "Bad Beat",                "Techno",                 "neon",    3, "19:00", "20:15"),
  mk("n21", "Frankie Bones",           "Breakbeat",              "neon",    3, "20:15", "21:30"),
  mk("n15", "Adiel",                   "Techno",                 "neon",    3, "21:30", "22:50"),
  mk("n16", "DJ Gigola",               "Techno",                 "neon",    3, "22:50", "00:10"),
  mk("n20", "999999999",               "Hard Techno / Gabber",   "neon",    3, "00:10", "01:30"),
  mk("n17", "Indira Paganotto",        "Acid Techno",            "neon",    3, "01:30", "02:50"),
  mk("n18", "Ki/Ki",                   "Trance / Techno",        "neon",    3, "02:50", "04:10"),
  mk("n19", "Klangkuenstler",          "Techno",                 "neon",    3, "04:10", "05:30"),

  // ─────────────────────────── COSMIC MEADOW ───────────────────────────
  // FRI
  mk("c2",  "Jackie Hollander",        "Tech House",             "cosmic",  1, "19:00", "19:55"),
  mk("c3",  "Roddy Lima",              "House",                  "cosmic",  1, "19:55", "20:55"),
  mk("c4",  "Westend",                 "Tech House",             "cosmic",  1, "20:55", "21:55"),
  mk("c5",  "Walker & Royce b2b VNSSA","Tech House",             "cosmic",  1, "21:55", "22:55"),
  mk("c6",  "Underworld",              "Electronica",            "cosmic",  1, "23:10", "00:10", "Born Slippy. Two decks, a mic, a legacy."),
  mk("c7",  "MEDUZA",                  "House",                  "cosmic",  1, "00:25", "01:45"),
  mk("c8",  "Notion",                  "Bass",                   "cosmic",  1, "01:47", "02:47"),
  mk("c9",  "MPH",                     "Bass House",             "cosmic",  1, "02:47", "04:02"),
  mk("c10", "San Pacho",               "Afrohouse",              "cosmic",  1, "04:02", "05:30"),
  // SAT
  mk("c11", "Frost Children",          "Electronic",             "cosmic",  2, "19:00", "20:15"),
  mk("c12", "Hannah Laing",            "Hard House / Techno",    "cosmic",  2, "20:15", "21:25"),
  mk("c13", "Snow Strippers",          "Hyperpop / Electronic",  "cosmic",  2, "21:25", "22:15"),
  mk("c14", "VTSS (In The Round)",     "Techno",                 "cosmic",  2, "22:15", "23:30"),
  mk("c15", "The Prodigy",             "Breakbeat / Big Beat",   "cosmic",  2, "23:35", "00:35", "Firestarters. Legendary live set."),
  mk("c16", "BUNT. (In The Round)",    "Folktronica",            "cosmic",  2, "00:40", "02:10"),
  mk("c17", "Interplanetary Criminal", "UK Bass",                "cosmic",  2, "02:10", "03:30"),
  mk("c18", "Malugi",                  "Techno",                 "cosmic",  2, "03:30", "04:30"),
  mk("c19", "DJ Gigola b2b MCR-T",     "Techno",                 "cosmic",  2, "04:30", "05:30"),
  // SUN
  mk("c20", "Gravagerz",               "Bass",                   "cosmic",  3, "19:00", "20:00"),
  mk("c21", "Nostalgix",               "Bass House",             "cosmic",  3, "20:00", "21:00"),
  mk("c22", "William Black",           "Melodic Bass",           "cosmic",  3, "21:00", "22:00"),
  mk("c23", "San Holo (Wholesome Riddim Set)","Melodic Bass",    "cosmic",  3, "22:00", "23:00"),
  mk("c24", "Dabin",                   "Melodic Bass",           "cosmic",  3, "23:00", "00:05"),
  mk("c25", "Alison Wonderland",       "Future Bass",            "cosmic",  3, "00:05", "01:05"),
  mk("c26", "Seven Lions",             "Melodic Bass",           "cosmic",  3, "01:05", "02:20"),
  mk("c27", "Restricted",              "Hardstyle",              "cosmic",  3, "02:20", "03:20"),
  mk("c28", "Black Tiger Sex Machine", "Bass House",             "cosmic",  3, "03:20", "04:30"),
  mk("c29", "Nico Moreno b2b Holy Priest","Hard Techno",         "cosmic",  3, "04:30", "05:30"),

  // ─────────────────────────── BIONIC JUNGLE ───────────────────────────
  // FRI
  mk("b2",  "Stacy Christine",         "House",                  "bionic",  1, "19:00", "20:00"),
  mk("b3",  "The Carry Nation",        "House",                  "bionic",  1, "20:00", "21:30"),
  mk("b4",  "Massimiliano Pagliara",   "House",                  "bionic",  1, "21:30", "23:00"),
  mk("b5",  "Paramida",                "Disco / House",          "bionic",  1, "23:00", "00:30"),
  mk("b6",  "Salute b2b Chloé Caillet","UK Garage",              "bionic",  1, "00:30", "02:30"),
  mk("b7",  "Robert Hood",             "Detroit Techno",         "bionic",  1, "02:30", "04:00", "Detroit techno originator."),
  mk("b8",  "Avalon Emerson",          "Electro / House",        "bionic",  1, "04:00", "05:30"),
  // SAT
  mk("b9",  "Spray",                   "House",                  "bionic",  2, "20:00", "21:00"),
  mk("b10", "Bashkka b2b Sedef Adasi", "House",                  "bionic",  2, "21:00", "22:30"),
  mk("b11", "HAAi b2b Luke Alessi",    "House",                  "bionic",  2, "22:30", "00:00"),
  mk("b12", "MCR-T",                   "Techno",                 "bionic",  2, "00:00", "01:15"),
  mk("b13", "Bad Boombox b2b Ollie Lishman","House",             "bionic",  2, "01:15", "02:30"),
  mk("b14", "Benwal",                  "House",                  "bionic",  2, "02:30", "03:30"),
  mk("b15", "Baugruppe90",             "Techno",                 "bionic",  2, "03:30", "04:30"),
  mk("b16", "Club Angel",              "House",                  "bionic",  2, "04:30", "05:30"),
  // SUN
  mk("b17", "Alves",                   "House",                  "bionic",  3, "19:00", "20:30"),
  mk("b18", "Isabella",                "Techno",                 "bionic",  3, "20:30", "22:30"),
  mk("b19", "Kinahau",                 "House",                  "bionic",  3, "22:30", "00:00"),
  mk("b20", "Tiga",                    "Electro / House",        "bionic",  3, "00:00", "01:30"),
  mk("b21", "DJ Tennis b2b Red Axes",  "House",                  "bionic",  3, "01:30", "03:30"),
  mk("b22", "Beltran b2b Simas",       "Tech House",             "bionic",  3, "03:30", "05:30"),

  // ─────────────────────────── QUANTUM VALLEY ──────────────────────────
  // FRI
  mk("q1",  "Sarah de Warren",         "Trance Vocalist",        "quantum", 1, "19:00", "20:00"),
  mk("q2",  "Matty Ralph",             "Trance",                 "quantum", 1, "20:00", "21:00"),
  mk("q3",  "Cold Blue",               "Trance",                 "quantum", 1, "21:00", "22:00"),
  mk("q4",  "Pegassi",                 "Psytrance",              "quantum", 1, "22:00", "23:00"),
  mk("q5",  "Darude",                  "Trance",                 "quantum", 1, "23:00", "00:00"),
  mk("q6",  "Cosmic Gate",             "Trance",                 "quantum", 1, "00:00", "01:00"),
  mk("q7",  "Gareth Emery",            "Trance",                 "quantum", 1, "01:00", "02:00"),
  mk("q8",  "Ilan Bluestone",          "Trance",                 "quantum", 1, "02:00", "03:00"),
  mk("q9",  "Paul van Dyk",            "Trance",                 "quantum", 1, "03:00", "04:00"),
  mk("q10", "Darren Porter",           "Trance",                 "quantum", 1, "04:00", "05:30"),
  // SAT
  mk("q11", "Maria Healy",             "Trance / Techno",        "quantum", 2, "19:00", "20:30"),
  mk("q12", "Superstrings",            "Trance",                 "quantum", 2, "20:30", "21:30"),
  mk("q13", "Billy Gillies",           "Trance",                 "quantum", 2, "21:30", "22:30"),
  mk("q14", "Paul Oakenfold",          "Trance",                 "quantum", 2, "22:30", "23:30"),
  mk("q15", "Andrew Rayel",            "Trance",                 "quantum", 2, "23:30", "00:30"),
  mk("q16", "Maddix",                  "Big Room / Techno",      "quantum", 2, "00:30", "01:30"),
  mk("q17", "Mathame",                 "Melodic Techno",         "quantum", 2, "01:30", "02:30"),
  mk("q18", "Astrix",                  "Psytrance",              "quantum", 2, "02:30", "03:30"),
  mk("q19", "T78",                     "Acid Techno",            "quantum", 2, "03:30", "04:30"),
  mk("q20", "Thomas Schumacher",       "Techno",                 "quantum", 2, "04:30", "05:30"),
  // SUN
  mk("q21", "Warung",                  "Melodic House",          "quantum", 3, "19:00", "20:00"),
  mk("q22", "Shingo Nakamura",         "Progressive",            "quantum", 3, "20:00", "21:00", "Melodic progressive. Sunset specialist."),
  mk("q23", "Rebūke",                  "Techno",                 "quantum", 3, "21:00", "22:00"),
  mk("q24", "Cristoph",                "Progressive House",      "quantum", 3, "22:00", "23:00"),
  mk("q25", "Eli & Fur",               "Melodic House",          "quantum", 3, "23:00", "00:00"),
  mk("q26", "Tinlicker (DJ Set)",      "Melodic House",          "quantum", 3, "00:00", "01:00"),
  mk("q27", "Cassian",                 "Melodic House",          "quantum", 3, "01:00", "02:15"),
  mk("q28", "Massano",                 "Melodic Techno",         "quantum", 3, "02:15", "03:30"),
  mk("q29", "Innellea",                "Melodic Techno",         "quantum", 3, "03:30", "04:30"),
  mk("q30", "Kream",                   "Melodic House",          "quantum", 3, "04:30", "05:30"),

  // ─────────────────────────── WASTELAND ───────────────────────────────
  // FRI
  mk("w1",  "Dømina",                  "Hardstyle",              "waste",   1, "19:00", "20:30"),
  mk("w2",  "Serafina",                "Hardstyle",              "waste",   1, "20:30", "21:30"),
  mk("w3",  "Johannes Schuster",       "Hardstyle",              "waste",   1, "21:30", "22:30"),
  mk("w4",  "Adrian Mills",            "Hardstyle",              "waste",   1, "22:30", "23:30"),
  mk("w5",  "Cloudy",                  "Hardstyle",              "waste",   1, "23:30", "00:30"),
  mk("w6",  "Kuko",                    "Hardstyle",              "waste",   1, "00:30", "01:30"),
  mk("w7",  "Gravedgr",                "Hardstyle",              "waste",   1, "01:30", "02:30"),
  mk("w8",  "Rebekah",                 "Industrial Techno",      "waste",   1, "02:30", "03:30"),
  mk("w9",  "Dyen",                    "Hardstyle",              "waste",   1, "03:30", "04:30"),
  mk("w10", "Stan Christ",             "Hardstyle",              "waste",   1, "04:30", "05:30"),
  // SAT
  mk("w11", "Cutdwn",                  "Hardstyle",              "waste",   2, "19:00", "20:30"),
  mk("w12", "Dead X",                  "Hard Dance",             "waste",   2, "20:30", "21:30"),
  mk("w13", "The Saints",              "Hardcore",               "waste",   2, "21:30", "22:30"),
  mk("w14", "Rob Gee b2b Lenny Dee",   "Hardcore",               "waste",   2, "22:30", "23:30"),
  mk("w15", "Lady Faith b2b LNY TNZ",  "Hardstyle",              "waste",   2, "23:30", "00:30"),
  mk("w16", "Audiofreq b3b Code Black b3b Toneshifterz","Hardstyle","waste",2, "00:30", "01:30"),
  mk("w17", "Da Tweekaz",              "Hardstyle",              "waste",   2, "01:30", "02:30"),
  mk("w18", "Lil Texas",               "Hardcore",               "waste",   2, "02:30", "03:30"),
  mk("w19", "Mish",                    "Hardstyle",              "waste",   2, "03:30", "04:30"),
  mk("w30", "Alyssa Jolee",            "Hardstyle",              "waste",   2, "04:30", "05:30"),
  // SUN
  mk("w20", "Sihk",                    "Hardstyle",              "waste",   3, "19:00", "20:30"),
  mk("w21", "Clawz",                   "Hardstyle",              "waste",   3, "20:30", "21:30"),
  mk("w22", "The Purge",               "Hardstyle",              "waste",   3, "21:30", "22:30"),
  mk("w23", "Yosuf",                   "Hardstyle",              "waste",   3, "22:30", "23:30"),
  mk("w24", "DJ Isaac",                "Hardstyle",              "waste",   3, "23:30", "00:30"),
  mk("w25", "Vieze Asbak",             "Hardcore",               "waste",   3, "00:30", "01:30"),
  mk("w26", "Sub Zero Project",        "Hardstyle",              "waste",   3, "01:30", "02:30"),
  mk("w27", "Rooler",                  "Hardcore / Uptempo",     "waste",   3, "02:30", "03:30"),
  mk("w28", "Warface",                 "Hardstyle",              "waste",   3, "03:30", "04:30"),
  mk("w29", "Madgrrl b2b Vessel",      "Hardstyle",              "waste",   3, "04:30", "05:30"),

  // ─────────────────────────── STEREO BLOOM ────────────────────────────
  // FRI
  mk("s1",  "Abana b2b Juliet Mendoza","Tech House",             "stereo",  1, "19:00", "20:00"),
  mk("s2",  "Slamm",                   "Tech House",             "stereo",  1, "20:00", "21:00"),
  mk("s3",  "Luuk van Dijk",           "Tech House",             "stereo",  1, "21:00", "22:15"),
  mk("s4",  "Omar+",                   "House",                  "stereo",  1, "22:15", "23:30"),
  mk("s5",  "Luke Dean",               "Tech House",             "stereo",  1, "23:30", "00:45"),
  mk("s6",  "Josh Baker",              "Tech House",             "stereo",  1, "00:45", "02:00"),
  mk("s7",  "Max Dean",                "Tech House",             "stereo",  1, "02:00", "03:15"),
  mk("s8",  "Obskür",                  "Tech House",             "stereo",  1, "03:15", "04:30"),
  mk("s9",  "Toman",                   "Tech House",             "stereo",  1, "04:30", "05:30"),
  // SAT
  mk("s10", "Slugg",                   "Tech House",             "stereo",  2, "19:00", "20:00"),
  mk("s11", "Discip",                  "Tech House",             "stereo",  2, "21:00", "22:00"),
  mk("s12", "Omnom",                   "Bass House",             "stereo",  2, "22:00", "23:15"),
  mk("s13", "Noizu",                   "Bass House",             "stereo",  2, "23:15", "00:30"),
  mk("s14", "Wax Motif",               "Bass House",             "stereo",  2, "00:30", "01:45"),
  mk("s15", "Cid",                     "Tech House",             "stereo",  2, "01:45", "03:00"),
  mk("s16", "HNTR",                    "Bass House",             "stereo",  2, "03:00", "04:15"),
  mk("s17", "Bolo (Sunrise Set)",      "Tech House",             "stereo",  2, "04:15", "05:30"),
  // SUN
  mk("s18", "KLO",                     "Tech House",             "stereo",  3, "19:00", "20:00"),
  mk("s19", "Murphy's Law",            "Tech House",             "stereo",  3, "20:00", "21:15"),
  mk("s20", "Sidney Charles b2b Bushbaby","Tech House",          "stereo",  3, "21:15", "22:30"),
  mk("s21", "Skream",                  "Dubstep / House",        "stereo",  3, "22:30", "23:45"),
  mk("s22", "Hamdi",                   "UK Bass",                "stereo",  3, "23:45", "01:00"),
  mk("s23", "Chris Lorenzo b2b Bullet Tooth","Bass House",       "stereo",  3, "01:00", "02:15"),
  mk("s24", "Silva Bumpa",             "UK House",               "stereo",  3, "02:15", "03:30"),
  mk("s25", "Morgan Seatree",          "Tech House",             "stereo",  3, "03:30", "04:30"),
  mk("s26", "Lu.Re",                   "Tech House",             "stereo",  3, "04:30", "05:30"),

  // ─────────────────────────── BASSPOD ─────────────────────────────────
  // FRI
  mk("bp21","Riot",                    "Dubstep",                "basspod", 1, "19:00", "19:50"),
  mk("bp22","Heyz",                    "Dubstep",                "basspod", 1, "19:50", "20:40"),
  mk("bp23","Muzz",                    "Dubstep",                "basspod", 1, "20:40", "21:30"),
  mk("bp24","Gorillat",                "Dubstep",                "basspod", 1, "21:30", "22:30"),
  mk("bp25","Ghengar",                 "Dubstep",                "basspod", 1, "22:30", "23:30"),
  mk("bp26","Deathpact",               "Dubstep",                "basspod", 1, "23:30", "00:30"),
  mk("bp27","ATLiens",                 "Dubstep",                "basspod", 1, "00:30", "01:30"),
  mk("bp28","Kai Wachi",               "Dubstep",                "basspod", 1, "01:30", "02:30"),
  mk("bp29","Adventure Club (Throwback Set)","Dubstep",          "basspod", 1, "02:30", "03:30"),
  mk("bp30","Culture Shock",           "DnB",                    "basspod", 1, "03:30", "04:30"),
  mk("bp31","Cyclops",                 "Dubstep",                "basspod", 1, "04:30", "05:30"),
  // SAT
  mk("bp1", "Fallen with MC Dino",     "Dubstep",                "basspod", 2, "19:00", "19:50"),
  mk("bp2", "Avello b2b Dennett",      "Dubstep",                "basspod", 2, "19:50", "20:40"),
  mk("bp3", "Viperactive",             "Dubstep",                "basspod", 2, "20:40", "21:30"),
  mk("bp4", "Hybrid Minds",            "Liquid DnB",             "basspod", 2, "21:30", "22:30"),
  mk("bp5", "YDG",                     "Dubstep",                "basspod", 2, "22:30", "23:30"),
  mk("bp6", "Delta Heavy",             "DnB",                    "basspod", 2, "23:30", "00:30"),
  mk("bp7", "Getter",                  "Dubstep",                "basspod", 2, "00:30", "01:30"),
  mk("bp8", "Eptic b2b Space Laces",   "Dubstep",                "basspod", 2, "01:30", "02:30"),
  mk("bp9", "Doctor P b2b Flux Pavilion b3b Funtcase","Dubstep", "basspod", 2, "02:30", "03:30"),
  mk("bp10","Hol!",                    "Dubstep",                "basspod", 2, "03:30", "04:30"),
  mk("bp11","Mary Droppinz",           "Dubstep",                "basspod", 2, "04:30", "05:30"),
  // SUN
  mk("bp12","Nightstalker with MC Dino","Dubstep",               "basspod", 3, "19:00", "19:50"),
  mk("bp13","Sippy",                   "Dubstep",                "basspod", 3, "19:50", "20:40"),
  mk("bp14","Eazybaked",               "Bass",                   "basspod", 3, "20:40", "21:30"),
  mk("bp15","Infekt b2b Samplifire",   "Dubstep",                "basspod", 3, "21:30", "22:30"),
  mk("bp32","A.M.C w/ Phantom",        "DnB",                    "basspod", 3, "22:30", "23:30"),
  mk("bp16","Virtual Riot",            "Dubstep",                "basspod", 3, "23:30", "00:30"),
  mk("bp17","Peekaboo",                "Dubstep",                "basspod", 3, "00:30", "01:30"),
  mk("bp18","Ahee b2b Liquid Stranger","Dubstep / Bass",         "basspod", 3, "01:30", "02:30"),
  mk("bp19","Whethan",                 "Electronic",             "basspod", 3, "02:30", "03:30"),
  mk("bp20","Boogie T b2b Distinct Motive","Dubstep",            "basspod", 3, "03:30", "04:30"),
  mk("bp33","Æon:Mode (Sunrise Set)",  "Dubstep / Bass",         "basspod", 3, "04:30", "05:30"),
];

// Day chips for any festival config. The window export at the bottom of
// this file re-derives DAYS from the ACTIVE config — this const is only
// the EDC default for anything that reads it before the switch runs.
function _daysFor(cfg) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Object.entries(cfg.dayDates || {}).map(([n, d]) =>
    ({ n: +n, label: d.short, date: `${months[d.m]} ${d.d}` }));
}
const DAYS = _daysFor(FESTIVAL_CONFIG);

// NOW is a live-computed Proxy — every access reflects the real clock.
// All existing NOW.xxx consumers continue working without any changes.
let _nowCache = null;
let _nowCacheAt = 0;
function _computeNow() {
  const utcNow = Date.now();
  // 30-second cache — fast for repeated accesses in a single render pass
  if (_nowCache && utcNow - _nowCacheAt < 30000) return _nowCache;

  // Current time in festival tz (PDT = UTC-7)
  const localMs = utcNow + FESTIVAL_CONFIG.utcOffsetHours * 3600000;
  const hh = Math.floor(localMs / 3600000) % 24;
  const mm = Math.floor(localMs / 60000) % 60;
  const timeStr = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;

  // Convert HH:MM to absolute UTC ms for a given festival day.
  // Mirrors toNightMin: times before 08:00 belong to the next calendar day.
  function absMs(day, hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const base = FESTIVAL_CONFIG.dayDates[day]?.midnightUtc;
    if (!base) return Infinity;
    return base + (h < 8 ? 86400000 : 0) + h * 3600000 + m * 60000;
  }

  // Find artists currently on stage
  const liveNow = ARTISTS.filter(a => {
    const s = absMs(a.day, a.start), e = absMs(a.day, a.end);
    return utcNow >= s && utcNow < e;
  });

  // Featured: prefer main stage, then highest tier
  const currentArtist = liveNow.find(a => a.stage === FESTIVAL_CONFIG.mainStageId)
    || [...liveNow].sort((a, b) => (b.tier || 0) - (a.tier || 0))[0]
    || null;

  // Next upcoming
  const nextArtist = ARTISTS
    .filter(a => absMs(a.day, a.start) > utcNow)
    .sort((a, b) => absMs(a.day, a.start) - absMs(b.day, b.start))[0]
    || null;

  const day = currentArtist?.day || nextArtist?.day || 1;
  const elapsedMin = currentArtist
    ? Math.max(0, Math.floor((utcNow - absMs(currentArtist.day, currentArtist.start)) / 60000))
    : 0;

  _nowCache = { day, time: timeStr, currentArtistId: currentArtist?.id || null, nextArtistId: nextArtist?.id || null, elapsedMin };
  _nowCacheAt = utcNow;
  return _nowCache;
}
const NOW = new Proxy({}, { get(_, prop) { return _computeNow()[prop]; } });

// Live notifications feed (populated at runtime from saved sets / crew / safety alerts)
const ALERTS = [];

// Essentials — safety/info drawer
const ESSENTIALS = [
  { id: "e1", icon: "med",     title: "Medical & Mental Health",  sub: "3 medic tents · 24/7 roamers",   tone: "ember" },
  { id: "e2", icon: "water",   title: "Water Refill Stations",     sub: "9 stations · always free",        tone: "sky" },
  { id: "e3", icon: "shuttle", title: "Shuttles & Rideshare",      sub: "Last shuttle 5:45 AM · Lot E",    tone: "dune" },
  { id: "e4", icon: "lost",    title: "Lost & Found",              sub: "Info booth · Daisy Lane",         tone: "horizon" },
  { id: "e5", icon: "info",    title: "Entry Hours & Policies",    sub: "Gates 4PM–5AM · no re-entry",     tone: "ink" },
  { id: "e6", icon: "consent", title: "Consent & Reporting",       sub: "Tap for anonymous report line",   tone: "ember" },
];

// ─────────────────────────────────────────────────────────────
// ACL 2026 — Austin City Limits at Zilker Park
// ─────────────────────────────────────────────────────────────
// Stage x/y calibrated to the ACL 2025 Zilker Park map (north-up,
// 0–100 grid). Compass: N=up, Lady Bird Lake = top-right,
// Barton Springs Rd = bottom, Andrew Zilker Rd = left edge.
// Positions calibrated against the official ACL 2025 patron map (acl-map-2025.webp).
const ACL_STAGES = [
  { id: "honda",   name: "Honda Stage",       short: "HONDA",color: "#e85d2e", x: 14, y: 26, size: 1.5, desc: "West side · sub-headliners",    vibe: "The Other Main",   vibeNote: "Second headliner stage. Opposite end from AMEX.",               peak: "17:00–22:00" },
  { id: "amex",    name: "American Express",  short: "AMEX", color: "#ec4899", x: 92, y: 49, size: 1.7, desc: "East side · headliners",        vibe: "Main Event",       vibeNote: "The big stage. Headliners close here every night.",             peak: "17:00–22:00" },
  { id: "titos",   name: "Tito's Stage",      short: "TITO'S",color: "#f97316", x: 80, y: 31, size: 1.2, desc: "North-east · mid-large stage",  vibe: "Texas Heat",        vibeNote: "Austin locals + rising stars. Vodka optional.",                 peak: "13:00–19:00" },
  { id: "miller",  name: "Miller Lite Stage", short: "MILLER",color: "#38bdf8", x: 31, y: 24, size: 1.0, desc: "North · by Lady Bird Lake",     vibe: "Chill Vibes",       vibeNote: "Shade, cold beer, great sound. Closest to the lake.",           peak: "13:00–19:00" },
  { id: "tmobile", name: "T-Mobile Stage",    short: "T-MOBILE",color: "#a855f7", x: 8, y: 34, size: 1.2, desc: "West side · third stage",       vibe: "Discovery Stage",   vibeNote: "Where you find your next obsession.",                          peak: "14:00–20:00" },
  { id: "ladybird",name: "Lady Bird Stage",   short: "LADY BIRD",color: "#22c55e", x: 48, y: 52, size: 1.1, desc: "Center · mid-size stage",       vibe: "By the Lake",       vibeNote: "Breezy sets in the heart of the park. Best sunset views.",       peak: "14:00–20:00" },
  { id: "bmi",     name: "BMI Stage",         short: "BMI",  color: "#fbbf24", x: 25, y: 54, size: 0.9, desc: "Center-left · songwriter stage", vibe: "Songwriter's Corner",vibeNote: "Stripped-down, intimate. Singer-songwriter heaven.",           peak: "12:00–18:00" },
  { id: "barton",  name: "Barton Springs",    short: "BARTON",color: "#14b8a6", x: 52, y: 73, size: 0.85,desc: "South · near Barton Springs entrance", vibe: "Deep Cuts", vibeNote: "Hidden gem stage near Barton Springs entrance.",                peak: "12:00–17:00" },
  { id: "bonus",   name: "Bonus Tracks",      short: "BONUS",color: "#2563eb", x: 57, y: 64, size: 0.7, desc: "South-east · smallest stage",   vibe: "First Timers",      vibeNote: "Local acts, first-ever festival sets. Near the grove.",         peak: "11:00–16:00" },
  { id: "beatbox", name: "BEATBOX",           short: "BBX",  color: "#1e40af", x: 22, y: 72, size: 0.75,desc: "South-west · electronic stage",  vibe: "Bass Haven",        vibeNote: "DJs, producers, electronic acts. Near west entrance.",          peak: "14:00–21:00" },
];

const _aclMk = (id, name, genre, stage, day, start, end, wk) => {
  const h = parseInt(start.split(':')[0]);
  const tier = h >= 19 ? 3 : h >= 16 ? 2 : 1;
  return { id, name, genre, country: "—", stage, day, start, end, tier, weekend: wk || "both",
    img: `linear-gradient(135deg, ${ACL_STAGES.find(s=>s.id===stage)?.color || "#e85d2e"}, #1a0a28)`,
    bio: `Playing ACL 2026.${wk ? ` Weekend ${wk} only.` : ""}` };
};

const ACL_ARTISTS = [
  // ── FRIDAY ──
  // American Express (headliners)
  _aclMk("af1", "Charli XCX",            "Pop",           "amex",    1, "20:30","22:00"),
  _aclMk("af2", "Skrillex",              "Electronic",    "amex",    1, "18:30","20:00","W1"),
  _aclMk("af3", "Kings of Leon",         "Rock",          "amex",    1, "18:30","20:00","W2"),
  // Honda (sub-headliners)
  _aclMk("af4", "Turnstile",             "Hardcore Punk",  "honda",  1, "20:00","21:30"),
  _aclMk("af5", "Labrinth",              "R&B / Electronic","honda", 1, "18:00","19:30"),
  _aclMk("af6", "The Chainsmokers",      "Electro Pop",   "honda",  1, "16:00","17:30"),
  _aclMk("af7", "Leon Thomas",           "R&B",           "titos",  1, "18:00","19:30"),
  _aclMk("af8", "Brandon Flowers",       "Indie Rock",    "tmobile", 1, "20:30","22:00","W1"),
  // Mid-tier
  _aclMk("af9",  "Amyl and the Sniffers","Punk Rock",     "tmobile", 1, "19:00","20:00"),
  _aclMk("af10", "Steve Aoki",           "EDM",           "beatbox", 1, "18:00","19:30"),
  _aclMk("af11", "Jesse Welles",         "Country Pop",   "ladybird",1, "17:00","18:00"),
  _aclMk("af12", "BUNT.",                "Folk Electronic","miller", 1, "16:00","17:00"),
  _aclMk("af13", "Bella Kay",            "Pop",           "titos",  1, "17:00","18:00","W2"),
  _aclMk("af14", "Paris Paloma",         "Folk Pop",      "bmi",    1, "17:00","18:30"),
  _aclMk("af15", "LP",                   "Indie Pop",     "ladybird",1, "15:00","16:00"),
  _aclMk("af16", "Rusowsky",             "Indie Pop",     "barton", 1, "16:00","17:00"),
  _aclMk("af17", "Natasha Bedingfield",  "Pop",           "miller", 1, "18:00","19:00","W2"),
  _aclMk("af18", "Łaszewo",              "Electronic",    "beatbox", 1, "16:30","18:00","W2"),
  _aclMk("af19", "Kingfishr",            "Indie",         "barton", 1, "15:00","16:00","W2"),
  _aclMk("af20", "Marlon Funaki",        "Indie",         "bmi",    1, "15:00","16:00","W1"),
  _aclMk("af21", "CMAT",                 "Country Pop",   "ladybird",1, "13:30","14:30"),
  _aclMk("af22", "Rebecca Black",        "Pop",           "miller", 1, "14:00","15:00","W1"),
  _aclMk("af23", "Bo Staloch",           "Folk",          "bmi",    1, "13:00","14:00","W1"),
  _aclMk("af24", "Molly Santana",        "R&B",           "bonus",  1, "15:00","16:00","W1"),
  _aclMk("af25", "World Famous Pets",    "Indie",         "bonus",  1, "15:00","16:00","W2"),
  _aclMk("af26", "Faouzia",              "Pop",           "tmobile", 1, "15:00","16:00"),
  _aclMk("af27", "Hunx and His Punx",    "Garage Punk",   "barton", 1, "13:00","14:00","W1"),
  _aclMk("af28", "New Constellations",   "Indie",         "bonus",  1, "13:00","14:00","W1"),
  _aclMk("af29", "Asleep at the Wheel",  "Country",       "bmi",    1, "16:00","17:00","W1"),
  _aclMk("af30", "S.G. Goodman",         "Americana",     "barton", 1, "14:00","15:00","W2"),
  _aclMk("af31", "Cassandra Coleman",    "Soul",          "bonus",  1, "16:00","17:00","W2"),
  _aclMk("af32", "Brigitte Calls Me Baby","Indie Pop",    "barton", 1, "17:00","18:00","W2"),
  _aclMk("af33", "Dallas Wax",           "Indie",         "bonus",  1, "14:00","15:00","W2"),
  _aclMk("af34", "Night Traveler",       "Indie",         "bonus",  1, "14:00","15:00","W1"),
  _aclMk("af35", "Grocery Bag",          "Indie Rock",    "barton", 1, "12:00","13:00","W1"),
  _aclMk("af36", "Joe Jordan",           "Singer-Songwriter","bonus",1,"12:00","13:00","W2"),
  _aclMk("af37", "Happy Landing",        "Indie",         "barton", 1, "12:00","13:00","W2"),
  _aclMk("af38", "Girlfriend",           "Pop",           "bonus",  1, "17:00","18:00","W2"),
  _aclMk("af39", "Elle Coves",           "Dream Pop",     "barton", 1, "18:00","19:00","W1"),
  _aclMk("af40", "Izzy Escobar",         "Pop",           "bonus",  1, "12:00","13:00","W1"),
  _aclMk("af41", "Almost Heaven",        "Indie",         "bonus",  1, "13:00","14:00","W2"),
  _aclMk("af42", "Solomon Hicks",        "Blues",         "bmi",    1, "12:00","13:00","W1"),
  _aclMk("af43", "Leon Knight",          "R&B",           "bonus",  1, "14:00","15:00","W2"),
  _aclMk("af44", "The 4411",             "Soul",          "bonus",  1, "17:00","18:00","W1"),

  // ── SATURDAY ──
  _aclMk("as1", "Rüfüs Du Sol",          "Electronic",    "amex",    2, "20:30","22:00"),
  _aclMk("as2", "Lorde",                 "Art Pop",       "honda",   2, "20:00","21:30"),
  _aclMk("as3", "Lola Young",            "Pop / Soul",    "tmobile", 2, "20:30","22:00"),
  _aclMk("as4", "Young Miko",            "Reggaeton",     "titos",   2, "19:00","20:30"),
  _aclMk("as5", "Bleachers",             "Indie Pop",     "honda",   2, "18:00","19:30"),
  _aclMk("as6", "Lykke Li",              "Indie Pop",     "ladybird",2, "18:00","19:30"),
  _aclMk("as7", "Levity",                "Electronic",    "beatbox", 2, "18:00","19:30"),
  _aclMk("as8", "Suki Waterhouse",       "Indie Pop",     "tmobile", 2, "18:30","20:00"),
  _aclMk("as9", "Sienna Spiro",          "Pop",           "miller",  2, "18:00","19:30","W2"),
  _aclMk("as10","Snow Strippers",        "Electro Pop",   "beatbox", 2, "15:00","16:30"),
  _aclMk("as11","It's Murph",            "Pop",           "ladybird",2, "17:00","18:00"),
  _aclMk("as12","Fakemink",              "Electronic",    "beatbox", 2, "16:00","17:30"),
  _aclMk("as13","Palace",                "Indie Rock",    "miller",  2, "16:00","17:30","W1"),
  _aclMk("as14","¥øu$uk€ ¥uk1mat$u",     "Electronic",    "beatbox", 2, "14:00","15:30"),
  _aclMk("as15","Skye Newman",           "Indie",         "bmi",     2, "17:00","18:00"),
  _aclMk("as16","Rodrigo y Gabriela",    "Acoustic",      "titos",   2, "15:00","16:30"),
  _aclMk("as17","Balu Brigada",          "Indie Pop",     "ladybird",2, "15:00","16:00"),
  _aclMk("as18","Rochelle Jordan",       "R&B",           "beatbox", 2, "13:00","14:00","W1"),
  _aclMk("as19","Arcy Drive",            "Indie",         "barton",  2, "16:00","17:00"),
  _aclMk("as20","Finn Wolfhard",         "Indie Rock",    "miller",  2, "14:00","15:00"),
  _aclMk("as21","Ryan Beatty",           "Indie Pop",     "bmi",     2, "15:00","16:30"),
  _aclMk("as22","Don West",              "Hip Hop",       "titos",   2, "16:00","17:00"),
  _aclMk("as23","Temper City",           "Indie",         "barton",  2, "14:00","15:00"),
  _aclMk("as24","Gabriel Jacoby",        "R&B",           "bmi",     2, "13:00","14:00","W2"),
  _aclMk("as25","Night Tapes",           "Dream Pop",     "barton",  2, "15:00","16:00"),
  _aclMk("as26","DJ Cassandra",          "Electronic",    "beatbox", 2, "12:00","13:00","W1"),
  _aclMk("as27","Cure for Paranoia",     "Hip Hop",       "bonus",   2, "15:00","16:00","W1"),
  _aclMk("as28","Nat Myers",             "Blues",         "bmi",     2, "12:00","13:00","W2"),
  _aclMk("as29","Chloe Qisha",           "Pop",           "bonus",   2, "14:00","15:00","W2"),
  _aclMk("as30","Fai Laci",              "Indie",         "bonus",   2, "13:00","14:00","W1"),
  _aclMk("as31","Emma Ogier",            "Pop",           "bonus",   2, "12:00","13:00","W1"),
  _aclMk("as32","Common People",         "Indie",         "barton",  2, "13:00","14:00","W2"),
  _aclMk("as33","Coleman Jennings",      "Country",       "barton",  2, "12:00","13:00","W1"),
  _aclMk("as34","Damaris Bojor",         "Pop",           "bonus",   2, "16:00","17:00","W2"),
  _aclMk("as35","Fightmaster",           "Rock",          "bonus",   2, "17:00","18:00","W1"),
  _aclMk("as36","Lluvii",                "Indie",         "bonus",   2, "12:00","13:00","W2"),
  _aclMk("as37","Montclair",             "Indie Rock",    "barton",  2, "17:00","18:00","W2"),
  _aclMk("as38","Left Lucid",            "Indie",         "bonus",   2, "15:00","16:00","W2"),
  _aclMk("as39","Presley Regier",        "Singer-Songwriter","bonus",2,"13:00","14:00","W2"),

  // ── SUNDAY ──
  _aclMk("au1", "Twenty One Pilots",     "Alt Rock",      "amex",    3, "20:30","22:00"),
  _aclMk("au2", "The xx",                "Indie Electronic","honda",  3, "20:00","21:30"),
  _aclMk("au3", "Geese",                 "Art Rock",      "tmobile", 3, "20:30","22:00"),
  _aclMk("au4", "Sofi Tukker",           "House",         "beatbox", 3, "19:00","20:30"),
  _aclMk("au5", "Parcels",               "Disco / Funk",  "ladybird",3, "18:00","19:30"),
  _aclMk("au6", "The War on Drugs",      "Indie Rock",    "honda",   3, "18:00","19:30"),
  _aclMk("au7", "Blood Orange",          "Art Pop / R&B", "tmobile", 3, "18:30","20:00"),
  _aclMk("au8", "Max McNown",            "Pop",           "titos",   3, "18:00","19:30"),
  _aclMk("au9", "Cannons",               "Synth Pop",     "miller",  3, "18:00","19:30","W1"),
  _aclMk("au10","Audrey Hobert",         "Indie",         "ladybird",3, "17:00","18:00"),
  _aclMk("au11","Saint Motel",           "Indie Pop",     "miller",  3, "16:00","17:30"),
  _aclMk("au12","Houndmouth",            "Americana",     "bmi",     3, "17:00","18:30","W2"),
  _aclMk("au13","Fcukers",               "Punk",          "tmobile", 3, "16:00","17:00"),
  _aclMk("au14","Stella Lefty",          "Indie",         "barton",  3, "16:00","17:00","W1"),
  _aclMk("au15","Underscores",           "Hyperpop",      "beatbox", 3, "16:00","17:30","W1"),
  _aclMk("au16","Claire Rosinkranz",     "Pop",           "ladybird",3, "15:00","16:00"),
  _aclMk("au17","Noga Erez",             "Art Pop",       "titos",   3, "17:00","18:00"),
  _aclMk("au18","Rio Kosta",             "Indie",         "barton",  3, "14:00","15:00"),
  _aclMk("au19","Josh Conway",           "Country",       "bmi",     3, "15:00","16:00","W1"),
  _aclMk("au20","Ethan Regan",           "Indie",         "barton",  3, "15:00","16:00","W2"),
  _aclMk("au21","Bad Nerves",            "Punk Rock",     "miller",  3, "14:00","15:00","W1"),
  _aclMk("au22","Charlotte Lawrence",    "Pop",           "ladybird",3, "13:30","14:30","W2"),
  _aclMk("au23","Paloma Morphy",         "Indie",         "bmi",     3, "13:00","14:00"),
  _aclMk("au24","Sunday (1994)",         "Indie Rock",    "miller",  3, "15:00","16:00"),
  _aclMk("au25","Rum Jungle",            "Indie",         "barton",  3, "17:00","18:00","W2"),
  _aclMk("au26","Calder Allen",          "Country",       "titos",   3, "15:00","16:00"),
  _aclMk("au27","Fancy Hagood",          "Folk Pop",      "bmi",     3, "16:00","17:00","W1"),
  _aclMk("au28","Britton",               "Country",       "bonus",   3, "14:00","15:00","W1"),
  _aclMk("au29","Solya",                 "Indie",         "bonus",   3, "15:00","16:00","W1"),
  _aclMk("au30","Villanelle",            "Indie",         "bonus",   3, "16:00","17:00","W1"),
  _aclMk("au31","Kevin Atwater",         "R&B",           "bonus",   3, "14:00","15:00","W2"),
  _aclMk("au32","Thomas Day",            "Pop",           "bonus",   3, "12:00","13:00","W1"),
  _aclMk("au33","Aaron Rowe",            "Indie",         "bonus",   3, "13:00","14:00","W1"),
  _aclMk("au34","Lauren Sanderson",      "Pop",           "barton",  3, "12:00","13:00","W1"),
  _aclMk("au35","Vwillz",                "Electronic",    "beatbox", 3, "16:00","17:30","W2"),
  _aclMk("au36","Sasha Keable",          "R&B",           "bonus",   3, "15:00","16:00","W2"),
  _aclMk("au37","Rubio",                 "Latin",         "barton",  3, "13:00","14:00","W1"),
  _aclMk("au38","Marzz",                 "R&B",           "bonus",   3, "16:00","17:00","W2"),
  _aclMk("au39","Chelsea Jordan",        "R&B",           "bonus",   3, "12:00","13:00","W2"),
  _aclMk("au40","The Moriah Sisters",    "Country",       "bmi",     3, "12:00","13:00","W1"),
  _aclMk("au41","The Huston-Tillotson University Jazz Collective","Jazz","bmi",3,"12:00","13:00","W2"),
  // Missing artists added from ACL 2026 official lineup audit
  _aclMk("af45", "The Marias",            "Indie Pop",     "titos",   1, "16:30","18:00"),
  _aclMk("af46", "Role Model",            "Indie Pop",     "ladybird",1, "18:00","19:00"),
  _aclMk("as40", "Rilo Kiley",            "Indie Rock",    "tmobile", 2, "18:00","19:30"),
  _aclMk("as41", "Djo",                   "Indie",         "ladybird",2, "14:00","15:30"),
  _aclMk("au42", "Pierce The Veil",       "Post-Hardcore", "tmobile", 3, "17:00","18:00"),
  _aclMk("au43", "Sabrina Claudio",       "R&B",           "titos",   3, "16:00","17:00"),
];

const ACL_AMENITIES = [
  { id: "aa1", type: "water",  label: "Hydration",      x: 35, y: 40 },
  { id: "aa2", type: "water",  label: "Hydration",      x: 65, y: 55 },
  { id: "aa3", type: "food",   label: "ACL Eats",       x: 50, y: 35 },
  { id: "aa4", type: "food",   label: "ACL Eats South",  x: 45, y: 65 },
  { id: "aa5", type: "med",    label: "Medical",        x: 55, y: 60 },
  { id: "aa6", type: "toilet", label: "Restrooms",      x: 30, y: 30 },
  { id: "aa7", type: "toilet", label: "Restrooms",      x: 70, y: 45 },
  { id: "aa8", type: "info",   label: "Guest Services",  x: 20, y: 35 },
];

// ── Multi-festival data switching ──────────────────────────────────
// Registry-keyed data sets (v228, was a two-festival ternary): when the
// active festival changes, STAGES / ARTISTS / AMENITIES / FESTIVAL_CONFIG
// / DAYS resolve to the right set. The rest of the app reads from
// window.STAGES etc. and doesn't care which festival is active. Adding a
// festival = one entry here + its data above + a registry config.
// Re-evaluate CMS-hosted data at festival #5 (see registry note).
// NOTE: _DATA_SETS is also exported on window — spotify.jsx's
// _artistsForFestival reads it so ARCHIVED festivals resolve their
// ORIGINAL lineups (bare ARTISTS here gets overwritten with the active
// set by the Object.assign below, so it can't serve archives).

// ══════════════════════ EDC ORLANDO 2026 (revival scaffold 2026-08-22) ══════
// Lineup + DAY SPLITS are REAL (official orlando.edc.com/lineup day
// filters, 109 acts; audited vs Insomniac press release 2026-06-23).
// Set times + per-artist stage assignments + official 2026 map are NOT
// published — every artist sits on stage "tba" with placeholder
// 12:00-13:00 times until the flip session. Stage names verified from
// orlando.edc.com/experience/stages (incl. 5th stage CASA BACARDÍ).

const EDCO_STAGES = [
  { id: "kinetic", name: "kineticFIELD",   short: "KINETIC",  color: "#f97316", x: 50, y: 24, size: 1.7, desc: "Main stage",               vibe: "Main Event",      vibeNote: "Headliners under the electric sky.",                 peak: "18:00–00:00" },
  { id: "circuit", name: "circuitGROUNDS", short: "CIRCUIT",  color: "#38bdf8", x: 26, y: 44, size: 1.4, desc: "Epic-melody big room",     vibe: "Big Melodies",    vibeNote: "Trance, melodic bass, anthem energy.",               peak: "16:00–00:00" },
  { id: "neon",    name: "neonGARDEN",     short: "NEON",     color: "#a855f7", x: 74, y: 44, size: 1.3, desc: "Factory 93 home base",     vibe: "House & Techno",  vibeNote: "Factory 93 takeover territory, four-on-the-floor.",  peak: "15:00–00:00" },
  { id: "stereo",  name: "stereoBLOOM",    short: "STEREO",   color: "#f43f5e", x: 36, y: 70, size: 1.1, desc: "Insomniac Records stage",  vibe: "Label Sounds",    vibeNote: "Insomniac Records + Dreamstate hosting.",            peak: "14:00–23:00" },
  { id: "bacardi", name: "CASA BACARDÍ",   short: "BACARDÍ",  color: "#22c55e", x: 64, y: 70, size: 0.9, desc: "Lounge stage",             vibe: "Lounge Sessions", vibeNote: "Day-party energy under the palms.",                  peak: "13:00–20:00" },
  { id: "tba",    name: "Schedule TBA",    short: "TBA",      color: "#9ca3af", x: 50, y: 50, size: 0.1, desc: "PROVISIONAL: stage assignments drop with the official schedule", vibe: "Unscheduled", vibeNote: "Every artist sits here until the official schedule assigns stages + times.", peak: "—" },
];

const _edcoMk = (id, name, genre, day, start, end) => {
  return { id, name, genre, country: "—", stage: "tba", day, start, end, tier: 1,
    img: `linear-gradient(135deg, #22c55e, #04170c)`,
    bio: "Playing EDC Orlando 2026. Day is official (orlando.edc.com day filters); set time + stage are placeholders until the official schedule drops in the Insomniac app (~1-2 weeks out)." };
};

// Official day-by-day lineup (orlando.edc.com/lineup day filters, audited
// 2026-08-22: Fri 36 / Sat 36 / Sun 37 = 109 acts). id prefix:
// ecf Fri Nov 6 / ecs Sat Nov 7 / ecu Sun Nov 8. Genre tags agent-assigned
// for the press-release groupings, default "Electronic" otherwise.
const EDCO_ARTISTS = [
  _edcoMk("ecf1", "AAT",                                      "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf2", "Adventure Club (Sunset Set)",              "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf3", "Afrojack",                                 "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf4", "Alesso (Sunset Set)",                      "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf5", "Azzecca",                                  "House", 1, "12:00","13:00"),
  _edcoMk("ecf6", "Benda B2B Vastive",                        "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf7", "Big Florida",                              "Bass", 1, "12:00","13:00"),
  _edcoMk("ecf8", "Bou B2B Kanine",                           "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf9", "Brunello (Sunset Set)",                    "House", 1, "12:00","13:00"),
  _edcoMk("ecf10", "Bullet Tooth B2B Sidney Charles",          "Techno", 1, "12:00","13:00"),
  _edcoMk("ecf11", "Chris Lorenzo",                            "House", 1, "12:00","13:00"),
  _edcoMk("ecf12", "David Guetta",                             "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf13", "HAYLA",                                    "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf14", "IDEMI",                                    "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf15", "Inbal",                                    "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf16", "Interplanetary Criminal",                  "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf17", "JOA",                                      "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf18", "Josh Baker",                               "House", 1, "12:00","13:00"),
  _edcoMk("ecf19", "Joshwa",                                   "House", 1, "12:00","13:00"),
  _edcoMk("ecf20", "Kompany",                                  "Bass", 1, "12:00","13:00"),
  _edcoMk("ecf21", "KREAM",                                    "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf22", "Level Up",                                 "Bass", 1, "12:00","13:00"),
  _edcoMk("ecf23", "Levity",                                   "Bass", 1, "12:00","13:00"),
  _edcoMk("ecf24", "MALUGI (Sunset Set)",                      "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf25", "Matthias",                                 "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf26", "Mau P",                                    "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf27", "MPH",                                      "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf28", "Omar+",                                    "House", 1, "12:00","13:00"),
  _edcoMk("ecf29", "Pegassi",                                  "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf30", "Prospa B2B Josh Baker",                    "House", 1, "12:00","13:00"),
  _edcoMk("ecf31", "Prospa",                                   "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf32", "RAJE",                                     "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf33", "Sloth",                                    "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf34", "Whethan",                                  "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecf35", "Wooli",                                    "Bass", 1, "12:00","13:00"),
  _edcoMk("ecf36", "Zack Martino",                             "Electronic", 1, "12:00","13:00"),
  _edcoMk("ecs1", "Aaron Hibell",                             "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs2", "ACRAZE B2B CID",                           "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs3", "Alan Walker (Sunset Set)",                 "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs4", "Alison Wonderland",                        "Bass", 2, "12:00","13:00"),
  _edcoMk("ecs5", "ALLEYCVT",                                 "Bass", 2, "12:00","13:00"),
  _edcoMk("ecs6", "Alves",                                    "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs7", "AVELLO",                                   "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs8", "AYYBO",                                    "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs9", "ChaseWest",                                "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs10", "Dennis Cruz",                              "House", 2, "12:00","13:00"),
  _edcoMk("ecs11", "Devault (Sunset Set)",                     "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs12", "Discip",                                   "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs13", "Disco Lines",                              "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs14", "Fallon",                                   "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs15", "Franky Rizardo",                           "House", 2, "12:00","13:00"),
  _edcoMk("ecs16", "Fury with MC Dino",                        "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs17", "Gabss",                                    "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs18", "Greg 99",                                  "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs19", "Jkyl & Hyde",                              "Bass", 2, "12:00","13:00"),
  _edcoMk("ecs20", "Kaskade",                                  "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs21", "KinAhau",                                  "House", 2, "12:00","13:00"),
  _edcoMk("ecs22", "LAYZ",                                     "Bass", 2, "12:00","13:00"),
  _edcoMk("ecs23", "MADVKTM",                                  "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs24", "Mai Iachetti",                             "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs25", "Max Dean, Luke Dean",                      "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs26", "Me n ü",                                   "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs27", "Miguelle & Tons",                          "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs28", "Monoky",                                   "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs29", "Nico Moreno",                              "Techno", 2, "12:00","13:00"),
  _edcoMk("ecs30", "Ray Volpe",                                "Bass", 2, "12:00","13:00"),
  _edcoMk("ecs31", "Roddy Lima",                               "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs32", "Rossi. (Sunset Set)",                      "House", 2, "12:00","13:00"),
  _edcoMk("ecs33", "Skull Machine (Black Tiger Sex Machine x Kai Wachi)", "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs34", "Steve Aoki",                               "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs35", "Subsonic",                                 "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecs36", "Twinsick",                                 "Electronic", 2, "12:00","13:00"),
  _edcoMk("ecu1", "A Little Sound",                           "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu2", "Adrián Mills",                             "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu3", "Alok",                                     "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu4", "AR/CO",                                    "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu5", "ATLiens",                                  "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu6", "Boogie T",                                 "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu7", "Boys Noize B2B Brutalismus 3000",          "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu8", "Chef Boyarbeatz",                          "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu9", "CØNTRA",                                   "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu10", "Deorro B2B DJ Diesel",                     "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu11", "Discovery Project",                        "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu12", "ESSE",                                     "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu13", "Hardwell",                                 "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu14", "Holy Priest",                              "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu15", "I Hate Models",                            "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu16", "Ian Asher",                                "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu17", "Jessica Audiffred",                        "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu18", "Kaivon",                                   "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu19", "KI/KI",                                    "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu20", "Klangkuenstler",                           "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu21", "Know Good",                                "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu22", "M81!",                                     "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu23", "Maddix",                                   "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu24", "Marlon Hoffstadt (Sunset Set)",            "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu25", "Martin Garrix",                            "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu26", "Meduza",                                   "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu27", "Of The Trees (Sunset Set)",                "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu28", "phrva",                                    "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu29", "Ravenscoon",                               "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu30", "San Holo (Wholesome Riddim Set)",          "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu31", "SHDW",                                     "Techno", 3, "12:00","13:00"),
  _edcoMk("ecu32", "Sippy",                                    "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu33", "SLANDER (Sunset Set)",                     "Bass", 3, "12:00","13:00"),
  _edcoMk("ecu34", "Taiki Nulight",                            "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu35", "TroyBoi",                                  "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu36", "Ultrathem",                                "Electronic", 3, "12:00","13:00"),
  _edcoMk("ecu37", "And the most important headliner of all You", "Electronic", 3, "12:00","13:00"),
];

const EDCO_AMENITIES = [
  { id: "eoa1", type: "water",  label: "Hydration",            x: 44, y: 30 },
  { id: "eoa2", type: "water",  label: "Hydration",            x: 60, y: 62 },
  { id: "eoa3", type: "food",   label: "Vendor Village",       x: 50, y: 50 },
  { id: "eoa4", type: "food",   label: "Westside Eats",        x: 22, y: 58 },
  { id: "eoa5", type: "med",    label: "Medical",              x: 54, y: 40 },
  { id: "eoa6", type: "toilet", label: "Restrooms",            x: 30, y: 40 },
  { id: "eoa7", type: "toilet", label: "Restrooms",            x: 70, y: 56 },
  { id: "eoa8", type: "info",   label: "Info & Guest Services", x: 48, y: 18 },
];

// ── Lost Lands 2026 — Legend Valley, Thornville OH (Sep 18–20; early entry Sep 16–17) ──
// Day-by-day lineup = official daily-lineups poster (lostlandsfestival.com,
// aug 2026; mirrored day assignments cross-checked against festivaldust 2026-08-22).
// ⛔ SET TIMES + STAGES NOT PUBLISHED (official app schedule drops ~1 week out):
// every start/end, per-artist stage, stage x/y, and genre label below is
// PROVISIONAL placeholder grid. Do NOT flip `available: true` until the flip
// session replaces them with the official schedule + official 2026 patron map.
const LL_STAGES = [
  { id: "prehistoric",  name: "Prehistoric Paradox", short: "PREHISTORIC", color: "#f97316", x: 50, y: 68, size: 2.2, desc: "Legend Valley main stage", vibe: "Main Energy", vibeNote: "The big one. Pyro, lasers, the whole valley answers.", peak: "17:00–00:00" },
  { id: "wompy-woods",  name: "Wompy Woods",         short: "WOMPY",      color: "#84cc16", x: 68, y: 45, size: 1.6, desc: "Forest-draped second stage", vibe: "In The Trees", vibeNote: "Wobbles in the woods; fan-favorite for a reason.", peak: "14:00–23:00" },
  { id: "crater",       name: "The Crater",          short: "CRATER",     color: "#a855f7", x: 38, y: 50, size: 1.5, desc: "360-degree immersive stage", vibe: "Surround Sound", vibeNote: "Bass in the round - the pre-party home.", peak: "14:00–23:00" },
  { id: "subsidia",     name: "Subsidia Stage",      short: "SUBSIDIA",   color: "#22d3ee", x: 58, y: 38, size: 1.3, desc: "Excision-label showcase stage", vibe: "Label Night", vibeNote: "Subsidia Records takeover energy.", peak: "14:00–22:00" },
  { id: "forest-stage", name: "Forest Stage",        short: "FOREST",     color: "#34d399", x: 30, y: 62, size: 1.1, desc: "Deep-in-the-trees stage", vibe: "Hidden Forest", vibeNote: "Small canopy, big wubs.", peak: "14:00–22:00" },
  { id: "raptor-alley", name: "Raptor Alley",        short: "RAPTOR",     color: "#ef4444", x: 45, y: 25, size: 0.9, desc: "Late-night after-hours lane", vibe: "After Hours", vibeNote: "The valley does not sleep.", peak: "23:00–04:00" },
  { id: "grove",        name: "The Grove",           short: "GROVE",      color: "#eab308", x: 62, y: 22, size: 0.8, desc: "Campground stage", vibe: "Campground", vibeNote: "Morning-to-late sets where the camps live.", peak: "10:00–22:00" },
];

// Tier from curated headliner list (schedule-independent); genres are best-
// known for the obvious names and default to "Bass" for the rest - Lost
// Lands is a bass festival, so the default is honest. Both get corrected at
// the flip session when the official schedule lands.
const _llMk = (id, name, genre, tier, stage, day) => {
  const times = tier === 3 ? ["22:30","00:00"] : tier === 2 ? ["20:00","21:30"] : ["17:00","18:30"];
  return { id, name, genre, country: "—", stage, day, start: times[0], end: times[1], tier,
    img: `linear-gradient(135deg, ${LL_STAGES.find(s=>s.id===stage)?.color || "#84cc16"}, #0a1a0c)`,
    bio: "Playing Lost Lands 2026. Set time + stage provisional - official schedule drops in the Lost Lands app about a week out." };
};

const LL_ARTISTS = [
  // ── WEDNESDAY (day 1 - early entry pre-party) ──
  _llMk("llw1", "Barely Alive", "Dubstep", 2, "crater", 1),
  _llMk("llw2", "Calcium B2B Mad Dubz", "Bass", 2, "crater", 1),
  _llMk("llw3", "Caspa", "Dubstep", 2, "crater", 1),
  _llMk("llw4", "Chassi", "Bass", 2, "crater", 1),
  _llMk("llw5", "Distinct Motive", "Deep Dubstep", 2, "crater", 1),
  _llMk("llw6", "Emorfik B2B Usaybflow", "Bass", 2, "crater", 1),
  _llMk("llw7", "Gardella", "Bass", 2, "crater", 1),
  _llMk("llw8", "Hairitage", "Bass", 2, "crater", 1),
  _llMk("llw9", "Hershe", "Bass", 2, "crater", 1),
  _llMk("llw10", "Hydraulix", "Bass", 2, "crater", 1),
  _llMk("llw11", "Izzy Vadim", "Bass", 2, "crater", 1),
  _llMk("llw12", "Jaenga", "Bass", 2, "crater", 1),
  _llMk("llw13", "Mile32", "Bass", 2, "crater", 1),
  _llMk("llw14", "MPORT", "Bass", 2, "crater", 1),
  _llMk("llw15", "Muerte", "Bass", 2, "crater", 1),
  _llMk("llw16", "Nikita, The Wicked", "Bass", 2, "crater", 1),
  _llMk("llw17", "Riot Ten", "Dubstep", 2, "crater", 1),
  _llMk("llw18", "Smoakland", "Bass", 2, "crater", 1),
  // ── THURSDAY (day 2 - early entry) ──
  _llMk("llh1", "Alienpark", "Bass", 2, "crater", 2),
  _llMk("llh2", "Deadcrow", "Bass", 2, "crater", 2),
  _llMk("llh3", "Dirt Monkey", "Dubstep", 2, "crater", 2),
  _llMk("llh4", "Funtcase", "Dubstep", 2, "crater", 2),
  _llMk("llh5", "Machaki", "Bass", 2, "crater", 2),
  _llMk("llh6", "MEGA B2B2B2B2B PRE-PARTY", "Bass", 3, "crater", 2),
  _llMk("llh7", "Mindset", "Bass", 2, "crater", 2),
  _llMk("llh8", "Phrva", "Bass", 2, "crater", 2),
  _llMk("llh9", "Rsun", "Bass", 2, "crater", 2),
  _llMk("llh10", "RZRKT", "Bass", 2, "crater", 2),
  _llMk("llh11", "Super Future", "Space Bass", 2, "crater", 2),
  // ── FRIDAY (day 3) ──
  _llMk("llf1", "$J", "Bass", 1, "subsidia", 3),
  _llMk("llf2", "Austeria", "Bass", 1, "subsidia", 3),
  _llMk("llf3", "Badklaat", "Bass", 1, "subsidia", 3),
  _llMk("llf4", "Basstripper", "Bass", 1, "subsidia", 3),
  _llMk("llf5", "Bear Grillz", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf6", "Benda", "Bass", 1, "subsidia", 3),
  _llMk("llf7", "Borgore", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf8", "Canabliss", "Bass", 1, "subsidia", 3),
  _llMk("llf9", "Casey Club", "Bass", 1, "subsidia", 3),
  _llMk("llf10", "Crizzly", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf11", "Dion Timmer", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf12", "Dirtysnatcha", "Bass", 1, "subsidia", 3),
  _llMk("llf13", "Doctor P", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf14", "Dodge & Fuski", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf15", "Dr. Ushuu", "Bass", 1, "subsidia", 3),
  _llMk("llf16", "Drinkurwater", "Bass", 1, "subsidia", 3),
  _llMk("llf17", "Dubscribe", "Bass", 1, "subsidia", 3),
  _llMk("llf18", "Future Exit", "Bass", 1, "subsidia", 3),
  _llMk("llf19", "HOL!", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf20", "Infekt B2B Samplifire", "Riddim", 2, "wompy-woods", 3),
  _llMk("llf21", "Ivy Lab", "Drum & Bass", 2, "wompy-woods", 3),
  _llMk("llf22", "Izadi", "Bass", 1, "subsidia", 3),
  _llMk("llf23", "Jantsen", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf24", "Jkyl & Hyde", "Bass", 1, "subsidia", 3),
  _llMk("llf25", "Kliptic", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf26", "Klo", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf27", "Lazrus", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf28", "Levity", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf29", "Liquid Stranger", "Space Bass", 2, "wompy-woods", 3),
  _llMk("llf30", "Lumasi", "Bass", 1, "subsidia", 3),
  _llMk("llf31", "Neumonic", "Bass", 2, "wompy-woods", 3),
  _llMk("llf32", "Nghtmre", "Trap / Future Bass", 3, "prehistoric", 3),
  _llMk("llf33", "Nimda", "Bass", 1, "subsidia", 3),
  _llMk("llf34", "Oliverse", "Bass", 1, "subsidia", 3),
  _llMk("llf35", "Paper Skies", "Melodic Bass", 2, "wompy-woods", 3),
  _llMk("llf36", "Pegboard Nerds", "Electro / Dubstep", 2, "wompy-woods", 3),
  _llMk("llf37", "Poni", "Bass", 1, "subsidia", 3),
  _llMk("llf38", "Probcause", "Bass", 1, "subsidia", 3),
  _llMk("llf39", "Ravenscoon", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf40", "Reaper", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf41", "Richard Finger", "Bass", 1, "subsidia", 3),
  _llMk("llf42", "Riot", "Drum & Bass", 2, "wompy-woods", 3),
  _llMk("llf43", "Seth David", "Bass", 1, "subsidia", 3),
  _llMk("llf44", "Shlump", "Space Bass", 2, "wompy-woods", 3),
  _llMk("llf45", "Sigma", "Drum & Bass", 2, "wompy-woods", 3),
  _llMk("llf46", "Sippy", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf47", "Subsonic", "Bass", 1, "subsidia", 3),
  _llMk("llf48", "Sullivan King B2B Ray Volpe", "Rocktronic / Riddim", 3, "prehistoric", 3),
  _llMk("llf49", "The Resistance", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf50", "The Widdler", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf51", "Twopercent", "Bass", 1, "subsidia", 3),
  _llMk("llf52", "TYNAN", "Bass", 1, "subsidia", 3),
  _llMk("llf53", "Vampa", "Dubstep", 2, "wompy-woods", 3),
  _llMk("llf54", "VKTM", "Bass", 1, "subsidia", 3),
  _llMk("llf55", "Wiley", "Space Bass", 2, "wompy-woods", 3),
  _llMk("llf56", "Wooli", "Dubstep / Melodic Bass", 3, "prehistoric", 3),
  _llMk("llf57", "Xotix", "Bass", 1, "subsidia", 3),
  _llMk("llf58", "YOOKIE", "Dubstep / Hybrid", 2, "wompy-woods", 3),
  _llMk("llf59", "Zero", "Bass", 1, "subsidia", 3),
  // ── SATURDAY (day 4) ──
  _llMk("lls1", "2DY4", "Bass", 1, "subsidia", 4),
  _llMk("lls2", "AEON:MODE", "Bass", 1, "subsidia", 4),
  _llMk("lls3", "All The Reason", "Bass", 1, "subsidia", 4),
  _llMk("lls4", "Au5", "Melodic Dubstep", 2, "wompy-woods", 4),
  _llMk("lls5", "Audiofreq", "Bass", 1, "subsidia", 4),
  _llMk("lls6", "Bella Renee", "Bass", 1, "subsidia", 4),
  _llMk("lls7", "Big Florida", "Bass", 1, "subsidia", 4),
  _llMk("lls8", "Bou", "Drum & Bass", 2, "wompy-woods", 4),
  _llMk("lls9", "Brainrack", "Bass", 1, "subsidia", 4),
  _llMk("lls10", "Capochino", "Bass", 1, "subsidia", 4),
  _llMk("lls11", "Chozen", "Bass", 1, "subsidia", 4),
  _llMk("lls12", "Craze", "Bass", 1, "subsidia", 4),
  _llMk("lls13", "Craze B2B Dieselboy", "Bass", 1, "subsidia", 4),
  _llMk("lls14", "Crumb Pit", "Riddim", 2, "wompy-woods", 4),
  _llMk("lls15", "Cyclops", "Bass", 1, "subsidia", 4),
  _llMk("lls16", "Darksiderz B2B Madgrrl", "Bass", 1, "subsidia", 4),
  _llMk("lls17", "Delta Heavy", "Drum & Bass", 2, "wompy-woods", 4),
  _llMk("lls18", "Dirtyphonics", "Drum & Bass", 2, "wompy-woods", 4),
  _llMk("lls19", "Dr. Fresch", "Bass House", 3, "prehistoric", 4),
  _llMk("lls20", "Effin", "Bass", 1, "subsidia", 4),
  _llMk("lls21", "Flosstradamus", "Trap", 3, "prehistoric", 4),
  _llMk("lls22", "Flux Pavilion", "Dubstep", 3, "prehistoric", 4),
  _llMk("lls23", "Ganja White Night", "Dubstep", 3, "prehistoric", 4),
  _llMk("lls24", "GHENGAR", "Dubstep", 2, "wompy-woods", 4),
  _llMk("lls25", "Gladde Paling", "Bass", 1, "subsidia", 4),
  _llMk("lls26", "Green Matter", "Bass", 1, "subsidia", 4),
  _llMk("lls27", "Hedex", "D&B / Jump-Up", 2, "wompy-woods", 4),
  _llMk("lls28", "Heyz", "Dubstep / House", 2, "wompy-woods", 4),
  _llMk("lls29", "HVDES", "Bass", 1, "subsidia", 4),
  _llMk("lls30", "Illenium", "Melodic Bass", 3, "prehistoric", 4),
  _llMk("lls31", "Imanu", "Drum & Bass", 2, "wompy-woods", 4),
  _llMk("lls32", "Ivory", "Dubstep", 2, "wompy-woods", 4),
  _llMk("lls33", "Jessica Audiffred", "Dubstep", 3, "prehistoric", 4),
  _llMk("lls34", "Josh Teed", "Bass", 1, "subsidia", 4),
  _llMk("lls35", "Kai Wachi", "Dubstep", 3, "prehistoric", 4),
  _llMk("lls36", "Layz", "Dubstep", 2, "wompy-woods", 4),
  _llMk("lls37", "Leotrix", "Future Riddim", 2, "wompy-woods", 4),
  _llMk("lls38", "Lil Texas", "Bass", 1, "subsidia", 4),
  _llMk("lls39", "Lowcation", "Bass", 1, "subsidia", 4),
  _llMk("lls40", "Mefjus", "Drum & Bass", 2, "wompy-woods", 4),
  _llMk("lls41", "Mozey", "Drum & Bass", 2, "wompy-woods", 4),
  _llMk("lls42", "Myrias", "Bass", 1, "subsidia", 4),
  _llMk("lls43", "Mythm", "Bass", 1, "subsidia", 4),
  _llMk("lls44", "Neotek", "Bass", 1, "subsidia", 4),
  _llMk("lls45", "Noetika", "Bass", 1, "subsidia", 4),
  _llMk("lls46", "Phaseone", "Metalstep", 2, "wompy-woods", 4),
  _llMk("lls47", "Prosecute", "Dubstep", 2, "wompy-woods", 4),
  _llMk("lls48", "Saint Miller", "Bass", 2, "wompy-woods", 4),
  _llMk("lls49", "Seven Lions", "Melodic Bass", 3, "prehistoric", 4),
  _llMk("lls50", "Slander", "Melodic Bass", 3, "prehistoric", 4),
  _llMk("lls51", "Space Wizard", "Bass", 1, "subsidia", 4),
  _llMk("lls52", "Stoned Level", "Bass", 1, "subsidia", 4),
  _llMk("lls53", "Subtronics B2B Level Up", "Riddim / Dubstep", 3, "prehistoric", 4),
  _llMk("lls54", "Tisoki", "Dubstep", 2, "wompy-woods", 4),
  _llMk("lls55", "Tokyo Machine", "Electro House", 3, "prehistoric", 4),
  _llMk("lls56", "Truth", "Deep Dubstep", 2, "wompy-woods", 4),
  _llMk("lls57", "Whales", "Bass", 1, "subsidia", 4),
  _llMk("lls58", "Whethan", "Future Bass", 3, "prehistoric", 4),
  _llMk("lls59", "Wraz", "Bass", 1, "subsidia", 4),
  _llMk("lls60", "Zingara", "Bass", 1, "subsidia", 4),
  _llMk("lls61", "Zomboy", "Dubstep", 3, "prehistoric", 4),
  // ── SUNDAY (day 5) ──
  _llMk("llu1", "Adventure Club", "Melodic Dubstep", 2, "wompy-woods", 5),
  _llMk("llu2", "Alleycvt B2B Crankdat", "Bass", 1, "subsidia", 5),
  _llMk("llu3", "Arlo", "Bass", 2, "wompy-woods", 5),
  _llMk("llu4", "Armnhmr", "Melodic Bass", 2, "wompy-woods", 5),
  _llMk("llu5", "Atliens", "Bass", 2, "wompy-woods", 5),
  _llMk("llu6", "Avello", "Bass", 1, "subsidia", 5),
  _llMk("llu7", "Boogie T", "Bass", 1, "subsidia", 5),
  _llMk("llu8", "Champagne Drip", "Space Bass", 2, "wompy-woods", 5),
  _llMk("llu9", "Codd Dubz", "Bass", 1, "subsidia", 5),
  _llMk("llu10", "Crystal Skies", "Melodic Dubstep", 2, "wompy-woods", 5),
  _llMk("llu11", "Distant Matter", "Bass", 1, "subsidia", 5),
  _llMk("llu12", "Dream Takers", "Bass", 1, "subsidia", 5),
  _llMk("llu13", "Eptic", "Dubstep", 3, "prehistoric", 5),
  _llMk("llu14", "Excision", "Dubstep", 3, "prehistoric", 5),
  _llMk("llu15", "Excision B2B Space Laces", "Dubstep", 3, "prehistoric", 5),
  _llMk("llu16", "FINNUH", "Bass", 1, "subsidia", 5),
  _llMk("llu17", "Ghastly", "Bass", 2, "wompy-woods", 5),
  _llMk("llu18", "Grabbitz", "Electronic / Rock", 3, "prehistoric", 5),
  _llMk("llu19", "Haliene", "Melodic Bass", 2, "wompy-woods", 5),
  _llMk("llu20", "Hostage Situation", "Bass", 2, "wompy-woods", 5),
  _llMk("llu21", "Hurtbox", "Riddim", 2, "wompy-woods", 5),
  _llMk("llu22", "Killmatter", "Bass", 1, "subsidia", 5),
  _llMk("llu23", "Know Good", "Bass", 1, "subsidia", 5),
  _llMk("llu24", "Kompany", "Dubstep", 3, "prehistoric", 5),
  _llMk("llu25", "Krewella", "Electro / Bass", 3, "prehistoric", 5),
  _llMk("llu26", "Luci", "Pop / Electronic", 2, "wompy-woods", 5),
  _llMk("llu27", "Mad Dubz", "Bass", 1, "subsidia", 5),
  _llMk("llu28", "Modal Nodes", "Bass", 1, "subsidia", 5),
  _llMk("llu29", "OG NIXIN", "Bass", 1, "subsidia", 5),
  _llMk("llu30", "Onara", "Bass", 1, "subsidia", 5),
  _llMk("llu31", "Passport", "Bass", 1, "subsidia", 5),
  _llMk("llu32", "Pretty Sweet", "Bass", 1, "subsidia", 5),
  _llMk("llu33", "Remk", "Bass", 1, "subsidia", 5),
  _llMk("llu34", "ROI*", "Bass", 1, "subsidia", 5),
  _llMk("llu35", "Ryns", "Bass", 1, "subsidia", 5),
  _llMk("llu36", "Sisto", "House", 2, "wompy-woods", 5),
  _llMk("llu37", "Skilah", "Bass", 1, "subsidia", 5),
  _llMk("llu38", "Sodown", "Bass", 1, "subsidia", 5),
  _llMk("llu39", "Sportmode", "House", 2, "wompy-woods", 5),
  _llMk("llu40", "SQISHI", "Bass", 1, "subsidia", 5),
  _llMk("llu41", "Stumpi", "Bass", 1, "subsidia", 5),
  _llMk("llu42", "Taiki Nulight", "Bass House", 2, "wompy-woods", 5),
  _llMk("llu43", "Trivecta", "Melodic Bass", 2, "wompy-woods", 5),
  _llMk("llu44", "Usaybflow", "Riddim", 2, "wompy-woods", 5),
  _llMk("llu45", "Virtual Riot", "Dubstep", 3, "prehistoric", 5),
  _llMk("llu46", "Warlord", "Bass", 1, "subsidia", 5),
  _llMk("llu47", "Wax Motif", "Bass House", 2, "wompy-woods", 5),
  _llMk("llu48", "William Black", "Melodic Bass", 2, "wompy-woods", 5),
  _llMk("llu49", "Wonkywilla", "Dubstep", 2, "wompy-woods", 5),
  _llMk("llu50", "Yetep", "Melodic Bass", 2, "wompy-woods", 5),
  _llMk("llu51", "YVM3", "Dubstep", 2, "wompy-woods", 5),
  _llMk("llu52", "Zoey808", "Bass", 1, "subsidia", 5),
];

const LL_AMENITIES = [
  { id: "lla1", type: "water", label: "Free Water", x: 40, y: 35 },
  { id: "lla2", type: "water", label: "Free Water", x: 62, y: 58 },
  { id: "lla3", type: "food", label: "Food Vendors", x: 48, y: 30 },
  { id: "lla4", type: "med", label: "Nest (Medical)", x: 52, y: 55 },
  { id: "lla5", type: "info", label: "Info & Lost+Found", x: 42, y: 78 },
  { id: "lla6", type: "toilet", label: "Restrooms", x: 30, y: 40 },
  { id: "lla7", type: "toilet", label: "Restrooms", x: 68, y: 48 },
  { id: "lla8", type: "info", label: "Lockers", x: 36, y: 52 },
];

const _regConfig = (id) => FESTIVALS_REGISTRY.find(f => f.config.id === id).config;
const _DATA_SETS = {
  "edc-lv-2026":          { stages: STAGES,     artists: ARTISTS,     amenities: AMENITIES,     config: FESTIVAL_CONFIG },
  "acl-2026":             { stages: ACL_STAGES, artists: ACL_ARTISTS, amenities: ACL_AMENITIES, config: _regConfig("acl-2026") },
  "lost-lands-2026":      { stages: LL_STAGES,  artists: LL_ARTISTS,  amenities: LL_AMENITIES,  config: _regConfig("lost-lands-2026") },
  "edc-orlando-2026":     { stages: EDCO_STAGES, artists: EDCO_ARTISTS, amenities: EDCO_AMENITIES, config: _regConfig("edc-orlando-2026") },
};
const _activeId = getActiveFestivalId();
const _active = _DATA_SETS[_activeId] || _DATA_SETS["edc-lv-2026"];

Object.assign(window, {
  FESTIVAL: _active.config, FESTIVAL_CONFIG: _active.config,
  STAGES: _active.stages, AMENITIES: _active.amenities, AVATAR_START, FRIENDS, ARTISTS: _active.artists,
  // DAYS must follow the ACTIVE festival (Forest runs 4 days Thu–Sun;
  // EDC/ACL run 3 Fri–Sun). The top-level DAYS const was derived from the
  // EDC config at eval time and showed EDC dates on ACL — re-derive here.
  DAYS: _daysFor(_active.config),
  NOW, ALERTS, ESSENTIALS, fmt12,
  FESTIVALS_REGISTRY, getActiveFestivalId, setActiveFestivalAndReload,
  _DATA_SETS,
});

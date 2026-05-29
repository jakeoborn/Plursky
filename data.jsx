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
    { stageId: "kinetic", lat: 36.27512, lng: -115.0118 },
    { stageId: "cosmic",  lat: 36.27370, lng: -115.0148 },
    { stageId: "basspod", lat: 36.27075, lng: -115.0123 },
    // Derived from the SVG layout via the kinetic/cosmic/basspod affine
    { stageId: "quantum", lat: 36.27433, lng: -115.0103 },
    { stageId: "bionic",  lat: 36.27544, lng: -115.0139 },
    { stageId: "stereo",  lat: 36.27404, lng: -115.0129 },
    { stageId: "neon",    lat: 36.27226, lng: -115.0096 },
    { stageId: "waste",   lat: 36.27179, lng: -115.0137 },
    { stageId: "circuit", lat: 36.27088, lng: -115.0107 },
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
    config: {
      id:        "edc-orlando-2026",
      name:      "EDC Orlando 2026",
      shortName: "EDC Orlando",
      brand:     "EDC",
      tagline:   "Three nights under the kinetic sky",
      location:  "Tinker Field · Orlando",
      dates:     "Nov 13–15, 2026",
      year:      2026,
    },
    available: false,
    accent:    "#22c55e",
    emoji:     "🌴",
    region:    "North America",
  },
  {
    config: {
      id:        "tomorrowland-2026",
      name:      "Tomorrowland 2026",
      shortName: "Tomorrowland",
      brand:     "Tomorrowland",
      tagline:   "We are one",
      location:  "De Schorre · Boom, Belgium",
      dates:     "Jul 17–26, 2026",
      year:      2026,
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
        // Derived from the SVG layout via the amex/miller/beatbox affine
        { stageId: "honda",    lat: 30.26411, lng: -97.77434 },
        { stageId: "titos",    lat: 30.26484, lng: -97.76916 },
        { stageId: "tmobile",  lat: 30.26230, lng: -97.77500 },
        { stageId: "ladybird", lat: 30.26303, lng: -97.77098 },
        { stageId: "bmi",      lat: 30.26266, lng: -97.77315 },
        { stageId: "barton",   lat: 30.26118, lng: -97.77123 },
        { stageId: "bonus",    lat: 30.26199, lng: -97.76954 },
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

const DAYS = Object.entries(FESTIVAL_CONFIG.dayDates).map(([n, d]) => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return { n: +n, label: d.short, date: `${months[d.m]} ${d.d}` };
});

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
// When the active festival changes, STAGES / ARTISTS / AMENITIES
// resolve to the right data set. The rest of the app reads from
// window.STAGES etc. and doesn't care which festival is active.
const _activeId = getActiveFestivalId();
const _isACL = _activeId === "acl-2026";
const _STAGES    = _isACL ? ACL_STAGES    : STAGES;
const _ARTISTS   = _isACL ? ACL_ARTISTS   : ARTISTS;
const _AMENITIES = _isACL ? ACL_AMENITIES : AMENITIES;
const _FESTIVAL_CONFIG = _isACL
  ? FESTIVALS_REGISTRY.find(f => f.config.id === "acl-2026").config
  : FESTIVAL_CONFIG;

Object.assign(window, {
  FESTIVAL: _FESTIVAL_CONFIG, FESTIVAL_CONFIG: _FESTIVAL_CONFIG,
  STAGES: _STAGES, AMENITIES: _AMENITIES, AVATAR_START, FRIENDS, ARTISTS: _ARTISTS,
  DAYS, NOW, ALERTS, ESSENTIALS, fmt12,
  FESTIVALS_REGISTRY, getActiveFestivalId, setActiveFestivalAndReload,
});

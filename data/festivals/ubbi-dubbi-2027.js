// ═══════════════════════════════════════════════════════════════════════
// UBBI DUBBI 2027 — Panther Island Pavilion · Fort Worth, TX
// Fri Apr 23 – Sat Apr 24, 2027. Disco Presents.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names are official. Days, stages, set times, a
// 2027 map and sun times are NOT published, and none are invented below.
// This was a gated preview in data.jsx (added 2026-11-11).
//
// ── SOURCE (observed 2026-11-23) ──
// ubbidubbifestival.com/lineup/ carries the 2027 lineup only as the official
// poster image:
//   https://2027-ubbidubbifestival-com.imgix.net/2026/11/23e66014-ub-2027-lineup3_1080x1080-b.png
// The poster lists the billings alphabetically with no day split, so every
// row has day: null (the Coachella 2027 day-null convention).
// Read at 2x, then again at 3x. 42 billings are legible and loaded.
// LEFT OUT: one slot after "BEASTBOI." is blurred on the poster (a
// coming-soon tease); it is not read and not loaded.
// ECCHI.MP4: the final glyph was settled as "4" by comparing it with the
// poster's own Y glyphs, which it does not match; the registry also holds
// "ECCHI.MP4".
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: one row per printed billing. The poster prints all caps, so a
//     name the artist registry already holds takes the registry's casing;
//     a name the registry does not hold stays as printed. Every re-cased
//     row carries its printed form in a comment. "(SUNSET SET)" is kept as
//     the set tag "(Sunset Set)". "B2B" and parentheses never split a billing.
//   - id: "ud27-" + the registry key (foldKey) of the billing. No billing
//     repeats.
//
// ── DATES ──
// ubbidubbifestival.com (read 2026-11-11): "join us April 23 & 24 at Panther
// Island Pavilion in Ft. Worth". Fort Worth is on CDT (UTC-5) on those dates.
// ── VENUE ──
// gps: OpenStreetMap way 496992023 "Panther Island Pavilion", via Nominatim
// 2026-11-23: 32.7554040, -97.3424762. A 1-mile on-site radius covers it.
(function () {
  "use strict";

  const CDT = -5;
  const STAGES = [];
  const AMENITIES = [];
  const mk = (id, name) => ({
    id, name, genre: "—", country: "—",
    stage: null, day: null, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #f472b6, #3b0a24)",
    bio: "Playing Ubbi Dubbi 2027, April 23–24 in Fort Worth. " +
         "Day, stage and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("ud27-3ballmty-sunset-set", "3BALLMTY (Sunset Set)"),  // printed "3BALLMTY (SUNSET SET)"
    mk("ud27-acraze", "Acraze"),  // printed "ACRAZE"
    mk("ud27-adventure-club-sunset-set", "Adventure Club (Sunset Set)"),  // printed "ADVENTURE CLUB (SUNSET SET)"
    mk("ud27-beastboi", "BEASTBOI."),
    mk("ud27-bradeazy", "Bradeazy"),  // printed "BRADEAZY"
    mk("ud27-bryce-alakai", "BRYCE ALAKAI"),
    mk("ud27-deorro", "Deorro"),  // printed "DEORRO"
    mk("ud27-dimension", "Dimension"),  // printed "DIMENSION"
    mk("ud27-distant-matter", "Distant Matter"),  // printed "DISTANT MATTER"
    mk("ud27-ecchi-mp4", "ECCHI.MP4"),
    mk("ud27-elmefti", "ELMEFTI"),
    mk("ud27-flozone-b2b-stvsh", "FLOZONE B2B STVSH"),
    mk("ud27-flux-pavilion", "Flux Pavilion"),  // printed "FLUX PAVILION"
    mk("ud27-galantis", "Galantis"),  // printed "GALANTIS"
    mk("ud27-holy-priest", "Holy Priest"),  // printed "HOLY PRIEST"
    mk("ud27-illenium", "Illenium"),  // printed "ILLENIUM"
    mk("ud27-jackie-hollander", "Jackie Hollander"),  // printed "JACKIE HOLLANDER"
    mk("ud27-jay-pryor", "JAY PRYOR"),
    mk("ud27-jessica-audiffred", "Jessica Audiffred"),  // printed "JESSICA AUDIFFRED"
    mk("ud27-josh-fawaz", "JOSH FAWAZ"),
    mk("ud27-juos-b2b-rommii", "Juos B2B Rommii"),  // printed "JUOS B2B ROMMII"
    mk("ud27-kaleena-zanders", "Kaleena Zanders"),  // printed "KALEENA ZANDERS"
    mk("ud27-laszewo-sunset-set", "Laszewo (Sunset Set)"),  // printed "ŁASZEWO (SUNSET SET)"
    mk("ud27-lavern", "Lavern"),  // printed "LAVERN"
    mk("ud27-lilly-palmer", "Lilly Palmer"),  // printed "LILLY PALMER"
    mk("ud27-luca-agnelli", "LUCA AGNELLI"),
    mk("ud27-luciana", "LUCIANA"),
    mk("ud27-mariana-bo", "Mariana Bo"),  // printed "MARIANA BO"
    mk("ud27-mk-marc-kinchen", "MK (MARC KINCHEN)"),
    mk("ud27-nate-band", "NATE BAND"),
    mk("ud27-nghtmre", "Nghtmre"),  // printed "NGHTMRE"
    mk("ud27-nic-vans", "NIC VANS"),
    mk("ud27-panteros666-b2b-pawlowski", "Panteros666 B2B PAWLOWSKI"),  // printed "PANTEROS666 B2B PAWLOWSKI"
    mk("ud27-rad-cat", "Rad Cat"),  // printed "RAD CAT"
    mk("ud27-richard-finger", "Richard Finger"),  // printed "RICHARD FINGER"
    mk("ud27-steve-aoki", "Steve Aoki"),  // printed "STEVE AOKI"
    mk("ud27-sullivan-king-sunset-set", "Sullivan King (Sunset Set)"),  // printed "SULLIVAN KING (SUNSET SET)"
    mk("ud27-tvboo", "TVBOO"),
    mk("ud27-wankdat-crankdat-b2b-wooli", "Wankdat (Crankdat B2B Wooli)"),  // printed "WANKDAT (CRANKDAT B2B WOOLI)"
    mk("ud27-welker", "WELKER"),
    mk("ud27-zen-selekta", "Zen Selekta"),  // printed "ZEN SELEKTA"
    mk("ud27-zorza", "Zorza"),  // printed "ZORZA"
  ];

  const day = (d, name, short) => ({ y: 2027, m: 3, d, name, short, midnightUtc: Date.UTC(2027, 3, d, -CDT, 0, 0) });
  const CONFIG = {
    id: "ubbi-dubbi-2027",
    lineupSource: { url: "https://ubbidubbifestival.com/lineup/", observedAt: "2026-11-23", official: true },
    officialEvent: { website: "https://ubbidubbifestival.com/", observedAt: "2026-11-11" },
    name: "Ubbi Dubbi 2027",
    shortName: "Ubbi Dubbi",
    brand: "Ubbi Dubbi",
    tagline: "Two days of house and bass in Fort Worth",
    location: "Panther Island Pavilion · Fort Worth, TX",
    locationShort: "Panther Island Pavilion",
    dates: "Apr 23–24, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://ubbidubbifestival.com/", observedAt: "2026-11-11" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    startMs: Date.UTC(2027, 3, 23, -CDT, 0, 0),    // Fri Apr 23 00:00 local
    endMs: Date.UTC(2027, 3, 25, 6 - CDT, 0, 0),   // Sun Apr 25 06:00 local, a bound
    tz: "America/Chicago",
    tzAbbr: "CDT",
    utcOffsetHours: CDT,
    dayDates: {
      1: day(23, "Friday", "FRI"),
      2: day(24, "Saturday", "SAT"),
    },
    gps: { lat: 32.7554040, lng: -97.3424762, onSiteRadiusMi: 1 },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["ubbi-dubbi-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#f472b6", emoji: "🍭", region: "North America" },
  };
})();

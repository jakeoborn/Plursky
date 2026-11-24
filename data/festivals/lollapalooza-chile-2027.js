// ═══════════════════════════════════════════════════════════════════════
// LOLLAPALOOZA CHILE 2027 — Parque O'Higgins · Santiago, Chile
// Fri Mar 12 – Sun Mar 14, 2027
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names and their days are official; stages, set
// times, a 2027 map and sun times are NOT published and none are invented
// below. Was a gated preview in data.jsx (added 2026-11-15).
//
// ── SOURCE (observed 2026-11-23) ──
// The official per-day poster on lollapaloozacl.com,
// wp-content/uploads/LOTUS-LollaCL2027_LineUp-Diario_3nov-1080x1440-01.jpg
// (uploaded 2026-11-03, the newest lineup image in the site's media library).
// The site prints no names in text: the homepage, the "Anuncio Lolla 2027"
// page and the WordPress search API carry none, and the image has no alt
// text. The poster heads "12★13★14 MARZO | PARQUE O'HIGGINS | SCL 2027" and
// prints three day blocks, "VIERNES", "SÁBADO" and "DOMINGO", each name
// separated by a dash (headliners by a bolt). Transcribed from the full-size
// image, every row re-read at 2x zoom.
// Counts: the poster prints 86 billings (30/27/29), 84 distinct names. 85
// are loaded here (30/26/29), 83 distinct.
// UNRESOLVED, LEFT OUT: one Saturday act prints as "K4OS", where the typeface
// does not tell a zero from the letter O (the poster sets no zero in that
// face to compare). No official text source spells it, so it is not loaded
// until one does. Third-party listings are not used to settle it (the
// Lollapalooza Brasil 2027 "KENYA2?HZ" rule).
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: one row per printed billing. "&" and " Y " never split
//     ("GONDWANA & QUIQUE NEIRA", "CATALINA Y LAS BORDONAS DE ORO" and
//     "ALICIA Y LAS HORMIGAS" are one act each).
//   - NAME CASING: the poster prints every name in capitals. A name is
//     written the way the artist registry already spells it (41), else as
//     printed (42). Rows whose casing differs from the poster note the
//     printed form (the Time Warp 2027 convention).
//   - day: the day block the name is printed in.
//   - id: "lcl27-" + the registry key of the printed name. "ROOTZ HIFI" is
//     printed on all three days, so its rows carry a -d<day> suffix (the
//     Tomorrowland Thailand convention).
//
// ── DATES ──
// Santiago (America/Santiago) is on UTC-3 from Mar 12 through Mar 15, 2027:
// the tz database ends daylight time on Sat Apr 3, 2027 (read with zdump,
// 2026-11-23). startMs is Fri Mar 12 00:00 local. endMs is Mon Mar 15 06:00
// local: a bound that keeps the last night inside the window, NOT a published
// closing time.
// GPS: the park's point, NOT a stage — es.wikipedia.org/wiki/Parque_O'Higgins
// (API coordinates, read 2026-11-23; Wikidata Q7071826 agrees): -33.46417,
// -70.66.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
(function () {
  "use strict";
  const STAGES = [];
  const AMENITIES = [];
  const CLST = -3;
  const mk = (id, name, day) => ({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #ef4444, #0b1020)",
    bio: "Playing Lollapalooza Chile 2027 at Parque O'Higgins. Stage and set time are not published yet.",
    provisional: true,
  });
  const ARTISTS = [
    mk("lcl27-charli-xcx", "Charli XCX", 1),  // printed "CHARLI XCX"
    mk("lcl27-david-guetta", "David Guetta", 1),  // printed "DAVID GUETTA"
    mk("lcl27-sombr", "sombr", 1),  // printed "SOMBR"
    mk("lcl27-dominic-fike", "Dominic Fike", 1),  // printed "DOMINIC FIKE"
    mk("lcl27-cage-the-elephant", "Cage The Elephant", 1),  // printed "CAGE THE ELEPHANT"
    mk("lcl27-lola-young", "Lola Young", 1),  // printed "LOLA YOUNG"
    mk("lcl27-tomora", "TOMORA", 1),
    mk("lcl27-leon-bridges", "Leon Bridges", 1),  // printed "LEON BRIDGES"
    mk("lcl27-gondwana-and-quique-neira", "GONDWANA & QUIQUE NEIRA", 1),
    mk("lcl27-ana-tijoux", "Ana Tijoux", 1),  // printed "ANA TIJOUX"
    mk("lcl27-snow-strippers", "Snow Strippers", 1),  // printed "SNOW STRIPPERS"
    mk("lcl27-yorghaki", "YORGHAKI", 1),
    mk("lcl27-ninajirachi", "Ninajirachi", 1),  // printed "NINAJIRACHI"
    mk("lcl27-amaia", "AMAIA", 1),
    mk("lcl27-sfdk", "SFDK", 1),
    mk("lcl27-leo-rey", "LEO REY", 1),
    mk("lcl27-boy-harsher", "Boy Harsher", 1),  // printed "BOY HARSHER"
    mk("lcl27-congreso", "CONGRESO", 1),
    mk("lcl27-dinamarca", "Dinamarca", 1),  // printed "DINAMARCA"
    mk("lcl27-violet-grohl", "Violet Grohl", 1),  // printed "VIOLET GROHL"
    mk("lcl27-hermanos-ilabaca", "HERMANOS ILABACA", 1),
    mk("lcl27-we-are-the-grand", "WE ARE THE GRAND", 1),
    mk("lcl27-lorna", "LORNA", 1),
    mk("lcl27-olivia-garcia", "OLIVIA GARCÍA", 1),
    mk("lcl27-white-mj", "WHITE MJ", 1),
    mk("lcl27-nando-garcia", "NANDO GARCÍA", 1),
    mk("lcl27-rootz-hifi-d1", "ROOTZ HIFI", 1),
    mk("lcl27-javiera-electra", "JAVIERA ELECTRA", 1),
    mk("lcl27-la-ramona", "LA RAMONA", 1),
    mk("lcl27-vibrational-echoes", "VIBRATIONAL ECHOES", 1),
    mk("lcl27-the-killers", "The Killers", 2),  // printed "THE KILLERS"
    mk("lcl27-the-neighbourhood", "The Neighbourhood", 2),  // printed "THE NEIGHBOURHOOD"
    mk("lcl27-fontaines-d-c", "FONTAINES D.C.", 2),
    mk("lcl27-the-prodigy", "The Prodigy", 2),  // printed "THE PRODIGY"
    mk("lcl27-malcolm-todd", "MALCOLM TODD", 2),
    mk("lcl27-raye", "RAYE", 2),
    mk("lcl27-adela", "Adéla", 2),  // printed "ADÉLA"
    mk("lcl27-marlon-hoffstadt", "Marlon Hoffstadt", 2),  // printed "MARLON HOFFSTADT"
    mk("lcl27-alex-anwandter", "ALEX ANWANDTER", 2),
    mk("lcl27-santaferia", "SANTAFERIA", 2),
    mk("lcl27-javiera-mena", "JAVIERA MENA", 2),
    mk("lcl27-lucky-brown", "LUCKY BROWN", 2),
    mk("lcl27-boys-noize", "Boys Noize", 2),  // printed "BOYS NOIZE"
    mk("lcl27-ela-taubert", "ELA TAUBERT", 2),
    mk("lcl27-santos-bravos", "SANTOS BRAVOS", 2),
    mk("lcl27-los-tetas", "LOS TETAS", 2),
    mk("lcl27-saramalacara", "SARAMALACARA", 2),
    mk("lcl27-natalia-lacunza", "NATALIA LACUNZA", 2),
    mk("lcl27-mind-enterprises", "Mind Enterprises", 2),  // printed "MIND ENTERPRISES"
    mk("lcl27-pascual-arroyo", "PASCUAL ARROYO", 2),
    mk("lcl27-kuina", "KUINA", 2),
    mk("lcl27-catalina-y-las-bordonas-de-oro", "CATALINA Y LAS BORDONAS DE ORO", 2),
    mk("lcl27-teodioteodio", "TEODIOTEODIO", 2),
    mk("lcl27-iza-tkm", "IZA TKM", 2),
    mk("lcl27-ryan", "RYAN", 2),
    mk("lcl27-rootz-hifi-d2", "ROOTZ HIFI", 2),
    mk("lcl27-travis-scott", "Travis Scott", 3),  // printed "TRAVIS SCOTT"
    mk("lcl27-queens-of-the-stone-age", "Queens of the Stone Age", 3),  // printed "QUEENS OF THE STONE AGE"
    mk("lcl27-rawayana", "Rawayana", 3),  // printed "RAWAYANA"
    mk("lcl27-geese", "Geese", 3),  // printed "GEESE"
    mk("lcl27-slayyyter", "Slayyyter", 3),  // printed "SLAYYYTER"
    mk("lcl27-four-tet", "Four Tet", 3),  // printed "FOUR TET"
    mk("lcl27-francisca-valenzuela", "Francisca Valenzuela", 3),  // printed "FRANCISCA VALENZUELA"
    mk("lcl27-angine-de-poitrine", "Angine De Poitrine", 3),  // printed "ANGINE DE POITRINE"
    mk("lcl27-cuarteto-de-nos", "CUARTETO DE NOS", 3),
    mk("lcl27-julia-wolf", "Julia Wolf", 3),  // printed "JULIA WOLF"
    mk("lcl27-sammy-virji", "Sammy Virji", 3),  // printed "SAMMY VIRJI"
    mk("lcl27-carlita", "Carlita", 3),  // printed "CARLITA"
    mk("lcl27-pedro-capo", "PEDRO CAPÓ", 3),
    mk("lcl27-princesa-alba", "PRINCESA ALBA", 3),
    mk("lcl27-midnight-generation", "Midnight Generation", 3),  // printed "MIDNIGHT GENERATION"
    mk("lcl27-alain-johannes-trio", "ALAIN JOHANNES TRÍO", 3),
    mk("lcl27-angela-torres", "ANGELA TORRES", 3),
    mk("lcl27-tiga", "Tiga", 3),  // printed "TIGA"
    mk("lcl27-die-spitz", "Die Spitz", 3),  // printed "DIE SPITZ"
    mk("lcl27-dj-raff", "DJ RAFF", 3),
    mk("lcl27-the-alive", "THE ALIVE!", 3),
    mk("lcl27-estoy-bien", "ESTOY BIEN", 3),
    mk("lcl27-estereo-fam", "ESTÉREO FAM", 3),
    mk("lcl27-javicrespo", "JAVICRESPO", 3),
    mk("lcl27-roce-de-mente", "ROCE DE MENTE", 3),
    mk("lcl27-valentino-merlo", "VALENTINO MERLO", 3),
    mk("lcl27-rootz-hifi-d3", "ROOTZ HIFI", 3),
    mk("lcl27-alicia-y-las-hormigas", "ALICIA Y LAS HORMIGAS", 3),
    mk("lcl27-yellow-fever", "YELLOW FEVER", 3),
  ];

  const day = (d, name, short) => ({ y: 2027, m: 2, d, name, short, midnightUtc: Date.UTC(2027, 2, d, -CLST, 0, 0) });
  const CONFIG = {
    id: "lollapalooza-chile-2027",
    lineupSource: { url: "https://lollapaloozacl.com/wp-content/uploads/LOTUS-LollaCL2027_LineUp-Diario_3nov-1080x1440-01.jpg", observedAt: "2026-11-23", official: true },
    officialEvent: { website: "https://www.lollapaloozacl.com/", tickets: "https://lollapaloozacl.com/precios/", observedAt: "2026-11-22" },
    name: "Lollapalooza Chile 2027",
    shortName: "Lolla Chile",
    brand: "Lollapalooza",
    tagline: "Three days of Lollapalooza in Santiago",
    location: "Parque O'Higgins · Santiago, Chile",
    locationShort: "Parque O'Higgins",
    dates: "Mar 12–14, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://www.lollapaloozacl.com/", observedAt: "2026-11-15" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    startMs: Date.UTC(2027, 2, 12, -CLST, 0, 0),    // Fri Mar 12 00:00 local
    endMs: Date.UTC(2027, 2, 15, 6 - CLST, 0, 0),   // Mon Mar 15 06:00 local, a bound
    tz: "America/Santiago",
    tzAbbr: "CLST",
    utcOffsetHours: CLST,
    dayDates: {
      1: day(12, "Friday", "FRI"),
      2: day(13, "Saturday", "SAT"),
      3: day(14, "Sunday", "SUN"),
    },
    gps: { lat: -33.46417, lng: -70.66, onSiteRadiusMi: 1 },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["lollapalooza-chile-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#ef4444", emoji: "🎪", region: "Latin America" },
  };
})();

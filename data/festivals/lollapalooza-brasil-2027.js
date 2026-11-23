// ═══════════════════════════════════════════════════════════════════════
// LOLLAPALOOZA BRASIL 2027 — Autódromo de Interlagos · São Paulo, Brazil
// Fri Mar 19 – Sun Mar 21, 2027
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names and their days are official; stages, set
// times, a 2027 map and sun times are NOT published and none are invented
// below. Was a gated preview in data.jsx (added 2026-11-15).
//
// ── SOURCE (observed 2026-11-22) ──
// The official poster on www.lollapaloozabr.com (the site's lineup is an
// image; its alt text names only nine acts). The poster heads "Março 19, 20
// e 21 de 2027 | Autódromo de Interlagos" and prints three day blocks,
// "SEX 19.MAR", "SÁB 20.MAR" and "DOM 21.MAR", each name separated by a dot.
// Transcribed from the full-size image, every row re-read at 2x zoom.
// Counts: the poster prints 74 billings, one day each (24/25/25). 73 are
// loaded here (24/25/24).
// UNRESOLVED, LEFT OUT: one Sunday act prints as "KENYA2?HZ", where the
// typeface does not tell a zero from the letter O. No official text source
// spells it, so it is not loaded until one does. Third-party listings are not
// used to settle it.
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: one row per printed billing. "&" and "," never split
//     ("CAROLA & CUROL", "CRIOLO, AMARO E DINO" are one act each).
//   - NAME CASING: the poster prints every name in capitals. A name is
//     written the way the artist registry already spells it from an earlier
//     festival (36), else as printed (37). Rows whose casing differs from the
//     poster note the printed form (the Time Warp 2027 convention).
//   - day: the day block the name is printed in.
//   - id: "lbr27-" + slug of the printed name.
//
// ── DATES ──
// São Paulo is on UTC-3 all year (no daylight saving since 2019). startMs is
// Fri Mar 19 00:00 local. endMs is Mon Mar 22 06:00 local: a bound that keeps
// the last night inside the window, NOT a published closing time.
// GPS: the circuit's point, NOT a stage — en.wikipedia.org/wiki/Interlagos_Circuit
// (API coordinates, read 2026-11-22): -23.70111, -46.69722.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
(function () {
  "use strict";
  const STAGES = [];
  const AMENITIES = [];
  const BRT = -3;
  const mk = (id, name, day) => ({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #22c55e, #0b1020)",
    bio: "Playing Lollapalooza Brasil 2027 at Interlagos. Stage and set time are not published yet.",
    provisional: true,
  });
  const ARTISTS = [
    mk("lbr27-travis-scott", "Travis Scott", 1),  // printed "TRAVIS SCOTT"
    mk("lbr27-david-guetta", "David Guetta", 1),  // printed "DAVID GUETTA"
    mk("lbr27-sombr", "sombr", 1),  // printed "SOMBR"
    mk("lbr27-cage-the-elephant", "Cage The Elephant", 1),  // printed "CAGE THE ELEPHANT"
    mk("lbr27-lola-young", "Lola Young", 1),  // printed "LOLA YOUNG"
    mk("lbr27-slayyyter", "Slayyyter", 1),  // printed "SLAYYYTER"
    mk("lbr27-tomora", "TOMORA", 1),
    mk("lbr27-leon-bridges", "Leon Bridges", 1),  // printed "LEON BRIDGES"
    mk("lbr27-angine-de-poitrine", "Angine De Poitrine", 1),  // printed "ANGINE DE POITRINE"
    mk("lbr27-snow-strippers", "Snow Strippers", 1),  // printed "SNOW STRIPPERS"
    mk("lbr27-ninajirachi", "Ninajirachi", 1),  // printed "NINAJIRACHI"
    mk("lbr27-die-spitz", "Die Spitz", 1),  // printed "DIE SPITZ"
    mk("lbr27-cat-dealers", "Cat Dealers", 1),  // printed "CAT DEALERS"
    mk("lbr27-nacao-zumbi", "NAÇÃO ZUMBI", 1),
    mk("lbr27-fezzo", "FEZZO", 1),
    mk("lbr27-majis", "MAJIS", 1),
    mk("lbr27-rawayana", "RAWAYANA", 1),
    mk("lbr27-carola-curol", "CAROLA & CUROL", 1),
    mk("lbr27-make-u-sweat", "MAKE U SWEAT", 1),
    mk("lbr27-marina-diniz", "MARINA DINIZ", 1),
    mk("lbr27-mary-olivetti", "MARY OLIVETTI", 1),
    mk("lbr27-el-efecto", "EL EFECTO", 1),
    mk("lbr27-rakta", "RAKTA", 1),
    mk("lbr27-deafkids", "DEAFKIDS", 1),
    mk("lbr27-the-killers", "The Killers", 2),  // printed "THE KILLERS"
    mk("lbr27-queens-of-the-stone-age", "Queens of the Stone Age", 2),  // printed "QUEENS OF THE STONE AGE"
    mk("lbr27-mochakk", "Mochakk", 2),  // printed "MOCHAKK"
    mk("lbr27-dominic-fike", "Dominic Fike", 2),  // printed "DOMINIC FIKE"
    mk("lbr27-geese", "Geese", 2),  // printed "GEESE"
    mk("lbr27-four-tet", "Four Tet", 2),  // printed "FOUR TET"
    mk("lbr27-rodrigo-amarante", "RODRIGO AMARANTE", 2),
    mk("lbr27-mike-d-5d", "Mike D 5D", 2),  // printed "MIKE D 5D"
    mk("lbr27-sammy-virji", "Sammy Virji", 2),  // printed "SAMMY VIRJI"
    mk("lbr27-julia-wolf", "Julia Wolf", 2),  // printed "JULIA WOLF"
    mk("lbr27-midnight-generation", "Midnight Generation", 2),  // printed "MIDNIGHT GENERATION"
    mk("lbr27-carlita", "Carlita", 2),  // printed "CARLITA"
    mk("lbr27-brime", "BRIME!!", 2),
    mk("lbr27-budang", "BUDANG", 2),
    mk("lbr27-santos-bravos", "SANTOS BRAVOS", 2),
    mk("lbr27-weird-baile", "WEIRD BAILE", 2),
    mk("lbr27-grag-queen", "GRAG QUEEN", 2),
    mk("lbr27-luana-flores", "LUANA FLORES", 2),
    mk("lbr27-buhr", "BUHR", 2),
    mk("lbr27-bebe", "BEBÉ", 2),
    mk("lbr27-zepelim-e-o-sopro-do-cao", "ZEPELIM E O SOPRO DO CÃO", 2),
    mk("lbr27-dj-ramemes", "DJ RAMEMES", 2),
    mk("lbr27-paira", "PAIRA", 2),
    mk("lbr27-joaquim", "JOAQUIM", 2),
    mk("lbr27-dj-tamy", "DJ TAMY", 2),
    mk("lbr27-charli-xcx", "Charli XCX", 3),  // printed "CHARLI XCX"
    mk("lbr27-the-neighbourhood", "The Neighbourhood", 3),  // printed "THE NEIGHBOURHOOD"
    mk("lbr27-fontaines-d-c", "FONTAINES D.C.", 3),
    mk("lbr27-the-prodigy", "The Prodigy", 3),  // printed "THE PRODIGY"
    mk("lbr27-malcolm-todd", "MALCOLM TODD", 3),
    mk("lbr27-raye", "RAYE", 3),
    mk("lbr27-adela", "Adéla", 3),  // printed "ADÉLA"
    mk("lbr27-marlon-hoffstadt", "Marlon Hoffstadt", 3),  // printed "MARLON HOFFSTADT"
    mk("lbr27-boys-noize", "Boys Noize", 3),  // printed "BOYS NOIZE"
    mk("lbr27-criolo-amaro-e-dino", "CRIOLO, AMARO E DINO", 3),
    mk("lbr27-the-avalanches", "The Avalanches", 3),  // printed "THE AVALANCHES"
    mk("lbr27-violet-grohl", "Violet Grohl", 3),  // printed "VIOLET GROHL"
    mk("lbr27-boy-harsher", "Boy Harsher", 3),  // printed "BOY HARSHER"
    mk("lbr27-mind-enterprises", "Mind Enterprises", 3),  // printed "MIND ENTERPRISES"
    mk("lbr27-clementaum", "CLEMENTAUM", 3),
    mk("lbr27-fernanda-martins", "FERNANDA MARTINS", 3),
    mk("lbr27-acid-asian", "ACID ASIAN", 3),
    mk("lbr27-catica", "CATÏÇA", 3),
    mk("lbr27-real-no-ficcion", "REAL NO FICCÍON", 3),
    mk("lbr27-nubia", "NÚBIA", 3),
    mk("lbr27-seu-pereira-e-coletivo-401", "SEU PEREIRA E COLETIVO 401", 3),
    mk("lbr27-psilosamples", "PSILOSAMPLES", 3),
    mk("lbr27-cica-moreira", "CIÇA MOREIRA", 3),
    mk("lbr27-clarissa", "CLARISSA", 3),
  ];

  const day = (d, name, short) => ({ y: 2027, m: 2, d, name, short, midnightUtc: Date.UTC(2027, 2, d, -BRT, 0, 0) });
  const CONFIG = {
    id: "lollapalooza-brasil-2027",
    lineupSource: { url: "https://www.lollapaloozabr.com/", observedAt: "2026-11-22", official: true },
    officialEvent: { website: "https://www.lollapaloozabr.com/", tickets: "https://www.lollapaloozabr.com/ingressos", observedAt: "2026-11-22" },
    name: "Lollapalooza Brasil 2027",
    shortName: "Lolla Brasil",
    brand: "Lollapalooza",
    tagline: "Three days of Lollapalooza in São Paulo",
    location: "Autódromo de Interlagos · São Paulo, Brazil",
    locationShort: "Autódromo de Interlagos",
    dates: "Mar 19–21, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://www.lollapaloozabr.com/", observedAt: "2026-11-15" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    startMs: Date.UTC(2027, 2, 19, -BRT, 0, 0),    // Fri Mar 19 00:00 local
    endMs: Date.UTC(2027, 2, 22, 6 - BRT, 0, 0),   // Mon Mar 22 06:00 local, a bound
    tz: "America/Sao_Paulo",
    tzAbbr: "BRT",
    utcOffsetHours: BRT,
    dayDates: {
      1: day(19, "Friday", "FRI"),
      2: day(20, "Saturday", "SAT"),
      3: day(21, "Sunday", "SUN"),
    },
    gps: { lat: -23.70111, lng: -46.69722, onSiteRadiusMi: 1 },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["lollapalooza-brasil-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#22c55e", emoji: "🎪", region: "Latin America" },
  };
})();

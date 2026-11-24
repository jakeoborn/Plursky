// ═══════════════════════════════════════════════════════════════════════
// EDC MEXICO 2027 — Autódromo Hermanos Rodríguez, Mexico City
// Fri Feb 19 – Sun Feb 21, 2027
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names and their days are official; stages, set
// times, a 2027 map and sun times are NOT published here and none are
// invented below. Was a gated preview in data.jsx.
//
// ── SOURCE (observed 2026-11-24) ──
// mexico.edc.com/en/lineup/ (and the Spanish mexico.edc.com/lineup/, same
// names). The page prints an A–Z list and then one list per day under the
// headings "Friday, February 19", "Saturday, February 20" and "Sunday,
// February 21"; its own date map reads Feb 19/20/21, 2027. The <title> still
// says "EDC Mexico 2026", a leftover: the names are the 2027 bill announced
// Nov 9, 2026 (Martin Garrix, Tiësto, FISHER, ILLENIUM headlining). Read
// twice (identical) and checked against the Spanish page (same set).
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: exactly as printed (mixed-case official text, the LIB rule), one
//     row per printed billing. "B2B" billings stay one act; "&" never splits.
//   - day: the day list the name is printed under.
//   - id: "edcmx27-" + slug. An act printed on more than one day gets a
//     -d<day> suffix on every row, so each row id is unique.
// Counts: 179 day appearances · 178 distinct billings · 1 billed on two days
// (Fatboy Slim, Sat + Sun) · per day 55/62/62. The A–Z list has the same
// 178 names, none extra and none missing.
// PRINTED AS-IS, RULED IN data/artists/overrides.json: "Lost Frequencie
// (Sunset Set)" (a misspelling of Lost Frequencies) and 'Secret Echoes
// "Live"' (the quoted word is the set tag). "The Shipping Dpartment" is left
// as printed: no other source names the act.
//
// No stage is loaded, so every act is stage:null until a stage/time source
// is read on its own.
//
// ── DATES ──
// Mexico City has no DST since 2022: UTC-6 all year. startMs is Fri Feb 19
// 00:00 local. endMs is Mon Feb 22 06:00 local: a bound that keeps the last
// night's after-midnight sets inside the window, NOT a published closing time.
// GPS: the circuit's point, NOT a stage — en.wikipedia.org/wiki/
// Autódromo_Hermanos_Rodríguez (API coordinates, read 2026-11-24):
// 19.40611111, -99.0925.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
(function () {
  "use strict";
  const STAGES = [];
  const AMENITIES = [];
  const CST = -6;
  const mk = (id, name, day) => ({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #f43f5e, #1e293b)",
    bio: "Playing EDC Mexico 2027 in Mexico City. Stage and set time are not published yet.",
    provisional: true,
  });
  const ARTISTS = [
    mk("edcmx27-3ballmty", "3BallMTY", 1),
    mk("edcmx27-aaron-hibell", "Aaron Hibell", 1),
    mk("edcmx27-aerea", "Aerea", 1),
    mk("edcmx27-all-matter-b2b-moisees", "All Matter B2B Moisees", 1),
    mk("edcmx27-alyssa-jolee", "Alyssa Jolee", 1),
    mk("edcmx27-blond-ish", "BLOND:ISH", 1),
    mk("edcmx27-bontan-b2b-yamagucci", "Bontan B2B Yamagucci", 1),
    mk("edcmx27-cabizbajo", "Cabizbajo", 1),
    mk("edcmx27-cassian", "Cassian", 1),
    mk("edcmx27-chile", "Chile", 1),
    mk("edcmx27-cinema-paradisco", "Cinema Paradisco", 1),
    mk("edcmx27-cloonee", "Cloonee", 1),
    mk("edcmx27-coone", "Coone", 1),
    mk("edcmx27-da-tweekaz", "Da Tweekaz", 1),
    mk("edcmx27-dash-berlin", "Dash Berlin", 1),
    mk("edcmx27-deadroom", "DEADROOM", 1),
    mk("edcmx27-deborah-de-luca-b2b-eli-brown", "Deborah De Luca B2B Eli Brown", 1),
    mk("edcmx27-dj-mir", "DJ Mir", 1),
    mk("edcmx27-dj-sash", "DJ Sash!", 1),
    mk("edcmx27-fisher", "Fisher", 1),
    mk("edcmx27-fuentes-prod", "Fuentes Prod", 1),
    mk("edcmx27-fux-beat", "Fux Beat", 1),
    mk("edcmx27-gryffin-b2b-odd-mob", "Gryffin B2B Odd Mob", 1),
    mk("edcmx27-hannah-laing", "Hannah Laing", 1),
    mk("edcmx27-hol", "HOL!", 1),
    mk("edcmx27-illenium", "Illenium", 1),
    mk("edcmx27-jay-ancor-b2b-the-shipping-dpartment", "Jay Ancor B2B The Shipping Dpartment", 1),
    mk("edcmx27-joa", "JOA", 1),
    mk("edcmx27-johannes-schuster", "Johannes Schuster", 1),
    mk("edcmx27-karina-rosee", "Karina Rosee", 1),
    mk("edcmx27-kayzo", "Kayzo", 1),
    mk("edcmx27-kettama", "KETTAMA", 1),
    mk("edcmx27-korolova", "Korolova", 1),
    mk("edcmx27-laidback-luke", "Laidback Luke", 1),
    mk("edcmx27-linska", "Linska", 1),
    mk("edcmx27-luch-b2b-rafael", "Luch B2B Rafael", 1),
    mk("edcmx27-mario-eighta", "Mario Eighta", 1),
    mk("edcmx27-marsh", "Marsh", 1),
    mk("edcmx27-martin-garrix", "Martin Garrix", 1),
    mk("edcmx27-murderith", "Murderith", 1),
    mk("edcmx27-nghtmre", "NGHTMRE", 1),
    mk("edcmx27-paula-martin", "Paula Martín", 1),
    mk("edcmx27-philou", "Philou", 1),
    mk("edcmx27-rafael", "Rafael", 1),
    mk("edcmx27-ray-volpe", "Ray Volpe", 1),
    mk("edcmx27-rayburger", "RayBurger", 1),
    mk("edcmx27-sant-jord", "Sant Jord", 1),
    mk("edcmx27-sasha-and-digweed", "Sasha & Digweed", 1),
    mk("edcmx27-secret-echoes-live", "Secret Echoes \"Live\"", 1),
    mk("edcmx27-silver-panda", "Silver Panda", 1),
    mk("edcmx27-surf-mesa", "Surf Mesa", 1),
    mk("edcmx27-svdden-death", "Svdden Death", 1),
    mk("edcmx27-tripolism", "Tripolism", 1),
    mk("edcmx27-volkoder", "Volkoder", 1),
    mk("edcmx27-vtss", "VTSS", 1),
    mk("edcmx27-alpha-9", "ALPHA 9", 2),
    mk("edcmx27-apashe", "Apashe", 2),
    mk("edcmx27-badwolf", "BadWolf", 2),
    mk("edcmx27-ben-ufo-b2b-four-tet", "Ben UFO B2B Four Tet", 2),
    mk("edcmx27-bipolar-sunshine", "Bipolar Sunshine", 2),
    mk("edcmx27-bolo", "BOLO", 2),
    mk("edcmx27-brennan-heart", "Brennan Heart", 2),
    mk("edcmx27-carlita", "Carlita", 2),
    mk("edcmx27-celice", "Celice", 2),
    mk("edcmx27-chloe-caillet-b2b-job-jobse", "Chloé Caillet B2B Job Jobse", 2),
    mk("edcmx27-colossio", "Colossio", 2),
    mk("edcmx27-devault", "Devault", 2),
    mk("edcmx27-dj-harvey", "DJ Harvey", 2),
    mk("edcmx27-dj-mami", "DJ MÄMI", 2),
    mk("edcmx27-dom-dolla", "Dom Dolla", 2),
    mk("edcmx27-domina", "DØMINA", 2),
    mk("edcmx27-dual-damage", "Dual Damage", 2),
    mk("edcmx27-elmefti", "elMefti", 2),
    mk("edcmx27-fatboy-slim-d2", "Fatboy Slim", 2),
    mk("edcmx27-fumi", "FUMI", 2),
    mk("edcmx27-gregorio", "Gregorio", 2),
    mk("edcmx27-holy-priest", "Holy Priest", 2),
    mk("edcmx27-i-hate-models", "I Hate Models", 2),
    mk("edcmx27-jamback", "Jamback", 2),
    mk("edcmx27-jenna-shaw", "Jenna Shaw", 2),
    mk("edcmx27-john-askew-simon-patterson", "John Askew + Simon Patterson", 2),
    mk("edcmx27-keel", "Keel", 2),
    mk("edcmx27-kill-the-clowns", "Kill The Clowns", 2),
    mk("edcmx27-kloud", "Kloud", 2),
    mk("edcmx27-knolldoll", "Knolldoll", 2),
    mk("edcmx27-l-a", "L.A.", 2),
    mk("edcmx27-loojan", "Loojan", 2),
    mk("edcmx27-los-dutis", "Los Dutis", 2),
    mk("edcmx27-luciano", "Luciano", 2),
    mk("edcmx27-lum1na", "Lum1na", 2),
    mk("edcmx27-maho-alzada", "Maho + Alzada", 2),
    mk("edcmx27-mandragora", "Mandragora", 2),
    mk("edcmx27-marie-vaunt", "Marie Vaunt", 2),
    mk("edcmx27-mario-santander", "Mario Santander", 2),
    mk("edcmx27-marsolo", "Marsolo", 2),
    mk("edcmx27-the-masquerade", "The Masquerade", 2),
    mk("edcmx27-mella-dee", "Mella Dee", 2),
    mk("edcmx27-miss-lupe", "Miss Lupe", 2),
    mk("edcmx27-nico-moreno", "Nico Moreno", 2),
    mk("edcmx27-novah", "NOVAH", 2),
    mk("edcmx27-nrg2000", "NRG2000", 2),
    mk("edcmx27-olisso", "Olisso", 2),
    mk("edcmx27-omiki", "Omiki", 2),
    mk("edcmx27-otta-b2b-spfdj", "ØTTA B2B SPFDJ", 2),
    mk("edcmx27-paul-van-dyk-presents-the-essence-of-acid", "Paul van Dyk presents The Essence of Acid", 2),
    mk("edcmx27-quest", "Quest", 2),
    mk("edcmx27-rebelion", "Rebelion", 2),
    mk("edcmx27-the-rocketman", "The Rocketman", 2),
    mk("edcmx27-rommii", "ROMMII", 2),
    mk("edcmx27-sam-blacky", "Sam Blacky", 2),
    mk("edcmx27-sequence-six", "Sequence Six", 2),
    mk("edcmx27-slander", "SLANDER", 2),
    mk("edcmx27-spika", "Spika", 2),
    mk("edcmx27-sub-zero-project", "Sub Zero Project", 2),
    mk("edcmx27-vintage-culture", "Vintage Culture", 2),
    mk("edcmx27-zack-fox", "Zack Fox", 2),
    mk("edcmx27-zombies-in-miami", "Zombies In Miami", 2),
    mk("edcmx27-adriatique", "Adriatique", 3),
    mk("edcmx27-alarico-b2b-yanamaste", "Alarico B2B Yanamaste", 3),
    mk("edcmx27-antaares", "Antaares", 3),
    mk("edcmx27-bad-boombox-b2b-mija", "Bad Boombox B2B Mija", 3),
    mk("edcmx27-ben-klock-b2b-shdw", "Ben Klock B2B SHDW", 3),
    mk("edcmx27-bunt", "BUNT.", 3),
    mk("edcmx27-capochino", "Capochino", 3),
    mk("edcmx27-cartel-de-los-hipopotamos", "Cártel De Los Hipopótamos", 3),
    mk("edcmx27-chasewest", "ChaseWest", 3),
    mk("edcmx27-close-friends-only", "Close Friends Only", 3),
    mk("edcmx27-d-sturb", "D-Sturb", 3),
    mk("edcmx27-damian-lazarus", "Damian Lazarus", 3),
    mk("edcmx27-davyboi-b2b-mika-heggemann", "Davyboi B2B Mika Heggemann", 3),
    mk("edcmx27-dax-j", "Dax J", 3),
    mk("edcmx27-discip", "Discip", 3),
    mk("edcmx27-dishype", "Dishype", 3),
    mk("edcmx27-dj-escuby", "DJ Escuby", 3),
    mk("edcmx27-don-diablo", "Don Diablo", 3),
    mk("edcmx27-dualite", "Dualité", 3),
    mk("edcmx27-dusky", "Dusky", 3),
    mk("edcmx27-easttown", "Easttown", 3),
    mk("edcmx27-enemix", "Enemix", 3),
    mk("edcmx27-fatboy-slim-d3", "Fatboy Slim", 3),
    mk("edcmx27-fatima-hajji", "Fatima Hajji", 3),
    mk("edcmx27-freebot", "Freebot", 3),
    mk("edcmx27-galantis", "Galantis", 3),
    mk("edcmx27-gudfella", "GUDFELLA", 3),
    mk("edcmx27-imanol-igoa", "Imanol Igoa", 3),
    mk("edcmx27-iza-tkm-dj-set", "Iza TKM (DJ Set)", 3),
    mk("edcmx27-jackie-hollander", "Jackie Hollander", 3),
    mk("edcmx27-jessica-audiffred", "Jessica Audiffred", 3),
    mk("edcmx27-jordy-medina", "Jordy Medina", 3),
    mk("edcmx27-kuko-b2b-onlynumbers", "KUKO B2B Onlynumbers", 3),
    mk("edcmx27-kungs", "Kungs", 3),
    mk("edcmx27-la-bad-curly", "La Bad Curly", 3),
    mk("edcmx27-labibe", "LABIBE", 3),
    mk("edcmx27-laszewo", "Łaszewo", 3),
    mk("edcmx27-lisa-korver-b2b-supergloss", "Lisa Korver B2B Supergloss", 3),
    mk("edcmx27-liu", "Liu", 3),
    mk("edcmx27-lost-frequencie-sunset-set", "Lost Frequencie (Sunset Set)", 3),
    mk("edcmx27-lost-kings", "Lost Kings", 3),
    mk("edcmx27-luch", "Luch", 3),
    mk("edcmx27-luciana", "Luciana", 3),
    mk("edcmx27-marron", "MARRØN", 3),
    mk("edcmx27-mary-droppinz", "Mary Droppinz", 3),
    mk("edcmx27-michael-bibi", "Michael Bibi", 3),
    mk("edcmx27-miss-k8", "Miss K8", 3),
    mk("edcmx27-morvius-b2b-shanti-clasing", "MorVius B2B Shanti Clasing", 3),
    mk("edcmx27-mystery-affair", "Mystery Affair", 3),
    mk("edcmx27-omnom-b2b-walker-and-royce", "OMNOM B2B Walker & Royce", 3),
    mk("edcmx27-omri", "OMRI.", 3),
    mk("edcmx27-postcard-b2b-youth-in-circles", "Postcard B2B Youth In Circles", 3),
    mk("edcmx27-ranger-trucco", "Ranger Trucco", 3),
    mk("edcmx27-richie-hawtin", "Richie Hawtin", 3),
    mk("edcmx27-somewhen-b2b-ueberrest", "Somewhen B2B Ueberrest", 3),
    mk("edcmx27-tiesto", "Tiësto", 3),
    mk("edcmx27-uberkikz", "ÜBERKIKZ", 3),
    mk("edcmx27-whomadewho", "WhoMadeWho", 3),
    mk("edcmx27-wooli", "Wooli", 3),
    mk("edcmx27-ydg", "YDG", 3),
    mk("edcmx27-yosoymatt", "YoSoyMatt", 3),
    mk("edcmx27-yudith", "Yudith", 3),
  ];
  const day = (d, name, short) => ({ y: 2027, m: 1, d, name, short, midnightUtc: Date.UTC(2027, 1, d, -CST, 0, 0) });
  const CONFIG = {
    id: "edc-mexico-2027",
    lineupSource: { url: "https://mexico.edc.com/en/lineup/", observedAt: "2026-11-24", official: true },
    officialEvent: { id: 548875, url: "https://mexico.electricdaisycarnival.com/", website: "https://mexico.edc.com/", tickets: "https://mexico.edc.com/en/tickets/", observedAt: "2026-09-10" },
    name: "EDC Mexico 2027",
    shortName: "EDC Mexico",
    brand: "EDC",
    tagline: "Three days at the Autódromo",
    // ", Mexico" is load-bearing: gen-festival-pages' place() reads the tail
    // as addressCountry, and would otherwise leave the JSON-LD countryless.
    location: "Autódromo Hermanos Rodríguez · Mexico City, Mexico",
    locationShort: "Autódromo Hermanos Rodríguez",
    dates: "Feb 19–21, 2027",
    year: 2027,
    // Night Print accent: the festival's own first-party colour (ledger: scripts/test-night-print.mjs)
    print: { accent: "#CC2831", source: { url: "https://mexico.edc.com/wp-content/assets/css/edcmexico.min.css?ver=2.2.41", observedAt: "2026-10-09", seenAs: "Site stylesheet: `a { color:#cc2831 }`, `button { background-color:#cc2831 }`, `.button--outline` border/text, hover #a10710 (7 uses); the homepage HTML also inlines `button{background-color: #cc2831;}`.", confidence: "high" }, note: "No <meta theme-color> (only WordPress's admin default custom property), so the first-party sheet's link + primary-button red is the accent, confirmed by the same hex inlined in the page." },
    startMs: Date.UTC(2027, 1, 19, -CST, 0, 0),    // Fri Feb 19 00:00 local
    endMs:   Date.UTC(2027, 1, 22, 6 - CST, 0, 0), // Mon Feb 22 06:00 local (bound, not a closing time)
    tz: "America/Mexico_City",
    tzAbbr: "CST",
    utcOffsetHours: CST,
    dayDates: {
      1: day(19, "Friday",   "FRI"),
      2: day(20, "Saturday", "SAT"),
      3: day(21, "Sunday",   "SUN"),
    },
    gps: { lat: 19.40611111, lng: -99.0925, onSiteRadiusMi: 1.5 },
    venue: {
      name: "Autódromo Hermanos Rodríguez",
      address: "Mexico City, Mexico",
      terrain: "motor-racing circuit grounds, outdoors",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };
  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["edc-mexico-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Open as lineup-only: available + scheduleTBA, no set times.
    registry: { available: true, scheduleTBA: true, accent: "#f43f5e", emoji: "🌼", region: "Latin America" },
  };
})();

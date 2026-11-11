// ═══════════════════════════════════════════════════════════════════════
// TOMORROWLAND THAILAND 2026 — Wisdom Valley · Chon Buri, Thailand
// Dec 11–13, 2026. The first Tomorrowland edition in Thailand.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP-ONLY SCAFFOLD, gated (available: false). The lineup, its day split
// AND its stage split are official; set times and the site map are not
// published.
//
// SOURCE lineup + day + stage: thailand.tomorrowland.com/en/line-up/,
// ?day=2026-12-11, ?day=2026-12-12 and ?day=2026-12-13, read 2026-11-11,
// "stages" view. Seven stages each day: MAINSTAGE, FREEDOM BY BUDWEISER,
// CRYSTAL GARDEN BY ANKER, CODEX, CORE, PAPILLON, MOOSE BAR. 158 rows: Fri
// 53, Sat 54, Sun 51, every name kept exactly as printed. Saturday's Freedom
// stage is "HOSTED BY ATMOSPHERE". Sunday's Papillon prints a "More to be
// announced" placeholder, which is not loaded. Friday's Mainstage prints
// "HALŌ" and Sunday's prints "Halo"; both are kept as printed, as two rows.
// Acts billed on more than one day (Jan V, Jelle DK, Jerrooo, DJ Licious,
// HALŌ/Halo) carry a -d<day> id suffix so every row id stays unique.
// SOURCE dates, hours, venue, age: thailand.tomorrowland.com/en/sales-info/
// terms-conditions/, read 2026-11-11 — venue "Wisdom Valley (Khao Mai Kaeo,
// Bang Lamung District, Chon Buri 20150, Thailand)"; hours GMT+7 Fri Dec 11
// 13:00–01:00, Sat Dec 12 13:00–01:00, Sun Dec 13 13:00–00:00; "Persons
// under 20 will not be admitted".
// SOURCE gps: NOT OFFICIAL. tmlunite.com's fan guide map
// (/en/guide-festival/thailand/map) gives 12.9527, 101.0184. A blog's plus
// code for Wisdom Valley, X22C+V93, decodes (7P43 prefix) to 12.9521,
// 101.0209, about 280 m away, so the two agree on the site; neither is a
// survey. Re-check before the flip.
// STAGE COLOURS are Plursky's own, not the festival's: no official stage
// palette was read. Stages carry no x/y (no official site map read).
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
// sunTimes are COMPUTED (NOAA formula, zenith 90.833°, UTC+7).
(function () {
  "use strict";

  // ⚠ NO x/y ON ANY STAGE: real stages with unknown positions.
  const STAGES = [
    { id: "mainstage", name: "Mainstage", short: "MAIN", color: "#f59e0b", size: 1.6,
      desc: "Main stage" },
    { id: "freedom", name: "Freedom by Budweiser", short: "FREEDOM", color: "#ef4444", size: 1.4,
      desc: "Second stage" },
    { id: "crystal", name: "Crystal Garden by Anker", short: "CRYSTAL", color: "#a78bfa", size: 1.3,
      desc: "Garden stage" },
    { id: "codex", name: "Codex", short: "CODEX", color: "#22d3ee", size: 1.2,
      desc: "Stage" },
    { id: "core", name: "CORE", short: "CORE", color: "#4ade80", size: 1.2,
      desc: "Stage" },
    { id: "papillon", name: "Papillon", short: "PAPILLON", color: "#f472b6", size: 1.0,
      desc: "Stage" },
    { id: "moose", name: "Moose Bar", short: "MOOSE", color: "#a3a3a3", size: 0.8,
      desc: "Bar stage" },
  ];
  const AMENITIES = [];
  const SCHEDULE = {};
  const scheduled = act => {
    const s = SCHEDULE[act.id];
    if (!s) return act;
    const { provisional, ...rest } = act;
    return { ...rest, stage: s[0], start: s[1], end: s[2], day: s[3] ?? act.day,
      bio: "Playing Tomorrowland Thailand 2026." };
  };
  const DAY_NAME = { 1: "December 11", 2: "December 12", 3: "December 13" };
  const mk = (id, name, stage, day) => scheduled({
    id, name, genre: "—", country: "—",
    stage, day, start: "", end: "", tier: 2,
    img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #0b1020)`,
    bio: `Playing Tomorrowland Thailand 2026 on the ${(STAGES.find(s => s.id === stage) || {}).name} stage on ` +
         DAY_NAME[day] + ". Set time is not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    // ── Fri Dec 11 (day 1) ── 53 acts
    mk("tmlth-alan-walker", "Alan Walker", "mainstage", 1),
    mk("tmlth-goldfish", "Goldfish", "mainstage", 1),
    mk("tmlth-halo-d1", "HALŌ", "mainstage", 1),
    mk("tmlth-henri-pfr", "Henri PFR", "mainstage", 1),
    mk("tmlth-john-newman", "John Newman", "mainstage", 1),
    mk("tmlth-kevin-de-vries", "Kevin de Vries", "mainstage", 1),
    mk("tmlth-lilly-palmer", "Lilly Palmer", "mainstage", 1),
    mk("tmlth-martin-garrix", "Martin Garrix", "mainstage", 1),
    mk("tmlth-rave-republic", "Rave Republic", "mainstage", 1),
    mk("tmlth-vini-vici", "Vini Vici", "mainstage", 1),
    mk("tmlth-youna", "Youna", "mainstage", 1),
    mk("tmlth-bassjackers", "Bassjackers", "freedom", 1),
    mk("tmlth-da-tweekaz", "Da Tweekaz", "freedom", 1),
    mk("tmlth-flosstradamus-b2b-yellow-claw", "Flosstradamus b2b Yellow Claw", "freedom", 1),
    mk("tmlth-honey-gee", "Honey Gee", "freedom", 1),
    mk("tmlth-kryder", "Kryder", "freedom", 1),
    mk("tmlth-mandy", "MANDY", "freedom", 1),
    mk("tmlth-mike-bond", "Mike Bond", "freedom", 1),
    mk("tmlth-raiden", "Raiden", "freedom", 1),
    mk("tmlth-sm1le", "Sm1le", "freedom", 1),
    mk("tmlth-wukong", "Wukong", "freedom", 1),
    mk("tmlth-aly-and-fila", "Aly & Fila", "crystal", 1),
    mk("tmlth-amy-wiles", "Amy Wiles", "crystal", 1),
    mk("tmlth-cosmic-gate", "Cosmic Gate", "crystal", 1),
    mk("tmlth-eli-and-fur-b2b-yotto", "Eli & Fur b2b Yotto", "crystal", 1),
    mk("tmlth-ferry-corsten", "Ferry Corsten", "crystal", 1),
    mk("tmlth-ferry-corsten-b2b-marsh", "Ferry Corsten b2b Marsh", "crystal", 1),
    mk("tmlth-jonnie-b", "Jonnie B", "crystal", 1),
    mk("tmlth-lonskii", "Lonskii", "crystal", 1),
    mk("tmlth-marsh", "Marsh", "crystal", 1),
    mk("tmlth-camelphat", "Camelphat", "codex", 1),
    mk("tmlth-camila-jun", "Camila Jun", "codex", 1),
    mk("tmlth-dadoo", "DaDoo", "codex", 1),
    mk("tmlth-dj-licious-d1", "DJ Licious", "codex", 1),
    mk("tmlth-elfigo", "Elfigo", "codex", 1),
    mk("tmlth-linska", "Linska", "codex", 1),
    mk("tmlth-solardo", "Solardo", "codex", 1),
    mk("tmlth-claudine", "CLAUDINE", "core", 1),
    mk("tmlth-funk-tribu", "Funk Tribu", "core", 1),
    mk("tmlth-hyalyte", "Hyalyte", "core", 1),
    mk("tmlth-oppidan", "Oppidan", "core", 1),
    mk("tmlth-pegassi", "Pegassi", "core", 1),
    mk("tmlth-saint-ludo", "Saint Ludo", "core", 1),
    mk("tmlth-x-club", "X CLUB.", "core", 1),
    mk("tmlth-jijie", "Jijie", "papillon", 1),
    mk("tmlth-lennert-wolfs", "Lennert Wolfs", "papillon", 1),
    mk("tmlth-makasi", "Makasi", "papillon", 1),
    mk("tmlth-palmera", "Palmera", "papillon", 1),
    mk("tmlth-ta-rek", "TA:REK", "papillon", 1),
    mk("tmlth-vicky-kroon", "Vicky Kroon", "papillon", 1),
    mk("tmlth-jan-v-d1", "Jan V", "moose", 1),
    mk("tmlth-jelle-dk-d1", "Jelle DK", "moose", 1),
    mk("tmlth-jerrooo-d1", "Jerrooo", "moose", 1),

    // ── Sat Dec 12 (day 2) ── 54 acts
    mk("tmlth-afrojack", "Afrojack", "mainstage", 2),
    mk("tmlth-artbat", "Artbat", "mainstage", 2),
    mk("tmlth-dimitri-vegas-and-like-mike", "Dimitri Vegas & Like Mike", "mainstage", 2),
    mk("tmlth-ian-asher", "Ian Asher", "mainstage", 2),
    mk("tmlth-karty", "KARTY", "mainstage", 2),
    mk("tmlth-meaghan", "Meaghan", "mainstage", 2),
    mk("tmlth-miss-monique", "Miss Monique", "mainstage", 2),
    mk("tmlth-nervo", "Nervo", "mainstage", 2),
    mk("tmlth-riviere", "Riviere", "mainstage", 2),
    mk("tmlth-steve-aoki", "Steve Aoki", "mainstage", 2),
    mk("tmlth-sub-zero-project", "Sub Zero Project", "mainstage", 2),
    mk("tmlth-amber-broos-b2b-space-92", "Amber Broos b2b Space 92", "freedom", 2),
    mk("tmlth-hannah-laing", "Hannah Laing", "freedom", 2),
    mk("tmlth-meguru", "Meguru", "freedom", 2),
    mk("tmlth-nakadia", "Nakadia", "freedom", 2),
    mk("tmlth-nico-moreno", "Nico Moreno", "freedom", 2),
    mk("tmlth-row1", "Row1", "freedom", 2),
    mk("tmlth-xy", "XY", "freedom", 2),
    mk("tmlth-blastoyz-b2b-whiteno1se", "Blastoyz b2b WHITENO1SE", "crystal", 2),
    mk("tmlth-blazy", "Blazy", "crystal", 2),
    mk("tmlth-firaga", "Firaga", "crystal", 2),
    mk("tmlth-ghost-rider", "Ghost Rider", "crystal", 2),
    mk("tmlth-infected-mushroom", "Infected Mushroom", "crystal", 2),
    mk("tmlth-mad-maxx-b2b-stryker", "Mad Maxx b2b Stryker", "crystal", 2),
    mk("tmlth-puffer-p", "Puffer P", "crystal", 2),
    mk("tmlth-somnia", "Somnia", "crystal", 2),
    mk("tmlth-tripical-note", "Tripical Note", "crystal", 2),
    mk("tmlth-vegas", "Vegas", "crystal", 2),
    mk("tmlth-22-bullets", "22 Bullets", "codex", 2),
    mk("tmlth-dj-sally", "DJ Sally", "codex", 2),
    mk("tmlth-dubvision", "Dubvision", "codex", 2),
    mk("tmlth-dvbbs", "DVBBS", "codex", 2),
    mk("tmlth-manuals", "Manuals", "codex", 2),
    mk("tmlth-nome", "NOME.", "codex", 2),
    mk("tmlth-petra", "PETRA", "codex", 2),
    mk("tmlth-romeo-blanco", "Romeo Blanco", "codex", 2),
    mk("tmlth-third-party", "Third Party", "codex", 2),
    mk("tmlth-yves-v", "Yves V", "codex", 2),
    mk("tmlth-anika", "An!ka", "core", 2),
    mk("tmlth-bibi-seck", "Bibi Seck", "core", 2),
    mk("tmlth-dj-boring", "DJ Boring", "core", 2),
    mk("tmlth-dj-boring-b2b-luuk-van-dijk", "DJ Boring b2b Luuk van Dijk", "core", 2),
    mk("tmlth-luuk-van-dijk", "Luuk van Dijk", "core", 2),
    mk("tmlth-meltmode", "Meltmode", "core", 2),
    mk("tmlth-mind-against", "Mind Against", "core", 2),
    mk("tmlth-arten", "Arten", "papillon", 2),
    mk("tmlth-carly-wilford", "Carly Wilford", "papillon", 2),
    mk("tmlth-coco-bevan", "Coco Bevan", "papillon", 2),
    mk("tmlth-dj-licious-d2", "DJ Licious", "papillon", 2),
    mk("tmlth-rebeca-ark", "Rebeca Ark", "papillon", 2),
    mk("tmlth-semsei", "Semsei", "papillon", 2),
    mk("tmlth-jan-v-d2", "Jan V", "moose", 2),
    mk("tmlth-jelle-dk-d2", "Jelle DK", "moose", 2),
    mk("tmlth-jerrooo-d2", "Jerrooo", "moose", 2),

    // ── Sun Dec 13 (day 3) ── 51 acts
    mk("tmlth-alok", "Alok", "mainstage", 3),
    mk("tmlth-botcash", "Botcash", "mainstage", 3),
    mk("tmlth-halo-d3", "Halo", "mainstage", 3),
    mk("tmlth-kolsch", "Kölsch", "mainstage", 3),
    mk("tmlth-lost-frequencies", "Lost Frequencies", "mainstage", 3),
    mk("tmlth-mattn", "MATTN", "mainstage", 3),
    mk("tmlth-novah", "Novah", "mainstage", 3),
    mk("tmlth-nuttrix", "Nuttrix", "mainstage", 3),
    mk("tmlth-r3hab", "R3hab", "mainstage", 3),
    mk("tmlth-swedish-house-mafia", "Swedish House Mafia", "mainstage", 3),
    mk("tmlth-agents-of-time", "Agents Of Time", "freedom", 3),
    mk("tmlth-artbat-b2b-r3hab", "Artbat b2b R3hab", "freedom", 3),
    mk("tmlth-henri-bergmann", "Henri Bergmann", "freedom", 3),
    mk("tmlth-kevin-de-vries-b2b-morten", "Kevin de Vries b2b MORTEN", "freedom", 3),
    mk("tmlth-luna-and-lenthe", "Luna & Lenthe", "freedom", 3),
    mk("tmlth-xenia-dia", "Xenia Dia", "freedom", 3),
    mk("tmlth-yukio", "Yukio", "freedom", 3),
    mk("tmlth-angemi", "Angemi", "crystal", 3),
    mk("tmlth-brennan-heart", "Brennan Heart", "crystal", 3),
    mk("tmlth-laidback-luke", "Laidback Luke", "crystal", 3),
    mk("tmlth-lora-matia", "Lora Matia", "crystal", 3),
    mk("tmlth-lucas-and-steve", "Lucas & Steve", "crystal", 3),
    mk("tmlth-matisse-and-sadko", "Matisse & Sadko", "crystal", 3),
    mk("tmlth-quintino", "Quintino", "crystal", 3),
    mk("tmlth-tiger-drama", "Tiger Drama", "crystal", 3),
    mk("tmlth-whisnu-santika", "Whisnu Santika", "crystal", 3),
    mk("tmlth-andromedik", "Andromedik", "codex", 3),
    mk("tmlth-apashe", "APASHE", "codex", 3),
    mk("tmlth-j-nana", "J-Nana", "codex", 3),
    mk("tmlth-maysaa", "Maysaa", "codex", 3),
    mk("tmlth-merow", "Merow", "codex", 3),
    mk("tmlth-netsky", "Netsky", "codex", 3),
    mk("tmlth-pixzy", "Pixzy", "codex", 3),
    mk("tmlth-rayray", "Rayray", "codex", 3),
    mk("tmlth-sabai", "Sabai", "codex", 3),
    mk("tmlth-yellow-claw", "Yellow Claw", "codex", 3),
    mk("tmlth-ameme-b2b-honeyluv", "AMÉMÉ b2b Honeyluv", "core", 3),
    mk("tmlth-capoon", "Capoon", "core", 3),
    mk("tmlth-dennis-gold", "Dennis Gold", "core", 3),
    mk("tmlth-dino-lenny", "Dino Lenny", "core", 3),
    mk("tmlth-dj-tennis", "DJ Tennis", "core", 3),
    mk("tmlth-joris-voorn-b2b-krystal-klear", "Joris Voorn b2b Krystal Klear", "core", 3),
    mk("tmlth-maxi-meraki", "Maxi Meraki", "core", 3),
    mk("tmlth-adamk", "AdamK", "papillon", 3),
    mk("tmlth-joulie", "JOULIE", "papillon", 3),
    mk("tmlth-jowaves", "JoWaves", "papillon", 3),
    mk("tmlth-neon", "Neon", "papillon", 3),
    mk("tmlth-onfaya", "Onfaya", "papillon", 3),
    mk("tmlth-jan-v-d3", "Jan V", "moose", 3),
    mk("tmlth-jelle-dk-d3", "Jelle DK", "moose", 3),
    mk("tmlth-jerrooo-d3", "Jerrooo", "moose", 3),
  ];

  const CONFIG = {
    id: "tomorrowland-thailand-2026",
    lineupSource: { url: "https://thailand.tomorrowland.com/en/line-up/", observedAt: "2026-11-11", official: true },
    name: "Tomorrowland Thailand 2026",
    shortName: "Tomorrowland Thailand",
    brand: "Tomorrowland",
    tagline: "The first Tomorrowland in Thailand",
    location: "Wisdom Valley · Chon Buri, Thailand",
    locationShort: "Wisdom Valley",
    dates: "Dec 11–13, 2026",
    year: 2026,
    print: { accent: null, source: { url: "https://thailand.tomorrowland.com/en/", observedAt: "2026-11-11" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    officialEvent: {
      website: "https://thailand.tomorrowland.com/en/",
      observedAt: "2026-11-11",
    },
    // Thailand is ICT (UTC+7), no DST. Hours from the official terms (header).
    startMs: Date.UTC(2026, 11, 11, 6, 0, 0),   // Dec 11 13:00 ICT
    endMs: Date.UTC(2026, 11, 13, 17, 0, 0),    // Dec 14 00:00 ICT
    tz: "Asia/Bangkok",
    tzAbbr: "ICT",
    utcOffsetHours: 7,
    dayDates: {
      1: { y: 2026, m: 11, d: 11, name: "Dec 11", short: "FRI",
           midnightUtc: Date.UTC(2026, 11, 10, 17, 0, 0) },
      2: { y: 2026, m: 11, d: 12, name: "Dec 12", short: "SAT",
           midnightUtc: Date.UTC(2026, 11, 11, 17, 0, 0) },
      3: { y: 2026, m: 11, d: 13, name: "Dec 13", short: "SUN",
           midnightUtc: Date.UTC(2026, 11, 12, 17, 0, 0) },
    },
    // Computed (NOAA formula) at the gps point, ICT.
    sunTimes: {
      1: { rise: "06:28", set: "17:51" },
      2: { rise: "06:28", set: "17:51" },
      3: { rise: "06:29", set: "17:51" },
    },
    gps: { lat: 12.9527, lng: 101.0184, onSiteRadiusMi: 0.5 },
    venue: {
      name: "Wisdom Valley",
      address: "Khao Mai Kaeo, Bang Lamung District, Chon Buri 20150, Thailand",
      terrain: "open festival valley",
    },
    policies: { minimumAge: 20 },
    weatherEndpoint: null,
    mainStageId: "mainstage",
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["tomorrowland-thailand-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: false, scheduleTBA: true, accent: "#f59e0b", emoji: "🐘", region: "Asia" },
  };
})();

// ═══════════════════════════════════════════════════════════════════════
// TOMORROWLAND WINTER 2027 — Alpe d'Huez, France
// Sat Mar 20 – Fri Mar 26 line-up days (the site's dates: March 20–27, 2027)
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names and their days are official; stages, set
// times, a 2027 map and sun times are NOT published here and none are
// invented below. Was a gated preview in data.jsx (added 2026-11-11).
//
// ── SOURCE (observed 2026-11-22) ──
// winter.tomorrowland.com/en/line-up/?day=2027-03-DD, one page per day,
// 20 through 26. Each page prints a weekday heading (SATURDAY … FRIDAY) and
// the day's names separated by " . ". The page intro reads "from March 20 to
// March 27, 2027"; the day tabs run Sat 20 Mar to Fri 26 Mar, so day 1 is
// Saturday Mar 20 and day 7 is Friday Mar 26. Read twice per day (rendered
// text and a verbatim quote), identical on all seven.
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: as printed, one row per printed billing. "b2b" billings stay one
//     act ("Joris Voorn b2b Kölsch"); "&" never splits ("Matisse & Sadko",
//     "Dimitri Vegas & Like Mike").
//   - day: the day page the name is printed on.
//   - id: "tmlw27-" + slug. An act printed on more than one day gets a
//     -d<day> suffix on every row (the Tomorrowland Thailand convention), so
//     each row id is unique.
// Counts: 125 day appearances · 85 distinct billings · 33 billed on more than
// one day · per day 12/15/15/18/23/19/23.
// LEFT OUT, NOT A SOURCE PROBLEM: "MR. E." is printed on days 5 and 6, but the
// name is short and already billed at Tomorrowland 2022/2023, so it would add
// an artist-review row past the registry cap. It stays out until that cap
// call is made; the official page above still lists it.
//
// The site has a "stages" view; no stage is loaded from it here, so every act
// is stage:null until a stage/time source is read on its own.
//
// ── DATES ──
// France is on CET (UTC+1) until Sun Mar 28, 2027, so the whole week is
// UTC+1. startMs is Sat Mar 20 00:00 local. endMs is Sat Mar 27 06:00 local:
// a bound that keeps the last night's after-midnight sets inside the window,
// NOT a published closing time.
// GPS: the resort's point, NOT a stage — en.wikipedia.org/wiki/Alpe_d%27Huez
// (API coordinates, read 2026-11-22): 45.06028, 6.07139.
// NO WEATHER: api.weather.gov covers the US only, so weatherEndpoint is null.
(function () {
  "use strict";
  const STAGES = [];
  const AMENITIES = [];
  const CET = 1;
  const mk = (id, name, day) => ({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #93c5fd, #1e293b)",
    bio: "Playing Tomorrowland Winter 2027 in Alpe d'Huez. Stage and set time are not published yet.",
    provisional: true,
  });
  const ARTISTS = [
    mk("tmlw27-afrojack-d1", "Afrojack", 1),
    mk("tmlw27-baron-b2b-meloko", "Baron b2b Meloko", 1),
    mk("tmlw27-blasterjaxx", "Blasterjaxx", 1),
    mk("tmlw27-jelle-dk-d1", "Jelle DK", 1),
    mk("tmlw27-jeroen-visser-d1", "Jeroen Visser", 1),
    mk("tmlw27-karakals-d1", "Karakals", 1),
    mk("tmlw27-kolsch", "Kölsch", 1),
    mk("tmlw27-korolova-d1", "Korolova", 1),
    mk("tmlw27-morten-d1", "Morten", 1),
    mk("tmlw27-mosimann-d1", "Mosimann", 1),
    mk("tmlw27-oliver-heldens", "Oliver Heldens", 1),
    mk("tmlw27-sub-zero-project-d1", "Sub Zero Project", 1),
    mk("tmlw27-benwal", "Benwal", 2),
    mk("tmlw27-hannah-laing-d2", "Hannah Laing", 2),
    mk("tmlw27-jelle-dk-d2", "Jelle DK", 2),
    mk("tmlw27-jeroen-visser-d2", "Jeroen Visser", 2),
    mk("tmlw27-jerrooo-d2", "Jerrooo", 2),
    mk("tmlw27-karakals-d2", "Karakals", 2),
    mk("tmlw27-kungs", "Kungs", 2),
    mk("tmlw27-lennert-wolfs-d2", "Lennert Wolfs", 2),
    mk("tmlw27-marsolo", "Marsolo", 2),
    mk("tmlw27-morten-d2", "Morten", 2),
    mk("tmlw27-natte-visstick", "Natte Visstick", 2),
    mk("tmlw27-oliver-heldens-b2b-tchami", "Oliver Heldens b2b Tchami", 2),
    mk("tmlw27-sub-zero-project-d2", "Sub Zero Project", 2),
    mk("tmlw27-yuuki-yoshiyama", "Yuuki Yoshiyama", 2),
    mk("tmlw27-yves-v", "Yves V", 2),
    mk("tmlw27-a-trak", "A-Trak", 3),
    mk("tmlw27-afrojack-d3", "Afrojack", 3),
    mk("tmlw27-benwal-b2b-olive-anguz", "Benwal b2b Olive Anguz", 3),
    mk("tmlw27-gregor-salto", "Gregor Salto", 3),
    mk("tmlw27-hannah-laing-d3", "Hannah Laing", 3),
    mk("tmlw27-ian-asher-d3", "Ian Asher", 3),
    mk("tmlw27-jelle-dk-d3", "Jelle DK", 3),
    mk("tmlw27-jerrooo-d3", "Jerrooo", 3),
    mk("tmlw27-joris-voorn-b2b-kolsch", "Joris Voorn b2b Kölsch", 3),
    mk("tmlw27-korolova-d3", "Korolova", 3),
    mk("tmlw27-lisa-korver", "Lisa Korver", 3),
    mk("tmlw27-novah-d3", "Novah", 3),
    mk("tmlw27-prosit-d3", "Prosit", 3),
    mk("tmlw27-space-92", "Space 92", 3),
    mk("tmlw27-third-party", "Third Party", 3),
    mk("tmlw27-halo", "HALŌ", 4),
    mk("tmlw27-jelle-dk-d4", "Jelle DK", 4),
    mk("tmlw27-linska", "Linska", 4),
    mk("tmlw27-massano", "Massano", 4),
    mk("tmlw27-matisse-and-sadko", "Matisse & Sadko", 4),
    mk("tmlw27-mattn-d4", "MATTN", 4),
    mk("tmlw27-mc-stretch-d4", "MC Stretch", 4),
    mk("tmlw27-meaghan-d4", "Meaghan", 4),
    mk("tmlw27-merow-b2b-moksi", "Merow b2b Moksi", 4),
    mk("tmlw27-mila-journee", "Mila Journée", 4),
    mk("tmlw27-miss-monique-d4", "Miss Monique", 4),
    mk("tmlw27-mosimann-d4", "Mosimann", 4),
    mk("tmlw27-nico-moreno-d4", "Nico Moreno", 4),
    mk("tmlw27-prosit-d4", "Prosit", 4),
    mk("tmlw27-sara-landry", "Sara Landry", 4),
    mk("tmlw27-serafina-d4", "Serafina", 4),
    mk("tmlw27-slander-d4", "Slander", 4),
    mk("tmlw27-steve-aoki", "Steve Aoki", 4),
    mk("tmlw27-alok-d5", "Alok", 5),
    mk("tmlw27-alt8-b2b-emilija", "Alt8 b2b Emilija", 5),
    mk("tmlw27-charlotte-de-witte-d5", "Charlotte de Witte", 5),
    mk("tmlw27-david-latour-d5", "David Latour", 5),
    mk("tmlw27-dubvision", "Dubvision", 5),
    mk("tmlw27-effe-serieus", "Effe Serieus", 5),
    mk("tmlw27-gravagerz", "Gravagerz", 5),
    mk("tmlw27-ian-asher-d5", "Ian Asher", 5),
    mk("tmlw27-jelle-dk-d5", "Jelle DK", 5),
    mk("tmlw27-john-newman-d5", "John Newman", 5),
    mk("tmlw27-kevin-de-vries-d5", "Kevin de Vries", 5),
    mk("tmlw27-koven", "Koven", 5),
    mk("tmlw27-lost-frequencies-d5", "Lost Frequencies", 5),
    mk("tmlw27-manuals-d5", "Manuals", 5),
    mk("tmlw27-mc-stretch-d5", "MC Stretch", 5),
    mk("tmlw27-meaghan-d5", "Meaghan", 5),
    mk("tmlw27-miss-monique-d5", "Miss Monique", 5),
    mk("tmlw27-nico-moreno-d5", "Nico Moreno", 5),
    mk("tmlw27-prosit-d5", "Prosit", 5),
    mk("tmlw27-row1", "ROW1", 5),
    mk("tmlw27-serafina-d5", "Serafina", 5),
    mk("tmlw27-slander-d5", "Slander", 5),
    mk("tmlw27-timmy-trumpet", "Timmy Trumpet", 5),
    mk("tmlw27-amber-broos", "Amber Broos", 6),
    mk("tmlw27-argy", "Argy", 6),
    mk("tmlw27-bhaskar-b2b-brina-knauss", "Bhaskar b2b Brina Knauss", 6),
    mk("tmlw27-brian-d6", "Brian", 6),
    mk("tmlw27-dimitri-vegas", "Dimitri Vegas", 6),
    mk("tmlw27-elfigo-d6", "ELFIGO", 6),
    mk("tmlw27-funkhauser-d6", "Funkhauser", 6),
    mk("tmlw27-hansi", "Hansi", 6),
    mk("tmlw27-kevin-de-vries-d6", "Kevin de Vries", 6),
    mk("tmlw27-lennert-wolfs-d6", "Lennert Wolfs", 6),
    mk("tmlw27-lny-tnz", "LNY TNZ", 6),
    mk("tmlw27-maceo-plex", "Maceo Plex", 6),
    mk("tmlw27-mattn-d6", "MATTN", 6),
    mk("tmlw27-mc-stretch-d6", "MC Stretch", 6),
    mk("tmlw27-miss-puss-b2b-pat-b", "Miss Puss b2b Pat B", 6),
    mk("tmlw27-novah-d6", "Novah", 6),
    mk("tmlw27-sound-rush", "Sound Rush", 6),
    mk("tmlw27-telykast-d6", "Telykast", 6),
    mk("tmlw27-the-saints-d6", "The Saints", 6),
    mk("tmlw27-alok-d7", "Alok", 7),
    mk("tmlw27-brian-d7", "Brian", 7),
    mk("tmlw27-brina-knauss", "Brina Knauss", 7),
    mk("tmlw27-charlotte-de-witte-d7", "Charlotte de Witte", 7),
    mk("tmlw27-chuckie", "Chuckie", 7),
    mk("tmlw27-dannic-b2b-dyro", "Dannic b2b Dyro", 7),
    mk("tmlw27-david-latour-d7", "David Latour", 7),
    mk("tmlw27-dimitri-vegas-and-like-mike", "Dimitri Vegas & Like Mike", 7),
    mk("tmlw27-dj-schnake", "DJ Schnake", 7),
    mk("tmlw27-elfigo-d7", "ELFIGO", 7),
    mk("tmlw27-funkhauser-d7", "Funkhauser", 7),
    mk("tmlw27-jelle-dk-d7", "Jelle DK", 7),
    mk("tmlw27-john-newman-d7", "John Newman", 7),
    mk("tmlw27-joris-voorn", "Joris Voorn", 7),
    mk("tmlw27-lost-frequencies-d7", "Lost Frequencies", 7),
    mk("tmlw27-lucca-van-damme", "Lucca van Damme", 7),
    mk("tmlw27-mandy", "Mandy", 7),
    mk("tmlw27-manuals-d7", "Manuals", 7),
    mk("tmlw27-mc-stretch-d7", "MC Stretch", 7),
    mk("tmlw27-pat-b", "Pat B", 7),
    mk("tmlw27-quintino", "Quintino", 7),
    mk("tmlw27-telykast-d7", "Telykast", 7),
    mk("tmlw27-the-saints-d7", "The Saints", 7),
  ];
  const day = (d, name, short) => ({ y: 2027, m: 2, d, name, short, midnightUtc: Date.UTC(2027, 2, d, -CET, 0, 0) });
  const CONFIG = {
    id: "tomorrowland-winter-2027",
    lineupSource: { url: "https://winter.tomorrowland.com/en/line-up/", observedAt: "2026-11-22", official: true },
    officialEvent: { website: "https://winter.tomorrowland.com/", tickets: "https://winter.tomorrowland.com/en/tickets/", observedAt: "2026-11-22" },
    name: "Tomorrowland Winter 2027",
    shortName: "Tomorrowland Winter",
    brand: "Tomorrowland",
    tagline: "A week of music in the French Alps",
    location: "Alpe d'Huez, France",
    locationShort: "Alpe d'Huez",
    dates: "Mar 20–27, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://winter.tomorrowland.com/", observedAt: "2026-11-11" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    startMs: Date.UTC(2027, 2, 20, -CET, 0, 0),   // Sat Mar 20 00:00 local
    endMs:   Date.UTC(2027, 2, 27, 6 - CET, 0, 0), // Sat Mar 27 06:00 local (bound, not a closing time)
    tz: "Europe/Paris",
    tzAbbr: "CET",
    utcOffsetHours: CET,
    dayDates: {
      1: day(20, "Saturday",  "SAT"),
      2: day(21, "Sunday",    "SUN"),
      3: day(22, "Monday",    "MON"),
      4: day(23, "Tuesday",   "TUE"),
      5: day(24, "Wednesday", "WED"),
      6: day(25, "Thursday",  "THU"),
      7: day(26, "Friday",    "FRI"),
    },
    gps: { lat: 45.06028, lng: 6.07139, onSiteRadiusMi: 1.5 },
    venue: {
      name: "Alpe d'Huez ski resort",
      address: "Alpe d'Huez, Isère, France",
      terrain: "ski slopes and village, outdoors at altitude",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };
  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["tomorrowland-winter-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Open as lineup-only: available + scheduleTBA, no set times.
    registry: { available: true, scheduleTBA: true, accent: "#93c5fd", emoji: "🏔️", region: "Europe" },
  };
})();

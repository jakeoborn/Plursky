// ═══════════════════════════════════════════════════════════════════════
// LOLLAPALOOZA 2026 — Grant Park · Chicago, IL
// Jul 30 – Aug 2, 2026
// ═══════════════════════════════════════════════════════════════════════
// RETROSPECTIVE BUILD. This festival is in the past, so every field below is
// published historical fact rather than a forecast — hence available: true and
// no provisional set-time flags. Sources are cited per block.
//
// SOURCE lineup + set times: official daily schedule graphics, lollapalooza.com/schedule
//   (LOL26_BTSchedule-7.29a Thursday / LOL26_Schedule-7.31-F / LOL26_Schedule-08.01-C-WEB /
//   SUN SCHED), accessed 2026-08-28.
// SOURCE stage positions: OpenStreetMap — Butler Field, Lower/Upper Hutchinson Field and
//   Buckingham Fountain are measured features; the five smaller stages are placed by hand.
//
// SATURDAY AUGUST 1 OPENED LATE. The official Saturday graphic carries a "WEATHER DELAY —
// DOORS DELAYED UNTIL 3PM" banner across the noon-to-3pm rows, and no set on any stage
// starts before 3:15pm. Day 3’s open time below is 15:00 for that reason.
// Four headliner blocks print a start with no end (Lorde 8:30, Charli xcx 8:40,
// Olivia Dean 8:30, Tate McRae 8:45); each is the closing set, so the end is the 10pm curfew.
// The graphics also carry TOYOTA MUSIC DEN and BUD LIGHT SOUND BAR strips along the
// bottom. Those are brand activations rather than stages on the grid and are omitted.
//
// SPATIAL MODEL — read this before moving any coordinate.
// Each stage carries ONE authored position: its real-world lat/lng. The 0-100
// grid x/y below is DERIVED from that lat/lng against `footprint`, and
// gpsAnchors is the same lat/lng echoed back. So feeding any anchor through
// map.jsx's gpsToMap() returns that stage's own x/y exactly — the map art and
// the pin layer cannot drift apart, because they are the same transform.
// (EDC LV and ACL were authored the other way round — art and pins registered
// independently — and both had stages tens of metres out. Don't repeat it.)
// Positions marked "prov" are placed from the published site layout and are
// NOT satellite-verified; "osm" are measured OpenStreetMap features.
// Round-trip residual for this festival: 0.109 grid units (~0.7 m),
// which is entirely the cost of printing x/y to one decimal for readability.
(function () {
  "use strict";

  const STAGES = [
    { id: "tmobile",  name: "T-Mobile Stage", short: "T-MOBILE", color: "#ec4899",
      x: 53.8, y: 11.8, size: 1.7, desc: "North · Butler Field, headliners",
      vibe: "North End Main", vibeNote: "Butler Field, skyline behind the stage. Lorde, Charli, Tate McRae — this is the postcard.", peak: "18:00–22:00" },
    { id: "budlight", name: "Bud Light Stage", short: "BUD LIGHT", color: "#38bdf8",
      x: 56.8, y: 88.1, size: 1.7, desc: "South · Hutchinson Field, headliners",
      vibe: "South End Main", vibeNote: "The other main. A mile from T-Mobile, which is the whole reason people plan their day badly.", peak: "18:00–22:00" },
    { id: "perrys",   name: "Perry's Stage", short: "PERRY'S", color: "#a855f7",
      x: 22.9, y: 79.7, size: 1.4, desc: "South-west · electronic",
      vibe: "The Dance Tent", vibeNote: "Twelve hours of DJs, zero daylight visible from inside the crowd. Lolla's own festival within the festival.", peak: "17:00–22:00" },
    { id: "titos",    name: "Tito's Stage", short: "TITO'S", color: "#f97316",
      x: 55.5, y: 47.2, size: 1.1, desc: "Tito's Handmade Vodka Stage · by Buckingham Fountain",
      vibe: "Fountain Side", vibeNote: "Right by Buckingham. Mid-size, well-shaded, and the easiest stage to stumble onto by accident.", peak: "16:00–21:00" },
    { id: "allianz",  name: "Allianz Stage", short: "ALLIANZ", color: "#22c55e",
      x: 34.6, y: 59.3, size: 1.15, desc: "West side · indie + rising",
      vibe: "Breakout Stage", vibeNote: "Where Wet Leg and aespa land before they're headlining. Show up an act early.", peak: "17:00–21:00" },
    { id: "airbnb",   name: "Airbnb Stage", short: "AIRBNB", color: "#14b8a6",
      x: 38.5, y: 34.3, size: 1.05, desc: "North-west · discovery",
      vibe: "Deep Cuts", vibeNote: "Forty-five minute slots, no filler, and it still closes at 10 with someone worth staying for.", peak: "16:00–22:00" },
    { id: "bmi",      name: "BMI Stage", short: "BMI", color: "#fbbf24",
      x: 32.1, y: 22.2, size: 0.8, desc: "North · songwriter showcase",
      vibe: "Before Anyone Knows", vibeNote: "Forty-minute sets from people with one EP out. Half of Lolla's future headliners played here first.", peak: "13:00–19:00" },
    { id: "bonus",    name: "Bonus Tracks", short: "BONUS", color: "#64748b",
      x: 29.5, y: 68.5, size: 0.7, desc: "South-west · talks + specials",
      vibe: "Not a Concert", vibeNote: "Podcast tapings, Q&As, The Second City. The stage you go to when your ears need twenty minutes off.", peak: "13:00–19:00" },
    { id: "kidza",    name: "Kidzapalooza", short: "KIDZA", color: "#2563eb",
      x: 70.5, y: 73.1, size: 0.7, desc: "South-east · family stage",
      vibe: "Small Humans", vibeNote: "Face paint, a mini mosh pit, and Mister G. Genuinely one of the best-run corners of the park.", peak: "12:00–17:00" },
  ];

  const AMENITIES = [
    { id: "lolla1", type: "water", label: "Hydration Station", x: 48.7, y: 22.2 },
    { id: "lolla2", type: "water", label: "Hydration Station", x: 42.3, y: 50 },
    { id: "lolla3", type: "water", label: "Hydration Station", x: 48.7, y: 82.4 },
    { id: "lolla4", type: "med", label: "Medical", x: 35.9, y: 17.6 },
    { id: "lolla5", type: "med", label: "Medical", x: 38.5, y: 84.3 },
    { id: "lolla6", type: "toilet", label: "Restrooms", x: 57.7, y: 26.9 },
    { id: "lolla7", type: "toilet", label: "Restrooms", x: 32.1, y: 54.6 },
    { id: "lolla8", type: "toilet", label: "Restrooms", x: 61.5, y: 77.8 },
    { id: "lolla9", type: "food", label: "Chow Town North", x: 42.3, y: 19.4 },
    { id: "lolla10", type: "food", label: "Chow Town South", x: 48.7, y: 73.1 },
    { id: "lolla11", type: "info", label: "Info / Lost & Found", x: 29.5, y: 45.4 },
    { id: "lolla12", type: "art", label: "Buckingham Fountain", x: 55.5, y: 47.2 },  // OSM
    { id: "lolla13", type: "art", label: "Petrillo Music Shell", x: 41.4, y: 18.9 },  // OSM
  ];

  // tier: 3 = headline slot (19:00+), 2 = prime (16:00–18:59), 1 = earlier.
  const mk = (id, name, genre, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 19 || h < 6 ? 3 : h >= 16 ? 2 : 1;
    return { id, name, genre, country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #1a0a28)`,
      bio: `Played Lollapalooza 2026.` };
  };

  const ARTISTS = [
    // ─────────── DAY 1 · Thursday Jul 30 ───────────
    // T-Mobile Stage
    mk("lo1",    "Asha Banks",                                        "—",                   "tmobile",       1, "12:45", "13:30"),
    mk("lo2",    "Haute & Freddy",                                    "—",                   "tmobile",       1, "14:30", "15:30"),
    mk("lo3",    "5 Seconds of Summer",                               "—",                   "tmobile",       1, "16:30", "17:30"),
    mk("lo4",    "sombr",                                             "—",                   "tmobile",       1, "18:30", "19:30"),
    mk("lo5",    "Lorde",                                             "Pop",                 "tmobile",       1, "20:30", "22:00"),
    // Bud Light Stage
    mk("lo6",    "Bixby",                                             "—",                   "budlight",      1, "13:00", "13:45"),
    mk("lo7",    "Between Friends",                                   "—",                   "budlight",      1, "14:45", "15:45"),
    mk("lo8",    "Blood Orange",                                      "Hip-Hop",             "budlight",      1, "16:45", "17:45"),
    mk("lo9",    "Empire of the Sun",                                 "Rock",                "budlight",      1, "18:30", "19:30"),
    mk("lo10",   "John Summit",                                       "Electronic",          "budlight",      1, "20:30", "22:00"),
    // Perry's Stage
    mk("lo11",   "KLO",                                               "Electronic",          "perrys",        1, "12:00", "12:30"),
    mk("lo12",   "Know Good",                                         "Electronic",          "perrys",        1, "12:45", "13:30"),
    mk("lo13",   "Devault",                                           "Electronic",          "perrys",        1, "13:45", "14:45"),
    mk("lo14",   "MPH",                                               "Electronic",          "perrys",        1, "15:00", "16:00"),
    mk("lo15",   "Boys Noize",                                        "Electronic",          "perrys",        1, "16:15", "17:15"),
    mk("lo16",   "Boris Brejcha",                                     "Electronic",          "perrys",        1, "17:45", "18:45"),
    mk("lo17",   "Kettama",                                           "Electronic",          "perrys",        1, "19:00", "20:00"),
    mk("lo18",   "Worship",                                           "Electronic",          "perrys",        1, "20:30", "21:45"),
    // Tito's Stage
    mk("lo19",   "Faouzia",                                           "Pop",                 "titos",         1, "12:15", "13:00"),
    mk("lo20",   "Kingfishr",                                         "Country",             "titos",         1, "13:45", "14:45"),
    mk("lo21",   "Paris Paloma",                                      "—",                   "titos",         1, "15:45", "16:45"),
    mk("lo22",   "Little Simz",                                       "—",                   "titos",         1, "17:45", "18:30"),
    mk("lo23",   "Devault",                                           "Electronic",          "titos",         1, "19:30", "20:30"),
    // Allianz Stage
    mk("lo24",   "Pearly Drops",                                      "—",                   "allianz",       1, "12:00", "12:45"),
    mk("lo25",   "Bad Nerves",                                        "Rock",                "allianz",       1, "13:30", "14:30"),
    mk("lo26",   "SB19",                                              "K-Pop",               "allianz",       1, "15:30", "16:30"),
    mk("lo27",   "Audrey Hobert",                                     "Pop",                 "allianz",       1, "17:30", "18:30"),
    mk("lo28",   "Wet Leg",                                           "Rock",                "allianz",       1, "19:30", "20:30"),
    // Airbnb Stage
    mk("lo29",   "Kim Theory",                                        "—",                   "airbnb",        1, "12:00", "12:30"),
    mk("lo30",   "Penelope Road",                                     "—",                   "airbnb",        1, "12:50", "13:30"),
    mk("lo31",   "Marlon Funaki",                                     "—",                   "airbnb",        1, "13:50", "14:30"),
    mk("lo32",   "Ecca Vandal",                                       "—",                   "airbnb",        1, "14:50", "15:30"),
    mk("lo33",   "Ninajirachi",                                       "Electronic",          "airbnb",        1, "16:00", "16:45"),
    mk("lo34",   "Amble",                                             "—",                   "airbnb",        1, "17:15", "18:00"),
    mk("lo35",   "CMAT",                                              "—",                   "airbnb",        1, "18:30", "19:15"),
    mk("lo36",   "Snow Strippers",                                    "Rock",                "airbnb",        1, "19:45", "20:30"),
    mk("lo37",   "Viagra Boys",                                       "Rock",                "airbnb",        1, "21:00", "22:00"),
    // BMI Stage
    mk("lo38",   "The Braymores",                                     "—",                   "bmi",           1, "13:00", "13:40"),
    mk("lo39",   "Simon Grossmann",                                   "—",                   "bmi",           1, "14:10", "14:50"),
    mk("lo40",   "Elizabeth Nichols",                                 "—",                   "bmi",           1, "15:20", "16:00"),
    mk("lo41",   "Bella Kay",                                         "—",                   "bmi",           1, "16:30", "17:10"),
    mk("lo42",   "Chalk",                                             "—",                   "bmi",           1, "17:40", "18:20"),
    mk("lo43",   "Evening Elephants",                                 "—",                   "bmi",           1, "18:50", "19:30"),
    // Bonus Tracks
    mk("lo44",   "DJ Prince Lex",                                     "Talk / Special",      "bonus",         1, "13:30", "14:00"),
    mk("lo45",   "Okamoto Sisters Self-Care Set",                     "Talk / Special",      "bonus",         1, "15:00", "15:30"),
    mk("lo46",   "DJ Prince Lex",                                     "Talk / Special",      "bonus",         1, "16:30", "17:00"),
    mk("lo47",   "Bella Kay x Mack",                                  "Talk / Special",      "bonus",         1, "17:45", "18:15"),
    mk("lo48",   "Track Star Live: Jack Coyne ft. Penelope Road",     "Talk / Special",      "bonus",         1, "18:30", "19:00"),
    // Kidzapalooza
    mk("lo49",   "Mister G",                                          "Family",              "kidza",         1, "12:00", "12:30"),
    mk("lo50",   "School of Rock",                                    "Youth Showcase",      "kidza",         1, "13:30", "14:00"),
    mk("lo51",   "Miss Tutti & The Fruity Band",                      "Family",              "kidza",         1, "15:00", "15:30"),
    mk("lo52",   "Jazzy Ash",                                         "Family",              "kidza",         1, "17:15", "17:45"),
    // ─────────── DAY 2 · Friday Jul 31 ───────────
    // T-Mobile Stage
    mk("lo53",   "partyof2",                                          "—",                   "tmobile",       2, "12:55", "13:40"),
    mk("lo54",   "i-dle",                                             "K-Pop",               "tmobile",       2, "14:40", "15:40"),
    mk("lo55",   "Zara Larsson",                                      "Pop",                 "tmobile",       2, "18:20", "19:20"),
    mk("lo56",   "Charli xcx",                                        "Pop",                 "tmobile",       2, "20:40", "22:00"),
    // Bud Light Stage
    mk("lo57",   "High Vis",                                          "Punk / Hardcore",     "budlight",      2, "13:15", "14:00"),
    mk("lo58",   "Slayyyter",                                         "Pop",                 "budlight",      2, "14:45", "15:30"),
    mk("lo59",   "The Story So Far",                                  "Punk / Hardcore",     "budlight",      2, "16:30", "17:30"),
    mk("lo60",   "Yungblud",                                          "—",                   "budlight",      2, "18:30", "19:30"),
    mk("lo61",   "The Smashing Pumpkins",                             "Rock",                "budlight",      2, "20:30", "22:00"),
    // Perry's Stage
    mk("lo62",   "Bradeazy",                                          "Electronic",          "perrys",        2, "12:00", "12:30"),
    mk("lo63",   "Avello",                                            "Electronic",          "perrys",        2, "12:45", "13:30"),
    mk("lo64",   "LYNY",                                              "Electronic",          "perrys",        2, "13:45", "14:45"),
    mk("lo65",   "RØZ",                                               "Electronic",          "perrys",        2, "15:00", "16:00"),
    mk("lo66",   "Notion",                                            "Electronic",          "perrys",        2, "16:15", "17:15"),
    mk("lo67",   "Sidepiece",                                         "Electronic",          "perrys",        2, "17:40", "18:40"),
    mk("lo68",   "Mustard",                                           "Electronic",          "perrys",        2, "18:50", "19:50"),
    mk("lo69",   "Major Lazer",                                       "Electronic",          "perrys",        2, "20:20", "21:55"),
    // Tito's Stage
    mk("lo70",   "Chicago Made",                                      "—",                   "titos",         2, "12:30", "13:15"),
    mk("lo71",   "Julia Wolf",                                        "Pop",                 "titos",         2, "14:00", "14:45"),
    mk("lo72",   "Mother Mother",                                     "Rock",                "titos",         2, "15:30", "16:30"),
    mk("lo73",   "Loathe",                                            "Punk / Hardcore",     "titos",         2, "17:30", "18:30"),
    mk("lo74",   "Nettspend",                                         "Hip-Hop",             "titos",         2, "19:30", "20:30"),
    // Allianz Stage
    mk("lo75",   "The Army, The Navy",                                "—",                   "allianz",       2, "12:10", "12:55"),
    mk("lo76",   "Claire Rosinkranz",                                 "Pop",                 "allianz",       2, "13:40", "14:40"),
    mk("lo77",   "Skye Newman",                                       "Pop",                 "allianz",       2, "15:40", "16:40"),
    mk("lo78",   "Suki Waterhouse",                                   "—",                   "allianz",       2, "17:20", "18:20"),
    mk("lo79",   "Not For Radio",                                     "—",                   "allianz",       2, "19:30", "20:30"),
    // Airbnb Stage
    mk("lo80",   "Beno",                                              "Pop",                 "airbnb",        2, "12:00", "12:30"),
    mk("lo81",   "Day We Ran",                                        "—",                   "airbnb",        2, "12:50", "13:30"),
    mk("lo82",   "Love Spells",                                       "—",                   "airbnb",        2, "13:50", "14:30"),
    mk("lo83",   "54 Ultra",                                          "—",                   "airbnb",        2, "14:50", "15:30"),
    mk("lo84",   "Finn Wolfhard",                                     "—",                   "airbnb",        2, "16:00", "16:45"),
    mk("lo85",   "Balu Brigada",                                      "—",                   "airbnb",        2, "17:30", "18:15"),
    mk("lo86",   "Oklou",                                             "Electronic",          "airbnb",        2, "18:45", "19:30"),
    mk("lo87",   "Horsegiirl",                                        "Hip-Hop",             "airbnb",        2, "19:55", "20:40"),
    mk("lo88",   "Freddie Gibbs",                                     "Hip-Hop",             "airbnb",        2, "21:15", "22:00"),
    // BMI Stage
    mk("lo89",   "Valencia Grace",                                    "—",                   "bmi",           2, "13:00", "13:40"),
    mk("lo90",   "Ella Boh",                                          "—",                   "bmi",           2, "14:10", "14:50"),
    mk("lo91",   "Emi Grace",                                         "—",                   "bmi",           2, "15:20", "16:00"),
    mk("lo92",   "Ivri",                                              "—",                   "bmi",           2, "16:30", "17:10"),
    mk("lo93",   "Ella Red",                                          "—",                   "bmi",           2, "17:40", "18:20"),
    mk("lo94",   "Whitney Whitney",                                   "—",                   "bmi",           2, "18:50", "19:30"),
    // Bonus Tracks
    mk("lo95",   "Zara Larsson x Davis Burleson",                     "Talk / Special",      "bonus",         2, "13:00", "13:30"),
    mk("lo96",   "DJ Prince Lex",                                     "Talk / Special",      "bonus",         2, "14:00", "14:30"),
    mk("lo97",   "sombr x Davis Burleson",                            "Talk / Special",      "bonus",         2, "15:15", "15:30"),
    mk("lo98",   "Yungblud with Mack",                                "Talk / Special",      "bonus",         2, "16:15", "16:30"),
    mk("lo99",   "Slayyyter with Davis Burleson",                     "Talk / Special",      "bonus",         2, "17:15", "17:30"),
    mk("lo100",  "DJ Prince Lex",                                     "Talk / Special",      "bonus",         2, "17:45", "18:15"),
    mk("lo101",  "Snacktime",                                         "Talk / Special",      "bonus",         2, "18:45", "19:15"),
    // Kidzapalooza
    mk("lo102",  "Miss Tutti & The Fruity Band",                      "Family",              "kidza",         2, "12:00", "12:30"),
    mk("lo103",  "Mister G",                                          "Family",              "kidza",         2, "13:30", "14:00"),
    mk("lo104",  "Jazzy Ash",                                         "Family",              "kidza",         2, "15:00", "15:30"),
    mk("lo105",  "School of Rock",                                    "Youth Showcase",      "kidza",         2, "17:15", "17:45"),
    // ─────────── DAY 3 · Saturday Aug 1 ───────────
    // T-Mobile Stage
    mk("lo106",  "CORTIS",                                            "K-Pop",               "tmobile",       3, "15:40", "16:20"),
    mk("lo107",  "Leon Thomas",                                       "Hip-Hop",             "tmobile",       3, "17:00", "17:45"),
    mk("lo108",  "The Neighbourhood",                                 "Rock",                "tmobile",       3, "18:30", "19:30"),
    mk("lo109",  "Olivia Dean",                                       "Pop",                 "tmobile",       3, "20:30", "22:00"),
    // Bud Light Stage
    mk("lo110",  "Wolf Alice",                                        "Rock",                "budlight",      3, "16:00", "16:30"),
    mk("lo111",  "Clipse",                                            "Hip-Hop",             "budlight",      3, "17:15", "18:15"),
    mk("lo112",  "Ethel Cain",                                        "Punk / Hardcore",     "budlight",      3, "19:00", "20:00"),
    mk("lo113",  "Jennie",                                            "K-Pop",               "budlight",      3, "20:55", "22:00"),
    // Perry's Stage
    mk("lo114",  "Omnom",                                             "Electronic",          "perrys",        3, "15:30", "16:00"),
    mk("lo115",  "ayybo",                                             "Electronic",          "perrys",        3, "16:10", "16:50"),
    mk("lo116",  "Whethan",                                           "Electronic",          "perrys",        3, "17:00", "17:45"),
    mk("lo117",  "Max Styler",                                        "Electronic",          "perrys",        3, "17:55", "18:50"),
    mk("lo118",  "Alison Wonderland",                                 "Electronic",          "perrys",        3, "19:05", "20:00"),
    mk("lo119",  "Disco Lines",                                       "Electronic",          "perrys",        3, "20:30", "21:45"),
    // Tito's Stage
    mk("lo120",  "Goldie Boutilier",                                  "—",                   "titos",         3, "15:30", "16:00"),
    mk("lo121",  "Momma",                                             "Rock",                "titos",         3, "16:30", "17:15"),
    mk("lo122",  "Frost Children",                                    "—",                   "titos",         3, "18:15", "19:00"),
    mk("lo123",  "bbno$",                                             "Hip-Hop",             "titos",         3, "20:00", "20:55"),
    // Allianz Stage
    mk("lo124",  "Khamari",                                           "Hip-Hop",             "allianz",       3, "16:20", "17:00"),
    mk("lo125",  "Spacey Jane",                                       "Rock",                "allianz",       3, "17:45", "18:30"),
    mk("lo126",  "Geese",                                             "Rock",                "allianz",       3, "19:30", "20:30"),
    // Airbnb Stage
    mk("lo127",  "Die Spitz",                                         "Rock",                "airbnb",        3, "15:30", "16:00"),
    mk("lo128",  "Quadeca",                                           "Hip-Hop",             "airbnb",        3, "16:30", "17:00"),
    mk("lo129",  "Sienna Spiro",                                      "—",                   "airbnb",        3, "17:30", "18:15"),
    mk("lo130",  "kwn",                                               "—",                   "airbnb",        3, "18:45", "19:30"),
    mk("lo131",  "Cameron Whitcomb",                                  "—",                   "airbnb",        3, "20:00", "20:45"),
    mk("lo132",  "DJ Trixie Mattel",                                  "Electronic",          "airbnb",        3, "21:15", "22:00"),
    // BMI Stage
    mk("lo133",  "INK",                                               "—",                   "bmi",           3, "15:50", "16:30"),
    mk("lo134",  "Calder Allen",                                      "—",                   "bmi",           3, "17:00", "17:40"),
    mk("lo135",  "Jae Stephens",                                      "—",                   "bmi",           3, "18:10", "18:50"),
    mk("lo136",  "Ryman",                                             "—",                   "bmi",           3, "19:20", "20:00"),
    // Bonus Tracks
    mk("lo137",  "The Second City: Lolla Made Us Do It",              "Comedy",              "bonus",         3, "15:15", "15:45"),
    mk("lo138",  "DJ Prince Lex",                                     "Talk / Special",      "bonus",         3, "16:45", "17:15"),
    mk("lo139",  "The Try Guys Eat The Menu",                         "Comedy",              "bonus",         3, "18:45", "19:15"),
    // Kidzapalooza
    mk("lo140",  "Special Guest: The Happiness Club",                 "Family",              "kidza",         3, "16:00", "16:30"),
    mk("lo141",  "Q Brothers",                                        "Hip-Hop",             "kidza",         3, "17:15", "17:45"),
    // ─────────── DAY 4 · Sunday Aug 2 ───────────
    // T-Mobile Stage
    mk("lo142",  "New Constellations",                                "—",                   "tmobile",       4, "13:15", "14:00"),
    mk("lo143",  "Adéla",                                             "—",                   "tmobile",       4, "15:00", "15:45"),
    mk("lo144",  "MUNA",                                              "Rock",                "tmobile",       4, "16:45", "17:45"),
    mk("lo145",  "beabadoobee",                                       "Rock",                "tmobile",       4, "18:45", "19:45"),
    mk("lo146",  "Tate McRae",                                        "Pop",                 "tmobile",       4, "20:45", "22:00"),
    // Bud Light Stage
    mk("lo147",  "Whatmore",                                          "Pop",                 "budlight",      4, "13:30", "14:15"),
    mk("lo148",  "Waylon Wyatt",                                      "Country",             "budlight",      4, "15:00", "16:00"),
    mk("lo149",  "YOASOBI",                                           "K-Pop",               "budlight",      4, "17:00", "18:00"),
    mk("lo150",  "Turnstile",                                         "Punk / Hardcore",     "budlight",      4, "19:00", "20:00"),
    mk("lo151",  "The xx",                                            "—",                   "budlight",      4, "20:45", "22:00"),
    // Perry's Stage
    mk("lo152",  "Zack Martino",                                      "Electronic",          "perrys",        4, "12:00", "12:30"),
    mk("lo153",  "Jackie Hollander",                                  "Electronic",          "perrys",        4, "12:45", "13:30"),
    mk("lo154",  "Westend",                                           "Electronic",          "perrys",        4, "13:45", "14:45"),
    mk("lo155",  "Riordan",                                           "Electronic",          "perrys",        4, "15:00", "16:00"),
    mk("lo156",  "Dombresky",                                         "Electronic",          "perrys",        4, "16:15", "17:15"),
    mk("lo157",  "Duke Dumont",                                       "Electronic",          "perrys",        4, "17:35", "18:35"),
    mk("lo158",  "Eli Brown",                                         "Electronic",          "perrys",        4, "18:50", "19:50"),
    mk("lo159",  "The Chainsmokers",                                  "Electronic",          "perrys",        4, "20:30", "21:45"),
    // Tito's Stage
    mk("lo160",  "Easy Honey",                                        "—",                   "titos",         4, "12:45", "13:30"),
    mk("lo161",  "Cruz Beckham and The Breakers",                     "—",                   "titos",         4, "14:15", "15:00"),
    mk("lo162",  "Wunderhorse",                                       "Rock",                "titos",         4, "16:00", "17:00"),
    mk("lo163",  "Hot Mulligan",                                      "Punk / Hardcore",     "titos",         4, "18:00", "19:00"),
    mk("lo164",  "Vandelux",                                          "Electronic",          "titos",         4, "20:00", "20:45"),
    // Allianz Stage
    mk("lo165",  "Squirrel Flower",                                   "Rock",                "allianz",       4, "12:30", "13:15"),
    mk("lo166",  "Destin Conrad",                                     "Hip-Hop",             "allianz",       4, "14:00", "15:00"),
    mk("lo167",  "Amber Mark",                                        "Pop",                 "allianz",       4, "15:45", "16:45"),
    mk("lo168",  "JADE",                                              "K-Pop",               "allianz",       4, "17:45", "18:45"),
    mk("lo169",  "aespa",                                             "K-Pop",               "allianz",       4, "19:45", "20:45"),
    // Airbnb Stage
    mk("lo170",  "Sunshine Benzi",                                    "—",                   "airbnb",        4, "12:00", "12:30"),
    mk("lo171",  "The Bends",                                         "—",                   "airbnb",        4, "12:50", "13:30"),
    mk("lo172",  "After",                                             "—",                   "airbnb",        4, "13:50", "14:30"),
    mk("lo173",  "Water From Your Eyes",                              "—",                   "airbnb",        4, "14:50", "15:30"),
    mk("lo174",  "INJI",                                              "Electronic",          "airbnb",        4, "16:00", "16:45"),
    mk("lo175",  "Los Retros",                                        "—",                   "airbnb",        4, "17:15", "18:00"),
    mk("lo176",  "Monaleo",                                           "Hip-Hop",             "airbnb",        4, "18:30", "19:15"),
    mk("lo177",  "Stella Lefty",                                      "—",                   "airbnb",        4, "19:45", "20:30"),
    mk("lo178",  "Ado",                                               "K-Pop",               "airbnb",        4, "21:15", "22:00"),
    // BMI Stage
    mk("lo179",  "Snacktime",                                         "—",                   "bmi",           4, "13:00", "13:40"),
    mk("lo180",  "Surfing For Daisy",                                 "—",                   "bmi",           4, "14:10", "14:50"),
    mk("lo181",  "Case Oats",                                         "Country",             "bmi",           4, "15:20", "16:00"),
    mk("lo182",  "Justine Skye",                                      "Hip-Hop",             "bmi",           4, "16:30", "17:10"),
    mk("lo183",  "Porch Light",                                       "—",                   "bmi",           4, "17:40", "18:20"),
    mk("lo184",  "Will Swinton",                                      "—",                   "bmi",           4, "18:50", "19:30"),
    // Bonus Tracks
    mk("lo185",  "DJ Prince Lex",                                     "Talk / Special",      "bonus",         4, "13:30", "14:00"),
    mk("lo186",  "Stella Lefty with Davis Burleson",                  "Talk / Special",      "bonus",         4, "15:15", "15:30"),
    mk("lo187",  "Cruz Beckham x Mack",                               "Talk / Special",      "bonus",         4, "15:30", "15:45"),
    mk("lo188",  "John Walt Foundation: Chicago's Got Next",          "Youth Showcase",      "bonus",         4, "17:00", "17:30"),
    mk("lo189",  "DJ Prince Lex",                                     "Talk / Special",      "bonus",         4, "18:00", "18:30"),
    mk("lo190",  "Shout Section ft. Tatum Langley",                   "Talk / Special",      "bonus",         4, "19:00", "19:45"),
    // Kidzapalooza
    mk("lo191",  "Flor Bromley",                                      "Family",              "kidza",         4, "12:00", "12:30"),
    mk("lo192",  "Lucky Diaz",                                        "Family",              "kidza",         4, "13:30", "14:00"),
    mk("lo193",  "Q Brothers",                                        "Hip-Hop",             "kidza",         4, "15:00", "15:30"),
    mk("lo194",  "Special Guest: The Happiness Club",                 "Family",              "kidza",         4, "16:00", "16:30"),
    mk("lo195",  "Mega Ran",                                          "Hip-Hop",             "kidza",         4, "17:15", "17:45"),
  ];

  const CONFIG = {
    id: "lollapalooza-2026",
    name: "Lollapalooza 2026",
    shortName: "Lolla 2026",
    brand: "Lollapalooza",
    tagline: "Four days in Grant Park",
    location: "Grant Park · Chicago, IL",
    locationShort: "Grant Park",
    dates: "Jul 30 – Aug 2, 2026",
    year: 2026,
    // gates day 1 (12:00 CDT) -> close of the final day (22:00 CDT)
    startMs: Date.UTC(2026, 6, 30, 17, 0, 0),
    endMs:   Date.UTC(2026, 7, 3, 3, 0, 0),
    tz: "America/Chicago",
    tzAbbr: "CDT",
    utcOffsetHours: -5,
    dayDates: {
      1: { y: 2026, m: 6, d: 30, name: "Thursday", short: "THU",
           midnightUtc: Date.UTC(2026, 6, 30, 5, 0, 0) },
      2: { y: 2026, m: 6, d: 31, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 6, 31, 5, 0, 0) },
      3: { y: 2026, m: 7, d: 1, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 7, 1, 5, 0, 0) },
      4: { y: 2026, m: 7, d: 2, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 7, 2, 5, 0, 0) },
    },
    // sunrise-sunset.org at the venue centroid, rendered in CDT.
    sunTimes: {
      1: { rise: "05:41", set: "20:12" },
      2: { rise: "05:42", set: "20:11" },
      3: { rise: "05:43", set: "20:10" },
      4: { rise: "05:44", set: "20:09" },
    },
    // No festival-operated shuttle published for 2026; field omitted rather than guessed.
    gps: { lat: 41.8755, lng: -87.6198, onSiteRadiusMi: 0.5 },
    rideshareGps: {
      lat: 41.8723, lng: -87.6245,
      label: "Michigan & Balbo · Rideshare Pickup",
      note:  "Columbus Drive is closed through the park. Exit west to Michigan Ave.",
    },
    venue: {
      name: "Grant Park",
      address: "337 E Randolph St, Chicago, IL 60601",
      festivalBounds: { north: 41.8809, south: 41.8701,
                        west: -87.6233, east: -87.6155 },
    },
    // Every anchor is the stage's own authored lat/lng, so the affine in
    // map.jsx reproduces each stage's x/y exactly. Verified by scripts/verify.mjs.
    gpsAnchors: [
      // Ordered so the leading triple spans the largest triangle — map.jsx's
      // _solveMapAffine reads only the first three, and a thin triple is unstable.
      { stageId: "tmobile",       lat: 41.87963, lng: -87.61910 },  // osm
      { stageId: "perrys",        lat: 41.87229, lng: -87.62151 },  // osm
      { stageId: "kidza",         lat: 41.87300, lng: -87.61780 },  // prov
      { stageId: "budlight",      lat: 41.87139, lng: -87.61887 },  // osm
      { stageId: "titos",         lat: 41.87580, lng: -87.61897 },  // osm
      { stageId: "allianz",       lat: 41.87450, lng: -87.62060 },  // prov
      { stageId: "airbnb",        lat: 41.87720, lng: -87.62030 },  // prov
      { stageId: "bmi",           lat: 41.87850, lng: -87.62080 },  // prov
      { stageId: "bonus",         lat: 41.87350, lng: -87.62100 },  // prov
    ],
    weatherEndpoint: "https://api.weather.gov/points/41.88,-87.62",
    mainStageId: "tmobile",
    // Generated abstract overlay, NOT the official patron map — that art is
    // rights-restricted and is never copied into this repo (lostlands-2026.jpg
    // precedent). Authored in the same 0-100 frame as the stages above.
    mapImage: "lolla-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "park",
    // The overlay prints no stage names, so pills carry them.
    mapPrintsStageNames: false,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["lollapalooza-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, accent: "#f472b6", emoji: "🌆", region: "North America" },
  };
})();

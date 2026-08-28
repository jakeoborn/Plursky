// ═══════════════════════════════════════════════════════════════════════
// GOVERNORS BALL 2026 — Flushing Meadows Corona Park · Queens, NY
// Jun 5–7, 2026
// ═══════════════════════════════════════════════════════════════════════
// RETROSPECTIVE BUILD. This festival is in the past, so every field below is
// published historical fact rather than a forecast — hence available: true and
// no provisional set-time flags. Sources are cited per block.
//
// SOURCE lineup + set times: official daily schedule graphics,
//   governorsballmusicfestival.com/schedule (GB26-Schedule-Friday / -Sat-06.06-V2 /
//   -Sun-06.06A-WEB), accessed 2026-08-28.
// SOURCE hours: gates 11:30am, close 10pm — support.govball.com "What are the dates &
//   hours of Gov Ball?".
// SOURCE Unisphere position: OpenStreetMap.
//
// SATURDAY JUNE 6 ENDED EARLY. A severe thunderstorm (60mph gusts, hail) cut the day:
// Kali Uchis and Amyl and the Sniffers were cancelled, Stray Kids moved from 8:30 to
// 6:15, Major Lazer moved to close the Snapchat stage, and Blood Orange was rescheduled
// to Sunday 4:00. The graphics linked above are the REVISED official versions, so the
// day-2 lineup below is what actually happened, not what was originally billed.
// (Pollstar 2026-06-06; BrooklynVegan 2026-06-07.)
// Two graphics print a headliner start with no end (Lorde 8:30, A$AP Rocky 8:45); both
// are the closing set, so the end is the day's 10pm curfew.
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
// Round-trip residual for this festival: 0.000 grid units (~0.0 m),
// which is entirely the cost of printing x/y to one decimal for readability.
(function () {
  "use strict";

  const STAGES = [
    { id: "verizon",  name: "GovBallNYC", short: "GOVBALL", color: "#ec4899",
      x: 46.3, y: 71.9, size: 1.7, desc: "Main field · headliners",
      vibe: "The Main Event", vibeNote: "Presented by Verizon. Everything closes here — Lorde, Stray Kids, Rocky. Get in early or watch from the hill.", peak: "18:00–22:00" },
    { id: "snapchat", name: "Snapchat Stage", short: "SNAP", color: "#facc15",
      x: 61, y: 31.2, size: 1.3, desc: "North field · co-headliners",
      vibe: "The Other Big One", vibeNote: "Second-biggest stage and it books like the first. Alternating sets with the main so you can bounce.", peak: "17:00–21:00" },
    { id: "grove",    name: "The Grove", short: "GROVE", color: "#22c55e",
      x: 18.3, y: 48.4, size: 1, desc: "Tree line · discovery",
      vibe: "Under the Trees", vibeNote: "Shade, grass, and the band you'll be telling people about in October.", peak: "14:00–20:00" },
  ];

  const AMENITIES = [
    { id: "govball1", type: "water", label: "Hydration Station", x: 34.1, y: 59.4 },
    { id: "govball2", type: "water", label: "Hydration Station", x: 48.8, y: 34.4 },
    { id: "govball3", type: "med", label: "Medical", x: 28, y: 50 },
    { id: "govball4", type: "toilet", label: "Restrooms", x: 56.1, y: 65.6 },
    { id: "govball5", type: "toilet", label: "Restrooms", x: 36.6, y: 26.6 },
    { id: "govball6", type: "food", label: "Food Village", x: 40.2, y: 45.3 },
    { id: "govball7", type: "info", label: "Info / Lost & Found", x: 24.4, y: 75 },
  ];

  // tier: 3 = headline slot (19:00+), 2 = prime (16:00–18:59), 1 = earlier.
  const mk = (id, name, genre, stage, day, start, end) => {
    const h = parseInt(start.split(":")[0], 10);
    const tier = h >= 19 || h < 6 ? 3 : h >= 16 ? 2 : 1;
    return { id, name, genre, country: "—", stage, day, start, end, tier,
      img: `linear-gradient(135deg, ${(STAGES.find(s => s.id === stage) || STAGES[0]).color}, #1a0a28)`,
      bio: `Played Governors Ball 2026.` };
  };

  const ARTISTS = [
    // ─────────── DAY 1 · Friday Jun 5 ───────────
    // GovBallNYC
    mk("go1",    "School of Rock Queens",                             "Youth Showcase",      "verizon",       1, "12:00", "12:30"),
    mk("go2",    "Whatmore",                                          "Pop",                 "verizon",       1, "13:00", "13:30"),
    mk("go3",    "Audrey Hobert",                                     "Pop",                 "verizon",       1, "14:00", "14:30"),
    mk("go4",    "Del Water Gap",                                     "—",                   "verizon",       1, "15:15", "16:00"),
    mk("go5",    "Mariah the Scientist",                              "Hip-Hop",             "verizon",       1, "16:45", "17:30"),
    mk("go6",    "KATSEYE",                                           "K-Pop",               "verizon",       1, "18:35", "19:30"),
    mk("go7",    "Lorde",                                             "Pop",                 "verizon",       1, "20:30", "22:00"),
    // Snapchat Stage
    mk("go8",    "The Backfires",                                     "—",                   "snapchat",      1, "12:30", "13:00"),
    mk("go9",    "Absolutely",                                        "—",                   "snapchat",      1, "13:30", "14:00"),
    mk("go10",   "King Princess",                                     "—",                   "snapchat",      1, "14:30", "15:15"),
    mk("go11",   "The Dare",                                          "—",                   "snapchat",      1, "16:00", "16:45"),
    mk("go12",   "Pierce the Veil",                                   "—",                   "snapchat",      1, "17:30", "18:30"),
    mk("go13",   "Baby Keem",                                         "Hip-Hop",             "snapchat",      1, "19:30", "20:30"),
    // The Grove
    mk("go14",   "Kids Rock for Kids",                                "Youth Showcase",      "grove",         1, "12:15", "12:45"),
    mk("go15",   "Old Mervs",                                         "—",                   "grove",         1, "13:15", "13:45"),
    mk("go16",   "Confidence Man",                                    "Rock",                "grove",         1, "14:15", "15:00"),
    mk("go17",   "Arcy Drive",                                        "—",                   "grove",         1, "15:30", "16:15"),
    mk("go18",   "Turnover",                                          "Rock",                "grove",         1, "16:45", "17:30"),
    mk("go19",   "The Beths",                                         "Rock",                "grove",         1, "18:00", "19:00"),
    mk("go20",   "Flipturn",                                          "—",                   "grove",         1, "19:30", "20:30"),
    // ─────────── DAY 2 · Saturday Jun 6 ───────────
    // GovBallNYC
    mk("go21",   "Jimmyboy",                                          "—",                   "verizon",       2, "12:00", "12:30"),
    mk("go22",   "Radio Free Alice",                                  "—",                   "verizon",       2, "13:00", "13:30"),
    mk("go23",   "Wisp",                                              "Rock",                "verizon",       2, "14:00", "14:30"),
    mk("go24",   "2hollis",                                           "Hip-Hop",             "verizon",       2, "15:15", "15:55"),
    mk("go25",   "Wet Leg",                                           "Rock",                "verizon",       2, "16:45", "17:30"),
    mk("go26",   "Stray Kids",                                        "K-Pop",               "verizon",       2, "18:15", "19:30"),
    // Snapchat Stage
    mk("go27",   "Chanpan",                                           "—",                   "snapchat",      2, "12:30", "13:00"),
    mk("go28",   "Flowerovlove",                                      "Pop",                 "snapchat",      2, "13:30", "14:00"),
    mk("go29",   "Spacey Jane",                                       "Rock",                "snapchat",      2, "14:30", "15:15"),
    mk("go30",   "Ravyn Lenae",                                       "Hip-Hop",             "snapchat",      2, "16:00", "16:45"),
    mk("go31",   "Major Lazer",                                       "Electronic",          "snapchat",      2, "17:30", "18:15"),
    // The Grove
    mk("go32",   "Jade LeMac",                                        "Pop",                 "grove",         2, "12:15", "12:45"),
    mk("go33",   "Villanelle",                                        "—",                   "grove",         2, "13:15", "13:45"),
    mk("go34",   "Midnight Generation",                               "—",                   "grove",         2, "14:15", "15:00"),
    mk("go35",   "Jane Remover",                                      "Rock",                "grove",         2, "15:50", "16:30"),
    mk("go36",   "Snow Strippers",                                    "Rock",                "grove",         2, "16:50", "17:35"),
    mk("go37",   "Thee Sacred Souls",                                 "Rock",                "grove",         2, "18:00", "19:00"),
    // ─────────── DAY 3 · Sunday Jun 7 ───────────
    // GovBallNYC
    mk("go38",   "Evening Elephants",                                 "—",                   "verizon",       3, "11:25", "11:55"),
    mk("go39",   "Lexa Gates",                                        "—",                   "verizon",       3, "12:30", "13:00"),
    mk("go40",   "Slayyyter",                                         "Pop",                 "verizon",       3, "13:45", "14:30"),
    mk("go41",   "Holly Humberstone",                                 "Pop",                 "verizon",       3, "15:15", "16:00"),
    mk("go42",   "Geese",                                             "Rock",                "verizon",       3, "16:45", "17:45"),
    mk("go43",   "Dominic Fike",                                      "Pop",                 "verizon",       3, "18:45", "19:45"),
    mk("go44",   "A$AP Rocky",                                        "Hip-Hop",             "verizon",       3, "20:45", "22:00"),
    // Snapchat Stage
    mk("go45",   "Hemlocke Springs",                                  "Pop",                 "snapchat",      3, "11:55", "12:30"),
    mk("go46",   "Rachel Chinouriri",                                 "Pop",                 "snapchat",      3, "13:00", "13:45"),
    mk("go47",   "Japanese Breakfast",                                "—",                   "snapchat",      3, "14:30", "15:15"),
    mk("go48",   "Blood Orange",                                      "Hip-Hop",             "snapchat",      3, "16:00", "16:45"),
    mk("go49",   "Clipse",                                            "Hip-Hop",             "snapchat",      3, "17:45", "18:45"),
    mk("go50",   "Jennie",                                            "K-Pop",               "snapchat",      3, "19:45", "20:45"),
    // The Grove
    mk("go51",   "School of Rock New York",                           "Youth Showcase",      "grove",         3, "11:30", "12:00"),
    mk("go52",   "Hannah Jadagu",                                     "—",                   "grove",         3, "12:30", "13:00"),
    mk("go53",   "After",                                             "—",                   "grove",         3, "13:30", "14:00"),
    mk("go54",   "Between Friends",                                   "—",                   "grove",         3, "14:30", "15:15"),
    mk("go55",   "Fcukers",                                           "—",                   "grove",         3, "15:45", "16:30"),
    mk("go56",   "Khamari",                                           "Hip-Hop",             "grove",         3, "17:00", "17:45"),
    mk("go57",   "Hot Mulligan",                                      "Punk / Hardcore",     "grove",         3, "18:15", "19:15"),
    mk("go58",   "Freddie Gibbs & The Alchemist",                     "Hip-Hop",             "grove",         3, "19:45", "20:45"),
  ];

  const CONFIG = {
    id: "governors-ball-2026",
    name: "Governors Ball 2026",
    shortName: "Gov Ball",
    brand: "Governors Ball",
    tagline: "Three days in Flushing Meadows",
    location: "Flushing Meadows Corona Park · Queens, NY",
    locationShort: "Flushing Meadows",
    dates: "Jun 5–7, 2026",
    year: 2026,
    // gates day 1 (11:30 EDT) -> close of the final day (22:00 EDT)
    startMs: Date.UTC(2026, 5, 5, 15, 30, 0),
    endMs:   Date.UTC(2026, 5, 8, 2, 0, 0),
    tz: "America/New_York",
    tzAbbr: "EDT",
    utcOffsetHours: -4,
    dayDates: {
      1: { y: 2026, m: 5, d: 5, name: "Friday", short: "FRI",
           midnightUtc: Date.UTC(2026, 5, 5, 4, 0, 0) },
      2: { y: 2026, m: 5, d: 6, name: "Saturday", short: "SAT",
           midnightUtc: Date.UTC(2026, 5, 6, 4, 0, 0) },
      3: { y: 2026, m: 5, d: 7, name: "Sunday", short: "SUN",
           midnightUtc: Date.UTC(2026, 5, 7, 4, 0, 0) },
    },
    // sunrise-sunset.org at the venue centroid, rendered in EDT.
    sunTimes: {
      1: { rise: "05:23", set: "20:24" },
      2: { rise: "05:22", set: "20:25" },
      3: { rise: "05:22", set: "20:25" },
    },
    // No festival-operated shuttle published for 2026; field omitted rather than guessed.
    gps: { lat: 40.7476, lng: -73.8402, onSiteRadiusMi: 0.4 },
    rideshareGps: {
      lat: 40.7453, lng: -73.8456,
      label: "Grand Central Pkwy · Rideshare Pickup",
      note:  "No drop-off inside the park. Walk west past the Unisphere.",
    },
    venue: {
      name: "Flushing Meadows Corona Park",
      address: "Flushing Meadows Corona Park, Queens, NY 11368",
      festivalBounds: { north: 40.7508, south: 40.7444,
                        west: -73.8438, east: -73.8356 },
    },
    // Every anchor is the stage's own authored lat/lng, so the affine in
    // map.jsx reproduces each stage's x/y exactly. Verified by scripts/verify.mjs.
    gpsAnchors: [
      // Ordered so the leading triple spans the largest triangle — map.jsx's
      // _solveMapAffine reads only the first three, and a thin triple is unstable.
      { stageId: "verizon",       lat: 40.74620, lng: -73.84000 },  // prov
      { stageId: "snapchat",      lat: 40.74880, lng: -73.83880 },  // prov
      { stageId: "grove",         lat: 40.74770, lng: -73.84230 },  // prov
    ],
    weatherEndpoint: "https://api.weather.gov/points/40.75,-73.84",
    mainStageId: "verizon",
    // Generated abstract overlay, NOT the official patron map — that art is
    // rights-restricted and is never copied into this repo (lostlands-2026.jpg
    // precedent). Authored in the same 0-100 frame as the stages above.
    mapImage: "govball-2026.svg",
    mapStyle: "image-overlay",
    mapTheme: "park",
    // The overlay prints no stage names, so pills carry them.
    mapPrintsStageNames: false,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["governors-ball-2026"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, accent: "#ec4899", emoji: "🗽", region: "North America" },
  };
})();

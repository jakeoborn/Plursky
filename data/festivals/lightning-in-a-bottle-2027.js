// ═══════════════════════════════════════════════════════════════════════
// LIGHTNING IN A BOTTLE 2027 — Buena Vista Aquatic Recreational Area, CA
// Wed May 26 – Sun May 30, 2027. Do LaB.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names are official. Days, stages, set times, a
// 2027 map and sun times are NOT published, and none are invented below.
// This was a gated preview in data.jsx (added 2026-11-17).
//
// ── SOURCE (observed 2026-11-23) ──
// libfestival.org/lineup carries the 2027 lineup as an interactive poster
// whose names come from the page's own JSON catalog (script#lib27p-catalog):
// 69 billings over 62 poster rows. Every one of the 69 also appears on the
// official poster image LiB2027-Lineup-Poster-web-2000x2500.jpg. The poster's
// "????????" coming-soon tape is not a name and is not loaded.
// The lineup has no day split, so every row has day: null (the Coachella
// 2027 day-null convention).
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: one row per catalog billing, exactly as the catalog prints it,
//     casing included (the official text is mixed case). "+", "&" and
//     parentheses never split a billing.
//   - id: "lib27-" + the registry key (foldKey) of the billing. No billing
//     repeats.
//
// ── DATES ──
// libfestival.org (read 2026-11-17): "Lightning in a Bottle returns May
// 26–30, 2027 to Buena Vista Lake, CA". California is on PDT (UTC-7).
// ── VENUE ──
// libfestival.org (read 2026-11-23): "Buena Vista Aquatic Recreational Area,
// 13601 Ironbark Road, Bakersfield, CA 93311-9478". gps: that address via
// Nominatim (OpenStreetMap way 10407537), 2026-11-23: 35.2310110,
// -119.2564780. OSM has no polygon for the recreation area to size a radius
// against, so the 1-mile on-site radius is the FK/Ubbi default.
(function () {
  "use strict";

  const PDT = -7;
  const STAGES = [];
  const AMENITIES = [];
  const mk = (id, name) => ({
    id, name, genre: "—", country: "—",
    stage: null, day: null, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #f59e0b, #2a1a03)",
    bio: "Playing Lightning in a Bottle 2027, May 26–30 at Buena Vista Lake. " +
         "Day, stage and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("lib27-justice-dj-set", "Justice (DJ Set)"),
    mk("lib27-jungle", "Jungle"),
    mk("lib27-sofi-tukker", "SOFI TUKKER"),
    mk("lib27-pretty-lights", "Pretty Lights"),
    mk("lib27-amelie-lens", "Amelie Lens"),
    mk("lib27-basement-jaxx", "Basement Jaxx"),
    mk("lib27-rl-grime", "RL Grime"),
    mk("lib27-whethan", "Whethan"),
    mk("lib27-honey-dijon", "Honey Dijon"),
    mk("lib27-dj-habibeats", "DJ Habibeats"),
    mk("lib27-carlita", "Carlita"),
    mk("lib27-notion", "NOTION"),
    mk("lib27-fcukers-djs", "Fcukers (DJs)"),
    mk("lib27-nimino", "nimino"),
    mk("lib27-vandelux", "Vandelux"),
    mk("lib27-chloe-caillet", "Chloé Caillet"),
    mk("lib27-the-glitch-mob", "The Glitch Mob"),
    mk("lib27-hybrid-minds", "Hybrid Minds"),
    mk("lib27-andy-c", "Andy C"),
    mk("lib27-baby-j", "Baby J"),
    mk("lib27-dj-minx", "DJ Minx"),
    mk("lib27-digital-mystikz-mala-coki", "Digital Mystikz (Mala + Coki)"),
    mk("lib27-mary-droppinz", "Mary Droppinz"),
    mk("lib27-haai", "HAAi"),
    mk("lib27-effin", "Effin"),
    mk("lib27-distinct-motive", "Distinct Motive"),
    mk("lib27-teed", "TEED"),
    mk("lib27-rafael", "Rafael"),
    mk("lib27-x-club", "X CLUB."),
    mk("lib27-bushbaby", "bushbaby"),
    mk("lib27-luke-alessi", "Luke Alessi"),
    mk("lib27-atrip", "ATRIP"),
    mk("lib27-tinzo-jojo", "Tinzo + Jojo"),
    mk("lib27-dj-dave", "DJ_Dave"),
    mk("lib27-leon-vynehall", "Leon Vynehall"),
    mk("lib27-jackie-hollander", "Jackie Hollander"),
    mk("lib27-dirtwire", "Dirtwire"),
    mk("lib27-eliza-rose", "Eliza Rose"),
    mk("lib27-omri", "OMRI."),
    mk("lib27-cain-culto", "Cain Culto"),
    mk("lib27-champion", "Champion"),
    mk("lib27-sippy", "SIPPY"),
    mk("lib27-nikita-the-wicked", "Nikita, the Wicked"),
    mk("lib27-saint-ludo", "Saint Ludo"),
    mk("lib27-bridge", "BRIDGE"),
    mk("lib27-a-club-called-rhonda", "A Club Called Rhonda"),
    mk("lib27-jennifer-loveless", "Jennifer Loveless"),
    mk("lib27-en-vy", "En:vy"),
    mk("lib27-mia-koden", "Mia Koden"),
    mk("lib27-neumonic", "Neumonic"),
    mk("lib27-dr-chaii", "Dr. Chaii"),
    mk("lib27-vita", "VITA"),
    mk("lib27-klo", "Klo"),
    mk("lib27-tiffy-vera", "Tiffy Vera"),
    mk("lib27-arthi", "Arthi"),
    mk("lib27-matisa", "Matisa"),
    mk("lib27-bad-juuju", "bad juuju"),
    mk("lib27-biishop", "BiiSHOP"),
    mk("lib27-carre", "Carré"),
    mk("lib27-danni-g", "Danni G"),
    mk("lib27-dj-kerry", "DJ Kerry"),
    mk("lib27-riche", "RICHE"),
    mk("lib27-sana-sana-musica", "Sana Sana Música"),
    mk("lib27-saqib", "Saqib"),
    mk("lib27-scarlett-o-malley", "Scarlett O'Malley"),
    mk("lib27-soraya", "Soraya"),
    mk("lib27-spektrum-and-adam", "Spektrum & Adam"),
    mk("lib27-techno-tupac", "Techno Tupac"),
    mk("lib27-womb-tang", "Womb Tang"),
  ];

  const day = (d, name, short) => ({ y: 2027, m: 4, d, name, short, midnightUtc: Date.UTC(2027, 4, d, -PDT, 0, 0) });
  const CONFIG = {
    id: "lightning-in-a-bottle-2027",
    lineupSource: { url: "https://www.libfestival.org/lineup", observedAt: "2026-11-23", official: true },
    officialEvent: { website: "https://www.libfestival.org/", observedAt: "2026-11-17" },
    name: "Lightning in a Bottle 2027",
    shortName: "LiB",
    brand: "Lightning in a Bottle",
    tagline: "Five days of music, art and camping by Do LaB",
    location: "Buena Vista Lake, CA",
    locationShort: "Buena Vista Lake",
    dates: "May 26–30, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://www.libfestival.org/", observedAt: "2026-11-17" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    startMs: Date.UTC(2027, 4, 26, -PDT, 0, 0),    // Wed May 26 00:00 local
    endMs: Date.UTC(2027, 4, 31, 6 - PDT, 0, 0),   // Mon May 31 06:00 local, a bound
    tz: "America/Los_Angeles",
    tzAbbr: "PDT",
    utcOffsetHours: PDT,
    dayDates: {
      1: day(26, "Wednesday", "WED"),
      2: day(27, "Thursday", "THU"),
      3: day(28, "Friday", "FRI"),
      4: day(29, "Saturday", "SAT"),
      5: day(30, "Sunday", "SUN"),
    },
    gps: { lat: 35.2310110, lng: -119.2564780, onSiteRadiusMi: 1 },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["lightning-in-a-bottle-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#f59e0b", emoji: "⚡", region: "North America" },
  };
})();

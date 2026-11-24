// ═══════════════════════════════════════════════════════════════════════
// FORBIDDEN KINGDOM 2027 — Central Florida Fairgrounds · Orlando, FL
// Fri Apr 23 – Sun Apr 25, 2027. Insomniac.
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names are official. Days, stages, set times, a
// 2027 map and sun times are NOT published, and none are invented below.
// This was a gated preview in data.jsx (added 2026-11-10).
//
// ── SOURCE (observed 2026-11-23) ──
// forbiddenkingdomfestival.com/lineup/, section "2027 Lineup": a text list,
// one <li> per billing, each artist a link carrying data-artist-name. The
// same section shows the official poster
// fk_2027_mk_lu_full_soc_no_cta_1080x1350_r01.png (uploaded 2026-11-09).
// The page lists the lineup alphabetically with no day split, so every row
// has day: null (the Coachella 2027 day-null convention).
// Counts: the page prints 118 billings. 117 are loaded here.
// UNRESOLVED, LEFT OUT: one billing displays as "Onaroi* Onara B2B roi*)"
// (an unbalanced parenthesis), while its link's data-artist-name reads
// "Onara&roi*". The official text disagrees with itself, so it is not loaded
// until the page settles it (the K4OS / KENYA2?HZ rule). roi* is still
// loaded as printed inside "Port Zero presents: INFEKT B2B MODAL NODES B2B
// roi*".
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: one row per printed billing, exactly as the page's text prints
//     it, casing included. The page prints mixed case, so the casing is the
//     festival's own and no registry re-casing is applied. "B2B", "x",
//     "presents" and "&" never split a billing.
//   - id: "fk27-" + the registry key (foldKey) of the printed billing. No
//     billing repeats, so no -d<day> suffix is needed.
//
// ── DATES ──
// Insomniac's press release (press.insomniac.com, read 2026-11-10): "April
// 23-25, 2027". Orlando is on EDT (UTC-4) on those dates.
// ── VENUE ──
// gps: OpenStreetMap relation 1161235 "Central Florida Fairgrounds"
// (leisure=fairgrounds), via Nominatim 2026-11-23: 28.5565728, -81.4395937.
// Its bounding box spans about 0.8 km, so a 1-mile on-site radius covers it.
(function () {
  "use strict";

  const EDT = -4;
  const STAGES = [];
  const AMENITIES = [];
  const mk = (id, name) => ({
    id, name, genre: "—", country: "—",
    stage: null, day: null, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #a3e635, #1a2e05)",
    bio: "Playing Forbidden Kingdom 2027, April 23–25 in Orlando. " +
         "Day, stage and set time are not published yet.",
    provisional: true,
  });

  const ARTISTS = [
    mk("fk27-2dy4", "2DY4"),
    mk("fk27-9b49", "9B49"),
    mk("fk27-a-hundred-drums-b2b-zen-selekta", "A Hundred Drums B2B Zen Selekta"),
    mk("fk27-advptive-b2b-dubba-d", "Advptive B2B Dubba D"),
    mk("fk27-aeon-mode", "ÆON:MODE"),
    mk("fk27-ag", "AG"),
    mk("fk27-all-the-reason", "All The Reason"),
    mk("fk27-alleycvt", "ALLEYCVT"),
    mk("fk27-alpha-omega-ac13-and-reaper", "Alpha:Omega (AC13 & Reaper)"),
    mk("fk27-arcando", "Arcando"),
    mk("fk27-atliens", "ATLiens"),
    mk("fk27-avello", "AVELLO"),
    mk("fk27-bagha", "Bagha"),
    mk("fk27-barrowz", "BARROWZ"),
    mk("fk27-beastboi", "beastboi."),
    mk("fk27-big-florida", "Big Florida"),
    mk("fk27-black-tiger-sex-machine", "Black Tiger Sex Machine"),
    mk("fk27-bloom", "Bloom"),
    mk("fk27-blossom", "Blossom"),
    mk("fk27-bonker", "Bonker"),
    mk("fk27-bonkers", "Bonkers"),
    mk("fk27-bynz-b2b-inqu", "Bynz B2B Inqu"),
    mk("fk27-casey-club", "Casey Club"),
    mk("fk27-celo", "CELO"),
    mk("fk27-chassi", "Chassi"),
    mk("fk27-chozen", "CHOZEN"),
    mk("fk27-codd-dubz", "Codd Dubz"),
    mk("fk27-costa", "Costa"),
    mk("fk27-crankdat", "Crankdat"),
    mk("fk27-crizzly", "Crizzly"),
    mk("fk27-cyclops", "Cyclops"),
    mk("fk27-debbie-check", "Debbie Check"),
    mk("fk27-discovery-project", "Discovery Project"),
    mk("fk27-dj-kang", "DJ Kang"),
    mk("fk27-dpmo-presents-beastboi-b2b-funtcase-b2b-versa", "DPMO Presents: beastboi. B2B FuntCase B2B Versa"),
    mk("fk27-excision", "Excision"),
    mk("fk27-fieldz-b2b-ophion", "Fieldz B2B Ophion"),
    mk("fk27-finnuh", "Finnuh"),
    mk("fk27-flozone-b2b-stvsh", "Flozone B2B STVSH"),
    mk("fk27-gamma", "GAMMA"),
    mk("fk27-ghengar", "Ghengar"),
    mk("fk27-gorillat-sunset-set", "GorillaT (Sunset Set)"),
    mk("fk27-grabbitz", "Grabbitz"),
    mk("fk27-hades-x-persephone", "Hades x Persephone"),
    mk("fk27-hekler", "Hekler"),
    mk("fk27-hershe", "HerShe"),
    mk("fk27-hexx", "HEXX"),
    mk("fk27-hol", "HOL!"),
    mk("fk27-hostage-situation", "Hostage Situation"),
    mk("fk27-hurtbox", "Hurtbox"),
    mk("fk27-inaktiv", "Inaktiv"),
    mk("fk27-infekt", "INFEKT"),
    mk("fk27-izzy-vadim-b2b-warlord", "Izzy Vadim B2B Warlord"),
    mk("fk27-jessica-audiffred", "Jessica Audiffred"),
    mk("fk27-jkyl-and-hyde", "Jkyl & Hyde"),
    mk("fk27-joust", "JOUST"),
    mk("fk27-justin-hawkes", "Justin Hawkes"),
    mk("fk27-kai-wachi", "Kai Wachi"),
    mk("fk27-klo", "Klo"),
    mk("fk27-lagrimas", "Lagrimas"),
    mk("fk27-layz", "LAYZ"),
    mk("fk27-level-up", "Level Up"),
    mk("fk27-levity", "Levity"),
    mk("fk27-lucas-larvenz", "Lucas Larvenz"),
    mk("fk27-mad-dubz", "Mad Dubz"),
    mk("fk27-the-masquerade", "The Masquerade"),
    mk("fk27-maylay-b2b-natty-lou", "MAYLAY B2B Natty Lou"),
    mk("fk27-mile32", "Mile32"),
    mk("fk27-moceans", "MOCEANS"),
    mk("fk27-modal-nodes", "MODAL NODES"),
    mk("fk27-mvrda", "Mvrda"),
    mk("fk27-mvtr", "MVTR"),
    mk("fk27-mythm", "Mythm"),
    mk("fk27-neotek", "Neotek"),
    mk("fk27-novuh-b2b-wohlsy", "Novuh B2B Wohlsy"),
    mk("fk27-otsukare", "Otsukare"),
    mk("fk27-ozztin", "OZZTIN"),
    mk("fk27-p-money-x-whiney", "P Money x Whiney"),
    mk("fk27-papajay", "papajay"),
    mk("fk27-perry-wayne", "Perry Wayne"),
    mk("fk27-port-zero-presents-infekt-b2b-modal-nodes-b2b-roi", "Port Zero presents: INFEKT B2B MODAL NODES B2B roi*"),
    mk("fk27-pretty-sweet", "Pretty Sweet"),
    mk("fk27-primate", "Primate"),
    mk("fk27-raaket", "Raaket"),
    mk("fk27-ray-volpe", "Ray Volpe"),
    mk("fk27-the-resistance", "The Resistance"),
    mk("fk27-richard-finger", "Richard Finger"),
    mk("fk27-riot-ten", "Riot Ten"),
    mk("fk27-ruvlo", "RUVLO"),
    mk("fk27-s-y-n-svdden-death-yvm3-nimda", "S.Y.N (Svdden Death, yvm3, NIMDA)"),
    mk("fk27-samplifire", "Samplifire"),
    mk("fk27-sando", "SANDO"),
    mk("fk27-seeing-dubble", "Seeing Dubble"),
    mk("fk27-sfam", "sfam"),
    mk("fk27-shinobi", "Shinobi"),
    mk("fk27-shiverz", "Shiverz"),
    mk("fk27-shosh", "Shosh"),
    mk("fk27-sloth", "Sloth"),
    mk("fk27-spoone", "Spoone"),
    mk("fk27-sqishi", "Sqishi"),
    mk("fk27-stayns", "STAYNS"),
    mk("fk27-steller", "Steller"),
    mk("fk27-sumthin-sumthin", "sumthin sumthin"),
    mk("fk27-three-pux", "Three Pux"),
    mk("fk27-tynan", "Tynan"),
    mk("fk27-usaybflow", "Usaybflow"),
    mk("fk27-vanirz-b2b-yaki", "Vanirz B2B Yaki"),
    mk("fk27-vicky-b", "Vicky B"),
    mk("fk27-vipete", "Vipete"),
    mk("fk27-vyhara", "Vyhara"),
    mk("fk27-wolfie", "Wolfie"),
    mk("fk27-wook-appruvd", "Wook Appruvd"),
    mk("fk27-wooli", "Wooli"),
    mk("fk27-xo-jackie-boi-b2b-xclvsiv", "Xó (Jackie Boi B2B Xclvsiv)"),
    mk("fk27-ydg", "YDG"),
    mk("fk27-zoey808", "Zoey808"),
    mk("fk27-zouth", "Zouth"),
  ];

  const day = (d, name, short) => ({ y: 2027, m: 3, d, name, short, midnightUtc: Date.UTC(2027, 3, d, -EDT, 0, 0) });
  const CONFIG = {
    id: "forbidden-kingdom-2027",
    lineupSource: { url: "https://www.forbiddenkingdomfestival.com/lineup/", observedAt: "2026-11-23", official: true },
    officialEvent: { website: "https://www.forbiddenkingdomfestival.com/", observedAt: "2026-11-23" },
    name: "Forbidden Kingdom 2027",
    shortName: "Forbidden Kingdom",
    brand: "Forbidden Kingdom",
    tagline: "Three days, five stages in Orlando",
    location: "Central Florida Fairgrounds · Orlando, FL",
    locationShort: "Central Florida Fairgrounds",
    dates: "Apr 23–25, 2027",
    year: 2027,
    // Night Print accent not measured yet (accent null = neutral print).
    print: { accent: null, source: { url: "https://www.forbiddenkingdomfestival.com/", observedAt: "2026-11-10" }, note: "Not measured yet; read the site's own CSS before setting a first-party colour." },
    startMs: Date.UTC(2027, 3, 23, -EDT, 0, 0),    // Fri Apr 23 00:00 local
    endMs: Date.UTC(2027, 3, 26, 6 - EDT, 0, 0),   // Mon Apr 26 06:00 local, a bound
    tz: "America/New_York",
    tzAbbr: "EDT",
    utcOffsetHours: EDT,
    dayDates: {
      1: day(23, "Friday", "FRI"),
      2: day(24, "Saturday", "SAT"),
      3: day(25, "Sunday", "SUN"),
    },
    gps: { lat: 28.5565728, lng: -81.4395937, onSiteRadiusMi: 1 },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["forbidden-kingdom-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    registry: { available: true, scheduleTBA: true, accent: "#a3e635", emoji: "🐉", region: "North America" },
  };
})();

// Sample content for the design-system exploration mocks.
// Stages and Saturday (night 2) set times are copied from data.jsx on main
// (EDC Las Vegas 2026, STAGES + ARTISTS day 2). The "plan", "seen" and
// Memories counts are SAMPLE user data for the mocks, not anyone's real plan.
// Concept only: nothing here is loaded by the app.
(function () {
  const STAGES = [
    { id: "kinetic", name: "Kinetic Field",   short: "KIN", color: "#e85d2e", x: 46.0, y: 9.2 },
    { id: "quantum", name: "Quantum Valley",  short: "QNT", color: "#38bdf8", x: 58.0, y: 25.5 },
    { id: "bionic",  name: "Bionic Jungle",   short: "BIO", color: "#14b8a6", x: 16.5, y: 25.2 },
    { id: "stereo",  name: "Stereo Bloom",    short: "STR", color: "#22c55e", x: 28.7, y: 31.3 },
    { id: "cosmic",  name: "Cosmic Meadow",   short: "CSM", color: "#fbbf24", x: 17.4, y: 51.2 },
    { id: "neon",    name: "Neon Garden",     short: "NEN", color: "#ec4899", x: 57.9, y: 52.4 },
    { id: "waste",   name: "Wasteland",       short: "WST", color: "#f97316", x: 17.7, y: 90.1 },
    { id: "basspod", name: "Basspod",         short: "BAS", color: "#2563eb", x: 43.0, y: 94.7 },
    { id: "circuit", name: "Circuit Grounds", short: "CIR", color: "#1e40af", x: 57.2, y: 95.9 },
  ];
  // [stage, start, end, name, genre]
  const RAW = [
    ["kinetic","19:00","20:00","AR/CO","Live Electronic"],["kinetic","20:00","21:00","Hayla","DnB Vocalist"],["kinetic","21:00","22:00","Sub Focus","DnB"],["kinetic","22:07","23:15","Steve Aoki","Electro"],["kinetic","23:19","00:29","Hardwell","Big Room"],["kinetic","00:32","01:42","John Summit","Tech House"],["kinetic","01:47","02:57","Subtronics","Dubstep"],["kinetic","03:01","04:11","Kaskade","Progressive House"],["kinetic","04:14","05:29","Above & Beyond","Trance","Sunrise Set"],
    ["circuit","19:00","20:00","DJ Mandy","House"],["circuit","20:00","21:15","RØZ","House"],["circuit","21:15","22:45","Kettama","Rave / Breaks"],["circuit","22:45","00:15","Sammy Virji","UK Garage"],["circuit","00:15","01:45","Tiësto","Big Room"],["circuit","01:45","03:15","Peggy Gou b2b Ki/Ki","House / Techno"],["circuit","03:15","04:30","Boys Noize","Electro"],["circuit","04:30","05:30","Lilly Palmer","Techno"],
    ["neon","19:00","20:30","Mink","Techno"],["neon","20:30","22:00","Silvie Loto","Techno"],["neon","22:00","23:30","Ahmed Spins","Afrohouse"],["neon","23:30","01:30","Luciano","Tech House"],["neon","01:30","03:30","Prospa","House"],["neon","03:30","05:30","Josh Baker b2b Kettama b2b Prospa","Breaks / House"],
    ["cosmic","19:00","20:15","Frost Children","Electronic"],["cosmic","20:15","21:25","Hannah Laing","Hard House"],["cosmic","21:25","22:15","Snow Strippers","Hyperpop"],["cosmic","22:15","23:30","VTSS","Techno","In The Round"],["cosmic","23:35","00:35","The Prodigy","Breakbeat"],["cosmic","00:40","02:10","BUNT.","Folktronica","In The Round"],["cosmic","02:10","03:30","Interplanetary Criminal","UK Bass"],["cosmic","03:30","04:30","Malugi","Techno"],["cosmic","04:30","05:30","DJ Gigola b2b MCR-T","Techno"],
    ["bionic","20:00","21:00","Spray","House"],["bionic","21:00","22:30","Bashkka b2b Sedef Adasi","House"],["bionic","22:30","00:00","HAAi b2b Luke Alessi","House"],["bionic","00:00","01:15","MCR-T","Techno"],["bionic","01:15","02:30","Bad Boombox b2b Ollie Lishman","House"],["bionic","02:30","03:30","Benwal","House"],["bionic","03:30","04:30","Baugruppe90","Techno"],["bionic","04:30","05:30","Club Angel","House"],
    ["quantum","19:00","20:30","Maria Healy","Trance"],["quantum","20:30","21:30","Superstrings","Trance"],["quantum","21:30","22:30","Billy Gillies","Trance"],["quantum","22:30","23:30","Paul Oakenfold","Trance"],["quantum","23:30","00:30","Andrew Rayel","Trance"],["quantum","00:30","01:30","Maddix","Big Room / Techno"],["quantum","01:30","02:30","Mathame","Melodic Techno"],["quantum","02:30","03:30","Astrix","Psytrance"],["quantum","03:30","04:30","T78","Acid Techno"],["quantum","04:30","05:30","Thomas Schumacher","Techno"],
    ["waste","19:00","20:30","Cutdwn","Hardstyle"],["waste","20:30","21:30","Dead X","Hard Dance"],["waste","21:30","22:30","The Saints","Hardcore"],["waste","22:30","23:30","Rob Gee b2b Lenny Dee","Hardcore"],["waste","23:30","00:30","Lady Faith b2b LNY TNZ","Hardstyle"],["waste","00:30","01:30","Audiofreq b3b Code Black b3b Toneshifterz","Hardstyle"],["waste","01:30","02:30","Da Tweekaz","Hardstyle"],["waste","02:30","03:30","Lil Texas","Hardcore"],["waste","03:30","04:30","Mish","Hardstyle"],["waste","04:30","05:30","Alyssa Jolee","Hardstyle"],
    ["stereo","19:00","20:00","Slugg","Tech House"],["stereo","21:00","22:00","Discip","Tech House"],["stereo","22:00","23:15","Omnom","Bass House"],["stereo","23:15","00:30","Noizu","Bass House"],["stereo","00:30","01:45","Wax Motif","Bass House"],["stereo","01:45","03:00","Cid","Tech House"],["stereo","03:00","04:15","HNTR","Bass House"],["stereo","04:15","05:30","Bolo","Tech House","Sunrise Set"],
    ["basspod","19:00","19:50","Fallen with MC Dino","Dubstep"],["basspod","19:50","20:40","Avello b2b Dennett","Dubstep"],["basspod","20:40","21:30","Viperactive","Dubstep"],["basspod","21:30","22:30","Hybrid Minds","Liquid DnB"],["basspod","22:30","23:30","YDG","Dubstep"],["basspod","23:30","00:30","Delta Heavy","DnB"],["basspod","00:30","01:30","Getter","Dubstep"],["basspod","01:30","02:30","Eptic b2b Space Laces","Dubstep"],["basspod","02:30","03:30","Doctor P b2b Flux Pavilion b3b Funtcase","Dubstep"],["basspod","03:30","04:30","Hol!","Dubstep"],["basspod","04:30","05:30","Mary Droppinz","Dubstep"],
  ];
  // Festival-night minutes: 19:00 = 0 … 05:30 = 630. After-midnight wraps.
  const toMin = (hhmm) => { let [h, m] = hhmm.split(":").map(Number); if (h < 12) h += 24; return (h - 19) * 60 + m; };
  const SETS = RAW.map(([stage, start, end, name, genre, note], i) => ({
    id: stage + i, stage, start, end, name, genre, note: note || "",
    s: toMin(start), e: toMin(end),
  }));
  const byName = (n) => SETS.find((x) => x.name === n);
  // Sample plan: what "you" picked for Saturday.
  const PLAN = ["Kettama", "Sammy Virji", "The Prodigy", "John Summit", "Peggy Gou b2b Ki/Ki", "Subtronics", "Kaskade", "Above & Beyond"].map(byName);

  const clock = (hhmm) => { let [h, m] = hhmm.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return { t: h + ":" + String(m).padStart(2, "0"), ap }; };
  const fmt = (hhmm) => { const c = clock(hhmm); return c.t; };
  const fmtAp = (hhmm) => { const c = clock(hhmm); return c.t + " " + c.ap; };
  const stage = (id) => STAGES.find((s) => s.id === id);

  window.EDC = {
    festival: { name: "EDC Las Vegas", year: 2026, short: "EDC LV", venue: "Las Vegas Motor Speedway", dates: "May 15–17, 2026", night: 2, dayName: "Saturday", tagline: "Three nights under the electric sky" },
    sun: { rise: "05:35", set: "19:35", firstLight: "05:07" }, // data.jsx sunTimes day 2; first light = civil twilight, approximate
    STAGES, SETS, PLAN, byName, stage, toMin, fmt, fmtAp,
    // Two moments the mocks can be set at.
    moments: {
      late: { hhmm: "00:50", label: "12:50" },   // John Summit live, Kinetic Field
      dawn: { hhmm: "05:05", label: "5:05" },    // Above & Beyond sunrise set
    },
    liveAt: (hhmm) => { const t = toMin(hhmm); return SETS.filter((x) => x.s <= t && t < x.e); },
    progress: (set, hhmm) => Math.max(0, Math.min(1, (toMin(hhmm) - set.s) / (set.e - set.s))),
    clashes: (a, b) => a.s < b.e && b.s < a.e,
    me: { sets: 14, hours: "19h 40m", moments: 212, nights: 3, festivals: ["EDC LV 2026", "Nocturnal 2025", "EDC LV 2025", "Escape 2024"] },
    photos: ["IMG_5484", "IMG_5537", "IMG_5545", "IMG_5597", "IMG_5605", "IMG_5621", "IMG_5626", "IMG_5464", "IMG_5567", "IMG_7600", "IMG_5538", "IMG_5485"],
  };
})();

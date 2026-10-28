// editions.mjs — the fixed facts about each historical edition that are NOT
// read from a schedule row: identity, official dates, time zone, and the hour
// before which a wall time belongs to the previous festival night.
//
// `dates` are the edition's official days. Each one was read off the archived
// page itself (Insomniac day tabs, or the header printed on each official
// graphic), and the ledger holds the capture that shows it.

import { slug } from "./lib.mjs";

export const EDITIONS = {
  "governors-ball-2025": { festivalId: "governors-ball", name: "Governors Ball 2025", year: 2025,
    timezone: "America/New_York", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-06-06", "Friday"], ["2025-06-07", "Saturday"], ["2025-06-08", "Sunday"]] },
  "lollapalooza-2025": { festivalId: "lollapalooza", name: "Lollapalooza 2025", year: 2025,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-07-31", "Thursday"], ["2025-08-01", "Friday"], ["2025-08-02", "Saturday"], ["2025-08-03", "Sunday"]] },
  "hard-summer-2025": { festivalId: "hard-summer", name: "HARD Summer 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2025-08-02", "Saturday"], ["2025-08-03", "Sunday"]] },
  "edc-las-vegas-2025": { festivalId: "edc-lv", name: "EDC Las Vegas 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2025-05-16", "Friday"], ["2025-05-17", "Saturday"], ["2025-05-18", "Sunday"]] },
  "beyond-wonderland-socal-2026": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2026", year: 2026,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2026-03-27", "Friday"], ["2026-03-28", "Saturday"]] },
  "beyond-wonderland-gorge-2026": { festivalId: "beyond-wonderland-gorge", name: "Beyond Wonderland at The Gorge 2026", year: 2026,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2026-06-27", "Saturday"], ["2026-06-28", "Sunday"]] },
  "acl-2025": { festivalId: "acl", name: "Austin City Limits 2025", year: 2025,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-10-03", "Friday"], ["2025-10-04", "Saturday"], ["2025-10-05", "Sunday"],
      ["2025-10-10", "Friday"], ["2025-10-11", "Saturday"], ["2025-10-12", "Sunday"]],
    dayLabels: ["Weekend 1 · Friday", "Weekend 1 · Saturday", "Weekend 1 · Sunday",
      "Weekend 2 · Friday", "Weekend 2 · Saturday", "Weekend 2 · Sunday"] },
  // Escape: no single archived source covers most years. Each day lists its
  // sources (an archived official page, or an official graphic re-hosted by
  // the festival's X account or EDM Identity, ruling A) in ledger/<id>.json.
  "escape-halloween-2017": { festivalId: "escape-halloween", name: "Escape Halloween 2017", year: 2017,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2017-10-27", "Friday"], ["2017-10-28", "Saturday"]] },
  "escape-halloween-2019": { festivalId: "escape-halloween", name: "Escape Halloween 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2019-10-25", "Friday"], ["2019-10-26", "Saturday"]] },
  "escape-halloween-2021": { festivalId: "escape-halloween", name: "Escape Halloween 2021", year: 2021,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2021-10-29", "Friday"], ["2021-10-30", "Saturday"]] },
  "escape-halloween-2022": { festivalId: "escape-halloween", name: "Escape Halloween 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2022-10-28", "Friday"], ["2022-10-29", "Saturday"]] },
  "escape-halloween-2024": { festivalId: "escape-halloween", name: "Escape Halloween 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2024-10-25", "Friday"], ["2024-10-26", "Saturday"]] },
  "escape-halloween-2025": { festivalId: "escape-halloween", name: "Escape Halloween 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2025-10-31", "Friday"], ["2025-11-01", "Saturday"]] },
  "edc-orlando-2017": { festivalId: "edc-orlando", name: "EDC Orlando 2017", year: 2017,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2017-11-10", "Friday"], ["2017-11-11", "Saturday"]] },
  "edc-orlando-2019": { festivalId: "edc-orlando", name: "EDC Orlando 2019", year: 2019,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2019-11-08", "Friday"], ["2019-11-09", "Saturday"], ["2019-11-10", "Sunday"]] },
  "edc-orlando-2021": { festivalId: "edc-orlando", name: "EDC Orlando 2021", year: 2021,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2021-11-12", "Friday"], ["2021-11-13", "Saturday"], ["2021-11-14", "Sunday"]] },
  "edc-orlando-2022": { festivalId: "edc-orlando", name: "EDC Orlando 2022", year: 2022,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2022-11-11", "Friday"], ["2022-11-12", "Saturday"], ["2022-11-13", "Sunday"]] },
  "edc-orlando-2023": { festivalId: "edc-orlando", name: "EDC Orlando 2023", year: 2023,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2023-11-10", "Friday"], ["2023-11-11", "Saturday"], ["2023-11-12", "Sunday"]] },
  "edc-orlando-2024": { festivalId: "edc-orlando", name: "EDC Orlando 2024", year: 2024,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2024-11-08", "Friday"], ["2024-11-09", "Saturday"], ["2024-11-10", "Sunday"]] },
  "edc-orlando-2025": { festivalId: "edc-orlando", name: "EDC Orlando 2025", year: 2025,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2025-11-07", "Friday"], ["2025-11-08", "Saturday"], ["2025-11-09", "Sunday"]] },
};

// Rows the official schedule prints that are NOT part of the library (founder
// rulings on #221, 2026-09-22). They are dropped at build time: stored neither
// as artists nor as events, so they cannot enter an artist's history, search
// or a count. The sheets and review manifests keep them as the audit trail of
// what was printed, and build-editions.mjs records every dropped row, with its
// reason, in ledger/<id>.json. Locked by test-historical-editions.mjs.
// A rule matches the printed billing (`test`) or the whole stage (`stage`).
// Stage rules are checked first, so every row on a dropped stage carries the
// stage's reason.
export const DROP_RULES = [
  { category: "bonus-tracks-stage", stage: /^bonus tracks$/i,
    reason: "Bonus Tracks stage: talks, activations and host sessions, not part of the historical lineup" },
  // Escape 2022 printed its silent disco as a whole stage ("DANSE MACABRE -
  // SILENT DISCO"); the Silent Disco ruling drops it as a stage too.
  { category: "operational", stage: /\bsilent disco\b/i,
    reason: "operational programming, not a billed performance" },
  // Escape 2024 printed its after-party (THE CAULDRON, 2AM-6AM) on a separate
  // "AFTER PARTY SET TIMES" graphic, after the festival's close.
  { category: "after-party", stage: /^after party\b/i,
    reason: "after-party: printed separately, after the festival's close, not part of the festival schedule" },
  { category: "operational", test: /^(fireworks|closing fireworks|(opening|closing) ceremony(:.*)?|silent disco|changeover)$/i,
    reason: "operational programming, not a billed performance" },
  // EDC Orlando's Kinetic Field prints its show between sets: intermezzos,
  // named interludes (2019 "NATURAL ENERGY", 2022 "GROW", "BLOSSOM") and the
  // closing segment. Scoped to that stage, so the same word elsewhere stays.
  { category: "show-segment", stage: /^kinetic ?field$/i,
    test: /^(intermezzo\b.*|kinetic (experience|celebration|bloom)\b.*|(natural|kinetic|industrial|spiritual) energy|grow|blossom|pollinate|closing)$/i,
    reason: "Kinetic Field show segment (an interlude, ceremony or fireworks printed between sets), not a billed performance" },
  { category: "unnamed-slot", test: /^(special guest|surprise guest|secret guest|tba|to be announced)$/i,
    reason: "unnamed slot: no performer was billed" },
  // A bare "Discovery Project" in a printed stage slot is the contest set
  // before its winner was named (EDC Orlando 2022, 2024). A lineup list's
  // stageless "Discovery Project" entry is left to the live lineup.
  { category: "unnamed-slot", stage: /\S/, test: /^discovery project$/i,
    reason: "unnamed slot: no performer was billed" },
];

// Non-music activities (talks, bingo, drag shows, classes, food, podcast
// tapings, brand activations), billed exactly as printed. The Bonus Tracks
// stage rule already drops them where they were printed; this list keeps the
// billing itself out of an edition wherever it might reappear. Kids-stage
// acts are real billed acts and stay (including the named
// "SPECIAL GUEST: THE HAPPINESS CLUB").
export const ACTIVITIES = {
  "acl-2025": [
    "STRETCH BEFORE THE SET", "LOS TACOS DE ACL FEST", "JAPANESE BREAKFAST X SUPERMUSH", "LP GIOBBI X SUPERMUSH",
    "ANTONI POROWSKI ON FOOD & CONNECTION", "EXTRAGRAMS PRESENTS DRAG BINGO!", "CIRQUE DU SLAY: A DRAG SHOW!",
    "MIXED-TAPE: A DRAG SHOW!", "A CONVERSATION WITH LUCIUS", "MATTHEW MCCONAUGHEY X BRENÉ BROWN",
  ],
  // Printed on the official 2026 lineup list and the Beatbox set times, but a
  // class, not a set (the rule above: classes are activities).
  "beyond-wonderland-socal-2026": ["Line Dancing with The Redheaded Cowgirl"],
  "lollapalooza-2025": [
    "BOB'S DANCE SHOP", "THE BINGO-GO-GO", "THE SECOND CITY: COMEDY MIXTAPE VOL. 59",
    "KATSEYE INTERVIEW WITH DAVIS BURLESON", "HOW LONG GONE WITH THE DARE", "HOW LONG GONE WITH THE BEAR'S COREY HENDRIX",
  ],
};
// Billings whose non-Latin letters are the artist's own styling, as the
// festival's structured page printed them (not OCR). Each one was read on
// the archived page; the look-alike rule in validate.mjs still applies to
// every other billing and stage.
export const PRINTED_NON_LATIN = {
  "beyond-wonderland-socal-2026": ["Cntrl Alt DΞLΞTΞ"],
  // Read by eye on the official graphic (review/escape-halloween-2024.json).
  "escape-halloween-2024": ["DAKЯΣD"],
};

const ACTIVITY_REASON = "non-music Bonus Tracks activity";

// Why a printed row (billing on stage) is dropped, or null if it is a set.
// Compared case-folded and by slug, so an id segment or a re-cased billing
// is caught too.
export function dropReason(billing, stage = "") {
  const name = String(billing).trim(), st = String(stage).trim();
  const hits = (re, x) => re.test(x) || re.test(x.replace(/-/g, " "));
  for (const r of DROP_RULES) if (r.stage && !r.test && hits(r.stage, st)) return { category: r.category, reason: r.reason };
  for (const r of DROP_RULES) if (r.test && (!r.stage || hits(r.stage, st)) && hits(r.test, name)) return { category: r.category, reason: r.reason };
  const k = slug(name);
  if (k && Object.values(ACTIVITIES).flat().some(a => slug(a) === k)) return { category: "activity", reason: ACTIVITY_REASON };
  return null;
}

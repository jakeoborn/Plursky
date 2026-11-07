// editions.mjs — the fixed facts about each historical edition that are NOT
// read from a schedule row: identity, official dates, time zone, and the hour
// before which a wall time belongs to the previous festival night.
//
// `dates` are the edition's official days. Each one was read off the archived
// page itself (Insomniac day tabs, or the header printed on each official
// graphic), and the ledger holds the capture that shows it.

import { slug } from "./lib.mjs";

const ACL_WEEKEND_LABELS = ["Weekend 1 · Friday", "Weekend 1 · Saturday", "Weekend 1 · Sunday",
  "Weekend 2 · Friday", "Weekend 2 · Saturday", "Weekend 2 · Sunday"];

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
  "edc-las-vegas-2024": { festivalId: "edc-lv", name: "EDC Las Vegas 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2024-05-17", "Friday"], ["2024-05-18", "Saturday"], ["2024-05-19", "Sunday"]] },
  "edc-las-vegas-2022": { festivalId: "edc-lv", name: "EDC Las Vegas 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2022-05-20", "Friday"], ["2022-05-21", "Saturday"], ["2022-05-22", "Sunday"]] },
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
  // ACL 2014-2016, 2018, 2019: the official aclfestival.com schedule grid, one
  // archived page per weekend (format "acl-grid", acl-schedule.mjs). The grid
  // prints ranges with no am/pm; each start is read off the page's own printed
  // hour axis by the block's position (ruling A, 2026-11-04).
  // ACL 2013's Weekend 2 Sunday (Oct 13) was cancelled by flooding: the final
  // official W2 page still prints its grid under a cancellation banner. The
  // edition has no such day (Instinct's ruling, 2026-11-04): the importer
  // proves the banner and that the sheet excludes every block of that day.
  "acl-2013": { festivalId: "acl", name: "Austin City Limits 2013", year: 2013,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2013-10-04", "Friday"], ["2013-10-05", "Saturday"], ["2013-10-06", "Sunday"], ["2013-10-11", "Friday"], ["2013-10-12", "Saturday"]],
    dayLabels: ACL_WEEKEND_LABELS.slice(0, 5),
    cancelledDays: [{ date: "2013-10-13", weekday: "Sunday", banner: "Sunday Performances Have Been Canceled Due To Flooding" }],
    notes: [{ asOf: "2026-11-04", text: "Weekend 2 Sunday (October 13) was cancelled because of flooding, so it has no sets here. The official Weekend 2 schedule printed: “Sunday Performances Have Been Canceled Due To Flooding”.",
      source: "https://web.archive.org/web/20140215094751/http://www.aclfestival.com/2013-schedule/weekend-two/" }] },
  "acl-2014": { festivalId: "acl", name: "Austin City Limits 2014", year: 2014,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2014-10-03", "Friday"], ["2014-10-04", "Saturday"], ["2014-10-05", "Sunday"], ["2014-10-10", "Friday"], ["2014-10-11", "Saturday"], ["2014-10-12", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2015": { festivalId: "acl", name: "Austin City Limits 2015", year: 2015,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2015-10-02", "Friday"], ["2015-10-03", "Saturday"], ["2015-10-04", "Sunday"], ["2015-10-09", "Friday"], ["2015-10-10", "Saturday"], ["2015-10-11", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2016": { festivalId: "acl", name: "Austin City Limits 2016", year: 2016,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2016-09-30", "Friday"], ["2016-10-01", "Saturday"], ["2016-10-02", "Sunday"], ["2016-10-07", "Friday"], ["2016-10-08", "Saturday"], ["2016-10-09", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  // ACL 2017's Weekend 2 survives only in a capture from Oct 9, four days
  // before that weekend: its lineup ships, its times do not (Instinct's
  // ruling, 2026-11-04). Those days are untimed: sets carry no start or end.
  "acl-2017": { festivalId: "acl", name: "Austin City Limits 2017", year: 2017,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2017-10-06", "Friday"], ["2017-10-07", "Saturday"], ["2017-10-08", "Sunday"], ["2017-10-13", "Friday"], ["2017-10-14", "Saturday"], ["2017-10-15", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS, untimedDays: [4, 5, 6],
    notes: [{ asOf: "2026-11-04", days: [4, 5, 6], text: "The only archived Weekend 2 schedule was captured October 9, before that weekend, so set times are not confirmed. The lineup is as that page printed it.",
      source: "https://web.archive.org/web/20171009063627/https://www.aclfestival.com/schedule-weekend-two/?goal=0_59b0a4eaa1-57b082a223-155739397&mc_cid=57b082a223&mc_eid=217da620b6" }] },
  "acl-2018": { festivalId: "acl", name: "Austin City Limits 2018", year: 2018,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2018-10-05", "Friday"], ["2018-10-06", "Saturday"], ["2018-10-07", "Sunday"], ["2018-10-12", "Friday"], ["2018-10-13", "Saturday"], ["2018-10-14", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2019": { festivalId: "acl", name: "Austin City Limits 2019", year: 2019,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2019-10-04", "Friday"], ["2019-10-05", "Saturday"], ["2019-10-06", "Sunday"], ["2019-10-11", "Friday"], ["2019-10-12", "Saturday"], ["2019-10-13", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
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
  "nocturnal-wonderland-2017": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2017", year: 2017,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2017-09-15", "Friday"], ["2017-09-16", "Saturday"]] },
  "nocturnal-wonderland-2018": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2018", year: 2018,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2018-09-14", "Friday"], ["2018-09-15", "Saturday"]] },
  "nocturnal-wonderland-2019": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2019-09-14", "Saturday"], ["2019-09-15", "Sunday"]] },
  "nocturnal-wonderland-2021": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2021", year: 2021,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2021-09-18", "Saturday"], ["2021-09-19", "Sunday"]] },
  "nocturnal-wonderland-2022": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2022-09-17", "Saturday"], ["2022-09-18", "Sunday"]] },
  "nocturnal-wonderland-2024": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2024-09-14", "Saturday"], ["2024-09-15", "Sunday"]],
    // Announced, scheduled, then canceled before it opened (the Line Fire). The
    // rows stay as the archive printed them; the library and the artist
    // registry skip a canceled edition, so no one is credited with a set that
    // never happened. Two dated sources, each published before the first day.
    status: "canceled",
    canceled: { announced: "2024-09-11", reason: "Canceled before it opened because of the Line Fire near the venue.",
      sources: [
        { publisher: "Moon Lvnding", published: "2024-09-11", fetched: "2026-11-06",
          url: "https://moonlvnding.com/featured/breaking-nocturnal-wonderland-2024-canceled-as-wildfires-threaten-venue/" },
        { publisher: "Billboard", published: "2024-09-12", fetched: "2026-11-06",
          url: "https://www.billboard.com/pro/nocturnal-wonderland-2024-canceled-southern-california-wildfires/" }] } },  "dreamstate-socal-2016": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2016", year: 2016,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2016-11-25", "Friday"], ["2016-11-26", "Saturday"]] },
  "dreamstate-socal-2019": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2019-11-22", "Friday"], ["2019-11-23", "Saturday"]] },
  "dreamstate-socal-2023": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2023-11-17", "Friday"], ["2023-11-18", "Saturday"]] },
  "dreamstate-socal-2024": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2024-11-22", "Friday"], ["2024-11-23", "Saturday"]] },
  "dreamstate-socal-2025": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2025-11-21", "Friday"], ["2025-11-22", "Saturday"]] },
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
  { category: "operational", test: /^(fireworks|closing fireworks|(opening|closing) ceremony(:.*)?|silent disco( powered by .+)?|changeover)$/i,
    reason: "operational programming, not a billed performance" },
  // EDC Orlando's Kinetic Field prints its show between sets: intermezzos,
  // named interludes (2019 "NATURAL ENERGY", 2022 "GROW", "BLOSSOM") and the
  // closing segment. Scoped to that stage, so the same word elsewhere stays.
  { category: "show-segment", stage: /^kinetic ?field$/i,
    test: /^(intermezzo\b.*|kinetic (experience|celebration|bloom)\b.*|(natural|kinetic|industrial|spiritual) energy|grow|blossom|pollinate|closing)$/i,
    reason: "Kinetic Field show segment (an interlude, ceremony or fireworks printed between sets), not a billed performance" },
  { category: "unnamed-slot", test: /^(special guest|surprise guest|secret guest|tba|to be announced|coming soon!*)$/i,
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

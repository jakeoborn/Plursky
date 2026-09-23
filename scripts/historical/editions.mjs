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
  "acl-2025": { festivalId: "acl", name: "Austin City Limits 2025", year: 2025,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-10-03", "Friday"], ["2025-10-04", "Saturday"], ["2025-10-05", "Sunday"],
      ["2025-10-10", "Friday"], ["2025-10-11", "Saturday"], ["2025-10-12", "Sunday"]],
    dayLabels: ["Weekend 1 · Friday", "Weekend 1 · Saturday", "Weekend 1 · Sunday",
      "Weekend 2 · Friday", "Weekend 2 · Saturday", "Weekend 2 · Sunday"] },
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
  { category: "operational", test: /^(fireworks|closing fireworks|opening ceremony|closing ceremony|silent disco)$/i,
    reason: "operational programming, not a billed performance" },
  { category: "unnamed-slot", test: /^(special guest|surprise guest|tba|to be announced)$/i,
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
  "lollapalooza-2025": [
    "BOB'S DANCE SHOP", "THE BINGO-GO-GO", "THE SECOND CITY: COMEDY MIXTAPE VOL. 59",
    "KATSEYE INTERVIEW WITH DAVIS BURLESON", "HOW LONG GONE WITH THE DARE", "HOW LONG GONE WITH THE BEAR'S COREY HENDRIX",
  ],
};
const ACTIVITY_REASON = "non-music Bonus Tracks activity";

// Why a printed row (billing on stage) is dropped, or null if it is a set.
// Compared case-folded and by slug, so an id segment or a re-cased billing
// is caught too.
export function dropReason(billing, stage = "") {
  const name = String(billing).trim(), st = String(stage).trim();
  const hits = (re, x) => re.test(x) || re.test(x.replace(/-/g, " "));
  for (const r of DROP_RULES) if (r.stage && hits(r.stage, st)) return { category: r.category, reason: r.reason };
  for (const r of DROP_RULES) if (r.test && hits(r.test, name)) return { category: r.category, reason: r.reason };
  const k = slug(name);
  if (k && Object.values(ACTIVITIES).flat().some(a => slug(a) === k)) return { category: "activity", reason: ACTIVITY_REASON };
  return null;
}

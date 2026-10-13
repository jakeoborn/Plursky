#!/usr/bin/env node
// resolve-graphics.mjs — find, fetch and hash an edition's OFFICIAL daily
// schedule graphics through the Wayback Machine (Gov Ball, Lollapalooza, ACL).
//
//   node scripts/historical/resolve-graphics.mjs governors-ball-2025 [lollapalooza-2025 acl-2025]
//
// Walks every capture of the official /schedule page inside the edition's
// window, collects the schedule images each capture embeds (Webflow serves
// resized "-p-500" copies; only the full-size original is kept), and picks,
// per official day, the image from the LATEST capture that still embeds one
// for that day — a revised grid replaces an older one (Gov Ball's Saturday is
// "Sat_6.7D", a re-issue). Earlier revisions stay in the ledger.
//
// The graphics are research artifacts: they are cached in the private research
// directory, hashed, and never committed or shipped. OCR reads the cached copy.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCaptures, fetchCapture } from "./wayback.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// `days`: the official days in order, each with the filename token that marks
// its graphic. The match is on the image's own filename, which the festival
// wrote — never on page position.
export const GRAPHIC_EDITIONS = {
  "governors-ball-2025": { year: 2025, page: "https://www.governorsballmusicfestival.com/schedule", window: ["20250601", "20251231"],
    image: /GBSchedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2025-06-06", token: /-Fri/i }, { day: 2, date: "2025-06-07", token: /-Sat/i }, { day: 3, date: "2025-06-08", token: /-Sun/i }] },
  "lollapalooza-2025": { year: 2025, page: "https://www.lollapalooza.com/schedule", window: ["20250725", "20251231"],
    image: /LOL25_Schedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2025-07-31", token: /Thurs/i }, { day: 2, date: "2025-08-01", token: /Fri\b|_Fri/i },
      // Lolla's final Saturday and Sunday re-issues carry no day name
      // ("08.01-WEB", "08.03.04-Sun"); each graphic prints its own day and
      // date in its header, and the review manifest records that check.
      { day: 3, date: "2025-08-02", token: /_Sat|08\.01-WEB|Chance-WEB/i }, { day: 4, date: "2025-08-03", token: /Sun/i }] },
  "acl-2025": { year: 2025, page: "https://www.aclfestival.com/schedule", window: ["20250915", "20251231"],
    image: /ACL25-Schedule-[^"'\s/]+?\.png/i,
    days: [{ day: 1, date: "2025-10-03", token: /W1-Fri/i }, { day: 2, date: "2025-10-04", token: /W1-Sat/i }, { day: 3, date: "2025-10-05", token: /W1-Sun/i },
      { day: 4, date: "2025-10-10", token: /W2-Fri/i }, { day: 5, date: "2025-10-11", token: /W2-Sat/i }, { day: 6, date: "2025-10-12", token: /W2-Sun/i }] },
};

const fullSize = u => !/-p-\d+\.png$/i.test(u);

export async function resolve(id) {
  const ed = GRAPHIC_EDITIONS[id];
  const host = ed.page.replace(/^https?:\/\//, "");
  const caps = await listCaptures(host, ...ed.window);
  const seen = [];
  for (const c of caps) {
    const got = await fetchCapture(c.timestamp, ed.page);
    const re = new RegExp(`https?:[^"'\\s)]+?${ed.image.source}`, "gi");
    const imgs = [...new Set(got.text.match(re) || [])].filter(fullSize);
    seen.push({ captureTimestamp: got.captureTimestamp, archivedUrl: got.archivedUrl, sha256: got.sha256, images: imgs });
  }
  const ledger = { id, method: "official_image_transcription", official: ed.page, window: ed.window,
    pageCaptures: seen.map(s => ({ ...s, images: s.images.map(u => u.split("/").pop()) })), days: [] };
  for (const d of ed.days) {
    const revisions = [];
    for (const s of seen) for (const u of s.images) if (d.token.test(u.split("/").pop()) && !revisions.some(r => r.url === u))
      revisions.push({ url: u, firstSeen: s.captureTimestamp });
    const lastCap = [...seen].reverse().find(s => s.images.some(u => d.token.test(u.split("/").pop())));
    if (!lastCap) { ledger.days.push({ day: d.day, date: d.date, blocked: "no capture embeds an official graphic for this day" }); continue; }
    const pick = lastCap.images.filter(u => d.token.test(u.split("/").pop()));
    if (pick.length !== 1) { ledger.days.push({ day: d.day, date: d.date, blocked: `ambiguous: ${pick.length} graphics in ${lastCap.captureTimestamp}` }); continue; }
    let img;
    try { img = await fetchCapture(lastCap.captureTimestamp, pick[0], { binary: true }); }
    catch (e) {
      ledger.days.push({ day: d.day, date: d.date, blocked: `graphic not archived: ${e.message}`, originalUrl: pick[0],
        revisions: revisions.map(r => ({ file: r.url.split("/").pop(), firstSeen: r.firstSeen })) });
      continue;
    }
    ledger.days.push({ day: d.day, date: d.date, pageCapture: lastCap.captureTimestamp, pageArchivedUrl: lastCap.archivedUrl,
      originalUrl: pick[0], imageCapture: img.captureTimestamp, imageArchivedUrl: img.archivedUrl,
      sha256: img.sha256, bytes: img.bytes, contentType: img.contentType, cacheFile: img.file.split("/").pop(),
      revisions: revisions.map(r => ({ file: r.url.split("/").pop(), firstSeen: r.firstSeen })) });
  }
  mkdirSync(join(ROOT, "data/historical/ledger"), { recursive: true });
  writeFileSync(join(ROOT, `data/historical/ledger/${id}.json`), JSON.stringify(ledger, null, 2) + "\n");
  return ledger;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const id of process.argv.slice(2)) {
    const l = await resolve(id);
    console.log(`▸ ${id}: ${l.pageCaptures.length} page captures`);
    for (const d of l.days) console.log(d.blocked ? `  ✗ day ${d.day} ${d.date}: ${d.blocked}`
      : `  day ${d.day} ${d.date}: ${d.originalUrl.split("/").pop()} page@${d.pageCapture} img@${d.imageCapture} ${d.bytes}B ${d.contentType} sha ${d.sha256.slice(0, 12)} · ${d.revisions.length} revision(s): ${d.revisions.map(r => r.file.replace(/^[0-9a-f]+_/, "")).join(", ")}`);
  }
}

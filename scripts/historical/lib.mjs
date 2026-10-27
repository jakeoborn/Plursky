// lib.mjs — small shared helpers for historical-edition extraction.

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

// "04:13 AM" → "04:13"; "12:05 PM" → "12:05"; "12:30 AM" → "00:30".
export function to24(s) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i.exec(String(s).trim());
  if (!m) return null;
  let h = +m[1] % 12;
  if (m[3].toUpperCase() === "P") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export const weekdayOf = iso => WEEKDAYS[new Date(iso + "T12:00:00Z").getUTCDay()];

// "Friday, May 16" in `year` → "2025-05-16", or null if the weekday is not
// true of that date in that year. This is the edition check that survives a
// site whose <title> has already rolled forward (EDC LV's June 2025 capture is
// titled "EDC Las Vegas 2026" over the 2025 set list).
export function datedLabel(label, year) {
  const m = /^(\w+),?\s+(\w+)\s+(\d{1,2})$/.exec(String(label).trim());
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toLowerCase());
  if (mi < 0) return null;
  const iso = `${year}-${String(mi + 1).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
  return weekdayOf(iso) === m[1].toLowerCase() ? iso : null;
}

// Whether a graphic's printed header prints festival day `date`: it names
// that day's weekday (and no other), and its month and day of month. A
// combined-day header ("FRIDAY · OCTOBER 27 & 28, 2017", "OCTOBER 25 + 26,
// 2024") may list several days, but every date it prints must be one of the
// edition's `dates`, and every year it prints must be the edition's.
const WEEKDAY_WORD = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thur?s?|fri|sat)\b/g;
export function graphicPrints(printed, date, year, dates = [date]) {
  const p = String(printed || "").toLowerCase();
  const days = p.match(WEEKDAY_WORD) || [];
  if (!days.length || days.some(w => w.slice(0, 3) !== weekdayOf(date).slice(0, 3))) return false;
  const md = iso => iso.slice(5);
  const got = [];
  for (const [, word, list] of p.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2}(?:\s*(?:&|\+|•|-|–|and)\s*\d{1,2})*)\b(?!\d)/g)) {
    const mi = MONTHS.findIndex(n => n.startsWith(word));
    if (mi < 0) continue;
    for (const d of list.match(/\d{1,2}/g)) got.push(`${String(mi + 1).padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  for (const [, mo, d, yy] of p.matchAll(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2}))?\b(?!\.\d)/g)) {
    if (yy && +yy !== year % 100) return false;
    got.push(`${mo.padStart(2, "0")}-${d.padStart(2, "0")}`);
  }
  if ((p.match(/\b(19|20)\d{2}\b/g) || []).some(y => +y !== year)) return false;
  return got.includes(md(date)) && got.every(x => dates.some(d => md(d) === x));
}

// The part of a graphic's URL its receipt page must cite: the path without
// its extension (so a resized copy, "-1024x1280.jpg", still counts). An X
// media id or an Instagram CDN file name is cited by name alone: EDM
// Identity re-uploads X media under its media id, and Instagram signs its
// URLs per request.
export function citeToken(imageUrl) {
  const u = new URL(imageUrl), path = u.pathname.replace(/^\//, "").replace(/\.(jpe?g|png|webp)$/i, "");
  return u.hostname === "pbs.twimg.com" || u.hostname.endsWith("cdninstagram.com") ? path.split("/").pop() : path;
}

// Minutes after the festival day's own midnight: a set that starts before
// `rolloverHour` belongs to the previous festival day but the next calendar
// date (EDC's 04:13 Gorgon City set is Friday night's, on Saturday morning).
export function dayMinutes(hhmm, rolloverHour) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h < rolloverHour ? h + 24 : h) * 60 + m;
}

// The instant a festival-day wall time happens, as an ISO string with the
// edition's UTC offset applied (offset in minutes east of UTC, e.g. -420).
export function instant(dateISO, hhmm, rolloverHour, offsetMin) {
  const mins = dayMinutes(hhmm, rolloverHour);
  const base = Date.parse(dateISO + "T00:00:00Z") + mins * 60000 - offsetMin * 60000;
  return new Date(base).toISOString();
}

export const slug = s => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

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

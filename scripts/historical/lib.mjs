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

// Every set-times graphic an EDM Identity post shows in its article body, as
// cite tokens (`wp-content/uploads/YYYY/MM/name`, no size suffix or
// extension), or null when the page has no article body this reads. A
// receipt page is checked for completeness against this list, not just for
// the graphic a source cites: Orlando 2017's post carried a Corona Electric
// Beach graphic that the first import left out. The body ends before the
// tags and share bar, so sidebars and related-post thumbnails never count.
// Three site themes: JNews (2021 on), Newspaper (to 2020) and Extra (2017).
const POST_BODIES = [['class="content-inner', ["jeg_post_tags", "jeg_share_bottom"]], ['class="td-post-content', ["td-post-source-tags", "td-post-sharing-bottom"]],
  ['class="post-content entry-content', ["abh_box", "jp-relatedposts", "post-footer"]]];
export function setTimesGraphics(html) {
  const theme = POST_BODIES.find(([start]) => html.includes(start));
  if (!theme) return null;
  const a = html.indexOf(theme[0]);
  const end = Math.min(html.length, ...theme[1].map(m => html.indexOf(m, a)).filter(x => x > a));
  const SET = /set\s*times|schedule/i, OTHER = /\bmap\b|parking|shuttle|metrolink/i;
  const out = [];
  let heading = "";
  for (const m of html.slice(a, end).matchAll(/<img\b[^>]*>|>([^<>]{3,160})</g)) {
    // Each graphic is introduced by a heading that ends in ":" ("EDC Orlando
    // 2017 Corona Electric Beach Set Times:"); captions do not end that way.
    if (m[1] !== undefined) { const t = m[1].replace(/&#8211;|&ndash;/g, "–").trim(); if (t.endsWith(":")) heading = t; continue; }
    const src = (m[0].match(/data-orig-file="([^"]+)"/) || m[0].match(/\ssrc="([^"]+)"/) || [])[1] || "";
    const token = (src.match(/(wp-content\/uploads\/\d{4}\/\d{2}\/[^"?]+?)(?:-\d+x\d+)?\.(?:png|jpe?g|webp)/i) || [])[1];
    if (!token) continue;
    const alt = ((m[0].match(/\salt="([^"]*)"/) || [])[1] || "").trim();
    if ((SET.test(alt) || /set[-_]?times/i.test(token) || (SET.test(heading) && !OTHER.test(alt))) && !out.includes(token)) out.push(token);
  }
  return out;
}

// Every slide of an Instagram post, from its logged-out embed, as cite tokens
// (the CDN file name, no extension), or null when the embed shows neither a
// carousel nor a single image. A carousel lists its slides in the embed's
// sidecar JSON; a one-image post shows one EmbeddedMediaImage. The profile
// picture and "more posts" thumbnails are neither, so they never count.
export function postSlides(html) {
  const h = html.replace(/\\\//g, "/").replace(/\\"/g, '"');
  const name = u => (/\/([\w.-]+?)\.(?:jpe?g|png|webp|heic)/i.exec(u) || [])[1];
  const i = h.indexOf("edge_sidecar_to_children");
  if (i >= 0) {
    const list = h.slice(i).split(/"edge_media_to_caption"|"edge_media_preview_like"/)[0];
    const out = [...list.matchAll(/"display_url":"([^"]+)"/g)].map(m => name(m[1])).filter(Boolean);
    return out.length ? [...new Set(out)] : null;
  }
  const img = /<img\b[^>]*class="[^"]*EmbeddedMediaImage[^"]*"[^>]*>/.exec(h);
  const src = img && (/\ssrc="([^"]+)"/.exec(img[0]) || [])[1];
  return src && name(src) ? [name(src)] : null;
}

// A receipt page's graphic token names a source's cite token: the same path,
// or (an X media id, cited by name alone) the same file name.
export const sameGraphic = (token, cites) => token === cites || token.endsWith("/" + cites);

// The set-times graphics an edition's receipt pages show that no source uses
// and `notUsed` ([{cites, reason}]) does not exclude, plus exclusions that
// name no graphic on any receipt, name one a source uses, or give no reason.
// Several sources can share one receipt page; their lists are unioned, so a
// later source listing fewer graphics never hides one an earlier one listed.
export function receiptGaps(graphicCaptures, notUsed = []) {
  const receipts = new Map();
  for (const c of graphicCaptures) if (c.receipt?.setTimesGraphics) {
    const key = c.receipt.archivedUrl || c.receipt.url, r = receipts.get(key);
    receipts.set(key, { ...c.receipt, setTimesGraphics: [...new Set([...(r?.setTimesGraphics || []), ...c.receipt.setTimesGraphics])] });
  }
  const cited = graphicCaptures.map(c => c.receipt?.cites).filter(Boolean);
  const unused = [], stale = [];
  for (const r of receipts.values()) for (const t of r.setTimesGraphics)
    if (!cited.some(x => sameGraphic(t, x)) && !notUsed.some(n => n.cites === t && n.reason) && !unused.some(u => u.cites === t)) unused.push({ cites: t, page: r.archivedUrl || r.url });
  for (const n of notUsed) if (!n.reason || cited.some(x => sameGraphic(n.cites, x)) || ![...receipts.values()].some(r => r.setTimesGraphics.includes(n.cites))) stale.push(n);
  return { unused, stale };
}

// The festival's own Instagram posts that print no publish date (none is
// inferred from a shortcode's media ID): edition id → the account and the
// exact posts. Only these may leave `published` blank, so an unrelated post
// or another account's re-host cannot borrow the exception.
export const UNDATED_OWN_POSTS = {
  "dreamstate-socal-2023": { account: "@dreamstateusa", posts: ["CzrednDMQE6"] },
  "dreamstate-socal-2025": { account: "@dreamstateusa", posts: ["DRK5JIlkh91"] },
};
export function undatedOwnPost(editionId, c) {
  const own = UNDATED_OWN_POSTS[editionId];
  if (!own || c?.kind !== "graphic" || c.published != null) return false;
  const code = /^https:\/\/www\.instagram\.com\/p\/([\w-]+)\/$/.exec(c.foundAt || "")?.[1];
  let host = "";
  try { host = new URL(c.imageUrl).hostname; } catch {}
  return own.posts.includes(code)
    && c.receipt?.url === `https://www.instagram.com/p/${code}/embed/captioned/`
    && new RegExp(`(^|[^\\w.])${own.account}(?![\\w.])`).test(c.rehostedBy || "")
    && /(^|\.)cdninstagram\.com$/.test(host);
}

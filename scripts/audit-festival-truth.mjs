#!/usr/bin/env node
// SPEC-193 P2 — festival truth audit. READ-ONLY: it never writes app data.
//
//   node scripts/audit-festival-truth.mjs [--only id,id] [--offline] [--date YYYY-MM-DD]
//
// Boots the real app headless once to read _DATA_SETS (the data the app shows),
// then checks every festival against (a) itself, (b) its own provenance and the
// official page it cites, (c) its public /f/<id>/ page, (d) the map registration
// waivers in scripts/verify.mjs, and (e) the artist-photo ledger + Wikimedia Commons.
// Writes reports/festival-truth-<date>.md + .json.
//
// Outside fetches: free public pages only, cached in reports/.truth-cache/
// (re-used for 24 h), at most 1 request per second per host. --offline uses
// the cache only. A page that can't be read is UNVERIFIED, never MATCH.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wireVendor } from "./lib/vendor-cdn.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OFFLINE = process.argv.includes("--offline");
const ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const DATE = arg("--date", new Date().toISOString().slice(0, 10));
// DATE decides "ended" and waiver expiry. An unparseable value would quietly
// read every festival as not ended and skip every waiver, so refuse it.
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE) || Number.isNaN(Date.parse(DATE))) { console.error(`--date must be YYYY-MM-DD, got "${DATE}"`); process.exit(2); }
const OUT = join(ROOT, "reports"), CACHE = join(OUT, ".truth-cache");
mkdirSync(CACHE, { recursive: true });
writeFileSync(join(CACHE, ".gitignore"), "*\n"); // fetch cache, never committed
const UA = "PlurskyTruthAudit/1.0 (+https://plursky.com; read-only data check)";

// ---------- polite cached fetch ----------
const lastHit = new Map();
async function politeFetch(url, { json = false } = {}) {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const body = join(CACHE, key + (json ? ".json" : ".html")), meta = join(CACHE, key + ".meta.json");
  if (existsSync(meta)) {
    const m = JSON.parse(readFileSync(meta, "utf8"));
    if (OFFLINE || Date.now() - Date.parse(m.fetchedAt) < 864e5)
      return { ...m, text: m.ok ? readFileSync(body, "utf8") : "", cached: true };
  }
  if (OFFLINE) return { url, ok: false, status: 0, fetchedAt: null, error: "offline, not cached", text: "" };
  // Wikimedia allows a client without contact details ~10 requests a minute
  // (same pacing as scripts/find-commons-photos.mjs); every other host 1/s.
  const host = new URL(url).host, gap = /(^|\.)(wikimedia|wikipedia|wikidata)\.org$/.test(host) ? 6500 : 1000;
  const wait = (lastHit.get(host) || 0) + gap - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastHit.set(host, Date.now());
  const fetchedAt = new Date().toISOString();
  let m;
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: json ? "application/json" : "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const text = await r.text();
    m = { url, finalUrl: r.url, ok: r.ok, status: r.status, fetchedAt };
    // A rate limit or server error is not an answer: leave it uncached so a re-run asks again.
    if (r.ok) writeFileSync(body, text);
    if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) writeFileSync(meta, JSON.stringify(m));
    return { ...m, text: r.ok ? text : "" };
  } catch (e) {
    m = { url, ok: false, status: 0, fetchedAt, error: String(e.message || e).slice(0, 120) };
    return { ...m, text: "" };
  }
}

// ---------- read the app's data ----------
async function readAppData() {
  const PORT = 8960 + Math.floor(Math.random() * 30);
  const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 900));
  const b = await chromium.launch();
  try {
    const ctx = await b.newContext({ serviceWorkers: "block" });
    await wireVendor(ctx);
    await ctx.route(u => !/^(127\.0\.0\.1|localhost)$/.test(new URL(u).hostname) && !/jsdelivr|unpkg/.test(u), r => r.abort());
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${PORT}/index.html`);
    await p.waitForFunction(() => typeof _DATA_SETS === "object" && Object.keys(_DATA_SETS).length > 0, null, { timeout: 30000 });
    return await p.evaluate(() => Object.entries(_DATA_SETS).map(([id, ds]) => {
      const c = ds.config || {};
      const pick = o => o == null ? null : JSON.parse(JSON.stringify(o));
      return {
        id, tba: typeof isScheduleTBA === "function" ? !!isScheduleTBA(id) : null,
        config: pick({ id: c.id, name: c.name, dates: c.dates, year: c.year, startMs: c.startMs, endMs: c.endMs, tz: c.tz,
          dayDates: c.dayDates, venue: c.venue && { name: c.venue.name, address: c.venue.address }, location: c.location, locationShort: c.locationShort,
          officialEvent: c.officialEvent, lineupSource: c.lineupSource, scheduleSource: c.scheduleSource, setTimesProvisional: c.setTimesProvisional,
          hours: c.hours, gates: c.gates, gpsAnchors: c.gpsAnchors && Object.keys(c.gpsAnchors), mapMode: c.mapMode, mapGeoref: !!c.mapGeoref,
          mapArtIsGeoregistered: c.mapArtIsGeoregistered, mapSource: c.mapSource }),
        stages: (ds.stages || []).map(s => ({ id: s.id, name: s.name })),
        artists: (ds.artists || []).map(a => ({ id: a.id, name: a.name, stage: a.stage, day: a.day, start: a.start, end: a.end,
          weekend: a.weekend || null, provisional: !!a.provisional, img: a.img || null, photoUrl: a.photoUrl || null })),
      };
    }));
  } finally { await b.close(); srv.kill(); }
}

// ---------- helpers ----------
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
// A set crossing midnight ends "earlier" than it starts; count festival-night minutes from 06:00.
const nightMin = t => { const v = toMin(t); return v == null ? null : (v < 360 ? v + 1440 : v); };
const norm = s => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\b(b2b|b3b|x|vs\.?|and|&|feat\.?|ft\.?|presents|pres\.?)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const htmlText = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, "-").replace(/\s+/g, " ");

// Every (month, day) the page text mentions, ranges expanded ("Dec 30-31", "December 30 & 31").
function dateMentions(text) {
  const out = new Set();
  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:\s*(?:-|–|—|to|&|and|\+)\s*(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(\d{1,2})(?!\d)(?:st|nd|rd|th)?)?/gi;
  for (const m of text.matchAll(re)) {
    const m1 = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), d1 = +m[2];
    if (d1 < 1 || d1 > 31) continue;
    out.add(`${m1}-${d1}`);
    if (m[4]) {
      const m2 = m[3] ? MONTHS.indexOf(m[3].slice(0, 3).toLowerCase()) : m1, d2 = +m[4];
      if (m2 === m1 && d2 > d1 && d2 - d1 <= 10) for (let d = d1 + 1; d <= d2; d++) out.add(`${m1}-${d}`);
      else if (d2 >= 1 && d2 <= 31) out.add(`${m2}-${d2}`);
    }
  }
  // Day-first: "11 • 12 • 13 DEC 2026", "9 JAN 2027", "30-31 December".
  const dayFirst = /((?:(?<!\d)\d{1,2}(?!\d)(?:st|nd|rd|th)?\s*(?:-|–|—|•|·|&|,|\+|and|to)?\s*)+)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi;
  for (const m of text.matchAll(dayFirst)) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    const parts = [...m[1].matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s*(-|–|—|to)?/g)];
    for (let i = 0; i < parts.length; i++) {
      const d = +parts[i][1]; if (d < 1 || d > 31) continue;
      out.add(`${mi}-${d}`);
      if (parts[i][2] && parts[i + 1]) { const e = +parts[i + 1][1]; if (e > d && e - d <= 10) for (let x = d + 1; x < e; x++) out.add(`${mi}-${x}`); }
    }
  }
  return out;
}


// The event's calendar days, from the `dates` string the app shows ("Oct 2–4 & 9–11, 2026",
// "Dec 31, 2026 – Jan 1, 2027"). dayDates can't be used: a TBA festival carries one
// placeholder day for the whole run. Returns [{y,m,d}] in order.
function eventDays(c) {
  const str = (c.dates || "").replace(/[–—]/g, "-");
  const out = []; let month = null, year = c.year, lastM = null;
  const yrs = [...str.matchAll(/\b(20\d\d)\b/g)].map(m => +m[1]);
  if (yrs.length) year = yrs[0];
  for (const m of str.replace(/\b20\d\d\b/g, " ").matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?|(\d{1,2})(?:\s*-\s*(\d{1,2})(?!\d))?/gi)) {
    if (m[1]) { const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); if (lastM != null && mi < lastM) year++; month = lastM = mi; continue; }
    if (month == null) continue;
    const a = +m[2], b = m[3] ? +m[3] : a;
    for (let d = a; d <= b && b - a <= 10; d++) out.push({ y: year, m: month, d });
  }
  return out;
}
const iso = x => `${x.y}-${String(x.m + 1).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;

// ---------- checks ----------
function internalChecks(f, add) {
  const c = f.config, stageIds = new Set(f.stages.map(s => s.id));
  const days = Object.keys(c.dayDates || {}).map(Number).sort((a, b) => a - b);
  const timed = f.artists.filter(a => toMin(a.start) != null);
  const ev = c.scheduleSource?.url || c.lineupSource?.url || c.officialEvent?.website || null;

  // Stages
  const used = new Map(); for (const a of f.artists) used.set(a.stage, (used.get(a.stage) || 0) + 1);
  const unknown = f.artists.filter(a => a.stage && !stageIds.has(a.stage));
  if (unknown.length) add("S1", "set on a stage the festival does not have", `${unknown.length}: ${unknown.slice(0, 5).map(a => `${a.name} → "${a.stage}"`).join(", ")}`, ev);
  const empty = f.stages.filter(s => !used.has(s.id));
  if (empty.length && f.artists.length) add("S3", "stage with zero sets", empty.map(s => s.name || s.id).join(", "), ev);

  // Days
  const badDay = f.artists.filter(a => a.day != null && days.length && !days.includes(+a.day));
  if (badDay.length) add("S1", "set on a day the festival does not have", `${badDay.length}: ${badDay.slice(0, 5).map(a => `${a.name} day ${a.day}`).join(", ")}`, ev);
  if (!f.tba) for (const d of days) {
    const n = timed.filter(a => +a.day === d).length;
    if (n > 0 && n < 3) add("S3", "day with fewer than 3 timed sets", `day ${d}: ${n}`, ev);
  }

  // Times
  const odd = timed.filter(a => [a.start, a.end].some(t => toMin(t) != null && toMin(t) % 5));
  if (odd.length) add("S3", "set time not on a 5-minute mark", `${odd.length}: ${odd.slice(0, 5).map(a => `${a.name} ${a.start}-${a.end}`).join(", ")}`, ev);
  const neg = timed.filter(a => toMin(a.end) != null && nightMin(a.end) <= nightMin(a.start));
  if (neg.length) add("S1", "set ends at or before it starts", `${neg.length}: ${neg.slice(0, 5).map(a => `${a.name} ${a.start}-${a.end}`).join(", ")}`, ev);

  // Same-stage overlaps (same day, same weekend)
  const ov = [];
  const groups = new Map();
  for (const a of timed) if (toMin(a.end) != null) {
    const k = `${a.day}|${a.stage}|${a.weekend === "both" ? "*" : a.weekend || ""}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(a);
  }
  // "both"-weekend acts collide with W1 and W2 rows on the same stage.
  for (const [k, arr] of groups) if (k.endsWith("|*")) for (const w of ["W1", "W2"]) { const o = groups.get(k.replace(/\*$/, w)); if (o) o.push(...arr); }
  for (const [k, arr] of groups) {
    if (k.endsWith("|*") && (groups.has(k.replace(/\*$/, "W1")) || groups.has(k.replace(/\*$/, "W2")))) continue;
    const s = [...new Set(arr)].sort((x, y) => nightMin(x.start) - nightMin(y.start));
    for (let i = 1; i < s.length; i++) if (nightMin(s[i].start) < nightMin(s[i - 1].end)) ov.push(`day ${s[i].day} ${s[i].stage}${s[i].weekend ? " " + s[i].weekend : ""}: ${s[i - 1].name} ${s[i - 1].start}-${s[i - 1].end} × ${s[i].name} ${s[i].start}-${s[i].end}`);
  }
  if (ov.length) add("S1", "two sets overlap on the same stage", `${ov.length}: ${ov.slice(0, 4).join("; ")}`, ev);

  // Duplicate / near-duplicate artists on the same day and weekend. Two sets at
  // different times (a DJ set + a live set, two stages) are real festival
  // listings; only the same act twice at overlapping times is a data error.
  const byKey = new Map(), dups = [], doubles = [];
  for (const a of f.artists) {
    if (!norm(a.name)) continue;
    const k = `${norm(a.name)}|${a.day}|${a.weekend === "both" ? "" : a.weekend || ""}`;
    for (const b of byKey.get(k) || []) {
      const clash = toMin(a.start) != null && toMin(b.start) != null && (a.start === b.start ||
        (toMin(a.end) != null && toMin(b.end) != null && nightMin(a.start) < nightMin(b.end) && nightMin(b.start) < nightMin(a.end)));
      (clash ? dups : doubles).push(`${b.name} (${b.id} ${b.stage} ${b.start || "TBA"}) ≈ ${a.name} (${a.id} ${a.stage} ${a.start || "TBA"}) day ${a.day}`);
    }
    (byKey.get(k) || byKey.set(k, []).get(k)).push(a);
  }
  if (dups.length) add("S2", "same artist listed twice at the same time", `${dups.length}: ${dups.slice(0, 4).join("; ")}`, ev);
  if (doubles.length) add("S3", "act plays two sets on one day (spot-check against the official times)", `${doubles.length}: ${doubles.slice(0, 3).join("; ")}`, ev);

  // Gate hours
  const h = c.hours;
  if (h?.open && h?.close) {
    const o = nightMin(h.open), cl = nightMin(h.close);
    const out = timed.filter(a => nightMin(a.start) < o || (toMin(a.end) != null && nightMin(a.end) > cl));
    if (out.length) add("S2", "set outside the published gate hours", `${h.open}-${h.close}: ${out.slice(0, 5).map(a => `${a.name} ${a.start}-${a.end}`).join(", ")}`, h.url || ev);
  }

  // Provenance
  if (!c.officialEvent?.website) add("S2", "no official website recorded (officialEvent)", "", null);
  if (!c.lineupSource?.url && !c.scheduleSource?.url) add("S2", "no lineup or schedule source recorded", "", c.officialEvent?.website || null);
  if (!f.tba && timed.length && !c.scheduleSource?.url && !c.setTimesProvisional) add("S2", "timed sets with no schedule source and not marked provisional", `${timed.length} timed sets`, c.lineupSource?.url || null);
  return { stages: f.stages.length, sets: f.artists.length, timed: timed.length, days: days.length };
}

async function officialCheck(f, add) {
  const c = f.config, url = c.officialEvent?.website;
  const res = { dates: "UNVERIFIED", venue: "UNVERIFIED", url: url || null, fetchedAt: null, why: "" };
  if (!url) { res.why = "no official website recorded"; return res; }
  const r = await politeFetch(url);
  res.fetchedAt = r.fetchedAt; res.status = r.status;
  if (!r.ok) { res.why = `fetch failed (${r.status || r.error})`; return res; }
  const text = htmlText(r.text);
  if (text.length < 400) { res.why = "page has almost no server-rendered text (client-rendered)"; return res; }
  const ours = eventDays(c).map(d => `${d.m}-${d.d}`);
  const found = dateMentions(text);
  const hit = ours.filter(k => found.has(k));
  if (ours.length && hit.length === ours.length) res.dates = "MATCH";
  else if (hit.length) { res.dates = "PARTIAL"; res.why = `page names ${hit.length}/${ours.length} of our dates`; }
  else {
    // Only call it a mismatch when the page names dates in our months and none of ours.
    const ourMonths = new Set(ours.map(k => k.split("-")[0]));
    const other = [...found].filter(k => ourMonths.has(k.split("-")[0]));
    if (other.length) { res.dates = "MISMATCH?"; res.why = `page names ${other.slice(0, 4).map(k => `${MONTHS[k.split("-")[0]]} ${k.split("-")[1]}`).join(", ")}; ours ${ours.map(k => `${MONTHS[k.split("-")[0]]} ${k.split("-")[1]}`).join(", ")}`; }
    else res.why = "page text names none of our dates";
  }
  const vn = [c.venue?.name, c.locationShort].filter(Boolean);
  if (vn.some(v => norm(text).includes(norm(v)))) res.venue = "MATCH";
  if (res.dates === "MISMATCH?") add("S2", "official page may show different dates (needs a human look)", res.why, url);
  return res;
}

function seoCheck(f, add) {
  const dir = join(ROOT, "f", f.id);
  if (!existsSync(join(dir, "index.html"))) { add("S3", "no public /f/ page", "", null); return { page: false }; }
  const html = readFileSync(join(dir, "index.html"), "utf8");
  const ev = `https://plursky.com/f/${f.id}/`;
  const out = { page: true };
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } });
  const ev0 = ld.find(x => x && x["@type"] === "MusicEvent");
  const dd = eventDays(f.config).map(iso).sort();
  if (ev0) {
    out.startDate = ev0.startDate; out.endDate = ev0.endDate;
    if (dd.length && (ev0.startDate !== dd[0] || ev0.endDate !== dd[dd.length - 1]))
      add("S1", "public page dates differ from the app", `page ${ev0.startDate}..${ev0.endDate}, app "${f.config.dates}"`, ev);
    const pv = ev0.location?.name, av = f.config.venue?.name || f.config.locationShort;
    const all = norm([f.config.venue?.name, f.config.locationShort, f.config.location, f.config.venue?.address].filter(Boolean).join(" "));
    if (pv && av && !all.includes(norm(pv)) && !norm(pv).includes(norm(av)))
      add("S2", "public page venue differs from the app", `page "${pv}", app "${av}"`, ev);
  } else add("S3", "public page has no MusicEvent data", "", ev);
  const sj = join(dir, "schedule.json");
  if (existsSync(sj)) {
    try {
      const s = JSON.parse(readFileSync(sj, "utf8"));
      const byId = new Map(f.artists.map(a => [a.id, a]));
      const acts = s.acts || [];
      out.scheduleActs = acts.length;
      const diff = acts.filter(x => { const a = byId.get(x.id); return !a || a.name !== x.name || a.stage !== x.stage || +a.day !== +x.day || (a.start || null) !== (x.start || null) || (a.end || null) !== (x.end || null); });
      const timedApp = f.artists.filter(a => toMin(a.start) != null).length;
      if (diff.length) add("S1", "public schedule.json differs from the app", `${diff.length}/${acts.length}: ${diff.slice(0, 4).map(x => `${x.name} ${x.start || ""}`).join(", ")}`, ev + "schedule.json");
      else if (acts.length && Math.abs(acts.length - timedApp) > 0 && acts.length !== f.artists.length)
        add("S3", "public schedule.json act count differs from the app", `json ${acts.length}, app ${f.artists.length} (${timedApp} timed)`, ev + "schedule.json");
    } catch (e) { add("S2", "public schedule.json does not parse", String(e.message).slice(0, 80), ev + "schedule.json"); }
  }
  return out;
}

function waivers() {
  const src = readFileSync(join(ROOT, "scripts/verify.mjs"), "utf8");
  const i = src.indexOf("const REGISTRATION_WAIVERS");
  if (i < 0) return {};
  // Walk the object literal: top-level keys are festival ids, each with an expires date.
  let depth = 0, j = src.indexOf("{", i), end = j;
  for (; end < src.length; end++) { if (src[end] === "{") depth++; else if (src[end] === "}" && --depth === 0) break; }
  const body = src.slice(j, end);
  const out = {};
  for (const m of body.matchAll(/["']?([a-z0-9-]+-20\d\d)["']?\s*:\s*\{[\s\S]*?expires:\s*"(\d{4}-\d{2}-\d{2})"/g)) out[m[1]] = m[2];
  return out;
}

// The same flag rule as scripts/find-commons-photos.mjs commonsFlag() (kept in
// step by hand: this audit must run on a main that predates that rule). A
// template on the file page is the authoritative flag; categories back it up.
const FLAG_TEMPLATES = [
  [/^Template:(Delete|Deletion template tag|Speedy ?delete|SD|Speedydelete)$/i, "deletion request"],
  [/^Template:(No permission since|Permission pending|OTRS pending|Wait for permission)$/i, "missing permission"],
  [/^Template:(Copyvio|Copyright violation|Dw no source since|Derivative work)$/i, "copyright dispute"],
  [/^Template:(Disputed|Dispute|Disputed license|License dispute)$/i, "copyright dispute"],
  [/^Template:(No source since|No license since|No license|No source)$/i, "no source or licence"],
  [/^Template:Extracted from deleted$/i, "cropped from a deleted file"],
];
const FLAG_CATEGORIES = [
  [/^Category:Deletion requests\b|^Category:Candidates for speedy deletion|^Category:Other speedy deletions/i, "deletion request"],
  [/^Category:(All )?Media missing permission|^Category:Items with OTRS permission pending|^Category:Items with VRT permission pending/i, "missing permission"],
  [/^Category:(Copyright violations|Possible copyright violations|Disputed|Media with disputed)/i, "copyright dispute"],
  [/^Category:(All )?Media without a (source|license)|^Category:Images without (source|license)/i, "no source or licence"],
];
export function commonsFlag(page) {
  if (!page) return null;
  if (page.missing !== undefined) return "file is gone (deleted or renamed)";
  for (const t of page.templates || []) for (const [re, why] of FLAG_TEMPLATES) if (re.test(t.title)) return `${why} (${t.title})`;
  for (const c of page.categories || []) for (const [re, why] of FLAG_CATEGORIES) if (re.test(c.title)) return `${why} (${c.title})`;
  return null;
}

async function photoLedger() {
  const rows = JSON.parse(readFileSync(join(ROOT, "data/artist-photos/ledger.json"), "utf8"));
  const findings = []; let hashed = 0;
  const titleOf = u => { const m = /commons\.wikimedia\.org\/wiki\/File:(.+)$/.exec(u || ""); return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null; };
  for (const r of rows) {
    const p = join(ROOT, r.asset || "");
    if (!r.asset || !existsSync(p)) { findings.push({ sev: "S1", what: "ledger row points at a missing photo file", detail: `${r.artist}: ${r.asset}`, url: r.sourceUrl }); continue; }
    const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
    hashed++;
    if (r.sha256 && sha !== r.sha256) findings.push({ sev: "S2", what: "photo file differs from its ledger hash", detail: `${r.artist}: ${r.asset}`, url: r.sourceUrl });
    for (const k of ["license", "sourceUrl", "author"]) if (!r[k]) findings.push({ sev: "S2", what: `ledger row missing ${k}`, detail: r.artist, url: r.sourceUrl || null });
  }
  // Commons: 50 file pages per request (templates, categories, licence),
  // following the API's continuation; ~25 requests for 1,200 rows.
  const commonsRows = rows.filter(r => r.source === "commons" && titleOf(r.sourceUrl));
  const pages = new Map(); let unread = 0;
  for (let i = 0; i < commonsRows.length; i += 50) {
    const titles = commonsRows.slice(i, i + 50).map(r => "File:" + titleOf(r.sourceUrl));
    let cont = "";
    for (let n = 0; n < 20; n++) {
      const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=templates|categories|imageinfo&iiprop=extmetadata&tllimit=max&cllimit=max&titles=${encodeURIComponent(titles.join("|"))}${cont}`;
      const res = await politeFetch(api, { json: true });
      let j = null; try { j = res.ok ? JSON.parse(res.text) : null; } catch { j = null; }
      if (!j) { unread += titles.length; findings.push({ sev: "S3", what: "Commons recheck could not run", detail: `batch ${i / 50 + 1}: ${res.status || res.error || "bad JSON"}`, url: "https://commons.wikimedia.org/w/api.php" }); break; }
      const norm = new Map((j.query?.normalized || []).map(x => [x.to, x.from]));
      for (const pg of Object.values(j.query?.pages || {})) {
        const key = (norm.get(pg.title) || pg.title).replace(/^File:/, "").replace(/_/g, " ");
        const have = pages.get(key) || { title: pg.title, templates: [], categories: [] };
        if (pg.missing !== undefined) have.missing = "";
        have.templates.push(...(pg.templates || [])); have.categories.push(...(pg.categories || []));
        if (pg.imageinfo) have.imageinfo = pg.imageinfo;
        pages.set(key, have);
      }
      if (!j.continue) break;
      cont = Object.entries(j.continue).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join("");
    }
  }
  let commons = 0;
  for (const r of commonsRows) {
    const page = pages.get(titleOf(r.sourceUrl));
    if (!page) continue;
    commons++;
    const flag = commonsFlag(page);
    if (flag) { findings.push({ sev: "S1", what: "Commons file is flagged", detail: `${r.artist}: ${flag}`, url: r.sourceUrl }); continue; }
    const lic = page.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value || "";
    const a = (r.license || "").toLowerCase().replace(/[^a-z0-9.]/g, ""), b = lic.toLowerCase().replace(/[^a-z0-9.]/g, "");
    if (lic && a && !b.includes(a) && !a.includes(b)) findings.push({ sev: "S2", what: "Commons licence differs from the ledger", detail: `${r.artist}: ledger ${r.license}, Commons ${lic}`, url: r.sourceUrl });
  }
  return { rows: rows.length, hashed, commons, commonsRows: commonsRows.length, unread, findings };
}

// ---------- self-test: every internal check must fire on a planted defect ----------
if (process.argv.includes("--self-test")) {
  const mk = (id, name, stage, day, start, end, weekend) => ({ id, name, stage, day, start, end, weekend: weekend || null });
  const f = { id: "fixture-2099", tba: false, stages: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "z", name: "Empty" }],
    config: { dates: "Jun 1–2, 2099", year: 2099, dayDates: { 1: { y: 2099, m: 5, d: 1 }, 2: { y: 2099, m: 5, d: 2 } }, hours: { open: "14:00", close: "02:00" } },
    artists: [mk("1", "Real Act", "a", 1, "14:00", "15:00"), mk("2", "Overlapper", "a", 1, "14:30", "15:30"),
      mk("3", "Ghost Stage", "nope", 1, "16:00", "17:00"), mk("4", "Backwards", "b", 1, "18:00", "17:00"),
      mk("5", "Bad Day", "b", 9, "18:00", "19:00"), mk("6", "Odd Minute", "b", 2, "18:07", "19:00"),
      mk("7", "Twin", "b", 2, "20:00", "21:00"), mk("8", "TWIN", "a", 2, "20:30", "21:30"),
      mk("9", "Early Bird", "a", 2, "12:00", "13:00"), mk("10", "Late", "b", 2, "22:00", "23:00")] };
  const got = []; internalChecks(f, (sev, what) => got.push(`${sev} ${what}`));
  const want = ["S1 set on a stage the festival does not have", "S1 two sets overlap on the same stage", "S1 set ends at or before it starts",
    "S1 set on a day the festival does not have", "S3 set time not on a 5-minute mark", "S2 same artist listed twice at the same time",
    "S2 set outside the published gate hours", "S3 stage with zero sets", "S2 no official website recorded (officialEvent)", "S2 no lineup or schedule source recorded"];
  const miss = want.filter(w => !got.includes(w));
  const dm = dateMentions("11 • 12 • 13 DEC 2026 · December 30-31 · 9 JAN 2027");
  const dmWant = ["11-11", "11-12", "11-13", "11-30", "11-31", "0-9"], dmMiss = dmWant.filter(k => !dm.has(k));
  if (dm.has("11-20")) dmMiss.push("read the year 2026 as Dec 20");
  const ed = eventDays({ dates: "Oct 2–4 & 9–11, 2026", year: 2026 }).map(iso).join(",");
  const edOk = ed === "2026-10-02,2026-10-03,2026-10-04,2026-10-09,2026-10-10,2026-10-11";
  const ed2 = eventDays({ dates: "Dec 31, 2026 – Jan 1, 2027", year: 2026 }).map(iso).join(",");
  const ed2Ok = ed2 === "2026-12-31,2027-01-01";
  // Commons flags: the shapes of the five pages #419 shipped with (live, Nov 13),
  // and clean pages that must pass (a broken-file-links category is not a flag).
  const T = t => ({ title: "Template:" + t }), C = c => ({ title: "Category:" + c });
  const flagged = [{ templates: [T("No permission since")] }, { templates: [T("Delete")], categories: [C("Deletion requests November 2026")] },
    { templates: [T("Extracted from deleted")] }, { missing: "" }, { templates: [T("Copyvio")] }, { categories: [C("Media without a license as of 8 November 2026")] }];
  const clean = [{ templates: [T("Information"), T("Cc-by-sa-4.0")], categories: [C("Skrillex")] }, { templates: [T("Extracted from")], categories: [C("Files with broken file links")] }];
  const flagMiss = flagged.filter(p => !commonsFlag(p)).length + clean.filter(p => commonsFlag(p)).length;
  const fail = miss.length || dmMiss.length || !edOk || !ed2Ok || flagMiss;
  console.log(fail
    ? `SELF-TEST FAIL: missed ${JSON.stringify(miss)} dates ${JSON.stringify(dmMiss)} eventDays ${ed} / ${ed2} commonsFlag misses ${flagMiss}`
    : `self-test: ${want.length} planted defects caught, date parsing OK, Commons flags ${flagged.length} caught / ${clean.length} clean pass`);
  process.exit(fail ? 1 : 0);
}

// ---------- run ----------
const t0 = Date.now();
const head = await new Promise(r => { const g = spawn("git", ["rev-parse", "--short=8", "HEAD"], { cwd: ROOT }); let s = ""; g.stdout.on("data", d => s += d); g.on("close", () => r(s.trim())); });
let fests = await readAppData();
if (ONLY.length) fests = fests.filter(f => ONLY.includes(f.id));
const W = waivers();
const results = [];
for (const f of fests) {
  const findings = [];
  const ended = !!(f.config.endMs && f.config.endMs < Date.parse(DATE));
  // S1 means a fan can be misled at an upcoming or live festival. On an edition that
  // already ended, the same schedule defect only shows in the past-editions view: S2.
  const add = (sev, what, detail, url) => {
    if (sev === "S1" && ended && !/photo|Commons/.test(what)) { sev = "S2"; what += " (festival ended)"; }
    findings.push({ sev, what, detail, url });
  };
  const stats = internalChecks(f, add);
  const official = await officialCheck(f, add);
  const seo = seoCheck(f, add);
  const map = { mode: f.config.mapMode || null, anchors: f.config.gpsAnchors?.length || 0, georef: f.config.mapGeoref, waiverExpires: W[f.id] || null };
  map.basis = map.anchors ? `${map.anchors} GPS anchor(s)` : map.georef ? "georeferenced plate" : "none (real map only)";
  if (map.waiverExpires) {
    const days = Math.round((Date.parse(map.waiverExpires) - Date.parse(DATE)) / 864e5);
    map.waiverDays = days;
    const wurl = "https://github.com/jakeoborn/Plursky/blob/main/scripts/verify.mjs";
    if (days < 0) add("S1", "map registration waiver has expired", `expired ${map.waiverExpires}`, wurl);
    else if (days <= 45) add("S2", "map registration waiver expires within 45 days", `${map.waiverExpires} (${days} d)`, wurl);
  }
  results.push({ id: f.id, name: f.config.name, tba: f.tba, ended, stats, official, seo, map, findings });
  process.stdout.write(`${f.id.padEnd(30)} ${findings.length} finding(s) · dates ${official.dates} · venue ${official.venue}\n`);
}
const photos = await photoLedger();

// /f/ pages without a data set (coming-soon pages): listed, not audited.
const fDirs = readdirSync(join(ROOT, "f"), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const orphanPages = fDirs.filter(id => !fests.some(f => f.id === id) && !ONLY.length);

const sevCount = { S1: 0, S2: 0, S3: 0 };
for (const r of results) for (const x of r.findings) sevCount[x.sev]++;
for (const x of photos.findings) sevCount[x.sev]++;
const json = { spec: "SPEC-193 P2", date: DATE, head, runtimeMs: Date.now() - t0, severity: sevCount, festivals: results, photos, pagesWithoutDataSet: orphanPages };
writeFileSync(join(OUT, `festival-truth-${DATE}.json`), JSON.stringify(json, null, 1));

// ---------- markdown ----------
const L = [];
const esc = s => String(s ?? "").replace(/\|/g, "/").replace(/\n/g, " ");
const link = u => u ? `[source](${u})` : "—";
L.push(`# Festival truth audit — ${DATE}`, "",
  `SPEC-193 Phase 2. Read-only. Data read from the running app (\`_DATA_SETS\`) at \`${head}\`. ${results.length} festivals, ${photos.rows} artist-photo ledger rows. Command: \`node scripts/audit-festival-truth.mjs\`.`, "",
  `**Findings: ${sevCount.S1} S1 · ${sevCount.S2} S2 · ${sevCount.S3} S3.**`, "",
  "Severity: **S1** = the app shows a fan something false or broken (wrong date, a set on a stage that doesn't exist, two sets at once on one stage, a deleted photo). **S2** = likely wrong or unproven and needs a look (possible date mismatch, duplicate act, missing provenance, waiver expiring). **S3** = cosmetic or informational.", "",
  "Official checks read only server-rendered text from the official site recorded in the festival's own `officialEvent`. A site that renders in the browser shows up as UNVERIFIED, not MATCH. `MISMATCH?` means the page names other dates in the same month; it is a lead for a human, never proof.", "");
L.push(`Artist photos: ${photos.rows} ledger rows, ${photos.hashed} files hash-checked, ${photos.commons} of ${photos.commonsRows} Commons pages re-read (licence, plus deletion, permission, dispute and no-source templates or categories), ${photos.findings.length} finding(s).`, "");
L.push("## Summary", "", "| Festival | State | Stages | Sets (timed) | Official dates | Official venue | /f/ page | Map basis | Waiver | S1 | S2 | S3 |", "|---|---|--:|--:|---|---|---|---|---|--:|--:|--:|");
for (const r of results) {
  const n = s => r.findings.filter(x => x.sev === s).length;
  const state = r.ended ? "ended" : r.tba ? "TBA" : "live/upcoming";
  L.push(`| ${r.id} | ${state} | ${r.stats.stages} | ${r.stats.sets} (${r.stats.timed}) | ${r.official.dates}${r.official.url ? ` ([fetched ${r.official.fetchedAt?.slice(0, 16) || "—"}](${r.official.url}))` : ""} | ${r.official.venue} | ${r.seo.page ? "yes" : "no"} | ${esc(r.map.basis)} | ${r.map.waiverExpires || "—"} | ${n("S1")} | ${n("S2")} | ${n("S3")} |`);
}
for (const sev of ["S1", "S2", "S3"]) {
  L.push("", `## ${sev} findings`, "");
  const rows = [...results.flatMap(r => r.findings.filter(x => x.sev === sev).map(x => ({ ...x, id: r.id }))), ...photos.findings.filter(x => x.sev === sev).map(x => ({ ...x, id: "artist photos" }))];
  if (!rows.length) { L.push("None."); continue; }
  L.push("| Festival | Finding | Detail | Evidence |", "|---|---|---|---|");
  for (const x of rows) L.push(`| ${x.id} | ${esc(x.what)} | ${esc(x.detail).slice(0, 300)} | ${link(x.url)} |`);
}
L.push("", "## Official-page reads", "", "| Festival | URL | Fetched | Dates | Venue | Why not MATCH |", "|---|---|---|---|---|---|");
for (const r of results) L.push(`| ${r.id} | ${r.official.url || "—"} | ${r.official.fetchedAt || "—"} | ${r.official.dates} | ${r.official.venue} | ${esc(r.official.why)} |`);
if (orphanPages.length) L.push("", "## Public /f/ pages with no data set in the app", "", `${orphanPages.length} pages (coming-soon or archive pages, not audited here): ${orphanPages.join(", ")}.`);
L.push("", "## Not covered", "",
  "- Set-by-set comparison against the official set-time pages: most official schedules are client-rendered or images. The schedule source URL is the evidence link on each row; a human check is still needed before any time is changed.",
  "- Stage names against the official site: names are compared only inside the app's own data (unknown or empty stages).", "");
writeFileSync(join(OUT, `festival-truth-${DATE}.md`), L.join("\n"));
console.log(`\nfestival-truth: ${results.length} festivals, S1 ${sevCount.S1} · S2 ${sevCount.S2} · S3 ${sevCount.S3}, ${((Date.now() - t0) / 1000).toFixed(0)} s → reports/festival-truth-${DATE}.md`);

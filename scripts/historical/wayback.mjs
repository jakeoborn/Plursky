// wayback.mjs — the one door to the Wayback Machine for historical editions.
//
// Past Festivals ships frozen facts read from ARCHIVED OFFICIAL pages. Every
// fetch goes through here so that (a) the requested URL, the resolved archive
// URL and the capture timestamp are always recorded together, (b) requests are
// rate-limited and retried a bounded number of times, and (c) raw research
// artifacts (HTML, schedule graphics) are cached OUTSIDE the repo. The archived
// graphics are not ours to redistribute; only their hashes are checked in.
//
// A capture is never chosen by "closest" alone: resolveCapture() lists the
// captures inside an explicit window and the caller must still prove the
// visible edition (year, dates, asset filenames) before extracting from it.
// ARC's "closest" to 2025 was a 2021 page, which is exactly the trap.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CACHE_DIR = process.env.PLURSKY_HISTORICAL_CACHE
  || join(homedir(), "Plursky-private", "historical-cache");

const UA = "Mozilla/5.0 (Macintosh) Plursky historical-editions research";
const MIN_GAP_MS = 1500;
const RETRIES = 4;
let last = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));
export const sha256 = buf => createHash("sha256").update(buf).digest("hex");

async function politeFetch(url) {
  let err;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    const wait = last + MIN_GAP_MS * (attempt + 1) - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(60000) });
      if (r.status === 429 || r.status >= 500) { err = new Error(`HTTP ${r.status}`); await sleep(4000 * (attempt + 1)); continue; }
      return r;
    } catch (e) { err = e; await sleep(3000 * (attempt + 1)); }
  }
  throw new Error(`${url}: gave up after ${RETRIES} tries (${err?.message}) — stop and report, do not switch sources`);
}

// The raw (un-rewritten) archived bytes: `id_` asks Wayback for the original
// response without its toolbar or URL rewriting.
export const rawUrl = (timestamp, url) => `https://web.archive.org/web/${timestamp}id_/${url}`;
export const viewUrl = (timestamp, url) => `https://web.archive.org/web/${timestamp}/${url}`;

// Relay mode. Some research machines cannot reach the Wayback Machine
// directly; there a fetching client (a scraping service) reads the same CDX
// query and the same raw `id_` captures, and scripts/historical/relay-ingest.mjs
// files them into CACHE_DIR exactly as this module would have, with the
// served timestamp checked and `via` recorded. With PLURSKY_WAYBACK_RELAY=1
// nothing is fetched here: a listing or capture that was not relayed is an
// error, never a guess.
export const RELAY = process.env.PLURSKY_WAYBACK_RELAY === "1";

export const cdxQuery = (url, from, to) => `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&from=${from}&to=${to}`
  + `&filter=statuscode:200&collapse=digest&fl=timestamp,original,digest,length&output=json`;
export const cdxCacheFile = q => join(CACHE_DIR, "cdx", sha256(q).slice(0, 24) + ".json");

// Captures of `url` between `from` and `to` (YYYYMMDD), HTTP 200 only.
export async function listCaptures(url, from, to) {
  const q = cdxQuery(url, from, to);
  let rows;
  if (RELAY) {
    const f = cdxCacheFile(q);
    if (!existsSync(f)) throw new Error(`relay: no CDX listing filed for ${q}`);
    rows = JSON.parse(readFileSync(f, "utf8")).rows;
  } else {
    const r = await politeFetch(q);
    if (!r.ok) throw new Error(`CDX ${r.status} for ${url}`);
    rows = await r.json();
  }
  return rows.slice(1).map(([timestamp, original, digest, length]) => ({ timestamp, original, digest, length: +length }));
}

// Fetch one capture's raw bytes, caching by timestamp + URL. Returns the bytes
// together with the record the ledger needs.
export async function fetchCapture(timestamp, url, { binary = false } = {}) {
  const key = sha256(`${timestamp} ${url}`).slice(0, 24);
  const file = join(CACHE_DIR, key + (binary ? ".bin" : ".html"));
  const meta = file + ".json";
  let buf, rec;
  if (existsSync(file) && existsSync(meta)) {
    rec = JSON.parse(readFileSync(meta, "utf8"));
    // A cache entry is trusted only if it IS the requested capture. An entry
    // written before the exact-capture rule below (or by hand) can hold a
    // neighbour under this key: ACL 2018 W2's 20181206131718 key held a
    // 20190501000000 page. Move it aside (kept as evidence, never read again)
    // and refetch, so a neighbour is never returned under the requested key.
    if (rec.captureTimestamp !== timestamp) {
      const stale = `.stale-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${rec.captureTimestamp || "unknown"}`;
      renameSync(file, file + stale);
      renameSync(meta, meta + stale);
      rec = undefined;
    } else {
      buf = readFileSync(file);
    }
  }
  if (!rec) {
    if (RELAY) throw new Error(`relay: capture ${timestamp} of ${url} was not filed`);
    const r = await politeFetch(rawUrl(timestamp, url));
    if (!r.ok) throw new Error(`${rawUrl(timestamp, url)} → HTTP ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
    // Wayback may serve a neighbouring capture; its real timestamp is in the
    // final URL. Record the one actually served, never the one requested.
    const served = /\/web\/(\d{14})/.exec(r.url)?.[1] || timestamp;
    rec = { requestedUrl: url, requestedTimestamp: timestamp, captureTimestamp: served,
      archivedUrl: viewUrl(served, url), contentType: r.headers.get("content-type"),
      sha256: sha256(buf), bytes: buf.length, observedAt: new Date().toISOString() };
    // Only the exact capture is cached under its own key. A neighbour is
    // returned (and recorded as served) but not kept, or every later run would
    // get the neighbour back: ACL 2018 W2's 2018-12-06 key had held a 2019
    // page since 2026-10-22 although Wayback serves the 2018 capture.
    if (served === timestamp) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(file, buf);
      writeFileSync(meta, JSON.stringify(rec, null, 2));
    }
  }
  return { buf, text: binary ? null : buf.toString("utf8"), file, ...rec };
}

// A capture belongs to `year` only if the page itself says so. Returns the
// evidence found, so a ledger can show WHY a capture was accepted.
export function editionEvidence(html, year) {
  const y = String(year), other = [];
  const hits = (html.match(new RegExp(`\\b${y}\\b`, "g")) || []).length;
  for (const o of [year - 1, year + 1]) {
    const n = (html.match(new RegExp(`\\b${o}\\b`, "g")) || []).length;
    if (n) other.push(`${o}×${n}`);
  }
  return { year: y, hits, other };
}

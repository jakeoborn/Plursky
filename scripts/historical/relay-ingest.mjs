#!/usr/bin/env node
// relay-ingest.mjs — file what a fetching client read from the Wayback Machine
// into the research cache, for machines that cannot reach it directly
// (PLURSKY_WAYBACK_RELAY=1 in wayback.mjs).
//
//   node scripts/historical/relay-ingest.mjs cdx <url> <from> <to> <listing.json> <via>
//   node scripts/historical/relay-ingest.mjs capture <timestamp> <url> <result.json> <via>
//
// cdx: <listing.json> is the CDX response for exactly cdxQuery(url, from, to),
// a JSON array whose first row is the header.
// capture: <result.json> is the client's saved result for
// rawUrl(timestamp, url): an object with `rawHtml` and `metadata.url` (the URL
// finally served). A capture is filed only if the served URL is the requested
// timestamp's `id_` capture: Wayback answers a missing timestamp with a
// neighbour, and a neighbour is never filed under the requested key.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CACHE_DIR, cdxQuery, cdxCacheFile, rawUrl, viewUrl, sha256 } from "./wayback.mjs";

const [kind, ...a] = process.argv.slice(2);
if (kind === "cdx") {
  const [url, from, to, file, via] = a;
  const rows = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(rows) || rows[0]?.[0] !== "timestamp" || rows.slice(1).some(r => !/^\d{14}$/.test(r[0])))
    throw new Error(`${file}: not a CDX listing (header row, then 14-digit timestamps)`);
  const q = cdxQuery(url, from, to), out = cdxCacheFile(q);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ query: q, via, observedAt: new Date().toISOString(), rows }, null, 1));
  console.log(`cdx ${url} ${from}-${to}: ${rows.length - 1} captures`);
} else if (kind === "capture") {
  const [timestamp, url, file, via] = a;
  const res = JSON.parse(readFileSync(file, "utf8"));
  const html = res.rawHtml, served = res.metadata?.url || res.metadata?.sourceURL || "";
  const ts = /\/web\/(\d{14})id_\//.exec(served)?.[1];
  if (typeof html !== "string" || !html.length) throw new Error(`${file}: no rawHtml`);
  if (ts !== timestamp) { console.log(`✗ ${timestamp} ${url}: served ${served || "?"} — not filed`); process.exit(3); }
  if ((res.metadata?.statusCode ?? 200) !== 200) { console.log(`✗ ${timestamp} ${url}: HTTP ${res.metadata.statusCode} — not filed`); process.exit(3); }
  const buf = Buffer.from(html, "utf8");
  const key = sha256(`${timestamp} ${url}`).slice(0, 24);
  const f = join(CACHE_DIR, key + ".html");
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(f, buf);
  writeFileSync(f + ".json", JSON.stringify({ requestedUrl: url, requestedTimestamp: timestamp, captureTimestamp: timestamp,
    archivedUrl: viewUrl(timestamp, url), contentType: res.metadata?.contentType || null, sha256: sha256(buf), bytes: buf.length,
    observedAt: new Date().toISOString(), via, relayedFrom: rawUrl(timestamp, url) }, null, 2));
  console.log(`✓ ${timestamp} ${url}: ${buf.length} bytes`);
} else {
  console.error("usage: relay-ingest.mjs cdx <url> <from> <to> <listing.json> <via> | capture <timestamp> <url> <result.json> <via>");
  process.exit(2);
}

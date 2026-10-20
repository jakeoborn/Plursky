#!/usr/bin/env node
// watch-edco-map.mjs: has Insomniac published the official EDC Orlando 2026
// map yet? Run every Monday by .github/workflows/edco-map-watch.yml.
//
//   exit 0  every page was read and the scan found no map candidate. That is
//           what the scan saw, not proof that no map exists anywhere.
//   exit 1  map candidate(s) found: a human inspects the source and rebuilds
//           from verified official evidence before the Nov 6-8 flip
//           (scripts/build-edco-map-2026.mjs, steps 1-6 in its header). A
//           candidate is an alert, never a map and never leave to place pins.
//   exit 2  no candidate, and a page could not be read (HTTP error, timeout,
//           fetch or parse failure): the answer is UNKNOWN, not "no map"
//
// A red run is the alert. It reads first-party pages only, and it never
// downloads, crops or ships the art; the flip session does that by hand.
//
// Candidates come from every URL-bearing attribute (href, src, srcset,
// data-src…, poster, and an image <meta>'s content), resolved against the page's FINAL URL after
// redirects (or its <base href>), plus absolute URLs anywhere in the text. An
// absolute-only scan missed relative map links once already (the Lost Lands
// source note in data.jsx); Codex P1 on #337 caught this watcher doing it again.
//
// EDCO_WATCH_PAGES (comma-separated URLs) and EDCO_WATCH_TIMEOUT_MS exist for
// scripts/test-watch-edco-map.mjs, which runs this entrypoint against a local
// server; the workflow sets neither.

import { pathToFileURL } from "node:url";

export const PAGES = [
  "https://orlando.edc.com/guide/",
  "https://orlando.edc.com/experience/stages/",
  "https://orlando.edc.com/info/",
];

// Attributes that carry a URL (srcset-style ones carry a list).
const URL_ATTR = /\s(href|src|srcset|data-src|data-srcset|data-href|data-lazy-src|data-original|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
// <meta property="og:image" content="…">: content is a URL only on an image
// meta; a description's prose is not one.
const META_TAG = /<meta\b[^>]*>/gi;
const ATTR = name => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
const ABSOLUTE = /(?:https?:)?\/\/[^"'\s)<>\\]+/gi;
const ASSET_EXT = /\.(?:jpe?g|png|webp|pdf)$/i;

// The usual HTML attribute encoding: named &amp; &quot; &apos; &lt; &gt; and
// numeric &#NN; / &#xHH; references.
export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(quot|apos|lt|gt|amp);/g, (_, n) => ({ quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" })[n]);
}

// Every raw URL candidate on the page, attribute values decoded.
export function extractCandidates(html) {
  const out = [];
  for (const m of html.matchAll(URL_ATTR)) {
    const name = m[1].toLowerCase(), v = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!v) continue;
    if (name.endsWith("srcset")) for (const part of v.split(",")) { const u = part.trim().split(/\s+/)[0]; if (u) out.push(u); }
    else out.push(v);
  }
  for (const [tag] of html.matchAll(META_TAG)) {
    const key = ATTR("(?:property|name|itemprop)").exec(tag), content = ATTR("content").exec(tag);
    const k = key && (key[1] ?? key[2] ?? key[3]), v = content && decodeEntities(content[1] ?? content[2] ?? content[3]).trim();
    if (k && /image/i.test(k) && v) out.push(v);
  }
  // Absolute and protocol-relative URLs in inline scripts and JSON too, with
  // JSON's escaped slashes undone.
  for (const m of decodeEntities(html.replace(/\\\//g, "/")).matchAll(ABSOLUTE)) out.push(m[0]);
  return out;
}

// The URL relative candidates resolve against: <base href> (itself resolved
// against the final URL) when the page has a valid one, else the final URL.
export function documentBase(html, finalUrl) {
  const m = /<base\b[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(html);
  if (m) { try { return new URL(decodeEntities(m[1] ?? m[2] ?? m[3]).trim(), finalUrl).href; } catch {} }
  return finalUrl;
}

// Map candidates on one page: resolved http(s) URLs (query and fragment kept)
// whose path names a map (any segment) and ends in an image or PDF type, as
// the absolute-only scan did. Sitemaps are not maps.
export function mapCandidates(html, finalUrl) {
  const base = documentBase(html, finalUrl), found = new Set();
  for (const raw of extractCandidates(html)) {
    let u;
    try { u = new URL(raw, base); } catch { continue; }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    let path = u.pathname;
    try { path = decodeURIComponent(path); } catch {}
    if (/sitemap/i.test(path) || !/map/i.test(path) || !ASSET_EXT.test(path)) continue;
    found.add(u.href);
  }
  return [...found];
}

export async function main(pages = PAGES, timeoutMs = 20000) {
  const unreadable = [], found = new Map();
  for (const url of pages) {
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "Mozilla/5.0 (Plursky map watch)" } });
      if (!res.ok) { unreadable.push(`${url} → HTTP ${res.status}`); console.log(`✗ ${url} → HTTP ${res.status}`); continue; }
      const hits = mapCandidates(await res.text(), res.url || url);
      for (const h of hits) if (!found.has(h)) found.set(h, url);
      console.log(`· ${url}${res.url && res.url !== url ? ` (→ ${res.url})` : ""} → ${hits.length} map candidate(s)`);
    } catch (e) {
      const why = e?.name === "TimeoutError" ? `timed out after ${timeoutMs} ms` : `${e?.message || e}${e?.cause?.message ? ` (${e.cause.message})` : ""}`;
      unreadable.push(`${url} → ${why}`); console.log(`✗ ${url} → ${why}`);
    }
  }
  if (found.size) {
    console.log(`\n✗ OFFICIAL MAP CANDIDATE(S): inspect each source by hand and rebuild EDC Orlando from verified official evidence before the flip. A candidate is not a map and authorizes no pins:`);
    for (const [u, page] of found) console.log(`  ${u}   (on ${page})`);
    if (unreadable.length) {
      console.log(`\n  Also ${unreadable.length} page(s) could not be read, so this list may be incomplete:`);
      for (const r of unreadable) console.log(`  ${r}`);
    }
    return 1;
  }
  if (unreadable.length) {
    console.log(`\n✗ UNKNOWN: ${unreadable.length} of ${pages.length} page(s) could not be read, so "no candidate" is not established:`);
    for (const r of unreadable) console.log(`  ${r}`);
    return 2;
  }
  console.log(`\n✓ all ${pages.length} page(s) read; the scan found no map candidate (not proof that no map is published)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pages = process.env.EDCO_WATCH_PAGES ? process.env.EDCO_WATCH_PAGES.split(",").map(s => s.trim()).filter(Boolean) : PAGES;
  const timeout = Number(process.env.EDCO_WATCH_TIMEOUT_MS) || 20000;
  process.exit(await main(pages, timeout));
}

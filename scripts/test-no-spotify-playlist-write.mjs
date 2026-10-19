#!/usr/bin/env node
// Spotify is read-only in Plursky: it can't build playlists for us, so the
// app keeps only what Spotify still gives (the listening import and artist
// photos). This gate fails if any shipped source
//   - requests a playlist-modify scope,
//   - sends a non-GET request to the Spotify Web API (api.spotify.com), or
//   - brings back a removed Spotify playlist builder by name.
// Positive controls keep it honest: the read scopes the import needs are still
// requested in both auth paths, and the Apple Music playlist POST is still
// found by the same write detector (so a detector that matches nothing fails).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync, traverse } from "@babel/core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const bad = [];
const files = execFileSync("git", ["ls-files", "*.jsx", "*.html", "build/*.js"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(f => f && !f.startsWith("ios/") && !f.startsWith("f/"));
const src = Object.fromEntries(files.map(f => [f, readFileSync(join(ROOT, f), "utf8")]));

// 1. No write scope, anywhere it could be requested from.
for (const [f, s] of Object.entries(src)) {
  s.split("\n").forEach((l, i) => { if (/playlist-modify-(public|private)/.test(l)) bad.push(`${f}:${i + 1} requests a playlist-modify scope`); });
}

// 2. No removed builder comes back under its old name.
const GONE = ["createSetsPlaylist", "createEdcPlaylist", "createHypePlaylist", "_createPlurskyPlaylist",
  "_hasPlaylistWriteScope", "_applyPlaylistVisibility", "BuildPlaylistButton", "BoardPlaylistCard"];
for (const [f, s] of Object.entries(src)) for (const n of GONE) {
  s.split("\n").forEach((l, i) => { if (new RegExp(`\\b${n}\\b`).test(l)) bad.push(`${f}:${i + 1} names the removed Spotify builder ${n}`); });
}

// 3. Every fetch-like call: which host, which method.
const writes = [];
for (const f of files.filter(f => f.endsWith(".jsx"))) {
  const ast = parseSync(src[f], { filename: f, presets: [["@babel/preset-react", {}]], babelrc: false, configFile: false });
  traverse(ast, {
    CallExpression(p) {
      const callee = p.node.callee;
      const name = callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && callee.property.type === "Identifier" ? callee.property.name : "";
      if (!/^fetch/.test(name)) return;
      const [url, opts] = p.node.arguments;
      if (!url) return;
      const text = src[f].slice(url.start, url.end);
      const host = /api\.spotify\.com/.test(text) ? "spotify" : /api\.music\.apple\.com/.test(text) ? "apple" : null;
      if (!host) return;
      let method = "GET";
      if (opts?.type === "ObjectExpression") {
        const m = opts.properties.find(pr => pr.key && (pr.key.name === "method" || pr.key.value === "method"));
        if (m) method = m.value.type === "StringLiteral" ? m.value.value.toUpperCase() : "DYNAMIC";
      } else if (opts) method = "DYNAMIC";
      if (method !== "GET") writes.push({ host, method, at: `${f}:${p.node.loc.start.line}` });
    },
  });
}
for (const w of writes.filter(w => w.host === "spotify")) bad.push(`${w.at} sends ${w.method} to the Spotify Web API`);

// Positive controls.
const scopesOf = (f, re) => (src[f]?.match(re) || [])[1] || "";
const apiScopes = scopesOf("spotify-api.jsx", /const SPOTIFY_SCOPES\s*=\s*"([^"]*)"/);
const sbScopes = scopesOf("supabase.jsx", /provider: "spotify",[\s\S]*?scopes: "([^"]*)"/);
for (const [where, s] of [["spotify-api.jsx SPOTIFY_SCOPES", apiScopes], ["supabase.jsx Spotify OAuth", sbScopes]]) {
  for (const need of ["user-top-read", "user-follow-read", "playlist-read-private"])
    if (!s.split(/\s+/).includes(need)) bad.push(`${where} lost the read scope ${need} (control)`);
}
if (!writes.some(w => w.host === "apple" && w.method === "POST"))
  bad.push("the Apple Music playlist POST was not found, so the write detector is matching nothing (control)");
if (!/function createAppleMusicPlaylist\(/.test(src["spotify-api.jsx"] || "")) bad.push("createAppleMusicPlaylist is gone (Apple Music keeps its playlist builder)");

if (bad.length) {
  console.log(`✗ spotify read-only: ${bad.length} problem(s)`);
  for (const b of bad) console.log(`  ✗ ${b}`);
  process.exit(1);
}
console.log(`✓ spotify read-only: ${files.length} files, no playlist-modify scope, 0 Spotify write calls; read scopes kept in both auth paths; Apple Music POST still detected (${writes.filter(w => w.host === "apple").length} Apple write call(s))`);

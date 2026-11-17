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

// 3. Every network call: which host, which method. The URL is resolved through
// variable bindings, reassignments, top-level constants in other files, and
// helper parameters (traced to each call site's argument), so a write can't hide
// behind `const url = …; fetch(url, …)` or a wrapper like `pull(url)`. A write
// whose host can't be resolved fails too.
const parse = (code, filename) => parseSync(code, { filename, presets: [["@babel/preset-react", {}]], babelrc: false, configFile: false });
const isFetch = c => (c.type === "Identifier" && c.name === "fetch") ||
  (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier" && c.property.name === "fetch");
const LITERAL_INIT = new Set(["StringLiteral", "TemplateLiteral", "BinaryExpression", "ObjectExpression"]);

// Top-level constants are globals across the <script> chain (no bundler).
function globalsOf(units) {
  const g = {};
  for (const { ast, code } of units) for (const st of ast.program.body) {
    if (st.type !== "VariableDeclaration") continue;
    for (const d of st.declarations) if (d.id.type === "Identifier" && d.init && LITERAL_INIT.has(d.init.type))
      g[d.id.name] = code.slice(d.init.start, d.init.end);
  }
  return g;
}

function urlTexts(path, code, globals, seen = new Set(), depth = 0) {
  const out = { texts: [code.slice(path.node.start, path.node.end)], unresolved: false };
  if (depth > 6) { out.unresolved = true; return out; }
  const ids = path.isIdentifier() ? [path] : [];
  path.traverse({ Identifier(ip) { if (ip.isReferencedIdentifier()) ids.push(ip); } });
  const add = r => { out.texts.push(...r.texts); if (r.unresolved) out.unresolved = true; };
  for (const ip of ids) {
    const name = ip.node.name, b = ip.scope.getBinding(name);
    if (!b) { if (name in globals) out.texts.push(globals[name]); else if (ip === path) out.unresolved = true; continue; }
    if (seen.has(b)) continue;
    seen.add(b);
    if (b.kind === "param") {
      const fn = b.scope.path, i = fn.node.params.indexOf(b.path.node);
      const fnName = fn.node.id?.name || (fn.parentPath.isVariableDeclarator() ? fn.parentPath.node.id.name : null);
      const fb = fnName && fn.parentPath.scope.getBinding(fnName);
      const sites = (fb?.referencePaths || []).filter(r => r.parentPath.isCallExpression() && r.parentPath.node.callee === r.node);
      if (i < 0 || !sites.length) { out.unresolved = true; continue; }
      for (const r of sites) { const a = r.parentPath.get("arguments")[i]; if (a) add(urlTexts(a, code, globals, seen, depth + 1)); else out.unresolved = true; }
      continue;
    }
    if (b.path.isVariableDeclarator() && b.path.node.init) add(urlTexts(b.path.get("init"), code, globals, seen, depth + 1));
    else if (ip === path) out.unresolved = true;
    for (const v of b.constantViolations) if (v.isAssignmentExpression()) add(urlTexts(v.get("right"), code, globals, seen, depth + 1));
  }
  return out;
}

// The method, traced like the URL: an opts variable or a helper parameter
// resolves to each call site's argument; anything opaque counts as a write.
function methodOf(optsPath, depth = 0) {
  if (!optsPath?.node) return "GET";
  let o = optsPath.node;
  if (o.type === "Identifier") {
    const b = optsPath.scope.getBinding(o.name);
    if (b?.kind === "param" && depth < 6) {
      const fn = b.scope.path, i = fn.node.params.indexOf(b.path.node);
      const fnName = fn.node.id?.name || (fn.parentPath.isVariableDeclarator() ? fn.parentPath.node.id.name : null);
      const fb = fnName && fn.parentPath.scope.getBinding(fnName);
      const sites = (fb?.referencePaths || []).filter(r => r.parentPath.isCallExpression() && r.parentPath.node.callee === r.node);
      if (i < 0 || !sites.length) return "DYNAMIC";
      const ms = sites.map(r => methodOf(r.parentPath.get("arguments")[i], depth + 1));
      return ms.find(m => m !== "GET") || "GET";
    }
    o = b?.path.isVariableDeclarator() && !b.constantViolations.length ? b.path.node.init : null;
  }
  if (o?.type !== "ObjectExpression") return "DYNAMIC";
  const m = o.properties.find(pr => pr.key && (pr.key.name === "method" || pr.key.value === "method"));
  if (!m) return o.properties.some(pr => pr.type === "SpreadElement") ? "DYNAMIC" : "GET";
  return m.value.type === "StringLiteral" ? m.value.value.toUpperCase() : "DYNAMIC";
}

function writesIn(units, globals) {
  const found = [];
  for (const { ast, code, file, lineOffset = 0 } of units) traverse(ast, {
    CallExpression(p) {
      if (!isFetch(p.node.callee) || !p.node.arguments.length) return;
      const method = methodOf(p.get("arguments")[1]);
      if (method === "GET") return;
      const { texts, unresolved } = urlTexts(p.get("arguments")[0], code, globals);
      const all = texts.join("\n");
      const host = /api\.spotify\.com/.test(all) ? "spotify" : /api\.music\.apple\.com/.test(all) ? "apple"
        : /https?:\/\//.test(all) && !unresolved ? "other" : "unknown";
      found.push({ host, method, at: `${file}:${p.node.loc.start.line + lineOffset}` });
    },
  });
  return found;
}

// Shipped units: every .jsx, plus each inline <script> in the .html pages.
const units = [];
for (const f of files) {
  if (f.endsWith(".jsx")) units.push({ file: f, code: src[f], ast: parse(src[f], f) });
  else if (f.endsWith(".html")) for (const m of src[f].matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1].trim()) continue;
    const lineOffset = src[f].slice(0, m.index).split("\n").length - 1;
    units.push({ file: f, code: m[1], ast: parse(m[1], f + ".js"), lineOffset });
  }
}
const globals = globalsOf(units);
const writes = writesIn(units, globals);
for (const w of writes.filter(w => w.host === "spotify")) bad.push(`${w.at} sends ${w.method} to the Spotify Web API`);
for (const w of writes.filter(w => w.host === "unknown")) bad.push(`${w.at} sends ${w.method} to a URL this gate can't resolve (make the host traceable)`);

// Detector self-test: each indirect form must be caught, and its GET twin must not.
const FIXTURES = {
  "const via variable": `const u = "https://api.spotify.com/v1/users/x/playlists"; fetch(u, { method: "POST" });`,
  "let reassigned": `let u = "/x"; u = "https://api.spotify.com/v1/playlists/1/tracks"; fetch(u, { method: "PUT" });`,
  "helper parameter": `const h = async (url) => fetch(url, { method: "POST", headers: {} }); h(\`https://api.spotify.com/v1/users/\${id}/playlists\`);`,
  "function declaration parameter": `async function pull(url, opts) { return fetch(url, opts); } pull("https://api.spotify.com/v1/me", { method: "POST" });`,
  "constant base in template": `const B = "https://api.spotify.com/v1"; fetch(\`\${B}/me/playlists\`, { method: "POST" });`,
  "opts held in a variable": `const o = { method: "DELETE" }; fetch("https://api.spotify.com/v1/me/tracks", o);`,
  "global base from another file": `fetch(SPOTIFY_FIXTURE_BASE + "/playlists", { method: "POST" });`,
};
const fixtureGlobals = { SPOTIFY_FIXTURE_BASE: '"https://api.spotify.com/v1"' };
for (const [name, code] of Object.entries(FIXTURES)) {
  const hit = writesIn([{ file: "fixture", code, ast: parse(code, "fixture.jsx") }], fixtureGlobals).some(w => w.host === "spotify");
  if (!hit) bad.push(`detector missed a Spotify write via ${name} (control)`);
  const getTwin = code.replace(/method: "(POST|PUT|DELETE)"/, 'method: "GET"');
  if (writesIn([{ file: "fixture", code: getTwin, ast: parse(getTwin, "fixture.jsx") }], fixtureGlobals).length)
    bad.push(`detector flagged the GET twin of ${name} (control)`);
}

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
console.log(`✓ spotify read-only: ${files.length} files, no playlist-modify scope, 0 Spotify write calls (URLs traced through bindings and helper params; ${Object.keys(FIXTURES).length} indirect forms caught); read scopes kept in both auth paths; Apple Music POST still detected (${writes.filter(w => w.host === "apple").length} Apple write call(s))`);

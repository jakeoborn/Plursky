#!/usr/bin/env node
// Precompiles every JSX source into plain JS under build/.
//
// WHY THIS EXISTS
// Until v253 the app shipped raw .jsx and let babel-standalone transpile
// ~1.7MB of it in the browser on every cold boot, on top of React's
// DEVELOPMENT builds. Desktop Chrome absorbs that; iOS Safari hits its memory
// ceiling and kills the tab mid-compile, and on restore the user sees the
// static boot shell with dead scripts. No error, no error-boundary card — the
// app simply never mounts. Compiling here means the phone downloads finished
// JS and runs it.
//
// INVARIANTS THIS MUST NOT BREAK
//  · runtime:"classic" — Babel 8's preset-react defaults to the AUTOMATIC
//    runtime, which emits `require("react/jsx-runtime")`. That is a hard
//    crash in a browser with no module loader. Do not remove this.
//  · sourceType:"script" — every file is loaded via a classic <script> tag and
//    the whole app depends on top-level declarations becoming globals
//    (CLAUDE.md §5). Module mode would change that.
//  · Top-level `const`/`let` MUST be lowered to `var` — see the PLUGINS note
//    below. This is the opposite of what it looks like it should be, and
//    getting it wrong breaks the festival switch silently.
//  · Output order and filenames mirror index.html exactly — index.html IS the
//    manifest, so the two cannot drift.
import { transformAsync } from "@babel/core";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "build";

// index.html is the single source of truth for what gets compiled and in what
// order. Both tag shapes are matched so this works before AND after the
// one-time switch from text/babel to compiled tags.
export function compileTargets(html) {
  const out = [];
  const re = /<script\b[^>]*\bsrc="(?:build\/)?([A-Za-z0-9._-]+)\.(?:jsx|js)(?:\?[^"]*)?"[^>]*>/g;
  for (const m of html.matchAll(re)) {
    const tag = m[0], name = m[1];
    const isBabel = /type="text\/babel"/.test(tag);
    const isBuilt = /src="build\//.test(tag);
    if (!isBabel && !isBuilt) continue;      // CDN + data/festivals/*.js stay as-is
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

const PRESETS = [
  ["@babel/preset-react", { runtime: "classic", development: false }],
  // Floor, not a rewrite: iOS 15 already supports everything these sources
  // use, so this is close to a no-op today. It is here so that the day
  // somebody writes syntax an older iPhone cannot parse, the build lowers it
  // instead of the phone silently failing to boot.
  ["@babel/preset-env", { targets: { ios: "15" }, modules: false }],
];

// ⚠ LOAD-BEARING, DO NOT REMOVE — CLAUDE.md §5.
// babel-standalone lowered every top-level `const`/`let` to `var`, and in a
// classic script `var` creates a WINDOW PROPERTY while `const` creates a
// lexical binding that SHADOWS one. The whole multi-festival switch depends
// on the former: data.jsx ends with Object.assign(window, {FESTIVAL_CONFIG:
// <active>, ARTISTS: <active>, …}) and every later file reads those by bare
// name. Compile `const` as `const` and those bare names resolve to the
// shadowing EDC base declarations instead — measured, not theorised: the app
// booted, mounted, passed 14/14 globals, and quietly served EDC's config on
// ACL. preset-env at an iOS 15 target does NOT lower these (iOS 15 supports
// const), so the transform is pinned on explicitly, independent of targets.
const PLUGINS = [
  "@babel/plugin-transform-block-scoping",
];

export async function compileOne(name) {
  const src = join(ROOT, `${name}.jsx`);
  const file = existsSync(src) ? src : join(ROOT, `${name}.js`);
  const code = readFileSync(file, "utf8");
  const res = await transformAsync(code, {
    filename: file,
    presets: PRESETS,
    plugins: PLUGINS,
    babelrc: false,
    configFile: false,
    sourceType: "script",
    compact: false,
    comments: false,
  });
  return res.code;
}

// Refuse to ship syntax that is known to kill the parse on the iPhones we
// still support. A parse failure takes the whole script tag out silently,
// which is the same class of invisible failure this script exists to end.
const HOSTILE = [
  [/\(\?<[=!]/, "regex lookbehind (iOS <16.4 SyntaxError)"],
  [/\bObject\.groupBy\b/, "Object.groupBy (iOS 17.4+)"],
  [/\.toSorted\(/, "Array.toSorted (iOS 16.4+)"],
  [/\.toReversed\(/, "Array.toReversed (iOS 16.4+)"],
  [/\.findLast\(/, "Array.findLast (iOS 15.4+)"],
  [/\bstructuredClone\b/, "structuredClone (iOS 15.4+)"],
];

export function hostileSyntax(code) {
  return HOSTILE.filter(([re]) => re.test(code)).map(([, why]) => why);
}

async function main() {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const names = compileTargets(html);
  if (!names.length) {
    console.error("[compile] no compile targets found in index.html");
    process.exit(1);
  }
  rmSync(join(ROOT, OUT), { recursive: true, force: true });
  mkdirSync(join(ROOT, OUT), { recursive: true });

  let bytesIn = 0, bytesOut = 0, bad = 0;
  for (const name of names) {
    const code = await compileOne(name);
    const hostile = hostileSyntax(code);
    if (hostile.length) {
      console.error(`  ✗ ${name}.js — ${hostile.join(", ")}`);
      bad++;
    }
    const srcPath = existsSync(join(ROOT, `${name}.jsx`)) ? `${name}.jsx` : `${name}.js`;
    bytesIn += readFileSync(join(ROOT, srcPath)).length;
    bytesOut += Buffer.byteLength(code);
    writeFileSync(join(ROOT, OUT, `${name}.js`), code);
  }
  if (bad) {
    console.error(`[compile] ${bad} file(s) contain iOS-hostile syntax`);
    process.exit(1);
  }
  const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
  console.log(`[compile] ${names.length} file(s) → ${OUT}/  ${kb(bytesIn)} jsx → ${kb(bytesOut)} js`);
  console.log(`[compile] order: ${names.join(" → ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

#!/usr/bin/env node
// A `//` line comment inside JSX is not a comment: Babel reads it as a text
// child and React renders it. ToastHost carried three of them from v393 (#275)
// until v435, so every toast on plursky.com printed "// Board toast: an
// elevated card…" next to its message and the flex row crushed the real text
// to one letter per line. Nothing failed, because the code is valid JSX.
//
// This gate parses every tracked .jsx file and fails on any JSX text line
// that starts with `//` (or `/*`). Comments inside JSX belong in `{/* … */}`.
//
//   node scripts/test-no-stray-jsx-comments.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync, traverse } from "@babel/core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = execFileSync("git", ["ls-files", "*.jsx", ":!ios/**"], { cwd: ROOT, encoding: "utf8" })
  .split("\n").filter(Boolean);

const hits = [];
for (const file of files) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const ast = parseSync(src, {
    filename: file, sourceType: "script", babelrc: false, configFile: false,
    parserOpts: { plugins: ["jsx"] },
  });
  traverse(ast, {
    JSXText(path) {
      const { value, loc } = path.node;
      value.split("\n").forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith("//") || t.startsWith("/*")) {
          hits.push(`${file}:${loc.start.line + i}  ${t.slice(0, 80)}`);
        }
      });
    },
  });
}

if (files.length < 10) {
  console.error(`✗ no-stray-jsx-comments: only ${files.length} .jsx files found (the scan broke?)`);
  process.exit(1);
}
if (hits.length) {
  console.error(`✗ no-stray-jsx-comments: ${hits.length} comment line(s) render as JSX text — wrap them in {/* */}`);
  for (const h of hits) console.error(`  ✗ ${h}`);
  process.exit(1);
}
console.log(`✓ no-stray-jsx-comments: ${files.length} .jsx files, no comment text rendered as JSX children`);

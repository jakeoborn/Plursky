#!/usr/bin/env node
// gen-festival-pages.mjs must stop with f/ intact when sitemap-lastmod.json
// does not parse. A merge once left conflict markers in that file; the
// generator cleared f/ and then crashed, and the commit dropped all 75 pages.
// Runs the real generator on a throwaway copy of the committed tree.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
let pass = 0, failed = 0;
const ok = (c, l) => { if (c) pass++; else { failed++; console.log("  ✗ " + l); } };
const count = (d) => existsSync(d) ? readdirSync(d, { recursive: true }).length : 0;

function copyTree() {
  const dir = mkdtempSync(join(tmpdir(), "gen-pages-"));
  // The working tree's own copy of this script and the generator, so an
  // uncommitted fix is what gets tested; everything else from HEAD.
  const tar = execFileSync("git", ["-C", ROOT, "archive", "HEAD"], { maxBuffer: 1 << 30 });
  spawnSync("tar", ["-x", "-C", dir], { input: tar });
  writeFileSync(join(dir, "scripts", "gen-festival-pages.mjs"), readFileSync(join(ROOT, "scripts", "gen-festival-pages.mjs")));
  if (existsSync(join(ROOT, "node_modules")) && !existsSync(join(dir, "node_modules"))) symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
  return dir;
}
const gen = (dir) => spawnSync(process.execPath, [join(dir, "scripts", "gen-festival-pages.mjs")], { cwd: dir, encoding: "utf8" });

const dir = copyTree();
try {
  const before = count(join(dir, "f"));
  ok(before > 0, `the copy has f/ pages (got ${before})`);

  // Control: a clean ledger regenerates and keeps every page.
  let r = gen(dir);
  ok(r.status === 0, `clean ledger: generator exits 0 (${(r.stderr || "").split("\n").slice(-3).join(" ")})`);
  ok(count(join(dir, "f")) === before, "clean ledger: f/ keeps its page count");

  // A ledger with conflict markers: exit non-zero, f/ untouched, says why.
  const ledger = join(dir, "sitemap-lastmod.json");
  const lines = readFileSync(ledger, "utf8").split("\n");
  lines.splice(3, 0, "<<<<<<< HEAD", "=======", ">>>>>>> origin/main");
  writeFileSync(ledger, lines.join("\n"));
  r = gen(dir);
  ok(r.status !== 0, "conflicted ledger: generator exits non-zero");
  ok(count(join(dir, "f")) === before, `conflicted ledger: f/ untouched (${count(join(dir, "f"))} of ${before})`);
  ok(/sitemap-lastmod\.json does not parse/.test(r.stderr || ""), "conflicted ledger: the error names the file");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`  ${failed ? "✗" : "✓"} gen pages safe clear: ${pass}/${pass + failed} checks`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// Gate for scripts/session-note.mjs, the SessionStart hook's note. It proves
// the contract the hook relies on: at most 30 lines, exit 0 on every input,
// read-only, no network, no credential-looking lines, and the hook wiring in
// .claude/settings.json points at the script.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCRIPT = join(ROOT, "scripts", "session-note.mjs");
let pass = 0, failed = 0;
const ok = (cond, label) => { if (cond) pass++; else { failed++; console.log("  ✗ " + label); } };

function run(env) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT], { encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || "") };
  }
}

const tmp = mkdtempSync(join(tmpdir(), "session-note-"));
try {
  const dl = join(tmp, "dl"), priv = join(tmp, "priv");
  mkdirSync(dl); mkdirSync(priv);
  const today = "2026-11-12";
  const base = { PLURSKY_NOTE_TODAY: today, PLURSKY_MORNING_DIRS: `${dl}:${priv}`, PLURSKY_BEACON_SUMMARY: join(tmp, "nope.md") };

  // 1. Nothing on disk: two fallback lines, exit 0.
  let r = run(base);
  ok(r.code === 0, "exit 0 with no files");
  ok(/Morning queue: none for 2026-11-12/.test(r.out), "says no queue for today");
  ok(/Beacon: no local summary yet/.test(r.out), "says no Beacon summary yet");

  // 2. A real-shaped queue file: title + every ## heading, newest file wins.
  writeFileSync(join(dl, `claude-plur-morning-${today}-old.md`), "# OLD BOARD\n## old\n");
  await new Promise((res) => setTimeout(res, 20));
  writeFileSync(join(priv, `claude-plur-morning-${today}-abc.md`),
    "# Morning Board, Thursday\n\nbody text not shown\n## 1. First\nx\n## 2. Second\napi_key = abc123\n");
  writeFileSync(join(dl, `claude-plur-morning-2026-11-11-x.md`), "# YESTERDAY\n");
  r = run(base);
  ok(r.code === 0, "exit 0 with a queue file");
  ok(/claude-plur-morning-2026-11-12-abc\.md \(newest of 2\)/.test(r.out), "picks the newest of today's files");
  ok(/Morning Board, Thursday/.test(r.out) && /· 1\. First/.test(r.out) && /· 2\. Second/.test(r.out), "prints title and headings");
  ok(!/YESTERDAY|OLD BOARD|body text not shown|abc123/.test(r.out), "prints nothing from other days, older files or body text");

  // 3. Beacon summary present: shown, credential-looking lines hidden.
  const bs = join(tmp, "beacon.md");
  writeFileSync(bs, "---\nStatus: green\nBridge reachable\ntoken: ghp_ABCDEFGHIJKLMNOP\n");
  r = run({ ...base, PLURSKY_BEACON_SUMMARY: bs });
  ok(/Beacon summary/.test(r.out) && /Status: green/.test(r.out), "prints the Beacon summary");
  ok(!/ghp_ABCDEFGHIJKLMNOP/.test(r.out) && /line hidden/.test(r.out), "hides a credential-looking line");

  // 4. Hard cap: 60 headings still print <= 30 lines.
  writeFileSync(join(priv, `claude-plur-morning-${today}-zzz.md`), "# Big\n" + Array.from({ length: 60 }, (_, i) => `## H${i}`).join("\n"));
  r = run({ ...base, PLURSKY_BEACON_SUMMARY: bs });
  const n = r.out.trimEnd().split("\n").length;
  ok(r.code === 0 && n <= 30, `caps at 30 lines (got ${n})`);
  ok(/more lines cut/.test(r.out), "says when lines were cut");

  // 5. Unreadable inputs never fail the session.
  r = run({ ...base, PLURSKY_MORNING_DIRS: "/dev/null/x:" + join(tmp, "missing"), PLURSKY_BEACON_SUMMARY: tmp });
  ok(r.code === 0, "exit 0 when dirs are missing and the summary path is a directory");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 6. Static contract: read-only, no network, no subprocess.
const src = readFileSync(SCRIPT, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
for (const [re, why] of [
  [/\b(writeFile|appendFile|mkdir|rm|rename|unlink|copyFile|createWriteStream)\w*\s*\(/, "a file write"],
  [/\bfetch\s*\(|node:(http|https|net|dns|tls|dgram)|["'](http|https|net|dns|tls)["']/, "network"],
  [/child_process|\bspawn\w*\(|\bexec\w*\(/, "a subprocess"],
]) ok(!re.test(src), `session-note.mjs has no ${why}`);

// 7. Wiring: the repo settings run this script at SessionStart.
const settings = JSON.parse(readFileSync(join(ROOT, ".claude", "settings.json"), "utf8"));
const cmds = (settings.hooks?.SessionStart || []).flatMap((g) => g.hooks || []).map((h) => h.command || "");
ok(cmds.some((c) => /scripts\/session-note\.mjs/.test(c)), ".claude/settings.json SessionStart runs scripts/session-note.mjs");

console.log(`  ${failed ? "✗" : "✓"} session note: ${pass}/${pass + failed} checks`);
process.exit(failed ? 1 : 0);

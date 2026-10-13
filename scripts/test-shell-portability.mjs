#!/usr/bin/env node
// Gate: a script this repo expects to RUN must be runnable on the boxes that
// run it — not just on the laptop it was written on.
//
// THE DEFECT CLASS THIS EXISTS FOR (PR #211):
//   scripts/verify-and-push.sh shipped with `#!/bin/zsh`. Every push in the
//   repo was routed through it. On a CI box with no zsh the kernel cannot exec
//   the interpreter and returns **126** — and 126 is not a quiet failure, it is
//   a LOUD one that says the wrong thing: a caller reading the exit code sees
//   "the gate ran and failed" when the truth is "the gate never started". That
//   is the same false-success shape as a piped exit code, one layer lower down.
//   The wrapper's own header had also claimed `mktemp -t` was "zsh-flavoured
//   and fails under bash", which was never measured and is false — mktemp is
//   the same /usr/bin/mktemp binary whichever shell invokes it. The fiction is
//   what pinned the shebang to zsh and forbade the one invocation that would
//   have exposed the 126.
//
// So the rule is narrow and mechanical:
//   (1) A shebang names the interpreter through `/usr/bin/env`, never an
//       absolute interpreter path. /usr/bin/env is the one path POSIX boxes
//       agree on; /bin/zsh, /usr/local/bin/python3 and friends are guesses
//       about someone else's filesystem.
//   (2) A file tracked EXECUTABLE (100755) must carry a shebang at all — a
//       bare ./script with no shebang is undefined behaviour, interpreted by
//       whatever the caller's shell decides.
//
// It is deliberately ONE-DIRECTIONAL on mode. A shebang'd file at 100644 is
// fine when nothing invokes it bare: .claude/skills/diagnose/scripts/
// hitl-loop.template.sh is a TEMPLATE, and SKILL.md invokes it as
// `bash hitl-loop.template.sh`. Failing that file would be the gate inventing
// a defect, and a gate that cries wolf gets switched off.
//
// NEGATIVE CONTROLS ARE THE POINT. "0 violations" from a checker nobody proved
// can fail is indistinguishable from a checker that inspects nothing — that is
// exactly how #211's proof harness went 20/20 green with an assertion aimed at
// the wrong line. So the rule below is a pure function, and it is fed known-bad
// inputs and required to reject every one of them before the real scan counts.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let checks = 0, failed = 0;
const fail = (msg) => { checks++; failed++; console.log(`  ✗  ${msg}`); };
const ok = () => { checks++; };

// ── THE RULE, as a pure function over what git already knows ──────────────
// (path, mode, firstLine) → array of violation strings. Pure so the controls
// below can exercise it directly, with no fixture files to go stale.
function violations(path, mode, firstLine) {
  const out = [];
  const isExec = mode === '100755';
  const hasShebang = firstLine.startsWith('#!');

  if (hasShebang) {
    const line = firstLine.replace(/\r$/, '');
    if (!/^#!\/usr\/bin\/env\s+\S/.test(line)) {
      out.push(`${path}: shebang \`${line}\` names an absolute interpreter — ` +
               `a box without it exits 126, which reads as "ran and failed", not "never started". ` +
               `Use \`#!/usr/bin/env <interpreter>\`.`);
    }
  } else if (isExec) {
    out.push(`${path}: tracked executable (100755) with no shebang — ` +
             `bare invocation is interpreted by whatever shell the caller happens to run.`);
  }
  return out;
}

// ── CONTROLS: prove the rule can fail, and can pass, before trusting it ───
// Without this block a green scan proves only that the scan ran.
const MUST_REJECT = [
  ['fixture/zsh.sh',        '100755', '#!/bin/zsh'],              // the #211 defect, verbatim
  ['fixture/bash-abs.sh',   '100755', '#!/bin/bash'],             // absolute even when it usually exists
  ['fixture/sh-abs.sh',     '100644', '#!/bin/sh'],               // absolute is absolute at any mode
  ['fixture/py-local.py',   '100755', '#!/usr/local/bin/python3'],// someone else's filesystem
  ['fixture/env-noarg.sh',  '100755', '#!/usr/bin/env'],          // env with no interpreter names nothing
  ['fixture/exec-bare',     '100755', 'echo hi'],                 // executable, no shebang
];
const MUST_ACCEPT = [
  ['fixture/ok-bash.sh',    '100755', '#!/usr/bin/env bash'],
  ['fixture/ok-node.mjs',   '100644', '#!/usr/bin/env node'],
  ['fixture/ok-crlf.sh',    '100755', '#!/usr/bin/env bash\r'],   // CRLF must not read as a violation
  ['fixture/plain.md',      '100644', '# a heading'],             // no shebang, not executable: fine
  ['fixture/template.sh',   '100644', '#!/usr/bin/env bash'],     // the hitl-loop template's real shape
];

for (const [p, m, l] of MUST_REJECT) {
  if (violations(p, m, l).length === 0) {
    fail(`CONTROL DEAD: the rule ACCEPTED known-bad \`${l}\` at mode ${m} (${p}) — ` +
         `every "0 violations" below would be meaningless`);
  } else ok();
}
for (const [p, m, l] of MUST_ACCEPT) {
  const v = violations(p, m, l);
  if (v.length) {
    fail(`CONTROL DEAD: the rule REJECTED known-good \`${l.replace(/\r$/, '\\r')}\` at mode ${m} (${p}) — ${v[0]}`);
  } else ok();
}

// ── THE REAL SCAN ─────────────────────────────────────────────────────────
// git ls-files -s gives mode and path together, so the exec bit comes from the
// INDEX (what CI checks out) and not from this laptop's working tree.
const rows = execFileSync('git', ['ls-files', '-s'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .map(l => {
    const m = l.match(/^(\d{6})\s+[0-9a-f]+\s+\d+\t(.*)$/);
    return m ? { mode: m[1], path: m[2] } : null;
  })
  .filter(Boolean)
  .filter(r => r.mode !== '120000' && r.mode !== '160000'); // symlinks/submodules have no shebang

let scanned = 0, shebanged = 0, execs = 0;
const bad = [];
for (const { mode, path } of rows) {
  let first = '';
  try {
    const buf = readFileSync(join(ROOT, path));
    // Binary files (images, fonts) are not scripts. A NUL in the first chunk is
    // the cheap, dependency-free way to say so.
    const head = buf.subarray(0, 512);
    if (head.includes(0)) continue;
    first = buf.toString('utf8').split('\n', 1)[0];
  } catch { continue; }
  scanned++;
  if (first.startsWith('#!')) shebanged++;
  if (mode === '100755') execs++;
  bad.push(...violations(path, mode, first));
}

// LIVENESS: a broken glob, a bad regex or a chdir would leave `bad` empty and
// print a confident green. Assert the scan actually saw the repo it claims to
// have checked. The floors are deliberately well under today's real counts so
// ordinary churn never trips them, but a scan that collapses to nothing does.
if (scanned < 100) {
  fail(`scan liveness: only ${scanned} text file(s) inspected — the scan collapsed; "no violations" would be a lie`);
} else ok();
if (shebanged < 20) {
  fail(`scan liveness: only ${shebanged} shebang(s) found across ${scanned} files — the shebang detector is not matching`);
} else ok();
if (execs < 1) {
  fail(`scan liveness: no tracked 100755 file found — the mode rule is checking nothing`);
} else ok();

for (const v of bad) fail(v);
if (!bad.length) ok();

if (failed) {
  console.log(`\n  ${failed}/${checks} checks FAILED — a script this repo runs may not start on a box that is not this one.`);
  process.exit(1);
}
console.log(`  ✓ shell portability: ${checks} checks — ${shebanged} shebang(s) all \`/usr/bin/env\`, ` +
            `${execs} tracked executable(s) all carry one, across ${scanned} text files ` +
            `(${MUST_REJECT.length} known-bad forms rejected, ${MUST_ACCEPT.length} known-good accepted)`);

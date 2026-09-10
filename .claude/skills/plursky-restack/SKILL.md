---
name: plursky-restack
description: Restack an open Plursky PR onto a main that moved underneath it — other PRs merged, the cache-bust version collided, or a reviewer asked for "restack onto <sha>". Squash onto the new main, resolve version-only conflicts with an asserting script, re-bump explicitly, regenerate, stage BEFORE verify, full verify, lease-push, report. Use for "restack #N", "rebase onto main", "PR is CONFLICTING", "version collision", or before merging the second of two PRs that both bump vNNN.
---

# Restack a PR onto a new main

Born 2026-09-10: five PRs merged in one day (#117 → #121 → #119 → #120 → #110),
each restacked onto the one before. Every conflict was a `vNNN` cache-bust
string, but a careless resolution still silently drops real edits. This is the
procedure that held up, plus the three traps that cost a round each.

## 0. Facts first

```bash
git fetch -q origin --prune
git log --oneline -3 origin/main
git show origin/main:index.html | grep -o "APP_VERSION = '[^']*'"   # main's version
gh pr view <N> --json headRefName,headRefOid,mergeable -q .          # the head you will lease against
git merge-tree --write-tree --name-only origin/main origin/<branch>  # dry run: which files conflict
```

Read the reviewer's latest comment and do ONLY what it asks. "No content
changes" means the diff against main should differ from the approved head by
the base, the version and generated files, nothing else.

## 1. Pick the version

`bump.mjs --next` computes from MAIN and cannot see open branches. With PRs in
flight, give each an EXPLICIT number: main + 1 for the next to merge, + 2 for
the one after. A PR that waits can fall BELOW main (#110 sat at v284 while main
reached v287) — it re-bumps on restack, and its PR title must be edited to
match (`gh pr edit <N> --title "… (vNNN)"`). Never read the shipped version from
a title or commit subject; `node scripts/bump.mjs --check` is the authority.

## 2. Fresh worktree off the new main (never the main checkout)

```bash
S=<scratchpad>; W=$S/wr<N>
git worktree add -q -B <branch> $W origin/main     # -B resets the local branch to main
cd $W && npm ci -s --no-audit --no-fund            # every fresh worktree needs its own
```

⚠ `/private/tmp` is WIPED ON REBOOT. A crash on 2026-09-10 took three worktrees
of unpushed ruling work. Push (a WIP commit if need be) before any long step.

## 3. Bring the PR's content across — choose by PR shape

**Festival data PR** (new module or registry rows): re-apply the SOURCE diff
only, never the old commit's generated files:

```bash
git show <old-head>:data/festivals/<id>.js > data/festivals/<id>.js     # new module
git diff <old-base> <old-head> -- data.jsx scripts/<changed>.mjs | git apply   # edited sources
```

then re-wire the registration by EXACT-MATCH replacement (a script that throws
on 0 or 2+ matches): `_WAVE1_IDS` in data.jsx, the `<script>` tag in
index.html, the `sw.js` LOCAL precache line — each beside the entry main now
ends with.

**App-code PR** (many files, review rounds of history): squash-merge, so
conflicts are resolved once, not once per commit:

```bash
git merge --squash origin/<branch>
```

## 4. Resolve version conflicts — per HUNK, asserted, never per file

⛔ `git checkout --ours <file>` takes the WHOLE file and silently drops the PR's
non-conflicting edits in it (#110 had real edits in app.jsx and index.html next
to its version lines). Resolve hunk by hunk, and refuse any hunk that differs in
more than the version:

```js
// resolve.cjs — keep main's side of every conflict hunk, but only if the two
// sides differ solely in vNNN (plus lines main added that the PR predates).
const fs = require('fs');
const EXTRA = /<main-only lines, e.g. new festival module script tags>/;
const norm = s => s.replace(/v\d{3}/g, 'vX').split('\n').filter(l => !EXTRA.test(l)).join('\n');
for (const f of ['app.jsx', 'index.html', 'sw.js', 'build/app.js']) {
  let n = 0;
  const out = fs.readFileSync(f, 'utf8').replace(
    /<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n/g, (_, ours, theirs) => {
      if (norm(ours) !== norm(theirs)) throw new Error(`${f}: hunk ${n + 1} differs beyond version strings`);
      n++; return ours;
    });
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(out)) throw new Error(`${f}: markers remain`);
  fs.writeFileSync(f, out); console.log(`${f}: ${n} version-only hunk(s) → main's side`);
}
```

A throw is the point: look at that hunk by hand. Then `git add` the files.

## 5. Re-bump, regenerate, STAGE, then verify

```bash
node scripts/bump.mjs <n>              # sets the version AND recompiles build/
node scripts/gen-festival-pages.mjs    # /f/ pages, sitemap, index.html lists
git add -A                             # ← BEFORE verify, always
node scripts/verify.mjs                # FULL (browser probe), not --parse-only
```

⚠ Stage before verify. The precache gate reads `git ls-files`; a new module
that is on disk but untracked fails "on disk but UNTRACKED — absent from a fresh
checkout". That red is correct, and it cost a round on #119.
⚠ Editing a .jsx after a compile? Re-run `node scripts/compile.mjs` — the
precompile gate fails "build/ is stale" before any later gate even runs.
The only standing ✗ is the dated ultra-miami waiver (until 2026-12-01).

## 6. Commit, lease-push, confirm

```bash
git commit -F- <<'EOF' … EOF          # say what was restacked onto what, and why the version
git push --force-with-lease=<branch>:<old-head-sha> origin HEAD:<branch>
git ls-remote origin <branch>          # must equal `git rev-parse HEAD`
```

Gate the push on verify's exit code (`[ $rc -eq 0 ] && git commit … && git push …`)
so a red run cannot leave the remote. Lease on the head you READ in step 0.

## 7. Report on the PR, then clean up

- `gh pr comment <N>`: new head, base sha, version, fresh `main...head` stat
  (`git diff --stat origin/main...HEAD | tail -1`), verify result, what was NOT
  changed. Rewrite stale PR-body sections (old heads, old stats, "Also in this
  PR" items that were removed).
- Remove the worktree only when `git status --porcelain` is empty AND local
  HEAD == remote head. Leave it if a review round may follow.

## Adding fixes during a restack (review rounds)

Keep the restack and the fixes as SEPARATE commits so the reviewer reads the
round on its own. For each finding: reproduce it on the restacked build FIRST
(a probe that prints before/after numbers), fix, rerun the same probe. If the
finding is a class ("memo deps omit X"), add the detector to verify.mjs and
watch it FAIL on the unfixed code before fixing — the reviewer will
mutation-test it.

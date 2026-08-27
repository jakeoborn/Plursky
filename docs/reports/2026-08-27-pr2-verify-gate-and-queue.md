# Note for lanes — PR 2 open, queue re-triaged, issue #18 closed

**Date** 2026-08-27 · **main** `836339c` · **live** v232 · **in flight** #23 (v233), #24 (unversioned)

Third note of the day. Predecessors:
[`2026-08-27-pr-chain-v232.md`](2026-08-27-pr-chain-v232.md) (three PRs merged
and live) and [`2026-08-27-pr1-revenuecat-pin.md`](2026-08-27-pr1-revenuecat-pin.md)
(PR 1 + two live IAP bugs).

---

## Queue state

| PR | scope | state |
|---|---|---|
| **1** | RevenueCat pin → 9.2.2 | **#23 open**, green, **not merged** |
| **2** | CI verify gate + `scripts/bump.mjs` | **#24 open**, stacked on #23 |
| 3 | Official-map layer (+ `RealMap` `showLabels`) | not started — blocked on #23 |
| 4 | `photo-tag.jsx` cross-festival resolution | not started |

**Everything is queued behind #23.** #24's base is `fix/revenuecat-pin-9.2.2`,
not `main`, because both edit `sanity.yml`; GitHub retargets it automatically
when #23 merges. This is not a stylistic choice — see the measurement below.

## PR 2 — the verify gate is now code, not a habit

`AGENTS.md` §2 rule 2 has always required a Babel react-preset transform **and**
a headless mount probe per change. Both were manual, which means skippable and
free to drift from what CI actually ran. `scripts/verify.mjs` is that gate as
code, run identically locally and in CI:

```bash
node scripts/verify.mjs              # parse gate + mount probe
node scripts/verify.mjs --parse-only # no browser, no network
```

`scripts/bump.mjs` replaces the three-file hand-`sed`:

```bash
node scripts/bump.mjs --next    # PR 3 → v234, PR 4 → v235
node scripts/bump.mjs --check   # CI runs this
```

**Use it.** The v230 → v231 → v232 cascade in the first report happened because
three PRs each re-bumped by hand.

### Three things any lane touching this should know

**1. `root > 0` does not mean healthy.** A file ending in a bare `throw` still
produced `root children: 1` and `14/14 globals present` — function declarations
hoist, so a file that dies at its last line leaves its symbols defined and the
app still mounts. Only console-error capture caught it. Any gate that checks
`#root` alone is checking almost nothing.

**2. Iframe errors do not reach the parent.** The first version of this gate
**passed** the deliberate `throw` for exactly that reason. The probe server now
prepends an error-capture prelude to `index.html` **in flight** — the file on
disk is untouched and otherwise served verbatim.

**3. The mount probe no longer guesses script order.** It loads the real
`index.html` in an iframe. The previous approach grepped index.html for `*.jsx`,
which also matched filenames written in **prose comments**; once #21 added
those, it hoisted `app.jsx` ahead of `data.jsx` and produced a **false
`root=0`** on healthy code. A lane running the old probe on a pre-#23 checkout
still hits that.

`bump.mjs` has the same class of trap handled: it skips `vNNN` inside comments,
because `app.jsx:494` carries a historical `(v196)` and `spotify.jsx` is full of
`// vNNN` markers that a blanket `sed` would silently rewrite.

### CI receipts — measured on a real runner

`sanity.yml` only fires on PRs targeting `main`, so **no checks run on #24
itself**. The same tree was pushed to a throwaway PR against `main` twice:

- **Round 1 failed** — invalid test, not a defect in #24. The cherry-pick onto
  `main` dropped #23's `npm ci` step, so `node_modules` never existed. It did
  establish that **`google-chrome` is present on the runner**, and it *measured*
  the ordering dependency rather than assuming it: **without #23's `npm ci` the
  verify gate cannot run at all.**
- **Round 2 passed** — the true post-merge state:

```
npm ci        161 packages, 162 audited
drift check   ✓ all three files agree on v233
chrome        Google Chrome 151.0.7922.173
parse gate    ✓ all 13 parsed
mount probe   root children: 1 | rendered chars: 19376 | globals: 14/14 present
              ✓ verify gate passed                                        22s
```

One fix fell out of it: CI pinned **Node 20** while `@babel/core@8` declares
`engines: ^22.18.0 || >=24.11.0`. It passed anyway — by luck, not by contract,
and would have become a real failure on any Babel patch using newer syntax. CI
is now on **Node 22**; EBADENGINE warnings gone, job 59s → 22s.

Both throwaway PRs are closed and their branches deleted.

## Issue #18 closed — but its standing rule was rescued first

The merge order #18 planned executed on 2026-08-24. One deviation worth
recording: it directed *"kill #10 at review, close it unmerged"*; both were
measured (identical 201-act lineup, same day split) and the **founder reversed
it** — #10 merged, #11 closed.

#18 also carried a governance rule with no expiry:

> No public-facing flips without founder word. Every festival scaffold PR lands
> `available: false`; the watch fires the flip session only when official set
> times publish, and each flip is its own PR — never agent-merged.

Closing the issue would have dropped it silently, so it now lives in
**`AGENTS.md` §4**, where it binds every agent. It gained the clause #18 did not
anticipate: **a gated entry whose event date has passed never flips** — retire
it or roll it forward, and check whether it is still being published to search.

## Clicky queue re-triaged

`docs/qa/CLICKY-QUEUE.md` was last refreshed 2026-06-07 and described a
v228 / "iOS 1.11 in review" world.

| item | change |
|---|---|
| JOB-1 | **SUPERSEDED** — #10 merged the 201-act lineup; the set-times half became **W-3** rather than vanishing |
| JOB-2 | re-scoped — feature list rewritten; added "pitch only what is LIVE" (5 of 7 festivals are gated) and "no price copy" |
| JOB-3 | **DONE** via PR #13 |
| JOB-4 | brief is v221, device bundle v228, web v232 — B7 tests a *different build* from B1–B6. **B5 now blocked on two things**: the Paid Apps agreement **and** #23 |
| JOB-5 | re-prioritised — Forest recon is now the least useful target |
| JOB-6 | **RE-GATED** — see below |
| W-1 | **RETIRED** |
| W-2 | re-dated — ACL Oct 2–4 / 9–11, drop expected early-to-mid September |
| W-3 | **ADDED** — Lost Lands set times |

### Three findings from the re-triage

**JOB-6's send gate was unsatisfiable.** It was gated on "after Electric Forest
flips live". **EF 2026 ran Jun 25–28 and never flipped**, so the gate could
never be met and JOB-6 would have blocked forever. Re-gated to the Lost Lands
flip (~Sep 15).

**The next flip had no watch.** W-1 and W-2 existed; nothing watched Lost Lands
set times — the thing that actually fires the Sep 15 session. Now W-3.

**ACL is the one watch where stale data already reaches users.** It is
`available: true` and LIVE, with stage assignments and set times still
**estimated from 2025** (TODO #20). Every other watch guards a gated festival
nobody can see yet.

## 🟠 Open decision for the founder

**`electric-forest-2026` is a dead gated entry.** Event date passed, never
flipped, still `available: false` — and `/f/electric-forest-2026/` is in
`sitemap.xml`, so a **past** festival is being published to search engines with
118 performers. Retire the entry, or roll it to Electric Forest 2027. Flagged in
the queue under "Flagged for the Claude Code lane"; not actioned, because
retiring a festival is a public-facing product decision.

## Founder-gated, in flight

GSC property + Squarespace DNS TXT · ASC product creation + RevenueCat offering
rewire · Paid Apps agreement → Active. Paywall button copy remains
**PROVISIONAL** pending sign-off; no further public copy changes without it.

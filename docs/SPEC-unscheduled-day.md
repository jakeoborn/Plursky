# SPEC — `day: null` means "any day", for festivals with no published day split

**Date:** 2026-09-10 · **Author lane:** Claude Code · **For:** Claude Code lane
**Trigger:** the note in `data/festivals/iii-points-2026.js` — revisit this "if a
second TBA festival ever needs it". Dreamstate SoCal 2026 (PR #117) is that
second festival. Two is the threshold that note set, and it has been crossed.
**Status:** SPEC ONLY. Nothing below is implemented. Approval gate applies.

---

## The problem, stated once

Two festivals in the registry publish a **complete lineup and no day split**:

| festival | acts | what is published | what is not |
|---|---|---|---|
| `iii-points-2026` | 218 | full lineup, 2 dates | which act plays which day |
| `dreamstate-socal-2026` | 70 | full lineup, 2 dates | which act plays which night |

Both currently ship the same workaround: **one `dayDates` bucket labelled
`TBA`, every act on `day: 1`**. It is honest in the UI — the chip says TBA — and
it reverses cleanly at the flip. It is a workaround because the data says
"day 1" when the truth is "unknown", and every consumer downstream believes it.

The alternative each module's comment rules out is `day: null` on every act,
because **the lineup screen renders empty**: 66 comparisons across 8 files ask
`a.day === <someDay>`, and `null` matches none of them.

This spec proposes making `null` a first-class value meaning **"scheduled, day
not yet announced"** — so the data can say what is actually known.

## Measured scope (2026-09-10, on `0591ad3`)

```
grep -rnE "\.day ===? |\.day !== " *.jsx   →  66 sites
  lineup.jsx 24 · home.jsx 17 · spotify.jsx 9 · map.jsx 7
  app.jsx 3 · chrome.jsx 2 · photo-tag.jsx 2 · spotify-api.jsx 2
```

**66 is the number that decides the shape.** The #110 lesson applies directly:
a change this wide does not get made by visiting call sites. Three rounds of
per-consumer guard passes there leaked every time, and the fix was one central
filtered accessor that read paths inherit. Same here.

## The part that makes this not a one-line change

**"null matches any day" is correct for some reads and wrong for others.** The
66 sites are not one population. Classified by hand against the current tree:

### A. Browse reads — null MUST match (the reason this spec exists)

"What is on, on the day the user is looking at." A day-unknown act belongs in
every one of these, because the user is browsing a lineup, not a clock.

`lineup.jsx:97,105,114,131,148,158,208,397,700,716,778,789,1162,1208,1587,2430` ·
`home.jsx:704,742,877,888,893,937,1198,1205,1360,2007,2102,2621,2953` ·
`map.jsx:6027,6203` · `spotify.jsx:951,5796` · `app.jsx:272`

### B. Now-reads — null MUST NOT match

"Who is playing at this moment", always paired with a `start`/`end` window.
A day-unknown act has **blank `start`/`end`**, so it already fails the time
half and today these are harmless. They stop being harmless the moment a
festival publishes times before days, or the reverse. The rule has to be
written down rather than left to that accident.

`chrome.jsx:80,769` · `lineup.jsx:1331,1457,1634,1858` · `home.jsx:657,663,677` ·
`map.jsx:652,2175,4605,4872,5274` · `app.jsx:951` · `spotify.jsx:970`

### C. Attribution reads — null MUST NOT match, and this is the sharp one

Photo auto-tagging and recap attribute a captured moment to an act by matching
the moment's night. `photo-tag.jsx:736,763` short-circuit on `a.day !== night`
before the stage/time check. If `null` matched "any day" here, **every
day-unknown act becomes a candidate for every photo**, and auto-tag — which
[[the memories loop]] rests on — starts guessing. `spotify.jsx:2382,2410,2962`
and `chrome.jsx` reminders are the same class.

### D. Sorts — null is silently wrong, not loudly wrong

`app.jsx:286`, `spotify-api.jsx:206,896` sort with `a.day - b.day`. In JS
`null - 1 === -1` (null coerces to 0), so day-unknown acts sort **before day 1**
rather than throwing. Verified:

```
node -e 'console.log(null-1, [2,null,1].sort((a,b)=>a-b))'   →  -1  [null,1,2]
```

No crash, no NaN, just an arbitrary position nobody chose. `undefined` WOULD
give NaN and an unstable sort — so if this ships, `null` is the required
spelling and `undefined` must be rejected by the gate.

### E. Unclassified — 8 of the 66, and they are why step 2 exists

A–D account for **58 sites. The grep found 66.** The remaining eight resist a
confident read from a one-line grep context and are listed rather than
quietly folded into a neighbour:

`lineup.jsx:767` (an exclusion — `if (a.day === day) return false`, so the
polarity inverts and "any day" would exclude everywhere) · `lineup.jsx:2549`
(`b.day === a.day`, act-to-act, not act-to-day — two day-unknown acts would
"clash" with each other) · `lineup.jsx:2642,2652` (day-change detection while
walking a sorted list) · `home.jsx:224` (sunrise set on the main stage) ·
`spotify.jsx:2285` (already `slot.day == null` — the only site in the tree
that handles null today) · `spotify.jsx:9327,9370` (debug//proximity paths).

`lineup.jsx:2549` is the one to look hard at: conflict detection compares two
acts' days to each other. Under a null model, two day-unknown acts have blank
times so `overlaps()` should refuse — but that is an inference about
`overlaps`, not a reading of it, and it needs checking before it is believed.

Eight of 66 is 12% unresolved. That is a fine place to be in a spec and a bad
place to be in a codemod, which is the whole argument for step 2 landing
before step 4.

## Proposed shape

Mirror #110 exactly, because it is the proven shape in this repo:

1. **One predicate, in `data.jsx`**, next to `lineupFor`/`activeLineup`:
   ```js
   // "Is this act on the day being browsed?" — null day means the split is
   // not published yet, so it is on every day the user can look at.
   function actOnDay(a, day) { return !a || a.day == null || a.day === day; }
   // "Is this act on the clock right now / in this photo's night?" — a
   // day-unknown act is NOT, ever. Attribution never guesses.
   function actOnExactDay(a, day) { return !!a && a.day === day; }
   ```
2. **Codemod the 66 sites** into whichever of the two their category says,
   category A → `actOnDay`, categories B and C → `actOnExactDay`.
3. **A `verify.mjs` gate** in the shape of the weekend-filter gate: AST-walk
   for a raw `.day ===` / `.day !==` comparison against anything, fail with the
   file and line, and offer a `// day-exempt: <why>` escape that must state a
   reason. This is what stops the leak from coming back, and it is the half
   that the three #110 rounds proved is not optional.
4. **`DAYS` gains an "any" bucket** only when a festival has day-unknown acts —
   `_daysFor` reads `cfg.dayDates`, so this is a `data.jsx` change, not 20.
5. **Both modules drop the TBA bucket** and set `day: null` on every act.

## Numbered execution plan

Each step names its command, its verify criterion and whether it is a commit
point. Steps 3 and 4 deliberately come **after** step 2's real number — the
classification below is a hand read of a grep, and step 2 is what replaces it
with a fact.

1. **Branch.** `git checkout -b feat/unscheduled-day origin/main`
   · verify: `git log --oneline -1` is current `main` · not a commit point.

2. **Re-measure and classify by AST, not grep.** Write
   `scripts/_day-sites.mjs` (throwaway) that walks every `.jsx` with
   `parseSync`/`traverse` and prints each `.day` comparison with its enclosing
   function name.
   · verify: the total matches the grep count of the day it runs, or the
   difference is explained in the commit message. **If the AST count differs
   from 66 by more than 3, stop and re-read before touching anything** — the
   grep missed a form (destructured `{ day }`, a `.day` behind an alias) and
   the categories are then unsafe.
   · not a commit point (throwaway script, do not commit it).

3. **Add the two predicates + the gate, with NO call sites converted.**
   `node scripts/verify.mjs`
   · verify: the new gate FAILS, naming ~66 sites. A gate that passes on the
   first run is not measuring anything — this is the negative proof, and it is
   the step the #110 round nearly skipped. Capture the failing output.
   · **commit point:** "gate first, red".

4. **Convert category A.** Codemod, then `node scripts/compile.mjs && node scripts/verify.mjs`
   · verify: gate failure count drops by exactly the number of category-A
   sites converted — assert the number MOVED, do not read green as proof.
   · **commit point.**

5. **Convert categories B, C, D.** Same command.
   · verify: gate green with a stated exempt count; every `// day-exempt:`
   comment names a reason.
   · **commit point.**

6. **Flip `iii-points-2026` to `day: null`.** `node scripts/verify.mjs`
   · verify: set-time honesty gate still reads `gated, schedule unpublished
   (218 acts, all blank)`; render at 430×932 behind a local `available: true`
   flip and confirm **218 acts visible**, not 0. This is the regression the
   whole spec exists to prevent, so it gets looked at, not inferred.
   · **commit point.**

7. **Flip `dreamstate-socal-2026` to `day: null`.** Same, 70 acts.
   · **commit point.**

8. **Auto-tag proof.** Drive `photo-tag.jsx`'s matcher against a fixture photo
   with a night set, on the flipped III Points data.
   · verify: **zero** day-unknown acts are returned as candidates. If any are,
   category C was misclassified — go back to step 5, do not paper over it.
   · **commit point.**

9. **Bump + regenerate.** `node scripts/bump.mjs --next` — then check open PRs
   for the version it picks, because the tool computes from `main` and cannot
   see in-flight branches (this collided on #110/#117). Then
   `node scripts/gen-festival-pages.mjs`.
   · verify: `verify.mjs` exit 0. · **commit point, then push and open the PR.**

### Decision rule for the branch that is genuinely ambiguous

**If a category-B or C site turns out to have no `start`/`end` guard**, it is
not a now-read at all — it is a browse read wearing a clock's clothes, and it
goes in category A. Do not add a time guard to keep it in B; that is inventing
a behaviour to protect a classification.

**If step 8 fails**, the null-day model does not ship for a festival whose
photos are already being auto-tagged. Both festivals here are gated and
unattended, so the correct fallback is to land the predicates and the gate
(steps 3–5) and **leave both modules on the TBA bucket**, which is a smaller
but real win: the 66 sites stop being able to drift. Say so plainly rather than
shipping a guessing auto-tagger.

## What this spec does NOT propose

- Touching the weekend model. `weekendStartMs` / `a.weekend` is a different
  axis and #110 owns it.
- Changing anything for a festival that HAS a published day split. All 18
  others keep integer days and behave identically.
- A UI for picking "any day". The chip already says TBA; this spec is about
  what the data underneath it says.

## Related

- `data/festivals/iii-points-2026.js` — the note that set the two-festival
  threshold, and the long config comment weighing the three options.
- `data/festivals/dreamstate-socal-2026.js` — the same reasoning reached
  independently for the second festival.
- PR #110 — the central-accessor + AST-gate shape this copies, and the record
  of what three rounds of per-consumer guard passes cost.

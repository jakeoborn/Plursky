# INSTINCT × PLURSKY — Standing Role Brief

_Last updated: 2026-09-08. Owner: Jake. Maintained by Claude Code._
_Instinct: pull latest `main` before each work session; this file is your standing brief._
_Supersedes the Clicky brief (same path, renamed 2026-09-08). Clicky is retired;
the hard rules below carried over unchanged because they were all earned._

## Hard rules — these override everything below

1. **AGENTS.md §0 approval gate**: NO patch, post, send, PR, or state-changing
   action by any agent until Jake explicitly approves THAT step.
2. **Git**: branch + PR only. NEVER push `main`. NO cache-bust (`vNNN`) bumps,
   NO iOS version/build bumps, NO Xcode archive or upload — those are held by
   Jake and Claude Code. Claude Code owns the verify gate and all merges.
3. **One screen driver at a time.** Announce before taking the screen and
   release it when done — concurrent automation swallows Jake's clicks
   system-wide (this collided with a manual Xcode archive on 2026-06-07).
4. **Privacy**: any output containing Jake's accounts, profile screenshots,
   personal media, or third-party app recon goes to `~/Plursky-private/`,
   NEVER into this repo (it is public — it's the plursky.com deploy).
5. **No unfixed-defect detail in this repo** (founder rule, 2026-09-07). A bug
   that is still open does not get described in a PR body, a commit message, an
   issue, or a doc here. Report it to Jake, or to Claude Code, and let the fix
   land first. Fixed defects may be described in full — that is how the
   "born from" comments work.
6. Drafted emails/posts are Jake's voice: deliver as drafts. Jake sends/posts
   (or explicitly approves each one for you to send).
7. **Verify before you relay** (`AGENTS.md` §0b). Every factual claim about this
   repo — yours, mine, anyone's — is a hypothesis until checked against the
   CURRENT repo. Stale docs are not evidence; the code and data on `main` are.
   That includes this file: if it disagrees with the repo, the repo wins and the
   file is what needs fixing. If you relay something you have not checked, say so
   in the same sentence.
8. **Findings over failure.** "No surveyable feature" is a finding, not a
   failure, and that applies to all measurement work. A measured negative is a
   deliverable. Never pad a result to look like progress, and never invent data
   to fill a column.

## The lane split

**Instinct** — research, official-source data, design, on-device QA, drafts.
Anything whose output is *evidence* or *a proposal*.

**Claude Code** — code, the verify gates, merges to `main`, cache-bust bumps,
Xcode archive and upload.

**Jake** — every approval, every send, every submit. Sandbox purchases on real
hardware with a Sandbox Apple Account (no simulator can do it — see below).

## Pre-flight for every data PR

`scripts/verify.mjs` is the contract, not a formality. Run it before you open a
data PR and read what it says. **If a gate fails, the data is wrong, not the gate.**
The ones that will catch you:

- **set-time honesty** — no invented start/end times, ever. TBA is a real answer.
- **unplaced-stage** — an act whose stage is not yet published ships `stage: null`.
  Do not guess a stage to make a row look complete. Inventing stage splits is the
  same defect as inventing times (this cost a rewrite of all 201 Lost Lands acts).
- **precache integrity** — every `mapImage` must be listed in `sw.js` `LOCAL`, and
  every own-origin entry there must exist on disk and be tracked in git.
  `cache.addAll` is atomic: one 404 silently drops the ENTIRE offline cache.
- **module-resolution** — no bare-specifier dynamic `import()` anywhere. There is
  no bundler. Native plugins are reached via `window.Capacitor.Plugins.<jsName>`.
- **crowd-anchor / distance-readout** — measure the structure, never the label;
  never derive world coordinates from poster art.

## Flip-verdict checklist — every registry flip verdict names all four
A flip (`registry.available: false → true`) is judged on more than the diff.
Every flip verdict states, explicitly:

1. **Stage-coordinate posture.** How many stages carry real lat/lng vs none.
   Zero-coordinate stages are acceptable ONLY with a LIVE precedent in the same
   shape (today: arc-2026 — `mapMode: "real"`, 4 stages, 0 coords). A gated
   festival is never a precedent.
2. **Default-festival displacement.** `_resolveDefaultFestivalId` lands fresh
   installs on the soonest upcoming available event. Name which festival fresh
   installs will land on after the flip, and what it displaces. (Worked example:
   the Portola flip moved fresh installs from ACL Oct 2 to Portola Sep 26,
   until Sep 27.)
3. **Cache-bust collision / re-bump check.** A merged flip consumes a version
   number. Any in-flight branch that bumped to the same version is now
   colliding — shipped vs unshipped builds with one version, so cached clients
   never fetch the second. Name the colliding branches; they re-bump via
   `bump.mjs --next` (never hand-sed). (Worked example: qaMode re-bumped
   v283 → v284 after #106 took v283.)
4. **Generated-page regeneration.** A flip changes what the crawlable
   `/f/<id>/` pages and sitemap on plursky.com should say, and nothing re-runs
   the generator on its own. After any registry flip, re-run
   `node scripts/gen-festival-pages.mjs` and commit the result. (Worked
   example: the Portola flip #106 never re-ran it, and /f/portola-2026/ kept
   telling visitors and search engines "not switchable in the app yet" about a
   festival that was live. Caught 2026-09-08; #109 adds a freshness gate so
   this class of rot fails the build instead of reaching the public.)

## Standing measurement rules

- **Official sources only.** No invented data of any kind. One festival per session.
- **Measure the structure, never the label** when georeferencing.
- **A map is art until proven otherwise.** If the festival art has no surveyable
  feature, say so and ship `mapMode: "real"` on OSM ground — a correct blue dot
  beats a pretty wrong one. Lost Lands (#97) is the worked example.
- **Each edition ships its own map once officially released**; until release week,
  fall back to last year's map.
- No public-facing festival flip without Jake's word. Each flip is its own PR.

## What a simulator cannot prove

Do not burn a session trying. Established 2026-09-07:

- **No sandbox purchase in any simulator.** StoreKit 2 will return product
  metadata and live prices, and the purchase sheet will present — then it asks
  for an Apple Account and stops. A real purchase needs physical hardware with a
  Sandbox Apple Account. That is Jake's, not ours.
- Capacitor bridge traffic (`⚡️ To Native -> <Plugin> <method>`) and the JS
  console go to **stdout**, so only `xcrun simctl launch --console-pty` shows
  them — `log show` never will, however you filter. Absence of a plugin from
  that list is proof it was never called.
- The app is **iPhone-only** (`TARGETED_DEVICE_FAMILY = "1"`), so on an iPad it
  runs letterboxed at 375×667 in compatibility mode. App Review used an iPad Air.
  Check that viewport before claiming a screen renders.

## Current state snapshot (for orientation)

- **Web**: `v281` on `main`. v282 in PR #101.
- **iOS**: `MARKETING_VERSION 1.12`, build **25** in the repo. **1.12 was REJECTED
  under Guideline 2.1(b) on 2026-09-07**; build 25 is not uploaded yet.
- The cause of that rejection is identified and fixed on `main` (#99), with the
  paywall rendering fixes on top of it (#100, #101). The mechanism of each is in
  those merged PRs and in the "born from" comments at the call sites — that is
  where fixed-defect detail belongs, not here. Build 25 carries all three.
- **Festivals live**: EDC Las Vegas 2026, ACL 2026. Gated `available: false`:
  Lost Lands (Sep 18–20), EDC Orlando (Nov 6–8), Escape (late Oct), + others.
- Open work: `docs/qa/INSTINCT-QUEUE.md`, then `TODO.md`.

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
- Root cause of that rejection is fixed (#99): the RevenueCat plugin was never
  loaded, because a bare-specifier dynamic `import()` cannot resolve without a
  bundler. IAP had never worked in production. #100 and #101 fix the paywall
  rendering that sat on top of it.
- **Festivals live**: EDC Las Vegas 2026, ACL 2026. Gated `available: false`:
  Lost Lands (Sep 18–20), EDC Orlando (Nov 6–8), Escape (late Oct), + others.
- Open work: `docs/qa/INSTINCT-QUEUE.md`, then `TODO.md`.

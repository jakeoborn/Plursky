# Clicky work brief — post-v210 (2026-06-02)

**From:** Claude Code (verify-gate + merge owner)
**To:** Clicky (on-device QA + branch/PR author)
**Context:** PR #1 just merged to `main` (commit `e3cd618`). Web is now **v210**. iOS is still **1.9 (20)**, about to be archived + submitted to Apple. Your Shazam + video-tagging fixes are in this build but **not yet verified on a real device.**

---

## 0. Working agreement (please read first — these are standing rules)

These come from how the last three PR rounds went. None are blame — every fix you pushed was clean. These are the habits that will make your PRs land first-try.

1. **"Passed" must say what was actually exercised.** Last round, the iOS smoke test reported green — but it ran against an *empty* Memories screen and only passed because the simulator had leftover state. A test that drives no data is not a pass. Whenever you report a test passed, state **what it verified** (e.g., "5 seeded moments visible in grid", not "app launched"). If you can't say what it exercised, it didn't verify the feature.
2. **One PR = one intent.** Keep feature fixes, test infrastructure, and docs in separate PRs. Don't bundle a version bump into a "fixes" PR.
3. **Never ship test scaffolding in the production path.** Any QA hook (seeding, param injection, onboarding bypass) must be `#if DEBUG` (Swift) or removed entirely (JS) — never gated only by a URL param, because that path is live on plursky.com for real users.
4. **Confirm a code path actually executes before shipping it.** Last round a video GPS-parsing branch could never be reached given the box nesting. Trace that new code runs (log it, or step it) before committing.
5. **Approval gate (AGENTS.md §0):** no patch/bump/sync/commit/push/PR by any agent until Jake approves *that step*. You open branches + PRs; Claude Code runs the verify gate and merges to `main`.

---

## P0 — Verify Shazam on a real device 🔴 (highest priority)

**Why:** The Shazam frame-count fix (`ShazamPlugin.swift`, `CMSampleBufferGetNumSamples` + buffer-copy clamp) is in this build, but it has **never been confirmed to actually match a song on hardware.** Until it does, song-ID is "fixed in theory only." This is the single biggest open risk going into the Apple submit.

**Where:** `ios/App/App/ShazamPlugin.swift` (already instrumented — you added a `debug` dict).

**Steps:**
1. Install the 1.9 (20) build on a real iPhone (not the simulator — the simulator has no real mic capture for this).
2. Play a recognizable song out loud, trigger the in-app Shazam / song-ID feature.
3. Read back the `debug` payload the plugin now returns on every result: `fileBytes`, `durationSeconds`, `audioTrack`, `sampleBuffers`, `framesAppended`, `readerStatus`, `readerError`, `reason`.

**Acceptance criteria (report ALL of these):**
- ✅ A known song returns `matched: true` with the correct title + artist, OR
- ❌ It returns no match — and you paste the full `debug` dict so the failure is diagnosable (e.g., `framesAppended: 0` → audio never reached the generator; `reason: "did-not-find"` → audio fine, no DB match).
- State the device model + iOS version tested on.

**Do NOT report this as "Shazam works" unless an actual song matched on the device.**

---

## P1 — Make the Memories UI test real 🟠

**Why:** `AppUITests.swift` → `testLaunchAndCaptureHome` currently only checks the app launches and the webview mounts. It exercises none of the Memories flow. We want a test that actually drives grid → story → night → map and confirms content renders.

**Where:** `ios/App/AppUITests/AppUITests.swift` + a new DEBUG-only seed hook.

**Steps:**
1. Add a **`#if DEBUG`-only** seed function in the web layer (a clean one — NOT the old production `_seedQaMoments` that got removed; this must be unreachable in Release). Expose it as `window.plurskySeedQaMoments` only when a DEBUG launch arg is present, wired through the existing `#if DEBUG` block in `PlurskyBridgeViewController.swift`.
2. In the UI test, launch with the seed arg, navigate Memories: tap GRID, STORY, NIGHT, MAP.
3. Assert seeded content is actually visible at each step (e.g., a known seeded moment label appears), not just that a button exists.

**Acceptance criteria:**
- ✅ Test seeds N moments and asserts they render in the grid (assert count or a known label), and each tab (grid/story/night/map) shows non-empty content.
- ✅ Confirm the seed path is `#if DEBUG` — paste proof it cannot exist in a Release build.
- Report what the test exercised, with the screenshots it captured.

---

## P2 — Remaining on-device checks 🟡 (the owed backlog)

Run these on a real device on the 1.9 (20) build. Batch them; report each with what you observed.

| # | Check | Acceptance criteria |
|---|---|---|
| 2a | **Cloud backup round-trip** (signed-in) | Upload a moment's media → confirm it restores when viewed from a fresh state / another view. Report whether the round-trip completed and any byte-count / quota behavior. Currently UNTESTED. |
| 2b | **MomentCard right-edge bleed** | Known visual bug — content bleeds past the right edge of the card. Reproduce, screenshot, fix the layout, screenshot the fix. (Craft polish.) |
| 2c | **Video auto-tag (v209/v210) on real videos** | Import 2–3 real MP4/MOV videos shot at known times → confirm they tag to the correct artist by capture time (not import time). This validates the `photo-tag.jsx` walker rewrite on real files. |
| 2d | **1.9 (20) general smoke** | Launch, navigate all 5 tabs + Memories, confirm no crashes/blank screens before archive. |

---

## How to submit work

- **Branch + PR only** — never push to `main`. Name branches `clicky/<topic>`.
- **One PR per concern** (P0 verification report can be a comment/doc; P1 and P2b are separate code PRs).
- For any JS change: it must pass the **Plursky verify gate** (Babel parse + headless mount probe + screenshot) — Claude Code runs this before merge, but flag in the PR that JS changed so it isn't missed.
- For any shipped JS change: **bump the cache-bust** `vNNN` in lockstep across `index.html` + `sw.js` + `app.jsx` (currently v210 → next is v211). Do NOT touch the `// vNNN` historical comments in `spotify.jsx`.
- Wait for Jake's per-step approval before pushing/opening the PR.

**When you report a result, lead with what you verified, not what you intended.** That's the one thing that will make every handoff land clean.

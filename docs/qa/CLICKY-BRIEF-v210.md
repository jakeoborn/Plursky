# Clicky work brief — post-v210 (2026-06-02)

**From:** Claude Code (verify-gate + merge owner)
**To:** Clicky (on-device QA + branch/PR author)
**Context:** Web is now **v212** (live). iOS is still **1.9 (20)** — that version is **already APPROVED**, so it can't be resubmitted; the next build must be **1.10 (21)**. The Shazam + auto-tag fixes are in this build but **not yet verified on a real device** — that verification is what gates the submit. **Do NOT bump the version or archive** — Jake/Claude Code own that step.

---

## ▶ START HERE — run order (the rest of this doc is detail)

1. **Pull latest `main`**, read this doc.
2. **P0 — Shazam** on a real iPhone (real mic, real song). 🔴
3. **P0b — Auto-tag** on real EDC W2 photos/videos (6-case ground-truth checklist). 🔴
4. **v212 PHOTOS map lens** sanity check — Memories → MAP → toggle PHOTOS. 🟡
5. **General smoke** on 1.9 (20) — all 5 tabs + Memories, no crashes. 🟡

**The one rule that makes every handoff land:** report **what you actually exercised**, not what you intended. "Tiësto photo re-imported → tagged Tiësto ✅" is a pass; "auto-tag works" is not.
**Submit work as:** branch + PR only (`clicky/<topic>`), never push to `main`; wait for Jake's per-step approval before pushing (AGENTS.md §0).

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

## P0b — Verify auto-tag on real photos/videos 🔴 (equal priority to P0)

**Why:** The auto-tag fixes (v209 video capture-time, v211 GPS-off-stage reorder) pass the Node + headless harness on the real 241-artist lineup, but they have **never been confirmed against real EDC W2 photos on a device** — and this exact fix has been reported "working" falsely in past sessions. Harness-green ≠ tags-your-weekend-right. This is the second-biggest open risk.

**Where:** `photo-tag.jsx` (`_matchArtistForPhoto`, `_parseExifMeta`, `_parseVideoMeta`). Web is **v212** (live); iOS users only get the fix on the next build **1.10 (21)**.

**Precondition:** your EDC W2 **saved + attended sets must be present in the app** for that weekend — the fix relies on attended/saved set-time as the ground-truth signal. Confirm those exist before testing, or every case falls back to GPS/heuristics and the test proves nothing.

**Method:** for each photo/video below, you must already KNOW the truth (which artist/stage you were actually at when you shot it). Re-import it (auto-tag runs on import/retag only), then compare the tag to that known truth. Report each as:
`moment → known: <artist> @ <HH:MM> <stage> → tagged: <result> ✅/❌`

**Checklist (re-import a real file for each):**
1. **Core case** — a photo you KNOW was taken mid-set (e.g. "Tiësto · Kinetic · Sat ~02:10") → must tag to **that exact artist**. This is the headline failure that started all this.
2. **Off-stage / back-of-crowd** (the v211 fix) — a photo taken while standing far from the stage anchor (back of the field, walking) **during an attended set** → must STILL tag to the attended artist, **not** "off-stage" / wrong / untagged.
3. **Post-midnight set** — a photo from a set after 00:00 (e.g. 01:00–04:00) → must tag to **that night's** correct artist, not bleed onto the next calendar day.
4. **GPS-less photo** — a photo with no GPS (screenshot, edited, or stripped) taken during a saved set → must still tag via set-time (clean fallback), not go untagged.
5. **Video capture-time** (v209) — a real MP4/MOV shot at a known time → must tag by **capture time, not import time**, and pull GPS if the file has it.
6. **FIX TAG path** — pick an already-mis-tagged moment → confirm the **✎ FIX TAG** chip lets you correct it manually (old moments do NOT auto-fix; only re-import or this chip will).

**Acceptance criteria (report ALL):**
- ✅ **PASS only if every case's tag == the known truth.** One wrong tag = report it as ❌ with the moment's known artist/time/stage + what it tagged to + whether that set was saved/attended + whether the photo had GPS — so the failing signal path is diagnosable.
- State device model + iOS version, and whether you tested **web v212** (Safari on plursky.com) or the **iOS bundle** (note: iOS isn't fixed until 1.10/21 is installed).

**Do NOT report "auto-tag works" unless real photos with known ground truth tagged correctly on a real import.** "The harness passes" is not this.

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
- For any shipped JS change: **bump the cache-bust** `vNNN` in lockstep across `index.html` + `sw.js` + `app.jsx` (currently **v212** → next is v213). Do NOT touch the `// vNNN` historical comments in `spotify.jsx`.
- Wait for Jake's per-step approval before pushing/opening the PR.

**When you report a result, lead with what you verified, not what you intended.** That's the one thing that will make every handoff land clean.

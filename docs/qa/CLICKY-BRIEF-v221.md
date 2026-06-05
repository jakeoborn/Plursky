# Clicky QA Brief — Plursky v221 (2026-06-05)

**This is a TEST pass, not a code task.** Report **PASS / FAIL per item** with
what you saw — do NOT open a code PR. (PR #6 already shipped the v221 code
fixes; this brief verifies they actually work on a real device.)

## What shipped & WHERE to test it (read first — this matters)
v221 is **live on web (plursky.com)** and **in the local native bundle**
(cap-synced), but it is **NOT in the approved App Store build** (that's
1.10/21, which carries v218 = OLD code). So:

- **App Store app on your phone = v218.** It will NOT show any v219–v221 fix.
- **To test v221 on device:** build to your device from the **Xcode
  workspace** (`ios/App/App.xcworkspace` → Product → Run). That device
  build = v221.
- **plursky.com = v221** for visual/ordering checks (but mic-Shazam does
  NOT work on web — it's native-only by design).

ALWAYS confirm the version label first: Me tab shows "PLURSKY · vNNN".
If it does not say **v221**, you are on the wrong build — stop and rebuild.

## How to report (not "it's fixed")
For each item: **PASS** or **FAIL** + what you SAW on screen + the version
label + (if a bug) exact steps and any Xcode console line (look for
`⚡️[Shazam] …`). "Looks fine" is not a result; pass/fail is.

**XCUITest label assertions are NOT enough for the content checks.** They can
confirm tabs/labels exist, but they cannot judge auto-tag accuracy, hear
Shazam, or complete a purchase — and they throw false fails (a per-night
SHARE menu reads as "3 SHARE buttons"). Every screenshot must be of the
**running, UNLOCKED app** — a lock-screen screenshot means the automation
never drove the app, so it proves nothing. The PART B items below MUST be
driven by hand / cursor on an unlocked device with the Xcode console open.

---

## P0 — Night ordering  [surface: plursky.com OR device build]
Steps: Memories → TIMELINE → a night with post-midnight sets.
Expected: sets/clips read **evening → after-midnight LAST** (e.g. 8:00 PM …
11:35 PM → 12:32 AM → 4:14 AM), in **AM/PM**, never military (no "00:32",
no "20:00"). Day header reads "FRI · MAY 15", not "FRI · FRI".
PASS / FAIL + notes:

## P0 — Memories redesign feel  [surface: plursky.com OR device build]
Steps: open Memories; toggle WALL and TIMELINE; tap ⚙ MANAGE; tap SHARE.
Expected:
- Only **two** tabs: WALL · TIMELINE (no GRID/STORY/NIGHT/MAP).
- Default view is calm: NO attendance checklist, NO "+ ADD MOMENT",
  NO backup card until you tap **⚙ MANAGE** (they appear only then).
- **One 📸 SHARE ▾ menu _per night_** — if TIMELINE shows 3 nights you'll see
  3 SHARE buttons; that is CORRECT (the old per-night SHARE + GIF *pair*
  collapsed into one ▾). FAIL only if a single night shows 2+ share controls.
- "📍 WHERE THIS NIGHT HAPPENED" is collapsed; tapping expands the map.
Judge as a design eye: cluttered anywhere? misaligned? scroll stutter?
PASS / FAIL + craft notes:

## P0 — Auto-tag ground truth  [surface: DEVICE BUILD, REAL camera roll]
Steps: import your actual EDC W2 photos/videos. For ~8–10 clips you
remember, check the tagged artist.
Expected: each clip tags to the artist whose set you were filming; clips
between sets show "BETWEEN SETS"/untagged rather than a wrong artist.
Report any MISMATCH as: clip time + what it tagged + what it should be.
(This is the test only you can run — the metadata isn't visible from code.)
PASS / FAIL + mismatch list:

## P0 — Shazam live-mic  [surface: DEVICE BUILD ONLY — not web, not App Store app]
Steps:
 (a) Near a speaker playing a **released, charting track**, tap live Shazam.
 (b) Then try it on a **live DJ set / unreleased ID**.
Expected:
 (a) Exact match within ~14s (artist — title shown).
 (b) An honest message ("No match — live & unreleased sets often aren't in
     Shazam's catalog", or the set estimate) — **NOT** a hang, crash, 8s
     spinner, or "couldn't identify."
Grab the Xcode console line: `⚡️[Shazam] MATCH / DID-NOT-FIND / MIC-TIMEOUT`.
PASS / FAIL + the ⚡️[Shazam] line:

---

## P1 — Owed, device-only (run after P0s pass)
- **Signed-in backup round-trip:** sign in (Me tab) → ⚙ MANAGE → Back up my
  weekend → confirm count → delete local → reopen a moment → it restores.
  PASS / FAIL:
- **Plus purchase (sandbox):** tap a Plus-gated action → purchase completes
  in sandbox → entitlement unlocks. (Needs Paid Apps agreement active.)
  PASS / FAIL:
- **Map lens with real GPS:** TIMELINE → expand "WHERE THIS NIGHT HAPPENED"
  → do photos land on the correct stage areas?
  PASS / FAIL:
- **Web video "SHAZAM THIS VIDEO" (minor):** on plursky.com, tapping it now
  returns null by design — confirm the button falls back gracefully (idle/
  estimate), not a stuck spinner.
  PASS / FAIL:

---

# PART B — Interactive manual pass (the REAL verification)

These are the P0/P1 content checks that XCUITest cannot do. Run from the
**Xcode device build** (not the App Store app), device **unlocked**, Xcode
**console open**. Drive each step by hand / cursor. Capture screenshots of the
**running app** and paste console lines. Report PASS / FAIL per step.

Precheck (do once): Me tab shows **PLURSKY · v221**. If not, rebuild — STOP.

## B1 — Night ordering (re-do; was not fully verified)
1. Memories → **TIMELINE**.
2. Scroll INTO a night that has after-midnight sets (don't judge from the top).
3. Read that night top-to-bottom.
EXPECT: evening → after-midnight LAST, e.g. `8:00 PM … 11:35 PM → 12:32 AM →
… → 4:14 AM`, all **AM/PM** (no `00:32`, no `20:00`). Header = "FRI · MAY 15".
CAPTURE: screenshot of the ordered night. **PASS / FAIL:**

## B2 — Auto-tag ground truth (the highest-value check — only you can do it)
1. Memories → "Import from camera roll" → pick **8–10 real EDC W2 clips you
   remember** (mix photos + videos; include a couple shot after midnight).
2. Wait for the import toast (note "X TAGGED · Y NEED RETAG").
3. TIMELINE → for each clip you recognize, read the artist on its group.
EXPECT: each clip sits under the artist whose set you were actually filming;
clips taken between sets show **BETWEEN SETS / untagged**, NOT a wrong artist.
CAPTURE: a small table — `clip time → tagged artist → correct? (Y/N, and what
it should be)`. List EVERY mismatch.
**PASS / FAIL + mismatch list:**

## B3 — Live-mic Shazam (needs a speaker + Xcode console)
1. Play a **released, charting track** (Spotify/Apple Music) near the phone.
2. Open the live Shazam button and tap it. Watch the Xcode console.
EXPECT (a): exact match within ~14s → "Artist — Title" on screen; console:
`⚡️[Shazam] START live mic` then `⚡️[Shazam] MATCH · Artist — Title`.
3. Now point it at a **live DJ set / unreleased ID**.
EXPECT (b): honest no-match message ("No match — live & unreleased sets often
aren't in Shazam's catalog", or the set estimate) — **NO hang, crash, endless
spinner**; console: `⚡️[Shazam] DID-NOT-FIND …` or `… MIC-TIMEOUT …`.
CAPTURE: both console lines + a screenshot of each result.
**PASS / FAIL + the ⚡️[Shazam] lines:**

## B4 — Backup round-trip (signed-in; Wi-Fi)
1. Me tab → sign in. Confirm on Wi-Fi.
2. Memories → **⚙ MANAGE** → "Back up my weekend" → wait.
EXPECT: row shows "ALL SAFE · <size>" with X/Y complete.
3. Force-quit the app, relaunch → open a backed-up moment.
EXPECT: its photo/video re-loads from cloud (restore-on-view), not a blank.
CAPTURE: screenshot of "ALL SAFE" + the restored moment.
**PASS / FAIL + counts:**

## B5 — Plus purchase (sandbox)
PRECONDITION: Paid Apps agreement **Active** + a Sandbox Apple ID signed in
(Settings → App Store → Sandbox Account). If not set up → mark **BLOCKED**,
not FAIL.
1. Tap a Plus-gated action (e.g. cloud backup as a free user, or a
   watermark-free export).
EXPECT: StoreKit purchase sheet → complete sandbox purchase → entitlement
unlocks (the gated feature becomes available; PLUS badge clears).
CAPTURE: screenshot of the unlocked state. **PASS / FAIL / BLOCKED:**

## B6 — GPS map lens (needs real on-site GPS photos)
1. With real EDC photos imported, TIMELINE → a night → expand
   **"📍 WHERE THIS NIGHT HAPPENED"**.
EXPECT: photo thumbnails scatter on the EDC map near plausible stage areas;
tapping a pin opens the lightbox. GPS-less clips fall back to an approximate
stage position (acceptable — note which).
CAPTURE: screenshot of the map with pins. **PASS / FAIL + any pin that's way off:**

## B7 — Web video "SHAZAM THIS VIDEO" (minor, web only)
1. On plursky.com, open a video moment → tap "SHAZAM THIS VIDEO".
EXPECT: it returns to idle / shows the set estimate gracefully (by design web
has no recognizer now) — NOT a stuck spinner.
**PASS / FAIL:**

---

## Rules of engagement
- You report OBSERVATIONS + logs; the correctness verdict is Claude Code's.
- This pass = **test + report pass/fail**, not a code PR.
- Do NOT bump the iOS version or archive/upload — that's held by Jake.
- One bug = one clear report (steps + screen + version + log). No vibes.

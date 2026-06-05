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
- One **📸 SHARE ▾** menu (Collage / Animated GIF), not two buttons.
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

## Rules of engagement
- You report OBSERVATIONS + logs; the correctness verdict is Claude Code's.
- This pass = **test + report pass/fail**, not a code PR.
- Do NOT bump the iOS version or archive/upload — that's held by Jake.
- One bug = one clear report (steps + screen + version + log). No vibes.

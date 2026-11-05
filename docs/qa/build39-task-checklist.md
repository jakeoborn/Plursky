# Build 39 task checklist

Assignment: Instinct build 39 assignment (2026-11-05). Internal-only TestFlight
1.15 (39) from the final combined main after review. Updated as each PR moves.

| # | Workstream | Branch / PR | State |
|---|---|---|---|
| 4 | Rescan diagnostics (read-only, share sheet) | `feat/scan-diagnostics` | in this PR, draft |
| 1 | Scan confidence (GPS beats a saved-time guess, weak guesses stay unanswered) | — | next |
| 2 | Scan hours from set times (first start −15 min → last end +15 min per night, nothing outside scanned) | — | with #1 |
| — | Picker cancel is not an error (FilePicker 6.2.0 "pickFiles canceled.") | — | with #1 |
| — | Multi-chunk regression fixture on the real import handler + store | — | with #1 |
| 3 | Shazam failure reasons + IndexedDB blob retry | — | after #1 |
| — | Build 39: live uniqueness recheck, plugins, usage strings, signing, MusicKit, internal-only upload, VALID | — | after merges (not mine to merge) |
| — | Physical f17 retest on Jake's phone | — | after build 39 |

## Hours rule (Jake, 2026-11-05)

"15 min before and after festival ends and everything else does not get
scanned"; "we can do photos/videos between set"; "we have set times in the
app". Per night, in the festival's timezone: first set start − 15 min to last
set end + 15 min. Between-set photos count. Outside items are counted as
skipped, never marked imported, and nothing existing is deleted. A night with
no set times is not scanned and is reported.

## Workstream 4: Rescan diagnostics

- [x] Before-snapshot written when the build first loads (photo-tag.jsx at
      script eval, before React mounts and before any scan); never overwritten.
- [x] Every `_writeMoments` and the cloud restore log added / changed / removed
      records with the caller's function name; back-to-back writes from one
      caller fold into one event (an import writes once per file).
- [x] Scan start, scan end and review close are logged.
- [x] Records carry salted hashed ids and only festival, night, artist, tag
      source, stamp source, time-source label, kind and yes/no flags. No
      capture time, no import time, no names, paths, raw ids, GPS, location,
      fingerprints, text or media.
- [x] Export rebuilt field by field from storage (nothing copied through) and
      hard-bounded at 38,000 characters in every case, summaries and events
      included; `truncated` says what was shed, totals are never cut.
- [x] No share sheet, no navigator.share and no clipboard → "unavailable",
      never "copied".
- [x] "Share scan diagnostic" on Memories: one tap → native share sheet
      (text), falls back to navigator.share then clipboard. Never uploads.
- [x] Diagnostics never write the moment store (gate checks byte identity).
- [x] Gate `scripts/test-scan-diagnostic.mjs` in verify; 2 mutants caught.
- [x] Pixel: button + status on ACL Memories (headless, native stubbed).
- [ ] Full verify on the pushed head.
- [ ] Physical: tap the button on device, confirm the share sheet opens.

Not claimed: the cause of the Charli collapse. This build records the write
that causes it; the cause is named only from a device export.

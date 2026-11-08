# Build 39 task checklist

Assignment: Instinct build 39 assignment (2026-11-05). Internal-only TestFlight
1.15 (39) from the final combined main after review. Updated as each PR moves.

| # | Workstream | Branch / PR | State |
|---|---|---|---|
| 4 | Rescan diagnostics (read-only, share sheet) | `feat/scan-diagnostics` (#383) | review cleared at `08ae1ac` |
| 1 | Scan confidence (GPS beats a saved-time guess, weak guesses stay unanswered) | `feat/scan-confidence-hours` | PR 2, draft |
| 2 | Scan hours from set times (first start −15 min → last end +15 min per night, nothing outside scanned) | `feat/scan-confidence-hours` | PR 2 |
| — | Picker cancel is not an error (FilePicker 6.2.0 "pickFiles canceled.") | `feat/scan-confidence-hours` | PR 2 |
| — | Multi-chunk regression fixture on the real import handler + store | `feat/scan-confidence-hours` | PR 2 |
| 3 | Shazam failure reasons + IndexedDB blob retry | — | after #1 |
| — | Build 39: live uniqueness recheck, plugins, usage strings, signing, MusicKit, internal-only upload, VALID | — | after merges (not mine to merge) |
| — | Physical f17 retest on Jake's phone | — | after build 39 |

## Hours rule (Jake, 2026-11-05)

"15 min before and after festival ends and everything else does not get
scanned"; "we can do photos/videos between set"; "we have set times in the
app"; then "skip" for anything outside (Jake, in the team thread, replacing
the earlier review pile). Per night, in the festival's timezone: first set start − 15 min to last
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
- [x] Gate `scripts/test-scan-diagnostic.mjs` in verify: 31 checks, 5 mutants caught.
- [x] Pixel: button + status on ACL Memories (headless, native stubbed).
- [x] Full verify on the pushed head (`08ae1ac`, VERIFY_EXIT=0).
- [ ] Physical: tap the button on device, confirm the share sheet opens.

Not claimed: the cause of the Charli collapse. This build records the write
that causes it; the cause is named only from a device export.

## Workstreams 1 + 2: confidence, set-time windows, picker cancel (PR 2)

- [x] A match keeps WHY it was picked (`matchReason`, `matchEvidence`) apart
      from where the capture time came from (`tagSource`).
- [x] Saved set + time alone is a suggestion (`tagSuggested`): it stays in
      the review list, so the sheet cannot say "all answered" for a guess.
- [x] Usable GPS outside the festival footprint beats a saved guess
      ("📍 AWAY FROM THE FESTIVAL"); coarse or missing GPS leaves it a
      suggestion. An attended set stays ground truth.
- [x] Usable GPS at ANOTHER anchored stage where an act is playing: if the
      saved act's stage is anchored, GPS wins; if not, the guess stays a
      suggestion and both acts are offered (no invented geometry).
- [x] Overlapping unsaved acts: GPS at a stage's anchor beats an unanchored
      stage's act that only started nearer the time (still flagged).
- [x] Manual and Unknown choices are never re-guessed (scan, recovery, cloud).
- [x] Scan hours from set times, ±15 min, per night and weekend, in the
      festival timezone; between-set photos kept; outside counted and shown
      as skipped, never imported, never marked seen; nothing deleted.
- [x] Nights without set times (Jake 2026-11-05) are scanned in full, no
      hours window; the card says "N nights have no set times, scanned in
      full." on its own line; their photos stay in review like any guess.
- [x] Picker cancel ("pickFiles canceled.") is a cancel, not an error card.
- [x] Cloud restore is add-only across all nights (a moment that moved
      night no longer comes back twice). Not claimed as the Charli cause.
- [x] Review fix (#384 hold): Pick then Scan of the same photo under a
      different export name no longer imports it twice, and two DIFFERENT
      photos that share a size and first 2 KB both import. The content key
      (FNV-1a of the first 2 KB + byte size, no name) only finds a
      candidate; a skip needs a full-content check: SHA-256 of the whole
      original image (`_contentSha256`, new imports, device-local, never
      synced), else a byte compare with the stored copy (videos raw; older
      images against the incoming file recompressed). Any doubt imports.
      Stored records and tags are not rewritten.
- [x] Review fix (#384 hold): an act whose set time is not confirmed
      (`timeEvidence` unresolved) never sets a window boundary. All 59 real
      windows are unchanged by this.
- [x] Gate `scripts/test-scan-hours-confidence.mjs`: 125 checks, 13 mutants.
- [x] Gate `scripts/test-scan-multi-pass.mjs` (real app, headless, 35 checks): 27 ACL W2
      items over 11 acts, 4 saved; scan 1 limited with 2 failed exports;
      manual + Unknown choices; scan 2 full retries the failures and moves
      nothing; scan 3 writes nothing; a stale cloud copy adds only its one
      new moment and undoes no hand choice. A prior manual Pick of asset-0
      (hand-tagged) is not imported again when Scan exports the same bytes
      as CHANGED_EXPORT_NAME.jpg (25 moments, not 26), and keeps its tag;
      the prior's photo is stored recompressed with no hash, as an older
      build left it. Two valid JPEGs with the same size and identical first
      2 KB both import (25, not 24). Scan 4: a night with its set times
      blanked imports both new photos and shows the full-night card line.
- [ ] Full verify on the pushed head.
- [ ] Physical: rescan on device; food photo during a saved set is a
      suggestion or away-from-festival; lunch/hotel photos counted as skipped.

### Scan windows per festival night (from the app's set times)

59 festival-nights: 55 have a window from set times; 4 have none and are
scanned in full (Countdown NYE night 1, Decadence nights 1-2, Dreamstate night 1).
Examples: ACL W1 and W2, each night 12:30-22:15; III Points 15:45-04:15 next
morning. Full table: `node scripts/test-scan-hours-confidence.mjs --report`.

## Workstream 3: Shazam failure reasons (PR 3)

- [x] Distinct reasons, each with its own words on the button: no match, missing file, recognizer unavailable, no audio track, audio could not be read, service/network error, timeout, clip too large. Older native builds' reasons map onto these (`busy`→service, `match-timeout`→timeout, `no-pcm-appended`→audio).
- [x] Stale cache path: a `missing-file` from `identifyFile` (or a missing-path rejection) retries once from the clip kept in IndexedDB; a clip over 60 MB is refused before base64 is built (bounded memory).
- [x] Library recognition never calls the live-mic `identify()`; the Swift file path has no AVAudioSession / record permission.
- [x] Results carry only `{matched, title, artist, source}` or `{matched, reason}`: no path, no native debug payload, no Apple Music ids. Swift resolves error codes (numbers) only; `localizedDescription` appears only in DEBUG logs.
- [x] Swift: one in-flight file call (a second resolves `busy` instead of orphaning the first); the timeout is cancellable and tied to its call.
- [x] Review fix (#385): only the known no-match codes (`no-match`, `did-not-find`, `empty-match`) say "No match". An unknown code (e.g. `unexpected-service-response`), an empty, null or malformed answer, or `matched:true` with no title is `recognizer-error`: "Song ID hit an unexpected error — try again later", never "try a louder clip".
- [x] Gate `scripts/test-shazam-reasons.mjs`: 116 checks, 6 mutants caught (no blob retry, no size cap, all reasons → no-match, the old unknown → no-match fallback, raw payload passed through, no timeout).
- [x] Native compile: `npx cap sync ios` + `xcodebuild -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build` → BUILD SUCCEEDED.
- [ ] Physical (build 39): Shazam a library clip that matches; one with no music (no-audio / no match words); one whose cache was cleared (retries from the stored copy); airplane mode (service error words). No mic prompt at any point.

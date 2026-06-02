# Claude Implementation Spec — Plursky v209 QA Fixes

Date: 2026-06-01
Author: HeyClicky Codex agent, handoff only
Instruction: implement the fixes, but do not let Clicky commit or push directly. Claude Code should own repo surgery, verification, commit, and push per `AGENTS.md` / `CLAUDE.md`.

## Non-negotiable repo rules

- Read `AGENTS.md`, `CLAUDE.md`, and `RELEASE.md` first.
- Edit source files only, never `dist/` or `ios/App/App/public/` directly.
- After shipped JS changes, bump cache-bust in lockstep across `index.html`, `sw.js`, and `app.jsx`.
- Run the verify gate: Babel transform changed JSX, full mount probe, and screenshots for UI changes.
- For iOS delivery, run `node scripts/build.mjs && npx cap sync ios` after web changes.
- Do not commit/push until the implementation is verified and Jake explicitly approves the final ship.

## Goal

Implement all fixes from the v209 QA review across:

1. Video auto-tag timestamp/GPS provenance and migration-safe retagging.
2. Favorite persistence/hero behavior.
3. Peak 20-minute card correctness.
4. Map lens basemap/projection/tap-through reliability.
5. Burst stacking correctness.
6. Night scrubber drag/release reliability.
7. Shazam-from-video diagnostics and native robustness.
8. Backup upload/restore state clarity.
9. Spotify connect/create/manual fallback reliability.

## Files to inspect and likely edit

- `photo-tag.jsx`: media metadata parsing, timestamp-source selection helpers.
- `spotify.jsx`: Memories import flow, lenses, favorite updates, Shazam-from-video UI, backup UI, Spotify trigger UI.
- `spotify-api.jsx`: Spotify OAuth/profile/playlist creation/manual fallback reasons.
- `supabase.jsx`: moment media backup/restore behavior.
- `ios/App/App/ShazamPlugin.swift`: native Shazam-from-video decoding/signature generation diagnostics.
- `scripts/test-import.mjs`: import/tagging regression coverage.
- `index.html`, `sw.js`, `app.jsx`: cache-bust only after JS changes.
- Possibly `QA-v209.md` or a new QA note if Claude wants to document verification.

## Priority order

1. P0 Video auto-tag provenance and safe retag path.
2. P0 Shazam-from-video native diagnostics/robustness.
3. P1 Spotify connect/create/manual fallback.
4. P1 Backup round-trip state/restore clarity.
5. P2 Memories UI lens guardrails: Favorite, Peak, Map, Burst, Night scrubber.

## P0: Video auto-tag timestamp, GPS, and migration-safe retagging

### Current problem

v209 added MP4/MOV metadata parsing, but the current parser scans bytes inside `moov` and does not persist timestamp provenance. QA cannot tell whether a video was tagged from real capture metadata, filename heuristic, or unsafe `file.lastModified`. Previously imported videos may remain mistagged unless re-imported or explicitly retagged.

### Implementation requirements

#### 1. Make metadata parsing structured

In `photo-tag.jsx`, replace or harden `_parseVideoMeta(file)` so it:

- Walks MP4/MOV top-level boxes without reading `mdat`.
- Locates `moov` even when it appears near EOF.
- Walks `moov` descendants by declared box sizes instead of scanning arbitrary payload bytes.
- Parses `mvhd` only as a valid full box:
  - Version 0: 32-bit creation time.
  - Version 1: 64-bit creation time.
  - Seconds since 1904-01-01 UTC.
  - Reject zero, impossible, or wildly future values.
- Converts video UTC capture time to festival-local wall-clock using the existing festival timezone behavior before matching sets.
- Parses GPS from both common variants:
  - QuickTime `©xyz` / ISO-6709 direct string.
  - Nested `data` atom payload form.
  - If feasible, also look for `com.apple.quicktime.location.ISO6709` metadata string.
- Returns provenance, not just values:
  - `date`
  - `lat`
  - `lng`
  - `timestampSource`, e.g. `video-mvhd`, `video-quicktime-date`, or null.
  - `locationSource`, e.g. `video-xyz`, `video-quicktime-location`, or null.
  - Optional `rawUtcMs` for debug/testing.

#### 2. Centralize timestamp-source selection

In `photo-tag.jsx` or `spotify.jsx`, create one helper that decides the trusted capture timestamp for any imported file. Use this order:

1. Image EXIF `DateTimeOriginal` / video MP4-MOV capture metadata.
2. Filename heuristic only when it encodes a plausible festival date/time.
3. `file.lastModified` only if it falls inside or near the festival window and is not obviously the current picker/import time.
4. No trusted timestamp: moment remains untagged fallback.

Persist the winning source on each moment:

- `takenAtSource`: `exif`, `video-mvhd`, `video-quicktime-date`, `filename`, `file-lastModified`, or `none`.
- `locationSource`: `exif-gps`, `video-gps`, `stage-fallback`, or `none`.
- `importedAt`: current timestamp for debugging only; never use this for artist matching.

#### 3. Avoid false auto-tags

When no trusted timestamp exists:

- Write the moment to a fallback night if needed for visibility.
- Set `artistId: null`.
- Set `autoTagged: false`.
- Set `tagSource: 'fallback'` or `filetime-night-only` depending on existing conventions.
- Show retag affordance rather than assigning a likely-wrong artist.

#### 4. Add safe migration/audit path

Do not silently rewrite existing user moments. Add a lightweight local audit/migration helper that:

- Detects video moments with missing `takenAtSource`, suspicious `file-lastModified`, or old auto-derived `tagSource`.
- Marks them `needsRetag: true` or surfaces a retag hint.
- Recomputes only during explicit re-import or an explicit user-approved retag action.
- Avoids cloud schema changes unless existing Supabase storage requires typed columns; if so, nullable fields only.

### Tests

- Synthetic parser tests for:
  - `mvhd` version 0.
  - `mvhd` version 1.
  - `moov` after large `mdat`.
  - Missing `moov`.
  - Direct and nested GPS forms.
- Extend `scripts/test-import.mjs`:
  - Video with valid capture time writes `takenAtSource` beginning with `video-`.
  - Invalid/no metadata does not auto-assign artist from import time.
  - Fallback video is visible with retag prompt.
- Real iPhone:
  - Delete/re-import known EDC videos.
  - Compare Plursky displayed time/artist/stage against iOS Photos info and known set windows.

## P0: Shazam-from-video

### Current problem

The native Shazam path exists but has not been verified on a real phone. If it fails, current UI may collapse distinct causes into “no match.” Swift PCM extraction may mishandle channel layout or sample counts.

### Implementation requirements

#### 1. Add native diagnostics

In `ios/App/App/ShazamPlugin.swift`, for `identifyBase64`, include diagnostic fields on no-match or error responses:

- temp file byte size.
- whether an audio track was found.
- asset duration.
- reader status and reader error string.
- number of sample buffers read.
- total frames appended.
- whether the timeout fired.

Expose these only to console/dev UI in JS; do not clutter production copy.

#### 2. Harden audio conversion

Review and improve `matchFromURL`:

- Do not infer frame count from raw byte length alone when channel layout may differ.
- Use `CMSampleBufferGetNumSamples` where possible.
- Ensure output is mono 44.1k float PCM, non-interleaved, or use `AVAudioConverter` to convert reliably before appending to `SHSignatureGenerator`.
- Ensure delegate callbacks and timeout resolve exactly once.
- Ensure temp files are deleted.

#### 3. Improve JS failure states

In `spotify.jsx` `_identifySongFromMomentVideo` path:

- Distinguish missing local video/blob from true Shazam no-match.
- If restored/backed-up media is unavailable locally, show “video file not available on this device” instead of “no match.”
- Persist successful match to the moment as currently intended.

### Tests

- Physical iPhone, clear-audio video: match returns and moment shows Shazamed song line after reopen.
- Silent/quiet video: friendly no-match, not crash.
- Restored video without local blob: explicit unavailable state.

## P1: Spotify connect/create/manual fallback

### Current problem

QA must verify connect and playlist build. Current code likely has partial fallback behavior, but error reasons need to be normalized so failures do not look like hangs or dead buttons.

### Implementation requirements

In `spotify-api.jsx` and Spotify UI handlers in `spotify.jsx`:

#### 1. Normalize result reasons

Make `ensureSpotifyProfile()` and `createEdcPlaylist()` return stable reasons:

- `ok`
- `not_connected`
- `auth_denied`
- `scope_missing`
- `dev_mode_user_blocked`
- `missing_manual_playlist`
- `playlist_create_forbidden`
- `playlist_write_forbidden`
- `no_tracks`
- `network`
- `rate_limited`
- `unknown`

#### 2. Verify scope after OAuth

After native iOS/web OAuth callback, verify the token has playlist write scope. If missing, show reconnect with scope explanation.

#### 3. Make manual fallback deterministic

If Spotify blocks playlist creation:

- Tell user to create a Spotify playlist named `Plursky`.
- Provide a retry button like “I made it — add tracks.”
- Retry finding the manual playlist and adding tracks without restarting OAuth.
- Never leave the UI in a permanent spinner.

#### 4. Add QA-visible status

During build, show a concise progress/status line:

- connected profile.
- scope ok/missing.
- playlist found/created/manual required.
- tracks added/missed.

### Tests

- Fresh real-device connect succeeds and profile appears.
- Playlist build succeeds for an allowlisted account.
- Forbidden create path shows manual fallback.
- Manual `Plursky` playlist retry adds tracks.
- Missing/expired token asks for reconnect and clears spinner.

## P1: Backup upload/restore

### Current problem

The QA target is signed-in backup round-trip. Current UI shows aggregate status, but failures, restore availability, duplicate accounting, and cap behavior need clearer states.

### Implementation requirements

In `spotify.jsx` and `supabase.jsx`:

#### 1. Structured backup results

Make `_backupMyWeekend()` return structured results:

- `done`
- `total`
- `bytesUploaded`
- `bytesTotal`
- `failed`
- `skippedOverCap`
- per-moment status list if practical.

#### 2. Clear blocker states

Before upload, detect and explain:

- not signed in.
- not Plus.
- offline / not Wi-Fi if Wi-Fi-only remains required.
- over hard cap.
- missing local media blob.

#### 3. Restore clarity

Ensure restore path:

- downloads media for backed-up moments on fresh load/second device.
- updates local `mediaUrl`/blob cache consistently.
- does not duplicate moments.
- marks restored media state so UI can say restored/available.

#### 4. Accurate byte accounting

Use actual blob sizes. Avoid double-counting duplicate `photoId` uploads. Report cap warnings accurately.

### Tests

- Real iPhone signed in as Plus: backup completes and shows accurate X/Y + bytes.
- Fresh app load/second device: at least one restored photo and video opens.
- Forced failed upload: UI reports failure and retry remains available.
- Near cap: warnings/skips are accurate.

## P2: Memories UI lenses

These should be implemented as guardrail fixes even without a confirmed v209 repro, but avoid large rewrites.

### Favorite

Current code areas:

- `_FavStar` in `spotify.jsx`.
- Lightbox star.
- Card star.
- `_heroScore` favorite weighting.
- Grid favorite badge.

Requirements:

- Centralize update by stable moment ID / `photoId`, not object identity.
- Ensure toggle persists to local storage/cloud sync path used by moments.
- Ensure all lenses receive updated moment state immediately.
- Ensure Night hero/cover selection prefers favorite within the group.

Tests:

- Star in lightbox persists after close/reopen.
- Grid badge appears.
- Night cover uses favorited shot.

### Peak 20-minute card

Current code areas:

- `_peakWindow`.
- `PeakMomentCard`.
- Night lens render.

Requirements:

- Require at least three located/timestamped moments before showing.
- Use numeric parsed timestamps to handle cross-midnight windows.
- RELIVE must receive only `peak.items`.
- Thumbnail click opens the exact selected moment.

Tests:

- Dense night shows sane count/range.
- Sparse night hides card.
- RELIVE plays only 20-minute window.

### Burst stacking

Current code areas:

- `_stackBursts`.
- `_GridTile`.
- Grid render.

Requirements:

- Use numeric timestamps, not lexicographic strings.
- Collapse image-only runs within about 4 seconds.
- Require same artist/stage or both untagged; do not merge unrelated moments.
- Preserve full sibling order in the lightbox.

Tests:

- Three same-set photos within 4 seconds collapse with `⧉ 3`.
- Nearby unrelated artist/stage does not merge.
- Swiping reaches every sibling.

### Map lens

Current code areas:

- `MemoriesMapLens`.
- `map.jsx` projection/support.
- map image assets and service worker precache.

Requirements:

- Verify basemap image is included in native/web build and service-worker precache.
- Centralize projection math and clamp pins to map bounds.
- Prefer real GPS for pin placement; fall back to tagged artist stage only when GPS is missing.
- Pin tap and legend chip both open the exact stage/moment set.
- If no located moments but tagged moments exist, show stage fallback rather than blank failure.

Tests:

- Basemap visible offline/native.
- Real GPS pins land on correct stages.
- Untagged/tagged fallback does not stack all pins in a corner.
- Pin and legend tap open correct moments.

### Night scrubber

Current code areas:

- `NightScrubber`.
- Story lens render.

Requirements:

- Use pointer capture on drag.
- Clamp preview position within track bounds.
- Throttle drag preview updates with `requestAnimationFrame` if needed.
- On release, open nearest moment by actual timestamp/track position, not an unstable array index.
- Gold ticks must reflect favorite state.

Tests:

- Drag preview tracks finger smoothly.
- Preview stays on-screen at edges.
- Release opens nearest visible moment.
- Favorite ticks are gold.

## Verification gate for Claude

After implementation:

1. Babel-transform changed JSX files with React preset.
2. Run full mount probe against `index.html`; assert `#root` has children and key functions are globally available.
3. Run/import regression tests, especially `scripts/test-import.mjs` if extended.
4. Capture screenshots for UI lens changes.
5. Run `node scripts/build.mjs`.
6. Run `npx cap sync ios` for iOS bundle.
7. On physical iPhone, execute the minimal QA list below.
8. Only then commit/push if Jake approves.

## Minimal real-device QA list

1. Confirm app footer shows the expected cache-bust version.
2. Delete/re-import target EDC videos; verify time, artist, stage, and `takenAtSource` behavior.
3. Run Shazam from a clear-audio video and confirm song persists.
4. Favorite a moment; verify persistence, grid badge, and Night cover.
5. Check Peak card count/range, RELIVE, and thumbnail tap.
6. Check Grid burst stack and swiping through siblings.
7. Check Map basemap, GPS pins, legend chip, and pin tap.
8. Check Story night scrubber drag/release and favorite tick.
9. Sign in as Plus; run backup; fresh-load/second-device restore a photo and video.
10. Connect Spotify; build playlist or verify manual `Plursky` fallback adds tracks with no hang.

## Suggested commit framing

Use focused commits if possible:

1. `fix(memories): make media timestamps provenance-safe`
2. `fix(shazam): harden video recognition diagnostics`
3. `fix(spotify): clarify playlist fallback states`
4. `fix(backup): report media backup round trips`
5. `fix(memories): tighten lens interactions`

Include Claude’s required co-author trailer from `CLAUDE.md` when committing.

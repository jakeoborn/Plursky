# Plursky v209 Prioritized Patch Plan

Date: 2026-06-01
Scope: code review only. No files modified except this handoff report. Do not apply code, commit, or push without explicit user approval.

## Sources reviewed

- `QA-v209-agent-report.md`: build 209 report; all seven QA checks and Spotify were not executed because iPhone Mirroring automation timed out.
- `QA-v208.md`: canonical feature checklist for Favorite, Peak card, Burst stacking, Map lens, Night scrubber, Shazam-from-video, and Backup.
- Relevant code: `photo-tag.jsx`, `spotify.jsx`, `spotify-api.jsx`, `supabase.jsx`, `ios/App/App/ShazamPlugin.swift`, plus release rules in `CLAUDE.md` / `RELEASE.md`.

## Executive priority

1. P0: make video auto-tag timestamp/source selection robust and observable before any re-import audit.
2. P0: verify/fix Shazam-from-video, because it depends on native Swift and real video/audio behavior.
3. P1: harden Spotify connect/create/fallback so QA can distinguish OAuth failure, Dev Mode limits, missing manual playlist, and real API errors.
4. P1: harden backup status/restore feedback and byte accounting around Plus-gated uploads.
5. P2: UI feature polish/guardrails for Favorite, Peak card, Map lens, Burst stacking, and Night scrubber after real-device repro details exist.

## P0 — Video auto-tag timestamp and GPS

### Current code

- `photo-tag.jsx:101` routes videos to `_parseVideoMeta(file)`.
- `photo-tag.jsx:241` parses top-level MP4/MOV `moov`, scans for `mvhd` and `©xyz`, and returns `{ date, lat, lng }`.
- `photo-tag.jsx:307` / `photo-tag.jsx:312` treat date structs as festival-local wall-clock when computing night windows.
- `spotify.jsx:4138` import flow reads metadata, matches to artist/night, and writes `takenAt`, `location`, `tagSource`.
- `spotify.jsx:1202` has an older timestamp selection helper/comment that falls back to `file.lastModified` only when plausible.

### Likely issues

- The v209 parser treats `mvhd` bytes as if the `mvhd` type starts immediately before version, but an MP4 full box layout is `size,type,version,flags,creation_time`. Because the scanner matches the four bytes of `mvhd`, version is at `i + 4`, creation time starts at `i + 8` for version 0 and `i + 8` / `i + 16` for version 1 only if `i` points to type. That part is plausible, but it should validate surrounding box size and avoid accidental `mvhd` byte matches inside payloads.
- `©xyz` parsing assumes a two-byte length at `i + 4`, but QuickTime metadata atoms usually have nested `data` atoms; GPS may not be direct ASCII at `i + 8`.
- The import writer does not appear to persist which timestamp source won. Without that, QA cannot distinguish true video metadata from filename/filetime fallback.
- Existing moments already imported with bad timestamps will not be automatically corrected by code changes. A migration/retag path is needed for prior v208/v209 imports.

### Proposed patch

- In `photo-tag.jsx`, replace the byte-by-byte scan with a bounded box walker for `moov` children:
  - Walk child boxes by `{start,size,type,header}` inside `moov`.
  - Parse `mvhd` only as a full box with valid size, version 0/1, and sane creation time range.
  - Parse GPS from QuickTime `©xyz` by checking direct payload and nested `data` payload variants; also consider `com.apple.quicktime.location.ISO6709` if present. also have ,=my saved sets info to ceross reference as we have their time yhey are playing
  - Return `{ date, lat, lng, timestampSource: 'video-mvhd' | 'video-quicktime-date' | null, locationSource: 'video-xyz' | 'video-quicktime-location' | null, rawUtcMs? }`.
- In the import path in `spotify.jsx`, select timestamp sources in this order:
  1. Image EXIF `DateTimeOriginal` or video MP4/MOV creation metadata.
  2. Filename heuristic for screenshots/exported media when it encodes a plausible festival date.
  3. `file.lastModified` only if it is inside or near the configured festival window and not obviously picker/import time.
  4. No trusted date: store untagged fallback, `artistId: null`, `autoTagged: false`, `tagSource: 'fallback'`, with a retag hint.
- Persist timestamp provenance per moment:
  - `takenAtSource`, e.g. `exif`, `video-mvhd`, `filename`, `file-lastModified`, `none`.
  - `locationSource`, e.g. `exif-gps`, `video-gps`, `stage-fallback`, `none`.
  - Optional `importedAt` for debugging, not used for set matching.
- Add a non-destructive migration/retag utility for existing local moments:
  - Detect videos with `tagSource` from fallback/filetime or suspicious `takenAt` equal to import day.
  - If original `file` is still available only during re-import, prefer re-import to recompute; otherwise mark them as needing retag rather than silently changing tags.
  - Do not alter cloud-backed records without an explicit migration version and backup.

### Rationale

Video tagging must be based on capture time, not WebKit picker/import time. Persisted provenance makes the QA audit explainable and prevents future fixes from looking like black-box behavior.

### Risks

- MP4 metadata formats vary; parser must be defensive and never read entire `mdat`.
- Changing timestamp selection can move moments between nights and change automatic artist tags.
- Existing local/cloud data may need user-visible retag prompts rather than silent mutation.

### Tests

- Add parser fixtures or synthetic MP4 box buffers for version 0/1 `mvhd`, nested/direct GPS, missing `moov`, and large `mdat` before/after `moov`.
- Extend `scripts/test-import.mjs` to assert `takenAtSource` for video metadata and that invalid filetime produces fallback with `artistId: null`.
- Real device: delete/re-import videos, verify each card’s displayed time and artist against iOS Photos metadata and known set windows.

## P0 — Shazam-from-video

### Current code

- `spotify.jsx:1779` has `_identifySongFromMomentVideo`, preferring native `window.ShazamPlugin.identifyBase64` on iOS and web fallback otherwise.
- `spotify.jsx:7772` has live microphone Shazam flow using `window.ShazamPlugin.identify()`.
- `ios/App/App/ShazamPlugin.swift:18` exposes `identifyBase64`.
- `ios/App/App/ShazamPlugin.swift:67` decodes a temp media file, builds an `SHSignatureGenerator`, and calls `session.match(signature)`.

### Proposed patch

- If QA reports no-match on clear audio, first add native debug returns, not UI guessing:
  - Return decoded file size, detected audio track duration, frame count/sample count appended, reader status/error, and match timeout reason in failure payloads.
  - In JS, surface a short debug line only in Dev Mode or console.
- In Swift, verify PCM settings match buffer layout:
  - Current settings request interleaved false but code copies all bytes into `floatChannelData[0]`; stereo or different channel layout can corrupt samples.
  - Prefer AVAudioConverter to mono 44.1k non-interleaved, or set output to one channel explicitly and confirm frame count from `CMSampleBufferGetNumSamples` instead of byte length / 4.
- In JS, ensure the video moment still has blob/base64 data available after backup/restore; if not, show “video file not available on this device” rather than “no match”.

### Rationale

The feature is native and previously unverified on physical hardware; failure reasons need to distinguish no audio, bad decode, bad PCM conversion, and true Shazam no-match.

### Risks

- Native Swift changes require Xcode build/archive validation, not just web build.
- ShazamKit behavior can vary by clip volume/length and network/catalog availability.

### Tests

- Physical iPhone only: clear-audio video moment → identify from video → matched song line persists.
- Test silent/low-volume video → friendly no-match.
- Test restored video moment → either identifies or correctly reports missing local media.

## P1 — Spotify connect/create/fallback

### Current code

- `spotify-api.jsx:641` disconnects Spotify.
- `spotify-api.jsx:690` ensures profile/token.
- `spotify-api.jsx:764` comments on post-Nov-2024 Spotify Dev Mode/manual playlist behavior.
- `spotify-api.jsx:838` creates/fills playlist by finding a manually created “Plursky” playlist and falling back when 403 blocks playlist creation.
- `spotify.jsx:5627` triggers soundtrack playlist build.
- `spotify.jsx:6694` triggers attended-set playlist build.
- `spotify.jsx:99` includes native-iOS Spotify fallback hint in the account card.

### Proposed patch

- Normalize `createEdcPlaylist` result reasons:
  - `not_connected`, `auth_denied`, `dev_mode_user_blocked`, `missing_manual_playlist`, `playlist_create_forbidden`, `playlist_write_forbidden`, `no_tracks`, `network`, `ok`.
- On native iOS, after OAuth callback, explicitly verify `playlist-modify-private` scope and show reconnect if absent.
- If playlist creation is forbidden, show a deterministic manual fallback:
  - Tell user to create a Spotify playlist named `Plursky`.
  - Provide “I made it — try adding tracks” button that retries `_findPlurskyPlaylist` and track add without restarting OAuth.
  - Do not leave the build button spinning or dead.
- Log status in one UI line for QA: connected profile, scope ok/missing, playlist found/created, tracks added/missed.

### Rationale

QA-v209 specifically asks to verify connect + build playlist + fallback. Current code likely works for some states but needs clearer branching so failures become actionable.

### Risks

- Spotify API restrictions change externally; keep copy generic and fallback stable.
- OAuth redirect behavior on Capacitor differs from web; avoid breaking existing token storage.

### Tests

- Real device fresh install: connect Spotify, complete OAuth, verify profile shown.
- Authorized test user: build playlist or add tracks to existing `Plursky` playlist.
- Non-allowlisted/forbidden create path: manual fallback appears and retry works.
- Remove token/scope mismatch: reconnect path works and no dead spinner remains.

## P1 — Backup and restore

### Current code

- `spotify.jsx:1295` defines Plus-gated backup caps and status.
- `spotify.jsx:1323` backs up the weekend.
- `spotify.jsx:4368` computes backup status.
- `spotify.jsx:4543` renders “Back up my weekend” and auto-backup controls.
- `supabase.jsx:2884` uploads media blobs to private `moment-media` storage.

### Proposed patch

- Add explicit per-moment backup state in UI: pending, uploaded, skipped over cap, failed, restored.
- Make `_backupMyWeekend` return structured failure details instead of only counts.
- Verify byte accounting uses actual blob sizes and handles duplicates by `photoId` consistently.
- Ensure restore path rehydrates media blobs and updates `mediaUrl` / local caches without duplicating moments.
- If not Plus/signed-in/Wi-Fi, make the button state explain the blocker before running.

### Rationale

The QA check is a round-trip, not just upload. The user needs to know whether media is truly restorable on a fresh load/second device.

### Risks

- Storage changes can affect quotas/costs.
- Restore code may touch auth/cloud paths; avoid schema changes unless necessary.

### Tests

- Physical iPhone signed in as Plus: backup completes with X/Y and bytes.
- Fresh app load or second device: moments restore and video/photo media opens.
- Force one upload failure: UI reports retryable failure, no false “all safe”.
- Near soft/hard cap: warnings and skips are accurate.

## P2 — Favorite / peak card / map lens / burst stacking / night scrubber

### Favorite

- Current code: star UI in `spotify.jsx:1875`, lightbox usage at `spotify.jsx:2016`, card usage at `spotify.jsx:2576`, hero scoring at `spotify.jsx:2742`, grid badge at `spotify.jsx:3930`.
- Proposed patch if QA fails: centralize moment update by `photoId` so favorite toggles update all lenses and persisted storage; ensure hero selection sorts favorite first within the same group.
- Tests: star in lightbox persists after close/reopen; grid badge appears; Night cover uses favorite.

### Peak 20-min card

- Current code: `_peakWindow` at `spotify.jsx:2809`, `PeakMomentCard` at `spotify.jsx:2837`, render/use at `spotify.jsx:4784`.
- Proposed patch if QA fails: require minimum located moments, use parsed epoch helper for cross-midnight ranges, and ensure RELIVE receives only `peak.items`.
- Tests: dense night shows sane count/range; sparse night hides; RELIVE plays only the 20-minute window; thumb opens correct index.

### Burst stacking

- Current code: `_GridTile` at `spotify.jsx:3899`, `_stackBursts` at `spotify.jsx:3946`, render at `spotify.jsx:3969`.
- Proposed patch if QA fails: compare numeric capture epochs instead of lexicographic `takenAt`; require same artist/stage and image-only; preserve all stack siblings in lightbox ordering.
- Tests: three photos within 4 seconds collapse with `⧉ 3`; unrelated artist/stage does not merge; swiping reaches every sibling.

### Map lens

- Current code: `MemoriesMapLens` at `spotify.jsx:3998`, render at `spotify.jsx:4679`; map support code/images are in `map.jsx` plus map assets.
- Proposed patch if QA fails: validate basemap asset loading in precache, centralize stage coordinate projection, fall back from GPS to tagged artist stage only when GPS missing, and make pin/legend both pass the exact stage item set to lightbox.
- Tests: basemap visible offline/native; real GPS pins land on correct stages; unlocated tagged moments still show stage fallback; pin and legend open correct moments.

### Night scrubber

- Current code: `NightScrubber` at `spotify.jsx:3684`, used at `spotify.jsx:3829`.
- Proposed patch if QA fails: use pointer capture, clamp preview x within track bounds, throttle drag state with `requestAnimationFrame`, and map release to nearest moment by timestamp rather than array index position if spacing is uneven.
- Tests: drag preview follows finger smoothly; edges stay on-screen; release opens the nearest visible moment; gold ticks mark favorites.

## Required migrations / timestamp-source changes

- Add moment fields: `takenAtSource`, `locationSource`, and optionally `importedAt`.
- Do not silently rewrite existing moments unless the original media is re-imported or a user-approved retag migration is run.
- Add a one-time local audit helper that marks suspicious video moments as `needsRetag: true` when:
  - `kind === 'video'`, and
  - `takenAtSource` is missing or `file-lastModified`, and
  - `tagSource` is auto-derived, not manual/video-shazam.
- Cloud migration is likely not required if fields are stored inside existing moment JSON; if any Supabase typed columns exist elsewhere, add nullable fields only.

## Minimal real-device verification steps

1. Install latest local iOS build on physical iPhone, confirm Settings footer shows `PLURSKY · v209` or next bumped version.
2. Delete/re-import the target EDC videos; for each video, compare Plursky time/artist/stage to iOS Photos info and known set time.
3. Open a clear-audio video moment and run “Identify the song from this video”; verify matched song persists on the moment.
4. Run Memories lenses on a populated night: favorite toggle/persist, Peak RELIVE, Grid burst stack, Map pin/legend, Story scrubber drag/release.
5. Sign in as Plus, run “Back up my weekend”, then fresh-load or second-device restore and open at least one restored photo and one restored video.
6. Connect Spotify on device, build playlist, and if creation is blocked verify manual `Plursky` playlist fallback adds tracks or gives a clear actionable error.

## Approval gate

You are Clicky, doing VISUAL QA + ON-DEVICE TESTING for Plursky
  (github.com/jakeoborn/Plursky, local /Users/jaobo/Plursky). You can SEE the
  screen and drive the cursor — that's your job. Claude Code (terminal) owns repo
  surgery and the deploy.

  FIRST, read these in the repo: AGENTS.md, CLAUDE.md, RELEASE.md, QA-v208.md.

  HARD RULES — never break:
  1. APPROVAL GATE. Do NOT patch code, bump versions, run build/sync, commit,
     push, open a PR, or file an issue until Jake explicitly approves THAT
     specific next step. Diagnose, look, and propose freely — then stop and wait
     for an explicit "yes / go." One approval = one step, not the next.
  2. NEVER commit, push, or merge to `main`. `main` is the live deploy with no
     build validation — a bad push breaks plursky.com instantly. You share
     Jake's GitHub credentials, so this is on you to honor.
  3. Code changes only as a BRANCH + PR (after approval), or file an issue —
     then let Claude Code run the verify gate (Babel + mount probe + screenshot)
     and merge. Never edit `dist/` or `ios/App/App/public/` (gitignored build
     output) and never touch the `vNNN` cache-bust version — that's Claude Code's.

  WORKFLOW: see a problem on the device/screen → describe it + propose a fix →
  on Jake's approval, file a GitHub issue (or open a PR on a branch) →
  Claude Code implements + verifies + ships → you re-check on the real device.

  ISSUE FORMAT: title "[v209 QA] <feature> — <symptom>", labels qa, v209, ios;
  include device/build, steps, expected vs actual, and a screenshot/clip.

  CURRENT TASK: on-device QA of build v209 / 1.9 (20) on the iPhone (mirrored).
  Run the 7 checks in QA-v208.md. PRIORITY: after re-importing videos, confirm
  each VIDEO now auto-tags to the correct artist for when it was actually shot
  (not import-time) — that's the v209 fix. Report PASS/FAIL/N-A per check + the
  per-video tag audit. File issues only with approval; do not push to main.

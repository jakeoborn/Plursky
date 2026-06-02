# Plursky v209 Combined Claude Handoff

Date: 2026-06-01
Agent: HeyClicky Codex agent mode
Purpose: merge the original implementation spec with actual local fixes, simulator/device access findings, and remaining QA blockers.

## Guardrails

- Do not let Clicky commit or push directly.
- Claude Code should review the local diff, run the full verify gate, decide what to keep/rework, then commit/push only after approval.
- No commits or pushes were made by this agent.

## Local source changes currently present

### P0 media auto-tag provenance

Files changed:

- `photo-tag.jsx`
- `spotify.jsx`

What changed:

- `_parseVideoMeta(file)` now returns provenance fields in addition to timestamp/GPS values:
  - `timestampSource`
  - `locationSource`
  - `rawUtcMs`
- MP4/MOV parsing is more structured:
  - walks `moov` children by box size.
  - parses valid `mvhd` full boxes.
  - rejects impossible/future creation times.
  - scans direct/nested ISO-6709 GPS payloads.
- `_metaFromFile` now records source selection:
  - `exif`
  - `video-*`
  - `filename`
  - `file-lastModified`
  - `none`
- `file.lastModified` is now accepted only when it maps to a configured festival night.
- Imported moments now persist:
  - `takenAtSource`
  - `locationSource`
  - `importedAt`
  - `needsRetag` for suspect videos.

Claude review notes:

- Confirm the MP4 child-walk covers enough QuickTime metadata variants.
- Add real fixture tests before shipping if possible.
- Existing mistagged videos are not silently rewritten; QA should re-import or run an explicit retag path.

### P0 Shazam-from-video diagnostics

File changed:

- `ios/App/App/ShazamPlugin.swift`

What changed:

- `identifyBase64` no-match responses include debug data:
  - file bytes.
  - asset duration.
  - audio-track presence.
  - sample buffer count.
  - frames appended.
  - reader status/error.
  - timeout/no-match reason.
- Sample count uses `CMSampleBufferGetNumSamples` when possible instead of relying only on raw byte length.

Claude review notes:

- This is diagnostic hardening, not full AVAudioConverter rework.
- Must be compiled and verified on a real device for ShazamKit behavior.

### P2 Memories lens guardrails

File changed:

- `spotify.jsx`

What changed:

- Burst stacking now requires matching stage as well as matching artist/untagged state.
- Map lens now prefers real GPS-derived nearest stage first, then falls back to tagged artist stage.

Claude review notes:

- These are low-risk guardrails, but still need visual checks.

### Simulator QA access hooks

Files changed:

- `app.jsx`
- `spotify.jsx`

What changed:

- `tab=memories` is now accepted as a deep-link tab.
- `qaMode=1` bypasses onboarding.
- Query parsing can read normal search params or `#?...` hash params.
- A guarded `qaSeed=memories` path seeds synthetic Memories data only when no moments exist.
- Added `window.plurskySeedQaMoments` and `window.plurskyApplyUrlParams` hooks.
- Added a Capacitor `appUrlOpen` listener intended to apply QA params from `simctl openurl`.

Claude review notes:

- This is useful for QA but should be reviewed carefully before production. Consider gating with `DEV`, native debug build flags, or removing before App Store submission.
- `simctl openurl` currently triggers an iOS confirmation sheet, so this is not fully automated yet in this environment.

## Verification actually run

Passed:

- `npm run build` with Homebrew Node path.
- `npm run cap:sync`.
- TypeScript JSX parse checks for changed JSX files.
- `xcodebuild` Simulator Debug build succeeded.
- Simulator install and normal app launch succeeded.
- Normal Simulator launch rendered Plursky after a few seconds; the earlier black screen was transient startup timing.
- iPhone Mirroring resumed and showed the real device Plursky home/memories surface.

Partially verified:

- Real iPhone visual state:
  - Plursky visible.
  - EDC LV 2026 home/memories loaded.
  - `Your weekend, recapped` visible.
  - Memories preview row shows imported media/video cards.
  - Saved sets list visible.

Blocked:

- In-app iPhone Mirroring tapping/dragging: iPhone Mirroring exposes only host window/menu AX, not iOS controls.
- Simulator `simctl io tap`: this Xcode simctl build does not provide a tap operation.
- `simctl openurl`: shows an `Open in Plursky?` confirmation sheet that cannot be dismissed by this safe runtime.
- Full touch-heavy QA remains blocked without human tapping, XCUITest, or a stronger simulator input tool.

## Current QA artifacts

- `QA-v209-patch-plan.md`: original prioritized patch plan.
- `QA-v209-claude-implementation-spec.md`: original implementation spec.
- `QA-v209-device-qa-attempt.md`: real-device visual QA attempt and blockers.
- `QA-v209-ios-control-access.md`: simulator/control-path findings.
- This file: combined handoff after fixes and access testing.

## Remaining implementation recommendations for Claude

### 1. Decide fate of QA hooks before shipping

Recommended:

- Keep `tab=memories` support if useful.
- Keep hash/search parser if useful.
- Gate `qaMode`, `qaSeed`, `plurskySeedQaMoments`, and `plurskyApplyUrlParams` behind a debug-only condition or remove before release.

### 2. Add XCUITest smoke target

Best next path for agent-driven iOS QA:

- Add a UI test target that can tap native simulator coordinates through XCTest APIs.
- Smoke flow:
  1. Launch with onboarding disabled.
  2. Seed QA moments.
  3. Open Memories.
  4. Capture Grid, Story, Night, Map screenshots.
  5. Tap a moment/lightbox and favorite star.
  6. Verify basic UI labels exist.

This avoids relying on unavailable `simctl io tap` and unsafe iPhone Mirroring pixels.

### 3. Use real device for non-simulator-representative checks

Still needs human/physical device QA:

- Photos import/video auto-tag re-import audit.
- Shazam-from-video with native ShazamKit.
- GPS-accurate Map pins from real media.
- Backup round-trip as signed-in Plus.
- Spotify connect/create/manual fallback OAuth.

## Minimal next action for Claude

1. Review the local diff in `app.jsx`, `spotify.jsx`, `photo-tag.jsx`, and `ios/App/App/ShazamPlugin.swift`.
2. Decide whether to keep, gate, or remove QA hooks.
3. Add or run an XCUITest smoke target for simulator-controllable pages.
4. Run full Plursky verify gate.
5. Hand the physical-device-only checklist back to Clicky/human.
6. Commit/push only after approval.

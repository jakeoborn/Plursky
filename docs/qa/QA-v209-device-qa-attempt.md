# Plursky v209 Device QA Attempt

Date: 2026-06-01
Agent: HeyClicky Codex agent mode
Scope: real-device QA attempt after local source fixes and iOS sync.

## What was prepared

- Ran `PATH=/opt/homebrew/bin:/usr/local/bin:$PATH npm run cap:sync`.
- Capacitor sync completed successfully:
  - web assets copied from `dist` to `ios/App/App/public`.
  - iOS plugins updated.
  - `pod install` completed.
- Confirmed native public bundle contains `v209` cache-bust entries.

## Device access result

- iPhone Mirroring was resumed by the user and Plursky is visible.
- Fresh mirror capture saved outside the repo at `/tmp/plursky-device-qa-live-2.png` for local inspection only.
- iPhone Mirroring exposes only the host window/menu AX tree, not tappable in-app iOS controls.
- HeyClicky's safe runtime does not expose drag or unrestricted pixel clicking, so I did not perform touch-heavy or destructive flows through coordinates.

## Visual checks completed

- PASS: Plursky is running on the mirrored iPhone.
- PASS: App is on EDC LV 2026 home/memories surface.
- PASS: Top card shows `Your weekend, recapped` with `27 sets caught`.
- PASS: Memories preview row is visible and includes imported media/video cards labelled `NIGHT 1` with durations visible (`0:32`, `0:14`, `0:05`).
- PASS: Saved sets list is visible with Friday artists, indicating app data loaded.
- PASS: Bottom tab bar is visible; app is responsive visually in the mirrored window.

## QA status

| Check | Result | Notes |
|---|---:|---|
| Confirm app launches on device | PASS | Plursky visible via iPhone Mirroring. |
| Confirm cache-bust | Partial | Native bundle contains `v209`; footer was not reachable without in-app tapping/scrolling. |
| Video re-import auto-tag | Blocked | Requires Photos import and touch interactions. |
| Shazam from video | Blocked | Requires opening a video moment and triggering native Shazam. |
| Favorite | Blocked | Requires opening a moment/lightbox and tapping star. |
| Peak 20-min card | Blocked | Requires Memories lens navigation and RELIVE/lightbox taps. |
| Burst stacking | Blocked | Requires Grid lens navigation and lightbox swiping. |
| Map lens | Blocked | Requires Map lens navigation and pin/legend taps. |
| Night scrubber | Blocked | Requires Story lens drag gesture; drag is not exposed safely. |
| Backup round-trip | Blocked | Requires signed-in Plus flow and likely network/storage mutations. |
| Spotify connect/create/fallback | Blocked | Requires OAuth/app interaction and may mutate Spotify playlist state. |

## Minimal next step for human/Claude

1. Use the physical phone or direct human tapping in iPhone Mirroring.
2. Confirm Settings/Me footer shows `PLURSKY · v209` or next bumped cache-bust.
3. Run the touch-heavy QA checklist from `QA-v209-claude-implementation-spec.md` lines 414–425.
4. Capture screenshots/video for any failure.

## Guardrail

No commits or pushes were made by this agent.

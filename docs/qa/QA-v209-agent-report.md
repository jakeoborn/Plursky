# Plursky QA Handoff Report — Build 209

Date: 2026-06-01
Scope: prepare build 209 locally, run repo verification, attempt on-device QA via visible iPhone Mirroring, draft issues only.

## Source of truth used

- Read `QA-v208.md` from the repo and used it as the source of truth for the seven checklist definitions, pass/fail/N/A expectations, and issue template.
- Difference from the on-screen terminal text: the terminal text adds the v209 priority video auto-tag audit and Spotify validation; the seven feature checks remain the `QA-v208.md` checks.
- Issue labels requested for this v209 run: `qa`, `v209`, `ios` for failures; no issues are to be posted without explicit approval.

## Build / verification

- Accepted terminal handoff prompt.
- Current `main` already includes commit `f58f37b fix(v209): videos auto-tag by real capture time (MP4/MOV moov atom)`.
- Confirmed cache bust is `v209` in `index.html`, `sw.js`, and `app.jsx`.
- Locally updated iOS metadata to `MARKETING_VERSION = 1.10` and `CURRENT_PROJECT_VERSION = 21` in `ios/App/App.xcodeproj/project.pbxproj`.
- Ran `npm run build` with Homebrew Node path.
- Ran `npx cap sync ios`; sync completed, including `pod install`.
- Ran in-browser Babel transform for all root `.jsx` files; all passed.
- Ran Playwright mount probe against local server; `#root` had 1 child and `createEdcPlaylist` was a function.
- Saved mount screenshot: `screenshots/qa-v209-mount.png`.

## Part A — seven checks

The iPhone Mirroring window was visible and showed Plursky open on Memories / EDC LV 2026 with approximately 18 moments. However, the local computer-use capture API timed out repeatedly on both Terminal and iPhone Mirroring windows, so I could not reliably tap through or capture fresh failure screenshots from the mirrored phone in this agent session.

Current visible state from the supplied screenshot: physical iPhone 13 Pro mirror shows Plursky → Memories → EDC LV 2026, STORY lens, Sunday selected, `Sun night`, `4 moments`, first visible video/card around `11:16 PM` tagged `GRiZ b2b Wooli` at `KINETIC FIELD`.

| Check | Result | Notes |
|---|---:|---|
| 1. Favorite | NA | Not executed; phone mirror automation/capture timed out. |
| 2. Peak 20-min card | NA | Not executed; phone mirror automation/capture timed out. |
| 3. Burst stacking | NA | Not executed; phone mirror automation/capture timed out. |
| 4. Map lens | NA | Not executed; phone mirror automation/capture timed out. |
| 5. Night scrubber | NA | Not executed; phone mirror automation/capture timed out. |
| 6. Shazam-from-video | NA | Not executed; requires physical-device interaction and mirror control. |
| 7. Signed-in backup round-trip | NA | Not executed; requires physical-device interaction and mirror control. |

## Part B — tagging audit

Not fully executed on-device. Re-import could not be performed reliably because both the Xcode/iPhone mirror AX snapshot and direct screenshot calls timed out. The underlying v209 fix now parses MP4/MOV `moov` metadata and routes videos through `_parseVideoMeta(file)` instead of falling back to `file.lastModified`, which directly targets the suspected video mistag cause.

### Per-video audit table

| Video moment | Time shown | Tag shown | Correctness | Notes |
|---|---:|---|---|---|
| Visible Sunday video/card | 11:16 PM | GRiZ b2b Wooli — Kinetic Field | Unverified | Visible in provided screenshot only; re-import and correctness comparison against true capture time could not be completed due mirror/capture timeouts. |

No incorrect post-reimport examples were confirmed in this run, so the consolidated issue below remains a draft/conditional issue rather than an approval-ready failure report.

### Consolidated issue draft — tagging audit

Title: `[v209 QA] Video auto-tag audit — verify capture-time tagging on imported videos`

Labels: `qa`, `v209`, `ios`

**Where:** iPhone 13 Pro via iPhone Mirroring, iOS unknown, build 1.10 (21) / web v209

**Steps:**
1. Open Plursky → Memories → EDC LV 2026.
2. Import or review each video moment.
3. For every video, compare the tagged artist/time against the actual clip capture time and visible/known set.
4. Record any videos tagged to the wrong artist, stage, night, or import-time window.

**Expected:** Videos tag by their true MP4/MOV capture timestamp and GPS metadata, matching nearby photo behavior.

**Actual:** Not completed in this agent run because iPhone Mirroring automation/capture timed out. v209 includes a code fix for the suspected root cause, so this issue should be used only if the real-device audit still finds mistags.

**Screenshot/clip:** Attach screenshots of each mistagged video card/lightbox and, if possible, the clip metadata/time.

## Part C — Spotify connect and playlist behavior

Not executed. The visible app remained on Memories; phone mirror control/capture timed out before Spotify flow could be tested.

No clean Dev Mode/manual fallback was observed in this run, so there is no pass/fail assertion for Spotify yet.

### Conditional issue draft — Spotify only if it errors/hangs

Title: `[v209 QA] Spotify connect / playlist build — <symptom>`

Labels: `qa`, `v209`, `ios`

**Where:** iPhone 13 Pro via iPhone Mirroring, iOS unknown, build 1.10 (21) / web v209

**Steps:**
1. Open Plursky on device.
2. Start the Spotify connect flow.
3. Complete login/authorization if prompted.
4. Trigger playlist build.
5. If full playlist creation is unavailable, verify the manual fallback path appears and remains usable.

**Expected:** Spotify login succeeds on device; playlist build either creates a playlist or clearly falls back to the manual/dev-mode path without crashing, hanging, or leaving a dead button.

**Actual:** Not executed in this agent run. Fill in only if a real-device retry errors or hangs.

**Screenshot/clip:** Attach screen recording or screenshots of the error/hang state.

## Issue creation status

No GitHub issues were created. No commits were made. No push, archive, upload, publish, or App Store submission was attempted.

Draft issues are included only as local text and require approval before external creation.

## Current local working tree

Expected local changes after this run:

- `ios/App/App.xcodeproj/project.pbxproj` changed to 1.10 (21).
- `screenshots/qa-v209-mount.png` created as verification evidence.
- `QA-v209-agent-report.md` created as this report.

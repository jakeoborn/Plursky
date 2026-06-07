# CLICKY × PLURSKY — Expanded Role Brief

_Last updated: 2026-06-07. Owner: Jake. Maintained by Claude Code._
_Clicky: pull latest `main` before each work session; this file is your standing brief._

## Hard rules (unchanged — these override everything below)

1. **AGENTS.md §0 approval gate**: NO patch, post, send, PR, or state-changing
   action by any agent until Jake explicitly approves THAT step.
2. **Git**: branch + PR only. NEVER push `main`. NO iOS version bumps, NO
   Xcode archive/upload — those are held by Jake/Claude Code. Claude Code
   owns the verify gate and all merges to `main`.
3. **One screen driver at a time.** Announce before taking the screen and
   release it when done — concurrent automation swallows Jake's clicks
   system-wide (this collided with a manual Xcode archive on 2026-06-07).
4. **Privacy**: any output containing Jake's accounts, profile screenshots,
   personal media, or third-party app recon goes to `~/Plursky-private/`,
   NEVER into this repo (it is public — it's the plursky.com deploy).
5. Drafted emails/posts are Jake's voice: deliver as drafts, Jake sends/posts
   (or explicitly approves each one for you to send/post).

## Backlog, ROI order — propose each item, get Jake's OK, then run

### 1. `cua-driver` — on-device QA wave (highest value; nothing else can do it)
Run `docs/qa/CLICKY-BRIEF-v221.md` Part B on the **unlocked** iPhone with the
Xcode console visible (XCUITest already proved insufficient — lock-screen
screenshots prove nothing):
- B1 night-ordering visual scroll of a post-midnight night (screenshot)
- B2 auto-tag ground truth — 8–10 real camera-roll clips WITH Jake
  (his memory is the oracle); fill the handoff table in the brief
- B3 live-mic Shazam — released track + live/unreleased; capture the
  `⚡️[Shazam]` console lines
- B4 backup round-trip (signed-in, Wi-Fi; destructive steps need explicit OK)
- B5 Plus sandbox purchase — ONLY once Paid Apps agreement is Active in ASC
- B6 GPS map lens with real on-site photos
- B7 web video "SHAZAM THIS VIDEO" graceful no-match on plursky.com

### 2. `cua-driver` via iPhone Mirroring — Radiate phone recon (read-only)
The desktop Radiate.app exposed only generic AXGroups; the phone closes the gaps:
- Electric Forest community: pinned rules / moderator posts (screenshot)
- Open the + composer: list attachment types (photo/video/poll/event/link?)
- Type `plursky.com` in a caption draft WITHOUT posting — tappable/auto-linked?
- Quick peek at Lost Lands + EDC Orlando feeds (not reached from desktop)
- Output → `~/Plursky-private/` + a short summary for Jake/Claude Code

### 3. `creative-studio` — App Store listing refresh
The live listing still pitches "EDC 2026" only. iOS 1.11 ships Festival Year,
9:16 story export, Apple Music playlists, multi-festival (EDC + ACL).
Deliver: new screenshot set + subtitle/promo-text options as DRAFTS.
Jake/Claude Code handle the ASC upload. (Design research: Mobbin first —
name the patterns you're modeling on.)

### 4. `creative-studio` — 9:16 recap-card treatment
Radiate is image-first (links unverified), so the story card must carry
`plursky.com` + a CTA legibly at feed size. Deliver a design treatment
(mockup) only — Claude Code implements it in `recap-engine.jsx`.

### 5. `research-report` + `spreadsheet` — festival data pipeline
Per festival (Lost Lands first, then EDC Orlando): one clean sheet —
`artist | day | stage | start | end | source link` (festivaldust.com
`/festivals/<slug>/set-times` is the authoritative first stop). Open it as a
PR; Claude Code's verify gate turns it into `data.jsx`. Standing watches:
ACL 2026 official schedule drop; Electric Forest set-times drop (~Jun 16,
backstops the scheduled routine).

### 6. `pdf` / `artifacts` — partnership collateral
One-page Radiate partner sheet: what Radiate gets (post-event content for
their communities), recap-card visuals, community stats. Attachment for the
partnership email (sends only after Forest flips live). Same template later
seeds the Insomniac pitch deck.

### Parked (no current backlog fit)
`email-assistant` (drafts only, on request) · `google-workspace` · `obsidian`
· `build-preview` (use ad-hoc to show Jake a PR visually before Claude Code
merges).

## Current state snapshot (for orientation)
- Web: **v228 LIVE** (Electric Forest scaffold gated `available:false`)
- iOS: **1.11 (22) SUBMITTED 2026-06-07** (carries v219–v228)
- Next: Forest set-times flip (~Jun 16) → v229 → iOS 1.12 → Radiate email
- Open items list: `TODO.md` §REPORT CLOSE-OUT

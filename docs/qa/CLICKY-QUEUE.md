# CLICKY QUEUE — Plursky standing job queue

_Last refreshed by Claude Code: 2026-06-07 (commits 4d8679c / 1fcf671 / 4f220c3)._
_Contract: read **CLICKY-ROLE.md** first — its hard rules override everything here._

## How this queue works

- Work top-down. Status values: **READY** (no Jake input needed) ·
  **NEEDS-JAKE** (tell Jake when you're ready for it) · **BLOCKED-ON-X** ·
  **DONE (report: <path>)**.
- When you finish a job: update its status line in this file (via your PR or
  alongside the job's PR), save the report per the convention below, and tell
  Jake **"queue updated"**. Claude Code reviews + refreshes the queue next session.
- **Report convention** (this repo is PUBLIC — it deploys plursky.com):
  - Non-personal outputs (data sheets, design mockups, QA tables with no
    personal media) → `docs/qa/reports/<JOB-ID>-<YYYY-MM-DD>/` in the repo, via PR.
  - ANYTHING with Jake's accounts, profile screenshots, personal photos/videos,
    or third-party-app recon → `~/Plursky-private/<JOB-ID>-<YYYY-MM-DD>/`,
    NEVER the repo. Put only a one-line pointer in the queue status.
- PRs only, never push `main`. One screen driver at a time — announce first.

---

## JOB-1 — Lost Lands set-times/lineup research sheet
**Status: READY** · Skills: research-report + spreadsheet
Build the data sheet that feeds Claude Code's Lost Lands build session:
`artist | day | stage | start | end | source URL` for Lost Lands 2026
(Sept, Legend Valley OH). First stop: `festivaldust.com/festivals/lost-lands/set-times`
(it states explicitly if times are TBA — if TBA, deliver the lineup-by-day
without times and note the gate). Cross-check the official site/app.
Deliverable: CSV/markdown table → PR into `docs/qa/reports/JOB-1-<date>/`.

## JOB-2 — App Store listing refresh (drafts)
**Status: READY** · Skills: creative-studio
The live listing still pitches "EDC 2026" only; iOS 1.11 (22, in review) ships
Festival Year recap, 9:16 story export, Apple Music playlists, multi-festival
(EDC + ACL, Forest gated). Deliver DRAFTS only (Jake/Claude Code do the ASC
upload): proposed screenshot set (shots + captions), 2–3 subtitle options
(≤30 chars), promo-text option (≤170 chars). Research via Mobbin first and
name the patterns modeled on. → PR into `docs/qa/reports/JOB-2-<date>/`.

## JOB-3 — 9:16 recap-card treatment (design only)
**Status: READY** · Skills: creative-studio / frontend-design
Radiate feeds are image-first, so the story card must carry `plursky.com` +
a CTA legibly at feed size. Deliver a mockup treatment (placement, size,
contrast of URL/CTA on the 1080×1920 card) — Claude Code implements it in
`recap-engine.jsx`. Reference the current card output for the existing layout.
→ PR into `docs/qa/reports/JOB-3-<date>/`.

## JOB-4 — On-device QA wave (Part B)
**Status: NEEDS-JAKE** (unlocked iPhone + Jake's memory for B2; tell Jake when ready)
Skills: cua-driver · Brief: `docs/qa/CLICKY-BRIEF-v221.md` Part B.
B1 night-ordering visual scroll · B2 auto-tag ground truth (8–10 real
camera-roll clips, Jake is the oracle — candidate set staged at
`~/Plursky-private/vegas-edc-export/festival-candidates/`) · B3 live-mic
Shazam w/ `⚡️[Shazam]` Xcode console lines · B4 backup round-trip (destructive
steps need explicit OK) · B6 GPS map lens · B7 web-video Shazam on plursky.com.
B5 Plus sandbox stays **BLOCKED** until the Paid Apps agreement is Active in ASC.
Reports → `~/Plursky-private/JOB-4-<date>/` (device screenshots), summary table → repo PR.

## JOB-5 — Radiate phone recon (read-only)
**Status: NEEDS-JAKE** (iPhone Mirroring + his logged-in Radiate session)
Skills: cua-driver. Desktop wrapper exposed only generic AXGroups; the phone
closes the gaps: Electric Forest pinned rules/moderator posts (screenshot) ·
open the + composer and list attachment types · type `plursky.com` in a
caption draft WITHOUT posting — tappable or not? · quick peek at Lost Lands +
EDC Orlando feeds. NO posting/liking/joining. → `~/Plursky-private/JOB-5-<date>/`.

## JOB-6 — Radiate partner one-pager (PDF)
**Status: BLOCKED-ON-JOB-5** (link policy + format answer shapes the ask)
Skills: pdf + creative-studio. One page: what Radiate gets (post-event content
for their communities), recap-card visuals, community stats (Forest 93k /
Lost Lands 103k / EDC LV 205k). Attachment for the partnership email — which
sends only after Electric Forest flips live (~Jun 16 → v229 → iOS 1.12).
→ PR into `docs/qa/reports/JOB-6-<date>/`.

---

## Standing watches (check when you have idle capacity; report only on change)
- **W-1**: Electric Forest official set times (`festivaldust.com/festivals/electric-forest/set-times`)
  — a scheduled routine also checks Jun 16 14:00Z; if you see them DROP earlier,
  tell Jake immediately (triggers the flip session).
- **W-2**: ACL 2026 official schedule drop (current data is estimated from 2025 — TODO #20).

## Done log
_(Clicky appends one line per completed job: JOB-ID · date · report path · one-line outcome)_

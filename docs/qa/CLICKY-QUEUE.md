# CLICKY QUEUE — Plursky standing job queue

_Last refreshed by Claude Code: **2026-08-27** (prev 2026-06-07). Train at refresh:
web **v232 live** (v233 in PR #23), iOS **1.11 (22)**._
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
**Status: SUPERSEDED 2026-08-27** — do not start.
The lineup half landed in the repo without this sheet: **#10 merged** with all
201 official acts (`available: false`). #11 was the duplicate and was closed.
The set-times half did not disappear, it **moved to a watch** — see **W-3**,
which is what fires the flip session (~Sep 15, for Sep 18–20).
<details><summary>original brief</summary>
Build the data sheet that feeds Claude Code's Lost Lands build session:
`artist | day | stage | start | end | source URL` for Lost Lands 2026
(Sept, Legend Valley OH). First stop: `festivaldust.com/festivals/lost-lands/set-times`
(it states explicitly if times are TBA — if TBA, deliver the lineup-by-day
without times and note the gate). Cross-check the official site/app.
Deliverable: CSV/markdown table → PR into `docs/qa/reports/JOB-1-<date>/`.
</details>

## JOB-2 — App Store listing refresh (drafts)
**Status: READY** · Skills: creative-studio
**Re-triaged 2026-08-27 — the feature list below was rewritten; the old one
described iOS 1.11 "in review" and a v228 web train.** Current truth: iOS
**1.11 (22)** is the shipped marketing version; web is **v232 live**. What the
listing still fails to mention: Festival Year recap, 9:16 story export, Apple
Music playlists, and **multi-festival switching** — now **two festivals live**
(EDC LV + ACL 2026) with five more scaffolded and gated.
⚠️ Pitch only what is LIVE. Lost Lands, EDC Orlando, Tomorrowland and Coachella
are `available: false` — they are not features yet.
⚠️ **Do not draft price copy.** Plursky+ pricing is founder-eyes until sign-off
(see rule 4 in the 2026-08-27 work order). Deliver DRAFTS only (Jake/Claude Code do the ASC
upload): proposed screenshot set (shots + captions), 2–3 subtitle options
(≤30 chars), promo-text option (≤170 chars). Research via Mobbin first and
name the patterns modeled on. → PR into `docs/qa/reports/JOB-2-<date>/`.

## JOB-3 — 9:16 recap-card treatment (design only)
**Status: DONE 2026-08-27** (delivered by another lane, not by Clicky) —
**PR #13 merged**, "recap export watermark legibility (audit + 4 fixes)". A
phone-legible `PLURSKY.COM` now renders on all 8 export surfaces, and the
founder copy decision inside it was taken. Nothing left to design here.
<details><summary>original brief</summary>
Radiate feeds are image-first, so the story card must carry `plursky.com` +
a CTA legibly at feed size. Deliver a mockup treatment (placement, size,
contrast of URL/CTA on the 1080×1920 card) — Claude Code implements it in
`recap-engine.jsx`. Reference the current card output for the existing layout.
→ PR into `docs/qa/reports/JOB-3-<date>/`.
</details>

## JOB-4 — On-device QA wave (Part B)
**Status: NEEDS-JAKE** (unlocked iPhone + Jake's memory for B2; tell Jake when ready)
Skills: cua-driver · Brief: `docs/qa/CLICKY-BRIEF-v221.md` Part B.
⚠️ **Re-triaged 2026-08-27.** The brief is written against **v221**; the device
is running iOS 1.11 (22), whose bundle is **v228**. Web is already **v232**, so
B7 (web-video Shazam on plursky.com) tests a *different build* from B1–B6.
Say which build each result came from. Nothing here needs a new brief — the
checks are still the right checks — but a v233 rebuild + `cap sync` has to
happen before any of B1–B6 reflects current code.
B1 night-ordering visual scroll · B2 auto-tag ground truth (8–10 real
camera-roll clips, Jake is the oracle — candidate set staged at
`~/Plursky-private/vegas-edc-export/festival-candidates/`) · B3 live-mic
Shazam w/ `⚡️[Shazam]` Xcode console lines · B4 backup round-trip (destructive
steps need explicit OK) · B6 GPS map lens · B7 web-video Shazam on plursky.com.
B5 Plus sandbox stays **BLOCKED**, and now on **two** things, not one:
(a) the Paid Apps agreement reaching Active in ASC, and (b) **PR #23**, which
fixes two RevenueCat call-site bugs that made the purchase path non-functional
in every build to date (`getOfferings()` destructure → every purchase returned
"Product not available"; the customer-info listener → every push update
*revoked* Plus). Testing B5 before #23 ships would only re-measure those bugs.
Reports → `~/Plursky-private/JOB-4-<date>/` (device screenshots), summary table → repo PR.

## JOB-5 — Radiate phone recon (read-only)
**Status: NEEDS-JAKE** (iPhone Mirroring + his logged-in Radiate session)
Skills: cua-driver. Desktop wrapper exposed only generic AXGroups; the phone
closes the gaps: Electric Forest pinned rules/moderator posts (screenshot) ·
open the + composer and list attachment types · type `plursky.com` in a
caption draft WITHOUT posting — tappable or not? · quick peek at Lost Lands +
EDC Orlando feeds. NO posting/liking/joining. → `~/Plursky-private/JOB-5-<date>/`.
⚠️ **Re-triaged 2026-08-27:** the Electric Forest pinned-rules screenshot is now
the *least* useful target — EF 2026 ended in June. Prioritise the **Lost Lands**
feed (Sep 18–20, the next flip) and **EDC Orlando** (Nov 6–8). Forest is fine as
a rules/moderation sample only.

## JOB-6 — Radiate partner one-pager (PDF)
**Status: BLOCKED-ON-JOB-5** (link policy + format answer shapes the ask)
🔴 **Its send gate was unsatisfiable and has been re-gated (2026-08-27).** The
line below said the email sends "only after Electric Forest flips live (~Jun 16
→ v229 → iOS 1.12)". **Electric Forest 2026 ran Jun 25–28 and never flipped** —
it is still `available: false` with its event in the past, so that gate could
never be met and JOB-6 would have blocked forever. **New gate: the Lost Lands
flip (~Sep 15, for Sep 18–20).**
Skills: pdf + creative-studio. One page: what Radiate gets (post-event content
for their communities), recap-card visuals, community stats (Forest 93k /
Lost Lands 103k / EDC LV 205k). Attachment for the partnership email — which
sends only after the **Lost Lands** flip (~Sep 15) — see the re-gate note above.
→ PR into `docs/qa/reports/JOB-6-<date>/`.

---

## Standing watches (check when you have idle capacity; report only on change)
- ~~**W-1**: Electric Forest official set times~~ — **RETIRED 2026-08-27.**
  EF 2026 ran **Jun 25–28** and is in the past. The watch fired for a flip that
  never happened; there is nothing left to watch. See the flagged item below —
  the entry itself still needs a decision.
- **W-2**: **ACL 2026** official schedule drop. **Re-dated 2026-08-27:** ACL is
  **Oct 2–4 and Oct 9–11** (Jake attends weekend 2). Schedules typically publish
  ~4–6 weeks out, so expect **early-to-mid September** — this is now a *near*
  watch, not a distant one. Current stage assignments and set times are
  **estimated from 2025** (TODO #20). ACL is `available: true` and LIVE, so this
  is the one watch where stale data is already reaching real users.
- **W-3** *(new 2026-08-27)*: **Lost Lands 2026** official set times —
  `festivaldust.com/festivals/lost-lands/set-times` + the official site/app.
  **This is the next flip and the queue had no watch for it.** Lineup is already
  in the repo (201 acts, #10); day/stage/time assignments are PROVISIONAL and
  the entry is `available: false`. Set times publishing is what fires the flip
  session (~Sep 15, for Sep 18–20). Tell Jake the moment they drop.

## Flagged for the Claude Code lane (not Clicky work)
- **`electric-forest-2026` is a dead gated entry.** Event date passed, never
  flipped, still `available: false` — and `/f/electric-forest-2026/` is in
  `sitemap.xml`, so a **past** festival is being published to search engines
  with 118 performers. Needs a founder decision: retire the entry, or roll it
  to Electric Forest 2027. Per AGENTS.md §4 this is now a standing check on any
  gated entry whose date has passed.

## Done log
_(Clicky appends one line per completed job: JOB-ID · date · report path · one-line outcome)_

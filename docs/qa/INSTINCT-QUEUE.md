# INSTINCT QUEUE — Plursky standing job queue

_Last refreshed by Instinct: **2026-09-08** (post-#106). Train at refresh: web
**v283** on `main` (Portola 2026 LIVE, flip merged 2:39pm CT), iOS **1.12 (25)**
WAITING FOR REVIEW since 2026-09-08 1:23am CT (resubmitted after the 2.1(b)
rejection; Plursky+ Monthly $4.99 / Annual $7.99 prices set same day)._
_Contract: read **INSTINCT-ROLE.md** first — its hard rules override everything here._

## How this queue works

- Work top-down. Status values: **READY** (no Jake input needed) ·
  **NEEDS-JAKE** (tell Jake when you're ready for it) · **BLOCKED-ON-X** ·
  **WATCH** (nothing to do until the trigger fires) · **DONE (report: <path>)**.
- When you finish a job: update its status line here (in your PR, or alongside
  the job's PR), save the report per the convention below, and tell Jake
  **"queue updated"**. Claude Code reviews and refreshes the queue next session.
- **Report convention** (this repo is PUBLIC — it deploys plursky.com):
  - Non-personal outputs (data sheets, design mockups, QA tables with no personal
    media) → `docs/qa/reports/<JOB-ID>-<YYYY-MM-DD>/` in the repo, via PR.
  - ANYTHING with Jake's accounts, profile screenshots, personal photos/videos,
    or third-party-app recon → `~/Plursky-private/<JOB-ID>-<YYYY-MM-DD>/`,
    NEVER the repo. Put only a one-line pointer in the queue status.
  - An **open** defect goes to Jake or Claude Code directly, never into a file
    here (ROLE rule 5).
- PRs only, never push `main`. One screen driver at a time — announce first.

---

## JOB-1 — EDC Orlando 2026 (Nov 6–8): geo SHIPPED → two watches
**Status: WATCH** · Geo rebuild shipped 2026-09-06 (spec issue #68, PR #73, v264).
Verified against `main` 2026-09-08: `data.jsx` carries the measured centroid
(28.53826, -81.40144), five `gpsAnchors`, the `EDCO_STAGES` x/y grid, and
`onSiteRadiusMi: 0.6`. The old "provisional / not re-surveyed" premise in this
entry was stale — do not re-measure what already shipped.

Anchor posture: all five stage anchors are `src: "poster"` — reads off map ART,
not surveyed features. Stages are not permanent surveyable features; more OSM
work CANNOT promote them. Distance readouts stay WITHHELD by design until one
of the only two promoters lands: (a) the official 2026 map, re-fit by the same
method, or (b) real GPS taken on the ground during the festival. A radius gate
passing is not evidence a value is right — the old centroid was ~370 m off and
the 0.6 radius cleared it anyway.

### WATCH-A — official 2026 map art
When the real 2026 map publishes: re-derive an anchor ONLY for a stage the 2026
layout actually moves (`data.jsx` says this at the gpsAnchors block), re-check
the x/y grid alongside (the two are derived together), replace the provisional
ImageMagick placeholder `edco-tinker-2026.jpg` with the processed official art,
and THEN render JOB-1's third deliverable — the surveyability verdict. The
verdict is gated on the art; that gate is the finding, not a delay.

### WATCH-B — Insomniac schedule (stage + set times)
Insomniac drops per-artist stage + set times in the EDC app ~1–2 weeks out.
Pull stage AND set time TOGETHER for all 109 acts — partial data never ships
(`setTimesProvisional: true` and the parked `tba` stage at x:50 y:50 stay until
then). Deliver one sheet: artist | day | stage | start | end | source URL.

Flip itself (`available: true`) is a separate PR, Jake's word, and goes through
the three-item flip-verdict checklist in INSTINCT-ROLE.md.

## JOB-2 — The festival data queue
**Status: READY** · One festival per session, official sources only

### Ordering (verified against the repo 2026-09-08 — re-verify before you start)

19 registry entries: 9 live, 10 gated. Ordered by event date within the season,
weighted by how much a miss costs. `noStage`/`noTime` are counted from
`_DATA_SETS`, so they say what each sheet actually has to supply:

| # | Festival | Dates | Acts | Needs |
|---|---|---|---|---|
| 1 | Lost Lands | Sep 18–20 | 201 | stage **and** time — the deadline (W-1) |
| 2 | Nocturnal Wonderland | Sep 19–20 | 86 | **times only** — stages already assigned |
| 3 | CRSSD Fall | Sep 26–27 | 52 | times only |
| 4 | III Points | Oct 16–17 | 218 | stage and time — heaviest, start early Oct |
| 5 | Escape Halloween | Oct 30–31 | 83 | stage and time, + the W-2 re-measure |
| 6 | EDC Orlando | Nov 6–8 | 109 | gated on JOB-1 (W-3) |
| 7 | 2027 rolls | — | — | off-season, after Nov 8 |

⚠️ **Two entries that look like work and are not:**
- **ACL 2026 needs nothing.** Its schedule is the OFFICIAL per-day grid,
  transcribed from aclfestival.com posters and corroborated by two outlets
  (`data.jsx`, "ACL 2026 lineup — OFFICIAL per-day schedule grid"). It already
  replaced the 2025-estimated grid. What is still 2025 is the park **map**, and
  that is correct: an edition falls back to last year's map until its own is
  released. The only open ACL item is checking whether an official 2026 Zilker
  map has since published.
- **Portola already has all 64 set times.** It is not a twin session with CRSSD.

The reasoning behind the order: an in-season flip that misses its weekend is
worth zero, so date dominates. Argue with it if you disagree — this is a read of
ROI, not gospel — but check the table above against the repo first, because the
cheap falsifying check is one script run and it has already caught two wrong
assumptions.

For each: one clean sheet — `artist | day | stage | start | end | source URL`.

**The festival's own schedule — its official app or site — is the ONLY
authoritative source.** Every row's `source URL` must point there.
`festivaldust.com/festivals/<slug>/set-times` is useful for DISCOVERY and for
cross-checking whether times have dropped at all, never as the source of record.
If the two disagree, the official schedule wins and the discrepancy is worth
reporting.

Read the pre-flight section of INSTINCT-ROLE.md before you start. The short
version: **TBA is a real answer, `stage: null` is a real answer, and inventing
either to fill a column is the defect the gates exist to catch.**

→ PR into `docs/qa/reports/JOB-2-<festival>-<date>/`. Claude Code's verify gate
turns an accepted sheet into `data.jsx`.

## JOB-3 — Onboarding: Plursky+ mention + playlist share toggle
**Status: NEEDS-JAKE** (copy is founder-voice) · Design/drafts only

Two additions to first-run: a Plursky+ mention (what it is, not a hard sell) and
a playlist-share toggle. Small surface, real path to the $500 goal.

⚠️ **Do not draft price copy.** Prices are hardcoded strings in `spotify.jsx` and
are founder-eyes until sign-off. Deliver a flow mockup and copy options as
DRAFTS. Research via Mobbin first and name the patterns you are modeling on.

## JOB-4 — App Store listing refresh (drafts)
**Status: BLOCKED-ON-1.12-VERDICT**

Hold until 1.12 clears review — a listing change mid-rejection muddies the
signal. Then: proposed screenshot set (shots + captions), 2–3 subtitle options
(≤30 chars), promo-text option (≤170 chars).
⚠️ Pitch only what is LIVE. Gated festivals are not features yet.

## JOB-5 — Localization re-run
**Status: BLOCKED-ON-1.12-VERDICT**

Re-run once the verdict lands, so the strings match what actually shipped.

---

## Watches — nothing to do until the trigger fires

### W-1 — Lost Lands set times (~Sep 12, festival Sep 18–20)
**Status: WATCH** · This is the one with a deadline.
**Nocturnal Wonderland (Sep 19–20) is APPROVED for the same week — 2026-09-08.**

⚠️ **Two INDEPENDENT schedule sources. Never assume they drop together.** These
are different festivals with different organisers publishing on their own
timelines; an earlier draft of this file claimed a shared cadence, which was
wrong. Each carries its own trigger, either can slip without the other, and
neither one's silence tells you anything about the other. **Watch them
separately and fill whichever lands first** — do not hold a completed sheet
waiting for its neighbour.

What makes the pairing affordable is the workload, not a shared source: Lost
Lands is a full stage+time fill across 201 acts, Nocturnal is a **times-only**
fill across 86 whose stages are already assigned (`noStage=0`). Different sizes,
so they do not contend even if both land in the same week.

⚠️ Times-only does not mean the gate relaxes. **Stage and time still land
together, per row** — a row ships only when BOTH are real. For Nocturnal the
stages are already in, so supplying the time completes the pair; for Lost Lands
both arrive in the same sheet. A row with a time and no stage, or a stage and an
invented time, is the exact defect the set-time honesty and unplaced-stage gates
exist to catch. TBA and `stage: null` remain real answers.

All 201 acts are already in the repo with `stage: null` and no times — that is
correct and deliberate, not an omission. When the official app schedule drops,
deliver **stage AND set time together** in one sheet. Partial data re-opens the
exact defect the set-time honesty gate was built for.

⛔ Do NOT re-attempt to georeference the Lost Lands festival art. #97 recorded, in
the file, that it has no surveyable feature and is non-conformal with the real
ground. The five ortho-confirmed OSM control points are in `data.jsx` if they are
ever needed; the map is `mapMode: "real"` and stays that way.

### W-2 — Escape Halloween flip checklist (~late Oct)
**Status: WATCH** — re-measure all five x/y at flip time. `cashless: false` stands
unless Jake says otherwise.

### W-3 — EDC Orlando flip (Nov 6–8)
**Status: WATCH** — gated on JOB-1 landing first. The blue dot goes live here.

---

## Not yours — for orientation only

Held by Claude Code: the verify gates, merges to `main`, cache-bust bumps,
`build.mjs` + `cap sync ios`, Xcode archive and upload.

Held by Jake: every approval and every submit, plus the **sandbox purchase on
real hardware** with a Sandbox Apple Account. No simulator can do it — see
"What a simulator cannot prove" in INSTINCT-ROLE.md before you offer to try.

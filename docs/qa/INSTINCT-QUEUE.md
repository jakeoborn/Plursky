# INSTINCT QUEUE — Plursky standing job queue

_Last refreshed by Claude Code: **2026-09-08**. Train at refresh: web **v281** on
`main` (v282 in PR #101), iOS **1.12 (25)**, 1.12 REJECTED 2026-09-07 under
Guideline 2.1(b) and not yet re-uploaded._
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

## JOB-1 — EDC Orlando geo rebuild (Nov 6–8)
**Status: READY** · Owner: Instinct measures, Claude Code builds

The configured centroid is wrong: it is a 19 m memorial plaza in a residential
block roughly 250 m off, and all five anchors are offsets from it, so every one
inherits the error. Follow the Lost Lands pattern (#97): **measure first, report
the ground truth, then build.**

Deliver, before any code changes:
- Tinker Field / Camping World Stadium footprint from OSM — way ids, not a
  screenshot of a pin.
- 4–6 ortho-confirmed control points that are **edition-independent** (buildings,
  ponds, roads, tunnels — permanent structure, never a stage banner or a label).
- An explicit verdict on the 2026 festival art: is any feature on it surveyable
  against ortho imagery? If not, say so — that is a finding, and the answer is
  `mapMode: "real"` on OSM ground, exactly as Lost Lands landed.

→ `docs/qa/reports/JOB-1-<date>/`. Flip itself is a separate PR, Jake's word.

## JOB-2 — The 25-festival data queue
**Status: READY** · One festival per session, official sources only

For each: one clean sheet — `artist | day | stage | start | end | source URL`.
`festivaldust.com/festivals/<slug>/set-times` is the authoritative first stop and
states explicitly when times are TBA.

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

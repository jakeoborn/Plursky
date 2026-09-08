# INSTINCT BRIEF — 2026-09-08 · plan request

_Written by Claude Code for Jake. Instinct: this is a request for an **updated
plan**, not a work order. Read it, then send the plan back in the shape at the
bottom._

**Read in this order first:** `AGENTS.md` → `docs/qa/INSTINCT-ROLE.md` (hard
rules, lane split, what a simulator cannot prove) → `docs/qa/INSTINCT-QUEUE.md`
(the jobs and their status protocol) → this file.

⚠️ **This repo is public — it deploys plursky.com.** Everything below obeys that:
open defects are named but not diagnosed, and there are no keys, IDs or prices in
here. Where you need the specifics to plan properly, **ask Jake or Claude Code
directly** — do not go looking for them in the repo, and do not write them into
your plan if you are given them.

---

## 1. Where the product actually is (2026-09-08)

- **Web**: `v282` on `main`. `main` is the live deploy — push to main updates
  plursky.com.
- **iOS**: `1.12`, build **25**, built but **NOT uploaded**. `1.12` was
  **rejected 2026-09-07 under Guideline 2.1(b)**.
- The cause of that rejection is identified and **fixed on `main`** (#99), with
  two paywall rendering fixes on top (#100, #101). The mechanism of each lives in
  those merged PRs and in the "born from" comments at the call sites.
- Build 25 needs re-archiving off current `main` before upload — the existing
  archive predates #100 and #101. Claude Code does the archive and upload.
  **The submit tap is Jake's, always.**
- **Festivals live**: EDC Las Vegas 2026, ACL 2026. Gated `available: false`:
  Lost Lands, EDC Orlando, Escape, and others.

**Dates that are actually close:**

| What | When | Notes |
|---|---|---|
| Lost Lands set times drop | **~Sep 12** | festival Sep 18–20. Four days out. The only hard deadline. |
| ACL weekend 2 | Oct 9–11 | Jake attends — this is the one he uses live |
| Escape | late Oct | flip checklist, re-measure |
| EDC Orlando | Nov 6–8 | geo rebuild must land well before |

## 2. What has changed since the Clicky era

- **Clicky is retired; you replace it.** Same lane, same hard rules — they were
  each earned by a real failure, so none were relaxed.
- **New rule: no unfixed-defect detail in this repo.** Not in a PR body, a commit
  message, a GitHub issue, or a doc. Issues are public too. Report open defects
  privately to Jake or Claude Code; once fixed, describe them in full.
- **The verify gates grew.** `scripts/verify.mjs` now also enforces set-time
  honesty, unplaced-stage (`stage: null`), precache integrity, and
  module-resolution. If a gate fails, **the data is wrong, not the gate.**
- **Sourcing rule tightened.** The festival's own app or site is the only source
  of record. festivaldust.com is discovery and cross-checking only.

## 3. Already established — please do not re-litigate these

Each cost a real session. Details are in INSTINCT-ROLE.md; the short form:

- **No simulator can complete a sandbox purchase.** Products and prices resolve,
  the sheet presents, then it wants an Apple Account. A real purchase needs
  physical hardware with a Sandbox Apple Account — **Jake's lane, not yours.**
- **XCUITest works, and the WebView is accessible to it** with real labels
  (`ME`, `TODAY`, the paywall buttons). Earlier claims that on-device automation
  was impossible were wrong about the cause. A StoreKit test harness is in flight.
- **Capacitor bridge traffic and the JS console go to stdout**, so only
  `xcrun simctl launch --console-pty` shows them. Absence of a plugin from that
  trace is proof it was never called.
- **The app is iPhone-only.** On iPad it runs letterboxed at 375×667. App Review
  used an iPad Air — check that viewport before calling a screen good.
- **Lost Lands map: settled.** Its art has no surveyable feature and is
  non-conformal with the ground; it ships `mapMode: "real"` on OSM. Do not
  re-attempt to georeference it. `docs/SPEC-anchor-flip-sessions.md` Scope A is
  superseded for that festival.

## 4. Open decisions — a good plan should not assume these

These are Jake's calls. Flag which ones your plan depends on:

1. **Two inline Plursky+ surfaces** (hidden gems, trading-cards export) now
   render the full paywall where they previously showed a fragment. Is that the
   wanted end state, or should they get a compact variant?
2. **Onboarding**: a Plursky+ mention on first run plus a playlist-share toggle
   is wanted — but the copy is founder-voice and prices are founder-eyes until
   sign-off. What does the flow look like without leaning on price?
3. **App Store listing refresh** is held until the 1.12 verdict. Worth planning
   now, or after?
4. **Localization** re-run, same gating question.

## 5. What the plan should cover

Ordered by ROI, with your reasoning visible. For each item state: the goal, who
owns it (you / Claude Code / Jake), what "done" looks like, and what it depends
on. Where you would need information this repo deliberately does not carry, say
so rather than guessing.

Specifically worth your judgement:

- **Lost Lands is four days out.** What do you want in place before Sep 12 so the
  flip is a same-day job rather than a scramble? Stage AND set time land together
  — partial data re-opens the defect the honesty gate exists to catch.
- **The 25-festival queue.** One festival per session, official sources only.
  What is the right order, and what makes a festival "ready to build"?
- **EDC Orlando** needs its ground truth measured before anything is built. What
  is your measurement plan, and what would make you say the art is unusable?
- **Anything you think is mis-prioritised.** The queue is Claude Code's read of
  ROI, not gospel. Argue with it.

## 6. What NOT to plan

Held by Claude Code: the verify gates, merges to `main`, cache-bust bumps,
`build.mjs` + `cap sync ios`, Xcode archive and upload.
Held by Jake: every approval, every send, every submit, and the on-device
sandbox purchase.

## 7. How to deliver it

- Plan with no open-defect specifics → PR into
  `docs/qa/reports/PLAN-<YYYY-MM-DD>/`.
- Anything containing Jake's accounts, personal media, third-party recon, or the
  specifics of an unfixed defect → `~/Plursky-private/PLAN-<YYYY-MM-DD>/`, with a
  one-line pointer in the queue.
- Branch + PR only. Never push `main`.

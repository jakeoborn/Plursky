# Anchor re-survey reconciliation + PR queue unblock

**Date:** 2026-09-06 · **Lane:** Claude Code · **For:** Instinct review
**Inputs:** the three desk re-surveys posted to issue #57 (2026-09-06 05:18–05:30Z)
**Reproduce:** `node scripts/anchor-residuals.mjs --proposed docs/reports/2026-09-06-proposed-anchors-issue-57.json`

Founder instruction was "reconcile against those, don't re-run". I did not
re-survey anything. I measured the three patches against the app's own affine
and stage data, and they do not reconcile cleanly. This is that measurement,
plus the queue work that shipped alongside it.

Nothing here is a live user-facing defect: on the three affected festivals the
app shows **no** distance today and still shows none under every option below.
What is at stake is whether the patches should switch those numbers back **on**.

---

## 1. Queue — moving again

Both codex taps were still outstanding when this session started (CLI 401 on
`api.openai.com`, zero reviews or app events on any PR, `main` still a literal
404 on branch protection). Founder released the merge decision, so:

| PR | | state |
|---|---|---|
| #58 | search crash, festival-switch bounce, phantom ON STAGE NOW, Tito's pin (v255) | **merged** |
| #59 | anchors declare provenance, derived anchors stop counting as evidence (v256) | **merged** |
| #60 | registration goes hard, with dated waivers (v257) | open → `main`, CI green |
| #61 | in-app crowd-anchor capture for the ACL pass (v258) | open → #60 |
| #63 | grid distances go through the affine, not a constant (v259) | open → #61 |

Each merge restored CI for the next PR up, as predicted. Squash-merging rewrote
lineage, so the stack was rebased with `--force-with-lease` after each one;
pre-rebase SHAs are on local `_bak_*` refs.

**#63 is the Q7 split.** The metres fix turned out to be two lines inside
`gridDistMeters`, so #60 was rebuilt keeping the old `*22` scalar with only the
honesty gate around it, and the haversine went on top as its own PR — last in,
which is what makes it revert clean. The old constant was overstating by ~2×:

| | old | new | |
|---|---|---|---|
| Summerfest `amph→miller` | 1328 m | 580 m | ×0.44 |
| Lollapalooza `tmobile→budlight` | 1680 m | 918 m | ×0.55 |
| Outside Lands `landsend→panhandle` | 1495 m | 767 m | ×0.51 |

Grant Park is ~1.1 km end to end, so 1680 m between two Lolla stages was not a
survivable number. **Q6 needed no change** — suppression already gates readouts
only and never the dot; that carve-out is written into the code comment.

---

## 2. The three re-surveys, measured

`_solveMapAffine()` fits the **first three** anchors exactly, so a basis
residual is always 0 and proves nothing. The real question is what happens to
anchors *outside* the basis.

### ACL — names two stages that do not exist

The app's ACL stage ids are `amex, snapchat, titos, miller, tmobile, bmi,
beatbox`. There is no `ladybird` and no `bonus`.

`ladybird` carried the patch's entire evidentiary claim — the independent 34 m
cross-check — and it cannot be applied. What remains is three basis anchors
plus `bmi`, and `bmi` is derived *through that same affine*, so its residual is
**0 m by construction**. The patch contains no independent check at all.

### Ultra — the round-trip does not stay exact

The patch states stage x/y need not change because the art re-registers
automatically. Measured against the proposed anchors:

| stage | residual |
|---|---|
| `main` | **387 m** |
| `live` | 343 m |
| `umfradio` | 310 m |
| `worldwide` | 85 m |

The anchors shipping today round-trip at 0–1 m precisely *because* x/y were
derived from them — the module header says so in as many words. `ultra-2026.svg`
is drawn art, not a projection, so the real anchors and the drawn art cannot
both be right. There is no generator script for these SVGs, so re-deriving x/y
would mean redrawing the map.

### Governor's Ball — cannot be tested

Three stages means the three anchors *are* the basis, so its 0 m residual is
arithmetic, not evidence. `snapchat` also moves **737 m** on the north/south
conflict the patch itself flags as unresolved.

### What they share

`MAP_REGISTRATION_SOURCED` is `basis.some(osm|crowd)`. **All three patches flip
it true**, switching distance readouts back on for exactly the three festivals
Q1 turned them off for. For ACL the affine that would begin quoting walk times
is the same one the patch says puts Tito's in Lady Bird Lake.

---

## 3. The gate hole this exposes

Provenance is necessary but not sufficient. It records where the anchors came
from and says nothing about whether the **art** they register onto is an affine
projection of the ground. A poster whose local scale wanders (ACL's is
5.8–11.3 m/unit) cannot be registered by any single affine; fit one anyway and
you get a transform that looks perfect at the three basis stages and puts the
rest in a lake.

Proposed second condition: **at least one sourced anchor outside the basis,
landing within 25 m of where the affine draws its stage.**

Measured cost against everything shipping today — every festival whose x/y were
derived from its anchors lands at 0–1 m, so 25 m is generous:

| festival | provenance | corroboration | readouts |
|---|---|---|---|
| Summerfest | PASS | PASS (6 anchors @ 0 m) | DEFENSIBLE |
| Lollapalooza | PASS | PASS (`budlight` 1 m, `titos` 0 m) | DEFENSIBLE |
| Outside Lands | PASS | PASS (`twinpeaks`/`panhandle` 0 m) | DEFENSIBLE |
| EDC LV | FAIL | FAIL | suppressed |
| ACL | FAIL | FAIL | suppressed |
| Ultra | FAIL | PASS (`live` 0 m) | suppressed |
| Governor's Ball | FAIL | FAIL | suppressed |

Identical to today's user-visible behaviour, so the rule costs nothing and
closes the hole. Under it, all three *proposed* patches still come out
suppressed — ACL and Govball for having nothing independent to check, Ultra on
the 85 m floor.

Those three 0 m columns are also the thing I most expected to find broken and
did not: **there is no live bug on the festivals currently quoting distances.**

---

## 4. Recommendation

Adopt all three anchor sets — they are genuinely better ground truth, and
photo-tag geo-matching improves a great deal once Ultra's stages stop being
200–650 m from reality — while keeping the readouts suppressed behind the
second condition.

That means **not** removing ACL's `2026-10-19` waiver, which directly
contradicts the instruction in the patch. I stopped short of writing that rather
than quietly overriding a reviewer.

## 5. Open questions for Instinct

1. **ACL `ladybird` / `bonus`** — are these real 2026 stages the app is missing,
   or renamed ids for existing ones? If a real stage id can carry the 34 m
   cross-check, ACL's case changes and I would re-measure before deciding.
2. **Ultra** — adopt the surveyed anchors and accept that the drawn SVG no
   longer matches them (readouts stay off either way), or hold the patch until
   the art can be redrawn from ground truth?
3. **Govball `snapchat`** — land the 2025-map south position as `derived` with
   the conflict recorded, or leave the anchor out entirely until the 2026 patron
   map can be captured?
4. **The second condition** — ship it as a hard gate alongside the anchors, or
   keep it advisory for one cycle?

---

## 6. Outcome — Instinct's answers, and what shipped (2026-09-06, later)

Instinct re-ran `scripts/anchor-residuals.mjs`, reproduced every number, and
answered all four. Implemented in one PR on top of the queue:

| | answer | shipped as |
|---|---|---|
| Q1 ACL | `ladybird` is a 2024 stage the 2026 lineup replaced with Snapchat; `bonus` was a label borrowed from the Lollapalooza module. Waiver **stays**. | basis `amex/miller/tmobile` (osm) + `bmi` (derived); `2026-10-19` waiver kept, narrowed to `blind` |
| Q2 Ultra | Adopt now, redraw later. | all 7 anchors `osm`; x/y untouched; dated art waiver + TODO for the SVG redraw |
| Q3 Govball | Land the 2025-map south position, conflict recorded. | `grove` osm, `verizon`/`snapchat` **`poster`** (see below) |
| Q4 gate | Ship the second condition as a hard gate. | both halves, runtime + CI, cross-checked against each other |

### Two corrections made while implementing

**Govball's `verizon`/`snapchat` are `poster`, not `derived`.** In this codebase
`derived` has a narrow meaning — *back-computed from our own affine* — and is
banned from the calibration basis, because such an anchor cannot disagree with
the transform that produced it. Govball has three stages, so its three anchors
*are* the basis, and filing them as `derived` tripped that gate. They were read
off official festival map art, which is exactly what `poster` means. Same
strength (not evidence, cannot flip readouts on), accurate word.

**Ultra's waiver is a new kind.** Its anchors are all `osm` and its basis is
sourced, so it has no *registration* finding left — its problem moved up a gate,
to the affine-consistency check, which had no waiver mechanism. One was added in
the same shape as the registration waivers (dated, closed in both directions).
Expiry `2026-12-01`, chosen to force the redraw into the quiet window before the
2027 festival roll rather than into Ultra flip week.

### Verification

Five mutations, each failing for its own stated reason, control green:

| mutation | caught by |
|---|---|
| corroboration removed from `map.jsx` | readout gate — 3 festivals quote distances they cannot support |
| Ultra art waiver deleted | affine gate — 1 live festival does not satisfy its own affine |
| Ultra art waiver expired | affine gate — waiver EXPIRED, redraw or re-date deliberately |
| art waiver names a festival that passes | staleness sweep — delete the entry |
| `MAP_REGISTRATION_TOL_M` changed to 40 | drift assert — one number, two copies, already drifted |

The third of those originally reported "STALE: it no longer fails the affine
check", which is the opposite of true for an expired waiver. Fixed: an expired
waiver now counts as *used* so the staleness sweep cannot contradict it.

### Where the seven festivals landed

No user-visible change on any of them — the three that quote distances still
quote them, the four that don't still don't. What changed is that ACL, Ultra and
Govball are now suppressed **on evidence** rather than for want of it, and their
underlying anchors are real, which photo-tag.jsx benefits from immediately:
Ultra's stages were previously 200–650 m from where they actually are.

---

## 7. Pre-flip sweep — and a second gate hole (2026-09-06, later still)

The lane ran across every gated festival in the flip queue: **#73** EDC Orlando
(v264), **#77** Lost Lands (v265), **#78** Nocturnal (v266). §3's hole was that
`anchor-residuals.mjs` only audited `available === true`. Closing it surfaced
another one, in the footprint gate this time, and in the same shape.

### Proven by experiment, not by reading

Injected two anchors into **gated** Nocturnal, one ~11 km outside Glen Helen.
The gate noticed and did not care:

```
!  nocturnal-wonderland-2026 1/2 outside (dawnmountain) — gated
VERIFY EXIT: 0
```

`verify.mjs` only hard-failed through the `else if (f.available)` branch. So a
bad basis authored weeks before a flip surfaced as a **warning**, and the hard
failure arrived in flip week — when there is no time left to re-survey. That is
precisely inverted: the pre-flip lane exists to move that failure *earlier*.

### Instinct's ruling

> Make it hard. Once a festival declares both a footprint and anchors, the gate
> hard-fails regardless of `available`. A bad basis surfacing as a warning
> pre-flip and hard-failing in flip week is the exact failure mode this lane
> exists to prevent.

Shipped. Declaring **both** a footprint and anchors is the opt-in — a festival
with neither still `continue`s past the gate, so nothing fails for a festival
that has not yet claimed to be georeferenced.

### Verification

Same probe, re-run against the fix. The number moved:

| | before | after |
|---|---|---|
| gated festival, anchor 11 km outside | `— gated`, **exit 0** | `✗ … (gated — fix before the flip, not during)`, **exit 1** |

Probe reverted; control green (exit 0), baseline output unchanged — EDC LV
remains the only festival the gate reports, still waived.

### Still open

Questions 2 and 3 from the same packet have not been answered:

2. A declared-but-unexercised footprint is **invisible** — Lost Lands and
   Nocturnal now declare real footprints with zero anchors, so the gate skips
   them silently. Arming is unobservable, which is the same blind-spot class as
   §3 and as the hole above.
3. Poster-class anchors buy nothing functionally — provenance stays FAIL and
   readouts stay withheld either way. Worth authoring pre-flip at all, or is
   layout-only (the Lost Lands / Nocturnal posture) the better default until an
   `osm` or `crowd` source exists?

**#76** also remains open: Nocturnal's georeferencing is blocked on the official
2026 map, which arrives via the Insomniac app at flip (~Sep 12). Tie points are
pre-found — Large Lake `437353375`, Small Lake `437353374` (190 m apart, N–S),
and the amphitheater bowl `233008519` to the south-east.

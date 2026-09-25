# Historical editions (Past Festivals)

Past festival editions as frozen facts, read from **archived official pages**
through the Wayback Machine. They are kept apart from `data/festivals/` and
`_DATA_SETS`, so a past edition can never become the active festival. Nothing
here feeds the live schedule, map, notifications, photo tagging or Memories.

The app reads `index.json` and `editions/*.json` only, through `historical.jsx`
(the read-only Past Festivals screens, opened from the festival switcher). They
load on demand and are never precached; `scripts/build.mjs` copies just those
files into the iOS bundle. Sheets, ledgers and review manifests never ship.

| dir | what | written by |
|---|---|---|
| `ledger/` | every capture considered, the one chosen, hashes, revisions, every printed row dropped and why | `extract-insomniac.mjs`, `resolve-graphics.mjs`; `dropped` by `build-editions.mjs` |
| `sheets/` | the reviewed source sheet, one row per printed set | `extract-insomniac.mjs`, `finalize-review.mjs` |
| `review/` | per graphic: hash, rows confirmed against the pixels, every OCR correction | `finalize-review.mjs` |
| `editions/` | the generated edition files (do not hand-edit; `--check` fails) | `build-editions.mjs` |
| `index.json` | the library's table of contents: one row per edition with days and counts (generated; `--check` fails on drift) | `build-editions.mjs` |
| `expected-counts.json` | stage and per-day set counts locked from review | by hand, after review |

Raw archived HTML and schedule graphics are research artifacts. They live in
`~/Plursky-private/historical-cache/` and are **never committed or shipped**;
only their hashes are.

## Adding an edition

Structured official pages (Insomniac platform: HARD, EDC …):

    node scripts/historical/extract-insomniac.mjs <edition-id>

Official schedule graphics (Gov Ball, Lolla, ACL …):

    node scripts/historical/resolve-graphics.mjs <edition-id>
    swiftc -O scripts/historical/ocr-vision.swift -o /tmp/ocr && /tmp/ocr <graphic.png> > dN.jsonl
    node scripts/historical/assemble-ocr.mjs dN.jsonl --header Y0,Y1 --grid-bottom Y --axis-x X > <id>-dN.cand.tsv
    # review: copy to <id>-dN.final.tsv and correct every row against the pixels,
    # hand-transcribe footer strips, put the printed header in <id>-dN.note
    node scripts/historical/finalize-review.mjs <edition-id> <review-dir> --reviewer "<who>"

Official lineup pages, for editions whose set-times pages were never archived
(EDC Orlando, Nocturnal, Escape, Beyond SoCal, Dreamstate SoCal 2025):

    node scripts/historical/extract-insomniac-lineup.mjs <edition-id>
    # writes sheets/<id>.lineup.tsv (billing, day, stage) and the ledger;
    # the edition is lineup_only: no sets and no times, ever

Then, for any path:

    node scripts/historical/build-editions.mjs
    # lock counts in expected-counts.json, then
    node scripts/test-historical-editions.mjs

## Rules the gate enforces

- An edition is identified by what its page prints (weekday + date), never by
  a `<title>` or a "closest" capture: EDC LV's June 2025 page is titled 2026.
- Billing is verbatim as printed; stage names as printed (ACL's LADYBIRD and
  LADY BIRD are one stage; Lolla's DOLLAPALOOZA stays its own).
- The whole Bonus Tracks stage, Fireworks, Silent Disco, bare unnamed slots
  ("Special Guest") and non-music activities are **dropped**: not an artist,
  set, event or stage in any form. The sheets and review manifests keep them as printed, and the
  build records each dropped row with its reason in `ledger/<id>.json`
  (`dropped`). Rules and the activity list live in
  `scripts/historical/editions.mjs`. Kids-stage acts are billed acts and stay (including the named
  "SPECIAL GUEST: THE HAPPINESS CLUB").
- A `lineup_only` edition comes from an official lineup page and carries no
  sets and no times. An artist's day and stage appear only where that page
  printed them (By Day / By Stage tabs), joined only when unambiguous; every
  disagreement between the tabs is listed in the ledger's `crossTab`.
- A closing set printed with only a start time is `openEnd`, never given an
  invented end.
- Wall times are local; a set before `rolloverHour` belongs to the previous
  festival night on the next calendar date.

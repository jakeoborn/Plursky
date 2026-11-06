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

Mixed official sources (`official_sources`, Escape): when no single archive
covers an edition, each day lists its sources in the ledger. A source is an
archived official page (Wayback, the festival's own host; a post-event capture
may fall in the following year, but its day tab must print the day) or an
official graphic re-hosted by an approved host (`REHOST_HOSTS` in
`validate.mjs`: EDM Identity, X media, per ruling A). A graphic carries its
receipt: image URL, the page it was found on and that page's publish date (in
the edition year, on or before its last day), the fetch date, the printed
header, its sha256 and its row count, plus a Wayback capture of the page it
was found on that cites the image (`receipt`). The header must print the
day's weekday, month and day of month, and any year it prints must be the
edition's. The sources' row counts must sum to what
each day keeps and drops, and every graphic needs a signed review entry for
its exact hash. A first-party capture replaces a re-host when one turns up.

An edition is checked against every set-times graphic its EDM Identity
receipt pages show, and every slide of an Instagram post it cites, not just
the ones its sources cite. The importer lists them on each receipt
(`setTimesGraphics`, read from the article body only, or the post's slides).
Each one must be used by a source or listed in `notUsedGraphics` with the
reason, such as a pre-party, an afterparty, or a pre-event graphic that the
festival's own page supersedes.

    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

The gather folder (kept outside the repo; its paths and file names never
enter it) holds the reviewed `sheet.tsv` and a `receipts.json`;
page sources are re-read through `wayback.mjs` and must equal the sheet row
for row.

Then, for any path:

    node scripts/historical/build-editions.mjs
    # lock counts in expected-counts.json, then
    node scripts/test-historical-editions.mjs

## Rules the gate enforces

- An edition is identified by what its page prints (weekday + date), never by
  a `<title>` or a "closest" capture: EDC LV's June 2025 page is titled 2026.
- Billing is verbatim as printed; stage names as printed (ACL's LADYBIRD and
  LADY BIRD are one stage; Lolla's DOLLAPALOOZA stays its own).
- The whole Bonus Tracks stage, Fireworks, Silent Disco (a billing or a whole
  silent-disco stage), a separately printed after-party, bare unnamed slots
  ("Special Guest", "Secret Guest") and non-music activities are **dropped**: not an artist,
  set, event or stage in any form. The sheets and review manifests keep them as printed, and the
  build records each dropped row with its reason in `ledger/<id>.json`
  (`dropped`). Rules and the activity list live in
  `scripts/historical/editions.mjs`. Kids-stage acts are billed acts and stay (including the named
  "SPECIAL GUEST: THE HAPPINESS CLUB").
- A closing set printed with only a start time is `openEnd`, never given an
  invented end.
- Wall times are local; a set before `rolloverHour` belongs to the previous
  festival night on the next calendar date.

## Coverage census (`census/coverage-2010-2026.tsv`)

One row per app festival family per year, 2010-2026 (SPEC-182 step 1). It
records whether an edition **happened**, with one dated source per row. It is
a research record: the app does not read it and `scripts/build.mjs` does not
ship it.

| column | meaning |
|---|---|
| `lifecycle` | `occurred` (a source published strictly after the last day reports that it ran), `scheduled_unverified` (scheduled, occurrence unverified: the source was published on or before the last day, carries no publication date, or the note admits the occurrence was assumed or inferred; evidence and dates kept), `partly_canceled` (a day or weekend lost; `note` says which), `canceled`, `not_founded` (before the first edition), `hiatus` (no edition, festival existed before and after), `pending` (2026 edition not yet held on 2026-11-06), `unresearched` (not settled; never a guess) |
| `dates`, `venue` | as the source prints them; blank when no source prints them |
| `evidence_url`, `evidence_kind` | the one source for that year's state: `official` (festival or promoter page, live or archived), `press` (dated article), `wikipedia` (edition table; lifecycle only), `research_receipt` (the archived official page or graphic an earlier lineup gather already read) |
| `fetched` | the date the source was read, or the Wayback capture timestamp. Never evidence of occurrence |
| `published` | the source's own date: an article's publication date, a Wayback copy's capture date (matches the URL), or a Wikipedia revision's own edit timestamp (`YYYY-MM-DDTHH:MM:SSZ rev N`, never the day it was read); blank when the source has none |
| `held_*` | what this repo already holds for that year: the edition id in `editions/`, its set count, sets with a start time, and stages with a map pin. `current-2026-dataset` marks a live 2026 lineup in `data/festivals/`, not counted here |

Lifecycle and held data are **separate measures**. A row can be `occurred`
with nothing held (the backfill queue) or hold data while its lifecycle says
otherwise (a finding to report, never to repair here). Lineup, set times and
stage pins are tracked separately per edition; past editions hold **no**
stage pins, and 2026 pins are never copied into past years. Two sources that
disagree leave the row `unresearched`, with both in `note`.

`scripts/test-coverage-census.mjs` (in verify) holds the bar: an `occurred` or
`partly_canceled` row needs a `published` date strictly after the edition's
last day (after the year when no dates are printed); the fetch date never
counts, and a source with no publication date leaves the row
`scheduled_unverified`. A note that admits the occurrence was assumed,
inferred or pre-event only cannot sit on it either.

A date is not enough for the two archive kinds; what the archived text says
decides:

- **Wikipedia** counts only by the revision's own edit timestamp, and only if
  that revision's text reports the edition as having happened. The note
  quotes it: `Revision N (edited TS) reports it: "…"`. The quote names the
  year (or is tagged `(range statement)` with years that cover it), says the
  edition was held, drew a crowd, featured acts and so on (or is a table row
  under an attendance column), and in an article that covers several
  editions (EDC, Beyond Wonderland) names this edition's place. An editions
  table that lists only year, dates and venue does not report anything.
- **A Wayback capture** counts only if the captured content reports the
  edition in the past tense (a recap, a set list of what was played,
  attendance), quoted as `Capture reports it: "…"`. A lineup page, set-time
  page or graphic captured after the event is still a schedule.

Anything else is `scheduled_unverified`, with the reason in `note`.

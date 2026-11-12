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

Archived Tomorrowland timetables (2017–2019, 2022, 2023, format `tml-stages`):

    node scripts/historical/gather-tml.mjs <edition-id> <gather-dir> <official-url> <ts> <url> <location|heading>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

One /en/festival/line-up/stages/<day> page prints every day of every
weekend, each set with its printed range and its data-start/data-end (which
must agree). Each heading pairs a stage with that day's host, in an order
that changed: 2018 and 2019 print the host first ("Holosphere - Freedom
Stage by Budweiser", `location`), 2022 on print the stage first ("Rose
Garden - Rampage", `heading`); 2017 prints only the host. The importer holds
the receipt to the reading that names the fewer stages, and the hosts go in
the ledger. The Thursday before each weekend (The Gathering) is printed but
is not a festival day: its sets are excluded as `offDay` rows, by date. A
stage printed two ways (case, spacing, a leading "The") is carried onto its
most-printed form with `stageAs`. 2017's only timetable capture is from the
Monday between the weekends (July 24); every other year's is from the last
day or after it. 2024 and later have no archived timetable.

Archived Electric Forest artist schedules (2012, 2013, format `ef-grid`):

    node scripts/historical/gather-ef.mjs <edition-id> <gather-dir> <official-url> <ts> <url>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

The "All Days" view of set-times.php prints a tab per day ("Thursday - June
28th", no year: the weekday must be the date's own in the edition's year),
then one grid per day: a 15-minute axis and one column per stage, each artist
block placed on the axis. A block's top must be its printed start and a single
block's height its printed length, which settles am and pm across midnight;
the page is not read if a block is off its start. A block whose height
disagrees with its printed range is a misprint and is excluded (2013's
Instrumental Forester), as is an entry that prints no range ("*Forest Stage
Bar beginning at 2:30pm"). A range ending "Close" or "??" is an open end
(`openEnd`, end blank). A "format" block holds a curated group or the Silent
Disco channels, several sets in one block, each inside its span. Yoga,
workshops, talks, showcases and brand experiences are dropped as `activity`
(`PROGRAMME` in editions.mjs); 2012's Wagon Wheel event titles that name no
act are dropped as `event-block`; the Silent Disco is dropped as operational.
2014's archived pages print a lineup only, and 2024's schedule page has not
been read yet.

Archived Coachella lineup pages (2014, 2015, 2016, format `coachella-cards`;
2012, `coachella-overlays`; 2017, `coachella-data`):

    node scripts/historical/gather-coachella.mjs <edition-id> <gather-dir> <official-url> <ts> <url> [<ts> <url> ...]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

coachella.com/lineup/ prints one card per act, and each card lists that act's
sets: the date with its year ("Friday, April 15, 2016": the year must be the
edition's and the weekday the date's own), the start and the stage. It prints
no end times, so every set is open-ended (`openEnd`, end blank; the app says
"no end time printed"). 2016's page lists both weekends; 2014's and 2015's
list one weekend per view (`?weekend=1`, `?weekend=2`), so those editions
cite two captures, one per weekend, and each day must be printed by exactly
one of them. The `data-weekend` attribute is not read (2016 marks both
weekends "1"); the printed date decides the day. An entry printed without its
time ("Saturday, April 19, 2014 | Gobi") or its stage is excluded as
incomplete, with what it prints kept in the sheet; a card with no set (a host)
is kept in the ledger as unscheduled, never as a set. 2014's Weekend 1 view
lists no Do Lab sets; nothing is added for them.

2012's page (`/lineup/list/date/all`) prints each act's sets in a hidden
overlay, under "2012 Appearance": "Friday April 20th | 4:30pm | Gobi", start
times only, so every set is open-ended; a line printed "| TBD" is excluded as
incomplete. It lists one Do Lab act (Lucent Dossier Experience); nothing is
added for the others. NOISIΛ keeps the lambda the page prints
(`PRINTED_NON_LATIN`).

2017's page holds its whole lineup as one data attribute
(`<lineup-listing v-bind:artists>`), which its script draws as the cards: per
act and weekend the date (with its printed form), start, end and stage. A set
with an end keeps it; one with no end is open-ended (the sheet's `openEnd`
rows must be exactly those). A set with no start, a "TBD" stage, or a bare
00:00 start with no end (the page's blank value) is excluded as incomplete.
The data lists one act twice under two spellings ("Shannon & the Clams",
"Shannon and the Clams"): one set, the first spelling kept, the other named in
the ledger's `respelled`. Names keep their own HTML entities in the data
("R&oacute;is&iacute;n"), read as their letters. 2018's archived lineup page
is an empty shell and 2019's Set Times page loads its times by script, so
neither is readable from the archive.

Archived C3 schedule grids (ACL, Lollapalooza 2013–2019, format `acl-grid`):

    node scripts/historical/gather-acl-grid.mjs <edition-id> <gather-dir> <official-url> <ts> <url> [<ts> <url> …]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

The gather dir stays outside the repo. Each block's am/pm is read off the
page's own hour axis, and the em-per-minute scale is fitted from the blocks
themselves. A block whose printed range disagrees with its height (Lolla
2013's "5:30-4:15") is fitted out and named; its day then cannot be read
and ships untimed, which the edition must list in `untimedDays` with a note,
and the ledger keeps the misprint. A block printed twice (off the axis, or
twice in the same place) is one set; a second set by the same act on the
same stage of an untimed day is excluded as a repeat and the note says so.

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

Official lineup pages, for editions whose set-times pages were never archived
(Nocturnal Wonderland 2025, Beyond Wonderland SoCal 2025):

    node scripts/historical/extract-insomniac-lineup.mjs <edition-id>
    # writes sheets/<id>.lineup.tsv (billing, day, stage) and the ledger;
    # the edition is lineup_only: no sets and no times, ever

The lineup extractor proves an edition by the page title and its By Day tab:
every day header must print the edition's weekday and date. Two cases it
handles explicitly:

- **Stale title.** Insomniac sometimes renames the lineup page for the next
  year before replacing the lineup (Beyond SoCal 2022, EDC Las Vegas 2021 and
  2023). An entry may name that one exact title as `staleTitle`; it is
  accepted only when the day headers still print this edition's dates.
- **Single-heading By Stage tab.** When the By Stage tab prints every billing
  under one heading (Beyond SoCal 2024: all 119 under one stage), the stage
  tab is not used and the edition keeps no stages. The finding is recorded.

Relay mode. Where this machine cannot reach the archive directly, the
captures are fetched elsewhere and filed into the cache first:

    node scripts/historical/relay-ingest.mjs cdx <url> <from> <to> <listing.json> <via>
    node scripts/historical/relay-ingest.mjs capture <timestamp> <url> <result.json> <via>
    PLURSKY_WAYBACK_RELAY=1 node scripts/historical/extract-insomniac-lineup.mjs <edition-id>

A capture must be the raw `id_` capture of the requested timestamp with a 200
status; anything else is refused. In relay mode a capture that was listed but
not filed is recorded, and the edition is blocked if that capture is later
than the one chosen. The ledger records `relayedVia`.

Official lineup.php pages, 2011 to 2013 (Nocturnal Wonderland, Beyond
Wonderland SoCal): that template printed every set with its stage and time.

    node scripts/historical/extract-insomniac-php.mjs <edition-id>
    # writes sheets/<id>.tsv and the ledger in the structured_html shape

Each stage block's share title prints the stage and the date, and a page kept
earlier years' blocks after adding the next year's, so an edition takes only
the blocks whose printed date is one of its dates. The first valid capture
taken after the last day is used, not the latest: the template's artist
records were shared across years and later edits reached back into earlier
lineups. A block the page labels as an alphabetical list ("alpha") prints
zero-length times and is left out, listed in the ledger.

In 2012 and 2013 these pages print "Discovery Project" as a whole stage of
named, billed DJs. The founder's ruling (2026-11-10) keeps that stage as
printed in those three editions; `KEPT_STAGES` in editions.mjs names them,
and only the stage name is exempt from the drop check. A bare "Discovery
Project" billing is still an unnamed slot everywhere.

The 2015 and 2016 /experience/lineup/ pages build their lineup from
`performer-item` blocks (`data-title`, `data-date`) under day headers; the
lineup extractor reads those when the page has no tab list. A By Stage
heading written "Name (Weekday)" is split into the stage and the day, and
the day is checked against By Day. On these lineup-only pages a bare
"Discovery Project" (no stage, no time) is the contest slot before its
winner was named, so it is dropped as an unnamed slot (`lineupDropReason`);
the live lineup's stageless entry is unaffected.

Some 2016 and 2017 pages (EDC Las Vegas 2016 and 2017, EDC Orlando 2016)
printed no days: only an alphabetical list, or only the page's
`var artist_data` script list. The extractor reads that list as an
Alphabetical tab. Such an edition is marked `undated` in editions.mjs: it is
proven by its page title alone and never by a page that has a By Day tab,
no artist carries a day, a note on the edition says so, and a name the page
listed twice is one artist (the ledger names it). Nothing on the lineup page
dates it, so its `datesPage` is the festival's own home page captured just
before the festival, whose title printed the dates ("EDC Orlando |
November 4–5, 2016 | Tinker Field"); the extractor refuses the edition if
those are not exactly its dates, and the ledger keeps the capture. A page
title that names no year ("LINEUP - EDC Las Vegas") is read only up to
`until`, at most two weeks after the festival.

Countdown NYE ends on 31 December, so its pages are often only captured in
early January. A lineup entry can give its own capture `window`, and the
validator accepts a capture from the next year only within 31 days after
the edition's last day.

The festivals' later past-highlights pages (/past-highlights/<year>-lineup/)
hold the lineup only as a poster image, so they are graphic sources and go
through the review path above, not a page extractor.

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
- A `lineup_only` edition comes from an official lineup page and carries no
  sets and no times. An artist's day and stage appear only where that page
  printed them (By Day / By Stage tabs), joined only when unambiguous; every
  disagreement between the tabs is listed in the ledger's `crossTab`.
- A closing set printed with only a start time is `openEnd`, never given an
  invented end.
- Wall times are local; a set before `rolloverHour` belongs to the previous
  festival night on the next calendar date.
- An edition announced and then canceled before it opened carries
  `status: "canceled"` in `editions.mjs`, with a reason, an announcement date and two dated
  sources from different publishers, each published by the first day. Its file keeps every
  printed row as evidence, but `index.json`, the artist registry and the app's past-edition
  lists skip it, so no artist is credited with a set that never happened
  (Nocturnal Wonderland 2024, the Line Fire). The hand-written stage lineages
  (`data/artists/stages.json`) keep it only as a `canceledEditions` record with the same
  sources, never in a name's held `editions`. A single canceled day stays `cancelledDays`.

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

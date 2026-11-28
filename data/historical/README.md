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

Editions whose graphics are known but not yet read are listed in
`MAC-QUEUE.md`; `ocr-queue.mjs` fetches and OCRs all of them on a Mac in one run.

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
2014 and 2015 come from the newer Scheduler (below); 2024's schedule page
prints only graphics (one image a day).

Archived Governors Ball schedule (2011, 2012, format `govball-wp`):

    node scripts/historical/gather-govball-wp.mjs <edition-id> <gather-dir> <official-url> <ts> <url>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

governorsballmusicfestival.com/lineup/schedule/ was a WordPress page that drew
one grid per day: a header with the day's heading ("SATURDAY 6/23") and one
stage name per column, an hour axis one hour apart, then one column per stage
whose blocks print a name and a range ("12:50 pm - 1:25 pm"). Every time
prints its own am or pm, so no anchor is needed. 2011 was one day and prints no
heading: its date is the one the page's own description prints ("A one-day,
two-stage festival … on Saturday, June 18th, 2011"). A "???" end is an open
end, only on a column's last block (2011's Pretty Lights). A range that runs
backwards or more than six hours, or starts off the axis by over an hour, is a
misprint and an excluded row, never read another way (2012's Turf War, printed
"11:45 pm - 12:10 pm"). Sets in a column must run in order with no overlap.

Archived Primavera Sound timetable (2012 and 2015, format `primavera-horarios`):

    node scripts/historical/gather-primavera-horarios.mjs <edition-id> <gather-dir> <official-url> <ts> <day-url> [ … one pair per day ]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

primaverasound.es/horarios?d=N&l=forum was the festival's own Parc del Fòrum
timetable, one page a day. The page prints a row of day tabs, its own day the
one not linked, in whichever language it was served (Catalan "dimecres 27 de
maig", Spanish "jueves 28 de mayo", English "Friday May 29"), with no year:
each tab's weekday must fall on its date in the edition's year, and the tabs
must be the edition's days in order. The heading must name Parc del Fòrum, so
the city shows (Primavera a la Ciutat, `l=ciutat`) are never read. The grid
has a column per stage (repeated in a footer row) and a row every 15 minutes
that opens and closes with its own time, carrying on past midnight to 6:30.
Each set is a block in its stage's cell that prints its range on the 24-hour
clock ("(23:45 - 01:15)"); its start must be the row's time plus the block's
own offset (`KKaddMinutes-N`, under 15), and the block must be drawn two
pixels a minute tall. A block that prints its start alone ("(03:00)", 2015's
Zamilska) is an open end. Sets on a stage must run in order with no overlap;
anything else stops the read. The 2015 day pages were captured after the
festival (Wednesday's on May 31, the rest in September). Wednesday 27 May is
the ATP stage alone; the three main days have 11 stages each.

2012 is the same page on an older template ("2012"): the stage headers carry
a width, there is no footer row, and every block prints its start alone
("(17:10)"), which must fall inside its row's 15 minutes; there is no offset
class and the block heights are server artefacts, not read. Every 2012 set
is open-ended. A page can draw an empty slot, an empty name under an anchor
with no artist id: it names no act, so it is listed in the ledger
(`emptySlots`) and never read as a set (one each on Thursday and Friday, on
the ATP stage). The three day pages were read in Spanish (`lang=es`, so the
stage names agree across days), captured 1 July 2012: Thursday 31 May has 8
Fòrum stages, Friday and Saturday 10. 2013's pages use the same template,
but only Wednesday's and Thursday's survive from after the festival (the
later captures of Friday and Saturday are error pages), so 2013 is not
loaded.

Archived Primavera Sound full timetable (2016 to 2019, format `primavera-completos`):

    node scripts/historical/gather-primavera-completos.mjs <edition-id> <gather-dir> <official-url> <ts> <day-url> [ … one pair per day ]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

From 2016 the same /horarios?d=N&l=forum address serves the full timetable
("Horarios completos" active in the venue submenu): one page a day of the
whole festival week, Parc del Fòrum's columns first under "PARC DEL FÒRUM",
then the city venues' under "Primavera a la Ciutat", each stage header and
each block marked with its venue (`escenarioforum`, `concertBoxciutat`). The
day tabs print a weekday and a day of the month only ("MIÉRCOLES 1"), so the
row as a whole names its dates: exactly one run of consecutive days in the
edition's year must have those weekdays and days (2016: Monday 30 May to
Sunday 5 June), and the edition's days must sit in it in a row. The grid,
the 15-minute rows, the block offsets, the two-pixels-a-minute heights and
the no-overlap rule are checked as for 2015, in the city's columns too, but
only the Fòrum's blocks become sets. A start-only block ("(18:00)", 2016's
minimúsica) is an open end. Wednesday 1 June is one free concert on the
Primavera stage; Thursday to Saturday have 12 or 13 Fòrum stages. The night
runs to 06:00, so the 2016 day runs from 10 AM. Pages captured 19 June 2016.

2017 is the same page with three changes. The tabs print a short weekday
("MIÉ-31") and list only the season's days with shows, so the run may skip
days: each tab must be the first day after the one before with its weekday
and day of the month, no more than a week on. One Fòrum stage (Mango House)
is printed after the city's columns, still marked as the Fòrum's. Each name
links to that year's artist page (`2017_artists?id=…`), and the link's year
must be the edition's. Wednesday 31 May is the Fòrum's free opening on two
stages. Pages captured 20 to 23 June 2017.

2018 is the same page again, still headed "Horarios", its tabs printing
whole dates ("2018-05-30", Monday 28 May to Sunday 3 June) and its names
keeping 2017's class. Wednesday 30 May is the Fòrum's opening on three
stages, Thursday to Saturday have 13 or 14. One start-only block (Skepta,
"(02:45)") is an open end. Pages captured 27 October 2018.

2019 is the same page again, headed "Set times" with "All set times" active
and the Fòrum's columns under "Parc del Fòrum". The tabs print whole dates
as 2018's do ("2019-05-30", Monday 27 May to Sunday 2 June), which must fall
in the edition's year, each later than the one before and at most a week on. The
names keep 2017's class (`artists_2017`), so only the link's year
(`2019_artists?id=…`) is read. Day Pro, a city conference, prints two
sessions at once on Friday 31 May, so the no-overlap rule holds for the
Fòrum's stages only; the city's columns are never sets. Wednesday 29 May is
the Fòrum's opening night on two stages, Thursday to Saturday have 16, and
Sunday 2 June is the city's alone. Pages captured 23 July 2019.

Archived Lollapalooza lineup cards (2018, format `lolla-cards`):

    node scripts/historical/gather-lolla-cards.mjs <edition-id> <gather-dir> <official-url> <ts> <url>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

No archived capture of Lollapalooza's 2018 schedule grid holds the schedule
(the September page is a playlist). The official lineup page's "Interactive
Lineup" tab prints one card per act, and each card lists the act's sets under
"2018 Schedule:" as day, start and stage ("Sat 8/04 8:30pm Grant Park"), with no
end. The only capture that holds the cards is June 14, 2018, seven weeks before
the festival, so the edition ships every day untimed, as 2019 does: the lineup
and stages are as printed, the times are checked against the page and dropped.
The year must be the page's description's and every card's schedule heading's;
each set's weekday must be its date's, and its date one of the card's own day
titles. A card shows at most two sets and links to the act's page for more: a
day its titles list but no set it shows prints (School of Rock AllStars' Sunday)
is kept in the ledger as not shown, never as a set. Import refuses a capture
taken on or after the festival's first day, and any day the edition does not
list as untimed.

Archived HARD Summer home page (2012, format `hard-wp`):

    node scripts/historical/gather-hard-wp.mjs <edition-id> <gather-dir> <official-url> <ts> <url>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

In 2012 HARD Summer's page lived on HARD's own site (hardfest.com/hardsummer/),
a WordPress page whose title must start "HARD Summer". It draws both days, each
a block headed with its weekday alone ("FRIDAY"); the date of each is the run
the page's own essential info prints ("Music is scheduled … both days, Friday,
August 3rd & Saturday, August 4th, 2012."), which must be two consecutive days
of the edition's year, each on its own weekday. Each day has an hour grid of
half-hour labels with their own am or pm, latest first, with no gap; then one
column per stage (an HTML comment names its day and stage), whose blocks print
one act and a range with no am or pm ("11:30 - 12:30"). Each time is the one
reading inside the day's grid. Every block is drawn with a height and a top
margin: the page's scale is the pixels per minute most blocks agree on, and
each block's printed end and place imply where its column starts. A column
may sit a few minutes off its grid (2012's Saturday OWSLA Tent is drawn ten
minutes high), which moves no printed time and is recorded as the column's
top. A block whose height is not its length, that sits where its column does
not put it (2012's Kill Frenzy and Zombie Disco Squad are drawn in each
other's place), that runs backwards or over eight hours, or that is printed
while another set on its stage is still on, is a misprint and an excluded
row, never read another way. The archived URL must be on hardfest.com or
hardsummer.com.

Archived Tomorrowland line-up pages (2010 to 2012, format `tml-cms`):

    node scripts/historical/gather-tml-cms.mjs <edition-id> <gather-dir> <official-url> <ts> <url> [<ts> <url> …]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

tomorrowland.be printed one Drupal page per festival day
(/cms/en/line-up/<weekday> in 2010 and 2011, /line-up/<weekday> in 2012). Its
day tabs print each day as "Saturday 24 july" with no year: every tab must be
a real date of the edition's year on its own weekday, the tabs must run on
consecutive days, and exactly one is marked current, which is the page's day.
The page's title must be Tomorrowland's and its body the line-up page's. Each
stage is a heading (2011 also draws it with Cufón; the text is the same name),
followed by its acts, each with exactly one 24-hour range (2010 and 2011 print
the two times apart, 2012 as "21:30 > 23:00"); a time before 6 AM is the
night's. A block named as its own stage ("Radio Ultra Modern on Friday!",
"Samsung Galaxy Island Saturday") names no act; a block printed across two or
more whole, shorter sets on its stage (an all-day MC, a live percussionist over
the DJs) is not a set of its own; both are excluded rows with what they print.
A backwards range, one over eight hours, or two sets printed on one stage at
once (each of them) is a misprint and an excluded row. The same act printed
twice with the same range is one set. The archived URL must be on
tomorrowland.be.

Archived Tomorrowland day timetables (2013 to 2016, format `tml-drupal`):

    node scripts/historical/gather-tml-drupal.mjs <edition-id> <gather-dir> <official-url> \
      <ts> <url> [<ts> <url> …] [--programme-stage <stage>]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

tomorrowland.com/en/<weekday>-<d>-<month> was a Drupal page, one per day: its
title prints the weekday and date with no year ("Saturday/ 27 July"), which
must be the date's own weekday in the edition's year. The grid is an hour axis
(one label an hour, every full hour the same width in pixels) and one row per
stage, matched by `data-id` to the stage names under it. Each row is drawn
slot after slot: a set's slot must be exactly as wide as its printed range
("12:15-13:15", 24-hour; before 6 AM is the day's night) and every gap exactly
as wide as the time between one set's end and the next one's start. A range
that disagrees, falls off the axis, or overlaps another set on the same stage
(the page then draws the later one where the earlier ends, 2014's Lotto and
DIM MAK Fight Club) is a misprint and an excluded row. The stage names are the
hosts the page prints for that day (Tomorrowland prints no fixed stage names
these years). Radio Modern's all-day radio broadcast is a programme row
(`--programme-stage`); a name with no row ("More Artists", 2013) is checked,
not read. Markus Schulz's 13:00 to 01:00 slot in 2013 is printed 12 hours
wide and is allowed past the eight-hour check by name (`PRINTED_LONG_SETS`).
Every capture was taken after the weekend it prints.

Archived EDC Las Vegas music pages (2012, 2013, format `insomniac-music`):

    node scripts/historical/gather-insomniac-music.mjs <edition-id> <gather-dir> <official-url> <ts> <url>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

electricdaisycarnival.com's music.php printed every stage and every day on one
page. 2012 (/LasVegas/music.php?stage=all) groups by stage, each with one block
per day ("Friday - June 8th", the block's class its weekday), a "Hosted By"
line where a stage was hosted, and each act's heading followed by its range.
2013 (/music.php) puts everything after a STAGE SORT marker: one block per
stage, a "Fri - June 21st" heading per day, and each act drawn twice (a name
and range over a name and range) that must agree. Headings print no year: it
is the page's own (2012's title, 2013's description), which must name
Electric Daisy Carnival, and the page must name Las Vegas (title or its own
og:url). Every heading's weekday and ordinal must match its date, days run
consecutively and every stage prints the same days; the stage menu must name
the same stages. Every time prints AM or PM, and one before noon is the
night's. A backwards range, one over eight hours, two sets on one stage at
once, or a block whose two readings disagree is a misprint and an excluded
row. A block printed twice with the same range is one set. The archived URL
must be on the brand's root host, never a city subdomain. 2013's "Discovery
Project" stage is a stage of named DJs (KEPT_STAGES), as on the other 2012 and
2013 Insomniac pages.

Archived Shambhala set-times pages (2024, 2025, format `shambhala-webflow`):

    node scripts/historical/gather-shambhala-webflow.mjs <edition-id> <gather-dir> <official-url> \
      --dates <ts> <post-url> <ts> <url> [<ts> <url> …] [--stage-by-logo <class>=<name>]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

shambhalamusicfestival.com/set-times/<weekday> is a Webflow page, one per
weekday. It prints its weekday (title and active tab) and no date, and its
title keeps a stale year, so the year is the page's own "Last Published"
stamp, which must fall in the edition's year. The date is the run the
festival's own dated blog post prints ("July 26-29, 2024", "July 25th to
28th, 2025"): Friday to Monday, every run in the post the same, its Thursday
the night before (`--dates`, re-read off the official host at import). The
grid is an hour axis from 10 AM (one label an hour) and one column per stage,
named by its heading or its logo's alt. Each block carries its range three
ways (24-hour data, the printed 12-hour time, its place and height on the
axis at 70 px an hour), and all three must agree. Two acts drawn in one slot
(2024's "P Money x Whiney" and "P Monay x Whiney") are misprints and excluded
rows. A block the CMS draws once per performer is one set (`drawnTwice` in
the ledger); 2024's mystery set, printed only as question marks, names no act
(`unnamedSlots`). 2025's Secret Garden column carries the Village logo's alt:
`--stage-by-logo secret-garden="Secret Garden"` names it, and only when the
column's class and its logo's file name both spell that name. Several 2025
days were captured in one second, so a row cites its page by timestamp and
path. Secret Garden's daytime classes and talks are PROGRAMME, hosted
sessions are EVENT_BLOCKS, and Skream & Friends' 12:30 to 9:00 AM closing
set (2025) is allowed past the eight-hour check by name.

Archived Electric Forest Scheduler (2014, 2015, format `ef-scheduler`):

    node scripts/historical/gather-ef-scheduler.mjs <edition-id> <gather-dir> <official-url> <ts> <url> \
      [--programme-stage <stage>] …
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

scheduler.electricforestfestival.com (2014) and
electricforestfestival.com/scheduler/ (2015) print a tab per day ("June 25",
its target the date), then one container per day in the same order. The
container writes its axis's first minute as `data-date-min` (a UTC epoch of
the festival's wall clock), which must be the first hour the axis prints. Each
stage row holds one block per set, placed on a pixel scale (10 px a minute in
2014, 11 in 2015, one scale per page): a block's left edge must be its printed
start and its width and `minute-N` class its printed length, which settles am
and pm and the night past midnight. A block that disagrees is a misprint and
an excluded row. A block drawn twice in the same place (2014's Cosby Sweater)
is one set (`drawnTwice` in the ledger). 2015's Silent Disco channels print
their range only in the block's title. 2015's Workshops and The Electric Glen
rows hold only workshops, panels and interviews (`--programme-stage`): their
rows are excluded one for one. Yoga, hoop showcases, a brewery tasting and the
like printed in a music stage's row are dropped by the build as `activity`
(`PROGRAMME`), and the parser leaves them out of its overlap check. Both
captures were taken after the festival.

Archived Electric Forest lineup pages (2011, 2016, format `ef-lineup`):

    PLURSKY_WAYBACK_RELAY=1 node scripts/historical/extract-ef-lineup.mjs electric-forest-2011 electric-forest-2016
    # writes sheets/<id>.lineup.tsv and the ledger; lineup_only and undated

Where no text schedule was archived, the pages read so far print only
graphics: 2011's /lineup/schedule, 2017's /2017-info/schedule/, the 2018,
2019 and 2022 /<year>-info/lineup/ pages (posters; 2018 and 2019 also embed
an Aloompa widget served off the festival's domain), 2024's /schedule/ and
2025's /lineups/ carousels. Those years go through the graphics path or
wait. For 2011 and 2016 the festival's own lineup page lists the billed
acts and nothing else: no day, no stage, no time. 2011's
electricforestfestival.com/lineup/artists is a Drupal grid, one `<h2>` per
act (a rendered copy draws each name with Cufón, one `<cufontext>` per word),
under a title that prints the edition and its run ("2011 Artist Lineup |
Electric Forest Festival :: June 30 - July 3, 2011 :: Rothbury, Michigan").
2016's /experience/lineup/ is a WordPress page titled "2016 Lineup | Electric
Forest Festival" and headed "EF 2016 Lineup", one `lineup-list` per billing
tier of `<a class="artist">` links. The edition is `undated`: no artist
carries a day, and its note says the page printed no days. Its dates are the
run the title prints where it prints one (2011), and otherwise the census's
dated post-event run (`datesFrom`, as Creamfields; 2016). Every capture of
the year is listed up to the first one taken after the last day, and that
one is read (2011: July 4, the day after; 2016: July 15); earlier captures
are diffed against it (2011's June captures lack Cirque du Womp). Billings
are verbatim ("The String Cheese Incident (3 Shows)", "STS9 (PLUS AXE THE
CABLES SET)"); 2016's "Hannah Muse (YOGA)" is a yoga class and dropped as
`activity` (`PROGRAMME`). 2017's only lineup capture of the year (February)
is the second phase, "plus many more artists … to be announced", so 2017 is
not loaded. 71 acts in 2011, 171 in 2016.

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

Archived Shambhala schedule pages (2011 to 2016, format `shambhala-table`):

    node scripts/historical/gather-shambhala.mjs <edition-id> <gather-dir> <official-url> <ts> <url>
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

shambhalamusicfestival.com/<year>-schedule/ (`/schedule-2014/` in 2014) prints
a tab per day ("Thursday", the weekday alone) and one table per tab: a head
row naming the six stages, then a row per half hour whose time cell is
`<td id="time_T">`, T being the slot's wall time written as a UTC epoch. The
day's date is its table's first slot; the tab must name that date's weekday,
and the ledger keeps the slot (`firstSlot`) so the gate can check it. A set is
the billing in its block's first cell with its start printed under it, which
must fall inside that half hour. The page prints no end, so a set is
open-ended unless its billing prints its own range ("Subscura (10:15-10:30PM)"),
which is read only when its start falls within 30 minutes of the block's. A
billing split over two blocks ("Deeps", then "vs. Wakcutt (12-1:30pm)") is one
set, joined in the ledger's `joined`. Closed blocks print CLOSED and empty
blocks nothing; anything else is not read. A table's last row is the next
table's first printed again: a set starting there is the next day's, must be
printed there too, and is excluded from the earlier day as a duplicate. Only
captures taken after each festival are used, since earlier ones are drafts.
Yoga, ceremonies, workshops and talks are dropped as `activity`; showcase and
jam titles that name no act are dropped as `event-block`. Later years are not
in this batch.

Archived Outside Lands schedule grids (2012 to 2017, format `dostuff-grid`):

    node scripts/historical/gather-dostuff.mjs <edition-id> <gather-dir> <official-url> \
      [--comedy <stage>] [--food <stage>] <ts> <day-url> <anchor-ts> <anchor-act-url> [ … one group per day ]
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

lineup.sfoutsidelands.com/events/<yyyy>/<mm>/<dd> prints one day: a tab row
with the current day marked ("Saturday, August 10"), a stage column per stage
whose class carries the date, a 15-minute axis printed with no am/pm
("12:00" … "10:00") and one block per set placed on it (`top`, `height` in
px) with its own printed range, also with no am/pm. Every block's place must
match its printed start and length (2 px a minute); one that disagrees is a
misprint, excluded. The meridiem is never assumed: each day cites one act's
own page on the same site (its anchor), which prints that act's set with
AM/PM ("Friday Aug 9 7:10 PM on Lands End" through 2014, "Friday, August 7,
7:55 PM" from 2015, the stage after the time from 2017). The anchor's time
minus its block's minutes past the axis fixes the axis's first row, which must
be a reading of "12:00"; every start and end must then be a reading of its
own print. The ledger keeps the anchor's page, hash and printed line
(`meridiemFrom`), and the gate checks its weekday and date. The Barbary is the
comedy tent and GastroMagic (2014 on) the chef-and-food stage: their shows are
excluded rows, one for one with the page. Only captures taken after each
festival are used. 2010 and 2011 use an older planner (below); 2018 on has
no archived grid of this kind.

Lollapalooza 2012 ran on the same platform (lineup.lollapalooza.com, same
format and tools, `festivalId` checked against the page). Its titles print
the name alone ("Lollapalooza", "Dev at Lollapalooza"), so the year is the
day tab's own; a printed year must match it. The axis starts at "11:00", and
each day's anchor is one act's page captured after the festival (Dev on
Friday, Avicii on Saturday, Childish Gambino on Sunday). Kidz is the
Kidzapalooza stage, kept as music, as in 2013. Saturday's grid changed during
the festival: the capture used (20120807041117) is the grid printed after it,
with the evening moved later and eight afternoon sets no longer listed, and
the edition carries a note saying so.

Governors Ball 2013 ran on the same platform
(lineup.governorsballmusicfestival.com, same format and tools). Its titles
print the year ("Governors Ball 2013", "Kanye West at Governors Ball 2013").
Each day's grid is a capture taken after the festival, with four stages, and
its anchor is one headliner's own page: Pretty Lights (Friday 9:30 PM,
HondaSTAGE), Guns N' Roses (Saturday) and Kanye West (Sunday, both 9:30 PM on
the GOV BALL NYC STAGE). Friday was cut short by rain. The grid still prints
Kings of Leon closing Friday, but the festival's own homepage (captured
2013-07-21) posted that they would play Saturday at 6:45 PM, where the
Saturday grid lists them. A set like this goes in the edition's `movedSets`
with its from and to slots, the official page and the words quoted from it.
gather-dostuff.mjs excludes the printed block as `moved`, and the import
checks three things: that the page's moved blocks and the excluded rows match
one for one, that the set is listed where it was played, and that the
archived official page prints every quoted phrase. validate.mjs then requires
a note naming both days. Press also reported Pretty Lights' Friday set as cut,
but no official page says so, so it stays as printed.

Governors Ball 2014 and 2015 are the same site and layout (four stages, axis
from "12:00"), each day's grid captured after the festival. Anchors: Outkast,
Jack White and Vampire Weekend (2014); Drake, Marina And The Diamonds and The
Black Keys (2015). Deadmau5's 2015 page, captured before the festival, prints
9:15 PM, but the final Saturday grid has him at 9:30, so that page cannot fix
the axis, and Marina (captured after her set) anchors Saturday instead.

Lollapalooza 2011 is the same site's older layout, read by the same tools.
Its title prints the year ("Lollapalooza 2011"); the days are a drop-down
(the current one as plain text, "Fri, Aug 5", the others as links whose
label must be their link's date) and the grid's "dayN" class must be the
current day. Stage headers are plain, in column order (`ds-stage1` …), and
the axis prints no row heights: the scale is the one the blocks keep
(height + 1 px per printed minute, 2 px a minute), and at least three blocks
in four must keep it. The f.y.e. Autograph Tent signings listed under the
grid have clock times but are not sets: they are never read as any, only
counted (`signingsNotSets` in the ledger). The act pages print the day and
stage, then the linked time ("Sunday, Aug. 7 / Music Unlimited / 4:00pm").
Act pages captured after about August 9, 2011 print "Date & Time TBA", so
the anchors are earlier captures: Kerli (Friday, captured Aug 8), Big Audio
Dynamite (Saturday, captured Aug 7) and The Cars (Sunday, captured that
afternoon, before the set). An anchor only fixes the day's meridiem: its time
must still sit on its own block on the grid captured after the festival
(Aug 20), and all three do.

ACL 2011 and 2012 ran on the same site too (lineup.aclfestival.com, titled
"ACL 2011", "ACL 2012"): the newer tab row ("Friday, September 16") over the
older grid (plain stage headers, no axis heights, the "dayN" class checked),
with the Waterloo Autograph Tent's signings just after the table, counted and
never read as sets. The grids are captures taken after each festival (2011:
Sep 23; 2012: Nov 8 for Friday, May 12, 2013 for Saturday and Sunday). The
anchors are the headliners' own pages: Kanye West, Stevie Wonder and Arcade
Fire for 2011 (captured in August and September, before the festival), The
Black Keys, Jack White and Red Hot Chili Peppers for 2012 (captured Nov 8,
after it). The kids' stage keeps its printed name each year ("Austin Kiddie
Limits presented by H-E-B", "HEB-Kids"), kept as music as in 2013, and one
unnamed "Special Guest" slot there each year is dropped.

Archived DoStuff lineup widgets (Outside Lands 2018, 2019 and 2022 to 2025, Lightning in a Bottle 2018 and 2019, format `dostuff-embed`):

    node scripts/historical/gather-dostuff-embed.mjs <edition-id> <gather-dir> <official-url> \
      <ts> <embed-url> <page-ts> <page-url> [--via <ts> <site-script-url>] \
      [--food <stage>]... [--comedy <stage>] [--programme <stage>]...
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

From 2018 the official lineup page (sfoutsidelands.com/lineup/) draws its
schedule with a script from the festival's own DoStuff site
(`sfosl.dostff.co`, `sfosl19.dostff.co`, `22-osl.dostff.co`, `osl23fest.dostff.co`, `fest24outsidelands.dostff.co`,
`ds25festlands.dostff.co`, each `/embeds/lineup.js`). The script sets
`window._fest_options` on one line of JSON: the festival's name, its first
and last day, its time zone, and an "Interactive Lineup" grouping in which
every artist lists its performances, each with an id, a stage, a billing and
a start and end printed as whole dates with their UTC offset
("2023-08-11T20:40:00.000-07:00"). A set shared by two artists (a b2b, a
feature) appears under each with the same id and is one set, billed as its
own name. Every offset must be the time zone's at that instant, every set end
after its start and within twelve hours, every day inside the run the options
print (a start before 6 AM is the night before), and no two sets may overlap
on one stage. The run must be the edition's own days. Each script capture
cites the official lineup page that loads it on sfoutsidelands.com
(`embeddedBy`), captured within a month of it, and only captures taken after
each festival are used. The 2018 page loads the script by its own
`<script src>`; the 2019 page is an app shell whose own main.js adds the
widget's `<script>` on the lineup route, so its receipt also cites that
main.js (`via`), captured eleven seconds after the page on the same host, and
the import checks that it sets the widget's address whole. GastroMagic and
Cocktail Magic (2018, 2019) are the food stages and The Barbary the comedy
tent, as in the grid years; Cocktail Magic alone (2022, 2023) is the food
stage later. Their shows are excluded rows, one for one with the widget.
2018 has 93 sets on 5 stages (Friday 10 to Sunday 12 August), 2019 94 on 5
(Friday 9 to Sunday 11 August), 2022 127 on 7 (Friday 5 to Sunday 7
August), 2023 126 on 9, 2024 139 on 9 and 2025 155 on 10. There was no
festival in 2020, and 2021 (October) has no archived widget of this kind.

When the options print `"show_performance_titles": false` (every capture
here), the widget draws each set under its act's name and never its title,
so a set drawn under one act is billed as that act ("Forester", not
"Forester (DJ set)"), and a set drawn under several acts is billed as its
title, the festival's one name for the shared set. Two performances with the
same stage, start, end and billing are one set drawn twice and counted once.
The edition's days are the run's days the widget prints a set on: the run
may reach one day past them at either end (a gate day, a last morning) and
no further.

Lightning in a Bottle 2018 and 2019 come from `lib2018.dostff.co` and
`lib2019.dostff.co`. Their archived lineup pages (lightninginabottle.org/lineup/)
and scripts were captured days apart, so each page must be captured within a
month of its script and its HTML must load that very script (`embeddedBy.loads`
in the ledger). Its yoga and meditation stages (Yoga Sol in 2018; Yoga Sol,
Yoga Luna and Meditation Grove in 2019) are programme stages
(`--programme`): their sessions are excluded rows, one for one with the
widget. 2018 (Lake San Antonio) has 224 sets on 10 stages, Thursday 24 to
Sunday 27 May; 2019 (Buena Vista Lake) 229 on 8, Wednesday 8 to Sunday 12 May.

Archived Outside Lands schedule planner (2010 and 2011, format `myscheduler-data`):

    node scripts/historical/gather-myscheduler.mjs <edition-id> <gather-dir> <official-url> <ts> <url> \
      [--variety <stage>] [--restore <name>] …
    node scripts/historical/import-gather.mjs <edition-id> <gather-dir>

myscheduler.sfoutsidelands.com (2010's /outsidelands-2010-schedule.html,
2011's /grid.html) draws its grid in the browser from data written into the
page: `festivalStart`, a `venueMap` of stages and an `entityMap` of sets, each
with its date, 24-hour start and length in minutes. Every set therefore has a
start, an end and a stage with no am/pm to read; the first day with sets must
be `festivalStart`, and 2011's page writes the maps twice, identically. 2010
was two days. An entry with no stage or start (2011's DJ Proof) is not a set:
the ledger keeps it under `unscheduledActs`. 2011's Barbary is the comedy and
variety stage (stand-up, sideshow, magic, circus): its shows are excluded rows,
one for one with the page. The 2010 capture comes back with two names whose
non-ASCII letters it cannot decode (a run of U+FFFD each); each is read by a
restored name in the receipt that keeps every other character of the print
and stands one letter for each lost run ("Janelle Monáe", "Marc D’Antonio"),
and the ledger records both spellings (`restored`). Both captures were taken
after the festival.

Archived C3 schedule grids (ACL, Lollapalooza 2013–2019, Governors Ball 2017–2019, format `acl-grid`):

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

Governors Ball 2017–2019 use the same grid on governorsballmusicfestival.com
/schedule/, each read from a capture taken after the festival (20170606161221,
20180612023504, 20190709043321). The 2017 capture before the festival
(20170519) differs in two Sunday blocks; the later one is kept. 2019's
Sunday was evacuated for storms, and its capture prints the revised evening
schedule, which the edition's note says. 2018 and 2019 print stage names
differently from 2017 ("Gov Ball NYC Stage", "GOVBALLNYC Stage"), kept as
printed. 2020 was canceled; 2021 onward print the schedule as graphics.

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

Archived Awakenings Festival party pages (2010 to 2012, format `awakenings-parties`, lineup only):

    node scripts/historical/extract-awakenings-lineup.mjs awakenings-2010 awakenings-2011 awakenings-2012

Until 2012 Awakenings' own site (awakenings.nl, `/en/parties/<n>/<slug>/`)
gave each event a party page. The summer festival's page heads itself
"Awakenings Festival" (2010: "Awakenings" over "Festival 10 Year
Anniversary") with its one date, place and hours ("30 June 2012 /
Recreatiegebied, Halfweg / 11:00 / 23:00"), and its title prints the same
date; the after-party and the club nights have pages of their own and are
refused. The lineup is one tab per area, labelled as the page labels it
("C", "B", "A", "Z" … "V"; 2010's open-air areas "W (air)" and "V (air)"),
the word "Area" never printed, and each tab's panel lists that area's sets,
each with a printed range and a name. The edition keeps who played on which
area; the ranges are counted in the ledger (`printedRanges`) and not kept.
An act on two areas (2011's Dekmantel Soundsystem) is billed on each. The
date is the page's own, which must be the edition's one day and the
census's. Captures are read from the festival's day to 120 days after; the
pages chosen were captured on 25 September 2010, 4 July 2011 and 1 July
2012. From 2013 the festival's event page loads its lineup by script
(`events/line-up/<id>/`), which the archive never captured, and from late
2015 the site is awakenings.com, whose captures the archive does not serve,
so no later year is loaded.

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

Time Warp Germany (Mannheim), 2012 to 2025: the festival's own lineup page
on time-warp.de, one per edition (2020 was canceled).

    node scripts/historical/extract-timewarp-lineup.mjs <edition-id>
    # writes sheets/<id>.lineup.tsv (billing, night) and the ledger;
    # lineup_only, no stages and no times: the pages print neither

The site changed template twice, so `TW_LINEUP_EDITIONS` gives each edition
its page, its `format` and the title the page must carry, and
timewarp-lineup.mjs has one reader per format:

- **timewarp-mannheim** (2012, 2013; /mannheim/line-up/). A heading names
  the year ("Time Warp 2012", "Mannheim Line Up 2013"); acts are listed in
  DJs, Live and VJs sections. Live acts are billed "(Live)"; VJs are visual
  artists, not music acts, and go to the ledger's `leftOut`. 2012's meta
  description prints the night; 2013's page prints none, so its night is the
  first day of the census's dated run for the year, quoted in the ledger's
  `datesFrom` and checked against the census by the test.
- **timewarp-classic** (2014 to 2018; /germany/line-up/). The event menu
  prints the Germany edition's night ("07 Apr 2018") only until the festival
  has happened ("THANK YOU" afterwards), and the page lists every act once
  under "In alphabetical order" ("In alphabetischer Reihenfolge" on the German
  page). The menu's night must be a real date in the edition's year.
- **timewarp-subsite** (2019, 2021 to 2025). A header names the edition
  (Germany, with the year's two digits in 2021 and 2022), its nights and
  Mannheim; then one list per night, in date order, headed by its weekday
  ("Friday A-Z"), by the German weekday and date ("Fr 05.04.24"), or, when
  the edition has a single night, by nothing or "IN ALPHABETICAL ORDER".
  Live sets are billed "(Live)".

Every reader throws on a page of another year, a night that is not a real
date, an empty list, an act with no name or an act listed twice. One address
served several years (/germany/line-up/ from 2014 to 2018), so each entry
lists captures only in its own `window`: the month before the night for a
page that stops printing it afterwards, the weeks after it for a page that
keeps its header. The latest valid capture in the window is used; where that
capture predates the festival, the edition's note says so and when.

Official Lollapalooza Brasil lineup pages, 2014 to 2019 (formats
`lollabr-por-dia`, `lollabr-grid`, `lollabr-cards`):

    node scripts/historical/extract-lollabr-lineup.mjs lollapalooza-brasil-<year>
    # writes sheets/<id>.lineup.tsv and the ledger; lineup_only, no times

lollapaloozabr.com printed each year's lineup one of three ways
(`lollabr-lineup.mjs`). 2014-2016 (/2014-line-up-por-dia,
/line-up-por-dia-2015, /lineup-por-dia/) print the festival's run with its
year in the site header ("5-6 de abril de 2014 - Autódromo de Interlagos"),
then one heading per day ("Sábado, 5 de abril") over a list of acts; the
headings must be the run's dates in order, each with its own weekday. 2017
(/lineup-horarios/) and 2019 (/lineup-2019/) are the C3 schedule grid read by
`acl-schedule.mjs`: dated day tabs ("sábado mar 25th" over
`saturday-2017-03-25`), one column per stage. The grid prints each block's
range, but these editions keep only the act, day and stage; an act drawn
twice on one stage on one day is one row, listed in the ledger's `notRead`.
2018 (/lineup/2018-interativo/) is the interactive lineup's cards, each with
its day titles ("24/3/2018"); the page's description names the edition and
its run ("O Lollapalooza Brasil 2018 será dias 23, 24 e 25 de março"). No
stage is printed in 2014-2016 or 2018.

Each year's captures from 1 January to the festival's last day are listed
and the latest that proves the edition is read, so the lineup is the one
printed closest before (or during) the festival: 27 February 2014, 27 March
2015, 9 March 2016, 19 March 2017, 1 February 2018 (the last capture of that
page) and 5 April 2019 (the first day). 2014's and 2018's editions carry a
note that later changes are not shown. 2012's day-by-day lineup was a news
post (/updates/programacao-lollapalooza-brasil) that prints each day only as a
poster image, and 2013's reveal page has no capture from 2013; from 2022 the
site's /lineup page also shows the lineup only as a poster image, and no
capture of it from 2023 on was found. Those years are not read here.

Official Lollapalooza Chile (2014-2016) and Lollapalooza Argentina
(2015-2016) day-by-day lineup pages (formats `lollacl-por-dia`,
`lollaar-por-dia`):

    node scripts/historical/extract-lollabr-lineup.mjs lollapalooza-chile-<year>
    node scripts/historical/extract-lollabr-lineup.mjs lollapalooza-argentina-<year>
    # writes sheets/<id>.lineup.tsv and the ledger; lineup_only, no times

lollapaloozacl.com and lollapaloozaar.com ran on Brasil's templates, so the
same reader reads them (`lollabr-lineup.mjs`, each reader given its `site`:
the festival the title must name and the language its dates are printed in,
Spanish here). Chile's /lineup-diario (2014), /lineupdiario2015 and
/lineupdiario2016/, and Argentina's /por-dia (2015) and /lineup-2016-diario/
print the run in the site header ("14 & 15 de marzo 2015 - Parque
O'Higgins", "18 y 19 de marzo de 2016. Hipódromo de San Isidro."). Where the
header prints no year, the title must: Chile 2014's title prints the same
run with it ("… | Santiago – 29 y 30 de Marzo 2014"), Argentina 2015's names
the edition ("Por día | Lollapalooza Argentina 2015"). Each list of acts is
headed by the nearest heading before it, a weekday and the day of the month
("Sábado 29", "Viernes 18", Argentina 2016's "Sabado 19"): that day of the
run, which must be the heading's own weekday, the days in the run's order.
Chile 2016 also prints a Kidzapalooza list under each day; its acts are kept
on that day with the stage Kidzapalooza, the only stage these pages name.
A subtitle that continues a billing is part of it (Argentina 2015's "Robert
Plant" over "and the Sensational Space Shifters"); Chile 2016's "MAGIA REAL"
prints its performers under it, named in the extractor as a credit and set
apart in the ledger (`creditsNotKept`). Any other subtitle, a list under any
other heading, or a heading that heads two lists stops the read.

Each year's captures from 1 January to the festival's last day are listed
and the latest that proves the edition is read: Chile 29 March 2014 (the
first day), 14 February 2015 (four weeks before; the edition's note says
later changes are not shown) and 12 March 2016; Argentina 18 March 2015 and
18 March 2016 (the first day). Not read here: Chile 2011-2013 (the archive's index
lists no day-by-day lineup page from those years, only news posts announcing
one, which were not read), Argentina
2014 (its /lineup-diario has no capture from 2014's run; the September 2014
capture already prints 2015's), and both festivals from 2017 on, whose
schedule grids (/horario/, /horarios/) were found in the archive's index but
not yet read.

Ultra Europe's own Artists page (2013, format `ultra-europe-artists`):

    node scripts/historical/extract-ultra-europe.mjs ultra-europe-2013
    # writes sheets/<id>.lineup.tsv and the ledger; lineup_only

ultraeurope.com/artists/ on the 2013 WordPress site printed a grid of acts,
then one block per act in the same order, each with a line per appearance:
"Day 1 - 05:00PM - Main Stage", several joined with ", " (Carl Cox on both
days). The grid and the blocks must name the same acts in the same order.
The days are numbered, never dated: the site's countdown (`timer:
"2013:7:12:16:0:0"`) is set to the opening, which must be the edition's
first day, so Day N is the (N-1)th day after it; the dates are the census's
dated run (`datesFrom`), as for Creamfields. The printed times are read
only to check each line; a lineup keeps none. The page's Day 3 is Ultra
Beach on Hvar, a separate event after the two Poljud days:
an appearance on it is set apart in the ledger (`offDay`), and only on the
stage the extractor names for that day (Ultra Beach Main Stage); any other
appearance past the edition's days stops the read. The capture used is the
latest within a week after the festival (20 July 2013). The page lists the
acts the festival featured, not every act that played, and an edition note
says so. Later years left no lineup as text: 2014 and 2015 were a script
app whose archived pages carry no lineup (2014's final lineup survives only
as a pre-festival press release, alphabetical, with no days and "And many
more"), and from 2016 the lineup, stage and set-times pages are poster
images (2019 and 2023-2025 are queued for the image path in
`ocr-queue.mjs`); the later `/artists/<year>/` pages load their lists by
script (2024's archived empty).

UNTOLD's own Artists page (2024, 2025, format `untold-artists`):

    PLURSKY_WAYBACK_RELAY=1 node scripts/historical/extract-untold.mjs untold-2024 untold-2025
    # writes sheets/<id>.lineup.tsv and the ledger; lineup_only, no times

untold.com/artists on the Next.js site (from late 2023) draws its list from
data the page embeds in itself (`<script id="__NEXT_DATA__">`): one entry per
performance with the billing, its stage (`performanceStage.name`: Main,
Galaxy, Alchemy …), a numbered day label ("Ziua 1" on the Romanian page,
"Day 1" on the English one) and `performanceDate`, an instant at 16:00 in
Cluj-Napoca on that festival day's date. The page's title names no year;
the entries date it. Every entry's date, read in Europe/Bucharest, must be
in the edition's year, a label may carry only one date, the labels must be
Day 1 to Day N, and the dates must be exactly the edition's run, which must
also be the census's dated post-event run (quoted in the ledger as
`census`). The list must be the whole list (`totalPages` 1). 2024's entries
also carry each set's start and end; a lineup keeps none (they are counted
in the ledger's `timedEntries`). A name printed with spaces around it is
billed without them (`trimmed`), and two spellings that make the same id
(2025's "B MIKE" and "B.MIKE") are one act under the first printed
(`sameActs`). Printed rows that name no performer are
dropped by the build: 2024's "LOCAL ARTIST" and 2025's two "SURPRISE GUEST"
slots as unnamed slots, and 2025's three Main stage moments (two
broadcasters' anniversaries and "TRADITIONAL ROMANIAN MOMENT") as show
segments. Captures are listed from 1 January to a week after the last day
(after that the page empties and then lists the next edition), and the
latest valid one is read: 4 August 2024 and 25 July 2025, both before the
festival, so each edition carries a note that later changes are not shown.
Earlier years are not read: the 2016 site was an AngularJS app and its
2016-2018 programme, timetable, schedule and line-up captures are each
under 3 KB (script shells, by their archived size); the 2019-2023 Gatsby
site's line-up, schedule and stages pages print "Loading ..." and fetch
their lists by script (never archived); 2015 left no lineup page; and no
2023 capture of the new site was taken before the festival.

BottleRock Napa Valley's own Artists page (2015, 2017, 2022, format
`bottlerock-artists`):

    node scripts/historical/extract-bottlerock.mjs bottlerock-<year>
    # writes sheets/<id>.lineup.tsv and the ledger; lineup_only, no stages

bottlerocknapavalley.com kept one Artists page per year
(`BOTTLEROCK_PAGES`: /lineup-schedule/artists/ in 2015,
/lineup-schedule/<year>-artists/ in 2016-2019, /<year>-artists/ in
2021-2023), all one template (`bottlerock-artists.mjs`): the heading
"<year> Artists" (the `<h1>`, or the `<title>` in 2015, which prints no
`<h1>`), a filter bar with one control per day, and one grid block per act
carrying its days as the filter's classes. The filter prints weekdays
("Friday" shows `.fri`); 2015's classes are the days of the month (`.29`),
which must be the edition's own. The page prints no stage and no time, and
its weekdays carry no year: the heading names the edition, the filter must
print exactly the edition's weekdays in order, and any run the page prints
for that year ("May 29-31, 2015" in 2015's footer, "May 26-28, 2017" in
2017's description) must be the edition's dates, which are the census's
dated run (`datesFrom`), as for Creamfields. A later footer prints the next
edition's run (2022's capture prints "May 26-28, 2023") and is not read as
this one's. An act playing two days is one row per day.

Every capture of the year's address is listed, and the first valid one
taken after the last day is read, so the lineup is the page as the festival
left it: 10 June 2015, 6 July 2017 and 11 June 2022. No capture after the
festival may be skipped unread; with none valid, the latest before it is read
and the edition must carry a note saying so. 2013 and 2014 left only
posters (2015's /lineup-schedule/2013-artists/ and 2014-artists/ pages hold
one image each), and from 2024 the /<year>-lineup/ page is a poster too;
2025's lineup is built by script on the home page. 2016, 2018, 2019, 2021
and 2023 use the same template and their captures are listed, but none was
filed yet, so those years are not read here.

Then, for any path:

    node scripts/historical/build-editions.mjs
    # lock counts in expected-counts.json, then
    node scripts/test-historical-editions.mjs

## Unofficial lineups (`unofficial/<family>.json`)

For years where no official page or graphic survives, a lineup may come from
somewhere else: a fan-made Clashfinder timetable, a news article, Wikipedia, a
social post or a poster. Jake approved this on 2026-11-27, provided every such
year says where its lineup came from. These editions are always `lineup_only`
(method `unofficial_lineup`): no unofficial source is trusted for set times,
and the gate refuses one that tries to make a schedule.

Register the edition in `unofficial/<family>.json` (official entries in
`editions.mjs` win on a clash), save the source once into the research cache as
`<cache>/unofficial/<edition-id>/source.json` and `source.txt`, then:

    node scripts/historical/extract-unofficial-lineup.mjs <edition-id>

`source.json` names the source (`kind`: fan_timetable, press, wikipedia,
social, poster; `url`, `title`, `publisher`, `published`, `fetchedAt`,
`fetchedVia`, `scope` full or partial) and its `format`: `clashfinder` parses
the line-up view (`clashfinder.com/m/<event>/`, never a `?user=` selection);
`rows` reads `rows.tsv` beside it (artist, day, stage), listed by hand from the
text, with `days` giving the words the source prints for each day. Every
billing, printed day and stage must appear in the saved text; the dates come
from the census's dated run for that year. The ledger keeps the text's hash,
and the app shows "unofficial, from <source>" wherever the year appears, with
a link to the source.

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
- A `lineup_only` edition comes from an official lineup page, or from a named
  unofficial source (above), and carries no
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

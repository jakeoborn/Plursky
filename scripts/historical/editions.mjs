// editions.mjs — the fixed facts about each historical edition that are NOT
// read from a schedule row: identity, official dates, time zone, and the hour
// before which a wall time belongs to the previous festival night.
//
// `dates` are the edition's official days. Each one was read off the archived
// page itself (Insomniac day tabs, or the header printed on each official
// graphic), and the ledger holds the capture that shows it.

import { slug } from "./lib.mjs";

const TML_THREE_WEEKEND_LABELS = ["Weekend 1 · Friday", "Weekend 1 · Saturday", "Weekend 1 · Sunday",
  "Weekend 2 · Friday", "Weekend 2 · Saturday", "Weekend 2 · Sunday", "Weekend 3 · Friday", "Weekend 3 · Saturday", "Weekend 3 · Sunday"];
const ACL_WEEKEND_LABELS = ["Weekend 1 · Friday", "Weekend 1 · Saturday", "Weekend 1 · Sunday",
  "Weekend 2 · Friday", "Weekend 2 · Saturday", "Weekend 2 · Sunday"];

export const EDITIONS = {
  "governors-ball-2025": { festivalId: "governors-ball", name: "Governors Ball 2025", year: 2025,
    timezone: "America/New_York", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-06-06", "Friday"], ["2025-06-07", "Saturday"], ["2025-06-08", "Sunday"]] },
  "lollapalooza-2025": { festivalId: "lollapalooza", name: "Lollapalooza 2025", year: 2025,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-07-31", "Thursday"], ["2025-08-01", "Friday"], ["2025-08-02", "Saturday"], ["2025-08-03", "Sunday"]] },
  // Lollapalooza 2013-2017 and 2019: the official lollapalooza.com schedule
  // grid, the same C3 page as ACL's (format "acl-grid"), one archived page per
  // year, each start read off the page's own hour axis.
  "lollapalooza-2013": { festivalId: "lollapalooza", name: "Lollapalooza 2013", year: 2013,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources",
    dates: [["2013-08-02", "Friday"], ["2013-08-03", "Saturday"], ["2013-08-04", "Sunday"]],
    // Saturday prints one range that disagrees with its own block
    // ("5:30-4:15" on a 75-minute block), so that day cannot be read off its
    // axis: its lineup ships as printed, without times.
    untimedDays: [2],
    notes: [{ asOf: "2026-11-11", days: [2], text: "The official schedule misprints one Saturday set time (Lukas Nelson & P.O.T.R. as 5:30-4:15), so Saturday's set times cannot be confirmed from the page. The lineup is as that page printed it; School of Rock's two Kidzapalooza sets that day are listed once.",
      source: "https://web.archive.org/web/20131221052257/http://www.lollapalooza.com:80/2013-schedule/" }] },
  "lollapalooza-2014": { festivalId: "lollapalooza", name: "Lollapalooza 2014", year: 2014,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources",
    dates: [["2014-08-01", "Friday"], ["2014-08-02", "Saturday"], ["2014-08-03", "Sunday"]] },
  "lollapalooza-2015": { festivalId: "lollapalooza", name: "Lollapalooza 2015", year: 2015,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources",
    dates: [["2015-07-31", "Friday"], ["2015-08-01", "Saturday"], ["2015-08-02", "Sunday"]] },
  "lollapalooza-2016": { festivalId: "lollapalooza", name: "Lollapalooza 2016", year: 2016,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources",
    dates: [["2016-07-28", "Thursday"], ["2016-07-29", "Friday"], ["2016-07-30", "Saturday"], ["2016-07-31", "Sunday"]] },
  "lollapalooza-2017": { festivalId: "lollapalooza", name: "Lollapalooza 2017", year: 2017,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources",
    dates: [["2017-08-03", "Thursday"], ["2017-08-04", "Friday"], ["2017-08-05", "Saturday"], ["2017-08-06", "Sunday"]] },
  "lollapalooza-2019": { festivalId: "lollapalooza", name: "Lollapalooza 2019", year: 2019,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources",
    dates: [["2019-08-01", "Thursday"], ["2019-08-02", "Friday"], ["2019-08-03", "Saturday"], ["2019-08-04", "Sunday"]],
    // The only archived 2019 grid was captured July 30, before the festival:
    // its lineup ships, its times do not (as ACL 2017's Weekend 2).
    untimedDays: [1, 2, 3, 4],
    notes: [{ asOf: "2026-11-11", days: [1, 2, 3, 4], text: "The only archived 2019 schedule was captured July 30, before the festival, so set times are not confirmed. The lineup is as that page printed it.",
      source: "https://web.archive.org/web/20190730190925/https://www.lollapalooza.com/schedule/" }] },
  "hard-summer-2025": { festivalId: "hard-summer", name: "HARD Summer 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2025-08-02", "Saturday"], ["2025-08-03", "Sunday"]] },
  "edc-las-vegas-2025": { festivalId: "edc-lv", name: "EDC Las Vegas 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2025-05-16", "Friday"], ["2025-05-17", "Saturday"], ["2025-05-18", "Sunday"]] },
  "edc-las-vegas-2024": { festivalId: "edc-lv", name: "EDC Las Vegas 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2024-05-17", "Friday"], ["2024-05-18", "Saturday"], ["2024-05-19", "Sunday"]] },
  "edc-las-vegas-2022": { festivalId: "edc-lv", name: "EDC Las Vegas 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2022-05-20", "Friday"], ["2022-05-21", "Saturday"], ["2022-05-22", "Sunday"]] },
  "beyond-wonderland-socal-2026": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2026", year: 2026,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2026-03-27", "Friday"], ["2026-03-28", "Saturday"]] },
  "beyond-wonderland-gorge-2026": { festivalId: "beyond-wonderland-gorge", name: "Beyond Wonderland at The Gorge 2026", year: 2026,
    timezone: "America/Los_Angeles", rolloverHour: 12, method: "structured_html",
    dates: [["2026-06-27", "Saturday"], ["2026-06-28", "Sunday"]] },
  "acl-2021": { festivalId: "acl", name: "Austin City Limits 2021", year: 2021,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2021-10-01", "Friday"], ["2021-10-02", "Saturday"], ["2021-10-03", "Sunday"],
      ["2021-10-08", "Friday"], ["2021-10-09", "Saturday"], ["2021-10-10", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2023": { festivalId: "acl", name: "Austin City Limits 2023", year: 2023,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2023-10-06", "Friday"], ["2023-10-07", "Saturday"], ["2023-10-08", "Sunday"],
      ["2023-10-13", "Friday"], ["2023-10-14", "Saturday"], ["2023-10-15", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2022": { festivalId: "acl", name: "Austin City Limits 2022", year: 2022,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2022-10-07", "Friday"], ["2022-10-08", "Saturday"], ["2022-10-09", "Sunday"],
      ["2022-10-14", "Friday"], ["2022-10-15", "Saturday"], ["2022-10-16", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2024": { festivalId: "acl", name: "Austin City Limits 2024", year: 2024,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2024-10-04", "Friday"], ["2024-10-05", "Saturday"], ["2024-10-06", "Sunday"],
      ["2024-10-11", "Friday"], ["2024-10-12", "Saturday"], ["2024-10-13", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2025": { festivalId: "acl", name: "Austin City Limits 2025", year: 2025,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_image_transcription",
    dates: [["2025-10-03", "Friday"], ["2025-10-04", "Saturday"], ["2025-10-05", "Sunday"],
      ["2025-10-10", "Friday"], ["2025-10-11", "Saturday"], ["2025-10-12", "Sunday"]],
    dayLabels: ["Weekend 1 · Friday", "Weekend 1 · Saturday", "Weekend 1 · Sunday",
      "Weekend 2 · Friday", "Weekend 2 · Saturday", "Weekend 2 · Sunday"] },
  // ACL 2014-2016, 2018, 2019: the official aclfestival.com schedule grid, one
  // archived page per weekend (format "acl-grid", acl-schedule.mjs). The grid
  // prints ranges with no am/pm; each start is read off the page's own printed
  // hour axis by the block's position (ruling A, 2026-11-04).
  // ACL 2013's Weekend 2 Sunday (Oct 13) was cancelled by flooding: the final
  // official W2 page still prints its grid under a cancellation banner. The
  // edition has no such day (Instinct's ruling, 2026-11-04): the importer
  // proves the banner and that the sheet excludes every block of that day.
  "acl-2013": { festivalId: "acl", name: "Austin City Limits 2013", year: 2013,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2013-10-04", "Friday"], ["2013-10-05", "Saturday"], ["2013-10-06", "Sunday"], ["2013-10-11", "Friday"], ["2013-10-12", "Saturday"]],
    dayLabels: ACL_WEEKEND_LABELS.slice(0, 5),
    cancelledDays: [{ date: "2013-10-13", weekday: "Sunday", banner: "Sunday Performances Have Been Canceled Due To Flooding" }],
    notes: [{ asOf: "2026-11-04", text: "Weekend 2 Sunday (October 13) was cancelled because of flooding, so it has no sets here. The official Weekend 2 schedule printed: “Sunday Performances Have Been Canceled Due To Flooding”.",
      source: "https://web.archive.org/web/20140215094751/http://www.aclfestival.com/2013-schedule/weekend-two/" }] },
  "acl-2014": { festivalId: "acl", name: "Austin City Limits 2014", year: 2014,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2014-10-03", "Friday"], ["2014-10-04", "Saturday"], ["2014-10-05", "Sunday"], ["2014-10-10", "Friday"], ["2014-10-11", "Saturday"], ["2014-10-12", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2015": { festivalId: "acl", name: "Austin City Limits 2015", year: 2015,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2015-10-02", "Friday"], ["2015-10-03", "Saturday"], ["2015-10-04", "Sunday"], ["2015-10-09", "Friday"], ["2015-10-10", "Saturday"], ["2015-10-11", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2016": { festivalId: "acl", name: "Austin City Limits 2016", year: 2016,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2016-09-30", "Friday"], ["2016-10-01", "Saturday"], ["2016-10-02", "Sunday"], ["2016-10-07", "Friday"], ["2016-10-08", "Saturday"], ["2016-10-09", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  // ACL 2017's Weekend 2 survives only in a capture from Oct 9, four days
  // before that weekend: its lineup ships, its times do not (Instinct's
  // ruling, 2026-11-04). Those days are untimed: sets carry no start or end.
  "acl-2017": { festivalId: "acl", name: "Austin City Limits 2017", year: 2017,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2017-10-06", "Friday"], ["2017-10-07", "Saturday"], ["2017-10-08", "Sunday"], ["2017-10-13", "Friday"], ["2017-10-14", "Saturday"], ["2017-10-15", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS, untimedDays: [4, 5, 6],
    notes: [{ asOf: "2026-11-04", days: [4, 5, 6], text: "The only archived Weekend 2 schedule was captured October 9, before that weekend, so set times are not confirmed. The lineup is as that page printed it.",
      source: "https://web.archive.org/web/20171009063627/https://www.aclfestival.com/schedule-weekend-two/?goal=0_59b0a4eaa1-57b082a223-155739397&mc_cid=57b082a223&mc_eid=217da620b6" }] },
  "acl-2018": { festivalId: "acl", name: "Austin City Limits 2018", year: 2018,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2018-10-05", "Friday"], ["2018-10-06", "Saturday"], ["2018-10-07", "Sunday"], ["2018-10-12", "Friday"], ["2018-10-13", "Saturday"], ["2018-10-14", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "acl-2019": { festivalId: "acl", name: "Austin City Limits 2019", year: 2019,
    timezone: "America/Chicago", rolloverHour: 6, method: "official_sources", dates: [["2019-10-04", "Friday"], ["2019-10-05", "Saturday"], ["2019-10-06", "Sunday"], ["2019-10-11", "Friday"], ["2019-10-12", "Saturday"], ["2019-10-13", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  // Tomorrowland: the official timetable page prints every stage and set of
  // both weekends (tml-schedule.mjs, format "tml-stages"), read from one
  // archived capture per year; the Thursday Gathering is not a festival day.
  // Electric Forest's own "Artist Schedule" (set-times.php, All Days view):
  // every day of the festival on one 15-minute grid, Thursday to Sunday.
  "electric-forest-2012": { festivalId: "electric-forest", name: "Electric Forest 2012", year: 2012,
    timezone: "America/Detroit", rolloverHour: 6, method: "official_sources",
    dates: [["2012-06-28", "Thursday"], ["2012-06-29", "Friday"], ["2012-06-30", "Saturday"], ["2012-07-01", "Sunday"]] },
  "electric-forest-2013": { festivalId: "electric-forest", name: "Electric Forest 2013", year: 2013,
    timezone: "America/Detroit", rolloverHour: 6, method: "official_sources",
    dates: [["2013-06-27", "Thursday"], ["2013-06-28", "Friday"], ["2013-06-29", "Saturday"], ["2013-06-30", "Sunday"]] },
  // Coachella's own lineup page (coachella.com/lineup/): one card per act
  // with each set's date, start and stage, and no end time, so every set is
  // open-ended. 2016's page prints both weekends; 2014's and 2015's print
  // one weekend per view (?weekend=1, ?weekend=2; the default view is the
  // weekend the site last showed).
  // 2012's page prints each act's sets in a hidden overlay (format
  // "coachella-overlays"), start times only.
  "coachella-2012": { festivalId: "coachella", name: "Coachella 2012", year: 2012,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2012-04-13", "Friday"], ["2012-04-14", "Saturday"], ["2012-04-15", "Sunday"], ["2012-04-20", "Friday"], ["2012-04-21", "Saturday"], ["2012-04-22", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "coachella-2014": { festivalId: "coachella", name: "Coachella 2014", year: 2014,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2014-04-11", "Friday"], ["2014-04-12", "Saturday"], ["2014-04-13", "Sunday"], ["2014-04-18", "Friday"], ["2014-04-19", "Saturday"], ["2014-04-20", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "coachella-2015": { festivalId: "coachella", name: "Coachella 2015", year: 2015,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2015-04-10", "Friday"], ["2015-04-11", "Saturday"], ["2015-04-12", "Sunday"], ["2015-04-17", "Friday"], ["2015-04-18", "Saturday"], ["2015-04-19", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "coachella-2016": { festivalId: "coachella", name: "Coachella 2016", year: 2016,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2016-04-15", "Friday"], ["2016-04-16", "Saturday"], ["2016-04-17", "Sunday"], ["2016-04-22", "Friday"], ["2016-04-23", "Saturday"], ["2016-04-24", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  // 2017's page holds the lineup as data (format "coachella-data"): start and
  // end where it has them; a set with no end is open-ended.
  "coachella-2017": { festivalId: "coachella", name: "Coachella 2017", year: 2017,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2017-04-14", "Friday"], ["2017-04-15", "Saturday"], ["2017-04-16", "Sunday"], ["2017-04-21", "Friday"], ["2017-04-22", "Saturday"], ["2017-04-23", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "tomorrowland-2017": { festivalId: "tomorrowland", name: "Tomorrowland 2017", year: 2017,
    timezone: "Europe/Brussels", rolloverHour: 6, method: "official_sources", dates: [["2017-07-21", "Friday"], ["2017-07-22", "Saturday"], ["2017-07-23", "Sunday"], ["2017-07-28", "Friday"], ["2017-07-29", "Saturday"], ["2017-07-30", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "tomorrowland-2018": { festivalId: "tomorrowland", name: "Tomorrowland 2018", year: 2018,
    timezone: "Europe/Brussels", rolloverHour: 6, method: "official_sources", dates: [["2018-07-20", "Friday"], ["2018-07-21", "Saturday"], ["2018-07-22", "Sunday"], ["2018-07-27", "Friday"], ["2018-07-28", "Saturday"], ["2018-07-29", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "tomorrowland-2019": { festivalId: "tomorrowland", name: "Tomorrowland 2019", year: 2019,
    timezone: "Europe/Brussels", rolloverHour: 6, method: "official_sources", dates: [["2019-07-19", "Friday"], ["2019-07-20", "Saturday"], ["2019-07-21", "Sunday"], ["2019-07-26", "Friday"], ["2019-07-27", "Saturday"], ["2019-07-28", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  "tomorrowland-2022": { festivalId: "tomorrowland", name: "Tomorrowland 2022", year: 2022,
    timezone: "Europe/Brussels", rolloverHour: 6, method: "official_sources", dates: [["2022-07-15", "Friday"], ["2022-07-16", "Saturday"], ["2022-07-17", "Sunday"], ["2022-07-22", "Friday"], ["2022-07-23", "Saturday"], ["2022-07-24", "Sunday"], ["2022-07-29", "Friday"], ["2022-07-30", "Saturday"], ["2022-07-31", "Sunday"]],
    dayLabels: TML_THREE_WEEKEND_LABELS },
  "tomorrowland-2023": { festivalId: "tomorrowland", name: "Tomorrowland 2023", year: 2023,
    timezone: "Europe/Brussels", rolloverHour: 6, method: "official_sources", dates: [["2023-07-21", "Friday"], ["2023-07-22", "Saturday"], ["2023-07-23", "Sunday"], ["2023-07-28", "Friday"], ["2023-07-29", "Saturday"], ["2023-07-30", "Sunday"]],
    dayLabels: ACL_WEEKEND_LABELS },
  // Escape: no single archived source covers most years. Each day lists its
  // sources (an archived official page, or an official graphic re-hosted by
  // the festival's X account or EDM Identity, ruling A) in ledger/<id>.json.
  "escape-halloween-2017": { festivalId: "escape-halloween", name: "Escape Halloween 2017", year: 2017,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2017-10-27", "Friday"], ["2017-10-28", "Saturday"]] },
  "escape-halloween-2019": { festivalId: "escape-halloween", name: "Escape Halloween 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2019-10-25", "Friday"], ["2019-10-26", "Saturday"]] },
  "escape-halloween-2021": { festivalId: "escape-halloween", name: "Escape Halloween 2021", year: 2021,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2021-10-29", "Friday"], ["2021-10-30", "Saturday"]] },
  "escape-halloween-2022": { festivalId: "escape-halloween", name: "Escape Halloween 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2022-10-28", "Friday"], ["2022-10-29", "Saturday"]] },
  "escape-halloween-2024": { festivalId: "escape-halloween", name: "Escape Halloween 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2024-10-25", "Friday"], ["2024-10-26", "Saturday"]] },
  "escape-halloween-2025": { festivalId: "escape-halloween", name: "Escape Halloween 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2025-10-31", "Friday"], ["2025-11-01", "Saturday"]] },
  "edc-orlando-2017": { festivalId: "edc-orlando", name: "EDC Orlando 2017", year: 2017,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2017-11-10", "Friday"], ["2017-11-11", "Saturday"]] },
  "edc-orlando-2019": { festivalId: "edc-orlando", name: "EDC Orlando 2019", year: 2019,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2019-11-08", "Friday"], ["2019-11-09", "Saturday"], ["2019-11-10", "Sunday"]] },
  "edc-orlando-2021": { festivalId: "edc-orlando", name: "EDC Orlando 2021", year: 2021,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2021-11-12", "Friday"], ["2021-11-13", "Saturday"], ["2021-11-14", "Sunday"]] },
  "edc-orlando-2022": { festivalId: "edc-orlando", name: "EDC Orlando 2022", year: 2022,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2022-11-11", "Friday"], ["2022-11-12", "Saturday"], ["2022-11-13", "Sunday"]] },
  "edc-orlando-2023": { festivalId: "edc-orlando", name: "EDC Orlando 2023", year: 2023,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2023-11-10", "Friday"], ["2023-11-11", "Saturday"], ["2023-11-12", "Sunday"]] },
  "edc-orlando-2024": { festivalId: "edc-orlando", name: "EDC Orlando 2024", year: 2024,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2024-11-08", "Friday"], ["2024-11-09", "Saturday"], ["2024-11-10", "Sunday"]] },
  "edc-orlando-2025": { festivalId: "edc-orlando", name: "EDC Orlando 2025", year: 2025,
    timezone: "America/New_York", rolloverHour: 6, method: "official_sources",
    dates: [["2025-11-07", "Friday"], ["2025-11-08", "Saturday"], ["2025-11-09", "Sunday"]] },
  "nocturnal-wonderland-2017": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2017", year: 2017,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2017-09-15", "Friday"], ["2017-09-16", "Saturday"]] },
  "nocturnal-wonderland-2018": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2018", year: 2018,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2018-09-14", "Friday"], ["2018-09-15", "Saturday"]] },
  "nocturnal-wonderland-2019": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2019-09-14", "Saturday"], ["2019-09-15", "Sunday"]] },
  "nocturnal-wonderland-2021": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2021", year: 2021,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2021-09-18", "Saturday"], ["2021-09-19", "Sunday"]] },
  "nocturnal-wonderland-2022": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2022-09-17", "Saturday"], ["2022-09-18", "Sunday"]] },
  "nocturnal-wonderland-2024": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2024-09-14", "Saturday"], ["2024-09-15", "Sunday"]],
    // Announced, scheduled, then canceled before it opened (the Line Fire). The
    // rows stay as the archive printed them; the library and the artist
    // registry skip a canceled edition, so no one is credited with a set that
    // never happened. Two dated sources, each published before the first day.
    status: "canceled",
    canceled: { announced: "2024-09-11", reason: "Canceled before it opened because of the Line Fire near the venue.",
      sources: [
        { publisher: "Moon Lvnding", published: "2024-09-11", fetched: "2026-11-06",
          url: "https://moonlvnding.com/featured/breaking-nocturnal-wonderland-2024-canceled-as-wildfires-threaten-venue/" },
        { publisher: "Billboard", published: "2024-09-12", fetched: "2026-11-06",
          url: "https://www.billboard.com/pro/nocturnal-wonderland-2024-canceled-southern-california-wildfires/" }] } },  "dreamstate-socal-2016": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2016", year: 2016,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2016-11-25", "Friday"], ["2016-11-26", "Saturday"]] },
  "dreamstate-socal-2019": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2019-11-22", "Friday"], ["2019-11-23", "Saturday"]] },
  "dreamstate-socal-2023": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2023-11-17", "Friday"], ["2023-11-18", "Saturday"]] },
  "dreamstate-socal-2024": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2024-11-22", "Friday"], ["2024-11-23", "Saturday"]] },
  "dreamstate-socal-2025": { festivalId: "dreamstate-socal", name: "Dreamstate SoCal 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_sources",
    dates: [["2025-11-21", "Friday"], ["2025-11-22", "Saturday"]] },
  // Lineup only: these editions' set-times pages were never archived, so the
  // library carries their official lineup page (billing, and the day and
  // stage it printed) and no times (extract-insomniac-lineup.mjs).
  "nocturnal-wonderland-2025": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2025-09-13", "Saturday"], ["2025-09-14", "Sunday"]] },
  "beyond-wonderland-socal-2025": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2025", year: 2025,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2025-03-28", "Friday"], ["2025-03-29", "Saturday"]] },
  "beyond-wonderland-socal-2022": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2022-03-25", "Friday"], ["2022-03-26", "Saturday"]] },
  "beyond-wonderland-socal-2024": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2024-03-22", "Friday"], ["2024-03-23", "Saturday"]] },
  "nocturnal-wonderland-2023": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2023-09-16", "Saturday"], ["2023-09-17", "Sunday"]] },
  "hard-summer-2018": { festivalId: "hard-summer", name: "HARD Summer 2018", year: 2018,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2018-08-04", "Saturday"], ["2018-08-05", "Sunday"]] },
  "hard-summer-2019": { festivalId: "hard-summer", name: "HARD Summer 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2019-08-03", "Saturday"], ["2019-08-04", "Sunday"]] },
  "hard-summer-2022": { festivalId: "hard-summer", name: "HARD Summer 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2022-07-29", "Friday"], ["2022-07-30", "Saturday"], ["2022-07-31", "Sunday"]] },
  "hard-summer-2023": { festivalId: "hard-summer", name: "HARD Summer 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2023-08-05", "Saturday"], ["2023-08-06", "Sunday"]] },
  "hard-summer-2024": { festivalId: "hard-summer", name: "HARD Summer 2024", year: 2024,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2024-08-03", "Saturday"], ["2024-08-04", "Sunday"]] },
  "escape-halloween-2023": { festivalId: "escape-halloween", name: "Escape Halloween 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2023-10-27", "Friday"], ["2023-10-28", "Saturday"]] },
  "edc-las-vegas-2019": { festivalId: "edc-lv", name: "EDC Las Vegas 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2019-05-17", "Friday"], ["2019-05-18", "Saturday"], ["2019-05-19", "Sunday"]] },
  "edc-las-vegas-2021": { festivalId: "edc-lv", name: "EDC Las Vegas 2021", year: 2021,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2021-10-22", "Friday"], ["2021-10-23", "Saturday"], ["2021-10-24", "Sunday"]] },
  "edc-las-vegas-2023": { festivalId: "edc-lv", name: "EDC Las Vegas 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2023-05-19", "Friday"], ["2023-05-20", "Saturday"], ["2023-05-21", "Sunday"]] },
  "edc-orlando-2015": { festivalId: "edc-orlando", name: "EDC Orlando 2015", year: 2015,
    timezone: "America/New_York", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2015-11-06", "Friday"], ["2015-11-07", "Saturday"]] },
  // `undated`: the lineup page printed no days (extract-insomniac-lineup.mjs).
  "edc-orlando-2016": { festivalId: "edc-orlando", name: "EDC Orlando 2016", year: 2016,
    timezone: "America/New_York", rolloverHour: 6, method: "official_lineup_html", undated: true,
    dates: [["2016-11-04", "Friday"], ["2016-11-05", "Saturday"]],
    notes: [{ asOf: "2026-11-11", text: "The official lineup page listed the artists alphabetically and printed no days, so no artist here has a day.",
      source: "https://web.archive.org/web/20161204183828/https://orlando.electricdaisycarnival.com/experience/lineup/" }] },
  "edc-las-vegas-2016": { festivalId: "edc-lv", name: "EDC Las Vegas 2016", year: 2016,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html", undated: true,
    dates: [["2016-06-17", "Friday"], ["2016-06-18", "Saturday"], ["2016-06-19", "Sunday"]],
    notes: [{ asOf: "2026-11-11", text: "The official lineup page listed the artists alphabetically and printed no days, so no artist here has a day.",
      source: "https://web.archive.org/web/20161031113516/https://lasvegas.electricdaisycarnival.com/experience/lineup/" }] },
  "edc-las-vegas-2017": { festivalId: "edc-lv", name: "EDC Las Vegas 2017", year: 2017,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html", undated: true,
    dates: [["2017-06-16", "Friday"], ["2017-06-17", "Saturday"], ["2017-06-18", "Sunday"]],
    notes: [{ asOf: "2026-11-11", text: "The official lineup page listed the artists alphabetically and printed no days, so no artist here has a day.",
      source: "https://web.archive.org/web/20170701091308/https://lasvegas.electricdaisycarnival.com/experience/lineup/" }] },
  "edc-orlando-2018": { festivalId: "edc-orlando", name: "EDC Orlando 2018", year: 2018,
    timezone: "America/New_York", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2018-11-09", "Friday"], ["2018-11-10", "Saturday"]] },
  "edc-mexico-2020": { festivalId: "edc-mexico", name: "EDC Mexico 2020", year: 2020,
    timezone: "America/Mexico_City", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2020-02-28", "Friday"], ["2020-02-29", "Saturday"], ["2020-03-01", "Sunday"]] },
  "beyond-wonderland-socal-2019": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2019", year: 2019,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2019-03-22", "Friday"], ["2019-03-23", "Saturday"]] },
  "countdown-nye-2022": { festivalId: "countdown-nye", name: "Countdown NYE 2022", year: 2022,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2022-12-30", "Friday"], ["2022-12-31", "Saturday"]] },
  "countdown-nye-2023": { festivalId: "countdown-nye", name: "Countdown NYE 2023", year: 2023,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2023-12-30", "Saturday"], ["2023-12-31", "Sunday"]] },
  "escape-halloween-2015": { festivalId: "escape-halloween", name: "Escape Halloween 2015", year: 2015,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2015-10-30", "Friday"], ["2015-10-31", "Saturday"]] },
  "nocturnal-wonderland-2015": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2015", year: 2015,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2015-09-04", "Friday"], ["2015-09-05", "Saturday"], ["2015-09-06", "Sunday"]] },
  "nocturnal-wonderland-2016": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2016", year: 2016,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2016-09-02", "Friday"], ["2016-09-03", "Saturday"], ["2016-09-04", "Sunday"]] },
  "beyond-wonderland-socal-2016": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2016", year: 2016,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "official_lineup_html",
    dates: [["2016-03-18", "Friday"], ["2016-03-19", "Saturday"]] },
  "nocturnal-wonderland-2011": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2011", year: 2011,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2011-09-23", "Friday"], ["2011-09-24", "Saturday"]] },
  "beyond-wonderland-socal-2012": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2012", year: 2012,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2012-03-17", "Saturday"]] },
  "nocturnal-wonderland-2012": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2012", year: 2012,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2012-09-21", "Friday"], ["2012-09-22", "Saturday"]] },
  "nocturnal-wonderland-2013": { festivalId: "nocturnal-wonderland", name: "Nocturnal Wonderland 2013", year: 2013,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2013-09-21", "Saturday"]] },
  "beyond-wonderland-socal-2013": { festivalId: "beyond-wonderland-socal", name: "Beyond Wonderland SoCal 2013", year: 2013,
    timezone: "America/Los_Angeles", rolloverHour: 6, method: "structured_html",
    dates: [["2013-03-16", "Saturday"]] },
};

// Rows the official schedule prints that are NOT part of the library (founder
// rulings on #221, 2026-09-22). They are dropped at build time: stored neither
// as artists nor as events, so they cannot enter an artist's history, search
// or a count. The sheets and review manifests keep them as the audit trail of
// what was printed, and build-editions.mjs records every dropped row, with its
// reason, in ledger/<id>.json. Locked by test-historical-editions.mjs.
// A rule matches the printed billing (`test`) or the whole stage (`stage`).
// Stage rules are checked first, so every row on a dropped stage carries the
// stage's reason.
export const DROP_RULES = [
  { category: "bonus-tracks-stage", stage: /^bonus tracks$/i,
    reason: "Bonus Tracks stage: talks, activations and host sessions, not part of the historical lineup" },
  // Escape 2022 printed its silent disco as a whole stage ("DANSE MACABRE -
  // SILENT DISCO"); the Silent Disco ruling drops it as a stage too.
  { category: "operational", stage: /\bsilent disco\b/i,
    reason: "operational programming, not a billed performance" },
  // Escape 2024 printed its after-party (THE CAULDRON, 2AM-6AM) on a separate
  // "AFTER PARTY SET TIMES" graphic, after the festival's close.
  { category: "after-party", stage: /^after party\b/i,
    reason: "after-party: printed separately, after the festival's close, not part of the festival schedule" },
  { category: "operational", test: /^(fireworks|closing fireworks|(opening|closing) ceremony(:.*)?|silent disco( powered by .+)?|changeover)$/i,
    reason: "operational programming, not a billed performance" },
  // EDC Orlando's Kinetic Field prints its show between sets: intermezzos,
  // named interludes (2019 "NATURAL ENERGY", 2022 "GROW", "BLOSSOM") and the
  // closing segment. Scoped to that stage, so the same word elsewhere stays.
  { category: "show-segment", stage: /^kinetic ?field$/i,
    test: /^(intermezzo\b.*|kinetic (experience|celebration|bloom)\b.*|(natural|kinetic|industrial|spiritual) energy|grow|blossom|pollinate|closing)$/i,
    reason: "Kinetic Field show segment (an interlude, ceremony or fireworks printed between sets), not a billed performance" },
  // Electric Forest 2013 printed contest slots before their winners were
  // named ("Discovery Project Winner") and a "Secret Set".
  { category: "unnamed-slot", test: /^(special guest|surprise guest|secret guest|secret set|tba|to be announced|coming soon!*|discovery project winners?)$/i,
    reason: "unnamed slot: no performer was billed" },
  // A bare "Discovery Project" in a printed stage slot is the contest set
  // before its winner was named (EDC Orlando 2022, 2024). A lineup list's
  // stageless "Discovery Project" entry is left to the live lineup.
  { category: "unnamed-slot", stage: /\S/, test: /^discovery project$/i,
    reason: "unnamed slot: no performer was billed" },
];

// Stage names kept exactly as printed although a drop rule's words match them.
// In 2012 and 2013 Insomniac's lineup.php pages printed "Discovery Project" as
// a whole stage of named, billed DJs (Danny Avila, Dr. Fresch, Crizzly), not
// as an unnamed contest slot. Jake's ruling, 2026-11-10: keep the stage and
// its sets. Only the stage name is exempt: a bare "Discovery Project" billing
// is still an unnamed slot, on this stage or any other.
export const KEPT_STAGES = {
  "nocturnal-wonderland-2012": ["Discovery Project"],
  "nocturnal-wonderland-2013": ["Discovery Project"],
  "beyond-wonderland-socal-2013": ["Discovery Project"],
};

// Non-music activities (talks, bingo, drag shows, classes, food, podcast
// tapings, brand activations), billed exactly as printed. The Bonus Tracks
// stage rule already drops them where they were printed; this list keeps the
// billing itself out of an edition wherever it might reappear. Kids-stage
// acts are real billed acts and stay (including the named
// "SPECIAL GUEST: THE HAPPINESS CLUB").
export const ACTIVITIES = {
  "acl-2025": [
    "STRETCH BEFORE THE SET", "LOS TACOS DE ACL FEST", "JAPANESE BREAKFAST X SUPERMUSH", "LP GIOBBI X SUPERMUSH",
    "ANTONI POROWSKI ON FOOD & CONNECTION", "EXTRAGRAMS PRESENTS DRAG BINGO!", "CIRQUE DU SLAY: A DRAG SHOW!",
    "MIXED-TAPE: A DRAG SHOW!", "A CONVERSATION WITH LUCIUS", "MATTHEW MCCONAUGHEY X BRENÉ BROWN",
  ],
  // Printed on the official 2026 lineup list and the Beatbox set times, but a
  // class, not a set (the rule above: classes are activities).
  "beyond-wonderland-socal-2026": ["Line Dancing with The Redheaded Cowgirl"],
  "lollapalooza-2025": [
    "BOB'S DANCE SHOP", "THE BINGO-GO-GO", "THE SECOND CITY: COMEDY MIXTAPE VOL. 59",
    "KATSEYE INTERVIEW WITH DAVIS BURLESON", "HOW LONG GONE WITH THE DARE", "HOW LONG GONE WITH THE BEAR'S COREY HENDRIX",
  ],
};
// Billings whose non-Latin letters are the artist's own styling, as the
// festival's structured page printed them (not OCR). Each one was read on
// the archived page; the look-alike rule in validate.mjs still applies to
// every other billing and stage.
export const PRINTED_NON_LATIN = {
  "beyond-wonderland-socal-2026": ["Cntrl Alt DΞLΞTΞ"],
  // Read by eye on the official graphic (review/escape-halloween-2024.json).
  "escape-halloween-2024": ["DAKЯΣD"],
  // The duo's own Greek lambda, in the page's artist_data list.
  "edc-las-vegas-2016": ["Axwell Λ Ingrosso"],
  "edc-las-vegas-2017": ["Axwell Λ Ingrosso"],
  // The trio's own Greek lambda, as Coachella's 2012 lineup page prints it.
  "coachella-2012": ["NOISIΛ"],
};

const ACTIVITY_REASON = "non-music Bonus Tracks activity";

// Electric Forest's schedule printed its non-music programme in the same
// stage columns as the sets: classes, workshops, talks, its own hoop troupe
// and brand experiences. Billed exactly as printed; dropped like ACTIVITIES.
export const PROGRAMME = {
  "electric-forest-2012": ["Yoga with KK Ledford wildmoonwisdom", "Hula Hoop Workshop with Luna Breeze", "African Drum Workshop",
    "Storytelling with Wally Wojak", "Electric Forest Hoop Troupe Showcase", "Kyle Hollingsworth's Brewru Experience"],
  "electric-forest-2013": ["Love Bomb Yoga Flow with Mary Clare Sweet", "Magic Breath with Mary Clare Sweet", "Cosmic Con with Mary Clare Sweet",
    "Drum Workshop w/ Kodi", "Luna Breeze's Hula Hoop Workshop", "Hoop Troupe Showcase", "Bell's presents Kyle Hollingsworth's Brewru Experience",
    "Atmospheric Entertainment by Quixotic"],
};
const PROGRAMME_REASON = "non-music programming (a class, workshop, talk, showcase or brand experience), not a billed performance";

// Entries that print a whole curated event as one block: its title, then
// several acts and extras ("... Beach Bash / With Music From ... and Very
// Special Guests! / Featuring a Live Interactive Grafitti Wall"). No one act
// is the billing, and which names played is not sourced, so the block is
// not a set. (An event title billing one act is a billing ruling instead.)
export const EVENT_BLOCKS = {
  "electric-forest-2012": [
    "Elm & Oak and Paper Diamond Present The Wagon Wheel Beach Bash / / With Music From Two Fresh Raw Russ and Very Special Guests! / / Featuring a Live Interactive Grafitti Wall",
    "Prime Social Group Presents Unplugged at the Wagon Wheel Featuring Pierce Fulton and Special Guests With Sets By Tony Desaro, Attak & Karma and more TBA!",
    "Movement Electric Music Festival Presents a Detroit Dance Party Featuring: / / Chuck Flask & Keith Kemp / / Ataxia / / Secrets",
    "Wagon Wheel Closing Party Featuring / / Up Until Now / Human Agency / and THE UNSHEATHED!",
  ],
};
const EVENT_BLOCK_REASON = "a curated event printed as one block (an event title with several acts and extras), not one billed performance";

// Why a printed row (billing on stage) is dropped, or null if it is a set.
// Compared case-folded and by slug, so an id segment or a re-cased billing
// is caught too.
// A past edition's lineup page (no stage, no time) that prints a bare
// "Discovery Project" is the contest slot before its winner was named, as on
// a printed stage: in the library it is an unnamed slot. The live lineup's
// stageless entry stays (dropReason alone leaves it).
export function lineupDropReason(billing, stage = "") {
  return dropReason(billing, stage) || (!String(stage).trim() && /^discovery project$/i.test(String(billing).trim())
    ? { category: "unnamed-slot", reason: "unnamed slot: no performer was billed" } : null);
}

export function dropReason(billing, stage = "") {
  const name = String(billing).trim(), st = String(stage).trim();
  const hits = (re, x) => re.test(x) || re.test(x.replace(/-/g, " "));
  for (const r of DROP_RULES) if (r.stage && !r.test && hits(r.stage, st)) return { category: r.category, reason: r.reason };
  for (const r of DROP_RULES) if (r.test && (!r.stage || hits(r.stage, st)) && hits(r.test, name)) return { category: r.category, reason: r.reason };
  const k = slug(name);
  if (k && Object.values(ACTIVITIES).flat().some(a => slug(a) === k)) return { category: "activity", reason: ACTIVITY_REASON };
  if (k && Object.values(PROGRAMME).flat().some(a => slug(a) === k)) return { category: "activity", reason: PROGRAMME_REASON };
  if (k && Object.values(EVENT_BLOCKS).flat().some(a => slug(a) === k)) return { category: "event-block", reason: EVENT_BLOCK_REASON };
  return null;
}

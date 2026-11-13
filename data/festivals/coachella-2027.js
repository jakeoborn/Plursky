// ═══════════════════════════════════════════════════════════════════════
// COACHELLA 2027 — Empire Polo Club · Indio, CA
// Weekend 1: Fri Apr 9 – Sun Apr 11 · Weekend 2: Fri Apr 16 – Sun Apr 18
// ═══════════════════════════════════════════════════════════════════════
// LINEUP ONLY. The billing names and their days are official; stages, set
// times, gates, a 2027 map and sun times are NOT published and none are
// invented below. Gated (`available: false`) in this module's own PR; the
// activation is a separate PR.
//
// ── SOURCES (observed 2026-11-13T12:36:48Z) ──
// Raw capture, hashes and the full reasoning live OUTSIDE the public repo in
// the evidence packet: instinct/evidence/2026-11-13-coachella/RECEIPT.md.
//
// www.coachella.com/lineup loads an AEG widget. The live (non-comment)
// `#ww` element carries data-path="733/qMDjxOd3C81frFDt". ⛔ The page's HTML
// COMMENTS hold two obsolete paths (711/2g4uo3jiai93brm3,
// 733/KcW6PlMTrsLIEWCx); a first-regex-match scraper reads the wrong one.
//   artists.json  155 records, 155 unique titles  → the roster below
//   shows.json    312 records, two per artist over six dates
//   public widget A-Z (155 rows) and all six BY DAY tabs, rendered in Chrome
//
// ⛔ EVERY shows.json record is 10:00–10:30 at venue "Coachella". Those are
// the widget's placeholders, NOT set times or stages: nothing here reads
// them. Each act has stage:null and empty start/end until real times drop.
//
// ── HOW THE ROSTER WAS ACCEPTED ──
//   - name: the artist index `title`, verbatim (official display spelling,
//     co-billings kept whole: "Jakob Nowell and THE CASTLE" is one act).
//   - day: the feed's date, accepted only where the public BY DAY tab lists
//     the same name on that date. All 154 dated acts pass on all six tabs.
//   - weekend: every act appears on BOTH weekends, on the same weekday, in
//     the feed AND the public BY DAY view, and every poster block reads
//     "9 & 16" / "10 & 17" / "11 & 18". So no act carries a `weekend` tag;
//     actPlaysWeekend() treats an untagged act as playing both. A W1-only
//     or W2-only act, if one is ever announced, gets `weekend: "W1"|"W2"`.
//   - id: "coa27-" + the source slug; the source _id is on each line.
//
// Counts: 155 unique billings · 310 day appearances (155 × 2 weekends) ·
// Fri 54 / Sat 52 / Sun 48 / day pending 1. Two weekends never double the
// billing count: the same act is ONE id on both weekends.
//
// ── DISCREPANCIES ──
//   NOYA — in shows.json on Apr 9 and Apr 16 with object id `-1`, but not in
//     the artist index, the public A-Z, the public BY DAY or the poster.
//     EXCLUDED: only an internal feed row supports it, and `-1` is not an
//     identity. Re-check on the next capture. (The feed's Friday count of 55
//     is these 54 plus NOYA.)
//   Jakob Nowell and THE CASTLE — feed and public BY DAY say Sunday; the
//     poster prints it on the last line of the FRIDAY block. Two official
//     sources disagree, so `day: null` (the existing "Day TBA" state). Both
//     weekends are still confirmed.
//   Justice, "The Bunker Debut Of JUSTICE: BLINDED BY THE LIGHTS" — poster
//     footer only, not in the index or the feed: a presentation, not a
//     billing. Not imported.
//   "no na" is a separate Saturday act (poster and feed); not NOYA.
//
// ── DATES ──
// California is on PDT (UTC-7) from Mar 14, 2027. startMs/endMs and
// weekendStartMs are LOCAL MIDNIGHTS (day boundaries), not gate times: gates
// are unpublished. Apr 12–15 are not festival days: dayDates describe
// weekend one and _festivalEventDays() copies them by the W2 shift, so the
// gap is never "live".
(function () {
  "use strict";

  const STAGES = [];
  const AMENITIES = [];
  const mk = (id, name, day) => ({
    id, name, genre: "—", country: "—",
    stage: null, day, start: "", end: "", tier: 2,
    img: "linear-gradient(135deg, #4E6234, #44A1A4)",
    bio: "Playing Coachella 2027 on both weekends. " +
         (day == null ? "Day, stage and set time are not published yet."
                      : "Stage and set time are not published yet."),
    provisional: true,
  });

  const ARTISTS = [
    // ── FRIDAY · Apr 9 & 16 — 54 billings ──
    mk("coa27-american-football", "American Football", 1),  // src 01M74MNQ74957XSMV91XV8QKDF
    mk("coa27-angine-de-poitrine", "Angine De Poitrine", 1),  // src 01M74MNQ741VKV0HA6F7KYT8C4
    mk("coa27-atarashii-gakko", "ATARASHII GAKKO!", 1),  // src 01M74MNQ768YPGDTH0XZD1HEAG
    mk("coa27-bea-miller", "Bea Miller", 1),  // src 01M74MNQ77M7WP6PFHRV4VFSJ0
    mk("coa27-bella-kay", "Bella Kay", 1),  // src 01M74MNQ78N7NTRR1TEZRPY70C
    mk("coa27-chris-stassy-presents-linger-av", "CHRIS STASSY presents LINGER AV", 1),  // src 01M74MNQ7AREFVJ2PWDDV1HJAP
    mk("coa27-close-friends-only", "Close Friends Only", 1),  // src 01M74MNQ7AYV72QAW3TWRKA3ZK
    mk("coa27-daddy-yankee", "Daddy Yankee", 1),  // src 01M74MNQ7A9TFJQ0RA6QC44P2T
    mk("coa27-diljit-dosanjh", "Diljit Dosanjh", 1),  // src 01M74MNQ7BQSR4KW0VBDWANFV9
    mk("coa27-disco-dom", "Disco Dom", 1),  // src 01M74MNQ7BHCGAXVG5HE4Y5A3T
    mk("coa27-drain-gang", "Drain Gang", 1),  // src 01M74MNQ7ED2Z1QPGD7WSMZT1A
    mk("coa27-dua-lipa", "Dua Lipa", 1),  // src 01M74MNQ7EY02YXHQVFSMJZ43N
    mk("coa27-eli", "Eli", 1),  // src 01M74MNQ7FV0Y2CDD5PY4H4JTT
    mk("coa27-fetty-wap", "Fetty Wap", 1),  // src 01M74MNQ7GTSA4R687BZC1AZYF
    mk("coa27-franky-rizardo", "Franky Rizardo", 1),  // src 01M74MNQ7GP7YQVQNHTFDKEZZY
    mk("coa27-gang-of-youths", "Gang of Youths", 1),  // src 01M74MNQ7HF0H10F65TMM683A9
    mk("coa27-giorgio-moroder", "Giorgio Moroder", 1),  // src 01M74MNQ7HGWG90T7WNCYDHJJP
    mk("coa27-haute-and-freddy", "Haute & Freddy", 1),  // src 01M74MNQ7JX1EWJK84GJDMGBAD
    mk("coa27-jackie-hollander", "Jackie Hollander", 1),  // src 01M74MNQ7JMM0APSPKE92S1M7B
    mk("coa27-jacob-lusk", "Jacob Lusk", 1),  // src 01M74MNQ7JC3DFCJX038A5KPXH
    mk("coa27-jamback-x-marsolo", "Jamback x Marsolo", 1),  // src 01M74MNQ7J1Q9AATRH3FJEGK9W
    mk("coa27-jisoo", "JISOO", 1),  // src 01M74MNQ7KY858VZX8N2NNDDKC
    mk("coa27-kehlani", "Kehlani", 1),  // src 01M74MNQ7M3XZHY4WSA2P2Q5ER
    mk("coa27-kelela", "Kelela", 1),  // src 01M74MNQ7M8VRYEQGCK1B9G839
    mk("coa27-la-dispute", "La Dispute", 1),  // src 01M74MNQ7NEBNTC67HDFBDGHZ1
    mk("coa27-las-petunias", "Las Petunias", 1),  // src 01M74MNQ7N4KMV3JZDVPT1A8SH
    mk("coa27-leenalchi", "LEENALCHI", 1),  // src 01M74MNQ7P4P0Z2AX4HHCTV2WT
    mk("coa27-leon-thomas", "Leon Thomas", 1),  // src 01M74MNQ7P3GV00GPQE0RCNZ6D
    mk("coa27-love-spells", "Love Spells", 1),  // src 01M74MNQ7PSKFFNS72QJDGN4WW
    mk("coa27-madonna", "Madonna", 1),  // src 01M74MNQ7Q2RA6TQEG7R4YHDKC
    mk("coa27-mary-in-the-junkyard", "mary in the junkyard", 1),  // src 01M74MNQ7QY15W6WC1Q9EXYKKT
    mk("coa27-mike-d-5d", "Mike D 5D", 1),  // src 01M74MNQ7R1N0MX3JJWT721WH8
    mk("coa27-milo-j", "Milo J", 1),  // src 01M74MNQ7RFMMV0BYRJX2JS4G5
    mk("coa27-mph", "MPH", 1),  // src 01M74MNQ7R0T5YW2V8V4JGSGTE
    mk("coa27-nettspend", "Nettspend", 1),  // src 01M74MNQ7SDNXS5EMXKT41G381
    mk("coa27-nirosta-steel", "Nirosta Steel", 1),  // src 01M74MNQ7S9BJPPH7ZA7WQFZVY
    mk("coa27-obskur", "Obskür", 1),  // src 01M74MNQ7T70ZJH8DC0ZWNHVG8
    mk("coa27-peggy-gou", "Peggy Gou", 1),  // src 01M74MNQ7V98WDSEHZV9DGG1XD
    mk("coa27-pinegrove", "Pinegrove", 1),  // src 01M74MNQ7VQWVR40YTRHM0JKHG
    mk("coa27-rafael", "Rafael", 1),  // src 01M74MNQ7V80N0GMPX07FH6VP4
    mk("coa27-ragie-ban", "Ragie Ban", 1),  // src 01M74MNQ7VC3VEGDPPG5XGEHYS
    mk("coa27-sg-lewis", "SG Lewis", 1),  // src 01M74MNQ7WQQ842GK73E0SFSW0
    mk("coa27-snow-strippers", "Snow Strippers", 1),  // src 01M74MNQ7XNEPXKFB2FZH3MVGE
    mk("coa27-social-distortion", "Social Distortion", 1),  // src 01M74MNQ7XRGHCDW3JFWJ96V5G
    mk("coa27-solid-grooves", "Solid Grooves", 1),  // src 01M74MNQ7XT2VDPE96M9HJSR6A
    mk("coa27-steve-lacy", "Steve Lacy", 1),  // src 01M74MNQ86JNMJ1MNYF2BHBR9C
    mk("coa27-the-damned", "The Damned", 1),  // src 01M74MNQ87HBHT76YBMDFHTZ1P
    mk("coa27-the-hellp", "The Hellp", 1),  // src 01M74MNQ87SG34DZ8W4RXBEQNS
    mk("coa27-the-womack-sisters", "The Womack Sisters", 1),  // src 01M74MNQ88W3WPGXN0WVJDSYDN
    mk("coa27-this-is-lorelei", "This Is Lorelei", 1),  // src 01M74MNQ8832B8T0BNXGPJWWNN
    mk("coa27-vintage-culture", "Vintage Culture", 1),  // src 01M74MNQ8AMNVK082MXQJ3TN05
    mk("coa27-violet-grohl", "Violet Grohl", 1),  // src 01M74MNQ8AG5Q6TS0WE7NKYQN7
    mk("coa27-xaviersobased", "xaviersobased", 1),  // src 01M74MNQ8BF7RA0JK1ZQK0ENCC
    mk("coa27-zara-larsson", "Zara Larsson", 1),  // src 01M74MNQ8BYQJNYHE3W4YWW1TK
    // ── SATURDAY · Apr 10 & 17 — 52 billings ──
    mk("coa27-adela", "ADÉLA", 2),  // src 01M74MNQ728YJK119M179XRDZA
    mk("coa27-apollonia", "Apollonia", 2),  // src 01M74MNQ75QX6CP0K8HMG0XRQ7
    mk("coa27-bad-gyal", "Bad Gyal", 2),  // src 01M74MNQ76EYYWXBWJPM3QYDHE
    mk("coa27-barry-cant-swim", "Barry Can't Swim", 2),  // src 01M74MNQ77QBS71NFPSHR15S97
    mk("coa27-basement", "Basement", 2),  // src 01M74MNQ777G6QWR92PJQTRK23
    mk("coa27-bassvictim", "Bassvictim", 2),  // src 01M74MNQ77QENN862AD66J8G5K
    mk("coa27-beltran", "Beltran", 2),  // src 01M74MNQ781A5JKE1C93HZ5JYE
    mk("coa27-boy-harsher", "Boy Harsher", 2),  // src 01M74MNQ782WWZTWN87R6C9YJ0
    mk("coa27-brutalismus-3000", "Brutalismus 3000", 2),  // src 01M74MNQ796E7RZB8WTDJT65GE
    mk("coa27-charlotte-de-witte", "Charlotte de Witte", 2),  // src 01M74MNQ79HK071DDC53VX72AM
    mk("coa27-cloonee", "Cloonee", 2),  // src 01M74MNQ7A8TJM9R1EBQC1EE1Z
    mk("coa27-dream-boat", "Dream Boat", 2),  // src 01M74MNQ7E6CHWDWGZ2MVHM4PB
    mk("coa27-ear", "ear", 2),  // src 01M74MNQ7FCAZWWRAXANZ4AKMA
    mk("coa27-enigma", "Enigma", 2),  // src 01M74MNQ7F8BGTRE5H8MHS18CJ
    mk("coa27-first-day-back", "First Day Back", 2),  // src 01M74MNQ7GDKQGHVP0K65Z2WEA
    mk("coa27-getdown-services", "Getdown Services", 2),  // src 01M74MNQ7H1BR1P8W0RQP89B79
    mk("coa27-good-neighbours", "Good Neighbours", 2),  // src 01M74MNQ7H8A66ZNZJNPDPD1Y7
    mk("coa27-jimi-jules", "Jimi Jules", 2),  // src 01M74MNQ7KYKK65JSNGTMZHQMK
    mk("coa27-ki-ki", "KI/KI", 2),  // src 01M74MNQ7MN7XA9GMZ4B8EHHV6
    mk("coa27-kolter-x-sidney-charles", "Kolter x Sidney Charles", 2),  // src 01M74MNQ7NCDA5BFYR3JRERXPE
    mk("coa27-la-texana", "La Texana", 2),  // src 01M74MNQ7NCGZW90EY520MMKCA
    mk("coa27-leon-bridges", "Leon Bridges", 2),  // src 01M74MNQ7P6XYEWBW618DKGYP6
    mk("coa27-los-pibes-chorros", "Los Pibes Chorros", 2),  // src 01M74MNQ7P5JYYMXNVVAQYABJH
    mk("coa27-lusid", "LuSiD", 2),  // src 01M74MNQ7P8JXT5V3YAJF1CR39
    mk("coa27-magdalena-bay", "Magdalena Bay", 2),  // src 01M74MNQ7Q5BGRP115V0ADER67
    mk("coa27-mariah-the-scientist", "Mariah the Scientist", 2),  // src 01M74MNQ7QHTST1GWGGH6RRQ74
    mk("coa27-martin-garrix", "Martin Garrix", 2),  // src 01M74MNQ7RAPVCD5Y5ZCS3XMSN
    mk("coa27-mathame", "Mathame", 2),  // src 01M74MNQ7RQ7XZAH2XW38N3XSY
    mk("coa27-murda-beatz", "Murda Beatz", 2),  // src 01M74MNQ7SHY2XVM633F4NNPRR
    mk("coa27-maneskin", "Måneskin", 2),  // src 01M74MNQ7QFFVPM6JG36TCVW8X
    mk("coa27-nct", "NCT", 2),  // src 01M74MNQ7SV802EMKBNNM9M6WE
    mk("coa27-no-na", "no na", 2),  // src 01M74MNQ7S45G1S6J4WKSJZQB8
    mk("coa27-odeal", "Odeal", 2),  // src 01M74MNQ7TYA6YX0VGFWMY9JCF
    mk("coa27-omri", "OMRI.", 2),  // src 01M74MNQ7T14B0G4AGEDSSC55C
    mk("coa27-phoebe-bridgers", "Phoebe Bridgers", 2),  // src 01M74MNQ7V7JGGW0KM43D5RBHH
    mk("coa27-robyn", "Robyn", 2),  // src 01M74MNQ7W04SPTDJ0HJNRWE7N
    mk("coa27-role-model", "Role Model", 2),  // src 01M74MNQ7WJCHFC1DE5633775R
    mk("coa27-rommulas", "rommulas", 2),  // src 01M74MNQ7W3QXFQN08BFA5NS19
    mk("coa27-sb19", "SB19", 2),  // src 01M74MNQ7W8QW1Z9FENSJNVYYE
    mk("coa27-solomun", "Solomun", 2),  // src 01M74MNQ86XE4Q3GMZ07XHDHAG
    mk("coa27-tame-impala", "Tame Impala", 2),  // src 01M74MNQ87P4STERFGR3RXV7PN
    mk("coa27-tiffany-day", "Tiffany Day", 2),  // src 01M74MNQ88CCSK8E66F429Y9RN
    mk("coa27-tiesto", "Tiësto", 2),  // src 01M74MNQ87VYTS5SCJ0AJJBC7D
    mk("coa27-twin-tribes", "Twin Tribes", 2),  // src 01M74MNQ897FDQ0JHQPXV7XP4B
    mk("coa27-twisted-teens", "Twisted Teens", 2),  // src 01M74MNQ89660CX7R4K75NEBXK
    mk("coa27-underscores", "underscores", 2),  // src 01M74MNQ894THYV9K53V9B3HA9
    mk("coa27-underworld", "Underworld", 2),  // src 01M74MNQ89BZESM53Y9R4TF605
    mk("coa27-vandelux", "Vandelux", 2),  // src 01M74MNQ8A57AENZS7HTPATCAT
    mk("coa27-villanelle", "Villanelle", 2),  // src 01M74MNQ8AE44XDEJ8ANN2PF3R
    mk("coa27-volkoder", "Volkoder", 2),  // src 01M74MNQ8BR3ZMVDTK14A0EEXB
    mk("coa27-weezer", "Weezer", 2),  // src 01M74MNQ8BPGTWZ3DX5FGP7QC9
    mk("coa27-zimmer90", "Zimmer90", 2),  // src 01M74MNQ8BSR83NKV9G0NFS11T
    // ── SUNDAY · Apr 11 & 18 — 48 billings ──
    mk("coa27-adam-ten", "Adam Ten", 3),  // src 01M74MNQ70ZV00N2SYMTC3J95R
    mk("coa27-after", "After", 3),  // src 01M74MNQ7352D2AMX3NBM6RG7R
    mk("coa27-akriila", "AKRIILA", 3),  // src 01M74MNQ736YAK9N2WWQP80397
    mk("coa27-amelie-lens-x-sara-landry", "Amelie Lens x Sara Landry", 3),  // src 01M74MNQ74PAGCMYQ0YJ0V9RCJ
    mk("coa27-ayra-starr", "Ayra Starr", 3),  // src 01M74MNQ7691XC15M8N152AACB
    mk("coa27-babymonster", "BABYMONSTER", 3),  // src 01M74MNQ769M9PTNVRF6YMAT25
    mk("coa27-becky-g", "Becky G", 3),  // src 01M74MNQ77P8Z6N803KBSXEMNB
    mk("coa27-bolo", "BOLO", 3),  // src 01M74MNQ78VZ3RX323N74VFKPQ
    mk("coa27-boris-brejcha", "Boris Brejcha", 3),  // src 01M74MNQ78HVYPV4SXV5VHEC9T
    mk("coa27-caroline-polachek", "Caroline Polachek", 3),  // src 01M74MNQ79TM9RJ61C0SAP3RQH
    mk("coa27-chanel-beads", "Chanel Beads", 3),  // src 01M74MNQ79N05QHTVS2SKN6N00
    mk("coa27-chase-and-status", "Chase & Status", 3),  // src 01M74MNQ7951M2DE4YSZ8MD2VG
    mk("coa27-chasewest", "ChaseWest", 3),  // src 01M74MNQ7AMBX9K9906WDJYMRE
    mk("coa27-dinner-party", "Dinner Party", 3),  // src 01M74MNQ7BSSGAM7JAPSRJYNF4
    mk("coa27-dj-habibeats", "DJ Habibeats", 3),  // src 01M74MNQ7B8BGAWJN57BWKQ9JK
    mk("coa27-dom-dolla", "DOM DOLLA", 3),  // src 01M74MNQ7DYC56EXPKQXNDP6XD
    mk("coa27-don-toliver", "Don Toliver", 3),  // src 01M74MNQ7ER7Q4HN9XTPEMWX2Z
    mk("coa27-empire-of-the-sun", "Empire of the Sun", 3),  // src 01M74MNQ7FK9W9YEFZSSSQ20QG
    mk("coa27-esdeekid", "EsDeeKid", 3),  // src 01M74MNQ7F4DCDG0YY64ZY26S7
    mk("coa27-fat-dog", "Fat Dog", 3),  // src 01M74MNQ7FV4C92N4KM9TTKKSM
    mk("coa27-florence-road", "Florence Road", 3),  // src 01M74MNQ7GXV5F93RV5YQ25QGR
    mk("coa27-four-tet", "Four Tet", 3),  // src 01M74MNQ7GGXRJQ8FFJF56ZC86
    mk("coa27-freddie-gibbs", "Freddie Gibbs", 3),  // src 01M74MNQ7H6ZY6ZZ2GFF8BY36M
    mk("coa27-genesis-owusu", "Genesis Owusu", 3),  // src 01M74MNQ7HW2PMRCRVAREDK956
    mk("coa27-jazzy", "Jazzy", 3),  // src 01M74MNQ7K3PYBVH8Y8KPSX2EN
    mk("coa27-jorja-smith", "Jorja Smith", 3),  // src 01M74MNQ7KAJASJDYGXGYAA1AD
    mk("coa27-joshua-slone", "Joshua Slone", 3),  // src 01M74MNQ7K3T618862DG4H99AD
    mk("coa27-julia-wolf", "Julia Wolf", 3),  // src 01M74MNQ7MY1QTB6CTF36EX000
    mk("coa27-klave-efectiva", "Klave Efectiva", 3),  // src 01M74MNQ7M9K8QY9MTZGHX3CB6
    mk("coa27-kygo", "Kygo", 3),  // src 01M74MNQ7N4TDYDQCPPCSY0HD3
    mk("coa27-lambrini-girls", "Lambrini Girls", 3),  // src 01M74MNQ7N1WXMSM821BZ24JEE
    mk("coa27-marten-lou-x-alex-wann", "Marten Lou x Alex Wann", 3),  // src 01M74MNQ73QJGYHZXTQ0C2TAGA
    mk("coa27-muna", "MUNA", 3),  // src 01M74MNQ7SE7H5D78Z4R4W2XGA
    mk("coa27-odd-mob", "Odd Mob", 3),  // src 01M74MNQ7T25SP3WGZ6PWRZKEQ
    mk("coa27-omar", "Omar+", 3),  // src 01M74MNQ7T05M6EDXGQDAYR2FB
    mk("coa27-pennywise", "Pennywise", 3),  // src 01M74MNQ7VBGND5ZJ56RX9989X
    mk("coa27-remi-wolf", "Remi Wolf", 3),  // src 01M74MNQ7W2DRXMZ3D1S2ZKH69
    mk("coa27-shygirl", "Shygirl", 3),  // src 01M74MNQ7XGXDCVPFVT9GHHNEN
    mk("coa27-silva-bumpa", "Silva Bumpa", 3),  // src 01M74MNQ7XJFXBF4FDFY3PR1ZP
    mk("coa27-sza", "SZA", 3),  // src 01M74MNQ86Y5SD6KKVZGJE91JH
    mk("coa27-talon", "Talón", 3),  // src 01M74MNQ87S30HSGBQ1964C6TA
    mk("coa27-the-avalanches", "The Avalanches", 3),  // src 01M74MNQ87H33YNQ3J7D4SZ2YA
    mk("coa27-the-mainliners", "The Mainliners", 3),  // src 01M74MNQ88Q7ED4RWEWHKW8Q9E
    mk("coa27-the-neighbourhood", "The Neighbourhood", 3),  // src 01M74MNQ88BDYS6AXPWV0KMWX0
    mk("coa27-tove-lo", "Tove Lo", 3),  // src 01M74MNQ894M981P80PMXMGYEE
    mk("coa27-tul8te", "TUL8TE", 3),  // src 01M74MNQ89YQ6E61H4E0GAPNFF
    mk("coa27-victoria-monet", "Victoria Monét", 3),  // src 01M74MNQ8A5SQFAEF024V9FXHB
    mk("coa27-zack-fox", "Zack Fox", 3),  // src 01M74MNQ8B3DK8HNP8KD1N7RKQ
    // ── DAY PENDING (see header) — 1 billings ──
    mk("coa27-jakob-nowell-and-the-castle", "Jakob Nowell and THE CASTLE", null),  // src 01M74MNQ7J9HQ3WRXW22J3TFJ4
  ];

  const PDT = 7;  // hours behind UTC in April 2027
  const CONFIG = {
    id: "coachella-2027",
    lineupSource: { url: "https://www.coachella.com/lineup", observedAt: "2026-11-13", official: true },
    officialEvent: { website: "https://www.coachella.com/", observedAt: "2026-11-13" },
    // The festival's OWN maps page (2026 venue map + directions, parking,
    // camping). Link the page; never hotlink or re-host the images. There is
    // no 2027 map.
    mapSource: { url: "https://www.coachella.com/maps", observedAt: "2026-09-24", mapYear: 2026 },
    name: "Coachella 2027",
    shortName: "Coachella",
    brand: "Coachella",
    tagline: "Two weekends, one polo field",
    location: "Empire Polo Club · Indio, CA",
    locationShort: "Indio",
    dates: "Apr 9–11 & 16–18, 2027",
    year: 2027,
    // Night Print accent: the festival's own first-party colour (ledger: scripts/test-night-print.mjs)
    print: { accent: "#4E6234", accent2: "#44A1A4", source: { url: "https://media.coachella.com/templates/template10c/css/style.v7.css?t=7522fab35e14c254d8ced93290f5922c", observedAt: "2026-10-09", seenAs: "Site stylesheet token `html { --color-green-2:#4e6234 }`; the default `.c-button` background is an image, `--_button-bg:url(.../coachella-2026/button-bg-green.webp)`, whose sampled mean colour is #496330 (modal bucket #405828), matching that token; page headers use a teal gradient #337190 -> #44a1a4 -> #85cfc4 and link hover is `--color-yellow-1:#ffab37`.", confidence: "medium" }, note: "No <meta theme-color> and the 2026 site spreads a 20-colour palette across gradients, so the primary button's olive green is the accent, identified by sampling the button image (sips -> BMP, 27,078 opaque pixels) and matching it to the nearest first-party token." },
    startMs: Date.UTC(2027, 3, 9, PDT, 0, 0),    // Fri Apr 9 00:00 local
    endMs:   Date.UTC(2027, 3, 19, PDT, 0, 0),   // Mon Apr 19 00:00 local (end of Sun Apr 18)
    weekendStartMs: {
      W1: Date.UTC(2027, 3, 9, PDT, 0, 0),
      W2: Date.UTC(2027, 3, 16, PDT, 0, 0),
    },
    tz: "America/Los_Angeles",
    tzAbbr: "PDT",
    utcOffsetHours: -PDT,
    dayDates: {
      1: { y: 2027, m: 3, d: 9,  name: "Friday",   short: "FRI", midnightUtc: Date.UTC(2027, 3, 9,  PDT, 0, 0) },
      2: { y: 2027, m: 3, d: 10, name: "Saturday", short: "SAT", midnightUtc: Date.UTC(2027, 3, 10, PDT, 0, 0) },
      3: { y: 2027, m: 3, d: 11, name: "Sunday",   short: "SUN", midnightUtc: Date.UTC(2027, 3, 11, PDT, 0, 0) },
    },
    venue: {
      name: "Empire Polo Club",
      address: "Indio, CA",
      terrain: "polo fields, outdoors",
    },
    weatherEndpoint: null,
    mainStageId: null,
    mapMode: "real",
    mapPrintsStageNames: false,
    mapArtIsGeoregistered: false,
    setTimesProvisional: true,
  };

  window.PLURSKY_FESTIVALS = window.PLURSKY_FESTIVALS || {};
  window.PLURSKY_FESTIVALS["coachella-2027"] = {
    config: CONFIG, stages: STAGES, artists: ARTISTS, amenities: AMENITIES,
    // Gated: this PR adds the data only. Opening it is the activation PR.
    registry: { available: false, scheduleTBA: true, accent: "#ec4899", emoji: "🌵", region: "North America" },
  };
})();

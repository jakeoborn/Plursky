// Which artists get a public page at /artists/<key>/ (artist repository spec
// §6.2), as one rule shared by the two generators that need it:
// gen-artist-pages.mjs writes the pages, and gen-festival-pages.mjs links each
// lineup name to its page. One predicate, so a festival page can never link a
// page that was not generated, and neither generator reads the other's output
// off disk (which would make the two depend on the order they were run in).
//
// careers.json billing row: [id, festIdx, date, stage, start, end, setTag, role,
//   closing, mainStage, partners, published, openEnd, liveId, date2?]

// Indexed: a timed 2026 set, or billings in two or more editions. Collisions
// under review get no page.
export function pageEligible(a, festivals) {
  if (!a || a.pending) return { ok: false, why: 'under review' };
  const timed26 = a.b.some(r => festivals[r[1]]?.year === 2026 && r[4]);
  const editions = new Set(a.b.map(r => festivals[r[1]]?.id)).size;
  return timed26 || editions >= 2 ? { ok: true } : { ok: false, why: 'one edition, no timed 2026 set' };
}

export function artistPageKeys(careers) {
  return Object.keys(careers.artists).sort().filter(k => pageEligible(careers.artists[k], careers.festivals).ok);
}

// A live billing's id is "<festivalId>:<actId>". For one festival, map each act
// id to the artist keys billed on it, keeping only keys that have a page.
export function performersByAct(careers, festivalId, onSite) {
  const out = new Map(), pre = `${festivalId}:`;
  for (const k of onSite) for (const r of careers.artists[k].b) {
    if (!r[0].startsWith(pre)) continue;
    const act = r[0].slice(pre.length);
    if (!out.has(act)) out.set(act, new Set());
    out.get(act).add(k);
  }
  return out;
}

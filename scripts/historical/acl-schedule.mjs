// acl-schedule.mjs — the official aclfestival.com schedule grid (2013-2019),
// as archived by the Wayback Machine, into rows.
//
// The grid prints each set's range with NO am/pm ("6:15-7:15"). The page does
// print a meridiem, on its own hour axis ("11:00am" … "10:00pm"), and it
// places every set block on that axis (`top`, `height` in em). So each start's
// meridiem is READ OFF THE SAME PAGE, never guessed (ruling A, 2026-11-04):
//
//   1. the axis must print a meridiem on every label, one hour apart;
//   2. the page's scale (em per minute) comes from the blocks themselves:
//      height ÷ printed duration, which no meridiem changes;
//   3. a start is the one reading (h, or h + 12) whose minutes past the
//      axis's first label match the block's `top` within TOLERANCE_MIN.
//
// If the axis is missing or prints no meridiem, or no reading (or both) fits,
// that DAY is untimed: every row keeps its printed range in `printed` and
// gets blank start/end (`meridiem: null`). Never "obviously evening".

const plain = s => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&#0?39;|&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘")
  .replace(/&quot;|&#8220;|&#8221;/g, "\"").replace(/&#8211;|&ndash;/g, "–").replace(/&nbsp;|&#160;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/\s+/g, " ").trim();

export const TOLERANCE_MIN = 5;

// "11:00am", "11:00 am", "01:00 pm" → minutes after midnight, or null.
export function axisMinutes(label) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i.exec(label.trim());
  if (!m) return null;
  return ((+m[1] % 12) + (m[3].toLowerCase() === "p" ? 12 : 0)) * 60 + +m[2];
}

// The axis is valid only if every label prints a meridiem and they step 1 h.
export function readAxis(labels) {
  const mins = labels.map(axisMinutes);
  if (!mins.length || mins.some(m => m === null)) return null;
  for (let i = 1; i < mins.length; i++) if (mins[i] - mins[i - 1] !== 60) return null;
  return { start: mins[0], labels };
}

const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m ? [+m[1], +m[2]] : null; };
const fmt = min => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Both 24h readings of a printed clock time with no meridiem.
const readings = ([h, m]) => [...new Set([(h % 12) * 60 + m, ((h % 12) + 12) * 60 + m])];

// One weekend page → { tabs: [{date, weekday, label}], days: [{date, axis, scale, timed, sets}] }.
export function parseAclSchedule(html) {
  const tabs = [...html.matchAll(/data-value="([a-z]+)-(\d{4}-\d{2}-\d{2})"[^>]*>([^<]+)</g)]
    .map(m => ({ weekday: m[1], date: m[2], label: plain(m[3]) }))
    .filter((t, i, a) => a.findIndex(x => x.date === t.date) === i);
  // Stage names: the header cell (2013 <li>, 2014-15 <th>, 2016-19 <option>).
  const stageOf = new Map();
  for (const m of html.matchAll(/data-target(?:-column)?="#(?:schedule-column-)?date-[a-z]+-(\d{4}-\d{2}-\d{2})-location-(\d+)"[^>]*>([\s\S]*?)<\/(?:li|th|option)>/g)) {
    const key = `${m[1]}|${m[2]}`;
    // The stage is the header's main text; a sponsor sub-title printed under it
    // ("presented by Lifeway") is kept apart, as ACL 2025's rows do.
    // 2017-19 print it inside the header text itself; the same split applies.
    const main = m[3].split(/<span|<br/i)[0];
    const [, name, sponsor] = /^(.*?)(?:\s+(presented by .*))?$/i.exec(plain(main));
    if (!stageOf.has(key)) stageOf.set(key, { name, sub: [sponsor, plain(m[3].slice(main.length))].filter(Boolean).join(" ") || null });
  }
  const axes = [...html.matchAll(/<ol class="(?:c-)?schedule__timeslots">([\s\S]*?)<\/ol>/g)]
    .map(m => ({ at: m.index, axis: readAxis([...m[1].matchAll(/<span>([^<]+)<\/span>/g)].map(x => x[1])) }));
  const cols = [...html.matchAll(/<(?:td|div) id="(?:schedule-column-)?date-[a-z]+-(\d{4}-\d{2}-\d{2})-location-(\d+)"/g)];
  const raw = [];
  cols.forEach((c, i) => {
    const seg = html.slice(c.index, cols[i + 1]?.index ?? html.length);
    const axisAt = axes.filter(a => a.at < c.index).pop();
    const blocks = seg.split(/<div class="(?:session-wrapper|o-session)" style="/).slice(1);
    for (const b of blocks) {
      const top = /^top:\s*([\d.]+)em/.exec(b)?.[1];
      const height = /class="(?:session|o-session__inner)"[^>]*style="height:\s*([\d.]+)em/.exec(b)?.[1];
      const title = /<p class="(?:o-)?session__title[^"]*">([\s\S]*?)<\/p>/.exec(b)?.[1];
      const time = /<p class="(?:o-)?session__time">([\s\S]*?)<\/p>/.exec(b)?.[1];
      if (title === undefined || time === undefined) continue;
      const st = stageOf.get(`${c[1]}|${c[2]}`);
      // 2014's final W2 page marks a set it cancelled inside the billing.
      const billed = plain(title), canceled = /^\*canceled\*\s*/i.test(billed);
      raw.push({ date: c[1], location: c[2], stage: st?.name ?? null, stageSub: st?.sub ?? null,
        artist: billed.replace(/^\*canceled\*\s*/i, ""), ...(canceled && { canceled: true }),
        printed: plain(time), top: top === undefined ? null : +top, height: height === undefined ? null : +height,
        axis: axisAt?.axis ?? null });
    }
  });
  // Page scale: a least-squares fit of block height = scale × printed duration
  // + a constant border (the duration needs no meridiem). Needs two distinct
  // durations; otherwise there is no scale and every day is untimed.
  const pts = raw.map(r => {
    const [a, z] = r.printed.split(/\s*[-–]\s*/).map(hm);
    if (!a || !z || r.height === null) return null;
    let d = (z[0] * 60 + z[1]) - (a[0] * 60 + a[1]);
    while (d <= 0) d += 12 * 60;
    return [d, r.height];
  }).filter(Boolean);
  const n = pts.length, sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
  const sxx = pts.reduce((s, p) => s + p[0] * p[0], 0), sxy = pts.reduce((s, p) => s + p[0] * p[1], 0);
  const den = n * sxx - sx * sx;
  const scale = n >= 2 && den > 0 ? (n * sxy - sx * sy) / den : null;
  const days = [...new Set(raw.map(r => r.date))].map(date => {
    const rows = raw.filter(r => r.date === date);
    const sets = rows.map(r => {
      const [a, z] = r.printed.split(/\s*[-–]\s*/).map(hm);
      if (!r.axis || !scale || r.top === null || !a || !z) return { ...r, start: "", end: "", meridiem: null };
      const at = r.axis.start + r.top / scale;
      // A block placed outside the printed axis proves nothing about its time.
      if (at < r.axis.start - TOLERANCE_MIN || at > r.axis.start + r.axis.labels.length * 60 + TOLERANCE_MIN)
        return { ...r, start: "", end: "", meridiem: null, offAxis: true };
      const fits = readings(a).filter(min => Math.abs(min - at) <= TOLERANCE_MIN);
      if (fits.length !== 1) return { ...r, start: "", end: "", meridiem: null };
      const start = fits[0];
      let end = (z[0] % 12) * 60 + z[1];
      while (end <= start) end += 12 * 60;
      return { ...r, start: fmt(start), end: fmt(end), meridiem: "axis", offsetMin: Math.round((at - start) * 10) / 10 };
    });
    // An off-axis block that repeats an on-axis block of the same column
    // (same billing, same printed range) is a duplicate, reported apart.
    const dupOf = s => s.offAxis && sets.some(o => o !== s && o.meridiem === "axis" && o.location === s.location
      && o.artist === s.artist && o.printed === s.printed);
    const duplicates = sets.filter(dupOf), kept = sets.filter(s => !dupOf(s));
    // Any other unreadable row makes the whole day untimed: a day is read on one axis.
    const timed = kept.every(s => s.meridiem === "axis");
    return { date, axis: rows[0]?.axis ?? null, timed, duplicates,
      sets: timed ? kept : kept.map(s => ({ ...s, start: "", end: "", meridiem: null })) };
  });
  return { tabs, scale, days };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  for (const f of process.argv.slice(2)) {
    const p = parseAclSchedule(readFileSync(f, "utf8"));
    console.log(`▸ ${f}: scale ${p.scale?.toFixed(4)} em/min · tabs ${p.tabs.map(t => t.label).join(" / ")}`);
    for (const d of p.days) {
      const worst = Math.max(...d.sets.map(s => Math.abs(s.offsetMin ?? 0)));
      for (const x of d.duplicates) console.log(`    duplicate off-axis block: ${x.stage} ${x.printed} ${x.artist} (top ${x.top}em)`);
      console.log(`  ${d.date}: ${d.sets.length} sets · axis ${d.axis?.labels[0]}…${d.axis?.labels.at(-1)} · ${d.timed ? `timed (worst offset ${worst} min)` : "UNTIMED"}`);
    }
  }
}

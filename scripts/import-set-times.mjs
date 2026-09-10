// import-set-times.mjs — fill a festival's SCHEDULE block from its OFFICIAL
// schedule, transcribed into a sheet, with every row validated before a byte
// is written.
//
// Why a sheet and a script: a flip is 50–220 acts of stage + start + end read
// off the festival's own app or schedule graphic, and the Q4 queue alone is
// ~640 rows. By hand that is hundreds of edits with nothing checking them.
// Here each row must match exactly one act on its own day, name a real stage,
// carry real times, and not overlap its neighbour on the same stage — or
// nothing is written.
//
//   node scripts/import-set-times.mjs <festival-id> <sheet.tsv> --source <official-url>
//        [--check] [--file data.jsx] [--stage "Printed Stage Name=stageId"]...
//
// Sheet: TSV or CSV, header row naming these columns (any order, any case):
//   day     1..N, or the day's label/name as the config has it ("FRI", "Friday")
//   stage   the stage as printed; matched to the stage id, name or short, also
//           with a leading "The" / trailing "Stage" dropped ("Grove Stage" =
//           "The Grove"). Anything else needs an explicit --stage alias.
//   start   "21:30", "9:30 PM", "9:30pm"
//   end     same. Before 08:00 is after midnight (the app-wide toNightMin rule).
//   artist  the act as printed — ONE act per row, co-billings verbatim.
//
// The target file must carry, inside the object literal the festival's act
// factory reads (LL_SCHEDULE in data.jsx is the model):
//   // SCHEDULE:BEGIN <festival-id>
//   // SCHEDULE:END
// Acts the sheet does not mention keep stage null and blank times. TBA is a
// real answer: they are listed, not failed. --check validates and writes nothing.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const VALUED = ["--file", "--stage", "--source"];
const flag  = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const flags = k => argv.flatMap((a, i) => a === k ? [argv[i + 1]] : []);
const [fid, sheetPath] = argv.filter((a, i) => !a.startsWith("--") && !VALUED.includes(argv[i - 1]));
const CHECK  = argv.includes("--check");
const target = path.resolve(root, flag("--file") || "data.jsx");
const source = flag("--source");
const die = (msg, code = 1) => { console.error(`✗ ${msg}`); process.exit(code); };
if (!fid || !sheetPath)
  die('usage: node scripts/import-set-times.mjs <festival-id> <sheet.tsv> --source <official-url> [--check] [--file data.jsx] [--stage "Name=id"]', 2);
if (!CHECK && !/^https?:\/\//.test(source || ""))
  die("--source <official schedule URL> is required to write — every row must trace to the festival's own schedule", 2);

// ── The lineup, loaded exactly as gen-festival-pages loads it ─────────────
const ctx = { window: {}, console, Date, Math, JSON, Object, Array, String, Number, isNaN, parseInt, parseFloat,
  fetch: () => {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(ctx);
const modules = readdirSync(path.join(root, "data", "festivals")).filter(f => f.endsWith(".js")).sort()
  .map(f => readFileSync(path.join(root, "data", "festivals", f), "utf8")).join("\n");
vm.runInContext(modules + "\n" + readFileSync(path.join(root, "data.jsx"), "utf8") + "\n;__out = _DATA_SETS;", ctx);
const ds = ctx.__out[fid];
if (!ds) die(`unknown festival id: ${fid}`, 2);

// ── Normalisers ───────────────────────────────────────────────────────────
// Names compare on letters and digits only, so "Calcium b2b Mad Dubz" and
// "CALCIUM B2B MAD DUBZ" meet. Both sides go through the same function, and
// two acts that collide on one day are refused below rather than guessed.
const norm = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const stageKey = s => norm(String(s ?? "").replace(/^\s*the\s+/i, "").replace(/\s+stage\s*$/i, ""));
function hhmm(raw) {
  const s = String(raw ?? "").trim();
  const m12 = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?$/i.exec(s);
  if (m12) {
    const h = (+m12[1] % 12) + (/p/i.test(m12[3]) ? 12 : 0), mi = +(m12[2] || 0);
    if (+m12[1] > 12 || mi > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m24 || +m24[1] > 23 || +m24[2] > 59) return null;
  return `${m24[1].padStart(2, "0")}:${m24[2]}`;
}
const nightMin = t => { const [h, m] = t.split(":").map(Number); return (h < 8 ? h + 24 : h) * 60 + m; };
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

// ── The sheet ─────────────────────────────────────────────────────────────
function parseRows(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = line => {
    if (delim === "\t") return line.split("\t").map(c => c.trim());
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    out.push(cur.trim()); return out;
  };
  const head = split(lines[0]).map(h => h.toLowerCase());
  const need = ["day", "stage", "start", "end", "artist"];
  const missing = need.filter(k => !head.includes(k));
  if (missing.length) die(`sheet header lacks ${missing.join(", ")} (has: ${head.join(", ")})`, 2);
  return lines.slice(1).map((l, i) => {
    const cells = split(l); const row = { ln: i + 2 };
    need.forEach(k => { row[k] = cells[head.indexOf(k)] ?? ""; });
    return row;
  });
}
const rows = parseRows(readFileSync(path.resolve(sheetPath), "utf8"));

// ── Lookups built from the festival itself ────────────────────────────────
const dayOf = new Map();
for (const [n, d] of Object.entries(ds.config.dayDates || {})) {
  dayOf.set(String(n), +n);
  if (d.short) dayOf.set(norm(d.short), +n);
  if (d.name)  dayOf.set(norm(d.name), +n);
}
const stageOf = new Map();
for (const s of ds.stages) for (const v of [s.id, s.name, s.short]) if (v) stageOf.set(stageKey(v), s.id);
for (const spec of flags("--stage")) {
  const [k, v] = String(spec).split("=");
  if (!ds.stages.some(s => s.id === v)) die(`--stage "${spec}": ${fid} has no stage id "${v}"`, 2);
  stageOf.set(stageKey(k), v);
}
const actOf = new Map(), errors = [];
for (const a of ds.artists) {
  const k = `${a.day}|${norm(a.name)}`;
  if (actOf.has(k)) errors.push(`lineup: "${a.name}" and "${actOf.get(k).name}" normalise to the same key on day ${a.day}`);
  actOf.set(k, a);
}

// ── Validate every row ────────────────────────────────────────────────────
const sched = new Map();                              // id → { stage, start, end, name, day }
for (const r of rows) {
  const at = `row ${r.ln} "${r.artist}"`;
  const day = dayOf.get(String(r.day).trim()) ?? dayOf.get(norm(r.day));
  const stage = stageOf.get(stageKey(r.stage));
  const start = hhmm(r.start), end = hhmm(r.end);
  if (!r.artist) { errors.push(`row ${r.ln}: no artist`); continue; }
  if (!day) errors.push(`${at}: day "${r.day}" is not one of ${[...new Set(dayOf.values())].join("/")} or their labels`);
  if (!stage) errors.push(`${at}: stage "${r.stage}" matches none of ${ds.stages.map(s => s.id).join(", ")} — add --stage "${r.stage}=<id>"`);
  if (!start || !end) errors.push(`${at}: unreadable time "${r.start}" – "${r.end}"`);
  else if (nightMin(end) <= nightMin(start)) errors.push(`${at}: ends ${end} at or before it starts ${start}`);
  if (!day) continue;
  const act = actOf.get(`${day}|${norm(r.artist)}`);
  if (!act) {
    const elsewhere = ds.artists.filter(a => norm(a.name) === norm(r.artist)).map(a => a.day);
    if (elsewhere.length) { errors.push(`${at}: the lineup has this act on day ${elsewhere.join("/")}, not day ${day}`); continue; }
    const near = ds.artists.filter(a => a.day === day)
      .map(a => [a.name, lev(norm(a.name), norm(r.artist))]).filter(([, d]) => d <= 3).sort((x, y) => x[1] - y[1]).slice(0, 3);
    errors.push(`${at}: not in the day-${day} lineup${near.length ? ` — did you mean ${near.map(n => `"${n[0]}"`).join(" or ")}?` : ""}`);
    continue;
  }
  if (sched.has(act.id)) { errors.push(`${at}: a second row for the same act`); continue; }
  if (stage && start && end) sched.set(act.id, { stage, start, end, name: act.name, day });
}

// No two sets on one stage at once. Back-to-back (end == next start) is fine.
const byStage = new Map();
for (const [id, s] of sched) { const k = `${s.day}|${s.stage}`; if (!byStage.has(k)) byStage.set(k, []); byStage.get(k).push({ id, ...s }); }
for (const [k, list] of byStage) {
  list.sort((a, b) => nightMin(a.start) - nightMin(b.start));
  for (let i = 1; i < list.length; i++)
    if (nightMin(list[i].start) < nightMin(list[i - 1].end))
      errors.push(`overlap on ${k.replace("|", " / stage ")}: "${list[i - 1].name}" ${list[i - 1].start}–${list[i - 1].end} and "${list[i].name}" ${list[i].start}–${list[i].end}`);
}

const unscheduled = ds.artists.filter(a => !sched.has(a.id));
console.log(`▸ ${fid}: ${rows.length} sheet row(s) → ${sched.size} of ${ds.artists.length} act(s) scheduled`);
if (unscheduled.length)
  console.log(`  · ${unscheduled.length} act(s) not in the sheet keep TBA: ${unscheduled.slice(0, 12).map(a => a.name).join(", ")}${unscheduled.length > 12 ? ", …" : ""}`);
if (errors.length) { for (const e of errors) console.error(`  ✗ ${e}`); die(`${errors.length} problem(s) — nothing written`); }
if (CHECK) { console.log("  ✓ sheet is clean (--check: nothing written)"); process.exit(0); }

// ── Write the block ───────────────────────────────────────────────────────
const src = readFileSync(target, "utf8");
const re = new RegExp(`([ \\t]*)// SCHEDULE:BEGIN ${fid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n[\\s\\S]*?([ \\t]*)// SCHEDULE:END`);
const m = re.exec(src);
if (!m) die(`${path.relative(root, target)} has no "// SCHEDULE:BEGIN ${fid}" … "// SCHEDULE:END" block`, 2);
const ind = m[1], order = new Map(ds.stages.map((s, i) => [s.id, i]));
const lines = [...sched].sort(([, a], [, b]) => (a.day - b.day) || (order.get(a.stage) - order.get(b.stage)) || (nightMin(a.start) - nightMin(b.start)))
  .map(([id, s]) => `${ind}${JSON.stringify(id)}: [${JSON.stringify(s.stage)}, "${s.start}", "${s.end}"],  // ${s.name.replace(/[\r\n]/g, " ")}`);
const block = [`${ind}// SCHEDULE:BEGIN ${fid}`,
  `${ind}// source: ${source} · imported ${new Date().toISOString().slice(0, 10)} · ${sched.size} of ${ds.artists.length} acts`,
  ...lines, `${m[2]}// SCHEDULE:END`].join("\n");
writeFileSync(target, src.slice(0, m.index) + block + src.slice(m.index + m[0].length));
console.log(`  ✓ wrote ${sched.size} row(s) into ${path.relative(root, target)}`);
console.log(`  next: node scripts/compile.mjs && node scripts/gen-festival-pages.mjs && git add -A && node scripts/verify.mjs`);

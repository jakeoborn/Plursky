// SPEC-193 P1 — writes reports/field-readiness-<date>.{json,md} from the run.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const VPS = ["320x568", "390x844", "430x932"], NETS = ["online", "offline", "slow3g", "tiles-blocked"];
const mark = s => ({ PASS: "✓", FAIL: "✗", FLAKY: "~", NA: "·" }[s] || "?");
const fails = r => (r.checks || []).filter(c => c.ok === false);

// User impact first: a screen that never opens beats a stray character.
const IMPACT = [
  [/lineup renders|opens on the stored|cell ran|lineup has set rows/, 100],
  [/survives offline|usable within/, 90],
  [/map: tiles blocked/, 80],
  [/default festival|wrap page|stale SW|app mounts/, 75],
  [/artist page opens|add a set|survives a reload|remove persists/, 70],
  [/every day has|ends before|monotonic|day \d+ opens/, 60],
  [/clash/, 55],
  [/page errors|opens clean/, 40],
  [/overflow|stray text|photo failure/, 30],
];
const impact = flow => (IMPACT.find(([re]) => re.test(flow)) || [0, 10])[1];

export function writeReport({ DATE, OUTDIR, fests, matrix, flows, globals, ms, head }) {
  const count = rows => rows.reduce((o, r) => (o[r.status] = (o[r.status] || 0) + 1, o), {});
  const mt = count(matrix), ft = count(flows), gt = count(globals);
  const pass = (mt.PASS || 0) + (mt.FLAKY || 0), total = matrix.length;
  const json = { spec: "SPEC-193 P1", date: DATE, head, runtimeMs: ms, festivals: fests.map(f => f.id),
    totals: { matrix: mt, flows: ft, globals: gt, matrixPassRate: total ? +(pass / total).toFixed(4) : 0 }, matrix, flows, globals };
  writeFileSync(join(OUTDIR, `field-readiness-${DATE}.json`), JSON.stringify(json, null, 1));

  // Failures, ranked: impact, then how many cells share the same failing check.
  const agg = new Map();
  const note = (where, c, shot) => {
    const k = c.flow; const a = agg.get(k) || { flow: k, impact: impact(k), where: [], notes: new Set(), shots: [] };
    a.where.push(where); if (c.note) a.notes.add(c.note.slice(0, 140)); if (shot && a.shots.length < 3) a.shots.push(shot); agg.set(k, a);
  };
  for (const r of matrix) for (const c of fails(r)) note(`${r.festival} ${r.viewport} ${r.network}`, c, r.shot);
  for (const r of flows) for (const c of fails(r)) note(`${r.festival} (flows)`, c, r.shot);
  for (const r of globals) for (const c of fails(r)) note(`${r.scenario} ${r.viewport}`, c, r.shot);
  const ranked = [...agg.values()].sort((a, b) => b.impact - a.impact || b.where.length - a.where.length);

  const L = [];
  L.push(`# Field readiness — ${DATE}`, "");
  L.push(`SPEC-193 Phase 1. Built from \`main\` at \`${head}\`. Runtime ${(ms / 60000).toFixed(1)} min. Command: \`node scripts/field/field-readiness.mjs\`.`, "");
  L.push(`**Matrix pass rate: ${total ? (100 * pass / total).toFixed(1) : 0}%** (${pass}/${total} cells; ${mt.FLAKY || 0} flaky = passed on the one retry). ${fests.length} festivals × 3 viewports × 4 networks.`);
  L.push(`Per-festival flows: ${ft.PASS || 0} pass, ${ft.FAIL || 0} fail, ${ft.FLAKY || 0} flaky. Global scenarios: ${gt.PASS || 0} pass, ${gt.FAIL || 0} fail, ${gt.FLAKY || 0} flaky.`, "");
  L.push("Conditions: `online` (no service worker); `offline` (first load online with the service worker, then offline + reload); `slow3g` (warm service worker, then 4.4 s latency at 400 kbit/s + reload); `tiles-blocked` (map tile hosts dead). Every gate run blocks all outside hosts except the vendored CDN copies, so artist photos from outside, weather and music APIs fail the way they do with no signal.", "");
  L.push("## Failures by user impact", "");
  if (!ranked.length) L.push("None.", "");
  ranked.forEach((a, i) => {
    L.push(`${i + 1}. **${a.flow}** — ${a.where.length} cell(s). ${a.where.slice(0, 6).join("; ")}${a.where.length > 6 ? "; …" : ""}`);
    for (const n of [...a.notes].slice(0, 3)) L.push(`   - ${n}`);
    for (const s of a.shots) L.push(`   - screenshot: [${s}](${s})`);
  });
  L.push("", "## Matrix", "", "✓ pass · ✗ fail · ~ flaky (passed on retry) · columns are viewport/network.", "");
  L.push(`| Festival | ${VPS.map(v => NETS.map(n => `${v.split("x")[0]} ${n}`).join(" | ")).join(" | ")} |`);
  L.push(`|---|${VPS.map(() => NETS.map(() => ":-:").join("|")).join("|")}|`);
  for (const f of fests) {
    const cells = VPS.flatMap(v => NETS.map(n => matrix.find(r => r.festival === f.id && r.viewport === v && r.network === n)));
    L.push(`| ${f.id} | ${cells.map(c => c ? mark(c.status) : "–").join(" | ")} |`);
  }
  L.push("", "## Per-festival flows (390x844, online)", "", "| Festival | Status | Failing checks |", "|---|:-:|---|");
  for (const r of flows) L.push(`| ${r.festival} | ${mark(r.status)} | ${fails(r).map(c => `${c.flow}${c.note ? ` (${c.note.slice(0, 80).replace(/\|/g, "/")})` : ""}`).join("<br>") || ""} |`);
  L.push("", "## Global scenarios", "", "| Scenario | Viewport | Status | Notes |", "|---|---|:-:|---|");
  for (const r of globals) L.push(`| ${r.scenario} | ${r.viewport} | ${mark(r.status)} | ${(r.checks || []).filter(c => c.ok !== true).map(c => `${c.ok === false ? "✗ " : ""}${c.flow}${c.note ? `: ${c.note.slice(0, 90).replace(/\|/g, "/")}` : ""}`).join("<br>")} |`);
  L.push("", "## Not covered", "",
    "- Real device radio, real iOS WKWebView and native plugins: this is Chromium headless with the web build. Locked-screen behaviour is out of scope.",
    "- Pin count vs stage count on the real (MapLibre) map: tiles are blocked in every gate run, so the real map is never drawn here. The tiles-blocked cell checks the fallback instead.",
    "- Share sheet export (native share): the Music, Memories, Me and Home screens are opened for errors; producing an image is not.", "");
  writeFileSync(join(OUTDIR, `field-readiness-${DATE}.md`), L.join("\n"));
  return { summary: `field-readiness: matrix ${pass}/${total} (${total ? (100 * pass / total).toFixed(1) : 0}%), flows ${JSON.stringify(ft)}, globals ${JSON.stringify(gt)}, ${(ms / 60000).toFixed(1)} min, ${ranked.length} distinct failing checks` };
}

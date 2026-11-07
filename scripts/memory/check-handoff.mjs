#!/usr/bin/env node
// check-handoff.mjs: the handoff note a compact cannot lose.
//
// A compaction summary is prose, and prose drops things: the queue position, a
// head SHA, who ruled what. A handoff note in this format keeps exactly those
// three, and this check rejects one that has lost any of them.
//
//   node scripts/memory/check-handoff.mjs <file>            # format check
//   node scripts/memory/check-handoff.mjs <file> --live     # + each #PR head == GitHub's head
//   node scripts/memory/check-handoff.mjs --template        # print a blank note
//   node scripts/memory/check-handoff.mjs --self-test
//
// Handoffs live in ~/Plursky-private/instinct/ (private), never in this repo.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Credential VALUES, never the words. "service-role key" in prose is fine;
// a JWT, a GitHub token or a PEM block is not. Public-by-design tokens (the
// MusicKit developer token is a JWT) still do not belong in memory or handoffs.
export const SECRET_PATTERNS = [
  ["GitHub token", /\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ["API secret key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|\bsk-[A-Za-z0-9_-]{20,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["AWS key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["bearer value", /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/],
];
export function findSecrets(text) {
  const hits = [];
  for (const [label, re] of SECRET_PATTERNS) if (re.test(text)) hits.push(label);
  return hits;
}
// Every string this tooling prints or writes goes through here, so a detected
// credential is named by its kind and never echoed (an error that quotes the
// offending row would otherwise print the very token it found).
export function redact(text) {
  let out = String(text);
  for (const [label, re] of SECRET_PATTERNS) out = out.replace(new RegExp(re.source, "g"), `[redacted ${label}]`);
  return out;
}

export const SECTIONS = ["Queue position", "Open heads", "Rulings", "Blocked on Jake", "Next"];
const MAX_BYTES = 8000;
const SHA40 = /\b[0-9a-f]{40}\b/;
// A ruling names who made it and when: Jake / Instinct / a spec, plus a date.
const RULING_SOURCE = /(Jake|Instinct|Codex|SPEC-\d+|spec)\b[^\n]*\b20\d\d-\d\d-\d\d\b|\b20\d\d-\d\d-\d\d\b[^\n]*(Jake|Instinct|Codex|SPEC-\d+|spec)\b/;

export const TEMPLATE = `# Claude Plur handoff — YYYY-MM-DD HH:MM CT

## Queue position
1. <item> — <done | running | next | held: why>

## Open heads
| PR | branch | head (full SHA) | state |
|---|---|---|---|
| #NNN | <branch> | <40-hex sha> | <draft/ready, base, verify, CI> |

## Rulings
- <what was decided> — <Jake | Instinct | SPEC-NNN>, YYYY-MM-DD

## Blocked on Jake
- none

## Next
1. <exact next step>
`;

function sectionsOf(text) {
  const out = new Map();
  let cur = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = h[1]; out.set(cur, []); continue; }
    if (cur) out.get(cur).push(line);
  }
  return out;
}

// Returns { ok, errors[], prs: [{pr, sha}] }.
export function validateHandoff(text) {
  const errors = [];
  if (!/^# .*handoff.*\b20\d\d-\d\d-\d\d\b/im.test(text.split("\n")[0] || "")) {
    errors.push("first line must be `# … handoff — YYYY-MM-DD …`");
  }
  if (Buffer.byteLength(text) > MAX_BYTES) errors.push(`over ${MAX_BYTES} bytes: a handoff is pointers, not a log`);
  // Errors name a line number and a kind, never the line's text: a row that
  // carries a credential would otherwise be printed back with it.
  const lines = text.split("\n");
  const lineOf = row => lines.indexOf(row) + 1;
  lines.forEach((l, i) => {
    const kinds = findSecrets(l);
    if (kinds.length) errors.push(`line ${i + 1}: contains a credential value (${kinds.join(", ")})`);
  });

  const secs = sectionsOf(text);
  const order = [...secs.keys()].filter(k => SECTIONS.includes(k));
  for (const s of SECTIONS) if (!secs.has(s)) errors.push(`missing section "## ${s}"`);
  if (order.join("|") !== SECTIONS.filter(s => secs.has(s)).join("|")) {
    errors.push(`sections out of order; want ${SECTIONS.join(" → ")}`);
  }
  const body = s => (secs.get(s) || []).filter(l => l.trim());

  if (secs.has("Queue position") && !body("Queue position").some(l => /^\s*\d+\.\s+\S/.test(l))) {
    errors.push("Queue position needs numbered rows (1. …)");
  }

  const prs = [];
  if (secs.has("Open heads")) {
    const rows = body("Open heads").filter(l => l.startsWith("|") && !/^\|\s*-/.test(l) && !/^\|\s*PR\s*\|/i.test(l));
    if (!rows.length) errors.push("Open heads has no rows (write `| — | — | — | none open |` if truly none)");
    for (const r of rows) {
      if (/none open/i.test(r)) continue;
      const sha = r.match(SHA40);
      const pr = r.match(/(?:\b([\w.-]+\/[\w.-]+))?#(\d+)/);
      if (!sha) errors.push(`line ${lineOf(r)}: Open heads row without a full 40-hex SHA`);
      if (sha) prs.push({ pr: pr ? Number(pr[2]) : null, repo: pr?.[1] || null, sha: sha[0] });
    }
  }

  if (secs.has("Rulings")) {
    const items = body("Rulings").filter(l => /^\s*-\s+/.test(l));
    if (!items.length) errors.push("Rulings needs bullet rows (write `- none this session — Claude, YYYY-MM-DD` if none)");
    for (const l of items) {
      if (/^\s*-\s+none\b/i.test(l)) continue;
      if (!RULING_SOURCE.test(l)) errors.push(`line ${lineOf(l)}: ruling without who + date`);
    }
  }

  if (secs.has("Blocked on Jake") && !body("Blocked on Jake").some(l => /^\s*-\s+\S/.test(l))) {
    errors.push("Blocked on Jake needs bullet rows (`- none` is a row)");
  }
  if (secs.has("Next") && !body("Next").some(l => /^\s*\d+\.\s+\S/.test(l))) {
    errors.push("Next needs numbered rows");
  }
  return { ok: errors.length === 0, errors, prs };
}

// --live: every #PR row's head must equal the PR's current head on GitHub.
// Every printed error goes through here: --live errors embed gh's error text,
// which can carry a credential, so the value is redacted before printing.
export function formatError(file, e) { return `  ✗ ${file}: ${redact(e)}`; }

function liveErrors(prs) {
  const errs = [];
  for (const { pr, repo, sha } of prs) {
    if (!pr) continue;
    let head;
    try {
      head = execFileSync("gh", ["pr", "view", String(pr), ...(repo ? ["-R", repo] : []), "--json", "headRefOid,state", "-q", '.headRefOid+" "+.state'],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }).trim();
    } catch (e) { errs.push(`${repo || ""}#${pr}: cannot read GitHub (${String(e.message).split("\n")[0]}), so the head is UNVERIFIED`); continue; }
    const [h, state] = head.split(" ");
    if (state === "OPEN" && h !== sha) errs.push(`${repo || ""}#${pr}: handoff says ${sha.slice(0, 8)}, GitHub head is ${h.slice(0, 8)}`);
  }
  return errs;
}

function selfTest() {
  const good = TEMPLATE
    .replace("YYYY-MM-DD HH:MM", "2026-11-07 13:00")
    .replace("<item> — <done | running | next | held: why>", "#401 past scan — CI running")
    .replace("#NNN | <branch> | <40-hex sha>", "#401 | feat/past-edition-scan | " + "a".repeat(40))
    .replace("<what was decided> — <Jake | Instinct | SPEC-NNN>, YYYY-MM-DD", "#392 is Codex's — Jake, 2026-11-07")
    .replace("<exact next step>", "report #401 CI");
  const cases = [
    ["filled template passes", good, true],
    ["the raw template fails (no SHA, no dated ruling)", TEMPLATE, false],
    ["short SHA fails", good.replace("a".repeat(40), "aaaaaaaa"), false],
    ["ruling without who+date fails", good.replace("— Jake, 2026-11-07", ""), false],
    ["missing Rulings section fails", good.replace("## Rulings", "## Notes"), false],
    ["sections out of order fail", good.replace("## Queue position", "## Q").replace("## Next", "## Queue position\n1. x\n\n## Next"), false],
    ["a GitHub token fails", good.replace("report #401 CI", "token ghp_" + "x".repeat(30)), false],
    ["a JWT fails", good.replace("report #401 CI", "eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJYNTQifQ.c2lnbmF0dXJlc2ln"), false],
    ["the word service-role passes", good.replace("report #401 CI", "never paste the service-role key"), true],
    ["over 8KB fails", good + "\n" + "x".repeat(9000), false],
  ];
  let bad = 0;
  for (const [name, text, want] of cases) {
    const got = validateHandoff(text).ok;
    if (got !== want) { bad++; console.log(`  ✗ ${name}: got ${got}, want ${want} — ${validateHandoff(text).errors.join("; ")}`); }
  }
  // A credential in a row that also breaks another rule must not be quoted back.
  const tok = "ghp_" + "z".repeat(30);
  const leak = validateHandoff(good.replace("a".repeat(40), tok)).errors.join(" ");
  if (leak.includes(tok) || leak.includes("feat/past-edition-scan") || !/line \d+: Open heads row/.test(leak)) {
    bad++; console.log("  ✗ an error about a credential-bearing row quoted the row instead of naming its line");
  }
  const ghErr = formatError("h.md", "#401: cannot read GitHub (HTTP 401 Authorization: token " + tok + "), so the head is UNVERIFIED");
  if (ghErr.includes(tok) || !/redacted GitHub token/.test(ghErr)) { bad++; console.log("  ✗ a --live gh error printed the credential it carried"); }
  const prs = validateHandoff(good).prs;
  const x = validateHandoff(good.replace("| #401 |", "| Dim-hour/Dim-Hour#5674 |")).prs[0];
  if (!(x && x.pr === 5674 && x.repo === "Dim-hour/Dim-Hour")) { bad++; console.log("  ✗ owner/repo#N row did not parse"); }
  if (!(prs.length === 1 && prs[0].pr === 401)) { bad++; console.log("  ✗ open-heads row did not parse to #401"); }
  console.log(bad ? `✗ handoff format: ${bad} of ${cases.length + 4} self-test cases wrong`
    : `  ✓ handoff format: ${cases.length + 4} self-test cases (sections, full SHAs, dated rulings, secrets, size)`);
  return bad ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit(selfTest());
  if (args.includes("--template")) { process.stdout.write(TEMPLATE); process.exit(0); }
  const file = args.find(a => !a.startsWith("--"));
  if (!file) { console.error("usage: check-handoff.mjs <file> [--live] | --template | --self-test"); process.exit(2); }
  const res = validateHandoff(fs.readFileSync(file, "utf8"));
  const errs = [...res.errors, ...(args.includes("--live") ? liveErrors(res.prs) : [])];
  if (errs.length) { for (const e of errs) console.log(formatError(file, e)); process.exit(1); }
  console.log(`  ✓ handoff ${file}: ${SECTIONS.length} sections, ${res.prs.length} full head(s)${args.includes("--live") ? ", heads match GitHub" : ""}`);
}

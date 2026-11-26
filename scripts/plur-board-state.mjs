#!/usr/bin/env node
// Live Work Board freshness gate (Jake, 2026-11-26: "make master list/live
// work board current ... then gate it so its current all the time").
//
// The board is a Google Sheet ('Plur Top 10' + Plur rows of 'Needs Jake') that
// only the claude.ai Google Sheets connector can write, so this script cannot
// read the sheet. It tracks the thing the board reports instead: the live set
// of open Plursky PRs (number, head, draft). A board write RECORDS that set; any
// later open, close, merge, push or draft flip makes the board stale.
//
//   node scripts/plur-board-state.mjs --check    # print what moved since the last board write; exit 1 if stale
//   node scripts/plur-board-state.mjs --record   # after a board write + readback: save the live set
//   node scripts/plur-board-state.mjs --hook stop|start   # Claude Code hook mode (reads hook JSON on stdin)
//
// Hook mode never breaks a session: any error (gh offline, no auth) is a
// one-line note and exit 0. At Stop it blocks ONCE with the stale list; when
// the hook fires again in the same stop (stop_hook_active) it lets the stop
// through, so a dead connector cannot trap a window in a loop.
//
// State file: ~/Plursky-private/board/last-write.json (override PLUR_BOARD_STATE).
// Test seam: PLUR_BOARD_LIVE=<json file> replaces the gh call.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const STATE = process.env.PLUR_BOARD_STATE || join(homedir(), "Plursky-private", "board", "last-write.json");
const SHEET = "https://docs.google.com/spreadsheets/d/1UqfICspzcAHgQvkPibz6X3FtnzxVtHp-4l7GjYzG2p8";
const mode = process.argv[2];
const hookEvent = process.argv[3];

function live() {
  const raw = process.env.PLUR_BOARD_LIVE
    ? readFileSync(process.env.PLUR_BOARD_LIVE, "utf8")
    : execFileSync("gh", ["pr", "list", "--repo", "jakeoborn/Plursky", "--state", "open", "--limit", "200",
        "--json", "number,headRefOid,isDraft,title"], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
  const prs = {};
  for (const p of JSON.parse(raw)) prs[p.number] = { head: p.headRefOid.slice(0, 8), draft: !!p.isDraft, title: String(p.title || "").slice(0, 60) };
  return prs;
}

function diff(rec, now) {
  const out = [];
  for (const n of Object.keys(now)) {
    const a = rec[n], b = now[n];
    if (!a) out.push(`#${n} opened (${b.head}${b.draft ? ", draft" : ""}): ${b.title}`);
    else {
      if (a.head !== b.head) out.push(`#${n} head ${a.head} -> ${b.head}`);
      if (a.draft !== b.draft) out.push(`#${n} ${b.draft ? "back to draft" : "out of draft"}`);
    }
  }
  for (const n of Object.keys(rec)) if (!now[n]) out.push(`#${n} merged or closed`);
  return out.sort((x, y) => parseInt(x.slice(1)) - parseInt(y.slice(1)));
}

function readRecord() {
  if (!existsSync(STATE)) return null;
  return JSON.parse(readFileSync(STATE, "utf8"));
}

if (mode === "--record") {
  const prs = live();
  mkdirSync(dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ recordedAt: new Date().toISOString(), prs }, null, 2) + "\n");
  console.log(`recorded ${Object.keys(prs).length} open PR(s) as the board's state -> ${STATE}`);
  process.exit(0);
}

if (mode === "--check") {
  const rec = readRecord();
  if (!rec) { console.log(`STALE: no board write recorded yet (${STATE}). Update the board, then --record.`); process.exit(1); }
  const moved = diff(rec.prs, live());
  if (!moved.length) { console.log(`board current: no open-PR change since ${rec.recordedAt}`); process.exit(0); }
  console.log(`STALE since ${rec.recordedAt}:`); for (const m of moved) console.log(`  ${m}`);
  process.exit(1);
}

if (mode === "--hook") {
  let input = {};
  try { input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}
  try {
    const rec = readRecord();
    const moved = rec ? diff(rec.prs, live()) : ["no board write recorded yet"];
    if (!moved.length) process.exit(0);
    const list = moved.slice(0, 12).join("; ") + (moved.length > 12 ? `; +${moved.length - 12} more` : "");
    const ask = `Live Work Board is stale (${list}). Update the 'Plur Top 10' rows (Google Sheets connector, Plur rows only, read before and after) at ${SHEET}, then run: node scripts/plur-board-state.mjs --record`;
    if (hookEvent === "stop" && !input.stop_hook_active) {
      console.log(JSON.stringify({ decision: "block", reason: ask }));
    } else {
      console.log(JSON.stringify({ systemMessage: ask }));
    }
  } catch (e) {
    console.log(JSON.stringify({ systemMessage: `board freshness check skipped: ${String(e.message || e).split("\n")[0].slice(0, 120)}` }));
  }
  process.exit(0);
}

console.error("usage: plur-board-state.mjs --check | --record | --hook stop|start");
process.exit(2);

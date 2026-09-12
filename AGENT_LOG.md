# Agent Log

One place Claude Code and Instinct both read at session start and append to at session end. Use it for narrowly-scoped handoffs, decisions made, open loops, and blockers.

## Format

Entries are reverse chronological:

`YYYY-MM-DD HH:MM CT | Author: Claude or Instinct | Lane: <lane> | <entry>`

## Entries

- 2026-09-12 07:44 CT | Author: Instinct | Lane: QA harness | Open loop: add scroll-into-view, then take a fresh snapshot and use its fresh ref before pressing an off-screen target.
- 2026-09-12 07:44 CT | Author: Instinct | Lane: TestFlight upload | PR #162 is blocked on a Codex P1: the verify gate must run in the throwaway worktree before archive.
- 2026-09-12 07:44 CT | Author: Instinct | Lane: Release | Main is `9640866` (`v316`). TestFlight upload work is in flight through `scripts/build-upload-testflight.mjs`.

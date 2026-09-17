#!/bin/zsh
# Push ONLY on a green verify. Nothing else in this repo may push.
#
# WHY THIS EXISTS
# On 2026-09-16 a hand-written chain ran `node scripts/verify.mjs` and then
# `git push --force-with-lease` on the NEXT line, unconditionally. Two full
# verifies had failed on Playwright timeouts and the branch went to the remote
# anyway — after a reviewer had already been told it was ready. A shell chain
# separated by `;` or newlines runs the next command regardless of the previous
# exit code, and `a | tail && b` branches on TAIL's status, not the test's.
#
# So the guard is mechanical, not a habit: verify's exit code is captured, and
# push is unreachable unless it is 0.
#
# SUPPORTED INVOCATION — run it directly. The file is tracked executable, so this
# works without naming an interpreter:
#
#   ./scripts/verify-and-push.sh <remote> <branch> [extra git push args...]
#
# ⛔ Do NOT run it as `bash scripts/verify-and-push.sh`: the `mktemp -t` call below
# is zsh-flavoured and fails under bash, which looks like a verify failure but is
# really a harness failure.
# ⛔ Do NOT pipe this script into `tail`/`head`. A pipeline reports the LAST
# command's status, so `verify-and-push.sh … | tail` yields 0 even when the script
# never ran at all (it once returned 126 for a non-executable file and the caller
# read success). Run it bare and read its own `✓`/`✗` verdict line — and treat a
# MISSING verdict line as failure, not as a pass.
#
set -u
# pipefail so an internal pipeline reports the failing stage, not the last one.
set -o pipefail
REMOTE="${1:-origin}"
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD)}"
shift 2 2>/dev/null || true

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || { echo "✗ cannot cd to repo root"; exit 1; }

LOG="$(mktemp -t plursky-verify)"
echo "▸ verify → $LOG"
node scripts/verify.mjs > "$LOG" 2>&1
EC=$?

if [ $EC -ne 0 ]; then
  echo "✗ VERIFY FAILED (exit $EC) — NOT pushing."
  # Print the failure MESSAGE, never a count. `grep -c '^✗'` once printed
  # "fatal: 1", a number where the message was needed, and cost a full round.
  echo "--- first failure ---"
  grep -m1 "^✗" "$LOG" || tail -20 "$LOG"
  echo "--- full log: $LOG"
  exit "$EC"
fi

echo "✓ verify exit 0"
DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  # A green verify describes the WORKING TREE. Pushing with uncommitted changes
  # would put a head on the remote that nothing verified.
  echo "✗ working tree is dirty — the verified tree is not the tree you would push:"
  echo "$DIRTY"
  exit 1
fi

echo "▸ git push $REMOTE $BRANCH $*"
git push "$REMOTE" "$BRANCH" "$@"
PEC=$?
[ $PEC -eq 0 ] && echo "✓ pushed $(git rev-parse --short HEAD)" || echo "✗ push failed ($PEC)"
exit $PEC

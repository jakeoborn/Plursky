// Retry-once for a render that timed out (finding f4, 2026-11-27).
//
// Under machine load a single hero render in the Today print gate can miss
// a 30 s Playwright wait. A timed-out render is a missing measurement, not a
// failed one, so it gets ONE more attempt. Nothing else changes: an attempt
// that fails any other way is not retried, a second timeout fails, and the
// caller still requires every hero to be measured.
//
// runOnce(fn, { onRetry, onReset }) -> { ok: true } | { ok: false, err }
//   fn       async; one full attempt. Throws to fail.
//   onReset  async; runs after every failed attempt (e.g. close the page).
//   onRetry  called with the first timeout before the second attempt.

// A Playwright timeout: an error named TimeoutError, or Playwright's own message
// shape ("page.goto: Timeout 30000ms exceeded."). Nothing looser: a message that
// merely mentions a timeout is another failure and is not retried.
const PLAYWRIGHT_TIMEOUT = /^(?:page|frame|locator|browserContext|elementHandle)\.\w+: Timeout \d+ms exceeded\./;
export function isTimeout(err) {
  if (!err) return false;
  if (err.name === 'TimeoutError') return true;
  return PLAYWRIGHT_TIMEOUT.test(String(err.message || ''));
}

// A context that belongs to whoever is setting it up until setup returns: if
// setup throws (say page.goto times out), the context is closed before the
// error leaves, so a retry never leaves the first context running.
export async function ownedContext(newContext, setup) {
  const ctx = await newContext();
  try {
    return await setup(ctx);
  } catch (err) {
    await ctx.close().catch(() => {});
    throw err;
  }
}

export async function runOnce(fn, { onRetry = () => {}, onReset = async () => {} } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fn(attempt);
      return { ok: true, attempts: attempt + 1 };
    } catch (err) {
      await onReset(err);
      if (attempt === 0 && isTimeout(err)) { onRetry(err); continue; }
      return { ok: false, err, attempts: attempt + 1 };
    }
  }
  /* c8 ignore next */
  return { ok: false, err: new Error('unreachable'), attempts: 2 };
}

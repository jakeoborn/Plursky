// Wait until the scratch http.server answers `url`. Each probe READS its body:
// python's http.server closes the connection after every response, and an
// unread (paused) body at that moment can crash Node's fetch (undici,
// `assert(!this.paused)` in Parser.finish) from a socket event, where no
// try/catch reaches it. CI run 36089778095 died that way.
export async function serverReady(url, { tries = 50, delayMs = 100 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      await r.arrayBuffer();
      if (r.ok) return true;
    } catch {}
    await new Promise(res => setTimeout(res, delayMs));
  }
  return false;
}

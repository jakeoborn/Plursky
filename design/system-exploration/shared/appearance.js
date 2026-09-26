// Appearance: one system, two modes, and who decides which one shows.
//   1. A choice made in Me (Dark or Light) always wins and is kept. After
//      that the iPhone setting no longer matters.
//   2. With no choice ("System"), the app follows the iPhone: Light when
//      iOS is in light mode...
//   3. ...and Dark otherwise, including when there is no signal at all.
//      Dark is the default: the app lives at night.
// ?mode=dark|light forces a mode without storing it (renders and the gate).
// Depends on DUO_TOKENS (duo-tokens.js) and applyTokens (system.js).
(function () {
  const KEY = "plursky.appearance";
  const light = matchMedia("(prefers-color-scheme: light)");
  const forced = new URLSearchParams(location.search).get("mode");
  const valid = (v) => (v === "dark" || v === "light" ? v : null);
  let system = null;   // a stand-in iPhone setting ("dark"|"light"); null = the real one
  const read = () => { try { return valid(localStorage.getItem(KEY)); } catch { return null; } };
  const systemMode = () => system || (light.matches ? "light" : "dark");
  const resolve = () => valid(forced) || read() || systemMode();
  const subs = [];
  function apply() {
    const m = resolve();
    document.documentElement.dataset.appearance = window.APPEARANCE.choice();
    if (!window.TOKENS || window.TOKENS.id !== m) window.applyTokens(window.DUO_TOKENS(m));
    subs.forEach((f) => f(m, window.APPEARANCE.choice()));
  }
  window.APPEARANCE = {
    choice: () => read() || "system",            // what the Me row shows as selected
    mode: resolve,                               // what is on screen
    set(c) {                                     // "dark" | "light" | "system"
      try { valid(c) ? localStorage.setItem(KEY, c) : localStorage.removeItem(KEY); } catch {}
      apply();
    },
    simulateSystem(m) { system = valid(m); apply(); },   // prototype only: stands in for the iPhone setting
    onChange(f) { subs.push(f); },
  };
  light.addEventListener("change", apply);       // only changes the screen when no choice is stored
  window.TOKENS = window.DUO_TOKENS(resolve());
  document.documentElement.dataset.appearance = window.APPEARANCE.choice();
})();

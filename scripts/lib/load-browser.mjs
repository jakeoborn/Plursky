// Loads the COMPILED app bundles (build/data.js, home.js, map.js) plus the
// festival modules into a VM, so a node gate can call the app's own
// predicates — geometryVerifiedFor above all — instead of restating them.
// Shared by test-festival-claims and test-festival-pages.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

export function loadBrowser(ROOT) {
  const need = ['build/data.js', 'build/home.js', 'build/map.js'];
  const missing = need.filter(f => !existsSync(join(ROOT, f)));
  if (missing.length) {
    console.log(`  ✗  HARNESS DEAD: missing ${missing.join(', ')} — run node scripts/build.mjs`);
    process.exit(1);
  }
  const noop = () => {};
  const store = {};
  const ctx = {
    console: { log: noop, warn: noop, error: noop }, Date, Math, JSON, Object, Array,
    String, Number, Boolean, Set, Map, isNaN, parseInt, parseFloat, isFinite,
    Promise, RegExp, Symbol, Error,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    fetch: () => new Promise(noop), URLSearchParams, location: { search: '' },
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { userAgent: 'node', geolocation: {} },
    document: { addEventListener: noop, removeEventListener: noop, documentElement: { style: {} },
                createElement: () => ({ style: {}, setAttribute: noop }), getElementById: () => null,
                querySelector: () => null, head: { appendChild: noop } },
    React: new Proxy(function () {}, { get: () => () => null, apply: () => null }),
    ReactDOM: { createRoot: () => ({ render: noop }) },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.window.addEventListener = noop; ctx.window.removeEventListener = noop;
  ctx.window.matchMedia = () => ({ matches: false, addEventListener: noop, addListener: noop });
  vm.createContext(ctx);
  const mods = execFileSync('git', ['ls-files', 'data/festivals/*.js'], { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean)
    .map(f => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  vm.runInContext(mods, ctx);
  for (const f of need) vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx);
  return ctx;
}


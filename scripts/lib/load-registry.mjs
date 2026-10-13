// Loads FESTIVALS_REGISTRY + _DATA_SETS straight out of data.jsx for node
// scripts (gen-festival-pages.mjs, festival-status.mjs).
//
// data.jsx is a browser script (top-level consts + a window export), so it is
// evaluated in a VM with a window shim rather than imported.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function loadRegistry(root) {
  const ctx = {
    window: {}, console, Date, Math, JSON, Object, Array, String, Number,
    isNaN, parseInt, parseFloat, fetch: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  vm.createContext(ctx);
  // Wave-1 festivals live in data/festivals/*.js and register themselves on
  // window.PLURSKY_FESTIVALS. Run them first, the same order index.html uses, or
  // the registry data.jsx builds here is missing those festivals.
  const festivalModules = readdirSync(path.join(root, 'data', 'festivals'))
    .filter(f => f.endsWith('.js')).sort()
    .map(f => readFileSync(path.join(root, 'data', 'festivals', f), 'utf8'))
    .join('\n');
  vm.runInContext(
    festivalModules + '\n' +
    readFileSync(path.join(root, 'data.jsx'), 'utf8') +
    '\n;__out = { REG: FESTIVALS_REGISTRY, DS: _DATA_SETS, scheduleActs: _scheduleActs, eventDates: _festivalEventDates,'
    + ' weekendShifts: festivalWeekendShifts, actPlaysWeekend };',
    ctx,
  );
  return ctx.__out;
}

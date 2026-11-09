// synthetic-gated-festival.mjs: a GATED festival that exists only inside a
// test's vm, so a "gated festival" fixture never depends on which real
// festival happens to be closed today.
//
// Why it exists: test-capture-time-trust.mjs and test-festival-migration.mjs
// both proved the gated path with edc-orlando-2026, the only gated festival
// that had a data module. When it opened (2026-11-04, #262) neither test had a
// gated festival left to run, and both went HARNESS DEAD. The same thing
// would happen to any real festival used here.
//
// What it builds: a deep copy of a real data set, under a test-only id, with
// every date shifted by a whole number of weeks. The shift keeps weekdays and
// keeps each night's UTC offset exactly as in the source, so
// _photoFestivalNight sees the same window shape in a year no real festival
// claims. The copy is registered with available: false and added to
// _DATA_SETS, the same two places a real gated festival lives. Nothing in app
// code is touched, and the vm's registry and data sets are the very objects
// the shipped functions read (window.FESTIVALS_REGISTRY, window._DATA_SETS).

export const SYNTH_GATED_ID = "zz-test-gated-2036";
const DAY = 86400000;
export const SYNTH_SHIFT_WEEKS = 520;              // ~10 years: 2026 → 2036

// Copy a config, moving every date it carries by `weeks` weeks:
//   · dayDates[n].{y, m, d} (wall clock) and .midnightUtc, in step
//   · any top-level number whose key ends in "Ms" (startMs, endMs,
//     weekendStartMs, ...)
function shiftConfig(src, weeks, id) {
  const ms = weeks * 7 * DAY;
  const cfg = JSON.parse(JSON.stringify(src));
  cfg.id = id;
  for (const k of Object.keys(cfg)) {
    if (/Ms$/.test(k) && typeof cfg[k] === "number") cfg[k] += ms;
  }
  for (const n of Object.keys(cfg.dayDates || {})) {
    const dd = cfg.dayDates[n];
    if (dd.y != null && dd.m != null && dd.d != null) {
      const t = new Date(Date.UTC(dd.y, dd.m, dd.d) + ms);
      dd.y = t.getUTCFullYear(); dd.m = t.getUTCMonth(); dd.d = t.getUTCDate();
    }
    if (typeof dd.midnightUtc === "number") dd.midnightUtc += ms;
  }
  return cfg;
}

// Adds the synthetic gated festival to a booted vm context. Returns its id.
// Throws, never returns quietly, when the source can't be cloned, so a broken
// fixture can't pass as a gated one.
export function addSyntheticGatedFestival(ctx, from) {
  const reg = ctx.FESTIVALS_REGISTRY, sets = ctx._DATA_SETS;
  if (!Array.isArray(reg) || !sets) throw new Error("vm has no FESTIVALS_REGISTRY / _DATA_SETS");
  const src = sets[from];
  if (!src?.config?.dayDates) throw new Error(`${from} has no data module with dayDates to clone`);
  const row = reg.find(f => f?.config?.id === from);
  if (!row) throw new Error(`${from} has no registry row to clone`);
  const config = shiftConfig(src.config, SYNTH_SHIFT_WEEKS, SYNTH_GATED_ID);
  reg.push({ ...row, config, available: false });
  sets[SYNTH_GATED_ID] = { ...src, config };
  return SYNTH_GATED_ID;
}

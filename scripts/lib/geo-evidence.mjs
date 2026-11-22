// #302 first slice: a READ-ONLY inventory of the public evidence behind every
// festival stage the app knows about: which stages carry a GPS anchor, where
// each anchor came from, whether the app's own geometry predicate passes, how
// far each non-basis anchor lands from where the map transform draws it, and
// which dated waiver (if any) excuses the gap.
//
// Nothing here computes a new coordinate, moves a stage, certifies geometry or
// reads anything about a user. It calls the app's own predicates
// (geometryVerifiedFor, _solveMapAffine, _gpsFromAffine from build/map.js via
// load-browser.mjs) instead of restating them, and reads the waiver tables out
// of verify.mjs as data. The disposition per stage is deterministic and is the
// shadow re-survey queue the spec asks for; it ranks candidates for a HUMAN
// re-survey and never promotes anything.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

// gpsAnchors[].src values that are a MEASUREMENT of the ground. Mirrors the
// isEvidence test inside geometryVerifiedFor (map.jsx); the inventory test
// fails if the two ever disagree on a shipped festival.
export const EVIDENCE_SRC = new Set(['osm', 'crowd']);

export const DISPOSITION = Object.freeze({
  CONSISTENT: 'evidence_consistent',   // measured anchor that agrees with the drawn art (or is the measured basis of a verified festival)
  CONFLICT: 'conflict',                // measured anchor the art disagrees with by more than the readout tolerance
  NOT_EVIDENCE: 'review',              // anchored, but nothing independent confirms it: a poster/provisional read,
                                       // or a measured basis anchor on a festival that fails geometryVerifiedFor
  INSUFFICIENT: 'insufficient',        // no anchor at all for this stage
});

// Pull `const NAME = { ... };` out of verify.mjs as a plain object. The tables
// are pure literals (strings, arrays, comments), so evaluating the slice in an
// empty context is exact. A missing or reshaped table throws: an inventory
// that silently reports "no waivers" would be worse than none.
export function readWaiverTable(verifySrc, name) {
  const start = verifySrc.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`${name} not found in verify.mjs`);
  const open = verifySrc.indexOf('{', start);
  const end = verifySrc.indexOf('\n  };', open);
  if (end < 0) throw new Error(`${name}: closing "  };" not found`);
  return vm.runInNewContext('(' + verifySrc.slice(open, end + 4) + ')', {});
}

export function loadWaivers(root) {
  const src = readFileSync(join(root, 'scripts/verify.mjs'), 'utf8');
  return { registration: readWaiverTable(src, 'REGISTRATION_WAIVERS'), art: readWaiverTable(src, 'ART_WAIVERS') };
}

// One festival edition. `app` is the load-browser context; cfg/stages are the
// edition's own data set. today is 'YYYY-MM-DD' so the output is reproducible.
export function inventoryFestival(id, cfg, stages, app, waivers, today) {
  const anchors = (cfg && cfg.gpsAnchors) || [];
  const stageIds = new Set(stages.map(s => s.id));
  const affine = anchors.length >= 3 ? app._solveMapAffine(cfg, stages) : null;
  const verified = !!app.geometryVerifiedFor(id, cfg, stages);
  const tol = app.MAP_REGISTRATION_TOL_M;

  const anchorRows = anchors.map((a, i) => {
    const s = stages.find(x => x.id === a.stageId);
    let residualM = null;
    if (i >= 3 && affine && s) {
      const g = app._gpsFromAffine(affine, cfg, s.x, s.y);
      if (g) residualM = Math.round(app.distMiles(a.lat, a.lng, g.lat, g.lng) * 1609.34 * 10) / 10;
    }
    return { stageId: a.stageId, src: a.src || null, evidence: EVIDENCE_SRC.has(a.src), basis: i < 3,
             stageExists: !!s, residualM };
  });

  const waiverOf = (table, kind) => {
    const w = table[id];
    return w ? { kind, expires: w.expires, expired: w.expires < today, excuses: w.excuses || null } : null;
  };
  const waiverList = [waiverOf(waivers.registration, 'registration'), waiverOf(waivers.art, 'art')].filter(Boolean);

  const stageRows = stages.map(s => {
    const own = anchorRows.filter(a => a.stageId === s.id);
    let disposition;
    if (!own.length) disposition = DISPOSITION.INSUFFICIENT;
    else if (!own.some(a => a.evidence)) disposition = DISPOSITION.NOT_EVIDENCE;
    else {
      const ev = own.filter(a => a.evidence);
      // Any measured anchor the art misses by more than the readout
      // tolerance is a conflict. Otherwise a stage is consistent when a
      // measured anchor was actually CHECKED: a non-basis one with a
      // residual (within tolerance, since it is not bad), or a basis one on
      // a festival that passes geometryVerifiedFor. An unchecked measured
      // basis stays in review.
      const bad = ev.some(a => a.residualM != null && a.residualM > tol);
      const ok = ev.some(a => (a.basis && verified) || a.residualM != null);
      disposition = ok && !bad ? DISPOSITION.CONSISTENT : bad ? DISPOSITION.CONFLICT : DISPOSITION.NOT_EVIDENCE;
    }
    return { festivalId: id, stageId: s.id, name: s.name || s.id, disposition,
             anchors: own.map(a => ({ src: a.src, basis: a.basis, residualM: a.residualM })) };
  });

  return {
    festivalId: id, stages: stages.length, anchors: anchorRows.length,
    evidenceAnchors: anchorRows.filter(a => a.evidence).length,
    basisEvidence: anchorRows.filter(a => a.basis && a.evidence).length,
    geometryVerified: verified, affine: !!affine,
    orphanAnchors: anchorRows.filter(a => !a.stageExists).map(a => a.stageId),
    waivers: waiverList, anchorRows, stageRows,
  };
}

// Human re-survey candidates only. Order: festivals whose waiver expires
// soonest first (an expiry turns a gate red), then measured conflicts by
// residual (largest first), then poster/provisional anchors, then unanchored
// stages. Ties break on festival id then stage id, so the order never
// depends on object or array order.
const DISP_RANK = { [DISPOSITION.CONFLICT]: 0, [DISPOSITION.NOT_EVIDENCE]: 1, [DISPOSITION.INSUFFICIENT]: 2 };
export function resurveyQueue(festivals) {
  const rows = [];
  for (const f of festivals) {
    const exp = f.waivers.map(w => w.expires).sort()[0] || '9999-12-31';
    for (const s of f.stageRows) {
      if (s.disposition === DISPOSITION.CONSISTENT) continue;
      const worst = Math.max(-1, ...s.anchors.map(a => a.residualM ?? -1));
      rows.push({ ...s, waiverExpires: exp === '9999-12-31' ? null : exp, worstResidualM: worst < 0 ? null : worst, _exp: exp });
    }
  }
  rows.sort((a, b) => a._exp.localeCompare(b._exp)
    || DISP_RANK[a.disposition] - DISP_RANK[b.disposition]
    || (b.worstResidualM ?? -1) - (a.worstResidualM ?? -1)
    || a.festivalId.localeCompare(b.festivalId) || a.stageId.localeCompare(b.stageId));
  return rows.map(({ _exp, ...r }, i) => ({ rank: i + 1, ...r }));
}

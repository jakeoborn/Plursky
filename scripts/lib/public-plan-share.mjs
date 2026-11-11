// Node view of the public plan-share contract. The logic lives in ONE file the
// app also loads (data/plan-share-contract.js); this evaluates that file in an
// isolated context so tests and any server adapter use the exact same rules.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../../data/plan-share-contract.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ URL, Date, Set, Array, Number, Error, Object, JSON });
vm.runInContext(src, ctx, { filename: 'data/plan-share-contract.js' });
const api = ctx.PlurskyPlanShare;
if (!api || typeof api.makePublicPlan !== 'function') throw new Error('plan-share contract did not load');

// Results cross back from the vm context; re-parse so callers get plain objects
// of this realm (deepEqual compares prototypes).
const local = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
export const makePublicPlan = (input, now) => local(api.makePublicPlan(input, now));
export const resolveShare = (row, now) => local(api.resolveShare(row, now));

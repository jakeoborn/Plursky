import assert from 'node:assert/strict';
import {makePublicPlan,resolveShare} from './lib/public-plan-share.mjs';
const now=Date.parse('2026-09-30T23:00:00Z');
const args={kind:'schedule',festivalId:'acl-2026',editionEnd:'2026-10-12T03:00:00Z',sets:[{id:'af07',artist:'Skrillex',stage:'T-Mobile',startsAt:'2026-10-03T01:15:00Z',endsAt:'2026-10-03T03:00:00Z',notes:'PRIVATE',lat:30}]};
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const plan=makePublicPlan({...args,profileName:'SECRET',gps:{lat:30,lon:-97}},now);
eq(plan.expiresAt,'2026-10-19T03:00:00.000Z');eq('displayName' in plan,false);eq('notes' in plan.sets[0],false);eq('lat' in plan.sets[0],false);eq('gps' in plan,false);
eq(makePublicPlan({...args,displayName:'Jake'},now).displayName,'Jake');
for(const patch of [{kind:'location'},{festivalId:'../bad'},{displayName:'<script>'},{editionEnd:'2026-01-01'},{sets:[{...args.sets[0],endsAt:'2026-10-02T01:15:00Z'}]},{sets:[args.sets[0],args.sets[0]]}]) {assert.throws(()=>makePublicPlan({...args,...patch},now));checks++;}
eq(makePublicPlan({...args,kind:'map',stages:['main','main','east'],latitude:30},now).stages,['main','east']);
eq(makePublicPlan({...args,kind:'playlist',playlistUrl:'https://open.spotify.com/playlist/abc123?tracking=bad'},now).playlistUrl,'https://open.spotify.com/playlist/abc123');
for(const url of ['http://open.spotify.com/playlist/a','https://open.spotify.com.evil.invalid/playlist/a','https://open.spotify.com/artist/a']){assert.throws(()=>makePublicPlan({...args,kind:'playlist',playlistUrl:url},now));checks++;}
const row={payload:plan,expiresAt:'2026-10-19T03:00:00Z'};eq(resolveShare(row,now),plan);eq(resolveShare({...row,revokedAt:'2026-09-30'},now),null);eq(resolveShare(row,Date.parse(row.expiresAt)),null);eq(resolveShare({...row,expiresAt:'bad'},now),null);eq(resolveShare(null,now),null);
// The payload's key set is the whole allowlist: a new field must be added here on purpose.
eq(Object.keys(plan).sort(),['expiresAt','festivalId','kind','schemaVersion','sets']);
eq(Object.keys(plan.sets[0]).sort(),['artist','endsAt','id','stage','startsAt']);
console.log(`Public plan-share contract: ${checks} checks passed`);

import {createHash,randomBytes} from 'node:crypto';
import {makePublicPlan} from './public-plan-share.mjs';
const hash = token => createHash('sha256').update(token).digest('hex');
// Dependency-injected server adapter. auth must validate a live owner session;
// repository is service-role scoped and not available in any client bundle.
// STAGE 1: in-memory tests only. Nothing here is deployed or wired to a database.
export function planShareService({auth,repository,rateLimit,editionEndFor,entropy=()=>randomBytes(32),now=()=>Date.now()}) {
  return {
    async create(request) {
      const owner=await auth(request);if(!owner?.id)throw new Error('Authentication required');
      const editionEnd = await editionEndFor(request.plan?.festivalId);
      if (!editionEnd) throw new Error('Unknown exact edition');
      const payload=makePublicPlan({...request.plan,editionEnd},now());
      const token=entropy().toString('base64url');if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid token entropy');
      await repository.insert({owner_id:owner.id,token_hash:hash(token),kind:payload.kind,festival_id:payload.festivalId,payload,expires_at:payload.expiresAt});
      // Caller must not log this result, and must use no-store response headers.
      return {token,expiresAt:payload.expiresAt};
    },
    async resolve(request) {
      if(!await rateLimit(request))return null;
      const token=request.token;
      if(typeof token!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token))return null;
      const row=await repository.resolve(hash(token));
      if(!row || row.revoked_at || Date.parse(row.expires_at)<=now() || !Number.isFinite(Date.parse(row.expires_at)))return null;
      // Re-project persisted data through the allowlist. Never return arbitrary
      // stored JSON, even if a bad service writer bypassed the creation gate.
      try {
        const end = await editionEndFor(row.festival_id);
        if (!end || row.payload?.festivalId !== row.festival_id || row.payload?.kind !== row.kind) return null;
        return makePublicPlan({...row.payload,editionEnd:end},now());
      } catch { return null; }
    },
    async revoke(request) {
      const owner=await auth(request);if(!owner?.id)throw new Error('Authentication required');
      if(typeof request.id!=='string' || !/^[a-f0-9-]{36}$/.test(request.id))throw new Error('Invalid share ID');
      // Repository must include owner_id in UPDATE WHERE and refuse no-match.
      return await repository.revoke(request.id,owner.id,new Date(now()).toISOString());
    },
  };
}

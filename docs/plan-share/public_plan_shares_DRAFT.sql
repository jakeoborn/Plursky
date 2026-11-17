-- DRAFT FOR REVIEW ONLY. Not applied to any database, and deliberately NOT in
-- supabase/migrations so no `supabase db push` can pick it up. Row 4 stage 1
-- ships no schema; this file moves only after Jake's payload/privacy review.
-- Source: plursky-plan-share-stage2-670c1c85.patch (#plur-spec, 2026-09-30).
-- Server adapter validates exact-edition payload with public-plan-share.mjs.
-- No anonymous table SELECT. Lookup is a narrow bearer-token function.
create table public.public_plan_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('schedule','map','playlist')),
  festival_id text not null check (festival_id ~ '^[a-zA-Z0-9_-]{1,120}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 65536),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (payload ? 'kind' and payload->>'kind' = kind),
  check (payload ? 'festivalId' and payload->>'festivalId' = festival_id)
);
alter table public.public_plan_shares enable row level security;
revoke all on public.public_plan_shares from anon;
revoke all on public.public_plan_shares from authenticated;
-- Management reads only. Creation/revocation go through the validated server
-- adapter so an authenticated client cannot write unvalidated private data.
grant select on public.public_plan_shares to authenticated;
create policy owner_read_public_plan_shares on public.public_plan_shares
  for select to authenticated using (auth.uid() = owner_id);

-- Hash passed by server adapter, NOT directly exposed through anon RPC.
-- This is defense in depth; the server rate-limits and applies no-store.
create or replace function public.resolve_public_plan_share(p_token_hash text)
returns jsonb language sql stable security definer
set search_path = pg_catalog, public
as $$
  select payload from public.public_plan_shares
  where token_hash = p_token_hash
    and revoked_at is null and expires_at > now()
  limit 1
$$;
revoke all on function public.resolve_public_plan_share(text) from public;
revoke all on function public.resolve_public_plan_share(text) from anon, authenticated;
grant execute on function public.resolve_public_plan_share(text) to service_role;

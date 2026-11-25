-- public_shares, as applied on the live Supabase project.
-- READ BACK from the database on 2026-11-25 (information_schema, pg_constraint,
-- pg_policies, pg_get_functiondef, pg_get_triggerdef). It is not a migration
-- to run: it records what exists, so the client in this repo can be reviewed
-- against it. It supersedes public_plan_shares_DRAFT.sql, which was an earlier
-- design (hashed tokens, service-role resolver) that never shipped.

create table public.public_shares (
  token        text        primary key,
  owner_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind         text        not null,
  festival_id  text        not null,
  payload      jsonb       not null,
  display_name text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  constraint public_shares_kind_check     check (kind = any (array['schedule','map','playlist'])),
  constraint public_shares_token_check    check (char_length(token) >= 21),
  constraint public_shares_token_shape    check (token ~ '^[A-Za-z0-9_-]{43}$'),
  constraint public_shares_festival_id    check (festival_id ~ '^[a-zA-Z0-9_-]{1,120}$'),
  constraint public_shares_lifetime       check (expires_at > created_at and expires_at <= created_at + interval '400 days'),
  constraint public_shares_payload_shape  check (jsonb_typeof(payload) = 'object'
                                                 and payload->>'kind' = kind
                                                 and payload->>'festivalId' = festival_id
                                                 and pg_column_size(payload) <= 65536)
);

-- Row level security: on. Every policy is the owner's, for signed-in users only.
-- anon has no policy, so the table itself returns and accepts nothing for anon.
alter table public.public_shares enable row level security;
create policy "owner select" on public.public_shares for select to authenticated using (owner_id = auth.uid());
create policy "owner insert" on public.public_shares for insert to authenticated with check (owner_id = auth.uid());
create policy "owner revoke" on public.public_shares for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner delete" on public.public_shares for delete to authenticated using (owner_id = auth.uid());

-- A signed-in user may UPDATE only revoked_at (column-level grant).
-- authenticated: UPDATE (revoked_at). No other UPDATE column.

-- The owner is always the caller: a client cannot insert a row for someone else.
create or replace function public.public_shares_owner() returns trigger
  language plpgsql security definer set search_path to 'public'
as $$ begin new.owner_id := auth.uid(); return new; end $$;
create trigger public_shares_owner before insert on public.public_shares
  for each row execute function public_shares_owner();

-- The only anonymous read: one live row by its token, five columns.
-- No token, owner_id, created_at or revoked_at leaves. Revoked or expired
-- rows return nothing, so plan.html shows its one "ended" state.
create or replace function public.get_public_share(p_token text)
  returns table(kind text, festival_id text, payload jsonb, display_name text, expires_at timestamptz)
  language sql stable security definer set search_path to 'public'
as $$
  select kind, festival_id, payload, display_name, expires_at
  from public.public_shares
  where token = p_token and revoked_at is null and expires_at > now()
$$;
-- EXECUTE on get_public_share: anon, authenticated (and postgres, service_role).

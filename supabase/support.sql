-- BoostForge support inbox.
--
-- Signed-in users can submit support messages; ONLY the owner's admin account
-- (email below) can read or manage them. This is enforced at the database
-- level via RLS, so even with the public anon key nobody else can list the
-- messages — the admin page is just a convenient view on top of it.
--
-- Run this once in the Supabase SQL editor. The admin account itself must
-- exist in Authentication → Users (see supabase/README.md for how to create it).

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  email       text,
  user_id     uuid,
  message     text not null,
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.support_messages enable row level security;

-- Any signed-in user (email or GitHub) may submit a message.
drop policy if exists "users submit support" on public.support_messages;
create policy "users submit support"
  on public.support_messages for insert to authenticated
  with check (true);

-- Only the owner's admin account may read every message.
drop policy if exists "admin reads support" on public.support_messages;
create policy "admin reads support"
  on public.support_messages for select to authenticated
  using (lower(auth.jwt() ->> 'email') = 'miujdonsagok@gmail.com');

-- Only the owner may mark a message handled.
drop policy if exists "admin updates support" on public.support_messages;
create policy "admin updates support"
  on public.support_messages for update to authenticated
  using (lower(auth.jwt() ->> 'email') = 'miujdonsagok@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'miujdonsagok@gmail.com');

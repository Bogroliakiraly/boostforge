-- BoostForge anti-abuse: one free trial per device, and a device cap per
-- account, so people can't farm endless 1-day trials with throwaway emails on
-- the same PC, or hand one paid login around to an unlimited number of
-- installs. "Device" = this Windows installation's stable MachineGuid (read
-- by the app's `get_device_id` command).
--
-- Honest limitation: a determined abuser could still reinstall Windows or
-- spoof the ID — this raises the bar meaningfully, it is not unbeatable.
--
-- Run this once in the Supabase SQL editor, alongside schema.sql and support.sql.

create table if not exists public.trial_devices (
  device_id   text primary key,
  email       text not null,
  created_at  timestamptz not null default now()
);
alter table public.trial_devices enable row level security;

drop policy if exists "read own trial device rows" on public.trial_devices;
create policy "read own trial device rows"
  on public.trial_devices for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Any signed-in user may attempt to register their device — the primary key
-- on device_id is what actually enforces "one trial per device": if a row for
-- this device already exists (from ANY account), a second insert simply fails,
-- and the app treats that as "trial already used here".
drop policy if exists "register a trial device" on public.trial_devices;
create policy "register a trial device"
  on public.trial_devices for insert to authenticated
  with check (true);

create table if not exists public.account_devices (
  email       text not null,
  device_id   text not null,
  first_seen  timestamptz not null default now(),
  primary key (email, device_id)
);
alter table public.account_devices enable row level security;

drop policy if exists "read own account devices" on public.account_devices;
create policy "read own account devices"
  on public.account_devices for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "register own account device" on public.account_devices;
create policy "register own account device"
  on public.account_devices for insert to authenticated
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

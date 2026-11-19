-- Ayn live demo schema.
-- Paste this into the Supabase SQL editor (Dashboard -> SQL -> New query) and
-- run it once. It creates the two live tables, opens them for anonymous reads,
-- and adds them to the realtime publication.
--
--   scenario        one row: which forecast hour every dashboard should show
--   train_readings  one row per train per hour: the live numbers
--
-- The dashboard only ever reads. Writes come from scripts/live-demo.mjs (or
-- the table editor) using the service role key, which bypasses RLS.

create table if not exists public.scenario (
  id integer primary key default 1 check (id = 1),
  hour integer not null default 0 check (hour between 0 and 72),
  playing boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.train_readings (
  train_id text not null,
  hour integer not null check (hour between 0 and 72),
  pressure_drop numeric not null,
  feed_pressure numeric,
  permeate_flow numeric,
  salt_rejection numeric,
  energy_use numeric,
  sdi numeric,
  days_since_clean numeric,
  updated_at timestamptz not null default now(),
  primary key (train_id, hour)
);

create index if not exists train_readings_hour_idx on public.train_readings (hour);

alter table public.scenario enable row level security;
alter table public.train_readings enable row level security;

drop policy if exists "scenario is public" on public.scenario;
create policy "scenario is public"
  on public.scenario for select
  to anon, authenticated
  using (true);

drop policy if exists "readings are public" on public.train_readings;
create policy "readings are public"
  on public.train_readings for select
  to anon, authenticated
  using (true);

-- Table privileges. RLS policies only filter rows; the roles still need the
-- grants themselves (some projects do not grant these by default).
grant usage on schema public to anon, authenticated;
grant select on public.scenario to anon, authenticated;
grant select on public.train_readings to anon, authenticated;
grant all on public.scenario to service_role;
grant all on public.train_readings to service_role;

-- Any device may move the shared clock: the laptop slider writes it, the phone
-- follows. Demo-grade by design — there is no auth on this row.
drop policy if exists "scenario is writable" on public.scenario;
create policy "scenario is writable"
  on public.scenario for update
  to anon, authenticated
  using (true)
  with check (id = 1);

grant update on public.scenario to anon, authenticated;

-- Realtime: stream inserts/updates from both tables to the browser.
do $$
begin
  begin
    alter publication supabase_realtime add table public.scenario;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.train_readings;
  exception
    when duplicate_object then null;
  end;
end $$;

-- Start the demo at "now" so a fresh project renders immediately.
insert into public.scenario (id, hour, playing)
values (1, 0, true)
on conflict (id) do nothing;

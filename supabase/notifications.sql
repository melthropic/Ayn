-- Ayn crew notifications.
-- Run this once in the Supabase SQL editor, after schema.sql. It is safe to
-- run again.
--
-- One row per "Notify crew" message. The server writes rows with the service
-- role key; dashboards read them and follow changes over realtime, so an
-- acknowledgement tapped in Telegram shows up on every screen.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- 'auto' when a train first went critical during playback, 'manual' for the button
  kind text not null check (kind in ('auto', 'manual')),
  train_id text not null,
  plant_id text not null,
  -- forecast hour on screen when it was sent
  hour integer not null check (hour between 0 and 72),
  message text not null,
  -- stops the same automatic alert being sent twice in one playback run
  dedupe_key text unique,
  telegram_chat_id text,
  telegram_message_id bigint,
  sent_at timestamptz not null default now(),
  delivered boolean not null default false,
  acknowledged_at timestamptz,
  acknowledged_by text
);

create index if not exists notifications_sent_at_idx on public.notifications (sent_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications are public" on public.notifications;
create policy "notifications are public"
  on public.notifications for select
  to anon, authenticated
  using (true);

grant select on public.notifications to anon, authenticated;
grant all on public.notifications to service_role;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

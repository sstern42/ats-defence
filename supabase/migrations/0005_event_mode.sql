-- Which mode a run was played in, on every event.
--
-- Promoted to a column for the same reason the other globals were: every
-- question in the analytics spec now has two answers, one per mode, and there
-- is no way to tell them apart from an event that does not say which game it
-- came from. Where players quit, whether the curve is right and which towers
-- are dead weight are all mode specific from here on.
--
-- Nullable, and every row already in the table is a classic run, since that was
-- the only mode there was. Backfilled rather than defaulted, so a row arriving
-- later without a readable mode stays visibly null instead of being quietly
-- counted as classic.

alter table public.analytics_events
  add column if not exists mode text;

update public.analytics_events
  set mode = 'classic'
  where mode is null;

alter table public.analytics_events
  drop constraint if exists analytics_events_mode_length;

alter table public.analytics_events
  add constraint analytics_events_mode_length
  check (mode is null or char_length(mode) <= 32);

-- Nearly every read now filters or groups by mode alongside the event name.
create index if not exists analytics_events_mode_idx
  on public.analytics_events (mode, event);

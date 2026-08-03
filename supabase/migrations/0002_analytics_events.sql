-- Analytics event storage.
--
-- Same posture as the leaderboard: row level security on, no policies, no
-- grants for anon or authenticated. Everything goes through a Netlify function
-- holding the service role key, and the browser holds no database key at all.
--
-- The six global properties are promoted to columns because every question in
-- the analytics spec filters or groups by them, and because the experiment
-- analysis reads `variant_assignments` on nearly every query. The full
-- property bag is kept alongside in `properties`, so an event that gains a
-- field later is not lost for want of a migration.

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,

  event text not null,

  -- The globals, lifted out of the property bag for querying.
  session_id text not null,
  run_id text,
  wave_number integer,
  variant_assignments jsonb,
  device_type text,
  referrer text,

  -- Everything the event carried, globals included, exactly as sent.
  properties jsonb not null,

  -- When the browser says it sent it, and when we actually got it. They differ
  -- for anything queued by sendBeacon on a closing page, which is most of the
  -- run_abandoned events.
  sent_at timestamptz,
  received_at timestamptz not null default now(),

  -- Salted hash, for rate limiting only. Never the address itself.
  ip_hash text not null,

  constraint analytics_events_event_length check (char_length(event) <= 64)
);

-- The common shapes: everything of one type over a period, one run in order,
-- and the rate limit check.
create index if not exists analytics_events_event_time_idx
  on public.analytics_events (event, received_at desc);

create index if not exists analytics_events_run_idx
  on public.analytics_events (run_id, received_at);

create index if not exists analytics_events_rate_limit_idx
  on public.analytics_events (ip_hash, received_at desc);

alter table public.analytics_events enable row level security;

revoke all on public.analytics_events from anon, authenticated;

grant select, insert on public.analytics_events to service_role;

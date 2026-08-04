-- Country on every event.
--
-- Derived server side from the platform's own geo lookup, not from anything
-- the browser sends and not from the address, which is still only ever stored
-- as a salted hash.
--
-- Country and no finer. City would answer no question this project has and
-- would make a row about a single player considerably more identifying,
-- particularly at the traffic levels a launch post produces.

alter table public.analytics_events
  add column if not exists country text;

alter table public.analytics_events
  drop constraint if exists analytics_events_country_shape;

alter table public.analytics_events
  add constraint analytics_events_country_shape
  check (country is null or country ~ '^[A-Z]{2}$');

create index if not exists analytics_events_country_idx
  on public.analytics_events (country);

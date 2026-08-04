-- Browser and operating system families on every event.
--
-- Derived server side from the user agent header. The header itself is never
-- stored: it is long, self reported, and detailed enough to help identify a
-- single visitor, whereas the family it belongs to answers the only question
-- this project asks of it, which is whether anything is broken in a browser
-- nobody tested.
--
-- Families only, never versions, for the same reason.

alter table public.analytics_events
  add column if not exists browser text;

alter table public.analytics_events
  add column if not exists os text;

alter table public.analytics_events
  drop constraint if exists analytics_events_agent_length;

alter table public.analytics_events
  add constraint analytics_events_agent_length
  check (
    (browser is null or char_length(browser) <= 32)
    and (os is null or char_length(os) <= 32)
  );

-- Grouping by one or both is the only read either column gets.
create index if not exists analytics_events_agent_idx
  on public.analytics_events (browser, os);

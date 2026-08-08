-- What is arriving, and on what.
--
-- None of the six questions in the analytics spec asks this, which is why
-- leaderboard-and-players.sql says under "What is deliberately not here" that
-- it carries no split by `device_type`. That still holds for the six. This file
-- is the split on its own, kept apart from them, because the question it
-- answers is a different one: the game was built desktop first, phones are
-- turned away at the door, tablets were let in afterwards, and none of that was
-- ever read back off the data.
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the other files here.
--
--
-- The cutoff
-- ----------
--
-- Every session in the database up to 4 August 2026 was the developer testing
-- the game, on the developer's machine, which is a desktop. Leaving them in
-- does not add noise evenly: it adds it entirely to one row of every query
-- below. So the same instant the other files use is on every query here:
--
--   >>> received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
--
-- marked `-- cutoff`. If it moves, move all of them, in this file and in the
-- others, and remember that a value in the future returns nothing rather than
-- erroring.
--
--
-- The mode
-- --------
--
-- Only query 5 filters by mode, and it is the only query here that counts runs.
-- The other six count sessions, and a session is not in a mode: it begins on
-- the home screen before the player has chosen anything, and `mode` on those
-- events records the setting rather than a decision. This is the same exception
-- the coverage queries in the other files take, for the same reason.
--
-- Query 5 reads classic unless it is told otherwise, marked `-- mode`.
--
--
-- Five things about this data are worth knowing before any of it is believed
-- -------------------------------------------------------------------------
--
-- **`device_type` is a guess made in the browser, from the user agent.** Three
-- values, `desktop`, `mobile` and `tablet`, decided by two regular expressions
-- in src/services/analytics.js and nothing else. It is coarse on purpose and it
-- is wrong in known ways. An Android tablet that does not put the word "Tablet"
-- in its user agent is counted as mobile, and there are a lot of those. An iPad
-- on iPadOS 13 or later reports itself as a Macintosh and is counted as
-- desktop, and there is no way to tell it from a Mac in this table, because the
-- `os` column is derived from the same string. Read the tablet row as a floor,
-- never as a count.
--
-- **The support gate does not test any of this.** It tests the size of the
-- window, 900 by 600, and nothing else. So `device_type` and "was allowed to
-- play" are two different facts that mostly agree and sometimes do not: a large
-- Android tablet reported as mobile gets in, a phone never does, and a laptop
-- with a narrow window is turned away while counting as desktop throughout.
-- Query 4 is the one that shows the disagreement, and the disagreement is the
-- interesting part rather than a defect in the query.
--
-- **A turned-away phone still counts as traffic, and that is deliberate.**
-- Analytics start before the gate, so a phone gets a `session_started`, an
-- `experiment_viewed` if it was bucketed, and then nothing else ever. That is
-- the whole point: how many people arrive on a device the game refuses is a
-- thing worth knowing, and it is only knowable because the session is opened
-- before the refusal. Query 4 is built on exactly those two being the only
-- events a refused session can produce.
--
-- **`session_started` fires once per session, not once per page load.** A
-- reload is the same session carrying on and is not announced again, so the
-- arrival event is one per session and counting it is counting arrivals. What
-- it is not is complete: an event can be lost in transit and the session it
-- belonged to carries on emitting everything else. Query 1 counts arrivals and
-- query 2 counts sessions from every event, and the gap between them is lost
-- beacons rather than a finding.
--
-- **Sessions are not people.** Somebody who arrives on a phone, gives up and
-- opens it on a laptop later is two sessions on two devices, and nothing here
-- can join them. At this traffic level that is a rounding error, and it is also
-- exactly the journey the desktop-only message is meant to produce, so the
-- honest reading is that the two rows are not independent.


-- ---------------------------------------------------------------------------
-- 1. Incoming traffic, on what. `session_started` and nothing else.
--
-- The answer to the question, and the query to run if only one gets run.
--
-- One row per device type, counted off the arrival event alone. That is the
-- narrowest honest reading of "how much traffic": `session_started` fires once
-- when somebody turns up and never again, so a row here is a visit rather than
-- a session that happened to be busy. It also counts a phone that arrived, read
-- the desktop-only message and left, because the analytics start before the
-- support gate and that refusal is exactly the traffic worth measuring.
--
-- Distinct sessions rather than a count of rows, because the two should be
-- equal and there is no reason to find out the hard way that they are not. The
-- device comes off the same event, since it is a global property.
--
-- `bot_sessions` is the number in each row that announced itself as automated.
-- The user agent classifier has a bucket for it and crawlers do not carry
-- phones, so in practice this is a subtraction to apply to the desktop row
-- before quoting a desktop share to anybody. Most scrapers never run the
-- JavaScript and so never reach here at all; the ones that do would otherwise
-- look like a launch day visitor.
--
-- `(unrecognised)` is a device type the collector would not store, which it
-- refuses unless it is one of the three. Anything above zero means the game is
-- sending a fourth value and one of the two is wrong.
-- ---------------------------------------------------------------------------

select
  coalesce(device_type, '(unrecognised)') as device_type,
  count(distinct session_id) as arrivals,
  round(
    100.0 * count(distinct session_id)
      / nullif(sum(count(distinct session_id)) over (), 0),
    1
  ) as pct_of_arrivals,
  count(distinct session_id) filter (where browser = 'bot') as bot_sessions,
  min(received_at) as first_seen,
  max(received_at) as latest_seen
from public.analytics_events
where event = 'session_started'
  and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
group by device_type
order by arrivals desc;


-- ---------------------------------------------------------------------------
-- 2. The same count, taken from every event instead. The check on query 1.
--
-- `device_type` is a global property, so it is on all fourteen events and not
-- just the arrival. That makes the session count available twice over, by two
-- routes that fail differently, and comparing them is free.
--
-- They should agree. Where they do not, query 1 is the one that is short: an
-- arrival beacon can be lost in transit while the session it belonged to
-- carries on emitting everything else, and there is no route by which a session
-- gains an arrival it never had. `sessions_with_no_arrival` counts the gap
-- directly.
--
-- If that number is small, use query 1 and stop reading this one. If it is not
-- small, the shortfall is not spread evenly: a refused phone emits one or two
-- events in its entire life, so losing the arrival can lose the whole session,
-- while a desktop losing its arrival is still counted here by the other forty.
-- A large gap therefore understates handhelds in query 1 specifically, which is
-- the one direction that would matter.
--
-- The device is taken as `min(device_type)` over the session, because every
-- event carries it and they all agree, so any one of them will do.
-- ---------------------------------------------------------------------------

with sessions as (
  select
    session_id,
    min(device_type) as device_type,
    count(*) as events,
    count(*) filter (where event = 'session_started') as arrivals
  from public.analytics_events
  where received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by session_id
)
select
  coalesce(device_type, '(unrecognised)') as device_type,
  count(*) as sessions,
  round(
    100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1
  ) as pct_of_sessions,
  count(*) filter (where arrivals = 0) as sessions_with_no_arrival,
  sum(events) as events,
  round(avg(events), 1) as mean_events_per_session
from sessions
group by device_type
order by sessions desc;


-- ---------------------------------------------------------------------------
-- 3. The same thing over time.
--
-- A single share is one number for the whole life of the site, and the site has
-- had one launch post on a network most people read on a phone. That is not a
-- steady state, and query 1 averages over it.
--
-- A week is the grain because a day at this traffic level is mostly zeroes with
-- a spike in it. The week a launch lands should be the handheld high water mark
-- and every week after it should fall back towards whatever the real baseline
-- is. If it does not, the baseline is the launch, and the desktop-only message
-- is being shown to a standing share of arrivals rather than to a spike.
--
-- A session is placed in the week it was first seen, so a session that ran past
-- midnight on a Sunday belongs to the week it started in.
-- ---------------------------------------------------------------------------

with sessions as (
  select
    session_id,
    min(device_type) as device_type,
    min(received_at) as first_seen
  from public.analytics_events
  where received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by session_id
)
select
  date_trunc('week', first_seen)::date as week_beginning,
  count(*) as sessions,
  count(*) filter (where device_type = 'desktop') as desktop,
  count(*) filter (where device_type = 'mobile') as mobile,
  count(*) filter (where device_type = 'tablet') as tablet,
  round(
    100.0 * count(*) filter (where device_type in ('mobile', 'tablet'))
      / nullif(count(*), 0),
    1
  ) as pct_handheld
from sessions
group by 1
order by 1;


-- ---------------------------------------------------------------------------
-- 4. Who got the holding page instead of the game.
--
-- The query the whole file exists for. Query 1 says how many arrived. This says
-- how many of them were turned away at the door, and the difference is what the
-- desktop-first decision costs in people.
--
-- **A held session emits nothing the game had to be running to send.** That is
-- not an inference, it is the shape of main.js: analytics start, the screen is
-- measured, and a screen that fails goes to the message and returns before the
-- game is ever constructed. Nothing after that point can emit anything, because
-- nothing after that point runs.
--
-- Which leaves two events that a held session does send, and both are exempted
-- below rather than counted. `session_started` is the arrival itself. The other
-- is `experiment_viewed`, which is easy to miss: it comes from GrowthBook's
-- tracking callback, and what triggers that callback is assembling the global
-- properties of the arrival event. So a player who is bucketed reports the
-- exposure whether or not the game ever loaded, and testing for a session with
-- a single event would quietly count every bucketed phone as having played.
--
-- Everything else on the list of fourteen needs a scene to have been built. So
-- `held` counts sessions that sent none of them, and that is the number asked
-- for.
--
-- `saw_the_home_screen` is the same fact from the other side, and is here to
-- corroborate rather than to be read on its own. The home screen builds a
-- leaderboard panel automatically and the panel emits `leaderboard_viewed` with
-- `from_screen` of `home` as soon as it has rows to draw, so a session carrying
-- one of those got the game rather than the message. `held` and
-- `saw_the_home_screen` should account for very nearly every session between
-- them. What falls between the two is somebody who loaded the game and left
-- before the board came back, plus anybody whose board request failed, and if
-- that gap is wide it is the board that is broken rather than the gate.
--
-- Read `pct_held` per row rather than overall.
--
-- Mobile should be at or very near 100%, because no phone clears 900 by 600 in
-- either orientation. Mobile below 100% is not a leaking gate: it is an Android
-- tablet whose user agent never says "Tablet", counted as mobile by the browser
-- and admitted on size, correctly. Those are the sessions the touch work was
-- done for and they are sitting in the wrong row.
--
-- Tablet should be low but not zero. A small tablet in portrait is under 900
-- wide and is refused, which is the gate working as written.
--
-- Desktop should be near zero, and anything above a few per cent is the row to
-- pull on. It is either real desktops running a small window, or iPads passing
-- as Macs and failing on size, and query 7 is the one that separates them as
-- far as this table can.
-- ---------------------------------------------------------------------------

with sessions as (
  select
    session_id,
    min(device_type) as device_type,
    -- Everything except the arrival and the exposure, which are the only two a
    -- session can send without the game having been built. See the note above.
    count(*) filter (
      where event not in ('session_started', 'experiment_viewed')
    ) as game_events,
    count(*) filter (
      where event = 'leaderboard_viewed'
        and properties ->> 'from_screen' = 'home'
    ) as home_views,
    count(*) filter (where event = 'game_started') as runs_started,
    count(*) filter (where event = 'game_over') as runs_finished
  from public.analytics_events
  where received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by session_id
)
select
  coalesce(device_type, '(unrecognised)') as device_type,
  count(*) as sessions,
  count(*) filter (where game_events = 0) as held,
  round(
    100.0 * count(*) filter (where game_events = 0) / nullif(count(*), 0), 1
  ) as pct_held,
  count(*) filter (where home_views > 0) as saw_the_home_screen,
  count(*) filter (where runs_started > 0) as played,
  round(
    100.0 * count(*) filter (where runs_started > 0) / nullif(count(*), 0), 1
  ) as pct_played,
  count(*) filter (where runs_finished > 0) as finished_a_run
from sessions
group by device_type
order by sessions desc;


-- ---------------------------------------------------------------------------
-- 5. What the ones who got in actually did.
--
-- Runs rather than sessions, so this is the only query here carrying a mode
-- filter. Wave five is a different intake in each mode and pooling them would
-- compare the boards rather than the devices.
--
-- The question is whether a touch player has the same game as a mouse player.
-- The controls were rebuilt so a finger could preview a tower before committing
-- to it, and if that worked, the median intake and the towers placed should sit
-- close together across the rows. A touch row that places noticeably fewer
-- towers is the tell, because placing towers is the only thing the touch route
-- changed and it is the thing a player does instead of nothing.
--
-- Read the cell sizes before the medians. Tablet traffic is a small share of a
-- small number, and a median over four runs is an anecdote with a decimal point
-- on it. `runs` is in the output for that reason and is not decoration.
--
-- `scores_submitted` is the last thing the touch work closed, since a name
-- could not be typed on a tablet until an invisible form field was put over the
-- drawn box. A tablet row of zero submissions against a healthy
-- `reached_game_over` means that field is not doing its job.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min(device_type) as device_type
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by run_id
),
outcomes as (
  select
    run_id,
    max((properties ->> 'final_wave')::int)
      filter (where event = 'game_over') as final_wave,
    count(*) filter (where event = 'tower_placed') as towers_placed,
    count(*) filter (where event = 'score_submitted') as submissions
  from public.analytics_events
  where run_id is not null
  group by run_id
)
select
  coalesce(r.device_type, '(unrecognised)') as device_type,
  count(*) as runs,
  count(o.final_wave) as reached_game_over,
  percentile_cont(0.5) within group (order by o.final_wave) as median_intake,
  max(o.final_wave) as furthest_intake,
  round(avg(o.towers_placed), 1) as mean_towers_placed,
  count(*) filter (where o.submissions > 0) as scores_submitted
from runs r
left join outcomes o on o.run_id = r.run_id
group by r.device_type
order by runs desc;


-- ---------------------------------------------------------------------------
-- 6. Where the handhelds come from.
--
-- Device against referrer, because the share in query 1 is not a fact about the
-- game, it is a fact about where the link was posted. A professional network
-- read on a phone at lunchtime and a link pasted into a desktop chat client
-- produce different rows here, and only one of them is worth changing anything
-- over.
--
-- This is the query to run before concluding that phone support is needed. If
-- the handheld share is concentrated in one referrer, the finding is about that
-- referrer. If it is spread evenly across all of them, it is about the web.
--
-- The referrer is reduced to a host, since the full URL varies per post and
-- would put every share of the same link on its own row. `direct` is the
-- literal string the game sends when the browser reports no referrer, which
-- covers a typed address, an app that strips it and most link previews.
-- ---------------------------------------------------------------------------

with sessions as (
  select
    session_id,
    min(device_type) as device_type,
    min(referrer) as referrer,
    count(*) filter (where event = 'game_started') as runs_started
  from public.analytics_events
  where received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by session_id
)
select
  case
    when referrer is null or referrer = '' then '(none reported)'
    when referrer = 'direct' then '(direct)'
    else split_part(split_part(referrer, '//', 2), '/', 1)
  end as source,
  count(*) as sessions,
  count(*) filter (where device_type = 'desktop') as desktop,
  count(*) filter (where device_type = 'mobile') as mobile,
  count(*) filter (where device_type = 'tablet') as tablet,
  round(
    100.0 * count(*) filter (where device_type in ('mobile', 'tablet'))
      / nullif(count(*), 0),
    1
  ) as pct_handheld,
  round(
    100.0 * count(*) filter (where runs_started > 0) / nullif(count(*), 0), 1
  ) as pct_played
from sessions
group by 1
order by sessions desc;


-- ---------------------------------------------------------------------------
-- 7. The classification, checked against the other two columns.
--
-- `device_type` is decided in the browser from the user agent. `browser` and
-- `os` are decided on the server from the same string. They are two readings of
-- one source, so they cannot confirm each other, but they can disagree, and the
-- disagreements are the known failures listed at the top of this file.
--
-- Three rows to look for.
--
-- A `desktop` row on `android` or `ios` is a handheld counted as a desktop, and
-- the count is how much of the tablet row is missing.
--
-- A `desktop` row on `macos` with a high `pct_never_played` is the iPad case,
-- as close as this table can get to it. A Mac is rarely run in a window under
-- 900 by 600, and an iPad in portrait is 820 wide and fails every time, so
-- Safari on macOS that never starts a run is the shape an iPad leaves behind.
-- It is a hint and not a measurement, and it is the only one available.
--
-- A `bot` row anywhere is traffic that is not a person, and it belongs in the
-- head of query 1 as a subtraction rather than in any conclusion.
-- ---------------------------------------------------------------------------

with sessions as (
  select
    session_id,
    min(device_type) as device_type,
    min(os) as os,
    min(browser) as browser,
    count(*) filter (where event = 'game_started') as runs_started
  from public.analytics_events
  where received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by session_id
)
select
  coalesce(device_type, '(unrecognised)') as device_type,
  coalesce(os, '(unknown)') as os,
  coalesce(browser, '(unknown)') as browser,
  count(*) as sessions,
  count(*) filter (where runs_started = 0) as never_played,
  round(
    100.0 * count(*) filter (where runs_started = 0) / nullif(count(*), 0), 1
  ) as pct_never_played
from sessions
group by device_type, os, browser
order by sessions desc, device_type, os, browser;

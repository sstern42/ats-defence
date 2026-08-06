-- What the players and the leaderboard entries say.
--
-- Questions 1, 2, 3, 5 and 6 of the six in the analytics spec. Question 4 is
-- in tower-usage.sql and is not repeated here.
--
--   1. Where do players quit?          queries 3, 4
--   2. Is the difficulty curve right?  queries 5, 6
--   3. Do players replay after losing? query 7
--   5. Does the leaderboard drive replays? queries 8, 9, 10, 11
--   6. Does the tip jar convert?       query 12
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the other two files, because
-- a query that can be copied on its own is worth more here than a file with no
-- duplication in it.
--
-- Nothing here splits by experiment arm, on purpose, and for the same reason
-- tower-usage.sql does not. The starting difficulty experiment is read out
-- once, at its stopping point, and an arm breakdown of anything is that readout
-- happening early under another name. These pool both arms. After the
-- experiment is called, splitting them is fine.
--
--
-- The cutoff
-- ----------
--
-- Every run in the database up to 4 August 2026 was the developer testing the
-- game, and nothing in an event distinguishes those from a player. So the
-- cutoff is by time, and it is the same instant the experiment file uses:
--
--   >>> received_at >= timestamptz '2026-08-04 07:16:00+00'   -- events
--   >>> submitted_at >= timestamptz '2026-08-04 07:16:00+00'  -- board rows
--
-- It appears in every query below, marked `-- cutoff`. If it moves, move all
-- of them, in this file and in the experiment file, and remember that a value
-- in the future silently returns nothing rather than erroring.
--
-- The board gets the same instant applied to `submitted_at`. That is an
-- assumption rather than a fact, since a board row carries no event: it holds
-- because a score is submitted within a minute or two of the run that produced
-- it, and it fails only for somebody who left the game over screen open
-- overnight before typing a name. Query 8 joins each row to its run and will
-- show any row whose run is on the other side of the line.
--
--
-- Five things about the data are worth knowing before any of it is believed
-- ------------------------------------------------------------------------
--
-- **A board row carries the run that made it.** `leaderboard.run_id` is the
-- same id as `analytics_events.run_id`, and it is unique on the table. That
-- join is what makes any of this more than a list of names: an entry is not a
-- score, it is the whole event stream of the run behind it. Nothing else in
-- the project connects a named outcome to a behavioural trace.
--
-- **`leaderboard_viewed` is not a click.** The panel fires it whenever it
-- renders rows, and both the home screen and the game over screen build one
-- automatically. So a view means the board was displayed, not that anybody
-- chose to look, and nearly every game over produces one. Comparing players
-- who saw the board with players who did not therefore compares working
-- networks with broken ones, and answers nothing. The event is used below as a
-- check that the board rendered, never as a signal of interest. What a player
-- on that screen actually chooses is whether to submit, and query 9 is built
-- on that instead.
--
-- It also fires twice for anybody who submits, once when the screen opens and
-- again when the board reloads to show them their place. Count distinct runs,
-- never events.
--
-- **A failed submission is invisible here.** `score_submitted` is emitted only
-- after the server has accepted the score, so a submission refused for an
-- implausible score, a bad name, a rate limit or a duplicate run leaves no
-- event at all. It exists in the Netlify function log and nowhere else. The
-- gap between game over and submission in query 2 therefore mixes players who
-- did not try with players who tried and were turned away, and there is no way
-- to separate them from this table.
--
-- **The run id on an event outlives the run.** It is set when a run starts and
-- never cleared, so anything emitted after a run ends, including a home screen
-- board view or a Ko-fi click from the home page, still carries the previous
-- run's id. Join those to a session, never to a run. Queries 11 and 12 do.
--
-- **Runs are the unit, not people.** A player who plays four times is four
-- runs, and a player who comes back tomorrow is a new session. Nothing here
-- counts people, and query 11 is the closest it gets, deliberately.
--
--
-- What is deliberately not here
-- -----------------------------
--
-- Any split by `device_type`, `browser`, `country` or `referrer`. Those
-- columns exist and every query below would accept a `group by` for them, but
-- they answer a different question from the five above, and at this traffic
-- level slicing a survival curve three ways produces cells of two runs that
-- look like findings.


-- ---------------------------------------------------------------------------
-- 1. Coverage. What is actually in the table before any of it is believed.
--
-- Run this first. The shape to check is that the counts fall in the order the
-- game emits them: a session_started for every session, a game_started for
-- every run, far more wave_started than game_over, and a handful of the rest.
--
-- An event type missing from this list entirely is the loud failure. It means
-- either that nobody has done the thing, or that the call site is not wired
-- up, and the two look identical from here.
--
-- `runs` is null for session_started by design, since a session has no run
-- yet. It is not null for a home screen board view, which is the stale run id
-- described in the header rather than a run that viewed anything.
-- ---------------------------------------------------------------------------

select
  event,
  count(*) as events,
  count(distinct session_id) as sessions,
  count(distinct run_id) as runs,
  min(received_at) as first_seen,
  max(received_at) as last_seen
from public.analytics_events
where received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
group by event
order by events desc;


-- ---------------------------------------------------------------------------
-- 2. The funnel, from opening the page to landing on the board.
--
-- Six steps and one check. `pct_of_previous` is the drop at each step, and
-- `pct_of_sessions` is what is left of the people who arrived.
--
-- Two of the steps do not behave like a funnel, on purpose.
--
-- Runs exceed sessions that started a run, because a session can hold several
-- runs. A `pct_of_previous` above 100 there is the replay rate showing up, and
-- query 7 is where it is read properly.
--
-- Board rows can exceed submissions. Every accepted submission emits
-- `score_submitted`, so the two should match, and the ways they can fail to
-- are worth knowing: more rows than events means an event was lost on its way
-- to the collector, which happens, or that a row was written by something
-- other than the game. Fewer rows than events cannot happen honestly at all.
-- The last step is the reconciliation: rows whose run is a run we have seen.
-- ---------------------------------------------------------------------------

with sessions as (
  select distinct session_id
  from public.analytics_events
  where event = 'session_started'
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
runs as (
  select
    e.run_id,
    min(e.session_id) as session_id
  from public.analytics_events e
  join sessions s on s.session_id = e.session_id
  where e.event = 'game_started'
    and e.run_id is not null
  group by e.run_id
),
finished as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'game_over'
),
submitted as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'score_submitted'
),
board as (
  select run_id
  from public.leaderboard
  where submitted_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
steps (step, stage, n) as (
  select 1, 'sessions', (select count(*) from sessions)
  union all
  select 2, 'sessions that started a run',
    (select count(distinct session_id) from runs)
  union all
  select 3, 'runs', (select count(*) from runs)
  union all
  select 4, 'runs reaching game over', (select count(*) from finished)
  union all
  select 5, 'runs with a score submitted', (select count(*) from submitted)
  union all
  select 6, 'rows on the board', (select count(*) from board)
  union all
  select 7, 'board rows matching a run',
    (select count(*) from board b join runs r on r.run_id = b.run_id)
)
select
  step,
  stage,
  n,
  round(100.0 * n / nullif(lag(n) over (order by step), 0), 1)
    as pct_of_previous,
  round(100.0 * n / nullif(first_value(n) over (order by step), 0), 1)
    as pct_of_sessions
from steps
order by step;


-- ---------------------------------------------------------------------------
-- 3. Where runs end. The direct answer to question 1.
--
-- One row per wave. `reached` and `pct_reached` are the survival curve pooled
-- across both arms, `ended_here` is how many runs stopped at that wave, and
-- the three columns after it say how they stopped.
--
-- Wave 0 is not a wave. It is a run that started and never reached the first
-- one, which is a real way to leave: the first preparation is fifteen seconds
-- of an empty board, and a player who decides against the game during it emits
-- a `game_started` and nothing else. Those runs sit in every denominator, so
-- they get a row rather than being dropped.
--
-- `no_ending` is a run with neither a `game_over` nor a `run_abandoned`. It is
-- not a category of player, it is a lost event: a tab closed from a background
-- window may never run the handler. Treat it as the measurement error on the
-- other two columns rather than as a third outcome.
--
-- Ten waves, so the series stops at ten. If the wave count in
-- src/config/waves.js changes, change it here too.
-- ---------------------------------------------------------------------------

with runs as (
  select distinct run_id
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
furthest as (
  select
    e.run_id,
    max(e.wave_number) as wave
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'wave_started'
  group by e.run_id
),
endings as (
  select
    e.run_id,
    bool_or(e.event = 'game_over') as finished
  from public.analytics_events e
  join runs r using (run_id)
  where e.event in ('game_over', 'run_abandoned')
  group by e.run_id
),
waves as (
  select generate_series(0, 10) as wave
)
select
  w.wave,
  count(*) filter (where coalesce(f.wave, 0) >= w.wave) as reached,
  round(
    100.0 * count(*) filter (where coalesce(f.wave, 0) >= w.wave) / count(*), 1
  ) as pct_reached,
  count(*) filter (where coalesce(f.wave, 0) = w.wave) as ended_here,
  count(*) filter (where coalesce(f.wave, 0) = w.wave and e.finished)
    as game_over,
  count(*) filter (
    where coalesce(f.wave, 0) = w.wave and e.run_id is not null
      and not e.finished
  ) as abandoned,
  count(*) filter (where coalesce(f.wave, 0) = w.wave and e.run_id is null)
    as no_ending
from runs r
cross join waves w
left join furthest f on f.run_id = r.run_id
left join endings e on e.run_id = r.run_id
group by w.wave
order by w.wave;


-- ---------------------------------------------------------------------------
-- 4. How runs end, and how far they got when they did.
--
-- The other half of question 1. Query 3 says which wave, this says which door.
--
-- Five reasons and a game over. `unload`, `hidden` and `idle` are a player
-- disappearing, and the differences between them are described at length in
-- docs/experiment-starting-difficulty.md: `hidden` is a thirty second guess
-- and the least trustworthy of the three. `restart` and `quit` come from the
-- pause screen and are a player deciding something rather than vanishing,
-- which makes them the most reliable rows here and the least representative.
--
-- `won` is a run that cleared the last wave. There is no property for it: the
-- game over event carries the same shape whether the vacancy was filled or the
-- intake was survived, so winning is a `wave_completed` on the final wave.
-- ---------------------------------------------------------------------------

with runs as (
  select distinct run_id
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
endings as (
  select
    e.run_id,
    case
      when bool_or(e.event = 'game_over') then 'game over'
      else 'abandoned: ' || min(e.properties ->> 'reason')
    end as ending,
    max(e.wave_number) as final_wave
  from public.analytics_events e
  join runs r using (run_id)
  where e.event in ('game_over', 'run_abandoned')
  group by e.run_id
),
won as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'wave_completed'
    and e.wave_number = 10
)
select
  coalesce(en.ending, 'no ending recorded') as ending,
  count(*) as runs,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_runs,
  count(*) filter (where w.run_id is not null) as won,
  round(
    percentile_cont(0.5) within group (order by en.final_wave)::numeric, 1
  ) as median_final_wave
from runs r
left join endings en on en.run_id = r.run_id
left join won w on w.run_id = r.run_id
group by coalesce(en.ending, 'no ending recorded')
order by runs desc;


-- ---------------------------------------------------------------------------
-- 5. The difficulty curve. Question 2.
--
-- Per wave: how many runs started it, how many got through it, how long it
-- took and what it cost them. `pct_completed` is the number the question turns
-- on, because it is the only one that holds the population fixed: it asks what
-- happened to the players who were actually there, rather than what share of
-- everybody who ever pressed play was still present.
--
-- A curve that falls smoothly is a difficulty curve. A single wave whose
-- completion rate drops well below its neighbours is a wall, and the wave
-- after a wall usually looks easy for no reason other than that only the
-- survivors are in it.
--
-- `median_duration_s` reads the clock the game kept, which starts when the
-- wave starts and stops when the last applicant in it is gone, so it excludes
-- the preparation pause before it. A wave getting slower as the waves go up is
-- expected, since later waves send more.
--
-- `mean_lives_lost` and `mean_towers` come from the same event and describe
-- only the runs that completed the wave. The run that died in the middle of
-- wave seven never emitted a `wave_completed` for it, so the cost of the wave
-- that actually killed people is missing from these two columns by
-- construction. `pct_completed` is where that run is counted.
-- ---------------------------------------------------------------------------

with runs as (
  select distinct run_id
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
started as (
  select
    e.wave_number as wave,
    count(distinct e.run_id) as started
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'wave_started'
    and e.wave_number is not null
  group by e.wave_number
),
completed as (
  select
    e.wave_number as wave,
    count(distinct e.run_id) as completed,
    -- percentile_cont has no numeric form, so the median comes back as a
    -- double and is cast on the way out. Everything else here is exact.
    percentile_cont(0.5) within group (
      order by (e.properties ->> 'duration_ms')::numeric
    )::numeric as median_duration_ms,
    avg((e.properties ->> 'lives_lost')::numeric) as mean_lives_lost,
    avg((e.properties ->> 'towers_on_board')::numeric) as mean_towers
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'wave_completed'
    and e.wave_number is not null
  group by e.wave_number
)
select
  s.wave,
  s.started,
  coalesce(c.completed, 0) as completed,
  round(100.0 * coalesce(c.completed, 0) / s.started, 1) as pct_completed,
  round(c.median_duration_ms / 1000.0, 1) as median_duration_s,
  round(c.mean_lives_lost, 2) as mean_lives_lost,
  round(c.mean_towers, 1) as mean_towers
from started s
left join completed c on c.wave = s.wave
order by s.wave;


-- ---------------------------------------------------------------------------
-- 6. Who gets through. The other half of question 2.
--
-- Every leak is a life, and the vacancy being filled is the only way to lose,
-- so this is the list of what actually beats the player, by applicant type and
-- by wave.
--
-- Read `pct_of_type` down a row to see where a type does its damage, and
-- `leaks_per_run_at_wave` across to compare waves fairly: later waves have
-- fewer runs in them, so raw counts fall away for reasons that have nothing to
-- do with any applicant.
--
-- The Boomerang counts twice when it comes back, and the second one is a
-- separate leak event at whatever wave it returns in. That is the behaviour
-- rather than a double count.
--
-- A type that never appears leaked is either never sent or never a threat, and
-- this query cannot tell those apart. Cross-reference waves.js.
-- ---------------------------------------------------------------------------

with runs as (
  select distinct run_id
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
at_wave as (
  select
    e.wave_number as wave,
    count(distinct e.run_id) as runs_at_wave
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'wave_started'
    and e.wave_number is not null
  group by e.wave_number
),
leaks as (
  select
    e.properties ->> 'applicant_type' as applicant,
    e.wave_number as wave,
    count(*) as leaks,
    count(distinct e.run_id) as runs_leaking
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'applicant_leaked'
    and e.wave_number is not null
  group by 1, 2
)
select
  l.applicant,
  l.wave,
  l.leaks,
  round(100.0 * l.leaks / sum(l.leaks) over (partition by l.applicant), 1)
    as pct_of_type,
  l.runs_leaking,
  w.runs_at_wave,
  round(l.leaks::numeric / nullif(w.runs_at_wave, 0), 2)
    as leaks_per_run_at_wave
from leaks l
left join at_wave w on w.wave = l.wave
order by l.applicant, l.wave;


-- ---------------------------------------------------------------------------
-- 7. Do players replay after losing. Question 3.
--
-- A replay is a later `game_started` in the same session. It is measured
-- against the start of the run rather than against its ending, because the
-- ending event may arrive late or not at all: `run_abandoned` goes out through
-- sendBeacon on a closing page and its `received_at` can land after the next
-- run has already begun. Runs within a session are sequential, so a later
-- start is enough, and it does not depend on an event that might be missing.
--
-- Grouped by how the previous run ended, which is the comparison the question
-- wants: losing properly, wandering off and deciding to leave are three
-- different states to be in when you decide whether to go again.
--
-- A session is a tab. Somebody who closes the browser and comes back in the
-- evening is two sessions and reads here as two players who never replayed, so
-- every figure below is a floor. Nothing in this data can raise it.
-- ---------------------------------------------------------------------------

with runs as (
  select
    e.run_id,
    min(e.session_id) as session_id,
    min(e.received_at) as started_at,
    max((e.properties ->> 'attempt_number')::integer) as attempt_number
  from public.analytics_events e
  where e.event = 'game_started'
    and e.run_id is not null
    and e.received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by e.run_id
),
endings as (
  select
    e.run_id,
    case
      when bool_or(e.event = 'game_over') then 'game over'
      else 'abandoned: ' || min(e.properties ->> 'reason')
    end as ending
  from public.analytics_events e
  join runs r using (run_id)
  where e.event in ('game_over', 'run_abandoned')
  group by e.run_id
),
replayed as (
  select
    r.run_id,
    exists (
      select 1
      from runs later
      where later.session_id = r.session_id
        and later.started_at > r.started_at
    ) as went_again
  from runs r
)
select
  coalesce(en.ending, 'no ending recorded') as ending,
  count(*) as runs,
  count(*) filter (where p.went_again) as replayed,
  round(100.0 * count(*) filter (where p.went_again) / count(*), 1)
    as pct_replayed,
  round(avg(r.attempt_number), 2) as mean_attempt_number,
  max(r.attempt_number) as most_attempts_seen
from runs r
left join endings en on en.run_id = r.run_id
join replayed p on p.run_id = r.run_id
group by coalesce(en.ending, 'no ending recorded')
order by runs desc;


-- ---------------------------------------------------------------------------
-- 8. The board, and the runs behind it.
--
-- One row per entry, joined back to everything the run emitted. This is the
-- query the leaderboard exists for from an analysis point of view: a score on
-- its own says very little, and a score next to the towers that produced it,
-- the wave it died on and how long it took says quite a lot.
--
-- `pct_of_ceiling` is the score against the most that run could possibly have
-- scored, which is what netlify/functions/lib/plausibility.js computes when it
-- decides whether to accept a submission. It normalises across waves: 1200 at
-- wave five is a considerably better run than 1200 at wave nine, and the raw
-- board ordering hides that.
--
-- The ceiling is the generous one, taken from the busier wave one of the two
-- experiment arms, because a submission does not say which arm it came from.
-- A control run therefore cannot reach 100% by ninety points. The ceilings are
-- repeated here because they live in the game's config and the database has
-- never heard of them. If waves.js or the scoring in game.js is tuned, run
-- them again and change them here, or this query quietly answers a question
-- about the old numbers.
--
-- `event_score` is the score the same run reported in its own `game_over`
-- event, which is a different message sent over a different route. They should
-- be equal. This is not proof of an honest score, since both come from the
-- browser and both could be forged, but a forgery has to remember to forge
-- both, and the cheap ones do not. A mismatch is worth looking at; a mismatch
-- on a score near the ceiling is worth looking at first.
--
-- `run_events` is 0 for a row whose run never reached the collector. Those are
-- real and expected at a small rate, and they are left in rather than filtered
-- out, because a board row nobody can account for is exactly the thing this
-- query should be showing.
-- ---------------------------------------------------------------------------

with ceilings (final_wave, ceiling) as (
  values
    (1, 660), (2, 860), (3, 1110), (4, 1400), (5, 1700),
    (6, 2080), (7, 2480), (8, 3060), (9, 3690), (10, 4460)
),
board as (
  select id, run_id, display_name, score, final_wave, submitted_at
  from public.leaderboard
  where submitted_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
run_facts as (
  select
    e.run_id,
    count(*) as run_events,
    min(e.received_at) as first_event,
    min(e.device_type) as device_type,
    min(e.browser) as browser,
    min(e.country) as country,
    max(e.wave_number) filter (where e.event = 'wave_started') as furthest_wave,
    count(*) filter (where e.event = 'tower_placed') as towers_placed,
    count(distinct e.properties ->> 'tower_type')
      filter (where e.event = 'tower_placed') as tower_types,
    count(*) filter (where e.event = 'applicant_leaked') as leaks,
    max((e.properties ->> 'score')::integer)
      filter (where e.event = 'game_over') as event_score,
    max((e.properties ->> 'run_duration_ms')::integer)
      filter (where e.event = 'game_over') as run_duration_ms
  from public.analytics_events e
  where e.run_id is not null
  group by e.run_id
)
select
  b.display_name,
  b.score,
  b.final_wave,
  round(100.0 * b.score / c.ceiling, 1) as pct_of_ceiling,
  coalesce(f.run_events, 0) as run_events,
  f.furthest_wave,
  f.towers_placed,
  f.tower_types,
  f.leaks,
  round(f.run_duration_ms / 60000.0, 1) as run_minutes,
  f.device_type,
  f.browser,
  f.country,
  f.event_score,
  case
    when f.event_score is null then 'no game over event'
    when f.event_score = b.score then 'agrees'
    else 'disagrees'
  end as score_check,
  b.submitted_at
from board b
left join ceilings c on c.final_wave = b.final_wave
left join run_facts f on f.run_id = b.run_id
order by b.score desc, b.submitted_at asc;


-- ---------------------------------------------------------------------------
-- 9. Does getting on the board bring players back. Question 5, properly.
--
-- The honest version of the question. Viewing the board is not a choice, as
-- the header explains, so the comparison is built on submitting, which is.
--
-- Every run here reached a game over, so every one of them was offered the
-- name box. The split is what they did with it, and the outcome is whether the
-- same session started another run afterwards.
--
-- The confound is large and cannot be removed from this data. Submitting a
-- score is something an engaged player does, and an engaged player was going
-- to replay anyway. This measures the gap between people who cared enough to
-- type a name and people who did not, and the leaderboard is only one of the
-- reasons that gap exists. Read it as an association, and if the difference is
-- small, that is informative in a way the large version is not.
--
-- `saw_the_board` is the check rather than the split: if it is not close to
-- all of them, the panel is failing to load for a lot of players and the
-- premise that everybody was offered the board is wrong.
-- ---------------------------------------------------------------------------

with runs as (
  select
    e.run_id,
    min(e.session_id) as session_id,
    min(e.received_at) as started_at
  from public.analytics_events e
  where e.event = 'game_started'
    and e.run_id is not null
    and e.received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by e.run_id
),
finished as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'game_over'
),
submitted as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'score_submitted'
),
-- Distinct runs, not events. A submitter fires this twice.
viewed as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'leaderboard_viewed'
    and e.properties ->> 'from_screen' = 'game_over'
)
select
  case when s.run_id is not null then 'submitted a score' else 'did not' end
    as after_the_game_over,
  count(*) as runs,
  count(*) filter (where v.run_id is not null) as saw_the_board,
  count(*) filter (
    where exists (
      select 1
      from runs later
      where later.session_id = r.session_id
        and later.started_at > r.started_at
    )
  ) as replayed,
  round(
    100.0 * count(*) filter (
      where exists (
        select 1
        from runs later
        where later.session_id = r.session_id
          and later.started_at > r.started_at
      )
    ) / count(*),
    1
  ) as pct_replayed
from runs r
join finished f on f.run_id = r.run_id
left join submitted s on s.run_id = r.run_id
left join viewed v on v.run_id = r.run_id
group by case when s.run_id is not null then 'submitted a score' else 'did not' end
order by runs desc;


-- ---------------------------------------------------------------------------
-- 10. The near miss. Question 5, sharpened.
--
-- Where a score landed at the moment it was submitted, and whether the player
-- went again. The board is a full history ordered by time, so the top ten as
-- it stood when any given score arrived can be reconstructed exactly, and that
-- is the version of the board the player was actually shown.
--
-- This gets closer to a real answer than query 9 does. Everybody counted here
-- submitted a score, so the engagement confound is held roughly fixed, and
-- what varies is whether the board put their name on it. Landing eleventh by
-- forty points is close to an experiment somebody else ran on the player's
-- behalf.
--
-- `points_behind_tenth` is null while the board still had fewer than ten
-- entries, because there was no tenth place to be behind and everybody who
-- submitted was on it. Those early entries cannot contribute to the
-- comparison, and on a small board they may be most of them.
--
-- Entries whose run never reached the collector have no session to look for a
-- replay in. They are reported on their own row rather than counted as not
-- replaying.
-- ---------------------------------------------------------------------------

with board as (
  select id, run_id, score, final_wave, submitted_at
  from public.leaderboard
  where submitted_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
runs as (
  select
    e.run_id,
    min(e.session_id) as session_id,
    min(e.received_at) as started_at
  from public.analytics_events e
  where e.event = 'game_started'
    and e.run_id is not null
    and e.received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
  group by e.run_id
),
placed as (
  select
    b.*,
    (
      select count(*)
      from board o
      where o.submitted_at <= b.submitted_at
        and (
          o.score > b.score
          or (o.score = b.score and o.submitted_at < b.submitted_at)
        )
    ) + 1 as rank_at_submission,
    (
      select o.score
      from board o
      where o.submitted_at <= b.submitted_at
      order by o.score desc, o.submitted_at asc
      offset 9
      limit 1
    ) as tenth_score
  from board b
)
select
  case
    when r.run_id is null then 'run never reached the collector'
    when p.rank_at_submission <= 10 then 'made the top ten'
    else 'missed the top ten'
  end as outcome,
  count(*) as entries,
  min(p.rank_at_submission) as best_rank,
  max(p.rank_at_submission) as worst_rank,
  round(avg(greatest(p.tenth_score - p.score, 0)), 1)
    as mean_points_behind_tenth,
  count(*) filter (where p.tenth_score is null) as board_not_yet_full,
  count(*) filter (
    where exists (
      select 1
      from runs later
      where later.session_id = r.session_id
        and later.started_at > r.started_at
    )
  ) as replayed,
  round(
    100.0 * count(*) filter (
      where exists (
        select 1
        from runs later
        where later.session_id = r.session_id
          and later.started_at > r.started_at
      )
    ) / count(*),
    1
  ) as pct_replayed
from placed p
left join runs r on r.run_id = p.run_id
group by 1
order by entries desc;


-- ---------------------------------------------------------------------------
-- 11. How many people the board is.
--
-- A leaderboard of fifteen names looks like fifteen players and may be four.
-- Every figure in this file counts runs, and this is the one place worth
-- asking about people, because a board is the one thing in the game that
-- claims to be a list of them.
--
-- `ip_hash` is a salted hash kept for rate limiting, and it is used here only
-- to count how many distinct submitters there are. It is never joined to
-- behaviour and never grouped alongside anything identifying, which is the
-- line the migration comments draw and this stays on the right side of. It is
-- also imperfect in both directions: a household shares an address, and a
-- phone changes one between runs.
--
-- Sessions are the softer version of the same count and are shown next to it.
-- A player who came back tomorrow is two sessions and one hash.
-- ---------------------------------------------------------------------------

with board as (
  select run_id, ip_hash, score, submitted_at
  from public.leaderboard
  where submitted_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
sessions as (
  select
    e.run_id,
    min(e.session_id) as session_id
  from public.analytics_events e
  where e.event = 'game_started'
    and e.run_id is not null
  group by e.run_id
),
per_hash as (
  select ip_hash, count(*) as entries
  from board
  group by ip_hash
)
select
  (select count(*) from board) as entries,
  (select count(*) from per_hash) as distinct_submitters,
  (select count(distinct s.session_id) from board b
     join sessions s on s.run_id = b.run_id) as distinct_sessions,
  (select max(entries) from per_hash) as most_entries_from_one,
  (select count(*) from per_hash where entries > 1) as submitters_with_several,
  round(
    100.0 * (select coalesce(sum(entries), 0) from per_hash where entries > 1)
      / nullif((select count(*) from board), 0),
    1
  ) as pct_of_board_from_repeat_submitters;


-- ---------------------------------------------------------------------------
-- 12. The tip jar. Question 6.
--
-- Ko-fi clicks by the screen they came from. Two screens have the link, and
-- they are asking at very different moments: the home screen asks somebody who
-- has not played yet, and the game over screen asks somebody who has just lost.
--
-- The denominators differ accordingly, so they are not put in one column.
-- Home is a rate per session, since it is on the page every session opens.
-- Game over is a rate per run that reached one.
--
-- The run id on a home screen click is the previous run's, as the header
-- explains, so the home row counts sessions and the game over row counts runs.
--
-- A click is not a payment. Ko-fi is where the conversion actually happens and
-- nothing on this side of the link can see it, so this measures interest and
-- says nothing at all about money.
-- ---------------------------------------------------------------------------

with sessions as (
  select distinct session_id
  from public.analytics_events
  where event = 'session_started'
    and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
),
runs as (
  select
    e.run_id,
    min(e.session_id) as session_id
  from public.analytics_events e
  join sessions s on s.session_id = e.session_id
  where e.event = 'game_started'
    and e.run_id is not null
  group by e.run_id
),
finished as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'game_over'
),
submitted as (
  select distinct e.run_id
  from public.analytics_events e
  join runs r using (run_id)
  where e.event = 'score_submitted'
),
clicks as (
  select
    e.properties ->> 'from_screen' as from_screen,
    e.session_id,
    e.run_id
  from public.analytics_events e
  join sessions s on s.session_id = e.session_id
  where e.event = 'kofi_clicked'
),
rows_out (sort, from_screen, clicks, converted, population, denominator) as (
  select
    1,
    'home',
    (select count(*) from clicks where from_screen = 'home'),
    (select count(distinct session_id) from clicks where from_screen = 'home'),
    'sessions',
    (select count(*) from sessions)
  union all
  select
    2,
    'game over',
    (select count(*) from clicks where from_screen = 'game_over'),
    (select count(distinct run_id) from clicks where from_screen = 'game_over'),
    'runs reaching a game over',
    (select count(*) from finished)
  union all
  select
    3,
    'game over, submitted a score',
    (select count(*) from clicks c where c.from_screen = 'game_over'
       and c.run_id in (select run_id from submitted)),
    (select count(distinct c.run_id) from clicks c where c.from_screen = 'game_over'
       and c.run_id in (select run_id from submitted)),
    'runs that submitted',
    (select count(*) from submitted)
  union all
  select
    4,
    'game over, did not submit',
    (select count(*) from clicks c where c.from_screen = 'game_over'
       and c.run_id not in (select run_id from submitted)),
    (select count(distinct c.run_id) from clicks c where c.from_screen = 'game_over'
       and c.run_id not in (select run_id from submitted)),
    'runs that did not submit',
    (select count(*) from finished) - (select count(*) from submitted)
)
select
  from_screen,
  clicks,
  converted,
  population,
  denominator,
  round(100.0 * converted / nullif(denominator, 0), 1) as pct
from rows_out
order by sort;

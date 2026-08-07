-- What players say about the difficulty, as opposed to what they do about it.
--
-- Question 2 of the six in the analytics spec, from the other side. The wave
-- by wave survival curve in experiment-starting-difficulty.sql says where runs
-- end. It cannot say whether ending there felt earned, and that is the whole
-- reason `feedback_given` exists. A wave that is too heavy and a wave nobody
-- understands produce the same number in the curve and need opposite fixes.
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the other files here.
--
-- Every query reads one mode, and reads classic unless it is told otherwise:
--
--   >>> and mode = 'classic'  -- mode
--
-- marked `-- mode`, once per base CTE. Change the value in every query you run
-- to ask the same questions of another board. Query 5 is the exception and is
-- the only thing here that groups by mode instead, because it is a census of
-- what is in the table rather than a finding, on the same terms as the coverage
-- queries in the other files.
--
-- Four things about this data are worth knowing before any of it is believed,
-- and they are worse than the caveats on any other file here. This is opinion,
-- volunteered, from a self selected few.
--
-- Only players who reach a game over are ever asked. Anybody who closed the tab
-- mid run is counted by `run_abandoned` and is absent from every query below,
-- and they are exactly the players most likely to have found it impossible.
-- Every finding here is biased towards people who stayed to the end of a run.
--
-- Answering is optional and ignoring it costs nothing, so the response rate in
-- query 1 is not a nuisance figure, it is the size of the second bias. Read the
-- rest of the file against it.
--
-- The question is asked once a session, not once a run. So an answer describes
-- whichever run the player happened to be asked on, which is their first
-- completed one. That is the right run to ask about for legibility and the
-- wrong one for a player who went on to get much better, and it is why query 3
-- carries `attempt_number` rather than pooling every answer together.
--
-- `lost` is the answer that is not on the difficulty scale, and it is the one
-- to read first. The other three are a player telling you a number is wrong.
-- `lost` is a player telling you they could not see the number at all.


-- ---------------------------------------------------------------------------
-- 1. Response rate. Read this before anything else in the file.
--
-- The denominator is sessions that were asked, which is sessions that reached
-- at least one `game_over`. The question is drawn on that screen and nowhere
-- else, so a session that never finished a run was never offered it and does
-- not belong in the bottom of this fraction.
--
-- Sessions rather than runs, on both sides, because the question is asked once
-- a session. Counting runs would put every later run of a session into the
-- denominator having never been asked, and quietly halve the answer.
-- ---------------------------------------------------------------------------

with asked as (
  select distinct session_id
  from public.analytics_events
  where event = 'game_over'
    and mode = 'classic'  -- mode
    and received_at >= now() - interval '90 days'  -- cutoff
),
answered as (
  select distinct session_id
  from public.analytics_events
  where event = 'feedback_given'
    and mode = 'classic'  -- mode
    and received_at >= now() - interval '90 days'  -- cutoff
)
select
  (select count(*) from asked) as sessions_asked,
  (select count(*) from answered) as sessions_answered,
  round(
    100.0 * (select count(*) from answered)
      / nullif((select count(*) from asked), 0),
    1
  ) as pct_answered;


-- ---------------------------------------------------------------------------
-- 2. The answers. The headline.
--
-- The catalogue is listed rather than read off the events, for the same reason
-- the tower census is: an answer nobody has ever given emits nothing, and a
-- report on difficulty that silently omits "nobody ever said it was too easy"
-- has dropped a finding. Listed, it appears as a zero.
--
-- It is the four from config/feedback.js. A fifth would need adding here.
-- ---------------------------------------------------------------------------

with catalogue (answer, position) as (
  values
    ('straightforward', 1),
    ('aboutRight', 2),
    ('gruelling', 3),
    ('lost', 4)
),
given as (
  select properties ->> 'answer' as answer
  from public.analytics_events
  where event = 'feedback_given'
    and mode = 'classic'  -- mode
    and received_at >= now() - interval '90 days'  -- cutoff
)
select
  c.answer,
  count(g.answer) as answers,
  round(
    100.0 * count(g.answer) / nullif(sum(count(g.answer)) over (), 0), 1
  ) as pct_of_answers
from catalogue c
left join given g on g.answer = c.answer
group by c.answer, c.position
order by c.position;


-- ---------------------------------------------------------------------------
-- 3. What they said against how far they got.
--
-- The cross tab that makes the whole thing worth having. An answer on its own
-- is an opinion. An answer next to the intake the player reached is an opinion
-- with a position on the curve attached to it, and that is what names a wave.
--
-- `gruelling` from players who reached intake three is a difficulty problem
-- early in the list. `gruelling` from players who reached intake nine is the
-- game working: it is supposed to be hard by then and they are telling you it
-- is. The same answer, opposite conclusions, and only this query separates
-- them.
--
-- `lost` is read differently again. It should sit at a low intake and on a
-- first attempt. `lost` from experienced players who got a long way is not a
-- legibility problem, it is somebody who found the whole thing arbitrary, and
-- that is a design note rather than a tuning one.
--
-- `attempt_number` comes off the `game_started` of the same run rather than off
-- the answer, since the answer does not carry it. Runs with no `game_started`
-- recorded are dropped rather than guessed at, which is one more reason to read
-- the coverage in query 5.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min((properties ->> 'attempt_number')::int) as attempt_number
  from public.analytics_events
  where event = 'game_started'
    and mode = 'classic'  -- mode
    and run_id is not null
    and received_at >= now() - interval '90 days'  -- cutoff
  group by run_id
),
given as (
  select
    run_id,
    properties ->> 'answer' as answer,
    (properties ->> 'final_wave')::int as final_wave
  from public.analytics_events
  where event = 'feedback_given'
    and mode = 'classic'  -- mode
    and run_id is not null
    and received_at >= now() - interval '90 days'  -- cutoff
)
select
  g.answer,
  count(*) as answers,
  min(g.final_wave) as lowest_intake,
  round(avg(g.final_wave), 1) as mean_intake,
  percentile_cont(0.5) within group (order by g.final_wave) as median_intake,
  max(g.final_wave) as highest_intake,
  round(avg(r.attempt_number), 1) as mean_attempt,
  count(*) filter (where r.attempt_number = 1) as on_first_attempt
from given g
join runs r on r.run_id = g.run_id
group by g.answer
order by median_intake, g.answer;


-- ---------------------------------------------------------------------------
-- 4. Where the confused ones stopped.
--
-- `lost` on its own, spread across the intakes it was given on, against every
-- other answer at the same intake. It is the one answer that names a fixable
-- thing at a specific point in the run, so it gets its own query rather than a
-- row in query 3.
--
-- A spike at one intake is the useful shape. Something arrives there, or
-- something has to be understood there, and it is not landing. A flat spread is
-- a game that is unclear throughout, which is a different and larger problem.
-- ---------------------------------------------------------------------------

with given as (
  select
    (properties ->> 'final_wave')::int as final_wave,
    properties ->> 'answer' as answer
  from public.analytics_events
  where event = 'feedback_given'
    and mode = 'classic'  -- mode
    and received_at >= now() - interval '90 days'  -- cutoff
)
select
  final_wave as intake,
  count(*) as answers,
  count(*) filter (where answer = 'lost') as said_lost,
  round(
    100.0 * count(*) filter (where answer = 'lost') / nullif(count(*), 0), 1
  ) as pct_lost
from given
group by final_wave
order by final_wave;


-- ---------------------------------------------------------------------------
-- 5. Coverage, by mode.
--
-- The census, and the only query here that does not filter to one mode. A count
-- of what is actually in the table belongs to the table rather than to one
-- board, on the same terms as the coverage queries in the other files.
--
-- `unreadable_answers` should be zero and stay zero. The collector refuses an
-- answer that is not one of the four, so anything above zero means the game and
-- `config/feedback.js` have drifted apart in a way that got past the check,
-- which is worth knowing before any of the numbers above are believed.
-- ---------------------------------------------------------------------------

select
  coalesce(mode, '(none)') as mode,
  count(*) as answers,
  count(distinct session_id) as sessions,
  count(*) filter (
    where properties ->> 'answer' not in
      ('straightforward', 'aboutRight', 'gruelling', 'lost')
      or properties ->> 'answer' is null
  ) as unreadable_answers,
  min(received_at) as first_answer,
  max(received_at) as latest_answer
from public.analytics_events
where event = 'feedback_given'
group by mode
order by answers desc;

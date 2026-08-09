-- Whether anybody presses the only button on the phone board.
--
-- Question 4 of the six in the analytics spec, asked of a thing that is not a
-- tower and not a card. A run of one-click apply carries three bulk rejects and
-- nothing gives one back, so a run that ends with three unspent is the same
-- finding `tower_usage.sql` reports about a tower nobody builds: something in
-- the game that is not doing any work.
--
-- It reads a property rather than an event. `bulk_rejects_used` rides on
-- `game_over`, which fires once a run and already carries the intake reached and
-- the score, so how many charges were spent is a fact about a run that was being
-- reported anyway. That is the seam `mode` went through, and it is why the event
-- list is still at fifteen. The property is absent on the three desktop boards,
-- which have no such thing to spend, so every query here filters on the mode as
-- well as on the key being present.
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the other files here.
--
-- The mode
--
--   >>> and mode = 'oneClickApply'  -- mode
--
-- marked `-- mode`, on the same terms as the other files, and here it is the
-- truth about where the number comes from rather than a choice about
-- comparability. No other board has charges.
--
-- The cutoff
--
--   >>> and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
--
-- marked `-- cutoff`, and it wants moving to the release the bulk reject shipped
-- in before any of this is read. Runs from before it have no such property, and
-- they are excluded by the `? 'bulk_rejects_used'` test rather than by the date,
-- so the line is belt and braces rather than the thing doing the work.
--
-- Two things about the data before any of it is believed.
--
-- A charge spent in the intake a run died in is still counted, because the
-- number is read at `game_over` rather than accumulated from `wave_completed`,
-- and `wave_completed` never fires for the intake that ended the run. That is
-- deliberate and it is the reason the property is on the event it is on.
--
-- A run abandoned rather than played out emits `run_abandoned` and no
-- `game_over`, so it is missing from all of this. That is the same hole every
-- run level measure in this project has and it is stated rather than papered
-- over.
--
-- **This file has no `-check.sql` beside it, which every other query here has.**
-- The queries are written and have not been run against a database with rows in
-- it. Treat the first numbers out of them as unverified, and the fixture as the
-- next thing this wants.
--
--
-- ---------------------------------------------------------------------------
-- 1. The distribution. The headline, and the dead weight test.
--
-- One row per number of charges spent, and the row that matters is nought. A
-- large share there is a button players are not finding, not understanding or
-- not choosing to use, and which of those it is needs the second query.
--
-- `held` is counted alongside because it is the reason to care. The simulator
-- says a run that keeps all three holds the vacancy about fifteen times more
-- often than one that keeps none, so if the nought row is both large and losing,
-- the finding is about legibility rather than balance.
-- ---------------------------------------------------------------------------
with runs as (
  select
    (properties ->> 'bulk_rejects_used')::int as used,
    (properties ->> 'final_wave')::int as final_wave,
    (properties ->> 'score')::int as score
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
)
select
  used as charges_spent,
  count(*) as runs,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_runs,
  count(*) filter (where final_wave = 9) as reached_the_boss,
  round(avg(final_wave), 2) as mean_intake_reached,
  round(avg(score)) as mean_score
from runs
group by used
order by used;


-- ---------------------------------------------------------------------------
-- 2. Where the charges were still in hand when the run ended.
--
-- The first query cannot tell a player who never pressed it from a player who
-- was saving it and never got to use it, and those need opposite fixes. This
-- splits the unspent runs by how far they got.
--
-- A run that ended in the first four intakes with three charges in hand is
-- somebody who has not found the button. A run that ended in the eighth with
-- three in hand is somebody playing the design exactly as intended and losing to
-- the intake before the one they were saving for, which is a balance finding
-- about the eighth rather than about the button.
-- ---------------------------------------------------------------------------
with runs as (
  select
    (properties ->> 'bulk_rejects_used')::int as used,
    (properties ->> 'final_wave')::int as final_wave
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
)
select
  final_wave as intake_reached,
  count(*) as runs,
  count(*) filter (where used = 0) as spent_none,
  count(*) filter (where used = 3) as spent_all,
  round(avg(used), 2) as mean_spent
from runs
group by final_wave
order by final_wave;


-- ---------------------------------------------------------------------------
-- 3. Does it get learned?
--
-- `attempt_number` on `game_started` says which run of the session this was, so
-- joining on `run_id` says whether a player spends more of the allowance as they
-- go. A rising mean is the button being discovered and then used; a flat one at
-- nought is a control nobody has understood after several goes, which no amount
-- of retuning the boss will fix.
--
-- Capped at the tenth attempt, because the tail is a handful of sessions and a
-- mean over three runs reads as a trend when it is not.
-- ---------------------------------------------------------------------------
with starts as (
  select
    properties ->> 'run_id' as run_id,
    (properties ->> 'attempt_number')::int as attempt
  from public.analytics_events
  where event = 'game_started'
    and mode = 'oneClickApply'  -- mode
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
),
ends as (
  select
    properties ->> 'run_id' as run_id,
    (properties ->> 'bulk_rejects_used')::int as used,
    (properties ->> 'final_wave')::int as final_wave
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
)
select
  least(s.attempt, 10) as attempt_number,
  count(*) as runs,
  round(avg(e.used), 2) as mean_spent,
  count(*) filter (where e.used = 0) as spent_none,
  round(avg(e.final_wave), 2) as mean_intake_reached
from starts s
join ends e on e.run_id = s.run_id
group by least(s.attempt, 10)
order by attempt_number;

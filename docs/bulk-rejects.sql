-- Whether anybody presses the two buttons on the phone board.
--
-- Question 4 of the six in the analytics spec, asked of things that are not
-- towers and not cards. A run of one-click apply carries three bulk rejects and
-- two holds, nothing gives either back, so a run that ends with them unspent is
-- the same finding `tower_usage.sql` reports about a tower nobody builds:
-- something in the game that is not doing any work.
--
-- **The file is still called bulk-rejects.sql and there were two buttons from
-- 1.13.0.** Renaming it would leave the changelog entry that names it pointing
-- at nothing, and that record is the one thing here that is meant to be about
-- the past rather than about the game as it stands. So the name is a date stamp
-- and the contents are not.
--
-- It reads properties rather than events. `bulk_rejects_used` and `holds_used`
-- ride on `game_over`, which fires once a run and already carries the intake
-- reached and the score, so how many charges were spent is a fact about a run
-- that was being reported anyway. That is the seam `mode` went through, and it
-- is why the event list is still at fifteen. Both are absent on the three
-- desktop boards, which have no such thing to spend, so every query here filters
-- on the mode as well as on the keys being present.
--
-- The two are read together wherever they can be, and that is the whole reason
-- the second one was worth carrying. A count of bulk rejects on its own says
-- whether a button gets pressed. The pair says which of two buttons sat next to
-- each other gets pressed, and a run that spends three of one and none of the
-- other is a finding about legibility that neither number states alone.
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
-- The same is true one release later and in one direction only. Runs between
-- 1.10.0 and 1.13.0 carry the charges and not the holds, so every query that
-- reads `holds_used` also tests for it, and those runs drop out of exactly the
-- queries they cannot answer and stay in the ones they can. A cutoff moved to
-- the second release would throw away three versions of perfectly good charge
-- data to tidy up a join.
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
-- One row per control per number of charges spent, and the row that matters is
-- nought on either of them. A large share there is a button players are not
-- finding, not understanding or not choosing to use, and which of those it is
-- needs the second query.
--
-- The two are unpivoted into one table rather than reported side by side,
-- because the interesting comparison is between the buttons and a reader should
-- not have to hold two result sets in their head to make it. `of` is the run's
-- whole allowance, three and two, so a share is readable without knowing the
-- config.
--
-- The percentages are within a control rather than across the table, which is
-- what `partition by control` is doing, and without it every row would be
-- halved by the presence of the other button.
-- ---------------------------------------------------------------------------
with runs as (
  select
    (properties ->> 'bulk_rejects_used')::int as bulk_used,
    (properties ->> 'holds_used')::int as holds_used,
    (properties ->> 'final_wave')::int as final_wave,
    (properties ->> 'score')::int as score
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and properties ? 'holds_used'
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
),
spent as (
  select 'bulk reject' as control, 3 as allowance, bulk_used as used, final_wave, score
  from runs
  union all
  select 'hold for review', 2, holds_used, final_wave, score
  from runs
)
select
  control,
  used as charges_spent,
  allowance as of,
  count(*) as runs,
  round(100.0 * count(*) / sum(count(*)) over (partition by control), 1) as pct_of_runs,
  count(*) filter (where final_wave = 9) as reached_the_boss,
  round(avg(final_wave), 2) as mean_intake_reached,
  round(avg(score)) as mean_score
from spent
group by control, allowance, used
order by control, used;


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
--
-- Both controls are in it, and the row to look at is the one where they
-- disagree. Two buttons drawn the same way, side by side, ought to be found at
-- about the same rate; an intake where one is being spent and the other is not
-- is a finding about the words on them rather than about the numbers behind
-- them, and it is the reason the simulator's policies are not the answer here.
-- ---------------------------------------------------------------------------
with runs as (
  select
    (properties ->> 'bulk_rejects_used')::int as bulk_used,
    (properties ->> 'holds_used')::int as holds_used,
    (properties ->> 'final_wave')::int as final_wave
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and properties ? 'holds_used'
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
)
select
  final_wave as intake_reached,
  count(*) as runs,
  count(*) filter (where bulk_used = 0) as bulk_none,
  count(*) filter (where bulk_used = 3) as bulk_all,
  round(avg(bulk_used), 2) as mean_bulk,
  count(*) filter (where holds_used = 0) as holds_none,
  count(*) filter (where holds_used = 2) as holds_all,
  round(avg(holds_used), 2) as mean_holds
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
    (properties ->> 'bulk_rejects_used')::int as bulk_used,
    (properties ->> 'holds_used')::int as holds_used,
    (properties ->> 'final_wave')::int as final_wave
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and properties ? 'holds_used'
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
)
select
  least(s.attempt, 10) as attempt_number,
  count(*) as runs,
  round(avg(e.bulk_used), 2) as mean_bulk,
  count(*) filter (where e.bulk_used = 0) as bulk_none,
  round(avg(e.holds_used), 2) as mean_holds,
  count(*) filter (where e.holds_used = 0) as holds_none,
  round(avg(e.final_wave), 2) as mean_intake_reached
from starts s
join ends e on e.run_id = s.run_id
group by least(s.attempt, 10)
order by attempt_number;


-- ---------------------------------------------------------------------------
-- 4. Which of the two the ninth intake is fought with.
--
-- The one question the buttons could not be asked before there were two of
-- them, and the reason the second property is carried at all.
--
-- Both are meant for the same moment. The charges answer the boss by taking
-- 2,600 of health down in three presses, the holds answer it by giving the
-- turret four times as long to do the same job, and the simulator says the holds
-- are worth more spent earlier while the charges are worth more saved. Whether
-- players read them that way is not something a simulator can say.
--
-- Restricted to runs that reached the ninth, since that is the intake the
-- question is about, and a run that ended in the fifth has an opinion about
-- neither.
-- ---------------------------------------------------------------------------
with runs as (
  select
    (properties ->> 'bulk_rejects_used')::int as bulk_used,
    (properties ->> 'holds_used')::int as holds_used,
    (properties ->> 'final_wave')::int as final_wave,
    (properties ->> 'score')::int as score
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and properties ? 'bulk_rejects_used'
    and properties ? 'holds_used'
    and (properties ->> 'final_wave')::int = 9
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
)
select
  case
    when bulk_used = 0 and holds_used = 0 then 'neither'
    when bulk_used > 0 and holds_used = 0 then 'charges only'
    when bulk_used = 0 and holds_used > 0 then 'holds only'
    else 'both'
  end as fought_with,
  count(*) as runs,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_runs,
  round(avg(bulk_used), 2) as mean_bulk,
  round(avg(holds_used), 2) as mean_holds,
  round(avg(score)) as mean_score
from runs
group by 1
order by runs desc;

-- What the Contractor costs, and whether anybody deals with one.
--
-- Question 4 of the six in the analytics spec, asked of the one applicant type
-- that is not on any intake list and does not cost a life. `tower_usage.sql`
-- answers it about towers by counting what got built, and it cannot be asked
-- that way here: nothing about a contractor is a thing the player installs, and
-- the only decision they make about one is whether to spend screening time on it
-- rather than on the queue behind it.
--
-- It reads three events rather than a property, and that is the argument for
-- carrying three. A run can hold several engagements, they overlap, and each one
-- has a length, a rate and a bill of its own, so nothing that fits on
-- `game_over` can express them. The reasoning in full is in
-- src/services/analytics.js at trackContractStarted.
--
-- **None of this is `applicant_leaked`, deliberately.** That event means the
-- vacancy lost a life and every read of it in this directory counts it that way.
-- A contractor cannot cost a life, so reporting one there would make that column
-- mean two things and quietly inflate every leak rate already written down.
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the other files here.
--
-- The mode
--
--   >>> and mode = 'classic'  -- mode
--
-- marked `-- mode`, on the same terms as every other file here: three of the
-- four boards send contractors and the numbers from them are not comparable,
-- since the wave lists, the budgets and the shape of the board all differ. The
-- fourth sends none at all, so it produces no rows here rather than a zero.
--
-- The cutoff
--
--   >>> and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
--
-- marked `-- cutoff`, and it wants moving to the release the type shipped in
-- before any of this is read. Runs from before it emit none of these events at
-- all, so the line is belt and braces rather than the thing doing the work.
--
-- Two things about the data before any of it is believed.
--
-- A run that ends while somebody is still on the books has a `contract_started`
-- and no `contract_ended`. That is the honest record rather than a hole: the run
-- stopped around the engagement, which is neither of the two ways one ends. Query
-- 1 counts those rows on purpose and every other query joins on the ending, so
-- they drop out of exactly the questions they cannot answer.
--
-- A run abandoned rather than played out emits `run_abandoned` and no
-- `game_over`, so anything joined to a run's outcome is missing it. That is the
-- same hole every run level measure in this project has.
--
-- **This file has no `-check.sql` beside it.** The queries are written and have
-- not been run against a database with rows in it. Treat the first numbers out of
-- them as unverified, and the fixture as the next thing this wants.
--
--
-- ---------------------------------------------------------------------------
-- 1. Does one ever reach the desk, and what happens when it does.
--
-- The headline. One row per intake it turned up in, with how many of them got to
-- the desk and how those engagements finished.
--
-- `rejected` is the player dealing with it and `expired` is the player waiting it
-- out, and the two are opposite findings. A table that is nearly all `expired` is
-- a type nobody is answering, which is either a price worth paying or a control
-- nobody has understood, and query 3 is what separates those. A table that is
-- nearly all `rejected` inside one renewal is a type that is not doing anything.
-- ---------------------------------------------------------------------------
with started as (
  select
    properties ->> 'run_id' as run_id,
    (properties ->> 'spawn_wave')::int as spawn_wave
  from public.analytics_events
  where event = 'contract_started'
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
),
ended as (
  select
    properties ->> 'run_id' as run_id,
    properties ->> 'end_reason' as end_reason,
    (properties ->> 'renewals')::int as renewals,
    (properties ->> 'currency_drained')::int as drained,
    (properties ->> 'duration_ms')::int as duration_ms
  from public.analytics_events
  where event = 'contract_ended'
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
)
select
  s.spawn_wave as turned_up_in_intake,
  count(*) as engagements,
  count(*) filter (where e.end_reason = 'rejected') as rejected,
  count(*) filter (where e.end_reason = 'expired') as expired,
  count(*) filter (where e.end_reason is null) as run_ended_first,
  round(avg(e.renewals), 2) as mean_renewals,
  round(avg(e.drained)) as mean_budget_drained,
  round(avg(e.duration_ms) / 1000.0, 1) as mean_seconds_on_the_books
from started s
left join ended e on e.run_id = s.run_id
group by s.spawn_wave
order by s.spawn_wave;


-- ---------------------------------------------------------------------------
-- 2. Where the cap is doing the work.
--
-- The drain is capped per engagement, and the cap exists so that a contractor
-- nobody can reach cannot take a budget to nought and hold it there. Whether it
-- is doing anything is a question about the shape of the distribution rather than
-- about its mean.
--
-- Bucketed rather than averaged for that reason. A pile at the top bucket is the
-- cap binding, which means the number below it is the one that matters and the
-- day rate underneath it is not. An even spread is the cap sat above the game
-- rather than in it, which is where it is meant to be.
--
-- `renewals` is carried alongside, because an engagement that reached the cap
-- without renewing is a rate that is too high and one that renewed three times
-- to get there is a rate that is about right.
-- ---------------------------------------------------------------------------
with ended as (
  select
    (properties ->> 'currency_drained')::int as drained,
    (properties ->> 'renewals')::int as renewals,
    properties ->> 'end_reason' as end_reason
  from public.analytics_events
  where event = 'contract_ended'
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
)
select
  width_bucket(drained, 0, 120, 6) as bucket,
  min(drained) as from_budget,
  max(drained) as to_budget,
  count(*) as engagements,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct,
  round(avg(renewals), 2) as mean_renewals,
  count(*) filter (where end_reason = 'expired') as expired
from ended
group by 1
order by 1;


-- ---------------------------------------------------------------------------
-- 3. Is it worth answering one?
--
-- The question the type exists to ask, and the only one here that is about the
-- player rather than about the numbers.
--
-- Rejecting a contractor pays no bounty, so the screening time it takes is time
-- the queue behind it did not get. Waiting one out costs budget and costs
-- nothing else. Both are defensible and the design does not know which is right,
-- which is why this compares the runs rather than the engagements.
--
-- One row per run, split by whether that run ever dealt with one, with how far it
-- got and what it scored. A large gap in either direction is a finding about the
-- day rate; no gap at all is a type that is not a decision.
-- ---------------------------------------------------------------------------
with ends as (
  select
    properties ->> 'run_id' as run_id,
    (properties ->> 'final_wave')::int as final_wave,
    (properties ->> 'score')::int as score
  from public.analytics_events
  where event = 'game_over'
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
),
contracts as (
  select
    properties ->> 'run_id' as run_id,
    count(*) as engagements,
    count(*) filter (where properties ->> 'end_reason' = 'rejected') as dealt_with,
    sum((properties ->> 'currency_drained')::int) as drained
  from public.analytics_events
  where event = 'contract_ended'
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
  group by 1
)
select
  case
    when c.run_id is null then 'never reached the desk'
    when c.dealt_with = 0 then 'waited them all out'
    when c.dealt_with = c.engagements then 'dealt with every one'
    else 'dealt with some'
  end as posture,
  count(*) as runs,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_runs,
  round(avg(e.final_wave), 2) as mean_intake_reached,
  round(avg(e.score)) as mean_score,
  round(avg(coalesce(c.drained, 0))) as mean_budget_drained
from ends e
left join contracts c on c.run_id = e.run_id
group by 1
order by runs desc;


-- ---------------------------------------------------------------------------
-- 4. Whether the flag is doing anything.
--
-- The type is behind a GrowthBook boolean rather than an experiment, so nothing
-- is bucketed and there are no arms to compare. What there is, on every event, is
-- `contractor_enabled` in `variant_assignments`, which says what the run was
-- playing with.
--
-- That is enough to answer the one question worth asking of the flag: whether a
-- board with contractors on it plays differently from the same board with them
-- off. It is not a randomised comparison and must not be reported as one, since
-- who has the flag off is whoever the flag was turned off for.
--
-- If it ever becomes a real experiment, this query is the wrong one and
-- experiment-starting-difficulty.sql is the shape of the right one, exposures and
-- all.
-- ---------------------------------------------------------------------------
with runs as (
  select
    coalesce(variant_assignments ->> 'contractor_enabled', 'missing') as flag,
    (properties ->> 'final_wave')::int as final_wave,
    (properties ->> 'score')::int as score,
    (properties ->> 'run_duration_ms')::int as duration_ms
  from public.analytics_events
  where event = 'game_over'
    and mode = 'classic'  -- mode
    and received_at >= timestamptz '2026-08-11 00:00:00+00'  -- cutoff
)
select
  flag,
  count(*) as runs,
  round(avg(final_wave), 2) as mean_intake_reached,
  round(avg(score)) as mean_score,
  round(avg(duration_ms) / 1000.0, 1) as mean_seconds
from runs
group by flag
order by runs desc;

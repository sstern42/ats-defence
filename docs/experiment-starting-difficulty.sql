-- Analysis queries for the starting difficulty experiment.
--
-- The analysis these implement was written down before launch and lives in
-- docs/experiment-starting-difficulty.md. This file is only the arithmetic. If
-- the two ever disagree, the markdown is the specification and this is the bug.
--
-- Run them in the Supabase SQL editor. Each one stands on its own, so the base
-- CTEs are repeated rather than shared: a query you can copy on its own is
-- worth more here than a file with no duplication in it.
--
-- Two definitions do all the work, and both appear at the top of every query.
--
-- A run is a `game_started` event and the run_id on it. Runs, not players, are
-- the denominator throughout. A player who plays four times counts four times,
-- which is the deviation the markdown already notes: the randomisation unit is
-- the player, the analysis unit is the run.
--
-- An assigned run is one whose arm string has no colon in it. `forced:busy`
-- comes from the preview query parameter and `unassigned:control` from a run
-- that never got an answer out of GrowthBook. Neither is a player in the
-- experiment, and folding either into an arm would quietly widen that side.


-- ---------------------------------------------------------------------------
-- 1. Coverage. What is actually in the data before any of it is believed.
--
-- Run this first. If `unassigned:control` is a large share, GrowthBook is not
-- answering for a lot of people and the rest of the file is measuring a small
-- and possibly odd subset.
-- ---------------------------------------------------------------------------

select
  coalesce(variant_assignments ->> 'starting-difficulty', 'missing') as assignment,
  count(*) as runs,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_runs,
  min(received_at) as first_seen,
  max(received_at) as last_seen
from public.analytics_events
where event = 'game_started'
group by 1
order by runs desc;


-- ---------------------------------------------------------------------------
-- 2. The stopping rule. 340 assigned runs per arm, or 14 days after launch,
-- whichever comes first. This answers the first half.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min(variant_assignments ->> 'starting-difficulty') as arm
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
  group by run_id
),
assigned as (
  select run_id, arm
  from runs
  where arm is not null
    and position(':' in arm) = 0
)
select
  arm,
  count(*) as assigned_runs,
  greatest(340 - count(*), 0) as still_needed
from assigned
group by arm
order by arm;


-- ---------------------------------------------------------------------------
-- 3. Primary metric: wave-by-wave survival.
--
-- For each arm, the proportion of runs that reached wave N. Read it as a
-- curve. The shape worth looking for is the arms separating early and then
-- coming back together, which would mean the busy opening costs players at the
-- start and nothing afterwards.
--
-- Ten waves, so the series stops at ten. If the wave count in
-- src/config/waves.js changes, change it here too.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min(variant_assignments ->> 'starting-difficulty') as arm
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
  group by run_id
),
assigned as (
  select run_id, arm
  from runs
  where arm is not null
    and position(':' in arm) = 0
),
-- The furthest wave a run ever started. The promoted wave_number column is
-- used rather than the property of the same name: the collector validates the
-- column as a whole number, and on wave_started the two say the same thing.
reached as (
  select
    e.run_id,
    max(e.wave_number) as furthest_wave
  from public.analytics_events e
  join assigned a using (run_id)
  where e.event = 'wave_started'
  group by e.run_id
),
waves as (
  select generate_series(1, 10) as wave
)
select
  w.wave,
  a.arm,
  count(*) as runs,
  count(*) filter (where coalesce(r.furthest_wave, 0) >= w.wave) as reached,
  round(
    100.0 * count(*) filter (where coalesce(r.furthest_wave, 0) >= w.wave)
      / count(*),
    1
  ) as pct
from assigned a
cross join waves w
left join reached r on r.run_id = a.run_id
group by w.wave, a.arm
order by w.wave, a.arm;


-- ---------------------------------------------------------------------------
-- 4. Secondary metric: early abandonment.
--
-- Runs that were abandoned at wave three or earlier, over all runs, per arm.
--
-- The reason filter is the point. `hidden` is excluded because it is the
-- lossiest of the three: a tab that stays in the background for thirty seconds
-- is a guess at somebody leaving, and it was the failure mode that produced a
-- wave five abandonment from a player who went on to reach wave eight. The
-- other two are shown alongside so the exclusion can be seen rather than
-- trusted.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min(variant_assignments ->> 'starting-difficulty') as arm
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
  group by run_id
),
assigned as (
  select run_id, arm
  from runs
  where arm is not null
    and position(':' in arm) = 0
),
abandonment as (
  select
    e.run_id,
    min(e.wave_number) as wave,
    min(e.properties ->> 'reason') as reason
  from public.analytics_events e
  join assigned a using (run_id)
  where e.event = 'run_abandoned'
  group by e.run_id
)
select
  a.arm,
  count(*) as runs,
  count(*) filter (
    where ab.wave <= 3 and ab.reason in ('unload', 'idle')
  ) as abandoned_early,
  round(
    100.0 * count(*) filter (
      where ab.wave <= 3 and ab.reason in ('unload', 'idle')
    ) / count(*),
    1
  ) as pct,
  -- Shown, not counted. If this is large next to the column above, the metric
  -- is resting on a thirty second guess more than it looks.
  count(*) filter (where ab.wave <= 3 and ab.reason = 'hidden') as hidden_early,
  count(*) filter (where ab.run_id is null) as never_abandoned
from assigned a
left join abandonment ab on ab.run_id = a.run_id
group by a.arm
order by a.arm;


-- ---------------------------------------------------------------------------
-- 5. Guardrail: reaching the end.
--
-- Of the runs that finished properly, the proportion that finished by
-- surviving all ten waves. A busier opening that improves retention by making
-- the game easier to lose early is not a win worth having.
--
-- The denominator is runs with a game_over, not all runs, because an abandoned
-- run neither won nor lost and counting it as a loss would move with the
-- abandonment rate rather than with the difficulty.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min(variant_assignments ->> 'starting-difficulty') as arm
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
  group by run_id
),
assigned as (
  select run_id, arm
  from runs
  where arm is not null
    and position(':' in arm) = 0
),
finished as (
  select
    e.run_id,
    max(e.wave_number) as final_wave
  from public.analytics_events e
  join assigned a using (run_id)
  where e.event = 'game_over'
  group by e.run_id
)
select
  a.arm,
  count(*) as finished_runs,
  count(*) filter (where f.final_wave >= 10) as survived_all_ten,
  round(
    100.0 * count(*) filter (where f.final_wave >= 10) / count(*),
    1
  ) as pct
from assigned a
join finished f on f.run_id = a.run_id
group by a.arm
order by a.arm;


-- ---------------------------------------------------------------------------
-- 6. The tests.
--
-- Two-proportion z-test on the secondary metric and on survival at wave three,
-- which stands in for the primary curve as a single number.
--
-- Postgres has no normal distribution function, so no p-value comes out of
-- this. Two-tailed significance at p < 0.05 is |z| >= 1.96, and the interval
-- says more than the verdict does anyway: an interval running from -12 to +4
-- points is a different result from one running from -1 to +1, and calling
-- both of them "not significant" throws that away.
--
-- The test uses the pooled standard error and the interval uses the unpooled
-- one. That is the conventional pairing rather than an oversight: the test
-- assumes no difference, the interval does not.
--
-- Difference is busy minus control. A positive difference on survival is the
-- busy arm keeping more players. A positive difference on abandonment is the
-- busy arm losing more of them.
-- ---------------------------------------------------------------------------

with runs as (
  select
    run_id,
    min(variant_assignments ->> 'starting-difficulty') as arm
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
  group by run_id
),
assigned as (
  select run_id, arm
  from runs
  where arm is not null
    and position(':' in arm) = 0
),
reached as (
  select
    e.run_id,
    max(e.wave_number) as furthest_wave
  from public.analytics_events e
  join assigned a using (run_id)
  where e.event = 'wave_started'
  group by e.run_id
),
abandoned_early as (
  select distinct e.run_id
  from public.analytics_events e
  join assigned a using (run_id)
  where e.event = 'run_abandoned'
    and e.wave_number <= 3
    and e.properties ->> 'reason' in ('unload', 'idle')
),
counts as (
  select
    'survival to wave 3' as metric,
    a.arm,
    count(*)::numeric as n,
    count(*) filter (where coalesce(r.furthest_wave, 0) >= 3)::numeric as hits
  from assigned a
  left join reached r on r.run_id = a.run_id
  group by a.arm

  union all

  select
    'early abandonment' as metric,
    a.arm,
    count(*)::numeric as n,
    count(*) filter (where ab.run_id is not null)::numeric as hits
  from assigned a
  left join abandoned_early ab on ab.run_id = a.run_id
  group by a.arm
),
pair as (
  select
    metric,
    max(n) filter (where arm = 'control') as n1,
    max(hits) filter (where arm = 'control') as x1,
    max(n) filter (where arm = 'busy') as n2,
    max(hits) filter (where arm = 'busy') as x2
  from counts
  group by metric
),
proportions as (
  select
    metric,
    n1,
    n2,
    x1 / nullif(n1, 0) as p1,
    x2 / nullif(n2, 0) as p2,
    (x1 + x2) / nullif(n1 + n2, 0) as pooled
  from pair
),
figures as (
  select
    metric,
    n1,
    n2,
    p1,
    p2,
    p2 - p1 as difference,
    sqrt(pooled * (1 - pooled) * (1.0 / nullif(n1, 0) + 1.0 / nullif(n2, 0)))
      as se_pooled,
    sqrt(
      p1 * (1 - p1) / nullif(n1, 0) + p2 * (1 - p2) / nullif(n2, 0)
    ) as se_unpooled
  from proportions
)
select
  metric,
  n1 as control_runs,
  n2 as busy_runs,
  round(p1 * 100, 1) as control_pct,
  round(p2 * 100, 1) as busy_pct,
  round(difference * 100, 1) as difference_pct,
  round(difference / nullif(se_pooled, 0), 3) as z,
  abs(difference / nullif(se_pooled, 0)) >= 1.959964 as significant_at_05,
  round((difference - 1.959964 * se_unpooled) * 100, 1) as ci_low_pct,
  round((difference + 1.959964 * se_unpooled) * 100, 1) as ci_high_pct
from figures
order by metric;


-- ---------------------------------------------------------------------------
-- 7. Exposure cross-check.
--
-- `experiment_viewed` is GrowthBook saying it bucketed somebody, rather than
-- the game saying what it played. The two should agree. Where they do not, the
-- arm string is the one that decided what the player actually saw.
--
-- It is a check and not the definition of an assigned run, because it only
-- exists from the deploy that added it. Runs from before that have no exposure
-- and are not thereby unassigned.
--
-- Sessions rather than runs, because bucketing happens once per session and
-- several runs sit under it. An even split here is also the closest thing to a
-- sample ratio check available: a 60/40 split of sessions would mean something
-- is wrong upstream of everything above.
-- ---------------------------------------------------------------------------

with exposures as (
  select
    session_id,
    min(properties ->> 'arm') as exposed_arm,
    min(properties ->> 'variation_id') as variation_id
  from public.analytics_events
  where event = 'experiment_viewed'
  group by session_id
),
played as (
  select
    session_id,
    min(variant_assignments ->> 'starting-difficulty') as event_arm,
    count(distinct run_id) as runs
  from public.analytics_events
  where event = 'game_started'
  group by session_id
)
select
  e.exposed_arm,
  e.variation_id,
  count(*) as sessions,
  round(100.0 * count(*) / sum(count(*)) over (), 1) as pct_of_sessions,
  coalesce(sum(p.runs), 0) as runs,
  count(*) filter (
    where p.event_arm is not null and p.event_arm is distinct from e.exposed_arm
  ) as disagreements
from exposures e
left join played p on p.session_id = e.session_id
group by e.exposed_arm, e.variation_id
order by e.exposed_arm;

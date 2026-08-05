-- Which towers get used, and which are dead weight.
--
-- Question 4 of the six in the analytics spec, and the last one without any
-- queries behind it. The others were written when the thing they measure was
-- built. This one was not, so it is written here.
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the experiment file, because
-- a query that can be copied on its own is worth more here than a file with no
-- duplication in it.
--
-- Nothing here splits by experiment arm, on purpose. The starting difficulty
-- experiment is read out once, at its stopping point, and an arm breakdown of
-- anything is that readout happening early under another name. These pool both
-- arms. After the experiment is called, splitting them is fine.
--
-- Three things about the data are worth knowing before any of it is believed.
--
-- The trap emits `tower_placed` like everything else. Salary Expectations is a
-- trap rather than a tower, it costs nothing and it is single use, so a run
-- lays a lot of them. It will top any count of placements and that means very
-- little. Reach, the share of runs that ever place a thing, is the comparison
-- that survives the difference, and it is what query 1 leads on.
--
-- A placement carries the wave number that was last started, not the wave
-- about to start. Towers go down mostly during the pause between waves, so a
-- tower placed in the pause after wave three is recorded as wave three. Read
-- "first placed at wave N" as "by the end of wave N".
--
-- `currency_before` exists only on placements. There is no record of what a
-- player was holding at any other moment, so the most that can be said about
-- affordability is what they were seen holding when they bought something
-- else. Query 2 uses that and is honest about the direction of the error.


-- ---------------------------------------------------------------------------
-- 1. Reach and volume. The headline.
--
-- `runs_using` and `pct_of_runs` are the dead weight measure: the share of
-- runs that ever place the thing at all. A tower placed constantly by a
-- handful of players is not dead weight, and a tower placed once by everybody
-- is not either, and only counting placements confuses the two.
--
-- `placements_per_using_run` separates them. High reach with a low figure here
-- is a tower everybody tries once. Low reach with a high figure is a tower a
-- few players build their whole board out of.
--
-- The catalogue is listed rather than read off the events, which matters more
-- here than anywhere else in the file. A tower nobody has ever placed emits no
-- events, so grouping the events alone would drop it from the results
-- entirely, and a tower that is missing from a report about dead weight is the
-- deadest one there is. Listed, it appears with a zero. The other queries have
-- no such list and cover placed towers only, which is why this one is the
-- census and they are the detail.
--
-- It is the six from towers.js. A seventh would need adding here.
-- ---------------------------------------------------------------------------

with catalogue (tower) as (
  values
    ('keywordFilter'),
    ('knockoutQuestion'),
    ('takeHomeTask'),
    ('cultureFitPanel'),
    ('videoScreen'),
    ('salaryExpectations')
),
runs as (
  select distinct run_id
  from public.analytics_events
  where event = 'game_started'
    and run_id is not null
),
placements as (
  select
    run_id,
    properties ->> 'tower_type' as tower
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
)
select
  c.tower,
  count(p.run_id) as placements,
  round(
    100.0 * count(p.run_id) / nullif(sum(count(p.run_id)) over (), 0), 1
  ) as pct_of_placements,
  count(distinct p.run_id) as runs_using,
  round(
    100.0 * count(distinct p.run_id)
      / nullif((select count(*) from runs), 0),
    1
  ) as pct_of_runs,
  round(
    count(p.run_id)::numeric / nullif(count(distinct p.run_id), 0), 2
  ) as placements_per_using_run
from catalogue c
left join placements p on p.tower = c.tower
group by c.tower
order by pct_of_runs desc, placements desc;


-- ---------------------------------------------------------------------------
-- 2. Unwanted, or unaffordable.
--
-- A tower nobody places is not necessarily a tower nobody wants. It may be one
-- nobody can afford, and those two have opposite fixes: the first is a design
-- problem and the second is a number in towers.js.
--
-- Telling them apart needs to know what players were holding, and the only
-- record of that is `currency_before` on the placements they did make. So
-- `peak_seen` is the most a run was ever observed holding, which is a floor
-- rather than the true peak: a run that saved up and then spent it all on one
-- expensive tower is caught, but a run that saved up and never bought anything
-- at all reports nothing, because it emitted no placements to be seen at.
--
-- The error therefore runs one way. `could_afford_never_placed` is an
-- undercount of the players who passed on a tower they could have had. A tower
-- that already looks passed over by this is passed over.
--
-- The costs are repeated here because they live in towers.js and the database
-- has never heard of them. If they are tuned, change them here too, or this
-- query quietly answers a question about the old prices.
-- ---------------------------------------------------------------------------

with costs (tower, cost) as (
  values
    ('keywordFilter', 60),
    ('knockoutQuestion', 140),
    ('takeHomeTask', 90),
    ('cultureFitPanel', 120),
    ('videoScreen', 85),
    ('salaryExpectations', 0)
),
peak as (
  select
    run_id,
    max((properties ->> 'currency_before')::integer) as peak_seen
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
  group by run_id
),
used as (
  select distinct
    run_id,
    properties ->> 'tower_type' as tower
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
)
select
  c.tower,
  c.cost,
  count(*) filter (where p.peak_seen >= c.cost) as could_afford,
  count(*) filter (where u.run_id is not null) as placed_it,
  count(*) filter (where p.peak_seen >= c.cost and u.run_id is null)
    as could_afford_never_placed,
  round(
    100.0 * count(*) filter (where p.peak_seen >= c.cost and u.run_id is null)
      / nullif(count(*) filter (where p.peak_seen >= c.cost), 0),
    1
  ) as pct_passed_over
from costs c
cross join peak p
left join used u
  on u.run_id = p.run_id
  and u.tower = c.tower
group by c.tower, c.cost
order by pct_passed_over desc nulls last;


-- ---------------------------------------------------------------------------
-- 3. When a tower first appears.
--
-- A tower can have good reach and still be doing nothing for most of a run, if
-- everybody buys it late out of spare money. One that shows up at wave one in
-- most runs is part of the opening; one whose median first appearance is wave
-- seven is what players buy when they have run out of ideas.
--
-- Remember the offset described at the top. Wave N here means "by the end of
-- wave N", since most placements happen in the pause that follows a wave.
-- ---------------------------------------------------------------------------

with first_use as (
  select
    run_id,
    properties ->> 'tower_type' as tower,
    min(wave_number) as first_wave
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
    and wave_number is not null
  group by run_id, properties ->> 'tower_type'
)
select
  tower,
  count(*) as runs_using,
  min(first_wave) as earliest,
  round(
    percentile_cont(0.5) within group (order by first_wave)::numeric, 1
  ) as median_first_wave,
  count(*) filter (where first_wave = 1) as opened_with_it,
  round(100.0 * count(*) filter (where first_wave = 1) / count(*), 1)
    as pct_opened_with_it
from first_use
group by tower
order by median_first_wave, tower;


-- ---------------------------------------------------------------------------
-- 4. Placements across the run.
--
-- The shape of a tower's life. Read down a tower's rows: steady means it keeps
-- being worth buying, front loaded means it is an opener that stops earning
-- its cost, and back loaded means it is a late luxury.
--
-- `pct_of_tower` normalises each tower against itself, so a cheap tower bought
-- constantly and an expensive one bought twice can be compared on shape
-- without the cheap one flattening the other into nothing.
--
-- Waves get fewer runs as they go up, since most runs end before wave ten, so
-- the counts fall off towards the bottom for reasons that have nothing to do
-- with any tower. `runs_at_wave` is there to divide by when that matters.
-- ---------------------------------------------------------------------------

with reached as (
  select
    wave_number as wave,
    count(distinct run_id) as runs_at_wave
  from public.analytics_events
  where event = 'wave_started'
    and run_id is not null
    and wave_number is not null
  group by wave_number
),
placements as (
  select
    properties ->> 'tower_type' as tower,
    wave_number as wave,
    count(*) as placements
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
    and wave_number is not null
  group by 1, 2
)
select
  p.tower,
  p.wave,
  p.placements,
  round(100.0 * p.placements / sum(p.placements) over (partition by p.tower), 1)
    as pct_of_tower,
  r.runs_at_wave,
  round(p.placements::numeric / nullif(r.runs_at_wave, 0), 2)
    as placements_per_run_at_wave
from placements p
left join reached r on r.wave = p.wave
order by p.tower, p.wave;


-- ---------------------------------------------------------------------------
-- 5. Where they go on the board.
--
-- The path is a fixed list of waypoints and never changes, so the cells worth
-- building on are the same in every run and players converge on them. The top
-- few cells per tower say which part of the path each one is understood to be
-- for, and a tower whose placements are scattered evenly is one nobody has a
-- theory about.
--
-- Trap positions are the cell a trap landed in rather than a cell it was
-- placed on, since a trap snaps to the path. Same coordinates, slightly
-- different meaning.
-- ---------------------------------------------------------------------------

with cells as (
  select
    properties ->> 'tower_type' as tower,
    (properties ->> 'grid_x')::integer as grid_x,
    (properties ->> 'grid_y')::integer as grid_y,
    count(*) as placements
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
    and properties ? 'grid_x'
    and properties ? 'grid_y'
  group by 1, 2, 3
),
ranked as (
  select
    *,
    row_number() over (partition by tower order by placements desc) as rank,
    sum(placements) over (partition by tower) as tower_total
  from cells
)
select
  tower,
  rank,
  grid_x,
  grid_y,
  placements,
  round(100.0 * placements / tower_total, 1) as pct_of_tower
from ranked
where rank <= 5
order by tower, rank;


-- ---------------------------------------------------------------------------
-- 6. How far runs using each tower got, and why that is not effectiveness.
--
-- The obvious next question is which towers win games, and this query does not
-- answer it. It cannot, and neither can any other query over this data.
--
-- The confound is not subtle. A run that survives to wave eight has spent
-- eight waves collecting money and has had eight chances to buy something it
-- has not bought yet. A run that dies at wave two has had neither. So the
-- expensive towers will look like the good ones, and the causation mostly runs
-- backwards: reaching wave eight causes Knockout Question purchases rather
-- more reliably than Knockout Question purchases cause reaching wave eight.
--
-- It is here because somebody will want the number, and a version of it with
-- the confound written above it is better than the version they would write in
-- the SQL editor without one. Read it as a description of who buys what and
-- when, which is the same thing queries 1 and 3 say.
--
-- What would actually answer it is an experiment, or a comparison holding wave
-- reached fixed, and neither is in scope here.
-- ---------------------------------------------------------------------------

with finals as (
  select
    run_id,
    max((properties ->> 'final_wave')::integer) as final_wave
  from public.analytics_events
  where event in ('game_over', 'run_abandoned')
    and run_id is not null
    and properties ? 'final_wave'
  group by run_id
),
used as (
  select distinct
    run_id,
    properties ->> 'tower_type' as tower
  from public.analytics_events
  where event = 'tower_placed'
    and run_id is not null
),
towers as (
  select distinct tower from used
)
select
  t.tower,
  count(*) filter (where u.run_id is not null) as runs_using,
  round(
    percentile_cont(0.5) within group (order by f.final_wave)
      filter (where u.run_id is not null)::numeric,
    1
  ) as median_final_wave_using,
  count(*) filter (where u.run_id is null) as runs_not_using,
  round(
    percentile_cont(0.5) within group (order by f.final_wave)
      filter (where u.run_id is null)::numeric,
    1
  ) as median_final_wave_not_using
from towers t
cross join finals f
left join used u
  on u.run_id = f.run_id
  and u.tower = t.tower
group by t.tower
order by median_final_wave_using desc nulls last;

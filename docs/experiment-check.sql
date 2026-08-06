-- Synthetic events for checking the analysis queries before the readout.
--
-- The readout happens once, at the stopping point, and a query that turns out
-- to be wrong on the day is a fortnight of collection spent on a number nobody
-- can use. So the arithmetic is checked here first, against a dataset built so
-- that every figure the analysis reports can be worked out by hand and
-- compared, rather than merely "the query ran without erroring".
--
-- This is a fixture. It truncates the table, so it goes nowhere near the
-- project holding the real events: apply the migrations to an empty database,
-- run this, then run experiment-starting-difficulty.sql against it.
--
-- Expected, if the queries are right:
--
--   coverage:      control 100, busy 100, forced:busy 10, unassigned:control 10
--   stopping rule: 100 assigned runs per arm, 240 short of 340
--   survival w1:   control 100.0, busy 100.0
--   survival w2:   control  93.0, busy  87.0
--   survival w3:   control  56.0, busy  74.0
--   survival w10:  control   7.0, busy   0.0
--   early abandon: control 20.0 (20 unload), busy 35.0 (35 idle)
--   guardrail:     control 7 of 70 finished runs, busy 0 of 65
--   exposures:     busy 103 sessions, control 97, with 3 disagreements
--
-- The seeding statement at the end reports 230 runs and 130 events sitting
-- before the cutoff, being ten test runs of thirteen events each. None of them
-- reach any figure above, which is the point of them.
--
-- Four of those are traps rather than figures. The hidden and quit
-- abandonments in control exist to be excluded: drop the reason filter and
-- control's early abandonment reads 30.0 instead of 20.0. The forced and
-- unassigned runs all reach wave ten: drop the colon filter and the survival
-- curve and the guardrail both lift. Ten more control runs sit before the
-- cutoff, backdated to the morning of the launch, standing for the developer
-- testing: drop the cutoff line and control goes to 110 runs, its survival at
-- wave ten goes from 7.0 to 15.5 and the guardrail from 10.0 to 21.3. The
-- three planted disagreements are sessions GrowthBook bucketed as busy that
-- played control, and query seven should find exactly three.
--
-- All four are the same kind of trap. Each one is a row that looks like a
-- player and is not, and each is caught by a different line in the queries, so
-- a figure that comes out right is evidence that line is still there.
--
-- Checked against Postgres 16 with all four migrations applied. All seven
-- queries returned the figures above.

truncate public.analytics_events;

-- One row helper. `waves` is how far the run got.
create or replace function seed_run(
  p_run text,
  p_arm text,
  p_waves integer,
  p_ending text,           -- 'game_over' or an abandonment reason
  p_final_wave integer
) returns void language plpgsql as $$
declare
  w integer;
  base jsonb := jsonb_build_object(
    'session_id', p_run || '-s',
    'run_id', p_run,
    'variant_assignments', jsonb_build_object('starting-difficulty', p_arm),
    'device_type', 'desktop',
    'referrer', 'https://www.linkedin.com/',
    'mode', 'classic'
  );
begin
  insert into public.analytics_events
    (event, session_id, run_id, wave_number, variant_assignments,
     device_type, referrer, mode, properties, ip_hash)
  values
    ('game_started', p_run || '-s', p_run, 0,
     jsonb_build_object('starting-difficulty', p_arm), 'desktop',
     'https://www.linkedin.com/',
     'classic',
     base || jsonb_build_object('wave_number', 0, 'attempt_number', 1),
     'hash');

  for w in 1..p_waves loop
    insert into public.analytics_events
      (event, session_id, run_id, wave_number, variant_assignments,
       device_type, referrer, mode, properties, ip_hash)
    values
      ('wave_started', p_run || '-s', p_run, w,
       jsonb_build_object('starting-difficulty', p_arm), 'desktop',
       'https://www.linkedin.com/',
       'classic',
       base || jsonb_build_object('wave_number', w, 'lives_remaining', 10,
                                  'currency', 150),
       'hash');
  end loop;

  if p_ending = 'game_over' then
    insert into public.analytics_events
      (event, session_id, run_id, wave_number, variant_assignments,
       device_type, referrer, mode, properties, ip_hash)
    values
      ('game_over', p_run || '-s', p_run, p_final_wave,
       jsonb_build_object('starting-difficulty', p_arm), 'desktop',
       'https://www.linkedin.com/',
       'classic',
       base || jsonb_build_object('wave_number', p_final_wave,
                                  'final_wave', p_final_wave,
                                  'score', p_final_wave * 120,
                                  'run_duration_ms', 120000),
       'hash');
  else
    insert into public.analytics_events
      (event, session_id, run_id, wave_number, variant_assignments,
       device_type, referrer, mode, properties, ip_hash)
    values
      ('run_abandoned', p_run || '-s', p_run, p_final_wave,
       jsonb_build_object('starting-difficulty', p_arm), 'desktop',
       'https://www.linkedin.com/',
       'classic',
       base || jsonb_build_object('wave_number', p_final_wave,
                                  'final_wave', p_final_wave,
                                  'run_duration_ms', 60000,
                                  'reason', p_ending),
       'hash');
  end if;
end;
$$;

do $$
declare
  i integer;
  w integer;
begin
  -- Control: 70 finish, 20 unload, 5 hidden, 5 quit.
  for i in 1..70 loop
    w := ((i - 1) % 10) + 1;
    perform seed_run('c' || i, 'control', w, 'game_over', w);
  end loop;

  for i in 71..90 loop
    perform seed_run('c' || i, 'control', 2, 'unload', 2);
  end loop;

  for i in 91..95 loop
    perform seed_run('c' || i, 'control', 2, 'hidden', 2);
  end loop;

  for i in 96..100 loop
    perform seed_run('c' || i, 'control', 2, 'quit', 2);
  end loop;

  -- Busy: 65 finish at waves one to five, 35 go idle at wave three.
  for i in 1..65 loop
    w := ((i - 1) % 5) + 1;
    perform seed_run('b' || i, 'busy', w, 'game_over', w);
  end loop;

  for i in 66..100 loop
    perform seed_run('b' || i, 'busy', 3, 'idle', 3);
  end loop;

  -- Neither of these is a player in the experiment. Both reach wave ten, so
  -- including them by mistake is loud rather than subtle.
  for i in 1..10 loop
    perform seed_run('f' || i, 'forced:busy', 10, 'game_over', 10);
    perform seed_run('u' || i, 'unassigned:control', 10, 'game_over', 10);
  end loop;

  -- Developer test runs, backdated below to before the cutoff. Clean arm
  -- strings, so the colon rule does not catch them and only the cutoff can.
  -- Ten perfect control runs, which is the loudest thing they could be: let
  -- them in and control gains ten runs, its survival at wave ten goes from 7.0
  -- to 15.5, and the guardrail from 10.0 to 21.3.
  for i in 1..10 loop
    perform seed_run('x' || i, 'control', 10, 'game_over', 10);
  end loop;
end;
$$;

drop function seed_run(text, text, integer, text, integer);


-- Exposures, for query seven. One per assigned session, plus three deliberate
-- disagreements where GrowthBook says busy and the game played control.
--
-- The forced and unassigned sessions get none, which is right: GrowthBook
-- never bucketed them, which is the whole reason they are labelled that way.
insert into public.analytics_events
  (event, session_id, run_id, wave_number, variant_assignments, device_type,
   referrer, mode, properties, ip_hash)
select
  'experiment_viewed',
  run_id || '-s',
  null,
  0,
  variant_assignments,
  'desktop',
  'https://www.linkedin.com/',
  'classic',
  jsonb_build_object(
    'session_id', run_id || '-s',
    'experiment_key', 'starting-difficulty',
    'variation_id', case when arm = 'busy' then '1' else '0' end,
    'arm', arm
  ),
  'hash'
from (
  select
    run_id,
    variant_assignments,
    case
      -- c1, c2, c3 are told busy by GrowthBook but played control.
      when run_id in ('c1', 'c2', 'c3') then 'busy'
      else variant_assignments ->> 'starting-difficulty'
    end as arm
  from public.analytics_events
  where event = 'game_started'
    and variant_assignments ->> 'starting-difficulty' in ('control', 'busy')
) s;

-- The test runs go back in time last, once their exposures exist, so that a
-- whole session moves together. Backdating the runs alone would leave each one
-- with an exposure on the right side of the cutoff and a `game_started` on the
-- wrong side, which is not a thing that can happen: a session is bucketed and
-- starts its first run within a second or so, and the cutoff either takes both
-- or neither. Split like that, query seven reports more sessions than runs and
-- the mismatch looks like a bug in the query rather than in the fixture.
--
-- Matched on session_id rather than run_id because an exposure carries no run.
update public.analytics_events
set received_at = timestamptz '2026-08-04 06:00:00+00'
where session_id like 'x%';

select
  count(*) as events,
  count(distinct run_id) as runs,
  count(*) filter (where event = 'experiment_viewed') as exposures,
  count(*) filter (
    where received_at < timestamptz '2026-08-04 07:16:00+00'
  ) as before_the_cutoff
from public.analytics_events;

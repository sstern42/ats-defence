-- Synthetic events for checking the tower usage queries.
--
-- Same idea as experiment-check.sql, and the same warning: it truncates the
-- table, so it belongs on an empty database with the migrations applied and
-- nowhere near the project holding the real events.
--
-- Twenty runs. Every run places two Keyword Filters, ten also place a
-- Take-Home Task, four a Video Screen, two a Culture Fit Panel, and fifteen lay
-- six Salary Expectations each. Nobody ever places a Knockout Question, which
-- is the case the whole thing is built around: it emits no events at all, so a
-- query that groups the events alone drops it silently, and a report about
-- dead weight that omits the deadest tower is worse than no report.
--
-- Expected, if the queries are right:
--
--   1. reach:      keywordFilter 100.0% of runs, salaryExpectations 75.0,
--                  takeHomeTask 50.0, videoScreen 20.0, cultureFitPanel 10.0,
--                  knockoutQuestion 0.0 and present as a row of zeros.
--                  146 placements, of which salaryExpectations is 61.6%
--                  on 90 of them, against keywordFilter's 27.4% on 40.
--                  That inversion is the point of the trap warning.
--   2. afford:     knockoutQuestion could_afford 20, placed 0, 100.0% passed
--                  over. cultureFitPanel 90.0, videoScreen 80.0,
--                  takeHomeTask 50.0, salaryExpectations 25.0,
--                  keywordFilter 0.0.
--   3. first use:  median first wave 1 for keywordFilter and
--                  salaryExpectations, 2 takeHomeTask, 3 videoScreen,
--                  4 cultureFitPanel. Opened with it: 100.0% for the first
--                  two, 0.0 for the rest.
--   4. by wave:    runs_at_wave 20 at every wave one to six.
--   5. cells:      keywordFilter split 50.0/50.0 across (3,4) and (5,4).
--   6. outcome:    keywordFilter 20 runs using, median final wave 4.5, and
--                  nothing to compare against. takeHomeTask 6.0 using
--                  against 3.0 not using, which is the confound the comment
--                  above that query describes, manufactured here on purpose:
--                  the runs that used it are exactly the runs that lasted.
--
-- Checked against Postgres 16 with all four migrations applied. All six
-- queries returned the figures above.

truncate public.analytics_events;

create or replace function seed_event(
  p_run text,
  p_event text,
  p_wave integer,
  p_props jsonb
) returns void language sql as $$
  insert into public.analytics_events
    (event, session_id, run_id, wave_number, variant_assignments,
     device_type, referrer, properties, ip_hash)
  values (
    p_event,
    p_run || '-s',
    p_run,
    p_wave,
    jsonb_build_object('starting-difficulty', 'control'),
    'desktop',
    'https://www.linkedin.com/',
    jsonb_build_object(
      'session_id', p_run || '-s',
      'run_id', p_run,
      'wave_number', p_wave
    ) || p_props,
    'hash'
  );
$$;

create or replace function seed_tower(
  p_run text,
  p_tower text,
  p_wave integer,
  p_currency integer,
  p_x integer,
  p_y integer
) returns void language sql as $$
  select seed_event(p_run, 'tower_placed', p_wave, jsonb_build_object(
    'tower_type', p_tower,
    'currency_before', p_currency,
    'grid_x', p_x,
    'grid_y', p_y
  ));
$$;

do $$
declare
  i integer;
  w integer;
  run text;
begin
  for i in 1..20 loop
    run := 'r' || i;

    perform seed_event(run, 'game_started', 0,
      jsonb_build_object('attempt_number', 1));

    -- Six waves started in every run, so query 4's denominator is a flat 20.
    for w in 1..6 loop
      perform seed_event(run, 'wave_started', w,
        jsonb_build_object('lives_remaining', 10, 'currency', 150));
    end loop;

    -- Everybody opens with two Keyword Filters, in the same two cells.
    perform seed_tower(run, 'keywordFilter', 1, 150, 3, 4);
    perform seed_tower(run, 'keywordFilter', 1, 90, 5, 4);

    -- Half go on to a Take-Home Task, and those are also the half that last.
    if i <= 10 then
      perform seed_tower(run, 'takeHomeTask', 2, 200, 7, 4);
    end if;

    if i <= 4 then
      perform seed_tower(run, 'videoScreen', 3, 300, 9, 4);
    end if;

    if i <= 2 then
      perform seed_tower(run, 'cultureFitPanel', 4, 400, 11, 4);
    end if;

    -- Free, single use, laid six at a time. It should top the placement count
    -- and still sit below Keyword Filter on reach.
    if i <= 15 then
      for w in 1..6 loop
        perform seed_tower(run, 'salaryExpectations', w, 100, w + 2, 6);
      end loop;
    end if;

    -- The runs that bought a Take-Home Task are the ones that got to wave six.
    -- Nothing here says the tower caused it, which is exactly the reading
    -- query 6 warns against and this fixture reproduces.
    perform seed_event(run, 'game_over', case when i <= 10 then 6 else 3 end,
      jsonb_build_object(
        'final_wave', case when i <= 10 then 6 else 3 end,
        'score', 500,
        'run_duration_ms', 120000
      ));
  end loop;
end;
$$;

drop function seed_tower(text, text, integer, integer, integer, integer);
drop function seed_event(text, text, integer, jsonb);

select
  count(*) as events,
  count(distinct run_id) as runs,
  count(*) filter (where event = 'tower_placed') as placements
from public.analytics_events;

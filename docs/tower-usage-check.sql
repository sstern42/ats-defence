-- Synthetic events for checking the tower usage queries.
--
-- Same idea as experiment-check.sql, and the same warning: it truncates the
-- table, so it belongs on an empty database with the migrations applied and
-- nowhere near the project holding the real events.
--
-- Twenty classic runs. Every run places two Keyword Filters, ten also place a
-- Take-Home Task, four a Video Screen, two a Culture Fit Panel, and fifteen lay
-- six Salary Expectations each. Nobody ever places a Knockout Question, which
-- is the case the whole thing is built around: it emits no events at all, so a
-- query that groups the events alone drops it silently, and a report about
-- dead weight that omits the deadest tower is worse than no report.
--
-- Five open advert runs sit alongside them and reach none of the figures below,
-- because every query filters to one mode. Each places the one tower no classic
-- run here ever places, so the filter failing is not a small drift: Knockout
-- Question stops being a row of zeros and the dead weight finding reverses.
-- See the trap at the end of the seeding block.
--
-- Expected, if the queries are right, reading classic:
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
--   7. mode trap:  every figure above is unchanged by the five open advert
--                  runs. Strip the `-- mode` lines and query 1 reports
--                  knockoutQuestion on 20.0% of runs, above videoScreen and
--                  cultureFitPanel, while keywordFilter falls to 80.0. That
--                  reversal is what the filter is for.
--
-- Checked against Postgres 16 with all six migrations applied. All six queries
-- returned the figures above, with the trap present and again with the mode
-- lines stripped, which produced the reversal in item 7.

truncate public.analytics_events;

create or replace function seed_event(
  p_run text,
  p_event text,
  p_wave integer,
  p_props jsonb
) returns void language sql as $$
  insert into public.analytics_events
    (event, session_id, run_id, wave_number, variant_assignments,
     device_type, referrer, mode, properties, ip_hash)
  values (
    p_event,
    p_run || '-s',
    p_run,
    p_wave,
    jsonb_build_object('starting-difficulty', 'control'),
    'desktop',
    'https://www.linkedin.com/',
    'classic',
    jsonb_build_object(
      'session_id', p_run || '-s',
      'run_id', p_run,
      'wave_number', p_wave,
      'mode', 'classic'
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

-- The mode trap. Five open advert runs, each placing a Knockout Question,
-- which is the one tower no classic run in this fixture ever places.
--
-- Every expected figure above is a classic figure and none of these rows may
-- reach any of them. Knockout Question is the trap because it is the tower the
-- whole fixture is built around: it appears as a row of zeros, and if the mode
-- filter is missing from query 1 it stops being zero and the dead weight
-- finding quietly reverses.
--
-- Inserted directly rather than through the helper, since the helper writes
-- classic and that is the whole point of it.
insert into public.analytics_events
  (event, session_id, run_id, wave_number, variant_assignments,
   device_type, referrer, mode, properties, ip_hash)
select
  e.event,
  'open' || k || '-s',
  'open' || k,
  e.wave,
  jsonb_build_object('starting-difficulty', 'control'),
  'desktop',
  'https://www.linkedin.com/',
  'openField',
  jsonb_build_object(
    'session_id', 'open' || k || '-s',
    'run_id', 'open' || k,
    'wave_number', e.wave,
    'mode', 'openField'
  ) || e.props,
  'hash'
from generate_series(1, 5) as k
cross join (
  values
    ('game_started', 0, jsonb_build_object('attempt_number', 1)),
    ('wave_started', 1, jsonb_build_object('lives_remaining', 10,
                                           'currency', 150)),
    ('tower_placed', 1, jsonb_build_object('tower_type', 'knockoutQuestion',
                                           'currency_before', 400,
                                           'grid_x', 6, 'grid_y', 6)),
    ('game_over', 4, jsonb_build_object('final_wave', 4, 'score', 500,
                                        'run_duration_ms', 120000))
) as e(event, wave, props);

drop function seed_tower(text, text, integer, integer, integer, integer);
drop function seed_event(text, text, integer, jsonb);

select
  count(*) as events,
  count(distinct run_id) as runs,
  count(*) filter (where event = 'tower_placed') as placements
from public.analytics_events;

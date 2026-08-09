-- Synthetic events for checking the upgrade card queries.
--
-- Same idea as tower-usage-check.sql, and the same warning: it truncates the
-- table, so it belongs on an empty database with the migrations applied and
-- nowhere near the project holding the real events.
--
-- Twelve phone runs, thirty-three choices between them, and the pairs are laid
-- out by hand rather than generated so that every figure below can be worked
-- out on paper before Postgres is asked.
--
-- What the fixture is built to catch, beyond the arithmetic:
--
--   Widen the criteria is never offered and never taken. It emits nothing at
--   all, so a query that groups the events alone drops it silently. It is the
--   reason query 1 lists the catalogue instead, and it should appear as a row
--   of zeros with a null rate.
--
--   Update the keyword list is offered twelve times and taken none of them.
--   That is the other kind of dead weight and the kind that does survive a
--   grouping, so the two failure modes are both present and are different rows.
--
--   Four classic runs sit alongside, and one of them carries an
--   `upgrade_offered` that could never really happen. It is there to be caught:
--   it is what a mode set wrongly at run start looks like, and query 5 is the
--   only query in the file that should see it.
--
-- Expected, if the queries are right:
--
--   1. rates:      panelReview 18 offered, 18 taken, 100.0%.
--                  parallelScreening 14 offered, 8 taken, 57.1%.
--                  higherBar 10 offered, 4 taken, 40.0%.
--                  extendedDeadline 12 offered, 3 taken, 25.0%.
--                  keywordListUpdate 12 offered, 0 taken, 0.0%.
--                  widerCriteria 0, 0, null, and present rather than missing.
--                  The four offer counts sum to 66, which is 33 rows times two
--                  appearances, and the takes sum to 33, which is one a row.
--
--   2. head to head: eight pairs. keywordListUpdate against panelReview met 8
--                  times with panelReview taken every time (a_pct 0.0, since
--                  keywordListUpdate sorts first). parallelScreening against
--                  keywordListUpdate met 4, parallelScreening taken 4.
--                  extendedDeadline against parallelScreening met 4,
--                  parallelScreening taken 4. panelReview beats
--                  parallelScreening 4 of 4, higherBar 3 of 3 and
--                  extendedDeadline 3 of 3. extendedDeadline against higherBar
--                  met 5, higherBar taken 2, so a_pct 60.0 to extendedDeadline.
--                  higherBar against parallelScreening met 2, higherBar 2.
--
--   3. when taken: only the four cards ever taken appear. widerCriteria and
--                  keywordListUpdate are absent, which is the one place in the
--                  file where absent is the right answer.
--
--   4. outcome:    panelReview taken in 5 of the 12 runs, median intake 5
--                  against 3 for the runs that never took it, which is the
--                  confound the comment above that query describes, present
--                  here on purpose: the choices are dealt in order, so the runs
--                  that took it are exactly the runs that lasted long enough to
--                  be dealt one. widerCriteria and keywordListUpdate report 0
--                  runs taking and a null median against 3.5 for everybody
--                  else, which is the shape a card nobody takes should produce
--                  rather than an empty result.
--
--   5. census:     two rows, and that is the failure. oneClickApply with 33
--                  offers over 12 runs, and classic with 1 over 1. The classic
--                  row is the seeded fault and its presence is the finding.
--
--   6. mode trap:  strip the `-- mode` lines and query 1 gains the classic
--                  row's two appearances. widerCriteria goes from 0 offered,
--                  0 taken and a null rate to 1, 1 and 100.0%, which is the
--                  dead weight finding for it reversing outright, and higherBar
--                  slips from 40.0% to 36.4%. One card in the report changes
--                  from never offered to always taken on the strength of a
--                  single mislabelled row, which is what the filter is for.
--
-- Checked against Postgres 16 with all eight migrations applied. All five
-- queries returned the figures above, and stripping the `-- mode` lines
-- produced the reversal in item 6.

truncate public.analytics_events;

create or replace function seed_event(
  p_run text,
  p_event text,
  p_wave integer,
  p_mode text,
  p_props jsonb
) returns void language sql as $$
  insert into public.analytics_events
    (event, session_id, run_id, wave_number, variant_assignments,
     device_type, referrer, mode, properties, ip_hash, received_at)
  values (
    p_event,
    p_run || '-s',
    p_run,
    p_wave,
    jsonb_build_object('starting-difficulty', 'control'),
    case when p_mode = 'oneClickApply' then 'mobile' else 'desktop' end,
    'https://www.linkedin.com/',
    p_mode,
    jsonb_build_object(
      'session_id', p_run || '-s',
      'run_id', p_run,
      'wave_number', p_wave,
      'mode', p_mode
    ) || p_props,
    'hash',
    timestamptz '2026-08-10 12:00:00+00'
  );
$$;

/* One choice: the card taken, the card refused, and the intake just cleared. */
create or replace function seed_offer(
  p_run text,
  p_wave integer,
  p_taken text,
  p_refused text
) returns void language sql as $$
  select seed_event(p_run, 'upgrade_offered', p_wave, 'oneClickApply',
    jsonb_build_object('taken', p_taken, 'refused', p_refused));
$$;

do $$
declare
  -- The thirty-three choices, in the order they are dealt out to the runs
  -- below. Read as taken, refused.
  --
  -- Eighteen of them contain panelReview and it wins all eighteen, which is
  -- what an auto-take looks like in this data. The remaining fifteen are the
  -- rest of the pool arguing among themselves.
  choices text[][] := array[
    -- panelReview against the field, eighteen times, taken every time.
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'keywordListUpdate'],
    ['panelReview', 'parallelScreening'],
    ['panelReview', 'parallelScreening'],
    ['panelReview', 'parallelScreening'],
    ['panelReview', 'parallelScreening'],
    ['panelReview', 'higherBar'],
    ['panelReview', 'higherBar'],
    ['panelReview', 'higherBar'],
    ['panelReview', 'extendedDeadline'],
    ['panelReview', 'extendedDeadline'],
    ['panelReview', 'extendedDeadline'],

    -- parallelScreening takes the four it is offered against the card nobody
    -- wants, and the four against extendedDeadline.
    ['parallelScreening', 'keywordListUpdate'],
    ['parallelScreening', 'keywordListUpdate'],
    ['parallelScreening', 'keywordListUpdate'],
    ['parallelScreening', 'keywordListUpdate'],
    ['parallelScreening', 'extendedDeadline'],
    ['parallelScreening', 'extendedDeadline'],
    ['parallelScreening', 'extendedDeadline'],
    ['parallelScreening', 'extendedDeadline'],

    -- higherBar wins its two against parallelScreening and two of five against
    -- extendedDeadline, which is the one pair in the fixture that is close.
    ['higherBar', 'parallelScreening'],
    ['higherBar', 'parallelScreening'],
    ['higherBar', 'extendedDeadline'],
    ['higherBar', 'extendedDeadline'],
    ['extendedDeadline', 'higherBar'],
    ['extendedDeadline', 'higherBar'],
    ['extendedDeadline', 'higherBar']
  ];

  -- How far each run got. A run reaching intake N made N - 1 choices, and the
  -- twelve of them come to the thirty-three above.
  finals integer[] := array[6, 6, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2];

  i integer;
  w integer;
  run text;
  at integer := 1;
begin
  for i in 1..array_length(finals, 1) loop
    run := 'oca' || lpad(i::text, 2, '0');

    perform seed_event(run, 'game_started', 0, 'oneClickApply',
      jsonb_build_object('attempt_number', 1));

    for w in 1..finals[i] loop
      perform seed_event(run, 'wave_started', w, 'oneClickApply',
        jsonb_build_object('lives_remaining', 240, 'currency', 0));
    end loop;

    -- One card after every intake except the last, which is the one the run
    -- ended on.
    for w in 1..(finals[i] - 1) loop
      perform seed_offer(run, w, choices[at][1], choices[at][2]);

      at := at + 1;
    end loop;

    perform seed_event(run, 'game_over', finals[i], 'oneClickApply',
      jsonb_build_object(
        'final_wave', finals[i],
        'score', finals[i] * 150,
        'run_duration_ms', finals[i] * 20000
      ));
  end loop;

  -- Four classic runs, to prove the filters hold. Three are ordinary and emit
  -- nothing this file reads.
  for i in 1..4 loop
    run := 'cls' || i;

    perform seed_event(run, 'game_started', 0, 'classic',
      jsonb_build_object('attempt_number', 1));
    perform seed_event(run, 'game_over', 7, 'classic',
      jsonb_build_object('final_wave', 7, 'score', 900, 'run_duration_ms', 1));
  end loop;

  -- The trap, and the reason query 5 has no mode filter. A classic run cannot
  -- offer a card, because no desktop board has any, so this row can only exist
  -- if a run was recorded under the wrong mode. The leaderboard reads that same
  -- setting, so it is a warning about where a score was filed as much as about
  -- where an event landed.
  --
  -- It names widerCriteria on purpose. That is the card the fixture otherwise
  -- never offers, so a filter that fails does not shift a number slightly, it
  -- turns the one row of zeros in query 1 into a card with a 100% take rate.
  perform seed_event('cls1', 'upgrade_offered', 3, 'classic',
    jsonb_build_object('taken', 'widerCriteria', 'refused', 'higherBar'));
end $$;

drop function seed_offer(text, integer, text, text);
drop function seed_event(text, text, integer, text, jsonb);

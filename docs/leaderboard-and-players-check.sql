-- Synthetic events and board rows for checking the queries in
-- leaderboard-and-players.sql before they are pointed at real players.
--
-- Same reasoning as experiment-check.sql. A query that turns out to be wrong
-- is worse than no query, because it produces a number rather than an error
-- and nothing about a plausible wrong number announces itself. So the
-- arithmetic is checked here first, against a dataset small enough that every
-- figure below can be counted by hand.
--
-- This is a fixture. It truncates both tables, so it goes nowhere near the
-- project holding the real data: apply the migrations to an empty database,
-- run this, then run leaderboard-and-players.sql against it.
--
-- It is arithmetic, not a simulation. Every wave costs one life, every run
-- places the same three towers, and nobody ever runs out of money. None of
-- that is how the game behaves, and none of it needs to be: the queries are
-- being checked for whether they count the right rows, not for whether the
-- rows describe a plausible afternoon.
--
--
-- The population
-- --------------
--
-- 55 sessions and 54 runs after the cutoff, made of:
--
--   12 sessions that open the page and never start a run
--   10 runs  lost at wave 3, no submission, no replay
--   14 runs  lost at wave 5, all submitted, 9 of them replayed
--    9 runs  the replays, lost at wave 7
--    5 runs  abandoned on unload at wave 2
--    3 runs  abandoned on idle at wave 4
--    2 runs  abandoned by quitting from the pause screen at wave 6
--    2 runs  abandoned by restarting from the pause screen at wave 6
--    2 runs  the restarts, lost at wave 4
--    2 runs  that reached wave 8 and emitted no ending at all
--    2 runs  that cleared all ten waves
--    3 runs  that started and never reached wave one
--
-- The board holds 15 rows after the cutoff: 14 from the wave 5 runs, and one
-- whose run never reached the collector.
--
--
-- Expected, if the queries are right
-- ----------------------------------
--
-- 1. coverage, post-cutoff event counts:
--      wave_started 253, wave_completed 204, tower_placed 162,
--      leaderboard_viewed 106, session_started 55, game_started 54,
--      applicant_leaked 49, game_over 37, run_abandoned 15,
--      score_submitted 14, restart_clicked 11, kofi_clicked 9
--
-- 2. funnel: 55, 43, 54, 37, 14, 15, 14
--      pct_of_previous 78.2, 125.6, 68.5, 37.8, 107.1, 93.3
--
-- 3. where runs end, reached and pct_reached by wave:
--      0: 54 100.0   1: 51 94.4   2: 51 94.4   3: 46 85.2   4: 36 66.7
--      5: 31  57.4   6: 17 31.5   7: 13 24.1   8:  4  7.4   9:  2  3.7
--     10:  2   3.7
--      ended_here: wave 0 has 3 abandoned, wave 2 has 5 abandoned, wave 3 has
--      10 game overs, wave 4 has 2 game overs and 3 abandoned, wave 5 has 14
--      game overs, wave 6 has 4 abandoned, wave 7 has 9 game overs, wave 8 has
--      2 with no ending, wave 10 has 2 game overs
--
-- 4. how runs end:
--      game over 37 (68.5%), won 2, median final wave 5.0
--      abandoned: unload 8 (14.8%), median 2.0
--      abandoned: idle 3 (5.6%), median 4.0
--      abandoned: quit 2 (3.7%), median 6.0
--      abandoned: restart 2 (3.7%), median 6.0
--      no ending recorded 2 (3.7%), median null
--
-- 5. difficulty, started / completed / pct_completed by wave:
--      1: 51 51 100.0   2: 51 46 90.2   3: 46 36 78.3   4: 36 31 86.1
--      5: 31 17  54.8   6: 17 13 76.5   7: 13  4 30.8   8:  4  2 50.0
--      9:  2  2 100.0  10:  2  2 100.0
--      median_duration_s is ten times the wave number, mean_lives_lost 1.00
--      and mean_towers 3.0 throughout
--
-- 6. leaks: graduate 5 at wave 2 and 10 at wave 3, careerChanger 5 at wave 4,
--      overqualified 14 at wave 5, keywordStuffer 4 at wave 6, referral 9 at
--      wave 7, boomerang 2 at wave 8. 49 in total.
--
-- 7. replay:
--      game over 37 runs, 9 replayed (24.3%), mean attempt 1.30
--      abandoned: restart 2 runs, 2 replayed (100.0%)
--      everything else 0 replayed
--
-- 8. the board: 15 rows, scores 1350 down to 700 in fifties and then 650.
--      pct_of_ceiling runs 79.4 down to 41.2, and 38.2 for the last.
--      score_check: 13 agree, 1 disagrees, 1 has no game over event.
--      run_events is 0 for exactly one row and between 18 and 20 for the rest.
--
-- 9. submitting and replaying:
--      submitted a score: 14 runs, 14 saw the board, 9 replayed (64.3%)
--      did not: 23 runs, 23 saw the board, 0 replayed (0.0%)
--
-- 10. the near miss:
--      made the top ten 10 entries, ranks 1 to 10, 9 of them before the board
--        was full, 8 replayed (80.0%), mean points behind tenth 0.0
--      missed the top ten 4 entries, ranks 11 to 14, 1 replayed (25.0%),
--        mean points behind tenth 125.0
--      run never reached the collector 1 entry, rank 15, 0 replayed
--
-- 11. the board is 15 entries from 14 submitters and 14 sessions, one of whom
--      put up 2, being 13.3% of the board.
--
-- 12. the tip jar:
--      home 3 clicks from 3 sessions of 55 (5.5%)
--      game over 6 clicks from 6 runs of 37 (16.2%)
--      game over, submitted 4 of 14 (28.6%)
--      game over, did not submit 2 of 23 (8.7%)
--
--
-- The six traps
-- -------------
--
-- Each is a row that looks like something it is not, and each is caught by a
-- different line in the queries, so a figure that comes out right is evidence
-- that line is still there.
--
-- **The cutoff.** Three developer runs sit before it, backdated to the morning
-- of the launch, and two of them are on the board. All three clear all ten
-- waves, which is the loudest thing they could be. Drop the cutoff and runs go
-- from 54 to 57, survival at wave ten from 3.7% to 8.8% and wins from 2 to 5.
--
-- On the board it is quieter and worth reading closely, because the count that
-- looks stable is the one that moved. The two backdated rows were submitted
-- before every real entry, so they sit ahead of all of them from the moment
-- each was submitted and every real rank shifts by two. "Made the top ten"
-- still reads 10, but two of the ten are now the developer's own, the entries
-- that missed go from 4 to 6, and the row with no run drops from rank 15 to
-- 17. A figure that does not move is not evidence the line is there.
--
-- **The sessions that never played.** Twelve of them, and they are the largest
-- single drop in the funnel. A funnel that took its first step from the
-- sessions attached to runs instead of from `session_started` would read 43
-- and lose the whole of the first step, which is the one place the data says
-- anything about people who looked at the game and decided against it.
--
-- **The board row with no run.** One row whose run id appears nowhere in the
-- events. Query 2 shows it as 15 rows against 14 matches, query 8 gives it a
-- row with `run_events` of 0, and query 10 puts it on its own line rather than
-- counting it as somebody who did not replay. An inner join anywhere in those
-- three and it disappears silently, which is the one thing a board row nobody
-- can account for must not do.
--
-- **The board view that fires twice.** Every submitter sees the panel reload
-- after their score goes in, so `leaderboard_viewed` from the game over screen
-- is 51 events across 37 runs. Query 9 counts distinct runs and reports 37. A
-- version counting events reports more views than there were game overs.
--
-- **The runs with no ending.** Two runs reach wave 8 and emit neither a game
-- over nor an abandonment, which is what a tab closed from a background window
-- looks like. They must appear as their own row in queries 3, 4 and 7 rather
-- than being folded into either real outcome.
--
-- **The score that disagrees with its own run.** One entry claims 1050 while
-- the `game_over` event from the same run says 300. It is inside the
-- plausibility ceiling for wave 5, so the server accepted it and nothing but
-- this cross-check can see it. Query 8 must report exactly one `disagrees`.
--
-- Checked against Postgres 16 with all four migrations applied. All twelve
-- queries returned the figures above.


truncate public.analytics_events;
truncate public.leaderboard;


-- One event, with the six globals filled in the way the collector fills them.
create or replace function seed_event(
  p_event text,
  p_session text,
  p_run text,
  p_wave integer,
  p_props jsonb,
  p_at timestamptz,
  p_device text,
  p_browser text,
  p_country text,
  p_arm text
) returns void language plpgsql as $$
begin
  insert into public.analytics_events
    (event, session_id, run_id, wave_number, variant_assignments, device_type,
     referrer, properties, sent_at, received_at, ip_hash, country, browser, os)
  values (
    p_event,
    p_session,
    p_run,
    p_wave,
    jsonb_build_object('starting-difficulty', p_arm),
    p_device,
    'https://www.linkedin.com/',
    jsonb_build_object(
      'session_id', p_session,
      'run_id', p_run,
      'wave_number', p_wave,
      'variant_assignments', jsonb_build_object('starting-difficulty', p_arm),
      'device_type', p_device,
      'referrer', 'https://www.linkedin.com/'
    ) || p_props,
    p_at,
    p_at,
    'hash-' || p_session,
    p_country,
    p_browser,
    case when p_device = 'tablet' then 'iOS' else 'Windows' end
  );
end;
$$;


-- A session opening the page. The home screen builds a board panel, so every
-- session that sees rows emits a view whether anybody looked at it or not.
create or replace function seed_session(
  p_session text,
  p_at timestamptz,
  p_device text,
  p_browser text,
  p_country text,
  p_arm text
) returns void language plpgsql as $$
begin
  perform seed_event(
    'session_started', p_session, null, 0,
    jsonb_build_object('referrer', 'https://www.linkedin.com/',
                       'device_type', p_device),
    p_at, p_device, p_browser, p_country, p_arm);

  perform seed_event(
    'leaderboard_viewed', p_session, null, 0,
    jsonb_build_object('from_screen', 'home'),
    p_at + interval '1 second', p_device, p_browser, p_country, p_arm);
end;
$$;


-- One run. `p_waves` is the furthest wave it started, and 0 means it never
-- reached the first one. Every run puts down the same three things in the
-- opening pause, which is why they carry wave 0.
create or replace function seed_run(
  p_run text,
  p_session text,
  p_at timestamptz,
  p_attempt integer,
  p_waves integer,
  p_ending text,      -- 'game_over', 'none', or an abandonment reason
  p_score integer,
  p_leak text,        -- the type that got through in the furthest wave
  p_won boolean,      -- completed the furthest wave as well as starting it
  p_device text,
  p_browser text,
  p_country text,
  p_arm text
) returns void language plpgsql as $$
declare
  w integer;
  towers text[] := array['keywordFilter', 'takeHomeTask', 'salaryExpectations'];
  ends_at timestamptz := p_at + (p_waves * interval '1 minute')
    + interval '45 seconds';
begin
  perform seed_event(
    'game_started', p_session, p_run, 0,
    jsonb_build_object('attempt_number', p_attempt),
    p_at, p_device, p_browser, p_country, p_arm);

  for w in 1..3 loop
    perform seed_event(
      'tower_placed', p_session, p_run, 0,
      jsonb_build_object('tower_type', towers[w], 'currency_before', 150,
                         'grid_x', 4 + w, 'grid_y', 6),
      p_at + (w * interval '5 seconds'),
      p_device, p_browser, p_country, p_arm);
  end loop;

  for w in 1..p_waves loop
    perform seed_event(
      'wave_started', p_session, p_run, w,
      jsonb_build_object('lives_remaining', 10, 'currency', 150),
      p_at + (w * interval '1 minute'),
      p_device, p_browser, p_country, p_arm);

    -- A wave the run did not get through emits no completion, which is how
    -- the difficulty query knows where the wall is.
    if w < p_waves or p_won then
      perform seed_event(
        'wave_completed', p_session, p_run, w,
        jsonb_build_object('duration_ms', w * 10000, 'lives_lost', 1,
                           'towers_on_board', 3),
        p_at + (w * interval '1 minute') + interval '30 seconds',
        p_device, p_browser, p_country, p_arm);
    end if;
  end loop;

  if p_leak is not null then
    perform seed_event(
      'applicant_leaked', p_session, p_run, p_waves,
      jsonb_build_object('applicant_type', p_leak),
      p_at + (p_waves * interval '1 minute') + interval '20 seconds',
      p_device, p_browser, p_country, p_arm);
  end if;

  if p_ending = 'game_over' then
    perform seed_event(
      'game_over', p_session, p_run, p_waves,
      jsonb_build_object('final_wave', p_waves, 'score', p_score,
                         'run_duration_ms', p_waves * 60000),
      ends_at, p_device, p_browser, p_country, p_arm);

    -- The game over screen builds a board panel too.
    perform seed_event(
      'leaderboard_viewed', p_session, p_run, p_waves,
      jsonb_build_object('from_screen', 'game_over'),
      ends_at + interval '2 seconds',
      p_device, p_browser, p_country, p_arm);
  elsif p_ending <> 'none' then
    perform seed_event(
      'run_abandoned', p_session, p_run, p_waves,
      jsonb_build_object('final_wave', p_waves,
                         'run_duration_ms', p_waves * 60000,
                         'reason', p_ending),
      ends_at, p_device, p_browser, p_country, p_arm);
  end if;
end;
$$;


do $$
declare
  i integer;
  k integer;
  base timestamptz := timestamptz '2026-08-06 09:00:00+00';
  at timestamptz;
  ends timestamptz;
  board_score integer;
  arm text;
begin
  -- Twelve sessions that open the page and go no further. Three of them click
  -- the tip jar on the way out, which is the only thing they ever do.
  for i in 1..12 loop
    at := base + (i * interval '1 minute');

    perform seed_session('sz' || i, at, 'desktop', 'Chrome', 'GB', 'control');

    if i <= 3 then
      perform seed_event(
        'kofi_clicked', 'sz' || i, null, 0,
        jsonb_build_object('from_screen', 'home', 'final_wave', null),
        at + interval '20 seconds', 'desktop', 'Chrome', 'GB', 'control');
    end if;
  end loop;

  -- Ten runs lost at wave three. Two of them click the tip jar afterwards.
  for i in 1..10 loop
    at := timestamptz '2026-08-07 09:00:00+00' + (i * interval '1 hour');
    arm := case when i % 2 = 0 then 'busy' else 'control' end;

    perform seed_session('sa' || i, at - interval '1 minute',
                         'desktop', 'Chrome', 'GB', arm);
    perform seed_run('a' || i, 'sa' || i, at, 1, 3, 'game_over', 560,
                     'graduate', false, 'desktop', 'Chrome', 'GB', arm);

    if i <= 2 then
      perform seed_event(
        'kofi_clicked', 'sa' || i, 'a' || i, 3,
        jsonb_build_object('from_screen', 'game_over', 'final_wave', 3),
        at + interval '4 minutes', 'desktop', 'Chrome', 'GB', arm);
    end if;
  end loop;

  -- Fourteen runs lost at wave five, every one of them submitted. Scores run
  -- down in fifties so that submitting in time order is submitting in falling
  -- score order, which puts entry k at rank k on the board it was shown.
  --
  -- Nine of them go again: the first eight, who all made the top ten, and one
  -- who did not. The other five stop.
  for k in 1..14 loop
    at := timestamptz '2026-08-06 10:00:00+00' + (k * interval '1 hour');
    ends := at + (5 * interval '1 minute') + interval '45 seconds';
    board_score := 1400 - (50 * k);
    arm := case when k % 2 = 0 then 'busy' else 'control' end;

    perform seed_session('sb' || k, at - interval '1 minute',
                         'desktop', 'Chrome', 'GB', arm);

    -- Entry seven is the forgery. The board will say 1050 and the run says
    -- 300, and both are inside the ceiling for wave five so nothing else can
    -- tell.
    perform seed_run(
      'b' || k, 'sb' || k, at, 1, 5, 'game_over',
      case when k = 7 then 300 else board_score end,
      'overqualified', false, 'desktop', 'Chrome', 'GB', arm);

    perform seed_event(
      'score_submitted', 'sb' || k, 'b' || k, 5,
      jsonb_build_object('score', board_score, 'final_wave', 5),
      ends + interval '9 minutes', 'desktop', 'Chrome', 'GB', arm);

    -- The panel reloads to show the player where they landed, so the same run
    -- emits a second view.
    perform seed_event(
      'leaderboard_viewed', 'sb' || k, 'b' || k, 5,
      jsonb_build_object('from_screen', 'game_over'),
      ends + interval '9 minutes 2 seconds',
      'desktop', 'Chrome', 'GB', arm);

    insert into public.leaderboard
      (display_name, score, final_wave, run_id, ip_hash, submitted_at)
    values (
      'Applicant' || lpad(k::text, 2, '0'),
      board_score,
      5,
      'b' || k,
      -- The first two entries come from the same address, so the board is one
      -- name shorter than it looks.
      case when k <= 2 then 'hash-shared' else 'hash-b' || k end,
      at + interval '10 minutes'
    );

    if k <= 4 then
      perform seed_event(
        'kofi_clicked', 'sb' || k, 'b' || k, 5,
        jsonb_build_object('from_screen', 'game_over', 'final_wave', 5),
        ends + interval '10 minutes', 'desktop', 'Chrome', 'GB', arm);
    end if;

    if k <= 8 or k = 11 then
      perform seed_event(
        'restart_clicked', 'sb' || k, 'b' || k, 5,
        jsonb_build_object('from_wave', 5, 'previous_score', board_score),
        at + interval '29 minutes', 'desktop', 'Chrome', 'GB', arm);

      perform seed_run(
        'c' || k, 'sb' || k, at + interval '30 minutes', 2, 7, 'game_over',
        1040, 'referral', false, 'desktop', 'Chrome', 'GB', arm);
    end if;
  end loop;

  -- The board row nobody can account for. Submitted after all fourteen, with
  -- a run id that appears in no event.
  insert into public.leaderboard
    (display_name, score, final_wave, run_id, ip_hash, submitted_at)
  values (
    'Nowhere',
    650,
    5,
    'ghost1',
    'hash-ghost',
    timestamptz '2026-08-07 00:20:00+00'
  );

  -- Five abandoned on unload at wave two.
  for i in 1..5 loop
    at := timestamptz '2026-08-08 09:00:00+00' + (i * interval '1 hour');

    perform seed_session('sd' || i, at - interval '1 minute',
                         'desktop', 'Firefox', 'US', 'busy');
    perform seed_run('d' || i, 'sd' || i, at, 1, 2, 'unload', null,
                     'graduate', false, 'desktop', 'Firefox', 'US', 'busy');
  end loop;

  -- Three that went idle at wave four.
  for i in 1..3 loop
    at := timestamptz '2026-08-08 15:00:00+00' + (i * interval '1 hour');

    perform seed_session('se' || i, at - interval '1 minute',
                         'desktop', 'Safari', 'US', 'control');
    perform seed_run('e' || i, 'se' || i, at, 1, 4, 'idle', null,
                     'careerChanger', false,
                     'desktop', 'Safari', 'US', 'control');
  end loop;

  -- Two that left for the home screen from the pause menu at wave six.
  for i in 1..2 loop
    at := timestamptz '2026-08-08 19:00:00+00' + (i * interval '1 hour');

    perform seed_session('sf' || i, at - interval '1 minute',
                         'tablet', 'Safari', 'GB', 'busy');
    perform seed_run('f' || i, 'sf' || i, at, 1, 6, 'quit', null,
                     'keywordStuffer', false, 'tablet', 'Safari', 'GB', 'busy');
  end loop;

  -- Two that restarted from the pause menu at wave six, and the runs that
  -- followed. An abandonment with a replay behind it, which is the case the
  -- replay query would miss if it only looked at game overs.
  for i in 1..2 loop
    at := timestamptz '2026-08-09 09:00:00+00' + (i * interval '1 hour');

    perform seed_session('si' || i, at - interval '1 minute',
                         'desktop', 'Chrome', 'GB', 'control');
    perform seed_run('i' || i, 'si' || i, at, 1, 6, 'restart', null,
                     'keywordStuffer', false,
                     'desktop', 'Chrome', 'GB', 'control');

    perform seed_event(
      'restart_clicked', 'si' || i, 'i' || i, 6,
      jsonb_build_object('from_wave', 6, 'previous_score', null),
      at + interval '29 minutes', 'desktop', 'Chrome', 'GB', 'control');

    perform seed_run('j' || i, 'si' || i, at + interval '30 minutes', 2, 4,
                     'game_over', 680, 'careerChanger', false,
                     'desktop', 'Chrome', 'GB', 'control');
  end loop;

  -- Two that reached wave eight and then said nothing at all.
  for i in 1..2 loop
    at := timestamptz '2026-08-09 13:00:00+00' + (i * interval '1 hour');

    perform seed_session('sg' || i, at - interval '1 minute',
                         'desktop', 'Chrome', 'DE', 'busy');
    perform seed_run('g' || i, 'sg' || i, at, 1, 8, 'none', null,
                     'boomerang', false, 'desktop', 'Chrome', 'DE', 'busy');
  end loop;

  -- Two that cleared the intake. Neither put a name in, which is what makes
  -- the wins visible in query 4 and absent from the board.
  for i in 1..2 loop
    at := timestamptz '2026-08-09 16:00:00+00' + (i * interval '1 hour');

    perform seed_session('sh' || i, at - interval '1 minute',
                         'desktop', 'Chrome', 'GB', 'control');
    perform seed_run('h' || i, 'sh' || i, at, 1, 10, 'game_over', 4000,
                     null, true, 'desktop', 'Chrome', 'GB', 'control');
  end loop;

  -- Three that pressed play and left during the opening pause, before wave
  -- one. They have a run and no wave at all.
  for i in 1..3 loop
    at := timestamptz '2026-08-09 19:00:00+00' + (i * interval '1 hour');

    perform seed_session('sk' || i, at - interval '1 minute',
                         'desktop', 'Chrome', 'GB', 'busy');
    perform seed_run('k' || i, 'sk' || i, at, 1, 0, 'unload', null,
                     null, false, 'desktop', 'Chrome', 'GB', 'busy');
  end loop;

  -- The developer testing the game on launch morning, before anybody arrived.
  -- Clean arm strings and perfect runs, so only the cutoff can catch them.
  for i in 1..3 loop
    at := timestamptz '2026-08-04 06:00:00+00' + (i * interval '1 minute');

    perform seed_session('sx' || i, at - interval '10 seconds',
                         'desktop', 'Chrome', 'GB', 'control');
    perform seed_run('x' || i, 'sx' || i, at, 1, 10, 'game_over',
                     4200 - (100 * i), null, true,
                     'desktop', 'Chrome', 'GB', 'control');

    if i <= 2 then
      perform seed_event(
        'score_submitted', 'sx' || i, 'x' || i, 10,
        jsonb_build_object('score', 4200 - (100 * i), 'final_wave', 10),
        at + interval '11 minutes', 'desktop', 'Chrome', 'GB', 'control');

      perform seed_event(
        'leaderboard_viewed', 'sx' || i, 'x' || i, 10,
        jsonb_build_object('from_screen', 'game_over'),
        at + interval '11 minutes 2 seconds',
        'desktop', 'Chrome', 'GB', 'control');

      insert into public.leaderboard
        (display_name, score, final_wave, run_id, ip_hash, submitted_at)
      values (
        'Testing' || i,
        4200 - (100 * i),
        10,
        'x' || i,
        'hash-sx' || i,
        at + interval '10 minutes'
      );
    end if;
  end loop;
end;
$$;

drop function seed_run(text, text, timestamptz, integer, integer, text,
                       integer, text, boolean, text, text, text, text);
drop function seed_session(text, timestamptz, text, text, text, text);
drop function seed_event(text, text, text, integer, jsonb, timestamptz,
                         text, text, text, text);


-- What was seeded, and how much of it the cutoff is holding back. The 88
-- events and 3 runs before the line are the developer test runs, and none of
-- them reaches any figure in the header, which is the point of them.
select
  count(*) as events,
  count(distinct session_id) as sessions,
  count(distinct run_id) as runs,
  count(*) filter (
    where received_at < timestamptz '2026-08-04 07:16:00+00'
  ) as events_before_the_cutoff,
  count(distinct run_id) filter (
    where received_at < timestamptz '2026-08-04 07:16:00+00'
  ) as runs_before_the_cutoff,
  (select count(*) from public.leaderboard) as board_rows,
  (select count(*) from public.leaderboard
     where submitted_at < timestamptz '2026-08-04 07:16:00+00')
    as board_rows_before_the_cutoff
from public.analytics_events;

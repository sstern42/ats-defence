-- Synthetic sessions for checking the device traffic queries.
--
-- Same idea as the other check files here, and the same warning: it truncates
-- the table, so it belongs on an empty database with the migrations applied and
-- nowhere near the project holding the real events.
--
-- Seventy sessions after the cutoff, on four device values, built so that every
-- known failure described at the top of device-traffic.sql is present in the
-- data rather than only in the prose.
--
--   20  desktop, windows, chrome, direct, played classic to intake 6.
--       One of them has no session_started, standing for an arrival beacon
--       lost on the way out.
--    8  desktop, macos, safari, from LinkedIn, played classic to intake 4.
--    4  desktop, macos, safari, from LinkedIn, never played. This is the iPad
--       passing as a Mac and then failing the size gate in portrait, which is
--       the only shape that case leaves behind.
--    3  desktop, linux, bot, direct, never played. Not people. Queries 3, 4
--       and 6 exclude them and queries 1, 2 and 7 do not, so they are the
--       one group whose count differs between queries on purpose.
--   18  mobile, ios, safari, from LinkedIn, never played. Phones, refused.
--       Nine of them carry an `experiment_viewed` as well as their arrival,
--       because being bucketed does not require the game to have loaded. See
--       the exposure trap below.
--    2  mobile, android, chrome, from LinkedIn, played classic to intake 5.
--       The Android tablet whose user agent never says "Tablet", counted as
--       mobile by the browser and let in by the gate, correctly. It is the
--       reason query 4 does not expect a mobile row of 100% held.
--    6  tablet, ios, safari, from LinkedIn, played classic to intake 5.
--    2  tablet, ios, safari, from LinkedIn, never played. The small tablet in
--       portrait, under 900 wide.
--    6  tablet, ios, safari, from LinkedIn, played OPEN ADVERT to intake 2.
--       The mode trap. See the note at the end of the seeding block.
--    1  no device type at all, windows, firefox, direct, never played.
--
-- Twelve more sit before the cutoff: desktop, twelve towers each, classic to
-- intake 9. They are the developer testing on the developer's machine, which is
-- the reason the cutoff exists and the reason it lands on one row rather than
-- spreading evenly.
--
-- Expected, if the queries are right:
--
--   1. arrivals:  desktop 34 at 49.3%, of which 3 are bots. mobile 20 at 29.0%,
--                 tablet 14 at 20.3%, (unrecognised) 1 at 1.4%. Sixty nine in
--                 total, not seventy, because d-1 never sent its arrival. Both
--                 timestamps in every row sit in August after the 4th, and
--                 nothing from the 1st appears anywhere.
--   2. the check: seventy sessions rather than sixty nine, and the extra one
--                 shows up as `sessions_with_no_arrival` of 1 on desktop and 0
--                 everywhere else. Desktop 35 at 50.0%, mobile 20 at 28.6%,
--                 tablet 14 at 20.0%, (unrecognised) 1 at 1.4%. Mobile averages
--                 3.0 events a session against desktop's 15.1, which is the
--                 asymmetry the note under this query describes.
--   3. weekly:    week beginning 2026-08-03, 47 sessions, 18/17/12 across
--                 desktop, mobile and tablet, 61.7% handheld. Week beginning
--                 2026-08-10, 20 sessions, 14/3/2, 25.0% handheld. The launch
--                 week is the handheld high water mark and the next week falls
--                 back, which is the shape the query exists to show. The three
--                 crawlers are excluded here and all three were in week two,
--                 which is why it reads 20 rather than the 23 in query 2.
--   4. the holding page:
--                 mobile 18 of 20 held, 90.0%, and the other two played. That
--                 is the answer the file is for, and the two that got through
--                 are the Android tablets in the mobile row rather than a
--                 leaking gate.
--                 tablet 2 of 14 held, 14.3%. desktop 4 of 32, 12.5%, all four
--                 the iPad-as-Mac case. The three crawlers are excluded, which
--                 is why desktop is 32 here against 35 in query 2, and why the
--                 row is not the 7 of 35 it would otherwise be.
--                 `saw_the_home_screen` equals `played` in every row, since
--                 nothing here loads the game and then leaves before the board
--                 arrives. On real data it will sit slightly above `played`.
--   5. what they did, classic:
--                 desktop 28 runs, median intake 6, 7.4 towers, 20 submitted.
--                 tablet 6 runs, median intake 5, 5.0 towers, 3 submitted.
--                 mobile 2 runs, median intake 5, 5.0 towers, 2 submitted.
--                 The six open advert runs are absent from all of it.
--   6. sources:   www.linkedin.com 46 sessions, 73.9% handheld, 47.8% played.
--                 (direct) 21 sessions, 0.0% handheld, 95.2% played. The
--                 crawlers all arrived direct and are excluded, so this row is
--                 21 rather than 24 and its play rate is not dragged down by
--                 traffic that was never going to play.
--                 The handheld share is a fact about where the link was posted
--                 and this is the query that says so.
--   7. classification:
--                 desktop/windows/chrome 20, none of them ever refused.
--                 mobile/ios/safari 18, all 18 refused, 100.0%.
--                 tablet/ios/safari 14, 2 refused, 14.3%.
--                 desktop/macos/safari 12, 4 refused, 33.3%. That row is the
--                 iPad hint, and it is the whole reason the query splits a
--                 device type by os and browser rather than reporting it whole.
--                 desktop/linux/bot 3, all refused. mobile/android/chrome 2,
--                 none refused. (unrecognised)/windows/firefox 1, refused.
--
-- Four traps, and each one is a plausible way to write the query wrong.
--
--   8. exposure trap:
--                 test query 4 for a session with a single event instead of a
--                 session with no game events, and mobile goes from 18 held at
--                 90.0% to 9 at 45.0%. Read straight, that says half the phones
--                 that arrive are playing the game, on a screen the gate has
--                 never once let through. What actually happened is that nine
--                 of them were bucketed by GrowthBook, and the exposure fires
--                 while the arrival event is assembling its own properties, so
--                 it lands on a session that never loaded anything. Desktop and
--                 tablet are the same error and both go to 0 held.
--
--   9. mode trap: strip the `-- mode` line from query 5 and the tablet row goes
--                 from 6 runs at a median intake of 5 to 12 runs at a median of
--                 3.5, on 4.0 towers rather than 5.0. Read straight, that says
--                 tablet players cannot get past intake three and place fewer
--                 towers than anybody else, which is the touch controls having
--                 failed. What actually happened is that half of those runs
--                 were a different mode with a different intake two. Nothing
--                 about the device moved.
--
--  10. cutoff trap:
--                 strip the `-- cutoff` lines and desktop arrivals go from 34
--                 to 46, and from 49.3% of traffic to 56.8%. In query 5 the
--                 desktop row goes from 28 runs to 40, the furthest intake from
--                 6 to 9 and the towers from 7.4 to 8.8. The excluded sessions
--                 are all on one device and all better at the game than anybody
--                 real, so they do not add noise to the report, they add it to
--                 one row of it.
--
--  11. crawler trap:
--                 strip the `-- bots` lines and the three automated sessions
--                 come back into queries 3, 4 and 6. Query 4 desktop goes
--                 from 4 held of 32 to 7 of 35, and 12.5% to 20.0%. Query 6
--                 direct goes from 21 sessions at 95.2% played to 24 at
--                 83.3%. Query 3 week two goes from 20 sessions to 23 and
--                 handheld from 25.0% to 21.7%.
--
--                 Three of seventy is small and every one of those moves is
--                 still visible, which is the argument for the filter rather
--                 than against it: the real table was over half crawler when
--                 this was written.
--
-- Checked against Postgres 16 with all seven migrations applied. All seven
-- queries returned the figures above, and all four traps were reproduced.

truncate public.analytics_events;

create or replace function seed_event(
  p_session text,
  p_run text,
  p_event text,
  p_wave integer,
  p_device text,
  p_os text,
  p_browser text,
  p_referrer text,
  p_mode text,
  p_at timestamptz,
  p_props jsonb
) returns void language sql as $$
  insert into public.analytics_events
    (event, session_id, run_id, wave_number, variant_assignments, device_type,
     referrer, mode, properties, sent_at, received_at, ip_hash, browser, os)
  values (
    p_event,
    p_session,
    p_run,
    p_wave,
    jsonb_build_object('starting-difficulty', 'control'),
    p_device,
    p_referrer,
    p_mode,
    jsonb_build_object(
      'session_id', p_session,
      'run_id', p_run,
      'wave_number', p_wave,
      'device_type', p_device,
      'referrer', p_referrer,
      'mode', p_mode
    ) || p_props,
    p_at,
    p_at,
    'hash',
    p_browser,
    p_os
  );
$$;

/**
 * One whole session. `p_final_wave` of zero is a session that arrived and never
 * got a run, which is what the support gate produces and what most of the
 * handheld rows below are.
 */
create or replace function seed_session(
  p_session text,
  p_device text,
  p_os text,
  p_browser text,
  p_referrer text,
  p_mode text,
  p_seen timestamptz,
  p_final_wave integer,
  p_towers integer,
  p_submit boolean,
  p_arrival boolean,
  p_bucketed boolean
) returns void language plpgsql as $$
declare
  run text := p_session || '-r';
  at timestamptz := p_seen;
  w integer;
  t integer;
begin
  -- GrowthBook's exposure, which fires while the arrival event is having its
  -- global properties assembled. It therefore lands on a session that never got
  -- past the holding page, and it is the reason query 4 tests for the absence of
  -- game events rather than for a session with one row.
  if p_bucketed then
    perform seed_event(
      p_session, null, 'experiment_viewed', 0, p_device, p_os, p_browser,
      p_referrer, p_mode, at,
      jsonb_build_object(
        'experiment_key', 'starting-difficulty',
        'variation_id', 0,
        'arm', 'control'
      )
    );
  end if;

  if p_arrival then
    perform seed_event(
      p_session, null, 'session_started', 0, p_device, p_os, p_browser,
      p_referrer, p_mode, at, '{}'::jsonb
    );
  end if;

  if p_final_wave = 0 then
    return;
  end if;

  at := at + interval '10 seconds';

  -- The home screen builds a leaderboard panel and the panel announces itself
  -- as soon as it has rows. It is what query 4 corroborates `held` against.
  perform seed_event(
    p_session, null, 'leaderboard_viewed', 0, p_device, p_os, p_browser,
    p_referrer, p_mode, at, jsonb_build_object('from_screen', 'home')
  );

  at := at + interval '5 seconds';

  perform seed_event(
    p_session, run, 'game_started', 0, p_device, p_os, p_browser,
    p_referrer, p_mode, at, jsonb_build_object('attempt_number', 1)
  );

  for w in 1..p_final_wave loop
    at := at + interval '30 seconds';

    perform seed_event(
      p_session, run, 'wave_started', w, p_device, p_os, p_browser,
      p_referrer, p_mode, at,
      jsonb_build_object('lives_remaining', 10, 'currency', 100)
    );
  end loop;

  for t in 1..p_towers loop
    at := at + interval '1 second';

    perform seed_event(
      p_session, run, 'tower_placed', p_final_wave, p_device, p_os, p_browser,
      p_referrer, p_mode, at,
      jsonb_build_object(
        'tower_type', 'keywordFilter',
        'currency_before', 100,
        'grid_x', t,
        'grid_y', 4
      )
    );
  end loop;

  at := at + interval '10 seconds';

  perform seed_event(
    p_session, run, 'game_over', p_final_wave, p_device, p_os, p_browser,
    p_referrer, p_mode, at,
    jsonb_build_object(
      'final_wave', p_final_wave,
      'score', p_final_wave * 200,
      'run_duration_ms', p_final_wave * 45000
    )
  );

  if p_submit then
    at := at + interval '20 seconds';

    perform seed_event(
      p_session, run, 'score_submitted', p_final_wave, p_device, p_os,
      p_browser, p_referrer, p_mode, at,
      jsonb_build_object('score', p_final_wave * 200, 'final_wave',
        p_final_wave)
    );
  end if;
end;
$$;

do $$
declare
  linkedin constant text := 'https://www.linkedin.com/feed/';
  week1 constant timestamptz := timestamptz '2026-08-05 12:00:00+00';
  week2 constant timestamptz := timestamptz '2026-08-12 12:00:00+00';
  i integer;
begin
  -- Desktop, playing properly. Six arrived in the launch week and fourteen the
  -- week after, which is what a launch spike looks like from the desktop side.
  -- Session d-1 is missing its session_started, standing for a lost beacon.
  for i in 1..20 loop
    perform seed_session(
      'd-' || i, 'desktop', 'windows', 'chrome', 'direct', 'classic',
      case when i <= 6 then week1 else week2 end,
      6, 8, true, i <> 1, true
    );
  end loop;

  -- Desktop by classification, Safari on macOS, arrived from the launch post.
  -- Eight played and four never did. The four are the iPad case, and nothing
  -- in this table can say so outright.
  for i in 1..8 loop
    perform seed_session(
      'm-' || i, 'desktop', 'macos', 'safari', linkedin, 'classic',
      week1, 4, 6, false, true, true
    );
  end loop;

  for i in 1..4 loop
    perform seed_session(
      'mb-' || i, 'desktop', 'macos', 'safari', linkedin, 'classic',
      week1, 0, 0, false, true, true
    );
  end loop;

  -- Announced themselves as automated. Counted as desktop by the browser,
  -- because a crawler does not put Mobi in its user agent.
  for i in 1..3 loop
    perform seed_session(
      'bot-' || i, 'desktop', 'linux', 'bot', 'direct', 'classic',
      week2, 0, 0, false, true, false
    );
  end loop;

  -- Phones. Every one of them arrived, saw the message and left.
  for i in 1..18 loop
    perform seed_session(
      'p-' || i, 'mobile', 'ios', 'safari', linkedin, 'classic',
      case when i <= 15 then week1 else week2 end,
      0, 0, false, true, i <= 9
    );
  end loop;

  -- Android tablets reported as mobile. Big enough for the gate, so they play,
  -- and they sit in the mobile row while doing it.
  for i in 1..2 loop
    perform seed_session(
      'a-' || i, 'mobile', 'android', 'chrome', linkedin, 'classic',
      week1, 5, 5, true, true, true
    );
  end loop;

  -- Tablets, playing classic. Three of the six get on the board, which is the
  -- thing that was impossible until a soft keyboard had a field to open for.
  for i in 1..6 loop
    perform seed_session(
      't-' || i, 'tablet', 'ios', 'safari', linkedin, 'classic',
      week1, 5, 5, i <= 3, true, true
    );
  end loop;

  -- Tablets too narrow in portrait for the gate.
  for i in 1..2 loop
    perform seed_session(
      'tb-' || i, 'tablet', 'ios', 'safari', linkedin, 'classic',
      week2, 0, 0, false, true, true
    );
  end loop;

  -- The trap. Six tablet sessions playing open advert, whose intake two is not
  -- classic's intake two. They belong in every session level query here and in
  -- none of query 4, and if the mode filter goes, query 4 reports that tablet
  -- players stall at intake three and place fewer towers than anybody. They do
  -- not. They played a different game.
  for i in 1..6 loop
    perform seed_session(
      'oa-' || i, 'tablet', 'ios', 'safari', linkedin, 'openAdvert',
      week1, 2, 3, false, true, true
    );
  end loop;

  -- A device type the collector would not have stored. It cannot arrive from
  -- the real game, and it is here so the (unrecognised) row is exercised rather
  -- than assumed.
  perform seed_session(
    'x-1', null, 'windows', 'firefox', 'direct', 'classic',
    week2, 0, 0, false, true, false
  );

  -- The other trap. Twelve runs from before the cutoff, all on one machine,
  -- all further into the game than anybody real got. Strip the cutoff lines and
  -- they do not add noise to the report, they add it to the desktop row.
  for i in 1..12 loop
    perform seed_session(
      'dev-' || i, 'desktop', 'windows', 'chrome', 'direct', 'classic',
      timestamptz '2026-08-01 09:00:00+00', 9, 12, true, true, true
    );
  end loop;
end;
$$;

drop function seed_session(
  text, text, text, text, text, text, timestamptz, integer, integer,
  boolean, boolean, boolean
);
drop function seed_event(
  text, text, text, integer, text, text, text, text, text, timestamptz, jsonb
);

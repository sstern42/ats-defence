-- Leaderboard storage.
--
-- Nothing in the browser ever reaches this table. Both the read and the write
-- go through a Netlify function using the service role key, which is why there
-- are no policies below: row level security is on, the table has no policy, so
-- anon and authenticated can do nothing at all. The service role bypasses row
-- level security, so the functions carry on working.
--
-- That is a tighter position than an anon key with insert and select rights,
-- and it costs nothing, since the client was never going to be trusted with
-- the shape of a submission anyway.

create table if not exists public.leaderboard (
  id bigint generated always as identity primary key,
  display_name text not null,
  score integer not null,
  final_wave integer not null,
  -- The run the score came from. Unique, so the same run cannot be submitted
  -- twice. It is client supplied and therefore forgeable, but it stops the
  -- cheapest sort of replay without costing anything.
  run_id text not null unique,
  -- Salted hash rather than the address itself. Enough to rate limit by, and
  -- not enough to identify anybody.
  ip_hash text not null,
  submitted_at timestamptz not null default now(),

  constraint leaderboard_score_sane check (score >= 0 and score <= 100000),
  constraint leaderboard_wave_sane check (final_wave >= 1 and final_wave <= 100),
  constraint leaderboard_name_length check (
    char_length(display_name) between 1 and 16
  )
);

-- The only read the game makes: ten rows, best first, earliest submission
-- winning a tie.
create index if not exists leaderboard_ranking_idx
  on public.leaderboard (score desc, submitted_at asc);

-- The rate limit check: how many times has this address submitted lately.
create index if not exists leaderboard_rate_limit_idx
  on public.leaderboard (ip_hash, submitted_at desc);

alter table public.leaderboard enable row level security;

-- Belt and braces. The project was created with new tables not exposed to the
-- Data API roles, so these should already be absent.
revoke all on public.leaderboard from anon, authenticated;

grant select, insert on public.leaderboard to service_role;

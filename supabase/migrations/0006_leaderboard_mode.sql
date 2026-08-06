-- One board per mode.
--
-- The two modes send different numbers of applicants at boards of a different
-- shape, so a rating from one is not comparable with a rating from the other.
-- Ranking them together would not produce a leaderboard, it would produce a
-- ranking of whichever mode turned out to be more generous.
--
-- A column rather than a second table, because it is the same row with the same
-- rules: the same name checks, the same rate limit, the same one submission per
-- run. Only the ordering is per mode.
--
-- Every row already here was played before there was a choice, so the default
-- backfills them as classic, which is what they are.

alter table public.leaderboard
  add column if not exists mode text not null default 'classic';

alter table public.leaderboard
  drop constraint if exists leaderboard_mode_known;

-- Spelled out rather than derived, because a check constraint cannot read
-- config.js. The list is short and adding a mode is already a migration, since
-- the new board needs backfilling into nothing.
alter table public.leaderboard
  add constraint leaderboard_mode_known
  check (mode in ('classic', 'openField'));

-- The only read the game makes, now asked once per board: ten rows for one
-- mode, best first, earliest submission winning a tie. The old index led on
-- score, which cannot serve a query filtered by mode, so it is replaced rather
-- than added to.
drop index if exists leaderboard_ranking_idx;

create index if not exists leaderboard_mode_ranking_idx
  on public.leaderboard (mode, score desc, submitted_at asc);

-- A third board, for the back channel.
--
-- The constraint added with the second mode spells the modes out, because a
-- check constraint cannot read config.js, and 0006 says in as many words that
-- adding a mode is already a migration. This is that migration, and it was
-- missed when the mode itself was written: the game offered the mode, the
-- function accepted the score, and the database refused the insert, which
-- reaches the player as a run that would not record.
--
-- Nothing to backfill. Every row already here was played in one of the two
-- modes that existed when it was played, and a new board starting empty is what
-- a new board should look like.
--
-- The constraint is dropped and rewritten rather than added to, because a check
-- constraint has no alter and the whole list wants to be readable in one place
-- anyway. It is the same list as MODE_KEYS in src/config/modes.js, and it is
-- the only copy of that list anywhere outside it.

alter table public.leaderboard
  drop constraint if exists leaderboard_mode_known;

alter table public.leaderboard
  add constraint leaderboard_mode_known
  check (mode in ('classic', 'openField', 'backChannel'));

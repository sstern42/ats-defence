-- A fourth board, for the phone version.
--
-- One-click apply is played by a different scene set on a different board, but
-- the leaderboard does not care what drew it: a score is a score, a mode column
-- says which game it came from, and this constraint is the only place in the
-- project where that list is written by hand.
--
-- This is the migration 0007 exists as a warning about. That one was missed
-- when the back channel was written, so the game offered the mode, the function
-- accepted the score, and the database refused the insert, which reaches the
-- player as a run that would not record. tools/check-mode-list.mjs was built
-- afterwards to make that failure a red build rather than a support question,
-- and it is what will fail if this file is wrong.
--
-- Nothing to backfill. Every row already here was played in one of the three
-- modes that existed when it was played.
--
-- Dropped and rewritten rather than added to, because a check constraint has no
-- alter and the whole list wants to be readable in one place. It is the same
-- list as MODE_KEYS in src/config/modes.js.

alter table public.leaderboard
  drop constraint if exists leaderboard_mode_known;

alter table public.leaderboard
  add constraint leaderboard_mode_known
  check (mode in ('classic', 'openField', 'backChannel', 'oneClickApply'));

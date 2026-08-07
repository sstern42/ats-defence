/**
 * Does the database agree with the game about which modes exist?
 *
 * The leaderboard's `mode` column carries a check constraint naming the modes
 * one by one, because a check constraint cannot import config.js. Everything
 * else reads MODE_KEYS: the home page builds its tabs from it, the collector
 * validates against it, the score function measures a submission against the
 * mode's own wave list. So a third mode was added, every one of those picked it
 * up on its own, and the only thing that did not was the one thing that can
 * refuse a score.
 *
 * That failure is invisible to the build. The game compiles, the functions
 * work, the board reads, and the first anybody hears of it is a player
 * finishing a run and being told the score could not be recorded.
 *
 * So this compares the two lists and fails when they drift. It is not a test of
 * the database, which nothing in CI can reach without credentials this repo
 * deliberately does not hold. It is a test that the migration was written, and
 * writing the migration is the part that gets forgotten.
 *
 * Run by hand with `node tools/check-mode-list.mjs`, and by CI on every pull
 * request.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MODE_KEYS } from '../src/config/modes.js';

const MIGRATIONS = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

/**
 * The constraint being written. A migration may only drop and rewrite it, since
 * a check constraint has no alter, so the one that counts is the last one any
 * migration writes.
 */
const WRITES_CONSTRAINT =
  /add\s+constraint\s+leaderboard_mode_known\s+check\s*\(\s*mode\s+in\s*\(([^)]*)\)\s*\)/gi;

function constraintAsItStands() {
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  let latest = null;

  files.forEach((name) => {
    const sql = readFileSync(`${MIGRATIONS}${name}`, 'utf8');

    for (const match of sql.matchAll(WRITES_CONSTRAINT)) {
      latest = { name, modes: [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]) };
    }
  });

  return latest;
}

const constraint = constraintAsItStands();

if (!constraint) {
  console.error(
    'No migration writes the leaderboard_mode_known constraint. Either it has\n' +
      'been dropped without being rewritten, in which case the leaderboard will\n' +
      'accept a score for any mode at all, or this check is looking for the wrong\n' +
      'name and wants updating alongside whatever renamed it.'
  );
  process.exit(1);
}

const inGame = new Set(MODE_KEYS);
const inDatabase = new Set(constraint.modes);
const missing = MODE_KEYS.filter((mode) => !inDatabase.has(mode));
const extra = constraint.modes.filter((mode) => !inGame.has(mode));

if (missing.length === 0 && extra.length === 0) {
  console.log(
    `The game and ${constraint.name} agree on ${MODE_KEYS.length} modes: ${MODE_KEYS.join(', ')}.`
  );

  process.exit(0);
}

const label = 'config/modes.js'.padEnd(constraint.name.length);

console.error(
  missing.length > 0
    ? 'The game plays a mode the leaderboard will not take a score for.\n'
    : 'The leaderboard names a mode the game does not play.\n'
);
console.error(`  ${label}: ${MODE_KEYS.join(', ')}`);
console.error(`  ${constraint.name}: ${constraint.modes.join(', ')}\n`);

if (missing.length > 0) {
  console.error(
    `Missing from the constraint: ${missing.join(', ')}.\n` +
      'A run in one of those will pass the name check, the plausibility ceiling\n' +
      'and the rate limit, and then be refused by the database, which reaches the\n' +
      'player as a score that would not record. Add a migration that drops and\n' +
      'rewrites leaderboard_mode_known with the full list.\n'
  );
}

if (extra.length > 0) {
  console.error(
    `In the constraint but not in the game: ${extra.join(', ')}.\n` +
      'Harmless to a player, since nothing can submit one, but it means a mode was\n' +
      'renamed or removed and the rows already on that board are now unreachable.\n'
  );
}

process.exit(1);

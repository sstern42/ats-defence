/**
 * Display name validation.
 *
 * Done here rather than in the browser, because a check the client performs is
 * a check the client can skip. The game does the same check as it types, but
 * only so the player finds out before submitting rather than after.
 *
 * Three rules, in the order they are cheapest to fail: a restricted character
 * set, a length cap of sixteen, and a profanity list.
 *
 * The first two are shared with the game, so what the player is allowed to
 * type and what the server will accept cannot drift apart. The word list stays
 * here and is never sent to the browser.
 */
import {
  NAME_MAX_LENGTH,
  NAME_PATTERN
} from '../../../src/config/leaderboard.js';

/**
 * Common substitutions, folded before matching, so the list does not need an
 * entry for every way of spelling a word with digits in it.
 */
const SUBSTITUTIONS = {
  0: 'o',
  1: 'i',
  3: 'e',
  4: 'a',
  5: 's',
  7: 't',
  8: 'b',
  '@': 'a',
  $: 's',
  '!': 'i'
};

/**
 * Short on purpose, and not exhaustive. It covers what turns up unprompted in
 * a name box on a game shared on LinkedIn. Anything it misses gets added when
 * it turns up, which is how these lists work whatever anybody claims.
 */
const BLOCKED = [
  'anal',
  'arse',
  'bastard',
  'bitch',
  'bollock',
  'boob',
  'clit',
  'cock',
  'coon',
  'cum',
  'cunt',
  'dick',
  'dildo',
  'fag',
  'fuck',
  'jizz',
  'kike',
  'nazi',
  'nigg',
  'paki',
  'penis',
  'piss',
  'porn',
  'prick',
  'pussy',
  'rape',
  'retard',
  'semen',
  'sex',
  'shit',
  'slut',
  'spastic',
  'tits',
  'tosser',
  'twat',
  'vagina',
  'wank',
  'whore'
];

/**
 * Folds a name down to the letters underneath it, so spacing, punctuation and
 * digit substitutions do not get anything past the list.
 */
function fold(name) {
  return name
    .toLowerCase()
    .split('')
    .map((character) => SUBSTITUTIONS[character] ?? character)
    .join('')
    .replace(/[^a-z]/g, '');
}

/**
 * Substring matching, which will occasionally object to an innocent name. That
 * is the wrong way round to be wrong, but the alternative is word boundary
 * matching that anybody can walk through by removing a space, and the cost of
 * a false positive here is being asked to pick a different name.
 */
function isProfane(name) {
  const folded = fold(name);

  return BLOCKED.some((word) => folded.includes(word));
}

/**
 * Returns the name to store, or a short reason it will not do. Surrounding
 * whitespace is trimmed rather than rejected, since it is almost always a
 * stray keystroke rather than an attempt at anything.
 */
export function checkName(value) {
  if (typeof value !== 'string') {
    return { error: 'name is required' };
  }

  const name = value.trim();

  if (name.length === 0) {
    return { error: 'name is required' };
  }

  if (name.length > NAME_MAX_LENGTH) {
    return { error: `name must be ${NAME_MAX_LENGTH} characters or fewer` };
  }

  if (!NAME_PATTERN.test(name)) {
    return { error: 'name may use letters, numbers, spaces . _ - and apostrophes' };
  }

  if (isProfane(name)) {
    return { error: 'pick another name' };
  }

  return { name };
}

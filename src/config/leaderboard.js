/**
 * Display name rules. Plain data, no logic, and read by both sides: the game
 * uses them so the player finds out as they type, and the Netlify function
 * uses them because a check performed in a browser is a check that can be
 * skipped.
 *
 * The word list is not here. It lives with the function and is never sent to
 * the browser, since there is nothing to gain from shipping a list of words to
 * the people most likely to read it as a challenge.
 */
export const NAME_MAX_LENGTH = 16;

/**
 * ASCII letters, digits and a handful of separators. Deliberately narrow: it
 * keeps out right-to-left overrides, zero width characters and the homoglyph
 * tricks that make a leaderboard look broken.
 */
export const NAME_CHARACTER = /^[A-Za-z0-9 ._'-]$/;
export const NAME_PATTERN = /^[A-Za-z0-9 ._'-]+$/;

/** How many rows the board shows, and the only number the server will return. */
export const TOP_N = 10;

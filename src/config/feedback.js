/**
 * The one question the game asks, and the answers it will take.
 *
 * Plain data, no logic, and read by both sides: the game draws the options from
 * it and the collector checks an answer against it before storing one. That is
 * the same arrangement the name rules and the mode list already have, and here
 * it is the whole point. A closed set is only closed if the endpoint knows what
 * the set is. An open one is a public unauthenticated text box, which is the
 * thing this deliberately is not.
 *
 * The labels are not here. They are copy, and they live in content/copy.js
 * under these keys, the same as towers and applicants.
 */

/**
 * Which question was asked, carried on every answer.
 *
 * There is one question and there is no plan for a second, so this looks like a
 * field that earns nothing. It is here because of what the mode column cost: a
 * table of rows that did not say which game they came from needed a migration
 * and a backfill to become readable again, and the rows written before it could
 * only be guessed at. An answer that does not say what it was answering is the
 * same shape of problem, and one short string a row is a cheaper insurance than
 * the backfill was.
 */
export const FEEDBACK_QUESTION = 'difficulty';

/**
 * The answers, in the order they are offered.
 *
 * Three of them are a difficulty scale and the fourth is not on it. That is the
 * one doing the work: a run that ended at intake five because the player was
 * outplayed and a run that ended at intake five because they never worked out
 * what was happening need opposite fixes, and nothing already in the table
 * separates them.
 */
export const FEEDBACK_ANSWERS = [
  'straightforward',
  'aboutRight',
  'gruelling',
  'lost'
];

/**
 * The one question the game asks, and the once it gets asked.
 *
 * Everything the analytics store holds is a record of what a player did. None
 * of it is a record of what they thought, and there is one place where that
 * gap matters: the difficulty curve. The events say which intake a run ended
 * on and say nothing at all about whether losing there felt like the player's
 * own fault. This is the smallest thing that closes that gap, which is one
 * question with four fixed answers and no box to type in.
 *
 * Once a session rather than once a run, and that is the whole of what this
 * file is for. A survey on the end of every run is nagging, the second answer
 * from the same player is worth less than the first, and a player who has been
 * asked four times has been asked about a different game each time. The scene
 * that draws the question asks here whether to draw it at all.
 *
 * The answer goes out through analytics.js like everything else. It is sent
 * from here rather than from the scene because marking the question answered
 * and recording the answer are one piece of bookkeeping, and two call sites
 * that have to be kept in step is how a session ends up either asked twice or
 * counted twice.
 */
import { FEEDBACK_ANSWERS, FEEDBACK_QUESTION } from '../config/feedback.js';
import { trackFeedbackGiven } from './analytics.js';

/**
 * Held per tab, next to the analytics session, so a reload does not ask again
 * and a new tab is a new player as far as this is concerned. That is the same
 * boundary `session_id` already draws, which is what makes "once a session"
 * mean the same thing here as it does in the data.
 */
const ASKED_KEY = 'requisita.feedback_given';

/**
 * Storage is not always there. Private browsing and blocked storage both throw
 * on access, and a session that cannot be remembered is one that gets asked
 * again on the next run rather than one that breaks, so this carries the page
 * on its own when the store will not.
 */
let askedThisPage = false;

/** Whether there is any point drawing the question. */
export function feedbackWanted() {
  return !askedThisPage && readStored(ASKED_KEY) === null;
}

/**
 * The player has answered. Marked first and sent second, so an analytics call
 * that fails still leaves a session that has been asked.
 *
 * An answer that is not one of the four is dropped rather than sent. Nothing in
 * the game can produce one, since the options are drawn from the same list, and
 * that is exactly why it is worth checking here: this and the collector agree
 * about what an answer is, and the day they stop agreeing the game should be
 * the side that goes quiet.
 */
export function recordFeedback({ answer, finalWave }) {
  if (!FEEDBACK_ANSWERS.includes(answer)) {
    return;
  }

  askedThisPage = true;
  writeStored(ASKED_KEY, answer);

  trackFeedbackGiven({
    question: FEEDBACK_QUESTION,
    answer,
    finalWave
  });
}

function readStored(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Nothing to do. The flag above carries the rest of this page load.
  }
}

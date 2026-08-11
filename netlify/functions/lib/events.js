/**
 * What the collector will accept.
 *
 * The endpoint is public and unauthenticated, because it has to be: the events
 * come from a browser with no key. So it takes the narrowest thing that still
 * records what the spec asks for, and refuses everything else. An open endpoint
 * that writes arbitrary JSON to a 500MB database is a filling station for
 * anybody who finds it.
 */
import { FEEDBACK_ANSWERS } from '../../../src/config/feedback.js';
import { UPGRADE_IDS } from '../../../src/config/upgrades.js';
import { MODE_KEYS } from '../../../src/config/modes.js';

/**
 * The events in the analytics spec, and nothing else. An event name not on
 * this list is refused rather than stored, which means a typo in the game
 * shows up as a rejected event rather than as a column of quiet rubbish nobody
 * notices until they try to analyse it.
 *
 * Twelve of them are the game reporting itself. The thirteenth,
 * `experiment_viewed`, is GrowthBook reporting that a player was bucketed. The
 * fourteenth, `feedback_given`, is the player answering the one question the
 * game asks, and it is the only one carrying anything a person chose rather
 * than something the game observed. See the answer check below.
 */
export const ALLOWED_EVENTS = new Set([
  'session_started',
  'game_started',
  'wave_started',
  'wave_completed',
  'tower_placed',
  'applicant_leaked',
  'game_over',
  'run_abandoned',
  'restart_clicked',
  'score_submitted',
  'leaderboard_viewed',
  'kofi_clicked',
  'experiment_viewed',
  'feedback_given',

  // The fifteenth. The phone board's only player decision, and the only event
  // that records something declined as well as something done. Its argument is
  // in services/analytics.js at trackUpgradeOffered.
  'upgrade_offered',

  // The last three, and the only ones added together. They are one engagement
  // told in order: somebody who cannot fill the vacancy arriving at it, the
  // contract renewing itself while nobody deals with it, and how it finished.
  // The argument for three rather than one is in services/analytics.js at
  // trackContractStarted.
  'contract_started',
  'contract_renewed',
  'contract_ended'
]);

/**
 * How a contract finished, which is the only per-event property check here that
 * is not a config import. There is no config for it: the two words are decided
 * by the scene rather than listed anywhere, and they are the whole of what
 * `contract_ended` says that the other two do not.
 */
const CONTRACT_END_REASONS = new Set(['rejected', 'expired']);

/** Long enough for the largest real event several times over. */
/** The cards, read from the same config the game draws them from. */
const UPGRADE_ID = new Set(UPGRADE_IDS);

const MAX_PROPERTIES_BYTES = 4096;
const MAX_STRING = 300;
const MAX_ID = 64;

const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet']);

/**
 * The modes the game can be played in, read from the same config the game plays
 * from, so a mode that exists and a mode the collector will store cannot drift
 * apart. Anything else is stored as null rather than rejected: an event with an
 * unreadable mode is still worth having, and refusing it would lose the rest of
 * what it says over one field.
 */
const MODES = new Set(MODE_KEYS);

/**
 * The answers the one survey question will take, read from the same config the
 * game draws its options from, so an answer the game can give and an answer the
 * collector will store cannot drift apart.
 *
 * This is the only per-event property check in this file, and it is the whole
 * reason the question is four fixed answers rather than a box to type in.
 * Without it the property bag would happily take four kilobytes of anything at
 * all posted under the name of an answer, which is a public unauthenticated
 * text field with extra steps, and nothing else here would notice.
 */
const FEEDBACK_ANSWER = new Set(FEEDBACK_ANSWERS);

function trimmed(value, limit) {
  return typeof value === 'string' ? value.slice(0, limit) : null;
}

function wholeNumber(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null;
}

/**
 * Checks one event and returns the row to insert, or a reason it will not do.
 *
 * The globals are lifted into their own fields for querying, and the whole
 * property bag is kept as it arrived. Anything unrecognised in the bag is left
 * alone rather than stripped: it is already size capped, and throwing away a
 * field the game starts sending tomorrow would be worse than storing it.
 */
export function checkEvent(payload) {
  if (!payload || typeof payload !== 'object') {
    return { error: 'body must be an object' };
  }

  const { event, properties, sent_at: sentAt } = payload;

  if (typeof event !== 'string' || !ALLOWED_EVENTS.has(event)) {
    return { error: 'unknown event' };
  }

  if (!properties || typeof properties !== 'object') {
    return { error: 'properties must be an object' };
  }

  const serialised = JSON.stringify(properties);

  if (serialised.length > MAX_PROPERTIES_BYTES) {
    return { error: 'properties too large' };
  }

  // Refused rather than stored with the field quietly dropped. The answer is
  // the whole of what this event says, so an event that does not carry one has
  // nothing left in it worth keeping.
  if (event === 'feedback_given' && !FEEDBACK_ANSWER.has(properties.answer)) {
    return { error: 'unknown answer' };
  }

  // Same arrangement, same reason. A card id is a closed set read from the same
  // config the game draws the cards from, and an event naming a card that does
  // not exist has nothing in it worth keeping. `refused` is checked too, since
  // it is half of what makes this event worth having.
  if (
    event === 'upgrade_offered' &&
    (!UPGRADE_ID.has(properties.taken) || !UPGRADE_ID.has(properties.refused))
  ) {
    return { error: 'unknown upgrade' };
  }

  // Same arrangement again. An engagement that ended for a reason this endpoint
  // has never heard of is an engagement nothing can be concluded from, since the
  // two reasons are opposite findings about the same feature and the rest of the
  // event is meaningless without knowing which of them it is.
  if (
    event === 'contract_ended' &&
    !CONTRACT_END_REASONS.has(properties.end_reason)
  ) {
    return { error: 'unknown contract end reason' };
  }

  const sessionId = trimmed(properties.session_id, MAX_ID);

  if (!sessionId) {
    return { error: 'session_id is required' };
  }

  const variants = properties.variant_assignments;

  return {
    row: {
      event,
      session_id: sessionId,
      run_id: trimmed(properties.run_id, MAX_ID),
      wave_number: wholeNumber(properties.wave_number),
      variant_assignments:
        variants && typeof variants === 'object' && !Array.isArray(variants)
          ? variants
          : null,
      device_type: DEVICE_TYPES.has(properties.device_type)
        ? properties.device_type
        : null,
      referrer: trimmed(properties.referrer, MAX_STRING),
      mode: MODES.has(properties.mode) ? properties.mode : null,
      properties,
      // The browser's own clock, which is not to be trusted but is worth
      // keeping next to the arrival time. The database sets received_at.
      sent_at: typeof sentAt === 'string' ? sentAt.slice(0, 40) : null
    }
  };
}

/**
 * What the collector will accept.
 *
 * The endpoint is public and unauthenticated, because it has to be: the events
 * come from a browser with no key. So it takes the narrowest thing that still
 * records what the spec asks for, and refuses everything else. An open endpoint
 * that writes arbitrary JSON to a 500MB database is a filling station for
 * anybody who finds it.
 */

/**
 * The twelve events in the analytics spec, and nothing else. An event name not
 * on this list is refused rather than stored, which means a typo in the game
 * shows up as a rejected event rather than as a column of quiet rubbish nobody
 * notices until they try to analyse it.
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
  'kofi_clicked'
]);

/** Long enough for the largest real event several times over. */
const MAX_PROPERTIES_BYTES = 4096;
const MAX_STRING = 300;
const MAX_ID = 64;

const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet']);

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
      properties,
      // The browser's own clock, which is not to be trusted but is worth
      // keeping next to the arrival time. The database sets received_at.
      sent_at: typeof sentAt === 'string' ? sentAt.slice(0, 40) : null
    }
  };
}

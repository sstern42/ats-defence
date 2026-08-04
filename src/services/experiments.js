/**
 * Experiment assignments, via GrowthBook.
 *
 * There is one experiment, on starting difficulty, and the point of it is that
 * wave one is read from an assignment rather than hardcoded. That seam was
 * built at step 7, and nothing that calls this has had to change since: the
 * game still asks for a list of waves and still gets one.
 *
 * Three things can decide the arm, in order:
 *
 * 1. A `difficulty` query parameter, which forces an arm so the variant can be
 *    looked at on a deploy preview.
 * 2. GrowthBook, which is the real answer.
 * 3. Nothing, if there is no client key or GrowthBook did not answer in time.
 *    The game plays the control arm so it still works.
 *
 * Only the second is a real assignment. The other two are reported as such
 * rather than being quietly counted as control, because a forced preview run
 * and an unreachable CDN both look exactly like a control player otherwise,
 * and both would bias whichever arm they were folded into.
 *
 * GrowthBook also reports the bucketing itself, through the tracking callback
 * below, and that goes out as an `experiment_viewed` event. It is a stronger
 * record than the arm on every other event: the arm string says what the game
 * played, the exposure says the player was genuinely put in the experiment.
 */
import { GrowthBook } from '@growthbook/growthbook';

import { WAVES, WAVE_ONE_VARIANTS } from '../config/waves.js';

const STARTING_DIFFICULTY = 'starting-difficulty';
const DEFAULT_ARM = 'control';

/**
 * The client key is public by design. It reads feature definitions and nothing
 * else, which is why it is the one key in this project allowed a VITE_ prefix.
 */
const CLIENT_KEY = import.meta.env.VITE_GROWTHBOOK_CLIENT_KEY ?? '';
const API_HOST =
  import.meta.env.VITE_GROWTHBOOK_API_HOST ?? 'https://cdn.growthbook.io';

/**
 * How long the game waits for an assignment before starting without one. A
 * player looking at a blank page because a feature flag service is slow is a
 * worse outcome than an unassigned run.
 */
const LOAD_TIMEOUT_MS = 1500;

/**
 * The identity the assignment is hashed against. Local storage rather than
 * session storage, so somebody who comes back tomorrow is in the arm they were
 * in yesterday. An experiment a returning player can change sides in is not
 * measuring what it claims to.
 */
const PARTICIPANT_KEY = 'requisita.participant_id';

let growthbook = null;
let ready = false;
let assignment = null;

/**
 * Where exposures go once something is listening, and the ones that arrived
 * before anything was. Analytics registers the handler, so this file never
 * imports analytics and the two cannot end up importing each other.
 */
let exposureHandler = null;
let flushQueued = false;
const pendingExposures = [];

/**
 * Starts GrowthBook and waits, briefly, for the feature definitions. Called
 * once from main.js before anything else, since every analytics event carries
 * the assignment and an event sent before this resolves would carry the wrong
 * one.
 */
export async function initExperiments() {
  if (!CLIENT_KEY) {
    return { assigned: false, source: 'no client key' };
  }

  growthbook = new GrowthBook({
    apiHost: API_HOST,
    clientKey: CLIENT_KEY,
    attributes: { id: participantId() },
    trackingCallback: recordExposure,
    // Nothing here reacts to a flag changing mid run, so there is no reason to
    // hold a streaming connection open for the length of a session.
    backgroundSync: false
  });

  try {
    const response = await growthbook.init({ timeout: LOAD_TIMEOUT_MS });

    ready = response.success;

    return { assigned: ready, source: response.source };
  } catch {
    // A feature flag service is not allowed to stop the game starting.
    ready = false;

    return { assigned: false, source: 'error' };
  }
}

/**
 * Registers what to do with exposures, and hands over any that GrowthBook has
 * already reported. Called once by analytics, which is the only thing that
 * knows how to send an event.
 */
export function setExposureHandler(handler) {
  exposureHandler = handler;

  flushExposures();
}

/**
 * GrowthBook's own record that a player was bucketed. It fires once per
 * experiment, and only when the value came from an experiment rule the player
 * was actually in, which is the part worth having: a forced preview run and a
 * run that never reached the CDN both produce an arm, and neither produces one
 * of these.
 *
 * The bucketing id is deliberately not on it. It is in local storage and never
 * leaves the browser, which is the posture the rest of this file already takes.
 * The exposure carries `session_id` like every other event, so it joins to the
 * rest of the run that way instead.
 */
function recordExposure(experiment, result) {
  pendingExposures.push({
    experiment_key: experiment.key,
    variation_id: result.variationId,
    arm: result.value
  });

  flushExposures();
}

/**
 * Exposures are handed on in a microtask rather than straight away, because
 * the callback fires in the middle of the feature lookup, and the lookup is
 * usually made by an analytics event asking what the assignment is. Sending an
 * event from inside the sending of an event is a knot not worth tying.
 */
function flushExposures() {
  if (!exposureHandler || flushQueued || pendingExposures.length === 0) {
    return;
  }

  flushQueued = true;

  queueMicrotask(() => {
    flushQueued = false;

    while (pendingExposures.length > 0) {
      exposureHandler(pendingExposures.shift());
    }
  });
}

/**
 * A stable anonymous id, used for bucketing and nothing else. It is not sent
 * with analytics events and is not tied to anything the player types.
 */
function participantId() {
  try {
    const existing = window.localStorage.getItem(PARTICIPANT_KEY);

    if (existing) {
      return existing;
    }

    const minted = createId();

    window.localStorage.setItem(PARTICIPANT_KEY, minted);

    return minted;
  } catch {
    // Storage is blocked. The player still gets an arm, it just will not be
    // the same arm next time.
    return createId();
  }
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The arm for the experiment and where it came from, worked out once and then
 * remembered. Nothing after start-up can change it, and an assignment that
 * moved underneath a run would make the run unreadable.
 *
 * Anything unrecognised falls back to the control arm, so a mistyped query
 * parameter or a feature value that no longer matches the wave data plays the
 * normal game rather than a broken one.
 */
function assign() {
  if (assignment) {
    return assignment;
  }

  const forced = new URLSearchParams(window.location.search).get('difficulty');

  if (forced && WAVE_ONE_VARIANTS[forced]) {
    assignment = { arm: forced, source: 'forced' };
  } else if (!ready || !growthbook) {
    assignment = { arm: DEFAULT_ARM, source: 'unassigned' };
  } else {
    const value = growthbook.getFeatureValue(STARTING_DIFFICULTY, DEFAULT_ARM);

    assignment = WAVE_ONE_VARIANTS[value]
      ? { arm: value, source: 'growthbook' }
      : { arm: DEFAULT_ARM, source: 'unassigned' };
  }

  return assignment;
}

/**
 * Every assignment for this run, in the shape the analytics spec wants as a
 * global property: one string per experiment.
 *
 * A real assignment is reported as the arm on its own. Anything else is
 * prefixed with where it came from, so `forced:busy` and `unassigned:control`
 * are visibly not assigned players and can be filtered out of the analysis
 * rather than silently widening one side of it.
 */
export function getVariantAssignments() {
  const { arm, source } = assign();

  return {
    [STARTING_DIFFICULTY]: source === 'growthbook' ? arm : `${source}:${arm}`
  };
}

/**
 * The wave list for a run, with wave one taken from the assigned arm. Waves
 * two onwards are the same in both arms: the experiment is about how the game
 * opens, not how it goes on.
 */
export function resolveWaves() {
  const { arm } = assign();

  return WAVES.map((wave, index) => (index === 0 ? WAVE_ONE_VARIANTS[arm] : wave));
}

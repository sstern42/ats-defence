/**
 * Analytics.
 *
 * The instrumentation is as much the point of this project as the game is, so
 * the event names and their properties are the ones in the spec and nothing
 * else. Everything the game records goes through one of the named functions
 * below rather than through `track` directly, which means this file is the
 * whole list of what gets emitted and there is nowhere else to look.
 *
 * Seven global properties go on every event without exception. They are
 * gathered per event rather than frozen at boot, since the wave and the run
 * change under them and the experiment assignment will be asynchronous once
 * GrowthBook arrives at step 11.
 *
 * The seventh is `mode`, and it was added when the game gained a second one. It
 * is a property rather than an event because it is not a thing that happens: it
 * is a fact about the run every other event is already reporting, and without
 * it every question in the spec goes ambiguous the moment two modes exist. Where
 * players quit, whether the curve is right and which towers are dead weight all
 * have two answers now, and no way of telling them apart from an event that
 * does not say which game it came from.
 *
 * The one exception is `experiment_viewed`, which has no call site because it
 * is not something the game does: it is GrowthBook saying a player was
 * bucketed, so it arrives through a handler registered below.
 *
 * Where the events are posted is set by `VITE_ANALYTICS_ENDPOINT` at build
 * time. With no endpoint set, nothing is posted and everything still runs:
 * events are kept on `window.requisita.events` and, with `?analytics` in the
 * query string, printed to the console. That is how a deploy preview gets
 * checked before any store exists.
 */
import { getVariantAssignments, setExposureHandler } from './experiments.js';
import { currentModeKey } from './mode.js';

/** Sixty seconds of nothing at all counts as the player having wandered off. */
const IDLE_MS = 60000;

/**
 * How long a tab may sit hidden before the player counts as gone. Long enough
 * to check something in another tab and come back, short enough that somebody
 * who has actually left is recorded before they close the browser.
 */
const HIDDEN_GRACE_MS = 30000;

/** How many events are kept on `window` for looking at. Enough for a run. */
const LOG_LIMIT = 200;

/**
 * Campaign parameters, read once when the session opens. They go on
 * `session_started` rather than on every event, because attribution belongs to
 * a session and repeating it a dozen times would bloat every row to say the
 * same thing. Join on `session_id` to attribute anything else.
 */
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
];

/** Anything the player does that says they are still sitting there. */
const INPUT_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart'
];

/**
 * Held per tab rather than per page, so a reload carries on the same session
 * and the attempt count survives it.
 */
const SESSION_KEY = 'requisita.session_id';
const ATTEMPT_KEY = 'requisita.attempt_number';

/**
 * The collector, on this site's own origin. It defaults to the Netlify
 * function rather than needing an environment variable, for the same reason
 * the leaderboard does: it is same origin, it needs no key, and one fewer
 * setting is one fewer thing to have forgotten on launch day.
 *
 * `VITE_ANALYTICS_ENDPOINT` still overrides it, so the events can be pointed
 * somewhere else later without touching this file.
 */
const ENDPOINT =
  import.meta.env.VITE_ANALYTICS_ENDPOINT || '/.netlify/functions/collect';

/**
 * Events are printed to the console during development, and in a built game
 * when `?analytics` is in the query string, which is how a deploy preview gets
 * read without a store behind it.
 */
const VERBOSE =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).has('analytics');

const events = [];

const state = {
  sessionId: null,
  runId: null,
  attemptNumber: 0,
  waveNumber: 0,
  runStartedAt: 0,
  // Nothing is in progress before the first run, so nothing can be abandoned.
  runInProgress: false,
  abandoned: false,
  idleTimer: null,
  hiddenTimer: null,
  started: false
};

/**
 * Sets the session up and starts listening for the player leaving. Called once,
 * from main.js, before the game exists.
 */
export function initAnalytics() {
  if (state.started) {
    return;
  }

  state.started = true;

  const existing = readStored(SESSION_KEY);

  state.sessionId = existing ?? createId();
  state.attemptNumber = Number(readStored(ATTEMPT_KEY)) || 0;

  if (!existing) {
    writeStored(SESSION_KEY, state.sessionId);
  }

  watchForDeparture();

  // Registered before the first event, since sending one is what makes
  // GrowthBook evaluate the feature and so report the exposure.
  setExposureHandler((exposure) => track('experiment_viewed', exposure));

  // A reload is the same session carrying on, so it is not announced twice.
  if (!existing) {
    track('session_started', {
      referrer: referrer(),
      device_type: deviceType(),
      ...campaign()
    });
  }
}

/**
 * A run has begun, either the first of the session or a restart. The run id is
 * fresh every time and the attempt count carries on across the session, which
 * together are how replay after losing gets measured.
 */
export function trackGameStarted() {
  state.runId = createId();
  state.attemptNumber += 1;
  state.waveNumber = 1;
  state.runStartedAt = clock();
  state.runInProgress = true;
  state.abandoned = false;

  writeStored(ATTEMPT_KEY, String(state.attemptNumber));
  clearHiddenTimer();
  resetIdleTimer();

  track('game_started', {
    run_id: state.runId,
    attempt_number: state.attemptNumber
  });
}

/**
 * Moves the global wave number on. Called when a wave starts and also when the
 * pause before one starts, so a tower bought during the pause is attributed to
 * the wave it was bought for rather than the wave that has just finished.
 */
export function setWaveNumber(waveNumber) {
  state.waveNumber = waveNumber;
}

/**
 * The run the player has just finished, so a score can be tied to it and the
 * same run cannot be submitted to the leaderboard twice.
 */
export function getRunId() {
  return state.runId;
}

export function trackWaveStarted({ waveNumber, livesRemaining, currency }) {
  setWaveNumber(waveNumber);

  track('wave_started', {
    wave_number: waveNumber,
    lives_remaining: livesRemaining,
    currency
  });
}

export function trackWaveCompleted({
  waveNumber,
  durationMs,
  livesLost,
  towersOnBoard
}) {
  track('wave_completed', {
    wave_number: waveNumber,
    duration_ms: Math.round(durationMs),
    lives_lost: livesLost,
    towers_on_board: towersOnBoard
  });
}

export function trackTowerPlaced({ towerType, currencyBefore, gridX, gridY }) {
  track('tower_placed', {
    tower_type: towerType,
    wave_number: state.waveNumber,
    currency_before: currencyBefore,
    grid_x: gridX,
    grid_y: gridY
  });
}

export function trackApplicantLeaked(applicantType) {
  track('applicant_leaked', {
    applicant_type: applicantType,
    wave_number: state.waveNumber
  });
}

/**
 * The run has ended properly, one way or the other. Nothing can be abandoned
 * after this, so the idle timer comes off.
 */
export function trackGameOver({ finalWave, score }) {
  const runDurationMs = clock() - state.runStartedAt;

  state.runInProgress = false;
  clearIdleTimer();
  clearHiddenTimer();

  track('game_over', {
    final_wave: finalWave,
    score,
    run_duration_ms: Math.round(runDurationMs)
  });
}

/**
 * The player has ended a run themselves, from the pause screen, rather than
 * playing it out or wandering off. `reason` is `restart` if they went straight
 * into another run and `quit` if they went back to the front page.
 *
 * It is `run_abandoned` rather than a fourteenth event because that is exactly
 * what it is: a run that ended without a `game_over`, which without this would
 * leave a run in the data with no ending at all. The two new reasons sit
 * alongside `unload`, `hidden` and `idle`, and the early abandonment metric
 * already filters on reason, so nothing that was being measured moves.
 */
export function trackRunQuit(reason) {
  abandonRun(reason);
}

export function trackRestartClicked({ fromWave, previousScore }) {
  track('restart_clicked', {
    from_wave: fromWave,
    previous_score: previousScore
  });
}

/**
 * The three below belong to steps that have not happened yet: the leaderboard
 * at step 10 and the Ko-fi link that goes with it. They are here because the
 * spec is one list and splitting it across files would make it harder to check
 * against. Nothing calls them yet.
 */
export function trackScoreSubmitted({ score, finalWave }) {
  track('score_submitted', { score, final_wave: finalWave });
}

export function trackLeaderboardViewed(fromScreen) {
  track('leaderboard_viewed', { from_screen: fromScreen });
}

export function trackKofiClicked({ fromScreen, finalWave }) {
  track('kofi_clicked', { from_screen: fromScreen, final_wave: finalWave });
}

/**
 * The player has gone: the page is closing, the tab has been hidden and stayed
 * hidden, nothing has been touched for a minute, or they have ended the run
 * from the pause screen. It fires once per run at most, and only while a run is
 * actually in progress.
 *
 * `reason` is not in the original spec and is here because the first real run
 * through the collector produced a `run_abandoned` at wave five from a player
 * who went on to reach wave eight. Firing the moment the tab was hidden meant
 * the event recorded the first time somebody glanced away, and since it fires
 * once per run, their actual exit was then never recorded at all. That makes it
 * useless for the question it exists to answer, which is where players quit.
 *
 * It is still lossy, and always will be. A tab closed from a background window
 * may never run any of this. That much is stated in the write-up rather than
 * papered over.
 */
function abandonRun(reason) {
  if (!state.runInProgress || state.abandoned) {
    return;
  }

  state.abandoned = true;
  clearIdleTimer();
  clearHiddenTimer();

  track('run_abandoned', {
    final_wave: state.waveNumber,
    run_duration_ms: Math.round(clock() - state.runStartedAt),
    reason
  });
}

function watchForDeparture() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Not abandoned yet. Somebody checking another tab for a moment is not
      // somebody who has left, so the clock starts and is cancelled if they
      // come back.
      startHiddenTimer();

      return;
    }

    clearHiddenTimer();
    resetIdleTimer();
  });

  // No grace period here. The page is going whether we like it or not, and
  // sendBeacon is the only thing with a chance of delivering.
  window.addEventListener('beforeunload', () => abandonRun('unload'));

  INPUT_EVENTS.forEach((name) =>
    window.addEventListener(name, resetIdleTimer, { passive: true })
  );
}

function startHiddenTimer() {
  clearHiddenTimer();

  if (!state.runInProgress || state.abandoned) {
    return;
  }

  // The idle clock is meaningless while the tab is in the background, since
  // there is no input to be had, so it comes off until they return.
  clearIdleTimer();

  state.hiddenTimer = window.setTimeout(
    () => abandonRun('hidden'),
    HIDDEN_GRACE_MS
  );
}

function clearHiddenTimer() {
  if (state.hiddenTimer === null) {
    return;
  }

  window.clearTimeout(state.hiddenTimer);
  state.hiddenTimer = null;
}

function resetIdleTimer() {
  clearIdleTimer();

  if (!state.runInProgress || state.abandoned) {
    return;
  }

  state.idleTimer = window.setTimeout(() => abandonRun('idle'), IDLE_MS);
}

function clearIdleTimer() {
  if (state.idleTimer === null) {
    return;
  }

  window.clearTimeout(state.idleTimer);
  state.idleTimer = null;
}

/**
 * The seven properties that go on everything. Event properties are merged over
 * these, so where the spec asks for `wave_number` in both places the two say
 * the same thing.
 *
 * `mode` on an event sent before a run has begun is whichever mode is currently
 * chosen, which for a first visit is the classic one. That is the honest answer
 * for `session_started`: nothing has been played yet, so the field records the
 * setting rather than a decision the player has not made.
 */
function globalProperties() {
  return {
    session_id: state.sessionId,
    run_id: state.runId,
    wave_number: state.waveNumber,
    variant_assignments: getVariantAssignments(),
    device_type: deviceType(),
    referrer: referrer(),
    mode: currentModeKey()
  };
}

function track(name, properties = {}) {
  const event = {
    event: name,
    sent_at: new Date().toISOString(),
    properties: { ...globalProperties(), ...properties }
  };

  record(event);
  send(event);
}

/**
 * Kept where the browser console can reach it, capped so a long session does
 * not grow without limit. This is the whole verification story until a store
 * is chosen.
 */
function record(event) {
  events.push(event);

  if (events.length > LOG_LIMIT) {
    events.shift();
  }

  if (VERBOSE) {
    console.info('[analytics]', event.event, event.properties);
  }

  window.requisita = window.requisita ?? {};
  window.requisita.events = events;
}

/**
 * Posted with sendBeacon where it exists, since it is the only way an event
 * fired on the page closing has a chance of arriving. Failures are swallowed:
 * an analytics call is never allowed to break a run.
 */
function send(event) {
  if (!ENDPOINT) {
    return;
  }

  const body = JSON.stringify(event);

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: 'application/json' })
      );

      return;
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Nothing useful to do about it, and nothing that should stop the game.
  }
}

function referrer() {
  return document.referrer || 'direct';
}

/**
 * Whichever campaign parameters are actually present, truncated. A direct
 * visit adds nothing at all rather than five nulls.
 */
function campaign() {
  const params = new URLSearchParams(window.location.search);
  const found = {};

  UTM_KEYS.forEach((key) => {
    const value = params.get(key);

    if (value) {
      found[key] = value.slice(0, 100);
    }
  });

  return found;
}

/**
 * Coarse enough to answer the only question anybody will ask of it, which is
 * whether the desktop-first decision was the right one.
 */
function deviceType() {
  const agent = navigator.userAgent;

  if (/iPad|Tablet|PlayBook|Silk/i.test(agent)) {
    return 'tablet';
  }

  if (/Mobi|Android|iPhone|iPod|Opera Mini|IEMobile/i.test(agent)) {
    return 'mobile';
  }

  return 'desktop';
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clock() {
  return window.performance?.now?.() ?? Date.now();
}

/**
 * Storage is not always there. Private browsing modes and blocked third party
 * storage both throw on access, and neither is a reason to stop the game, so a
 * session that cannot be stored is simply a session that does not survive a
 * reload.
 */
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
    // Nothing to do. The in-memory value carries the rest of this page load.
  }
}

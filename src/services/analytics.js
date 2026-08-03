/**
 * Analytics.
 *
 * The instrumentation is as much the point of this project as the game is, so
 * the event names and their properties are the ones in the spec and nothing
 * else. Everything the game records goes through one of the named functions
 * below rather than through `track` directly, which means this file is the
 * whole list of what gets emitted and there is nowhere else to look.
 *
 * Six global properties go on every event without exception. They are gathered
 * per event rather than frozen at boot, since the wave and the run change under
 * them and the experiment assignment will be asynchronous once GrowthBook
 * arrives at step 11.
 *
 * Where the events are posted is set by `VITE_ANALYTICS_ENDPOINT` at build
 * time. With no endpoint set, nothing is posted and everything still runs:
 * events are kept on `window.requisita.events` and, with `?analytics` in the
 * query string, printed to the console. That is how a deploy preview gets
 * checked before any store exists.
 */
import { getVariantAssignments } from './experiments.js';

/** Sixty seconds of nothing at all counts as the player having wandered off. */
const IDLE_MS = 60000;

/** How many events are kept on `window` for looking at. Enough for a run. */
const LOG_LIMIT = 200;

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

  // A reload is the same session carrying on, so it is not announced twice.
  if (!existing) {
    track('session_started', {
      referrer: referrer(),
      device_type: deviceType()
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

  track('game_over', {
    final_wave: finalWave,
    score,
    run_duration_ms: Math.round(runDurationMs)
  });
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
 * The player has gone: the tab is hidden, the page is closing, or nothing has
 * been touched for a minute. It fires once per run at most, and only while a
 * run is actually in progress.
 *
 * This will be lossy. A tab closed from a background window may never run any
 * of it, and a player who sits and watches a long wave without touching
 * anything is counted as having left. Both are stated in the write-up rather
 * than papered over.
 */
function abandonRun() {
  if (!state.runInProgress || state.abandoned) {
    return;
  }

  state.abandoned = true;
  clearIdleTimer();

  track('run_abandoned', {
    final_wave: state.waveNumber,
    run_duration_ms: Math.round(clock() - state.runStartedAt)
  });
}

function watchForDeparture() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      abandonRun();
    }
  });

  window.addEventListener('beforeunload', abandonRun);

  INPUT_EVENTS.forEach((name) =>
    window.addEventListener(name, resetIdleTimer, { passive: true })
  );
}

function resetIdleTimer() {
  clearIdleTimer();

  if (!state.runInProgress || state.abandoned) {
    return;
  }

  state.idleTimer = window.setTimeout(abandonRun, IDLE_MS);
}

function clearIdleTimer() {
  if (state.idleTimer === null) {
    return;
  }

  window.clearTimeout(state.idleTimer);
  state.idleTimer = null;
}

/**
 * The six properties that go on everything. Event properties are merged over
 * these, so where the spec asks for `wave_number` in both places the two say
 * the same thing.
 */
function globalProperties() {
  return {
    session_id: state.sessionId,
    run_id: state.runId,
    wave_number: state.waveNumber,
    variant_assignments: getVariantAssignments(),
    device_type: deviceType(),
    referrer: referrer()
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

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
 * The fourteenth is `feedback_given`, and it is the only one of them that is
 * something the player says rather than something they did. It is emitted from
 * `services/feedback.js` rather than from the scene that draws the question,
 * since asking once a session and recording the answer are the same piece of
 * bookkeeping and splitting them across two call sites is how they drift.
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
 * How often input is allowed to reset the idle clock.
 *
 * `pointermove` is on the list above, and on a tower defence the pointer is
 * moving more or less constantly, so every frame was tearing down a timer and
 * building another one to say the same thing. A second of granularity against a
 * minute of idle is a fortieth of a percent of the threshold and cannot change
 * the answer.
 */
const INPUT_GAP_MS = 1000;

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

/** When input last reset the idle clock, for the throttle above. */
let lastInputAt = 0;

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

  // Set by a mode that takes no input during play, so the idle clock never
  // starts. See stopWatchingForIdle below.
  idleDisabled: false,
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
/**
 * `bulkRejectsUsed` and `holdsUsed` are the phone board's two in-run decisions
 * and are absent everywhere else, since the other three boards have no such
 * thing to spend. They are properties on an event that already fires rather than
 * a sixteenth event, which is the seam `mode` went through: how many of a run's
 * charges were spent is a fact about the run, not a thing that happens.
 *
 * The second one arrived with the second superweapon and needs the first one
 * beside it to say anything. A count of bulk rejects on its own answers whether
 * a button gets pressed; the pair answers which of two buttons sat next to each
 * other gets pressed, and a run that spends three of one and none of the other
 * is the finding question 4 is actually after.
 *
 * Left off the bag entirely rather than sent as nulls on the boards that have
 * none. A column of nulls says the same as an absent key and costs three
 * quarters of the rows to say it.
 */
export function trackGameOver({ finalWave, score, bulkRejectsUsed, holdsUsed }) {
  const runDurationMs = clock() - state.runStartedAt;

  state.runInProgress = false;
  clearIdleTimer();
  clearHiddenTimer();

  track('game_over', {
    final_wave: finalWave,
    score,
    run_duration_ms: Math.round(runDurationMs),
    ...(bulkRejectsUsed === undefined
      ? {}
      : { bulk_rejects_used: bulkRejectsUsed }),
    ...(holdsUsed === undefined ? {} : { holds_used: holdsUsed })
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
 * The three below are the leaderboard's and the Ko-fi link's, from steps 10 and
 * after. They were written before either existed, because the spec is one list
 * and splitting it across files would make it harder to check against, and the
 * comment here said so. All three have call sites now, in both game over screens
 * and in the shared leaderboard panel.
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
 * The player's answer to the one question the game asks.
 *
 * The fourteenth event, and the bar for a fourteenth is a question that none of
 * the other thirteen can answer. This one sits inside question two, whether the
 * difficulty curve is right. The events already say which intake a run ended
 * on. Nothing in them separates a player who was outplayed at intake five from
 * a player who reached intake five without ever working out what was happening,
 * and those two need opposite fixes: one is tuning and the other is legibility.
 *
 * It is an event rather than a property because it is a thing that happens, and
 * it happens seconds after `game_over` has already gone. That is the same seam
 * `mode` went through in the other direction.
 *
 * It needs no migration, which is most of why the question is a closed set
 * rather than a box to type in. Everything it wants is either a global that is
 * already a column or a field the property bag already keeps.
 */
/**
 * The fifteenth event, and the phone board's only player decision.
 *
 * It is here rather than folded into `tower_placed` because the two are not the
 * same fact. `tower_placed` records what was taken and has no slot for what was
 * declined, because on the desktop board everything is always on offer. A two of
 * N draw makes question 4, which cards are dead weight, answerable only as take
 * rate against offer rate: a card rarely taken may simply be rarely offered, and
 * nothing in the fourteen can express a card being offered and refused.
 *
 * That is the `experiment_viewed` shape of argument rather than the
 * `feedback_given` one. It records something that cannot be recovered any other
 * way rather than something a player said.
 *
 * **`track` rather than `send`, and it was `send` for four releases.** The two
 * take different arguments: `track` takes a name and the event's own properties,
 * builds the envelope, attaches the seven globals and hands the result to
 * `send`, which takes that one built object. Called with a name, `send` posted
 * the string, dropped the properties and had the collector refuse a body with no
 * event on it. The fifteenth event recorded nothing at all from the day it
 * landed until a phone was checked against the store.
 *
 * What made it invisible is that `record` lives in `track` too, so the event
 * never reached `window.requisita.events` either, and the in-browser log that
 * every other event can be checked against showed the same nothing the database
 * did. There is no test here to add against that. What there is instead is that
 * every one of the fifteen goes through `track`, which is now true.
 */
export function trackUpgradeOffered({ taken, refused }) {
  track('upgrade_offered', { taken, refused });
}

/**
 * The sixteenth, seventeenth and eighteenth, and the only three added at once.
 *
 * The bar for another event has been the same every time: a question in the spec
 * that none of the existing ones can answer. These clear it on question 4, which
 * asks which things are dead weight, and they clear it as a set rather than
 * separately, which is why they arrive together.
 *
 * A contract is not an arrival and is deliberately not reported as one.
 * `applicant_leaked` means the vacancy lost a life, every read of it in `docs/`
 * counts it that way, and a type that cannot cost a life would quietly make that
 * column mean two things. Nothing leaked.
 *
 * Nor is it a `tower_placed` or a `game_over` property. What has to be
 * recoverable is not whether a contractor turned up, which the wave list would
 * say if it were on one, but what happened after it did: how long it stayed, how
 * far the rate got, and how much budget went with it. Three of those are facts
 * about an engagement rather than about a run, a run can have several, and a
 * property on `game_over` can only hold one number per run.
 *
 * The three of them are one story told in order, and each is the half of it the
 * others cannot say. `contract_started` is the arrival, and on its own it counts
 * how often the desk is reached. `contract_renewed` is the middle, and on its own
 * it says whether players deal with one at all or wait it out. `contract_ended`
 * is the outcome and the money, and it is the only one that can be joined to a
 * budget. A single event at the end would lose every engagement a run that was
 * abandoned mid contract was carrying, which is the run most worth reading.
 *
 * `end_reason` is `rejected` when the player dealt with it and `expired` when it
 * served its renewals and left. Those are opposite findings about the same
 * feature and no other field separates them.
 */
export function trackContractStarted({ dayRate, spawnWave }) {
  track('contract_started', {
    day_rate: dayRate,
    spawn_wave: spawnWave
  });
}

export function trackContractRenewed({ renewalNumber, dayRate }) {
  track('contract_renewed', {
    renewal_number: renewalNumber,
    day_rate: dayRate
  });
}

export function trackContractEnded({
  endReason,
  renewals,
  currencyDrained,
  durationMs
}) {
  track('contract_ended', {
    end_reason: endReason,
    renewals,
    currency_drained: currencyDrained,
    duration_ms: Math.round(durationMs)
  });
}

export function trackFeedbackGiven({ question, answer, finalWave }) {
  track('feedback_given', {
    question,
    answer,
    final_wave: finalWave
  });
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
    window.addEventListener(name, noteInput, { passive: true })
  );
}

/**
 * Input arriving, throttled. The throttle is here rather than inside
 * resetIdleTimer because the other two callers, a run starting and a tab coming
 * back, have to take effect the moment they happen.
 */
function noteInput() {
  const now = Date.now();

  if (now - lastInputAt < INPUT_GAP_MS) {
    return;
  }

  lastInputAt = now;

  resetIdleTimer();
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

/**
 * Turns the idle clock off for a mode that has no input to be idle from.
 *
 * The phone board takes nothing from the player during an intake. That is the
 * design rather than an oversight, and it breaks the assumption underneath
 * `idle`: sixty seconds without a pointer event means somebody has wandered off
 * only on a board where staying means doing something. Here an attentive player
 * watching a long intake is indistinguishable from an empty chair, and since the
 * event fires once per run, recording it means their real exit is never
 * recorded at all.
 *
 * That is exactly the failure the `reason` property was added to fix, arriving
 * again through a different door.
 *
 * The other four reasons are untouched and cover it. On a phone, leaving means
 * backgrounding the app, which `hidden` catches, and `unload`, `restart` and
 * `quit` are all still there.
 */
export function stopWatchingForIdle() {
  state.idleDisabled = true;
  clearIdleTimer();
}

function resetIdleTimer() {
  clearIdleTimer();

  if (!state.runInProgress || state.abandoned || state.idleDisabled) {
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

  // Nothing goes anywhere until a session has been opened.
  //
  // This used to be true by accident rather than by rule: every caller was a
  // scene that only ran after initAnalytics had, so the question never came up.
  // The phone board broke that. It is reachable on `?shape=phone`, which
  // deliberately opens no session, and it emits events from its own loop, so it
  // was posting bodies with no session id on them. The collector refuses those,
  // so nothing was stored, but "refused at the far end" is not the same promise
  // as "not sent", and the one written down everywhere is the second.
  if (!state.started) {
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
 *
 * The `Macintosh` clause is the one part of this that is not a guess about a
 * string. Since iPadOS 13 an iPad in Safari says it is a Mac by default, and it
 * matches nothing below, so every one of them was being filed as a desktop. That
 * is the reading this function exists to get right: tablets are the class that
 * was refused at launch and let in afterwards, and the property was quietly
 * under-counting the traffic that decision has to be judged on. A desktop
 * browser has no touch points, so the pair of them separates the two without
 * asking the agent string anything it will lie about.
 */
function deviceType() {
  const agent = navigator.userAgent;

  if (/iPad|Tablet|PlayBook|Silk/i.test(agent)) {
    return 'tablet';
  }

  if (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1) {
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

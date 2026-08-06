/**
 * Leaderboard client.
 *
 * Both calls go to a Netlify function on this site's own origin, never to
 * Supabase. The browser holds no database key of any kind, which means there
 * is nothing in the bundle worth extracting and the limit of ten is enforced
 * somewhere the player cannot reach.
 *
 * Nothing here throws. A leaderboard that is down is a line of text on the
 * game over screen, not a broken game, so every path returns a result the
 * scene can render.
 */
const BASE = '/.netlify/functions';

/** Long enough for a cold function, short enough not to look hung. */
const TIMEOUT_MS = 8000;

async function call(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE}/${path}`, {
      ...options,
      signal: controller.signal
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: body.error ?? 'something went wrong' };
    }

    return { ok: true, body };
  } catch {
    return { ok: false, error: 'could not reach the board' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The top ten for one mode, best first. An empty list is a valid answer and
 * means nobody has submitted to that board yet.
 *
 * The mode goes on the query string rather than there being two endpoints,
 * because it is the same question asked of a different set of runs. The server
 * checks it against the mode list either way, so a hand edited parameter gets
 * an error rather than a board.
 *
 * The list has to actually be a list. A 200 carrying something else is not an
 * empty board, it is something other than the function answering, and the two
 * want saying differently: one is a fact about the game, the other is a fault.
 */
export async function fetchTopTen(mode) {
  const result = await call(`leaderboard?mode=${encodeURIComponent(mode)}`);

  if (!result.ok) {
    return result;
  }

  if (!Array.isArray(result.body.entries)) {
    return { ok: false, error: 'the board sent back something unreadable' };
  }

  return { ok: true, entries: result.body.entries };
}

/**
 * Sends one score to the board for the mode it was played in. The server
 * decides whether it is plausible, whether the name will do and whether this
 * run has been submitted before, so the reason for a refusal comes back from
 * there rather than being guessed at here.
 *
 * The mode is part of what makes a score plausible rather than just a label on
 * it: the two modes send different numbers of applicants, so the ceiling a
 * submission is checked against is worked out from the wave list for the mode
 * claimed.
 */
export async function submitScore({ name, score, finalWave, runId, mode }) {
  return call('submit-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score, finalWave, runId, mode })
  });
}

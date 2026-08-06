/**
 * The top ten for one mode, read server side.
 *
 * The browser never talks to Supabase, so the limit of ten is enforced
 * somewhere the player cannot change it.
 *
 * There is one query parameter now, and only one. It says which board, because
 * there are two of them and they are not comparable, and it is checked against
 * the mode list rather than passed through, so the endpoint still answers
 * exactly one question and cannot be talked into answering a different one.
 */
import { MODES, DEFAULT_MODE } from '../../src/config/modes.js';
import { isConfigured, select } from './lib/supabase.js';

const TOP_N = 10;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405);
  }

  if (!isConfigured()) {
    // An honest 503 rather than a stack trace. A deploy preview without the
    // environment variables set should say the board is unavailable, not look
    // like the game is broken.
    return json({ error: 'leaderboard is not configured' }, 503);
  }

  // An unknown mode is refused rather than quietly served the classic board,
  // because a board that answers the wrong question convincingly is worse than
  // one that says it cannot.
  const mode = new URL(request.url).searchParams.get('mode') ?? DEFAULT_MODE;

  if (!MODES[mode]) {
    return json({ error: 'that is not a mode of this game' }, 400);
  }

  try {
    const entries = await select(
      'leaderboard',
      [
        'select=display_name,score,final_wave,submitted_at',
        `mode=eq.${encodeURIComponent(mode)}`,
        'order=score.desc,submitted_at.asc',
        `limit=${TOP_N}`
      ].join('&')
    );

    return json(
      { entries },
      200,
      // Short enough that a new score shows up while somebody is still looking
      // at the screen, long enough to absorb a burst of restarts.
      { 'Cache-Control': 'public, max-age=15' }
    );
  } catch (error) {
    console.error('leaderboard read failed', error);

    return json({ error: 'leaderboard is unavailable' }, 502);
  }
};

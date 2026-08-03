/**
 * The top ten, read server side.
 *
 * The browser never talks to Supabase, so the limit of ten is enforced
 * somewhere the player cannot change it. There is no query string on this
 * endpoint for the same reason: there is exactly one question it answers.
 */
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

  try {
    const entries = await select(
      'leaderboard',
      [
        'select=display_name,score,final_wave,submitted_at',
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

/**
 * Score submission.
 *
 * Assume it will be attacked, because a leaderboard on a public game always is
 * and because the score is worked out in the browser. Nothing here makes a
 * client-scored game trustworthy. What it does is make forging tedious and
 * cheap to clean up:
 *
 * - the score has to be possible for the wave claimed in the mode claimed,
 *   checked against the same wave data the game plays from
 * - the name has to pass a character set, a length cap and a word list
 * - a run can only be submitted once
 * - an address gets a handful of submissions per quarter of an hour
 *
 * A Netlify function rather than a Supabase edge function, because it lives in
 * this repo, deploys with the site, and is covered by the deploy preview that
 * every change already has to pass. A second deployment target would need its
 * own secrets, its own preview story and its own reason to exist.
 */
import { addressFrom, hashAddress } from './lib/address.js';
import { checkName } from './lib/names.js';
import { checkScore } from './lib/plausibility.js';
import { insert, isConfigured, select } from './lib/supabase.js';

/** Enough for a player having a bad evening, not enough for a script. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MINUTES = 15;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

async function isOverRateLimit(ipHash) {
  const since = new Date(
    Date.now() - RATE_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const recent = await select(
    'leaderboard',
    [
      'select=id',
      `ip_hash=eq.${ipHash}`,
      `submitted_at=gte.${since}`,
      `limit=${RATE_LIMIT}`
    ].join('&')
  );

  return recent.length >= RATE_LIMIT;
}

export default async (request, context) => {
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  if (!isConfigured()) {
    return json({ error: 'leaderboard is not configured' }, 503);
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }

  const { name, error: nameError } = checkName(payload?.name);

  if (nameError) {
    return json({ error: nameError }, 400);
  }

  const score = payload?.score;
  const finalWave = payload?.finalWave;
  const runId = payload?.runId;
  const mode = payload?.mode;

  // The mode is checked in here along with the score, because which board a
  // submission goes on and what the largest honest score for it is are the same
  // question asked twice.
  const scoreError = checkScore({ score, finalWave, mode });

  if (scoreError) {
    return json({ error: scoreError }, 400);
  }

  if (typeof runId !== 'string' || runId.length === 0 || runId.length > 64) {
    return json({ error: 'run is not identified' }, 400);
  }

  const ipHash = hashAddress(addressFrom(request, context));

  try {
    if (await isOverRateLimit(ipHash)) {
      return json({ error: 'too many submissions, try again shortly' }, 429);
    }

    await insert('leaderboard', {
      display_name: name,
      score,
      final_wave: finalWave,
      run_id: runId,
      mode,
      ip_hash: ipHash
    });
  } catch (error) {
    // 23505 is a unique violation, which here can only be the run id.
    if (error.body?.includes('23505')) {
      return json({ error: 'that run has already been submitted' }, 409);
    }

    console.error('score submission failed', error);

    return json({ error: 'could not record that score' }, 502);
  }

  return json({ name, score });
};

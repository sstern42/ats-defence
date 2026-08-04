/**
 * Analytics collection.
 *
 * One event per request, which is what the game already sends and what
 * sendBeacon can deliver from a page that is closing. That last part is the
 * reason not to batch: `run_abandoned` fires on the way out, and a batch
 * waiting for a flush that never comes is a batch that is never sent.
 *
 * The endpoint is public and unauthenticated because the events come from a
 * browser holding no key. What protects it is narrowness rather than secrecy:
 * a fixed list of twelve event names, a size cap, and a rate limit per address.
 * None of that makes it unspammable. It makes spamming it tedious and cheap to
 * clean up, which is the same bargain as the leaderboard.
 */
import { addressFrom, hashAddress } from './lib/address.js';
import { classifyAgent } from './lib/agent.js';
import { checkEvent } from './lib/events.js';
import { insert, isConfigured, select } from './lib/supabase.js';

/**
 * A run sends about a dozen events over several minutes, so this is roughly
 * twenty runs a quarter of an hour from one address. Generous for a person,
 * including a household behind one address, and dull for a script.
 */
const RATE_LIMIT = 250;
const RATE_WINDOW_MINUTES = 15;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

/**
 * The caller's country, from the platform's own geo lookup rather than from
 * anything the browser claims. Country and no finer: it answers "did this
 * reach anybody outside my own network" and stops there.
 *
 * Missing or malformed is null rather than an error. A row without a country
 * is still worth having.
 */
function countryOf(context) {
  const code = context?.geo?.country?.code;

  return typeof code === 'string' && /^[A-Z]{2}$/.test(code) ? code : null;
}

async function isOverRateLimit(ipHash) {
  const since = new Date(
    Date.now() - RATE_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const recent = await select(
    'analytics_events',
    [
      'select=id',
      `ip_hash=eq.${ipHash}`,
      `received_at=gte.${since}`,
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
    // Quietly accepted rather than an error. A preview without the environment
    // variables set should not fill the console with failures on every event,
    // and the game ignores the response either way.
    return json({ accepted: false }, 202);
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }

  const { row, error } = checkEvent(payload);

  if (error) {
    return json({ error }, 400);
  }

  const ipHash = hashAddress(addressFrom(request, context));

  try {
    if (await isOverRateLimit(ipHash)) {
      return json({ error: 'too many events' }, 429);
    }

    await insert('analytics_events', {
      ...row,
      ip_hash: ipHash,
      country: countryOf(context),
      // Read here and thrown away. The header never reaches the database.
      ...classifyAgent(request.headers.get('user-agent'))
    });
  } catch (failure) {
    console.error('event collection failed', failure);

    return json({ error: 'could not record that event' }, 502);
  }

  return json({ accepted: true });
};

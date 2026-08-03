/**
 * A thin wrapper over the Supabase Data API.
 *
 * There is no client library here on purpose. Everything below is `fetch`
 * against PostgREST, which is roughly forty lines and saves a dependency that
 * would only be doing the same thing. Node 22 has `fetch` built in, and the
 * Node version is pinned in netlify.toml.
 *
 * The service role key never leaves this process. It is read from the Netlify
 * environment, is not prefixed with VITE_, and so cannot end up in the client
 * bundle.
 *
 * The environment is read per call rather than once at import. It costs
 * nothing, and it means this module does not care whether it was loaded before
 * or after the environment was populated.
 */
function config() {
  return {
    baseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function isConfigured() {
  const { baseUrl, serviceKey } = config();

  return Boolean(baseUrl && serviceKey);
}

async function request(path, options = {}) {
  const { baseUrl, serviceKey } = config();

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(`supabase ${response.status}: ${text}`);

    error.status = response.status;
    // PostgREST puts the constraint name in here, which is how a duplicate run
    // is told apart from the database simply being unhappy.
    error.body = text;

    throw error;
  }

  return text ? JSON.parse(text) : null;
}

export function select(table, query) {
  return request(`${table}?${query}`);
}

export function insert(table, row, { returning = 'minimal' } = {}) {
  return request(table, {
    method: 'POST',
    headers: { Prefer: `return=${returning}` },
    body: JSON.stringify(row)
  });
}

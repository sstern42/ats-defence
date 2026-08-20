/**
 * The service worker, which is the half of being installable that does the
 * work. The manifest gets the game onto a home screen; this is what happens
 * when somebody opens it from there with no signal.
 *
 * It is hand written and it is about eighty lines, on the same terms as every
 * other tool in this repo: a plugin would generate a precache manifest, pull in
 * a dependency and a build step, and buy one thing this does not have, which is
 * an asset cached before it has ever been asked for. Everything else it would
 * do is below.
 *
 * Not built by Vite, so nothing here is transformed and there is no import.
 * It sits in public and is served from the root, which is what gives it the
 * whole site as its scope.
 *
 * Three rules and no more:
 *
 * 1. The functions are never touched. Analytics, the leaderboard and the health
 *    check are the four things on this site that are about right now, and a
 *    cached leaderboard is a wrong leaderboard.
 * 2. A navigation goes to the network first and falls back to the copy held
 *    here. So a deploy is picked up the moment somebody opens the game online,
 *    and the game still opens when they are not.
 * 3. Everything else same origin is served from the cache if it is there. The
 *    bundle is content hashed, so those names never mean two things. The assets
 *    in public are not, but the cache is named for the version, and the release
 *    rules in CLAUDE.md say anything reaching a player moves the version, so a
 *    changed sound or texture arrives with a cache of its own.
 */

/**
 * The version this worker was registered with, off its own query string.
 *
 * The registration is `/sw.js?v=1.8.0`, which does two things at once. The bytes
 * of the request change on a release, so the browser sees a new worker and
 * installs it, and the version is available in here without this file being
 * part of the build. package.json stays the only place the number is written.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') ?? 'dev';

const CACHE = `ats-defence-${VERSION}`;

/** The functions, which are never cached and never served from here. */
const FUNCTIONS = '/.netlify/';

/**
 * The one key a navigation is stored under.
 *
 * Every route into the game is the same document with a different query string
 * on it, since `?shape=`, `?difficulty=` and `?bench` are all read by the game
 * rather than by the server. Storing them separately would fill the cache with
 * copies of one file and still miss on the next parameter somebody arrives
 * with, so they all resolve to this.
 */
const DOCUMENT = '/';

/**
 * The document is fetched at install, so the first visit is enough to make the
 * game openable offline. Nothing else is listed: the bundle is hashed and this
 * file cannot know the names, and the assets arrive as the game asks for them.
 *
 * A failure here is swallowed rather than failing the install. An install that
 * fails leaves the site with no worker at all, which is a worse outcome than a
 * worker whose cache starts empty and fills as the game is played.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(DOCUMENT))
      .catch(() => {})
  );
});

/**
 * The caches of older versions go here, and only once this worker is the one in
 * charge.
 *
 * There is deliberately no skipWaiting. A new worker waits for every tab on the
 * game to close before it takes over, which means a run in progress keeps the
 * caches and the code it started with, and an update lands on the next launch.
 * Swapping under a live run buys a few minutes and risks a half updated game.
 *
 * The claim is for the first install only, where there is no worker to wait for
 * and the page that registered this one is otherwise uncontrolled until it is
 * reloaded.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('ats-defence-') && name !== CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Every lookup below opens this version's cache by name rather than asking
 * `caches.match` to search all of them. Older caches are gone by the time a
 * fetch reaches this worker, but a match across every cache on the origin is
 * not the question being asked, and writing the question down is cheaper than
 * relying on the order two lifecycle events happen in.
 */
async function cacheDocument(request) {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(DOCUMENT, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(DOCUMENT);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function cacheAsset(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  /* Opaque responses and errors are handed straight back. Only something this
     origin answered properly is worth keeping. */
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  /* Two things on this page are cross origin, and neither belongs in a cache:
     GrowthBook, since an experiment assignment is not something to serve from
     one, and the page analytics script, since a tracker served out of a cache
     is a stale tracker. Both are left to the network, which is also what makes
     them free offline: they fail, and nothing in a run was waiting. */
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith(FUNCTIONS)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(cacheDocument(request));

    return;
  }

  event.respondWith(cacheAsset(request));
});

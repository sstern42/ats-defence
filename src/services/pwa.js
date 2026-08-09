/**
 * Registers the service worker, which is all the game itself has to know about
 * being installable.
 *
 * The other two halves are files rather than code. `public/manifest.webmanifest`
 * says what the installed app is called and what it is drawn with, and
 * `public/sw.js` says what happens when it is opened with no signal. Neither is
 * touched by the build, and this is the only line of the game that mentions
 * either.
 *
 * Nothing here can fail in a way the player sees. A browser without service
 * workers, a registration refused, a worker that throws on install: all of them
 * end at a game that works exactly as it did before, which is the whole bargain
 * of adding this to something that already runs.
 *
 * Two things the manifest deliberately does not say, recorded here because a
 * JSON file has nowhere to say them.
 *
 * It sets no orientation. The obvious value is portrait, since a phone gets the
 * portrait board and there is already a veil over the page when one is turned
 * sideways. It is wrong, because the board a screen gets is decided by its size
 * rather than its type: a tablet in landscape clears the gate and plays the
 * landscape board, and an installed app locked to portrait would have taken
 * that away from it. The gate is the size of the screen and nothing else, and a
 * manifest is not the place to start disagreeing with that.
 *
 * And there is no narrow screenshot next to the wide one, so a phone gets the
 * plain install prompt rather than the richer listing. The wide one is the
 * share card, which is a real screenshot of a real board. There is no way to
 * take one of the phone board from here, and a mocked up screenshot of a game
 * is the sort of thing this repo would rather not ship.
 */
import { VERSION } from '../config/version.js';

export function registerServiceWorker() {
  /**
   * Production only. There is no local dev server anybody here can look at, so
   * this costs nothing in practice, and what it avoids is the one genuinely
   * unpleasant failure mode a service worker has: a cached module hanging
   * around on localhost after the file behind it has changed.
   */
  if (!import.meta.env.PROD) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  /**
   * The version goes on the query string, and the worker reads it back off its
   * own location to name its cache. Two things fall out of that. The request
   * differs on every release, so the browser fetches it, sees different bytes
   * and installs the new worker, which is what it does with any changed worker
   * and what a fixed URL cannot rely on when the file itself has not changed.
   * And the number reaches a file the build never touches without being typed
   * into it, so package.json is still the only place it is written down.
   */
  navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).catch(() => {});
}

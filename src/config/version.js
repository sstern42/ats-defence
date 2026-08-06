/* global __APP_VERSION__ */

/**
 * The version this build was cut from.
 *
 * `__APP_VERSION__` is replaced with a string literal by Vite, from the version
 * in package.json. See vite.config.js. The fallback is for anything that reads
 * this module outside a Vite build, where the literal was never substituted and
 * the name would otherwise throw.
 */
export const VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

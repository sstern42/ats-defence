/**
 * Browser and operating system, from the user agent string.
 *
 * Families only, never versions. "Does it break in Safari" is a question worth
 * answering; "does it break in Safari 17.4.1" is not one this project will ever
 * act on, and a version turns a coarse bucket into something closer to a
 * fingerprint.
 *
 * Hand rolled rather than a parsing library, because the whole job is a dozen
 * ordered tests and the alternative is a dependency that ships a database of
 * user agents to answer a question with six possible answers.
 *
 * The user agent is self reported and trivially forged. Nothing here treats it
 * as authoritative, and nothing depends on it being right.
 */

/**
 * Ordered, because user agents lie by inclusion. Every Chromium browser claims
 * to be Chrome and Safari, Edge claims to be Chrome, and Chrome claims to be
 * Safari, so the most specific test has to run first and win.
 */
const BROWSERS = [
  // Anything that announces itself as automated goes in its own bucket rather
  // than being counted as a player. Preview scrapers mostly do not run
  // JavaScript and so never reach here, but the ones that do would otherwise
  // look exactly like a real visit on launch day.
  [/bot|crawler|spider|crawling|headlesschrome|playwright|puppeteer/i, 'bot'],
  [/Edg[A-Z]?\//i, 'edge'],
  [/OPR\/|Opera/i, 'opera'],
  [/SamsungBrowser/i, 'samsung'],
  [/Firefox\/|FxiOS/i, 'firefox'],
  [/Chrome\/|CriOS/i, 'chrome'],
  [/Safari\//i, 'safari']
];

/**
 * Also ordered. An iPad on iPadOS 13 and later reports itself as a Macintosh,
 * and Android contains the word Linux, so the specific cases come first.
 */
const SYSTEMS = [
  [/iPhone|iPad|iPod|iOS/i, 'ios'],
  [/Android/i, 'android'],
  [/CrOS/i, 'chromeos'],
  [/Windows NT|Windows/i, 'windows'],
  [/Mac OS X|Macintosh/i, 'macos'],
  [/Linux|X11/i, 'linux']
];

function firstMatch(patterns, agent) {
  const found = patterns.find(([pattern]) => pattern.test(agent));

  return found ? found[1] : 'other';
}

/**
 * Returns the browser and system families, or nulls when there is no user
 * agent to read. A missing header is not worth failing an event over.
 */
export function classifyAgent(agent) {
  if (typeof agent !== 'string' || agent.length === 0) {
    return { browser: null, os: null };
  }

  return {
    browser: firstMatch(BROWSERS, agent),
    os: firstMatch(SYSTEMS, agent)
  };
}

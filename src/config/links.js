/**
 * Links out of the game. Plain data, no logic, like everything else in here.
 *
 * The tip jar is on two screens now, so it lives in one place rather than
 * being typed out twice and later corrected once.
 */

/**
 * Named for the person rather than the game, so the same page still makes
 * sense if anything else ever gets one.
 */
export const KOFI_URL = 'https://ko-fi.com/spencer_stern';

/**
 * The site this is a project of. The game has its own subdomain, so without a
 * link out there is nothing on the page saying where it came from.
 */
export const SITE_URL = 'https://spencerstern.com';

/**
 * Where the background music came from. The bundle page rather than the
 * artist's home page, because a credit should land on the thing being credited
 * and somebody following it is looking for the track.
 *
 * The licence does not ask for this. It is CC0, and the file next to the track
 * in public/assets/audio says in as many words that no credit is required. It
 * is here because the track is the only asset in the game somebody else
 * recorded, and a repo that names where its sprites and its sounds came from
 * and stays quiet about the one piece of music has an odd gap in it.
 */
export const MUSIC_CREDIT_URL = 'https://tallbeard.itch.io/music-loop-bundle';

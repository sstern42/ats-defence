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
 *
 * Tagged, and the tags are written into the constant rather than assembled
 * somewhere, because there is one destination on this list worth tagging and
 * one string is the whole of what that needs. `utm_medium` is `game` rather
 * than `referral` because the game is one of several things that will send
 * people to that site and the campaign is what groups them: a post about ATS
 * Defence and a footer link inside it are the same campaign arriving through
 * different media. `utm_source` names the property doing the sending rather
 * than the host, so it stays right if the game ever moves off its subdomain.
 *
 * The game already reads these keys on the way in, in `services/analytics.js`,
 * where they go on `session_started`. So this is the other half of something
 * the project was already doing, and a visit that arrives tagged and leaves
 * tagged is attributable at both ends.
 *
 * The other two links are deliberately bare and neither is an oversight. The
 * music credit points at somebody else's page, and a credit arriving with our
 * campaign parameters on it is writing in their analytics rather than thanking
 * them. The tip jar is ours and reports no campaign back, so a tag there would
 * be decoration on a link somebody is about to follow, and what the game wanted
 * to know about that click is already on `kofi_clicked`, which carries the
 * screen and the wave it came from.
 *
 * There is no `utm_content` on it. The link is in the footer of both home
 * screens and nowhere else, so the key would say `home` on every visit, and a
 * parameter with one value is noise in a report. A second placement is when it
 * earns its place.
 */
export const SITE_URL =
  'https://spencerstern.com/?utm_source=ats-defence&utm_medium=game&utm_campaign=ats-defence';

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

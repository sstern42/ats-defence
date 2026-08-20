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

/**
 * The campaign parameters put on every link out of the game to somewhere this
 * project owns. Plain data, read by `services/links.js`, which is the only
 * file that knows what to do with them.
 *
 * `utm_medium` is `game` rather than `referral` because the game is one of
 * several things that will send people to that site and the campaign is what
 * groups them: a launch post about ATS Defence and a footer link inside it are
 * the same campaign arriving through different media. `utm_source` names the
 * property doing the sending rather than the host, so it stays right if the
 * game ever moves off its subdomain.
 *
 * The game already reads the same five keys on the way in, in
 * `services/analytics.js`, where they go on `session_started`. So the tags
 * below are the other half of a thing this project was already doing, and a
 * visit that arrives here tagged and leaves tagged is attributable at both
 * ends.
 */
export const CAMPAIGN = {
  utm_source: 'ats-defence',
  utm_medium: 'game',
  utm_campaign: 'ats-defence'
};

/**
 * The hosts a link is allowed to be tagged for, which is the whole of the rule
 * about whose reports these parameters may turn up in.
 *
 * Both of these are this project's own. The music credit is not on the list and
 * will not be tagged: it points at somebody else's page, the licence asked for
 * nothing in the first place, and a credit that arrives carrying our campaign
 * parameters is us writing in their analytics rather than thanking them.
 *
 * Matched exactly rather than by suffix. Every destination the game has is in
 * this file, so there is nothing to match loosely for, and a suffix test is how
 * `spencerstern.com.example.net` gets tagged one day.
 */
export const TAGGED_HOSTS = ['spencerstern.com', 'ko-fi.com'];

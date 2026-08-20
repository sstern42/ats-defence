/**
 * Where a link out of the game actually points.
 *
 * There are three destinations and six places that open one, so without this
 * the campaign parameters would be typed out six times and later corrected in
 * four of them. The scenes carry the screen they are on and nothing else.
 *
 * It is a service rather than more constants in `config/links.js` because
 * deciding whether a destination may be tagged is behaviour, and because the
 * tip jar is on two screens: a constant per screen per destination is how a
 * list of three links becomes a list of six.
 */
import { CAMPAIGN, TAGGED_HOSTS } from '../config/links.js';

/**
 * A destination with the campaign on it, or the destination unchanged if it is
 * not ours to tag.
 *
 * `screen` goes on as `utm_content` and is the same string the analytics events
 * carry as `from_screen`, deliberately: the two records of one click are then
 * joinable by eye, and there is one spelling of the screen rather than two.
 *
 * The parameters are set rather than appended, so a destination that already
 * had one keeps a single value, and a link opened twice is the same link.
 *
 * A URL that will not parse is handed back as it came. Everything passed in
 * here is a constant from `config/links.js` and cannot fail, but a footer tap
 * that throws would take the scene with it, which is a poor trade for a query
 * string.
 */
export function outbound(url, screen) {
  let destination;

  try {
    destination = new URL(url);
  } catch (error) {
    return url;
  }

  if (!TAGGED_HOSTS.includes(destination.host)) {
    return url;
  }

  for (const [key, value] of Object.entries(CAMPAIGN)) {
    destination.searchParams.set(key, value);
  }

  if (screen) {
    destination.searchParams.set('utm_content', screen);
  }

  return destination.toString();
}

/**
 * Where a link out of the game actually points.
 *
 * There are three destinations and six places that open one, and exactly one of
 * those destinations may carry a campaign. This is where that is decided, so a
 * scene passes the screen it is on and nothing else and cannot get it wrong.
 *
 * It is a service rather than a tagged constant in `config/links.js` because
 * which destinations may be tagged is a rule rather than a string, and a rule
 * kept as data with one file reading it is the shape the rest of this project
 * is in. It is also the half of the arrangement that will still be right when
 * the second taggable destination turns up.
 */
import { CAMPAIGN, TAGGED_HOSTS } from '../config/links.js';

/**
 * A destination with the campaign on it, or the destination unchanged if it is
 * not ours to tag.
 *
 * `screen` goes on as `utm_content` and is the same string the analytics events
 * carry as `from_screen`, deliberately: the two records of one click are then
 * joinable by eye, and there is one spelling of the screen rather than two.
 * Today both callers are a home screen footer, so it always reads `home`. It is
 * passed rather than assumed because the footer is not the only place a link
 * out could ever go, and a parameter that means nothing until it does is
 * cheaper than one added afterwards to events already written.
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

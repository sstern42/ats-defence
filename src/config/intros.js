/**
 * The applicant introduction manifest. Plain data, the same shape as the sprite
 * and sound manifests, so BootScene does not need to know what any of it is for.
 *
 * Each key is a texture key and also the file name without its extension, which
 * is why the loader can be three lines long. The part after the prefix is the
 * applicant type the animation belongs to, which is how GameScene finds the
 * right one when a type turns up for the first time.
 *
 * The strips are drawn by tools/make-intros.mjs, so a key here has to match a
 * recipe there. They are greyscale, like the rest of the art, and the card tints
 * each one with its applicant's colour.
 *
 * Every strip is the same shape, which is what lets one set of numbers describe
 * all of them. A frame is a square, the strip is those frames in a row, and the
 * whole thing loops. Sixteen frames at twelve a second is a second and a third,
 * which fits comfortably inside the time the card is on screen.
 */
export const INTRO_DIRECTORY = 'assets/intros/';

export const INTRO_PREFIX = 'intro-';

export const INTRO_FRAME_SIZE = 80;
export const INTRO_FRAME_COUNT = 16;
export const INTRO_FRAME_RATE = 12;

export const INTRO_KEYS = [
  'intro-graduate',
  'intro-careerChanger',
  'intro-overqualified',
  'intro-keywordStuffer',
  'intro-referral',
  'intro-boomerang',

  // The seventh. Only the phone board ever sends this type, so only the phone
  // board ever draws this card, and the desktop boot scene fetches four
  // kilobytes it will not use. That is cheaper than a second list saying which
  // board a strip belongs to, which is a list that would have to be kept in
  // step with this one.
  'intro-internalCandidate'
];

/**
 * The texture key for an applicant type, or null if that type has nothing
 * drawn for it. Null is a perfectly good answer: the card falls back to the
 * name and the trait on their own, which is what it showed before there were
 * any animations at all.
 */
export function introKeyFor(typeKey) {
  const key = `${INTRO_PREFIX}${typeKey}`;

  return INTRO_KEYS.includes(key) ? key : null;
}

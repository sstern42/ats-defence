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

  // The seventh. It used to be sent by the phone board alone, and this list
  // carried a note apologising for the four kilobytes the desktop boot scene
  // fetched and never drew. The open advert and back channel lists send it now,
  // so the card it was fetching turns up on those boards with no change to
  // anything here: the strip was already loaded, the animation was already
  // registered against it, and introduceType already looks a type up by name.
  //
  // Which is the argument against the second list that note was refusing, made
  // for us. A list saying which board a strip belongs to would have had to be
  // found and corrected before any of this drew, and forgetting it would have
  // cost a card rather than an error.
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

/**
 * What the player is holding, to the extent the browser will say.
 *
 * Only ever used to decide what the copy offers them. Nothing about how input
 * is handled is decided here: GameScene reads `wasTouch` off each event
 * instead, because a laptop with a touchscreen has both and the answer should
 * follow whichever the player just used rather than a guess made at boot.
 *
 * This asks about the primary pointer, so that same laptop reads as fine and
 * keeps the mouse wording, which is right, since it has a keyboard too and the
 * wording is mostly about keys.
 */
export const COARSE_POINTER =
  window.matchMedia?.('(pointer: coarse)').matches ?? false;

/**
 * Whether there are keys to press. There is no honest test for this, so it
 * stands in on the pointer, which at least gets a tablet and a phone right.
 *
 * A tablet with a keyboard case is told the wrong thing by this and loses
 * nothing for it: the keys still work, they are just not advertised.
 */
export const HAS_KEYBOARD = !COARSE_POINTER;

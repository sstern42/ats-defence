import { REDUCED_MOTION } from './device.js';

/**
 * The small movements things make when they are pressed, when they land and
 * when a number changes underneath them.
 *
 * None of it is information. Everything these say is already said by a colour,
 * a label or a readout, and a player who never sees one of them plays exactly
 * the same game. What they are for is answering: a click that moves something,
 * a tower that arrives rather than appearing, a budget that reacts to being
 * spent. The game had all of the state and none of the acknowledgement.
 *
 * They live in one file so there is one set of timings rather than a different
 * guess in every scene, and because the decision not to move at all is a single
 * decision. A player who has asked their system for less motion gets the state
 * without the movement: the colours still change, the readouts still change,
 * nothing is animated on the way.
 *
 * These are presentation, not balance. Nothing in here is read by the game
 * loop, and nothing in here can change what a wave costs.
 */
export const FEEL = {
  /** How small something starts before it settles onto the board. */
  landFrom: 0.7,
  landMs: 240,

  /** How far a readout swells when it changes, and how far it dips. */
  pulseTo: 1.12,
  dipTo: 0.92,
  pulseMs: 130,

  /** A button going down under a click, in pixels. */
  pressDrop: 2,

  /** A readout flinching sideways at bad news, in pixels. */
  jolt: 4,

  /** How far a barrel kicks back when it fires, in pixels. */
  recoil: 3,

  /** How long anything shoved out of place takes to come back. */
  returnMs: 150
};

/**
 * Where a thing sits when nothing is happening to it, remembered the first time
 * it is asked to move.
 *
 * Kept here rather than on the objects because half of them are Phaser's and
 * the other half are ours, and neither wants a field on it that only the
 * animations read. Weak, so a scene restart takes its entries with it.
 */
const restingScale = new WeakMap();
const restingPosition = new WeakMap();

function scaleHome(target) {
  if (!restingScale.has(target)) {
    restingScale.set(target, { x: target.scaleX, y: target.scaleY });
  }

  return restingScale.get(target);
}

function positionHome(target) {
  if (!restingPosition.has(target)) {
    restingPosition.set(target, { x: target.x, y: target.y });
  }

  return restingPosition.get(target);
}

/**
 * Something arriving on the board: in from small, with a little overshoot, to
 * whatever size it was going to be anyway.
 *
 * The resting scale is read off the object rather than assumed to be 1, since a
 * tower is sized to its footprint and a trap is wider than its footprint again.
 */
export function landing(target) {
  const home = scaleHome(target);

  if (REDUCED_MOTION) {
    return;
  }

  target.setScale(home.x * FEEL.landFrom, home.y * FEEL.landFrom);

  target.scene.tweens.add({
    targets: target,
    scaleX: home.x,
    scaleY: home.y,
    duration: FEEL.landMs,
    ease: 'Back.easeOut'
  });
}

/**
 * A number reacting to having changed. Up for something gained, and with an
 * amount under 1 for something spent.
 *
 * Any movement already running is taken off first and the object put back where
 * it belongs, because rejections pay out faster than this finishes and stacked
 * tweens would leave a readout quietly growing all run.
 */
export function pulse(target, amount = FEEL.pulseTo) {
  const home = scaleHome(target);

  if (REDUCED_MOTION) {
    return;
  }

  target.scene.tweens.killTweensOf(target);
  target.setScale(home.x, home.y);

  target.scene.tweens.add({
    targets: target,
    scaleX: home.x * amount,
    scaleY: home.y * amount,
    duration: FEEL.pulseMs,
    ease: 'Quad.easeOut',
    yoyo: true,
    onComplete: () => target.setScale(home.x, home.y)
  });
}

/**
 * A shove, and a settle back to where it was. A button goes down under a
 * finger, a readout flinches sideways at a leak, a barrel kicks back as it
 * fires: all the same movement, only the direction differs.
 *
 * The shove is instant and only the return is tweened, which is what makes it
 * read as a reaction rather than as a thing drifting about.
 */
export function nudge(target, dx, dy) {
  const home = positionHome(target);

  if (REDUCED_MOTION) {
    return;
  }

  target.scene.tweens.killTweensOf(target);
  target.setPosition(home.x + dx, home.y + dy);

  target.scene.tweens.add({
    targets: target,
    x: home.x,
    y: home.y,
    duration: FEEL.returnMs,
    ease: 'Quad.easeOut'
  });
}

/**
 * The board taking a hit. Routed through here rather than called on the camera
 * directly, so the one thing in the game that moves the whole screen is covered
 * by the same setting as everything else.
 */
export function shake(scene, durationMs, intensity) {
  if (REDUCED_MOTION) {
    return;
  }

  scene.cameras.main.shake(durationMs, intensity);
}

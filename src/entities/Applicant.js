import Phaser from 'phaser';

import { pulse } from '../services/feel.js';

/**
 * How far an applicant flinches when a hit lands and it is still walking. It is
 * the only thing on the board that says a shot connected with somebody who can
 * take it, since the health bar only appears once they are already hurt.
 */
const FLINCH = 1.22;

/**
 * How much bigger than the old disc an applicant is drawn. A sprite with a
 * soft edge reads smaller than a solid circle of the same size, so matching
 * `radius` exactly makes everybody look as though they have shrunk.
 */
const SPRITE_SCALE = 1.25;

/**
 * An applicant walking the path towards the vacancy.
 *
 * Movement is handled by Phaser's PathFollower, which is driven by a tween
 * from the start of the path to the end. Speed is held in the config as pixels
 * per second, since that is the useful unit for balancing, and converted to a
 * duration here once the path length is known.
 */
export default class Applicant extends Phaser.GameObjects.PathFollower {
  constructor(scene, path, typeKey, definition, textureKey) {
    const start = path.getStartPoint();

    super(scene, path, start.x, start.y, textureKey);

    this.typeKey = typeKey;
    this.definition = definition;
    this.health = definition.health;
    this.maxHealth = definition.health;
    this.speedMultiplier = 1;

    // Set by the scene when this one is a Boomerang coming back, so it is not
    // queued up to come back a second time.
    this.hasReturned = false;

    // The art is shared and greyscale, so the type's colour is what tells one
    // applicant from another. Sizing off the sprite rather than off a number
    // in the config means a type can be given different art without also
    // needing its radius retuned.
    //
    // Scaled to cover the area the old disc covered, rather than to match it
    // on one side. The sprites are not all the same shape: a vehicle is half
    // as long again as it is wide, and matching heights makes it enormous
    // while matching lengths makes it a sliver. Area is the only measure that
    // gives a walking applicant the same visual weight whichever it is drawn
    // with.
    const area = (definition.radius * 2 * SPRITE_SCALE) ** 2;

    this.setTint(definition.colour);
    this.setScale(Math.sqrt(area / (this.width * this.height)));

    // The size they walk at, written down rather than read back off the sprite,
    // which is briefly a different size every time they are hit.
    this.baseScale = this.scale;

    scene.add.existing(this);
  }

  /**
   * How far along the path the applicant is, from 0 to 1. Towers use it to
   * pick the applicant closest to the vacancy, which is the one worth
   * shooting first.
   */
  get progress() {
    return this.pathTween ? this.pathTween.getValue() : 0;
  }

  /**
   * Sets the applicant walking. `onArrival` fires if it reaches the vacancy,
   * which costs the player a life.
   *
   * A type with `spawnProgress` joins the path partway along rather than at the
   * start, which is what a referral is. Only the distance left counts towards
   * the duration, so starting further on does not also mean walking slower.
   */
  walk(onArrival) {
    const from = this.definition.spawnProgress ?? 0;
    const remaining = this.path.getLength() * (1 - from);
    const durationMs = (remaining / this.definition.speed) * 1000;

    this.startFollow({
      from,
      to: 1,
      duration: durationMs,
      positionOnPath: true,
      // Every applicant sprite is drawn facing right, so following the path's
      // angle points them the way they are walking with no offset to apply.
      rotateToPath: true,
      ease: 'Linear',
      onComplete: () => {
        onArrival(this);
      }
    });

    // startFollow puts the follower on the start of the path whatever `from`
    // says, so a late joiner is moved up by hand rather than being seen at the
    // gate for a frame.
    if (from > 0) {
      const entry = this.path.getPoint(from);

      this.setPosition(entry.x, entry.y);
    }

    return this;
  }

  /**
   * Slows the applicant down, or lets it back up to full speed with a
   * multiplier of 1. The walk is a tween, so scaling the tween's clock scales
   * the walking speed without touching the path or the remaining distance.
   */
  setSpeedMultiplier(multiplier) {
    if (!this.pathTween || multiplier === this.speedMultiplier) {
      return;
    }

    this.speedMultiplier = multiplier;
    this.pathTween.setTimeScale(multiplier);
  }

  /**
   * Returns true if that was the hit that finished them off.
   *
   * Anybody still standing flinches. Anybody who is not is about to be rejected
   * by the scene, which has a better exit of its own, so there is no point
   * starting a flinch that would be taken straight back off again.
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);

    if (this.health > 0) {
      pulse(this, FLINCH);
    }

    return this.health === 0;
  }

  /**
   * Rejection. The applicant stops walking immediately and fades out, and the
   * game object destroys itself once the fade finishes. Inactive applicants
   * are ignored by targeting, so nothing shoots a corpse.
   */
  reject() {
    this.stopFollow();
    this.setActive(false);

    // A flinch from the hit that did it may still be running, so it is taken
    // off and they go out from the size they walked at.
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.baseScale);

    // Relative to whatever the sprite was already scaled to, since that is no
    // longer 1 and a fixed target would make small applicants jump on the way
    // out.
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.baseScale * 1.8,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }
}

import Phaser from 'phaser';

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
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);

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

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.8,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }
}

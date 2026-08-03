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
   * which for now just means it is removed. Losing a life comes later.
   */
  walk(onArrival) {
    const durationMs = (this.path.getLength() / this.definition.speed) * 1000;

    this.startFollow({
      duration: durationMs,
      positionOnPath: true,
      ease: 'Linear',
      onComplete: () => {
        onArrival(this);
      }
    });

    return this;
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

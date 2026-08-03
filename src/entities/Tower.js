import Phaser from 'phaser';

/**
 * A screening mechanism sat on the board, shooting applicants that stray into
 * range.
 *
 * The tower is a container so the barrel can turn towards its target while the
 * base stays put. It decides what to shoot and when, but it does not apply the
 * damage itself. `update` returns the applicant it has just hit, and the scene
 * deals with the consequences.
 */
export default class Tower extends Phaser.GameObjects.Container {
  constructor(scene, x, y, typeKey, definition, textureKeys) {
    super(scene, x, y);

    this.typeKey = typeKey;
    this.definition = definition;
    this.nextFireAt = 0;

    this.base = scene.add.image(0, 0, textureKeys.base);
    this.barrel = scene.add.image(0, 0, textureKeys.barrel);
    this.barrel.setOrigin(0.12, 0.5);

    this.add([this.base, this.barrel]);

    scene.add.existing(this);
  }

  /**
   * Turns towards a target and fires if the reload has finished. Returns the
   * applicant that was hit, or null if there was nothing to shoot at or the
   * tower is still reloading.
   */
  update(time, applicants) {
    const target = this.findTarget(applicants);

    if (!target) {
      return null;
    }

    this.barrel.setRotation(
      Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y)
    );

    if (time < this.nextFireAt) {
      return null;
    }

    this.nextFireAt = time + this.definition.fireIntervalMs;

    return target;
  }

  /**
   * Picks the applicant in range that is furthest along the path, which is the
   * one about to become the player's problem.
   */
  findTarget(applicants) {
    let target = null;

    applicants.forEach((applicant) => {
      if (!applicant.active || !this.isInRange(applicant)) {
        return;
      }

      if (!target || applicant.progress > target.progress) {
        target = applicant;
      }
    });

    return target;
  }

  isInRange(applicant) {
    return (
      Phaser.Math.Distance.Between(this.x, this.y, applicant.x, applicant.y) <=
      this.definition.range
    );
  }
}

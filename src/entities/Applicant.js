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

    scene.add.existing(this);
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
}

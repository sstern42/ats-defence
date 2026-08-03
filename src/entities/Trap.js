import Phaser from 'phaser';

/**
 * A trap laid on the path, which is not a tower and does not behave like one.
 *
 * It does not aim, it does not reload and it does not have a range so much as
 * a patch of ground. Anybody who walks onto that patch sets it off, and it is
 * spent. There is only ever one of these on the board, which is what keeps
 * something free from also being the whole game.
 *
 * The trap knows when it has been trodden on. What that costs the applicant is
 * the scene's business, same as with a tower.
 */
export default class Trap extends Phaser.GameObjects.Image {
  constructor(scene, x, y, typeKey, definition, textureKey) {
    super(scene, x, y, textureKey);

    this.typeKey = typeKey;
    this.definition = definition;

    scene.add.existing(this);
  }

  /**
   * What treading on it costs. Flat, and the same for everybody, since the
   * number is the number. Named to match the towers so the scene can settle a
   * hit from either without asking which it has.
   */
  rollDamage() {
    return this.definition.damage;
  }

  catches(applicant) {
    return (
      Phaser.Math.Distance.Between(this.x, this.y, applicant.x, applicant.y) <=
      this.definition.triggerRadius
    );
  }

  /**
   * Asked once. The trap fades out on the spot and takes itself off the board.
   */
  spring() {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 1.6,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }
}

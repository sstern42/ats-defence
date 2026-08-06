import Phaser from 'phaser';

import { landing } from '../services/feel.js';

/**
 * How much bigger than its footprint the pad is drawn. It is a flat thing on
 * the floor rather than something standing on the board, so it can afford to
 * be wider than a tower without looking as though it takes up more room. How
 * far it actually reaches is drawn separately, as a ring.
 */
export const TRAP_SPRITE_SCALE = 1.4;

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

    this.setTint(definition.bodyTint);
    this.setScale((definition.footprint * TRAP_SPRITE_SCALE) / this.width);

    // The size it sits at, written down rather than read back off the sprite,
    // since the sprite is briefly a different size while it is being laid.
    this.baseScale = this.scale;

    scene.add.existing(this);

    // Laid rather than simply there, in the same movement a tower arrives on,
    // since from the player's side both are a thing being put down.
    landing(this);
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
    // Somebody has trodden on it while it was still being laid, so the arrival
    // is taken off and it goes off from its full size.
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.baseScale);

    // Relative, since the pad is already scaled to its footprint and a fixed
    // target would shrink it rather than open it out.
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.baseScale * 1.6,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }
}

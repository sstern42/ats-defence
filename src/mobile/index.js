import Phaser from 'phaser';

import { RADIAL_BOARD } from '../config/path.js';
import MobileGameScene from '../scenes/mobile/GameScene.js';
import MobileUpgradeScene from '../scenes/mobile/UpgradeScene.js';

/**
 * The phone build's entry point, dynamically imported by main.js so none of it
 * reaches the bundle a desktop player downloads.
 *
 * The backing store is the radial board's own size, which is where the portrait
 * decision finally lands: the board has carried the size it is drawn against
 * since it was written, and this is the first thing that renders at it.
 *
 * `Phaser.AUTO` rather than forced WebGL, still. Forcing it is its own step on
 * #47 and it needs an honest refusal behind it for a device that has none,
 * which is a thing to build rather than a flag to flip.
 */
export function startMobile() {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: RADIAL_BOARD.board.width,
    height: RADIAL_BOARD.board.height,
    backgroundColor: '#14161a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    // The board first, then the modal that goes over it, which is the drawing
    // order the desktop config uses for the same reason.
    scene: [MobileGameScene, MobileUpgradeScene]
  });
}

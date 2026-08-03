import Phaser from 'phaser';

import { COPY } from '../content/copy.js';

const FONT = 'system-ui, sans-serif';
const MUTED_COLOUR = '#6f7d8c';
const STEADY_COLOUR = '#8fc4de';
const WARNING_COLOUR = '#d98a6a';

/** Lives left at which the readout starts looking worried. */
const WARNING_LIVES = 3;

/**
 * The HUD, run as its own scene on top of GameScene so it keeps rendering
 * while the game underneath is paused.
 *
 * It reads nothing on a timer. GameScene emits when a life goes and the
 * readout follows.
 */
export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gameScene = this.scene.get('GameScene');

    this.add.text(16, 14, COPY.hints.placeTower, {
      fontFamily: FONT,
      fontSize: '15px',
      color: MUTED_COLOUR
    });

    this.livesText = this.add
      .text(this.scale.width - 16, 14, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: STEADY_COLOUR
      })
      .setOrigin(1, 0);

    this.showLives(this.gameScene.lives);

    this.gameScene.events.on('lives-changed', this.showLives, this);

    // Scene events outlive a scene restart, so the listener is taken off by
    // hand rather than left to pile up on the next run.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.gameScene.events.off('lives-changed', this.showLives, this);
    });
  }

  showLives(lives) {
    this.livesText.setText(`${COPY.hud.lives}: ${lives}`);
    this.livesText.setColor(
      lives <= WARNING_LIVES ? WARNING_COLOUR : STEADY_COLOUR
    );
  }
}

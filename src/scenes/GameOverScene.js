import Phaser from 'phaser';

import { COPY } from '../content/copy.js';
import { trackRestartClicked } from '../services/analytics.js';

const FONT = 'system-ui, sans-serif';
const VEIL_COLOUR = 0x14161a;
const VEIL_ALPHA = 0.86;
const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const BUTTON_COLOUR = '#39566b';
const BUTTON_HOVER_COLOUR = '#4a6d87';

/**
 * The end of a run, drawn over the frozen board.
 *
 * A run ends one of two ways: somebody got hired, or every wave was screened
 * and the vacancy held. Score and the leaderboard belong to later steps.
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    const { width, height } = this.scale;
    const centreX = width / 2;
    const rejected = data.rejected ?? 0;
    const waveNumber = data.waveNumber ?? 1;
    const waveCount = data.waveCount ?? 1;
    const ending = COPY.gameOver[data.outcome] ?? COPY.gameOver.filled;

    // Kept for the restart event, and for the leaderboard at the next step.
    this.score = data.score ?? 0;
    this.waveNumber = waveNumber;
    this.restarted = false;

    this.add
      .rectangle(0, 0, width, height, VEIL_COLOUR, VEIL_ALPHA)
      .setOrigin(0, 0);

    this.add
      .text(centreX, height / 2 - 140, ending.title, {
        fontFamily: FONT,
        fontSize: '44px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5);

    this.add
      .text(centreX, height / 2 - 60, ending.body, {
        fontFamily: FONT,
        fontSize: '17px',
        color: BODY_COLOUR,
        align: 'center',
        wordWrap: { width: 520 },
        lineSpacing: 6
      })
      .setOrigin(0.5);

    const lines = [
      `${COPY.gameOver.waveLabel}: ${waveNumber} ${COPY.hud.waveOf} ${waveCount}`,
      `${COPY.gameOver.rejectedLabel}: ${rejected}`,
      `${COPY.gameOver.scoreLabel}: ${this.score}`
    ];

    lines.forEach((line, index) => {
      this.add
        .text(centreX, height / 2 + 26 + index * 28, line, {
          fontFamily: FONT,
          fontSize: '18px',
          color: TITLE_COLOUR
        })
        .setOrigin(0.5);
    });

    this.createRestartButton(centreX, height / 2 + 142);

    this.add
      .text(centreX, height / 2 + 190, COPY.gameOver.restartHint, {
        fontFamily: FONT,
        fontSize: '14px',
        color: MUTED_COLOUR
      })
      .setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => this.restart());
    this.input.keyboard.once('keydown-ENTER', () => this.restart());
  }

  createRestartButton(x, y) {
    const button = this.add
      .text(x, y, COPY.gameOver.restart, {
        fontFamily: FONT,
        fontSize: '18px',
        color: TITLE_COLOUR,
        backgroundColor: BUTTON_COLOUR,
        padding: { x: 20, y: 12 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      button.setBackgroundColor(BUTTON_HOVER_COLOUR)
    );

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      button.setBackgroundColor(BUTTON_COLOUR)
    );

    button.once(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
      this.restart()
    );
  }

  /**
   * GameScene is paused underneath, so restarting it stops and starts it
   * cleanly. Its create relaunches the HUD, and this scene sees itself out.
   */
  restart() {
    // Space and the button are separate listeners, and only one restart is
    // wanted however many of them the player reaches for.
    if (this.restarted) {
      return;
    }

    this.restarted = true;

    trackRestartClicked({
      fromWave: this.waveNumber,
      previousScore: this.score
    });

    this.scene.get('GameScene').scene.restart();
    this.scene.stop();
  }
}

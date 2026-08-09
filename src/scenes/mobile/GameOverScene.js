import Phaser from 'phaser';

import { COPY } from '../../content/copy.js';
import { RADIAL_BOARD } from '../../config/path.js';
import { trackRestartClicked } from '../../services/analytics.js';

/**
 * The end of a phone run, drawn over the board it happened on.
 *
 * Fourth instance of the overlay pattern, after PauseScene, GameOverScene and
 * the upgrade modal: a scene launched over a paused one, which owns nothing and
 * decides nothing. The board is left visible underneath rather than veiled
 * completely, because the last thing that happened on it is worth looking at.
 *
 * Restarting is `scene.restart` on the board, which re-runs its `create` and
 * therefore takes a fresh clone of the tower's stats. That is not a detail: it
 * is the thing that proves the upgrade cards do not leak between runs, and it is
 * the first route in this mode that exercises two runs in one process at all.
 */

const FONT = 'system-ui, sans-serif';
const VEIL_COLOUR = 0x14161a;
const VEIL_ALPHA = 0.86;

const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const FIGURE_COLOUR = '#e6ebf0';
const BUTTON_COLOUR = 0x39566b;

const TITLE_Y = 300;
const NOTE_Y = 352;
const FIRST_ROW_Y = 452;
const ROW_GAP = 58;
const BUTTON_Y = 700;
const BUTTON_HEIGHT = 88;
const INSET = 40;

export default class MobileGameOverScene extends Phaser.Scene {
  constructor() {
    super('MobileGameOverScene');
  }

  init(summary) {
    this.summary = summary;
  }

  create() {
    const { width, height } = RADIAL_BOARD.board;
    const { outcome, intake, intakeCount, rejected, score } = this.summary;
    const held = outcome === 'held';

    this.board = this.scene.get('MobileGameScene');
    this.restarting = false;

    this.add
      .rectangle(0, 0, width, height, VEIL_COLOUR, VEIL_ALPHA)
      .setOrigin(0, 0);

    this.add
      .text(width / 2, TITLE_Y, held ? COPY.mobileGameOver.held : COPY.mobileGameOver.filled, {
        fontFamily: FONT,
        fontSize: '42px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(
        width / 2,
        NOTE_Y,
        held ? COPY.mobileGameOver.heldNote : COPY.mobileGameOver.filledNote,
        {
          fontFamily: FONT,
          fontSize: '21px',
          color: BODY_COLOUR,
          align: 'center',
          wordWrap: { width: width - INSET * 2 }
        }
      )
      .setOrigin(0.5, 0.5);

    [
      [COPY.mobileGameOver.intake, `${intake} / ${intakeCount}`],
      [COPY.mobileGameOver.rejected, `${rejected}`],
      [COPY.mobileGameOver.score, `${score}`]
    ].forEach(([label, value], index) => {
      const y = FIRST_ROW_Y + index * ROW_GAP;

      this.add
        .text(INSET, y, label, {
          fontFamily: FONT,
          fontSize: '24px',
          color: BODY_COLOUR
        })
        .setOrigin(0, 0.5);

      this.add
        .text(width - INSET, y, value, {
          fontFamily: FONT,
          fontSize: '26px',
          color: FIGURE_COLOUR
        })
        .setOrigin(1, 0.5);
    });

    const button = this.add
      .rectangle(INSET, BUTTON_Y, width - INSET * 2, BUTTON_HEIGHT, BUTTON_COLOUR)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(width / 2, BUTTON_Y + BUTTON_HEIGHT / 2, COPY.mobileGameOver.again, {
        fontFamily: FONT,
        fontSize: '28px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5, 0.5);

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.again());
  }

  /**
   * Guarded, because a second tap during the restart would start a third run
   * over the top of the second.
   */
  again() {
    if (this.restarting) {
      return;
    }

    this.restarting = true;

    // The one event this route was missing, and the only way question 3 of the
    // spec, whether players replay after losing, gets an answer on this board.
    // Sent from the same place the desktop game over sends it and with the same
    // two properties, off the summary this scene was handed rather than by
    // asking the board, which is about to be restarted underneath it.
    trackRestartClicked({
      fromWave: this.summary.intake,
      previousScore: this.summary.score
    });

    this.scene.stop();
    this.board.scene.restart();
  }
}

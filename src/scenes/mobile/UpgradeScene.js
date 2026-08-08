import Phaser from 'phaser';

import { COPY } from '../../content/copy.js';
import { RADIAL_BOARD } from '../../config/path.js';

/**
 * The between-intake modal, drawn over the frozen board. Two cards, one taken,
 * and it is the only thing a player of this design ever decides.
 *
 * It is the third instance of a pattern the project already runs twice.
 * `PauseScene` and `GameOverScene` are both an overlay scene launched over a
 * paused board, and this is the same arrangement: the mobile GameScene owns what
 * a card does and this scene draws the choice and hands one back. Nothing about
 * an upgrade is decided here.
 *
 * There is no way past it without choosing. That is deliberate and it is the
 * difference between this and the pause screen: pausing is a thing the player
 * asks for, and this is the game asking them. A modal with a dismiss button
 * would make the whole of the design's agency optional.
 */

const FONT = 'system-ui, sans-serif';
const VEIL_COLOUR = 0x14161a;
const VEIL_ALPHA = 0.92;

const TITLE_COLOUR = '#e6ebf0';
const NOTE_COLOUR = '#8b98a6';
const CARD_COLOUR = 0x242a33;
const CARD_EDGE = 0x39566b;

const TITLE_Y = 300;
const NOTE_Y = 350;
const FIRST_CARD_Y = 430;
const CARD_HEIGHT = 190;
const CARD_GAP = 34;
const CARD_INSET = 40;

export default class MobileUpgradeScene extends Phaser.Scene {
  constructor() {
    super('MobileUpgradeScene');
  }

  /** `offer` is the cards to draw, chosen by the scene that launched this. */
  init({ offer }) {
    this.offer = offer;
  }

  create() {
    const { width } = RADIAL_BOARD.board;

    this.gameScene = this.scene.get('MobileGameScene');

    // The board is paused underneath, so a second tap has nothing to act on.
    // Guarded anyway, because two cards are two routes out of here and a
    // double tap across both would otherwise apply two upgrades.
    this.chosen = false;

    this.add
      .rectangle(0, 0, width, RADIAL_BOARD.board.height, VEIL_COLOUR, VEIL_ALPHA)
      .setOrigin(0, 0);

    this.add
      .text(width / 2, TITLE_Y, COPY.upgrades.title, {
        fontFamily: FONT,
        fontSize: '38px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(width / 2, NOTE_Y, COPY.upgrades.note, {
        fontFamily: FONT,
        fontSize: '22px',
        color: NOTE_COLOUR
      })
      .setOrigin(0.5, 0.5);

    this.offer.forEach((card, index) => this.drawCard(card, index));
  }

  drawCard(card, index) {
    const { width } = RADIAL_BOARD.board;
    const label = COPY.upgrades[card.id];
    const top = FIRST_CARD_Y + index * (CARD_HEIGHT + CARD_GAP);
    const cardWidth = width - CARD_INSET * 2;

    const panel = this.add
      .rectangle(CARD_INSET, top, cardWidth, CARD_HEIGHT, CARD_COLOUR)
      .setOrigin(0, 0)
      .setStrokeStyle(2, CARD_EDGE)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(CARD_INSET + 28, top + 40, label.name, {
        fontFamily: FONT,
        fontSize: '30px',
        color: TITLE_COLOUR
      })
      .setOrigin(0, 0);

    this.add
      .text(CARD_INSET + 28, top + 92, label.detail, {
        fontFamily: FONT,
        fontSize: '21px',
        color: NOTE_COLOUR,
        // Wrapped rather than trusted to fit, since the copy is edited far more
        // often than this layout is and a line that runs off the card would be
        // found by a reader rather than by a build.
        wordWrap: { width: cardWidth - 56 }
      })
      .setOrigin(0, 0);

    panel.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.take(card));
  }

  take(card) {
    if (this.chosen) {
      return;
    }

    this.chosen = true;

    this.scene.stop();
    this.gameScene.takeUpgrade(card);
  }
}

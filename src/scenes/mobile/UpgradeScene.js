import Phaser from 'phaser';

import { COPY } from '../../content/copy.js';
import { RADIAL_BOARD } from '../../config/path.js';
import { playSound } from '../../services/audio.js';
import { FEEL, fadeOut, landing, nudge } from '../../services/feel.js';

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
const NOTE_COLOUR = '#7a8794';
const EFFECT_COLOUR = '#b8c6d4';
const CARD_COLOUR = 0x242a33;
const CARD_EDGE = 0x39566b;

const TITLE_Y = 300;
const NOTE_Y = 350;
const FIRST_CARD_Y = 420;
const CARD_HEIGHT = 240;
const CARD_GAP = 34;
const CARD_INSET = 40;

/**
 * How long the offer takes to leave once one of them has been taken.
 *
 * Short, because the board is held underneath it and nothing is being read any
 * more. It is the whole of the delay between the tap and the run carrying on,
 * and a player who has asked for less motion does not have it at all: `fadeOut`
 * runs the callback straight away and the modal closes on the tap as it always
 * did.
 */
const TAKEN_FADE_MS = 170;

export default class MobileUpgradeScene extends Phaser.Scene {
  constructor() {
    super('MobileUpgradeScene');
  }

  /** `offer` is the cards to draw, chosen by the scene that launched this. */
  init({ offer }) {
    this.offer = offer;
  }

  create() {
    const { width, height } = RADIAL_BOARD.board;

    this.gameScene = this.scene.get('MobileGameScene');

    // The board is paused underneath, so a second tap has nothing to act on.
    // Guarded anyway, because two cards are two routes out of here and a
    // double tap across both would otherwise apply two upgrades.
    this.chosen = false;

    this.add
      .rectangle(0, 0, width, height, VEIL_COLOUR, VEIL_ALPHA)
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

    // The offer arrives as one thing and leaves as one thing, because it is one
    // decision rather than two cards that happen to be on screen together. It
    // is also what keeps the two movements off each other: `landing` scales this
    // container and a press moves a card inside it, so a card pressed while the
    // offer is still settling does not cut the arrival short.
    //
    // Sat at the middle of the block rather than at the top of it, since a
    // container is scaled about its own origin and one pinned to the top would
    // grow downwards out of the corner instead of opening where it stands.
    const block =
      this.offer.length * CARD_HEIGHT + (this.offer.length - 1) * CARD_GAP;

    this.cards = this.add.container(width / 2, FIRST_CARD_Y + block / 2);

    this.offer.forEach((card, index) =>
      this.cards.add(this.drawCard(card, index, block))
    );

    // Nothing here is faded up: every card is legible the instant it exists and
    // the movement is decoration on top of that, which is the rule the intro
    // cards on the board itself are drawn by.
    landing(this.cards);
  }

  /**
   * One card, built as a container of its own so the whole thing goes down
   * together under a finger rather than the panel moving and the words staying
   * where they were. Everything inside it is placed against the card's middle,
   * which is what makes that true.
   */
  drawCard(card, index, block) {
    const { width } = RADIAL_BOARD.board;
    const label = COPY.upgrades[card.id];
    const cardWidth = width - CARD_INSET * 2;
    const left = -cardWidth / 2;
    const top = -CARD_HEIGHT / 2;

    const holder = this.add.container(
      0,
      -block / 2 + index * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2
    );

    const panel = this.add
      .rectangle(left, top, cardWidth, CARD_HEIGHT, CARD_COLOUR)
      .setOrigin(0, 0)
      .setStrokeStyle(2, CARD_EDGE)
      .setInteractive({ useHandCursor: true });

    holder.add(panel);

    holder.add(
      this.add
        .text(left + 28, top + 40, label.name, {
          fontFamily: FONT,
          fontSize: '30px',
          color: TITLE_COLOUR
        })
        .setOrigin(0, 0)
    );

    const effect = this.add
      .text(left + 28, top + 84, this.effectLine(card, label), {
        fontFamily: FONT,
        fontSize: '22px',
        color: EFFECT_COLOUR,
        // Wrapped rather than trusted to fit, since the copy is edited far more
        // often than this layout is and a line that runs off the card would be
        // found by a reader rather than by a build.
        wordWrap: { width: cardWidth - 56 }
      })
      .setOrigin(0, 0);

    holder.add(effect);

    holder.add(
      this.add
        .text(left + 28, effect.y + effect.height + 12, label.detail, {
          fontFamily: FONT,
          fontSize: '19px',
          color: NOTE_COLOUR,
          fontStyle: 'italic',
          wordWrap: { width: cardWidth - 56 }
        })
        .setOrigin(0, 0)
    );

    panel.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
      this.take(card, holder)
    );

    return holder;
  }

  /**
   * What the card does, with its own number written into it.
   *
   * Read off the card rather than typed into the copy, so the figure a player is
   * shown and the figure the run applies are the same one. `add` is negative on
   * the card that shortens the reload, and the copy says "faster", so the sign
   * is dropped here rather than being something the writer has to remember.
   */
  effectLine(card, label) {
    return label.effect.replace('{amount}', `${Math.abs(card.add ?? 0)}`);
  }

  take(card, holder) {
    if (this.chosen) {
      return;
    }

    this.chosen = true;

    // Down under the finger before anything else happens, which is the rule
    // every other control in the game is pressed by. It matters more here than
    // on a switch: this is the one tap a run of this mode is made of, and it
    // used to be answered by the screen simply ceasing to exist.
    //
    // Behind the guard rather than in front of it, so the card that lost cannot
    // still be pressed while the offer is on its way out.
    nudge(holder, 0, FEEL.pressDrop);

    // The same clip the desktop board plays when something is put on it, and
    // this is the one moment on this board that is the same act: a card is the
    // only thing here that is ever committed to the tower.
    playSound('place');

    // Closing is what the fade is on the way to, so it is handed to `fadeOut`
    // rather than left on a timer beside it. A caller that has to remember to
    // close the modal itself when the movement is switched off is a caller that
    // will forget, and the modal would then never close at all.
    fadeOut(this.cards, TAKEN_FADE_MS, () => {
      this.scene.stop();
      this.gameScene.takeUpgrade(card);
    });
  }
}

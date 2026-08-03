import Phaser from 'phaser';

import { TOWERS } from '../config/towers.js';
import { COPY } from '../content/copy.js';

const FONT = 'system-ui, sans-serif';
const MUTED_COLOUR = '#6f7d8c';
const BODY_COLOUR = '#9aa8b6';
const STEADY_COLOUR = '#8fc4de';
const WARNING_COLOUR = '#d98a6a';
const CURRENCY_COLOUR = '#c7d94a';
const SELECTED_TEXT_COLOUR = '#e6ebf0';
const DISABLED_TEXT_COLOUR = '#57636f';

const BUTTON_IDLE = '#242a33';
const BUTTON_HOVER = '#2f3742';
const BUTTON_SELECTED = '#39566b';
const BUTTON_DISABLED = '#1c2128';

/** Lives left at which the readout starts looking worried. */
const WARNING_LIVES = 3;

/** How long the budget readout stays cross about a purchase it cannot cover. */
const SHORTFALL_MS = 1400;

const PALETTE_LEFT = 16;
const PALETTE_TOP = 12;
const PALETTE_GAP = 10;

/**
 * The HUD, run as its own scene on top of GameScene so it keeps rendering
 * while the game underneath is paused.
 *
 * Everything it shows lives in GameScene. This scene reads nothing on a timer
 * and holds no state of its own: GameScene emits when something changes and
 * the readouts follow. The tower buttons are the same, they ask GameScene to
 * change the selection and then draw whatever comes back.
 *
 * It all sits in a strip along the top that GameScene will not build in, so a
 * click on a button is never also a click on a tile.
 */
export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    this.gameScene = this.scene.get('GameScene');
    this.buttons = new Map();
    this.shortfallTimer = null;

    // Mirrored from GameScene so the first paint has something to read. Both
    // are kept up to date by its events from here on.
    this.currency = this.gameScene.currency;
    this.selectedTowerKey = this.gameScene.selectedTowerKey;

    this.createPalette();
    this.createReadouts();

    this.showSelection(this.selectedTowerKey);
    this.showCurrency(this.currency);
    this.showLives(this.gameScene.lives);

    this.listen();
  }

  /**
   * One button per tower, laid out left to right in palette order, which is
   * also the order of the number key shortcuts.
   */
  createPalette() {
    let x = PALETTE_LEFT;

    Object.entries(TOWERS).forEach(([typeKey, definition], index) => {
      const label = `${index + 1}. ${COPY.towers[typeKey].name}\n${COPY.hud.currency} ${definition.cost}`;

      const button = this.add
        .text(x, PALETTE_TOP, label, {
          fontFamily: FONT,
          fontSize: '14px',
          color: BODY_COLOUR,
          backgroundColor: BUTTON_IDLE,
          padding: { x: 12, y: 8 },
          lineSpacing: 3
        })
        .setInteractive({ useHandCursor: true });

      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
        this.hover(typeKey, true)
      );

      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
        this.hover(typeKey, false)
      );

      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        this.gameScene.selectTower(typeKey)
      );

      this.buttons.set(typeKey, button);

      x += button.width + PALETTE_GAP;
    });

    this.blurbText = this.add.text(
      PALETTE_LEFT,
      PALETTE_TOP + this.tallestButton() + 8,
      '',
      {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR
      }
    );
  }

  tallestButton() {
    return Math.max(...[...this.buttons.values()].map((button) => button.height));
  }

  createReadouts() {
    const right = this.scale.width - 16;

    this.currencyText = this.add
      .text(right, PALETTE_TOP, '', {
        fontFamily: FONT,
        fontSize: '17px',
        color: CURRENCY_COLOUR
      })
      .setOrigin(1, 0);

    this.livesText = this.add
      .text(right, PALETTE_TOP + 26, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: STEADY_COLOUR
      })
      .setOrigin(1, 0);

    this.hintText = this.add
      .text(
        right,
        PALETTE_TOP + this.tallestButton() + 8,
        `${COPY.hints.placeTower} ${COPY.hints.selectTower}`,
        {
          fontFamily: FONT,
          fontSize: '13px',
          color: MUTED_COLOUR
        }
      )
      .setOrigin(1, 0);
  }

  /**
   * Scene events outlive a scene restart, so the listeners are taken off by
   * hand rather than left to pile up on the next run.
   */
  listen() {
    const handlers = {
      'lives-changed': this.showLives,
      'currency-changed': this.showCurrency,
      'tower-selected': this.showSelection,
      'purchase-failed': this.showShortfall,
      'run-over': this.stopPalette
    };

    Object.entries(handlers).forEach(([event, handler]) =>
      this.gameScene.events.on(event, handler, this)
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Object.entries(handlers).forEach(([event, handler]) =>
        this.gameScene.events.off(event, handler, this)
      );
    });
  }

  showLives(lives) {
    this.livesText.setText(`${COPY.hud.lives}: ${lives}`);
    this.livesText.setColor(
      lives <= WARNING_LIVES ? WARNING_COLOUR : STEADY_COLOUR
    );
  }

  showCurrency(currency) {
    this.currency = currency;
    this.currencyText.setText(`${COPY.hud.currency}: ${currency}`);

    // What the budget covers has just changed, so the palette has to say so.
    this.refreshButtons();
  }

  showSelection(typeKey) {
    this.selectedTowerKey = typeKey;
    this.blurbText.setText(COPY.towers[typeKey].blurb);

    this.refreshButtons();
  }

  /**
   * Repaints every button from the current selection and budget. Cheap enough
   * to do wholesale, and it means there is only one place that decides how a
   * button looks.
   */
  refreshButtons() {
    this.buttons.forEach((button, typeKey) => {
      const selected = typeKey === this.selectedTowerKey;
      const affordable = TOWERS[typeKey].cost <= this.currency;

      if (selected) {
        button.setBackgroundColor(BUTTON_SELECTED);
        button.setColor(SELECTED_TEXT_COLOUR);
      } else if (affordable) {
        button.setBackgroundColor(BUTTON_IDLE);
        button.setColor(BODY_COLOUR);
      } else {
        button.setBackgroundColor(BUTTON_DISABLED);
        button.setColor(DISABLED_TEXT_COLOUR);
      }
    });
  }

  /**
   * An unaffordable tower can still be selected, so the player can see what
   * they are saving up for. Hover only lights up the ones they could take now.
   */
  hover(typeKey, over) {
    const button = this.buttons.get(typeKey);

    if (typeKey === this.selectedTowerKey || TOWERS[typeKey].cost > this.currency) {
      return;
    }

    button.setBackgroundColor(over ? BUTTON_HOVER : BUTTON_IDLE);
  }

  /**
   * The run has ended and the board is frozen underneath. The palette stops
   * taking clicks so it does not carry on offering towers that cannot be
   * bought. A restart builds this scene again, interactive from the top.
   */
  stopPalette() {
    this.buttons.forEach((button) => button.disableInteractive());

    // Clears any hover the pointer left behind on the way out.
    this.refreshButtons();
  }

  /**
   * The player has clicked a perfectly good tile with an empty budget. Say so
   * in the hint line and colour the budget, then put both back.
   */
  showShortfall() {
    this.currencyText.setColor(WARNING_COLOUR);
    this.hintText.setText(COPY.hud.shortfall).setColor(WARNING_COLOUR);

    if (this.shortfallTimer) {
      this.shortfallTimer.remove();
    }

    this.shortfallTimer = this.time.delayedCall(SHORTFALL_MS, () => {
      this.currencyText.setColor(CURRENCY_COLOUR);
      this.hintText
        .setText(`${COPY.hints.placeTower} ${COPY.hints.selectTower}`)
        .setColor(MUTED_COLOUR);

      this.shortfallTimer = null;
    });
  }
}

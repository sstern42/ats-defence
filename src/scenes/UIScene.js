import Phaser from 'phaser';

import { TOWERS } from '../config/towers.js';
import { COPY } from '../content/copy.js';
import { COARSE_POINTER, HAS_KEYBOARD } from '../services/device.js';

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

/** How long the HUD stays cross about something it will not do. */
const WARNING_MS = 1400;

/**
 * The palette is two rows of three, which is what six towers and a 1024 pixel
 * board allow. Buttons are a fixed width so the rows line up, and one line each
 * so both rows and the blurb under them stay inside the HUD strip.
 */
const PALETTE_LEFT = 16;
const PALETTE_TOP = 12;
const PALETTE_GAP = 8;
const PALETTE_ROW_GAP = 6;
const PALETTE_COLUMNS = 3;
const BUTTON_WIDTH = 232;

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
    this.warningTimer = null;

    // Mirrored from GameScene so the first paint has something to read. Both
    // are kept up to date by its events from here on.
    this.currency = this.gameScene.currency;
    this.selectedTowerKey = this.gameScene.selectedTowerKey;

    this.createPalette();
    this.createReadouts();

    this.showSelection(this.selectedTowerKey);
    this.showCurrency(this.currency);
    this.showLives(this.gameScene.lives);
    this.showWaveState();

    this.listen();
  }

  /**
   * One button per tower, laid out left to right and then down, in palette
   * order, which is also the order of the number key shortcuts.
   */
  createPalette() {
    let rowTop = PALETTE_TOP;
    let rowHeight = 0;

    Object.entries(TOWERS).forEach(([typeKey, definition], index) => {
      const column = index % PALETTE_COLUMNS;
      const cost = definition.cost === 0 ? COPY.hud.free : definition.cost;
      const label = `${index + 1}. ${COPY.towers[typeKey].name} (${cost})`;

      if (column === 0 && index > 0) {
        rowTop += rowHeight + PALETTE_ROW_GAP;
      }

      const button = this.add
        .text(
          PALETTE_LEFT + column * (BUTTON_WIDTH + PALETTE_GAP),
          rowTop,
          label,
          {
            fontFamily: FONT,
            fontSize: '13px',
            color: BODY_COLOUR,
            backgroundColor: BUTTON_IDLE,
            fixedWidth: BUTTON_WIDTH,
            padding: { x: 10, y: 8 }
          }
        )
        .setInteractive({ useHandCursor: true });

      rowHeight = Math.max(rowHeight, button.height);

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
    });

    this.paletteBottom = rowTop + rowHeight;

    this.blurbText = this.add.text(PALETTE_LEFT, this.paletteBottom + 8, '', {
      fontFamily: FONT,
      fontSize: '13px',
      color: MUTED_COLOUR
    });
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

    this.waveText = this.add
      .text(right, PALETTE_TOP + 48, '', {
        fontFamily: FONT,
        fontSize: '15px',
        color: BODY_COLOUR
      })
      .setOrigin(1, 0);

    this.hintCurrent = this.defaultHint();

    this.hintText = this.add
      .text(right, this.paletteBottom + 8, this.hintCurrent, {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR
      })
      .setOrigin(1, 0);
  }

  /**
   * What the hint line says when it has nothing more pressing to report. It
   * depends on the selection, since a trap goes somewhere a tower cannot, and
   * on whether there is a mouse, since the gesture is not the same one.
   *
   * The number key line is dropped on a touch device, where there are no
   * number keys to offer. Space is still mentioned elsewhere and still has no
   * touch equivalent, which is a gap the palette work closes rather than this.
   */
  defaultHint() {
    const trap = TOWERS[this.selectedTowerKey].behaviour === 'trap';

    if (COARSE_POINTER) {
      return trap ? COPY.hints.layTrapTouch : COPY.hints.placeTowerTouch;
    }

    const placing = trap ? COPY.hints.layTrap : COPY.hints.placeTower;

    return `${placing} ${COPY.hints.selectTower}`;
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
      'trap-limit': this.showTrapLimit,
      'wave-preparing': this.showPreparation,
      'wave-started': this.showWaveOpen,
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

  /**
   * The first paint. GameScene has already opened the countdown by the time
   * this scene exists, so the state is read across once rather than waited
   * for, and events keep it right from there on.
   */
  showWaveState() {
    const { waveNumber, waveCount, phase, prepSecondsLeft } = this.gameScene;

    if (phase === 'preparing') {
      this.showPreparation({
        waveNumber,
        waveCount,
        secondsLeft: prepSecondsLeft
      });

      return;
    }

    this.showWave(waveNumber, waveCount);
  }

  showWave(waveNumber, waveCount) {
    this.waveText.setText(
      `${COPY.hud.wave} ${waveNumber} ${COPY.hud.waveOf} ${waveCount}`
    );
  }

  /**
   * Between waves. The counter says what is coming and how long there is to
   * get ready for it, and the hint line offers the way to cut that short.
   *
   * Only where there is a key to cut it short with. Without one the offer is
   * advice nobody can take, so the line goes back to saying how to build, which
   * is the more useful thing to be reading during a pause anyway. The wave still
   * opens on its own either way.
   */
  showPreparation({ waveNumber, waveCount, secondsLeft }) {
    this.waveText.setText(
      `${COPY.hud.wave} ${waveNumber} ${COPY.hud.waveOf} ${waveCount}, ${COPY.hud.waveOpensIn} ${secondsLeft}s`
    );

    this.setHint(HAS_KEYBOARD ? COPY.hints.skipPrep : this.defaultHint());
  }

  showWaveOpen({ waveNumber, waveCount }) {
    this.showWave(waveNumber, waveCount);
    this.setHint(this.defaultHint());
  }

  /**
   * The hint line is shared, so whatever is put there has to say what should
   * go back once a passing message has had its moment.
   */
  setHint(text) {
    this.hintCurrent = text;

    if (!this.warningTimer) {
      this.hintText.setText(text).setColor(MUTED_COLOUR);
    }
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

    // Where the selection goes has just changed, so the hint says where. Not
    // between waves, when the countdown has the more useful thing to offer.
    if (this.gameScene.phase !== 'preparing') {
      this.setHint(this.defaultHint());
    }

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
    this.flashWarning(COPY.hud.shortfall);
  }

  /**
   * The player has asked for a second set of salary expectations. The budget
   * is not the problem here, so it is left alone.
   */
  showTrapLimit() {
    this.flashWarning(COPY.hud.trapArmed);
  }

  /**
   * Puts a complaint in the hint line for a moment, then puts back whatever
   * the line was saying before, since the wave may have opened or closed while
   * the complaint was up.
   */
  flashWarning(message) {
    this.hintText.setText(message).setColor(WARNING_COLOUR);

    if (this.warningTimer) {
      this.warningTimer.remove();
    }

    this.warningTimer = this.time.delayedCall(WARNING_MS, () => {
      this.currencyText.setColor(CURRENCY_COLOUR);
      this.warningTimer = null;

      this.setHint(this.hintCurrent);
    });
  }
}

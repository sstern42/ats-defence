import Phaser from 'phaser';

import { TOWERS } from '../config/towers.js';
import { COPY } from '../content/copy.js';
import { soundEnabled, toggleSound } from '../services/audio.js';
import { COARSE_POINTER, HAS_KEYBOARD } from '../services/device.js';
import { FEEL, nudge, pulse } from '../services/feel.js';
import { musicEnabled, toggleMusic } from '../services/music.js';
import { HUD_HEIGHT } from './GameScene.js';

const FONT = 'system-ui, sans-serif';
const MUTED_COLOUR = '#6f7d8c';
const BODY_COLOUR = '#9aa8b6';
const STEADY_COLOUR = '#8fc4de';
const WARNING_COLOUR = '#d98a6a';
const CURRENCY_COLOUR = '#c7d94a';
/** The budget, for the moment after a rejection has paid into it. */
const CURRENCY_GAIN_COLOUR = '#e8f79a';
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
 * How long the budget stays lit after it has been paid into, and how long the
 * lives readout stays cross after one has gone. Both are short: they are there
 * to catch the eye of somebody watching the board rather than the HUD.
 */
const GAIN_MS = 260;
const LOSS_MS = 320;

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

/** Between the three controls along the bottom. */
const CONTROL_GAP = 20;

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

    // The two readouts that light up when their number moves, and are put back
    // a moment later. Held so a second change resets the wait rather than
    // being cut short by the first one's timer.
    this.gainTimer = null;
    this.lossTimer = null;

    // Trap types that have just been set and will not take another yet. Kept
    // as a set rather than as timers, since GameScene owns the clock and says
    // when each one is ready again.
    this.waitingTraps = new Set();

    // Mirrored from GameScene so the first paint has something to read. Both
    // are kept up to date by its events from here on.
    this.currency = this.gameScene.currency;
    this.selectedTowerKey = this.gameScene.selectedTowerKey;

    this.createPalette();
    this.createReadouts();
    this.createControls();

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

      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        // Down under the click before anything is decided, since a button that
        // moves says the click arrived whether or not the game acts on it.
        nudge(button, 0, FEEL.pressDrop);

        this.gameScene.selectTower(typeKey);
      });

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
   * The three controls that are not part of playing, pinned along the bottom of
   * the HUD strip under the hint line, which is the last free corner of it.
   *
   * All three are deliberately plain text rather than buttons, and all three
   * carry the key that does the same thing. Pause is anchored to the right edge
   * and the toggles run leftwards from it, rather than the other way round,
   * because a toggle changes width when it is flipped and the pause label does
   * not, so nothing has to be moved when it changes.
   */
  createControls() {
    const bottom = HUD_HEIGHT - 6;

    this.pauseControl = this.plainControl(
      this.scale.width - 16,
      bottom,
      HAS_KEYBOARD ? COPY.hud.pause : COPY.hud.pauseTouch,
      () => this.gameScene.openPause()
    );

    const soundRight =
      this.scale.width - 16 - this.pauseControl.width - CONTROL_GAP;

    this.soundToggle = this.plainControl(soundRight, bottom, '', () =>
      this.flipSound()
    );

    // The music toggle is placed from the sound toggle at its widest rather
    // than at whatever it happens to be saying now, since "off" is the longer
    // of the two states and the row would otherwise shuffle sideways every time
    // the sound was flipped. Only the leftmost control is free to change width.
    this.soundToggle.setText(
      HAS_KEYBOARD ? COPY.hud.soundOff : COPY.hud.soundOffTouch
    );

    this.musicToggle = this.plainControl(
      soundRight - this.soundToggle.width - CONTROL_GAP,
      bottom,
      '',
      () => this.flipMusic()
    );

    this.showSoundState();
    this.showMusicState();

    this.input.keyboard.on('keydown-M', () => this.flipSound());
    this.input.keyboard.on('keydown-N', () => this.flipMusic());
  }

  /**
   * A line of text that lights up under the pointer and does one thing when it
   * is clicked. Bottom right aligned, since that is the corner both live in.
   */
  plainControl(x, y, label, onClick) {
    const control = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    control.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      control.setColor(BODY_COLOUR)
    );

    control.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      control.setColor(MUTED_COLOUR)
    );

    control.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(control, 0, FEEL.pressDrop);

      onClick();
    });

    return control;
  }

  flipSound() {
    toggleSound();
    this.showSoundState();
  }

  showSoundState() {
    const on = HAS_KEYBOARD ? COPY.hud.soundOn : COPY.hud.soundOnTouch;
    const off = HAS_KEYBOARD ? COPY.hud.soundOff : COPY.hud.soundOffTouch;

    this.soundToggle.setText(soundEnabled() ? on : off);

    // Sound off means silence, music included, so the music label greys out to
    // say that its own setting is not currently doing anything.
    if (this.musicToggle) {
      this.musicToggle.setAlpha(soundEnabled() ? 1 : 0.5);
    }
  }

  flipMusic() {
    toggleMusic();
    this.showMusicState();
  }

  showMusicState() {
    const on = HAS_KEYBOARD ? COPY.hud.musicOn : COPY.hud.musicOnTouch;
    const off = HAS_KEYBOARD ? COPY.hud.musicOff : COPY.hud.musicOffTouch;

    this.musicToggle.setText(musicEnabled() ? on : off);
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
      'lives-changed': this.loseLife,
      'currency-changed': this.showCurrency,
      'tower-selected': this.showSelection,
      'purchase-failed': this.showShortfall,
      'trap-limit': this.showTrapLimit,
      'trap-waiting': this.showTrapWait,
      'trap-waiting-started': this.startTrapWait,
      'trap-ready': this.endTrapWait,
      'traps-changed': this.refreshButtons,
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
   * Somebody has walked in. The number only ever goes down, so the event is the
   * whole of the news and the readout can react to it without being told what
   * changed.
   *
   * It flinches towards the middle of the HUD rather than off the edge of it,
   * and it goes cross for a moment even at a life count that is not yet worth
   * worrying about, which is the difference between the readout saying where
   * the run stands and the readout saying something has just happened.
   */
  loseLife(lives) {
    this.showLives(lives);

    nudge(this.livesText, -FEEL.jolt, 0);

    this.livesText.setColor(WARNING_COLOUR);

    if (this.lossTimer) {
      this.lossTimer.remove();
    }

    this.lossTimer = this.time.delayedCall(LOSS_MS, () => {
      this.lossTimer = null;
      this.showLives(lives);
    });
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

    // The countdown has just stopped ticking, which is a quiet way for the
    // counter to change given what is about to walk in.
    pulse(this.waveText);
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

  /**
   * The budget, and what it has just done. Up is a rejection paying out or a
   * wave being cleared, down is something being bought, and the readout swells
   * or dips accordingly.
   *
   * The direction is worked out here rather than being sent with the event,
   * because the event says what the budget is and every other reader of it is
   * happy with that. The first paint sets the same number it already had, so it
   * arrives without a flourish.
   */
  showCurrency(currency) {
    const change = currency - this.currency;

    this.currency = currency;
    this.currencyText.setText(`${COPY.hud.currency}: ${currency}`);

    if (change > 0) {
      pulse(this.currencyText);
      this.lightCurrency();
    } else if (change < 0) {
      pulse(this.currencyText, FEEL.dipTo);
    }

    // What the budget covers has just changed, so the palette has to say so.
    this.refreshButtons();
  }

  /**
   * The budget lit for a moment after being paid into, then back to its own
   * colour. It keeps out of the way of the shortfall warning, which is using
   * the same readout to say something more important.
   */
  lightCurrency() {
    if (this.warningTimer) {
      return;
    }

    this.currencyText.setColor(CURRENCY_GAIN_COLOUR);

    if (this.gainTimer) {
      this.gainTimer.remove();
    }

    this.gainTimer = this.time.delayedCall(GAIN_MS, () => {
      this.gainTimer = null;

      if (!this.warningTimer) {
        this.currencyText.setColor(CURRENCY_COLOUR);
      }
    });
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
   * Repaints every button from the current selection, the budget and any trap
   * still waiting to be reset. Cheap enough
   * to do wholesale, and it means there is only one place that decides how a
   * button looks.
   */
  refreshButtons() {
    this.buttons.forEach((button, typeKey) => {
      const selected = typeKey === this.selectedTowerKey;
      const placeable = this.available(typeKey);

      if (selected) {
        button.setBackgroundColor(BUTTON_SELECTED);
        // Still the selection, but greyed while it cannot be placed, so a
        // trap waiting to be reset shows on the button the player is most
        // likely looking at.
        button.setColor(placeable ? SELECTED_TEXT_COLOUR : DISABLED_TEXT_COLOUR);
      } else if (placeable) {
        button.setBackgroundColor(BUTTON_IDLE);
        button.setColor(BODY_COLOUR);
      } else {
        button.setBackgroundColor(BUTTON_DISABLED);
        button.setColor(DISABLED_TEXT_COLOUR);
      }
    });
  }

  /**
   * Whether clicking the board with this selected would put anything down.
   *
   * The budget answers it for towers. A trap has two more ways to say no: the
   * wait after the last one was set, and the limit on how many of its type may
   * be armed at once. The limit was missing here, so a player at the limit was
   * shown a button in its ordinary colour and only found out by clicking it and
   * reading the complaint. That is the one thing the palette is for.
   */
  available(typeKey) {
    if (this.waitingTraps.has(typeKey)) {
      return false;
    }

    if (TOWERS[typeKey].cost > this.currency) {
      return false;
    }

    // Asked of the board rather than counted here, so there is one definition
    // of how many is too many. The trap is free today, which is why the budget
    // test above has never had anything to say about it, and that is a number in
    // the config rather than a promise.
    return (
      TOWERS[typeKey].behaviour !== 'trap' || this.gameScene.canLayTrap(typeKey)
    );
  }

  /**
   * An unaffordable tower can still be selected, so the player can see what
   * they are saving up for. Hover only lights up the ones they could take now.
   */
  hover(typeKey, over) {
    const button = this.buttons.get(typeKey);

    if (typeKey === this.selectedTowerKey || !this.available(typeKey)) {
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
   * The player has clicked for another set of expectations too soon after the
   * last. Same as the limit above, this is not a budget problem, so the budget
   * is left alone.
   */
  showTrapWait({ secondsLeft }) {
    this.flashWarning(`${COPY.hud.trapWaiting} ${secondsLeft}s.`);
  }

  /**
   * A trap has gone down and its type is shut off for a moment. The button
   * greys out so the wait is visible before anybody clicks into it.
   */
  startTrapWait({ typeKey }) {
    this.waitingTraps.add(typeKey);
    this.refreshButtons();
  }

  /**
   * The wait is over. The button comes back up as well as back to its colour,
   * since the player is most likely looking at the board rather than at the
   * palette when it happens.
   */
  endTrapWait(typeKey) {
    this.waitingTraps.delete(typeKey);
    this.refreshButtons();

    nudge(this.buttons.get(typeKey), 0, -FEEL.pressDrop);
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

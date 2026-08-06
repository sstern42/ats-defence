import Phaser from 'phaser';

import { COPY } from '../content/copy.js';
import { HAS_KEYBOARD } from '../services/device.js';
import { FEEL, nudge } from '../services/feel.js';

const FONT = 'system-ui, sans-serif';
const VEIL_COLOUR = 0x14161a;
const VEIL_ALPHA = 0.9;
const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';

/**
 * The one safe choice is the loud one. Ending the run is offered in the quiet
 * style, so a stray click lands on something that carries on rather than on
 * something that throws the run away.
 */
const PRIMARY_COLOUR = '#39566b';
const PRIMARY_HOVER_COLOUR = '#4a6d87';
const QUIET_COLOUR = '#242a33';
const QUIET_HOVER_COLOUR = '#2f3742';

const TITLE_Y = 236;
const BODY_Y = 296;
const RESUME_Y = 396;
const RESTART_Y = 470;
const EXIT_Y = 552;
const NOTE_OFFSET = 30;
const HINT_Y = 636;

/**
 * The pause screen, drawn over the frozen board.
 *
 * It exists because a run that has begun had no way out of it short of closing
 * the tab: the only restart was on the game over screen, which meant losing on
 * purpose to get one. Three choices here, and nothing else.
 *
 * GameScene owns all three, the same way UIScene reads its readouts from there
 * rather than keeping its own. This scene draws the choices and hands them
 * back, so what pausing, resuming and leaving actually do lives in one place.
 */
export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  create() {
    const { width, height } = this.scale;

    this.gameScene = this.scene.get('GameScene');

    // The board is paused underneath, so a second press on any of these has
    // nothing to act on. Guarded anyway, since three routes lead out of here.
    this.chosen = false;

    this.add
      .rectangle(0, 0, width, height, VEIL_COLOUR, VEIL_ALPHA)
      .setOrigin(0, 0);

    const centreX = width / 2;

    this.add
      .text(centreX, TITLE_Y, COPY.pause.title, {
        fontFamily: FONT,
        fontSize: '34px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5);

    this.add
      .text(centreX, BODY_Y, COPY.pause.body, {
        fontFamily: FONT,
        fontSize: '15px',
        color: BODY_COLOUR,
        align: 'center',
        wordWrap: { width: 470 },
        lineSpacing: 6
      })
      .setOrigin(0.5);

    this.createChoice(centreX, RESUME_Y, COPY.pause.resume, true, () =>
      this.resume()
    );

    this.createChoice(centreX, RESTART_Y, COPY.pause.restart, false, () =>
      this.restart()
    );

    this.createNote(centreX, RESTART_Y + NOTE_OFFSET, COPY.pause.restartNote);

    this.createChoice(centreX, EXIT_Y, COPY.pause.exit, false, () =>
      this.leave()
    );

    this.createNote(centreX, EXIT_Y + NOTE_OFFSET, COPY.pause.exitNote);

    // The hint only names the key. The three choices above it are buttons
    // whatever the device, so without a keyboard it has nothing to add.
    if (HAS_KEYBOARD) {
      this.add
        .text(centreX, HINT_Y, COPY.pause.hint, {
          fontFamily: FONT,
          fontSize: '13px',
          color: MUTED_COLOUR
        })
        .setOrigin(0.5);
    }

    this.input.keyboard.on('keydown-ESC', () => this.resume());
  }

  createChoice(x, y, label, primary, onChoose) {
    const idle = primary ? PRIMARY_COLOUR : QUIET_COLOUR;
    const hover = primary ? PRIMARY_HOVER_COLOUR : QUIET_HOVER_COLOUR;

    const button = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '18px',
        color: primary ? TITLE_COLOUR : BODY_COLOUR,
        backgroundColor: idle,
        padding: { x: 20, y: 12 },
        fixedWidth: 300,
        align: 'center'
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      button.setBackgroundColor(hover)
    );

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      button.setBackgroundColor(idle)
    );

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
      nudge(button, 0, FEEL.pressDrop)
    );

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onChoose);

    return button;
  }

  createNote(x, y, text) {
    return this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR
      })
      .setOrigin(0.5, 0);
  }

  resume() {
    this.choose(() => this.gameScene.resumeRun());
  }

  restart() {
    this.choose(() => this.gameScene.restartRun());
  }

  leave() {
    this.choose(() => this.gameScene.leaveRun());
  }

  /**
   * Each of the three stops this scene as part of what it does, so nothing is
   * stopped here. All this has to promise is that only one of them runs.
   */
  choose(act) {
    if (this.chosen) {
      return;
    }

    this.chosen = true;

    act();
  }
}

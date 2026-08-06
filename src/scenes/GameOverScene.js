import Phaser from 'phaser';

import { NAME_CHARACTER, NAME_MAX_LENGTH } from '../config/leaderboard.js';
import { KOFI_URL } from '../config/links.js';
import { COPY } from '../content/copy.js';
import {
  getRunId,
  trackKofiClicked,
  trackRestartClicked,
  trackScoreSubmitted
} from '../services/analytics.js';
import { COARSE_POINTER, HAS_KEYBOARD } from '../services/device.js';
import { FEEL, nudge } from '../services/feel.js';
import { submitScore } from '../services/leaderboard.js';
import { currentModeKey } from '../services/mode.js';
import NameInput from '../services/nameInput.js';
import LeaderboardPanel from './LeaderboardPanel.js';

const FONT = 'system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const VEIL_COLOUR = 0x14161a;
const VEIL_ALPHA = 0.9;
const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const WARNING_COLOUR = '#d98a6a';
const GOOD_COLOUR = '#c7d94a';
const BUTTON_COLOUR = '#39566b';
const BUTTON_HOVER_COLOUR = '#4a6d87';
const BUTTON_DISABLED_COLOUR = '#242a33';
const FIELD_COLOUR = 0x1c2128;
const FIELD_EDGE = 0x39566b;

/** The two columns: the run on the left, the board on the right. */
const LEFT_X = 296;
const BOARD_X = 588;

const FIELD_WIDTH = 300;
const FIELD_HEIGHT = 38;
const FIELD_Y = 476;

/** How fast the caret in the name box blinks. */
const CARET_MS = 530;

const KOFI_COLOUR = '#7d8a99';
const KOFI_HOVER_COLOUR = '#c7d94a';

/**
 * Picks the wording that suits what the player is holding.
 *
 * Both routes reach the same box and the same button, so these differ in what
 * they ask for and never in what is offered. The test is the one NameInput is
 * built on, so the line and the field it describes cannot disagree.
 */
function hint(typed, tapped) {
  return HAS_KEYBOARD ? typed : tapped;
}

function emptyHint() {
  return hint(COPY.leaderboard.emptyHint, COPY.leaderboard.emptyHintTouch);
}

/**
 * The end of a run, drawn over the frozen board.
 *
 * Two things happen here. The run is reported back to the player, and it is
 * offered to the leaderboard. The offer is optional: a player who types
 * nothing and presses space gets the old behaviour and starts again.
 *
 * The name box is drawn like everything else on the screen, which keeps it in
 * one coordinate system, and there is a real form field over it on a
 * touchscreen because a soft keyboard opens for nothing else. That field is
 * invisible and holds no state of its own: it hands its text back here, and
 * what the player sees is still the box below it. See NameInput.
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    const { width, height } = this.scale;
    const waveNumber = data.waveNumber ?? 1;
    const waveCount = data.waveCount ?? 1;
    const rejected = data.rejected ?? 0;
    const ending = COPY.gameOver[data.outcome] ?? COPY.gameOver.filled;

    this.score = data.score ?? 0;
    this.waveNumber = waveNumber;
    this.runId = getRunId();

    // The board this run belongs to. Read here rather than at submission time
    // so it cannot change under a player who leaves the screen open.
    this.modeKey = currentModeKey();

    this.playerName = '';
    this.submitted = false;
    this.submitting = false;
    this.restarted = false;

    this.add
      .rectangle(0, 0, width, height, VEIL_COLOUR, VEIL_ALPHA)
      .setOrigin(0, 0);

    this.createSummary(ending, { waveNumber, waveCount, rejected });

    // Before the name box, which writes to it as soon as it is built.
    this.hintText = this.add
      .text(LEFT_X, 666, emptyHint(), {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR,
        align: 'center',
        wordWrap: { width: 420 }
      })
      .setOrigin(0.5, 0);

    this.createNameEntry();
    this.createRestartButton(LEFT_X, 624);
    this.createKofiLink();

    this.board = new LeaderboardPanel(this, BOARD_X, 150, {
      fromScreen: 'game_over'
    });

    this.board.load(this.modeKey);

    this.input.keyboard.on('keydown', (event) => this.handleKey(event));
  }

  createSummary(ending, { waveNumber, waveCount, rejected }) {
    this.add
      .text(LEFT_X, 150, ending.title, {
        fontFamily: FONT,
        fontSize: '38px',
        color: TITLE_COLOUR,
        align: 'center',
        wordWrap: { width: 470 }
      })
      .setOrigin(0.5);

    this.add
      .text(LEFT_X, 226, ending.body, {
        fontFamily: FONT,
        fontSize: '15px',
        color: BODY_COLOUR,
        align: 'center',
        wordWrap: { width: 460 },
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
        .text(LEFT_X, 330 + index * 26, line, {
          fontFamily: FONT,
          fontSize: '17px',
          color: index === 2 ? GOOD_COLOUR : TITLE_COLOUR
        })
        .setOrigin(0.5);
    });
  }

  /**
   * The name box, its caret, and the button that sends it. The box is a
   * rectangle with a text object sat inside it, and the caret is a character
   * on the end of that text rather than a separate object, so it never drifts
   * away from the last letter.
   */
  createNameEntry() {
    this.add
      .text(LEFT_X, 434, COPY.leaderboard.namePrompt, {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR
      })
      .setOrigin(0.5);

    this.field = this.add
      .rectangle(LEFT_X, FIELD_Y, FIELD_WIDTH, FIELD_HEIGHT, FIELD_COLOUR)
      .setStrokeStyle(1, FIELD_EDGE);

    this.nameText = this.add
      .text(LEFT_X - FIELD_WIDTH / 2 + 12, FIELD_Y, '', {
        fontFamily: MONO,
        fontSize: '16px',
        color: TITLE_COLOUR
      })
      .setOrigin(0, 0.5);

    this.caretVisible = true;
    this.time.addEvent({
      delay: CARET_MS,
      loop: true,
      callback: () => {
        this.caretVisible = !this.caretVisible;
        this.refreshName();
      }
    });

    this.submitButton = this.add
      .text(LEFT_X, 528, COPY.leaderboard.submit, {
        fontFamily: FONT,
        fontSize: '15px',
        color: TITLE_COLOUR,
        backgroundColor: BUTTON_DISABLED_COLOUR,
        padding: { x: 18, y: 9 }
      })
      .setOrigin(0.5);

    this.submitButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      this.submitButton.setBackgroundColor(BUTTON_HOVER_COLOUR)
    );

    this.submitButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      this.submitButton.setBackgroundColor(BUTTON_COLOUR)
    );

    this.submitButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
      nudge(this.submitButton, 0, FEEL.pressDrop)
    );

    this.submitButton.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
      this.submit()
    );

    this.submitStatus = this.add
      .text(LEFT_X, 566, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR,
        align: 'center',
        wordWrap: { width: 420 }
      })
      .setOrigin(0.5, 0);

    this.createNameField();
    this.refreshName();
  }

  /**
   * The invisible form field that gives a touchscreen a way into the box.
   *
   * Built last, because it asks to be kept clear of the soft keyboard as far
   * down as the submit button, and asking the button where it is beats writing
   * the number down twice. Everything else carries on reading this.playerName
   * and never finds out which way it was filled in.
   */
  createNameField() {
    if (!COARSE_POINTER) {
      return;
    }

    const fieldBottom = FIELD_Y + FIELD_HEIGHT / 2;
    const below = this.submitButton.getBounds().bottom - fieldBottom;

    this.nameInput = new NameInput(this, {
      x: LEFT_X,
      y: FIELD_Y,
      width: FIELD_WIDTH,
      height: FIELD_HEIGHT,
      spare: below,
      onChange: (name) => {
        this.playerName = name;
        this.refreshName();
      },
      onSubmit: () => this.submit(),
      onFocus: (focused) => {
        // Whatever is in the box goes into the field as it opens, so the two
        // never disagree about what the player has written.
        if (focused) {
          this.nameInput.take(this.playerName);
        }

        this.refreshName();
      }
    });
  }

  /**
   * Redraws the box and decides whether the button is offering anything. An
   * empty box cannot be submitted, and neither can one that already has been.
   */
  refreshName() {
    // A keyboard is always pointed at the box. A touchscreen is not until the
    // box has been tapped, and a caret blinking in a field that is not taking
    // anything is an invitation to type into thin air.
    const taking = this.nameInput ? this.nameInput.focused : true;
    const caret = this.caretVisible && taking && !this.submitted ? '_' : ' ';

    this.nameText.setText(`${this.playerName}${caret}`);

    const ready = this.playerName.trim().length > 0 && !this.submitted;

    if (ready && !this.submitting) {
      this.submitButton
        .setBackgroundColor(BUTTON_COLOUR)
        .setColor(TITLE_COLOUR)
        .setInteractive({ useHandCursor: true });
    } else {
      this.submitButton
        .setBackgroundColor(BUTTON_DISABLED_COLOUR)
        .setColor(MUTED_COLOUR)
        .disableInteractive();
    }

    if (!this.submitted && !this.submitting) {
      this.hintText.setText(
        this.playerName.length > 0
          ? hint(COPY.leaderboard.typingHint, COPY.leaderboard.typingHintTouch)
          : emptyHint()
      );
    }
  }

  /**
   * All keyboard input for this screen, in one place, because space means two
   * different things depending on whether there is a name in the box.
   */
  handleKey(event) {
    // A keyboard case on a tablet types into the field over the box, which
    // reads its own keys and would otherwise be answered twice.
    if (this.nameInput?.focused) {
      return;
    }

    if (this.submitted || this.submitting) {
      if (event.key === ' ' || event.key === 'Enter') {
        this.restart();
      }

      return;
    }

    if (event.key === 'Enter') {
      if (this.playerName.trim().length === 0) {
        this.restart();
      } else {
        this.submit();
      }

      return;
    }

    if (event.key === 'Backspace') {
      this.playerName = this.playerName.slice(0, -1);
      this.refreshName();

      return;
    }

    // Space starts a new run while the box is empty, and is a space once there
    // is something to put it after.
    if (event.key === ' ' && this.playerName.length === 0) {
      this.restart();

      return;
    }

    if (
      NAME_CHARACTER.test(event.key) &&
      this.playerName.length < NAME_MAX_LENGTH
    ) {
      this.playerName += event.key;
      this.refreshName();
    }
  }

  async submit() {
    if (this.submitting || this.submitted) {
      return;
    }

    const name = this.playerName.trim();

    if (name.length === 0) {
      return;
    }

    this.submitting = true;
    this.refreshName();
    this.submitStatus.setColor(MUTED_COLOUR).setText(COPY.leaderboard.submitting);

    const result = await submitScore({
      name,
      score: this.score,
      finalWave: this.waveNumber,
      runId: this.runId,
      mode: this.modeKey
    });

    this.submitting = false;

    if (!result.ok) {
      // The server decides what is wrong, so its reason is shown rather than a
      // guess made here. The player can edit the name and try again.
      this.submitStatus.setColor(WARNING_COLOUR).setText(result.error);
      this.refreshName();

      return;
    }

    this.submitted = true;

    trackScoreSubmitted({ score: this.score, finalWave: this.waveNumber });

    // Closes the soft keyboard and stops the box asking for a name that has
    // already gone in.
    this.nameInput?.finish();

    this.submitStatus.setColor(GOOD_COLOUR).setText(COPY.leaderboard.submitted);
    this.hintText.setText(
      hint(COPY.leaderboard.doneHint, COPY.leaderboard.doneHintTouch)
    );
    this.refreshName();

    // The board is read again so the player sees where they landed.
    this.board.load(this.modeKey);
  }

  /**
   * Sat under the board, in the same muted grey as everything else that is not
   * asking for attention. It brightens on hover and does nothing otherwise,
   * which is as much as a tip jar should do on a screen that has just told
   * somebody they lost.
   */
  createKofiLink() {
    const link = this.add
      .text(BOARD_X, 470, COPY.kofi.link, {
        fontFamily: FONT,
        fontSize: '13px',
        color: KOFI_COLOUR
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      link.setColor(KOFI_HOVER_COLOUR)
    );

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      link.setColor(KOFI_COLOUR)
    );

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      trackKofiClicked({ fromScreen: 'game_over', finalWave: this.waveNumber });

      // A new tab, and noopener, so the game is not left reachable through
      // window.opener by whatever is on the other end.
      window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
    });
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

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
      nudge(button, 0, FEEL.pressDrop)
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
    // The button, space and enter are separate routes in, and only one restart
    // is wanted however many of them the player reaches for.
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

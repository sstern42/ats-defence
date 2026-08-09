import Phaser from 'phaser';

import { FEEDBACK_ANSWERS } from '../../config/feedback.js';
import { NAME_CHARACTER, NAME_MAX_LENGTH } from '../../config/leaderboard.js';
import { KOFI_URL } from '../../config/links.js';
import { RADIAL_BOARD } from '../../config/path.js';
import { COPY } from '../../content/copy.js';
import {
  getRunId,
  trackKofiClicked,
  trackRestartClicked,
  trackScoreSubmitted
} from '../../services/analytics.js';
import { COARSE_POINTER } from '../../services/device.js';
import { feedbackWanted, recordFeedback } from '../../services/feedback.js';
import { FEEL, nudge } from '../../services/feel.js';
import { submitScore } from '../../services/leaderboard.js';
import { currentModeKey } from '../../services/mode.js';
import NameInput from '../../services/nameInput.js';

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
 *
 * ## Getting on the board
 *
 * The screen now asks for a name and files a score, which is the half of the
 * leaderboard that was missing: the database has had a column for this mode
 * since 0008 and nothing could put a row in it.
 *
 * Almost none of it is new. `services/nameInput.js` is the invisible field a
 * touchscreen types into and it ports without an edit, `services/leaderboard.js`
 * is the same client the desktop submits through, and the server decides what is
 * plausible, so what is here is a box, a button and the states between them.
 *
 * The typed route is kept even though this board is a phone board, because
 * `?shape=phone` on a laptop is how every change to it gets reviewed and a
 * review that cannot reach the name box cannot see the half of this that
 * matters. It costs one handler and no copy: `HAS_KEYBOARD` is false on the
 * device this ships to, so nothing offers a key that is not there.
 *
 * ## The tip jar and the question
 *
 * Both arrived at the release, and both were missing rather than declined.
 *
 * The tip jar was on the phone home page and not here, which is the wrong half
 * of the pair: question 6 of the spec asks whether it converts, and the desktop
 * has always offered it in both places, so a phone was being measured on one
 * surface against a laptop's two. Nothing about it is new, down to the muted
 * grey and the new tab.
 *
 * The question is the one the game asks, once a session, and it had never been
 * asked on this board at all. That is the worst place for it to be missing.
 * This is the mode with the least settled wave list of the four, and question 2
 * asks whether the difficulty curve is right, which is exactly the thing the
 * events cannot answer on their own. `services/feedback.js` decides whether to
 * ask and records the answer, so a player who has already answered on the
 * desktop board is not asked again here. Everything below draws it and nothing
 * below decides anything.
 *
 * ## Where it all went
 *
 * Two more things on a portrait screen that was already full meant re-deriving
 * every vertical constant rather than finding gaps for them. The order is the
 * order of what somebody wants: what happened, then the board, then playing
 * again, then the two things that can be ignored. The question is last for the
 * reason the desktop puts it in the far column, which is that a survey sat next
 * to the name box collects the answer of whoever wanted to get past it.
 */

const FONT = 'system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const VEIL_COLOUR = 0x14161a;
const VEIL_ALPHA = 0.86;

const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const GOOD_COLOUR = '#c7d94a';
const WARNING_COLOUR = '#d98c4a';
const LINK_COLOUR = '#7d8a99';

const BUTTON_COLOUR = 0x39566b;
const BUTTON_DISABLED_COLOUR = 0x242a33;
const FIELD_COLOUR = 0x1b2029;
const FIELD_EDGE = 0x39566b;

const INSET = 40;

/**
 * The whole page, top to bottom, on a board 1280 tall.
 *
 * Written out as one run of numbers rather than worked out where each thing is
 * drawn, because they are a single column and the only thing that matters about
 * any of them is what it clears underneath. Everything moved up when the tip jar
 * and the question arrived; nothing was squeezed into a gap.
 */
const TITLE_Y = 96;
const NOTE_Y = 146;

const FIRST_ROW_Y = 236;
const ROW_GAP = 50;

const PROMPT_Y = 396;
const FIELD_Y = 424;
const FIELD_HEIGHT = 76;

const SUBMIT_Y = 518;
const SUBMIT_HEIGHT = 80;

const STATUS_Y = 614;
const BOARD_LINK_Y = 692;

const AGAIN_Y = 726;
const AGAIN_HEIGHT = 88;

const KOFI_Y = 852;

/**
 * The question, and the four answers under it.
 *
 * The gap is larger than the text needs, and the options carry vertical padding
 * on top of that, because these are the only things on this screen a finger has
 * to hit precisely and the desktop's row height is a mouse's row height. The
 * padding is what the hit area is made of: a Phaser text object is only as
 * tappable as its own bounds.
 */
const FEEDBACK_PROMPT_Y = 908;
const FEEDBACK_QUESTION_Y = 946;
const FEEDBACK_OPTION_Y = 1000;
const FEEDBACK_OPTION_GAP = 54;
const FEEDBACK_THANKS_Y = 1198;

/** How often the caret in the name box blinks. */
const CARET_MS = 500;

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

    this.playerName = '';
    this.submitting = false;
    this.submitted = false;

    // Read here rather than at submission time, because restarting the board is
    // what mints the next one and this screen is what offers the restart.
    this.runId = getRunId();
    this.modeKey = currentModeKey();

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
          color: TITLE_COLOUR
        })
        .setOrigin(1, 0.5);
    });

    this.createNameEntry();
    this.createBoardLink();
    this.createAgainButton();
    this.createKofiLink();
    this.createFeedback();

    this.input.keyboard?.on('keydown', (event) => this.handleKey(event));
  }

  // ------------------------------------------------------------ name and score

  /**
   * The name box, its caret, and the button that files it. The box is a
   * rectangle with a text object inside it, and the caret is a character on the
   * end of that text rather than an object of its own, so it never drifts away
   * from the last letter. That is the desktop's arrangement and it is here for
   * the same reason: one thing to place instead of two.
   */
  createNameEntry() {
    const { width } = RADIAL_BOARD.board;
    const fieldWidth = width - INSET * 2;

    this.add
      .text(INSET, PROMPT_Y, COPY.leaderboard.namePrompt, {
        fontFamily: FONT,
        fontSize: '21px',
        color: MUTED_COLOUR
      })
      .setOrigin(0, 0.5);

    this.add
      .rectangle(INSET, FIELD_Y, fieldWidth, FIELD_HEIGHT, FIELD_COLOUR)
      .setOrigin(0, 0)
      .setStrokeStyle(2, FIELD_EDGE);

    this.nameText = this.add
      .text(INSET + 20, FIELD_Y + FIELD_HEIGHT / 2, '', {
        fontFamily: MONO,
        fontSize: '28px',
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

    this.submitBox = this.add
      .rectangle(
        INSET,
        SUBMIT_Y,
        fieldWidth,
        SUBMIT_HEIGHT,
        BUTTON_DISABLED_COLOUR
      )
      .setOrigin(0, 0);

    this.submitLabel = this.add
      .text(width / 2, SUBMIT_Y + SUBMIT_HEIGHT / 2, COPY.leaderboard.submit, {
        fontFamily: FONT,
        fontSize: '26px',
        color: MUTED_COLOUR
      })
      .setOrigin(0.5, 0.5);

    this.submitBox.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(this.submitLabel, 0, FEEL.pressDrop);
      this.submit();
    });

    this.status = this.add
      .text(width / 2, STATUS_Y, '', {
        fontFamily: FONT,
        fontSize: '21px',
        color: MUTED_COLOUR,
        align: 'center',
        wordWrap: { width: fieldWidth }
      })
      .setOrigin(0.5, 0);

    this.createNameField(fieldWidth);
    this.refreshName();
  }

  /**
   * The invisible form field that gives a touchscreen a way into the box.
   *
   * Built last, because it asks to be kept clear of the soft keyboard as far
   * down as the button that files the score, and asking the button where it is
   * beats writing the number down twice. Everything else carries on reading
   * `playerName` and never finds out which way it was filled in.
   */
  createNameField(fieldWidth) {
    if (!COARSE_POINTER) {
      return;
    }

    this.nameInput = new NameInput(this, {
      x: INSET + fieldWidth / 2,
      y: FIELD_Y + FIELD_HEIGHT / 2,
      width: fieldWidth,
      height: FIELD_HEIGHT,
      spare: SUBMIT_Y + SUBMIT_HEIGHT - (FIELD_Y + FIELD_HEIGHT),
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
   * empty box cannot be filed, and neither can one that already has been.
   */
  refreshName() {
    // A keyboard is always pointed at the box. A touchscreen is not until the
    // box has been tapped, and a caret blinking in a field that is not taking
    // anything is an invitation to type into thin air.
    const taking = this.nameInput ? this.nameInput.focused : true;
    const caret = this.caretVisible && taking && !this.submitted ? '_' : ' ';

    this.nameText.setText(`${this.playerName}${caret}`);

    const ready =
      this.playerName.trim().length > 0 && !this.submitted && !this.submitting;

    this.submitBox.setFillStyle(ready ? BUTTON_COLOUR : BUTTON_DISABLED_COLOUR);
    this.submitLabel.setColor(ready ? TITLE_COLOUR : MUTED_COLOUR);

    if (ready) {
      this.submitBox.setInteractive({ useHandCursor: true });
    } else {
      this.submitBox.disableInteractive();
    }
  }

  /**
   * The keys, for the laptop the previews are reviewed on. A phone never gets
   * here, and a tablet with a keyboard case types into the field over the box,
   * which reads its own keys and would otherwise be answered twice.
   */
  handleKey(event) {
    if (this.nameInput?.focused || this.submitted || this.submitting) {
      return;
    }

    if (event.key === 'Enter') {
      this.submit();

      return;
    }

    if (event.key === 'Backspace') {
      this.playerName = this.playerName.slice(0, -1);
      this.refreshName();

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
    this.status.setColor(MUTED_COLOUR).setText(COPY.leaderboard.submitting);

    const result = await submitScore({
      name,
      score: this.summary.score,
      finalWave: this.summary.intake,
      runId: this.runId,
      mode: this.modeKey
    });

    // The player can restart while a submission is in flight, which takes this
    // scene with it.
    if (!this.scene.isActive()) {
      return;
    }

    this.submitting = false;

    if (!result.ok) {
      // The server decides what is wrong, so its reason is shown rather than a
      // guess made here. The player can edit the name and try again.
      this.status.setColor(WARNING_COLOUR).setText(result.error);
      this.refreshName();

      return;
    }

    this.submitted = true;

    trackScoreSubmitted({
      score: this.summary.score,
      finalWave: this.summary.intake
    });

    // Closes the soft keyboard and stops the box asking for a name that has
    // already gone in.
    this.nameInput?.finish();

    this.status.setColor(GOOD_COLOUR).setText(COPY.leaderboard.submitted);
    this.refreshName();
  }

  // ----------------------------------------------------------------- the rest

  /**
   * The way to the board, which on this screen is a link rather than the board
   * itself. Ten rows at a readable size is most of a portrait page and this
   * screen already has a name box and two buttons on it.
   */
  createBoardLink() {
    const link = this.add
      .text(RADIAL_BOARD.board.width / 2, BOARD_LINK_Y, COPY.leaderboard.view, {
        fontFamily: FONT,
        fontSize: '22px',
        color: LINK_COLOUR
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(link, 0, FEEL.pressDrop);

      // The field is a real element in the page and would sit under the rows
      // catching taps, so it is parked for as long as the board is up.
      this.nameInput?.park(true);

      this.scene.launch('MobileLeaderboardScene', {
        fromScreen: 'game_over',
        parent: this.scene.key,
        onClose: () => this.nameInput?.park(false)
      });
    });
  }

  createAgainButton() {
    const { width } = RADIAL_BOARD.board;

    const button = this.add
      .rectangle(INSET, AGAIN_Y, width - INSET * 2, AGAIN_HEIGHT, BUTTON_COLOUR)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(width / 2, AGAIN_Y + AGAIN_HEIGHT / 2, COPY.mobileGameOver.again, {
        fontFamily: FONT,
        fontSize: '28px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5, 0.5);

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(label, 0, FEEL.pressDrop);
      this.again();
    });
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

  // ------------------------------------------------------- the tip and the ask

  /**
   * The tip jar, under the button rather than beside it, in the same muted grey
   * it wears on the desktop and on the phone home page.
   *
   * No hover states, because there is no hover. What the desktop says with a
   * colour change this says with the press drop every other control on this
   * board uses, which is the same translation the rest of the phone build made.
   */
  createKofiLink() {
    const link = this.add
      .text(RADIAL_BOARD.board.width / 2, KOFI_Y, COPY.kofi.link, {
        fontFamily: FONT,
        fontSize: '20px',
        color: LINK_COLOUR,
        padding: { x: 12, y: 12 }
      })
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(link, 0, FEEL.pressDrop);
    });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      trackKofiClicked({
        fromScreen: 'game_over',
        finalWave: this.summary.intake
      });

      // A new tab, and noopener, so the game is not left reachable through
      // window.opener by whatever is on the other end.
      window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
    });
  }

  /**
   * The one question the game asks, drawn only when the session has yet to
   * answer it. Whether that is the case is decided in services/feedback.js, and
   * a player who answered on the desktop board earlier in the same tab is not
   * asked again here.
   *
   * The options are radio buttons rather than four filled buttons, monospaced so
   * the marker and the space it replaces are the same width and the labels do
   * not shift when one is chosen. That is the desktop's arrangement and the
   * argument for it is the desktop's: a form is what the joke is about, and four
   * bright buttons under a screen that has just said somebody lost is a screen
   * shouting.
   *
   * What is not the desktop's is the size of them. They are the only things here
   * a finger has to hit precisely, so they carry padding, and the padding is the
   * hit area rather than a margin.
   */
  createFeedback() {
    if (!feedbackWanted()) {
      return;
    }

    const { width } = RADIAL_BOARD.board;
    const wrap = width - INSET * 2;

    this.add
      .text(INSET, FEEDBACK_PROMPT_Y, COPY.feedback.prompt, {
        fontFamily: FONT,
        fontSize: '19px',
        color: BODY_COLOUR,
        wordWrap: { width: wrap }
      })
      .setOrigin(0, 0);

    this.add
      .text(INSET, FEEDBACK_QUESTION_Y, COPY.feedback.question, {
        fontFamily: FONT,
        fontSize: '22px',
        color: TITLE_COLOUR
      })
      .setOrigin(0, 0);

    this.feedbackOptions = FEEDBACK_ANSWERS.map((answer, index) => {
      const option = this.add
        .text(
          INSET,
          FEEDBACK_OPTION_Y + index * FEEDBACK_OPTION_GAP,
          this.optionLabel(answer, false),
          {
            fontFamily: MONO,
            fontSize: '21px',
            color: BODY_COLOUR,
            padding: { x: 6, y: 14 }
          }
        )
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });

      option.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () =>
        nudge(option, 0, FEEL.pressDrop)
      );

      option.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
        this.answerFeedback(answer)
      );

      return { answer, option };
    });

    this.feedbackThanks = this.add
      .text(INSET, FEEDBACK_THANKS_Y, '', {
        fontFamily: FONT,
        fontSize: '18px',
        color: MUTED_COLOUR,
        wordWrap: { width: wrap },
        lineSpacing: 4
      })
      .setOrigin(0, 0);
  }

  optionLabel(answer, chosen) {
    return `(${chosen ? '•' : ' '}) ${COPY.feedback.options[answer]}`;
  }

  /**
   * One answer, and only one. The options stay on screen afterwards rather than
   * being cleared, so the player can see what they said, and the answer is said
   * by the marker and the colour together rather than by either alone, which is
   * what keeps it readable to somebody who has asked for less movement and to
   * somebody who cannot tell the two colours apart.
   */
  answerFeedback(answer) {
    if (this.feedbackAnswered) {
      return;
    }

    this.feedbackAnswered = true;

    recordFeedback({ answer, finalWave: this.summary.intake });

    this.feedbackOptions.forEach((entry) => {
      const chosen = entry.answer === answer;

      entry.option
        .setText(this.optionLabel(entry.answer, chosen))
        .setColor(chosen ? GOOD_COLOUR : MUTED_COLOUR)
        .disableInteractive();
    });

    this.feedbackThanks.setText(COPY.feedback.thanks);
  }
}

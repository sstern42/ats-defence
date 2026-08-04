import Phaser from 'phaser';

import { KOFI_URL } from '../config/links.js';
import { COPY } from '../content/copy.js';
import { trackKofiClicked } from '../services/analytics.js';
import LeaderboardPanel from './LeaderboardPanel.js';

const FONT = 'system-ui, sans-serif';
const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const BUTTON_COLOUR = '#39566b';
const BUTTON_HOVER_COLOUR = '#4a6d87';
const DIVIDER_COLOUR = 0x2f3742;
const KOFI_COLOUR = '#7d8a99';
const KOFI_HOVER_COLOUR = '#c7d94a';

/** The two columns: the pitch on the left, the board on the right. */
const LEFT_X = 72;
const DIVIDER_X = 556;
const BOARD_X = 600;

const DIVIDER_TOP = 132;
const DIVIDER_BOTTOM = 620;

/** Under the ten rows, at the same height it sits at on the game over screen. */
const KOFI_Y = 470;

/**
 * The how it works list. One line each, and they have to stay one line each:
 * the gap is fixed, so a line long enough to wrap lands on the one under it.
 */
const HOW_TO_TOP = 508;
const HOW_TO_GAP = 26;
const HOW_TO_WIDTH = 470;

/**
 * The page the game opens on.
 *
 * Loading straight into a run meant the first wave was already walking before
 * anybody had read what the game was, and it meant the leaderboard was only
 * ever seen by people who had already lost. Both are fixed by a screen that
 * waits: it says what this is, it shows the board, and it starts a run when
 * the player asks for one.
 *
 * Nothing here counts as a run. `game_started` is still emitted by GameScene,
 * so a session that opens this page and goes no further is now visible as a
 * session with no run in it, which is a question the funnel could not ask
 * before.
 */
export default class HomeScene extends Phaser.Scene {
  constructor() {
    super('HomeScene');
  }

  create() {
    this.started = false;

    this.createPitch();
    this.createStartButton();
    this.createHowTo();

    this.add
      .line(
        0,
        0,
        DIVIDER_X,
        DIVIDER_TOP,
        DIVIDER_X,
        DIVIDER_BOTTOM,
        DIVIDER_COLOUR
      )
      .setOrigin(0, 0);

    this.board = new LeaderboardPanel(this, BOARD_X, 150, {
      fromScreen: 'home',
      unavailable: COPY.leaderboard.unavailableHome
    });

    this.board.load();

    this.createKofiLink();

    // Space and enter both start, so a player who has just read the last line
    // of the how it works list does not have to go and find the button.
    this.input.keyboard.on('keydown-SPACE', () => this.start());
    this.input.keyboard.on('keydown-ENTER', () => this.start());
  }

  createPitch() {
    this.add.text(LEFT_X, 128, COPY.home.title, {
      fontFamily: FONT,
      fontSize: '46px',
      color: TITLE_COLOUR
    });

    this.add.text(LEFT_X, 196, COPY.home.subtitle, {
      fontFamily: FONT,
      fontSize: '18px',
      color: BODY_COLOUR
    });

    this.add.text(LEFT_X, 240, COPY.home.body, {
      fontFamily: FONT,
      fontSize: '15px',
      color: BODY_COLOUR,
      wordWrap: { width: 430 },
      lineSpacing: 7
    });
  }

  createStartButton() {
    const button = this.add
      .text(LEFT_X, 372, COPY.home.start, {
        fontFamily: FONT,
        fontSize: '18px',
        color: TITLE_COLOUR,
        backgroundColor: BUTTON_COLOUR,
        padding: { x: 20, y: 12 }
      })
      .setInteractive({ useHandCursor: true });

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      button.setBackgroundColor(BUTTON_HOVER_COLOUR)
    );

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      button.setBackgroundColor(BUTTON_COLOUR)
    );

    button.once(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.start());

    this.add.text(LEFT_X, 430, COPY.home.startHint, {
      fontFamily: FONT,
      fontSize: '13px',
      color: MUTED_COLOUR
    });
  }

  createHowTo() {
    this.add.text(LEFT_X, 470, COPY.home.howToHeading, {
      fontFamily: FONT,
      fontSize: '15px',
      color: TITLE_COLOUR
    });

    COPY.home.howTo.forEach((line, index) => {
      this.add.text(LEFT_X, HOW_TO_TOP + index * HOW_TO_GAP, line, {
        fontFamily: FONT,
        fontSize: '14px',
        color: MUTED_COLOUR,
        wordWrap: { width: HOW_TO_WIDTH }
      });
    });
  }

  /**
   * The tip jar, under the board and in the same muted grey it wears on the
   * game over screen. It sits in the same place on both, so it is the one
   * thing that does not move when a run ends.
   */
  createKofiLink() {
    const link = this.add
      .text(BOARD_X, KOFI_Y, COPY.kofi.link, {
        fontFamily: FONT,
        fontSize: '13px',
        color: KOFI_COLOUR
      })
      .setInteractive({ useHandCursor: true });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      link.setColor(KOFI_HOVER_COLOUR)
    );

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      link.setColor(KOFI_COLOUR)
    );

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      // No run has been played, so there is no final wave to report. Null
      // rather than nothing, since a click from here is a real click and the
      // property should say it had no wave behind it rather than go missing.
      trackKofiClicked({ fromScreen: 'home', finalWave: null });

      // A new tab, and noopener, so the game is not left reachable through
      // window.opener by whatever is on the other end.
      window.open(KOFI_URL, '_blank', 'noopener,noreferrer');
    });
  }

  /**
   * Starting stops this scene, so the run gets the board to itself. The guard
   * is there because the button, space and enter are three ways in and only
   * one run is wanted however many of them the player reaches for.
   */
  start() {
    if (this.started) {
      return;
    }

    this.started = true;

    this.scene.start('GameScene');
  }
}

import Phaser from 'phaser';

import { KOFI_URL, SITE_URL } from '../config/links.js';
import { MODE_KEYS } from '../config/modes.js';
import { VERSION } from '../config/version.js';
import { COPY } from '../content/copy.js';
import { trackKofiClicked } from '../services/analytics.js';
import { HAS_KEYBOARD } from '../services/device.js';
import { currentModeKey, setMode } from '../services/mode.js';
import LeaderboardPanel from './LeaderboardPanel.js';

const FONT = 'system-ui, sans-serif';
const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const BUTTON_COLOUR = '#39566b';
const BUTTON_HOVER_COLOUR = '#4a6d87';

/** The mode tabs, in the same three states the tower palette buttons use. */
const TAB_IDLE_COLOUR = '#242a33';
const TAB_HOVER_COLOUR = '#2f3742';
const TAB_SELECTED_COLOUR = '#39566b';
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
 * The mode chooser, and everything it pushed down the column to make room.
 *
 * Two tabs rather than two start buttons, because the choice decides more than
 * which run begins: the blurb, the how it works list and the board on the right
 * all follow it. One control with one meaning is easier to read than a pair of
 * buttons that look like they do the same thing to different games.
 */
const TABS_Y = 366;
const TAB_GAP = 10;
const BLURB_Y = 406;
const BLURB_WIDTH = 440;
const START_Y = 452;
const START_HINT_Y = 506;

/**
 * The how it works list. One line each, and they have to stay one line each:
 * the gap is fixed, so a line long enough to wrap lands on the one under it.
 */
const HOW_TO_HEADING_Y = 548;
const HOW_TO_TOP = 582;
const HOW_TO_GAP = 26;
const HOW_TO_WIDTH = 470;

/**
 * The footer, under both columns and under the divider that separates them.
 * The gap between the link and the notice, and the character in it.
 */
const FOOTER_Y = 700;
const FOOTER_GAP = 10;
const FOOTER_SEPARATOR = '·';

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

    // Whichever mode the last run was played in, so somebody who has just quit
    // out of one comes back to the screen describing the game they were in
    // rather than to the other one.
    this.selected = currentModeKey();

    this.createPitch();
    this.createModeTabs();
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

    this.createKofiLink();
    this.createFooter();

    // Draws the blurb, the list and the board for whichever tab is on, which
    // on a first visit is the classic one.
    this.showMode(this.selected);

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

  /**
   * The two tabs and the blurb under them. Laid out left to right by measuring
   * each tab as it is made, so a mode renamed in copy.js does not also need a
   * number changed in here.
   */
  createModeTabs() {
    this.tabs = new Map();

    let x = LEFT_X;

    MODE_KEYS.forEach((key) => {
      const tab = this.add
        .text(x, TABS_Y, COPY.modes[key].name, {
          fontFamily: FONT,
          fontSize: '14px',
          color: MUTED_COLOUR,
          backgroundColor: TAB_IDLE_COLOUR,
          padding: { x: 14, y: 8 }
        })
        .setInteractive({ useHandCursor: true });

      tab.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        if (this.selected !== key) {
          tab.setBackgroundColor(TAB_HOVER_COLOUR);
        }
      });

      tab.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        if (this.selected !== key) {
          tab.setBackgroundColor(TAB_IDLE_COLOUR);
        }
      });

      tab.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () =>
        this.showMode(key)
      );

      this.tabs.set(key, tab);

      x += tab.width + TAB_GAP;
    });

    this.blurbText = this.add.text(LEFT_X, BLURB_Y, '', {
      fontFamily: FONT,
      fontSize: '13px',
      color: BODY_COLOUR,
      wordWrap: { width: BLURB_WIDTH },
      lineSpacing: 5
    });
  }

  /**
   * Switches everything the choice governs: the tabs themselves, the blurb, the
   * how it works list and which board is on the right.
   *
   * It also sets the mode there and then rather than waiting for the player to
   * press start, so the run, the board being read and the events all agree on
   * which game this is without anything having to be passed along.
   */
  showMode(key) {
    this.selected = key;

    setMode(key);

    this.tabs.forEach((tab, tabKey) => {
      const on = tabKey === key;

      tab
        .setBackgroundColor(on ? TAB_SELECTED_COLOUR : TAB_IDLE_COLOUR)
        .setColor(on ? TITLE_COLOUR : MUTED_COLOUR);
    });

    this.blurbText.setText(COPY.modes[key].blurb);

    this.showHowTo(key);

    this.board.load(key);
  }

  createStartButton() {
    const button = this.add
      .text(LEFT_X, START_Y, COPY.home.start, {
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

    // The line under the button only offers the key. Without one there is
    // nothing left for it to say that the button has not said already, so it
    // is left off rather than emptied.
    if (HAS_KEYBOARD) {
      this.add.text(LEFT_X, START_HINT_Y, COPY.home.startHint, {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR
      });
    }
  }

  /**
   * The heading and four empty lines. They are made once and rewritten when the
   * mode changes, rather than destroyed and rebuilt, so switching tabs cannot
   * leave two lists on top of each other.
   */
  createHowTo() {
    this.add.text(LEFT_X, HOW_TO_HEADING_Y, COPY.home.howToHeading, {
      fontFamily: FONT,
      fontSize: '15px',
      color: TITLE_COLOUR
    });

    // As many lines as the longest list needs, so a mode that explains itself
    // in one more step than the other still gets its last line drawn.
    const lines = MODE_KEYS.reduce(
      (most, key) => Math.max(most, COPY.modes[key].howTo.length),
      0
    );

    this.howToLines = [];

    for (let index = 0; index < lines; index += 1) {
      this.howToLines.push(
        this.add.text(LEFT_X, HOW_TO_TOP + index * HOW_TO_GAP, '', {
          fontFamily: FONT,
          fontSize: '14px',
          color: MUTED_COLOUR,
          wordWrap: { width: HOW_TO_WIDTH }
        })
      );
    }
  }

  showHowTo(key) {
    const mode = COPY.modes[key];
    const howTo = HAS_KEYBOARD ? mode.howTo : mode.howToTouch;

    this.howToLines.forEach((text, index) =>
      text.setText(howTo[index] ?? '')
    );
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
   * The footer: where the game came from, and the copyright notice.
   *
   * Only on this screen. The tip jar is on the game over screen as well because
   * a run just ended and that is the moment for it, but a footer is a footer
   * and belongs on the page the game opens on, where it is not competing with a
   * score, a name box and a restart button for the same strip of canvas.
   *
   * The year comes off the clock rather than being typed in, so the notice is
   * right in January without anybody touching it. The version comes off the
   * build for the same reason: it is here so a bug report can say which game it
   * was looking at, and a number somebody has to remember to edit is a number
   * that will be wrong by the second release.
   *
   * Drawn as separate pieces so only the link is clickable. Each is measured
   * once it exists and the next is placed after it, which keeps the row
   * together whatever the copy is edited to say.
   */
  createFooter() {
    const link = this.add
      .text(LEFT_X, FOOTER_Y, COPY.credit.link, {
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

    // A new tab, and noopener, same as the tip jar. No event goes with it: the
    // event list answers the six questions in the spec and where somebody went
    // after reading the footer is not one of them.
    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      window.open(SITE_URL, '_blank', 'noopener,noreferrer');
    });

    const notice = COPY.credit.copyright.replace(
      '{year}',
      String(new Date().getFullYear())
    );

    const version = COPY.credit.version.replace('{version}', VERSION);

    let x = LEFT_X + link.width;

    [notice, version].forEach((piece) => {
      const text = this.add.text(
        x + FOOTER_GAP,
        FOOTER_Y,
        `${FOOTER_SEPARATOR} ${piece}`,
        {
          fontFamily: FONT,
          fontSize: '13px',
          color: MUTED_COLOUR
        }
      );

      x = text.x + text.width;
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

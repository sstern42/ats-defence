import Phaser from 'phaser';

import { NAME_MAX_LENGTH, TOP_N } from '../../config/leaderboard.js';
import { RADIAL_BOARD } from '../../config/path.js';
import { COPY } from '../../content/copy.js';
import { trackLeaderboardViewed } from '../../services/analytics.js';
import { FEEL, nudge } from '../../services/feel.js';
import { fetchTopTen } from '../../services/leaderboard.js';
import { currentModeKey } from '../../services/mode.js';
import { addCarpet, addVignette } from '../backdrop.js';

/**
 * The top ten, drawn down a phone screen.
 *
 * A scene rather than a panel, which is the one place this parts company with
 * the desktop. There it is a panel because it shares a screen: it is the right
 * hand column of the home page and it sits beside the name box on the game over
 * screen. Here there is no right hand column. Ten rows at a size a thumb can
 * read is most of a portrait page, so the board is a thing you open rather than
 * a thing you look across at, and it opens over both of the screens that would
 * otherwise have had to make room for it.
 *
 * What it does not fork is the part worth not forking. The fetch, the three
 * states a board can be in, the copy for each of them, the row format and the
 * event are all the desktop panel's, so there is one definition of what a board
 * says and two of how wide it is drawn. `LeaderboardPanel` is untouched, which
 * matters because two shipped screens read it.
 *
 * It pauses whatever launched it. That is not about the drawing, which the veil
 * handles: it is about the invisible name field, which is a real element in the
 * page rather than something on the canvas and would otherwise sit under these
 * rows catching taps. The scene that owns the field parks it, and this asks for
 * that through the callback it is handed rather than knowing anything about it.
 */

const FONT = 'system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const GOOD_COLOUR = '#c7d94a';
const BUTTON_COLOUR = 0x39566b;

const INSET = 40;

const HEADING_Y = 190;
const STATUS_Y = 260;
const HEADER_Y = 264;
const ROWS_TOP = 314;
const ROW_GAP = 48;

const BUTTON_Y = 1080;
const BUTTON_HEIGHT = 88;

export default class MobileLeaderboardScene extends Phaser.Scene {
  constructor() {
    super('MobileLeaderboardScene');
  }

  /**
   * `fromScreen` is what goes on `leaderboard_viewed`, and is the whole reason
   * that event carries it: the same board opened from two screens answers
   * whether the leaderboard draws players in or brings them back.
   *
   * `parent` is the scene to hold still and hand back to, and `onClose` is how
   * that scene is told to put its name field back.
   */
  init({ fromScreen, parent, onClose }) {
    this.fromScreen = fromScreen;
    this.parent = parent;
    this.onClose = onClose;
  }

  create() {
    const { width } = RADIAL_BOARD.board;

    this.closing = false;
    this.scene.pause(this.parent);

    // The office floor rather than a veil over whatever is underneath. This is
    // the only overlay in the phone build that is a screen in its own right
    // instead of something drawn over a held board: the upgrade modal and the
    // game over summary both want the board visible behind them, and ten rows
    // of names read over a page of pitch copy is just two pages at once.
    //
    // Interactive, so a tap meant for a row does not fall through to whatever it
    // is covering. Nothing here is listening for it.
    addCarpet(this, -20).setInteractive();
    addVignette(this, -10);

    this.modeKey = currentModeKey();

    this.add
      .text(INSET, HEADING_Y, COPY.modes[this.modeKey].board, {
        fontFamily: FONT,
        fontSize: '30px',
        color: TITLE_COLOUR,
        wordWrap: { width: width - INSET * 2 }
      })
      .setOrigin(0, 0);

    this.status = this.add
      .text(INSET, STATUS_Y, COPY.leaderboard.loading, {
        fontFamily: FONT,
        fontSize: '21px',
        color: MUTED_COLOUR,
        wordWrap: { width: width - INSET * 2 },
        lineSpacing: 6
      })
      .setOrigin(0, 0);

    this.header = this.add
      .text(
        INSET,
        HEADER_Y,
        this.row(
          COPY.leaderboard.columnRank,
          COPY.leaderboard.columnName,
          COPY.leaderboard.columnWave,
          COPY.leaderboard.columnScore
        ),
        {
          fontFamily: MONO,
          fontSize: '19px',
          color: MUTED_COLOUR
        }
      )
      .setOrigin(0, 0)
      .setVisible(false);

    this.rows = [];

    for (let index = 0; index < TOP_N; index += 1) {
      this.rows.push(
        this.add
          .text(INSET, ROWS_TOP + index * ROW_GAP, '', {
            fontFamily: MONO,
            fontSize: '21px',
            color: BODY_COLOUR
          })
          .setOrigin(0, 0)
          .setVisible(false)
      );
    }

    this.createCloseButton();
    this.loadBoard();
  }

  /**
   * One line of the board, in fixed columns. Monospace and padding rather than
   * four text objects a row, which would be forty objects to keep in step.
   *
   * Character for character the desktop panel's format, including padding the
   * name to the full sixteen a name may run to, which was worth checking rather
   * than assuming: the widest row this can produce is about 440 pixels of the
   * 640 the column has, so nothing is gained by narrowing it and a long name
   * would shunt the last two columns out of line if it were.
   *
   * It is a second copy of six lines rather than a shared one, because sharing
   * it means exporting it out of `LeaderboardPanel`, and that file is read by
   * two shipped screens for the sake of saving nothing.
   */
  row(rank, name, wave, score) {
    return (
      `${rank}`.padEnd(4) +
      `${name}`.padEnd(NAME_MAX_LENGTH + 2) +
      `${wave}`.padEnd(8) +
      `${score}`
    );
  }

  createCloseButton() {
    const { width } = RADIAL_BOARD.board;

    const button = this.add
      .rectangle(
        INSET,
        BUTTON_Y,
        width - INSET * 2,
        BUTTON_HEIGHT,
        BUTTON_COLOUR
      )
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(width / 2, BUTTON_Y + BUTTON_HEIGHT / 2, COPY.leaderboard.close, {
        fontFamily: FONT,
        fontSize: '28px',
        color: TITLE_COLOUR
      })
      .setOrigin(0.5, 0.5);

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(label, 0, FEEL.pressDrop);
      this.close();
    });
  }

  /**
   * Named for what it loads rather than just `load`, which is a property Phaser
   * puts on every scene for its own loader and which would shadow this.
   */
  async loadBoard() {
    const result = await fetchTopTen(this.modeKey);

    // The scene can be gone by the time this resolves, if the board was closed
    // while the request was in flight.
    if (!this.scene.isActive()) {
      return;
    }

    if (!result.ok) {
      // A written line rather than the reason the client came back with, which
      // is the desktop panel's decision and the reason there are two of them.
      // What a player wants told when the board is down is that it does not
      // matter, and what does not matter differs by where they are standing:
      // on the way out of a run it is that the run still counted, and on the
      // way in it is that the vacancy is open regardless.
      //
      // Picked off `fromScreen` rather than passed in, unlike the desktop,
      // because there are two screens and two lines and they correspond, so a
      // caller given the choice is a caller given the chance to disagree.
      this.showStatus(
        this.fromScreen === 'home'
          ? COPY.leaderboard.unavailableHome
          : COPY.leaderboard.unavailable
      );

      return;
    }

    if (result.entries.length === 0) {
      this.showStatus(COPY.leaderboard.empty);

      return;
    }

    this.status.setVisible(false);
    this.header.setVisible(true);

    this.rows.forEach((row, index) => {
      const entry = result.entries[index];

      if (!entry) {
        row.setVisible(false);

        return;
      }

      row
        .setText(
          this.row(
            `${index + 1}.`,
            entry.display_name,
            entry.final_wave,
            entry.score
          )
        )
        .setColor(index === 0 ? GOOD_COLOUR : BODY_COLOUR)
        .setVisible(true);
    });

    trackLeaderboardViewed(this.fromScreen);
  }

  showStatus(message) {
    this.rows.forEach((row) => row.setVisible(false));
    this.header.setVisible(false);
    this.status.setText(message).setVisible(true);
  }

  /**
   * Guarded, because the scene resuming underneath and this one stopping are
   * two steps and a second tap between them would run both again.
   */
  close() {
    if (this.closing) {
      return;
    }

    this.closing = true;

    this.scene.resume(this.parent);
    this.onClose?.();
    this.scene.stop();
  }
}

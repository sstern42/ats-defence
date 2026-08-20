import Phaser from 'phaser';

import { KOFI_URL, MUSIC_CREDIT_URL, SITE_URL } from '../../config/links.js';
import { RADIAL_BOARD } from '../../config/path.js';
import { VERSION } from '../../config/version.js';
import { COPY } from '../../content/copy.js';
import { trackKofiClicked } from '../../services/analytics.js';
import { FEEL, nudge } from '../../services/feel.js';
import { outbound } from '../../services/links.js';
import { addCarpet, addVignette } from '../backdrop.js';

/**
 * The page the phone build opens on.
 *
 * The argument for it is the desktop's, unchanged: loading straight into a run
 * meant the first intake was walking before anybody had read what the game was.
 * On this board that is worse rather than the same, because the run takes no
 * input at all once it starts, so a player dropped into it has nothing to do
 * but watch something they have not been told the rules of.
 *
 * It is a rebuild rather than a port, for the reason every scene in this folder
 * is. The desktop page is two columns with a divider down the middle and a mode
 * chooser on the left, and none of the three survives contact with a screen 720
 * wide. What ports is the copy, which is the part worth keeping: the same title,
 * the same pitch and the same tip jar, read down a column instead of across two.
 *
 * There are no tabs. This build plays one mode and the router already set it, so
 * a chooser offering one choice is a control that does nothing. The mode still
 * names itself over its own blurb, because a player who arrives here from a
 * launch post should be told which of the four they are about to play.
 *
 * Nothing here counts as a run. `game_started` is still sent by the board, so a
 * session that opens this page and goes no further is a session with no run in
 * it, which is the same shape the desktop funnel already reads.
 *
 * ## Where the leaderboard goes
 *
 * Not here, and not for want of room. This build cannot submit a score yet, and
 * a board showing ten names nobody in this mode put there is worse than no board
 * at all. When it lands it wants a screen rather than a strip: ten rows at a
 * size a thumb can read is most of a portrait page, so the honest arrangement is
 * an overlay reached from here and from the end of a run, which is also how the
 * desktop shows the same panel in two places.
 */

const FONT = 'system-ui, sans-serif';

const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const LINK_COLOUR = '#7d8a99';
const BUTTON_COLOUR = 0x39566b;

/** The floor, under a page where nothing else asks for a depth at all. */
const BACKDROP_DEPTH = -10;

/**
 * One column, read top to bottom, on the same inset the upgrade cards and the
 * game over rows use so the four screens line up down the same edge.
 */
const INSET = 48;

const TITLE_Y = 168;
const SUBTITLE_Y = 250;
const BODY_Y = 300;

const MODE_NAME_Y = 500;
const BLURB_Y = 546;

const START_Y = 676;
const START_HEIGHT = 104;

const BOARD_LINK_Y = 818;

const HOW_TO_HEADING_Y = 890;
const HOW_TO_TOP = 938;
const HOW_TO_GAP = 16;

const KOFI_Y = 1152;
const FOOTER_Y = 1198;
const FOOTER_GAP = 9;
const FOOTER_SEPARATOR = '·';

/**
 * The music credit, on its own line under the row. The row above it is already
 * most of the 624 the column has, so a fourth piece would run off the edge, and
 * the pair sits where the single row used to end.
 */
const CREDIT_Y = 1230;

export default class MobileHomeScene extends Phaser.Scene {
  constructor() {
    super('MobileHomeScene');
  }

  create() {
    this.started = false;

    // The same floor the board is laid on, so the game does not open on a flat
    // sheet and then turn out to be somewhere.
    addCarpet(this, BACKDROP_DEPTH);
    addVignette(this, BACKDROP_DEPTH + 1);

    this.createPitch();
    this.createStartButton();
    this.createBoardLink();

    // Everything below the how-to list is pushed down by however much the list
    // overran the gap left for it, which is nought unless a line wrapped. The
    // list already measures itself so a wrapped line does not land on the one
    // below it; this is the same promise kept one step further down the page,
    // and it was not kept until a fifth line arrived and put the tip jar
    // through the last of them.
    const shift = this.createHowTo();

    this.createKofiLink(shift);
    this.createFooter(shift);
  }

  /** The width everything on this page is wrapped to. */
  get columnWidth() {
    return RADIAL_BOARD.board.width - INSET * 2;
  }

  createPitch() {
    this.add.text(INSET, TITLE_Y, COPY.home.title, {
      fontFamily: FONT,
      fontSize: '58px',
      color: TITLE_COLOUR
    });

    this.add.text(INSET, SUBTITLE_Y, COPY.home.subtitle, {
      fontFamily: FONT,
      fontSize: '24px',
      color: BODY_COLOUR,
      wordWrap: { width: this.columnWidth }
    });

    this.add.text(INSET, BODY_Y, COPY.home.body, {
      fontFamily: FONT,
      fontSize: '22px',
      color: BODY_COLOUR,
      wordWrap: { width: this.columnWidth },
      lineSpacing: 9
    });

    const mode = COPY.modes.oneClickApply;

    this.add.text(INSET, MODE_NAME_Y, mode.name, {
      fontFamily: FONT,
      fontSize: '27px',
      color: TITLE_COLOUR
    });

    this.add.text(INSET, BLURB_Y, mode.blurb, {
      fontFamily: FONT,
      fontSize: '21px',
      color: BODY_COLOUR,
      wordWrap: { width: this.columnWidth },
      lineSpacing: 7
    });
  }

  /**
   * The one control on the page, drawn the full width of the column and tall
   * enough to be hit without aiming. There is no key hint under it: this build
   * refuses landscape and phones have no space bar, so a line offering one would
   * be advertising a key that is not there.
   */
  createStartButton() {
    const button = this.add
      .rectangle(INSET, START_Y, this.columnWidth, START_HEIGHT, BUTTON_COLOUR)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(
        RADIAL_BOARD.board.width / 2,
        START_Y + START_HEIGHT / 2,
        COPY.home.start,
        {
          fontFamily: FONT,
          fontSize: '30px',
          color: TITLE_COLOUR
        }
      )
      .setOrigin(0.5, 0.5);

    // Down rather than up, which is what the switches, the cards and the game
    // over button on this build all do. A control that moves under the finger
    // says the tap arrived, and the run starting says the rest.
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(label, 0, FEEL.pressDrop);
      this.start();
    });
  }

  /**
   * The way to the board, under the button rather than beside it.
   *
   * On the desktop page the board is the whole right hand column and it is the
   * reason to press start. There is no right hand column here, so it is a link
   * to a screen instead, and it sits directly under the button it is an
   * alternative to rather than at the bottom with the tip jar, which is not an
   * alternative to anything.
   */
  createBoardLink() {
    const link = this.add
      .text(INSET, BOARD_LINK_Y, COPY.leaderboard.view, {
        fontFamily: FONT,
        fontSize: '22px',
        color: LINK_COLOUR
      })
      .setInteractive({ useHandCursor: true });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(link, 0, FEEL.pressDrop);

      this.scene.launch('MobileLeaderboardScene', {
        fromScreen: 'home',
        parent: this.scene.key
      });
    });
  }

  /**
   * How the screening works, five lines of it.
   *
   * Laid out by measuring each line rather than on a fixed gap, which is where
   * this parts company with the desktop page. That one warns in copy.js that a
   * how-to line has to hold one line or it lands on the one below it. At this
   * width that warning would be doing real work every time somebody edited the
   * copy, so the layout is made to survive a wrapped line instead of the writer
   * being made to avoid one.
   *
   * Returns how far the rest of the page has to move down to stay clear of it,
   * which is nought while the list fits the room it has always had.
   */
  createHowTo() {
    this.add.text(INSET, HOW_TO_HEADING_Y, COPY.home.howToHeading, {
      fontFamily: FONT,
      fontSize: '24px',
      color: TITLE_COLOUR
    });

    let y = HOW_TO_TOP;

    COPY.modes.oneClickApply.howTo.forEach((line) => {
      const text = this.add.text(INSET, y, line, {
        fontFamily: FONT,
        fontSize: '20px',
        color: MUTED_COLOUR,
        wordWrap: { width: this.columnWidth },
        lineSpacing: 5
      });

      y = text.y + text.height + HOW_TO_GAP;
    });

    return Math.max(0, y - KOFI_Y);
  }

  /** The tip jar, in the same muted grey it wears on the desktop page. */
  createKofiLink(shift) {
    const link = this.add
      .text(INSET, KOFI_Y + shift, COPY.kofi.link, {
        fontFamily: FONT,
        fontSize: '20px',
        color: LINK_COLOUR,
        wordWrap: { width: this.columnWidth }
      })
      .setInteractive({ useHandCursor: true });

    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(link, 0, FEEL.pressDrop);

      // No run has been played, so there is no final wave to report. Null
      // rather than nothing, since a tap from here is a real tap and the
      // property should say it had no wave behind it rather than go missing.
      trackKofiClicked({ fromScreen: 'home', finalWave: null });

      // A new tab, and noopener, so the game is not left reachable through
      // window.opener by whatever is on the other end.
      window.open(outbound(KOFI_URL, 'home'), '_blank', 'noopener,noreferrer');
    });
  }

  /**
   * Where the game came from, the notice and the build, in one row.
   *
   * The version is the reason this is on the page at all. It is here so a bug
   * report from a handset can say which game it was looking at, and this build
   * is the one most likely to produce a report from a device nobody testing it
   * is holding.
   *
   * Drawn as separate pieces so only the link is tappable, each measured once it
   * exists and the next placed after it, which is the desktop footer's
   * arrangement and keeps the row together whatever the copy is edited to say.
   */
  createFooter(shift) {
    const link = this.add
      .text(INSET, FOOTER_Y + shift, COPY.credit.link, {
        fontFamily: FONT,
        fontSize: '18px',
        color: LINK_COLOUR
      })
      .setInteractive({ useHandCursor: true });

    // No event goes with it, same as the desktop footer: the event list answers
    // the six questions in the spec and where somebody went after reading a
    // footer is not one of them.
    link.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(link, 0, FEEL.pressDrop);
      window.open(outbound(SITE_URL, 'home'), '_blank', 'noopener,noreferrer');
    });

    const notice = COPY.credit.copyright.replace(
      '{year}',
      String(new Date().getFullYear())
    );

    const version = COPY.credit.version.replace('{version}', VERSION);

    let x = INSET + link.width;

    [notice, version].forEach((piece) => {
      const text = this.add.text(
        x + FOOTER_GAP,
        FOOTER_Y + shift,
        `${FOOTER_SEPARATOR} ${piece}`,
        {
          fontFamily: FONT,
          fontSize: '18px',
          color: MUTED_COLOUR
        }
      );

      x = text.x + text.width;
    });

    this.createMusicCredit(shift);
  }

  /**
   * Who wrote the music, under the row that says who wrote everything else.
   *
   * The licence does not require it. The track is CC0 and the file next to it
   * in public/assets/audio says so. It is here because it is the one asset in
   * the game somebody else recorded, and because this build plays it on the
   * same toggle the desktop does.
   *
   * The whole line is the target rather than the artist's name inside it, since
   * a thumb cannot aim at three words in the middle of a sentence.
   */
  createMusicCredit(shift) {
    const credit = this.add
      .text(INSET, CREDIT_Y + shift, COPY.credit.music, {
        fontFamily: FONT,
        fontSize: '18px',
        // The link colour rather than the muted one, because it is a link.
        color: LINK_COLOUR,
        wordWrap: { width: this.columnWidth }
      })
      .setInteractive({ useHandCursor: true });

    // A new tab, and noopener, same as the two links above it. No event goes
    // with it either: where somebody went after reading a credit is not one of
    // the six questions in the spec. No campaign tags either, same as the
    // desktop footer, since the page on the other end is somebody else's.
    credit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(credit, 0, FEEL.pressDrop);
      window.open(MUSIC_CREDIT_URL, '_blank', 'noopener,noreferrer');
    });
  }

  /**
   * Starting stops this page, so the run gets the screen to itself. The guard is
   * there because a tap on a button that is about to be destroyed can arrive
   * twice, and only one run is wanted however many of them turn up.
   */
  start() {
    if (this.started) {
      return;
    }

    this.started = true;

    this.scene.start('MobileGameScene');
  }
}

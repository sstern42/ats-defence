import { NAME_MAX_LENGTH, TOP_N } from '../config/leaderboard.js';
import { COPY } from '../content/copy.js';
import { trackLeaderboardViewed } from '../services/analytics.js';
import { fetchTopTen } from '../services/leaderboard.js';

const FONT = 'system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const TITLE_COLOUR = '#e6ebf0';
const BODY_COLOUR = '#8b98a6';
const MUTED_COLOUR = '#6f7d8c';
const GOOD_COLOUR = '#c7d94a';

/** Measured down from the heading, which is what the panel is positioned by. */
const STATUS_OFFSET = 34;
const ROWS_OFFSET = 58;
const ROW_GAP = 23;

/**
 * The top ten, drawn the same way wherever it appears.
 *
 * It is on two screens now: the home page, where it is the reason to press
 * start, and the game over screen, where it is the reason to press it again.
 * A panel rather than a scene, because on one of those screens it is the only
 * thing on the right and on the other it is sat beside a name box.
 *
 * It owns the fetch as well as the drawing, since every state the board can be
 * in is a different thing on screen and there is nothing useful for a caller to
 * do with the result on its own.
 */
export default class LeaderboardPanel {
  /**
   * `fromScreen` is what goes on `leaderboard_viewed`, and is the whole reason
   * the event carries it: the same board on two screens answers whether the
   * leaderboard drives replays or draws them in to begin with.
   */
  constructor(scene, x, y, { fromScreen, unavailable }) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.fromScreen = fromScreen;
    this.unavailable = unavailable ?? COPY.leaderboard.unavailable;

    this.create();
  }

  create() {
    const { scene, x, y } = this;

    scene.add
      .text(x, y, COPY.leaderboard.heading, {
        fontFamily: FONT,
        fontSize: '17px',
        color: TITLE_COLOUR
      })
      .setOrigin(0, 0.5);

    this.status = scene.add
      .text(x, y + STATUS_OFFSET, COPY.leaderboard.loading, {
        fontFamily: FONT,
        fontSize: '13px',
        color: MUTED_COLOUR,
        wordWrap: { width: 400 },
        lineSpacing: 4
      })
      .setOrigin(0, 0);

    this.header = scene.add
      .text(
        x,
        y + STATUS_OFFSET,
        this.row(
          COPY.leaderboard.columnRank,
          COPY.leaderboard.columnName,
          COPY.leaderboard.columnWave,
          COPY.leaderboard.columnScore
        ),
        {
          fontFamily: MONO,
          fontSize: '12px',
          color: MUTED_COLOUR
        }
      )
      .setOrigin(0, 0)
      .setVisible(false);

    this.rows = [];

    for (let index = 0; index < TOP_N; index += 1) {
      this.rows.push(
        scene.add
          .text(x, y + ROWS_OFFSET + index * ROW_GAP, '', {
            fontFamily: MONO,
            fontSize: '13px',
            color: BODY_COLOUR
          })
          .setOrigin(0, 0)
          .setVisible(false)
      );
    }
  }

  /**
   * One line of the board, in fixed columns. Monospace and padding rather than
   * four text objects per row, which would be forty objects to keep in step.
   */
  row(rank, name, wave, score) {
    return (
      `${rank}`.padEnd(4) +
      `${name}`.padEnd(NAME_MAX_LENGTH + 2) +
      `${wave}`.padEnd(8) +
      `${score}`
    );
  }

  async load() {
    const result = await fetchTopTen();

    // The scene can be gone by the time this resolves, if the player started a
    // run while the request was in flight.
    if (!this.scene.scene.isActive()) {
      return;
    }

    if (!result.ok) {
      this.showStatus(this.unavailable);

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
}

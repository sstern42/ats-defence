/**
 * Game modes. Plain data, no logic, so a mode can be retuned without going
 * anywhere near the game loop.
 *
 * There are three. Classic is the game as it shipped, and every number in it is
 * the number it already had, so nothing about it moves for this. Open advert is
 * the same six towers and the same six applicant types walking a board that
 * behaves differently. Back channel is the same six again on a board with no
 * route on it, where where they walk is worked out from where the screening is.
 *
 * The fields are the whole of what a mode changes. GameScene reads them and has
 * no idea which mode it is running, which is the point: there is one game loop
 * and three sets of numbers, rather than three games to keep in step.
 *
 * - `waypoints` is the route, from path.js. A waypoint carrying a `spread` is
 *   the middle of a crowd rather than a line to walk, and that one field is
 *   what turns a queue into a horde. A mode with a `field` has none.
 * - `field` is the other kind of board, also from path.js: a floor and a desk
 *   rather than a route, with the way across it worked out by services/routing.
 *   Its presence is what switches the routing on, on the same terms `pressure`
 *   switches applicants pushing back on, so the two modes that have no field
 *   never find out that any of it exists.
 * - `waves` is the intake list, from waves.js.
 * - `experimentalFirstWave` says whether wave one comes from the starting
 *   difficulty assignment. Only classic does, because classic wave one is the
 *   unit that experiment varies and an open advert run bucketed into it would
 *   widen one arm with a run that never played the thing being measured.
 * - `buildClearance` is how far a tower must sit from the walked line. Zero
 *   means there is no line to keep clear of, so anywhere off the HUD and off
 *   the vacancy will take one.
 * - `trapSnapDistance` is how close to the path a trap has to be laid before it
 *   snaps onto it. Zero means it goes wherever it is put, which is the only
 *   sensible answer when the crowd is half the board wide.
 * - `entryJitter` is how far back from the first waypoint an applicant may
 *   start, so a crowd walks on with a ragged front rather than in a rank.
 * - `pressure` is applicants pushing back, and null is them not doing so.
 * - `scenery` is where the furniture stands, from scenery.js. It changes
 *   nothing about how a run plays and it is a mode setting anyway, because the
 *   two boards have different floors free: a corridor leaves pockets between
 *   its legs, and a crowd leaves a strip at the top and a strip at the bottom.
 */
import {
  BACK_CHANNEL_FIELD,
  OPEN_FIELD_SPINE,
  PATH_WAYPOINTS
} from './path.js';
import {
  BACK_CHANNEL_SCENERY,
  CLASSIC_SCENERY,
  OPEN_FIELD_SCENERY
} from './scenery.js';
import { BACK_CHANNEL_WAVES, OPEN_FIELD_WAVES, WAVES } from './waves.js';

export const MODES = {
  classic: {
    waypoints: PATH_WAYPOINTS,
    waves: WAVES,
    experimentalFirstWave: true,
    buildClearance: 48,
    trapSnapDistance: 46,
    entryJitter: 0,
    pressure: null,
    scenery: CLASSIC_SCENERY
  },
  openField: {
    waypoints: OPEN_FIELD_SPINE,
    waves: OPEN_FIELD_WAVES,
    experimentalFirstWave: false,
    buildClearance: 0,
    trapSnapDistance: 0,
    entryJitter: 90,
    scenery: OPEN_FIELD_SCENERY,

    /**
     * Applicants pushing back, which is open advert only.
     *
     * A crowd that cannot be funnelled has to be answered somehow, and the
     * honest answer for this game is that a process under enough pressure stops
     * working. So an applicant close enough to a screening mechanism wears its
     * integrity down, and a mechanism worn to nothing is suspended pending
     * review rather than destroyed. It comes back on its own, at full
     * integrity, having learned nothing.
     *
     * Suspension rather than destruction because losing a tower outright to a
     * crowd you cannot see the edges of is a punishment rather than a decision,
     * and because a process going quietly offline for a bit is the funnier and
     * more accurate outcome. Which it is comes down to `suspensionMs`, so it is
     * one number away from being either.
     *
     * `range` is how close an applicant has to be to lean on something.
     *
     * `recoveryPerSecond` is integrity coming back, and it is applied against
     * the incoming pressure rather than only once the last of them has walked
     * off. That is what sets the threshold: anybody pushing less hard than this
     * cannot wear a process down at all however long they stand there, so one
     * Graduate wandering past is harmless and eight of them at once are not.
     * It is the number to reach for if suspensions turn out too common, since
     * raising it narrows what counts as a crowd.
     *
     * The pressure figures themselves are on the applicants, and they are set
     * against how long a type is in range rather than against how dangerous it
     * looks. A Career Changer walks at half the speed of a Graduate, so it
     * spends twice as long leaning on the same tower and does not need twice
     * the number to hurt twice as much.
     */
    pressure: {
      range: 96,
      suspensionMs: 9000,
      recoveryPerSecond: 4
    }
  },

  /**
   * The back channel. Nobody used the portal, so there is no queue to stand
   * beside and no advertised front to hold: they come in across the left edge
   * and find their own way to the desk, and every screening mechanism on the
   * board is something to be walked round rather than something to be walked
   * past.
   *
   * Nothing here blocks anybody. A tower makes the ground inside its range
   * expensive, an applicant takes the cheapest way rather than the shortest,
   * and how much any of them minds is `caution` on the type. So the player is
   * not building a maze, they are deciding what the cheapest way in is going to
   * cost, which is a different question and the one this mode exists to ask.
   *
   * `buildClearance` and `trapSnapDistance` are zero for the reason they are
   * zero in open advert: there is no line to keep clear of and none to snap to.
   * The trap is the one thing on the board that lays no threat down, so it is
   * also the one thing nobody routes round, and setting it on the ground they
   * have just been pushed onto is the whole of how it is played here.
   *
   * `pressure` is null. Applicants who can walk round a process have no reason
   * to stand and lean on it, and giving this mode both would be two answers to
   * the same question.
   */
  backChannel: {
    field: BACK_CHANNEL_FIELD,
    waves: BACK_CHANNEL_WAVES,
    experimentalFirstWave: false,
    buildClearance: 0,
    trapSnapDistance: 0,
    entryJitter: 70,
    pressure: null,
    scenery: BACK_CHANNEL_SCENERY
  }
};

/**
 * The mode a session is in until somebody chooses otherwise, and the one every
 * score submitted before this existed was played in.
 */
export const DEFAULT_MODE = 'classic';

/**
 * The mode keys, in the order the home screen offers them. Read by the Netlify
 * functions too, so what the game can play and what the leaderboard will accept
 * cannot drift apart.
 */
export const MODE_KEYS = Object.keys(MODES);

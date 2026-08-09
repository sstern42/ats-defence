/**
 * Where applicants go.
 *
 * Everything down to the back channel field is for the 1024x768 landscape board,
 * which was the only board there was when this file was written. The radial
 * board at the bottom is not, so it carries the size it is drawn against rather
 * than inheriting one from a line at the top of a file. That is the whole reason
 * this sentence changed.
 *
 * Two of the four shipped modes are waypoints walked in order, and they are the
 * two below. The first waypoint sits off the left edge so they walk on rather
 * than appearing, and the last one is the vacancy. A waypoint may carry a
 * `spread`,
 * which is how far above and below that point the crowd fans out by the time it
 * gets there. The classic path has none, so everybody walks the line itself and
 * it is unchanged from the day it was written.
 *
 * The third has no route in it at all, only a floor and a desk, and what gets
 * walked is worked out from where the screening is. That is the field at the
 * bottom of this file, and it is the one thing in the project that used to say
 * it would never happen. It happened for a reason worth writing down: a mode
 * where the applicants route round the process is the joke this game has been
 * telling all along, and there is no way to tell it with a line drawn in
 * advance.
 */
export const PATH_WAYPOINTS = [
  { x: -60, y: 140 },
  { x: 250, y: 140 },
  { x: 250, y: 380 },
  { x: 90, y: 380 },
  { x: 90, y: 620 },
  { x: 520, y: 620 },
  { x: 520, y: 250 },
  { x: 780, y: 250 },
  { x: 780, y: 520 },
  { x: 960, y: 520 }
];

/**
 * The open advert spine. Nobody walks this line: it is the middle of a crowd,
 * and each applicant walks their own copy of it, displaced by their share of
 * the `spread` at every point.
 *
 * That is what makes the mode a crowd rather than a queue, and it is also the
 * whole of the level design. Where the spread is wide the board is open and a
 * tower only sees a slice of what goes past. Where it narrows the crowd is
 * squeezed into a band a couple of towers can cover between them, which is
 * where the screening is worth paying for.
 *
 * Two rules the numbers have to keep. Nothing may fan up into the HUD strip,
 * so the smallest `y - spread` stays comfortably below it. The last point is
 * the vacancy and its spread is zero, because however wide they came in,
 * everybody converges on the one desk.
 */
export const OPEN_FIELD_SPINE = [
  { x: -70, y: 400, spread: 240 },
  { x: 130, y: 402, spread: 232 },
  { x: 290, y: 406, spread: 175 },
  { x: 440, y: 412, spread: 118 },
  { x: 600, y: 420, spread: 130 },
  { x: 740, y: 435, spread: 158 },
  { x: 860, y: 465, spread: 130 },
  { x: 925, y: 500, spread: 65 },
  { x: 960, y: 520, spread: 0 }
];

/**
 * The back channel floor. Not a route: a rectangle of carpet, a strip of left
 * edge they come in over, and the desk they are all trying to reach.
 *
 * `cell` is the grid the routing thinks in, and it is the same 64 pixels the
 * board already builds on, so a tower covers a whole number of the cells it is
 * making expensive. `bounds` is the ground applicants may cross, and it stops
 * short of the top and the bottom of the board on purpose. Those two strips are
 * the level design: a tower stood in one of them is never walked over and still
 * covers the field in front of it, which is the closest this mode has to a safe
 * place to build.
 *
 * `entry` runs between the middle of the first row and the middle of the last,
 * so everybody arrives level with a row rather than half in one. `vacancy` is
 * the same desk the other two modes finish at, in the same corner, because a
 * third mode is a different way in rather than a different job.
 */
export const BACK_CHANNEL_FIELD = {
  cell: 64,
  bounds: { left: 0, top: 192, right: 1024, bottom: 704 },
  entry: { x: -70, top: 224, bottom: 672 },
  vacancy: { x: 960, y: 520 }
};

/**
 * The radial board, for the phone version on issue #47. A fourth kind of board
 * and the first one that is neither a route nor a floor: a desk in the middle,
 * a ring they arrive on, and a straight line between the two.
 *
 * It is the cheapest board in the file, and that is the point of it. The second
 * mode needed a spine to tune, the third needed a cost field and a Dijkstra to
 * read it, and this one needs an angle. Nothing here is pathfinding and nothing
 * here is a waypoint, so `services/routing.js` is not involved and neither is
 * anything that walks a list.
 *
 * `board` is the size these coordinates are drawn against, written down rather
 * than assumed, because it is the first thing in this file that is not
 * 1024x768. It is the portrait analogue the audit suggested and the size the
 * bench already measures at.
 *
 * `spawnRadius` is a circle rather than the screen rectangle, and it is the one
 * decision here worth arguing. On a rectangle an applicant coming in at a corner
 * walks half again as far as one coming in at an edge, which in a mode with a
 * fixed central tower and no input at all means the player's one screening
 * mechanism gets more time on some arrivals than others for no reason the player
 * can see or affect. A circle gives every applicant the same walk, so the only
 * thing that varies is how fast the type is, which is the thing that is supposed
 * to vary. Equal distance is the whole of the level design on a board with no
 * corridor to lay out.
 *
 * The radius is the widest circle that leaves the top and the bottom of the
 * screen clear, and it is a quarter of the height clear at each end. That is
 * wider than the middle third the design note asks for, deliberately: a ring
 * inside a literal middle third has a radius of 213, which would leave two
 * thirds of the board's width empty and squeeze a crowd meant to be hundreds
 * into a disc a third of the screen across. Clear of the notch at the top and
 * clear of the hand at the bottom is what the constraint is for, and this keeps
 * both. It is one number if it turns out to be the wrong reading.
 *
 * `arrivalRadius` is how close to the desk counts as having got in. It is the
 * vacancy's own size rather than a tolerance: an applicant that reaches the desk
 * has reached it.
 */
export const RADIAL_BOARD = {
  board: { width: 720, height: 1280 },
  centre: { x: 360, y: 640 },
  spawnRadius: 320,
  arrivalRadius: 30
};

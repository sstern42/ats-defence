/**
 * Where applicants go, for the 1024x768 board.
 *
 * Two of the three modes are waypoints walked in order, and they are the two
 * below. The first waypoint sits off the left edge so they walk on rather than
 * appearing, and the last one is the vacancy. A waypoint may carry a `spread`,
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

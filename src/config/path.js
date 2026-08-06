/**
 * Waypoint coordinates for the 1024x768 board, walked in order.
 *
 * There is no pathfinding and there is not going to be. Applicants follow
 * these points and nothing else. The first waypoint sits off the left edge so
 * they walk on rather than appearing, and the last one is the vacancy.
 *
 * Two sets of them now, one per game mode, and both are read the same way. A
 * waypoint may carry a `spread`, which is how far above and below that point
 * the crowd fans out by the time it gets there. The classic path has none, so
 * everybody walks the line itself and the file below is unchanged from the day
 * it was written.
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

/**
 * The spawn ring, and the straight line in from it.
 *
 * This is to the radial board what `routing.js` is to the back channel field,
 * and the comparison is the useful part: that one is a cost field, a Dijkstra
 * and a taut-line pass, and this one is an angle. A board where everybody walks
 * straight at the same point does not need a route worked out, so the whole of
 * what the phone version asks of this layer is a point on a circle and the
 * direction of the middle.
 *
 * No Phaser in here. It is four lines of trigonometry against a plain object,
 * and keeping it that way means it can be read, checked and reused without a
 * scene, which is the opposite of how the walked route works today.
 *
 * The board it takes is `RADIAL_BOARD` from config/path.js. It is passed in
 * rather than imported so this file has no opinion about which board it is
 * doing, which is the same arrangement every mode-shaped thing in the project
 * already has.
 */

/**
 * Somewhere on the ring, and the direction of the desk from there.
 *
 * The heading comes back with the point because the caller wants both and the
 * second is the opposite of the first. Working it out again with an atan2 per
 * spawn would be the same number arrived at the long way round.
 */
export function spawnPoint(board, angle = Math.random() * Math.PI * 2) {
  const { centre, spawnRadius } = board;

  return {
    x: centre.x + Math.cos(angle) * spawnRadius,
    y: centre.y + Math.sin(angle) * spawnRadius,
    // Facing back the way it came, which is the way in.
    heading: angle + Math.PI
  };
}

/**
 * Whether this position has reached the desk.
 *
 * Squared, and compared against the squared radius, so nothing takes a square
 * root. It is called once per applicant per frame and the design asks for
 * hundreds of them, which is the one place in this file where the shape of the
 * arithmetic is worth caring about.
 */
export function hasArrived(board, x, y) {
  const dx = x - board.centre.x;
  const dy = y - board.centre.y;

  return dx * dx + dy * dy <= board.arrivalRadius * board.arrivalRadius;
}

/**
 * How far the walk in is.
 *
 * From the ring to the edge of the desk rather than to the middle of it, since
 * arriving is reaching the desk and there is nothing on the other side of it to
 * walk to. Every applicant walks this same distance, which is the whole argument
 * for the ring being a circle.
 */
export function walkDistance(board) {
  return board.spawnRadius - board.arrivalRadius;
}

/**
 * Where the walk in ends, given where it started and which way it is going.
 *
 * Anything driving an applicant along a line rather than integrating a position
 * needs the far end of it, and it has to be the same far end `hasArrived` would
 * have stopped at. Two ways of deciding where the desk is would be two slightly
 * different walks.
 */
export function arrivalPoint(board, x, y, heading) {
  const distance = walkDistance(board);

  return {
    x: x + Math.cos(heading) * distance,
    y: y + Math.sin(heading) * distance
  };
}

/**
 * How long the walk in takes at a given speed, in milliseconds.
 *
 * Reads the board rather than a position, for the same reason as above: the only
 * thing that varies between two applicants is the type's own speed.
 */
export function walkDurationMs(board, speed) {
  return (walkDistance(board) / speed) * 1000;
}

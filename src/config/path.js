/**
 * Waypoint coordinates for the 1024x768 board, walked in order.
 *
 * There is no pathfinding and there is not going to be. Applicants follow
 * these points and nothing else. The first waypoint sits off the left edge so
 * they walk on rather than appearing, and the last one is the vacancy.
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

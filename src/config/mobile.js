/**
 * The phone game's numbers, for issue #47. Plain data, no logic, so this board
 * can be tuned without going anywhere near the loop that plays it.
 *
 * **First pass, with no tuning behind it.** Everything here was picked to make
 * the board legible on a preview: roughly half of the six types die on the
 * approach and roughly half get in. `CLAUDE.md` says tuning is the longest phase
 * of this project and none of it has happened yet.
 *
 * ## Why there is a tower here rather than a reference to the one in towers.js
 *
 * The obvious version of this file spreads `TOWERS.keywordFilter` and overrides
 * the two numbers that do not fit. That is the version to avoid.
 *
 * Classic's numbers are balanced against a 2,460 pixel walk past a board's worth
 * of screening. This board is one tower and a 290 pixel approach, so almost
 * nothing transfers: at classic's twelve damage on a 380 millisecond reload, a
 * Graduate crosses the whole range and comes out alive on forty health, which is
 * what the first run of this scene did.
 *
 * The deeper reason is the direction of the coupling. `CLAUDE.md` says classic
 * does not move, and a mobile board that read classic's tower would make the
 * reverse true as well: every future tuning pass on the Keyword Filter would
 * silently retune a mode nobody was thinking about, and the two would have to be
 * balanced together forever. A separate object costs a few repeated fields once.
 * Shared numbers cost a conversation every time either mode is touched.
 *
 * ## Why the key is still `keywordFilter`
 *
 * The type key is not decoration. `Tower.canTarget` reads
 * `applicant.immuneTo`, and The Keyword Stuffer's immunity names this key, so a
 * tower calling itself anything else would quietly lose the one interaction that
 * makes that applicant what it is. The key is the joke's plumbing.
 */
export const MOBILE_TOWER_KEY = 'keywordFilter';

export const MOBILE_TOWER = {
  behaviour: 'shoot',

  // Wide, because it is the only screening on the board and everything walks
  // straight at it. From the 320 ring this leaves a stretch of approach outside
  // the range, so arriving is still a thing that takes time and can be watched.
  range: 240,

  damage: 20,
  fireIntervalMs: 300,
  footprint: 40,
  sprite: { base: 'tower-base', barrel: 'turret-twin' },
  bodyTint: 0x8fc4de,
  tracerColour: 0x8fc4de,
  tracerDurationMs: 90
};

/**
 * The run itself.
 *
 * `towerHealth` is what the vacancy's lives are on this board, held on the
 * tower because the tower is the thing the player is defending and the thing
 * they are shown. `arrivalCost` is what one applicant getting in takes off it.
 *
 * `spawnIntervalMs` is a placeholder for the wave list this mode does not have
 * yet. Waves are their own step and they are where the difficulty actually
 * lives, so this is a trickle to look at rather than a curve to play.
 */
export const MOBILE_RUN = {
  towerHealth: 200,
  arrivalCost: 5,
  spawnIntervalMs: 900
};

/**
 * Something the first run of this board threw up, written down here because it
 * is the sort of thing that gets rediscovered expensively later.
 *
 * `Tower.findTarget` picks whoever has the least walking left, which is the
 * right answer on every board built so far and has an odd consequence on this
 * one. With a single tower, a type it cannot kill will absorb every shot it
 * fires for as long as that type is the closest to the desk. A Career Changer
 * walks in at 55 pixels a second with 260 health, soaks the entire output of the
 * tower on the way, and everybody behind it strolls past unshot.
 *
 * That is not a bug and it should not be fixed here. It is the Career Changer
 * doing exactly what it is for, and on a board with six towers somebody else
 * covers while it is busy. It matters because this design has no somebody else,
 * so on this board that one interaction is most of the difficulty curve, and
 * whoever tunes the wave list needs to know it before they start rather than
 * after.
 *
 * It is also the first thing that argues for what the upgrade cards should
 * offer: on a board where one type can monopolise a single tower, a card that
 * changes what the tower shoots at is worth more than a card that makes it shoot
 * harder.
 */

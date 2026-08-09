/**
 * The phone game's numbers, for issue #47. Plain data, no logic, so this board
 * can be tuned without going anywhere near the loop that plays it.
 *
 * **Tuned once, against the simulator, in 1.7.0.** What was here before was
 * picked to make the board legible on a preview and had no measurement behind
 * it at all. The two numbers below that moved are the tolerance and what an
 * arrival costs, and they moved together: a run absorbs sixty applicants where
 * it used to absorb forty.
 *
 * That is not a softening, it is room. The old list leaked nothing at all for
 * seven intakes and then decided the whole game in the eighth, so the entire
 * budget was spent in one place and it did not matter how large it was. The new
 * list takes something from the third intake onwards, which only works if there
 * is enough to take.
 *
 * One thing this pass did not fix, and it should be read before the card pool is
 * touched. Update the keyword list is the worst card in the pool, measurably, and
 * it is the card the design considered its flagship decision. The reason is the
 * note further down this file arriving somewhere nobody looked for it. See
 * `tools/simulate-mobile.mjs` at SENSIBLE_ORDER for the measurement.
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

/**
 * What the tower calls itself once the Update the keyword list card is taken.
 *
 * This is the whole of that card's mechanism and it is worth explaining, because
 * it looks like a trick and is actually the model. Immunity is not a property of
 * a tower, it is a property of an applicant: The Keyword Stuffer carries
 * `immuneTo: ['keywordFilter']`, and `Tower.canTarget` asks whether its own key
 * is in that list. A filter running a list of terms nobody is gaming any more is
 * not the filter that was being gamed, so it stops being the thing the immunity
 * names and the stuffing stops working.
 *
 * The value has to be a key no applicant lists, which is every string that is
 * not one of the six tower keys. It reads as one here so that a later type
 * cannot be given immunity to it by accident.
 */
export const MOBILE_TOWER_KEY_UPDATED = 'keywordFilterRevised';

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
 * The arrivals themselves are not here. They are a wave list, in waves.js with
 * the other three, on the strength of the convention that wave definitions live
 * there.
 */
export const MOBILE_RUN = {
  towerHealth: 240,
  arrivalCost: 4,

  // The pause between intakes, and a longer one before the first. It is
  // currently dead time, because there is nothing in it: it exists because it
  // is where the upgrade cards go, and having the phase before having the thing
  // that fills it means the modal arrives as content rather than as structure.
  firstPrepMs: 3000,
  prepMs: 2200
};

/*
 * A NOTE, NOT A DEFINITION. Something the first run of this board threw up,
 * kept here because it is the sort of thing that gets rediscovered expensively
 * later and because it is the reason the card pool is shaped as it is.
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

/**
 * The shake when somebody gets in, matching the desktop board's leak exactly.
 *
 * Numbers rather than a call site literal, because they are feel rather than
 * logic and this file is where this board's feel lives. `services/feel.js` is
 * still what performs it, which is what keeps the reduced motion decision in the
 * one place that makes it.
 */
export const MOBILE_LEAK_SHAKE = { durationMs: 180, intensity: 0.005 };

/**
 * Turning a run into one number.
 *
 * The same three terms `GAME.scoring` has, because a run here is the same three
 * things: how deep it got, how much it screened, and how much of the vacancy's
 * patience was left at the end. What differs is the weights, and they differ for
 * a reason worth writing down rather than by taste.
 *
 * A classic run rejects something like seventy applicants. A run here rejects
 * around a hundred and forty, and a run that holds the vacancy rejects most of
 * the 235 the list sends. At classic's ten a rejection the rejection term would
 * swamp the other two and the score would become a count of how long the run
 * lasted. Four keeps it a term rather than the whole formula.
 *
 * ## Why the keys are classic's words and not this board's
 *
 * They used to be `perIntakeCleared` and `perTolerancePoint`, which is what the
 * two terms are actually called here, and it cost more than it was worth. The
 * leaderboard's ceiling is computed by one function for all four modes, and a
 * mode whose weights are spelled differently is a mode that function has to know
 * about by name. One vocabulary means it reads the weights off whichever mode it
 * was handed and never asks which one it is, which is the arrangement every
 * other field on a mode already has.
 *
 * So `perLifeRemaining` is reinterpreted rather than renamed: a life on this
 * board is a point of tower integrity, of which a run starts with 240 rather
 * than ten. The weight is two rather than forty for exactly that reason. The two
 * boards used to value an untouched defence at the same four hundred, which was
 * a coincidence and was noted here as one worth keeping; the tuning pass moved
 * the tolerance to 240 and it is 480 now. Nothing was lost with it, which is
 * what a coincidence being only a coincidence means. The term is still about a
 * fifth of a perfect run either way, and that proportion is the thing that
 * matters.
 *
 * It is scored against what is left rather than against a fraction of the
 * maximum, because Extend the deadline raises the maximum. A fraction would
 * quietly punish the card that makes the tower more durable.
 *
 * That the leaderboard reads these is why they are in config rather than in the
 * scene. `netlify/functions/lib/plausibility.js` recomputes the ceiling from the
 * same numbers the game plays with, and a ceiling built from hundreds of
 * rejections at classic's weight would be so large it stopped excluding
 * anything.
 */
export const MOBILE_SCORING = {
  perWaveCleared: 150,
  perRejection: 4,
  perLifeRemaining: 2
};

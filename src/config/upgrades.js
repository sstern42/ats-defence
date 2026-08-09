/**
 * The upgrade cards, for the phone board on issue #47. Plain data, no logic, so
 * the pool can be tuned without going near the modal that offers it or the loop
 * that applies it.
 *
 * Two are offered between intakes and one is taken. That choice is the whole of
 * what a player of this design does, so this file is the game's difficulty as
 * much as the wave list is.
 *
 * ## Why the ids matter more than they look
 *
 * They are a closed set, in the same arrangement `config/feedback.js` uses for
 * its answers and `config/modes.js` uses for its modes: read by the game to draw
 * the cards and, when the fifteenth event lands, by the collector to check one
 * before storing it. A set is only closed if the endpoint knows what the set is,
 * so the ids have to be stable data from the first commit rather than something
 * the modal invents. Renaming one later is a migration of sorts, since the
 * events already written will still be spelling the old one.
 *
 * ## Why the labels are not here
 *
 * They are copy, and they live in `content/copy.js` under these keys, the same
 * as towers, applicants and the survey answers.
 *
 * ## What shapes the pool
 *
 * The board has one tower, and running it turned up the thing that decides what
 * a card is worth. `Tower.findTarget` goes for whoever has least walking left,
 * so a type the tower cannot kill absorbs everything it fires while it is
 * closest, and there is no second tower to cover. Two of the six types are
 * therefore guaranteed arrivals: the Keyword Stuffer, which this tower cannot
 * touch at all, and the Career Changer, which it cannot kill in the time it has.
 * Between them they account for something like a third of the tower's 240
 * before anything is overwhelmed.
 *
 * So the pool is two cards that change what the tower can do and four that
 * change how well it does it. The first two were meant to be the decisions. The
 * other four were meant to be a slider, and to be the thing a decision is
 * measured against.
 *
 * ## That premise was measured in 1.7.0 and it is wrong
 *
 * Nothing here changed as a result, deliberately, and this is the note saying
 * why rather than a note saying it is fine.
 *
 * `tools/simulate-mobile.mjs --policy prefer:<id>` plays a few thousand runs
 * taking one named card whenever it is offered. Against a random baseline
 * holding the vacancy 7.9% of the time, the six come out:
 *
 *   panelReview        29.4%     the auto-take
 *   parallelScreening  13.5%
 *   higherBar           7.5%
 *   extendedDeadline    7.4%
 *   widerCriteria       3.4%     worse than not choosing
 *   keywordListUpdate   2.9%     worse than not choosing
 *
 * The two cards this file calls the decisions are the best card and the worst
 * card in the pool, and the worst one is worse than picking at random. Taking
 * the immunity off The Keyword Stuffer does not buy a kill, it moves the turret
 * onto a 120 health target ahead of the 40 health ones queueing behind it, which
 * is the note above arriving somewhere nobody thought to look for it. Widen the
 * criteria is weak for a duller reason: the ring is at 320 and the range starts
 * at 240, so the third one of these is bought and never used.
 *
 * Why it is being left alone. Every fix worth having is outside this file. The
 * card is bad because of what `findTarget` does, and that lives in `Tower.js`,
 * which three tuned modes depend on and which this mode has still never touched.
 * Making the stuffer cheaper to kill means editing `applicants.js`, which every
 * mode reads. Both are the "classic does not move" argument, and neither is a
 * thing to spend in passing on the release that opens the board.
 *
 * What can be done here is a redesign of what the two structural cards do, and
 * that is a design decision rather than a tuning one. It wants deciding on
 * purpose, with the numbers above in front of whoever decides it.
 *
 * ## Why they are weighted
 *
 * They were drawn flat, two from six, and a measured run showed that the draw
 * decided the run more than the wave list did. That run was never offered, or
 * never took, Update the keyword list, so thirteen Keyword Stuffers walked in
 * untouched for 65 of the tower's 260 and there was nothing to be done about it.
 *
 * Flat, a pair contains at least one of the two structural cards about six times
 * in ten. Weighted as below it is about nine, so the structural answer is nearly
 * always *available* and taking it is a decision rather than a gift from the
 * shuffle. That is the point: this design has one decision in it and it should
 * belong to the player rather than to the deck.
 *
 * The weights are deliberately not so high that a slider never appears. A card
 * pool where the good card is always obvious is the same non-decision as one
 * where it never turns up.
 *
 * A card that changes the targeting order itself would be the strongest of the
 * lot and is deliberately not here. `findTarget` lives in `Tower.js`, which
 * three tuned modes depend on and which this mode has so far not needed to touch
 * at all. That is worth more than one card, and it is a decision to take
 * knowingly rather than in passing.
 *
 * ## The shape of an effect
 *
 * `stat` names what moves and `add` is how far, or `set` replaces it outright.
 * Cards repeat, so `add` stacks: a second Broaden the criteria is another 45
 * pixels of reach. Which of them are stats on the tower and which are facts
 * about the run is the scene's business, not this file's.
 */
export const UPGRADES = [
  // The two that change what the tower can do.
  {
    id: 'keywordListUpdate',
    stat: 'beatsImmunity',
    set: true,
    weight: 4,

    // Taking it twice does nothing. `set` is not `add`, so a second one would be
    // a card that changes no number, offered against a card that does, which is
    // not a choice. Spent cards leave the pool.
    once: true
  },
  {
    // The third card the board did not show properly, and the only one it drew
    // in the wrong place: the splash was marked out by a ring around the desk,
    // which is where a splash never happens. It is drawn at the hit now, on
    // every shot rather than only the ones that catch somebody, and the
    // reasoning is in config/mobile.js at MOBILE_BURST. Nothing about the
    // number moved, so the 29.4% above still stands.
    id: 'panelReview',
    stat: 'splashRadius',
    add: 28,
    weight: 3
  },

  // The four that change how well it does it.
  {
    id: 'widerCriteria',
    stat: 'range',
    add: 32,
    weight: 1
  },
  {
    // The other card the board did not show, and the worse of the two, since a
    // shorter reload can at least be counted and a bigger number per shot
    // cannot be seen at all. A shot is drawn wider and warmer per raise now,
    // and the reasoning is in config/mobile.js at MOBILE_TRACER. Nothing about
    // the number moved: it is what a shot looks like, not what it does, so the
    // 7.5% above still stands.
    id: 'higherBar',
    stat: 'damage',
    add: 6,
    weight: 1
  },
  {
    // One of the two cards here whose effect the board did not show. It is
    // drawn now, as one tracer per screening running at once, and the reasoning
    // is in config/mobile.js at MOBILE_TRACER. Nothing about the number moved:
    // it is what a shot looks like, not what it does, so the 13.5% above still
    // stands.
    id: 'parallelScreening',
    stat: 'fireIntervalMs',
    add: -32,
    weight: 1
  },
  {
    id: 'extendedDeadline',
    stat: 'tolerance',
    add: 30,
    weight: 1
  }
];

/** How many are offered between intakes. The design says two and means it. */
export const UPGRADES_OFFERED = 2;

/**
 * The floor on the reload, so stacking Parallel screening cannot reach zero and
 * turn one tower into every tower. It is here rather than in the loop because it
 * is a balance number and this is where balance lives.
 */
export const MIN_FIRE_INTERVAL_MS = 90;

/** The card ids, for anything that needs to know what the set is. */
export const UPGRADE_IDS = UPGRADES.map((card) => card.id);

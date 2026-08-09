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
 * Between them they account for 85 of the tower's 200 before anything is
 * overwhelmed.
 *
 * So the pool is two cards that change what the tower can do and four that
 * change how well it does it. The first two are decisions. The other four are a
 * slider, and they are here to be the thing a decision is measured against.
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
    id: 'higherBar',
    stat: 'damage',
    add: 6,
    weight: 1
  },
  {
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

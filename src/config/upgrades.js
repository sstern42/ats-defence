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
    set: true
  },
  {
    id: 'panelReview',
    stat: 'splashRadius',
    add: 28
  },

  // The four that change how well it does it.
  {
    id: 'widerCriteria',
    stat: 'range',
    add: 32
  },
  {
    id: 'higherBar',
    stat: 'damage',
    add: 6
  },
  {
    id: 'parallelScreening',
    stat: 'fireIntervalMs',
    add: -32
  },
  {
    id: 'extendedDeadline',
    stat: 'tolerance',
    add: 30
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

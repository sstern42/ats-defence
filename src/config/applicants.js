/**
 * Applicant stats. Plain data, no logic, so balance can be tuned without
 * going anywhere near the game loop.
 *
 * `bounty` is what rejecting one pays back into the screening budget.
 *
 * How often an applicant turns up is a property of the wave, not of the type,
 * so it lives in waves.js.
 *
 * The optional fields are what makes a type awkward, and each one is read in
 * exactly one place:
 *
 * - `immuneTo` lists tower types that cannot touch it. Those towers do not
 *   even take aim, so nobody wastes a shot on it.
 * - `priorityFor` names a tower type that goes for it ahead of whoever is
 *   closest to the vacancy.
 * - `spawnProgress` starts it partway along the path, from 0 to 1.
 * - `returns` means it comes back once at the end of the wave, whether it was
 *   rejected or reached the vacancy.
 * - `pressure` is how hard it leans on a screening mechanism it walks past, in
 *   integrity per second. Only the open advert mode reads it, since that is the
 *   only mode where applicants push back at all, and how far they can reach is
 *   a property of that mode rather than of the type. A Referral does the most
 *   damage by a distance, which is the joke: it knows somebody.
 * - `caution` is how far out of its way it will go to avoid screening, and only
 *   the back channel reads it, since it is the only mode where anybody chooses
 *   where to walk. Zero is a straight line at the desk whatever is in the way.
 *   One means a cell covered by an average process is worth about one cell of
 *   walking to avoid, so the numbers below are read against each other rather
 *   than against anything absolute.
 *
 * Every type has a `pressure` even where it is small, because a Graduate on its
 * own is not a problem and forty of them standing round one desk is.
 *
 * Two fields are presentation, and they are here because the numbers next to
 * them already decide how the thing looks. `sprite` names the art, from the
 * manifest in art.js, and `colour` tints it and draws the health bar. The art
 * is greyscale so one sprite can serve more than one type. `radius` is what the
 * sprite is scaled to, as well as being where the health bar sits.
 */
export const APPLICANTS = {
  graduate: {
    health: 40,
    speed: 110,
    radius: 11,
    colour: 0xc7d94a,
    sprite: 'unit-round',
    bounty: 6,
    pressure: 6,
    // Applies to everything and reads nothing before it does, so it walks at
    // the desk in a straight line through whatever happens to be in the way.
    caution: 0
  },
  careerChanger: {
    health: 260,
    speed: 55,
    radius: 15,
    colour: 0x6a8fd9,
    sprite: 'vehicle-wide',
    bounty: 20,
    pressure: 12,
    caution: 0.5
  },
  overqualified: {
    health: 70,
    speed: 190,
    radius: 10,
    colour: 0xd9c46a,
    sprite: 'unit-finned',
    bounty: 12,
    priorityFor: 'knockoutQuestion',
    pressure: 8,
    // Has been through all of this before and can see it coming, which makes it
    // the hardest type to catch on a board it is allowed to choose its way
    // across. The Knockout Question still goes for it first, so the answer is
    // to make it walk somewhere it would rather not.
    caution: 1.3
  },
  keywordStuffer: {
    health: 120,
    speed: 95,
    radius: 12,
    colour: 0xd96a9b,
    sprite: 'unit-plain',
    bounty: 15,
    immuneTo: ['keywordFilter'],
    pressure: 11,
    // Minds the rest of the board as much as anybody, and walks straight
    // through a Keyword Filter's ground because a Keyword Filter has nothing to
    // say to it. The immunity was one line for the towers and it is the same
    // line here, which is the whole reason the routing reads it.
    caution: 1.1
  },
  referral: {
    health: 90,
    speed: 120,
    radius: 12,
    colour: 0x9b6ad9,
    sprite: 'unit-slim',
    bounty: 14,
    spawnProgress: 0.28,
    pressure: 26,
    // Knows somebody, so it uses the front door and barely looks at what is
    // stood beside it.
    caution: 0.2
  },
  boomerang: {
    health: 80,
    speed: 105,
    radius: 12,
    colour: 0x6ad9c4,
    sprite: 'vehicle-boxy',
    bounty: 11,
    returns: true,
    pressure: 12,
    caution: 0.9
  }
};

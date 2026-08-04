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
    bounty: 6
  },
  careerChanger: {
    health: 260,
    speed: 55,
    radius: 15,
    colour: 0x6a8fd9,
    sprite: 'vehicle-wide',
    bounty: 20
  },
  overqualified: {
    health: 70,
    speed: 190,
    radius: 10,
    colour: 0xd9c46a,
    sprite: 'unit-finned',
    bounty: 12,
    priorityFor: 'knockoutQuestion'
  },
  keywordStuffer: {
    health: 120,
    speed: 95,
    radius: 12,
    colour: 0xd96a9b,
    sprite: 'unit-plain',
    bounty: 15,
    immuneTo: ['keywordFilter']
  },
  referral: {
    health: 90,
    speed: 120,
    radius: 12,
    colour: 0x9b6ad9,
    sprite: 'unit-slim',
    bounty: 14,
    spawnProgress: 0.28
  },
  boomerang: {
    health: 80,
    speed: 105,
    radius: 12,
    colour: 0x6ad9c4,
    sprite: 'vehicle-boxy',
    bounty: 11,
    returns: true
  }
};

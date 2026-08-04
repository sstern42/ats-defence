/**
 * Tower stats. Plain data, no logic, so balance can be tuned without going
 * anywhere near the game loop.
 *
 * `behaviour` says which loop a tower belongs to. 'shoot' towers pick a target
 * and fire on a reload. 'slow' towers never fire, they just hold a field that
 * drags anything inside it down to `slowMultiplier` of its walking speed.
 * 'trap' is not a tower at all: it is laid on the path, waits, and goes off
 * once.
 *
 * A shooting tower does a flat `damage`, unless it has `damageMin` and
 * `damageMax`, in which case every hit is rolled between the two. `splashRadius`
 * spreads that hit to everyone standing near whoever was aimed at, and
 * `adjacencyBonus` is added to it while another tower is on a neighbouring
 * tile.
 *
 * Key order is the order the palette shows them in, which is also the order of
 * the number key shortcuts.
 *
 * `sprite` names the art, from the manifest in art.js. `base` is the body and
 * `barrel` is the part that turns, which the towers that do not shoot leave
 * out. The art is greyscale so that `bodyTint` can colour the body per type,
 * and the barrel is left alone, since a gun the colour of the thing it is
 * bolted to reads as one blob at this size.
 */
export const TOWERS = {
  keywordFilter: {
    behaviour: 'shoot',
    cost: 60,
    range: 150,
    damage: 12,
    fireIntervalMs: 380,
    footprint: 40,
    sprite: { base: 'tower-base', barrel: 'turret-twin' },
    bodyTint: 0x8fc4de,
    tracerColour: 0x8fc4de,
    tracerDurationMs: 90
  },
  knockoutQuestion: {
    // No damage figure, because there is no arguing with it. A hit takes
    // whatever health is left, which is what an instant rejection is.
    behaviour: 'shoot',
    instantReject: true,
    cost: 140,
    range: 130,
    fireIntervalMs: 3400,
    footprint: 40,
    sprite: { base: 'tower-base', barrel: 'turret-missile' },
    bodyTint: 0xd98a6a,
    tracerColour: 0xd98a6a,
    tracerDurationMs: 200
  },
  takeHomeTask: {
    behaviour: 'slow',
    cost: 90,
    range: 120,
    slowMultiplier: 0.4,
    footprint: 40,
    // A sensor rather than a gun, and it never turns, because this one does
    // not shoot anybody. The field ring is what says what it is doing.
    sprite: { base: 'tower-base', barrel: 'turret-sensor' },
    bodyTint: 0xc7d94a,
    fieldColour: 0xc7d94a
  },
  cultureFitPanel: {
    // The range of the roll is the point of it. A panel with no agreed
    // criteria is as likely to wave somebody through as to end them.
    behaviour: 'shoot',
    cost: 120,
    range: 135,
    damageMin: 4,
    damageMax: 46,
    splashRadius: 58,
    fireIntervalMs: 1500,
    footprint: 40,
    sprite: { base: 'tower-base', barrel: 'turret-rack' },
    bodyTint: 0xbf9ad9,
    tracerColour: 0xbf9ad9,
    tracerDurationMs: 140,
    burstDurationMs: 260
  },
  videoScreen: {
    behaviour: 'shoot',
    cost: 85,
    range: 145,
    damage: 7,
    adjacencyBonus: 13,
    fireIntervalMs: 700,
    footprint: 40,
    sprite: { base: 'tower-base', barrel: 'turret-dish' },
    bodyTint: 0x7fd9d0,
    tracerColour: 0x7fd9d0,
    tracerDurationMs: 110,
    linkColour: 0x7fd9d0
  },
  salaryExpectations: {
    // Free, because asking costs nothing. `maxArmed` is what stops the board
    // being paved with them.
    behaviour: 'trap',
    cost: 0,
    maxArmed: 1,
    triggerRadius: 34,
    damage: 140,
    footprint: 30,
    // No barrel, because a trap does not aim. It is a pad on the floor.
    sprite: { base: 'trap-pad' },
    bodyTint: 0xd9cf6a,
    fieldColour: 0xd9cf6a,
    burstDurationMs: 320
  }
};

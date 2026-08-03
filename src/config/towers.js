/**
 * Tower stats. Plain data, no logic, so balance can be tuned without going
 * anywhere near the game loop.
 *
 * `behaviour` says which loop a tower belongs to. 'shoot' towers pick a target
 * and fire on a reload. 'slow' towers never fire, they just hold a field that
 * drags anything inside it down to `slowMultiplier` of its walking speed.
 *
 * Key order is the order the palette shows them in, which is also the order of
 * the number key shortcuts. Three of the six exist at this step.
 */
export const TOWERS = {
  keywordFilter: {
    behaviour: 'shoot',
    cost: 60,
    range: 150,
    damage: 12,
    fireIntervalMs: 380,
    footprint: 40,
    barrelWidth: 8,
    baseColour: 0x39566b,
    trimColour: 0x8fc4de,
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
    barrelWidth: 13,
    baseColour: 0x6b3a4a,
    trimColour: 0xd98a6a,
    tracerColour: 0xd98a6a,
    tracerDurationMs: 200
  },
  takeHomeTask: {
    behaviour: 'slow',
    cost: 90,
    range: 120,
    slowMultiplier: 0.4,
    footprint: 40,
    baseColour: 0x4a5b39,
    trimColour: 0xc7d94a,
    fieldColour: 0xc7d94a
  }
};

/**
 * Tower stats. Plain data, no logic, so balance can be tuned without going
 * anywhere near the game loop.
 *
 * Only the Keyword Filter exists at this step. Cost is not here yet because
 * there is no currency to spend, so placement is free and unlimited.
 */
export const TOWERS = {
  keywordFilter: {
    range: 150,
    damage: 12,
    fireIntervalMs: 380,
    footprint: 40,
    baseColour: 0x39566b,
    trimColour: 0x8fc4de,
    tracerColour: 0x8fc4de,
    tracerDurationMs: 90
  }
};

/**
 * Run rules. Plain data, no logic, so balance can be tuned without going
 * anywhere near the game loop.
 *
 * Lives are the vacancy's tolerance for applicants who get past screening.
 * Run out and somebody gets hired, which for the player is a loss.
 *
 * Currency is the screening budget. It buys towers, and it comes back in as
 * applicants are rejected, since a rejection is the only thing this department
 * is measured on.
 *
 * The preparation times are the pause between waves. The first one is longer,
 * since nothing has been built yet and reading three tower descriptions takes
 * a moment. Both can be cut short.
 */
export const GAME = {
  startingLives: 10,
  livesPerLeak: 1,
  startingCurrency: 150,
  firstWavePrepMs: 15000,
  wavePrepMs: 9000
};

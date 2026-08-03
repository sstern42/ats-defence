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
 *
 * Scoring turns a run into one number, because the analytics and the
 * leaderboard both need one. It rewards getting deep, rejecting a lot and
 * holding on to the vacancy, in that order, which is roughly the order in which
 * those things are hard. Weighting it against waves reached also gives the
 * leaderboard function something to check a submitted score against.
 */
export const GAME = {
  startingLives: 10,
  livesPerLeak: 1,
  startingCurrency: 150,
  firstWavePrepMs: 15000,
  wavePrepMs: 9000,
  scoring: {
    perWaveCleared: 120,
    perRejection: 10,
    perLifeRemaining: 40
  }
};

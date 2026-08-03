/**
 * Run rules. Plain data, no logic, so balance can be tuned without going
 * anywhere near the game loop.
 *
 * Lives are the vacancy's tolerance for applicants who get past screening.
 * Run out and somebody gets hired, which for the player is a loss.
 */
export const GAME = {
  startingLives: 10,
  livesPerLeak: 1
};

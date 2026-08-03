/**
 * Applicant stats. Plain data, no logic, so balance can be tuned without
 * going anywhere near the game loop.
 *
 * Only The Graduate exists at this step. The other five arrive later, and
 * health is not here yet because nothing can deal damage.
 */
export const APPLICANTS = {
  graduate: {
    speed: 110,
    radius: 11,
    colour: 0xc7d94a,
    spawnIntervalMs: 1800
  }
};

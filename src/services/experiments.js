/**
 * Experiment assignments.
 *
 * There is one experiment, on starting difficulty, and the point of it is that
 * wave one is read from an assignment rather than hardcoded. That seam is built
 * here from step 7 so the wave data and the game loop never learn about it.
 *
 * GrowthBook is step 11. Until then this resolves the assignment locally: the
 * control arm, unless a `difficulty` query parameter says otherwise, which is
 * how the variant gets looked at on a deploy preview. When GrowthBook arrives
 * it replaces the body of `assign`, and nothing that calls this changes.
 */
import { WAVES, WAVE_ONE_VARIANTS } from '../config/waves.js';

const STARTING_DIFFICULTY = 'starting-difficulty';
const DEFAULT_ARM = 'control';

/**
 * Reads the arm for one experiment. Anything unrecognised falls back to the
 * control arm, so a mistyped query parameter plays the normal game rather than
 * a broken one.
 */
function assign(experiment) {
  if (experiment !== STARTING_DIFFICULTY) {
    return DEFAULT_ARM;
  }

  const requested = new URLSearchParams(window.location.search).get(
    'difficulty'
  );

  return WAVE_ONE_VARIANTS[requested] ? requested : DEFAULT_ARM;
}

/**
 * Every assignment for this run, in the shape the analytics spec wants as a
 * global property. Step 9 attaches it to events.
 */
export function getVariantAssignments() {
  return {
    [STARTING_DIFFICULTY]: assign(STARTING_DIFFICULTY)
  };
}

/**
 * The wave list for a run, with wave one taken from the assigned arm. Waves
 * two onwards are the same in both arms: the experiment is about how the game
 * opens, not how it goes on.
 */
export function resolveWaves() {
  const arm = assign(STARTING_DIFFICULTY);

  return WAVES.map((wave, index) => (index === 0 ? WAVE_ONE_VARIANTS[arm] : wave));
}

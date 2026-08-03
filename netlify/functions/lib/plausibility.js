/**
 * Whether a submitted score could have come from a real run.
 *
 * The client works the score out and the client cannot be trusted, so the
 * ceiling is recomputed here from the same wave and scoring data the game
 * plays from. That is the point of keeping balance in plain data: there is one
 * definition of how many applicants wave seven contains, and both the game and
 * this file read it.
 *
 * This does not prove a score is honest. A forged score inside the ceiling
 * still gets in. It rules out the ones that are obviously invented, which is
 * as far as a client-scored game can go without simulating the run server
 * side, and that is not worth building for a leaderboard nobody is paid to top.
 */
import { APPLICANTS } from '../../../src/config/applicants.js';
import { GAME } from '../../../src/config/game.js';
import { WAVE_ONE_VARIANTS, WAVES } from '../../../src/config/waves.js';

export const WAVE_COUNT = WAVES.length;

/**
 * Every applicant a wave sends. A type that comes back counts twice, since it
 * can be rejected on the way out and again on the way back.
 */
function rejectionsIn(wave) {
  return wave.groups.reduce((total, group) => {
    const returns = APPLICANTS[group.applicant]?.returns ? 2 : 1;

    return total + group.count * returns;
  }, 0);
}

/**
 * The busiest wave one across both arms of the experiment. Which arm a player
 * was in is not submitted, and taking the larger of the two is the safe way to
 * avoid rejecting an honest score from the busy arm.
 */
function busiestFirstWave() {
  return Object.values(WAVE_ONE_VARIANTS).reduce(
    (most, variant) => Math.max(most, rejectionsIn(variant)),
    0
  );
}

/**
 * The most a run that reached `finalWave` could possibly have scored: every
 * wave up to that point cleared, every applicant in them rejected, and not one
 * of them reaching the vacancy.
 *
 * Generous on purpose. A ceiling that rejects a good honest run is worse than
 * one that lets a mediocre forgery through.
 */
export function maximumScore(finalWave) {
  const { perWaveCleared, perRejection, perLifeRemaining } = GAME.scoring;

  let rejections = busiestFirstWave();

  for (let index = 1; index < finalWave; index += 1) {
    rejections += rejectionsIn(WAVES[index]);
  }

  return (
    finalWave * perWaveCleared +
    rejections * perRejection +
    GAME.startingLives * perLifeRemaining
  );
}

/**
 * Checks a submission. Returns null when it is fine, or a short reason when it
 * is not. The reason goes back to the client, so it says what is wrong without
 * saying what the ceiling is.
 */
export function checkScore({ score, finalWave }) {
  if (!Number.isInteger(score) || score < 0) {
    return 'score must be a whole number';
  }

  if (!Number.isInteger(finalWave) || finalWave < 1 || finalWave > WAVE_COUNT) {
    return 'final wave is not a wave in this game';
  }

  if (score > maximumScore(finalWave)) {
    return 'score is too high for the intake reached';
  }

  return null;
}

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
 *
 * The ceiling is per mode, because the modes send different numbers of
 * applicants and a single ceiling would have to be the higher of the two, which
 * would wave through a classic score half again as big as classic can produce.
 * The submission says which mode it came from, and the mode decides which wave
 * list the ceiling is computed from.
 */
import { APPLICANTS } from '../../../src/config/applicants.js';
import { MODES } from '../../../src/config/modes.js';
import { WAVE_ONE_VARIANTS } from '../../../src/config/waves.js';

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
 * The applicants a run reached this far could have rejected that no intake list
 * contains.
 *
 * There is exactly one such type and it is the Contractor, which turns up
 * unannounced from a given intake onwards on the boards whose mode says they
 * send it. It pays no bounty, but it is still an applicant that can be rejected
 * and the score still counts a rejection, so a ceiling computed from the wave
 * lists alone is a ceiling below what an honest run can score.
 *
 * That is the whole reason this exists. The ceiling is the perfect run, so an
 * arrival missing from it is not slack being tightened, it is a good player
 * being told their score is too high for the intake they reached.
 *
 * Read from the same data the game spawns them from, on the same terms
 * everything else here is: there is one definition of when a contractor turns
 * up, and both the game and this file read it.
 */
function contractsIn(mode, finalWave) {
  const unscheduled = APPLICANTS.contractor?.unscheduled;

  if (!mode.contractors || !unscheduled) {
    return 0;
  }

  const intakes = Math.max(0, finalWave - unscheduled.fromWave + 1);

  return intakes * unscheduled.perWave;
}

/**
 * The busiest opening wave a mode can send.
 *
 * For the mode carrying the starting difficulty experiment that is the larger
 * of the two arms, because which arm a player was in is not submitted and
 * taking the larger is the safe way to avoid rejecting an honest score from the
 * busy one. Every other mode simply has the wave one it has.
 */
function busiestFirstWave(mode) {
  if (!mode.experimentalFirstWave) {
    return rejectionsIn(mode.waves[0]);
  }

  return Object.values(WAVE_ONE_VARIANTS).reduce(
    (most, variant) => Math.max(most, rejectionsIn(variant)),
    0
  );
}

/**
 * How many waves a mode has, which is also the highest wave a submission from
 * it may claim.
 */
export function waveCount(modeKey) {
  return MODES[modeKey].waves.length;
}

/**
 * The most a run that reached `finalWave` in this mode could possibly have
 * scored: every wave up to that point cleared, every applicant in them
 * rejected, and not one of them reaching the vacancy.
 *
 * Generous on purpose. A ceiling that rejects a good honest run is worse than
 * one that lets a mediocre forgery through.
 */
export function maximumScore(finalWave, modeKey) {
  const mode = MODES[modeKey];

  // Off the mode rather than out of GAME, which is the whole of the fix and
  // the reason this comment is longer than the change.
  //
  // The weights used to be read globally, from the one mode that had any. That
  // was correct while every board was scored the same way and became silently
  // wrong the moment one was not. The phone board pays four a rejection over
  // 235 of them and forty times less for each of the 240 points of tolerance it
  // starts with; measured at classic's weights the ceiling comes out at 12,910
  // against a perfect run's 2,620, so there were ten thousand points of room to
  // invent a score in and still be waved through. The check was still running
  // and had stopped being a check.
  //
  // Read off the mode it comes out at 2,620 exactly, which is a perfect run and
  // nothing above one. That is tighter than the other three boards sit and it is
  // not a problem: the comparison is `>`, so the perfect run passes, and this
  // board has no experimental first wave to leave slack for.
  //
  // Both figures move whenever the phone wave list or its tolerance moves, since
  // both are computed from the same data the game plays from. They are quoted
  // here as of the tuning pass in 1.7.0 to show the size of the gap, not as
  // constants to keep in step.
  //
  // The three desktop modes point at the same GAME object they always did, so
  // this reads the identical numbers for them and no existing score changes
  // standing.
  const { perWaveCleared, perRejection, perLifeRemaining } = mode.scoring;

  let rejections = busiestFirstWave(mode);

  for (let index = 1; index < finalWave; index += 1) {
    rejections += rejectionsIn(mode.waves[index]);
  }

  rejections += contractsIn(mode, finalWave);

  return (
    finalWave * perWaveCleared +
    rejections * perRejection +
    mode.startingLives * perLifeRemaining
  );
}

/**
 * Checks a submission. Returns null when it is fine, or a short reason when it
 * is not. The reason goes back to the client, so it says what is wrong without
 * saying what the ceiling is.
 *
 * The mode is checked first, because everything after it is measured against
 * that mode's wave list and an unknown one has nothing to measure against.
 */
export function checkScore({ score, finalWave, mode }) {
  if (typeof mode !== 'string' || !MODES[mode]) {
    return 'that is not a mode of this game';
  }

  if (!Number.isInteger(score) || score < 0) {
    return 'score must be a whole number';
  }

  if (
    !Number.isInteger(finalWave) ||
    finalWave < 1 ||
    finalWave > waveCount(mode)
  ) {
    return 'final wave is not a wave in this game';
  }

  if (score > maximumScore(finalWave, mode)) {
    return 'score is too high for the intake reached';
  }

  return null;
}

/**
 * Wave definitions. Plain data, no logic, so balance can be tuned without
 * going anywhere near the game loop.
 *
 * A wave is a list of groups and the budget it pays out once it is screened.
 * A group is a run of one applicant type: `count` of them, `intervalMs` apart,
 * starting `delayMs` after the wave opens. Two groups with different delays is
 * how a wave gets a lull and then a second push.
 *
 * Only The Graduate exists at this step, so the waves escalate by count and by
 * how fast they arrive. Step 8 adds the other five types and they get mixed in
 * here, which is a data change and nothing else.
 */

/**
 * Wave one, in both arms of the starting difficulty experiment. Control opens
 * gently. The variant has the intake already busy before the player has
 * finished reading the palette.
 *
 * Which arm is used is decided at run start by services/experiments.js, never
 * here, since the whole point of the experiment is that it is not hardcoded.
 */
export const WAVE_ONE_VARIANTS = {
  control: {
    reward: 30,
    groups: [{ applicant: 'graduate', count: 5, intervalMs: 1600, delayMs: 0 }]
  },
  busy: {
    reward: 30,
    groups: [
      { applicant: 'graduate', count: 9, intervalMs: 900, delayMs: 0 },
      { applicant: 'graduate', count: 5, intervalMs: 700, delayMs: 7000 }
    ]
  }
};

export const WAVES = [
  // Wave one is swapped for the assigned arm at run start. The control arm
  // sits here so the list reads as ten waves and so anything reading the data
  // without an assignment still gets a sensible run.
  WAVE_ONE_VARIANTS.control,
  {
    reward: 35,
    groups: [{ applicant: 'graduate', count: 7, intervalMs: 1400, delayMs: 0 }]
  },
  {
    reward: 40,
    groups: [
      { applicant: 'graduate', count: 9, intervalMs: 1200, delayMs: 0 },
      { applicant: 'graduate', count: 4, intervalMs: 900, delayMs: 8000 }
    ]
  },
  {
    reward: 45,
    groups: [
      { applicant: 'graduate', count: 10, intervalMs: 1100, delayMs: 0 },
      { applicant: 'graduate', count: 6, intervalMs: 800, delayMs: 9000 }
    ]
  },
  {
    reward: 50,
    groups: [
      { applicant: 'graduate', count: 12, intervalMs: 1000, delayMs: 0 },
      { applicant: 'graduate', count: 8, intervalMs: 700, delayMs: 9000 }
    ]
  },
  {
    reward: 55,
    groups: [
      { applicant: 'graduate', count: 14, intervalMs: 950, delayMs: 0 },
      { applicant: 'graduate', count: 8, intervalMs: 700, delayMs: 8000 }
    ]
  },
  {
    reward: 60,
    groups: [
      { applicant: 'graduate', count: 16, intervalMs: 900, delayMs: 0 },
      { applicant: 'graduate', count: 10, intervalMs: 650, delayMs: 9000 }
    ]
  },
  {
    reward: 65,
    groups: [
      { applicant: 'graduate', count: 18, intervalMs: 850, delayMs: 0 },
      { applicant: 'graduate', count: 12, intervalMs: 600, delayMs: 9000 }
    ]
  },
  {
    reward: 70,
    groups: [
      { applicant: 'graduate', count: 20, intervalMs: 800, delayMs: 0 },
      { applicant: 'graduate', count: 14, intervalMs: 550, delayMs: 9000 }
    ]
  },
  {
    reward: 80,
    groups: [
      { applicant: 'graduate', count: 24, intervalMs: 750, delayMs: 0 },
      { applicant: 'graduate', count: 18, intervalMs: 500, delayMs: 10000 }
    ]
  }
];

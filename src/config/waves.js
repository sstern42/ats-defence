/**
 * Wave definitions. Plain data, no logic, so balance can be tuned without
 * going anywhere near the game loop.
 *
 * A wave is a list of groups and the budget it pays out once it is screened.
 * A group is a run of one applicant type: `count` of them, `intervalMs` apart,
 * starting `delayMs` after the wave opens. Two groups with different delays is
 * how a wave gets a lull and then a second push.
 *
 * All six types exist now. A type is introduced on its own before it turns up
 * in a crowd, so the first Career Changer is met while there is still time to
 * work out what it is.
 */

/**
 * Wave one, in both arms of the starting difficulty experiment. Control opens
 * gently. The variant has the intake already busy before the player has
 * finished reading the palette.
 *
 * Both arms are Graduates only. The experiment is about how much arrives, not
 * about what does, so nothing else varies between them.
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
    groups: [
      { applicant: 'graduate', count: 7, intervalMs: 1400, delayMs: 0 },
      { applicant: 'careerChanger', count: 1, intervalMs: 0, delayMs: 6000 }
    ]
  },
  {
    reward: 40,
    groups: [
      { applicant: 'graduate', count: 9, intervalMs: 1200, delayMs: 0 },
      { applicant: 'overqualified', count: 2, intervalMs: 2600, delayMs: 5000 },
      { applicant: 'careerChanger', count: 2, intervalMs: 3200, delayMs: 9000 }
    ]
  },
  {
    reward: 45,
    groups: [
      { applicant: 'graduate', count: 10, intervalMs: 1100, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 2, intervalMs: 2800, delayMs: 4500 },
      { applicant: 'overqualified', count: 3, intervalMs: 2200, delayMs: 10000 }
    ]
  },
  {
    reward: 50,
    groups: [
      { applicant: 'graduate', count: 10, intervalMs: 1000, delayMs: 0 },
      { applicant: 'referral', count: 2, intervalMs: 3000, delayMs: 5000 },
      { applicant: 'careerChanger', count: 3, intervalMs: 2600, delayMs: 9000 },
      { applicant: 'keywordStuffer', count: 3, intervalMs: 2200, delayMs: 13000 }
    ]
  },
  {
    reward: 55,
    groups: [
      { applicant: 'graduate', count: 12, intervalMs: 950, delayMs: 0 },
      { applicant: 'boomerang', count: 3, intervalMs: 2400, delayMs: 4000 },
      { applicant: 'overqualified', count: 4, intervalMs: 1800, delayMs: 10000 }
    ]
  },
  {
    reward: 60,
    groups: [
      { applicant: 'graduate', count: 14, intervalMs: 900, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 4, intervalMs: 2000, delayMs: 3500 },
      { applicant: 'referral', count: 3, intervalMs: 2600, delayMs: 9000 },
      { applicant: 'careerChanger', count: 4, intervalMs: 2400, delayMs: 12000 }
    ]
  },
  {
    reward: 65,
    groups: [
      { applicant: 'graduate', count: 16, intervalMs: 850, delayMs: 0 },
      { applicant: 'boomerang', count: 5, intervalMs: 1900, delayMs: 4000 },
      { applicant: 'overqualified', count: 5, intervalMs: 1500, delayMs: 9000 },
      { applicant: 'keywordStuffer', count: 5, intervalMs: 1800, delayMs: 13000 }
    ]
  },
  {
    reward: 70,
    groups: [
      { applicant: 'graduate', count: 18, intervalMs: 800, delayMs: 0 },
      { applicant: 'careerChanger', count: 6, intervalMs: 2000, delayMs: 3000 },
      { applicant: 'referral', count: 5, intervalMs: 1800, delayMs: 8000 },
      { applicant: 'boomerang', count: 6, intervalMs: 1600, delayMs: 12000 }
    ]
  },
  {
    reward: 80,
    groups: [
      { applicant: 'graduate', count: 20, intervalMs: 750, delayMs: 0 },
      { applicant: 'overqualified', count: 6, intervalMs: 1400, delayMs: 3000 },
      { applicant: 'keywordStuffer', count: 6, intervalMs: 1600, delayMs: 7000 },
      { applicant: 'careerChanger', count: 6, intervalMs: 1800, delayMs: 11000 },
      { applicant: 'referral', count: 5, intervalMs: 1500, delayMs: 15000 },
      { applicant: 'boomerang', count: 6, intervalMs: 1400, delayMs: 18000 }
    ]
  }
];

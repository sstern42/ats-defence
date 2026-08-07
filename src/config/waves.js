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
  //
  // Wave one is deliberately untouched by the balancing pass. It is the unit
  // the starting difficulty experiment varies, and retuning it would make the
  // two arms incomparable.
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
    reward: 40,
    groups: [
      { applicant: 'graduate', count: 10, intervalMs: 1100, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 3, intervalMs: 2800, delayMs: 4500 },
      { applicant: 'careerChanger', count: 1, intervalMs: 0, delayMs: 7000 },
      { applicant: 'overqualified', count: 3, intervalMs: 2200, delayMs: 10000 }
    ]
  },
  {
    reward: 45,
    groups: [
      { applicant: 'graduate', count: 10, intervalMs: 1000, delayMs: 0 },
      { applicant: 'referral', count: 2, intervalMs: 3000, delayMs: 5000 },
      { applicant: 'careerChanger', count: 3, intervalMs: 2600, delayMs: 9000 },
      { applicant: 'keywordStuffer', count: 3, intervalMs: 2200, delayMs: 13000 }
    ]
  },
  {
    reward: 45,
    groups: [
      { applicant: 'graduate', count: 12, intervalMs: 950, delayMs: 0 },
      { applicant: 'boomerang', count: 3, intervalMs: 2400, delayMs: 4000 },
      { applicant: 'careerChanger', count: 3, intervalMs: 2800, delayMs: 7500 },
      { applicant: 'overqualified', count: 5, intervalMs: 1800, delayMs: 12000 }
    ]
  },
  {
    reward: 50,
    groups: [
      { applicant: 'graduate', count: 14, intervalMs: 900, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 5, intervalMs: 1900, delayMs: 3500 },
      { applicant: 'referral', count: 3, intervalMs: 2600, delayMs: 9000 },
      { applicant: 'careerChanger', count: 6, intervalMs: 2200, delayMs: 12000 }
    ]
  },
  {
    reward: 50,
    groups: [
      { applicant: 'graduate', count: 16, intervalMs: 850, delayMs: 0 },
      { applicant: 'boomerang', count: 5, intervalMs: 1900, delayMs: 4000 },
      { applicant: 'careerChanger', count: 6, intervalMs: 2200, delayMs: 8000 },
      { applicant: 'overqualified', count: 5, intervalMs: 1500, delayMs: 11000 },
      { applicant: 'keywordStuffer', count: 9, intervalMs: 1500, delayMs: 13000 }
    ]
  },
  {
    reward: 55,
    groups: [
      { applicant: 'graduate', count: 18, intervalMs: 800, delayMs: 0 },
      { applicant: 'careerChanger', count: 8, intervalMs: 1900, delayMs: 3000 },
      { applicant: 'referral', count: 5, intervalMs: 1800, delayMs: 9000 },
      { applicant: 'boomerang', count: 6, intervalMs: 1600, delayMs: 13000 },
      { applicant: 'keywordStuffer', count: 8, intervalMs: 1500, delayMs: 6000 }
    ]
  },
  {
    reward: 60,
    groups: [
      { applicant: 'graduate', count: 20, intervalMs: 750, delayMs: 0 },
      { applicant: 'overqualified', count: 6, intervalMs: 1400, delayMs: 3000 },
      { applicant: 'keywordStuffer', count: 12, intervalMs: 1300, delayMs: 6000 },
      { applicant: 'careerChanger', count: 10, intervalMs: 1500, delayMs: 10000 },
      { applicant: 'referral', count: 5, intervalMs: 1500, delayMs: 15000 },
      { applicant: 'boomerang', count: 6, intervalMs: 1400, delayMs: 18000 }
    ]
  }
];

/**
 * The open advert intakes. Same shape, same types, bigger numbers.
 *
 * A second list rather than a multiplier on the first, because a multiplier is
 * a number in the game loop and this project keeps balance in data. It also
 * has to be its own list on the merits: the crowd arrives spread across most of
 * the board, so a tower sees a fraction of what walks past it and the counts
 * that make the classic path tense make this one empty.
 *
 * The rewards are higher for the same reason. Covering a front costs more
 * towers than covering a corridor, and a budget tuned for one will not buy the
 * other. Nothing here is touched by the starting difficulty experiment, which
 * varies classic wave one and only classic wave one.
 *
 * This is a first pass. The classic list took a whole balancing phase to settle
 * and this one has not had it yet, which is what the data being data is for.
 */
export const OPEN_FIELD_WAVES = [
  {
    reward: 50,
    groups: [{ applicant: 'graduate', count: 12, intervalMs: 1000, delayMs: 0 }]
  },
  {
    reward: 55,
    groups: [
      { applicant: 'graduate', count: 14, intervalMs: 950, delayMs: 0 },
      { applicant: 'careerChanger', count: 2, intervalMs: 2600, delayMs: 6000 }
    ]
  },
  {
    reward: 60,
    groups: [
      { applicant: 'graduate', count: 16, intervalMs: 900, delayMs: 0 },
      { applicant: 'overqualified', count: 4, intervalMs: 2000, delayMs: 5000 },
      { applicant: 'careerChanger', count: 3, intervalMs: 2600, delayMs: 9000 }
    ]
  },
  {
    reward: 65,
    groups: [
      { applicant: 'graduate', count: 18, intervalMs: 850, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 5, intervalMs: 2200, delayMs: 4500 },
      { applicant: 'careerChanger', count: 3, intervalMs: 2800, delayMs: 7000 },
      { applicant: 'overqualified', count: 5, intervalMs: 1800, delayMs: 10000 }
    ]
  },
  {
    reward: 70,
    groups: [
      { applicant: 'graduate', count: 18, intervalMs: 800, delayMs: 0 },
      { applicant: 'referral', count: 4, intervalMs: 2400, delayMs: 5000 },
      { applicant: 'careerChanger', count: 5, intervalMs: 2200, delayMs: 9000 },
      { applicant: 'keywordStuffer', count: 5, intervalMs: 1900, delayMs: 13000 }
    ]
  },
  {
    reward: 75,
    groups: [
      { applicant: 'graduate', count: 20, intervalMs: 780, delayMs: 0 },
      { applicant: 'boomerang', count: 5, intervalMs: 2000, delayMs: 4000 },
      { applicant: 'careerChanger', count: 5, intervalMs: 2400, delayMs: 7500 },
      { applicant: 'overqualified', count: 7, intervalMs: 1600, delayMs: 12000 }
    ]
  },
  {
    reward: 80,
    groups: [
      { applicant: 'graduate', count: 22, intervalMs: 750, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 8, intervalMs: 1600, delayMs: 3500 },
      { applicant: 'referral', count: 5, intervalMs: 2200, delayMs: 9000 },
      { applicant: 'careerChanger', count: 8, intervalMs: 1900, delayMs: 12000 }
    ]
  },
  {
    reward: 85,
    groups: [
      { applicant: 'graduate', count: 24, intervalMs: 720, delayMs: 0 },
      { applicant: 'boomerang', count: 7, intervalMs: 1700, delayMs: 4000 },
      { applicant: 'careerChanger', count: 8, intervalMs: 1900, delayMs: 8000 },
      { applicant: 'overqualified', count: 8, intervalMs: 1300, delayMs: 11000 },
      { applicant: 'keywordStuffer', count: 11, intervalMs: 1300, delayMs: 13000 }
    ]
  },
  {
    reward: 90,
    groups: [
      { applicant: 'graduate', count: 26, intervalMs: 700, delayMs: 0 },
      { applicant: 'careerChanger', count: 10, intervalMs: 1700, delayMs: 3000 },
      { applicant: 'keywordStuffer', count: 10, intervalMs: 1300, delayMs: 6000 },
      { applicant: 'referral', count: 7, intervalMs: 1600, delayMs: 9000 },
      { applicant: 'boomerang', count: 9, intervalMs: 1400, delayMs: 13000 }
    ]
  },
  {
    reward: 100,
    groups: [
      { applicant: 'graduate', count: 30, intervalMs: 650, delayMs: 0 },
      { applicant: 'overqualified', count: 9, intervalMs: 1200, delayMs: 3000 },
      { applicant: 'keywordStuffer', count: 15, intervalMs: 1100, delayMs: 6000 },
      { applicant: 'careerChanger', count: 13, intervalMs: 1300, delayMs: 10000 },
      { applicant: 'referral', count: 7, intervalMs: 1300, delayMs: 15000 },
      { applicant: 'boomerang', count: 9, intervalMs: 1200, delayMs: 18000 }
    ]
  }
];

/**
 * The back channel intakes.
 *
 * A third list rather than a shared one, on the same grounds the second one
 * was: a multiplier would be a number in the game loop, and the board is
 * different enough that the counts do not transfer anyway. They arrive across
 * the left edge like the open advert crowd, so a corridor's counts would leave
 * it empty, but they converge on whatever route is cheapest rather than
 * covering the whole front, so an open advert wave puts more through a single
 * tower than that mode ever intended. It sits between the two, which is what
 * the numbers below do.
 *
 * A first pass, and less settled than either of the others, because the thing
 * being balanced is not how much arrives but how much a player can make the
 * cheapest way in cost. Nothing here is touched by the starting difficulty
 * experiment, which varies classic wave one and only classic wave one.
 */
export const BACK_CHANNEL_WAVES = [
  {
    reward: 45,
    groups: [{ applicant: 'graduate', count: 9, intervalMs: 1100, delayMs: 0 }]
  },
  {
    reward: 50,
    groups: [
      { applicant: 'graduate', count: 11, intervalMs: 1000, delayMs: 0 },
      { applicant: 'careerChanger', count: 2, intervalMs: 2600, delayMs: 6000 }
    ]
  },
  {
    reward: 55,
    groups: [
      { applicant: 'graduate', count: 13, intervalMs: 950, delayMs: 0 },
      { applicant: 'overqualified', count: 3, intervalMs: 2200, delayMs: 5000 },
      { applicant: 'careerChanger', count: 2, intervalMs: 2800, delayMs: 9000 }
    ]
  },
  {
    reward: 60,
    groups: [
      { applicant: 'graduate', count: 14, intervalMs: 900, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 4, intervalMs: 2200, delayMs: 4500 },
      { applicant: 'careerChanger', count: 2, intervalMs: 2800, delayMs: 7000 },
      { applicant: 'overqualified', count: 4, intervalMs: 1900, delayMs: 10000 }
    ]
  },
  {
    reward: 65,
    groups: [
      { applicant: 'graduate', count: 15, intervalMs: 850, delayMs: 0 },
      { applicant: 'referral', count: 3, intervalMs: 2600, delayMs: 5000 },
      { applicant: 'careerChanger', count: 4, intervalMs: 2400, delayMs: 9000 },
      { applicant: 'keywordStuffer', count: 4, intervalMs: 2000, delayMs: 13000 }
    ]
  },
  {
    reward: 70,
    groups: [
      { applicant: 'graduate', count: 16, intervalMs: 820, delayMs: 0 },
      { applicant: 'boomerang', count: 4, intervalMs: 2200, delayMs: 4000 },
      { applicant: 'careerChanger', count: 4, intervalMs: 2500, delayMs: 7500 },
      { applicant: 'overqualified', count: 6, intervalMs: 1700, delayMs: 12000 }
    ]
  },
  {
    reward: 75,
    groups: [
      { applicant: 'graduate', count: 18, intervalMs: 780, delayMs: 0 },
      { applicant: 'keywordStuffer', count: 6, intervalMs: 1800, delayMs: 3500 },
      { applicant: 'referral', count: 4, intervalMs: 2400, delayMs: 9000 },
      { applicant: 'careerChanger', count: 6, intervalMs: 2000, delayMs: 12000 }
    ]
  },
  {
    reward: 80,
    groups: [
      { applicant: 'graduate', count: 20, intervalMs: 750, delayMs: 0 },
      { applicant: 'boomerang', count: 6, intervalMs: 1800, delayMs: 4000 },
      { applicant: 'careerChanger', count: 7, intervalMs: 2000, delayMs: 8000 },
      { applicant: 'overqualified', count: 7, intervalMs: 1400, delayMs: 11000 },
      { applicant: 'keywordStuffer', count: 9, intervalMs: 1400, delayMs: 13000 }
    ]
  },
  {
    reward: 85,
    groups: [
      { applicant: 'graduate', count: 22, intervalMs: 720, delayMs: 0 },
      { applicant: 'careerChanger', count: 9, intervalMs: 1800, delayMs: 3000 },
      { applicant: 'keywordStuffer', count: 9, intervalMs: 1400, delayMs: 6000 },
      { applicant: 'referral', count: 6, intervalMs: 1700, delayMs: 9000 },
      { applicant: 'boomerang', count: 7, intervalMs: 1500, delayMs: 13000 }
    ]
  },
  {
    reward: 95,
    groups: [
      { applicant: 'graduate', count: 26, intervalMs: 680, delayMs: 0 },
      { applicant: 'overqualified', count: 8, intervalMs: 1300, delayMs: 3000 },
      { applicant: 'keywordStuffer', count: 13, intervalMs: 1200, delayMs: 6000 },
      { applicant: 'careerChanger', count: 11, intervalMs: 1400, delayMs: 10000 },
      { applicant: 'referral', count: 6, intervalMs: 1400, delayMs: 15000 },
      { applicant: 'boomerang', count: 8, intervalMs: 1300, delayMs: 18000 }
    ]
  }
];

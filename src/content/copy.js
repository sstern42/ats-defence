/**
 * Every user-facing string lives here, so the tone can be edited in one place
 * without reading any game logic.
 */
export const COPY = {
  applicants: {
    graduate: {
      name: 'The Graduate',
      trait: 'Arrives in numbers. Folds quickly.'
    },
    careerChanger: {
      name: 'The Career Changer',
      trait: 'Slow, and takes a great deal of rejecting.'
    },
    overqualified: {
      name: 'The Overqualified',
      trait: 'Quick. Knockout Questions go for it first.'
    },
    keywordStuffer: {
      name: 'The Keyword Stuffer',
      trait: 'Every keyword, twice. The Keyword Filter has nothing to say.'
    },
    referral: {
      name: 'The Referral',
      trait: 'Knows somebody. Starts halfway down the path.'
    },
    boomerang: {
      name: 'The Boomerang',
      trait: 'Applies again at the end of the intake. Every time.'
    }
  },
  towers: {
    keywordFilter: {
      name: 'Keyword Filter',
      blurb: 'Cheap and quick. It does not read, it matches.'
    },
    knockoutQuestion: {
      name: 'Knockout Question',
      blurb: 'One question, one wrong answer, one rejection. Reloads slowly.'
    },
    takeHomeTask: {
      name: 'Take-Home Task',
      blurb: 'Harms nobody. Anyone in range slows to a crawl for a fortnight.'
    },
    cultureFitPanel: {
      name: 'Culture Fit Panel',
      blurb: 'A room, four opinions and no agreed criteria. Hits everyone standing nearby, for whatever it feels like.'
    },
    videoScreen: {
      name: 'Video Screen',
      blurb: 'Records answers nobody watches. Considerably better with another process next to it.'
    },
    salaryExpectations: {
      name: 'Salary Expectations',
      blurb: 'Free to ask, and asked once. Goes on the path itself, one at a time, and not again straight away.'
    }
  },
  home: {
    title: 'ATS Defence',
    subtitle: 'You are Requisita, an applicant tracking system.',
    body: 'One vacancy, and a great many people walking towards it. Install screening along the way and reject them before one of them reaches a human, who might read it properly and hire them.',
    start: 'Open the vacancy',
    startHint: 'or press space',
    howToHeading: 'How the screening works',
    howTo: [
      'Click a free tile to install a screening process.',
      'Keys 1 to 6 pick which one, and the budget decides the rest.',
      'Salary Expectations goes on the path itself, and only once.',
      'Space opens each intake early, if you are ready for it.'
    ],
    // The same four for a screen with no keys to name. The gesture is
    // described instead of a click, the palette stands in for the number keys,
    // and the last line reports that the intake opens on its own rather than
    // offering a way to hurry it that is not there without a space bar.
    //
    // Each has to hold one line at the width the list is drawn at, since the
    // lines are laid out on a fixed gap and a wrapped one runs into the next.
    howToTouch: [
      'Press a free tile, slide to aim, then lift to install.',
      'The six along the top pick which one, budget permitting.',
      'Salary Expectations goes on the path itself, and only once.',
      'Each intake opens on its own once the countdown runs out.'
    ]
  },
  hints: {
    placeTower: 'Click a free tile to install.',
    selectTower: 'Keys 1 to 6 also pick.',
    skipPrep: 'Space opens the intake early.',
    layTrap: 'Click the path itself to set it.',
    // Said instead of the two above where there is no mouse to click with. The
    // preview sits above the finger rather than under it, so the instruction
    // has to mention lifting, otherwise a player presses, sees the tower
    // hovering somewhere else and lets go in the wrong place.
    placeTowerTouch: 'Press a free tile, slide to aim, lift to install.',
    layTrapTouch: 'Press the path itself, slide to aim, lift to set it.'
  },
  hud: {
    lives: 'Vacancy integrity',
    currency: 'Budget',
    free: 'free',
    shortfall: 'The budget will not stretch to that.',
    trapArmed: 'One set of salary expectations at a time.',
    // The seconds left are added on after, so the wait is a number rather than
    // a mystery.
    trapWaiting: 'Salary bands under review, ready in',
    wave: 'Intake',
    waveOf: 'of',
    waveOpensIn: 'opens in',
    soundOn: 'M. Sound on',
    soundOff: 'M. Sound off',
    pause: 'Esc. Pause',
    // The same three with the key taken off the front. Both controls are
    // tapped either way, so only the shortcut goes.
    soundOnTouch: 'Sound on',
    soundOffTouch: 'Sound off',
    pauseTouch: 'Pause'
  },
  pause: {
    title: 'Screening on hold',
    body: 'The board is held where it is and nobody is being processed. Requisita has stepped away from the desk, which is within policy.',
    resume: 'Back to screening',
    restart: 'Repost the vacancy',
    restartNote: 'Starts again at the first intake. This run stops here, unrated.',
    exit: 'Close the vacancy',
    exitNote: 'Back to the front page. This run stops here, unrated.',
    hint: 'Esc also goes back to the board.'
  },
  board: {
    leak: 'Reached a human',
    waveIncoming: 'Applications open',
    waveCleared: 'Intake screened',
    budgetAdded: 'added to the budget',
    reapplying: 'Reapplying',
    reapplyingNote: 'Some of them are back'
  },
  gameOver: {
    filled: {
      title: 'Position filled',
      body: 'Enough applicants got past screening that somebody read one properly and hired them. Requisita has been invited to a review meeting.'
    },
    survived: {
      title: 'Vacancy withdrawn',
      body: 'Every intake screened and the vacancy is still open. It has been withdrawn pending a review of whether it was needed in the first place. Requisita is recording this as a success.'
    },
    waveLabel: 'Intake reached',
    rejectedLabel: 'Applicants rejected',
    scoreLabel: 'Efficiency rating',
    restart: 'Reopen the vacancy',
    restartHint: 'or press space'
  },
  kofi: {
    link: 'Requisita cannot be bribed. The developer can.'
  },
  credit: {
    link: 'A project by spencerstern.com',
    // {year} is filled in from the clock when the footer is drawn, so nobody
    // has to remember to come back and edit this every January.
    copyright: '© {year} Spencer Stern'
  },
  unsupported: {
    title: 'Not on a phone, for now',
    body: 'The board wants more room than this. Rather than serve you something broken, Requisita has decided this application does not meet the essential criteria.',
    note: 'Come back on a tablet or a laptop.'
  },
  leaderboard: {
    heading: 'Best screeners',
    loading: 'Asking the board.',
    unavailable: 'The board is not answering. Your run still counted.',
    unavailableHome: 'The board is not answering. The vacancy is open regardless.',
    empty: 'Nobody on it yet. The vacancy is wide open.',
    namePrompt: 'Name for the board',
    namePlaceholder: 'type a name',
    submit: 'Submit',
    submitting: 'Filing it.',
    submitted: 'Filed.',
    columnRank: '#',
    columnName: 'Name',
    columnWave: 'Intake',
    columnScore: 'Rating',
    typingHint: 'Enter submits. Sixteen characters, and be nice.',
    emptyHint: 'Type a name to go on the board, or press space to start again.',
    // Said where there is no keyboard to type a name with. The board is still
    // shown, the run still counted, and the restart button is still a button.
    // Only the filing is off the table, and the joke writes itself.
    emptyHintTouch: 'The board takes written applications only. Yours cannot be filed from here.',
    doneHint: 'Press space to reopen the vacancy.'
  }
};

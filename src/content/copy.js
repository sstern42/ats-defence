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
    howToHeading: 'How the screening works'
  },
  /**
   * The three ways to run a vacancy.
   *
   * `name` is the tab and the banner title, `blurb` sits under the tabs on the
   * front page, and `banner` is the line the board opens with. The how-to lists
   * are per mode because two of the four lines are not true in all three, and a
   * list that quietly describes one of the other games is worse than one that
   * repeats itself.
   *
   * Two things here have to fit rather than only read well, because the front
   * page is laid out on fixed positions rather than on how much text turns up.
   *
   * A `blurb` gets two lines, between the tabs and the start button. There is
   * no third line: a blurb that needs one is drawn underneath the button rather
   * than being pushed clear of it.
   *
   * Every how-to line has to hold one line at the width the list is drawn at,
   * since the lines are laid out on a fixed gap and a wrapped one runs into the
   * one below it.
   */
  modes: {
    classic: {
      name: 'Classic intake',
      blurb: 'One path in, and they walk it in single file. The process working exactly as designed.',
      banner: 'One queue, one desk, business as usual',
      board: 'Best screeners, classic intake',
      howTo: [
        'Click a free tile to install a screening process.',
        'Keys 1 to 6 pick which one, and the budget decides the rest.',
        'Salary Expectations goes on the path itself, and only once.',
        'Space opens each intake early, if you are ready for it.'
      ],
      // The same four for a screen with no keys to name. The gesture is
      // described instead of a click, the palette stands in for the number
      // keys, and the last line reports that the intake opens on its own rather
      // than offering a way to hurry it that is not there without a space bar.
      howToTouch: [
        'Press a free tile, slide to aim, then lift to install.',
        'The six along the top pick which one, budget permitting.',
        'Salary Expectations goes on the path itself, and only once.',
        'Each intake opens on its own once the countdown runs out.'
      ]
    },
    openField: {
      name: 'Open advert',
      blurb: 'The advert got shared. They arrive across the whole field, and anything they crowd round goes offline pending review.',
      banner: 'They are coming across the whole field',
      board: 'Best screeners, open advert',
      howTo: [
        'Click a free tile to install. Keys 1 to 6 pick which one.',
        'No path here, so Salary Expectations goes anywhere too.',
        'A process they crowd round wears down and goes offline.',
        'Space opens each intake early, if you are ready.'
      ],
      howToTouch: [
        'Press a free tile, slide to aim, then lift to install.',
        'No path here, so Salary Expectations goes anywhere too.',
        'A process they crowd round wears down and goes offline.',
        'Each intake opens on its own once the countdown runs out.'
      ]
    },
    backChannel: {
      name: 'Back channel',
      blurb: 'Nobody used the portal. They walk round anything that looks like a process, so the question is what the cheapest way in costs.',
      banner: 'Nobody used the portal',
      board: 'Best screeners, back channel',
      howTo: [
        'Click a free tile to install. Keys 1 to 6 pick which one.',
        'The shaded ground is what they will try to walk round.',
        'Salary Expectations is the one thing they do not walk round.',
        'Space opens each intake early, if you are ready.'
      ],
      howToTouch: [
        'Press a free tile, slide to aim, then lift to install.',
        'The shaded ground is what they will try to walk round.',
        'Salary Expectations is the one thing they do not walk round.',
        'Each intake opens on its own once the countdown runs out.'
      ]
    }
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
    // Music is its own switch, since wanting the game to make a noise when it
    // rejects somebody and wanting it to play at you for twenty minutes are not
    // the same want. N because M is taken and it is the next key along.
    musicOn: 'N. Music on',
    musicOff: 'N. Music off',
    pause: 'Esc. Pause',
    // The same four with the key taken off the front. All three controls are
    // tapped either way, so only the shortcut goes.
    soundOnTouch: 'Sound on',
    soundOffTouch: 'Sound off',
    musicOnTouch: 'Music on',
    musicOffTouch: 'Music off',
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
    reapplyingNote: 'Some of them are back',
    // Said over a screening process that has been leaned on until it stopped
    // working. It is coming back, and it will not have learned anything.
    suspended: 'Under review'
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
  /**
   * The one question the game asks, on the end of a run and once a session.
   *
   * The keys under `options` are the answers in `config/feedback.js`, and the
   * two lists have to agree: an answer with no label is an option drawn blank,
   * and a label with no answer is never shown at all.
   *
   * Every option has to hold one line at the width the list is drawn at, since
   * the options sit on a fixed gap in the right hand column and a wrapped one
   * runs into the one below it. `thanks` is the exception and is wrapped on
   * purpose, because it is the last thing on the screen with nothing under it.
   */
  feedback: {
    prompt: 'Requisita is required to gather feedback on the process.',
    question: 'How did you find the screening?',
    options: {
      straightforward: 'Straightforward',
      aboutRight: 'About right',
      gruelling: 'Gruelling',
      lost: 'Never worked out what was going on'
    },
    thanks:
      'Thank you. Your feedback has been logged and will be reviewed in due course.'
  },
  /**
   * The upgrade cards on the phone board, keyed by the ids in
   * config/upgrades.js. The system is the butt of every one of them: each card
   * is a screening process being made more thorough, and the joke is that
   * thorough is not the same as good.
   */
  upgrades: {
    title: 'Process improvement',
    note: 'Two proposals. One budget.',
    keywordListUpdate: {
      name: 'Update the keyword list',
      detail: 'Last year\u2019s terms retired. The tricks that used to match stop matching.'
    },
    panelReview: {
      name: 'Convene a panel',
      detail: 'Rejections now carry to whoever was stood nearby. Consensus is efficient.'
    },
    widerCriteria: {
      name: 'Broaden the criteria',
      detail: 'Adjacent experience now in scope, which means more of it to reject.'
    },
    higherBar: {
      name: 'Raise the bar',
      detail: 'A higher score to clear. Nobody is told what the score was.'
    },
    parallelScreening: {
      name: 'Screen in parallel',
      detail: 'Two applications reviewed at once, neither of them twice as carefully.'
    },
    extendedDeadline: {
      name: 'Extend the deadline',
      detail: 'The vacancy stays open a little longer before anybody has to be hired.'
    }
  },

  credit: {
    link: 'A project by spencerstern.com',
    // {year} is filled in from the clock when the footer is drawn, so nobody
    // has to remember to come back and edit this every January.
    copyright: '© {year} Spencer Stern',
    // {version} is filled in from the build, so this never has to be edited
    // when a release moves the number.
    version: 'v{version}'
  },
  unsupported: {
    title: 'Not on a phone, for now',
    body: 'The board wants more room than this. Rather than serve you something broken, Requisita has decided this application does not meet the essential criteria.',
    note: 'Come back on a tablet or a laptop.'
  },
  leaderboard: {
    // There is no single heading any more. Each board names itself, from the
    // `board` line on its own mode above, because a rating on one of them means
    // nothing at all on the other.
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
    doneHint: 'Press space to reopen the vacancy.',
    // The same three lines for a screen that is tapped rather than typed at.
    // The box takes a name either way now, so these differ in how they ask for
    // it and not in what is on offer.
    typingHintTouch: 'Sixteen characters, and be nice.',
    emptyHintTouch: 'Tap the box to put a name to it, or start again with the button.',
    doneHintTouch: 'Reopen the vacancy with the button.'
  }
};

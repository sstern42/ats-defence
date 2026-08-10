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
      trait: 'Quick. Knockout Questions go for it first.',
      // See traitRadial on the referral below for why these exist.
      traitRadial: 'Quick, and more than qualified. There is no field for that.'
    },
    keywordStuffer: {
      name: 'The Keyword Stuffer',
      trait: 'Every keyword, twice. The Keyword Filter has nothing to say.'
    },
    referral: {
      name: 'The Referral',
      trait: 'Knows somebody. Starts halfway down the path.',
      /**
       * What the introduction card says on the radial board instead.
       *
       * Two of these six traits describe something that board has not got. This
       * one names the path, and there is no path: everybody starts on the ring
       * and this type gets no head start there, so the line would be flatly
       * untrue. The Overqualified's names the Knockout Question, and the only
       * screening process on that board is a Keyword Filter.
       *
       * The other four hold on both boards and have no variant, which is the
       * same arrangement `howToTouch` has above: a second line only where the
       * first one stops being true. Falling back to `trait` is what makes that
       * work, so a type that never needs one never gets one.
       *
       * Neither line is a mechanic this board is missing. Fixing them by giving
       * the radial board a head start and a second tower would be retuning a
       * board to suit its own captions.
       */
      traitRadial: 'Knows somebody. Comes in as though expected.'
    },
    boomerang: {
      name: 'The Boomerang',
      trait: 'Applies again at the end of the intake. Every time.'
    },
    /**
     * The seventh. It used to be the one type the desktop boards never sent, so
     * it had no `traitRadial` and the single line was written for the phone. The
     * open advert and back channel lists send it now, and the two boards want
     * different sentences for the reason the Overqualified does.
     *
     * `trait` names the Knockout Question, because on a desktop board the
     * immunity is the whole of what the player has to know and the only part
     * they cannot see. The health is an orange slab with a bar over it from the
     * moment it walks on and the speed is obvious within a second, so a line
     * spent on either would be a line spent describing the picture.
     *
     * `traitRadial` is the sentence that was here, kept for the board that has
     * no Knockout Question to be immune to. Naming one there would be exactly
     * the Overqualified's problem above: a card describing a tower that board
     * has never had.
     *
     * The joke is at the process's expense rather than at this applicant's,
     * which is the rule for all seven. Requisita is about to screen somebody
     * whose start date is already in a calendar, and it is going to do it
     * thoroughly.
     */
    internalCandidate: {
      name: 'The Internal Candidate',
      trait: 'Already has the job. The Knockout Question knows better than to ask.',
      traitRadial:
        'Already has the job. This intake is a formality, and a long one.'
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
    },
    /**
     * The phone board. It still has no tab, because the screen that draws tabs
     * is the desktop one and this mode never appears on it, and the phone page
     * offers one mode and therefore no choice to make.
     *
     * It does have a how-to list now, and the list is the reason the two rules
     * above it do not apply here. The lines are drawn down a column 624 wide and
     * laid out by measuring, so a line that wraps pushes the next one down
     * rather than landing on it. Write them to read well and let them wrap.
     *
     * There is no `howToTouch`. The desktop keeps two lists because its lines
     * name a click or a key, and none of these does: this board takes nothing
     * from the player once an intake starts, so there is no gesture to describe
     * either way.
     */
    oneClickApply: {
      name: 'One-click apply',
      blurb: 'Somebody pointed a button at every vacancy at once. They arrive from every direction and there is one of you.',
      banner: 'Applications inbound',
      board: 'Best screeners, one-click apply',
      howTo: [
        'One screening process, fixed in the middle, firing on its own.',
        'They arrive from every direction at once, never in a queue.',
        'Between intakes, two improvements are proposed. Take one.',
        'The vacancy holds until enough of them get through it.'
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
    pauseTouch: 'Pause',
    /**
     * The phone board's one control during an intake. The count is added on
     * after, for the same reason `trapWaiting` has the seconds added on after:
     * how many are left is the whole of what the player needs off it, and a
     * number is a better way to say it than a word.
     *
     * The note under it is there because nothing else on that board ever
     * explains a control, there being no other control to explain, and a button
     * whose effect is invisible until it is pressed is a button nobody presses.
     */
    bulkReject: 'Bulk reject',
    bulkRejectSpent: 'No bulk rejects left',
    bulkRejectNote: 'Everyone currently applying gets the same email.',
    /**
     * The pad on the phone board, in its three states. `trapWaiting` above is
     * the desktop's line for the same thing and is deliberately not reused: that
     * one explains why a button is greyed out, and this one has to tell somebody
     * that a part of the screen which has never done anything is now worth
     * touching.
     *
     * The seconds are added on after `trapAsking`, as the bulk reject's count
     * and the rating's number are.
     */
    trapReady: 'Tap the floor to ask what they expect to be paid.',
    trapLaid: 'The question is on the floor. Somebody has to walk into it.',
    trapAsking: 'Salary bands under review, ready in',
    /**
     * The running rating on the phone board, with the number added on after, as
     * the two above it are. It is deliberately the same word the summary and the
     * leaderboard use rather than a livelier one for the HUD: it is the same
     * figure, and a board calling it one thing while the screen after it calls
     * it another would read as two measurements.
     */
    rating: 'Rating'
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

    /**
     * Each card says three things, in this order and in decreasing size on the
     * card: what it is called, what it does, and why the system thinks it is a
     * good idea.
     *
     * The middle one is not optional. This choice is the whole of what a player
     * of this design does, and a pair of cards described only in character is a
     * pair of cards chosen at random. The joke goes underneath the mechanics
     * rather than instead of them.
     *
     * `{amount}` is filled from config/upgrades.js when the card is drawn, so
     * the number a player reads and the number the game applies cannot drift.
     * Same arrangement as the version in the footer and the year in the
     * copyright line.
     */
    keywordListUpdate: {
      name: 'Update the keyword list',
      effect: 'The Keyword Stuffer stops being immune to your filter.',
      detail: 'Last year\u2019s terms retired. The tricks that used to match stop matching.'
    },
    panelReview: {
      name: 'Convene a panel',
      effect: 'Every rejection splashes onto nearby applicants. Radius +{amount}.',
      detail: 'Useful when one applicant is absorbing everything you have.'
    },
    widerCriteria: {
      name: 'Broaden the criteria',
      effect: 'Range +{amount}. You start screening them further out.',
      detail: 'Adjacent experience now in scope, which means more of it to reject.'
    },
    higherBar: {
      name: 'Raise the bar',
      effect: 'Damage +{amount} per rejection.',
      detail: 'A higher score to clear. Nobody is told what the score was.'
    },
    parallelScreening: {
      name: 'Screen in parallel',
      effect: 'Reload {amount}ms faster, so you get through more of them.',
      detail: 'Two applications reviewed at once, neither twice as carefully.'
    },
    extendedDeadline: {
      name: 'Extend the deadline',
      effect: 'Tolerance +{amount}, and you get it back now.',
      detail: 'The vacancy stays open a little longer before anybody is hired.'
    }
  },

  /**
   * The end of a phone run. Two outcomes and no consolation for either: the
   * system does not congratulate the player for holding a vacancy shut, and it
   * does not apologise for letting somebody through. It files the result.
   */
  mobileGameOver: {
    held: 'Vacancy held',
    heldNote: 'Every applicant screened. The role remains open.',
    filled: 'Position filled',
    filledNote: 'Somebody got through. A start date has been agreed.',
    intake: 'Intake reached',
    rejected: 'Applications rejected',
    score: 'Rating',
    again: 'Open it again'
  },

  credit: {
    link: 'A project by spencerstern.com',
    // {year} is filled in from the clock when the footer is drawn, so nobody
    // has to remember to come back and edit this every January.
    copyright: '© {year} Spencer Stern',
    // {version} is filled in from the build, so this never has to be edited
    // when a release moves the number.
    version: 'v{version}',
    /**
     * The music, on its own line under the row above.
     *
     * It names the track, the artist and the licence, which is what an
     * attribution is for, and it is longer than the three pieces above will
     * take on a 720 wide screen. That is the whole reason it is a second line
     * rather than a fourth piece.
     *
     * The art is credited in the README and not here, and that is not an
     * oversight to correct later: Kenney's pack is a hundred files that have
     * been cropped, greyscaled and turned, which is a page rather than a line.
     * The music is one track, unmodified apart from the encode, so a line is
     * the whole of it.
     */
    music: 'Music: “Super Retro Lounge” by Abstraction, CC0'
  },
  /**
   * The two things the phone board cannot serve. Both are refusals rather than
   * apologies: the system has decided the application does not meet the
   * essential criteria, and it is the same joke in both.
   *
   * There used to be a third and it was the size of the screen. `unsupported`
   * said "Not on a phone, for now" and it has gone, because the for now ran out
   * and a phone gets a board of its own. A refusal nothing can reach is worse
   * than no refusal: it reads as a live promise that the game will turn people
   * away, and the next person to edit this file would keep it in step for
   * nothing.
   */
  phoneRefusal: {
    rotateTitle: 'Turn it back',
    rotateBody: 'The vacancy is filled top to bottom. Requisita does not accept landscape submissions.',
    rendererTitle: 'Not on this browser',
    rendererBody: 'This one cannot draw what the board needs. Rather than serve you something broken, Requisita has decided this application does not meet the essential criteria.',
    rendererNote: 'A more recent browser, or a different one, will do it.'
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
    doneHintTouch: 'Reopen the vacancy with the button.',
    // The phone board opens the board rather than showing it alongside, so it
    // needs a way in and a way out that the two desktop screens never did.
    view: 'See the board',
    close: 'Back'
  }
};

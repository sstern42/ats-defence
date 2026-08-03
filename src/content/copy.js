/**
 * Every user-facing string lives here, so the tone can be edited in one place
 * without reading any game logic.
 */
export const COPY = {
  applicants: {
    graduate: {
      name: 'The Graduate'
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
    }
  },
  hints: {
    placeTower: 'Click a free tile to install.',
    selectTower: 'Keys 1 to 3 also pick.'
  },
  hud: {
    lives: 'Vacancy integrity',
    currency: 'Budget',
    shortfall: 'The budget will not stretch to that.'
  },
  board: {
    leak: 'Reached a human'
  },
  gameOver: {
    title: 'Position filled',
    body: 'Enough applicants got past screening that somebody read one properly and hired them. Requisita has been invited to a review meeting.',
    rejectedLabel: 'Applicants rejected',
    restart: 'Reopen the vacancy',
    restartHint: 'or press space'
  }
};

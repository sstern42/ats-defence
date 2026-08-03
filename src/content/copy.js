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
      name: 'Keyword Filter'
    }
  },
  hints: {
    placeTower: 'Click a free tile to install a Keyword Filter. It does not read, it matches.'
  },
  hud: {
    lives: 'Vacancy integrity'
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

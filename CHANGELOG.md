# Changelog

Versions of ATS Defence, newest first. A developer record rather than
something the game shows a player. The version itself lives in
`package.json`, and the rules for moving it are in `CLAUDE.md`.

Anything that reaches a player gets a version and an entry here. Documentation,
analysis notes, tooling and CI changes do not.

## 1.1.0 - 2026-08-06

- A second mode, Open advert, chosen from tabs on the home page alongside
  Classic intake. There is no path in it: applicants arrive across the whole
  left edge and converge on the desk, fanning out where the ground is open and
  squeezing where it narrows. Still no pathfinding. A waypoint can now carry a
  spread and each applicant walks its own copy of the line, displaced by its
  share of it.
- Towers go anywhere in the new mode, since there is no corridor to stand
  beside, and traps go wherever they are put rather than snapping to a path.
- Applicants push back, in the new mode only. Enough of them crowded round a
  screening process wear it down until it is suspended pending review, and it
  returns at full integrity having learned nothing. A Referral does the most
  damage by a distance, because it knows somebody.
- A leaderboard per mode. The two send different numbers of applicants at
  boards of a different shape, so a rating from one is not a rating from the
  other, and every score submitted before this is recorded as classic.
- Every analytics event now carries which mode the run was played in.

Classic intake is unchanged. Every number in it is the number it already had,
which keeps its balancing pass, its leaderboard and the live starting difficulty
experiment all still saying what they said.

## 1.0.1 - 2026-08-06

- The home page footer now says which version is being played, after the credit
  and the copyright notice. It is read out of `package.json` at build time, so
  it cannot fall behind the number the release rules talk about.

## 1.0.0 - 2026-08-06

The shipped game, taken as the starting point for numbered releases. Everything
below arrived across the twelve build steps and the post-MVP work that followed,
before there was a version number to attach it to. Individual changes before this
point are in the git history and the pull request list.

- Six screening mechanisms to place: Keyword Filter, Knockout Question,
  Take-Home Task, Culture Fit Panel, Video Screen and the single-use Salary
  Expectations trap.
- Six applicant types walking a fixed waypoint path towards the vacancy, with
  waves, a screening budget, lives and a game over.
- Kenney art throughout, an animated introduction for each applicant type, and
  six synthesised sound effects behind a toggle the game remembers.
- A home page, a pause screen with a way out of a run, and a leaderboard shared
  by both ends of the game.
- Server-validated score submission and a top ten read through Netlify
  functions, with row level security on the table behind them.
- Thirteen analytics events, including the GrowthBook exposure, feeding the
  starting difficulty experiment.
- Desktop and tablet play. A tablet places a tower by dragging and lifting, and
  types a name for the board through a hidden field over the drawn box. Phones
  get an honest message instead of a broken layout.

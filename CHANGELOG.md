# Changelog

Versions of ATS Defence, newest first. A developer record rather than
something the game shows a player. The version itself lives in
`package.json`, and the rules for moving it are in `CLAUDE.md`.

Anything that reaches a player gets a version and an entry here. Documentation,
analysis notes, tooling and CI changes do not.

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

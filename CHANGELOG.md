# Changelog

Versions of ATS Defence, newest first. A developer record rather than
something the game shows a player. The version itself lives in
`package.json`, and the rules for moving it are in `CLAUDE.md`.

Anything that reaches a player gets a version and an entry here. Documentation,
analysis notes, tooling and CI changes do not.

## 1.2.0 - 2026-08-06

- The board is an office floor rather than a flat colour. Carpet, tiled from one
  128 pixel square, with the route worn into it: the walked ground is the same
  carpet with the pile flattened, and it shows through a hole cut in the carpet
  above it. Both modes get it from the same two tiles, since a corridor and a
  crowd's ground are only two different shapes.
- Furniture on the floor either side of the route. Desks, filing cabinets,
  waiting chairs, archive boxes, a water cooler and a pot plant, placed per mode
  because a corridor leaves pockets between its legs and a crowd leaves a strip
  at the top and a strip at the bottom. None of it is interactive: a click on a
  filing cabinet is a click on the tile it stands on.
- A vignette takes the corners of the floor down, so the board reads as a room
  with a middle. It sits under everything the player puts there, so nothing on
  the board is dimmed by it.
- The home page is laid on the same carpet, so the game no longer opens on a
  flat sheet and then turns out to be somewhere.

The art is drawn by `tools/make-textures.mjs` and committed, the same as the
sounds and the applicant introductions, so there is no licence question and a
texture that reads badly is a number in a file. Nothing about how either mode
plays has moved: the route is the shape it always was, and the furniture stands
on the floor rather than on the board.

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

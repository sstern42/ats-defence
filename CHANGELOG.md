# Changelog

Versions of ATS Defence, newest first. A developer record rather than
something the game shows a player. The version itself lives in
`package.json`, and the rules for moving it are in `CLAUDE.md`.

Anything that reaches a player gets a version and an entry here. Documentation,
analysis notes, tooling and CI changes do not.

## 1.5.0 - 2026-08-07

- A third mode, back channel. Nobody used the portal, so there is no route on
  the board at all: applicants come in across the left edge and work out their
  own way to the desk, and every screening process installed is something to be
  walked round rather than something to be walked past.
- Nothing blocks anybody, which is the decision the rest of it follows from. A
  tower makes the ground inside its range expensive, applicants take the
  cheapest way in rather than the shortest, and there is no maze to build and no
  route to seal by accident.
- How far out of their way they will go is a property of the type. The Graduate
  applies to everything and walks in a straight line through whatever is in the
  way. The Overqualified goes a long way round a knockout question. The Keyword
  Stuffer strolls straight through a Keyword Filter, because a Keyword Filter
  has nothing to say to it.
- Salary Expectations lays down no threat, so it is the one thing nobody routes
  round, and setting it on the ground they have just been pushed onto is how the
  mode is played.
- The board says what it is doing. The ground the screening has made expensive
  is shaded, and three lines show where somebody paying attention would walk
  right now. Both are redrawn when a tower goes down, and everybody already
  walking reconsiders from where they are standing.
- Its own intake list and its own leaderboard, on the same terms the second mode
  got them. A first pass, and less settled than either of the others.
- The board needs `supabase/migrations/0007_leaderboard_back_channel.sql`
  applied before it will take a score. The functions read the mode list out of
  config, but a check constraint cannot, so the database is the one place a new
  mode has to be written down by hand.

Towers now pick whoever has the least walking left rather than whoever is
furthest along their path as a fraction of it. In classic those are the same
applicant, which is the only reason the change was allowed: classic does not
move. Everything else in the two existing modes is untouched, and neither of
them reads a single one of the numbers this release added.

## 1.4.1 - 2026-08-06

- The board knows what is in front of what. Furniture, towers and applicants
  used to be three fixed layers, so the furniture was under everything and
  could never be walked behind. They are now sorted by how far down the board
  each of them stands, which is the one thing that decides it.
- The filing cabinet stands up. It is drawn as a front with a lid over it and a
  shadow under it rather than as the rectangle you get looking at a cabinet
  from the ceiling, and it is placed by its base rather than by its middle.
- One of them has moved to the bottom of the top right leg of the corridor,
  where an applicant now walks behind it. The rest of the furniture is still
  placed to keep out of the way, which is why that one is the exception.
- Everything else on the floor is still seen from above. This is a first look
  at whether a prop with height reads on this board at all, and five more of
  them would answer that no better than one.

Furniture is decor. It sits on no tile, blocks no route and is read by nothing
that decides where a tower may go, so moving it changes no number in either
mode. Classic intake plays exactly as it did.

## 1.4.0 - 2026-08-06

- Background music, for a run that wants it. Four chords of hold music on a
  slow loop, which is what a piece of enterprise software should sound like
  when you are waiting for it.
- There is no music file. The notes are scheduled on the audio clock from
  `config/music.js`, so the track costs nothing to download, never reaches the
  end of itself, and the single note that wanders over the top of each bar is
  picked fresh every time round.
- Its own toggle in the HUD, on `N`, remembered between visits, and off to
  begin with. Sound effects are unchanged and still on: an effect is
  punctuation on something the player just did, music is a commitment made on
  their behalf.
- Sound off still means silence. The music toggle greys out to say so, and
  turning the sound back on picks the chords up at the next bar.
- Music runs with the board. It plays while a run is on, holds under the pause
  screen, which is the one moment it is arguably diegetic, and stops when the
  run does.

No number in either mode moved, and nothing is said by the music that is not
already on screen. Classic intake plays exactly as it did.

## 1.3.0 - 2026-08-06

- The game answers back. A tower or a trap is installed rather than simply
  appearing, a barrel kicks as it fires, and an applicant who takes a hit and
  keeps walking flinches for it.
- The HUD reacts to its own numbers. The budget swells and lights up when a
  rejection pays into it, dips when it is spent, and the lives readout flinches
  and goes cross for a moment when somebody walks in.
- Every button now goes down under the click, on the palette, the home page,
  the pause screen and the game over screen. The trap button comes back up when
  its wait is over.
- A player whose system asks for less motion gets none of it, including the
  screen shake on a leak. Nothing is only said by movement, so the game reads
  exactly the same without it: the colours, the readouts and the labels all
  still change.

Nothing here is information the game was not already giving, and no number in
either mode moved. Classic intake plays exactly as it did.

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
- The share card and the README screenshot show the floor rather than the flat
  board they were taken from, since the old one is a picture of a game that no
  longer looks like that.

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

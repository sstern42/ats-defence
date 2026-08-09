# Changelog

Versions of ATS Defence, newest first. A developer record rather than
something the game shows a player. The version itself lives in
`package.json`, and the rules for moving it are in `CLAUDE.md`.

Anything that reaches a player gets a version and an entry here. Documentation,
analysis notes, tooling and CI changes do not.

## 1.10.1 - 2026-08-09

- Screen in parallel now shows itself. A shot on the phone board is drawn as one
  line per screening running at once, side by side, so taking the card changes
  what a shot looks like as well as how often one happens. It was the only card
  in the pool whose effect the board never showed: the range ring grows, the
  splash catches somebody standing behind, the tolerance bar refills, and a
  shorter reload could only be seen by counting the gaps.
- Cosmetic and only cosmetic. The damage, the target and the reload are what they
  were, nothing in the simulator can see it, and a run that takes the card is the
  same run it measured at.
- It stops at four lines, because seven of them seven pixels apart is a beam
  rather than a set of parallel screenings.

## 1.10.0 - 2026-08-09

- A ninth intake on the phone board, and one arrival in it. The Internal
  Candidate is the seventh applicant type, no desktop wave list names it, and it
  has 2,600 health against a turret that manages a few hundred while everybody
  faster is closer to the desk. Already has the job. The intake is a formality.
- A bulk reject, three to a run, which is the first input this board has ever
  taken during an intake. It is damage rather than a clearance, so it deletes a
  crowd and wears the boss down, and it ignores who is immune to what, because a
  mail merge is not a keyword filter.
- The eight intakes before it did not move, character for character. The
  simulator's browser check still checks them, with `--bulk none` playing the
  board as though the button were not there.
- The charges are the second decision this design has ever offered. Measured
  over 10,000 runs a player who keeps all three holds the vacancy 47.6% of the
  time, one who spends them to get out of trouble 31.6%, and one who fires at the
  first crowd 16.2%. The full table is in `config/mobile.js`.
- The boss carries its health bar from the moment it turns up rather than from
  the first hit, since how much of it is left is the whole of what the player is
  deciding against.
- A seventh sound effect and a seventh introduction animation, both drawn by the
  tools that drew the other six.
- `game_over` carries `bulk_rejects_used` on that board. A property rather than a
  sixteenth event, on the same grounds `mode` is one, and the queries are in
  `docs/bulk-rejects.sql`.

## 1.9.0 - 2026-08-09

- The background music is a real track. "Week 1.1: Super Retro Lounge" by
  Abstraction, from the Tallbeard Music Loop Bundle, CC0, and lounge music for a
  game about enterprise software is close enough to the joke to be worth the
  bytes.
- It replaces the four chords that used to be scheduled note by note on the
  audio clock. `services/music.js` is 180 lines shorter for it: Phaser handles
  the decoding, the looping and the autoplay unlock, and already did for the six
  sound effects.
- Sound off still means silence, music included. That used to be checked four
  times a second and is now a consequence of the track going through the same
  mixer as everything else.
- Two encodings ship, and the browser takes one. Vorbis leads because it loops
  without a gap; the MP3 is for Safari before 18.4, which could not play Vorbis.
- The audio directory is 708kB where it was 68kB, and the loop comes round every
  24 seconds. Both are real costs and both are written down in the README next
  to the file.
- Nothing else moved. The HUD toggle, the `N` key, the off-by-default and the
  remembered preference are all where they were, on all four boards.

## 1.8.1 - 2026-08-09

- The phone board's game over screen said "Intake reached" over the number of
  intakes cleared, which is one lower on every run that ends in a loss. A player
  who went out in the fifth was told they reached the fourth. The same number is
  what that board sent as `final_wave` on every event carrying one and what it
  submitted to the leaderboard, so the phone board has been reporting one less
  than the other three boards since it opened. It now sends the intake reached,
  as they do. Scores are unaffected, since a score has always paid for what was
  finished.
- Submitting a score and then restarting before the board answered could throw.
  The game over screen carried on writing its status line after the scene it
  belongs to had been stopped, and the restart is offered on the same screen,
  from a key, while the submission is still in flight. The phone board has always
  checked for this and the desktop one now does too.
- An applicant's walk is thrown away with the applicant. Phaser hands the tween
  driving it to whoever made it to clear up, and nothing did, so every applicant
  a run had ever sent was still being held onto at the end of it, along with a
  tween per re-route on the back channel. Nothing visible changes; a long run
  holds a great deal less.
- An iPad is recorded as a tablet again. Since iPadOS 13 Safari says it is a Mac
  by default, so every one of them was being counted as a desktop, on the one
  property that exists to say how much of the traffic is not.
- The Salary Expectations button greys out when there is already one on the
  board, rather than looking available and refusing the click.

## 1.8.0 - 2026-08-09

- The game can be installed. A browser that offers it will now put it on a home
  screen or in an app list, where it opens without the browser chrome around it
  and with its own icon and splash screen. It matters most on the phone board,
  which is a portrait game with no address bar worth keeping, and it costs the
  other three nothing.
- It works with no signal, which is the more useful half. Everything the game is
  made of is already in the build: the art, the sounds, the waves, the card pool
  and the music, which has no file at all. Nothing about playing a run has ever
  needed the network, so a service worker holding the page and its assets is
  enough to make a whole run possible offline.
- What does need the network is the leaderboard, the analytics and the
  experiment, and none of them are cached. All three already fail quietly: the
  board says it could not be reached, events are dropped, and a run that never
  reached GrowthBook plays the control arm and is reported as unassigned rather
  than counted as a control player. An offline run is therefore a real run that
  no leaderboard and no query will ever hear about, and that is the honest cost
  of this rather than a defect to fix.
- A navigation goes to the network first and falls back to the cached page, so
  a deploy is picked up as soon as the game is opened online. Assets come out of
  the cache first, and the cache is named for the version, so a release brings a
  cache of its own and the old one is deleted.
- An update waits for every tab on the game to close before it takes over, so a
  run in progress keeps the code it started with. The version travels on the
  worker's own query string, which is what makes the browser notice a release,
  and means `package.json` is still the only place the number is written.
- Three more icons from `tools/make-favicon.mjs`, at the sizes an installed app
  is listed at, one of them drawn full bleed with the mark pulled in because a
  maskable icon is cropped to whatever shape the platform prefers.

## 1.7.2 - 2026-08-09

- The game has a tab icon. It had none, so every tab open on it carried
  whichever blank page glyph the browser keeps for sites that have not said,
  which is a poor look for something meant to be opened from a link in a post.
- It is an application with a mark drawn across it, in the carpet, paper and
  rejection colours already on the board. Cropping the share card down was the
  obvious answer and the wrong one: the card is a screenshot of a board, and a
  board at sixteen pixels is a grey smudge. An icon that small is a mark rather
  than a picture.
- Drawn by `tools/make-favicon.mjs`, on the same terms as the sounds, the
  textures and the introductions: Node built-ins, no dependency, output
  committed. The SVG and both PNGs come out of one description of the shapes,
  so a vector file and a bitmap cannot drift apart.
- Three files and no `.ico`, because a browser only goes looking for one when
  the page has declared no icon at all. The touch icon is a hundred and eighty
  pixels and drawn square, since the phone board is a real thing to put on a
  home screen and iOS masks its own corners on.

## 1.7.1 - 2026-08-09

- The fifteenth event has never worked. `upgrade_offered` was posted through the
  wrong door: the function that takes a built event was handed the name of one
  instead, so the collector was sent a bare string, refused it, and every card
  taken on every run since the event landed went unrecorded. The whole argument
  for adding it was take rate against offer rate, and there was neither.
- What hid it is worth more than the fix. The same wrong door skips the log kept
  on the page for checking exactly this, so the event was missing from the
  browser and missing from the store, and the two agreed with each other. It
  took playing a run on a real phone and then going and looking.
- A phone was opening its session under the wrong mode. The mode was set by the
  scene set that plays the board, which happens after the two events that open a
  session have already gone, so a phone announced itself as classic and then
  reported everything after that as one-click apply.
- The half of that which matters is the experiment. Starting difficulty varies
  classic's first intake, the check that reads who was bucketed deliberately
  does not filter by mode, and a phone player was therefore sitting in the
  denominator of an experiment they were never shown. The mode is now decided
  from the shape of the screen, before anything is sent.
- Nothing a player can see has changed, and nothing has been retuned. The version
  moved so the footer says which build is deployed, which is the thing that was
  missing when the question was whether the fix was live.

## 1.7.0 - 2026-08-09

- The phone version is open. A phone used to be told the board wanted more room
  than it had, and now it gets one-click apply: a portrait board built for the
  shape rather than the landscape board shrunk into it. One screening process
  fixed dead centre, applicants converging on it from every direction, nothing
  to place, and no input at all during an intake. Everything the player decides
  happens between them, where the process is offered two improvements and can
  have one.
- The board itself has been playable behind `?shape=phone` for a while. What
  this release is, is the line that stopped a real phone reaching it. The
  message it used to show has gone with it, because a refusal nothing can reach
  reads as a promise that the game still turns people away.
- Two honest refusals are left and neither is about the size of the screen. A
  browser that cannot give the board a WebGL context gets told so rather than a
  blank canvas. A phone turned on its side gets told so too, and the run is
  still there when it is turned back.
- The intake list has had its first real tuning pass. It used to be flat: every
  run survived the first seven intakes whatever it did, and the whole game was
  decided in the eighth. Every intake from the third now costs something, and
  the last two are both places a run can end.
- The cards decide the run now, which they did not before. Playing them well and
  playing them badly used to come out at 13% and 27% of vacancies held, in that
  order, which is a game where reading the cards makes it worse. It is 58% and
  4% the right way round.
- The vacancy is more patient and each arrival costs it less, which is what
  makes room for the above rather than a softening. A run absorbs sixty
  applicants where it used to absorb forty.
- The tip jar is on the phone game over screen, where it has always been on the
  desktop one and where it was missing here.
- The question is asked on the phone too. It is the same one question, once a
  session, and it was not being asked on the board that needed it most.
- Nothing else moved. No other mode was retuned, no other wave list was touched,
  and the leaderboard needs nothing applied that is not already there.

## 1.6.0 - 2026-08-07

- The game asks a question now. One, on the game over screen, under the board
  and the tip jar, and once a session rather than once a run. Requisita is
  required to gather feedback on the process, and it would like to know how you
  found the screening.
- Four fixed answers and no box to type in. Three of them are a difficulty
  scale and the fourth is never having worked out what was going on, which is
  the one worth having: the events already say which intake a run ended on and
  have never said whether ending there felt earned. A player who was outplayed
  at intake five and a player who was lost at intake five need opposite fixes.
- The answer is filed, acknowledged and will be reviewed in due course.
- Ignoring it costs nothing and it never asks twice. It is the last thing on a
  screen that has just told somebody they lost, which is as much pressure as
  that screen should apply.
- Nothing else moved. No mode was retuned, no wave list was touched, and the
  question is the same question on all three boards. It needs no migration
  either, so a preview shows it working with nothing applied to the database.

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
- The board shades the ground the screening has made expensive, and redraws it
  when a tower goes down. Where they will actually walk is not drawn: the player
  is given what the screening covers and has to work out what that leaves, and
  everybody already walking reconsiders from where they are standing, which is
  the only thing that answers it.
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

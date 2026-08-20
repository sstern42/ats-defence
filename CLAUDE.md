# ATS Defence

Browser tower defence where the player is the Applicant Tracking System, defending a single vacancy from waves of applicants.

## Non-negotiables

Read these before writing anything.

- **Phaser 4, not Phaser 3.** If you find yourself writing v3 pipeline
  or FX code, stop and check the Phaser 4 agent skill files in the
  package rather than relying on recalled patterns.
- **UK English.** Everywhere. Code comments, commit messages, in-game copy, README.
- **No em dashes.** Use commas, full stops or brackets.
- **Tone: dry and understated.** Wry, never bitter. The system is the butt of the joke, not the applicants. If a line reads as angry about the job market, rewrite it.
- **Parody vendor names only.** No real ATS vendors (Workday, Greenhouse, Taleo, Lever, Bullhorn and so on) anywhere in code, assets, copy or comments. The in-game product is called **Requisita**.
- **No secrets in the repo.** Only the Supabase anon key ever touches client code. No service role key in the repo, in committed files, or in any environment variable exposed to the client build.

## Stack

| Concern | Choice |
| --- | --- |
| Engine | Phaser 4 |
| Build | Vite |
| Language | Vanilla JS (no TypeScript, no framework) |
| Hosting | Netlify, auto-deploy from `main`, deploy previews on every PR |
| Repo | `sstern42/ats-defence`, public, MIT |
| Art | Kenney CC0 assets |
| Ground and furniture | Drawn by `tools/make-textures.mjs`, committed as PNG |
| Applicant introductions | Drawn by `tools/make-intros.mjs`, committed as sprite strips |
| Tab icon | Drawn by `tools/make-favicon.mjs`, committed as SVG and PNG |
| Install | Hand written manifest and service worker in `public/`, no plugin |
| Sound | Synthesised by `tools/make-sounds.mjs`, committed as WAV |
| Music | One CC0 loop, played through Phaser's mixer like the effects |
| Backend | Supabase (leaderboard and analytics, both behind Netlify functions) |
| Experiments | GrowthBook |
| Page analytics | Umami, a script tag in `index.html` and nothing else |
| Domain | ats.spencerstern.com |

Keep dependencies minimal. If a task can be done with vanilla JS in twenty lines, do not add a package.

## How this project is worked on

Development happens through Claude Code on the web. Sessions run in the cloud, so **there is no local dev server anyone can look at.** The Netlify deploy preview on each pull request is the only way the game gets seen.

This shapes everything below. Deploy is not a late step. It was step 2, nothing proceeded until a preview URL rendered the game, and the same rule applies to every change made since.

## Concept

The player is Requisita, an applicant tracking system. Applicants advance along a path towards an open vacancy. The player places screening mechanisms (towers) to reject them before they arrive. Applicants who reach the vacancy cost the player a life. The joke is that the player is doing the rejecting, and that the tools are recognisably the ones real systems use.

### Modes

Four. The first three are chosen on the home screen and share every tower, every applicant type and the whole game loop, and what differs between them is data in `config/modes.js`. The fourth is not chosen at all: a phone is routed to it by the size of its screen, and it is the one that does not share the loop.

| Mode | What it is |
| --- | --- |
| Classic intake | The game as it shipped. One corridor, walked in single file, towers beside it. Every number in it is the number it already had. |
| Open advert | No corridor. Applicants arrive across the whole left edge and converge on the desk, fanning out and squeezing according to the `spread` on each waypoint. Towers go anywhere off the HUD and the desk, traps go wherever they are put, and applicants push back. |
| Back channel | No route at all. A floor, a desk in the corner of it, and applicants who work out their own way across. Every tower makes the ground it covers expensive rather than impassable, and how far out of their way they will go to avoid it is a property of the applicant type. |
| One-click apply | The phone board, and the only one nobody picks. Portrait and routeless: one screening process fixed dead centre, applicants converging on it from every direction, and a turret that turns to whoever has least walking left. Most of what the player decides happens between intakes, where the process is offered two improvements and can have one. During one, there are three bulk rejects, two holds for review and a pad laid by tapping the floor, which is the only thing on this board that is put somewhere rather than pressed. The ninth intake is one arrival the turret cannot answer. |

**The crowd is still not pathfinding.** Open advert is waypoints, same as the path always was. Each applicant walks its own copy of the spine, displaced by its share of the spread at every point and tapering to zero at the vacancy so everybody converges on the one desk. Applicant.js did not change to allow it and should not have to.

**Back channel is pathfinding, and it is the exception this file spent two modes refusing.** It was allowed for one reason: applicants routing round the process is the joke the whole game has been telling, and there is no way to tell it with a line drawn in advance. What it had to keep in exchange is written down under "Beyond the MVP", and the short version is that everything it varies is still data.

**Nothing in it is ever blocked.** A tower adds `threat` to the cells inside its range, an applicant takes the cheapest way to the desk rather than the shortest, and `caution` on the type decides how much that costs it. So there is no maze to build and no route to seal by accident, which is why placement needed no new rule and why a tower can never be refused on the grounds that it would trap somebody. A screening process nobody can get round is not a screening process, it is a locked door.

Applicant.js did change for this one, in two places, and both were already wrong before it: what a tower targets is now distance left to the desk rather than a fraction of a path, which is the same applicant in classic and stops being the same applicant the moment two people are on routes of different lengths; and a walk can be restarted from where somebody is standing, which is the whole of what a re-route is.

**Pushing back is open advert only.** Applicants near a tower wear its `integrity` down; a tower worn to nothing is suspended pending review for a few seconds and comes back at full integrity. Recovery is applied against incoming pressure rather than after it, which is what makes one applicant harmless and a crowd a problem. Suspension rather than destruction, because losing a tower outright to a crowd whose edges you cannot see is a punishment rather than a decision. That is one number in `modes.js` if it should ever become the other.

**One-click apply is a second scene set rather than a fourth mode inside `GameScene`, and that is the whole of what makes it possible.** The first three modes are the same loop handed different data. This one is not: roughly two thirds of `GameScene` exists to serve a walked route and a player placing things beside it, and a board with neither has no counterpart for any of it. No route, no placement, no currency and, at the time, no input during an intake were four inversions of things classic is built on, so the choice was a second set of scenes sharing the services layer, or four more branches through the file classic is played by. `main.js` picks the set and dynamically imports the phone one, so a desktop player downloads none of it.

**Two of those four inversions have gone now and the argument survives both.** 1.10.0 took "no input during an intake" and 1.11.0 took "no placement", the second because Salary Expectations is a spatial decision and stripping the spatial part of it leaves something the bulk reject already is. What is left is still worth a scene set on its own: there is no route and there is no currency, which between them are what the two thirds of `GameScene` referred to above actually serve. One free pad laid by tapping the floor is not a six button palette with a budget behind it, and the desktop's placement code, its ghost, its grid, its clearance rules and its affordability checks are all still on the other side of the split, untouched and unused here. What has to be said honestly is that the sentence "no placement" can no longer be quoted about this mode, and anything that reads placement as absent has to be checked against `MOBILE_TRAP`.

**The fourth of those inversions has gone and the argument survives it.** In 1.10.0 the board grew one control during an intake, the bulk reject, and the sentence above is written in the past tense for that reason. Three of the four are untouched and each is still worth a scene set on its own, so nothing about the split changes. What does change is that "no input during an intake" can no longer be quoted as a property of this mode: it was one button three times a run and it is two buttons five times a run since 1.13.0, and anything that reads the absence of input as meaning something has to be checked against that. There is exactly one such thing, the idle abandonment clock, and it is dealt with under the analytics spec.

**What it shares is everything under the scenes.** `services/`, `content/copy.js`, `entities/`, the config conventions, the Netlify functions and the build, all as they stand. `entities/Applicant.js` in particular was not touched: a straight line inwards is a path with one segment, so the file three tuned modes depend on carries a fourth with no fork, no subclass and no edit. Its board data is a centre, a ring to arrive on and a radius to arrive at, and its numbers are `config/mobile.js` and `config/upgrades.js`.

**The one thing to read before touching its card pool.** Two of the six cards are measurably worse than choosing at random, and one of them is the card the design calls its flagship decision. The measurement is recorded in `config/upgrades.js` and reproducible with `tools/simulate-mobile.mjs --policy prefer:`. It has deliberately not been fixed, because the fixes live in `Tower.js` and `applicants.js`, which the three tuned modes read. Fixing it is a decision to take on purpose, with the rule below about classic in front of you, rather than a tidy-up.

### Towers

| Name | Behaviour |
| --- | --- |
| Keyword Filter | Basic turret. Cheap, fast rate of fire, low damage, indiscriminate. |
| Knockout Question | Instant rejection on hit, long reload, high cost. |
| Take-Home Task | No damage. Slows applicants heavily within radius. |
| Culture Fit Panel | Area of effect, randomised damage. |
| Video Screen | Low damage alone, gains a bonus when adjacent to another tower. |
| Salary Expectations | Trap tile, not a tower. Zero cost, single use, triggers on contact. |

### Applicants

| Name | Behaviour |
| --- | --- |
| The Graduate | Low health, fast spawn rate, arrives in swarms. |
| The Career Changer | Slow, high health. |
| The Overqualified | Fast. Knockout Question auto-targets it. |
| The Keyword Stuffer | Immune to Keyword Filter. |
| The Referral | Spawns past the first tower position. |
| The Boomerang | Respawns once at the end of the wave, whether killed or leaked. |
| The Internal Candidate | Slow, and 2,600 health that no Knockout Question may shortcut. Costs twenty times an ordinary arrival on the phone board and one life on the two desktop boards that send it. Closes the final intake of one-click apply, open advert and back channel. Classic never sees it. |
| The Contractor | On no intake list. Turns up unannounced from the fourth intake, already 40% of the way in. Reaching the vacancy costs no lives at all: the position is never filled, so it attaches and bills the budget by the day instead, renewing itself three times before it leaves. The Take-Home Task, the Culture Fit Panel and Salary Expectations have nothing to say to it. Rejecting it pays nothing. |

**The eighth is the first type that does not play by the rule the other seven are versions of.** Every one of them is a health bar walking at a desk, and reaching the desk costs a life. This one cannot cost a life, which is the whole design: a contractor is not a hire, the position stays open, and what it takes is budget at a day rate for as long as it is on the books. It is capped, it floors at nought, and it leaves of its own accord after three renewals.

What it cost is set out under "Beyond the MVP". The short version is that it is data in three places and a section in `GameScene`, it is behind a flag defaulting to on, and it is off on the phone board because that board has no budget to drain and the only thing it could take there is what lives are called on it.

The seventh started as the phone board's boss and is in `applicants.js` with the other six rather than in `config/mobile.js` with that board's numbers. A type is not a number: `Applicant` is handed a definition, `Tower.canTarget` reads `immuneTo` off one, the plausibility check counts a wave by looking every key up in that object, and a second table would be a second place all of them have to look.

**Putting it in the shared table is why it reached three boards for the price of two wave list entries.** The argument for doing so was that it cost the desktop modes nothing; the return is that when the final open advert and back channel intakes wanted it, there was nothing to build. The intro strip was already loaded by the desktop boot scene, the animation was already registered against it, the plausibility ceiling already counted it, and `introduceType` already looked a type up by name. A second table would have been four places to correct, and three of them fail by drawing nothing rather than by erroring.

What it did cost is two numbers on the type, and both are in `applicants.js` with the reasoning next to them. It is immune to the Knockout Question, because `instantReject` takes whatever health is left and 2,600 is otherwise worth the same as 40 on any board holding one. And `pressure` came down from 30 to 14, because that field was written as dead weight, open advert reads it, and this is the slowest thing in the table by a factor of three, so the untuned figure suspended most of the palette on a single walk past.

**Classic still never sees it, and that is the rule rather than an omission.** It is the mode with a balancing pass behind it, a leaderboard with real scores on it and a live experiment reading its wave one. The other two desktop lists say in their own comments that they are a first pass, which is the whole of why they could take this and classic could not.

Names and flavour text are content, not code. Keep all strings in a single `src/content/copy.js` so tone can be edited in one place.

## Architecture

```
src/
  main.js              Phaser config, the two honest refusals, and which scene set boots
  mobile/
    index.js           The phone build's entry, imported only once the gate has said phone
  scenes/
    BootScene.js       Asset loading, art and sound
    HomeScene.js       The page the game opens on
    GameScene.js       Core loop
    UIScene.js         HUD, overlaid on GameScene
    PauseScene.js      A run held mid intake, and the ways out of it
    GameOverScene.js   Score, leaderboard, restart
    LeaderboardPanel.js  Top ten, shared by home and game over
    backdrop.js        The office floor, shared by home and board
    mobile/            The phone build's scenes, sharing every folder below this one
      BootScene.js       What the phone board draws, and nothing the desktop needs
      HomeScene.js       The page the phone build opens on
      GameScene.js       The phone loop, with no route and no currency
      UpgradeScene.js    Two cards between intakes, one taken, over the held board
      GameOverScene.js   Score, board, tip jar and the question, in portrait
      LeaderboardScene.js  Top ten, over whichever screen opened it
  entities/
    Applicant.js
    Tower.js
    Trap.js
  config/
    waves.js           Wave definitions as data, one list per mode
    towers.js          Tower stats as data
    applicants.js      Applicant stats as data
    game.js            Lives, budget, prep times, scoring
    modes.js           What each mode changes, as data
    mobile.js          The phone board's tower, run, superweapon, pad and scoring numbers
    upgrades.js        The card pool, on stable ids the collector checks against
    path.js            Waypoint coordinates per mode, and the two boards that have none instead
    version.js         The version the build was cut from
    art.js             Sprite manifest
    scenery.js         Ground and furniture manifest, and where it stands
    audio.js           Sound manifest, levels and repeat gaps
    music.js           The track the background music is, and how loud
    intros.js          Applicant introduction manifest, frames and rate
    leaderboard.js     Name rules and read limits
    feedback.js        The one question, and the answers it will take
    links.js           Outbound links
  services/
    analytics.js       Event emission
    links.js           Where a link out points, and which ones carry the campaign
    audio.js           Playback, throttling and the on or off state
    music.js           Starts and stops the one loop, and remembers the toggle
    feel.js            The small movements, and the one place that knows to sit still
    experiments.js     GrowthBook wrapper
    device.js          What the player is holding, to the extent the browser will say
    mode.js            Which mode the current run is
    routing.js         The cost field, and the routes read out of it
    radial.js          The spawn ring, and the straight line in from it
    leaderboard.js     Score submission and top ten
    feedback.js        Asks the one question once a session, and sends the answer
    nameInput.js       The invisible field a touchscreen types a name into
    pwa.js             Registers the worker, and the two things the manifest does not say
  content/
    copy.js            All user-facing strings
public/manifest.webmanifest  What the installed app is called and drawn with
public/sw.js           What happens when the installed app is opened with no signal
netlify/functions/     collect, health, leaderboard, submit-score, and their lib
supabase/migrations/   Tables, RLS policies and later columns
tools/check-mode-list.mjs  Checks the modes the game plays against the ones the leaderboard will take
tools/simulate-mobile.mjs  Plays the phone board thousands of times without a browser, for balance
tools/make-sounds.mjs  Draws the sound effects, run by hand
tools/make-textures.mjs  Draws the ground and the furniture, run by hand
tools/make-intros.mjs  Draws the applicant introductions, run by hand
tools/make-favicon.mjs  Draws the tab icon and the installed app's icons, run by hand
docs/                  Analysis notes, their queries and the fixtures
netlify.toml           Build command, publish directory, Node version
vite.config.js         Puts the package.json version into the build
CHANGELOG.md           One entry per version, newest first
```

**Balance lives in data, not code.** `waves.js`, `towers.js`, `applicants.js`, `mobile.js` and `upgrades.js` must be plain exported objects with no logic. Tuning is the longest phase of this project and it must not require touching game logic.

**Two of the four boards are hardcoded waypoints.** An array of coordinates in `config/path.js`, and that is still the default answer for anything new. The third is a field in the same file, and it took a reason to get there rather than a preference. The fourth is neither, and is the shortest board data in the project: a centre, a ring to arrive on and a radius to arrive at.

## Build order

All twelve steps are done and the game has shipped. The list is kept as the
record of the order things were built in, not as a plan to follow. Work from
here is post-MVP, and there is no numbered list for it: see "Beyond the MVP".

The rule the list existed to enforce still holds. Each change leaves the game
running, and each change is its own pull request.

1. Vite plus Phaser scaffold. Add `netlify.toml` pinning build command (`npm run build`), publish directory (`dist`) and Node version. One sprite rendering.
2. **Confirm the Netlify deploy preview builds and the sprite is visible at the preview URL.** Do not proceed until this works. If the build fails, fixing it is the whole of the next step.
3. Waypoint path, applicants spawning and walking it.
4. One tower: click to place, range detection, targeting, damage, applicant death.
5. Lives, vacancy damage on leak, game over state.
6. Currency, tower cost, second and third tower types.
7. Waves as a structure, wave counter, between-wave pause.
8. Remaining towers and applicant types.
9. Analytics instrumentation.
10. Leaderboard.
11. GrowthBook experiment.
12. Balancing pass. Budget more time than seems reasonable.

The custom domain went to Netlify around step 8, once there was a game worth showing at a real address.

## Analytics spec

Instrumentation is the portfolio artefact, so it is not an afterthought. Implement it exactly as specified.

### Questions the data must answer

1. Where do players quit?
2. Is the difficulty curve right?
3. Do players replay after losing?
4. Which towers get used, and which are dead weight?
5. Does the leaderboard drive replays?
6. Does the tip jar convert?

### Global properties

Attached to every event without exception:

`session_id`, `run_id`, `wave_number`, `variant_assignments`, `device_type`, `referrer`, `mode`

`mode` is the seventh and arrived with the second game mode. It is a property rather than an event of its own because it is not a thing that happens: it is a fact about the run every other event is already reporting, and without it all six questions above have one answer per mode with no way to tell them apart. A third mode cost it nothing, and so did a fourth on a scene set of its own, which is the point of having put it on a property. It is on `session_started` too, where it records the setting rather than a decision, since nothing has been played yet.

The fourth mode is the one to watch when reading any funnel, and it is a reporting problem rather than an instrumentation one. Nobody chooses it, so a whole device class arrives at the top of a query and never appears in a step below it, and a filter written for three modes will quietly drop them. The queries in `docs/` were corrected for this in 1.7.0.

The queries in `docs/` read one mode, and read classic unless told otherwise. The filter is marked `-- mode`, on the same terms as the cutoff line next to it: it goes on the `game_started` CTE that defines a run and on any read of the board, and if it moves, move all of them. Three places deliberately do without it, and all three are session level rather than run level: the two coverage queries, which split by mode because a census should say what is in the table, and the exposure cross-check, because bucketing happens before a mode is chosen and filtering it would break the sample ratio check it exists to perform.

### Events

| Event | Properties |
| --- | --- |
| `session_started` | referrer, device_type |
| `game_started` | run_id, attempt_number |
| `wave_started` | wave_number, lives_remaining, currency |
| `wave_completed` | wave_number, duration_ms, lives_lost, towers_on_board |
| `tower_placed` | tower_type, wave_number, currency_before, grid_x, grid_y |
| `applicant_leaked` | applicant_type, wave_number |
| `game_over` | final_wave, score, run_duration_ms |
| `run_abandoned` | final_wave, run_duration_ms, reason |
| `restart_clicked` | from_wave, previous_score |
| `score_submitted` | score, final_wave |
| `leaderboard_viewed` | from_screen |
| `kofi_clicked` | from_screen, final_wave |
| `experiment_viewed` | experiment_key, variation_id, arm |
| `feedback_given` | question, answer, final_wave |
| `upgrade_offered` | taken, refused |
| `contract_started` | day_rate, spawn_wave |
| `contract_renewed` | renewal_number, day_rate |
| `contract_ended` | end_reason, renewals, currency_drained, duration_ms |

The last three are the Contractor's, they are the only ones ever added at once,
and they clear the bar as a set rather than separately.

They are on question 4, which asks which things are dead weight. It cannot be
asked of this type the way `tower_usage.sql` asks it of a tower, because nothing
about a contractor is a thing the player installs: the only decision anybody
makes about one is whether to spend screening time on it rather than on the
queue behind it, and that is answerable only from what happened after it reached
the desk.

**None of it goes through `applicant_leaked`, and that is a rule rather than a
preference.** That event means the vacancy lost a life, every read of it in
`docs/` counts it that way, and a type that cannot cost a life would make that
column mean two things and inflate every leak rate already written down. Nothing
leaked.

Nor does it fit on `game_over` the way the charge counts do. A run can hold
several engagements at once, and each has a length, a rate and a bill of its
own, so a property that holds one number per run cannot say any of it.

The three are one engagement told in order and each is the half the others
cannot say. The first is the arrival, and alone it counts how often the desk is
reached. The second is the middle, and alone it says whether players deal with
one or wait it out. The third is the outcome and the money, and it is the only
one that joins to a budget. A single event at the end would lose every
engagement carried by a run that was abandoned during one, which is the run most
worth reading. `end_reason` is `rejected` or `expired`, checked by the collector
on the same terms the answer list and the card ids are, because they are opposite
findings about the same feature and the rest of the event means nothing without
knowing which it was. The queries are `docs/contracts.sql`.

`variant_assignments` gained a second key with them, `contractor_enabled`, and it
is a flag rather than an experiment: nothing is bucketed and there are no arms.
It is on every event rather than only on the three above, because those only fire
when it is on, and without a key on every run there is no telling a run that was
offered no contractors from a run that was and never let one reach the desk.

`game_over` carries two extra properties on the phone board,
`bulk_rejects_used` and `holds_used`, and they are properties rather than events
on the same terms `mode` is one: how many of a run's charges were spent is a fact
about the run, not a thing that happens. They clear the bar on question 4 the way
the cards do, since a run ending with its charges unspent is the only record that
a button on that board went unpressed, and nothing else in the fifteen can
express it. They are absent rather than null on the three boards that have no
charges, and the queries are `docs/bulk-rejects.sql`. No collector change was
needed for either: the property bag is stored whole.

The second one arrived with the second superweapon in 1.13.0 and it is worth
saying what it buys over the first, since a second property is not free just
because the first one was argued for. On its own, a count of bulk rejects says
whether a button gets pressed. The pair says which of two buttons drawn the same
way and sat next to each other gets pressed, and a run that spends three of one
and none of the other is a finding about the words on them that neither number
states alone. Runs between 1.10.0 and 1.13.0 carry the first and not the second,
so a query reading both tests for both and those runs drop out of exactly the
questions they cannot answer.

`upgrade_offered` is the fifteenth, and the only one recording something a player
declined as well as something they did. Two cards are offered between intakes on
the phone board and one is taken, which is the whole of what a player of that
design decides.

It clears the bar on question 4. `tower_placed` records what was taken and has no
slot for what was refused, because on the desktop boards everything is always on
offer and the question of dead weight is answerable by counting. A two of six
draw is not: a card rarely taken may simply be rarely offered, so the answer is
take rate against offer rate and nothing in the fourteen can express the offer.
That is the `experiment_viewed` shape of argument rather than the
`feedback_given` one, since it records something that cannot be recovered any
other way rather than something a player said.

Folding it into `tower_placed` was considered and fails on its own terms. Three
of that event's five properties are meaningless in a one tower game, and its
histogram would mix card ids into a tower count everywhere the `docs/` queries
read it.

The card ids are a closed set in `config/upgrades.js`, read by the game to draw
the cards and by the collector to check one before storing it. Third instance of
a pattern already running twice, after the mode list and the answer list, and it
is the reason the pool has to be data with stable ids rather than something the
modal invents. Renaming one later is a migration of sorts, since the events
already written will still be spelling the old one. No migration otherwise: the
globals it wants are already columns. The queries are `docs/upgrade-cards.sql`.

`feedback_given` is the fourteenth, and the only one of them carrying something
a player said rather than something they did. It is the answer to one question,
asked on the game over screen once a session and never once a run, with four
fixed answers and no box to type in.

It clears the bar because question 2 has a part none of the other thirteen can
reach. The events say which intake a run ended on. Nothing in them separates a
player who was outplayed at intake five from a player who reached intake five
without ever working out what was happening, and those two need opposite fixes:
one is tuning and the other is legibility. Three of the four answers are a
difficulty scale and the fourth is not on it, which is the whole point of the
fourth.

It is an event rather than a property because it is a thing that happens, and it
happens seconds after `game_over` has already gone. That is the same seam `mode`
went through in the other direction.

The answers are a closed set in `config/feedback.js`, read by the game to draw
the options and by the collector to check one before storing it, which is what
makes the set closed rather than decorative. Free text was considered and left
out: the collector's whole defence is narrowness on a public unauthenticated
endpoint, an open field is the opposite of that, and nothing in the property bag
would have refused four kilobytes of anything posted under the name of an
answer. It also needs no migration, since the globals it wants are already
columns and the bag already keeps what it does not recognise.

`experiment_viewed` is the one event the game does not send. It comes from
GrowthBook's tracking callback, fires once per session, and only when a player
was genuinely bucketed, which is the difference between it and the arm string
carried on everything else. It was added after the twelve above, because
without it there is no record of an exposure anywhere and a variant assignment
read back off an event cannot tell a real control player from a run that never
reached GrowthBook.

`run_abandoned` fires on `beforeunload`, after 30 seconds of the tab staying hidden, and after 60 seconds of no input. It fires at most once per run, and `reason` says which of the three it was: `unload`, `hidden` or `idle`.

Two more reasons arrived with the pause screen, which gave a run in progress a way out that it did not have before: `restart` when the player starts another run from it, and `quit` when they go back to the home screen. Both are the same thing the other three are, a run that ended without a `game_over`, so they are reasons rather than an event of their own. The early abandonment metric already filters on reason, so nothing it was measuring moves.

The delay on hidden and the `reason` property were both added after launch preparation, because firing the instant the tab was hidden meant the event recorded the first time somebody glanced away, and since it only fires once, their real exit was never recorded at all. A player abandoned at wave five and went on to reach wave eight.

The idle reason is off on the phone board, and the reason it is off is a rule rather than a preference. A mode that takes no input during an intake makes idle mean the opposite of what it was written to mean: a run would be recorded as abandoned against somebody sat watching it, and since the event fires once, their real exit would then never be recorded at all. That is precisely the failure the `reason` property was added to fix, arriving again through a different door. Backgrounding the app is what leaving looks like on a phone and `hidden` already catches it, so `unload`, `hidden`, `restart` and `quit` cover the mode between them. Anything added later that takes the input away has to make the same decision.

**It stays off now that the board does take input, and the reason is the one written above rather than a convenience.** Three bulk rejects and two holds over a nine intake run is a player who touches the screen five times in about four minutes, so a minute of nothing still means somebody watching rather than an empty chair. The rule was never "there is no input", it was "input is not how you tell whether anybody is there", and that is still true of this board and would stop being true of one that asked for something every few seconds.

It will still be lossy. A tab closed from a background window may never run the handler, and a player watching a long wave without moving the mouse is counted as idle. That is expected and will be stated in the write-up rather than hidden.

Send every event. No sampling at this traffic level.

### Page analytics, which is not this

Umami sits on the page as a deferred script tag in `index.html`, and it is a
different question rather than a second copy of this one. Everything specified
above is about what happens inside a run, and all of it starts at
`session_started`, which is the game booting. None of it can see somebody who
opened the page, read the title and left, and none of it can count the arrivals
a launch post produced, so every funnel in `docs/` is missing its top row.
That is the whole of what the script is for.

**It adds nothing to the eighteen and reads nothing from them.** No event goes
to it, no game code imports it, and the two stores are never joined: one counts
page views and referrers, the other answers the six questions. A question that
can be answered by the eighteen is answered by the eighteen.

Links out of the game carry the same campaign parameters the game already reads
on the way in, so a visit that arrives tagged and leaves tagged is attributable
at both ends. `config/links.js` holds the campaign and the list of hosts that
may carry it, `services/links.js` is the only file that puts one on a URL, and
the list is the rule rather than a convenience.

One host is on it, and the other two destinations are off it for different
reasons. The music credit points at somebody else's page, and a credit arriving
with our campaign parameters on it is writing in their analytics rather than
thanking them. The tip jar is ours and is still not tagged, because Ko-fi
reports no campaign back: the parameters would be decoration on a link somebody
is about to follow, and what the game wanted to know about that click is already
on `kofi_clicked`, which carries the screen and the wave. A tag nobody can read
is not instrumentation.

`utm_content` is the screen the link was on, spelled exactly as `from_screen` is
on `kofi_clicked`, so if a second destination is ever tagged the two records of
one click line up by eye.

## Experiment

One experiment at launch, via GrowthBook.

**Starting difficulty.** Control: gentle wave one. Variant: wave one already busy. Measured on the wave-by-wave survival curve and on `run_abandoned` rate in the first three waves.

Wave one parameters are read from the GrowthBook assignment at run start rather than hardcoded, which is what makes this possible. Keep it that way.

It varies **classic** wave one and only classic wave one. Every other mode has its own opening and is handed its own list untouched, because swapping a classic wave into one would measure a wave the player never played. The arm is still reported on those runs, since the player was still bucketed, so the analysis filters on `mode` to leave them out rather than quietly widening one side.

Record the intended analysis before launch. An inconclusive result is a valid outcome and will be reported as one.

## Leaderboard

Assume it will be attacked. Client-submitted scores are trivially forged.

- One board per mode, on a `mode` column rather than a second table. Same name checks, same rate limit, same one submission per run: only the ordering and the plausibility ceiling are per mode. **A new mode is a migration.** The functions read the mode list out of `config/modes.js`, but the check constraint on the column cannot, so the database is the one place a mode has to be written down by hand and the one place that will refuse a score for a mode the rest of the game already offers. `tools/check-mode-list.mjs` compares the two and CI fails on the drift, which is the whole reason that check exists: the build could not see this and a player could. A rating from a mode that sends half again as many applicants is not comparable with one that does not, and ranking them together would rank the modes rather than the players.
- Supabase table with Row Level Security enabled from the start.
- Anon key may insert and select. It may not update or delete.
- Score submission goes through a server-side function that validates plausibility (score consistent with wave reached, within a sane ceiling) and rate limits by IP. Either a Netlify function or a Supabase edge function. Netlify is likely simpler, since it lives in this repo and deploys with the site. Decide at implementation time and note the reasoning in the PR.
- Display names: length capped at 16 characters, filtered against a profanity list, restricted character set.
- Top ten read only. No full-table reads from the client.

Free tier Supabase projects pause after seven days of inactivity. Add a GitHub Actions cron that pings the database twice weekly to keep it alive.

## Accessibility and platform

- Desktop first. If mobile is not properly supported at launch, show an honest "desktop only" message rather than a broken layout. It was not, and it did. Tablets came in afterwards, once a finger had a way to see a tower's range before committing to it, and phones came in after that, with a board of their own rather than the landscape one shrunk to fit. The message that used to refuse them has gone with the refusal, because a refusal nothing can reach reads as a live promise that the game turns people away, and the next person to edit that file would keep it in step for nothing. The rule is unchanged for whatever is next: an honest refusal beats a broken layout, and beats a board built for a shape nobody is holding.
- **The gate is the size of the screen and nothing else.** 900 by 600, in `main.js`, and what is on the other side of it is a scene set rather than a message. `?shape=phone` and `?shape=desktop` override it in both directions, which is how either board gets reviewed on a deploy preview from whatever is to hand, and neither override opens a session, so a review is not filed as a run played on a device it was not on.
- **Two honest refusals are left and neither is about size.** A browser that cannot give the board a WebGL context is told so, which is the price of the phone build forcing `Phaser.WEBGL` rather than falling back to a canvas that was never going to carry it. And a phone held sideways is told so, as a veil over the page rather than a screen instead of it, so the run is still there when it is turned back.
- Test in Chrome, Safari and Firefox before announcing, and on a real handset as well as a narrow window. A desktop browser at phone dimensions gets the phone board and tells you nothing about the frame rate, the soft keyboard over the name field, or whether anything is emitted from that route at all.
- **Nothing is said by movement alone.** A player who has asked their system for
  less motion is given the state without the animation, screen shake included,
  and every colour, readout and label still changes. Anything added that moves
  goes through `services/feel.js`, which is where that decision is made once.
- Open Graph title, description and image, since the launch happens on LinkedIn and the card preview matters.

## Definition of done for MVP

Met. Kept as the record of what finished meant, and as the thing any post-MVP
change has to leave intact.

- Playable start to finish, win and lose states both reachable.
- Six towers, six applicant types, at least ten waves.
- Deployed at ats.spencerstern.com over HTTPS.
- All twelve events firing and verified landing in the analytics store.
- Leaderboard live, validated server-side, RLS on.
- One GrowthBook experiment running.
- Ko-fi link present and unobtrusive.
- README with a one-line pitch, a screenshot and a link to play.

## Beyond the MVP

The game has shipped and the work is now past the MVP. There is no roadmap for
this phase. What gets built is decided one thing at a time, and the list below
is the mechanism rather than a ban: something comes off it when there is a
reason, not because it is easy.

### Still deferred

Tower upgrades, difficulty settings, user accounts, saved progress,
achievements. Post-launch decisions to be informed by the data. Do not add them
because they seem easy.

Multiple maps came off this list, though not in the shape it was written in. The
ask was for a second mode where the applicants arrive as a crowd rather than a
queue, which the first version of this list would have read as a second map and
refused. It qualified on the same terms sound and the touch controls did. Every
number it varies is data in `modes.js`, so there is one game loop rather than
two to keep in step. It reuses the six towers and the six applicant types
without editing either. And the one thing it genuinely adds, applicants wearing
a process down until it is suspended, is switched on by a field being present
rather than by a branch in the loop, so the mode that does not want it never
finds out it exists.

What it cost is worth writing down, because it is more than the sound toggle
cost. A second wave list to balance, which is a first pass and has not had the
tuning phase the classic one had. A seventh global property, and with it the
existing analysis queries needing a filter they do not yet have. A second
leaderboard, and a migration to backfill every score already on the first one as
classic. None of that was avoidable and all of it was the price of the mode
being real rather than a reskin.

Pathfinding came off this list too, and it is the only thing so far that came
off it by overturning a rule rather than by fitting round one. This file said
twice that there was no pathfinding and there was not going to be, and the back
channel is pathfinding. It qualified on three things. It reuses the six towers
and the six applicant types without editing either, and the one number each of
them gained is a number rather than a branch. What it varies is data: `threat`
on a tower, `caution` on an applicant, a field on the mode, and one service that
knows what to do with them. And it is off unless the mode says otherwise, on the
same terms `pressure` is, so classic and open advert never find out any of it
exists.

What it cost is more than the second mode cost, and most of it was not the
routing. A third wave list, less settled than either of the others. A migration,
which was missed until a run could not record its score, because the leaderboard
column spells its modes out and nothing in the build says so. Two changes to
Applicant.js, which the second mode was proud of not needing, and a change to
how every tower on every board picks a target. That last one is the part to
watch: it is the same applicant in classic, and the argument that it is the same
applicant is the only thing standing between this mode and having retuned the
one mode that must not move.

Sound was on this list and came off it after launch, on request. Six clips,
synthesised rather than licensed, with a toggle in the HUD and the choice
remembered. It is the worked example of how something leaves the list: asked
for, kept small, and self-contained enough that nothing already working had to
move to fit it.

Music followed it, on the same request and on the same terms, and for six
versions the interesting part was that it had no asset. Nothing here can reach
an asset host and there is no encoder on the machine, so the track was four
chords of hold music in `config/music.js`, booked onto the audio clock a bar
ahead by `services/music.js`, with one note per bar picked at random so a long
run never quite heard the same loop twice.

**In 1.9.0 it became a file, and both of those constraints are still true.** The
way round them is the only part worth writing down: the track was handed to the
build rather than fetched by it, and encoded by a static ffmpeg pulled from npm
into a scratch directory. So the rule that survives is narrower than the one it
replaces. It was never "the game may not have assets", it was "the build may not
go and get them", and that still holds. Anything added later that needs a binary
this environment cannot produce comes in the same way or not at all.

What it cost is in the README next to the file, in more detail than belongs
here, and the three lines of it are these. The audio directory went from 68kB to
708kB, which makes the track most of the download and most of the installed app.
The loop comes round every 24 seconds where the progression never repeated,
which on hold music is arguably the joke and is still the first thing to listen
for. And `services/music.js` lost 180 lines, because Phaser does the decoding,
the looping and the autoplay unlock and already did for the six effects.

The one thing that got simpler is worth noting, because it was previously an
argument in the other direction. The old service went straight to the audio
destination on the grounds that Phaser's mixer was for the clips it owned, and
had to check the sound toggle on every tick to keep "sound off means silence,
music included" true. The track is a clip Phaser owns now, so it goes through
that mixer and the rule falls out of the wiring instead of being enforced on a
timer.

It has its own toggle rather than riding the sound one, because wanting the game
to make a noise when it rejects somebody and wanting it to play at you for
twenty minutes are not the same want, and it is off until it is asked for, which
is the opposite of the sound effects and deliberate: an effect is punctuation on
something the player just did, music is a commitment made on their behalf.
Sound off still means silence, music included. It emits nothing, on the same
grounds the second mode does: no question in the spec asks how many players turn
the music on.

Mobile-specific controls went the same way, which is why the list above is
shorter than it was. A finger cannot hover, and hovering is the whole of what a
mouse does before it commits to a tower, so the two halves became pressing and
lifting: the preview follows a drag and the tower lands where the finger comes
off. That removed the only reason the support gate asked for a fine pointer, so
the gate is the size of the screen alone now and tablets are in. Phones still
got the message at that point, and the entry further down is what became of
that.

It qualified on the same terms sound did. Both routes end in the placement code
the mouse already used, so there is no second way to place a tower to keep in
step, and the route is chosen per event rather than at boot, so a laptop with a
touchscreen carried on working without being asked which it was.

What it did not finish was the leaderboard. The name box is drawn on the canvas
and was fed by key presses, so a tablet could play and lose but not get on the
board, and the copy said so rather than asking for a name that could not be
typed. That was a holding position, and it has since been closed: a soft
keyboard only opens for a real form field, so there is now an invisible one sat
over the drawn box on a coarse pointer, handing its text back to the scene. It
is the same shape as the two above. Everything visible is still drawn on the
canvas, the submission code is the one the keyboard already used, and the field
is only built where there are no keys, so the typed route did not move.

The one thing it adds that neither of the others needed is that the keyboard
covers the box it opens for. The game is lifted clear while the field has focus
and drops back when it loses it, which is the only reason anything outside the
canvas gets moved.

The one thing on the list that was never on it is qualitative feedback, because
everything the store holds is a record of what a player did and none of it is a
record of what they thought. That gap only matters in one place, and it is the
place the longest phase of this project lives in: the events say which intake a
run ended on and say nothing about whether losing there felt earned. So the game
asks one question, once a session, on the screen where the run has just ended.

It qualified on the same terms sound and the touch controls did, and the shape
of the refusals is the interesting part. Not stars, because a mean of 3.9 does
not name a wave to retune. Not a thumb, because players who liked it play more
runs and `restart_clicked` already counts that. Not a text box, for the reasons
under "Qualitative stays closed" below. What is left is four fixed answers,
three of which are a difficulty scale and one of which is not, and the one that
is not is the only new thing in the data.

What it cost is the least of anything here so far. A fourteenth event, which is
the whole of the argument and is made in the analytics spec above. One check in
the collector, which is the first per-event property check it has ever had and
exists because a closed set is only closed if the endpoint knows what the set
is. No migration, because the globals it wants are already columns. It is also
the first thing added that is content as much as instrumentation: an automated
rejection followed by a survey nobody reads is the artefact the whole game is
parodying, so the question is in character for the system rather than bolted to
the outside of it.

The phone board is the largest thing to come off this list, and it is the first
one that did not fit round a rule or overturn one. It went past both. Everything
before it was a fourth thing inside the existing game: a mode is data in
`modes.js`, sound is a service and a toggle, the touch controls end in the
placement code the mouse already used. A phone version is a second game loop,
and the whole point of the previous entries is that there is one loop to keep in
step.

It qualified because the alternative was worse. Two thirds of `GameScene` serves
a walked route and a player placing things beside it, and a design with neither
has no counterpart for any of it, so the choice was a second scene set or a
fourth branch through the file classic is played by. **Classic does not move** is
the older rule and it wins. The seam is that the split is at the scenes and
nowhere else: `services/`, `content/copy.js`, `entities/`, the config
conventions, the Netlify functions and the build are shared as they stand, and
`entities/Applicant.js`, the file this project has twice congratulated itself on
not editing, was not edited for this either.

What it cost is more than everything above it put together. A fourth wave list
and a card pool, both tuned against a simulator rather than against play, because
a design whose difficulty lives in the interaction between a pool and a curve
cannot be tuned by one person playing it twice. A fifteenth event, argued in the
analytics spec. A migration, which this time was written when the mode was rather
than after a player found it. A fourth board on the leaderboard. Two honest
refusals where there used to be one message. A second scoring weight set, since
the third term is tower integrity here rather than lives and the rejection term
had to come down or the plausibility ceiling would have stopped excluding
anything. And the queries in `docs/`, which now have a mode in them that nobody
chooses and that therefore arrives at the top of every funnel and appears in no
step below it.

Two things it deliberately did not buy, both recorded in the files rather than
here. Floating damage numbers were designed, argued and dropped: they are either
decoration or information carried by an animation on the one board that says
nothing may be said by movement alone, and the health bars already carry what
they would have said. And the card pool is upside down, measurably, with the
flagship card the worst in the pool. Fixing it means editing `Tower.js` or
`applicants.js`, which is the sentence above about classic, so it was measured,
written down and left.

Installing it is the smallest thing to have come off this list by some
distance. A manifest, a service worker and one call from `main.js`, and
the interesting part is how little of the game had to be true for it to work:
nothing in a run has ever needed the network. The art, the sounds, the waves,
the card pool and the music are already in the build, so a worker that holds
the page and its assets is the whole of offline play. Nothing was written to make the game work without a signal, and that is
the point.

It qualified on the terms sound and the touch controls did. No dependency: a
plugin would generate a precache manifest and buy one thing the eighty hand
written lines do not have, which is an asset cached before anybody has asked
for it. Nothing already working moved. And it is off in development, so the one
genuinely unpleasant failure a worker has, a stale module served from a cache
after the file behind it changed, cannot happen where the game is worked on.

What it cost is mostly a rule about what is never cached. The four functions
are about right now, so the leaderboard, the collector and the health check go
to the network every time. What follows from that is the honest cost: an
offline run is a real run that no board and no query will ever hear about. All
three network paths already fail quietly, so nothing breaks, and the events are
dropped rather than queued. Queuing them was considered and refused on the same
grounds the text box was: a store of unsent events on a public collector is a
different thing to defend, and no question in the spec is answered better by a
run that arrives a day late.

Two things the manifest deliberately does not say are in `services/pwa.js`
rather than here, because a JSON file has nowhere to write them down. The
shorter one is that it sets no orientation: the board a screen gets is decided
by its size, so locking an installed app to portrait would take the landscape
board off a tablet that had cleared the gate.

A boss intake and a superweapon came off this list last, on request, and
together, because neither works without the other. They are the first thing here
to overturn a rule about a mode rather than a rule about the project. This file
said in three places that one-click apply takes no input during an intake, and
now it takes a button three times a run. A second button followed in 1.13.0 and
is the entry below this one.

They qualified on the terms everything above did, and the shape of it is the
usual one. Every number is data: the boss is a seventh entry in `applicants.js`
that no desktop wave list names, the charges and their damage are three fields in
`config/mobile.js`, and the intake is a ninth entry in a list that already had
eight. Nothing already working moved, and that was checked rather than asserted:
intakes one to eight are character for character what the 1.7.0 pass measured, so
the browser runs recorded in the simulator still check a list that exists.
`Applicant.js` was not edited for this either, which is now four features in a
row. And the one genuinely new behaviour, an applicant type carrying its own
arrival cost and its own health bar rule, is two optional fields read where a
default already sat.

What it cost is three things and one of them is a rule. The rule is the one
above, and what survives it is narrower and better stated: the idle abandonment
clock is off on that board because input is not how you tell whether anybody is
there, which was always the real reason and is still true. The second is a
sixteenth property on `game_over` rather than a sixteenth event, argued in the
analytics spec, with a query file that has no check fixture beside it where every
other query file here has one. The third is the shape of the difficulty curve,
and it is the most interesting: a player who keeps the charges has an eighth
intake that 58% of runs survive and a ninth that 47% do, and a player who spends
one to get out of trouble takes the eighth to 94% and the ninth to 30%, so the
run then ends in the ninth or not at all. That is one intake deciding
everything, which is precisely what the 1.7.0 tuning pass took out of this list.
It is now a consequence of something the player chose rather than a property of
the numbers, and the player who declines it gets the curve back, which is the
best available answer and not a complete one.

Two things it deliberately did not buy. The card pool was not touched, so it is
still upside down and still measured, and adding a seventh card would have
invalidated the only measurement this design has. And the boss is not a new
behaviour in `Tower.js`: what makes it a boss is that the turret targets whoever
is closest to the desk and this one is the slowest thing on the board, so it is
ignored until it is too late. That is the note in `config/mobile.js` about the
Career Changer, used on purpose rather than tripped over.

Salary expectations on the phone board came off this list next, on request, and
it is the first thing here that had to overturn a rule in order to be itself
rather than in order to fit. That mode had no placement, deliberately, and a
trap is a spatial decision: free, laid somewhere, sprung by whoever walks onto
it. Take the somewhere away and what is left is not a weaker trap, it is a free
burst of damage on a crowd decided only by when it is pressed, and that is the
bulk reject, which already exists and already has ten thousand runs behind it.
So it either became a placement or it did not come.

It qualified on everything else. Every number is data in `config/mobile.js`.
`entities/Trap.js` is used exactly as it stands, which makes it the fifth feature
running that edits no entity. Laying a pad on open ground rather than on a line
is not new either, since `trapSnapDistance` has been zero in open advert and back
channel since they shipped. And `tower_placed` already fires for traps, so the
event list is still at fifteen.

What it cost is three things. The rule above, rewritten rather than worked
around, and what survives it is that this board still has no route and no
currency, which is what the scene split was really about. A fourth policy
dimension in the simulator, because a control whose value depends on where it
goes cannot be tuned by playing the board twice. And a ceiling that has moved:
the best measured player now holds the vacancy 60.1% of the time against 47.4%
before it, which is what a free renewable control does and is written down next
to the lever that would pull it back.

The interesting part is the number that made it a decision at all. A pad that
waits until somebody treads on it is not a placement on this board, because
everybody walks a straight line to the same desk and a pad dropped anywhere is on
somebody's route: measured, tapping at random did as well as aiming, and better
than thinking about it. A pad that goes stale in six seconds if nobody answers it
is a placement, because half of the random player's are then wasted. That rule
came out of the measurement rather than out of the design, and it is the whole
difference between this and a button.

A second superweapon on the phone board came off this list next, on request, and
it is the first thing here that came off it because the game was too hard rather
than because somebody wanted a feature. Measured, the best play anybody has
modelled held the vacancy 37.5% of the time and lost 63% of the runs that reached
the ninth intake, and a player taking cards at random held it 3.9% of the time.
That is a board somebody can play well and lose, which is a different complaint
from a board that is unfair and has a different answer.

The cheap answer was a fourth bulk reject and it is the wrong one twice. Four
charges is 3,200 damage against 2,600 of boss, which settles the ninth intake by
arithmetic and leaves nothing to decide, and it does nothing at all about the
sixth and seventh, where the run actually bleeds out because one turret cannot
get round a crowd in the time the walk allows. So the second button buys time
rather than damage: everybody applying is told the process is ongoing and walks
at a quarter speed for four seconds, and the turret is never told about it.

It qualified on everything the others did. Every number is data in
`config/mobile.js`. `entities/Applicant.js` is untouched, which is now six
features running, because `setSpeedMultiplier` has been on it since the Take-Home
Task and a slow field on one board and a button on another want the same thing
from it. The leaderboard is untouched, since the ceiling is built from how many
applicants a list sends and this changes neither that nor the weights. And the
event list is still at fifteen.

What it cost is three things. A second extra property on `game_over`,
`holds_used`, argued in the analytics spec, and the argument is not the first
one's repeated:
what the pair buys is which of two buttons drawn the same way gets pressed, which
neither number states alone. A fifth policy dimension in the simulator, because a
control whose value depends on when it is spent cannot be tuned by playing the
board twice. And the ceiling has moved again, further than the pad moved it: the
best measured player is at 76.4% against 60.1%, and the realistic one at 61.4%
against 37.5%.

**`crowd` beating `late` is the finding worth keeping, and it is the second time
this board has taught the same lesson.** The design intends the holds for the
ninth intake, the same way it intends the charges for it, and a player who saves
them for it does eight points worse than one who spends them on whatever crowd is
in front of them. A hold buys shots rather than damage, so it is worth most where
the turret is already saturated, and it is saturated in the sixth long before the
boss turns up; and a charge saved for an intake the run never reaches is worth
nothing, which is `front` beating `cluster` arriving at a button rather than at a
pad.

The honest cost is that the ninth intake is still the whole run and this does not
fix it. What it does is move where the run is decided: the eighth used to end 3%
of the runs that reached it and now ends none, and the ninth used to end 63% and
now ends 39%. That is a curve with a smaller step in it rather than no step, and
the levers are written down next to the numbers.

The Contractor came off this list next, on request, and it is the first thing
here that changes what reaching the vacancy means. Everything before it added to
the game as it stood. A second mode is the same loop given different numbers, a
superweapon is a button and three fields, a pad is a placement. This is an
applicant type whose arrival does not cost a life, on a game whose entire loss
condition is that arrivals cost lives.

It qualified on the terms everything above did, and the shape is the usual one.
Every number is data: the stats, the map of which towers have nothing to say to
it, when it turns up and the whole of the engagement are five blocks in
`applicants.js`, and which boards send it is one field on the mode.
`entities/Applicant.js` gained one argument, which is the seventh feature running
that has not needed it forked or subclassed, and the argument is the thing the
whole feature is about: what a hit from a named process is worth. `Tower.js`
gained no knowledge of who it is shooting at, only of a nought in a map it was
already reading a list beside. Nothing already working moved: the six towers, the
seven types before it, the three wave lists and all four boards are what they
were.

What it cost is four things and one of them is a rule.

The rule is **classic does not move**, and this is the first entry that has to
answer to it honestly rather than by not applying. The mode's survival curve is
untouched, and that is a consequence of the design rather than a claim: a type
that cannot fill the vacancy cannot end a run, so the balancing pass and the
wave one the live experiment varies are both exactly where they were. What does
move is the economy. Up to 120 of budget per engagement, from the fourth intake
on, is a real change to a tuned mode. It is behind a GrowthBook boolean
defaulting to on, and `contractors` on the mode is the narrower lever
underneath it, so both the whole feature and any one board can be turned off
without cutting a release. Neither of those makes the change free, and the
honest statement is that this is the first post-MVP feature that spends some of
classic's tuning rather than working round it.

The second is three events at once, argued in the analytics spec, and a second
key in `variant_assignments`.

The third is the leaderboard's ceiling, which had to be told. It is computed
from the wave lists, so an arrival on no wave list is an arrival the ceiling does
not know can be rejected, and the ceiling is the perfect run. Left alone it would
have refused honest scores from good players, which is the failure mode that
check is least able to afford. `plausibility.js` reads the same
`unscheduled` block the game spawns from, on the same terms it already reads
everything else there.

The fourth is that it is not on the phone board, and that is a refusal rather
than an omission. It costs budget instead of lives and that board has no budget:
it was decided out of the mode, there is nothing to buy and nothing to spend. The
only resource there is the tower's tolerance, which is what lives are called on
that board, so draining it would be a contractor costing lives, which is the one
thing this type exists not to do. Sending it with nothing to drain is not the
same feature wearing a different hat either: an arrival that monopolises the one
turret for eighty seconds and takes nothing is a second boss, on the one board
with a measured survival curve and a simulator behind it. If it is ever wanted
there, what it needs first is something on that board worth draining.

### Still true whatever gets built

- Deploy is not a late step, and a red deploy preview is a failed step.
- Balance lives in data. A post-MVP feature that puts a number in the game loop
  is the wrong shape.
- **Nothing in a run needs the network.** It was true by accident until the game
  became installable and it is a rule now. Every wave, tower, applicant, card,
  sound and chord is in the build, and the five things that do go out, the
  collector, the leaderboard, the health check, GrowthBook and the page
  analytics script, all sit outside a run or fail quietly inside one. The fifth
  is the easiest of them: nothing in the game reads it, so a blocked or
  unreachable tracker is a page that counted one fewer visit and a game that is
  exactly what it was. A feature that asks the network a question
  the game then waits on has broken offline play and will not be noticed by
  anyone testing on a desk.
- The event list stays at eighteen unless there is a question that needs a
  nineteenth. It said fifteen for four versions and the three that took it to
  eighteen arrived together, for one type, and had to clear the bar as a set:
  three events for one feature is the largest addition this list has ever taken
  and the argument for it is in the analytics spec rather than here. What did
  not move is the bar itself, and the two refusals underneath it are worth
  repeating, because both were live options for that type. A contractor reaching
  the desk is not an `applicant_leaked`, since nothing leaked and that column
  would then mean two things. How much budget one drained is not a property on
  `game_over`, since a run can hold several engagements at once and a property
  holds one number.
  All of the ones before them cleared the same bar, and the bar is
  that the question cannot be answered any other way. The thirteenth was added
  because an exposure could not be recorded anywhere else. The fourteenth was
  added because question 2 asks whether the difficulty curve is right and no
  amount of counting where runs ended says whether losing there felt earned,
  which is a different fix from a wave being too heavy. The fifteenth was added
  because question 4 asks which things are dead weight and a card offered and
  refused leaves no trace at all, so counting what was taken cannot recover it.
  The sixteenth was refused, and the boss intake and the bulk reject shipped
  without one: how many charges a run spent is a property on `game_over`, which
  is the seam `mode` went through, and a boss getting in is an
  `applicant_leaked` with a type on it that the event has always carried.
  The second superweapon shipped in 1.13.0 without one either, on the same seam
  and against the same bar: how many of a run's holds were spent is a fact about
  the run, and the question the pair of counts answers, which of two buttons
  goes unpressed, cannot be got at by counting anything else.
  A feature existing is not a reason on its own. Sound shipped without one, and
  so did the whole of the second mode: towers going offline is the most eventful
  thing in it and it emits nothing, because no question in the spec asks how
  often that happens. A property is not an event, which is the seam `mode` went
  through. The third mode emits nothing new either: applicants choosing a
  different way in is the most eventful thing in it and no question in the spec
  asks how often they do it. Nor does the fourth mode emit anything for being a
  phone, since `device_type` has been a global property since launch.
- **Qualitative stays closed.** The one question the game asks has four fixed
  answers and it is not a way in for a text box later. An open field on a public
  unauthenticated collector is a different thing to defend, needs the name rules
  the leaderboard has and then some, and needs somebody to read it. If prose is
  ever genuinely wanted, the Ko-fi link and the launch post are already the
  channel for it.
- **Classic does not move.** It is the mode with a balancing pass behind it, a
  leaderboard with real scores on it and a live experiment reading its wave one.
  A change that retunes it to suit something else has broken all three.
  The Contractor is the one thing that has been let past this, on purpose and
  with the cost written down under "Beyond the MVP": it leaves the survival curve
  and wave one alone because it cannot end a run, and it does spend some of the
  mode's economy. That is the precedent and it is a narrow one. Anything that
  moves what an intake sends, what a tower does or what a run is scored at is
  still refused.

## Versioning

The game carries a version number and it moves whenever something worth
releasing ships.

- **`package.json` is the single source of truth.** The version lives there and
  nowhere else. The home page footer shows it, read out of the file at build
  time by `vite.config.js` and handed to the game by `config/version.js`, so
  the number is never typed in a second place.
- **Bump it in the pull request that makes the change**, so the version and the
  code it describes land together. A PR that changes what the player gets and
  leaves the version alone is unfinished.
- **Semver, read loosely.** Patch (`1.0.1`) for fixes, copy edits and balance
  tuning. Minor (`1.1.0`) for a new feature, a new tower, a new applicant type
  or anything that adds to what the game does. Major (`2.0.0`) is reserved for
  something that changes what the game is, and it is not expected soon.
- **Small still counts.** A tuning pass or a corrected line of copy is a patch
  bump, not nothing. The point is that every release has a number attached to
  it.
- **Work that never reaches a player does not bump it.** Documentation, analysis
  notes, queries, tooling and CI changes leave the version where it is.
- **`CHANGELOG.md` records the bumps.** Newest version at the top, a heading per
  version with the date, and a line or two per change in the same voice as the
  rest of the repo. Write the entry in the PR that does the bump, not in a
  sweep afterwards. It is a developer record and it is not shown to players,
  so there is still nothing user facing to keep in step.
- **A line the player would not notice does not need a line in the changelog.**
  If the version did not move, there is nothing to write.

Version `1.0.0` is the shipped MVP.

## Working style

- **One step per branch, one branch per pull request.** Name the branch for the step. Open the PR and stop. Do not merge.
- **Every PR must build cleanly on Netlify.** A red deploy preview is a failed step, not a detail to tidy up later.
- In the PR description, say what to look at on the preview URL and what should be visible.
- Small commits, present tense, UK English.
- Do not refactor working code without being asked.
- If a step is taking much longer than expected, say so and propose a simpler version rather than continuing.
- Ask before adding a dependency.
- Bump the version in `package.json` and write the `CHANGELOG.md` entry in any PR whose change reaches the player. See "Versioning" above.

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
| Sound | Synthesised by `tools/make-sounds.mjs`, committed as WAV |
| Music | Scheduled on the audio clock from `config/music.js`, no file |
| Backend | Supabase (leaderboard and analytics, both behind Netlify functions) |
| Experiments | GrowthBook |
| Domain | ats.spencerstern.com |

Keep dependencies minimal. If a task can be done with vanilla JS in twenty lines, do not add a package.

## How this project is worked on

Development happens through Claude Code on the web. Sessions run in the cloud, so **there is no local dev server anyone can look at.** The Netlify deploy preview on each pull request is the only way the game gets seen.

This shapes everything below. Deploy is not a late step. It was step 2, nothing proceeded until a preview URL rendered the game, and the same rule applies to every change made since.

## Concept

The player is Requisita, an applicant tracking system. Applicants advance along a path towards an open vacancy. The player places screening mechanisms (towers) to reject them before they arrive. Applicants who reach the vacancy cost the player a life. The joke is that the player is doing the rejecting, and that the tools are recognisably the ones real systems use.

### Modes

Three, chosen on the home screen, and they share every tower, every applicant type and the whole game loop. What differs is data in `config/modes.js`.

| Mode | What it is |
| --- | --- |
| Classic intake | The game as it shipped. One corridor, walked in single file, towers beside it. Every number in it is the number it already had. |
| Open advert | No corridor. Applicants arrive across the whole left edge and converge on the desk, fanning out and squeezing according to the `spread` on each waypoint. Towers go anywhere off the HUD and the desk, traps go wherever they are put, and applicants push back. |
| Back channel | No route at all. A floor, a desk in the corner of it, and applicants who work out their own way across. Every tower makes the ground it covers expensive rather than impassable, and how far out of their way they will go to avoid it is a property of the applicant type. |

**The crowd is still not pathfinding.** Open advert is waypoints, same as the path always was. Each applicant walks its own copy of the spine, displaced by its share of the spread at every point and tapering to zero at the vacancy so everybody converges on the one desk. Applicant.js did not change to allow it and should not have to.

**Back channel is pathfinding, and it is the exception this file spent two modes refusing.** It was allowed for one reason: applicants routing round the process is the joke the whole game has been telling, and there is no way to tell it with a line drawn in advance. What it had to keep in exchange is written down under "Beyond the MVP", and the short version is that everything it varies is still data.

**Nothing in it is ever blocked.** A tower adds `threat` to the cells inside its range, an applicant takes the cheapest way to the desk rather than the shortest, and `caution` on the type decides how much that costs it. So there is no maze to build and no route to seal by accident, which is why placement needed no new rule and why a tower can never be refused on the grounds that it would trap somebody. A screening process nobody can get round is not a screening process, it is a locked door.

Applicant.js did change for this one, in two places, and both were already wrong before it: what a tower targets is now distance left to the desk rather than a fraction of a path, which is the same applicant in classic and stops being the same applicant the moment two people are on routes of different lengths; and a walk can be restarted from where somebody is standing, which is the whole of what a re-route is.

**Pushing back is open advert only.** Applicants near a tower wear its `integrity` down; a tower worn to nothing is suspended pending review for a few seconds and comes back at full integrity. Recovery is applied against incoming pressure rather than after it, which is what makes one applicant harmless and a crowd a problem. Suspension rather than destruction, because losing a tower outright to a crowd whose edges you cannot see is a punishment rather than a decision. That is one number in `modes.js` if it should ever become the other.

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

Names and flavour text are content, not code. Keep all strings in a single `src/content/copy.js` so tone can be edited in one place.

## Architecture

```
src/
  main.js              Phaser config, support check and boot
  scenes/
    BootScene.js       Asset loading, art and sound
    HomeScene.js       The page the game opens on
    GameScene.js       Core loop
    UIScene.js         HUD, overlaid on GameScene
    GameOverScene.js   Score, leaderboard, restart
    LeaderboardPanel.js  Top ten, shared by home and game over
    backdrop.js        The office floor, shared by home and board
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
    path.js            Waypoint coordinates per mode, and the one board that has none instead
    version.js         The version the build was cut from
    art.js             Sprite manifest
    scenery.js         Ground and furniture manifest, and where it stands
    audio.js           Sound manifest, levels and repeat gaps
    music.js           The chords the background music is played from
    intros.js          Applicant introduction manifest, frames and rate
    leaderboard.js     Name rules and read limits
    links.js           Outbound links
  services/
    analytics.js       Event emission
    audio.js           Playback, throttling and the on or off state
    music.js           Books the next bar or two onto the audio clock
    feel.js            The small movements, and the one place that knows to sit still
    experiments.js     GrowthBook wrapper
    mode.js            Which mode the current run is
    routing.js         The cost field, and the routes read out of it
    leaderboard.js     Score submission and top ten
    nameInput.js       The invisible field a touchscreen types a name into
  content/
    copy.js            All user-facing strings
netlify/functions/     collect, health, leaderboard, submit-score, and their lib
supabase/migrations/   Tables, RLS policies and later columns
tools/make-sounds.mjs  Draws the sound effects, run by hand
tools/make-textures.mjs  Draws the ground and the furniture, run by hand
tools/make-intros.mjs  Draws the applicant introductions, run by hand
docs/                  Analysis notes, their queries and the fixtures
netlify.toml           Build command, publish directory, Node version
vite.config.js         Puts the package.json version into the build
CHANGELOG.md           One entry per version, newest first
```

**Balance lives in data, not code.** `waves.js`, `towers.js` and `applicants.js` must be plain exported objects with no logic. Tuning is the longest phase of this project and it must not require touching game logic.

**Two of the three boards are hardcoded waypoints.** An array of coordinates in `config/path.js`, and that is still the default answer for anything new. The third is a field in the same file, and it took a reason to get there rather than a preference.

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

`mode` is the seventh and arrived with the second game mode. It is a property rather than a fourteenth event because it is not a thing that happens: it is a fact about the run every other event is already reporting, and without it all six questions above have one answer per mode with no way to tell them apart. A third mode cost it nothing, which is the point of having put it on a property. It is on `session_started` too, where it records the setting rather than a decision, since nothing has been played yet.

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

`experiment_viewed` is the one event the game does not send. It comes from
GrowthBook's tracking callback, fires once per session, and only when a player
was genuinely bucketed, which is the difference between it and the arm string
carried on everything else. It was added after the twelve above, because
without it there is no record of an exposure anywhere and a variant assignment
read back off an event cannot tell a real control player from a run that never
reached GrowthBook.

`run_abandoned` fires on `beforeunload`, after 30 seconds of the tab staying hidden, and after 60 seconds of no input. It fires at most once per run, and `reason` says which of the three it was: `unload`, `hidden` or `idle`.

Two more reasons arrived with the pause screen, which gave a run in progress a way out that it did not have before: `restart` when the player starts another run from it, and `quit` when they go back to the home screen. Both are the same thing the other three are, a run that ended without a `game_over`, so they are reasons rather than a fourteenth event. The early abandonment metric already filters on reason, so nothing it was measuring moves.

The delay on hidden and the `reason` property were both added after launch preparation, because firing the instant the tab was hidden meant the event recorded the first time somebody glanced away, and since it only fires once, their real exit was never recorded at all. A player abandoned at wave five and went on to reach wave eight.

It will still be lossy. A tab closed from a background window may never run the handler, and a player watching a long wave without moving the mouse is counted as idle. That is expected and will be stated in the write-up rather than hidden.

Send every event. No sampling at this traffic level.

## Experiment

One experiment at launch, via GrowthBook.

**Starting difficulty.** Control: gentle wave one. Variant: wave one already busy. Measured on the wave-by-wave survival curve and on `run_abandoned` rate in the first three waves.

Wave one parameters are read from the GrowthBook assignment at run start rather than hardcoded, which is what makes this possible. Keep it that way.

It varies **classic** wave one and only classic wave one. Every other mode has its own opening and is handed its own list untouched, because swapping a classic wave into one would measure a wave the player never played. The arm is still reported on those runs, since the player was still bucketed, so the analysis filters on `mode` to leave them out rather than quietly widening one side.

Record the intended analysis before launch. An inconclusive result is a valid outcome and will be reported as one.

## Leaderboard

Assume it will be attacked. Client-submitted scores are trivially forged.

- One board per mode, on a `mode` column rather than a second table. Same name checks, same rate limit, same one submission per run: only the ordering and the plausibility ceiling are per mode. **A new mode is a migration.** The functions read the mode list out of `config/modes.js`, but the check constraint on the column cannot, so the database is the one place a mode has to be written down by hand and the one place that will refuse a score for a mode the rest of the game already offers. A rating from a mode that sends half again as many applicants is not comparable with one that does not, and ranking them together would rank the modes rather than the players.
- Supabase table with Row Level Security enabled from the start.
- Anon key may insert and select. It may not update or delete.
- Score submission goes through a server-side function that validates plausibility (score consistent with wave reached, within a sane ceiling) and rate limits by IP. Either a Netlify function or a Supabase edge function. Netlify is likely simpler, since it lives in this repo and deploys with the site. Decide at implementation time and note the reasoning in the PR.
- Display names: length capped at 16 characters, filtered against a profanity list, restricted character set.
- Top ten read only. No full-table reads from the client.

Free tier Supabase projects pause after seven days of inactivity. Add a GitHub Actions cron that pings the database twice weekly to keep it alive.

## Accessibility and platform

- Desktop first. If mobile is not properly supported at launch, show an honest "desktop only" message rather than a broken layout. It was not, and it did. Tablets came in afterwards, once a finger had a way to see a tower's range before committing to it, and the message is now shown to phones only. The rule is unchanged for whatever is next: an honest refusal beats a broken layout.
- Test in Chrome, Safari and Firefox before announcing.
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

Music followed it, on the same request and on the same terms, and the
interesting part is that it has no asset. Nothing here can reach an asset host,
an uncompressed loop worth listening to is twenty times the size of every other
asset in the game put together, and there is no encoder on the machine to make
it any smaller. So the track is four chords of hold music in `config/music.js`,
booked onto the audio clock a bar ahead by `services/music.js`, with one note
per bar picked at random so a long run never quite hears the same loop twice.
It costs no bytes, and the difference between pleasant and irritating is a
number in a config file rather than a hunt for a replacement track.

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
get the message.

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

### Still true whatever gets built

- Deploy is not a late step, and a red deploy preview is a failed step.
- Balance lives in data. A post-MVP feature that puts a number in the game loop
  is the wrong shape.
- The event list stays at thirteen unless there is a question that needs a
  fourteenth. The thirteenth was added because an exposure could not be
  recorded any other way, and that is the bar. A feature existing is not a
  reason on its own. Sound shipped without one, and so did the whole of the
  second mode: towers going offline is the most eventful thing in it and it
  emits nothing, because no question in the spec asks how often that happens.
  A property is not an event, which is the seam `mode` went through. The third
  mode emits nothing new either: applicants choosing a different way in is the
  most eventful thing in it and no question in the spec asks how often they do
  it.
- **Classic does not move.** It is the mode with a balancing pass behind it, a
  leaderboard with real scores on it and a live experiment reading its wave one.
  A change that retunes it to suit something else has broken all three.

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

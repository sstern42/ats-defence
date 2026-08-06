# ATS Defence

A browser tower defence game where you are the applicant tracking system, and the applicants are the problem.

**[Play it](https://ats.spencerstern.com)**

![The board mid intake: screening towers along a winding path, applicants walking towards an open vacancy](public/og-image.png)

## The idea

Applicants advance along a path towards a single open vacancy. You place screening mechanisms to reject them before they arrive. Anyone who gets through costs you a life, because somebody then has to read their application properly and might hire them.

The joke is that you are the one doing the rejecting, and that the tools are recognisably the ones real systems use. Keyword Filter. Knockout Question. Take-Home Task. Culture Fit Panel. Video Screen. Salary Expectations, which is free to ask and only works once.

The applicants know the game too. The Keyword Stuffer is immune to keyword matching. The Referral starts a third of the way down the path. The Boomerang comes back at the end of the intake whether you rejected it or not.

## Running it

```bash
npm install
npm run dev
```

Requires Node 22. `npm run build` produces `dist`, which is what Netlify publishes.

Two optional environment variables, neither of them secret, both documented in `.env.example`. Everything that is a secret lives in the Netlify environment and never in a `VITE_` variable, because Vite inlines those into the client bundle.

## How it is built

| Concern | Choice |
| --- | --- |
| Engine | Phaser 4 |
| Build | Vite |
| Language | Vanilla JS |
| Hosting | Netlify |
| Backend | Supabase, behind Netlify functions |
| Experiments | GrowthBook |

**Balance lives in data.** `src/config/waves.js`, `towers.js`, `applicants.js` and `game.js` are plain exported objects with no logic in them, so tuning never means touching the game loop. The path is a hardcoded list of waypoints. There is no pathfinding and there is not going to be.

**Copy lives in one file.** Every user-facing string is in `src/content/copy.js`.

**The browser holds no database key.** Both the leaderboard and the analytics collector go through Netlify functions holding the service role key. The tables have row level security on with no policies at all, so the anonymous role can do nothing. Submitted scores are checked server side against a ceiling recomputed from the same wave data the game plays from.

## Instrumentation

Thirteen events, six global properties on every one of them, all landing in Supabase. The intent was to answer specific questions rather than to collect telemetry in general: where players quit, whether the difficulty curve is right, whether they replay after losing, which towers are dead weight.

It has already earned its keep twice. The wave curve for the balancing pass was read off these events rather than guessed at, and the first real run through the collector exposed a bug in the abandonment tracking that would otherwise have quietly ruined the experiment's secondary metric.

The dead weight question has its own queries in `docs/tower-usage.sql`: reach rather than raw placements, since the one trap is free and single use and would otherwise top every count, and a separate query for whether an unused tower is unwanted or merely unaffordable, which have opposite fixes. It also contains the query for which towers win games, together with the reason that query cannot answer it.

The other five questions are in `docs/leaderboard-and-players.sql`, and most of that file leans on the leaderboard, because a board row carries the id of the run that produced it. An entry is therefore a whole run rather than a name and a number: the towers it placed, the wave it died on, how long it took. It is also where the question about whether the board drives replays had to be reworded. The panel emits its view event whenever it renders rows, on both screens, so nearly every game over produces one, and comparing players who saw the board against players who did not compares working networks with broken ones. What a player actually chooses on that screen is whether to submit, and what the board decides is whether their name went on it, so those are what the queries compare instead. `docs/leaderboard-and-players-check.sql` is the fixture the arithmetic was checked against before any of it met real rows, with six deliberate traps in it.

One experiment runs at launch, on whether a busier first wave reduces early abandonment. The analysis was written down beforehand, including the part where the sample size is probably too small to conclude anything. See `docs/experiment-starting-difficulty.md`, and `docs/experiment-starting-difficulty.sql` for the queries that produce the numbers.

GrowthBook does the bucketing and nothing else. There is no data source behind it, so the results are read out of Supabase rather than off its dashboard. The thirteenth event, `experiment_viewed`, is GrowthBook's own record that a player was bucketed, which is the one thing the arm string on every other event cannot tell you: a genuine control assignment and a run that never reached GrowthBook look identical otherwise.

## Platform

Desktop and tablet. Phones get an honest message instead of a broken board.

Placing a tower means seeing what it would take before committing to it, which a mouse does by hovering. A finger cannot hover, so on a touchscreen the two halves become pressing and lifting: the preview follows the drag and the tower lands where the finger comes off. It is drawn above the finger rather than under it, since a fingertip covers most of a cell. Which route an event takes is decided per event rather than once at boot, so a laptop with a touchscreen works either way, and both routes end in the same placement code.

The gate is the size of the screen and nothing else: 900 by 600, or the message. No phone clears both in either orientation, so phones are turned away without having to be named, and a tablet clears them and renders the fixed 1024 by 768 board at close to its own size.

The leaderboard takes a tablet too, which it did not at first. A soft keyboard only opens for a real form field, and only when the player's own tap lands on it, so there is an invisible one sat exactly over the name box the game draws. It filters what it is given by the same rules the key presses went through, hands the text back and is never seen: the box, the letters and the caret are all still drawn on the canvas. It is only built where the pointer is coarse, so the keyboard route is untouched, and the game is lifted clear while the field has focus, since the keyboard covers the half of the screen the box sits in.

## Art

Sprites from [Kenney](https://kenney.nl)'s Tower Defense (top-down) pack, CC0. Towers, applicants, traps and the two hit effects are his. The board itself is not: the path, the grid, the vacancy and the range rings are all still drawn at runtime, because the pack is bright cartoon grass and this game is meant to look like a piece of software nobody enjoys using.

The art is greyscale on disk and tinted per type at runtime, so a tower's colour is a number in `towers.js` rather than a file, and one sprite can serve two applicants. Which sprite anything uses is data too. `art.js` lists the files, `BootScene` loads them, and `towers.js` and `applicants.js` name the one they want.

Every file was cropped, most were greyscaled and the turrets were turned a quarter turn. `public/assets/kenney/ATTRIBUTION.md` records what was done to each one and which original it came from.

## Introductions

The first time an applicant type turns up, it gets a card under the HUD with its
name, its one awkward habit and a short looping animation of it. The Graduate
throws a cap that does not come back. The Career Changer's CV is still unrolling
when the frame runs out. The Overqualified stacks qualifications past the
ceiling, the Keyword Stuffer fills a page in until there is nothing left on it to
read, the Referral's barrier lifts well before they reach it, and the Boomerang
comes back. The card does not stop the wave, since a type usually arrives in the
middle of one.

A found clip would have been funnier and was not an option: this repository is
public, every other asset in it is CC0, and stock footage of somebody's actual
graduation is neither ours to ship nor especially kind to the person in it. So
`tools/make-intros.mjs` draws all six out of circles and rectangles, using Node
built-ins and no dependency, and writes them out as sprite strips. They are
greyscale like the rest of the art and tinted with the applicant's own colour, so
the card and the thing walking down the path are recognisably the same person.
See `public/assets/intros/README.md`.

## Sound

Six clips: a stamp when a process is installed, a flat two tone blip for a
rejection, a low buzz when somebody reaches a human, notes up when applications
open and down when the intake is screened, and a dead thud when the budget will
not stretch to it. On by default, at a volume set for a browser tab next to
other things, and turned off by the toggle in the corner of the HUD or the M
key. The choice is remembered.

None of it is recorded. `tools/make-sounds.mjs` draws all six out of sine waves
and envelopes, using Node built-ins and no dependency, which means each sound is
a readable recipe rather than a binary and the whole set is 68kB. Levels and the
gap between repeats are data in `src/config/audio.js`, on the same principle as
the balance. See `public/assets/audio/README.md`.

## Licence

MIT.

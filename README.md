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

One experiment runs at launch, on whether a busier first wave reduces early abandonment. The analysis was written down beforehand, including the part where the sample size is probably too small to conclude anything. See `docs/experiment-starting-difficulty.md`, and `docs/experiment-starting-difficulty.sql` for the queries that produce the numbers.

GrowthBook does the bucketing and nothing else. There is no data source behind it, so the results are read out of Supabase rather than off its dashboard. The thirteenth event, `experiment_viewed`, is GrowthBook's own record that a player was bucketed, which is the one thing the arm string on every other event cannot tell you: a genuine control assignment and a run that never reached GrowthBook look identical otherwise.

## Platform

Desktop only. Placing a tower means hovering a tile to see its range before committing, and a finger cannot hover. Smaller screens get an honest message instead of a broken board.

## Art

Sprites from [Kenney](https://kenney.nl)'s Tower Defense (top-down) pack, CC0. Towers, applicants, traps and the two hit effects are his. The board itself is not: the path, the grid, the vacancy and the range rings are all still drawn at runtime, because the pack is bright cartoon grass and this game is meant to look like a piece of software nobody enjoys using.

The art is greyscale on disk and tinted per type at runtime, so a tower's colour is a number in `towers.js` rather than a file, and one sprite can serve two applicants. Which sprite anything uses is data too. `art.js` lists the files, `BootScene` loads them, and `towers.js` and `applicants.js` name the one they want.

Every file was cropped, most were greyscaled and the turrets were turned a quarter turn. `public/assets/kenney/ATTRIBUTION.md` records what was done to each one and which original it came from.

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

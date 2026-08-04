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
| Backend | Supabase (leaderboard only) |
| Experiments | GrowthBook |
| Domain | ats.spencerstern.com (pointed at Netlify once the game runs) |

Keep dependencies minimal. If a task can be done with vanilla JS in twenty lines, do not add a package.

## How this project is worked on

Development happens through Claude Code on the web. Sessions run in the cloud, so **there is no local dev server anyone can look at.** The Netlify deploy preview on each pull request is the only way the game gets seen.

This shapes everything below. Deploy is not a late step. It is step 2, and nothing proceeds until a preview URL renders the game.

## Concept

The player is Requisita, an applicant tracking system. Applicants advance along a path towards an open vacancy. The player places screening mechanisms (towers) to reject them before they arrive. Applicants who reach the vacancy cost the player a life. The joke is that the player is doing the rejecting, and that the tools are recognisably the ones real systems use.

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
  main.js              Phaser config and boot
  scenes/
    BootScene.js       Asset loading
    GameScene.js       Core loop
    UIScene.js         HUD, overlaid on GameScene
    GameOverScene.js   Score, leaderboard, restart
  entities/
    Applicant.js
    Tower.js
  config/
    waves.js           Wave definitions as data
    towers.js          Tower stats as data
    applicants.js      Applicant stats as data
    path.js            Waypoint coordinates
  services/
    analytics.js       Event emission
    experiments.js     GrowthBook wrapper
    leaderboard.js     Supabase client
  content/
    copy.js            All user-facing strings
netlify.toml           Build command, publish directory, Node version
```

**Balance lives in data, not code.** `waves.js`, `towers.js` and `applicants.js` must be plain exported objects with no logic. Tuning is the longest phase of this project and it must not require touching game logic.

**Path is hardcoded waypoints.** No pathfinding. An array of coordinates in `config/path.js`.

## Build order

Do not jump ahead. Each step should leave the game running, and each step is its own pull request.

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

The custom domain (ats.spencerstern.com) gets pointed at Netlify around step 8, once there is a game worth showing at a real address.

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

`session_id`, `run_id`, `wave_number`, `variant_assignments`, `device_type`, `referrer`

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

The delay on hidden and the `reason` property were both added after launch preparation, because firing the instant the tab was hidden meant the event recorded the first time somebody glanced away, and since it only fires once, their real exit was never recorded at all. A player abandoned at wave five and went on to reach wave eight.

It will still be lossy. A tab closed from a background window may never run the handler, and a player watching a long wave without moving the mouse is counted as idle. That is expected and will be stated in the write-up rather than hidden.

Send every event. No sampling at this traffic level.

## Experiment

One experiment at launch, via GrowthBook.

**Starting difficulty.** Control: gentle wave one. Variant: wave one already busy. Measured on the wave-by-wave survival curve and on `run_abandoned` rate in the first three waves.

This requires wave one parameters to be read from the GrowthBook assignment at run start, not hardcoded. Build it that way from step 7 onward.

Record the intended analysis before launch. An inconclusive result is a valid outcome and will be reported as one.

## Leaderboard

Assume it will be attacked. Client-submitted scores are trivially forged.

- Supabase table with Row Level Security enabled from the start.
- Anon key may insert and select. It may not update or delete.
- Score submission goes through a server-side function that validates plausibility (score consistent with wave reached, within a sane ceiling) and rate limits by IP. Either a Netlify function or a Supabase edge function. Netlify is likely simpler, since it lives in this repo and deploys with the site. Decide at implementation time and note the reasoning in the PR.
- Display names: length capped at 16 characters, filtered against a profanity list, restricted character set.
- Top ten read only. No full-table reads from the client.

Free tier Supabase projects pause after seven days of inactivity. Add a GitHub Actions cron that pings the database twice weekly to keep it alive.

## Accessibility and platform

- Desktop first. If mobile is not properly supported at launch, show an honest "desktop only" message rather than a broken layout.
- Test in Chrome, Safari and Firefox before announcing.
- Open Graph title, description and image, since the launch happens on LinkedIn and the card preview matters.

## Definition of done for MVP

- Playable start to finish, win and lose states both reachable.
- Six towers, six applicant types, at least ten waves.
- Deployed at ats.spencerstern.com over HTTPS.
- All twelve events firing and verified landing in the analytics store.
- Leaderboard live, validated server-side, RLS on.
- One GrowthBook experiment running.
- Ko-fi link present and unobtrusive.
- README with a one-line pitch, a screenshot and a link to play.

## Explicitly out of scope

Tower upgrades, multiple maps, sound, difficulty settings, user accounts, saved progress, mobile-specific controls, achievements. These are post-launch decisions to be informed by the data. Do not add them because they seem easy.

## Working style

- **One step per branch, one branch per pull request.** Name the branch for the step. Open the PR and stop. Do not merge.
- **Every PR must build cleanly on Netlify.** A red deploy preview is a failed step, not a detail to tidy up later.
- In the PR description, say what to look at on the preview URL and what should be visible.
- Small commits, present tense, UK English.
- Do not refactor working code without being asked.
- If a step is taking much longer than expected, say so and propose a simpler version rather than continuing.
- Ask before adding a dependency.

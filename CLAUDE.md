# ATS Defence

Browser tower defence where the player is the Applicant Tracking System, defending a single vacancy from waves of applicants.

## Non-negotiables

Read these before writing anything.

- **UK English.** Everywhere. Code comments, commit messages, in-game copy, README.
- **No em dashes.** Use commas, full stops or brackets.
- **Tone: dry and understated.** Wry, never bitter. The system is the butt of the joke, not the applicants. If a line reads as angry about the job market, rewrite it.
- **Parody vendor names only.** No real ATS vendors (Workday, Greenhouse, Taleo, Lever, Bullhorn and so on) anywhere in code, assets, copy or comments. The in-game product is called **Requisita**.
- **No secrets in the repo.** Only the Supabase anon key ever touches client code. No service role key in the repo, in Netlify environment variables exposed to the build, or in any committed file.

## Stack

| Concern | Choice |
| --- | --- |
| Engine | Phaser 3 |
| Build | Vite |
| Language | Vanilla JS (no TypeScript, no framework) |
| Hosting | Netlify, auto-deploy from `main` |
| Repo | `sstern42/ats-defence`, public, MIT |
| Art | Kenney CC0 assets |
| Backend | Supabase (leaderboard only) |
| Experiments | GrowthBook |
| Domain | ats.spencerstern.com |

Keep dependencies minimal. If a task can be done with vanilla JS in twenty lines, do not add a package.

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
  services/
    analytics.js       Event emission
    experiments.js     GrowthBook wrapper
    leaderboard.js     Supabase client
  content/
    copy.js            All user-facing strings
```

**Balance lives in data, not code.** `waves.js`, `towers.js` and `applicants.js` must be plain exported objects with no logic. Tuning is the longest phase of this project and it must not require touching game logic.

**Path is hardcoded waypoints.** No pathfinding. An array of coordinates in `waves.js` or a dedicated `path.js`.

## Build order

Do not jump ahead. Each step should leave the game running.

1. Vite plus Phaser scaffold, dev server, one sprite rendering.
2. Waypoint path, applicants spawning and walking it.
3. One tower: click to place, range detection, targeting, damage, applicant death.
4. Lives, vacancy damage on leak, game over state.
5. Deploy to Netlify. Get a live URL before adding anything else.
6. Currency, tower cost, second and third tower types.
7. Waves as a structure, wave counter, between-wave pause.
8. Remaining towers and applicant types.
9. Analytics instrumentation.
10. Supabase leaderboard.
11. GrowthBook experiment.
12. Balancing pass. Budget more time than seems reasonable.

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
| `run_abandoned` | final_wave, run_duration_ms |
| `restart_clicked` | from_wave, previous_score |
| `score_submitted` | score, final_wave |
| `leaderboard_viewed` | from_screen |
| `kofi_clicked` | from_screen, final_wave |

`run_abandoned` fires on `visibilitychange` and `beforeunload`, and after 60 seconds of no input. It will be lossy. That is expected and will be stated in the write-up rather than hidden.

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
- Score submission goes through a Supabase edge function that validates plausibility (score consistent with wave reached, within a sane ceiling) and rate limits by IP.
- Display names: length capped at 16 characters, filtered against a profanity list, restricted character set.
- Top ten read only. No full-table reads from the client.

Free tier projects pause after seven days of inactivity. Add a GitHub Actions cron that pings the database twice weekly to keep it alive.

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

- Small commits, present tense, UK English.
- Do not refactor working code without being asked.
- If a step is taking much longer than expected, say so and propose a simpler version rather than continuing.
- Ask before adding a dependency.

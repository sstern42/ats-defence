# Experiment: starting difficulty

Written before launch, on purpose. An analysis decided after seeing the numbers
is not an analysis, it is a search. An inconclusive result is a valid outcome
and will be reported as one.

## Question

Does opening the game with a busier first wave change how far players get, and
how many of them leave in the first few minutes?

The worry it comes from: wave one in the control arm is five Graduates over
eight seconds, which is quiet enough that a player may conclude nothing is
happening and close the tab before the game has shown them anything.

## Arms

| Arm | Wave one |
| --- | --- |
| `control` | 5 Graduates, 1600ms apart |
| `busy` | 9 Graduates 900ms apart, then 5 more 700ms apart from 7 seconds |

Both arms are Graduates only, and waves two onwards are identical. The
experiment is about how the game opens, not about how it goes on.

The definitions live in `src/config/waves.js` as `WAVE_ONE_VARIANTS`. Neither
arm is hardcoded into the game loop.

## Assignment

- Split 50/50, decided by GrowthBook on the feature `starting-difficulty`.
- Hashed against a stable anonymous id in local storage, so a returning player
  stays in the arm they started in.
- Assigned once at start-up and held for the session. It cannot move under a
  run.

Runs that were not really assigned are labelled rather than folded into
control. In `variant_assignments`, a genuine assignment is the arm on its own
(`control`, `busy`); anything else carries its source (`forced:busy` from the
preview query parameter, `unassigned:control` when GrowthBook did not answer).

**Every analysis below excludes any run whose assignment string contains a
colon.** Those are previews and failures, not players.

GrowthBook also reports the bucketing itself, through its tracking callback,
and that goes out as an `experiment_viewed` event carrying `experiment_key`,
`variation_id` and `arm`. It fires once per session and only for a genuine
assignment, so it is the stronger record of the two: the arm string says what
the game played, the exposure says the player was really put in the experiment.

It is a cross-check rather than the definition of an assigned run, because it
only exists from the deploy that added it and runs before that have none. The
bucketing id is not on it. That id stays in local storage, so an exposure joins
to the rest of a run by `session_id` like everything else, which means a player
who comes back tomorrow appears as two sessions rather than one person. The
arm is the same in both, so nothing crosses between arms, but any per-person
count read off exposures would be an overcount.

## Metrics

### Primary: wave-by-wave survival

For each arm, the proportion of runs that reached wave N, for N from 1 to 10.

- Denominator: runs with a `game_started` event.
- Numerator at wave N: runs with a `wave_started` event where
  `wave_number >= N`.

Read as a curve rather than a single number. The interesting shape is whether
the arms separate early and then converge, which would mean the busy opening
costs players at the start and nothing after.

### Secondary: early abandonment

Proportion of runs with a `run_abandoned` event where `final_wave <= 3` **and
`reason` is `unload` or `idle`**, divided by all runs with a `game_started`
event, per arm.

The `reason` filter matters. The first real run through the collector produced
a `run_abandoned` at wave five from a player who went on to reach wave eight:
the event fired the moment they glanced at another tab. Since it fires at most
once per run, their actual exit was then never recorded. Hiding the tab now
starts a thirty second clock that is cancelled if they come back, and the reason
is recorded so a departure can be told from a glance.

The filter also keeps the pause screen out of this number. Leaving a run from it
records `run_abandoned` with a reason of `quit` or `restart`, which is a player
deciding something rather than a player disappearing, and is a different
question from the one this metric asks. It is a real quit and worth reading, but
not here, and not mixed in with the two the filter keeps.

This is still the lossiest thing measured here. A tab closed from a background
window may never run the handler at all, and a player who watches a long wave
without touching anything is counted as idle after sixty seconds. Both failure
modes should fall roughly equally on both arms, since nothing about the arms
changes how the event fires, so a difference between arms remains readable even
though neither absolute number is trustworthy.

### Guardrail: reaching the end

Proportion of runs with `game_over` where `final_wave = 10`, per arm. A busy
opening that improves retention by making the whole game easier to lose early
is not a win worth having.

## Analysis

Two-proportion z-test on the secondary metric, and on the survival proportion
at wave 3 as the single summary of the primary curve. Significance at p < 0.05,
two-tailed. No interim peeking: the numbers get looked at once, at the stopping
point below.

The queries are in `docs/experiment-starting-difficulty.sql`, written against
the `analytics_events` table and meant to be run in the Supabase SQL editor.
They are committed so the readout is the same one every time it is taken,
rather than reassembled from this document on the day. Postgres has no normal
distribution function, so they report the z statistic and the 95% interval
rather than a p-value.

Nothing computes any of this on a schedule. GrowthBook is doing assignment
only, with no data source behind it, so its own results page stays empty and
the numbers below exist when somebody runs the file.

## Power, honestly

Assume a baseline early-abandonment rate somewhere near 30%. To detect a 10
percentage point absolute difference at 80% power and 5% significance needs
roughly **340 assigned runs per arm**, so about 680 in total.

A launch post on LinkedIn is unlikely to produce that. If it produces 200 runs
in total, this experiment can only detect a difference of roughly 20 percentage
points, which is a difference so large it would be visible without a test.

That is stated here, before launch, rather than discovered afterwards. The
likely honest outcome is "inconclusive, and here is the confidence interval",
and that is what will be written up.

## Stopping point

Whichever comes first:

- 340 assigned runs per arm, or
- 14 days after launch.

Then the experiment is turned off in GrowthBook, wave one is set to whichever
arm the data favours or left on control if it does not favour either, and the
result is written up including the interval.

Launch was 4 August 2026, so the second of those falls on **18 August 2026**.
The first will not arrive before it unless the launch post does considerably
better than the section above expects.

### What can be looked at before then

Two of the seven queries, and only because neither of them is a result.

Query 1 is coverage, and the file itself says to run it first. It counts how
the assignment strings are distributed, which is a question about whether the
instrumentation works rather than about which arm is winning. If
`unassigned:control` is a large share, GrowthBook is not answering for a lot of
people and everything else is being measured on a small and possibly odd
subset. Finding that out on day fourteen means the fortnight is spent.

Query 2 is the stopping rule itself. Checking whether the stopping point has
arrived cannot be the thing that waits for the stopping point.

Queries 3 to 7 are the survival curve, the abandonment rate, the guardrail, the
test and the exposure check. Those are the result, they get looked at once, and
looking early at a number this underpowered is how a run of noise becomes a
finding.

### Checking the queries before the day

The readout happens once, so a query that turns out to be wrong on the day
costs the whole collection period. `experiment-check.sql` is a fixture that
builds a synthetic set of events with known answers: 100 assigned runs per arm,
a survival curve that can be counted by hand, and three deliberate traps, being
abandonments the reason filter must exclude, unassigned runs the colon filter
must exclude, and three sessions whose exposure disagrees with the arm they
played.

Applied to an empty database with the four migrations on it, all seven queries
returned the expected figures, including exactly three disagreements. So the
arithmetic is known good against the real schema, and what remains uncertain on
18 August is the data rather than the file reading it.

## Setting it up in GrowthBook

The feature the code reads:

- **Key**: `starting-difficulty`
- **Type**: string
- **Default value**: `control`
- **Rule**: an experiment split 50/50 between `control` and `busy`, hashed on
  the `id` attribute.

The client key goes in Netlify as `VITE_GROWTHBOOK_CLIENT_KEY`. It is public by
design and reads feature definitions only, which is why it is the one key in
this project allowed a `VITE_` prefix.

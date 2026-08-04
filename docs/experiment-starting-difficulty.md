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

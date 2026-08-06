# GrowthBook as a data source

GrowthBook does bucketing and nothing else. There is no data source behind it,
its results page is empty, and the experiment is read out of Supabase by
running `docs/experiment-starting-difficulty.sql` by hand.

This file is what connecting it would take, written down while the details are
in front of somebody rather than reconstructed later. Nothing here is
configured. Everything in it is GrowthBook UI work plus one migration, and the
queries are the part worth having version controlled, since they are the bit
that goes wrong quietly.

## Why it is not connected yet

Two reasons, and the first is the real one.

**The analysis is meant to happen once.** The stopping rule and the test were
written down before launch, and the file says plainly that the numbers get
looked at once, at the stopping point, with no interim peeking. A GrowthBook
results page recomputes on a schedule. Connecting it before the readout is
continuous peeking with a dashboard in front of it, and the fact that nobody
intended to peek does not help, because the page is there and it updates.

**It would be a second engine on the same question.** The committed analysis is
a frequentist two-proportion z-test at p < 0.05, two-tailed, with the pooled
standard error for the test and the unpooled one for the interval. GrowthBook
defaults to Bayesian and has its own opinions about sequential testing and
regression adjustment. Two engines on one question is two answers to choose
between after the fact, which is the thing the pre-registration exists to stop.

So: after the experiment is called, not before. At that point it becomes a
cross-check on the SQL and a reasonable thing to have wired up, and the section
below on what will not agree becomes the interesting part rather than a worry.

## What GrowthBook would read

One table, `analytics_events`, and mostly one event in it.

The exposure event is the right anchor and is already the right shape.
`experiment_viewed` fires from GrowthBook's own tracking callback, once per
session, and only when a player was genuinely bucketed. A run forced with the
`difficulty` query parameter never produces one, and neither does a run where
the CDN did not answer. So the exclusion that every query in
`experiment-starting-difficulty.sql` has to write out by hand, dropping any arm
string with a colon in it, is not needed here: those runs are absent from the
exposure record by construction. That is what the event was added for.

The cutoff is still needed. Developer testing produced sessions like any other,
and nothing in an exposure says whose it was.

## The identifier, and the thing it gets wrong

This is the part to read before deciding the results page is authoritative.

GrowthBook buckets on `requisita.participant_id`, which lives in local storage
and deliberately never leaves the browser. `services/experiments.js` says so,
and the exposure event drops the bucketing id for the same reason. The only
identifier on an exposure is `session_id`.

So GrowthBook's unit of analysis would be the session, while the unit that was
actually randomised is the participant. A player who comes back tomorrow is two
sessions, both in the same arm, so nothing crosses between arms and no estimate
is biased by it. What it does is count two correlated observations as two
independent ones, which makes the variance slightly too small and the intervals
slightly too narrow.

The fix is to put the bucketing id on the exposure, and that is a decision
about the project's posture rather than a missing line of code. It is not worth
making for a dashboard. State the mismatch next to the results instead.

## Getting a connection in

GrowthBook Cloud connects outward to the database, so it needs a route and a
credential.

**The route.** Supabase's direct connection is IPv6 only unless the IPv4 add-on
is on the project, so use the Supavisor session pooler host on port 5432 rather
than `db.<ref>.supabase.co`. Session mode rather than transaction mode, since
these are ordinary analytical queries and transaction mode exists for something
else. If the plan has network restrictions available, allowlist GrowthBook's
egress addresses; on the free tier it does not, and the protection is the
role's permissions instead.

**The credential.** Not the service role key. That key bypasses row level
security and can write to both tables, and handing it to a third party to run
`select count(*)` would undo the whole reason the browser has never held a
database key. Make a role that can read one table and nothing else.

```sql
-- Run by hand in the SQL editor. This is not a migration and must not become
-- one: it contains a password, and no password belongs in this repo.
create role growthbook_reader with login password '<generated, kept in GrowthBook only>';

grant connect on database postgres to growthbook_reader;
grant usage on schema public to growthbook_reader;
grant select on public.analytics_events to growthbook_reader;

-- Deliberately no grant on public.leaderboard. GrowthBook has no question that
-- needs display names, and the table holds the only user-supplied text in the
-- project.
```

**Then the trap.** Row level security is on for `analytics_events` and the
table has no policies at all, which is what makes the anon key useless against
it. A new role with `select` granted is subject to that too, so it reads zero
rows. Not an error, not a permissions message, just an empty result that looks
exactly like a query returning nothing because the filter was wrong.

Checked on Postgres 16 with all four migrations applied: with the grant above
and no policy, `select count(*)` returns 0. With the policy below it returns
every row. The leaderboard stays refused outright, because that one has no
grant to reach a policy with.

```sql
-- This half is a migration, since it holds no secret. It would be
-- supabase/migrations/0005_growthbook_reader.sql if this is ever connected.
create policy growthbook_read on public.analytics_events
  for select to growthbook_reader using (true);
```

## The assignment query

GrowthBook calls this the experiment assignment query. One row per exposure.

Declare the identifier type as `session_id`, and name it that rather than
`user_id`, so that nothing downstream reads it as a person.

```sql
select
  session_id                       as session_id,
  received_at                      as timestamp,
  properties ->> 'experiment_key'  as experiment_id,
  properties ->> 'variation_id'    as variation_id
from public.analytics_events
where event = 'experiment_viewed'
  and received_at >= timestamptz '2026-08-04 07:16:00+00'  -- cutoff
```

`variation_id` is GrowthBook's own index, 0 for control and 1 for busy, taken
straight off the tracking callback. The arm string is on the event too, as
`arm`, but the index is what GrowthBook matches its variations against.

If the cutoff in the SQL files ever moves, move it here as well. There is no
way for this file to notice that it did not.

## The metrics

Each one returns a row per session, with a timestamp GrowthBook uses to decide
whether the thing happened after the exposure.

**Reached wave 3** (binomial). The single summary of the survival curve, and
the proportion the committed z-test is run on.

```sql
select session_id, min(received_at) as timestamp
from public.analytics_events
where event = 'wave_started' and wave_number >= 3
group by session_id
```

**Early abandonment** (binomial). The secondary metric. The reason filter is
not optional: without it this counts the first time somebody glanced at another
tab, which is the bug that produced an abandonment at wave five from a player
who went on to reach wave eight.

```sql
select session_id, min(received_at) as timestamp
from public.analytics_events
where event = 'run_abandoned'
  and (properties ->> 'final_wave')::integer <= 3
  and properties ->> 'reason' in ('unload', 'idle')
group by session_id
```

**Reached wave 10** (binomial). The guardrail. A busier opening that improves
retention by making the game easier to lose early is not a win worth having.

```sql
select session_id, min(received_at) as timestamp
from public.analytics_events
where event = 'wave_started' and wave_number >= 10
group by session_id
```

**Furthest wave** (mean). The curve as one continuous number, which GrowthBook
handles better than it handles ten binomials.

```sql
select session_id, max(received_at) as timestamp, max(wave_number) as value
from public.analytics_events
where event = 'wave_started'
group by session_id
```

**Score** (mean). Included because it is the number players see, not because it
answers the question. It moves with wave reached and adds nothing the metric
above does not already say.

```sql
select
  session_id,
  max(received_at) as timestamp,
  max((properties ->> 'score')::integer) as value
from public.analytics_events
where event = 'game_over'
group by session_id
```

None of the metrics carries the cutoff, and that is deliberate. GrowthBook only
counts metric rows for sessions that appear in the assignment query, so the
cutoff sits there and there alone. Adding it to every metric as well would be
harmless and would suggest, to the next person reading, that leaving it off one
of them would let developer runs in. It would not.

All five run. Against the fixture in `leaderboard-and-players-check.sql` they
return sensible shapes and one instructive number: 35 sessions reached wave
three, where query 3 of `leaderboard-and-players.sql` counts 46 runs doing the
same thing. That gap is the unit difference described below, on data small
enough to see it in. The assignment query returns nothing there, because that
fixture seeds no exposures: it was built for the leaderboard questions, and the
experiment has its own fixture in `experiment-check.sql`.

## What will not agree, and why that is fine

If this is ever connected, the results page and
`experiment-starting-difficulty.sql` will produce different numbers for what
sounds like the same metric. Three reasons, and none of them is a bug.

**Different unit.** Every query in the SQL file counts runs. Every metric above
counts sessions, because a session is the only identifier on an exposure. A
player who lost three times and reached wave three on the last of them is three
runs, one of which converted, and one session, which converted. The SQL file
already notes that runs are the analysis unit and the participant is the
randomisation unit; this adds a third unit in between.

**Different denominator.** The SQL file's denominator is runs with a
`game_started`. GrowthBook's is sessions with an exposure. Runs from before the
exposure event was deployed have no exposure at all and are simply absent here,
which is the difference the experiment doc describes when it calls the exposure
the stronger record and the arm string the more complete one.

**Different engine.** Bayesian against frequentist, as above.

So the results page is a cross-check, not the readout. If it disagrees by a
little, that is the unit difference. If it disagrees by a lot, one of them has
a bug and the SQL is the one with a fixture behind it.

## After the experiment

When the starting difficulty experiment is called, it gets turned off in
GrowthBook and wave one goes back to a single definition. The data source and
the metrics can stay: they cost nothing, and the assignment query returns
nothing once no experiment is running, which is the correct behaviour rather
than a failure.

The reader role and its policy should go if the data source does. A login that
exists because of something that stopped happening is the kind of thing nobody
notices until it is the answer to a different question.

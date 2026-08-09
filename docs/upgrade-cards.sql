-- Which upgrade cards get taken, and which are dead weight.
--
-- Question 4 of the six in the analytics spec, asked of the phone board. On the
-- desktop boards that question is about towers and `tower_placed` answers it.
-- Here there are no towers to place: the run's only decision is which of two
-- cards to take between intakes, so this is the same question about a different
-- object, and `upgrade_offered` is the fifteenth event because nothing in the
-- fourteen could express a card being offered and refused.
--
-- Run them in the Supabase SQL editor. Each stands on its own and repeats the
-- base CTEs rather than sharing them, the same as the other files here, because
-- a query that can be copied on its own is worth more than a file with no
-- duplication in it.
--
-- The mode
--
-- Every query reads one mode:
--
--   >>> and mode = 'oneClickApply'  -- mode
--
-- marked `-- mode`, on the same terms as the other files. What is different is
-- that here it is not a choice about comparability, it is the truth about where
-- the event comes from. `upgrade_offered` is emitted by one scene in one mode
-- and no other board has cards at all, so a row from anywhere else is a bug
-- rather than a different game, and query 5 exists to say so out loud rather
-- than to be read for interest.
--
-- The cutoff
--
--   >>> and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
--
-- marked `-- cutoff`, and it is the release the phone board shipped in. Nothing
-- before it is a player: everything earlier came from a build being reviewed
-- through `?shape=phone`, and that route deliberately opens no session, so in
-- practice there is nothing to exclude. The line is there because the day it is
-- needed is the day somebody has already read a number without it.
--
-- Three things about the data are worth knowing before any of it is believed.
--
-- Take rate is meaningless without offer rate, which is the whole reason the
-- event carries both halves. The draw is weighted in config/upgrades.js, so the
-- structural cards turn up far more often than the sliders, and a raw count of
-- what was taken would rank the cards by how often the deck offered them.
-- Query 1 leads on the rate for that reason and query 2 removes the deck
-- entirely.
--
-- The catalogue is listed rather than read off the events. A card nobody ever
-- takes still appears in the offers, so it would survive a grouping, but a card
-- nobody is ever *offered* emits nothing at all and would vanish, and a card
-- missing from a report about dead weight is the deadest one there is. It is
-- the six from config/upgrades.js. A seventh would need adding here.
--
-- `keywordListUpdate` leaves the pool once taken and the others do not, so its
-- offer count is capped at one a run while everything else can be offered seven
-- times. It will sit near the bottom of any volume measure for that reason
-- alone. Read it on rate and on query 2, never on count.
--
-- A card is offered between intakes, and the event carries the intake that has
-- just finished rather than the one about to start. Read "taken at intake N" as
-- "taken after intake N was cleared".
--
--
-- ---------------------------------------------------------------------------
-- 1. Offer rate and take rate. The headline.
--
-- One `upgrade_offered` row is two card appearances: one taken and one
-- refused. `appearances` unpacks that, so `times_offered` counts every time a
-- card was on the table and `times_taken` counts the times it won.
--
-- `take_rate_pct` is the dead weight measure. A card offered constantly and
-- taken rarely is being declined on its merits, which is a finding. A card
-- rarely offered and always taken is being kept out by the weights, which is a
-- different finding and needs a change in a different file.
-- ---------------------------------------------------------------------------
with offers as (
  select
    properties ->> 'taken' as taken,
    properties ->> 'refused' as refused
  from public.analytics_events
  where event = 'upgrade_offered'
    and mode = 'oneClickApply'  -- mode
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
),
appearances as (
  select taken as card, true as was_taken from offers
  union all
  select refused as card, false as was_taken from offers
),
catalogue (card) as (
  values
    ('keywordListUpdate'),
    ('panelReview'),
    ('widerCriteria'),
    ('higherBar'),
    ('parallelScreening'),
    ('extendedDeadline')
)
select
  c.card,
  count(a.card) as times_offered,
  count(a.card) filter (where a.was_taken) as times_taken,
  round(
    100.0 * count(a.card) filter (where a.was_taken) / nullif(count(a.card), 0),
    1
  ) as take_rate_pct
from catalogue c
left join appearances a on a.card = c.card
group by c.card
order by take_rate_pct desc nulls last, times_offered desc;


-- ---------------------------------------------------------------------------
-- 2. Head to head. What each card beat, and what beat it.
--
-- The one measure the weighted draw cannot distort. Every row is a pair that
-- was actually put in front of somebody, so how often the deck offers either
-- card drops out of it entirely, and what is left is players choosing.
--
-- The pair is ordered alphabetically so a meeting is one row rather than two,
-- and `a_pct` is read as "when these two met, `a` was taken this often".
-- Anything near 50 is a real decision. Anything near 0 or 100 is a card that
-- one of the two makes pointless, which is worth knowing before either is
-- retuned.
-- ---------------------------------------------------------------------------
with offers as (
  select
    properties ->> 'taken' as taken,
    properties ->> 'refused' as refused
  from public.analytics_events
  where event = 'upgrade_offered'
    and mode = 'oneClickApply'  -- mode
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
),
pairs as (
  select
    least(taken, refused) as card_a,
    greatest(taken, refused) as card_b,
    taken
  from offers
)
select
  card_a,
  card_b,
  count(*) as times_met,
  count(*) filter (where taken = card_a) as card_a_taken,
  round(100.0 * count(*) filter (where taken = card_a) / count(*), 1) as a_pct
from pairs
group by card_a, card_b
order by times_met desc, card_a, card_b;


-- ---------------------------------------------------------------------------
-- 3. When a card is taken.
--
-- Whether a card is an opener or a card somebody reaches for once the board is
-- in trouble. The cards stack, so the same card is a different decision at
-- intake one and at intake seven, and a pool where everything has the same
-- median is a pool where nothing is situational.
--
-- Cards never taken are absent here rather than present as a zero. That is
-- deliberate and it is the one query in this file where it is right: a median
-- intake for a card nobody took is not a zero, it is not a number.
-- ---------------------------------------------------------------------------
select
  properties ->> 'taken' as card,
  count(*) as times_taken,
  percentile_cont(0.5) within group (order by wave_number) as median_intake,
  min(wave_number) as first_intake,
  max(wave_number) as last_intake
from public.analytics_events
where event = 'upgrade_offered'
  and mode = 'oneClickApply'  -- mode
  and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
group by 1
order by median_intake, times_taken desc;


-- ---------------------------------------------------------------------------
-- 4. How far a run got, by whether it ever took the card.
--
-- Read this one carefully, because it carries the same confound the equivalent
-- tower query does and it carries it harder. A card can only be taken by a run
-- that survived long enough to be offered it, so a card taken late will always
-- look like a card that makes runs last. The arrow points both ways and this
-- query cannot tell them apart.
--
-- What it is good for is the opposite finding. A card taken often whose runs
-- end no later than everybody else's is a card doing nothing, and that reading
-- is safe because the confound only ever flatters.
-- ---------------------------------------------------------------------------
with runs as (
  select
    run_id,
    max((properties ->> 'final_wave')::int) as final_wave
  from public.analytics_events
  where event = 'game_over'
    and mode = 'oneClickApply'  -- mode
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
  group by run_id
),
took as (
  select distinct
    run_id,
    properties ->> 'taken' as card
  from public.analytics_events
  where event = 'upgrade_offered'
    and mode = 'oneClickApply'  -- mode
    and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
),
catalogue (card) as (
  values
    ('keywordListUpdate'),
    ('panelReview'),
    ('widerCriteria'),
    ('higherBar'),
    ('parallelScreening'),
    ('extendedDeadline')
)
select
  c.card,
  count(*) filter (where t.run_id is not null) as runs_taking,
  percentile_cont(0.5) within group (order by r.final_wave)
    filter (where t.run_id is not null) as median_intake_taking,
  percentile_cont(0.5) within group (order by r.final_wave)
    filter (where t.run_id is null) as median_intake_not_taking
from catalogue c
cross join runs r
left join took t on t.run_id = r.run_id and t.card = c.card
group by c.card
order by runs_taking desc, c.card;


-- ---------------------------------------------------------------------------
-- 5. The census, and the only query here that is not filtered to one mode.
--
-- Everything above reads `oneClickApply` because that is the only board with
-- cards on it. This one asks the table whether that is true, which is a
-- different question and is why the `-- mode` line is deliberately absent.
--
-- The expected answer is one row. A second row is a real bug and it is worth
-- knowing which kind: a mode set wrongly at run start puts the phone board's
-- own events under another name, and the leaderboard reads the same setting, so
-- a row here is a warning about scores as much as about events.
--
-- `runs` against `offers` also says whether the event is firing at all. A run
-- that reached intake five made four choices, so offers well under three times
-- runs means the emit is being missed somewhere rather than that players are
-- quitting early, and query 3 will already have said which of those it is.
-- ---------------------------------------------------------------------------
select
  coalesce(mode, '(none)') as mode,
  count(*) as offers,
  count(distinct run_id) as runs,
  round(count(*)::numeric / nullif(count(distinct run_id), 0), 1) as offers_per_run,
  min(received_at) as first_seen,
  max(received_at) as last_seen
from public.analytics_events
where event = 'upgrade_offered'
  and received_at >= timestamptz '2026-08-09 00:00:00+00'  -- cutoff
group by 1
order by offers desc;

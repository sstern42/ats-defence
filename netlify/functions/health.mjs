/**
 * Whether the collector is actually collecting.
 *
 * This exists because of a two day outage nobody noticed. Migrations 0003 and
 * 0004 added `country`, `browser` and `os` to `analytics_events` and the
 * collector started writing them, but the migrations were never applied to the
 * production database. Every insert from that deploy onwards named three
 * columns that did not exist, PostgREST refused all of them, and the events
 * stopped dead. The leaderboard carried on working, because nothing in that
 * path touches those columns, so the game looked entirely healthy from the
 * outside while recording nothing at all.
 *
 * It went unnoticed for two days for one structural reason: no event is lost
 * loudly. `collect` already returns a 502 and logs the failure, so the
 * information exists, but the browser sends events through `sendBeacon`, which
 * hands the caller no response to read. There is nowhere for a failure to
 * surface except a function log nobody opens. From the data end it is worse
 * still, since a table with no new rows looks exactly like a game nobody is
 * playing, which for a small project is a plausible thing to believe.
 *
 * So the check is a signal that cannot be produced by nobody playing.
 *
 * A row on the leaderboard is proof that somebody finished a run: it requires
 * reaching a game over, typing a name and passing the plausibility check. If a
 * board row's run has no events at all, a real player played a whole run and
 * not one of their events arrived. That cannot happen while collection is
 * working, and it cannot be caused by quiet traffic, which is what makes it
 * worth waking somebody for.
 *
 * The limitation, stated rather than discovered later: it only fires when
 * somebody submits a score. If collection breaks and nobody submits for a
 * week, this stays quiet for a week. The obvious alternative, alarming when no
 * events arrive for a day, cannot work here, because at this traffic level a
 * day with no events is an ordinary Tuesday. A late alarm that is always right
 * beats a prompt one that is usually wrong and gets muted.
 *
 * The first time it went off in earnest, it was right about the symptom and
 * wrong about the cause, and both are recorded here because the second is the
 * more useful lesson. Seven of eleven submissions had no events behind them,
 * and the newest event in the table was forty five minutes old, so the
 * collector was plainly up and the message still sent the reader to a function
 * log and a list of migrations. An outage and a handful of runs going missing
 * are different faults with different fixes, and the one number that tells them
 * apart, the age of the newest event, was already in the payload and ignored.
 * So `collector_silent` says which shape it is, and the scheduled check says
 * different things about the two.
 *
 * Unauthenticated, like the other three. It reports three numbers and no
 * identifiers, and a shared secret would mean another environment variable to
 * set correctly on two services, which is the class of mistake that caused the
 * outage in the first place.
 */
import { isConfigured, select } from './lib/supabase.js';

/**
 * How far back to look for submissions. Long enough that a check running once
 * a day cannot step over a submission, short enough that a fixed outage stops
 * being reported within a couple of days rather than staying red.
 */
const WINDOW_HOURS = 48;

/** Enough submissions for any plausible window at this traffic level. */
const MAX_SUBMISSIONS = 50;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Answering the same question twice in a minute is not worth a round
      // trip, and a scheduled check does not need the answer to the second.
      'Cache-Control': 'public, max-age=60'
    }
  });

/**
 * Whether anything at all was ever recorded for one run.
 *
 * Asked one run at a time, which is more requests than it looks like it needs.
 * The version it replaces put every run into a single `in.` list and read back
 * up to a thousand rows, and a run generates something like sixty events, so
 * fifty submissions is three thousand rows through a thousand row window. A run
 * whose events fell the wrong side of that cap read as a run with no events at
 * all, which is the exact thing this file exists to alarm on. Fifty small
 * questions that cannot be wrong beat one large one that can, on a check whose
 * only value is being right when it goes off.
 *
 * Run ids are client supplied and validated only for type and length, so the
 * value is encoded rather than trusted to be tidy.
 */
async function hasEvents(runId) {
  const rows = await select(
    'analytics_events',
    `select=run_id&run_id=eq.${encodeURIComponent(runId)}&limit=1`
  );

  return rows.length > 0;
}

export default async (request) => {
  if (request.method !== 'GET') {
    return json({ error: 'method not allowed' }, 405);
  }

  if (!isConfigured()) {
    return json({ error: 'health is not configured' }, 503);
  }

  try {
    const since = new Date(
      Date.now() - WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const newest = await select(
      'analytics_events',
      'select=received_at&order=received_at.desc&limit=1'
    );

    const submissions = await select(
      'leaderboard',
      [
        'select=run_id',
        `submitted_at=gte.${since}`,
        'order=submitted_at.desc',
        `limit=${MAX_SUBMISSIONS}`
      ].join('&')
    );

    const runIds = [
      ...new Set(submissions.map((row) => row.run_id).filter(Boolean))
    ];

    const found = await Promise.all(runIds.map(hasEvents));
    const orphans = runIds.filter((id, index) => !found[index]);
    const newestAt = newest[0]?.received_at ?? null;

    return json({
      // The one thing the scheduled check reads. False means a real player
      // finished a run and none of it was recorded.
      healthy: orphans.length === 0,
      window_hours: WINDOW_HOURS,
      // Reported for a human rather than alarmed on. A long gap here is
      // usually quiet traffic and occasionally the thing above.
      newest_event_at: newestAt,
      hours_since_newest_event: newestAt
        ? Math.round((Date.now() - Date.parse(newestAt)) / 36000) / 100
        : null,
      submissions_in_window: runIds.length,
      submissions_without_events: orphans.length,
      // Which shape a failure is. Nothing arriving at all is the collector
      // being down, and is the fault this file was written for. Events still
      // arriving alongside runs that have none is a different fault, and
      // sending somebody to read a function log for it wastes the alarm.
      collector_silent: !newestAt || Date.parse(newestAt) < Date.parse(since)
    });
  } catch (error) {
    console.error('health check failed', error);

    return json({ error: 'could not read collection health' }, 502);
  }
};

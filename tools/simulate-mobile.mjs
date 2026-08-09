/**
 * Plays the phone board thousands of times without a browser, so the balance can
 * be read off something better than one run of a script clicking at random.
 *
 * ## Why this exists
 *
 * Three tuning passes were decided by one or two runs of a Playwright script
 * that clicks whichever card is drawn on top. That is a player who declines the
 * answer to their own problem about half the times it is offered, and two runs
 * of an identical list came out nineteen rejections apart, so the noise in it was
 * a fair fraction of the effect being tuned for. Two of those three passes then
 * diagnosed the wrong cause.
 *
 * A browser cannot do better, because the cards are drawn on a canvas and a
 * script cannot read them without the game growing a hook that exists only for
 * tests. So the loop is modelled here instead.
 *
 * ## What makes it trustworthy, and what does not
 *
 * Every number comes from the same config the game plays from: the wave list,
 * the applicant stats, the tower, the card pool and the run rules are all
 * imported. Nothing is copied, so nothing can drift.
 *
 * The loop is reimplemented, and that is the part to distrust. It is a model of
 * the game rather than the game. What makes it worth anything is that it is
 * checked against real runs before it is believed: `--validate` plays the random
 * policy and prints what the browser measured beside it, and if those disagree
 * the model is wrong and its other numbers are worthless.
 *
 * The model is faithful in the ways that matter to this board. Applicants walk
 * straight in from a ring, so a position is an angle and a distance, and the
 * distance between two of them is exact rather than approximated. That matters
 * because Convene a panel is splash, and splash is the one card whose value
 * depends on where everybody is standing.
 *
 * What it does not model: the tracer, the sound, the flinch, and the fact that a
 * rejected applicant fades for 180ms before it is destroyed. None of those
 * change who dies.
 *
 * ## Running it
 *
 *   node tools/simulate-mobile.mjs --validate
 *   node tools/simulate-mobile.mjs --runs 2000
 *   node tools/simulate-mobile.mjs --runs 2000 --policy random
 */
import { APPLICANTS } from '../src/config/applicants.js';
import { MOBILE_RUN, MOBILE_TOWER } from '../src/config/mobile.js';
import { RADIAL_BOARD } from '../src/config/path.js';
import {
  MIN_FIRE_INTERVAL_MS,
  UPGRADES,
  UPGRADES_OFFERED
} from '../src/config/upgrades.js';
import { MOBILE_WAVES } from '../src/config/waves.js';

/** The clock. Small enough that a reload never straddles two ticks. */
const TICK_MS = 16;

/** What the browser actually measured, for --validate to be checked against. */
const OBSERVED = {
  policy: 'random',
  runs: [
    { outcome: 'filled', rejected: 98 },
    { outcome: 'filled', rejected: 117 }
  ]
};

/**
 * How a player picks. `random` is the browser script: whichever card came out on
 * top. `sensible` takes the card that answers a problem when one is offered,
 * which is what a person who has read the cards does.
 *
 * The order is a preference rather than a calculation on purpose. A simulated
 * player cleverer than a real one would give a ceiling nobody can reach, and the
 * point of the pair is to bracket what a person will do rather than to solve the
 * game.
 */
const SENSIBLE_ORDER = [
  'keywordListUpdate',
  'panelReview',
  'parallelScreening',
  'higherBar',
  'widerCriteria',
  'extendedDeadline'
];

function pick(offer, policy) {
  if (policy === 'random') {
    return offer[Math.floor(Math.random() * offer.length)];
  }

  return [...offer].sort(
    (a, b) => SENSIBLE_ORDER.indexOf(a.id) - SENSIBLE_ORDER.indexOf(b.id)
  )[0];
}

/** The weighted draw, matching MobileGameScene.drawCards. */
function drawCards(taken) {
  const pool = UPGRADES.filter((card) => !(card.once && taken.includes(card.id)));
  const drawn = [];

  while (drawn.length < UPGRADES_OFFERED && drawn.length < pool.length) {
    const left = pool.filter((card) => !drawn.includes(card));
    const total = left.reduce((sum, card) => sum + card.weight, 0);

    let roll = Math.random() * total;

    drawn.push(
      left.find((card) => {
        roll -= card.weight;

        return roll < 0;
      }) ?? left[left.length - 1]
    );
  }

  return drawn;
}

/** Applies a card, matching MobileGameScene.applyUpgrade. */
function apply(run, card) {
  run.taken.push(card.id);

  if (card.stat === 'beatsImmunity') {
    run.beatsImmunity = true;

    return;
  }

  if (card.stat === 'tolerance') {
    run.maxHealth += card.add;
    run.health += card.add;

    return;
  }

  if (card.set !== undefined) {
    run.stats[card.stat] = card.set;
  } else {
    run.stats[card.stat] += card.add;
  }

  run.stats.fireIntervalMs = Math.max(
    run.stats.fireIntervalMs,
    MIN_FIRE_INTERVAL_MS
  );
}

/** Straight-line distance between two applicants, from angle and radius. */
function apart(a, b) {
  return Math.sqrt(
    a.radius * a.radius +
      b.radius * b.radius -
      2 * a.radius * b.radius * Math.cos(a.angle - b.angle)
  );
}

function spawn(typeKey, returning) {
  const definition = APPLICANTS[typeKey];
  const walked = (definition.spawnProgress ?? 0) * WALK;

  return {
    typeKey,
    definition,
    health: definition.health,
    angle: Math.random() * Math.PI * 2,
    radius: RADIAL_BOARD.spawnRadius - walked,
    hasReturned: returning
  };
}

const WALK = RADIAL_BOARD.spawnRadius - RADIAL_BOARD.arrivalRadius;

function playRun(policy) {
  const run = {
    stats: { ...MOBILE_TOWER, splashRadius: 0 },
    beatsImmunity: false,
    health: MOBILE_RUN.towerHealth,
    maxHealth: MOBILE_RUN.towerHealth,
    taken: [],
    rejected: 0,
    arrived: 0
  };

  for (let index = 0; index < MOBILE_WAVES.length; index += 1) {
    // A card between intakes, and none before the first, which is the game.
    if (index > 0) {
      apply(run, pick(drawCards(run.taken), policy));
    }

    const finished = playWave(run, MOBILE_WAVES[index]);

    if (!finished) {
      return { outcome: 'filled', cleared: index, ...totals(run) };
    }
  }

  return { outcome: 'held', cleared: MOBILE_WAVES.length, ...totals(run) };
}

function totals(run) {
  return {
    rejected: run.rejected,
    arrived: run.arrived,
    health: run.health,
    maxHealth: run.maxHealth,
    taken: run.taken
  };
}

/** One intake. Returns false if the tower ran out partway through it. */
function playWave(run, wave) {
  const pending = [];

  wave.groups.forEach((group) => {
    for (let n = 0; n < group.count; n += 1) {
      pending.push({ at: group.delayMs + n * group.intervalMs, typeKey: group.applicant });
    }
  });

  pending.sort((a, b) => a.at - b.at);

  const live = [];
  const returns = [];
  let now = 0;
  let nextFireAt = 0;
  let released = false;

  for (;;) {
    while (pending.length > 0 && pending[0].at <= now) {
      live.push(spawn(pending.shift().typeKey, false));
    }

    // Movement.
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const who = live[i];

      who.radius -= (who.definition.speed * TICK_MS) / 1000;

      if (who.radius <= RADIAL_BOARD.arrivalRadius) {
        if (who.definition.returns && !who.hasReturned) {
          returns.push(who.typeKey);
        }

        live.splice(i, 1);
        run.arrived += 1;
        run.health = Math.max(0, run.health - MOBILE_RUN.arrivalCost);

        if (run.health === 0) {
          return false;
        }
      }
    }

    // Firing. Targets whoever has least walking left, skipping anybody this
    // tower cannot touch, which is Tower.findTarget on this board.
    if (now >= nextFireAt) {
      const reach = run.stats.range;
      const target = live
        .filter(
          (who) =>
            who.radius <= reach &&
            (run.beatsImmunity ||
              !(who.definition.immuneTo ?? []).includes('keywordFilter'))
        )
        .sort((a, b) => a.radius - b.radius)[0];

      if (target) {
        nextFireAt = now + run.stats.fireIntervalMs;

        const hit = [target];

        if (run.stats.splashRadius > 0) {
          live.forEach((who) => {
            if (who !== target && apart(who, target) <= run.stats.splashRadius) {
              hit.push(who);
            }
          });
        }

        hit.forEach((who) => {
          who.health -= run.stats.damage;

          if (who.health <= 0) {
            const at = live.indexOf(who);

            if (at !== -1) {
              if (who.definition.returns && !who.hasReturned) {
                returns.push(who.typeKey);
              }

              live.splice(at, 1);
              run.rejected += 1;
            }
          }
        });
      }
    }

    if (pending.length === 0 && live.length === 0) {
      if (returns.length > 0 && !released) {
        returns.splice(0).forEach((typeKey) => live.push(spawn(typeKey, true)));
        released = true;

        continue;
      }

      return true;
    }

    now += TICK_MS;
  }
}

// ------------------------------------------------------------------ reporting

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);

  return at === -1 ? fallback : args[at + 1];
};

const validating = args.includes('--validate');
const runs = Number(flag('runs', validating ? 400 : 2000));
const policies = validating
  ? ['random']
  : [flag('policy', null)].filter(Boolean).length
    ? [flag('policy')]
    : ['random', 'sensible'];

policies.forEach((policy) => {
  const results = Array.from({ length: runs }, () => playRun(policy));
  const held = results.filter((r) => r.outcome === 'held');
  const mean = (pick) =>
    results.reduce((sum, r) => sum + pick(r), 0) / results.length;

  console.log(`\n${policy} (${runs} runs)`);
  console.log(`  held the vacancy   ${((held.length / runs) * 100).toFixed(1)}%`);
  console.log(`  mean rejections    ${mean((r) => r.rejected).toFixed(0)}`);
  console.log(`  mean arrivals      ${mean((r) => r.arrived).toFixed(0)}`);
  console.log(`  mean intakes clear ${mean((r) => r.cleared).toFixed(1)} of ${MOBILE_WAVES.length}`);
  console.log(
    `  tower left on wins ${held.length ? (held.reduce((s, r) => s + r.health, 0) / held.length).toFixed(0) : 'n/a'}`
  );

  if (validating) {
    console.log('\n  browser measured, same policy, same list:');
    OBSERVED.runs.forEach((r) =>
      console.log(`    ${r.outcome}, ${r.rejected} rejections`)
    );
  }
});

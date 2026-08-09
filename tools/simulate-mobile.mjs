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

/**
 * What the browser actually measured, for --validate to be checked against.
 *
 * Re-measured for the 1.7.0 tuning pass, because the pair recorded here before
 * were played against a wave list that no longer exists and a check against a
 * superseded list is worse than no check: it agrees with nothing and looks like
 * it agrees with something.
 *
 * Three runs of the random policy, played end to end in Chromium against the
 * built site. The integrity trace is what the tower had left as each intake
 * opened, which is a far better check than the totals: it compares the model at
 * seven points in a run rather than at the end of one.
 */
const OBSERVED = {
  policy: 'random',
  runs: [
    { outcome: 'filled', cleared: 6, rejected: 110 },
    { outcome: 'filled', cleared: 6, rejected: 107 },
    { outcome: 'filled', cleared: 6, rejected: 99 }
  ],

  /** Tower integrity as intakes 1 to 7 opened, out of 240. */
  integrity: [
    [240, 240, 240, 236, 208, 178, 74],
    [240, 240, 240, 236, 196, 124, 40],
    [240, 240, 270, 266, 252, 180, 96]
  ]
};

/**
 * **The browser ran harder than the model, and it is worth knowing why before
 * either number is quoted.**
 *
 * Down to the fifth intake the two agree closely. The model has a survivor at
 * 99%, 88% and 72% of tolerance at the end of intakes 3, 4 and 5; the browser
 * came in at 98%, 87% and 79% on the first run. That is the part being checked
 * and it passes.
 *
 * From the sixth they diverge, and all three browser runs ended in the seventh
 * where the model survives it 84% of the time. The cause is almost certainly the
 * frame rate rather than the model. These runs held 17 to 18 frames a second on
 * a software renderer, so the tower's 300ms reload quantises to a 55ms frame
 * boundary and it fires roughly a tenth less often than the model's 16ms tick
 * lets it. That costs nothing while the turret has spare capacity and costs
 * everything once it is saturated, which is exactly where the two part company.
 *
 * So the model is a fair guide to the shape of a run and optimistic about the
 * end of one on a slow device. A phone holding 60 frames a second quantises at
 * 16ms, which is the tick the model already uses. Nobody should read the last
 * two intakes of a simulated run as a promise, and the thing that would settle
 * it is a run on a real handset rather than more runs in here.
 */

/**
 * How a player picks. `random` is the browser script: whichever card came out on
 * top. `sensible` takes the best card on offer, which is what a person who has
 * played a few runs does. `careless` takes the worst, which is the floor.
 *
 * **This order was wrong for as long as it existed, and the way it was wrong is
 * worth keeping written down.** It used to lead with the two cards the pool was
 * designed around, on the reasoning that a card changing what the tower can do
 * beats a card changing how well it does it. Measured with `--policy prefer:id`,
 * that ordering played the game worse than its own reverse: `sensible` held the
 * vacancy 13% of the time and `careless` held it 27%.
 *
 * The cause is the note in config/mobile.js, arriving somewhere nobody looked
 * for it. `findTarget` goes for whoever has least walking left, so taking the
 * immunity off The Keyword Stuffer does not add a kill, it moves the turret onto
 * a 120 health target ahead of the 40 health ones behind it. The card the design
 * considered its flagship decision was the worst card in the pool, and a
 * preference list written before anything was measured said take it first.
 *
 * So this is now the measured order rather than the designed one. It is still a
 * preference rather than a solver, because a simulated player cleverer than a
 * real one gives a ceiling nobody can reach, and the point of the three policies
 * is to bracket what a person will do.
 */
const SENSIBLE_ORDER = [
  'panelReview',
  'parallelScreening',
  'higherBar',
  'extendedDeadline',
  'widerCriteria',
  'keywordListUpdate'
];

function pick(offer, policy) {
  // `prefer:<id>` takes that card whenever it is on offer and picks at random
  // otherwise, which is how one card's worth is read on its own rather than
  // inferred from a preference list somebody wrote down before measuring.
  if (policy.startsWith('prefer:')) {
    const wanted = policy.slice(7);

    return offer.find((card) => card.id === wanted) ?? offer[Math.floor(Math.random() * offer.length)];
  }

  if (policy === 'careless') {
    return [...offer].sort(
      (a, b) => SENSIBLE_ORDER.indexOf(b.id) - SENSIBLE_ORDER.indexOf(a.id)
    )[0];
  }

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
    arrived: 0,

    // What the tower had left at the end of each intake it finished, which is
    // the only per intake reading that says where the pressure actually is. The
    // totals say what a run came to and cannot say which intake took it there.
    left: []
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

    run.left.push(run.health / run.maxHealth);
  }

  return { outcome: 'held', cleared: MOBILE_WAVES.length, ...totals(run) };
}

function totals(run) {
  return {
    rejected: run.rejected,
    arrived: run.arrived,
    health: run.health,
    maxHealth: run.maxHealth,
    left: run.left,
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

  // The mean is the wrong number to tune on and it took a pass to notice. A
  // list where nothing threatens anybody until the last intake and a list that
  // takes a steady toll all the way down can report the same mean, and they are
  // not the same game. This is the survival curve the analytics spec asks for
  // in question 2, computed here rather than waited for.
  console.log('\n  reached intake, and still alive at the end of it');

  for (let intake = 1; intake <= MOBILE_WAVES.length; intake += 1) {
    // Cleared counts intakes finished, so a run that died during intake n has
    // cleared n - 1 and still reached n.
    const reached = results.filter((r) => r.cleared >= intake - 1).length;
    const survivors = results.filter((r) => r.cleared >= intake);
    const survived = survivors.length;
    const bar = '#'.repeat(Math.round((survived / runs) * 40));

    // Integrity is read off the survivors, because it is what an intake cost
    // somebody who got through it. Averaging in the runs that ended would mix
    // two different questions into one number.
    const integrity = survived
      ? `${((survivors.reduce((sum, r) => sum + r.left[intake - 1], 0) / survived) * 100).toFixed(0)}%`
      : 'n/a';

    console.log(
      `   ${String(intake).padStart(2)}  reached ${String(((reached / runs) * 100).toFixed(0)).padStart(3)}%` +
        `  survived ${String(((survived / runs) * 100).toFixed(0)).padStart(3)}%` +
        `  integrity ${integrity.padStart(4)}  ${bar}`
    );
  }

  if (validating) {
    console.log('\n  browser measured, same policy, same list:');
    OBSERVED.runs.forEach((r) =>
      console.log(
        `    ${r.outcome} after ${r.cleared} intakes, ${r.rejected} rejections`
      )
    );

    console.log('\n  integrity as each intake opened, out of 240:');
    OBSERVED.integrity.forEach((trace) =>
      console.log(`    ${trace.map((n) => String(n).padStart(4)).join('')}`)
    );

    console.log(
      '\n  Those runs held 17 to 18 frames a second on a software renderer,\n' +
        '  which quantises the reload and makes the last two intakes harder\n' +
        '  than this model says. See the note on OBSERVED before quoting either.'
    );
  }
});

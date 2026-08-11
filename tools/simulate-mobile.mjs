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
 *   node tools/simulate-mobile.mjs --runs 2000 --bulk none
 *   node tools/simulate-mobile.mjs --runs 2000 --trap ahead
 *
 * ## The second thing being played, from 1.10.0
 *
 * The card between intakes used to be the whole of what a player of this board
 * decides. It is not any more: there are three bulk rejects in a run and the
 * ninth intake sends something the turret cannot answer, so when the charges are
 * spent is a second decision and the two interact. `--bulk` is that decision
 * modelled the same way `--policy` models the other one, and for the same
 * reason: a policy brackets what a person will do where a number would only say
 * what one person did.
 *
 * The one thing to hold on to when reading the output. `--bulk none` plays the
 * board as though the button were not there, so its first eight intakes are the
 * 1.7.0 game exactly, and that is what makes the browser check below still worth
 * something. Any difference between `none` and the others is what the
 * superweapon is worth, measured rather than asserted.
 *
 * ## The third thing being played, from 1.11.0
 *
 * Salary expectations, which is a pad laid on the floor rather than a button, so
 * it is the first thing on this board whose value depends on *where* rather than
 * on *when*. `--trap` models it on the same terms the other two are modelled:
 * policies that bracket what a person does rather than a solver that plays it
 * better than anybody could.
 *
 * The model is exact in the way that matters. An applicant is an angle and a
 * radius walking inwards, a pad is an angle and a radius sitting still, and
 * whether one treads on the other is the same distance calculation splash
 * already uses. What it cannot model is the thumb: a person taps a spot they
 * judged half a second ago on a board full of moving dots, and every policy in
 * here places on this tick's positions with perfect information. So the trap
 * numbers should be read as the ceiling of what a placement is worth rather than
 * as what a player will get out of it, which is the opposite of the reading the
 * card policies want.
 */
import { APPLICANTS } from '../src/config/applicants.js';
import {
  MOBILE_CONTRACT,
  MOBILE_HOLD,
  MOBILE_RUN,
  MOBILE_SCORING,
  MOBILE_SUPERWEAPON,
  MOBILE_TOWER,
  MOBILE_TRAP
} from '../src/config/mobile.js';
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
  /**
   * **These runs predate the boss intake and the bulk reject, and they are still
   * a check rather than a superseded one.** The rule this file states above is
   * that a check against a list that no longer exists agrees with nothing and
   * looks like it agrees with something. What saves these is that intakes one to
   * eight were not touched in 1.10.0: the ninth was added after them and the
   * button is off under `--bulk none`, so the model these numbers are compared
   * against is playing the identical game they were recorded from.
   *
   * That is why `--validate` forces the button off, and it is why it prints only
   * the first eight intakes. Nothing here says anything about the ninth, and the
   * ninth is the part that most wants a real handset.
   */
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

/**
 * Straight-line distance between two positions, from angle and radius.
 *
 * Takes anything carrying the two, which is every applicant and also a pad on
 * the floor. A trap is a position that does not move, so the same law of cosines
 * that decides splash decides who has trodden on one.
 */
function apart(a, b) {
  return Math.sqrt(
    a.radius * a.radius +
      b.radius * b.radius -
      2 * a.radius * b.radius * Math.cos(a.angle - b.angle)
  );
}

/**
 * How far in front of somebody a pad is laid, in pixels.
 *
 * A pad laid on the spot somebody is standing goes off on them alone and
 * immediately, which is a player spending the cooldown to hit one applicant.
 * Laid ahead of them, it is still there when whoever was behind them arrives,
 * which is the whole of why it is worth putting somewhere rather than on
 * somebody. Fifty is a little under a second of walking for most types.
 */
const TRAP_LEAD = 50;

/**
 * Where a player lays the pad, and whether they bother.
 *
 * Four policies, bracketing rather than solving, the same as the other two
 * decisions. `none` is the board without the pad, and is the game every number
 * recorded before 1.11.0 was measured on. `blind` taps somewhere a person could
 * walk without looking at where anybody is, which is the floor. `front` lays it
 * just in front of whoever is nearest the desk. `cluster` holds out for a spot
 * that catches two, and gives up holding out after a couple of seconds rather
 * than saving a pad it never spends.
 *
 * **The names were `eager` and `ahead` while this was being tuned, and they were
 * the wrong way round.** `front` was written as the obvious, slightly thoughtless
 * play and `cluster` as the considered one, and `front` measures three points
 * better. The reason is the board: every applicant walks a straight line to the
 * same desk, so the ground just in front of the leader is where all those lines
 * are closest together, and a heuristic that goes looking for a crowd further out
 * is choosing a thinner part of the board. So they are named for what they do
 * rather than for how clever they were meant to be.
 */
function wantsTrap(policy, live, waitedMs) {
  if (policy === 'none' || live.length === 0) {
    return null;
  }

  // Anywhere somebody could walk, chosen without looking. The angle is free
  // because arrivals come from every direction, so this is a fair model of a
  // thumb going down on a board rather than a deliberately bad placement.
  if (policy === 'blind') {
    return {
      angle: Math.random() * Math.PI * 2,
      radius:
        RADIAL_BOARD.arrivalRadius +
        Math.random() * (RADIAL_BOARD.spawnRadius - RADIAL_BOARD.arrivalRadius)
    };
  }

  // Only where somebody could actually tread on it. Inside the desk is under
  // the tower and outside the ring is floor nobody crosses, and the board
  // refuses a tap in either place for the same reason.
  const spots = live
    .map((who) => ({
      angle: who.angle,
      radius: Math.max(who.radius - TRAP_LEAD, RADIAL_BOARD.arrivalRadius + 4)
    }))
    .filter((spot) => spot.radius <= RADIAL_BOARD.spawnRadius);

  if (spots.length === 0) {
    return null;
  }

  if (policy === 'front') {
    // Whoever has least walking left, which is the applicant the eye is on and
    // the one the turret is already shooting at.
    return spots.sort((a, b) => a.radius - b.radius)[0];
  }

  // How many are close enough to that spot to be caught by it, counted on this
  // tick's positions. It undercounts, since the crowd is still converging and
  // more of them will be inside the radius by the time the pad goes off, which
  // is the right direction for a policy to be wrong in.
  const scored = spots
    .map((spot) => ({
      spot,
      caught: live.filter(
        (who) => apart(who, spot) <= MOBILE_TRAP.triggerRadius * 1.5
      ).length
    }))
    .sort((a, b) => b.caught - a.caught);

  const best = scored[0];

  // Two is the whole rule. One is a pad spent on somebody the turret was going
  // to reach anyway, and holding out for three means never laying it in the
  // early intakes, where nobody arrives in threes.
  //
  // The patience runs out after two seconds, and it has to. The rearm is
  // measured from laying, so a pad held back does not bank anything: it delays
  // the next one as well. A policy that waits indefinitely for a crowd is
  // therefore not a more careful player, it is a player with fewer pads, which
  // is what the first version of this measured and misread.
  if (best.caught < 2 && waitedMs < 2000) {
    return null;
  }

  return best.caught >= 2 ? best.spot : spots.sort((a, b) => a.radius - b.radius)[0];
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

/**
 * When a player spends a bulk reject.
 *
 * Three policies, bracketing the same way the card ones do rather than solving
 * anything. `none` is the board without the button and is what the browser check
 * is run against. `saving` is the player the design is aimed at: hold the
 * charges for the intake that needs them, and break the rule only when the run
 * is about to end anyway. `greedy` is the floor, a player who fires at the first
 * crowd worth firing at and arrives at the ninth with nothing.
 *
 * The interesting number is `saving` against `none`, because that is what the
 * button is worth to somebody using it as intended. `greedy` against `saving` is
 * what the decision itself is worth, which is the same comparison `sensible`
 * against `careless` makes for the cards.
 */
function wantsBulk(run, policy, live, bossHere) {
  if (policy === 'none' || run.charges === 0) {
    return false;
  }

  const crowd = live.filter((who) => who.radius <= run.stats.range).length;

  // Six rather than the ten this was first written with. At ten it spent about a
  // third of one charge a run, because the turret keeps the number standing
  // inside its own reach below that for most of a run, so `greedy` was measuring
  // very nearly the same player as `none` and bracketing nothing.
  if (policy === 'greedy') {
    return crowd >= 6;
  }

  // Saving and hoarding both do this. The boss is what the charges are for, so
  // once it is inside the tower's reach they go in one after another as fast as
  // the cooldown allows.
  if (bossHere) {
    const boss = live.find((who) => who.definition.arrivalCost !== undefined);

    if (boss && boss.radius <= run.stats.range) {
      return true;
    }
  }

  // The exception, and the reason `saving` is not simply "never before the
  // ninth". A charge saved for an intake the run does not reach is a charge
  // wasted, so a run down to a quarter of its tolerance with a crowd in range
  // spends one. `hoard` is the same player with the discipline to refuse that,
  // and the gap between the two is the whole question of whether the discipline
  // is worth anything.
  if (policy === 'hoard') {
    return false;
  }

  return run.health <= run.maxHealth * 0.25 && crowd >= 8;
}

/**
 * When a player spends a hold, which is the fourth thing on this board with a
 * policy rather than a number.
 *
 * The other three decide what a lump of damage lands on. This one decides when
 * the board is worth slowing down, and that is a different question: a hold puts
 * no damage on anybody, it buys the turret more shots before the walk runs out.
 * So the policies bracket the two readings a player could have of it. `late`
 * treats it as the answer to the intake that cannot be shot down in time, which
 * is what the design intends. `crowd` treats it as a second bulk reject and
 * spends it on whoever is standing about. `panic` treats it as a fire escape.
 *
 * `none` is the board before this existed, and is what every number recorded
 * before 1.12.0 was measured on.
 *
 * Nothing here presses while a hold is already running. The board allows it and
 * simply restarts the clock, which is a charge spent to buy the tail of one that
 * was already paid for, and a policy that did it would be measuring a mistake
 * rather than a strategy.
 */
function wantsHold(run, policy, live, bossHere) {
  if (policy === 'none' || run.holds === 0) {
    return false;
  }

  const crowd = live.filter((who) => who.radius <= run.stats.range).length;

  // The intake the holds are for. It goes in when the boss is inside the reach,
  // which is the same trigger the charges use and for the same reason: the
  // slowest thing in the game is worth slowing further only once the turret can
  // actually put shots into it.
  if (policy === 'late') {
    if (!bossHere) {
      return false;
    }

    const boss = live.find((who) => who.definition.arrivalCost !== undefined);

    return Boolean(boss && boss.radius <= run.stats.range);
  }

  // Six inside the reach, the same threshold `greedy` uses, so the two buttons
  // are being spent on the same reading of the board and the difference in the
  // output is the difference between the buttons.
  if (policy === 'crowd') {
    return crowd >= 6;
  }

  return run.health <= run.maxHealth * 0.3 && crowd >= 1;
}

/**
 * The fifth thing with a policy rather than a number, and the first whose cost is
 * not measured in tolerance.
 *
 * A contract on this board takes rating rather than budget, because there is no
 * budget, and the rating cannot end a run. So the question this brackets is not
 * when to spend a charge but whether spending one on a contractor is ever worth
 * it at all, which is a different shape of question from the other four and is
 * the whole reason the feature was measured before it was believed.
 *
 * `none` is the board without the type, and is what every number recorded before
 * this was measured on. `ignore` is the type present and never answered, which is
 * the floor and also, on the arithmetic, the rational play. `answer` spends a
 * charge on any contract on the books. `spare` is the same player with the
 * discipline to keep one back for the ninth intake, which is the reading the
 * design would want if this were worth doing at all.
 */
function wantsBulkOnContract(run, policy) {
  if (run.contracts.length === 0 || run.charges === 0) {
    return false;
  }

  if (policy === 'answer') {
    return true;
  }

  return policy === 'spare' && run.charges > 1;
}

/**
 * Every contract on the books, advanced by however long has just passed.
 *
 * Called from inside an intake and again across the gap between them, because a
 * contract does not care which of those is happening: it is on the books either
 * way, and a drain modelled only during intakes would quietly discount the two
 * seconds a side that eight gaps come to.
 *
 * The cap counts what was actually taken, and the rating floors at nought the
 * same way the desktop's budget does, so a run already scoring nothing cannot be
 * billed into a negative.
 */
function billContracts(run, ms) {
  for (let i = run.contracts.length - 1; i >= 0; i -= 1) {
    const contract = run.contracts[i];
    const allowance = MOBILE_CONTRACT.cap - contract.drained;
    const due = Math.min((contract.rate * ms) / 1000, allowance);

    contract.drained += due;
    run.drained += due;
    contract.age += ms;

    if (contract.age >= MOBILE_CONTRACT.renewalMs) {
      contract.age -= MOBILE_CONTRACT.renewalMs;

      if (contract.renewals >= MOBILE_CONTRACT.maxRenewals) {
        run.contracts.splice(i, 1);
        run.contractsExpired += 1;

        continue;
      }

      contract.renewals += 1;
      contract.rate *= MOBILE_CONTRACT.renewalMultiplier;
      contract.health = APPLICANTS.contractor.health;
    }
  }
}

/** The run as one number, which is what a contract is actually taking. */
function score(cleared, run) {
  const { perWaveCleared, perRejection, perLifeRemaining } = MOBILE_SCORING;

  return Math.max(
    0,
    Math.round(
      cleared * perWaveCleared +
        run.rejected * perRejection +
        run.health * perLifeRemaining -
        run.drained
    )
  );
}

function playRun(policy, bulkPolicy, trapPolicy, holdPolicy, contractPolicy) {
  const run = {
    stats: { ...MOBILE_TOWER, splashRadius: 0 },
    beatsImmunity: false,
    health: MOBILE_RUN.towerHealth,
    maxHealth: MOBILE_RUN.towerHealth,
    taken: [],
    rejected: 0,
    arrived: 0,

    charges: MOBILE_SUPERWEAPON.charges,
    bulkUsed: 0,

    holds: MOBILE_HOLD.charges,
    holdsUsed: 0,

    // Pads laid over the run, and how many rejections went to them. The second
    // is what says whether the thing is pulling its weight, since a pad that
    // goes off on somebody the turret would have killed anyway is worth nothing
    // and is still counted as laid.
    trapsLaid: 0,
    trapKills: 0,
    trapsStale: 0,

    // Whoever is on the books, what they have taken off the rating between them,
    // and how the engagements ended. A contract is not in `live`, because the
    // turret is not handed one: see MOBILE_CONTRACT.
    contracts: [],
    drained: 0,
    contractsStarted: 0,
    contractsRejected: 0,
    contractsExpired: 0,

    // What the tower had left at the end of each intake it finished, which is
    // the only per intake reading that says where the pressure actually is. The
    // totals say what a run came to and cannot say which intake took it there.
    left: []
  };

  for (let index = 0; index < MOBILE_WAVES.length; index += 1) {
    // A card between intakes, and none before the first, which is the game.
    if (index > 0) {
      apply(run, pick(drawCards(run.taken), policy));

      // The gap itself. Nothing walks in it and a contract bills through it, so
      // it is billed rather than skipped.
      billContracts(run, MOBILE_RUN.prepMs);
    }

    const finished = playWave(
      run,
      MOBILE_WAVES[index],
      index + 1,
      bulkPolicy,
      trapPolicy,
      holdPolicy,
      contractPolicy
    );

    if (!finished) {
      return {
        outcome: 'filled',
        cleared: index,
        score: score(index, run),
        ...totals(run)
      };
    }

    run.left.push(run.health / run.maxHealth);
  }

  return {
    outcome: 'held',
    cleared: MOBILE_WAVES.length,
    score: score(MOBILE_WAVES.length, run),
    ...totals(run)
  };
}

function totals(run) {
  return {
    rejected: run.rejected,
    arrived: run.arrived,
    health: run.health,
    maxHealth: run.maxHealth,
    left: run.left,
    taken: run.taken,
    bulkUsed: run.bulkUsed,
    holdsUsed: run.holdsUsed,
    trapsLaid: run.trapsLaid,
    trapKills: run.trapKills,
    trapsStale: run.trapsStale,
    bossStopped: run.bossStopped ?? false,
    bossSeen: run.bossSeen ?? false,
    drained: run.drained,
    contractsStarted: run.contractsStarted,
    contractsRejected: run.contractsRejected,
    contractsExpired: run.contractsExpired
  };
}

/** One intake. Returns false if the tower ran out partway through it. */
function playWave(
  run,
  wave,
  intake,
  bulkPolicy,
  trapPolicy,
  holdPolicy,
  contractPolicy
) {
  const pending = [];

  wave.groups.forEach((group) => {
    for (let n = 0; n < group.count; n += 1) {
      pending.push({ at: group.delayMs + n * group.intervalMs, typeKey: group.applicant });
    }
  });

  // The one arrival that is on no list. Scheduled here rather than in the wave
  // data, because it is not in the wave data, which is the whole point of it.
  const unscheduled = APPLICANTS.contractor.unscheduled;

  if (contractPolicy !== 'none' && intake >= unscheduled.fromWave) {
    for (let sent = 0; sent < unscheduled.perWave; sent += 1) {
      pending.push({ at: unscheduled.delayMs, typeKey: 'contractor' });
    }
  }

  pending.sort((a, b) => a.at - b.at);

  // Whether this intake is the one the charges are being saved for, decided off
  // the wave rather than off its number, so moving the boss list is a data
  // change here as well as in the game.
  const bossHere = wave.groups.some(
    (group) => APPLICANTS[group.applicant].arrivalCost !== undefined
  );

  if (bossHere) {
    run.bossSeen = true;
  }

  const live = [];
  const returns = [];
  let now = 0;
  let nextFireAt = 0;
  let nextBulkAt = 0;
  let released = false;

  // The hold, and when another may be asked for. Both are per intake because
  // the game clears the hold as an intake closes: a slow that carried into the
  // gap would be spent on an empty board.
  let holdUntil = 0;
  let nextHoldAt = 0;

  // The pad, and when another may be laid. Both are per intake because the game
  // is: an unsprung pad is picked up when the intake ends, so a placement that
  // caught nobody costs the rest of that intake rather than the rest of the run.
  let trap = null;
  let nextTrapAt = 0;

  for (;;) {
    while (pending.length > 0 && pending[0].at <= now) {
      live.push(spawn(pending.shift().typeKey, false));
    }

    // Movement. Everybody walks at a quarter speed while a hold is running,
    // which is the whole of what that button does: the turret below is not told
    // about it and fires exactly as it would have done.
    const pace = now < holdUntil ? MOBILE_HOLD.slowMultiplier : 1;

    for (let i = live.length - 1; i >= 0; i -= 1) {
      const who = live[i];

      who.radius -= (who.definition.speed * pace * TICK_MS) / 1000;

      if (who.radius <= RADIAL_BOARD.arrivalRadius) {
        // A contractor reaching the desk is not an arrival. Nothing is filled,
        // no tolerance is taken, and it comes off the list the turret is handed
        // rather than off the board: it is on the books now, and the only thing
        // that can still reach it is a bulk reject.
        if (who.definition.contract) {
          live.splice(i, 1);
          run.contracts.push({
            rate: MOBILE_CONTRACT.ratePerSecond,
            drained: 0,
            renewals: 0,
            age: 0,
            health: who.health
          });
          run.contractsStarted += 1;

          continue;
        }

        if (who.definition.returns && !who.hasReturned) {
          returns.push(who.typeKey);
        }

        live.splice(i, 1);
        run.arrived += 1;
        run.health = Math.max(
          0,
          run.health - (who.definition.arrivalCost ?? MOBILE_RUN.arrivalCost)
        );

        if (run.health === 0) {
          return false;
        }
      }
    }

    // The pad. Laid first, then sprung, in that order and in one tick, because
    // a pad laid on top of somebody already standing there goes off immediately
    // in the game too: `checkTraps` runs on the frame after `layTrap` and does
    // not care how long the thing has been down.
    if (trap === null && now >= nextTrapAt) {
      const spot = wantsTrap(trapPolicy, live, now - nextTrapAt);

      if (spot) {
        trap = { ...spot, staleAt: now + MOBILE_TRAP.staleMs };
        nextTrapAt = now + MOBILE_TRAP.rearmDelayMs;
        run.trapsLaid += 1;
      }
    }

    // A pad nobody has answered goes stale, which is what stops this being a
    // question of how fast the player can tap rather than where.
    if (trap !== null && now >= trap.staleAt) {
      trap = null;
      run.trapsStale += 1;
    }

    if (
      trap !== null &&
      live.some((who) => apart(who, trap) <= MOBILE_TRAP.triggerRadius)
    ) {
      for (let i = live.length - 1; i >= 0; i -= 1) {
        const who = live[i];

        if (apart(who, trap) > MOBILE_TRAP.triggerRadius) {
          continue;
        }

        who.health -= MOBILE_TRAP.damage;

        if (who.health <= 0) {
          if (who.definition.arrivalCost !== undefined) {
            run.bossStopped = true;
          }

          if (who.definition.returns && !who.hasReturned) {
            returns.push(who.typeKey);
          }

          live.splice(i, 1);
          run.rejected += 1;
          run.trapKills += 1;
        }
      }

      trap = null;
    }

    // The hold. Nothing is resolved by it, so it sits above the two things that
    // are: it changes what the next tick's movement costs and nothing else.
    if (
      now >= holdUntil &&
      now >= nextHoldAt &&
      wantsHold(run, holdPolicy, live, bossHere)
    ) {
      run.holds -= 1;
      run.holdsUsed += 1;
      holdUntil = now + MOBILE_HOLD.durationMs;
      nextHoldAt = now + MOBILE_HOLD.cooldownMs;
    }

    // What the contracts have taken since the last tick, and whether any of them
    // has renewed itself or served its last renewal and gone.
    billContracts(run, TICK_MS);

    // A charge spent on the books rather than on the queue. Checked before the
    // ordinary bulk reject so the two cannot both fire on one tick, and it only
    // ever fires when there is a contract to spend it on, so a policy of `none`
    // or `ignore` reaches the branch below exactly as it always did.
    if (
      now >= nextBulkAt &&
      wantsBulkOnContract(run, contractPolicy) &&
      !wantsBulk(run, bulkPolicy, live, bossHere)
    ) {
      run.charges -= 1;
      run.bulkUsed += 1;
      nextBulkAt = now + MOBILE_SUPERWEAPON.cooldownMs;

      // 800 against 80 of health, so every contract on the books goes at once.
      // That is the game: one mail merge reaches everybody on the system.
      for (let i = run.contracts.length - 1; i >= 0; i -= 1) {
        if (run.contracts[i].health <= MOBILE_SUPERWEAPON.damage) {
          run.contracts.splice(i, 1);
          run.contractsRejected += 1;
          run.rejected += 1;
        }
      }
    }

    // The bulk reject, before the turret fires, so a charge spent this tick is
    // not also paid for by a shot the turret had already put into somebody who
    // is now gone.
    if (now >= nextBulkAt && wantsBulk(run, bulkPolicy, live, bossHere)) {
      run.charges -= 1;
      run.bulkUsed += 1;
      nextBulkAt = now + MOBILE_SUPERWEAPON.cooldownMs;

      for (let i = live.length - 1; i >= 0; i -= 1) {
        const who = live[i];

        who.health -= MOBILE_SUPERWEAPON.damage;

        if (who.health <= 0) {
          if (who.definition.arrivalCost !== undefined) {
            run.bossStopped = true;
          }

          if (who.definition.returns && !who.hasReturned) {
            returns.push(who.typeKey);
          }

          live.splice(i, 1);
          run.rejected += 1;
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
            // The shielded variant, which is a design being measured rather than
            // a rule of the board. A contractor is not shot at on the way in
            // either, on the grounds that there is nothing to screen: the
            // engagement was agreed before it walked on. It cannot be expressed
            // as data, because the turret's key is `keywordFilter` and the
            // desktop Keyword Filter is one of the three towers that is supposed
            // to work on this type, so it would have to be the mobile scene
            // choosing what it hands `tower.update`.
            !(SHIELDED && who.definition.contract) &&
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
              if (who.definition.arrivalCost !== undefined) {
                run.bossStopped = true;
              }

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

// Forced off while validating, because the recorded browser runs were played on
// a board with no button on it. See the note on OBSERVED.
const bulkPolicy = validating ? 'none' : flag('bulk', 'saving');

// Off while validating for the same reason the button is: those browser runs
// were played on a board with no pad on it, and a model laying one would be
// checked against a game nobody played.
const trapPolicy = validating ? 'none' : flag('trap', 'none');

// And off for the third time for the third time's reason. The hold arrived in
// 1.12.0 and those runs are from before it, so a model slowing the board down
// would be checked against a game that could not.
const holdPolicy = validating ? 'none' : flag('hold', 'none');

// And off for a fourth time for the fourth time's reason, and off by default as
// well as while validating, because the type is not on this board: it is being
// measured to decide whether it should be. `none` is the game as it stands.
const contractPolicy = validating ? 'none' : flag('contractor', 'none');

// Whether the turret is handed a contractor at all. Off is the type as the
// desktop plays it, walking in like anybody else and shot at like anybody else.
// On is the variant, and the reason it is worth a flag is that the first
// measurement said the walk is where the whole cost lands.
const SHIELDED = args.includes('--shielded');

// And the curve is cut short to match, since those runs never saw a ninth
// intake and printing one under them would invite a comparison there is nothing
// to compare against.
const shown = validating ? Math.min(8, MOBILE_WAVES.length) : MOBILE_WAVES.length;

const policies = validating
  ? ['random']
  : [flag('policy', null)].filter(Boolean).length
    ? [flag('policy')]
    : ['random', 'sensible'];

policies.forEach((policy) => {
  const results = Array.from({ length: runs }, () =>
    playRun(policy, bulkPolicy, trapPolicy, holdPolicy, contractPolicy)
  );
  const held = results.filter((r) => r.outcome === 'held');
  const mean = (pick) =>
    results.reduce((sum, r) => sum + pick(r), 0) / results.length;

  console.log(
    `\n${policy}, bulk ${bulkPolicy}, trap ${trapPolicy}, hold ${holdPolicy},` +
      ` contractor ${contractPolicy}${SHIELDED ? ' shielded' : ''} (${runs} runs)`
  );
  console.log(`  held the vacancy   ${((held.length / runs) * 100).toFixed(1)}%`);
  console.log(`  mean rating        ${mean((r) => r.score).toFixed(0)}`);
  console.log(`  mean rejections    ${mean((r) => r.rejected).toFixed(0)}`);
  console.log(`  mean arrivals      ${mean((r) => r.arrived).toFixed(0)}`);
  console.log(`  mean intakes clear ${mean((r) => r.cleared).toFixed(1)} of ${MOBILE_WAVES.length}`);
  console.log(
    `  tower left on wins ${held.length ? (held.reduce((s, r) => s + r.health, 0) / held.length).toFixed(0) : 'n/a'}`
  );
  console.log(`  mean bulk rejects  ${mean((r) => r.bulkUsed).toFixed(2)} of ${MOBILE_SUPERWEAPON.charges}`);
  console.log(`  mean holds         ${mean((r) => r.holdsUsed).toFixed(2)} of ${MOBILE_HOLD.charges}`);
  console.log(
    `  mean pads laid     ${mean((r) => r.trapsLaid).toFixed(1)}, ${mean((r) => r.trapsStale).toFixed(1)} of them stale`
  );

  // Against the rejections rather than on its own, since a pad that goes off on
  // somebody the turret was about to reach anyway has cost the run nothing and
  // bought it nothing, and the count of pads laid cannot tell the difference.
  console.log(
    `  rejected by a pad  ${mean((r) => r.trapKills).toFixed(1)} of ${mean((r) => r.rejected).toFixed(0)}`
  );

  // The engagements, and what they came to. `drained` is the whole of what this
  // type costs on this board, so it is reported against the rating rather than on
  // its own: a number of points means nothing without the number it came out of.
  if (contractPolicy !== 'none') {
    console.log(
      `  contracts started  ${mean((r) => r.contractsStarted).toFixed(2)},` +
        ` ${mean((r) => r.contractsRejected).toFixed(2)} rejected,` +
        ` ${mean((r) => r.contractsExpired).toFixed(2)} ran their term`
    );
    console.log(
      `  rating drained     ${mean((r) => r.drained).toFixed(0)} of a` +
        ` ${mean((r) => r.score + r.drained).toFixed(0)} rating,` +
        ` ${((mean((r) => r.drained) / mean((r) => r.score + r.drained)) * 100).toFixed(1)}%`
    );
  }

  // Read off the runs that got to the ninth rather than off all of them, since
  // a run that died in the sixth says nothing about whether the boss can be
  // stopped and averaging it in would quietly report that it cannot.
  const met = results.filter((r) => r.bossSeen);

  console.log(
    `  boss stopped       ${met.length ? `${((met.filter((r) => r.bossStopped).length / met.length) * 100).toFixed(0)}% of the ${met.length} runs that met it` : 'nobody met it'}`
  );

  // The mean is the wrong number to tune on and it took a pass to notice. A
  // list where nothing threatens anybody until the last intake and a list that
  // takes a steady toll all the way down can report the same mean, and they are
  // not the same game. This is the survival curve the analytics spec asks for
  // in question 2, computed here rather than waited for.
  console.log('\n  reached intake, and still alive at the end of it');

  for (let intake = 1; intake <= shown; intake += 1) {
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

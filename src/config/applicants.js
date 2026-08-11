/**
 * Applicant stats. Plain data, no logic, so balance can be tuned without
 * going anywhere near the game loop.
 *
 * `bounty` is what rejecting one pays back into the screening budget.
 *
 * How often an applicant turns up is a property of the wave, not of the type,
 * so it lives in waves.js.
 *
 * The optional fields are what makes a type awkward, and each one is read in
 * exactly one place:
 *
 * - `immuneTo` lists tower types that cannot touch it. Those towers do not
 *   even take aim, so nobody wastes a shot on it.
 * - `priorityFor` names a tower type that goes for it ahead of whoever is
 *   closest to the vacancy.
 * - `spawnProgress` starts it partway along the path, from 0 to 1.
 * - `returns` means it comes back once at the end of the wave, whether it was
 *   rejected or reached the vacancy.
 * - `pressure` is how hard it leans on a screening mechanism it walks past, in
 *   integrity per second. Only the open advert mode reads it, since that is the
 *   only mode where applicants push back at all, and how far they can reach is
 *   a property of that mode rather than of the type. A Referral does the most
 *   damage by a distance, which is the joke: it knows somebody.
 * - `caution` is how far out of its way it will go to avoid screening, and only
 *   the back channel reads it, since it is the only mode where anybody chooses
 *   where to walk. Zero is a straight line at the desk whatever is in the way.
 *   One means a cell covered by an average process is worth about one cell of
 *   walking to avoid, so the numbers below are read against each other rather
 *   than against anything absolute.
 * - `showHealth` keeps the health bar over this type up from the moment it
 *   arrives rather than from the first hit it takes. Off everywhere else, and
 *   for a good reason: a bar over everybody is hundreds of flickering slivers on
 *   a board that sends hundreds of applicants. It is on for the one type whose
 *   health is a thing the player has to plan against rather than a thing that
 *   resolves itself in two shots.
 * - `arrivalCost` is what this one getting in takes off the phone board's
 *   tolerance, instead of the flat `MOBILE_RUN.arrivalCost` everybody else
 *   costs. Only the phone board reads it and only one type carries it, on the
 *   same terms as the two fields above: a mode-specific number living on the
 *   type, because it is a fact about who arrived rather than about the board.
 * - `damageFrom` is what a hit from a named tower type is worth against this
 *   one, as a multiplier. Absent means one, which is what every type before the
 *   seventh had and what every tower not named in the map is worth. A zero is
 *   the strongest statement in it and it is read three ways: the tower does not
 *   take aim, a hit that lands anyway does nothing, and a field that holds
 *   people up does not hold this one up. It is a map rather than the flat
 *   `immuneTo` list above because one type needs the scaled form, and because a
 *   tower with nothing to say still has somewhere to say it from: Salary
 *   Expectations does no damage to a contract and still does something to it.
 * - `unscheduled` is a type that does not appear on any intake list and turns up
 *   anyway. `fromWave` is the first intake it can, `perWave` is how many, and
 *   `delayMs` is how far into the intake. Only one type carries it and only the
 *   desktop loop reads it, against the `contractors` field on the mode, so a
 *   board that does not want them never finds out this exists. The leaderboard's
 *   plausibility ceiling reads it too, since an arrival nothing scheduled is
 *   still an arrival that can be rejected and scored for.
 * - `contract` is what happens when this one reaches the vacancy instead of the
 *   vacancy losing a life. The numbers are in the block below with the reasoning.
 *
 * Every type has a `pressure` even where it is small, because a Graduate on its
 * own is not a problem and forty of them standing round one desk is.
 *
 * Two fields are presentation, and they are here because the numbers next to
 * them already decide how the thing looks. `sprite` names the art, from the
 * manifest in art.js, and `colour` tints it and draws the health bar. The art
 * is greyscale so one sprite can serve more than one type. `radius` is what the
 * sprite is scaled to, as well as being where the health bar sits.
 */
export const APPLICANTS = {
  graduate: {
    health: 40,
    speed: 110,
    radius: 11,
    colour: 0xc7d94a,
    sprite: 'unit-round',
    bounty: 6,
    pressure: 6,
    // Applies to everything and reads nothing before it does, so it walks at
    // the desk in a straight line through whatever happens to be in the way.
    caution: 0
  },
  careerChanger: {
    health: 260,
    speed: 55,
    radius: 15,
    colour: 0x6a8fd9,
    sprite: 'vehicle-wide',
    bounty: 20,
    pressure: 12,
    caution: 0.5
  },
  overqualified: {
    health: 70,
    speed: 190,
    radius: 10,
    colour: 0xd9c46a,
    sprite: 'unit-finned',
    bounty: 12,
    priorityFor: 'knockoutQuestion',
    pressure: 8,
    // Has been through all of this before and can see it coming, which makes it
    // the hardest type to catch on a board it is allowed to choose its way
    // across. The Knockout Question still goes for it first, so the answer is
    // to make it walk somewhere it would rather not.
    caution: 1.3
  },
  keywordStuffer: {
    health: 120,
    speed: 95,
    radius: 12,
    colour: 0xd96a9b,
    sprite: 'unit-plain',
    bounty: 15,
    immuneTo: ['keywordFilter'],
    pressure: 11,
    // Minds the rest of the board as much as anybody, and walks straight
    // through a Keyword Filter's ground because a Keyword Filter has nothing to
    // say to it. The immunity was one line for the towers and it is the same
    // line here, which is the whole reason the routing reads it.
    caution: 1.1
  },
  referral: {
    health: 90,
    speed: 120,
    radius: 12,
    colour: 0x9b6ad9,
    sprite: 'unit-slim',
    bounty: 14,
    spawnProgress: 0.28,
    pressure: 26,
    // Knows somebody, so it uses the front door and barely looks at what is
    // stood beside it.
    caution: 0.2
  },
  boomerang: {
    health: 80,
    speed: 105,
    radius: 12,
    colour: 0x6ad9c4,
    sprite: 'vehicle-boxy',
    bounty: 11,
    returns: true,
    pressure: 12,
    caution: 0.9
  },

  /**
   * The seventh, and the one that stopped being the phone board's alone.
   *
   * It is here rather than in config/mobile.js, which is where the phone
   * board's other numbers live, and the reason is that a type is not a number.
   * `Applicant` is handed a definition, `Tower.canTarget` reads `immuneTo` off
   * one, the plausibility check counts a wave by looking each `applicant` key up
   * in this object, and the intro card reads `colour` and `radius` from it. A
   * second table of applicants somewhere else would be a second place all of
   * those have to look, which is the "two answers to where the desk is" problem
   * this project keeps refusing.
   *
   * Putting it in the shared table is what made the final open advert and back
   * channel intakes a wave list edit rather than a feature. Three of the fields
   * below were written as dead weight, filled in so the table had no holes, and
   * two of them are now read. What that cost is set out under each one.
   *
   * **Classic does not send it and is not going to.** It is the mode with a
   * balancing pass behind it, a leaderboard with real scores on it and a live
   * experiment reading its wave one, so an extra arrival in its final intake
   * retunes all three. The other two desktop lists say in their own comments
   * that they are a first pass, which is the whole of why they could take this
   * and classic could not.
   *
   * ## The numbers, and why they are these numbers
   *
   * It is not meant to be killed by the turret. The phone board's tower has
   * something like 130 damage a second once the cards have stacked, and this
   * walks the 210 pixels of the tower's reach in six seconds while everybody
   * faster than it is closer to the desk and therefore being shot at instead. So
   * the turret contributes a few hundred of the 2,600 and no build contributes
   * all of it. What finishes it is the bulk reject, which is the whole point of
   * the two of them arriving together.
   *
   * **2,600 rather than 2,000, and the number was chosen to invert an
   * incentive rather than to set a difficulty.** Three bulk rejects come to
   * 2,400, so at 2,000 a player could spend one getting out of trouble in the
   * seventh and still have enough left to delete this outright. Measured, that
   * player held the vacancy 45% of the time against 31% for one who saved all
   * three, which makes saving them the wrong move and the boss a formality for
   * the second time in one sentence. Above 2,400 the charges stop being
   * sufficient on their own, saving them becomes the better line by 48% to 30%,
   * and the seventh and eighth intakes get their teeth back because nothing is
   * rescuing them. The full table is in config/mobile.js at MOBILE_SUPERWEAPON.
   *
   * `arrivalCost` is heavy rather than fatal. An instant loss would make the
   * eight intakes of tolerance a player has been protecting count for nothing,
   * which is precisely the shape of thing the 1.7.0 tuning pass took out of the
   * wave list, and it would arrive again through a different door.
   *
   * ## What it costs on a desktop board, and why it is only two numbers
   *
   * The health above is priced against one turret doing flat damage, which is
   * the only thing the phone board has. A desktop board has six towers and one
   * of them settles this in a single shot: the Knockout Question carries
   * `instantReject`, GameScene reads it as "take whatever health is left", and
   * 2,600 is then worth exactly as much as 40. A boss the player has to plan
   * against, answered by a tower that is already on the palette, is not a boss.
   * So it is immune to that one tower, which is the field below and no code at
   * all, since `Tower.canTarget` has read `immuneTo` since the Keyword Stuffer.
   * It costs the phone board nothing, because the phone board has no such tower
   * to be immune to.
   *
   * `arrivalCost` is deliberately still phone-only. The desktop leak takes
   * `GAME.livesPerLeak` flat, so this getting in costs one of ten lives, the
   * same as a Graduate. Wiring the field up would be one line and the wrong
   * line: 80 against ten lives is the instant loss refused two paragraphs above,
   * and a second desktop-sized figure would be a number invented to justify a
   * field rather than to balance anything. It is a wall to get past, and the
   * intake behind it is what the run is actually spent on.
   */
  internalCandidate: {
    health: 2600,
    speed: 34,
    radius: 26,
    colour: 0xe08a3c,
    sprite: 'vehicle-wide',
    bounty: 90,
    arrivalCost: 80,

    // The one tower that does not care what the health says. See the section
    // above: without this, every desktop board answers the boss with a 140 cost
    // turret and a 3.4 second reload, and the 2,600 is decoration.
    immuneTo: ['knockoutQuestion'],

    // On, because the whole of the decision this type exists to force is how
    // much of it is left. Without a bar from the start, a player watches an
    // orange slab walk in untouched, since the turret is shooting whoever is
    // nearer the desk, and has no way to tell a charge that helped from a charge
    // that did nothing.
    //
    // The desktop reads it now too, and the reasoning transfers word for word.
    // Desktop targeting is closest to the vacancy, this is the slowest thing on
    // any board, so it is overtaken by everybody and shot at last. A bar that
    // only appears on the first hit would appear about thirty seconds after it
    // walked on.
    showHealth: true,

    /**
     * Two fields that used to be read by nobody. Open advert reads `pressure`
     * and back channel reads `caution`, so both are live from the moment those
     * two lists name this type, and the numbers here are not the numbers that
     * were sat in this slot when nothing read them.
     *
     * **`pressure` came down from 30, and 30 was never a balance decision.**
     * Pressure is priced against how long a type stands next to a tower rather
     * than against how dangerous it looks, and nothing else in this table is
     * remotely this slow. Crossing the 192 pixels of a tower's pressure range at
     * 34 a second takes 5.6 seconds against a Referral's 1.6, so before the
     * recovery is netted off this had three and a half times the worst
     * contribution on the board and a number half again as big to multiply it
     * by. At 30 it takes about 146 integrity out of a single tower on its own
     * walk past, which suspends the Keyword Filter, the Video Screen and the
     * Take-Home Task without a crowd behind it and makes the headline behaviour
     * of the boss "switches your board off", a mode feature nobody designed.
     *
     * At 14 it nets 10 a second and takes about 56 across a full crossing. That
     * is comfortably the largest single contribution on the board, against the
     * Referral's 35 and the Career Changer's 28, and short of the 90 the
     * cheapest tower has. So it softens what it walks past for the intake behind
     * it and suspends nothing by itself, which is a boss leaning on the process
     * rather than a boss deleting it.
     *
     * **`caution` stayed at 0.4 and that is a decision rather than an
     * oversight.** It sits between the Referral's 0.2 and the Career Changer's
     * 0.5, so it walks nearly straight at the desk and minds the screening
     * about as much as somebody who already has the job would. It also has to
     * stay low to stay legible: this is the one arrival on a back channel board
     * that the player is meant to plan a route against, and a high caution boss
     * would spend its thirty seconds threading the gaps and arrive somewhere
     * nobody was watching. The joke is that it walks through the process, not
     * that it dodges it.
     */
    pressure: 14,
    caution: 0.4
  },

  /**
   * The eighth, and the first one that does not play by the rules the other
   * seven are all versions of.
   *
   * Every type above it is a health bar walking at a desk, and the whole of what
   * differs is how much health, how fast, and which tower it is awkward about.
   * Reaching the vacancy costs a life, and ten lives is the run. This one costs
   * no lives at all: the position is never filled, because a contractor is not a
   * hire, so it cannot trigger the loss condition however many of them get in.
   * What it takes instead is budget, at a day rate, for as long as it is on the
   * books.
   *
   * ## What it costs the rest of the game, which is one field each in three
   * places
   *
   * `damageFrom` is the whole of the tower interaction and it is read by
   * `Tower.canTarget`, `Applicant.takeDamage` and `GameScene.applySlows`. Three
   * readers of one map rather than three special cases keyed on a type name,
   * which is the same seam `immuneTo` already ran along.
   *
   * `unscheduled` is the whole of the spawning, and it is read by the desktop
   * loop and by the leaderboard's plausibility ceiling. Nothing else changes:
   * it is `spawnApplicant` with the wave counter told not to count it, since a
   * wave that counted an arrival it never scheduled would end one applicant
   * early.
   *
   * `contract` is the whole of what it does at the desk, and the scene is the
   * only thing that reads it.
   *
   * ## The numbers, and why they are these numbers
   *
   * Health and speed are the Overqualified's, near enough, because that is the
   * arrival the player already knows how to answer and the joke here is not that
   * this one is hard to reject. It is that rejecting it is not obviously the
   * right move: the notice period means there is no bounty, so a Keyword Filter
   * spending four seconds on this is four seconds it does not spend on the queue
   * behind it, and the budget it saves may be less than the budget those four
   * seconds cost.
   *
   * `spawnProgress` puts it four tenths of the way in. It did not come through
   * the front of the funnel, because nobody advertised the role: it is already
   * inside, and the towers covering the first third of the board never see it.
   * The Referral has the same field at 0.28 and the same reason.
   *
   * `bounty` is nought, and it is the only nought in this column. Rejecting a
   * contractor pays nothing back, because the notice period is served whatever
   * anybody decides.
   *
   * `caution` is 1, which is middling, and it is deliberate on the one board
   * that reads it: a contractor is not the Overqualified threading the gaps and
   * it is not the Graduate walking into everything. It minds the screening about
   * as much as somebody being paid by the day minds anything.
   *
   * `showHealth` is on, and it is the only presentation decision here. A
   * renewal puts the health back to full, and a bar that only appeared on the
   * first hit would make the single most important thing this type does
   * invisible until somebody happened to shoot it afterwards.
   */
  contractor: {
    health: 80,
    speed: 175,
    radius: 12,
    colour: 0x9aa7b3,
    sprite: 'unit-slim',
    bounty: 0,
    spawnProgress: 0.4,
    pressure: 8,
    caution: 1,
    showHealth: true,

    /**
     * The three towers with nothing to say to a day rate, and the reasoning is
     * the same joke three times.
     *
     * A Take-Home Task is a fortnight of unpaid work, which is a fortnight of
     * paid work to somebody invoicing for it, so it does not slow this one down.
     * A Culture Fit Panel is asking whether somebody would fit in here, and this
     * one is not staying. Salary Expectations is asking what they expect to be
     * paid, and they have already said, twice, in writing.
     *
     * The last of those is the reason this is a map of numbers rather than a
     * second `immuneTo` list. A zero here stops the pad doing damage and stops
     * nothing else, and the pad still brings the renewal conversation forward,
     * which is `contract.hastenedBy` below.
     *
     * The three not named are the ordinary ones, and they are worth one apiece:
     * the Keyword Filter, the Knockout Question and the Video Screen all work
     * exactly as they work on everybody else. `instantReject` is not excluded
     * here the way it is on the Internal Candidate, because 80 health is not
     * 2,600 and a Knockout Question spending 3.4 seconds of reload on somebody
     * worth no bounty is a decision rather than a shortcut.
     */
    damageFrom: {
      takeHomeTask: 0,
      cultureFitPanel: 0,
      salaryExpectations: 0
    },

    /**
     * It is on no intake list, and that is the point of it rather than an
     * omission. A contractor is not a line in the plan, it is somebody a manager
     * has already agreed to before anybody was told, and a type that turned up
     * in `waves.js` would be a type the player could count.
     *
     * From the fourth intake, because the first three are where a player is
     * still learning what the six towers do, and one per intake, because two
     * would be a second budget problem rather than the same one twice.
     *
     * `delayMs` is eleven seconds in, which on every list here is after the
     * opening group has been dealt with and while the second one is arriving.
     * That is the moment it is meant to be missed in.
     */
    unscheduled: {
      fromWave: 4,
      perWave: 1,
      delayMs: 11000
    },

    /**
     * The engagement, once it reaches the desk.
     *
     * `dayRate` is budget a second while it is on the books. Two is about a
     * third of what a Graduate pays back when it is rejected, so a contractor
     * left alone for a minute costs roughly what twenty Graduates earn, which is
     * most of an early intake's income.
     *
     * `cap` is the most one engagement may ever take, and it is there because
     * the drain has no natural end: a player who cannot reach the desk with a
     * tower would otherwise watch a budget go to nought and stay there. A
     * hundred and twenty is two thirds of the opening budget and rather more
     * than any single intake pays out, so it is expensive without being the run.
     * Only budget actually taken counts against it, so a contractor billing an
     * empty budget bills nothing and the cap is not quietly spent on nothing.
     *
     * `renewalMs` and `maxRenewals` are the shape of the thing. Twenty seconds
     * of not dealing with it and the contract renews: full health again, and the
     * rate up by half. Three renewals is the end of it, and then it leaves of its
     * own accord, because the fiction has to end somewhere and a contractor that
     * stayed for ever would be a loss condition by another name on a type whose
     * whole argument is that it is not one.
     *
     * `hastenedBy` is what a tower does to the clock rather than to the health.
     * Salary Expectations brings the renewal conversation forward five seconds,
     * which reads both ways and is meant to: it costs the player the rate going
     * up sooner, and it brings the departure forward by the same five seconds,
     * because the engagement is a fixed number of renewals rather than a fixed
     * length of time.
     */
    contract: {
      dayRate: 2,
      cap: 120,
      renewalMs: 20000,
      renewalMultiplier: 1.5,
      maxRenewals: 3,
      hastenedBy: {
        salaryExpectations: 5000
      }
    }
  }
};

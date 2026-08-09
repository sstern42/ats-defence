/**
 * The phone game's numbers, for issue #47. Plain data, no logic, so this board
 * can be tuned without going anywhere near the loop that plays it.
 *
 * **Tuned once, against the simulator, in 1.7.0.** What was here before was
 * picked to make the board legible on a preview and had no measurement behind
 * it at all. The two numbers below that moved are the tolerance and what an
 * arrival costs, and they moved together: a run absorbs sixty applicants where
 * it used to absorb forty.
 *
 * That is not a softening, it is room. The old list leaked nothing at all for
 * seven intakes and then decided the whole game in the eighth, so the entire
 * budget was spent in one place and it did not matter how large it was. The new
 * list takes something from the third intake onwards, which only works if there
 * is enough to take.
 *
 * One thing this pass did not fix, and it should be read before the card pool is
 * touched. Update the keyword list is the worst card in the pool, measurably, and
 * it is the card the design considered its flagship decision. The reason is the
 * note further down this file arriving somewhere nobody looked for it. See
 * `tools/simulate-mobile.mjs` at SENSIBLE_ORDER for the measurement.
 *
 * ## Why there is a tower here rather than a reference to the one in towers.js
 *
 * The obvious version of this file spreads `TOWERS.keywordFilter` and overrides
 * the two numbers that do not fit. That is the version to avoid.
 *
 * Classic's numbers are balanced against a 2,460 pixel walk past a board's worth
 * of screening. This board is one tower and a 290 pixel approach, so almost
 * nothing transfers: at classic's twelve damage on a 380 millisecond reload, a
 * Graduate crosses the whole range and comes out alive on forty health, which is
 * what the first run of this scene did.
 *
 * The deeper reason is the direction of the coupling. `CLAUDE.md` says classic
 * does not move, and a mobile board that read classic's tower would make the
 * reverse true as well: every future tuning pass on the Keyword Filter would
 * silently retune a mode nobody was thinking about, and the two would have to be
 * balanced together forever. A separate object costs a few repeated fields once.
 * Shared numbers cost a conversation every time either mode is touched.
 *
 * ## Why the key is still `keywordFilter`
 *
 * The type key is not decoration. `Tower.canTarget` reads
 * `applicant.immuneTo`, and The Keyword Stuffer's immunity names this key, so a
 * tower calling itself anything else would quietly lose the one interaction that
 * makes that applicant what it is. The key is the joke's plumbing.
 */
export const MOBILE_TOWER_KEY = 'keywordFilter';

/**
 * What the tower calls itself once the Update the keyword list card is taken.
 *
 * This is the whole of that card's mechanism and it is worth explaining, because
 * it looks like a trick and is actually the model. Immunity is not a property of
 * a tower, it is a property of an applicant: The Keyword Stuffer carries
 * `immuneTo: ['keywordFilter']`, and `Tower.canTarget` asks whether its own key
 * is in that list. A filter running a list of terms nobody is gaming any more is
 * not the filter that was being gamed, so it stops being the thing the immunity
 * names and the stuffing stops working.
 *
 * The value has to be a key no applicant lists, which is every string that is
 * not one of the six tower keys. It reads as one here so that a later type
 * cannot be given immunity to it by accident.
 */
export const MOBILE_TOWER_KEY_UPDATED = 'keywordFilterRevised';

export const MOBILE_TOWER = {
  behaviour: 'shoot',

  // Wide, because it is the only screening on the board and everything walks
  // straight at it. From the 320 ring this leaves a stretch of approach outside
  // the range, so arriving is still a thing that takes time and can be watched.
  range: 240,

  damage: 20,
  fireIntervalMs: 300,
  footprint: 40,
  sprite: { base: 'tower-base', barrel: 'turret-twin' },
  bodyTint: 0x8fc4de,
  tracerColour: 0x8fc4de,
  tracerDurationMs: 90
};

/**
 * What a shot looks like, and the two cards it is how the board shows.
 *
 * Four of the six show themselves without help: the range ring grows, the
 * splash catches somebody standing behind, the tolerance bar refills, and a
 * Keyword Stuffer stops walking through untouched. The other two buy a number
 * the player is never shown, so a shot carries them instead.
 *
 * ## Screen in parallel, as a count of lines
 *
 * That card buys a shorter reload. A player who takes it sees a turret firing
 * at the same target with the same tracer and has to count the gaps between
 * shots to know anything happened, and on a board where a Career Changer is
 * absorbing everything the turret has, they will be counting for a while. So a
 * shot draws one line per screening running at once, side by side, and the
 * count goes up with the card.
 *
 * `spacing` is the gap between neighbouring lines, and `maxLines` is where it
 * stops. The reload floor allows about seven of these cards to matter, and seven
 * lines seven pixels apart is a beam rather than a set of parallel screenings,
 * which says less than one line did. Four is where it still reads as counted.
 *
 * ## Raise the bar, as the weight and the heat of them
 *
 * Damage is the other one, and it is worse than the reload rather than better.
 * A shorter reload can at least be counted. A bigger number per shot cannot be
 * seen at all: the same turret fires at the same rate at the same target, and
 * the only trace of the card is that health bars empty in fewer shots, which is
 * a thing nobody holds in their head across intakes. The flagship of this pool
 * is the card the design measures at 29.4% and the player watches for four
 * minutes without ever seeing it arrive.
 *
 * So each Raise the bar widens the lines by `widthStep` and moves them one stop
 * along `heat`, which runs from the tower's own pale blue into the warm orange
 * the desktop board already gives its hardest hitting screening. Two readings
 * rather than one, because this board is drawn at 720 by 1280 and then scaled
 * down to whatever phone is holding it: a line two pixels wide lands at about
 * one, and a pixel of extra width on its own is not a signal, it is a rounding
 * error. Colour survives the scaling. Width says which of two warm shots is the
 * warmer, once somebody has taken two.
 *
 * `maxWidth` is 4 and it is tied to `spacing` rather than picked. Four lines
 * seven apart leaves three pixels of gap, and a line six wide closes it, so a
 * player stacking damage would watch the parallel screenings above merge back
 * into the single beam they were drawn to stop being. One card's signal must not
 * eat the other's. `heat` stops after three for the reason `maxLines` stops
 * after four: past that the stops are too close together to read as steps.
 *
 * The colours deliberately go warm rather than anywhere else. The other thing
 * this board draws in its own colour is the salary pad, which is yellow, and a
 * ramp through yellow would have the shots agreeing with it about nothing.
 *
 * ## Both are cosmetic and deliberately so
 *
 * The damage, the target and the reload are exactly what they were, and nothing
 * in `tools/simulate-mobile.mjs` can see any of this. The cards that measure at
 * 13.5% and 7.5% still measure at 13.5% and 7.5%.
 */
export const MOBILE_TRACER = {
  spacing: 7,
  maxLines: 4,

  width: 2,
  widthStep: 1,
  maxWidth: 4,

  // One stop per Raise the bar taken, clamped at the last. The first is the
  // Knockout Question's tracer on the desktop board, which is the tower that
  // rejects outright, so the association is already in the palette.
  heat: [0xd98a6a, 0xe0703c, 0xe04a3c]
};

/**
 * The run itself.
 *
 * `towerHealth` is what the vacancy's lives are on this board, held on the
 * tower because the tower is the thing the player is defending and the thing
 * they are shown. `arrivalCost` is what one applicant getting in takes off it.
 *
 * The arrivals themselves are not here. They are a wave list, in waves.js with
 * the other three, on the strength of the convention that wave definitions live
 * there.
 */
export const MOBILE_RUN = {
  towerHealth: 240,
  arrivalCost: 4,

  // The pause between intakes, and a longer one before the first. It is
  // currently dead time, because there is nothing in it: it exists because it
  // is where the upgrade cards go, and having the phase before having the thing
  // that fills it means the modal arrives as content rather than as structure.
  firstPrepMs: 3000,
  prepMs: 2200
};

/**
 * The bulk reject: the one thing a player of this board does during an intake.
 *
 * ## What it broke to exist
 *
 * `CLAUDE.md` described this mode as taking no input at all during an intake,
 * and that was not a description, it was load bearing. It is the reason the idle
 * abandonment clock is switched off here, it is two thirds of the argument for
 * this board being a scene set of its own, and it is why the whole of the
 * player's agency was a card between intakes. A button on the board during a
 * wave is that sentence being overturned rather than worked around, and it was
 * asked for.
 *
 * The one thing that does not move with it is the idle clock, and the reason is
 * unchanged rather than merely convenient. Three charges over a nine intake run
 * is a player who touches the screen three times in about four minutes, so idle
 * would still count somebody watching as an empty chair, and since
 * `run_abandoned` fires once per run their real exit would still be the one that
 * went unrecorded. The rule was never "there is input", it was "input is not how
 * you tell whether anybody is there".
 *
 * ## Why it is damage rather than a clearance
 *
 * The obvious version rejects everybody on the board outright, and it is the
 * version to avoid, because the boss intake is the reason this exists and a
 * clearance deletes a boss as readily as it deletes a Graduate. One number that
 * kills everything with less than 800 health does the same job on the crowd, is
 * one code path rather than a rule with an exception carved into it for one
 * applicant type, and leaves the question of how much of a 2,000 health arrival
 * one charge is worth as a thing to tune here rather than a thing to special
 * case in the loop.
 *
 * ## The three numbers
 *
 * `charges` is a run's whole allowance and nothing gives one back. Three,
 * because two makes the boss intake a straight test of whether both were saved
 * and turns the other eight into intakes a careful player must sit on their
 * hands through, and four is enough to answer the boss and still have one spare.
 * Three is two for the boss and one to spend, or one for the boss and a run that
 * was easier on the way there.
 *
 * `cooldownMs` exists for the fat finger rather than for balance. Two taps
 * inside a second on a phone is one intended press, and spending two thirds of a
 * run's allowance on it is not a decision anybody made.
 *
 * ## What it measures at
 *
 * `tools/simulate-mobile.mjs --bulk <policy>`, 10,000 runs each, vacancies held:
 *
 *                    none   greedy   saving   hoard
 *   sensible cards    0.3%    16.2%    31.6%   47.6%
 *   random cards      0.1%     1.0%     2.4%    5.0%
 *   careless cards    0.1%     1.1%     1.1%    2.5%
 *
 * `hoard` spends nothing before the ninth intake, `saving` breaks that to
 * rescue a run about to end anyway, and `greedy` fires at the first crowd worth
 * firing at. The policies are described where they are implemented.
 *
 * Three things worth reading off it. The button is close to mandatory, since
 * `none` holds the vacancy in one run in three hundred at best. When to spend it
 * is worth about three times the run, which makes it a real second decision
 * rather than a button that is always right to press. And it is worth far less
 * than the cards are, which is as it should be: `sensible` beats `careless` by
 * about nineteen times on the same bulk policy, so the thing the design calls
 * its decision is still the decision.
 *
 * **The honest cost is the shape of the curve, and it is the 1.7.0 complaint
 * arriving through a different door.** A player who keeps the charges has an
 * eighth intake that 58% of runs survive and a ninth that 47% do, which is the
 * two step shape the tuning pass was after. A player who spends one to get out
 * of trouble takes the eighth to 94% and the ninth to 30%, and the run then ends
 * in the ninth or not at all. That is one intake deciding everything, which is
 * exactly what the tuning pass took out of this list. What is different is that
 * it is now a consequence of something the player chose rather than a property
 * of the numbers, and the player who declines it gets the curve back. That is
 * the best available answer and it is not a complete one.
 */
export const MOBILE_SUPERWEAPON = {
  charges: 3,
  damage: 800,
  cooldownMs: 800
};

/**
 * Salary expectations, the sixth screening mechanism, on the board that had no
 * way to hold one.
 *
 * ## What had to give for it to be here
 *
 * A trap is a spatial decision. Free, laid somewhere, sprung by whoever walks
 * onto it, and take the somewhere away and what is left is not a weaker trap, it
 * is a different object. That different object also already exists: a free burst
 * of damage on a crowd, decided only by when it is pressed, is the bulk reject
 * above, which has ten thousand runs a policy behind it. So this either becomes
 * a placement on a board with no placement, or it does not come.
 *
 * It became a placement, and `CLAUDE.md` is rewritten for it rather than around
 * it. That is the second of the four inversions this scene set was argued from,
 * after "no input during an intake" went in 1.10.0. The other two are untouched
 * and each is still worth a scene set on its own: there is no route, and there
 * is no currency, which is most of what the other two thirds of the desktop
 * `GameScene` is for.
 *
 * ## What is not new
 *
 * `entities/Trap.js` is used exactly as it stands, which makes it the fifth
 * feature running that edits no entity. Laying a pad on ground rather than on a
 * line is not new either: `trapSnapDistance` is already zero in open advert and
 * back channel, where a trap goes where it is put and choosing a busy patch of
 * floor is the player's problem. And `tower_placed` already fires for traps, so
 * there is no sixteenth event in here.
 *
 * ## Why the numbers are not the ones in towers.js
 *
 * Same reason the tower's are not, and more sharply. Classic's pad does 140,
 * which on this board kills every applicant type except the Career Changer and
 * the boss, free, every four seconds. That is not a screening mechanism, it is a
 * second turret, and the coupling would run the wrong way afterwards: a tuning
 * pass on classic's trap would silently retune a phone board nobody was thinking
 * about.
 *
 * `damage` is therefore its own, and it is the number this whole thing turns on.
 * `triggerRadius` is classic's, since a pad's reach is about how big a pad is
 * rather than about which board it is on. `rearmDelayMs` is measured from laying
 * rather than from springing, which is classic's rule and caps how often the
 * question can be asked however the player taps.
 *
 * ## `staleMs`, which is the only reason any of this is a decision
 *
 * A pad nobody has trodden on is gone in six seconds. That rule was not in the
 * design, it came out of the measurement, and it is the whole difference between
 * a placement and a button.
 *
 * Without it, a pad sits until somebody walks onto it, and on this board
 * somebody always eventually does: every applicant walks a straight line to the
 * same desk, so a pad dropped anywhere at all is on somebody's route. Measured,
 * a policy that tapped a uniformly random spot without looking did as well as
 * one that aimed, and both did better than a policy that waited for a good spot,
 * because waiting only ever costs you the next pad. That is a tap-as-often-as-
 * you-can button wearing a pad's clothes, which is the thing this was not
 * supposed to become.
 *
 * With expiry, a pad put where nobody is going is simply wasted, and half of the
 * blind player's are. The board did not have to change and the fiction did not
 * have to stretch: a question nobody was asked is a question nobody answers.
 *
 * ## The other two rules
 *
 * One pad at a time, and it can only be laid while an intake is running. The
 * first is classic's `maxArmed: 1` and is what stops the floor being paved. The
 * second is the bulk reject's rule for a different reason: a pad laid during the
 * countdown would be a spot chosen before anybody has an angle, so it would be a
 * coin flip that is always worth taking, which is a chore rather than a decision.
 *
 * The rearm clock starts again when an intake opens, so the first pad of each is
 * always there to be laid. Nine intakes, roughly a pad and a half in each.
 *
 * ## What it measures at
 *
 * `tools/simulate-mobile.mjs --trap <policy>`, 5,000 runs each, sensible cards
 * and saving charges throughout, vacancies held:
 *
 *                    none    blind    front   cluster
 *   sensible cards   30.3%    34.5%    40.7%     36.2%
 *
 * `blind` taps somewhere a person could walk without looking at where anybody
 * is, `front` lays it just in front of whoever is nearest the desk, and
 * `cluster` holds out for a spot that catches two. The policies are described
 * where they are implemented.
 *
 * Three things to read off it. The pad is worth about ten points of a run to
 * somebody using it properly, which is a third of what the charges are worth and
 * a small fraction of what the cards are, and that ordering is the one this
 * design wants: the thing it calls its decision is still the decision. Looking
 * at the board before tapping is worth six of those ten, which is what makes it a
 * placement. And it rescues nobody from a bad draw: a player taking cards at
 * random goes from 1.7% to 4.6% with it, so it is a help rather than an answer.
 *
 * The honest cost is at the top. A player who hoards the charges and lays the pad
 * well holds the vacancy 60.1% of the time against 47.4% before it, so the
 * ceiling on this board has gone up by more than the middle has. That is what a
 * free renewable control does, and the lever if it wants pulling back is
 * `rearmDelayMs` rather than `damage`: at 12,000 the same player is at 47%, and
 * at 24,000 the pad is worth nothing at all to anybody.
 *
 * **`front` beating `cluster` is the finding worth keeping.** The obvious play,
 * dropping it just ahead of the leader, beats the clever-looking one that goes
 * hunting for a crowd. Every applicant walks a straight line to the same desk, so
 * the ground in front of whoever is closest is where those lines are nearest
 * together, and a heuristic that looks for a crowd further out has gone looking
 * in the thin part of the board.
 */
export const MOBILE_TRAP = {
  behaviour: 'trap',
  damage: 60,
  triggerRadius: 40,
  rearmDelayMs: 16000,
  staleMs: 6000,

  // Not classic's 30, and it is a drawing number rather than a balance one.
  // `Trap` scales the pad to `footprint * TRAP_SPRITE_SCALE`, so 57 puts the
  // edge of the drawn pad exactly on the edge of the 40 it actually catches
  // people within. Classic's is smaller than its reach and gets away with it,
  // because a trap there is snapped onto a path the player can see; here the pad
  // is the only thing saying where the question was asked.
  footprint: 57,
  sprite: { base: 'trap-pad' },
  bodyTint: 0xd9cf6a,
  fieldColour: 0xd9cf6a,
  burstDurationMs: 320
};

/**
 * The key it is laid under, which is the key classic lays it under.
 *
 * It is not plumbing the way `MOBILE_TOWER_KEY` is, since nobody is immune to a
 * pad, but `tower_placed` carries a `tower_type` and a board reporting its trap
 * under a name of its own would split one mechanism into two rows in every
 * query in `docs/` that counts what gets used.
 */
export const MOBILE_TRAP_KEY = 'salaryExpectations';

/*
 * A NOTE, NOT A DEFINITION. Something the first run of this board threw up,
 * kept here because it is the sort of thing that gets rediscovered expensively
 * later and because it is the reason the card pool is shaped as it is.
 *
 * `Tower.findTarget` picks whoever has the least walking left, which is the
 * right answer on every board built so far and has an odd consequence on this
 * one. With a single tower, a type it cannot kill will absorb every shot it
 * fires for as long as that type is the closest to the desk. A Career Changer
 * walks in at 55 pixels a second with 260 health, soaks the entire output of the
 * tower on the way, and everybody behind it strolls past unshot.
 *
 * That is not a bug and it should not be fixed here. It is the Career Changer
 * doing exactly what it is for, and on a board with six towers somebody else
 * covers while it is busy. It matters because this design has no somebody else,
 * so on this board that one interaction is most of the difficulty curve, and
 * whoever tunes the wave list needs to know it before they start rather than
 * after.
 *
 * It is also the first thing that argues for what the upgrade cards should
 * offer: on a board where one type can monopolise a single tower, a card that
 * changes what the tower shoots at is worth more than a card that makes it shoot
 * harder.
 */

/**
 * The shake when somebody gets in, matching the desktop board's leak exactly.
 *
 * Numbers rather than a call site literal, because they are feel rather than
 * logic and this file is where this board's feel lives. `services/feel.js` is
 * still what performs it, which is what keeps the reduced motion decision in the
 * one place that makes it.
 */
export const MOBILE_LEAK_SHAKE = { durationMs: 180, intensity: 0.005 };

/**
 * Turning a run into one number.
 *
 * The same three terms `GAME.scoring` has, because a run here is the same three
 * things: how deep it got, how much it screened, and how much of the vacancy's
 * patience was left at the end. What differs is the weights, and they differ for
 * a reason worth writing down rather than by taste.
 *
 * A classic run rejects something like seventy applicants. A run here rejects
 * around a hundred and forty, and a run that holds the vacancy rejects most of
 * the 235 the list sends. At classic's ten a rejection the rejection term would
 * swamp the other two and the score would become a count of how long the run
 * lasted. Four keeps it a term rather than the whole formula.
 *
 * ## Why the keys are classic's words and not this board's
 *
 * They used to be `perIntakeCleared` and `perTolerancePoint`, which is what the
 * two terms are actually called here, and it cost more than it was worth. The
 * leaderboard's ceiling is computed by one function for all four modes, and a
 * mode whose weights are spelled differently is a mode that function has to know
 * about by name. One vocabulary means it reads the weights off whichever mode it
 * was handed and never asks which one it is, which is the arrangement every
 * other field on a mode already has.
 *
 * So `perLifeRemaining` is reinterpreted rather than renamed: a life on this
 * board is a point of tower integrity, of which a run starts with 240 rather
 * than ten. The weight is two rather than forty for exactly that reason. The two
 * boards used to value an untouched defence at the same four hundred, which was
 * a coincidence and was noted here as one worth keeping; the tuning pass moved
 * the tolerance to 240 and it is 480 now. Nothing was lost with it, which is
 * what a coincidence being only a coincidence means. The term is still about a
 * fifth of a perfect run either way, and that proportion is the thing that
 * matters.
 *
 * It is scored against what is left rather than against a fraction of the
 * maximum, because Extend the deadline raises the maximum. A fraction would
 * quietly punish the card that makes the tower more durable.
 *
 * That the leaderboard reads these is why they are in config rather than in the
 * scene. `netlify/functions/lib/plausibility.js` recomputes the ceiling from the
 * same numbers the game plays with, and a ceiling built from hundreds of
 * rejections at classic's weight would be so large it stopped excluding
 * anything.
 */
export const MOBILE_SCORING = {
  perWaveCleared: 150,
  perRejection: 4,
  perLifeRemaining: 2
};

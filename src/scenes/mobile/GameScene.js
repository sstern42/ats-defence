import Phaser from 'phaser';

import { COPY } from '../../content/copy.js';
import { APPLICANTS } from '../../config/applicants.js';
import {
  MOBILE_RUN,
  MOBILE_TOWER,
  MOBILE_TOWER_KEY,
  MOBILE_LEAK_SHAKE,
  MOBILE_SCORING,
  MOBILE_TOWER_KEY_UPDATED
} from '../../config/mobile.js';
import { RADIAL_BOARD } from '../../config/path.js';
import { MOBILE_WAVES } from '../../config/waves.js';
import {
  MIN_FIRE_INTERVAL_MS,
  UPGRADES,
  UPGRADES_OFFERED
} from '../../config/upgrades.js';
// `hasArrived` is not wanted here. The walk is a tween and it ends at the
// arrival point, so the applicant says when it got there rather than the scene
// testing a distance every frame to find out.
import { arrivalPoint, spawnPoint } from '../../services/radial.js';
import { FLOOR_TINT, addVignette } from '../backdrop.js';
import {
  setWaveNumber,
  stopWatchingForIdle,
  trackApplicantLeaked,
  trackGameOver,
  trackGameStarted,
  trackUpgradeOffered,
  trackWaveCompleted,
  trackWaveStarted
} from '../../services/analytics.js';
import { playSound, soundEnabled, toggleSound } from '../../services/audio.js';
import {
  musicEnabled,
  startMusic,
  stopMusic,
  toggleMusic
} from '../../services/music.js';
import { FEEL, nudge, shake } from '../../services/feel.js';
import Applicant from '../../entities/Applicant.js';
import Tower from '../../entities/Tower.js';

/**
 * The phone game's loop, for issue #47. One tower in the middle, applicants
 * converging on it from every direction, no route and no placement.
 *
 * The headline about this file is what is not in it. `entities/Applicant.js`
 * and `entities/Tower.js` are used exactly as they stand, with no fork, no
 * subclass and no edit. The audit expected a rewritten applicant to be the
 * single largest piece of work here, on the grounds that a tween driven
 * PathFollower could not carry the entity count. A handset says it carries 3000
 * of them, and a radial walk is a path with one segment in it, which is a thing
 * the existing entity already knows how to do.
 *
 * So the strongest form of "classic does not move" is available and taken: the
 * file three tuned modes depend on is not touched at all.
 *
 * What this is not, yet: no leaderboard, and no floating damage numbers. The
 * second of those is unsettled rather than unbuilt, and the reason is at
 * buildHud below.
 */

/** Tall enough to survive the board being scaled down onto a phone screen. */
const HEALTH_BAR_HEIGHT = 7;

const FONT = 'system-ui, sans-serif';

export default class MobileGameScene extends Phaser.Scene {
  constructor() {
    super('MobileGameScene');
  }

  // No `preload`. The art and the clips are fetched by the mobile BootScene,
  // which had to exist once the home page needed the same carpet this board
  // stands on, and they are in the cache by the time a run is asked for. A
  // restart does not come back through there and does not need to.

  create() {
    // A run has begun, which is what game_started means on every other board.
    trackGameStarted();

    // This board takes nothing from the player during an intake, so the idle
    // clock would count somebody watching as an empty chair. The reasoning is
    // at stopWatchingForIdle in the service.
    stopWatchingForIdle();

    this.drawFloor();

    this.applicants = [];
    this.shots = [];

    // The tower's tolerance is held here rather than on `Tower.integrity`,
    // which already exists and is close to the right shape. Integrity carries
    // suspension: a tower worn to nothing goes off for a few seconds and comes
    // back, which is exactly right for the crowd in open advert and exactly
    // wrong here, where running out is the end of the run rather than a pause
    // in it. Two meanings on one field would be one of them waiting to be
    // broken by a change to the other.
    this.health = MOBILE_RUN.towerHealth;
    this.taken = [];
    this.rejected = 0;
    this.arrived = 0;
    this.over = false;

    this.waveIndex = 0;
    this.spawnsRemaining = 0;
    this.waveTimers = [];

    // Boomerangs that have been dealt with once and owe the board a second
    // appearance. Held until the wave is otherwise clear, which is what makes
    // it a return rather than a respawn.
    this.pendingReturns = [];

    this.phase = 'preparing';

    const { centre } = RADIAL_BOARD;

    // The run's own copy of the tower's stats, and the whole of the defence
    // against the trap the audit expected to ship.
    //
    // `Tower` holds a live reference to whatever definition it is handed and
    // reads it on every shot, and MOBILE_TOWER is a module singleton that
    // outlives a run exactly as TOWERS does. An upgrade written straight onto it
    // would carry into every later run in the same tab, silently, with nothing
    // to catch it. Cloning here costs one spread and means the config stays the
    // config.
    //
    // `splashRadius` starts at nothing and is the Convene a panel card. It is
    // read by this scene rather than by Tower, which has never known what splash
    // is: on the desktop board the scene resolves it too.
    this.stats = { ...MOBILE_TOWER, splashRadius: 0 };
    this.maxHealth = MOBILE_RUN.towerHealth;

    const definition = this.stats;

    this.range = this.add.graphics().setDepth(0);

    this.tower = new Tower(
      this,
      centre.x,
      centre.y,
      MOBILE_TOWER_KEY,
      definition,
      definition.sprite
    );
    this.tower.setDepth(10);

    this.tracers = this.add.graphics().setDepth(20);
    this.healthBars = this.add.graphics().setDepth(15);
    this.bar = this.add.graphics().setDepth(30);

    this.drawRange();

    this.beginPreparation(MOBILE_RUN.firstPrepMs);

    // Off unless the player has asked for it, which is the state the desktop
    // remembers for them. A run starting is what wants music, not the page
    // loading, so this is here rather than at boot.
    startMusic();

    this.buildHud();
  }

  update(time) {
    if (!this.over) {
      this.fire(time);
      this.checkWaveComplete();
    }

    this.drawTracers(time);
    this.drawHealthBars();
    this.drawBar();
  }

  /**
   * The office, under everything.
   *
   * The same carpet the other three boards stand on, tiled, with the same
   * vignette stretched over it so the board reads as a room with a middle rather
   * than a flat sheet. It is the cheapest thing in this commit and the one that
   * makes the board stop looking like a prototype.
   *
   * `floor-tread` is deliberately not here. It is the carpet worn through by
   * thousands of applicants walking the same line, and it is masked to a route.
   * This board has no route to wear out, which is the joke of the mode: they do
   * not queue.
   */
  drawFloor() {
    const { width, height } = RADIAL_BOARD.board;

    this.add
      .tileSprite(0, 0, width, height, 'floor-carpet')
      .setOrigin(0, 0)
      .setTint(FLOOR_TINT)
      .setDepth(-20);

    addVignette(this, -10);
  }

  // ---------------------------------------------------------------------- HUD

  /**
   * The whole HUD: which intake this is, and the bar under the tower drawn by
   * drawBar. The design asks for a wave counter, one health bar and floating
   * damage numbers, and nothing else. Two of the three are here.
   *
   * Floating damage numbers are deliberately absent rather than forgotten. They
   * are unsettled on #47: information carried by an animation runs into "nothing
   * is said by movement alone", and the question of whether they say anything at
   * all is worth answering before they are built. If the bar and the deaths
   * carry the state they are decoration and reduced motion can drop them.
   *
   * The diagnostic readout this replaces is gone. It was debug output, it ran off
   * the right edge once a few cards were listed, and it showed through the game
   * over veil.
   *
   * Drawn on this scene rather than on a UIScene of its own. The desktop splits
   * them because its HUD is a six button palette with state to keep in step; this
   * is one line of text that is told what to say when the intake changes.
   */
  buildHud() {
    this.intakeLabel = this.add
      .text(RADIAL_BOARD.board.width / 2, 78, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#8b98a6'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100);

    this.showIntake();
    this.buildSwitches();
  }

  /**
   * The two switches, and the only controls on the board.
   *
   * They are here because the project's own rule is that sound has a toggle and
   * the choice is remembered, and music has its own separate one. Shipping audio
   * onto a phone with no way to silence it would break that, and a phone is the
   * device most likely to be somewhere silence is expected.
   *
   * Drawn small and quiet at the bottom, well clear of the ring. They are the
   * only thing on this screen a finger is meant to find during a run, and the
   * design says the middle third is for the board.
   */
  buildSwitches() {
    const { width, height } = RADIAL_BOARD.board;

    this.soundSwitch = this.switch(width / 2 - 110, height - 60, () => {
      toggleSound();
      this.refreshSwitches();
    });

    this.musicSwitch = this.switch(width / 2 + 110, height - 60, () => {
      toggleMusic();
      this.refreshSwitches();
    });

    this.refreshSwitches();
  }

  switch(x, y, onPress) {
    const button = this.add
      .text(x, y, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#6f7d8c',
        padding: { x: 14, y: 10 }
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100)
      .setInteractive({ useHandCursor: true });

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      // Down under the finger before anything is decided, since a control that
      // moves says the tap arrived whether or not the state changes.
      nudge(button, 0, FEEL.pressDrop);
      onPress();
    });

    return button;
  }

  refreshSwitches() {
    this.soundSwitch.setText(
      soundEnabled() ? COPY.hud.soundOnTouch : COPY.hud.soundOffTouch
    );
    this.musicSwitch.setText(
      musicEnabled() ? COPY.hud.musicOnTouch : COPY.hud.musicOffTouch
    );
  }

  /**
   * Pushed when it changes rather than rebuilt every frame, because a Phaser Text
   * is a canvas render and a texture upload, and this one says the same thing for
   * twenty seconds at a time.
   */
  showIntake() {
    this.intakeLabel.setText(
      `${COPY.hud.wave} ${Math.min(this.waveIndex + 1, MOBILE_WAVES.length)}` +
        ` ${COPY.hud.waveOf} ${MOBILE_WAVES.length}`
    );
  }

  // -------------------------------------------------------------------- waves

  /**
   * The gap between intakes. Nothing happens in it yet.
   *
   * It is here before there is anything to put in it on purpose. The upgrade
   * cards are the whole of what a player of this design does, and a phase they
   * slot into is a smaller change than a phase and a modal arriving together.
   */
  beginPreparation(durationMs) {
    this.phase = 'preparing';

    this.prepTimer = this.time.delayedCall(durationMs, () => this.startWave());
  }

  /**
   * Opens the intake. Every arrival is scheduled up front, since a wave is a
   * fixed list and nothing during it changes what is coming. Same arrangement
   * as the board the other three modes play on.
   */
  startWave() {
    const wave = MOBILE_WAVES[this.waveIndex];

    this.phase = 'running';
    this.showIntake();
    this.waveStartedAt = this.time.now;
    this.healthAtWaveStart = this.health;

    setWaveNumber(this.waveNumber());
    trackWaveStarted({
      waveNumber: this.waveNumber(),
      // Tolerance is what lives are on this board. Currency was decided out of
      // this mode, so it reports null rather than a zero that would read as a
      // player who had spent everything they had.
      livesRemaining: this.health,
      currency: null
    });

    playSound('wave-open');
    this.spawnsRemaining = wave.groups.reduce(
      (total, group) => total + group.count,
      0
    );

    wave.groups.forEach((group) => this.scheduleGroup(group));
  }

  /**
   * One run of arrivals: the first after the group's delay, the rest on the
   * interval behind it.
   */
  scheduleGroup(group) {
    const opener = this.time.delayedCall(group.delayMs, () => {
      this.spawn(group.applicant);

      if (group.count === 1) {
        return;
      }

      this.waveTimers.push(
        this.time.addEvent({
          delay: group.intervalMs,
          repeat: group.count - 2,
          callback: () => this.spawn(group.applicant)
        })
      );
    });

    this.waveTimers.push(opener);
  }

  /**
   * The board is clear, or it is clear apart from the people who are owed a
   * second go.
   *
   * Returns are released before the wave is allowed to end, which is what makes
   * a Boomerang a Boomerang rather than a second entry in the wave list. The
   * check runs again next frame and finds them standing there.
   */
  checkWaveComplete() {
    if (
      this.phase !== 'running' ||
      this.spawnsRemaining > 0 ||
      this.applicants.length > 0
    ) {
      return;
    }

    if (this.pendingReturns.length > 0) {
      this.releaseReturns();

      return;
    }

    this.completeWave();
  }

  releaseReturns() {
    const returning = this.pendingReturns;

    this.pendingReturns = [];

    returning.forEach((typeKey) => this.spawn(typeKey, true));
  }

  completeWave() {
    this.clearWaveTimers();

    trackWaveCompleted({
      waveNumber: this.waveNumber(),
      durationMs: this.time.now - this.waveStartedAt,
      livesLost: this.healthAtWaveStart - this.health,
      // One tower, always, and the player never placed it. Reported rather than
      // left absent, because the property has an honest answer here.
      towersOnBoard: 1
    });

    playSound('wave-clear');

    this.waveIndex += 1;

    if (this.waveIndex >= MOBILE_WAVES.length) {
      this.end('held');

      return;
    }

    this.offerUpgrades();
  }

  // ----------------------------------------------------------------- upgrades

  /**
   * Two cards, drawn by the modal, chosen by the player.
   *
   * The board is paused under it rather than left running, so nothing arrives
   * while somebody is reading. That is the same arrangement PauseScene and
   * GameOverScene already use, and here it is also the reason a card can change
   * the tower's range without anything having to be recalculated mid flight.
   */
  offerUpgrades() {
    this.phase = 'choosing';

    const offer = this.drawCards();

    // Held so the one that was not taken can be reported with the one that was.
    this.offered = offer;

    this.scene.launch('MobileUpgradeScene', { offer });
    this.scene.pause();
  }

  /**
   * Two cards, drawn by weight and without replacement.
   *
   * Weighted because a flat draw let the shuffle decide the run: a measured
   * game was never offered the one card that answers the type nothing else on
   * the board can touch, and lost to thirteen of them walking in untouched. The
   * weights are in config/upgrades.js with the arithmetic.
   *
   * Spent cards come out of the pool first. Update the keyword list is `set`
   * rather than `add`, so a second one changes no number, and offering it again
   * would put a card that does nothing against a card that does. That is not a
   * choice, it is a wasted intake.
   */
  drawCards() {
    const pool = UPGRADES.filter(
      (card) => !(card.once && this.taken.includes(card.id))
    );

    const drawn = [];

    while (drawn.length < UPGRADES_OFFERED && drawn.length < pool.length) {
      const left = pool.filter((card) => !drawn.includes(card));
      const total = left.reduce((sum, card) => sum + card.weight, 0);

      let roll = Math.random() * total;

      // Walks the remaining cards taking each one's weight off the roll, so the
      // first to take it below zero is the one drawn. Every card has a chance
      // in proportion to its weight and none can be drawn twice.
      drawn.push(
        left.find((card) => {
          roll -= card.weight;

          return roll < 0;
        }) ?? left[left.length - 1]
      );
    }

    return drawn;
  }

  /**
   * Called back by the modal with the card that was taken. Resuming comes first,
   * because the preparation timer below runs on this scene's clock and a clock
   * that is still paused never fires it.
   */
  takeUpgrade(card) {
    // Both halves, because take rate is only meaningful against offer rate and
    // a card rarely taken may simply be rarely offered.
    trackUpgradeOffered({
      taken: card.id,
      refused: this.offered.find((other) => other.id !== card.id)?.id ?? null
    });

    this.scene.resume();
    this.applyUpgrade(card);
    this.beginPreparation(MOBILE_RUN.prepMs);
  }

  /**
   * What a card does. The cards are data and this is the one place that knows
   * what any of their stats mean, which is the seam that keeps config/upgrades.js
   * free of logic.
   *
   * Everything lands on `this.stats`, the run's own copy, rather than on the
   * config object it was cloned from. That is the whole point of the clone.
   */
  applyUpgrade(card) {
    this.taken.push(card.id);

    // Not a stat on the tower at all: the applicant's immunity names a tower
    // key, so beating it means being a different key. See config/mobile.js.
    if (card.stat === 'beatsImmunity') {
      this.tower.typeKey = MOBILE_TOWER_KEY_UPDATED;

      return;
    }

    // A fact about the run rather than about the tower, and the only card that
    // gives back something already spent.
    if (card.stat === 'tolerance') {
      this.maxHealth += card.add;
      this.health += card.add;

      return;
    }

    if (card.set !== undefined) {
      this.stats[card.stat] = card.set;
    } else {
      this.stats[card.stat] += card.add;
    }

    // Stacking Screen in parallel would otherwise reach a reload of nothing and
    // turn one tower into every tower.
    this.stats.fireIntervalMs = Math.max(
      this.stats.fireIntervalMs,
      MIN_FIRE_INTERVAL_MS
    );

    this.drawRange();
  }

  clearWaveTimers() {
    this.waveTimers.forEach((timer) => timer.remove());
    this.waveTimers = [];
  }

  // ----------------------------------------------------------------- arrivals

  /**
   * Somebody turns up on the ring and walks straight at the desk.
   *
   * The path is one segment, built the same way `GameScene.pathThrough` builds
   * every other path in the game, and handed to the applicant the game already
   * has. It ends at the edge of the desk rather than the middle of it, which is
   * where `hasArrived` puts the boundary, so there is one answer to where the
   * desk is rather than two that drift.
   */
  spawn(typeKey, returning = false) {
    if (this.over) {
      return;
    }

    const definition = APPLICANTS[typeKey];

    // A return is not part of the wave's count. It was counted the first time
    // it arrived, and counting it twice would leave the wave permanently one
    // arrival short of finishing.
    if (!returning) {
      this.spawnsRemaining -= 1;
    }

    const { x, y, heading } = spawnPoint(RADIAL_BOARD);
    const end = arrivalPoint(RADIAL_BOARD, x, y, heading);

    const path = new Phaser.Curves.Path(x, y);

    path.lineTo(end.x, end.y);

    const applicant = new Applicant(
      this,
      path,
      typeKey,
      definition,
      definition.sprite
    );

    applicant.hasReturned = returning;
    applicant.setDepth(5);
    applicant.walk((who) => this.arrive(who));

    this.applicants.push(applicant);
  }

  /**
   * A type that comes back owes the board one more appearance, whether it was
   * rejected or got in. Recorded the moment it leaves rather than at the end of
   * the wave, so there is nothing to go looking for later.
   */
  noteReturn(applicant) {
    if (applicant.definition.returns && !applicant.hasReturned) {
      this.pendingReturns.push(applicant.typeKey);
    }
  }

  /**
   * Somebody got in. The tower takes it rather than a life counter, because in
   * this design the tower is the thing the player is defending and the thing
   * they are shown.
   */
  arrive(applicant) {
    this.noteReturn(applicant);
    this.drop(applicant);
    applicant.destroy();

    trackApplicantLeaked(applicant.typeKey);

    this.arrived += 1;
    this.health = Math.max(0, this.health - MOBILE_RUN.arrivalCost);

    // The one moment on this board with no other signal. A rejection has a
    // tracer and a body fading out; somebody getting in has nothing but a bar
    // moving, and the bar is the thing you are least likely to be looking at.
    playSound('leak');
    shake(this, MOBILE_LEAK_SHAKE.durationMs, MOBILE_LEAK_SHAKE.intensity);

    if (this.health === 0) {
      this.end('filled');
    }
  }

  // -------------------------------------------------------------------- firing

  fire(time) {
    const target = this.tower.update(time, this.applicants);

    if (!target) {
      return;
    }

    this.recordShot(target, time);

    const damage = this.tower.rollDamage();
    const { splashRadius } = this.stats;

    // Snapshotted before anybody is hit, because resolving a hit can take the
    // person hit off this list and iterating it while it shrinks would skip
    // whoever moved up into the gap.
    const bystanders =
      splashRadius > 0
        ? this.applicants.filter(
            (who) =>
              who !== target &&
              Phaser.Math.Distance.Between(who.x, who.y, target.x, target.y) <=
                splashRadius
          )
        : [];

    this.hit(target, damage);
    bystanders.forEach((who) => this.hit(who, damage));
  }

  /**
   * One applicant taking one lot of damage. Splash is the same damage rather
   * than a fraction of it, which is what makes Convene a panel the answer to a
   * tower being monopolised: the thing it cannot kill is still soaking every
   * shot, but the shots now land on everybody stood behind it as well.
   */
  hit(applicant, damage) {
    if (!applicant.active) {
      return;
    }

    if (applicant.takeDamage(damage)) {
      this.reject(applicant);
    }
  }

  /**
   * A rejection. `Applicant.reject` fades it out and destroys itself when the
   * fade finishes, so nothing here waits for it. It comes off the list straight
   * away so the tower stops aiming at somebody already on the way out.
   */
  reject(applicant) {
    this.noteReturn(applicant);
    this.drop(applicant);
    applicant.reject();

    playSound('reject');

    this.rejected += 1;
  }

  drop(applicant) {
    const index = this.applicants.indexOf(applicant);

    if (index !== -1) {
      this.applicants.splice(index, 1);
    }
  }

  /**
   * The run is finished, one way or the other. `outcome` is 'filled' when the
   * tower ran out and 'held' when every intake was screened.
   *
   * Everybody still walking is left where they are. There is no game over screen
   * yet and inventing one here would be the wrong step doing two jobs.
   */
  end(outcome) {
    // Guarded, because the run ending does not stop anybody who is already
    // walking. Their tweens finish, they arrive, and each one would otherwise
    // call this again, re-clearing timers and overwriting the outcome that has
    // already been decided.
    if (this.over) {
      return;
    }

    this.over = true;
    this.outcome = outcome;
    this.phase = 'over';

    this.prepTimer?.remove();
    this.clearWaveTimers();

    stopMusic();

    trackGameOver({ finalWave: this.waveIndex, score: this.score() });

    if (outcome === 'filled') {
      this.tower.base.setAlpha(0.3);
    }

    // Paused rather than left running, so the board freezes on the moment it
    // ended instead of carrying on behind the summary. It also stops the
    // stragglers the guard above exists to absorb.
    this.scene.launch('MobileGameOverScene', {
      outcome,
      intake: this.waveIndex,
      intakeCount: MOBILE_WAVES.length,
      rejected: this.rejected,
      score: this.score()
    });

    this.scene.pause();
  }

  /**
   * A run as one number. Three terms, the same three `GAME.scoring` uses, with
   * this board's own weights in config/mobile.js and the reasoning beside them.
   *
   * `waveIndex` is the count of intakes cleared rather than the one being
   * played, which it already is: completeWave increments it before deciding
   * whether that was the last, so a run that ends part way through the eighth is
   * holding seven.
   */
  /** Which intake is being played, one based, for anything that counts them. */
  waveNumber() {
    return Math.min(this.waveIndex + 1, MOBILE_WAVES.length);
  }

  score() {
    const { perWaveCleared, perRejection, perLifeRemaining } = MOBILE_SCORING;

    return (
      this.waveIndex * perWaveCleared +
      this.rejected * perRejection +
      this.health * perLifeRemaining
    );
  }

  // ------------------------------------------------------------------ drawing

  recordShot(target, time) {
    this.shots.push({
      x: target.x,
      y: target.y,
      until: time + this.tower.definition.tracerDurationMs
    });
  }

  drawTracers(time) {
    this.tracers.clear();

    // Walked backwards so an expired tracer can be spliced out without the loop
    // skipping the one after it, and so nothing allocates a filtered copy of
    // the array every frame.
    for (let index = this.shots.length - 1; index >= 0; index -= 1) {
      const shot = this.shots[index];

      if (time >= shot.until) {
        this.shots.splice(index, 1);

        continue;
      }

      this.tracers.lineStyle(2, this.tower.definition.tracerColour, 0.8);
      this.tracers.lineBetween(this.tower.x, this.tower.y, shot.x, shot.y);
    }
  }

  /**
   * A bar over anybody who has been hurt and is still walking.
   *
   * Only over the hurt, which is the rule the desktop board already uses and is
   * what stops this being hundreds of flickering slivers. A Graduate dies in two
   * hits and barely shows one. A Career Changer shows one for four seconds, which
   * is the point: that applicant absorbs the entire output of the tower on its
   * way in, and without a bar that is indistinguishable from the tower doing
   * nothing at all. The most important dynamic on this board was invisible.
   *
   * It is state rather than movement, so it says what it says under a reduced
   * motion preference without any special case. That is the argument for doing
   * this instead of floating damage numbers rather than as well as them.
   *
   * One Graphics object rebuilt per frame rather than a bar object per applicant,
   * which is the pattern the desktop uses and the part of that renderer the audit
   * rated as scaling best.
   */
  drawHealthBars() {
    this.healthBars.clear();

    this.applicants.forEach((applicant) => {
      if (!applicant.active || applicant.health >= applicant.maxHealth) {
        return;
      }

      // Sized against the screen rather than against the sprite. A bar
      // proportional to a radius of eleven is two pixels on a phone once the
      // 720 wide board is scaled down, which is a bar nobody can read and
      // therefore not a bar at all.
      const width = Math.max(applicant.definition.radius * 2.6, 26);
      const left = applicant.x - width / 2;
      const top = applicant.y - applicant.definition.radius - 12;
      const fraction = applicant.health / applicant.maxHealth;

      this.healthBars.fillStyle(0x14161a, 0.85);
      this.healthBars.fillRect(left - 1, top - 1, width + 2, HEALTH_BAR_HEIGHT + 2);
      this.healthBars.fillStyle(applicant.definition.colour, 1);
      this.healthBars.fillRect(left, top, width * fraction, HEALTH_BAR_HEIGHT);
    });
  }

  /** Redrawn rather than drawn once, since a card can widen it mid run. */
  drawRange() {
    const { centre } = RADIAL_BOARD;

    this.range.clear();
    this.range.lineStyle(1, this.stats.tracerColour, 0.18);
    this.range.strokeCircle(centre.x, centre.y, this.stats.range);

    if (this.stats.splashRadius > 0) {
      this.range.lineStyle(1, this.stats.tracerColour, 0.1);
      this.range.strokeCircle(centre.x, centre.y, this.stats.splashRadius);
    }
  }

  /** The one bar the design asks for, under the thing it belongs to. */
  drawBar() {
    const width = 120;
    const height = 8;
    const left = this.tower.x - width / 2;
    const top = this.tower.y + 40;

    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.5);
    this.bar.fillRect(left, top, width, height);
    const fraction = this.health / this.maxHealth;

    this.bar.fillStyle(fraction > 0.3 ? 0x6ad98f : 0xd96a6a);
    this.bar.fillRect(left, top, width * fraction, height);
  }

}

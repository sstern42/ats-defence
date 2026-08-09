import Phaser from 'phaser';

import { COPY } from '../../content/copy.js';
import { APPLICANTS } from '../../config/applicants.js';
import {
  MOBILE_BURST,
  MOBILE_RUN,
  MOBILE_SUPERWEAPON,
  MOBILE_TOWER,
  MOBILE_TOWER_KEY,
  MOBILE_LEAK_SHAKE,
  MOBILE_SCORING,
  MOBILE_TOWER_KEY_UPDATED,
  MOBILE_TRACER,
  MOBILE_TRAP,
  MOBILE_TRAP_KEY
} from '../../config/mobile.js';
import { introKeyFor } from '../../config/intros.js';
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
  trackTowerPlaced,
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
import { FEEL, fadeOut, landing, nudge, shake } from '../../services/feel.js';
import Applicant from '../../entities/Applicant.js';
import Tower from '../../entities/Tower.js';
import Trap from '../../entities/Trap.js';

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
 * What this is not: floating damage numbers. They were the third item on the
 * design's HUD and they are not being built. The reason is at buildHud below.
 */

/** Tall enough to survive the board being scaled down onto a phone screen. */
const HEALTH_BAR_HEIGHT = 7;

const FONT = 'system-ui, sans-serif';

/**
 * The card a new type is introduced on.
 *
 * It sits under the intake counter, in the one band of this board that is
 * guaranteed to be empty. Everybody spawns on a ring 320 from the middle and
 * walks inwards, so nothing is ever drawn above y 320 and a card finishing well
 * short of that cannot be stood behind. The desktop card has to be placed
 * against the highest leg of the path for the same reason and gets no such
 * guarantee.
 *
 * Larger than the desktop's in every direction, because the board it is drawn
 * on is 720 wide and shown on something held at arm's length. The proportions
 * are the desktop's: art on the left at the height of the card, name and trait
 * to the right of it.
 */
const CARD_WIDTH = 620;
const CARD_HEIGHT = 148;
const CARD_TOP = 122;
const CARD_PADDING = 14;
const CARD_ART_SIZE = 120;
const CARD_RADIUS = 14;
const CARD_FILL = 0x1a1f26;
const CARD_EDGE = 0x39566b;

/** How long the card is up for, and how long it takes to go. */
const CARD_HOLD_MS = 2600;
const CARD_FADE_MS = 240;

/**
 * The bulk reject button, in the band between the spawn ring and the switches.
 *
 * Everybody arrives on a ring 320 from the middle, so nothing is ever drawn
 * below y 960, and the two switches sit at the very bottom. What is between them
 * is the only part of this board that is guaranteed empty and reachable by a
 * thumb, which is the whole of why the one control this mode has goes here.
 */
const BULK_Y = 1056;
const BULK_WIDTH = 380;
const BULK_HEIGHT = 84;
const BULK_NOTE_Y = 1120;
const BULK_RADIUS = 14;
const BULK_FILL = 0x2b3b47;
const BULK_FILL_SPENT = 0x1e2229;
const BULK_EDGE = 0x5f8ba6;
const BULK_EDGE_SPENT = 0x2f363f;

/**
 * The pad's line, under the button's. It is the only thing on this board that
 * explains where a tap goes, and it is permanent for the reason the bulk
 * reject's note is: a control nothing explains is a control nobody uses, and
 * this one asks the player to touch a part of the screen that has never done
 * anything before.
 */
const TRAP_NOTE_Y = 1160;

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

    // Where the shots landed, once there is a panel to land them on. Kept apart
    // from the shots because it outlives them: a circle takes longer to read
    // than a line does. See MOBILE_BURST.
    this.bursts = [];

    // Per run rather than per session, so a restart introduces everybody again.
    this.seenTypes = new Set();
    this.introCard = null;
    this.introTimer = null;

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

    // The run's allowance of bulk rejects, and when the next one may be sent.
    // Nothing gives a charge back, which is what makes spending one a decision
    // rather than a rhythm.
    this.charges = MOBILE_SUPERWEAPON.charges;
    this.bulkUsed = 0;
    this.nextBulkAt = 0;

    // The pad on the floor, when another may be laid, and when this one goes
    // unanswered. All three are cleared and re-cleared per intake by openTrap.
    this.trap = null;
    this.nextTrapAt = 0;
    this.trapStaleAt = 0;

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

    // How many screenings a shot is drawn as, which is one until Screen in
    // parallel says otherwise. It is a drawing number rather than a stat, so it
    // sits beside them rather than on them: nothing reads it except drawTracers,
    // and a tower definition carrying a field only the renderer wants would be
    // the first thing to go looking for in a balance pass and the last thing to
    // find anything in. The reasoning for the card needing this at all is in
    // config/mobile.js at MOBILE_TRACER.
    this.screenings = 1;

    // How many times the bar has been raised, which is what a shot's width and
    // colour are drawn from. Another drawing number for the same reason, and
    // the reasoning for the card needing one is at MOBILE_TRACER too: damage is
    // the other card whose effect the board never showed, and the worse of the
    // two, because a shorter reload can at least be counted.
    this.raises = 0;

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
      this.checkTrap(time);
      this.checkWaveComplete();
    }

    this.drawTracers(time);
    this.drawHealthBars();
    this.drawBar();
    this.watchBulkReject();
    this.watchTrapNote();
    this.showRating();
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
   * damage numbers, and nothing else. Two of the three are here, and the third
   * is not coming.
   *
   * **Floating damage numbers are decided against rather than deferred.** The
   * question was whether they are information or decoration, and it has an
   * answer either way.
   *
   * If they are decoration, they are decoration that costs a per applicant text
   * object on the board with the highest entity count in the game, and a reduced
   * motion preference would drop them outright with nothing lost, which is the
   * definition of something not worth building.
   *
   * If they are information, they are information carried by an animation, which
   * is the one thing this project says nothing may be. A number that has faded
   * out cannot be read twice, it appears where the applicant was rather than
   * where the eye is, and hundreds of them at once is the least legible way to
   * say anything on a phone.
   *
   * What was actually wanted was a way to tell a working card from a card doing
   * nothing, and drawHealthBars is that: it is state rather than movement, so it
   * survives a reduced motion preference without a special case, and it makes
   * the Career Changer soaking the entire output of the turret visible, which is
   * the most important dynamic on this board and was previously indistinguishable
   * from the tower being idle. The argument is written out in full down there.
   *
   * The diagnostic readout this replaces is gone. It was debug output, it ran off
   * the right edge once a few cards were listed, and it showed through the game
   * over veil.
   *
   * Drawn on this scene rather than on a UIScene of its own. The desktop splits
   * them because its HUD is a six button palette with state to keep in step; this
   * is two lines of text that are told what to say when their number moves.
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

    this.buildRating();

    this.showIntake();
    this.buildBulkReject();
    this.buildTrapNote();
    this.buildSwitches();
  }

  /**
   * The rating as it stands, which is the score the run would submit if it ended
   * on this frame.
   *
   * The real number rather than a version that only goes up. Two of its three
   * terms are things earned and the third is the tolerance left, so an applicant
   * getting in takes some off, and that is the point: the readout that quietly
   * kept climbing while the vacancy was being filled would be telling a player
   * the opposite of what the board is. It also has to be the number the summary
   * and the leaderboard will say, and a banked-only version would part company
   * with both the moment anybody got in.
   *
   * Beside the intake counter rather than under it. The band from y 122 is where
   * a type gets introduced on a card, and the band under the ring is where
   * somebody can spawn, so the counter's own line is the only piece of this
   * board that is reliably free. Quieter than the counter it sits next to, since
   * which intake this is decides what the player is watching for and this does
   * not decide anything at all.
   */
  buildRating() {
    this.ratingLabel = this.add
      .text(RADIAL_BOARD.board.width - 30, 78, '', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#6f7d8c'
      })
      .setOrigin(1, 0.5)
      .setDepth(100);

    this.ratingShown = null;
    this.showRating();
  }

  /**
   * Redraws the rating when, and only when, it has moved.
   *
   * Polled from `update` rather than pushed from the four places that change it,
   * on the same grounds `watchBulkReject` is: two of them are a rejection and an
   * arrival, which are the busiest moments on this board, and a scene emitting
   * events to itself to keep a Text in step is more machinery than a comparison.
   * The guard is the whole of why it is cheap, since re-rendering a Text every
   * frame to say what it already said is the expensive way round.
   */
  showRating() {
    const rating = this.score();

    if (rating === this.ratingShown) {
      return;
    }

    this.ratingShown = rating;
    this.ratingLabel.setText(`${COPY.hud.rating} ${rating}`);
  }

  /**
   * The one control this board has during an intake, and the sentence in
   * `CLAUDE.md` about this mode taking no input that had to be overturned to put
   * it here. The reasoning, and the one part of that sentence that did not move,
   * are in config/mobile.js at MOBILE_SUPERWEAPON.
   *
   * A drawn panel with the text over it rather than a padded Text like the two
   * switches, because a switch is a thing you find once a run and this is a
   * thing you look for while a wave is coming in. The tap target is the whole
   * panel rather than the glyphs, which is what the Zone below is for.
   *
   * The note underneath is permanent rather than shown once. Nothing else on
   * this board explains a control, there being no other control, and a player
   * arrives here having been told what six applicant types do and nothing at all
   * about the only button on the screen.
   */
  buildBulkReject() {
    const { width } = RADIAL_BOARD.board;

    // The button is drawn by a Graphics and pressed through a Zone, which is
    // two objects for one control and is the cheaper of the two ways round.
    // Phaser's Rectangle has no corner radius, and every other panel on this
    // board is rounded, so a square one reads as something unfinished.
    this.bulkShape = this.add.graphics().setDepth(100);

    this.bulkPanel = this.add
      .zone(width / 2, BULK_Y, BULK_WIDTH, BULK_HEIGHT)
      .setInteractive({ useHandCursor: true });

    this.bulkLabel = this.add
      .text(width / 2, BULK_Y, '', {
        fontFamily: FONT,
        fontSize: '32px',
        color: '#e6ebf0'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(101);

    this.add
      .text(width / 2, BULK_NOTE_Y, COPY.hud.bulkRejectNote, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#6f7d8c'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100);

    this.bulkPanel.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      nudge(this.bulkLabel, 0, FEEL.pressDrop);
      this.bulkReject();
    });

    this.refreshBulkReject();
  }

  /**
   * What the button says and whether it looks pressable.
   *
   * State rather than movement, which is the rule this board is drawn by: the
   * count is a number a player can read at any moment rather than something that
   * happened while they were looking elsewhere, and it survives a reduced motion
   * preference without a special case.
   *
   * Note that it greys while the board is between intakes as well as when the
   * charges are gone. There is nobody on the board then, so a charge spent in
   * the gap would buy nothing at all, and a control that can be wasted on
   * nothing is worse than one that is briefly unavailable.
   */
  refreshBulkReject() {
    const spent = this.charges === 0;
    const usable = this.bulkAvailable();
    const left = BULK_WIDTH / -2;

    // Kept in step here rather than only in the watcher, so a push and a poll
    // cannot disagree about what is currently drawn.
    this.bulkWasUsable = usable;

    this.bulkShape.clear();
    this.bulkShape.fillStyle(spent ? BULK_FILL_SPENT : BULK_FILL, 1);
    this.bulkShape.fillRoundedRect(
      this.bulkPanel.x + left,
      BULK_Y - BULK_HEIGHT / 2,
      BULK_WIDTH,
      BULK_HEIGHT,
      BULK_RADIUS
    );
    this.bulkShape.lineStyle(2, spent ? BULK_EDGE_SPENT : BULK_EDGE, 1);
    this.bulkShape.strokeRoundedRect(
      this.bulkPanel.x + left,
      BULK_Y - BULK_HEIGHT / 2,
      BULK_WIDTH,
      BULK_HEIGHT,
      BULK_RADIUS
    );

    this.bulkLabel.setText(
      spent
        ? COPY.hud.bulkRejectSpent
        : `${COPY.hud.bulkReject} ${this.charges}`
    );
    this.bulkLabel.setColor(usable ? '#e6ebf0' : '#6f7d8c');
  }

  /**
   * Redraws the button when, and only when, whether it can be pressed has
   * changed.
   *
   * Two of the three things `bulkAvailable` reads change on an event and could
   * be pushed. The third is the cooldown running out, which happens because time
   * passed and nothing calls anything when time passes, so it is watched here
   * instead of being given a timer of its own. Guarded on the state actually
   * changing, because the alternative is rebuilding a Graphics and re-rendering
   * a Text every frame to say what they already said.
   */
  watchBulkReject() {
    const usable = this.bulkAvailable();

    if (usable !== this.bulkWasUsable) {
      this.bulkWasUsable = usable;
      this.refreshBulkReject();
    }
  }

  /** Whether pressing it now would do anything. */
  bulkAvailable() {
    return (
      !this.over &&
      this.phase === 'running' &&
      this.charges > 0 &&
      this.time.now >= this.nextBulkAt
    );
  }

  /**
   * Everybody currently applying gets the same email.
   *
   * It is damage rather than a clearance, and it goes through `hit` rather than
   * round it, which is what makes one code path serve a Graduate and a 2,600
   * health arrival. The boss survives a charge and is worn down by three, and
   * nothing here knows which of those it is looking at.
   *
   * It also ignores who is immune to what, deliberately and by having nothing to
   * do with `Tower.canTarget`. Immunity is a property of an applicant against a
   * named tower type, The Keyword Stuffer's names the Keyword Filter, and a mail
   * merge is not the Keyword Filter. That is the one thing on this board it
   * cannot walk through.
   *
   * The list is copied before anybody is hit, for the same reason splash copies
   * it: resolving a hit takes the person hit off `this.applicants`, and walking
   * a list while it shrinks skips whoever moved up into the gap.
   */
  bulkReject() {
    if (!this.bulkAvailable()) {
      playSound('denied');

      return;
    }

    this.charges -= 1;
    this.bulkUsed += 1;
    this.nextBulkAt = this.time.now + MOBILE_SUPERWEAPON.cooldownMs;

    [...this.applicants].forEach((who) =>
      this.hit(who, MOBILE_SUPERWEAPON.damage)
    );

    playSound('bulk-reject');
    shake(
      this,
      MOBILE_LEAK_SHAKE.durationMs,
      MOBILE_LEAK_SHAKE.intensity * 1.4
    );

    this.refreshBulkReject();
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
    this.openTrap();
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

    // Screen in parallel is the one card whose effect the board does not show,
    // so a shot is drawn as one line per screening running at once. Keyed on the
    // stat rather than the id, on the same terms the two branches above are: this
    // method is the one place that knows what a stat means, and a card added
    // later that buys the same reload is the same card as far as a shot looks.
    if (card.stat === 'fireIntervalMs') {
      this.screenings = Math.min(this.screenings + 1, MOBILE_TRACER.maxLines);
    }

    // Raise the bar is the other one the board did not show, and it is keyed on
    // the stat for the same reason: a card added later that buys the same
    // damage is the same card as far as a shot looks.
    if (card.stat === 'damage') {
      this.raises += 1;
    }

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

    this.introduceType(typeKey);
  }

  /**
   * The first time a type turns up, it is named, its one awkward habit is said
   * out loud, and it gets a moment to itself on a card. After that the player is
   * on their own.
   *
   * Held per run rather than per session, which is the desktop's arrangement and
   * matters more here: the board is restarted from the game over screen far more
   * often than the desktop's is, and a player who has just watched the Keyword
   * Stuffer walk through their filter untouched is the player most likely to
   * want telling why.
   */
  introduceType(typeKey) {
    if (this.seenTypes.has(typeKey)) {
      return;
    }

    this.seenTypes.add(typeKey);

    const applicant = COPY.applicants[typeKey];

    if (applicant) {
      // The trait written for this board where there is one, and the shared one
      // otherwise. Two of the six name something that is not here: a path, and a
      // Knockout Question. The reasoning is in copy.js beside the lines.
      this.showIntroCard(
        typeKey,
        applicant.name,
        applicant.traitRadial ?? applicant.trait
      );
    }
  }

  /**
   * The card itself, tinted with the applicant's own colour so the animation and
   * the thing now walking towards the tower are recognisably the same person.
   *
   * It does not hold the board. A type turns up in the middle of an intake and
   * stopping everything to introduce it would be worse than not introducing it,
   * which is the desktop's reasoning and applies here twice over: this board
   * takes no input, so a pause would be a pause in a thing the player is only
   * watching.
   *
   * A type with nothing drawn for it still gets a card, with the text across the
   * whole of it. `introKeyFor` returning null is a real answer rather than a
   * fault, and it is what the board did before any of these existed.
   */
  showIntroCard(typeKey, name, trait) {
    const { width } = RADIAL_BOARD.board;
    const artKey = introKeyFor(typeKey);
    const left = -CARD_WIDTH / 2;
    const textLeft = artKey
      ? CARD_PADDING * 2 + CARD_ART_SIZE
      : CARD_PADDING * 2;

    // Two types can arrive together in a later intake, and two cards in the
    // same place is one card nobody can read.
    this.clearIntroCard();

    const card = this.add.container(width / 2, CARD_TOP);
    const panel = this.add.graphics();

    panel.fillStyle(CARD_FILL, 0.94);
    panel.fillRoundedRect(left, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
    panel.lineStyle(2, CARD_EDGE, 0.8);
    panel.strokeRoundedRect(left, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);

    card.add(panel);

    if (artKey) {
      const art = this.add
        .sprite(left + CARD_PADDING + CARD_ART_SIZE / 2, CARD_HEIGHT / 2, artKey)
        .setDisplaySize(CARD_ART_SIZE, CARD_ART_SIZE)
        .setTint(APPLICANTS[typeKey].colour);

      art.play(artKey);
      card.add(art);
    }

    card.add(
      this.add
        .text(left + textLeft, 46, name, {
          fontFamily: FONT,
          fontSize: '30px',
          color: '#e6ebf0'
        })
        .setOrigin(0, 0.5)
    );

    card.add(
      this.add.text(left + textLeft, 66, trait, {
        fontFamily: FONT,
        fontSize: '21px',
        color: '#8b98a6',
        lineSpacing: 5,
        wordWrap: { width: CARD_WIDTH - textLeft - CARD_PADDING * 2 }
      })
    );

    card.setDepth(100);

    this.introCard = card;

    // Drawn where it belongs and at full alpha rather than faded up, so it is
    // legible the instant it exists and every bit of movement is decoration on
    // top of that. `landing` and `fadeOut` are what decide whether there is any,
    // which is why neither the arrival nor the departure is a tween written out
    // here: a player who has asked for less motion gets the card, gets the same
    // time to read it, and gets it taken away again without any of it moving.
    landing(card);

    this.introTimer = this.time.delayedCall(CARD_HOLD_MS, () =>
      fadeOut(card, CARD_FADE_MS, () => this.clearIntroCard())
    );
  }

  clearIntroCard() {
    this.introTimer?.remove();
    this.introTimer = null;

    this.introCard?.destroy();
    this.introCard = null;
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

    // What this one costs, where the type says, and the flat rate otherwise.
    // Only the boss carries its own, and it carries one because an arrival that
    // took a whole intake to walk in cannot cost the same as a Graduate.
    this.health = Math.max(
      0,
      this.health -
        (applicant.definition.arrivalCost ?? MOBILE_RUN.arrivalCost)
    );

    // The one moment on this board with no other signal. A rejection has a
    // tracer and a body fading out; somebody getting in has nothing but a bar
    // moving, and the bar is the thing you are least likely to be looking at.
    playSound('leak');
    shake(this, MOBILE_LEAK_SHAKE.durationMs, MOBILE_LEAK_SHAKE.intensity);

    if (this.health === 0) {
      this.end('filled');
    }
  }

  /**
   * The pad's line, and the tap that lays one.
   *
   * The tap is taken on the scene rather than on a zone, because the target is
   * most of the board and a zone that size would sit over the switches and the
   * button. `trapSpot` is what decides whether a tap meant anything, and it does
   * it by asking where on the floor the tap was rather than what it was over,
   * which is the cheaper of the two ways round and cannot fall out of step with
   * a control being moved.
   *
   * On pointer up rather than down, which is the rule the desktop board settled
   * on for a finger: a preview follows the drag and the thing lands where the
   * finger comes off. There is no preview here, since a pad is a single tap on a
   * board with nothing to line it up against, and lifting is still where a tap
   * is committed on a touchscreen.
   */
  buildTrapNote() {
    const { width } = RADIAL_BOARD.board;

    this.trapNote = this.add
      .text(width / 2, TRAP_NOTE_Y, '', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#6f7d8c'
      })
      .setOrigin(0.5, 0.5)
      .setDepth(100);

    this.trapNoteShown = null;
    this.refreshTrapNote();

    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer) => {
      this.layTrap(pointer.worldX, pointer.worldY);
    });
  }

  /**
   * What the line says: how to lay one, or how long until there is one to lay.
   *
   * Three states rather than two, because "there is a pad on the floor" and
   * "there is no pad and none coming yet" are the same silence to a player and
   * are opposite instructions. State rather than movement, as everything else on
   * this board is.
   */
  refreshTrapNote() {
    const waiting = Math.max(0, this.nextTrapAt - this.time.now);

    let line = COPY.hud.trapReady;

    if (this.trap !== null) {
      line = COPY.hud.trapLaid;
    } else if (waiting > 0) {
      line = `${COPY.hud.trapAsking} ${Math.ceil(waiting / 1000)}s`;
    }

    if (line === this.trapNoteShown) {
      return;
    }

    this.trapNoteShown = line;
    this.trapNote.setText(line);
    this.trapNote.setColor(this.trapReady() ? '#8b98a6' : '#6f7d8c');
  }

  /**
   * Polled, because the only thing that changes most of the time is the number
   * of seconds left, and nothing happens when a second passes. The comparison in
   * `refreshTrapNote` is what keeps this from re-rendering a Text every frame,
   * which is the same arrangement the bulk reject and the rating use.
   */
  watchTrapNote() {
    this.refreshTrapNote();
  }

  // ---------------------------------------------------------------------- pad

  /**
   * Salary expectations: the second thing a player of this board does during an
   * intake, and the first that is a question of where rather than of when.
   *
   * The numbers, and the measurement they came out of, are in config/mobile.js
   * at MOBILE_TRAP. What is here is only the three things a scene has to own:
   * where a tap is allowed to land, when the pad goes off, and when it goes
   * stale.
   *
   * `entities/Trap.js` is used exactly as the other three boards use it. It
   * knows how big it is, when it has been trodden on and how to take itself off
   * the board, and what that costs an applicant is the scene's business, which
   * is the same seam a tower is resolved through.
   */
  layTrap(x, y) {
    const spot = this.trapSpot(x, y);

    // A tap on the HUD, on the desk or out on the floor nobody crosses. Silent
    // rather than refused out loud, since most taps that land here are a thumb
    // resting on the screen rather than somebody asking for a pad.
    if (!spot) {
      return;
    }

    if (!this.trapReady()) {
      playSound('denied');

      return;
    }

    this.trap = new Trap(
      this,
      spot.x,
      spot.y,
      MOBILE_TRAP_KEY,
      MOBILE_TRAP,
      MOBILE_TRAP.sprite.base
    );

    // Painted on the carpet rather than stood on it, so anybody walking over one
    // walks over it rather than behind it. Under the applicants at depth 5 and
    // over the floor.
    this.trap.setDepth(2);

    this.nextTrapAt = this.time.now + MOBILE_TRAP.rearmDelayMs;
    this.trapStaleAt = this.time.now + MOBILE_TRAP.staleMs;

    playSound('place');

    // The event the desktop already sends for a trap, with the same type on it,
    // so this board's pads land in the same row of the same query rather than
    // in a fourth one nothing is looking at. There is no grid here and no
    // budget: the position is the board pixel it went down on, rounded, and the
    // currency is null rather than a nought that would read as a player who had
    // spent everything.
    trackTowerPlaced({
      towerType: MOBILE_TRAP_KEY,
      currencyBefore: null,
      gridX: Math.round(spot.x),
      gridY: Math.round(spot.y)
    });

    this.refreshTrapNote();
  }

  /**
   * Where a tap is allowed to put a pad, or null for nowhere.
   *
   * The rule is one ring test and it does the work of three. Everybody arrives
   * on the spawn ring and walks straight in to the desk, so ground outside that
   * ring is ground nobody crosses and ground inside the desk is under the tower.
   * The band between them is exactly the part of the board a pad can do anything
   * on, and it also happens to exclude every piece of HUD on this screen: the
   * intake counter, the rating, the bulk reject and both switches all sit
   * further from the middle than the ring is, so nothing needs to know about
   * them by name.
   */
  trapSpot(x, y) {
    const { centre, spawnRadius, arrivalRadius } = RADIAL_BOARD;
    const out = Phaser.Math.Distance.Between(centre.x, centre.y, x, y);

    if (out > spawnRadius || out < arrivalRadius + MOBILE_TRAP.triggerRadius) {
      return null;
    }

    return { x, y };
  }

  /** Whether a tap right now would put a pad down. */
  trapReady() {
    return (
      !this.over &&
      this.phase === 'running' &&
      this.trap === null &&
      this.time.now >= this.nextTrapAt
    );
  }

  /**
   * The pad, once a tick: sprung by whoever has walked onto it, or gone if
   * nobody has.
   *
   * Springing hits everybody inside the radius rather than only whoever set it
   * off, which is what makes where it went down worth thinking about, and it
   * goes through `hit` rather than round it so a Keyword Stuffer is caught by it
   * like anybody else. Immunity is a property of an applicant against a named
   * tower type and a question about money is not the keyword filter, which is
   * the same reasoning the bulk reject is built on.
   */
  checkTrap(time) {
    if (this.trap === null) {
      return;
    }

    if (time >= this.trapStaleAt) {
      this.clearTrap();

      return;
    }

    if (!this.applicants.some((who) => who.active && this.trap.catches(who))) {
      return;
    }

    // Copied before anybody is hit, for the reason splash copies it: resolving a
    // hit takes the person hit off `this.applicants`, and walking a list while
    // it shrinks skips whoever moved up into the gap.
    const caught = this.applicants.filter(
      (who) => who.active && this.trap.catches(who)
    );

    const pad = this.trap;

    this.trap = null;

    caught.forEach((who) => this.hit(who, pad.rollDamage()));

    pad.spring();
    playSound('reject');
    this.refreshTrapNote();
  }

  /**
   * A pad nobody answered. It fades rather than bursting, because bursting is
   * what going off looks like and these two must not read the same: one of them
   * cost somebody a walk and the other cost the player a placement.
   */
  clearTrap() {
    const pad = this.trap;

    this.trap = null;

    fadeOut(pad, 260, () => pad.destroy());
    this.refreshTrapNote();
  }

  /**
   * The clock and the pad, at the start of every intake.
   *
   * The rearm starts again as each intake opens, so the first pad of each is
   * always there to be laid rather than owed to the one before. Anything still
   * on the floor goes with it, since the board it was laid to catch has gone
   * home.
   */
  openTrap() {
    if (this.trap) {
      this.clearTrap();
    }

    this.nextTrapAt = 0;
    this.trapStaleAt = 0;
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

    // Drawn whether or not it catches anybody, which is the point of it. See
    // MOBILE_BURST: an area that only appears when it works cannot be aimed.
    if (splashRadius > 0) {
      this.recordBurst(target, splashRadius, time);
    }

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
    this.clearIntroCard();

    if (this.trap) {
      this.clearTrap();
    }

    stopMusic();

    // The charges are reported here rather than on a sixteenth event, and the
    // argument is the one the analytics spec makes for `mode` being a property:
    // this is a fact about the run every other event is already reporting rather
    // than a thing that happens. Question 4 asks which things are dead weight,
    // and a run that ended with three unspent charges is the only way to find
    // out whether anybody presses the only button on the board.
    trackGameOver({
      finalWave: this.waveNumber(),
      score: this.score(),
      bulkRejectsUsed: this.bulkUsed
    });

    if (outcome === 'filled') {
      this.tower.base.setAlpha(0.3);
    }

    // The last arrival moved the rating and the board is about to stop being
    // updated, so it is refreshed here rather than left a frame behind. The
    // summary over the top says the same number, and the board underneath it
    // disagreeing by the cost of the applicant who ended the run is the sort of
    // thing somebody notices and nobody can explain.
    this.showRating();

    // Paused rather than left running, so the board freezes on the moment it
    // ended instead of carrying on behind the summary. It also stops the
    // stragglers the guard above exists to absorb.
    //
    // `intake` is the intake reached rather than the count cleared, which is
    // what the other three boards have always sent and what the label on the
    // summary already claims to be showing. It used to be `waveIndex`, and that
    // was wrong in three places at once: the screen said "Intake reached: 4 / 8"
    // to somebody who died in the fifth, every event carrying `final_wave` read
    // one lower here than on any other board, and a run lost in the first
    // intake would have submitted a nought that the plausibility check refuses
    // outright. The last of those was unreachable, since 240 of tolerance at
    // four a head cannot be spent on six arrivals, but it is the same mistake
    // with the numbers hiding it.
    this.scene.launch('MobileGameOverScene', {
      outcome,
      intake: this.waveNumber(),
      intakeCount: MOBILE_WAVES.length,
      rejected: this.rejected,
      score: this.score()
    });

    this.scene.pause();
  }

  /** Which intake is being played, one based, for anything that counts them. */
  waveNumber() {
    return Math.min(this.waveIndex + 1, MOBILE_WAVES.length);
  }

  /**
   * A run as one number. Three terms, the same three `GAME.scoring` uses, with
   * this board's own weights in config/mobile.js and the reasoning beside them.
   *
   * `waveIndex` is the count of intakes cleared rather than the one being
   * played, which it already is: completeWave increments it before deciding
   * whether that was the last, so a run that ends part way through the eighth is
   * holding seven. That is the right term for a score, which pays for what was
   * finished, and the wrong one for `final_wave`, which says how far somebody
   * got. The two part company on every run that ends in a loss, which is why
   * `end` sends `waveNumber` and this sends `waveIndex`.
   */
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
    const { width, colour } = this.tracerLook();

    this.shots.push({
      x: target.x,
      y: target.y,
      until: time + this.tower.definition.tracerDurationMs,

      // All three carried on the shot rather than read off the scene when it is
      // drawn. Cards are taken between intakes with the board held, so nothing
      // is in flight when any of them change and they can never differ today. It
      // is still the right place: a tracer is a record of a shot that has
      // already happened, and what it looked like is a fact about that shot.
      lines: this.screenings,
      width,
      colour
    });
  }

  /**
   * What a shot is drawn with, given how many times the bar has been raised.
   *
   * Nought raises is the tower's own colour at the base width, so a run that
   * never takes the card draws exactly what it drew before. Past that it widens
   * a step at a time to a cap tied to the spacing between parallel lines, and
   * warms a stop at a time to the end of the ramp. Both caps and the reasoning
   * for having two readings rather than one are in config/mobile.js.
   */
  tracerLook() {
    const { width, widthStep, maxWidth, heat } = MOBILE_TRACER;

    return {
      width: Math.min(width + this.raises * widthStep, maxWidth),
      colour:
        this.raises === 0
          ? this.stats.tracerColour
          : heat[Math.min(this.raises, heat.length) - 1]
    };
  }

  /**
   * The panel sitting down, wherever the shot landed.
   *
   * The centre is taken at the moment of the hit rather than followed, because
   * the hit happened there: an applicant who walks on out of the ring was still
   * caught, and one who walks into it after the fact was not. Everything about
   * why it is drawn at all is in config/mobile.js at MOBILE_BURST.
   */
  recordBurst(target, radius, time) {
    this.bursts.push({
      x: target.x,
      y: target.y,
      radius,
      until: time + MOBILE_BURST.durationMs,

      // On the burst for the reason the width and the count are on the shot: it
      // is a record of something that has already happened, and how wide the
      // panel was when it sat down is a fact about that.
      colour: this.stats.tracerColour
    });
  }

  drawTracers(time) {
    this.tracers.clear();

    // Under the tracers rather than over them, so the line that caused the ring
    // is still the brightest thing in it.
    this.drawBursts(time);

    // Walked backwards so an expired tracer can be spliced out without the loop
    // skipping the one after it, and so nothing allocates a filtered copy of
    // the array every frame.
    for (let index = this.shots.length - 1; index >= 0; index -= 1) {
      const shot = this.shots[index];

      if (time >= shot.until) {
        this.shots.splice(index, 1);

        continue;
      }

      this.drawShot(shot);
    }
  }

  /**
   * The area each recent shot caught, drawn the same size and the same weight
   * for as long as it is there. The expiry walk is the tracers' one.
   */
  drawBursts(time) {
    const { fillAlpha, lineAlpha, lineWidth } = MOBILE_BURST;

    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      const burst = this.bursts[index];

      if (time >= burst.until) {
        this.bursts.splice(index, 1);

        continue;
      }

      this.tracers.fillStyle(burst.colour, fillAlpha);
      this.tracers.fillCircle(burst.x, burst.y, burst.radius);

      this.tracers.lineStyle(lineWidth, burst.colour, lineAlpha);
      this.tracers.strokeCircle(burst.x, burst.y, burst.radius);
    }
  }

  /**
   * One shot, drawn as one line per screening running at once, as wide and as
   * warm as the bar has been raised.
   *
   * The lines are genuinely parallel rather than a fan, offset by the same
   * amount at both ends, because a fan converging on the target is one screening
   * with a wide muzzle and this is meant to read as several going on at once.
   * The set is centred on the line the shot would have been anyway, so an
   * unupgraded run draws exactly what it drew before: at one line the offset is
   * nought and this is the old lineBetween with arithmetic in front of it.
   *
   * It says nothing by movement, which is the rule on this board. The count, the
   * width and the colour are there for as long as the tracer is, they are the
   * same on every shot, and a player who has asked their system for less motion
   * sees what everybody else sees. Compare the floating damage numbers argument
   * at buildHud: this is legible for the same reason those were not.
   */
  drawShot(shot) {
    const { x: fromX, y: fromY } = this.tower;
    const lines = shot.lines ?? 1;
    const width = shot.width ?? MOBILE_TRACER.width;
    const colour = shot.colour ?? this.tower.definition.tracerColour;

    this.tracers.lineStyle(width, colour, 0.8);

    if (lines === 1) {
      this.tracers.lineBetween(fromX, fromY, shot.x, shot.y);

      return;
    }

    // The unit vector across the shot, for offsetting each line sideways. A
    // target sat exactly on the turret has no direction to be across, which the
    // arrival boundary makes impossible and which costs one guard to survive
    // anyway rather than drawing a divide by nought's worth of nothing.
    const dx = shot.x - fromX;
    const dy = shot.y - fromY;
    const length = Math.hypot(dx, dy);

    if (length === 0) {
      return;
    }

    const acrossX = -dy / length;
    const acrossY = dx / length;
    const middle = (lines - 1) / 2;

    for (let line = 0; line < lines; line += 1) {
      const offset = (line - middle) * MOBILE_TRACER.spacing;
      const shiftX = acrossX * offset;
      const shiftY = acrossY * offset;

      this.tracers.lineBetween(
        fromX + shiftX,
        fromY + shiftY,
        shot.x + shiftX,
        shot.y + shiftY
      );
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
      // Hurt, or one of the types that carries its bar from the moment it turns
      // up. The second is one type and the reasoning is in applicants.js beside
      // the flag; the first is the rule and stays the rule.
      if (
        !applicant.active ||
        (applicant.health >= applicant.maxHealth &&
          !applicant.definition.showHealth)
      ) {
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

  /**
   * The reach, redrawn rather than drawn once, since a card can widen it mid
   * run.
   *
   * The splash radius used to be drawn here too, as a second ring around the
   * desk. It has gone, and the removal is the substance of the change rather
   * than tidying up after it: a splash lands where the shot lands, so a circle
   * at the middle of the board marked out the one place it never happens, and
   * next to a ring that genuinely does mean range it read as a smaller range.
   * It is drawn at the hit now, by drawBursts.
   */
  drawRange() {
    const { centre } = RADIAL_BOARD;

    this.range.clear();
    this.range.lineStyle(1, this.stats.tracerColour, 0.18);
    this.range.strokeCircle(centre.x, centre.y, this.stats.range);
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

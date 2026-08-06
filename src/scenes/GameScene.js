import Phaser from 'phaser';

import { APPLICANTS } from '../config/applicants.js';
import { GAME } from '../config/game.js';
import { introKeyFor } from '../config/intros.js';
import { TOWERS } from '../config/towers.js';
import { COPY } from '../content/copy.js';
import Applicant from '../entities/Applicant.js';
import Tower from '../entities/Tower.js';
import Trap, { TRAP_SPRITE_SCALE } from '../entities/Trap.js';
import {
  setWaveNumber,
  trackApplicantLeaked,
  trackGameOver,
  trackGameStarted,
  trackRestartClicked,
  trackRunQuit,
  trackTowerPlaced,
  trackWaveCompleted,
  trackWaveStarted
} from '../services/analytics.js';
import { playSound } from '../services/audio.js';
import { resolveWaves } from '../services/experiments.js';
import { currentMode, currentModeKey } from '../services/mode.js';

const PATH_WIDTH = 44;
const PATH_FILL = 0x232830;
const PATH_EDGE = 0x2f3742;

/**
 * How the arrival ground is drawn where there is no path to draw, which is to
 * say where the crowd is wide enough that a line would be a lie. The band is
 * the ground everybody covers between them, filled faintly and edged, with the
 * spine itself as a hairline down the middle of it.
 *
 * It is worth drawing at all because it is the level design. Without it a
 * player has no way of telling where the crowd narrows, and where it narrows is
 * the only place a tower is worth the money.
 */
const BAND_FILL_ALPHA = 0.5;
const BAND_EDGE_ALPHA = 0.55;
const BAND_SPINE_ALPHA = 0.5;
const VACANCY_SIZE = 54;
const VACANCY_COLOUR = 0xb5553f;

/**
 * Board layout, not balance, so it stays here rather than in config. How far a
 * tower has to sit from the walked line went the other way and is now a mode
 * setting, since one mode has a line to keep clear of and the other does not.
 */
const CELL_SIZE = 64;
/**
 * The strip along the top that the HUD sits in. Nothing is buildable under it,
 * which keeps the tower palette clickable without the board reading the same
 * click as an attempt to build behind it. Deep enough to clear the two grid
 * rows the palette overlaps, neither of which held many tiles anyway.
 *
 * Exported so the HUD can pin things to the bottom of the strip and be certain
 * they are not hanging over the board, where a click would do two things.
 */
export const HUD_HEIGHT = 128;
const TILE_COLOUR = 0x2b323b;
const VALID_TINT = 0x7fb069;
const INVALID_TINT = 0xb5553f;
const HEALTH_BAR_WIDTH = 24;
const HEALTH_BAR_HEIGHT = 3;

/**
 * The bar under a tower that is being leaned on. Wider than an applicant's,
 * because a tower is wider, and sat below the base rather than above it so it
 * cannot be mistaken for the health of somebody standing on the same tile.
 *
 * It says two different things depending on the colour. Steady is integrity
 * left. Warning is a suspension counting itself down, which is the more useful
 * number once the tower has already stopped working.
 */
const INTEGRITY_BAR_WIDTH = 34;
const INTEGRITY_BAR_HEIGHT = 3;
const INTEGRITY_BAR_DROP = 26;
const INTEGRITY_COLOUR = 0x8fc4de;
const SUSPENDED_COLOUR = 0xd98a6a;

/**
 * How a leak looks, which is presentation rather than balance, so it stays
 * here. The pause before the game over screen is there so the last applicant
 * is seen arriving rather than being covered up mid step.
 */
const VACANCY_FILL_ALPHA = 0.18;
const VACANCY_DAMAGE_ALPHA = 0.52;
const LEAK_FLASH_ALPHA = 0.6;
const LEAK_FLASH_MS = 340;
const LEAK_LABEL_MS = 900;
const GAME_OVER_DELAY_MS = 700;

/**
 * How long the spark sits on an applicant that has just been hit. Shorter than
 * the shortest reload, so a fast tower does not stack sparks on one target.
 */
const IMPACT_MS = 220;

/** How long a wave banner fades up, sits there and fades out again. */
const BANNER_FADE_MS = 220;
const BANNER_HOLD_MS = 1100;

/** A new face is introduced for longer, since there is more to read. */
const NOTICE_HOLD_MS = 2600;

/**
 * The card a new applicant type is introduced on. It sits just under the HUD,
 * clear of the path, and it does not stop the wave: a type turns up in the
 * middle of an intake and holding the board for it would be worse than not
 * introducing it at all.
 *
 * The card is not interactive, so a click on it is a click on the board
 * underneath, the same as the plain notice it replaced. It is sized and placed
 * to finish above the path's highest leg, since an applicant walking behind an
 * opaque card is an applicant the player cannot shoot at.
 */
const CARD_WIDTH = 404;
const CARD_HEIGHT = 92;
const CARD_PADDING = 8;
const CARD_ART_SIZE = 76;
const CARD_RADIUS = 10;
const CARD_FILL = 0x1a1f26;
const CARD_EDGE = 0x39566b;

/** How far the card rises as it pops in, and how long it takes about it. */
const CARD_RISE = 12;
const CARD_POP_MS = 280;

/**
 * The two constants of the R2 low discrepancy sequence, which is what decides
 * where in the crowd each applicant walks.
 *
 * Two numbers are wanted per arrival: how far off the spine they are, and how
 * far back from the gate they start. Drawing both at random clumps, and a crowd
 * that clumps has holes in it that a wave of ten disappears into. R2 spreads
 * successive draws across the space by construction, so the fifth applicant
 * fills a gap the first four left rather than landing on top of one of them,
 * and it costs a multiply and a modulo rather than any bookkeeping.
 */
const R2_ALPHA_1 = 0.7548776662;
const R2_ALPHA_2 = 0.5698402910;

/**
 * How far above a finger the preview sits, in CSS pixels rather than board
 * ones. A fingertip covers about nine millimetres of glass, which is most of a
 * cell once the board has been scaled down to a phone, so a preview drawn under
 * the finger is a preview nobody can see. Lifting it clear is what makes the
 * range circle and the valid tint worth drawing at all.
 *
 * Held in CSS pixels because the distance that matters is the physical one. The
 * board pixels it works out as depend on how far the board has been scaled, so
 * the conversion happens per event in `placementPoint`.
 */
const TOUCH_LIFT_CSS = 64;

/**
 * The pause before the Boomerangs come back, and the gap between them. Long
 * enough that the board is visibly clear first, so the return reads as a
 * return rather than as a wave that would not end.
 */
const RETURN_DELAY_MS = 900;
const RETURN_STAGGER_MS = 500;

const DEPTHS = {
  board: 0,
  fields: 5,
  towers: 10,
  applicants: 20,
  shots: 30,
  overlay: 40,
  hint: 50
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Everything that differs between the two modes is read here and nowhere
    // else, so the loop below runs the same whichever is being played.
    this.mode = currentMode();
    this.waypoints = this.mode.waypoints;

    // Whether anybody fans out. A route with no spread on any waypoint is a
    // line, and a line is walked by one shared path object exactly as it was
    // before there were modes at all.
    this.crowded = this.waypoints.some((point) => point.spread > 0);
    this.arrivals = 0;

    this.path = this.buildPath();
    this.applicants = this.add.group();
    this.towers = [];
    this.traps = [];

    // When each trap type may next be set, keyed by type. A trap is free and
    // is spent on contact, so without this a player can lay one, watch it go
    // off and lay the next in the same second, which turns a one-off into a
    // rather effective machine gun.
    this.trapReadyAt = {};
    this.occupiedCells = new Set();
    this.shots = [];
    this.bursts = [];
    this.hoveredPoint = null;
    // Whether a finger is currently dragging a preview around the board.
    this.touchPlacing = false;
    this.lives = GAME.startingLives;
    this.currency = GAME.startingCurrency;
    this.selectedTowerKey = Object.keys(TOWERS)[0];
    this.rejected = 0;
    this.runOver = false;

    // Wave one comes from the experiment assignment, the rest are the same in
    // both arms. Resolved once per run, so a restart is a fresh assignment.
    this.waves = resolveWaves(this.mode);
    this.waveIndex = 0;
    this.wavesCleared = 0;
    this.phase = 'preparing';
    this.waveTimers = [];
    this.spawnsRemaining = 0;
    this.prepSecondsLeft = 0;
    this.banner = null;
    this.notice = null;

    // Read when a wave finishes, to say how long it took and what it cost.
    this.waveStartedAt = 0;
    this.livesAtWaveStart = this.lives;

    // Boomerangs waiting to come back, and the types the player has met, so a
    // type is introduced the first time it turns up and not again.
    this.pendingReturns = [];
    this.seenTypes = new Set();

    this.drawPath();
    this.drawVacancy();
    this.findBuildableCells();
    this.drawBuildableCells();

    this.createPlacementGhost();

    this.fieldGraphics = this.add.graphics().setDepth(DEPTHS.fields);
    this.shotGraphics = this.add.graphics().setDepth(DEPTHS.shots);
    this.healthGraphics = this.add.graphics().setDepth(DEPTHS.shots);

    // The HUD is its own scene so it carries on drawing while this one is
    // paused behind the game over screen. Launching restarts it, which is
    // what a fresh run wants.
    this.scene.launch('UIScene');

    this.bindPlacementInput();

    // Number keys pick a tower, in palette order. The HUD offers the same
    // choice by click, and both end up in selectTower.
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((key, index) => {
      const typeKey = Object.keys(TOWERS)[index];

      if (typeKey) {
        this.input.keyboard.on(`keydown-${key}`, () => this.selectTower(typeKey));
      }
    });

    this.input.keyboard.on('keydown-SPACE', () => this.skipPreparation());
    this.input.keyboard.on('keydown-ESC', () => this.openPause());

    // A restart builds this scene again, so this is also where a second and
    // third attempt are counted.
    trackGameStarted();

    this.announceMode();
    this.beginPreparation();
  }

  update(time, delta) {
    const applicants = this.applicants.getChildren();

    this.applySlows(applicants);
    this.applyPressure(applicants, time, delta);

    this.towers.forEach((tower) => {
      const target = tower.update(time, applicants);

      if (target) {
        this.resolveHit(tower, target, applicants, time);
      }
    });

    this.checkTraps(applicants, time);

    this.drawShots(time);
    this.drawHealthBars(applicants, time);

    // A wave is over when everybody it was going to send has been sent and
    // none of them are still walking, however they left the board. Anybody who
    // is coming back gets to come back first.
    if (
      this.phase === 'running' &&
      this.spawnsRemaining === 0 &&
      !applicants.some((applicant) => applicant.active)
    ) {
      if (this.pendingReturns.length > 0) {
        this.releaseReturns();
      } else {
        this.completeWave();
      }
    }
  }

  /**
   * Says which mode this is, once, on the board it is being played on. It is on
   * a banner rather than in the HUD because it is only news at the start of a
   * run: after that the board itself says which one it is, and the HUD strip
   * has nothing spare.
   */
  announceMode() {
    const mode = COPY.modes[currentModeKey()];

    if (mode) {
      this.showBanner(mode.name, mode.banner);
    }
  }

  get waveNumber() {
    return this.waveIndex + 1;
  }

  get waveCount() {
    return this.waves.length;
  }

  /**
   * The run as one number, for the analytics now and the leaderboard later.
   * The weights are data, so tuning it does not mean coming back in here.
   */
  get score() {
    const { perWaveCleared, perRejection, perLifeRemaining } = GAME.scoring;

    return (
      this.wavesCleared * perWaveCleared +
      this.rejected * perRejection +
      this.lives * perLifeRemaining
    );
  }

  /**
   * The pause before a wave. The player builds in it, and it counts down in
   * whole seconds rather than being tracked per frame, since a second is the
   * smallest unit the HUD shows.
   */
  beginPreparation() {
    const prepMs =
      this.waveNumber === 1 ? GAME.firstWavePrepMs : GAME.wavePrepMs;

    this.phase = 'preparing';
    this.prepSecondsLeft = Math.round(prepMs / 1000);

    // Towers bought in the pause belong to the wave being prepared for, not to
    // the one that has just been screened.
    setWaveNumber(this.waveNumber);

    this.announcePreparation();

    this.prepTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.prepSecondsLeft -= 1;

        if (this.prepSecondsLeft <= 0) {
          this.startWave();

          return;
        }

        this.announcePreparation();
      }
    });
  }

  announcePreparation() {
    this.events.emit('wave-preparing', {
      waveNumber: this.waveNumber,
      waveCount: this.waveCount,
      secondsLeft: this.prepSecondsLeft
    });
  }

  /**
   * The player would rather not wait. Nothing is skipped except the waiting:
   * the wave that was coming is the wave that arrives.
   */
  skipPreparation() {
    if (this.phase !== 'preparing' || this.runOver) {
      return;
    }

    this.startWave();
  }

  /**
   * Holds the run where it is and puts the pause screen over it. Pausing this
   * scene stops its clock as well as its update, so the wave, the countdown and
   * every trap waiting to be reset all pick up where they left off.
   *
   * A pause is not an analytics event. Nothing in the spec asks how often a
   * player looks away, and a feature existing is not a reason for an event.
   */
  openPause() {
    if (this.runOver || this.scene.isPaused()) {
      return;
    }

    // The ghost is drawn from the last pointer position, and the pointer is
    // about to be somewhere else entirely.
    this.ghost.setVisible(false);
    this.ghostRange.clear();

    this.scene.launch('PauseScene');
    this.scene.pause();
  }

  /**
   * Back to the board, with nothing changed by the visit.
   */
  resumeRun() {
    this.scene.stop('PauseScene');
    this.scene.resume();
  }

  /**
   * The player would rather start again than play this one out. The run ends
   * here without a game over, so it is reported as abandoned before the restart
   * is counted, which keeps a run from simply disappearing from the funnel.
   *
   * Restarting this scene runs create again, which relaunches the HUD and takes
   * a fresh experiment assignment, the same as a restart from the game over
   * screen.
   */
  restartRun() {
    trackRunQuit('restart');
    trackRestartClicked({
      fromWave: this.waveNumber,
      previousScore: this.score
    });

    this.scene.stop('PauseScene');
    this.scene.restart();
  }

  /**
   * Out of the run altogether and back to the front page. The score is not
   * offered to the leaderboard, because a run that was walked out of halfway is
   * not a run anybody screened.
   */
  leaveRun() {
    trackRunQuit('quit');

    this.scene.stop('PauseScene');
    this.scene.stop('UIScene');

    // Stops this scene and starts the front page in its place.
    this.scene.start('HomeScene');
  }

  /**
   * Opens the wave. Every group is scheduled up front, since a wave is a fixed
   * list of arrivals and nothing during it changes what is coming.
   */
  startWave() {
    const wave = this.waves[this.waveIndex];

    this.prepTimer.remove();
    this.phase = 'running';
    this.waveStartedAt = this.time.now;
    this.livesAtWaveStart = this.lives;
    this.spawnsRemaining = wave.groups.reduce(
      (total, group) => total + group.count,
      0
    );

    wave.groups.forEach((group) => this.scheduleGroup(group));

    this.events.emit('wave-started', {
      waveNumber: this.waveNumber,
      waveCount: this.waveCount
    });

    trackWaveStarted({
      waveNumber: this.waveNumber,
      livesRemaining: this.lives,
      currency: this.currency
    });

    playSound('wave-open');

    this.showBanner(
      `${COPY.hud.wave} ${this.waveNumber}`,
      COPY.board.waveIncoming
    );
  }

  /**
   * One run of arrivals: the first after the group's delay, the rest on the
   * interval behind it.
   */
  scheduleGroup(group) {
    const opener = this.time.delayedCall(group.delayMs, () => {
      this.spawnApplicant(group.applicant);

      if (group.count === 1) {
        return;
      }

      this.waveTimers.push(
        this.time.addEvent({
          delay: group.intervalMs,
          repeat: group.count - 2,
          callback: () => this.spawnApplicant(group.applicant)
        })
      );
    });

    this.waveTimers.push(opener);
  }

  /**
   * The board is clear. The wave pays out, and either the next one is queued
   * up or that was the last of them and the vacancy has held.
   */
  completeWave() {
    const wave = this.waves[this.waveIndex];

    this.clearWaveTimers();

    this.currency += wave.reward;
    this.events.emit('currency-changed', this.currency);
    this.events.emit('wave-completed', {
      waveNumber: this.waveNumber,
      reward: wave.reward
    });

    this.wavesCleared += 1;

    // Before the last wave check below, so every intake screened sounds the
    // same, including the one that wins the run.
    playSound('wave-clear');

    trackWaveCompleted({
      waveNumber: this.waveNumber,
      durationMs: this.time.now - this.waveStartedAt,
      livesLost: this.livesAtWaveStart - this.lives,
      // Armed traps count. They are not towers, but they are things the player
      // put on the board and has not got back yet.
      towersOnBoard: this.towers.length + this.traps.length
    });

    // The last wave gets no banner, since the game over screen is about to
    // say the same thing at more length.
    if (this.waveNumber === this.waveCount) {
      this.endRun('survived');

      return;
    }

    this.showBanner(
      COPY.board.waveCleared,
      `+${wave.reward} ${COPY.board.budgetAdded}`
    );

    this.waveIndex += 1;
    this.beginPreparation();
  }

  clearWaveTimers() {
    this.waveTimers.forEach((timer) => timer.remove());
    this.waveTimers = [];
  }

  /**
   * A line or two across the middle of the board, for the things worth saying
   * out loud: a wave opening, a wave screened.
   */
  showBanner(title, subtitle) {
    const centreX = this.scale.width / 2;
    const centreY = this.scale.height / 2 - 40;

    this.clearBanner();

    const titleText = this.add
      .text(centreX, centreY, title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        color: '#e6ebf0'
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTHS.hint);

    const subtitleText = this.add
      .text(centreX, centreY + 30, subtitle, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#8b98a6'
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(DEPTHS.hint);

    this.banner = [titleText, subtitleText];

    this.tweens.add({
      targets: this.banner,
      alpha: 1,
      duration: BANNER_FADE_MS,
      hold: BANNER_HOLD_MS,
      yoyo: true,
      onComplete: () => this.clearBanner()
    });
  }

  /**
   * Takes a banner off the board, whether it faded out on its own or the run
   * ended underneath it. Without this a banner caught by the game over screen
   * freezes there, since the scene is paused rather than stopped.
   */
  clearBanner() {
    if (!this.banner) {
      return;
    }

    this.banner.forEach((text) => text.destroy());
    this.banner = null;
  }

  /**
   * The card a new face arrives on, just under the HUD, out of the way of the
   * middle so a wave banner and an introduction can both be up at once.
   *
   * The animation is tinted with the applicant's own colour, the same colour
   * the thing walking down the path is drawn in, so the two are recognisably
   * the same person. A type with nothing drawn for it still gets the card, with
   * the text spread across the whole of it.
   */
  showNotice(typeKey, name, trait) {
    const artKey = introKeyFor(typeKey);
    const left = -CARD_WIDTH / 2;
    const textLeft = artKey
      ? CARD_PADDING * 2 + CARD_ART_SIZE
      : CARD_PADDING * 2;
    const resting = HUD_HEIGHT + 4;

    this.clearNotice();

    const card = this.add.container(this.scale.width / 2, resting + CARD_RISE);
    const panel = this.add.graphics();

    panel.fillStyle(CARD_FILL, 0.94);
    panel.fillRoundedRect(left, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
    panel.lineStyle(1, CARD_EDGE, 0.8);
    panel.strokeRoundedRect(left, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);

    card.add(panel);

    if (artKey) {
      const art = this.add
        .sprite(
          left + CARD_PADDING + CARD_ART_SIZE / 2,
          CARD_HEIGHT / 2,
          artKey
        )
        .setDisplaySize(CARD_ART_SIZE, CARD_ART_SIZE)
        .setTint(APPLICANTS[typeKey].colour);

      art.play(artKey);
      card.add(art);
    }

    card.add(
      this.add
        .text(left + textLeft, 30, name, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#e6ebf0'
        })
        .setOrigin(0, 0.5)
    );

    card.add(
      this.add.text(left + textLeft, 46, trait, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#8b98a6',
        lineSpacing: 4,
        wordWrap: { width: CARD_WIDTH - textLeft - CARD_PADDING }
      })
    );

    card.setAlpha(0).setScale(0.94).setDepth(DEPTHS.hint);

    this.notice = card;

    // In with a little overshoot, which is the whole of the pop, then a plain
    // fade out once it has been up long enough to read.
    this.tweens.add({
      targets: card,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: resting,
      duration: CARD_POP_MS,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: card,
      alpha: 0,
      delay: CARD_POP_MS + NOTICE_HOLD_MS,
      duration: BANNER_FADE_MS,
      onComplete: () => this.clearNotice()
    });
  }

  clearNotice() {
    if (!this.notice) {
      return;
    }

    // The pop and the fade are taken off first. Phaser leaves a tween pointing
    // at a destroyed target, so without this a card cleared early would still
    // run its own fade out afterwards and clear whatever had replaced it.
    this.tweens.killTweensOf(this.notice);

    // Destroying the container takes the panel, the animation and both lines of
    // text with it.
    this.notice.destroy(true);
    this.notice = null;
  }

  /**
   * Holds every applicant at the speed of the strongest field it is standing
   * in, and lets it back up to full speed once it walks clear. Fields do not
   * stack, since two Take-Home Tasks side by side would otherwise stop the
   * board dead.
   */
  applySlows(applicants) {
    applicants.forEach((applicant) => {
      if (!applicant.active) {
        return;
      }

      let multiplier = 1;

      this.towers.forEach((tower) => {
        if (
          tower.definition.behaviour === 'slow' &&
          !tower.suspended &&
          tower.isInRange(applicant)
        ) {
          multiplier = Math.min(multiplier, tower.definition.slowMultiplier);
        }
      });

      applicant.setSpeedMultiplier(multiplier);
    });
  }

  /**
   * A tower has fired. Most of them hit one applicant. A tower with a splash
   * radius hits whoever it aimed at and everybody standing near them, rolling
   * the damage separately for each, since a panel rarely agrees with itself.
   */
  resolveHit(tower, target, applicants, time) {
    const { splashRadius, tracerColour, burstDurationMs } = tower.definition;

    this.recordShot(tower, target, time);

    if (!splashRadius) {
      this.showImpact('spark', target.x, target.y, tracerColour, IMPACT_MS);
      this.applyDamage(tower, target);

      return;
    }

    this.recordBurst(
      target.x,
      target.y,
      splashRadius,
      tracerColour,
      burstDurationMs,
      time
    );

    applicants.forEach((applicant) => {
      if (!applicant.active || !tower.canTarget(applicant)) {
        return;
      }

      const caught =
        Phaser.Math.Distance.Between(
          target.x,
          target.y,
          applicant.x,
          applicant.y
        ) <= splashRadius;

      if (caught) {
        this.applyDamage(tower, applicant);
      }
    });
  }

  /**
   * One hit landing on one applicant. An instant rejection takes whatever
   * health is left, so both sorts of tower go through the same place.
   */
  applyDamage(tower, applicant) {
    const damage = tower.definition.instantReject
      ? applicant.health
      : tower.rollDamage();

    if (applicant.takeDamage(damage)) {
      this.rejectApplicant(applicant);
    }
  }

  /**
   * Traps go off on contact and are spent. Whoever trod on it takes the hit,
   * along with anybody unlucky enough to be walking with them.
   */
  checkTraps(applicants, time) {
    if (this.traps.length === 0) {
      return;
    }

    const sprung = this.traps.filter((trap) =>
      applicants.some((applicant) => applicant.active && trap.catches(applicant))
    );

    if (sprung.length === 0) {
      return;
    }

    sprung.forEach((trap) => {
      const { triggerRadius, fieldColour, burstDurationMs } = trap.definition;

      this.recordBurst(
        trap.x,
        trap.y,
        triggerRadius,
        fieldColour,
        burstDurationMs,
        time
      );

      applicants.forEach((applicant) => {
        if (applicant.active && trap.catches(applicant)) {
          this.applyDamage(trap, applicant);
        }
      });

      trap.spring();
    });

    this.traps = this.traps.filter((trap) => !sprung.includes(trap));
    this.drawFields();
  }

  /**
   * An applicant has been screened out. That is the one thing this department
   * gets paid for, so the bounty goes back into the budget.
   */
  rejectApplicant(applicant) {
    this.queueReturn(applicant);

    applicant.reject();

    playSound('reject');

    this.rejected += 1;
    this.currency += applicant.definition.bounty;
    this.events.emit('currency-changed', this.currency);
  }

  /**
   * A Boomerang leaving the board is a Boomerang that has not finished. It is
   * put on a list and comes back once the rest of the wave is done with,
   * whether it was rejected or walked in through the front door.
   */
  queueReturn(applicant) {
    if (
      this.runOver ||
      this.phase !== 'running' ||
      !applicant.definition.returns ||
      applicant.hasReturned
    ) {
      return;
    }

    this.pendingReturns.push(applicant.typeKey);
  }

  /**
   * The board is clear but the wave is not over, because some of them have
   * reapplied. They are sent back out on the same counter the wave uses, so
   * nothing has to know the difference.
   */
  releaseReturns() {
    const returns = this.pendingReturns;

    this.pendingReturns = [];
    this.spawnsRemaining = returns.length;

    this.showBanner(COPY.board.reapplying, COPY.board.reapplyingNote);

    returns.forEach((typeKey, index) => {
      this.waveTimers.push(
        this.time.delayedCall(RETURN_DELAY_MS + index * RETURN_STAGGER_MS, () =>
          this.spawnApplicant(typeKey, true)
        )
      );
    });
  }

  /**
   * Turns the waypoint data into a Phaser path of straight segments. Phaser
   * spaces points along the whole path by arc length, so a linear tween across
   * it gives a constant walking speed regardless of segment length.
   *
   * `offset` is where in the crowd this one walks, from -1 at the top of the
   * spread to 1 at the bottom, and `startBack` is how far behind the gate they
   * come on. With both at zero, and on a route with no spread on it, this
   * returns exactly the path it returned before there were modes.
   *
   * The offset is scaled by each waypoint's own spread rather than by one
   * number for the route, which is what lets the crowd widen and narrow as it
   * crosses the board. A spread of zero on the last waypoint is what brings
   * everybody back together at the vacancy, however far apart they came in.
   */
  buildPath(offset = 0, startBack = 0) {
    const points = this.waypoints.map((point, index) => ({
      x: index === 0 ? point.x - startBack : point.x,
      y: point.y + offset * (point.spread ?? 0)
    }));

    const [start, ...rest] = points;
    const path = new Phaser.Curves.Path(start.x, start.y);

    rest.forEach((point) => path.lineTo(point.x, point.y));

    return path;
  }

  /**
   * The ground the applicants arrive over. A corridor where they walk in file,
   * and the band they cover between them where they do not.
   *
   * Stroked as one polyline rather than with path.draw, which strokes each
   * segment separately and leaves notches at every corner.
   */
  drawPath() {
    const graphics = this.add.graphics().setDepth(DEPTHS.board);

    if (this.crowded) {
      this.drawBand(graphics);

      return;
    }

    graphics.lineStyle(PATH_WIDTH, PATH_EDGE, 1);
    graphics.strokePoints(this.waypoints, false, false);

    graphics.lineStyle(PATH_WIDTH - 6, PATH_FILL, 1);
    graphics.strokePoints(this.waypoints, false, false);
  }

  /**
   * The crowd's ground, as one closed shape: the top edge of the spread left to
   * right, then the bottom edge back again. Drawn as a polygon rather than as a
   * thick stroke because the width changes along it, which is the whole point
   * of it and the one thing a stroke cannot do.
   */
  drawBand(graphics) {
    const top = this.waypoints.map((point) => ({
      x: point.x,
      y: point.y - (point.spread ?? 0)
    }));
    const bottom = this.waypoints
      .map((point) => ({ x: point.x, y: point.y + (point.spread ?? 0) }))
      .reverse();

    graphics.fillStyle(PATH_FILL, BAND_FILL_ALPHA);
    graphics.fillPoints([...top, ...bottom], true);

    graphics.lineStyle(1, PATH_EDGE, BAND_EDGE_ALPHA);
    graphics.strokePoints(top, false, false);
    graphics.strokePoints(bottom, false, false);

    // The middle of the crowd. Nobody in particular walks it, but it is where
    // the density is highest and it reads as the direction of travel.
    graphics.lineStyle(1, PATH_EDGE, BAND_SPINE_ALPHA);
    graphics.strokePoints(this.waypoints, false, false);
  }

  drawVacancy() {
    const vacancy = this.path.getEndPoint();

    this.vacancyGraphics = this.add.graphics().setDepth(DEPTHS.board);

    // Sat on top of the vacancy and invisible until an applicant arrives,
    // when it is flashed and faded back out.
    this.vacancyFlash = this.add
      .rectangle(
        vacancy.x,
        vacancy.y,
        VACANCY_SIZE,
        VACANCY_SIZE,
        VACANCY_COLOUR
      )
      .setAlpha(0)
      .setDepth(DEPTHS.shots);

    this.refreshVacancy();
  }

  /**
   * The vacancy fills in as its integrity drops, so the board shows how a run
   * is going without anyone having to read the HUD.
   */
  refreshVacancy() {
    const vacancy = this.path.getEndPoint();
    const damage = 1 - this.lives / GAME.startingLives;
    const left = vacancy.x - VACANCY_SIZE / 2;
    const top = vacancy.y - VACANCY_SIZE / 2;

    this.vacancyGraphics.clear();

    this.vacancyGraphics.fillStyle(
      VACANCY_COLOUR,
      VACANCY_FILL_ALPHA + damage * VACANCY_DAMAGE_ALPHA
    );
    this.vacancyGraphics.fillRect(left, top, VACANCY_SIZE, VACANCY_SIZE);

    this.vacancyGraphics.lineStyle(2, VACANCY_COLOUR, 1);
    this.vacancyGraphics.strokeRect(left, top, VACANCY_SIZE, VACANCY_SIZE);
  }

  /**
   * Works out once, at boot, which grid cells a tower may sit on. A cell is
   * buildable if its centre is clear of the path, the vacancy and the HUD.
   *
   * A mode with no clearance has no path to be clear of, so the first test
   * passes everywhere and what is left is the whole board bar the HUD strip and
   * the desk itself. That is the correct answer rather than a shortcut: when
   * the crowd is most of the board wide there is no corridor to stand beside,
   * and where a tower goes stops being about avoiding the route and starts
   * being about how much of the crowd it can see.
   */
  findBuildableCells() {
    const vacancy = this.path.getEndPoint();
    const clearance = this.mode.buildClearance;
    const columns = Math.floor(this.scale.width / CELL_SIZE);
    const rows = Math.floor(this.scale.height / CELL_SIZE);

    this.buildableCells = new Set();

    for (let gridX = 0; gridX < columns; gridX += 1) {
      for (let gridY = 0; gridY < rows; gridY += 1) {
        const centre = this.cellCentre(gridX, gridY);
        const clearOfPath =
          clearance === 0 || this.distanceToPath(centre) >= clearance;
        const clearOfVacancy =
          Phaser.Math.Distance.BetweenPoints(centre, vacancy) >= VACANCY_SIZE;
        const clearOfHud = centre.y >= HUD_HEIGHT;

        if (clearOfPath && clearOfVacancy && clearOfHud) {
          this.buildableCells.add(this.cellKey(gridX, gridY));
        }
      }
    }
  }

  /**
   * A dot on every buildable cell, so it is obvious where a tower can go
   * without having to click around and find out.
   */
  drawBuildableCells() {
    const graphics = this.add.graphics().setDepth(DEPTHS.board);

    graphics.fillStyle(TILE_COLOUR, 1);

    this.buildableCells.forEach((key) => {
      const [gridX, gridY] = key.split(',').map(Number);
      const centre = this.cellCentre(gridX, gridY);

      graphics.fillCircle(centre.x, centre.y, 2);
    });
  }

  /**
   * The point on the walked path closest to a given point, and how far away it
   * is, measured against each segment in turn. Phaser's nearest point helper
   * projects onto the infinite line, so the position along the segment is
   * clamped here.
   *
   * Towers use the distance to keep clear of the path. Traps use the point, to
   * sit on it.
   */
  closestPointOnPath(point) {
    let closest = { x: 0, y: 0, distance: Infinity };

    for (let i = 0; i < this.waypoints.length - 1; i += 1) {
      const from = this.waypoints[i];
      const to = this.waypoints[i + 1];
      const runX = to.x - from.x;
      const runY = to.y - from.y;
      const lengthSquared = runX * runX + runY * runY;
      const along = Phaser.Math.Clamp(
        ((point.x - from.x) * runX + (point.y - from.y) * runY) / lengthSquared,
        0,
        1
      );
      const onSegment = {
        x: from.x + along * runX,
        y: from.y + along * runY
      };
      const distance = Phaser.Math.Distance.Between(
        point.x,
        point.y,
        onSegment.x,
        onSegment.y
      );

      if (distance < closest.distance) {
        closest = { ...onSegment, distance };
      }
    }

    return closest;
  }

  distanceToPath(point) {
    return this.closestPointOnPath(point).distance;
  }

  cellKey(gridX, gridY) {
    return `${gridX},${gridY}`;
  }

  cellCentre(gridX, gridY) {
    return {
      x: gridX * CELL_SIZE + CELL_SIZE / 2,
      y: gridY * CELL_SIZE + CELL_SIZE / 2
    };
  }

  cellAt(x, y) {
    return {
      gridX: Math.floor(x / CELL_SIZE),
      gridY: Math.floor(y / CELL_SIZE)
    };
  }

  canBuildOn(gridX, gridY) {
    const key = this.cellKey(gridX, gridY);

    return this.buildableCells.has(key) && !this.occupiedCells.has(key);
  }

  /**
   * Which art a type is drawn with. Both read straight off the config, which is
   * the only place that decides, and BootScene has already loaded everything
   * the manifest lists by the time either is asked.
   */
  textureKeyFor(typeKey) {
    return APPLICANTS[typeKey].sprite;
  }

  towerTextureKeys(typeKey) {
    return TOWERS[typeKey].sprite;
  }

  /**
   * Placing something, by mouse and by finger.
   *
   * A mouse hovers to see what a cell would take and clicks to commit, which is
   * two separate events and the reason placement reads the way it does. A
   * finger cannot hover: the first thing it does is arrive at the tile it is
   * asking about. So on touch the same two halves are pressing and lifting,
   * with the preview following the finger in between and the tower going down
   * where it was released.
   *
   * Both routes end in the same `updateGhost` and `placeTower`. The gesture is
   * the only thing that differs, so there is no second placement path to keep
   * in step with this one.
   *
   * `wasTouch` is read per event rather than once at boot, because a laptop
   * with a touchscreen has both and whichever the player just used is the one
   * they want to be answered.
   */
  bindPlacementInput() {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
      // A finger that is not touching the glass is not anywhere, so a stale
      // preview is left alone until it comes back down.
      if (pointer.wasTouch && !this.touchPlacing) {
        return;
      }

      const point = this.placementPoint(pointer);

      this.updateGhost(point.x, point.y);
    });

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) => {
      if (!pointer.wasTouch) {
        this.placeTower(pointer.worldX, pointer.worldY);

        return;
      }

      // A press that starts on the HUD is the palette being used, and a finger
      // that then slides onto the board is not a request to build. Only a press
      // that starts on the board arms the gesture.
      this.touchPlacing = pointer.worldY >= HUD_HEIGHT;

      if (this.touchPlacing) {
        const point = this.placementPoint(pointer);

        this.updateGhost(point.x, point.y);
      }
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer) => {
      if (!pointer.wasTouch || !this.touchPlacing) {
        return;
      }

      const point = this.placementPoint(pointer);

      this.touchPlacing = false;
      this.placeTower(point.x, point.y);
      this.clearGhost();
    });

    // Lifting off the edge of the canvas, or a call taking the touch away
    // mid drag. Nothing is placed and the preview goes with it.
    [
      Phaser.Input.Events.POINTER_UP_OUTSIDE,
      Phaser.Input.Events.GAME_OUT
    ].forEach((event) =>
      this.input.on(event, () => {
        if (this.touchPlacing) {
          this.touchPlacing = false;
          this.clearGhost();
        }
      })
    );
  }

  /**
   * Where a pointer is asking about, which for a finger is not where it is.
   *
   * The lift is converted from CSS pixels to board ones through the scale
   * manager's `displayScale`, which is the same factor Phaser uses to turn a
   * page coordinate into a board coordinate. A board shown at half size needs
   * twice the board pixels to clear the same finger.
   */
  placementPoint(pointer) {
    if (!pointer.wasTouch) {
      return { x: pointer.worldX, y: pointer.worldY };
    }

    return {
      x: pointer.worldX,
      y: pointer.worldY - TOUCH_LIFT_CSS * this.scale.displayScale.y
    };
  }

  /**
   * Takes the preview off the board. A mouse leaves one behind on purpose,
   * since the pointer is still over the tile it describes, but a finger that
   * has been lifted is no longer pointing at anything.
   */
  clearGhost() {
    this.hoveredPoint = null;
    this.ghost.setVisible(false);
    this.ghostRange.clear();
  }

  /**
   * The preview that follows the pointer around: a translucent tower tinted by
   * whether the cell will take it, plus the range it would cover.
   */
  createPlacementGhost() {
    this.ghost = this.add
      .image(0, 0, this.towerTextureKeys(this.selectedTowerKey).base)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0.5)
      .setVisible(false)
      .setDepth(DEPTHS.overlay);

    this.ghostRange = this.add.graphics().setDepth(DEPTHS.overlay);
  }

  updateGhost(x, y) {
    const spot = this.ghostSpot(x, y);

    this.hoveredPoint = { x, y };
    this.ghostRange.clear();

    if (!spot) {
      this.ghost.setVisible(false);

      return;
    }

    const tint = spot.allowed ? VALID_TINT : INVALID_TINT;

    const definition = TOWERS[this.selectedTowerKey];
    // Sized here as well as on the real thing, because the sprites are not all
    // the same size and a preview that does not match what lands is worse than
    // no preview.
    const size =
      definition.behaviour === 'trap'
        ? definition.footprint * TRAP_SPRITE_SCALE
        : definition.footprint;

    this.ghost
      .setTexture(this.towerTextureKeys(this.selectedTowerKey).base)
      .setDisplaySize(size, size)
      .setPosition(spot.x, spot.y)
      .setTint(tint)
      .setVisible(true);

    this.ghostRange.lineStyle(1, tint, 0.5);
    this.ghostRange.strokeCircle(spot.x, spot.y, spot.radius);
  }

  /**
   * Where the thing under the pointer would go, and whether it would go there.
   * Null means nowhere, and the ghost is taken off the board.
   *
   * A tower snaps to the grid cell it is over. A trap snaps to the path, since
   * a trap next to the path is a trap nobody treads on, unless the mode has no
   * path worth snapping to, in which case it goes exactly where it is put and
   * choosing a busy patch of ground is the player's problem.
   */
  ghostSpot(x, y) {
    const definition = TOWERS[this.selectedTowerKey];

    if (this.runOver || y < HUD_HEIGHT) {
      return null;
    }

    if (definition.behaviour === 'trap') {
      const spot = this.trapSpot(x, y);

      if (!spot) {
        return null;
      }

      return {
        x: spot.x,
        y: spot.y,
        // A trap still cooling off reads the same as one already armed, since
        // neither is going down on this click.
        allowed: this.canLayTrap() && this.trapWaitRemaining() === 0,
        radius: definition.triggerRadius
      };
    }

    const { gridX, gridY } = this.cellAt(x, y);

    if (!this.buildableCells.has(this.cellKey(gridX, gridY))) {
      return null;
    }

    const centre = this.cellCentre(gridX, gridY);

    return {
      // A cell the budget will not cover reads the same as an occupied one,
      // since neither is going to take a tower on this click.
      ...centre,
      allowed: this.canBuildOn(gridX, gridY) && this.canAfford(),
      radius: definition.range
    };
  }

  /**
   * Changes which tower the next click installs. The HUD renders from the
   * event rather than tracking the selection itself, so the two cannot drift.
   */
  selectTower(typeKey) {
    // The HUD carries on drawing while this scene is paused, so a click on a
    // palette button behind the pause screen still arrives here. Nothing is
    // being placed while the board is held, so nothing is being chosen either.
    if (this.runOver || this.scene.isPaused() || !TOWERS[typeKey]) {
      return;
    }

    this.selectedTowerKey = typeKey;
    this.events.emit('tower-selected', typeKey);

    if (this.hoveredPoint) {
      this.updateGhost(this.hoveredPoint.x, this.hoveredPoint.y);
    }
  }

  canAfford(typeKey = this.selectedTowerKey) {
    return TOWERS[typeKey].cost <= this.currency;
  }

  /**
   * Whether there is room for another trap of this type. There is not much:
   * traps cost nothing, and the limit is the only thing paying for them.
   */
  canLayTrap(typeKey = this.selectedTowerKey) {
    const armed = this.traps.filter((trap) => trap.typeKey === typeKey).length;

    return armed < TOWERS[typeKey].maxArmed;
  }

  /**
   * How much longer this trap type has to wait, in milliseconds, and zero once
   * it is ready. The clock starts when one is set rather than when it goes off,
   * so it is a cap on how often the question gets asked rather than something
   * a well timed click can shorten.
   */
  trapWaitRemaining(typeKey = this.selectedTowerKey) {
    return Math.max(0, (this.trapReadyAt[typeKey] ?? 0) - this.time.now);
  }

  placeTower(x, y) {
    const typeKey = this.selectedTowerKey;
    const definition = TOWERS[typeKey];

    // Nothing goes down under the HUD strip, so a click on the palette is only
    // ever a click on the palette.
    if (this.runOver || y < HUD_HEIGHT) {
      return;
    }

    if (definition.behaviour === 'trap') {
      this.layTrap(x, y, typeKey, definition);

      return;
    }

    const { gridX, gridY } = this.cellAt(x, y);

    if (!this.canBuildOn(gridX, gridY)) {
      return;
    }

    if (!this.canAfford(typeKey)) {
      this.events.emit('purchase-failed', typeKey);

      playSound('denied');

      return;
    }

    const centre = this.cellCentre(gridX, gridY);
    const tower = new Tower(
      this,
      centre.x,
      centre.y,
      typeKey,
      definition,
      this.towerTextureKeys(typeKey)
    );

    tower.gridX = gridX;
    tower.gridY = gridY;
    tower.setDepth(DEPTHS.towers);

    this.towers.push(tower);
    this.occupiedCells.add(this.cellKey(gridX, gridY));

    playSound('place');

    trackTowerPlaced({
      towerType: typeKey,
      currencyBefore: this.currency,
      gridX,
      gridY
    });

    this.currency -= definition.cost;
    this.events.emit('currency-changed', this.currency);

    this.refreshAdjacency();
    this.drawFields();

    // The cell is taken now, so the ghost under the pointer turns red.
    this.updateGhost(x, y);
  }

  /**
   * Where a trap would land, or null if it would land nowhere. A snap distance
   * of zero means the mode has no path to pull it onto, so the answer is simply
   * where the pointer is.
   */
  trapSpot(x, y) {
    const snap = this.mode.trapSnapDistance;

    if (snap === 0) {
      return { x, y };
    }

    const onPath = this.closestPointOnPath({ x, y });

    return onPath.distance > snap ? null : { x: onPath.x, y: onPath.y };
  }

  /**
   * Lays a trap, on the path where there is one and where it was put where
   * there is not.
   */
  layTrap(x, y, typeKey, definition) {
    const spot = this.trapSpot(x, y);

    if (!spot) {
      return;
    }

    if (!this.canLayTrap(typeKey)) {
      this.events.emit('trap-limit', typeKey);

      playSound('denied');

      return;
    }

    const waiting = this.trapWaitRemaining(typeKey);

    if (waiting > 0) {
      this.events.emit('trap-waiting', {
        typeKey,
        secondsLeft: Math.ceil(waiting / 1000)
      });

      return;
    }

    const trap = new Trap(
      this,
      spot.x,
      spot.y,
      typeKey,
      definition,
      this.towerTextureKeys(typeKey).base
    );

    trap.setDepth(DEPTHS.towers);

    this.traps.push(trap);
    this.startTrapDelay(typeKey, definition);

    playSound('place');

    // A trap does not sit on a cell, so the grid position recorded is the cell
    // it landed in. Good enough to see where on the board traps get laid, which
    // is the only thing it is for.
    const cell = this.cellAt(spot.x, spot.y);

    trackTowerPlaced({
      towerType: typeKey,
      currencyBefore: this.currency,
      gridX: cell.gridX,
      gridY: cell.gridY
    });

    this.currency -= definition.cost;
    this.events.emit('currency-changed', this.currency);

    this.drawFields();
    this.updateGhost(x, y);
  }

  /**
   * Shuts the trap type off for a moment after one has been set, and says so,
   * so the palette can grey the button rather than leaving the player to work
   * out why their clicks are doing nothing.
   */
  startTrapDelay(typeKey, definition) {
    const delay = definition.rearmDelayMs ?? 0;

    if (delay <= 0) {
      return;
    }

    this.trapReadyAt[typeKey] = this.time.now + delay;
    this.events.emit('trap-waiting-started', { typeKey, delay });

    this.time.delayedCall(delay, () => {
      this.events.emit('trap-ready', typeKey);

      // The pointer may not have moved since, so the ghost is repainted here
      // rather than waiting for it to.
      if (this.hoveredPoint) {
        this.updateGhost(this.hoveredPoint.x, this.hoveredPoint.y);
      }
    });
  }

  /**
   * Works out which towers have company, which is the whole of the Video
   * Screen's argument for existing. Neighbours are the eight cells around a
   * tower, so a diagonal counts. Traps are not towers and do not count.
   */
  refreshAdjacency() {
    this.towers.forEach((tower) => {
      const hasNeighbour = this.towers.some(
        (other) =>
          other !== tower &&
          // A suspended neighbour is not company. There is nothing next door to
          // hand the recording on to while it is off having its review.
          !other.suspended &&
          Math.abs(other.gridX - tower.gridX) <= 1 &&
          Math.abs(other.gridY - tower.gridY) <= 1
      );

      tower.setAdjacent(hasNeighbour);
    });
  }

  /**
   * Everything on the board that is true until somebody builds something: the
   * reach of the field towers, the patch each trap covers, and a line from a
   * Video Screen to the neighbours paying its bonus. Drawn under the towers,
   * and redrawn on placement rather than every frame.
   */
  drawFields() {
    this.fieldGraphics.clear();

    this.towers.forEach((tower) => {
      // A suspended tower holds nothing and pays nothing, so it draws neither.
      if (tower.suspended) {
        return;
      }

      if (tower.definition.behaviour === 'slow') {
        this.drawField(
          tower.x,
          tower.y,
          tower.definition.range,
          tower.definition.fieldColour
        );
      }

      if (tower.adjacent && tower.definition.linkColour) {
        this.drawLinks(tower);
      }
    });

    this.traps.forEach((trap) => {
      this.drawField(
        trap.x,
        trap.y,
        trap.definition.triggerRadius,
        trap.definition.fieldColour
      );
    });
  }

  drawField(x, y, radius, colour) {
    this.fieldGraphics.fillStyle(colour, 0.07);
    this.fieldGraphics.fillCircle(x, y, radius);

    this.fieldGraphics.lineStyle(1, colour, 0.22);
    this.fieldGraphics.strokeCircle(x, y, radius);
  }

  drawLinks(tower) {
    this.fieldGraphics.lineStyle(1, tower.definition.linkColour, 0.35);

    this.towers.forEach((other) => {
      if (
        other === tower ||
        other.suspended ||
        Math.abs(other.gridX - tower.gridX) > 1 ||
        Math.abs(other.gridY - tower.gridY) > 1
      ) {
        return;
      }

      this.fieldGraphics.lineBetween(tower.x, tower.y, other.x, other.y);
    });
  }

  /**
   * Sends one applicant out. `isReturn` marks a Boomerang that has already had
   * its second go, so it does not queue up for a third.
   */
  spawnApplicant(typeKey, isReturn = false) {
    this.spawnsRemaining = Math.max(0, this.spawnsRemaining - 1);

    const applicant = new Applicant(
      this,
      this.nextPath(),
      typeKey,
      APPLICANTS[typeKey],
      this.textureKeyFor(typeKey)
    );

    applicant.hasReturned = isReturn;
    applicant.setDepth(DEPTHS.applicants);

    this.applicants.add(applicant);
    applicant.walk((arrived) => this.leak(arrived));

    this.introduceType(typeKey);
  }

  /**
   * The route the next arrival walks.
   *
   * Where nobody fans out that is the one shared path, exactly as it was, and
   * the whole crowd apparatus below costs nothing. Where they do, each one gets
   * its own copy of the spine, displaced by its share of the spread and started
   * a little way back from the gate.
   *
   * A path each rather than a shared one with per applicant steering, because
   * everything downstream already reads a PathFollower: the tween is still what
   * moves them, `progress` still says who is closest to the desk, and the slow
   * field still works by scaling a tween's clock. A crowd built this way needed
   * no changes to Applicant at all, which is the reason it is built this way.
   *
   * The two draws come off R2 rather than the random number generator, so
   * successive arrivals fill in the gaps between each other instead of clumping
   * and leaving lanes that a whole wave walks down untouched. The offsets do
   * mean different applicants walk different distances, which is correct: speed
   * is pixels per second, so the one who takes the wide route takes longer, and
   * the front of a crowd arrives ragged.
   */
  nextPath() {
    if (!this.crowded) {
      return this.path;
    }

    this.arrivals += 1;

    const across = ((this.arrivals * R2_ALPHA_1) % 1) * 2 - 1;
    const back = ((this.arrivals * R2_ALPHA_2) % 1) * this.mode.entryJitter;

    return this.buildPath(across, back);
  }

  /**
   * Applicants leaning on the screening.
   *
   * Everybody standing close enough to a tower wears its integrity down, and it
   * comes back on its own while they are not. Recovery is applied against the
   * incoming pressure rather than only when there is none, which is what makes
   * one applicant wandering past harmless and a crowd of them a problem: a
   * Graduate on its own pushes less hard than the process recovers, and eight of
   * them do not.
   *
   * A tower worn to nothing is suspended pending review rather than destroyed,
   * and comes back on its own clock. Nothing here fires an analytics event. The
   * event list answers the questions in the spec and none of them ask how often
   * a tower went offline, and a feature existing has never been a reason for an
   * event in this project.
   */
  applyPressure(applicants, time, delta) {
    const pressure = this.mode.pressure;

    if (!pressure || this.towers.length === 0) {
      return;
    }

    const seconds = delta / 1000;
    let boardChanged = false;

    this.towers.forEach((tower) => {
      if (tower.suspended) {
        if (time >= tower.suspendedUntil) {
          tower.restore();
          boardChanged = true;
        }

        return;
      }

      let incoming = 0;

      applicants.forEach((applicant) => {
        if (!applicant.active || !applicant.definition.pressure) {
          return;
        }

        const near =
          Phaser.Math.Distance.Between(
            tower.x,
            tower.y,
            applicant.x,
            applicant.y
          ) <= pressure.range;

        if (near) {
          incoming += applicant.definition.pressure;
        }
      });

      if (tower.applyPressure((incoming - pressure.recoveryPerSecond) * seconds)) {
        tower.suspend(time, pressure.suspensionMs);
        boardChanged = true;

        playSound('denied');

        this.showSuspension(tower);
      }
    });

    // A suspended tower pays no adjacency bonus and holds no slow field, so
    // both are worked out again rather than left saying what they said before
    // it went offline.
    if (boardChanged) {
      this.refreshAdjacency();
      this.drawFields();
    }
  }

  /**
   * A word over a tower that has just gone offline, in the same shape as the
   * one a leak gets, because they are the same sort of news: something the
   * player was relying on has stopped.
   */
  showSuspension(tower) {
    const label = this.add
      .text(tower.x, tower.y - INTEGRITY_BAR_DROP, COPY.board.suspended, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#d98a6a'
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hint);

    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: LEAK_LABEL_MS,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy()
    });
  }

  /**
   * The first time a type turns up, it is named, its one awkward habit is said
   * out loud, and it gets a moment to itself on the card. After that the player
   * is on their own.
   */
  introduceType(typeKey) {
    if (this.seenTypes.has(typeKey)) {
      return;
    }

    this.seenTypes.add(typeKey);

    const applicant = COPY.applicants[typeKey];

    if (applicant) {
      this.showNotice(typeKey, applicant.name, applicant.trait);
    }
  }

  /**
   * An applicant has reached the vacancy, which costs the player a life. The
   * applicant is cleared either way, so a leak arriving during the pause
   * before the game over screen still tidies itself up.
   */
  leak(applicant) {
    const typeKey = applicant.typeKey;

    applicant.stopFollow();

    // Read before the applicant is destroyed, since a Boomerang that walked in
    // is a Boomerang that will be back.
    this.queueReturn(applicant);

    this.applicants.remove(applicant, true, true);

    if (this.runOver) {
      return;
    }

    this.lives = Math.max(0, this.lives - GAME.livesPerLeak);
    this.events.emit('lives-changed', this.lives);

    trackApplicantLeaked(typeKey);

    this.refreshVacancy();
    this.showLeak();

    if (this.lives === 0) {
      this.endRun('filled');
    }
  }

  showLeak() {
    const vacancy = this.path.getEndPoint();

    playSound('leak');

    this.cameras.main.shake(180, 0.005);

    this.vacancyFlash.setAlpha(LEAK_FLASH_ALPHA);
    this.tweens.add({
      targets: this.vacancyFlash,
      alpha: 0,
      duration: LEAK_FLASH_MS,
      ease: 'Quad.easeOut'
    });

    const label = this.add
      .text(vacancy.x, vacancy.y - VACANCY_SIZE, COPY.board.leak, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#d98a6a'
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hint);

    // The vacancy sits near the right edge, so the label is pulled back on to
    // the board rather than being cut in half by it.
    label.x = Phaser.Math.Clamp(
      label.x,
      label.displayWidth / 2,
      this.scale.width - label.displayWidth / 2 - 8
    );

    this.tweens.add({
      targets: label,
      y: label.y - 28,
      alpha: 0,
      duration: LEAK_LABEL_MS,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy()
    });
  }

  /**
   * The run is over, either because the vacancy has been filled by somebody
   * who got through, or because every wave has been screened. Spawning stops
   * at once, then the board is frozen under the game over screen. Pausing this
   * scene holds the applicants where they are, which is a more useful picture
   * than an empty board.
   */
  endRun(outcome) {
    const score = this.score;

    this.runOver = true;
    this.phase = 'over';

    this.clearWaveTimers();
    this.clearBanner();
    this.clearNotice();

    this.pendingReturns = [];

    if (this.prepTimer) {
      this.prepTimer.remove();
    }

    this.ghost.setVisible(false);
    this.ghostRange.clear();

    // Nothing more can be bought, so the HUD stops offering.
    this.events.emit('run-over');

    // Recorded now rather than after the pause, so a player who closes the tab
    // on the last leak is still counted as having finished the run.
    trackGameOver({ finalWave: this.waveNumber, score });

    this.time.delayedCall(GAME_OVER_DELAY_MS, () => {
      this.scene.launch('GameOverScene', {
        outcome,
        score,
        rejected: this.rejected,
        waveNumber: this.waveNumber,
        waveCount: this.waveCount
      });
      this.scene.pause();
    });
  }

  /**
   * Shots are drawn as a tracer that fades over a few frames. The Keyword
   * Filter matches instantly, so there is no projectile to chase.
   */
  recordShot(tower, target, time) {
    this.shots.push({
      x1: tower.x,
      y1: tower.y,
      x2: target.x,
      y2: target.y,
      colour: tower.definition.tracerColour,
      durationMs: tower.definition.tracerDurationMs,
      expiresAt: time + tower.definition.tracerDurationMs
    });
  }

  /**
   * A hit that lands on more than one person, drawn as a ring that opens out
   * and fades. Used by the Culture Fit Panel and by a trap going off, which
   * from the applicant's side are much the same experience.
   */
  recordBurst(x, y, radius, colour, durationMs, time) {
    // The flame keeps Kenney's own orange rather than taking the tower's
    // colour. A burst wants to look like the same event whoever caused it.
    this.showImpact('flame', x, y, null, durationMs);

    this.bursts.push({
      x,
      y,
      radius,
      colour,
      durationMs,
      expiresAt: time + durationMs
    });
  }

  /**
   * A sprite dropped where a hit landed, which opens out a little and fades.
   *
   * Kept apart from the tracers and rings in `drawShots`, because those are
   * drawn afresh every frame from a list and this is a game object that tweens
   * itself and then tidies itself up. A tint of null leaves the art alone.
   */
  showImpact(key, x, y, tint, durationMs) {
    const impact = this.add
      .image(x, y, key)
      .setDepth(DEPTHS.shots)
      .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

    if (tint !== null) {
      impact.setTint(tint);
    }

    this.tweens.add({
      targets: impact,
      alpha: 0,
      scale: 1.5,
      duration: durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => impact.destroy()
    });
  }

  drawShots(time) {
    this.shotGraphics.clear();
    this.shots = this.shots.filter((shot) => shot.expiresAt > time);
    this.bursts = this.bursts.filter((burst) => burst.expiresAt > time);

    this.shots.forEach((shot) => {
      const remaining = (shot.expiresAt - time) / shot.durationMs;

      this.shotGraphics.lineStyle(2, shot.colour, remaining);
      this.shotGraphics.lineBetween(shot.x1, shot.y1, shot.x2, shot.y2);
    });

    this.bursts.forEach((burst) => {
      const remaining = (burst.expiresAt - time) / burst.durationMs;

      this.shotGraphics.fillStyle(burst.colour, remaining * 0.18);
      this.shotGraphics.fillCircle(burst.x, burst.y, burst.radius);

      this.shotGraphics.lineStyle(2, burst.colour, remaining);
      this.shotGraphics.strokeCircle(
        burst.x,
        burst.y,
        burst.radius * (1.15 - remaining * 0.15)
      );
    });
  }

  drawHealthBars(applicants, time) {
    this.healthGraphics.clear();

    this.drawIntegrityBars(time);

    applicants.forEach((applicant) => {
      if (!applicant.active || applicant.health === applicant.maxHealth) {
        return;
      }

      const left = applicant.x - HEALTH_BAR_WIDTH / 2;
      const top = applicant.y - applicant.definition.radius - 8;
      const fraction = applicant.health / applicant.maxHealth;

      this.healthGraphics.fillStyle(0x000000, 0.5);
      this.healthGraphics.fillRect(
        left,
        top,
        HEALTH_BAR_WIDTH,
        HEALTH_BAR_HEIGHT
      );

      this.healthGraphics.fillStyle(applicant.definition.colour, 1);
      this.healthGraphics.fillRect(
        left,
        top,
        HEALTH_BAR_WIDTH * fraction,
        HEALTH_BAR_HEIGHT
      );
    });
  }

  /**
   * The bar under a tower that is being leaned on or is off having its review.
   *
   * A tower at full integrity draws nothing, the same as an applicant at full
   * health, so a board where nothing is under any pressure looks exactly like
   * the board did before any of this existed.
   */
  drawIntegrityBars(time) {
    const pressure = this.mode.pressure;

    if (!pressure) {
      return;
    }

    this.towers.forEach((tower) => {
      if (!tower.suspended && tower.integrity === tower.maxIntegrity) {
        return;
      }

      const fraction = tower.suspended
        ? tower.suspensionRemaining(time, pressure.suspensionMs)
        : tower.integrity / tower.maxIntegrity;

      const left = tower.x - INTEGRITY_BAR_WIDTH / 2;
      const top = tower.y + INTEGRITY_BAR_DROP;

      this.healthGraphics.fillStyle(0x000000, 0.5);
      this.healthGraphics.fillRect(
        left,
        top,
        INTEGRITY_BAR_WIDTH,
        INTEGRITY_BAR_HEIGHT
      );

      this.healthGraphics.fillStyle(
        tower.suspended ? SUSPENDED_COLOUR : INTEGRITY_COLOUR,
        1
      );
      this.healthGraphics.fillRect(
        left,
        top,
        INTEGRITY_BAR_WIDTH * fraction,
        INTEGRITY_BAR_HEIGHT
      );
    });
  }
}

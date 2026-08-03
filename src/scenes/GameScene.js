import Phaser from 'phaser';

import { APPLICANTS } from '../config/applicants.js';
import { GAME } from '../config/game.js';
import { PATH_WAYPOINTS } from '../config/path.js';
import { TOWERS } from '../config/towers.js';
import { COPY } from '../content/copy.js';
import Applicant from '../entities/Applicant.js';
import Tower from '../entities/Tower.js';
import { resolveWaves } from '../services/experiments.js';

const PATH_WIDTH = 44;
const PATH_FILL = 0x232830;
const PATH_EDGE = 0x2f3742;
const VACANCY_SIZE = 54;
const VACANCY_COLOUR = 0xb5553f;

/** Board layout, not balance, so it stays here rather than in config. */
const CELL_SIZE = 64;
const BUILD_CLEARANCE = 48;
/**
 * The strip along the top that the HUD sits in. Nothing is buildable under it,
 * which keeps the tower palette clickable without the board reading the same
 * click as an attempt to build behind it. Deep enough to clear the two grid
 * rows the palette overlaps, neither of which held many tiles anyway.
 */
const HUD_HEIGHT = 128;
const TILE_COLOUR = 0x2b323b;
const VALID_TINT = 0x7fb069;
const INVALID_TINT = 0xb5553f;
const HEALTH_BAR_WIDTH = 24;
const HEALTH_BAR_HEIGHT = 3;

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

/** How long a wave banner fades up, sits there and fades out again. */
const BANNER_FADE_MS = 220;
const BANNER_HOLD_MS = 1100;

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
    this.path = this.buildPath();
    this.applicants = this.add.group();
    this.towers = [];
    this.occupiedCells = new Set();
    this.shots = [];
    this.hoveredCell = null;
    this.lives = GAME.startingLives;
    this.currency = GAME.startingCurrency;
    this.selectedTowerKey = Object.keys(TOWERS)[0];
    this.rejected = 0;
    this.runOver = false;

    // Wave one comes from the experiment assignment, the rest are the same in
    // both arms. Resolved once per run, so a restart is a fresh assignment.
    this.waves = resolveWaves();
    this.waveIndex = 0;
    this.phase = 'preparing';
    this.waveTimers = [];
    this.spawnsRemaining = 0;
    this.prepSecondsLeft = 0;
    this.banner = null;

    this.drawPath();
    this.drawVacancy();
    this.findBuildableCells();
    this.drawBuildableCells();

    this.createApplicantTextures();
    this.createTowerTextures();
    this.createPlacementGhost();

    this.fieldGraphics = this.add.graphics().setDepth(DEPTHS.fields);
    this.shotGraphics = this.add.graphics().setDepth(DEPTHS.shots);
    this.healthGraphics = this.add.graphics().setDepth(DEPTHS.shots);

    // The HUD is its own scene so it carries on drawing while this one is
    // paused behind the game over screen. Launching restarts it, which is
    // what a fresh run wants.
    this.scene.launch('UIScene');

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) =>
      this.updateGhost(pointer.worldX, pointer.worldY)
    );

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) =>
      this.placeTower(pointer.worldX, pointer.worldY)
    );

    // Number keys pick a tower, in palette order. The HUD offers the same
    // choice by click, and both end up in selectTower.
    ['ONE', 'TWO', 'THREE'].forEach((key, index) => {
      const typeKey = Object.keys(TOWERS)[index];

      if (typeKey) {
        this.input.keyboard.on(`keydown-${key}`, () => this.selectTower(typeKey));
      }
    });

    this.input.keyboard.on('keydown-SPACE', () => this.skipPreparation());

    this.beginPreparation();
  }

  update(time) {
    const applicants = this.applicants.getChildren();

    this.applySlows(applicants);

    this.towers.forEach((tower) => {
      const target = tower.update(time, applicants);

      if (!target) {
        return;
      }

      this.recordShot(tower, target, time);

      // An instant rejection takes whatever health is left, so both sorts of
      // tower go through the same hit.
      const damage = tower.definition.instantReject
        ? target.health
        : tower.definition.damage;

      if (target.takeDamage(damage)) {
        this.rejectApplicant(target);
      }
    });

    this.drawShots(time);
    this.drawHealthBars(applicants);

    // A wave is over when everybody it was going to send has been sent and
    // none of them are still walking, however they left the board.
    if (
      this.phase === 'running' &&
      this.spawnsRemaining === 0 &&
      !applicants.some((applicant) => applicant.active)
    ) {
      this.completeWave();
    }
  }

  get waveNumber() {
    return this.waveIndex + 1;
  }

  get waveCount() {
    return this.waves.length;
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
   * Opens the wave. Every group is scheduled up front, since a wave is a fixed
   * list of arrivals and nothing during it changes what is coming.
   */
  startWave() {
    const wave = this.waves[this.waveIndex];

    this.prepTimer.remove();
    this.phase = 'running';
    this.spawnsRemaining = wave.groups.reduce(
      (total, group) => total + group.count,
      0
    );

    wave.groups.forEach((group) => this.scheduleGroup(group));

    this.events.emit('wave-started', {
      waveNumber: this.waveNumber,
      waveCount: this.waveCount
    });

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
          tower.isInRange(applicant)
        ) {
          multiplier = Math.min(multiplier, tower.definition.slowMultiplier);
        }
      });

      applicant.setSpeedMultiplier(multiplier);
    });
  }

  /**
   * An applicant has been screened out. That is the one thing this department
   * gets paid for, so the bounty goes back into the budget.
   */
  rejectApplicant(applicant) {
    applicant.reject();

    this.rejected += 1;
    this.currency += applicant.definition.bounty;
    this.events.emit('currency-changed', this.currency);
  }

  /**
   * Turns the waypoint data into a Phaser path of straight segments. Phaser
   * spaces points along the whole path by arc length, so a linear tween across
   * it gives a constant walking speed regardless of segment length.
   */
  buildPath() {
    const [start, ...rest] = PATH_WAYPOINTS;
    const path = new Phaser.Curves.Path(start.x, start.y);

    rest.forEach((point) => path.lineTo(point.x, point.y));

    return path;
  }

  /**
   * Stroked as one polyline rather than with path.draw, which strokes each
   * segment separately and leaves notches at every corner.
   */
  drawPath() {
    const graphics = this.add.graphics().setDepth(DEPTHS.board);

    graphics.lineStyle(PATH_WIDTH, PATH_EDGE, 1);
    graphics.strokePoints(PATH_WAYPOINTS, false, false);

    graphics.lineStyle(PATH_WIDTH - 6, PATH_FILL, 1);
    graphics.strokePoints(PATH_WAYPOINTS, false, false);
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
   */
  findBuildableCells() {
    const vacancy = this.path.getEndPoint();
    const columns = Math.floor(this.scale.width / CELL_SIZE);
    const rows = Math.floor(this.scale.height / CELL_SIZE);

    this.buildableCells = new Set();

    for (let gridX = 0; gridX < columns; gridX += 1) {
      for (let gridY = 0; gridY < rows; gridY += 1) {
        const centre = this.cellCentre(gridX, gridY);
        const clearOfPath = this.distanceToPath(centre) >= BUILD_CLEARANCE;
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
   * Shortest distance from a point to the walked path, measured against each
   * segment in turn. Phaser's nearest point helper projects onto the infinite
   * line, so the position along the segment is clamped here.
   */
  distanceToPath(point) {
    let shortest = Infinity;

    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i += 1) {
      const from = PATH_WAYPOINTS[i];
      const to = PATH_WAYPOINTS[i + 1];
      const runX = to.x - from.x;
      const runY = to.y - from.y;
      const lengthSquared = runX * runX + runY * runY;
      const along = Phaser.Math.Clamp(
        ((point.x - from.x) * runX + (point.y - from.y) * runY) / lengthSquared,
        0,
        1
      );

      shortest = Math.min(
        shortest,
        Phaser.Math.Distance.Between(
          point.x,
          point.y,
          from.x + along * runX,
          from.y + along * runY
        )
      );
    }

    return shortest;
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
   * Bakes a plain coloured disc per applicant type. Placeholder art, same as
   * the last step. Kenney sprites replace these later.
   */
  createApplicantTextures() {
    Object.entries(APPLICANTS).forEach(([key, definition]) => {
      const size = definition.radius * 2;
      const graphics = this.add.graphics();

      graphics.fillStyle(definition.colour, 1);
      graphics.fillCircle(definition.radius, definition.radius, definition.radius);
      graphics.generateTexture(this.textureKeyFor(key), size, size);
      graphics.destroy();
    });
  }

  /**
   * Bakes a base per tower type, and a barrel for the ones that shoot. Also
   * placeholder art: a box with a stick on it, which is roughly how the real
   * thing works. Towers that hold a field get a ring instead of a stick.
   */
  createTowerTextures() {
    Object.entries(TOWERS).forEach(([key, definition]) => {
      const size = definition.footprint;
      const base = this.add.graphics();

      base.fillStyle(definition.baseColour, 1);
      base.fillRoundedRect(0, 0, size, size, 8);
      base.lineStyle(2, definition.trimColour, 0.8);
      base.strokeRoundedRect(1, 1, size - 2, size - 2, 8);

      if (definition.behaviour !== 'shoot') {
        base.lineStyle(2, definition.trimColour, 0.9);
        base.strokeCircle(size / 2, size / 2, size * 0.26);
      }

      base.generateTexture(this.towerTextureKeys(key).base, size, size);
      base.destroy();

      if (definition.behaviour !== 'shoot') {
        return;
      }

      const barrelLength = Math.round(size * 0.95);
      const barrelWidth = definition.barrelWidth;
      const barrel = this.add.graphics();

      barrel.fillStyle(definition.trimColour, 1);
      barrel.fillRoundedRect(0, 0, barrelLength, barrelWidth, 3);
      barrel.generateTexture(
        this.towerTextureKeys(key).barrel,
        barrelLength,
        barrelWidth
      );
      barrel.destroy();
    });
  }

  textureKeyFor(typeKey) {
    return `applicant-${typeKey}`;
  }

  towerTextureKeys(typeKey) {
    return {
      base: `tower-${typeKey}-base`,
      barrel: `tower-${typeKey}-barrel`
    };
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
    const { gridX, gridY } = this.cellAt(x, y);
    const definition = TOWERS[this.selectedTowerKey];

    this.ghostRange.clear();

    if (!this.buildableCells.has(this.cellKey(gridX, gridY))) {
      this.hoveredCell = null;
      this.ghost.setVisible(false);

      return;
    }

    const centre = this.cellCentre(gridX, gridY);
    // A cell the budget will not cover reads the same as an occupied one,
    // since neither is going to take a tower on this click.
    const allowed = this.canBuildOn(gridX, gridY) && this.canAfford();
    const tint = allowed ? VALID_TINT : INVALID_TINT;

    this.hoveredCell = { gridX, gridY };

    this.ghost
      .setTexture(this.towerTextureKeys(this.selectedTowerKey).base)
      .setPosition(centre.x, centre.y)
      .setTint(tint)
      .setVisible(true);

    this.ghostRange.lineStyle(1, tint, 0.5);
    this.ghostRange.strokeCircle(centre.x, centre.y, definition.range);
  }

  /**
   * Changes which tower the next click installs. The HUD renders from the
   * event rather than tracking the selection itself, so the two cannot drift.
   */
  selectTower(typeKey) {
    if (this.runOver || !TOWERS[typeKey]) {
      return;
    }

    this.selectedTowerKey = typeKey;
    this.events.emit('tower-selected', typeKey);

    if (this.hoveredCell) {
      const centre = this.cellCentre(
        this.hoveredCell.gridX,
        this.hoveredCell.gridY
      );

      this.updateGhost(centre.x, centre.y);
    }
  }

  canAfford(typeKey = this.selectedTowerKey) {
    return TOWERS[typeKey].cost <= this.currency;
  }

  placeTower(x, y) {
    const { gridX, gridY } = this.cellAt(x, y);

    if (this.runOver || !this.canBuildOn(gridX, gridY)) {
      return;
    }

    const typeKey = this.selectedTowerKey;
    const definition = TOWERS[typeKey];

    if (!this.canAfford(typeKey)) {
      this.events.emit('purchase-failed', typeKey);

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

    tower.setDepth(DEPTHS.towers);

    this.towers.push(tower);
    this.occupiedCells.add(this.cellKey(gridX, gridY));

    this.currency -= definition.cost;
    this.events.emit('currency-changed', this.currency);

    this.drawFields();

    // The cell is taken now, so the ghost under the pointer turns red.
    this.updateGhost(x, y);
  }

  /**
   * The reach of every field tower on the board, drawn under the towers so it
   * is clear where applicants will be held up. Static, so it is redrawn on
   * placement rather than every frame.
   */
  drawFields() {
    this.fieldGraphics.clear();

    this.towers.forEach((tower) => {
      if (tower.definition.behaviour !== 'slow') {
        return;
      }

      this.fieldGraphics.fillStyle(tower.definition.fieldColour, 0.07);
      this.fieldGraphics.fillCircle(tower.x, tower.y, tower.definition.range);

      this.fieldGraphics.lineStyle(1, tower.definition.fieldColour, 0.22);
      this.fieldGraphics.strokeCircle(tower.x, tower.y, tower.definition.range);
    });
  }

  spawnApplicant(typeKey) {
    this.spawnsRemaining = Math.max(0, this.spawnsRemaining - 1);

    const applicant = new Applicant(
      this,
      this.path,
      typeKey,
      APPLICANTS[typeKey],
      this.textureKeyFor(typeKey)
    );

    applicant.setDepth(DEPTHS.applicants);

    this.applicants.add(applicant);
    applicant.walk((arrived) => this.leak(arrived));
  }

  /**
   * An applicant has reached the vacancy, which costs the player a life. The
   * applicant is cleared either way, so a leak arriving during the pause
   * before the game over screen still tidies itself up.
   */
  leak(applicant) {
    applicant.stopFollow();
    this.applicants.remove(applicant, true, true);

    if (this.runOver) {
      return;
    }

    this.lives = Math.max(0, this.lives - GAME.livesPerLeak);
    this.events.emit('lives-changed', this.lives);

    this.refreshVacancy();
    this.showLeak();

    if (this.lives === 0) {
      this.endRun('filled');
    }
  }

  showLeak() {
    const vacancy = this.path.getEndPoint();

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
    this.runOver = true;
    this.phase = 'over';

    this.clearWaveTimers();
    this.clearBanner();

    if (this.prepTimer) {
      this.prepTimer.remove();
    }

    this.ghost.setVisible(false);
    this.ghostRange.clear();

    // Nothing more can be bought, so the HUD stops offering.
    this.events.emit('run-over');

    this.time.delayedCall(GAME_OVER_DELAY_MS, () => {
      this.scene.launch('GameOverScene', {
        outcome,
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

  drawShots(time) {
    this.shotGraphics.clear();
    this.shots = this.shots.filter((shot) => shot.expiresAt > time);

    this.shots.forEach((shot) => {
      const remaining = (shot.expiresAt - time) / shot.durationMs;

      this.shotGraphics.lineStyle(2, shot.colour, remaining);
      this.shotGraphics.lineBetween(shot.x1, shot.y1, shot.x2, shot.y2);
    });
  }

  drawHealthBars(applicants) {
    this.healthGraphics.clear();

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
}

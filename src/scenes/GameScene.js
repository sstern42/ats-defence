import Phaser from 'phaser';

import { APPLICANTS } from '../config/applicants.js';
import { PATH_WAYPOINTS } from '../config/path.js';
import { TOWERS } from '../config/towers.js';
import { COPY } from '../content/copy.js';
import Applicant from '../entities/Applicant.js';
import Tower from '../entities/Tower.js';

const PATH_WIDTH = 44;
const PATH_FILL = 0x232830;
const PATH_EDGE = 0x2f3742;
const VACANCY_SIZE = 54;
const VACANCY_COLOUR = 0xb5553f;

/** Board layout, not balance, so it stays here rather than in config. */
const CELL_SIZE = 64;
const BUILD_CLEARANCE = 48;
const TILE_COLOUR = 0x2b323b;
const VALID_TINT = 0x7fb069;
const INVALID_TINT = 0xb5553f;
const HEALTH_BAR_WIDTH = 24;
const HEALTH_BAR_HEIGHT = 3;

const DEPTHS = {
  board: 0,
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

    this.drawPath();
    this.drawVacancy();
    this.findBuildableCells();
    this.drawBuildableCells();

    this.createApplicantTextures();
    this.createTowerTextures();
    this.createPlacementGhost();

    this.shotGraphics = this.add.graphics().setDepth(DEPTHS.shots);
    this.healthGraphics = this.add.graphics().setDepth(DEPTHS.shots);

    this.add
      .text(16, 14, COPY.hints.placeTower, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#6f7d8c'
      })
      .setDepth(DEPTHS.hint);

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) =>
      this.updateGhost(pointer.worldX, pointer.worldY)
    );

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) =>
      this.placeTower(pointer.worldX, pointer.worldY)
    );

    this.time.addEvent({
      delay: APPLICANTS.graduate.spawnIntervalMs,
      callback: () => this.spawnApplicant('graduate'),
      loop: true,
      startAt: APPLICANTS.graduate.spawnIntervalMs - 400
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.applicants.clear(true, true);
      this.towers = [];
    });
  }

  update(time) {
    const applicants = this.applicants.getChildren();

    this.towers.forEach((tower) => {
      const target = tower.update(time, applicants);

      if (!target) {
        return;
      }

      this.recordShot(tower, target, time);

      if (target.takeDamage(tower.definition.damage)) {
        target.reject();
      }
    });

    this.drawShots(time);
    this.drawHealthBars(applicants);
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
    const graphics = this.add.graphics().setDepth(DEPTHS.board);

    graphics.fillStyle(VACANCY_COLOUR, 0.18);
    graphics.fillRect(
      vacancy.x - VACANCY_SIZE / 2,
      vacancy.y - VACANCY_SIZE / 2,
      VACANCY_SIZE,
      VACANCY_SIZE
    );

    graphics.lineStyle(2, VACANCY_COLOUR, 1);
    graphics.strokeRect(
      vacancy.x - VACANCY_SIZE / 2,
      vacancy.y - VACANCY_SIZE / 2,
      VACANCY_SIZE,
      VACANCY_SIZE
    );
  }

  /**
   * Works out once, at boot, which grid cells a tower may sit on. A cell is
   * buildable if its centre is clear of both the path and the vacancy.
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

        if (clearOfPath && clearOfVacancy) {
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
   * Bakes a base and a barrel per tower type. Also placeholder art: a box with
   * a stick on it, which is roughly how the real thing works.
   */
  createTowerTextures() {
    Object.entries(TOWERS).forEach(([key, definition]) => {
      const size = definition.footprint;
      const base = this.add.graphics();

      base.fillStyle(definition.baseColour, 1);
      base.fillRoundedRect(0, 0, size, size, 8);
      base.lineStyle(2, definition.trimColour, 0.8);
      base.strokeRoundedRect(1, 1, size - 2, size - 2, 8);
      base.generateTexture(this.towerTextureKeys(key).base, size, size);
      base.destroy();

      const barrelLength = Math.round(size * 0.95);
      const barrelWidth = 8;
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
      .image(0, 0, this.towerTextureKeys('keywordFilter').base)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0.5)
      .setVisible(false)
      .setDepth(DEPTHS.overlay);

    this.ghostRange = this.add.graphics().setDepth(DEPTHS.overlay);
  }

  updateGhost(x, y) {
    const { gridX, gridY } = this.cellAt(x, y);

    this.ghostRange.clear();

    if (!this.buildableCells.has(this.cellKey(gridX, gridY))) {
      this.hoveredCell = null;
      this.ghost.setVisible(false);

      return;
    }

    const centre = this.cellCentre(gridX, gridY);
    const buildable = this.canBuildOn(gridX, gridY);
    const tint = buildable ? VALID_TINT : INVALID_TINT;

    this.hoveredCell = { gridX, gridY };

    this.ghost.setPosition(centre.x, centre.y).setTint(tint).setVisible(true);

    this.ghostRange.lineStyle(1, tint, 0.5);
    this.ghostRange.strokeCircle(
      centre.x,
      centre.y,
      TOWERS.keywordFilter.range
    );
  }

  placeTower(x, y) {
    const { gridX, gridY } = this.cellAt(x, y);

    if (!this.canBuildOn(gridX, gridY)) {
      return;
    }

    const centre = this.cellCentre(gridX, gridY);
    const tower = new Tower(
      this,
      centre.x,
      centre.y,
      'keywordFilter',
      TOWERS.keywordFilter,
      this.towerTextureKeys('keywordFilter')
    );

    tower.setDepth(DEPTHS.towers);

    this.towers.push(tower);
    this.occupiedCells.add(this.cellKey(gridX, gridY));

    // The cell is taken now, so the ghost under the pointer turns red.
    this.updateGhost(x, y);
  }

  spawnApplicant(typeKey) {
    const applicant = new Applicant(
      this,
      this.path,
      typeKey,
      APPLICANTS[typeKey],
      this.textureKeyFor(typeKey)
    );

    applicant.setDepth(DEPTHS.applicants);

    this.applicants.add(applicant);
    applicant.walk((arrived) => this.removeApplicant(arrived));
  }

  /**
   * Reaching the vacancy currently costs nothing. Lives and the game over
   * state arrive at step five.
   */
  removeApplicant(applicant) {
    applicant.stopFollow();
    this.applicants.remove(applicant, true, true);
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

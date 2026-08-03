import Phaser from 'phaser';

import { APPLICANTS } from '../config/applicants.js';
import { PATH_WAYPOINTS } from '../config/path.js';
import Applicant from '../entities/Applicant.js';

const PATH_WIDTH = 44;
const PATH_FILL = 0x232830;
const PATH_EDGE = 0x2f3742;
const VACANCY_SIZE = 54;
const VACANCY_COLOUR = 0xb5553f;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.path = this.buildPath();
    this.applicants = this.add.group();

    this.drawPath();
    this.drawVacancy();
    this.createApplicantTextures();

    this.time.addEvent({
      delay: APPLICANTS.graduate.spawnIntervalMs,
      callback: () => this.spawnApplicant('graduate'),
      loop: true,
      startAt: APPLICANTS.graduate.spawnIntervalMs - 400
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.applicants.clear(true, true);
    });
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
    const graphics = this.add.graphics();

    graphics.lineStyle(PATH_WIDTH, PATH_EDGE, 1);
    graphics.strokePoints(PATH_WAYPOINTS, false, false);

    graphics.lineStyle(PATH_WIDTH - 6, PATH_FILL, 1);
    graphics.strokePoints(PATH_WAYPOINTS, false, false);
  }

  drawVacancy() {
    const vacancy = this.path.getEndPoint();
    const graphics = this.add.graphics();

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

  textureKeyFor(typeKey) {
    return `applicant-${typeKey}`;
  }

  spawnApplicant(typeKey) {
    const applicant = new Applicant(
      this,
      this.path,
      typeKey,
      APPLICANTS[typeKey],
      this.textureKeyFor(typeKey)
    );

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
}

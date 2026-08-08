import Phaser from 'phaser';

import { ART_DIRECTORY, ART_KEYS } from '../../config/art.js';
import { APPLICANTS } from '../../config/applicants.js';
import {
  MOBILE_RUN,
  MOBILE_TOWER,
  MOBILE_TOWER_KEY
} from '../../config/mobile.js';
import { RADIAL_BOARD } from '../../config/path.js';
// `hasArrived` is not wanted here. The walk is a tween and it ends at the
// arrival point, so the applicant says when it got there rather than the scene
// testing a distance every frame to find out.
import { arrivalPoint, spawnPoint } from '../../services/radial.js';
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
 * What this is not, yet: there are no waves, no HUD, no upgrade cards, no
 * scoring, no game over screen and no analytics. Applicants arrive on a timer
 * and the run stops when the tower runs out. Each of those is its own step, and
 * this is the one that puts a board on a screen.
 */

/** The applicant types, cycled in order so all six are visible on a preview. */
const TYPES = Object.keys(APPLICANTS);

const FONT = 'system-ui, sans-serif';

export default class MobileGameScene extends Phaser.Scene {
  constructor() {
    super('MobileGameScene');
  }

  preload() {
    // Loaded here rather than through BootScene, which also pulls in the
    // sounds, the music, the intros and the scenery none of this uses yet. The
    // manifest is still the one source of what the art is.
    ART_KEYS.forEach((key) => {
      this.load.image(key, `${ART_DIRECTORY}${key}.png`);
    });
  }

  create() {
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
    this.rejected = 0;
    this.arrived = 0;
    this.over = false;
    this.nextType = 0;

    const { centre } = RADIAL_BOARD;
    const definition = MOBILE_TOWER;

    this.range = this.add.graphics().setDepth(0);
    this.range.lineStyle(1, definition.tracerColour, 0.18);
    this.range.strokeCircle(centre.x, centre.y, definition.range);

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
    this.bar = this.add.graphics().setDepth(30);

    this.spawner = this.time.addEvent({
      delay: MOBILE_RUN.spawnIntervalMs,
      loop: true,
      callback: () => this.spawn()
    });

    // Diagnostic, not the HUD. The HUD is a wave counter and one bar and it is
    // its own step, with its own copy. This is here so the preview can be read.
    this.readout = this.add
      .text(20, 20, '', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#e8ecf2',
        backgroundColor: '#000000a0',
        padding: { x: 12, y: 10 },
        lineSpacing: 4
      })
      .setDepth(100);
  }

  update(time) {
    if (!this.over) {
      this.fire(time);
    }

    this.drawTracers(time);
    this.drawBar();
    this.refreshReadout();
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
  spawn() {
    if (this.over) {
      return;
    }

    const typeKey = TYPES[this.nextType % TYPES.length];
    const definition = APPLICANTS[typeKey];

    this.nextType += 1;

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

    applicant.setDepth(5);
    applicant.walk((who) => this.arrive(who));

    this.applicants.push(applicant);
  }

  /**
   * Somebody got in. The tower takes it rather than a life counter, because in
   * this design the tower is the thing the player is defending and the thing
   * they are shown.
   */
  arrive(applicant) {
    this.drop(applicant);
    applicant.destroy();

    this.arrived += 1;
    this.health = Math.max(0, this.health - MOBILE_RUN.arrivalCost);

    if (this.health === 0) {
      this.end();
    }
  }

  // -------------------------------------------------------------------- firing

  fire(time) {
    const target = this.tower.update(time, this.applicants);

    if (!target) {
      return;
    }

    this.recordShot(target, time);

    if (target.takeDamage(this.tower.rollDamage())) {
      this.reject(target);
    }
  }

  /**
   * A rejection. `Applicant.reject` fades it out and destroys itself when the
   * fade finishes, so nothing here waits for it. It comes off the list straight
   * away so the tower stops aiming at somebody already on the way out.
   */
  reject(applicant) {
    this.drop(applicant);
    applicant.reject();

    this.rejected += 1;
  }

  drop(applicant) {
    const index = this.applicants.indexOf(applicant);

    if (index !== -1) {
      this.applicants.splice(index, 1);
    }
  }

  end() {
    this.over = true;
    this.spawner.remove();

    // Everybody still walking is left where they are. There is no game over
    // screen yet and inventing one here would be the wrong step doing two jobs.
    this.tower.base.setAlpha(0.3);
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

  /** The one bar the design asks for, under the thing it belongs to. */
  drawBar() {
    const width = 120;
    const height = 8;
    const left = this.tower.x - width / 2;
    const top = this.tower.y + 40;

    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.5);
    this.bar.fillRect(left, top, width, height);
    const fraction = this.health / MOBILE_RUN.towerHealth;

    this.bar.fillStyle(fraction > 0.3 ? 0x6ad98f : 0xd96a6a);
    this.bar.fillRect(left, top, width * fraction, height);
  }

  refreshReadout() {
    this.readout.setText(
      [
        `tower     ${this.health} / ${MOBILE_RUN.towerHealth}`,
        `standing  ${this.applicants.length}`,
        `rejected  ${this.rejected}`,
        `got in    ${this.arrived}`,
        this.over ? 'position filled' : ''
      ].join('\n')
    );
  }
}

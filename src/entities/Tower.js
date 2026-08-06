import Phaser from 'phaser';

import { FEEL, landing, nudge } from '../services/feel.js';

/**
 * How big the barrel is drawn against the base it is bolted to. Kenney draws
 * them at close to the same size, which at board scale leaves a grey gun
 * covering a coloured body and six towers that all look alike. Shrinking the
 * gun puts the type's colour back around the outside, where it can be read at
 * a glance.
 */
const BARREL_SCALE = 0.8;

/**
 * How faded a tower looks while it is suspended, and while it is a Video Screen
 * with nobody next to it. Both are the same statement, that this thing is not
 * currently doing its job, so they are drawn the same way and the more serious
 * one wins where both apply.
 */
const SUSPENDED_ALPHA = 0.3;
const UNPAIRED_ALPHA = 0.72;

/**
 * A screening mechanism sat on the board, working on applicants that stray
 * into range.
 *
 * The tower is a container so the barrel can turn towards its target while the
 * base stays put. Towers that do not shoot have no barrel to turn.
 *
 * A shooting tower decides what to shoot and when, but it does not apply the
 * damage itself. `update` returns the applicant it has just hit, and the scene
 * deals with the consequences.
 */
export default class Tower extends Phaser.GameObjects.Container {
  constructor(scene, x, y, typeKey, definition, textureKeys) {
    super(scene, x, y);

    this.typeKey = typeKey;
    this.definition = definition;
    this.nextFireAt = 0;

    // The cell this one sits on, so the scene can work out which towers are
    // neighbours, and whether anybody is next to a Video Screen.
    this.gridX = 0;
    this.gridY = 0;
    this.adjacent = false;

    // How much leaning on it this one will take, and whether it has stopped
    // working for the moment. Only read in the mode where applicants push back,
    // and left alone entirely in the one where they do not, so a classic tower
    // sits at full integrity for the whole run and never notices any of this.
    this.maxIntegrity = definition.integrity ?? 0;
    this.integrity = this.maxIntegrity;
    this.suspended = false;
    this.suspendedUntil = 0;

    // The base carries the type's colour, the barrel is left as it came, which
    // is grey. Colouring both makes a tower one shape at board size.
    this.base = scene.add
      .image(0, 0, textureKeys.base)
      .setTint(definition.bodyTint)
      .setDisplaySize(definition.footprint, definition.footprint);
    this.add(this.base);

    // Whether there is a barrel is a question for the art, not the behaviour.
    // The Take-Home Task has one and never turns it, and the trap has none.
    if (textureKeys.barrel) {
      this.barrel = scene.add.image(0, 0, textureKeys.barrel);
      // The art points right and mounts near its left edge, so this is the
      // collar it swings around rather than the middle of the gun.
      this.barrel.setOrigin(0.12, 0.5);
      this.barrel.setScale(BARREL_SCALE);
      this.add(this.barrel);
    }

    scene.add.existing(this);

    // Installed rather than simply present. The container is scaled, so the
    // base and the barrel arrive together as one thing.
    landing(this);
  }

  /**
   * Turns towards a target and fires if the reload has finished. Returns the
   * applicant that was hit, or null if there was nothing to shoot at, the
   * tower is still reloading, or it is not the shooting sort.
   */
  update(time, applicants) {
    if (this.definition.behaviour !== 'shoot' || this.suspended) {
      return null;
    }

    const target = this.findTarget(applicants);

    if (!target) {
      return null;
    }

    this.barrel.setRotation(
      Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y)
    );

    if (time < this.nextFireAt) {
      return null;
    }

    this.nextFireAt = time + this.definition.fireIntervalMs;

    this.kick();

    return target;
  }

  /**
   * The barrel coming back as it fires, along whatever line it is pointing
   * down. It is a local offset inside the container, so the base it is bolted
   * to stays exactly where the player put it.
   *
   * A tower with the shortest reload in the game fires slower than this
   * settles, so a barrel is never kicked while it is still coming home.
   */
  kick() {
    const angle = this.barrel.rotation;

    nudge(
      this.barrel,
      -Math.cos(angle) * FEEL.recoil,
      -Math.sin(angle) * FEEL.recoil
    );
  }

  /**
   * Picks the applicant in range that is furthest along the path, which is the
   * one about to become the player's problem.
   *
   * A type that this tower is the answer to jumps the queue whatever the
   * ordering says, which is how the Knockout Question finds The Overqualified
   * before anybody else.
   */
  findTarget(applicants) {
    let target = null;
    let targetPreferred = false;

    applicants.forEach((applicant) => {
      if (
        !applicant.active ||
        !this.canTarget(applicant) ||
        !this.isInRange(applicant)
      ) {
        return;
      }

      const preferred = applicant.definition.priorityFor === this.typeKey;

      if (
        !target ||
        (preferred && !targetPreferred) ||
        (preferred === targetPreferred && applicant.progress > target.progress)
      ) {
        target = applicant;
        targetPreferred = preferred;
      }
    });

    return target;
  }

  /**
   * Whether this tower has anything to say about an applicant. A type that is
   * immune to it is not aimed at, since a tracer that lands and does nothing
   * looks like a bug rather than a joke.
   */
  canTarget(applicant) {
    const immuneTo = applicant.definition.immuneTo;

    return !immuneTo || !immuneTo.includes(this.typeKey);
  }

  isInRange(applicant) {
    return (
      Phaser.Math.Distance.Between(this.x, this.y, applicant.x, applicant.y) <=
      this.definition.range
    );
  }

  /**
   * What a single hit is worth. Flat, unless the definition gives a range to
   * roll between, and with the adjacency bonus on top while there is another
   * tower on a neighbouring tile.
   */
  rollDamage() {
    const { damage, damageMin, damageMax, adjacencyBonus } = this.definition;
    const rolled =
      damageMin === undefined
        ? damage
        : Phaser.Math.Between(damageMin, damageMax);

    return this.adjacent && adjacencyBonus ? rolled + adjacencyBonus : rolled;
  }

  /**
   * Told by the scene whenever the board changes. The trim brightens when the
   * bonus is live, so a Video Screen that is on its own is obvious.
   */
  setAdjacent(adjacent) {
    this.adjacent = adjacent;

    this.refreshLook();
  }

  /**
   * Somebody has leaned on this tower, or nobody has and it is coming back to
   * itself. A positive amount is damage and a negative one is recovery, so the
   * scene works out the net for a frame and calls this once rather than calling
   * two methods that would fight over the same number.
   *
   * Returns true only on the transition to nothing left, so the scene suspends
   * it once rather than on every frame it spends at zero.
   */
  applyPressure(amount) {
    if (this.maxIntegrity === 0 || this.suspended) {
      return false;
    }

    const before = this.integrity;

    this.integrity = Phaser.Math.Clamp(
      this.integrity - amount,
      0,
      this.maxIntegrity
    );

    return this.integrity === 0 && before > 0;
  }

  /**
   * Off the board pending a review it will pass, since nobody is going to find
   * anything wrong with a process that is working as specified. It shoots
   * nothing, slows nobody and pays no adjacency bonus until it is back.
   */
  suspend(time, durationMs) {
    this.suspended = true;
    this.suspendedUntil = time + durationMs;
    this.integrity = 0;

    this.refreshLook();
  }

  /**
   * The review found nothing. Back at full integrity, having learned nothing.
   */
  restore() {
    this.suspended = false;
    this.suspendedUntil = 0;
    this.integrity = this.maxIntegrity;

    this.refreshLook();
  }

  /**
   * How much of the suspension is left, from 1 down to 0. Drawn as the bar
   * under a suspended tower, so the wait is a countdown rather than a mystery.
   */
  suspensionRemaining(time, durationMs) {
    if (!this.suspended || durationMs <= 0) {
      return 0;
    }

    return Phaser.Math.Clamp((this.suspendedUntil - time) / durationMs, 0, 1);
  }

  /**
   * The two reasons a tower is drawn faded, decided in one place so they cannot
   * end up writing over each other. Suspension wins, since a suspended Video
   * Screen is not doing its job for a more pressing reason than loneliness.
   */
  refreshLook() {
    if (this.suspended) {
      this.base.setAlpha(SUSPENDED_ALPHA);

      return;
    }

    if (this.definition.adjacencyBonus) {
      this.base.setAlpha(this.adjacent ? 1 : UNPAIRED_ALPHA);

      return;
    }

    this.base.setAlpha(1);
  }
}

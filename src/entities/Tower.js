import Phaser from 'phaser';

/**
 * How big the barrel is drawn against the base it is bolted to. Kenney draws
 * them at close to the same size, which at board scale leaves a grey gun
 * covering a coloured body and six towers that all look alike. Shrinking the
 * gun puts the type's colour back around the outside, where it can be read at
 * a glance.
 */
const BARREL_SCALE = 0.8;

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
  }

  /**
   * Turns towards a target and fires if the reload has finished. Returns the
   * applicant that was hit, or null if there was nothing to shoot at, the
   * tower is still reloading, or it is not the shooting sort.
   */
  update(time, applicants) {
    if (this.definition.behaviour !== 'shoot') {
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

    return target;
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

    if (this.definition.adjacencyBonus) {
      this.base.setAlpha(adjacent ? 1 : 0.72);
    }
  }
}

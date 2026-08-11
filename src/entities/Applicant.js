import Phaser from 'phaser';

import { pulse } from '../services/feel.js';

/**
 * How far an applicant flinches when a hit lands and it is still walking. It is
 * the only thing on the board that says a shot connected with somebody who can
 * take it, since the health bar only appears once they are already hurt.
 */
const FLINCH = 1.22;

/**
 * How much bigger than the old disc an applicant is drawn. A sprite with a
 * soft edge reads smaller than a solid circle of the same size, so matching
 * `radius` exactly makes everybody look as though they have shrunk.
 */
const SPRITE_SCALE = 1.25;

/**
 * An applicant walking the path towards the vacancy.
 *
 * Movement is handled by Phaser's PathFollower, which is driven by a tween
 * from the start of the path to the end. Speed is held in the config as pixels
 * per second, since that is the useful unit for balancing, and converted to a
 * duration here once the path length is known.
 */
export default class Applicant extends Phaser.GameObjects.PathFollower {
  constructor(scene, path, typeKey, definition, textureKey) {
    const start = path.getStartPoint();

    super(scene, path, start.x, start.y, textureKey);

    this.typeKey = typeKey;
    this.definition = definition;
    this.health = definition.health;
    this.maxHealth = definition.health;
    this.speedMultiplier = 1;

    // Set by the scene when this one is a Boomerang coming back, so it is not
    // queued up to come back a second time.
    this.hasReturned = false;

    // The art is shared and greyscale, so the type's colour is what tells one
    // applicant from another. Sizing off the sprite rather than off a number
    // in the config means a type can be given different art without also
    // needing its radius retuned.
    //
    // Scaled to cover the area the old disc covered, rather than to match it
    // on one side. The sprites are not all the same shape: a vehicle is half
    // as long again as it is wide, and matching heights makes it enormous
    // while matching lengths makes it a sliver. Area is the only measure that
    // gives a walking applicant the same visual weight whichever it is drawn
    // with.
    const area = (definition.radius * 2 * SPRITE_SCALE) ** 2;

    this.setTint(definition.colour);
    this.setScale(Math.sqrt(area / (this.width * this.height)));

    // The size they walk at, written down rather than read back off the sprite,
    // which is briefly a different size every time they are hit.
    this.baseScale = this.scale;

    scene.add.existing(this);
  }

  /**
   * How far along the path the applicant is, from 0 to 1.
   */
  get progress() {
    return this.pathTween ? this.pathTween.getValue() : 0;
  }

  /**
   * How far there is left to walk, in pixels. Towers use it to pick the
   * applicant closest to the vacancy, which is the one worth shooting first.
   *
   * The fraction above used to be what they compared, which was the same
   * ordering back when everybody walked one shared path. It stopped being the
   * same ordering the moment two applicants could be on routes of different
   * lengths, and it stopped being an ordering at all once a route could be
   * rebuilt mid walk: a re-routed applicant is at nought again on a shorter
   * path, and would jump to the back of every queue on the board. Distance left
   * is the thing that was actually meant all along.
   */
  get remaining() {
    return this.pathTween
      ? this.path.getLength() * (1 - this.pathTween.getValue())
      : Infinity;
  }

  /**
   * Sets the applicant walking. `onArrival` fires if it reaches the vacancy,
   * which costs the player a life.
   *
   * A type with `spawnProgress` joins the path partway along rather than at the
   * start, which is what a referral is. Only the distance left counts towards
   * the duration, so starting further on does not also mean walking slower.
   */
  walk(onArrival) {
    // Held so a re-route can hand the same callback to the new walk. There is
    // only ever one way off the end of a path and it is still this one.
    this.onArrival = onArrival;

    const from = this.definition.spawnProgress ?? 0;
    const remaining = this.path.getLength() * (1 - from);
    const durationMs = (remaining / this.definition.speed) * 1000;

    this.startFollow({
      from,
      to: 1,
      duration: durationMs,
      positionOnPath: true,
      // Every applicant sprite is drawn facing right, so following the path's
      // angle points them the way they are walking with no offset to apply.
      rotateToPath: true,
      ease: 'Linear',
      onComplete: () => {
        onArrival(this);
      }
    });

    // startFollow puts the follower on the start of the path whatever `from`
    // says, so a late joiner is moved up by hand rather than being seen at the
    // gate for a frame.
    if (from > 0) {
      const entry = this.path.getPoint(from);

      this.setPosition(entry.x, entry.y);
    }

    return this;
  }

  /**
   * The applicant has changed its mind about the way in.
   *
   * Only the back channel calls this, and only when a tower has just been
   * installed, since that is the only thing on any board that can change what a
   * route costs. The new path starts where the applicant is standing rather
   * than where it came in, so nobody is teleported and nobody walks back to the
   * gate to start again.
   *
   * The speed multiplier is put back on by hand. The walk is a tween and a slow
   * field works by scaling that tween's clock, so a new tween arrives at full
   * speed however deep in a Take-Home Task's field the applicant is standing.
   * The field itself would not notice: it only calls setSpeedMultiplier when
   * the multiplier changes, and as far as it is concerned nothing has.
   */
  reroute(points) {
    if (!this.active || !this.pathTween || points.length === 0) {
      return;
    }

    const path = new Phaser.Curves.Path(this.x, this.y);

    points.forEach((point) => path.lineTo(point.x, point.y));

    const durationMs = (path.getLength() / this.definition.speed) * 1000;

    // The walk being replaced is thrown away rather than merely stopped. See
    // destroy below for why stopping one is not enough: `setPath` stops the old
    // tween and then overwrites the only reference to it, so without this every
    // re-route leaves one behind, and this mode re-routes everybody on the board
    // every time a tower goes down.
    this.releasePathTween();

    this.setPath(path, {
      from: 0,
      to: 1,
      duration: durationMs,
      positionOnPath: true,
      rotateToPath: true,
      ease: 'Linear',
      onComplete: () => {
        this.onArrival(this);
      }
    });

    this.pathTween.setTimeScale(this.speedMultiplier);
  }

  /**
   * Slows the applicant down, or lets it back up to full speed with a
   * multiplier of 1. The walk is a tween, so scaling the tween's clock scales
   * the walking speed without touching the path or the remaining distance.
   */
  setSpeedMultiplier(multiplier) {
    if (!this.pathTween || multiplier === this.speedMultiplier) {
      return;
    }

    this.speedMultiplier = multiplier;
    this.pathTween.setTimeScale(multiplier);
  }

  /**
   * Returns true if that was the hit that finished them off.
   *
   * Anybody still standing flinches. Anybody who is not is about to be rejected
   * by the scene, which has a better exit of its own, so there is no point
   * starting a flinch that would be taken straight back off again.
   *
   * `fromKey` is the tower type the hit came from, where there is one, and it is
   * what `damageFrom` on the definition is read against. A type with no such map
   * takes the number it was handed, which is every type but one and is what this
   * method did before the map existed. Anything with no tower behind it, which is
   * to say the phone board's bulk reject, hands nothing over and is worth its
   * full amount against everybody: immunity here is a property of an applicant
   * against a named screening process, and a mail merge is not one.
   *
   * A hit worth nothing does not flinch. The scene will not have aimed at
   * anybody it cannot touch, so this only comes up for a pad that has been
   * trodden on, and a body twitching under a question that did nothing to it is
   * the animation saying the opposite of what happened.
   */
  takeDamage(amount, fromKey) {
    const scaled = amount * (this.definition.damageFrom?.[fromKey] ?? 1);

    if (scaled === 0) {
      return false;
    }

    this.health = Math.max(0, this.health - scaled);

    if (this.health > 0) {
      pulse(this, FLINCH);
    }

    return this.health === 0;
  }

  /**
   * Rejection. The applicant stops walking immediately and fades out, and the
   * game object destroys itself once the fade finishes. Inactive applicants
   * are ignored by targeting, so nothing shoots a corpse.
   */
  reject() {
    this.stopFollow();
    this.setActive(false);

    // A flinch from the hit that did it may still be running, so it is taken
    // off and they go out from the size they walked at.
    this.scene.tweens.killTweensOf(this);
    this.setScale(this.baseScale);

    // Relative to whatever the sprite was already scaled to, since that is no
    // longer 1 and a fixed target would make small applicants jump on the way
    // out.
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.baseScale * 1.8,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy()
    });
  }

  /**
   * Throws away the tween that was doing the walking, if there is one.
   *
   * Phaser's PathFollower builds its tween with `persist: true`, which means the
   * tween manager will not clear it up on its own: a persistent tween is the
   * owner's to destroy, and the owner here is us. `stopFollow` stops it and
   * leaves it in the manager, so an applicant that is rejected, walks in or is
   * re-routed leaves a finished tween behind for the rest of the run.
   *
   * That costs almost nothing per frame, since a finished tween returns out of
   * `update` immediately. What it costs is memory, and worse than the tween's
   * own: the tween holds the `onComplete` handed to `walk`, that closure holds
   * the applicant, and so every applicant a run has ever sent is still reachable
   * at the end of it. On the two boards that matter, the one that re-routes
   * everybody on every placement and the one that sends hundreds an intake,
   * that is the largest thing a long run accumulates.
   *
   * `persist` is cleared before the destroy rather than left alone, and that
   * order is the whole of why this works. The manager decides whether to drop a
   * tween from its list by what `Tween.update` returns, and a persistent tween
   * answers "keep me" whether it is finished, pending removal or already
   * destroyed. Destroying it alone would free everything it holds, which is the
   * part that matters, and still leave the husk on the list to be stepped for
   * the rest of the run.
   */
  releasePathTween() {
    if (this.pathTween) {
      this.pathTween.persist = false;
      this.pathTween.destroy();
      this.pathTween = null;
    }
  }

  /**
   * The walk goes with the walker. Phaser does not do this for us, for the
   * reason written out above.
   */
  destroy(fromScene) {
    this.releasePathTween();

    super.destroy(fromScene);
  }
}

import Phaser from 'phaser';

/**
 * The measurement harness for issue #47.
 *
 * Every performance claim in MOBILE-AUDIT.md is reasoning about algorithmic
 * shape rather than a measurement, because no phone has ever been allowed to
 * run this game. This scene is the thing that turns those claims into numbers.
 * It is not the mobile game and it is not the start of one: it draws applicants
 * converging on a point and reads the frame time back, and that is the whole of
 * what it does.
 *
 * It answers one question. How many applicants will a real handset hold at 60
 * frames a second, and which of the four things the audit blames actually costs
 * anything.
 *
 * The four are toggles rather than a single before and after, because a rewrite
 * justified by "the new shape is faster" is worth much less than one that knows
 * which part of the old shape was the problem. They default to what the game
 * currently does, so the first reading off a device is the shipped shape and
 * every toggle moves away from it.
 *
 * What this deliberately leaves out: towers, targeting, health bars, tracers,
 * impacts and the HUD. So the number it reports is optimistic and is a ceiling
 * rather than a budget. It is still the only real number anybody has.
 */

/**
 * The portrait backing store, and the audit's suggested analogue of the
 * existing fixed 1024 by 768.
 *
 * The renderer is left on AUTO rather than forced to WebGL, which is the
 * opposite of what the audit recommends for the real build. That is on purpose
 * here: whether a handset falls back to canvas is one of the things worth
 * finding out, and forcing WebGL would hide it. The readout says which one it
 * got.
 */
export const BENCH_SIZE = { width: 720, height: 1280 };

const CENTRE = { x: BENCH_SIZE.width / 2, y: BENCH_SIZE.height / 2 };

/** Where they walk in from. Far enough out to leave the middle third clear. */
const SPAWN_RADIUS = 420;

/** How close to the middle counts as having arrived. */
const ARRIVAL = 24;

/**
 * The six applicant sprites, loaded straight from the manifest's directory
 * rather than through BootScene, which would also pull in the sounds, the
 * intros, the textures and the scenery this has no use for.
 *
 * They are the real art at the real sizes because the six-textures-versus-one
 * question is one of the four toggles, and a generated square would answer it
 * wrongly.
 */
const SPRITES = [
  'unit-round',
  'unit-finned',
  'unit-plain',
  'unit-slim',
  'vehicle-wide',
  'vehicle-boxy'
];

/**
 * Tiers, standing in for the colour coding the design asks for. The numbers are
 * lifted from applicants.js so the sprites are scaled and tinted the way the
 * real ones are, but nothing here is balance and none of it is read by the game.
 */
const TIERS = [
  { colour: 0xc7d94a, radius: 11, speed: 110 },
  { colour: 0x6a8fd9, radius: 15, speed: 55 },
  { colour: 0xd9c46a, radius: 10, speed: 190 },
  { colour: 0xd96a9b, radius: 12, speed: 95 },
  { colour: 0x9b6ad9, radius: 12, speed: 120 },
  { colour: 0x6ad9c4, radius: 12, speed: 105 }
];

/** Matches Applicant.js, so a sprite here is the size it is in the game. */
const SPRITE_SCALE = 1.25;

/**
 * What fraction of the standing population is rejected per second.
 *
 * Deaths are most of the point. The audit's charge against the current entity
 * lifecycle is allocation churn, and a bench where nobody ever dies would never
 * touch it. Half the crowd a second is roughly what an auto-firing tower in a
 * 300-applicant design implies.
 */
const KILL_PER_SECOND = 0.5;

/** The counts the buttons and the ramp step through. */
const STEPS = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000];

/** 60 frames a second, which is what the ramp is looking for. */
const BUDGET_MS = 1000 / 60;

/** How long the ramp holds a count before deciding whether it held up. */
const RAMP_HOLD_MS = 3000;

/**
 * How long after a count change samples are thrown away.
 *
 * Adding two hundred sprites costs a frame far more than holding two hundred
 * does, and a worst-frame figure that is always the frame the count changed on
 * measures the button rather than the device.
 */
const SETTLE_MS = 500;

/** The readout is a Text, and a Text is a texture upload, so it is not redrawn
 * every frame. Four times a second is readable and costs nothing measurable. */
const READOUT_MS = 250;

const FONT = 'system-ui, sans-serif';

export default class BenchScene extends Phaser.Scene {
  constructor() {
    super('BenchScene');
  }

  preload() {
    SPRITES.forEach((key) => {
      this.load.image(key, `assets/kenney/${key}.png`);
    });
  }

  create() {
    /**
     * The shape under test. The defaults are what the game does today, so the
     * first number off a handset is the shipped shape rather than a proposal.
     */
    this.shape = {
      depthSort: true,
      tweened: true,
      pooled: false,
      oneTexture: false
    };

    this.live = [];
    this.free = [];
    this.stepIndex = STEPS.indexOf(200);
    this.targetCount = STEPS[this.stepIndex];

    this.samples = [];
    this.settleUntil = 0;
    this.ramping = false;
    this.rampUntil = 0;
    this.rampResult = null;
    this.readoutAt = 0;

    this.buildInterface();
  }

  // ---------------------------------------------------------------- interface

  buildInterface() {
    this.readout = this.add
      .text(24, 24, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#e8ecf2',
        backgroundColor: '#000000a0',
        padding: { x: 14, y: 12 },
        lineSpacing: 6
      })
      .setDepth(100000);

    this.toggleButtons = new Map();

    const keys = ['depthSort', 'tweened', 'pooled', 'oneTexture'];
    const labels = {
      depthSort: 'depth sort',
      tweened: 'tweened walk',
      pooled: 'pooled',
      oneTexture: 'one texture'
    };

    keys.forEach((key, index) => {
      const button = this.button(
        24 + (index % 2) * 340,
        BENCH_SIZE.height - 300 + Math.floor(index / 2) * 84,
        320,
        labels[key],
        () => {
          this.shape[key] = !this.shape[key];
          this.rebuild();
        }
      );

      this.toggleButtons.set(key, button);
    });

    this.button(24, BENCH_SIZE.height - 128, 150, '- fewer', () =>
      this.step(-1)
    );

    this.button(190, BENCH_SIZE.height - 128, 150, '+ more', () => this.step(1));

    this.rampButton = this.button(
      356,
      BENCH_SIZE.height - 128,
      340,
      'find the floor',
      () => this.toggleRamp()
    );
  }

  button(x, y, width, label, onPress) {
    const button = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#e8ecf2',
        backgroundColor: '#2b3240',
        fixedWidth: width,
        align: 'center',
        padding: { x: 12, y: 18 }
      })
      .setDepth(100000)
      .setInteractive({ useHandCursor: true });

    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onPress);

    return button;
  }

  // ------------------------------------------------------------------ control

  step(direction) {
    this.stopRamp();
    this.setStep(this.stepIndex + direction);
  }

  setStep(index) {
    this.stepIndex = Phaser.Math.Clamp(index, 0, STEPS.length - 1);
    this.targetCount = STEPS[this.stepIndex];
    this.settle();
  }

  /**
   * The ramp. Holds a count for three seconds, and if the mean frame time over
   * that window was inside the budget it steps up and holds again. The moment
   * one is missed it stops and keeps the last count that held, which is the
   * number this whole scene exists to produce.
   */
  toggleRamp() {
    if (this.ramping) {
      this.stopRamp();

      return;
    }

    this.ramping = true;
    this.rampResult = null;
    this.setStep(0);
    this.rampUntil = this.time.now + RAMP_HOLD_MS;
  }

  stopRamp() {
    this.ramping = false;
  }

  checkRamp(now) {
    if (!this.ramping || now < this.rampUntil) {
      return;
    }

    const held = this.mean() <= BUDGET_MS;

    if (!held || this.stepIndex === STEPS.length - 1) {
      // Both halves are reported, because where it missed is as useful as where
      // it held and neither implies the other: the steps are coarse, so a device
      // that holds 300 and misses 400 has told you something a bare 300 has not.
      //
      // A device that misses the smallest step has held nothing, and says so.
      // Reporting a count of zero there is technically true and reads as a bug.
      this.rampResult = {
        held: held ? STEPS[this.stepIndex] : STEPS[this.stepIndex - 1] ?? null,
        missedAt: held ? null : STEPS[this.stepIndex]
      };

      this.stopRamp();

      return;
    }

    this.setStep(this.stepIndex + 1);
    this.rampUntil = now + RAMP_HOLD_MS + SETTLE_MS;
  }

  /**
   * A toggle changed, so everything standing is the wrong shape and goes. The
   * pool goes with it, since a pooled image and a path follower are not
   * interchangeable objects.
   */
  rebuild() {
    this.stopRamp();

    this.live.forEach((entity) => entity.destroy());
    this.free.forEach((entity) => entity.destroy());

    this.live = [];
    this.free = [];

    this.settle();
  }

  settle() {
    this.samples = [];
    this.settleUntil = this.time.now + SETTLE_MS;
  }

  // ------------------------------------------------------------------- update

  update(time, delta) {
    this.topUp();
    this.advance(delta / 1000);
    this.reject(delta / 1000);

    if (time >= this.settleUntil) {
      this.samples.push(delta);

      // A second of frames at the budget, which is all the readout and the ramp
      // ever look at.
      if (this.samples.length > 60) {
        this.samples.shift();
      }
    }

    this.checkRamp(time);
    this.refreshReadout(time);
  }

  topUp() {
    while (this.live.length < this.targetCount) {
      this.live.push(this.spawn());
    }

    while (this.live.length > this.targetCount) {
      this.retire(this.live.pop());
    }
  }

  /**
   * Movement, for the shape that integrates a position. The tweened shape is
   * moved by the tween manager and does nothing here, which is the comparison.
   *
   * The depth sort is applied to both, because it is an independent toggle and
   * the audit's charge against it is that the value changes every frame and
   * dirties the display list, which is true however the position arrived.
   */
  advance(dt) {
    const { tweened, depthSort } = this.shape;

    for (let index = this.live.length - 1; index >= 0; index -= 1) {
      const entity = this.live[index];

      if (!tweened) {
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;

        if (
          Phaser.Math.Distance.Between(entity.x, entity.y, CENTRE.x, CENTRE.y) <
          ARRIVAL
        ) {
          this.recycle(index);

          continue;
        }
      }

      if (depthSort) {
        entity.setDepth(entity.y);
      }
    }
  }

  /**
   * Rejections, which is where the allocation churn lives. The pooled shape
   * recycles in place and the unpooled one destroys and allocates a
   * replacement, which is the difference the audit says matters most.
   */
  reject(dt) {
    let due = Math.round(this.live.length * KILL_PER_SECOND * dt);

    while (due > 0 && this.live.length > 0) {
      this.recycle(Phaser.Math.Between(0, this.live.length - 1));
      due -= 1;
    }
  }

  recycle(index) {
    const entity = this.live[index];

    this.live.splice(index, 1);
    this.retire(entity);
    this.live.push(this.spawn());
  }

  retire(entity) {
    if (this.shape.pooled) {
      if (this.shape.tweened) {
        entity.stopFollow();
      }

      entity.setActive(false).setVisible(false);
      this.free.push(entity);

      return;
    }

    entity.destroy();
  }

  // ------------------------------------------------------------------ spawning

  spawn() {
    const tier = Phaser.Math.Between(0, TIERS.length - 1);
    const angle = Math.random() * Math.PI * 2;
    const x = CENTRE.x + Math.cos(angle) * SPAWN_RADIUS;
    const y = CENTRE.y + Math.sin(angle) * SPAWN_RADIUS;

    const entity = this.free.pop() ?? this.build(tier, x, y);

    this.dress(entity, tier, x, y);

    if (this.shape.tweened) {
      this.follow(entity, x, y, TIERS[tier].speed);
    } else {
      const towards = Phaser.Math.Angle.Between(x, y, CENTRE.x, CENTRE.y);

      entity.vx = Math.cos(towards) * TIERS[tier].speed;
      entity.vy = Math.sin(towards) * TIERS[tier].speed;
      entity.rotation = towards;
    }

    return entity;
  }

  build(tier, x, y) {
    const key = this.textureFor(tier);

    if (!this.shape.tweened) {
      return this.add.image(x, y, key);
    }

    const follower = new Phaser.GameObjects.PathFollower(
      this,
      this.lineIn(x, y),
      x,
      y,
      key
    );

    this.add.existing(follower);

    return follower;
  }

  /**
   * Everything a recycled object has to be told again, since a pooled one comes
   * back wearing the last tier it was.
   */
  dress(entity, tier, x, y) {
    const { colour, radius } = TIERS[tier];
    const area = (radius * 2 * SPRITE_SCALE) ** 2;

    entity.setTexture(this.textureFor(tier));
    entity.setTint(colour);
    entity.setScale(Math.sqrt(area / (entity.width * entity.height)));
    entity.setPosition(x, y);
    entity.setActive(true).setVisible(true);
  }

  /**
   * One texture for everybody, or the six the game actually has. The audit says
   * a single texture makes the whole crowd one batch and six force a bind each,
   * and this is the toggle that says by how much.
   */
  textureFor(tier) {
    return this.shape.oneTexture ? SPRITES[0] : SPRITES[tier];
  }

  /** A straight line inwards, which is all the radial design ever needs. */
  lineIn(x, y) {
    const path = new Phaser.Curves.Path(x, y);

    path.lineTo(CENTRE.x, CENTRE.y);

    return path;
  }

  follow(entity, x, y, speed) {
    const path = this.lineIn(x, y);

    // A fresh Path per spawn, which is what the two non-classic modes already
    // do, so the pooled tweened shape still pays for one.
    entity.setPath(path);

    entity.startFollow({
      from: 0,
      to: 1,
      duration: (path.getLength() / speed) * 1000,
      positionOnPath: true,
      rotateToPath: true,
      ease: 'Linear',
      onComplete: () => {
        const index = this.live.indexOf(entity);

        if (index !== -1) {
          this.recycle(index);
        }
      }
    });
  }

  // ------------------------------------------------------------------ readout

  mean() {
    if (this.samples.length === 0) {
      return 0;
    }

    return this.samples.reduce((total, ms) => total + ms, 0) / this.samples.length;
  }

  refreshReadout(now) {
    if (now < this.readoutAt) {
      return;
    }

    this.readoutAt = now + READOUT_MS;

    const mean = this.mean();
    const worst = this.samples.length === 0 ? 0 : Math.max(...this.samples);
    const renderer = this.game.renderer.type === Phaser.WEBGL ? 'WEBGL' : 'CANVAS';

    const flag = (key, label) => `${this.shape[key] ? '[x]' : '[ ]'} ${label}`;

    let verdict = '';

    if (this.ramping) {
      verdict = `\nramping at ${this.targetCount}`;
    } else if (this.rampResult !== null) {
      const { held, missedAt } = this.rampResult;

      verdict = held === null
        ? `\nheld 60fps at nothing, missed at ${missedAt}`
        : `\nheld 60fps at ${held}` +
          (missedAt === null ? ', top of range' : `, missed at ${missedAt}`);
    }

    this.readout.setText(
      [
        `bench  ${renderer}  ${BENCH_SIZE.width}x${BENCH_SIZE.height}`,
        `standing  ${this.live.length}`,
        `frame     ${mean.toFixed(1)} ms mean`,
        `worst     ${worst.toFixed(1)} ms`,
        `fps       ${mean === 0 ? 0 : Math.round(1000 / mean)}`,
        '',
        flag('depthSort', 'depth sort'),
        flag('tweened', 'tweened walk'),
        flag('pooled', 'pooled'),
        flag('oneTexture', 'one texture') + verdict
      ].join('\n')
    );

    this.toggleButtons.forEach((button, key) => {
      button.setBackgroundColor(this.shape[key] ? '#3f6d4a' : '#2b3240');
    });

    this.rampButton.setText(this.ramping ? 'stop' : 'find the floor');
  }
}

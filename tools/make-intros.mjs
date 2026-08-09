/**
 * Draws the seven applicant introduction animations and writes them to
 * public/assets/intros as sprite strips.
 *
 * The brief was a funny clip for each applicant type, the first time one turns
 * up. Found footage was the obvious answer and the wrong one: the repository is
 * public and MIT, every other asset in it is CC0, and a stock clip of somebody's
 * actual graduation is neither ours to ship nor especially kind to the person in
 * it. So these are drawn here instead, which is the same bargain tools/make-
 * sounds.mjs struck with the sound effects. A gag that lands badly is a number
 * in this file rather than a hunt for a replacement file, the licence question
 * does not arise, and Phaser can play the result without a GIF decoder.
 *
 * Run it with `node tools/make-intros.mjs`. It is a build-time tool, nothing in
 * the game imports it, and it uses Node built-ins only, so it adds no
 * dependency. The output is committed, so it only needs running when one of the
 * recipes below changes.
 *
 * Everything is greyscale, on purpose, the same as the rest of the art. The card
 * tints each strip with its applicant's colour, so the animation and the thing
 * walking down the path are recognisably the same person.
 *
 * The drawing is done with solid shapes and no outlines, at three times the
 * finished size, and averaged back down at the end. That is the whole of the
 * anti-aliasing, and it is enough at this scale.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import {
  INTRO_FRAME_COUNT,
  INTRO_FRAME_SIZE,
  INTRO_KEYS,
  INTRO_PREFIX
} from '../src/config/intros.js';

const OUTPUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'assets',
  'intros'
);

/** How much larger than the finished frame everything is drawn. */
const SUPERSAMPLE = 3;

const SIZE = INTRO_FRAME_SIZE;
const FRAMES = INTRO_FRAME_COUNT;

/**
 * The shades everything is drawn in. Greyscale, and the card multiplies the
 * applicant's colour through them, so these read as how light or dark that
 * colour comes out rather than as grey.
 */
const SHADE = {
  bright: 1,
  body: 0.82,
  mid: 0.55,
  dim: 0.34,
  ink: 0.16
};

/**
 * A single frame, held as straight alpha rather than premultiplied, since that
 * is what a PNG wants. Only one colour channel is kept, because the art is
 * greyscale and the other two are always the same as it.
 */
function createFrame() {
  const dimension = SIZE * SUPERSAMPLE;

  return {
    dimension,
    shade: new Float64Array(dimension * dimension),
    alpha: new Float64Array(dimension * dimension)
  };
}

/**
 * Lays one shape over whatever is already there, the ordinary source-over rule.
 * Everything below goes through here, so the compositing is in one place.
 */
function blend(frame, index, shade, alpha) {
  const under = frame.alpha[index];
  const combined = alpha + under * (1 - alpha);

  if (combined <= 0) {
    return;
  }

  frame.shade[index] =
    (shade * alpha + frame.shade[index] * under * (1 - alpha)) / combined;
  frame.alpha[index] = combined;
}

/**
 * Fills every pixel inside a shape. The shape is described by a box to look in
 * and a test that says whether a point is inside it, which is enough for
 * everything drawn here and means each shape below is three lines rather than
 * its own rasteriser.
 */
function fill(frame, box, inside, shade, alpha = 1) {
  const scale = SUPERSAMPLE;
  const last = frame.dimension - 1;
  const fromX = Math.max(0, Math.floor(box.left * scale));
  const toX = Math.min(last, Math.ceil(box.right * scale));
  const fromY = Math.max(0, Math.floor(box.top * scale));
  const toY = Math.min(last, Math.ceil(box.bottom * scale));

  for (let pixelY = fromY; pixelY <= toY; pixelY += 1) {
    const y = (pixelY + 0.5) / scale;

    for (let pixelX = fromX; pixelX <= toX; pixelX += 1) {
      const x = (pixelX + 0.5) / scale;

      if (inside(x, y)) {
        blend(frame, pixelY * frame.dimension + pixelX, shade, alpha);
      }
    }
  }
}

function circle(frame, x, y, radius, shade, alpha) {
  fill(
    frame,
    { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius },
    (px, py) => (px - x) ** 2 + (py - y) ** 2 <= radius * radius,
    shade,
    alpha
  );
}

function rect(frame, left, top, width, height, shade, alpha) {
  fill(
    frame,
    { left, right: left + width, top, bottom: top + height },
    (px, py) =>
      px >= left && px <= left + width && py >= top && py <= top + height,
    shade,
    alpha
  );
}

/**
 * A convex quadrilateral, which is every shape here that is not a circle or an
 * upright rectangle. Inside is decided by the sign of the cross product against
 * each edge in turn, which only holds for convex shapes, and all of these are.
 */
function quad(frame, points, shade, alpha) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);

  fill(
    frame,
    {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys)
    },
    (px, py) => {
      let sign = 0;

      for (let i = 0; i < points.length; i += 1) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);

        if (cross !== 0) {
          if (sign === 0) {
            sign = Math.sign(cross);
          } else if (Math.sign(cross) !== sign) {
            return false;
          }
        }
      }

      return true;
    },
    shade,
    alpha
  );
}

/** A rectangle turned about its own centre. */
function turnedRect(frame, x, y, width, height, angle, shade, alpha) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const corners = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight]
  ].map(([cx, cy]) => [x + cx * cos - cy * sin, y + cx * sin + cy * cos]);

  quad(frame, corners, shade, alpha);
}

/** A thick line between two points, drawn as a turned rectangle. */
function bar(frame, x1, y1, x2, y2, thickness, shade, alpha) {
  const length = Math.hypot(x2 - x1, y2 - y1);

  if (length === 0) {
    return;
  }

  turnedRect(
    frame,
    (x1 + x2) / 2,
    (y1 + y2) / 2,
    length,
    thickness,
    Math.atan2(y2 - y1, x2 - x1),
    shade,
    alpha
  );
}

/** A limb, given where it starts, which way it points and how long it is. */
function limb(frame, x, y, angle, length, thickness, shade) {
  bar(
    frame,
    x,
    y,
    x + Math.cos(angle) * length,
    y + Math.sin(angle) * length,
    thickness,
    shade,
    1
  );
}

/**
 * One applicant, drawn from the feet up. Angles are in radians and measured the
 * way the screen runs, so zero points right and a positive angle points down.
 *
 * Returns where the head and the shoulders ended up, since the recipes need to
 * hang caps, papers and thrown objects off them.
 */
function person(
  frame,
  { x, feet, height, armLeft = 2.3, armRight = 0.85, shade = SHADE.body }
) {
  const headRadius = height * 0.15;
  const headY = feet - height * 0.85;
  const shoulderY = feet - height * 0.63;
  const hipY = feet - height * 0.36;
  const armLength = height * 0.34;
  const limbWidth = Math.max(1.6, height * 0.075);

  circle(frame, x, headY, headRadius, shade, 1);

  quad(
    frame,
    [
      [x - height * 0.14, shoulderY],
      [x + height * 0.14, shoulderY],
      [x + height * 0.1, hipY],
      [x - height * 0.1, hipY]
    ],
    shade,
    1
  );

  limb(frame, x - height * 0.06, hipY, Math.PI / 2 + 0.14, height * 0.4, limbWidth, shade);
  limb(frame, x + height * 0.06, hipY, Math.PI / 2 - 0.14, height * 0.4, limbWidth, shade);

  limb(frame, x - height * 0.12, shoulderY + 1, armLeft, armLength, limbWidth, shade);
  limb(frame, x + height * 0.12, shoulderY + 1, armRight, armLength, limbWidth, shade);

  return { headY, headTop: headY - headRadius, shoulderY, headRadius };
}

/** A mortarboard: the flat plate, the cap under it and the tassel off one side. */
function mortarboard(frame, x, y, angle, scale = 1) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  turnedRect(frame, x, y, 22 * scale, 3 * scale, angle, SHADE.bright, 1);
  turnedRect(
    frame,
    x + sin * 3.4 * scale,
    y + cos * 3.4 * scale,
    11 * scale,
    5 * scale,
    angle,
    SHADE.mid,
    1
  );

  const tasselX = x + cos * 9 * scale;
  const tasselY = y + sin * 9 * scale;

  bar(
    frame,
    tasselX,
    tasselY,
    tasselX + sin * 7 * scale,
    tasselY + cos * 7 * scale,
    1.4 * scale,
    SHADE.dim,
    1
  );
}

/**
 * The seven recipes. Each one is handed the frame and how far through the loop
 * is, from 0 up to but not including 1, and draws that moment.
 */
const RECIPES = {
  /**
   * The cap goes up. The cap does not come down. Nobody in the picture appears
   * to have noticed, and they are still standing there with their arms up when
   * the loop comes round again.
   */
  graduate(frame, progress) {
    const thrown = progress > 0.14;
    const flight = Math.max(0, (progress - 0.14) / 0.5);

    // Once the cap has gone, the arms come down by degrees, which is the only
    // thing in the picture that admits anything has happened.
    const sag = Math.max(0, (progress - 0.55) / 0.45) * 0.55;

    const body = person(frame, {
      x: 40,
      feet: 70,
      height: 42,
      armLeft: thrown ? -2.35 - sag : 2.1,
      armRight: thrown ? -0.8 + sag : 1.05
    });

    if (!thrown) {
      mortarboard(frame, 40, body.headTop - 1, 0);

      return;
    }

    // Up fast, slowing as it goes, and past the top of the frame well before
    // the loop is over. It is drawn regardless of where it has got to, and the
    // frame simply runs out.
    const capY = body.headTop - 1 - (46 * flight - 8 * flight * flight);

    mortarboard(frame, 40 + flight * 5, capY, flight * 6.2);
  },

  /**
   * The curriculum vitae that covers every one of it. It is still unrolling
   * when the frame runs out, which is the point.
   */
  careerChanger(frame, progress) {
    person(frame, { x: 17, feet: 34, height: 26, armRight: 0.35, armLeft: 2.5 });

    const top = 16;
    const height = 6 + progress * 74;

    rect(frame, 30, top, 34, height, SHADE.bright, 0.92);

    // A line of writing every four units of paper, so the text arrives with
    // the paper rather than being there waiting for it.
    for (let line = 0; line * 5 + 7 < height; line += 1) {
      const y = top + 5 + line * 5;
      const width = line % 3 === 0 ? 20 : 26;

      rect(frame, 34, y, width, 2, SHADE.ink, 0.85);
    }
  },

  /**
   * Every qualification, stacked. It is a tower by the end of the loop, it has
   * started to lean, and the top of it has left the building.
   */
  overqualified(frame, progress) {
    const body = person(frame, {
      x: 40,
      feet: 74,
      height: 32,
      armLeft: 2.5,
      armRight: 0.65
    });

    const placed = Math.min(9, Math.floor(progress * 11));
    const sway = Math.sin(progress * Math.PI * 4) * 0.035;

    for (let i = 0; i < placed; i += 1) {
      const lift = 5 + i * 6;
      const lean = sway * (i + 1);

      turnedRect(
        frame,
        40 + lean * lift,
        body.headTop - lift,
        26 - i * 1.4,
        4,
        lean,
        i % 2 === 0 ? SHADE.bright : SHADE.mid,
        1
      );
    }
  },

  /**
   * Every keyword, twice. The page fills up, then fills in, and by the end
   * there is nothing on it a reader could get at.
   */
  keywordStuffer(frame, progress) {
    const left = 22;
    const top = 10;
    const width = 36;
    const height = 60;

    rect(frame, left, top, width, height, SHADE.bright, 0.9);

    const rows = 10;
    const filled = Math.min(rows, 1 + Math.floor(progress * rows * 1.5));

    for (let row = 0; row < filled; row += 1) {
      const y = top + 4 + row * 5.4;
      // Three words to a line, and the last of them shorter, so it reads as
      // writing rather than as a barcode.
      const widths = [12, 9, 6];
      let x = left + 3;

      widths.forEach((wordWidth) => {
        rect(frame, x, y, wordWidth, 3, SHADE.ink, 0.9);
        x += wordWidth + 2;
      });
    }

    // Past the point where the page is full, the words keep coming and stop
    // being words.
    if (progress > 0.78) {
      // Not quite opaque. A page filled in to nothing at all reads as the
      // animation having stopped rather than as the joke landing.
      rect(
        frame,
        left,
        top,
        width,
        height,
        SHADE.ink,
        Math.min(0.85, (progress - 0.78) / 0.14)
      );
    }
  },

  /**
   * Knows somebody. The barrier goes up well before they reach it, and nobody
   * asks them anything on the way through.
   */
  referral(frame, progress) {
    const hinge = { x: 68, y: 42 };

    // The two posts the gate hangs between.
    rect(frame, 43, 42, 3, 26, SHADE.dim, 1);
    rect(frame, hinge.x - 1.5, 42, 3, 26, SHADE.dim, 1);

    // Shut, then lifted, and lifted early. The gate is out of the way well
    // before the walker is anywhere near it, and nobody asks them anything.
    const lift = Math.min(1, Math.max(0, (progress - 0.14) / 0.3));
    const angle = Math.PI + lift * (Math.PI / 2.4);
    const armLength = 25;

    bar(
      frame,
      hinge.x,
      hinge.y,
      hinge.x + Math.cos(angle) * armLength,
      hinge.y + Math.sin(angle) * armLength,
      3.4,
      SHADE.bright,
      1
    );

    person(frame, {
      x: 10 + progress * 56,
      feet: 70,
      height: 34,
      armLeft: 2.1 + Math.sin(progress * Math.PI * 6) * 0.45,
      armRight: 1.0 - Math.sin(progress * Math.PI * 6) * 0.45
    });
  },

  /**
   * Applies, leaves, and is back before the frame is over.
   */
  boomerang(frame, progress) {
    const arc = Math.sin(progress * Math.PI);
    const x = 22 + arc * 46;
    const y = 44 - Math.sin(progress * Math.PI * 2) * 22;
    const spin = progress * Math.PI * 6;

    person(frame, {
      x: 16,
      feet: 70,
      height: 32,
      armLeft: 2.4,
      // The arm follows it out and is back up to catch it, which is the only
      // part of this that has to be timed.
      armRight: -0.9 + arc * 0.8
    });

    // Two limbs at an angle, which is a boomerang from a distance and at this
    // size is only ever seen from a distance.
    turnedRect(frame, x, y, 17, 4.5, spin, SHADE.bright, 1);
    turnedRect(
      frame,
      x + Math.cos(spin + 1.05) * 6.5,
      y + Math.sin(spin + 1.05) * 6.5,
      17,
      4.5,
      spin + 2.1,
      SHADE.bright,
      1
    );
  },

  /**
   * The process, running its full course around somebody who does not move.
   *
   * Everything else in this file animates the applicant. This one animates the
   * screening and leaves the applicant standing there, because that is the joke:
   * eight stages clear themselves in a second and a third, nobody is assessed,
   * and when the loop comes round it starts again on the same person. The only
   * part of them that moves is the pass they already have.
   */
  internalCandidate(frame, progress) {
    const body = person(frame, { x: 40, feet: 64, height: 44 });

    // The lanyard, swinging a little, which is the whole of the movement in the
    // middle of the frame.
    const swing = Math.sin(progress * Math.PI * 2) * 1.6;

    // Drawn dark on a light body rather than the other way round. Every other
    // prop in this file sits against empty frame and can be bright; this one is
    // over a torso, and bright on body is two shades apart and reads as nothing.
    bar(
      frame,
      40,
      body.shoulderY,
      40 + swing,
      body.shoulderY + 7,
      1.2,
      SHADE.mid,
      1
    );
    turnedRect(
      frame,
      40 + swing,
      body.shoulderY + 10,
      8,
      6,
      swing * 0.06,
      SHADE.ink,
      1
    );

    // Eight stages round the outside, clearing one at a time from the top.
    //
    // Upright rather than turned to face the middle, which was the first
    // version and made half of them diamonds: at this size that reads as eight
    // unrelated shapes scattered round the edge rather than as one process
    // going round.
    const stages = 8;
    const cleared = Math.floor(progress * stages) + 1;

    for (let stage = 0; stage < stages; stage += 1) {
      const angle = -Math.PI / 2 + (stage / stages) * Math.PI * 2;

      rect(
        frame,
        37 + Math.cos(angle) * 31,
        37 + Math.sin(angle) * 31,
        7,
        7,
        stage < cleared ? SHADE.bright : SHADE.ink,
        1
      );
    }
  }
};

/**
 * Averages a drawn frame back down to its finished size and writes it into the
 * strip. Straight alpha cannot be averaged directly, so the shades are weighted
 * by their own alpha on the way down, which is what stops a soft edge picking up
 * a halo of whatever the empty pixels next to it happen to hold.
 */
function reduceInto(strip, stripWidth, frame, offsetX) {
  const scale = SUPERSAMPLE;
  const samples = scale * scale;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let weighted = 0;
      let alpha = 0;

      for (let subY = 0; subY < scale; subY += 1) {
        for (let subX = 0; subX < scale; subX += 1) {
          const index =
            (y * scale + subY) * frame.dimension + (x * scale + subX);

          weighted += frame.shade[index] * frame.alpha[index];
          alpha += frame.alpha[index];
        }
      }

      const shade = alpha > 0 ? weighted / alpha : 0;
      const target = (y * stripWidth + offsetX + x) * 4;
      const level = Math.round(shade * 255);

      strip[target] = level;
      strip[target + 1] = level;
      strip[target + 2] = level;
      strip[target + 3] = Math.round((alpha / samples) * 255);
    }
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const check = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  check.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, check]);
}

/**
 * A minimal PNG: eight bit RGBA, no interlacing, and every scanline on filter
 * zero. Filtering would make the file smaller and these are a few kilobytes as
 * they are, so it is not worth the code.
 */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const raw = Buffer.alloc(height * (width * 4 + 1));

  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function drawStrip(recipe) {
  const stripWidth = SIZE * FRAMES;
  const strip = new Uint8Array(stripWidth * SIZE * 4);

  for (let index = 0; index < FRAMES; index += 1) {
    const frame = createFrame();

    recipe(frame, index / FRAMES);
    reduceInto(strip, stripWidth, frame, index * SIZE);
  }

  return encodePng(stripWidth, SIZE, strip);
}

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

INTRO_KEYS.forEach((key) => {
  const typeKey = key.slice(INTRO_PREFIX.length);
  const recipe = RECIPES[typeKey];

  if (!recipe) {
    throw new Error(`No recipe for ${key}. The manifest and this file disagree.`);
  }

  const png = drawStrip(recipe);

  writeFileSync(join(OUTPUT_DIRECTORY, `${key}.png`), png);

  console.log(`${key}.png  ${FRAMES} frames  ${(png.length / 1024).toFixed(1)}kB`);
});

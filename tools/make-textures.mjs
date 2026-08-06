/**
 * Draws the board's ground and its furniture and writes them to
 * public/assets/textures.
 *
 * The board was a flat colour with a corridor stroked down it, which read as a
 * diagram rather than as anywhere. The obvious fix is a floor texture, and the
 * obvious place to get one is a texture pack, which is the wrong answer here for
 * the same reason found footage was the wrong answer for the applicant
 * introductions: the repository is public and MIT, Kenney's tower defence pack
 * has no office in it, and a licence question is a worse problem to have than a
 * hundred lines of arithmetic. So the carpet is drawn here.
 *
 * Run it with `node tools/make-textures.mjs`. It is a build-time tool, nothing
 * in the game imports it, and it uses Node built-ins only, so it adds no
 * dependency. The output is committed, so it only needs running when one of the
 * recipes below changes.
 *
 * It repeats a little of tools/make-intros.mjs, the shape rasteriser and the PNG
 * writer, rather than the two sharing a library. That is deliberate: the
 * introductions work, they are the only thing that draws animation frames, and
 * pulling their internals out into a module to save sixty lines here would mean
 * editing a file this change has no business touching.
 *
 * Two kinds of thing come out of it.
 *
 * The ground tiles have to tile, so they are drawn a pixel at a time from
 * functions that wrap, with no anti-aliasing to do and nothing to supersample.
 * The furniture is shapes, so it is drawn at three times size and averaged back
 * down, which is the whole of its anti-aliasing and is enough at this scale.
 *
 * Everything is greyscale and lifted towards white, because the game multiplies
 * a tint over all of it. The floor is not grey carpet, it is carpet coloured by
 * whatever GameScene says the floor is.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { TEXTURE_KEYS } from '../src/config/scenery.js';

const OUTPUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'assets',
  'textures'
);

/** How much larger than the finished sprite the furniture is drawn. */
const SUPERSAMPLE = 3;

/**
 * The ground tile, in pixels. Twice the 64 pixel grid the board is built on, so
 * a carpet tile is a build tile and the seams land where the eye expects them.
 */
const TILE_SIZE = 128;

/**
 * The vignette, stretched over the whole board. It is a smooth ramp and nothing
 * else, so drawing it any larger than this only makes the file bigger.
 */
const VIGNETTE_SIZE = 128;

/* -------------------------------------------------------------------------- */
/* Noise                                                                      */
/* -------------------------------------------------------------------------- */

/** Mulberry32, so a texture is the same every time it is drawn. */
function makeRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise on a lattice that wraps, which is the whole reason it is written
 * out rather than taken off a shelf: the tile has to meet itself on all four
 * sides. The lattice is indexed modulo its period, so the cell past the right
 * edge is the cell at the left edge and the seam cannot be seen.
 *
 * The two periods are separate so a pattern can be stretched. Few cells across
 * and many down gives streaks that run along the floor, which is what a walked
 * surface looks like from above.
 */
function makeNoise(periodX, periodY, random) {
  const lattice = new Float64Array(periodX * periodY);

  for (let i = 0; i < lattice.length; i += 1) {
    lattice[i] = random();
  }

  const at = (cellX, cellY) =>
    lattice[
      (((cellY % periodY) + periodY) % periodY) * periodX +
        (((cellX % periodX) + periodX) % periodX)
    ];

  return (x, y) => {
    const scaledX = (x / TILE_SIZE) * periodX;
    const scaledY = (y / TILE_SIZE) * periodY;
    const cellX = Math.floor(scaledX);
    const cellY = Math.floor(scaledY);
    const alongX = smoothstep(scaledX - cellX);
    const alongY = smoothstep(scaledY - cellY);
    const top =
      at(cellX, cellY) + (at(cellX + 1, cellY) - at(cellX, cellY)) * alongX;
    const bottom =
      at(cellX, cellY + 1) +
      (at(cellX + 1, cellY + 1) - at(cellX, cellY + 1)) * alongX;

    return top + (bottom - top) * alongY;
  };
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

/* -------------------------------------------------------------------------- */
/* Ground                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A ground texture from a function of position. Straight to final resolution,
 * since noise has no edges to soften and averaging it down would only blur the
 * grain that is the point of it.
 */
function drawGround(size, shadeAt, alphaAt = () => 1) {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const shade = Math.round(clamp(shadeAt(x, y)) * 255);

      pixels[index] = shade;
      pixels[index + 1] = shade;
      pixels[index + 2] = shade;
      pixels[index + 3] = Math.round(clamp(alphaAt(x, y)) * 255);
    }
  }

  return encodePng(size, size, pixels);
}

/**
 * Contract carpet. Fleck, because carpet chosen by a facilities team is always
 * flecked, and a seam every sixty four pixels where one tile meets the next.
 *
 * The fleck is per pixel and unfiltered on purpose. It is the only thing at this
 * scale that stops a large flat area reading as a large flat area.
 */
function carpet() {
  const random = makeRandom(0x5a17);
  const patches = makeNoise(4, 4, random);
  const grain = makeNoise(32, 32, random);
  const fleck = new Float64Array(TILE_SIZE * TILE_SIZE);

  for (let i = 0; i < fleck.length; i += 1) {
    fleck[i] = random();
  }

  return drawGround(TILE_SIZE, (x, y) => {
    let shade = 0.6;

    shade += (patches(x, y) - 0.5) * 0.09;
    shade += (grain(x, y) - 0.5) * 0.11;
    shade += (fleck[y * TILE_SIZE + x] - 0.5) * 0.13;

    // Where the tiles meet: a dark join with the cut edge of the next tile
    // catching the light beside it.
    const seamX = x % (TILE_SIZE / 2);
    const seamY = y % (TILE_SIZE / 2);

    if (seamX === 0 || seamY === 0) {
      shade *= 0.82;
    } else if (seamX === 1 || seamY === 1) {
      shade *= 1.07;
    }

    return shade;
  });
}

/**
 * The same carpet after several thousand people have walked over it. Lighter,
 * because the pile is flattened, and streaked along the direction of travel
 * rather than flecked evenly.
 *
 * It is drawn as its own tile rather than as an alpha over the first one so the
 * two can be tinted differently. The walked ground being a slightly different
 * colour from the floor beside it is what makes the route readable, and that is
 * level design rather than decoration.
 */
function tread() {
  const random = makeRandom(0x2b19);
  const streaks = makeNoise(7, 34, random);
  const scuffs = makeNoise(5, 9, random);
  const grain = makeNoise(40, 40, random);

  return drawGround(TILE_SIZE, (x, y) => {
    let shade = 0.8;

    // The streaks carry it. The wider patches are kept faint deliberately: a
    // tile with much variation across it reads as weather rather than as floor
    // once it has been repeated the length of a corridor.
    shade += (streaks(x, y) - 0.5) * 0.16;
    shade += (scuffs(x, y) - 0.5) * 0.05;
    shade += (grain(x, y) - 0.5) * 0.07;

    return shade;
  });
}

/**
 * The corners going down. White, with the falloff in the alpha, so the scene
 * decides how dark the dark is and this file only decides where it starts.
 *
 * Stretched over a board that is wider than it is tall, so the falloff comes out
 * as an ellipse. That is the right answer rather than a compromise: a room is
 * lit across its shape, not in a circle in the middle of it.
 */
function vignette() {
  const centre = (VIGNETTE_SIZE - 1) / 2;

  return drawGround(
    VIGNETTE_SIZE,
    () => 1,
    (x, y) => {
      const fromCentre = Math.hypot(x - centre, y - centre) / centre;

      if (fromCentre <= 0.55) {
        return 0;
      }

      return smoothstep(Math.min(1, (fromCentre - 0.55) / 0.6));
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Furniture                                                                  */
/* -------------------------------------------------------------------------- */

function createSprite(width, height) {
  return {
    width: width * SUPERSAMPLE,
    height: height * SUPERSAMPLE,
    shade: new Float64Array(width * height * SUPERSAMPLE * SUPERSAMPLE),
    alpha: new Float64Array(width * height * SUPERSAMPLE * SUPERSAMPLE)
  };
}

/** Source over, the ordinary rule, and the only compositing here. */
function blend(sprite, index, shade, alpha) {
  const under = sprite.alpha[index];
  const combined = alpha + under * (1 - alpha);

  if (combined <= 0) {
    return;
  }

  sprite.shade[index] =
    (shade * alpha + sprite.shade[index] * under * (1 - alpha)) / combined;
  sprite.alpha[index] = combined;
}

/**
 * Fills every pixel inside a shape, where a shape is a box to look in and a test
 * that says whether a point is inside it. Enough for everything drawn below, and
 * it means each piece of furniture is a handful of lines rather than its own
 * rasteriser.
 */
function fill(sprite, box, inside, shade, alpha = 1) {
  const fromX = Math.max(0, Math.floor(box.left * SUPERSAMPLE));
  const toX = Math.min(sprite.width - 1, Math.ceil(box.right * SUPERSAMPLE));
  const fromY = Math.max(0, Math.floor(box.top * SUPERSAMPLE));
  const toY = Math.min(sprite.height - 1, Math.ceil(box.bottom * SUPERSAMPLE));

  for (let pixelY = fromY; pixelY <= toY; pixelY += 1) {
    const y = (pixelY + 0.5) / SUPERSAMPLE;

    for (let pixelX = fromX; pixelX <= toX; pixelX += 1) {
      const x = (pixelX + 0.5) / SUPERSAMPLE;

      if (inside(x, y)) {
        blend(sprite, pixelY * sprite.width + pixelX, shade, alpha);
      }
    }
  }
}

/** A rounded rectangle, which is most of an office. */
function slab(sprite, left, top, width, height, radius, shade, alpha = 1) {
  const right = left + width;
  const bottom = top + height;

  fill(
    sprite,
    { left, right, top, bottom },
    (x, y) => {
      const insetX = Math.min(Math.max(x, left + radius), right - radius);
      const insetY = Math.min(Math.max(y, top + radius), bottom - radius);

      return (x - insetX) ** 2 + (y - insetY) ** 2 <= radius * radius;
    },
    shade,
    alpha
  );
}

function disc(sprite, x, y, radius, shade, alpha = 1) {
  fill(
    sprite,
    { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius },
    (px, py) => (px - x) ** 2 + (py - y) ** 2 <= radius * radius,
    shade,
    alpha
  );
}

/**
 * The shades the furniture is drawn in. A top light, so a surface is bright, the
 * thing standing on it is brighter and the shadow it drops is not.
 */
const SHADE = {
  screen: 1,
  top: 0.86,
  body: 0.68,
  dim: 0.5,
  ink: 0.3
};

/** The shadow every piece of furniture sits on, offset down and right. */
function shadow(sprite, left, top, width, height, radius) {
  slab(sprite, left + 2, top + 2, width, height, radius, SHADE.ink, 0.4);
}

const FURNITURE = {
  /** A desk, a monitor, a keyboard and a mug nobody has washed. */
  'prop-desk': () => {
    const sprite = createSprite(92, 56);

    shadow(sprite, 6, 8, 80, 40, 3);
    slab(sprite, 6, 8, 80, 40, 3, SHADE.body);
    slab(sprite, 8, 10, 76, 3, 1, SHADE.top, 0.5);

    // The monitor, seen from above: a stand, a back and the glow off the front.
    slab(sprite, 26, 12, 40, 4, 1, SHADE.dim);
    slab(sprite, 28, 11, 36, 2, 1, SHADE.screen, 0.8);
    slab(sprite, 42, 16, 8, 4, 1, SHADE.dim);

    slab(sprite, 32, 28, 28, 10, 2, SHADE.dim);
    slab(sprite, 62, 30, 10, 7, 2, SHADE.dim);
    disc(sprite, 16, 20, 4, SHADE.top);
    disc(sprite, 16, 20, 2.4, SHADE.ink);

    // The chair, pushed back, because whoever sits here is in a meeting.
    slab(sprite, 34, 42, 24, 12, 4, SHADE.top);
    slab(sprite, 36, 50, 20, 4, 2, SHADE.ink);

    return sprite;
  },

  /** A filing cabinet, four drawers, all of them full. */
  'prop-cabinet': () => {
    const sprite = createSprite(44, 60);

    shadow(sprite, 6, 4, 32, 50, 2);
    slab(sprite, 6, 4, 32, 50, 2, SHADE.body);

    for (let drawer = 0; drawer < 4; drawer += 1) {
      const top = 7 + drawer * 12;

      slab(sprite, 9, top, 26, 10, 1, SHADE.dim);
      slab(sprite, 17, top + 6, 10, 2, 1, SHADE.top);
    }

    return sprite;
  },

  /** Three chairs in a row, which is what waiting looks like from above. */
  'prop-chairs': () => {
    const sprite = createSprite(96, 40);

    for (let chair = 0; chair < 3; chair += 1) {
      const left = 6 + chair * 29;

      shadow(sprite, left, 8, 24, 24, 5);
      slab(sprite, left, 8, 24, 24, 5, SHADE.body);
      slab(sprite, left + 1, 8, 22, 6, 2, SHADE.ink);
      slab(sprite, left + 4, 17, 16, 12, 4, SHADE.top);
    }

    return sprite;
  },

  /** The pot plant. Real, against the odds. */
  'prop-plant': () => {
    const sprite = createSprite(42, 42);

    // Alternating shades, so the leaves read as leaves rather than as one
    // shapeless mass. At this size that contrast is the only thing doing it.
    const leaves = [
      [21, 13, 6.5, SHADE.top],
      [14, 19, 6, SHADE.dim],
      [28, 19, 6, SHADE.dim],
      [17, 27, 5.5, SHADE.top],
      [26, 27, 5.5, SHADE.top],
      [21, 21, 6, SHADE.body]
    ];

    // The pot, which shows as a rim around the bottom of the foliage and no
    // more, since this is the view from the ceiling.
    disc(sprite, 23, 24, 13, SHADE.ink, 0.35);
    disc(sprite, 21, 26, 11, SHADE.body);

    leaves.forEach(([x, y, radius, shade]) => disc(sprite, x, y, radius, shade));

    return sprite;
  },

  /** The water cooler. Also the meeting room. */
  'prop-cooler': () => {
    const sprite = createSprite(36, 36);

    shadow(sprite, 8, 8, 20, 20, 3);
    slab(sprite, 8, 8, 20, 20, 3, SHADE.body);
    disc(sprite, 18, 17, 7, SHADE.screen, 0.85);
    disc(sprite, 18, 17, 4, SHADE.top);
    slab(sprite, 13, 26, 10, 3, 1, SHADE.dim);

    return sprite;
  },

  /** Archive boxes. Applications, printed, from before anyone knew better. */
  'prop-boxes': () => {
    const sprite = createSprite(48, 48);
    const stack = [
      [6, 18, 20, 20, SHADE.body],
      [24, 10, 18, 18, SHADE.top],
      [16, 4, 16, 14, SHADE.dim]
    ];

    stack.forEach(([left, top, width, height, shade]) => {
      shadow(sprite, left, top, width, height, 1);
      slab(sprite, left, top, width, height, 1, shade);
      slab(sprite, left + 3, top + 3, width - 6, 2, 1, SHADE.ink, 0.55);
    });

    return sprite;
  }
};

/** Averages the supersampled sprite down and encodes it. */
function reduce(sprite) {
  const width = sprite.width / SUPERSAMPLE;
  const height = sprite.height / SUPERSAMPLE;
  const pixels = new Uint8Array(width * height * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let shade = 0;
      let alpha = 0;

      for (let offsetY = 0; offsetY < SUPERSAMPLE; offsetY += 1) {
        for (let offsetX = 0; offsetX < SUPERSAMPLE; offsetX += 1) {
          const index =
            (y * SUPERSAMPLE + offsetY) * sprite.width + x * SUPERSAMPLE + offsetX;

          shade += sprite.shade[index] * sprite.alpha[index];
          alpha += sprite.alpha[index];
        }
      }

      const index = (y * width + x) * 4;
      const value = alpha > 0 ? Math.round((shade / alpha) * 255) : 0;

      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = Math.round((alpha / samples) * 255);
    }
  }

  return encodePng(width, height, pixels);
}

/* -------------------------------------------------------------------------- */
/* PNG                                                                        */
/* -------------------------------------------------------------------------- */

const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i += 1) {
  let value = i;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  CRC_TABLE[i] = value >>> 0;
}

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
 * zero. Filtering would make the files smaller and these are a few kilobytes as
 * they are, so it is not worth the code.
 */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * stride + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* -------------------------------------------------------------------------- */

const GROUND = {
  'floor-carpet': carpet,
  'floor-tread': tread,
  vignette
};

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

TEXTURE_KEYS.forEach((key) => {
  const ground = GROUND[key];
  const furniture = FURNITURE[key];

  if (!ground && !furniture) {
    throw new Error(`No recipe for ${key}. The manifest and this file disagree.`);
  }

  const png = ground ? ground() : reduce(furniture());

  writeFileSync(join(OUTPUT_DIRECTORY, `${key}.png`), png);

  console.log(`${key}.png  ${(png.length / 1024).toFixed(1)}kB`);
});

/**
 * Draws the tab icon and writes it to public.
 *
 * The game had no favicon, so every tab showing it carried whichever blank
 * page glyph the browser keeps for sites that have not said. The obvious
 * answer is to crop the share card down, and it is the wrong one: the card is
 * a screenshot of a board, and a board at sixteen pixels is a grey smudge.
 * An icon that small is a mark rather than a picture, so it is drawn here.
 *
 * Run it with `node tools/make-favicon.mjs`. It is a build-time tool, nothing
 * in the game imports it, and it uses Node built-ins only, so it adds no
 * dependency. The output is committed, so it only needs running when the mark
 * below changes.
 *
 * It repeats the rasteriser and the PNG writer from tools/make-textures.mjs
 * rather than the two sharing a library, on the same terms that file states:
 * the textures work, and pulling their internals out into a module to save
 * sixty lines here would mean editing a file this change has no business
 * touching. What it does not repeat is the greyscale. The rest of the art is
 * drawn pale and tinted by whatever places it, because the board owns the
 * palette. Nothing tints a favicon, so the colours are in the mark, taken from
 * the board so the tab and the game are recognisably the same thing.
 *
 * Three files come out of it, and the shapes are described once for all three.
 *
 * `favicon.svg` is the mark itself, and the one a current browser will use. It
 * is written from the same list of shapes the raster versions are drawn from,
 * so there is one recipe rather than a vector file and a bitmap that can drift
 * apart.
 *
 * `favicon.png` is thirty two pixels, for a browser that will not take an SVG
 * icon. There is deliberately no `.ico`: a browser only asks for one when the
 * page has declared no icon at all, and index.html declares two.
 *
 * `apple-touch-icon.png` is a hundred and eighty pixels, which matters more
 * here than it would on most sites, since the phone board is a real thing to
 * add to a home screen. It is drawn square and full bleed rather than with the
 * rounded corners of the other two, because iOS puts its own mask over it and
 * a rounded mark inside a rounded mask reads as a mistake.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUTPUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public'
);

/** How much larger than the finished icon everything is drawn. */
const SUPERSAMPLE = 4;

/** The square the mark is described in. Every number below is in these units. */
const VIEW = 32;

/* -------------------------------------------------------------------------- */
/* The mark                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The colours, and all four of them are already on the board.
 *
 * The tile is the office carpet, which is what stops the icon disappearing into
 * a dark browser chrome the way the page background would. The paper and the
 * ruled lines are the two text colours the HUD is written in. The stroke is the
 * colour the game rejects things in, used on the vacancy and on a placement it
 * will not accept.
 */
const CARPET = '#39414f';
const PAPER = '#e6ebf0';
const RULE = '#8b98a6';
const REJECT = '#b5553f';

/**
 * An application, and the mark made across it.
 *
 * It is the shortest true thing the game does, and it survives being sixteen
 * pixels across, which is the only test that matters here. At that size the
 * three ruled lines are not lines any more, they are the texture that says
 * paper, and the diagonal is the only thing left with a shape. A tower would
 * have been the other candidate and it loses on exactly that: from above, at
 * sixteen pixels, it is a dot.
 *
 * The stroke runs past the page on both sides on purpose. Kept inside it, it
 * reads as something printed on the document. Carried over the edges, it reads
 * as something done to it afterwards by somebody else.
 */
function mark(cornerRadius) {
  return [
    {
      left: 0,
      top: 0,
      width: VIEW,
      height: VIEW,
      radius: cornerRadius,
      colour: CARPET
    },
    { left: 8, top: 4.5, width: 16, height: 23, radius: 1.5, colour: PAPER },
    { left: 10.5, top: 9, width: 11, height: 2, radius: 1, colour: RULE },
    { left: 10.5, top: 14, width: 11, height: 2, radius: 1, colour: RULE },
    { left: 10.5, top: 19, width: 6.5, height: 2, radius: 1, colour: RULE },
    {
      left: 4,
      top: 13.8,
      width: 24,
      height: 4.4,
      radius: 2.2,
      colour: REJECT,
      rotate: -30
    }
  ];
}

/* -------------------------------------------------------------------------- */
/* Raster                                                                     */
/* -------------------------------------------------------------------------- */

function parseColour(hex) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255
  };
}

function createCanvas(size) {
  const side = size * SUPERSAMPLE;

  return {
    side,
    red: new Float64Array(side * side),
    green: new Float64Array(side * side),
    blue: new Float64Array(side * side),
    alpha: new Float64Array(side * side)
  };
}

/** Source over, the ordinary rule, and the only compositing here. */
function blend(canvas, index, colour, alpha) {
  const under = canvas.alpha[index];
  const combined = alpha + under * (1 - alpha);

  if (combined <= 0) {
    return;
  }

  const keep = under * (1 - alpha);

  canvas.red[index] = (colour.red * alpha + canvas.red[index] * keep) / combined;
  canvas.green[index] =
    (colour.green * alpha + canvas.green[index] * keep) / combined;
  canvas.blue[index] =
    (colour.blue * alpha + canvas.blue[index] * keep) / combined;
  canvas.alpha[index] = combined;
}

/**
 * A rounded rectangle, optionally turned about the middle of the square, which
 * is every shape in the mark.
 *
 * The whole canvas is scanned for each shape rather than a bounding box worked
 * out for it. That is six passes over a few hundred thousand points at the
 * largest size, which is nothing, and it means the turned shape needs no
 * special case: the point is rotated back into the shape's own space and tested
 * there, the same test as an untuned one.
 */
function draw(canvas, shape) {
  const colour = parseColour(shape.colour);
  const right = shape.left + shape.width;
  const bottom = shape.top + shape.height;
  const angle = ((shape.rotate ?? 0) * Math.PI) / 180;
  const sin = Math.sin(-angle);
  const cos = Math.cos(-angle);
  const centre = VIEW / 2;

  for (let pixelY = 0; pixelY < canvas.side; pixelY += 1) {
    for (let pixelX = 0; pixelX < canvas.side; pixelX += 1) {
      /* The centre of the subpixel, in the units the mark is described in. */
      const viewX = ((pixelX + 0.5) / canvas.side) * VIEW;
      const viewY = ((pixelY + 0.5) / canvas.side) * VIEW;

      const offsetX = viewX - centre;
      const offsetY = viewY - centre;
      const x = centre + offsetX * cos - offsetY * sin;
      const y = centre + offsetX * sin + offsetY * cos;

      const insetX = Math.min(
        Math.max(x, shape.left + shape.radius),
        right - shape.radius
      );
      const insetY = Math.min(
        Math.max(y, shape.top + shape.radius),
        bottom - shape.radius
      );

      if (
        (x - insetX) ** 2 + (y - insetY) ** 2 <=
        shape.radius * shape.radius
      ) {
        blend(canvas, pixelY * canvas.side + pixelX, colour, 1);
      }
    }
  }
}

/** The supersampled canvas averaged back down to the finished icon. */
function reduce(canvas, size) {
  const rgba = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      for (let subY = 0; subY < SUPERSAMPLE; subY += 1) {
        for (let subX = 0; subX < SUPERSAMPLE; subX += 1) {
          const index =
            (y * SUPERSAMPLE + subY) * canvas.side + x * SUPERSAMPLE + subX;
          const weight = canvas.alpha[index];

          red += canvas.red[index] * weight;
          green += canvas.green[index] * weight;
          blue += canvas.blue[index] * weight;
          alpha += weight;
        }
      }

      const at = (y * size + x) * 4;

      /* Colour is averaged over the covered part only, so a shape's edge fades
         out into transparency rather than into black. */
      if (alpha > 0) {
        rgba[at] = Math.round((red / alpha) * 255);
        rgba[at + 1] = Math.round((green / alpha) * 255);
        rgba[at + 2] = Math.round((blue / alpha) * 255);
      }

      rgba[at + 3] = Math.round((alpha / SUPERSAMPLE ** 2) * 255);
    }
  }

  return rgba;
}

function drawPng(size, cornerRadius) {
  const canvas = createCanvas(size);

  mark(cornerRadius).forEach((shape) => draw(canvas, shape));

  return encodePng(size, size, reduce(canvas, size));
}

/* -------------------------------------------------------------------------- */
/* Vector                                                                     */
/* -------------------------------------------------------------------------- */

/** The same shapes, written out rather than drawn. */
function drawSvg(cornerRadius) {
  const centre = VIEW / 2;

  const shapes = mark(cornerRadius).map((shape) => {
    const turn = shape.rotate
      ? ` transform="rotate(${shape.rotate} ${centre} ${centre})"`
      : '';

    return (
      `  <rect x="${shape.left}" y="${shape.top}" ` +
      `width="${shape.width}" height="${shape.height}" ` +
      `rx="${shape.radius}" fill="${shape.colour}"${turn}/>`
    );
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}">`,
    '  <title>ATS Defence</title>',
    ...shapes,
    '</svg>',
    ''
  ].join('\n');
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
 * zero. The same writer the textures use, and the same bargain: filtering would
 * make the files smaller and these are a couple of kilobytes as they are.
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

/** The corner on the two the browser draws itself. iOS rounds its own. */
const CORNER_RADIUS = 7;

const OUTPUT = {
  'favicon.svg': drawSvg(CORNER_RADIUS),
  'favicon.png': drawPng(32, CORNER_RADIUS),
  'apple-touch-icon.png': drawPng(180, 0)
};

Object.entries(OUTPUT).forEach(([name, contents]) => {
  writeFileSync(join(OUTPUT_DIRECTORY, name), contents);

  console.log(`${name}  ${(contents.length / 1024).toFixed(1)}kB`);
});

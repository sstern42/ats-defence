/**
 * The scenery manifest and where the furniture sits. Plain data, so the board
 * can be dressed differently without going near the game loop.
 *
 * None of this is Kenney's. The tower defence pack has no office in it, so the
 * ground and the furniture are drawn by tools/make-textures.mjs and committed,
 * the same bargain the sounds and the applicant introductions struck. That is
 * also why they live in their own directory rather than alongside the sprites.
 *
 * Everything here is greyscale and is tinted by the scene that places it, so
 * the palette stays with the rest of the board's colours in GameScene rather
 * than being baked into a PNG nobody can edit.
 *
 * Every key is the file name without its extension, so the loader stays four
 * lines long, the same as it is for the sprites.
 */
export const TEXTURE_DIRECTORY = 'assets/textures/';

/**
 * The ground. Two tiles and an overlay.
 *
 * `floor-carpet` is the office, tiled over the whole board. `floor-tread` is
 * the same carpet where thousands of applicants have walked over it, and it is
 * masked to the route rather than tiled everywhere. `vignette` is a single
 * stretched overlay that takes the corners down a little, so the board reads as
 * a room with a middle rather than as a flat sheet.
 */
export const GROUND_KEYS = ['floor-carpet', 'floor-tread', 'vignette'];

/**
 * The furniture. Top down, drawn at the scale the board is, and every one of
 * them is a thing an office has too much of.
 */
export const PROP_KEYS = [
  'prop-desk',
  'prop-cabinet',
  'prop-chairs',
  'prop-plant',
  'prop-cooler',
  'prop-boxes'
];

export const TEXTURE_KEYS = [...GROUND_KEYS, ...PROP_KEYS];

/**
 * Where the furniture goes, one list per mode, read by GameScene off the mode
 * exactly as the waypoints and the waves are.
 *
 * These are hand placed rather than scattered at random, because the two things
 * they have to avoid cannot be worked out from a seed: the ground the applicants
 * cover, and the tiles a player will want to build on. A prop sits under both
 * of those in the drawing order so an overlap is never fatal, but a filing
 * cabinet under every other tower is clutter rather than scenery.
 *
 * `angle` is degrees, and it is there because a room where everything lines up
 * looks like a floor plan rather than a place people work in.
 */
export const CLASSIC_SCENERY = [
  // The waiting area, in the pocket the first two legs of the corridor make.
  { key: 'prop-chairs', x: 150, y: 250, angle: 0 },
  { key: 'prop-plant', x: 210, y: 300, angle: 0 },

  // Somebody's desk, in the large open pocket in the middle of the board.
  { key: 'prop-desk', x: 350, y: 450, angle: 8 },
  { key: 'prop-desk', x: 400, y: 545, angle: -6 },
  { key: 'prop-cabinet', x: 300, y: 330, angle: 0 },
  { key: 'prop-boxes', x: 445, y: 330, angle: 14 },

  // The pocket inside the last two legs, which is the quiet end of the floor.
  { key: 'prop-cooler', x: 600, y: 340, angle: 0 },
  { key: 'prop-plant', x: 690, y: 330, angle: 0 },
  { key: 'prop-desk', x: 650, y: 430, angle: -4 },
  { key: 'prop-cabinet', x: 700, y: 500, angle: 0 },

  // Under the top right leg, in the strip between it and the HUD.
  { key: 'prop-boxes', x: 620, y: 180, angle: -8 },
  { key: 'prop-cabinet', x: 880, y: 175, angle: 0 },

  // The far corner, past everything, where the archive goes to die.
  { key: 'prop-boxes', x: 880, y: 660, angle: 5 },
  { key: 'prop-chairs', x: 700, y: 690, angle: 0 },
  { key: 'prop-plant', x: 940, y: 640, angle: 0 }
];

/**
 * The open advert floor. The crowd covers the middle of the board, so the
 * furniture is pushed to the strip above it and the strip below it, which is
 * roughly what happens to furniture when a crowd turns up.
 */
export const OPEN_FIELD_SCENERY = [
  { key: 'prop-desk', x: 430, y: 195, angle: 6 },
  { key: 'prop-cabinet', x: 560, y: 180, angle: 0 },
  { key: 'prop-plant', x: 640, y: 200, angle: 0 },
  { key: 'prop-boxes', x: 740, y: 190, angle: -10 },
  { key: 'prop-cooler', x: 855, y: 200, angle: 0 },
  { key: 'prop-chairs', x: 200, y: 715, angle: 0 },
  { key: 'prop-desk', x: 400, y: 690, angle: -5 },
  { key: 'prop-cabinet', x: 520, y: 710, angle: 0 },
  { key: 'prop-plant', x: 610, y: 700, angle: 0 },
  { key: 'prop-boxes', x: 760, y: 700, angle: 8 },
  { key: 'prop-cooler', x: 940, y: 660, angle: 0 }
];

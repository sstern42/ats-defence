/**
 * The office floor, shared by the home page and the board.
 *
 * The textures it places are greyscale, so the colours are here rather than in
 * the PNGs. That means the floor can be recoloured without redrawing anything,
 * and it means the two screens cannot drift apart into two different offices.
 *
 * The board needs more than this, since it has a route cut through its carpet,
 * so GameScene does that part itself and takes the colours from here.
 */

/**
 * The carpet, and the same carpet where everybody walks. The worn tint is the
 * lighter of the two on purpose: a path across an office floor is where the
 * pile has been flattened, not where it has been dirtied.
 */
export const FLOOR_TINT = 0x39414f;
export const TREAD_TINT = 0x333b47;

/** The furniture, which is on the floor rather than the subject of the shot. */
export const DECOR_TINT = 0x5b6575;
export const DECOR_ALPHA = 0.7;

/**
 * The corners going down. It is the cheapest way of making a flat board read as
 * a room, and it also keeps the eye where the game is.
 */
export const VIGNETTE_TINT = 0x000000;
export const VIGNETTE_ALPHA = 0.42;

/** Carpet over the whole screen, tiled from the one 128 pixel square. */
export function addCarpet(scene, depth) {
  return scene.add
    .tileSprite(0, 0, scene.scale.width, scene.scale.height, 'floor-carpet')
    .setOrigin(0, 0)
    .setTint(FLOOR_TINT)
    .setDepth(depth);
}

/**
 * The vignette, stretched from its square to the shape of the screen, so the
 * falloff comes out as an ellipse across the board rather than a circle in the
 * middle of it.
 */
export function addVignette(scene, depth) {
  return scene.add
    .image(0, 0, 'vignette')
    .setOrigin(0, 0)
    .setDisplaySize(scene.scale.width, scene.scale.height)
    .setTint(VIGNETTE_TINT)
    .setAlpha(VIGNETTE_ALPHA)
    .setDepth(depth);
}

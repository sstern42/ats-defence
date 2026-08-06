# Ground and furniture credit

Nobody's. These nine files are drawn by `tools/make-textures.mjs`, which is a
few hundred lines of noise and rounded rectangles using Node built-ins and no
dependency.

The board used to be a flat colour with a corridor stroked down it, which read
as a diagram rather than as anywhere. A texture pack was the obvious answer and
the wrong one: this repository is public and MIT, the Kenney pack the sprites
come from has no office in it, and a licence question is a worse problem to have
than a hundred lines of arithmetic. It is the same bargain `make-sounds.mjs` and
`make-intros.mjs` struck, for the same reasons.

## Regenerating

```bash
node tools/make-textures.mjs
```

The output is committed, so this only needs running when a recipe changes. The
file names are the texture keys the game loads by, so a new one means a recipe
in the script and an entry in `src/config/scenery.js`.

## What each one is

Everything is greyscale and lifted towards white, because the game multiplies a
tint over all of it. The floor is not grey carpet, it is carpet coloured by
whatever `src/scenes/backdrop.js` says the floor is.

| File | What it is |
| --- | --- |
| `floor-carpet.png` | Contract carpet, flecked, with a seam every 64 pixels where one tile meets the next. Tiles seamlessly, which is the whole reason the noise in the script wraps. |
| `floor-tread.png` | The same carpet after several thousand people have walked over it: lighter, because the pile is flattened, and streaked along the direction of travel. Shows through the route cut out of the carpet above it. |
| `vignette.png` | White, with the falloff in the alpha. Stretched over the board to take its corners down. |
| `prop-desk.png` | A desk, a monitor, a keyboard and a mug nobody has washed. The chair is pushed back. |
| `prop-cabinet.png` | A filing cabinet. Four drawers, all of them full. |
| `prop-chairs.png` | Three chairs in a row, which is what waiting looks like from above. |
| `prop-plant.png` | The pot plant. Real, against the odds. |
| `prop-cooler.png` | The water cooler, and therefore the meeting room. |
| `prop-boxes.png` | Archive boxes. Applications, printed, from before anyone knew better. |

## Format

Eight bit RGBA PNG. The two ground tiles are 128 pixels square, which is twice
the 64 pixel grid the board is built on, so a carpet tile is a build tile and
the seams land where the eye expects them. The furniture is drawn at three times
size and averaged down, which is the whole of its anti-aliasing and is enough at
this scale. The set is 40kB.

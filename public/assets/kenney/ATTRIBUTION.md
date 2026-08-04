# Art credit

Every sprite in this folder comes from the **Tower Defense (top-down)** pack by
[Kenney](https://kenney.nl), released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Credit is not
required by the licence. It is here anyway, because the art is the only part of
this game somebody else made.

Source pack: https://kenney.nl/assets/tower-defense-top-down

## What was changed

The originals are 64x64 PNGs named `towerDefense_tileNNN.png`. CC0 allows
modification, so each one used here was:

1. Cropped to the edge of its artwork, which is what makes the in-game scaling
   predictable.
2. Converted to greyscale and lifted towards white, where the sprite is tinted
   at runtime. The game colours towers and applicants per type by multiplying a
   tint over the sprite, and a tint multiplied over Kenney's original green or
   orange comes out muddy. `spark` and `flame` keep their original colours.
3. Turned a quarter turn clockwise, for the turrets only. Kenney draws them
   pointing up. The game rotates a barrel to face its target and expects the
   art to point right at rest.

Nothing else was touched, and no sprite was redrawn.

## Which file is which

| File | Original tile | Greyscale | Turned |
| --- | --- | --- | --- |
| `tower-base.png` | `towerDefense_tile229.png` | yes | no |
| `turret-twin.png` | `towerDefense_tile203.png` | yes | yes |
| `turret-missile.png` | `towerDefense_tile206.png` | yes | yes |
| `turret-sensor.png` | `towerDefense_tile226.png` | yes | yes |
| `turret-rack.png` | `towerDefense_tile205.png` | yes | yes |
| `turret-dish.png` | `towerDefense_tile227.png` | yes | yes |
| `trap-pad.png` | `towerDefense_tile133.png` | yes | no |
| `unit-round.png` | `towerDefense_tile245.png` | yes | no |
| `unit-finned.png` | `towerDefense_tile246.png` | yes | no |
| `unit-plain.png` | `towerDefense_tile247.png` | yes | no |
| `unit-slim.png` | `towerDefense_tile248.png` | yes | no |
| `vehicle-wide.png` | `towerDefense_tile268.png` | yes | no |
| `vehicle-boxy.png` | `towerDefense_tile269.png` | yes | no |
| `spark.png` | `towerDefense_tile022.png` | no | no |
| `flame.png` | `towerDefense_tile296.png` | no | no |

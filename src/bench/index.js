import Phaser from 'phaser';

import BenchScene, { BENCH_SIZE } from './BenchScene.js';

/**
 * The bench's own entry point, dynamically imported by main.js so none of it
 * reaches the bundle a player downloads.
 *
 * That split is also the first half of the delivery decision on issue #47
 * proved rather than assumed: one entry, two chunks, Phaser shared between
 * them. If it did not work here it would not work for the phone build either.
 *
 * There is no BootScene, no HomeScene and no analytics. The bench loads the six
 * applicant sprites itself and sends nothing anywhere, because a profiling run
 * is not a session and has no business in the store.
 */
export function startBench() {
  return new Phaser.Game({
    // AUTO rather than WEBGL, deliberately. See the note in BenchScene.js.
    type: Phaser.AUTO,
    parent: 'game',
    width: BENCH_SIZE.width,
    height: BENCH_SIZE.height,
    backgroundColor: '#14161a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BenchScene]
  });
}

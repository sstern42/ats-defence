import Phaser from 'phaser';

import { COPY } from '../content/copy.js';

import { RADIAL_BOARD } from '../config/path.js';
import MobileBootScene from '../scenes/mobile/BootScene.js';
import MobileGameScene from '../scenes/mobile/GameScene.js';
import MobileGameOverScene from '../scenes/mobile/GameOverScene.js';
import MobileHomeScene from '../scenes/mobile/HomeScene.js';
import MobileLeaderboardScene from '../scenes/mobile/LeaderboardScene.js';
import MobileUpgradeScene from '../scenes/mobile/UpgradeScene.js';

/**
 * The phone build's entry point, dynamically imported by main.js so none of it
 * reaches the bundle a desktop player downloads.
 *
 * The backing store is the radial board's own size, which is where the portrait
 * decision finally lands: the board has carried the size it is drawn against
 * since it was written, and this is the first thing that renders at it.
 *
 * `Phaser.WEBGL` rather than AUTO. The audit asked for this and it was held back
 * until there was an honest refusal to put behind it, because forcing a renderer
 * a device has not got is how you turn a soft failure into a blank screen. The
 * check is in main.js and it runs before any of this is imported.
 *
 * Canvas was never a viable fallback here anyway. The bench exists to measure a
 * board carrying hundreds of sprites and every number it produced came off a
 * WebGL context.
 */
export function startMobile() {
  // The mode is not set here any more. It is set in main.js, from the shape,
  // before the session is opened, because two events go out before this module
  // has even been imported and both of them carry `mode`. Setting it here was
  // early enough for the leaderboard and for every event a scene sends, and too
  // late for the two that matter most, which is a distinction that does not
  // survive being written down.
  return new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: RADIAL_BOARD.board.width,
    height: RADIAL_BOARD.board.height,
    backgroundColor: '#14161a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    // Only the first scene starts on boot. It loads what the build draws and
    // starts the home page, which starts the board when the player asks for a
    // run. The order after that is the drawing order, so the two scenes that go
    // over a held board come after it, which is the arrangement the desktop
    // config uses for the same reason.
    scene: [
      MobileBootScene,
      MobileHomeScene,
      MobileGameScene,
      MobileUpgradeScene,
      MobileGameOverScene,
      // Last, because it opens over the home page and over the game over
      // screen, and it has to be drawn on top of whichever it was opened from.
      MobileLeaderboardScene
    ]
  });
}

/**
 * Whether this browser can draw the board at all.
 *
 * Asked before the game is built rather than after, since Phaser.WEBGL on a
 * context that cannot be had is a blank screen with nothing to read on it.
 */
export function hasWebgl() {
  try {
    const canvas = document.createElement('canvas');

    return Boolean(
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/**
 * The board is portrait and there is no landscape version of it. A phone turned
 * on its side gets a letterboxed strip about a third the height of the screen,
 * which is the broken layout this project says an honest refusal beats.
 *
 * DOM rather than a scene, for the reason services/nameInput.js is DOM: the
 * canvas is the thing being letterboxed, so anything drawn inside it is in the
 * strip too. This covers the viewport.
 *
 * It watches rather than checks once, because rotating is a thing somebody does
 * mid run and the run is still there when they turn back.
 */
export function watchOrientation() {
  const veil = document.createElement('div');

  veil.className = 'rotate-veil';
  veil.innerHTML = '<h1></h1><p></p>';
  veil.querySelector('h1').textContent = COPY.phoneRefusal.rotateTitle;
  veil.querySelector('p').textContent = COPY.phoneRefusal.rotateBody;

  document.body.appendChild(veil);

  const refresh = () => {
    veil.classList.toggle('showing', window.innerWidth > window.innerHeight);
  };

  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', refresh);

  refresh();
}

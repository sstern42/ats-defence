import Phaser from 'phaser';

import { COPY } from './content/copy.js';
import BootScene from './scenes/BootScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import { initAnalytics } from './services/analytics.js';
import { initExperiments } from './services/experiments.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1024,
  height: 768,
  backgroundColor: '#14161a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // Only the first scene starts on boot. BootScene loads the art and starts
  // GameScene, which launches the other two.
  scene: [BootScene, GameScene, UIScene, GameOverScene]
};

/**
 * Whether this screen can have the game at all.
 *
 * Room is the whole test. There used to be a second one, for a fine pointer,
 * because placing a tower meant hovering a tile to read its range before
 * committing and a finger cannot hover. The drag gesture gave the finger a way
 * to do that, so the reason for the test went and the test went with it.
 *
 * What is left turns away phones without having to ask what anything is. No
 * phone in landscape has six hundred pixels of height, and none in portrait has
 * nine hundred of width, so the shape of the screen answers it. A tablet clears
 * both and renders the fixed 1024 by 768 board at close to its own size, which
 * is the case this was opened up for.
 *
 * What it does not test is the HUD, which is still drawn at a size that suits a
 * mouse. That is the thing to watch on a tablet, and the reason phones stay out
 * even once they are big enough.
 */
function isSupported() {
  return window.innerWidth >= 900 && window.innerHeight >= 600;
}

function showUnsupported() {
  const parent = document.getElementById('game');

  parent.className = 'unsupported';
  parent.innerHTML = `
    <h1></h1>
    <p></p>
    <p></p>
  `;

  // Written in rather than interpolated, so a string from copy.js is never
  // parsed as markup.
  const [title, body, note] = [
    parent.querySelector('h1'),
    ...parent.querySelectorAll('p')
  ];

  title.textContent = COPY.unsupported.title;
  body.textContent = COPY.unsupported.body;
  note.textContent = COPY.unsupported.note;
}

/**
 * The experiment resolves first, because every analytics event carries the
 * assignment and the very first one is sent by initAnalytics. It has its own
 * short timeout and cannot fail in a way that stops the game, so this waits on
 * it rather than racing it.
 *
 * Analytics start on an unsupported screen too. How many people arrive on a
 * phone and bounce is worth knowing, and `device_type` is on every event, so
 * that question answers itself as long as the session is opened.
 */
async function boot() {
  await initExperiments();

  initAnalytics();

  if (!isSupported()) {
    showUnsupported();

    return;
  }

  new Phaser.Game(config);
}

boot();

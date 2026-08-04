import Phaser from 'phaser';

import { COPY } from './content/copy.js';
import BootScene from './scenes/BootScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import GameScene from './scenes/GameScene.js';
import HomeScene from './scenes/HomeScene.js';
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
  // HomeScene, which starts GameScene when the player asks for a run, which
  // launches the other two.
  scene: [BootScene, HomeScene, GameScene, UIScene, GameOverScene]
};

/**
 * Whether this screen can have the game at all.
 *
 * Two ways to fail. A board scaled down to phone width is unreadable, and
 * placing a tower means hovering a tile to see its range before committing,
 * which a finger cannot do. Mobile controls are explicitly out of scope, so
 * the honest answer is to say so rather than to ship something that technically
 * loads.
 *
 * A touch laptop is not caught by the pointer test alone, since it also reports
 * a fine pointer, which is the right way round: those work.
 */
function isSupported() {
  const bigEnough = window.innerWidth >= 900 && window.innerHeight >= 600;
  const finePointer =
    window.matchMedia?.('(pointer: fine)').matches ?? true;

  return bigEnough && finePointer;
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

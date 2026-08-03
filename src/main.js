import Phaser from 'phaser';

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
  // Only the first scene starts on boot. GameScene launches the other two.
  scene: [GameScene, UIScene, GameOverScene]
};

/**
 * The experiment resolves first, because every analytics event carries the
 * assignment and the very first one is sent by initAnalytics. It has its own
 * short timeout and cannot fail in a way that stops the game, so this waits on
 * it rather than racing it.
 */
async function boot() {
  await initExperiments();

  initAnalytics();

  new Phaser.Game(config);
}

boot();

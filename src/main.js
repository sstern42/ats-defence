import Phaser from 'phaser';

import GameOverScene from './scenes/GameOverScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import { initAnalytics } from './services/analytics.js';

// Before the game, so the session is open and the departure listeners are on
// by the time anything has happened worth recording.
initAnalytics();

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

new Phaser.Game(config);

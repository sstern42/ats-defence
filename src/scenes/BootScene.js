import Phaser from 'phaser';

import { ART_DIRECTORY, ART_KEYS } from '../config/art.js';
import { AUDIO_DIRECTORY, SOUNDS } from '../config/audio.js';
import {
  INTRO_DIRECTORY,
  INTRO_FRAME_COUNT,
  INTRO_FRAME_RATE,
  INTRO_FRAME_SIZE,
  INTRO_KEYS
} from '../config/intros.js';
import { initSound } from '../services/audio.js';

/**
 * Loads the art and the sound, and hands over to HomeScene.
 *
 * It is worth having a scene of its own even though the whole load is twelve
 * kilobytes of PNG. Textures used to be drawn at run time inside GameScene,
 * which meant the game could not be given a sprite it had not baked itself.
 * Everything now comes off disk, and something has to have waited for it.
 *
 * There is deliberately nothing on screen while this runs. A loading bar for a
 * load this size would be on screen for less time than it takes to read.
 *
 * Neither the home page nor a restart comes back through here, since the
 * textures and the clips are already in the cache by then.
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.setPath(ART_DIRECTORY);

    ART_KEYS.forEach((key) => this.load.image(key, `${key}.png`));

    // The applicant introductions, one strip of frames per type, all the same
    // shape, which is why the frame size comes from the manifest rather than
    // from anything here.
    this.load.setPath(INTRO_DIRECTORY);

    INTRO_KEYS.forEach((key) =>
      this.load.spritesheet(key, `${key}.png`, {
        frameWidth: INTRO_FRAME_SIZE,
        frameHeight: INTRO_FRAME_SIZE
      })
    );

    // Sixteen bit PCM, which every browser the game is tested in decodes, so
    // there is one file per sound and no fallback list.
    this.load.setPath(AUDIO_DIRECTORY);

    Object.keys(SOUNDS).forEach((key) => this.load.audio(key, `${key}.wav`));
  }

  create() {
    this.createIntroAnimations();

    initSound(this);

    this.scene.start('HomeScene');
  }

  /**
   * One looping animation per introduction, named after the texture it plays.
   * Animations belong to the game rather than to a scene, so these are made
   * once here and survive every restart of the board.
   */
  createIntroAnimations() {
    INTRO_KEYS.forEach((key) => {
      if (this.anims.exists(key)) {
        return;
      }

      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, {
          start: 0,
          end: INTRO_FRAME_COUNT - 1
        }),
        frameRate: INTRO_FRAME_RATE,
        repeat: -1
      });
    });
  }
}

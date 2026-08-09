import Phaser from 'phaser';

import { ART_DIRECTORY, ART_KEYS } from '../../config/art.js';
import { AUDIO_DIRECTORY, SOUNDS } from '../../config/audio.js';
import {
  INTRO_DIRECTORY,
  INTRO_FRAME_COUNT,
  INTRO_FRAME_RATE,
  INTRO_FRAME_SIZE,
  INTRO_KEYS
} from '../../config/intros.js';
import { GROUND_KEYS, TEXTURE_DIRECTORY } from '../../config/scenery.js';
import { initSound } from '../../services/audio.js';
import { initMusic } from '../../services/music.js';

/**
 * Loads what the phone build uses, and hands over to the home page.
 *
 * This is the load that used to sit in the mobile GameScene's `preload`, moved
 * out for the reason the desktop has a BootScene at all: the board is no longer
 * the first thing on screen, and the page in front of it stands on the same
 * carpet. Two scenes wanting the same textures is one scene's job to fetch.
 *
 * It is not the desktop `BootScene` and it is not going to become it. That one
 * also pulls in the furniture, which this build does not draw, and a phone is
 * the device least able to afford being handed assets on the off chance. The
 * manifests are still the one source of what the art is: what differs is which
 * parts of them are asked for.
 *
 * The applicant introductions used to be on the not-drawn side of that line and
 * have crossed it, because the board now introduces a type the first time it
 * turns up. They are the largest thing this fetches and the only part of the
 * load that is spent on something other than the game itself, which is the
 * trade: six strips against a board that never said who any of these people
 * were.
 *
 * Nothing is drawn while it runs. The whole load is a few tens of kilobytes, so
 * a progress bar would be on screen for less time than it takes to notice.
 */
export default class MobileBootScene extends Phaser.Scene {
  constructor() {
    super('MobileBootScene');
  }

  preload() {
    ART_KEYS.forEach((key) => {
      this.load.image(key, `${ART_DIRECTORY}${key}.png`);
    });

    // The carpet and the vignette, but not floor-tread: that one is masked to a
    // walked route and this board has no route to wear out.
    GROUND_KEYS.filter((key) => key !== 'floor-tread').forEach((key) => {
      this.load.image(key, `${TEXTURE_DIRECTORY}${key}.png`);
    });

    // One strip of frames per type, all the same shape, which is why the frame
    // size comes from the manifest rather than from anything here.
    this.load.setPath(INTRO_DIRECTORY);

    INTRO_KEYS.forEach((key) =>
      this.load.spritesheet(key, `${key}.png`, {
        frameWidth: INTRO_FRAME_SIZE,
        frameHeight: INTRO_FRAME_SIZE
      })
    );

    this.load.setPath(AUDIO_DIRECTORY);
    Object.keys(SOUNDS).forEach((key) => this.load.audio(key, `${key}.wav`));
    this.load.setPath();
  }

  create() {
    this.createIntroAnimations();
    // Both take their manager off whichever scene hands it to them, and the
    // manager is the game's rather than the scene's, so it outlives this scene
    // stopping. Neither plays anything here: a page that opens on a noise is a
    // page nobody opens twice, and the board asks for music when a run starts.
    initSound(this);
    initMusic(this);

    this.scene.start('MobileHomeScene');
  }

  /**
   * One looping animation per introduction, named after the texture it plays.
   *
   * Animations belong to the game rather than to a scene, so these are made
   * once here and survive every restart of the board, which on this build is
   * the commonest thing a player does.
   *
   * The same six lines as the desktop's, and deliberately not shared with it:
   * lifting them out would mean a module that exists to be called from two boot
   * scenes that never run in the same page.
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

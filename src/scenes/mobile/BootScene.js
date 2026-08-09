import Phaser from 'phaser';

import { ART_DIRECTORY, ART_KEYS } from '../../config/art.js';
import { AUDIO_DIRECTORY, SOUNDS } from '../../config/audio.js';
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
 * also pulls in the applicant introductions and the furniture, none of which
 * this build draws, and a phone is the device least able to afford being handed
 * assets on the off chance. The manifests are still the one source of what the
 * art is: what differs is which parts of them are asked for.
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

    this.load.setPath(AUDIO_DIRECTORY);
    Object.keys(SOUNDS).forEach((key) => this.load.audio(key, `${key}.wav`));
    this.load.setPath();
  }

  create() {
    // Both take their manager off whichever scene hands it to them, and the
    // manager is the game's rather than the scene's, so it outlives this scene
    // stopping. Neither plays anything here: a page that opens on a noise is a
    // page nobody opens twice, and the board asks for music when a run starts.
    initSound(this);
    initMusic(this);

    this.scene.start('MobileHomeScene');
  }
}

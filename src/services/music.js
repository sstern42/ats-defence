import {
  MUSIC_KEY,
  MUSIC_ON_BY_DEFAULT,
  MUSIC_PREFERENCE_KEY,
  MUSIC_VOLUME
} from '../config/music.js';

/**
 * The background music: one looping clip, played through the same sound manager
 * as everything else.
 *
 * This file used to be a scheduler. It built oscillators on the audio context
 * and booked chords onto the clock a bar ahead, because there was no clip to
 * play. There is one now, so all of that has gone: the lookahead, the catch-up
 * guard for a throttled background tab, the fade node and the hand rolled
 * envelopes. Phaser owns the decoding, the looping and the autoplay unlock, and
 * it already did for the six sound effects.
 *
 * Two switches decide whether anything is heard. `wanted` is the game saying a
 * run is on, and `enabled` is the player saying they would like music during
 * it. Both have to be true, which is what lets the toggle work in the middle of
 * a wave and lets the music stop at the end of the run without forgetting the
 * setting.
 *
 * There is deliberately no third switch for the sound toggle. The track goes
 * through the game's mixer rather than straight to the destination, and
 * services/audio.js mutes that mixer when sound is turned off, so "sound off
 * means silence, music included" now falls out of where this is connected
 * rather than being checked on a timer. The music keeps its position while
 * muted, which is the same thing a muted clip does.
 *
 * Nothing here can stop the game. On a browser with no Web Audio at all, or
 * where the track failed to decode, every function below is a no-op and the run
 * carries on without music.
 */

let manager = null;
let track = null;

let enabled = readPreference();
let wanted = false;

/**
 * Takes the sound manager off the boot scene.
 *
 * The manager is the game's rather than the scene's, so it outlives this scene
 * stopping and the preference survives a restart of the board.
 */
export function initMusic(scene) {
  manager = scene.sound ?? null;
}

/** A run has started and would like music, if the player has asked for any. */
export function startMusic() {
  wanted = true;
  sync();
}

/** The run is over, or the player has left it. */
export function stopMusic() {
  wanted = false;
  sync();
}

export function musicEnabled() {
  return enabled;
}

/**
 * Turns music on or off and remembers the choice. It takes effect where it is
 * pressed, and turning it back on inside the same run starts the loop again
 * from the top, which on twenty four seconds of hold music is not a thing
 * anybody can hear.
 */
export function toggleMusic() {
  enabled = !enabled;

  writePreference(enabled);
  sync();

  return enabled;
}

function sync() {
  if (enabled && wanted) {
    begin();
  } else {
    end();
  }
}

function begin() {
  if (track || !manager) {
    return;
  }

  // A track that failed to load would otherwise throw here rather than leaving
  // the run in silence, which is the wrong way round for something optional.
  if (!manager.game?.cache?.audio?.exists(MUSIC_KEY)) {
    return;
  }

  track = manager.add(MUSIC_KEY, { loop: true, volume: MUSIC_VOLUME });
  track.play();
}

function end() {
  if (!track) {
    return;
  }

  // Stopped rather than faded. The old service faded because cutting a held
  // sine chord in half is a click; a decoded clip stopped on a player's own
  // button press is not, and a fade here would be the only piece of state left
  // in this file.
  track.stop();
  track.destroy();

  track = null;
}

function readPreference() {
  try {
    const stored = window.localStorage.getItem(MUSIC_PREFERENCE_KEY);

    if (stored === null) {
      return MUSIC_ON_BY_DEFAULT;
    }

    return stored === 'on';
  } catch {
    return MUSIC_ON_BY_DEFAULT;
  }
}

function writePreference(value) {
  try {
    window.localStorage.setItem(MUSIC_PREFERENCE_KEY, value ? 'on' : 'off');
  } catch {
    // Storage is blocked, so the choice holds for this page load and is
    // forgotten on the next one. The same as the sound toggle, and the same
    // shrug.
  }
}

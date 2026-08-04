import {
  MASTER_VOLUME,
  SOUNDS,
  SOUND_ON_BY_DEFAULT,
  SOUND_PREFERENCE_KEY
} from '../config/audio.js';

/**
 * Everything the game knows about sound.
 *
 * Phaser's sound manager is one instance per game rather than one per scene, so
 * this holds a reference to it and the scenes call in here rather than each
 * keeping their own idea of the mix. It means the throttle below is shared, the
 * on and off state survives a scene restart, and a scene that wants a noise
 * writes one line.
 *
 * Nothing here can stop the game. If the clips failed to load, if the browser
 * has no audio at all, or if storage is blocked, every function is a no-op and
 * the run carries on in silence.
 */

let manager = null;
let enabled = readPreference();

/** When each clip last played, for the per clip gap in the manifest. */
const lastPlayedAt = new Map();

/**
 * Takes the manager off the boot scene once the clips are in the cache.
 *
 * Phaser handles the autoplay policy itself: the audio context starts
 * suspended and is resumed on the first click or key press. The game opens on
 * a home page that has to be clicked through, so by the time anything wants to
 * make a noise that has already happened.
 */
export function initSound(scene) {
  manager = scene.sound;
  manager.volume = MASTER_VOLUME;
  manager.mute = !enabled;
}

/**
 * Plays a clip by key, or does nothing, which is the more common case.
 *
 * Fire and forget: Phaser destroys the instance when it finishes, and nothing
 * in this game needs to stop a sound once it has started.
 */
export function playSound(key) {
  const settings = SOUNDS[key];

  if (!manager || !enabled || !settings) {
    return;
  }

  // A clip that failed to load would otherwise warn on every shot for the rest
  // of the run.
  if (!manager.game.cache.audio.exists(key)) {
    return;
  }

  const now = performance.now();

  if (now - (lastPlayedAt.get(key) ?? -Infinity) < settings.minGapMs) {
    return;
  }

  lastPlayedAt.set(key, now);

  manager.play(key, { volume: settings.volume });
}

export function soundEnabled() {
  return enabled;
}

/**
 * Turns sound on or off and remembers the choice. The manager is muted as well
 * as the gate being closed, so a clip already playing stops there and then
 * rather than finishing over the top of the click that turned it off.
 */
export function toggleSound() {
  enabled = !enabled;

  if (manager) {
    manager.mute = !enabled;
  }

  writePreference(enabled);

  return enabled;
}

function readPreference() {
  try {
    const stored = window.localStorage.getItem(SOUND_PREFERENCE_KEY);

    if (stored === null) {
      return SOUND_ON_BY_DEFAULT;
    }

    return stored === 'on';
  } catch {
    return SOUND_ON_BY_DEFAULT;
  }
}

function writePreference(value) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, value ? 'on' : 'off');
  } catch {
    // Storage is blocked. The choice holds for this page load and is forgotten
    // on the next one, which is the least of that player's problems.
  }
}

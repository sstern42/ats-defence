/**
 * The sound manifest. Plain data, the same shape as the sprite manifest, so
 * BootScene does not need to know what any of it is for and the mix can be
 * tuned without opening a scene.
 *
 * Every key is the file name without its extension, and it is also the name
 * the game plays by. The clips are drawn by tools/make-sounds.mjs, so a key
 * here has to match a recipe there.
 *
 * `volume` is per clip, on top of the master below. It is not a taste setting,
 * it is a balance one: rejection fires more often than everything else put
 * together and has to sit under the rest, and a leak is the one thing the
 * player should hear over whatever else is happening.
 *
 * `minGapMs` is how long a clip waits before it will play again. A swarm of
 * Graduates going down under a Culture Fit Panel is a dozen rejections inside a
 * second, and without a gap those stack into a single unpleasant noise.
 */
export const AUDIO_DIRECTORY = 'assets/audio/';

export const SOUNDS = {
  place: { volume: 0.55, minGapMs: 40 },
  reject: { volume: 0.22, minGapMs: 55 },
  leak: { volume: 0.7, minGapMs: 120 },
  'wave-open': { volume: 0.5, minGapMs: 0 },
  'wave-clear': { volume: 0.5, minGapMs: 0 },
  denied: { volume: 0.45, minGapMs: 250 },
  // The seventh, and the only one that fires at most three times in a run, so
  // it is allowed to be the longest and the loudest thing here. The gap is
  // nominal: the cooldown on the button is already longer than the clip.
  'bulk-reject': { volume: 0.75, minGapMs: 300 },
  // The eighth, for the other button, and quieter than the one above it on
  // purpose. That clip is a thing happening to everybody at once and this one is
  // a thing starting, so it announces itself and then gets out of the way of the
  // four seconds it opened. Longer than the cooldown, so the gap is the one
  // place here it is doing real work: two presses inside a second would
  // otherwise put the hold tone on top of itself.
  hold: { volume: 0.6, minGapMs: 650 }
};

/**
 * Everything is scaled by this. Set low, because the game is played in a
 * browser tab next to other things and it is not the sort of game anybody
 * turns up.
 */
export const MASTER_VOLUME = 0.55;

/**
 * Sound is on for a first visit and the choice is remembered after that. On by
 * default because a player who never finds the toggle should still hear the
 * game, and the volume above is set quietly enough that being wrong about that
 * is a minor annoyance rather than a reason to close the tab.
 */
export const SOUND_ON_BY_DEFAULT = true;
export const SOUND_PREFERENCE_KEY = 'requisita.sound';

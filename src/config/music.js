/**
 * The music, as data. There is no file: the notes below are scheduled on the
 * Web Audio clock at run time by services/music.js, so this manifest is the
 * whole of the track.
 *
 * It is written this way for the same reason the sound effects are synthesised
 * rather than licensed. Nothing in this environment can reach an asset host, an
 * uncompressed loop long enough to be worth having would be twenty times the
 * size of every other asset in the game put together, and there is no encoder
 * on the machine to make it smaller. Scheduling it instead costs no bytes at
 * all, never reaches the end of itself, and puts the difference between
 * pleasant and irritating in this file rather than in a binary nobody can edit.
 *
 * What it is meant to be is hold music. Requisita is a piece of enterprise
 * software and this is the sound of being on the phone to one, so the
 * progression is the four chords that every waiting room in the world has
 * settled on, played slowly on sine waves and mixed low enough to be furniture.
 *
 * Semitones are counted from `rootHz`, so 0 is A2, 12 is A3 and so on. Voicings
 * move as little as possible from one chord to the next, which is what keeps a
 * bar change from sounding like an event. Nothing here is read by the game
 * loop, and nothing here can change what a wave costs.
 */
export const MUSIC = {
  /** A2. Everything below is a number of semitones away from it. */
  rootHz: 110,

  /**
   * One chord per bar. Slow enough that a bar change is not a beat, which is
   * the point: this is not music to play along to.
   */
  barSeconds: 4.2,

  /**
   * Dm7, G7, Cmaj7, Fmaj7. The `pad` notes are held for most of the bar, the
   * `bass` note is the root an octave or so under them, and `bell` is the pool
   * the occasional single note over the top is drawn from.
   */
  progression: [
    { pad: [5, 8, 12, 15], bass: -7, bell: [17, 20, 24] },
    { pad: [5, 8, 10, 14], bass: -2, bell: [17, 20, 22] },
    { pad: [3, 7, 10, 14], bass: -9, bell: [19, 22, 26] },
    { pad: [3, 7, 8, 12], bass: -4, bell: [19, 20, 24] }
  ],

  /**
   * The held chord. A long attack and a longer release, so one bar is still
   * fading while the next is arriving and there is never a seam to hear.
   *
   * `detuneCents` is how far each note is allowed to sit off true, picked fresh
   * every bar. It is a couple of cents, which is not enough to hear as being
   * out of tune and is enough to stop four sine waves sounding like one.
   */
  pad: { gain: 0.15, attack: 1.2, hold: 2.2, release: 1.8, detuneCents: 5 },

  /** The root under it. Shorter than the pad, so the bar has a floor and a top. */
  bass: { gain: 0.2, attack: 0.4, hold: 1.5, release: 1.4 },

  /**
   * A single note over the chord, at one of `slots` evenly spaced moments in
   * the bar, each of which fires with probability `chance`.
   *
   * This is the only part that is not the same every time round, and it is the
   * reason the loop can run for a whole game without becoming a loop anybody
   * notices. It is also the quietest thing here, deliberately: it is meant to
   * be caught rather than listened to.
   */
  bell: {
    gain: 0.05,
    attack: 0.01,
    hold: 0.04,
    release: 1.1,
    slots: 4,
    chance: 0.3
  }
};

/**
 * Everything above is scaled by this. Set well under the sound effects, because
 * music that competes with the rejection noise has misunderstood which of the
 * two the player is listening for.
 */
export const MUSIC_VOLUME = 0.18;

/**
 * Off for a first visit, and the choice is remembered after that.
 *
 * The opposite of the sound effects, on purpose. An effect is punctuation on
 * something the player just did, and it is over before anybody could object.
 * Music is a commitment made on their behalf in a tab sitting next to whatever
 * else they are doing, so it is offered rather than started.
 */
export const MUSIC_ON_BY_DEFAULT = false;
export const MUSIC_PREFERENCE_KEY = 'requisita.music';

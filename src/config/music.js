/**
 * The music, as data. There is a file now, and there did not used to be.
 *
 * What was here before was four chords scheduled note by note on the audio
 * clock, written that way because the machine this is built on cannot reach an
 * asset host and has no encoder on it to make a loop small enough to ship. Both
 * of those are still true. The file below arrived by being handed to the build
 * rather than fetched by it, and was encoded by a static ffmpeg pulled from npm
 * into a scratch directory, so neither the repo nor the build gained a
 * dependency for it.
 *
 * What it cost is written down in the README next to the file. The short
 * version is 300kB against a directory that was 68kB, and a loop that comes
 * round every twenty four seconds rather than a progression that never quite
 * repeated. What it bought is a real recording, and the deletion of the two
 * hundred and eighty line scheduler that used to live in services/music.js.
 */

/** The key the track is loaded and played under. */
export const MUSIC_KEY = 'music';

/**
 * Two encodings of the same twenty four seconds, most preferred first. Phaser
 * asks the browser what it can play and fetches exactly one of them.
 *
 * OGG leads, and the order is not a preference. Vorbis loops without a gap and
 * MP3 does not: the format pads both ends of the file, so a track meant to run
 * for a whole intake would tick audibly every time round. The MP3 is there for
 * Safari before 18.4, which could not play Vorbis at all, and a small gap on an
 * old handset beats a music toggle that does nothing.
 */
export const MUSIC_FILES = ['music.ogg', 'music.mp3'];

/**
 * Scaled by the master volume in config/audio.js on the way out, because the
 * track goes through the same mixer as the sound effects now rather than
 * straight to the destination. Set well under them, because music that competes
 * with the rejection noise has misunderstood which of the two the player is
 * listening for.
 *
 * This is the number to move if the mix is wrong on the preview. It is the only
 * one left.
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

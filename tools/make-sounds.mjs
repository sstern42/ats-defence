/**
 * Draws the six sound effects and writes them to public/assets/audio.
 *
 * The art is Kenney's, and the sound was meant to be as well, but nothing in
 * this environment can reach kenney.nl to fetch a pack. Synthesising them here
 * turned out to be the better answer anyway: the clips are a few hundred bytes
 * of description each rather than binaries nobody can edit, the licence
 * question disappears, and a sound that is too loud or too cheerful is a number
 * in this file rather than a hunt for a replacement file.
 *
 * Run it with `node tools/make-sounds.mjs`. It is a build-time tool and nothing
 * in the game imports it, so it uses Node built-ins only and adds no
 * dependency. The output is committed, so this only needs running when one of
 * the recipes below changes.
 *
 * Everything is sine based, on purpose. Square and sawtooth waves alias badly
 * at this sample rate and, more to the point, they sound like a video game.
 * Requisita is not a video game, it is a piece of enterprise software, so the
 * palette is dull knocks, flat beeps and one low buzz for when things go wrong.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'assets',
  'audio'
);

/**
 * 22.05kHz mono. Half of CD rate, which halves the file size and is plenty for
 * clips whose highest note is under 700Hz. Every browser the game targets
 * decodes 16 bit PCM WAV, so there is one format and no fallback list.
 */
const SAMPLE_RATE = 22050;

/** Peak each finished clip is normalised to, leaving a little headroom. */
const PEAK = 0.89;

/**
 * One voice: a sine at `freq`, optionally gliding to `freqEnd`, with whatever
 * harmonics are asked for stacked on top at the given relative gains.
 *
 * The envelope is a short linear attack followed by a power curve down to
 * silence. The attack is what stops a click at the start, and the curve is what
 * decides whether something reads as a knock (steep) or a hum (shallow).
 */
function tone({
  start = 0,
  duration,
  freq,
  freqEnd = freq,
  gain = 1,
  harmonics = [1],
  attack = 0.004,
  curve = 3
}) {
  const length = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(length);
  let phase = 0;

  for (let i = 0; i < length; i += 1) {
    const progress = i / length;
    const frequency = freq + (freqEnd - freq) * progress;

    // Integrating the frequency rather than recomputing the angle from
    // absolute time is what keeps a glide continuous instead of stepping.
    phase += (2 * Math.PI * frequency) / SAMPLE_RATE;

    const attackSamples = Math.max(1, attack * SAMPLE_RATE);
    const rise = Math.min(1, i / attackSamples);
    const fall = Math.pow(1 - progress, curve);

    let value = 0;

    harmonics.forEach((level, index) => {
      value += level * Math.sin(phase * (index + 1));
    });

    samples[i] = value * rise * fall * gain;
  }

  return { start, samples };
}

/**
 * A burst of noise with a one pole low pass over it, which is the difference
 * between a stamp on paper and radio static. Used for the body of the knocks,
 * never on its own.
 */
function noise({ start = 0, duration, gain = 1, cutoff = 0.16, curve = 5 }) {
  const length = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(length);
  let previous = 0;

  for (let i = 0; i < length; i += 1) {
    const progress = i / length;
    const white = Math.random() * 2 - 1;

    previous += cutoff * (white - previous);
    samples[i] = previous * Math.pow(1 - progress, curve) * gain;
  }

  return { start, samples };
}

/**
 * Lays the voices over one another at their offsets and normalises the result,
 * so the recipes can be written in terms of relative loudness and the clip
 * still comes out at a sensible level.
 */
function mix(voices) {
  const length = voices.reduce(
    (longest, voice) =>
      Math.max(longest, Math.round(voice.start * SAMPLE_RATE) + voice.samples.length),
    0
  );

  const output = new Float64Array(length);

  voices.forEach(({ start, samples }) => {
    const offset = Math.round(start * SAMPLE_RATE);

    for (let i = 0; i < samples.length; i += 1) {
      output[offset + i] += samples[i];
    }
  });

  const peak = output.reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);
  const scale = peak > 0 ? PEAK / peak : 0;

  for (let i = 0; i < length; i += 1) {
    output[i] *= scale;
  }

  return output;
}

/** Mono 16 bit PCM, which is the plainest thing a browser will decode. */
function toWav(samples) {
  const header = Buffer.alloc(44);
  const body = Buffer.alloc(samples.length * 2);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + body.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(body.length, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));

    body.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  return Buffer.concat([header, body]);
}

/**
 * The six clips. Keys are file names, and they are the same keys the game
 * loads by, so src/config/audio.js and this list have to agree.
 */
const RECIPES = {
  /**
   * A screening process is installed. A rubber stamp: a low knock with a short
   * paper rustle over it. Deliberately not a chime, since the player has just
   * done paperwork, not cast a spell.
   */
  place: [
    tone({ duration: 0.08, freq: 196, freqEnd: 172, curve: 4 }),
    noise({ duration: 0.035, gain: 0.35, cutoff: 0.28 })
  ],

  /**
   * An applicant is rejected. This one fires more than all the others put
   * together, so it is the shortest and the flattest thing here: two tones
   * down, no tail, nothing to notice the fiftieth time.
   */
  reject: [
    tone({
      duration: 0.07,
      freq: 700,
      freqEnd: 520,
      harmonics: [1, 0.12],
      curve: 3
    })
  ],

  /**
   * Somebody got through to a human. A low buzz with its harmonics left in, so
   * it sits under everything else and sounds mildly wrong, which it is.
   */
  leak: [
    tone({
      duration: 0.32,
      freq: 150,
      freqEnd: 116,
      harmonics: [1, 0.45, 0.22],
      attack: 0.012,
      curve: 2
    })
  ],

  /**
   * Applications open. Two notes up, the only genuinely optimistic sound in
   * the game, and it is optimistic on behalf of the applicants.
   */
  'wave-open': [
    tone({ duration: 0.1, freq: 440, harmonics: [1, 0.18], curve: 3 }),
    tone({ start: 0.095, duration: 0.16, freq: 587, harmonics: [1, 0.18], curve: 3 })
  ],

  /**
   * The intake has been screened. Three notes down, settling, the sound of a
   * drawer closing on a batch of applications nobody will read again.
   */
  'wave-clear': [
    tone({ duration: 0.09, freq: 659, harmonics: [1, 0.15], curve: 3 }),
    tone({ start: 0.085, duration: 0.09, freq: 554, harmonics: [1, 0.15], curve: 3 }),
    tone({
      start: 0.17,
      duration: 0.24,
      freq: 440,
      harmonics: [1, 0.15],
      curve: 2.2
    })
  ],

  /**
   * The budget will not stretch to that, or the salary expectations are
   * already set. A dead thud with no pitch in it to speak of. Nothing has
   * happened, and it should sound like nothing happened.
   */
  denied: [
    tone({ duration: 0.13, freq: 124, freqEnd: 112, curve: 4 }),
    noise({ duration: 0.05, gain: 0.22, cutoff: 0.1 })
  ]
};

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

Object.entries(RECIPES).forEach(([key, voices]) => {
  const samples = mix(voices);
  const wav = toWav(samples);

  writeFileSync(join(OUTPUT_DIRECTORY, `${key}.wav`), wav);

  const ms = Math.round((samples.length / SAMPLE_RATE) * 1000);

  console.log(`${key}.wav  ${ms}ms  ${(wav.length / 1024).toFixed(1)}kB`);
});

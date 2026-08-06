import {
  MUSIC,
  MUSIC_ON_BY_DEFAULT,
  MUSIC_PREFERENCE_KEY,
  MUSIC_VOLUME
} from '../config/music.js';
import { soundEnabled } from './audio.js';

/**
 * The background music, played rather than loaded.
 *
 * There is no clip to fetch. This builds oscillators on the audio context
 * Phaser already owns and schedules the chords in config/music.js onto them a
 * bar or two ahead of the clock, which is the standard way to keep time in Web
 * Audio: setInterval is nowhere near accurate enough to fire a note on, but it
 * is quite accurate enough to book one for later.
 *
 * Two switches decide whether anything is heard. `wanted` is the game saying a
 * run is on, and `enabled` is the player saying they would like music during
 * it. Both have to be true, which is what lets the toggle work in the middle of
 * a wave and lets the music stop at the end of the run without forgetting the
 * setting.
 *
 * Nothing here can stop the game. On a browser with no Web Audio at all, or
 * where the context never starts, every function below is a no-op and the run
 * carries on without music.
 */

/** How often the scheduler wakes up, and how far ahead it books, in seconds. */
const TICK_SECONDS = 0.25;
const LOOKAHEAD_SECONDS = 1.5;

/**
 * How long the mix takes to arrive or get out of the way when the sound toggle
 * is flipped. Short enough to read as immediate, long enough not to click.
 */
const FADE_SECONDS = 0.12;

let context = null;
let master = null;
let timer = null;

let enabled = readPreference();
let wanted = false;

/** Where the next bar starts on the audio clock, and which bar it is. */
let nextBarAt = 0;
let barIndex = 0;

/**
 * Takes the audio context off the boot scene.
 *
 * Only the Web Audio sound manager has one. On the fallback managers, and where
 * the browser has no audio at all, there is nothing to take and the service
 * stays switched off for the rest of the page.
 */
export function initMusic(scene) {
  context = scene.sound?.context ?? null;
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
 * pressed: mid-wave the chords start on the next bar, and stopping takes the
 * mix down over a moment rather than cutting a held chord in half.
 */
export function toggleMusic() {
  enabled = !enabled;

  writePreference(enabled);
  sync();

  return enabled;
}

function sync() {
  if (context && enabled && wanted) {
    begin();
  } else {
    end();
  }
}

/**
 * Everything runs through one gain node, so the sound toggle has a single place
 * to close and stopping the music takes the notes already booked with it.
 *
 * It goes straight to the destination rather than through Phaser's mixer.
 * Phaser's master volume and mute are for the clips it owns, and reaching into
 * its node graph to sit under them would be relying on the shape of somebody
 * else's internals for no gain: the toggle below is read on every tick anyway.
 */
function begin() {
  if (timer) {
    return;
  }

  // The context is started by Phaser on the first click, and the game opens on
  // a page that has to be clicked through, so this is belt and braces for a
  // browser that suspends it again while the tab is away.
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }

  master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  nextBarAt = context.currentTime + 0.15;
  barIndex = 0;

  tick();

  timer = window.setInterval(tick, TICK_SECONDS * 1000);
}

function end() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }

  if (!master) {
    return;
  }

  const finished = master;
  const now = context.currentTime;

  // Whatever is holding at the moment is faded rather than cut, and the node is
  // let go once it is silent. The oscillators hanging off it stop themselves at
  // the times they were given.
  finished.gain.cancelScheduledValues(now);
  finished.gain.setValueAtTime(finished.gain.value, now);
  finished.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);

  window.setTimeout(() => finished.disconnect(), FADE_SECONDS * 1000 + 100);

  master = null;
}

/**
 * Books every bar that starts inside the next second and a half.
 *
 * The catch-up guard matters more than it looks. A background tab has its
 * timers throttled and can be left alone for minutes at a time, and without it
 * the loop below would come back to find a dozen bars overdue and play them all
 * at once.
 */
function tick() {
  if (!master) {
    return;
  }

  const now = context.currentTime;
  const level = soundEnabled() ? MUSIC_VOLUME : 0;

  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(level, now + FADE_SECONDS);

  if (nextBarAt < now) {
    nextBarAt = now;
  }

  while (nextBarAt < now + LOOKAHEAD_SECONDS) {
    // Nothing is booked while the sound is off, so a muted run is a timer and
    // no oscillators. It picks up again on the next bar when it comes back.
    if (level > 0) {
      scheduleBar(nextBarAt, barIndex);
    }

    nextBarAt += MUSIC.barSeconds;
    barIndex += 1;
  }
}

/**
 * One bar: the chord, the root under it, and whatever the dice say about the
 * single notes over the top.
 */
function scheduleBar(at, index) {
  const chord = MUSIC.progression[index % MUSIC.progression.length];
  const { pad, bass, bell } = MUSIC;

  chord.pad.forEach((semitone) => {
    voice({
      at,
      semitone,
      detune: (Math.random() * 2 - 1) * pad.detuneCents,
      ...pad
    });
  });

  voice({ at, semitone: chord.bass, ...bass });

  const slot = MUSIC.barSeconds / bell.slots;

  for (let position = 0; position < bell.slots; position += 1) {
    if (Math.random() > bell.chance) {
      continue;
    }

    voice({
      at: at + position * slot,
      semitone: chord.bell[Math.floor(Math.random() * chord.bell.length)],
      ...bell
    });
  }
}

/**
 * One note. A sine with a linear attack, a hold and a release, which is the
 * same shape the sound effects are drawn with and for the same reason: anything
 * with corners on it at this volume is a click rather than a note.
 */
function voice({
  at,
  semitone,
  gain,
  attack,
  hold,
  release,
  detune = 0
}) {
  const oscillator = context.createOscillator();
  const level = context.createGain();
  const until = at + attack + hold + release;

  oscillator.type = 'sine';
  oscillator.frequency.value = MUSIC.rootHz * Math.pow(2, semitone / 12);
  oscillator.detune.value = detune;

  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(gain, at + attack);
  level.gain.setValueAtTime(gain, at + attack + hold);
  level.gain.linearRampToValueAtTime(0, until);

  oscillator.connect(level).connect(master);

  oscillator.start(at);
  oscillator.stop(until + 0.02);

  oscillator.onended = () => level.disconnect();
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

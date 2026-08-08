import Phaser from 'phaser';

import { COPY } from './content/copy.js';
import BootScene from './scenes/BootScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import GameScene from './scenes/GameScene.js';
import HomeScene from './scenes/HomeScene.js';
import PauseScene from './scenes/PauseScene.js';
import UIScene from './scenes/UIScene.js';
import { initAnalytics } from './services/analytics.js';
import { initExperiments } from './services/experiments.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1024,
  height: 768,
  backgroundColor: '#14161a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // Only the first scene starts on boot. BootScene loads the art and starts
  // HomeScene, which starts GameScene when the player asks for a run, which
  // launches the rest of them.
  //
  // The order is the drawing order, so the two scenes that go over a held board
  // come after the HUD they have to cover.
  scene: [BootScene, HomeScene, GameScene, UIScene, GameOverScene, PauseScene]
};

/**
 * Whether this screen has room for the landscape board.
 *
 * Room is the whole test. There used to be a second one, for a fine pointer,
 * because placing a tower meant hovering a tile to read its range before
 * committing and a finger cannot hover. The drag gesture gave the finger a way
 * to do that, so the reason for the test went and the test went with it.
 *
 * What is left turns away phones without having to ask what anything is. No
 * phone in landscape has six hundred pixels of height, and none in portrait has
 * nine hundred of width, so the shape of the screen answers it. A tablet clears
 * both and renders the fixed 1024 by 768 board at close to its own size, which
 * is the case this was opened up for.
 *
 * What it does not test is the HUD, which is still drawn at a size that suits a
 * mouse. That is the thing to watch on a tablet, and the reason phones stay out
 * even once they are big enough.
 *
 * It used to be called isSupported, and the rename is the whole of what changed
 * about it. The test answers which shape of the game a screen gets rather than
 * whether it gets one at all, and a function that reports a verdict it no longer
 * reaches is a function that will be read wrongly.
 */
function hasRoomForTheBoard() {
  return window.innerWidth >= 900 && window.innerHeight >= 600;
}

/**
 * Which shape of the game this screen gets, and whether it was asked for by
 * name.
 *
 * The decision has always been made here, by the test above, and this is the
 * same decision with somewhere for a second answer to go. Today there is only
 * one shape built, so `phone` still ends at the honest refusal it always did.
 * What the seam buys before then is the override.
 *
 * `?shape=phone` is the reviewing mechanism for everything that follows it.
 * There is no dev server anybody can look at, so a deploy preview is the only
 * way the game gets seen, and without a way to ask for the phone shape from a
 * laptop every later mobile change is reviewable only on a handset. That is the
 * same argument the bench's own parameter is on, and it is why this landed
 * before the thing it routes to rather than with it.
 *
 * It overrides in both directions, so a phone can be handed the landscape board
 * to see what it is being spared.
 */
function resolveShape() {
  const asked = new URLSearchParams(window.location.search).get('shape');

  if (asked === 'phone' || asked === 'desktop') {
    return { name: asked, forced: true };
  }

  return { name: hasRoomForTheBoard() ? 'desktop' : 'phone', forced: false };
}

function showUnsupported() {
  const parent = document.getElementById('game');

  parent.className = 'unsupported';
  parent.innerHTML = `
    <h1></h1>
    <p></p>
    <p></p>
  `;

  // Written in rather than interpolated, so a string from copy.js is never
  // parsed as markup.
  const [title, body, note] = [
    parent.querySelector('h1'),
    ...parent.querySelectorAll('p')
  ];

  title.textContent = COPY.unsupported.title;
  body.textContent = COPY.unsupported.body;
  note.textContent = COPY.unsupported.note;
}

/**
 * The experiment resolves first, because every analytics event carries the
 * assignment and the very first one is sent by initAnalytics. It has its own
 * short timeout and cannot fail in a way that stops the game, so this waits on
 * it rather than racing it.
 *
 * Analytics start on a refused screen too. How many people arrive on a phone and
 * bounce is worth knowing, and `device_type` is on every event, so that question
 * answers itself as long as the session is opened. The two things that open no
 * session at all are the bench and a shape that was asked for by name, and both
 * are below with their reasons.
 */
async function boot() {
  // The measurement harness for issue #47, and the one thing that runs before
  // anything else in this function.
  //
  // Before initAnalytics rather than after it, because a profiling run is not a
  // session. Every reading taken off a handset would otherwise write a
  // `session_started` that never played anything, on the one device type the
  // bounce rate is currently being read for.
  //
  // Behind an explicit parameter nobody arrives at by accident, so the size gate
  // below is untouched and a phone that turns up on its own still gets the
  // honest refusal it has always had. There is no mobile game to route to yet.
  if (new URLSearchParams(window.location.search).has('bench')) {
    const { startBench } = await import('./bench/index.js');

    startBench();

    return;
  }

  const shape = resolveShape();

  // A shape that was asked for by name is somebody reviewing a build, not
  // somebody playing, and it opens no session.
  //
  // The reasoning is the bench's, and the contamination here is worse than the
  // bench's would have been. A laptop asking for the phone shape sends
  // `device_type: desktop` on every event it writes, so a review session does
  // not merely add a run that was never played, it adds one that is indexed
  // under the device it was not on. Nothing downstream could tell it apart.
  //
  // What it costs is that the events log kept on `window` is not there either,
  // so checking that the mobile build emits anything has to happen on a real
  // handset. That is a real gap and it is the cheaper of the two.
  if (!shape.forced) {
    await initExperiments();

    initAnalytics();
  }

  // The phone shape has nothing behind it yet, so it ends where it always has.
  // When the mobile scene set lands this is the line it lands on, and the
  // refusal goes back to covering only what it cannot serve at all: a device
  // with no WebGL, and a phone held the wrong way round.
  if (shape.name === 'phone') {
    showUnsupported();

    return;
  }

  new Phaser.Game(config);
}

boot();

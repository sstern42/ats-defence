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
import { setMode } from './services/mode.js';
import { registerServiceWorker } from './services/pwa.js';

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
 * What is left sorts phones from everything else without having to ask what
 * anything is. No phone in landscape has six hundred pixels of height, and none
 * in portrait has nine hundred of width, so the shape of the screen answers it.
 * A tablet clears both and renders the fixed 1024 by 768 board at close to its
 * own size, which is the case this was opened up for.
 *
 * What it does not test is the HUD, which is still drawn at a size that suits a
 * mouse. That is the thing to watch on a tablet, and it is the reason a phone
 * gets the other board rather than this one at a smaller scale.
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
 * same decision with somewhere for a second answer to go. Both answers are now
 * a game. `phone` used to end at an honest refusal and it ends at the portrait
 * board instead, which is the whole of what this release is.
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

/**
 * The refusal page, whatever is being refused.
 *
 * It used to be one screen with one message written into it. There are three
 * things to turn away now, and only one of them is about the size of the screen,
 * so what is said is passed in rather than looked up here.
 */
function showRefusal(titleText, bodyText, noteText) {
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

  title.textContent = titleText;
  body.textContent = bodyText;
  note.textContent = noteText;
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
  // below is untouched and a phone that turns up on its own gets the game rather
  // than a profiler.
  if (new URLSearchParams(window.location.search).has('bench')) {
    const { startBench } = await import('./bench/index.js');

    startBench();

    return;
  }

  // Everything the game does about being installable, and it is one call
  // because the manifest and the worker are files rather than code.
  //
  // After the bench and before everything else. After, because a profiling run
  // is measuring how long the board takes to load and a cache sat in front of
  // the network would be measuring something else. Before, because every route
  // below this line ends at something worth having offline, the two refusals
  // included: a browser that cannot draw the board is still better off being
  // told so with no signal than being shown nothing at all.
  registerServiceWorker();

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
  // What it costs is less than this comment used to claim. It said the events
  // log kept on `window` was not there either, so checking that the mobile build
  // emits anything had to happen on a handset. That was never true: `track`
  // records before it sends, and only the send is gated on a session having been
  // opened, so `?shape=phone` still fills `window.requisita.events` and
  // `?analytics` still prints them. What a review genuinely cannot check from a
  // laptop is that anything leaves the browser, which is the narrower gap and
  // the one worth stating.
  // The mode is decided here, before the session is opened, and not by the
  // scene set that will play it.
  //
  // It used to be set inside startMobile, which is after the dynamic import
  // below and therefore after both of the events that open a session have
  // already gone. `mode` is a global property on every event, so a phone was
  // sending `session_started` and the GrowthBook exposure marked classic and
  // then every event after them marked oneClickApply, which is one session
  // claiming to be two things.
  //
  // The exposure is the half that mattered. The starting difficulty experiment
  // varies classic wave one, the cross-check that reads exposures deliberately
  // does not filter on mode, and a phone player bucketed and filed as classic
  // therefore sat in the denominator of an experiment they could not have seen.
  //
  // Nothing changes for the other three. A desktop session opens on the default
  // and the player picks a mode on the home screen afterwards, which is
  // `session_started` recording the setting rather than a decision, as it
  // always did. A phone has no such choice to make: the shape decides, the
  // decision has already been taken by the time this line runs, and this is
  // where it gets written down.
  if (shape.name === 'phone') {
    setMode('oneClickApply');
  }

  if (!shape.forced) {
    await initExperiments();

    initAnalytics();
  }

  // The phone shape has a game behind it for everybody now, and the `forced`
  // test that used to stand here is gone.
  //
  // It was there because what sat behind the shape was a board with no waves, no
  // HUD and no way to lose gracefully, and putting that in front of somebody who
  // came to the address off a launch post is worse than turning them away
  // honestly. That reason has run out. The board has eight intakes, a tuned
  // wave list, cards, a leaderboard and a way to end, so the honest thing and
  // the playable thing are now the same thing.
  //
  // The override stays, and only its second half is still load bearing:
  // `?shape=desktop` on a phone, and `?shape=phone` on a laptop, which is how
  // every change to either board gets reviewed. What it no longer decides is
  // whether anybody gets a game.
  //
  // Two honest refusals are left and neither is about the size of the screen.
  // No WebGL is below. Landscape is inside watchOrientation, because a run
  // survives being turned sideways and a refusal that ends the page would not.
  if (shape.name === 'phone') {
    const { hasWebgl, startMobile, watchOrientation } = await import(
      './mobile/index.js'
    );

    // Asked before the game is built, because the board is forced onto a WebGL
    // context and forcing one that cannot be had is a blank screen with nothing
    // to read on it.
    if (!hasWebgl()) {
      showRefusal(
        COPY.phoneRefusal.rendererTitle,
        COPY.phoneRefusal.rendererBody,
        COPY.phoneRefusal.rendererNote
      );

      return;
    }

    startMobile();
    watchOrientation();

    return;
  }

  new Phaser.Game(config);
}

boot();

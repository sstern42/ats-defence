/**
 * Which mode the current run is being played in.
 *
 * Held here rather than passed between scenes, for the same reason the run id
 * is held in analytics.js: four separate places need it and only one of them is
 * downstream of the screen that chose it. GameScene builds a board from it, the
 * HUD copy reads it, the game over screen submits to the board it belongs to,
 * and every analytics event carries it. Threading it through scene data would
 * mean a restart or a pause that dropped it, which is exactly the sort of thing
 * that goes unnoticed until the data is being read months later.
 *
 * It is deliberately a run-level setting rather than a session-level one. A
 * player can go back to the front page and pick the other one, and the next run
 * is that one.
 *
 * Anything unrecognised falls back to classic, so a mode key that stops
 * existing plays the normal game rather than a broken one.
 */
import { DEFAULT_MODE, MODES } from '../config/modes.js';

let current = DEFAULT_MODE;

/**
 * Chooses the mode for runs from here on. Called by the home screen and by
 * nothing else, because a mode that changed underneath a run in progress would
 * make both the run and its events unreadable.
 */
export function setMode(key) {
  current = MODES[key] ? key : DEFAULT_MODE;
}

export function currentModeKey() {
  return current;
}

export function currentMode() {
  return MODES[current];
}

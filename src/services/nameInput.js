import Phaser from 'phaser';

import { NAME_CHARACTER, NAME_MAX_LENGTH } from '../config/leaderboard.js';
import { COPY } from '../content/copy.js';

/**
 * Anything smaller than sixteen pixels makes iOS zoom the page when the field
 * takes focus, and the board is a fixed size, so that zoom would have to be
 * undone by hand. The text is never seen, so the size is only ever about this.
 */
const FONT_SIZE = 16;

/** Clear space left under the field when it is lifted off the keyboard. */
const KEYBOARD_GAP = 12;

/**
 * An invisible text field, sat exactly over the name box the game draws.
 *
 * The game over screen drew its own box and fed it from key presses, which is
 * the right shape for a screen made of one canvas and cost nothing until a
 * device turned up with no keys to press. A soft keyboard only opens for a real
 * form field, and only when the player's own tap lands on it: Phaser reads its
 * pointers a frame late, so asking for focus from a Phaser handler is asking
 * outside the gesture and iOS answers by doing nothing.
 *
 * So the field is real and the tap is its own. Everything visible is still
 * drawn on the canvas, and this holds the text and hands it back, which is why
 * it is invisible rather than merely plain. It is only built for a coarse
 * pointer, so nothing about the keyboard route moves.
 *
 * Two things have to be kept up with. The canvas is scaled to fit, so the box
 * is somewhere different on every screen, and the keyboard covers the bottom
 * half of the one it opens on, which on a tablet is where the box is.
 */
export default class NameInput {
  constructor(
    scene,
    { x, y, width, height, spare = 0, onChange, onSubmit, onFocus }
  ) {
    this.scene = scene;
    this.box = { x, y, width, height };
    this.spare = spare;
    this.onChange = onChange;
    this.onSubmit = onSubmit;
    this.onFocus = onFocus;
    this.focused = false;
    this.destroyed = false;

    const element = document.createElement('input');

    element.type = 'text';
    element.maxLength = NAME_MAX_LENGTH;
    element.spellcheck = false;
    element.setAttribute('aria-label', COPY.leaderboard.namePrompt);
    element.setAttribute('autocomplete', 'off');
    element.setAttribute('autocorrect', 'off');
    element.setAttribute('autocapitalize', 'off');
    element.setAttribute('enterkeyhint', 'done');

    Object.assign(element.style, {
      position: 'absolute',
      margin: '0',
      padding: '0',
      border: '0',
      outline: 'none',
      background: 'transparent',
      fontSize: `${FONT_SIZE}px`,
      // The canvas draws the name and the caret. This one only catches the tap
      // and keeps the letters, so there is nothing here worth showing and a
      // second caret next to the drawn one would only ever be wrong.
      opacity: '0',
      touchAction: 'manipulation'
    });

    element.addEventListener('input', () => this.read());
    element.addEventListener('focus', () => this.setFocused(true));
    element.addEventListener('blur', () => this.setFocused(false));

    element.addEventListener('keydown', (event) => {
      // A keyboard case on a tablet ends up here rather than in the scene's
      // handler, so the key that files a score has to work in both places.
      if (event.key === 'Enter') {
        event.preventDefault();
        this.onSubmit?.();
      }
    });

    this.element = element;

    // Sat in the page rather than inside the parent, because the parent is what
    // gets moved when the keyboard is up and this has to be measured against
    // the canvas afterwards rather than carried along with it.
    document.body.appendChild(element);

    this.refresh();

    this.handleChange = () => this.refresh();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleChange);
    window.addEventListener('scroll', this.handleChange, true);
    window.visualViewport?.addEventListener('resize', this.handleChange);
    window.visualViewport?.addEventListener('scroll', this.handleChange);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  /**
   * Puts the field back over the drawn box, and lifts the game clear of the
   * keyboard if the keyboard has arrived on top of it.
   *
   * The lift is dropped before anything is measured, so this says the same
   * thing however many times it is called and the game settles back down on its
   * own once the keyboard goes.
   */
  refresh() {
    this.lift(0);
    this.place();

    if (!this.focused) {
      return;
    }

    this.lift(this.covered());
    this.place();
  }

  /**
   * How far the keyboard has come up over the field, in page pixels.
   *
   * The `spare` below it counts as part of the field. Bringing the box up and
   * leaving the button that sends it underneath the keyboard would be half an
   * answer, and the caller knows where its button is.
   */
  covered() {
    const viewport = window.visualViewport;

    if (!viewport) {
      return 0;
    }

    const bounds = this.element.getBoundingClientRect();
    const visibleBottom = viewport.offsetTop + viewport.height;
    const wanted = bounds.bottom + this.spare * this.scaling().y + KEYBOARD_GAP;

    return Math.max(0, wanted - visibleBottom);
  }

  /**
   * Page pixels per game pixel. The canvas's own rectangle is asked rather than
   * the scale manager's cached copy of it, since a lift moves the canvas
   * without anything telling the scale manager so.
   */
  scaling() {
    const bounds = this.scene.game.canvas.getBoundingClientRect();

    return {
      bounds,
      x: bounds.width / this.scene.scale.width,
      y: bounds.height / this.scene.scale.height
    };
  }

  /**
   * The canvas is drawn at a fixed 1024 by 768 and stretched to fit, so a box
   * in game coordinates is somewhere else again in page ones.
   */
  place() {
    const { bounds, x: scaleX, y: scaleY } = this.scaling();
    const { x, y, width, height } = this.box;

    Object.assign(this.element.style, {
      left: `${bounds.left + window.scrollX + (x - width / 2) * scaleX}px`,
      top: `${bounds.top + window.scrollY + (y - height / 2) * scaleY}px`,
      width: `${width * scaleX}px`,
      height: `${height * scaleY}px`
    });
  }

  /** Moves the whole game up by this many pixels. Zero puts it back. */
  lift(pixels) {
    const parent = this.scene.scale?.parent;

    if (!parent) {
      return;
    }

    parent.style.transform = pixels > 0 ? `translateY(${-pixels}px)` : '';

    // The scale manager keeps its own note of where the canvas is and only
    // re-reads it on a resize or a scroll, and a transform is neither. Without
    // this the board would answer taps in the wrong place while it is lifted.
    this.scene.scale.updateBounds();
  }

  setFocused(focused) {
    this.focused = focused;

    this.refresh();
    this.onFocus?.(focused);
  }

  /**
   * Puts a name that arrived some other way into the field.
   *
   * A tablet with a keyboard case can type at the drawn box without ever
   * tapping it, since the scene is still listening for keys. The field would
   * otherwise open empty and throw that away on the first letter it was given.
   */
  take(name) {
    this.element.value = name;
  }

  /**
   * The same rules the drawn box enforced on each key press, applied to
   * whatever a soft keyboard put in the field. Predictive text can arrive as a
   * whole word, and emoji can arrive at all, so this is a filter rather than a
   * check.
   */
  read() {
    const clean = Array.from(this.element.value)
      .filter((character) => NAME_CHARACTER.test(character))
      .join('')
      .slice(0, NAME_MAX_LENGTH);

    // Only written back when it actually changed, since assigning to value
    // sends the caret to the end of whatever was being edited.
    if (clean !== this.element.value) {
      this.element.value = clean;
    }

    this.onChange?.(clean);
  }

  /** Called once the score is filed. There is nothing left to type. */
  finish() {
    this.element.readOnly = true;
    this.element.blur();
  }

  /**
   * Takes the field out of the page while something is drawn over the box, and
   * puts it back afterwards.
   *
   * It exists because the field is invisible and the game is one canvas, so a
   * screen drawn on top of the box has no way to cover it: a tap that looks
   * like it landed on whatever is now there would instead focus a field nobody
   * can see and open a keyboard for it. The phone board's leaderboard is drawn
   * over the game over screen, which is where that happens.
   *
   * `display` rather than moving it away, so it cannot be focused, tabbed to or
   * read out while it is parked. Blurred on the way out, since hiding a focused
   * field leaves the keyboard up on its own.
   */
  park(parked) {
    if (parked) {
      this.element.blur();
    }

    this.element.style.display = parked ? 'none' : '';

    if (!parked) {
      this.refresh();
    }
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.lift(0);

    this.scene.scale?.off(Phaser.Scale.Events.RESIZE, this.handleChange);
    window.removeEventListener('scroll', this.handleChange, true);
    window.visualViewport?.removeEventListener('resize', this.handleChange);
    window.visualViewport?.removeEventListener('scroll', this.handleChange);

    this.element.remove();
  }
}

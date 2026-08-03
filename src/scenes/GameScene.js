import Phaser from 'phaser';

const PLACEHOLDER_KEY = 'placeholder';
const PLACEHOLDER_SIZE = 96;

/**
 * Step one only. Draws a single placeholder sprite so the build can be proved
 * end to end on a Netlify deploy preview. Real art arrives later.
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // Bake a plain square into a texture, so what renders is a genuine sprite
    // rather than a shape, and the texture pipeline gets exercised too.
    const graphics = this.add.graphics();

    graphics.fillStyle(0x4c9f70, 1);
    graphics.fillRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
    graphics.generateTexture(PLACEHOLDER_KEY, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
    graphics.destroy();

    const { width, height } = this.scale;

    this.add.image(width / 2, height / 2, PLACEHOLDER_KEY);
  }
}

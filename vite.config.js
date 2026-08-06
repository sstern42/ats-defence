import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';

/**
 * The version the build was cut from, read out of package.json at build time
 * and dropped into the bundle as a literal.
 *
 * package.json is the single source of truth for the version, and this is what
 * keeps it that way: the number is never typed into the game, so the footer
 * cannot drift from the file the release rules talk about. Reading the file
 * rather than importing it keeps the rest of package.json, dependency list and
 * all, out of the client bundle.
 */
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  }
});

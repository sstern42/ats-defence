/**
 * The sprite manifest. Plain data, so BootScene does not need to know what any
 * of it is for and nothing else needs to know where the files live.
 *
 * Every key is also the file name without its extension, which is the whole
 * reason the loader can be four lines long. Towers and applicants name the
 * sprite they want in their own config, so this list is only ever read by the
 * loader.
 *
 * The art is Kenney's, under CC0, and it has been cropped, greyscaled and in
 * places turned. See public/assets/kenney/ATTRIBUTION.md for what was changed
 * and which original each one came from.
 */
export const ART_DIRECTORY = 'assets/kenney/';

export const ART_KEYS = [
  // Tower parts. A tower is a base with the type's colour on it, and, for the
  // ones that have anything to point, a grey turret that turns.
  'tower-base',
  'turret-twin',
  'turret-missile',
  'turret-sensor',
  'turret-rack',
  'turret-dish',
  'trap-pad',

  // Applicants. The small ones walk, the vehicles are the heavy ones.
  'unit-round',
  'unit-finned',
  'unit-plain',
  'unit-slim',
  'vehicle-wide',
  'vehicle-boxy',

  // What a hit looks like.
  'spark',
  'flame'
];

# Sound credit

Nobody's. These six clips are drawn by `tools/make-sounds.mjs`, which is a
hundred lines of sine waves and envelopes using Node built-ins and no
dependency.

The plan was to use a Kenney audio pack, to match the art. The machine this was
built on cannot reach kenney.nl, so they were synthesised instead, and that
turned out to be the better answer: there is no licence question, each clip is a
short recipe that can be read and edited rather than a binary that has to be
replaced, and a sound that is too loud or too cheerful is a number in a file.

## Regenerating

```bash
node tools/make-sounds.mjs
```

The output is committed, so this only needs running when a recipe changes. The
file names are the keys the game plays by, so a new clip means a recipe in the
script and an entry in `src/config/audio.js`.

## What each one is

| File | When |
| --- | --- |
| `place.wav` | A screening process is installed, or a trap is laid. A rubber stamp. |
| `reject.wav` | An applicant is screened out. Two tones down, and the shortest thing here, because it fires more than everything else put together. |
| `leak.wav` | Somebody reached a human. A low buzz that sounds mildly wrong. |
| `wave-open.wav` | Applications open. Two notes up, the only optimistic sound in the game, and it is optimistic on behalf of the applicants. |
| `wave-clear.wav` | The intake has been screened. Three notes down, settling. |
| `denied.wav` | The budget will not stretch to it, or the salary expectations are already set. A dead thud, because nothing happened. |

## Music

There is no music file here, and there is not going to be one. The background
music is scheduled note by note on the audio clock at run time, from the chords
in `src/config/music.js`, by `src/services/music.js`.

That is the same argument as above taken one step further. An uncompressed loop
long enough to be worth having is over a megabyte, which is twenty times the
whole of this directory, and there is no encoder on the machine this is built on
to make it any smaller. Scheduling it costs nothing to download, never reaches
the end of itself, and puts the difference between pleasant and irritating in a
config file.

It has its own toggle in the HUD, on `N`, and it is off until somebody asks for
it.

## Format

Mono 16 bit PCM WAV at 22.05kHz. One format, no fallback list: every browser the
game is tested in decodes it, and the whole set is 68kB, which is the same as
the art.

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

`music.ogg` and `music.mp3` are two encodings of one track, and this is the only
thing in the repo that somebody else wrote.

**"Week 1.1: Super Retro Lounge" by Abstraction**, from the
[Music Loop Bundle](https://tallbeard.itch.io/music-loop-bundle). Released as
CC0 by Abstraction Music and Tallbeard Studios, so the full text is in
`MUSIC-LICENCE.txt` next to it. No credit is required by the licence. This one
is here because the rest of the repo names where everything came from, and
because the licence file asks nicely rather than insisting.

The bundle's own README asks that projects making money consider the artist's
Patreon. This one does not make any, and the tip jar in the game goes to a Ko-fi
that has never been the point. Worth knowing if that ever changes.

### What it replaced, and what that cost

There was no file here until 1.9.0. The music was scheduled note by note on the
audio clock from four chords in `src/config/music.js`, because the machine this
is built on cannot reach an asset host and has no encoder on it. Both are still
true: the track was handed to the build rather than fetched by it, and encoded
with a static ffmpeg pulled from npm into a scratch directory, so neither the
repo nor the build gained a dependency.

The honest ledger:

- This directory went from 68kB to 708kB. The track is most of the game's
  download now, and the service worker caches it, so it is most of the installed
  app as well.
- The loop comes round every 24 seconds. The old progression picked its top note
  at random every bar and never quite repeated. This does, roughly 50 times in a
  twenty minute run. It is hold music, so that is arguably the joke rather than a
  regression, but it is a real change and it is the thing to listen for first.
- `src/services/music.js` lost 180 lines. The lookahead scheduler, the catch-up
  guard for throttled background tabs, the fade node and the hand rolled
  envelopes are all gone, because Phaser does the decoding, the looping and the
  autoplay unlock and already did for the six clips above.

It has its own toggle in the HUD, on `N`, and it is off until somebody asks for
it.

## Format

The six effects are mono 16 bit PCM WAV at 22.05kHz. One format, no fallback
list: every browser the game is tested in decodes it, and the whole set is 68kB,
which is the same as the art.

The music is the exception and has two. Vorbis at `-q:a 3` leads at 296kB, and
MP3 at 112kbps follows at 329kB. The browser fetches exactly one.

The order is not a preference. Vorbis loops without a gap and MP3 does not: the
format pads both ends of the file, which a 24 second loop would hit audibly every
time round. The MP3 is only there for Safari before 18.4, which could not play
Vorbis at all, and a small tick on an old handset beats a music toggle that does
nothing.

Both are re-encodes. The source OGG is 2.5MB, which is almost all a 1000x1000
PNG of the album art riding along as a second stream, so `-vn` is doing more work
in the command below than `-q:a` is.

```bash
ffmpeg -i source.ogg -vn -map_metadata -1 -c:a libvorbis -q:a 3 music.ogg
ffmpeg -i source.ogg -vn -map_metadata -1 -c:a libmp3lame -b:a 112k music.mp3
```

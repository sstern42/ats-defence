# Introduction credit

Nobody's. These eight sprite strips are drawn by `tools/make-intros.mjs`, which
is a few hundred lines of circles and rectangles using Node built-ins and no
dependency.

The brief was a funny clip for each applicant type. Found footage was the
obvious answer and the wrong one: this repository is public and MIT, every other
asset in it is CC0, and a stock clip of somebody's actual graduation is neither
ours to ship nor especially kind to the person in it. Drawing them here removes
the licence question, keeps a gag that lands badly to a number in a file rather
than a hunt for a replacement, and means Phaser can play the result without a
GIF decoder.

## Regenerating

```bash
node tools/make-intros.mjs
```

The output is committed, so this only needs running when a recipe changes. The
file names are the texture keys the game plays by, so a new animation means a
recipe in the script and an entry in `src/config/intros.js`.

## What each one is

Every strip is sixteen 80 by 80 frames in a row, greyscale on transparency,
played at twelve frames a second and looping. The card tints each one with its
applicant's colour, which is why none of them have a colour of their own.

| File | What happens |
| --- | --- |
| `intro-graduate.png` | The cap goes up. The cap does not come down. The arms come down instead, slowly. |
| `intro-careerChanger.png` | A curriculum vitae unrolls, and is still unrolling when the frame runs out. |
| `intro-overqualified.png` | Qualifications stack up, start to lean, and leave the top of the frame. |
| `intro-keywordStuffer.png` | A page fills with words, then fills in, until there is nothing on it to read. |
| `intro-referral.png` | A barrier lifts itself well before anybody reaches it. |
| `intro-boomerang.png` | It is thrown, it leaves, and it is back before the loop is over. |
| `intro-internalCandidate.png` | Eight stages of screening clear themselves around somebody who does not move. |
| `intro-contractor.png` | Four years come off the calendar and land in a pile. Nothing else happens. |

The last two are the ones that animate everything except the applicant, and they
are opposite jokes with the same construction. One is a whole process running on
somebody who already has the job. The other is no process at all, because nobody
screens a contractor, so the only thing in the frame with anything to do is the
year.

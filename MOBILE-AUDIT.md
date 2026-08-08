# Mobile audit

An assessment of what the existing codebase offers a phone version of ATS
Defence modelled on the fixed-central-tower, no-placement, upgrade-card design
described in the brief. Read-only: nothing in this audit changed any code.

Everything below was read from the repository at commit time on branch
`claude/ats-defence-mobile-audit-4aopah`. Line numbers are cited for anything
load-bearing. Where a claim could not be checked from the code alone it is
marked as an assumption.

## Summary: rebuild, not a port

The phone version is a **rebuild of the game loop and every scene, sitting on
top of a port of everything underneath them.**

The split is unusually clean, which is the good news. This repository already
separates "what the game is" from "what the game does", and the separation
falls almost exactly where the mobile design cuts:

- **Portable more or less as-is:** the services layer (`analytics`, `audio`,
  `music`, `feel`, `experiments`, `leaderboard`, `mode`, `nameInput`,
  `device`), the copy file, the config file *shape*, the asset generators in
  `tools/`, the Netlify functions, the Supabase schema, the build. That is
  around 2,600 lines of the 9,600 in `src/`, and none of it knows what a
  waypoint is.
- **Not portable:** `GameScene.js` (2,574 lines) and `UIScene.js` (662 lines),
  which between them are the game. By rough count somewhere around 1,600 lines
  of `GameScene` exist to serve a walked route and player placement: the carpet
  cutting and route filling (`drawGround` :1115, `fillRoute` :1178,
  `bandOutline` :1238), buildable cells (`findBuildableCells` :1450,
  `drawBuildableCells` :1478), the placement ghost and its input
  (`bindPlacementInput` :1592 through `layTrap` :1914), traps (`checkTraps`
  :970), adjacency (`refreshAdjacency` :2009), field and link drawing
  (`drawFields` :2031), and the cost field drawing (`drawRouting` :1322). The
  mobile design has no counterpart for any of it.

The deciding argument is not the line count, it is `CLAUDE.md`'s own rule that
**classic does not move**. Classic has a balancing pass behind it, a
leaderboard with real scores on it and a live experiment reading its wave one.
Every one of the six mobile design points wants the opposite of an invariant
the desktop game is built on: no path, no placement, one tower, no input, a
different aspect ratio, and two orders of magnitude more entities. Bending
`GameScene` to serve both would put branches in the one file the project has
worked hardest to keep branch-free, and would put the tuned mode at risk on
every commit.

The recommendation is a second scene set (`scenes/mobile/`) and a second entry
point, sharing `src/services`, `src/content` and the `src/config` conventions,
built as its own mode with its own data. That is a rebuild of about 3,200
lines and a port of the rest.

---

## 1. Stack inventory

| Concern | What it is | Version |
| --- | --- | --- |
| Engine | Phaser 4 | `4.2.1` (`package-lock.json:624-627`) |
| Language | Vanilla JS, ES modules, no TypeScript, no framework | n/a |
| Build | Vite | `8.2.0` (`package-lock.json:742-744`) |
| Experiments SDK | `@growthbook/growthbook` | `^1.6.5` (`package.json`) |
| Node (build) | 22 | `netlify.toml` |
| App version | `1.6.0` | `package.json` |

Total dependency count in the client bundle: two.

### Entry points

- `index.html` is the Vite entry. It carries the meta tags, the inline styles
  for the unsupported message, and a `#game` div (`index.html:106`). The
  viewport meta is `width=device-width, initial-scale=1` (`index.html:5`).
- `src/main.js` is the JS entry. It builds the Phaser config
  (`main.js:13-30`), gates on screen size (`isSupported`, `main.js:50-52`),
  and boots (`boot`, `main.js:86-99`).

### How the loop is driven

Phaser's own RAF loop. `GameScene.update(time, delta)` (`GameScene.js:407-447`)
is the whole of the per-frame game logic. It:

1. Re-sorts every applicant by its Y position (`:413-415`).
2. Applies slow fields (`applySlows` :885).
3. Applies crowd pressure to towers (`applyPressure` :2179).
4. Asks every tower for a target and resolves any hit (`:420-426`).
5. Checks traps (`checkTraps` :970).
6. Redraws tracers and health bars (`drawShots` :2469, `drawHealthBars` :2496).
7. Tests the wave-complete condition (`:436-446`).

Note what is *not* in `update`: movement. Applicants move because each one is
a `Phaser.GameObjects.PathFollower` driven by a tween (`Applicant.js:27`,
`walk` :99-131). The tween manager moves them; the scene never integrates a
position. This matters a great deal in section 6.

### How it renders

`type: Phaser.AUTO` (`main.js:14`), so WebGL where available and Canvas as a
fallback. Fixed backing store of 1024x768 (`main.js:16-17`) with
`Phaser.Scale.FIT` and `CENTER_BOTH` (`main.js:19-22`). There is no DPI or
`resolution` handling anywhere in the codebase, so the game always renders
1024x768 device-independent pixels and lets CSS scale the canvas.

Drawing is a mixture of:

- **Sprites**, tinted greyscale art. One image per applicant, a two-image
  container per tower (`Tower.js:57-72`).
- **Immediate-mode `Graphics`**, cleared and rebuilt every frame, for tracers,
  bursts, health bars and integrity bars (`GameScene.js:368-370`, `:2469`,
  `:2496`).
- **Baked dynamic textures**, built once per run for the floor
  (`drawGround` :1115, using `addDynamicTexture` and `erase` to cut the worn
  route out of the unworn carpet).
- **Text objects** for banners, notices, leak labels and the entire HUD.

---

## 2. Architecture

```
index.html
  └── src/main.js ......... Phaser config, support gate, boot
        │
        ├── services/experiments.js ... resolved BEFORE analytics (main.js:87)
        ├── services/analytics.js ..... session_started fires even if unsupported
        │
        └── Phaser.Game
              ├── BootScene ....... loads art, textures, intros, audio; inits sound+music
              ├── HomeScene ....... mode tabs, pitch, leaderboard panel, start
              │     └── LeaderboardPanel (plain class, not a Scene)
              ├── GameScene ....... THE GAME LOOP
              │     ├── launches UIScene
              │     ├── launches PauseScene   (and pauses itself)
              │     └── launches GameOverScene (and pauses itself)
              ├── UIScene ......... HUD, drawn over GameScene, keeps running when it pauses
              ├── PauseScene ...... overlay
              └── GameOverScene ... score, name box, leaderboard, feedback question
```

### How the modules talk

Three mechanisms, and no fourth:

1. **Config imports.** Every entity reads a plain data object from
   `src/config/`. `Tower` holds a reference to its `TOWERS` entry
   (`Tower.js:38`), `Applicant` to its `APPLICANTS` entry
   (`Applicant.js:35`). These are **module-level singletons shared across
   scene restarts.** See section 3 for why this is the single most important
   fact in the whole audit.
2. **Scene events.** `GameScene` emits, `UIScene` listens
   (`UIScene.js:342-366`). The HUD holds no state it is not told;
   `GameScene.events.emit('currency-changed', ...)` and friends are the only
   channel. This is a genuinely good boundary and survives the rebuild intact.
3. **Module-level singletons for run-scoped state.** `services/mode.js` holds
   which mode is being played (`mode.js:21`), `services/analytics.js` holds
   the session and run ids. Deliberately not threaded through scene data, for
   the reason given at `mode.js:1-19`.

`GameScene` reads the mode once, in `create()` (`:291-315`), and every
per-mode difference falls out of `MODES` data from there. It genuinely does
not know which mode it is running. This is the architectural achievement of
the project and the reason a fourth mode is cheap, right up until the fourth
mode wants a different game.

---

## 3. The current game model

### Movement: path-based, in all three modes

All three modes end in the same place: a `Phaser.Curves.Path` of straight
segments, walked by a tween (`pathThrough`, `GameScene.js:1096-1102`). What
differs is only where the points came from.

| Mode | Where the points come from |
| --- | --- |
| Classic | Hardcoded waypoints, one shared `Path` object for every applicant (`path.js:20-31`, `nextPath` :2151-2153) |
| Open advert | A per-applicant copy of a shared spine, displaced by each waypoint's `spread` (`buildPath` :1079-1088, `nextPath` :2155-2160) |
| Back channel | Dijkstra over a cost field, per applicant, at spawn (`routing.js:306`, `nextPath` :2139-2149) |

Free movement, in the sense of a velocity integrated per frame, does not exist
anywhere. `Applicant.progress` (`:78`) and `Applicant.remaining` (`:85`) both
read the tween, and `setSpeedMultiplier` (`:170`) works by scaling the tween's
clock rather than by changing a speed. The slow field, the targeting order and
the re-route all depend on this.

**Back channel is already runtime pathfinding from an arbitrary point**, which
is more useful for the mobile design than it first appears. `reroute`
(`Applicant.js:149-168`) rebuilds a path starting from wherever the applicant
is standing. So the machinery for "spawn anywhere, head for a point" already
exists and is proven.

### Tower placement: player-driven, grid-snapped, two input routes

Placement is the game's only interaction. It is handled in
`bindPlacementInput` (`GameScene.js:1592-1649`), which reads `pointer.wasTouch`
per event rather than deciding at boot:

- **Mouse:** `POINTER_MOVE` updates a ghost preview (`updateGhost` :1696),
  `POINTER_DOWN` commits (`placeTower` :1824).
- **Touch:** `POINTER_DOWN` on the board arms a drag (`:1615`), `POINTER_MOVE`
  drags the preview lifted 64 CSS pixels above the finger
  (`placementPoint` :1659, `TOUCH_LIFT_CSS` :214), `POINTER_UP` commits.
- Both routes converge on `updateGhost` and `placeTower`. There is exactly one
  placement code path.

Legality is precomputed once per run into a `Set` of cell keys
(`findBuildableCells` :1450-1472), tested against occupancy and budget
(`canBuildOn` :1555, `canAfford` :1800). Grid is 64px (`CELL_SIZE` :109), and
the top 128px is reserved for the HUD (`HUD_HEIGHT` :119, exported so
`UIScene` can pin to it).

Keyboard: number keys 1-6 select a tower (`:381-387`), space skips the
preparation countdown (`:389`), escape pauses (`:390`).

### Waves: static data, scheduled up front

A wave is `{ reward, groups: [{ applicant, count, intervalMs, delayMs }] }`
(`config/waves.js`). Three lists exist, one per mode. `startWave`
(`GameScene.js:609-640`) schedules **every arrival in the wave up front** via
`scheduleGroup` (`:646-664`), which is one `delayedCall` plus one repeating
`TimerEvent` per group. Nothing during a wave can change what is coming.

A wave ends when `spawnsRemaining === 0` and nobody is still active
(`:436-446`), with Boomerang returns released first (`releaseReturns` :1047).

Wave one only is swapped for an experiment arm at run start (`resolveWaves`,
`experiments.js:252-262`), and only in classic (`experimentalFirstWave` in
`modes.js`).

### Targeting, projectiles and collisions

- **Targeting:** `Tower.findTarget` (`Tower.js:145-172`) is a linear scan of
  every applicant, filtered by `canTarget` (immunity, `:181`) and `isInRange`
  (a distance test, `:185`), ordered by `applicant.remaining` with a priority
  override for the type a tower is the answer to.
- **Projectiles: there are none.** Every shot is instant. `Tower.update`
  returns the applicant it hit (`Tower.js:86-110`) and the scene applies the
  damage the same frame (`resolveHit` :912). A "shot" is a line pushed into an
  array with an expiry (`recordShot` :2410) and redrawn each frame until it
  fades (`drawShots` :2469). There is no projectile entity, no travel time and
  no projectile collision.
- **Collisions: there is no physics.** No Arcade, no Matter, no bodies. Every
  spatial test in the game is `Phaser.Math.Distance.Between` against a radius:
  tower range (`Tower.js:185`), splash (`GameScene.js:939`), trap trigger
  (`Trap.js:53`), crowd pressure (`GameScene.js:2206`). All are brute-force
  pairwise. There is no spatial index of any kind.

This is excellent news for the mobile version. A radial design with an
auto-firing central tower needs precisely a distance test and no physics, and
the existing code is already written that way.

### Where upgrade and progression state lives

**There is no upgrade or progression system.** `CLAUDE.md` lists tower
upgrades under "Still deferred" and the codebase agrees: nothing anywhere
mutates a tower's stats.

What exists is per-run state, all of it instance fields on `GameScene`, all of
it reset by `create()` running again on restart (`:316-356`):

- `this.lives`, `this.currency`, `this.rejected`, `this.waveIndex`,
  `this.wavesCleared`, `this.towers`, `this.traps`, `this.occupiedCells`.
- Score is derived, not stored (`get score()` :475-483).

Persisted state across sessions is limited to: the sound preference
(`audio.js:95`), the music preference (`music.js:264`), the GrowthBook
participant id (`experiments.js:166`), the analytics session id and the "have
we asked the feedback question yet" flag (`feedback.js:74`). Nothing about a
run survives it.

> **The load-bearing finding for the upgrade cards.** `Tower` stores a
> reference to the shared `TOWERS[typeKey]` object (`Tower.js:38`) and reads
> from it live on every shot (`rollDamage` :190, reading `this.definition`).
> `TOWERS` is a module-level export, so it survives scene restarts for the
> life of the page. An upgrade system that writes to `tower.definition` would
> silently carry upgrades from one run into every subsequent run in the same
> tab, and would do so without any test noticing, because nothing in the repo
> exercises two runs in one process. Any upgrade implementation must build a
> per-run mutable stats object and leave the config frozen.

---

## 4. Rendering and performance ceiling

### What the game is currently asked to do

The heaviest moment in the shipped game is classic wave ten
(`config/waves.js`, last entry): 74 applicants across six groups. Working
from the classic path length (2,460px, summed from `PATH_WAYPOINTS`) and the
per-type speeds in `applicants.js`, the theoretical peak concurrency if
nothing were ever killed lands around **60 to 70 applicants**. In a run the
player is actually winning it will be a fraction of that.

So the game is designed, balanced and tested at roughly 50-70 entities. The
brief asks for 300 or more. That is not a 5x scale-up on a system with
headroom, it is a 5x scale-up on a system with no headroom measured.

**Assumption flagged:** these are static estimates. There is no dev server in
this environment and no profiling has been done. Numbers below are reasoning
about algorithmic shape, not measurements.

### Object pooling: none

I searched for `getFirstDead`, `group.get(`, `createMultiple`, `classType`,
`maxSize` and `pool` across `src/`. There are no hits. The single occurrence
of the word "pool" is a comment about musical notes (`config/music.js:36`).

`this.applicants` is `this.add.group()` (`GameScene.js:316`) used purely as a
container, not as a pool. Every spawn is `new Applicant(...)`
(`GameScene.js:2096`) and every death runs a fade tween ending in `destroy()`
(`Applicant.js:211-231`). At 300 concurrent enemies with a healthy kill rate,
this is continuous allocation and collection of game objects, tweens and
tween configs, which on a mid-range phone is the classic source of frame-time
spikes.

### Per-frame allocation and other things that break at 300

Ordered by how much I would expect each to hurt.

1. **Per-frame depth churn on every applicant** (`GameScene.js:413-415`).
   Every applicant gets `setDepth(standingDepth(applicant.y))` every frame,
   with a value that changes every frame. Each call marks the display list
   dirty, so Phaser re-sorts the entire scene display list every single frame.
   At 300 movers that is a full sort of a 300+ element list per frame with a
   fresh key each time. The mobile design does not need Y-sorting at all
   (there is no furniture to walk behind), so this is deletable rather than
   fixable, which is fortunate.
2. **One tween and one `Path` object per applicant.** `startFollow`
   (`Applicant.js:110-124`) creates a tween per applicant; in the two
   non-classic modes `nextPath` (`:2138`) also builds a fresh
   `Phaser.Curves.Path` per applicant, with a `Line` curve per segment. 300
   concurrent tweens is within Phaser's tolerance but is far more machinery
   per entity than integrating a position would be.
3. **Per-spawn pathfinding in back channel.** `routeFrom` (`routing.js:306`)
   walks the grid downhill, then `pull` (`:410`) runs a taut-line pass that is
   O(n^2) in route points, each iteration calling `segmentCost` (`:444`) which
   samples the line at half-cell resolution. Paid once per spawn. At 300
   spawns in a wave this is a real cost, and `flood` (`:246`) is a deliberate
   O(n^2) linear-scan Dijkstra (the comment at `:240-244` owns this choice
   and justifies it at current scale).
4. **Quadratic-ish per-frame loops.** Per frame the scene runs
   applicants x towers three separate times: `applySlows` (`:885`),
   `applyPressure` (`:2179`), and the targeting scan inside each
   `tower.update` (`Tower.js:145`). Plus traps x applicants in `checkTraps`
   (`:970`) and applicants per splash hit in `resolveHit` (`:933`). At 300
   applicants and 20 towers that is on the order of 18,000 distance
   calculations per frame before any hits are resolved. Survivable in
   isolation, but with no spatial index it is the ceiling. The mobile design
   has one tower, which collapses this term entirely.
5. **Closure and array allocation inside the frame.** `checkTraps` allocates
   a `filter` result and a `some` closure per trap per frame (`:975-977`);
   `drawShots` reallocates both arrays per frame via `filter` (`:2471-2472`).
   Small individually, per-frame garbage at scale.
6. **`Graphics` rebuilt per frame.** `drawHealthBars` (`:2496`) clears and
   refills one `Graphics` object; at 300 damaged applicants that is 600
   `fillRect` commands rebuilt into vertices per frame. This is the correct
   pattern (one draw object, not 300) and is the part of the current renderer
   that would scale best.
7. **A game object plus a tween per hit landing.** `showImpact` (`:2449`)
   creates an `Image` and a tween on every single hit. At the fire rates a
   300-enemy design implies, this needs to become a pooled emitter.
8. **Text objects.** Every banner, notice, leak label and suspension label is
   a `Text` object (`:729`, `:820`, `:2244`, `:2330`), and a Phaser `Text` is
   a canvas render plus a texture upload. Floating damage numbers built the
   obvious way would be one texture upload per number, which at 300 enemies
   under fire is the fastest way to destroy the frame budget. A bitmap font or
   a pre-baked digit atlas is not optional here.

### Per-entity DOM nodes

None on the game board. The only DOM the game creates is a single invisible
`<input>` in `services/nameInput.js:47`, built once, on the game over screen,
only on a coarse pointer. That is a clean result: there is nothing DOM-shaped
standing between the current renderer and 300 sprites.

### Texture batching

Art is loaded as 15 individual PNGs (`BootScene.js:37`, `config/art.js:17-37`)
plus 9 textures and 6 intro strips. There is no atlas, so each distinct
texture is a separate bind and can force a batch flush.

The mobile design turns this from a problem into a non-issue: it wants one
enemy sprite colour-coded by tier, and **tint-on-greyscale is already exactly
how this game colours its applicants** (`Applicant.js:59`,
`setTint(definition.colour)`, against art the attribution file describes as
greyscaled). One texture plus per-vertex tints is a single batch for all 300.

### The DPI decision is accidentally right

There is no DPR handling anywhere, so the game renders a fixed 1024x768
backing store and lets CSS scale it up. On a 3x phone this means the game
fills the screen without rendering 9x the pixels. It will look soft. It will
also be the reason 300 sprites is achievable at all on a mid-range device.
For the mobile build this should become a deliberate decision rather than an
oversight: pick a backing store (720x1280 is the obvious portrait analogue)
and let it scale.

### Verdict on the ceiling

The current architecture would not reach 300 without work, but almost none of
the blockers are deep. The three that matter (per-frame depth sort, no
pooling, and per-entity tween-driven paths) are all things the mobile design
either does not need or would replace anyway. There is no physics engine to
fight, no DOM per entity, and no per-entity draw call for the effects layer.
**The rendering approach is a good foundation. The entity lifecycle is not.**

---

## 5. Mobile readiness

### Phones are actively refused

`isSupported()` (`main.js:50-52`) is:

```js
return window.innerWidth >= 900 && window.innerHeight >= 600;
```

Anything smaller gets `showUnsupported()` (`main.js:53-72`) and the game never
boots. The copy is explicit (`content/copy.js:258-262`: "Not on a phone, for
now"). Analytics still fire on a refused screen (`main.js:86-98`), so bounce
rate by device is already measurable.

For a phone build this gate is either inverted, removed, or turned into a
router that picks a scene set. Worth noting the comment at `main.js:40-47`
already anticipates this: the test used to also require a fine pointer and
that half was removed when the drag gesture landed.

### Orientation

Not handled at all. There is no `Phaser.Scale.Orientation` usage, no
`orientationchange` listener, no lock, and no portrait layout. The board is
1024x768 landscape and `Scale.FIT` will letterbox it into a portrait viewport
at roughly a third of the screen height.

### Viewport and page setup

Already correct and does not need changing:

- `width=device-width, initial-scale=1` (`index.html:5`).
- `overflow: hidden` and `overscroll-behavior: none` on `html, body`
  (`index.html:60-62`), so the page cannot be dragged around.
- `touch-action: none`, `user-select: none` and `-webkit-touch-callout: none`
  scoped to the canvas (`index.html:83-88`), with a comment noting Phaser's
  own helper does not do this. This is the correct set and the reasoning is
  sound.
- 16px font on the hidden input to stop iOS zoom (`nameInput.js:11`).

### Existing touch versus mouse handling

More mature than expected. `services/device.js` distinguishes
`COARSE_POINTER` (`:13`) and `HAS_KEYBOARD` (`:23`) but is used **only to
choose copy**, never to choose behaviour (`device.js:3-9`). Behaviour reads
`pointer.wasTouch` per event, so a laptop with a touchscreen works both ways.

Touch-specific work already shipped:

- Drag-to-place with the preview lifted clear of the finger
  (`GameScene.js:1592-1668`).
- Cancel handling for `POINTER_UP_OUTSIDE` and `GAME_OUT` (`:1638-1648`).
- Touch-appropriate copy throughout (`UIScene.js:326-336`, `HomeScene.js:320`,
  `GameOverScene.js:63-74`).
- A hidden real `<input>` over the drawn name box so a soft keyboard opens at
  all, including lifting the whole game clear of the keyboard when it does
  (`nameInput.js`, particularly `refresh` :108 and the `visualViewport`
  listeners at `:99-102`).

None of this is wasted on the rebuild. `nameInput.js` in particular is the
hard-won part and ports unchanged.

### Asset sizes

Trivial and not a concern. Total in `public/assets/` is 256KB, of which the
largest single file is a 17.9KB carpet tile. The six WAVs total roughly 52KB.
The one heavy asset is `public/og-image.png` at 487KB, which is a social card
and never loaded by the game.

The music has no asset at all: it is four chords scheduled onto the audio
clock (`config/music.js`, `services/music.js`), which is exactly the right
shape for mobile.

### Desktop-only things that would need answering

| Thing | Where | Notes |
| --- | --- | --- |
| Screen size gate | `main.js:50` | Refuses phones outright |
| Hover states | `UIScene.js:141-147`, `:270-276`, `HomeScene`, `GameOverScene` | `POINTER_OVER`/`OUT` on every button; harmless on touch but dead |
| `useHandCursor` | `UIScene.js:137`, `:268` | Cosmetic, no-op on touch |
| Keyboard shortcuts | `GameScene.js:381-390`, `UIScene.js:252-253`, `HomeScene.js:139-140` | 1-6, space, escape, M, N, enter. All have touch alternatives except space to skip preparation, which `UIScene.js:438-444` notes and works around by changing the hint |
| Fixed pixel layout | Everywhere | See below |
| Right click | Not used anywhere | Good |

**Fixed pixel layout is the widest-reaching item.** Hardcoded coordinates for
a 1024x768 landscape board appear in: `config/path.js` (every waypoint, both
spines, and `BACK_CHANNEL_FIELD.bounds` at `:79`), `config/scenery.js` (every
prop position), `UIScene.js:46-54` (a three-column palette sized for a 1024px
strip, `HUD_HEIGHT` 128 at `GameScene.js:119`), `HomeScene.js:33-70` (two
columns at `LEFT_X` 72 and `BOARD_X` 600, a divider at 556, and a dozen fixed
Y positions), and `GameOverScene.js:36-58` (two columns, `FIELD_Y` 476,
feedback rows from 518 to 706).

Some of it does adapt: `findBuildableCells` derives its grid from
`this.scale.width/height` (`GameScene.js:1453-1454`), and `drawGround` tiles
to the scale (`:1117`). The waypoints and the layout constants do not.

---

## 6. The gap, per design point

Ratings: **already supported** / **small change** / **significant refactor** /
**rebuild**.

### 6.1 One tower dead-centre, enemies converge from 360 degrees, no path, no placement

**Significant refactor of spawning; rebuild of the surrounding scene.**

The pieces are more present than they look:

- A path from an arbitrary point to a target already exists as a one-liner:
  `pathThrough(x, y, [centre])` (`GameScene.js:1096`). A radial spawn is a
  point on a circle and a straight line inwards. **No pathfinding needed**,
  and `CostField` is not required for the mobile mode at all.
- The vacancy position is already read from data
  (`GameScene.js:313-315`), so moving it to the centre is a config edit.
- A tower can be constructed anywhere (`Tower.js:35`); seeding `this.towers`
  with one instance in `create()` and never calling `placeTower` is a small
  change mechanically.
- Targeting by `applicant.remaining` (`Tower.js:145-158`) is, for a
  straight-line radial converge, exactly distance-to-centre. It works
  unmodified.

What makes it a refactor rather than a small change is everything that has to
come *out*: `findBuildableCells` (:1450), `drawBuildableCells` (:1478),
`bindPlacementInput` (:1592), `createPlacementGhost` (:1685), `updateGhost`
(:1696), `ghostSpot` (:1739), `placeTower` (:1824), `trapSpot` (:1898),
`layTrap` (:1914), `refreshAdjacency` (:2009), `drawFields` (:2031),
`drawLinks` (:2072), `closestPointOnPath` (:1500), `fillRoute` (:1178),
`bandOutline` (:1238), `drawPath` (:1280), `drawRouting` (:1322),
`refreshRouting` (:1379), plus the whole of `Trap.js` and `routing.js`.

And one thing that has to come *in* that has no precedent: the tower needs to
be the thing with the health bar, which today is the vacancy
(`refreshVacancy` :1421). See 6.4.

**Files:** new `scenes/mobile/GameScene.js`; `config/path.js` (a new radial
board descriptor); `entities/Applicant.js` (see 6.5); `entities/Tower.js`
(mostly reusable).

### 6.2 Zero touch input during combat

**Already supported, by deletion.**

The game already plays itself. Towers acquire and fire without any input
(`Tower.update` :86, called from `GameScene.update` :420). The only input in
combat is placement and tower selection. Remove `bindPlacementInput` and the
keyboard bindings at `GameScene.js:381-390` and combat has no input.

The catch is not the game, it is the HUD. `UIScene` is 662 lines and its
primary job is a six-button tower palette (`createPalette` :110) with
selection, affordability, hover, disabled and trap-cooldown states. In the
mobile design none of that exists. `UIScene` is not adapted, it is replaced by
something around 120 lines.

**Files:** `GameScene.js:381-390`, `:1592-1649`, `:1685-1728`; all of
`UIScene.js`.

### 6.3 All agency in a between-wave modal with exactly two upgrade cards

**Rebuild. This is the largest single piece of new work, and the riskiest.**

Two halves, and they are not equally hard.

**The modal itself: small change.** The pattern already exists twice.
`openPause` (`GameScene.js:548-560`) launches an overlay scene and pauses the
game scene; `PauseScene.js` is the 182-line worked example. `endRun`
(`:2394-2403`) does the same for game over. A between-wave upgrade modal is a
third instance of a pattern the codebase already runs. The preparation phase
it would replace already exists too, with its own timer and countdown
(`beginPreparation` :490-518, `skipPreparation` :532).

**The upgrade system: genuinely new, and with a trap in it.** As established in
section 3, nothing in the game mutates stats, and `Tower` reads its stats live
off a shared module-level config object (`Tower.js:38`, `rollDamage` :190).
The trap is that `TOWERS` survives scene restarts, so the naive implementation
leaks upgrades between runs in the same tab, silently, with nothing to catch
it.

What has to be built from nothing:

- A per-run mutable stats object, cloned from config at run start, that
  `Tower` reads instead of `this.definition`. This is a change to `Tower.js`
  whether or not the mobile version forks it.
- A card pool as data (a new `config/upgrades.js`, in the same plain-data
  style as `towers.js`), with each card describing which stat it moves and by
  how much.
- A selection rule for picking two from the pool, plus whatever weighting and
  exclusion the design wants.
- The card UI.
- Currency's role has to be decided. Today `this.currency` (`:332`) buys
  towers and is paid by bounties (`rejectApplicant` :1012) and wave rewards
  (`completeWave` :675). If cards are free choices, currency has no job and
  half of `GAME.scoring` (`config/game.js:22-33`) with it. If cards cost, the
  economy needs rebalancing from scratch.
- The scoring formula (`get score()` :475) reads `wavesCleared`, `rejected`
  and `lives`, and the leaderboard's plausibility check measures a submitted
  score against the mode's wave list
  (`netlify/functions/lib/plausibility.js`). A different progression means a
  different ceiling and a different check.

**Files:** new `scenes/mobile/UpgradeScene.js`; new `config/upgrades.js`;
`entities/Tower.js:38` and `:190`; `GameScene.js:490-518`, `:670-712`,
`:475-483`; `netlify/functions/lib/plausibility.js`; `content/copy.js`.

### 6.4 Portrait, action in the middle third, HUD of wave counter, one HP bar, damage numbers

**Significant refactor for portrait; rebuild for the HUD; new work for damage
numbers.**

- **Portrait:** `main.js:16-17` is two numbers, but every layout constant
  listed in section 5 is derived from the current pair. Mechanical, wide, and
  boring. Every scene is touched.
- **Action in the middle third:** a design constraint on the new board data
  rather than a code problem. Radial spawn radius and the enemy approach are
  both data in a rebuilt scene.
- **Wave counter:** exists (`UIScene.js:188-194`, `showWave` :423).
- **One HP bar:** partially exists but points the wrong way. Today the health
  readout is the vacancy filling in as lives drop (`refreshVacancy` :1421)
  plus a lives count in the HUD (`showLives` :368). The mobile design wants a
  single bar for the central tower. `Tower` already carries an integrity
  concept with a bar drawn under it (`Tower.js:50-53`, `applyPressure` :215,
  `drawIntegrityBars` :2535), which is close to the right shape and currently
  open-advert only. This is a small change built on existing parts.
- **Floating damage numbers: new, and constrained twice over.** First,
  technically, per point 8 in section 4: `Text` objects will not do at this
  volume, so this needs a bitmap font or a digit atlas. Second, and less
  obviously, by the project's own accessibility rule. `CLAUDE.md` states that
  **nothing is said by movement alone**, and `services/feel.js` is the single
  place that decision is made (`feel.js:14-18`, `REDUCED_MOTION` checked in
  every helper). A number that floats up and fades is information carried by
  an animation. Under a reduced-motion preference it needs to still be
  readable, which means it cannot be *only* a rising tween. That is a design
  constraint to settle early, not a detail to patch later.

**Files:** `main.js:16-17`; `config/path.js`; `config/scenery.js`; all four
UI-bearing scenes; new `UIScene`; `services/feel.js` if damage numbers get
their own helper.

### 6.5 Hundreds of trivially cheap enemy sprites

**Significant refactor of `Applicant`, and the one item where the current
design actively fights the target.**

`Applicant extends Phaser.GameObjects.PathFollower` (`Applicant.js:27`) and
every one of its behaviours is expressed through the tween that drives it:
`progress` (:78) and `remaining` (:85) read the tween, `setSpeedMultiplier`
(:170) scales the tween's clock, `reroute` (:149) swaps the tween's path. For
a radial design where every enemy walks a straight line at a fixed point, all
of that machinery buys nothing. A position, a velocity and one vector
subtraction per frame would do the same job for a fraction of the cost.

But `Applicant` is shared with all three shipped modes, and `CLAUDE.md`
records that the second mode was proud of needing no changes to it and that
the third mode's two changes are the thing to watch. Changing it in place to
serve a fourth model puts the tuned mode at risk. **This is the strongest
single argument for a separate entity in a separate scene set rather than a
fourth mode inside the existing one.**

Also required, and none of it exists:

- Pooling for applicants, for the impact sprites (`showImpact` :2449) and for
  damage numbers.
- Removal of the per-frame depth sort (`:413-415`), which the mobile design
  does not need.
- A cheaper death than a per-corpse fade tween (`Applicant.js:211-231`).

Working in its favour: no physics to scale, one tower so the targeting term
collapses, a single texture so everything batches, and a fixed low-resolution
backing store.

**Files:** new `entities/mobile/Applicant.js`; new pooling in the mobile
`GameScene`; `services/feel.js` (pooled effects).

### 6.6 Colour-coded by tier

**Already supported.**

Applicants are greyscale art tinted per type (`Applicant.js:59`, colours in
`config/applicants.js`), and they are sized by area so different sprite shapes
carry the same visual weight (`Applicant.js:52-62`). Tiers are a new set of
entries in a config file in exactly the existing style. This one is free.

---

## Prioritised changes, with effort

Effort is expressed in relative sizes, not calendar time: **S** is a sitting,
**M** is a focused day or so, **L** is several days, **XL** is a week or more.
These are relative estimates from reading the code, not commitments.

| # | Change | Effort | Files |
| --- | --- | --- | --- |
| 1 | **Decide the delivery shape first: separate entry point and scene set, or a fourth mode.** Everything below assumes the former. This is a decision, not code, and every other estimate moves if it goes the other way. | S | n/a |
| 2 | **Portrait board and support gate.** New backing store in `main.js:16-17`; invert or route `isSupported` (`main.js:50`); new copy for whatever is now refused. | S | `main.js`, `content/copy.js`, `index.html` |
| 3 | **Radial board data and spawn ring.** A new board descriptor beside the existing waypoint sets; spawn on a circle; converge via `pathThrough` or, better, straight-line velocity. | S-M | `config/path.js`, new mobile `GameScene` |
| 4 | **Mobile `Applicant`: velocity-driven, pooled.** Drop `PathFollower`, integrate position, pool spawns and deaths, drop the per-frame depth sort. The single biggest performance item. | L | new `entities/mobile/Applicant.js`, mobile `GameScene` |
| 5 | **Mobile `GameScene`.** The loop with placement, traps, adjacency, fields, routing and Y-sorting all absent. Reuses the wave scheduler shape (`:609-664`), the wave-complete test (`:436-446`) and the run lifecycle (`endRun` :2364). | L | new `scenes/mobile/GameScene.js` |
| 6 | **Per-run mutable tower stats.** Clone config at run start; `Tower` reads the clone. Must land before any upgrade work, and prevents the cross-run leak described in section 3. | M | `entities/Tower.js:38`, `:190`, mobile `GameScene` |
| 7 | **Upgrade card system and modal.** Card pool as data, two-of-N selection, the modal scene, and the decision about what happens to currency. | XL | new `config/upgrades.js`, new `scenes/mobile/UpgradeScene.js`, `GameScene.js:490-518`, `:670-712` |
| 8 | **Mobile HUD.** Wave counter, one tower HP bar, no palette. Reuses the existing emit-and-listen boundary (`UIScene.js:342-366`) wholesale. | M | new mobile `UIScene`, `entities/Tower.js` integrity |
| 9 | **Floating damage numbers.** Bitmap font or digit atlas, pooled, with a reduced-motion answer that is not just "no animation". | M | new helper, `services/feel.js`, `tools/` for the atlas |
| 10 | **Mobile wave data.** A fourth wave list at 300-enemy scale, plus tiers in `applicants.js`. This is data, and per `CLAUDE.md` tuning is the longest phase. Budget accordingly. | L | `config/waves.js`, `config/applicants.js` |
| 11 | **Pooled impact effects.** Replace the per-hit `Image` plus tween (`:2449`) with a pooled emitter. | S-M | mobile `GameScene`, `services/feel.js` |
| 12 | **Leaderboard migration and mode registration.** A new mode key needs a Supabase migration rewriting the `leaderboard_mode_known` check constraint, or scores are refused at the end of a run with nothing in the build to warn you. `tools/check-mode-list.mjs` and its CI job exist precisely because this was missed once already. | S | `config/modes.js`, `supabase/migrations/0008_*.sql`, `netlify/functions/lib/plausibility.js` |
| 13 | **Analytics review.** `mode` is already a global property so a fourth mode is free on the events. But the `docs/` queries all filter `-- mode`, and the upgrade choice is a genuinely new player decision with no event covering it. See open questions. | S-M | `docs/`, possibly `services/analytics.js` |
| 14 | **Home and game over screens in portrait.** Two-column layouts at fixed pixel positions, re-derived. Mechanical. `nameInput.js` ports unchanged. | M | `HomeScene.js:33-70`, `GameOverScene.js:36-58` |
| 15 | **Force WebGL and pick a DPR policy.** `Phaser.AUTO` falling back to Canvas at 300 sprites is not viable; make the backing store a decision rather than an accident. | S | `main.js:13-22` |

---

## What makes the radial model harder than it looks

Six things that are not obvious from the brief and are not obvious from a
skim of the code.

1. **`Applicant` is a `PathFollower`, and everything reads the tween.** Speed,
   progress, targeting order and slows are all expressed as operations on a
   tween (`Applicant.js:78`, `:85`, `:170`). A radial design wants none of
   that, but three shipped modes depend on all of it, and `CLAUDE.md` singles
   out changes to this file as the thing to watch. You cannot quietly
   simplify it in place.

2. **Config objects are shared, mutable and outlive a run.** `Tower` holds a
   live reference into `TOWERS` (`Tower.js:38`) and reads it on every shot.
   The upgrade system is the first feature in the project's history that wants
   to change a stat at runtime, and the naive version leaks upgrades across
   runs in the same tab with no test to catch it. This is the one bug in this
   audit I would expect to actually ship.

3. **Targeting is shared across all four modes, and it has already been
   changed once for a new mode.** `findTarget` (`Tower.js:145`) orders by
   `remaining`, which was changed from a path fraction when back channel
   landed. `CLAUDE.md` says the argument that this is the same applicant in
   classic "is the only thing standing between this mode and having retuned
   the one mode that must not move." A radial mode reaching into
   `findTarget` again spends that argument a second time.

4. **A new mode is a database migration, and the build cannot see it.** The
   `leaderboard.mode` check constraint spells its modes out in SQL and cannot
   import config. `tools/check-mode-list.mjs` and its CI job exist because
   this was missed for back channel and the first symptom was a player
   finishing a run and being told the score could not be recorded. If the
   mobile version submits scores, migration 0008 is part of the work.

5. **The project's rules cut against two of the six design points.**
   "Nothing is said by movement alone" makes floating damage numbers a
   reduced-motion problem, not just a rendering one. "The event list stays at
   fourteen unless there is a question that needs a fifteenth" makes an
   upgrade-choice event something to argue for rather than to add. Neither is
   a blocker. Both are conversations to have before the code, because this
   repository has form for holding itself to these.

6. **The between-wave modal is the whole game, and there is no precedent for
   tuning one.** Classic's difficulty lives in the wave lists, which have had
   a full balancing pass. The mobile design's difficulty lives in the
   *interaction* between the card pool and the wave curve, which is a
   two-dimensional tuning problem where the project has only ever solved
   one-dimensional ones. `CLAUDE.md` says to budget more time than seems
   reasonable for balancing. That advice applies more here, not less.

---

## Open questions I could not answer from the code

1. **One deploy or two?** Whether the phone version is a separate build at a
   separate address, a fourth mode on the same site, or the same URL routing
   on screen size. The support gate at `main.js:50` is currently the only
   thing that decides, and each answer implies a different bundle strategy,
   different Open Graph tags and a different answer to question 4 below.

2. **Does the mobile version submit scores?** If yes, it needs a migration, a
   plausibility ceiling and a board of its own, and a score formula that no
   longer has "towers placed" or "currency" as meaningful inputs. If no, a
   large slice of `GameOverScene` and `services/leaderboard.js` drops out.

3. **What happens to currency?** Today it is the only resource and it exists
   to buy towers. If upgrade cards are free choices, `GAME.scoring`
   (`config/game.js:22-33`) loses two of its three terms and rejections stop
   paying for anything. This is a design decision that changes the score
   formula, the leaderboard check and the analytics.

4. **Is the upgrade choice an event?** Question 4 in the analytics spec is
   "which towers get used, and which are dead weight", and in a one-tower game
   the upgrade card is the closest analogue to `tower_placed`. Either that
   event is repurposed, or a fifteenth event is argued for on the terms
   `CLAUDE.md` sets out. I have not made this call.

5. **What is the actual device floor?** Every performance statement in section
   4 is reasoning about algorithmic shape. Nobody has profiled this game on a
   phone, because no phone has ever been allowed to run it. The first thing
   worth doing after the portrait gate opens is putting 300 untinted sprites
   on a deploy preview and reading the frame time on a real mid-range handset.
   That single measurement would firm up half of this audit.

6. **How many towers, really?** The brief says one tower dead-centre. If it is
   permanently one, `refreshAdjacency` (`:2009`), `drawLinks` (`:2072`) and
   the Video Screen's whole reason to exist all drop out, and the targeting
   cost term disappears. If it is one *to begin with*, several estimates above
   are optimistic.

7. **Does the mobile version keep the parody framing?** Every applicant type,
   tower and line of copy is written for a screening process with a queue and
   a desk. A radial swarm converging on a single point is a different picture,
   and the tone rules in `CLAUDE.md` are not negotiable. Whether the existing
   six types survive the change of shape is a content question I cannot answer
   from the code.

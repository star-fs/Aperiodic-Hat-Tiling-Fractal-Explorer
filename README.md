# Hat Tiling — Fractal Boundary Explorer

![App Screenshot](<Screenshot from 2026-07-27 21-33-16.png>)

A standalone tool for finding and playing with a fractal-like artifact
that shows up in the main Game of Life app's aperiodic "hat" grid at
certain width/height values.

(Claude says:)
At certain width/height values, cropping reveals a large, jagged,
self-similar region with no tiles fit in — visually reminiscent of a
Julia or Mandelbrot set boundary. That's not a bug in the crop logic; it's
an inherent property of the supertile's shape, and this tool exists to
let you find, measure, and play with it directly rather than stumbling
onto it by trial and error on specific width/height numbers.

## Playing it

https://star-fs.github.io/Aperiodic-Hat-Tiling-Fractal-Explorer/

## Running it

No build step, no server required for local use — just open
`index.html` in a browser (or serve the folder with any static file
server, e.g. `python3 -m http.server`).

## Using the app

The sidebar is ordered top-to-bottom the way you'll actually use it:

1. **Controls** — how to move around the canvas: drag to pan, scroll to
   zoom, and **Fit view** to snap the camera back to the current crop
   window. Do this any time you feel lost after zooming/panning.
2. **Level** — pick how many rounds of substitution to grow the
   underlying supertile through (see [The math](#the-math) below). Higher
   levels mean exponentially more tiles: L1–L6 build in well under a
   second; **L7 builds ~2.55 million tiles** and is gated behind a
   confirmation because it can take several seconds and a lot of memory.
   The readout under the buttons shows the current level's *edge* — the
   largest crop size (`Nmax`) before this level runs out of coverage and
   the next level kicks in.
3. **Crop Window** — sets the width/height (in tile units) of the
   axis-aligned box used to crop the supertile down to a finite grid.
   Check **Lock width = height** to move both together. **Jump to this
   level's edge** snaps the crop straight to that level's `Nmax` — the
   single most reliable way to land on the fractal artifact.
4. **Crop Center Offset** — pans the crop window's *center* within the
   raw supertile (independent of the pan/zoom camera). The interesting
   notch structure isn't only at the origin — offsetting the center lets
   you find other bites out of the boundary. **Center = origin** resets it.
5. **Animate** — press **Play sweep** to continuously resize the crop
   window between **Sweep min/max**, so you can watch the notches
   appear and disappear in real time instead of hunting for them one
   value at a time. **Step / tick** controls how big a jump each tick
   makes; **Tick (ms)** controls how fast.
6. **Rendering** — three ways to look at the same data:
   - *Lineage*: colors each tile by which of the top-level supertile's
     10 branches it descended from. This is the most explanatory view —
     it makes the recursive substitution structure directly visible.
   - *Radial gradient*: colors by distance from the crop center.
   - *Solid*: no coloring, useful when you just want to see the raw
     silhouette.

   **Fast mode** swaps polygon fills for small dots, trading tile shape
   for speed — useful at high tile counts or during animation.
7. **Diagnostics** — live numbers backing everything above: the raw
   supertile's bounding box and `Nmax`, the current crop's tile count,
   and a *coverage ratio* estimating how much of the crop is actually
   covered by tiles (see below — well under 100% means you're looking
   at notch clipping).

### Fastest path to the artifact

Click a **Level** button, then click **Jump to this level's edge**, then
**Fit view**. Try it on L3 (fast, coarse) and L6 (slower, fine detail,
this is the case that motivated the tool) to see the same structure at
two different scales.

## Purpose

The main app's hat-tiling grid (`../app.js`, `setupHatGrid`) is not built
cell-by-cell like a square or hex grid. Instead it:

1. Grows one enormous recursively-substituted "supertile" through a
   chosen number of substitution rounds (the **level**).
2. Crops that supertile down to the requested width/height with a plain
   axis-aligned box test (`Math.abs(x) < width/2 && Math.abs(y) < height/2`).

At certain width/height values, this crop reveals a large, jagged,
self-similar region with no tiles in it — visually reminiscent of a
Julia or Mandelbrot set boundary. That's not a bug in the crop logic; it's
an inherent property of the supertile's shape, and this tool exists to
let you find, measure, and play with it directly rather than stumbling
onto it by trial and error on specific width/height numbers.

## The math

### Why the boundary looks fractal

The hat tiling is a **substitution tiling**: start from four small seed
shapes (`H`, `T`, `P`, `F`), and repeatedly replace each one with a
larger cluster built out of smaller copies of the same four shapes
(`hatConstructPatch` + `hatConstructMetatiles` in `app.js`). After
`level` rounds, the single top-level `H` "supertile" is a huge polygon —
the aggregate outline of everything nested inside it.

Supertiles built this way are the same kind of object as the classic
[rep-tile](https://en.wikipedia.org/wiki/Rep-tile) and
[substitution tiling](https://en.wikipedia.org/wiki/Substitution_tiling)
constructions: their boundary is **self-similar and non-convex by
construction**, because it's assembled from smaller copies of the same
irregular boundary shape at every recursive step. It's the same
mechanism that gives fractal curves like the Gosper island or twindragon
boundary their jagged look — just applied to an aperiodic monotile
instead of a single repeating shape.

Cropping that supertile with a plain rectangle doesn't respect this
outline at all. Wherever the rectangle's edge happens to fall inside one
of the outline's concave "bays" instead of its solid interior, an entire
branch of the recursive structure gets excluded — and because the
boundary is self-similar, those missing branches look like smaller
copies of the same jagged shape, at every scale. That's the "Julia/
Mandelbrot" resemblance: not a coincidence, but the generic look of a
substitution boundary intersected with an unrelated straight edge.

### Why specific sizes trigger it

`setupHatGrid` doesn't rebuild the supertile for every width/height —
that would be far too slow. Instead it picks the **smallest level**
whose raw (uncropped) bounding box is big enough to cover the request:

```
targetSpan = 1.35 * max(width, height) * scale
```

grow `level` until `min(rawWidth, rawHeight) >= targetSpan`, then stop.

Because the supertile's footprint roughly doubles (empirically, ×2.62)
in linear size with each level, this "smallest sufficient level" check
creates **sharp size brackets**: a wide range of width/height values all
reuse the exact same raw supertile (just cropped differently), until the
requested size exceeds what that level can cover, at which point the
level jumps up to one with an enormously larger raw patch — and the
crop suddenly has so much headroom that it sits entirely inside the
solid interior, hiding the notches again.

For a given level, the crop is "safe" (fully inside the solid interior)
for small width/height, and only starts grazing the notched edge as it
approaches that level's own limit:

```
Nmax(level) = floor(rawMinDim(level) / (1.35 * scale))
```

This is exactly what reproduces the numbers from the original report:
at `scale = 20`, level 6's raw patch has `minDim = 32250.8px`, giving
`Nmax = floor(32250.8 / 27) = 1194` — the precise edge where the
artifact appears at width/height 1194, vanishes at 1195 (level bumps to
7, an entirely different and much larger patch), and — per the same
logic — is absent for sizes comfortably below that level's edge.

### Reading the diagnostics panel

- **raw bbox / raw minDim** — the uncropped supertile's bounding box at
  the current level. `minDim` is what the level-selection loop in the
  main app actually checks against.
- **level Nmax** — this level's own edge, computed with the formula
  above. Feeds the "Jump to this level's edge" button.
- **core-density est. / coverage ratio** — the crop can't be compared
  against "tiles ÷ full bounding-box area", because the supertile is a
  non-convex blob that never fills its own bounding box even in fully
  solid regions (that baseline reads over 100% everywhere and is
  useless as a signal). Instead this samples tile density in a small
  box at the crop's center — assumed to be solid — and scales that up
  to the full crop area as the "expected" count if the whole crop were
  equally solid. Coverage well under 100% means the crop is clipping
  through a notch somewhere; near 100% means it's sitting cleanly in
  the interior.

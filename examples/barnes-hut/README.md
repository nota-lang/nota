# The Barnes-Hut Approximation — a Nota explorable

Jeffrey Heer's interactive article on the Barnes-Hut n-body approximation
([the Idyll original](https://jheer.github.io/barnes-hut/), also the flagship
[Living Papers](https://github.com/uwdata/living-papers) example), reimplemented as a Nota
document. The design evaluation — Living Papers' mechanisms vs Nota's — is
`design/explorable.md`; this directory is the working artifact.

## Layout

- `barnes-hut.nota` — the article. Document state is one `createMutable` store; the prose
  drives the diagram through two doc-local components defined in the preamble (`@Do` action
  links whose props are the click-time state patch; `@T` θ-series focus references), plus
  `Slider`/`Action`/`Sticky` from `@nota-lang/explorable`.
- `src/network.ts` — the Les Misérables graph + a deterministic pre-settled d3-force layout
  (stopped simulation, synchronous ticks — SSR-safe and byte-reproducible).
- `src/quadtree.ts` — the Barnes-Hut math over d3-quadtree as pure functions (accumulation,
  subdivision boxes, insertion paths, force estimation, animation groups).
- `src/barnes-hut.tsx` — the diagram: one Solid component, every SVG layer a memo over the
  reactive props (`size`/`theta`/`charge`/`layout`/`estimate`/`accumulate`); animations are
  CSS driven by state.
- `src/plots.tsx` — the performance figures: hand-rolled Solid SVG line charts on a validated
  ordinal blue ramp, legend-as-focus-control, crosshair readout; `src/performance-data.ts`
  holds the article's pre-recorded benchmark data.
- `barnes-hut.css` — page design (text column + sticky margin figure) and all component
  styling.

## Build & test

```sh
pnpm run build   # nota build barnes-hut.nota → barnes-hut/ (index.html + assets/)
pnpm test        # unit + SSR tests, plus the jsdom e2e over the real built page
pnpm run check   # tsc + biome
```

The e2e (`tests/document.test.ts`) builds the document with the real CLI, boots the emitted
page in jsdom (evaluating the hydration scripts the way a browser would), and drives the
explorable arc: action links flip the diagram's phase, the step slider follows outside writes
and inserts points, legend focus dims series across both charts.

## Attribution

Prose, data, and the visualization design are Jeffrey Heer's, from
[jheer/barnes-hut](https://github.com/jheer/barnes-hut) (BSD-3-Clause) via the Living Papers
port; the quadtree math is a rendering-free port of that article's `quadtree.js`.

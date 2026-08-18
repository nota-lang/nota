# Explorable explanations in Nota — the Living Papers evaluation

**Status: landed on branch `explorable-explanation` (2026-08-17).** The benchmark: reimplement
Living Papers' Barnes-Hut example — itself a port of Heer's Idyll article, the densest real
explorable in their repo — with the *least hackiness possible*, and measure where Nota's
JS-interop actually carries the weight. The artifact is `examples/barnes-hut/` (the document
+ its components). This file records the mechanism-by-mechanism comparison and the honest gaps.

## What Living Papers is doing (the hacks under evaluation)

Living Papers is pandoc markdown + an ObservableHQ runtime bolted on. Every interactive
mechanism in the Barnes-Hut article is a *side channel* around markdown's lack of semantics:

1. **Reactive state** — fenced ```` ~~~ js {hide=true} ```` blocks holding observable *cells*
   separated by `---` lines; a topological-reeval runtime distinct from JS semantics
   (`charge = -30` is a cell declaration, not an assignment).
2. **Inputs** — ```` ~~~ js {bind=step} ```` fences: the *block attribute* names a cell to
   two-way-bind the rendered `Inputs.range(…)` to. Name-based, stringly, one binding per fence.
3. **Reactive component props** — `` [:barnes-hut:]{size=`step`} ``: backtick-quoted attribute
   strings evaluated as cell expressions.
4. **Action links** — `` [click me](`layout=false, step=2`) ``: the markdown *URL position*
   carrying a comma-operator statement list, evaluated against the cell scope on click
   (`++accum` as "replay the animation").
5. **Components** — Lit `DependentElement` classes, registered through `package.json` metadata,
   pulling **d3 v4 off a CDN at page load** (`static get dependencies()`), rendering
   imperatively into a detached div; props arrive as HTML attribute strings through converters.
6. **Charts** — Vega specs behind `[:time-plot:]{bind=focus}`, with a signal listener bridging
   Vega's internal `theta` signal back into the cell runtime; prose references colored via CSS
   classes (`.t05`) that paint *text* in series colors.
7. **Layout** — `::: aside {.margin .sticky}` framework-magic classes.

Each of these is a second language grafted where markdown has no expression syntax. The
evaluation question: which of them does Nota dissolve into the language, and what residue needs
library code?

## The mechanism map

| Living Papers | Nota | What dissolved it |
|---|---|---|
| observable cells in hidden fences | `% const S = createMutable({ charge: -30, step: 0, … })` — one statement | `%`-code is real JS in the document component's scope; Solid's store gives observable-like granularity with JS semantics (`S.step++` *is* assignment). Hiddenness is intrinsic: code never renders. |
| `{bind=step}` input fences | `@Slider[value: S.step, set: v => S.step = v, …]` | No name-based side channel: the binding is a getter/setter pair, and *any* state that can produce one participates. Reactivity is free — the emit is Solid JSX, so `value: S.step` compiles to a tracked getter. |
| `` size=`step` `` backtick props | `@BarnesHut[size: S.step, layout: S.layout && !S.estimate]` | Props are ordinary JS expressions in the notation; no string-eval layer. Arbitrary expressions compose (the `layout && !estimate` coupling moves into the prop). |
| `` [text](`layout=false, step=2`) `` action links | `@Do[layout: false, step: 2]{text}` | `Do` is a **3-line doc-local component** over `Action`: its props *are* the state patch (`Object.assign(S, patch)` on click). Solid compiles prop values lazily, so `step: Math.min(S.step + 1, 77)` evaluates at click time — LP's `++accum` becomes `accum: S.accum + 1` with no comma-operator contortions. Renders a real `<button>`, not an `href` hack. |
| Lit + CDN `DependentElement`s | plain Solid components, doc-relative imports | The doc's directory is a real Vite module graph (the CLI's design): `import { BarnesHut } from "./src/barnes-hut"` bundles d3-force/d3-quadtree from npm. d3 is *math only*; Solid owns the DOM, so the diagram is memos over reactive props — no update methods, no attribute-string converters. |
| Vega + signal-listener bridge | hand-rolled Solid SVG `LinePlot`s | The charts share document state through the same `value`/`set` protocol as the sliders (`focus`/`setFocus`); no runtime-to-runtime bridge. Series follow the dataviz method: ordinal blue ramp (θ is ordered), validated; legend buttons are the keyboard-reachable focus control. |
| `.t05` colored-text classes | `ThetaRef`: ink text + series-colored swatch/underline | Two-way with the charts through the same protocol; fixes LP's accessibility bug (light series colors as text fail contrast — identity now rides a mark beside the text). |
| `::: aside {.margin .sticky}` | `@Sticky{…}` + document CSS | A 5-line component (zero-height sticky panel) + the document owning horizontal geometry. One real constraint surfaced: **sticky containment** — Reforest sections are the containing blocks, so the panel must sit *before the first heading* (at article root) to pin for the whole scroll range. The document records this in a comment. |
| YAML front matter + `styles:` | `@Title`/markup + `import "./barnes-hut.css"` | CSS is a module import like any Vite app; no per-component CSS registration metadata. |

## What fell out of the language (zero work)

- **Whole-document hydration.** LP needs the cell runtime + component registry to make the page
  live; Nota's document *is* a Solid app (design/solid.md), so every mechanism above hydrates
  by construction. There is no binding layer to keep in sync.
- **A real static page.** LP's custom elements render client-side after CDN loads — its no-JS
  page is empty where the diagrams go. Nota SSRs the diagram: the deterministic pre-settled
  force layout (stopped simulation, synchronous ticks, phyllotaxis init) bakes real content
  into the HTML, `--static` included, and the client claims it byte-for-byte.
- **Document machinery coexists.** The footnote, headings, smart punctuation, and math run
  through the ordinary prelude *in the same document as* the interactivity — LP keeps these in
  pandoc, a separate system from its reactive layer.
- **Types end to end.** The components are TS; the doc's `%`-code is typed for the LSP. LP's
  attribute-string converters are untyped by design.

## What had to be built (the residue)

- **The interaction kit** (~120 lines + CSS): `Slider`, `Action`, `Sticky`, in the example's own
  `src/inputs.tsx`/`src/layout.tsx`. This is what an explorable needs beyond the language; it was
  briefly `@nota-lang/explorable`, but one consumer does not make a package. Protocol-only (no state
  container of its own).
- **The example's components** (~1.2k lines with tests): the Barnes-Hut math port, the diagram,
  the plots. Real application code — LP's version is the same order (quadtree.js 650 lines +
  Lit wrappers + two Vega specs). The *interesting* delta is architectural: LP's diagram is an
  imperative update-method object; ours is memos over props, so the document drives it by
  writing state, same as the prose does.
- **One toolchain fix**: the CLI's hydrating path dropped CSS entirely (the rolldown-vite IIFE
  client build emits no CSS assets; only the `--static` path was tested). Falls back to the SSR
  build's emission; regression-tested. The example was the first real doc with stylesheets.

## Honest gaps

- **Two-way binding is spelled out.** `value: S.theta, set: v => S.theta = v` vs LP's
  `bind=theta`. The pair is more honest (and composes: lenses, validation, derived state), but
  it is undeniably longer. If this grates in practice, the *library* can add a
  `bind: [() => S.theta, v => S.theta = v]` tuple or a settable-signal convention — reader
  changes are not needed and shouldn't happen (a `bind:` sugar would reintroduce the name-based
  side channel we're scoring LP down for).
- **The line clamp bites prose.** `_…_` emphasis cannot cross a source newline; two multi-line
  italic spans from the LP text silently rendered as literal underscores until the build was
  eyeballed. Correct by spec (notation.md), but it's the one porting papercut that produced
  *silent* wrong output. (An "emphasis opener whose close is missing on the line" lint in the
  language server would catch it.)
- **Author floor = Solid.** `Do` uses `splitProps` + lazy-prop semantics; the store is
  `createMutable`. The concepts are Solid's, not Nota's — the right dependency, but the
  explorable story should eventually ship as a documented pattern (this example is that
  document).
- **Deliberate simplification:** LP's `bind-set` slider↔focus coupling (the θ slider displaying
  the plot-hovered series) was dropped as UI over-cleverness; a `createEffect` would restore it.
- **Weight:** the client bundle is 241 KB gzip, dominated by KaTeX (the doc uses real math);
  solid + d3 + the doc are a small fraction. LP ships Vega + d3 from CDNs at comparable total
  weight — but a math-free Nota explorable would be far lighter, and `--static` is 0 KB.

## Verdict

The four core explorable mechanisms — state, inputs, reactive props, action links — all reduce
to *ordinary program structure* (one store, one prop protocol, one 3-line doc-local component),
because the document is a real JS module with a real reactive substrate. Nothing needed the
reader, the compiler, or a new runtime concept; the only new library surface is three generic
components. That is the interop thesis holding under load: where Living Papers grafts a second
language into markdown's blind spots, Nota's answer was already "it's just JavaScript" — and
the one place it wasn't (CSS through the hydrating CLI path) was a bug, not a design gap.

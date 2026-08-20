# Nota × Solid — the specialization experiment

**Status: the experiment this branch (`solid`) exists to run.** We drop framework-agnosticism and
specialize Nota to Solid. This document supersedes [decode.md](./decode.md) on this branch;
decode.md remains the spec for the master-branch architecture it describes.

## Thesis

The old architecture rebuilt half a framework: a vnode data model, a mode flag (`▸`), an adapter
indirection, a serializer, an island system, and a bespoke client (replay hydration) — all to make
one pass (decode's restructuring) run during SSG while coexisting with a reactive framework. The
complexity was downstream of one constraint: *we didn't own the render tree*, so we built a
parallel one.

Solid removes the constraint. Solid's `children()` helper resolves arbitrary descendants —
*through component boundaries* — to real DOM nodes on the client and serialized SSR chunks on the
server. Because Solid binds reactivity to **node identity**, not tree position, a pass that
re-parents resolved nodes is semantically transparent: state and subscriptions survive. That is
exactly the license decode needed. The `~/Code/reforest` spike proved the load-bearing property:
HTML reforested at build time is **hydrated by Solid with zero mutations** (claiming is
`data-hk`-registry-keyed, hence position-independent), and post-hydration restructuring preserves
widget state.

So the whole design collapses to:

> **A `.nota` document is a Solid component.** The reader emits ordinary Solid JSX wrapped in
> `<NotaDoc>` (a provider + `<Reforest>`). vite-plugin-solid compiles it per target (dom / ssr /
> hydratable); `renderToString` is SSG; `hydrate` is the client. Nota's runtime surface is one
> restructuring component and a document-state store.

## The reduction

| Old (decode.md) | New |
|---|---|
| vnode model (`⟨t,p,k⟩`, flatten, RawHtml) | Solid JSX (compiled; `innerHTML` for raw) |
| `▸` flag, `withFlag`, dual-mode `h`/`decode` | gone — one mode, Solid's |
| `Adapter` + `setAdapter` (React/Solid) | gone — Solid is the substrate |
| `struct` (groupLists/Paras/Sections) + tag tables | `<Reforest>` (categorize → parse → rewrap) |
| `serialize` + escaping | `solid-js/web` `renderToString` |
| islands, `<nota-island>`, manifest, `freshId` | gone — the document hydrates as one Solid app |
| replay hydration (capture/replay/determinism guard) | standard `hydrate()` + a JSON state seed |
| `mark`/`query`/`DocIndex`/force/index passes | the **doc-state store**: registrations + memos |
| trailer registry (`registerTrailer`) | store-registered trailers + `<TrailerOutlet>` in `NotaDoc` |
| component registry (`slot`/`registerComponents`) | lexical `%import` + the integrator's `preludeModule` |
| `inlineComponent`/`blockComponent` | deleted — plain Solid arrows; categorization is by *rendered root tag* |
| vanilla-JS def-tooltip trailer (script/style strings) | a Solid tooltip component (`onMount` delegation, Floating UI placement) |
| `@nota-lang/react`, `@nota-lang/react-router` | removed from the workspace |
| `@nota-lang/runtime` | deleted (the LSP preamble is self-contained ambient declarations) |

What survives untouched: the reader's notation → tree semantics, the Scribble whitespace pass, the
free-name analysis + ambient-prelude injection (JSX references components as free identifiers, so
the mechanism carries over verbatim), reader-driven highlighting, and the whole IDE story's
*architecture* (the virtual emit is the same JSX, typed by the regenerated preamble).

## The pipeline

```
doc.nota
  │  oxc reader (branch solid): native Solid JSX emit + freeNames
  ▼
bare JSX module ── @nota-lang/compiler ──▶ + free-name-driven ambient imports
  │                 (@nota-lang/core, solid-js, solid-js/web, @nota-lang/prelude)
  ▼
vite-plugin-solid  (dom | ssr+hydratable — the consumer's build target decides)
  ▼                                      ▼
client module                     server module
  hydrate(() => <Doc/>, root)       renderDocument(Doc) → { html, state }   (two-pass, see §Doc-state)
```

**Landed:** the reader now emits this JSX **natively** (oxc branch `solid`); the interim
`jsxify` babel bridge served as its executable spec and has been deleted. The emit table (all
implemented in `oxc_transformer/src/nota/{build,lower}.rs`; goldens pin it):

| notation | JSX emit |
|---|---|
| the document body | `<NotaDoc>{…}</NotaDoc>` |
| `@p{…}` (host tag) | `<p …>{…}</p>` |
| `-` / `+` list markers | `<UlLi>…</UlLi>` / `<OlLi>…</OlLi>` |
| flow-container host tags (div, blockquote, figure, td, …) | `<tag …><Reforest>…</Reforest></tag>` |
| `@Comp{…}` | `<Comp …>{…}</Comp>` (an identifier *reference* — free-name analysis + mappings) |
| `@{…}` fragment | `<>{…}</>` |
| `@for (x of xs) {…}` | `<For each={xs}>{(x) => <>…</>}</For>` |
| `@if (c) {…} else {…}` | `<Show when={c} fallback={<>…</>}><>…</></Show>` |
| `@(expr){…}` dynamic tag | `<Dynamic component={expr} …>` |
| `~~strike~~` / `---` line | `<s>` / `<hr/>` (plain host elements — notation.md) |
| trailing attrs group (heading / list item) | hoisted props on `<Heading>` / `<UlLi>`/`<OlLi>` (spread onto the `<li>`) |
| trailing attrs group (flow position) | `<Attrs …/>` — the marker Reforest strips onto its paragraph |
| `//` / `/* */` comments | nothing (trivia — excised before the emit) |
| text runs | `{"…"}` containers, adjacent pieces coalesced (see ¶ below) |
| component definitions in `%`-code | untouched user code — plain Solid arrows (`(props) => …`) |

Four of those rows carry semantics:

- **Text coalescing.** The Scribble pass produces one `"\n"` text piece per interior newline;
  the lowering coalesces adjacent pieces — a blank source line surfaces as `"\n\n"` inside one
  string child, which is exactly reforest's `PARA_BREAK`. A single `"\n"` stays a soft break
  inside the paragraph, verbatim. (Text is unmapped boilerplate for the IDE mappings, so
  coalescing is mapping-safe.)
- **Flow containers become an emit policy.** Old `struct` recursed implicit paragraphing into
  `HOST_FLOW_TAGS` at runtime via a tag table. `children()` resolution can't restructure *inside*
  an already-rendered element, so the wrap moves to the emit: the reader statically knows the
  tag and wraps flow-tag children in `<Reforest>`. The runtime tag tables die; the one
  classifier left is reforest's phrasing-content set.
- **`<For>` is native.** Solid has no `key`; keyed reconciliation is `<For>` — `@for` lowers to
  it directly (no keyed-map shape anywhere); user-written `.map`s in `%`-code are untouched.
- **`<Show>` is native too.** `@if` lowers to `<Show>`, not an interpolated ternary: Solid's JSX
  compiler makes a ternary one memo over the whole conditional, so any change to the test re-runs
  it, while `<Show>` only tears down and rebuilds when `when` crosses truthiness. `else` becomes
  the `fallback` prop and `else if` nests another `<Show>` inside it; **no `else` ⇒ no `fallback`
  prop**, since Solid renders nothing by default. Two details the goldens pin: `<Show>` stays
  *unkeyed* (the ternary-matching semantics — `keyed` would rebuild on every distinct truthy
  value), and each branch nests as a **fragment** rather than having its children spliced in,
  because `<Show>` reads a lone function child as its keyed accessor callback and `@if (c) {@(f)}`
  must not silently mean that.

The compiler shim prepends the free-name-driven imports: `@nota-lang/core`
(NotaDoc/Reforest/UlLi/OlLi + the compat constructors), `solid-js` (the ambient state surface:
`createSignal`, `Show`, `For`, … — documents write Solid idioms in `%`-code), `solid-js/web`
(`Dynamic`, for dynamic tags), and `@nota-lang/prelude` (unchanged policy mechanism).

## `<Reforest>` — decode, resolved

Vendored from `~/Code/reforest` (`packages/reforest/src/lib.tsx`, our own spike) into
`@nota-lang/core`, with two Nota-specific divergences:

1. **Sections nest.** Reforest v2 delimits *flat* sibling sections by design; Nota's spec
   (decode.md §struct) is hierarchical — a heading owns following siblings until the next heading
   of rank ≤ its own. The vendored parse keeps a section *stack* keyed on heading level. (This was
   reforest's own "if hierarchy returns, it's a parse-stack change only" TODO.)
2. **Class names.** Wrapper classes are `nota-para` / `nota-list` / `nota-section` (styling
   hooks; the old serialize emitted bare tags, so any class is new surface).

Semantics otherwise as proven in the spike: inline runs → `<p>`, blank-line-in-string →
paragraph break, blocks pass through, `<UlLi>`/`<OlLi>` runs coalesce by kind, whitespace-only
children bridge list runs.

Two 2026-08 additions ride the pass:

- **Attrs markers** (notation.md §Attrs groups). A flow-position attrs group lowers to
  `<Attrs …/>`, which renders an invisible `<span data-nota-attrs …>` under **`NoHydration`** —
  load-bearing: the marker never reaches the reforested output, so it must not claim a hydration
  key. `parse` strips the marker and applies its **string-valued** attributes to the paragraph it
  is forming (a lone marker decorates the preceding paragraph; tight containers swallow markers —
  hoisted list-item attrs arrive as real `UlLi`/`OlLi` props instead, spread onto the `<li>`).
- **Smart punctuation** (§ below) transforms the resolved children *before* `parse`.

## Smart punctuation — Pollen's rules at the decode stage

`@nota-lang/core`'s `smart.ts` transliterates Pollen's `smart-quotes`/`smart-dashes`/
`smart-ellipses` (`pollen/unstable/typography.rkt`) and runs them inside every `Reforest` over the
**resolved** children — strings in place, client DOM via a text-node walk, server SSR chunks via
an HTML-aware segment walk — so both sides transform identically, which is what lets hydration
claim the transformed text. Quote *context* is judged over the flattened text of the run
(Pollen's txexpr flatten: `do '` + `<em>not'</em>` curls both), with excluded regions —
`code`/`pre`/`kbd`/`samp`/`script`/`style`/`textarea`/`math`/`svg` and anything carrying
`data-nota-nosmart` — contributing one opaque word-ish placeholder. Two deliberate divergences
from Pollen: dashes are a pure character substitution that **touches no whitespace** (Pollen sets
them tight; here spacing is the document's call, and it also keeps the `"\n\n"` paragraph-break
contract intact by construction), and the pass is idempotent by construction (curly quotes,
`—`, `–`, `…` are fixed points — re-running over hydrated text is a no-op). Default **on**;
`renderDocument`/`hydrateDocument` thread a `smart` option (per-flag or `false`) through the
doc-state store to every Reforest under it — server and client must agree, like `renderId`. Categorization is post-resolution — **a component is "inline" or
"block" according to the root element it actually rendered**, seen through the boundary (DOM
inspection client-side, chunk sniffing server-side). The declared-kind constructors
(`inlineComponent`/`blockComponent`) are therefore meaningless and are **gone** — a document
component is a plain Solid arrow (`%let Note = (props: { children?: unknown }) =>
@aside{@(props.children)}`; the annotation types the LSP view and the emit strips it).

Markup expressions have ordinary Solid evaluation semantics; they are not inert, reusable
content values. Put reusable markup behind a component or function so it is evaluated where it
is rendered (`%let Intro = () => @{# Hi}` followed by `@Intro{}`).

Known sniffing limits (inherited from the spike, acceptable v0): a component rooted in dynamic
text SSRs a marker-led chunk and categorizes as inline; the `data-category` declaration protocol
is the documented fallback if this bites.

## Doc-state — the LaTeX `.aux` model, in process

The old mark/query system existed because forward references (a Toc above its headings, `@ref` to
a later section) need whole-document knowledge. The Solid-native replacement is the model LaTeX
has always used — render, write the aux file, render again reading it — collapsed into one
process:

- **The store.** `createDocState()` — a per-document reactive store behind a context.
  Components *register* facts during render (two kinds since the unified-references branch —
  `anchor` and `ref`, [references.md](./references.md) — plus named `trailer` thunks) and *read*
  derived facts through pure derivations (heading ids/numbers, first-use note and citation
  numbers, `refsTo` backlinks). Registrations ≙ the old marks; memos ≙ the old queries; the store ≙
  `DocIndex`. Unmount unregisters (`onCleanup`), so removals update derived views immediately.
  A remounted fact is a new registration and appends to document order; dynamic semantic
  structure is not promised to track DOM insertion order.
- **SSG renders twice.** Pass 1 renders to populate the store (forward reads resolve to
  placeholders). Pass 2 renders with pass 1's snapshot as the **seed**: a read whose fact isn't
  yet live falls back to the seed, so forward references are correct in static HTML. After pass
  2, the new snapshot must equal the seed — a mismatch is a pointed "document did not converge"
  error (the old "query output may not introduce new marks" rule, now emergent rather than
  legislated).
- **Hydration seeds from the page.** The converged snapshot (plain JSON: one ordered array of
  `{kind, fact}` entries — never vnodes) is embedded as
  `<script type="application/json" id="nota-doc-state">`. The client's `hydrateDocument` reads
  it, seeds the store, and calls Solid's `hydrate` — every doc-state read during claiming matches
  the server bytes; afterward live registrations take over and reactivity owns the numbers.
- **Pure CSR** (dev server, playground): no seed; forward references resolve reactively a tick
  after first render. Correct by construction, just not pre-resolved.

`renderDocument(Doc)` (two-pass + convergence + snapshot) and `hydrateDocument(Doc, opts)` (seed +
hydrate) are ~40 lines in `@nota-lang/core` — they replace `render`, `island`, capture mode, the
manifest, and `hydrateDocument`'s replay machinery.

The reader emits component calls directly. The store appends facts as their components register
and assigns each occurrence an opaque sequential `location`; the snapshot array is document
order, and `DocState.index(location)` serves the few cross-kind before/after queries. Equivalent
SSG and hydration renders must therefore evaluate semantic components in the same order, which
the convergence check enforces. This keeps static Nota documents simple and deterministic. The
explicit tradeoff is that removing and remounting a heading, figure, note, or ref appends a
new occurrence instead of recovering its former source or DOM position.

`NotaDoc` adopts an outer store when one is provided (`useContext ?? createDocState()`), so the
driver owns the store during SSG/hydration and a bare `<NotaDoc>` in tests/CSR is
self-sufficient. Trailers: a prelude component that *needs* a document-end appendix (notes
list, definition tooltip bank) registers a named trailer thunk idempotently on first use;
`NotaDoc` renders a `<TrailerOutlet>` after the reforested children. Explicit `@Notes`
placement sets a store flag the default trailer checks — same override semantics as the old
registry, no registry.

## The prelude, Solid-native

Every component becomes a plain Solid component over the store. The behavioral specs from
decode.md §Doc-state carry over (slugs/dedup, note label semantics, backlinks, duplicate
errors); the **unified-references branch** then collapses the per-feature mechanisms into the
anchor/ref registry — [references.md](./references.md) is the spec of record for this family:

- **`Heading`** registers a `heading` anchor `{rank, title, explicitId?}` (effective id =
  authored ?? slugified resolved text, deduped at read time) and renders `<hN id>` with its
  number per `secset` depth. Text extraction uses `textOf(resolved children)` — `textContent`
  client-side, tag-strip + entity-decode on SSR chunks — the same see-through trick reforest
  uses for categorization.
- **`Toc`** renders `<nav>` from the heading anchors (seed-corrected on the server).
- **`Label`** is a strong `label` anchor; the one **`Ref`** dispatches on its resolved
  anchor's kind (definition tooltip / nearest-heading label / direct heading / note mark /
  citation / the generic figure arm).
- **Notes/Cite/Bibliography**: first-use numbering and only-render-what's-cited are the
  registry's `refNumber`/`referenced` derivations; note ↩ and citation `citeref` backlinks
  come from the recorded uses.
- **`Def`/def-refs**: the anchor renders in place; references render **real anchors**
  (`<a href="#def-key" data-nota-def="key">`) — no-JS clicks jump to the definition (progressive
  enhancement the old scriptful design didn't have). The tooltip bank + delegated
  click/dblclick/Escape handling become a Solid trailer component whose handlers attach in
  `onMount` — the `DEF_TOOLTIP_SCRIPT` string, its `<style>`/`<script>` injection, and the
  window-global guard are deleted. Placement is **Floating UI** (`@floating-ui/dom`), not
  hand-rolled rect math: `offset`/`inline`/`flip`/`shift`/`size` over an `autoUpdate` loop —
  see `design/references.md`. `texRef` is unchanged (a TeX-source wrapper).
- **`Tex`**: KaTeX→MathML sync as before; output lands via Solid's `innerHTML` (SSR-safe). Armed
  parts: scalars were stringified into the TeX source by the emit already; a vnode-armed part is
  detected via resolution and stays a fatal diagnostic.
- **`CodeInline`/`CodeBlock`**: sync shiki over the reconstructed source. Armed-part
  *decorations* are **restored**: an armed element contributes its text and records a shiki
  decoration over that range (tag + attributes recovered from the resolved node; hydration
  bookkeeping stripped).
- **Config** (`lstset`/`mathset`/`secset`/`bibset`): same functions, but **positional** now — a
  mid-document `%lstset(…)` affects subsequent code blocks only (statements execute in document
  order during the single component-body run), not "last write wins globally". This matches
  LaTeX's actual `\lstset` and is the more defensible semantics; flagged as an intentional
  change. Each doc-state store owns its config instance, initialized from site setup. The two SSG
  passes and hydration naturally start with separate instances; document mutations cannot leak
  into another pass or document. There is no global reset registry or setup-bake step.

## SSG & the trades we're making

`@nota-lang/vite`'s `nota()` returns a two-plugin preset: the `.nota → JSX` transform
(`enforce: "pre"`) followed by a pre-configured `vite-plugin-solid` claiming `.nota` (the
solid-mdx pattern; `{ solid: false }` opts out for apps that configure their own). The island
registry / `generateClientEntry` are deleted.

`@nota-lang/cli` keeps its UX (`nota build doc.nota → doc/`) and its two-build structure, but the
builds become boring: an SSR build (solid `ssr: true, hydratable`) whose entry calls
`renderDocument` and writes `index.html` (content + state script + hydration script + asset
links), then a client build of a 3-line `hydrate` entry. **Default output hydrates** — a document
is a Solid app. `--static` skips the client build and the hydration script for a zero-JS
document: fully readable, def-refs degrade to anchor jumps, counters/tooltips inert. That is the
honest version of the old "zero-JS unless islands" story: we now pay ~10–15 KB (gzip) of Solid +
doc code for interactivity by default, and the escape hatch is explicit instead of inferred from
an island census.

## Workspace changes (this branch)

- **`@nota-lang/core`** — rewritten: `Reforest`/`UlLi`/`OlLi` (vendored + nested sections),
  `NotaDoc`, the doc-state store, `renderDocument`/`hydrateDocument`, `textOf`, compat shims.
  Ships JSX-preserved dist with a `"solid"` export condition (the consumer's vite-plugin-solid
  compiles it per target — precompiling would pin one target; reforest packaging gotcha).
- **`@nota-lang/prelude`** — rewritten per above, same package name, JSX dist likewise.
- **`@nota-lang/compiler`** — `compile()` returns strict JSX with imports. `analyze()` parses once
  and caches the editor's virtual TSX, mappings, diagnostics, AST, free names, and highlights.
- **`@nota-lang/vite`**, **`@nota-lang/cli`** — per above.
- **Deleted**: `react` and `react-router` (git history keeps them). `paper` and `playground`
  are ported (see Follow-ups).
- **`@nota-lang/runtime`** — deleted (the LSP preamble now generates from ambient
  declarations, not the runtime `.d.ts`; zero consumers remained).
- nota-lang.org (react-router) unaffected on master.

## Post-landing architecture notes (the simplification sweep's analysis)

### List ownership (the 2026-08 audit)

Hard-coded mirror lists are dissolved into three tiers, preferring **runtime introspection >
single-sourcing > drift tests > deliberately-manual-with-a-conformance-guard**:

- **The reader owns the emit surface** and exports it over the wasm boundary: `emitSurface()`
  (structural / solid / solid-web / prelude emit-name groups + the reserved set + `FLOW_TAGS`)
  and `lineClassifiers()` (the lexer's regex sources). `CORE_RUNTIME_NAMES`/`SOLID_WEB_NAMES`
  are *derived* from it; the LSP's delegated-line walk consumes the classifier patterns; tests
  pin emit-groups ⊆ ambient policy lists, reserved = `Doc` + groups, `FLOW_TAGS ∩ INLINE_TAGS
  = ∅`. All emit-surface names (incl. `Tex`/`Heading`/…) are **reserved** — a document binding
  is a diagnostic; per-doc override goes through the integrator's prelude seam.
- **TS families are single-sourced**: `FRAMEWORK_MODULES`/`FRAMEWORK_PACKAGES` (compiler) feed
  vite's fallbacks + dedupe and the CLI's pinned-resolver regex; core
  owns the entity decoder and DOM-marker constants; prelude bundles no grammar and reports the
  registered set through `loadedLangNames()`, single-sourcing the curated list as
  `COMMON_LANGS` (`@nota-lang/prelude/langs`), and names the snapshot wire keys (`FACT_KINDS`);
  codemirror owns the palette and exports `KIND_STYLES`.
- **Policy stays hand-written but alarmed**: the ambient name lists (⊆-surface loops), the
  preamble's type declarations (real-type snapshot tests), `KIND_STYLES` (key-set equality with
  `highlightKindNames()`), and the emacs font-lock tier (`tests/conformance.el` —
  subset-correctness against reader spans over `integration/*.nota`).

The surviving system, by layer — with the judgment calls the sweep made explicit:

- **Reader (oxc).** One lowering and one result type. `compile` is the strict, TypeScript-stripped
  build path; `analyze` recovers and derives all editor views from one parse.
- **`@nota-lang/compiler`.** Runs the reader, binds free names to four module surfaces, and caches
  recovered analyses by source. The one policy knob
  (`preludeModule`/`extraNames`) is the whole reason the shim exists as a seam — the reader
  stays mechanism. The canonical ambient name lists are exported from here and consumed by the
  LSP preamble generator (coverage-guarded) and the playground scope (imported), so the three
  ambient surfaces cannot drift.
- **`@nota-lang/core` (8 files).** Reforest + the doc-state store + two ~40-line drivers.
  Deliberate dualities kept, each load-bearing: `read()` (seed-pinned, for forward readers) vs
  `live()` (position-complete readers holding non-JSON thunks — trailers); silent `release()`
  (a notifying release re-rendered converged-equal values as visible DOM churn); `tight` mode
  (the old "tight nodes get only groupLists" as a Reforest prop rather than a tag table).
- **Prelude.** Plain components + pure derivations. `titleTextOf` stays prelude-side (it knows
  the prelude's own meta classes); generic `textOf` stays runtime-side.
- **vite/cli.** The preset is [transform, vite-plugin-solid]; the CLI keeps the two-build
  structure because SSR and client genuinely need different compilations of the same graph —
  irreducible under per-target JSX compilation.
- **Known consciously-accepted approximations** (unchanged from the landing): a construct
  rendered inside a trailer thunk registers at the trailer's position; a mid-document
  `@Notes` sees notes accumulated so far.

## Follow-ups — status

1. ✅ **Reader vNext: native JSX emit** — landed on oxc branch `solid` (goldens regenerated;
   jsxify deleted; the compiler shim is pure free-name import binding). The
   `inlineComponent`/`blockComponent` compat shims briefly outlived it, then were deleted
   outright: document components are plain Solid arrows, annotated for the strict LSP view
   (`(props: { children?: unknown }) => …`) with the annotation stripped from the runtime emit.
2. ✅ Language-server preamble v2 (global JSX namespace + intrinsics table + solid surfaces);
   ✅ playground on in-page babel-preset-solid (Solid UI, pure-CSR preview).
3. ✅ Code decorations over resolved children. `data-category` protocol: still only if
   sniffing bites in practice.
4. ✅ Paper port (store-numbered figures; Bnf tooltips explicit). Doc-state intentionally uses
   registration order; DOM-order tracking remains out of scope.

Removed outright in the post-landing sweep: `@nota-lang/runtime`, `@nota-lang/react`,
`@nota-lang/react-router` (git history keeps them).

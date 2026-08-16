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
| `inlineComponent`/`blockComponent` kinds | dissolved — categorization is by *rendered root tag* |
| vanilla-JS def-tooltip trailer (script/style strings) | a Solid tooltip component (`onMount` delegation) |
| `@nota-lang/react`, `@nota-lang/react-router` | removed from the workspace |
| `@nota-lang/runtime` | mothballed shim (typing for the LSP until reader vNext) |

What survives untouched: the reader's notation → tree semantics, the Scribble whitespace pass, the
free-name analysis + ambient-prelude injection (JSX references components as free identifiers, so
the mechanism carries over verbatim), reader-driven highlighting, and the whole IDE story's
*architecture* (the virtual emit will track the new surface in reader vNext).

## The pipeline

```
doc.nota
  │  oxc reader (unchanged tonight: h-call emit + freeNames)
  ▼
bare emit ──jsxify──▶ Solid JSX module          ← @nota-lang/compiler (interim; reader vNext emits JSX directly)
  │  + ambient imports (@nota-lang/solid, @nota-lang/prelude, solid-js)
  ▼
vite-plugin-solid  (dom | ssr+hydratable — the consumer's build target decides)
  ▼                                      ▼
client module                     server module
  hydrate(() => <Doc/>, root)       renderDocument(Doc) → { html, state }   (two-pass, see §Doc-state)
```

`jsxify` is a small babel pass over the reader's emit — the emit is mechanically regular
(reader-generated `h`/`Fragment`/`decode` calls with user `%`-code interleaved), so the rewrite is
a faithful deserialization of the tree back into syntax. It is the **executable spec for reader
vNext's native JSX emit**; when the reader emits JSX directly, jsxify and the h-call surface are
deleted. Rules:

| emit | JSX |
|---|---|
| `decode(X)` (Doc body wrap) | `<NotaDoc>{X′}</NotaDoc>` |
| `h("p", {…}, kids)` | `<p …>{kids′}</p>` |
| `h("nota-ul-li"/"nota-ol-li", …)` | `<UlLi>…</UlLi>` / `<OlLi>…</OlLi>` |
| `h(flowTag, …)` (div, blockquote, figure, td, …) | `<flowTag><Reforest>…</Reforest></flowTag>` |
| `h(Comp, {…}, kids)` | `<Comp …>{kids′}</Comp>` |
| `Fragment(props?, …kids)` | `<>{kids′}</>` (props/key dropped — Solid has no key) |
| `xs.map((x,_i) => Fragment({key:_i}, body))` (the `@for` shape) | `<For each={xs}>{(x,_i) => <>{body′}</>}</For>` |
| adjacent string children | coalesced into one `{"…"}` (see ¶ below) |
| `inlineComponent`/`blockComponent` | left as calls — 2-line compat shims in `@nota-lang/solid` |
| everything else (`%`-code) | untouched (h-calls in expression position rewrite recursively) |

Three of those rows carry semantics:

- **Text coalescing.** The reader emits one `"\n"` text child per interior newline
  (decode.md's producer contract). Reforest detects paragraph breaks by blank line *within a
  string child*, so jsxify coalesces adjacent string children — a blank source line surfaces as
  `"\n\n"` inside one string, which is exactly reforest's `PARA_BREAK`. A single `"\n"` stays a
  soft break inside the paragraph, verbatim. The whitespace contract is unchanged; only its
  consumer moved.
- **Flow containers become an emit policy.** Old `struct` recursed implicit paragraphing into
  `HOST_FLOW_TAGS` at runtime via a tag table. `children()` resolution can't restructure *inside*
  an already-rendered element, so the wrap moves to the emit: the reader statically knows the tag,
  and jsxify (later the reader) wraps flow-tag children in `<Reforest>`. The runtime tag tables
  die; the one classifier left is reforest's phrasing-content set.
- **`<For>` recovery.** Solid has no `key`; keyed reconciliation is `<For>`. jsxify recognizes the
  reader's exact `@for` shape (a `.map` whose callback returns `Fragment({key: _i}, …)`) and
  rewrites it; user-written `.map`s in `%`-code are untouched.

The compiler shim's prepended import changes from `@nota-lang/runtime` to the free-name-driven
trio: `@nota-lang/solid` (NotaDoc/Reforest/UlLi/OlLi/inlineComponent/…), `@nota-lang/prelude`
(unchanged mechanism), and `solid-js` (the ambient state surface: `createSignal`, `createMemo`,
`createEffect`, `Show`, `For`, `onMount`, `onCleanup` — replacing the React-hook ambient set;
documents write Solid idioms in `%`-code now).

## `<Reforest>` — decode, resolved

Vendored from `~/Code/reforest` (`packages/reforest/src/lib.tsx`, our own spike) into
`@nota-lang/solid`, with two Nota-specific divergences:

1. **Sections nest.** Reforest v2 delimits *flat* sibling sections by design; Nota's spec
   (decode.md §struct) is hierarchical — a heading owns following siblings until the next heading
   of rank ≤ its own. The vendored parse keeps a section *stack* keyed on heading level. (This was
   reforest's own "if hierarchy returns, it's a parse-stack change only" TODO.)
2. **Class names.** Wrapper classes are `nota-para` / `nota-list` / `nota-section` (styling
   hooks; the old serialize emitted bare tags, so any class is new surface).

Semantics otherwise as proven in the spike: inline runs → `<p>`, blank-line-in-string →
paragraph break, blocks pass through, `<UlLi>`/`<OlLi>` runs coalesce by kind, whitespace-only
children bridge list runs. Categorization is post-resolution — **a component is "inline" or
"block" according to the root element it actually rendered**, seen through the boundary (DOM
inspection client-side, chunk sniffing server-side). The declared-kind constructors are therefore
meaningless; they survive only as compat sugar:

```ts
export const inlineComponent = (fn, _name?) => (props) => fn(props.children, props);
export const blockComponent = inlineComponent;
```

Known sniffing limits (inherited from the spike, acceptable v0): a component rooted in dynamic
text SSRs a marker-led chunk and categorizes as inline; the `data-category` declaration protocol
is the documented fallback if this bites.

## Doc-state — the LaTeX `.aux` model, in process

The old mark/query system existed because forward references (a Toc above its headings, `@ref` to
a later section) need whole-document knowledge. The Solid-native replacement is the model LaTeX
has always used — render, write the aux file, render again reading it — collapsed into one
process:

- **The store.** `createDocState()` — a per-document reactive store behind a context.
  Components *register* facts during render (`heading`, `label`, `footnote-ref`,
  `footnote-def`, `definition`, `cite`, plus named `trailer` thunks) and *read* derived facts
  through memos (`headings()` in order, `headingNumber(id)`, `footnoteNumber(label)`,
  `citeLabel(key)`, …). Registrations ≙ the old marks; memos ≙ the old queries; the store ≙
  `DocIndex`. Unmount unregisters (`onCleanup`), so doc-state is **reactive**: a heading inserted
  by a `<Show>` renumbers the document live — something the old design could never express.
- **SSG renders twice.** Pass 1 renders to populate the store (forward reads resolve to
  placeholders). Pass 2 renders with pass 1's snapshot as the **seed**: a read whose fact isn't
  yet live falls back to the seed, so forward references are correct in static HTML. After pass
  2, the new snapshot must equal the seed — a mismatch is a pointed "document did not converge"
  error (the old "query output may not introduce new marks" rule, now emergent rather than
  legislated).
- **Hydration seeds from the page.** The converged snapshot (plain JSON: ordered heading
  facts, footnote order, cite set — numbers and ids, never vnodes) is embedded as
  `<script type="application/json" id="nota-doc-state">`. The client's `hydrateDocument` reads
  it, seeds the store, and calls Solid's `hydrate` — every doc-state read during claiming matches
  the server bytes; afterward live registrations take over and reactivity owns the numbers.
- **Pure CSR** (dev server, playground): no seed; forward references resolve reactively a tick
  after first render. Correct by construction, just not pre-resolved.

`renderDocument(Doc)` (two-pass + convergence + snapshot) and `hydrateDocument(Doc, opts)` (seed +
hydrate) are ~40 lines in `@nota-lang/solid` — they replace `render`, `island`, capture mode, the
manifest, and `hydrateDocument`'s replay machinery.

Ordering caveat (v0): document order is approximated by registration order (= mount order). A
dynamically *inserted* heading registers last and numbers last even if it sits mid-document;
DOM-position-sorted registration is the v2 fix if it matters in practice.

`NotaDoc` adopts an outer store when one is provided (`useContext ?? createDocState()`), so the
driver owns the store during SSG/hydration and a bare `<NotaDoc>` in tests/CSR is
self-sufficient. Trailers: a prelude component that *needs* a document-end appendix (footnotes
list, definition tooltip bank) registers a named trailer thunk idempotently on first use;
`NotaDoc` renders a `<TrailerOutlet>` after the reforested children. Explicit `@Footnotes`
placement sets a store flag the default trailer checks — same override semantics as the old
registry, no registry.

## The prelude, Solid-native

Every component becomes a plain Solid component over the store. The behavioral specs from
decode.md §Doc-state carry over unchanged (slugs/dedup, footnote label semantics, backlinks,
unreferenced-definition drop, duplicate errors); only the mechanism changes:

- **`Heading`** registers `{rank, id, text}` (id = authored ?? slugified resolved text, deduped)
  and renders `<hN id>` with its number per `secset` depth. Text extraction uses `textOf(resolved
  children)` — `textContent` client-side, tag-strip + entity-decode on SSR chunks — the same
  see-through trick reforest uses for categorization.
- **`Toc`** renders `<nav>` from the `headings()` memo (seed-corrected on the server).
- **`Label`/`Ref`** as before; def-aware `Ref` consults definitions first.
- **Footnotes/Cite/Bibliography**: same numbering/dedup/error semantics, derived in memos.
- **`Definition`/def-refs**: the anchor renders in place; references render **real anchors**
  (`<a href="#def-key" data-nota-def="key">`) — no-JS clicks jump to the definition (progressive
  enhancement the old scriptful design didn't have). The tooltip bank + delegated
  click/dblclick/Escape handling become a Solid trailer component whose handlers attach in
  `onMount` — the `DEF_TOOLTIP_SCRIPT` string, its `<style>`/`<script>` injection, and the
  window-global guard are deleted. `texRef` is unchanged (a TeX-source wrapper).
- **`Tex`**: KaTeX→MathML sync as before; output lands via Solid's `innerHTML` (SSR-safe). Armed
  parts: scalars were stringified into the TeX source by the emit already; a vnode-armed part is
  detected via resolution and stays a fatal diagnostic.
- **`CodeInline`/`CodeBlock`**: sync shiki over `textOf(children)`. **v0 regression, flagged:**
  armed-part *decorations* (elements inside code becoming shiki decorations) are dropped for now
  — armed elements contribute their text only. Restoring them = mapping resolved child offsets
  to decoration ranges; deferred with the reader-vNext work.
- **Config** (`lstset`/`mathset`/`secset`/`bibset`): same functions, but **positional** now — a
  mid-document `%lstset(…)` affects subsequent code blocks only (statements execute in document
  order during the single component-body run), not "last write wins globally". This matches
  LaTeX's actual `\lstset` and is the more defensible semantics; flagged as an intentional
  change.

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

- **`@nota-lang/solid`** — rewritten: `Reforest`/`UlLi`/`OlLi` (vendored + nested sections),
  `NotaDoc`, the doc-state store, `renderDocument`/`hydrateDocument`, `textOf`, compat shims.
  Ships JSX-preserved dist with a `"solid"` export condition (the consumer's vite-plugin-solid
  compiles it per target — precompiling would pin one target; reforest packaging gotcha).
- **`@nota-lang/prelude`** — rewritten per above, same package name, JSX dist likewise.
- **`@nota-lang/compiler`** — `compile()` now returns the JSX module (jsxify inside); prepends
  the solid/prelude/solid-js ambient imports. `compileVirtual`/`highlightSpans` untouched.
- **`@nota-lang/vite`**, **`@nota-lang/cli`** — per above.
- **Removed from the workspace** (dirs kept for diffing): `react`, `react-router`, `paper`
  (its components are h-call-based; porting it is mechanical follow-up work after the prelude
  pattern settles), and `playground` (a React app over the old runtime; returns with
  in-browser JSX compilation).
- **`@nota-lang/runtime`** — mothballed in place with a deprecation README: it no longer appears
  in any emit or dependency edge, but the LSP's generated typing preamble derives from its
  `.d.ts`, so it stays buildable until reader vNext replaces the virtual emit.
- **Deferred, tracked**: language-server virtual emit still types the h-call surface (stale
  against real emit until reader vNext); playground needs in-browser JSX compilation
  (babel-standalone + babel-preset-solid, as Solid's own playground does); paper port;
  nota-lang.org (react-router) unaffected on master.

## Follow-ups, in order

1. **Reader vNext: native JSX emit** — move jsxify's table into the lowering
   (`oxc_transformer/src/nota/build.rs`), including `<For>` for `@for`, flow-container
   `<Reforest>` wraps, coalesced text, and plain-arrow components; delete jsxify + the compat
   shims; regenerate goldens; virtual emit follows and the LSP preamble regenerates against
   `@nota-lang/solid`'s `.d.ts`.
2. Playground on babel-standalone; language-server preamble swap (with 1).
3. Code decorations over resolved offsets; `data-category` protocol if sniffing bites.
4. Paper port; DOM-order doc-state if dynamic insertion renumbering matters.

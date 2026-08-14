# Nota Decode — the runtime

`decode` is the pass that turns a *flat* sequence of small content pieces into the *nested* HTML
structure a document actually wants. It does three jobs:

1. **Paragraphs** — wrap a run of inline text/elements in a `<p>`.
2. **Lists** — wrap a run of list items in a `<ul>` (`-`) or `<ol>` (`+`).
3. **Sections** — make a heading own the content beneath it, up to the next heading of
   equal-or-higher rank, inside a `<section>`.

Same idea as Pollen's `decode`, but pinned by two hard requirements: it **must run during static
site generation (SSG)**, and it **must coexist with a reactive framework** (React or Solid) so
parts of the page can re-render on the client. The whole design hangs off one axis — **interactive
vs. non-interactive content**: static content is fully decoded and serialized at build time;
interactive content is deferred behind component boundaries that SSR into hydration islands.

This file is the authoritative spec for the runtime (`@nota-lang/runtime`) and the adapters
(`@nota-lang/{react,solid}`). Surface syntax and the reader's emit are specified in
[notation.md](./notation.md).

## The worked example

**Stage 1 — `.nota` source**
```
%let Colorized = inlineComponent((children) => {
  let [color, setColor] = useState("red");
  return @span[onClick: () => setColor("green")][style: {color}]{@children};
})

@for (x of ["a", "b"]) {
  - @Colorized{@x}
}
```

**Stage 3 — the emitted module** (the reader's actual output; the runtime import is prepended by
the compiler shim/integrator, and `useState` is an ambient identifier the integrator injects):
```js
import { h, decode, Fragment, inlineComponent } from "@nota-lang/runtime";

export default function Doc() {
  let Colorized = inlineComponent((children) => {
    let [color, setColor] = useState("red");
    return h("span", { onClick: () => setColor("green"), style: { color } }, [children]);
  }, "Colorized");

  return decode(Fragment(
    ["a", "b"].map((x, _i) =>
      Fragment({ key: _i }, h("nota-ul-li", {}, [
        h(Colorized, {}, [x])
      ]))
    )
  ));
}
```
Notes: (a) `Colorized` is a **document-local** lexical binding inside `Doc` — not hoisted, not
exported; a component may be defined at any depth and close over document state, because
hydration *replays* the document (see §Replay hydration). `%export let C = …` is the author's
opt-in to module scope. (b) The binding name is passed as the constructor's 2nd argument (the
**name-attach**): the returned function cannot recover its authored name (its initializer is a
CallExpression, so JS assigns none), and the manifest's `comp` field needs it. (c) `@children` →
the bound `children` param. (d) `-` list marker → the `"nota-ul-li"` sentinel that `struct` later
coalesces. (e) **Doc's body keeps its `decode(...)` wrap** — that is what self-decodes the
document at `▸ = false`; component bodies get no wrap (`decode` is the identity where they run).
(f) `@for` emits a fresh map index `_i` as a `key` on each iteration's `Fragment` (see §Keyed
fragments).

**Stage 4 — the vnode tree after `Doc()` runs** (`▸ = false`; the `Colorized` boundary is
deferred, not invoked):
```
⟨FRAG, {}, [
  ⟨FRAG, {key:0}, [ ⟨"nota-ul-li", {}, [ ⟨Colorized, {}, ["a"]⟩ ]⟩ ]⟩,
  ⟨FRAG, {key:1}, [ ⟨"nota-ul-li", {}, [ ⟨Colorized, {}, ["b"]⟩ ]⟩ ]⟩
]⟩
```

**Stage 5 — HTML + manifest.** The keyed fragments dissolve (fragment transparency), the
`nota-ul-li` run coalesces into one `<ul>`, and each `Colorized` boundary SSRs as an island
wrapped in a runtime-owned marker element (React/Solid do not forward an unknown prop onto a
component's root, so the id lives on a `<nota-island>` wrapper, not the component root):
```html
<ul>
  <li><nota-island data-hydration-id="1"><span style="color:red">a</span></nota-island></li>
  <li><nota-island data-hydration-id="2"><span style="color:red">b</span></nota-island></li>
</ul>
```
```json
manifest = { "1": { "comp": "Colorized" }, "2": { "comp": "Colorized" } }
```
Inside each island's SSR, `useState("red")` baked `style="color:red"`; `onClick` is correctly
absent from static HTML. The manifest is **debug metadata only** — no props cross the wire (see
§Replay hydration); it still gates `hasIslands` and is surfaced as the `#nota-manifest` script.

## The emit surface

The reader emits a JS module importing from `@nota-lang/runtime`; the runtime provides these.
This is the byte-level contract both sides test against (the reader's golden fixtures on one side,
`packages/react/tests/integration.test.ts` closing the loop on the other).

```
import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";
```

### Runtime functions (signatures + behavior by `▸`)

```
h(t, p, ...children)          // t: string (host) | CompFn (component); p: props object | null
    ▸=false → ⟨t, p, flatten(children)⟩            // inert nota vnode; component tags NOT invoked
    ▸=true  → Adapter.h(t, p, flatten(children))   // framework hyperscript

Fragment(props?, ...children) // optional leading props (for @for keys); else all args are children
    ▸=false → ⟨FRAG, props ?? {}, flatten(children)⟩
    ▸=true  → Adapter.Fragment(props, flatten(children))  // React: createElement(Fragment, props, …)
    // The first arg is props iff it is a plain non-vnode object: not an array, string, RawHtml,
    // or element vnode (no `tag` key).

decode(v)
    ▸=false → the decode pipeline (below) ending in serialize   // the SSG pass
    ▸=true  → v                                                 // identity inside a component body

inlineComponent(fn, name?) / blockComponent(fn, name?)
    marked = (props) => withFlag(true, () => fn(props.children, props))
    marked.isComp = true;  marked.kind = "inline" | "block";  marked.compName = name
    return marked
    // `kind` drives paragraph grouping; `compName` feeds the manifest's `comp` field.

setAdapter(a) / withFlag(value, thunk)   // injector + ▸ save/restore
struct, serialize, island, render        // the SSG machinery + driver
hydrateDocument(Doc, {root?})            // the client driver (§Replay hydration)

mark(kind, data) / query(fn)             // doc-state leaves; fn: (doc: DocIndex) => children
    // ▸=false → opaque leaves resolved by the pipeline's index/force passes
    // ▸=true  → pointed error (doc-state is static-document-only; islands own secondary state)
    // The reader never emits these — they are prelude/user surface.
registerComponents(map) / registerTrailer(name, thunk)   // site policy (§The registry)
```

### The vnode data model

```
v ::= string                       // text leaf
    | { tag, props, children }     // tag: host string (decode owns) | CompFn (boundary, framework owns)
    | RawHtml                      // opaque pre-serialized leaf: struct passes it through,
                                   //   serialize emits it verbatim (§Raw leaves)
    | MarkLeaf | QueryLeaf         // doc-state leaves; gone from the tree by grouping time —
                                   //   serialize on a leftover is a pointed error
FRAG = the fragment tag sentinel
```
A static build yields a tree of plain `⟨t,p,k⟩`. Component-tagged nodes are *deferred*:
`h(Colorized, …)` does not call `Colorized`, it records a boundary.

### `flatten` (child normalization)

Children args are flattened one level (arrays spliced in — recursively, so a `.map` returning
arrays fully flattens); strings pass through **verbatim** (whitespace is significant — the reader
already ran the Scribble algorithm; the runtime must not trim or merge); numbers → `String(n)`
(`0` → `"0"`, `NaN` kept); `null`/`undefined`/`false`/**`true`** are all dropped (JSX semantics —
bare `true` dropped so `@if` guards never leak `"true"`). Built nodes always materialize `props`
(`p ?? {}`), never null. Opaque leaves (`RawHtml`, `MarkLeaf`, `QueryLeaf`) survive untouched.
Both call shapes occur — `h("nota-ul-li", {}, [child])` and `h(C, {}, x)` — and normalize to one
child list.

### The typed surface

The runtime's `.d.ts` types the emit so a `.nota` gets prop completion/checking in the IDE. Two
`h` overloads, tried in order (no loose `Record` overload — it would swallow wrong-value errors):

- **function tag**: `h<P>(t: (props: P) => unknown, p: OmitChildren<P> | null, …)` — a component
  or a prelude slot; its own parameter type drives `P`. `OmitChildren` is a *key-remapped*
  children removal that (unlike built-in `Omit`) preserves named prop types through a permissive
  `[prop: string]: unknown` index.
- **string tag**: `h<K extends string>(t: K, p: NotaHostProps<K> | null, …)` — `NotaHostProps`
  indexes a Nota-owned per-tag attribute map (`NotaIntrinsicElements`: common elements seeded with
  their distinctive attributes over a permissive `NotaGlobalAttributes` base + string-index
  fallback, so `@a[href]` completes and checks while `nota-*`/custom tags stay legal).

A wrong prop *value* on a known tag surfaces as "no overload matches" on the synthesized `h(`
call. Types only — runtime behavior is unchanged. The language server's ambient preamble is
**generated from the built runtime `.d.ts`** (`packages/language-server/scripts/gen-preamble.ts` →
committed `preamble.generated.ts`, drift-guarded): the type closure is inlined as module-local
ambient declarations, so the emit's free identifiers resolve with no module resolution and no
`node_modules`.

## The `▸` flag

The whole runtime turns on one piece of dynamic state — `▸` ("are we executing inside a component
body?"). Every context-sensitive primitive branches on it. It is a **synchronous module-global**
with `withFlag(true, thunk)` save/restore, not a parameter: the only place it is set to `true` —
`island()`'s call to `adapter.renderToString` — is synchronous in both frameworks, so the flag
cannot be observed stale across an `await`. (If async/streaming SSR is ever adopted, the server
side switches to `AsyncLocalStorage`; the client needs neither — there `▸` is effectively always
`true`, so client `decode` is unconditionally identity.) `Doc` is emitted synchronous; top-level
`await` is rejected at the notation level (see notation.md §Statements).

The runtime is one flat package: the SSG machinery (`struct`/`serialize`/`island`) is dead code in
the client bundle and we ship it anyway — code-splitting it out is a size optimization, not a
structural concern.

## The adapter

A single ambient adapter, set once before any `▸`-render (`setAdapter(a)`); calling a
`▸`-dispatching primitive with no adapter set throws a pointed "no adapter injected" error. One
adapter per process (one framework per app).

```
Adapter = {
  h(tag, props|null, children) → El     // tag: string | CompFn
  Fragment(props, children)    → El     // React: createElement(React.Fragment, props, …)
  renderToString(el)           → string // SSR, synchronous in both frameworks
  hydrate(el, container)       → void   // client island boot
}
```
`children` is internally typed `unknown` (it carries a `VNode[]` from `h`'s `▸=true` path and a
single `RawHtml` from `island`). **`raw(html)`** is a `Symbol`-branded marker for pre-rendered
HTML that survives `flatten`; adapters switch to innerHTML for it (React
`dangerouslySetInnerHTML`, Solid `innerHTML`). A raw slot passed to a component tag rides through
as `children` and re-emerges as innerHTML on the host the component forwards `@children` to.

## The decode pipeline

At `▸ = false`, `decode` is

```
decode(v) = serialize( struct( force( index( normalize( trailers(v) )))))
```

- `trailers` — if any trailers are registered (§The registry), append each trailer thunk's
  children after the document content, wrapping the input in a transparent fragment — before
  `index`, so trailer queries force normally.
- `normalize` — static-template expansion + transparent-fragment splicing as a whole-tree
  pre-pass, so the index sees marks produced *by templates*.
- `index` — one DFS collecting `mark` leaves into a `DocIndex`.
- `force` — remove mark leaves; splice each `query`'s output (normalized, recursively forced) in
  place. Force runs **before grouping** — load-bearing: forced output (a Toc's `nota-ul-li`
  sentinels) participates in list/para/section grouping like authored content, and the grouping
  passes never see a doc-state leaf.
- `struct` — the grouping passes (below).
- `serialize` — HTML emission + islands (below).

For a tree with no marks, queries, or trailers, the pipeline decodes byte-identically to plain
`serialize(struct(v))`. A direct `struct`/`serialize` caller that skips the doc passes hits the
pointed leftover-leaf error in `serialize`.

### Static templates

A **plain function used as a tag is a static template**: `normalize`/`struct` expand it eagerly —
invoke it with `{ children, …props }` and splice the (normalized) result into the sibling stream
*before* grouping, so a template's list sentinels coalesce with its siblings'. Expansion chains (a
template may return a template-tagged node); a cycle is a pointed error. The marked
`inlineComponent`/`blockComponent` constructors buy what only a boundary can have — deferral,
`kind`-driven grouping, hydration islands — and are *not* expanded. Under `▸ = true` the framework
adapter invokes plain function tags natively.

### Doc-state: marks & queries

Two-pass constructs (table of contents, heading numbers, `@ref`, footnotes, citations) need
*whole-document* knowledge before their own position serializes. The model is **one evaluation +
tree passes** (Scribble collect/resolve), not two evaluations: `Doc()` already produces the
complete vnode tree before any decoding, so forward reference is a scoping problem, not a temporal
one.

Two `Symbol`-branded opaque leaves (`packages/runtime/src/doc.ts`):

- **`mark(kind, data)`** — registers an index entry at its tree position; removed by `force`.
- **`query(fn)`** — `fn: (doc: DocIndex) => children`, forced against the built index (output
  normalized like any `h` child).

Both survive `flatten` and pass through `struct` untouched. **`DocIndex`**: `all(kind) →
IndexedMark[]` (document order; empty for an unknown kind) and `get(mark) → IndexedMark` (identity
lookup — the mark object is the handle), where `IndexedMark = { kind, data, seq /* per-kind,
1-based */, pos /* global DFS order, total across kinds */ }`. The indexing DFS descends boundary
*children* (static tree) but never bodies, and walks a vnode-valued `data.content` — so marks
inside footnote content index at the parent mark's `pos`.

Two hard rules:

- **Query output may not introduce new marks** — pointed error, no fixpoint iteration. (A
  bibliography's "References" heading is *authored* above `@Bibliography`, not generated;
  Typst-style iterate-to-convergence is the v2 escape hatch if ever needed.) Query output may hold
  further queries — forced against the same frozen index, so it terminates.
- **`mark`/`query` throw at `▸ = true`** — doc-state is a static-document construct; islands own
  any secondary state. Marks/queries in an island's static *children* are fine (in the tree,
  resolved before the slot serializes); in an island's *body* they are the thing rejected. A query
  may *return* an island (an interactive Toc), which captures and hydrates normally.

**The trailer registry** is the doc-end auto-append seam: `registerTrailer(name, thunk)` —
bare-Map, name-keyed (re-register replaces), global-persistent like `registerComponents`. The
prelude registers `"footnotes"`: render the footnote list at document end iff footnote marks exist
and no explicit `@Footnotes` placement mark does (explicit placement overrides).

**Policy is prelude, not core.** Heading numbering, `@Toc`, `@Label`/`@Ref`, footnotes,
`@Cite`/`@Bibliography`, and a `counter(kind, {resetOn})` helper (hierarchical numbers from
`all()` + `pos`, memoized on the index) all live in `@nota-lang/prelude` as slots/templates over
`mark`/`query` only:

- **Headings**: `# Title` re-lowers to the ambient `Heading` slot — `h(Heading, { rank: 1 },
  ["Title"])`. The default `Heading` emits `mark("heading", …)` plus a query producing the
  concrete `<hN>` — normalize precedes grouping, so `groupSections` still sees a real `hN`
  (forced first). `id` = authored `id` prop ?? slugified text content (deduped); Toc link content
  flattens heading children to text. A raw `@h2{…}` stays a plain host tag — the principled
  unnumbered/un-Toc'd escape hatch (`\section*`).
- **Labels/refs**: `Label`/`Ref` take an `id` prop; a label binds to the nearest **preceding**
  heading mark by `pos` (LaTeX semantics).
- **Footnotes**: `FootnoteMark[label]` is the reference (a `"footnote"`-kind mark);
  `FootnoteText[label]{content}` is the definition — contributes content, renders nothing in
  place. Markdown semantics: repeated references to one label share ONE number (numbering =
  distinct-label first-appearance order, interleaved with anonymous `@Footnote{…}` one-shots,
  which remain supported via synthetic labels); the list renders one entry per distinct
  *referenced* label, backlinking the first reference. A referenced label with no definition →
  pointed error; duplicate definitions → pointed error; an unreferenced definition is dropped
  silently (drafts accumulate). Entry content decodes as **flow**: the list wraps each entry in a
  `div` flow container inside its `<li>` (`li` is tight — it would swallow paragraph breaks), with
  the backlink appended inside so it joins the final paragraph run:
  `<li><div><p>…</p><p>… ↩</p></div></li>`.
- **Citations**: a cite's *label* may depend on the global cite set (numeric-by-alphabetical
  styles are index-computable).
- **Config**: `secset({numberDepth, …})`, `bibset({src, style})` follow `lstset` exactly
  (§Doc-global config).

### `struct` — the grouping passes

Three sibling-grouping jobs over a child list, in this order (lists/headings must survive
paragraph grouping; sections must see the lists/paras they own), then recurse — *stopping at
boundaries*. Implemented in `packages/runtime/src/struct.ts`.

**The container gate.** For a host/fragment node, `struct` runs:

- `groupLists` — **always** (lists may nest in any container; idempotent — `ul`/`ol` carry no
  sentinels). A run is *maximal* over same-kind `nota-ul-li`/`nota-ol-li` sentinels, with
  **whitespace bridging**: while accumulating a run, a maximal group of whitespace-only text
  siblings *immediately followed by another sentinel of the same kind* is consumed and the run
  continues; anything else ends the run and that trailing whitespace is left in place (edge
  whitespace — before the first sentinel, or after a run — is untouched, so the paragraph-break
  markers fencing a list off from prose survive). So a stray `"\n"` between items — however the
  stream was assembled (a `@for`, a template, hand-written `h`) — never splits a list, and blank
  lines between authored items don't either. Nested lists need no case: the parser nests a deeper
  run inside the parent item's children, so struct's recursion forms the inner list.
- `groupParas` — **only in a flow container** (`tag ∈ HOST_FLOW_TAGS` or `tag === FRAG`);
  idempotent (its `<p>` is a block tag → a re-run passes it through). A maximal inline run wraps
  in `<p>`; paragraph-break markers split runs and are consumed; block siblings flush the run and
  pass through. `isBlock(v) = t ∈ HOST_BLOCK_TAGS ∨ (isComp(t) ∧ t.kind === "block")` — inline
  components join the run (land inside the `<p>`), block components flush it.
- `groupSections` — **only in a flow container that is not itself `<section>`** (a section's
  children were already fully nested by the parent's recursive `groupSections`; re-running would
  re-wrap its leading heading). A heading owns following siblings until the next heading of rank ≤
  its own: `⟨section, {}, [heading, …owned]⟩`. `groupSections` is **totally recursive** — one call
  builds the entire section nesting; `struct` then descends to add paras/lists to leaf content
  without re-sectioning.

Tight nodes (inline host tags `em`/`strong`/`a`/`span`…, and `p`/`li`/`h1`–`h6`/`pre`) get
**only** `groupLists`.

**HOST_BLOCK_TAGS** (block-as-*sibling*: flushes a paragraph run, then passes through unwrapped):
`section article aside nav header footer main div h1–h6 ul ol li dl dt dd p blockquote pre figure
figcaption hr address table thead tbody tfoot tr td th caption form fieldset`.

**HOST_FLOW_TAGS** (flow-as-*container*: its children get implicit `<p>`/`<section>`):
`section article aside nav header footer main div blockquote figure td th` (+ `FRAG`).

**The asymmetry is load-bearing:** `p`, `li`, `h1`–`h6` are block *siblings* but **not** flow
*containers* — that is what keeps an author's `@p{}` and tight `<li>` content from being
re-paragraphed. Both tag sets are cross-package contract points: the reader's notion of which tags
group must agree with the runtime's.

**Component children slots (keyed on `kind`):** a **block** component's static children decode as
flow (paras + sections + lists — `@Aside{…}`); an **inline** component's decode tight
(`groupLists` only — the worked example's `@Colorized{a}` keeps `"a"` bare). `groupLists` runs in
both, so a list authored inside any component still coalesces. The boundary stop always holds:
decode the children, never the body.

**Fragment transparency.** As a *container*, `FRAG` is a flow container (the document body is a
`FRAG`). As a *sibling*, `FRAG` is **transparent**: `struct` splices a FRAG sibling's children
into the parent's sibling stream — recursively — *before* the grouping passes, so the children
participate in the parent's grouping. This is what makes `@for`'s per-iteration keyed `Fragment`
dissolve at `▸ = false`: the wrapped `nota-ul-li` sentinels become direct siblings and
`groupLists` coalesces them into one `<ul>`. The key (in FRAG props) is dropped during the splice
— static HTML needs none; at `▸ = true` the Fragment carries its key through `adapter.Fragment`.

**Keyed fragments.** `@for (x of xs) {body}` emits `xs.map((x, _i) => Fragment({ key: _i },
…body))` — the reader adds its own fresh map-index param as the key on each iteration's wrapping
Fragment, which React/Solid need for client reconciliation (React: `createElement(React.Fragment,
props, …)` accepts `key`; Solid best-effort). `@if` stays keyless (single branch, no list
reconciliation).

**The paragraph-break marker (the reader ⇄ runtime whitespace contract).** A paragraph break in a
child stream is a **whitespace-only text child containing a blank line** — regex
`/\n[^\S\n]*\n/`. It splits paragraph runs and is consumed. A single `"\n"` (any whitespace with
no blank line) is a **soft break that stays inline** (joins the `<p>`, preserving the author's
line breaks). The reader's whitespace pass MUST emit one `"\n"` text child per interior newline
and MUST NOT pre-coalesce adjacent newlines — a blank source line then naturally surfaces as ≥2
adjacent newlines (= the break marker). This is notation.md §Whitespace ("interior newlines become
individual `"\n"`") as a hard producer/consumer contract.

### Raw leaves

`RawHtml` (`raw(html, opts?)`) is an opaque pre-serialized leaf: `struct` passes it through,
`serialize` emits it verbatim (never re-escapes). A raw leaf declares its own blockness —
`raw(html, { block: true })` acts as a block *sibling* in paragraph grouping (flushes the run,
never `<p>`-wrapped; shiki's `<pre>` root and display MathML use it); the default is inline (KaTeX
inline output joins the run).

### `serialize` + islands

`struct`'s output has only boundary `CompFn` nodes left. Serialization stringifies host nodes and
renders each boundary as a hydration island:

```
serialize(v):
  v is string   → escape(v)
  v is RawHtml  → v.html                       // verbatim
  v is a doc-state leaf → pointed error        // the pipeline's force pass should have removed it
  isComp(v.tag) → island(v)
  else          → `<t …attrs>` + children.map(serialize).join("") + `</t>`

island(v):
  id   = freshId()
  slot = v.children.map(serialize).join("")    // static children → pre-rendered HTML slot
  manifest[id] = { comp: nameOf(v.tag) }       // DEBUG metadata; props never cross as data
  return `<nota-island data-hydration-id="${id}">`
       + withFlag(▸=true, adapter.renderToString(adapter.h(v.tag, v.props, raw(slot))))
       + `</nota-island>`
```

Inside `renderToString` the body runs with `▸ = true`: its `h` → `adapter.h`, its `decode` →
identity, and hooks/signals run (the worked example's `useState("red")` bakes `color:red`). A
plain function tag reaching `serialize`'s host path (or a leftover doc-state leaf) is a pointed
error, not silent stringification.

## `render` — the driver

```
render(Doc) = { reset(); return { html: Doc(), manifest } }
```

**`render` does not re-decode.** The emitted `Doc` already wraps its body in `decode(...)`, so
`Doc()` returns decoded HTML and populates the manifest as a side effect; re-applying
`serialize(struct(...))` would double-escape and re-run `island`. (`render` also tolerates a
`Doc()` that returns a raw vnode tree — the fallback runs the same full pipeline, so
marks/queries/trailers resolve there too.) `reset()` zeroes the id counter and manifest, clears
`▸`, and runs the registered config-baseline restores (§Doc-global config) — so multi-document
builds don't leak per-document state.

## Replay hydration — the client

An island may be defined at **any depth**, close over **arbitrary document state** (an `@for`
loop variable, a `%const` above it), and take **non-JSON props** (functions, class instances).
This works because the client does not transport island data — it **replays the document**:

- **Capture.** The client entry re-executes `render(Doc)` (same `reset()`, same traversal) with
  `island()` in a *capture* mode that records the live boundary at every depth — the `CompFn` with
  its closure intact, the live props, and the recomputed slot HTML; the produced HTML string is
  discarded. A depth-0 boundary skips its SSR; a boundary nested in a *parent's slot* still SSRs
  for parent-slot byte-parity. Hydration ids match the server **by construction** — identical
  `freshId`-before-slot traversal in both modes.
- **Hydrate.** `hydrateDocument(Doc, {root?})` then hydrates every captured island into its
  `[data-hydration-id]` node — every marker, nested ones included, in ascending id order (outer
  before inner), with per-island `try`/`catch` leniency; returns a teardown array. The static
  `@children` slot is **recomputed by the replay, not scraped** from the DOM.
- **Determinism guard.** Before hydrating anything, the captured id set must equal the document's
  `[data-hydration-id]` set — a mismatch is a pointed "did not replay deterministically" error.
  The replay is sound only if the document's `%` code is isomorphic across runs and its island
  sequence is order-stable.

The client entry is wiring only: `import Doc from "./doc.nota"; setAdapter(adapter);
hydrateDocument(Doc);` (`@nota-lang/vite`'s `generateClientEntry` emits it). The document module
therefore ships to the client whenever the page has any island; an island-free page ships **zero
JS**.

Known limits (v1): prelude registry slots (KaTeX/shiki) re-execute client-side on an islanded
document — the replay recomputes slot bytes, so the client build must mirror the server's
setup-bake (`bakeConfigBaseline()` after the setup import). And Solid's client build forbids
`renderToString`, so an island nested inside a *parent's slot* is a pointed error under Solid.

## The registry & config

**Component registry (site policy).** The ambient prelude identifiers bind to **registry slots,
not concrete components** (the MDX-provider analogue): `@nota-lang/prelude` exports
`Tex`/`CodeInline`/`CodeBlock`/`Heading`/… as `slot(name, Default)` — a *plain* function
`(props) => h(lookup(name) ?? Default, props, children)`. Static-template expansion resolves the
slot eagerly at decode time; a registered plain function expands further (fully static), a
registered `inlineComponent`/`blockComponent` is a boundary → SSR + island.
`registerComponents({Tex: …})` (runtime; a bare Map, no deps) is **global-persistent** — site
policy, NOT reset per `render`. Per-document override is lexical: a `%import` shadows the ambient
binding.

**Doc-global config.** `lstset({lang, theme, …})` and `mathset`/`secset`/`bibset` are
document-global and **last-write-wins** — template expansion happens inside `decode`, after the
whole `Doc` body evaluated, so mid-document calls are NOT positional — and **reset per
`render()`** (unlike registration; the baseline restore hooks run in `reset()`). A build's
`--setup` module can bake a site-wide baseline (`bakeConfigBaseline()`).

**Prelude defaults.** `Tex` = KaTeX→MathML (`renderToString(tex, { output: "mathml", displayMode:
display })` → `raw(...)`; a *vnode* armed part inside math is a fatal diagnostic — KaTeX cannot
host HTML; scalar armed parts stringify-splice into the TeX source). `CodeInline`/`CodeBlock` =
sync shiki core (JS regex engine, eagerly-loaded curated grammars): the parts are reassembled into
ONE contiguous text (raw runs + armed elements' text content + stringified scalars), tokenized
whole, and each armed element becomes a shiki **decoration** over its range (`tagName` +
`properties` from the element; nested markup inside an armed element flattens to its text; a
text-less armed part → plain fallback for the span + build warning).

**The ambient prelude.** The emitted module references `useState` and the prelude surface as
**free identifiers** — the integrator supplies them (the vite plugin injects an import of the
referenced names from its `preludeModule`; the CLI points that at a virtual module re-exporting
React's hooks + the prelude, adding the hook names via the plugin's `extraAmbientNames` option;
the language server and playground each maintain the same ambient-name set). The ambient set is
the whole prelude surface: the slots `Tex CodeInline CodeBlock Heading Title Toc Label Ref
Definition Footnote FootnoteMark FootnoteText Footnotes FootnotesList Cite Bibliography` and the
config fns `lstset mathset secset bibset texRef`. The reader does **not** emit the `@nota-lang/runtime` import either — the
compiler shim/integrator prepends it.

## SSG integration — mechanism, not policy

Nota provides the *mechanism* to compile and statically render `.nota`, and delegates *policy* —
which files are pages, routing, when and where SSG runs — to the integrator:

- **nota provides**: the `@nota-lang/vite` transform plugin (`.nota` → JS module + sourcemap +
  HMR); the programmatic SSG API (`render(Doc) → { html, manifest }`, `hydrateDocument`,
  `generateClientEntry`); and the adapters (`setAdapter` + `@nota-lang/{react,solid}`, one per
  build).
- **the integrator owns**: page discovery/routing, the prerender loop and where HTML is written,
  dev-server rendering policy, and triggering the client island build.

SSG is two-sided, à la Astro: the integrator loads a page's compiled module in a Node/SSR context,
`setAdapter`s, calls `render(Doc)`; when the manifest is non-empty (`hasIslands`) it bundles the
wiring-only replay entry for the client. Solid's SSR↔hydrate is cross-process (the server build
emits HTML + `_$HY` resume data; the client resumes it), so Solid SSG needs **separate Vite builds
with the right export conditions** (`solid-js/web` → `server.js` vs `web.js`).

The first two integrators are `@nota-lang/cli` (`nota build doc.nota → doc/`: a **document
directory** — `index.html` + `assets/` — built with two Vite builds under a default config, an
SSR render then a client island build, so doc-relative imports, `?url` assets, and CSS imports
work as in any Vite app; zero-JS for island-free docs; the manifest is inlined as a
`#nota-manifest` JSON script the boot does not depend on) and `@nota-lang/playground` (fully
client-side: wasm compiler + runtime in-browser; panes = emitted JS / post-SSG HTML+manifest /
hydrated result in a sandboxed iframe via blob-URL ESM + import maps).

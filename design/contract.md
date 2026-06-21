# Nota Build Contract (authoritative, reconciled)

This file is the **single source of truth** that keeps the parallel build streams in sync. It
reconciles the three design docs and pins the cross-stream contract. **Read this before touching any
package.** When this file conflicts with `notation.md`/`decode.md`, this file wins; when this file is
silent, `implementation.md` > `decode.md`/`notation.md`.

Authority order: `implementation.md` (build plan) → **this file** (reconciliations) → `notation.md` /
`decode.md` (semantics, golden examples).

---

## 0. The reconciliations (what the docs disagree on, and the ruling)

| # | Conflict | Docs | **Ruling** |
|---|----------|------|------------|
| R1 | Emit target | notation.md shows `<p>Hello</p>`; decode.md stage-3 + impl.md D1/D2/§1.6 show `h("p",{},["Hello"])` | **Emit hyperscript `h`/`Fragment`/`decode` CallExpressions, NOT JSX.** notation.md's `<tag>` is a *readability view* (decode.md "stage 2"). The reader builds oxc `CallExpression` AST directly (D1/D2). The runtime `h` MUST be a real function so it can branch on `▸`. |
| R2 | Import specifier | decode.md `from "nota"`; impl.md §2.1 `@nota-lang/runtime` | **`@nota-lang/runtime`.** |
| R3 | Component constructor | decode.md `component(...)`; impl.md §2.1 + decode.md §primitives `inlineComponent`/`blockComponent` | **`inlineComponent` / `blockComponent`** (each sets `.isComp=true`, `.kind="inline"|"block"`; `kind` drives `<p>` grouping). `component(...)` in decode.md's worked example is shorthand for one of these. |
| R4 | `%let` component placement | decode.md nests `Colorized` inside `Doc`; impl.md F1 says hoist+export | **F1 wins: component definitions hoist to module scope and are exported** under stable names (§4 F1). Other top-of-file `%` statements prepend into `Doc`; `import`/`export` hoist to module scope (notation.md). |
| R5 | Top-of-file `%` → IIFE? | decode.md stage-3 wraps Doc body in an IIFE; notation.md says top-of-file `%` *prepends to Doc* (IIFE is only for `%` nested in an element body) | **Top-of-file `%` prepends into `Doc`'s body, no IIFE.** IIFE wrapping applies only to `%` nested inside an element body (notation.md §Statements). |
| R6 | `@for` keys | notation.md/decode.md omit keys; impl.md E5 adds them | **E5: reader emits keys** (§4 E5). The non-keyed forms are pinned below; the *exact key-attachment signature* is **deferred to the Phase-D sync** — do not implement `@for` keys before then. |
| R7 | `@` vs decorators | new (Phase-A finding) | **Inside a `.nota` file, `@` is unconditionally Nota markup — JS/TS decorators are unavailable (v1).** Resolved by a parser-owned `nota_markup` bool (oxc's `Context` u8 is bit-saturated). Sound: decorators only appear in class/statement position, never in a Nota expression context. |

**Phase-A sequencing notes** (not conflicts, just ordering): (a) the reader takes body text from the
**raw source slice** (not JS-string-decoded) → embedded spans stay byte-identical (good for §1.6 span
fidelity + H1 CodeMappings). (b) **empty-body → no children** (`@p{}` → `h("p",{},[])`) is produced by
the **Phase-C whitespace pass** dropping empty/whitespace-only text, not by the element parser (the
spike currently emits `["" ]` pre-whitespace-pass).

---

## 1. The emit surface (the producer/consumer contract)

The reader (Part 1) emits a JS module importing from `@nota-lang/runtime`; the runtime (Part 2)
provides these. **This is the byte-level contract both sides test against.**

```
import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";
```

### Runtime functions (signatures + default `▸=false` behavior)

```
h(t, p, ...children)          // t: string (host) | CompFn (component); p: props object | null
    ▸=false → ⟨t, p, flatten(children)⟩            // inert nota vnode; component tags NOT invoked
    ▸=true  → Adapter.h(t, p, flatten(children))   // framework hyperscript

Fragment(props?, ...children) // optional leading props (for E5 `key`); else all args are children
    ▸=false → ⟨FRAG, props ?? {}, flatten(children)⟩      // first arg is props iff plain non-vnode obj
    ▸=true  → Adapter.Fragment(props, flatten(children))  // React: createElement(Fragment, props, …)

decode(v)
    ▸=false → serialize(struct(v))                 // the SSG pass
    ▸=true  → v                                    // identity inside a component body

inlineComponent(fn, name?) / blockComponent(fn, name?)   // name = the F1 stable/export name
    marked = (props) => withFlag(true, () => fn(props.children, props))
    marked.isComp = true;  marked.kind = "inline" | "block";  marked.compName = name
    return marked
    // nameOf(CompFn) := CompFn.compName  → island()'s manifest `comp` field (decode.md §island).
    // The reader MUST pass `name` because the constructor's returned fn is not name-evaluated
    // (its initializer is a CallExpression, so JS assigns no name); fn.name would be "" / "marked".

setAdapter(a) / withFlag(value, thunk)             // injector + ▸ save/restore
struct, serialize, island, render                  // SSG machinery + driver (decode.md §Algorithm)
```

`flatten(children)`: children args are flattened one level (arrays spliced in), text coerced, nullish
dropped. Note both call shapes occur: `h("nota-ul-li", {}, [child])` (one array arg) and `h(C, {}, x)` (one
scalar arg) — `flatten` normalizes both to a child list. See decode.md §"Context-sensitive primitives".

### vnode data model (Part 2 internal; Part 1 only emits the calls above)

```
v ::= string                       // text leaf
    | { tag, props, children }      // tag: host string (decode owns) | CompFn (boundary, framework owns)
FRAG = the fragment tag sentinel (e.g. a unique symbol or "fragment")
```

---

## 2. THE canonical golden (end-to-end, reconciled) — the shared integration fixture

This is decode.md's worked example, reconciled with R1–R5 (hyperscript, `@nota-lang/runtime`,
`inlineComponent`, F1 hoist+export, no IIFE). **Every stream tests against this.** Shown *without*
`@for` keys (R6 defers key mechanism); the integration test uses this keyless form until Phase D.

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

**Stage 3 — emitted module (hyperscript; what Part 1 produces, what Part 2 consumes)**
```js
import { h, decode, Fragment, inlineComponent } from "@nota-lang/runtime";

export let Colorized = inlineComponent((children) => {
  let [color, setColor] = useState("red");
  return decode(h("span", { onClick: () => setColor("green"), style: { color } }, [children]));
}, "Colorized");   // ← F1 name passed as 2nd arg → manifest `comp` (see §1, §4 F1)

export default function Doc() {
  return decode(Fragment(
    ["a", "b"].map((x, _i) =>
      Fragment({ key: _i }, h("nota-ul-li", {}, [
        h(Colorized, {}, [x])
      ]))
    )
  ));
}
```
Notes: (a) `Colorized` hoisted to module scope + `export`ed (F1/R4); (b) component body markup wrapped
in `decode(...)`; (c) `@children` → the bound `children` param; (d) `-` list marker → `"nota-ul-li"` sentinel
(runtime `struct` later coalesces to `<ul><li>`); (e) Doc body wrapped in `decode(...)`.

**Stage 4 — vnode tree after `Doc()` runs (`▸=false`; `Colorized` boundary deferred, not invoked)**
```
⟨FRAG, {}, [
  ⟨"nota-ul-li", {}, [ ⟨Colorized, {}, ["a"]⟩ ]⟩,
  ⟨"nota-ul-li", {}, [ ⟨Colorized, {}, ["b"]⟩ ]⟩
]⟩
```

**Stage 5 — HTML + manifest after `serialize(struct(...))`** (groupLists coalesces the `nota-ul-li` run;
each `Colorized` boundary → island, SSR'd with `▸=true` so `useState("red")` bakes `color:red`)
```html
<ul>
  <li><span hydration-id="1" style="color: red">a</span></li>
  <li><span hydration-id="2" style="color: red">b</span></li>
</ul>
```
```json
manifest = { "1": { "comp": "Colorized", "props": {} },
             "2": { "comp": "Colorized", "props": {} } }
```

---

## 3. The emit mapping table (expression-mode fixtures, hyperscript)

The reader's golden fixtures (impl.md §1.6 "expression mode") use this hyperscript form. notation.md's
left column is the source; its right column is the *JSX view* — translate to hyperscript per below.

| Nota source | Emitted (hyperscript) |
|---|---|
| `@p{Hello}` | `h("p", {}, ["Hello"])` |
| `@p{Hello @em{world}}` | `h("p", {}, ["Hello ", h("em", {}, ["world"])])` |
| `@{one @b{two}}` | `Fragment("one ", h("b", {}, ["two"]))` |
| `@em{hi}` | `h("em", {}, ["hi"])` (host: string tag) |
| `@Aside{hi}` | `h(Aside, {}, ["hi"])` (component: identifier; `@Unknown{}` → scope error) |
| `@(getTag()){hi}` | `(() => { const _Tag = getTag(); return h(_Tag, {}, ["hi"]); })()` |
| `@(Box){hi}` | `h(Box, {}, ["hi"])` (already a valid tag → no binding) |
| `@(ui.Card){hi}` | `h(ui.Card, {}, ["hi"])` (**static** member → no binding; computed `@(comps[k])` → IIFE) |
| `@a[href:"/x"]{go}` | `h("a", { href: "/x" }, ["go"])` |
| `@a[href:url]{go}` | `h("a", { href: url }, ["go"])` |
| `@input[disabled, ...rest]{}` | `h("input", { disabled, ...rest }, [])` (empty body → no children) |
| `@fig[cap:@em{hi}]{x}` | `h("fig", { cap: h("em", {}, ["hi"]) }, ["x"])` (markup-valued prop) |
| `@name` | `name` (bare-identifier interpolation) |
| `@(user.posts[0])` | `user.posts[0]` |
| `*bold*` | `h("strong", {}, ["bold"])` |
| `_italic_` | `h("em", {}, ["italic"])` |
| `# Title` | `h("h1", {}, ["Title"])` |
| `### Sub *bit*` | `h("h3", {}, ["Sub ", h("strong", {}, ["bit"])])` |
| `- a` (list item line) | `h("nota-ul-li", {}, ["a"])` (runtime `struct` groups runs → `<ul><li>`) |
| `+ a` | `h("nota-ol-li", {}, ["a"])` (→ `<ol><li>`) |
| `@if (c) {a}` | `c ? Fragment("a") : null` |
| `@if (c) {a} else {b}` | `c ? Fragment("a") : Fragment("b")` |
| `@if (c) {a} else if (d) {b}` | `c ? Fragment("a") : d ? Fragment("b") : null` |
| `@for (x of y) {@li{@x}}` | `y.map((x, _i) => Fragment({ key: _i }, h("li", {}, [x])))` (E5; §4) |
| `@code\|{@foo{x}}\|` | `h("code", {}, [String.raw`@foo{x}`])` |
| `` `@x` `` | `h(CodeInline, {}, [String.raw`@x`])` |
| ` ```python⏎f(x)⏎``` ` | `h(CodeBlock, { lang: "python" }, [String.raw`f(x)`])` |
| `$a_@i$` | `h(Math, {}, [String.raw`a_${i}`])` |
| `$$…$$` | `h(Math, { display: true }, [String.raw`…`])` |

Whitespace-significant text is emitted as explicit string children per notation.md §Whitespace
(Scribble algorithm). `CodeInline`/`CodeBlock`/`Math` are ambient prelude bindings.

**Children are always an array literal** — a single child becomes `[child]` (`@p{@x}` →
`h("p", {}, [x])`; component body `@span{@children}` → `h("span", {}, [children])`). Part 2's
`flatten` normalizes bare-vs-array, but always-array is the reader's canonical emit (verified against
the reader's actual Phase-A/B/C output). The reader does **not** emit the `@nota-lang/runtime` import
(the compiler shim/integrator prepends it).

**Integration status (Sync 3 — GREEN end-to-end).** The FULL canonical golden (`integration/golden.nota`
= contract §2 stage-1, with keyed `@for`) compiles through the reader (`oxc::nota::compile`) to the
literal emit captured in `packages/react/tests/fixtures/golden.compiled.ts`, and that emit renders
through the runtime + React adapter to the **exact** stage-5 HTML + manifest — asserted by the
`reader-emit golden (Part 1 → Part 2, full loop)` test in `packages/react/tests/integration.test.ts`.
This closes the decode.md arc across both halves on real output (keyed `@for`, fragment transparency,
`nota-ul-li` coalescing, island SSR). (`integration/run.mjs`, the standalone Node form, still needs
vite-style module resolution — the canonical executable check is the vitest test; the `@nota-lang/compiler`
shim, Wave 4, makes the live-compile path clean.)

**Document mode** additionally emits: `export default function Doc()`, hoisted `import`/`export` +
hoisted+exported component bindings (F1), the `decode(...)` wrap on Doc's returned fragment, and
`await`→`async` on `Doc`/IIFE.

---

## 4. Locked decisions (the cross-cutting ones)

- **E5 — reader emits `@for` keys. LOCKED (Phase-D sync).** `@for (x of xs) {body}` →
  `xs.map((x, _i) => Fragment({ key: _i }, ...body-children))` — the reader adds its own map-index
  param `_i` (fresh name) as the key on each iteration's wrapping `Fragment`. **Mechanism:** `Fragment`
  gains an optional **leading props arg** — `Fragment(props?, ...children)` — where the first arg is
  props iff it is a plain object that is *not* an array, string, `RawHtml`, or `ElementVNode` (no
  `tag` key); otherwise all args are children. At `▸=false` the key sits in the FRAG vnode's props
  (ignored by struct/serialize — static HTML needs no key). At `▸=true`, `adapter.Fragment(props,
  children)` → React `createElement(React.Fragment, props, ...children)` (React.Fragment accepts
  `key`); Solid best-effort. `@if` stays keyless (single branch, no list reconciliation). **This
  amends Part 2** (Fragment + both adapters) — coordinated in the same wave as Phase D.
  **Requires struct FRAG-transparency (§7):** the per-iteration Fragment must dissolve into the
  parent's grouping at `▸=false`, else the wrapped list items can't coalesce. Locked together with E5.
- **F1 — hoist+export component definitions.** The reader hoists every `%let/%const Name =
  inlineComponent(...)|blockComponent(...)` binding to **module scope** and adds `export`, under its
  authored name (stable). The manifest's `comp` field is that name. Constraint (v1, like Astro):
  a hoistable component body must close over module scope only (no document-local capture). Detection
  is syntactic: a binding whose initializer is a call to `inlineComponent`/`blockComponent`. The
  reader passes the binding name as the constructor's 2nd argument (`inlineComponent(fn, "Name")`) so
  `island`'s manifest `comp` field resolves (runtime stores it as `marked.compName`; see §1) — the
  returned fn cannot otherwise recover its authored name.
- **H1 — emit Volar `CodeMappings`.** Compiler exposes per-range `(sourceOffset, generatedOffset,
  length, capabilities)` tuples in addition to the flat sourcemap. Embedded-JS ranges get full
  capabilities; component-identifier ranges get navigation/hover; generated boilerplate is unmapped.
- **H2 — type-preserving virtual emit mode.** Same parse, two codegen tails: the build emit strips TS
  types; the *virtual* emit preserves them and emits `.tsx` for the language server.
- **Package naming.** Scoped `@nota-lang/*` per impl.md (NOT the stale `packages/nota` in typedoc.json,
  which will be updated). Directory = unscoped name under `packages/`.

---

## 5. Package & directory layout

| Directory | Package name | Part | Depot target | Notes |
|---|---|---|---|---|
| `oxc/` | (the fork) | 1 | — (Rust, `cargo`) | branch `nota`; reader lives here |
| `packages/runtime` | `@nota-lang/runtime` | 2 | lib | h/decode/Fragment/components + SSG driver |
| `packages/react` | `@nota-lang/react` | 2 | lib | Adapter |
| `packages/solid` | `@nota-lang/solid` | 2 | lib | Adapter |
| `packages/compiler` | `@nota-lang/compiler` | 1/3 | lib | wasm/napi shim around the fork |
| `packages/vite` | `@nota-lang/vite` | 3 | lib | transform plugin |
| `packages/cli` | `@nota-lang/cli` | 4 | script (node) | `nota build` |
| `packages/playground` | `@nota-lang/playground` | 4 | site (react) | live decode.md visualizer |
| `packages/language-server` | `@nota-lang/language-server` | 5 | lib (node) | Volar LanguagePlugin + server |
| `packages/vscode-nota` | `vscode-nota` | 5 | (extension) | TextMate grammar + thin client |

---

## 6. Per-stream ownership & the sync protocol

Each parallel agent owns a **disjoint path set** (no shared-file contention). Shared config
(`pnpm-workspace.yaml`, root `tsconfig.json`/`biome.json`, `Cargo.toml`) is owned by the orchestrator
only — agents never edit it. New packages are scaffolded serially by whichever stream is the **sole pnpm
actor** that wave (the orchestrator confirms there is only one), to avoid pnpm-lock races.

**Tooling note (Depot/biome):** run Depot **per-package** — `cd packages/<pkg> && depot test` or
`depot --package @nota-lang/<pkg> test` — never bare `depot test` from the repo root: a known biome
2.x root-config conflict (root `biome.json` is `"root": false`; depot-generated package configs are
biome-1.x-schema roots) makes whole-workspace runs fail biome. Per-package runs are clean. Deferred
fix; blocks nothing.

**Sync protocol** (how we avoid drift):
1. The orchestrator scaffolds + writes/updates this contract before each wave.
2. Agents read this contract first; emit/consume strictly per §1–§3; write tests against §2/§3 goldens.
3. At each **sync point** the orchestrator runs the cross-stream checks: the §1.6 *validity* invariant
   (emitted JS re-parses under stock oxc) and the §2 canonical golden run through both reader and
   runtime (the integration loop). Any drift is reconciled *here* (this file) before the next wave.
4. Decisions that touch two streams (E5, F1, H1, H2, key mechanism, whitespace edge cases) are settled
   at the named sync, recorded here, and only then implemented.

**Build order across streams** (dependency-aware waves; parallel within a wave):
- **Wave 1:** P1·A (oxc spike) ∥ P2·G,H (runtime core+struct) ∥ P5·U (grammar+ext shell).
- **Wave 2:** P1·B,C (element core + doc mode) ∥ P2·I,J,K (serialize/island, adapters, driver) ∥ P3·L scaffold.
- **Wave 3:** P1·D,E,F (control flow, sugar, verbatim) ∥ P3·L,M (transform + registry) ∥ integration loop.
- **Wave 4:** P4·P–T (cli + playground) ∥ P5·V,W (virtual code + LSP features) ∥ P1 polish.
- Phase D resolves E5; Phase B/E honor F1; Part 5 V needs H1/H2 from Part 1.

---

## 7. Runtime semantics — LOCKED by Part-2 Phases G–H (supersedes decode.md's literal `struct`)

decode.md's `struct` skeleton applies all three passes to every host node *uniformly*; taken
literally that **over-groups** — it double-wraps an author's `@p{}`, paragraph-wraps tight `<li>`
content, and re-sections a `<section>` on recursive descent — and **breaks the §2 golden**. The
implemented, tested semantics (`packages/runtime/src/struct.ts`, 41 tests green):

**The container gate.** For a host/fragment node, `struct` runs:
- `groupLists` — **always** (lists may nest in any container; idempotent — `ul`/`ol` carry no sentinels).
- `groupParas` — **only in a flow container** (`tag ∈ HOST_FLOW_TAGS` or `tag === FRAG`); idempotent
  (its `<p>` is a block tag → a re-run passes it through).
- `groupSections` — **only in a flow container that is not itself `<section>`** (a section's children
  were already fully nested by the parent's recursive `groupSections`; re-running would re-wrap its
  leading heading). `groupSections` is **totally recursive** — one call builds the entire section
  nesting; `struct` then descends to add paras/lists to leaf content without re-sectioning.

Tight nodes (inline host tags `em`/`strong`/`a`/`span`…, and `p`/`li`/`h1`–`h6`/`pre`) get **only**
`groupLists`.

**HOST_BLOCK_TAGS** (block-as-*sibling*: flushes a paragraph run, then passes through unwrapped):
`section article aside nav header footer main div h1–h6 ul ol li dl dt dd p blockquote pre figure
figcaption hr address table thead tbody tfoot tr td th caption form fieldset`.

**HOST_FLOW_TAGS** (flow-as-*container*: its children get implicit `<p>`/`<section>`):
`section article aside nav header footer main div blockquote figure td th` (+ `FRAG`).
**Asymmetry (load-bearing):** `p`, `li`, `h1`–`h6` are block *siblings* but **not** flow *containers* —
that is what makes author `@p{}` and tight `<li>` content not get re-paragraphed.

**Component children slots (keyed on `kind`):** a **block** component's static children decode as
flow (paras+sections+lists, e.g. `@Aside{…}`); an **inline** component's decode tight (`groupLists`
only — so the golden's `@Colorized{a}` keeps `"a"` bare). `groupLists` runs in both, so a `-`/`+`
list authored inside any component still coalesces. Boundary stop still holds (decode children, never
the body).

**Fragment transparency (corrected — supersedes the earlier "FRAG-as-sibling is inline").** As a
*container*, `FRAG` is a **flow** container (the document body is a `FRAG`, hence flow). As a
*sibling*, `FRAG` is **transparent**: `struct` splices a FRAG sibling's children into the parent's
sibling stream — recursively — *before* the grouping passes, so the children participate in the
parent's grouping. This is what makes `@for`'s per-iteration keyed `Fragment({key:_i}, …)` (E5)
dissolve at `▸=false`: the wrapped `nota-ul-li` sentinels become direct siblings and `groupLists` coalesces
them into one `<ul>`. The key (in FRAG props) is dropped during the splice — static HTML needs none;
at `▸=true` the Fragment still carries its key through `adapter.Fragment`. (A bare `@{…}` fragment of
inline content splices identically — same visual result; block content inside it now correctly joins
the parent's paragraph/section grouping.)

**⟹ Paragraph-break representation (CRITICAL — the Phase-C reader contract):** a paragraph break in
the child stream is a **whitespace-only text child containing a blank line** — regex
`/\n[^\S\n]*\n/` (newline, optional non-newline whitespace, newline). It splits paragraph runs and is
consumed. A **single `"\n"`** (or any whitespace with no blank line) is a **soft break that stays
inline** (joins the `<p>`, preserving the author's line breaks). **The Phase-C whitespace pass MUST
emit one `"\n"` text child per interior newline and MUST NOT pre-coalesce adjacent newlines** — so a
blank source line naturally surfaces as ≥2 adjacent newlines (= the break marker). This is exactly
notation.md §Whitespace ("interior newlines become individual `"\n"`"), now a hard producer/consumer
contract.

**`flatten` (h/Fragment child normalization):** arrays spliced **one level** (recursively, so a
`.map` returning arrays fully flattens); strings pass through verbatim (whitespace significant — the
reader already ran Scribble, the runtime must not trim/merge); numbers → `String(n)` (`0`→`"0"`,
`NaN`→`"NaN"` kept); `null`/`undefined`/`false`/**`true`** all dropped (JSX semantics; bare `true`
dropped so `@if` guards never leak `"true"`). Built nodes always materialize `props` (`p ?? {}`),
never null.

---

## 8. SSG / islands — LOCKED by Part-2 Phases I–K (supersedes decode.md's SSG-driver pseudocode)

- **Hydration-id placement** (resolves the §2.4 flag): each island's SSR output is wrapped in a
  marker element — `<nota-island data-hydration-id="N">…shell…</nota-island>` — and `bootIslands`
  selects on `[data-hydration-id]`. **Supersedes §2 stage-5's idealized `<span hydration-id="1">`:**
  React/Solid do not forward an unknown prop onto a component's *root* unless the component spreads
  it (the golden's `Colorized` doesn't), so the id must live on a runtime-owned wrapper, not the
  component root. Real stage-5 HTML: `…<li><nota-island data-hydration-id="1"><span
  style="color:red">a</span></nota-island></li>…` (also note React serializes `style` as
  `color:red`, no space; `onClick` is correctly absent from static HTML).
- **`render` does NOT re-decode.** decode.md's `html = serialize(struct(Doc()))` is **wrong** — the
  *emitted* `Doc` already wraps its body in `decode(...)` (§2 stage-3 note e), and at `▸=false`
  `decode = serialize∘struct`, so `Doc()` already returns decoded HTML and populates the manifest as
  a side effect. Re-applying `serialize(struct(...))` double-escapes (`<ul>`→`&lt;ul&gt;`) and
  re-runs `island`. **Correct driver:** `render(Doc) = { reset(); return { html: Doc(), manifest } }`
  (the agent's impl also tolerates a `Doc()` that returns a raw tree). ⟹ This reconfirms the Part-1
  requirement that the reader wraps **Doc's body and every component body in `decode(...)`** (so the
  same emitted code self-decodes at top level and is identity inside an island under `▸=true`).
- **`raw(slot)`** — a `Symbol`-branded marker for pre-rendered HTML that survives `flatten`; adapters
  switch to innerHTML (React `dangerouslySetInnerHTML`, Solid `innerHTML`). A raw slot passed to a
  *component* tag rides through as `children` and re-emerges as innerHTML on the host the component
  forwards `@children` to.
- **`Adapter` (as implemented):** `h(tag, props|null, children)→El`, `Fragment(children)→El`,
  `renderToString(el)→string` (**sync**, both frameworks), `hydrate(el, container)→void`. `children`
  is typed `unknown` internally (it carries a `VNode[]` from `h`'s `▸=true` path and a single
  `RawHtml` from `island`); the emitted-code surface (§1) is unchanged.
- **E4 validation:** `island` validates props are JSON-serializable *first* (before any side effect),
  recursively rejecting functions/symbols/bigint/`undefined`/circular refs with an error naming the
  component + the prop path (e.g. `data.items[0].fn`).

### Part-3 handoffs (the registry/boot helper consumes Part 2)
- `render(Doc) → { html, manifest }`; `Manifest = Record<id, { comp, props }>`;
  `bootIslands(manifest, registry, root?)`.
- `registry[comp]` MUST be `(props) => adapter.h(Component, props, …)` (or `createElement(Component,
  props)`) — **build the element, do NOT eagerly invoke** the component (so the framework calls it
  during render and hooks/signals run). F1's hoisted+exported names feed `manifest.comp`.
- **Slot rehydration is Part 3's job:** the static `@children` slot is pre-rendered into the DOM but
  is NOT carried in the manifest; the client registry entry must reconstruct/preserve it.
- **Solid SSR↔hydrate is cross-process:** the server build emits HTML + `_$HY` resume data; the
  client build resumes it. Part 3's Vite plugin must build Solid SSR and client as **separate Vite
  builds with the right export conditions** (`solid-js/web` resolves to `server.js` vs `web.js`).

---

## 9. Integrator + compiler-API findings — LOCKED (Wave 5: CLI + H1/H2)

**Compiler API** (the reader exposes three entries; `oxc/crates/oxc/src/nota.rs`):
- `compile(src) → {code, map}` — the **build** path (JS, `SourceType::default()`/mjs); the shim/CLI/vite
  use this. ⚠ **Known gap:** parses mjs, so it **rejects embedded TS** (`% const n: number`). Proper
  TS-in-`.nota` needs the build path on `tsx` **and** the downstream esbuild/vite to treat the emit as
  `tsx` (since codegen would then keep the types) — deferred to a later wave.
- `compile_with_mappings(src) → {code, map, mappings}` — build + H1 (parses tsx).
- `compile_virtual(src) → {code /*.tsx, types preserved*/, mappings}` — **H2 + H1; Part 5 (Volar)
  consumes this.** H2 finding: there is **no strip step** — `oxc_codegen` prints TS types (stripping
  lives in `oxc_transformer`, never invoked), so H2 is a **parse-mode choice** (`SourceType::tsx()`),
  not a separate codegen tail.
- **H1 `CodeMapping`** = Volar's `@volar/language-core` shape (`source_offsets[]`,
  `generated_offsets[]`, `lengths[]`, `data:{completion,format,navigation,semantic,structure,verification}`).
  Mechanism: reader marks (embedded-JS / component-identifier spans) × a codegen offset-log (at the
  existing `add_source_mapping` hooks; `Span::empty` boilerplate skipped → unmapped), reduced to
  innermost leaves, then **byte-exact-filtered** (every segment's source slice == generated slice).
  Caps: embedded JS → full; `@Aside` → navigation+hover; host tags + boilerplate → unmapped.
  **Part 5 V must shift `generated_offsets` by the runtime-import preamble length it prepends**
  (`source_offsets` unchanged — the reader omits the import, §1). The binary/shim must grow a
  `--virtual` mode to expose `compile_virtual` to the language server. **The `--virtual` JSON shape
  (binary ↔ shim ↔ language-server contract):**
  ```
  nota_compile --virtual <file>  →  stdout JSON:
  { "code": "<virtual .tsx>",
    "mappings": [ { "sourceOffsets":[u32], "generatedOffsets":[u32], "lengths":[u32],
                    "generatedLengths": [u32]|null,
                    "data": {"completion":bool,"format":bool,"navigation":bool,
                             "semantic":bool,"structure":bool,"verification":bool} } ] }
  ```
  The shim's `compileVirtual(source) → { code, mappings }` parses this. The language-server
  `LanguagePlugin` prepends a runtime+ambient typing preamble to `code` and shifts every
  `generatedOffsets` by the preamble length (`sourceOffsets` index the `.nota`, unchanged). A **wasm**
  backend (wasm-bindgen over the same three entries) serves the browser playground (Part 4) and can
  later replace the subprocess for the language server.

**Ambient prelude (LOCKED).** The emitted module references `useState` (and, once shipped,
`Math`/`CodeInline`/`CodeBlock`) as **free identifiers** — ambient, per §3.1 mechanism-not-policy. The
**integrator supplies them**; the CLI does so via **esbuild `inject`** of a prelude module (minimal
member: `useState` = the framework's; `Math` is a JS global; `CodeInline`/`CodeBlock`/`Math` components
are the documented extension point once a prelude ships).

**Slot rehydration (amends §8 — `bootIslands` alone is insufficient for slotted islands).** An island
whose component forwards a `@children` slot SSRs *with* that slot content; the runtime's `bootIslands`
passes only props, so a client re-render lacks the slot → **React hydration mismatch (#418)**. The M
helper therefore generates a **slot-aware boot** (`bootIslandsWithSlots`): per `[data-hydration-id]`
node, recover the slot from the SSR'd component-root's `innerHTML`, wrap `raw(slot)`, and
`adapter.hydrate(build(props, raw(slot)), node)`. **v1 heuristic** — assumes a single root forwarding
`@children`; general slots likely need the slot carried explicitly (Astro-style). The registry entry is
`registry[comp] = (props, slot) => adapter.h(Component, props, slot ?? [])` (builds, never invokes).

**Manifest delivery (F3, for the CLI):** the CLI embeds the manifest **in the boot bundle**
(self-contained, no fetch) **and** inlines a `<script type="application/json" id="nota-manifest">`
metadata view; the boot does not depend on the latter.

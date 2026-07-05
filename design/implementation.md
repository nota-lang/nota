# Nota Implementation Plan

This is the build plan for Nota. It assumes [notation.md](./notation.md) (surface syntax →
emitted JS) and [decode.md](./decode.md) (the runtime decode/SSG model) as the spec. Those two
files are written as `src → emitted JS` and `tree → HTML` pairs; treat them as the golden test
suite the implementation must reproduce.

## Component map

- **`oxc/`** — a fork of [oxc](https://oxc.rs). Hosts the Nota *reader*: the custom `@`-syntax
  parser, integrated into oxc's JS parser. Emits plain JS + sourcemap. Nota lowering happens here.
- **`@nota-lang/runtime`** — plain JS shipped to the frontend: `h` / `decode` / `Fragment` /
  `inlineComponent` / `blockComponent`, the framework injector, and the (server-split)
  `struct` / `serialize` / `island` SSG machinery. See decode.md.
- **`@nota-lang/{react,solid}`** — framework adapters: `{ h, Fragment, renderToString, hydrate }`.
- **`@nota-lang/compiler`** — the wasm/napi shim around the oxc fork (`.nota` string → JS string +
  sourcemap), plus JS-side glue. One codegen mode.
- **`@nota-lang/vite`** — Vite plugin: compile `.nota` → JS module (dev/HMR), then drive SSG
  prerender → HTML + island manifest + client bundles. Two phases, mdx-plugin-shaped.

## Conventions

- **All JS-side code is written in TypeScript**, tooled with **Depot** (the project's frontend
  convention; load the Depot skill when building these packages). This covers every `@nota-lang/*`
  package — runtime, adapters, compiler shim, vite plugin, cli, playground, language server — and
  their build/test/lint setup. "Emitted JS" throughout this doc refers to the compiler's *output*
  to the user's app, not our source. The lone exception is **`oxc/`**, which is Rust.
- Test runner for the TS packages is **`vitest`**; the Rust fork uses `cargo test`. Where a testing
  plan below says "(`vitest`)", the tests themselves are TypeScript.

---

# Part 1 — The oxc fork (the reader)

The reader is the longest pole; everything downstream consumes its JS output. This part fixes its
architecture. (Runtime, adapters, and the Vite plugin are later parts.)

## 1.1 The defining property

Nota is **markup-outer, JS-embedded, mutually recursive** — the inverse of JSX:

- JSX: JS is outer, `<…>` is an embedded *expression*.
- Nota: a `.nota` file is **markup at the top level**; JS is embedded inside it (`%` statements,
  `[props]` values, `@(expr)` interpolation, `@if`/`@for` heads); **and** markup re-embeds in that
  JS — `inlineComponent((c) => @span{…})` — because (per notation.md) an `@`-form *is* an
  expression.

Three capabilities are therefore required simultaneously:

1. a **document mode**: a whole file parses as markup (cf. Typst `parse()`, Scribble `#:inside? #t`);
2. markup parseable in **JS expression position** (cf. JSX's hook in the expression parser);
3. embedded JS parseable **from markup** (delegate to oxc's existing expression/statement parser).

**Why this forces a fork (not a Scribble-style separate front-end):** component bodies are
JS-containing-markup. You cannot locate the markup sub-spans inside a JS body without parsing the
JS, so oxc's *own* expression parser must recognize `@`. A separate reader layered on top can't do
this. Hence the fork — but it can be shallow (§1.4, D2).

## 1.2 Pipeline

```
.nota
 └─ oxc_parser fork additions:
      ├─ markup lexer scan-methods           (next_nota_child / next_nota_head alongside next_jsx_child)
      ├─ `@`-hook in the expression parser    (markup becomes valid in expr position)
      └─ a `nota` module                      (document mode + element grammar + sugar)
            ├─ markup → faithful Nota AST (Expression::NotaMarkup & friends), NOT lowered here
            └─ embedded JS spans → oxc_parser::parse_expr / parse_statement
                  (returns real oxc Expression/Statement nodes, spliced in — no re-parse, sourcemaps kept)
 └─ oxc_transformer::NotaLowering    Nota AST → hyperscript (h/Fragment/decode/inlineComponent/…)
 └─ oxc_codegen → JS + sourcemap
```

The grouping passes (paragraphs → `<p>`, list-item runs → `<ul>`/`<ol>`, headings → `<section>`)
are **not** in the reader. They are deferred to the runtime `decode` pass (decode.md). The reader
only emits the flat `h(…)`/sentinel calls that `decode` later restructures.

## 1.3 Lessons taken from each reference

- **oxc / JSX** — the *mechanism*: parser-driven lexer modes (model `next_markup_*` on
  `next_jsx_child`); `byte_search!` + `SafeByteMatchTable` for fast literal-text runs; parser
  checkpoints for the rare backtrack. JSX is the structural analog for "markup as an expression".
- **Typst** — *semantics live in the parser*: defer newline / column / indentation decisions to the
  parser (its `AtNewline` + column tracking), keeping the lexer dumb. Tokenize prose markers
  context-sensitively (`in_word()` for `*`/`_`; line-start + `space_or_end` for `#`/`-`/`+`). Lex
  raw spans (`|{}|`, code fences, `$…$`) wholly in the lexer.
- **Scribble** — the body **whitespace/indentation algorithm** (strip common indent, per-line
  trim, drop the newline right after `{` / before `}`). notation.md §Whitespace already specifies
  this verbatim, so it is a port, not a design task.

## 1.4 Locked decisions

**D1 — Parse into a faithful Nota AST, then lower in a separate pass. (REVISED — see below.)**
*Originally* the reader lowered at parse time (building `h`/`decode`/`Fragment` CallExpressions
directly, no intermediate tree), on the grounds that every Nota desugaring is local. That was
reversed during the build: the reader now parses `@`-markup into faithful Nota AST nodes
(`Expression::NotaMarkup` & friends in `oxc_ast`) and a separate `oxc_transformer` pass
(`NotaLowering`) lowers them to hyperscript — the exact shape oxc uses for JSX. The faithful tree
buys a testable stage boundary, the playground's `parseAst` ESTree view, and Volar's virtual emit,
and localizes the Scribble whitespace + `%`-routing + F1 logic in one lowering module instead of
inline in the parser. (The non-local paragraph/list/section grouping is still deferred to runtime
`decode`.) Reader architecture is documented in `oxc/NOTA_READER.md`.

**D2 — A dedicated Nota AST node set. (REVISED — supersedes "zero new oxc AST nodes".)** D1's
reversal implies a real `Expression::NotaMarkup` umbrella variant plus the Nota node set — so the
fork *does* touch oxc's generated AST / visitor / estree / builder machinery (regenerated via
`just ast`). This generated-code churn is paid once. The hand-written fork seam is still narrow —
lexer scan-methods, the expression-parser `@`-hook, the `parse_nota` module, and the
`oxc_transformer` lowering pass — and the emit surface (contract §1–§3) is unchanged from what the
parse-time-lowering spike produced.

**D3 — Parser-owned markup state.** Indent stack, at-line-start flag, and block context live in the
parser; the lexer exposes only narrow scan methods. Matches oxc's parser-drives-lexer idiom and
Typst's "semantics in the parser" lesson, and avoids threading a stateful mode field through oxc's
`Config`-generic lexer.

## 1.5 Build order

Each phase lands with its notation.md / decode.md examples as golden fixtures, green before the
next phase begins (per the project testing rule). notation.md's `src → output` pairs are the
fixtures directly.

- **A — Spike the plumbing.** `@`-hook → parse `@p{Hello}` → `h("p", {}, ["Hello"])`, round-tripped
  through oxc_codegen. Validates the riskiest unknown (the fork hook end-to-end) on one example
  before any breadth.
- **B — Element core.** host/component/dynamic tags; `[props]` (string→attr, expr→`{…}`, bare,
  spread, markup-valued); bodies; nesting; `@{}` fragment; `@name`/`@(expr)` interpolation. Embedded-JS
  delegation to oxc's expression parser begins here.
- **C — Document mode + whitespace.** file → `Doc`; Scribble whitespace → explicit `{"…"}` children;
  colon/block sugar; `%`/`%%%` statements + module hoisting + `await`→`async`.
- **D — Control flow.** `@if` / `else` / `@for` → ternary / `.map`.
- **E — Markup sugar.** `#` headings (re-lowered to the ambient `Heading` prelude slot — contract
  R18f/g; a raw `@h1{…}` stays a host tag); `-`/`+` → `nota-ul-li`/`nota-ol-li` sentinels; `*`/`_`
  word-boundary emphasis; the R20a doc-state sugars `<x>`/`&x`/`[^x]`/`[^x]:` → `h(Label|Ref|
  FootnoteMark|FootnoteText, …)` (boundary-guarded on `<`/`&`). Runtime `decode` does the grouping,
  so these stay local. The whole doc-state family + `secset`/`bibset` is now **ambient** — no
  `%import` (contract R20c).
- **F — Verbatim / code / math.** `|{}|`, fenced code, `$`/`$$` → `String.raw`.

Phase A de-risks the fork mechanism cheaply; B–F are mostly breadth over a proven mechanism.

## 1.6 Testing plan

Tests live in the fork (Rust, `cargo test` via the oxc `justfile`), next to `parse_nota`, since
all lowering happens there. The reader is a pure function `String → (JS string, sourcemap,
diagnostics)`, so it tests cleanly as snapshots + invariants. notation.md / decode.md `src → output`
pairs are the fixture corpus.

### Layers

1. **Golden / snapshot (primary).** One fixture = a `.nota` input + the expected emitted JS,
   organized per phase (A–F) and seeded directly from the doc examples. Snapshot style follows
   oxc's existing harness. Two emit modes, both exercised:
   - *expression mode* — elides the `Doc` wrapper and injected imports, matching notation.md's
     convention (`@p{Hello}` → `h("p", {}, ["Hello"])`); the bulk of fixtures.
   - *document mode* — full module including `export default function Doc()`, hoisted
     `import`/`export`, and `await`→`async`; a smaller set covering §C and the decode.md trace.

2. **Whitespace table.** The Scribble algorithm is the fiddliest part, so it gets dedicated
   cases written in notation.md's explicit-space notation (`·` = space, `⏎` = newline) — the
   §Whitespace examples plus boundary cases (newline after `{` / before `}`, common-indent
   stripping, interior `"\n"` children, body that is only newlines).

3. **Diagnostics.** Because D1 keeps no CST, error quality is tested deliberately: each error
   fixture asserts `(span, message)`. Cover scope errors (`@Unknown{}`), malformed/unterminated
   props and bodies, bad dynamic-tag heads, contextual-`else` misuse, `\%`/`\@` literal-vs-sigil
   boundaries, and unterminated verbatim/fence/math.

4. **Invariants (property-style, run across the whole corpus).**
   - *Validity*: every fixture's emitted JS re-parses under the **stock** oxc parser with zero
     errors — a cheap, global catch for codegen/lowering bugs.
   - *Span fidelity*: an embedded-JS span (`@(expr)`, prop value, `%` body) appears in the output
     byte-identical to the source slice — proves we splice oxc nodes rather than reformat them.

5. **Sourcemap smoke tests.** A handful of targeted assertions that a mapping over an embedded
   expression resolves back to its original source position (we preserve, not regenerate, those
   spans).

6. **Doc-sync guard.** A test that enumerates the fenced `src → output` examples in notation.md /
   decode.md and asserts each has a corresponding fixture, so the docs and the reader cannot drift.

### Gating

Per the project rule, each phase's fixtures (layers 1–3 for that phase) must be green before the
next phase starts; the layer-4 *validity* invariant runs over all fixtures on every change.

### Out of scope for Part 1 (forward reference)

Executing the emitted JS against `@nota-lang/runtime` + a stub adapter to assert the resulting
vnode tree / decoded HTML (the decode.md stages 4–5) is an **integration** concern spanning the
reader and runtime. It is specified with the runtime in a later part; Part 1 stops at "emits the
correct JS," verified syntactically by the layers above.

---

# Part 2 — The runtime + adapters

This part implements what [decode.md](./decode.md) §Algorithm specifies. decode.md is the
*semantics* (the `▸` flag, `h`/`Fragment`/`decode`, `struct`/`serialize`/`island`, the SSG driver,
the adapter interface); Part 2 does not re-derive it — it fixes the **module structure, the
runtime mechanism for `▸`, the injector lifecycle, and the island/hydration wiring**, and surfaces
the decisions decode.md left implicit. Covers `@nota-lang/runtime` and `@nota-lang/{react,solid}`.

## 2.1 Module layout

One flat package, one entry point. The reader emits `import { h, decode, Fragment,
inlineComponent, blockComponent } from "@nota-lang/runtime"`, and the SSG driver lives in the same
module.

```
@nota-lang/runtime  (single entry)
  h, Fragment, decode, inlineComponent, blockComponent, setAdapter   // the emitted-code surface
  struct, serialize, island, render                                  // the SSG machinery + driver
```

decode.md notes that the SSG machinery (`struct`/`serialize`/`island`) only runs when `▸ = false`,
which never happens on the client, so it is *dead* in the client bundle. We **do not** optimize
that away for now (no conditional `exports`, no server/client split): `decode` is one function
whose `▸ = false` branch is simply unreachable on the client, and we accept shipping that dead code.
Code-splitting it out is a later size optimization, not a structural concern — flagged, deferred.

## 2.2 The `▸` mechanism

`▸` is a single module-level flag with `withFlag(true, thunk)` save/restore, **not** a parameter
threaded through `h`/`decode`. This is sound because the only place `▸` is set to `true` —
`island()`'s call to `adapter.renderToString` — is **synchronous** (both React's and Solid's
SSR string renderers are sync), so the flag cannot be observed stale across an `await`. The default
is `false`; `Doc` may `await` freely at top level because nothing reads the flag there.

*Caveat (recorded, not yet needed):* if we ever adopt async/streaming SSR, a module-global flag
breaks across suspension points and we switch the server side to `AsyncLocalStorage`. The client
needs neither — there `▸` is effectively always `true` (every render enters through a component
wrapper), so client `decode` is unconditionally identity.

## 2.3 The injector & adapter contract

A single ambient adapter, set once before any `▸`-render:

```
setAdapter(a: Adapter)        // server: called by the SSG driver; client: by the app entry, pre-hydrate

Adapter = {
  h(tag, props, children) → El         // tag: string | ComponentFn
  Fragment(children)       → El
  renderToString(el)       → string     // SSR, synchronous
  hydrate(el, container)   → void        // client island boot
}
```

`@nota-lang/react` and `@nota-lang/solid` each export one `Adapter`. Lifecycle contract: `h`/
`Fragment` under `▸`, and `island`, dispatch through the ambient adapter; calling any of them with
no adapter set throws a clear "no adapter injected" error rather than a `undefined is not a
function`. One adapter per process (one framework per app), so a singleton is correct.

## 2.4 Islands & hydration wiring

> **SUPERSEDED by contract R15 (replay hydration) — implemented.** Everything below describes the
> original manifest-driven boot; it is retained as design history. As built: the manifest is
> **debug metadata only** (`{comp}`, no props; still gates `hasIslands`); there is **no client
> registry** and **no JSON-props constraint** (E4 retired — function/class props are legal); the
> client entry is `import Doc …; setAdapter(adapter); hydrateDocument(Doc);` — the runtime replays
> the document in capture mode, recovering each island's live component (closures over document
> state intact) + recomputed slot, and hydrates every `[data-hydration-id]` marker (determinism
> guard: the replayed island id set must equal the DOM's). See `contract.md` §0 R15 + §8.

`island(v)` (server) does three things: mint a `hydration-id`, render the component shell to HTML
with that id, and record a manifest entry. The client boots from that manifest.

```
manifest[id] = { comp: <name>, props: <JSON> }     // emitted alongside the HTML
bootIslands(manifest, registry)                     // client: for each id, find the DOM node,
                                                    //   adapter.hydrate(registry[comp](props), node)
```

- **`registry`** (component-name → client component fn) is built by the Vite plugin (Part 3), which
  knows which components are islands and code-splits them. Part 2 fixes only the manifest schema and
  the `bootIslands` contract; Part 3 wires the registry and emits the boot call.
- **Slots.** A boundary's static children were pre-serialized to HTML and are already in the DOM;
  `hydrate` attaches over the existing markup rather than re-rendering the slot.
- **Constraint — island props must be JSON-serializable.** They cross the server→client boundary
  via the manifest. Event handlers etc. are defined *inside* the component body (not passed in), so
  this is the standard islands constraint (cf. Astro); the runtime should *validate* and throw on a
  non-serializable island prop with a pointed message. *(Retired by R15 — props cross by replay.)*

## 2.5 Decisions to confirm (proposed, not yet locked)

- **E1 — `▸` as a sync module-global flag** (§2.2), AsyncLocalStorage deferred until/unless async
  SSR. *Recommend yes.*
- **E2 — single flat package, ship the dead SSG branch to the client** (§2.1). *Locked* (keep the
  structure simple for now; revisit code-splitting as a size optimization later).
- **E3 — the four-method `Adapter`** (§2.3) as the entire framework surface. *Recommend yes*;
  expand only if a framework needs more.
- **E4 — island props are JSON-serializable, validated at the boundary** (§2.4). *Recommend yes.*
  **(RETIRED by contract R15** — replay hydration crosses props by re-executing the document, so
  non-JSON props are legal and the validation was deleted.)
- **E5 — list keys (touches Part 1).** `@for`-generated children become a framework `.map(...)`,
  which React/Solid need *keyed* for correct client reconciliation; decode.md's trace omits them.
  Proposal: the **reader** lowers `@for (x of xs)` to `xs.map((x, i) => h(tag, { key: i, … }, …))`
  (amends Phase D), and the adapter treats `key` as the framework key. *Recommend reader-emits-key*;
  alternative is adapter-synthesizes-key from array position. This is the one decision that feeds
  back into Part 1 — worth settling before Phase D.

## 2.6 Build order

- **G — Static core.** `h`/`Fragment` (the `▸ = false` vnode builders) + child normalization
  (flatten, coerce text, drop nullish). Unit-testable with no framework.
- **H — `struct`.** The three grouping passes + boundary stop, per decode.md §struct. Pure
  vnode→vnode; the richest unit-test surface.
- **I — `serialize` + `island`.** HTML emission, hydration-id minting, manifest, static slots.
  Needs a stub adapter.
- **J — Injector + adapters.** `setAdapter`, then `@nota-lang/react` and `@nota-lang/solid`
  implementing the four methods; the `▸ = true` proxy paths in `h`/`Fragment`/component wrappers.
- **K — SSG driver + `bootIslands`.** `Doc module → HTML + manifest`; the client boot contract
  (registry wiring lands in Part 3).

## 2.7 Testing plan

Mirrors §1.6. Tests are TypeScript (`vitest`), per package.

1. **`struct` unit tests (primary).** Hand-built vnode trees → expected grouped trees: list-run
   coalescing (`nota-ul-li`/`nota-ol-li`, mixed kinds, nested via recursion), paragraph runs split by breaks,
   block vs. inline classification (incl. `inlineComponent` vs `blockComponent`), section ownership
   by heading rank (incl. nesting), and the **boundary stop** (components left intact, their static
   children decoded). decode.md stage-4→5 is the headline fixture.
2. **`serialize`/`island` tests.** With a **stub adapter** (records calls, returns sentinel HTML):
   correct HTML, monotonic hydration-ids, manifest entries, static-slot pre-rendering, and the
   non-serializable-prop throw.
3. **Adapter conformance suite.** One shared test matrix run against *both* `react` and `solid`
   adapters: `h`/`Fragment` shape, `renderToString` output, `hydrate` over server HTML. Guarantees
   the two frameworks are substitutable.
4. **Injector lifecycle.** `▸` save/restore correctness; "no adapter set" throws; one-adapter
   singleton.
5. **Integration (the forward reference from §1.6).** Compile a `.nota` fixture with the Part-1
   reader, execute the emitted JS against the runtime + a stub (and a real) adapter, assert the
   decoded HTML + manifest — closing the loop the reader's syntactic tests stop short of. The
   decode.md worked example is the end-to-end golden.

Gating as in Part 1: each phase (G–K) green before the next; the adapter-conformance and
integration suites run on every change once J/K land.

---

# Part 3 — The Vite plugin (`@nota-lang/vite`)

The plugin glues Parts 1 and 2 into a Vite build. It depends on `@nota-lang/compiler` (the reader
shim), `@nota-lang/runtime` (the SSG driver + `bootIslands`), and one adapter.

**Delta from the mdx plugin.** mdx's Vite/Rollup plugin is a single `transform` hook: `.mdx` →
JS + sourcemap, filtered by extension (see `references/mdx/packages/rollup/lib/index.js`). It does
no rendering — the app renders. Nota's decode model requires the plugin to *also* prerender pages
to HTML and extract/hydrate islands. So the plugin has three responsibilities where mdx has one.

## 3.1 Scope: mechanism, not policy

nota provides the *mechanism* to compile and statically render `.nota`, and delegates *policy* —
which files are pages, routing, when and where SSG runs — to the integrator (an app, a
meta-framework, or a user script). Concretely:

**nota provides**
- **`@nota-lang/vite`** — the transform plugin (the mdx-equivalent, the only actual Vite plugin):
  `.nota` → JS module + sourcemap + HMR, filtered by extension. This alone makes `.nota` importable.
- **a programmatic SSG API** (from `@nota-lang/runtime`, Part 2): `render(Doc) → { html, manifest }`,
  `hydrateDocument(Doc)` (the R15 replay-hydration client driver — supersedes `bootIslands`), and a
  helper that generates the wiring-only client entry (`generateClientEntry`).
- **adapter wiring** — `setAdapter` + the `@nota-lang/{react,solid}` adapters; a plugin option
  picks one per build.

**the integrator owns (explicitly out of scope for nota)**
- page discovery / routing / what counts as a "page";
- the prerender loop and where HTML is written;
- dev-server rendering policy — it calls `render` per request however it wishes;
- triggering the client island build.

nota may ship a *thin reference integration* (an example script wiring render → HTML → client
bundle) to demonstrate the pieces, but that is documentation, not the product.

## 3.2 How SSG works (the mechanism the integrator drives)

SSG + hydration is inherently two-sided, à la Astro; nota supplies both sides as callable pieces,
the integrator sequences them:

- **Server render** — the integrator loads a page's compiled JS (importing `@nota-lang/runtime` +
  the adapter) in a Node/SSR context, `setAdapter`s, calls `render(Doc)`, and receives
  `{ html, manifest }`.
- **Client bundle** — when the manifest is non-empty (`hasIslands`), nota's helper produces the
  wiring-only replay entry (`import Doc …; setAdapter(adapter); hydrateDocument(Doc);` — R15); the
  integrator hands it to the bundler. The browser replays the document (capture mode, HTML
  discarded) and `adapter.hydrate`s each captured island over its server-rendered DOM.

**R15 delta:** the *document module* now ships to the client whenever the page has any island (the
replay must re-execute it); an island-free page still ships **zero JS**. Per-island props no longer
cross as data — they are recomputed live by the replay.

## 3.3 The island registry (the crux) — and a feedback into Part 1

> **SUPERSEDED by contract R15 (replay hydration) — implemented; F1 REVERSED.** The client no
> longer resolves components by name at all: `hydrateDocument(Doc)` replays the document and
> recovers each island's **live binding** — so the reader was changed back to scoping
> `%let Colorized = inlineComponent(...)` *inside* `Doc` (ordinary lexical statement, no hoist, no
> export; the binding may close over document state). `%export let C = …` is the author's opt-in to
> module scope; the name 2nd-arg attach stays (it feeds the `{comp}` debug manifest — nested
> bindings get no attach and show `"anonymous"`). The registry helper became a wiring-only entry
> generator. **Authoring footgun (R8, worth docs):** a multi-line `%let C = inlineComponent(…)`
> binding must close with an explicit `;` after the final `})` — the `%` region is JS-grammar-greedy
> across single newlines, so a following `- @C{}` list line otherwise parses as a *subtraction*
> (`inlineComponent(…) - h(C, {}, [])`). See `contract.md` §0 R15 + §4 F1.

`bootIslands` needs `registry[name] → client component fn`. That requires each island component to
be an **independently importable module export** in the client build. But the reader, per
notation.md, scopes a `%let Colorized = inlineComponent(...)` *inside* `Doc` — a local binding, not
importable.

**F1 (cross-cutting — amends Part 1):** the reader must **hoist island-eligible component
definitions (`inlineComponent`/`blockComponent`) to module scope and export them under stable
generated names**, so server and client both import the same component, and the registry can
reference it by name. The manifest's `comp` field is that stable name. This is the islands analog
of E5: a Part-2/3 requirement that reaches back into Part-1 emit. *Proposal:* hoist+export all
component bindings unconditionally (simple, uniform); prune to only-those-actually-island later.

Given F1, registry generation is mechanical: the set of island names comes from the prerender's
manifests; the plugin emits a registry module importing each from its (now exported) source.

## 3.4 Decisions to confirm (proposed, not locked)

- **F1 — hoist+export component definitions to module scope** (§3.3). *Recommend yes*; settle before
  Part-1 Phase B/E, since it changes how the reader lowers `inlineComponent`/`blockComponent`.
  **(REVERSED by contract R15** — bindings are document-local again; only the name-attach remains.)
- **F2 — page discovery / routing / prerender loop: out of scope.** *Resolved* — delegated to the
  integrator (§3.1). nota exposes `render` and the island helpers; the integrator decides what a
  page is and when SSG runs.
- **F3 — manifest delivery is the integrator's choice.** `render` returns the manifest as **data**;
  whether it lands inline as `<script type="application/json">` or a sibling `.json` is policy. nota
  ships an inline-script convenience helper but mandates nothing.
- **F4 — framework selection granularity.** One adapter per build via the `framework` plugin option
  (§3.1). *Recommend yes* (one framework per app); revisit only if mixed frameworks are ever a goal.

## 3.5 Build order

- **L — Transform plugin.** The mdx-equivalent: `.nota` → JS via compiler, sourcemap, extension
  filter, HMR. A `.nota` file is importable and hot-reloads. (Depends on Part 1 shipping JS.) This is
  the whole of `@nota-lang/vite`.
- **M — Registry/boot helper.** The island-set → registry + boot-entry generator (consumes Part 2's
  `render` output). Validates F1 end-to-end.
- **N — Reference integration + islands e2e.** A thin example script wiring `render` → HTML →
  client island bundle, used to drive the browser hydration test: the decode.md `Colorized` example
  renders *and* hydrates. The integration is also the executable documentation of §3.1's delegation.

L is the cheap mdx-shaped win and the only shipped Vite surface; M is the island glue; N proves the
whole arc through a *sample* integrator without nota owning the page model.

## 3.6 Testing plan

Mirrors §1.6 / §2.7. Tests are TypeScript (`vitest`), plus a small number of real browser checks.

1. **Transform unit tests.** `.nota` id in → JS + sourcemap out; extension filtering;
   non-`.nota` passthrough. (Mirrors mdx's plugin test.)
2. **Registry generation.** From a manifest set, assert the generated registry/boot module imports
   the right exported component names (validates F1 end-to-end).
3. **Hydration (browser), via the reference integration.** A real `vitest`-browser / Playwright
   check driven through the §3.5-N sample integrator: load a rendered page, assert the island's
   server HTML is present *and* becomes interactive after boot (the `Colorized` click→color-change is
   the canonical e2e assertion). This is the only layer that exercises the full decode.md arc (SSG
   HTML → client hydration) for real, and it does so without nota owning routing or the page set.

(Prerender/`render` correctness itself is covered by Part-2 §2.7's integration suite — it is a
runtime concern, not the plugin's.)

Gating as before: L–N each green before the next; the hydration e2e (layer 3) is the acceptance
test for the whole project — the running form of decode.md's worked example.

---

# Part 4 — CLI & playground (the first integrators)

Per §3.1, nota delegates "what is a page / when does SSG run" to integrators. The CLI and the
playground are the first two — they *consume* the Part-3 API (`render`, the registry/boot helper,
adapters) rather than extend it. Building them also pins down the §3.5-N "reference integration" in
two real shapes: a Node one (CLI) and an in-browser one (playground).

## 4.1 `@nota-lang/cli`

`nota build doc.nota → doc.html`: one `.nota` file → one **self-contained** HTML file, every asset
inlined (no external requests). Its page policy is trivial: the input file is the page.

Pipeline (all Part-1/2/3 pieces, sequenced by the CLI):
```
doc.nota
  → @nota-lang/compiler        // → JS module string + sourcemap
  → load in Node SSR + setAdapter
  → render(Doc)                 // → { html, manifest }
  → if islands:  vite the client bundle (registry + boot + island components + adapter + runtime)
                 to a single string, inline as <script>; inline the manifest
  → emit one .html               // SSG body + inline <style> + inline <script>(s)
```

Properties to preserve:
- **Zero-JS for island-free docs.** No components ⇒ no manifest ⇒ no `<script>`: a pure static
  page. The client bundle exists *only* when there is an island to hydrate.
- **Single file, no code-splitting.** Everything inlines into one `.html` (consistent with the
  "ship too much for now" stance). Splitting is a later optimization.

## 4.2 `@nota-lang/playground`

A browser app that runs the **entire pipeline client-side** — the wasm compiler and the pure-JS runtime both run in the browser, no
server. Layout: a CM6 nota editor on the left, an output pane on the right with three views that map
exactly onto decode.md's stages:

| Pane | decode.md stage | Source |
| --- | --- | --- |
| **Generated JS** | stage 3 (emitted module) | `@nota-lang/compiler` (wasm) output |
| **Post-SSG** | stage 5 (HTML + island manifest) | `render(Doc)` run in-browser |
| **Rendered** | the hydrated result | the post-SSG HTML booted live in a sandboxed iframe |

So the playground is a live decode.md visualizer — it doubles as the teaching/debugging tool and as
an interactive end-to-end check of the whole arc.

**The "Rendered" pane without a bundler.** The compiled module is a single ESM string; rather than
bundle in-browser, load it via a `blob:` URL as an ES module inside the iframe, with an **import
map** mapping `@nota-lang/runtime` and the chosen adapter to CDN/blob URLs, then call `bootIslands`.
Native ESM + import map + blob URLs ⇒ no in-browser bundler. (This is where the CLI and playground
*diverge*: CLI bundles with esbuild for a portable single file; playground uses import maps for a
zero-bundler live preview. They share the conceptual assembly — HTML + boot + manifest — not the
mechanism.)

**CM6 nota support** is its own sub-effort (syntax highlighting at least). v1 can be a lightweight
CM6 `StreamLanguage` recognizing the sigils (`@`-forms, `%`, `*`/`_`, `#`, fences); a full Lezer
grammar is a later upgrade. The wasm compiler is *not* reused for highlighting (not incremental).

## 4.3 Decisions to confirm (proposed, not locked)

- **G1 — playground runs fully client-side** (wasm compiler + JS runtime + iframe hydrate), no
  server. *Recommend yes* (static deploy, simplest).
- **G2 — assembly mechanism split:** CLI = esbuild → single inlined file; playground = native ESM +
  import maps + blob URLs. *Recommend yes* — each fits its environment; the shared part is just the
  HTML/boot/manifest shape.
- **G3 — CM6 highlighting starts as a minimal `StreamLanguage`**, Lezer grammar deferred. *Recommend
  yes.*
- **G4 — CLI scope is single-file** (`nota build one.nota`); multi-page/globbing stays out (that's an
  integrator's job per §3.1). *Recommend yes.*

## 4.4 Build order

- **P — CLI, static docs.** compile → render → inline → one `.html`, for island-free input. The
  zero-JS path; smallest possible integrator.
- **Q — CLI, islands.** esbuild the client bundle, inline it + manifest; the output `.html` hydrates
  standalone (the `Colorized` example as a single file).
- **R — Playground panes (JS + SSG).** CM6 editor (plain text first) → run wasm compiler → show
  Generated-JS pane; run `render` → show Post-SSG pane. No live preview yet.
- **S — Playground live pane.** iframe + import-map/blob ESM + `bootIslands` → the Rendered pane
  hydrates.
- **T — CM6 nota highlighting.** The `StreamLanguage` mode (polish, not on the critical path).

## 4.5 Testing plan

Mirrors prior parts.

1. **CLI golden tests.** `.nota` → `.html`: assert self-containment (no external `src`/`href`),
   the zero-`<script>` property for island-free docs, and structural snapshots of the inlined output.
2. **CLI hydration e2e.** Headless-load the emitted single file; assert the island is server-present
   and interactive after boot (`Colorized` click→color-change) — the §3.6-3 acceptance test, now
   against a *file* rather than a dev server.
3. **Playground pane tests.** Given an editor value, assert the Generated-JS pane equals the
   compiler output and the Post-SSG pane equals `render`'s output (reuses Part-1/2 fixtures); a
   browser test asserts the Rendered iframe hydrates.
4. **CM6 smoke test.** The editor mounts, accepts input, and the `StreamLanguage` tokenizes the
   sigils without throwing.

Gating: P–T each green before the next; CLI hydration e2e (layer 2) and the playground Rendered-pane
test (layer 3) are the two acceptance checks — the same decode.md arc, exercised through a Node
integrator and a browser integrator respectively.

---

# Part 5 — IDE support (Volar)

A VSCode language server for `.nota`: syntax highlighting + full TS IDE feedback (diagnostics,
hover, completion, go-to-def, rename). Built on **Volar**, the embedded-language tooling framework
(Vue/Astro/MDX use it). We are unusually well-positioned because of two earlier choices:

- the compiler already emits JS with preserved embedded-JS spans (§1.6 invariant), which is most of
  what Volar's source↔generated mapping needs; and
- D1's lower-to-real-JS means `@Aside{…}` becomes a genuine `h(Aside, …)` reference — so the
  identifier-level IDE features (and notation.md's `@Unknown{}` *scope error*) come from **TS itself**
  over the generated code, not from bespoke analysis.

## 5.1 Architecture (the Volar virtual-code model)

```
foo.nota  ──compiler──▶  virtual foo.nota.tsx   (generated TS)  +  CodeMappings (source⇄generated)
                                   │
                          @volar/typescript runs the TS language service over the virtual file
                                   │
        diagnostics / hover / completion / definition / rename  ──mapped back through CodeMappings──▶  .nota positions
```

- **`LanguagePlugin`** — turns a `.nota` file into a `VirtualCode`: the generated-TS snapshot + a
  `CodeMapping[]` linking source offsets ↔ generated offsets with per-range capability flags.
- **TS service** — Volar drives the standard TS language service over the virtual `.tsx`; results
  map back to `.nota` ranges. This is where *all* semantic features come from.
- **Syntax highlighting** — a TextMate grammar (fast, server-independent) for the sigils, with
  embedded `source.ts` patterns inside `[props]`, `@(expr)`, and `%` blocks; richer semantic tokens
  layer on later via Volar. *(Shipped since: the reader also exposes a faithful highlight pass —
  `Parser::parse_nota_highlights` in `oxc_parser`, see §5.4 — which the playground editor consumes; the grammar remains
  VSCode's instant base layer.)*
- **VSCode extension** — a thin client: registers `.nota`, contributes the grammar, launches the
  Volar language server (`@volar/language-server`).

## 5.2 What falls out of D1 for free

Because markup lowers to real JS references and `%`/prop code is spliced verbatim, the TS service
delivers, with no nota-specific logic:

- **type errors** in `%` blocks and prop expressions;
- **scope / "unknown component" errors** — `@Unknown{}` is just `h(Unknown, …)`, and TS reports
  `Cannot find name 'Unknown'` (the IDE form of notation.md's scope error);
- **hover types, signature help, autocomplete** — including imported components;
- **go-to-definition / find-references / rename** across `.nota` ↔ `.ts`;
- **import resolution** for `% import {…} from "./x"`.

The runtime's `.d.ts` (so `h`/`decode`/`Fragment`/component wrappers type-check in the virtual file)
is the only typing prerequisite — it already ships types.

## 5.3 Compiler feedback (cross-cutting, like E5 / F1)

Two requirements Part 5 places back on the compiler:

- **H1 — structured `CodeMappings`, not just a flat sourcemap.** Volar wants per-range
  (sourceOffset, generatedOffset, length, capabilities) tuples. We already track embedded-JS spans
  exactly, so this is *exposing existing data* in Volar's shape: full capabilities for embedded-JS
  ranges; navigation/hover for component-identifier ranges; generated boilerplate (`h(`, `, {}, [`)
  left unmapped (generated-only).
- **H2 — a type-preserving virtual emit.** The build path strips TS types; the language server needs
  them kept. So the compiler exposes a "virtual" emit mode that preserves types (and emits `.tsx`)
  distinct from the type-stripping build emit. Same parse, two codegen tails.

## 5.4 Syntax highlighting

- **TextMate grammar** (`nota.tmLanguage.json`) — coarse, instant, works without the server:
  `@`-forms, `%`/`%%%`, `*`/`_`/`#`/`-`/`+`, fences, math, verbatim; with `include: source.ts`
  embedded scopes inside `[props]`, `@(expr)`, `%` so embedded JS highlights correctly. Best-effort
  by construction: TextMate cannot track Nota's context-sensitivity or markup⇄JS mutual nesting
  (a markup-valued prop or a stray `[` derails it to end-of-document), which is why the faithful
  layer below exists.
- **Reader highlight spans** (SHIPPED) — `Parser::parse_nota_highlights` (`oxc_parser`; a
  parser-stage view like the document parse behind `parseAst`, consumed directly by the wasm
  bindings — not part of `oxc::nota`'s compile seam): parse with the real reader, walk the Nota AST for structural
  spans, re-lex embedded-JS extents with the crate lexer; sorted `[start, end, kind)` spans that
  cannot drift from the language. The **playground editor** paints these via the wasm `highlight()`
  / `highlightKindNames()` entries (`packages/playground/src/nota-mode.ts`); regression fixture is
  `integration/mega.nota`. See `oxc/NOTA_READER.md` §Highlighting.
- **Semantic tokens** via Volar/TS — TS-classification tokens for embedded JS ride the H1 `semantic`
  capability today (`packages/language-server`); a *Nota-structural* semantic-tokens provider should
  serve the reader highlight spans above rather than reimplementing classification. A later
  refinement; not required for v1.

## 5.5 Packages

- **`@nota-lang/language-server`** — the Volar `LanguagePlugin` + server (`@volar/language-server`,
  `@volar/typescript`). Reusable by any editor with an LSP client.
- **`vscode-nota`** (the extension) — registers the language, ships the TextMate grammar, starts the
  server. Thin; the intelligence is in the language server.

## 5.6 Decisions to confirm (proposed, not locked)

- **H1 — emit Volar `CodeMappings`** from the compiler (§5.3). *Recommend yes*; it is the enabling
  dependency for everything semantic.
- **H2 — type-preserving virtual emit mode** (§5.3). *Recommend yes.*
- **H3 — cross-file `.ts → .nota` imports.** v1: full LSP features *within* `.nota` files; making a
  plain `.ts` file that imports a `.nota` type-check in the editor's own tsserver needs an additional
  **tsserver plugin** (as Vue/MDX ship). *Proposal:* defer the tsserver plugin; LSP-only for v1.
- **H4 — highlighting depth.** Ship the TextMate grammar for v1; semantic tokens later. *Recommend
  yes.* *(Update: the reader-side highlight pass shipped early — §5.4 — and powers the playground;
  the VSCode semantic-tokens provider serving those spans remains the deferred piece.)*

## 5.7 Build order

- **U — Grammar + extension shell.** `nota.tmLanguage.json` + a VSCode extension that registers
  `.nota` and highlights. No server yet — instant visible value, zero semantic risk.
- **V — Virtual code + diagnostics.** `LanguagePlugin` producing virtual `.tsx` + H1 mappings;
  wire `@volar/typescript`; surface TS **diagnostics** mapped to `.nota`. Proves the mapping spine.
- **W — Full language features.** hover, completion, definition, references, rename — all of which
  ride the V spine once mappings are correct.
- **X — Polish.** semantic tokens (H4 — serve `parse_nota_highlights` spans over LSP; the pass
  itself already exists, §5.4), and (stretch) the H3 tsserver plugin for cross-file imports.

U gives immediate editor value cheaply; V is the load-bearing step (mappings); W is breadth over V.

## 5.8 Testing plan

Mirrors prior parts; Volar provides test harnesses.

1. **Mapping fidelity (the core).** For fixture `.nota` files, assert that a cursor in an
   embedded-JS span maps to the correct generated offset and back (round-trip), using the H1
   mappings. Wrong mappings are the failure mode that breaks *every* downstream feature, so this is
   tested first and hardest.
2. **Diagnostics.** A `.nota` with a type error / undefined component asserts the diagnostic appears
   at the right `.nota` range — including `@Unknown{}` → "Cannot find name" (the §5.2 win).
3. **Language features at positions.** Hover shows the expected type; completion offers an imported
   component; go-to-def on `@Aside` lands on its binding; rename updates all sites. Position-based
   assertions over fixtures.
4. **Grammar snapshot tests.** `vscode-tmgrammar-test`: scope assertions on sigils and on embedded
   `source.ts` regions.

Gating: U–X each green before the next; mapping-fidelity (layer 1) gates everything semantic and is
the acceptance test for IDE support — if mappings are right, TS does the rest.

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
| R1 | Emit target | notation.md shows `<p>Hello</p>`; decode.md stage-3 + impl.md D1/D2/§1.6 show `h("p",{},["Hello"])` | **Emit hyperscript `h`/`Fragment`/`decode` CallExpressions, NOT JSX.** notation.md's `<tag>` is a *readability view* (decode.md "stage 2"). The reader parses to a faithful Nota AST and a separate `oxc_transformer` pass lowers it to `CallExpression`s (impl.md D1/D2 REVISED — parse-then-lower, not lower-at-parse-time). The runtime `h` MUST be a real function so it can branch on `▸`. |
| R2 | Import specifier | decode.md `from "nota"`; impl.md §2.1 `@nota-lang/runtime` | **`@nota-lang/runtime`.** |
| R3 | Component constructor | decode.md `component(...)`; impl.md §2.1 + decode.md §primitives `inlineComponent`/`blockComponent` | **`inlineComponent` / `blockComponent`** (each sets `.isComp=true`, `.kind="inline"|"block"`; `kind` drives `<p>` grouping). `component(...)` in decode.md's worked example is shorthand for one of these. |
| R4 | `%let` component placement | decode.md nests `Colorized` inside `Doc`; impl.md F1 says hoist+export | **F1 wins: component definitions hoist to module scope and are exported** under stable names (§4 F1). Other top-of-file `%` statements prepend into `Doc`; `import`/`export` hoist to module scope (notation.md). |
| R5 | Top-of-file `%` → IIFE? | decode.md stage-3 wraps Doc body in an IIFE; notation.md says top-of-file `%` *prepends to Doc* (IIFE is only for `%` nested in an element body) | **Top-of-file `%` prepends into `Doc`'s body, no IIFE.** IIFE wrapping applies only to `%` nested inside an element body (notation.md §Statements). |
| R6 | `@for` keys | notation.md/decode.md omit keys; impl.md E5 adds them | **E5: reader emits keys** (§4 E5). The non-keyed forms are pinned below; the *exact key-attachment signature* is **deferred to the Phase-D sync** — do not implement `@for` keys before then. |
| R7 | `@` vs decorators | new (Phase-A finding) | **Inside a `.nota` file, `@` is unconditionally Nota markup — JS/TS decorators are unavailable (v1).** Resolved by a parser-owned `nota_markup` bool (oxc's `Context` u8 is bit-saturated). Sound: decorators only appear in class/statement position, never in a Nota expression context. |
| R8 | `%` statement extent | notation.md said "indented continuation lines (the `@head:` block rule)"; the implementation — and the canonical golden's *unindented* `})` — is JS-grammar-greedy | **JS rules within hard delimiters.** A `%` line opens a JS statement region: the rest of the line is JS — arbitrary statements, JS's own `;`/ASI, continuation across single newlines exactly where JS grammar allows (no indentation rule). The region hands back to markup at end-of-line once the last statement completes there, at a **blank line** (ASI as at end of input; a statement straddling one is a diagnostic), or at the next line-leading `%`. The blank-line bound is a line-level scan, so blank-line-bearing code (including inside template literals) belongs in `%%%`. |
| R9 | Line-start sugar at a body start | new — line-start constructs (`#`/`-`/`+`/`N.`/`%`) fired only after a `\n` or at document start, so `@{- item}` kept the marker literal | **The start of a markup body counts as a line start** (Typst's content-block rule): a braced body, colon body, or bounded sub-range opening directly with a marker opens the construct, with its first-line extent clipped at the body's own closer (a depth-0 `}`, string/`@`-form-aware; or the bounded end). Literal braces in prose do not open a body — `a {- b} c` stays text. |
| R10 | Plain function tags | new — an unmarked function tag fell into `serialize`'s host path and stringified into the HTML as a tag name | **A plain function used as a tag is a static template**: `struct` expands it eagerly — invokes it with `{ children, …props }` and splices the (normalized) result into the sibling stream *before* grouping, so a template's list sentinels coalesce with its siblings'. Expansion chains (a template may return a template-tagged node; a cycle is a pointed error). The marked `inlineComponent`/`blockComponent` constructors buy what only a boundary can have — deferral, `kind`-driven grouping, hydration islands — and are *not* expanded. Under `▸ = true` the framework adapter invokes plain function tags natively. |
| R11 | Inline span line clamp | new — inline spans scanned across newlines (emphasis to the next blank line, `` `…` ``/`$…$` to the next close anywhere), so a stray sigil swallowed following lines: ``- `foo⏎- bar`` parsed as one bullet holding a code span | **An inline span never crosses a newline** (CommonMark-style): `*…*`, `_…_`, `` `…` ``, and inline `$…$` must close on their opening line, else the opener is literal text. The clamp is strict — a skipped sub-region (raw span, `@`-form bracket group) that crosses the line end kills the span too. Block-shaped raw bodies keep their own multi-line extents: `$$…$$`, fenced ``` code, `\|{…}\|` verbatim. |
| R12 | Colon sugar is positional | new — the glued `:` triggered an element anywhere a head could take one, so mid-prose `x @Bar: y` became an element and `*@a: bar* rest` double-collected the tail (once in the colon body, once in the emphasis) | **`@head:` sugars only positionally (R9-consistent):** the `:` is an element trigger iff **(1)** the form is a markup-body child (the top region is markup — never an embedded-JS island (`%` line, `[props]` value) nor a `|@`-armed form in a raw span (code / math / verbatim)), **and** **(2)** the `@` sits at a line start *modulo leading whitespace*, where a markup body's own start counts as a line start (braced/fragment body, document, or a bounded range such as emphasis / heading / list-item / colon body). Where either fails the head interpolates and `: …` is literal text (`x @a: y` → `"x "`, `a`, `": y"`); the classification also governs the hyphenated-head extension, so a dead colon never pulls `-foo` into the head (`t @my-foo:` → `@my` + `-foo:`). A colon body opened inside a **bounded** frame clips its own extent (and resume) at that frame's end, so `*@a: bar* rest` is `*@a{bar}*` + the sibling `" rest"`. |
| R13 | Unified raw-span content model | new (Wave 3, **pinned 2026-07-04**) — math had direct `@name`/`@(expr)` interpolation lowered to `${…}` substitutions and a `display` bool; code and verbatim differed in shape | **All raw spans — verbatim `\|{…}\|`, inline/block code, inline/fence math — share ONE content model: raw text runs interleaved with `\|@`-armed `@`-forms.** Extents are **pure pre-scans** (`lex_code_span` / `lex_math_span` / `verbatim_boundary`); a second bounded scan (`armed_boundary`) arms each `\|@` via `parse_nota_form_in(Raw)` (its tail parks). A **bare `@` is literal** — direct `@name`/`@(expr)` interpolation is **removed**; only `\|@` re-enters Nota, spliced as a *sibling* (not a `${…}` substitution). **Dollar spans mirror backtick spans**: an opening run of N dollars closes at the next same-line run of ≥N dollars (shorter runs are content), so `$$…$$` inside a paragraph is inline **run-2** math, and **display math is the fence** (≥2 dollars, whitespace-only opener tail, standalone `$$` lines). The lone divergence is the **TeX escape** — the dollar close scan skips `\<c>` pairs, so `\$` stays content (LaTeX's own escape); backtick scans stay escape-blind. AST: `NotaCode` / `NotaMath` carry `parts: Vec<NotaVerbatimPart>` (`NotaMath.display` renamed → `block`, mirroring `NotaCode.block`); the runtime `display` prop is unchanged (the component is renamed `Math` → `Tex` by R14). There is no escape for a literal `\|@`; a `\|@`-armed form whose parse overruns the fixed extent is a fatal diagnostic (`nota_armed_form_overruns_span`). |
| R15 | Island depth + captured scope | new (Wave 6, **pinned 2026-07-04**) — an island was a *named, top-level, exported* `inlineComponent`/`blockComponent` (F1) carrying **JSON** props (E4): a nested `%let C = inlineComponent(…)` never hoisted (so `nameOf` threw at SSG) and a body closing over document-local state (`() => x` under `@for`) had no client activation to re-enter. The target program `@for (x of xs) { %let E = inlineComponent(() => x); - @E{} }` was impossible on both counts. | **Replay hydration.** An island may be defined at **any depth** and close over **arbitrary document state**; its props may hold **non-JSON values** (functions, class instances). **(a) The client entry replays the document:** it re-executes `render(Doc)` (same `reset()`, same `struct`/`serialize` traversal) with `island()` in a *capture* mode that **records the live boundary at every depth** — the `CompFn` with its closure intact, the live props, and the recomputed slot HTML; the produced HTML string is discarded (a depth-0 boundary skips its SSR; a nested-in-slot boundary still SSRs for parent-slot byte-parity). Hydration ids match the server **by construction** (identical `freshId`-before-slot traversal in both modes). `hydrateDocument(Doc, {root?})` then hydrates **every** captured island into its `[data-hydration-id]` node — every marker, nested ones included, in ascending id order (outer before inner — the old boot's every-manifest-id behavior; per-island `try`/`catch` leniency; returns a teardown array). **(b) This supersedes the manifest-as-transport model (§8):** props no longer cross server→client as JSON, so **E4 is retired** (function/class props are legal) and the manifest is demoted to debug metadata (`Record<id, {comp}>` — props dropped; still populated at SSG, still gates `hasIslands`, still surfaced as the `#nota-manifest` script). The static `@children` **slot is recomputed by the replay, not scraped** from `innerHTML` (retires the §9 single-root heuristic). **(c) Determinism guard:** before hydrating anything, the captured id set must equal the document's `[data-hydration-id]` set — a mismatch is a pointed "did not replay deterministically" error (the replay is sound only if the document `%` code is isomorphic across runs and its island sequence is order-stable). **(d) F1 is revised (§4):** the reader no longer auto-hoists/exports component bindings — a `%let/%const C = inlineComponent(…)` is an ordinary lexical statement (uniform JS scoping); `%export let C = …` is the author's opt-in to module scope. The name-attach (constructor 2nd arg) stays, now applied to top-level `%let/%const` **and** `%export`-wrapped decls; the semantically-dead component-body `decode(...)` wrap is dropped. **(e) Limitations (v1):** prelude registry slots (KaTeX/shiki) re-execute client-side on an islanded document (the replay recomputes slot bytes, so the client build must mirror the server's setup-bake — `bakeConfigBaseline()` after the setup import); a nested island inside a *parent's slot* (`slotDepth > 0`) is SSR'd into that slot for byte-parity **and** captured/hydrated on its own marker, so Solid — whose client build forbids `renderToString` — makes nested-in-slot islands a pointed error. **The migration is staged** (per `design/implementation.md` R15 phases): the runtime ships capture + `hydrateDocument` first (old `bootIslands` path intact), integrators switch next, and the reader (F1 drop + emit hygiene) lands last — so the §2 golden below is the R15 *target* emit; the current reader still emits the pre-R15 form until that phase. |
| R14 | Injectable math/code components | new (Wave 4, **pinned 2026-07-04**) — the ambient math identifier was `Math`, which the integrator's inject mechanism cannot supply without capturing the JS `Math` global (esbuild `inject` rewrites *free* references, so `% Math.floor(x)` in embedded JS would resolve to the component; a lexical `%import { Math }` override deterministically shadows the global for the whole module) | **(a) The ambient math component is `Tex`** — reader emits `h(Tex, {display?}, parts)`; `Math` is never an ambient prelude name. **(b) The ambient identifiers bind to registry slots, not concrete components** (MDX-provider analogue): the standard prelude (`@nota-lang/prelude`) exports `Tex`/`CodeInline`/`CodeBlock` as `slot(name, Default)` — a *plain* function `(props) => h(lookup(name) ?? Default, props, children)`. R10 expands the slot eagerly at decode-time; a registered plain function expands further (fully static), a registered `inlineComponent`/`blockComponent` is a boundary → SSR + island. `registerComponents({Tex: …})` (runtime; registry is a bare Map, no deps) is **global-persistent** — site policy, NOT reset per `render`. Per-document lexical override via `%import` still works (module scope shadows the ambient binding). **(c) Defaults:** `Tex` = KaTeX→MathML (`renderToString(tex, {output:"mathml", displayMode:display})` → `raw(...)`; a *vnode* armed part inside math is a fatal diagnostic — KaTeX cannot host HTML; scalar armed parts stringify-splice into the TeX source). `CodeInline`/`CodeBlock` = sync shiki core (JS regex engine, eagerly-loaded curated grammars): the parts are reassembled into ONE contiguous text (raw runs + armed elements' text-content + stringified scalars), tokenized whole, and each armed element becomes a shiki **decoration** over its range (`tagName`+`properties` from the element; nested markup inside an armed element flattens to its text; a text-less armed part → plain fallback for the span + build warning). **(d) `lstset({lang, theme, …})`** (listings homage; prelude export, hence ambient): document-global, **last-write-wins** — R10 expansion happens inside `decode`, after the whole `Doc` body evaluated, so mid-document calls are NOT positional — and **reset per `render()`** (unlike registration) so multi-doc builds don't leak config. **(e)** The static path needs `RawHtml` as an opaque leaf: `struct` passes it through, `serialize` emits it verbatim. A raw leaf declares its own blockness — `raw(html, {block: true})` acts as a block *sibling* in paragraph grouping (flushes the run, never `<p>`-wrapped; shiki's `<pre>` root and display MathML use it), default inline (KaTeX inline output joins the run). |
| R16 | `groupLists` whitespace bridging | new — `groupLists` required list sentinels to be *strictly adjacent*, so a whitespace-only text sibling between two `nota-ul-li`/`nota-ol-li` split them into two lists. The reader already absorbs textual between-item blank lines into item extents (so `- a`␤␤`- b` arrives as adjacent sentinels), but a stream assembled via control flow (E5 `@for`), templates (R10), fragments, or hand-written `h` interleaves a stray `"\n"` between sentinels that survives fragment splicing and split the list. | **A list run breaks only on non-whitespace content or a different sentinel kind.** While `groupLists` accumulates a same-kind sentinel run, a maximal group of whitespace-only text siblings that is *immediately followed by another sentinel of the same kind* is **consumed** (emitted nowhere) and the run continues; anything else ends the run and that trailing whitespace is **not** consumed (left for `groupParas`/`consumeParaBreaks`). Edge whitespace (before the first sentinel, or after a run that a non-sentinel/different-kind sentinel/EOF ends) is untouched, so the paragraph-break markers fencing a list off from prose survive. Blank lines between items therefore do **not** split the list — the runtime extends the reader's textual between-item semantics to *any* assembled stream. Consumer-side only (`packages/runtime/src/struct.ts`); no reader/oxc change. |
| R17 | Dynamic-tag emit | notation.md's old §Dynamic tag showed a `_Tag`-bound IIFE (`(() => { const _Tag = expr; return h(_Tag, …); })()`) for any `@(expr)` head not already "JSX-valid" (a capitalized identifier or static member chain) | **No IIFE, no binding — `@(expr){…}` always lowers directly to `h(expr, { props }, [children])`.** The binding existed only to satisfy JSX's tag-position grammar (identifier/member-expression only, the constraint a real `<_Tag>` would need); R1 already pins the emit target to hyperscript `h(...)` calls — plain function calls, with no such restriction — so `expr` sits directly in argument position regardless of shape. The "already a valid tag" special-case (`is_valid_tag_expr`) is retired along with it: a capitalized identifier (`@(Box)`), a static member chain (`@(ui.Card)`), a computed member (`@(comps[k])`), and an arbitrary expression (`@(getTag())`) all emit identically. Volar mapping is simplified to match: the head expression is marked `EmbeddedJs` uniformly, not split against `ComponentIdentifier` by expression shape — `EmbeddedJs`'s capability set is a strict superset of `ComponentIdentifier`'s (full ⊇ navigation+hover), so this is capability-monotonic, not a regression. |
| R18 | Doc-state: marks & queries | new (**pinned 2026-07-05**) — the two-pass constructs (table of contents, heading numbers/counters generally, `@ref`, footnotes, citations/bibliography) had no mechanism: a TOC/forward `@ref` needs *whole-document* knowledge before its own position serializes; execution-order counters get the order wrong once fragments are stored/reordered (the same argument that made `lstset` non-positional, R14d); and the state must live in the **runtime**, not the reader — it depends on JS execution (a footnote emitted from `@for`). | **One evaluation + tree passes (Scribble collect/resolve), NOT two evaluations.** `Doc()` already produces the *complete* vnode tree before any decoding, so forward reference is a scoping problem, not a temporal one. **(a) Two `Symbol`-branded opaque leaves** (RawHtml-style): **`mark(kind, data)`** — registers an index entry at its tree position, removed by `force`; **`query(fn)`** — `fn: (doc: DocIndex) => children`, forced against the built index (output normalized like any `h` child). Both survive `flatten`, pass through `struct` untouched, and are runtime exports the **reader never emits** (prelude/user surface). **(b) The decode pipeline** at `▸=false` becomes `serialize ∘ struct ∘ force ∘ index ∘ normalize`: `normalize` = R10 template expansion + transparent-fragment splicing hoisted to a whole-tree pre-pass (observationally safe — both are context-free; `struct`'s own interleaved expansion stays, now vacuous), so the index sees marks produced *by templates*; `index` = one DFS collecting mark leaves into `DocIndex` — `all(kind) → IndexedMark[]` (document order), `get(mark) → IndexedMark` (identity lookup — the mark object is the handle), `IndexedMark = {kind, data, seq /*per-kind, 1-based*/, pos /*global DFS order, total across kinds*/}` — descending boundary *children* (static tree) but never bodies, and walking a vnode-valued `data.content` (so marks inside footnote content index at the parent mark's `pos`); `force` = remove mark leaves and splice `normalize(fn(doc))` in place of each query leaf, recursively (query output may hold further queries — forced against the same frozen index, so it terminates). Force runs **before grouping** — load-bearing: forced output (a Toc's `nota-ul-li` sentinels) participates in list/para/section grouping like authored content, and grouping/R16 never see a doc-state leaf. `render`'s raw-tree fallback runs the same pipeline; `serialize` on a leftover leaf is a pointed error (mirror of the R10 function-tag guard). **(c) Two hard rules:** query output may **not introduce new marks** — pointed error, no fixpoint iteration (a bibliography's "References" heading is *authored* above `@Bibliography`, not generated; Typst-style iterate-to-convergence is the v2 escape hatch if ever needed); and `mark`/`query` **throw at `▸=true`** — doc-state is a static-document construct; islands own any secondary state (dynamic footnote registration is explicitly out of scope). Marks/queries in an island's static *children* are fine (in the tree, resolved before the slot serializes); in an island's *body* they are the thing rejected. R15 replay is unaffected — the client re-runs the same passes over the same deterministic tree (the existing R15c invariant); a query may *return* an island (an interactive Toc), which captures/hydrates normally. **(d) Trailer registry** (the auto-append seam): `registerTrailer(name, thunk)` — bare-Map, name-keyed (re-register replaces), **global-persistent** like `registerComponents` (R14b, site policy — NOT reset per render). `decode` appends each trailer's children after the document content (wrapping its input in a transparent fragment) *before* `index`, so trailer queries force normally. The prelude registers `"footnotes"`: render the footnote list at document end **iff** footnote marks exist and no explicit `@Footnotes` placement mark does (`@Footnotes` emits its own placement mark) — explicit placement overrides. **(e) Policy is prelude, not core** (R14 pattern): heading numbering, `@Toc`, `@label`/`@ref` (a label binds to the nearest **preceding** heading mark by `pos` — LaTeX semantics), `@footnote`/`@Footnotes`, `@cite`/`@Bibliography` (a cite's *label* may depend on the global cite set — numeric-by-alphabetical styles are index-computable), and a `counter(kind, {resetOn})` helper (hierarchical numbers from `all()`+`pos`, memoized on the index) all live in `@nota-lang/prelude` as slots/templates over `mark`/`query` only; doc config (`secset({numberDepth,…})`, `bibset({src, style})`) follows `lstset` exactly (R14d — doc-global, last-write-wins, reset via `onRenderReset`). **(f) Heading sugar re-lowers to an ambient slot** (the R13/R14 move): `# Title` → `h(Heading, {rank: 1}, ["Title"])`; the default `Heading` emits `mark("heading", …)` plus a query producing the concrete `hN` — normalize precedes grouping, so `groupSections` still sees a real `hN` (forced first). `id` = authored `id` prop ?? slugified text-content (deduped); Toc link content flattens heading children to text (the R14c flattening precedent). A raw `@h2{…}` stays a plain host tag — the principled unnumbered/un-Toc'd escape hatch (`\section*`). Amends the §3 heading rows. **(g) Staged** (R15 precedent): (1) runtime — the leaves + `DocIndex` + normalize/index/force + trailer registry (new `packages/runtime/src/doc.ts`; pipeline wired in `h.ts` `decode` + `render`'s fallback; a mark-free document decodes byte-identically); (2) prelude — the (e)/(f) constructs + config; (3) reader — heading re-lowering + golden churn. The §3 heading rows are the R18 *target*; the reader emits `h("h1", …)` until phase 3. |
| R19 | Verbatim composes with `[props]` | new (**pinned 2026-07-05**) — `@head[props]|{…}|` silently mis-parsed: `parse_element`'s post-`]` continuation peek recognized only `{` (braced body) and `[` (another prop group), so `|{` fell into the self-closing catch-all and the verbatim body leaked out as sibling markup text; `NotaVerbatim` itself had no `props` field to carry them even once parsed correctly. | **`[props]` groups compose with a verbatim body exactly as they do with a braced body**: `@head[props]*|{…}|` accumulates props ahead of the same `|{…}|` delimiter that would otherwise sit directly against the head (the bare `@head|{…}|` form is unchanged). `NotaVerbatim` carries `props: Vec<NotaProp>` alongside `tag`/`parts` (mirrors `NotaElement`); lowering threads it through the existing `lower_props` before building the tagged `h(...)` call, so `@CodeBlock[lang: "python"]|{f(x)}|` → `h(CodeBlock, { lang: "python" }, [String.raw`f(x)`])`. A `|` after `]` **not** immediately followed by `{` is still not a trigger — self-closing / literal text, unchanged. |

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

mark(kind, data) / query(fn)                       // doc-state leaves (R18); fn: (doc: DocIndex) => children
    // ▸=false → opaque leaves resolved by decode's index/force passes; ▸=true → pointed error
    // (doc-state is static-document-only; islands own secondary state). Reader never emits these.
registerTrailer(name, thunk)                       // doc-end auto-append seam (R18d); global-persistent
```

`flatten(children)`: children args are flattened one level (arrays spliced in), text coerced, nullish
dropped. Note both call shapes occur: `h("nota-ul-li", {}, [child])` (one array arg) and `h(C, {}, x)` (one
scalar arg) — `flatten` normalizes both to a child list. See decode.md §"Context-sensitive primitives".

### vnode data model (Part 2 internal; Part 1 only emits the calls above)

```
v ::= string                       // text leaf
    | { tag, props, children }      // tag: host string (decode owns) | CompFn (boundary, framework owns)
    | RawHtml                       // opaque pre-serialized leaf (R14e); struct passes, serialize emits verbatim
    | MarkLeaf | QueryLeaf          // doc-state leaves (R18); gone from the tree by grouping time (force
                                    // removes marks, splices query output) — serialize on a leftover is a
                                    // pointed error
FRAG = the fragment tag sentinel (e.g. a unique symbol or "fragment")
```

---

## 2. THE canonical golden (end-to-end, reconciled) — the shared integration fixture

This is decode.md's worked example, reconciled with R1–R5 (hyperscript, `@nota-lang/runtime`,
`inlineComponent`, no IIFE) **and revised by R15** (component binding is document-local — no
hoist/export; no body `decode(...)` wrap; manifest `{comp}` only). **Every stream tests against
this.** Shown *without* `@for` keys (R6 defers key mechanism); the integration test uses this keyless
form until Phase D. **Staging note:** the stage-3 emit below is the R15 *target*; the current reader
still emits the pre-R15 form (hoisted+exported binding, body `decode(...)` wrap — see
`packages/react/tests/fixtures/golden.compiled.ts`) until the R15 reader phase migrates it.

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

export default function Doc() {
  let Colorized = inlineComponent((children) => {
    let [color, setColor] = useState("red");
    return h("span", { onClick: () => setColor("green"), style: { color } }, [children]);
  }, "Colorized");   // ← name 2nd arg stays → manifest `comp` + hydration (see §1, §4 F1); no export

  return decode(Fragment(
    ["a", "b"].map((x, _i) =>
      Fragment({ key: _i }, h("nota-ul-li", {}, [
        h(Colorized, {}, [x])
      ]))
    )
  ));
}
```
Notes (R15): (a) `Colorized` is a **document-local** lexical binding inside `Doc` — **not** hoisted or
`export`ed (revises R4/F1: uniform JS scoping; `%export` is the opt-in to module scope); (b) the
component body is **not** wrapped in `decode(...)` — the wrap was dead (bodies run only at `▸ = true`
where `decode` is the identity); (c) `@children` → the bound `children` param; (d) `-` list marker →
`"nota-ul-li"` sentinel (runtime `struct` later coalesces to `<ul><li>`); (e) **Doc's** body keeps its
`decode(...)` wrap — it is what self-decodes the document at `▸ = false`. The name 2nd arg is retained
(the returned `CompFn` cannot recover its authored name; §1, §4 F1).

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
manifest = { "1": { "comp": "Colorized" },
             "2": { "comp": "Colorized" } }
```
Under R15 the manifest is **debug metadata only** — `props` are dropped (they may now be non-JSON;
per-instance data crosses server→client by the client's *replay*, not the manifest). Still populated
at SSG, still gates `hasIslands`, still surfaced as the `#nota-manifest` script.

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
| `@(getTag()){hi}` | `h(getTag(), {}, ["hi"])` (R17: no `_Tag` binding — any expression shape) |
| `@(Box){hi}` | `h(Box, {}, ["hi"])` |
| `@(ui.Card){hi}` | `h(ui.Card, {}, ["hi"])` (static or computed member — same emit either way, R17) |
| `@a[href:"/x"]{go}` | `h("a", { href: "/x" }, ["go"])` |
| `@a[href:url]{go}` | `h("a", { href: url }, ["go"])` |
| `@input[disabled, ...rest]{}` | `h("input", { disabled, ...rest }, [])` (empty body → no children) |
| `@fig[cap:@em{hi}]{x}` | `h("fig", { cap: h("em", {}, ["hi"]) }, ["x"])` (markup-valued prop) |
| `@name` | `name` (bare-identifier interpolation) |
| `@(user.posts[0])` | `user.posts[0]` |
| `*bold*` | `h("strong", {}, ["bold"])` |
| `_italic_` | `h("em", {}, ["italic"])` |
| `# Title` | `h(Heading, { rank: 1 }, ["Title"])` (R18 target — heading sugar → ambient `Heading` slot; see note below) |
| `### Sub *bit*` | `h(Heading, { rank: 3 }, ["Sub ", h("strong", {}, ["bit"])])` |
| `@h1{Title}` | `h("h1", {}, ["Title"])` (raw host tag: sections normally, but unnumbered/un-Toc'd — R18f) |
| `- a` (list item line) | `h("nota-ul-li", {}, ["a"])` (runtime `struct` groups runs → `<ul><li>`) |
| `+ a` | `h("nota-ol-li", {}, ["a"])` (→ `<ol><li>`) |
| `@if (c) {a}` | `c ? Fragment("a") : null` |
| `@if (c) {a} else {b}` | `c ? Fragment("a") : Fragment("b")` |
| `@if (c) {a} else if (d) {b}` | `c ? Fragment("a") : d ? Fragment("b") : null` |
| `@for (x of y) {@li{@x}}` | `y.map((x, _i) => Fragment({ key: _i }, h("li", {}, [x])))` (E5; §4) |
| `@code\|{@foo{x}}\|` | `h("code", {}, [String.raw`@foo{x}`])` |
| `` `@x` `` | `h(CodeInline, {}, [String.raw`@x`])` |
| ` ```python⏎f(x)⏎``` ` | `h(CodeBlock, { lang: "python" }, [String.raw`f(x)`])` |
| `$a_@i$` | `h(Tex, {}, [String.raw`a_@i`])` (bare `@` is literal — R13; only `\|@` arms) |
| `$a_\|@i$` | `h(Tex, {}, [String.raw`a_`, i])` (armed interpolation, a sibling part) |
| `$$x^2$$` (in prose) | `h(Tex, {}, [String.raw`x^2`])` (run-2 **inline**, not display — R13) |
| `$$⏎…⏎$$` (standalone fence) | `h(Tex, { display: true }, [String.raw`…`])` |

Whitespace-significant text is emitted as explicit string children per notation.md §Whitespace
(Scribble algorithm). `CodeInline`/`CodeBlock`/`Tex`/`Heading` are ambient prelude bindings (`Tex`,
not `Math` — R14; `Heading` per R18f). **Staging caveat (R18g):** the `Heading` rows above are the
R18 *target* emit — the current reader still emits `h("h1", {}, […])` for `#` sugar until the R18
reader phase lands.

**`String.raw` emit caveat (implemented reality).** The `String.raw\`…\`` form above is emitted only
when the raw content contains no *template-syntax breaker* — a backtick or a literal `${`. Those two
cannot round-trip through `String.raw` (a backtick closes the template; `${` opens a substitution;
`String.raw` does not process a `\` escape, so any escaping `\` would leak into the runtime string),
so for content containing either, the reader falls back to a **cooked string literal** whose codegen
escaping reproduces the raw text exactly. Both forms yield the identical runtime string; the
`String.raw` form is kept for the common (breaker-free) case only for readability.

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
hoisted+exported component bindings (F1), and the `decode(...)` wrap on Doc's returned fragment.
`Doc` (and the nested-`%` IIFE) is emitted **synchronous** — the reader does NOT auto-`async`ify it
from `await` (this reverses the earlier `await`→`async` plan; top-level `await` now emits
non-parsing JS by design, aligning with the sync-only `▸` flag in §2.2).

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
- **F1 — component definitions are document-local (REVISED by R15; supersedes the earlier
  hoist+export ruling).** A `%let/%const Name = inlineComponent(...)|blockComponent(...)` binding is an
  **ordinary lexical statement** — it lowers *in place* (top-of-file `%` prepends into `Doc`'s body,
  R5), with uniform JS scoping. The reader does **not** hoist it to module scope and does **not** add
  `export`. This is what lets an island be defined at any depth and close over document-local state
  (an `@for` loop variable, a `%const` above it): the client's *replay* re-executes the same code and
  recovers the same closure (R15a). `%export let Name = …` is the author's explicit opt-in to module
  scope (e.g. to reuse a component across documents). **The name-attach stays:** the reader passes the
  binding name as the constructor's 2nd argument (`inlineComponent(fn, "Name")`) so `island`'s manifest
  `comp` field resolves (runtime stores it as `marked.compName`; see §1) — the returned fn cannot
  otherwise recover its authored name. Name-attach is applied to top-level `%let/%const` **and**
  `%export`-wrapped component decls (the latter previously got no name — an R15 fix). The old v1
  constraint ("a hoistable body must close over module scope only") is **lifted** — capturing
  document-local state is now the point.
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
  A run is *maximal* over same-kind sentinels with interior whitespace-only text bridged/consumed, so
  a stray `"\n"` between items (however the stream was assembled) never splits the list; edge
  whitespace and whitespace fencing the list off from prose is preserved (R16).
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
never null. Opaque leaves (`RawHtml`, and R18's `MarkLeaf`/`QueryLeaf`) survive `flatten` untouched.

**Doc-state passes (R18).** At `▸=false`, `decode` runs `serialize ∘ struct ∘ force ∘ index ∘
normalize` (§0 R18): `normalize` hoists R10 expansion + transparent-fragment splicing to a
whole-tree pre-pass; `index` collects `mark` leaves in one DFS (descending boundary *children*,
never bodies; walking vnode-valued `data.content`); `force` removes marks and splices each `query`'s
output (normalized, recursively forced) in place — **before grouping**, so forced output
participates in list/para/section grouping like authored content and none of the passes in this
section ever see a doc-state leaf (R16 bridging, `isBlock`, para runs are unaffected by
construction). `struct`'s semantics above are **unchanged**: its interleaved expansion remains
(vacuous after `normalize`), and it passes a stray mark/query leaf through untouched — `serialize`
then fails pointedly on it (mirror of the R10 function-tag guard), which is what a direct
`struct`/`serialize` caller sees if it skips the doc passes.

---

## 8. SSG / islands — LOCKED by Part-2 Phases I–K (supersedes decode.md's SSG-driver pseudocode)

> **Amended by R15 (replay hydration).** The *server* SSG semantics below (hydration-id marker,
> decode-once driver, `raw(slot)`, the `Adapter` surface) stand unchanged. What R15 supersedes is the
> **client transport**: the manifest no longer carries props across the wire, **E4 is retired**, and
> the manifest-driven boot (`bootIslands` / the Part-3 handoffs at the end of this section) is replaced
> by `hydrateDocument`, which reconstructs each island's live boundary by *replaying* the document
> client-side (capture mode). Islands may be defined at any depth and close over document-local state.
> The `bootIslands` path remains additively during the staged migration (implementation.md R15 phases).

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
- **E4 validation (RETIRED by R15).** `island` used to validate props are JSON-serializable *first*
  (before any side effect), rejecting functions/symbols/bigint/`undefined`/circular refs. Under R15
  props cross by *replay*, not JSON, so the check is obsolete — non-JSON props (functions, class
  instances) are legal. During the staged migration the check is **skipped in capture mode** and
  removed outright when the old `bootIslands` path is deleted (implementation.md R15 phase 4).

### Part-3 handoffs (the registry/boot helper consumes Part 2)
> **Superseded by R15.** These handoffs describe the manifest-driven boot (props transported as JSON,
> registry keyed by `comp` name, slot scraped from `innerHTML`). R15 replaces the whole client path
> with `hydrateDocument(Doc, {root?})`: no registry, no JSON props, no slot-scrape — the client
> replays `Doc` to recover each island's live `CompFn`, props, and recomputed slot. Retained here for
> the additive-migration window; deleted when the old boot goes.
- `render(Doc) → { html, manifest }`; `Manifest = Record<id, { comp, props }>` (R15: `{ comp }` only);
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

**Compiler API** (`oxc/crates/oxc/src/nota.rs`). The three *compile* entries below all parse
`SourceType::tsx()` (embedded TS admitted); they share one pipeline (`compile_internal`) and differ
only in the strip / mapping tails. (Two non-compile entries sit beside them, same parse mode:
`Parser::parse_nota_document` — the post-parse Nota AST, serving the playground's AST pane via the
wasm `parseAst` — and `highlight(src)` — reader-faithful highlight spans, wasm `highlight()` /
`highlightKindNames()`; see `oxc/NOTA_READER.md` §Highlighting.)
- `compile(src) → {code, map}` — the **build** path; the shim/CLI/vite use it. It **strips embedded
  TS** to plain JS via `oxc_transformer`'s TypeScript pass (`strip_typescript`) — so `% const n:
  number` is accepted and the annotation is removed. (This closes the earlier "rejects embedded TS"
  gap: the build path is now `tsx`-parsed + type-stripped.)
- `compile_with_mappings(src) → {code, map, mappings}` — build + H1; **preserves** types (stripping
  would shift codegen offsets, breaking byte-exact mappings).
- `compile_virtual(src) → {code /*.tsx, types preserved*/, mappings}` — **H2 + H1; Part 5 (Volar)
  consumes this.** H2 finding: strip-vs-preserve is *not* a codegen choice — `oxc_codegen` always
  prints whatever TS is in the AST. So preserving is the default (do nothing), and the build path is
  the one that runs the extra strip pass; the virtual/mapping paths skip it.
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
  backend (wasm-bindgen over the same entries, plus `parseAst` and `highlight`/`highlightKindNames`)
  serves the browser playground (Part 4) and can later replace the subprocess for the language
  server.

**Ambient prelude (LOCKED; amended by R14, R18).** The emitted module references `useState` and
`Tex`/`CodeInline`/`CodeBlock`/`Heading` as **free identifiers** — ambient, per §3.1
mechanism-not-policy. The
**integrator supplies them**; the CLI does so via **esbuild `inject`** of a prelude module
(`useState` = the framework's; `Tex`/`CodeInline`/`CodeBlock`/`Heading` re-exported from
`@nota-lang/prelude`, where they are registry *slots* over KaTeX/shiki/heading-numbering
defaults — R14, R18f). Users
override per-document via `%import` shadowing, or site-wide at runtime via
`registerComponents({…})` (e.g. from the `nota build --setup <module>` hook); the injected prelude
module itself is not user-facing surface.

**Slot rehydration (amends §8; the `innerHTML`-scrape heuristic is RETIRED by R15).** Under R15 the
client *replays* the document, so each island's static `@children` slot is **recomputed exactly as SSG
computed it** — there is no need to scrape it out of the SSR'd DOM, and the "single root forwarding
`@children`" v1 heuristic (below) is gone. The pre-R15 mechanism, retained during the migration window:
an island
whose component forwards a `@children` slot SSRs *with* that slot content; the runtime's `bootIslands`
passes only props, so a client re-render lacks the slot → **React hydration mismatch (#418)**. The
**runtime** therefore ships a slot-aware boot (`boot.ts`, moved out of the M generator — the generated
entry is document *data* only): `bootIslandsWithSlots(manifest, registry, root?)` — per
`[data-hydration-id]` node, recover the slot from the SSR'd component-root's `innerHTML`, wrap
`raw(slot)`, and `adapter.hydrate(build(props, raw(slot)), node)` — plus
`islandRegistry(manifest, moduleNs)` deriving `registry[comp] = (props, slot) =>
adapter.h(resolveIslandComponent(moduleNs, comp), props, slot ?? [])` (builds, never invokes;
resolution at hydrate time: module export ?? `registeredComponent` — R14b). The M helper emits only
the manifest literal + module/adapter/setup imports + the `setAdapter`/boot calls. **v1 heuristic** —
assumes a single root forwarding `@children`; general slots likely need the slot carried explicitly
(Astro-style).

**Manifest delivery (F3, for the CLI):** the CLI embeds the manifest **in the boot bundle**
(self-contained, no fetch) **and** inlines a `<script type="application/json" id="nota-manifest">`
metadata view; the boot does not depend on the latter.

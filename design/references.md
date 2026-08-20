# Unified references

**Status: the spec for branch `unified-references`.** Section references, code references
(definitions), citations, notes, and paper's figures are today five parallel mechanisms,
each with its own fact kinds, numbering algorithm, and dedup loop (the 2026-08 audit counted
four numbering implementations plus an unused fifth, three first-appearance dedup loops, and
anchor-id prefixes scattered as string literals). This branch collapses them into one
**anchor / reference** model over the doc-state store, with one surface (`&id` / `@Ref`) for
uses and ordinary components for definitions. [solid.md](./solid.md) §Doc-state is the
substrate and is unchanged; [notation.md](./notation.md) §Doc-state references is superseded
by §Syntax below.

> **Naming note.** The components this spec calls `Footnote`/`Footnotes`/`FootnotesList` and
> `Definition` were later renamed to `Note`/`Notes`/`NotesList` and `Def` (anchor kinds
> `footnote`/`definition` → `note`/`def`; DOM `nota-fnref`/`fnref-N`/`fn-N` →
> `nota-noteref`/`noteref-N`/`note-N`). This text uses the new names. Names recorded here as
> *retired* — `FootnoteMark`, `FootnoteText`, the `footnote-text` kind, and the reader's
> `footnote_sugar_at`/`parse_footnote_sugar`/`parse_footnote_text` — keep their original
> spelling; they never existed under the new vocabulary.

## The model

Two fact kinds replace `heading` / `label` / `definition` / `footnote` / `footnote-text` /
`cite` / `figure` / `figure-caption`:

- **`anchor`** — a referenceable target: `{ id?, kind, …data }`, registered by the *defining*
  component. The prelude ships kinds `heading`, `label`, `note`, `bib`, `def`;
  paper adds `figure`. Kind-specific data is JSON-safe (for example, rank/title for headings);
  non-JSON payloads (a definition label component, note body, or tooltip bank entry) ride as
  live-only thunks that the snapshot drops. Consumers recover them from the live fact with the
  same location; document-end trailers use the same `read()`/`live()` duality.
- **`ref`** — a use: `{ target, …data }`, registered by `Ref` and its wrappers.

### The namespace

One flat id space across kinds — that is what makes `&x` writable without a kind sigil. Two
strengths:

- **Strong** anchors have *authored* ids: `@Label`, `@Note[id]`, `@Def`, figures,
  bib keys, and headings with an explicit id (`# Title [id: "intro"]`). A strong/strong
  collision is a duplicate-id diagnostic naming both kinds. (`:` is a label continue-char, so
  `sec:intro` / `fn:aside` conventions restore per-kind prefixes for those who want them.)
- **Weak** anchors have *derived* ids: heading slugs (deduped `-N` among themselves, as
  today). Weak ids resolve when unshadowed; a strong anchor silently shadows a colliding slug
  — a derived name must never explode a document.

Bib entries are **config-virtual** anchors: `bibset({src})` keys resolve as `bib`-kind anchors
without a registration (config is positional module state, not a render). New capability that
falls out: `&intro` reaches a heading directly (explicit id or slug) — no `@Label` required.
Anchors may also be **anonymous** (no id): the inline `@Note{…}` registers one. Anonymous
anchors are unreferenceable and use their opaque location as an internal key.

### Derivations

All pure functions consume the ordered anchor/ref views of the snapshot:

- `resolveAnchors(anchors, bibSrc)` — the id → anchor map (strong first with duplicate
  detection, then virtual bib, then unshadowed weak slugs).
- `anchorOrdinal` — position among same-kind anchors in document order (figures "Figure 3";
  heading §-numbers stay the rank-stack outline algorithm over heading anchors).
- `refNumber` — position of the target's **first reference** among references-to-that-kind
  (note numbers, numeric citation labels). Repeated references share the number — today's
  note rule, now the general one. (`bibset({style:"alpha"})` keeps its re-sort.)
- `refsTo(id)` / `referenced(id)` — the recorded uses: backlinks and only-render-what's-used
  (bibliography shows cited entries, as today — but now by the general predicate).
  *Caveat:* `texRef` wires math to tooltips through TeX source, not the store, so
  `def`-kind referencedness is best-effort — the tooltip bank keeps rendering **all**
  definitions (as today), never filtering by `referenced()`.

The two numbering flavors — by *where the anchor sits* vs. by *where the first use sits* — are
the whole reason five mechanisms existed. Naming that pair and letting every kind pick one is
the unification.

## The components

- **`Ref`** — THE reference (`&id` sugar). Resolves the id, registers a `ref` fact, renders by
  the anchor's kind, keeping today's DOM bytes per arm (classes included, so `titleTextOf`'s
  meta-skip list still holds):
  - `def` → `<a href="#def-x" class="nota-ref nota-def-ref" data-nota-def="x">` (tooltip
    + no-JS anchor jump, unchanged).
  - `label` → nearest preceding heading's number-or-title, href to its id (unchanged).
  - `heading` (new arm) → the heading itself: number-or-title, href to its id.
  - `note` (subsumes `FootnoteMark`) → `<sup class="nota-noteref"><a id="noteref-N" (first use
    only) href="#note-N">N</a></sup>` — byte-identical to today's marks.
  - `bib` (subsumes single-key `Cite`) → `<a href="#bib-key" class="nota-cite">[N]</a>`; a
    `page` prop renders `[N, p. 33]`; the first citing site carries `id="citeref-N"` for the
    bibliography's backlink.
  - any other kind (paper's `figure`) → the **generic arm**: `<a href={anchor.href ?? "#" +
    id}>` labeled `(anchor.refPrefix ?? "") + anchorOrdinal` — kinds are extensible with JSON
    data alone, no renderer registry.
  - unresolved → seeded: pointed error; unseeded: the reactive `?` placeholder (unchanged
    policy).
  Authored children (`&id{custom text}`) override the rendered text on every arm.
- **`Note`** — both note forms, replacing `FootnoteText` (and, with `Ref`,
  `FootnoteMark`):
  - `@Note[id: "x"]: body…` — a **definition**: strong `note` anchor carrying the body
    thunk; renders nothing in place; referenced via `&x`.
  - `@Note{body}` (id-less) — the **inline one-shot** (today's anonymous form): registers
    an anonymous anchor *and* its use fused, renders the `<sup>` mark itself.
  The list (auto-trailer or explicit `@Notes`) renders bodies in number order with the ↩
  backlink to each entry's first use, as today.
- **`Cite`** — kept as the multi-key/options wrapper (`@Cite{a, b}` → `[1, 2]`); each key is a
  `bib` ref under the hood. `&knuth84` is the plain single citation.
- **`Bibliography`** — cited entries in label order (unchanged), each entry now ending with a
  ↩ backlink to its first citing site (`#citeref-N`) — the citation counterpart of the
  note arrow.
- **`Def`** — registers a strong `def` anchor. `id` is the `&id` target, `Label`
  is a component instantiated as the default reference content, and the rendered definition body
  is cloned for the default tooltip. An explicit `tooltip` prop overrides that body. The tooltip
  bank (`DefBank`) supports both explicit bank thunks and rendered DOM targets, so definitions and
  figures avoid evaluating their bodies twice. The dblclick jump follows the reference's own
  `href` instead of a hard-coded `#def-` prefix (this also fixes the currently-broken figure jump).
  An open tooltip is placed by **Floating UI** (`@floating-ui/dom`), which owns every
  geometry decision the hand-rolled version got wrong or skipped:
  - `offset(8)` — the gap to the reference; `flip` — above by default, below when the top is
    tight; `shift` — slide along the reference to stay inside an 8px viewport margin.
  - `inline(clickPoint)` — references are *inline*, so an `<a>` broken across two lines has two
    rects; the tooltip anchors to the line the reader actually clicked, not the union box.
  - `size` — publishes `--nota-tooltip-available-{width,height}` on the tooltip, which
    `DEF_TOOLTIP_STYLE` caps `max-width`/`max-height` against, so a long definition near an edge
    scrolls instead of overflowing.
  - `autoUpdate` — the open tooltip stays pinned while the page scrolls, resizes or reflows; it
    is torn down on dismissal. The chosen side lands on `data-placement` (an arrow hangs off it).
- **`Heading` / `Label` / `Toc`** — unchanged surfaces over `heading`/`label` anchors; `Toc`
  is a view over the heading anchors. Components use the handle's opaque location for identity,
  not a captured sequence index.
- Paper's **`Figure`/`Caption`** — `Figure` registers a `figure` anchor `{id?, href:
  "#fig-id", refPrefix: "Figure ", bank}` (no baked number string, no definition
  double-registration); `Caption` reads its figure's ordinal through a `FigureContext`
  (correct even when an earlier figure mounts later, which the old `handle.seq` baking got
  wrong). `language()`/`Bnf`/`texRef` are unchanged (definitions all the way down).

Removed: `FootnoteMark`, `FootnoteText` (components, emit names, ambient names, LSP preamble
types).

## Syntax

The `&`-ref family is already the reference surface (`<id>` → `@Label`, `&id` → `@Ref`) and
notation.md already names `&`-refs "the likely future link surface". Two changes:

1. **The `[^…]` digraphs are removed.** `[^1]` / `[^n]: …` die from the lexer, parser, AST
   (`NotaDocStateKind` keeps `Label = 0`, `Ref = 1`; the two note discriminants retire),
   lowering, emit-surface reservation, highlight pass, and fixtures. Note uses are `&id`;
   definitions are `@Note[id: "x"]: …` — the element + positional-colon machinery that
   already parses today (the `@FootnoteText[label]: …` form is golden-tested now). The `[`
   dispatch simplifies to: trailing attrs group, else literal.
2. **`&id` composes with glued postfix groups**, completing its equivalence to the element
   form it rewrites to:
   - `&id[props]` — a glued props-shaped `[` group continues the form (the attrs-group gate:
     first entry `ident:` / quoted key / `...spread`); non-props-shaped stays literal prose
     (`see &sec[1]` keeps `[1]` as text). Once one group commits, further glued `[` chain like
     an element head's.
   - `&id{body}` — a glued `{` opens a markup body (custom reference text).
   - Both: `&smith2020[page: "33"]{Smith}` → `<Ref id="smith2020" page="33">Smith</Ref>`.
   An unglued `[`/`{` is untouched prose, and bare `&id` is exactly today's emit.
3. **The `<`/`&` left-boundary guard also fires after closing/terminal punctuation**
   (`.` `,` `;` `:` `!` `?` `)` `]` `}`), not just whitespace/opening punctuation. Rationale:
   the retired `[^n]` glued directly after words, and a note mark that cannot follow its
   sentence is typographically broken — `As shown.&note` must fire. Ident-adjacency still
   blocks, so `R&D`/`a&b`/`Vec<T>` stay literal; the mark-after-word idiom (`word&n`) remains
   inexpressible by design (indistinguishable from `R&D`) — place marks after punctuation
   (Chicago style) or use the element form.

No new sigils, no new extent rules, no new highlight kinds (doc-state reuses `Sigil` +
`Interpolation`, the documented precedent); net syntax shrinks by one digraph family.

## Wire format & two-pass

The snapshot is one document-ordered array of `{kind, fact}` entries. Each fact carries an opaque
`location`; locations are compared only for identity, while array order (or `DocState.index` for
cross-kind queries) answers before/after questions. Numbering is derived from ordered per-kind
views and is never baked into facts, so equivalent render passes converge. Unmounting removes a
fact reactively; remounting creates a new occurrence at the end of registration order.

## Editor story (deliberately deferred)

`&id` labels carry no `CodeMapping`, so go-to-definition/rename on reference labels does not
exist today and does not arrive with this branch; it needs a new mapping kind or a bespoke
LSP feature over the AST. Highlighting is unchanged. The emacs "never lie" tier paints no
doc-state sugar (by design), so only its conformance harness needs a re-run; the tmLanguage
is already deleted.

## Migration map

- oxc (branch `unified-references`): lexer table + `[` gate + `footnote_sugar_at` (+ its
  units), parser dispatch + `parse_footnote_sugar`/`parse_footnote_text`, AST variants,
  lowering rows, `PRELUDE_EMIT_NAMES`/reserved set, highlight walk + tests, codegen
  integration tests, `NOTA_READER.md` invariants; then `&` postfix composition + new goldens.
- compiler `AMBIENT_PRELUDE_NAMES`, LSP preamble declarations, playground scope: swap
  `FootnoteMark`/`FootnoteText` for `Note`'s new props.
- prelude/core/paper as above; `integration/mega.nota` + `packages/vite/tests/fixtures/*` +
  cli/vite/paper/codemirror test expectations rewritten to the new forms.
- Docs: notation.md §Doc-state references + emit-reference rows; NOTA_READER.md `[`-dispatch
  invariant.

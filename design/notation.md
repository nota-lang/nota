# Nota Design

> **Branch `solid`:** the emit is now **Solid JSX** — what this file calls the "JSX readability
> view" is the *actual* emit, and the hyperscript forms below document master. The authoritative
> emit table for this branch is [solid.md](./solid.md) §The pipeline; the surface-syntax
> semantics here (everything up to the lowering targets) are unchanged.

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) that lowers to
**hyperscript** — `h`/`Fragment`/`decode` calls from `@nota-lang/runtime`, NOT JSX text — for any
JSX framework (React, Solid). The runtime semantics (`decode`, SSG, islands) are specified in
[decode.md](./decode.md); this file specifies the surface syntax and what it lowers to.

## Notation

- `src → output` — Nota source to emitted JS. Most examples show the output as a **JSX
  readability view** (`<p>Hello</p>`); the actual emit is the 1:1 hyperscript form
  (`h("p", {}, ["Hello"])`) — see §Emit reference for the authoritative translation. Where the
  emitted *shape* is itself the point (dynamic tags, keys, raw spans), examples show hyperscript
  directly.
- The `export default function Doc(){…}` wrapper, its `decode(...)` body wrap, and
  compiler-injected imports are elided except where shown.
- `·` = significant space, `⏎` = significant newline; shown only where whitespace is the point.
- `⟦ … ⟧` = the reader's child-item sequence, shown where it clarifies.

## Core translation

### Elements
`@tag{body}` → `<tag>body</tag>`; bodies nest recursively; `@{body}` → a fragment.
```
@p{Hello}              → <p>Hello</p>
@p{Hello @em{world}}   → <p>Hello <em>world</em></p>
@{one @b{two}}         → <>one <b>two</b></>
```

### Host vs. component
Lowercase tag → host element (string); Capitalized → a component identifier that must be in scope.
```
@em{hi}        → <em>hi</em>          // host element
@Aside{hi}     → <Aside>hi</Aside>    // component; @Unknown{} is a scope error
```

### Dynamic tag
`@(expr){…}` uses the expression as the tag: conceptually `<expr>…</expr>`. Real JSX cannot place
an arbitrary expression in tag position (only an identifier or member expression may sit there),
but Nota's target is hyperscript: `h(expr, …)` is a plain function call, with no such grammatical
restriction. The expression lowers straight through as `h`'s first argument, whatever its shape —
no intermediate binding, and no special case for "already valid tag" shapes:
```
@(getTag()){hi}        → h(getTag(), {}, ["hi"])
@(comps[k])[x:1]{hi}   → h(comps[k], { x: 1 }, ["hi"])
@(Box){hi}             → h(Box, {}, ["hi"])
@(ui.Card){hi}         → h(ui.Card, {}, ["hi"])
```

### Props
`[k:v, …]` is object-literal syntax. String literal → bare attribute; any other expression
→ `{…}`; bare key → `k={k}`; `...x` → spread; a value may itself be markup. No body / empty
`{}` → self-closing.
```
@a[href:"/x"]{go}            → <a href="/x">go</a>            // string → attr
@a[href:url]{go}             → <a href={url}>go</a>            // expression → {…}
@input[disabled, ...rest]{}  → <input disabled={disabled} {...rest} />   // shorthand + spread
@fig[cap:@em{hi}]{x}         → <fig cap={<em>hi</em>}>x</fig>  // markup-valued prop
```

### Interpolation
`@name` (a bare identifier only) → `{name}`; `@(expr)` → `{expr}` for any expression.
In embedded code — prop values, `@(expr)` -- an `@`-form is itself an
expression (so markup nests in code as readily as code nests in markup). Inside a `.nota` file,
`@` is unconditionally Nota markup — JS/TS decorators are unavailable (v1); this is sound because
decorators only appear in class/statement position, never in a Nota expression context.
```
@name              → {name}
@(user.posts[0])   → {user.posts[0]}
@(a + b)           → {a + b}              // @(…): any expression
```

### A file is a component
A `.nota` file compiles to a module whose default export is the document component; the body
becomes its returned fragment, wrapped in `decode(...)` — the wrap is what self-decodes the
document at SSG time (decode.md §The decode pipeline).
```
greeting.nota:
@h1{Hello}
@p{Welcome to @em{Nota}.}
→
export default function Doc() {
  return decode(<>
    <h1>Hello</h1>
    <p>Welcome to <em>Nota</em>.</p>
  </>);
}
```

## Colon & block sugar

`@head:` is sugar for a `{…}` body; `head` is a name, `@Cap`, or `@(expr)`. The body is the rest
of the line plus any following lines indented past the `@head:` line (common indent stripped) —
inline content and an indented continuation combine.

**The positional trigger.** The glued `:` is an element trigger like `{`/`[`, but only
*positionally*: it fires iff **(1)** the form is a markup-body child (the top region is markup —
never an embedded-JS island (`%` line, `[props]` value) nor a `|@`-armed form inside a raw span
(code / math / verbatim)), **and** **(2)** its `@` sits at a *line start* — modulo leading
whitespace, where a markup body's own start (braced/fragment body, document, or a bounded range
such as emphasis / heading / list item / another colon body) counts as a line start. So at a line
start `@foo:` is an element; **mid-line `@foo:` is just `@foo` interpolated followed by a literal
`:`** — `x @foo: y` is the text `x `, the value `foo`, then the literal `: y`. The `@foo\:` escape
(a literal colon glued to an interpolated head) therefore only matters at a line start; mid-line
the colon is already literal. The classification also governs the hyphenated-head extension, so a
dead colon never pulls `-foo` into the head (`t @my-foo:` → `@my` + `-foo:`).

A `[props]` group (or a run of them) on the head **composes** with the colon body exactly as it
does with a braced or verbatim body: `@aside[class: "x"]: body` opens the same colon body a bare
`@aside: body` would — the identical positional gate, judged at the `@`, with the props threaded
through — emitting `h("aside", { class: "x" }, ["body"])`. Where the gate fails, the whole form is
dead exactly as for bare heads: the head + props interpolate and `: …` stays literal text.

Leading `|` lines of the body supply the `[…]` props (multiple accumulate, `[…]`-syntax). A colon
body nested in a bounded range (emphasis / heading / list item / another colon body) ends at that
range's own end — and clips its resume there — so `*@a: bar* rest` → `*@a{bar}*` then the sibling
` rest`.

The examples below are all at line starts (so the `:` fires):
```
@foo: hello world   → @foo{hello world}
@(foo): hello       → @(foo){hello}
```
```
@foo:
  hello
  world
→
@foo{
  hello
  world
}
```
```
@foo: bar
  baz
→
@foo{
  bar
  baz
}
```
```
@foo:
  | x: y
  hello
→
@foo[x: y]{hello}
```

## Statements & control flow

Two non-overlapping worlds, picked by **sigil** — never by inspecting a body. `%`
is *code* (JS statements, run for effect); `@for`/`@if` are *content* (comprehension-
shaped, lowering to `.map`/ternary). A side-effecting loop lives in `%`; a content
loop is `@for` — so the two never collide and nothing is parsed two ways.

### Statements
`%` as the first non-whitespace on a line begins JS: the rest of the line is JS
statements — as many as fit (`% a(); b();`) — under JS's own rules (`;` and ASI; a
statement continues across single newlines exactly where JS grammar allows, so a
multi-line binding may close with an unindented `})`). The region hands back to
markup at a clear boundary: end of line once the last statement completes there, a
**blank line** (which always ends the statement — ASI applies as at end of input;
a statement straddling one is a diagnostic), or the next line-leading `%`.
Blank-line-separated code belongs in `%%%`. `%` is literal elsewhere (`50%`); `\%`
forces a literal at line-start. A `%` statement scopes the rest of its block, and
never itself produces content — content comes only from markup.

**Footgun (JS-greedy extent):** because the region continues wherever JS grammar
allows, a multi-line binding followed by a `-` list line parses as a *subtraction*
unless the statement is closed with an explicit `;` —
`% let E = inlineComponent(() => …⏎})` + `- @E{}` reads as
`inlineComponent(…) - h(E, {}, [])`. End the binding with `});` (or a blank line)
before a `-`/`+` marker line.

For many statements at once, a `%%%` fence — each fence on its own line — holds a raw
JS block, with the same scoping and `@`-form rules as `%`; a `%` run shorter than the
fence is literal inside it.
```
%%%
const xs = load();
const total = xs.reduce((a, b) => a + b, 0);
%%%
@p{Total: @total}
→ const xs = load(); const total = xs.reduce((a, b) => a + b, 0); return <><p>Total: {total}</p></>;
```

At the top of a file, `%`/`%%%` prepends to the document component (`import`/`export`
hoist to module scope); nested in an element body, it wraps the remaining siblings in
an IIFE. A component definition (`%let C = inlineComponent(…)`) is **not** special-cased: it
prepends in place like any other statement, so it may be document-local and close over document
state — replay hydration (decode.md) recovers its closure on the client. `%export let C = …`
is the opt-in to module scope. `Doc` (and the nested-`%` IIFE) is emitted **synchronous** — the reader does not
auto-`async`ify it from the presence of `await`, so top-level `await` emits JS that does not
parse (by design, not a silent rewrite). Load data synchronously, or outside the document.
```
% import {load} from "./posts"
% const posts = load();
@h1{Posts}
→
import {load} from "./posts";
export default function Doc() {
  const posts = load();
  return <><h1>Posts</h1></>;
}
```
```
@aside{
  Intro.
  % const n = count()
  @p{@n items}
}
→ <aside>{"Intro."}{(() => { const n = count(); return <><p>{n} items</p></>; })()}</aside>
```

### Conditionals
`@if (c) {…}`, with optional `else if (d) {…}` / `else {…}` continuations; `c`/`d` are
JS expressions, bodies are markup. Lowers to a (nested) ternary, `null` when no branch
matches.
```
@if (c) {a}                    → {c ? <>a</> : null}
@if (c) {a} else {b}           → {c ? <>a</> : <>b</>}
@if (c) {a} else if (d) {b}    → {c ? <>a</> : d ? <>b</> : null}
```
`else` is a contextual keyword: it continues a conditional only as the next token
after the closing `}`, with no blank line between; elsewhere it is literal text
(`\else` forces the literal right after an if-block). `for`/`if` keep their `@`, so
only `else`/`else if` are sigil-less.

### Loops
`@for (bind of iter) {body}` maps `body` over `iter`; `bind` is any binding pattern
(index via `.entries()`). The reader adds its own fresh map-index param `_i` as a `key` on each
iteration's wrapping `Fragment` — React/Solid need list children keyed for client
reconciliation; at SSG the fragment is transparent and the key is dropped (decode.md
§Fragment transparency). `@if` stays keyless (single branch, nothing to reconcile).
```
@for (x of y) {@li{@x}}     → {y.map((x, _i) => <Fragment key={_i}><li>{x}</li></Fragment>)}
```

All three are expressions, so they nest in markup and embedded code alike, and
whitespace after `@for`/`@if` is insignificant. Imperative forms with no value-shape
(`while`, `try`, C-style or side-effecting `for`) have no `@`-form — write them in `%`.

## Comments

`//` and `/* … */`, Typst/C style. Both fire in **markup text position** — never inside raw spans
(code / math / verbatim, where they are content) or embedded JS (which has its own comments) — and
a comment is **trivia**: excised from the child stream, never emitted (it rides the parse's
comments channel for the ESTree view and the highlight pass).

- `//` runs to the end of its line. The extent is raw, C-style: in a single-line braced body it
  claims the `}` too (`@p{a // b}` is a loud unclosed-body diagnostic, not silence); bounded
  bodies (heading / list-item lines, colon bodies) clip it at their own end (`# Title // note`
  works).
- `/* … */` runs to the matching close, **nesting counted** (Typst's rule: `/* a /* b */ c */` is
  one comment). Unterminated is a fatal diagnostic.
- A comment with its line to itself is consumed *with* the line's newline, so a comment-only line
  contributes no phantom soft/paragraph break, and a heading/list/`%` on the next line still
  fires. A trailing comment leaves its line's newline (a soft break).
- `\/` escapes the opener (`\//` renders `//`). Consequence of firing anywhere in prose, as in
  Typst: a bare URL is claimed by `//` — use an `@a[href: "…"]{…}` element (the url is embedded
  JS, where `//` is string content), a code span, or the escape.

```
a // note⏎b        → ⟦ "a", "⏎", "b" ⟧          // comment excised; the newline survives
a⏎// note⏎b        → ⟦ "a", "⏎", "b" ⟧          // comment-only line: no phantom break
a /* x /* y */ */ b → ⟦ "a ", " b" ⟧            // nested; excised in place
```

## Markup sugar

Lightweight prose markers, after Typst (except headings, which use `#`). Each
desugars to an ordinary element, so all the rules above (nesting, whitespace,
escaping) carry over; the escaped form (`\* \_ \~ \# \- \+ \[ \!`) is the literal character.
Line-start markers (`#`/`-`/`+`/`N.`/`%`) fire at a line start — and the **start of a
markup body counts as one** (Typst's content-block rule): a braced body, colon body, or
bounded sub-range opening directly with a marker opens the construct, with its first-line
extent clipped at the body's own closer (`@{- item}` opens a list item, clipped at the
body's own `}`). Literal braces in prose do not open a body, so `a {- b} c` stays text.

### Emphasis
`*…*` → `@strong{…}`, `_…_` → `@em{…}`, `~~…~~` → `@s{…}` (strikethrough — the one two-byte
marker; a lone `~` is always literal); bodies nest markup like any element.
Following Typst, a marker opens only at a left word boundary and closes only at a
right one (for `~~`, judged across the pair), so intra-word `*`/`_`/`~~` are literal without
escaping.

**The line clamp.** An inline span never crosses a newline (CommonMark-style): `*…*`, `_…_`,
`` `…` ``, and inline `$…$` must close on their opening line, else the opener is literal text —
`*foo⏎bar*` keeps both stars as text. The clamp is strict: a skipped sub-region (raw span,
`@`-form bracket group) that crosses the line end kills the span too. Block-shaped raw bodies
keep their own multi-line extents: `$$…$$` fences, fenced ``` code, `|{…}|` verbatim.
```
*bold*           → <strong>bold</strong>
_italic_         → <em>italic</em>
*a _b_ c*        → <strong>a <em>b</em> c</strong>
my_var_name      → my_var_name                  // intra-word: literal
```

### Headings
A line opening with a run of 1–6 `#` followed by a space is a heading of rank `n`
(the run length); the body is the rest of the line and nests markup. The readability
view below is the *rendered* HTML — the actual emit re-lowers `#` sugar to the
ambient `Heading` prelude slot (`# Title → h(Heading, { rank: 1 }, ["Title"])`; see
decode.md §Doc-state), which produces the concrete `<hN>` with a slugified
`id` and an optional leading section number (off until `secset({ numberDepth })` is
raised). A raw `@h1{…}` stays a plain host tag — the principled unnumbered / un-Toc'd
escape hatch (`\section*`).
```
# Title          → <h1>Title</h1>
### Sub *bit*    → <h3>Sub <strong>bit</strong></h3>
```

### Lists
Consecutive sibling lines each opening with `-·` (bullet) or `+·` (number) form one
list: `-` → `@ul`, `+` → `@ol`, and each line → an `@li`. An item's body continues
on lines indented past its marker (the `@head:` block-sugar rule); a marker indented
deeper opens a nested list, which attaches to the item above it.
```
- a
- b
→ @ul{@li{a} @li{b}}             → <ul><li>a</li><li>b</li></ul>

+ first
+ second
→ @ol{@li{first} @li{second}}    → <ol><li>first</li><li>second</li></ol>

- a
  - b
  - c
→ @ul{@li{a @ul{@li{b} @li{c}}}}
```
An explicit `N.` (e.g. `1.`) is an alternate `@ol` marker; the written numbers are
ignored, the browser renders the sequence.

### Thematic break
A line-start run of 3+ `-` with a whitespace-only tail (indentation tolerated) → `@hr{}` — a
block, so the runtime breaks paragraphs around it. It fires through the same line-start hook as
lists/headings (so it obeys the content-block rule and the brace/bounded clips); inline `---`
stays literal text (the decode-stage smart-dash pass's material). A `- ` list marker needs its
space, so the two line shapes never collide.
```
---              → <hr/>
a --- b          → literal text (→ an em dash at the decode stage)
```

### Links & images — deliberately NO markdown sugar
`[text](url)` and `![alt](src)` are **literal prose** (a link sugar existed briefly, 2026-08, and
was reverted — the bracket syntax is reserved). Links and images are element forms:
`@a[href: "…"]{text}` and `@img[src: "…", alt: "…"]`. The likely future link surface is the
`&`-ref family (a `&target` that resolves to an href), not brackets. Note the comment
interaction: a bare `https://…` in prose is claimed by `//` — put urls in props (embedded JS,
where `//` is string content) or escape.

### Attrs groups
A **trailing bare `[props]` group** attaches attributes to its construct — pandoc's heading-attrs
idea in Nota's own props syntax:
```
# Title [id: "intro", class: "wide"]     → <Heading rank={1} id="intro" class="wide">…
- item [class: "hot"]                    → the item's <li class="hot">
…end of a paragraph. [class: "note"]     → the formed <p class="nota-para note">
```
Two gates keep prose honest: **(1)** the interior must open with a props-shaped first entry —
`ident:`, a quoted key, or `...spread` — so `see [1]` and `[just words]` stay literal; **(2)** the
group must be *trailing*: after its `]`, only whitespace up to the line end / the enclosing
frame's end (or the braced body's own `}`). Past the gates the ordinary `[props]` machinery parses
the group — a malformed entry is a loud diagnostic, and `\[` escapes the opener. Attachment: a
trailing group in a **heading or list-item body hoists onto that construct's element** (the sugar
constructs with no native props syntax); anywhere else it lowers to the ambient `<Attrs …/>`
marker, which the runtime's Reforest pass strips and applies to **the paragraph it is forming** (a
lone marker between paragraphs decorates the preceding one; paragraph attrs are **string-valued**
— they round-trip through the rendered marker). Inside a non-flow element's braced body the marker
has no paragraph former and renders inert — use the element's native props there.

### Doc-state references
Two inline sugars for the **unified reference registry** ([references.md](./references.md) —
sections, definitions, citations, footnotes, and figures are all anchors referenced the same
way), each a **rewrite to the element form** — so they inherit the element machinery (line
clamp, positional rules, bounded-frame clipping) instead of new extent rules: `<id>` declares a
`@Label` anchor and `&id` is `@Ref`, the one reference (what it renders — a section number, a
footnote mark, a citation `[N]`, a definition tooltip, "Figure N" — is the *anchor's* kind, not
the sugar's). The label charset is **Typst minus period** — start `[A-Za-z0-9_]`, continue
`[A-Za-z0-9_:-]`, ASCII-only. Digits may start a label; kebab labels work (`<sec-intro>`,
`&sec-intro`); the colon is a continue char (`<sec:intro>`); the period is **not** in the set,
so `&sec.` reads the id as `sec` and leaves the `.` literal, and `$`/Unicode are not label
chars. `<` and `&` carry a **left-boundary guard** — they fire at the start of a body/line, or
after whitespace, opening punctuation (`(` `[` `{` quote), or **closing/terminal punctuation**
(`.` `,` `;` `:` `!` `?` `)` `]` `}`) — so `Vec<T>`, `R&D`, `a<b`, `a&b` stay literal prose
(ident-adjacency blocks), a footnote use glues after its sentence (`As shown.&note`), and the
start restriction keeps arrow-like prose literal (`<->`, `<-x>`). `<ident>` must close with `>`
on its opening line (the line clamp); `&ident` ends at the first non-ident char; a non-matching
open (`< b`, `<.x>`, `&,`) is literal text.

A ref composes with **glued postfix groups**, completing its equivalence to the element form:
a glued `[props]` group continues the ref iff it is props-shaped (the attrs-group first-entry
gate — `see &sec[1]` keeps `[1]` prose; once one group commits, further glued `[` chain like an
element head's), and a glued `{body}` supplies authored reference text. The element forms
themselves are charset-free (`@Label[id: "…"]` accepts any string, including `.`/Unicode); only
the *sugar* is charset-restricted. Sugars fire only in markup-text position (never inside raw
spans / embedded JS — the positional trigger's condition 1). The whole family is ambient —
**no `%import` needed** (decode.md §The ambient prelude).
```
<sec_intro>              → @Label[id: "sec_intro"]{}          // anchor; must close > on its line
<sec-intro>              → @Label[id: "sec-intro"]{}          // kebab label (the - is a continue char)
&sec-intro               → @Ref[id: "sec-intro"]{}            // kebab cross-reference
As shown.&note1          → "As shown." + @Ref[id: "note1"]{}  // guard fires after closing punct
&smith2020[page: "33"]   → @Ref[id: "smith2020", page: "33"]{} // glued props-shaped group
&sec-intro{that section} → @Ref[id: "sec-intro"]{that section} // glued body: authored text
&sec.  Vec<T>  <->  &sec[1] → literal tails                   // period / guard / start / non-props [
```
There is **no footnote sugar**: a footnote *use* is `&id` (numbered by first-use order;
repeats share one number and one list entry), and a footnote *definition* is the ordinary
element + colon form — `@Footnote[id: "n1"]: body…` — or the id-less inline one-shot
`@Footnote{body}`. The list auto-appends at document end unless `@Footnotes` places it
(references.md §The components). The `[^…]` digraphs of earlier drafts are retired: `[^n]` is
plain prose. The escapes `\<`, `\&` yield the literal characters via the standard escape
machinery.

## Verbatim

A backslash escapes any character
(`` \@ \{ \} \| \$ \* \_ \: \[ \] \` ``) and itself, and is literal elsewhere.
A `|{ … }|` body is raw: sigils off, braces literal, ends at `}|`; the armed escape `|@` re-enters
Nota to produce element children. Raw text is emitted as a `String.raw` template so `\` and `{}`
survive.

**The unified raw-span model.** All raw spans — verbatim `|{…}|`, inline/block code, inline/fence
math — share ONE content model: raw text runs interleaved with `|@`-armed `@`-forms. A bare `@`
is **literal** — there is no direct interpolation; only `|@` re-enters Nota, spliced as a
*sibling* (not a `${…}` substitution). The only per-span difference is the close delimiter (a
scanned run vs. `}|`). There is no escape for a literal `|@`; a `|@`-armed form whose parse
overruns the span's fixed extent is a fatal diagnostic.
```
@code|{@foo{x}}|     → <code>{String.raw`@foo{x}`}</code>   // @ and { } are literal
@code|{
def f(x):
    return |@hl{x}
}|
→ <code>{String.raw`def f(x):
    return `}<hl>x</hl></code>
```

`[props]` groups compose with a verbatim body exactly as they do with a braced one: they
accumulate ahead of the same `|{…}|` delimiter that would otherwise sit directly against the
head. (A `|` after `]` **not** immediately followed by `{` is still not a trigger — self-closing /
literal text.)
```
@CodeBlock[lang: "python"]|{f(x)}|   → <CodeBlock lang="python">{String.raw`f(x)`}</CodeBlock>
```

## Math

`$…$` is inline; **display math is the fence form** — a standalone `$$` line, TeX body lines, and a
closing `$$` line (a run of ≥2 dollars whose opener-line tail is whitespace-only). Both lower to an
ambient `<Tex>` (`display` set for the fence), resolved from the prelude — the default renders
KaTeX→MathML, and the binding is a registry slot users can override (decode.md §The registry).
The name is `Tex`, not `Math`: an ambient `Math` would capture the JS global in embedded code
(`% Math.floor(x)` must keep meaning the global). Content is raw LaTeX (`String.raw`) under the
unified raw-span model: raw runs interleaved with `|@`-armed `@`-forms; a bare `@` is literal.

Dollar spans mirror backtick spans: an opening run of N dollars closes at the next same-line run of
≥N dollars (shorter runs are content). So `$$…$$` **inside a paragraph** (a nonempty opener tail) is
inline math with run-2 delimiters, **not** display. The one divergence from backticks is the TeX
escape: the dollar close scan skips `\<c>` pairs, so `\$` stays content and the backslash is kept
(LaTeX's own escape). Inline `$` is clamped to its line (the line clamp) — no same-line close → the
`$` run is literal.
```
$a_|@i$              → <Tex>{String.raw`a_`}{i}</Tex>
$E = @energy$        → <Tex>{String.raw`E = @energy`}</Tex>       // bare @ is literal
$$x^2$$  (in prose)  → <Tex>{String.raw`x^2`}</Tex>              // run-2 inline, NOT display
$$⏎\sum_|@n x⏎$$     → <Tex display>{String.raw`\sum_`}{n}{String.raw` x`}</Tex>
```

## Code

`` `…` `` is inline code; ```` ```lang⏎…⏎``` ```` is fenced (threshold 3, optional language tag on
the opening line). Both are raw (`String.raw`), lowering to ambient `<CodeInline>` / `<CodeBlock>`,
under the same unified raw-span model as math and verbatim: raw runs interleaved with
`|@`-armed `@`-forms (a bare `@` is literal). Backtick runs shorter than the closing fence are
literal; inline code is clamped to its line (the line clamp) — the close run must sit on the opening
line, else the run is literal, so ``- `foo⏎- bar` `` is two bullets, not one bullet holding a code
span.
````
`@x`                → <CodeInline>{String.raw`@x`}</CodeInline>    // @ is literal
`a |@em{x} b`       → <CodeInline>{String.raw`a `}<em>x</em>{String.raw` b`}</CodeInline>
```python⏎f(x)⏎```  → <CodeBlock lang="python">{String.raw`f(x)`}</CodeBlock>
````

## Smart punctuation (a decode-stage pass, not syntax)

Curly quotes/apostrophes, `---`→`—` / `--`→`–` (eating *horizontal* whitespace only — never a
newline, which is the paragraph-break marker), and `...`→`…` are applied to prose **at the decode
(Reforest) stage**, Pollen's typography rules verbatim (solid.md §Smart punctuation). They are not
reader syntax: the emit carries the source text, and the runtime transforms text on both server
and client identically. Raw spans (code/math/verbatim) and `[data-nota-nosmart]` elements are
excluded; default on, disabled per document via the render drivers' `smart` option.

## Whitespace

Follows Scribble's reader. Per body line, leading/trailing spaces are dropped, except between
`{` and text or text and `}`; a single newline right after `{` or before `}` is dropped (unless
the body is only newlines); interior newlines become individual `"\n"`; common indentation is
stripped, indentation beyond the leftmost line is kept. Codegen emits whitespace-significant
text as explicit `{"…"}` children.

Interior newlines are **never coalesced** — one `"\n"` child per newline — so a blank source line
surfaces as ≥2 adjacent `"\n"` children, which is exactly the runtime's paragraph-break marker
(decode.md §struct). This is a hard producer/consumer contract, not a stylistic choice.
```
@foo{·bar·}                  → ⟦ "·bar·" ⟧
@foo{⏎··bar⏎}                → ⟦ "bar" ⟧
@foo{⏎··begin⏎····x⏎··end}   → ⟦ "begin", "⏎", "··x", "⏎", "end" ⟧
```

## Emit reference (hyperscript)

The authoritative `src → emit` translation — what the reader's golden fixtures assert
(expression mode: the `Doc` wrapper and imports elided). The JSX views above are the readability
form of exactly these calls.

| Nota source | Emitted (hyperscript) |
|---|---|
| `@p{Hello}` | `h("p", {}, ["Hello"])` |
| `@p{Hello @em{world}}` | `h("p", {}, ["Hello ", h("em", {}, ["world"])])` |
| `@{one @b{two}}` | `Fragment("one ", h("b", {}, ["two"]))` |
| `@em{hi}` | `h("em", {}, ["hi"])` (host: string tag) |
| `@Aside{hi}` | `h(Aside, {}, ["hi"])` (component: identifier; `@Unknown{}` → scope error) |
| `@(getTag()){hi}` | `h(getTag(), {}, ["hi"])` (any expression shape, no binding) |
| `@(ui.Card){hi}` | `h(ui.Card, {}, ["hi"])` (static or computed member — same emit either way) |
| `@a[href:"/x"]{go}` | `h("a", { href: "/x" }, ["go"])` |
| `@a[href:url]{go}` | `h("a", { href: url }, ["go"])` |
| `@input[disabled, ...rest]{}` | `h("input", { disabled, ...rest }, [])` (empty body → no children) |
| `@fig[cap:@em{hi}]{x}` | `h("fig", { cap: h("em", {}, ["hi"]) }, ["x"])` (markup-valued prop) |
| `@name` | `name` (bare-identifier interpolation) |
| `@(user.posts[0])` | `user.posts[0]` |
| `*bold*` | `h("strong", {}, ["bold"])` |
| `_italic_` | `h("em", {}, ["italic"])` |
| `~~struck~~` | `h("s", {}, ["struck"])` |
| `---` (standalone line) | `h("hr", {}, [])` |
| `# T [id: "x"]` | `h(Heading, { rank: 1, id: "x" }, ["T"])` (trailing attrs hoist — heading/list-item) |
| `para. [class: "n"]` | `…, h(Attrs, { class: "n" }, [])` (flow position → the Reforest-applied marker) |
| `a // note` | `h(…, {}, ["a"])` (a comment is trivia — excised, never emitted) |
| `# Title` | `h(Heading, { rank: 1 }, ["Title"])` (heading sugar → the ambient `Heading` slot) |
| `### Sub *bit*` | `h(Heading, { rank: 3 }, ["Sub ", h("strong", {}, ["bit"])])` |
| `@h1{Title}` | `h("h1", {}, ["Title"])` (raw host tag: unnumbered/un-Toc'd) |
| `- a` (list item line) | `h("nota-ul-li", {}, ["a"])` (runtime `struct` groups runs → `<ul><li>`) |
| `+ a` | `h("nota-ol-li", {}, ["a"])` (→ `<ol><li>`) |
| `@if (c) {a}` | `c ? Fragment("a") : null` |
| `@if (c) {a} else {b}` | `c ? Fragment("a") : Fragment("b")` |
| `@if (c) {a} else if (d) {b}` | `c ? Fragment("a") : d ? Fragment("b") : null` |
| `@for (x of y) {@li{@x}}` | `y.map((x, _i) => Fragment({ key: _i }, h("li", {}, [x])))` |
| `<sec-intro>` | `h(Label, { id: "sec-intro" }, [])` (boundary-guarded — `Vec<T>`, `<->` stay text) |
| `&sec-intro` | `h(Ref, { id: "sec-intro" }, [])` (boundary-guarded — `R&D` stays text; fires after closing punct too) |
| `&k[page: "33"]{Smith}` | `h(Ref, { id: "k", page: "33" }, ["Smith"])` (glued postfix groups — references.md §Syntax) |
| `@Footnote[id: "n1"]: body` | `h(Footnote, { id: "n1" }, ["body"])` (an ordinary element — nothing reader-privileged) |
| `@aside[class: "x"]: body` | `h("aside", { class: "x" }, ["body"])` (props compose with a colon body) |
| `@code\|{@foo{x}}\|` | `h("code", {}, [String.raw`@foo{x}`])` |
| `` `@x` `` | `h(CodeInline, {}, [String.raw`@x`])` |
| ` ```python⏎f(x)⏎``` ` | `h(CodeBlock, { lang: "python" }, [String.raw`f(x)`])` |
| `$a_@i$` | `h(Tex, {}, [String.raw`a_@i`])` (bare `@` is literal; only `\|@` arms) |
| `$a_\|@i$` | `h(Tex, {}, [String.raw`a_`, i])` (armed interpolation, a sibling part) |
| `$$x^2$$` (in prose) | `h(Tex, {}, [String.raw`x^2`])` (run-2 **inline**, not display) |
| `$$⏎…⏎$$` (standalone fence) | `h(Tex, { display: true }, [String.raw`…`])` |

Whitespace-significant text is emitted as explicit string children per §Whitespace.
`CodeInline`/`CodeBlock`/`Tex`/`Heading` (and the whole doc-state family) are ambient prelude
bindings, supplied by the integrator (decode.md §The ambient prelude).

**Children are always an array literal** — a single child becomes `[child]` (`@p{@x}` →
`h("p", {}, [x])`; component body `@span{@children}` → `h("span", {}, [children])`). The
runtime's `flatten` normalizes bare-vs-array, but always-array is the reader's canonical emit.
The reader does **not** emit the `@nota-lang/runtime` import (the compiler shim/integrator
prepends it).

**`String.raw` emit caveat.** The `String.raw\`…\`` form is emitted only when the raw content
contains no *template-syntax breaker* — a backtick or a literal `${`. Those two cannot round-trip
through `String.raw` (a backtick closes the template; `${` opens a substitution; `String.raw`
does not process a `\` escape, so any escaping `\` would leak into the runtime string), so for
content containing either, the reader falls back to a **cooked string literal** whose codegen
escaping reproduces the raw text exactly. Both forms yield the identical runtime string.

**Document mode** additionally emits: `export default function Doc()`, hoisted `import`/`export`
(other top-of-file `%` statements prepend into `Doc`'s body — component bindings included, which
stay document-local; `%export` is the opt-in to module scope), the name-attach 2nd argument on
top-level and `%export`-wrapped `inlineComponent`/`blockComponent` bindings, and the `decode(...)`
wrap on Doc's returned fragment. `Doc` (and the nested-`%` IIFE) is synchronous — the reader does
NOT auto-`async`ify it from `await`; top-level `await` emits non-parsing JS by design (see
§Statements).

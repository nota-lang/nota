# Nota Design

Nota is a document language: `@`-syntax markup (after Pollen/Scribble) that lowers
to JSX for any JSX framework (React, Solid).

## Notation

- `src → output` — Nota source to emitted JSX. The `export default function Doc(){…}`
  wrapper and compiler-injected imports are elided except where shown.
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
`@(expr){…}` uses the expression as the tag: conceptually `<expr>…</expr>`. Real JSX cannot place an
arbitrary expression in tag position (only an identifier or member expression may sit there), but
Nota's actual target is hyperscript (R1): `h(expr, …)` is a plain function call, with no such
grammatical restriction. The expression lowers straight through as `h`'s first argument, whatever its
shape — no intermediate binding:
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
expression (so markup nests in code as readily as code nests in markup).
```
@name              → {name}
@(user.posts[0])   → {user.posts[0]}
@(a + b)           → {a + b}              // @(…): any expression
```

### A file is a component
A `.nota` file compiles to a module whose default export is the document component; the body
becomes its returned fragment.
```
greeting.nota:
@h1{Hello}
@p{Welcome to @em{Nota}.}
→
export default function Doc() {
  return <>
    <h1>Hello</h1>
    <p>Welcome to <em>Nota</em>.</p>
  </>;
}
```

## Colon & block sugar

`@head:` is sugar for a `{…}` body; `head` is a name, `@Cap`, or `@(expr)`. The body is the rest
of the line plus any following lines indented past the `@head:` line (common indent stripped) —
inline content and an indented continuation combine. The glued `:` is an element trigger like
`{`/`[`, but **positionally** (contract R9): it fires only when the form is a markup-body child
**and** its `@` sits at a *line start* — modulo leading whitespace, and a markup body's own start
(braced/fragment body, document, or a bounded range) counts as a line start. So at a line start
`@foo:` is an element; **mid-line `@foo:` is just `@foo` interpolated followed by a literal `:`** —
`x @foo: y` is the text `x `, the value `foo`, then the literal `: y`. The `@foo\:` escape (a
literal colon glued to an interpolated head) therefore only matters at a line start; mid-line the
colon is already literal. A `[props]` group (or a run of them) on the head **composes** with the
colon body exactly as it does with a braced or verbatim body (contract R21): `@aside[class: "x"]: body`
opens the same colon body a bare `@aside: body` would — the identical R12 positional gate, with the
props threaded through — emitting `h("aside", { class: "x" }, ["body"])`. In an embedded-JS host
(`%` line, `[props]` value) or a `|@`-armed form inside any raw span (code / math / verbatim) the `:`
never triggers. Leading `|` lines of the body supply the `[…]` props (multiple accumulate,
`[…]`-syntax). A colon body nested in a bounded range (emphasis / heading / list item / another
colon body) ends at that range's own end: `*@a: bar* rest` → `*@a{bar}*` then the sibling ` rest`.

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
state (contract R15 — replay hydration recovers its closure on the client). `%export let C = …`
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
(index via `.entries()`).
```
@for (x of y) {@li{@x}}               → {y.map((x) => <Fragment><li>{x}</li></Fragment>)}
```

All three are expressions, so they nest in markup and embedded code alike, and
whitespace after `@for`/`@if` is insignificant. Imperative forms with no value-shape
(`while`, `try`, C-style or side-effecting `for`) have no `@`-form — write them in `%`.

## Markup sugar

Lightweight prose markers, after Typst (except headings, which use `#`). Each
desugars to an ordinary element, so all the rules above (nesting, whitespace,
escaping) carry over; the escaped form (`\* \_ \# \- \+`) is the literal character.
Line-start markers (`#`/`-`/`+`/`N.`/`%`) fire at a line start — and the **start of a
markup body counts as one** (Typst's content-block rule, contract R9): `@{- item}`
opens a list item, clipped at the body's own `}`. Literal braces in prose do not
open a body, so `a {- b} c` stays text.

### Emphasis
`*…*` → `@strong{…}`, `_…_` → `@em{…}`; bodies nest markup like any element.
Following Typst, a marker opens only at a left word boundary and closes only at a
right one, so intra-word `*`/`_` are literal without escaping. A span is clamped to
its line (CommonMark-style, contract R11): with no same-line close the marker is
literal — `*foo⏎bar*` keeps both stars as text.
```
*bold*           → <strong>bold</strong>
_italic_         → <em>italic</em>
*a _b_ c*        → <strong>a <em>b</em> c</strong>
my_var_name      → my_var_name                  // intra-word: literal
```

### Headings
A line opening with a run of 1–6 `#` followed by a space is a heading of rank `n`
(the run length); the body is the rest of the line and nests markup. The readability
view below is the *rendered* HTML — but the actual emit re-lowers `#` sugar to the
ambient `Heading` prelude slot (`# Title → h(Heading, { rank: 1 }, ["Title"])`,
[contract R18f](contract.md)), which produces the concrete `<hN>` with a slugified
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

### Doc-state references
Four inline sugars for the ambient doc-state family, each a **rewrite to the element
form** so it inherits the element machinery (line clamp R11, positional rules R12) —
[contract R20](contract.md) (re-amended charset) pins the exact rules. The label charset
is **Typst minus period** — start `[A-Za-z0-9_]`, continue `[A-Za-z0-9_:-]`, ASCII-only.
Digits may start a label (`[^1]`, Markdown-style); kebab labels work (`<sec-intro>`,
`&sec-intro`); the colon is a continue char (`<sec:intro>`); the period is **not** in the
set, so `&sec.` reads the id as `sec` and leaves the `.` literal. `<` and `&` carry a
**left-boundary guard** — they fire only at the start of a body/line or after whitespace or
opening punctuation (`(` `[` `{` quote) — so `Vec<T>`, `R&D`, `a<b`, `a&b` stay literal
prose, and the start restriction keeps arrow-like prose literal (`<->`, `<-x>`); `[^…]`
needs no guard (the digraph is unambiguous and glues after a word, Markdown-style). The
element forms themselves are charset-free (`@Label[id: "…"]` accepts any string, including
`.`/Unicode); only the *sugar* is charset-restricted. The whole family is ambient (R20c) —
**no `%import` needed**.
```
<sec_intro>          → @Label[id: "sec_intro"]{}          // anchor; must close > on its line
<sec-intro>          → @Label[id: "sec-intro"]{}          // kebab label (the - is a continue char)
&sec-intro           → @Ref[id: "sec-intro"]{}            // kebab cross-reference
[^1]                 → @FootnoteMark[label: "1"]{}         // footnote reference (digit-start ok)
[^n1]: body          → @FootnoteText[label: "n1"]: body    // line-start definition (colon body)
&sec.  Vec<T>  <->   → Ref("sec") + "."  ; Vec<T> ; <->   // period / guard / start: literal tails
```
Repeated `[^n1]` references share one number and one list entry; the list auto-appends
at document end unless `@Footnotes` places it (R18d). The escapes `\<`, `\&`, `\[` yield
the literal characters via the standard escape machinery (`\[` already covered verbatim).
A multi-line footnote or one with block content uses the explicit `@FootnoteText{…}` form.

## Verbatim

A backslash escapes any character
(`` \@ \{ \} \| \$ \* \_ \: \[ \] \` ``) and itself, and is literal elsewhere.
A `|{ … }|` body is raw: sigils off, braces literal, ends at `}|`; the armed escape `|@` re-enters
Nota to produce element children. Raw text is emitted as a `String.raw` template so `\` and `{}`
survive. **Code and math spans share this same `|@`-armed content model** (contract R13) — the only
difference is the close (a scanned delimiter vs. `}|`), and there is no escape for a literal `|@`.
```
@code|{@foo{x}}|     → <code>{String.raw`@foo{x}`}</code>   // @ and { } are literal
@code|{
def f(x):
    return |@hl{x}
}|
→ <code>{String.raw`def f(x):
    return `}<hl>x</hl></code>
```

`[props]` groups compose with a verbatim body exactly as they do with a braced one (contract
R19): they accumulate ahead of the same `|{…}|` delimiter that would otherwise sit directly against
the head.
```
@CodeBlock[lang: "python"]|{f(x)}|   → <CodeBlock lang="python">{String.raw`f(x)`}</CodeBlock>
```

## Math

`$…$` is inline; **display math is the fence form** — a standalone `$$` line, TeX body lines, and a
closing `$$` line (a run of ≥2 dollars whose opener-line tail is whitespace-only). Both lower to an
ambient `<Tex>` (`display` set for the fence), resolved from the prelude — the default renders
KaTeX→MathML, and the binding is a registry slot users can override (contract R14). The name is
`Tex`, not `Math`: an ambient `Math` would capture the JS global in embedded code.
Content is raw LaTeX (`String.raw`) under the **unified raw-span model** ([contract R13](contract.md)):
raw runs interleaved with `|@`-armed `@`-forms. A bare `@` is **literal** — there is no direct
interpolation; only `|@` re-enters Nota, spliced as a *sibling* (not a `${…}` substitution).

Dollar spans mirror backtick spans: an opening run of N dollars closes at the next same-line run of
≥N dollars (shorter runs are content). So `$$…$$` **inside a paragraph** (a nonempty opener tail) is
inline math with run-2 delimiters, **not** display. The one divergence from backticks is the TeX
escape: the dollar close scan skips `\<c>` pairs, so `\$` stays content and the backslash is kept
(LaTeX's own escape). Inline `$` is clamped to its line (contract R11) — no same-line close → the
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
and share the same **unified raw-span model** as math and verbatim: raw runs interleaved with
`|@`-armed `@`-forms (a bare `@` is literal). Backtick runs shorter than the closing fence are
literal; inline code is clamped to its line (contract R11) — the close run must sit on the opening
line, else the run is literal, so ``- `foo⏎- bar` `` is two bullets, not one bullet holding a code
span.
````
`@x`                → <CodeInline>{String.raw`@x`}</CodeInline>    // @ is literal
`a |@em{x} b`       → <CodeInline>{String.raw`a `}<em>x</em>{String.raw` b`}</CodeInline>
```python⏎f(x)⏎```  → <CodeBlock lang="python">{String.raw`f(x)`}</CodeBlock>
````

## Whitespace

Follows Scribble's reader. Per body line, leading/trailing spaces are dropped, except between
`{` and text or text and `}`; a single newline right after `{` or before `}` is dropped (unless
the body is only newlines); interior newlines become individual `"\n"`; common indentation is
stripped, indentation beyond the leftmost line is kept. Codegen emits whitespace-significant
text as explicit `{"…"}` children.
```
@foo{·bar·}                  → ⟦ "·bar·" ⟧
@foo{⏎··bar⏎}                → ⟦ "bar" ⟧
@foo{⏎··begin⏎····x⏎··end}   → ⟦ "begin", "⏎", "··x", "⏎", "end" ⟧
```
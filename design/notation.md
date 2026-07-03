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
`@(expr){…}` uses the expression as the tag. It desugars through a fresh, component-cased binding
scoped to just this element (so JSX treats it as a component, not a host string)
```
@(getTag()){hi}        → (() => { const _Tag = getTag(); return <_Tag>hi</_Tag>; })()
@(comps[k])[x:1]{hi}   → (() => { const _Tag = comps[k]; return <_Tag x={1}>hi</_Tag>; })()
```
A head already valid as a JSX tag — a capitalized identifier or a member expression — is emitted
directly, without the binding: `@(Box){hi}` → `<Box>hi</Box>`, `@(ui.Card){hi}` → `<ui.Card>hi</ui.Card>`.

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
inline content and an indented continuation combine. `:` is an element trigger like `{`/`[`: `@foo`
interpolates, but `@foo:` is an element (write a literal colon as `@foo\:`). Leading
`|` lines of the body supply the `[…]` props (multiple accumulate, `[…]`-syntax).
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
an IIFE. `Doc` (and the nested-`%` IIFE) is emitted **synchronous** — the reader does not
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

### Emphasis
`*…*` → `@strong{…}`, `_…_` → `@em{…}`; bodies nest markup like any element.
Following Typst, a marker opens only at a left word boundary and closes only at a
right one, so intra-word `*`/`_` are literal without escaping.
```
*bold*           → <strong>bold</strong>
_italic_         → <em>italic</em>
*a _b_ c*        → <strong>a <em>b</em> c</strong>
my_var_name      → my_var_name                  // intra-word: literal
```

### Headings
A line opening with a run of 1–6 `#` followed by a space → `@h{n}{rest of line}`,
where `n` is the run length. The body is the rest of the line and nests markup.
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

## Verbatim

A backslash escapes any character
(`` \@ \{ \} \| \$ \* \_ \: \[ \] \` ``) and itself, and is literal elsewhere.
A `|{ … }|` body is raw: sigils off, braces literal, ends at `}|`; the armed escape `|@` re-enters
Nota to produce element children. Raw text is emitted as a `String.raw` template so `\` and `{}`
survive.
```
@code|{@foo{x}}|     → <code>{String.raw`@foo{x}`}</code>   // @ and { } are literal
@code|{
def f(x):
    return |@hl{x}
}|
→ <code>{String.raw`def f(x):
    return `}<hl>x</hl></code>
```

## Math

`$…$` is inline, `$$…$$` is display; both lower to an ambient `<Math>` (resolved from the
prelude, e.g. KaTeX/MathJax). Content is raw LaTeX (`String.raw`); `@` interpolates a string
value; `\$` / `\@` are literal (the backslash is kept — it's LaTeX's own escape).
```
$a_@i$            → <Math>{String.raw`a_${i}`}</Math>
$$⏎\sum_@n x⏎$$   → <Math display>{String.raw`\sum_${n} x`}</Math>
```

## Code

`` `…` `` is inline code; ```` ```lang⏎…⏎``` ```` is fenced, with an optional language tag on the
opening line. Both are raw (`String.raw`), lowering to ambient `<CodeInline>` / `<CodeBlock>`;
backtick runs shorter than the closing fence are literal.
````
`@x`                → <CodeInline>{String.raw`@x`}</CodeInline>
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
# TODO — Nota reader bugs

Bugs in the Nota reader observed while writing the feature mega-test (`integration/mega.nota`).
All repros verified against the built reader example:

```sh
cd oxc && cargo run -q -p oxc --example nota_compile --features codegen -- <file.nota>
```

> ⚠️ The `oxc` tree (branch `refactor`) was mid-refactor (adding a `NotaMarkup` AST node) and did
> not rebuild when these were filed; verification used the last-built binary
> (`oxc/target/debug/examples/nota_compile`). Recompiling `integration/mega.nota` after the refactor
> builds is the regression check — bugs 1–4 are exposed there in ~5 spots; the doc still emits valid JS.

---

## 1. Self-closing element with props + following content loses text

A `@tag[props]` with no body (self-closing) followed by any later content drops a span of that content.

```
@input[type:"text"] and more text
→ h("input", { type: "text" }, []), " more text"          // "and" dropped

@hr[class:"rule"]   (blank line)   After.
→ h("hr", { class: "rule" }, []), "."                      // "After" dropped
```

Data loss. Only the EOF form (`@hr[class:c]` at end of input, the only fixture) and the explicit
empty-body form (`@input[...]{}`) are safe. **Expected:** following text preserved verbatim.

---

## 2. Line-start sugar not detected immediately after a block construct

`#` headings and `-`/`+`/`N.` list markers are not recognized on the line right after a `%%%` fence,
a list, or a `@head:` colon-block. A plain paragraph line in between fixes it; they also work at
offset 0 and after ordinary paragraph text.

```
%%% … %%%   then   # Title        → "# Title"      (literal, not <h1>)
- a / - b   then   # After        → "# After"      (literal)
@head: …    then   ## Section      → "## Section"   (literal)
```

Root cause looks like line-start detection only fires from `collect_markup`'s `\n` arm and at
document-body offset 0 — block constructs resume via a different seek path that skips it.
**Expected:** sugar recognized at the start of any line, regardless of the preceding construct.

---

## 3. List multi-line item bodies only work under the *first* item of a run

Nesting and continuation lines attach only to the first item of a list run; on any later item the
extra lines leak out as flat siblings.

```
- a / - b /   - c          → "c" becomes a flat nota-ul-li sibling, not nested under "b"
- a / - b with /   cont     → "  cont" leaks as a sibling string, not part of "b"
- a /   - b /   - c         → works: b, c nest under a (the first item)
```

**Expected:** any item's body continues on lines indented past its marker (the `@head:` block-sugar
rule), and a deeper marker nests under whichever item precedes it.

---

## 4. (minor) Stray leading indent child in colon-block / nested-`%` bodies

Colon-block and nested-`%` bodies keep a leading `"  "` whitespace child — a common-indent-strip
artifact, not data loss.

```
@section:
  | class: "tip"
  A block-sugar body …
→ h("section", { class: "tip" }, ["  A block-sugar body …", …])    // stray "  "
```

**Expected:** common indentation stripped (no leading `"  "` child).

---

## 5. Consecutive single-`%` statements are a hard parse error

Two `%` statement lines in a row, where the first ends in an expression, parse the second line's `%`
as a JS modulo operator.

```
% const a = 1
% const b = 2
→ parse error: `const a = 1 % const` ("Unexpected token")
```

Workaround (used in `mega.nota`): put multiple statements in one `%%%` fence. The documented
two-line example (`% import …` / `% const x = await …` / `@h1{…}`) only works by luck — `import`
can't be followed by `%`, and the trailing `@h1` ends the `const`. **Expected:** a newline ends a
`%` statement; the next line's leading `%` starts a new statement, never a modulo.

# TODO — Nota reader bugs

The five reader bugs originally filed here (observed while writing `integration/mega.nota`) are all
**fixed**, each with a regression test. Verify against the built reader example:

```sh
cd oxc && cargo run -q -p oxc --example nota_compile --features codegen -- <file.nota>
```

| # | Bug | Status | Regression test (`oxc/crates/oxc_codegen/tests/integration/nota.rs`) |
|---|-----|--------|----------------------------------------------------------------------|
| 1 | Self-closing `@tag[props]` + following content loses text | fixed | `fuzz2_self_closing_props_should_not_drop_following_text` |
| 2 | Line-start sugar (`#`/lists) not detected right after a `%%%` fence / list / colon-block | fixed | `line_start_sugar_chains_after_a_construct`, `fuzz2_colon_block_should_recognize_line_start_sugar` |
| 3 | List nesting / continuation attaches only to the *first* item of a run | fixed | `fuzz2_nested_list_dedent_should_not_duplicate`, `list_continuation_line` |
| 4 | Stray leading-indent child in colon-block / nested-`%` bodies | fixed | `colon_sugar_props_line_should_not_break_dedent` |
| 5 | Consecutive single-`%` statements are a hard parse error | fixed | `fuzz2_consecutive_percent_statements_should_parse` |

Bug 2 and 3 stemmed from the same line-start-sugar/indent machinery: the `\n` arm and the document
start now consume a *run* of line-start constructs (each resumes at a line start that may open the
next), and `list_marker_at` reports indentation *depth* rather than a byte offset so a dedented
sibling is no longer kept inside an inner list. Bug 5 is fixed by bounding the JS parse of a `%`
statement to the next line-leading `%` (a statement delimiter the lexer would otherwise read as
modulo) — the bound scan is now `statement_bound`, which per contract R8 also stops at a blank
line (bug 6).

## Remaining known gaps

The still-open reader gaps are tracked as `#[ignore]`d specs in the `fuzz_findings_2` module of
`integration/nota.rs` (each `#[ignore]` reason states the blocker). They are deferred **product
calls** — support-vs-diagnose decisions, not clear correctness bugs: `@else` (sigil), `await` inside a
`@for` body, `@for(const x of …)`, a `%%` run, `@p[:]`, and `@br{children}` (void element).

The `@p[:]` gap (an element with a `[props]` group *and* a colon body) is also what blocks the
**explicit** doc-state definition form `@FootnoteText[label: "x"]: body` (contract R20a/b): it hits the
same `@head[props]:` non-composition, so the `[^x]: body` **sugar** is currently the only colon-body
surface for a footnote definition. A multi-line / block-content definition uses the braced
`@FootnoteText[label: "x"]{…}` form (props + braced body compose fine — R19); only the colon-body
props combination is affected.

## Reader bugs 6–7 (found 2026-07-02 while building the highlight pass — both fixed)

Both were in the line-start-sugar / statement-extent machinery (the bug-2/3 cluster):

| # | Bug | Status |
|---|-----|--------|
| 6 | A blank line did **not** terminate a single-`%` statement's JS parse (`% const x = 1⏎⏎# Head` hard-errored; `⏎⏎- item` **silently** emitted `const x = 1 - item;`), and same-line content after the first statement (`% a(); b();`, trailing text) was silently dropped. | **fixed** — contract R8: a `%` line opens a JS statement region (rest of line = JS statements, JS's own `;`/ASI, single-newline continuation per JS grammar) ending at end-of-line / a **blank line** (ASI as at EOF; straddling one is a diagnostic with a pointed note) / the next `%` line. Regressions: `percent_statement_region_rules` (e2e), `statement_bound` scan units, highlight-span case. |
| 7 | Line-start sugar (heading/list/`%`) right after a **colon-sugar** element was literal text: the colon body's extent consumes through its final `\n` (+ trailing blank lines), so the parse resumed *at* a line start — a position `collect_markup`'s `\n`-arm hook never sees (`@section:⏎  body⏎[⏎]# H` → `"# H"` as prose; mega's `## Nested statements`). | **fixed** — the `Kind::At` arm now runs `consume_line_start_constructs` when a form resumes at a line start; regression `line_start_sugar_after_a_colon_block` (e2e) + highlight-span + playground mega tests |

## R20a doc-state sugar warts (2026-07-05 — accepted, not bugs)

The `<x>` / `&x` / `[^x]` / `[^x]:` sugars ([contract R20a](design/contract.md)) carry two known
sharp edges, both deliberate:

- **(a) Trailing punctuation glues into the ident.** The ident charset is contract-exact
  (`[A-Za-z_][A-Za-z0-9_.:-]*`), and `.`/`:`/`-` are *interior* legal characters, so `&sec-intro.` at
  a sentence end reads the id as `sec-intro.` (dot included), not `sec-intro`. Trimming trailing
  `.`/`:`/`-` would be a **contract amendment** to the charset (they are legal mid-ident: `sec.intro`,
  `fig:1`, `a-b`), so it is left as-is; author `&(sec-intro).` semantics by escaping or rephrasing.
  Same for `<x>` (closes on `>`, so unaffected) and `[^x]` (closes on `]`, unaffected) — the glue only
  bites the delimiter-less `&x`.
- **(b) The explicit element colon form does not compose** — `@FootnoteText[label: "x"]: body` hits
  the `@head[props]:` gap (see *Remaining known gaps* above), so the `[^x]: body` sugar is the only
  colon-body definition surface. Not a regression: the braced `@FootnoteText[label: "x"]{…}` form
  composes fine for multi-line / block definitions.

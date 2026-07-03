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
modulo) — see `oxc_parser` `Source::set_end_offset`.

## Remaining known gaps

The still-open reader gaps are tracked as `#[ignore]`d specs in the `fuzz_findings_2` module of
`integration/nota.rs` (each `#[ignore]` reason states the blocker). They are deferred **product
calls** — support-vs-diagnose decisions, not clear correctness bugs: `@else` (sigil), `await` inside a
`@for` body, `@for(const x of …)`, a `%%` run, `@p[:]`, and `@br{children}` (void element).

## Open reader bugs (found 2026-07-02 while building the highlight pass)

Both are in the line-start-sugar / statement-extent machinery (the bug-2/3 cluster). Repro with
`cargo run -q -p oxc --example nota_compile --features codegen -- <f>.nota`:

| # | Bug | Status |
|---|-----|--------|
| 6 | A blank line does **not** terminate a single-`%` statement's JS parse: `% const x = 1⏎⏎# Head` hard-errors (the JS lexer reads the `#`); worse, `% const x = 1⏎⏎- item` **silently** emits `const x = 1 - item;`. The statement's bound is the next line-leading `%` or EOF (`next_percent_line_or_end`), so the JS parse runs across the blank line into the sugar. Expected per notation.md: continuation = indented lines only; a blank line ends the statement. `%%%` fences are unaffected. Note the fix must not clamp the golden's `%let X = inlineComponent(… ⏎})` shape, whose closing `})` is *unindented* — the workable rule is "a blank line ends the statement unless the next non-blank line is indented past the `%` line". | **open** |
| 7 | Line-start sugar (heading/list/`%`) right after a **colon-sugar** element was literal text: the colon body's extent consumes through its final `\n` (+ trailing blank lines), so the parse resumed *at* a line start — a position `collect_markup`'s `\n`-arm hook never sees (`@section:⏎  body⏎[⏎]# H` → `"# H"` as prose; mega's `## Nested statements`). | **fixed** — the `Kind::At` arm now runs `consume_line_start_constructs` when a form resumes at a line start; regression `line_start_sugar_after_a_colon_block` (e2e) + highlight-span + playground mega tests |

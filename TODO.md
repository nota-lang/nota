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

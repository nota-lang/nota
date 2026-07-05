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
`@for` body, `@for(const x of …)`, a `%%` run, and `@br{children}` (void element).

The `@p[:]` gap (an element with a `[props]` group *and* a colon body) is **resolved by contract R21**:
`@head[props]*: body` now composes — the identical R12 gate as bare `@head:`, props threaded through.
This also unblocks the **explicit** doc-state definition form `@FootnoteText[label: "x"]: body`
(contract R20a/b), so a footnote definition now has *both* colon-body surfaces (the `[^x]: body` sugar
and the element form) alongside the braced `@FootnoteText[label: "x"]{…}` form (R19).

## Reader bugs 6–7 (found 2026-07-02 while building the highlight pass — both fixed)

Both were in the line-start-sugar / statement-extent machinery (the bug-2/3 cluster):

| # | Bug | Status |
|---|-----|--------|
| 6 | A blank line did **not** terminate a single-`%` statement's JS parse (`% const x = 1⏎⏎# Head` hard-errored; `⏎⏎- item` **silently** emitted `const x = 1 - item;`), and same-line content after the first statement (`% a(); b();`, trailing text) was silently dropped. | **fixed** — contract R8: a `%` line opens a JS statement region (rest of line = JS statements, JS's own `;`/ASI, single-newline continuation per JS grammar) ending at end-of-line / a **blank line** (ASI as at EOF; straddling one is a diagnostic with a pointed note) / the next `%` line. Regressions: `percent_statement_region_rules` (e2e), `statement_bound` scan units, highlight-span case. |
| 7 | Line-start sugar (heading/list/`%`) right after a **colon-sugar** element was literal text: the colon body's extent consumes through its final `\n` (+ trailing blank lines), so the parse resumed *at* a line start — a position `collect_markup`'s `\n`-arm hook never sees (`@section:⏎  body⏎[⏎]# H` → `"# H"` as prose; mega's `## Nested statements`). | **fixed** — the `Kind::At` arm now runs `consume_line_start_constructs` when a form resumes at a line start; regression `line_start_sugar_after_a_colon_block` (e2e) + highlight-span + playground mega tests |

## R20a doc-state sugar warts (2026-07-05 — RESOLVED)

The two sharp edges the `<x>` / `&x` / `[^x]` / `[^x]:` sugars ([contract R20a](design/contract.md))
once carried are both now dissolved:

- **(a) Trailing punctuation glue — resolved by the R20a charset amendment (2026-07-05).** The ident
  charset is now a JS **IdentifierName** (oxc's own `is_identifier_start`/`is_identifier_part`; `$` and
  Unicode ID chars legal, but `.`/`:`/`-` are **not** ident chars). So `&sec.` at a sentence end reads
  the id as `sec` and leaves the `.` literal — the trailing-glue wart is structurally gone, not merely
  trimmed. (`<x>` closes on `>` and `[^x]` closes on `]`, so both were always unaffected; the glue only
  ever bit the delimiter-less `&x`.) A former mid-ident case like `sec-intro` is now two tokens
  (`Ref("sec")` + literal `-intro`), and `<sec-intro>` is literal text (the `-` breaks the ident before
  `>`) — use `sec_intro` for a JS-ident label.
- **(b) The explicit element colon form — resolved by contract R21 (2026-07-05).**
  `@FootnoteText[label: "x"]: body` now composes (`@head[props]*: body`, the same R12 gate as bare
  `@head:`), so the element form joins the `[^x]: body` sugar as a colon-body definition surface (both
  alongside the braced `@FootnoteText[label: "x"]{…}` form).

## Reader bug 8 (found 2026-07-05 integrating R20a/R21 — fixed)

| # | Bug | Status |
|---|-----|--------|
| 8 | A line-start construct right after a `[^x]: body` footnote-definition **sugar** was swallowed as literal text (`[^a]: def⏎⏎## H` → `"## H"` as prose). The bug-7 family: the definition reuses the colon-body extent machinery (consumes through trailing blank lines → resumes AT a line start), but the bug-7 hook lived only in the `Kind::At` arm — the `LBrack` doc-state arm missed it. The explicit `@FootnoteText[label]: body` element form and all `@head:`/`@head[props]:` colon blocks were unaffected. | **fixed** (oxc `1aff98dd9`) — hook extracted to `consume_line_start_after_form`, called from both the `At` and `LBrack` arms; regression `line_start_constructs_resume_after_footnote_def_sugar`. `integration/mega.nota` now exercises the pattern (mid-document `[^n1]:`/`[^n2]:` defs directly followed by a `##` heading). |

## Open: wasm `highlight()` panic on multibyte chars in a large document (found 2026-07-05)

The wasm `highlight()` entry can hit a **heap-corruption panic** (`dlmalloc` assertion →
`unreachable`) when the source contains a multibyte UTF-8 char (observed with an em-dash `—`) in a
sufficiently large document — intermittent on small inputs, deterministic (0/40 runs) on the full
`integration/mega.nota` + one em-dash. Smells like a byte-offset-vs-char confusion in the highlight
pass. Repro recipe: add any multibyte char to a large `.nota` and call the wasm `highlight()` in a
loop. The native path has not been observed to panic — but the offset bug, if real, is shared logic;
audit `oxc_parser/src/nota/highlight.rs` span arithmetic first. `integration/mega.nota` is kept pure
ASCII until this is fixed.

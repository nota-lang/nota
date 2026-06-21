/**
 * The editor's seed document — a clean showcase of Nota markup + the pipeline.
 *
 * Deliberately NOT `GOLDEN_NOTA`: the golden defines an inline component
 * (`%let X = inlineComponent((c) => { …@span… })`), which nests markup inside a *multi-line* host-code
 * block — the one shape the TextMate grammar can't track (the body tokenizes as embedded TS and the
 * inner `@`-markup falls back to plain text). That's fine for the parity fixture but reads as broken
 * in the editor. So the seed uses only constructs that highlight cleanly: a heading, prose with inline
 * elements, an element with props, a single-line `%` statement, and a `@for` loop. Keep it compiling —
 * `tests/panes.test.ts` guards that (a non-compiling seed would greet every visitor with an error).
 */
export const DEFAULT_SNIPPET = `# Hello, Nota

Nota is markup that lowers to hyperscript. Write @em{prose}, nest
@strong{elements}, and link to @a[href: "https://nota-lang.org"]{the site}.

%let langs = ["Rust", "TypeScript", "Nota"]

@for (lang of langs) {
  - @strong{@lang}
}
`;

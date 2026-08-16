/**
 * The editor's seed document — a clean showcase of Nota markup + the pipeline.
 *
 * Deliberately NOT `GOLDEN_NOTA`: the golden is the pipeline e2e fixture (a stateful inline
 * component), while the seed is a first-contact tour — a heading, prose with inline elements, an
 * element with props, a `%` statement, and a `@for` loop. (A historical reason is gone: the golden's
 * markup-inside-`%`-code shape used to break the TextMate-grammar highlighter; the reader-driven
 * highlighting in `@nota-lang/codemirror` handles it faithfully.) Keep it compiling — `tests/panes.test.ts`
 * guards that (a non-compiling seed would greet every visitor with an error).
 */
export const DEFAULT_SNIPPET = `# Hello, Nota

Nota is markup that compiles to a Solid component. Write @em{prose}, nest
@strong{elements}, and link to @a[href: "https://nota-lang.org"]{the site}.

%let langs = ["Rust", "TypeScript", "Nota"]

@for (lang of langs) {
  - @strong{@lang}
}
`;

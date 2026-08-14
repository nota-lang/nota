/**
 * `@nota-lang/paper` — academic-paper constructs over `@nota-lang/prelude`'s doc-state machinery.
 *
 * Three focused modules, all plain static templates (no islands):
 *
 * - `./language` — the Language/BNF DSL: {@link language} turns a grammar spec into TeX-producing
 *   handles (metavariables and filled forms, each texRef-wired to its kind's grammar rows) plus a
 *   `Bnf` table component (one `Definition`-anchored KaTeX array block per kind, feeding the
 *   prelude's tooltip bank);
 * - `./ir` — inference rules: {@link inferRule} (KaTeX-legal `\dfrac` TeX with `\quad`-joined,
 *   optionally row-chunked premises and a small-caps name) and the {@link IR} component;
 * - `./scaffold` — front matter and layout: {@link Title} (a raw `h1` — unnumbered, un-TOC'd),
 *   the author block, {@link Abstract}, {@link Smallcaps}, {@link Wrap}/{@link Row}/{@link Center},
 *   and counter-numbered {@link Figure}/{@link Subfigure}/{@link Caption} with `&id` references
 *   resolving to "Figure N" via definition label queries.
 *
 * Ship the look with the package stylesheet: `import "@nota-lang/paper/paper.css"`. For clickable
 * math references (`texRef` inside `language` handles) set `mathset({ output: "html" })` site-wide.
 */

export { type InferRuleOptions, IR, inferRule } from "./ir.js";
export {
  type FormSpec,
  type KindSpec,
  type Language,
  type LanguageHandles,
  type LanguageSpec,
  language
} from "./language.js";
export {
  Abstract,
  Affiliation,
  Author,
  Authors,
  Caption,
  Center,
  Figure,
  Institution,
  Name,
  Row,
  Smallcaps,
  Subfigure,
  Title,
  Wrap
} from "./scaffold.js";

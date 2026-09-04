/**
 * The `?bib` import: a BibTeX file read into a JSON module. See {@link parseBib}.
 *
 * The parse is `@orcid/bibtex-parse-js`, which is a BibTeX-level parser and nothing more. It
 * reads the grammar — `@type{key, field = value}` entries, brace/quote/`#`-concatenated values,
 * `%` comments — and hands the field text back verbatim. It does not interpret TeX, so `{\"o}`
 * stays `{\"o}` and `--` stays `--`: a renderer that wants glyphs has to do that itself. The
 * normalization below is BibTeX's own rules only (see {@link normalizeValue}).
 */

import type { BibsetOptions } from "@nota-lang/prelude";
import bibtexParse, { type RawBibtexEntry } from "@orcid/bibtex-parse-js";

/** One entry of a `?bib` module: what kind of thing it is, then its fields. */
export interface BibtexEntry {
  /** The entry type, lower-cased: `@InProceedings{…}` → `"inproceedings"`. */
  entryType: string;
  /**
   * The entry's fields, names lower-cased — BibTeX matches field names case-insensitively, so
   * `Author`, `AUTHOR` and `author` all arrive as `author`. No field can shadow `entryType`,
   * since a field spelled that way lower-cases to `entrytype`.
   */
  [field: string]: string | undefined;

  /**
   * BibTeX's standard fields, named rather than left to the index signature above.
   *
   * Partly for completion on the fields that actually exist, but load-bearing for the reason
   * {@link BibDatabase} gives: the prelude's `BibEntry` has no required property, and TypeScript
   * will not accept an object with *nothing* declared in common with a target like that, however
   * permissive its index signature. Naming these is what makes `bibset({ src: bib })` typecheck.
   *
   * Not exhaustive, and does not need to be — `.bib` files carry whatever fields their style
   * wants, and the index signature is what actually types them. `url` and `doi` are not in
   * BibTeX 0.99 either, but every modern style reads them.
   */
  address?: string;
  annote?: string;
  author?: string;
  booktitle?: string;
  chapter?: string;
  crossref?: string;
  doi?: string;
  edition?: string;
  editor?: string;
  howpublished?: string;
  institution?: string;
  journal?: string;
  key?: string;
  month?: string;
  note?: string;
  number?: string;
  organization?: string;
  pages?: string;
  publisher?: string;
  school?: string;
  series?: string;
  title?: string;
  /** The *field* named `type` (a thesis's kind, say) — not {@link BibtexEntry.entryType}. */
  type?: string;
  url?: string;
  volume?: string;
  year?: string;
}

/**
 * A parsed `.bib` file: its entries by cite key. The default export of a `?bib` module.
 *
 * Keyed by cite key, and with the fields sitting directly on each entry, because that is the
 * shape the prelude's citation source already has — `bibset({ src: bib })` takes this as it
 * comes, reading the `author`/`title`/`year`/`url` fields it knows and ignoring the rest.
 *
 * Cite keys keep the case they were written in. Real BibTeX folds them, but a Nota citation
 * (`@Cite{knuth84}`, `&knuth84`) resolves against `bibset`'s keys by exact match, so folding
 * here would silently break the entries it renamed.
 */
export type BibDatabase = Record<string, BibtexEntry>;

/**
 * The compatibility {@link BibDatabase} claims, checked instead of merely asserted in prose: a
 * parsed database is a citation source `bibset` takes as-is. Fails the build if either side
 * drifts — a standard field dropped from {@link BibtexEntry}, a required property added to the
 * prelude's `BibEntry` — rather than at the call site in somebody's document.
 */
type AssertBibsetSource<T extends NonNullable<BibsetOptions["src"]>> = T;
type _BibsetCompatible = AssertBibsetSource<BibDatabase>;

/**
 * The characters BibTeX ends a cite key on, so a key can contain none of them.
 *
 * Worth checking, because the parser *invents* a key for an entry that lacks one: a keyless
 * `@book{title = {…}}` comes back filed under `"<first author>, <year>"`. An entry under a
 * made-up key is a citation that will never resolve, reported nowhere near the `.bib` file that
 * caused it, so it is better caught here. The invented key holds a comma and a space, which
 * this rejects — though not every variant of it: an entry with no author *and* no key is filed
 * under its year alone, and that is indistinguishable from having been written that way.
 */
const CITE_KEY = /^[^\s,{}=]+$/;

/**
 * A field's text, as a bibliography would show it. Two BibTeX-level rules, no TeX ones.
 *
 * Unescaped braces are grouping markers rather than content — they protect case against
 * BibTeX's own title-casing (`The {TeX}book`) and hold a corporate name together
 * (`{ACM SIGPLAN}`) — so they come out. `\{` is the escaped literal and stays, backslash and
 * all, along with every other TeX escape.
 *
 * And a value may wrap across lines with whatever indentation reads well in the file
 * (`author = {Donald E.\n            Knuth}`), which is not indentation the bibliography wants,
 * so runs of whitespace collapse to a single space.
 */
function normalizeValue(value: string): string {
  return value
    .replace(/\\[\s\S]|[{}]/g, m => (m.length > 1 ? m : ""))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Why a parse failed, in a form worth printing.
 *
 * The parser's own reporting needs the help. One path throws a bare string rather than an
 * error; the rest construct `TypeError(message, detail)`, where the second argument is an
 * options bag and not a message, so every detail it meant to attach is dropped. The two
 * failures below say nothing at all about BibTeX as they come, so they get rewritten.
 */
function parseFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // `@string` reaches a branch that was never implemented, and fails as a missing method.
  if (/this\.string is not a function/.test(message)) {
    return (
      "@string macros are not supported by the BibTeX parser. Substitute the macro's value " +
      "into each entry that uses it."
    );
  }
  // A value the parser would not take, reported as its own internals plus the rest of the
  // input. What it can name is the offending token — `for key:` is the *value* it choked on,
  // not the field — and there are two ways to get here, with one remedy: an `@string` macro
  // used as a value, and, less obviously, a number or month macro that the parser reads only
  // when a comma or a space follows it, so a last field with no trailing comma fails.
  const bare = /^Value expected: single_value[\s\S]* for key: ([\s\S]*)$/.exec(
    message
  );
  if (bare) {
    const value = bare[1].trim();
    return (
      `${JSON.stringify(value)} is not a value the parser reads. Unbraced, it takes only a ` +
      "number or a month macro, and only with a comma or a space after it rather than a line " +
      `break; @string macros it does not take at all. Braces always work: {${value}}`
    );
  }
  return message;
}

/**
 * Parse `source` as BibTeX. `sourcePath` names the file in error messages and nothing else.
 *
 * Throws on anything that would otherwise become a citation that silently fails to resolve: a
 * syntax error, an entry the parser had to invent a key for, or two entries claiming one key.
 */
export function parseBib(source: string, sourcePath: string): BibDatabase {
  let parsed: RawBibtexEntry[];
  try {
    parsed = bibtexParse.toJSON(source);
  } catch (err) {
    throw new Error(
      `failed to parse ${sourcePath} as BibTeX: ${parseFailure(err)}`
    );
  }

  // Built through a Map, and each entry through `fromEntries`, so that a field or key named
  // `__proto__` lands as an ordinary property instead of reaching the prototype setter.
  const entries = new Map<string, BibtexEntry>();
  for (const raw of parsed) {
    // `@preamble`/`@comment` carry a body and no fields. Neither is citable — drop them.
    if (!raw.entryTags) {
      continue;
    }
    const type = raw.entryType.toLowerCase();
    const key = raw.citationKey ?? "";
    if (!CITE_KEY.test(key)) {
      throw new Error(
        `${sourcePath}: a @${type} entry has no cite key, so the BibTeX parser made one up ` +
          `(${JSON.stringify(key)}). Give it one: @${type}{somekey, …}`
      );
    }
    if (entries.has(key)) {
      throw new Error(
        `${sourcePath}: two entries share the cite key ${JSON.stringify(key)}. Keys index the ` +
          `bibliography, so one of the two would be unreachable.`
      );
    }
    entries.set(
      key,
      Object.fromEntries([
        ["entryType", type],
        ...Object.entries(raw.entryTags).map(([field, value]) => [
          field.toLowerCase(),
          normalizeValue(value)
        ])
      ]) as BibtexEntry
    );
  }
  return Object.fromEntries(entries);
}

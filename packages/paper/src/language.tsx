/**
 * The Language/BNF DSL — define a formal grammar *once* and get, per production, TeX-producing
 * functions plus a rendered BNF table, all wired into the prelude's definition-tooltip system.
 *
 * `language(spec)` returns handles: for each **kind** `k` a string (its metavariable TeX wrapped
 * in {@link texRef}`("gram-" + k, meta)`), and for each **form** `f` a function
 * `(...args) => texRef("gram-" + k, tex(...args))` — so `$|@(L.sessty)$` renders σ as a clickable
 * reference to the kind's grammar rows, and `$|@(L.arrow(a, b))$` likewise for a filled form.
 *
 * `L.Bnf` renders the grammar itself: one `Definition` block per kind (anchor id `gram-<kind>`),
 * each containing that kind's rows as a KaTeX display `\begin{array}{llcll}` — passed twice:
 * as the definition's body (the anchored table) and as its explicit `tooltip` (the bank entry a
 * reference pops). **Inside the table nothing is texRef-wrapped** — the table is the definition
 * *site* — so `Bnf` (and `sig` resolution within it) uses a parallel set of *plain* handles.
 *
 * Note `texRef` needs KaTeX HTML output for the `\htmlData` attribute to survive — set
 * `mathset({ output: "html" })` site-wide (see the prelude docs).
 */

import { Definition, Tex, texRef } from "@nota-lang/prelude";
import type { JSX } from "solid-js";

/** One production of a kind. */
export interface FormSpec {
  /** Fill the form's TeX given argument TeX strings. */
  tex: (...args: string[]) => string;
  /**
   * The argument metavariables for the BNF display: handles resolved against the language
   * (e.g. `l => [l.ty, l.sessty]`). Default `[]`.
   */
  sig?: (lang: LanguageHandles) => string[];
  /** Right-column description in the BNF table (plain text; TeX specials are escaped). */
  desc?: string;
}

/** One syntactic kind (a nonterminal) with its productions. */
export interface KindSpec {
  /** Human name shown in the BNF left column, e.g. "Session type". */
  name: string;
  /** The metavariable TeX, e.g. "\\sigma". */
  meta: string;
  /** The productions. Key = form command name. */
  forms?: Record<string, FormSpec>;
}

/** A whole grammar. Key = kind command name, e.g. "sessty". */
export type LanguageSpec = Record<string, KindSpec>;

// biome-ignore lint/suspicious/noExplicitAny: handles are heterogeneous (string metas + form fns); `any` keeps `sig` call sites terse
export type LanguageHandles = Record<string, any>;

/** The result of {@link language}: kind/form handles plus the `Bnf` table component. */
export type Language = LanguageHandles & {
  Bnf: () => JSX.Element;
};

/**
 * Escape TeX specials in a plain-text BNF description so it is safe inside `\text{…}`.
 * `\ { } % # $ & _ ^ ~` are covered (the letter-named replacements get a trailing space so a
 * following word does not glue onto the command name).
 */
function escapeText(s: string): string {
  return s.replace(/[\\{}%#$&_^~]/g, ch => {
    switch (ch) {
      case "\\":
        return "\\textbackslash ";
      case "^":
        return "\\textasciicircum ";
      case "~":
        return "\\textasciitilde ";
      default:
        return `\\${ch}`;
    }
  });
}

/** The BNF rows for one kind, as the body of a `\begin{array}{llcll}` display block. */
function kindRows(kind: KindSpec, plainHandles: LanguageHandles): string {
  const forms = Object.entries(kind.forms ?? {});
  const rows: string[] = [];
  if (forms.length === 0) {
    rows.push(`\\text{${escapeText(kind.name)}} & ${kind.meta} & & & `);
  } else {
    forms.forEach(([, form], i) => {
      const args = form.sig !== undefined ? form.sig(plainHandles) : [];
      const display = form.tex(...args);
      const desc =
        form.desc !== undefined ? `\\text{${escapeText(form.desc)}}` : "";
      rows.push(
        i === 0
          ? `\\text{${escapeText(kind.name)}} & ${kind.meta} & ::= & ${display} & ${desc}`
          : ` & & \\mid & ${display} & ${desc}`
      );
    });
  }
  return `\\begin{array}{llcll}${rows.join(" \\\\ ")}\\end{array}`;
}

/**
 * Build a {@link Language} from a {@link LanguageSpec} (see the module docs). A form name that
 * collides with a kind name or another form name is a pointed error at `language()` time.
 */
export function language(spec: LanguageSpec): Language {
  const owner = new Map<string, string>();
  for (const k of Object.keys(spec)) {
    owner.set(k, `kind "${k}"`);
  }
  for (const [k, kind] of Object.entries(spec)) {
    for (const f of Object.keys(kind.forms ?? {})) {
      const prior = owner.get(f);
      if (prior !== undefined) {
        throw new Error(
          `language(): form "${f}" of kind "${k}" collides with ${prior} — every kind and form name must be unique`
        );
      }
      owner.set(f, `form "${f}" of kind "${k}"`);
    }
  }

  const refHandles: LanguageHandles = {};
  const plainHandles: LanguageHandles = {};
  for (const [k, kind] of Object.entries(spec)) {
    refHandles[k] = texRef(`gram-${k}`, kind.meta);
    plainHandles[k] = kind.meta;
    for (const [f, form] of Object.entries(kind.forms ?? {})) {
      refHandles[f] = (...args: string[]): string =>
        texRef(`gram-${k}`, form.tex(...args));
      plainHandles[f] = (...args: string[]): string => form.tex(...args);
    }
  }

  const Bnf = (): JSX.Element => (
    <div class="nota-bnf">
      {Object.entries(spec).map(([k, kind]) => {
        const rows = kindRows(kind, plainHandles);
        return (
          <Definition
            id={`gram-${k}`}
            block
            tooltip={<Tex display>{rows}</Tex>}
          >
            <Tex display>{rows}</Tex>
          </Definition>
        );
      })}
    </div>
  );

  return { ...refHandles, Bnf };
}

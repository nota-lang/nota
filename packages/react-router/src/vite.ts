/**
 * `@nota-lang/react-router/vite` — put `.nota` files directly in your routes directory.
 *
 * With this plugin, a route in `routes.ts` can point straight at a document:
 *
 * ```ts
 * route("reference", "pages/reference.nota")
 * ```
 *
 * and the document carries its route surface idiomatically:
 *
 * ```
 * %%%
 * export let metadata = { title: "Nota Reference" };
 * export let handle = { bodyClass: "examples" };
 * %%%
 * ```
 *
 * The mechanism: `@nota-lang/vite` (enforce: "pre") compiles the `.nota` to the documented
 * document-mode emit, whose default export is `Doc` — an HTML-string producer, not a React
 * component. For ids matched by `include` (default: any `.nota` under a `/pages/` segment), this
 * transform rewrites that default into route-module shape:
 *
 * - `export default function Doc(` → `function Doc(` (the emit contract's stable prefix);
 * - appends a default export rendering `<NotaDoc doc={Doc} />`, an `export const meta` derived
 *   from the document's `metadata` (skipped if the document exports its own `meta`), and
 *   `export { Doc }` for out-of-band uses (feeds, `renderDoc`).
 *
 * Everything else the document `%export`s (`metadata`, `handle`, …) passes through as ordinary
 * route-module exports. Order the plugin BEFORE `reactRouter()` (and after `nota()`, which
 * `enforce: "pre"` already guarantees) so React Router sees the finished route module.
 */

import type { Plugin } from "vite";

/** Options for {@link notaRouteModules}. */
export interface NotaRouteModulesOptions {
  /**
   * Which `.nota` module ids are route modules (matched against the query-stripped path).
   * Default: any path containing a `/pages/` segment. Documents imported as plain modules
   * elsewhere must NOT match — the rewrite replaces their default export.
   */
  include?: (path: string) => boolean;
}

const DEFAULT_INCLUDE = (path: string) => /\/pages\//.test(path);

/** The emit contract's document wrapper (notation.md §Document mode). */
const DOC_EXPORT = /\bexport default function Doc\(/;

/** Does the compiled module already export its own `meta`? */
const OWN_META = /\bexport\s+(?:let|const|var|function)\s+meta\b/;

/** Turn a compiled `.nota` document module into a React Router route module (see module docs). */
export function notaRouteModules(
  options: NotaRouteModulesOptions = {}
): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE;
  return {
    name: "@nota-lang/react-router:route-modules",
    transform(code: string, id: string) {
      // A queried id (`?raw`/`?url`) never claims — the nota plugin passed it through as data,
      // so `code` would be raw source, not an emit.
      const [path, query] = id.split("?");
      if (!path.endsWith(".nota") || query !== undefined) return null;
      if (!include(path)) return null;
      if (!DOC_EXPORT.test(code)) return null;

      const rewritten = code.replace(DOC_EXPORT, "function Doc(");
      const ownMeta = OWN_META.test(code);
      const imports = ownMeta
        ? `;import { NotaDoc as __nota_NotaDoc } from "@nota-lang/react-router";`
        : `;import { NotaDoc as __nota_NotaDoc, docMeta as __nota_docMeta } from "@nota-lang/react-router";`;
      const metaGlue = ownMeta
        ? ""
        : `export const meta = __nota_docMeta(typeof metadata !== "undefined" ? metadata : {});\n`;
      const glue = `
${imports}
import { createElement as __nota_createElement } from "react";
export default function NotaRoute() {
  return __nota_createElement(__nota_NotaDoc, { doc: Doc });
}
${metaGlue}export { Doc };
`;
      return { code: rewritten + glue, map: null };
    }
  };
}

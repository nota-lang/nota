/**
 * Vite transform and Solid preset for `.nota` modules. See `design/solid.md`.
 *
 * The same transform also serves `?bib` imports — `import bib from "./refs.bib?bib"` reads a
 * BibTeX file into a JSON module, keyed for `bibset({ src: bib })`. See `./bib`.
 */

import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import {
  compile,
  DOC_EXPORT_NAME,
  FRAMEWORK_MODULES,
  FRAMEWORK_PACKAGES
} from "@nota-lang/compiler";
import type { Plugin } from "vite";
import viteSolid from "vite-plugin-solid";
import { parseBib } from "./bib.js";

export { type BibDatabase, type BibtexEntry, parseBib } from "./bib.js";

/** The default extension set, shared by the transform and the solid-preset config below. */
const DEFAULT_EXTENSIONS = [".nota"];
const packageRequire = createRequire(import.meta.url);

/** Options for the {@link nota} preset. */
export interface NotaPluginOptions {
  /**
   * File extensions this plugin compiles as documents (each with the leading dot). Defaults to
   * `[".nota"]`. An id is compiled iff it ends with one of these, after stripping any `?query`
   * suffix — independently of `?bib`, which is decided by the query and takes precedence.
   */
  extensions?: string[];
  /**
   * Module the ambient prelude bindings are imported from when the compiled module references
   * them free. Default `"@nota-lang/prelude"`; `false` disables the injection (the integrator
   * supplies the ambient names another way).
   */
  preludeModule?: string | false;
  /**
   * Extra ambient names beyond the built-in prelude surface — free names the integrator's
   * {@link preludeModule} supplies (site-specific components). Forwarded as the compiler's
   * `prelude.extraNames`. Ignored when `preludeModule` is `false`. Default `[]`.
   */
  extraAmbientNames?: string[];
  /**
   * How many passes a document gets to reach its fixpoint. Rendering iterates — each pass is
   * seeded with the previous pass's facts, which is what resolves forward references and lets a
   * fact derived from other facts settle — and stops at the first pass that reproduces its own
   * seed. A document still moving after `maxPasses` is a build error.
   *
   * `0` means no cap: iterate until the document stabilizes, which for a document that never
   * does is an infinite build. Default: `@nota-lang/core`'s `DEFAULT_MAX_PASSES` (5). Any other
   * value must be an integer >= 2 — a fixpoint is only observable once one pass has reproduced
   * the pass before it.
   *
   * Baked into each compiled document, so it reaches every renderer (`renderDocument`,
   * `notaRoute`) without the host restating it; an explicit call-site option still wins.
   */
  maxPasses?: number;
  /**
   * `false` to omit the bundled vite-plugin-solid (the app configures its own — remember to add
   * `".nota"` to its `extensions`). Default: included, with
   * `{ extensions: [".nota"], solid: { hydratable: true } }`.
   */
  solid?: boolean;
}

/** Generated imports that may fall back to this package's dependency tree. */
const EMIT_IMPORT_FALLBACKS = FRAMEWORK_MODULES;

/** Additional packages that publish uncompiled Solid JSX. */
const SOLID_JSX_DIST_PACKAGES: readonly string[] = [];

/** Packages whose module state must be shared by every compiled document on a page. */
export const DEDUPED_PACKAGES: readonly string[] = [
  ...FRAMEWORK_PACKAGES,
  ...SOLID_JSX_DIST_PACKAGES
];

/**
 * Packages that must be a singleton in a bundle but that the *host* owns, not Nota — the editor
 * stack `@nota-lang/codemirror` plugs into.
 *
 * CodeMirror and Lezer compare by identity: a `Facet`/`StateField` instance keys its own value,
 * a `Language` is looked up by reference through the `language` facet, and `@lezer/highlight`
 * `Tag`s are compared with `==`. Two physical copies of any of them is a correctness problem,
 * not a size problem ("Unrecognized extension value in extension set", an extension that applies
 * to nobody, highlighting that silently comes out colourless). Upstream CodeMirror declares
 * these as ordinary `dependencies` and leans on semver unification, which holds within one
 * lockfile and fails the moment there is not one: a `link:`ed package resolving out of its own
 * store, an incompatible pin somewhere in the graph, a second install root.
 *
 * The rule is by scope rather than by name because there is no line to draw inside these two:
 * every `@codemirror/*` publishes extensions and every `@lezer/*` publishes a parser or the node
 * types one is read through, so a duplicate anywhere in either scope is a duplicate that matters.
 */
const SINGLETON_SCOPES: readonly string[] = ["@codemirror", "@lezer"];

/** Unscoped members of the same set. `style-mod` keys its stylesheets by module identity. */
const SINGLETON_PACKAGES: readonly string[] = ["style-mod"];

/** Does `pkg` have to be a singleton? */
function isSingleton(pkg: string): boolean {
  return (
    SINGLETON_PACKAGES.includes(pkg) ||
    SINGLETON_SCOPES.some(scope => pkg.startsWith(`${scope}/`))
  );
}

/** The package names under `<dir>/node_modules`, scopes expanded, that must be singletons. */
function singletonsUnder(dir: string): string[] {
  const modules = join(dir, "node_modules");
  const installed = (pkg: string) =>
    existsSync(join(modules, pkg, "package.json"));
  const scoped = SINGLETON_SCOPES.flatMap(scope =>
    existsSync(join(modules, scope))
      ? readdirSync(join(modules, scope)).map(name => `${scope}/${name}`)
      : []
  );
  return [...SINGLETON_PACKAGES, ...scoped].filter(installed);
}

/**
 * The `resolve.dedupe` list for a project rooted at `root`: the framework packages, which the
 * preset requires outright, plus every singleton that project can resolve.
 *
 * Deduping a package the root *cannot* resolve is not a no-op — Vite sets the resolution basedir
 * to the root and does not fall back to the importer, so naming an absent package turns a
 * working import into an unresolved one. Hence a list read off the install rather than a fixed
 * one: a Nota site with no editors in it has none of these and must not be told to look.
 */
export function dedupedPackages(root: string): string[] {
  const singletons = new Set<string>();
  // Node resolution walks up from the importer, and so does a deduped resolution from the root.
  for (let dir = resolve(root); ; dir = dirname(dir)) {
    for (const pkg of singletonsUnder(dir)) {
      singletons.add(pkg);
    }
    if (dirname(dir) === dir) {
      break;
    }
  }
  return [...DEDUPED_PACKAGES, ...[...singletons].sort()];
}

/**
 * Which singleton packages the finished module graph holds more than one copy of, by package
 * directory.
 *
 * Deduping can only reach what the project root can resolve, so the packages that slip through
 * are precisely the ones nothing depends on *directly*: two `@codemirror/lang-*` from different
 * stores each drag their own `@codemirror/autocomplete` along, and the result is two completion
 * state fields quietly failing to be the same one. Reading it off the module graph catches that
 * regardless of how the copies got there, and the remedy is always the same — name the package
 * in the project's own dependencies so `resolve.dedupe` has a root copy to unify on.
 */
export function duplicateSingletons(
  moduleIds: Iterable<string>
): Map<string, string[]> {
  const copies = new Map<string, Set<string>>();
  for (const id of moduleIds) {
    // The innermost `node_modules/<pkg>/` is the package the module belongs to.
    const owner = [
      ...id.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)\//g)
    ].pop();
    if (!owner || !isSingleton(owner[1])) {
      continue;
    }
    const dir = id.slice(0, owner.index + owner[0].length);
    const seen = copies.get(owner[1]) ?? new Set<string>();
    copies.set(owner[1], seen.add(dir));
  }
  return new Map(
    [...copies]
      .filter(([, dirs]) => dirs.size > 1)
      .map(([pkg, dirs]) => [pkg, [...dirs].sort()])
  );
}

/**
 * The render defaults to bake into every compiled document, as source lines. Mirrors core's own
 * `checkMaxPasses` rule so a mistyped budget is a config error, not a per-document render error.
 */
function renderDefaultsEmit(options: NotaPluginOptions): string {
  const { maxPasses } = options;
  if (maxPasses === undefined) {
    return "";
  }
  if (!Number.isInteger(maxPasses) || maxPasses < 0 || maxPasses === 1) {
    throw new Error(
      `@nota-lang/vite: maxPasses must be 0 (no cap) or an integer >= 2, got ${maxPasses}`
    );
  }
  return `${DOC_EXPORT_NAME}.notaRenderOptions = ${JSON.stringify({ maxPasses })};\n`;
}

/**
 * The asset pipeline's queries. A `?raw`/`?url`/`?inline` import wants the file as bytes,
 * whatever its extension, so it is never this plugin's to transform.
 */
const ASSET_QUERY = /(?:^|&)(?:raw|url|inline)(?:&|=|$)/;

/** The query that asks for a BibTeX file as JSON: `import bib from "./refs.bib?bib"`. */
const BIB_QUERY = /(?:^|&)bib(?:&|=|$)/;

/** An id's query string, with any `#fragment` stripped. */
function queryOf(id: string): string {
  return id.split("?")[1]?.split("#")[0] ?? "";
}

/** An id's path, with any `?query` and `#fragment` stripped. */
function pathOf(id: string): string {
  return id.split("?")[0].split("#")[0];
}

/**
 * Compile claimed extensions before vite-plugin-solid, and read `?bib` imports as JSON; asset
 * queries pass through untouched.
 */
export function notaTransform(options: NotaPluginOptions = {}): Plugin {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  // Validate at plugin construction: a bad budget fails the config, not the first document.
  const renderDefaults = renderDefaultsEmit(options);
  const prelude =
    options.preludeModule === false
      ? (false as const)
      : {
          module: options.preludeModule ?? "@nota-lang/prelude",
          extraNames: options.extraAmbientNames ?? []
        };

  function claims(id: string): boolean {
    return extensions.some(ext => pathOf(id).endsWith(ext));
  }

  return {
    name: "@nota-lang/vite",
    enforce: "pre",
    config: userConfig => ({
      resolve: { dedupe: dedupedPackages(userConfig.root ?? process.cwd()) }
    }),
    async resolveId(source: string, importer: string | undefined) {
      if (
        !EMIT_IMPORT_FALLBACKS.some(
          m => source === m || source.startsWith(`${m}/`)
        )
      ) {
        return null;
      }
      // Prefer the project's copy to preserve module-state identity.
      const normal = await this.resolve(source, importer, { skipSelf: true });
      if (normal) {
        return normal;
      }
      try {
        return packageRequire.resolve(source);
      } catch {
        return null; // let Vite report the unresolved import against the real importer
      }
    },
    transform(code: string, id: string) {
      const query = queryOf(id);
      if (ASSET_QUERY.test(query)) {
        return null;
      }
      if (BIB_QUERY.test(query)) {
        // A parse error throws, same as a `.nota` compile error does, and surfaces against
        // this id. The emit is wholly generated from a non-JS source — no line of output came
        // from a line of input, which is what an empty `mappings` tells Vite.
        const bib = parseBib(code, pathOf(id));
        return {
          code: `export default ${JSON.stringify(bib)};\n`,
          map: { mappings: "" as const }
        };
      }
      if (!claims(id)) {
        return null;
      }
      // A compile error throws; Vite surfaces it as a build/overlay error against this id.
      const { code: out, map } = compile(code, { sourcePath: id, prelude });
      // Brand the component for host renderers, and attach the configured render defaults.
      // These lines sit beyond any mapped range.
      return {
        code: `${out}\n${DOC_EXPORT_NAME}.isNotaDoc = true;\n${renderDefaults}`,
        map
      };
    },
    buildEnd() {
      // Identity bugs from a duplicated singleton surface far from their cause (a dead
      // keybinding, an extension the editor rejects), so say it here, where the cause is known.
      for (const [pkg, dirs] of duplicateSingletons(this.getModuleIds())) {
        this.warn(
          `${dirs.length} copies of ${pkg} in this build. It compares by identity, so the ` +
            `copies will not recognise each other's state. Add "${pkg}" to this project's ` +
            `dependencies to give resolve.dedupe a copy to unify on:\n  ${dirs.join("\n  ")}`
        );
      }
    }
  };
}

/** Return the Nota transform and, by default, a matching vite-plugin-solid instance. */
export function nota(options: NotaPluginOptions = {}): Plugin[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const plugins: Plugin[] = [notaTransform(options)];
  if (options.solid !== false) {
    const s = viteSolid({
      extensions,
      // This enables per-transform DOM/SSR selection; it does not force every transform to SSR.
      ssr: true,
      solid: { hydratable: true }
    }) as unknown as Plugin | Plugin[];
    plugins.push(...(Array.isArray(s) ? s : [s]));
  }
  return plugins;
}

export default nota;

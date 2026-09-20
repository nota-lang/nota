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
  CORE_RUNTIME_MODULE,
  compile,
  DOC_EXPORT_NAME,
  FRAMEWORK_MODULES,
  FRAMEWORK_PACKAGES
} from "@nota-lang/compiler";
import solid from "@solidjs/vite-plugin";
import type { Plugin } from "vite";
import { parseBib } from "./bib.js";

export { type BibDatabase, type BibtexEntry, parseBib } from "./bib.js";

/** Document extensions shared by the transform and JSX presets. */
export const DEFAULT_EXTENSIONS: readonly string[] = [".nota"];
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
   * Fixpoint pass budget: default 5, 0 unlimited, otherwise an integer >= 2.
   * Emitted as component metadata for drivers and module-global defaults for self-hosted documents.
   * Explicit render options or NotaDoc props win.
   */
  maxPasses?: number;
  /**
   * `false` to omit the bundled `@solidjs/vite-plugin` (the app configures its own — remember to
   * add `".nota"` to its `extensions`). Default: included, with
   * `{ extensions: [".nota"], ssr: true, solid: { hydratable: true } }`.
   *
   * `@nota-lang/vite/start` passes `false` here and constructs start mode's instance itself:
   * exactly one JSX transform may claim `.nota`.
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
 * Host-owned singleton scopes: duplicate instances break identity-based lookups.
 * Discover only packages the host can resolve; pnpm may hide transitive signals.
 * Unreachable duplicates are reported by duplicateSingletons.
 */
const SINGLETON_SCOPES: readonly string[] = [
  "@codemirror",
  "@lezer",
  "@solidjs"
];

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
 * Framework packages plus host-resolvable singletons. Vite dedupe does not fall back
 * to the importer when a package is absent from the root.
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
  // `@solidjs/web` is in both lists (unconditional, and a member of the `@solidjs` scope).
  for (const pkg of DEDUPED_PACKAGES) {
    singletons.delete(pkg);
  }
  return [...DEDUPED_PACKAGES, ...[...singletons].sort()];
}

/**
 * Report singleton packages loaded from multiple directories; hosts must install them directly
 * so resolve.dedupe can reach them.
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

/** Import alias for emitted render defaults. */
const RENDER_DEFAULTS_ALIAS = "__notaDefaults";

/**
 * Emit driver metadata and self-hosted module defaults. The latter are global: last import wins.
 * Validate the budget here so invalid values fail at build time.
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
  const bag = JSON.stringify({ maxPasses });
  return (
    `${DOC_EXPORT_NAME}.notaRenderOptions = ${bag};\n` +
    `import { setDocRenderDefaults as ${RENDER_DEFAULTS_ALIAS} } from ${JSON.stringify(CORE_RUNTIME_MODULE)};\n` +
    `${RENDER_DEFAULTS_ALIAS}(${bag});\n`
  );
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
 * Compile claimed extensions before `@solidjs/vite-plugin`, and read `?bib` imports as JSON; asset
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

/**
 * Nota plus one JSX transform. Explicit hydratable overrides the plugin's Vitest default.
 * Use @nota-lang/vite/start for start-mode sites.
 */
export function nota(options: NotaPluginOptions = {}): Plugin[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const plugins: Plugin[] = [notaTransform(options)];
  if (options.solid !== false) {
    plugins.push(
      ...solid({
        extensions: [...extensions],
        // This enables per-transform DOM/SSR selection; it does not force every transform to SSR.
        ssr: true,
        solid: { hydratable: true }
      })
    );
  }
  return plugins;
}

export default nota;

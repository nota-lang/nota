/** Vite transform and Solid preset for `.nota` modules. See `design/solid.md`. */

import { createRequire } from "node:module";
import {
  compile,
  DOC_EXPORT_NAME,
  FRAMEWORK_MODULES,
  FRAMEWORK_PACKAGES
} from "@nota-lang/compiler";
import type { Plugin } from "vite";
import viteSolid from "vite-plugin-solid";

/** The default extension set, shared by the transform and the solid-preset config below. */
const DEFAULT_EXTENSIONS = [".nota"];
const packageRequire = createRequire(import.meta.url);

/** Options for the {@link nota} preset. */
export interface NotaPluginOptions {
  /**
   * File extensions this plugin claims (each with the leading dot). Defaults to `[".nota"]`.
   * An id is transformed iff it ends with one of these (after stripping any `?query` suffix).
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

/** Compile claimed extensions before vite-plugin-solid; asset queries pass through untouched. */
export function notaTransform(options: NotaPluginOptions = {}): Plugin {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const prelude =
    options.preludeModule === false
      ? (false as const)
      : {
          module: options.preludeModule ?? "@nota-lang/prelude",
          extraNames: options.extraAmbientNames ?? []
        };

  function claims(id: string): boolean {
    const [path, query = ""] = id.split("?");
    if (/(?:^|&)(raw|url|inline)(?:&|=|$)/.test(query.split("#")[0])) {
      return false;
    }
    return extensions.some(ext => path.split("#")[0].endsWith(ext));
  }

  return {
    name: "@nota-lang/vite",
    enforce: "pre",
    config: () => ({ resolve: { dedupe: [...DEDUPED_PACKAGES] } }),
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
      if (!claims(id)) {
        return null;
      }
      // A compile error throws; Vite surfaces it as a build/overlay error against this id.
      const { code: out, map } = compile(code, { sourcePath: id, prelude });
      // Brand the component for host renderers. This line sits beyond any mapped range.
      return { code: `${out}\n${DOC_EXPORT_NAME}.isNotaDoc = true;\n`, map };
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

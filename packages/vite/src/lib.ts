/**
 * `@nota-lang/vite` — the Vite integration for `.nota` (design/solid.md §SSG).
 *
 * {@link nota} returns a **two-plugin preset** (the solid-mdx pattern):
 *
 * 1. the `.nota → Solid JSX` transform (`enforce: "pre"`), delegating to `@nota-lang/compiler`
 *    (reader emit → jsxify → prepended `@nota-lang/solid` / `solid-js` / ambient-prelude
 *    imports), plus the fallback `resolveId` for exactly those prepended imports; and
 * 2. a pre-configured **vite-plugin-solid** claiming `.nota` alongside `.jsx`/`.tsx`, compiling
 *    the JSX per build target (dom / ssr, hydratable) — SSR-vs-dom follows each build's own ssr
 *    flag, so one preset serves the dev server, an SSG build, and a client build.
 *
 * An app that configures its own `vite-plugin-solid` passes `{ solid: false }` and adds
 * `".nota"` to its plugin's `extensions` itself. The old island registry / `generateClientEntry`
 * are gone — a document hydrates as one Solid app (`hydrateDocument`).
 */

import { createRequire } from "node:module";
import { compile } from "@nota-lang/compiler";
import type { Plugin } from "vite";
import viteSolid from "vite-plugin-solid";

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

/**
 * The modules the transform's emit imports (compiler-prepended). The transform plugin's
 * `resolveId` falls back to *this package's* copies for exactly these, so a project that
 * installed only `@nota-lang/vite` still resolves them (under pnpm's strict layout a transitive
 * dep is not importable from user code). Fallback-only: when the project has its own copy it
 * must win — `@nota-lang/solid` carries the doc-state context and `solid-js` its reactive
 * runtime, and two instances would split them.
 */
const EMIT_IMPORT_FALLBACKS = [
  "@nota-lang/solid",
  "@nota-lang/prelude",
  "solid-js"
];

/**
 * Packages whose **module state must be a singleton per page**: solid-js's reactive runtime +
 * hydration flags (`sharedConfig`, `enableHydration` — a second copy silently renders with
 * hydration context nesting disabled, so claiming misses and the client rebuilds the DOM) and
 * the `@nota-lang/*` packages carrying the doc-state context. Deduped so that a dependency
 * graph with two physical copies (the linked-workspace layout, or a consumer's own solid-js at
 * a different patch version) still bundles exactly one.
 */
const DEDUPED_PACKAGES = [
  "solid-js",
  "@nota-lang/solid",
  "@nota-lang/prelude",
  "@nota-lang/paper"
];

/**
 * The `.nota` transform plugin (half of the {@link nota} preset; exported for integrators that
 * compose their own solid pipeline).
 *
 * `transform(code, id)` — for an id ending in a claimed extension, compile to a Solid JSX module
 * via `@nota-lang/compiler` and return `{ code, map }`. vite-plugin-solid (claiming the same
 * extension, running after this `enforce: "pre"` hook) then compiles the JSX per target.
 *
 * - **Extension filter.** `?query`/`#hash` are stripped before matching (`foo.nota?t=123` still
 *   matches); `?raw`/`?url`/`?inline` are never claimed (the asset pipeline wants the file as
 *   data).
 * - **HMR.** Vite's default transform-based HMR: an edited `.nota` re-runs `transform` and Vite
 *   invalidates importers; vite-plugin-solid's solid-refresh applies where it can.
 */
export function notaTransform(options: NotaPluginOptions = {}): Plugin {
  const extensions = options.extensions ?? [".nota"];
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
    config: () => ({ resolve: { dedupe: DEDUPED_PACKAGES } }),
    async resolveId(source: string, importer: string | undefined) {
      if (
        !EMIT_IMPORT_FALLBACKS.some(
          m => source === m || source.startsWith(`${m}/`)
        )
      ) {
        return null;
      }
      // Prefer the project's own copy (see EMIT_IMPORT_FALLBACKS — module-state identity).
      const normal = await this.resolve(source, importer, { skipSelf: true });
      if (normal) {
        return normal;
      }
      // Fall back to the copy this package depends on. `require.resolve` walks from *this* file,
      // so it finds the plugin's node_modules regardless of the user project's layout.
      try {
        return createRequire(import.meta.url).resolve(source);
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
      // Brand the default export (the emit is `export default function Doc()`), so a host
      // renderer that dispatches on component type (the Astro integration's check()) can
      // recognize a Nota document exactly, without try-rendering. Appended past the mapped
      // region, so the source map is untouched.
      return { code: `${out}\nDoc.isNotaDoc = true;\n`, map };
    }
  };
}

/**
 * The nota Vite preset: the `.nota` transform + a pre-configured vite-plugin-solid claiming
 * `.nota` (unless `{ solid: false }`). Spread-safe — Vite accepts nested plugin arrays.
 *
 * @param options optional {@link NotaPluginOptions}
 * @returns the plugin array
 */
export function nota(options: NotaPluginOptions = {}): Plugin[] {
  const extensions = options.extensions ?? [".nota"];
  const plugins: Plugin[] = [notaTransform(options)];
  if (options.solid !== false) {
    const s = viteSolid({
      extensions,
      // `ssr: true` ENABLES per-transform target selection (without it vite-plugin-solid always
      // compiles generate:"dom", whose top-level template() calls throw inside an SSR module
      // graph); browser transforms still compile dom. Do NOT reuse this preset inside a vitest
      // config — vitest routes every module through its node runner with the ssr flag set, which
      // would SSR-compile jsdom tests (the reforest spike's documented gotcha).
      ssr: true,
      solid: { hydratable: true }
    }) as unknown as Plugin | Plugin[];
    plugins.push(...(Array.isArray(s) ? s : [s]));
  }
  return plugins;
}

export default nota;

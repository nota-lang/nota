/**
 * `@nota-lang/vite` — the Vite transform plugin (the mdx-equivalent for `.nota`).
 *
 * This is the **only actual Vite surface** nota ships and the whole of `@nota-lang/vite`: a single
 * `transform` hook that turns `.nota` modules into JS + sourcemap, filtered by extension, leaving
 * everything else untouched. It is structurally the mdx Vite/Rollup plugin
 * (`references/mdx/packages/rollup/lib/index.js`) — one extension-filtered `transform`, no rendering.
 * The decode/SSG/islands machinery is *not* here (the plugin is mechanism, not policy); rendering is
 * the integrator's job via `@nota-lang/runtime`'s `render`/`hydrateDocument`.
 *
 * The actual `.nota → JS` work is delegated to `@nota-lang/compiler` (`compile`), which runs the
 * oxc reader and prepends the `@nota-lang/runtime` import plus the ambient-prelude import for the
 * emit's free names. This plugin is the thin Vite adapter around it: extension filtering, option
 * forwarding (`preludeModule`/`extraAmbientNames` → the compiler's `prelude`), and the
 * fallback-only `resolveId`.
 */

import { createRequire } from "node:module";
import { compile } from "@nota-lang/compiler";
import type { Plugin } from "vite";

// --- the client hydration-entry helper (replay hydration) ---
export {
  type ClientEntryOptions,
  generateClientEntry
} from "./registry.js";

/** Options for the {@link nota} plugin. */
export interface NotaPluginOptions {
  /**
   * File extensions this plugin claims (each with the leading dot). Defaults to `[".nota"]`.
   * Mirrors mdx's `extnames` filter — an id is transformed iff it ends with one of these (after
   * stripping any `?query` suffix Vite appends).
   */
  extensions?: string[];
  /**
   * Module the ambient prelude bindings are imported from when the compiled module references them
   * free — the whole ambient prelude surface (`AMBIENT_PRELUDE_NAMES` in `@nota-lang/compiler`,
   * which owns the injection; the plugin only forwards this as the compiler's `prelude.module`).
   * Default `"@nota-lang/prelude"`; `false` disables the injection (the integrator supplies the
   * ambient names another way).
   */
  preludeModule?: string | false;
  /**
   * Extra ambient names injected beyond the built-in prelude surface — free names the integrator's
   * {@link preludeModule} supplies. The CLI passes the React hooks (`useState`, …) +
   * `registerComponents` here, pointing `preludeModule` at a module that re-exports them; every
   * listed name must be an export of that module. Forwarded as the compiler's `prelude.extraNames`.
   * Ignored when `preludeModule` is `false`. Default `[]`.
   */
  extraAmbientNames?: string[];
}

/**
 * The modules the plugin's own emit imports — the compiler-prepended `@nota-lang/runtime` line and
 * the default ambient-prelude module. {@link nota}'s `resolveId` falls back to *this
 * package's* copies for exactly these, so a project that installed only `@nota-lang/vite` still
 * resolves them (under pnpm's strict layout a transitive dep is not importable from user code).
 */
const EMIT_IMPORT_FALLBACKS = ["@nota-lang/runtime", "@nota-lang/prelude"];

/**
 * The nota Vite plugin: makes `.nota` files importable.
 *
 * `transform(code, id)` — for an `id` ending in a claimed extension (default `.nota`), compile the
 * source to a JS module via `@nota-lang/compiler` and return `{ code, map }`; for any other id,
 * return `null` (passthrough — Vite tries the next plugin).
 *
 * `resolveId(source)` — a **fallback-only** resolution for the imports the plugin itself prepends
 * ({@link EMIT_IMPORT_FALLBACKS}): normal resolution runs first (`this.resolve` with `skipSelf`),
 * and only when the user's project cannot resolve the name do we answer with this package's own
 * copy. Fallback-only matters: the runtime carries module-level state (the active adapter, the
 * registry, the `raw` brand), so when the project *does* have `@nota-lang/runtime`, that copy must
 * win — two runtime instances would split that state.
 *
 * - **Extension filter.** Like mdx, we strip Vite's `?query`/`#hash` suffix before matching, so
 *   `foo.nota?import` and `foo.nota?t=123` (HMR cache-bust) still match.
 * - **Sourcemap.** Forwarded from the compiler (`undefined` for now — the CLI does not yet emit a
 *   v3 map; sourcemap support is a forthcoming reader upgrade). Returning `{ code, map }` is the
 *   stable shape; once the compiler yields a map it flows through unchanged.
 * - **HMR.** v1 relies on Vite's **default transform-based HMR**: because the plugin participates in
 *   the module graph as a `transform`, an edited `.nota` re-runs `transform` and Vite invalidates
 *   importers. A bespoke `handleHotUpdate` (full-reload vs. partial, island-aware) is a later
 *   refinement, not needed for the importable-and-hot-reloads baseline.
 * - **`enforce: "pre"`.** Run before the core JS transforms (esbuild) so they see real JS, not the
 *   raw `.nota` source — the same ordering mdx/vue/svelte use for non-JS source modules.
 *
 * @param options optional {@link NotaPluginOptions}
 * @returns a Vite `Plugin`
 */
export function nota(options: NotaPluginOptions = {}): Plugin {
  const extensions = options.extensions ?? [".nota"];
  // The compiler owns the injection; the plugin just translates its options to the shim's shape.
  const prelude =
    options.preludeModule === false
      ? (false as const)
      : {
          module: options.preludeModule ?? "@nota-lang/prelude",
          extraNames: options.extraAmbientNames ?? []
        };

  /**
   * Does this module id name a `.nota` (or configured) source, ignoring any `?query`/`#hash`?
   * A `?raw`/`?url`/`?inline` query is Vite's asset pipeline asking for the file *as data* —
   * `import src from "./doc.nota?raw"` must yield the source string, not the compiled module —
   * so those ids are never claimed (the same carve-out mdx/vue plugins make).
   */
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
    async resolveId(source: string, importer: string | undefined) {
      if (!EMIT_IMPORT_FALLBACKS.includes(source)) {
        return null;
      }
      // Prefer the project's own copy (see the plugin doc — runtime state identity).
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
        // Not ours — passthrough so the next plugin (or Vite core) handles it.
        return null;
      }
      // Delegate to the compiler shim: runs the wasm reader and prepends the runtime import plus
      // the ambient prelude import for the emit's free names (real scope analysis, not regexes).
      // A compile error throws; Vite surfaces it as a build/overlay error against this id.
      const { code: out, map } = compile(code, { sourcePath: id, prelude });
      return { code: out, map };
    }
  };
}

export default nota;

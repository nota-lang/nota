/**
 * `@nota-lang/vite` — the Vite transform plugin (the mdx-equivalent for `.nota`).
 *
 * This is the **only actual Vite surface** nota ships and the whole of `@nota-lang/vite`: a single
 * `transform` hook that turns `.nota` modules into JS + sourcemap, filtered by extension, leaving
 * everything else untouched. It is structurally the mdx Vite/Rollup plugin
 * (`references/mdx/packages/rollup/lib/index.js`) — one extension-filtered `transform`, no rendering.
 * The decode/SSG/islands machinery is *not* here (the plugin is mechanism, not policy); rendering is
 * the integrator's job via `@nota-lang/runtime`'s `render`/`bootIslands`.
 *
 * The actual `.nota → JS` work is delegated to `@nota-lang/compiler` (`compile`), which spawns the
 * oxc reader and prepends the `@nota-lang/runtime` import. This plugin is the thin Vite adapter
 * around it.
 */

import { compile } from "@nota-lang/compiler";
import type { Plugin } from "vite";

// --- the island registry / boot-entry helper ---
export {
  type ClientEntryOptions,
  generateClientEntry
} from "./registry";

/** Options for the {@link nota} plugin. */
export interface NotaPluginOptions {
  /**
   * File extensions this plugin claims (each with the leading dot). Defaults to `[".nota"]`.
   * Mirrors mdx's `extnames` filter — an id is transformed iff it ends with one of these (after
   * stripping any `?query` suffix Vite appends).
   */
  extensions?: string[];
  /**
   * Module the ambient prelude bindings (`Tex` / `CodeInline` / `CodeBlock`, contract R14) are
   * imported from when the compiled module references them free. Default `"@nota-lang/prelude"`;
   * `false` disables the injection (the integrator supplies the ambient names another way).
   */
  preludeModule?: string | false;
}

/** The ambient names the reader emits for math/code spans (contract R14a; §9 ambient prelude). */
const AMBIENT_PRELUDE_NAMES = ["Tex", "CodeInline", "CodeBlock"] as const;

/**
 * Prepend an import binding the ambient prelude names the compiled module references *free*.
 *
 * A name is injected iff (a) it is referenced in the reader's emit shape (`h(Tex, …)` — the reader
 * only ever emits these names as `h` tags), and (b) the module does not bind it itself (a
 * `%import { Tex } from …` lexically overrides the ambient binding — R14b — and a second import
 * would be a duplicate-binding SyntaxError). The bound check is textual over the reader-controlled
 * module shape (top-level `import`/`const`/`let`/`function` lines); if the compiler ever exposes
 * its free-ambient-names metadata, swap this for it.
 */
function injectAmbientPrelude(code: string, preludeModule: string): string {
  const needed = AMBIENT_PRELUDE_NAMES.filter(
    name =>
      new RegExp(`\\bh\\(${name}\\b`).test(code) &&
      !new RegExp(
        `^import\\b[^\\n]*\\b${name}\\b[^\\n]*\\bfrom\\b|^(?:export\\s+)?(?:const|let|var|function)\\s+${name}\\b`,
        "m"
      ).test(code)
  );
  if (needed.length === 0) {
    return code;
  }
  return `import { ${needed.join(", ")} } from ${JSON.stringify(preludeModule)};\n${code}`;
}

/**
 * The nota Vite plugin: makes `.nota` files importable.
 *
 * `transform(code, id)` — for an `id` ending in a claimed extension (default `.nota`), compile the
 * source to a JS module via `@nota-lang/compiler` and return `{ code, map }`; for any other id,
 * return `null` (passthrough — Vite tries the next plugin).
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
 * @returns a Vite {@link Plugin}
 */
export function nota(options: NotaPluginOptions = {}): Plugin {
  const extensions = options.extensions ?? [".nota"];
  const preludeModule = options.preludeModule ?? "@nota-lang/prelude";

  /** Does this module id name a `.nota` (or configured) source, ignoring any `?query`/`#hash`? */
  function claims(id: string): boolean {
    const path = id.split("?")[0].split("#")[0];
    return extensions.some(ext => path.endsWith(ext));
  }

  return {
    name: "@nota-lang/vite",
    enforce: "pre",
    transform(code: string, id: string) {
      if (!claims(id)) {
        // Not ours — passthrough so the next plugin (or Vite core) handles it.
        return null;
      }
      // Delegate to the compiler shim: spawns the oxc reader and prepends the runtime import.
      // A compile error throws; Vite surfaces it as a build/overlay error against this id.
      const { code: out, map } = compile(code, { sourcePath: id });
      // Bind any free ambient prelude names (R14) — before the map exists, a prepended line is
      // safe; once the compiler emits a v3 map this must shift it (or move into the compiler).
      const withPrelude =
        preludeModule === false
          ? out
          : injectAmbientPrelude(out, preludeModule);
      return { code: withPrelude, map };
    }
  };
}

export default nota;

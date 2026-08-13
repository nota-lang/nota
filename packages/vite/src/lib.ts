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
 * The actual `.nota → JS` work is delegated to `@nota-lang/compiler` (`compile`), which spawns the
 * oxc reader and prepends the `@nota-lang/runtime` import. This plugin is the thin Vite adapter
 * around it.
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
   * free — the whole ambient prelude surface (design/decode.md §The registry & config): the
   * component slots (`Tex`/`CodeInline`/`CodeBlock`; `Heading` from `#` sugar; and the
   * `Label`/`Ref`/footnote/`Cite`/… family from the doc-state sugar) plus the config fns
   * `lstset`/`mathset`/`secset`/`bibset`. Default
   * `"@nota-lang/prelude"`; `false` disables the injection (the integrator supplies the ambient names
   * another way).
   */
  preludeModule?: string | false;
  /**
   * Extra ambient names injected beyond the built-in prelude surface — names the reader emits as
   * free *calls* (`name(…)`, the config-fn shape) that the integrator's {@link preludeModule}
   * supplies. The CLI passes the React hooks (`useState`, …) + `registerComponents` here, pointing
   * `preludeModule` at a module that re-exports them; every listed name must be an export of that
   * module. Ignored when `preludeModule` is `false`. Default `[]` (behavior unchanged).
   */
  extraAmbientNames?: string[];
}

/**
 * The ambient *component* names the reader emits free ("the prelude should be a prelude"): the
 * math/code registry slots (`Tex`/`CodeInline`/`CodeBlock`), `Heading` from `#` sugar, and the
 * doc-state family `Toc`/`Label`/`Ref`/`Footnote`/`FootnoteMark`/`FootnoteText`/`Footnotes`/
 * `FootnotesList`/`Cite`/`Bibliography` (the `<x>`/`&x`/`[^x]`/`[^x]:` doc-state sugar lowers to
 * `h(Label|Ref|FootnoteMark|FootnoteText, …)`). Each is injected iff the emit references it as an
 * `h(<name>, …)` tag.
 */
const AMBIENT_PRELUDE_NAMES = [
  "Tex",
  "CodeInline",
  "CodeBlock",
  "Heading",
  "Toc",
  "Label",
  "Ref",
  "Footnote",
  "FootnoteMark",
  "FootnoteText",
  "Footnotes",
  "FootnotesList",
  "Cite",
  "Bibliography"
] as const;

/**
 * The ambient *config* fns (doc-global config, last-write-wins, reset per render — design/decode.md
 * §The registry & config): `lstset`/`mathset`/`secset`/`bibset`. Unlike
 * the component slots these are never `h(…)` tags — they surface as bare calls in embedded JS
 * (`% secset({ numbering: "1.1" })`), so each is injected iff the emit *calls* it (`secset(`) and
 * does not bind it itself.
 */
const AMBIENT_CONFIG_NAMES = ["lstset", "mathset", "secset", "bibset"] as const;

/** Textual bound check: does the reader-controlled module shape bind `name` (import/decl)? */
function isBound(code: string, name: string): boolean {
  return new RegExp(
    `^import\\b[^\\n]*\\b${name}\\b[^\\n]*\\bfrom\\b|^(?:export\\s+)?(?:const|let|var|function)\\s+${name}\\b`,
    "m"
  ).test(code);
}

/**
 * Prepend an import binding the ambient prelude names the compiled module references *free*.
 *
 * A name is injected iff (a) it is referenced in the reader's emit shape — component slots as an
 * `h(Tex, …)` tag, config fns and the integrator's `extraNames` as a bare `secset(` call — and (b)
 * the module does not bind it itself (a `%import { Tex } from …` lexically overrides the ambient
 * binding, and a second import would be a duplicate-binding SyntaxError). The check is textual over
 * the reader-controlled module shape (top-level `import`/`const`/`let`/`function` lines); if the
 * compiler ever exposes its free-ambient-names metadata, swap this for it.
 */
function injectAmbientPrelude(
  code: string,
  preludeModule: string,
  extraNames: readonly string[] = []
): string {
  const needed = [
    // Set-dedupe: an extra name colliding with a built-in must not import twice (SyntaxError).
    ...new Set([
      ...AMBIENT_PRELUDE_NAMES.filter(
        name =>
          new RegExp(`\\bh\\(${name}\\b`).test(code) && !isBound(code, name)
      ),
      ...[...AMBIENT_CONFIG_NAMES, ...extraNames].filter(
        name =>
          new RegExp(`\\b${name}\\s*\\(`).test(code) && !isBound(code, name)
      )
    ])
  ];
  if (needed.length === 0) {
    return code;
  }
  return `import { ${needed.join(", ")} } from ${JSON.stringify(preludeModule)};\n${code}`;
}

/**
 * The modules the plugin's own emit imports — the prepended `@nota-lang/runtime` line and the
 * default {@link injectAmbientPrelude} module. {@link nota}'s `resolveId` falls back to *this
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
  const preludeModule = options.preludeModule ?? "@nota-lang/prelude";
  const extraAmbientNames = options.extraAmbientNames ?? [];

  /** Does this module id name a `.nota` (or configured) source, ignoring any `?query`/`#hash`? */
  function claims(id: string): boolean {
    const path = id.split("?")[0].split("#")[0];
    return extensions.some(ext => path.endsWith(ext));
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
      // Delegate to the compiler shim: spawns the oxc reader and prepends the runtime import.
      // A compile error throws; Vite surfaces it as a build/overlay error against this id.
      const { code: out, map } = compile(code, { sourcePath: id });
      // Bind any free ambient prelude names — before the map exists, a prepended line is
      // safe; once the compiler emits a v3 map this must shift it (or move into the compiler).
      const withPrelude =
        preludeModule === false
          ? out
          : injectAmbientPrelude(out, preludeModule, extraAmbientNames);
      return { code: withPrelude, map };
    }
  };
}

export default nota;

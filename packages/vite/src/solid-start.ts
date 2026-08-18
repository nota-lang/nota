/**
 * `@nota-lang/vite/solid-start` — the Vite preset for a SolidStart site that renders `.nota`
 * documents.
 *
 * Only the *build* half lives here. The runtime seam a document needs — `notaRoute` and
 * `NotaDocState`, which drive the two-pass render from inside the host's own render — is in
 * `@nota-lang/core`, next to the other drivers: none of it imports SolidStart.
 *
 * {@link notaStart} composes SolidStart's own plugin array with Nota's `.nota → Solid JSX`
 * transform. The composition has exactly one subtlety, and it is the reason this is a preset
 * rather than two lines of documentation: **only one `vite-plugin-solid` may claim `.nota`**.
 * SolidStart constructs its own from `extensions`, so Nota's transform is installed with
 * `{ solid: false }` and `"nota"` is handed to SolidStart instead — a second copy would compile
 * the emitted JSX twice.
 *
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { notaStart } from "@nota-lang/vite/solid-start";
 * import nitro from "nitro/vite";
 *
 * export default defineConfig({ plugins: [notaStart(), nitro()] });
 * ```
 *
 * Note what is *not* here: file-system routing over `.nota`. SolidStart's router discovers a
 * route's exports by parsing the file as TSX (`analyzeModule`, with `.md`/`.mdx` hardcoded as the
 * only non-JS exception), so a `.nota` file under `routeDir` parses as a syntax error and the
 * route is dropped. Documents therefore live outside the route directory and are named in an
 * explicit route table (see {@link notaRoute}) — which for a document site is a handful of lines
 * and reads better than the magic anyway.
 */

import type { PluginOption } from "vite";
import { type NotaPluginOptions, nota } from "./lib.js";

/** The extension SolidStart must treat as compilable Solid source. */
const NOTA_EXTENSION = "nota";

/**
 * Options for {@link notaStart}: the Nota transform's options plus whatever SolidStart's own
 * plugin takes. `extensions` is merged rather than overwritten, so a site keeping `.mdx` routes
 * alongside Nota documents does not have to restate `"nota"`.
 */
export interface NotaStartOptions {
  /** Forwarded to `@nota-lang/vite`'s transform (prelude module, extra ambient names, …). */
  nota?: Omit<NotaPluginOptions, "solid">;
  /**
   * Forwarded to `solidStart()`. `extensions` gains `"nota"`. Omit the whole key for defaults.
   * Typed structurally so this package does not have to pin SolidStart's option type.
   */
  start?: Record<string, unknown> & { extensions?: string[] };
}

/**
 * The SolidStart + Nota plugin array. Pass the result straight to Vite's `plugins`.
 *
 * `solidStart` is imported lazily so that the type-level peer dependency is the only hard one —
 * this module is also imported by tooling that has no SolidStart installed.
 */
export async function notaStart(
  options: NotaStartOptions = {}
): Promise<PluginOption[]> {
  const { solidStart } = (await import("@solidjs/start/config")) as {
    solidStart: (opts?: Record<string, unknown>) => PluginOption[];
  };
  const startOptions = options.start ?? {};
  const extensions = [...(startOptions.extensions ?? [])];
  if (!extensions.includes(NOTA_EXTENSION)) {
    extensions.push(NOTA_EXTENSION);
  }
  return [
    // enforce: "pre" — the reader runs before SolidStart's vite-plugin-solid compiles the JSX.
    ...nota({ ...options.nota, solid: false }),
    ...solidStart({ ...startOptions, extensions })
  ];
}

export default notaStart;

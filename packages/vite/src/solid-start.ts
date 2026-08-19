/**
 * Compose Nota with SolidStart while ensuring only SolidStart's vite-plugin-solid claims
 * `.nota`. SolidStart does not discover `.nota` files through its filesystem router.
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

/** Return the SolidStart plugin array with Nota support enabled. */
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

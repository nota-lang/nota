/**
 * Compose Nota with one start-mode JSX transform. Order notaFileRoutes() after this preset;
 * static sites also supply their own prerender crawler.
 */

import solid, { type Options, type StartOptions } from "@solidjs/vite-plugin";
import type { PluginOption } from "vite";
import { DEFAULT_EXTENSIONS, type NotaPluginOptions, nota } from "./lib.js";

/** Options for notaStart. */
export interface NotaStartOptions {
  /** Nota transform options; this preset owns the Solid plugin. */
  nota?: Omit<NotaPluginOptions, "solid">;
  /** Forwarded to start mode. Defaults to true (zero configuration). */
  start?: StartOptions | true;
  /** Solid plugin options; extensions merge with document extensions. */
  solid?: Omit<Options, "start" | "ssr">;
}

/** The extension name a `string | [string, ExtensionOptions]` entry registers. */
function extensionName(entry: string | [string, unknown]): string {
  return typeof entry === "string" ? entry : entry[0];
}

/**
 * The Nota transform plus a start-mode `@solidjs/vite-plugin`, in that order.
 *
 * ```ts
 * // vite.config.ts
 * import { notaStart } from "@nota-lang/vite/start";
 * export default defineConfig({
 *   plugins: [notaStart({ start: { renderMode: "async" } })]
 * });
 * ```
 */
export function notaStart(options: NotaStartOptions = {}): PluginOption[] {
  // Pass every document extension to the JSX transform too.
  const documentExtensions = options.nota?.extensions ?? DEFAULT_EXTENSIONS;
  const claimed = new Set<string>(documentExtensions);
  const extensions = [
    ...documentExtensions,
    ...(options.solid?.extensions ?? []).filter(
      e => !claimed.has(extensionName(e))
    )
  ];
  return [
    ...nota({ ...options.nota, solid: false }),
    ...solid({
      ...options.solid,
      start: options.start ?? true,
      ssr: true,
      extensions
    })
  ];
}

export default notaStart;
